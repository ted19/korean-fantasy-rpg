const express = require('express');
const jwt = require('jsonwebtoken');
const { pool, refreshStamina, calcMaxStamina } = require('../db');

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
  '풍수사': { hp: 80, mp: 120, attack: 15, defense: 5, phys_attack: 5, phys_defense: 3, mag_attack: 14, mag_defense: 6, crit_rate: 5, evasion: 5 },
  '무당':   { hp: 100, mp: 100, attack: 12, defense: 7, phys_attack: 8, phys_defense: 5, mag_attack: 10, mag_defense: 5, crit_rate: 8, evasion: 8 },
  '승려':   { hp: 130, mp: 70, attack: 10, defense: 12, phys_attack: 10, phys_defense: 11, mag_attack: 5, mag_defense: 8, crit_rate: 6, evasion: 3 },
  '저승사자': { hp: 90, mp: 90, attack: 18, defense: 4, phys_attack: 12, phys_defense: 2, mag_attack: 12, mag_defense: 4, crit_rate: 12, evasion: 10 },
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
    // 저승사자는 중립 속성만 가능
    const charElement = classType === '저승사자' ? 'neutral' : (validElements.includes(element) ? element : 'neutral');

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
    const initStamina = calcMaxStamina(1);
    const [result] = await pool.query(
      'INSERT INTO characters (user_id, name, class_type, hp, mp, attack, defense, phys_attack, phys_defense, mag_attack, mag_defense, crit_rate, evasion, element, skill_points, total_skill_points, stamina, max_stamina) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, 1, ?, ?)',
      [req.user.id, name, classType, stats.hp, stats.mp, stats.attack, stats.defense, stats.phys_attack, stats.phys_defense, stats.mag_attack, stats.mag_defense, stats.crit_rate, stats.evasion, charElement, initStamina, initStamina]
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
      'SELECT id, name, class_type, level, element, hp, mp, attack, defense FROM characters WHERE user_id = ? ORDER BY id',
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
    const charId = req.query.charId || req.selectedCharId;
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
    await refreshStamina(c, pool);
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
    await conn.query('DELETE FROM character_gacha_tickets WHERE character_id = ?', [charId]).catch(() => {});
    await conn.query('DELETE FROM character_gacha_log WHERE character_id = ?', [charId]).catch(() => {});
    await conn.query('DELETE FROM monster_bestiary WHERE character_id = ?', [charId]).catch(() => {});
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

// 프롤로그 전투 몬스터 데이터
const PROLOGUE_MONSTERS = {
  '풍수사': ['초록 슬라임', '빨강 슬라임', '독버섯'],
  '무당': ['떠도는 영혼', '야광귀', '봉사귀'],
  '승려': ['멧돼지', '회색 곰', '독거미'],
  '저승사자': ['떠도는 영혼', '독 슬라임', '원혼'],
};

router.get('/prologue-battle', auth, async (req, res) => {
  try {
    const charId = req.selectedCharId;
    if (!charId) return res.status(400).json({ message: '캐릭터를 선택해주세요.' });
    const [chars] = await pool.query('SELECT class_type FROM characters WHERE id = ? AND user_id = ?', [charId, req.user.id]);
    if (chars.length === 0) return res.status(404).json({ message: '캐릭터를 찾을 수 없습니다.' });

    const classType = chars[0].class_type;
    const monsterNames = PROLOGUE_MONSTERS[classType] || PROLOGUE_MONSTERS['풍수사'];

    const [monsterRows] = await pool.query('SELECT * FROM monsters WHERE name IN (?)', [monsterNames]);

    // 몬스터 스킬
    const monsterIds = monsterRows.map(m => m.id);
    let skillMap = {};
    if (monsterIds.length > 0) {
      const [skillRows] = await pool.query(
        `SELECT msm.monster_id, ms.* FROM monster_skill_map msm
         JOIN monster_skills ms ON msm.skill_id = ms.id
         WHERE msm.monster_id IN (?)`, [monsterIds]
      );
      for (const row of skillRows) {
        if (!skillMap[row.monster_id]) skillMap[row.monster_id] = [];
        skillMap[row.monster_id].push({
          id: row.id, name: row.name, type: row.type,
          damage_multiplier: row.damage_multiplier,
          mp_cost: row.mp_cost, range: row.range_val, icon: row.icon,
        });
      }
    }

    // 프롤로그용 스탯 대폭 약화 (레벨 1 캐릭터가 쉽게 이길 수 있도록)
    const monsters = monsterRows.map(m => ({
      id: m.id, name: m.name, icon: m.icon,
      hp: 8, mp: 0,
      attack: 2, defense: 0,
      phys_attack: 2, phys_defense: 0,
      mag_attack: 2, mag_defense: 0,
      crit_rate: 0, evasion: 0,
      moveRange: m.move_range,
      expReward: m.exp_reward, goldReward: m.gold_reward,
      spawnWeight: m.spawn_weight,
      aiType: m.ai_type || 'aggressive',
      rangeType: m.range_type || 'melee',
      skills: [],
    }));

    const stage = {
      id: 0, stageNumber: 0, name: '프롤로그 전투',
      monsterCount: 3, monsterLevelMin: 1, monsterLevelMax: 2,
      rewardExp: 50, rewardGold: 500, isBoss: false,
      dungeonKey: 'forest',
    };

    res.json({ monsters, stage });
  } catch (err) {
    console.error('Prologue battle error:', err);
    res.status(500).json({ message: '서버 오류가 발생했습니다.' });
  }
});

// 프롤로그 완료 처리
router.post('/prologue-clear', auth, async (req, res) => {
  try {
    const charId = req.selectedCharId;
    if (!charId) return res.status(400).json({ message: '캐릭터를 선택해주세요.' });
    await pool.query('UPDATE characters SET prologue_cleared = 1 WHERE id = ? AND user_id = ?', [charId, req.user.id]);
    // 프롤로그 보상: 골드 500, 경험치 50
    await pool.query('UPDATE characters SET gold = gold + 500, exp = exp + 50 WHERE id = ?', [charId]);
    res.json({ message: '프롤로그를 완료했습니다!', rewards: { gold: 500, exp: 50 } });
  } catch (err) {
    console.error('Prologue clear error:', err);
    res.status(500).json({ message: '서버 오류가 발생했습니다.' });
  }
});

// 오늘의 콘텐츠 가이드
router.get('/daily-guide', auth, async (req, res) => {
  try {
    const charId = req.selectedCharId;
    if (!charId) return res.status(400).json({ message: '캐릭터를 선택해주세요.' });

    const [[pendingRow]] = await pool.query(
      `SELECT COUNT(*) as cnt FROM character_quests cq
       JOIN quests q ON q.id = cq.quest_id
       WHERE cq.character_id = ? AND (cq.status = 'completed' OR (cq.status = 'active' AND cq.progress >= q.target_count))`,
      [charId]
    );
    const pendingRewards = pendingRow.cnt;

    const [dailyRows] = await pool.query(
      `SELECT cq.status FROM character_quests cq
       JOIN quests q ON q.id = cq.quest_id
       WHERE cq.character_id = ? AND q.category = 'daily'`,
      [charId]
    );
    const dailyQuestsTotal = dailyRows.length;
    const dailyQuestsCompleted = dailyRows.filter(r => r.status === 'completed' || r.status === 'rewarded').length;

    const [[fortuneRow]] = await pool.query(
      `SELECT COUNT(*) as cnt FROM character_fortunes WHERE character_id = ? AND fortune_type = 'daily' AND DATE(created_at) = CURDATE()`,
      [charId]
    );
    const fortuneDone = fortuneRow.cnt > 0;

    const [[tarotRow]] = await pool.query(
      `SELECT COUNT(*) as cnt FROM character_tarot_readings WHERE character_id = ? AND DATE(created_at) = CURDATE()`,
      [charId]
    );
    const tarotDone = tarotRow.cnt > 0;

    const [[stageRow]] = await pool.query(
      `SELECT COUNT(*) as cnt FROM character_stage_clear WHERE character_id = ? AND DATE(cleared_at) = CURDATE()`,
      [charId]
    );
    const stageBattlesDone = stageRow.cnt;

    const [[dungeonRow]] = await pool.query(
      `SELECT COUNT(*) as cnt FROM character_stage_progress WHERE character_id = ? AND DATE(cleared_at) = CURDATE()`,
      [charId]
    );
    const dungeonBattlesDone = dungeonRow.cnt;

    const [[mainQuestRow]] = await pool.query(
      `SELECT COUNT(*) as cnt FROM quests q
       WHERE q.category = 'main'
       AND q.id NOT IN (SELECT quest_id FROM character_quests WHERE character_id = ? AND status IN ('completed','rewarded'))
       AND (q.prerequisite_quest_id IS NULL
         OR q.prerequisite_quest_id IN (SELECT quest_id FROM character_quests WHERE character_id = ? AND status = 'rewarded'))`,
      [charId, charId]
    );
    const mainQuestAvailable = mainQuestRow.cnt > 0;

    res.json({
      pendingRewards,
      dailyQuestsCompleted,
      dailyQuestsTotal,
      fortuneDone,
      tarotDone,
      stageBattlesDone,
      dungeonBattlesDone,
      mainQuestAvailable,
    });
  } catch (err) {
    console.error('Daily guide error:', err);
    res.status(500).json({ message: '서버 오류가 발생했습니다.' });
  }
});

module.exports = router;
