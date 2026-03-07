import React, { useState, useEffect, useRef, useCallback } from 'react';
import { buildMapFromDungeon } from './mapData';
import { generateTowerMap } from './towerMapGenerator';
import {
  createPlayerUnit, createSummonUnit, createMercenaryUnit, createMonsterUnit,
  getMovementRange, getAttackRange, getSkillRange,
  calcDamage, calcHeal, determineTurnOrder, aiDecide,
  checkBattleEnd, generateEnemies, getWeaponInfo, getTerrainEffect,
} from './battleEngine';
import api from '../api';
import './TowerBattle.css';

const PHASE = {
  INIT: 'init',
  PLAYER_SELECT: 'player_select',
  PLAYER_MOVE: 'player_move',
  PLAYER_ATTACK: 'player_attack',
  PLAYER_SKILL: 'player_skill',
  ENEMY_TURN: 'enemy_turn',
  ANIMATING: 'animating',
  BATTLE_END: 'battle_end',
};

function UnitImg({ src, fallbackSrc, fallback, className, style }) {
  const [imgStage, setImgStage] = useState(0); // 0=primary, 1=fallback, 2=emoji
  const imgSrc = imgStage === 0 ? src : imgStage === 1 ? fallbackSrc : null;
  if (!imgSrc) return <span className={className || 'tb-unit-icon-text'} style={style}>{fallback || '?'}</span>;
  return <img src={imgSrc} alt="" className={className} style={style} onError={() => {
    if (imgStage === 0 && fallbackSrc) setImgStage(1);
    else setImgStage(2);
  }} />;
}

