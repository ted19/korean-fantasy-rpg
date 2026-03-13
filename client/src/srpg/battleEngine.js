// SRPG 전투 엔진 - 무기 타입별 공격범위, 지형 효과, 높이 보정
// eslint-disable-next-line no-unused-vars
import { TILE_TYPES } from './mapData';

// ========== 무기 타입 시스템 ==========
// 클래스별 무기 타입: 공격 범위/패턴 결정
const WEAPON_TYPES = {
  // 풍수사: 부적(talisman) → 마법 원거리, 지팡이(staff) → 광역
  talisman: { range: 3, pattern: 'diamond', label: '부적' },
  staff:    { range: 2, pattern: 'cross',   label: '지팡이' },
  // 무당: 방울(bell) → 원형 범위
  bell:     { range: 2, pattern: 'diamond', label: '방울' },
  // 승려: 목탁(mace) → 근접, 금강장(spear) → 직선
  mace:     { range: 1, pattern: 'diamond', label: '목탁' },
  spear:    { range: 3, pattern: 'line',    label: '창' },
  // 공용
  bow:      { range: 4, pattern: 'line',    label: '활' },
  sword:    { range: 1, pattern: 'diamond', label: '검' },
  dagger:   { range: 1, pattern: 'diamond', label: '단검' },
  default:  { range: 1, pattern: 'diamond', label: '맨손' },
};

// 무기 이름으로 무기 타입 판별
export function getWeaponType(weaponName) {
  if (!weaponName) return 'default';
  if (weaponName.includes('활') || weaponName.includes('궁')) return 'bow';
  if (weaponName.includes('지팡이') || weaponName.includes('장')) return 'staff';
  if (weaponName.includes('창') || weaponName.includes('금강장')) return 'spear';
  if (weaponName.includes('부적')) return 'talisman';
  if (weaponName.includes('방울')) return 'bell';
  if (weaponName.includes('목탁')) return 'mace';
  if (weaponName.includes('검') || weaponName.includes('도')) return 'sword';
  if (weaponName.includes('단검') || weaponName.includes('비수')) return 'dagger';
  return 'default';
}

export function getWeaponInfo(weaponType) {
  return WEAPON_TYPES[weaponType] || WEAPON_TYPES.default;
}

// ========== 지형 효과 ==========
const TERRAIN_EFFECTS = {
  grass:  { moveCost: 1, defBonus: 0,  evasion: 0,   label: '초원' },
  dirt:   { moveCost: 1, defBonus: 0,  evasion: 0,   label: '흙길' },
  stone:  { moveCost: 1, defBonus: 2,  evasion: 0,   label: '돌바닥 (방어+2)' },
  water:  { moveCost: 3, defBonus: -2, evasion: 0,   label: '물 (이동력↓, 방어-2)' },
  dark:   { moveCost: 1, defBonus: 0,  evasion: 5,   label: '어둠 (회피+5%)' },
};

// tileKey 기반 지형 효과 (타워맵 생성기 호환)
const TILE_KEY_TERRAIN = {
  floor:   'grass',
  wall:    'wall',    // 이동 불가
  water:   'water',
  danger:  'water',
  special: 'dark',
  accent1: 'grass',
  accent2: 'dirt',
  ice:     'water',
  poison:  'dirt',
  holy:    'grass',
  thorns:  'dirt',
  wind:    'grass',
  lava:    'water',
  shadow:  'dark',
  crystal: 'dirt',
};

// tileKey 기반 턴 시작 효과 (타워맵 장애물 시스템)
const TILE_TURN_EFFECTS = {
  water:   { type: 'buff', stat: 'magAttack', value: 3, label: '물 속성 강화', icon: '💧' },
  danger:  { type: 'damage', percent: 8, label: '위험 지형 피해', icon: '🔥' },
  special: { type: 'heal', percent: 10, label: '룬의 축복', icon: '✦' },
  accent2: { type: 'buff', stat: 'defense', value: 3, label: '땅 속성 강화', icon: '🪨' },
  ice:     { type: 'debuff', stat: 'evasion', value: -5, label: '빙결 지형', icon: '🧊' },
  poison:  { type: 'damage', percent: 5, label: '독 지형 피해', icon: '☠️' },
  holy:    { type: 'heal', percent: 6, label: '신성한 땅', icon: '🕊️' },
  thorns:  { type: 'damage', percent: 4, label: '가시덤불 피해', icon: '🌿' },
  wind:    { type: 'buff', stat: 'evasion', value: 5, label: '바람 속성 강화', icon: '🌀' },
  lava:    { type: 'damage', percent: 12, label: '용암 피해', icon: '🌋' },
  shadow:  { type: 'buff', stat: 'critRate', value: 5, label: '그림자 은신', icon: '🌑' },
  crystal: { type: 'buff', stat: 'magDefense', value: 4, label: '수정 보호막', icon: '💎' },
};

/**
 * tileKey 기반 턴 시작 지형 효과 반환
 * @param {string} tileKey - 타일키 (floor, wall, water, danger, special, accent1, accent2)
 * @returns {object|null} 효과 객체 또는 null
 */
export function getTileTurnEffect(tileKey) {
  return TILE_TURN_EFFECTS[tileKey] || null;
}

