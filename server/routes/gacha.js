const express = require('express');
const jwt = require('jsonwebtoken');
const { pool, getSelectedChar } = require('../db');

const router = express.Router();
const JWT_SECRET = 'game-secret-key-change-in-production';

function auth(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader) return res.status(401).json({ message: '인증 토큰이 필요합니다.' });
  try {
    req.user = jwt.verify(authHeader.split(' ')[1], JWT_SECRET);
    next();
  } catch {
    return res.status(401).json({ message: '유효하지 않은 토큰입니다.' });
  }
}

// ── 뽑기 풀 정의 ──

// 행운의 복권 보상 풀 (Lv10+)
const LOTTERY_POOL = [
  // 꽝 (30%)
  { weight: 30, type: 'gold', value: 10, name: '동전 몇 닢', desc: '...먼지가 날린다.', grade: '꽝', icon: '💨' },
  // 소량 골드 (25%)
  { weight: 25, type: 'gold', value: 50, name: '은화 주머니', desc: '작은 행운이 찾아왔다!', grade: '일반', icon: '🪙' },
  // 중간 골드 (15%)
  { weight: 15, type: 'gold', value: 200, name: '금화 뭉치', desc: '제법 묵직한 금화다!', grade: '고급', icon: '💰' },
  // 포션 (10%)
  { weight: 10, type: 'item', itemName: '체력물약(중)', value: 1, name: '체력물약(중)', desc: '쓸만한 물약이 나왔다.', grade: '고급', icon: '🧪' },
  // 재료 (8%)
  { weight: 8, type: 'material', materialId: 1, value: 3, name: '강화석 3개', desc: '제련에 쓸 수 있는 재료다.', grade: '희귀', icon: '💎' },
  // 큰 골드 (5%)
  { weight: 5, type: 'gold', value: 500, name: '보물 상자', desc: '대박! 금화가 쏟아진다!', grade: '희귀', icon: '🎁' },
  // 뽑기권 (4%)
  { weight: 4, type: 'ticket', ticketType: 'mercenary', value: 1, name: '용병 고용장', desc: '용병을 뽑을 수 있는 고용장!', grade: '영웅', icon: '📜' },
  // 대박 골드 (2%)
  { weight: 2, type: 'gold', value: 2000, name: '황금 보물함', desc: '대박!! 엄청난 금화!!', grade: '전설', icon: '👑' },
  // 보물 열쇠 (1%)
  { weight: 1, type: 'ticket', ticketType: 'treasure', value: 1, name: '보물 열쇠', desc: '보물 상자를 열 수 있는 열쇠!', grade: '전설', icon: '🔑' },
];

// 용병 뽑기 풀 (Lv15+) - mercenary_templates 기반
const MERC_RATES = {
  // 등급별 확률
  common: 50,    // 일반 용병 (ID 1-3)
  rare: 30,      // 고급 용병 (ID 4-5)
  epic: 15,      // 희귀 용병 (ID 6-7)
  legendary: 5,  // 전설 용병 (ID 8)
};

// 보물 상자 장비 등급 확률 (Lv20+)
const TREASURE_GRADE_RATES = [
  { grade: '일반', weight: 30 },
  { grade: '고급', weight: 28 },
  { grade: '희귀', weight: 22 },
  { grade: '영웅', weight: 12 },
  { grade: '전설', weight: 5 },
  { grade: '신화', weight: 2.5 },
  { grade: '초월', weight: 0.5 },
];

function weightedRandom(pool) {
  const totalWeight = pool.reduce((s, p) => s + (p.weight || 1), 0);
  let roll = Math.random() * totalWeight;
  for (const item of pool) {
    roll -= (item.weight || 1);
    if (roll <= 0) return item;
  }
  return pool[pool.length - 1];
}

