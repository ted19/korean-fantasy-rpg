"""Regenerate corridor background with centered symmetric composition"""
from diffusers import AutoPipelineForText2Image
import torch

pipe = AutoPipelineForText2Image.from_pretrained(
    "stabilityai/sdxl-turbo",
    torch_dtype=torch.float16,
    variant="fp16",
).to("cuda")

OUT = "client/public/ui/dungeon/dc_corridor_bg.png"

# 정중앙 대칭 강조 프롬프트
prompt = (
    "first person view looking straight ahead down a perfectly symmetrical dark fantasy dungeon corridor, "
    "centered vanishing point in exact middle, "
    "identical stone brick walls on both left and right sides, "
    "gothic vaulted ceiling with arches, cobblestone floor, "
    "matching torch sconces on both walls with purple-blue flames, "
    "perfectly balanced symmetric composition, centered perspective, "
    "dark atmosphere, ancient dungeon, game environment art"
)

best = None
best_score = -1

# 여러 번 생성해서 가장 대칭적인 이미지 선택
for i in range(6):
    img = pipe(
        prompt=prompt,
        negative_prompt="asymmetric, off-center, tilted, crooked, sideways, angled",
        num_inference_steps=4,
        guidance_scale=0.0,
        width=768,
        height=512,
    ).images[0]

    # 좌우 대칭 점수 계산 (픽셀 차이)
    import numpy as np
    arr = np.array(img)
    flipped = np.fliplr(arr)
    diff = np.mean(np.abs(arr.astype(float) - flipped.astype(float)))
    sym_score = 1.0 / (1.0 + diff)
    print(f"  Attempt {i+1}: symmetry score = {sym_score:.4f} (diff={diff:.1f})")

    if sym_score > best_score:
        best_score = sym_score
        best = img

best.save(OUT)
print(f"\nSaved best corridor (symmetry={best_score:.4f}) to {OUT}")
