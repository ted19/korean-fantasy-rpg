"""
던전 이미지 생성 - ComfyUI API + Flux.1-dev
- stages 이미지와 동일한 파이프라인
- dungeons/: {key}_icon.png (256x256), _card.png (512x256), _banner.png (512x128), _bg.png (512x512)
- 26개 던전 × 4종 = 104장

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

COMFYUI_URL = "127.0.0.1:8188"
OUT_DIR = "F:/project/game/client/public/dungeons"
os.makedirs(OUT_DIR, exist_ok=True)

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
        "10": {"class_type": "SaveImage", "inputs": {"images": ["9", 0], "filename_prefix": "dungeon"}}
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
# 던전 데이터 (key, 한글명, 영문 landscape 프롬프트)
# ============================================================
PROMPT_LANDSCAPE = (
    "{desc}, "
    "fantasy game dungeon landscape, Akihiko Yoshida style, tactics ogre style, "
    "japanese fantasy RPG dungeon illustration, "
    "atmospheric, dark, dangerous environment, no characters"
)

DUNGEONS = [
    # === 공통 던전 ===
    ("forest", "어둠의 숲", "cursed dark forest with twisted ancient trees, ominous fog, glowing mushrooms, eerie green light filtering through canopy"),
    ("cave", "지하 동굴", "deep underground cave with massive stalactites and stalagmites, glowing crystals, underground river, torch-lit paths"),
    ("temple", "폐허 사원", "ruined ancient evil temple with broken pillars, purple magic aura, crumbling stone altars, cursed statues"),
    ("swamp", "독안개 늪", "poisonous misty swamp with purple fog, dead trees, glowing toxic pools, rotting vegetation"),
    ("mountain", "영혼의 산", "haunted spirit mountain with ghostly fog, wind-carved rocks, wailing wind, spectral lights on peak"),
    ("demon", "마계 균열", "dimensional rift to demon realm, blood-red sky, twisted reality, floating rocks, hellfire portals"),
    ("dragon", "용의 둥지", "ancient dragon's volcanic lair, lava rivers, massive dragon bones, molten gold, fire and smoke"),
    ("ocean", "해저 유적", "sunken underwater ruins with coral-covered pillars, bioluminescent fish, ancient architecture beneath waves"),
    ("goblin", "도깨비 마을", "mischievous dokkaebi goblin village, chaotic huts with stolen treasures, magic club totems, firefly lights"),
    ("spirit_forest", "정령의 숲", "elemental spirit forest with fire water earth wind energy streams, glowing spirit orbs, magical convergence"),
    ("slime_cave", "슬라임 동굴", "crystal cave filled with colorful slimes, luminous crystal walls, gelatinous pools, rainbow reflections"),
    # === 한국 던전 ===
    ("kr_forest", "고조선 숲", "Korean mythical forest with jangseung totem poles, dokkaebi lanterns, gumiho fox trails, ink-wash painting style dark woods"),
    ("kr_mountain", "백두산", "Korean sacred mountain Baekdu, Sacheonwang guardian statues, stone warriors, stormy peak with mountain god shrine"),
    ("kr_temple", "고찰 폐허", "fallen Korean Buddhist temple ruins, cursed broken bronze bell, wonhon vengeful spirits, golden Buddha covered in vines"),
    ("kr_swamp", "장자못", "cursed Korean swamp Jangjamot, water ghosts rising from murky water, imoogi serpent lurking, poisonous insects"),
    ("kr_spirit", "신령의 숲", "Korean spirit realm boundary, path to afterlife hwangcheon, Yeomra underworld king's gate, soul lanterns floating"),
    # === 일본 던전 ===
    ("jp_forest", "아오키가하라", "Japanese Aokigahara dark forest, yokai lurking, kodama tree spirits, kitsune fox lights, moss-covered trees"),
    ("jp_mountain", "오에산", "Japanese Mount Ooe, tengu crow warriors on clouds, yamabushi training grounds, thunder and lightning on peak"),
    ("jp_temple", "폐신사", "abandoned Japanese shrine with oni demon masks, cursed Kannon statue awakening, broken torii gates, fox fire"),
    ("jp_ocean", "용궁", "Japanese dragon palace Ryugu underwater, kappa river imps, ningyo mermaids, funayurei ghost sailors, coral throne"),
    ("jp_spirit", "요괴의 길", "Japanese afterlife path, Sanzu River crossing, Enma judgment hall, shinigami death gods, spirit lanterns"),
    # === 중국 던전 ===
    ("cn_forest", "산해경 숲", "Chinese Shanhaijing mythical beast forest, ancient stone guardian lions, primordial monsters, Taoist shrine in woods"),
    ("cn_mountain", "곤륜산", "Chinese Kunlun sacred mountain, Taoist immortal cultivation temple, cloud-piercing peaks, celestial energy"),
    ("cn_temple", "봉신대", "Chinese great temple with raging Four Heavenly Kings, 500 Arhat statues with glowing eyes, demon-sealing pagoda"),
    ("cn_swamp", "황천", "Chinese cursed swamp with jiangshi hopping vampires, gu poison insects, talisman barriers, dark ritual circle"),
    ("cn_spirit", "요계", "Chinese underworld Difu, ten Yama Kings judgment halls, ox-head horse-face guards, Meng Po bridge of forgetfulness"),
]

# ============================================================
# 이미지 처리 - 1장 생성 → 4종 변환
# ============================================================
def process_dungeon(key, name, desc):
    prompt = PROMPT_LANDSCAPE.format(desc=desc)

    try:
        img = generate_image(prompt, width=512, height=512)
        if img is None:
            print(f"  ERROR: no image returned")
            return False
    except Exception as e:
        print(f"  ERROR: {e}")
        return False

    w, h = img.size

    # _bg.png: 512x512 원본
    img.save(os.path.join(OUT_DIR, f"{key}_bg.png"))

    # _card.png: 512x256 (상단 절반 크롭)
    card = img.crop((0, 0, w, h // 2))
    card.save(os.path.join(OUT_DIR, f"{key}_card.png"))

    # _banner.png: 512x128 (중앙 가로 스트립)
    center_y = h // 2
    banner = img.crop((0, center_y - 64, w, center_y + 64))
    banner.save(os.path.join(OUT_DIR, f"{key}_banner.png"))

    # _icon.png: 256x256 (중앙 크롭 후 리사이즈)
    crop_size = min(w, h)
    left = (w - crop_size) // 2
    top = (h - crop_size) // 2
    icon = img.crop((left, top, left + crop_size, top + crop_size)).resize((256, 256), Image.LANCZOS)
    icon.save(os.path.join(OUT_DIR, f"{key}_icon.png"))

    print(f"  saved: _bg, _card, _banner, _icon")
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
    total = len(DUNGEONS)
    success = 0
    fail = 0

    print(f"\n{'='*60}")
    print(f"ComfyUI + Flux.1-dev Dungeon Image Generation")
    print(f"Model: {UNET_MODEL}")
    print(f"Total: {total} dungeons × 4 images = {total * 4} files")
    print(f"Style: Tactics Ogre / Akihiko Yoshida")
    print(f"{'='*60}\n")

    for i, (key, name, desc) in enumerate(DUNGEONS):
        print(f"[{i+1}/{total}] {key} ({name})")
        if process_dungeon(key, name, desc):
            success += 1
        else:
            fail += 1

    elapsed = time.time() - start
    print(f"\n{'='*60}")
    print(f"Done! {success}/{total} ok, {fail} failed")
    print(f"Images: {success * 4} total")
    print(f"Time: {elapsed/60:.1f} min")
    print(f"{'='*60}")
