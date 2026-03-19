"""
스킬 아이콘 일괄 생성 (Pillow) - 기존 gen_merc_summon_skill_icons.py 방식 재사용
- DB에서 전체 스킬 조회 → 이미지 없는 것만 생성
- 타입별 색상/스타일 자동 매핑
"""
from PIL import Image, ImageDraw, ImageFilter
import math
import os
import random
import mysql.connector

SIZE = 256
CENTER = SIZE // 2
RADIUS = 90

MERC_DIR = "F:/project/game/client/public/merc_skills"
SUMMON_DIR = "F:/project/game/client/public/summon_skills"
MONSTER_DIR = "F:/project/game/client/public/skills"
MONSTER_DIR2 = "F:/project/game/client/public/monster_skills"  # 도감에서 참조하는 폴더
os.makedirs(MERC_DIR, exist_ok=True)
os.makedirs(SUMMON_DIR, exist_ok=True)
os.makedirs(MONSTER_DIR, exist_ok=True)
os.makedirs(MONSTER_DIR2, exist_ok=True)

# 타입별 색상 + 스타일 매핑
TYPE_PRESETS = {
    'attack': {
        'colors': [
            [(180,80,40), (120,40,20), (255,140,80)],
            [(160,60,30), (100,30,15), (240,120,60)],
            [(200,100,50), (140,60,25), (255,160,90)],
            [(140,160,200), (80,100,140), (200,220,255)],
            [(160,40,0), (100,20,0), (240,80,40)],
        ],
        'styles': ['slash', 'single_cut', 'multi_slash', 'sword_wave', 'pierce', 'crush', 'predator', 'charge'],
    },
    'heal': {
        'colors': [
            [(60,200,120), (30,140,80), (120,255,180)],
            [(40,180,140), (20,120,80), (100,255,200)],
            [(80,220,160), (40,160,100), (140,255,220)],
        ],
        'styles': ['heal_cross', 'heal_hand', 'grand_heal', 'soul_heal', 'spirit_bless'],
    },
    'buff': {
        'colors': [
            [(200,120,0), (140,80,0), (255,180,50)],
            [(200,180,60), (140,120,30), (255,240,120)],
            [(100,180,200), (60,120,140), (160,240,255)],
            [(60,80,160), (30,40,100), (120,140,220)],
        ],
        'styles': ['power_up', 'warcry', 'focus', 'barrier', 'bless', 'element_boost', 'shield', 'wall', 'guard', 'mana_focus'],
    },
    'debuff': {
        'colors': [
            [(80,0,120), (40,0,60), (160,40,200)],
            [(120,0,80), (60,0,40), (200,40,140)],
            [(60,0,100), (30,0,60), (120,40,180)],
        ],
        'styles': ['curse_hand', 'death_grip', 'lich_curse', 'shadow', 'poison_bite'],
    },
    'aoe': {
        'colors': [
            [(220,80,0), (160,40,0), (255,140,40)],
            [(240,60,0), (180,30,0), (255,120,40)],
            [(220,120,40), (160,60,20), (255,180,80)],
        ],
        'styles': ['fire_storm', 'grudge_burst', 'element_burst', 'earthquake', 'crush'],
    },
}


