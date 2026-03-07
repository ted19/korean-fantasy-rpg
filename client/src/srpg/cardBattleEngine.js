/**
 * 카드 턴제 전투 엔진
 * - Darkest Dungeon 스타일: 앞열/뒷열 + 속도 기반 턴 + 방어/수호 시스템
 * - 좌측: 아군 (최대 6장), 우측: 적 (1~6장)
 * - 근거리: 앞열만 공격 가능, 원거리/마법: 앞뒷열 모두 공격
 * - 방어 스킬: 아군 유닛을 대신 피해 흡수
 */

// ========== 유닛 생성 ==========

const CLASS_IMAGE_MAP = { '풍수사': 'pungsu', '무당': 'mudang', '승려': 'monk', '저승사자': 'reaper' };

export function createCardPlayerUnit(char, skills, passiveBonuses) {
  const classInfo = getClassInfo(char.class_type);
  const classKey = CLASS_IMAGE_MAP[char.class_type] || 'monk';
  // 패시브 보너스 적용
  const pb = passiveBonuses || {};
  const applyBonus = (base, stat) => {
    const b = pb[stat];
    if (!b) return base;
    let val = base + (b.flat || 0);
    if (b.percent) val = Math.floor(val * (1 + b.percent / 100));
    return val;
  };
  const maxHp = applyBonus(char.hp, 'hp');
  const maxMp = applyBonus(char.mp, 'mp');
  const physAttack = applyBonus(char.phys_attack || 0, 'phys_attack');
  const magAttack = applyBonus(char.mag_attack || 0, 'mag_attack');
  const evasion = applyBonus(char.evasion || 3, 'evasion');
  return {
    id: 'player',
    name: char.name,
    team: 'player',
    classType: char.class_type,
    level: char.level,
    hp: Math.min(char.current_hp ?? char.hp, maxHp),
    maxHp,
    mp: Math.min(char.current_mp ?? char.mp, maxMp),
    maxMp,
    attack: applyBonus(char.attack, 'attack'),
    defense: applyBonus(char.defense, 'defense'),
    physAttack,
    physDefense: applyBonus(char.phys_defense || 0, 'phys_defense'),
    magAttack,
    magDefense: applyBonus(char.mag_defense || 0, 'mag_defense'),
    critRate: applyBonus(char.crit_rate || 5, 'crit_rate'),
    evasion,
    speed: magAttack + physAttack + evasion,
    skills: (skills || []).map(s => ({ ...s, currentCooldown: 0, iconUrl: `/skills/${s.id}_icon.png` })),
    row: classInfo.defaultRow,
    rangeType: classInfo.rangeType,
    icon: classInfo.icon,
    imageUrl: `/characters/${classKey}_full.png`,
    color: '#4fc3f7',
    isGuarding: false,
    guardTarget: null,
    buffs: [],
    debuffs: [],
    gridRow: 0,
    gridCol: 0,
    element: char.element || 'neutral',
    portraitEffect: null,
  };
}

export function createCardSummonUnit(summon) {
  const skills = summon.learned_skills || summon.skills || [];
  const rangeType = summon.range_type || detectRangeType(skills, summon.type);
  return {
    id: `summon_${summon.id}`,
    summonId: summon.id,
    name: summon.name,
    team: 'player',
    classType: 'summon',
    summonType: summon.type,
    level: summon.level,
    hp: summon.hp,
    maxHp: summon.hp,
    mp: summon.mp || 0,
    maxMp: summon.mp || 0,
    attack: summon.attack,
    defense: summon.defense,
    physAttack: summon.phys_attack || summon.physAttack || 0,
    physDefense: summon.phys_defense || summon.physDefense || 0,
    magAttack: summon.mag_attack || summon.magAttack || 0,
    magDefense: summon.mag_defense || summon.magDefense || 0,
    critRate: summon.crit_rate || summon.critRate || 5,
    evasion: summon.evasion || 3,
    speed: (summon.phys_attack || summon.physAttack || 0) + (summon.evasion || 3) + 5,
    skills: skills.map(s => ({ ...s, currentCooldown: 0, iconUrl: `/summon_skills/${s.id}_icon.png` })),
    row: (rangeType === 'ranged' || rangeType === 'magic') ? 'back' : 'front',
    rangeType,
    icon: summon.icon || '👻',
    imageUrl: `/summons/${summon.template_id}_full.png`,
    color: '#81c784',
    isGuarding: false,
    guardTarget: null,
    buffs: [],
    debuffs: [],
    gridRow: 0,
    gridCol: 0,
    element: summon.element || 'neutral',
  };
}