// ── 내 티켓 현황 ──
router.get('/tickets', auth, async (req, res) => {
  try {
    const char = await getSelectedChar(req, pool);
    if (!char) return res.status(400).json({ message: '캐릭터를 찾을 수 없습니다.' });

    const [tickets] = await pool.query(
      'SELECT * FROM character_gacha_tickets WHERE character_id = ? ORDER BY ticket_type',
      [char.id]
    );

    // 일일 무료 복권 체크
    const [dailyUsed] = await pool.query(
      "SELECT COUNT(*) as cnt FROM character_gacha_log WHERE character_id = ? AND gacha_type = 'lottery_free' AND DATE(created_at) = CURDATE()",
      [char.id]
    );

    const ticketMap = {};
    for (const t of tickets) ticketMap[t.ticket_type] = t.quantity;

    res.json({
      tickets: ticketMap,
      dailyLotteryUsed: dailyUsed[0].cnt > 0,
      level: char.level,
      gold: char.gold,
    });
  } catch (err) {
    console.error('Gacha tickets error:', err);
    res.status(500).json({ message: '서버 오류가 발생했습니다.' });
  }
});

// ── 뽑기 시스템 정보 ──
router.get('/info', auth, async (req, res) => {
  try {
    const char = await getSelectedChar(req, pool);
    if (!char) return res.status(400).json({ message: '캐릭터를 찾을 수 없습니다.' });

    const systems = [];

    // 행운의 복권
    if (char.level >= 10) {
      systems.push({
        id: 'lottery', name: '행운의 복권', icon: '🎰',
        desc: '동전을 긁어 행운을 시험하세요! 매일 무료 1회, 이후 300G',
        requiredLevel: 10, unlocked: true,
        rewards: LOTTERY_POOL.map(p => ({ name: p.name, grade: p.grade, icon: p.icon })),
      });
    }

    // 용병 모집
    if (char.level >= 15) {
      systems.push({
        id: 'mercenary', name: '용병 모집 뽑기', icon: '⚔️',
        desc: '고용장을 사용하여 무작위 용병을 고용합니다. 10연차 시 고급 이상 보장!',
        requiredLevel: 15, unlocked: true,
        rates: { '일반(1-3성)': '50%', '고급(4성)': '30%', '희귀(4-5성)': '15%', '전설(5성)': '5%' },
      });
    }

    // 보물 상자
    if (char.level >= 20) {
      systems.push({
        id: 'treasure', name: '보물 상자', icon: '🎁',
        desc: '보물 열쇠로 무작위 장비를 획득합니다. 초월 등급이 나올 수도?!',
        requiredLevel: 20, unlocked: true,
        rates: TREASURE_GRADE_RATES.map(g => ({ grade: g.grade, rate: `${g.weight}%` })),
      });
    }

    res.json({ systems, level: char.level });
  } catch (err) {
    console.error('Gacha info error:', err);
    res.status(500).json({ message: '서버 오류가 발생했습니다.' });
  }
});

