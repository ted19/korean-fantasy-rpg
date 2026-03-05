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

// 진영 탭 해금 조건 (레벨)
const SLOT_UNLOCK_LEVELS = [0, 100, 200, 300];

// 3x3 그리드 셀 해금 조건: [row, col] => { level, dungeonClears }
// 후열(row0) → 중열(row1) → 전열(row2) 순으로 해금
const CELL_UNLOCK = [
  // [row, col, requiredLevel, requiredDungeonClears]
  [0, 1, 1,  0],   // 후열 중앙 - 기본
  [0, 0, 5,  0],   // 후열 좌
  [0, 2, 10, 0],   // 후열 우
  [1, 1, 15, 3],   // 중열 중앙
  [1, 0, 25, 5],   // 중열 좌
  [1, 2, 35, 8],   // 중열 우
  [2, 1, 45, 12],  // 전열 중앙
  [2, 0, 55, 18],  // 전열 좌
  [2, 2, 70, 25],  // 전열 우
];

// 진영 목록 조회
router.get('/list', auth, async (req, res) => {
  try {
    const [chars] = await pool.query(
      req.selectedCharId
        ? 'SELECT id, level FROM characters WHERE id = ? AND user_id = ?'
        : 'SELECT id, level FROM characters WHERE user_id = ? ORDER BY id LIMIT 1',
      req.selectedCharId ? [req.selectedCharId, req.user.id] : [req.user.id]
    );
    if (chars.length === 0) return res.json({ formations: [], unlockInfo: {} });
    const charId = chars[0].id;
    const charLevel = chars[0].level || 1;

    // 던전 클리어 수 (전체 스테이지 클리어 횟수)
    const [clearRows] = await pool.query(
      'SELECT COALESCE(SUM(stage_number), 0) AS total_clears FROM character_stage_progress WHERE character_id = ?',
      [charId]
    );
    const totalDungeonClears = clearRows[0].total_clears || 0;

    // 해금된 셀 계산
    const unlockedCells = [];
    for (const [row, col, reqLv, reqClears] of CELL_UNLOCK) {
      unlockedCells.push({
        row, col,
        unlocked: charLevel >= reqLv && totalDungeonClears >= reqClears,
        reqLevel: reqLv,
        reqClears,
      });
    }

    // 해금된 진영 탭
    const unlockedSlots = SLOT_UNLOCK_LEVELS.map((reqLv, i) => ({
      slotIndex: i,
      unlocked: charLevel >= reqLv,
      reqLevel: reqLv,
    }));

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

    res.json({
      formations: result,
      unlockInfo: {
        level: charLevel,
        totalDungeonClears,
        cells: unlockedCells,
        slots: unlockedSlots,
      },
    });
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
        ? 'SELECT id, level FROM characters WHERE id = ? AND user_id = ?'
        : 'SELECT id, level FROM characters WHERE user_id = ? ORDER BY id LIMIT 1',
      req.selectedCharId ? [req.selectedCharId, req.user.id] : [req.user.id]
    );
    if (chars.length === 0) return res.status(400).json({ message: '캐릭터가 없습니다.' });
    const charId = chars[0].id;
    const charLevel = chars[0].level || 1;

    // 진영 탭 해금 검증
    if (charLevel < SLOT_UNLOCK_LEVELS[slotIndex]) {
      return res.status(400).json({ message: `진영 ${slotIndex + 1}은(는) Lv.${SLOT_UNLOCK_LEVELS[slotIndex]}에 해금됩니다.` });
    }

    // 셀 해금 검증
    const [clearRows] = await pool.query(
      'SELECT COALESCE(SUM(stage_number), 0) AS total_clears FROM character_stage_progress WHERE character_id = ?',
      [charId]
    );
    const totalDungeonClears = clearRows[0].total_clears || 0;

    // gridData 검증: 3x3 배열
    if (!Array.isArray(gridData) || gridData.length !== 3) {
      return res.status(400).json({ message: '진영 데이터가 올바르지 않습니다.' });
    }

    // 잠긴 셀에 유닛 배치 검증
    for (const [row, col, reqLv, reqClears] of CELL_UNLOCK) {
      const cell = gridData[row] && gridData[row][col];
      if (cell && cell.unitId) {
        if (charLevel < reqLv || totalDungeonClears < reqClears) {
          return res.status(400).json({ message: '아직 해금되지 않은 슬롯에 배치할 수 없습니다.' });
        }
      }
    }

    // 다른 슬롯에 배치된 유닛과 중복 검사
    const newUnitIds = [];
    gridData.forEach(row => row.forEach(cell => {
      if (cell && cell.unitId) newUnitIds.push(cell.unitId);
    }));

    if (newUnitIds.length > 0) {
      const [otherFormations] = await pool.query(
        'SELECT slot_index, grid_data FROM character_formations WHERE character_id = ? AND slot_index != ?',
        [charId, slotIndex]
      );
      const otherUnitIds = new Set();
      for (const f of otherFormations) {
        const gd = typeof f.grid_data === 'string' ? JSON.parse(f.grid_data) : f.grid_data;
        if (Array.isArray(gd)) {
          gd.forEach(row => row.forEach(cell => {
            if (cell && cell.unitId) otherUnitIds.add(cell.unitId);
          }));
        }
      }
      const duplicates = newUnitIds.filter(id => otherUnitIds.has(id));
      if (duplicates.length > 0) {
        return res.status(400).json({ message: '다른 진영에 이미 배치된 유닛이 포함되어 있습니다.' });
      }
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
