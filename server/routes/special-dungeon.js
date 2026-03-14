const express = require('express');
const jwt = require('jsonwebtoken');
const { pool, getSelectedChar, refreshStamina } = require('../db');

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

// 헬퍼: 오늘의 속성 (dayOfYear % 4)
function getTodayElement() {
  const now = new Date();
  const start = new Date(now.getFullYear(), 0, 0);
  const diff = now - start;
  const dayOfYear = Math.floor(diff / (1000 * 60 * 60 * 24));
  return ['fire', 'water', 'earth', 'wind'][dayOfYear % 4];
}

// 헬퍼: 이번 주 월요일 날짜 (리셋 기준)
function getWeeklyResetDate() {
  const now = new Date();
  const day = now.getDay(); // 0=일, 1=월 ...
  const diff = day === 0 ? 6 : day - 1; // 월요일까지 며칠 전인지
  const monday = new Date(now);
  monday.setDate(now.getDate() - diff);
  monday.setHours(0, 0, 0, 0);
  return monday.toISOString().split('T')[0];
}

// 헬퍼: DB DATE를 문자열로 변환 (로컬 시간 기준)
function dateToStr(d) {
  if (!d) return '';
  if (d instanceof Date) {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  }
  return String(d);
}

// 헬퍼: 오늘 날짜 문자열
function getTodayStr() {
  return new Date().toISOString().split('T')[0];
}

// 헬퍼: 속성별 몬스터 필터 키워드
const ELEMENT_MONSTER_KEYWORDS = {
  fire: ['fire', '불', '화', 'fireDokkaebi', 'fireDragon', 'fireElemental', 'fireSpiritSummon', 'hellHound', 'phoenix'],
  water: ['water', '물', '수', 'waterElemental', 'waterGhost', 'waterSpiritSummon', 'jellyfish', 'shark', 'mermaidWarrior', 'seaDragon', 'kraken'],
  earth: ['earth', '땅', '지', 'earthElemental', 'golem', 'golemFragment', 'manaGolem', 'treant', 'stoneDokkaebi'],
  wind: ['wind', '바람', '풍', 'windElemental', 'windSpiritSummon', 'griffin', 'wyvern', 'bat', 'poisonMoth'],
};

// 속성에 맞는 던전 키 매핑
const ELEMENT_DUNGEON_KEY = {
  fire: 'demon',
  water: 'ocean',
  earth: 'cave',
  wind: 'mountain',
};

// ============ 목록 API ============

// GET /list - 3종류 스페셜 던전 + 진행도
router.get('/list', auth, async (req, res) => {
  try {
    const char = await getSelectedChar(req, pool);
    if (!char) return res.status(404).json({ message: '캐릭터가 없습니다.' });

    const [types] = await pool.query('SELECT * FROM special_dungeon_types ORDER BY display_order');
    const [progress] = await pool.query(
      'SELECT * FROM special_dungeon_progress WHERE character_id = ?',
      [char.id]
    );
    const progressMap = {};
    for (const p of progress) progressMap[p.dungeon_type] = p;

    const today = getTodayStr();
    const weeklyReset = getWeeklyResetDate();
    const todayElement = getTodayElement();

    // 보스 토벌전 클리어 수
    const [bossClears] = await pool.query(
      'SELECT COUNT(*) as cnt FROM boss_raid_daily WHERE character_id = ? AND attempt_date = ? AND cleared = 1',
      [char.id, today]
    );

    const result = types.map(t => {
      const prog = progressMap[t.key_name] || {};
      let progressInfo = {};

      if (t.key_name === 'tower') {
        // 주간 리셋 체크
        let currentFloor = prog.progress_value || 0;
        if (dateToStr(prog.reset_date) && dateToStr(prog.reset_date) < weeklyReset) {
          currentFloor = 0; // 리셋됨
        }
        progressInfo = {
          currentFloor,
          bestRecord: prog.best_record || 0,
          totalClears: prog.total_clears || 0,
        };
      } else if (t.key_name === 'elemental') {
        // 일일 리셋 체크
        let clearedTier = prog.progress_value || 0;
        if (dateToStr(prog.reset_date) && dateToStr(prog.reset_date) < today) {
          clearedTier = 0;
        }
        progressInfo = {
          todayElement,
          clearedTier,
          bestRecord: prog.best_record || 0,
        };
      } else if (t.key_name === 'boss_raid') {
        progressInfo = {
          todayClears: bossClears[0].cnt,
          totalClears: prog.total_clears || 0,
        };
      }

      return {
        key: t.key_name,
        name: t.name,
        description: t.description,
        battleType: t.battle_type,
        resetType: t.reset_type,
        requiredLevel: t.required_level,
        staminaCost: t.stamina_cost,
        icon: t.icon,
        accentColor: t.accent_color,
        ...progressInfo,
      };
    });

    res.json({ dungeons: result, charLevel: char.level });
  } catch (err) {
    console.error('Special dungeon list error:', err);
    res.status(500).json({ message: '서버 오류가 발생했습니다.' });
  }
});

