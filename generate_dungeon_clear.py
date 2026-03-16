"""
던전 클리어 축하 팝업 이미지 생성 - ComfyUI API + Flux.1-dev
- dc_clear_bg.png: 축하 배경 (빛줄기 + 보물)
- dc_clear_emblem.png: 승리 엠블럼 (투명배경)
- dc_clear_banner.png: 배너 장식 (투명배경)

사전 준비: ComfyUI 실행 + pip install websocket-client rembg pillow
"""
import json, urllib.request, urllib.parse, uuid, websocket, os, io, time
from PIL import Image

try:
    from rembg import remove as rembg_remove
    HAS_REMBG = True
except ImportError:
    HAS_REMBG = False
    print("WARNING: rembg not found")

COMFYUI_URL = "127.0.0.1:8188"
OUT_DIR = "F:/project/game/client/public/ui/dungeon"
os.makedirs(OUT_DIR, exist_ok=True)

def detect_models():
    try:
        resp = urllib.request.urlopen(f"http://{COMFYUI_URL}/object_info")
        nodes = json.loads(resp.read())
    except Exception as e:
        print(f"ERROR: ComfyUI 연결 실패 - {e}"); exit(1)
    def gc(n, i):
        if n not in nodes: return []
        v = nodes[n].get('input',{}).get('required',{}).get(i,[[]])
        return v[0] if isinstance(v,list) and len(v)>0 and isinstance(v[0],list) else []
    ul, cl, vl = gc('UNETLoader','unet_name'), gc('DualCLIPLoader','clip_name1'), gc('VAELoader','vae_name')
    u = next((f for p in ['flux1-dev-fp8','flux1-dev','flux'] for f in ul if p in f.lower()), ul[0] if ul else None)
    t5 = next((f for f in cl if 't5' in f.lower()), cl[0] if cl else None)
    cl2 = next((f for f in cl if 'clip_l' in f.lower()), cl[1] if len(cl)>1 else None)
    v = next((f for f in vl if 'ae' in f.lower() or 'flux' in f.lower()), vl[0] if vl else None)
    return u, t5, cl2, v

UNET, C1, C2, VAE = detect_models()
if not all([UNET,C1,C2,VAE]): print("ERROR: 모델 없음"); exit(1)
print(f"Models: {UNET}")

def gen(prompt, w=512, h=512):
    wd = "default" if "fp8" in UNET.lower() else "fp8_e4m3fn"
    wf = {
        "1":{"class_type":"UNETLoader","inputs":{"unet_name":UNET,"weight_dtype":wd}},
        "2":{"class_type":"DualCLIPLoader","inputs":{"clip_name1":C1,"clip_name2":C2,"type":"flux"}},
        "3":{"class_type":"CLIPTextEncode","inputs":{"text":prompt,"clip":["2",0]}},
        "4":{"class_type":"CLIPTextEncode","inputs":{"text":"","clip":["2",0]}},
        "5":{"class_type":"EmptySD3LatentImage","inputs":{"width":w,"height":h,"batch_size":1}},
        "6":{"class_type":"FluxGuidance","inputs":{"guidance":3.5,"conditioning":["3",0]}},
        "7":{"class_type":"KSampler","inputs":{"model":["1",0],"positive":["6",0],"negative":["4",0],"latent_image":["5",0],
            "seed":int(time.time()*1000)%(2**32),"steps":20,"cfg":1.0,"sampler_name":"euler","scheduler":"simple","denoise":1.0}},
        "8":{"class_type":"VAELoader","inputs":{"vae_name":VAE}},
        "9":{"class_type":"VAEDecode","inputs":{"samples":["7",0],"vae":["8",0]}},
        "10":{"class_type":"SaveImage","inputs":{"images":["9",0],"filename_prefix":"dclear"}},
    }
    cid = str(uuid.uuid4())
    data = json.dumps({"prompt":wf,"client_id":cid}).encode()
    req = urllib.request.Request(f"http://{COMFYUI_URL}/prompt", data=data, headers={'Content-Type':'application/json'})
    pid = json.loads(urllib.request.urlopen(req).read())['prompt_id']
    ws = websocket.WebSocket(); ws.connect(f"ws://{COMFYUI_URL}/ws?clientId={cid}")
    try:
        while True:
            m = ws.recv()
            if isinstance(m,str):
                d = json.loads(m)
                if d.get('type')=='executing' and d.get('data',{}).get('prompt_id')==pid and d['data'].get('node') is None: break
    finally: ws.close()
    h2 = json.loads(urllib.request.urlopen(f"http://{COMFYUI_URL}/history/{pid}").read())
    if pid not in h2: return None
    for nid in h2[pid]['outputs']:
        if 'images' in h2[pid]['outputs'][nid]:
            for ii in h2[pid]['outputs'][nid]['images']:
                if ii.get('type')=='output':
                    params = urllib.parse.urlencode({"filename":ii['filename'],"subfolder":ii['subfolder'],"type":ii['type']})
                    with urllib.request.urlopen(f"http://{COMFYUI_URL}/view?{params}") as r:
                        return Image.open(io.BytesIO(r.read())).convert('RGB')
    return None

