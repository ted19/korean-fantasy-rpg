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

// 게시판 퀘스트 목록 (수락 가능한 것들)
router.get('/available', auth, async (req, res) => {
  try {
    const [chars] = await pool.query(
      req.selectedCharId
        ? 'SELECT * FROM characters WHERE id = ? AND user_id = ?'
        : 'SELECT * FROM characters WHERE user_id = ? ORDER BY id LIMIT 1',
      req.selectedCharId ? [req.selectedCharId, req.user.id] : [req.user.id]
    );
    if (chars.length === 0) return res.json({ quests: [] });
    const char = chars[0];

    // 이미 수락했거나 완료한 퀘스트 ID
    const [taken] = await pool.query(
      'SELECT quest_id FROM character_quests WHERE character_id = ?',
      [char.id]
    );
    const takenIds = taken.map((r) => r.quest_id);

    // 완료(보상수령)한 퀘스트 ID
    const [rewarded] = await pool.query(
      "SELECT quest_id FROM character_quests WHERE character_id = ? AND status = 'rewarded'",
      [char.id]
    );
    const rewardedIds = rewarded.map((r) => r.quest_id);

    const [allQuests] = await pool.query('SELECT * FROM quests ORDER BY required_level, id');

    const available = allQuests.filter((q) => {
      if (takenIds.includes(q.id)) return false;
      if (char.level < q.required_level) return false;
      if (q.prerequisite_quest_id && !rewardedIds.includes(q.prerequisite_quest_id)) return false;
      return true;
    });

    res.json({ quests: available });
  } catch (err) {
    console.error('Available quests error:', err);
    res.status(500).json({ message: '서버 오류가 발생했습니다.' });
  }
});

// 내 진행중/완료 퀘스트
router.get('/my', auth, async (req, res) => {
  try {
    const [chars] = await pool.query(
      req.selectedCharId
        ? 'SELECT id FROM characters WHERE id = ? AND user_id = ?'
        : 'SELECT id FROM characters WHERE user_id = ? ORDER BY id LIMIT 1',
      req.selectedCharId ? [req.selectedCharId, req.user.id] : [req.user.id]
    );
    if (chars.length === 0) return res.json({ quests: [] });

    const [rows] = await pool.query(
      `SELECT cq.*, q.title, q.description, q.type, q.target, q.target_count,
              q.reward_exp, q.reward_gold, q.reward_item_id, q.reward_item_qty,
              it.name as reward_item_name
       FROM character_quests cq
       JOIN quests q ON cq.quest_id = q.id
       LEFT JOIN items it ON q.reward_item_id = it.id
       WHERE cq.character_id = ? AND cq.status IN ('active', 'completed')
       ORDER BY cq.status DESC, cq.accepted_at`,
      [chars[0].id]
    );

    res.json({ quests: rows });
  } catch (err) {
    console.error('My quests error:', err);
    res.status(500).json({ message: '서버 오류가 발생했습니다.' });
  }
});

// 퀘스트 수락
router.post('/accept', auth, async (req, res) => {
  try {
    const { questId } = req.body;

    const [chars] = await pool.query(
      req.selectedCharId
        ? 'SELECT * FROM characters WHERE id = ? AND user_id = ?'
        : 'SELECT * FROM characters WHERE user_id = ? ORDER BY id LIMIT 1',
      req.selectedCharId ? [req.selectedCharId, req.user.id] : [req.user.id]
    );
    if (chars.length === 0) return res.status(404).json({ message: '캐릭터가 없습니다.' });
    const char = chars[0];

    const [quests] = await pool.query('SELECT * FROM quests WHERE id = ?', [questId]);
    if (quests.length === 0) return res.status(404).json({ message: '퀘스트를 찾을 수 없습니다.' });
    const quest = quests[0];

    if (char.level < quest.required_level) {
      return res.status(400).json({ message: `레벨 ${quest.required_level} 이상만 수락할 수 있습니다.` });
    }

    // 선행 퀘스트 체크
    if (quest.prerequisite_quest_id) {
      const [pre] = await pool.query(
        "SELECT id FROM character_quests WHERE character_id = ? AND quest_id = ? AND status = 'rewarded'",
        [char.id, quest.prerequisite_quest_id]
      );
      if (pre.length === 0) {
        return res.status(400).json({ message: '선행 퀘스트를 먼저 완료해주세요.' });
      }
    }

    // 이미 수락 여부
    const [dup] = await pool.query(
      'SELECT id FROM character_quests WHERE character_id = ? AND quest_id = ?',
      [char.id, questId]
    );
    if (dup.length > 0) {
      return res.status(409).json({ message: '이미 수락한 퀘스트입니다.' });
    }

    // 레벨 퀘스트는 수락 즉시 진행도 체크
    let progress = 0;
    let status = 'active';
    if (quest.type === 'level') {
      if (char.level >= parseInt(quest.target)) {
        progress = 1;
        status = 'completed';
      }
    }

    await pool.query(
      'INSERT INTO character_quests (character_id, quest_id, status, progress) VALUES (?, ?, ?, ?)',
      [char.id, questId, status, progress]
    );

    if (status === 'completed') {
      await pool.query(
        "UPDATE character_quests SET completed_at = NOW() WHERE character_id = ? AND quest_id = ?",
        [char.id, questId]
      );
    }

    res.json({ message: `[${quest.title}] 퀘스트를 수락했습니다.`, status, progress });
  } catch (err) {
    console.error('Accept quest error:', err);
    res.status(500).json({ message: '서버 오류가 발생했습니다.' });
  }
});

