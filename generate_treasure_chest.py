"""
보물상자 이미지 생성 - ComfyUI API + Flux.1-dev
- 3D 뷰용 스프라이트 (투명 배경)
- 팝업용 열린 상자 (투명 배경)

사전 준비:
1. ComfyUI 실행: cd ComfyUI && python main.py
2. pip install websocket-client rembg pillow
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
    print("WARNING: rembg not found - 배경 제거 불가")
    print("pip install rembg 로 설치하세요")
    exit(1)

COMFYUI_URL = "127.0.0.1:8188"
OUT_DIR = "F:/project/game/client/public/ui/dungeon"
os.makedirs(OUT_DIR, exist_ok=True)

# === 모델 감지 ===
def detect_models():
    try:
        resp = urllib.request.urlopen(f"http://{COMFYUI_URL}/object_info")
        nodes = json.loads(resp.read())
    except Exception as e:
        print(f"ERROR: ComfyUI 연결 실패 - {e}")
        exit(1)
    def get_choices(node_name, input_name):
        if node_name not in nodes: return []
        req = nodes[node_name].get('input', {}).get('required', {})
        val = req.get(input_name, [[]])
        return val[0] if isinstance(val, list) and len(val) > 0 and isinstance(val[0], list) else []
    unet_list = get_choices('UNETLoader', 'unet_name')
    clip_list = get_choices('DualCLIPLoader', 'clip_name1')
    vae_list = get_choices('VAELoader', 'vae_name')
    unet = next((f for pref in ['flux1-dev-fp8','flux1-dev','flux'] for f in unet_list if pref in f.lower()), unet_list[0] if unet_list else None)
    clip_t5 = next((f for f in clip_list if 't5' in f.lower()), clip_list[0] if clip_list else None)
    clip_l = next((f for f in clip_list if 'clip_l' in f.lower()), clip_list[1] if len(clip_list) > 1 else None)
    vae = next((f for f in vae_list if 'ae' in f.lower() or 'flux' in f.lower()), vae_list[0] if vae_list else None)
    return unet, clip_t5, clip_l, vae

print("Detecting models...")
UNET_MODEL, CLIP_1, CLIP_2, VAE_MODEL = detect_models()
if not all([UNET_MODEL, CLIP_1, CLIP_2, VAE_MODEL]):
    print("ERROR: 모델 파일 없음")
    exit(1)
print(f"  UNET: {UNET_MODEL}\n  CLIP1: {CLIP_1}\n  CLIP2: {CLIP_2}\n  VAE: {VAE_MODEL}")

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
                    if ed.get('prompt_id') == prompt_id and ed.get('node') is None:
                        break
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
        "10": {"class_type": "SaveImage", "inputs": {"images": ["9", 0], "filename_prefix": "treasure"}},
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
                    img_bytes = get_image_data(img_info['filename'], img_info['subfolder'], img_info['type'])
                    return Image.open(io.BytesIO(img_bytes)).convert('RGB')
    return None

# === 생성할 이미지 목록 ===
IMAGES = [
    {
        "file": "dc_treasure_nobg.png",
        "prompt": (
            "a single closed ornate wooden treasure chest with golden metal trim and lock, "
            "rounded dome lid, detailed wood grain texture, golden corner brackets, "
            "small gemstone on front clasp, warm golden glow emanating from cracks, "
            "fantasy RPG game item icon, centered on plain white background, "
            "Akihiko Yoshida style, detailed item art, no character, object only, white background"
        ),
        "size": (512, 512),
        "resize": (256, 256),
        "desc": "3D 뷰용 닫힌 보물상자 (투명배경)",
    },
    {
        "file": "dc_treasure.png",
        "prompt": (
            "a single open ornate wooden treasure chest overflowing with gold coins and sparkling gems, "
            "rounded dome lid swung open, golden metal trim, jewels and coins spilling out, "
            "magical golden light rays shining upward from inside the chest, "
            "fantasy RPG game item icon, centered on plain white background, "
            "Akihiko Yoshida style, detailed item art, no character, object only, white background"
        ),
        "size": (512, 512),
        "resize": (256, 256),
        "desc": "팝업용 열린 보물상자 (투명배경)",
    },
    {
        "file": "dc_treasure_popup_bg.png",
        "prompt": (
            "a pile of glittering gold coins, sparkling jewels, rubies, emeralds, sapphires, "
            "and treasure scattered on dark ground, magical sparkles and golden light particles floating, "
            "top-down view, dark background with golden light, fantasy RPG treasure hoard, "
            "no chest, treasure pile only, detailed game art illustration"
        ),
        "size": (512, 512),
        "resize": (400, 400),
        "desc": "팝업 배경 보물 더미",
    },
]

# === 메인 ===
if __name__ == "__main__":
    try:
        urllib.request.urlopen(f"http://{COMFYUI_URL}/system_stats")
        print(f"ComfyUI OK at {COMFYUI_URL}")
    except Exception:
        print(f"ERROR: ComfyUI not running at {COMFYUI_URL}")
        exit(1)

    import sys
    force = '--force' in sys.argv

    print(f"\n{'='*50}")
    print(f"Treasure Chest Image Generation")
    print(f"{'='*50}\n")

    for item in IMAGES:
        out_path = os.path.join(OUT_DIR, item['file'])
        if os.path.exists(out_path) and not force:
            print(f"[SKIP] {item['file']} (already exists, use --force to overwrite)")
            continue

        print(f"[GEN] {item['desc']} → {item['file']}")
        img = generate_image(item['prompt'], *item['size'])
        if img is None:
            print(f"  ERROR: generation failed")
            continue

        # 배경 제거 (3D 스프라이트, 팝업 상자)
        if 'nobg' in item['file'] or item['file'] == 'dc_treasure.png':
            print(f"  Removing background...")
            img = rembg_remove(img)
            img = img.convert('RGBA')
        else:
            img = img.convert('RGBA')

        # 리사이즈
        img = img.resize(item['resize'], Image.LANCZOS)
        img.save(out_path)
        print(f"  Saved → {out_path} ({item['resize'][0]}x{item['resize'][1]})")

    print(f"\n{'='*50}")
    print("Done!")
    print(f"{'='*50}")
