"""
누락된 장비 아이콘 일괄 생성 - ComfyUI API + Flux.1-dev
DB에서 이미지 없는 아이템 자동 조회 → 타입별 영어 프롬프트 생성 → ComfyUI로 생성
"""
import json, urllib.request, urllib.parse, uuid, websocket, os, io, time
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

# === 타입별 영어 프롬프트 키워드 ===
TYPE_PROMPTS = {
    'sword': 'fantasy sword, single-edge blade',
    'axe': 'fantasy battle axe, heavy two-handed axe',
    'spear': 'fantasy long spear, polearm with pointed tip',
    'bow': 'fantasy bow, curved longbow with string',
    'staff': 'fantasy magic staff, wizard rod with crystal orb',
    'talisman': 'fantasy talisman paper charm, mystical paper seal with runes',
    'bell': 'fantasy ritual bell, shamanic jingle bell with ribbons',
    'moktak': 'fantasy wooden prayer gong, Buddhist moktak percussion instrument',
    'scythe': 'fantasy war scythe, grim reaper curved blade',
    'mace': 'fantasy mace, ornate war hammer with gemstone',
    'greatshield': 'fantasy tower shield, massive two-handed fortress shield',
    'sinkal': 'fantasy divine blade, sacred Korean short sword with flame aura',
    'helmet': 'fantasy helmet, medieval head armor',
    'chest': 'fantasy chest armor, body plate armor',
    'boots': 'fantasy boots, armored greaves and boots',
    'shield': 'fantasy round shield, buckler with emblem',
    'ring': 'fantasy magic ring, gemstone ring',
    'necklace': 'fantasy necklace, ornate pendant necklace',
}

# 한국어 이름에서 영어 힌트 추출
NAME_HINTS = {
    '나무': 'wooden simple', '강철': 'steel polished', '청동': 'bronze ancient',
    '백은': 'white silver gleaming', '황금': 'golden magnificent', '용': 'dragon',
    '용아': 'dragon fang', '용린': 'dragon scale', '용골': 'dragon bone',
    '뇌전': 'lightning electric blue sparks', '뇌광': 'thunder lightning',
    '월아': 'moonlight crescent glowing', '월영': 'moonshine shadow',
    '현무': 'black tortoise dark', '백호': 'white tiger fierce',
    '주작': 'phoenix vermilion fire', '청룡': 'azure dragon water',
    '봉황': 'phoenix burning red-gold feather', '기린': 'qilin holy iridescent',
    '이무기': 'serpent dragon dark scaled', '천제': 'celestial emperor divine cosmic',
    '천마': 'demon horse dark demonic', '태초': 'primordial cosmic ultimate',
    '단군': 'Dangun divine holy', '신궁': 'divine bow sacred',
    '개벽': 'genesis creation ultimate', '태극': 'yin-yang balance',
    '풍백': 'wind spirit stormy', '산령': 'mountain spirit stone',
    '삼족오': 'three-legged crow solar', '사신': 'death god dark',
    '용왕': 'dragon king ocean', '선계': 'celestial realm holy',
    '신수': 'divine beast sacred', '해탈': 'nirvana enlightenment',
    '만다라': 'mandala sacred geometry', '니르바나': 'nirvana ultimate enlightenment',
    '화염': 'flame burning fire', '파천': 'heaven-piercing powerful',
    '금강': 'vajra diamond indestructible', '법력': 'dharma power holy',
    '반야': 'prajna wisdom sacred', '열반': 'nirvana transcendent',
    '짚': 'straw woven simple', '무명': 'rough cotton simple',
    '비룡': 'flying dragon', '가죽': 'leather simple', '철제': 'iron forged',
    '사슬': 'chainmail linked', '무쇠': 'cast iron heavy',
}

PROMPT_ITEM = (
    "a single {en_name}, "
    "centered on white background, item icon, "
    "fantasy game art, Akihiko Yoshida style, tactics ogre style, "
    "japanese fantasy RPG item illustration, "
    "detailed item art, no character, object only, white background"
)

# === 모델 감지 ===
def detect_models():
    try:
        resp = urllib.request.urlopen(f"http://{COMFYUI_URL}/object_info")
        nodes = json.loads(resp.read())
    except Exception as e:
        print(f"ERROR: ComfyUI 서버 연결 실패 - {e}")
        exit(1)
    def get_choices(node_name, input_name):
        if node_name not in nodes: return []
        req = nodes[node_name].get('input', {}).get('required', {})
        val = req.get(input_name, [[]])
        return val[0] if isinstance(val, list) and len(val) > 0 and isinstance(val[0], list) else []

    unet_list = get_choices('UNETLoader', 'unet_name')
    clip_list = get_choices('DualCLIPLoader', 'clip_name1')
    vae_list = get_choices('VAELoader', 'vae_name')

    unet = None
    for pref in ['flux1-dev-fp8', 'flux1-dev', 'flux']:
        for f in unet_list:
            if pref in f.lower(): unet = f; break
        if unet: break
    if not unet and unet_list: unet = unet_list[0]

    clip_t5, clip_l = None, None
    for f in clip_list:
        if 't5' in f.lower(): clip_t5 = f
        elif 'clip_l' in f.lower(): clip_l = f
    if not clip_t5 and clip_list: clip_t5 = clip_list[0]
    if not clip_l and len(clip_list) > 1: clip_l = clip_list[1] if clip_list[1] != clip_t5 else clip_list[0]

    vae = None
    for f in vae_list:
        if 'ae' in f.lower() or 'flux' in f.lower(): vae = f; break
    if not vae and vae_list: vae = vae_list[0]
    return unet, clip_t5, clip_l, vae

