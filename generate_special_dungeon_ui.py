"""
정령의 시련 / 보스 토벌전 UI 이미지 재생성
- 기존 이미지를 더 고급스러운 버전으로 교체
- ComfyUI + Flux.1-dev + rembg
"""
import json, urllib.request, urllib.parse, uuid, websocket, os, io, time
from PIL import Image

try:
    from rembg import remove as rembg_remove
    HAS_REMBG = True
except ImportError:
    HAS_REMBG = False

COMFYUI_URL = "127.0.0.1:8188"
OUT_DIR = "F:/project/game/client/public/special_dungeons"

def detect_models():
    try:
        resp = urllib.request.urlopen(f"http://{COMFYUI_URL}/object_info")
        nodes = json.loads(resp.read())
    except Exception as e:
        print(f"ERROR: {e}"); exit(1)
    def gc(n,i):
        if n not in nodes: return []
        v=nodes[n].get('input',{}).get('required',{}).get(i,[[]])
        return v[0] if isinstance(v,list) and len(v)>0 and isinstance(v[0],list) else []
    ul,cl,vl = gc('UNETLoader','unet_name'),gc('DualCLIPLoader','clip_name1'),gc('VAELoader','vae_name')
    u=next((f for p in ['flux1-dev-fp8','flux1-dev','flux'] for f in ul if p in f.lower()),ul[0] if ul else None)
    t5=next((f for f in cl if 't5' in f.lower()),cl[0] if cl else None)
    cl2=next((f for f in cl if 'clip_l' in f.lower()),cl[1] if len(cl)>1 else None)
    v=next((f for f in vl if 'ae' in f.lower() or 'flux' in f.lower()),vl[0] if vl else None)
    return u,t5,cl2,v

UNET,C1,C2,VAE = detect_models()
if not all([UNET,C1,C2,VAE]): print("ERROR: models missing"); exit(1)

def gen(prompt,w=512,h=512):
    wd="default" if "fp8" in UNET.lower() else "fp8_e4m3fn"
    wf={"1":{"class_type":"UNETLoader","inputs":{"unet_name":UNET,"weight_dtype":wd}},
        "2":{"class_type":"DualCLIPLoader","inputs":{"clip_name1":C1,"clip_name2":C2,"type":"flux"}},
        "3":{"class_type":"CLIPTextEncode","inputs":{"text":prompt,"clip":["2",0]}},
        "4":{"class_type":"CLIPTextEncode","inputs":{"text":"","clip":["2",0]}},
        "5":{"class_type":"EmptySD3LatentImage","inputs":{"width":w,"height":h,"batch_size":1}},
        "6":{"class_type":"FluxGuidance","inputs":{"guidance":3.5,"conditioning":["3",0]}},
        "7":{"class_type":"KSampler","inputs":{"model":["1",0],"positive":["6",0],"negative":["4",0],"latent_image":["5",0],
            "seed":int(time.time()*1000)%(2**32),"steps":20,"cfg":1.0,"sampler_name":"euler","scheduler":"simple","denoise":1.0}},
        "8":{"class_type":"VAELoader","inputs":{"vae_name":VAE}},
        "9":{"class_type":"VAEDecode","inputs":{"samples":["7",0],"vae":["8",0]}},
        "10":{"class_type":"SaveImage","inputs":{"images":["9",0],"filename_prefix":"spd"}}}
    cid=str(uuid.uuid4())
    data=json.dumps({"prompt":wf,"client_id":cid}).encode()
    req=urllib.request.Request(f"http://{COMFYUI_URL}/prompt",data=data,headers={'Content-Type':'application/json'})
    pid=json.loads(urllib.request.urlopen(req).read())['prompt_id']
    ws=websocket.WebSocket();ws.connect(f"ws://{COMFYUI_URL}/ws?clientId={cid}")
    try:
        while True:
            m=ws.recv()
            if isinstance(m,str):
                d=json.loads(m)
                if d.get('type')=='executing' and d.get('data',{}).get('prompt_id')==pid and d['data'].get('node') is None: break
    finally: ws.close()
    h2=json.loads(urllib.request.urlopen(f"http://{COMFYUI_URL}/history/{pid}").read())
    if pid not in h2: return None
    for nid in h2[pid]['outputs']:
        if 'images' in h2[pid]['outputs'][nid]:
            for ii in h2[pid]['outputs'][nid]['images']:
                if ii.get('type')=='output':
                    params=urllib.parse.urlencode({"filename":ii['filename'],"subfolder":ii['subfolder'],"type":ii['type']})
                    with urllib.request.urlopen(f"http://{COMFYUI_URL}/view?{params}") as r:
                        return Image.open(io.BytesIO(r.read())).convert('RGB')
    return None

