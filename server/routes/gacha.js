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

// ── 복권 보상 풀 (Lv10+) ──
const LOTTERY_POOL = [
  { weight: 25, type: 'gold', value: 10, name: '동전 몇 닢', desc: '...먼지가 날린다.', grade: '꽝', icon: '💨' },
  { weight: 22, type: 'gold', value: 50, name: '은화 주머니', desc: '작은 행운이 찾아왔다!', grade: '일반', icon: '🪙' },
  { weight: 12, type: 'gold', value: 200, name: '금화 뭉치', desc: '제법 묵직한 금화다!', grade: '고급', icon: '💰' },
  { weight: 8,  type: 'item', itemName: '체력물약(중)', value: 1, name: '체력물약(중)', desc: '쓸만한 물약이 나왔다.', grade: '고급', icon: '🧪' },
  // 조각 드랍 (용병/소환수)
  { weight: 7,  type: 'shard', shardName: '용병소환 조각', value: 2, name: '용병소환 조각 x2', desc: '용병을 소환할 수 있는 조각이다!', grade: '희귀', icon: '🗡️' },
  { weight: 7,  type: 'shard', shardName: '소환수소환 조각', value: 2, name: '소환수소환 조각 x2', desc: '소환수를 부를 수 있는 조각이다!', grade: '희귀', icon: '🔮' },
  { weight: 5,  type: 'gold', value: 500, name: '보물 상자', desc: '대박! 금화가 쏟아진다!', grade: '희귀', icon: '🎁' },
  { weight: 4,  type: 'shard', shardName: '용병소환 조각', value: 5, name: '용병소환 조각 x5', desc: '용병 조각이 잔뜩!', grade: '영웅', icon: '🗡️' },
  { weight: 4,  type: 'shard', shardName: '소환수소환 조각', value: 5, name: '소환수소환 조각 x5', desc: '소환수 조각이 잔뜩!', grade: '영웅', icon: '🔮' },
  { weight: 3,  type: 'ticket', ticketType: 'mercenary', value: 1, name: '용병 고용장', desc: '용병을 뽑을 수 있는 고용장!', grade: '영웅', icon: '📜' },
  { weight: 1.5,type: 'gold', value: 2000, name: '황금 보물함', desc: '대박!! 엄청난 금화!!', grade: '전설', icon: '👑' },
  { weight: 1,  type: 'ticket', ticketType: 'treasure', value: 1, name: '보물 열쇠', desc: '보물 상자를 열 수 있는 열쇠!', grade: '전설', icon: '🔑' },
  { weight: 0.5,type: 'ticket', ticketType: 'summon', value: 1, name: '소환수 소환권', desc: '소환수를 뽑을 수 있는 소환권!', grade: '전설', icon: '🌟' },
];

// 보물 상자 등급 확률
const TREASURE_GRADE_RATES = [
  { grade: '일반', weight: 30 }, { grade: '고급', weight: 28 }, { grade: '희귀', weight: 22 },
  { grade: '영웅', weight: 12 }, { grade: '전설', weight: 5 }, { grade: '신화', weight: 2.5 }, { grade: '초월', weight: 0.5 },
];

// 등급별 중복 보상 (강화권 아이템 이름)
const DUPE_ENHANCE_TICKET = {
  mercenary: {
    '일반': '일반용병강화권', '고급': '고급용병강화권', '희귀': '희귀용병강화권',
    '영웅': '영웅용병강화권', '전설': '전설용병강화권', '신화': '신화용병강화권', '초월': '초월용병강화권',
  },
  summon: {
    '일반': '일반소환수강화권', '고급': '고급소환수강화권', '희귀': '희귀소환수강화권',
    '영웅': '영웅소환수강화권', '전설': '전설소환수강화권', '신화': '신화소환수강화권', '초월': '초월소환수강화권',
  },
};
// 폴백용 골드 보상 (강화권 아이템이 DB에 없을 경우)
const DUPE_GOLD = { '일반': 300, '고급': 800, '희귀': 2000, '영웅': 5000, '전설': 15000, '신화': 50000, '초월': 150000 };

