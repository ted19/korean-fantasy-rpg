"""
전투 복귀 팝업 UI 이미지 생성
- battle_resume_bg.png: 전투 복귀 팝업 배경 (전장의 칼과 불꽃)
- battle_resume_swords.png: 교차된 칼 장식
- battle_resume_frame.png: 팝업 프레임 장식
- battle_penalty_icon.png: 패널티 경고 아이콘
"""
import torch
from diffusers import AutoPipelineForText2Image
from PIL import Image, ImageDraw, ImageFilter
import os

pipe = AutoPipelineForText2Image.from_pretrained(
    "stabilityai/sdxl-turbo",
    torch_dtype=torch.float16,
    variant="fp16"
)
pipe.to("cuda")

UI_DIR = "F:/project/game/client/public/ui/battle"
os.makedirs(UI_DIR, exist_ok=True)

STYLE = "korean fantasy RPG, traditional Korean mythology, joseon dynasty aesthetic, stylized digital painting, dramatic lighting, rich colors, dark fantasy"
NEG = "pixel art, cartoon, anime, chibi, low quality, blurry, text, watermark, signature, deformed, western medieval, european knight, crusader armor, photo, realistic face"

def gen(prompt, w, h, path, steps=6, guidance=2.0):
    full = f"{prompt}, {STYLE}"
    img = pipe(prompt=full, negative_prompt=NEG, num_inference_steps=steps, guidance_scale=guidance, width=w, height=h).images[0]
    img.save(path)
    fsize = os.path.getsize(path) / 1024
    print(f"  OK: {path} ({fsize:.0f}KB)")
    return img

# 1) 전투 복귀 팝업 배경 - 전장 분위기
print("=== Battle Resume BG ===")
gen(
    "dark dramatic battlefield scene at dusk, smoldering embers floating in air, crossed ancient korean swords glowing with magical blue and red energy, mystical fog rolling over rocky terrain, ominous dark sky with cracks of golden light breaking through storm clouds, epic cinematic composition, wide panoramic view",
    768, 512,
    os.path.join(UI_DIR, "resume_bg.png")
)

# 2) 교차된 칼 장식 아이콘
print("\n=== Crossed Swords Emblem ===")
gen(
    "ornate crossed korean traditional swords emblem icon, glowing magical blue energy aura, intricate golden guard and handle decorations, mystical runes on blade, dark transparent background, centered symmetrical composition, game UI icon element, sharp detailed metalwork",
    512, 512,
    os.path.join(UI_DIR, "resume_swords.png")
)

# 3) 팝업 프레임 장식 (가로 배너)
print("\n=== Resume Frame Banner ===")
gen(
    "ornate horizontal decorative banner frame border, traditional Korean royal palace style gilded gold and deep blue motif, dragon cloud patterns on edges, glowing mystical energy lines, dark navy background, game UI frame element, symmetrical elegant design, wide horizontal",
    768, 128,
    os.path.join(UI_DIR, "resume_banner.png")
)

# 4) 패널티 경고 아이콘 (해골+불꽃)
print("\n=== Penalty Warning Icon ===")
gen(
    "menacing dark fantasy warning skull icon with red flames, korean shamanic style mystical skull symbol, glowing red eyes, dark smoke wisps, centered icon on dark background, game UI danger symbol, dramatic red and orange glow",
    256, 256,
    os.path.join(UI_DIR, "resume_penalty.png")
)

# 5) 전투 복귀 버튼 장식 (파란 검 아이콘)
print("\n=== Return to Battle Icon ===")
gen(
    "glowing magical blue sword pointing upward, divine holy light aura, korean traditional blade design, mystical blue energy swirling around blade, centered icon, dark background, game UI button icon element, sharp clean design",
    256, 256,
    os.path.join(UI_DIR, "resume_return_icon.png")
)

# 6) 포기 버튼 장식 (부서진 방패 아이콘)
print("\n=== Abandon Battle Icon ===")
gen(
    "broken cracked dark shield icon with red cracks glowing, korean traditional warrior shield shattered, dark ominous energy, defeat symbol, centered icon, dark background, game UI button icon element",
    256, 256,
    os.path.join(UI_DIR, "resume_abandon_icon.png")
)

print("\n=== 전투 복귀 UI 이미지 생성 완료! ===")
