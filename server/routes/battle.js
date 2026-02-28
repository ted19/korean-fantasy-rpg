const express = require('express');
const jwt = require('jsonwebtoken');
const { pool } = require('../db');

const router = express.Router();
const JWT_SECRET = 'game-secret-key-change-in-production';

function auth(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader) {
    return res.status(401).json({ message: '인증 토큰이 필요합니다.' });
  }
  try {
    req.user = jwt.verify(authHeader.split(' ')[1], JWT_SECRET);
    next();
  } catch {
    return res.status(401).json({ message: '유효하지 않은 토큰입니다.' });
  }
}

// 몬스터 데이터를 DB에서 로드 (캐시)
let monsterCache = null;
let monsterCacheTime = 0;
const CACHE_TTL = 60000; // 1분

async function getMonsters() {
  if (monsterCache && Date.now() - monsterCacheTime < CACHE_TTL) return monsterCache;
  const [rows] = await pool.query(
    `SELECT m.*, d.key_name as location
     FROM monsters m JOIN dungeons d ON m.dungeon_id = d.id`
  );
  const grouped = {};
  for (const r of rows) {
    if (!grouped[r.location]) grouped[r.location] = [];
    grouped[r.location].push({
      name: r.name, hp: r.hp, attack: r.attack,
      exp: r.exp_reward, gold: r.gold_reward,
    });
  }
  monsterCache = grouped;
  monsterCacheTime = Date.now();
  return grouped;
}

