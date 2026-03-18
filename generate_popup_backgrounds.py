"""
가챠/강화 팝업 배경 이미지 생성 - ComfyUI API + Flux.1-dev
총 16장 (소환 8 + 강화 8)
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
OUT_DIR = "F:/project/game/client/public/ui/gacha"
os.makedirs(OUT_DIR, exist_ok=True)

# ============================================================
# 모델 감지
# ============================================================
def detect_models():
    try:
        resp = urllib.request.urlopen(f"http://{COMFYUI_URL}/object_info")
        nodes = json.loads(resp.read())
    except Exception as e:
        print(f"ERROR: ComfyUI 서버 연결 실패 - {e}"); exit(1)
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

# ============================================================
# ComfyUI API
# ============================================================
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

def generate_image(prompt_text, width=768, height=512):
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
        "10": {"class_type": "SaveImage", "inputs": {"images": ["9", 0], "filename_prefix": "popup_bg"}},
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
# 이미지 목록 (16장)
# ============================================================
IMAGES = {
    # ── 소환 팝업 (8장) ──
    # 용병 일반
    'merc_confirm_bg': 'epic fantasy battlefield at golden sunset, war banners waving in wind, campfire with bright sparks flying upward, medieval Korean warriors silhouettes on hilltop, dramatic orange clouds, cinematic composition, dark fantasy RPG game art, highly detailed painting, volumetric golden light, no text',
    'merc_pulling_bg': 'blazing inferno vortex of fire and golden energy, magical summoning ritual with floating ancient sword in center, intense swirling flames, dark fantasy spell casting, dramatic warm lighting, particle effects everywhere, epic dark void background, no text',
    # 용병 고급
    'merc_premium_confirm_bg': 'legendary golden throne room with divine light beams from above, epic dragon statues flanking golden altar, floating mythical weapons orbiting, celestial golden aura filling ancient Korean palace hall, godlike sacred atmosphere, ultra detailed dark fantasy masterpiece, no text',
    'merc_premium_pulling_bg': 'massive golden divine energy explosion, celestial summoning with thunderbolts striking down, legendary hero silhouette appearing from golden cosmic vortex, cosmic fire and lightning spiraling, godlike power awakening moment, ultra epic dark fantasy, no text',
    # 소환수 일반
    'summon_confirm_bg': 'mystical glowing magic circle on ancient stone temple floor, purple and blue ethereal energy rising, floating arcane runes orbiting, moonlit enchanted shrine with crystal pillars, magical portal beginning to form, dark fantasy sorcery atmosphere, highly detailed, no text',
    'summon_pulling_bg': 'dimensional rift tearing open with purple lightning bolts, massive magic portal vortex swirling with cosmic energy, ethereal blue and violet light beams shooting upward from ground, dark fantasy dimensional summoning at peak intensity, magical particles everywhere, no text',
    # 소환수 고급
    'summon_premium_confirm_bg': 'ancient cosmic temple floating in vast starfield, massive layered purple nebula portal with sacred geometry, divine summoning altar with brilliant glowing crystals arranged in circle, celestial magic circles layered and rotating, mythical dark fantasy cosmic sorcery, no text',
    'summon_premium_pulling_bg': 'cosmic dimensional explosion between worlds, massive purple and gold portal ripping reality open, divine mythical beasts energy emerging from starlight fracture, celestial energy shockwaves expanding, mythical summoning reaching ultimate climax, ultra epic dark fantasy, no text',

    # ── 강화 팝업 (8장) ──
    # 용병 강화
    'enhance_merc_confirm_bg': 'ancient sacred war forge with glowing hot anvil, golden sparks flying from hammer strike, crossed legendary swords mounted on ornate stone wall, burning torches with dramatic flames, war banners hanging, dark medieval master blacksmith sanctum, cinematic warm lighting, no text',
    'enhance_merc_process_bg': 'blazing golden fire vortex spiraling around floating legendary sword being reforged, intense forge heat with molten golden metal sparks, ancient war runes igniting with brilliant light one by one, dark void background with warm fire glow, cinematic, no text',
    'enhance_merc_success_bg': 'triumphant legendary golden sword radiating brilliant divine starlight, massive golden energy explosion outward, victory sparks and golden particles raining from above, heroic glorious achievement moment, dark background illuminated by warm golden radiance, cinematic, no text',
    'enhance_merc_fail_bg': 'broken cracked sword lying on dark cold anvil, dying orange embers slowly fading, scattered metal fragments on stone floor, dim forge with last wisps of smoke, somber melancholic atmosphere, dark moody cinematic, no text',
    # 소환수 강화
    'enhance_summon_confirm_bg': 'mystical crystal enchantment altar with floating purple gemstones orbiting, ethereal blue magic enhancement circles glowing on ground, moonlit sacred shrine with crystal columns, swirling arcane upgrade energy, dark fantasy magical atmosphere, cinematic, no text',
    'enhance_summon_process_bg': 'intense purple magical energy spiraling and converging around brilliant glowing crystal being empowered, arcane rune symbols orbiting faster and faster, blue lightning bolts converging to center point, dark mystical cosmic void, cinematic, no text',
    'enhance_summon_success_bg': 'brilliant purple crystal explosion releasing divine starlight, magical enhancement achievement with blue and violet sparkles cascading outward, ethereal celebration energy rings expanding, dark background with magnificent purple and blue radiance, cinematic, no text',
    'enhance_summon_fail_bg': 'shattered purple crystal fragments slowly dissolving into fading blue mist, cracked ancient rune stone dimming and going dark, magical residue dissipating into void, somber dark mystical atmosphere with subtle sadness, cinematic, no text',
}

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
    total = len(IMAGES)
    success = 0

    print(f"\n{'='*60}")
    print(f"  Popup Background Generator (ComfyUI + Flux.1-dev)")
    print(f"  Total: {total} images @ 768x512")
    print(f"{'='*60}\n")

    for i, (name, prompt) in enumerate(IMAGES.items()):
        path = os.path.join(OUT_DIR, f"{name}.png")
        print(f"[{i+1}/{total}] {name}")

        try:
            img = generate_image(prompt, width=768, height=512)
            if img is None:
                print(f"  ERROR: no image returned")
                continue
            img.save(path)
            fsize = os.path.getsize(path) / 1024
            print(f"  OK: {path} ({fsize:.0f}KB)")
            success += 1
        except Exception as e:
            print(f"  ERROR: {e}")

    elapsed = time.time() - start
    print(f"\n{'='*60}")
    print(f"  Done! {success}/{total} generated ({elapsed/60:.1f} min)")
    print(f"{'='*60}")