// ── 행운의 복권 (무료/유료) ──
router.post('/lottery', auth, async (req, res) => {
  try {
    const char = await getSelectedChar(req, pool);
    if (!char) return res.status(400).json({ message: '캐릭터를 찾을 수 없습니다.' });
    if (char.level < 10) return res.status(400).json({ message: '레벨 10 이상부터 이용 가능합니다.' });

    const { type = 'free' } = req.body; // 'free' or 'premium'

    if (type === 'free') {
      const [dailyUsed] = await pool.query(
        "SELECT COUNT(*) as cnt FROM character_gacha_log WHERE character_id = ? AND gacha_type = 'lottery_free' AND DATE(created_at) = CURDATE()",
        [char.id]
      );
      if (dailyUsed[0].cnt > 0) {
        return res.status(400).json({ message: '오늘의 무료 복권은 이미 사용했습니다!' });
      }
    } else {
      // 유료: 300G
      if (char.gold < 300) {
        return res.status(400).json({ message: '골드가 부족합니다. (필요: 300G)' });
      }
      await pool.query('UPDATE characters SET gold = gold - 300 WHERE id = ?', [char.id]);
    }

    // 뽑기 실행
    const result = weightedRandom(LOTTERY_POOL);
    let rewardDetail = {};

    if (result.type === 'gold') {
      await pool.query('UPDATE characters SET gold = gold + ? WHERE id = ?', [result.value, char.id]);
      rewardDetail = { type: 'gold', amount: result.value };
    } else if (result.type === 'ticket') {
      // 뽑기 티켓 지급
      await pool.query(
        `INSERT INTO character_gacha_tickets (character_id, ticket_type, quantity)
         VALUES (?, ?, 1) ON DUPLICATE KEY UPDATE quantity = quantity + 1`,
        [char.id, result.ticketType]
      );
      rewardDetail = { type: 'ticket', ticketType: result.ticketType, amount: 1 };
    } else if (result.type === 'item') {
      // 인벤토리에 아이템 추가 (포션)
      const [items] = await pool.query('SELECT id FROM items WHERE name = ? LIMIT 1', [result.itemName]);
      if (items.length > 0) {
        await pool.query(
          'INSERT INTO inventory (character_id, item_id, quantity) VALUES (?, ?, 1) ON DUPLICATE KEY UPDATE quantity = quantity + 1',
          [char.id, items[0].id]
        );
      }
      rewardDetail = { type: 'item', name: result.itemName, amount: 1 };
    } else if (result.type === 'material') {
      await pool.query(
        'INSERT INTO material_inventory (character_id, material_id, quantity) VALUES (?, ?, ?) ON DUPLICATE KEY UPDATE quantity = quantity + ?',
        [char.id, result.materialId, result.value, result.value]
      );
      rewardDetail = { type: 'material', amount: result.value };
    }

    // 로그 기록
    const gachaType = type === 'free' ? 'lottery_free' : 'lottery_premium';
    await pool.query(
      'INSERT INTO character_gacha_log (character_id, gacha_type, result_name, result_grade, result_detail) VALUES (?, ?, ?, ?, ?)',
      [char.id, gachaType, result.name, result.grade, JSON.stringify(rewardDetail)]
    );

    const [charAfter] = await pool.query('SELECT gold FROM characters WHERE id = ?', [char.id]);

    res.json({
      result: {
        name: result.name,
        desc: result.desc,
        grade: result.grade,
        icon: result.icon,
        reward: rewardDetail,
      },
      gold: charAfter[0].gold,
      type: gachaType,
    });
  } catch (err) {
    console.error('Lottery error:', err);
    res.status(500).json({ message: '서버 오류가 발생했습니다.' });
  }
});

