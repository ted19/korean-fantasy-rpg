const express = require('express');
const jwt = require('jsonwebtoken');
const { pool, getSelectedChar, refreshStamina, calcMaxStamina } = require('../db');

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

// 국가 목록
router.get('/countries', auth, async (req, res) => {
  try {
    const [countries] = await pool.query(
      'SELECT key_name, name, subtitle, icon, display_order, accent_color FROM stage_countries ORDER BY display_order'
    );
    res.json({ countries: countries.map(c => ({
      key: c.key_name,
      name: c.name,
      subtitle: c.subtitle,
      icon: c.icon,
      displayOrder: c.display_order,
      accentColor: c.accent_color,
    }))});
  } catch (err) {
    console.error('Stage countries error:', err);
    res.status(500).json({ message: '서버 오류가 발생했습니다.' });
  }
});

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

    // 국가 순서를 DB에서 가져옴
    const [countryRows] = await pool.query(
      'SELECT key_name FROM stage_countries ORDER BY display_order'
    );
    const countryOrder = countryRows.map(c => c.key_name);

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

    // 국가별 순차 해금 (같은 국가 내에서 순차, 이전 국가 마지막 클리어 시 다음 국가 해금)
    const byCountry = {};
    for (const g of groups) {
      const c = g.country || 'korea';
      if (!byCountry[c]) byCountry[c] = [];
      byCountry[c].push(g);
    }

    const result = [];
    for (let ci = 0; ci < countryOrder.length; ci++) {
      const country = countryOrder[ci];
      const countryGroups = byCountry[country] || [];

      // 이전 국가의 50% 이상 그룹 클리어시 다음 국가 해금
      let prevCountryCleared = true;
      if (ci > 0) {
        const prevCountry = countryOrder[ci - 1];
        const prevGroups = byCountry[prevCountry] || [];
        if (prevGroups.length > 0) {
          const halfGroups = Math.ceil(prevGroups.length / 2);
          let clearedGroupCount = 0;
          for (const pg of prevGroups) {
            const pgTotal = totalMap[pg.id] || 0;
            const pgProg = progressMap[pg.id] || { cleared: 0 };
            if (pgTotal > 0 && pgProg.cleared >= pgTotal) clearedGroupCount++;
          }
          prevCountryCleared = clearedGroupCount >= halfGroups;
        }
      }

      for (let i = 0; i < countryGroups.length; i++) {
        const g = countryGroups[i];
        const total = totalMap[g.id] || 0;
        const prog = progressMap[g.id] || { cleared: 0, stars: 0 };
        let unlocked = false;

        if (i === 0) {
          unlocked = prevCountryCleared;
        } else {
          const prevGroup = countryGroups[i - 1];
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
          country: g.country || 'korea',
          accentColor: g.accent_color || '#4ade80',
          requiredLevel: g.required_level,
          bgColor: g.bg_color,
          totalStages: total,
          clearedStage: prog.cleared,
          stars: prog.stars,
          unlocked,
        });
      }
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
              range_val: row.range_val,
              icon: row.icon,
              heal_amount: row.heal_amount || 0,
              buff_stat: row.buff_stat || null,
              buff_value: row.buff_value || 0,
              buff_duration: row.buff_duration || 0,
              cooldown: row.cooldown || 0,
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
          tier: m.tier || 1,
          element: m.element || 'neutral',
          skills: skillMap[m.id] || [],
        }));
      }
    }

    // 운세 버프 로드 (클라이언트 전투에서 표시용)
    let fortuneBuffs = [];
    if (chars.length > 0) {
      const [fBuffs] = await pool.query(
        'SELECT buff_type, buff_value, remaining_battles, fortune_grade, icon FROM character_fortunes WHERE character_id = ? AND remaining_battles > 0',
        [chars[0].id]
      );
      fortuneBuffs = fBuffs;
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
      fortuneBuffs,
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

// ========== 콘텐츠 입장 횟수 시스템 (5회 → 4시간 쿨타임) ==========
const CHARGE_COOLDOWN_MS = 4 * 60 * 60 * 1000; // 4시간
const MAX_CHARGES = 5;

async function getOrCreateCharges(charId, contentType, connOrPool) {
  const db = connOrPool || pool;
  const [rows] = await db.query(
    'SELECT * FROM content_charges WHERE character_id = ? AND content_type = ?',
    [charId, contentType]
  );
  if (rows.length === 0) {
    await db.query(
      'INSERT INTO content_charges (character_id, content_type, charges, max_charges, last_recharged_at) VALUES (?, ?, ?, ?, NOW())',
      [charId, contentType, MAX_CHARGES, MAX_CHARGES]
    );
    return { charges: MAX_CHARGES, max_charges: MAX_CHARGES, last_recharged_at: new Date() };
  }
  const row = rows[0];
  // 쿨타임 경과 시 자동 충전
  if (row.charges < row.max_charges) {
    const elapsed = Date.now() - new Date(row.last_recharged_at).getTime();
    if (elapsed >= CHARGE_COOLDOWN_MS) {
      await db.query(
        'UPDATE content_charges SET charges = max_charges, last_recharged_at = NOW() WHERE character_id = ? AND content_type = ?',
        [charId, contentType]
      );
      row.charges = row.max_charges;
      row.last_recharged_at = new Date();
    }
  }
  return row;
}

// 입장 횟수 조회 (개별 키별)
router.get('/charges', auth, async (req, res) => {
  try {
    const char = await getSelectedChar(req, pool);
    if (!char) return res.status(404).json({ message: '캐릭터를 찾을 수 없습니다.' });

    const [rows] = await pool.query(
      'SELECT * FROM content_charges WHERE character_id = ?',
      [char.id]
    );

    const calcCooldown = (row) => {
      if (row.charges > 0) return 0;
      const elapsed = Date.now() - new Date(row.last_recharged_at).getTime();
      return Math.max(0, CHARGE_COOLDOWN_MS - elapsed);
    };

    // 자동 충전 체크 및 결과 맵 생성
    const charges = {};
    for (const row of rows) {
      if (row.charges < row.max_charges) {
        const elapsed = Date.now() - new Date(row.last_recharged_at).getTime();
        if (elapsed >= CHARGE_COOLDOWN_MS) {
          await pool.query(
            'UPDATE content_charges SET charges = max_charges, last_recharged_at = NOW() WHERE character_id = ? AND content_type = ?',
            [char.id, row.content_type]
          );
          row.charges = row.max_charges;
          row.last_recharged_at = new Date();
        }
      }
      charges[row.content_type] = {
        charges: row.charges,
        maxCharges: row.max_charges,
        cooldown: calcCooldown(row),
      };
    }

    res.json(charges);
  } catch (err) {
    console.error('Get charges error:', err);
    res.status(500).json({ message: '서버 오류가 발생했습니다.' });
  }
});

// 입장 횟수 소모 (개별 키별: stage_gojoseon, dungeon_cave 등)
// 입장 횟수 검증 (소모하지 않음)
router.post('/check-charge', auth, async (req, res) => {
  try {
    const { contentType } = req.body;
    if (!contentType || typeof contentType !== 'string') {
      return res.status(400).json({ message: '잘못된 콘텐츠 타입입니다.' });
    }

    const char = await getSelectedChar(req, pool);
    if (!char) return res.status(404).json({ message: '캐릭터를 찾을 수 없습니다.' });

    const row = await getOrCreateCharges(char.id, contentType, pool);

    if (row.charges <= 0) {
      const elapsed = Date.now() - new Date(row.last_recharged_at).getTime();
      const remaining = Math.max(0, CHARGE_COOLDOWN_MS - elapsed);
      const hours = Math.floor(remaining / 3600000);
      const minutes = Math.floor((remaining % 3600000) / 60000);
      return res.status(400).json({
        message: `입장 횟수를 모두 소진했습니다!\n${hours}시간 ${minutes}분 후 충전됩니다.`,
        cooldown: remaining,
      });
    }

    res.json({ charges: row.charges, maxCharges: MAX_CHARGES });
  } catch (err) {
    console.error('Check charge error:', err);
    res.status(500).json({ message: '서버 오류가 발생했습니다.' });
  }
});

router.post('/use-charge', auth, async (req, res) => {
  try {
    const { contentType } = req.body; // 'stage_gojoseon', 'dungeon_cave' 등
    if (!contentType || typeof contentType !== 'string') {
      return res.status(400).json({ message: '잘못된 콘텐츠 타입입니다.' });
    }

    const char = await getSelectedChar(req, pool);
    if (!char) return res.status(404).json({ message: '캐릭터를 찾을 수 없습니다.' });

    const row = await getOrCreateCharges(char.id, contentType, pool);

    if (row.charges <= 0) {
      const elapsed = Date.now() - new Date(row.last_recharged_at).getTime();
      const remaining = Math.max(0, CHARGE_COOLDOWN_MS - elapsed);
      const hours = Math.floor(remaining / 3600000);
      const minutes = Math.floor((remaining % 3600000) / 60000);
      return res.status(400).json({
        message: `입장 횟수를 모두 소진했습니다!\n${hours}시간 ${minutes}분 후 충전됩니다.`,
        cooldown: remaining,
      });
    }

    const newCharges = row.charges - 1;
    await pool.query(
      'UPDATE content_charges SET charges = ?, last_recharged_at = NOW() WHERE character_id = ? AND content_type = ?',
      [newCharges, char.id, contentType]
    );

    const cooldown = newCharges === 0 ? CHARGE_COOLDOWN_MS : 0;
    res.json({
      charges: newCharges,
      maxCharges: MAX_CHARGES,
      cooldown,
    });
  } catch (err) {
    console.error('Use charge error:', err);
    res.status(500).json({ message: '서버 오류가 발생했습니다.' });
  }
});

// 전투 시작 시 행동력 차감 (스테이지 & 던전 공용)
// 콘텐츠별 행동력 소모량
// normal_stage=1, boss_stage=2, dungeon=2, special_dungeon=3, boss_raid=4
router.post('/spend-stamina', auth, async (req, res) => {
  try {
    const char = await getSelectedChar(req, pool);
    if (!char) return res.status(404).json({ message: '캐릭터를 찾을 수 없습니다.' });

    await refreshStamina(char, pool);

    const cost = Math.max(1, Math.min(10, parseInt(req.body.cost) || 1));

    if (char.stamina < cost) {
      return res.status(400).json({ message: `행동력이 부족합니다! (필요: ${cost}, 현재: ${char.stamina})`, stamina: char.stamina, maxStamina: char.max_stamina });
    }

    // 행동력이 만땅에서 처음 소비되면 last_stamina_time을 현재로 설정
    if (char.stamina >= char.max_stamina) {
      await pool.query(
        'UPDATE characters SET stamina = stamina - ?, last_stamina_time = NOW() WHERE id = ?',
        [cost, char.id]
      );
    } else {
      await pool.query(
        'UPDATE characters SET stamina = stamina - ?, last_stamina_time = IFNULL(last_stamina_time, NOW()) WHERE id = ?',
        [cost, char.id]
      );
    }

    const newStamina = char.stamina - cost;
    const [updatedChar] = await pool.query('SELECT last_stamina_time FROM characters WHERE id = ?', [char.id]);
    res.json({ stamina: newStamina, maxStamina: char.max_stamina, last_stamina_time: updatedChar[0]?.last_stamina_time });
  } catch (err) {
    console.error('Spend stamina error:', err);
    res.status(500).json({ message: '서버 오류가 발생했습니다.' });
  }
});

// 스테이지 전투 결과 (재료 드랍, EXP/골드)
router.post('/battle-result', auth, async (req, res) => {
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    const { monstersDefeated, expGained, goldGained, victory, activeSummonIds, activeMercenaryIds, summonExpMap, mercExpMap, playerHp, playerMp, dungeonKey } = req.body;

    const [chars] = await conn.query(
      req.selectedCharId
        ? 'SELECT * FROM characters WHERE id = ? AND user_id = ?'
        : 'SELECT * FROM characters WHERE user_id = ? ORDER BY id LIMIT 1',
      req.selectedCharId ? [req.selectedCharId, req.user.id] : [req.user.id]
    );
    if (chars.length === 0) { await conn.rollback(); return res.status(404).json({ message: '캐릭터 없음' }); }
    const char = chars[0];

    const levelBefore = char.level;
    let newLevel = char.level;
    let newExp = char.exp || 0;
    let newGold = char.gold || 0;
    let newMaxHp = char.hp;
    let newMaxMp = char.mp;
    let newAtk = char.attack;
    let newDef = char.defense;
    let newPhysAtk = char.phys_attack || 0;
    let newPhysDef = char.phys_defense || 0;
    let newMagAtk = char.mag_attack || 0;
    let newMagDef = char.mag_defense || 0;
    let newCritRate = char.crit_rate || 0;
    let newEvasion = char.evasion || 0;
    let finalHp = typeof playerHp === 'number' ? Math.max(0, playerHp) : (char.current_hp ?? char.hp);
    let finalMp = typeof playerMp === 'number' ? Math.max(0, playerMp) : (char.current_mp ?? char.mp);

    if (victory) {
      newExp += expGained || 0;
      newGold += goldGained || 0;

      // 레벨업 체크 (성장률 참조)
      const [gRows] = await conn.query('SELECT * FROM class_growth_rates WHERE class_type = ?', [char.class_type]);
      const g = gRows[0] || { hp_per_level: 10, mp_per_level: 5, attack_per_level: 2, defense_per_level: 1, phys_attack_per_level: 2, phys_defense_per_level: 1, mag_attack_per_level: 1, mag_defense_per_level: 1, crit_rate_per_10level: 1, evasion_per_10level: 1 };
      let expNeeded = Math.floor(120 * newLevel + 3 * newLevel * newLevel);
      while (newExp >= expNeeded && newLevel < 100) {
        newExp -= expNeeded;
        newLevel++;
        newMaxHp += Math.floor(g.hp_per_level);
        newMaxMp += Math.floor(g.mp_per_level);
        newAtk += Math.floor(g.attack_per_level);
        newDef += Math.floor(g.defense_per_level);
        newPhysAtk += Math.floor(g.phys_attack_per_level);
        newPhysDef += Math.floor(g.phys_defense_per_level);
        newMagAtk += Math.floor(g.mag_attack_per_level);
        newMagDef += Math.floor(g.mag_defense_per_level);
        if (newLevel % 10 === 0) {
          newCritRate += Math.floor(g.crit_rate_per_10level);
          newEvasion += Math.floor(g.evasion_per_10level);
        }
        // 레벨업 시 HP/MP 최대치로 회복
        finalHp = newMaxHp;
        finalMp = newMaxMp;
        expNeeded = Math.floor(120 * newLevel + 3 * newLevel * newLevel);
      }
      if (newLevel >= 100) { newLevel = 100; newExp = 0; }

      // 소환수 경험치 분배 (기여도 기반)
      if (activeSummonIds && activeSummonIds.length > 0) {
        for (const smId of activeSummonIds) {
          const [smRows] = await conn.query('SELECT * FROM character_summons WHERE id = ? AND character_id = ?', [smId, char.id]);
          if (smRows.length === 0) continue;
          const sm = smRows[0];
          const summonExp = (summonExpMap && summonExpMap[smId]) ? summonExpMap[smId] : Math.floor((expGained || 0) * 0.7);
          let newSmExp = (sm.exp || 0) + summonExp;
          const expNeededSm = Math.floor(60 * sm.level + 1.5 * sm.level * sm.level);
          if (newSmExp >= expNeededSm) {
            const leftover = newSmExp - expNeededSm;
            const newSmLevel = sm.level + 1;
            const [smtRows] = await conn.query('SELECT type FROM summon_templates WHERE id = (SELECT template_id FROM character_summons WHERE id = ?)', [sm.id]);
            const smType = smtRows[0]?.type || '몬스터';
            const [sg2Rows] = await conn.query('SELECT * FROM summon_growth_rates WHERE summon_type = ?', [smType]);
            const sg2 = sg2Rows[0] || { hp_per_level: 5, mp_per_level: 2, attack_per_level: 1, defense_per_level: 1, phys_attack_per_level: 1, phys_defense_per_level: 1, mag_attack_per_level: 1, mag_defense_per_level: 1, crit_rate_per_10level: 1, evasion_per_10level: 1 };
            await conn.query(
              `UPDATE character_summons SET level = ?, exp = ?,
                hp = hp + ?, mp = mp + ?, attack = attack + ?, defense = defense + ?,
                phys_attack = phys_attack + ?, phys_defense = phys_defense + ?,
                mag_attack = mag_attack + ?, mag_defense = mag_defense + ?,
                crit_rate = crit_rate + ?, evasion = evasion + ?
               WHERE id = ?`,
              [newSmLevel, leftover,
               Math.floor(sg2.hp_per_level), Math.floor(sg2.mp_per_level),
               Math.floor(sg2.attack_per_level), Math.floor(sg2.defense_per_level),
               Math.floor(sg2.phys_attack_per_level), Math.floor(sg2.phys_defense_per_level),
               Math.floor(sg2.mag_attack_per_level), Math.floor(sg2.mag_defense_per_level),
               newSmLevel % 10 === 0 ? Math.floor(sg2.crit_rate_per_10level) : 0,
               newSmLevel % 10 === 0 ? Math.floor(sg2.evasion_per_10level) : 0, sm.id]
            );
          } else {
            await conn.query('UPDATE character_summons SET exp = ? WHERE id = ?', [newSmExp, sm.id]);
          }
        }
      }

      // 용병 경험치 분배 (기여도 기반)
      if (activeMercenaryIds && activeMercenaryIds.length > 0) {
        for (const mId of activeMercenaryIds) {
          const [mRows] = await conn.query('SELECT * FROM character_mercenaries WHERE id = ? AND character_id = ?', [mId, char.id]);
          if (mRows.length === 0) continue;
          const merc = mRows[0];
          const mercExp = (mercExpMap && mercExpMap[mId]) ? mercExpMap[mId] : Math.floor((expGained || 0) * 0.5);
          let newMercExp = (merc.exp || 0) + mercExp;
          const expNeededMerc = Math.floor(60 * merc.level + 1.5 * merc.level * merc.level);
          if (newMercExp >= expNeededMerc) {
            const leftover = newMercExp - expNeededMerc;
            const newMercLevel = merc.level + 1;
            const [mtRows] = await conn.query('SELECT * FROM mercenary_templates WHERE id = ?', [merc.template_id]);
            const mt = mtRows[0] || { growth_hp: 5, growth_mp: 2, growth_phys_attack: 1, growth_phys_defense: 1, growth_mag_attack: 1, growth_mag_defense: 1 };
            await conn.query(
              `UPDATE character_mercenaries SET level = ?, exp = ?,
                hp = hp + ?, mp = mp + ?,
                phys_attack = phys_attack + ?, phys_defense = phys_defense + ?,
                mag_attack = mag_attack + ?, mag_defense = mag_defense + ?
               WHERE id = ?`,
              [newMercLevel, leftover,
               mt.growth_hp, mt.growth_mp,
               mt.growth_phys_attack, mt.growth_phys_defense,
               mt.growth_mag_attack, mt.growth_mag_defense, merc.id]
            );
            // 레벨업 시 새 스킬 자동 학습
            const [newSkills] = await conn.query(
              `SELECT id FROM mercenary_skills
               WHERE required_level <= ? AND (is_common = 1 OR class_type = ?)
               AND id NOT IN (SELECT skill_id FROM mercenary_learned_skills WHERE mercenary_id = ?)`,
              [newMercLevel, mt.class_type, merc.id]
            );
            for (const sk of newSkills) {
              await conn.query('INSERT IGNORE INTO mercenary_learned_skills (mercenary_id, skill_id) VALUES (?, ?)', [merc.id, sk.id]);
            }
          } else {
            await conn.query('UPDATE character_mercenaries SET exp = ? WHERE id = ?', [newMercExp, merc.id]);
          }
        }
      }
    } else {
      finalHp = 0;
    }

    // 용병 피로도 차감 (전투 참여 시 1 소모, 승패 무관)
    if (activeMercenaryIds && activeMercenaryIds.length > 0) {
      await conn.query(
        `UPDATE character_mercenaries SET fatigue = GREATEST(0, fatigue - 1) WHERE id IN (?) AND character_id = ?`,
        [activeMercenaryIds, char.id]
      );
    }

    // 레벨업 스킬포인트
    const lvlUps = newLevel - levelBefore;
    const newMaxStamina = newLevel > levelBefore ? calcMaxStamina(newLevel) : (char.max_stamina || 10);

    await conn.query(
      `UPDATE characters SET level = ?, exp = ?, gold = ?, hp = ?, mp = ?,
        attack = ?, defense = ?, current_hp = ?, current_mp = ?,
        phys_attack = ?, phys_defense = ?, mag_attack = ?, mag_defense = ?,
        crit_rate = ?, evasion = ?,
        skill_points = skill_points + ?, total_skill_points = total_skill_points + ?
        ${newLevel > levelBefore ? ', stamina = ?, max_stamina = ?' : ''}
      WHERE id = ?`,
      newLevel > levelBefore
        ? [newLevel, newExp, newGold, newMaxHp, newMaxMp, newAtk, newDef,
           finalHp, finalMp,
           newPhysAtk, newPhysDef, newMagAtk, newMagDef, newCritRate, newEvasion,
           lvlUps, lvlUps, newMaxStamina, newMaxStamina, char.id]
        : [newLevel, newExp, newGold, newMaxHp, newMaxMp, newAtk, newDef,
           finalHp, finalMp,
           newPhysAtk, newPhysDef, newMagAtk, newMagDef, newCritRate, newEvasion,
           lvlUps, lvlUps, char.id]
    );

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

    // 소환 조각 드랍 (스테이지 승리 시)
    let droppedShards = [];
    if (victory) {
      const isBoss = req.body.isBoss || false;
      const contentType = isBoss ? 'boss_stage' : 'normal_stage';
      const [shardConfigs] = await conn.query(
        'SELECT sdc.*, m.id as material_id, m.name, m.icon FROM shard_drop_config sdc JOIN materials m ON m.name = sdc.shard_type WHERE sdc.content_type = ?',
        [contentType]
      ).catch(() => [[]]);
      for (const cfg of shardConfigs) {
        if (Math.random() < cfg.drop_rate) {
          const qty = cfg.min_quantity + Math.floor(Math.random() * (cfg.max_quantity - cfg.min_quantity + 1));
          await conn.query(
            'INSERT INTO material_inventory (character_id, material_id, quantity) VALUES (?, ?, ?) ON DUPLICATE KEY UPDATE quantity = quantity + ?',
            [char.id, cfg.material_id, qty, qty]
          );
          droppedShards.push({ name: cfg.name, icon: cfg.icon, quantity: qty });
        }
      }
    }

    // 던전 티켓 드랍 (스테이지 승리 시)
    let droppedTickets = [];
    if (victory && req.body.groupKey) {
      const [ticketDrops] = await conn.query(
        `SELECT std.*, dt.dungeon_key, dt.name, dt.icon, dt.grade
         FROM stage_ticket_drops std
         JOIN dungeon_tickets dt ON std.ticket_id = dt.id
         WHERE std.group_key = ?`,
        [req.body.groupKey]
      );
      for (const drop of ticketDrops) {
        if (Math.random() < drop.drop_rate) {
          const qty = drop.min_quantity + Math.floor(Math.random() * (drop.max_quantity - drop.min_quantity + 1));
          await conn.query(
            `INSERT INTO character_tickets (character_id, ticket_id, quantity) VALUES (?, ?, ?)
             ON DUPLICATE KEY UPDATE quantity = quantity + ?`,
            [char.id, drop.ticket_id, qty, qty]
          );
          const existing = droppedTickets.find(d => d.name === drop.name);
          if (existing) existing.quantity += qty;
          else droppedTickets.push({ name: drop.name, icon: drop.icon, grade: drop.grade, dungeonKey: drop.dungeon_key, quantity: qty });
        }
      }
    }

    // 퀘스트 진행도 업데이트
    if (victory) {
      // clear_stage 'any' 타겟 (일일/업적)
      await conn.query(
        `UPDATE character_quests cq
         JOIN quests q ON cq.quest_id = q.id
         SET cq.progress = cq.progress + 1
         WHERE cq.character_id = ? AND cq.status = 'active'
           AND q.type = 'clear_stage' AND q.target = 'any'`,
        [char.id]
      );

      // 처치 몬스터별 hunt 퀘스트
      if (monstersDefeated && monstersDefeated.length > 0) {
        for (const mName of monstersDefeated) {
          await conn.query(
            `UPDATE character_quests cq
             JOIN quests q ON cq.quest_id = q.id
             SET cq.progress = cq.progress + 1
             WHERE cq.character_id = ? AND cq.status = 'active'
               AND q.type = 'hunt' AND q.target = ?`,
            [char.id, mName]
          );
        }
        // hunt_location 'any' (일일/업적)
        await conn.query(
          `UPDATE character_quests cq
           JOIN quests q ON cq.quest_id = q.id
           SET cq.progress = cq.progress + ?
           WHERE cq.character_id = ? AND cq.status = 'active'
             AND q.type = 'hunt_location' AND q.target = 'any'`,
          [monstersDefeated.length, char.id]
        );
        // hunt_location 특정 위치 (메인 퀘스트 등) - dungeonKey 또는 groupKey 기반
        const location = dungeonKey || req.body.groupKey;
        if (location) {
          await conn.query(
            `UPDATE character_quests cq
             JOIN quests q ON cq.quest_id = q.id
             SET cq.progress = cq.progress + ?
             WHERE cq.character_id = ? AND cq.status = 'active'
               AND q.type = 'hunt_location' AND q.target = ?`,
            [monstersDefeated.length, char.id, location]
          );
        }
      }

      // collect_material 'any' (일일/업적)
      if (droppedMaterials.length > 0) {
        const totalMatQty = droppedMaterials.reduce((s, d) => s + d.quantity, 0);
        await conn.query(
          `UPDATE character_quests cq
           JOIN quests q ON cq.quest_id = q.id
           SET cq.progress = cq.progress + ?
           WHERE cq.character_id = ? AND cq.status = 'active'
             AND q.type = 'collect_material' AND q.target = 'any'`,
          [totalMatQty, char.id]
        );
      }

      // 목표 달성 시 completed
      await conn.query(
        `UPDATE character_quests cq
         JOIN quests q ON cq.quest_id = q.id
         SET cq.status = 'completed', cq.completed_at = NOW()
         WHERE cq.character_id = ? AND cq.status = 'active'
           AND cq.progress >= q.target_count`,
        [char.id]
      );

      // 레벨업 시 level 퀘스트 체크
      if (newLevel > levelBefore) {
        await conn.query(
          `UPDATE character_quests cq
           JOIN quests q ON cq.quest_id = q.id
           SET cq.status = 'completed', cq.progress = 1, cq.completed_at = NOW()
           WHERE cq.character_id = ? AND cq.status = 'active'
             AND q.type = 'level' AND ? >= CAST(q.target AS UNSIGNED)`,
          [char.id, newLevel]
        );
      }
    }

    // 소환수 최신 정보
    let summonResults = [];
    if (victory && activeSummonIds && activeSummonIds.length > 0) {
      const [smList] = await conn.query(
        `SELECT cs.id, cs.template_id, st.name, cs.level, cs.exp, st.icon, st.type
         FROM character_summons cs
         JOIN summon_templates st ON cs.template_id = st.id
         WHERE cs.id IN (?) AND cs.character_id = ?`,
        [activeSummonIds, char.id]
      );
      summonResults = smList.map(s => ({
        id: s.id, templateId: s.template_id, name: s.name, level: s.level, exp: s.exp,
        icon: s.icon, type: s.type, expNeeded: Math.floor(60 * s.level + 1.5 * s.level * s.level),
      }));
    }

    // 용병 최신 정보
    let mercenaryResults = [];
    if (victory && activeMercenaryIds && activeMercenaryIds.length > 0) {
      const [mercList] = await conn.query(
        `SELECT cm.id, cm.template_id, cm.level, cm.exp, mt.name, mt.icon, mt.class_type
         FROM character_mercenaries cm
         JOIN mercenary_templates mt ON cm.template_id = mt.id
         WHERE cm.id IN (?) AND cm.character_id = ?`,
        [activeMercenaryIds, char.id]
      );
      mercenaryResults = mercList.map(m => ({
        id: m.id, templateId: m.template_id, name: m.name, level: m.level, exp: m.exp,
        icon: m.icon, classType: m.class_type, expNeeded: Math.floor(60 * m.level + 1.5 * m.level * m.level),
      }));
    }

    // 운세 버프 remaining_battles 차감 (소진되어도 삭제하지 않음 - 쿨타임 추적용)
    await conn.query(
      'UPDATE character_fortunes SET remaining_battles = GREATEST(0, remaining_battles - 1) WHERE character_id = ? AND remaining_battles > 0',
      [char.id]
    );

    await conn.commit();
    res.json({
      droppedMaterials,
      droppedShards,
      droppedTickets,
      leveledUp: newLevel > levelBefore,
      levelBefore,
      character: {
        level: newLevel, exp: newExp, gold: newGold,
        hp: newMaxHp, mp: newMaxMp, attack: newAtk, defense: newDef,
        phys_attack: newPhysAtk, phys_defense: newPhysDef,
        mag_attack: newMagAtk, mag_defense: newMagDef,
        crit_rate: newCritRate, evasion: newEvasion,
        current_hp: finalHp, current_mp: finalMp,
      },
      summonResults,
      mercenaryResults,
    });
  } catch (err) {
    await conn.rollback();
    console.error('Stage battle result error:', err);
    res.status(500).json({ message: '서버 오류' });
  } finally {
    conn.release();
  }
});

module.exports = router;
