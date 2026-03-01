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

// 스테이지 그룹 목록 + 진행도
router.get('/groups', auth, async (req, res) => {
  try {
    const [chars] = await pool.query(
      req.selectedCharId
        ? 'SELECT id FROM characters WHERE id = ? AND user_id = ?'
        : 'SELECT id FROM characters WHERE user_id = ? ORDER BY id LIMIT 1',
      req.selectedCharId ? [req.selectedCharId, req.user.id] : [req.user.id]
    );
    if (chars.length === 0) return res.json({ groups: [] });
    const charId = chars[0].id;

    const [groups] = await pool.query(
      'SELECT * FROM stage_groups ORDER BY display_order'
    );

    // 각 그룹의 총 스테이지 수
    const [stageCounts] = await pool.query(
      'SELECT group_id, COUNT(*) as total FROM stage_levels GROUP BY group_id'
    );
    const totalMap = {};
    for (const s of stageCounts) totalMap[s.group_id] = s.total;

    // 진행도
    const [progress] = await pool.query(
      'SELECT group_id, stage_number, stars FROM character_stage_clear WHERE character_id = ?',
      [charId]
    );
    const progressMap = {};
    for (const p of progress) progressMap[p.group_id] = { cleared: p.stage_number, stars: p.stars };

    // 순차 해금
    const result = [];
    for (let i = 0; i < groups.length; i++) {
      const g = groups[i];
      const total = totalMap[g.id] || 0;
      const prog = progressMap[g.id] || { cleared: 0, stars: 0 };
      let unlocked = false;

      if (i === 0) {
        unlocked = true;
      } else {
        const prevGroup = groups[i - 1];
        const prevTotal = totalMap[prevGroup.id] || 0;
        const prevProg = progressMap[prevGroup.id] || { cleared: 0 };
        unlocked = prevProg.cleared >= prevTotal;
      }

      result.push({
        id: g.id,
        key: g.key_name,
        name: g.name,
        description: g.description,
        icon: g.icon,
        era: g.era,
        requiredLevel: g.required_level,
        bgColor: g.bg_color,
        totalStages: total,
        clearedStage: prog.cleared,
        stars: prog.stars,
        unlocked,
      });
    }

    res.json({ groups: result });
  } catch (err) {
    console.error('Stage groups error:', err);
    res.status(500).json({ message: '서버 오류가 발생했습니다.' });
  }
});