export function getTerrainEffect(tileType) {
  // 직접 매칭
  if (TERRAIN_EFFECTS[tileType]) return TERRAIN_EFFECTS[tileType];
  // tileKey 직접 매칭
  if (TILE_KEY_TERRAIN[tileType]) {
    const mapped = TILE_KEY_TERRAIN[tileType];
    if (mapped === 'wall') return { moveCost: 99, defBonus: 4, evasion: 0, label: '장애물 (이동 불가)' };
    if (TERRAIN_EFFECTS[mapped]) return TERRAIN_EFFECTS[mapped];
  }
  // tileKey 매칭 (타워맵 테마 타일: cave_floor, goblin_grass 등)
  if (tileType && tileType.includes('_')) {
    const suffix = tileType.split('_').pop();
    // wall 키워드: 벽/절벽/나무/뼈/기둥 → 이동불가
    if (['wall', 'cliff', 'tree', 'bone', 'pillar', 'rock'].some(k => tileType.includes(k))) {
      return { moveCost: 99, defBonus: 4, evasion: 0, label: '장애물' };
    }
    // water/lava/abyss/deep/void → 위험 지형
    if (['water', 'lava', 'abyss', 'deep', 'void', 'mud'].some(k => tileType.includes(k))) {
      return TERRAIN_EFFECTS.water;
    }
    // 특수: crystal, altar, treasure, camp, peak, throne, nest → 어둠(회피)
    if (['crystal', 'altar', 'treasure', 'camp', 'peak', 'throne', 'nest', 'portal', 'special'].some(k => tileType.includes(k))) {
      return TERRAIN_EFFECTS.dark;
    }
    // snow, ice → 돌(방어)
    if (['snow', 'ice'].some(k => tileType.includes(k))) {
      return TERRAIN_EFFECTS.stone;
    }
    // fire, danger → 위험
    if (['fire', 'danger', 'poison', 'blood', 'shadow'].some(k => tileType.includes(k))) {
      return { moveCost: 2, defBonus: -1, evasion: 0, label: '위험 지형' };
    }
  }
  return TERRAIN_EFFECTS.grass;
}

// ========== 유닛 생성 ==========
export function createPlayerUnit(char, skills, spawnPos, equippedWeapon, passiveBonuses) {
  const weaponType = getWeaponType(equippedWeapon?.name);
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
    physAttack: applyBonus(char.phys_attack || 0, 'phys_attack'),
    physDefense: applyBonus(char.phys_defense || 0, 'phys_defense'),
    magAttack: applyBonus(char.mag_attack || 0, 'mag_attack'),
    magDefense: applyBonus(char.mag_defense || 0, 'mag_defense'),
    critRate: applyBonus(char.crit_rate || 5, 'crit_rate'),
    evasion: applyBonus(char.evasion || 3, 'evasion'),
    move: 4,
    skills: (skills || []).map(s => ({ ...s, iconUrl: `/skills/${s.id}_icon.png` })),
    x: spawnPos.x,
    z: spawnPos.z,
    acted: false,
    moved: false,
    icon: { '풍수사': '🧙', '무당': '🔮', '승려': '📿', '저승사자': '💀' }[char.class_type] || '📿',
    imageUrl: `/characters/${{ '풍수사': 'pungsu', '무당': 'mudang', '승려': 'monk', '저승사자': 'reaper' }[char.class_type] || 'monk'}_icon.png`,
    color: '#4fc3f7',
    weaponType,
    weaponName: equippedWeapon?.name || null,
    element: char.element || 'neutral',
  };
}

export function createSummonUnit(summon, spawnPos) {
  const skills = summon.learned_skills || summon.skills || [];
  return {
    id: `summon_${summon.id}`,
    summonId: summon.id,
    name: summon.name,
    team: 'player',
    classType: 'summon',
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
    move: 3,
    skills: skills.map(s => ({ ...s, iconUrl: `/summon_skills/${s.id}_icon.png` })),
    x: spawnPos.x,
    z: spawnPos.z,
    acted: false,
    moved: false,
    icon: summon.icon || '👻',
    imageUrl: `/summons_nobg/${summon.template_id}_full.png`,
    color: '#81c784',
    weaponType: 'default',
    weaponName: null,
    element: summon.element || 'neutral',
  };
}

export function createMercenaryUnit(merc, spawnPos) {
  const weaponType = merc.weapon_type || merc.weaponType || 'default';
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
    move: 3,
    skills: (merc.learned_skills || merc.skills || []).map(s => ({ ...s, currentCooldown: 0, iconUrl: `/merc_skills/${s.id}_icon.png` })),
    x: spawnPos.x,
    z: spawnPos.z,
    acted: false,
    moved: false,
    icon: '🗡️',
    imageUrl: `/mercenaries/${merc.template_id}_full.png`,
    color: '#ffb347',
    weaponType,
    weaponName: null,
    element: merc.element || 'neutral',
  };
}

export function createMonsterUnit(monster, spawnPos, index) {
  return {
    id: `monster_${index}`,
    monsterId: monster.monsterId || null,
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
    move: monster.move || 3,
    skills: monster.skills || [],
    x: spawnPos.x,
    z: spawnPos.z,
    acted: false,
    moved: false,
    icon: monster.icon || '👹',
    color: '#ef5350',
    expReward: monster.exp || 0,
    goldReward: monster.gold || 0,
    weaponType: monster.weaponType || 'default',
    weaponName: null,
    aiType: monster.aiType || 'aggressive',
    skillCooldowns: {},
    element: monster.element || 'neutral',
    eliteTier: monster.eliteTier || null,
  };
}

// ========== 타일 유틸 ==========
function getTileAt(mapData, x, z) {
  return mapData.tiles.find(t => t.x === x && t.z === z);
}

