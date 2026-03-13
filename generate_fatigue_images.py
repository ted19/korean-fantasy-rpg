import torch
from diffusers import StableDiffusionXLPipeline
from PIL import Image
import os

UI_DIR = "F:/project/game/client/public/ui/battle"
os.makedirs(UI_DIR, exist_ok=True)

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
NEG_PROMPT = "pixel art, cartoon, anime, chibi, low quality, blurry, text, watermark, signature, deformed, ugly"

def generate_image(prompt, output_path, width=512, height=512):
    try:
        result = pipe(
            prompt=prompt,
            negative_prompt=NEG_PROMPT,
            num_inference_steps=8,
            guidance_scale=2.0,
            width=width,
            height=height,
        )
        result.images[0].save(output_path)
        fsize = os.path.getsize(output_path) / 1024
        print(f"  OK: {output_path} ({fsize:.0f}KB)")
    except Exception as e:
        print(f"  ERROR: {output_path} - {e}")

print("\n=== Fatigue Mercenary Popup Images ===")

# 배경 이미지 - 피로한 용병들이 쉬고 있는 여관 장면
generate_image(
    f"{STYLE_PREFIX}, exhausted medieval fantasy mercenaries resting in a dimly lit tavern inn, "
    f"sleeping warriors slumped over wooden tables, flickering candles casting warm orange shadows, "
    f"empty ale mugs scattered around, armor and weapons laid aside, moonlight through dusty windows, "
    f"cozy but melancholic atmosphere, {STYLE_SUFFIX}",
    os.path.join(UI_DIR, "fatigue_bg.png"), 512, 320
)

# 아이콘 이미지 - 피로/졸음 상징 (깨진 방패와 졸음 기운)
generate_image(
    f"{STYLE_PREFIX}, a cracked battle shield with swirling purple-blue exhaustion mist emanating from it, "
    f"dim magical sleep particles floating around, a fading warrior spirit, "
    f"dark background with soft moonlight glow, {STYLE_SUFFIX}",
    os.path.join(UI_DIR, "fatigue_icon.png"), 256, 256
)

print("\nFatigue popup images generated!")
