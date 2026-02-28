import torch
from diffusers import AutoPipelineForText2Image
import os
import time

# 디렉토리 준비
EQUIP_DIR = "F:/project/game/client/public/equipment"
DUNGEON_DIR = "F:/project/game/client/public/dungeons"

os.makedirs(EQUIP_DIR, exist_ok=True)
os.makedirs(DUNGEON_DIR, exist_ok=True)

# SDXL-Turbo 로드
print("Loading SDXL-Turbo model...")
pipe = AutoPipelineForText2Image.from_pretrained(
    "stabilityai/sdxl-turbo",
    torch_dtype=torch.float16,
    variant="fp16"
)
pipe = pipe.to("cuda")
print("Model loaded!")

def generate_image(prompt, output_path, size=256):
    """이미지 생성 및 저장"""
    if os.path.exists(output_path):
        print(f"  SKIP (exists): {output_path}")
        return
    try:
        result = pipe(
            prompt=prompt,
            num_inference_steps=4,
            guidance_scale=0.0,
            width=size,
            height=size,
        )
        result.images[0].save(output_path)
        fsize = os.path.getsize(output_path) / 1024
        print(f"  OK: {output_path} ({fsize:.0f}KB)")
    except Exception as e:
        print(f"  ERROR: {output_path} - {e}")

