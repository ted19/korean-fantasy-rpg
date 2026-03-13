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
NEG_PROMPT = "pixel art, cartoon, anime, chibi, low quality, blurry, text, watermark, signature, deformed, ugly, bright, cheerful, white background"

def gen(prompt, path, w=512, h=512):
    try:
        result = pipe(prompt=prompt, negative_prompt=NEG_PROMPT,
                      num_inference_steps=8, guidance_scale=2.0, width=w, height=h)
        result.images[0].save(path)
        fsize = os.path.getsize(path) / 1024
        print(f"  OK: {path} ({fsize:.0f}KB)")
    except Exception as e:
        print(f"  ERROR: {path} - {e}")

print("\n=== Dungeon Fun Element Images ===\n")

# 1. 유령 이미지 (투명 느낌, 어두운 배경)
gen(
    f"{STYLE_PREFIX}, ethereal translucent ghost spirit floating in dark dungeon corridor, "
    f"pale blue-white glowing phantom with flowing robes, eerie supernatural aura, "
    f"wispy smoke-like edges dissolving into darkness, haunting sad expression, "
    f"dim dungeon stone walls background, mysterious otherworldly presence, {STYLE_SUFFIX}",
    os.path.join(OUT_DIR, "dc_ghost.png"), 512, 512
)

# 2. 기습 경고 배경 (빨간 플래시 느낌)
gen(
    f"{STYLE_PREFIX}, dramatic dark dungeon scene with red danger warning flash, "
    f"shadow creature lurking in darkness with glowing red eyes, "
    f"crimson light burst from behind, tense atmosphere, stone walls with claw marks, "
    f"sense of imminent danger and ambush, dark shadows with red highlights, {STYLE_SUFFIX}",
    os.path.join(OUT_DIR, "dc_ambush_bg.png"), 768, 384
)

# 3. 던전 쥐 NPC (귀여운 던전 쥐)
gen(
    f"{STYLE_PREFIX}, small brown dungeon rat standing on hind legs on stone floor, "
    f"cute curious expression with bright beady eyes, whiskers twitching, "
    f"dimly lit dungeon corridor background, warm torchlight on fur, "
    f"small harmless creature, detailed fur texture, {STYLE_SUFFIX}",
    os.path.join(OUT_DIR, "dc_rat.png"), 384, 384
)

# 4. 던전 박쥐 떼
gen(
    f"{STYLE_PREFIX}, swarm of small bats flying from dark dungeon ceiling, "
    f"spreading black wings with leathery texture, dramatic motion blur, "
    f"dark stone ceiling with stalactites, torch light illuminating bat silhouettes, "
    f"dynamic action scene bats scattering in all directions, {STYLE_SUFFIX}",
    os.path.join(OUT_DIR, "dc_bats.png"), 512, 384
)

# 5. 빛나는 버섯 (던전 환경)
gen(
    f"{STYLE_PREFIX}, cluster of magical glowing mushrooms growing on dungeon wall, "
    f"bioluminescent blue-green and purple glow, tiny spores floating in air, "
    f"dark stone dungeon corner, wet mossy environment, ethereal fairy-tale atmosphere, "
    f"fantasy fungi emitting soft magical light, {STYLE_SUFFIX}",
    os.path.join(OUT_DIR, "dc_mushroom.png"), 384, 384
)

# 6. 떠돌이 상인 유령 (친근한 유령 NPC)
gen(
    f"{STYLE_PREFIX}, ghostly translucent merchant spirit in dark dungeon, "
    f"wearing tattered medieval merchant robes with hood, carrying ethereal floating bags, "
    f"friendly but sad ghostly expression, blue-white spectral glow, "
    f"transparent body revealing dungeon wall behind, floating slightly above ground, {STYLE_SUFFIX}",
    os.path.join(OUT_DIR, "dc_ghost_merchant.png"), 384, 512
)

# 7. 벽의 경고문 / 고대 비문
gen(
    f"{STYLE_PREFIX}, close-up of ancient carved warning inscription on dark dungeon stone wall, "
    f"glowing red mysterious runes and symbols, scratched by ancient hands, "
    f"ominous magical lettering with faint red glow, cracked weathered stone surface, "
    f"dramatic side torch lighting casting deep shadows, {STYLE_SUFFIX}",
    os.path.join(OUT_DIR, "dc_wall_runes.png"), 512, 384
)

# 8. 말풍선 배경 프레임 (판타지 스타일)
gen(
    f"{STYLE_PREFIX}, ornate medieval fantasy scroll speech bubble frame border, "
    f"dark parchment with golden filigree edges, gothic decorative corners, "
    f"empty center area for text, weathered aged paper texture, "
    f"delicate golden vine patterns along the edges, dark background, {STYLE_SUFFIX}",
    os.path.join(OUT_DIR, "dc_speech_frame.png"), 384, 256
)

# 9. 던전 분위기 안개 오버레이
gen(
    f"{STYLE_PREFIX}, mysterious dark dungeon fog mist overlay effect, "
    f"ethereal swirling fog tendrils creeping along dark stone floor, "
    f"subtle green-blue mystical haze, volumetric light through fog, "
    f"ground-level atmospheric mist in ancient corridor, moody dark ambiance, {STYLE_SUFFIX}",
    os.path.join(OUT_DIR, "dc_fog_overlay.png"), 768, 256
)

# 10. 횃불 이미지 (밝은 횃불)
gen(
    f"{STYLE_PREFIX}, medieval iron wall torch bracket with burning flame, "
    f"warm orange-yellow fire with embers and sparks floating, mounted on dark stone wall, "
    f"dramatic warm lighting casting dancing shadows, detailed iron metalwork, "
    f"flickering flame with smoke wisps, close-up side view, {STYLE_SUFFIX}",
    os.path.join(OUT_DIR, "dc_torch_img.png"), 256, 512
)

print("\nAll dungeon fun images generated!")