// ── 용병 뽑기 ──
router.post('/mercenary', auth, async (req, res) => {
  const conn = await pool.getConnection();
  try {
    const char = await getSelectedChar(req, conn);
    if (!char) { conn.release(); return res.status(400).json({ message: '캐릭터를 찾을 수 없습니다.' }); }
    if (char.level < 15) { conn.release(); return res.status(400).json({ message: '레벨 15 이상부터 이용 가능합니다.' }); }

    // 티켓 확인
    const [tickets] = await conn.query(
      "SELECT quantity FROM character_gacha_tickets WHERE character_id = ? AND ticket_type = 'mercenary'",
      [char.id]
    );
    if (tickets.length === 0 || tickets[0].quantity <= 0) {
      conn.release();
      return res.status(400).json({ message: '용병 고용장이 없습니다! 복권이나 퀘스트에서 획득하세요.' });
    }

    await conn.beginTransaction();

    // 티켓 소모
    await conn.query(
      "UPDATE character_gacha_tickets SET quantity = quantity - 1 WHERE character_id = ? AND ticket_type = 'mercenary'",
      [char.id]
    );

    // 연속 뽑기 카운터 (10회 보장용)
    const [logCount] = await conn.query(
      "SELECT COUNT(*) as cnt FROM character_gacha_log WHERE character_id = ? AND gacha_type = 'mercenary' AND result_grade IN ('일반') AND created_at > IFNULL((SELECT MAX(created_at) FROM character_gacha_log WHERE character_id = ? AND gacha_type = 'mercenary' AND result_grade NOT IN ('일반')), '2000-01-01')",
      [char.id, char.id]
    );
    const consecutiveNormals = logCount[0].cnt;
    const isPity = consecutiveNormals >= 9; // 10번째는 보장

    // 등급 결정
    let roll = Math.random() * 100;
    let selectedGrade;
    if (isPity) {
      // 보장: 고급 이상
      if (roll < 60) selectedGrade = 'rare';
      else if (roll < 90) selectedGrade = 'epic';
      else selectedGrade = 'legendary';
    } else {
      if (roll < MERC_RATES.common) selectedGrade = 'common';
      else if (roll < MERC_RATES.common + MERC_RATES.rare) selectedGrade = 'rare';
      else if (roll < MERC_RATES.common + MERC_RATES.rare + MERC_RATES.epic) selectedGrade = 'epic';
      else selectedGrade = 'legendary';
    }

    // 등급별 용병 템플릿 선택
    let mercIds;
    if (selectedGrade === 'common') mercIds = [1, 2, 3];
    else if (selectedGrade === 'rare') mercIds = [4, 5];
    else if (selectedGrade === 'epic') mercIds = [6, 7];
    else mercIds = [8];

    const templateId = mercIds[Math.floor(Math.random() * mercIds.length)];

    // 용병 템플릿 조회
    const [templates] = await conn.query('SELECT * FROM mercenary_templates WHERE id = ?', [templateId]);
    if (templates.length === 0) {
      await conn.rollback();
      conn.release();
      return res.status(500).json({ message: '용병 데이터 오류' });
    }
    const tmpl = templates[0];

    // 이미 보유한 용병인지 확인
    const [existing] = await conn.query(
      'SELECT id FROM character_mercenaries WHERE character_id = ? AND template_id = ?',
      [char.id, templateId]
    );

    let resultType = 'new';
    let compensationGold = 0;

    if (existing.length > 0) {
      // 이미 보유: 골드로 보상
      compensationGold = selectedGrade === 'legendary' ? 3000 : selectedGrade === 'epic' ? 1500 : selectedGrade === 'rare' ? 800 : 300;
      await conn.query('UPDATE characters SET gold = gold + ? WHERE id = ?', [compensationGold, char.id]);
      resultType = 'duplicate';
    } else {
      // 새 용병 고용
      const startLevel = Math.max(1, Math.floor(char.level * 0.8));
      await conn.query(
        `INSERT INTO character_mercenaries (character_id, template_id, name, class_type, level, hp, mp, attack, defense, phys_attack, phys_defense, mag_attack, mag_defense, crit_rate, evasion, element, fatigue)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0)`,
        [char.id, templateId, tmpl.name, tmpl.class_type, startLevel,
         tmpl.base_hp + startLevel * 5, tmpl.base_mp + startLevel * 3,
         tmpl.base_attack + startLevel * 2, tmpl.base_defense + startLevel * 1,
         tmpl.base_phys_attack + startLevel * 2, tmpl.base_phys_defense + startLevel * 1,
         tmpl.base_mag_attack + startLevel * 1, tmpl.base_mag_defense + startLevel * 1,
         tmpl.base_crit_rate || 5, tmpl.base_evasion || 3, tmpl.element || 'neutral']
      );
    }

    const gradeKo = selectedGrade === 'legendary' ? '전설' : selectedGrade === 'epic' ? '희귀' : selectedGrade === 'rare' ? '고급' : '일반';

    // 로그
    await conn.query(
      'INSERT INTO character_gacha_log (character_id, gacha_type, result_name, result_grade, result_detail) VALUES (?, ?, ?, ?, ?)',
      [char.id, 'mercenary', tmpl.name, gradeKo, JSON.stringify({ templateId, resultType, compensationGold, isPity })]
    );

    await conn.commit();

    const [charAfter] = await conn.query('SELECT gold FROM characters WHERE id = ?', [char.id]);

    res.json({
      result: {
        name: tmpl.name,
        icon: tmpl.icon || '⚔️',
        classType: tmpl.class_type,
        grade: gradeKo,
        templateId,
        resultType,
        compensationGold,
        isPity,
      },
      gold: charAfter[0].gold,
      message: resultType === 'new'
        ? `${gradeKo} 용병 [${tmpl.name}]을(를) 고용했습니다!${isPity ? ' (10회 보장!)' : ''}`
        : `이미 보유한 용병입니다. 보상으로 ${compensationGold}G를 받았습니다.`,
    });
  } catch (err) {
    await conn.rollback().catch(() => {});
    console.error('Merc gacha error:', err);
    res.status(500).json({ message: '서버 오류가 발생했습니다.' });
  } finally {
    conn.release();
  }
});

