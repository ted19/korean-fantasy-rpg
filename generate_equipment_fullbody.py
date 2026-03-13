"""
장비 아이템 이미지 생성 - ComfyUI API + Flux.1-dev
- monsters 이미지와 동일한 파이프라인
- equipment/: {id}_icon.png (256x256)
- equipment_nobg/: 배경 제거 버전

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
OUT_DIR = "F:/project/game/client/public/equipment"
OUT_NOBG = "F:/project/game/client/public/equipment_nobg"
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
if not UNET_MODEL: missing.append(f"UNET (목록: {_ul})")
if not CLIP_1: missing.append(f"CLIP T5 (목록: {_cl})")
if not CLIP_2: missing.append(f"CLIP L (목록: {_cl})")
if not VAE_MODEL: missing.append(f"VAE (목록: {_vl})")

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
    """ComfyUI에 Flux.1-dev 워크플로우를 보내고 이미지 반환"""
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
            "inputs": {"images": ["9", 0], "filename_prefix": "equipment"}
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
# 프롬프트 템플릿 (아이템 종류별)
# ============================================================
PROMPT_ITEM = (
    "a single {name}, "
    "centered on white background, item icon, "
    "fantasy game art, Akihiko Yoshida style, tactics ogre style, "
    "japanese fantasy RPG item illustration, "
    "detailed item art, no character, object only, white background"
)

# 장비 영문 이름 매핑 (ID -> English description)
NAME_EN = {
    # === 무기: 부적 (풍수사) ===
    1: "Korean paper talisman charm with mystical runes",
    2: "glowing enchanted paper talisman with spirit energy",
    3: "dragon-sealed golden talisman with dragon motif",
    # === 무기: 방울 (무당) ===
    4: "shamanic ritual bell with spirit ribbons",
    5: "divine spirit bell glowing with holy energy",
    6: "celestial blessed bell with golden ornaments",
    # === 무기: 목탁 (승려) ===
    7: "wooden Buddhist moktak percussion bell",
    8: "diamond-hard vajra moktak with golden inlay",
    9: "heaven-splitting divine moktak with radiant glow",
    # === 갑옷 ===
    10: "leather armor chest piece",
    11: "chainmail armor with metal rings",
    12: "dragon scale armor with iridescent scales",
    # === 투구 ===
    19: "leather helmet with chin strap",
    20: "iron helmet with visor",
    21: "dragon scale helmet with horn decorations",
    # === 장화 ===
    22: "leather boots",
    23: "iron-plated boots",
    24: "dragon scale boots with clawed tips",
    # === 반지 ===
    25: "copper ring with faint magical glow",
    26: "silver ring with engraved runes",
    27: "golden ring with brilliant gemstone",
    # === 목걸이 ===
    28: "bone necklace with monster fangs",
    29: "jade necklace with green gemstone pendant",
    30: "dragon eye necklace with glowing red gem",
    # === 방패 ===
    31: "wooden round shield",
    32: "iron kite shield with rivets",
    33: "dragon scale tower shield with dragon emblem",
    # === 활 ===
    214: "hunting bow with leather grip",
    215: "steel reinforced bow",
    216: "dragon bone bow with glowing string",
    # === 지팡이 (풍수사) ===
    217: "feng shui wizard staff with crystal orb",
    218: "sage wizard staff with glowing runes",
    # === 금강장 (승려) ===
    219: "vajra monk spear with golden tip",
    220: "dragon scale vajra spear with ornate head",
    # === 검 ===
    221: "bronze sword with simple crossguard",
    222: "steel longsword with leather-wrapped hilt",
    223: "dragon slayer sword with glowing blade",
    # === 천의 세트 (Tier 4) ===
    1699: "celestial divine sword with heavenly aura",
    1700: "sky-piercing divine bow with cloud motif",
    1701: "ancient spirit talisman with mystic symbols",
    1702: "divine blessed ritual bell",
    1703: "vajra diamond moktak with jeweled surface",
    1704: "divine patterns celestial silk robe chest armor",
    1705: "celestial silk helmet with feather crest",
    1706: "celestial silk boots with wind enchantment",
    1707: "celestial silk shield with divine barrier",
    1708: "moonstone ring with silver glow",
    1709: "starlight necklace with floating gems",
    # === 신령황 세트 (Tier 5) ===
    1710: "heavenly general divine sword with lightning",
    1711: "sun god bow with golden arrows",
    1712: "celestial nine-tail talisman with fox spirit",
    1713: "divine shaman ritual bell with celestial sound",
    1714: "diamond vajra moktak with radiant light",
    1715: "golden dragon divine emperor armor",
    1716: "divine emperor helmet with dragon crown",
    1717: "divine emperor boots with cloud stepping",
    1718: "divine emperor shield with dragon emblem",
    1719: "phantom jade ring with ethereal glow",
    1720: "dragon pearl necklace with ancient power",
    # === 귀혼 세트 (Tier 6) ===
    1821: "ghost soul bow with spectral energy",
    1822: "ghost soul sword with ethereal blade",
    1823: "soul binding talisman with ghost chains",
    1824: "divine ritual bell with spirit energy",
    1825: "vajra diamond staff with holy light",
    1826: "spectral ghost plates chest armor",
    1827: "ghost helmet with ethereal visor",
    1828: "ghost boots with shadow step",
    1829: "ghost shield with spectral barrier",
    1830: "amethyst ring with dark purple glow",
    1831: "underworld necklace with death energy",
    # === 코스메틱 ===
    5282: "golden butterfly portrait frame ornament",
    5283: "flame phoenix portrait frame ornament",
    5284: "starry night portrait frame ornament",
    5285: "dark shadow portrait frame ornament",
    5286: "ice crystal portrait frame ornament",
    5287: "sacred cherry blossom portrait frame ornament",
    5288: "ancient rune portrait frame ornament",
    5289: "wind spirit portrait frame ornament",
    5290: "thunder lightning portrait frame ornament",
    5291: "soul spirit portrait frame ornament",
    5502: "golden flame elegant portrait frame",
    5503: "celestial star rotating portrait frame",
    5504: "rainbow fire colorful portrait frame",
    5505: "starlight particle magical portrait frame",
    5506: "imperial golden flame portrait frame",
    5507: "chaos whirlwind dark portrait frame",
    # === 사신 세트 (저승사자, Tier 3) ===
    10316: "dark reaper scythe blade sword",
    10317: "gale wind bow with dark energy",
    10318: "soul spirit talisman with death runes",
    10319: "underworld ritual bell with eerie sound",
    10320: "death vajra moktak with skull ornament",
    10321: "bone reaper dark plates chest armor",
    10322: "reaper dark helmet with skull visor",
    10323: "reaper dark boots with shadow soles",
    10324: "reaper dark shield with skull emblem",
    10325: "death stone ring with dark gem",
    10326: "amber gemstone necklace with warm glow",
    # === 혼령 세트 (Tier 4) ===
    10327: "spirit blade sword with ghostly edge",
    10328: "spirit bow with phantom arrows",
    10329: "chaos soul talisman with swirling spirits",
    10330: "netherworld ritual bell with ghostly echo",
    10331: "cursed vajra moktak with bound spirits",
    10332: "ethereal glow spirit guardian chest armor",
    10333: "spirit guardian helmet with ghost flame",
    10334: "spirit guardian boots with phantom speed",
    10335: "spirit guardian shield with soul barrier",
    10336: "sapphire ring with deep blue glow",
    10337: "moonlight necklace with silver crescent",
    # === 마왕 세트 (Tier 5) ===
    10338: "demon king sword with burning blade",
    10339: "azure dragon bow with wind power",
    10340: "celestial flame talisman with fire spirit",
    10341: "divine thunder ritual bell with lightning",
    10342: "vajra golden staff with holy inscriptions",
    10343: "dragon scale elite armor with gemstones",
    10344: "dragon scale elite helmet with horns",
    10345: "dragon scale elite boots with claws",
    10346: "dragon scale elite shield with dragon face",
    10347: "ruby ring with blazing fire glow",
    10348: "celestial stone necklace with divine light",
    # === 명계 세트 (Tier 6) ===
    10349: "underworld reaper scythe with soul chains",
    10350: "sacred arrow bow with divine light",
    10351: "dark soul talisman with death energy",
    10352: "celestial divine ritual bell with heaven sound",
    10353: "diamond vajra staff with radiant aura",
    10354: "dark gold underworld emperor chest armor",
    10355: "underworld emperor helmet with crown",
    10356: "underworld emperor boots with shadow walk",
    10357: "underworld emperor shield with death barrier",
    10358: "emerald ring with nature power",
    10359: "dragon king necklace with ancient dragon",
    # === 기린 세트 (Tier 7) ===
    10360: "heavenly divine sword with starlight blade",
    10361: "sun bow with celestial golden light",
    10362: "divine heaven talisman with cosmic runes",
    10363: "divine beast ritual bell with unicorn motif",
    10364: "divine vajra staff with heavenly glow",
    10365: "scale patterns qilin divine chest armor",
    10366: "qilin divine helmet with horn crest",
    10367: "qilin divine boots with cloud walking",
    10368: "qilin divine shield with beast emblem",
    10369: "diamond ring with brilliant white fire",
    10370: "dragon king necklace with iridescent pearl",
    # === 천룡 세트 (Tier 8) ===
    10371: "heavenly dragon sword with divine flames",
    10372: "thunder bow with lightning arrows",
    10373: "celestial dragon talisman with golden dragon",
    10374: "supreme divine ritual bell with holy resonance",
    10375: "immortal vajra staff with eternal glow",
    10376: "celestial serpent armor with iridescent scales",
    10377: "celestial serpent helmet with dragon horns",
    10378: "celestial serpent boots with dragon claws",
    10379: "celestial serpent shield with serpent emblem",
    10380: "thousand-year jade ring with ancient power",
    10381: "ancient spirit necklace with dragon pearl",
    # === 신룡 세트 (Tier 9) ===
    10382: "divine dragon sword with cosmic energy",
    10383: "heavenly bow with divine arrows of light",
    10384: "divine dragon talisman with supreme power",
    10385: "creation divine ritual bell with cosmic sound",
    10386: "divine dragon vajra staff with celestial light",
    10387: "heavenly starlight scales dragon chest armor",
    10388: "heavenly dragon helmet with cosmic crown",
    10389: "heavenly dragon boots with cloud stepping",
    10390: "heavenly dragon shield with divine barrier",
    10391: "philosopher stone ring with transmutation glow",
    10392: "nine dragon necklace with nine dragon spirits",
}

# ============================================================
# DB 로드
# ============================================================
print("Connecting to database...")
conn = mysql.connector.connect(host='localhost', user='root', password='root', database='game', charset='utf8mb4')
cursor = conn.cursor(dictionary=True)
cursor.execute("SELECT id, name, type, slot, description FROM items WHERE type <> 'potion' ORDER BY id")
all_items = cursor.fetchall()
conn.close()
print(f"Loaded {len(all_items)} equipment items")

# ============================================================
# 이미지 처리
# ============================================================
def make_icon(img):
    """512x512 → 256x256 (장비는 전체 리사이즈, 크롭 없음)"""
    return img.resize((256, 256), Image.LANCZOS)

def process_item(item):
    iid = item['id']
    name = item['name']

    en_name = NAME_EN.get(iid)
    if not en_name:
        # 매핑에 없으면 description 사용
        en_name = item.get('description') or name

    prompt = PROMPT_ITEM.format(name=en_name)

    try:
        img = generate_image(prompt, width=512, height=512)
        if img is None:
            print(f"  ERROR: no image returned")
            return False
    except Exception as e:
        print(f"  ERROR: {e}")
        return False

    # equipment/ — 아이콘만 저장 (256x256)
    make_icon(img.copy()).save(os.path.join(OUT_DIR, f"{iid}_icon.png"))
    print(f"  [BG] saved")

    # equipment_nobg/ — 배경 제거
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
        print("먼저 ComfyUI를 실행하세요: cd ComfyUI && python main.py")
        exit(1)

    start = time.time()
    total = len(all_items)
    success = 0
    fail = 0

    print(f"\n{'='*60}")
    print(f"ComfyUI + Flux.1-dev Equipment Generation")
    print(f"Model: {UNET_MODEL}")
    print(f"Total: {total} items")
    print(f"Style: Tactics Ogre / Akihiko Yoshida")
    print(f"{'='*60}\n")

    for i, item in enumerate(all_items):
        print(f"[{i+1}/{total}] ID:{item['id']} {item['name']} ({item['type']})")
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