// ============ 무한의 탑 API ============

// GET /tower/info - 타워 상세 정보
router.get('/tower/info', auth, async (req, res) => {
  try {
    const char = await getSelectedChar(req, pool);
    if (!char) return res.status(404).json({ message: '캐릭터가 없습니다.' });

    const weeklyReset = getWeeklyResetDate();

    const [prog] = await pool.query(
      "SELECT * FROM special_dungeon_progress WHERE character_id = ? AND dungeon_type = 'tower'",
      [char.id]
    );
    let currentFloor = 0;
    let bestRecord = 0;
    let totalClears = 0;

    if (prog.length > 0) {
      const p = prog[0];
      bestRecord = p.best_record || 0;
      totalClears = p.total_clears || 0;
      const resetStr = dateToStr(p.reset_date);
      if (resetStr && resetStr >= weeklyReset) {
        currentFloor = p.progress_value || 0;
      }
      // 리셋 필요시 DB 업데이트
      if (!resetStr || resetStr < weeklyReset) {
        await pool.query(
          "UPDATE special_dungeon_progress SET progress_value = 0, reset_date = ? WHERE character_id = ? AND dungeon_type = 'tower'",
          [weeklyReset, char.id]
        );
      }
    }

    const nextFloor = currentFloor + 1;
    const [floors] = await pool.query(
      'SELECT * FROM tower_floors WHERE floor_num = ?',
      [nextFloor]
    );

    res.json({
      currentFloor,
      bestRecord,
      totalClears,
      maxFloor: 50,
      weeklyReset,
      nextFloor: floors.length > 0 ? {
        floor: floors[0].floor_num,
        monsterCount: floors[0].monster_count,
        levelBonus: floors[0].level_bonus,
        isBoss: !!floors[0].is_boss,
        expReward: floors[0].exp_reward,
        goldReward: floors[0].gold_reward,
        dungeonKey: floors[0].dungeon_key,
        hpMult: floors[0].hp_multiplier,
        atkMult: floors[0].atk_multiplier,
      } : null,
    });
  } catch (err) {
    console.error('Tower info error:', err);
    res.status(500).json({ message: '서버 오류가 발생했습니다.' });
  }
});