// ========== 이동 범위 (물 = 이동력 소모 증가, 진입 가능) ==========
export function getMovementRange(unit, mapData, allUnits) {
  const range = [];
  const visited = new Map(); // key -> best cost
  const queue = [{ x: unit.x, z: unit.z, cost: 0 }];
  visited.set(`${unit.x},${unit.z}`, 0);

  const maxHeightDiff = 1;

  while (queue.length > 0) {
    // 비용 낮은 순 정렬 (간이 Dijkstra)
    queue.sort((a, b) => a.cost - b.cost);
    const { x, z, cost } = queue.shift();
    const currentTile = getTileAt(mapData, x, z);

    if (cost > 0) {
      const occupant = allUnits.find(u => u.x === x && u.z === z && u.hp > 0 && u.id !== unit.id);
      if (!occupant) {
        range.push({ x, z, cost });
      }
      if (occupant && occupant.team !== unit.team) continue;
    }

    if (cost >= unit.move) continue;

    const dirs = [
      { dx: 1, dz: 0 }, { dx: -1, dz: 0 },
      { dx: 0, dz: 1 }, { dx: 0, dz: -1 },
    ];

    for (const { dx, dz } of dirs) {
      const nx = x + dx;
      const nz = z + dz;
      if (nx < 0 || nx >= mapData.width || nz < 0 || nz >= mapData.height) continue;

      const nextTile = getTileAt(mapData, nx, nz);
      if (!nextTile) continue;

      const heightDiff = Math.abs(nextTile.height - currentTile.height);
      if (heightDiff > maxHeightDiff) continue;

      // 지형별 이동 비용 (tileKey 우선, type fallback)
      const terrain = getTerrainEffect(nextTile.tileKey || nextTile.type);
      const moveCost = terrain.moveCost;
      const newCost = cost + moveCost;

      if (newCost > unit.move) continue;

      const key = `${nx},${nz}`;
      const prevCost = visited.get(key);
      if (prevCost !== undefined && prevCost <= newCost) continue;

      visited.set(key, newCost);
      queue.push({ x: nx, z: nz, cost: newCost });
    }
  }

  return range;
}

// ========== 공격 범위 (무기 패턴별) ==========
export function getAttackRange(unit, mapData, skillRange = null, weaponOverride = null) {
  const wType = weaponOverride || unit.weaponType || 'default';
  const wInfo = getWeaponInfo(wType);
  const range = skillRange !== null ? skillRange : wInfo.range;
  const pattern = skillRange !== null ? 'diamond' : wInfo.pattern;

  const results = [];

  if (pattern === 'line') {
    // 직선 4방향
    const dirs = [
      { dx: 1, dz: 0 }, { dx: -1, dz: 0 },
      { dx: 0, dz: 1 }, { dx: 0, dz: -1 },
    ];
    for (const { dx, dz } of dirs) {
      for (let i = 1; i <= range; i++) {
        const nx = unit.x + dx * i;
        const nz = unit.z + dz * i;
        if (nx < 0 || nx >= mapData.width || nz < 0 || nz >= mapData.height) break;
        const tile = getTileAt(mapData, nx, nz);
        if (!tile) break;
        results.push({ x: nx, z: nz });
        // 직선은 장애물(높이차 2 이상)에서 끊김
        const myTile = getTileAt(mapData, unit.x, unit.z);
        if (myTile && Math.abs(tile.height - myTile.height) >= 3) break;
      }
    }
  } else if (pattern === 'cross') {
    // 십자 범위 (4방향 + 대각선은 제외)
    const dirs = [
      { dx: 1, dz: 0 }, { dx: -1, dz: 0 },
      { dx: 0, dz: 1 }, { dx: 0, dz: -1 },
    ];
    for (const { dx, dz } of dirs) {
      for (let i = 1; i <= range; i++) {
        const nx = unit.x + dx * i;
        const nz = unit.z + dz * i;
        if (nx < 0 || nx >= mapData.width || nz < 0 || nz >= mapData.height) break;
        const tile = getTileAt(mapData, nx, nz);
        if (!tile) break;
        results.push({ x: nx, z: nz });
      }
    }
    // 추가로 바로 인접 대각선도 포함
    if (range >= 2) {
      const diags = [
        { dx: 1, dz: 1 }, { dx: -1, dz: 1 },
        { dx: 1, dz: -1 }, { dx: -1, dz: -1 },
      ];
      for (const { dx, dz } of diags) {
        const nx = unit.x + dx;
        const nz = unit.z + dz;
        if (nx < 0 || nx >= mapData.width || nz < 0 || nz >= mapData.height) continue;
        const tile = getTileAt(mapData, nx, nz);
        if (tile) results.push({ x: nx, z: nz });
      }
    }
  } else {
    // diamond (마름모) - 기본
    for (let dx = -range; dx <= range; dx++) {
      for (let dz = -range; dz <= range; dz++) {
        if (dx === 0 && dz === 0) continue;
        if (Math.abs(dx) + Math.abs(dz) > range) continue;
        const nx = unit.x + dx;
        const nz = unit.z + dz;
        if (nx < 0 || nx >= mapData.width || nz < 0 || nz >= mapData.height) continue;
        const tile = getTileAt(mapData, nx, nz);
        if (tile) results.push({ x: nx, z: nz });
      }
    }
  }

  return results;
}

// 스킬 사거리
export function getSkillRange(skill) {
  if (!skill) return null; // null = 무기 기본 범위 사용
  if (skill.type === 'heal') return skill.skill_range || skill.range_val || 3;
  if (skill.type === 'buff') return 0;
  // skill_range (스킬트리) / range_val (몬스터스킬) 우선
  if (skill.skill_range) return skill.skill_range;
  if (skill.range_val) return skill.range_val;
  if (skill.damage_multiplier >= 2.0) return 2;
  return 1;
}

// AoE 스킬의 영향 범위 타일 (대상 타일 중심)
export function getAoeTiles(centerX, centerZ, radius, mapData) {
  const tiles = [{ x: centerX, z: centerZ }];
  for (let dx = -radius; dx <= radius; dx++) {
    for (let dz = -radius; dz <= radius; dz++) {
      if (dx === 0 && dz === 0) continue;
      if (Math.abs(dx) + Math.abs(dz) > radius) continue;
      const nx = centerX + dx;
      const nz = centerZ + dz;
      if (nx < 0 || nx >= mapData.width || nz < 0 || nz >= mapData.height) continue;
      const tile = getTileAt(mapData, nx, nz);
      if (tile) tiles.push({ x: nx, z: nz });
    }
  }
  return tiles;
}

