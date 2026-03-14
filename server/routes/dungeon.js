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

// 전체 던전 목록 + 진행도 + 순차 해금
router.get('/list', auth, async (req, res) => {
  try {
    const char = await getSelectedChar(req, pool);
    if (!char) return res.json({ dungeons: [] });
    const charId = char.id;

    const [dungeons] = await pool.query(
      'SELECT id, key_name, name, description, icon, required_level, display_order FROM dungeons ORDER BY display_order, id'
    );

    // 각 던전의 총 스테이지 수
    const [stageCounts] = await pool.query(
      'SELECT dungeon_id, COUNT(*) as total FROM dungeon_stages GROUP BY dungeon_id'
    );
    const totalStageMap = {};
    for (const s of stageCounts) totalStageMap[s.dungeon_id] = s.total;

    const [progress] = await pool.query(
      'SELECT dungeon_id, stage_number FROM character_stage_progress WHERE character_id = ?',
      [charId]
    );
    const progressMap = {};
    for (const p of progress) progressMap[p.dungeon_id] = p.stage_number;

    // 티켓 보유량 조회
    const [ticketRows] = await pool.query(
      `SELECT dt.dungeon_key, IFNULL(ct.quantity, 0) as quantity, dt.name as ticket_name, dt.icon as ticket_icon, dt.grade as ticket_grade
       FROM dungeon_tickets dt
       LEFT JOIN character_tickets ct ON ct.ticket_id = dt.id AND ct.character_id = ?`,
      [charId]
    );
    const ticketMap = {};
    for (const t of ticketRows) ticketMap[t.dungeon_key] = t;

    // 순차 해금: 첫 던전은 항상 열림, 이후는 이전 던전 올클리어 필요
    const result = [];
    for (let i = 0; i < dungeons.length; i++) {
      const d = dungeons[i];
      const clearedStage = progressMap[d.id] || 0;
      const totalStages = totalStageMap[d.id] || 10;
      let unlocked = false;

      if (i === 0) {
        unlocked = true; // 첫 던전은 항상 열림
      } else {
        const prevDungeon = dungeons[i - 1];
        const prevCleared = progressMap[prevDungeon.id] || 0;
        const prevTotal = totalStageMap[prevDungeon.id] || 10;
        unlocked = prevCleared >= prevTotal; // 이전 던전 올클리어 시 해금
      }

      const ticket = ticketMap[d.key_name] || {};
      result.push({
        ...d,
        clearedStage,
        totalStages,
        unlocked,
        ticketCount: ticket.quantity || 0,
        ticketName: ticket.ticket_name || '',
        ticketIcon: ticket.ticket_icon || '🎫',
        ticketGrade: ticket.ticket_grade || '일반',
      });
    }

    res.json({ dungeons: result });
  } catch (err) {
    console.error('Dungeon list error:', err);
    res.status(500).json({ message: '서버 오류가 발생했습니다.' });
  }
});

