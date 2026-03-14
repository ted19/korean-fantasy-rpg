"""
용병/소환수/몬스터 스킬 아이콘 생성 - Pillow procedural (원형 구 스타일)
gen_merc_summon_skill_icons.py 와 동일한 draw_skill_icon() 사용

- merc_skills/: 용병 스킬 (ID 29~38 추가분)
- summon_skills/: 소환수 스킬 (ID 21~28 추가분)
- monster_skills/: 몬스터 스킬 (ID 1~29, 48 전체)
"""
from PIL import Image, ImageDraw, ImageFilter
import math
import os
import random

BASE_DIR = "F:/project/game/client/public"
MERC_DIR = f"{BASE_DIR}/merc_skills"
SUMMON_DIR = f"{BASE_DIR}/summon_skills"
MONSTER_DIR = f"{BASE_DIR}/monster_skills"
os.makedirs(MERC_DIR, exist_ok=True)
os.makedirs(SUMMON_DIR, exist_ok=True)
os.makedirs(MONSTER_DIR, exist_ok=True)

SIZE = 256
CENTER = SIZE // 2
RADIUS = 90


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

    # Main circle
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
                sd.ellipse([CENTER-r+5, CENTER-45-r, CENTER+r+5, CENTER-45+r], fill=(*c3, int(160*t)))

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

    elif style in ('talisman', 'seal'):
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

    elif style in ('lightning', 'thunder'):
        pts = [(CENTER-5, CENTER-40), (CENTER+10, CENTER-10), (CENTER-5, CENTER-5),
               (CENTER+15, CENTER+40), (CENTER-10, CENTER+5), (CENTER+5, CENTER+10)]
        sd.polygon(pts, fill=(*c3, 220))
        for r in range(10, 0, -1):
            t = 1 - r/10
            sd.ellipse([CENTER-r+5, CENTER-r-25, CENTER+r+5, CENTER+r-25], fill=(255, 255, 255, int(140*t)))

    elif style in ('crush', 'shatter', 'earthquake', 'quake'):
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
        for r in range(8, 0, -1):
            t = 1 - r/8
            sd.ellipse([CENTER-25-r, CENTER-25-r, CENTER-25+r, CENTER-25+r], fill=(*c3, int(160*t)))

    elif style in ('shadow', 'assassinate', 'dark_orb'):
        for _ in range(6):
            ox = CENTER + random.randint(-35, 35)
            oy = CENTER + random.randint(-35, 35)
            mr = random.randint(10, 25)
            for r in range(mr, 0, -1):
                t = 1 - r/mr
                sd.ellipse([ox-r, oy-r, ox+r, oy+r], fill=(*c3, int(100*t)))
        if style == 'assassinate':
            sd.line([(CENTER-30, CENTER+30), (CENTER+30, CENTER-30)], fill=(*c3, 240), width=4)

    elif style in ('fireball', 'fire_storm', 'fire_breath'):
        for r in range(30, 0, -1):
            t = 1 - r/30
            sd.ellipse([CENTER-r, CENTER-r, CENTER+r, CENTER+r], fill=(*c3, int(200*t)))
        if style in ('fire_storm', 'fire_breath'):
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
        sd.polygon([(CENTER+40, CENTER), (CENTER-20, CENTER-25), (CENTER-20, CENTER+25)],
                   fill=(*c3, 200))
        for r in range(10, 0, -1):
            t = 1 - r/10
            sd.ellipse([CENTER+35-r, CENTER-r, CENTER+35+r, CENTER+r], fill=(255, 255, 255, int(160*t)))

    elif style in ('life_drain', 'drain'):
        for r in range(20, 0, -1):
            t = 1 - r/20
            sd.ellipse([CENTER-r, CENTER-r, CENTER+r, CENTER+r], fill=(*c3, int(200*t)))
        for i in range(6):
            angle = i * math.pi / 3
            x1 = CENTER + int(math.cos(angle) * 50)
            y1 = CENTER + int(math.sin(angle) * 50)
            sd.line([(x1, y1), (CENTER, CENTER)], fill=(*c3, 120), width=2)

    elif style in ('curse_hand', 'death_grip', 'claw'):
        for finger in range(5):
            angle = -0.5 + finger * 0.3
            x1 = CENTER + int(math.cos(angle) * 10)
            y1 = CENTER + 20
            x2 = CENTER + int(math.cos(angle) * 45)
            y2 = CENTER - 30 + finger * 5
            sd.line([(x1, y1), (x2, y2)], fill=(*c3, 180), width=4)
            sd.ellipse([x2-3, y2-3, x2+3, y2+3], fill=(*c3, 200))

    elif style in ('grudge_burst', 'element_burst', 'explosion', 'self_destruct'):
        for _ in range(8):
            angle = random.uniform(0, 2*math.pi)
            dist = random.uniform(10, 50)
            x = CENTER + int(math.cos(angle) * dist)
            y = CENTER + int(math.sin(angle) * dist)
            mr = random.randint(8, 20)
            for r in range(mr, 0, -1):
                t = 1 - r/mr
                sd.ellipse([x-r, y-r, x+r, y+r], fill=(*c3, int(160*t)))

    elif style in ('poison_bite', 'venom', 'poison_cloud'):
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

    elif style in ('undead_revive', 'revive'):
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
        for r in range(10, 0, -1):
            t = 1 - r/10
            sd.ellipse([CENTER-r, CENTER-r-5, CENTER+r, CENTER+r-5], fill=(255, 255, 255, int(140*t)))

    elif style in ('lich_curse', 'curse', 'hex'):
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

    elif style in ('ice', 'freeze'):
        # Ice crystal shape
        for i in range(6):
            angle = i * math.pi / 3
            x1 = CENTER + int(math.cos(angle) * 10)
            y1 = CENTER + int(math.sin(angle) * 10)
            x2 = CENTER + int(math.cos(angle) * 42)
            y2 = CENTER + int(math.sin(angle) * 42)
            sd.line([(x1, y1), (x2, y2)], fill=(*c3, 200), width=3)
            # Branch tips
            for j in [-0.3, 0.3]:
                x3 = CENTER + int(math.cos(angle + j) * 30)
                y3 = CENTER + int(math.sin(angle + j) * 30)
                mx = CENTER + int(math.cos(angle) * 25)
                my = CENTER + int(math.sin(angle) * 25)
                sd.line([(mx, my), (x3, y3)], fill=(*c3, 160), width=2)
        for r in range(10, 0, -1):
            t = 1 - r/10
            sd.ellipse([CENTER-r, CENTER-r, CENTER+r, CENTER+r], fill=(255, 255, 255, int(180*t)))

    elif style in ('roar', 'fear'):
        # Concentric shockwave rings
        for ring_r in [20, 30, 40]:
            sd.ellipse([CENTER-ring_r, CENTER-ring_r, CENTER+ring_r, CENTER+ring_r],
                       outline=(*c3, int(220 - ring_r * 3)), width=3)
        for r in range(12, 0, -1):
            t = 1 - r/12
            sd.ellipse([CENTER-r, CENTER-r, CENTER+r, CENTER+r], fill=(*c3, int(200*t)))

    elif style in ('bite',):
        # Fangs shape
        sd.polygon([(CENTER-25, CENTER-20), (CENTER-15, CENTER+20), (CENTER-5, CENTER-20)], fill=(*c3, 200))
        sd.polygon([(CENTER+5, CENTER-20), (CENTER+15, CENTER+20), (CENTER+25, CENTER-20)], fill=(*c3, 200))
        sd.arc([CENTER-30, CENTER-10, CENTER+30, CENTER+30], 0, 180, fill=(*c3, 160), width=3)

    elif style in ('tail_sweep',):
        sd.arc([CENTER-40, CENTER-20, CENTER+40, CENTER+20], 160, 380, fill=(*c3, 200), width=5)
        for r in range(8, 0, -1):
            t = 1 - r/8
            sd.ellipse([CENTER+35-r, CENTER-r, CENTER+35+r, CENTER+r], fill=(*c3, int(180*t)))

    elif style in ('eye', 'gaze'):
        # Eye shape
        sd.ellipse([CENTER-35, CENTER-18, CENTER+35, CENTER+18], fill=(*c3, 140))
        sd.ellipse([CENTER-15, CENTER-15, CENTER+15, CENTER+15], fill=(*c2, 200))
        for r in range(8, 0, -1):
            t = 1 - r/8
            sd.ellipse([CENTER-r, CENTER-r, CENTER+r, CENTER+r], fill=(0, 0, 0, int(220*t)))

    elif style in ('web',):
        # Spider web
        for i in range(8):
            angle = i * math.pi / 4
            x2 = CENTER + int(math.cos(angle) * 45)
            y2 = CENTER + int(math.sin(angle) * 45)
            sd.line([(CENTER, CENTER), (x2, y2)], fill=(*c3, 160), width=2)
        for ring_r in [15, 30, 45]:
            sd.ellipse([CENTER-ring_r, CENTER-ring_r, CENTER+ring_r, CENTER+ring_r],
                       outline=(*c3, 120), width=1)

    elif style in ('magic_bolt',):
        sd.ellipse([CENTER-12, CENTER-12, CENTER+12, CENTER+12], fill=(*c3, 220))
        sd.line([(CENTER-40, CENTER+15), (CENTER-12, CENTER)], fill=(*c3, 140), width=2)
        sd.line([(CENTER+12, CENTER), (CENTER+40, CENTER-15)], fill=(*c3, 200), width=3)
        for r in range(6, 0, -1):
            t = 1 - r/6
            sd.ellipse([CENTER-r, CENTER-r, CENTER+r, CENTER+r], fill=(255, 255, 255, int(200*t)))

    else:
        # Fallback: generic energy orb
        for r in range(25, 0, -1):
            t = 1 - r/25
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

    # Blur
    r, g, b, a = img.split()
    rgb = Image.merge("RGB", (r, g, b)).filter(ImageFilter.GaussianBlur(1.2))
    r2, g2, b2 = rgb.split()
    img = Image.merge("RGBA", (r2, g2, b2, a))

    return img


