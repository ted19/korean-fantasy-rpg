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

NEG_PROMPT = "pixel art, cartoon, anime, chibi, low quality, blurry, text, watermark, signature, deformed, ugly, background, wall, stone, dungeon, floor, ground, scenery, cropped, partial, cut off"

def gen_nobg(prompt, path, w=512, h=512):
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

# Full body rat, centered
gen_nobg(
    "single small brown fantasy dungeon rat full body portrait on solid black background, "
    "standing upright on hind legs, entire body visible from head to tail and feet, "
    "cute curious expression with bright beady eyes and twitching whiskers, "
    "warm brown fur with detailed texture, long pink tail, small paws, "
    "perfectly centered in frame with plenty of space around, "
    "highly detailed, dramatic warm lighting, painterly style, dark fantasy, D&D concept art",
    os.path.join(OUT_DIR, "dc_rat.png"), 384, 384
)

print("\nDone!")
