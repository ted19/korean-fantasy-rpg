"""
던전 에셋 재생성 - ComfyUI API + Flux.1-dev + rembg
투명 배경으로 재생성할 이미지:
- dc_treasure_popup_bg.png (보물 더미 — 큰 사이즈로)
- dc_torch_nobg.png (벽 횃대 1)
- dc_torch_nobg2.png (벽 횃대 2 — 다른 디자인)
- dc_ghost.png (유령)
- dc_bats.png (박쥐 떼)
- dc_ghost_merchant.png (유령 상인)
- dc_rat.png (쥐)
- dc_mushroom.png (발광 버섯)
"""
import json, urllib.request, urllib.parse, uuid, websocket, os, io, time
from PIL import Image

try:
    from rembg import remove as rembg_remove
    HAS_REMBG = True
    print("rembg loaded")
except ImportError:
    HAS_REMBG = False
    print("ERROR: rembg required - pip install rembg")
    exit(1)

COMFYUI_URL = "127.0.0.1:8188"
OUT_DIR = "F:/project/game/client/public/ui/dungeon"

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
        "10":{"class_type":"SaveImage","inputs":{"images":["9",0],"filename_prefix":"dfix"}},
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

# 공통 스타일 접미사
STYLE_SUFFIX = "fantasy RPG game art, Akihiko Yoshida style, detailed illustration"
NOBG_SUFFIX = "centered on plain white background, no background, isolated object, clean white background"