export function createCardMercenaryUnit(merc) {
  const weaponType = merc.weapon_type || merc.weaponType || 'sword';
  const rangeType = merc.range_type || (weaponType === 'bow' ? 'ranged' : weaponType === 'staff' || weaponType === 'talisman' ? 'magic' : 'melee');
  const fatigued = merc.fatigue !== undefined && merc.fatigue <= 0;
  return {
    id: `merc_${merc.id}`,
    mercId: merc.id,
    name: merc.name,
    team: 'player',
    classType: merc.class_type || 'mercenary',
    level: merc.level,
    hp: fatigued ? 0 : merc.hp,
    maxHp: merc.hp,
    mp: fatigued ? 0 : (merc.mp || 0),
    maxMp: merc.mp || 0,
    attack: merc.phys_attack || 0,
    defense: merc.phys_defense || 0,
    physAttack: merc.phys_attack || 0,
    physDefense: merc.phys_defense || 0,
    magAttack: merc.mag_attack || 0,
    magDefense: merc.mag_defense || 0,
    critRate: merc.crit_rate || 5,
    evasion: merc.evasion || 3,
    speed: (merc.phys_attack || 0) + (merc.evasion || 3) + 3,
    skills: (merc.learned_skills || merc.skills || []).map(s => ({ ...s, currentCooldown: 0, iconUrl: `/merc_skills/${s.id}_icon.png` })),
    row: (rangeType === 'ranged' || rangeType === 'magic') ? 'back' : 'front',
    rangeType,
    icon: '🗡️',
    imageUrl: `/mercenaries/${merc.template_id}_full.png`,
    color: '#ffb347',
    isGuarding: false,
    guardTarget: null,
    buffs: [],
    debuffs: [],
    gridRow: 0,
    gridCol: 0,
    element: merc.element || 'neutral',
    portraitEffect: null,
  };
}

export function createCardMonsterUnit(monster, index) {
  const rangeType = monster.rangeType || monster.range_type || detectMonsterRangeType(monster);
  return {
    id: `monster_${index}`,
    monsterId: monster.id || monster.monsterId || null,
    name: monster.name,
    team: 'enemy',
    level: monster.level || 1,
    hp: monster.hp,
    maxHp: monster.hp,
    mp: monster.mp || 0,
    maxMp: monster.mp || 0,
    attack: monster.attack,
    defense: monster.defense || 0,
    physAttack: monster.phys_attack || monster.physAttack || 0,
    physDefense: monster.phys_defense || monster.physDefense || 0,
    magAttack: monster.mag_attack || monster.magAttack || 0,
    magDefense: monster.mag_defense || monster.magDefense || 0,
    critRate: monster.crit_rate || monster.critRate || 5,
    evasion: monster.evasion || 3,
    speed: (monster.move_range || monster.moveRange || 3) * 5 + (monster.evasion || 3),
    skills: (monster.skills || []).map(s => ({ ...s, currentCooldown: 0 })),
    row: (rangeType === 'ranged' || rangeType === 'magic') ? 'back' : 'front',
    rangeType,
    icon: monster.icon || '👹',
    imageUrl: `/monsters/${monster.id}_full.png`,
    color: '#ef5350',
    expReward: monster.expReward || monster.exp_reward || 0,
    goldReward: monster.goldReward || monster.gold_reward || 0,
    aiType: monster.aiType || monster.ai_type || 'aggressive',
    isGuarding: false,
    guardTarget: null,
    buffs: [],
    debuffs: [],
    gridRow: 0,
    gridCol: 0,
    element: monster.element || 'neutral',
    eliteTier: monster.eliteTier || null,
  };
}

// ========== 3x3 그리드 배치 (팀당 최대 9명) ==========

