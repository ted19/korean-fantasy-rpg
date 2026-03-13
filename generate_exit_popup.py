"""
Generate AI images for dungeon exit popups:
1. dc_exit_clear.png - Open exit portal with golden light, freedom
2. dc_exit_blocked.png - Sealed/locked exit with red barrier, chains
"""
from diffusers import AutoPipelineForText2Image
import torch

pipe = AutoPipelineForText2Image.from_pretrained(
    "stabilityai/sdxl-turbo",
    torch_dtype=torch.float16,
    variant="fp16"
)
pipe.to("cuda")

images = {
    "client/public/ui/dungeon/dc_exit_clear.png": (
        "fantasy dungeon exit portal glowing golden light, "
        "open ornate stone gate leading to bright sunlight outside, "
        "magical golden particles floating, carved ancient runes on pillars, "
        "warm light rays streaming through doorway, freedom atmosphere, "
        "lush green landscape visible through gate, triumphant mood, "
        "fantasy RPG game art style, high detail, cinematic lighting"
    ),
    "client/public/ui/dungeon/dc_exit_blocked.png": (
        "sealed dungeon exit blocked by magical red barrier, "
        "heavy iron chains wrapped around ancient stone gate, "
        "glowing red runes and seal marks on door, ominous atmosphere, "
        "dark dungeon corridor, red energy crackling around locked gate, "
        "forbidden passage, danger warning symbols carved in stone, "
        "dark fantasy RPG game art style, dramatic red lighting, high detail"
    ),
}

for path, prompt in images.items():
    print(f"Generating: {path}")
    img = pipe(
        prompt=prompt,
        num_inference_steps=6,
        guidance_scale=2.0,
        width=512,
        height=512,
    ).images[0]
    img.save(path)
    print(f"  Saved: {path}")

print("Done! All exit popup images generated.")