// GET /tower/floor/:num - 층 데이터 (SrpgBattle 호환)
router.get('/tower/floor/:num', auth, async (req, res) => {
  try {
    const floorNum = parseInt(req.params.num);
    const [floors] = await pool.query('SELECT * FROM tower_floors WHERE floor_num = ?', [floorNum]);
    if (floors.length === 0) return res.status(404).json({ message: '해당 층이 없습니다.' });

    const floor = floors[0];
    res.json({
      floor: {
        floorNum: floor.floor_num,
        monsterCount: floor.monster_count,
        levelBonus: floor.level_bonus,
        isBoss: !!floor.is_boss,
        expReward: floor.exp_reward,
        goldReward: floor.gold_reward,
        dungeonKey: floor.dungeon_key,
        hpMult: floor.hp_multiplier,
        atkMult: floor.atk_multiplier,
      },
      // SrpgBattle에 전달할 stage 객체
      stage: {
        stageNumber: floor.floor_num,
        name: `${floor.floor_num}층${floor.is_boss ? ' (보스)' : ''}`,
        isBoss: !!floor.is_boss,
        monsterCount: floor.monster_count,
        monsterLevelBonus: floor.level_bonus,
        rewardExpBonus: floor.exp_reward,
        rewardGoldBonus: floor.gold_reward,
      },
    });
  } catch (err) {
    console.error('Tower floor error:', err);
    res.status(500).json({ message: '서버 오류가 발생했습니다.' });
  }
});

// POST /tower/clear - 층 클리어 기록
router.post('/tower/clear', auth, async (req, res) => {
  try {
    const { floor, victory } = req.body;
    const char = await getSelectedChar(req, pool);
    if (!char) return res.status(404).json({ message: '캐릭터가 없습니다.' });

    if (!victory) return res.json({ success: false });

    const weeklyReset = getWeeklyResetDate();

    const [prog] = await pool.query(
      "SELECT * FROM special_dungeon_progress WHERE character_id = ? AND dungeon_type = 'tower'",
      [char.id]
    );

    if (prog.length > 0) {
      const resetStr = dateToStr(prog[0].reset_date);
      const currentFloor = (resetStr && resetStr >= weeklyReset)
        ? prog[0].progress_value : 0;
      const newFloor = Math.max(currentFloor, floor);
      const newBest = Math.max(prog[0].best_record || 0, floor);
      await pool.query(
        `UPDATE special_dungeon_progress
         SET progress_value = ?, best_record = ?, total_clears = total_clears + 1, reset_date = ?
         WHERE character_id = ? AND dungeon_type = 'tower'`,
        [newFloor, newBest, weeklyReset, char.id]
      );
    } else {
      await pool.query(
        `INSERT INTO special_dungeon_progress (character_id, dungeon_type, progress_value, best_record, total_clears, reset_date)
         VALUES (?, 'tower', ?, ?, 1, ?)`,
        [char.id, floor, floor, weeklyReset]
      );
    }

    res.json({ success: true, clearedFloor: floor });
  } catch (err) {
    console.error('Tower clear error:', err);
    res.status(500).json({ message: '서버 오류가 발생했습니다.' });
  }
});

// ============ 정령의 시련 API ============

// GET /elemental/info - 오늘 속성 + 5단계 정보
router.get('/elemental/info', auth, async (req, res) => {
  try {
    const char = await getSelectedChar(req, pool);
    if (!char) return res.status(404).json({ message: '캐릭터가 없습니다.' });

    const todayElement = getTodayElement();
    const today = getTodayStr();

    const [trials] = await pool.query('SELECT * FROM elemental_trials ORDER BY tier');

    const [prog] = await pool.query(
      "SELECT * FROM special_dungeon_progress WHERE character_id = ? AND dungeon_type = 'elemental'",
      [char.id]
    );

    let clearedTier = 0;
    let bestRecord = 0;

    if (prog.length > 0) {
      bestRecord = prog[0].best_record || 0;
      if (dateToStr(prog[0].reset_date) >= today) {
        clearedTier = prog[0].progress_value || 0;
      } else {
        // 일일 리셋
        await pool.query(
          "UPDATE special_dungeon_progress SET progress_value = 0, reset_date = ? WHERE character_id = ? AND dungeon_type = 'elemental'",
          [today, char.id]
        );
      }
    }

    res.json({
      todayElement,
      clearedTier,
      bestRecord,
      trials: trials.map(t => ({
        tier: t.tier,
        name: t.name,
        requiredLevel: t.required_level,
        monsterCount: t.monster_count,
        hpMult: t.hp_multiplier,
        atkMult: t.atk_multiplier,
        expReward: t.exp_reward,
        goldReward: t.gold_reward,
        materialGrade: t.material_grade,
        materialCount: t.material_count,
      })),
    });
  } catch (err) {
    console.error('Elemental info error:', err);
    res.status(500).json({ message: '서버 오류가 발생했습니다.' });
  }
});