export function assignGridPositions(playerTeam, enemyTeam) {
  // 각 팀: 3x3 그리드 (col 0=뒷열, col 1=중열, col 2=앞열)
  // 아군: col2=앞열(front), col0=뒷열(back), col1=넘치는 유닛
  // 적군: col0=앞열(front), col2=뒷열(back), col1=넘치는 유닛

  function placeTeam(units, frontCol, backCol, midCol) {
    const front = units.filter(u => u.row === 'front');
    const back = units.filter(u => u.row === 'back');

    // 앞열 배치 (최대 3명)
    front.slice(0, 3).forEach((u, i) => {
      u.gridCol = frontCol;
      u.gridRow = i;
    });
    // 뒷열 배치 (최대 3명)
    back.slice(0, 3).forEach((u, i) => {
      u.gridCol = backCol;
      u.gridRow = i;
    });
    // 넘치는 유닛은 중간열에 배치
    const overflow = [...front.slice(3), ...back.slice(3)];
    overflow.slice(0, 3).forEach((u, i) => {
      u.gridCol = midCol;
      u.gridRow = i;
    });
  }

  placeTeam(playerTeam, 2, 0, 1);
  placeTeam(enemyTeam, 0, 2, 1);
}

// ========== 유틸 ==========

function getClassInfo(classType) {
  switch (classType) {
    case '풍수사': return { defaultRow: 'back', rangeType: 'magic', icon: '🧙' };
    case '무당':  return { defaultRow: 'back', rangeType: 'magic', icon: '🔮' };
    case '승려':  return { defaultRow: 'front', rangeType: 'melee', icon: '📿' };
    case '저승사자': return { defaultRow: 'front', rangeType: 'melee', icon: '💀' };
    default:      return { defaultRow: 'front', rangeType: 'melee', icon: '⚔️' };
  }
}

function detectRangeType(skills, summonType) {
  if (summonType === '정령') return 'magic';
  if (summonType === '귀신') return 'magic';
  const hasRanged = skills.some(s => (s.range_val || s.range || 1) >= 2);
  return hasRanged ? 'ranged' : 'melee';
}

function detectMonsterRangeType(monster) {
  // DB에서 range_type이 설정된 경우 우선 사용
  if (monster.range_type === 'magic' || monster.rangeType === 'magic') return 'magic';
  if (monster.aiType === 'ranged' || monster.ai_type === 'ranged') return 'ranged';
  if (monster.aiType === 'support' || monster.ai_type === 'support') return 'ranged';
  const skills = monster.skills || [];
  const rangedSkills = skills.filter(s => (s.range_val || s.range || 1) >= 2);
  return rangedSkills.length > skills.length / 2 ? 'ranged' : 'melee';
}

// ========== 턴 순서 ==========

export function calculateTurnOrder(units) {
  const alive = units.filter(u => u.hp > 0);
  return alive
    .map(u => ({
      ...u,
      initiative: u.speed + Math.floor(Math.random() * 8),
    }))
    .sort((a, b) => b.initiative - a.initiative)
    .map(u => u.id);
}

// ========== 타겟 가능 여부 ==========

export function getValidTargets(attacker, defenders, attackType) {
  const alive = defenders.filter(u => u.hp > 0);
  if (alive.length === 0) return [];

  if (attackType === 'ranged' || attackType === 'magic') {
    return alive; // 원거리/마법: 모두 타겟 가능
  }

  // 근거리: 행(gridRow)별로 가장 앞에 있는 유닛을 타겟 가능
  // 아군(player): gridCol 큰 쪽이 전열 (col2=전, col1=중, col0=후)
  // 적군(enemy):  gridCol 작은 쪽이 전열 (col0=전, col1=중, col2=후)
  const defTeam = alive[0]?.team;
  const isPlayerTeam = defTeam === 'player';

  // 각 행(gridRow)에서 가장 전열에 있는 유닛만 타겟 가능
  const rowMap = {};
  for (const u of alive) {
    const r = u.gridRow;
    if (!(r in rowMap)) {
      rowMap[r] = u;
    } else {
      const cur = rowMap[r];
      if (isPlayerTeam ? u.gridCol > cur.gridCol : u.gridCol < cur.gridCol) {
        rowMap[r] = u;
      }
    }
  }
  return Object.values(rowMap);
}

export function getHealTargets(healer, allies) {
  return allies.filter(u => u.hp > 0 && u.hp < u.maxHp);
}

export function getGuardTargets(guarder, allies) {
  return allies.filter(u => u.hp > 0 && u.id !== guarder.id);
}

// ========== 데미지 계산 ==========

