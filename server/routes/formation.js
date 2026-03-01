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

const SLOT_NAMES = ['메인 진영', '진영 2', '진영 3', '진영 4'];
const MAX_SLOTS = 4;

// 진영 목록 조회
router.get('/list', auth, async (req, res) => {
  try {
    const [chars] = await pool.query(
      req.selectedCharId
        ? 'SELECT id FROM characters WHERE id = ? AND user_id = ?'
        : 'SELECT id FROM characters WHERE user_id = ? ORDER BY id LIMIT 1',
      req.selectedCharId ? [req.selectedCharId, req.user.id] : [req.user.id]
    );
    if (chars.length === 0) return res.json({ formations: [] });
    const charId = chars[0].id;

    const [formations] = await pool.query(
      'SELECT * FROM character_formations WHERE character_id = ? ORDER BY slot_index',
      [charId]
    );

    // 없으면 빈 슬롯 4개 반환
    const result = [];
    for (let i = 0; i < MAX_SLOTS; i++) {
      const existing = formations.find(f => f.slot_index === i);
      if (existing) {
        result.push({
          id: existing.id,
          slotIndex: existing.slot_index,
          name: existing.name,
          gridData: typeof existing.grid_data === 'string' ? JSON.parse(existing.grid_data) : existing.grid_data,
          isDefault: !!existing.is_default,
        });
      } else {
        result.push({
          id: null,
          slotIndex: i,
          name: SLOT_NAMES[i],
          gridData: Array(3).fill(null).map(() => Array(3).fill(null)),
          isDefault: i === 0,
        });
      }
    }

    res.json({ formations: result });
  } catch (err) {
    console.error('Formation list error:', err);
    res.status(500).json({ message: '서버 오류가 발생했습니다.' });
  }
});

// 진영 저장/업데이트
router.post('/save', auth, async (req, res) => {
  try {
    const { slotIndex, name, gridData } = req.body;
    if (slotIndex < 0 || slotIndex >= MAX_SLOTS) {
      return res.status(400).json({ message: '유효하지 않은 슬롯입니다.' });
    }

    const [chars] = await pool.query(
      req.selectedCharId
        ? 'SELECT id FROM characters WHERE id = ? AND user_id = ?'
        : 'SELECT id FROM characters WHERE user_id = ? ORDER BY id LIMIT 1',
      req.selectedCharId ? [req.selectedCharId, req.user.id] : [req.user.id]
    );
    if (chars.length === 0) return res.status(400).json({ message: '캐릭터가 없습니다.' });
    const charId = chars[0].id;

    // gridData 검증: 3x3 배열
    if (!Array.isArray(gridData) || gridData.length !== 3) {
      return res.status(400).json({ message: '진영 데이터가 올바르지 않습니다.' });
    }

    const gridJson = JSON.stringify(gridData);
    const formationName = name || SLOT_NAMES[slotIndex];

    const [existing] = await pool.query(
      'SELECT id FROM character_formations WHERE character_id = ? AND slot_index = ?',
      [charId, slotIndex]
    );

    if (existing.length > 0) {
      await pool.query(
        'UPDATE character_formations SET name = ?, grid_data = ?, updated_at = NOW() WHERE character_id = ? AND slot_index = ?',
        [formationName, gridJson, charId, slotIndex]
      );
    } else {
      await pool.query(
        'INSERT INTO character_formations (character_id, slot_index, name, grid_data, is_default) VALUES (?, ?, ?, ?, ?)',
        [charId, slotIndex, formationName, gridJson, slotIndex === 0 ? 1 : 0]
      );
    }

    res.json({ success: true, message: '진영이 저장되었습니다.' });
  } catch (err) {
    console.error('Formation save error:', err);
    res.status(500).json({ message: '서버 오류가 발생했습니다.' });
  }
});

module.exports = router;