// GET /elemental/tier/:num - 단계 데이터 (StageBattle 호환)
router.get('/elemental/tier/:num', auth, async (req, res) => {
  try {
    const tierNum = parseInt(req.params.num);
    const [trials] = await pool.query('SELECT * FROM elemental_trials WHERE tier = ?', [tierNum]);
    if (trials.length === 0) return res.status(404).json({ message: '해당 단계가 없습니다.' });

    const trial = trials[0];
    const todayElement = getTodayElement();
    const dungeonKey = ELEMENT_DUNGEON_KEY[todayElement] || 'cave';

    // 속성에 맞는 던전의 몬스터 가져오기
    const [dungeons] = await pool.query('SELECT id FROM dungeons WHERE key_name = ?', [dungeonKey]);
    let monsters = [];
    if (dungeons.length > 0) {
      const [monsterRows] = await pool.query(
        'SELECT * FROM monsters WHERE dungeon_id = ? ORDER BY RAND() LIMIT 10',
        [dungeons[0].id]
      );

      // 몬스터 스킬 로드
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
            mp_cost: row.mp_cost, range: row.range_val, range_val: row.range_val, icon: row.icon,
            heal_amount: row.heal_amount || 0,
            buff_stat: row.buff_stat || null, buff_value: row.buff_value || 0,
            buff_duration: row.buff_duration || 0, cooldown: row.cooldown || 0,
          });
        }
      }

      monsters = monsterRows.map(m => ({
        id: m.id, name: m.name, icon: m.icon,
        hp: Math.floor(m.hp * trial.hp_multiplier),
        mp: m.mp || 0,
        attack: Math.floor(m.attack * trial.atk_multiplier),
        defense: m.defense,
        phys_attack: Math.floor((m.phys_attack || 0) * trial.atk_multiplier),
        phys_defense: m.phys_defense || 0,
        mag_attack: Math.floor((m.mag_attack || 0) * trial.atk_multiplier),
        mag_defense: m.mag_defense || 0,
        crit_rate: m.crit_rate || 5,
        evasion: m.evasion || 3,
        moveRange: m.move_range,
        expReward: m.exp_reward,
        goldReward: m.gold_reward,
        spawnWeight: m.spawn_weight,
        aiType: m.ai_type || 'aggressive',
        rangeType: m.range_type || 'melee',
        skills: skillMap[m.id] || [],
      }));
    }

    res.json({
      trial: {
        tier: trial.tier,
        name: trial.name,
        monsterCount: trial.monster_count,
        expReward: trial.exp_reward,
        goldReward: trial.gold_reward,
        materialGrade: trial.material_grade,
        materialCount: trial.material_count,
      },
      todayElement,
      // StageBattle 호환 stage 객체
      stage: {
        stageNumber: trial.tier,
        name: `${trial.name} (${todayElement === 'fire' ? '🔥불' : todayElement === 'water' ? '💧물' : todayElement === 'earth' ? '🪨땅' : '🌀바람'})`,
        monsterCount: trial.monster_count,
        monsterLevelMin: trial.required_level,
        monsterLevelMax: trial.required_level + 2,
        rewardExp: trial.exp_reward,
        rewardGold: trial.gold_reward,
        dungeonKey,
      },
      monsters,
    });
  } catch (err) {
    console.error('Elemental tier error:', err);
    res.status(500).json({ message: '서버 오류가 발생했습니다.' });
  }
});

