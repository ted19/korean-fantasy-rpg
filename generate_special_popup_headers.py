"""
정령의 시련 팝업 헤더 (elem_tier_1~5) + 보스 토벌전 팝업 헤더 (br_scene_1~6)
- 가로형 (768x320) 이미지로 재생성
- ComfyUI + Flux.1-dev
"""
import json, urllib.request, urllib.parse, uuid, websocket, os, io, time
from PIL import Image

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
if not all([UNET,C1,C2,VAE]): print("ERROR: models"); exit(1)

def gen(prompt,w,h):
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
        "10":{"class_type":"SaveImage","inputs":{"images":["9",0],"filename_prefix":"sph"}}}
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

S = "detailed fantasy RPG game art, korean fantasy style, cinematic wide angle, dramatic lighting, no text, no UI"

IMAGES = [
    # 정령의 시련 tier 1~5 팝업 헤더 (와이드)
    {"file": "elem_tier_1.png",
     "prompt": f"a beginner elemental trial arena, small stone circle with faint magical glow, simple torches, misty forest clearing, peaceful but mysterious atmosphere, wide panoramic view, {S}",
     "size": (768, 320), "out": (600, 250)},
    {"file": "elem_tier_2.png",
     "prompt": f"an intermediate elemental trial chamber, glowing rune circles on floor, floating elemental crystals, ancient pillars with magical energy, underground cavern, wide panoramic view, {S}",
     "size": (768, 320), "out": (600, 250)},
    {"file": "elem_tier_3.png",
     "prompt": f"an advanced elemental trial sanctum, intense magical storms swirling, four elemental pillars shooting beams of energy, cracked ground with glowing fissures, dramatic sky, wide panoramic view, {S}",
     "size": (768, 320), "out": (600, 250)},
    {"file": "elem_tier_4.png",
     "prompt": f"a master elemental trial throne room, massive elemental guardians standing at four corners, golden magical barriers, floating platforms, epic scale architecture, wide panoramic view, {S}",
     "size": (768, 320), "out": (600, 250)},
    {"file": "elem_tier_5.png",
     "prompt": f"a legendary elemental trial dimension, reality shattering with four elements colliding, fire water earth wind creating cosmic vortex, god-like scale, divine light and shadow, wide panoramic view, {S}",
     "size": (768, 320), "out": (600, 250)},

    # 보스 토벌전 scene 1~6 팝업 헤더 (와이드)
    {"file": "br_scene_1.png",
     "prompt": f"a dark forest boss lair entrance, massive twisted ancient trees forming an archway, glowing red eyes in the darkness, fog and fireflies, ominous atmosphere, wide panoramic view, {S}",
     "size": (768, 320), "out": (600, 250)},
    {"file": "br_scene_2.png",
     "prompt": f"a volcanic demon boss arena, lava rivers flowing around obsidian platform, fire eruptions, massive demon throne in background, hellish red sky, wide panoramic view, {S}",
     "size": (768, 320), "out": (600, 250)},
    {"file": "br_scene_3.png",
     "prompt": f"an underwater dragon boss chamber, massive coral throne room, bioluminescent deep sea, giant sea serpent silhouette, bubble columns, wide panoramic view, {S}",
     "size": (768, 320), "out": (600, 250)},
    {"file": "br_scene_4.png",
     "prompt": f"a mountain peak boss battleground, lightning storms, floating rock platforms, ancient korean temple ruins, snow and wind, epic scale, wide panoramic view, {S}",
     "size": (768, 320), "out": (600, 250)},
    {"file": "br_scene_5.png",
     "prompt": f"a spirit realm boss dimension, ethereal purple and blue energy, floating islands, massive spirit tree, ghostly wisps, otherworldly landscape, wide panoramic view, {S}",
     "size": (768, 320), "out": (600, 250)},
    {"file": "br_scene_6.png",
     "prompt": f"a final boss throne room, massive golden korean palace interior, dragon carvings, imperial throne with dark energy, epic scale pillars, divine and dark forces clashing, wide panoramic view, {S}",
     "size": (768, 320), "out": (600, 250)},
]

if __name__ == "__main__":
    import sys
    try: urllib.request.urlopen(f"http://{COMFYUI_URL}/system_stats")
    except: print("ERROR: ComfyUI not running"); exit(1)

    targets = [a for a in sys.argv[1:] if not a.startswith('-')]
    items = [i for i in IMAGES if i['file'] in targets] if targets else IMAGES

    print(f"\n{'='*55}")
    print(f"Special Dungeon Popup Headers - {len(items)} wide images")
    print(f"{'='*55}\n")

    for item in items:
        out = os.path.join(OUT_DIR, item['file'])
        # 백업
        if os.path.exists(out):
            bak = out + '.bak'
            if not os.path.exists(bak):
                try: os.rename(out, bak)
                except: pass

        print(f"[GEN] {item['file']} ({item['out'][0]}x{item['out'][1]})...")
        img = gen(item['prompt'], *item['size'])
        if not img:
            print("  FAILED")
            bak = out + '.bak'
            if os.path.exists(bak): os.rename(bak, out)
            continue
        img = img.resize(item['out'], Image.LANCZOS)
        img.save(out)
        print(f"  OK -> {item['file']}")

    print(f"\n{'='*55}")
    print("Done!")
    print("실행: python generate_special_popup_headers.py")
    print("특정: python generate_special_popup_headers.py elem_tier_1.png br_scene_3.png")
    print(f"{'='*55}")
