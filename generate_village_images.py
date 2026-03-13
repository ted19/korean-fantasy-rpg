"""
마을 이미지 생성 - ComfyUI API + Flux.1-dev
- client/public/village/ 에 이미지 생성
- client/public/village_nobg/ 에 배경 제거 버전 (아이콘/초상화류)

사전 준비:
1. ComfyUI 실행: cd ComfyUI && python main.py
2. pip install websocket-client rembg Pillow
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

# ============================================================
# 설정
# ============================================================
COMFYUI_URL = "127.0.0.1:8188"
OUT_DIR = "F:/project/game/client/public/village"
OUT_NOBG = "F:/project/game/client/public/village_nobg"
os.makedirs(OUT_DIR, exist_ok=True)
os.makedirs(OUT_NOBG, exist_ok=True)

# ============================================================
# 공통 스타일 접두어
# ============================================================
STYLE_PREFIX = "pixel art SRPG character, Akihiko Yoshida style, tactics ogre style, japanese fantasy RPG illustration, "

# ============================================================
# 이미지 정의: (filename, width, height, prompt, nobg)
# 모든 prompt에 STYLE_PREFIX가 자동 추가됨
# ============================================================
IMAGES = [
    # ========== 마을 배경 ==========
    ("village_bg.png", 512, 512,
     "a peaceful fantasy village at sunset, traditional hanok buildings with tiled roofs, stone paths, cherry blossom trees, warm lantern light, mountains in background",
     False),

    # ========== 상점 (Shop) ==========
    ("shop_bg.png", 512, 512,
     "interior of a traditional merchant shop, wooden shelves filled with potions scrolls and weapons, warm candlelight, hanging cloth banners, cozy atmosphere",
     False),
    ("shop_card.png", 512, 256,
     "wide view of a traditional fantasy merchant shop storefront, colorful goods displayed outside, wooden sign, busy marketplace atmosphere, panoramic",
     False),
    ("shop_icon.png", 256, 256,
     "a golden coin purse with coins spilling out, shop commerce icon, simple clean, white background",
     True),
    ("merchant_banner.png", 512, 128,
     "horizontal banner of fantasy merchant shop interior, shelves of exotic goods, warm golden lighting, wide panoramic",
     False),
    ("merchant_portrait.png", 256, 256,
     "portrait of a friendly fantasy merchant, middle-aged man with a warm smile, wearing traditional hanbok merchant outfit, holding an abacus, single character, white background",
     True),

    # ========== 대장장이 (Blacksmith) ==========
    ("blacksmith_icon.png", 256, 256,
     "a crossed hammer and anvil icon, blacksmith forge symbol, metallic silver and orange glow, simple clean, white background",
     True),


    # ========== 길드 (Guild) ==========


    # ========== 퀘스트 (Quest) ==========
    ("quest_icon.png", 256, 256,
     "a rolled parchment scroll with a wax seal, quest mission icon, simple clean, white background",
     True),

    # ========== 여관 (Inn) ==========


    # ========== 휴식 (Rest) ==========
    ("rest_card.png", 512, 256,
     "wide view of a peaceful resting area in fantasy village, stone bench under cherry blossom tree, calm pond with koi fish, serene atmosphere, panoramic",
     False),
    ("rest_icon.png", 256, 256,
     "a crescent moon with stars and Z letters, rest and sleep icon, peaceful blue glow, simple clean, white background",
     True),

    # ========== 소환사 (Summoner) ==========
    ("summon_bg.png", 512, 512,
     "interior of a mystical fantasy summoning chamber, glowing magic circles on floor, floating spirit orbs, ancient scrolls and talismans on walls, ethereal purple and blue light",
     False),
    ("summon_card.png", 512, 256,
     "wide view of a mystical summoning ritual in progress, glowing magical portal with spirit emerging, ancient runes floating, ethereal energy, panoramic",
     False),
    ("summon_icon.png", 256, 256,
     "a glowing magical summoning circle icon with a spirit silhouette, purple and blue energy, simple clean, white background",
     True),
    ("summoner_banner.png", 512, 128,
     "horizontal banner of a mystical summoning chamber, floating magical orbs and spirit energy, ancient ritual circle glowing, wide panoramic",
     False),
    ("summoner_portrait.png", 256, 256,
     "portrait of a mysterious fantasy summoner, young woman with ethereal glowing eyes, wearing ritual robes with spirit talismans, floating magical energy around hands, single character, white background",
     True),

    # ========== 점술가 (Fortune) ==========
    ("fortune_banner.png", 512, 128,
     "horizontal banner of a mystical fortune teller tent interior, crystal ball, tarot cards spread out, incense smoke, dim candlelight, mysterious atmosphere",
     False),
    ("fortune_card.png", 512, 256,
     "wide view of a mysterious fortune telling chamber, crystal ball glowing on ornate table, tarot cards floating, star charts on walls, mystical purple atmosphere, panoramic",
     False),
    ("fortune_portrait.png", 256, 256,
     "portrait of an enigmatic fantasy fortune teller, old woman with piercing mystical eyes, wearing dark flowing robes with star patterns, holding glowing tarot cards, single character, white background",
     True),
]

# ============================================================
# 모델 자동 감지
# ============================================================
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

    return unet, clip_t5, clip_l, vae, unet_list, clip_list, vae_list

print("Detecting models...")
UNET_MODEL, CLIP_1, CLIP_2, VAE_MODEL, _ul, _cl, _vl = detect_models()

missing = []
if not UNET_MODEL: missing.append(f"UNET (models/unet/ 비어있음, 목록: {_ul})")
if not CLIP_1: missing.append(f"CLIP T5 (models/clip/ 비어있음, 목록: {_cl})")
if not CLIP_2: missing.append(f"CLIP L (models/clip/ 비어있음, 목록: {_cl})")
if not VAE_MODEL: missing.append(f"VAE (models/vae/ 비어있음, 목록: {_vl})")

if missing:
    print("ERROR: 모델 파일이 없습니다!")
    for m in missing:
        print(f"  - {m}")
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
    try:
        result = json.loads(urllib.request.urlopen(req).read())
        return result['prompt_id'], client_id
    except urllib.error.HTTPError as e:
        error_body = e.read().decode('utf-8')
        print(f"  API ERROR {e.code}: {error_body[:500]}")
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
            "inputs": {"images": ["9", 0], "filename_prefix": "village"}
        }
    }

    prompt_id, client_id = queue_prompt(workflow)
    wait_for_completion(prompt_id, client_id)

    history = get_history(prompt_id)
    if prompt_id not in history:
        print(f"  WARN: prompt_id not in history")
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
# 메인 처리
# ============================================================
def process_image(filename, gen_w, gen_h, prompt, nobg):
    out_path = os.path.join(OUT_DIR, filename)
    print(f"\n[{filename}] {gen_w}x{gen_h} nobg={nobg}")
    print(f"  prompt: {prompt[:80]}...")

    full_prompt = STYLE_PREFIX + prompt
    img = generate_image(full_prompt, gen_w, gen_h)
    if img is None:
        print(f"  FAILED: 이미지 생성 실패")
        return False

    if nobg and HAS_REMBG:
        try:
            img_rgba = rembg_remove(img)
            img_rgba.save(out_path)
            print(f"  [NOBG] saved {out_path}")
            # nobg 폴더에도 복사
            nobg_path = os.path.join(OUT_NOBG, filename)
            img_rgba.save(nobg_path)
        except Exception as e:
            print(f"  [NOBG] error: {e}")
            img.save(out_path)
            print(f"  [ORIG] saved {out_path} (nobg failed, fallback)")
    else:
        img.save(out_path)
        print(f"  [ORIG] saved {out_path}")

    return True

if __name__ == "__main__":
    total = len(IMAGES)
    success = 0
    fail = 0
    t0 = time.time()

    print(f"\n=== 마을 이미지 생성 시작: {total}개 ===\n")

    for i, (filename, w, h, prompt, nobg) in enumerate(IMAGES):
        print(f"\n--- [{i+1}/{total}] ---")
        try:
            if process_image(filename, w, h, prompt, nobg):
                success += 1
            else:
                fail += 1
        except Exception as e:
            print(f"  ERROR: {e}")
            fail += 1

    elapsed = time.time() - t0
    print(f"\n=== 완료: {success}/{total} 성공, {fail} 실패 ({elapsed:.1f}초) ===")
