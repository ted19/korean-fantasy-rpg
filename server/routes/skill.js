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

// 내 직업의 전체 스킬 목록 + 습득 여부
router.get('/list', auth, async (req, res) => {
  try {
    const [chars] = await pool.query('SELECT * FROM characters WHERE user_id = ?', [req.user.id]);
    if (chars.length === 0) return res.json({ skills: [] });
    const char = chars[0];

    const [skills] = await pool.query(
      `SELECT s.*, (cs.id IS NOT NULL) as learned
       FROM skills s
       LEFT JOIN character_skills cs ON cs.skill_id = s.id AND cs.character_id = ?
       WHERE s.class_type = ?
       ORDER BY s.required_level, s.id`,
      [char.id, char.class_type]
    );

    res.json({ skills: skills.map(s => ({ ...s, learned: !!s.learned })) });
  } catch (err) {
    console.error('Skill list error:', err);
    res.status(500).json({ message: '서버 오류가 발생했습니다.' });
  }
});

// 스킬 습득
router.post('/learn', auth, async (req, res) => {
  try {
    const { skillId } = req.body;

    const [chars] = await pool.query('SELECT * FROM characters WHERE user_id = ?', [req.user.id]);
    if (chars.length === 0) return res.status(404).json({ message: '캐릭터가 없습니다.' });
    const char = chars[0];

    const [skills] = await pool.query('SELECT * FROM skills WHERE id = ?', [skillId]);
    if (skills.length === 0) return res.status(404).json({ message: '스킬을 찾을 수 없습니다.' });
    const skill = skills[0];

    if (skill.class_type !== char.class_type) {
      return res.status(400).json({ message: '다른 직업의 스킬은 습득할 수 없습니다.' });
    }

    if (char.level < skill.required_level) {
      return res.status(400).json({ message: `레벨 ${skill.required_level} 이상이 필요합니다.` });
    }

    const [existing] = await pool.query(
      'SELECT id FROM character_skills WHERE character_id = ? AND skill_id = ?',
      [char.id, skillId]
    );
    if (existing.length > 0) {
      return res.status(409).json({ message: '이미 습득한 스킬입니다.' });
    }

    await pool.query(
      'INSERT INTO character_skills (character_id, skill_id) VALUES (?, ?)',
      [char.id, skillId]
    );

    res.json({ message: `[${skill.name}] 스킬을 습득했습니다!` });
  } catch (err) {
    console.error('Learn skill error:', err);
    res.status(500).json({ message: '서버 오류가 발생했습니다.' });
  }
});

module.exports = router;
