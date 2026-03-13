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

// 일일 퀘스트 리셋 체크
function getLocalDateStr(d) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

async function checkDailyReset(charId, conn) {
  const db = conn || pool;
  const today = getLocalDateStr(new Date());
  const [rows] = await db.query(
    'SELECT last_reset FROM character_daily_reset WHERE character_id = ?',
    [charId]
  );
  if (rows.length === 0) {
    await db.query(
      'INSERT INTO character_daily_reset (character_id, last_reset) VALUES (?, ?)',
      [charId, today]
    );
    return;
  }
  const raw = rows[0].last_reset;
  const lastReset = raw instanceof Date ? getLocalDateStr(raw) : String(raw).slice(0, 10);
  if (lastReset < today) {
    // 일일 퀘스트 리셋
    await db.query(
      `DELETE cq FROM character_quests cq
       JOIN quests q ON cq.quest_id = q.id
       WHERE cq.character_id = ? AND q.category = 'daily'`,
      [charId]
    );
    await db.query(
      'UPDATE character_daily_reset SET last_reset = ? WHERE character_id = ?',
      [today, charId]
    );
  }
}

// 카테고리별 퀘스트 목록 + 내 진행상황
router.get('/list', auth, async (req, res) => {
  try {
    const [chars] = await pool.query(
      req.selectedCharId
        ? 'SELECT * FROM characters WHERE id = ? AND user_id = ?'
        : 'SELECT * FROM characters WHERE user_id = ? ORDER BY id LIMIT 1',
      req.selectedCharId ? [req.selectedCharId, req.user.id] : [req.user.id]
    );
    if (chars.length === 0) return res.json({ quests: [], myQuests: [] });
    const char = chars[0];

    await checkDailyReset(char.id);

    // 모든 퀘스트
    const [allQuests] = await pool.query(
      'SELECT * FROM quests ORDER BY category, chapter, sort_order, id'
    );

    // 내 퀘스트 상태
    const [myQuests] = await pool.query(
      `SELECT cq.*, q.title, q.description, q.category, q.type, q.target, q.target_count,
              q.reward_exp, q.reward_gold, q.reward_item_id, q.reward_item_qty,
              q.chapter, q.sort_order, q.icon, q.required_level, q.prerequisite_quest_id,
              it.name as reward_item_name
       FROM character_quests cq
       JOIN quests q ON cq.quest_id = q.id
       LEFT JOIN items it ON q.reward_item_id = it.id
       WHERE cq.character_id = ?
       ORDER BY q.category, q.chapter, q.sort_order`,
      [char.id]
    );

    // 완료(보상수령)한 퀘스트 ID
    const rewardedIds = myQuests.filter(q => q.status === 'rewarded').map(q => q.quest_id);
    const takenIds = myQuests.map(q => q.quest_id);

    // 수락 가능 여부 판별
    const questsWithStatus = allQuests.map(q => {
      const myQ = myQuests.find(mq => mq.quest_id === q.id);
      let status = 'available';
      let progress = 0;
      if (myQ) {
        status = myQ.status;
        progress = myQ.progress;
      } else {
        // 아직 수락 안 함 - 수락 가능 여부 체크
        if (char.level < q.required_level) status = 'locked_level';
        else if (q.prerequisite_quest_id && !rewardedIds.includes(q.prerequisite_quest_id)) status = 'locked_prereq';
        else status = 'available';
      }
      return {
        id: q.id,
        title: q.title,
        description: q.description,
        category: q.category,
        type: q.type,
        target: q.target,
        targetCount: q.target_count,
        rewardExp: q.reward_exp,
        rewardGold: q.reward_gold,
        rewardItemId: q.reward_item_id,
        rewardItemQty: q.reward_item_qty,
        rewardItemName: myQ?.reward_item_name || null,
        requiredLevel: q.required_level,
        prerequisiteQuestId: q.prerequisite_quest_id,
        chapter: q.chapter,
        sortOrder: q.sort_order,
        icon: q.icon,
        status,
        progress,
      };
    });

    // 일일 퀘스트 리셋까지 남은 시간
    const now = new Date();
    const tomorrow = new Date(now);
    tomorrow.setDate(tomorrow.getDate() + 1);
    tomorrow.setHours(0, 0, 0, 0);
    const dailyResetMs = tomorrow - now;

    res.json({
      quests: questsWithStatus,
      dailyResetMs,
      charLevel: char.level,
    });
  } catch (err) {
    console.error('Quest list error:', err);
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

// 여러 퀘스트 일괄 수락
router.post('/accept-all', auth, async (req, res) => {
  try {
    const { questIds } = req.body;
    if (!questIds || !questIds.length) return res.status(400).json({ message: '퀘스트 목록이 없습니다.' });

    const [chars] = await pool.query(
      req.selectedCharId
        ? 'SELECT * FROM characters WHERE id = ? AND user_id = ?'
        : 'SELECT * FROM characters WHERE user_id = ? ORDER BY id LIMIT 1',
      req.selectedCharId ? [req.selectedCharId, req.user.id] : [req.user.id]
    );
    if (chars.length === 0) return res.status(404).json({ message: '캐릭터가 없습니다.' });
    const char = chars[0];

    let accepted = 0;
    for (const qId of questIds) {
      const [quests] = await pool.query('SELECT * FROM quests WHERE id = ?', [qId]);
      if (quests.length === 0) continue;
      const quest = quests[0];
      if (char.level < quest.required_level) continue;

      if (quest.prerequisite_quest_id) {
        const [pre] = await pool.query(
          "SELECT id FROM character_quests WHERE character_id = ? AND quest_id = ? AND status = 'rewarded'",
          [char.id, quest.prerequisite_quest_id]
        );
        if (pre.length === 0) continue;
      }

      const [dup] = await pool.query(
        'SELECT id FROM character_quests WHERE character_id = ? AND quest_id = ?',
        [char.id, qId]
      );
      if (dup.length > 0) continue;

      let progress = 0;
      let status = 'active';
      if (quest.type === 'level' && char.level >= parseInt(quest.target)) {
        progress = 1;
        status = 'completed';
      }

      await pool.query(
        'INSERT INTO character_quests (character_id, quest_id, status, progress) VALUES (?, ?, ?, ?)',
        [char.id, qId, status, progress]
      );
      if (status === 'completed') {
        await pool.query(
          "UPDATE character_quests SET completed_at = NOW() WHERE character_id = ? AND quest_id = ?",
          [char.id, qId]
        );
      }
      accepted++;
    }

    res.json({ message: `${accepted}개 퀘스트를 수락했습니다.`, accepted });
  } catch (err) {
    console.error('Accept all error:', err);
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
      `SELECT cq.*, q.title, q.reward_exp, q.reward_gold, q.reward_item_id, q.reward_item_qty
       FROM character_quests cq JOIN quests q ON cq.quest_id = q.id
       WHERE cq.character_id = ? AND cq.quest_id = ? AND cq.status = 'completed'`,
      [char.id, questId]
    );
    if (cqRows.length === 0) {
      return res.status(400).json({ message: '보상을 받을 수 없는 퀘스트입니다.' });
    }

    const cq = cqRows[0];

    await conn.beginTransaction();

    await conn.query(
      "UPDATE character_quests SET status = 'rewarded' WHERE character_id = ? AND quest_id = ?",
      [char.id, questId]
    );

    let newExp = (char.exp || 0) + cq.reward_exp;
    let newGold = (char.gold || 0) + cq.reward_gold;
    let newLevel = char.level;
    let newMaxHp = char.hp;
    let newMaxMp = char.mp;
    let newAtk = char.attack;
    let newDef = char.defense;
    let newPAtk = char.phys_attack, newPDef = char.phys_defense, newMAtk = char.mag_attack, newMDef = char.mag_defense, newCrit = char.crit_rate, newEvasion = char.evasion;
    const levelBefore = newLevel;

    const [growthRowsQ] = await conn.query(
      'SELECT * FROM class_growth_rates WHERE class_type = ?', [char.class_type]
    );
    const gq = growthRowsQ[0] || { hp_per_level: 10, mp_per_level: 5, attack_per_level: 2, defense_per_level: 1, phys_attack_per_level: 2, phys_defense_per_level: 1, mag_attack_per_level: 1, mag_defense_per_level: 1, crit_rate_per_10level: 1, evasion_per_10level: 1 };
    let expNeeded = Math.floor(120 * newLevel + 3 * newLevel * newLevel);
    while (newExp >= expNeeded && newLevel < 100) {
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
      expNeeded = Math.floor(120 * newLevel + 3 * newLevel * newLevel);
    }
    if (newLevel >= 100) { newLevel = 100; newExp = 0; }

    const questLevelUps = newLevel - levelBefore;

    await conn.query(
      `UPDATE characters SET exp = ?, gold = ?, level = ?, hp = ?, mp = ?, attack = ?, defense = ?,
       phys_attack = ?, phys_defense = ?, mag_attack = ?, mag_defense = ?, crit_rate = ?, evasion = ?,
       skill_points = skill_points + ?, total_skill_points = total_skill_points + ?
       WHERE id = ?`,
      [newExp, newGold, newLevel, newMaxHp, newMaxMp, newAtk, newDef, newPAtk, newPDef, newMAtk, newMDef, newCrit, newEvasion,
       questLevelUps, questLevelUps, char.id]
    );

    if (questLevelUps > 0) {
      await conn.query('UPDATE characters SET current_hp = hp, current_mp = mp WHERE id = ?', [char.id]);
    }

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

    if (questLevelUps > 0) {
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
    if (questLevelUps > 0) msg += ` (레벨 업! Lv.${newLevel})`;

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
      reward: {
        questTitle: cq.title,
        exp: cq.reward_exp,
        gold: cq.reward_gold,
        itemName: rewardItemName,
        itemQty: cq.reward_item_qty,
        itemId: cq.reward_item_id,
        levelUp: questLevelUps > 0 ? newLevel : null,
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