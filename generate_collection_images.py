"""
수집형 용병/소환수 이미지 생성 스크립트
- SDXL-Turbo (RTX 4070 Ti)
- 용병: ID_icon.png (256px), ID_full.png (512px)
- 소환수: ID_icon.png (256px), ID_full.png (512px)
- 이미 존재하는 이미지는 스킵
"""

import torch
from diffusers import StableDiffusionXLPipeline
from PIL import Image
import os
import time
import mysql.connector

# ============================================================
# 설정
# ============================================================
MERC_DIR = "F:/project/game/client/public/mercenaries"
SUMMON_DIR = "F:/project/game/client/public/summons"

os.makedirs(MERC_DIR, exist_ok=True)
os.makedirs(SUMMON_DIR, exist_ok=True)

# 한국 판타지 스타일
STYLE_PREFIX = "Korean fantasy RPG character portrait, official game art illustration"
STYLE_SUFFIX = "highly detailed, dramatic lighting, painterly style, rich colors, dark fantasy, Korean aesthetic, hanbok-inspired"
NEG_PROMPT = "pixel art, cartoon, chibi, low quality, blurry, text, watermark, signature, deformed, extra limbs, bad anatomy, nsfw"

# 등급별 아트 스타일 보정
GRADE_STYLE = {
    '일반': "simple village commoner, humble clothes, muted colors",
    '고급': "trained warrior, decent armor, warm colors",
    '희귀': "elite warrior, ornate armor, magical glow, vibrant colors",
    '영웅': "legendary hero, golden armor, powerful aura, epic composition",
    '전설': "mythical champion, divine armor, radiant energy, celestial glow, masterwork quality",
    '신화': "demigod, transcendent being, ethereal radiance, heavenly aura, godlike presence, ultra detailed",
    '초월': "supreme deity, cosmic power, divine celestial light, galaxy patterns, godly figure, breathtaking composition",
}

# ============================================================
# DB 연결
# ============================================================
def get_db_data():
    conn = mysql.connector.connect(
        host='localhost', user='root', password='root', database='game'
    )
    cursor = conn.cursor(dictionary=True)

    # 기존 이미지가 없는 용병 목록
    cursor.execute("""
        SELECT id, name, class_type, grade, element, description
        FROM mercenary_templates ORDER BY id
    """)
    mercenaries = cursor.fetchall()

    # 기존 이미지가 없는 소환수 목록
    cursor.execute("""
        SELECT id, name, type, grade, element, range_type
        FROM summon_templates ORDER BY id
    """)
    summons = cursor.fetchall()

    cursor.close()
    conn.close()
    return mercenaries, summons


# ============================================================
# 프롬프트 생성
# ============================================================

# 용병 클래스별 외형 힌트
MERC_CLASS_VISUAL = {
    '검사': "swordsman, wielding a Korean sword (geom), agile stance",
    '창병': "spearman, holding a long spear (chang), defensive stance, heavy armor",
    '궁수': "archer, holding a traditional Korean bow (gakgung), focused eyes",
    '도사': "Taoist priest, wielding talismans and charms, mystical robes, prayer beads",
    '무사': "heavy warrior, massive build, great sword or axe, thick armor plates",
    '치유사': "healer, flowing white and green robes, gentle aura, healing herbs",
    '자객': "assassin, dark clothes, daggers and throwing knives, shadowy figure",
    '마법사': "sorcerer, ornate staff, flowing magic robes, arcane energy",
}

# 원소별 시각 효과
ELEMENT_VISUAL = {
    'fire':    "surrounded by flames, red and orange glow",
    'water':   "surrounded by water streams, blue and cyan glow",
    'earth':   "surrounded by rocks and vines, brown and green glow",
    'wind':    "surrounded by wind currents, white and silver glow",
    'neutral': "balanced energy, subtle golden aura",
}

# 소환수 타입별 외형 힌트
SUMMON_TYPE_VISUAL = {
    '몬스터': "fantasy creature, beast",
    '귀신':   "Korean ghost (gwishin), ethereal, translucent, spiritual entity",
    '정령':   "elemental spirit, glowing energy form, magical essence",
    '언데드': "undead creature, skeletal, dark energy, eerie glow",
    '신수':   "divine beast (shinsu), sacred creature, celestial guardian, majestic",
    '용':     "East Asian dragon, serpentine, scales, whiskers, cloud-riding",
    '마수':   "demonic beast, powerful dark creature, fearsome",
}