export function calculateDamage(attacker, defender, skill = null) {
  let baseDmg;
  let isMagic = false;

  if (skill && skill.damage_multiplier) {
    const mult = skill.damage_multiplier;
    // damage_type 필드가 있으면 그에 따라 결정, 없으면 공격자 스탯 비교
    if (skill.damage_type === 'physical') {
      baseDmg = attacker.physAttack * mult + attacker.attack * 0.5;
    } else if (skill.damage_type === 'magical') {
      baseDmg = attacker.magAttack * mult + attacker.attack * 0.5;
      isMagic = true;
    } else {
      // damage_type 미지정 시 주 스탯 기준
      if (attacker.magAttack > attacker.physAttack) {
        baseDmg = attacker.magAttack * mult + attacker.attack * 0.5;
        isMagic = true;
      } else {
        baseDmg = attacker.physAttack * mult + attacker.attack * 0.5;
      }
    }
  } else {
    if (attacker.magAttack > attacker.physAttack) {
      baseDmg = attacker.magAttack + attacker.attack * 0.5;
      isMagic = true;
    } else {
      baseDmg = attacker.physAttack + attacker.attack * 0.5;
    }
  }

  // 버프 적용
  const atkBuff = (attacker.buffs || [])
    .filter(b => b.stat === 'attack')
    .reduce((sum, b) => sum + b.value, 0);
  baseDmg += atkBuff;

  // 방어
  const defStat = isMagic ? defender.magDefense : defender.physDefense;
  const defBuff = (defender.buffs || [])
    .filter(b => b.stat === 'defense')
    .reduce((sum, b) => sum + b.value, 0);
  const totalDef = defStat + defender.defense * 0.3 + defBuff;

  // 랜덤 편차
  const variance = Math.floor(Math.random() * 5) - 2;
  let damage = Math.max(1, Math.floor(baseDmg - totalDef * 0.75 + variance));

  // 속성 상성 적용
  let elementMult = 1.0;
  let elementLabel = '';
  if (attacker.element && defender.element && attacker.element !== defender.element) {
    const ELEMENT_TABLE = {
      fire:    { fire:1.0, water:0.5, earth:1.5, wind:1.5, neutral:1.0 },
      water:   { fire:2.0, water:1.0, earth:1.5, wind:0.5, neutral:1.0 },
      earth:   { fire:0.5, water:0.5, earth:1.0, wind:2.0, neutral:1.0 },
      wind:    { fire:1.5, water:2.0, earth:0.5, wind:1.0, neutral:1.0 },
      neutral: { fire:1.0, water:1.0, earth:1.0, wind:1.0, neutral:1.0 },
    };
    elementMult = ELEMENT_TABLE[attacker.element]?.[defender.element] ?? 1.0;
    if (elementMult > 1.0) elementLabel = '효과적!';
    else if (elementMult < 1.0) elementLabel = '비효과적...';
    damage = Math.max(1, Math.floor(damage * elementMult));
  }

  // 크리티컬
  let isCrit = false;
  const critRate = attacker.critRate || 5;
  if (Math.random() * 100 < critRate) {
    const critMultiplier = 1.4 + Math.min(critRate, 30) * 0.01;
    damage = Math.floor(damage * critMultiplier);
    isCrit = true;
  }

  // 회피
  let isEvade = false;
  if (Math.random() * 100 < (defender.evasion || 3)) {
    damage = 0;
    isEvade = true;
  }

  return { damage, isCrit, isEvade, isMagic, elementMult, elementLabel };
}

// ========== 스킬 실행 ==========

