"""Generate AI images for DungeonCrawler exploration UI and additional CrawlerBattle images"""
from diffusers import AutoPipelineForText2Image
import torch, os

pipe = AutoPipelineForText2Image.from_pretrained(
    "stabilityai/sdxl-turbo",
    torch_dtype=torch.float16,
    variant="fp16",
).to("cuda")

OUT = "client/public/ui/dungeon"
os.makedirs(OUT, exist_ok=True)

OUT2 = "client/public/ui/battle"

images = {
    # === DungeonCrawler exploration images ===
    # Ceiling texture
    f"{OUT}/dc_ceiling.png": {
        "prompt": "dark fantasy dungeon ceiling, ancient stone vault with cracks, hanging cobwebs, dim torchlight glow, Gothic architecture arches, dark atmosphere, game texture, seamless, top-down view",
        "size": (768, 256),
    },
    # Floor texture
    f"{OUT}/dc_floor.png": {
        "prompt": "dark fantasy dungeon stone floor, wet cobblestones with moss, ancient runes carved in stone, torchlight reflection, puddles, cracks, game texture, seamless, top-down perspective",
        "size": (768, 256),
    },
    # Front wall texture
    f"{OUT}/dc_wall_front.png": {
        "prompt": "dark fantasy dungeon wall, ancient stone bricks with moss, torch sconces, carved runes glowing faintly purple, cracks and vines, atmospheric fog, game environment texture, front view",
        "size": (512, 512),
    },
    # Side wall texture
    f"{OUT}/dc_wall_side.png": {
        "prompt": "dark fantasy dungeon corridor side wall, receding stone bricks in perspective, torch light casting shadows, Gothic arches, cobwebs, atmospheric, game environment, side perspective view",
        "size": (256, 512),
    },
    # Monster encounter icon (distant)
    f"{OUT}/dc_monster_distant.png": {
        "prompt": "dark menacing monster silhouette in dungeon corridor, glowing red eyes in darkness, shadowy beast lurking, atmospheric fog, fantasy RPG creature, dark ambient lighting, mysterious threatening presence",
        "size": (256, 256),
    },
    # Treasure chest
    f"{OUT}/dc_treasure.png": {
        "prompt": "ornate fantasy treasure chest, golden trim, glowing amber light emanating from inside, ancient wooden chest with metal bands, jewels scattered, dungeon floor, atmospheric lighting, RPG game item",
        "size": (256, 256),
    },
    # Exit portal
    f"{OUT}/dc_exit.png": {
        "prompt": "magical dungeon exit portal, stone archway with glowing green runes, mystical energy swirling, ancient door frame with emerald light, fantasy RPG exit gate, atmospheric fog",
        "size": (256, 256),
    },
    # Encounter flash background
    f"{OUT}/dc_encounter_bg.png": {
        "prompt": "dramatic battle encounter flash, sword clash sparks, red energy explosion, dark fantasy combat initiation, lightning bolts, intense dramatic lighting, RPG battle start screen effect",
        "size": (512, 512),
    },
    # Compass rose
    f"{OUT}/dc_compass.png": {
        "prompt": "ornate fantasy compass rose, golden metallic compass with cardinal directions, intricate filigree design, dark background, glowing runes, RPG UI element, top-down view, circular design",
        "size": (128, 128),
    },
    # Info panel background
    f"{OUT}/dc_info_bg.png": {
        "prompt": "dark fantasy parchment scroll, ancient paper with burned edges, mystical runes border, dark navy background, leather texture frame, RPG game UI panel, vertical scroll",
        "size": (256, 512),
    },
    # Controls background
    f"{OUT}/dc_controls_bg.png": {
        "prompt": "dark fantasy stone control panel, carved stone tablet with runic symbols, ornate metal frame, dark atmospheric background, RPG game UI element, ancient magical interface",
        "size": (256, 256),
    },
    # Monster encounter close-up (here entity)
    f"{OUT}/dc_monster_close.png": {
        "prompt": "fierce fantasy monster face close-up, glowing red eyes, fangs bared, dark dungeon background, dramatic lighting from below, threatening creature encounter, RPG game monster portrait, intense",
        "size": (256, 256),
    },
    # Minimap frame
    f"{OUT}/dc_minimap_frame.png": {
        "prompt": "ornate fantasy minimap frame, golden metallic border with runic engravings, dark glass center, compass points, ancient magical artifact, RPG game UI element, square frame design",
        "size": (256, 256),
    },
    # Log panel background
    f"{OUT}/dc_log_bg.png": {
        "prompt": "dark fantasy adventure journal page, aged parchment with faded text, leather bound book page, quill marks, dark atmospheric, RPG game UI element, vertical scroll texture",
        "size": (512, 256),
    },

    # === Additional CrawlerBattle images ===
    # Inspect magnifying glass icon
    f"{OUT2}/cwb_inspect_icon.png": {
        "prompt": "ornate fantasy magnifying glass icon, golden frame with runic engravings, magical glowing lens, purple mystical energy, dark background, RPG game UI icon, detailed metalwork",
        "size": (128, 128),
    },
    # Target crosshair
    f"{OUT2}/cwb_target_icon.png": {
        "prompt": "fantasy targeting crosshair, red glowing magical target reticle, runic circle with arrows, dark background, RPG game combat UI, mystical red energy, combat targeting symbol",
        "size": (128, 128),
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

print("\nAll dungeon crawler images generated!")
