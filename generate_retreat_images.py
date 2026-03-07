"""
후퇴 확인 팝업 UI 이미지 생성
- retreat_bg.png: 후퇴 팝업 배경 (안개 낀 퇴각 장면)
- retreat_emblem.png: 후퇴 엠블럼 (부서진 검+방패)
- retreat_banner.png: 장식 배너
- retreat_success_icon.png: 후퇴 성공 아이콘
- retreat_fail_icon.png: 후퇴 실패 아이콘
"""
import torch
from diffusers import AutoPipelineForText2Image
from PIL import Image
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
NEG = "pixel art, cartoon, anime, chibi, low quality, blurry, text, watermark, signature, deformed, western medieval, european knight, photo, realistic face"

def gen(prompt, w, h, path, steps=6, guidance=2.0):
    full = f"{prompt}, {STYLE}"
    img = pipe(prompt=full, negative_prompt=NEG, num_inference_steps=steps, guidance_scale=guidance, width=w, height=h).images[0]
    img.save(path)
    fsize = os.path.getsize(path) / 1024
    print(f"  OK: {path} ({fsize:.0f}KB)")
    return img

# 1) 후퇴 팝업 배경 - 안개 속 퇴각 장면
print("=== Retreat BG ===")
gen(
    "dark misty battlefield retreat scene, lone warrior silhouette walking away through thick fog and smoke, abandoned burning camp in background, moonlight breaking through dark storm clouds, scattered broken weapons on muddy ground, somber blue and cold gray tones, atmospheric perspective, cinematic wide shot",
    768, 512,
    os.path.join(UI_DIR, "retreat_bg.png")
)

# 2) 후퇴 엠블럼 - 부서진 검과 방패
print("\n=== Retreat Emblem ===")
gen(
    "broken cracked ornate korean traditional sword and shattered shield emblem icon, dark ominous red energy cracks glowing through breaks, fading golden decorative filigree, somber desperate mood, centered symmetrical composition, dark background, game UI emblem element",
    512, 512,
    os.path.join(UI_DIR, "retreat_emblem.png")
)

# 3) 장식 배너 (붉은 톤)
print("\n=== Retreat Banner ===")
gen(
    "ornate horizontal decorative banner frame border, traditional Korean royal style dark red and bronze motif, phoenix and cloud patterns, fading embers and smoke wisps, dark background, game UI frame element, symmetrical design, wide horizontal",
    768, 128,
    os.path.join(UI_DIR, "retreat_banner.png")
)

# 4) 확률 게이지 장식 프레임
print("\n=== Retreat Gauge Frame ===")
gen(
    "ornate horizontal progress bar frame decoration, traditional Korean bronze and dark metal style, dragon head on left end, intricate engravings, glowing mystical runes along the bar, dark background, game UI element, wide horizontal bar design",
    512, 64,
    os.path.join(UI_DIR, "retreat_gauge_frame.png")
)

print("\n=== Done! ===")
