"""
신규 공용 무기(창/도끼) 아이콘 생성 - ComfyUI API + Flux.1-dev
DB에서 아이템 ID를 조회하여 파일명 매핑
"""
import json
import urllib.request
import urllib.parse
import uuid
import websocket
import os
import io
import time
import mysql.connector
from PIL import Image

try:
    from rembg import remove as rembg_remove
    HAS_REMBG = True
    print("rembg loaded")
except ImportError:
    HAS_REMBG = False
    print("rembg not found - skip bg removal")

COMFYUI_URL = "127.0.0.1:8188"
OUT_DIR = "F:/project/game/client/public/equipment"
OUT_NOBG = "F:/project/game/client/public/equipment_nobg"
os.makedirs(OUT_DIR, exist_ok=True)
os.makedirs(OUT_NOBG, exist_ok=True)

# === DB 접속 ===
def get_item_id(name):
    try:
        conn = mysql.connector.connect(host='localhost', user='root', password='root', database='game')
        cur = conn.cursor()
        cur.execute("SELECT id FROM items WHERE name = %s", (name,))
        row = cur.fetchone()
        conn.close()
        return row[0] if row else None
    except Exception as e:
        print(f"  DB error: {e}")
        return None

# === 모델 감지 ===
def detect_models():
    try:
        resp = urllib.request.urlopen(f"http://{COMFYUI_URL}/object_info")
        nodes = json.loads(resp.read())
    except Exception as e:
        print(f"ERROR: ComfyUI 서버 연결 실패 - {e}")
        exit(1)

    def get_choices(node_name, input_name):
        if node_name not in nodes:
            return []
        req = nodes[node_name].get('input', {}).get('required', {})
        val = req.get(input_name, [[]])
        if isinstance(val, list) and len(val) > 0 and isinstance(val[0], list):
            return val[0]
        return []

    unet_list = get_choices('UNETLoader', 'unet_name')
    clip_list = get_choices('DualCLIPLoader', 'clip_name1')
    vae_list = get_choices('VAELoader', 'vae_name')

    unet = None
    for pref in ['flux1-dev-fp8', 'flux1-dev', 'flux']:
        for f in unet_list:
            if pref in f.lower():
                unet = f
                break
        if unet:
            break
    if not unet and unet_list:
        unet = unet_list[0]

    clip_t5, clip_l = None, None
    for f in clip_list:
        fl = f.lower()
        if 't5' in fl:
            clip_t5 = f
        elif 'clip_l' in fl:
            clip_l = f
    if not clip_t5 and clip_list:
        clip_t5 = clip_list[0]
    if not clip_l and len(clip_list) > 1:
        clip_l = clip_list[1] if clip_list[1] != clip_t5 else clip_list[0]

    vae = None
    for f in vae_list:
        if 'ae' in f.lower() or 'flux' in f.lower():
            vae = f
            break
    if not vae and vae_list:
        vae = vae_list[0]

    return unet, clip_t5, clip_l, vae

print("Detecting models...")
UNET_MODEL, CLIP_1, CLIP_2, VAE_MODEL = detect_models()

if not all([UNET_MODEL, CLIP_1, CLIP_2, VAE_MODEL]):
    print("ERROR: 모델 파일이 없습니다!")
    exit(1)

print(f"  UNET: {UNET_MODEL}")
print(f"  CLIP1: {CLIP_1}")
print(f"  CLIP2: {CLIP_2}")
print(f"  VAE: {VAE_MODEL}")

# === ComfyUI API ===
def queue_prompt(prompt):
    client_id = str(uuid.uuid4())
    p = {"prompt": prompt, "client_id": client_id}
    data = json.dumps(p).encode('utf-8')
    req = urllib.request.Request(
        f"http://{COMFYUI_URL}/prompt", data=data,
        headers={'Content-Type': 'application/json'}
    )
    try:
        result = json.loads(urllib.request.urlopen(req).read())
        return result['prompt_id'], client_id
    except urllib.error.HTTPError as e:
        print(f"  API ERROR {e.code}: {e.read().decode('utf-8')[:500]}")
        raise

def wait_for_completion(prompt_id, client_id):
    ws = websocket.WebSocket()
    ws.connect(f"ws://{COMFYUI_URL}/ws?clientId={client_id}")
    try:
        while True:
            msg = ws.recv()
            if isinstance(msg, str):
                data = json.loads(msg)
                if data.get('type') == 'executing':
                    ed = data.get('data', {})
                    if ed.get('prompt_id') == prompt_id and ed.get('node') is None:
                        break
    finally:
        ws.close()