IMAGES = [
    # === 보물 더미 (투명 배경 — 보물상자+금화만) ===
    {
        "file": "dc_treasure_popup_bg.png",
        "prompt": (
            "a large ornate open wooden treasure chest overflowing with gold coins and sparkling jewels, "
            "rubies emeralds sapphires scattered around the base, golden chalices and crowns spilling out, "
            "magical golden sparkle particles floating upward, warm golden light glow from inside, "
            "full chest visible with surrounding treasure pile on ground, "
            f"{NOBG_SUFFIX}, {STYLE_SUFFIX}, no text, no character, treasure chest only"
        ),
        "size": (768, 768), "out_size": (512, 512), "rembg": True,
    },
    # === 팝업용 열린 보물상자 (투명 배경) ===
    {
        "file": "dc_treasure.png",
        "prompt": (
            "a single open ornate wooden treasure chest with golden coins spilling out, "
            "rounded dome lid swung open, golden metal trim, jewels visible inside, "
            "warm golden light shining upward from inside the chest, "
            f"{NOBG_SUFFIX}, {STYLE_SUFFIX}, no character, open chest only"
        ),
        "size": (512, 512), "out_size": (256, 256), "rembg": True,
    },
    # === 3D 뷰 보물상자 스프라이트 (투명 배경, 닫힌 상자) ===
    {
        "file": "dc_treasure_nobg.png",
        "prompt": (
            "a single closed ornate wooden treasure chest with rounded dome lid, "
            "golden metal corner brackets and lock clasp, warm golden glow from cracks, "
            "detailed wood grain, small gemstone on front, compact proportioned chest, "
            f"{NOBG_SUFFIX}, {STYLE_SUFFIX}, no character, chest only"
        ),
        "size": (512, 512), "out_size": (256, 256), "rembg": True,
    },
    # === 횃대 1 — 심플한 철제 벽 횃대 ===
    {
        "file": "dc_torch_nobg.png",
        "prompt": (
            "a single medieval iron wall torch sconce with bright burning orange flame on top, "
            "simple iron bracket mounted horizontally, wooden torch stick with wrapped cloth and fire, "
            "warm firelight glow around the flame, dark iron metalwork, "
            f"{NOBG_SUFFIX}, {STYLE_SUFFIX}, no wall, object only"
        ),
        "size": (512, 768), "out_size": (200, 300), "rembg": True,
    },
    # === 횃대 2 — 큰 불꽃이 타오르는 횃대 ===
    {
        "file": "dc_torch_nobg2.png",
        "prompt": (
            "a single tall wooden torch with large bright burning fire flame on top, "
            "big roaring orange and yellow flames with red embers flying up, "
            "thick wooden handle wrapped with cloth, iron ring at the base, "
            "the fire is the main focus taking up half of the image, dramatic flames, "
            f"{NOBG_SUFFIX}, {STYLE_SUFFIX}, no wall, torch with fire only"
        ),
        "size": (512, 768), "out_size": (200, 300), "rembg": True,
    },
    # === 유령 — 반투명 떠다니는 혼령 ===
    {
        "file": "dc_ghost.png",
        "prompt": (
            "a single floating translucent ghost spirit, wispy ethereal blue-white glowing form, "
            "sad haunting expression, tattered robes fading into mist at the bottom, "
            "ghostly blue aura glow, spectral transparent body, arms reaching forward, "
            f"{NOBG_SUFFIX}, {STYLE_SUFFIX}, no background, creature only"
        ),
        "size": (512, 512), "out_size": (300, 300), "rembg": True,
    },
    # === 박쥐 떼 — 날아다니는 동굴 박쥐들 ===
    {
        "file": "dc_bats.png",
        "prompt": (
            "a swarm of small dark cave bats flying together in a group, "
            "5-7 black bats with spread wings in different flight poses, "
            "dark silhouette style, small red eyes glowing, scattered formation, "
            f"{NOBG_SUFFIX}, {STYLE_SUFFIX}, no background, bats only"
        ),
        "size": (640, 480), "out_size": (400, 300), "rembg": True,
    },
    # === 유령 상인 — 두건 쓴 미스터리한 상인 ===
    {
        "file": "dc_ghost_merchant.png",
        "prompt": (
            "a single mysterious ghost merchant NPC, translucent spectral figure wearing a dark hooded cloak, "
            "friendly glowing blue eyes visible under the hood, holding a small treasure chest or potion, "
            "ghostly blue-green ethereal glow around the body, floating slightly above ground, "
            "merchant bag or backpack visible, welcoming gesture, "
            f"{NOBG_SUFFIX}, {STYLE_SUFFIX}, no background, character only"
        ),
        "size": (512, 640), "out_size": (300, 380), "rembg": True,
    },
    # === 쥐 — 던전 쥐 ===
    {
        "file": "dc_rat.png",
        "prompt": (
            "a single dark brown dungeon rat, small beady red eyes, long pink tail, "
            "scruffy dirty fur, crouching low aggressive pose with teeth bared, "
            "realistic proportioned rat not cartoon, slightly menacing, "
            f"{NOBG_SUFFIX}, {STYLE_SUFFIX}, no background, animal only"
        ),
        "size": (512, 384), "out_size": (300, 220), "rembg": True,
    },
    # === 발광 버섯 — 어둠 속에서 빛나는 던전 버섯 ===
    {
        "file": "dc_mushroom.png",
        "prompt": (
            "a small cluster of 3-4 bioluminescent fantasy mushrooms growing from dungeon floor, "
            "glowing soft teal and purple light, translucent caps with spots, "
            "thin stems growing from mossy stone, magical spore particles floating upward, "
            "dark moody atmosphere, fantasy mushroom cluster, "
            f"{NOBG_SUFFIX}, {STYLE_SUFFIX}, no background, mushrooms only"
        ),
        "size": (512, 512), "out_size": (300, 300), "rembg": True,
    },
    # === 안개 오버레이 — 반투명 안개 ===
    {
        "file": "dc_fog_overlay.png",
        "prompt": (
            "wispy green mystical fog mist swirling in a dark dungeon corridor, "
            "translucent ethereal green smoke tendrils, glowing particles floating in the mist, "
            "horizontal composition, mysterious atmosphere, "
            f"{NOBG_SUFFIX}, {STYLE_SUFFIX}, fog only, no walls no floor"
        ),
        "size": (768, 256), "out_size": (600, 200), "rembg": True,
    },
    # === 횃불 이미지 (이벤트용) — 검은 배경 → 투명 변환 (불꽃 보존) ===
    {
        "file": "dc_torch_img.png",
        "prompt": (
            "a single medieval wall torch with very large bright burning fire, "
            "the flame is huge and takes up most of the upper half of the image, "
            "vivid bright orange yellow red flames with embers and sparks, "
            "iron bracket and wooden handle at the bottom, "
            "solid black background, dramatic firelight, "
            f"{STYLE_SUFFIX}, no wall, torch with big fire only"
        ),
        "size": (384, 640), "out_size": (180, 300), "rembg": "black_to_alpha",
    },
    # === 매복 배경 — 어둠 속 붉은 눈 몬스터 ===
    {
        "file": "dc_ambush_bg.png",
        "prompt": (
            "a menacing dark monster silhouette lurking in shadows with glowing red eyes, "
            "dark dungeon ambush scene, creature crouching ready to attack, "
            "dramatic red glow from eyes illuminating the darkness, scary atmosphere, "
            f"{NOBG_SUFFIX}, {STYLE_SUFFIX}, no background, dark creature silhouette only"
        ),
        "size": (768, 384), "out_size": (500, 250), "rembg": True,
    },
    # === 전투 조우 배경 — 칼 부딪히는 장면 ===
    {
        "file": "dc_encounter_bg.png",
        "prompt": (
            "two crossed swords clashing with bright sparks and energy explosion at the impact point, "
            "dramatic action scene, steel blades colliding, bright white and orange sparks flying, "
            "shockwave energy ring at center, epic battle moment, "
            f"{NOBG_SUFFIX}, {STYLE_SUFFIX}, no character, swords clash only"
        ),
        "size": (512, 512), "out_size": (400, 400), "rembg": True,
    },
    # === 전투 조우 배경 v2 — 붉은 전투 실루엣 ===
    {
        "file": "dc_encounter_bg_v2.png",
        "prompt": (
            "a dramatic warrior silhouette raising a sword against a giant monster shadow, "
            "epic confrontation moment, dark silhouettes against red glowing energy background, "
            "red lightning and sparks, battle aura, "
            f"{NOBG_SUFFIX}, {STYLE_SUFFIX}, no background, silhouettes only"
        ),
        "size": (768, 512), "out_size": (500, 330), "rembg": True,
    },
]

