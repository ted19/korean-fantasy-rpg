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

// 용병 템플릿 목록 (여관에서 고용 가능한 용병)
router.get('/templates', auth, async (req, res) => {
  try {
    const [templates] = await pool.query('SELECT * FROM mercenary_templates ORDER BY required_level, price');
    res.json({ templates });
  } catch (err) {
    console.error('Mercenary templates error:', err);
    res.status(500).json({ message: '서버 오류가 발생했습니다.' });
  }
});

// 내 용병 목록
router.get('/my', auth, async (req, res) => {
  try {
    const [chars] = await pool.query(
      req.selectedCharId
        ? 'SELECT id FROM characters WHERE id = ? AND user_id = ?'
        : 'SELECT id FROM characters WHERE user_id = ? ORDER BY id LIMIT 1',
      req.selectedCharId ? [req.selectedCharId, req.user.id] : [req.user.id]
    );
    if (chars.length === 0) return res.json({ mercenaries: [] });

    const [mercenaries] = await pool.query(
      `SELECT cm.*, mt.class_type, mt.description, mt.icon, mt.range_type, mt.element, mt.weapon_type,
              mt.sell_price, mt.growth_hp, mt.growth_mp, mt.growth_phys_attack, mt.growth_phys_defense,
              mt.growth_mag_attack, mt.growth_mag_defense
       FROM character_mercenaries cm
       JOIN mercenary_templates mt ON cm.template_id = mt.id
       WHERE cm.character_id = ?
       ORDER BY cm.level DESC, cm.name`,
      [chars[0].id]
    );

    res.json({ mercenaries });
  } catch (err) {
    console.error('My mercenaries error:', err);
    res.status(500).json({ message: '서버 오류가 발생했습니다.' });
  }
});

// 용병 고용
router.post('/hire', auth, async (req, res) => {
  const conn = await pool.getConnection();
  try {
    const { templateId } = req.body;
    const [chars] = await conn.query(
      req.selectedCharId
        ? 'SELECT * FROM characters WHERE id = ? AND user_id = ?'
        : 'SELECT * FROM characters WHERE user_id = ? ORDER BY id LIMIT 1',
      req.selectedCharId ? [req.selectedCharId, req.user.id] : [req.user.id]
    );
    if (chars.length === 0) return res.status(404).json({ message: '캐릭터가 없습니다.' });
    const char = chars[0];

    const [templates] = await conn.query('SELECT * FROM mercenary_templates WHERE id = ?', [templateId]);
    if (templates.length === 0) return res.status(404).json({ message: '용병을 찾을 수 없습니다.' });
    const tpl = templates[0];

    if (char.level < tpl.required_level) {
      return res.status(400).json({ message: `레벨 ${tpl.required_level} 이상이어야 고용할 수 있습니다.` });
    }

    const gold = char.gold || 0;
    if (gold < tpl.price) {
      return res.status(400).json({ message: `골드가 부족합니다. (필요: ${tpl.price}G, 보유: ${gold}G)` });
    }

    // 최대 5명 제한
    const [countCheck] = await conn.query(
      'SELECT COUNT(*) as cnt FROM character_mercenaries WHERE character_id = ?', [char.id]
    );
    if (countCheck[0].cnt >= 5) {
      return res.status(400).json({ message: '용병은 최대 5명까지 고용할 수 있습니다.' });
    }

    await conn.beginTransaction();

    await conn.query('UPDATE characters SET gold = gold - ? WHERE id = ?', [tpl.price, char.id]);

    await conn.query(
      `INSERT INTO character_mercenaries
       (character_id, template_id, name, level, exp, hp, mp,
        phys_attack, phys_defense, mag_attack, mag_defense, crit_rate, evasion)
       VALUES (?, ?, ?, 1, 0, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [char.id, tpl.id, tpl.name, tpl.base_hp, tpl.base_mp,
       tpl.base_phys_attack, tpl.base_phys_defense, tpl.base_mag_attack, tpl.base_mag_defense,
       tpl.base_crit_rate, tpl.base_evasion]
    );

    await conn.commit();

    const [updatedChar] = await pool.query('SELECT gold FROM characters WHERE id = ?', [char.id]);

    res.json({
      message: `${tpl.name}을(를) 고용했습니다!`,
      gold: updatedChar[0].gold,
    });
  } catch (err) {
    await conn.rollback();
    console.error('Hire mercenary error:', err);
    res.status(500).json({ message: '서버 오류가 발생했습니다.' });
  } finally {
    conn.release();
  }
});

// 용병 해고
router.post('/fire', auth, async (req, res) => {
  const conn = await pool.getConnection();
  try {
    const { mercenaryId } = req.body;
    const [chars] = await conn.query(
      req.selectedCharId
        ? 'SELECT * FROM characters WHERE id = ? AND user_id = ?'
        : 'SELECT * FROM characters WHERE user_id = ? ORDER BY id LIMIT 1',
      req.selectedCharId ? [req.selectedCharId, req.user.id] : [req.user.id]
    );
    if (chars.length === 0) return res.status(404).json({ message: '캐릭터가 없습니다.' });
    const char = chars[0];

    const [mercs] = await conn.query(
      `SELECT cm.*, mt.sell_price FROM character_mercenaries cm
       JOIN mercenary_templates mt ON cm.template_id = mt.id
       WHERE cm.id = ? AND cm.character_id = ?`,
      [mercenaryId, char.id]
    );
    if (mercs.length === 0) return res.status(404).json({ message: '용병을 찾을 수 없습니다.' });
    const merc = mercs[0];

    await conn.beginTransaction();
    await conn.query('DELETE FROM character_mercenaries WHERE id = ?', [mercenaryId]);
    await conn.query('UPDATE characters SET gold = gold + ? WHERE id = ?', [merc.sell_price, char.id]);
    await conn.commit();

    const [updatedChar] = await pool.query('SELECT gold FROM characters WHERE id = ?', [char.id]);

    res.json({
      message: `${merc.name}을(를) 해고했습니다. ${merc.sell_price}G 반환.`,
      gold: updatedChar[0].gold,
    });
  } catch (err) {
    await conn.rollback();
    console.error('Fire mercenary error:', err);
    res.status(500).json({ message: '서버 오류가 발생했습니다.' });
  } finally {
    conn.release();
  }
});

module.exports = router;
