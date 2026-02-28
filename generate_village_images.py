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

def generate_image(prompt, output_path, size=256):
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

village_buildings = [
    {"id": "rest", "name": "여관",
     "prompt": "a cozy Korean traditional inn, warm lantern light, wooden building, thatched roof, welcoming entrance, night time, fantasy RPG village"},
    {"id": "shop", "name": "상점",
     "prompt": "a Korean fantasy item shop, wooden shelves with potions and weapons, merchant counter, hanging lanterns, warm interior, fantasy RPG village"},
    {"id": "quest", "name": "길드",
     "prompt": "a Korean fantasy adventurer guild hall, large wooden building, quest board on wall, warriors gathering, torches and banners, fantasy RPG village"},
    {"id": "summon", "name": "소환술사의 집",
     "prompt": "a Korean mystic summoner house, magical purple glow, spirit orbs floating, mysterious wooden cottage, arcane symbols on walls, fantasy RPG village"},
]

if __name__ == "__main__":
    start = time.time()

    print(f"\n=== Generating {len(village_buildings)} village building images ===")
    for b in village_buildings:
        prompt = f"Korean fantasy RPG game art, {b['prompt']}, digital painting, vibrant colors, atmospheric lighting, dark background"
        icon_path = f"{VILLAGE_DIR}/{b['id']}_icon.png"
        print(f"  {b['name']} (icon)...")
        generate_image(prompt + ", icon style, centered", icon_path, size=256)

    elapsed = time.time() - start
    print(f"\n=== Done! Total time: {elapsed:.1f} seconds ===")
    print(f"Generated: {len(village_buildings)} village building icons")