def get_history(prompt_id):
    url = f"http://{COMFYUI_URL}/history/{prompt_id}"
    with urllib.request.urlopen(url) as resp:
        return json.loads(resp.read())

def get_image_data(filename, subfolder, folder_type):
    params = urllib.parse.urlencode({"filename": filename, "subfolder": subfolder, "type": folder_type})
    url = f"http://{COMFYUI_URL}/view?{params}"
    with urllib.request.urlopen(url) as resp:
        return resp.read()

def generate_image(prompt_text, width=512, height=512):
    weight_dtype = "default" if "fp8" in UNET_MODEL.lower() else "fp8_e4m3fn"
    workflow = {
        "1": {"class_type": "UNETLoader", "inputs": {"unet_name": UNET_MODEL, "weight_dtype": weight_dtype}},
        "2": {"class_type": "DualCLIPLoader", "inputs": {"clip_name1": CLIP_1, "clip_name2": CLIP_2, "type": "flux"}},
        "3": {"class_type": "CLIPTextEncode", "inputs": {"text": prompt_text, "clip": ["2", 0]}},
        "4": {"class_type": "CLIPTextEncode", "inputs": {"text": "", "clip": ["2", 0]}},
        "5": {"class_type": "EmptySD3LatentImage", "inputs": {"width": width, "height": height, "batch_size": 1}},
        "6": {"class_type": "FluxGuidance", "inputs": {"guidance": 3.5, "conditioning": ["3", 0]}},
        "7": {"class_type": "KSampler", "inputs": {
            "model": ["1", 0], "positive": ["6", 0], "negative": ["4", 0],
            "latent_image": ["5", 0], "seed": int(time.time() * 1000) % (2**32),
            "steps": 20, "cfg": 1.0, "sampler_name": "euler", "scheduler": "simple", "denoise": 1.0
        }},
        "8": {"class_type": "VAELoader", "inputs": {"vae_name": VAE_MODEL}},
        "9": {"class_type": "VAEDecode", "inputs": {"samples": ["7", 0], "vae": ["8", 0]}},
        "10": {"class_type": "SaveImage", "inputs": {"images": ["9", 0], "filename_prefix": "new_weapon"}}
    }

    prompt_id, client_id = queue_prompt(workflow)
    wait_for_completion(prompt_id, client_id)

    history = get_history(prompt_id)
    if prompt_id not in history:
        return None
    outputs = history[prompt_id]['outputs']
    for node_id in outputs:
        if 'images' in outputs[node_id]:
            for img_info in outputs[node_id]['images']:
                if img_info.get('type') == 'output':
                    img_bytes = get_image_data(img_info['filename'], img_info['subfolder'], img_info['type'])
                    return Image.open(io.BytesIO(img_bytes)).convert('RGB')
    return None

# ============================================================
# 신규 무기 목록 (이름, 영어 프롬프트)
# ============================================================
PROMPT_ITEM = (
    "a single {en_name}, "
    "centered on white background, item icon, "
    "fantasy game art, Akihiko Yoshida style, tactics ogre style, "
    "japanese fantasy RPG item illustration, "
    "detailed item art, no character, object only, white background"
)