def build_merc_prompt(merc):
    name = merc['name']
    cls = merc['class_type']
    grade = merc['grade'] or '일반'
    elem = merc['element'] or 'neutral'
    desc = merc['description'] or ''

    cls_visual = MERC_CLASS_VISUAL.get(cls, "Korean fantasy warrior")
    elem_visual = ELEMENT_VISUAL.get(elem, "")
    grade_style = GRADE_STYLE.get(grade, "")

    prompt = f"{STYLE_PREFIX}, {cls_visual}, {grade_style}, {elem_visual}, Korean fantasy RPG mercenary named {name}, {desc}, {STYLE_SUFFIX}"
    return prompt


def build_summon_prompt(summon):
    name = summon['name']
    stype = summon['type']
    grade = summon['grade'] or '일반'
    elem = summon['element'] or 'neutral'

    type_visual = SUMMON_TYPE_VISUAL.get(stype, "fantasy creature")
    elem_visual = ELEMENT_VISUAL.get(elem, "")
    grade_style = GRADE_STYLE.get(grade, "")

    # 특수 소환수별 구체적 프롬프트
    SPECIFIC_PROMPTS = {
        '들쥐 소환수': "small field mouse, cute but fierce, tiny claws",
        '떠도는 원혼': "wandering ghost, wispy ethereal form, Korean ghost",
        '들고양이': "wild cat, sharp eyes, agile hunter, striped fur",
        '도깨비불': "will-o-wisp, floating flame spirit, ghostly fire ball",
        '흙 인형': "earth golem doll, clay figure, animated mud construct",
        '해골병사': "skeleton soldier, rusty armor, sword and shield",
        '산토끼': "mountain rabbit, swift, glowing wind energy",
        '반딧불 정령': "firefly spirit, tiny glowing fairy, bioluminescent",
        '야생 늑대': "dire wolf, fierce eyes, pack hunter",
        '해골 전사': "skeleton warrior, ancient armor, glowing eyes",
        '묘지 귀신': "graveyard ghost, tombstone, Korean burial mound spirit",
        '물의 정령': "water elemental, flowing water body, ocean energy",
        '독사': "venomous serpent, coiled strike pose, dripping venom",
        '나무 정령': "tree spirit, bark skin, leaves growing, ancient wood",
        '부유령': "floating ghost, translucent, hovering above ground",
        '불의 정령': "fire elemental, blazing flames, living inferno",
        '골렘 파편': "stone golem fragment, cracked rock body, glowing runes",
        '바람의 정령': "wind elemental, tornado form, air currents",
        '도깨비': "Korean goblin (dokkaebi), horned, magical club, mischievous",
        '어린 구미호': "young nine-tailed fox, glowing fox spirit, small and cute",
        '강시': "jiangshi, hopping vampire, Qing dynasty clothes, paper talisman on forehead",
        '구미호 영혼': "nine-tailed fox spirit, ethereal beauty, fox fire",
        '독거미 여왕': "giant spider queen, web throne, venomous fangs",
        '리치': "lich, skeletal mage, phylactery, dark magic, floating",
        '뇌전 정령': "thunder elemental, lightning bolts, electric energy form",
        '야차': "yaksha demon, fierce face, muscular, fire wielding",
        '청룡': "Azure Dragon (Cheongryong), East Asian blue dragon, water and clouds",
        '백호': "White Tiger (Baekho), sacred white tiger, wind energy, majestic",
        '주작': "Vermillion Bird (Jujak), phoenix-like firebird, crimson flames",
        '현무': "Black Tortoise (Hyeonmu), giant tortoise with snake, earth and water",
        '봉황': "Korean Phoenix (Bonghwang), sacred firebird, rainbow tail feathers, celestial",
        '해태': "Haetae, lion-dog divine beast, judge of good and evil, stone mane",
        '삼족오': "Three-legged crow (Samjokoh), sun crow, golden solar fire",
        '용왕': "Dragon King (Yongwang), supreme sea dragon, underwater palace, crown",
        '천마': "Heavenly Horse (Cheonma), winged horse, celestial steed, cloud running",
    }

    specific = SPECIFIC_PROMPTS.get(name, f"{name}, {type_visual}")
    prompt = f"{STYLE_PREFIX}, {specific}, {grade_style}, {elem_visual}, Korean fantasy RPG summon creature, {STYLE_SUFFIX}"
    return prompt