if __name__ == "__main__":
    import sys
    try: urllib.request.urlopen(f"http://{COMFYUI_URL}/system_stats")
    except: print("ERROR: ComfyUI not running"); exit(1)

    # 특정 파일만 재생성: python generate_dungeon_assets_fix.py dc_ghost.png dc_rat.png
    targets = [a for a in sys.argv[1:] if not a.startswith('-')]
    if targets:
        items = [i for i in IMAGES if i['file'] in targets]
        if not items:
            print(f"No matching files found. Available: {[i['file'] for i in IMAGES]}")
            exit(1)
    else:
        items = IMAGES

    print(f"\n{'='*55}")
    print(f"Dungeon Asset Fix - {len(items)} images")
    print(f"{'='*55}\n")

    for item in items:
        out = os.path.join(OUT_DIR, item['file'])
        # 기존 파일 백업
        if os.path.exists(out):
            bak = out + '.bak'
            if not os.path.exists(bak):
                try: os.rename(out, bak)
                except: pass
                print(f"  Backed up → {os.path.basename(bak)}")
            else:
                os.remove(out)

        print(f"[GEN] {item['file']} ({item['out_size'][0]}x{item['out_size'][1]})...")
        img = gen(item['prompt'], *item['size'])
        if not img:
            print("  FAILED - restoring backup")
            bak = out + '.bak'
            if os.path.exists(bak): os.rename(bak, out)
            continue

        if item['rembg'] == 'black_to_alpha':
            # 검은 배경을 투명으로 변환 (불꽃/발광 보존)
            print("  Black → transparent...")
            import numpy as np
            img = img.convert('RGBA')
            data = np.array(img)
            # 픽셀 밝기 = R+G+B, 어두울수록 투명
            brightness = data[:,:,0].astype(int) + data[:,:,1].astype(int) + data[:,:,2].astype(int)
            # 밝기 30 이하 = 완전 투명, 30~120 = 점진적, 120+ = 완전 불투명
            alpha = np.clip((brightness - 30) * 255 / 90, 0, 255).astype(np.uint8)
            data[:,:,3] = alpha
            img = Image.fromarray(data)
        elif item['rembg']:
            print("  Removing background...")
            img = rembg_remove(img).convert('RGBA')
        else:
            img = img.convert('RGBA')

        img = img.resize(item['out_size'], Image.LANCZOS)
        img.save(out, 'PNG')
        size_kb = os.path.getsize(out) / 1024
        print(f"  OK → {item['file']} ({size_kb:.0f}KB)")

    print(f"\n{'='*55}")
    print("Done! 실행 방법:")
    print("  전체: python generate_dungeon_assets_fix.py")
    print("  선택: python generate_dungeon_assets_fix.py dc_ghost.png dc_rat.png")
    print(f"{'='*55}")