// 특정 던전 상세 (맵 데이터 + 몬스터 목록 + 스테이지 목록)
router.get('/:key', auth, async (req, res) => {
  try {
    const [dungeons] = await pool.query(
      'SELECT * FROM dungeons WHERE key_name = ?', [req.params.key]
    );
    if (dungeons.length === 0) {
      return res.status(404).json({ message: '던전을 찾을 수 없습니다.' });
    }
    const dungeon = dungeons[0];

    const [monsters] = await pool.query(
      'SELECT * FROM monsters WHERE dungeon_id = ? ORDER BY hp', [dungeon.id]
    );

    // 몬스터 스킬 로드
    const monsterIds = monsters.map(m => m.id);
    let monsterSkillMap = {};
    if (monsterIds.length > 0) {
      const [skillRows] = await pool.query(
        `SELECT msm.monster_id, ms.* FROM monster_skill_map msm
         JOIN monster_skills ms ON msm.skill_id = ms.id
         WHERE msm.monster_id IN (?)`,
        [monsterIds]
      );
      for (const row of skillRows) {
        if (!monsterSkillMap[row.monster_id]) monsterSkillMap[row.monster_id] = [];
        monsterSkillMap[row.monster_id].push({
          id: row.id,
          name: row.name,
          type: row.type,
          damage_multiplier: row.damage_multiplier,
          heal_amount: row.heal_amount,
          buff_stat: row.buff_stat,
          buff_value: row.buff_value,
          buff_duration: row.buff_duration || 0,
          mp_cost: row.mp_cost,
          cooldown: row.cooldown,
          range: row.range_val,
          range_val: row.range_val,
          pattern: row.pattern,
          description: row.description,
          icon: row.icon,
        });
      }
    }

    const [stages] = await pool.query(
      'SELECT * FROM dungeon_stages WHERE dungeon_id = ? ORDER BY stage_number', [dungeon.id]
    );

    // 진행도 (선택된 캐릭터 기준)
    const char = await getSelectedChar(req, pool);
    let clearedStage = 0;
    if (char) {
      const [prog] = await pool.query(
        'SELECT stage_number FROM character_stage_progress WHERE character_id = ? AND dungeon_id = ?',
        [char.id, dungeon.id]
      );
      if (prog.length > 0) clearedStage = prog[0].stage_number;
    }

    const safeParse = (v) => { try { return typeof v === 'string' ? JSON.parse(v) : v; } catch { return null; } };
    const tileOverrides = safeParse(dungeon.tile_overrides);
    const playerSpawns = safeParse(dungeon.player_spawns);
    const monsterSpawns = safeParse(dungeon.monster_spawns);

    // 운세 버프 로드 (클라이언트 전투 표시용)
    let fortuneBuffs = [];
    if (char) {
      const [fBuffs] = await pool.query(
        'SELECT buff_type, buff_value, remaining_battles, fortune_grade, icon FROM character_fortunes WHERE character_id = ? AND remaining_battles > 0',
        [char.id]
      );
      fortuneBuffs = fBuffs;
    }

    res.json({
      fortuneBuffs,
      dungeon: {
        id: dungeon.id,
        key: dungeon.key_name,
        name: dungeon.name,
        description: dungeon.description,
        icon: dungeon.icon,
        requiredLevel: dungeon.required_level,
        mapWidth: dungeon.map_width,
        mapHeight: dungeon.map_height,
        baseTileType: dungeon.base_tile_type,
        tileOverrides: tileOverrides || [],
        playerSpawns: playerSpawns || [],
        monsterSpawns: monsterSpawns || [],
      },
      monsters: monsters.map(m => ({
        id: m.id,
        name: m.name,
        icon: m.icon,
        hp: m.hp,
        mp: m.mp || 0,
        attack: m.attack,
        defense: m.defense,
        phys_attack: m.phys_attack || 0,
        phys_defense: m.phys_defense || 0,
        mag_attack: m.mag_attack || 0,
        mag_defense: m.mag_defense || 0,
        crit_rate: m.crit_rate || 5,
        evasion: m.evasion || 3,
        moveRange: m.move_range,
        expReward: m.exp_reward,
        goldReward: m.gold_reward,
        spawnWeight: m.spawn_weight,
        aiType: m.ai_type || 'aggressive',
        skills: monsterSkillMap[m.id] || [],
      })),
      stages: stages.map(s => {
        const sTileOverrides = typeof s.tile_overrides === 'string' ? JSON.parse(s.tile_overrides) : s.tile_overrides;
        const sPlayerSpawns = typeof s.player_spawns === 'string' ? JSON.parse(s.player_spawns) : s.player_spawns;
        const sMonsterSpawns = typeof s.monster_spawns === 'string' ? JSON.parse(s.monster_spawns) : s.monster_spawns;
        return {
          id: s.id,
          stageNumber: s.stage_number,
          name: s.name,
          isBoss: !!s.is_boss,
          monsterCount: s.monster_count,
          monsterLevelBonus: s.monster_level_bonus,
          description: s.description || '',
          rewardExpBonus: s.reward_exp_bonus,
          rewardGoldBonus: s.reward_gold_bonus,
          mapWidth: s.map_width || dungeon.map_width,
          mapHeight: s.map_height || dungeon.map_height,
          baseTileType: s.base_tile_type || dungeon.base_tile_type,
          tileOverrides: sTileOverrides || tileOverrides || [],
          playerSpawns: sPlayerSpawns || playerSpawns || [],
          monsterSpawns: sMonsterSpawns || monsterSpawns || [],
        };
      }),
      clearedStage,
    });
  } catch (err) {
    console.error('Dungeon detail error:', err);
    res.status(500).json({ message: '서버 오류가 발생했습니다.' });
  }
});

// 내 티켓 목록
router.get('/tickets', auth, async (req, res) => {
  try {
    const char = await getSelectedChar(req, pool);
    if (!char) return res.json({ tickets: [] });

    const [tickets] = await pool.query(
      `SELECT dt.*, IFNULL(ct.quantity, 0) as quantity
       FROM dungeon_tickets dt
       LEFT JOIN character_tickets ct ON ct.ticket_id = dt.id AND ct.character_id = ?
       ORDER BY dt.id`,
      [char.id]
    );
    res.json({ tickets });
  } catch (err) {
    console.error('Ticket list error:', err);
    res.status(500).json({ message: '서버 오류가 발생했습니다.' });
  }
});