export function executeSkill(caster, skill, target, allUnits) {
  const logs = [];

  if (caster.mp < (skill.mp_cost || 0)) {
    logs.push({ text: `${caster.name}: MP 부족!`, type: 'system' });
    return { logs, success: false };
  }

  caster.mp -= (skill.mp_cost || 0);
  skill.currentCooldown = skill.cooldown || 0;

  switch (skill.type) {
    case 'attack': {
      const result = calculateDamage(caster, target, skill);

      // 수호 체크
      const guardian = findGuardian(target, allUnits);
      const actualTarget = guardian || target;
      if (guardian) {
        logs.push({ text: `${guardian.name}이(가) ${target.name} 대신 방어!`, type: 'system' });
      }

      if (result.isEvade) {
        logs.push({ text: `${caster.name}의 ${skill.name} → ${actualTarget.name} 회피!`, type: 'evade', isEvade: true, targetId: actualTarget.id });
      } else {
        actualTarget.hp = Math.max(0, actualTarget.hp - result.damage);
        let dmgText = `${caster.name}의 ${skill.name} → ${actualTarget.name}에게 ${result.damage} 피해`;
        if (result.isCrit) dmgText += ' (치명타!)';
        if (result.elementLabel) dmgText += ` [${result.elementLabel}]`;
        logs.push({ text: dmgText, type: 'damage', isCrit: result.isCrit, elementMult: result.elementMult, elementLabel: result.elementLabel });

        // 흡혈
        if (skill.heal_amount && skill.heal_amount > 0) {
          const healAmt = Math.min(skill.heal_amount, caster.maxHp - caster.hp);
          caster.hp += healAmt;
          logs.push({ text: `${caster.name} HP +${healAmt} 흡수`, type: 'heal' });
        }
      }

      if (actualTarget.hp <= 0) {
        logs.push({ text: `${actualTarget.name} 쓰러짐!`, type: 'kill' });
        promoteBackRow(actualTarget.team, allUnits);
      }
      break;
    }

    case 'aoe': {
      const enemies = allUnits.filter(u => u.team !== caster.team && u.hp > 0);
      logs.push({ text: `${caster.name}의 ${skill.name}! (전체 공격)`, type: 'system' });
      for (const enemy of enemies) {
        const result = calculateDamage(caster, enemy, skill);
        if (result.isEvade) {
          logs.push({ text: `  → ${enemy.name} 회피!`, type: 'evade', isEvade: true, targetId: enemy.id });
        } else {
          const dmg = Math.floor(result.damage * 0.7); // AOE 감쇄
          enemy.hp = Math.max(0, enemy.hp - dmg);
          let aoeText = `  → ${enemy.name}에게 ${dmg} 피해`;
          if (result.isCrit) aoeText += ' (치명타!)';
          if (result.elementLabel) aoeText += ` [${result.elementLabel}]`;
          logs.push({ text: aoeText, type: 'damage', isCrit: result.isCrit, targetId: enemy.id, elementMult: result.elementMult, elementLabel: result.elementLabel });
          if (enemy.hp <= 0) {
            logs.push({ text: `  ${enemy.name} 쓰러짐!`, type: 'kill' });
          }
        }
      }
      promoteBackRow(enemies[0]?.team, allUnits);
      break;
    }

    case 'heal': {
      const healAmt = skill.heal_amount || 30;
      const actual = Math.min(healAmt, target.maxHp - target.hp);
      target.hp += actual;
      logs.push({ text: `${caster.name}의 ${skill.name} → ${target.name} HP +${actual}`, type: 'heal' });
      break;
    }

    case 'buff': {
      const buffTarget = target || caster;
      const existing = buffTarget.buffs.findIndex(b => b.stat === skill.buff_stat && b.source === caster.id);
      if (existing >= 0) buffTarget.buffs.splice(existing, 1);
      buffTarget.buffs.push({
        stat: skill.buff_stat || 'attack',
        value: skill.buff_value || 5,
        duration: skill.buff_duration || 3,
        source: caster.id,
        name: skill.name,
      });
      logs.push({
        text: `${caster.name}의 ${skill.name} → ${buffTarget.name} ${skill.buff_stat || 'attack'} +${skill.buff_value || 5} (${skill.buff_duration || 3}턴)`,
        type: 'buff',
      });
      break;
    }

    case 'debuff': {
      const existing = target.debuffs.findIndex(b => b.stat === skill.buff_stat && b.source === caster.id);
      if (existing >= 0) target.debuffs.splice(existing, 1);
      target.debuffs.push({
        stat: skill.buff_stat || 'defense',
        value: skill.buff_value || 3,
        duration: skill.buff_duration || 3,
        source: caster.id,
        name: skill.name,
      });
      logs.push({
        text: `${caster.name}의 ${skill.name} → ${target.name} ${skill.buff_stat || 'defense'} -${skill.buff_value || 3} (${skill.buff_duration || 3}턴)`,
        type: 'debuff',
      });
      break;
    }

    default:
      logs.push({ text: `${caster.name}의 ${skill.name} 사용`, type: 'system' });
  }

  return { logs, success: true };
}

