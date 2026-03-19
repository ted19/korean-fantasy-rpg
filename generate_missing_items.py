"""
누락된 장비 아이템 아이콘 일괄 생성 (Pillow 기반)
- DB에서 이미지 없는 아이템 조회 → 타입/서브타입별 스타일로 생성
"""
from PIL import Image, ImageDraw, ImageFilter
import math, os, random
import mysql.connector

SIZE = 256
CENTER = SIZE // 2
RADIUS = 90
OUT_DIR = "F:/project/game/client/public/equipment"
os.makedirs(OUT_DIR, exist_ok=True)

# 타입별 색상 팔레트
TYPE_COLORS = {
    'sword':       [(180,80,40), (120,40,20), (255,140,80)],
    'axe':         [(160,60,30), (100,30,15), (240,120,60)],
    'spear':       [(140,160,200), (80,100,140), (200,220,255)],
    'bow':         [(60,140,60), (30,80,30), (120,220,120)],
    'staff':       [(100,60,180), (50,30,120), (160,100,255)],
    'talisman':    [(180,140,60), (120,80,20), (255,200,80)],
    'bell':        [(200,120,200), (140,60,140), (255,180,255)],
    'moktak':      [(180,160,100), (120,100,50), (240,220,160)],
    'scythe':      [(60,0,100), (30,0,60), (120,40,180)],
    'mace':        [(140,140,140), (80,80,80), (200,200,200)],
    'greatshield': [(120,100,60), (70,50,20), (180,160,100)],
    'sinkal':      [(200,60,60), (140,30,30), (255,120,80)],
    'helmet':      [(100,120,160), (50,70,110), (160,180,220)],
    'chest':       [(120,100,80), (70,50,30), (180,160,140)],
    'boots':       [(100,80,60), (50,40,20), (160,140,120)],
    'shield':      [(80,100,140), (40,50,80), (140,160,200)],
}

