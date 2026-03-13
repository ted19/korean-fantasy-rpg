import torch
from diffusers import StableDiffusionXLPipeline
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

print("\n=== Crawler Battle UI Images ===")

# 1. 1인칭 전투 배경 - 던전 복도 정면 (가로로 넓게)
gen(
    f"{STYLE_PREFIX}, first person view looking down a dark medieval dungeon corridor, "
    f"stone brick walls on both sides with iron torches casting warm flickering light, "
    f"cracked stone floor with moss, cobwebs hanging from arched stone ceiling, "
    f"mysterious green-blue fog in the distance, symmetrical composition, {STYLE_SUFFIX}",
    os.path.join(OUT_DIR, "cwb_viewport_bg.png"), 768, 512
)

# 2. 전투 뷰포트 바닥 텍스처 (타일 느낌)
gen(
    f"{STYLE_PREFIX}, top-down view of ancient dungeon stone floor tiles, "
    f"cracked weathered cobblestone with moss growing between gaps, "
    f"dark brown and gray stone, dim torch light reflections, {STYLE_SUFFIX}",
    os.path.join(OUT_DIR, "cwb_floor.png"), 512, 256
)

# 3. 승리 결과 배경
gen(
    f"{STYLE_PREFIX}, triumphant golden light rays breaking through dark dungeon ceiling, "
    f"scattered treasure coins and gems on stone floor, glowing magical victory aura, "
    f"epic heroic atmosphere with warm golden-amber lighting, {STYLE_SUFFIX}",
    os.path.join(OUT_DIR, "cwb_victory_bg.png"), 512, 512
)

# 4. 패배 결과 배경
gen(
    f"{STYLE_PREFIX}, a dark gloomy dungeon scene of defeat, "
    f"broken weapons and shattered shields on cold stone floor, "
    f"red ominous mist, fading torchlight, dark shadows creeping in, "
    f"melancholic and somber atmosphere, {STYLE_SUFFIX}",
    os.path.join(OUT_DIR, "cwb_defeat_bg.png"), 512, 512
)

# 5. 액션 바 배경 텍스처 (금속/가죽 판넬)
gen(
    f"{STYLE_PREFIX}, close-up of an ornate medieval leather and metal panel, "
    f"dark brown leather with brass rivets and Celtic knot border engravings, "
    f"worn battle-scarred surface, warm candlelight reflection, {STYLE_SUFFIX}",
    os.path.join(OUT_DIR, "cwb_action_bar.png"), 768, 128
)

# 6. 파티 바 배경 (나무/가죽 하단 프레임)
gen(
    f"{STYLE_PREFIX}, close-up of a dark wooden tavern counter or equipment bench, "
    f"polished dark oak wood with iron corner brackets, worn leather surface, "
    f"dim warm lighting from below, {STYLE_SUFFIX}",
    os.path.join(OUT_DIR, "cwb_party_bar.png"), 768, 160
)

# 7. 왼쪽 벽 기둥 (세로)
gen(
    f"{STYLE_PREFIX}, a single dark stone dungeon pillar column with iron torch bracket, "
    f"ancient carved runes glowing faintly blue, moss and cracks on weathered stone, "
    f"dramatic side lighting, vertical composition, {STYLE_SUFFIX}",
    os.path.join(OUT_DIR, "cwb_pillar_left.png"), 128, 512
)

# 8. 몬스터 정보 패널 배경
gen(
    f"{STYLE_PREFIX}, an ancient bestiary book page background, "
    f"weathered dark parchment with ornate golden border decorations, "
    f"faded magical symbols in corners, dark fantasy grimoire style, {STYLE_SUFFIX}",
    os.path.join(OUT_DIR, "cwb_inspect_bg.png"), 384, 512
)

print("\nAll crawler battle images generated!")