# ========== 장비 아이템 ==========
equipment = [
    # 무기 - 풍수사 (부적)
    {"id": 1, "name": "낡은 부적", "slot": "weapon",
     "prompt": "a worn paper talisman with faded red ink, Korean mystical symbols, feng shui charm"},
    {"id": 2, "name": "강화 부적", "slot": "weapon",
     "prompt": "an enhanced paper talisman glowing with golden symbols, Korean feng shui magic"},
    {"id": 3, "name": "천상의 부적", "slot": "weapon",
     "prompt": "a divine celestial talisman, radiant gold and blue energy, Korean sacred symbols, legendary"},

    # 무기 - 무당 (방울)
    {"id": 4, "name": "무당 방울", "slot": "weapon",
     "prompt": "a Korean shaman ritual bell, brass with red ribbons, jingling spiritual bell"},
    {"id": 5, "name": "신령 방울", "slot": "weapon",
     "prompt": "a divine spirit bell, glowing silver with ethereal aura, Korean shamanic ritual bell"},
    {"id": 6, "name": "천신 방울", "slot": "weapon",
     "prompt": "a celestial god bell, golden with divine light, Korean heavenly shaman bell, legendary"},

    # 무기 - 승려 (목탁)
    {"id": 7, "name": "나무 목탁", "slot": "weapon",
     "prompt": "a wooden moktak prayer block, simple Buddhist wooden fish, Korean temple"},
    {"id": 8, "name": "청동 목탁", "slot": "weapon",
     "prompt": "a bronze moktak prayer block, ornate Buddhist wooden fish, glowing runes"},
    {"id": 9, "name": "금강 목탁", "slot": "weapon",
     "prompt": "a diamond vajra moktak, golden glowing Buddhist prayer block, divine light, legendary"},

    # 양손무기 - 풍수사/무당 (지팡이)
    {"id": 10, "name": "나무 지팡이", "slot": "weapon",
     "prompt": "a simple wooden staff, gnarled wood, crystal tip, fantasy wizard staff"},
    {"id": 11, "name": "마력 지팡이", "slot": "weapon",
     "prompt": "a magical staff, glowing blue crystal orb on top, arcane energy swirling"},
    {"id": 12, "name": "용의 지팡이", "slot": "weapon",
     "prompt": "a dragon staff, dragon head on top, glowing red eyes, powerful magical staff, legendary"},

    # 양손무기 - 승려 (금강장)
    {"id": 13, "name": "수련 금강장", "slot": "weapon",
     "prompt": "a training vajra spear, Buddhist monk weapon, simple iron tip, wooden shaft"},
    {"id": 14, "name": "파마 금강장", "slot": "weapon",
     "prompt": "a demon-breaking vajra spear, golden glow, Buddhist holy weapon, ornate"},
    {"id": 15, "name": "항마 금강장", "slot": "weapon",
     "prompt": "a demon-subduing vajra spear, blazing golden light, supreme Buddhist holy weapon, legendary"},

    # 갑옷
    {"id": 16, "name": "가죽 갑옷", "slot": "chest",
     "prompt": "a leather chest armor, brown leather with metal studs, fantasy RPG light armor"},
    {"id": 17, "name": "사슬 갑옷", "slot": "chest",
     "prompt": "a chain mail armor, interlocking metal rings, medieval fantasy chain armor"},
    {"id": 18, "name": "용린 갑옷", "slot": "chest",
     "prompt": "a dragon scale armor, iridescent scales, glowing runes, legendary plate armor"},

    # 투구
    {"id": 19, "name": "가죽 투구", "slot": "helmet",
     "prompt": "a leather helmet, simple brown leather head protection, fantasy RPG headgear"},
    {"id": 20, "name": "철제 투구", "slot": "helmet",
     "prompt": "an iron helmet, polished metal helm with nose guard, medieval knight helmet"},
    {"id": 21, "name": "용린 투구", "slot": "helmet",
     "prompt": "a dragon scale helmet, dragon horn ornaments, glowing eyes, legendary helm"},

    # 장화
    {"id": 22, "name": "가죽 장화", "slot": "boots",
     "prompt": "leather boots, brown adventurer boots, worn but sturdy, fantasy RPG footwear"},
    {"id": 23, "name": "철제 장화", "slot": "boots",
     "prompt": "iron greaves boots, metal-plated boots, heavy armor boots, fantasy knight"},
    {"id": 24, "name": "용린 장화", "slot": "boots",
     "prompt": "dragon scale boots, iridescent scale-covered boots, glowing runes, legendary"},

    # 반지
    {"id": 25, "name": "구리 반지", "slot": "ring",
     "prompt": "a simple copper ring, dull bronze band, small gemstone, fantasy RPG ring"},
    {"id": 26, "name": "은반지", "slot": "ring",
     "prompt": "a silver ring, polished silver band, blue gemstone, elegant fantasy ring"},
    {"id": 27, "name": "황금 반지", "slot": "ring",
     "prompt": "a golden ring, ornate gold band, glowing red gemstone, legendary ring, divine"},

    # 목걸이
    {"id": 28, "name": "뼈 목걸이", "slot": "necklace",
     "prompt": "a bone necklace, small animal bones on string, tribal, shamanic pendant"},
    {"id": 29, "name": "비취 목걸이", "slot": "necklace",
     "prompt": "a jade necklace, polished green jade pendant, Korean style, elegant"},
    {"id": 30, "name": "용의눈 목걸이", "slot": "necklace",
     "prompt": "a dragon eye necklace, glowing dragon eye gemstone pendant, golden chain, legendary"},

    # 방패
    {"id": 31, "name": "나무 방패", "slot": "shield",
     "prompt": "a wooden shield, round wooden buckler, iron rim, simple fantasy shield"},
    {"id": 32, "name": "철제 방패", "slot": "shield",
     "prompt": "an iron kite shield, polished metal shield with crest, sturdy fantasy shield"},
    {"id": 33, "name": "용린 방패", "slot": "shield",
     "prompt": "a dragon scale shield, dragon face emblem, glowing runes, legendary tower shield"},

    # 포션
    {"id": 34, "name": "소형 HP 포션", "slot": "potion",
     "prompt": "a small red health potion, glass bottle, glowing red liquid, cork top, RPG item"},
    {"id": 35, "name": "중형 HP 포션", "slot": "potion",
     "prompt": "a medium red health potion, larger glass flask, bright red glowing liquid, RPG item"},
    {"id": 36, "name": "대형 HP 포션", "slot": "potion",
     "prompt": "a large red health potion, big ornate bottle, brilliant red glowing liquid, RPG item"},
    {"id": 37, "name": "소형 MP 포션", "slot": "potion",
     "prompt": "a small blue mana potion, glass bottle, glowing blue liquid, cork top, RPG item"},
    {"id": 38, "name": "중형 MP 포션", "slot": "potion",
     "prompt": "a medium blue mana potion, larger glass flask, bright blue glowing liquid, RPG item"},
    {"id": 39, "name": "대형 MP 포션", "slot": "potion",
     "prompt": "a large blue mana potion, big ornate bottle, brilliant blue glowing liquid, RPG item"},

    # 추가 무기 (활, 검)
    {"id": 40, "name": "사냥꾼의 활", "slot": "weapon",
     "prompt": "a hunter's bow, curved wooden longbow, leather grip, arrow nocked, fantasy ranger weapon"},
    {"id": 41, "name": "무사의 검", "slot": "weapon",
     "prompt": "a warrior's sword, Korean straight sword, ornate handle, sharp blade, martial weapon"},
]

