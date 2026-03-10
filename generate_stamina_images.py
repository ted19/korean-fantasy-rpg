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
        "name": "stamina_empty_bg.png",
        "prompt": f"A exhausted warrior kneeling on dark stone ground, armor cracked and dim, fading magical energy particles around, dark moody atmosphere with deep blue and purple tones, moonlight casting long shadows, sense of fatigue and depletion, {STYLE}",
        "w": 512, "h": 320,
    },
    {
        "name": "stamina_empty_icon.png",
        "prompt": f"A cracked depleted blue crystal orb with fading lightning bolt energy inside, dark energy wisps, empty magical vessel, fantasy RPG icon on dark background, glowing dim blue edges, {STYLE}",
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

print("\nDone! All stamina images generated.")