# ============================================================
# 이미지 생성
# ============================================================
def generate_image(pipe, prompt, output_path, size=512):
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
        return True
    except Exception as e:
        print(f"  ERROR: {output_path} - {e}")
        return False


def main():
    print("=" * 60)
    print("  수집형 용병/소환수 이미지 생성기")
    print("  SDXL-Turbo | 용병 35종 + 소환수 35종")
    print("=" * 60)

    # DB에서 데이터 로드
    mercenaries, summons = get_db_data()
    print(f"\n용병 {len(mercenaries)}종, 소환수 {len(summons)}종 발견")

    # 이미 존재하는 이미지 스킵 확인
    merc_todo = []
    for m in mercenaries:
        icon_path = os.path.join(MERC_DIR, f"{m['id']}_icon.png")
        full_path = os.path.join(MERC_DIR, f"{m['id']}_full.png")
        if not os.path.exists(icon_path) or not os.path.exists(full_path):
            merc_todo.append(m)

    summon_todo = []
    for s in summons:
        icon_path = os.path.join(SUMMON_DIR, f"{s['id']}_icon.png")
        full_path = os.path.join(SUMMON_DIR, f"{s['id']}_full.png")
        if not os.path.exists(icon_path) or not os.path.exists(full_path):
            summon_todo.append(s)

    total = len(merc_todo) + len(summon_todo)
    print(f"생성 필요: 용병 {len(merc_todo)}종, 소환수 {len(summon_todo)}종 (총 {total * 2}장)")

    if total == 0:
        print("\n모든 이미지가 이미 존재합니다!")
        return

    # 모델 로드
    print("\nLoading SDXL-Turbo model...")
    pipe = StableDiffusionXLPipeline.from_pretrained(
        "stabilityai/sdxl-turbo",
        torch_dtype=torch.float16,
        variant="fp16"
    )
    pipe = pipe.to("cuda")
    pipe.enable_attention_slicing()
    print("Model loaded!\n")

    start_time = time.time()
    done = 0

    # ── 용병 이미지 생성 ──
    print("=" * 40)
    print("  용병 이미지 생성")
    print("=" * 40)

    for m in merc_todo:
        grade = m['grade'] or '일반'
        print(f"\n[{grade}] {m['name']} (ID:{m['id']}, {m['class_type']})")
        prompt = build_merc_prompt(m)

        icon_path = os.path.join(MERC_DIR, f"{m['id']}_icon.png")
        full_path = os.path.join(MERC_DIR, f"{m['id']}_full.png")

        if not os.path.exists(icon_path):
            generate_image(pipe, prompt, icon_path, size=256)
        if not os.path.exists(full_path):
            generate_image(pipe, prompt, full_path, size=512)

        done += 1
        elapsed = time.time() - start_time
        eta = (elapsed / done) * (total - done) if done > 0 else 0
        print(f"  진행: {done}/{total} ({done/total*100:.0f}%) | ETA: {eta/60:.1f}분")

    # ── 소환수 이미지 생성 ──
    print("\n" + "=" * 40)
    print("  소환수 이미지 생성")
    print("=" * 40)

    for s in summon_todo:
        grade = s['grade'] or '일반'
        print(f"\n[{grade}] {s['name']} (ID:{s['id']}, {s['type']})")
        prompt = build_summon_prompt(s)

        icon_path = os.path.join(SUMMON_DIR, f"{s['id']}_icon.png")
        full_path = os.path.join(SUMMON_DIR, f"{s['id']}_full.png")

        if not os.path.exists(icon_path):
            generate_image(pipe, prompt, icon_path, size=256)
        if not os.path.exists(full_path):
            generate_image(pipe, prompt, full_path, size=512)

        done += 1
        elapsed = time.time() - start_time
        eta = (elapsed / done) * (total - done) if done > 0 else 0
        print(f"  진행: {done}/{total} ({done/total*100:.0f}%) | ETA: {eta/60:.1f}분")

    # 완료
    total_time = time.time() - start_time
    print("\n" + "=" * 60)
    print(f"  완료! 총 {done * 2}장 생성 ({total_time/60:.1f}분)")
    print(f"  용병: {MERC_DIR}")
    print(f"  소환수: {SUMMON_DIR}")
    print("=" * 60)


if __name__ == "__main__":
    main()