STYLE = "detailed fantasy RPG game art, Akihiko Yoshida style, korean fantasy, no text"

IMAGES = [
    # 정령의 시련
    {"file": "elemental_banner.png",
     "prompt": f"a mystical elemental shrine altar with four elemental orbs floating (fire, water, earth, wind), ancient stone pillars, magical energy swirling, dark mystical forest background, {STYLE}",
     "size": (768, 256), "out": (600, 200)},
    {"file": "elem_altar.png",
     "prompt": f"a sacred stone altar with four glowing elemental crystals (red fire, blue water, green earth, purple wind), magical energy beam shooting upward, ancient runes on the altar, dark cave, {STYLE}",
     "size": (512, 512), "out": (400, 400)},
    {"file": "elem_fire_bg.png",
     "prompt": f"a volcanic fire temple interior with lava pools, burning torches, red glowing runes on obsidian walls, fire elementals floating, dramatic red and orange lighting, {STYLE}",
     "size": (768, 384), "out": (600, 300)},
    {"file": "elem_water_bg.png",
     "prompt": f"an underwater crystal palace with coral pillars, bioluminescent jellyfish, deep blue ocean, water elementals swimming, magical blue light rays, {STYLE}",
     "size": (768, 384), "out": (600, 300)},
    {"file": "elem_earth_bg.png",
     "prompt": f"an ancient earth temple carved into a mountain, massive tree roots, glowing green crystals, stone golems standing guard, earthy brown and green tones, {STYLE}",
     "size": (768, 384), "out": (600, 300)},
    {"file": "elem_wind_bg.png",
     "prompt": f"a floating sky temple above clouds, wind spirits swirling, purple lightning, crystalline spires, ethereal purple and white atmosphere, {STYLE}",
     "size": (768, 384), "out": (600, 300)},

    # 보스 토벌전
    {"file": "boss_raid_banner.png",
     "prompt": f"an epic boss raid battle arena with massive stone gates, dragon skull decorations, war banners, torches burning, ominous dark clouds above, {STYLE}",
     "size": (768, 256), "out": (600, 200)},
    {"file": "br_arena.png",
     "prompt": f"a grand korean fantasy battle colosseum with tiered seating filled with spectators, ornate korean roof architecture, magical barrier in the center arena, dramatic lighting, {STYLE}",
     "size": (512, 512), "out": (400, 400)},
    {"file": "br_popup_bg.png",
     "prompt": f"a dark menacing boss lair entrance with glowing red runes, massive stone door, dragon carvings, fog and fire, ominous atmosphere, {STYLE}",
     "size": (512, 384), "out": (420, 300)},
]

if __name__ == "__main__":
    import sys
    try: urllib.request.urlopen(f"http://{COMFYUI_URL}/system_stats")
    except: print("ERROR: ComfyUI not running"); exit(1)

    targets = [a for a in sys.argv[1:] if not a.startswith('-')]
    items = [i for i in IMAGES if i['file'] in targets] if targets else IMAGES
    force = '--force' in sys.argv

    print(f"\n{'='*55}\nSpecial Dungeon UI - {len(items)} images\n{'='*55}\n")
    for item in items:
        out = os.path.join(OUT_DIR, item['file'])
        if os.path.exists(out) and not force:
            print(f"[SKIP] {item['file']}"); continue
        print(f"[GEN] {item['file']}...")
        img = gen(item['prompt'], *item['size'])
        if not img: print("  FAILED"); continue
        img = img.resize(item['out'], Image.LANCZOS)
        img.save(out); print(f"  OK ({item['out'][0]}x{item['out'][1]})")
    print(f"\n{'='*55}\nDone!\n{'='*55}")