// 그룹 상세 (스테이지 목록 + 몬스터 정보)
router.get('/group/:key', auth, async (req, res) => {
  try {
    const [groups] = await pool.query(
      'SELECT * FROM stage_groups WHERE key_name = ?', [req.params.key]
    );
    if (groups.length === 0) return res.status(404).json({ message: '스테이지 그룹을 찾을 수 없습니다.' });
    const group = groups[0];

    const [stages] = await pool.query(
      'SELECT * FROM stage_levels WHERE group_id = ? ORDER BY stage_number', [group.id]
    );

    // 진행도
    const [chars] = await pool.query(
      req.selectedCharId
        ? 'SELECT id FROM characters WHERE id = ? AND user_id = ?'
        : 'SELECT id FROM characters WHERE user_id = ? ORDER BY id LIMIT 1',
      req.selectedCharId ? [req.selectedCharId, req.user.id] : [req.user.id]
    );
    let clearedStage = 0;
    if (chars.length > 0) {
      const [prog] = await pool.query(
        'SELECT stage_number FROM character_stage_clear WHERE character_id = ? AND group_id = ?',
        [chars[0].id, group.id]
      );
      if (prog.length > 0) clearedStage = prog[0].stage_number;
    }

    // 해당 그룹에 연결된 던전의 몬스터 목록
    const dungeonKeys = [...new Set(stages.map(s => s.dungeon_key).filter(Boolean))];
    let monsters = [];
    if (dungeonKeys.length > 0) {
      const [dungeons] = await pool.query(
        'SELECT id, key_name FROM dungeons WHERE key_name IN (?)', [dungeonKeys]
      );
      if (dungeons.length > 0) {
        const dungeonIds = dungeons.map(d => d.id);
        const [monsterRows] = await pool.query(
          'SELECT * FROM monsters WHERE dungeon_id IN (?) ORDER BY hp', [dungeonIds]
        );

        // 몬스터 스킬
        const monsterIds = monsterRows.map(m => m.id);
        let skillMap = {};
        if (monsterIds.length > 0) {
          const [skillRows] = await pool.query(
            `SELECT msm.monster_id, ms.* FROM monster_skill_map msm
             JOIN monster_skills ms ON msm.skill_id = ms.id
             WHERE msm.monster_id IN (?)`,
            [monsterIds]
          );
          for (const row of skillRows) {
            if (!skillMap[row.monster_id]) skillMap[row.monster_id] = [];
            skillMap[row.monster_id].push({
              id: row.id, name: row.name, type: row.type,
              damage_multiplier: row.damage_multiplier,
              mp_cost: row.mp_cost, range: row.range_val,
              icon: row.icon,
            });
          }
        }

        monsters = monsterRows.map(m => ({
          id: m.id, name: m.name, icon: m.icon,
          hp: m.hp, mp: m.mp || 0,
          attack: m.attack, defense: m.defense,
          phys_attack: m.phys_attack || 0, phys_defense: m.phys_defense || 0,
          mag_attack: m.mag_attack || 0, mag_defense: m.mag_defense || 0,
          crit_rate: m.crit_rate || 5, evasion: m.evasion || 3,
          moveRange: m.move_range,
          expReward: m.exp_reward, goldReward: m.gold_reward,
          spawnWeight: m.spawn_weight,
          aiType: m.ai_type || 'aggressive',
          rangeType: m.range_type || 'melee',
          skills: skillMap[m.id] || [],
        }));
      }
    }

    res.json({
      group: {
        id: group.id,
        key: group.key_name,
        name: group.name,
        description: group.description,
        icon: group.icon,
        era: group.era,
        requiredLevel: group.required_level,
        bgColor: group.bg_color,
      },
      stages: stages.map(s => {
        const parse = (v) => { try { return typeof v === 'string' ? JSON.parse(v) : v; } catch { return null; } };
        return {
          id: s.id,
          stageNumber: s.stage_number,
          name: s.name,
          description: s.description,
          isBoss: !!s.is_boss,
          monsterCount: s.monster_count,
          monsterLevelMin: s.monster_level_min,
          monsterLevelMax: s.monster_level_max,
          rewardExp: s.reward_exp,
          rewardGold: s.reward_gold,
          dungeonKey: s.dungeon_key,
          mapWidth: s.map_width,
          mapHeight: s.map_height,
          baseTileType: s.base_tile_type,
          tileOverrides: parse(s.tile_overrides) || [],
          playerSpawns: parse(s.player_spawns) || [],
          monsterSpawns: parse(s.monster_spawns) || [],
        };
      }),
      monsters,
      clearedStage,
    });
  } catch (err) {
    console.error('Stage group detail error:', err);
    res.status(500).json({ message: '서버 오류가 발생했습니다.' });
  }
});

// 스테이지 클리어
router.post('/clear', auth, async (req, res) => {
  try {
    const { groupKey, stageNumber } = req.body;
    const [chars] = await pool.query(
      req.selectedCharId
        ? 'SELECT id FROM characters WHERE id = ? AND user_id = ?'
        : 'SELECT id FROM characters WHERE user_id = ? ORDER BY id LIMIT 1',
      req.selectedCharId ? [req.selectedCharId, req.user.id] : [req.user.id]
    );
    if (chars.length === 0) return res.status(400).json({ message: '캐릭터가 없습니다.' });
    const charId = chars[0].id;

    const [groups] = await pool.query('SELECT id FROM stage_groups WHERE key_name = ?', [groupKey]);
    if (groups.length === 0) return res.status(404).json({ message: '스테이지 그룹을 찾을 수 없습니다.' });
    const groupId = groups[0].id;

    const [prog] = await pool.query(
      'SELECT stage_number FROM character_stage_clear WHERE character_id = ? AND group_id = ?',
      [charId, groupId]
    );
    const currentCleared = prog.length > 0 ? prog[0].stage_number : 0;

    if (stageNumber > currentCleared + 1) {
      return res.status(400).json({ message: '이전 스테이지를 먼저 클리어하세요.' });
    }

    if (stageNumber > currentCleared) {
      if (prog.length > 0) {
        await pool.query(
          'UPDATE character_stage_clear SET stage_number = ?, cleared_at = NOW() WHERE character_id = ? AND group_id = ?',
          [stageNumber, charId, groupId]
        );
      } else {
        await pool.query(
          'INSERT INTO character_stage_clear (character_id, group_id, stage_number, stars, cleared_at) VALUES (?, ?, ?, 1, NOW())',
          [charId, groupId, stageNumber]
        );
      }
    }

    res.json({ clearedStage: Math.max(currentCleared, stageNumber) });
  } catch (err) {
    console.error('Stage clear error:', err);
    res.status(500).json({ message: '서버 오류가 발생했습니다.' });
  }
});

