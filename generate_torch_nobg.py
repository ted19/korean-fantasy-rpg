import torch
from diffusers import StableDiffusionXLPipeline
from PIL import Image
import numpy as np
import os

OUT_DIR = "F:/project/game/client/public/ui/dungeon"

print("Loading SDXL-Turbo model...")
pipe = StableDiffusionXLPipeline.from_pretrained(
    "stabilityai/sdxl-turbo",
    torch_dtype=torch.float16,
    variant="fp16"
)
pipe = pipe.to("cuda")
pipe.enable_attention_slicing()
print("Model loaded!")

NEG_PROMPT = "pixel art, cartoon, anime, chibi, low quality, blurry, text, watermark, signature, deformed, ugly, background, wall, stone, dungeon"

def gen_nobg(prompt, path, w=256, h=512):
    """Generate image on black bg, then remove black background"""
    try:
        result = pipe(
            prompt=prompt,
            negative_prompt=NEG_PROMPT,
            num_inference_steps=8, guidance_scale=2.0, width=w, height=h
        )
        img = result.images[0].convert("RGBA")
        data = np.array(img)

        # Remove dark background: pixels where R+G+B < threshold become transparent
        r, g, b, a = data[:,:,0], data[:,:,1], data[:,:,2], data[:,:,3]
        brightness = r.astype(int) + g.astype(int) + b.astype(int)

        # Gradual transparency: darker = more transparent
        threshold = 120
        mask = np.clip((brightness - 40) / (threshold - 40) * 255, 0, 255).astype(np.uint8)

        # Keep bright/warm pixels (fire colors) more opaque
        warmth = r.astype(int) * 2 + g.astype(int) - b.astype(int)
        warm_boost = np.clip(warmth / 3, 0, 255).astype(np.uint8)
        final_alpha = np.maximum(mask, warm_boost)

        data[:,:,3] = final_alpha

        result_img = Image.fromarray(data)
        result_img.save(path)
        fsize = os.path.getsize(path) / 1024
        print(f"  OK: {path} ({fsize:.0f}KB)")
    except Exception as e:
        print(f"  ERROR: {path} - {e}")

print("\n=== Torch with transparent background ===\n")

gen_nobg(
    "single medieval iron wall torch with bright burning flame on solid black background, "
    "warm orange-yellow fire with embers and sparks floating upward, "
    "detailed iron bracket metalwork, flickering flame with smoke wisps, "
    "isolated object centered, highly detailed, dramatic warm lighting, painterly style, dark fantasy",
    os.path.join(OUT_DIR, "dc_torch_nobg.png"), 256, 512
)

# Generate a second variant
gen_nobg(
    "single fantasy dungeon torch with magical bright fire on pure black background, "
    "ornate iron holder with burning flame casting warm golden light, "
    "sparks and embers floating, isolated object, centered composition, "
    "highly detailed, dramatic lighting, painterly style, rich warm colors",
    os.path.join(OUT_DIR, "dc_torch_nobg2.png"), 256, 512
)

print("\nDone!")