// POST /elemental/clear - 단계 클리어 + 재료 지급
router.post('/elemental/clear', auth, async (req, res) => {
  try {
    const { tier, victory } = req.body;
    const char = await getSelectedChar(req, pool);
    if (!char) return res.status(404).json({ message: '캐릭터가 없습니다.' });

    if (!victory) return res.json({ success: false });

    const today = getTodayStr();
    const todayElement = getTodayElement();

    const [trials] = await pool.query('SELECT * FROM elemental_trials WHERE tier = ?', [tier]);
    if (trials.length === 0) return res.status(404).json({ message: '단계 정보 없음' });
    const trial = trials[0];

    // 진행도 업데이트
    const [prog] = await pool.query(
      "SELECT * FROM special_dungeon_progress WHERE character_id = ? AND dungeon_type = 'elemental'",
      [char.id]
    );

    const currentTier = (prog.length > 0 && dateToStr(prog[0].reset_date) >= today) ? (prog[0].progress_value || 0) : 0;
    const newTier = Math.max(currentTier, tier);
    const newBest = Math.max(prog.length > 0 ? (prog[0].best_record || 0) : 0, tier);

    if (prog.length > 0) {
      await pool.query(
        `UPDATE special_dungeon_progress
         SET progress_value = ?, best_record = ?, total_clears = total_clears + 1, reset_date = ?
         WHERE character_id = ? AND dungeon_type = 'elemental'`,
        [newTier, newBest, today, char.id]
      );
    } else {
      await pool.query(
        `INSERT INTO special_dungeon_progress (character_id, dungeon_type, progress_value, best_record, total_clears, reset_date)
         VALUES (?, 'elemental', ?, ?, 1, ?)`,
        [char.id, tier, tier, today]
      );
    }

    // 재료 지급
    const elementNames = {
      fire: ['불의 정수', '불의 결정'],
      water: ['물의 정수', '물의 결정'],
      earth: ['땅의 정수', '땅의 결정'],
      wind: ['바람의 정수', '바람의 결정'],
    };
    const matNames = elementNames[todayElement] || elementNames.fire;
    const isHeroGrade = trial.material_grade === '영웅';
    const matName = isHeroGrade ? matNames[1] : matNames[0];
    const matCount = trial.material_count;

    const [matRow] = await pool.query('SELECT id, name, icon FROM materials WHERE name = ?', [matName]);
    let rewardMaterial = null;
    if (matRow.length > 0) {
      await pool.query(
        `INSERT INTO material_inventory (character_id, material_id, quantity) VALUES (?, ?, ?)
         ON DUPLICATE KEY UPDATE quantity = quantity + ?`,
        [char.id, matRow[0].id, matCount, matCount]
      );
      rewardMaterial = { name: matRow[0].name, icon: matRow[0].icon, quantity: matCount };
    }

    res.json({ success: true, clearedTier: tier, rewardMaterial });
  } catch (err) {
    console.error('Elemental clear error:', err);
    res.status(500).json({ message: '서버 오류가 발생했습니다.' });
  }
});

// ============ 보스 토벌전 API ============

// GET /boss-raid/list - 6보스 + 일일 도전 상태
router.get('/boss-raid/list', auth, async (req, res) => {
  try {
    const char = await getSelectedChar(req, pool);
    if (!char) return res.status(404).json({ message: '캐릭터가 없습니다.' });

    const today = getTodayStr();

    const [bosses] = await pool.query('SELECT * FROM boss_raid_configs ORDER BY display_order');
    const [dailyRecords] = await pool.query(
      'SELECT boss_config_id, cleared FROM boss_raid_daily WHERE character_id = ? AND attempt_date = ?',
      [char.id, today]
    );
    const dailyMap = {};
    for (const d of dailyRecords) dailyMap[d.boss_config_id] = d.cleared;

    res.json({
      bosses: bosses.map(b => ({
        id: b.id,
        name: b.name,
        description: b.description,
        dungeonKey: b.dungeon_key,
        requiredLevel: b.required_level,
        bossHpMult: b.boss_hp_mult,
        bossAtkMult: b.boss_atk_mult,
        monsterCount: b.monster_count,
        expReward: b.exp_reward,
        goldReward: b.gold_reward,
        todayCleared: !!dailyMap[b.id],
        todayAttempted: dailyMap[b.id] !== undefined,
      })),
      charLevel: char.level,
    });
  } catch (err) {
    console.error('Boss raid list error:', err);
    res.status(500).json({ message: '서버 오류가 발생했습니다.' });
  }
});

