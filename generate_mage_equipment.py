"""
신규 마법사 장비 이미지 생성 - ComfyUI API + Flux.1-dev
- 지팡이 13종, 로브 13종, 관모 13종 = 총 39종
- equipment/: {id}_icon.png (256x256)
- equipment_nobg/: 배경 제거 버전

사전 준비:
1. ComfyUI 실행: cd ComfyUI && python main.py
2. 모델 파일 배치 (generate_equipment_fullbody.py와 동일)
3. pip install websocket-client rembg pillow mysql-connector-python
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

# ============================================================
# 설정
# ============================================================
COMFYUI_URL = "127.0.0.1:8188"
OUT_DIR = "F:/project/game/client/public/equipment"
OUT_NOBG = "F:/project/game/client/public/equipment_nobg"
os.makedirs(OUT_DIR, exist_ok=True)
os.makedirs(OUT_NOBG, exist_ok=True)

# === 모델 파일명 자동 감지 ===
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

missing = []
if not UNET_MODEL: missing.append("UNET")
if not CLIP_1: missing.append("CLIP T5")
if not CLIP_2: missing.append("CLIP L")
if not VAE_MODEL: missing.append("VAE")
if missing:
    print(f"ERROR: 모델 파일 없음: {', '.join(missing)}")
    exit(1)

print(f"  UNET: {UNET_MODEL}")
print(f"  CLIP1: {CLIP_1}")
print(f"  CLIP2: {CLIP_2}")
print(f"  VAE: {VAE_MODEL}")

# ============================================================
# ComfyUI API 함수
# ============================================================
def queue_prompt(prompt):
    client_id = str(uuid.uuid4())
    p = {"prompt": prompt, "client_id": client_id}
    data = json.dumps(p).encode('utf-8')
    req = urllib.request.Request(
        f"http://{COMFYUI_URL}/prompt",
        data=data,
        headers={'Content-Type': 'application/json'}
    )
    result = json.loads(urllib.request.urlopen(req).read())
    return result['prompt_id'], client_id

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
        "1": {
            "class_type": "UNETLoader",
            "inputs": {"unet_name": UNET_MODEL, "weight_dtype": weight_dtype}
        },
        "2": {
            "class_type": "DualCLIPLoader",
            "inputs": {"clip_name1": CLIP_1, "clip_name2": CLIP_2, "type": "flux"}
        },
        "3": {
            "class_type": "CLIPTextEncode",
            "inputs": {"text": prompt_text, "clip": ["2", 0]}
        },
        "4": {
            "class_type": "CLIPTextEncode",
            "inputs": {"text": "", "clip": ["2", 0]}
        },
        "5": {
            "class_type": "EmptySD3LatentImage",
            "inputs": {"width": width, "height": height, "batch_size": 1}
        },
        "6": {
            "class_type": "FluxGuidance",
            "inputs": {"guidance": 3.5, "conditioning": ["3", 0]}
        },
        "7": {
            "class_type": "KSampler",
            "inputs": {
                "model": ["1", 0],
                "positive": ["6", 0],
                "negative": ["4", 0],
                "latent_image": ["5", 0],
                "seed": int(time.time() * 1000) % (2**32),
                "steps": 20,
                "cfg": 1.0,
                "sampler_name": "euler",
                "scheduler": "simple",
                "denoise": 1.0
            }
        },
        "8": {
            "class_type": "VAELoader",
            "inputs": {"vae_name": VAE_MODEL}
        },
        "9": {
            "class_type": "VAEDecode",
            "inputs": {"samples": ["7", 0], "vae": ["8", 0]}
        },
        "10": {
            "class_type": "SaveImage",
            "inputs": {"images": ["9", 0], "filename_prefix": "mage_equip"}
        }
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
# 프롬프트 템플릿
# ============================================================
PROMPT_STAFF = (
    "a single {desc}, "
    "centered on plain white background, RPG game item icon, "
    "fantasy game art, Akihiko Yoshida style, tactics ogre style, "
    "detailed weapon illustration, no character, no animal, object only, isolated item, white background"
)

PROMPT_ROBE = (
    "a single {desc}, "
    "displayed flat like a store mannequin display, no person wearing it, "
    "centered on plain white background, RPG game armor icon, "
    "korean traditional hanbok dopo style long coat, fantasy game art, Akihiko Yoshida style, "
    "detailed clothing illustration, no character, no animal, no creature, garment only, white background"
)

PROMPT_HAT = (
    "a single {desc}, "
    "displayed on invisible stand, no person wearing it, "
    "centered on plain white background, RPG game armor icon, "
    "korean traditional gat style hat, fantasy game art, Akihiko Yoshida style, "
    "detailed headwear illustration, no character, no animal, no creature, hat only, white background"
)

# 영문 프롬프트 매핑 (아이템 이름 → 영문 설명)
MAGE_PROMPTS = {
    # === 지팡이 (Staff) ===
    '견습 지팡이': 'simple wooden apprentice magic staff with faint blue crystal on top',
    '마력 지팡이': 'enchanted magic staff with glowing blue crystal orb on top',
    '영목 지팡이': 'ancient spirit wood magic staff with green glowing runes carved into wood',
    '청동 마장': 'bronze ornate magic staff with rune engravings and crystal tip',
    '백은 마장': 'silver magic staff with rune-inscribed shaft and moonstone orb top',
    '황금 마장': 'golden magic staff with radiant golden aura and runic inscriptions',
    '월영 지팡이': 'moon shadow staff with crescent moon ornament and silver glow',
    '뇌전 마장': 'thunder lightning magic staff with electric sparks crackling around storm crystal',
    '청룡 마장': 'azure dragon-carved magic staff with dragon motif spiraling around shaft',
    '봉황 마장': 'crimson and gold magic staff with flame-shaped ornamental top piece',
    '기린 마장': 'divine magic staff with sacred beast horn as tip, golden divine glow',
    '이무기 마장': 'dark serpent magic staff with iridescent scale texture and glowing pearl orb',
    '천제 마장': 'heavenly emperor supreme magic staff with cosmic starlight energy and jeweled top',

    # === 로브 (Robe) - 한복 도포 스타일 ===
    '견습 로브': 'simple white cloth korean dopo robe with faint blue trim, folded neatly',
    '마력 로브': 'blue silk korean dopo robe with glowing magical thread embroidery patterns',
    '영사 로브': 'purple and white korean ceremonial dopo robe with mystical symbol embroidery',
    '청동 문양 로브': 'dark green korean dopo robe with bronze metallic pattern embroidery along edges',
    '백은 문양 로브': 'elegant white korean dopo robe with silver thread embroidery, moonlight shimmer',
    '황금 문양 로브': 'luxurious dark korean dopo robe with golden runic embroidery glowing faintly',
    '비룡 로브': 'deep blue korean dopo robe with iridescent blue scale-like embroidery pattern',
    '백호 로브': 'white and gold korean dopo robe with white tiger stripe embroidery on fabric',
    '현무 로브': 'dark teal korean dopo robe with hexagonal turtle shell embroidery pattern',
    '봉황 로브': 'crimson and gold korean dopo robe with flame and wing embroidery motif',
    '기린 로브': 'golden white korean dopo robe with divine beast embroidery, ethereal glow',
    '이무기 로브': 'dark iridescent korean dopo robe with serpent scale shimmer embroidery',
    '천제 로브': 'supreme cosmic korean dopo robe with starfield and constellation embroidery pattern',

    # === 관모 (Crown/Hat) - 한국 전통 관모 스타일 ===
    '견습 두건': 'simple dark cloth korean mage hood headwrap with basic blue trim',
    '마력 두건': 'blue silk korean mage hood headwrap with glowing thread trim',
    '영사 관모': 'black korean gat ceremonial hat with mystical jade ornaments on top',
    '청동 관모': 'black korean gat hat with bronze ornamental band and rune engravings',
    '백은 관모': 'black korean gat hat with silver decorative band and moonstone jewel',
    '황금 관모': 'black korean gat hat with golden ornamental crown piece and rune glow',
    '비룡 관모': 'dark blue korean ceremonial crown hat with dragon horn-shaped ornaments',
    '백호 관모': 'white and gold korean ceremonial crown hat with tiger fang-shaped ornaments',
    '현무 관모': 'dark teal korean ceremonial crown hat with hexagonal shell-shaped ornaments',
    '봉황 관모': 'crimson and gold korean ceremonial crown hat with flame-shaped wing ornaments on top',
    '기린 관모': 'golden korean ceremonial crown hat with sacred horn ornament and divine glow',
    '이무기 관모': 'dark iridescent korean ceremonial crown hat with serpent scale ornaments',
    '천제 관모': 'supreme korean emperor crown with cosmic jewels and golden starlight ornaments',
}

# ============================================================
# DB에서 신규 아이템 로드
# ============================================================
print("Connecting to database...")
conn = mysql.connector.connect(host='localhost', user='root', password='root', database='game', charset='utf8mb4')
cursor = conn.cursor(dictionary=True)

item_names = list(MAGE_PROMPTS.keys())
placeholders = ', '.join(['%s'] * len(item_names))
cursor.execute(f"SELECT id, name, type, slot, description FROM items WHERE name IN ({placeholders}) ORDER BY id", item_names)
all_items = cursor.fetchall()
conn.close()

print(f"Found {len(all_items)} mage equipment items in DB")

if len(all_items) == 0:
    print("ERROR: 신규 마법 장비가 DB에 없습니다. 서버를 먼저 재시작하세요!")
    exit(1)

# ============================================================
# 이미지 처리
# ============================================================
def make_icon(img):
    return img.resize((256, 256), Image.LANCZOS)

def process_item(item):
    iid = item['id']
    name = item['name']
    icon_path = os.path.join(OUT_DIR, f"{iid}_icon.png")

    # 이미 존재하면 스킵
    if os.path.exists(icon_path):
        print(f"  SKIP (already exists)")
        return True

    en_desc = MAGE_PROMPTS.get(name, item.get('description', name))
    slot = item.get('slot', '')
    if slot == 'helmet':
        prompt = PROMPT_HAT.format(desc=en_desc)
    elif slot == 'chest':
        prompt = PROMPT_ROBE.format(desc=en_desc)
    else:
        prompt = PROMPT_STAFF.format(desc=en_desc)

    try:
        img = generate_image(prompt, width=512, height=512)
        if img is None:
            print(f"  ERROR: no image returned")
            return False
    except Exception as e:
        print(f"  ERROR: {e}")
        return False

    make_icon(img.copy()).save(icon_path)
    print(f"  [ICON] saved → {iid}_icon.png")

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
    import sys
    # --redo: 기존 이미지 삭제 후 재생성 (특정 ID 지정 가능)
    # 사용법: python generate_mage_equipment.py --redo 48660 48662 48663 48675
    #         python generate_mage_equipment.py --redo-all  (전체 재생성)
    redo_ids = set()
    redo_all = False
    if '--redo-all' in sys.argv:
        redo_all = True
        print("REDO ALL: 모든 이미지 재생성")
    elif '--redo' in sys.argv:
        idx = sys.argv.index('--redo')
        for arg in sys.argv[idx+1:]:
            if arg.startswith('-'): break
            redo_ids.add(int(arg))
        print(f"REDO: ID {redo_ids} 재생성")

    # 재생성 대상 기존 파일 삭제
    for item in all_items:
        iid = item['id']
        if redo_all or iid in redo_ids:
            for d in [OUT_DIR, OUT_NOBG]:
                p = os.path.join(d, f"{iid}_icon.png")
                if os.path.exists(p):
                    os.remove(p)
                    print(f"  Deleted {p}")

    try:
        urllib.request.urlopen(f"http://{COMFYUI_URL}/system_stats")
        print(f"ComfyUI server OK at {COMFYUI_URL}")
    except Exception:
        print(f"ERROR: ComfyUI server not running at {COMFYUI_URL}")
        print("먼저 ComfyUI를 실행하세요: cd ComfyUI && python main.py")
        exit(1)

    # --redo 사용 시 해당 ID만 필터링
    items_to_process = all_items
    if redo_ids:
        items_to_process = [i for i in all_items if i['id'] in redo_ids]

    start = time.time()
    total = len(items_to_process)
    success = 0
    fail = 0

    print(f"\n{'='*60}")
    print(f"Mage Equipment Image Generation")
    print(f"Model: {UNET_MODEL}")
    print(f"Total: {total} items")
    print(f"Style: Tactics Ogre / Akihiko Yoshida (Korean Fantasy)")
    print(f"{'='*60}\n")

    for i, item in enumerate(items_to_process):
        print(f"[{i+1}/{total}] ID:{item['id']} {item['name']} ({item['type']}/{item['slot']})")
        if process_item(item):
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
