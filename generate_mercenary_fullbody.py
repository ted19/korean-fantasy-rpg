"""
용병 이미지 생성 - ComfyUI API + Flux.1-dev
- 기존 용병 8종 + 신규 용병 27종 = 전체 35종
- mercenaries/: 배경 있는 원본
- mercenaries_nobg/: 배경 제거 버전

사전 준비:
1. ComfyUI 실행: cd ComfyUI && python main.py
2. 모델 파일 배치 (generate_summon_fullbody.py와 동일)
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
OUT_DIR = "F:/project/game/client/public/mercenaries"
OUT_NOBG = "F:/project/game/client/public/mercenaries_nobg"
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
                unet = f; break
        if unet: break
    if not unet and unet_list: unet = unet_list[0]

    clip_t5, clip_l = None, None
    for f in clip_list:
        fl = f.lower()
        if 't5' in fl: clip_t5 = f
        elif 'clip_l' in fl: clip_l = f
    if not clip_t5 and clip_list: clip_t5 = clip_list[0]
    if not clip_l and len(clip_list) > 1: clip_l = clip_list[1] if clip_list[1] != clip_t5 else clip_list[0]

    vae = None
    for f in vae_list:
        if 'ae' in f.lower() or 'flux' in f.lower(): vae = f; break
    if not vae and vae_list: vae = vae_list[0]

    return unet, clip_t5, clip_l, vae, unet_list, clip_list, vae_list

print("Detecting models...")
UNET_MODEL, CLIP_1, CLIP_2, VAE_MODEL, _ul, _cl, _vl = detect_models()

missing = []
if not UNET_MODEL: missing.append(f"UNET ({_ul})")
if not CLIP_1: missing.append(f"CLIP T5 ({_cl})")
if not CLIP_2: missing.append(f"CLIP L ({_cl})")
if not VAE_MODEL: missing.append(f"VAE ({_vl})")
if missing:
    print("ERROR: 모델 파일 없음!"); [print(f"  - {m}") for m in missing]; exit(1)
print(f"  UNET: {UNET_MODEL}\n  CLIP1: {CLIP_1}\n  CLIP2: {CLIP_2}\n  VAE: {VAE_MODEL}")

# ============================================================
# ComfyUI API
# ============================================================
def queue_prompt(prompt):
    client_id = str(uuid.uuid4())
    data = json.dumps({"prompt": prompt, "client_id": client_id}).encode('utf-8')
    req = urllib.request.Request(f"http://{COMFYUI_URL}/prompt", data=data, headers={'Content-Type': 'application/json'})
    try:
        result = json.loads(urllib.request.urlopen(req).read())
        return result['prompt_id'], client_id
    except urllib.error.HTTPError as e:
        print(f"  API ERROR {e.code}: {e.read().decode()[:500]}"); raise

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
            "model": ["1", 0], "positive": ["6", 0], "negative": ["4", 0], "latent_image": ["5", 0],
            "seed": int(time.time() * 1000) % (2**32), "steps": 20, "cfg": 1.0,
            "sampler_name": "euler", "scheduler": "simple", "denoise": 1.0
        }},
        "8": {"class_type": "VAELoader", "inputs": {"vae_name": VAE_MODEL}},
        "9": {"class_type": "VAEDecode", "inputs": {"samples": ["7", 0], "vae": ["8", 0]}},
        "10": {"class_type": "SaveImage", "inputs": {"images": ["9", 0], "filename_prefix": "merc"}},
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

# ============================================================
# 프롬프트
# ============================================================
PROMPT_TEMPLATE = (
    "a single {desc}, "
    "full body from head to toe, front facing, standing pose, "
    "pixel art SRPG character, Akihiko Yoshida style, tactics ogre style, "
    "japanese fantasy RPG illustration, Korean historical fantasy, "
    "single character, white background"
)

# 용병별 영문 설명
NAME_EN = {
    # 일반
    '민병 김돌': "Korean village militia swordsman with simple clothes and iron sword",
    '보초병 만복': "Korean gate guard spearman with bamboo hat and long spear",
    '사냥꾼 산이': "Korean mountain hunter archer with fur vest and wooden bow",
    '점술사 복길': "Korean fortune teller taoist with worn talisman papers",
    '장정 쇠돌': "brawny Korean villager warrior with large club",
    '약초꾼 춘향': "Korean herb gatherer healer woman with basket and green robes",
    '소매치기 막동': "Korean street urchin thief boy with daggers",
    '서당훈장 학수': "Korean village scholar mage with scroll and brush",
    # 고급
    '검사 이준': "skilled Korean swordsman in blue armor with katana",
    '창병 박무': "Korean spearman guard in heavy armor with long halberd",
    '궁수 한소이': "Korean female archer in leather armor with elegant bow",
    '호위무사 태산': "massive Korean bodyguard warrior in iron plates with great axe",
    '무녀 소연': "Korean shrine maiden in white and red robes with prayer bells",
    '야도적 칠성': "Korean night bandit rogue in black with twin daggers",
    '풍수견습 도현': "young Korean feng shui apprentice with compass and talismans",
    # 희귀
    '도사 최현': "Korean Taoist priest with fire talismans and mystical robes",
    '무사 강철': "imposing Korean warrior in ornate armor with massive sword",
    '치유사 윤하나': "gentle Korean healer priestess with glowing healing staff",
    '퇴마사 혜진': "fierce Korean female exorcist with burning talismans and sword",
    '표창술사 은월': "mysterious Korean female ninja with silver throwing stars",
    '화랑 선우': "noble Korean Hwarang knight in golden armor with flame sword",
    # 영웅
    '자객 서영': "elite Korean shadow assassin woman in dark attire",
    '마법사 정은비': "powerful Korean sorceress with ornate staff and arcane energy",
    '관군대장 태현': "Korean military general in golden armor with commander halberd",
    '천기술사 소율': "celestial Korean astrologer mage with star map and crystal staff",
    '선인 학담': "immortal Korean mountain sage with white beard and divine aura",
    # 전설
    '검성 백무현': "legendary Korean sword saint in white robes with divine blade",
    '신궁 홍의': "legendary Korean divine archer in crimson with golden bow",
    '천하장군 대호': "supreme Korean general in dragon armor with celestial halberd",
    '선녀 채운': "heavenly Korean fairy maiden with rainbow ribbons and healing light",
    # 신화
    '환웅의 후예': "demigod Korean warrior descendant of Hwanung with lightning armor",
    '천년화호 월선': "thousand-year-old nine-tailed fox woman in crimson magical robes",
    '사명대사': "legendary Korean Buddhist monk with divine golden staff and ethereal aura",
    # 초월
    '치우천왕': "supreme god of war Chiyou with horned crown and cosmic fire armor",
    '마고선녀': "primordial goddess Mago in celestial robes with creation energy swirling",
}

# ============================================================
# DB 로드
# ============================================================
print("Connecting to database...")
conn = mysql.connector.connect(host='localhost', user='root', password='root', database='game')
cursor = conn.cursor(dictionary=True)
cursor.execute("SELECT id, name, class_type, grade FROM mercenary_templates ORDER BY id")
all_mercs = cursor.fetchall()
conn.close()
print(f"Loaded {len(all_mercs)} mercenaries")

# ============================================================
# 이미지 처리
# ============================================================
def make_icon(img):
    w, h = img.size
    return img.crop((0, 0, w, int(h * 0.55))).resize((256, 256), Image.LANCZOS)

def process_merc(merc):
    mid = merc['id']
    name = merc['name']
    en_desc = NAME_EN.get(name, f"Korean fantasy {merc['class_type']} warrior named {name}")
    prompt = PROMPT_TEMPLATE.format(desc=en_desc)

    try:
        img = generate_image(prompt, width=512, height=512)
        if img is None:
            print(f"  ERROR: no image returned"); return False
    except Exception as e:
        print(f"  ERROR: {e}"); return False

    img.save(os.path.join(OUT_DIR, f"{mid}_full.png"))
    make_icon(img.copy()).save(os.path.join(OUT_DIR, f"{mid}_icon.png"))
    print(f"  [BG] saved")

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
    try:
        urllib.request.urlopen(f"http://{COMFYUI_URL}/system_stats")
        print(f"ComfyUI server OK at {COMFYUI_URL}")
    except Exception:
        print(f"ERROR: ComfyUI server not running at {COMFYUI_URL}")
        print("먼저 ComfyUI를 실행하세요: cd ComfyUI && python main.py")
        exit(1)

    start = time.time()
    total = len(all_mercs)
    success = 0
    fail = 0

    print(f"\n{'='*60}")
    print(f"ComfyUI + Flux.1-dev Mercenary Generation")
    print(f"Model: {UNET_MODEL}")
    print(f"Total: {total} mercenaries @ 512x512 (ALL - including existing)")
    print(f"Style: Tactics Ogre / Akihiko Yoshida")
    print(f"{'='*60}\n")

    for i, m in enumerate(all_mercs):
        grade = m.get('grade', '일반')
        print(f"[{i+1}/{total}] ID:{m['id']} [{grade}] {m['name']} ({m['class_type']})")
        if process_merc(m):
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