# === ComfyUI API ===
def queue_prompt(prompt):
    client_id = str(uuid.uuid4())
    data = json.dumps({"prompt": prompt, "client_id": client_id}).encode('utf-8')
    req = urllib.request.Request(f"http://{COMFYUI_URL}/prompt", data=data, headers={'Content-Type': 'application/json'})
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
                    if ed.get('prompt_id') == prompt_id and ed.get('node') is None: break
    finally:
        ws.close()

def get_history(prompt_id):
    with urllib.request.urlopen(f"http://{COMFYUI_URL}/history/{prompt_id}") as resp:
        return json.loads(resp.read())

def get_image_data(filename, subfolder, folder_type):
    params = urllib.parse.urlencode({"filename": filename, "subfolder": subfolder, "type": folder_type})
    with urllib.request.urlopen(f"http://{COMFYUI_URL}/view?{params}") as resp:
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
        "10": {"class_type": "SaveImage", "inputs": {"images": ["9", 0], "filename_prefix": "missing_item"}}
    }
    prompt_id, client_id = queue_prompt(workflow)
    wait_for_completion(prompt_id, client_id)
    history = get_history(prompt_id)
    if prompt_id not in history: return None
    outputs = history[prompt_id]['outputs']
    for node_id in outputs:
        if 'images' in outputs[node_id]:
            for img_info in outputs[node_id]['images']:
                if img_info.get('type') == 'output':
                    return Image.open(io.BytesIO(get_image_data(img_info['filename'], img_info['subfolder'], img_info['type']))).convert('RGB')
    return None

def make_icon(img):
    return img.resize((256, 256), Image.LANCZOS)

def build_en_prompt(name, item_type, weapon_subtype, level):
    """한국어 이름 → 영어 프롬프트 자동 생성"""
    base_type = TYPE_PROMPTS.get(weapon_subtype or item_type, 'fantasy item')

    # 이름에서 힌트 추출
    hints = []
    for kr, en in NAME_HINTS.items():
        if kr in name:
            hints.append(en)

    # 레벨에 따른 등급 힌트
    if level >= 80: hints.append('legendary mythical glowing divine aura')
    elif level >= 50: hints.append('epic heroic ornate glowing')
    elif level >= 28: hints.append('rare magical enchanted')
    elif level >= 10: hints.append('uncommon refined quality')

    hint_str = ' '.join(hints) if hints else 'simple basic'
    return f"{hint_str} {base_type}"

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

    print("Detecting models...")
    UNET_MODEL, CLIP_1, CLIP_2, VAE_MODEL = detect_models()
    if not all([UNET_MODEL, CLIP_1, CLIP_2, VAE_MODEL]):
        print("ERROR: 모델 파일이 없습니다!")
        exit(1)
    print(f"  UNET: {UNET_MODEL}")
    print(f"  CLIP1: {CLIP_1}")
    print(f"  CLIP2: {CLIP_2}")
    print(f"  VAE: {VAE_MODEL}")

    # DB에서 이미지 없는 아이템 조회
    print("\nConnecting to database...")
    conn = mysql.connector.connect(host='localhost', user='root', password='root', database='game')
    cur = conn.cursor(dictionary=True)
    cur.execute("SELECT id, name, type, weapon_subtype, required_level FROM items WHERE type != 'potion' ORDER BY type, required_level")
    items = cur.fetchall()
    conn.close()

    missing = []
    for item in items:
        path = os.path.join(OUT_DIR, f"{item['id']}_icon.png")
        if not os.path.exists(path):
            missing.append(item)

    if not missing:
        print("모든 아이템에 이미지가 있습니다!")
        exit(0)

    start = time.time()
    total = len(missing)
    success = 0
    fail = 0

    print(f"\n{'='*60}")
    print(f"Missing Item Icon Generation - {total} items")
    print(f"Model: {UNET_MODEL}")
    print(f"{'='*60}\n")

    for i, item in enumerate(missing):
        iid = item['id']
        name = item['name']
        en_name = build_en_prompt(name, item['type'], item.get('weapon_subtype'), item['required_level'] or 1)
        ws = f" [{item['weapon_subtype']}]" if item.get('weapon_subtype') else ''

        print(f"[{i+1}/{total}] {iid} {name} ({item['type']}{ws}, Lv{item['required_level']})")
        print(f"  prompt: {en_name[:80]}...")

        prompt = PROMPT_ITEM.format(en_name=en_name)
        try:
            img = generate_image(prompt, width=512, height=512)
            if img is None:
                print(f"  ERROR: no image returned")
                fail += 1
                continue
        except Exception as e:
            print(f"  ERROR: {e}")
            fail += 1
            continue

        # 저장
        icon_path = os.path.join(OUT_DIR, f"{iid}_icon.png")
        make_icon(img.copy()).save(icon_path)
        print(f"  [BG] saved")

        if HAS_REMBG:
            try:
                nobg = rembg_remove(img)
                nobg_path = os.path.join(OUT_NOBG, f"{iid}_icon.png")
                make_icon(nobg.copy()).save(nobg_path)
                print(f"  [NOBG] saved")
            except Exception as e:
                print(f"  WARN rembg: {e}")

        success += 1

    elapsed = time.time() - start
    print(f"\n{'='*60}")
    print(f"Done! {success}/{total} ok, {fail} failed")
    print(f"Time: {elapsed/60:.1f} min ({elapsed/max(success,1):.1f}s/item)")
    print(f"{'='*60}")
