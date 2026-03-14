"""
누락된 물약 이미지 생성 - ComfyUI API + Flux.1-dev
- 물약 ID 10305~10315 (11개)
- equipment/: {id}_icon.png (256x256)

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
        "10": {"class_type": "SaveImage", "inputs": {"images": ["9", 0], "filename_prefix": "potion_gen"}}
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
# 누락된 물약 목록 (ID, 이름, 영문 프롬프트)
# ============================================================
PROMPT_POTION = (
    "a single {name}, "
    "centered on white background, item icon, "
    "fantasy game art, Akihiko Yoshida style, tactics ogre style, "
    "japanese fantasy RPG potion illustration, "
    "detailed item art, no character, object only, white background"
)

PROMPT_TALISMAN = (
    "a single {name}, "
    "centered on white background, item icon, "
    "fantasy game art, Akihiko Yoshida style, tactics ogre style, "
    "korean fantasy talisman paper charm illustration, "
    "mystical paper talisman with ink calligraphy and glowing runes, "
    "detailed item art, no character, object only, white background"
)

POTIONS = [
    (10305, '체력 물약(특대)', 'extra large health potion, huge glass bottle filled with bright red healing liquid, golden cap, glowing red aura'),
    (10306, '체력 영약', 'supreme health elixir, ornate crystal flask with deep crimson elixir, golden filigree stopper, radiant healing glow'),
    (10307, '선단', 'immortal pill seondan, luminous golden pill on a jade plate, divine healing medicine, korean fantasy alchemy'),
    (10308, '마력 물약(특대)', 'extra large mana potion, huge glass bottle filled with bright blue magical liquid, silver cap, glowing blue aura'),
    (10309, '영력약', 'supreme spirit power elixir, ornate crystal flask with deep azure spirit essence, arcane runes on bottle, mystical blue glow'),
    (10310, '만병통치약', 'universal cure-all panacea, dual-colored potion bottle half red half blue, ornate golden stopper, rainbow healing aura'),
    (10311, '해독제', 'antidote vial, small green glass bottle with bright green liquid, leaf-shaped cork, purifying green glow'),
    (10312, '환생석', 'resurrection stone, glowing golden crystal stone with phoenix feather inside, radiant revival light, korean fantasy item'),
    (10313, '공격 부적', 'attack power talisman, red paper charm with golden sword symbol, burning flame aura, korean fantasy combat buff item'),
    (10314, '방어 부적', 'defense talisman, blue paper charm with golden shield symbol, protective barrier aura, korean fantasy defense buff item'),
    (10315, '도주 연막', 'escape smoke bomb, small black spherical bomb with trailing grey smoke, ninja style, korean fantasy retreat item'),

    # === 부적(talisman) 아이템 ===
    (42601, '치명 부적', 'critical strike talisman, yellow paper charm with red lightning bolt symbol, crackling energy aura, korean fantasy talisman'),
    (42602, '회피 부적', 'evasion talisman, pale green paper charm with wind swirl symbol, swift breeze aura, korean fantasy talisman'),
    (42603, '속도 부적', 'speed talisman, white paper charm with golden wings symbol, shimmering speed aura, korean fantasy talisman'),
    (42604, '결계 부적', 'barrier talisman, blue paper charm with circular barrier rune, glowing protective dome aura, korean fantasy talisman'),
    (42605, '파괴 부적', 'destruction talisman, dark red paper charm with flaming fist symbol, intense fire aura, korean fantasy talisman'),
    (42606, '철벽 부적', 'iron wall talisman, silver paper charm with fortress shield symbol, heavy metallic aura, korean fantasy talisman'),
    (42607, '재생 부적', 'regeneration talisman, green paper charm with blooming lotus symbol, gentle healing green glow, korean fantasy talisman'),
    (42608, '마력 충전 부적', 'mana charge talisman, deep blue paper charm with spiraling mana crystal symbol, arcane blue glow, korean fantasy talisman'),
    (42609, '부활 부적', 'revival talisman, golden paper charm with phoenix rising symbol, radiant golden revival aura, korean fantasy talisman'),
    (42610, '저주 부적', 'curse talisman, dark purple paper charm with evil eye symbol, ominous dark purple aura, korean fantasy talisman'),
    (42611, '봉인 부적', 'sealing talisman, white paper charm with black chain lock symbol, binding energy aura, korean fantasy talisman'),
    (42612, '천명 부적', 'heavenly mandate talisman, ornate golden paper charm with celestial dragon symbol, divine golden aura, korean fantasy talisman'),
    (42613, '파천 부적', 'sky-breaking talisman, crimson paper charm with exploding star symbol, devastating energy aura, korean fantasy talisman'),
    (42614, '불멸 부적', 'immortality talisman, radiant white paper charm with eternal flame symbol, blinding holy aura, korean fantasy legendary talisman'),
]

# ============================================================
# 이미지 처리
# ============================================================
def make_icon(img):
    return img.resize((256, 256), Image.LANCZOS)

def process_item(iid, name, en_name):
    out_path = os.path.join(OUT_DIR, f"{iid}_icon.png")
    if os.path.exists(out_path):
        print(f"  SKIP (already exists)")
        return True

    # 부적(42601~)은 부적 전용 프롬프트 사용
    if iid >= 42601:
        prompt = PROMPT_TALISMAN.format(name=en_name)
    else:
        prompt = PROMPT_POTION.format(name=en_name)

    try:
        img = generate_image(prompt, width=512, height=512)
        if img is None:
            print(f"  ERROR: no image returned")
            return False
    except Exception as e:
        print(f"  ERROR: {e}")
        return False

    make_icon(img.copy()).save(out_path)
    print(f"  [BG] saved")

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
    total = len(POTIONS)
    success = 0
    fail = 0

    print(f"\n{'='*60}")
    print(f"ComfyUI + Flux.1-dev Potion Image Generation")
    print(f"Model: {UNET_MODEL}")
    print(f"Total: {total} items (potions + talismans)")
    print(f"{'='*60}\n")

    for i, (iid, name, en_name) in enumerate(POTIONS):
        print(f"[{i+1}/{total}] ID:{iid} {name}")
        if process_item(iid, name, en_name):
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