// 보상 수령
router.post('/reward', auth, async (req, res) => {
  const conn = await pool.getConnection();
  try {
    const { questId } = req.body;

    const [chars] = await conn.query(
      req.selectedCharId
        ? 'SELECT * FROM characters WHERE id = ? AND user_id = ?'
        : 'SELECT * FROM characters WHERE user_id = ? ORDER BY id LIMIT 1',
      req.selectedCharId ? [req.selectedCharId, req.user.id] : [req.user.id]
    );
    if (chars.length === 0) return res.status(404).json({ message: '캐릭터가 없습니다.' });
    const char = chars[0];

    const [cqRows] = await conn.query(
      "SELECT cq.*, q.title, q.reward_exp, q.reward_gold, q.reward_item_id, q.reward_item_qty FROM character_quests cq JOIN quests q ON cq.quest_id = q.id WHERE cq.character_id = ? AND cq.quest_id = ? AND cq.status = 'completed'",
      [char.id, questId]
    );
    if (cqRows.length === 0) {
      return res.status(400).json({ message: '보상을 받을 수 없는 퀘스트입니다.' });
    }

    const cq = cqRows[0];

    await conn.beginTransaction();

    // 보상 수령 상태로
    await conn.query(
      "UPDATE character_quests SET status = 'rewarded' WHERE character_id = ? AND quest_id = ?",
      [char.id, questId]
    );

    // EXP / 골드 지급
    let newExp = (char.exp || 0) + cq.reward_exp;
    let newGold = (char.gold || 0) + cq.reward_gold;
    let newLevel = char.level;
    let newMaxHp = char.hp;
    let newMaxMp = char.mp;
    let newAtk = char.attack;
    let newDef = char.defense;
    let newPAtk = char.phys_attack, newPDef = char.phys_defense, newMAtk = char.mag_attack, newMDef = char.mag_defense, newCrit = char.crit_rate, newEvasion = char.evasion;
    let leveledUp = false;

    // 성장률 테이블 참조 레벨업
    const [growthRowsQ] = await conn.query(
      'SELECT * FROM class_growth_rates WHERE class_type = ?', [char.class_type]
    );
    const gq = growthRowsQ[0] || { hp_per_level: 10, mp_per_level: 5, attack_per_level: 2, defense_per_level: 1, phys_attack_per_level: 2, phys_defense_per_level: 1, mag_attack_per_level: 1, mag_defense_per_level: 1, crit_rate_per_10level: 1, evasion_per_10level: 1 };
    let expNeeded = newLevel * 100;
    while (newExp >= expNeeded) {
      newExp -= expNeeded;
      newLevel++;
      newMaxHp += Math.floor(gq.hp_per_level);
      newMaxMp += Math.floor(gq.mp_per_level);
      newAtk += Math.floor(gq.attack_per_level);
      newDef += Math.floor(gq.defense_per_level);
      newPAtk += Math.floor(gq.phys_attack_per_level);
      newPDef += Math.floor(gq.phys_defense_per_level);
      newMAtk += Math.floor(gq.mag_attack_per_level);
      newMDef += Math.floor(gq.mag_defense_per_level);
      if (newLevel % 10 === 0) {
        newCrit += Math.floor(gq.crit_rate_per_10level);
        newEvasion += Math.floor(gq.evasion_per_10level);
      }
      leveledUp = true;
      expNeeded = newLevel * 100;
    }

    await conn.query(
      'UPDATE characters SET exp = ?, gold = ?, level = ?, hp = ?, mp = ?, attack = ?, defense = ?, phys_attack = ?, phys_defense = ?, mag_attack = ?, mag_defense = ?, crit_rate = ?, evasion = ? WHERE id = ?',
      [newExp, newGold, newLevel, newMaxHp, newMaxMp, newAtk, newDef, newPAtk, newPDef, newMAtk, newMDef, newCrit, newEvasion, char.id]
    );

    if (leveledUp) {
      await conn.query('UPDATE characters SET current_hp = hp, current_mp = mp WHERE id = ?', [char.id]);
    }

    // 아이템 보상
    let rewardItemName = null;
    if (cq.reward_item_id && cq.reward_item_qty > 0) {
      const [itemRows] = await conn.query('SELECT name FROM items WHERE id = ?', [cq.reward_item_id]);
      if (itemRows.length > 0) rewardItemName = itemRows[0].name;

      await conn.query(
        `INSERT INTO inventory (character_id, item_id, quantity)
         VALUES (?, ?, ?) ON DUPLICATE KEY UPDATE quantity = quantity + ?`,
        [char.id, cq.reward_item_id, cq.reward_item_qty, cq.reward_item_qty]
      );
    }

    // 레벨업으로 다른 레벨 퀘스트 완료 체크
    if (leveledUp) {
      await conn.query(
        `UPDATE character_quests cq
         JOIN quests q ON cq.quest_id = q.id
         SET cq.status = 'completed', cq.progress = 1, cq.completed_at = NOW()
         WHERE cq.character_id = ? AND cq.status = 'active' AND q.type = 'level' AND ? >= CAST(q.target AS UNSIGNED)`,
        [char.id, newLevel]
      );
    }

    await conn.commit();

    const [updated] = await pool.query('SELECT * FROM characters WHERE id = ?', [char.id]);
    const c = updated[0];

    let msg = `[${cq.title}] 보상 수령! EXP +${cq.reward_exp}, Gold +${cq.reward_gold}`;
    if (rewardItemName) msg += `, ${rewardItemName} x${cq.reward_item_qty}`;
    if (leveledUp) msg += ` (레벨 업! Lv.${newLevel})`;

    res.json({
      message: msg,
      character: {
        level: c.level, exp: c.exp, gold: c.gold,
        hp: c.hp, mp: c.mp, attack: c.attack, defense: c.defense,
        phys_attack: c.phys_attack, phys_defense: c.phys_defense,
        mag_attack: c.mag_attack, mag_defense: c.mag_defense,
        crit_rate: c.crit_rate, evasion: c.evasion,
        current_hp: c.current_hp, current_mp: c.current_mp,
      },
    });
  } catch (err) {
    await conn.rollback();
    console.error('Reward error:', err);
    res.status(500).json({ message: '서버 오류가 발생했습니다.' });
  } finally {
    conn.release();
  }
});

// 퀘스트 포기
router.post('/abandon', auth, async (req, res) => {
  try {
    const { questId } = req.body;
    const [chars] = await pool.query(
      req.selectedCharId
        ? 'SELECT id FROM characters WHERE id = ? AND user_id = ?'
        : 'SELECT id FROM characters WHERE user_id = ? ORDER BY id LIMIT 1',
      req.selectedCharId ? [req.selectedCharId, req.user.id] : [req.user.id]
    );
    if (chars.length === 0) return res.status(404).json({ message: '캐릭터가 없습니다.' });

    await pool.query(
      "DELETE FROM character_quests WHERE character_id = ? AND quest_id = ? AND status = 'active'",
      [chars[0].id, questId]
    );

    res.json({ message: '퀘스트를 포기했습니다.' });
  } catch (err) {
    console.error('Abandon error:', err);
    res.status(500).json({ message: '서버 오류가 발생했습니다.' });
  }
});

module.exports = router;
