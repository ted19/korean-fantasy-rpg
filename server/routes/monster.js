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

// 몬스터 카테고리 목록
router.get('/categories', auth, async (req, res) => {
  try {
    const [categories] = await pool.query(
      'SELECT * FROM monster_categories ORDER BY id'
    );
    res.json({ categories });
  } catch (err) {
    console.error('Monster categories error:', err);
    res.status(500).json({ message: '서버 오류가 발생했습니다.' });
  }
});

// 몬스터 도감 (전체 목록 + 카테고리 필터)
router.get('/encyclopedia', auth, async (req, res) => {
  try {
    const { category_id, tier, search, country } = req.query;
    let sql = `SELECT m.id, m.name, m.icon, m.hp, m.attack, m.defense, m.move_range,
               m.exp_reward, m.gold_reward, m.tier, m.description, m.category_id,
               m.ai_type, m.mp, m.element, m.country,
               mc.name as category_name, mc.icon as category_icon,
               d.name as dungeon_name, d.key_name as dungeon_key
               FROM monsters m
               LEFT JOIN monster_categories mc ON m.category_id = mc.id
               LEFT JOIN dungeons d ON m.dungeon_id = d.id
               WHERE 1=1`;
    const params = [];

    if (country === 'etc') {
      sql += " AND m.country NOT IN ('korea','japan','china')";
    } else if (country) {
      sql += ' AND m.country = ?';
      params.push(country);
    }
    if (category_id) {
      sql += ' AND m.category_id = ?';
      params.push(category_id);
    }
    if (tier) {
      sql += ' AND m.tier = ?';
      params.push(tier);
    }
    if (search) {
      sql += ' AND m.name LIKE ?';
      params.push(`%${search}%`);
    }

    sql += ' ORDER BY m.tier ASC, m.category_id, m.name';

    const [monsters] = await pool.query(sql, params);

    // 캐릭터 도감 해금 정보 로드
    const char = await getSelectedChar(req, pool);
    let bestiaryMap = {};
    if (char) {
      const [bestiaryRows] = await pool.query(
        'SELECT monster_id, kill_count, first_discovered FROM monster_bestiary WHERE character_id = ?',
        [char.id]
      );
      for (const b of bestiaryRows) bestiaryMap[b.monster_id] = b;
    }

    const monstersWithImages = monsters.map(m => ({
      ...m,
      image_url: `/monsters/${m.id}_full.png`,
      icon_url: `/monsters/${m.id}_icon.png`,
      discovered: !!bestiaryMap[m.id],
      killCount: bestiaryMap[m.id]?.kill_count || 0,
      firstDiscovered: bestiaryMap[m.id]?.first_discovered || null,
    }));

    const totalMonsters = monsters.length;
    const discoveredCount = monsters.filter(m => bestiaryMap[m.id]).length;

    res.json({ monsters: monstersWithImages, totalMonsters, discoveredCount });
  } catch (err) {
    console.error('Monster encyclopedia error:', err);
    res.status(500).json({ message: '서버 오류가 발생했습니다.' });
  }
});

// 장비 도감 - 모든 장비 아이템 목록 (must be before /:id)
router.get('/equipment-encyclopedia', auth, async (req, res) => {
  try {
    const { type, grade, search } = req.query;
    let sql = `SELECT id, name, type, slot, weapon_hand, description, price, sell_price,
               effect_hp, effect_mp, effect_attack, effect_defense,
               effect_phys_attack, effect_phys_defense, effect_mag_attack, effect_mag_defense,
               effect_crit_rate, effect_evasion, required_level, class_restriction,
               grade, max_enhance, cosmetic_effect
               FROM items WHERE 1=1`;
    const params = [];

    if (type) {
      sql += ' AND type = ?';
      params.push(type);
    }
    if (grade) {
      sql += ' AND grade = ?';
      params.push(grade);
    }
    if (search) {
      sql += ' AND name LIKE ?';
      params.push(`%${search}%`);
    }

    sql += ` ORDER BY FIELD(grade, '일반','고급','희귀','영웅','전설','신화') ASC, type, required_level, name`;

    const [items] = await pool.query(sql, params);
    res.json({ items });
  } catch (err) {
    console.error('Equipment encyclopedia error:', err);
    res.status(500).json({ message: '서버 오류가 발생했습니다.' });
  }
});

// 몬스터 통계
router.get('/stats/summary', auth, async (req, res) => {
  try {
    const [total] = await pool.query('SELECT COUNT(*) as total FROM monsters');
    const [byCat] = await pool.query(
      `SELECT mc.name, mc.icon, COUNT(*) as count FROM monsters m
       LEFT JOIN monster_categories mc ON m.category_id = mc.id
       GROUP BY m.category_id, mc.name, mc.icon ORDER BY count DESC`
    );
    const [byTier] = await pool.query(
      `SELECT tier, COUNT(*) as count FROM monsters GROUP BY tier ORDER BY tier`
    );
    res.json({ total: total[0].total, by_category: byCat, by_tier: byTier });
  } catch (err) {
    console.error('Monster stats error:', err);
    res.status(500).json({ message: '서버 오류가 발생했습니다.' });
  }
});

