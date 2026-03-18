"""
소환수 이미지 재생성 (특정 ID만) - ComfyUI API + Flux.1-dev
기존 generate_summon_fullbody.py 의 설정/파이프라인 그대로 사용

사용법: python generate_summon_redo.py
재생성 대상 ID를 REDO_IDS 에서 수정
"""
import sys
import os

# 재생성할 소환수 ID 목록
REDO_IDS = {10, 11, 13}

# 기존 이미지 삭제 후 재생성
OUT_DIR = "F:/project/game/client/public/summons"
OUT_NOBG = "F:/project/game/client/public/summons_nobg"

for sid in REDO_IDS:
    for d in [OUT_DIR, OUT_NOBG]:
        for suffix in ['_full.png', '_icon.png']:
            path = os.path.join(d, f"{sid}{suffix}")
            if os.path.exists(path):
                os.remove(path)
                print(f"Deleted: {path}")

# generate_summon_fullbody.py 의 모든 설정을 임포트하되
# all_summons 를 REDO_IDS 로 필터링
print(f"\nRedo targets: {sorted(REDO_IDS)}\n")

# --- 아래부터 generate_summon_fullbody.py 의 코어 로직 재사용 ---
import json
import urllib.request
import urllib.parse
import uuid
import websocket
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

COMFYUI_URL = "127.0.0.1:8188"
os.makedirs(OUT_DIR, exist_ok=True)
os.makedirs(OUT_NOBG, exist_ok=True)

def detect_models():
    try:
        resp = urllib.request.urlopen(f"http://{COMFYUI_URL}/object_info")
        nodes = json.loads(resp.read())
    except Exception as e:
        print(f"ERROR: ComfyUI 서버 연결 실패 - {e}"); sys.exit(1)
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
        fl = f.lower()
        if 't5' in fl: clip_t5 = f
        elif 'clip_l' in fl: clip_l = f
    if not clip_t5 and clip_list: clip_t5 = clip_list[0]
    if not clip_l and len(clip_list) > 1: clip_l = clip_list[1] if clip_list[1] != clip_t5 else clip_list[0]
    vae = None
    for f in vae_list:
        if 'ae' in f.lower() or 'flux' in f.lower(): vae = f; break
    if not vae and vae_list: vae = vae_list[0]
    return unet, clip_t5, clip_l, vae

print("Detecting models...")
UNET_MODEL, CLIP_1, CLIP_2, VAE_MODEL = detect_models()
print(f"  UNET: {UNET_MODEL}\n  CLIP1: {CLIP_1}\n  CLIP2: {CLIP_2}\n  VAE: {VAE_MODEL}")

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
            "model": ["1", 0], "positive": ["6", 0], "negative": ["4", 0], "latent_image": ["5", 0],
            "seed": int(time.time() * 1000) % (2**32), "steps": 20, "cfg": 1.0,
            "sampler_name": "euler", "scheduler": "simple", "denoise": 1.0}},
        "8": {"class_type": "VAELoader", "inputs": {"vae_name": VAE_MODEL}},
        "9": {"class_type": "VAEDecode", "inputs": {"samples": ["7", 0], "vae": ["8", 0]}},
        "10": {"class_type": "SaveImage", "inputs": {"images": ["9", 0], "filename_prefix": "summon_redo"}},
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

PROMPT_TEMPLATE = (
    "a single {name}, "
    "full body from head to toe, front facing, standing pose, "
    "pixel art SRPG character, Akihiko Yoshida style, tactics ogre style, "
    "japanese fantasy RPG illustration, "
    "single character, white background"
)

