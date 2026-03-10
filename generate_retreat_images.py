import torch
from diffusers import StableDiffusionXLPipeline
from PIL import Image
import os

OUTPUT_DIR = "F:/project/game/client/public/ui/battle"
os.makedirs(OUTPUT_DIR, exist_ok=True)

print("Loading SDXL-Turbo model...")
pipe = StableDiffusionXLPipeline.from_pretrained(
    "stabilityai/sdxl-turbo",
    torch_dtype=torch.float16,
    variant="fp16"
)
pipe = pipe.to("cuda")
pipe.enable_attention_slicing()
print("Model loaded!")

STYLE = "dark fantasy RPG game UI art, dramatic cinematic lighting, rich deep colors, highly detailed, epic composition"
NEG = "text, watermark, signature, blurry, low quality, cartoon, anime, chibi, deformed, ugly"

images = [
    {
        "name": "retreat_success_bg.png",
        "prompt": f"A lone warrior escaping from a dark misty battlefield through a mystical glowing portal, looking back at the chaos behind, moonlit night scene, fog and dust particles, ethereal blue and silver light, sense of relief and survival, {STYLE}",
        "w": 512, "h": 320,
    },
    {
        "name": "retreat_success_icon.png",
        "prompt": f"A glowing golden shield with angel wings and a protective aura, divine light rays emanating outward, magical fantasy RPG icon on dark background, {STYLE}",
        "w": 256, "h": 256,
    },
    {
        "name": "retreat_fail_bg.png",
        "prompt": f"A warrior trapped in a dark dungeon surrounded by glowing red chains and shadowy monsters closing in, desperate scene, ominous red and crimson lighting, dark fog, sense of danger and despair, {STYLE}",
        "w": 512, "h": 320,
    },
    {
        "name": "retreat_fail_icon.png",
        "prompt": f"A broken cracked dark shield with red ominous energy, shattered fragments floating, cursed symbol, sinister glow, fantasy RPG icon on dark background, {STYLE}",
        "w": 256, "h": 256,
    },
]

for img in images:
    print(f"Generating {img['name']}...")
    try:
        result = pipe(
            prompt=img["prompt"],
            negative_prompt=NEG,
            num_inference_steps=8,
            guidance_scale=2.0,
            width=img["w"],
            height=img["h"],
        )
        path = os.path.join(OUTPUT_DIR, img["name"])
        result.images[0].save(path)
        fsize = os.path.getsize(path) / 1024
        print(f"  OK: {path} ({fsize:.0f}KB)")
    except Exception as e:
        print(f"  ERROR: {img['name']} - {e}")

print("\nDone! All retreat images generated.")