# ========== 던전 ==========
dungeons = [
    {"key": "forest", "name": "어둠의 숲",
     "prompt": "a dark enchanted forest, twisted trees, glowing mushrooms, moonlight filtering through canopy, eerie fog, fantasy RPG dungeon entrance"},
    {"key": "slime_cave", "name": "슬라임 동굴",
     "prompt": "a slimy cave entrance, colorful goo dripping from walls, glowing slime pools, crystal formations, cute but dangerous, fantasy RPG"},
    {"key": "cave", "name": "지하 동굴",
     "prompt": "a deep underground cave, stalactites and stalagmites, dim torch light, rocky tunnels, dark and dangerous, fantasy RPG dungeon"},
    {"key": "swamp", "name": "독안개 늪",
     "prompt": "a poisonous fog swamp, murky green water, dead trees, toxic mist, glowing insects, eerie atmosphere, fantasy RPG"},
    {"key": "goblin", "name": "도깨비 마을",
     "prompt": "a Korean dokkaebi goblin village, lanterns and torches, small huts, mischievous goblins, Korean folklore, fantasy RPG village"},
    {"key": "mountain", "name": "영혼의 산",
     "prompt": "a haunted spirit mountain, floating ghost lights, ancient Korean temple ruins, misty peaks, ethereal glow, fantasy RPG"},
    {"key": "ocean", "name": "해저 유적",
     "prompt": "underwater ancient ruins, sunken temple, coral growing on pillars, bioluminescent fish, deep blue ocean, fantasy RPG"},
    {"key": "demon", "name": "마계 균열",
     "prompt": "a demonic rift portal, cracked earth with lava, hellfire, dark red sky, demon statues, apocalyptic, fantasy RPG"},
    {"key": "dragon", "name": "용의 둥지",
     "prompt": "a dragon's lair nest, massive cave with treasure hoard, dragon eggs, bones, golden coins, epic scale, fantasy RPG"},
]

# === 메인 실행 ===
if __name__ == "__main__":
    start = time.time()
    total = len(equipment) + len(dungeons)
    done = 0

    # 1. 장비 아이콘 생성 (256x256)
    print(f"\n=== Generating {len(equipment)} equipment icons ===")
    for item in equipment:
        done += 1
        prompt = f"Korean fantasy RPG game item icon, {item['prompt']}, single item centered, dark background, clean icon style, digital painting, vibrant colors"
        icon_path = f"{EQUIP_DIR}/{item['id']}_icon.png"
        print(f"[{done}/{total}] {item['name']} (icon)...")
        generate_image(prompt, icon_path, size=256)

    # 2. 던전 이미지 생성 (icon 256 + bg 512)
    print(f"\n=== Generating {len(dungeons)} dungeon images ===")
    for d in dungeons:
        done += 1
        base_prompt = f"Korean fantasy RPG game art, {d['prompt']}, digital painting, vibrant colors, atmospheric lighting"

        icon_path = f"{DUNGEON_DIR}/{d['key']}_icon.png"
        print(f"[{done}/{total}] {d['name']} (icon)...")
        generate_image(base_prompt + ", thumbnail, compact composition", icon_path, size=256)

        bg_path = f"{DUNGEON_DIR}/{d['key']}_bg.png"
        print(f"[{done}/{total}] {d['name']} (bg)...")
        generate_image(base_prompt + ", wide landscape, panoramic, detailed environment", bg_path, size=512)

    elapsed = time.time() - start
    print(f"\n=== Done! Total time: {elapsed/60:.1f} minutes ===")
    print(f"Generated: {len(equipment)} equipment icons, {len(dungeons)} dungeon images (icon + bg)")