function weightedRandom(items) {
  const total = items.reduce((s, p) => s + (p.weight || 1), 0);
  let roll = Math.random() * total;
  for (const item of items) {
    roll -= (item.weight || 1);
    if (roll <= 0) return item;
  }
  return items[items.length - 1];
}

// 등급 문자열에서 가챠 풀 파싱: "영웅:70,전설:24,신화:5,초월:1"
function parseGradePool(str) {
  return str.split(',').map(s => {
    const [grade, weight] = s.split(':');
    return { grade, weight: parseFloat(weight) };
  });
}

// ── 천장(pity) 체크 ──
async function getPityCount(conn, charId, gachaType) {
  const [rows] = await conn.query(
    'SELECT pull_count FROM gacha_pity WHERE character_id = ? AND gacha_type = ?', [charId, gachaType]
  );
  return rows.length > 0 ? rows[0].pull_count : 0;
}

async function updatePity(conn, charId, gachaType, gotHighGrade) {
  if (gotHighGrade) {
    await conn.query(
      `INSERT INTO gacha_pity (character_id, gacha_type, pull_count) VALUES (?, ?, 0)
       ON DUPLICATE KEY UPDATE pull_count = 0`,
      [charId, gachaType]
    );
  } else {
    await conn.query(
      `INSERT INTO gacha_pity (character_id, gacha_type, pull_count) VALUES (?, ?, 1)
       ON DUPLICATE KEY UPDATE pull_count = pull_count + 1`,
      [charId, gachaType]
    );
  }
}