// ========== 높이차 데미지 보정 ==========
function getHeightBonus(attackerTile, defenderTile) {
  if (!attackerTile || !defenderTile) return { mult: 1.0, label: '' };
  const diff = attackerTile.height - defenderTile.height;
  if (diff >= 3) return { mult: 1.4, label: '높이↑↑ +40%' };
  if (diff >= 2) return { mult: 1.25, label: '높이↑ +25%' };
  if (diff >= 1) return { mult: 1.1, label: '높이↑ +10%' };
  if (diff <= -3) return { mult: 0.7, label: '높이↓↓ -30%' };
  if (diff <= -2) return { mult: 0.8, label: '높이↓ -20%' };
  if (diff <= -1) return { mult: 0.92, label: '높이↓ -8%' };
  return { mult: 1.0, label: '' };
}

// ========== 데미지 계산 (높이 + 지형 효과 포함) ==========
export function calcDamage(attacker, defender, skill = null, mapData = null) {
  // 스킬의 물리/마법 판정: damage_type 우선, 없으면 공격자 스탯 비교
  const isSkill = skill && skill.type === 'attack';
  let isMagic = false;
  if (isSkill) {
    if (skill.damage_type === 'magical' || skill.damage_type === 'magic') {
      isMagic = true;
    } else if (skill.damage_type === 'physical') {
      isMagic = false;
    } else {
      isMagic = (attacker.magAttack || 0) > (attacker.physAttack || 0);
    }
  }

  // 공격력 계산 (물리 또는 마법)
  let atkStat;
  let defStat;
  if (isMagic) {
    atkStat = (attacker.magAttack ?? 0) || Math.floor((attacker.attack || 0) * 0.5);
    defStat = (defender.magDefense ?? 0) || Math.floor((defender.defense || 0) * 0.4);
  } else {
    atkStat = (attacker.physAttack ?? 0) || attacker.attack || 0;
    defStat = (defender.physDefense ?? 0) || Math.floor((defender.defense || 0) * 0.7);
  }

  let base = atkStat;
  if (isSkill) {
    base = Math.floor(base * skill.damage_multiplier);
  }

  // 방어측 지형 효과
  let terrainDef = 0;
  let terrainEvasion = 0;
  if (mapData) {
    const defTile = getTileAt(mapData, defender.x, defender.z);
    if (defTile) {
      const terrain = getTerrainEffect(defTile.type);
      terrainDef = terrain.defBonus;
      terrainEvasion = terrain.evasion;
    }
  }

  const def = defStat + terrainDef;
  const variance = Math.floor(Math.random() * 5) - 2;
  let dmg = Math.max(1, Math.floor(base * (100 / (100 + def * 1.2))) + variance);

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
    dmg = Math.max(1, Math.floor(dmg * elementMult));
  }

  // 높이 보정
  let heightInfo = { mult: 1.0, label: '' };
  if (mapData) {
    const atkTile = getTileAt(mapData, attacker.x, attacker.z);
    const defTile = getTileAt(mapData, defender.x, defender.z);
    heightInfo = getHeightBonus(atkTile, defTile);
    dmg = Math.max(1, Math.floor(dmg * heightInfo.mult));
  }

  // 치명타 판정
  let isCrit = false;
  const critChance = attacker.critRate || 5;
  if (Math.random() * 100 < critChance) {
    isCrit = true;
    const critMultiplier = 1.4 + Math.min(critChance, 30) * 0.01;
    dmg = Math.floor(dmg * critMultiplier);
  }

  // 회피 판정 (유닛 회피율 + 지형 회피)
  let evaded = false;
  const totalEvasion = (defender.evasion || 0) + terrainEvasion;
  if (totalEvasion > 0 && Math.random() * 100 < totalEvasion) {
    evaded = true;
    dmg = 0;
    isCrit = false;
  }

  return { damage: dmg, heightInfo, evaded, terrainDef, isCrit, isMagic, elementMult, elementLabel };
}

// 회복량 계산
export function calcHeal(healer, skill) {
  if (!skill || skill.type !== 'heal') return 0;
  return skill.heal_amount || 30;
}

// ========== 턴 순서 ==========
export function determineTurnOrder(units) {
  const alive = units.filter(u => u.hp > 0);
  const totalAtk = u => (u.physAttack || 0) + (u.magAttack || 0);
  const playerUnits = alive.filter(u => u.team === 'player').sort((a, b) => totalAtk(b) - totalAtk(a));
  const enemyUnits = alive.filter(u => u.team === 'enemy').sort((a, b) => totalAtk(b) - totalAtk(a));

  const order = [];
  const maxLen = Math.max(playerUnits.length, enemyUnits.length);
  for (let i = 0; i < maxLen; i++) {
    if (i < playerUnits.length) order.push(playerUnits[i]);
    if (i < enemyUnits.length) order.push(enemyUnits[i]);
  }
  return order;
}

// ========== 유틸: 거리 계산 ==========
function manhattan(a, b) {
  return Math.abs(a.x - b.x) + Math.abs(a.z - b.z);
}

// 위협 점수: 이 유닛이 적에게 주는 위험도
function threatScore(target, unit) {
  // 낮은 HP일수록 처치 가능성 높음 + 높은 공격력일수록 위협
  const hpRatio = target.hp / target.maxHp;
  const canKill = target.hp <= unit.attack * 1.5 ? 2.0 : 0;
  return (1 - hpRatio) * 3 + (target.attack / 30) + canKill;
}

// 지형 점수: 이 위치의 전략적 가치
function positionScore(pos, mapData, target, atkRange) {
  let score = 0;
  const tile = mapData.tiles.find(t => t.x === pos.x && t.z === pos.z);
  if (!tile) return -100;

  // 높이 보너스 (높은 곳이 유리)
  score += tile.height * 2;

  // 돌바닥 방어 보너스
  const terrain = getTerrainEffect(tile.type);
  score += terrain.defBonus;
  score += terrain.evasion * 0.5;

  // 물/위험 타일 페널티
  if (tile.type === 'water' || (terrain.moveCost >= 3)) score -= 3;
  // 벽 타일 절대 비선호
  if (terrain.moveCost >= 99) score -= 100;

  // 공격 사거리에 적이 있으면 가산
  const dist = manhattan(pos, target);
  if (dist <= atkRange) score += 5;

  return score;
}