// ========== 기본 공격 ==========

export function executeAttack(attacker, target, allUnits) {
  const logs = [];
  const result = calculateDamage(attacker, target);

  // 수호 체크
  const guardian = findGuardian(target, allUnits);
  const actualTarget = guardian || target;
  if (guardian) {
    logs.push({ text: `${guardian.name}이(가) ${target.name} 대신 방어!`, type: 'system' });
  }

  if (result.isEvade) {
    logs.push({ text: `${attacker.name} → ${actualTarget.name} 회피!`, type: 'evade', isEvade: true, targetId: actualTarget.id });
  } else {
    actualTarget.hp = Math.max(0, actualTarget.hp - result.damage);
    let dmgText = `${attacker.name} → ${actualTarget.name}에게 ${result.damage} 피해`;
    if (result.isCrit) dmgText += ' (치명타!)';
    if (result.elementLabel) dmgText += ` [${result.elementLabel}]`;
    logs.push({ text: dmgText, type: 'damage', isCrit: result.isCrit, elementMult: result.elementMult, elementLabel: result.elementLabel });
  }

  if (actualTarget.hp <= 0) {
    logs.push({ text: `${actualTarget.name} 쓰러짐!`, type: 'kill' });
    promoteBackRow(actualTarget.team, allUnits);
  }

  return logs;
}

// ========== 방어 (수호) ==========

export function executeGuard(guarder, target) {
  guarder.isGuarding = true;
  guarder.guardTarget = target.id;
  return [{ text: `${guarder.name}이(가) ${target.name}을(를) 수호 중!`, type: 'guard' }];
}

function findGuardian(target, allUnits) {
  if (!target) return null;
  const guardian = allUnits.find(u =>
    u.hp > 0 &&
    u.team === target.team &&
    u.isGuarding &&
    u.guardTarget === target.id &&
    u.id !== target.id
  );
  return guardian || null;
}

// ========== 열 승진: 앞열이 비면 뒷열이 올라옴 ==========

export function promoteBackRow(team, allUnits) {
  if (!team) return;
  const teamAlive = allUnits.filter(u => u.team === team && u.hp > 0);
  const frontAlive = teamAlive.filter(u => u.row === 'front');
  if (frontAlive.length === 0) {
    const backAlive = teamAlive.filter(u => u.row === 'back');
    if (backAlive.length > 0) {
      // 가장 방어 높은 유닛을 앞으로
      backAlive.sort((a, b) => (b.defense + b.physDefense) - (a.defense + a.physDefense));
      backAlive[0].row = 'front';
    }
  }
}

// ========== 턴 시작 처리 ==========

export function onTurnStart(unit) {
  // 쿨다운 감소
  for (const skill of unit.skills) {
    if (skill.currentCooldown > 0) skill.currentCooldown--;
  }

  // 버프/디버프 지속시간 감소
  unit.buffs = (unit.buffs || []).filter(b => {
    b.duration--;
    return b.duration > 0;
  });
  unit.debuffs = (unit.debuffs || []).filter(b => {
    b.duration--;
    return b.duration > 0;
  });

  // 수호 해제 (매 턴 갱신)
  unit.isGuarding = false;
  unit.guardTarget = null;
}

// ========== AI 행동 결정 ==========