// ── 범용 유닛 가챠 로직 ──
async function pullUnit(conn, char, unitType, gradePool, gachaType) {
  // 천장 체크
  const pityCount = await getPityCount(conn, char.id, gachaType);
  // 50회 천장: 영웅 보장, 100회: 전설 보장
  let forcedGrade = null;
  if (pityCount >= 99) forcedGrade = '전설';
  else if (pityCount >= 49) forcedGrade = '영웅';

  // 등급 결정
  let selectedGrade;
  if (forcedGrade) {
    selectedGrade = forcedGrade;
  } else {
    const picked = weightedRandom(gradePool);
    selectedGrade = picked.grade;
  }

  const isHighGrade = ['전설', '신화', '초월'].includes(selectedGrade);

  // DB에서 해당 등급 유닛 중 랜덤 선택
  const table = unitType === 'mercenary' ? 'mercenary_templates' : 'summon_templates';
  const [units] = await conn.query(
    `SELECT * FROM ${table} WHERE grade = ? ORDER BY RAND() LIMIT 1`, [selectedGrade]
  );

  if (units.length === 0) {
    // 해당 등급 유닛 없으면 골드 보상
    const gold = DUPE_GOLD[selectedGrade] || 500;
    await conn.query('UPDATE characters SET gold = gold + ? WHERE id = ?', [gold, char.id]);
    await updatePity(conn, char.id, gachaType, isHighGrade);
    return { resultType: 'gold_fallback', grade: selectedGrade, gold, isPity: !!forcedGrade, pityCount: pityCount + 1 };
  }

  const tmpl = units[0];

  // 이미 보유 체크
  const ownerTable = unitType === 'mercenary' ? 'character_mercenaries' : 'character_summons';
  const [existing] = await conn.query(
    `SELECT id FROM ${ownerTable} WHERE character_id = ? AND template_id = ?`, [char.id, tmpl.id]
  );

  let resultType = 'new';
  let compensationGold = 0;
  let compensationItem = null;

  if (existing.length > 0) {
    // 중복: 등급별 강화권 지급
    const ticketName = (DUPE_ENHANCE_TICKET[unitType] || {})[selectedGrade];
    if (ticketName) {
      const [itemRows] = await conn.query('SELECT id, name FROM items WHERE name = ? LIMIT 1', [ticketName]);
      if (itemRows.length > 0) {
        await conn.query(
          'INSERT INTO inventory (character_id, item_id, quantity) VALUES (?, ?, 1) ON DUPLICATE KEY UPDATE quantity = quantity + 1',
          [char.id, itemRows[0].id]
        );
        compensationItem = { id: itemRows[0].id, name: itemRows[0].name };
      }
    }
    // 강화권이 없으면 골드 폴백
    if (!compensationItem) {
      compensationGold = DUPE_GOLD[selectedGrade] || 500;
      await conn.query('UPDATE characters SET gold = gold + ? WHERE id = ?', [compensationGold, char.id]);
    }
    resultType = 'duplicate';
  } else {
    // 새 유닛 획득
    const startLevel = Math.max(1, Math.floor(char.level * 0.8));
    const gm = tmpl.growth_mult || 1.0;

    if (unitType === 'mercenary') {
      await conn.query(
        `INSERT INTO character_mercenaries (character_id, template_id, name, level, hp, mp, phys_attack, phys_defense, mag_attack, mag_defense, crit_rate, evasion, fatigue, max_fatigue)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [char.id, tmpl.id, tmpl.name, startLevel,
         Math.floor(tmpl.base_hp + startLevel * (tmpl.growth_hp || 10) * gm),
         Math.floor(tmpl.base_mp + startLevel * (tmpl.growth_mp || 3) * gm),
         Math.floor(tmpl.base_phys_attack + startLevel * (tmpl.growth_phys_attack || 2) * gm),
         Math.floor(tmpl.base_phys_defense + startLevel * (tmpl.growth_phys_defense || 1) * gm),
         Math.floor(tmpl.base_mag_attack + startLevel * (tmpl.growth_mag_attack || 0.5) * gm),
         Math.floor(tmpl.base_mag_defense + startLevel * (tmpl.growth_mag_defense || 0.5) * gm),
         tmpl.base_crit_rate || 5, tmpl.base_evasion || 3,
         tmpl.max_fatigue || 7, tmpl.max_fatigue || 7]
      );
    } else {
      await conn.query(
        `INSERT INTO character_summons (character_id, template_id, level, exp, hp, mp, attack, defense)
         VALUES (?, ?, ?, 0, ?, ?, ?, ?)`,
        [char.id, tmpl.id, startLevel,
         tmpl.base_hp + startLevel * 5,
         tmpl.base_mp + startLevel * 3,
         tmpl.base_attack + startLevel * 2,
         tmpl.base_defense + startLevel * 1]
      );
    }

    // 해금 기록
    await conn.query(
      'INSERT IGNORE INTO unit_unlocks (character_id, unit_type, template_id, unlock_method) VALUES (?, ?, ?, ?)',
      [char.id, unitType, tmpl.id, 'gacha']
    ).catch(() => {});
  }

  await updatePity(conn, char.id, gachaType, isHighGrade);

  return {
    resultType, grade: selectedGrade, template: tmpl,
    compensationGold, compensationItem, isPity: !!forcedGrade, pityCount: pityCount + 1,
  };
}

// ══════════════════════════════════════════════
// API 엔드포인트
// ══════════════════════════════════════════════

// ── 티켓/조각 현황 ──
router.get('/tickets', auth, async (req, res) => {
  try {
    const char = await getSelectedChar(req, pool);
    if (!char) return res.status(400).json({ message: '캐릭터를 찾을 수 없습니다.' });

    const [tickets] = await pool.query(
      'SELECT * FROM character_gacha_tickets WHERE character_id = ? ORDER BY ticket_type', [char.id]
    );
    const [dailyUsed] = await pool.query(
      "SELECT COUNT(*) as cnt FROM character_gacha_log WHERE character_id = ? AND gacha_type = 'lottery_free' AND DATE(created_at) = CURDATE()", [char.id]
    );

    // 소환 조각 수량
    const [shards] = await pool.query(
      `SELECT m.name, IFNULL(mi.quantity, 0) as quantity
       FROM materials m LEFT JOIN material_inventory mi ON mi.material_id = m.id AND mi.character_id = ?
       WHERE m.name IN ('용병소환 조각','소환수소환 조각')`, [char.id]
    );

    // 천장 카운터
    const [pity] = await pool.query(
      'SELECT gacha_type, pull_count FROM gacha_pity WHERE character_id = ?', [char.id]
    );

    // 교환 레시피
    const [recipes] = await pool.query('SELECT * FROM shard_exchange_recipes');

    const ticketMap = {};
    for (const t of tickets) ticketMap[t.ticket_type] = t.quantity;
    const shardMap = {};
    for (const s of shards) shardMap[s.name] = s.quantity;
    const pityMap = {};
    for (const p of pity) pityMap[p.gacha_type] = p.pull_count;

    res.json({
      tickets: ticketMap, shards: shardMap, pity: pityMap,
      recipes: recipes.map(r => ({ ...r, target_grades: r.target_grades })),
      dailyLotteryUsed: dailyUsed[0].cnt > 0,
      level: char.level, gold: char.gold,
    });
  } catch (err) {
    console.error('Gacha tickets error:', err);
    res.status(500).json({ message: '서버 오류가 발생했습니다.' });
  }
});

// ── 시스템 정보 ──
router.get('/info', auth, async (req, res) => {
  try {
    const char = await getSelectedChar(req, pool);
    if (!char) return res.status(400).json({ message: '캐릭터를 찾을 수 없습니다.' });

    const [recipes] = await pool.query('SELECT * FROM shard_exchange_recipes');

    const systems = [];
    if (char.level >= 10) {
      systems.push({
        id: 'lottery', name: '행운의 복권', icon: '🎰',
        desc: '매일 무료 1회, 이후 300G. 소환 조각/티켓 획득 가능!',
        requiredLevel: 10, unlocked: true,
      });
    }
    if (char.level >= 15) {
      systems.push({
        id: 'mercenary', name: '용병 소환', icon: '⚔️',
        desc: '용병소환권으로 영웅~초월 등급 용병을 뽑습니다. 50회 천장!',
        requiredLevel: 15, unlocked: true,
        rates: '영웅 70% / 전설 24% / 신화 5% / 초월 1%',
      });
      systems.push({
        id: 'summon', name: '소환수 소환', icon: '🔮',
        desc: '소환수소환권으로 영웅~초월 등급 소환수를 뽑습니다. 50회 천장!',
        requiredLevel: 15, unlocked: true,
        rates: '영웅 70% / 전설 24% / 신화 5% / 초월 1%',
      });
    }
    if (char.level >= 20) {
      systems.push({
        id: 'treasure', name: '보물 상자', icon: '🎁',
        desc: '보물 열쇠로 무작위 장비를 획득합니다.',
        requiredLevel: 20, unlocked: true,
        rates: TREASURE_GRADE_RATES.map(g => ({ grade: g.grade, rate: `${g.weight}%` })),
      });
    }
    systems.push({
      id: 'exchange', name: '조각 교환', icon: '🔄',
      desc: '소환 조각을 모아 소환권으로 교환하세요.',
      recipes: recipes.map(r => ({ name: r.ticket_name, cost: r.shard_cost, shard: r.shard_name, type: r.ticket_type })),
    });

    res.json({ systems, level: char.level });
  } catch (err) {
    console.error('Gacha info error:', err);
    res.status(500).json({ message: '서버 오류가 발생했습니다.' });
  }
});

// ── 행운의 복권 ──
router.post('/lottery', auth, async (req, res) => {
  try {
    const char = await getSelectedChar(req, pool);
    if (!char) return res.status(400).json({ message: '캐릭터를 찾을 수 없습니다.' });
    if (char.level < 10) return res.status(400).json({ message: '레벨 10 이상부터 이용 가능합니다.' });

    const { type = 'free' } = req.body;
    if (type === 'free') {
      const [dailyUsed] = await pool.query(
        "SELECT COUNT(*) as cnt FROM character_gacha_log WHERE character_id = ? AND gacha_type = 'lottery_free' AND DATE(created_at) = CURDATE()", [char.id]
      );
      if (dailyUsed[0].cnt > 0) return res.status(400).json({ message: '오늘의 무료 복권은 이미 사용했습니다!' });
    } else {
      if (char.gold < 300) return res.status(400).json({ message: '골드가 부족합니다. (필요: 300G)' });
      await pool.query('UPDATE characters SET gold = gold - 300 WHERE id = ?', [char.id]);
    }

    const result = weightedRandom(LOTTERY_POOL);
    let rewardDetail = {};

    if (result.type === 'gold') {
      await pool.query('UPDATE characters SET gold = gold + ? WHERE id = ?', [result.value, char.id]);
      rewardDetail = { type: 'gold', amount: result.value };
    } else if (result.type === 'ticket') {
      await pool.query(
        `INSERT INTO character_gacha_tickets (character_id, ticket_type, quantity) VALUES (?, ?, 1)
         ON DUPLICATE KEY UPDATE quantity = quantity + 1`, [char.id, result.ticketType]
      );
      rewardDetail = { type: 'ticket', ticketType: result.ticketType, amount: 1 };
    } else if (result.type === 'shard') {
      // 소환 조각 지급
      const [matRows] = await pool.query('SELECT id FROM materials WHERE name = ?', [result.shardName]);
      if (matRows.length > 0) {
        await pool.query(
          'INSERT INTO material_inventory (character_id, material_id, quantity) VALUES (?, ?, ?) ON DUPLICATE KEY UPDATE quantity = quantity + ?',
          [char.id, matRows[0].id, result.value, result.value]
        );
      }
      rewardDetail = { type: 'shard', name: result.shardName, amount: result.value };
    } else if (result.type === 'item') {
      const [items] = await pool.query('SELECT id FROM items WHERE name = ? LIMIT 1', [result.itemName]);
      if (items.length > 0) {
        await pool.query(
          'INSERT INTO inventory (character_id, item_id, quantity) VALUES (?, ?, 1) ON DUPLICATE KEY UPDATE quantity = quantity + 1',
          [char.id, items[0].id]
        );
      }
      rewardDetail = { type: 'item', name: result.itemName, amount: 1 };
    }

    const gachaType = type === 'free' ? 'lottery_free' : 'lottery_premium';
    await pool.query(
      'INSERT INTO character_gacha_log (character_id, gacha_type, result_name, result_grade, result_detail) VALUES (?, ?, ?, ?, ?)',
      [char.id, gachaType, result.name, result.grade, JSON.stringify(rewardDetail)]
    );

    const [charAfter] = await pool.query('SELECT gold FROM characters WHERE id = ?', [char.id]);
    res.json({ result: { name: result.name, desc: result.desc, grade: result.grade, icon: result.icon, reward: rewardDetail }, gold: charAfter[0].gold, type: gachaType });
  } catch (err) {
    console.error('Lottery error:', err);
    res.status(500).json({ message: '서버 오류가 발생했습니다.' });
  }
});

// ── 조각 → 소환권 교환 ──
router.post('/exchange', auth, async (req, res) => {
  const conn = await pool.getConnection();
  try {
    const char = await getSelectedChar(req, conn);
    if (!char) { conn.release(); return res.status(400).json({ message: '캐릭터를 찾을 수 없습니다.' }); }

    const { recipeId } = req.body;
    if (!recipeId) { conn.release(); return res.status(400).json({ message: '교환 레시피를 선택하세요.' }); }

    const [recipes] = await conn.query('SELECT * FROM shard_exchange_recipes WHERE id = ?', [recipeId]);
    if (recipes.length === 0) { conn.release(); return res.status(400).json({ message: '유효하지 않은 교환 레시피입니다.' }); }
    const recipe = recipes[0];

    // 조각 재료 확인
    const [matRows] = await conn.query('SELECT id FROM materials WHERE name = ?', [recipe.shard_name]);
    if (matRows.length === 0) { conn.release(); return res.status(500).json({ message: '재료 데이터 오류' }); }
    const matId = matRows[0].id;

    const [inv] = await conn.query(
      'SELECT quantity FROM material_inventory WHERE character_id = ? AND material_id = ?', [char.id, matId]
    );
    const currentQty = inv.length > 0 ? inv[0].quantity : 0;
    if (currentQty < recipe.shard_cost) {
      conn.release();
      return res.status(400).json({ message: `${recipe.shard_name}이(가) 부족합니다. (필요: ${recipe.shard_cost}, 보유: ${currentQty})` });
    }

    await conn.beginTransaction();

    // 조각 차감
    await conn.query(
      'UPDATE material_inventory SET quantity = quantity - ? WHERE character_id = ? AND material_id = ?',
      [recipe.shard_cost, char.id, matId]
    );

    // 소환권 티켓 지급
    const ticketType = recipe.ticket_type === 'mercenary' ? 'mercenary' : 'summon';
    // 고급소환권은 별도 타입
    const actualTicketType = recipe.ticket_name.includes('고급') ? `${ticketType}_premium` : ticketType;
    await conn.query(
      `INSERT INTO character_gacha_tickets (character_id, ticket_type, quantity) VALUES (?, ?, 1)
       ON DUPLICATE KEY UPDATE quantity = quantity + 1`, [char.id, actualTicketType]
    );

    await conn.commit();

    res.json({
      message: `${recipe.shard_name} ${recipe.shard_cost}개 → ${recipe.ticket_name} 1장 교환 완료!`,
      ticketType: actualTicketType,
    });
  } catch (err) {
    await conn.rollback().catch(() => {});
    console.error('Exchange error:', err);
    res.status(500).json({ message: '서버 오류가 발생했습니다.' });
  } finally {
    conn.release();
  }
});

// ── 용병 소환권 뽑기 ──
router.post('/mercenary', auth, async (req, res) => {
  const conn = await pool.getConnection();
  try {
    const char = await getSelectedChar(req, conn);
    if (!char) { conn.release(); return res.status(400).json({ message: '캐릭터를 찾을 수 없습니다.' }); }

    const { ticketType = 'mercenary' } = req.body; // 'mercenary' or 'mercenary_premium'
    const actualType = ticketType === 'mercenary_premium' ? 'mercenary_premium' : 'mercenary';

    const [tickets] = await conn.query(
      "SELECT quantity FROM character_gacha_tickets WHERE character_id = ? AND ticket_type = ?", [char.id, actualType]
    );
    if (tickets.length === 0 || tickets[0].quantity <= 0) {
      conn.release();
      return res.status(400).json({ message: actualType === 'mercenary_premium' ? '고급용병소환권이 없습니다!' : '용병소환권이 없습니다! 조각을 모아 교환하세요.' });
    }

    await conn.beginTransaction();
    await conn.query("UPDATE character_gacha_tickets SET quantity = quantity - 1 WHERE character_id = ? AND ticket_type = ?", [char.id, actualType]);

    // 등급 풀 결정
    const [recipe] = await conn.query(
      "SELECT target_grades FROM shard_exchange_recipes WHERE ticket_type = 'mercenary' AND ticket_name = ?",
      [actualType === 'mercenary_premium' ? '고급용병소환권' : '용병소환권']
    );
    const gradePool = recipe.length > 0
      ? parseGradePool(recipe[0].target_grades)
      : [{ grade: '영웅', weight: 70 }, { grade: '전설', weight: 24 }, { grade: '신화', weight: 5 }, { grade: '초월', weight: 1 }];

    const result = await pullUnit(conn, char, 'mercenary', gradePool, `merc_${actualType}`);

    await conn.query(
      'INSERT INTO character_gacha_log (character_id, gacha_type, result_name, result_grade, result_detail) VALUES (?, ?, ?, ?, ?)',
      [char.id, `merc_${actualType}`, result.template?.name || 'gold', result.grade, JSON.stringify(result)]
    );

    await conn.commit();
    const [charAfter] = await conn.query('SELECT gold FROM characters WHERE id = ?', [char.id]);

    res.json({
      result: {
        name: result.template?.name || `${result.grade} 골드 보상`,
        icon: result.template?.icon || '⚔️',
        classType: result.template?.class_type,
        grade: result.grade,
        templateId: result.template?.id,
        resultType: result.resultType,
        compensationGold: result.compensationGold,
        compensationItem: result.compensationItem,
        introMessage: result.template?.intro_message || '',
        isPity: result.isPity,
        pityCount: result.pityCount,
      },
      gold: charAfter[0].gold,
      message: result.resultType === 'new'
        ? `★ ${result.grade} 용병 [${result.template.name}]을(를) 획득했습니다!${result.isPity ? ' (천장 보장!)' : ''}`
        : result.resultType === 'duplicate'
        ? `이미 보유한 용병입니다. [${result.compensationItem?.name || result.compensationGold + 'G'}] 획득!`
        : `${result.grade} 등급 → ${result.gold || 0}G 보상`,
    });
  } catch (err) {
    await conn.rollback().catch(() => {});
    console.error('Merc gacha error:', err);
    res.status(500).json({ message: '서버 오류가 발생했습니다.' });
  } finally {
    conn.release();
  }
});

// ── 소환수 소환권 뽑기 ──
router.post('/summon', auth, async (req, res) => {
  const conn = await pool.getConnection();
  try {
    const char = await getSelectedChar(req, conn);
    if (!char) { conn.release(); return res.status(400).json({ message: '캐릭터를 찾을 수 없습니다.' }); }

    const { ticketType = 'summon' } = req.body;
    const actualType = ticketType === 'summon_premium' ? 'summon_premium' : 'summon';

    const [tickets] = await conn.query(
      "SELECT quantity FROM character_gacha_tickets WHERE character_id = ? AND ticket_type = ?", [char.id, actualType]
    );
    if (tickets.length === 0 || tickets[0].quantity <= 0) {
      conn.release();
      return res.status(400).json({ message: actualType === 'summon_premium' ? '고급소환수소환권이 없습니다!' : '소환수소환권이 없습니다! 조각을 모아 교환하세요.' });
    }

    await conn.beginTransaction();
    await conn.query("UPDATE character_gacha_tickets SET quantity = quantity - 1 WHERE character_id = ? AND ticket_type = ?", [char.id, actualType]);

    const [recipe] = await conn.query(
      "SELECT target_grades FROM shard_exchange_recipes WHERE ticket_type = 'summon' AND ticket_name = ?",
      [actualType === 'summon_premium' ? '고급소환수소환권' : '소환수소환권']
    );
    const gradePool = recipe.length > 0
      ? parseGradePool(recipe[0].target_grades)
      : [{ grade: '영웅', weight: 70 }, { grade: '전설', weight: 24 }, { grade: '신화', weight: 5 }, { grade: '초월', weight: 1 }];

    const result = await pullUnit(conn, char, 'summon', gradePool, `summon_${actualType}`);

    await conn.query(
      'INSERT INTO character_gacha_log (character_id, gacha_type, result_name, result_grade, result_detail) VALUES (?, ?, ?, ?, ?)',
      [char.id, `summon_${actualType}`, result.template?.name || 'gold', result.grade, JSON.stringify(result)]
    );

    await conn.commit();
    const [charAfter] = await conn.query('SELECT gold FROM characters WHERE id = ?', [char.id]);

    res.json({
      result: {
        name: result.template?.name || `${result.grade} 골드 보상`,
        icon: result.template?.icon || '🔮',
        type: result.template?.type,
        grade: result.grade,
        templateId: result.template?.id,
        resultType: result.resultType,
        compensationGold: result.compensationGold,
        compensationItem: result.compensationItem,
        introMessage: result.template?.intro_message || '',
        isPity: result.isPity,
        pityCount: result.pityCount,
      },
      gold: charAfter[0].gold,
      message: result.resultType === 'new'
        ? `★ ${result.grade} 소환수 [${result.template.name}]을(를) 획득했습니다!${result.isPity ? ' (천장 보장!)' : ''}`
        : result.resultType === 'duplicate'
        ? `이미 보유한 소환수입니다. [${result.compensationItem?.name || result.compensationGold + 'G'}] 획득!`
        : `${result.grade} 등급 → ${result.gold || 0}G 보상`,
    });
  } catch (err) {
    await conn.rollback().catch(() => {});
    console.error('Summon gacha error:', err);
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

    const [tickets] = await conn.query(
      "SELECT quantity FROM character_gacha_tickets WHERE character_id = ? AND ticket_type = 'treasure'", [char.id]
    );
    if (tickets.length === 0 || tickets[0].quantity <= 0) {
      conn.release();
      return res.status(400).json({ message: '보물 열쇠가 없습니다!' });
    }

    await conn.beginTransaction();
    await conn.query("UPDATE character_gacha_tickets SET quantity = quantity - 1 WHERE character_id = ? AND ticket_type = 'treasure'", [char.id]);

    const grade = weightedRandom(TREASURE_GRADE_RATES).grade;
    const maxItemLevel = Math.min(100, char.level + 15);
    const [items] = await conn.query(
      "SELECT * FROM items WHERE type IN ('weapon','chest','helmet','boots','shield','ring','necklace') AND grade = ? AND required_level <= ? ORDER BY RAND() LIMIT 1",
      [grade, maxItemLevel]
    );

    let resultItem;
    if (items.length === 0) {
      const goldAmount = DUPE_GOLD[grade] || 500;
      await conn.query('UPDATE characters SET gold = gold + ? WHERE id = ?', [goldAmount, char.id]);
      resultItem = { name: `${grade} 골드 보상`, grade, type: 'gold', value: goldAmount, icon: '💰' };
    } else {
      const item = items[0];
      await conn.query(
        'INSERT INTO inventory (character_id, item_id, quantity) VALUES (?, ?, 1) ON DUPLICATE KEY UPDATE quantity = quantity + 1',
        [char.id, item.id]
      );
      resultItem = { id: item.id, name: item.name, grade: item.grade, type: 'equipment', slot: item.slot, icon: '📦' };
    }

    await conn.query(
      'INSERT INTO character_gacha_log (character_id, gacha_type, result_name, result_grade, result_detail) VALUES (?, ?, ?, ?, ?)',
      [char.id, 'treasure', resultItem.name, grade, JSON.stringify(resultItem)]
    );

    await conn.commit();
    const [charAfter] = await conn.query('SELECT gold FROM characters WHERE id = ?', [char.id]);
    res.json({ result: resultItem, gold: charAfter[0].gold, message: `${grade} 등급 [${resultItem.name}]을(를) 획득했습니다!` });
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
      'SELECT * FROM character_gacha_log WHERE character_id = ? ORDER BY created_at DESC LIMIT 50', [char.id]
    );
    res.json({ history: logs });
  } catch (err) {
    console.error('Gacha history error:', err);
    res.status(500).json({ message: '서버 오류가 발생했습니다.' });
  }
});

module.exports = router;