// ── 보물 상자 (장비 뽑기) ──
router.post('/treasure', auth, async (req, res) => {
  const conn = await pool.getConnection();
  try {
    const char = await getSelectedChar(req, conn);
    if (!char) { conn.release(); return res.status(400).json({ message: '캐릭터를 찾을 수 없습니다.' }); }
    if (char.level < 20) { conn.release(); return res.status(400).json({ message: '레벨 20 이상부터 이용 가능합니다.' }); }

    // 티켓 확인
    const [tickets] = await conn.query(
      "SELECT quantity FROM character_gacha_tickets WHERE character_id = ? AND ticket_type = 'treasure'",
      [char.id]
    );
    if (tickets.length === 0 || tickets[0].quantity <= 0) {
      conn.release();
      return res.status(400).json({ message: '보물 열쇠가 없습니다! 던전이나 복권에서 획득하세요.' });
    }

    await conn.beginTransaction();

    // 티켓 소모
    await conn.query(
      "UPDATE character_gacha_tickets SET quantity = quantity - 1 WHERE character_id = ? AND ticket_type = 'treasure'",
      [char.id]
    );

    // 등급 결정
    const gradeResult = weightedRandom(TREASURE_GRADE_RATES);
    const grade = gradeResult.grade;

    // 캐릭터 레벨 기반 장비 선택 (해당 등급, 레벨 범위)
    const maxItemLevel = Math.min(100, char.level + 15);
    const [items] = await conn.query(
      'SELECT * FROM items WHERE type = ? AND grade = ? AND required_level <= ? ORDER BY RAND() LIMIT 1',
      ['equipment', grade, maxItemLevel]
    );

    let resultItem;
    if (items.length === 0) {
      // 해당 등급 장비가 없으면 골드 보상
      const goldAmount = grade === '초월' ? 10000 : grade === '신화' ? 5000 : grade === '전설' ? 3000 : grade === '영웅' ? 1500 : 500;
      await conn.query('UPDATE characters SET gold = gold + ? WHERE id = ?', [goldAmount, char.id]);
      resultItem = { name: `${grade} 골드 보상`, grade, type: 'gold', value: goldAmount, icon: '💰' };
    } else {
      const item = items[0];
      // 인벤토리에 추가
      await conn.query(
        'INSERT INTO inventory (character_id, item_id, quantity) VALUES (?, ?, 1) ON DUPLICATE KEY UPDATE quantity = quantity + 1',
        [char.id, item.id]
      );
      resultItem = {
        id: item.id,
        name: item.name,
        grade: item.grade,
        type: 'equipment',
        slot: item.slot,
        icon: item.icon || '📦',
        stats: { attack: item.attack, defense: item.defense, hp: item.hp, mp: item.mp },
      };
    }

    // 로그
    await conn.query(
      'INSERT INTO character_gacha_log (character_id, gacha_type, result_name, result_grade, result_detail) VALUES (?, ?, ?, ?, ?)',
      [char.id, 'treasure', resultItem.name, grade, JSON.stringify(resultItem)]
    );

    await conn.commit();

    const [charAfter] = await conn.query('SELECT gold FROM characters WHERE id = ?', [char.id]);

    res.json({
      result: resultItem,
      gold: charAfter[0].gold,
      message: `${grade} 등급 [${resultItem.name}]을(를) 획득했습니다!`,
    });
  } catch (err) {
    await conn.rollback().catch(() => {});
    console.error('Treasure gacha error:', err);
    res.status(500).json({ message: '서버 오류가 발생했습니다.' });
  } finally {
    conn.release();
  }
});

// ── 뽑기 기록 ──
router.get('/history', auth, async (req, res) => {
  try {
    const char = await getSelectedChar(req, pool);
    if (!char) return res.status(400).json({ message: '캐릭터를 찾을 수 없습니다.' });

    const [logs] = await pool.query(
      'SELECT * FROM character_gacha_log WHERE character_id = ? ORDER BY created_at DESC LIMIT 50',
      [char.id]
    );

    res.json({ history: logs });
  } catch (err) {
    console.error('Gacha history error:', err);
    res.status(500).json({ message: '서버 오류가 발생했습니다.' });
  }
});

module.exports = router;