export function decideAIAction(unit, allUnits) {
  const allies = allUnits.filter(u => u.team === unit.team && u.hp > 0);
  const enemies = allUnits.filter(u => u.team !== unit.team && u.hp > 0);
  if (enemies.length === 0) return null;

  const attackType = (unit.rangeType === 'ranged' || unit.rangeType === 'magic') ? unit.rangeType : 'melee';
  const validTargets = getValidTargets(unit, enemies, attackType);

  // 스킬 사거리에 맞는 타겟 반환
  const getSkillTargets = (skill) => {
    const range = (skill.range_val || skill.range || 1);
    const skillType = range >= 2 ? 'ranged' : attackType;
    return getValidTargets(unit, enemies, skillType);
  };

  // 사용 가능한 스킬
  const usableSkills = unit.skills.filter(s =>
    s.currentCooldown <= 0 && (s.mp_cost || 0) <= unit.mp
  );

  // --- 긴급 치유 (모든 AI 타입 공통: 자신 HP < 25%일 때) ---
  if (unit.hp < unit.maxHp * 0.25) {
    const healSkill = usableSkills.find(s => s.type === 'heal');
    if (healSkill) return { action: 'skill', skill: healSkill, target: unit };
  }

  // --- 지원형 AI ---
  if (unit.aiType === 'support') {
    // 1) 치유 우선 (아군 HP < 50%)
    const healSkill = usableSkills.find(s => s.type === 'heal');
    const hurtAlly = allies.sort((a, b) => (a.hp / a.maxHp) - (b.hp / b.maxHp)).find(u => u.hp < u.maxHp * 0.5);
    if (healSkill && hurtAlly) {
      return { action: 'skill', skill: healSkill, target: hurtAlly };
    }
    // 2) 버프 (아군에게)
    const buffSkill = usableSkills.find(s => s.type === 'buff');
    if (buffSkill) {
      const buffTarget = allies.find(u => u.id !== unit.id && !u.buffs.some(b => b.stat === buffSkill.buff_stat)) || allies[0];
      if (buffTarget) return { action: 'skill', skill: buffSkill, target: buffTarget };
    }
    // 3) 디버프 (가장 강한 적에게)
    const debuffSkill = usableSkills.find(s => s.type === 'debuff');
    if (debuffSkill) {
      const debuffTarget = enemies.sort((a, b) => b.attack - a.attack).find(u => !u.debuffs.some(d => d.stat === debuffSkill.buff_stat));
      if (debuffTarget) return { action: 'skill', skill: debuffSkill, target: debuffTarget };
    }
  }

  // --- 방어형 AI: 수호 (HP < 50% 아군 보호) ---
  if (unit.aiType === 'defensive') {
    const weakAlly = allies.find(u => u.hp < u.maxHp * 0.5 && u.id !== unit.id);
    if (weakAlly && Math.random() < 0.6) {
      return { action: 'guard', target: weakAlly };
    }
    // 방어형도 버프 사용 가능
    const buffSkill = usableSkills.find(s => s.type === 'buff');
    if (buffSkill && Math.random() < 0.3) {
      const buffTarget = weakAlly || allies.find(u => u.id !== unit.id) || unit;
      return { action: 'skill', skill: buffSkill, target: buffTarget };
    }
  }

  // --- 보스 AI: HP 비율에 따른 전략 ---
  if (unit.aiType === 'boss') {
    const hpRatio = unit.hp / unit.maxHp;
    // HP < 30%: 힐 시도 (있으면)
    if (hpRatio < 0.3) {
      const healSkill = usableSkills.find(s => s.type === 'heal');
      if (healSkill) return { action: 'skill', skill: healSkill, target: unit };
    }
    // HP < 50%: 버프 시도 (40% 확률)
    if (hpRatio < 0.5 && Math.random() < 0.4) {
      const buffSkill = usableSkills.find(s => s.type === 'buff');
      if (buffSkill) return { action: 'skill', skill: buffSkill, target: unit };
    }
    // AOE 우선 (적 2명 이상)
    const aoeSkill = usableSkills.find(s => s.type === 'aoe');
    if (aoeSkill && enemies.length >= 2) {
      return { action: 'skill', skill: aoeSkill, target: enemies[0] };
    }
    // 디버프 (가장 강한 적, 30% 확률)
    const debuffSkill = usableSkills.find(s => s.type === 'debuff');
    if (debuffSkill && Math.random() < 0.3) {
      const debuffTarget = enemies.sort((a, b) => b.attack - a.attack)[0];
      if (debuffTarget) return { action: 'skill', skill: debuffSkill, target: debuffTarget };
    }
    // 공격 스킬 (가장 강한 스킬 선택)
    const atkSkills = usableSkills.filter(s => s.type === 'attack');
    if (atkSkills.length > 0 && validTargets.length > 0) {
      const bestSkill = atkSkills.sort((a, b) => (b.damage_multiplier || 1) - (a.damage_multiplier || 1))[0];
      const sTargets = getSkillTargets(bestSkill);
      const target = (sTargets.length > 0 ? sTargets : validTargets).reduce((a, b) => a.hp < b.hp ? a : b);
      return { action: 'skill', skill: bestSkill, target };
    }
  }

  // --- 겁쟁이 AI: HP 낮으면 치유/방어, 높으면 공격 ---
  if (unit.aiType === 'coward') {
    if (unit.hp < unit.maxHp * 0.4) {
      const healSkill = usableSkills.find(s => s.type === 'heal');
      if (healSkill) return { action: 'skill', skill: healSkill, target: unit };
      // 힐 없으면 가장 약한 적 공격
      if (validTargets.length > 0) {
        const weakest = validTargets.reduce((a, b) => a.hp < b.hp ? a : b);
        return { action: 'attack', target: weakest };
      }
    }
  }

  // --- 원거리 AI: 후열 우선 타겟 + 스킬 적극 사용 ---
  if (unit.aiType === 'ranged' && usableSkills.length > 0) {
    // AOE 우선
    const aoeSkill = usableSkills.find(s => s.type === 'aoe');
    if (aoeSkill && enemies.length >= 3) {
      return { action: 'skill', skill: aoeSkill, target: enemies[0] };
    }
    // 공격 스킬 (HP 낮은 적 우선)
    const atkSkills = usableSkills.filter(s => s.type === 'attack');
    if (atkSkills.length > 0) {
      const skill = atkSkills.sort((a, b) => (b.damage_multiplier || 1) - (a.damage_multiplier || 1))[0];
      const sTargets = getSkillTargets(skill);
      if (sTargets.length > 0) {
        const target = sTargets.reduce((a, b) => a.hp < b.hp ? a : b);
        return { action: 'skill', skill, target };
      }
    }
  }

  // --- 공통: 디버프/버프 사용 (30% 확률) ---
  if (usableSkills.length > 0 && Math.random() < 0.3) {
    const debuffSkill = usableSkills.find(s => s.type === 'debuff');
    if (debuffSkill) {
      const debuffTarget = enemies.find(u => !u.debuffs.some(d => d.stat === debuffSkill.buff_stat));
      if (debuffTarget) return { action: 'skill', skill: debuffSkill, target: debuffTarget };
    }
    const buffSkill = usableSkills.find(s => s.type === 'buff');
    if (buffSkill) {
      const buffTarget = allies.find(u => !u.buffs.some(b => b.stat === buffSkill.buff_stat)) || unit;
      return { action: 'skill', skill: buffSkill, target: buffTarget };
    }
  }

  // --- 공통: 스킬 공격 (50% 확률) ---
  if (usableSkills.length > 0 && Math.random() < 0.5) {
    const atkSkills = usableSkills.filter(s => s.type === 'attack' || s.type === 'aoe');
    if (atkSkills.length > 0) {
      const skill = atkSkills.sort((a, b) => (b.damage_multiplier || 1) - (a.damage_multiplier || 1))[0];
      if (skill.type === 'aoe') {
        return { action: 'skill', skill, target: enemies[0] };
      }
      const sTargets = getSkillTargets(skill);
      if (sTargets.length > 0) {
        const target = sTargets.reduce((a, b) => a.hp < b.hp ? a : b);
        return { action: 'skill', skill, target };
      }
    }
  }

  // --- 기본 공격 ---
  if (validTargets.length > 0) {
    const target = unit.aiType === 'aggressive'
      ? validTargets.reduce((a, b) => a.hp < b.hp ? a : b)
      : validTargets[Math.floor(Math.random() * validTargets.length)];
    return { action: 'attack', target };
  }

  return { action: 'wait' };
}

// ========== 전투 종료 체크 ==========

export function checkBattleEnd(allUnits) {
  const playerAlive = allUnits.filter(u => u.team === 'player' && u.hp > 0);
  const enemyAlive = allUnits.filter(u => u.team === 'enemy' && u.hp > 0);

  if (enemyAlive.length === 0) return 'victory';
  if (playerAlive.length === 0) return 'defeat';
  return null;
}

// ========== 보상 계산 ==========

export function calculateRewards(allUnits, stage) {
  const deadEnemies = allUnits.filter(u => u.team === 'enemy' && u.hp <= 0);
  let baseExp = deadEnemies.reduce((sum, u) => sum + (u.expReward || 10), 0);
  let baseGold = deadEnemies.reduce((sum, u) => sum + (u.goldReward || 5), 0);

  if (stage) {
    baseExp += stage.rewardExp || 0;
    baseGold += stage.rewardGold || 0;
  }

  return { exp: baseExp, gold: baseGold };
}