// 스킬 선택: 현재 상황에 맞는 최적 스킬 결정
function selectSkill(unit, allies, enemies, mapData) {
  if (!unit.skills || unit.skills.length === 0) return null;

  const hpRatio = unit.hp / unit.maxHp;
  const availableSkills = unit.skills.filter(s => {
    if (s.mp_cost > unit.mp) return false;
    if (unit.skillCooldowns && unit.skillCooldowns[s.id] > 0) return false;
    return true;
  });

  if (availableSkills.length === 0) return null;

  // 우선순위 결정
  const scored = availableSkills.map(skill => {
    let priority = 0;

    if (skill.type === 'heal') {
      // 아군이 위험할 때 힐
      const woundedAlly = allies.find(a => a.maxHp > 0 && a.hp / a.maxHp < 0.4);
      if (woundedAlly) priority = 80 + (1 - woundedAlly.hp / woundedAlly.maxHp) * 20;
      // 자신이 위험할 때 자힐
      if (hpRatio < 0.35) priority = 90;
    } else if (skill.type === 'buff') {
      if (allies.length >= 2) priority = 40;
      if (skill.buff_stat === 'defense' && hpRatio < 0.5) priority = 55;
      if (skill.buff_stat === 'attack' && enemies.length >= 2) priority = 50;
    } else if (skill.type === 'debuff') {
      const strongEnemy = enemies.find(e => e.attack >= unit.defense * 1.5);
      if (strongEnemy) priority = 60;
    } else if (skill.type === 'aoe') {
      // 근처에 적이 2명 이상이면 광역
      const nearEnemies = enemies.filter(e => manhattan(e, unit) <= (skill.range || 2));
      if (nearEnemies.length >= 2) priority = 75;
      else priority = 30;
    } else if (skill.type === 'attack') {
      priority = 50 + (skill.damage_multiplier - 1.0) * 30;
      // 자폭은 체력 낮을 때만
      if (skill.name === '자폭') {
        priority = hpRatio < 0.2 ? 95 : 0;
      }
      // 생명력 흡수: HP 낮을 때 우선
      if (skill.heal_amount > 0 && hpRatio < 0.5) priority += 20;
    }

    return { skill, priority };
  });

  scored.sort((a, b) => b.priority - a.priority);
  // 약간의 랜덤성 (상위 2개 중 택1)
  if (scored.length >= 2 && scored[1].priority > scored[0].priority * 0.7) {
    return Math.random() < 0.3 ? scored[1].skill : scored[0].skill;
  }
  return scored[0]?.priority > 20 ? scored[0].skill : null;
}

// ========== AI 타입별 행동 결정 ==========
// 근거리 유닛이 실제 공격 가능한 적 목록 (이동 후 사거리 내 도달 가능한 적만)
function getReachableEnemies(candidates, enemies, atkRange) {
  return enemies.filter(enemy =>
    candidates.some(pos => manhattan(pos, enemy) <= atkRange)
  );
}

