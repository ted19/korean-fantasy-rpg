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
        img = result.images[0].resize((target_w, target_h), Image.LANCZOS) if (target_w := w) and False else result.images[0]
        img.save(path)
        fsize = os.path.getsize(path) / 1024
        print(f"  OK: {path} ({fsize:.0f}KB)")
    except Exception as e:
        print(f"  ERROR: {path} - {e}")

def gen_sized(prompt, path, gen_w, gen_h, out_w, out_h):
    """Generate at gen_w x gen_h then resize to out_w x out_h."""
    try:
        result = pipe(prompt=prompt, negative_prompt=NEG_PROMPT,
                      num_inference_steps=8, guidance_scale=2.0, width=gen_w, height=gen_h)
        img = result.images[0].resize((out_w, out_h), Image.LANCZOS)
        img.save(path)
        fsize = os.path.getsize(path) / 1024
        print(f"  OK: {path} ({fsize:.0f}KB)")
    except Exception as e:
        print(f"  ERROR: {path} - {e}")

def gen_nobg(prompt, path, gen_w=512, gen_h=512, out_w=None, out_h=None):
    try:
        result = pipe(prompt=prompt, negative_prompt=NEG_PROMPT + ", background, scenery",
                      num_inference_steps=8, guidance_scale=2.0, width=gen_w, height=gen_h)
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
        if out_w and out_h:
            result_img = result_img.resize((out_w, out_h), Image.LANCZOS)
        result_img.save(path)
        fsize = os.path.getsize(path) / 1024
        print(f"  OK: {path} ({fsize:.0f}KB)")
    except Exception as e:
        print(f"  ERROR: {path} - {e}")

print("\n=== Crawler Battle Defeat Images ===\n")

# 1. cwb_defeat_bg.png (900x600) - Dark ominous dungeon with crimson atmosphere
print("[1/6] Generating defeat background...")
gen_sized(
    "dark ominous dungeon chamber engulfed in crimson red fog and shadows, "
    "fallen warrior silhouette on cracked stone floor, shattered weapons scattered, "
    "dying red torchlight casting long shadows on ancient dungeon walls, "
    "oppressive darkness with blood-red atmospheric haze, sense of despair and doom, "
    "highly detailed, dramatic dark crimson lighting, painterly style, dark fantasy art",
    os.path.join(OUT_DIR, "cwb_defeat_bg.png"),
    gen_w=1024, gen_h=768, out_w=900, out_h=600
)

# 2. cwb_defeat_icon.png (200x200) - Broken shield/shattered sword icon
print("[2/6] Generating defeat icon...")
gen_nobg(
    "broken shattered medieval shield split in half with crimson red glow from cracks, "
    "dark steel fragments and broken sword pieces on solid black background, "
    "dramatic red ember light emanating from fractures, smoke wisps, "
    "centered isolated object, highly detailed, dark fantasy painterly style",
    os.path.join(OUT_DIR, "cwb_defeat_icon.png"),
    gen_w=384, gen_h=384, out_w=200, out_h=200
)

# 3. cwb_defeat_particles.png (900x600) - Red embers, blood-red particles, dark smoke
print("[3/6] Generating defeat particles...")
gen_nobg(
    "scattered blood-red embers and crimson glowing particles on solid black background, "
    "floating dying fire sparks and dark smoke wisps drifting in air, "
    "red hot cinders and ash fragments with fading crimson glow, "
    "dark atmospheric smoke tendrils and red floating dust motes, "
    "highly detailed, dramatic dark red lighting, painterly style, dark fantasy",
    os.path.join(OUT_DIR, "cwb_defeat_particles.png"),
    gen_w=1024, gen_h=768, out_w=900, out_h=600
)

# 4. cwb_defeat_frame.png (400x500) - Dark ornate frame with thorns and broken edges
print("[4/6] Generating defeat frame...")
gen_nobg(
    "dark gothic ornate rectangular frame border with thorny vines and broken edges on solid black background, "
    "intricate iron metalwork frame with crimson red accent glow, "
    "twisted thorn branches and cracked stone decorative border, "
    "gothic dark fantasy style frame element, symmetrical design, "
    "highly detailed, dramatic dark lighting, painterly style, dark fantasy art",
    os.path.join(OUT_DIR, "cwb_defeat_frame.png"),
    gen_w=512, gen_h=640, out_w=400, out_h=500
)

# 5. cwb_defeat_skull.png (180x180) - Stylized skull/death emblem with red eyes
print("[5/6] Generating defeat skull...")
gen_nobg(
    "stylized dark fantasy skull emblem with glowing crimson red eyes on solid black background, "
    "ornate death symbol with dark metal crown and bone details, "
    "ominous red glow emanating from eye sockets, dark smoke wisps, "
    "centered isolated object, gothic dark fantasy style, "
    "highly detailed, dramatic dark lighting, painterly style",
    os.path.join(OUT_DIR, "cwb_defeat_skull.png"),
    gen_w=384, gen_h=384, out_w=180, out_h=180
)

# 6. cwb_defeat_chains.png (900x200) - Broken chains falling with red glow
print("[6/6] Generating defeat chains...")
gen_nobg(
    "broken dark iron chains falling and shattering on solid black background, "
    "heavy metal chain links snapping apart with crimson red glow from breaks, "
    "dark steel fragments flying outward with red ember sparks, "
    "horizontal composition, dramatic dark fantasy style, "
    "highly detailed, dramatic dark red lighting, painterly style",
    os.path.join(OUT_DIR, "cwb_defeat_chains.png"),
    gen_w=1024, gen_h=256, out_w=900, out_h=200
)

print("\nAll crawler battle defeat images generated!")
