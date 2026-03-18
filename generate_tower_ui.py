"""
무한의 탑 UI 이미지 고퀄리티 재생성
- 배너, 외관, 팝업 헤더: 와이드 (768x320)
- 아이콘: 정사각형 (256x256) + rembg 투명배경
- 테마별 배경: 와이드 (768x320)
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
        "10":{"class_type":"SaveImage","inputs":{"images":["9",0],"filename_prefix":"twr"}}}
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

S = "detailed fantasy RPG game art, korean fantasy style, cinematic, dramatic lighting, no text"
NOBG = "centered on plain white background, isolated object, clean white background, no background"

IMAGES = [
    # ===== 메인 화면 =====
    {"file": "tower_banner.png",
     "prompt": f"a majestic korean fantasy infinite tower rising through clouds, multiple tiers with traditional korean pagoda roofs, purple magical energy swirling around the spire, moonlit night sky with stars, wide panoramic banner view, {S}",
     "size": (768, 256), "out": (600, 200), "rembg": False},
    {"file": "tower_exterior.png",
     "prompt": f"a magnificent korean pagoda tower exterior, towering above misty mountains, stone stairway leading up, warrior standing at the base looking up, cherry blossoms, divine purple light from the top, epic scale, {S}",
     "size": (512, 512), "out": (400, 400), "rembg": False},
    {"file": "tower_bg.png",
     "prompt": f"a dark mystical tower interior background, endless spiral staircase going upward, purple torchlight, ancient stone walls with glowing runes, atmospheric fog, {S}",
     "size": (768, 512), "out": (600, 400), "rembg": False},

    # ===== 아이콘 (투명배경) =====
    {"file": "tower_icon.png",
     "prompt": f"a single ornate korean pagoda tower icon, glowing purple magical aura, detailed miniature tower with multiple tiers, golden ornaments, {NOBG}, {S}",
     "size": (256, 256), "out": (128, 128), "rembg": True},
    {"file": "tower_challenge_icon.png",
     "prompt": f"a single glowing crossed swords icon with purple magical energy, battle challenge emblem, ornate golden hilts, {NOBG}, {S}",
     "size": (256, 256), "out": (128, 128), "rembg": True},
    {"file": "tower_trophy.png",
     "prompt": f"a single ornate golden trophy cup with purple crystal on top, victory award, detailed metalwork, magical sparkles, {NOBG}, {S}",
     "size": (256, 256), "out": (128, 128), "rembg": True},
    {"file": "tower_stairs.png",
     "prompt": f"a single spiral stone staircase icon going upward with purple light at top, tower floor progression symbol, {NOBG}, {S}",
     "size": (256, 256), "out": (128, 128), "rembg": True},
    {"file": "tower_reward_chest.png",
     "prompt": f"a single ornate treasure chest overflowing with gold and purple crystals, reward chest, magical glow, {NOBG}, {S}",
     "size": (256, 256), "out": (128, 128), "rembg": True},
    {"file": "tower_stat_icon_floor.png",
     "prompt": f"a single stone floor tile icon with number symbol and upward arrow, floor counter badge, {NOBG}, {S}",
     "size": (256, 256), "out": (128, 128), "rembg": True},
    {"file": "tower_stat_icon_best.png",
     "prompt": f"a single golden crown icon with purple gem, best record badge, achievement symbol, {NOBG}, {S}",
     "size": (256, 256), "out": (128, 128), "rembg": True},
    {"file": "tower_stat_icon_battle.png",
     "prompt": f"a single crossed swords with shield icon, battle count badge, combat symbol, {NOBG}, {S}",
     "size": (256, 256), "out": (128, 128), "rembg": True},

    # ===== 도전 팝업 =====
    {"file": "tower_popup_bg.png",
     "prompt": f"a dark tower interior corridor with purple magical torches, stone archway leading to a glowing portal, mysterious atmosphere, dramatic depth, wide view, {S}",
     "size": (768, 384), "out": (500, 250), "rembg": False},
    {"file": "tower_popup_boss_bg.png",
     "prompt": f"a menacing tower boss room, massive dark throne with purple fire, ominous guardian silhouette, cracked floor with purple glowing veins, dramatic wide view, {S}",
     "size": (768, 384), "out": (500, 250), "rembg": False},
    {"file": "tower_challenge_sword.png",
     "prompt": f"a single ornate magical sword with purple glowing blade, ethereal energy aura, detailed fantasy weapon, {NOBG}, {S}",
     "size": (256, 384), "out": (80, 120), "rembg": True},

    # ===== 층 카드 =====
    {"file": "tower_floor_normal.png",
     "prompt": f"a stone tower floor entrance with iron door and torch, dungeon passage, dim lighting, mysterious, wide horizontal view, {S}",
     "size": (768, 320), "out": (400, 170), "rembg": False},
    {"file": "tower_floor_boss.png",
     "prompt": f"a massive boss gate with dragon skull decorations and purple fire, ominous boss floor entrance, dark energy swirling, wide horizontal view, {S}",
     "size": (768, 320), "out": (400, 170), "rembg": False},
    {"file": "tower_boss_door.png",
     "prompt": f"a gigantic ornate boss door with dragon carvings, glowing purple runes, chains and locks, imposing dark stone, wide horizontal view, {S}",
     "size": (768, 320), "out": (400, 170), "rembg": False},

    # ===== 테마 배경 =====
    {"file": "tower_theme_cave.png",
     "prompt": f"a dark crystal cave dungeon interior, stalactites, glowing blue crystals, underground river, atmospheric, wide panoramic, {S}",
     "size": (768, 320), "out": (400, 170), "rembg": False},
    {"file": "tower_theme_goblin.png",
     "prompt": f"a goblin fortress interior with crude wooden structures, green torches, stolen treasures piled up, chaotic atmosphere, wide panoramic, {S}",
     "size": (768, 320), "out": (400, 170), "rembg": False},
    {"file": "tower_theme_mountain.png",
     "prompt": f"a frozen mountain peak temple, ice crystals, snow storm, ancient korean architecture frozen in ice, dramatic cold blue lighting, wide panoramic, {S}",
     "size": (768, 320), "out": (400, 170), "rembg": False},
    {"file": "tower_theme_ocean.png",
     "prompt": f"an underwater ruins temple, coral covered pillars, sunlight streaming through water, exotic deep sea fish, magical bubbles, wide panoramic, {S}",
     "size": (768, 320), "out": (400, 170), "rembg": False},
    {"file": "tower_theme_temple.png",
     "prompt": f"a haunted ancient temple interior, broken buddha statues, ghostly green flames, spider webs, decayed altar, eerie atmosphere, wide panoramic, {S}",
     "size": (768, 320), "out": (400, 170), "rembg": False},
    {"file": "tower_theme_demon.png",
     "prompt": f"a demon realm fortress interior, lava pools, obsidian pillars, demonic carvings, hellfire torches, oppressive red atmosphere, wide panoramic, {S}",
     "size": (768, 320), "out": (400, 170), "rembg": False},
    {"file": "tower_theme_dragon.png",
     "prompt": f"a dragon lair cavern, massive dragon skeleton, piles of gold, ancient magic circles, volcanic heat, dramatic golden lighting, wide panoramic, {S}",
     "size": (768, 320), "out": (400, 170), "rembg": False},

    # ===== 기타 =====
    {"file": "tower_complete.png",
     "prompt": f"a victorious scene at the top of an infinite tower, golden light streaming down, hero silhouette raising sword, clouds below, divine achievement moment, {S}",
     "size": (512, 512), "out": (300, 300), "rembg": False},
    {"file": "tower_next_door.png",
     "prompt": f"a glowing portal doorway leading to the next floor, purple magical energy swirling in the archway, stone frame with runes, inviting mysterious light, {S}",
     "size": (512, 512), "out": (300, 300), "rembg": False},
]

if __name__ == "__main__":
    import sys
    try: urllib.request.urlopen(f"http://{COMFYUI_URL}/system_stats")
    except: print("ERROR: ComfyUI not running"); exit(1)

    targets = [a for a in sys.argv[1:] if not a.startswith('-')]
    items = [i for i in IMAGES if i['file'] in targets] if targets else IMAGES

    print(f"\n{'='*55}")
    print(f"Tower UI Images - {len(items)} images")
    print(f"{'='*55}\n")

    for item in items:
        out = os.path.join(OUT_DIR, item['file'])
        if os.path.exists(out) and '--force' not in sys.argv:
            bak = out + '.bak'
            if not os.path.exists(bak):
                try: os.rename(out, bak)
                except: pass

        print(f"[GEN] {item['file']} ({item['out'][0]}x{item['out'][1]})...")
        img = gen(item['prompt'], *item['size'])
        if not img:
            print("  FAILED")
            bak = out + '.bak'
            if os.path.exists(bak) and not os.path.exists(out): os.rename(bak, out)
            continue

        if item.get('rembg') and HAS_REMBG:
            print("  Removing BG...")
            img = rembg_remove(img).convert('RGBA')
        else:
            img = img.convert('RGBA')

        img = img.resize(item['out'], Image.LANCZOS)
        img.save(out, 'PNG')
        size_kb = os.path.getsize(out) / 1024
        print(f"  OK ({size_kb:.0f}KB)")

    print(f"\n{'='*55}")
    print("Done!")
    print(f"전체: python generate_tower_ui.py --force")
    print(f"특정: python generate_tower_ui.py tower_icon.png tower_trophy.png")
    print(f"{'='*55}")