# ============================================================
# 용병 스킬 추가분 (ID 29~38, 기존 1~28은 이미 생성됨)
# ============================================================
MERC_SKILLS_NEW = {
    29: ('위협', [(100,20,20), (60,10,10), (180,60,60)], 'fear', 2),
    30: ('방어 약화', [(120,40,160), (80,20,100), (200,80,240)], 'curse', 2),
    31: ('검기 폭발', [(160,180,220), (100,120,160), (220,240,255)], 'explosion', 3),
    32: ('창 돌풍', [(140,160,180), (80,100,120), (200,220,240)], 'quake', 3),
    33: ('화살비', [(100,160,80), (60,120,40), (160,240,120)], 'multi_arrow', 3),
    34: ('봉인술', [(200,180,60), (140,120,30), (255,240,120)], 'seal', 3),
    35: ('전의 상실', [(60,40,80), (30,20,50), (120,80,160)], 'fear', 2),
    36: ('정화', [(200,220,240), (140,160,180), (240,250,255)], 'bless', 2),
    37: ('독 바르기', [(40,120,40), (20,80,20), (80,200,80)], 'venom', 2),
    38: ('얼음 마법', [(100,160,220), (60,100,160), (160,220,255)], 'ice', 3),
}

# ============================================================
# 소환수 스킬 추가분 (ID 21~28, 기존 1~20은 이미 생성됨)
# ============================================================
SUMMON_SKILLS_NEW = {
    21: ('약화의 기운', [(100,60,120), (60,30,80), (160,100,200)], 'curse', 2),
    22: ('원한의 저주', [(80,0,100), (40,0,60), (140,40,180)], 'hex', 3),
    23: ('독의 폭발', [(40,140,0), (20,80,0), (100,220,40)], 'explosion', 3),
    24: ('포식의 포효', [(180,100,0), (120,60,0), (240,160,40)], 'roar', 2),
    25: ('원소 흡수', [(60,140,200), (30,80,140), (120,200,255)], 'drain', 2),
    26: ('원소 폭풍', [(200,120,40), (140,60,20), (255,180,80)], 'fire_storm', 4),
    27: ('죽음의 저주', [(60,60,60), (30,30,30), (120,120,120)], 'curse', 3),
    28: ('해골 폭발', [(180,160,120), (120,100,60), (240,220,180)], 'explosion', 3),
}

