import torch
from diffusers import StableDiffusionXLPipeline
from PIL import Image
import numpy as np
import os

OUT_DIR = "F:/project/game/client/public/ui/battle"
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

NEG_PROMPT = "pixel art, cartoon, anime, chibi, low quality, blurry, text, watermark, signature, deformed, ugly"

def gen(prompt, path, w=512, h=512):
    try:
        result = pipe(prompt=prompt, negative_prompt=NEG_PROMPT,
                      num_inference_steps=8, guidance_scale=2.0, width=w, height=h)
        result.images[0].save(path)
        fsize = os.path.getsize(path) / 1024
        print(f"  OK: {path} ({fsize:.0f}KB)")
    except Exception as e:
        print(f"  ERROR: {path} - {e}")

def gen_nobg(prompt, path, w=512, h=512):
    try:
        result = pipe(prompt=prompt, negative_prompt=NEG_PROMPT + ", background, scenery",
                      num_inference_steps=8, guidance_scale=2.0, width=w, height=h)
        img = result.images[0].convert("RGBA")
        data = np.array(img)
        r, g, b, a = data[:,:,0], data[:,:,1], data[:,:,2], data[:,:,3]
        brightness = r.astype(int) + g.astype(int) + b.astype(int)
        threshold = 130
        mask = np.clip((brightness - 35) / (threshold - 35) * 255, 0, 255).astype(np.uint8)
        warmth = r.astype(int) * 2 + g.astype(int) - b.astype(int)
        warm_boost = np.clip(warmth / 3, 0, 255).astype(np.uint8)
        cool_boost = np.clip((g.astype(int) + b.astype(int) - r.astype(int)) / 2, 0, 255).astype(np.uint8)
        final_alpha = np.maximum(mask, np.maximum(warm_boost, cool_boost))
        data[:,:,3] = final_alpha
        result_img = Image.fromarray(data)
        result_img.save(path)
        fsize = os.path.getsize(path) / 1024
        print(f"  OK: {path} ({fsize:.0f}KB)")
    except Exception as e:
        print(f"  ERROR: {path} - {e}")

print("\n=== Crawler Battle Victory/Defeat Images ===\n")

# 1. Victory background - epic golden light dungeon scene
gen(
    "epic victorious golden light bursting through dark dungeon chamber, "
    "brilliant golden sun rays streaming through ancient stone archway, "
    "warm amber glow illuminating ornate dungeon walls with victory banner, "
    "treasure and golden light particles floating in air, triumphant atmosphere, "
    "highly detailed, dramatic cinematic lighting, painterly style, dark fantasy",
    os.path.join(OUT_DIR, "cwb_victory_bg.png"), 512, 768
)

# 2. Defeat background - dark grim dungeon
gen(
    "dark ominous dungeon corridor engulfed in shadows and red mist, "
    "cracked stone walls with dying embers and fading torchlight, "
    "ominous crimson fog creeping along the floor, scattered broken weapons, "
    "oppressive darkness closing in, sense of dread and despair, "
    "highly detailed, dramatic dark lighting, painterly style, dark fantasy",
    os.path.join(OUT_DIR, "cwb_defeat_bg.png"), 512, 768
)

# 3. Victory icon - golden trophy/crown with transparent bg
gen_nobg(
    "magnificent golden ornate crown with glowing jewels on solid black background, "
    "brilliant diamond in center radiating golden light rays, "
    "intricate filigree metalwork with rubies and sapphires, "
    "ethereal golden aura and sparkles around crown, centered isolated object, "
    "highly detailed, dramatic warm lighting, painterly style, fantasy art",
    os.path.join(OUT_DIR, "cwb_victory_icon.png"), 384, 384
)

# 4. Defeat icon - broken sword with transparent bg
gen_nobg(
    "broken shattered sword blade fragments on solid black background, "
    "dark steel blade cracked and splintered with red glow from cracks, "
    "fading ember light on broken metal, smoke wisps rising, "
    "sense of defeat and loss, centered isolated object, "
    "highly detailed, dramatic dark lighting, painterly style, dark fantasy",
    os.path.join(OUT_DIR, "cwb_defeat_icon.png"), 384, 384
)

# 5. Victory particles - golden sparkles and light rays
gen_nobg(
    "scattered golden magical sparkles and light particles on solid black background, "
    "floating golden dust motes and tiny star-like glimmers, "
    "warm amber light rays scattered across frame, ethereal golden confetti, "
    "magical celebration particles, "
    "highly detailed, dramatic warm lighting, painterly style, fantasy art",
    os.path.join(OUT_DIR, "cwb_victory_particles.png"), 512, 768
)

# 6. Defeat particles - dark red embers
gen_nobg(
    "scattered dying red embers and dark ash particles on solid black background, "
    "floating crimson sparks and fading fire particles, "
    "dark smoke wisps and red glowing cinders drifting downward, "
    "sense of fading and despair, "
    "highly detailed, dramatic dark lighting, painterly style, dark fantasy",
    os.path.join(OUT_DIR, "cwb_defeat_particles.png"), 512, 768
)

# 7. Victory frame ornament - golden decorative border element
gen_nobg(
    "ornate golden decorative scroll flourish on solid black background, "
    "elegant golden filigree design symmetrical ornamental frame element, "
    "intricate swirling metal scrollwork with small jewels, centered isolated object, "
    "highly detailed, dramatic warm lighting, painterly style, fantasy art",
    os.path.join(OUT_DIR, "cwb_victory_frame.png"), 512, 256
)

print("\nAll crawler battle images generated!")