NEW_WEAPONS = [
    # === 공용 창 (spear) ===
    ("나무 창", "wooden spear, simple long wooden spear with iron tip"),
    ("강철 창", "steel spear, polished steel long spear"),
    ("용아 창", "dragon fang spear, spear made of dragon teeth"),
    ("뇌전 창", "lightning spear, crackling electric spear with blue sparks"),
    ("용린 창", "dragon scale spear, ornate spear with dragon scale decorations"),
    ("단군의 신창", "divine spear of Dangun, holy golden spear with heavenly glow"),
    ("청동 창", "bronze spear, ancient bronze tipped spear"),
    ("백은 창", "silver spear, gleaming white silver spear"),
    ("황금 창", "golden spear, magnificent golden spear"),
    ("월아 창", "moonlight spear, crescent moon shaped spear glowing with moonlight"),
    ("현무 창", "black tortoise spear, dark spear with turtle shell pattern"),
    ("백호 창", "white tiger spear, fierce white spear with tiger stripe pattern"),
    ("봉황 창", "phoenix spear, burning red-gold spear with phoenix feather"),
    ("기린의 뿔창", "qilin horn spear, iridescent horn-shaped spear with holy aura"),
    ("이무기의 창", "serpent dragon spear, dark scaled spear with sea dragon motif"),
    ("천제의 창", "celestial emperor spear, ultimate divine spear glowing with cosmic energy"),

    # === 공용 도끼 (axe) ===
    ("나무 도끼", "wooden axe, simple wooden handle battle axe"),
    ("강철 도끼", "steel axe, heavy steel battle axe"),
    ("용아 도끼", "dragon fang axe, battle axe made of dragon teeth"),
    ("뇌전 도끼", "lightning axe, crackling electric battle axe with blue sparks"),
    ("용린 도끼", "dragon scale axe, ornate battle axe with dragon scale blade"),
    ("천마 도끼", "demon horse axe, dark battle axe with demonic horse motif"),
    ("청동 도끼", "bronze axe, ancient bronze battle axe"),
    ("백은 도끼", "silver axe, gleaming white silver battle axe"),
    ("황금 도끼", "golden axe, magnificent golden battle axe"),
    ("월아 도끼", "moonlight axe, crescent shaped battle axe glowing with moonlight"),
    ("현무 도끼", "black tortoise axe, dark heavy axe with turtle shell pattern"),
    ("백호 도끼", "white tiger axe, fierce battle axe with tiger stripe pattern"),
    ("봉황 도끼", "phoenix axe, burning red-gold battle axe with phoenix feather"),
    ("기린 도끼", "qilin axe, iridescent battle axe with holy aura"),
    ("이무기 도끼", "serpent dragon axe, dark scaled battle axe with sea dragon motif"),
    ("천제 도끼", "celestial emperor axe, ultimate divine battle axe glowing with cosmic energy"),
]

# ============================================================
# 이미지 처리
# ============================================================
def make_icon(img):
    return img.resize((256, 256), Image.LANCZOS)

def process_item(name, en_name):
    # DB에서 아이템 ID 조회
    iid = get_item_id(name)
    if iid is None:
        print(f"  SKIP: '{name}' not found in DB (서버를 먼저 실행하세요)")
        return False

    # 이미 이미지가 있으면 스킵
    icon_path = os.path.join(OUT_DIR, f"{iid}_icon.png")
    if os.path.exists(icon_path):
        print(f"  SKIP: already exists ({iid}_icon.png)")
        return True

    prompt = PROMPT_ITEM.format(en_name=en_name)

    try:
        img = generate_image(prompt, width=512, height=512)
        if img is None:
            print(f"  ERROR: no image returned")
            return False
    except Exception as e:
        print(f"  ERROR: {e}")
        return False

    make_icon(img.copy()).save(icon_path)
    print(f"  [BG] saved as {iid}_icon.png")

    if HAS_REMBG:
        try:
            nobg = rembg_remove(img)
            make_icon(nobg.copy()).save(os.path.join(OUT_NOBG, f"{iid}_icon.png"))
            print(f"  [NOBG] saved")
        except Exception as e:
            print(f"  WARN rembg: {e}")

    return True

# ============================================================
# 메인
# ============================================================
if __name__ == "__main__":
    try:
        urllib.request.urlopen(f"http://{COMFYUI_URL}/system_stats")
        print(f"ComfyUI server OK at {COMFYUI_URL}")
    except Exception:
        print(f"ERROR: ComfyUI server not running at {COMFYUI_URL}")
        exit(1)

    start = time.time()
    total = len(NEW_WEAPONS)
    success = 0
    fail = 0
    skip = 0

    print(f"\n{'='*60}")
    print(f"New Weapons Image Generation - {total} items")
    print(f"Model: {UNET_MODEL}")
    print(f"{'='*60}\n")

    for i, (name, en_name) in enumerate(NEW_WEAPONS):
        print(f"[{i+1}/{total}] {name}")
        result = process_item(name, en_name)
        if result:
            success += 1
        else:
            fail += 1

    elapsed = time.time() - start
    print(f"\n{'='*60}")
    print(f"Done! {success}/{total} ok, {fail} failed")
    print(f"Time: {elapsed/60:.1f} min")
    print(f"{'='*60}")
