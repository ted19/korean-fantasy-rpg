"""
스테이지 레벨 이미지 생성 - ComfyUI API + Flux.1-dev
- stages/levels/{zone}_{n}.png (512x512) - 각 zone별 레벨 배경
- 30개 zone × 10~15 레벨 = 321장

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
OUT_DIR = "F:/project/game/client/public/stages/levels"
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
        "10": {"class_type": "SaveImage", "inputs": {"images": ["9", 0], "filename_prefix": "stage_level"}}
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
    "fantasy game battle arena, Akihiko Yoshida style, tactics ogre style, "
    "japanese fantasy RPG battlefield illustration, "
    "atmospheric, detailed environment, no characters"
)

# ============================================================
# Zone 데이터: (key, max_level, base_theme, level별 변형 키워드)
# ============================================================
ZONES = {
    # === 한국 ===
    "gojoseon": {
        "max": 10,
        "base": "ancient Korean Gojoseon era, bronze age, dolmen stones, primitive forest",
        "levels": {
            1: "forest entrance with stone dolmens and morning mist",
            2: "bamboo grove path with ancient stone markers",
            3: "tribal village outskirts with thatched huts",
            4: "river crossing with wooden bridge and rapids",
            5: "hill fortress with wooden palisade walls",
            6: "sacred altar clearing with bronze ritual vessels",
            7: "dark cave entrance with bear claw marks",
            8: "mountain pass with harsh wind and snow",
            9: "ancient temple ruins with crumbling pillars",
            10: "throne of Dangun, massive stone altar on mountain peak, boss arena",
        }
    },
    "samhan": {
        "max": 10,
        "base": "ancient Korean Samhan confederacy, iron age settlements, rice paddies",
        "levels": {
            1: "rice paddy fields at dawn with morning fog",
            2: "iron smelting workshop with sparks and flames",
            3: "market crossroads with merchant wagons",
            4: "wooden watchtower overlooking vast plains",
            5: "burial mound field with ancient tombs",
            6: "riverside dock with fishing boats",
            7: "fortified village with earthen walls",
            8: "dark marshland with reeds and fog",
            9: "mountain fortress gate with iron reinforcements",
            10: "war council hall with tribal banners, boss arena",
        }
    },
    "goguryeo": {
        "max": 12,
        "base": "Korean Goguryeo kingdom, mountain fortress, warrior culture",
        "levels": {
            1: "border watchtower at mountain pass",
            2: "military training ground with archery targets",
            3: "stone fortress outer wall with siege marks",
            4: "armory hall with weapon racks and war drums",
            5: "underground tunnel network with torches",
            6: "cliff side bridge between two mountain peaks",
            7: "frozen river battlefield in winter",
            8: "burning village after enemy raid",
            9: "ancient tomb of fallen warriors with murals",
            10: "grand fortress inner court with war banners",
            11: "throne room corridor with guardian statues",
            12: "king's war chamber on mountain peak, boss arena",
        }
    },
    "baekje": {
        "max": 10,
        "base": "Korean Baekje kingdom, elegant architecture, riverside culture",
        "levels": {
            1: "riverbank with lotus flowers and gentle waves",
            2: "artisan workshop with pottery and silk",
            3: "pagoda garden with cherry blossoms",
            4: "merchant harbor with trading ships",
            5: "Buddhist temple with golden Buddha statue",
            6: "royal garden with ornamental pond",
            7: "palace corridor with painted murals",
            8: "moonlit bridge over calm river",
            9: "defensive wall under siege with fire arrows",
            10: "royal throne hall with golden decorations, boss arena",
        }
    },
    "silla": {
        "max": 12,
        "base": "Korean Silla dynasty, golden crown culture, Gyeongju landscape",
        "levels": {
            1: "stone pagoda field at sunrise",
            2: "Hwarang warrior training dojo",
            3: "observatory tower under starry sky",
            4: "golden crown workshop with jewels",
            5: "bamboo forest with moonlight filtering through",
            6: "ancient bell tower with massive bronze bell",
            7: "underwater tomb entrance with water reflections",
            8: "mountain temple on misty peak",
            9: "royal hunting ground with autumn leaves",
            10: "grand palace with golden roof tiles",
            11: "dragon pond with mystical fog",
            12: "Silla golden throne room with crown display, boss arena",
        }
    },
    "balhae": {
        "max": 10,
        "base": "Korean Balhae kingdom, northern frontier, Manchurian landscape",
        "levels": {
            1: "snowy frontier outpost with pine trees",
            2: "frozen lake with ice fishing holes",
            3: "northern trading post with fur merchants",
            4: "timber fortress in dense forest",
            5: "hot spring valley with steam rising",
            6: "wolf den cave in snowy mountains",
            7: "military camp on frozen plains",
            8: "border wall with northern barbarian marks",
            9: "abandoned northern palace in snowstorm",
            10: "Balhae throne hall with tiger pelts and war trophies, boss arena",
        }
    },
    "goryeo": {
        "max": 13,
        "base": "Korean Goryeo dynasty, Buddhist culture, celadon ceramics",
        "levels": {
            1: "celadon kiln workshop with green pottery",
            2: "Buddhist monastery entrance with stone lanterns",
            3: "printing workshop with woodblock press",
            4: "mountain hermitage in autumn forest",
            5: "port city with merchant ships from afar",
            6: "palace library with ancient scrolls",
            7: "military garrison defending against Mongol invasion",
            8: "burning temple under siege",
            9: "underground vault with hidden treasures",
            10: "royal court with silk curtains and incense",
            11: "night battle on fortress walls with torches",
            12: "haunted abandoned temple with ghosts",
            13: "Goryeo palace throne room with Buddhist relics, boss arena",
        }
    },
    "joseon": {
        "max": 14,
        "base": "Korean Joseon dynasty, Confucian culture, hanok architecture",
        "levels": {
            1: "village school (seodang) with studying scholars",
            2: "marketplace with colorful lanterns",
            3: "hanok village street at dusk",
            4: "royal examination hall with scholars",
            5: "secret garden with pavilion and pond",
            6: "fortress gate with guardian soldiers",
            7: "spy hideout in thatched roof tavern",
            8: "naval dock with turtle ship",
            9: "mountain temple with tiger painting",
            10: "palace courtyard with stone haetae guardians",
            11: "underground secret passage with cobwebs",
            12: "burning palace during coup at night",
            13: "royal library with forbidden books",
            14: "Joseon grand throne hall Geunjeongjeon style, boss arena",
        }
    },
    "imjin": {
        "max": 15,
        "base": "Imjin War (Japanese invasion of Korea 1592), wartime devastation",
        "levels": {
            1: "coastal village burning from naval bombardment",
            2: "refugee camp in mountain valley",
            3: "guerrilla hideout in bamboo forest",
            4: "destroyed castle wall with siege ladders",
            5: "naval battlefield with turtle ships and fire",
            6: "supply depot under enemy attack",
            7: "bridge crossing under arrow rain",
            8: "night raid on enemy camp with torches",
            9: "mountain fortress defense with cannons",
            10: "devastated capital city with smoke",
            11: "riverside ambush with hidden archers",
            12: "temple converted to field hospital",
            13: "final naval battle with burning ships",
            14: "recaptured fortress with Korean flag raised",
            15: "victory celebration at war-torn palace, boss arena",
        }
    },
    "modern": {
        "max": 15,
        "base": "modern Korean city with fantasy elements, neon and traditional mix",
        "levels": {
            1: "subway station with flickering lights and shadows",
            2: "rooftop of skyscraper overlooking city at night",
            3: "traditional market street with neon signs",
            4: "abandoned school hallway with ghostly presence",
            5: "underground parking garage with dimensional rift",
            6: "han river bridge at twilight",
            7: "palace grounds at night with supernatural fog",
            8: "construction site with demonic portal",
            9: "mountain temple surrounded by modern city",
            10: "ancient gate emerging through modern street",
            11: "district alley with spirit world bleeding through",
            12: "skyscraper rooftop ritual circle at midnight",
            13: "collision of old palace and modern city",
            14: "dimensional rift over city skyline",
            15: "final battle arena atop Seoul tower with energy vortex, boss arena",
        }
    },
    # === 일본 ===
    "jomon": {
        "max": 10,
        "base": "ancient Japanese Jomon period, pit dwellings, cord-marked pottery, primeval forest",
        "levels": {
            1: "coastal shell mound with morning tide",
            2: "pit dwelling village with smoke rising",
            3: "deep forest with ancient cedar trees",
            4: "river valley with fishing weirs",
            5: "stone circle ritual ground",
            6: "volcanic hillside with obsidian deposits",
            7: "sacred cave with Jomon pottery offerings",
            8: "coastal cliff overlooking stormy sea",
            9: "dense bamboo grove with hidden paths",
            10: "great stone circle altar under aurora, boss arena",
        }
    },
    "yayoi": {
        "max": 10,
        "base": "Japanese Yayoi period, rice agriculture, bronze bells, moated settlements",
        "levels": {
            1: "flooded rice paddy at planting season",
            2: "moated settlement with wooden palisade",
            3: "bronze bell casting workshop",
            4: "granary storehouse on stilts",
            5: "iron forge with glowing coals",
            6: "market gathering at river crossing",
            7: "burial jar field at sunset",
            8: "watchtower during tribal conflict",
            9: "flooded battlefield in rice fields",
            10: "great chieftain's hall with bronze mirrors, boss arena",
        }
    },
    "yamato": {
        "max": 10,
        "base": "Japanese Yamato period, kofun burial mounds, early Shinto shrines",
        "levels": {
            1: "torii gate entrance to sacred forest",
            2: "keyhole-shaped kofun burial mound",
            3: "Shinto shrine with sacred rope shimenawa",
            4: "imperial court with silk curtains",
            5: "horseback warrior training field",
            6: "cliffside shrine overlooking the sea",
            7: "ancient tomb interior with haniwa statues",
            8: "sacred waterfall purification site",
            9: "battlefield with mounted warriors and banners",
            10: "great Yamato imperial palace, boss arena",
        }
    },
    "nara": {
        "max": 10,
        "base": "Japanese Nara period, great Buddhist temples, deer park",
        "levels": {
            1: "deer park with gentle morning light",
            2: "five-story wooden pagoda",
            3: "great Buddha hall interior with incense",
            4: "monk's meditation garden with raked sand",
            5: "sutra copying hall with candlelight",
            6: "temple bell tower at sunset",
            7: "sacred deer forest at twilight",
            8: "underground temple vault with relics",
            9: "mountain hermitage with autumn maple",
            10: "great Nara Buddha throne room with golden light, boss arena",
        }
    },
    "heian": {
        "max": 10,
        "base": "Japanese Heian period, aristocratic culture, elegant pavilions, moon-viewing",
        "levels": {
            1: "cherry blossom garden with aristocrats",
            2: "moon-viewing pavilion over pond",
            3: "ox-cart procession on Kyoto street",
            4: "incense competition hall",
            5: "poetry contest in autumn garden",
            6: "demon gate of the capital (Rashomon)",
            7: "shrine maiden ritual at night",
            8: "bamboo curtain palace room with shadows",
            9: "bridge of dreams over misty river",
            10: "Heian imperial palace inner sanctum, boss arena",
        }
    },
    "kamakura": {
        "max": 10,
        "base": "Japanese Kamakura period, samurai government, great Buddha, Zen Buddhism",
        "levels": {
            1: "samurai mansion with bamboo fence",
            2: "great bronze Buddha statue",
            3: "Zen temple rock garden",
            4: "sword smith forge with flying sparks",
            5: "coastal cliff with crashing waves",
            6: "horseback archery (yabusame) training ground",
            7: "Mongol invasion beach defense",
            8: "mountain pass ambush with fog",
            9: "burning harbor with enemy ships",
            10: "shogun's castle throne room, boss arena",
        }
    },
    "muromachi": {
        "max": 10,
        "base": "Japanese Muromachi period, golden and silver pavilions, Noh theater, ink painting",
        "levels": {
            1: "golden pavilion (Kinkakuji) reflected in pond",
            2: "Noh theater stage with pine tree backdrop",
            3: "tea ceremony room with tatami",
            4: "ink painting landscape come to life",
            5: "silver pavilion garden in moonlight",
            6: "merchant district with sake breweries",
            7: "pirate harbor with Japanese ships",
            8: "mountain monastery with warrior monks",
            9: "civil war battlefield with fallen banners",
            10: "shogun's golden hall at twilight, boss arena",
        }
    },
    "sengoku": {
        "max": 10,
        "base": "Japanese Sengoku period, warring states, castles under siege, samurai battles",
        "levels": {
            1: "burning farmland with fleeing peasants",
            2: "castle town under siege with ladders",
            3: "ninja hideout in mountain cave",
            4: "river ford battle with cavalry",
            5: "matchlock rifle firing line",
            6: "night castle infiltration",
            7: "mountain fortress snow battle",
            8: "burning castle tower collapsing",
            9: "decisive battle on open field with thousands",
            10: "warlord's castle keep throne room, boss arena",
        }
    },
    "edo": {
        "max": 10,
        "base": "Japanese Edo period, peaceful castle town, merchant culture, ukiyo-e style",
        "levels": {
            1: "Edo castle town morning market",
            2: "samurai district with cherry trees",
            3: "kabuki theater with colorful stage",
            4: "floating world pleasure quarter at night",
            5: "daimyo procession on highway",
            6: "Mount Fuji viewed from rice fields",
            7: "bathhouse (sento) district with steam",
            8: "shrine festival with paper lanterns",
            9: "ronin alley confrontation at dusk",
            10: "Edo castle inner palace, boss arena",
        }
    },
    "meiji": {
        "max": 10,
        "base": "Japanese Meiji era, westernization, steam technology, brick buildings",
        "levels": {
            1: "train station with steam locomotive",
            2: "brick government building with gas lamps",
            3: "newspaper office with printing press",
            4: "military academy with western uniforms",
            5: "harbor with ironclad warships",
            6: "telegraph office with wires and poles",
            7: "western-style ballroom with chandeliers",
            8: "battlefield with modern artillery",
            9: "industrial factory with smokestacks",
            10: "imperial palace blending East and West, boss arena",
        }
    },
    # === 중국 ===
    "xia_shang": {
        "max": 10,
        "base": "ancient Chinese Xia-Shang dynasty, bronze ritual vessels, oracle bones, Yellow River",
        "levels": {
            1: "Yellow River bank with reed marshes",
            2: "oracle bone divination tent with fire",
            3: "bronze casting foundry with molten metal",
            4: "sacrificial altar with jade offerings",
            5: "rammed earth palace walls",
            6: "chariot workshop with war horses",
            7: "turtle shell oracle reading chamber",
            8: "underground royal tomb with bronze vessels",
            9: "great flood devastation along river",
            10: "Shang dynasty bronze throne hall, boss arena",
        }
    },
    "zhou": {
        "max": 10,
        "base": "Chinese Zhou dynasty, Confucian academy, bronze chariots, feudal states",
        "levels": {
            1: "Confucian academy with bamboo scrolls",
            2: "bronze chariot training ground",
            3: "feudal lord's walled city gate",
            4: "marketplace with jade merchants",
            5: "archery contest field",
            6: "philosopher's garden debate pavilion",
            7: "iron foundry with new technology",
            8: "city wall defense against invasion",
            9: "burning state capital during war",
            10: "Son of Heaven's mandate hall, boss arena",
        }
    },
    "qin": {
        "max": 10,
        "base": "Chinese Qin dynasty, Great Wall, terracotta warriors, legalist empire",
        "levels": {
            1: "Great Wall construction site with laborers",
            2: "terracotta warrior workshop",
            3: "book burning pit with flames",
            4: "legalist court with strict officials",
            5: "mercury river underground chamber",
            6: "crossbow squad firing range",
            7: "road construction through mountain",
            8: "palace treasury with jade seals",
            9: "underground terracotta army vault",
            10: "First Emperor's throne room with dragon pillars, boss arena",
        }
    },
    "han": {
        "max": 10,
        "base": "Chinese Han dynasty, Silk Road, scholarly culture, grand architecture",
        "levels": {
            1: "Silk Road caravan oasis with camels",
            2: "paper making workshop",
            3: "imperial examination hall",
            4: "astronomical observatory with armillary sphere",
            5: "banquet hall with acrobats performing",
            6: "border fortress against Xiongnu",
            7: "lacquerware workshop with red and gold",
            8: "jade burial suit tomb",
            9: "grand court assembly with hundreds",
            10: "Han dynasty dragon throne room, boss arena",
        }
    },
    "three_kingdoms": {
        "max": 10,
        "base": "Chinese Three Kingdoms period, warring factions, legendary warriors",
        "levels": {
            1: "peach garden oath with three warriors",
            2: "Red Cliffs burning warships on river",
            3: "straw boat borrowing arrows in fog",
            4: "mountain pass ambush with boulders",
            5: "siege tower attacking castle walls",
            6: "night raid on enemy camp",
            7: "strategist tent with war maps",
            8: "bridge standoff with single warrior",
            9: "burning supply depot",
            10: "emperor's dragon throne room with faction banners, boss arena",
        }
    },
    "tang": {
        "max": 10,
        "base": "Chinese Tang dynasty, golden age, cosmopolitan Chang'an, poetry and art",
        "levels": {
            1: "Chang'an city gate with diverse merchants",
            2: "poetry pavilion by lotus pond",
            3: "silk weaving workshop with looms",
            4: "Buddhist cave temple with murals",
            5: "horse polo field at imperial court",
            6: "foreign quarter with Persian merchants",
            7: "empress's palace garden at night",
            8: "border military camp with fire signals",
            9: "great pagoda with scrolling dragon carvings",
            10: "Tang dynasty golden palace throne room, boss arena",
        }
    },
    "song": {
        "max": 10,
        "base": "Chinese Song dynasty, riverside market, scholar painting, gunpowder era",
        "levels": {
            1: "riverside market with bridge and boats",
            2: "porcelain kiln with blue and white pottery",
            3: "movable type printing workshop",
            4: "scholar painting studio with ink landscape",
            5: "gunpowder fireworks festival at night",
            6: "compass navigation on merchant ship",
            7: "tea house with scholar gathering",
            8: "city wall with early cannon defense",
            9: "night market with thousands of lanterns",
            10: "Song dynasty elegant painted throne room, boss arena",
        }
    },
    "yuan": {
        "max": 10,
        "base": "Chinese Yuan dynasty, Mongol rule, mixed culture, vast empire",
        "levels": {
            1: "Mongol yurt camp on grassland steppe",
            2: "horse archer training on vast plains",
            3: "grand khan's hunting ground with eagles",
            4: "Marco Polo's caravan at palace gate",
            5: "mixed architecture Chinese-Mongol palace",
            6: "wrestling tournament arena",
            7: "siege of Chinese city with trebuchets",
            8: "northern ice battlefield with cavalry",
            9: "palace coup in torch-lit corridor",
            10: "Great Khan's throne room with world map, boss arena",
        }
    },
    "ming": {
        "max": 10,
        "base": "Chinese Ming dynasty, Forbidden City, treasure fleets, Great Wall restoration",
        "levels": {
            1: "Forbidden City southern gate at dawn",
            2: "treasure fleet shipyard with massive junks",
            3: "imperial garden with dragon wall",
            4: "Great Wall watchtower at sunset",
            5: "martial arts tournament arena",
            6: "eunuch spy network secret room",
            7: "treasure vault with porcelain and gold",
            8: "naval battle against Japanese pirates",
            9: "midnight palace assassination attempt",
            10: "Ming dynasty Forbidden City throne hall, boss arena",
        }
    },
    "qing": {
        "max": 10,
        "base": "Chinese Qing dynasty, last empire, Manchurian court, decline and fall",
        "levels": {
            1: "Manchurian banner army parade ground",
            2: "Summer Palace lakeside pavilion",
            3: "opium den in port city",
            4: "treaty port with foreign concessions",
            5: "imperial court with queue hairstyle officials",
            6: "Taiping rebellion battlefield",
            7: "Boxer uprising temple fortress",
            8: "burning Summer Palace with foreign soldiers",
            9: "last emperor's lonely throne room",
            10: "Qing dynasty fall - crumbling palace with revolution fires, boss arena",
        }
    },
}

# ============================================================
# 이미지 처리
# ============================================================
def process_level(zone_key, level_num, base_theme, level_desc):
    prompt = PROMPT_LEVEL.format(desc=f"{level_desc}, {base_theme}")

    try:
        img = generate_image(prompt, width=512, height=512)
        if img is None:
            print(f"  ERROR: no image returned")
            return False
    except Exception as e:
        print(f"  ERROR: {e}")
        return False

    img.save(os.path.join(OUT_DIR, f"{zone_key}_{level_num}.png"))
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
    for zone_key, zone_data in ZONES.items():
        base = zone_data["base"]
        for lvl_num, lvl_desc in zone_data["levels"].items():
            tasks.append((zone_key, lvl_num, base, lvl_desc))

    start = time.time()
    total = len(tasks)
    success = 0
    fail = 0

    print(f"\n{'='*60}")
    print(f"ComfyUI + Flux.1-dev Stage Level Generation")
    print(f"Model: {UNET_MODEL}")
    print(f"Total: {total} level images (30 zones)")
    print(f"Style: Tactics Ogre / Akihiko Yoshida")
    print(f"{'='*60}\n")

    for i, (zone_key, lvl_num, base, lvl_desc) in enumerate(tasks):
        print(f"[{i+1}/{total}] {zone_key} stage {lvl_num}")
        if process_level(zone_key, lvl_num, base, lvl_desc):
            success += 1
        else:
            fail += 1

    elapsed = time.time() - start
    print(f"\n{'='*60}")
    print(f"Done! {success}/{total} ok, {fail} failed")
    print(f"Time: {elapsed/60:.1f} min")
    print(f"{'='*60}")
