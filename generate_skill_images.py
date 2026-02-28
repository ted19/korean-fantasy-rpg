import torch
from diffusers import AutoPipelineForText2Image
import os
import time

SKILL_DIR = "F:/project/game/client/public/skills"
os.makedirs(SKILL_DIR, exist_ok=True)

print("Loading SDXL-Turbo model...")
pipe = AutoPipelineForText2Image.from_pretrained(
    "stabilityai/sdxl-turbo",
    torch_dtype=torch.float16,
    variant="fp16"
)
pipe = pipe.to("cuda")
print("Model loaded!")

def generate_image(prompt, output_path, size=256):
    if os.path.exists(output_path):
        print(f"  SKIP (exists): {output_path}")
        return
    try:
        result = pipe(
            prompt=prompt,
            num_inference_steps=4,
            guidance_scale=0.0,
            width=size,
            height=size,
        )
        result.images[0].save(output_path)
        fsize = os.path.getsize(output_path) / 1024
        print(f"  OK: {output_path} ({fsize:.0f}KB)")
    except Exception as e:
        print(f"  ERROR: {output_path} - {e}")

# 캐릭터 스킬 (id는 DB auto_increment 순서: 1~15)
skills = [
    # 풍수사 스킬
    {"id": 1, "name": "화염부", "type": "attack",
     "prompt": "a blazing fire talisman, Korean feng shui fire spell, burning paper charm with red flames erupting, magical fire attack"},
    {"id": 2, "name": "수맥파", "type": "attack",
     "prompt": "an earth shockwave attack, ground cracking with water geyser burst, Korean feng shui earth spell, powerful impact wave"},
    {"id": 3, "name": "풍수결계", "type": "buff",
     "prompt": "a feng shui barrier shield, glowing golden protective dome, Korean mystical ward, swirling compass symbols"},
    {"id": 4, "name": "용맥폭발", "type": "attack",
     "prompt": "a dragon vein explosion, massive energy eruption from the earth, dragon-shaped energy blast, devastating power, epic"},
    {"id": 5, "name": "기운회복", "type": "heal",
     "prompt": "nature energy healing, green healing aura absorbing from plants and earth, gentle restoration glow, Korean spiritual healing"},

    # 무당 스킬
    {"id": 6, "name": "부적소환", "type": "attack",
     "prompt": "summoned curse talismans attacking, floating paper charms with red symbols, Korean shaman offensive spell, ghostly energy"},
    {"id": 7, "name": "영혼흡수", "type": "attack",
     "prompt": "soul absorption attack, draining ghostly blue energy from enemy, Korean shaman dark magic, life steal spell"},
    {"id": 8, "name": "신내림", "type": "buff",
     "prompt": "divine spirit descent, heavenly light descending on shaman, Korean mudang ritual power up, golden divine aura"},
    {"id": 9, "name": "강신술", "type": "attack",
     "prompt": "powerful spirit summoning attack, massive ghost warrior spirit striking, Korean shaman ultimate spell, devastating purple energy"},
    {"id": 10, "name": "치유의식", "type": "heal",
     "prompt": "healing ritual ceremony, warm golden light circle on ground, Korean shaman healing spell, candles and incense, restoration"},

    # 승려 스킬
    {"id": 11, "name": "금강권", "type": "attack",
     "prompt": "diamond fist punch, glowing golden fist strike, Buddhist monk martial arts, vajra energy impact, powerful punch"},
    {"id": 12, "name": "파사권", "type": "attack",
     "prompt": "evil-breaking fist technique, holy golden martial arts combo, Buddhist monk smashing darkness, righteous energy"},
    {"id": 13, "name": "철벽수호", "type": "buff",
     "prompt": "iron wall defense, monk meditating with golden iron shield aura, Buddhist defensive stance, impenetrable barrier"},
    {"id": 14, "name": "나한신권", "type": "attack",
     "prompt": "arhat divine fist, massive transcendent golden punch, Buddhist monk ultimate attack, multiple golden fist projections, epic"},
    {"id": 15, "name": "선정치유", "type": "heal",
     "prompt": "zen meditation healing, monk in deep meditation with warm golden light, lotus flowers, Buddhist healing aura, peaceful"},
]

if __name__ == "__main__":
    start = time.time()

    print(f"\n=== Generating {len(skills)} skill icons ===")
    for s in skills:
        prompt = f"Korean fantasy RPG skill icon, {s['prompt']}, game ability icon, centered composition, dark background, vibrant magical effects, digital painting"
        icon_path = f"{SKILL_DIR}/{s['id']}_icon.png"
        print(f"[{s['id']}/{len(skills)}] {s['name']}...")
        generate_image(prompt, icon_path, size=256)

    elapsed = time.time() - start
    print(f"\n=== Done! Total time: {elapsed:.1f} seconds ===")
    print(f"Generated: {len(skills)} skill icons")
