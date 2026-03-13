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
NEG_PROMPT = "pixel art, cartoon, anime, chibi, low quality, blurry, text, watermark, signature, deformed, ugly"

def gen(prompt, path, w=512, h=512):
    try:
        result = pipe(prompt=prompt, negative_prompt=NEG_PROMPT,
                      num_inference_steps=8, guidance_scale=2.0, width=w, height=h)
        result.images[0].save(path)
        fsize = os.path.getsize(path) / 1024
        print(f"  OK: {path} ({fsize:.0f}KB)")
    except Exception as e:
        print(f"  ERROR: {path} - {e}")

print("\n=== Dungeon UI Enhancement Images ===\n")

# 1. 파티 바 배경 (하단 판넬)
gen(
    f"{STYLE_PREFIX}, dark medieval stone panel texture with ornate iron border, "
    f"carved rune decorations on edges, weathered ancient metal plate, "
    f"subtle purple-blue magical glow along the borders, dark brown stone surface, "
    f"wide horizontal format, game UI panel background, {STYLE_SUFFIX}",
    os.path.join(OUT_DIR, "dc_party_bg.png"), 768, 256
)

# 2. 컨트롤 패널 배경 (방향키 영역)
gen(
    f"{STYLE_PREFIX}, ancient stone compass rose carved into dungeon floor, "
    f"intricate directional arrows pointing north south east west, "
    f"magical glowing rune circle surrounding compass, dark stone texture, "
    f"mystical navigation device embedded in dungeon floor, {STYLE_SUFFIX}",
    os.path.join(OUT_DIR, "dc_compass_panel.png"), 384, 384
)

# 3. 던전 진입 화면 / 로딩 배경
gen(
    f"{STYLE_PREFIX}, massive dark dungeon gate entrance with stone archway, "
    f"glowing purple magical runes on door frame, ancient iron chains and locks, "
    f"misty darkness beyond the entrance, dramatic god rays from torch light, "
    f"imposing and mysterious gateway to the unknown, {STYLE_SUFFIX}",
    os.path.join(OUT_DIR, "dc_loading_bg.png"), 768, 512
)

# 4. 인카운터 배경 업그레이드 (더 고퀄리티)
gen(
    f"{STYLE_PREFIX}, dramatic close-up dark dungeon battle encounter scene, "
    f"red combat flash with dark shadows, crossed swords silhouette, "
    f"intense crimson battle aura explosion, dark medieval dungeon background, "
    f"epic confrontation moment with dramatic radial red light burst, {STYLE_SUFFIX}",
    os.path.join(OUT_DIR, "dc_encounter_bg_v2.png"), 768, 512
)

# 5. 미니맵 프레임 업그레이드 (더 정교한)
gen(
    f"{STYLE_PREFIX}, ornate medieval magical map frame border, "
    f"golden filigree corners with gemstone decorations, aged leather and brass, "
    f"compass markings around edge, mystical purple crystal inlays, "
    f"square format map holder with dark center area, antique cartography frame, {STYLE_SUFFIX}",
    os.path.join(OUT_DIR, "dc_minimap_frame_v2.png"), 384, 384
)

# 6. 출구 이미지 업그레이드
gen(
    f"{STYLE_PREFIX}, glowing green mystical dungeon exit portal archway, "
    f"ancient stone arch with emerald crystal keystone, bright magical green light, "
    f"swirling energy vortex in doorway, rune-carved stone pillars, "
    f"promise of escape and freedom beyond, brilliant green glow illumination, {STYLE_SUFFIX}",
    os.path.join(OUT_DIR, "dc_exit_v2.png"), 384, 512
)

# 7. 복도 배경 업그레이드 (더 디테일)
gen(
    f"{STYLE_PREFIX}, first person view inside dark medieval dungeon corridor, "
    f"stone brick walls with iron torch brackets casting warm orange light, "
    f"cobblestone floor with puddles reflecting torchlight, gothic arched ceiling, "
    f"distant darkness with mysterious blue-green ambient glow, cobwebs and moss, "
    f"atmospheric perspective with depth, symmetrical corridor view, {STYLE_SUFFIX}",
    os.path.join(OUT_DIR, "dc_corridor_bg_v2.png"), 768, 768
)

# 8. 정보 패널 배경 업그레이드
gen(
    f"{STYLE_PREFIX}, ancient magical grimoire page background texture, "
    f"dark parchment with faint purple magical rune watermarks, "
    f"aged yellowed paper edges with mystical border decorations, "
    f"subtle arcane circle pattern in background, dark fantasy journal page, {STYLE_SUFFIX}",
    os.path.join(OUT_DIR, "dc_info_bg_v2.png"), 384, 512
)

print("\nAll UI enhancement images generated!")