NAME_EN = {
    1: "wandering ghost spirit with ethereal glow",
    2: "graveyard ghost in tattered robes",
    3: "gumiho nine-tailed fox spirit soul",
    4: "small rat familiar creature",
    5: "wild wolf companion with sharp fangs",
    6: "stone golem fragment construct",
    7: "giant venomous spider queen",
    8: "water elemental spirit",
    9: "fire elemental spirit",
    10: "wind elemental spirit with swirling air currents and green ribbons",
    11: "skeleton warrior in ancient armor with sword and shield",
    12: "lich necromancer with skull staff and dark robes",
    13: "stray wild cat with sharp eyes and striped fur",
    14: "ghostly will-o-wisp floating fire ball",
    15: "earth clay golem doll small construct",
    16: "skeleton soldier in rusty armor with sword",
    17: "swift mountain rabbit with wind aura",
    18: "tiny firefly spirit glowing fairy bioluminescent",
    19: "venomous serpent coiled strike pose dripping venom",
    20: "ancient tree spirit with bark skin and leaves",
    21: "floating translucent ghost hovering above ground",
    22: "Korean goblin dokkaebi with horned face and magical club",
    23: "young nine-tailed fox cub glowing fox spirit cute",
    24: "jiangshi hopping vampire with paper talisman on forehead",
    25: "thunder elemental spirit made of lightning bolts",
    26: "yaksha fierce demon with muscular body and fire",
    27: "Azure Dragon Cheongryong East Asian blue dragon with clouds",
    28: "White Tiger Baekho sacred white tiger with wind energy",
    29: "Vermillion Bird Jujak phoenix-like firebird with crimson flames",
    30: "Black Tortoise Hyeonmu giant tortoise with snake earth water",
    31: "Korean Phoenix Bonghwang sacred firebird with rainbow tail feathers celestial",
    32: "Haetae divine lion-dog beast judge of good and evil stone mane",
    33: "Three-legged crow Samjokoh sun crow with golden solar fire",
    34: "Dragon King Yongwang supreme sea dragon with underwater palace crown",
    35: "Heavenly Horse Cheonma winged horse celestial steed running on clouds",
}

def make_icon(img):
    w, h = img.size
    return img.crop((0, 0, w, int(h * 0.55))).resize((256, 256), Image.LANCZOS)

def process_summon(sid, name):
    en_name = NAME_EN.get(sid, name)
    prompt = PROMPT_TEMPLATE.format(name=en_name)
    try:
        img = generate_image(prompt, width=512, height=512)
        if img is None:
            print(f"  ERROR: no image returned"); return False
    except Exception as e:
        print(f"  ERROR: {e}"); return False
    img.save(os.path.join(OUT_DIR, f"{sid}_full.png"))
    make_icon(img.copy()).save(os.path.join(OUT_DIR, f"{sid}_icon.png"))
    print(f"  [BG] saved")
    if HAS_REMBG:
        try:
            nobg = rembg_remove(img)
            nobg.save(os.path.join(OUT_NOBG, f"{sid}_full.png"))
            make_icon(nobg.copy()).save(os.path.join(OUT_NOBG, f"{sid}_icon.png"))
            print(f"  [NOBG] saved")
        except Exception as e:
            print(f"  WARN rembg: {e}")
    return True

if __name__ == "__main__":
    try:
        urllib.request.urlopen(f"http://{COMFYUI_URL}/system_stats")
        print(f"ComfyUI server OK at {COMFYUI_URL}")
    except Exception:
        print(f"ERROR: ComfyUI server not running at {COMFYUI_URL}")
        sys.exit(1)

    conn = mysql.connector.connect(host='localhost', user='root', password='root', database='game')
    cursor = conn.cursor(dictionary=True)
    cursor.execute("SELECT id, name, type FROM summon_templates WHERE id IN (%s)" % ','.join(str(i) for i in REDO_IDS))
    targets = cursor.fetchall()
    conn.close()

    print(f"\n{'='*50}")
    print(f"  Redo {len(targets)} summons: {[t['name'] for t in targets]}")
    print(f"{'='*50}\n")

    start = time.time()
    for i, t in enumerate(targets):
        print(f"[{i+1}/{len(targets)}] ID:{t['id']} {t['name']} ({t['type']})")
        process_summon(t['id'], t['name'])

    elapsed = time.time() - start
    print(f"\nDone! {len(targets)} summons regenerated ({elapsed:.0f}s)")