export function aiDecide(unit, mapData, allUnits) {
  const enemies = allUnits.filter(u => u.team !== unit.team && u.hp > 0);
  const allies = allUnits.filter(u => u.team === unit.team && u.hp > 0 && u.id !== unit.id);
  if (enemies.length === 0) return null;

  const aiType = unit.aiType || 'aggressive';
  const hpRatio = unit.hp / unit.maxHp;
  const wInfo = getWeaponInfo(unit.weaponType || 'default');
  const atkRange = wInfo.range;
  const moveRange = getMovementRange(unit, mapData, allUnits);
  const candidates = [{ x: unit.x, z: unit.z }, ...moveRange];

  // 공통: 적 정렬 (가까운 순, 위협 순)
  const sortedByDist = [...enemies].sort((a, b) => manhattan(a, unit) - manhattan(b, unit));
  const sortedByThreat = [...enemies].sort((a, b) => threatScore(b, unit) - threatScore(a, unit));

  // 근거리 유닛(range 1): 실제 도달 가능한 적만 우선 타겟
  const reachable = atkRange <= 1 ? getReachableEnemies(candidates, enemies, atkRange) : enemies;
  const reachByDist = [...reachable].sort((a, b) => manhattan(a, unit) - manhattan(b, unit));
  const reachByThreat = [...reachable].sort((a, b) => threatScore(b, unit) - threatScore(a, unit));

  // 스킬 선택
  const chosenSkill = selectSkill(unit, allies, enemies, mapData);
  const effectiveRange = chosenSkill && chosenSkill.range ? Math.max(chosenSkill.range, atkRange) : atkRange;

  let target = null;
  let moveTarget = null;

  // ===== AI 타입별 전략 =====
  if (aiType === 'coward') {
    // 겁쟁이: HP 50% 이상이면 가까운 적 공격, 이하면 도망
    if (hpRatio > 0.5) {
      target = reachByDist[0] || sortedByDist[0];
      moveTarget = findAttackPosition(candidates, target, effectiveRange, mapData);
    } else {
      // 적에게서 가장 먼 위치로 이동
      const nearestEnemy = sortedByDist[0];
      let maxDist = -1;
      for (const pos of candidates) {
        const dist = manhattan(pos, nearestEnemy);
        if (dist > maxDist) {
          maxDist = dist;
          moveTarget = pos;
        }
      }
      target = null;
    }
  } else if (aiType === 'defensive') {
    // 방어형: 자리 고수, 접근한 적만 반격, 방어 버프 우선
    const nearbyEnemy = reachByDist.find(e => manhattan(e, unit) <= effectiveRange + unit.move);
    target = nearbyEnemy || reachByDist[0] || sortedByDist[0];

    if (nearbyEnemy && manhattan(nearbyEnemy, unit) <= effectiveRange) {
      // 이미 사거리 안 → 이동 안 함
      moveTarget = null;
    } else if (nearbyEnemy) {
      // 적이 접근 중 → 높은 지형 위치로 제한 이동
      moveTarget = findDefensivePosition(candidates, target, effectiveRange, mapData);
    }
    // 방어 버프 스킬 우선
    if (chosenSkill && chosenSkill.type === 'buff' && chosenSkill.buff_stat === 'defense') {
      return { target, moveTarget, canAttack: false, skill: chosenSkill, action: 'buff' };
    }
  } else if (aiType === 'ranged') {
    // 원거리: 최대 사거리 유지하며 공격, 적 접근시 후퇴
    target = reachByThreat[0] || sortedByThreat[0];
    const distToTarget = manhattan(unit, target);

    if (distToTarget <= 1 && unit.move >= 2) {
      // 적이 너무 가까움 → 후퇴하면서 공격 가능한 위치 찾기
      moveTarget = findKitingPosition(candidates, target, effectiveRange, mapData);
    } else {
      // 최대 사거리에서 공격 가능한 위치
      moveTarget = findRangedPosition(candidates, target, effectiveRange, mapData);
    }
  } else if (aiType === 'support') {
    // 지원형: 아군 힐/버프 우선, 위험하면 후퇴
    const woundedAlly = allies.find(a => a.hp / a.maxHp < 0.5);
    if (woundedAlly && chosenSkill && (chosenSkill.type === 'heal')) {
      // 힐 대상에게 접근
      const healRange = chosenSkill.range || 3;
      moveTarget = findApproachPosition(candidates, woundedAlly, healRange);
      const finalDist = moveTarget ? manhattan(moveTarget, woundedAlly) : manhattan(unit, woundedAlly);
      if (finalDist <= healRange) {
        return {
          target: woundedAlly,
          moveTarget: moveTarget && !(moveTarget.x === unit.x && moveTarget.z === unit.z) ? moveTarget : null,
          canAttack: false,
          skill: chosenSkill,
          action: 'heal',
        };
      }
    }
    // 버프 (아군에게)
    if (chosenSkill && chosenSkill.type === 'buff') {
      const buffTarget = allies.find(a => a.id !== unit.id) || unit;
      return { target: buffTarget, moveTarget: null, canAttack: false, skill: chosenSkill, action: 'buff' };
    }
    // 디버프 (가장 위협적인 적에게)
    if (chosenSkill && chosenSkill.type === 'debuff') {
      const debuffTarget = reachByThreat[0] || sortedByThreat[0];
      if (debuffTarget) {
        const debuffRange = chosenSkill.range || 3;
        const debuffPos = findApproachPosition(candidates, debuffTarget, debuffRange);
        const dist = debuffPos ? manhattan(debuffPos, debuffTarget) : manhattan(unit, debuffTarget);
        if (dist <= debuffRange) {
          return {
            target: debuffTarget,
            moveTarget: debuffPos && !(debuffPos.x === unit.x && debuffPos.z === unit.z) ? debuffPos : null,
            canAttack: true, skill: chosenSkill, action: 'skill',
          };
        }
      }
    }
    // 공격 폴백
    target = reachByDist[0] || sortedByDist[0];
    moveTarget = findAttackPosition(candidates, target, effectiveRange, mapData);
  } else if (aiType === 'boss') {
    // 보스: 스킬 적극 활용 + 페이즈 전환
    // Phase 1 (HP>50%): 공격적
    // Phase 2 (HP<=50%): 힐/버프 간헐적 사용 + 공격 병행
    target = reachByThreat[0] || sortedByThreat[0];
    moveTarget = findAttackPosition(candidates, target, effectiveRange, mapData);
    if (hpRatio <= 0.5) {
      // HP < 30%: 힐 우선 (있으면)
      if (hpRatio < 0.3 && chosenSkill && chosenSkill.type === 'heal') {
        return { target: unit, moveTarget: null, canAttack: false, skill: chosenSkill, action: 'heal' };
      }
      // 40% 확률로 버프/힐 사용 (공격과 병행)
      if (Math.random() < 0.4) {
        if (chosenSkill && chosenSkill.type === 'heal') {
          return { target: unit, moveTarget: null, canAttack: false, skill: chosenSkill, action: 'heal' };
        }
        if (chosenSkill && chosenSkill.type === 'buff') {
          return { target: unit, moveTarget: null, canAttack: false, skill: chosenSkill, action: 'buff' };
        }
      }
      // 나머지 60%는 공격 (moveTarget 유지)
    }
  } else {
    // aggressive (기본): 도달 가능한 적 중 가장 위협적인 적에게 돌진
    target = reachByThreat[0] || sortedByThreat[0];
    moveTarget = findAttackPosition(candidates, target, effectiveRange, mapData);
  }

  if (!target) target = sortedByDist[0];

  // 최종 공격 가능 판정
  const finalPos = moveTarget || { x: unit.x, z: unit.z };
  const finalDist = manhattan(finalPos, target);
  const canAttack = target.team !== unit.team && finalDist <= effectiveRange;

  // moveTarget이 현재 위치와 같으면 null
  if (moveTarget && moveTarget.x === unit.x && moveTarget.z === unit.z) {
    moveTarget = null;
  }

  return {
    target,
    moveTarget,
    canAttack,
    skill: canAttack ? chosenSkill : null,
    action: canAttack ? (chosenSkill ? 'skill' : 'attack') : 'move',
  };
}

// ===== 이동 위치 탐색 헬퍼 =====

// 공격 가능한 최적 위치 (지형 점수 포함)
function findAttackPosition(candidates, target, atkRange, mapData) {
  let bestPos = null;
  let bestScore = -Infinity;
  let bestApproach = null;
  let bestApproachDist = Infinity;

  for (const pos of candidates) {
    const dist = manhattan(pos, target);
    if (dist <= atkRange) {
      const score = positionScore(pos, mapData, target, atkRange);
      if (score > bestScore) {
        bestScore = score;
        bestPos = pos;
      }
    }
    if (dist < bestApproachDist) {
      bestApproachDist = dist;
      bestApproach = pos;
    }
  }
  return bestPos || bestApproach;
}