IMAGES = [
    {
        "file": "dc_clear_bg.png",
        "prompt": (
            "epic fantasy dungeon exit scene, hero emerging from dark dungeon into brilliant golden sunlight, "
            "massive stone dungeon gate with ancient runes, heavenly golden light rays streaming through the gate, "
            "treasure gold coins scattered on the ground, magical sparkles and particles in the air, "
            "dramatic lighting, dark dungeon interior contrasting with bright warm golden exterior light, "
            "fantasy RPG victory scene, cinematic composition, detailed game art illustration, no text"
        ),
        "size": (768, 512), "out_size": (600, 400), "rembg": False,
    },
    {
        "file": "dc_clear_emblem.png",
        "prompt": (
            "a single ornate golden victory emblem medal, circular shape with laurel wreath border, "
            "crossed swords behind a shield in the center, glowing golden divine light, "
            "intricate filigree details, gemstones embedded, radiant holy aura, "
            "centered on plain white background, RPG game UI element, "
            "Akihiko Yoshida style, detailed illustration, object only, white background"
        ),
        "size": (512, 512), "out_size": (256, 256), "rembg": True,
    },
    {
        "file": "dc_clear_banner.png",
        "prompt": (
            "a single ornate medieval scroll banner ribbon unfurled horizontally, "
            "golden edges with red velvet fabric, decorative curled ends, "
            "empty center area for text, fantasy game UI element, "
            "centered on plain white background, detailed illustration, object only, white background"
        ),
        "size": (768, 384), "out_size": (400, 120), "rembg": True,
    },
]

if __name__ == "__main__":
    import sys
    force = '--force' in sys.argv
    try: urllib.request.urlopen(f"http://{COMFYUI_URL}/system_stats")
    except: print("ERROR: ComfyUI not running"); exit(1)

    print(f"\n{'='*50}\nDungeon Clear UI Image Generation\n{'='*50}\n")
    for item in IMAGES:
        out = os.path.join(OUT_DIR, item['file'])
        if os.path.exists(out) and not force:
            print(f"[SKIP] {item['file']}"); continue
        print(f"[GEN] {item['file']}...")
        img = gen(item['prompt'], *item['size'])
        if not img: print("  FAILED"); continue
        if item['rembg'] and HAS_REMBG:
            print("  Removing BG...")
            img = rembg_remove(img).convert('RGBA')
        else:
            img = img.convert('RGBA')
        img = img.resize(item['out_size'], Image.LANCZOS)
        img.save(out); print(f"  OK → {out}")
    print(f"\n{'='*50}\nDone!\n{'='*50}")
