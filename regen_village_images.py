"""
마을 이미지 일괄 재생성 (SDXL-Turbo + 통일 STYLE)
"""
import torch
from diffusers import AutoPipelineForText2Image
from PIL import Image
import os, time

VILLAGE_DIR = "F:/project/game/client/public/village"
os.makedirs(VILLAGE_DIR, exist_ok=True)

print("Loading SDXL-Turbo model...")
pipe = AutoPipelineForText2Image.from_pretrained(
    "stabilityai/sdxl-turbo",
    torch_dtype=torch.float16,
    variant="fp16"
)
pipe = pipe.to("cuda")
print("Model loaded!")

STYLE = (
    "masterpiece, best quality, "
    "Akihiko Yoshida inspired, tactics ogre style, "
    "japanese fantasy RPG illustration, "
)

NEG = "text, watermark, signature, low quality, blurry, deformed, photo, 3d render, cartoon, chibi, anime"

def gen(prompt, w, h, path):
    full = f"{prompt}, {STYLE}"
    scale = max(512 / w, 512 / h, 1.0)
    gen_w = int(w * scale // 8) * 8
    gen_h = int(h * scale // 8) * 8
    img = pipe(prompt=full, negative_prompt=NEG,
               num_inference_steps=4, guidance_scale=0.0,
               width=gen_w, height=gen_h).images[0]
    if (gen_w, gen_h) != (w, h):
        img = img.resize((w, h), Image.LANCZOS)
    img.save(path)
    fsize = os.path.getsize(path) / 1024
    print(f"  OK: {os.path.basename(path)} ({fsize:.0f}KB)")

images = [
    # banner (wide)
    ("fortune_banner", 768, 256,
     "wide panoramic view of a mystical Korean fortune teller's chamber, glowing crystal balls on ornate table, hanging silk curtains with celestial patterns, candles and incense smoke, mystical cyan and purple glow, ancient scrolls and talismans on walls, dark atmospheric interior"),
    ("guild_banner", 768, 256,
     "fantasy adventurer guild hall wide banner, grand stone hall with quest board covered in scrolls, crossed swords emblem with golden laurel wreath crest, burning torches on ancient stone walls, guild banners hanging from ceiling, epic adventurer atmosphere, blue and golden torchlight glow"),
    ("guildmaster_banner", 512, 192,
     "fantasy adventurer guild hall banner header, quest board with pinned scrolls, crossed swords emblem, guild crest with laurel wreath, torchlit stone wall, Korean fantasy decorative frame, dark background with blue torchlight glow"),
    ("innkeeper_banner", 768, 256,
     "wide panoramic interior of Korean fantasy inn, warm wooden furniture, lanterns hanging, cozy atmosphere, traditional korean architecture, fireplace, warm golden light"),
    ("merchant_banner", 512, 192,
     "fantasy shop banner header, ornate golden merchant sign, treasure chest overflowing with goods, potions and weapons on display shelf, Korean fantasy decorative frame, warm golden light, dark rich background"),
    ("summoner_banner", 512, 192,
     "fantasy summoner chamber banner header, magical summoning circle with glowing runes, floating spirit orbs, ancient tomes and crystal balls, mystical purple energy, Korean fantasy decorative frame, dark background with ethereal purple glow"),

    # card
    ("fortune_card", 512, 320,
     "exterior of a mystical Korean fortune teller's house at night, traditional Korean architecture with glowing cyan lanterns, mystical symbols and talismans on doorway, purple and blue mist, stars and moon, enchanted garden with glowing crystals"),
    ("inn_card", 256, 256,
     "fantasy korean traditional inn building exterior, warm lantern light, wooden sign, night scene, cozy atmosphere"),
    ("quest_card", 512, 320,
     "a Korean fantasy adventurer guild hall, large impressive wooden building, guild emblem banner hanging, notice board visible at entrance, torches burning at doorway, warrior statues flanking entrance"),
    ("rest_card", 512, 320,
     "a cozy Korean traditional inn at night, warm orange lantern glow from windows, wooden sign with inn symbol, thatched and tiled roof, welcoming wooden door, small garden, steam rising from chimney"),
    ("shop_card", 512, 320,
     "a Korean fantasy weapon and item shop, wooden storefront with hanging weapons and potions displayed, colorful merchant banner, open window showing shelves of goods, lantern lit"),
    ("summon_card", 512, 320,
     "a Korean mystic summoner cottage, mysterious purple and blue magical glow, spirit orbs floating around, arcane symbols carved on wooden walls, crystal hanging at entrance, dark mystical atmosphere"),

    # icon
    ("quest_icon", 256, 256,
     "a Korean fantasy adventurer guild hall, large wooden building, quest board on wall, warriors gathering, torches and banners, icon style, centered"),
    ("rest_icon", 256, 256,
     "a cozy Korean traditional inn, warm lantern light, wooden building, thatched roof, welcoming entrance, night time, icon style, centered"),
    ("shop_icon", 256, 256,
     "a Korean fantasy item shop, wooden shelves with potions and weapons, merchant counter, hanging lanterns, warm interior, icon style, centered"),
    ("summon_icon", 256, 256,
     "a Korean mystic summoner house, magical purple glow, spirit orbs floating, mysterious wooden cottage, arcane symbols on walls, icon style, centered"),

    # bg
    ("guild_bg", 512, 320,
     "interior of a Korean fantasy adventurer guild hall, large quest board on stone wall, wooden tables with maps, torches on walls, banners with guild emblems, adventurer equipment on display, grand hall atmosphere"),
    ("shop_bg", 512, 320,
     "interior of a Korean fantasy item shop, wooden shelves filled with potions, weapons, and scrolls, warm candlelight, cozy atmosphere, detailed merchant stall, gold coins scattered on counter, lanterns hanging from ceiling"),
    ("summon_bg", 512, 320,
     "interior of a Korean fantasy summoner chamber, magical summoning circle on floor glowing purple, floating crystal orbs, ancient bookshelves with glowing tomes, mystical runes on walls, ethereal mist, arcane laboratory"),
    ("village_bg", 1024, 512,
     "Korean fantasy RPG village panorama, traditional Korean houses with tiled roofs, stone paths, lanterns glowing warmly, cherry blossom trees, mountains in background, evening sky with stars, cozy atmosphere, wooden shop signs, fantasy medieval Korean town, wide landscape view"),
]

if __name__ == "__main__":
    start = time.time()
    print(f"\n=== {len(images)}개 마을 이미지 재생성 ===\n")

    for name, w, h, prompt in images:
        path = os.path.join(VILLAGE_DIR, f"{name}.png")
        print(f"[{name}] ({w}x{h})")
        gen(prompt, w, h, path)

    elapsed = time.time() - start
    print(f"\n=== 완료! {len(images)}장, {elapsed:.1f}초 ===")