// 방어형 위치 (높은 지형 + 사거리 유지)
function findDefensivePosition(candidates, target, atkRange, mapData) {
  let bestPos = null;
  let bestScore = -Infinity;

  for (const pos of candidates) {
    const dist = manhattan(pos, target);
    const tile = mapData.tiles.find(t => t.x === pos.x && t.z === pos.z);
    if (!tile) continue;

    let score = tile.height * 4; // 높이 가중치 높음
    const terrain = getTerrainEffect(tile.type);
    score += terrain.defBonus * 2;
    if (dist <= atkRange) score += 3;
    if (tile.type === 'stone' || terrain.defBonus >= 2) score += 2;
    if (terrain.moveCost >= 99) score -= 100;

    if (score > bestScore) {
      bestScore = score;
      bestPos = pos;
    }
  }
  return bestPos;
}

// 카이팅 위치 (후퇴하면서 공격 범위 유지)
function findKitingPosition(candidates, target, atkRange, mapData) {
  let bestPos = null;
  let bestScore = -Infinity;

  for (const pos of candidates) {
    const dist = manhattan(pos, target);
    if (dist < 2) continue; // 너무 가까운 곳 제외

    let score = 0;
    if (dist <= atkRange) score += 10; // 공격 가능하면 큰 보너스
    score += dist * 2; // 멀수록 좋음 (안전)
    score += positionScore(pos, mapData, target, atkRange);

    if (score > bestScore) {
      bestScore = score;
      bestPos = pos;
    }
  }
  return bestPos;
}

// 원거리 포지션 (최대 사거리에서 공격)
function findRangedPosition(candidates, target, atkRange, mapData) {
  let bestPos = null;
  let bestScore = -Infinity;

  for (const pos of candidates) {
    const dist = manhattan(pos, target);
    let score = 0;

    if (dist <= atkRange && dist >= Math.max(1, atkRange - 1)) {
      score += 15; // 최대 사거리 근처가 이상적
    } else if (dist <= atkRange) {
      score += 8;
    }
    score += positionScore(pos, mapData, target, atkRange);

    if (score > bestScore) {
      bestScore = score;
      bestPos = pos;
    }
  }

  // 공격 불가 위치밖에 없으면 가장 가까운 곳으로
  if (!bestPos || bestScore <= 0) {
    let closestDist = Infinity;
    for (const pos of candidates) {
      const dist = manhattan(pos, target);
      if (dist < closestDist) {
        closestDist = dist;
        bestPos = pos;
      }
    }
  }
  return bestPos;
}

// 접근 위치 (대상에게 특정 범위 내로)
function findApproachPosition(candidates, target, range) {
  let bestPos = null;
  let bestDist = Infinity;

  for (const pos of candidates) {
    const dist = manhattan(pos, target);
    if (dist <= range && dist < bestDist) {
      bestDist = dist;
      bestPos = pos;
    }
  }

  // 범위 안에 도달 못하면 가장 가까운 곳
  if (!bestPos) {
    for (const pos of candidates) {
      const dist = manhattan(pos, target);
      if (dist < bestDist) {
        bestDist = dist;
        bestPos = pos;
      }
    }
  }
  return bestPos;
}

// ========== 협공 (Joint Attack) ==========
/**
 * 공격 대상 주변에 인접한 아군 유닛 목록을 반환 (공격자 제외, 행동 가능 여부 불문)
 * 협공 데미지 = 각 아군 공격력의 30%
 */
export function getJointAttackAllies(attacker, target, allUnits) {
  const allies = allUnits.filter(u =>
    u.id !== attacker.id &&
    u.team === attacker.team &&
    u.hp > 0 &&
    manhattan(u, target) <= 1
  );
  return allies;
}

/**
 * 협공 데미지 계산 (아군 공격력의 30%)
 */
export function calcJointDamage(ally, defender, mapData) {
  const isMagic = (ally.magAttack || 0) > (ally.physAttack || 0);
  const atkStat = isMagic
    ? ((ally.magAttack ?? 0) || Math.floor((ally.attack || 0) * 0.5))
    : ((ally.physAttack ?? 0) || ally.attack || 0);
  const defStat = isMagic
    ? ((defender.magDefense ?? 0) || Math.floor((defender.defense || 0) * 0.4))
    : ((defender.physDefense ?? 0) || Math.floor((defender.defense || 0) * 0.7));

  const base = Math.floor(atkStat * 0.3); // 30% 공격력
  const def = defStat;
  const variance = Math.floor(Math.random() * 3) - 1;
  const dmg = Math.max(1, Math.floor(base * (100 / (100 + def * 1.2))) + variance);
  return dmg;
}

// ========== 전투 종료 판정 ==========
export function checkBattleEnd(units) {
  const playerAlive = units.some(u => u.team === 'player' && u.id === 'player' && u.hp > 0);
  const enemyAlive = units.some(u => u.team === 'enemy' && u.hp > 0);

  if (!playerAlive) return 'defeat';
  if (!enemyAlive) return 'victory';
  return null;
}

// ========== 정예 몬스터 시스템 ==========
// 확률적으로 한 전투에 1마리가 강화되어 등장
export const ELITE_TIERS = [
  { key: 'fierce',    label: '흉폭한',   mult: 1.5, rewardMult: 1.5, color: '#f59e0b', chance: 0.25, icon: '🔥' },
  { key: 'enraged',   label: '격노한',   mult: 2.0, rewardMult: 2.0, color: '#ef4444', chance: 0.12, icon: '💢' },
  { key: 'champion',  label: '우두머리', mult: 2.5, rewardMult: 2.5, color: '#a855f7', chance: 0.06, icon: '👑' },
  { key: 'nightmare', label: '악몽의',   mult: 3.0, rewardMult: 3.5, color: '#dc2626', chance: 0.02, icon: '💀' },
];

/**
 * 정예 몬스터 등급을 랜덤으로 결정. null이면 일반 몬스터.
 */