// 몬스터 스킬 도감 (전체 스킬 + 사용 몬스터)
router.get('/skills/encyclopedia', auth, async (req, res) => {
  try {
    const { type, search } = req.query;
    let sql = 'SELECT * FROM monster_skills WHERE 1=1';
    const params = [];
    if (type) { sql += ' AND type = ?'; params.push(type); }
    if (search) { sql += ' AND name LIKE ?'; params.push(`%${search}%`); }
    sql += ' ORDER BY type, id';
    const [skills] = await pool.query(sql, params);

    // 각 스킬을 사용하는 몬스터 목록
    const skillIds = skills.map(s => s.id);
    let monsterMap = {};
    if (skillIds.length > 0) {
      const [rows] = await pool.query(
        `SELECT msm.skill_id, m.id as monster_id, m.name, m.tier, m.icon
         FROM monster_skill_map msm
         JOIN monsters m ON msm.monster_id = m.id
         WHERE msm.skill_id IN (?)
         ORDER BY m.tier, m.name`,
        [skillIds]
      );
      for (const r of rows) {
        if (!monsterMap[r.skill_id]) monsterMap[r.skill_id] = [];
        monsterMap[r.skill_id].push({ id: r.monster_id, name: r.name, tier: r.tier, icon: r.icon });
      }
    }

    const result = skills.map(s => ({
      ...s,
      monsters: monsterMap[s.id] || [],
      monsterCount: (monsterMap[s.id] || []).length,
    }));

    res.json({ skills: result, total: result.length });
  } catch (err) {
    console.error('Monster skills encyclopedia error:', err);
    res.status(500).json({ message: '서버 오류가 발생했습니다.' });
  }
});

// 몬스터 스킬 목록
router.get('/:id/skills', auth, async (req, res) => {
  try {
    const [skills] = await pool.query(
      `SELECT ms.* FROM monster_skills ms
       INNER JOIN monster_skill_map msm ON ms.id = msm.skill_id
       WHERE msm.monster_id = ?`,
      [req.params.id]
    );
    res.json({ skills });
  } catch (err) {
    console.error('Monster skills error:', err);
    res.status(500).json({ message: '서버 오류가 발생했습니다.' });
  }
});

// 몬스터 상세 정보 (스킬 포함)
router.get('/:id', auth, async (req, res) => {
  try {
    const [monsters] = await pool.query(
      `SELECT m.*, mc.name as category_name, mc.icon as category_icon,
       d.name as dungeon_name, d.key_name as dungeon_key
       FROM monsters m
       LEFT JOIN monster_categories mc ON m.category_id = mc.id
       LEFT JOIN dungeons d ON m.dungeon_id = d.id
       WHERE m.id = ?`,
      [req.params.id]
    );
    if (monsters.length === 0) {
      return res.status(404).json({ message: '몬스터를 찾을 수 없습니다.' });
    }
    const m = monsters[0];
    m.image_url = `/monsters/${m.id}_full.png`;
    m.icon_url = `/monsters/${m.id}_icon.png`;

    // 스킬도 함께 로드
    const [skills] = await pool.query(
      `SELECT ms.* FROM monster_skills ms
       INNER JOIN monster_skill_map msm ON ms.id = msm.skill_id
       WHERE msm.monster_id = ?`,
      [req.params.id]
    );

    // 드랍 아이템 로드
    const [drops] = await pool.query(
      `SELECT md.drop_rate, md.min_quantity, md.max_quantity,
              mat.name, mat.icon, mat.grade, mat.description
       FROM monster_drops md
       JOIN materials mat ON md.material_id = mat.id
       WHERE md.monster_id = ?
       ORDER BY md.drop_rate DESC`,
      [req.params.id]
    );

    // 도감 해금 정보
    const char = await getSelectedChar(req, pool);
    let bestiaryInfo = null;
    if (char) {
      const [bRows] = await pool.query(
        'SELECT kill_count, first_discovered FROM monster_bestiary WHERE character_id = ? AND monster_id = ?',
        [char.id, m.id]
      );
      if (bRows.length > 0) bestiaryInfo = bRows[0];
    }

    res.json({ monster: m, skills, drops, bestiary: bestiaryInfo });
  } catch (err) {
    console.error('Monster detail error:', err);
    res.status(500).json({ message: '서버 오류가 발생했습니다.' });
  }
});

// 몬스터 처치 기록 (전투 결과에서 호출)
router.post('/record-kills', auth, async (req, res) => {
  try {
    const { monsterIds } = req.body;
    if (!monsterIds || !Array.isArray(monsterIds) || monsterIds.length === 0) {
      return res.json({ success: true });
    }
    const char = await getSelectedChar(req, pool);
    if (!char) return res.status(404).json({ message: '캐릭터가 없습니다.' });

    // 중복 ID 카운트
    const killMap = {};
    for (const mid of monsterIds) {
      if (mid && !isNaN(mid)) {
        killMap[mid] = (killMap[mid] || 0) + 1;
      }
    }

    for (const [monsterId, count] of Object.entries(killMap)) {
      await pool.query(
        `INSERT INTO monster_bestiary (character_id, monster_id, kill_count)
         VALUES (?, ?, ?)
         ON DUPLICATE KEY UPDATE kill_count = kill_count + ?`,
        [char.id, monsterId, count, count]
      );
    }

    const newDiscoveries = [];
    for (const monsterId of Object.keys(killMap)) {
      const [rows] = await pool.query(
        'SELECT kill_count FROM monster_bestiary WHERE character_id = ? AND monster_id = ? AND kill_count = ?',
        [char.id, monsterId, killMap[monsterId]]
      );
      if (rows.length > 0) {
        const [mInfo] = await pool.query('SELECT name, icon FROM monsters WHERE id = ?', [monsterId]);
        if (mInfo.length > 0) newDiscoveries.push({ id: monsterId, name: mInfo[0].name, icon: mInfo[0].icon });
      }
    }

    res.json({ success: true, newDiscoveries });
  } catch (err) {
    console.error('Record kills error:', err);
    res.status(500).json({ message: '서버 오류가 발생했습니다.' });
  }
});

module.exports = router;
