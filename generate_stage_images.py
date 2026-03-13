"""
스테이지 이미지 생성 - ComfyUI API + Flux.1-dev
- monsters 이미지와 동일한 파이프라인
- stages/: {zone_key}_icon.png (256x256), _card.png (512x256), _banner.png (512x128), _bg.png (512x512)

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
    print("rembg not found")

COMFYUI_URL = "127.0.0.1:8188"
OUT_DIR = "F:/project/game/client/public/stages"
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
        "10": {"class_type": "SaveImage", "inputs": {"images": ["9", 0], "filename_prefix": "stage"}}
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
# 스테이지 Zone 데이터 (key, 한글명, 영문 landscape 프롬프트)
# ============================================================
ZONES = [
    # === 한국 ===
    ("gojoseon", "고조선", "ancient Korean tribal village with dolmens and bronze age structures, misty forest, prehistoric Korea landscape"),
    ("samhan", "삼한시대", "ancient Korean confederacy villages with thatched roofs, rice paddies, iron age settlement"),
    ("goguryeo", "고구려", "Goguryeo fortress on mountain, ancient Korean kingdom, stone castle walls, warrior banners, dramatic cliffs"),
    ("baekje", "백제", "Baekje kingdom palace with elegant pagoda, peaceful riverside, ancient Korean architecture, golden era"),
    ("silla", "신라", "Silla dynasty golden crown temple, Gyeongju style stone pagoda, cherry blossom, moonlit Korean palace"),
    ("balhae", "발해", "Balhae kingdom northern fortress, snowy mountain palace, Manchurian landscape, ancient Korean-Manchurian architecture"),
    ("goryeo", "고려", "Goryeo dynasty Buddhist temple, celadon pottery hall, misty mountain monastery, Korean medieval palace"),
    ("joseon", "조선", "Joseon dynasty palace Gyeongbokgung style, Korean traditional hanok village, scholars garden"),
    ("imjin", "임진왜란", "Imjin war battlefield, burning Korean castle, turtle ship on sea, cannon fire, Japanese invasion"),
    ("modern", "근현대", "modern Korean city mixing traditional hanok and modern buildings, neon lights, temple gate"),
    # === 일본 ===
    ("jomon", "조몬시대", "ancient Jomon period pit dwelling village, cord-patterned pottery, Japanese prehistoric forest"),
    ("yayoi", "야요이시대", "Yayoi period rice paddy village, early Japanese bronze bells, wooden watchtower"),
    ("yamato", "야마토시대", "Yamato period ancient Japanese burial mound kofun, shinto shrine, imperial court"),
    ("nara", "나라시대", "Nara period great Buddha temple Todaiji style, deer park, Japanese Buddhist architecture"),
    ("heian", "헤이안시대", "Heian period Japanese imperial palace, cherry blossom garden, elegant aristocratic pavilion"),
    ("kamakura", "가마쿠라", "Kamakura period samurai fortress, great Buddha statue, coastal Japanese castle"),
    ("muromachi", "무로마치", "Muromachi period golden pavilion Kinkakuji style, zen rock garden, Japanese ink painting landscape"),
    ("sengoku", "전국시대", "Sengoku period Japanese castle siege, samurai battle, burning fortress, war banners"),
    ("edo", "에도시대", "Edo period Japanese castle town, merchant district, Mount Fuji background, peaceful street"),
    ("meiji", "메이지시대", "Meiji era Japan mixing western and Japanese architecture, steam trains, modernizing city"),
    # === 중국 ===
    ("xia_shang", "하상시대", "ancient Xia-Shang dynasty bronze ritual vessels hall, oracle bone temple, Yellow River civilization"),
    ("zhou", "주나라", "Zhou dynasty Chinese walled city, bronze chariots, Confucian academy, ancient Chinese architecture"),
    ("qin", "진나라", "Qin dynasty Great Wall construction, terracotta warriors army, massive Chinese fortress"),
    ("han", "한나라", "Han dynasty Chinese imperial palace, Silk Road caravan, scholarly court, grand architecture"),
    ("three_kingdoms", "삼국시대", "Three Kingdoms era Chinese battlefield, Red Cliffs battle, warring factions banners"),
    ("tang", "당나라", "Tang dynasty golden age Chinese palace, dragon throne room, cosmopolitan Chang'an city"),
    ("song", "송나라", "Song dynasty Chinese riverside market, elegant pagoda, scholar painting landscape, peaceful"),
    ("yuan", "원나라", "Yuan dynasty Mongol-Chinese palace, yurt and Chinese architecture mix, steppe warriors"),
    ("ming", "명나라", "Ming dynasty Forbidden City style palace, grand red walls, dragon decorations, imperial guards"),
    ("qing", "청나라", "Qing dynasty Chinese imperial palace, Manchurian court, opulent throne room, last dynasty"),
]

# ============================================================
# 이미지 처리 - 1장 생성 → 4종 변환
# ============================================================
PROMPT_LANDSCAPE = (
    "{desc}, "
    "fantasy game landscape, Akihiko Yoshida style, tactics ogre style, "
    "japanese fantasy RPG background illustration, "
    "atmospheric, detailed environment, no characters"
)

def process_zone(key, name, desc):
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
    total = len(ZONES)
    success = 0
    fail = 0

    print(f"\n{'='*60}")
    print(f"ComfyUI + Flux.1-dev Stage Image Generation")
    print(f"Model: {UNET_MODEL}")
    print(f"Total: {total} zones × 4 images = {total * 4} files")
    print(f"Style: Tactics Ogre / Akihiko Yoshida")
    print(f"{'='*60}\n")

    for i, (key, name, desc) in enumerate(ZONES):
        print(f"[{i+1}/{total}] {key} ({name})")
        if process_zone(key, name, desc):
            success += 1
        else:
            fail += 1

    elapsed = time.time() - start
    print(f"\n{'='*60}")
    print(f"Done! {success}/{total} ok, {fail} failed")
    print(f"Images: {success * 4} total")
    print(f"Time: {elapsed/60:.1f} min")
    print(f"{'='*60}")