export function rollEliteTier() {
  const roll = Math.random();
  let cumulative = 0;
  // 높은 등급부터 체크 (nightmare → champion → enraged → fierce)
  for (let i = ELITE_TIERS.length - 1; i >= 0; i--) {
    cumulative += ELITE_TIERS[i].chance;
    if (roll < cumulative) return ELITE_TIERS[i];
  }
  return null;
}

/**
 * 몬스터 스탯에 정예 배율 적용
 */
export function applyEliteStats(monster, tier) {
  if (!tier) return monster;
  return {
    ...monster,
    hp: Math.floor((monster.hp || 50) * tier.mult),
    maxHp: Math.floor((monster.maxHp || monster.hp || 50) * tier.mult),
    mp: Math.floor((monster.mp || 0) * tier.mult),
    maxMp: Math.floor((monster.maxMp || monster.mp || 0) * tier.mult),
    attack: Math.floor((monster.attack || 5) * tier.mult),
    defense: Math.floor((monster.defense || 0) * tier.mult),
    phys_attack: Math.floor((monster.phys_attack || monster.physAttack || 0) * tier.mult),
    physAttack: Math.floor((monster.phys_attack || monster.physAttack || 0) * tier.mult),
    phys_defense: Math.floor((monster.phys_defense || monster.physDefense || 0) * tier.mult),
    physDefense: Math.floor((monster.phys_defense || monster.physDefense || 0) * tier.mult),
    mag_attack: Math.floor((monster.mag_attack || monster.magAttack || 0) * tier.mult),
    magAttack: Math.floor((monster.mag_attack || monster.magAttack || 0) * tier.mult),
    mag_defense: Math.floor((monster.mag_defense || monster.magDefense || 0) * tier.mult),
    magDefense: Math.floor((monster.mag_defense || monster.magDefense || 0) * tier.mult),
    crit_rate: Math.floor((monster.crit_rate || monster.critRate || 5) * tier.mult),
    critRate: Math.floor((monster.crit_rate || monster.critRate || 5) * tier.mult),
    evasion: Math.floor((monster.evasion || 3) * tier.mult),
    expReward: Math.floor((monster.expReward || monster.exp_reward || monster.exp || 0) * tier.rewardMult),
    exp_reward: Math.floor((monster.expReward || monster.exp_reward || monster.exp || 0) * tier.rewardMult),
    exp: Math.floor((monster.exp || monster.expReward || monster.exp_reward || 0) * tier.rewardMult),
    goldReward: Math.floor((monster.goldReward || monster.gold_reward || monster.gold || 0) * tier.rewardMult),
    gold_reward: Math.floor((monster.goldReward || monster.gold_reward || monster.gold || 0) * tier.rewardMult),
    gold: Math.floor((monster.gold || monster.goldReward || monster.gold_reward || 0) * tier.rewardMult),
    eliteTier: tier,
  };
}

// ========== 적 생성 ==========
export function generateEnemies(monsterPool, playerLevel, stage = null) {
  if (!monsterPool || monsterPool.length === 0) return [];

  const totalWeight = monsterPool.reduce((sum, m) => sum + (m.spawnWeight || 10), 0);
  const pickWeighted = () => {
    let r = Math.random() * totalWeight;
    for (const m of monsterPool) {
      r -= (m.spawnWeight || 10);
      if (r <= 0) return m;
    }
    return monsterPool[monsterPool.length - 1];
  };

  let count;
  if (stage) {
    count = stage.monsterCount || 3;
  } else {
    count = Math.min(1 + Math.floor(Math.random() * 2) + (playerLevel >= 3 ? 1 : 0), 3);
  }

  const levelBonus = stage ? (stage.monsterLevelBonus || 0) : 0;

  // 정예 몬스터 등급 결정 (한 전투에 최대 1마리)
  const eliteTier = rollEliteTier();
  const eliteIdx = eliteTier ? Math.floor(Math.random() * count) : -1;

  const enemies = [];
  for (let i = 0; i < count; i++) {
    const template = pickWeighted();
    const isBossMonster = stage && stage.isBoss && i === count - 1;
    const baseMonster = isBossMonster
      ? monsterPool.reduce((a, b) => a.hp > b.hp ? a : b)
      : template;

    const hpScale = 1 + levelBonus * 0.05 + (isBossMonster ? 0.3 : 0);
    const atkScale = 1 + levelBonus * 0.04 + (isBossMonster ? 0.2 : 0);
    const defScale = 1 + levelBonus * 0.04 + (isBossMonster ? 0.15 : 0);

    const enemy = {
      monsterId: baseMonster.id || null,
      name: baseMonster.name,
      isBoss: isBossMonster,
      hp: Math.floor((baseMonster.hp || 50) * hpScale),
      mp: baseMonster.mp || 0,
      attack: Math.floor((baseMonster.attack || 5) * atkScale),
      defense: Math.floor((baseMonster.defense || 0) * defScale),
      physAttack: Math.floor((baseMonster.physAttack || baseMonster.phys_attack || 0) * atkScale),
      magAttack: Math.floor((baseMonster.magAttack || baseMonster.mag_attack || 0) * atkScale),
      physDefense: Math.floor((baseMonster.physDefense || baseMonster.phys_defense || 0) * defScale + levelBonus * 0.2),
      magDefense: Math.floor((baseMonster.magDefense || baseMonster.mag_defense || 0) * defScale + levelBonus * 0.15),
      move: baseMonster.moveRange || 3,
      exp: (baseMonster.expReward || 0) + (stage ? stage.rewardExpBonus || 0 : 0),
      gold: (baseMonster.goldReward || 0) + (stage ? stage.rewardGoldBonus || 0 : 0),
      icon: baseMonster.icon || '👹',
      aiType: isBossMonster ? 'boss' : (baseMonster.aiType || 'aggressive'),
      skills: baseMonster.skills || [],
    };

    // 정예 적용 (보스가 아닌 몬스터에만)
    if (i === eliteIdx && !isBossMonster) {
      enemies.push(applyEliteStats(enemy, eliteTier));
    } else {
      enemies.push(enemy);
    }
  }
  return enemies;
}
