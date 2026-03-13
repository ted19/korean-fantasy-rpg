"""
스페셜 던전 이미지 생성 - ComfyUI API + Flux.1-dev
- client/public/special_dungeons/ 에 이미지 생성
- client/public/special_dungeons_nobg/ 에 배경 제거 버전 (아이콘류)

사전 준비:
1. ComfyUI 실행: cd ComfyUI && python main.py
2. pip install websocket-client rembg Pillow
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
    print("rembg not found - skip bg removal")

# ============================================================
# 설정
# ============================================================
COMFYUI_URL = "127.0.0.1:8188"
OUT_DIR = "F:/project/game/client/public/special_dungeons"
OUT_NOBG = "F:/project/game/client/public/special_dungeons_nobg"
os.makedirs(OUT_DIR, exist_ok=True)
os.makedirs(OUT_NOBG, exist_ok=True)

# ============================================================
# 공통 스타일 접두어
# ============================================================
STYLE_PREFIX = "pixel art SRPG character, Akihiko Yoshida style, tactics ogre style, japanese fantasy RPG illustration, "

# ============================================================
# 이미지 정의: (filename, width, height, prompt, nobg)
# nobg=True이면 배경 제거 + 아이콘 크기(256x256)
# 모든 prompt에 STYLE_PREFIX가 자동 추가됨
# ============================================================
IMAGES = [
    # ========== 무한의 탑 (Tower) ==========
    # 메인 이미지
    ("tower_bg.png", 512, 512,
     "a towering ancient fantasy pagoda reaching into stormy clouds, korean traditional architecture, dark mystical atmosphere, glowing runes on walls, fantasy game background, epic scale, painterly illustration",
     False),
    ("tower_card.png", 512, 256,
     "wide view of a massive mystical tower with multiple floors, korean fantasy pagoda style, surrounded by swirling magical energy, dark sky with lightning, fantasy RPG card art, panoramic",
     False),
    ("tower_banner.png", 512, 128,
     "horizontal banner showing a towering ancient korean pagoda, mystical glowing floors visible, dark purple sky, fantasy RPG banner art, wide panoramic composition",
     False),
    ("tower_icon.png", 256, 256,
     "a single mystical tower icon, korean pagoda style, glowing with purple magical energy, simple clean design, game UI icon, dark background",
     True),
    ("tower_exterior.png", 512, 512,
     "exterior view of a grand ancient korean fantasy tower, massive stone steps leading up, guardian statues at entrance, dark clouds gathering, mystical atmosphere, RPG game art",
     False),

    # 탑 진행 관련
    ("tower_stairs.png", 256, 256,
     "ancient stone spiral staircase inside a dark tower, glowing magical torches on walls, mysterious ascending path, fantasy dungeon interior, RPG game art",
     False),
    ("tower_floor_normal.png", 256, 256,
     "inside a dark tower floor, stone walls with glowing runes, magical braziers, battle arena space, fantasy dungeon room, RPG game art",
     False),
    ("tower_floor_boss.png", 256, 256,
     "boss chamber inside a dark tower, grand ornate room with glowing magic circles on floor, ominous purple light, massive pillars, fantasy dungeon boss room, RPG game art",
     False),
    ("tower_boss_door.png", 256, 256,
     "massive ornate door with glowing red runes, boss gate in a fantasy dungeon tower, ominous energy emanating, dark stone walls, RPG game art icon",
     True),
    ("tower_next_door.png", 256, 256,
     "a glowing portal doorway leading to the next floor, blue magical energy swirling, stone archway in a tower, fantasy game art icon",
     True),
    ("tower_complete.png", 256, 256,
     "a golden trophy with tower motif, victory emblem, completion reward icon, sparkling golden light, fantasy RPG achievement icon, clean background",
     True),
    ("tower_reward_chest.png", 256, 256,
     "an ornate golden treasure chest overflowing with gold coins and gems, magical glow, fantasy RPG reward icon, clean design",
     True),
    ("tower_progress_bar.png", 512, 64,
     "a horizontal stone progress bar with glowing blue fill, carved runes along the edge, fantasy RPG UI element, clean design, dark background",
     False),

    # 탑 정보 아이콘
    ("tower_info_exp.png", 64, 64,
     "a glowing blue star icon representing experience points, simple clean RPG game UI icon, white background",
     True),
    ("tower_info_gold.png", 64, 64,
     "a shining gold coin icon, simple clean RPG game UI icon, white background",
     True),
    ("tower_info_level.png", 64, 64,
     "a glowing sword with level number, difficulty indicator icon, simple clean RPG game UI icon, white background",
     True),
    ("tower_info_monster.png", 64, 64,
     "a red monster skull icon, enemy count indicator, simple clean RPG game UI icon, white background",
     True),

    # 탑 통계 아이콘
    ("tower_stat_floor.png", 128, 128,
     "a tower floor counter icon showing stacked stone blocks, fantasy RPG stat icon, clean design, dark background",
     True),
    ("tower_stat_best.png", 128, 128,
     "a golden crown trophy icon, best record achievement, fantasy RPG stat icon, clean design, dark background",
     True),
    ("tower_stat_clears.png", 128, 128,
     "a checkmark on a shield icon, completion count indicator, fantasy RPG stat icon, clean design, dark background",
     True),
    ("tower_stat_icon_battle.png", 64, 64,
     "crossed swords battle icon, simple fantasy RPG UI icon, white background",
     True),
    ("tower_stat_icon_best.png", 64, 64,
     "a golden medal with star, best score icon, simple fantasy RPG UI icon, white background",
     True),
    ("tower_stat_icon_floor.png", 64, 64,
     "stacked blocks floor number icon, simple fantasy RPG UI icon, white background",
     True),
    ("tower_trophy.png", 256, 256,
     "an elaborate golden trophy with a tower motif, sparkling magical particles, achievement reward, fantasy RPG illustration, clean background",
     True),

    # 탑 팝업 배경
    ("tower_popup_bg.png", 512, 512,
     "dark mystical tower interior background, blurred stone walls with glowing purple runes, atmospheric fog, suitable for overlay popup, fantasy RPG UI background",
     False),
    ("tower_popup_boss_bg.png", 512, 512,
     "dark ominous boss chamber background, red and purple glowing magic circles, smoke and fire effects, blurred suitable for overlay, fantasy RPG UI background",
     False),

    # 탑 도전 아이콘
    ("tower_challenge_icon.png", 128, 128,
     "a flaming sword challenge icon, combat trial emblem, fantasy RPG challenge icon, clean design, dark background",
     True),
    ("tower_challenge_sword.png", 256, 256,
     "a magnificent glowing magical sword thrust into stone, challenge trial weapon, ethereal light emanating, fantasy RPG illustration, clean background",
     True),

    # 탑 테마 아이콘
    ("tower_theme_icon.png", 128, 128,
     "a compass or map icon showing different environments, theme selector icon, fantasy RPG UI icon, clean design",
     True),
    ("tower_theme_cave.png", 256, 256,
     "dark underground cave with stalactites and glowing crystals, damp stone walls, underground dungeon atmosphere, fantasy RPG environment, painterly art",
     False),
    ("tower_theme_goblin.png", 256, 256,
     "a chaotic goblin encampment inside a tower, crude wooden structures, scattered loot, green torchlight, fantasy RPG environment, painterly art",
     False),
    ("tower_theme_mountain.png", 256, 256,
     "a snow-covered mountain peak temple interior, icy winds, frozen pillars, cold blue atmosphere, fantasy RPG environment, painterly art",
     False),
    ("tower_theme_ocean.png", 256, 256,
     "an underwater palace with coral pillars, bioluminescent sea creatures, blue-green ethereal light, sunken temple, fantasy RPG environment, painterly art",
     False),
    ("tower_theme_temple.png", 256, 256,
     "an ancient sacred temple with golden Buddha statues, incense smoke, warm candlelight, korean Buddhist temple interior, fantasy RPG environment, painterly art",
     False),
    ("tower_theme_demon.png", 256, 256,
     "a hellish demon realm with lava rivers, dark obsidian pillars, red sky with falling embers, infernal atmosphere, fantasy RPG environment, painterly art",
     False),
    ("tower_theme_dragon.png", 256, 256,
     "a dragon's lair with massive treasure hoard, dragon bones scattered, volcanic heat, molten gold rivers, epic fantasy RPG environment, painterly art",
     False),

    # 층 티어 아이콘 (1~5)
    ("tier_1.png", 128, 128,
     "a bronze shield with number 1 emblem, tier 1 rank icon, simple clean fantasy RPG icon, white background",
     True),
    ("tier_2.png", 128, 128,
     "a silver shield with number 2 emblem, tier 2 rank icon, simple clean fantasy RPG icon, white background",
     True),
    ("tier_3.png", 128, 128,
     "a gold shield with number 3 emblem, tier 3 rank icon, simple clean fantasy RPG icon, white background",
     True),
    ("tier_4.png", 128, 128,
     "a platinum shield with number 4 emblem, tier 4 rank icon, glowing aura, fantasy RPG icon, white background",
     True),
    ("tier_5.png", 128, 128,
     "a diamond shield with number 5 emblem, tier 5 rank icon, radiant sparkle, fantasy RPG icon, white background",
     True),

    # ========== 정령의 시련 (Elemental) ==========
    # 메인 이미지
    ("elemental_bg.png", 512, 512,
     "a mystical elemental altar surrounded by swirling fire water earth and wind energy, four elemental orbs floating, ancient stone circle, fantasy RPG background, vibrant magical colors",
     False),
    ("elemental_card.png", 512, 256,
     "wide view of elemental trial arena, four elemental pillars of fire water earth wind, magical energy converging at center, fantasy RPG card art, panoramic composition",
     False),
    ("elemental_banner.png", 512, 128,
     "horizontal banner showing elemental spirits of fire water earth wind in a row, colorful magical energy, fantasy RPG banner art, wide panoramic",
     False),
    ("elemental_icon.png", 256, 256,
     "four elemental orbs (fire red, water blue, earth brown, wind green) arranged in a circle, elemental trial icon, fantasy RPG UI icon, clean design",
     True),

    # 속성별 배경/아이콘
    ("elem_fire_bg.png", 512, 512,
     "a blazing fire elemental arena, volcanic ground with lava cracks, fire spirits dancing, intense orange and red flames, fantasy RPG battle background",
     False),
    ("elem_fire_icon.png", 128, 128,
     "a flame icon, burning fire elemental symbol, red and orange, simple clean fantasy RPG icon, white background",
     True),
    ("elem_water_bg.png", 512, 512,
     "an underwater elemental arena, deep blue ocean floor with glowing coral, water spirits swirling, bubbles and bioluminescence, fantasy RPG battle background",
     False),
    ("elem_water_icon.png", 128, 128,
     "a water droplet icon, blue water elemental symbol, crystalline and flowing, simple clean fantasy RPG icon, white background",
     True),
    ("elem_earth_bg.png", 512, 512,
     "an earthen elemental arena, massive stone pillars rising from ground, crystalline formations, brown and green earth energy, fantasy RPG battle background",
     False),
    ("elem_earth_icon.png", 128, 128,
     "a brown rock crystal icon, earth elemental symbol, solid and geometric, simple clean fantasy RPG icon, white background",
     True),
    ("elem_wind_bg.png", 512, 512,
     "a sky elemental arena floating in clouds, swirling wind currents with green energy, tornado pillars, ethereal atmosphere, fantasy RPG battle background",
     False),
    ("elem_wind_icon.png", 128, 128,
     "a green swirl icon, wind elemental symbol, flowing and dynamic, simple clean fantasy RPG icon, white background",
     True),

    # 정령 시련 UI
    ("elem_altar.png", 256, 256,
     "an ancient elemental altar stone with glowing runes, magical energy rising, four elemental gems embedded, fantasy RPG object illustration, clean background",
     True),
    ("elem_complete.png", 256, 256,
     "a radiant elemental crystal trophy, four colored lights merging into one brilliant orb, trial completion icon, fantasy RPG achievement, clean background",
     True),
    ("elem_popup_bg.png", 512, 512,
     "mystical elemental void background, swirling colorful magical energy (fire red, water blue, earth brown, wind green), blurred suitable for overlay popup, fantasy RPG UI background",
     False),
    ("elem_progress_orb.png", 128, 128,
     "a glowing magical orb with swirling elemental energy inside, progress indicator, fantasy RPG UI icon, clean design, dark background",
     True),

    # 시련 티어별 아이콘
    ("elem_tier_1.png", 128, 128,
     "a small dim elemental crystal, beginner tier, simple clean fantasy RPG icon, faint glow, white background",
     True),
    ("elem_tier_2.png", 128, 128,
     "a medium glowing elemental crystal, intermediate tier, brighter light, fantasy RPG icon, white background",
     True),
    ("elem_tier_3.png", 128, 128,
     "a large brilliant elemental crystal, advanced tier, strong magical glow, fantasy RPG icon, white background",
     True),
    ("elem_tier_4.png", 128, 128,
     "a radiant elemental crystal with aura, heroic tier, intense magical energy, fantasy RPG icon, white background",
     True),
    ("elem_tier_5.png", 128, 128,
     "a legendary elemental crystal with cosmic energy, maximum tier, overwhelming power, fantasy RPG icon, white background",
     True),

    # ========== 보스 토벌전 (Boss Raid) ==========
    # 메인 이미지
    ("boss_raid_bg.png", 512, 512,
     "a dark ominous boss arena, massive demon throne in background, blood-red sky, cracked obsidian floor with glowing lava veins, fantasy RPG boss battle background, epic and terrifying",
     False),
    ("boss_raid_card.png", 512, 256,
     "wide view of a massive boss arena with towering demon silhouettes, red lightning, destruction and chaos, fantasy RPG card art, panoramic epic composition",
     False),
    ("boss_raid_banner.png", 512, 128,
     "horizontal banner showing silhouettes of powerful boss monsters in a row, menacing red eyes, dark threatening atmosphere, fantasy RPG banner art, wide panoramic",
     False),
    ("boss_raid_icon.png", 256, 256,
     "a menacing skull with crossed swords behind it, boss raid icon, red glowing eyes, dark and dangerous, fantasy RPG UI icon, clean design",
     True),

    # 보스 개별 이미지 (6 보스)
    ("boss_1.png", 256, 256,
     "a massive slime king monster, giant green gelatinous creature with a golden crown, slimy tentacles, fantasy RPG boss monster, painterly illustration, dark background",
     True),
    ("boss_2.png", 256, 256,
     "a gigantic stone golem king, massive rocky body with glowing crystal core, towering ancient earth guardian, fantasy RPG boss monster, painterly illustration, dark background",
     True),
    ("boss_3.png", 256, 256,
     "a fearsome goblin warlord, large muscular goblin with an enormous iron mace, war paint and tribal armor, fantasy RPG boss monster, painterly illustration, dark background",
     True),
    ("boss_4.png", 256, 256,
     "a terrifying wraith lord, ghostly spectral figure with flowing dark robes, glowing purple curse runes, mountain spirit, fantasy RPG boss monster, painterly illustration, dark background",
     True),
    ("boss_5.png", 256, 256,
     "a powerful demon king, massive horned devil with dark wings and flaming sword, overwhelming dark aura, lord of demons, fantasy RPG boss monster, painterly illustration, dark background",
     True),
    ("boss_6.png", 256, 256,
     "an ancient elder dragon, colossal golden dragon with multiple horns, scales gleaming with magical energy, final boss ultimate power, fantasy RPG boss monster, painterly illustration, dark background",
     True),

    # 보스 토벌전 UI
    ("br_arena.png", 512, 512,
     "a grand boss battle arena, circular fighting pit with spectator stands, magical barrier walls, dramatic lighting from above, fantasy RPG battle arena, painterly art",
     False),
    ("br_complete.png", 256, 256,
     "a bloody sword planted in defeated boss skull, victory over boss emblem, dark heroic achievement icon, fantasy RPG, clean background",
     True),
    ("br_popup_bg.png", 512, 512,
     "dark menacing boss raid background, silhouette of massive monster, red glowing atmosphere, blurred suitable for overlay popup, fantasy RPG UI background",
     False),
    ("br_stat_kills.png", 128, 128,
     "a tally mark counter on parchment, boss kill count stat icon, simple fantasy RPG icon, clean design",
     True),
    ("br_stat_streak.png", 128, 128,
     "a flame streak icon showing consecutive victories, win streak stat, glowing orange fire, fantasy RPG icon, clean design",
     True),

    # 보스 씬 배경 (6개)
    ("br_scene_1.png", 512, 512,
     "a damp slimy cave interior, green mucus on walls, slime pools on ground, dark and disgusting atmosphere, slime king lair, fantasy RPG environment",
     False),
    ("br_scene_2.png", 512, 512,
     "a deep underground cavern with massive stone formations, crystal deposits glowing, golem king domain, ancient earth temple, fantasy RPG environment",
     False),
    ("br_scene_3.png", 512, 512,
     "a chaotic goblin fortress interior, crude metal walls and spiked defenses, goblin warlord throne room, war trophies displayed, fantasy RPG environment",
     False),
    ("br_scene_4.png", 512, 512,
     "a haunted mountain summit shrine, ghostly mist, broken torii gates, spectral flames floating, wraith lord domain, korean fantasy RPG environment",
     False),
    ("br_scene_5.png", 512, 512,
     "a hellish demon palace throne room, obsidian pillars, rivers of lava, burning throne of skulls, demon king domain, fantasy RPG environment",
     False),
    ("br_scene_6.png", 512, 512,
     "an enormous dragon's volcanic lair, treasure mountains, dragon bones and scales embedded in walls, molten gold pools, elder dragon domain, fantasy RPG environment",
     False),

    # ========== 공통 ==========
    ("special_map_bg.png", 512, 512,
     "a mystical ancient map showing three special dungeon locations, tower elemental shrine and boss arena marked, parchment style with magical ink, fantasy RPG world map, painterly illustration",
     False),
]

# ============================================================
# 모델 자동 감지
# ============================================================
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

    return unet, clip_t5, clip_l, vae, unet_list, clip_list, vae_list

print("Detecting models...")
UNET_MODEL, CLIP_1, CLIP_2, VAE_MODEL, _ul, _cl, _vl = detect_models()

missing = []
if not UNET_MODEL: missing.append(f"UNET (models/unet/ 비어있음, 목록: {_ul})")
if not CLIP_1: missing.append(f"CLIP T5 (models/clip/ 비어있음, 목록: {_cl})")
if not CLIP_2: missing.append(f"CLIP L (models/clip/ 비어있음, 목록: {_cl})")
if not VAE_MODEL: missing.append(f"VAE (models/vae/ 비어있음, 목록: {_vl})")

if missing:
    print("ERROR: 모델 파일이 없습니다!")
    for m in missing:
        print(f"  - {m}")
    exit(1)

print(f"  UNET: {UNET_MODEL}")
print(f"  CLIP1: {CLIP_1}")
print(f"  CLIP2: {CLIP_2}")
print(f"  VAE: {VAE_MODEL}")

# ============================================================
# ComfyUI API 함수
# ============================================================
def queue_prompt(prompt):
    client_id = str(uuid.uuid4())
    p = {"prompt": prompt, "client_id": client_id}
    data = json.dumps(p).encode('utf-8')
    req = urllib.request.Request(
        f"http://{COMFYUI_URL}/prompt",
        data=data,
        headers={'Content-Type': 'application/json'}
    )
    try:
        result = json.loads(urllib.request.urlopen(req).read())
        return result['prompt_id'], client_id
    except urllib.error.HTTPError as e:
        error_body = e.read().decode('utf-8')
        print(f"  API ERROR {e.code}: {error_body[:500]}")
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
        "1": {
            "class_type": "UNETLoader",
            "inputs": {"unet_name": UNET_MODEL, "weight_dtype": weight_dtype}
        },
        "2": {
            "class_type": "DualCLIPLoader",
            "inputs": {"clip_name1": CLIP_1, "clip_name2": CLIP_2, "type": "flux"}
        },
        "3": {
            "class_type": "CLIPTextEncode",
            "inputs": {"text": prompt_text, "clip": ["2", 0]}
        },
        "4": {
            "class_type": "CLIPTextEncode",
            "inputs": {"text": "", "clip": ["2", 0]}
        },
        "5": {
            "class_type": "EmptySD3LatentImage",
            "inputs": {"width": width, "height": height, "batch_size": 1}
        },
        "6": {
            "class_type": "FluxGuidance",
            "inputs": {"guidance": 3.5, "conditioning": ["3", 0]}
        },
        "7": {
            "class_type": "KSampler",
            "inputs": {
                "model": ["1", 0],
                "positive": ["6", 0],
                "negative": ["4", 0],
                "latent_image": ["5", 0],
                "seed": int(time.time() * 1000) % (2**32),
                "steps": 20,
                "cfg": 1.0,
                "sampler_name": "euler",
                "scheduler": "simple",
                "denoise": 1.0
            }
        },
        "8": {
            "class_type": "VAELoader",
            "inputs": {"vae_name": VAE_MODEL}
        },
        "9": {
            "class_type": "VAEDecode",
            "inputs": {"samples": ["7", 0], "vae": ["8", 0]}
        },
        "10": {
            "class_type": "SaveImage",
            "inputs": {"images": ["9", 0], "filename_prefix": "special_dungeon"}
        }
    }

    prompt_id, client_id = queue_prompt(workflow)
    wait_for_completion(prompt_id, client_id)

    history = get_history(prompt_id)
    if prompt_id not in history:
        print(f"  WARN: prompt_id not in history")
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
# 메인 처리
# ============================================================
def process_image(filename, gen_w, gen_h, prompt, nobg):
    out_path = os.path.join(OUT_DIR, filename)
    print(f"\n[{filename}] {gen_w}x{gen_h} nobg={nobg}")
    print(f"  prompt: {prompt[:80]}...")

    full_prompt = STYLE_PREFIX + prompt
    img = generate_image(full_prompt, gen_w, gen_h)
    if img is None:
        print(f"  FAILED: 이미지 생성 실패")
        return False

    # 원본 저장
    img.save(out_path)
    print(f"  [ORIG] saved {out_path}")

    # 배경 제거 (아이콘류)
    if nobg and HAS_REMBG:
        try:
            img_rgba = rembg_remove(img)
            nobg_path = os.path.join(OUT_NOBG, filename)
            img_rgba.save(nobg_path)
            print(f"  [NOBG] saved {nobg_path}")
        except Exception as e:
            print(f"  [NOBG] error: {e}")

    return True

if __name__ == "__main__":
    total = len(IMAGES)
    success = 0
    fail = 0
    t0 = time.time()

    print(f"\n=== 스페셜 던전 이미지 생성 시작: {total}개 ===\n")

    for i, (filename, w, h, prompt, nobg) in enumerate(IMAGES):
        print(f"\n--- [{i+1}/{total}] ---")
        try:
            if process_image(filename, w, h, prompt, nobg):
                success += 1
            else:
                fail += 1
        except Exception as e:
            print(f"  ERROR: {e}")
            fail += 1

    elapsed = time.time() - t0
    print(f"\n=== 완료: {success}/{total} 성공, {fail} 실패 ({elapsed:.1f}초) ===")
