"""
몬스터 이미지 재생성 - ComfyUI API + Flux.1-dev
- ComfyUI 서버(localhost:8188)에 API로 워크플로우 전송
- monsters/: 배경 있는 원본
- monsters_nobg/: 배경 제거 버전

사전 준비:
1. ComfyUI 실행: cd ComfyUI && python main.py
2. 모델 파일 배치:
   - ComfyUI/models/unet/flux1-dev-Q8_0.gguf  (또는 .safetensors)
   - ComfyUI/models/clip/t5xxl_fp16.safetensors
   - ComfyUI/models/clip/clip_l.safetensors
   - ComfyUI/models/vae/ae.safetensors
3. ComfyUI-GGUF 커스텀 노드 설치 (GGUF 사용 시)
4. pip install websocket-client rembg
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
OUT_DIR = "F:/project/game/client/public/monsters"
OUT_NOBG = "F:/project/game/client/public/monsters_nobg"
os.makedirs(OUT_DIR, exist_ok=True)
os.makedirs(OUT_NOBG, exist_ok=True)

# === 모델 파일명 자동 감지 ===
# ComfyUI API에서 사용 가능한 모델 목록 가져오기
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
        # 1. UNET 모델 로드
        "1": {
            "class_type": "UNETLoader",
            "inputs": {
                "unet_name": UNET_MODEL,
                "weight_dtype": weight_dtype
            }
        },

        # 2. CLIP 로드 (T5-XXL + CLIP-L)
        "2": {
            "class_type": "DualCLIPLoader",
            "inputs": {
                "clip_name1": CLIP_1,
                "clip_name2": CLIP_2,
                "type": "flux"
            }
        },

        # 3. 포지티브 프롬프트
        "3": {
            "class_type": "CLIPTextEncode",
            "inputs": {
                "text": prompt_text,
                "clip": ["2", 0]
            }
        },

        # 4. 네거티브 프롬프트 (Flux는 빈 문자열)
        "4": {
            "class_type": "CLIPTextEncode",
            "inputs": {
                "text": "",
                "clip": ["2", 0]
            }
        },

        # 5. 빈 레이턴트 이미지
        "5": {
            "class_type": "EmptySD3LatentImage",
            "inputs": {
                "width": width,
                "height": height,
                "batch_size": 1
            }
        },

        # 6. FluxGuidance
        "6": {
            "class_type": "FluxGuidance",
            "inputs": {
                "guidance": 3.5,
                "conditioning": ["3", 0]
            }
        },

        # 7. KSampler
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

        # 8. VAE 로드
        "8": {
            "class_type": "VAELoader",
            "inputs": {"vae_name": VAE_MODEL}
        },

        # 9. VAE 디코드
        "9": {
            "class_type": "VAEDecode",
            "inputs": {
                "samples": ["7", 0],
                "vae": ["8", 0]
            }
        },

        # 10. 이미지 저장
        "10": {
            "class_type": "SaveImage",
            "inputs": {
                "images": ["9", 0],
                "filename_prefix": "monster"
            }
        }
    }

    # API 호출
    prompt_id, client_id = queue_prompt(workflow)
    wait_for_completion(prompt_id, client_id)

    # 결과 이미지 가져오기
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
# 프롬프트 (심플하게 이름만)
# ============================================================
PROMPT_TEMPLATE = (
    "a single {name}, "
    "full body from head to toe, front facing, standing pose, "
    "pixel art SRPG character, Akihiko Yoshida style, tactics ogre style, "
    "japanese fantasy RPG illustration, "
    "single character, white background"
)

# 몬스터 영문 이름 매핑
NAME_EN = {
    1: "giant rat",
    2: "dire wolf",
    3: "giant venomous spider",
    4: "giant cave bat",
    5: "stone golem with glowing runes",
    6: "giant underground lizard",
    7: "Korean vengeful ghost in white hanbok",
    8: "cursed undead Buddhist monk",
    9: "dark armored shadow guardian with glaive",
    10: "mountain hare",
    11: "wild boar with large tusks",
    12: "giant venomous cobra",
    13: "large black bear",
    14: "snow leopard",
    15: "grizzly bear",
    16: "giant python",
    17: "celestial white tiger with glowing stripes",
    18: "three-headed hellhound",
    19: "nine-tailed fox spirit",
    20: "giant centipede",
    21: "giant poison moth",
    22: "giant killer bee",
    23: "giant scorpion",
    24: "giant ant queen",
    25: "giant rhinoceros beetle",
    26: "giant spider queen",
    27: "giant praying mantis warrior",
    28: "skeleton warrior with sword and shield",
    29: "zombie",
    30: "ghoul",
    31: "wraith in tattered robes",
    32: "vampire lord in black cloak",
    33: "death knight in dark plate armor",
    34: "lich king with skull staff",
    35: "skeleton archer",
    36: "ancient mummy",
    37: "wandering ghost spirit",
    38: "Korean maiden ghost in white dress",
    39: "yaksha demon warrior",
    40: "water ghost rising from water",
    41: "imoogi giant serpent dragon",
    42: "living shadow entity",
    43: "blind ghost with cloth over eyes",
    44: "moon ghost glowing silver",
    45: "water elemental spirit",
    46: "fire elemental spirit",
    47: "wind elemental spirit",
    48: "earth elemental spirit",
    49: "lightning elemental spirit",
    50: "ice elemental spirit",
    51: "light elemental spirit",
    52: "dark elemental spirit",
    53: "elemental spirit king",
    54: "small red imp devil",
    55: "succubus demon woman",
    56: "incubus demon",
    57: "hellhound with flaming body",
    58: "balrog fire demon with whip",
    59: "demon warrior in dark armor",
    60: "fallen angel with broken black wings",
    61: "demon king on throne",
    62: "stone gargoyle",
    63: "dark six-winged seraphim angel",
    64: "baby dragon hatchling",
    65: "wyvern with spread wings",
    66: "red fire dragon",
    67: "blue ice dragon",
    68: "black dark dragon",
    69: "golden dragon king",
    70: "wingless drake",
    71: "multi-headed hydra",
    72: "thunder dragon with lightning",
    73: "enchanted floating empty suit of armor",
    74: "magical stone guardian construct",
    75: "homunculus alchemical creature",
    76: "mana golem made of magical energy",
    77: "white unicorn with crystal horn",
    78: "griffin eagle-lion hybrid",
    79: "phoenix firebird",
    80: "mimic treasure chest monster",
    81: "giant poison mushroom creature",
    82: "vine tentacle plant monster",
    83: "ancient treant living tree",
    84: "man-eating giant flower",
    85: "floating spore swarm colony",
    86: "mandrake root creature",
    87: "living fragment of the World Tree",
    88: "fungus lord mushroom king",
    89: "Korean mountain bandit",
    90: "dark assassin with dual blades",
    91: "dark sorcerer with void magic",
    92: "fallen corrupted knight",
    93: "berserker warrior with two axes",
    94: "necromancer with skull staff",
    95: "archmage casting magic",
    96: "bandit chief",
    97: "small Korean dokkaebi goblin",
    98: "fire dokkaebi wreathed in flames",
    99: "stone dokkaebi made of rock",
    100: "dokkaebi general in battle armor",
    101: "dokkaebi goblin king on throne",
    102: "pond dokkaebi water goblin",
    103: "dokkaebi warrior with enchanted club",
    104: "forest dokkaebi covered in leaves",
    105: "gumiho nine-tailed fox woman",
    106: "haetae lion guardian beast with horn",
    107: "bulgasari iron-eating bull monster",
    108: "chimera with lion goat and snake heads",
    109: "minotaur with axe",
    110: "medusa with snake hair",
    111: "frost giant with ice axe",
    112: "werewolf mid-transformation",
    113: "green slime",
    114: "blue water slime",
    115: "red fire slime",
    116: "purple poison slime",
    117: "metallic quicksilver slime",
    118: "king slime with golden crown",
    119: "giant jellyfish",
    120: "dark slime lord",
    121: "lava slime made of magma",
    122: "crystal slime with gemstones",
    123: "giant predatory slime",
    124: "giant king crab",
    125: "dire shark",
    126: "giant octopus",
    127: "merman warrior with trident",
    128: "deep sea anglerfish monster",
    129: "kraken sea monster",
    130: "seahorse knight in coral armor",
    131: "sea dragon",
    132: "gumiho celestial nine-tailed fox",
    133: "haetae divine fire-eating lion beast",
    134: "bulgasari immortal iron-eating beast",
    135: "imoogi great serpent pre-dragon",
    136: "Korean divine dragon (yong)",
    137: "chollima divine winged horse",
    138: "bonghwang Korean five-colored phoenix",
    139: "samjoko three-legged sun crow",
    140: "bulgae Korean fire dog",
    141: "samjokgu three-legged spirit dog",
    142: "Korean virgin ghost (cheonyeogwisin)",
    143: "Korean water ghost (mulgwisin)",
    144: "Korean bachelor ghost (mongdalgwisin)",
    145: "Korean egg ghost with featureless face",
    146: "Korean vengeful spirit (wonhon)",
    147: "Korean grim reaper (jeoseungsaja) in black robes and tall hat",
    148: "Korean shoe-trying ghost (yagwanggwi)",
    149: "Gangrim Doryeong Korean underworld official",
    150: "Korean dokkaebi goblin with magic club",
    151: "benevolent true dokkaebi (cham-dokkaebi)",
    152: "beautiful maiden dokkaebi (gaksi-dokkaebi)",
    153: "evil blood dokkaebi (gwisu-dokkaebi)",
    154: "Korean mountain god (sansin) old man with tiger",
    155: "Korean dragon king (yongwang) sea dragon",
    156: "Chilseong Big Dipper constellation spirit",
    157: "Korean tree spirit (moksin)",
    158: "Yeongdeung Halmae Korean wind goddess",
    159: "inmyeonjo human-faced Korean bird",
    160: "Baekho divine White Tiger",
    161: "Hyeonmu divine Black Turtle with Snake",
    162: "Cheongryong divine Azure Dragon",
    163: "Jujak divine Vermilion Bird phoenix",
    164: "Korean girin unicorn with dragon scales",
    165: "fire fox (bulyeowoo)",
    166: "Korean shadow monster (eoduksini)",
    167: "Korean giant wrestling demon (dueoksini)",
    168: "jangsanbeom white beast that mimics crying",
    169: "corrupted fallen imoogi serpent",
    170: "Korean jangseung totem pole guardian come alive",
    171: "white snake spirit (baeksa)",
    172: "fox possession spirit (maegu)",
    173: "plague spreading ghost spirit (salgwi)",
    174: "water drowning ghost (sugwi)",
    175: "Bari Gongju Korean princess shaman",
    176: "golden deer with glowing antlers",
    177: "seaweed-covered water goblin (jangja-mari)",
    178: "Yeomra Daewang Korean King of Underworld",
    179: "Cheonha-daejanggun Korean heavenly guardian general",
    180: "divine white deer with ethereal antlers",
    181: "colossal divine lake serpent",
    182: "kitsune Japanese nine-tailed fox spirit",
    183: "tanuki Japanese shapeshifting raccoon dog",
    184: "bakeneko Japanese ghost cat yokai",
    185: "nekomata Japanese twin-tailed cat demon",
    186: "kappa Japanese river imp with shell",
    187: "Yamata no Orochi eight-headed serpent",
    188: "tsuchigumo Japanese giant spider",
    189: "jorogumo Japanese spider woman yokai",
    190: "nure-onna Japanese woman-headed snake",
    191: "nue Japanese chimera monster",
    192: "aka-oni Japanese red demon with iron club",
    193: "ao-oni Japanese blue demon",
    194: "Shuten-doji Japanese oni king",
    195: "Ibaraki-doji one-armed oni warrior",
    196: "hannya Japanese jealousy demon woman",
    197: "amanojaku Japanese contrary imp",
    198: "yasha Buddhist guardian demon",
    199: "gaki Japanese hungry ghost",
    200: "tengu Japanese long-nosed mountain spirit",
    201: "karasu-tengu Japanese crow warrior",
    202: "kodama Japanese tree spirit",
    203: "zashiki-warashi Japanese child ghost",
    204: "yuki-onna Japanese snow woman",
    205: "yamauba Japanese mountain witch",
    206: "kawa-hime Japanese river princess spirit",
    207: "tsukumogami Japanese living umbrella yokai",
    208: "kamaitachi Japanese sickle weasel",
    209: "umibouzu Japanese giant sea ghost",
    210: "yurei Japanese ghost in white kimono",
    211: "Oiwa Japanese disfigured vengeful ghost",
    212: "Okiku Japanese well ghost",
    213: "funayurei Japanese ghost sailors",
    214: "gashadokuro Japanese giant skeleton",
    215: "shinigami Japanese death god",
    216: "Ryujin Japanese dragon king",
    217: "Seiryu Japanese Azure Dragon",
    218: "Suzaku Japanese Vermilion Bird",
    219: "Byakko Japanese White Tiger",
    220: "Genbu Japanese Black Tortoise with Snake",
    221: "Nurarihyon Japanese supreme yokai lord",
    222: "ittan-momen Japanese flying cloth yokai",
    223: "rokurokubi Japanese long-neck woman",
    224: "futakuchi-onna Japanese two-mouthed woman",
    225: "namahage Japanese straw-cape oni",
    226: "kasha Japanese fire cat demon",
    227: "hyakume Japanese hundred-eyed monster",
    228: "wanyudo Japanese burning wheel face",
    229: "hihi Japanese giant sage monkey",
    230: "itsumaden Japanese human-faced fire bird",
    231: "ubume Japanese childbirth ghost",
    232: "taotie Chinese gluttonous beast",
    233: "Hundun Chinese primordial chaos being",
    234: "Qiongqi Chinese winged evil tiger",
    235: "Taowu Chinese human-faced tiger with snake tail",
    236: "nian Chinese New Year beast",
    237: "qilin Chinese unicorn with dragon scales",
    238: "pixiu Chinese winged wealth lion",
    239: "bai ze Chinese all-knowing divine beast",
    240: "Qinglong Chinese Azure Dragon",
    241: "Xiangliu Chinese nine-headed snake",
    242: "Zhuyin Chinese Torch Dragon god",
    243: "Bai Suzhen Chinese white snake woman",
    244: "tengshe Chinese flying mist serpent",
    245: "huli jing Chinese fox spirit woman",
    246: "Daji Chinese nine-tailed fox demon",
    247: "huyao Chinese tiger spirit",
    248: "langyao Chinese storm wolf demon",
    249: "zhimujing Chinese spider woman demon",
    250: "sheyao Chinese plague snake demon",
    251: "pipa jing Chinese scorpion-tail lute player",
    252: "jiangshi Chinese hopping vampire in Qing robes",
    253: "Chinese vengeful female ghost in red dress",
    254: "egui Chinese hungry ghost",
    255: "Chinese resentful woman ghost in red",
    256: "shuigui Chinese water drowning ghost",
    257: "wutougui Chinese headless ghost",
    258: "diaosigui Chinese hanging ghost",
    259: "Baigujing Chinese White Bone Spirit shapeshifter",
    260: "Chinese wrongful death weeping ghost",
    261: "Chinese child ghost spirit",
    262: "bifang Chinese one-legged fire crane",
    263: "feiyou Chinese four-winged drought snake",
    264: "xixi Chinese flood-summoning winged fish",
    265: "dijiang Chinese faceless dancing chaos being",
    266: "Feilian Chinese wind god with deer head dragon body",
    267: "yingzhao Chinese human-faced winged horse",
    268: "fenghuang Chinese five-colored phoenix",
    269: "Zhuque Chinese Vermilion Bird of the South",
    270: "Xuanwu Chinese Black Tortoise of the North",
    271: "Baihu Chinese White Tiger of the West",
    272: "chanchu Chinese three-legged golden moon toad",
    273: "Guimu Chinese demon mother",
    274: "Ba Chinese drought witch",
    275: "yimei Chinese forest phantom spirit",
    276: "Niutou-mamian Chinese ox-head and horse-face hell guards",
    277: "Heibai Wuchang Chinese black and white reapers",
    278: "Mengpo Chinese old woman of forgetfulness",
    279: "guiche Chinese nine-headed blood bird",
    280: "penghou Chinese tree spirit with dog body",
    281: "mangliang Chinese child-sized swamp phantom",
}

# ============================================================
# DB 로드
# ============================================================
print("Connecting to database...")
conn = mysql.connector.connect(host='localhost', user='root', password='root', database='game')
cursor = conn.cursor(dictionary=True)
cursor.execute("SELECT id, name, description, tier, country FROM monsters ORDER BY id")
all_monsters = cursor.fetchall()
conn.close()
print(f"Loaded {len(all_monsters)} monsters")

# ============================================================
# 이미지 처리
# ============================================================
def make_icon(img):
    """512x512 → 상반신(상단 55%) 크롭 → 256x256"""
    w, h = img.size
    return img.crop((0, 0, w, int(h * 0.55))).resize((256, 256), Image.LANCZOS)

def process_monster(monster):
    mid = monster['id']
    name = monster['name']

    en_name = NAME_EN.get(mid)
    if not en_name:
        en_name = monster.get('description') or name

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

    # monsters/ — 배경 있는 원본
    img.save(os.path.join(OUT_DIR, f"{mid}_full.png"))
    make_icon(img.copy()).save(os.path.join(OUT_DIR, f"{mid}_icon.png"))
    print(f"  [BG] saved")

    # monsters_nobg/ — 배경 제거
    if HAS_REMBG:
        try:
            nobg = rembg_remove(img)
            nobg.save(os.path.join(OUT_NOBG, f"{mid}_full.png"))
            make_icon(nobg.copy()).save(os.path.join(OUT_NOBG, f"{mid}_icon.png"))
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
    total = len(all_monsters)
    success = 0
    fail = 0

    print(f"\n{'='*60}")
    print(f"ComfyUI + Flux.1-dev Monster Generation")
    print(f"Model: {UNET_MODEL}")
    print(f"Total: {total} monsters @ 512x512")
    print(f"Style: Tactics Ogre / Akihiko Yoshida")
    print(f"{'='*60}\n")

    for i, m in enumerate(all_monsters):
        print(f"[{i+1}/{total}] ID:{m['id']} {m['name']}")
        if process_monster(m):
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