// 스테이지 전투 결과 (재료 드랍, EXP/골드)
router.post('/battle-result', auth, async (req, res) => {
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    const { monstersDefeated, expGained, goldGained, victory } = req.body;

    const [chars] = await conn.query(
      req.selectedCharId
        ? 'SELECT * FROM characters WHERE id = ? AND user_id = ?'
        : 'SELECT * FROM characters WHERE user_id = ? ORDER BY id LIMIT 1',
      req.selectedCharId ? [req.selectedCharId, req.user.id] : [req.user.id]
    );
    if (chars.length === 0) { await conn.rollback(); return res.status(404).json({ message: '캐릭터 없음' }); }
    const char = chars[0];

    // 경험치, 골드 지급
    if (victory) {
      await conn.query('UPDATE characters SET exp = exp + ?, gold = gold + ? WHERE id = ?',
        [expGained || 0, goldGained || 0, char.id]);

      // 레벨업 체크
      let curExp = (char.exp || 0) + (expGained || 0);
      let curLevel = char.level;
      let expNeeded = curLevel * 100;
      while (curExp >= expNeeded) {
        curExp -= expNeeded;
        curLevel++;
        expNeeded = curLevel * 100;
      }
      if (curLevel > char.level) {
        const [gRows] = await conn.query('SELECT * FROM class_growth_rates WHERE class_type = ?', [char.class_type]);
        const g = gRows[0] || {};
        const lvlDiff = curLevel - char.level;
        await conn.query(
          `UPDATE characters SET level = ?, exp = ?,
            hp = hp + ?, mp = mp + ?, attack = attack + ?, defense = defense + ?,
            current_hp = hp + ?, current_mp = mp + ?
          WHERE id = ?`,
          [curLevel, curExp,
           Math.floor((g.hp_per_level || 10) * lvlDiff), Math.floor((g.mp_per_level || 5) * lvlDiff),
           Math.floor((g.attack_per_level || 2) * lvlDiff), Math.floor((g.defense_per_level || 1) * lvlDiff),
           Math.floor((g.hp_per_level || 10) * lvlDiff), Math.floor((g.mp_per_level || 5) * lvlDiff),
           char.id]
        );
      }
    }

    // 재료 드랍
    let droppedMaterials = [];
    if (victory && monstersDefeated && monstersDefeated.length > 0) {
      const [monsterRows] = await conn.query(
        'SELECT id, name FROM monsters WHERE name IN (?)',
        [monstersDefeated]
      );
      for (const mon of monsterRows) {
        const [drops] = await conn.query(
          'SELECT md.*, m.name, m.icon FROM monster_drops md JOIN materials m ON md.material_id = m.id WHERE md.monster_id = ?',
          [mon.id]
        );
        for (const drop of drops) {
          if (Math.random() < drop.drop_rate) {
            const qty = drop.min_quantity + Math.floor(Math.random() * (drop.max_quantity - drop.min_quantity + 1));
            await conn.query(
              `INSERT INTO material_inventory (character_id, material_id, quantity) VALUES (?, ?, ?)
               ON DUPLICATE KEY UPDATE quantity = quantity + ?`,
              [char.id, drop.material_id, qty, qty]
            );
            const existing = droppedMaterials.find(d => d.name === drop.name);
            if (existing) existing.quantity += qty;
            else droppedMaterials.push({ name: drop.name, icon: drop.icon, quantity: qty });
          }
        }
      }
    }

    await conn.commit();
    res.json({ success: true, droppedMaterials });
  } catch (err) {
    await conn.rollback();
    console.error('Stage battle result error:', err);
    res.status(500).json({ message: '서버 오류' });
  } finally {
    conn.release();
  }
});

module.exports = router;