// 던전 입장 시 티켓 소모
// 티켓 보유 여부 검증 (소모하지 않음)
router.post('/check-ticket', auth, async (req, res) => {
  try {
    const { dungeonKey } = req.body;
    const char = await getSelectedChar(req, pool);
    if (!char) return res.status(404).json({ message: '캐릭터를 찾을 수 없습니다.' });

    const [tickets] = await pool.query(
      `SELECT dt.id as ticket_id, dt.name, IFNULL(ct.quantity, 0) as quantity
       FROM dungeon_tickets dt
       LEFT JOIN character_tickets ct ON ct.ticket_id = dt.id AND ct.character_id = ?
       WHERE dt.dungeon_key = ?`,
      [char.id, dungeonKey]
    );
    if (tickets.length === 0) return res.status(404).json({ message: '해당 던전 티켓 정보가 없습니다.' });

    const ticket = tickets[0];
    if (ticket.quantity <= 0) {
      return res.status(400).json({ message: `${ticket.name}이(가) 부족합니다! 스테이지에서 획득할 수 있습니다.` });
    }

    res.json({ success: true, remaining: ticket.quantity });
  } catch (err) {
    console.error('Check ticket error:', err);
    res.status(500).json({ message: '서버 오류가 발생했습니다.' });
  }
});

router.post('/use-ticket', auth, async (req, res) => {
  try {
    const { dungeonKey } = req.body;
    const char = await getSelectedChar(req, pool);
    if (!char) return res.status(404).json({ message: '캐릭터를 찾을 수 없습니다.' });

    const [tickets] = await pool.query(
      `SELECT dt.id as ticket_id, dt.name, IFNULL(ct.quantity, 0) as quantity
       FROM dungeon_tickets dt
       LEFT JOIN character_tickets ct ON ct.ticket_id = dt.id AND ct.character_id = ?
       WHERE dt.dungeon_key = ?`,
      [char.id, dungeonKey]
    );
    if (tickets.length === 0) return res.status(404).json({ message: '해당 던전 티켓 정보가 없습니다.' });

    const ticket = tickets[0];
    if (ticket.quantity <= 0) {
      return res.status(400).json({ message: `${ticket.name}이(가) 부족합니다! 스테이지에서 획득할 수 있습니다.` });
    }

    await pool.query(
      `UPDATE character_tickets SET quantity = quantity - 1 WHERE character_id = ? AND ticket_id = ?`,
      [char.id, ticket.ticket_id]
    );

    res.json({ success: true, remaining: ticket.quantity - 1 });
  } catch (err) {
    console.error('Use ticket error:', err);
    res.status(500).json({ message: '서버 오류가 발생했습니다.' });
  }
});

// 스테이지 클리어
router.post('/clear-stage', auth, async (req, res) => {
  try {
    const { dungeonKey, stageNumber } = req.body;
    const char = await getSelectedChar(req, pool);
    if (!char) return res.status(400).json({ message: '캐릭터가 없습니다.' });
    const charId = char.id;

    const [dungeons] = await pool.query('SELECT id FROM dungeons WHERE key_name = ?', [dungeonKey]);
    if (dungeons.length === 0) return res.status(404).json({ message: '던전을 찾을 수 없습니다.' });
    const dungeonId = dungeons[0].id;

    // 이전 스테이지 클리어 확인
    const [prog] = await pool.query(
      'SELECT stage_number FROM character_stage_progress WHERE character_id = ? AND dungeon_id = ?',
      [charId, dungeonId]
    );
    const currentCleared = prog.length > 0 ? prog[0].stage_number : 0;

    if (stageNumber > currentCleared + 1) {
      return res.status(400).json({ message: '이전 스테이지를 먼저 클리어하세요.' });
    }

    if (stageNumber > currentCleared) {
      if (prog.length > 0) {
        await pool.query(
          'UPDATE character_stage_progress SET stage_number = ?, cleared_at = NOW() WHERE character_id = ? AND dungeon_id = ?',
          [stageNumber, charId, dungeonId]
        );
      } else {
        await pool.query(
          'INSERT INTO character_stage_progress (character_id, dungeon_id, stage_number, cleared, cleared_at) VALUES (?, ?, ?, 1, NOW())',
          [charId, dungeonId, stageNumber]
        );
      }
    }

    res.json({ clearedStage: Math.max(currentCleared, stageNumber) });
  } catch (err) {
    console.error('Clear stage error:', err);
    res.status(500).json({ message: '서버 오류가 발생했습니다.' });
  }
});

module.exports = router;