# ============================================================
# 몬스터 스킬 (전체, ID 1~29 + 48)
# ============================================================
MONSTER_SKILLS = {
    1:  ('물기', [(180,80,40), (120,40,20), (255,140,80)], 'bite', 1),
    2:  ('독 공격', [(40,140,0), (20,80,0), (100,220,40)], 'venom', 1),
    3:  ('할퀴기', [(160,100,60), (100,60,30), (240,160,100)], 'claw', 1),
    4:  ('화염 토', [(220,80,0), (160,40,0), (255,140,40)], 'fire_breath', 2),
    5:  ('얼음 숨결', [(100,160,220), (60,100,160), (160,220,255)], 'ice', 2),
    6:  ('번개 강타', [(220,200,40), (160,140,20), (255,250,100)], 'thunder', 2),
    7:  ('암흑 구체', [(60,20,80), (30,10,50), (120,60,160)], 'dark_orb', 2),
    8:  ('지진', [(140,100,40), (80,60,20), (200,160,80)], 'quake', 3),
    9:  ('독안개', [(60,120,20), (30,80,10), (120,200,60)], 'poison_cloud', 3),
    10: ('치유', [(40,180,80), (20,120,40), (100,255,140)], 'heal_cross', 1),
    11: ('대치유', [(40,200,100), (20,140,60), (100,255,180)], 'grand_heal', 2),
    12: ('포효', [(200,120,0), (140,80,0), (255,180,40)], 'roar', 2),
    13: ('방어 태세', [(60,100,180), (30,60,120), (120,160,255)], 'shield', 2),
    14: ('약화의 주문', [(120,40,160), (80,20,100), (200,80,240)], 'curse', 2),
    15: ('돌진', [(160,100,40), (100,60,20), (240,160,80)], 'charge', 1),
    16: ('자폭', [(220,40,0), (180,20,0), (255,100,40)], 'self_destruct', 3),
    17: ('생명력 흡수', [(100,0,60), (60,0,30), (180,40,120)], 'life_drain', 2),
    18: ('꼬리 휘두르기', [(140,120,80), (80,60,40), (200,180,120)], 'tail_sweep', 2),
    19: ('마법 화살', [(140,60,200), (80,30,140), (200,120,255)], 'magic_bolt', 1),
    20: ('저주', [(80,0,100), (40,0,60), (140,40,180)], 'hex', 2),
    21: ('마비의 눈길', [(180,180,40), (120,120,20), (240,240,100)], 'gaze', 2),
    22: ('공포의 포효', [(100,20,20), (60,10,10), (180,60,60)], 'fear', 3),
    23: ('기력 흡수', [(60,80,160), (30,40,100), (120,140,220)], 'drain', 2),
    24: ('속박의 거미줄', [(180,180,180), (120,120,120), (240,240,240)], 'web', 2),
    25: ('폭풍 브레스', [(100,140,200), (60,80,140), (160,200,255)], 'fire_breath', 4),
    26: ('암흑 폭발', [(60,0,80), (30,0,50), (120,40,160)], 'explosion', 3),
    27: ('치유의 안개', [(60,200,140), (30,140,80), (120,255,200)], 'heal_cross', 2),
    28: ('광폭화', [(200,40,20), (140,20,10), (255,80,40)], 'power_up', 3),
    29: ('정령 보호', [(60,180,160), (30,120,100), (120,240,220)], 'barrier', 2),
    48: ('빙결', [(120,180,240), (80,120,180), (180,220,255)], 'freeze', 3),
}

