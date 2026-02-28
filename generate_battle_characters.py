import torch
from diffusers import StableDiffusionXLPipeline
from PIL import Image
import os
import time

# 디렉토리
OUT_DIR = "F:/project/game/client/public/characters/battle"
os.makedirs(OUT_DIR, exist_ok=True)

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

STYLE_PREFIX = "in the style of Dungeons and Dragons concept art, official D&D character illustration"
STYLE_SUFFIX = "highly detailed, dramatic lighting, painterly style, rich colors, dark fantasy, dynamic pose, solid dark background, full body visible, centered composition"
NEG_PROMPT = "pixel art, cartoon, anime, chibi, low quality, blurry, text, watermark, signature, deformed, multiple characters, crowded background, landscape"

def generate_image(prompt, output_path, size=512):
    try:
        result = pipe(
            prompt=prompt,
            negative_prompt=NEG_PROMPT,
            num_inference_steps=8,
            guidance_scale=2.0,
            width=size,
            height=size,
        )
        result.images[0].save(output_path)
        fsize = os.path.getsize(output_path) / 1024
        print(f"  OK: {output_path} ({fsize:.0f}KB)")
    except Exception as e:
        print(f"  ERROR: {output_path} - {e}")

# 캐릭터별 전투 스프라이트 프롬프트
BATTLE_SPRITES = {
    "pungsu": {
        "name": "풍수사",
        "idle": "A Korean pungsu geomancer standing in a ready combat stance, scholarly male figure in elegant dark navy and teal traditional hanbok robes embroidered with wind and water symbols, a magical luopan compass floating beside him emitting golden energy, one hand raised with swirling wind and water chi around fingers, long black hair in scholar's topknot flowing in magical wind, intelligent piercing eyes, talismanic scrolls in sash, full body front-facing pose, solid dark background",
        "attack": "A Korean pungsu geomancer unleashing a powerful wind and water spell attack, male figure in dark navy hanbok robes lunging forward with both hands extended, massive torrent of swirling blue-teal water and wind chi blasting from his palms creating a spiral vortex, magical luopan compass spinning wildly overhead, hair whipping in magical storm, face intense with concentration, golden energy runes exploding outward, robes billowing dramatically, full body action pose, solid dark background",
        "skill": "A Korean pungsu geomancer channeling ultimate cosmic geomancy power, male figure in dark navy hanbok robes floating slightly off the ground, surrounded by a complex circular formation of golden ley line energy, both arms outstretched commanding earth wind and water elements simultaneously, five element symbols orbiting his body, eyes glowing with cosmic power, feng shui compass projecting a massive golden map of energy lines, hair floating upward in anti-gravity, intense magical aura, full body pose, solid dark background",
        "hurt": "A Korean pungsu geomancer recoiling from a hit, male figure in dark navy hanbok robes staggering backward with one arm raised defensively, magical shield of water chi shattering around him with fragments of blue energy scattering, face grimacing in pain, luopan compass flickering, robes torn slightly, defensive posture, full body pose, solid dark background",
    },
    "mudang": {
        "name": "무당",
        "idle": "A Korean mudang shaman priestess in a confident combat ready stance, dynamic female figure in vibrant ceremonial hanbok of layered reds whites and blues with spirit ribbons, holding ritual spirit bells in one hand and ceremonial fan in the other, face marked with sacred patterns, multiple faint translucent ancestral spirits floating around her, prayer beads and talismans hanging from her waist, intense focused gaze, full body front-facing pose, solid dark background",
        "attack": "A Korean mudang shaman priestess performing a devastating spirit attack, female figure in vibrant red and white ceremonial hanbok spinning with a spirit fan unleashing a wave of ghostly ancestral spirits that rush forward as translucent blue-white specters, spirit bells ringing with visible shockwaves of sound energy, her eyes blazing white with channeled spirit power, paper talismans flying outward like projectiles burning with spiritual fire, dynamic spinning attack pose, hair and ribbons whipping, full body action pose, solid dark background",
        "skill": "A Korean mudang shaman priestess performing the ultimate ecstatic spirit ritual, female figure in vibrant ceremonial hanbok dancing in a trance state surrounded by a massive swirl of dozens of ancestral spirits forming a protective vortex, eyes rolled back glowing pure white, spirit bells creating visible rings of holy sound energy, ceremonial fan directing a tsunami of spirit energy, her body partially translucent merging with the spirit realm, paper talismans orbiting like a constellation, extreme spiritual power radiating, full body pose, solid dark background",
        "hurt": "A Korean mudang shaman priestess knocked back by an attack, female figure in vibrant ceremonial hanbok thrown off balance with spirit bells scattering, protective ancestor spirits rushing to shield her with translucent forms, face showing pain and determination, spirit ribbons torn and floating, one hand reaching out to maintain spiritual connection, defensive spiritual barrier cracking, full body pose, solid dark background",
    },
    "monk": {
        "name": "승려",
        "idle": "A Korean Buddhist warrior monk in a powerful martial arts stance, muscular disciplined male figure in deep saffron and burnt orange monk robes with one shoulder bare showing defined muscles with sutra tattoos, prayer bead mala wrapped around one forearm, other fist clenched with faint golden spiritual energy, shaved head with nine monk scars, serene but fierce expression, wooden staff weapon held diagonally, grounded wide stance, golden spiritual aura around fists, full body front-facing pose, solid dark background",
        "attack": "A Korean Buddhist warrior monk delivering a devastating power strike, muscular male figure in saffron monk robes lunging forward with a massive golden ki-empowered fist punch, brilliant explosion of golden spiritual energy erupting from his fist on impact, prayer beads swinging wildly, the other arm pulled back for follow-up strike, face showing fierce battle cry, sutra tattoos on bare shoulder glowing with activated power, ground cracking beneath his feet from the force, dynamic punching action pose, full body pose, solid dark background",
        "skill": "A Korean Buddhist warrior monk channeling ultimate Buddha palm divine technique, muscular male figure in saffron robes floating in meditation pose with legs crossed mid-air, surrounded by a massive golden mandala of Buddhist sacred geometry, both palms facing outward projecting enormous transparent golden hands of divine energy, nine monk scars glowing brilliantly, prayer beads orbiting his body in a halo formation, sutra characters flowing from his body in streams of light, eyes closed in perfect concentration, immense golden aura, full body pose, solid dark background",
        "hurt": "A Korean Buddhist warrior monk absorbing a heavy blow, muscular male figure in saffron robes bracing with crossed arms and a golden barrier of ki energy shattering against the impact, face gritting teeth with determination, prayer beads scattering from the force, one knee slightly bent absorbing impact, sutra tattoos flickering, defensive iron body technique activating with golden light under skin, cracked ground beneath, full body pose, solid dark background",
    },
}

if __name__ == "__main__":
    start = time.time()
    total = len(BATTLE_SPRITES) * 4  # 3 classes x 4 poses
    count = 0

    print(f"\n=== Generating {total} battle character sprites ===\n")

    for char_id, data in BATTLE_SPRITES.items():
        for pose in ["idle", "attack", "skill", "hurt"]:
            count += 1
            prompt = f"{STYLE_PREFIX}, {data[pose]}, {STYLE_SUFFIX}"
            path = f"{OUT_DIR}/{char_id}_{pose}.png"
            print(f"[{count}/{total}] {data['name']} - {pose}...")
            generate_image(prompt, path, size=512)

    elapsed = time.time() - start
    print(f"\nDone! {total} images in {elapsed:.1f}s")