def draw_item_icon(item_type, subtype, name, seed_val, level):
    colors = TYPE_COLORS.get(subtype or item_type, TYPE_COLORS.get(item_type, [(100,100,100),(50,50,50),(180,180,180)]))
    # 레벨에 따라 색 밝기 조절
    tier = 1 if level < 10 else 2 if level < 30 else 3 if level < 60 else 4
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

    # Inner symbol based on type
    sym = Image.new("RGBA", (SIZE, SIZE), (0, 0, 0, 0))
    sd = ImageDraw.Draw(sym)
    random.seed(seed_val)

    effective_type = subtype or item_type

    if effective_type in ('sword', 'sinkal'):
        # 검 형태
        sd.line([(CENTER-25, CENTER+40), (CENTER+25, CENTER-40)], fill=(*c3, 220), width=6)
        sd.polygon([(CENTER+20, CENTER-45), (CENTER+30, CENTER-35), (CENTER+25, CENTER-40)], fill=(*c3, 240))
        sd.line([(CENTER-15, CENTER+5), (CENTER+15, CENTER-5)], fill=(*c3, 180), width=4)

    elif effective_type == 'axe':
        # 도끼
        sd.line([(CENTER, CENTER+40), (CENTER, CENTER-30)], fill=(*c3, 200), width=5)
        sd.pieslice([CENTER-30, CENTER-45, CENTER+10, CENTER-5], 180, 360, fill=(*c3, 220))

    elif effective_type == 'spear':
        # 창
        sd.line([(CENTER, CENTER+45), (CENTER, CENTER-45)], fill=(*c3, 220), width=4)
        sd.polygon([(CENTER-10, CENTER-30), (CENTER, CENTER-50), (CENTER+10, CENTER-30)], fill=(*c3, 240))

    elif effective_type == 'bow':
        # 활
        sd.arc([CENTER-30, CENTER-40, CENTER+10, CENTER+40], 270, 90, fill=(*c3, 220), width=4)
        sd.line([(CENTER-10, CENTER-35), (CENTER-10, CENTER+35)], fill=(*c3, 180), width=2)
        sd.line([(CENTER-10, CENTER), (CENTER+35, CENTER-20)], fill=(*c3, 200), width=3)

    elif effective_type in ('staff', 'talisman'):
        # 지팡이/부적
        sd.line([(CENTER, CENTER+40), (CENTER, CENTER-30)], fill=(*c3, 200), width=4)
        for r in range(15, 0, -1):
            t = 1 - r/15
            sd.ellipse([CENTER-r, CENTER-r-30, CENTER+r, CENTER+r-30], fill=(*c3, int(200*t)))

    elif effective_type in ('bell', 'moktak'):
        # 방울/목탁 (원형)
        sd.ellipse([CENTER-25, CENTER-25, CENTER+25, CENTER+25], fill=(*c3, 180))
        sd.ellipse([CENTER-15, CENTER-15, CENTER+15, CENTER+15], fill=(*c2, 200))
        sd.line([(CENTER, CENTER+25), (CENTER, CENTER+40)], fill=(*c3, 160), width=3)

    elif effective_type == 'scythe':
        # 낫
        sd.arc([CENTER-35, CENTER-30, CENTER+15, CENTER+20], 180, 360, fill=(*c3, 220), width=5)
        sd.line([(CENTER+15, CENTER-5), (CENTER-10, CENTER+45)], fill=(*c3, 200), width=4)

    elif effective_type == 'mace':
        # 법구/둔기
        sd.line([(CENTER, CENTER+40), (CENTER, CENTER-10)], fill=(*c3, 200), width=5)
        sd.ellipse([CENTER-20, CENTER-35, CENTER+20, CENTER+5], fill=(*c3, 200))
        for i in range(4):
            angle = i * math.pi / 2
            x = CENTER + int(math.cos(angle) * 22)
            y = CENTER - 15 + int(math.sin(angle) * 22)
            sd.ellipse([x-5, y-5, x+5, y+5], fill=(*c3, 160))

    elif effective_type == 'greatshield':
        # 거대방패
        pts = [(CENTER, CENTER-40), (CENTER+35, CENTER-15), (CENTER+30, CENTER+30),
               (CENTER, CENTER+45), (CENTER-30, CENTER+30), (CENTER-35, CENTER-15)]
        sd.polygon(pts, fill=(*c3, 180))
        pts2 = [(CENTER, CENTER-25), (CENTER+20, CENTER-5), (CENTER+16, CENTER+18),
                (CENTER, CENTER+30), (CENTER-16, CENTER+18), (CENTER-20, CENTER-5)]
        sd.polygon(pts2, fill=(*c1, 200))

    elif effective_type == 'helmet':
        # 투구
        sd.arc([CENTER-30, CENTER-20, CENTER+30, CENTER+30], 180, 360, fill=(*c3, 220), width=0)
        sd.pieslice([CENTER-30, CENTER-30, CENTER+30, CENTER+10], 180, 360, fill=(*c3, 200))
        sd.rectangle([CENTER-30, CENTER, CENTER+30, CENTER+15], fill=(*c3, 180))

    elif effective_type == 'chest':
        # 갑옷
        sd.polygon([(CENTER-25, CENTER-30), (CENTER+25, CENTER-30), (CENTER+30, CENTER+10),
                    (CENTER+20, CENTER+35), (CENTER-20, CENTER+35), (CENTER-30, CENTER+10)], fill=(*c3, 190))
        sd.line([(CENTER, CENTER-30), (CENTER, CENTER+35)], fill=(*c2, 140), width=3)
        sd.line([(CENTER-25, CENTER-10), (CENTER+25, CENTER-10)], fill=(*c2, 140), width=2)

    elif effective_type == 'boots':
        # 장화
        sd.polygon([(CENTER-15, CENTER-30), (CENTER+15, CENTER-30), (CENTER+15, CENTER+20),
                    (CENTER+30, CENTER+20), (CENTER+30, CENTER+35), (CENTER-15, CENTER+35)], fill=(*c3, 200))

    elif effective_type == 'shield':
        # 방패
        pts = [(CENTER, CENTER-35), (CENTER+30, CENTER-10), (CENTER+25, CENTER+25),
               (CENTER, CENTER+40), (CENTER-25, CENTER+25), (CENTER-30, CENTER-10)]
        sd.polygon(pts, fill=(*c3, 200))
        sd.polygon([(CENTER, CENTER-20), (CENTER+15, CENTER), (CENTER, CENTER+20), (CENTER-15, CENTER)], fill=(*c1, 160))

    else:
        # 기본
        for r in range(25, 0, -1):
            t = 1 - r/25
            sd.ellipse([CENTER-r, CENTER-r, CENTER+r, CENTER+r], fill=(*c3, int(200*t)))

    img = Image.alpha_composite(img, sym)

    # Tier border
    tier_colors = {1: (100,100,140), 2: (120,120,180), 3: (160,120,220), 4: (200,150,255)}
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
    for _ in range(tier * 2 + 2):
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


if __name__ == "__main__":
    print("Connecting to database...")
    conn = mysql.connector.connect(host='localhost', user='root', password='root', database='game')
    cur = conn.cursor(dictionary=True)
    cur.execute("SELECT id, name, type, weapon_subtype, required_level FROM items WHERE type != 'potion' ORDER BY type, required_level")
    items = cur.fetchall()
    conn.close()

    generated = 0
    skipped = 0

    for item in items:
        path = os.path.join(OUT_DIR, f"{item['id']}_icon.png")
        if os.path.exists(path):
            skipped += 1
            continue

        img = draw_item_icon(item['type'], item.get('weapon_subtype'), item['name'],
                            item['id'] * 13 + 47, item['required_level'] or 1)
        img.save(path)
        generated += 1
        ws = f" [{item['weapon_subtype']}]" if item.get('weapon_subtype') else ''
        print(f"  {item['id']} {item['name']} ({item['type']}{ws}, Lv{item['required_level']})")

    print(f"\n{'='*50}")
    print(f"  완료! 생성: {generated}장, 스킵: {skipped}장")
    print(f"{'='*50}")
