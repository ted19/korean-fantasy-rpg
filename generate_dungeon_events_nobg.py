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

NEG_PROMPT = "pixel art, cartoon, anime, chibi, low quality, blurry, text, watermark, signature, deformed, ugly, background, wall, stone, dungeon, floor, ground, scenery"

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

        threshold = 130
        mask = np.clip((brightness - 35) / (threshold - 35) * 255, 0, 255).astype(np.uint8)

        # Keep bright/colorful pixels more opaque
        warmth = r.astype(int) * 2 + g.astype(int) - b.astype(int)
        warm_boost = np.clip(warmth / 3, 0, 255).astype(np.uint8)

        # Keep blue/green pixels (for ghost glow, mushroom glow)
        cool_boost = np.clip((g.astype(int) + b.astype(int) - r.astype(int)) / 2, 0, 255).astype(np.uint8)

        final_alpha = np.maximum(mask, np.maximum(warm_boost, cool_boost))
        data[:,:,3] = final_alpha

        result_img = Image.fromarray(data)
        result_img.save(path)
        fsize = os.path.getsize(path) / 1024
        print(f"  OK: {path} ({fsize:.0f}KB)")
    except Exception as e:
        print(f"  ERROR: {path} - {e}")

print("\n=== Dungeon Event Images (Transparent BG) ===\n")

# 1. Ghost
gen_nobg(
    "ethereal translucent ghost spirit floating on solid black background, "
    "pale blue-white glowing phantom with flowing robes, eerie supernatural aura, "
    "wispy smoke-like edges dissolving into darkness, haunting sad expression, "
    "centered isolated object, mysterious otherworldly presence, "
    "highly detailed, dramatic lighting, painterly style, dark fantasy",
    os.path.join(OUT_DIR, "dc_ghost.png"), 384, 384
)

# 2. Rat
gen_nobg(
    "small brown dungeon rat standing on hind legs on solid black background, "
    "cute curious expression with bright beady eyes, whiskers twitching, "
    "warm torchlight on fur, small harmless creature, detailed fur texture, "
    "centered isolated object, highly detailed, dramatic warm lighting, "
    "painterly style, dark fantasy",
    os.path.join(OUT_DIR, "dc_rat.png"), 384, 384
)

# 3. Bats
gen_nobg(
    "swarm of small bats flying on solid black background, "
    "spreading black wings with leathery texture, dynamic motion blur, "
    "torch light illuminating bat silhouettes, bats scattering in all directions, "
    "centered composition, highly detailed, dramatic lighting, painterly style, dark fantasy",
    os.path.join(OUT_DIR, "dc_bats.png"), 512, 384
)

# 4. Glowing Mushroom
gen_nobg(
    "cluster of magical glowing mushrooms on solid black background, "
    "bioluminescent blue-green and purple glow, tiny spores floating in air, "
    "ethereal fairy-tale atmosphere, fantasy fungi emitting soft magical light, "
    "centered isolated object, highly detailed, dramatic lighting, painterly style, dark fantasy",
    os.path.join(OUT_DIR, "dc_mushroom.png"), 384, 384
)

# 5. Wall Runes - centered rune symbol
gen_nobg(
    "single glowing red mystical rune symbol floating on solid black background, "
    "ancient magical inscription with intricate geometric pattern, bright crimson glow, "
    "ethereal light emanating from carved magical symbol, centered isolated object, "
    "arcane sigil with faint red embers, highly detailed, dramatic lighting, "
    "painterly style, dark fantasy",
    os.path.join(OUT_DIR, "dc_wall_runes.png"), 384, 384
)

# 6. Ghost Merchant
gen_nobg(
    "ghostly translucent merchant spirit on solid black background, "
    "wearing tattered medieval merchant robes with hood, carrying ethereal floating bags, "
    "friendly but sad ghostly expression, blue-white spectral glow, "
    "transparent body floating slightly above ground, centered isolated object, "
    "highly detailed, dramatic lighting, painterly style, dark fantasy",
    os.path.join(OUT_DIR, "dc_ghost_merchant.png"), 384, 512
)

# 7. Torch
gen_nobg(
    "single medieval iron wall torch with bright burning flame on solid black background, "
    "warm orange-yellow fire with embers and sparks floating upward, "
    "detailed iron bracket metalwork, flickering flame with smoke wisps, "
    "centered isolated object, highly detailed, dramatic warm lighting, painterly style, dark fantasy",
    os.path.join(OUT_DIR, "dc_torch_nobg.png"), 256, 512
)

print("\nAll dungeon event images generated!")
