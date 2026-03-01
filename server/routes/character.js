const express = require('express');
const jwt = require('jsonwebtoken');
const { pool } = require('../db');

const router = express.Router();
const JWT_SECRET = 'game-secret-key-change-in-production';

// 토큰 검증 미들웨어
function auth(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader) {
    return res.status(401).json({ message: '인증 토큰이 필요합니다.' });
  }
  try {
    const token = authHeader.split(' ')[1];
    req.user = jwt.verify(token, JWT_SECRET);
    next();
  } catch {
    return res.status(401).json({ message: '유효하지 않은 토큰입니다.' });
  }
}

// 직업별 기본 스탯
const CLASS_STATS = {
  '풍수사': { hp: 80, mp: 120, attack: 15, defense: 3, phys_attack: 6, phys_defense: 2, mag_attack: 12, mag_defense: 5, crit_rate: 5, evasion: 5 },
  '무당':   { hp: 90, mp: 100, attack: 12, defense: 5, phys_attack: 6, phys_defense: 3, mag_attack: 8, mag_defense: 4, crit_rate: 8, evasion: 8 },
  '승려':   { hp: 120, mp: 60, attack: 8, defense: 12, phys_attack: 7, phys_defense: 11, mag_attack: 2, mag_defense: 5, crit_rate: 10, evasion: 3 },
};

// 캐릭터 생성
router.post('/', auth, async (req, res) => {
  try {
    const { name, classType, element } = req.body;

    if (!name || !classType) {
      return res.status(400).json({ message: '캐릭터 이름과 직업을 선택해주세요.' });
    }

    if (!CLASS_STATS[classType]) {
      return res.status(400).json({ message: '올바른 직업을 선택해주세요.' });
    }

    const validElements = ['fire', 'water', 'earth', 'wind', 'neutral'];
    const charElement = validElements.includes(element) ? element : 'neutral';

    // 캐릭터 3개까지 생성 가능
    const [existing] = await pool.query(
      'SELECT id FROM characters WHERE user_id = ?',
      [req.user.id]
    );
    if (existing.length >= 3) {
      return res.status(409).json({ message: '캐릭터는 최대 3개까지 생성할 수 있습니다.' });
    }

    // 캐릭터 이름 중복 확인
    const [nameDup] = await pool.query(
      'SELECT id FROM characters WHERE name = ?',
      [name]
    );
    if (nameDup.length > 0) {
      return res.status(409).json({ message: '이미 사용 중인 캐릭터 이름입니다.' });
    }

    const stats = CLASS_STATS[classType];
    const [result] = await pool.query(
      'INSERT INTO characters (user_id, name, class_type, hp, mp, attack, defense, phys_attack, phys_defense, mag_attack, mag_defense, crit_rate, evasion, element) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
      [req.user.id, name, classType, stats.hp, stats.mp, stats.attack, stats.defense, stats.phys_attack, stats.phys_defense, stats.mag_attack, stats.mag_defense, stats.crit_rate, stats.evasion, charElement]
    );

    const [chars] = await pool.query('SELECT * FROM characters WHERE id = ?', [result.insertId]);

    res.status(201).json({ message: '캐릭터가 생성되었습니다.', character: chars[0] });
  } catch (err) {
    console.error('Create character error:', err);
    res.status(500).json({ message: '서버 오류가 발생했습니다.' });
  }
});

// 내 캐릭터 목록 조회
router.get('/list', auth, async (req, res) => {
  try {
    const [chars] = await pool.query(
      'SELECT id, name, class_type, level, element FROM characters WHERE user_id = ? ORDER BY id',
      [req.user.id]
    );
    res.json({ characters: chars });
  } catch (err) {
    console.error('List characters error:', err);
    res.status(500).json({ message: '서버 오류가 발생했습니다.' });
  }
});

// 현재 선택된 캐릭터 조회 (selectedCharId 쿼리 지원)
router.get('/me', auth, async (req, res) => {
  try {
    const { charId } = req.query;
    let chars;
    if (charId) {
      [chars] = await pool.query(
        'SELECT * FROM characters WHERE id = ? AND user_id = ?',
        [charId, req.user.id]
      );
    } else {
      [chars] = await pool.query(
        'SELECT * FROM characters WHERE user_id = ? ORDER BY id LIMIT 1',
        [req.user.id]
      );
    }

    if (chars.length === 0) {
      return res.json({ character: null });
    }

    const c = chars[0];
    c.current_hp = c.current_hp ?? c.hp;
    c.current_mp = c.current_mp ?? c.mp;
    res.json({ character: c });
  } catch (err) {
    console.error('Get character error:', err);
    res.status(500).json({ message: '서버 오류가 발생했습니다.' });
  }
});

// 속성 상성표 조회
router.get('/element-relations', auth, async (req, res) => {
  try {
    const [relations] = await pool.query('SELECT attacker, defender, multiplier FROM element_relations');
    const table = {};
    for (const r of relations) {
      if (!table[r.attacker]) table[r.attacker] = {};
      table[r.attacker][r.defender] = r.multiplier;
    }
    res.json({ relations: table });
  } catch (err) {
    console.error('Element relations error:', err);
    res.status(500).json({ message: '서버 오류' });
  }
});

// 캐릭터 삭제
router.delete('/me', auth, async (req, res) => {
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    const { charId: deleteId } = req.query;
    let charId;
    if (deleteId) {
      const [chars] = await conn.query('SELECT id FROM characters WHERE id = ? AND user_id = ?', [deleteId, req.user.id]);
      if (chars.length === 0) {
        await conn.rollback();
        return res.status(404).json({ message: '캐릭터가 없습니다.' });
      }
      charId = chars[0].id;
    } else {
      const [chars] = await conn.query('SELECT id FROM characters WHERE user_id = ?', [req.user.id]);
      if (chars.length === 0) {
        await conn.rollback();
        return res.status(404).json({ message: '캐릭터가 없습니다.' });
      }
      charId = chars[0].id;
    }
    await conn.query('DELETE FROM equipment WHERE character_id = ?', [charId]);
    await conn.query('DELETE FROM inventory WHERE character_id = ?', [charId]);
    await conn.query('DELETE FROM material_inventory WHERE character_id = ?', [charId]);
    await conn.query('DELETE FROM character_quests WHERE character_id = ?', [charId]);
    await conn.query('DELETE FROM character_skills WHERE character_id = ?', [charId]);
    await conn.query('DELETE FROM battle_logs WHERE character_id = ?', [charId]);
    await conn.query('DELETE FROM character_formations WHERE character_id = ?', [charId]);
    await conn.query('DELETE FROM character_stage_clear WHERE character_id = ?', [charId]);
    await conn.query('DELETE FROM character_stage_progress WHERE character_id = ?', [charId]);
    const [summons] = await conn.query('SELECT id FROM character_summons WHERE character_id = ?', [charId]);
    for (const s of summons) {
      await conn.query('DELETE FROM summon_equipment WHERE summon_id = ?', [s.id]);
      await conn.query('DELETE FROM summon_learned_skills WHERE summon_id = ?', [s.id]);
    }
    await conn.query('DELETE FROM character_summons WHERE character_id = ?', [charId]);
    await conn.query('DELETE FROM character_mercenaries WHERE character_id = ?', [charId]);
    await conn.query('DELETE FROM characters WHERE id = ?', [charId]);
    await conn.commit();
    res.json({ message: '캐릭터가 삭제되었습니다.' });
  } catch (err) {
    await conn.rollback();
    console.error('Delete character error:', err);
    res.status(500).json({ message: '서버 오류가 발생했습니다.' });
  } finally {
    conn.release();
  }
});

module.exports = router;
