import torch
from diffusers import StableDiffusionXLPipeline
from PIL import Image
import numpy as np
import os

OUT_DIR = "F:/project/game/client/public/ui/dungeon"
os.makedirs(OUT_DIR, exist_ok=True)

print("Loading SDXL-Turbo model...")
pipe = StableDiffusionXLPipeline.from_pretrained(
    "stabilityai/sdxl-turbo",
    torch_dtype=torch.float16,
    variant="fp16"
)
pipe = pipe.to("cuda")
pipe.enable_attention_slicing()
print("Model loaded!")

NEG_PROMPT = "pixel art, cartoon, anime, chibi, low quality, blurry, text, watermark, signature, deformed, ugly, background, wall, stone, dungeon, floor, ground"

def gen_nobg(prompt, path, w=512, h=512):
    """Generate image on black bg, then remove black background"""
    try:
        result = pipe(
            prompt=prompt,
            negative_prompt=NEG_PROMPT,
            num_inference_steps=8, guidance_scale=2.0, width=w, height=h
        )
        img = result.images[0].convert("RGBA")
        data = np.array(img)

        r, g, b, a = data[:,:,0], data[:,:,1], data[:,:,2], data[:,:,3]
        brightness = r.astype(int) + g.astype(int) + b.astype(int)

        threshold = 120
        mask = np.clip((brightness - 40) / (threshold - 40) * 255, 0, 255).astype(np.uint8)

        # Keep bright/warm pixels more opaque
        warmth = r.astype(int) * 2 + g.astype(int) - b.astype(int)
        warm_boost = np.clip(warmth / 3, 0, 255).astype(np.uint8)

        # Keep green pixels more opaque (for exit portal)
        green_boost = np.clip(g.astype(int) * 2 - r.astype(int) - b.astype(int), 0, 255).astype(np.uint8)

        final_alpha = np.maximum(mask, np.maximum(warm_boost, green_boost))
        data[:,:,3] = final_alpha

        result_img = Image.fromarray(data)
        result_img.save(path)
        fsize = os.path.getsize(path) / 1024
        print(f"  OK: {path} ({fsize:.0f}KB)")
    except Exception as e:
        print(f"  ERROR: {path} - {e}")

def gen(prompt, path, w=512, h=512):
    """Generate normal image"""
    try:
        result = pipe(prompt=prompt, negative_prompt="pixel art, cartoon, anime, low quality, blurry, text, watermark",
                      num_inference_steps=8, guidance_scale=2.0, width=w, height=h)
        result.images[0].save(path)
        fsize = os.path.getsize(path) / 1024
        print(f"  OK: {path} ({fsize:.0f}KB)")
    except Exception as e:
        print(f"  ERROR: {path} - {e}")

print("\n=== Transparent Encounter Images ===\n")

# 1. Treasure chest (transparent bg)
gen_nobg(
    "single ornate golden treasure chest slightly open with golden light rays emanating from inside "
    "on solid black background, jewels and gold coins spilling out, ancient ornate metalwork with "
    "gems embedded, magical golden glow, centered isolated object, highly detailed, dramatic warm lighting, "
    "dark fantasy painterly style",
    os.path.join(OUT_DIR, "dc_treasure_nobg.png"), 384, 384
)

# 2. Exit portal (transparent bg)
gen_nobg(
    "glowing green mystical portal archway on solid black background, ancient stone arch with "
    "emerald crystal keystone, bright swirling magical green energy vortex, rune-carved stone pillars, "
    "brilliant green glow illumination, centered isolated object, highly detailed, dramatic lighting, "
    "dark fantasy painterly style",
    os.path.join(OUT_DIR, "dc_exit_nobg.png"), 384, 512
)

# 3. Retreat / Return popup background
gen(
    "in the style of Dungeons and Dragons concept art, dark dungeon corridor leading to a distant "
    "warm golden light exit, silhouette of adventurer walking toward the light, atmospheric perspective, "
    "stone walls with torch brackets, mystical fog, sense of journey homeward, bittersweet feeling of "
    "retreat, dramatic cinematic composition, highly detailed, painterly style, rich warm and cool colors, "
    "dark fantasy",
    os.path.join(OUT_DIR, "dc_retreat_bg.png"), 512, 384
)

print("\nDone!")
