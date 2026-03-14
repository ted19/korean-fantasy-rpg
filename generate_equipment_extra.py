"""
추가 장비/포션 이미지 생성 - ComfyUI API + Flux.1-dev
- 포션(13~18), 기타 누락 아이템 등 별도 생성
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
        "10": {"class_type": "SaveImage", "inputs": {"images": ["9", 0], "filename_prefix": "equip_extra"}}
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
# 생성할 아이템 목록 (ID, 이름, 영문 프롬프트)
# ============================================================
PROMPT_ITEM = (
    "a single {name}, "
    "centered on white background, item icon, "
    "fantasy game art, Akihiko Yoshida style, tactics ogre style, "
    "japanese fantasy RPG item illustration, "
    "detailed item art, no character, object only, white background"
)

EXTRA_ITEMS = [
    # === 저승사자 전용 무기 (낫/대낫) ===
    (42582, '사혼의 낫', 'a dark soul-reaping sickle, small curved blade with ghostly purple aura, korean grim reaper weapon'),
    (42583, '명계의 낫', 'a scythe of the underworld, curved dark blade with blue spirit flames, korean fantasy sickle'),
    (42584, '혈혼의 낫', 'a blood-soul sickle, crimson curved blade dripping with dark energy, korean fantasy weapon'),
    (42585, '황천의 대낫', 'a large war scythe of the yellow springs, dark steel with golden runes, two-handed korean fantasy scythe'),
    (42123, '업보의 낫', 'a karma scythe, bronze-tinted curved blade with swirling fate energy, korean fantasy weapon'),
    (42586, '영혼 수확자', 'a legendary soul harvester scythe, massive dark blade with captured souls swirling around, ornate korean fantasy war scythe'),
    (42135, '명부의 낫', 'a scythe of the death registry, silver and black blade with ghostly inscription, korean fantasy weapon'),
    (42587, '사신의 대낫', 'a mythical grim reaper great scythe, massive obsidian blade with death aura, skull ornament handle, korean fantasy'),
    (42147, '삼도천의 낫', 'a scythe of the river of three crossings, dark blade with flowing water spirits, golden guard, korean fantasy'),
    (41851, '망자의 낫', 'a scythe of the dead, ethereal green-glowing blade, spirit-guiding weapon, korean fantasy war scythe'),
    (41863, '원혼의 낫', 'a grudge spirit scythe, dark purple blade crackling with vengeful energy, korean fantasy weapon'),
    (41875, '나락의 대낫', 'a great scythe of naraka hell, massive black and red blade with hellfire, korean fantasy war scythe'),
    (41887, '저승 심판자', 'a judge of the afterlife scythe, majestic dark gold and black blade with scales of judgment ornament, korean fantasy'),
    (41899, '윤회의 낫', 'a reincarnation scythe, celestial blade with yin-yang symbol, swirling cycle of life energy, korean fantasy'),
    (41911, '무상의 대낫', 'a great scythe of impermanence, ethereal translucent blade that phases between existence, korean fantasy'),
    (41923, '영멸의 낫', 'an ultimate soul annihilation scythe, massive void-black blade consuming light itself, transcendent korean fantasy weapon'),

    # === Lv7 청동 시리즈 ===
    (42118, '청동 장검', 'a bronze longsword, simple but sturdy straight blade with leather grip, korean fantasy weapon'),
    (42119, '청동 장궁', 'a bronze longbow, reinforced bronze-tipped wooden bow with string, korean fantasy weapon'),
    (42120, '풍운 부적', 'a wind-cloud talisman, paper charm with swirling wind and cloud ink painting, korean feng shui magic item'),
    (42121, '귀신 방울', 'a ghost bell, small bronze ritual bell with ghost face engravings, korean shaman mudang item'),
    (42122, '참선 목탁', 'a zen meditation wooden moktak, polished wooden percussion instrument with buddhist carvings, korean monk item'),
    (42124, '청동 갑옷', 'bronze plate armor, chest piece with riveted bronze plates, korean fantasy armor'),
    (42125, '청동 투구', 'a bronze helmet, domed helmet with cheek guards, korean fantasy armor'),
    (42126, '청동 장화', 'bronze greaves and boots, bronze-plated leather boots, korean fantasy armor'),
    (42127, '청동 방패', 'a bronze round shield, polished bronze face with dragon emblem, korean fantasy shield'),
    (42128, '옥 반지', 'a jade ring, smooth green jade band with subtle glow, korean fantasy accessory'),
    (42129, '은빛 목걸이', 'a silver necklace, delicate silver chain with crescent moon pendant, korean fantasy accessory'),

    # === Lv10 백은 시리즈 ===
    (42130, '백은 검', 'a white silver sword, gleaming silver blade with etched runes, korean fantasy weapon'),
    (42131, '백은 궁', 'a white silver bow, elegant silver-reinforced bow with moonlight sheen, korean fantasy weapon'),
    (42132, '천문 부적', 'an astronomy talisman, dark blue paper charm with constellation patterns in gold ink, korean feng shui item'),
    (42133, '영매 방울', 'a spirit medium bell, ornate silver bell with spirit channeling engravings, korean shaman item'),
    (42134, '법력 목탁', 'a dharma power moktak, golden wooden percussion with sutra inscriptions, korean monk item'),
    (42136, '백은 갑옷', 'white silver plate armor, shining silver chest piece with ornate engravings, korean fantasy armor'),
    (42137, '백은 투구', 'a white silver helmet, polished silver helm with wing ornaments, korean fantasy armor'),
    (42138, '백은 장화', 'white silver boots, silver-plated armored boots with moon motif, korean fantasy armor'),
    (42139, '백은 방패', 'a white silver shield, mirror-like silver shield with phoenix emblem, korean fantasy shield'),
    (42140, '자수정 반지', 'an amethyst ring, gold band with large purple amethyst gemstone, korean fantasy accessory'),
    (42141, '수정 목걸이', 'a crystal necklace, clear quartz crystal pendant on silver chain, korean fantasy accessory'),

    # === Lv15 황금 시리즈 ===
    (42142, '황금 검', 'a golden sword, ornate gold-hilted blade with royal engravings, korean fantasy weapon'),
    (42143, '황금 궁', 'a golden bow, magnificent gold-reinforced bow with dragon motif, korean fantasy weapon'),
    (42144, '도참 부적', 'a prophecy talisman, ancient golden paper charm with cryptic future-seeing symbols, korean feng shui item'),
    (42145, '접신 방울', 'a divine possession bell, golden ritual bell radiating divine light, korean shaman item'),
    (42146, '범종 목탁', 'a temple bell moktak, large golden wooden percussion shaped like a temple bell, korean monk item'),
    (42148, '황금 갑옷', 'golden plate armor, magnificent gold-plated chest piece with dragon scales, korean fantasy armor'),
    (42149, '황금 투구', 'a golden helmet, regal gold helm with phoenix crest, korean fantasy armor'),
    (42150, '황금 장화', 'golden boots, gold-plated armored boots with cloud motif, korean fantasy armor'),
    (42151, '황금 방패', 'a golden shield, radiant gold shield with tiger emblem, korean fantasy shield'),
    (42152, '홍옥 반지', 'a ruby ring, gold band with brilliant red ruby gemstone, korean fantasy accessory'),
    (42153, '금 목걸이', 'a pure gold necklace, thick gold chain with ornate dragon pendant, korean fantasy accessory'),
]

# ============================================================
# 이미지 처리
# ============================================================
def make_icon(img):
    return img.resize((256, 256), Image.LANCZOS)

def process_item(iid, name, en_name):
    prompt = PROMPT_ITEM.format(name=en_name)

    try:
        img = generate_image(prompt, width=512, height=512)
        if img is None:
            print(f"  ERROR: no image returned")
            return False
    except Exception as e:
        print(f"  ERROR: {e}")
        return False

    make_icon(img.copy()).save(os.path.join(OUT_DIR, f"{iid}_icon.png"))
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
    total = len(EXTRA_ITEMS)
    success = 0
    fail = 0

    print(f"\n{'='*60}")
    print(f"ComfyUI + Flux.1-dev Extra Equipment Generation")
    print(f"Model: {UNET_MODEL}")
    print(f"Total: {total} items (potions + extras)")
    print(f"{'='*60}\n")

    for i, (iid, name, en_name) in enumerate(EXTRA_ITEMS):
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
