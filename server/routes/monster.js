const express = require('express');
const jwt = require('jsonwebtoken');
const { pool } = require('../db');

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
    const { category_id, tier, search } = req.query;
    let sql = `SELECT m.id, m.name, m.icon, m.hp, m.attack, m.defense, m.move_range,
               m.exp_reward, m.gold_reward, m.tier, m.description, m.category_id,
               m.ai_type, m.mp,
               mc.name as category_name, mc.icon as category_icon,
               d.name as dungeon_name, d.key_name as dungeon_key
               FROM monsters m
               LEFT JOIN monster_categories mc ON m.category_id = mc.id
               LEFT JOIN dungeons d ON m.dungeon_id = d.id
               WHERE 1=1`;
    const params = [];

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

    sql += ' ORDER BY m.category_id, m.tier, m.name';

    const [monsters] = await pool.query(sql, params);

    // 로컬 SVG 이미지 경로
    const monstersWithImages = monsters.map(m => ({
      ...m,
      image_url: `/monsters/${m.id}_full.png`,
      icon_url: `/monsters/${m.id}_icon.png`,
    }));

    res.json({ monsters: monstersWithImages });
  } catch (err) {
    console.error('Monster encyclopedia error:', err);
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

    res.json({ monster: m, skills });
  } catch (err) {
    console.error('Monster detail error:', err);
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

module.exports = router;
