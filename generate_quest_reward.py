import os
import torch
from diffusers import AutoPipelineForText2Image

os.makedirs('F:/project/game/client/public/ui/quest', exist_ok=True)

pipe = AutoPipelineForText2Image.from_pretrained("stabilityai/sdxl-turbo", torch_dtype=torch.float16, variant="fp16")
pipe = pipe.to("cuda")

output_dir = 'F:/project/game/client/public/ui/quest'

images = [
    {
        "name": "reward_bg.png",
        "prompt": "fantasy treasure room interior, golden light rays, treasure chests overflowing with gold coins and gems, glowing magical rewards, warm golden atmosphere, RPG game art style, detailed illustration, rich colors",
        "width": 600,
        "height": 400,
    },
    {
        "name": "reward_icon.png",
        "prompt": "golden treasure chest opening with bright sparkles and magical light beams emanating from inside, fantasy RPG icon style, detailed, gems and gold visible, dark background, game UI icon",
        "width": 160,
        "height": 160,
    },
    {
        "name": "reward_particles.png",
        "prompt": "golden sparkles, floating gold coins, glowing gem particles, magical dust motes, scattered on pure black background, fantasy RPG particle effects, bright golden light spots, transparent style",
        "width": 600,
        "height": 400,
    },
    {
        "name": "reward_frame.png",
        "prompt": "ornate golden decorative frame border with intricate scrollwork and filigree, fantasy medieval style, elegant gold metalwork, empty center, dark background, game UI frame, high detail",
        "width": 400,
        "height": 448,
    },
    {
        "name": "reward_banner.png",
        "prompt": "horizontal golden ribbon banner decoration with ornate curled edges, fantasy medieval style, rich gold fabric with subtle pattern, game UI element, dark background, elegant scroll banner",
        "width": 512,
        "height": 64,
    },
]

for img_info in images:
    print(f"Generating {img_info['name']}...")
    # SDXL-Turbo requires multiples of 8 for dimensions
    image = pipe(
        prompt=img_info["prompt"],
        num_inference_steps=4,
        guidance_scale=0.0,
        width=img_info["width"],
        height=img_info["height"],
    ).images[0]

    # Resize to exact target if needed
    target_w, target_h = img_info["width"], img_info["height"]
    if img_info["name"] == "reward_frame.png":
        from PIL import Image
        image = image.resize((400, 450), Image.LANCZOS)
    if img_info["name"] == "reward_banner.png":
        from PIL import Image
        image = image.resize((500, 60), Image.LANCZOS)

    filepath = os.path.join(output_dir, img_info["name"])
    image.save(filepath)
    print(f"  Saved: {filepath}")

print("\nAll quest reward images generated successfully!")