export default function TowerBattle({
  location, stage, character, charState,
  learnedSkills, passiveBonuses, activeSummons, activeMercenaries,
  onBattleEnd,
}) {
  const [mapData, setMapData] = useState(null);
  const [units, setUnits] = useState([]);
  const [phase, setPhase] = useState(PHASE.INIT);
  const [activeUnitId, setActiveUnitId] = useState(null);
  const [turnQueue, setTurnQueue] = useState([]);
  const [movableRange, setMovableRange] = useState([]);
  const [attackRange, setAttackRange] = useState([]);
  const [selectedSkill, setSelectedSkill] = useState(null);
  const [showSkills, setShowSkills] = useState(false);
  const [battleLog, setBattleLog] = useState([]);
  const [damagePopups, setDamagePopups] = useState([]);
  const [hitEffects, setHitEffects] = useState([]);
  const [battleResult, setBattleResult] = useState(null);
  const [totalExpGained, setTotalExpGained] = useState(0);
  const [totalGoldGained, setTotalGoldGained] = useState(0);
  const [roundCount, setRoundCount] = useState(1);
  const [loading, setLoading] = useState(true);
  const [autoMode, setAutoMode] = useState(false);
  const [showRetreat, setShowRetreat] = useState(false);
  const [shakeUnit, setShakeUnit] = useState(null);
  const [deadUnits, setDeadUnits] = useState(new Set());

  const autoRef = useRef(false);
  const logRef = useRef(null);
  const popupIdRef = useRef(0);
  const effectIdRef = useRef(0);
  const unitsRef = useRef([]);
  const phaseRef = useRef(PHASE.INIT);

  useEffect(() => { autoRef.current = autoMode; }, [autoMode]);
  useEffect(() => { unitsRef.current = units; }, [units]);
  useEffect(() => { phaseRef.current = phase; }, [phase]);

  const addLog = useCallback((text, type = 'normal') => {
    setBattleLog(prev => [...prev.slice(-60), { text, type, id: Date.now() + Math.random() }]);
  }, []);

  const addPopup = useCallback((x, z, text, type = 'damage') => {
    const id = ++popupIdRef.current;
    setDamagePopups(prev => [...prev.slice(-6), { id, x, z, text, type }]);
    setTimeout(() => setDamagePopups(prev => prev.filter(p => p.id !== id)), 900);
  }, []);

  const addHitEffect = useCallback((x, z, type = 'slash') => {
    const id = ++effectIdRef.current;
    setHitEffects(prev => [...prev.slice(-4), { id, x, z, type }]);
    setTimeout(() => setHitEffects(prev => prev.filter(e => e.id !== id)), 400);
  }, []);

  // 유닛 아이콘/이미지 URL 결정 (tower_sprites 우선, 기존 아이콘 fallback)
  const getUnitImage = (unit) => {
    if (unit.id === 'player') {
      const classKey = { '풍수사': 'pungsu', '무당': 'mudang', '승려': 'monk', '저승사자': 'reaper' };
      const key = classKey[unit.classType];
      return {
        src: key ? `/tower_sprites/${key}.png` : null,
        fallbackSrc: key ? `/characters/${key}_icon.png` : null,
      };
    }
    if (unit.id.startsWith('summon_')) {
      const tid = unit.templateId || unit.summonId;
      return {
        src: tid ? `/tower_sprites/summon_${tid}.png` : null,
        fallbackSrc: unit.imageUrl || (tid ? `/summons/${tid}_icon.png` : null),
      };
    }
    if (unit.id.startsWith('merc_')) {
      const tid = unit.templateId || unit.mercId;
      return {
        src: tid ? `/tower_sprites/merc_${tid}.png` : null,
        fallbackSrc: unit.imageUrl || (tid ? `/mercenaries/${tid}_icon.png` : null),
      };
    }
    if (unit.monsterId) {
      return {
        src: `/tower_sprites/monster_${unit.monsterId}.png`,
        fallbackSrc: `/monsters/${unit.monsterId}_icon.png`,
      };
    }
    return { src: null, fallbackSrc: null };
  };

  // 타일 타입 → 실제 텍스처 매핑
  const getTileBg = (tile) => {
    const textureMap = {
      floor: '/textures/dirt_rough.jpg',
      wall: '/textures/stone_rough.jpg',
      water: '/textures/dark_rough.jpg',
      special: '/textures/grass_diff.jpg',
      accent1: '/textures/grass_rough.jpg',
      accent2: '/textures/dirt_diff.jpg',
      danger: '/textures/dark_diff.jpg',
    };
    return textureMap[tile.tileKey] || '/textures/dirt_rough.jpg';
  };

  // ========== INIT ==========
  useEffect(() => {
    let cancelled = false;
    async function initBattle() {
      try {
        const res = await api.get(`/dungeon/${location}`);
        if (cancelled) return;
        const { dungeon, monsters: dbMonsters, stages } = res.data;

        // 타워 맵 생성기 사용 (층 번호, 던전 키, 보스 여부, 몬스터 수)
        let map;
        const floorNum = stage?.stageNumber || 1;
        const isBoss = stage?.isBoss || false;
        const mc = stage?.monsterCount || 4;
        const towerMap = generateTowerMap(floorNum, location, isBoss, mc);
        if (towerMap && towerMap.tiles.length > 0) {
          map = towerMap;
        } else {
          // 폴백: 기존 던전 맵 시스템
          let mapSource = dungeon;
          if (stage && stages) {
            const stageData = stages.find(s => s.stageNumber === stage.stageNumber);
            if (stageData && stageData.tileOverrides) {
              mapSource = {
                name: `${dungeon.name} ${stage.stageNumber}${stage.isBoss ? ' BOSS' : ''}`,
                mapWidth: stageData.mapWidth,
                mapHeight: stageData.mapHeight,
                baseTileType: stageData.baseTileType,
                tileOverrides: stageData.tileOverrides,
                playerSpawns: stageData.playerSpawns,
                monsterSpawns: stageData.monsterSpawns,
              };
            }
          }
          map = buildMapFromDungeon(mapSource);
        }
        setMapData(map);

        let equippedWeapon = null;
        try {
          const eqRes = await api.get('/equipment/info');
          if (eqRes.data.equipped?.weapon) equippedWeapon = eqRes.data.equipped.weapon;
        } catch {}

        let freshSummons = activeSummons || [];
        let freshMercenaries = activeMercenaries || [];
        let formationGrid = null;
        try {
          const [summonRes, mercRes, formRes] = await Promise.all([
            api.get('/summon/my'), api.get('/mercenary/my'), api.get('/formation/list'),
          ]);
          freshSummons = summonRes.data.summons || [];
          freshMercenaries = mercRes.data.mercenaries || [];
          const mainFormation = formRes.data.formations.find(f => f.slotIndex === 0);
          if (mainFormation?.gridData) {
            const grid = mainFormation.gridData;
            if (grid.some(row => row.some(cell => cell?.unitId))) formationGrid = grid;
          }
        } catch {}

        const allUnits = [];
        const playerData = {
          ...character,
          current_hp: charState.currentHp, current_mp: charState.currentMp,
          hp: charState.maxHp, mp: charState.maxMp,
          attack: charState.attack, defense: charState.defense,
          phys_attack: charState.physAttack, phys_defense: charState.physDefense,
          mag_attack: charState.magAttack, mag_defense: charState.magDefense,
          crit_rate: charState.critRate, evasion: charState.evasion,
          level: charState.level,
        };
        allUnits.push(createPlayerUnit(playerData, learnedSkills, map.playerSpawns[0], equippedWeapon, passiveBonuses));

        let spawnIdx = 1;
        const formationUnitIds = new Set();
        if (formationGrid) {
          formationGrid.forEach(row => row.forEach(cell => { if (cell?.unitId) formationUnitIds.add(cell.unitId); }));
        }

        const battleSummons = formationGrid ? freshSummons.filter(s => formationUnitIds.has(`summon_${s.id}`)) : freshSummons;
        battleSummons.forEach(s => {
          if (spawnIdx < map.playerSpawns.length) {
            allUnits.push(createSummonUnit(s, map.playerSpawns[spawnIdx]));
            spawnIdx++;
          }
        });

        const battleMercs = formationGrid ? freshMercenaries.filter(m => formationUnitIds.has(`merc_${m.id}`)) : freshMercenaries;
        battleMercs.forEach(m => {
          if (spawnIdx < map.playerSpawns.length) {
            allUnits.push(createMercenaryUnit(m, map.playerSpawns[spawnIdx]));
            spawnIdx++;
          }
        });

        const enemies = generateEnemies(dbMonsters, charState.level, stage);
        enemies.forEach((m, i) => {
          if (i < map.monsterSpawns.length) allUnits.push(createMonsterUnit(m, map.monsterSpawns[i], i));
        });

        setUnits(allUnits);
        const order = determineTurnOrder(allUnits);
        const idQueue = order.map(u => u.id);
        setTurnQueue(idQueue);

        addLog(`=== 무한의 탑 ${stage?.name || ''} [${location}] ===`, 'system');
        addLog(`아군 ${allUnits.filter(u => u.team === 'player').length}명 vs 적 ${allUnits.filter(u => u.team === 'enemy').length}명`, 'system');

        if (idQueue.length > 0) {
          setActiveUnitId(idQueue[0]);
          const firstUnit = allUnits.find(u => u.id === idQueue[0]);
          setPhase(firstUnit?.team === 'enemy' ? PHASE.ENEMY_TURN : PHASE.PLAYER_SELECT);
        }
        setLoading(false);
      } catch (err) {
        console.error('Tower battle init error:', err);
        addLog('전투 데이터 로딩 실패!', 'damage');
        setLoading(false);
      }
    }
    initBattle();
    return () => { cancelled = true; };
  }, []); // eslint-disable-line

  // 로그 자동 스크롤
  useEffect(() => {
    if (logRef.current) logRef.current.scrollTop = logRef.current.scrollHeight;
  }, [battleLog]);

  const activeUnit = units.find(u => u.id === activeUnitId);

  // ========== 턴 진행 ==========
  const advanceTurn = useCallback(() => {
    const curUnits = unitsRef.current;
    const alive = curUnits.filter(u => u.hp > 0);
    const result = checkBattleEnd(curUnits);
    if (result) {
      setBattleResult(result);
      setPhase(PHASE.BATTLE_END);
      return;
    }

    setTurnQueue(prev => {
      let next = [...prev];
      next.shift();
      // 죽은 유닛 제거
      next = next.filter(id => alive.some(u => u.id === id));
      if (next.length === 0) {
        // 새 라운드
        const newOrder = determineTurnOrder(alive);
        next = newOrder.map(u => u.id);
        setRoundCount(r => r + 1);
      }
      const nextId = next[0];
      setActiveUnitId(nextId);
      const nextUnit = alive.find(u => u.id === nextId);
      if (nextUnit) {
        // 쿨다운 감소
        if (nextUnit.skillCooldowns) {
          Object.keys(nextUnit.skillCooldowns).forEach(k => {
            if (nextUnit.skillCooldowns[k] > 0) nextUnit.skillCooldowns[k]--;
          });
        }
        nextUnit.acted = false;
        nextUnit.moved = false;
        setUnits([...curUnits]);

        if (nextUnit.team === 'enemy') {
          setPhase(PHASE.ENEMY_TURN);
        } else {
          const isCompanion = nextUnit.id !== 'player';
          setPhase(autoRef.current || isCompanion ? PHASE.ENEMY_TURN : PHASE.PLAYER_SELECT);
        }
      }
      return next;
    });
  }, []);

  // ========== 이동 ==========
  const handleMove = () => {
    if (!activeUnit || !mapData) return;
    const range = getMovementRange(activeUnit, mapData, units);
    setMovableRange(range);
    setAttackRange([]);
    setSelectedSkill(null);
    setShowSkills(false);
    setPhase(PHASE.PLAYER_MOVE);
  };

  const handleTileClick = (tx, tz) => {
    if (phase === PHASE.PLAYER_MOVE) {
      if (movableRange.some(r => r.x === tx && r.z === tz)) {
        // 이동
        setUnits(prev => prev.map(u => u.id === activeUnitId ? { ...u, x: tx, z: tz, moved: true } : u));
        setMovableRange([]);
        addLog(`${activeUnit.name} 이동 → (${tx},${tz})`, 'system');
        setPhase(PHASE.PLAYER_SELECT);
      }
    } else if (phase === PHASE.PLAYER_ATTACK) {
      handleAttackTile(tx, tz);
    } else if (phase === PHASE.PLAYER_SKILL) {
      handleSkillTile(tx, tz);
    }
  };

  // ========== 공격 ==========
  const handleAttack = () => {
    if (!activeUnit || !mapData) return;
    const range = getAttackRange(activeUnit, mapData);
    setAttackRange(range);
    setMovableRange([]);
    setSelectedSkill(null);
    setShowSkills(false);
    setPhase(PHASE.PLAYER_ATTACK);
  };

  const handleAttackTile = (tx, tz) => {
    const target = units.find(u => u.x === tx && u.z === tz && u.team === 'enemy' && u.hp > 0);
    if (!target || !attackRange.some(r => r.x === tx && r.z === tz)) return;

    const result = calcDamage(activeUnit, target, null, mapData);
    applyDamage(activeUnit, target, result);
    setAttackRange([]);
    setPhase(PHASE.ANIMATING);

    setTimeout(() => {
      const r = checkBattleEnd(unitsRef.current);
      if (r) { setBattleResult(r); setPhase(PHASE.BATTLE_END); }
      else {
        setUnits(prev => prev.map(u => u.id === activeUnitId ? { ...u, acted: true } : u));
        advanceTurn();
      }
    }, 500);
  };

  // ========== 스킬 ==========
  const handleSkillSelect = (skill) => {
    if (!activeUnit) return;
    const cd = activeUnit.skillCooldowns?.[skill.id];
    if (cd > 0) return;
    if ((skill.mp_cost || skill.mpCost || 0) > activeUnit.mp) return;

    setSelectedSkill(skill);
    setShowSkills(false);

    if (skill.type === 'heal' || skill.type === 'buff') {
      // 아군 대상
      const range = [];
      const sr = getSkillRange(skill);
      units.forEach(u => {
        if (u.team === 'player' && u.hp > 0) {
          const dist = Math.abs(u.x - activeUnit.x) + Math.abs(u.z - activeUnit.z);
          if (dist <= sr) range.push({ x: u.x, z: u.z });
        }
      });
      setAttackRange(range);
    } else {
      const range = getAttackRange(activeUnit, mapData, getSkillRange(skill));
      setAttackRange(range);
    }
    setMovableRange([]);
    setPhase(PHASE.PLAYER_SKILL);
  };

  const handleSkillTile = (tx, tz) => {
    if (!selectedSkill) return;
    const skill = selectedSkill;

    if (skill.type === 'heal') {
      const target = units.find(u => u.x === tx && u.z === tz && u.team === 'player' && u.hp > 0);
      if (!target || !attackRange.some(r => r.x === tx && r.z === tz)) return;
      applyHeal(activeUnit, target, skill);
    } else if (skill.type === 'buff') {
      const target = units.find(u => u.x === tx && u.z === tz && u.team === 'player' && u.hp > 0);
      if (!target || !attackRange.some(r => r.x === tx && r.z === tz)) return;
      applyBuff(activeUnit, target, skill);
    } else {
      // attack/aoe/debuff
      const target = units.find(u => u.x === tx && u.z === tz && u.team === 'enemy' && u.hp > 0);
      if (!target || !attackRange.some(r => r.x === tx && r.z === tz)) return;
      const result = calcDamage(activeUnit, target, skill, mapData);
      applyDamage(activeUnit, target, result, skill);

      // AOE
      if (skill.type === 'aoe' || skill.pattern === 'cross' || skill.pattern === 'diamond') {
        const aoeRange = skill.range || 1;
        units.filter(u => u.team === 'enemy' && u.hp > 0 && u.id !== target.id).forEach(u => {
          const dist = Math.abs(u.x - tx) + Math.abs(u.z - tz);
          if (dist <= aoeRange) {
            const r2 = calcDamage(activeUnit, u, { ...skill, damage_multiplier: (skill.damage_multiplier || 1) * 0.6 }, mapData);
            applyDamage(activeUnit, u, r2, skill);
          }
        });
      }
    }

    // MP 소모
    const mpCost = skill.mp_cost || skill.mpCost || 0;
    setUnits(prev => prev.map(u => u.id === activeUnitId ? { ...u, mp: Math.max(0, u.mp - mpCost) } : u));

    // 쿨다운 설정
    if (skill.cooldown) {
      const unit = unitsRef.current.find(u => u.id === activeUnitId);
      if (unit) {
        if (!unit.skillCooldowns) unit.skillCooldowns = {};
        unit.skillCooldowns[skill.id] = skill.cooldown;
      }
    }

    setAttackRange([]);
    setSelectedSkill(null);
    setPhase(PHASE.ANIMATING);

    setTimeout(() => {
      const r = checkBattleEnd(unitsRef.current);
      if (r) { setBattleResult(r); setPhase(PHASE.BATTLE_END); }
      else {
        setUnits(prev => prev.map(u => u.id === activeUnitId ? { ...u, acted: true } : u));
        advanceTurn();
      }
    }, 500);
  };

  // ========== 대기 ==========
  const handleWait = () => {
    addLog(`${activeUnit?.name || '?'} 대기`, 'system');
    setUnits(prev => prev.map(u => u.id === activeUnitId ? { ...u, acted: true } : u));
    setMovableRange([]);
    setAttackRange([]);
    setShowSkills(false);
    advanceTurn();
  };

  // ========== 데미지/힐 적용 ==========
  const applyDamage = (attacker, defender, result, skill = null) => {
    if (result.evaded) {
      addPopup(defender.x, defender.z, 'MISS', 'miss');
      addLog(`${defender.name} 회피!`, 'system');
      return;
    }
    const { damage, isCrit } = result;
    setShakeUnit(defender.id);
    setTimeout(() => setShakeUnit(null), 300);
    addHitEffect(defender.x, defender.z, skill ? 'magic' : 'slash');
    addPopup(defender.x, defender.z, isCrit ? `${damage} CRIT!` : `${damage}`, isCrit ? 'crit' : 'damage');
    addLog(`${attacker.name} → ${defender.name}${skill ? ` [${skill.name}]` : ''}: ${damage} 데미지${isCrit ? ' (크리티컬!)' : ''}`, 'damage');

    setUnits(prev => {
      const newUnits = prev.map(u => {
        if (u.id !== defender.id) return u;
        const newHp = Math.max(0, u.hp - damage);
        return { ...u, hp: newHp };
      });
      // 처치 보상
      const updated = newUnits.find(u => u.id === defender.id);
      if (updated && updated.hp <= 0) {
        setDeadUnits(s => new Set([...s, defender.id]));
        setTotalExpGained(p => p + (defender.expReward || 0));
        setTotalGoldGained(p => p + (defender.goldReward || 0));
        addLog(`${defender.name} 처치! EXP+${defender.expReward || 0} Gold+${defender.goldReward || 0}`, 'skill');
      }
      return newUnits;
    });
  };

  const applyHeal = (healer, target, skill) => {
    const amount = calcHeal(healer, skill);
    addHitEffect(target.x, target.z, 'heal-fx');
    addPopup(target.x, target.z, `+${amount}`, 'heal');
    addLog(`${healer.name} → ${target.name} [${skill.name}]: ${amount} 회복`, 'heal');
    setUnits(prev => prev.map(u => u.id === target.id ? { ...u, hp: Math.min(u.maxHp, u.hp + amount) } : u));
  };

  const applyBuff = (caster, target, skill) => {
    const stat = skill.buff_stat || skill.buffStat || 'attack';
    const value = skill.buff_value || skill.buffValue || 3;
    addHitEffect(target.x, target.z, 'magic');
    addPopup(target.x, target.z, `${stat}+${value}`, 'buff');
    addLog(`${caster.name} → ${target.name} [${skill.name}]: ${stat}+${value}`, 'skill');
    setUnits(prev => prev.map(u => {
      if (u.id !== target.id) return u;
      const updated = { ...u };
      if (stat === 'attack') updated.attack += value;
      if (stat === 'defense') updated.defense += value;
      if (stat === 'physAttack') updated.physAttack += value;
      if (stat === 'magAttack') updated.magAttack += value;
      return updated;
    }));
  };

  // ========== AI 턴 ==========
  useEffect(() => {
    if (phase !== PHASE.ENEMY_TURN || !activeUnit || !mapData) return;

    const isPlayerTeam = activeUnit.team === 'player';
    if (isPlayerTeam && !autoRef.current && activeUnit.id === 'player') {
      setPhase(PHASE.PLAYER_SELECT);
      return;
    }

    const timer = setTimeout(() => {
      const latestUnit = unitsRef.current.find(u => u.id === activeUnitId);
      if (!latestUnit || latestUnit.hp <= 0) { advanceTurn(); return; }
      const decision = aiDecide(latestUnit, mapData, unitsRef.current);
      if (!decision) { advanceTurn(); return; }

      // 이동 (moveTarget은 좌표 객체 {x, z})
      if (decision.moveTarget && (decision.moveTarget.x !== latestUnit.x || decision.moveTarget.z !== latestUnit.z)) {
        setUnits(prev => prev.map(u => u.id === activeUnitId ? { ...u, x: decision.moveTarget.x, z: decision.moveTarget.z, moved: true } : u));
      }

      // 행동 (target은 유닛 객체)
      setTimeout(() => {
        const curUnit = unitsRef.current.find(u => u.id === activeUnitId);
        if (!curUnit || curUnit.hp <= 0) { advanceTurn(); return; }

        if (decision.action === 'attack' && decision.target) {
          const target = unitsRef.current.find(u => u.id === decision.target.id);
          if (target && target.hp > 0) {
            const result = calcDamage(curUnit, target, null, mapData);
            applyDamage(curUnit, target, result);
          }
        } else if (decision.action === 'skill' && decision.skill && decision.target) {
          const target = unitsRef.current.find(u => u.id === decision.target.id);
          const skill = decision.skill;
          if (target && target.hp > 0) {
            if (skill.type === 'heal') {
              applyHeal(curUnit, target, skill);
            } else if (skill.type === 'buff') {
              applyBuff(curUnit, target, skill);
            } else if (skill.type === 'debuff') {
              applyBuff(curUnit, target, skill);
            } else {
              const result = calcDamage(curUnit, target, skill, mapData);
              applyDamage(curUnit, target, result, skill);
            }
            const mpCost = skill.mp_cost || skill.mpCost || 0;
            setUnits(prev => prev.map(u => u.id === activeUnitId ? { ...u, mp: Math.max(0, u.mp - mpCost) } : u));
            if (skill.cooldown) {
              const u2 = unitsRef.current.find(u => u.id === activeUnitId);
              if (u2) { u2.skillCooldowns = u2.skillCooldowns || {}; u2.skillCooldowns[skill.id] = skill.cooldown; }
            }
          }
        } else if (decision.action === 'heal' && decision.skill && decision.target) {
          const target = unitsRef.current.find(u => u.id === decision.target.id);
          if (target && target.hp > 0) {
            applyHeal(curUnit, target, decision.skill);
            const mpCost = decision.skill.mp_cost || decision.skill.mpCost || 0;
            setUnits(prev => prev.map(u => u.id === activeUnitId ? { ...u, mp: Math.max(0, u.mp - mpCost) } : u));
          }
        } else if (decision.action === 'buff' && decision.skill && decision.target) {
          const target = unitsRef.current.find(u => u.id === decision.target.id);
          if (target && target.hp > 0) {
            applyBuff(curUnit, target, decision.skill);
            const mpCost = decision.skill.mp_cost || decision.skill.mpCost || 0;
            setUnits(prev => prev.map(u => u.id === activeUnitId ? { ...u, mp: Math.max(0, u.mp - mpCost) } : u));
          }
        }

        setTimeout(() => {
          const r = checkBattleEnd(unitsRef.current);
          if (r) { setBattleResult(r); setPhase(PHASE.BATTLE_END); }
          else {
            setUnits(prev => prev.map(u => u.id === activeUnitId ? { ...u, acted: true } : u));
            advanceTurn();
          }
        }, 400);
      }, 300);
    }, 400);

    return () => clearTimeout(timer);
  }, [phase, activeUnitId]); // eslint-disable-line

  // ========== 전투 종료 ==========
  const handleBattleEnd = async () => {
    if (!battleResult) return;
    try {
      // 몬스터 도감 기록
      const deadEnemies = units.filter(u => u.team === 'enemy' && u.hp <= 0);
      const defeatedMonsterIds = deadEnemies.map(u => u.monsterId).filter(Boolean);
      if (battleResult === 'victory' && defeatedMonsterIds.length > 0) {
        api.post('/monsters/record-kills', { monsterIds: defeatedMonsterIds }).catch(() => {});
      }
      await api.post('/stage/battle-result', {
        monstersDefeated: deadEnemies.map(u => u.name),
        expGained: totalExpGained,
        goldGained: totalGoldGained,
        victory: battleResult === 'victory',
        activeSummonIds: (activeSummons || []).map(s => s.id),
        activeMercenaryIds: (activeMercenaries || []).map(m => m.id),
        playerHp: units.find(u => u.id === 'player')?.hp ?? 0,
        playerMp: units.find(u => u.id === 'player')?.mp ?? 0,
      });
    } catch {}
    onBattleEnd(battleResult, totalExpGained, totalGoldGained);
  };

  // ========== 렌더링 ==========
  if (loading) {
    return (
      <div className="tb-loading">
        <div>무한의 탑</div>
        <div>전투 준비 중<span className="tb-loading-dots"></span></div>
      </div>
    );
  }

  if (!mapData) return <div className="tb-loading">맵 데이터 없음</div>;

  const isMovable = (x, z) => movableRange.some(r => r.x === x && r.z === z);
  const isAttackable = (x, z) => attackRange.some(r => r.x === x && r.z === z);
  const isSkillRange = phase === PHASE.PLAYER_SKILL;

  // 유닛 위치 맵
  const unitMap = {};
  units.filter(u => u.hp > 0 || deadUnits.has(u.id)).forEach(u => { unitMap[`${u.x},${u.z}`] = u; });

  // HP 비율 클래스
  const hpClass = (u) => {
    const pct = u.hp / u.maxHp;
    if (pct > 0.5) return 'high';
    if (pct > 0.25) return 'mid';
    return 'low';
  };

  const playerSkills = activeUnit?.skills || [];
  const canAct = activeUnit && !activeUnit.acted && activeUnit.team === 'player' &&
    (phase === PHASE.PLAYER_SELECT || phase === PHASE.PLAYER_MOVE || phase === PHASE.PLAYER_ATTACK || phase === PHASE.PLAYER_SKILL);

  // 플레이어 유닛 참조 (결과 화면용)
  const playerUnit = units.find(u => u.id === 'player');

  // 모드 힌트 텍스트
  const modeHint = phase === PHASE.PLAYER_MOVE ? '이동할 타일을 선택하세요'
    : phase === PHASE.PLAYER_ATTACK ? '공격할 적을 선택하세요'
    : phase === PHASE.PLAYER_SKILL ? `${selectedSkill?.name || '스킬'} 대상을 선택하세요`
    : phase === PHASE.ENEMY_TURN && activeUnit?.team === 'enemy' ? `${activeUnit?.name || '적'} 행동 중...`
    : autoMode && phase === PHASE.ENEMY_TURN ? '자동 전투 중...'
    : null;

  return (
    <div className="tb">
      {/* 맵 영역 (전체 화면) */}
      <div className="tb-map-area">
        <div className="tb-grid" style={{ gridTemplateColumns: `repeat(${mapData.width}, 104px)` }}>
          {mapData.tiles.map((tile, i) => {
            const unit = unitMap[`${tile.x},${tile.z}`];
            const isDead = unit && deadUnits.has(unit.id) && unit.hp <= 0;
            const tileBgUrl = getTileBg(tile);
            const baseTileClass = tile.tileKey === 'wall' ? 'stone' : tile.tileKey === 'water' || tile.tileKey === 'danger' ? 'water' : tile.tileKey === 'special' ? 'dark' : tile.type?.includes('_') ? '' : tile.type;
            return (
              <div
                key={i}
                className={`tb-tile ${baseTileClass} ${tile.height > 0 ? `h${Math.min(tile.height, 3)}` : ''} ${isMovable(tile.x, tile.z) ? 'move-range' : ''} ${isAttackable(tile.x, tile.z) ? (isSkillRange ? 'skill-range' : 'atk-range') : ''} ${unit && unit.id === activeUnitId ? 'selected-tile' : ''} ${tile.tileKey === 'wall' ? 'tb-wall' : ''}`}
                style={{ backgroundImage: `url(${tileBgUrl})`, backgroundSize: 'cover' }}
                onClick={() => handleTileClick(tile.x, tile.z)}
              >
                {unit && (
                  <div className={`tb-unit ${unit.team === 'player' ? 'ally' : 'enemy'} ${unit.id === activeUnitId ? 'active-unit' : ''} ${unit.acted ? 'acted' : ''} ${isDead ? 'dead-unit' : ''} ${shakeUnit === unit.id ? 'shake' : ''}`}>
                    <UnitImg src={getUnitImage(unit).src} fallbackSrc={getUnitImage(unit).fallbackSrc} fallback={unit.icon} className="tb-unit-sprite" />
                    <div className="tb-unit-hp-bar">
                      <div className={`tb-unit-hp-fill ${hpClass(unit)}`} style={{ width: `${Math.max(0, unit.hp / unit.maxHp * 100)}%` }} />
                    </div>
                    <div className="tb-unit-name">{unit.name}</div>
                  </div>
                )}
                {damagePopups.filter(p => p.x === tile.x && p.z === tile.z).map(p => (
                  <div key={p.id} className={`tb-dmg-popup ${p.type}`}>{p.text}</div>
                ))}
                {hitEffects.filter(e => e.x === tile.x && e.z === tile.z).map(e => (
                  <div key={e.id} className={`tb-hit-fx ${e.type}`} />
                ))}
              </div>
            );
          })}
        </div>
      </div>

      {/* HUD 오버레이 (맵 위에 겹침) */}
      <div className="tb-hud">
        {/* 턴 정보 + 자동/후퇴 */}
        <div className="tb-turn-info">
          <span className="tb-floor-badge">{stage?.name || '무한의 탑'}</span>
          <span className="tb-round">R{roundCount}</span>
          {activeUnit && (
            <span className={`tb-active-unit ${activeUnit.team === 'player' ? 'player' : 'enemy'}`}>
              {activeUnit.name}
            </span>
          )}
          <div className="tb-turn-controls">
            <button className={`tb-auto-btn ${autoMode ? 'active' : ''}`} onClick={() => setAutoMode(!autoMode)}>
              {autoMode ? 'AUTO ON' : 'AUTO'}
            </button>
            <button className="tb-retreat-btn" onClick={() => setShowRetreat(true)}>후퇴</button>
          </div>
        </div>

        {/* 턴 순서 */}
        <div className="tb-turn-order">
          {turnQueue.slice(0, 10).map((uid, i) => {
            const u = units.find(uu => uu.id === uid);
            if (!u) return null;
            return (
              <div key={uid + i} className={`tb-turn-unit ${u.team === 'player' ? 'ally' : 'enemy'} ${u.id === activeUnitId ? 'active' : ''} ${u.hp <= 0 ? 'dead' : ''}`}>
                <UnitImg src={getUnitImage(u).src} fallbackSrc={getUnitImage(u).fallbackSrc} fallback={u.icon} style={{ width: 26, height: 26, imageRendering: 'pixelated', objectFit: 'cover', borderRadius: 3 }} />
                <div className="tb-turn-hp-bar">
                  <div className="tb-turn-hp-fill" style={{ width: `${Math.max(0, u.hp / u.maxHp * 100)}%` }} />
                </div>
              </div>
            );
          })}
        </div>

        {/* 유닛 상세 (우측 상단) */}
        {activeUnit && (
          <div className="tb-unit-detail">
            <div className="tb-detail-name">
              <span className={`team-dot ${activeUnit.team === 'player' ? 'ally' : 'enemy'}`} />
              {activeUnit.name} Lv.{activeUnit.level}
            </div>
            <div className="tb-detail-bars">
              <div className="tb-bar-row">
                <span className="tb-bar-label">HP</span>
                <div className="tb-bar-track">
                  <div className="tb-bar-fill hp" style={{ width: `${activeUnit.hp / activeUnit.maxHp * 100}%` }} />
                </div>
                <span className="tb-bar-val">{activeUnit.hp}/{activeUnit.maxHp}</span>
              </div>
              {activeUnit.maxMp > 0 && (
                <div className="tb-bar-row">
                  <span className="tb-bar-label">MP</span>
                  <div className="tb-bar-track">
                    <div className="tb-bar-fill mp" style={{ width: `${activeUnit.mp / activeUnit.maxMp * 100}%` }} />
                  </div>
                  <span className="tb-bar-val">{activeUnit.mp}/{activeUnit.maxMp}</span>
                </div>
              )}
            </div>
            <div className="tb-detail-stats">
              <span>ATK <span>{activeUnit.attack}</span></span>
              <span>DEF <span>{activeUnit.defense}</span></span>
              <span>CRIT <span>{activeUnit.critRate}%</span></span>
              <span>EVA <span>{activeUnit.evasion}%</span></span>
            </div>
          </div>
        )}

        {/* 액션 버튼 (하단 중앙) */}
        {canAct && !showSkills && (
          <div className="tb-actions">
            <button className="tb-action-btn move-btn" disabled={activeUnit.moved} onClick={handleMove}>
              이동{activeUnit.moved ? ' (완료)' : ''}
            </button>
            <button className="tb-action-btn atk-btn" onClick={handleAttack}>
              공격
            </button>
            {playerSkills.length > 0 && (
              <button className="tb-action-btn skill-btn" onClick={() => { setShowSkills(true); setMovableRange([]); setAttackRange([]); }}>
                스킬 ({playerSkills.length})
              </button>
            )}
            <button className="tb-action-btn wait-btn" onClick={handleWait}>
              대기
            </button>
          </div>
        )}

        {/* 스킬 메뉴 */}
        {canAct && showSkills && (
          <div className="tb-actions">
            <div className="tb-skill-menu">
              <button className="tb-skill-back-btn" onClick={() => { setShowSkills(false); setPhase(PHASE.PLAYER_SELECT); }}>
                ← 돌아가기
              </button>
              {playerSkills.map(sk => {
                const mpCost = sk.mp_cost || sk.mpCost || 0;
                const cd = activeUnit.skillCooldowns?.[sk.id] || 0;
                const noMp = mpCost > activeUnit.mp;
                return (
                  <div
                    key={sk.id}
                    className={`tb-skill-menu-item ${cd > 0 || noMp ? 'disabled' : ''}`}
                    onClick={() => !(cd > 0 || noMp) && handleSkillSelect(sk)}
                  >
                    <span>{sk.icon || '✦'} {sk.name}</span>
                    <span className="tb-skill-mp">
                      {cd > 0 ? `CD:${cd}` : `MP ${mpCost}`}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* 모드 힌트 */}
        {modeHint && (
          <div className={`tb-mode-hint ${phase === PHASE.ENEMY_TURN && activeUnit?.team === 'enemy' ? 'enemy' : ''} ${autoMode && phase === PHASE.ENEMY_TURN ? 'auto' : ''}`}>
            {modeHint}
          </div>
        )}
      </div>

      {/* 전투 로그 (하단 고정) */}
      <div className="tb-log">
        <div className="tb-log-header">Battle Log</div>
        <div className="tb-log-content" ref={logRef}>
          {battleLog.map(l => (
            <div key={l.id} className={`tb-log-entry ${l.type}`}>{l.text}</div>
          ))}
        </div>
      </div>

      {/* 전투 결과 (SRPG 스타일) */}
      {battleResult && phase === PHASE.BATTLE_END && (
        <div className="tb-result-overlay">
          <div className={`tb-result-screen ${battleResult}`}>
            <div className="tb-result-title-area">
              <h2 className={`tb-result-title ${battleResult === 'defeat' ? 'defeat' : ''}`}>
                {battleResult === 'victory' ? '승리' : '패배'}
              </h2>
              <div className="tb-result-subtitle">
                {battleResult === 'victory'
                  ? `${stage?.name || '무한의 탑'} 클리어!`
                  : '다음에 다시 도전하세요'}
              </div>
              <div className="tb-result-round-info">ROUND {roundCount}</div>
            </div>

            <div className="tb-result-content">
              {/* 보상 */}
              <div className="tb-result-rewards-panel">
                <div className="tb-result-section-title">전투 보상</div>
                <div className="tb-result-reward-grid">
                  <div className="tb-rr-item exp">
                    <span className="tb-rr-label">경험치</span>
                    <span className="tb-rr-value">+{totalExpGained}</span>
                  </div>
                  <div className="tb-rr-item gold">
                    <span className="tb-rr-label">골드</span>
                    <span className="tb-rr-value">+{totalGoldGained}</span>
                  </div>
                </div>
              </div>

              {/* 전투 후 상태 */}
              {playerUnit && (
                <div className="tb-result-growth-panel">
                  <div className="tb-result-section-title">전투 후 상태</div>
                  <div className="tb-result-status-bars">
                    <div className="tb-result-status-row">
                      <span className="tb-result-status-label hp">HP</span>
                      <div className="tb-result-status-track">
                        <div className="tb-result-status-fill hp" style={{ width: `${Math.max(0, playerUnit.hp / playerUnit.maxHp * 100)}%` }} />
                      </div>
                      <span className="tb-result-status-text">{Math.max(0, playerUnit.hp)} / {playerUnit.maxHp}</span>
                    </div>
                    {playerUnit.maxMp > 0 && (
                      <div className="tb-result-status-row">
                        <span className="tb-result-status-label mp">MP</span>
                        <div className="tb-result-status-track">
                          <div className="tb-result-status-fill mp" style={{ width: `${Math.max(0, playerUnit.mp / playerUnit.maxMp * 100)}%` }} />
                        </div>
                        <span className="tb-result-status-text">{Math.max(0, playerUnit.mp)} / {playerUnit.maxMp}</span>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>

            <button className={`tb-result-continue-btn ${battleResult}`} onClick={handleBattleEnd}>
              {battleResult === 'victory' ? '계속하기' : '돌아가기'}
            </button>
          </div>
        </div>
      )}

      {/* 후퇴 확인 */}
      {showRetreat && (
        <div className="tb-confirm-overlay" onClick={() => setShowRetreat(false)}>
          <div className="tb-confirm-box" onClick={e => e.stopPropagation()}>
            <div className="tb-confirm-msg">전투에서 후퇴하시겠습니까?<br/>진행 상황이 저장되지 않습니다.</div>
            <div className="tb-confirm-btns">
              <button className="tb-confirm-no" onClick={() => setShowRetreat(false)}>취소</button>
              <button className="tb-confirm-yes" onClick={() => { setShowRetreat(false); onBattleEnd('retreat', 0, 0); }}>후퇴</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
