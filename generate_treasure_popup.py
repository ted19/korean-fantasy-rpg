import torch
from diffusers import StableDiffusionXLPipeline
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

STYLE_PREFIX = "in the style of Dungeons and Dragons concept art, official D&D illustration"
STYLE_SUFFIX = "highly detailed, dramatic lighting, painterly style, rich colors, dark fantasy"
NEG_PROMPT = "pixel art, cartoon, anime, chibi, low quality, blurry, text, watermark, signature, deformed, ugly, bright, cheerful"

def gen(prompt, path, w=512, h=512):
    try:
        result = pipe(prompt=prompt, negative_prompt=NEG_PROMPT,
                      num_inference_steps=8, guidance_scale=2.0, width=w, height=h)
        result.images[0].save(path)
        fsize = os.path.getsize(path) / 1024
        print(f"  OK: {path} ({fsize:.0f}KB)")
    except Exception as e:
        print(f"  ERROR: {path} - {e}")

print("\n=== Treasure Popup Background ===")

gen(
    f"{STYLE_PREFIX}, glowing treasure chest overflowing with gold coins and gems, "
    f"magical golden light radiating from open chest, sparkles and particles floating, "
    f"dark dungeon background with warm golden illumination, ornate ancient wooden chest "
    f"with metal reinforcements, scattered jewels rubies emeralds, {STYLE_SUFFIX}",
    os.path.join(OUT_DIR, "dc_treasure_popup_bg.png"), 512, 512
)

print("\nDone!")
