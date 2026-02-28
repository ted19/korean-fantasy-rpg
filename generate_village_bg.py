import torch
from diffusers import AutoPipelineForText2Image
import os
import time

VILLAGE_DIR = "F:/project/game/client/public/village"
os.makedirs(VILLAGE_DIR, exist_ok=True)

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

if __name__ == "__main__":
    start = time.time()

    # 마을 전경 배경 (와이드)
    print("Generating village background...")
    generate_image(
        "Korean fantasy RPG village panorama, traditional Korean houses with tiled roofs, stone paths, "
        "lanterns glowing warmly, cherry blossom trees, mountains in background, evening sky with stars, "
        "cozy atmosphere, wooden shop signs, fantasy medieval Korean town, digital painting, vibrant colors, "
        "atmospheric lighting, wide landscape view, detailed environment, game background art",
        f"{VILLAGE_DIR}/village_bg.png", w=1024, h=512
    )

    # 각 건물 큰 이미지 (카드용)
    buildings = [
        {"id": "rest", "name": "여관",
         "prompt": "a cozy Korean traditional inn at night, warm orange lantern glow from windows, wooden sign with inn symbol, "
                   "thatched and tiled roof, welcoming wooden door, small garden, steam rising from chimney, fantasy RPG building, "
                   "detailed architecture, digital painting, vibrant warm colors"},
        {"id": "shop", "name": "상점",
         "prompt": "a Korean fantasy weapon and item shop, wooden storefront with hanging weapons and potions displayed, "
                   "colorful merchant banner, open window showing shelves of goods, lantern lit, fantasy RPG building, "
                   "detailed architecture, digital painting, vibrant colors"},
        {"id": "quest", "name": "길드",
         "prompt": "a Korean fantasy adventurer guild hall, large impressive wooden building, guild emblem banner hanging, "
                   "notice board visible at entrance, torches burning at doorway, warrior statues flanking entrance, "
                   "fantasy RPG building, detailed architecture, digital painting, vibrant colors"},
        {"id": "summon", "name": "소환술사의 집",
         "prompt": "a Korean mystic summoner cottage, mysterious purple and blue magical glow, spirit orbs floating around, "
                   "arcane symbols carved on wooden walls, crystal hanging at entrance, dark mystical atmosphere, "
                   "fantasy RPG building, detailed architecture, digital painting, vibrant colors"},
    ]

    print(f"\nGenerating {len(buildings)} building card images...")
    for b in buildings:
        generate_image(
            f"Korean fantasy RPG game art, {b['prompt']}",
            f"{VILLAGE_DIR}/{b['id']}_card.png", w=512, h=320
        )

    elapsed = time.time() - start
    print(f"\n=== Done! Total time: {elapsed:.1f} seconds ===")
