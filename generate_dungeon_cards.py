import torch
from diffusers import AutoPipelineForText2Image
import os
import time

DUNGEON_DIR = "F:/project/game/client/public/dungeons"
os.makedirs(DUNGEON_DIR, exist_ok=True)

print("Loading SDXL-Turbo model...")
pipe = AutoPipelineForText2Image.from_pretrained(
    "stabilityai/sdxl-turbo",
    torch_dtype=torch.float16,
    variant="fp16"
)
pipe = pipe.to("cuda")
print("Model loaded!")

def generate_image(prompt, output_path, w=512, h=512):
    if os.path.exists(output_path):
        print(f"  SKIP (exists): {output_path}")
        return
    try:
        result = pipe(
            prompt=prompt,
            num_inference_steps=4,
            guidance_scale=0.0,
            width=w,
            height=h,
        )
        result.images[0].save(output_path)
        fsize = os.path.getsize(output_path) / 1024
        print(f"  OK: {output_path} ({fsize:.0f}KB)")
    except Exception as e:
        print(f"  ERROR: {output_path} - {e}")

dungeons = [
    {"id": "forest", "name": "어둠의 숲",
     "prompt": "a dark enchanted forest at twilight, twisted ancient trees, glowing mushrooms on the ground, "
               "misty atmosphere, fireflies, mysterious path leading deeper, Korean fantasy RPG, "
               "dark green and purple tones, atmospheric fog, fantasy game environment"},
    {"id": "cave", "name": "지하 동굴",
     "prompt": "a deep underground cave with stalactites and stalagmites, crystal formations glowing blue, "
               "underground river, torch light on stone walls, dark mysterious atmosphere, "
               "Korean fantasy RPG dungeon, digital painting, atmospheric lighting"},
    {"id": "temple", "name": "폐허 사원",
     "prompt": "a ruined ancient Korean temple, crumbling stone pillars, overgrown with dark vines, "
               "cursed purple aura, broken Buddha statues, eerie moonlight through collapsed roof, "
               "Korean fantasy RPG dungeon, dark and ominous atmosphere, digital painting"},
    {"id": "swamp", "name": "독안개 늪",
     "prompt": "a poisonous misty swamp, green toxic fog, dead trees rising from murky water, "
               "glowing poisonous plants, bubbling mud pools, dark and eerie atmosphere, "
               "Korean fantasy RPG dungeon, sickly green and dark tones, digital painting"},
    {"id": "mountain", "name": "영혼의 산",
     "prompt": "a tall haunted mountain peak, ghostly spirits floating around, ancient stone path winding up, "
               "dramatic clouds, lightning in distance, Korean shrine at summit, snow-capped peaks, "
               "Korean fantasy RPG dungeon, blue and white ghostly tones, digital painting"},
    {"id": "demon", "name": "마계 균열",
     "prompt": "a demonic dimensional rift, cracked ground with lava flowing beneath, dark portal with red energy, "
               "floating rock fragments, hellfire and brimstone, demonic runes glowing, "
               "Korean fantasy RPG dungeon, red and black infernal tones, digital painting"},
    {"id": "dragon", "name": "용의 둥지",
     "prompt": "a massive dragon's volcanic lair, huge cavern with dragon bones and treasure hoards, "
               "lava rivers flowing, ancient dragon scales on ground, massive stone pillars, "
               "Korean fantasy RPG dungeon, orange and red volcanic tones, epic scale, digital painting"},
    {"id": "ocean", "name": "해저 유적",
     "prompt": "an underwater ancient ruins, sunken Korean palace with coral growth, schools of fish swimming, "
               "bioluminescent jellyfish providing light, broken stone columns underwater, "
               "Korean fantasy RPG dungeon, deep blue and teal oceanic tones, digital painting"},
    {"id": "goblin", "name": "도깨비 마을",
     "prompt": "a goblin dokkaebi village with crude wooden huts, hanging lanterns with fire, "
               "totem poles with scary faces, scattered treasures and clubs, mischievous atmosphere, "
               "Korean fantasy RPG dungeon, warm orange and brown tones, digital painting"},
    {"id": "spirit_forest", "name": "정령의 숲",
     "prompt": "an enchanted spirit forest with elemental spirits floating among ancient trees, "
               "glowing orbs of different colors (fire, water, earth, wind), magical runes on tree bark, "
               "ethereal rainbow light beams, Korean fantasy RPG dungeon, mystical colorful tones, digital painting"},
    {"id": "slime_cave", "name": "슬라임 동굴",
     "prompt": "a cave filled with colorful slimes, sticky translucent slime creatures on walls and ceiling, "
               "dripping slime puddles glowing in different colors, gooey atmosphere, "
               "Korean fantasy RPG dungeon, colorful and slimy textures, digital painting"},
]

if __name__ == "__main__":
    start = time.time()

    # 던전 배경 이미지 (와이드 카드)
    print(f"\n=== Generating {len(dungeons)} dungeon card images ===")
    for d in dungeons:
        generate_image(
            f"Korean fantasy RPG game art, {d['prompt']}, wide landscape view, detailed environment, game background art",
            f"{DUNGEON_DIR}/{d['id']}_card.png", w=512, h=320
        )

    # 없는 아이콘/배경 생성
    missing = ["temple", "spirit_forest"]
    print(f"\n=== Generating missing icon/bg images ===")
    for d in dungeons:
        if d["id"] in missing:
            generate_image(
                f"Korean fantasy RPG game art, {d['prompt']}, icon style, centered, dark background",
                f"{DUNGEON_DIR}/{d['id']}_icon.png", w=256, h=256
            )
            generate_image(
                f"Korean fantasy RPG game art, {d['prompt']}, wide panoramic view",
                f"{DUNGEON_DIR}/{d['id']}_bg.png", w=512, h=512
            )

    # 던전 월드맵 배경
    print("\n=== Generating dungeon world map background ===")
    generate_image(
        "Korean fantasy RPG world map, dark parchment style, ancient map with mountain ranges, forests, "
        "rivers and oceans drawn in ink, compass rose, mysterious locations marked with glowing dots, "
        "weathered edges, burned paper texture, dark atmospheric, wide landscape, digital painting",
        f"{DUNGEON_DIR}/dungeon_map_bg.png", w=1024, h=512
    )

    elapsed = time.time() - start
    print(f"\n=== Done! Total time: {elapsed:.1f} seconds ===")