def draw_skill_icon(colors, style, tier, seed_val):
    c1, c2, c3 = colors
    glow_mult = 1.0 + (tier - 1) * 0.15

    img = Image.new("RGBA", (SIZE, SIZE), (0, 0, 0, 0))
    draw = ImageDraw.Draw(img)

    # Background glow
    bg = Image.new("RGBA", (SIZE, SIZE), (0, 0, 0, 0))
    bd = ImageDraw.Draw(bg)
    for r in range(int(RADIUS + 35 * glow_mult), RADIUS, -1):
        alpha = int(50 * glow_mult * (1 - (r - RADIUS) / (35 * glow_mult)))
        bd.ellipse([CENTER-r, CENTER-r, CENTER+r, CENTER+r], fill=(*c1, alpha))
    img = Image.alpha_composite(img, bg)

    # Main circle gradient
    draw = ImageDraw.Draw(img)
    for r in range(RADIUS, 0, -1):
        t = r / RADIUS
        cr = int(c2[0] * t + c1[0] * (1-t))
        cg = int(c2[1] * t + c1[1] * (1-t))
        cb = int(c2[2] * t + c1[2] * (1-t))
        draw.ellipse([CENTER-r, CENTER-r, CENTER+r, CENTER+r], fill=(cr, cg, cb, int(220 - t * 40)))

    # Inner symbol
    sym = Image.new("RGBA", (SIZE, SIZE), (0, 0, 0, 0))
    sd = ImageDraw.Draw(sym)
    random.seed(seed_val)

    if style in ('slash', 'single_cut', 'multi_slash', 'sword_wave'):
        num = 3 if style == 'multi_slash' else 1
        for i in range(num):
            offset = (i - num//2) * 12
            sd.line([(CENTER-35+offset, CENTER+35), (CENTER+35+offset, CENTER-35)], fill=(*c3, 220), width=5)
        if style == 'sword_wave':
            sd.arc([CENTER-40, CENTER-20, CENTER+40, CENTER+20], 200, 340, fill=(*c3, 160), width=3)

    elif style in ('shield', 'wall', 'guard'):
        pts = [(CENTER, CENTER-40), (CENTER+35, CENTER-15), (CENTER+30, CENTER+25),
               (CENTER, CENTER+40), (CENTER-30, CENTER+25), (CENTER-35, CENTER-15)]
        sd.polygon(pts, fill=(*c3, 170))
        pts2 = [(CENTER, CENTER-28), (CENTER+22, CENTER-8), (CENTER+18, CENTER+16),
                (CENTER, CENTER+28), (CENTER-18, CENTER+16), (CENTER-22, CENTER-8)]
        sd.polygon(pts2, fill=(*c1, 200))

    elif style in ('power_up', 'warcry', 'wild_release', 'focus'):
        for i in range(8):
            angle = i * math.pi / 4
            x1 = CENTER + int(math.cos(angle) * 15)
            y1 = CENTER + int(math.sin(angle) * 15)
            x2 = CENTER + int(math.cos(angle) * 45)
            y2 = CENTER + int(math.sin(angle) * 45)
            sd.line([(x1, y1), (x2, y2)], fill=(*c3, 180), width=3)
        for r in range(15, 0, -1):
            t = 1 - r/15
            sd.ellipse([CENTER-r, CENTER-r, CENTER+r, CENTER+r], fill=(*c3, int(200*t)))

    elif style in ('heal_cross', 'heal_hand', 'grand_heal', 'soul_heal', 'spirit_bless'):
        w = 10
        sd.rectangle([CENTER-w, CENTER-35, CENTER+w, CENTER+35], fill=(*c3, 200))
        sd.rectangle([CENTER-35, CENTER-w, CENTER+35, CENTER+w], fill=(*c3, 200))
        for r in range(20, 0, -1):
            t = 1 - r/20
            sd.ellipse([CENTER-r, CENTER-r, CENTER+r, CENTER+r], fill=(255, 255, 255, int(120*t)))

    elif style in ('spear', 'pierce'):
        sd.line([(CENTER, CENTER+45), (CENTER, CENTER-45)], fill=(*c3, 220), width=4)
        pts = [(CENTER-10, CENTER-30), (CENTER, CENTER-50), (CENTER+10, CENTER-30)]
        sd.polygon(pts, fill=(*c3, 220))
        if style == 'pierce':
            for r in range(12, 0, -1):
                t = 1 - r/12
                sd.ellipse([CENTER-r+5, CENTER-r-25, CENTER+r+5, CENTER+r-25], fill=(*c3, int(160*t)))

    elif style in ('arrow', 'multi_arrow'):
        count = 3 if style == 'multi_arrow' else 1
        for i in range(count):
            ox = (i - count//2) * 15
            sd.line([(CENTER+ox-30, CENTER+30), (CENTER+ox+30, CENTER-30)], fill=(*c3, 200), width=3)
            pts = [(CENTER+ox+20, CENTER-35), (CENTER+ox+35, CENTER-25), (CENTER+ox+30, CENTER-30)]
            sd.polygon(pts, fill=(*c3, 220))

    elif style in ('crosshair',):
        sd.ellipse([CENTER-30, CENTER-30, CENTER+30, CENTER+30], outline=(*c3, 200), width=3)
        sd.ellipse([CENTER-15, CENTER-15, CENTER+15, CENTER+15], outline=(*c3, 180), width=2)
        sd.line([(CENTER, CENTER-40), (CENTER, CENTER+40)], fill=(*c3, 160), width=2)
        sd.line([(CENTER-40, CENTER), (CENTER+40, CENTER)], fill=(*c3, 160), width=2)

    elif style in ('talisman',):
        sd.rectangle([CENTER-20, CENTER-30, CENTER+20, CENTER+30], fill=(*c3, 160), outline=(*c3, 200), width=2)
        for i in range(4):
            y = CENTER - 20 + i * 12
            sd.line([(CENTER-14, y), (CENTER+14, y)], fill=(*c2, 140), width=2)

    elif style in ('barrier',):
        sd.arc([CENTER-35, CENTER-35, CENTER+35, CENTER+35], 0, 360, fill=(*c3, 180), width=4)
        sd.arc([CENTER-25, CENTER-25, CENTER+25, CENTER+25], 0, 360, fill=(*c3, 140), width=3)
        for r in range(12, 0, -1):
            t = 1 - r/12
            sd.ellipse([CENTER-r, CENTER-r, CENTER+r, CENTER+r], fill=(*c3, int(150*t)))

    elif style in ('lightning',):
        pts = [(CENTER-5, CENTER-40), (CENTER+10, CENTER-10), (CENTER-5, CENTER-5),
               (CENTER+15, CENTER+40), (CENTER-10, CENTER+5), (CENTER+5, CENTER+10)]
        sd.polygon(pts, fill=(*c3, 220))
        for r in range(10, 0, -1):
            t = 1 - r/10
            sd.ellipse([CENTER-r+5, CENTER-r-25, CENTER+r+5, CENTER+r-25], fill=(255, 255, 255, int(140*t)))

    elif style in ('crush', 'shatter', 'earthquake'):
        for _ in range(8):
            angle = random.uniform(0, 2*math.pi)
            dist = random.uniform(15, 45)
            x = CENTER + int(math.cos(angle) * dist)
            y = CENTER + int(math.sin(angle) * dist)
            mr = random.randint(8, 18)
            for r in range(mr, 0, -1):
                t = 1 - r/mr
                sd.ellipse([x-r, y-r, x+r, y+r], fill=(*c3, int(160*t)))

    elif style in ('bless', 'element_boost'):
        for i in range(5):
            angle = i * 2 * math.pi / 5 - math.pi/2
            x = CENTER + int(math.cos(angle) * 30)
            y = CENTER + int(math.sin(angle) * 30)
            for r in range(10, 0, -1):
                t = 1 - r/10
                sd.ellipse([x-r, y-r, x+r, y+r], fill=(*c3, int(200*t)))
        for r in range(8, 0, -1):
            t = 1 - r/8
            sd.ellipse([CENTER-r, CENTER-r, CENTER+r, CENTER+r], fill=(255, 255, 255, int(180*t)))

    elif style in ('stab',):
        sd.line([(CENTER+30, CENTER+30), (CENTER-20, CENTER-20)], fill=(*c3, 220), width=4)
        pts = [(CENTER-25, CENTER-30), (CENTER-30, CENTER-25), (CENTER-20, CENTER-20)]
        sd.polygon(pts, fill=(*c3, 220))

    elif style in ('shadow', 'assassinate'):
        for _ in range(6):
            ox = CENTER + random.randint(-35, 35)
            oy = CENTER + random.randint(-35, 35)
            mr = random.randint(10, 25)
            for r in range(mr, 0, -1):
                t = 1 - r/mr
                sd.ellipse([ox-r, oy-r, ox+r, oy+r], fill=(*c3, int(100*t)))
        if style == 'assassinate':
            sd.line([(CENTER-30, CENTER+30), (CENTER+30, CENTER-30)], fill=(*c3, 240), width=4)

    elif style in ('fireball', 'fire_storm'):
        for r in range(30, 0, -1):
            t = 1 - r/30
            sd.ellipse([CENTER-r, CENTER-r, CENTER+r, CENTER+r], fill=(*c3, int(200*t)))
        if style == 'fire_storm':
            for _ in range(10):
                angle = random.uniform(0, 2*math.pi)
                dist = random.uniform(20, 50)
                x = CENTER + int(math.cos(angle) * dist)
                y = CENTER + int(math.sin(angle) * dist)
                mr = random.randint(6, 14)
                for r in range(mr, 0, -1):
                    tt = 1 - r/mr
                    sd.ellipse([x-r, y-r, x+r, y+r], fill=(*c3, int(140*tt)))

    elif style in ('mana_focus',):
        sd.ellipse([CENTER-30, CENTER-30, CENTER+30, CENTER+30], fill=(*c3, 120))
        for i in range(6):
            angle = i * math.pi / 3
            x1 = CENTER + int(math.cos(angle) * 45)
            y1 = CENTER + int(math.sin(angle) * 45)
            sd.line([(x1, y1), (CENTER, CENTER)], fill=(*c3, 140), width=2)
        for r in range(15, 0, -1):
            t = 1 - r/15
            sd.ellipse([CENTER-r, CENTER-r, CENTER+r, CENTER+r], fill=(255, 255, 255, int(200*t)))

    elif style in ('charge',):
        sd.polygon([(CENTER+40, CENTER), (CENTER-20, CENTER-25), (CENTER-20, CENTER+25)], fill=(*c3, 200))
        for r in range(10, 0, -1):
            t = 1 - r/10
            sd.ellipse([CENTER+35-r, CENTER-r, CENTER+35+r, CENTER+r], fill=(255, 255, 255, int(160*t)))

    elif style in ('life_drain',):
        for r in range(20, 0, -1):
            t = 1 - r/20
            sd.ellipse([CENTER-r, CENTER-r, CENTER+r, CENTER+r], fill=(*c3, int(200*t)))
        for i in range(6):
            angle = i * math.pi / 3
            x1 = CENTER + int(math.cos(angle) * 50)
            y1 = CENTER + int(math.sin(angle) * 50)
            sd.line([(x1, y1), (CENTER, CENTER)], fill=(*c3, 120), width=2)

    elif style in ('curse_hand', 'death_grip'):
        for finger in range(5):
            angle = -0.5 + finger * 0.3
            x1 = CENTER + int(math.cos(angle) * 10)
            y1 = CENTER + 20
            x2 = CENTER + int(math.cos(angle) * 45)
            y2 = CENTER - 30 + finger * 5
            sd.line([(x1, y1), (x2, y2)], fill=(*c3, 180), width=4)
            sd.ellipse([x2-3, y2-3, x2+3, y2+3], fill=(*c3, 200))

    elif style in ('grudge_burst', 'element_burst'):
        for _ in range(8):
            angle = random.uniform(0, 2*math.pi)
            dist = random.uniform(10, 50)
            x = CENTER + int(math.cos(angle) * dist)
            y = CENTER + int(math.sin(angle) * dist)
            mr = random.randint(8, 20)
            for r in range(mr, 0, -1):
                t = 1 - r/mr
                sd.ellipse([x-r, y-r, x+r, y+r], fill=(*c3, int(160*t)))

    elif style in ('poison_bite', 'venom'):
        sd.arc([CENTER-30, CENTER-20, CENTER+30, CENTER+20], 200, 340, fill=(*c3, 200), width=4)
        sd.arc([CENTER-25, CENTER-10, CENTER+25, CENTER+20], 20, 160, fill=(*c3, 200), width=4)
        for _ in range(5):
            ox = CENTER + random.randint(-25, 25)
            oy = CENTER + random.randint(-25, 25)
            for r in range(8, 0, -1):
                t = 1 - r/8
                sd.ellipse([ox-r, oy-r, ox+r, oy+r], fill=(*c3, int(120*t)))

    elif style in ('predator',):
        for i in range(3):
            y_off = -15 + i * 15
            sd.line([(CENTER-30, CENTER+y_off-10), (CENTER, CENTER+y_off+5), (CENTER+30, CENTER+y_off-10)],
                    fill=(*c3, 200), width=3)

    elif style in ('bone_armor',):
        pts = [(CENTER, CENTER-40), (CENTER+30, CENTER-10), (CENTER+25, CENTER+25),
               (CENTER, CENTER+35), (CENTER-25, CENTER+25), (CENTER-30, CENTER-10)]
        sd.polygon(pts, fill=(*c3, 140))
        for i in range(3):
            y = CENTER - 20 + i * 15
            sd.line([(CENTER-15, y), (CENTER+15, y)], fill=(*c2, 120), width=3)

    elif style in ('undead_revive',):
        for w in range(30, 0, -1):
            a = int(80 * (1 - w/30))
            sd.rectangle([CENTER-w, CENTER-45, CENTER+w, CENTER+45], fill=(*c3, a))
        for r in range(15, 0, -1):
            t = 1 - r/15
            sd.ellipse([CENTER-r, CENTER-40-r, CENTER+r, CENTER-40+r], fill=(255, 255, 255, int(180*t)))

    elif style in ('charm',):
        sd.ellipse([CENTER-25, CENTER-25, CENTER, CENTER+5], fill=(*c3, 200))
        sd.ellipse([CENTER, CENTER-25, CENTER+25, CENTER+5], fill=(*c3, 200))
        sd.polygon([(CENTER-25, CENTER-5), (CENTER, CENTER+35), (CENTER+25, CENTER-5)], fill=(*c3, 200))

    elif style in ('lich_curse',):
        sd.ellipse([CENTER-35, CENTER-35, CENTER+35, CENTER+35], outline=(*c3, 180), width=3)
        for i in range(5):
            angle = i * 2 * math.pi / 5 - math.pi/2
            x1 = CENTER + int(math.cos(angle) * 35)
            y1 = CENTER + int(math.sin(angle) * 35)
            a2 = angle + 2 * (2 * math.pi / 5)
            x2 = CENTER + int(math.cos(a2) * 35)
            y2 = CENTER + int(math.sin(a2) * 35)
            sd.line([(x1, y1), (x2, y2)], fill=(*c3, 160), width=2)
        for r in range(12, 0, -1):
            t = 1 - r/12
            sd.ellipse([CENTER-r, CENTER-r, CENTER+r, CENTER+r], fill=(*c3, int(200*t)))

    else:
        # fallback: fireball style
        for r in range(30, 0, -1):
            t = 1 - r/30
            sd.ellipse([CENTER-r, CENTER-r, CENTER+r, CENTER+r], fill=(*c3, int(200*t)))

    img = Image.alpha_composite(img, sym)

    # Tier border
    tier_colors = {1: (100,100,140), 2: (120,120,180), 3: (140,100,200), 4: (180,120,255)}
    tc = tier_colors.get(tier, (100,100,140))
    ring = Image.new("RGBA", (SIZE, SIZE), (0, 0, 0, 0))
    rd = ImageDraw.Draw(ring)
    for r in range(RADIUS+2, RADIUS-2, -1):
        a = int(180 * (1 - abs(RADIUS - r) / 2))
        rd.ellipse([CENTER-r, CENTER-r, CENTER+r, CENTER+r], outline=(*tc, a), width=2)
    img = Image.alpha_composite(img, ring)

    # Sparkles
    sparkle = Image.new("RGBA", (SIZE, SIZE), (0, 0, 0, 0))
    spd = ImageDraw.Draw(sparkle)
    for _ in range(tier * 2 + 3):
        angle = random.uniform(0, 2*math.pi)
        dist = random.uniform(25, 80)
        sx = int(CENTER + math.cos(angle) * dist)
        sy = int(CENTER + math.sin(angle) * dist)
        sr = random.randint(1, 2)
        spd.ellipse([sx-sr, sy-sr, sx+sr, sy+sr], fill=(255, 255, 255, random.randint(100, 200)))
    img = Image.alpha_composite(img, sparkle)

    # Gaussian blur
    r, g, b, a = img.split()
    rgb = Image.merge("RGB", (r, g, b)).filter(ImageFilter.GaussianBlur(1.2))
    r2, g2, b2 = rgb.split()
    img = Image.merge("RGBA", (r2, g2, b2, a))

    return img


def get_style_and_colors(skill_type, skill_name, seed):
    preset = TYPE_PRESETS.get(skill_type, TYPE_PRESETS['attack'])
    random.seed(seed)
    colors = random.choice(preset['colors'])
    style = random.choice(preset['styles'])
    # 스킬 이름 기반 스타일 힌트
    name_lower = skill_name.lower() if skill_name else ''
    for kw, st in [('검','slash'),('참','multi_slash'),('창','spear'),('찌르','pierce'),('화살','arrow'),('사격','arrow'),
                    ('연사','multi_arrow'),('화염','fire_storm'),('불','fireball'),('번개','lightning'),('뇌','lightning'),
                    ('치유','heal_cross'),('회복','grand_heal'),('축복','bless'),('부활','undead_revive'),
                    ('방어','shield'),('방벽','barrier'),('철벽','wall'),('보호','guard'),('갑','bone_armor'),
                    ('독','poison_bite'),('맹독','venom'),('저주','curse_hand'),('약화','death_grip'),
                    ('암살','assassinate'),('그림자','shadow'),('습격','shadow'),
                    ('분쇄','crush'),('지진','earthquake'),('파쇄','shatter'),
                    ('포효','warcry'),('함성','warcry'),('기합','power_up'),('집중','focus'),('강화','element_boost'),
                    ('마력','mana_focus'),('흡수','life_drain'),('흡혈','life_drain'),
                    ('돌격','charge'),('돌진','charge'),('관통','pierce'),('메테오','fire_storm'),
                    ('폭발','grudge_burst'),('폭풍','fire_storm'),('매혹','charm'),('연막','barrier')]:
        if kw in name_lower:
            style = st
            break
    # 티어 (레벨 기반)
    return colors, style


def level_to_tier(level):
    if level >= 60: return 4
    if level >= 30: return 3
    if level >= 10: return 2
    return 1


if __name__ == "__main__":
    print("Connecting to database...")
    conn = mysql.connector.connect(host='localhost', user='root', password='root', database='game')
    cursor = conn.cursor(dictionary=True)

    cursor.execute("SELECT id, name, type, required_level FROM mercenary_skills ORDER BY id")
    merc_skills = cursor.fetchall()
    cursor.execute("SELECT id, name, type, required_level FROM summon_skills ORDER BY id")
    summon_skills = cursor.fetchall()
    cursor.execute("SELECT id, name, type, cooldown as required_level FROM monster_skills ORDER BY id")
    monster_skills = cursor.fetchall()
    # 캐릭터 스킬 트리 (active 노드만)
    cursor.execute("SELECT id, name, IFNULL(skill_type,'buff') as type, required_level FROM skill_tree_nodes WHERE node_type='active' ORDER BY id")
    tree_skills = cursor.fetchall()
    # 기본 스킬 (skills 테이블)
    cursor.execute("SELECT id, name, type, required_level FROM skills ORDER BY id")
    basic_skills = cursor.fetchall()
    conn.close()

    SKILL_DIR = "F:/project/game/client/public/skills"
    os.makedirs(SKILL_DIR, exist_ok=True)

    generated = 0
    skipped = 0

    print(f"\n{'='*50}")
    print(f"  Skill Icon Generator (Original Pillow Style)")
    print(f"  스킬트리 {len(tree_skills)} / 기본스킬 {len(basic_skills)} / 용병 {len(merc_skills)} / 소환수 {len(summon_skills)} / 몬스터 {len(monster_skills)}")
    print(f"{'='*50}\n")

    for s in merc_skills:
        path = os.path.join(MERC_DIR, f"{s['id']}_icon.png")
        if os.path.exists(path):
            skipped += 1; continue
        colors, style = get_style_and_colors(s['type'], s['name'], s['id'] * 7 + 13)
        tier = level_to_tier(s['required_level'] or 1)
        img = draw_skill_icon(colors, style, tier, hash(f"merc_{s['id']}_{s['name']}"))
        img.save(path)
        generated += 1
        print(f"  [merc] {s['id']} {s['name']} ({s['type']}, T{tier})")

    for s in summon_skills:
        path = os.path.join(SUMMON_DIR, f"{s['id']}_icon.png")
        if os.path.exists(path):
            skipped += 1; continue
        colors, style = get_style_and_colors(s['type'], s['name'], s['id'] * 11 + 37)
        tier = level_to_tier(s['required_level'] or 1)
        img = draw_skill_icon(colors, style, tier, hash(f"summon_{s['id']}_{s['name']}"))
        img.save(path)
        generated += 1
        print(f"  [summon] {s['id']} {s['name']} ({s['type']}, T{tier})")

    for s in monster_skills:
        path = os.path.join(MONSTER_DIR, f"{s['id']}_icon.png")
        path2 = os.path.join(MONSTER_DIR2, f"{s['id']}_icon.png")
        if os.path.exists(path) and os.path.exists(path2):
            skipped += 1; continue
        colors, style = get_style_and_colors(s['type'], s['name'], s['id'] * 13 + 53)
        tier = level_to_tier((s['required_level'] or 1) * 10)
        img = draw_skill_icon(colors, style, tier, hash(f"monster_{s['id']}_{s['name']}"))
        img.save(path)
        img.save(path2)  # monster_skills/ 폴더에도 저장
        generated += 1
        print(f"  [monster] {s['id']} {s['name']} ({s['type']}, T{tier})")

    # 캐릭터 스킬 트리 아이콘
    for s in tree_skills:
        path = os.path.join(SKILL_DIR, f"{s['id']}_icon.png")
        if os.path.exists(path):
            skipped += 1; continue
        colors, style = get_style_and_colors(s['type'], s['name'], s['id'] * 17 + 71)
        tier = level_to_tier(s['required_level'] or 1)
        img = draw_skill_icon(colors, style, tier, hash(f"tree_{s['id']}_{s['name']}"))
        img.save(path)
        generated += 1
        print(f"  [tree] {s['id']} {s['name']} ({s['type']}, T{tier})")

    # 기본 스킬 아이콘
    for s in basic_skills:
        path = os.path.join(SKILL_DIR, f"{s['id']}_icon.png")
        if os.path.exists(path):
            skipped += 1; continue
        colors, style = get_style_and_colors(s['type'], s['name'], s['id'] * 19 + 83)
        tier = level_to_tier(s['required_level'] or 1)
        img = draw_skill_icon(colors, style, tier, hash(f"basic_{s['id']}_{s['name']}"))
        img.save(path)
        generated += 1
        print(f"  [basic] {s['id']} {s['name']} ({s['type']}, T{tier})")

    print(f"\n{'='*50}")
    print(f"  완료! 생성: {generated}장, 스킵: {skipped}장")
    print(f"{'='*50}")
