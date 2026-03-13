"""
UI 이미지 생성 - ComfyUI API + Flux.1-dev
- client/public/ui/ 하위 전체 UI 이미지 재생성
- 각 이미지별 적절한 크기와 프롬프트 지정

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
BASE_DIR = "F:/project/game/client/public/ui"

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
        "10": {"class_type": "SaveImage", "inputs": {"images": ["9", 0], "filename_prefix": "ui"}}
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
                    return Image.open(io.BytesIO(img_bytes)).convert('RGBA' if HAS_REMBG else 'RGB')
    return None

# ============================================================
# 공통 스타일 접두어
# ============================================================
STYLE_PREFIX = "pixel art SRPG, Akihiko Yoshida style, tactics ogre style, japanese fantasy RPG illustration, "

# ============================================================
# UI 이미지 목록: (상대경로, 생성크기(w,h), 최종크기(w,h), 프롬프트, nobg여부)
# 모든 prompt에 STYLE_PREFIX가 자동 추가됨
# ============================================================
UI_IMAGES = [
    # === 배경 이미지 ===
    ("login_bg.png", 512, 512, 256, 256,
     "dark fantasy castle gate at night, mystical fog, moonlight, game login screen background, atmospheric", False),
    ("register_bg.png", 512, 512, 256, 256,
     "ancient temple courtyard at dawn, cherry blossoms, mystical atmosphere, game registration background", False),
    ("charsel_bg.png", 512, 512, 512, 512,
     "mystical  shrine interior with three glowing pedestals, character selection screen, dark fantasy atmosphere", False),
    ("home_banner.png", 512, 256, 512, 128,
     " fantasy RPG ornate banner with dragon motifs and golden trim, dark navy background, decorative header", False),
    ("victory_bg.png", 512, 512, 512, 512,
     "golden light rays bursting from center, victory celebration, sparkles and stars, triumphant atmosphere, dark background", False),
    ("defeat_bg.png", 512, 512, 512, 512,
     "dark red fog and shattered weapons, defeat screen, somber atmosphere, cracked ground, dark background", False),
    ("session_expired_bg.png", 512, 512, 256, 256,
     "broken hourglass with sand flowing, expired session, fading portal, dark mystical background", False),

    # === 아이콘 ===
    ("game_logo.png", 512, 512, 256, 256,
     " fantasy RPG game logo emblem, dragon and phoenix intertwined, golden ornate frame, dark background", True),
    ("gold_coin.png", 512, 512, 64, 64,
     "single shiny gold coin with  dragon emblem, game currency icon, white background", True),
    ("exp_icon.png", 512, 512, 64, 64,
     "glowing blue star experience point icon, RPG game UI, white background", True),
    ("hp_icon.png", 512, 512, 64, 64,
     "red heart health point icon, RPG game UI, glossy, white background", True),
    ("mp_icon.png", 512, 512, 64, 64,
     "blue water droplet mana point icon, RPG game UI, glossy, white background", True),
    ("reward_chest.png", 512, 512, 128, 128,
     "ornate golden treasure chest with gems overflowing, RPG reward icon, white background", True),
    ("levelup_effect.png", 512, 512, 128, 128,
     "golden level up arrow with sparkles and light rays, RPG level up effect icon, white background", True),
    ("logout_icon.png", 512, 512, 64, 64,
     "exit door icon with arrow pointing out, game UI logout button, simple clean design, white background", True),

    # === 장비 슬롯 아이콘 ===
    ("slot_weapon.png", 512, 512, 64, 64,
     "crossed swords equipment slot icon, empty weapon slot, dark ornate frame, game UI", True),
    ("slot_chest.png", 512, 512, 64, 64,
     "chest armor silhouette equipment slot icon, empty armor slot, dark ornate frame, game UI", True),
    ("slot_helmet.png", 512, 512, 64, 64,
     "helmet silhouette equipment slot icon, empty helmet slot, dark ornate frame, game UI", True),
    ("slot_boots.png", 512, 512, 64, 64,
     "boots silhouette equipment slot icon, empty boots slot, dark ornate frame, game UI", True),
    ("slot_shield.png", 512, 512, 64, 64,
     "shield silhouette equipment slot icon, empty shield slot, dark ornate frame, game UI", True),
    ("slot_ring.png", 512, 512, 64, 64,
     "ring silhouette equipment slot icon, empty ring slot, dark ornate frame, game UI", True),
    ("slot_necklace.png", 512, 512, 64, 64,
     "necklace silhouette equipment slot icon, empty necklace slot, dark ornate frame, game UI", True),

    # === 네비게이션 아이콘 ===
    ("nav_bg.png", 512, 256, 512, 64,
     "dark navy ornate navigation bar with golden trim border, game UI header, seamless pattern", False),
    ("nav_home.png", 512, 512, 64, 64,
     " traditional house hanok icon, home button, game UI navigation, white background", True),
    ("nav_village.png", 512, 512, 64, 64,
     " village with shops icon, village button, game UI navigation, white background", True),
    ("nav_stage.png", 512, 512, 64, 64,
     "crossed swords battle icon, stage battle button, game UI navigation, white background", True),
    ("nav_dungeon.png", 512, 512, 64, 64,
     "dark cave entrance dungeon icon, dungeon button, game UI navigation, white background", True),
    ("nav_special.png", 512, 512, 64, 64,
     "glowing tower with star icon, special dungeon button, game UI navigation, white background", True),
    ("nav_bestiary.png", 512, 512, 64, 64,
     "open book with monster silhouette, bestiary button, game UI navigation, white background", True),
    ("nav_charswitch.png", 512, 512, 64, 64,
     "two person silhouettes with swap arrows, character switch button, game UI, white background", True),

    # === 탭/배너 아이콘 ===
    ("tab_character_icon.png", 512, 512, 64, 64,
     "warrior character portrait icon, character tab, game UI, white background", True),
    ("tab_equipment_icon.png", 512, 512, 64, 64,
     "sword and shield equipment icon, equipment tab, game UI, white background", True),
    ("tab_equipment_banner.png", 512, 256, 512, 128,
     "ornate equipment display banner with weapons and armor, dark fantasy style, game UI header", False),
    ("tab_equipment_bestiary.png", 512, 512, 64, 64,
     "equipment catalog book icon, equipment bestiary tab, game UI, white background", True),
    ("tab_formation_icon.png", 512, 512, 64, 64,
     "3x3 grid formation icon with unit dots, formation tab, game UI, white background", True),
    ("tab_formation_banner.png", 512, 256, 512, 128,
     "tactical formation display with grid and warriors, dark fantasy banner, game UI header", False),
    ("tab_summon_icon.png", 512, 512, 64, 64,
     "magical summoning circle icon, summon tab, game UI, white background", True),
    ("tab_summon_banner.png", 512, 256, 512, 128,
     "mystical summoning altar with glowing spirits, dark fantasy banner, game UI header", False),
    ("tab_mercenary_icon.png", 512, 512, 64, 64,
     "mercenary soldier with sword icon, mercenary tab, game UI, white background", True),
    ("tab_monster_bestiary.png", 512, 512, 64, 64,
     "monster encyclopedia book with claw marks, monster bestiary tab, game UI, white background", True),
    ("bestiary_banner.png", 512, 256, 512, 128,
     "monster bestiary encyclopedia banner with creature silhouettes, dark fantasy header, game UI", False),

    # === 패널 배경 ===
    ("equip_panel_bg.png", 512, 512, 256, 256,
     "dark leather texture panel background with metal rivets border, RPG equipment panel, game UI", False),
    ("inventory_bg.png", 512, 512, 256, 256,
     "dark wooden chest interior texture, RPG inventory panel background, game UI", False),
    ("formation_grid_bg.png", 512, 512, 256, 256,
     "tactical grid background with subtle squares, dark stone floor, formation panel, game UI", False),
    ("formation_required_bg.png", 512, 512, 256, 256,
     "locked formation panel with chain and padlock icon, dark background, game UI", False),
    ("guide_fairy_portrait.png", 512, 512, 256, 256,
     "cute fairy guide character with glowing wings,  fantasy style, helpful expression, white background", True),
    ("guide_fairy_banner.png", 512, 256, 512, 128,
     "fairy guide speech bubble banner with sparkles, tutorial banner, game UI", False),
    ("skill_reset_bg.png", 512, 512, 256, 256,
     "mystical skill reset altar with swirling energy, dark purple background, game UI panel", False),
    ("skill_reset_icon.png", 512, 512, 64, 64,
     "circular arrow reset icon with magical sparkles, skill reset button, game UI, white background", True),

    # === 전투 UI (battle/) ===
    ("battle/battle_bg.png", 512, 512, 512, 512,
     "dark fantasy battlefield panorama with dramatic sky, SRPG battle background, atmospheric", False),
    ("battle/header_bg.png", 512, 256, 512, 64,
     "dark ornate battle HUD header bar with metallic trim, game battle UI, seamless", False),
    ("battle/action_panel_bg.png", 512, 256, 256, 128,
     "dark stone action panel background with ornate border, RPG battle action menu, game UI", False),
    ("battle/action_attack.png", 512, 512, 64, 64,
     "sword slash attack action icon, red glow, RPG battle button, white background", True),
    ("battle/action_guard.png", 512, 512, 64, 64,
     "raised shield guard defense action icon, blue glow, RPG battle button, white background", True),
    ("battle/action_skill.png", 512, 512, 64, 64,
     "magical spell casting skill action icon, purple glow, RPG battle button, white background", True),
    ("battle/action_wait.png", 512, 512, 64, 64,
     "hourglass wait action icon, yellow glow, RPG battle button, white background", True),
    ("battle/action_retreat.png", 512, 512, 64, 64,
     "running away retreat action icon, green arrow, RPG battle button, white background", True),
    ("battle/turnbar_bg.png", 512, 256, 512, 32,
     "dark metallic turn order bar background with ornate edges, SRPG battle UI, seamless horizontal", False),
    ("battle/round_badge.png", 512, 512, 64, 64,
     "golden round counter badge with number, battle round indicator, game UI, white background", True),
    ("battle/vs_emblem.png", 512, 512, 128, 128,
     "VS versus emblem with crossed swords, battle versus screen icon, dramatic, white background", True),
    ("battle/log_bg.png", 512, 512, 256, 256,
     "dark parchment scroll battle log background, aged paper texture, RPG battle log panel", False),
    ("battle/stamina_empty_bg.png", 512, 512, 256, 256,
     "exhausted warrior silhouette with empty stamina bar, dark red warning background, game UI", False),
    ("battle/stamina_empty_icon.png", 512, 512, 64, 64,
     "empty battery stamina depleted icon, red warning, game UI, white background", True),

    # === 전투 - 후퇴 UI ===
    ("battle/retreat_bg.png", 512, 512, 256, 256,
     "misty escape route through dark forest, retreat screen background, atmospheric", False),
    ("battle/retreat_banner.png", 512, 256, 512, 128,
     "retreat decision banner with running warrior silhouette, dark fantasy, game UI", False),
    ("battle/retreat_emblem.png", 512, 512, 128, 128,
     "retreat emblem with running figure and shield, game UI icon, white background", True),
    ("battle/retreat_gauge_frame.png", 512, 256, 256, 32,
     "ornate progress gauge frame bar with metallic border, retreat gauge, game UI", False),
    ("battle/retreat_success_bg.png", 512, 512, 256, 256,
     "safe forest clearing with sunlight, successful retreat background, relief atmosphere", False),
    ("battle/retreat_success_icon.png", 512, 512, 64, 64,
     "green checkmark with running figure, retreat success icon, game UI, white background", True),
    ("battle/retreat_fail_bg.png", 512, 512, 256, 256,
     "surrounded by enemies in dark, failed retreat background, ominous atmosphere", False),
    ("battle/retreat_fail_icon.png", 512, 512, 64, 64,
     "red X mark with trapped figure, retreat failed icon, game UI, white background", True),

    # === 전투 - 재개 UI ===
    ("battle/resume_bg.png", 512, 512, 256, 256,
     "paused battlefield with frozen warriors, battle resume screen background, dramatic", False),
    ("battle/resume_banner.png", 512, 256, 512, 128,
     "battle resume decision banner with sword and pause icon, dark fantasy, game UI", False),
    ("battle/resume_swords.png", 512, 512, 128, 128,
     "two crossed swords with pause symbol, battle resume emblem, white background", True),
    ("battle/resume_return_icon.png", 512, 512, 64, 64,
     "play button arrow with sword, return to battle icon, game UI, white background", True),
    ("battle/resume_abandon_icon.png", 512, 512, 64, 64,
     "broken sword with X mark, abandon battle icon, game UI, white background", True),
    ("battle/resume_penalty.png", 512, 512, 64, 64,
     "skull with down arrow penalty icon, abandon penalty warning, game UI, white background", True),

    # === 전투 - 피로도 UI ===
    ("battle/fatigue_bg.png", 512, 512, 256, 256,
     "exhausted warrior kneeling with fatigue aura, dark tired atmosphere, game UI background", False),
    ("battle/fatigue_icon.png", 512, 512, 64, 64,
     "tired face with sweat drop fatigue icon, stamina warning, game UI, white background", True),

    # === 크롤러 배틀 UI (battle/cwb_) ===
    ("battle/cwb_viewport_bg.png", 512, 512, 512, 512,
     "dark stone dungeon viewport frame with ornate border, crawler battle main view, game UI", False),
    ("battle/cwb_action_bar.png", 512, 256, 512, 64,
     "dark metallic action bar with button slots, crawler battle bottom bar, game UI", False),
    ("battle/cwb_party_bar.png", 512, 256, 256, 128,
     "dark wooden party member list panel, crawler battle party bar, game UI", False),
    ("battle/cwb_floor.png", 512, 512, 128, 128,
     "stone dungeon floor tile texture, dark grey cobblestone, crawler battle floor, game UI", False),
    ("battle/cwb_pillar_left.png", 512, 512, 64, 256,
     "dark stone dungeon pillar with torch, left side crawler battle decoration, game UI", False),
    ("battle/cwb_inspect_bg.png", 512, 512, 256, 256,
     "dark parchment inspect panel background with ornate border, crawler battle info panel", False),
    ("battle/cwb_inspect_icon.png", 512, 512, 64, 64,
     "magnifying glass inspect icon, crawler battle examine button, game UI, white background", True),
    ("battle/cwb_target_icon.png", 512, 512, 64, 64,
     "crosshair target reticle icon, crawler battle target selector, game UI, white background", True),
    ("battle/cwb_victory_bg.png", 512, 512, 256, 256,
     "golden treasure room victory, crawler battle victory screen, warm golden light", False),
    ("battle/cwb_defeat_bg.png", 512, 512, 256, 256,
     "dark collapsed dungeon defeat, crawler battle defeat screen, rubble and dust", False),

    # === 던전 크롤러 UI (dungeon/) ===
    ("dungeon/dc_corridor_bg.png", 512, 512, 512, 512,
     "first-person view dark stone dungeon corridor, torch-lit walls, dungeon crawler perspective", False),
    ("dungeon/dc_wall_front.png", 512, 512, 256, 256,
     "stone dungeon wall front face texture, grey bricks with moss, dungeon crawler wall", False),
    ("dungeon/dc_wall_side.png", 512, 512, 128, 256,
     "stone dungeon wall side perspective, receding into distance, dungeon crawler side wall", False),
    ("dungeon/dc_floor.png", 512, 512, 256, 256,
     "dark stone floor tile texture, cobblestone dungeon floor, dungeon crawler ground", False),
    ("dungeon/dc_ceiling.png", 512, 512, 256, 256,
     "dark stone ceiling with wooden beams, cobweb corners, dungeon crawler ceiling", False),
    ("dungeon/dc_minimap_frame.png", 512, 512, 128, 128,
     "ornate golden minimap frame border, dark interior, dungeon crawler minimap, game UI", False),
    ("dungeon/dc_compass.png", 512, 512, 64, 64,
     "golden compass rose with N S E W markers, dungeon crawler direction indicator, white background", True),
    ("dungeon/dc_controls_bg.png", 512, 256, 256, 64,
     "dark metallic control panel background, dungeon crawler movement buttons bar, game UI", False),
    ("dungeon/dc_info_bg.png", 512, 512, 256, 128,
     "dark parchment info panel with ornate border, dungeon crawler information display", False),
    ("dungeon/dc_log_bg.png", 512, 512, 256, 128,
     "dark scroll log panel background, dungeon crawler message log, aged paper texture", False),
    ("dungeon/dc_encounter_bg.png", 512, 512, 256, 256,
     "dramatic monster encounter flash, red warning glow, dungeon crawler random encounter alert", False),
    ("dungeon/dc_monster_close.png", 512, 512, 256, 256,
     "dark monster silhouette close up in dungeon corridor, menacing eyes glowing, encounter near", False),
    ("dungeon/dc_monster_distant.png", 512, 512, 256, 256,
     "small dark monster silhouette far away in dungeon corridor, distant encounter, barely visible", False),
    ("dungeon/dc_treasure.png", 512, 512, 128, 128,
     "glowing treasure chest in dungeon corridor, golden light, dungeon crawler loot, white background", True),
    ("dungeon/dc_exit.png", 512, 512, 128, 128,
     "bright light exit doorway in dark dungeon, stairway leading up, dungeon crawler exit", False),
]

# ============================================================
# 이미지 처리
# ============================================================
def process_ui_image(rel_path, gen_w, gen_h, final_w, final_h, prompt, nobg):
    out_path = os.path.join(BASE_DIR, rel_path)
    os.makedirs(os.path.dirname(out_path), exist_ok=True)

    try:
        full_prompt = STYLE_PREFIX + prompt
        img = generate_image(full_prompt, width=gen_w, height=gen_h)
        if img is None:
            print(f"  ERROR: no image returned")
            return False
    except Exception as e:
        print(f"  ERROR: {e}")
        return False

    # 배경 제거 (아이콘류)
    if nobg and HAS_REMBG:
        try:
            img = img.convert('RGB')
            img = rembg_remove(img)
        except Exception as e:
            print(f"  WARN rembg: {e}")

    # 최종 크기로 리사이즈
    if img.size != (final_w, final_h):
        img = img.resize((final_w, final_h), Image.LANCZOS)

    img.save(out_path)
    print(f"  saved ({final_w}x{final_h})")
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
    total = len(UI_IMAGES)
    success = 0
    fail = 0

    print(f"\n{'='*60}")
    print(f"ComfyUI + Flux.1-dev UI Image Generation")
    print(f"Model: {UNET_MODEL}")
    print(f"Total: {total} UI images")
    print(f"{'='*60}\n")

    for i, (rel_path, gen_w, gen_h, final_w, final_h, prompt, nobg) in enumerate(UI_IMAGES):
        print(f"[{i+1}/{total}] {rel_path}")
        if process_ui_image(rel_path, gen_w, gen_h, final_w, final_h, prompt, nobg):
            success += 1
        else:
            fail += 1

    elapsed = time.time() - start
    print(f"\n{'='*60}")
    print(f"Done! {success}/{total} ok, {fail} failed")
    print(f"Time: {elapsed/60:.1f} min")
    print(f"{'='*60}")
