"""
소환수 이미지 재생성 - ComfyUI API + Flux.1-dev
- monsters 이미지와 동일한 스타일/파이프라인
- summons/: 배경 있는 원본
- summons_nobg/: 배경 제거 버전

사전 준비:
1. ComfyUI 실행: cd ComfyUI && python main.py
2. 모델 파일 배치 (generate_monster_fullbody.py와 동일)
3. pip install websocket-client rembg
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
OUT_DIR = "F:/project/game/client/public/summons"
OUT_NOBG = "F:/project/game/client/public/summons_nobg"
os.makedirs(OUT_DIR, exist_ok=True)
os.makedirs(OUT_NOBG, exist_ok=True)

# === 모델 파일명 자동 감지 ===
def detect_models():
    """ComfyUI object_info에서 사용 가능한 모델 파일명 자동 감지"""
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

    # UNET 모델 찾기
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

    # CLIP 모델 찾기 (T5 + CLIP_L)
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

    # VAE 모델 찾기
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

# 모델 확인
missing = []
if not UNET_MODEL: missing.append(f"UNET (models/unet/ 비어있음, 목록: {_ul})")
if not CLIP_1: missing.append(f"CLIP T5 (models/clip/ 비어있음, 목록: {_cl})")
if not CLIP_2: missing.append(f"CLIP L (models/clip/ 비어있음, 목록: {_cl})")
if not VAE_MODEL: missing.append(f"VAE (models/vae/ 비어있음, 목록: {_vl})")

if missing:
    print("ERROR: 모델 파일이 없습니다!")
    for m in missing:
        print(f"  - {m}")
    print("\n다운로드: python setup_comfyui_models.py")
    print("또는 수동으로 ComfyUI/models/ 폴더에 넣으세요")
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
                        break  # 완료
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
    """ComfyUI에 Flux.1-dev 워크플로우를 보내고 이미지 반환"""

    # weight_dtype: fp8 파일이면 default, 아니면 fp8_e4m3fn으로 로드
    weight_dtype = "default" if "fp8" in UNET_MODEL.lower() else "fp8_e4m3fn"

    workflow = {
        "1": {
            "class_type": "UNETLoader",
            "inputs": {
                "unet_name": UNET_MODEL,
                "weight_dtype": weight_dtype
            }
        },
        "2": {
            "class_type": "DualCLIPLoader",
            "inputs": {
                "clip_name1": CLIP_1,
                "clip_name2": CLIP_2,
                "type": "flux"
            }
        },
        "3": {
            "class_type": "CLIPTextEncode",
            "inputs": {
                "text": prompt_text,
                "clip": ["2", 0]
            }
        },
        "4": {
            "class_type": "CLIPTextEncode",
            "inputs": {
                "text": "",
                "clip": ["2", 0]
            }
        },
        "5": {
            "class_type": "EmptySD3LatentImage",
            "inputs": {
                "width": width,
                "height": height,
                "batch_size": 1
            }
        },
        "6": {
            "class_type": "FluxGuidance",
            "inputs": {
                "guidance": 3.5,
                "conditioning": ["3", 0]
            }
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
            "inputs": {
                "samples": ["7", 0],
                "vae": ["8", 0]
            }
        },
        "10": {
            "class_type": "SaveImage",
            "inputs": {
                "images": ["9", 0],
                "filename_prefix": "summon"
            }
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
# 프롬프트 (몬스터와 동일한 스타일)
# ============================================================
PROMPT_TEMPLATE = (
    "a single {name}, "
    "full body from head to toe, front facing, standing pose, "
    "pixel art SRPG character, Akihiko Yoshida style, tactics ogre style, "
    "japanese fantasy RPG illustration, "
    "single character, white background"
)

# 소환수 영문 이름 매핑 (전체 35종)
NAME_EN = {
    # 기존 12종
    1: "wandering ghost spirit with ethereal glow",
    2: "graveyard ghost in tattered robes",
    3: "gumiho nine-tailed fox spirit soul",
    4: "small rat familiar creature",
    5: "wild wolf companion with sharp fangs",
    6: "stone golem fragment construct",
    7: "giant venomous spider queen",
    8: "water elemental spirit",
    9: "fire elemental spirit",
    10: "wind elemental spirit with swirling air",
    11: "skeleton warrior with sword and shield",
    12: "lich necromancer with skull staff and dark robes",
    # 신규 일반
    13: "stray wild cat with sharp eyes and striped fur",
    14: "ghostly will-o-wisp floating fire ball",
    15: "earth clay golem doll small construct",
    16: "skeleton soldier in rusty armor with sword",
    17: "swift mountain rabbit with wind aura",
    18: "tiny firefly spirit glowing fairy bioluminescent",
    # 신규 고급
    19: "venomous serpent coiled strike pose dripping venom",
    20: "ancient tree spirit with bark skin and leaves",
    21: "floating translucent ghost hovering above ground",
    # 신규 희귀
    22: "Korean goblin dokkaebi with horned face and magical club",
    23: "young nine-tailed fox cub glowing fox spirit cute",
    24: "jiangshi hopping vampire with paper talisman on forehead",
    # 신규 영웅
    25: "thunder elemental spirit made of lightning bolts",
    26: "yaksha fierce demon with muscular body and fire",
    # 신규 전설 (사신수)
    27: "Azure Dragon Cheongryong East Asian blue dragon with clouds",
    28: "White Tiger Baekho sacred white tiger with wind energy",
    29: "Vermillion Bird Jujak phoenix-like firebird with crimson flames",
    30: "Black Tortoise Hyeonmu giant tortoise with snake earth water",
    # 신규 신화
    31: "Korean Phoenix Bonghwang sacred firebird with rainbow tail feathers celestial",
    32: "Haetae divine lion-dog beast judge of good and evil stone mane",
    33: "Three-legged crow Samjokoh sun crow with golden solar fire",
    # 신규 초월
    34: "Dragon King Yongwang supreme sea dragon with underwater palace crown",
    35: "Heavenly Horse Cheonma winged horse celestial steed running on clouds",
}

# ============================================================
# DB 로드
# ============================================================
print("Connecting to database...")
conn = mysql.connector.connect(host='localhost', user='root', password='root', database='game')
cursor = conn.cursor(dictionary=True)
cursor.execute("SELECT id, name, type FROM summon_templates ORDER BY id")
all_summons = cursor.fetchall()
conn.close()
print(f"Loaded {len(all_summons)} summons")

# ============================================================
# 이미지 처리
# ============================================================
def make_icon(img):
    """512x512 → 상반신(상단 55%) 크롭 → 256x256"""
    w, h = img.size
    return img.crop((0, 0, w, int(h * 0.55))).resize((256, 256), Image.LANCZOS)

def process_summon(summon):
    sid = summon['id']
    name = summon['name']

    en_name = NAME_EN.get(sid)
    if not en_name:
        en_name = name

    prompt = PROMPT_TEMPLATE.format(name=en_name)

    # ComfyUI로 512x512 생성
    try:
        img = generate_image(prompt, width=512, height=512)
        if img is None:
            print(f"  ERROR: no image returned")
            return False
    except Exception as e:
        print(f"  ERROR: {e}")
        return False

    # summons/ — 배경 있는 원본
    img.save(os.path.join(OUT_DIR, f"{sid}_full.png"))
    make_icon(img.copy()).save(os.path.join(OUT_DIR, f"{sid}_icon.png"))
    print(f"  [BG] saved")

    # summons_nobg/ — 배경 제거
    if HAS_REMBG:
        try:
            nobg = rembg_remove(img)
            nobg.save(os.path.join(OUT_NOBG, f"{sid}_full.png"))
            make_icon(nobg.copy()).save(os.path.join(OUT_NOBG, f"{sid}_icon.png"))
            print(f"  [NOBG] saved")
        except Exception as e:
            print(f"  WARN rembg: {e}")

    return True

# ============================================================
# 메인
# ============================================================
if __name__ == "__main__":
    # ComfyUI 서버 체크
    try:
        urllib.request.urlopen(f"http://{COMFYUI_URL}/system_stats")
        print(f"ComfyUI server OK at {COMFYUI_URL}")
    except Exception:
        print(f"ERROR: ComfyUI server not running at {COMFYUI_URL}")
        print("먼저 ComfyUI를 실행하세요: cd ComfyUI && python main.py")
        exit(1)

    start = time.time()
    total = len(all_summons)
    success = 0
    fail = 0

    print(f"\n{'='*60}")
    print(f"ComfyUI + Flux.1-dev Summon Generation")
    print(f"Model: {UNET_MODEL}")
    print(f"Total: {total} summons @ 512x512")
    print(f"Style: Tactics Ogre / Akihiko Yoshida")
    print(f"{'='*60}\n")

    for i, s in enumerate(all_summons):
        print(f"[{i+1}/{total}] ID:{s['id']} {s['name']} ({s['type']})")
        if process_summon(s):
            success += 1
        else:
            fail += 1

    elapsed = time.time() - start
    imgs = success * (4 if HAS_REMBG else 2)
    print(f"\n{'='*60}")
    print(f"Done! {success}/{total} ok, {fail} failed")
    print(f"Images: {imgs} total")
    print(f"Time: {elapsed/60:.1f} min")
    print(f"{'='*60}")
