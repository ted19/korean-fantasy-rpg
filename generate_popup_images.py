import torch
from diffusers import StableDiffusionXLPipeline
from PIL import Image
import os

# 디렉토리 준비
SD_DIR = "F:/project/game/client/public/special_dungeons"
UI_DIR = "F:/project/game/client/public/ui"
os.makedirs(SD_DIR, exist_ok=True)
os.makedirs(UI_DIR, exist_ok=True)

# SDXL-Turbo 로드
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

# ============================================================
# 무한의 탑 도전 팝업 이미지 (새로 생성/업데이트)
# ============================================================
print("\n=== Tower Challenge Popup Images ===")

# 일반 층 배경 (wide banner)
generate_image(
    f"{STYLE_PREFIX}, a grand mystical tower interior with spiraling staircases leading upward, "
    f"glowing magical runes on ancient stone walls, ethereal blue-purple mist, "
    f"floating magical crystals illuminating the dark corridor, {STYLE_SUFFIX}",
    os.path.join(SD_DIR, "tower_floor_normal.png"), 512, 320
)

# 보스 층 배경
generate_image(
    f"{STYLE_PREFIX}, an epic boss arena at the top of a dark fantasy tower, "
    f"a massive throne room with burning orange-red flames, cracked stone pillars, "
    f"ominous red glow, dragon skulls mounted on walls, lava cracks in the floor, {STYLE_SUFFIX}",
    os.path.join(SD_DIR, "tower_floor_boss.png"), 512, 320
)

# 도전 버튼 아이콘
generate_image(
    f"{STYLE_PREFIX}, a magical sword piercing through a stone pedestal, "
    f"glowing energy radiating outward, blue-purple magical aura, {STYLE_SUFFIX}",
    os.path.join(SD_DIR, "tower_challenge_sword.png"), 256, 256
)

# 던전 테마 아이콘들
themes = {
    "cave": "a dark underground cave entrance with stalactites and glowing mushrooms, mysterious blue light",
    "goblin": "a goblin fortress gate with crude wooden spikes and green torches, dark forest background",
    "mountain": "a snowy mountain peak with ancient stone ruins and swirling blizzard, dramatic clouds",
    "ocean": "an underwater temple entrance with coral pillars and bioluminescent sea creatures, deep blue",
    "temple": "a golden ancient Korean temple gate with paper lanterns and incense smoke, ethereal light",
    "demon": "a hellish portal with burning demonic runes and black flames, red sky with lightning",
    "dragon": "a massive dragon's lair entrance with treasure piles and dragon claw marks on stone, golden glow",
}

for key, desc in themes.items():
    generate_image(
        f"{STYLE_PREFIX}, {desc}, {STYLE_SUFFIX}",
        os.path.join(SD_DIR, f"tower_theme_{key}.png"), 320, 176
    )

# ============================================================
# 스킬 트리 초기화 팝업 이미지
# ============================================================
print("\n=== Skill Tree Reset Popup Images ===")

# 초기화 팝업 배경
generate_image(
    f"{STYLE_PREFIX}, an ancient mystical ritual altar with swirling energy being released, "
    f"skill points floating as golden-blue orbs being absorbed back, "
    f"magical circle on the ground with Korean rune patterns, dramatic purple-gold lighting, {STYLE_SUFFIX}",
    os.path.join(UI_DIR, "skill_reset_bg.png"), 512, 320
)

# 초기화 아이콘 (스킬 오브가 해제되는 이미지)
generate_image(
    f"{STYLE_PREFIX}, a glowing magical skill orb shattering and releasing golden energy particles, "
    f"broken magical chains, swirling blue and gold aura, dark background, {STYLE_SUFFIX}",
    os.path.join(UI_DIR, "skill_reset_icon.png"), 256, 256
)

print("\nAll popup images generated!")