# ============================================================
# 메인
# ============================================================
if __name__ == "__main__":
    total = 0
    generated = 0

    all_tasks = [
        ('용병 스킬 (추가)', MERC_DIR, MERC_SKILLS_NEW, 'merc'),
        ('소환수 스킬 (추가)', SUMMON_DIR, SUMMON_SKILLS_NEW, 'summon'),
        ('몬스터 스킬', MONSTER_DIR, MONSTER_SKILLS, 'monster'),
    ]

    for label, out_dir, skill_dict, prefix in all_tasks:
        print(f"\n{'='*50}")
        print(f"{label} ({len(skill_dict)}개)")
        print(f"{'='*50}")

        for skill_id, (name, colors, style, tier) in sorted(skill_dict.items()):
            total += 1
            filepath = os.path.join(out_dir, f"{skill_id}_icon.png")

            if os.path.exists(filepath):
                print(f"  SKIP ID {skill_id}: {name}")
                continue

            icon = draw_skill_icon(colors, style, tier, hash(f"{prefix}_{skill_id}_{name}"))
            icon.save(filepath)
            fsize = os.path.getsize(filepath) / 1024
            print(f"  [T{tier}] ID {skill_id}: {name} ({fsize:.0f}KB)")
            generated += 1

    print(f"\n{'='*50}")
    print(f"Done! Generated: {generated}, Total: {total}")
    print(f"{'='*50}")