// GET /boss-raid/:id - 보스 데이터 (SrpgBattle 호환)
router.get('/boss-raid/:id', auth, async (req, res) => {
  try {
    const bossId = parseInt(req.params.id);
    const [bosses] = await pool.query('SELECT * FROM boss_raid_configs WHERE id = ?', [bossId]);
    if (bosses.length === 0) return res.status(404).json({ message: '보스를 찾을 수 없습니다.' });

    const boss = bosses[0];

    res.json({
      boss: {
        id: boss.id,
        name: boss.name,
        dungeonKey: boss.dungeon_key,
        monsterCount: boss.monster_count,
        bossHpMult: boss.boss_hp_mult,
        bossAtkMult: boss.boss_atk_mult,
        expReward: boss.exp_reward,
        goldReward: boss.gold_reward,
      },
      // SrpgBattle에 전달할 stage 객체
      stage: {
        stageNumber: 10, // 보스는 항상 10(보스층 취급)
        name: `보스 토벌: ${boss.name}`,
        isBoss: true,
        monsterCount: boss.monster_count,
        monsterLevelBonus: boss.required_level * 2,
        rewardExpBonus: boss.exp_reward,
        rewardGoldBonus: boss.gold_reward,
      },
    });
  } catch (err) {
    console.error('Boss raid detail error:', err);
    res.status(500).json({ message: '서버 오류가 발생했습니다.' });
  }
});

// POST /boss-raid/clear - 보스 클리어/실패 기록
router.post('/boss-raid/clear', auth, async (req, res) => {
  try {
    const { bossId, victory } = req.body;
    const char = await getSelectedChar(req, pool);
    if (!char) return res.status(404).json({ message: '캐릭터가 없습니다.' });

    const today = getTodayStr();

    // 이미 도전했는지 확인
    const [existing] = await pool.query(
      'SELECT id FROM boss_raid_daily WHERE character_id = ? AND boss_config_id = ? AND attempt_date = ?',
      [char.id, bossId, today]
    );

    if (existing.length > 0) {
      return res.status(400).json({ message: '오늘은 이미 이 보스에 도전했습니다.' });
    }

    // 도전 기록 삽입
    await pool.query(
      'INSERT INTO boss_raid_daily (character_id, boss_config_id, attempt_date, cleared) VALUES (?, ?, ?, ?)',
      [char.id, bossId, today, victory ? 1 : 0]
    );

    // 전체 클리어 수 갱신
    if (victory) {
      const [prog] = await pool.query(
        "SELECT * FROM special_dungeon_progress WHERE character_id = ? AND dungeon_type = 'boss_raid'",
        [char.id]
      );
      if (prog.length > 0) {
        await pool.query(
          "UPDATE special_dungeon_progress SET total_clears = total_clears + 1 WHERE character_id = ? AND dungeon_type = 'boss_raid'",
          [char.id]
        );
      } else {
        await pool.query(
          "INSERT INTO special_dungeon_progress (character_id, dungeon_type, progress_value, best_record, total_clears) VALUES (?, 'boss_raid', 0, 0, 1)",
          [char.id]
        );
      }
    }

    res.json({ success: true, victory });
  } catch (err) {
    console.error('Boss raid clear error:', err);
    res.status(500).json({ message: '서버 오류가 발생했습니다.' });
  }
});

module.exports = router;