// 전투 실행
router.post('/hunt', auth, async (req, res) => {
  const conn = await pool.getConnection();
  try {
    const { location, skillId, activeSummonIds } = req.body;

    const MONSTERS = await getMonsters();
    if (!MONSTERS[location]) {
      return res.status(400).json({ message: '올바른 사냥터를 선택해주세요.' });
    }

    // 캐릭터 조회
    const [chars] = await conn.query(
      'SELECT * FROM characters WHERE user_id = ?',
      [req.user.id]
    );
    if (chars.length === 0) {
      return res.status(404).json({ message: '캐릭터가 없습니다.' });
    }

    const char = chars[0];
    const currentHp = char.current_hp ?? char.hp;
    const currentMp = char.current_mp ?? char.mp;

    if (currentHp <= 0) {
      return res.status(400).json({ message: 'HP가 0입니다! 마을에서 휴식하세요.' });
    }

    // 참여 소환수 조회
    let activeSummons = [];
    if (activeSummonIds && activeSummonIds.length > 0) {
      const [summonRows] = await conn.query(
        `SELECT cs.*, st.name, st.type as summon_type, st.icon, st.base_hp, st.base_mp, st.base_attack, st.base_defense,
                st.base_phys_attack, st.base_phys_defense, st.base_mag_attack, st.base_mag_defense, st.base_crit_rate, st.base_evasion,
                cs.phys_attack AS sm_phys_attack, cs.phys_defense AS sm_phys_defense,
                cs.mag_attack AS sm_mag_attack, cs.mag_defense AS sm_mag_defense,
                cs.crit_rate AS sm_crit_rate, cs.evasion AS sm_evasion
         FROM character_summons cs
         JOIN summon_templates st ON cs.template_id = st.id
         WHERE cs.id IN (?) AND cs.character_id = ?`,
        [activeSummonIds, char.id]
      );
      // 소환수별 습득 스킬 로드
      for (const s of summonRows) {
        const [skills] = await conn.query(
          `SELECT ss.* FROM summon_learned_skills sls
           JOIN summon_skills ss ON sls.skill_id = ss.id
           WHERE sls.summon_id = ?`,
          [s.id]
        );
        s.skills = skills;
      }
      activeSummons = summonRows;
    }

    // 스킬 정보 조회
    let skill = null;
    if (skillId) {
      const [skillRows] = await conn.query(
        `SELECT s.* FROM skills s
         JOIN character_skills cs ON cs.skill_id = s.id
         WHERE s.id = ? AND cs.character_id = ?`,
        [skillId, char.id]
      );
      if (skillRows.length > 0) skill = skillRows[0];
    }

    // MP 부족 체크
    if (skill && currentMp < skill.mp_cost) {
      return res.status(400).json({ message: `MP가 부족합니다! (필요: ${skill.mp_cost}, 보유: ${currentMp})` });
    }

    // 랜덤 몬스터
    const monsterList = MONSTERS[location];
    const monster = { ...monsterList[Math.floor(Math.random() * monsterList.length)] };

    // 소환수 참여 시 몬스터 HP 보정 (소환수 수 x 30%)
    if (activeSummons.length > 0) {
      monster.hp = Math.floor(monster.hp * (1 + activeSummons.length * 0.3));
    }

    // 전투 시뮬레이션
    let playerHp = currentHp;
    let playerMp = currentMp;
    let monsterHp = monster.hp;
    let round = 0;
    let totalDmgDealt = 0;
    let totalDmgTaken = 0;
    const battleLog = [];

    // 버프 상태
    let atkBuff = 0;
    let defBuff = 0;
    let physAtkBuff = 0;
    let physDefBuff = 0;
    let magAtkBuff = 0;
    let magDefBuff = 0;
    let critRateBuff = 0;
    let evasionBuff = 0;
    let buffDuration = 0;

    const summonMsg = activeSummons.length > 0
      ? ` (동행: ${activeSummons.map(s => s.icon + s.name).join(', ')})`
      : '';
    battleLog.push({ text: `${monster.name}이(가) 나타났다!${summonMsg}`, type: 'system' });

    // 전투 전 버프 스킬 적용
    if (skill && skill.type === 'buff') {
      playerMp -= skill.mp_cost;
      if (skill.buff_stat === 'attack') atkBuff = skill.buff_value;
      if (skill.buff_stat === 'defense') defBuff = skill.buff_value;
      if (skill.buff_stat === 'phys_attack') physAtkBuff = skill.buff_value;
      if (skill.buff_stat === 'phys_defense') physDefBuff = skill.buff_value;
      if (skill.buff_stat === 'mag_attack') magAtkBuff = skill.buff_value;
      if (skill.buff_stat === 'mag_defense') magDefBuff = skill.buff_value;
      if (skill.buff_stat === 'crit_rate') critRateBuff = skill.buff_value;
      if (skill.buff_stat === 'evasion') evasionBuff = skill.buff_value;
      buffDuration = skill.buff_duration;
      const buffStatNames = {
        attack: '공격력', defense: '방어력',
        phys_attack: '물리공격', phys_defense: '물리방어',
        mag_attack: '마법공격', mag_defense: '마법방어',
        crit_rate: '치명타율', evasion: '회피율',
      };
      const buffStatLabel = buffStatNames[skill.buff_stat] || skill.buff_stat;
      battleLog.push({
        text: `${char.name}이(가) [${skill.name}]을(를) 시전! ${buffStatLabel}+${skill.buff_value} (${buffDuration}턴)`,
        type: 'system',
      });
    }

    // 전투 전 힐 스킬 적용
    if (skill && skill.type === 'heal') {
      playerMp -= skill.mp_cost;
      const healed = Math.min(skill.heal_amount, char.hp - playerHp);
      playerHp = Math.min(char.hp, playerHp + skill.heal_amount);
      battleLog.push({
        text: `${char.name}이(가) [${skill.name}]을(를) 시전! HP ${healed} 회복! (HP: ${playerHp})`,
        type: 'heal',
      });
    }

    // 공격 스킬은 첫 턴에 적용
    const isAttackSkill = skill && skill.type === 'attack';

    // 소환수 스킬 쿨다운 트래커
    const summonCooldowns = {};
    activeSummons.forEach(s => { summonCooldowns[s.id] = {}; });

    while (monsterHp > 0 && playerHp > 0 && round < 20) {
      round++;

      // 버프 지속 체크
      if (buffDuration > 0) {
        buffDuration--;
        if (buffDuration === 0) {
          battleLog.push({ text: `버프 효과가 사라졌다.`, type: 'system' });
          atkBuff = 0;
          defBuff = 0;
          physAtkBuff = 0;
          physDefBuff = 0;
          magAtkBuff = 0;
          magDefBuff = 0;
          critRateBuff = 0;
          evasionBuff = 0;
        }
      }

      // 플레이어 공격
      let dmg;
      const totalAtk = char.attack + atkBuff;

      if (isAttackSkill && round === 1) {
        playerMp -= skill.mp_cost;
        dmg = Math.max(1, Math.floor(totalAtk * skill.damage_multiplier) + Math.floor(Math.random() * 5) - 2);
        battleLog.push({
          text: `[${round}] ${char.name}의 [${skill.name}]! ${monster.name}에게 ${dmg} 데미지 (남은 HP: ${Math.max(0, monsterHp - dmg)})`,
          type: 'normal',
        });

        // 영혼흡수 등 공격+힐 복합
        if (skill.heal_amount > 0) {
          const healed = Math.min(skill.heal_amount, char.hp - playerHp);
          playerHp = Math.min(char.hp, playerHp + skill.heal_amount);
          if (healed > 0) {
            battleLog.push({ text: `  생명력 ${healed} 흡수! (HP: ${playerHp})`, type: 'heal' });
          }
        }
      } else {
        dmg = Math.max(1, totalAtk + Math.floor(Math.random() * 5) - 2);
        battleLog.push({
          text: `[${round}] ${char.name}의 공격! ${monster.name}에게 ${dmg} 데미지 (남은 HP: ${Math.max(0, monsterHp - dmg)})`,
          type: 'normal',
        });
      }

      monsterHp -= dmg;
      totalDmgDealt += dmg;
      if (monsterHp <= 0) break;

      // 소환수 공격 턴
      for (const sm of activeSummons) {
        if (monsterHp <= 0) break;

        // 쿨다운 감소
        for (const skId in summonCooldowns[sm.id]) {
          if (summonCooldowns[sm.id][skId] > 0) summonCooldowns[sm.id][skId]--;
        }

        // 스킬 사용 시도 (30% 확률로 스킬 사용)
        let usedSkill = null;
        if (sm.skills && sm.skills.length > 0 && Math.random() < 0.3) {
          const availableSkills = sm.skills.filter(sk =>
            sk.type === 'attack' && (!summonCooldowns[sm.id][sk.id] || summonCooldowns[sm.id][sk.id] <= 0)
          );
          if (availableSkills.length > 0) {
            usedSkill = availableSkills[Math.floor(Math.random() * availableSkills.length)];
          }
        }

        let sDmg;
        if (usedSkill) {
          sDmg = Math.max(1, Math.floor(sm.attack * usedSkill.damage_multiplier) + Math.floor(Math.random() * 4) - 1);
          summonCooldowns[sm.id][usedSkill.id] = usedSkill.cooldown + 1;
          battleLog.push({
            text: `[${round}] ${sm.icon}${sm.name}의 [${usedSkill.name}]! ${monster.name}에게 ${sDmg} 데미지 (남은 HP: ${Math.max(0, monsterHp - sDmg)})`,
            type: 'normal',
          });
          // 공격+힐 복합 스킬
          if (usedSkill.heal_amount > 0) {
            battleLog.push({ text: `  ${sm.name}이(가) 체력 ${usedSkill.heal_amount} 회복!`, type: 'heal' });
          }
        } else {
          sDmg = Math.max(1, sm.attack + Math.floor(Math.random() * 4) - 1);
          battleLog.push({
            text: `[${round}] ${sm.icon}${sm.name}의 공격! ${monster.name}에게 ${sDmg} 데미지 (남은 HP: ${Math.max(0, monsterHp - sDmg)})`,
            type: 'normal',
          });
        }

        monsterHp -= sDmg;
        totalDmgDealt += sDmg;

        // 소환수 힐/버프 스킬 자동 사용 (15% 확률)
        if (sm.skills && Math.random() < 0.15) {
          const healSkills = sm.skills.filter(sk =>
            sk.type === 'heal' && (!summonCooldowns[sm.id][sk.id] || summonCooldowns[sm.id][sk.id] <= 0)
          );
          if (healSkills.length > 0 && playerHp < char.hp * 0.5) {
            const hsk = healSkills[0];
            const healed = Math.min(hsk.heal_amount, char.hp - playerHp);
            playerHp = Math.min(char.hp, playerHp + hsk.heal_amount);
            summonCooldowns[sm.id][hsk.id] = hsk.cooldown + 1;
            if (healed > 0) {
              battleLog.push({ text: `  ${sm.icon}${sm.name}의 [${hsk.name}]! 주인의 HP ${healed} 회복! (HP: ${playerHp})`, type: 'heal' });
            }
          }
        }
      }

      if (monsterHp <= 0) break;

      // 몬스터 공격 (플레이어 + 소환수 합산 방어력 보정)
      const totalDef = char.defense + defBuff;
      const mDmg = Math.max(1, monster.attack - totalDef + Math.floor(Math.random() * 4) - 1);
      playerHp = Math.max(0, playerHp - mDmg);
      totalDmgTaken += mDmg;
      battleLog.push({
        text: `[${round}] ${monster.name}의 반격! ${mDmg} 데미지를 받았다 (남은 HP: ${playerHp})`,
        type: 'damage',
      });
    }

    const victory = monsterHp <= 0;
    const levelBefore = char.level;
    let expGained = 0;
    let goldGained = 0;
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

    // 소환수 레벨업 결과 추적
    const summonLevelUps = [];

    if (victory) {
      expGained = monster.exp;
      goldGained = monster.gold;
      newExp += expGained;
      newGold += goldGained;

      battleLog.push({
        text: `${monster.name}을(를) 처치했다! EXP +${expGained}, Gold +${goldGained}`,
        type: 'heal',
      });

      // 소환수 경험치 분배 (몬스터 경험치의 70%)
      if (activeSummons.length > 0) {
        const summonExp = Math.floor(expGained * 0.7);
        for (const sm of activeSummons) {
          const newSmExp = (sm.exp || 0) + summonExp;
          const expNeededSm = sm.level * 50;
          if (newSmExp >= expNeededSm) {
            // 레벨업
            const leftover = newSmExp - expNeededSm;
            const newSmLevel = sm.level + 1;
            const hpUp = 5 + Math.floor(Math.random() * 4);
            const mpUp = 2 + Math.floor(Math.random() * 3);
            const atkUp = 1 + Math.floor(Math.random() * 2);
            const defUp = 1 + Math.floor(Math.random() * 2);
            const pAtkUp = 1 + Math.floor(Math.random() * 2);
            const pDefUp = 1 + Math.floor(Math.random() * 2);
            const mAtkUp = 1 + Math.floor(Math.random() * 2);
            const mDefUp = 1 + Math.floor(Math.random() * 2);
            const critUp = Math.floor(Math.random() * 2);
            const evaUp = Math.floor(Math.random() * 2);
            await conn.query(
              `UPDATE character_summons SET level = ?, exp = ?,
                hp = hp + ?, mp = mp + ?, attack = attack + ?, defense = defense + ?,
                phys_attack = phys_attack + ?, phys_defense = phys_defense + ?,
                mag_attack = mag_attack + ?, mag_defense = mag_defense + ?,
                crit_rate = crit_rate + ?, evasion = evasion + ?
               WHERE id = ?`,
              [newSmLevel, leftover, hpUp, mpUp, atkUp, defUp,
               pAtkUp, pDefUp, mAtkUp, mDefUp, critUp, evaUp, sm.id]
            );
            battleLog.push({
              text: `${sm.icon}${sm.name} 레벨 업! Lv.${newSmLevel}! (HP+${hpUp} MP+${mpUp} ATK+${atkUp} DEF+${defUp})`,
              type: 'level',
            });
            summonLevelUps.push({ id: sm.id, level: newSmLevel });
          } else {
            await conn.query(
              'UPDATE character_summons SET exp = ? WHERE id = ?',
              [newSmExp, sm.id]
            );
          }
        }
        battleLog.push({
          text: `소환수 EXP +${summonExp} (각)`,
          type: 'system',
        });
      }

      // 레벨업 체크
      const expNeeded = newLevel * 100;
      if (newExp >= expNeeded) {
        newExp -= expNeeded;
        newLevel++;
        newMaxHp += 10;
        newMaxMp += 5;
        newAtk += 2;
        newDef += 1;
        newPhysAtk += 2;
        newPhysDef += 1;
        newMagAtk += 2;
        newMagDef += 1;
        newCritRate += 1;
        newEvasion += 1;
        playerHp = newMaxHp;
        battleLog.push({
          text: `레벨 업! Lv.${newLevel} 달성! 모든 능력치가 상승했습니다!`,
          type: 'level',
        });
      }
    } else {
      battleLog.push({
        text: `${monster.name}에게 패배했다... 마을에서 휴식하세요.`,
        type: 'damage',
      });
    }

    await conn.beginTransaction();

    // 캐릭터 스탯 업데이트
    const finalMp = skill ? playerMp : currentMp;
    await conn.query(
      `UPDATE characters SET
        level = ?, exp = ?, gold = ?, hp = ?, mp = ?,
        attack = ?, defense = ?, current_hp = ?, current_mp = ?,
        phys_attack = ?, phys_defense = ?, mag_attack = ?, mag_defense = ?,
        crit_rate = ?, evasion = ?
      WHERE id = ?`,
      [newLevel, newExp, newGold, newMaxHp, newMaxMp, newAtk, newDef, playerHp, Math.max(0, finalMp),
       newPhysAtk, newPhysDef, newMagAtk, newMagDef, newCritRate, newEvasion, char.id]
    );

    // 전투 기록 저장
    await conn.query(
      `INSERT INTO battle_logs
        (character_id, location, monster_name, result, rounds, damage_dealt, damage_taken, exp_gained, gold_gained, level_before, level_after)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [char.id, location, monster.name, victory ? 'victory' : 'defeat', round, totalDmgDealt, totalDmgTaken, expGained, goldGained, levelBefore, newLevel]
    );

    // 퀘스트 진행도 업데이트
    if (victory) {
      // hunt 퀘스트: 특정 몬스터 처치
      await conn.query(
        `UPDATE character_quests cq
         JOIN quests q ON cq.quest_id = q.id
         SET cq.progress = cq.progress + 1
         WHERE cq.character_id = ? AND cq.status = 'active'
           AND q.type = 'hunt' AND q.target = ?`,
        [char.id, monster.name]
      );

      // hunt_location 퀘스트: 특정 지역 몬스터 처치
      await conn.query(
        `UPDATE character_quests cq
         JOIN quests q ON cq.quest_id = q.id
         SET cq.progress = cq.progress + 1
         WHERE cq.character_id = ? AND cq.status = 'active'
           AND q.type = 'hunt_location' AND q.target = ?`,
        [char.id, location]
      );

      // 목표 달성 시 completed로 변경
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

    // 완료된 퀘스트 수 조회
    const [completedQuests] = await conn.query(
      "SELECT COUNT(*) as cnt FROM character_quests WHERE character_id = ? AND status = 'completed'",
      [char.id]
    );

    await conn.commit();

    // 소환수 최신 상태 조회
    let updatedSummons = [];
    if (activeSummons.length > 0) {
      const [smRows] = await pool.query(
        `SELECT cs.id, cs.level, cs.exp, cs.hp, cs.mp, cs.attack, cs.defense,
                cs.phys_attack, cs.phys_defense, cs.mag_attack, cs.mag_defense,
                cs.crit_rate, cs.evasion,
                st.name, st.type, st.icon,
                st.base_phys_attack, st.base_phys_defense, st.base_mag_attack, st.base_mag_defense,
                st.base_crit_rate, st.base_evasion
         FROM character_summons cs
         JOIN summon_templates st ON cs.template_id = st.id
         WHERE cs.id IN (?)`,
        [activeSummonIds]
      );
      updatedSummons = smRows;
    }

    res.json({
      victory,
      monster: monster.name,
      battleLog,
      questCompleted: completedQuests[0].cnt,
      character: {
        level: newLevel,
        exp: newExp,
        gold: newGold,
        hp: newMaxHp,
        mp: newMaxMp,
        attack: newAtk,
        defense: newDef,
        phys_attack: newPhysAtk,
        phys_defense: newPhysDef,
        mag_attack: newMagAtk,
        mag_defense: newMagDef,
        crit_rate: newCritRate,
        evasion: newEvasion,
        current_hp: playerHp,
        current_mp: Math.max(0, skill ? playerMp : currentMp),
      },
      summons: updatedSummons,
    });
  } catch (err) {
    await conn.rollback();
    console.error('Battle error:', err);
    res.status(500).json({ message: '서버 오류가 발생했습니다.' });
  } finally {
    conn.release();
  }
});

// 휴식 (HP/MP 회복)
router.post('/rest', auth, async (req, res) => {
  try {
    const [chars] = await pool.query(
      'SELECT * FROM characters WHERE user_id = ?',
      [req.user.id]
    );
    if (chars.length === 0) {
      return res.status(404).json({ message: '캐릭터가 없습니다.' });
    }

    const char = chars[0];
    await pool.query(
      'UPDATE characters SET current_hp = hp, current_mp = mp WHERE id = ?',
      [char.id]
    );

    res.json({
      message: 'HP/MP가 완전히 회복되었습니다!',
      character: { ...char, current_hp: char.hp, current_mp: char.mp },
    });
  } catch (err) {
    console.error('Rest error:', err);
    res.status(500).json({ message: '서버 오류가 발생했습니다.' });
  }
});

// 전투 기록 조회
router.get('/history', auth, async (req, res) => {
  try {
    const [chars] = await pool.query(
      'SELECT id FROM characters WHERE user_id = ?',
      [req.user.id]
    );
    if (chars.length === 0) {
      return res.json({ logs: [] });
    }

    const [logs] = await pool.query(
      'SELECT * FROM battle_logs WHERE character_id = ? ORDER BY created_at DESC LIMIT 50',
      [chars[0].id]
    );

    res.json({ logs });
  } catch (err) {
    console.error('History error:', err);
    res.status(500).json({ message: '서버 오류가 발생했습니다.' });
  }
});

// SRPG 전투 결과 처리
router.post('/srpg-result', auth, async (req, res) => {
  const conn = await pool.getConnection();
  try {
    const { location, victory, monstersDefeated, expGained, goldGained, rounds, activeSummonIds } = req.body;

    const [chars] = await conn.query('SELECT * FROM characters WHERE user_id = ?', [req.user.id]);
    if (chars.length === 0) return res.status(404).json({ message: '캐릭터가 없습니다.' });
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
    let playerHp = char.current_hp ?? char.hp;
    let playerMp = char.current_mp ?? char.mp;

    if (victory) {
      newExp += expGained;
      newGold += goldGained;

      // 레벨업 체크
      let expNeeded = newLevel * 100;
      while (newExp >= expNeeded) {
        newExp -= expNeeded;
        newLevel++;
        newMaxHp += 10;
        newMaxMp += 5;
        newAtk += 2;
        newDef += 1;
        newPhysAtk += 2;
        newPhysDef += 1;
        newMagAtk += 2;
        newMagDef += 1;
        newCritRate += 1;
        newEvasion += 1;
        playerHp = newMaxHp;
        playerMp = newMaxMp;
        expNeeded = newLevel * 100;
      }

      // 소환수 경험치 분배
      if (activeSummonIds && activeSummonIds.length > 0) {
        const summonExp = Math.floor(expGained * 0.7);
        for (const smId of activeSummonIds) {
          const [smRows] = await conn.query('SELECT * FROM character_summons WHERE id = ? AND character_id = ?', [smId, char.id]);
          if (smRows.length === 0) continue;
          const sm = smRows[0];
          let newSmExp = (sm.exp || 0) + summonExp;
          const expNeededSm = sm.level * 50;
          if (newSmExp >= expNeededSm) {
            const leftover = newSmExp - expNeededSm;
            const newSmLevel = sm.level + 1;
            const hpUp = 5 + Math.floor(Math.random() * 4);
            const mpUp = 2 + Math.floor(Math.random() * 3);
            const atkUp = 1 + Math.floor(Math.random() * 2);
            const defUp = 1 + Math.floor(Math.random() * 2);
            const pAtkUp = 1 + Math.floor(Math.random() * 2);
            const pDefUp = 1 + Math.floor(Math.random() * 2);
            const mAtkUp = 1 + Math.floor(Math.random() * 2);
            const mDefUp = 1 + Math.floor(Math.random() * 2);
            const critUp = Math.floor(Math.random() * 2);
            const evaUp = Math.floor(Math.random() * 2);
            await conn.query(
              `UPDATE character_summons SET level = ?, exp = ?,
                hp = hp + ?, mp = mp + ?, attack = attack + ?, defense = defense + ?,
                phys_attack = phys_attack + ?, phys_defense = phys_defense + ?,
                mag_attack = mag_attack + ?, mag_defense = mag_defense + ?,
                crit_rate = crit_rate + ?, evasion = evasion + ?
               WHERE id = ?`,
              [newSmLevel, leftover, hpUp, mpUp, atkUp, defUp,
               pAtkUp, pDefUp, mAtkUp, mDefUp, critUp, evaUp, sm.id]
            );
          } else {
            await conn.query('UPDATE character_summons SET exp = ? WHERE id = ?', [newSmExp, sm.id]);
          }
        }
      }
    } else {
      playerHp = 0;
    }

    await conn.beginTransaction();

    await conn.query(
      `UPDATE characters SET level = ?, exp = ?, gold = ?, hp = ?, mp = ?,
        attack = ?, defense = ?, current_hp = ?, current_mp = ?,
        phys_attack = ?, phys_defense = ?, mag_attack = ?, mag_defense = ?,
        crit_rate = ?, evasion = ?
      WHERE id = ?`,
      [newLevel, newExp, newGold, newMaxHp, newMaxMp, newAtk, newDef,
        Math.max(0, playerHp), Math.max(0, playerMp),
        newPhysAtk, newPhysDef, newMagAtk, newMagDef, newCritRate, newEvasion, char.id]
    );

    // 전투 기록
    const monsterName = (monstersDefeated || []).join(', ') || 'unknown';
    await conn.query(
      `INSERT INTO battle_logs
        (character_id, location, monster_name, result, rounds, damage_dealt, damage_taken, exp_gained, gold_gained, level_before, level_after)
      VALUES (?, ?, ?, ?, ?, 0, 0, ?, ?, ?, ?)`,
      [char.id, location, monsterName, victory ? 'victory' : 'defeat', rounds, expGained || 0, goldGained || 0, levelBefore, newLevel]
    );

    // 퀘스트 진행
    if (victory && monstersDefeated) {
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
      await conn.query(
        `UPDATE character_quests cq
         JOIN quests q ON cq.quest_id = q.id
         SET cq.progress = cq.progress + ?
         WHERE cq.character_id = ? AND cq.status = 'active'
           AND q.type = 'hunt_location' AND q.target = ?`,
        [monstersDefeated.length, char.id, location]
      );
      await conn.query(
        `UPDATE character_quests cq
         JOIN quests q ON cq.quest_id = q.id
         SET cq.status = 'completed', cq.completed_at = NOW()
         WHERE cq.character_id = ? AND cq.status = 'active'
           AND cq.progress >= q.target_count`,
        [char.id]
      );
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

    await conn.commit();

    res.json({
      character: {
        level: newLevel,
        exp: newExp,
        gold: newGold,
        hp: newMaxHp,
        mp: newMaxMp,
        attack: newAtk,
        defense: newDef,
        phys_attack: newPhysAtk,
        phys_defense: newPhysDef,
        mag_attack: newMagAtk,
        mag_defense: newMagDef,
        crit_rate: newCritRate,
        evasion: newEvasion,
        current_hp: Math.max(0, playerHp),
        current_mp: Math.max(0, playerMp),
      },
    });
  } catch (err) {
    await conn.rollback();
    console.error('SRPG result error:', err);
    res.status(500).json({ message: '서버 오류가 발생했습니다.' });
  } finally {
    conn.release();
  }
});

module.exports = router;
