"""
던전 레벨 이미지 생성 - ComfyUI API + Flux.1-dev
- dungeons/levels/{key}_{n}.png (512x512)
- 26개 던전 × 10 레벨 = 260장

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

COMFYUI_URL = "127.0.0.1:8188"
OUT_DIR = "F:/project/game/client/public/dungeons/levels"
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
        "10": {"class_type": "SaveImage", "inputs": {"images": ["9", 0], "filename_prefix": "dungeon_level"}}
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
# 프롬프트
# ============================================================
PROMPT_LEVEL = (
    "{desc}, "
    "fantasy game dungeon battle arena, Akihiko Yoshida style, tactics ogre style, "
    "japanese fantasy RPG dungeon illustration, "
    "atmospheric, dark, dangerous, no characters"
)

# ============================================================
# 던전 레벨 데이터
# ============================================================
DUNGEONS = {
    # === 공통 던전 ===
    "forest": {
        "base": "cursed dark forest, twisted ancient trees, ominous fog",
        "levels": {
            1: "forest entrance with gnarled roots and dim sunlight",
            2: "mushroom clearing with bioluminescent fungi",
            3: "spider web covered path between dead trees",
            4: "ancient tree hollow with glowing sap",
            5: "foggy river crossing with rotting bridge",
            6: "wolf den clearing with scattered bones",
            7: "corrupted grove with black oozing trees",
            8: "enchanted clearing with floating fireflies",
            9: "massive hollow trunk cavern with roots",
            10: "heart of the cursed forest, giant evil tree boss arena",
        }
    },
    "cave": {
        "base": "deep underground cave, stalactites, crystal formations",
        "levels": {
            1: "cave entrance with daylight fading behind",
            2: "narrow tunnel with dripping water and moss",
            3: "underground stream with stepping stones",
            4: "crystal cavern with glowing blue minerals",
            5: "bat colony ceiling with guano floor",
            6: "lava fissure with orange glow from below",
            7: "underground lake with bioluminescent algae",
            8: "collapsed tunnel with rubble and dust",
            9: "massive cavern with ancient mining equipment",
            10: "deepest chamber with giant crystal formation boss arena",
        }
    },
    "temple": {
        "base": "ruined ancient evil temple, broken pillars, purple magic",
        "levels": {
            1: "temple entrance with crumbling stone stairs",
            2: "prayer hall with overturned pews and candles",
            3: "library with floating cursed books",
            4: "sacrificial altar room with blood stains",
            5: "underground crypt with open coffins",
            6: "bell tower with cracked massive bell",
            7: "mirror hall with distorted reflections",
            8: "forbidden sanctum with glowing runes on walls",
            9: "collapsing corridor with falling debris",
            10: "inner sanctum with dark god statue boss arena",
        }
    },
    "swamp": {
        "base": "poisonous misty swamp, purple fog, dead trees, toxic pools",
        "levels": {
            1: "swamp edge with warning signs and dead birds",
            2: "muddy path between toxic purple puddles",
            3: "sunken graveyard with tilted tombstones",
            4: "giant lily pad crossing over deep water",
            5: "abandoned witch hut on stilts",
            6: "quicksand field with skeleton hands reaching out",
            7: "poisonous flower garden with hypnotic pollen",
            8: "flooded ruins half submerged in murk",
            9: "gas vent field with explosive fumes",
            10: "swamp heart with massive toxic whirlpool boss arena",
        }
    },
    "mountain": {
        "base": "haunted spirit mountain, ghostly fog, spectral lights",
        "levels": {
            1: "mountain trail entrance with spirit ward stones",
            2: "rocky switchback path with howling wind",
            3: "abandoned hermit cave with prayer beads",
            4: "cliff face with narrow ledge and abyss below",
            5: "waterfall grotto with rainbow mist",
            6: "frozen peak with ice-covered rocks",
            7: "wind-carved stone arch bridge",
            8: "ghost shrine with floating spirit lanterns",
            9: "avalanche zone with unstable snow",
            10: "mountain summit with storm clouds boss arena",
        }
    },
    "demon": {
        "base": "dimensional rift to demon realm, blood-red sky, hellfire",
        "levels": {
            1: "rift entrance with reality tearing apart",
            2: "floating rock platforms over void",
            3: "river of souls with wailing faces",
            4: "bone bridge over lake of fire",
            5: "demon market with caged souls",
            6: "flesh walls corridor pulsing with veins",
            7: "inverted castle hanging from sky",
            8: "arena of torment with chains and spikes",
            9: "throne approach with demon generals",
            10: "demon king's throne room with hellfire pillars boss arena",
        }
    },
    "dragon": {
        "base": "volcanic dragon lair, lava rivers, dragon bones, molten gold",
        "levels": {
            1: "volcanic cave entrance with heat shimmer",
            2: "obsidian tunnel with lava veins in walls",
            3: "dragon egg chamber with warm nests",
            4: "treasure hoard room with gold coins mountains",
            5: "lava river crossing with stone pillars",
            6: "dragon skeleton bridge over magma",
            7: "crystal formation cave with dragon scales",
            8: "volcanic vent chamber with erupting geysers",
            9: "ancient dragon graveyard with massive skulls",
            10: "dragon king's volcanic throne with lava falls boss arena",
        }
    },
    "ocean": {
        "base": "sunken underwater ruins, coral pillars, bioluminescent sea",
        "levels": {
            1: "shallow reef entrance with sunlight filtering through water",
            2: "coral garden with colorful sea anemones",
            3: "sunken ship graveyard with treasure chests",
            4: "jellyfish forest with glowing tendrils",
            5: "underwater cave with air pockets",
            6: "giant clam field with pearl formations",
            7: "deep trench descent into darkness",
            8: "ancient underwater temple with barnacles",
            9: "whirlpool vortex near ocean floor",
            10: "abyssal throne room with kraken tentacles boss arena",
        }
    },
    "goblin": {
        "base": "chaotic dokkaebi goblin village, stolen treasures, magic totems",
        "levels": {
            1: "goblin outpost with crude wooden fence",
            2: "mushroom farm tended by small goblins",
            3: "stolen goods warehouse with piled loot",
            4: "goblin kitchen with bubbling cauldrons",
            5: "trap-filled corridor with spring mechanisms",
            6: "arena pit where goblins fight for fun",
            7: "shaman hut with floating magic clubs",
            8: "treasury vault with enchanted locks",
            9: "throne approach with elite goblin guards",
            10: "goblin king's treasure throne room boss arena",
        }
    },
    "spirit_forest": {
        "base": "elemental spirit forest, fire water earth wind energy streams",
        "levels": {
            1: "spirit forest entrance with four colored lights",
            2: "water spirit grove with floating droplets",
            3: "fire spirit clearing with dancing flames",
            4: "earth spirit garden with living stone",
            5: "wind spirit meadow with swirling leaves",
            6: "mixed element convergence point",
            7: "crystal tree grove absorbing all elements",
            8: "spirit fountain with rainbow energy",
            9: "elemental storm zone with clashing powers",
            10: "spirit king's throne of four elements boss arena",
        }
    },
    "slime_cave": {
        "base": "crystal cave with colorful slimes, luminous walls, gelatinous pools",
        "levels": {
            1: "cave mouth with green slime puddles",
            2: "blue crystal corridor with water slimes",
            3: "red heated chamber with fire slimes",
            4: "purple toxic section with poison slimes",
            5: "silver metallic vein room with metal slimes",
            6: "rainbow crystal chamber with prismatic light",
            7: "massive slime pool bubbling and merging",
            8: "crystal garden with slime-encased gems",
            9: "dark slime nest with pulsing darkness",
            10: "king slime throne crystal cathedral boss arena",
        }
    },
    # === 한국 던전 ===
    "kr_forest": {
        "base": "Korean mythical forest, jangseung totems, dokkaebi lanterns, ink-wash style",
        "levels": {
            1: "forest entrance with jangseung totem poles",
            2: "bamboo grove with dokkaebi lantern lights",
            3: "fox trail with nine-tailed gumiho paw prints",
            4: "sacred tree with shaman ribbons tied to branches",
            5: "moonlit clearing with haetae stone guardian",
            6: "misty valley with floating ghost lights",
            7: "ancient dolmen circle with ritual marks",
            8: "corrupted shrine with dark energy vines",
            9: "imoogi serpent cave near waterfall",
            10: "mountain god sansin's sacred grove boss arena",
        }
    },
    "kr_mountain": {
        "base": "Korean sacred mountain, Sacheonwang guardians, stone warriors, stormy peak",
        "levels": {
            1: "mountain gate with guardian warrior statues",
            2: "stone stairway with prayer flag poles",
            3: "waterfall cliff with rainbow mist",
            4: "hermit cave with meditation cushions",
            5: "pine forest ridge with wind howling",
            6: "frozen peak with ice-covered Buddha statue",
            7: "thunder cloud path with lightning strikes",
            8: "warrior training ground with stone dummies",
            9: "sacred peak shrine with spirit energy",
            10: "mountain summit tiger god shrine boss arena",
        }
    },
    "kr_temple": {
        "base": "fallen Korean Buddhist temple, cursed bronze bell, vengeful spirits",
        "levels": {
            1: "temple gate with broken Inwang guardian statues",
            2: "courtyard with fallen stone lanterns",
            3: "main hall with toppled golden Buddha",
            4: "bell pavilion with cracked bronze bell",
            5: "sutra storage with burning scrolls",
            6: "underground ossuary with monk remains",
            7: "corrupted meditation hall with dark aura",
            8: "painting gallery with murals coming alive",
            9: "pagoda interior with cursed relics",
            10: "inner sanctum with possessed Sacheonwang boss arena",
        }
    },
    "kr_swamp": {
        "base": "cursed Korean swamp Jangjamot, water ghosts, imoogi serpent",
        "levels": {
            1: "swamp entrance with warning jangseung poles",
            2: "muddy path with sinking footprints",
            3: "ghost lantern marsh with floating blue lights",
            4: "sunken village rooftops poking from water",
            5: "centipede nest in rotting logs",
            6: "water ghost pool with reaching hands",
            7: "poison fog valley with dead fish",
            8: "imoogi scale trail through deep mud",
            9: "cursed well with endless depth",
            10: "imoogi serpent's underwater lair boss arena",
        }
    },
    "kr_spirit": {
        "base": "Korean spirit realm boundary, path to afterlife, Yeomra gate",
        "levels": {
            1: "boundary gate between worlds with flickering reality",
            2: "soul lantern path with floating white orbs",
            3: "hwangcheon river crossing with ferry boat",
            4: "judgment waiting hall with anxious spirits",
            5: "mirror of sins reflecting past lives",
            6: "ten courts of hell with punishment scenes",
            7: "reincarnation wheel chamber spinning slowly",
            8: "forgotten souls graveyard with nameless stones",
            9: "Yeomra's corridor with ox-head guards",
            10: "Yeomra King's judgment throne boss arena",
        }
    },
    # === 일본 던전 ===
    "jp_forest": {
        "base": "Japanese Aokigahara dark forest, yokai, kodama tree spirits",
        "levels": {
            1: "moss-covered torii gate entrance in dense forest",
            2: "bamboo maze with rustling unseen creatures",
            3: "sacred rope shimenawa around cursed tree",
            4: "fox shrine clearing with kitsune statues",
            5: "deep canopy darkness with no sunlight",
            6: "kodama tree spirit hollow with glowing eyes",
            7: "kitsune fox fire path with floating flames",
            8: "twilight yokai gathering in misty glade",
            9: "corrupted sacred tree with dark miasma",
            10: "jorogumo spider queen web-covered grove boss arena",
        }
    },
    "jp_mountain": {
        "base": "Japanese Mount Ooe, tengu warriors, yamabushi, thunder peak",
        "levels": {
            1: "mountain trail with red torii gates line",
            2: "yamabushi training waterfall with cold water",
            3: "cloud bridge between twin peaks",
            4: "tengu nest on ancient pine tree",
            5: "stone stairway with karasu-tengu feathers",
            6: "thunder shrine crackling with electricity",
            7: "wind tunnel passage with cutting gusts",
            8: "warrior monk dojo on cliff edge",
            9: "storm cloud arena with lightning pillars",
            10: "great tengu king's mountain throne boss arena",
        }
    },
    "jp_temple": {
        "base": "abandoned Japanese shrine, oni masks, cursed statues, fox fire",
        "levels": {
            1: "broken torii gate entrance with fox fire",
            2: "offering hall with scattered coins and sake",
            3: "oni mask corridor with glowing eyes",
            4: "cursed mirror room with wrong reflections",
            5: "incense hall with choking purple smoke",
            6: "possessed Kannon statue with cracking stone",
            7: "underground ritual chamber with blood circle",
            8: "haunted tower with spinning prayer wheels",
            9: "demon gate opening with chains breaking",
            10: "oni king's shrine inner sanctum boss arena",
        }
    },
    "jp_ocean": {
        "base": "Japanese dragon palace Ryugu underwater, kappa, mermaids",
        "levels": {
            1: "coastal cave entrance descending underwater",
            2: "kappa river pool with cucumber offerings",
            3: "coral reef tunnel with glowing fish",
            4: "ningyo mermaid grotto with pearl strings",
            5: "sunken ship with funayurei ghost sailors",
            6: "giant shell palace gate with sea guards",
            7: "jellyfish chandelier ballroom",
            8: "underwater volcano vent with hot bubbles",
            9: "treasure vault with Tamatebako box",
            10: "Ryujin dragon king's coral throne boss arena",
        }
    },
    "jp_spirit": {
        "base": "Japanese afterlife, Sanzu River, Enma judgment, shinigami",
        "levels": {
            1: "boundary between life and death, fading colors",
            2: "Sanzu River shallow crossing with cold water",
            3: "clothes-stripping hag Datsueba's tree",
            4: "soul weighing station with ancient scales",
            5: "wandering spirit field with lost ghosts",
            6: "mirror of karma reflecting life deeds",
            7: "eight hot hells with fire and torment",
            8: "eight cold hells with ice and isolation",
            9: "shinigami death god's corridor with scythes",
            10: "Enma great king's judgment hall boss arena",
        }
    },
    # === 중국 던전 ===
    "cn_forest": {
        "base": "Chinese Shanhaijing mythical beast forest, stone guardians, Taoist shrine",
        "levels": {
            1: "stone guardian lion entrance to mythical forest",
            2: "panda bamboo grove with hidden paths",
            3: "Shanhaijing beast territory with strange prints",
            4: "sacred peach tree with glowing fruit",
            5: "hulijing fox spirit cave with illusions",
            6: "medicinal herb garden with rare plants",
            7: "wutong haunted tree with faces in bark",
            8: "earth god shrine with incense smoke",
            9: "thousand-year ancient tree with spirit energy",
            10: "Shanhaijing primordial beast den boss arena",
        }
    },
    "cn_mountain": {
        "base": "Chinese Kunlun sacred mountain, Taoist cultivation, celestial energy",
        "levels": {
            1: "jade gate entrance to immortal mountain",
            2: "cloud stairway ascending through mist",
            3: "alchemy laboratory with bubbling elixirs",
            4: "meditation cliff overlooking sea of clouds",
            5: "Taoist scripture library with flying scrolls",
            6: "peach of immortality orchard",
            7: "celestial crane nesting platform",
            8: "qi cultivation formation with energy circles",
            9: "thunderbolt tribulation platform",
            10: "Kunlun immortal's celestial palace boss arena",
        }
    },
    "cn_temple": {
        "base": "Chinese great temple, Four Heavenly Kings, 500 Arhat, demon pagoda",
        "levels": {
            1: "temple mountain gate with giant incense burner",
            2: "Heavenly King hall with towering statues",
            3: "500 Arhat corridor with glowing golden statues",
            4: "drum and bell tower with resonating sound",
            5: "sutra chanting hall with floating characters",
            6: "underground reliquary with sacred bones",
            7: "pagoda interior spiraling upward",
            8: "demon-sealing chamber with binding talismans",
            9: "rooftop with raging Four Heavenly Kings",
            10: "pagoda pinnacle with demon-sealing formation boss arena",
        }
    },
    "cn_swamp": {
        "base": "Chinese cursed swamp, jiangshi vampires, gu poison, dark rituals",
        "levels": {
            1: "swamp entrance with Taoist warning talismans",
            2: "jiangshi hopping vampire graveyard",
            3: "gu poison insect breeding pit",
            4: "abandoned village with paper money scattered",
            5: "talisman barrier maze with spiritual traps",
            6: "corpse refining altar with dark candles",
            7: "underground gu master's laboratory",
            8: "ghost marriage ceremony ground",
            9: "dark ritual circle with summoning pentagram",
            10: "gu master's throne of poison and death boss arena",
        }
    },
    "cn_spirit": {
        "base": "Chinese underworld Difu, Yama Kings, ox-head horse-face, Meng Po",
        "levels": {
            1: "underworld gate with ox-head and horse-face guards",
            2: "ghost currency bridge toll with paper money",
            3: "first court of Yama with judgment desk",
            4: "mirror of retribution showing past sins",
            5: "tongue-ripping hell with iron hooks",
            6: "mountain of knives with blade-covered peaks",
            7: "cauldron of boiling oil with screaming souls",
            8: "wheel of reincarnation spinning chamber",
            9: "Meng Po's bridge with forgetfulness soup",
            10: "Yan Wang supreme king's throne of judgment boss arena",
        }
    },
}

# ============================================================
# 이미지 처리
# ============================================================
def process_level(key, level_num, base, level_desc):
    prompt = PROMPT_LEVEL.format(desc=f"{level_desc}, {base}")

    try:
        img = generate_image(prompt, width=512, height=512)
        if img is None:
            print(f"  ERROR: no image returned")
            return False
    except Exception as e:
        print(f"  ERROR: {e}")
        return False

    img.save(os.path.join(OUT_DIR, f"{key}_{level_num}.png"))
    print(f"  saved")
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

    # 전체 작업 목록 생성
    tasks = []
    for key, data in DUNGEONS.items():
        base = data["base"]
        for lvl_num, lvl_desc in data["levels"].items():
            tasks.append((key, lvl_num, base, lvl_desc))

    start = time.time()
    total = len(tasks)
    success = 0
    fail = 0

    print(f"\n{'='*60}")
    print(f"ComfyUI + Flux.1-dev Dungeon Level Generation")
    print(f"Model: {UNET_MODEL}")
    print(f"Total: {total} level images (26 dungeons × 10)")
    print(f"Style: Tactics Ogre / Akihiko Yoshida")
    print(f"{'='*60}\n")

    for i, (key, lvl_num, base, lvl_desc) in enumerate(tasks):
        print(f"[{i+1}/{total}] {key} stage {lvl_num}")
        if process_level(key, lvl_num, base, lvl_desc):
            success += 1
        else:
            fail += 1

    elapsed = time.time() - start
    print(f"\n{'='*60}")
    print(f"Done! {success}/{total} ok, {fail} failed")
    print(f"Time: {elapsed/60:.1f} min")
    print(f"{'='*60}")
