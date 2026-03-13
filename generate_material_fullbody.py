"""
재료 아이템 이미지 생성 - ComfyUI API + Flux.1-dev
- monsters 이미지와 동일한 파이프라인
- materials/: {id}_icon.png (256x256)
- materials_nobg/: 배경 제거 버전

사전 준비: ComfyUI 실행 + 모델 배치
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
OUT_DIR = "F:/project/game/client/public/materials"
OUT_NOBG = "F:/project/game/client/public/materials_nobg"
os.makedirs(OUT_DIR, exist_ok=True)
os.makedirs(OUT_NOBG, exist_ok=True)

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
        "10": {"class_type": "SaveImage", "inputs": {"images": ["9", 0], "filename_prefix": "material"}}
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
# 프롬프트
# ============================================================
PROMPT_ITEM = (
    "a single {name}, "
    "centered on white background, item icon, "
    "fantasy game art, Akihiko Yoshida style, tactics ogre style, "
    "japanese fantasy RPG item illustration, "
    "detailed item art, no character, object only"
)

# 재료 영문 이름 매핑
NAME_EN = {
    1: "iron scrap metal fragment with rust",
    2: "leather scrap piece of animal hide",
    3: "bone fragment shard from monster",
    4: "poison sac green venomous pouch",
    5: "mana crystal glowing blue magical gem",
    6: "spirit stone with ethereal glow and sparkles",
    7: "dragon scale iridescent shimmering scale",
    8: "ghost soul stone with spectral purple glow",
    9: "dokkaebi club fragment wooden magical piece",
    10: "ocean pearl shimmering white pearl",
    11: "demon core dark red pulsing energy orb",
    12: "fire essence flame crystal with burning energy",
    13: "ice essence frozen crystal with cold mist",
    14: "enhancement stone glowing upgrade gem",
    15: "high-grade enhancement stone blue glowing gem",
    16: "rare enhancement stone diamond-like sparkling gem",
    17: "heroic enhancement stone golden trophy-shaped gem",
    18: "legendary enhancement stone star-shaped brilliant gem",
    19: "slime jelly translucent green gelatinous blob",
    20: "plant fiber green living vine fiber bundle",
    21: "dark essence black heart-shaped dark energy crystal",
    22: "dragon heart fragment burning red crystal heart",
    23: "mythic enhancement stone radiant golden star gem",
    24: "celestial essence rainbow-colored divine liquid vial",
    25: "phoenix feather brilliant red and gold feather",
    26: "primordial crystal swirling cosmic energy crystal",
    27: "star fragment glowing fallen star shard",
    28: "demon god tear crystallized blue teardrop gemstone",
}

# ============================================================
# DB 로드
# ============================================================
print("Connecting to database...")
conn = mysql.connector.connect(host='localhost', user='root', password='root', database='game', charset='utf8mb4')
cursor = conn.cursor(dictionary=True)
cursor.execute("SELECT id, name, grade, description FROM materials ORDER BY id")
all_materials = cursor.fetchall()
conn.close()
print(f"Loaded {len(all_materials)} materials")

# ============================================================
# 이미지 처리
# ============================================================
def make_icon(img):
    return img.resize((256, 256), Image.LANCZOS)

def process_material(mat):
    mid = mat['id']
    name = mat['name']

    en_name = NAME_EN.get(mid)
    if not en_name:
        en_name = mat.get('description') or name

    prompt = PROMPT_ITEM.format(name=en_name)

    try:
        img = generate_image(prompt, width=512, height=512)
        if img is None:
            print(f"  ERROR: no image returned")
            return False
    except Exception as e:
        print(f"  ERROR: {e}")
        return False

    make_icon(img.copy()).save(os.path.join(OUT_DIR, f"{mid}_icon.png"))
    print(f"  [BG] saved")

    if HAS_REMBG:
        try:
            nobg = rembg_remove(img)
            make_icon(nobg.copy()).save(os.path.join(OUT_NOBG, f"{mid}_icon.png"))
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
    total = len(all_materials)
    success = 0
    fail = 0

    print(f"\n{'='*60}")
    print(f"ComfyUI + Flux.1-dev Material Generation")
    print(f"Model: {UNET_MODEL}")
    print(f"Total: {total} materials")
    print(f"Style: Tactics Ogre / Akihiko Yoshida")
    print(f"{'='*60}\n")

    for i, mat in enumerate(all_materials):
        print(f"[{i+1}/{total}] ID:{mat['id']} {mat['name']} ({mat['grade']})")
        if process_material(mat):
            success += 1
        else:
            fail += 1

    elapsed = time.time() - start
    imgs = success * (2 if HAS_REMBG else 1)
    print(f"\n{'='*60}")
    print(f"Done! {success}/{total} ok, {fail} failed")
    print(f"Images: {imgs} total")
    print(f"Time: {elapsed/60:.1f} min")
    print(f"{'='*60}")
