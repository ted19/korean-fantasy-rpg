"""
신규 캐릭터(북채비, 강신무) full/icon 이미지 생성 (Animagine XL)
- full: 전신 (512x768 → rembg → 512x512)
- icon: 상반신 (512x512 → rembg → 256x256)
"""
import torch
from diffusers import StableDiffusionXLPipeline
from rembg import remove
from PIL import Image
import io, os, time

OUTPUT_DIR = "F:/project/game/client/public/characters"

FULL_STYLE = (
    "masterpiece, best quality, "
    "Akihiko Yoshida inspired, tactics ogre style, "
    "japanese fantasy RPG illustration, "
    "full body from head to toe, front facing, standing pose, "
    "clean lineart, high detail, single character, "
    "white background, no background elements"
)
FULL_NEG = (
    "cropped legs, cropped feet, half body, portrait, bust, close-up, "
    "pixel art, low quality, worst quality, blurry, "
    "multiple characters, text, watermark, signature, "
    "3d render, photorealistic, realistic photo, "
    "complex background, landscape, scenery"
)

ICON_STYLE = (
    "masterpiece, best quality, "
    "Akihiko Yoshida inspired, tactics ogre style, "
    "japanese fantasy RPG illustration, "
    "upper body, chest up, front facing, portrait, "
    "clean lineart, high detail, single character, "
    "white background, no background elements"
)
ICON_NEG = (
    "full body, legs, feet, standing pose, "
    "pixel art, low quality, worst quality, blurry, "
    "multiple characters, text, watermark, signature, "
    "3d render, photorealistic, realistic photo, "
    "complex background, landscape, scenery"
)

CHARACTERS = [
    {
        "key": "bukchaebi",
        "desc": (
            "massive muscular build male guardian warrior, "
            "wearing heavy dark iron and bronze traditional armor with earth motifs, "
            "holding an enormous two-handed tower shield with ancient Korean patterns, "
            "stoic protective expression, short dark hair, battle scars, "
            "brown and gold earth energy aura, fortress-like presence"
        ),
    },
    {
        "key": "gangsinmu",
        "desc": (
            "male athletic agile build spirit-possessed swordsman, "
            "wearing crimson and black traditional martial robes with spirit flame patterns, "
            "holding a sacred divine blade (sinkal) in one hand, "
            "fierce glowing red eyes, wild dark hair flowing with spiritual fire, "
            "red and orange flame aura swirling around body, dynamic battle stance"
        ),
    },
]

print("Loading Linaqruf/animagine-xl ...")
pipe = StableDiffusionXLPipeline.from_pretrained(
    "Linaqruf/animagine-xl",
    torch_dtype=torch.float16,
    variant="fp16",
    use_safetensors=True,
)
pipe = pipe.to("cuda")
pipe.enable_attention_slicing()
print("Model ready!\n")

def process_rembg(img, canvas_size, fill_ratio=0.9):
    """rembg로 배경 제거 후 캔버스에 맞춤"""
    buf = io.BytesIO()
    img.save(buf, format="PNG")
    out = remove(buf.getvalue())
    rgba = Image.open(io.BytesIO(out)).convert("RGBA")

    bbox = rgba.getbbox()
    if not bbox:
        return rgba.resize((canvas_size, canvas_size), Image.LANCZOS)

    cropped = rgba.crop(bbox)
    cw, ch = cropped.size
    target = int(canvas_size * fill_ratio)
    scale = min(target / cw, target / ch)
    nw, nh = int(cw * scale), int(ch * scale)
    resized = cropped.resize((nw, nh), Image.LANCZOS)

    canvas = Image.new("RGBA", (canvas_size, canvas_size), (0, 0, 0, 0))
    x = (canvas_size - nw) // 2
    y = (canvas_size - nh) // 2
    canvas.paste(resized, (x, y), resized)
    return canvas

total_start = time.time()

for char in CHARACTERS:
    print(f"=== {char['key']} ===")

    # --- FULL (전신) ---
    print(f"  Generating full body...")
    t = time.time()
    full_prompt = f"{FULL_STYLE}, {char['desc']}"
    result = pipe(
        prompt=full_prompt,
        negative_prompt=FULL_NEG,
        num_inference_steps=30,
        guidance_scale=8.0,
        width=512,
        height=768,
    )
    raw = result.images[0]
    final = process_rembg(raw, 512, fill_ratio=0.92)
    full_path = os.path.join(OUTPUT_DIR, f"{char['key']}_full.png")
    final.save(full_path, "PNG")
    kb = os.path.getsize(full_path) / 1024
    print(f"  {char['key']}_full.png ({kb:.0f}KB) [{time.time()-t:.0f}s]")

    # --- ICON (상반신) ---
    print(f"  Generating icon (upper body)...")
    t = time.time()
    icon_prompt = f"{ICON_STYLE}, {char['desc']}"
    result = pipe(
        prompt=icon_prompt,
        negative_prompt=ICON_NEG,
        num_inference_steps=30,
        guidance_scale=8.0,
        width=512,
        height=512,
    )
    raw = result.images[0]
    final = process_rembg(raw, 256, fill_ratio=0.88)
    icon_path = os.path.join(OUTPUT_DIR, f"{char['key']}_icon.png")
    final.save(icon_path, "PNG")
    kb = os.path.getsize(icon_path) / 1024
    print(f"  {char['key']}_icon.png ({kb:.0f}KB) [{time.time()-t:.0f}s]")

    print()

elapsed = time.time() - total_start
print(f"Done! Total: {elapsed:.0f}s")
