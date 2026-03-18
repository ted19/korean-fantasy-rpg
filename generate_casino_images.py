"""
도깨비 노름방 이미지 생성 (SDXL-Turbo + 통일 STYLE)
- regen_village_images.py 와 동일한 파이프라인/스타일 사용
- banner, card, icon, bg, portrait 생성
- portrait는 rembg로 배경 제거
"""
import torch
from diffusers import AutoPipelineForText2Image
from PIL import Image
import os, time

try:
    from rembg import remove as rembg_remove
    HAS_REMBG = True
    print("rembg loaded")
except ImportError:
    HAS_REMBG = False
    print("rembg not found - portrait will have white background")

VILLAGE_DIR = "F:/project/game/client/public/village"
os.makedirs(VILLAGE_DIR, exist_ok=True)

print("Loading SDXL-Turbo model...")
pipe = AutoPipelineForText2Image.from_pretrained(
    "stabilityai/sdxl-turbo",
    torch_dtype=torch.float16,
    variant="fp16"
)
pipe = pipe.to("cuda")
print("Model loaded!")

STYLE = (
    "masterpiece, best quality, "
    "Akihiko Yoshida inspired, tactics ogre style, "
    "japanese fantasy RPG illustration, "
)

NEG = "text, watermark, signature, low quality, blurry, deformed, photo, 3d render, cartoon, chibi, anime"

def gen(prompt, w, h, path):
    full = f"{prompt}, {STYLE}"
    scale = max(512 / w, 512 / h, 1.0)
    gen_w = int(w * scale // 8) * 8
    gen_h = int(h * scale // 8) * 8
    img = pipe(prompt=full, negative_prompt=NEG,
               num_inference_steps=4, guidance_scale=0.0,
               width=gen_w, height=gen_h).images[0]
    if (gen_w, gen_h) != (w, h):
        img = img.resize((w, h), Image.LANCZOS)
    img.save(path)
    fsize = os.path.getsize(path) / 1024
    print(f"  OK: {os.path.basename(path)} ({fsize:.0f}KB)")
    return img

def gen_portrait(prompt, w, h, path):
    """portrait는 512x512로 생성 → rembg 배경 제거 → 상반신 크롭 → 리사이즈"""
    full = f"{prompt}, {STYLE}"
    img = pipe(prompt=full, negative_prompt=NEG,
               num_inference_steps=4, guidance_scale=0.0,
               width=512, height=512).images[0]
    if HAS_REMBG:
        print("  Removing background...")
        nobg = rembg_remove(img)
    else:
        nobg = img.convert("RGBA")
    # 상반신 크롭 (상단 65%)
    iw, ih = nobg.size
    cropped = nobg.crop((0, 0, iw, int(ih * 0.65)))
    portrait = cropped.resize((w, h), Image.LANCZOS)
    portrait.save(path)
    fsize = os.path.getsize(path) / 1024
    print(f"  OK: {os.path.basename(path)} ({fsize:.0f}KB) [transparent]")

# ============================================================
# 이미지 목록
# ============================================================
images = [
    # banner (wide) - 시설 상단 배너
    ("casino_banner", 768, 256,
     "wide panoramic interior of a Korean fantasy dokkaebi goblin gambling den, "
     "red and gold paper lanterns hanging from wooden ceiling, ornate gambling tables with dice and cards, "
     "dokkaebi goblin masks on walls, golden coins scattered, mystical red and gold glow, "
     "dark moody Korean folklore gambling house atmosphere, incense smoke"),

    # card - 마을에서 보이는 건물 카드
    ("casino_card", 512, 320,
     "exterior of a mysterious Korean dokkaebi gambling house at night, "
     "traditional Korean wooden building with curved tiled roof, "
     "glowing red and gold paper lanterns hanging at entrance, "
     "wooden sign with carved goblin face, foggy mystical street, "
     "golden light spilling from doorway, dark fantasy Korean folklore"),

    # icon - 마을 네비게이션 아이콘
    ("casino_icon", 256, 256,
     "Korean dokkaebi gambling house icon, "
     "red lantern and golden dice symbol, wooden sign with goblin face, "
     "dark background, centered composition, icon style"),

    # bg - 시설 내부 배경
    ("casino_bg", 512, 320,
     "interior of a Korean fantasy dokkaebi gambling den, "
     "ornate wooden gambling tables with golden dice and playing cards, "
     "red silk curtains and hanging paper lanterns, golden coins piled on tables, "
     "dokkaebi goblin decorations on walls, warm red and gold atmosphere, "
     "mystical incense smoke, dark rich interior"),
]

# portrait - NPC 초상화 (별도 처리: 배경 제거)
portrait_prompt = (
    "a single goblin gambling house owner NPC, "
    "full body from head to toe, front facing, standing pose, "
    "red-skinned goblin with single horn, mischievous grin, "
    "wearing ornate Korean traditional gambling master hanbok with gold embroidery, "
    "holding golden magical dice in one hand and fan of cards in other, "
    "gold coins floating around, single character, white background"
)

if __name__ == "__main__":
    start = time.time()
    print(f"\n{'='*50}")
    print(f"  도깨비 노름방 이미지 생성기")
    print(f"  {len(images) + 1}장 (배너/카드/아이콘/배경 + 초상화)")
    print(f"{'='*50}\n")

    for name, w, h, prompt in images:
        path = os.path.join(VILLAGE_DIR, f"{name}.png")
        print(f"[{name}] ({w}x{h})")
        gen(prompt, w, h, path)

    # portrait (배경 제거)
    print(f"\n[casino_portrait] (256x320) + bg removal")
    gen_portrait(portrait_prompt, 256, 320,
                 os.path.join(VILLAGE_DIR, "casino_portrait.png"))

    elapsed = time.time() - start
    print(f"\n{'='*50}")
    print(f"  완료! {len(images) + 1}장, {elapsed:.1f}초")
    print(f"{'='*50}")
