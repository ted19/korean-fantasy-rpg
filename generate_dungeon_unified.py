"""Generate unified dungeon crawler images with consistent art style"""
from diffusers import AutoPipelineForText2Image
import torch, os

pipe = AutoPipelineForText2Image.from_pretrained(
    "stabilityai/sdxl-turbo",
    torch_dtype=torch.float16,
    variant="fp16",
).to("cuda")

OUT = "client/public/ui/dungeon"
os.makedirs(OUT, exist_ok=True)

# 통일된 스타일 키워드
STYLE = "dark fantasy korean dungeon, ancient stone masonry, purple-blue ambient torch lighting, moss and runes, mystical atmosphere, detailed game art, consistent color palette dark navy and purple tones"

images = {
    # 1인칭 메인 배경 - 전체 던전 복도 뷰
    f"{OUT}/dc_corridor_bg.png": {
        "prompt": f"first person view dark fantasy dungeon corridor, stone brick walls receding into darkness, torch sconces with purple-blue flame on both sides, cobblestone floor with perspective lines, vaulted stone ceiling with gothic arches, {STYLE}",
        "size": (768, 512),
    },
    # 전방 벽 텍스처 (동일 스타일)
    f"{OUT}/dc_wall_front.png": {
        "prompt": f"dark fantasy dungeon stone wall texture front view, ancient bricks with carved runes glowing faint purple, moss between stones, torch light from sides casting warm highlights, {STYLE}",
        "size": (512, 512),
    },
    # 몬스터 원거리 실루엣
    f"{OUT}/dc_monster_distant.png": {
        "prompt": f"menacing dark creature silhouette lurking in dungeon corridor, glowing red eyes piercing through darkness, shadowy beast shape, atmospheric purple fog around, {STYLE}",
        "size": (256, 256),
    },
    # 몬스터 근접 조우
    f"{OUT}/dc_monster_close.png": {
        "prompt": f"fierce fantasy monster emerging from dungeon shadows, dramatic close encounter, glowing red eyes and fangs, dark stone walls behind, intense purple-red lighting from below, {STYLE}",
        "size": (256, 256),
    },
    # 보물상자 (동일 스타일)
    f"{OUT}/dc_treasure.png": {
        "prompt": f"ornate treasure chest on dungeon floor, golden glow emanating from within, ancient wooden chest with metal bands, amber light illuminating nearby stone floor, {STYLE}",
        "size": (256, 256),
    },
    # 출구 포탈 (동일 스타일)
    f"{OUT}/dc_exit.png": {
        "prompt": f"magical exit portal in dungeon wall, stone archway with glowing green emerald runes, swirling mystical green energy vortex, ancient carved frame, {STYLE}",
        "size": (256, 256),
    },
    # 조우 오버레이
    f"{OUT}/dc_encounter_bg.png": {
        "prompt": f"dramatic sword clash energy burst, red lightning explosion, dark dungeon background, intense combat flash effect, sparks flying, {STYLE}",
        "size": (512, 512),
    },
}

for path, cfg in images.items():
    print(f"Generating {path}...")
    w, h = cfg["size"]
    img = pipe(
        prompt=cfg["prompt"],
        num_inference_steps=4,
        guidance_scale=0.0,
        width=w,
        height=h,
    ).images[0]
    img.save(path)
    print(f"  Saved {path} ({w}x{h})")

print("\nAll unified dungeon images generated!")
