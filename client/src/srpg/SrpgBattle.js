import React, { useState, useEffect, useRef } from 'react';
import PixelMap2D from './PixelMap2D';
import { buildMapFromDungeon } from './mapData';
import { generateTowerMap } from './towerMapGenerator';
import {
  createPlayerUnit, createSummonUnit, createMercenaryUnit, createMonsterUnit,
  getMovementRange, getAttackRange, getSkillRange, getAoeTiles,
  calcDamage, calcHeal, determineTurnOrder, aiDecide,
  checkBattleEnd, generateEnemies, getWeaponInfo, getTerrainEffect, getTileTurnEffect,
  getJointAttackAllies, calcJointDamage,
  ELITE_TIERS, rollEliteTier, applyEliteStats,
} from './battleEngine';
import api from '../api';
import './SrpgBattle.css';

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

const CLASS_KEY = { '풍수사': 'pungsu', '무당': 'mudang', '승려': 'monk', '저승사자': 'reaper' };

function getUnitPortrait(unit) {
  if (unit.id === 'player') {
    const key = CLASS_KEY[unit.classType];
    return key ? `/characters/${key}_icon.png` : null;
  }
  if (unit.id.startsWith('summon_')) {
    const tid = unit.templateId || unit.summonId;
    return tid ? `/summons_nobg/${tid}_full.png` : null;
  }
  if (unit.id.startsWith('merc_')) {
    const tid = unit.templateId || unit.mercId;
    return tid ? `/mercenaries/${tid}_full.png` : null;
  }
  if (unit.monsterId) return `/monsters_nobg/${unit.monsterId}_icon.png`;
  return null;
}

export default function SrpgBattle({
  location,
  stage,
  character,
  charState,
  learnedSkills,
  passiveBonuses,
  activeSummons,
  activeMercenaries,
  onBattleEnd,
  use2DMap = false,
  savedRetreatFailed = false,
  savedEnemySetup = null,
}) {
  const [mapData, setMapData] = useState(null);
  const [units, setUnits] = useState([]);
  const [phase, setPhase] = useState(PHASE.INIT);
  const [activeUnitId, setActiveUnitId] = useState(null);
  const [turnQueue, setTurnQueue] = useState([]);
  const [movableRange, setMovableRange] = useState([]);
  const [attackRange, setAttackRange] = useState([]);
  const [selectedSkill, setSelectedSkill] = useState(null);
  const [battleLog, setBattleLog] = useState([]);
  const [damagePopups, setDamagePopups] = useState([]);
  const [skillEffects, setSkillEffects] = useState([]);
  const [battleResult, setBattleResult] = useState(null);
  const [totalExpGained, setTotalExpGained] = useState(0);
  const [totalGoldGained, setTotalGoldGained] = useState(0);
  const [roundCount, setRoundCount] = useState(1);
  const [loading, setLoading] = useState(true);
  const [showRetreatConfirm, setShowRetreatConfirm] = useState(false);
  const [retreatDisabled, setRetreatDisabled] = useState(!!savedRetreatFailed);
  const [defeatPenalty, setDefeatPenalty] = useState(null);
  const [autoAll, setAutoAll] = useState(false);
  const [autoSummon, setAutoSummon] = useState(false);
  const [ctxMenu, setCtxMenu] = useState({ show: false, mode: 'main' });
  const [movingUnit, setMovingUnit] = useState(null); // { id, fromX, fromZ, toX, toZ }
  const [potions, setPotions] = useState([]);
  const [droppedMaterials, setDroppedMaterials] = useState([]);
  const [droppedTickets, setDroppedTickets] = useState([]);
  const [resultData, setResultData] = useState(null);
  const [contributions, setContributions] = useState([]);
  const [skillCutIn, setSkillCutIn] = useState(null);
  const [eliteAlert, setEliteAlert] = useState(null);
  const battleSummonIdsRef = useRef([]);
  const battleMercIdsRef = useRef([]);
  const contributionRef = useRef({});
  const logEndRef = useRef(null);
  const autoAllRef = useRef(false);
  const autoSummonRef = useRef(false);
  autoAllRef.current = autoAll;
  autoSummonRef.current = autoSummon;

  // refs for latest state in callbacks
  const unitsRef = useRef(units);
  const phaseRef = useRef(phase);
  const mapRef = useRef(mapData);
  unitsRef.current = units;
  phaseRef.current = phase;
  mapRef.current = mapData;

  const trackContribution = (attackerId, damage, kill = false) => {
    const c = contributionRef.current;
    if (!c[attackerId]) c[attackerId] = { damage: 0, kills: 0 };
    if (damage > 0) c[attackerId].damage += damage;
    if (kill) c[attackerId].kills += 1;
  };

  const addLog = (text, type = 'normal') => {
    setBattleLog(prev => [...prev.slice(-80), { text, type, time: new Date().toLocaleTimeString() }]);
  };

  const addEffect = (x, z, effectType = 'slash', color = '#ff4444') => {
    const tile = mapRef.current?.tiles.find(t => t.x === x && t.z === z);
    const y = tile ? tile.height * 0.5 : 0;
    setSkillEffects(prev => [...prev.slice(-4), { x, y, z, effectType, color, time: Date.now() }]);
  };

  const addPopup = (x, z, text, type = 'damage') => {
    const tile = mapRef.current?.tiles.find(t => t.x === x && t.z === z);
    const y = tile ? tile.height * 0.4 : 0;
    const id = Date.now() + Math.random();
    setDamagePopups(prev => [...prev.slice(-5), { x, y, z, text, type, time: Date.now(), id }]);
    // 애니메이션 종료 후 자동 제거 (1.2초)
    setTimeout(() => {
      setDamagePopups(prev => prev.filter(p => p.id !== id));
    }, 1200);
  };

  // 무기 타입별 공격 이펙트 선택
  const getAttackEffect = (unit, skill, isCrit) => {
    if (isCrit) return { effectType: 'crit', color: '#ffdd00' };
    if (skill) {
      if (skill.type === 'aoe') return { effectType: 'explosion', color: '#ff6600' };
      if (skill.damage_multiplier >= 1.5) return { effectType: 'magic', color: '#8844ff' };
      return { effectType: 'magic', color: '#aa66ff' };
    }
    const wt = unit.weaponType || 'default';
    if (['bow', 'talisman', 'staff', 'bell'].includes(wt)) {
      return { effectType: 'ranged', color: '#44aaff' };
    }
    return { effectType: 'melee', color: '#ff6644' };
  };

  // 스킬 컷인 연출
  const playSkillCutIn = (unit, skill) => {
    setSkillCutIn({ name: unit.name, icon: unit.icon, portrait: getUnitPortrait(unit), skillName: skill.name, skillIcon: skill.icon || '✨', team: unit.team });
    setTimeout(() => setSkillCutIn(null), 1200);
  };

  // 자동 스크롤
  useEffect(() => {
    logEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [battleLog]);

  // 맵 + 유닛 초기화 (API에서 던전 데이터 로드)
  useEffect(() => {
    let cancelled = false;
    async function initBattle() {
      try {
        const res = await api.get(`/dungeon/${location}`);
        if (cancelled) return;
        const { dungeon, monsters: dbMonsters, stages } = res.data;

        // 맵 데이터 생성: 2D모드(타워)이면 generateTowerMap, 아니면 buildMapFromDungeon
        let map;
        if (use2DMap) {
          const floorNum = stage?.stageNumber || 1;
          const isBoss = stage?.isBoss || false;
          const mc = stage?.monsterCount || 4;
          const towerMap = generateTowerMap(floorNum, location, isBoss, mc);
          if (towerMap && towerMap.tiles.length > 0) {
            map = towerMap;
          } else {
            map = buildMapFromDungeon(dungeon);
          }
        } else {
          let mapSource = dungeon;
          if (stage && stages) {
            const stageData = stages.find(s => s.stageNumber === stage.stageNumber);
            if (stageData && stageData.tileOverrides) {
              mapSource = {
                name: `${dungeon.name} ${stage.stageNumber}${stage.isBoss ? ' 👿' : ''}`,
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

        // 장착 무기 정보 로드
        let equippedWeapon = null;
        try {
          const eqRes = await api.get('/equipment/info');
          if (eqRes.data.equipped?.weapon) {
            equippedWeapon = eqRes.data.equipped.weapon;
          }
        } catch {}

        // 최신 진형/소환수/용병 데이터를 서버에서 가져오기
        let freshSummons = activeSummons || [];
        let freshMercenaries = activeMercenaries || [];
        let formationGrid = null;
        try {
          const [summonRes, mercRes, formRes] = await Promise.all([
            api.get('/summon/my'),
            api.get('/mercenary/my'),
            api.get('/formation/list'),
          ]);
          freshSummons = summonRes.data.summons || [];
          freshMercenaries = mercRes.data.mercenaries || [];
          const mainFormation = formRes.data.formations.find(f => f.slotIndex === 0);
          if (mainFormation && mainFormation.gridData) {
            const grid = mainFormation.gridData;
            const hasUnits = grid.some(row => row.some(cell => cell && cell.unitId));
            if (hasUnits) formationGrid = grid;
          }
        } catch {}

        const allUnits = [];

        // 플레이어
        const playerData = {
          ...character,
          current_hp: charState.currentHp,
          current_mp: charState.currentMp,
          hp: charState.maxHp,
          mp: charState.maxMp,
          attack: charState.attack,
          defense: charState.defense,
          phys_attack: charState.physAttack,
          phys_defense: charState.physDefense,
          mag_attack: charState.magAttack,
          mag_defense: charState.magDefense,
          crit_rate: charState.critRate,
          evasion: charState.evasion,
          level: charState.level,
        };
        allUnits.push(createPlayerUnit(playerData, learnedSkills, map.playerSpawns[0], equippedWeapon, passiveBonuses));

        // 진형에 배치된 유닛만 참전 (진형이 있는 경우, 타워전투 제외)
        let spawnIdx = 1;
        const formationUnitIds = new Set();
        const useFormation = formationGrid && !use2DMap; // 타워전투에서는 진형 무시, 모든 동료 참전
        if (useFormation) {
          formationGrid.forEach(row => row.forEach(cell => {
            if (cell && cell.unitId) formationUnitIds.add(cell.unitId);
          }));
        }

        // 소환수
        const battleSummons = useFormation
          ? freshSummons.filter(s => formationUnitIds.has(`summon_${s.id}`))
          : freshSummons;
        battleSummonIdsRef.current = battleSummons.map(s => s.id);
        if (battleSummons.length > 0) {
          battleSummons.forEach((s) => {
            if (spawnIdx < map.playerSpawns.length) {
              allUnits.push(createSummonUnit(s, map.playerSpawns[spawnIdx]));
              spawnIdx++;
            }
          });
        }

        // 용병
        const battleMercs = useFormation
          ? freshMercenaries.filter(m => formationUnitIds.has(`merc_${m.id}`))
          : freshMercenaries;
        battleMercIdsRef.current = battleMercs.map(m => m.id);
        if (battleMercs.length > 0) {
          battleMercs.forEach((m) => {
            if (spawnIdx < map.playerSpawns.length) {
              allUnits.push(createMercenaryUnit(m, map.playerSpawns[spawnIdx]));
              spawnIdx++;
            }
          });
        }

        // 적 생성 (DB 몬스터 데이터 기반 + 스테이지 보너스)
        let enemies;
        let enemySetupToSave = null;
        if (savedEnemySetup && savedEnemySetup.length > 0) {
          // 저장된 적 구성 복원 (정예 리롤 방지)
          enemies = savedEnemySetup.map(setup => {
            const template = dbMonsters.find(m => m.id === setup.monsterId);
            if (!template) return null;
            const levelBonus = stage ? (stage.monsterLevelBonus || 0) : 0;
            const hpScale = 1 + levelBonus * 0.05 + (setup.isBoss ? 0.3 : 0);
            const atkScale = 1 + levelBonus * 0.04 + (setup.isBoss ? 0.2 : 0);
            const defScale = 1 + levelBonus * 0.04 + (setup.isBoss ? 0.15 : 0);
            let enemy = {
              monsterId: template.id,
              name: template.name,
              isBoss: setup.isBoss || false,
              hp: Math.floor((template.hp || 50) * hpScale),
              mp: template.mp || 0,
              attack: Math.floor((template.attack || 5) * atkScale),
              defense: Math.floor((template.defense || 0) * defScale),
              physAttack: Math.floor((template.physAttack || template.phys_attack || 0) * atkScale),
              magAttack: Math.floor((template.magAttack || template.mag_attack || 0) * atkScale),
              physDefense: Math.floor((template.physDefense || template.phys_defense || 0) * defScale + levelBonus * 0.2),
              magDefense: Math.floor((template.magDefense || template.mag_defense || 0) * defScale + levelBonus * 0.15),
              move: template.moveRange || 3,
              exp: (template.expReward || 0) + (stage ? stage.rewardExpBonus || 0 : 0),
              gold: (template.goldReward || 0) + (stage ? stage.rewardGoldBonus || 0 : 0),
              icon: template.icon || '👹',
              aiType: setup.isBoss ? 'boss' : (template.aiType || 'aggressive'),
              skills: template.skills || [],
            };
            if (setup.eliteTierKey) {
              const tier = ELITE_TIERS.find(t => t.key === setup.eliteTierKey);
              if (tier) enemy = applyEliteStats(enemy, tier);
            }
            return enemy;
          }).filter(Boolean);
        } else {
          enemies = generateEnemies(dbMonsters, charState.level, stage);
          // 적 구성을 세션에 저장
          enemySetupToSave = enemies.map(e => ({
            monsterId: e.monsterId,
            isBoss: e.isBoss || false,
            eliteTierKey: e.eliteTier ? e.eliteTier.key : null,
          }));
        }
        // 정예 몬스터 알림
        const eliteEnemy = enemies.find(e => e.eliteTier);
        if (eliteEnemy) {
          setEliteAlert({ name: eliteEnemy.name, icon: eliteEnemy.icon, monsterId: eliteEnemy.monsterId, tier: eliteEnemy.eliteTier });
        }
        enemies.forEach((m, i) => {
          if (i < map.monsterSpawns.length) {
            allUnits.push(createMonsterUnit(m, map.monsterSpawns[i], i));
          }
        });
        // 적 구성 세션 저장 (새로 생성된 경우만)
        if (enemySetupToSave) {
          try {
            api.post('/battle/session/save', {
              battleType: 'srpg',
              context: {
                dungeonKey: location,
                stage,
                enemySetup: enemySetupToSave,
              },
            });
          } catch {}
        }

        setUnits(allUnits);

        // 턴 순서 결정
        const order = determineTurnOrder(allUnits);
        const idQueue = order.map(u => u.id);
        setTurnQueue(idQueue);
        if (idQueue.length > 0) {
          setActiveUnitId(idQueue[0]);
          const firstUnit = allUnits.find(u => u.id === idQueue[0]);
          if (firstUnit && firstUnit.team === 'enemy') {
            setPhase(PHASE.ENEMY_TURN);
          } else if (firstUnit && firstUnit.team === 'player') {
            const isCompanion = firstUnit.id.startsWith('summon_') || firstUnit.id.startsWith('merc_');
            const shouldAuto = autoAllRef.current || (autoSummonRef.current && isCompanion);
            setPhase(shouldAuto ? PHASE.ENEMY_TURN : PHASE.PLAYER_SELECT);
          } else {
            setPhase(PHASE.PLAYER_SELECT);
          }
        }

        const allyNames = [];
        if (activeSummons?.length > 0) allyNames.push(...activeSummons.map(s => (s.icon || '👻') + s.name));
        if (activeMercenaries?.length > 0) allyNames.push(...activeMercenaries.map(m => '🗡️' + m.name));
        const allyStr = allyNames.length > 0 ? ` (동행: ${allyNames.join(', ')})` : '';
        const monsterNames = enemies.map(m => m.icon + m.name).join(', ');
        addLog(`전투 시작! ${monsterNames} 출현!${allyStr}`, 'system');

        // 물약 인벤토리 로드
        try {
          const invRes = await api.get('/shop/inventory');
          const potionItems = (invRes.data.inventory || []).filter(i => (i.type === 'potion' || i.type === 'talisman') && i.quantity > 0);
          setPotions(potionItems);
        } catch {}

        setLoading(false);
      } catch (err) {
        console.error('Failed to load dungeon data:', err);
        addLog('던전 데이터 로딩 실패!', 'damage');
        setLoading(false);
      }
    }
    initBattle();
    return () => { cancelled = true; };
  }, []); // eslint-disable-line

  // 현재 활성 유닛
  const activeUnit = units.find(u => u.id === activeUnitId);

  // 다음 유닛으로 턴 넘기기
  const advanceTurn = () => {
    // 항상 최신 ref 사용 (클로저 stale 문제 방지)
    const latest = unitsRef.current;
    const result = checkBattleEnd(latest);
    if (result) {
      setBattleResult(result);
      setPhase(PHASE.BATTLE_END);
      return;
    }

    setTurnQueue(prevQueue => {
      let newQueue = prevQueue.slice(1);

      // 죽은 유닛 건너뛰기
      newQueue = newQueue.filter(id => { const u = latest.find(uu => uu.id === id); return u && u.hp > 0; });

      // 큐가 비면 새 라운드
      if (newQueue.length === 0) {
        setRoundCount(r => r + 1);
        const aliveUnits = latest.filter(u => u.hp > 0);
        const order = determineTurnOrder(aliveUnits);
        newQueue = order.map(u => u.id);
        // 행동 초기화
        setUnits(prev => {
          const reset = prev.map(u => ({ ...u, acted: false, moved: false, attackAnim: null }));
          unitsRef.current = reset;
          return reset;
        });
      }

      if (newQueue.length === 0) {
        const r = checkBattleEnd(latest);
        if (r) {
          setBattleResult(r);
          setPhase(PHASE.BATTLE_END);
        }
        return prevQueue; // 빈 큐 대신 이전 큐 유지 (무한루프 방지)
      }

      const nextId = newQueue[0];
      setActiveUnitId(nextId);
      const nextUnit = latest.find(u => u.id === nextId);
      if (nextUnit && nextUnit.team === 'enemy') {
        setPhase(PHASE.ENEMY_TURN);
      } else if (nextUnit && nextUnit.team === 'player') {
        // 자동 모드 체크
        const isCompanion = nextUnit.id.startsWith('summon_') || nextUnit.id.startsWith('merc_');
        const shouldAuto = autoAllRef.current || (autoSummonRef.current && isCompanion);
        if (shouldAuto) {
          setPhase(PHASE.ENEMY_TURN); // AI로 처리
        } else {
          setPhase(PHASE.PLAYER_SELECT);
        }
      } else {
        setPhase(PHASE.PLAYER_SELECT);
      }

      return newQueue;
    });
  };

  // 턴 시작 지형 효과 (2D 맵 전용)
  const prevActiveRef = useRef(null);
  useEffect(() => {
    if (!use2DMap || !activeUnitId || !mapData) return;
    if (prevActiveRef.current === activeUnitId) return;
    prevActiveRef.current = activeUnitId;

    const unit = unitsRef.current.find(u => u.id === activeUnitId);
    if (!unit || unit.hp <= 0) return;
    const tile = mapData.tiles.find(t => t.x === unit.x && t.z === unit.z);
    if (!tile) return;

    const effect = getTileTurnEffect(tile.tileKey);
    if (!effect) return;

    setTimeout(() => {
      const u = unitsRef.current.find(uu => uu.id === unit.id);
      if (!u || u.hp <= 0) return;
      let logMsg = '', logType = 'system', popupText = '', popupType = 'damage';
      const updates = {};
      if (effect.type === 'damage') {
        const dmg = Math.max(1, Math.floor(u.maxHp * effect.percent / 100));
        updates.hp = Math.max(1, u.hp - dmg);
        popupText = `-${dmg}`; popupType = 'damage';
        logMsg = `${effect.icon} ${u.name}: ${effect.label} (-${dmg} HP)`; logType = 'damage';
      } else if (effect.type === 'heal') {
        const heal = Math.max(1, Math.floor(u.maxHp * effect.percent / 100));
        updates.hp = Math.min(u.maxHp, u.hp + heal);
        popupText = `+${heal}`; popupType = 'heal';
        logMsg = `${effect.icon} ${u.name}: ${effect.label} (+${heal} HP)`; logType = 'heal';
      } else if (effect.type === 'buff' || effect.type === 'debuff') {
        const STAT_LABELS = { magAttack:'마공', defense:'방어', evasion:'회피', critRate:'치명타', magDefense:'마방', attack:'공격' };
        updates[effect.stat] = (u[effect.stat] || 0) + effect.value;
        const label = STAT_LABELS[effect.stat] || effect.stat;
        const sign = effect.value > 0 ? '+' : '';
        popupText = `${label}${sign}${effect.value}`; popupType = effect.value > 0 ? 'element' : 'damage';
        logMsg = `${effect.icon} ${u.name}: ${effect.label} (${sign}${effect.value})`; logType = 'skill';
      }
      setUnits(prev => {
        const updated = prev.map(uu => uu.id !== unit.id ? uu : { ...uu, ...updates });
        unitsRef.current = updated;
        return updated;
      });
      if (popupText) addPopup(u.x, u.z, popupText, popupType);
      if (logMsg) addLog(logMsg, logType);
    }, 200);
  }, [activeUnitId, use2DMap, mapData]); // eslint-disable-line

  // phase 변경시 메뉴 관리 (행동 완전 종료 전까지 유지)
  useEffect(() => {
    // 적 턴, 애니메이션, 전투 종료시만 메뉴 닫기
    if (phase === PHASE.ENEMY_TURN || phase === PHASE.ANIMATING || phase === PHASE.BATTLE_END) {
      setCtxMenu({ show: false, mode: 'main' });
    }
  }, [phase]);

  // 활성 유닛 변경시 메뉴 닫기 (다음 유닛 턴으로 넘어갈 때)
  useEffect(() => {
    setCtxMenu({ show: false, mode: 'main' });
  }, [activeUnitId]);

  // 자동 모드 토글시 현재 플레이어 턴이면 즉시 전환
  useEffect(() => {
    if (phase !== PHASE.PLAYER_SELECT) return;
    const au = unitsRef.current.find(u => u.id === activeUnitId);
    if (!au || au.team !== 'player') return;
    const isCompanion = au.id.startsWith('summon_') || au.id.startsWith('merc_');
    const shouldAuto = autoAll || (autoSummon && isCompanion);
    if (shouldAuto) {
      setMovableRange([]);
      setAttackRange([]);
      setSelectedSkill(null);
      setPhase(PHASE.ENEMY_TURN);
    }
  }, [autoAll, autoSummon]); // eslint-disable-line

  // 적 AI - useRef로 타이머 관리 (phase 변경에 의한 cleanup 방지)
  const enemyTimerRef = useRef(null);

  useEffect(() => {
    if (phase !== PHASE.ENEMY_TURN) return;

    // 현재 유닛을 ref에서 가져옴 (적 또는 자동 플레이어)
    const currentUnit = unitsRef.current.find(u => u.id === activeUnitId);
    if (!currentUnit || currentUnit.hp <= 0) {
      enemyTimerRef.current = setTimeout(() => advanceTurn(), 100);
      return;
    }
    // 적이 아닌 경우, 자동 모드인지 확인
    if (currentUnit.team === 'player') {
      const isCompanion = currentUnit.id.startsWith('summon_') || currentUnit.id.startsWith('merc_');
      const shouldAuto = autoAllRef.current || (autoSummonRef.current && isCompanion);
      if (!shouldAuto) {
        // 자동 모드가 아니면 플레이어 선택으로 전환
        setPhase(PHASE.PLAYER_SELECT);
        return;
      }
    } else if (currentUnit.team !== 'enemy') {
      enemyTimerRef.current = setTimeout(() => advanceTurn(), 100);
      return;
    }

    // 적 AI를 async 시퀀스로 실행 (setTimeout 체인 대신)
    let cancelled = false;
    const wait = (ms) => new Promise(resolve => {
      enemyTimerRef.current = setTimeout(resolve, ms);
    });

    (async () => {
      await wait(700);
      if (cancelled) return;

      const latestUnit = unitsRef.current.find(u => u.id === activeUnitId);
      if (!latestUnit || latestUnit.hp <= 0) {
        advanceTurn();
        return;
      }

      // 자동 플레이어의 경우 aggressive AI 타입 사용
      const unitForAI = latestUnit.team === 'player'
        ? { ...latestUnit, aiType: latestUnit.aiType || 'aggressive' }
        : latestUnit;
      const decision = aiDecide(unitForAI, mapRef.current, unitsRef.current);
      if (!decision) {
        addLog(`[R${roundCount}] ${latestUnit.icon}${latestUnit.name} 대기.`, 'system');
        await wait(300);
        if (!cancelled) advanceTurn();
        return;
      }

      // AI 이동 (걷기 애니메이션 포함)
      if (decision.moveTarget) {
        setMovingUnit({ id: latestUnit.id, fromX: latestUnit.x, fromZ: latestUnit.z, toX: decision.moveTarget.x, toZ: decision.moveTarget.z });
        await wait(400);
        if (cancelled) return;
        setUnits(prev => {
          const updated = prev.map(u =>
            u.id === latestUnit.id ? { ...u, x: decision.moveTarget.x, z: decision.moveTarget.z, moved: true } : u
          );
          unitsRef.current = updated;
          return updated;
        });
        setMovingUnit(null);
        addLog(`[R${roundCount}] ${latestUnit.icon}${latestUnit.name}이(가) 이동!`, 'system');
      }

      await wait(300);
      if (cancelled) return;

      const movedUnit = unitsRef.current.find(u => u.id === latestUnit.id);
      if (!movedUnit || movedUnit.hp <= 0) { advanceTurn(); return; }

      // ===== AI 행동 실행 =====
      if (decision.action === 'heal' && decision.skill && decision.target) {
        // 힐 스킬 사용
        const healTarget = unitsRef.current.find(u => u.id === decision.target.id);
        if (healTarget && healTarget.hp > 0) {
          const healAmt = decision.skill.heal_amount || 30;
          const selfHeal = healTarget.id === movedUnit.id;
          setUnits(prev => {
            const updated = prev.map(u => {
              if (u.id === healTarget.id) {
                return { ...u, hp: Math.min(u.maxHp, u.hp + healAmt) };
              }
              if (u.id === movedUnit.id) {
                const cd = { ...(u.skillCooldowns || {}) };
                cd[decision.skill.id] = decision.skill.cooldown || 0;
                return { ...u, mp: u.mp - (decision.skill.mp_cost || 0), acted: true, skillCooldowns: cd, attackAnim: { tx: healTarget.x, tz: healTarget.z } };
              }
              return u;
            });
            unitsRef.current = updated;
            return updated;
          });
          const healed = unitsRef.current.find(u => u.id === healTarget.id);
          addLog(
            `[R${roundCount}] ${movedUnit.icon}${movedUnit.name}의 ${decision.skill.icon || '✨'}[${decision.skill.name}]! ${selfHeal ? '자신을' : `${healTarget.icon}${healTarget.name}을(를)`} ${healAmt} 치유! (HP: ${healed?.hp}/${healed?.maxHp})`,
            'heal'
          );
          addPopup(healTarget.x, healTarget.z, `+${healAmt}`, 'heal');
          addEffect(healTarget.x, healTarget.z, 'heal');
        }
      } else if (decision.action === 'buff' && decision.skill) {
        // 버프/디버프
        setUnits(prev => {
          const updated = prev.map(u => {
            if (u.id === movedUnit.id) {
              const newU = { ...u, mp: u.mp - (decision.skill.mp_cost || 0), acted: true };
              const cd = { ...(u.skillCooldowns || {}) };
              cd[decision.skill.id] = decision.skill.cooldown || 0;
              newU.skillCooldowns = cd;
              const bs = decision.skill.buff_stat;
              if (bs === 'attack') newU.attack += decision.skill.buff_value;
              if (bs === 'defense') newU.defense += decision.skill.buff_value;
              if (bs === 'phys_attack') newU.physAttack = (newU.physAttack||0) + decision.skill.buff_value;
              if (bs === 'phys_defense') newU.physDefense = (newU.physDefense||0) + decision.skill.buff_value;
              if (bs === 'mag_attack') newU.magAttack = (newU.magAttack||0) + decision.skill.buff_value;
              if (bs === 'mag_defense') newU.magDefense = (newU.magDefense||0) + decision.skill.buff_value;
              if (bs === 'crit_rate') newU.critRate = (newU.critRate||0) + decision.skill.buff_value;
              if (bs === 'evasion') newU.evasion = (newU.evasion||0) + decision.skill.buff_value;
              return newU;
            }
            return u;
          });
          unitsRef.current = updated;
          return updated;
        });
        const STAT_NAMES = { attack:'공격력', defense:'방어력', phys_attack:'물공', phys_defense:'물방', mag_attack:'마공', mag_defense:'마방', crit_rate:'치명타', evasion:'회피' };
        const statName = STAT_NAMES[decision.skill.buff_stat] || decision.skill.buff_stat;
        addLog(
          `[R${roundCount}] ${movedUnit.icon}${movedUnit.name}의 ${decision.skill.icon || '✨'}[${decision.skill.name}]! ${statName}${decision.skill.buff_value > 0 ? '+' : ''}${decision.skill.buff_value}!`,
          'system'
        );
        addPopup(movedUnit.x, movedUnit.z, `${statName}${decision.skill.buff_value > 0 ? '↑' : '↓'}`, 'system');
        addEffect(movedUnit.x, movedUnit.z, 'buff', decision.skill.buff_stat === 'attack' || decision.skill.buff_stat === 'phys_attack' || decision.skill.buff_stat === 'mag_attack' ? '#ff6600' : '#4488ff');
      } else if (decision.canAttack && decision.target) {
        // 공격 (일반 or 스킬)
        const targetUnit = unitsRef.current.find(u => u.id === decision.target.id);
        if (movedUnit && movedUnit.hp > 0 && targetUnit && targetUnit.hp > 0) {
          const skill = decision.skill;
          if (skill) playSkillCutIn(movedUnit, skill);

          // AoE 스킬: 대상 중심으로 범위 내 모든 적에게 피해
          const isAoe = skill && skill.type === 'aoe';
          const enemyTeam = movedUnit.team === 'player' ? 'enemy' : 'player';
          let aiAoeTargets = [targetUnit];
          if (isAoe && mapRef.current) {
            const aoeRadius = 1;
            const aoeTiles = getAoeTiles(targetUnit.x, targetUnit.z, aoeRadius, mapRef.current);
            const found = unitsRef.current.filter(u => u.hp > 0 && u.team === enemyTeam && aoeTiles.some(t => t.x === u.x && t.z === u.z));
            if (found.length > 0) aiAoeTargets = found;
          }

          const aiAoeResults = aiAoeTargets.map(tgt => ({
            target: tgt,
            result: calcDamage(movedUnit, tgt, skill, mapRef.current),
          }));

          let lifeStealAmt = 0;

          setUnits(prev => {
            const updated = prev.map(u => {
              const hit = aiAoeResults.find(r => r.target.id === u.id);
              if (hit) {
                if (hit.result.evaded) return u;
                const newHp = Math.max(0, u.hp - hit.result.damage);
                return { ...u, hp: newHp };
              }
              if (u.id === movedUnit.id) {
                let newMp = u.mp;
                let newHp = u.hp;
                const cd = { ...(u.skillCooldowns || {}) };
                if (skill) {
                  newMp -= (skill.mp_cost || 0);
                  cd[skill.id] = skill.cooldown || 0;
                  const mainResult = aiAoeResults[0]?.result;
                  if (mainResult && !mainResult.evaded && skill.heal_amount > 0) {
                    lifeStealAmt = Math.min(skill.heal_amount, u.maxHp - u.hp);
                    newHp = Math.min(u.maxHp, u.hp + skill.heal_amount);
                  }
                  if (skill.name === '자폭') {
                    newHp = 0;
                  }
                }
                return { ...u, mp: newMp, hp: newHp, acted: true, skillCooldowns: cd, attackAnim: { tx: decision.target.x, tz: decision.target.z } };
              }
              return u;
            });
            unitsRef.current = updated;
            return updated;
          });

          const skillName = skill ? `${skill.icon || '✨'}[${skill.name}]` : '공격';

          if (lifeStealAmt > 0) {
            addLog(`  ${movedUnit.icon}${movedUnit.name} 생명력 ${lifeStealAmt} 흡수!`, 'heal');
            addPopup(movedUnit.x, movedUnit.z, `+${lifeStealAmt}`, 'heal');
          }

          for (const { target: aoeTgt, result } of aiAoeResults) {
            const tgtAfter = unitsRef.current.find(u => u.id === aoeTgt.id);
            if (result.evaded) {
              addLog(`[R${roundCount}] ${movedUnit.icon}${movedUnit.name}의 ${skillName}! ${aoeTgt.icon}${aoeTgt.name}이(가) 회피!`, 'system');
              addPopup(aoeTgt.x, aoeTgt.z, 'MISS', 'system');
            } else {
              let extra = result.heightInfo.label ? ` (${result.heightInfo.label})` : '';
              if (result.elementLabel) extra += ` [${result.elementLabel}]`;
              addLog(
                `[R${roundCount}] ${movedUnit.icon}${movedUnit.name}의 ${skillName}! ${aoeTgt.icon}${aoeTgt.name}에게 ${result.damage} 데미지!${extra} (HP: ${tgtAfter?.hp}/${tgtAfter?.maxHp})`,
                'damage'
              );
              addPopup(aoeTgt.x, aoeTgt.z, result.isCrit ? `💥${result.damage}` : `-${result.damage}`, 'damage');
              if (result.elementLabel) addPopup(aoeTgt.x, aoeTgt.z, result.elementLabel, result.elementMult > 1 ? 'element' : 'element-weak');
              if (result.isCrit) addLog(`치명타!`, 'damage');
              if (movedUnit.team === 'player') trackContribution(movedUnit.id, result.damage);
              const { effectType: fx, color: fxColor } = getAttackEffect(movedUnit, skill, result.isCrit);
              addEffect(aoeTgt.x, aoeTgt.z, fx, fxColor);
              if (result.isCrit && fx !== 'crit') addEffect(aoeTgt.x, aoeTgt.z, 'crit', '#ffdd00');
            }
          }

          if (isAoe && aiAoeTargets.length > 1) {
            const totalDmg = aiAoeResults.reduce((sum, r) => sum + (r.result.evaded ? 0 : r.result.damage), 0);
            addLog(`  → 광역 공격! ${aiAoeTargets.length}명에게 총 ${totalDmg} 데미지!`, 'damage');
          }

          // 협공 처리 (단일 대상 공격시만, AoE 제외)
          if (!isAoe) {
            const mainResult = aiAoeResults[0]?.result;
            const tgtAfterAI = unitsRef.current.find(u => u.id === decision.target.id);
            if (tgtAfterAI && tgtAfterAI.hp > 0 && mainResult && !mainResult.evaded) {
              const jointAllies = getJointAttackAllies(movedUnit, decision.target, unitsRef.current);
              if (jointAllies.length > 0) {
                let totalJointDmg = 0;
                const jointUpdates = [];
                for (const ally of jointAllies) {
                  const jDmg = calcJointDamage(ally, decision.target, mapRef.current);
                  totalJointDmg += jDmg;
                  jointUpdates.push({ allyId: ally.id, dmg: jDmg, ally });
                }
                setUnits(prev => {
                  const updated = prev.map(u => {
                    if (u.id === decision.target.id) {
                      return { ...u, hp: Math.max(0, u.hp - totalJointDmg) };
                    }
                    const ju = jointUpdates.find(j => j.allyId === u.id);
                    if (ju) return { ...u, attackAnim: { tx: decision.target.x, tz: decision.target.z } };
                    return u;
                  });
                  unitsRef.current = updated;
                  return updated;
                });
                for (const ju of jointUpdates) {
                  addLog(`  ⚔️ ${ju.ally.icon}${ju.ally.name} 협공! ${ju.dmg} 데미지!`, 'damage');
                  addPopup(decision.target.x, decision.target.z, `-${ju.dmg}`, 'joint');
                  addEffect(decision.target.x, decision.target.z, 'slash', '#ffaa44');
                  if (movedUnit.team === 'player') trackContribution(ju.allyId, ju.dmg);
                }
                addLog(`  → 협공 총 추가 데미지: ${totalJointDmg}`, 'damage');
              }
            }
          }

          // 처치 확인
          for (const { target: aoeTgt, result } of aiAoeResults) {
            if (!result.evaded) {
              const tgtFinalAI = unitsRef.current.find(u => u.id === aoeTgt.id);
              if (tgtFinalAI && tgtFinalAI.hp <= 0) {
                addLog(`${aoeTgt.icon}${aoeTgt.name} 쓰러짐!`, 'system');
                if (movedUnit.team === 'player') trackContribution(movedUnit.id, 0, true);
              }
            }
          }
        }
      }

      // 쿨다운 감소 (턴 종료시)
      setUnits(prev => {
        const updated = prev.map(u => {
          if (u.id === movedUnit.id && u.skillCooldowns) {
            const cd = { ...u.skillCooldowns };
            for (const key in cd) { if (cd[key] > 0) cd[key]--; }
            return { ...u, skillCooldowns: cd };
          }
          return u;
        });
        unitsRef.current = updated;
        return updated;
      });

      await wait(400);
      if (!cancelled) advanceTurn();
    })();

    return () => {
      cancelled = true;
      if (enemyTimerRef.current) clearTimeout(enemyTimerRef.current);
    };
  }, [phase, activeUnitId]); // eslint-disable-line

  // 타일 클릭
  const handleTileClick = (tile) => {
    if (phase === PHASE.ANIMATING || phase === PHASE.ENEMY_TURN || phase === PHASE.BATTLE_END) return;
    if (!activeUnit || activeUnit.team !== 'player') return;

    // PLAYER_SELECT 상태에서 활성 유닛 클릭 → 메뉴 토글
    if (phase === PHASE.PLAYER_SELECT) {
      const clickedUnit = units.find(u => u.x === tile.x && u.z === tile.z && u.hp > 0);
      if (clickedUnit && clickedUnit.id === activeUnit.id) {
        setCtxMenu(prev => prev.show ? { show: false, mode: 'main' } : { show: true, mode: 'main' });
        return;
      }
      // 다른 곳 클릭해도 메뉴 유지 (행동 종료 전까지)
      return;
    }

    // 이동 모드
    if (phase === PHASE.PLAYER_MOVE) {
      const canMove = movableRange.some(t => t.x === tile.x && t.z === tile.z);
      if (canMove) {
        // 걷기 애니메이션: movingUnit 상태로 이동 경로 설정
        const fromX = activeUnit.x, fromZ = activeUnit.z;
        const toX = tile.x, toZ = tile.z;
        setMovingUnit({ id: activeUnit.id, fromX, fromZ, toX, toZ });
        setMovableRange([]);
        // 애니메이션 후 실제 위치 업데이트
        setTimeout(() => {
          setUnits(prev => {
            const updated = prev.map(u =>
              u.id === activeUnit.id ? { ...u, x: toX, z: toZ, moved: true } : u
            );
            unitsRef.current = updated;
            return updated;
          });
          setMovingUnit(null);
          setPhase(PHASE.PLAYER_SELECT);
          setCtxMenu({ show: true, mode: 'main' }); // 이동 완료 후 메뉴 다시 열기
          addLog(`${activeUnit.icon}${activeUnit.name}이(가) (${toX},${toZ})로 이동!`, 'system');
        }, 400);
      } else {
        setMovableRange([]);
        setPhase(PHASE.PLAYER_SELECT);
      }
      return;
    }

    // 공격/스킬 모드
    if (phase === PHASE.PLAYER_ATTACK || phase === PHASE.PLAYER_SKILL) {
      const inRange = attackRange.some(t => t.x === tile.x && t.z === tile.z);
      if (!inRange) {
        setAttackRange([]);
        setSelectedSkill(null);
        setPhase(PHASE.PLAYER_SELECT);
        return;
      }

      const targetUnit = units.find(u => u.x === tile.x && u.z === tile.z && u.hp > 0);

      // 힐 스킬
      if (selectedSkill && selectedSkill.type === 'heal') {
        if (targetUnit && targetUnit.team === 'player') {
          const healAmt = calcHeal(activeUnit, selectedSkill);
          const tu = unitsRef.current.find(u => u.id === targetUnit.id);
          const actualHeal = tu ? Math.min(healAmt, tu.maxHp - tu.hp) : healAmt;
          setUnits(prev => {
            const updated = prev.map(u => {
              if (u.id === targetUnit.id) {
                return { ...u, hp: Math.min(u.maxHp, u.hp + healAmt) };
              }
              if (u.id === activeUnit.id) {
                return { ...u, mp: u.mp - selectedSkill.mp_cost, acted: true, attackAnim: { tx: targetUnit.x, tz: targetUnit.z } };
              }
              return u;
            });
            unitsRef.current = updated;
            return updated;
          });
          addLog(`[R${roundCount}] ${activeUnit.icon}${activeUnit.name}의 [${selectedSkill.name}]! ${targetUnit.icon}${targetUnit.name} HP ${actualHeal} 회복!`, 'heal');
          addPopup(targetUnit.x, targetUnit.z, `+${actualHeal}`, 'heal');
          addEffect(targetUnit.x, targetUnit.z, 'heal', '#44ff88');
          setAttackRange([]);
          setSelectedSkill(null);
          setTimeout(() => advanceTurn(), 500);
        }
        return;
      }

      // 공격/공격스킬
      if (targetUnit && targetUnit.team === 'enemy') {
        const skill = selectedSkill;
        if (skill) playSkillCutIn(activeUnit, skill);

        // AoE 스킬: 대상 타일 중심으로 범위 내 모든 적에게 피해
        const isAoe = skill && skill.type === 'aoe';
        let aoeTargets = [targetUnit];
        if (isAoe && mapRef.current) {
          const aoeRadius = 1; // AoE 영향 반경
          const aoeTiles = getAoeTiles(tile.x, tile.z, aoeRadius, mapRef.current);
          aoeTargets = units.filter(u => u.hp > 0 && u.team === 'enemy' && aoeTiles.some(t => t.x === u.x && t.z === u.z));
          if (aoeTargets.length === 0) aoeTargets = [targetUnit];
        }

        // 각 대상에 대해 데미지 계산
        const aoeResults = aoeTargets.map(tgt => ({
          target: tgt,
          result: calcDamage(activeUnit, tgt, skill, mapRef.current),
        }));

        let lifeStealAmt = 0;

        setUnits(prev => {
          const updated = prev.map(u => {
            // AoE 대상들에게 피해 적용
            const hit = aoeResults.find(r => r.target.id === u.id);
            if (hit) {
              if (hit.result.evaded) return u;
              const newHp = Math.max(0, u.hp - hit.result.damage);
              return { ...u, hp: newHp };
            }
            if (u.id === activeUnit.id) {
              let newMp = u.mp;
              let newHp = u.hp;
              if (skill) newMp -= skill.mp_cost;
              const mainResult = aoeResults[0]?.result;
              if (mainResult && !mainResult.evaded && skill && skill.heal_amount > 0) {
                lifeStealAmt = Math.min(skill.heal_amount, u.maxHp - u.hp);
                newHp = Math.min(u.maxHp, u.hp + skill.heal_amount);
              }
              return { ...u, mp: newMp, hp: newHp, acted: true, attackAnim: { tx: targetUnit.x, tz: targetUnit.z } };
            }
            return u;
          });
          unitsRef.current = updated;
          return updated;
        });

        const skillName = skill ? `[${skill.name}]` : '공격';

        if (lifeStealAmt > 0) {
          addLog(`  생명력 ${lifeStealAmt} 흡수!`, 'heal');
          addPopup(activeUnit.x, activeUnit.z, `+${lifeStealAmt}`, 'heal');
        }

        // 각 대상에 대해 로그/이펙트 출력
        for (const { target: aoeTgt, result } of aoeResults) {
          const tgtAfter = unitsRef.current.find(u => u.id === aoeTgt.id);
          if (result.evaded) {
            addLog(`[R${roundCount}] ${activeUnit.icon}${activeUnit.name}의 ${skillName}! ${aoeTgt.icon}${aoeTgt.name}이(가) 회피!`, 'system');
            addPopup(aoeTgt.x, aoeTgt.z, 'MISS', 'system');
          } else {
            let extra = '';
            if (result.heightInfo.label) extra += ` ${result.heightInfo.label}`;
            if (result.terrainDef !== 0) extra += ` 지형방어${result.terrainDef > 0 ? '+' : ''}${result.terrainDef}`;
            if (result.elementLabel) extra += ` [${result.elementLabel}]`;
            addLog(
              `[R${roundCount}] ${activeUnit.icon}${activeUnit.name}의 ${skillName}! ${aoeTgt.icon}${aoeTgt.name}에게 ${result.damage} 데미지!${extra} (HP: ${tgtAfter?.hp}/${tgtAfter?.maxHp})`,
              'normal'
            );
            addPopup(aoeTgt.x, aoeTgt.z, result.isCrit ? `💥${result.damage}` : `-${result.damage}`, 'damage');
            if (result.elementLabel) addPopup(aoeTgt.x, aoeTgt.z, result.elementLabel, result.elementMult > 1 ? 'element' : 'element-weak');
            if (result.isCrit) addLog(`치명타!`, 'damage');
            trackContribution(activeUnit.id, result.damage);
            const { effectType: fx, color: fxColor } = getAttackEffect(activeUnit, skill, result.isCrit);
            addEffect(aoeTgt.x, aoeTgt.z, fx, fxColor);
            if (result.isCrit && fx !== 'crit') addEffect(aoeTgt.x, aoeTgt.z, 'crit', '#ffdd00');
          }
        }

        if (isAoe && aoeTargets.length > 1) {
          const totalDmg = aoeResults.reduce((sum, r) => sum + (r.result.evaded ? 0 : r.result.damage), 0);
          addLog(`  → 광역 공격! ${aoeTargets.length}명에게 총 ${totalDmg} 데미지!`, 'damage');
        }

        // 협공 처리 (단일 대상 공격시만, AoE는 제외)
        if (!isAoe) {
          const mainResult = aoeResults[0]?.result;
          const tgtAfterMain = unitsRef.current.find(u => u.id === targetUnit.id);
          if (tgtAfterMain && tgtAfterMain.hp > 0 && mainResult && !mainResult.evaded) {
            const jointAllies = getJointAttackAllies(activeUnit, targetUnit, unitsRef.current);
            if (jointAllies.length > 0) {
              let totalJointDmg = 0;
              const jointUpdates = [];
              for (const ally of jointAllies) {
                const jDmg = calcJointDamage(ally, targetUnit, mapRef.current);
                totalJointDmg += jDmg;
                jointUpdates.push({ allyId: ally.id, dmg: jDmg, ally });
              }
              setUnits(prev => {
                const updated = prev.map(u => {
                  if (u.id === targetUnit.id) {
                    return { ...u, hp: Math.max(0, u.hp - totalJointDmg) };
                  }
                  const ju = jointUpdates.find(j => j.allyId === u.id);
                  if (ju) return { ...u, attackAnim: { tx: targetUnit.x, tz: targetUnit.z } };
                  return u;
                });
                unitsRef.current = updated;
                return updated;
              });
              for (const ju of jointUpdates) {
                addLog(`  ⚔️ ${ju.ally.icon}${ju.ally.name} 협공! ${ju.dmg} 데미지!`, 'damage');
                addPopup(targetUnit.x, targetUnit.z, `-${ju.dmg}`, 'joint');
                addEffect(targetUnit.x, targetUnit.z, 'slash', '#ffaa44');
                trackContribution(ju.allyId, ju.dmg);
              }
              addLog(`  → 협공 총 추가 데미지: ${totalJointDmg}`, 'damage');
            }
          }
        }

        // 처치 확인
        for (const { target: aoeTgt, result } of aoeResults) {
          if (!result.evaded) {
            const tgtFinal = unitsRef.current.find(u => u.id === aoeTgt.id);
            if (tgtFinal && tgtFinal.hp <= 0) {
              addLog(`${aoeTgt.icon}${aoeTgt.name} 처치!`, 'heal');
              trackContribution(activeUnit.id, 0, true);
            }
          }
        }

        setAttackRange([]);
        setSelectedSkill(null);
        setPhase(PHASE.ANIMATING);
        setTimeout(() => advanceTurn(), 600);
      }
    }
  };

  // 액션 버튼
  const handleMove = () => {
    if (!activeUnit || activeUnit.moved) return;
    const range = getMovementRange(activeUnit, mapData, units);
    setMovableRange(range);
    setAttackRange([]);
    setPhase(PHASE.PLAYER_MOVE);
  };

  const handleAttack = () => {
    if (!activeUnit) return;
    setAttackRange(getAttackRange(activeUnit, mapData)); // 무기 기본 범위 사용
    setMovableRange([]);
    setSelectedSkill(null);
    setPhase(PHASE.PLAYER_ATTACK);
  };

  const handleSkill = (skill) => {
    if (!activeUnit || activeUnit.mp < skill.mp_cost) return;
    const range = getSkillRange(skill);
    if (range === 0) {
      // 자기 버프
      const bs = skill.buff_stat;
      setUnits(prev => {
        const updated = prev.map(u => {
          if (u.id === activeUnit.id) {
            const newU = { ...u, mp: u.mp - skill.mp_cost, acted: true };
            if (bs === 'attack') newU.attack += skill.buff_value;
            if (bs === 'defense') newU.defense += skill.buff_value;
            if (bs === 'phys_attack') newU.physAttack = (newU.physAttack||0) + skill.buff_value;
            if (bs === 'phys_defense') newU.physDefense = (newU.physDefense||0) + skill.buff_value;
            if (bs === 'mag_attack') newU.magAttack = (newU.magAttack||0) + skill.buff_value;
            if (bs === 'mag_defense') newU.magDefense = (newU.magDefense||0) + skill.buff_value;
            if (bs === 'crit_rate') newU.critRate = (newU.critRate||0) + skill.buff_value;
            if (bs === 'evasion') newU.evasion = (newU.evasion||0) + skill.buff_value;
            return newU;
          }
          return u;
        });
        unitsRef.current = updated;
        return updated;
      });
      const STAT_NAMES = { attack:'공격력', defense:'방어력', phys_attack:'물공', phys_defense:'물방', mag_attack:'마공', mag_defense:'마방', crit_rate:'치명타', evasion:'회피' };
      const statLabel = STAT_NAMES[bs] || bs;
      addLog(`[R${roundCount}] ${activeUnit.icon}${activeUnit.name}의 [${skill.name}]! ${statLabel}+${skill.buff_value}!`, 'system');
      addPopup(activeUnit.x, activeUnit.z, `${statLabel}↑`, 'system');
      addEffect(activeUnit.x, activeUnit.z, 'buff', bs === 'attack' || bs === 'phys_attack' || bs === 'mag_attack' ? '#ff6600' : '#4488ff');
      setTimeout(() => advanceTurn(), 500);
      return;
    }
    setAttackRange(getAttackRange(activeUnit, mapData, range)); // 스킬 사거리 사용
    setMovableRange([]);
    setSelectedSkill(skill);
    setPhase(PHASE.PLAYER_SKILL);
  };

  const handleWait = () => {
    if (!activeUnit) return;
    addLog(`${activeUnit.icon}${activeUnit.name} 대기.`, 'system');
    advanceTurn();
  };

  // 물약 사용
  const handleUseItem = async (item) => {
    if (!activeUnit || activeUnit.team !== 'player') return;
    if (activeUnit.id !== 'player') {
      addLog('아이템은 플레이어만 사용할 수 있습니다.', 'system');
      return;
    }
    try {
      await api.post('/shop/use', { itemId: item.item_id });

      if (item.type === 'talisman') {
        const buffEffects = [];
        const statMap = [
          { key: 'effect_phys_attack', stat: 'attack', label: '공격력' },
          { key: 'effect_phys_defense', stat: 'defense', label: '방어력' },
          { key: 'effect_mag_attack', stat: 'attack', label: '마법공격' },
          { key: 'effect_mag_defense', stat: 'defense', label: '마법방어' },
          { key: 'effect_crit_rate', stat: 'crit_rate', label: '치명타' },
          { key: 'effect_evasion', stat: 'evasion', label: '회피율' },
        ];
        setUnits(prev => prev.map(u => {
          if (u.id !== 'player') return u;
          const newBuffs = [...(u.buffs || [])];
          for (const sm of statMap) {
            const val = item[sm.key] || 0;
            if (val > 0) {
              const existing = newBuffs.findIndex(b => b.stat === sm.stat && b.source === 'talisman');
              if (existing >= 0) newBuffs.splice(existing, 1);
              newBuffs.push({ stat: sm.stat, value: val, duration: 3, source: 'talisman', name: item.name });
              buffEffects.push(`${sm.label}+${val}`);
            }
          }
          return { ...u, buffs: newBuffs };
        }));
        const effectText = buffEffects.length > 0 ? buffEffects.join(', ') : item.description;
        addLog(`${activeUnit.name}이(가) ${item.name} 사용! (${effectText})`, 'buff');
        addPopup(activeUnit.x, activeUnit.z, `📜 ${item.name}`, 'buff');
      } else {
        setUnits(prev => prev.map(u => {
          if (u.id !== 'player') return u;
          const newHp = Math.min(u.maxHp, u.hp + (item.effect_hp || 0));
          const newMp = Math.min(u.maxMp, u.mp + (item.effect_mp || 0));
          return { ...u, hp: newHp, mp: newMp };
        }));
        const healText = [];
        if (item.effect_hp > 0) healText.push(`HP+${item.effect_hp}`);
        if (item.effect_mp > 0) healText.push(`MP+${item.effect_mp}`);
        addLog(`${activeUnit.name}이(가) ${item.name} 사용! (${healText.join(', ')})`, 'heal');
        addPopup(activeUnit.x, activeUnit.z, `+${healText.join(' ')}`, 'heal');
      }

      setPotions(prev => prev.map(p => {
        if (p.item_id !== item.item_id) return p;
        return { ...p, quantity: p.quantity - 1 };
      }).filter(p => p.quantity > 0));

      setCtxMenu({ show: false, mode: 'main' });
      advanceTurn();
    } catch (err) {
      addLog(err.response?.data?.message || '아이템 사용 실패', 'system');
    }
  };

  // 컨텍스트 메뉴 액션 핸들러 (행동 종료 전까지 메뉴 유지)
  const handleMenuAction = (action, data) => {
    if (action === 'move') {
      handleMove();
      setCtxMenu({ show: false, mode: 'main' }); // 이동 중 닫기 (이동 완료 후 다시 열림)
    } else if (action === 'attack') {
      handleAttack();
      setCtxMenu({ show: false, mode: 'main' }); // 공격 대상 선택 중 닫기
    } else if (action === 'showSkills') {
      setCtxMenu({ show: true, mode: 'skills' });
    } else if (action === 'showItems') {
      setCtxMenu({ show: true, mode: 'items' });
    } else if (action === 'useItem') {
      handleUseItem(data);
      setCtxMenu({ show: false, mode: 'main' });
    } else if (action === 'skill') {
      handleSkill(data);
      setCtxMenu({ show: false, mode: 'main' }); // 스킬 대상 선택 중 닫기
    } else if (action === 'back') {
      setCtxMenu({ show: true, mode: 'main' });
    } else if (action === 'wait') {
      handleWait();
      setCtxMenu({ show: false, mode: 'main' });
    }
  };

  // 전투 종료 → 서버 전송
  useEffect(() => {
    if (phase !== PHASE.BATTLE_END || !battleResult) return;
    const victory = battleResult === 'victory';
    const defeated = units.filter(u => u.team === 'enemy' && u.hp <= 0);

    const playerUnit = units.find(u => u.id === 'player');
    const finalHp = playerUnit ? playerUnit.hp : 0;
    const finalMp = playerUnit ? playerUnit.mp : 0;

    if (victory) {
      let tExp = 0, tGold = 0;
      for (const m of defeated) {
        tExp += m.expReward || 0;
        tGold += m.goldReward || 0;
      }
      setTotalExpGained(tExp);
      setTotalGoldGained(tGold);
      addLog(`승리! EXP +${tExp}, Gold +${tGold}`, 'level');

      // 기여도 계산 (아군만)
      const contribData = contributionRef.current;
      const playerTeam = units.filter(u => u.team === 'player');
      const totalDamage = Object.values(contribData).reduce((sum, c) => sum + c.damage, 0) || 1;
      const contribList = playerTeam.map(u => {
        const c = contribData[u.id] || { damage: 0, kills: 0 };
        return { id: u.id, name: u.name, icon: u.icon, imageUrl: u.imageUrl, damage: c.damage, kills: c.kills, rawPct: c.damage / totalDamage };
      });
      const participantCount = contribList.filter(c => c.damage > 0 || (units.find(u => u.id === c.id)?.hp ?? 0) > 0).length || 1;
      const minPct = Math.min(0.05, 1 / participantCount);
      const adjustedPcts = contribList.map(c => {
        const participated = c.damage > 0 || (units.find(u => u.id === c.id)?.hp ?? 0) > 0;
        return { ...c, adjPct: participated ? Math.max(minPct, c.rawPct) : 0 };
      });
      const totalAdjPct = adjustedPcts.reduce((s, c) => s + c.adjPct, 0) || 1;
      const finalContrib = adjustedPcts.map(c => ({
        ...c,
        pct: Math.round((c.adjPct / totalAdjPct) * 100),
        exp: Math.floor(tExp * (c.adjPct / totalAdjPct)),
      }));
      setContributions(finalContrib);

      // 서버에 전달할 각 유닛별 경험치
      const playerExp = finalContrib.find(c => c.id === 'player')?.exp || tExp;
      const summonExpMap = {};
      const mercExpMap = {};
      for (const c of finalContrib) {
        if (c.id.startsWith('summon_')) {
          const smId = parseInt(c.id.replace('summon_', ''));
          summonExpMap[smId] = c.exp;
        } else if (c.id.startsWith('merc_')) {
          const mId = parseInt(c.id.replace('merc_', ''));
          mercExpMap[mId] = c.exp;
        }
      }

      // 몬스터 도감 기록
      const defeatedMonsterIds = defeated.map(m => m.monsterId).filter(Boolean);
      if (defeatedMonsterIds.length > 0) {
        api.post('/monsters/record-kills', { monsterIds: defeatedMonsterIds }).catch(() => {});
      }

      api.post('/battle/srpg-result', {
        location, victory: true,
        monstersDefeated: defeated.map(m => m.name),
        expGained: playerExp, goldGained: tGold, rounds: roundCount,
        activeSummonIds: battleSummonIdsRef.current,
        activeMercenaryIds: battleMercIdsRef.current,
        summonExpMap, mercExpMap,
        playerHp: finalHp, playerMp: finalMp,
      }).then(res => {
        setResultData(res.data);
        if (res.data.droppedMaterials && res.data.droppedMaterials.length > 0) {
          setDroppedMaterials(res.data.droppedMaterials);
          res.data.droppedMaterials.forEach(m => {
            addLog(`  📦 ${m.icon} ${m.name} x${m.quantity} 획득!`, 'system');
          });
        }
        if (res.data.droppedTickets && res.data.droppedTickets.length > 0) {
          setDroppedTickets(res.data.droppedTickets);
          res.data.droppedTickets.forEach(t => {
            addLog(`  🎫 ${t.icon} ${t.name} x${t.quantity} 획득!`, 'system');
          });
        }
        if (res.data.leveledUp) {
          addLog(`🎉 레벨 업! Lv.${res.data.levelBefore} → Lv.${res.data.character.level}`, 'level');
        }
      }).catch(console.error);
    } else {
      addLog('패배... 마을에서 휴식하세요.', 'damage');
      api.post('/battle/srpg-result', {
        location, victory: false,
        monstersDefeated: [], expGained: 0, goldGained: 0, rounds: roundCount,
        activeSummonIds: battleSummonIdsRef.current, activeMercenaryIds: battleMercIdsRef.current,
        playerHp: 0, playerMp: finalMp,
      }).catch(console.error);
      // 패배 패널티
      api.post('/battle/session/penalty', { penaltyType: 'defeat' }).then(res => {
        if (res.data.penalty) {
          const p = res.data.penalty;
          setDefeatPenalty(p);
          addLog(`패배 패널티: 골드 -${p.goldLoss}, 경험치 -${p.expLoss}`, 'damage');
        }
      }).catch(() => {});
    }
  }, [phase, battleResult]); // eslint-disable-line

  const [retreatResult, setRetreatResult] = useState(null); // 'success' | 'fail'
  const [retreatDisplayPct, setRetreatDisplayPct] = useState(50);

  const handleRetreat = () => {
    const successRate = (Math.floor(Math.random() * 41) + 30) / 100;
    if (Math.random() < successRate) {
      addLog('후퇴에 성공했습니다!', 'system');
      api.post('/battle/session/penalty', { penaltyType: 'retreat' }).then(res => {
        if (res.data.penalty) {
          addLog(`후퇴 패널티: 골드 -${res.data.penalty.goldLoss}, 경험치 -${res.data.penalty.expLoss}`, 'damage');
        }
      }).catch(() => {});
      setShowRetreatConfirm(false);
      setRetreatResult('success');
      setTimeout(() => onBattleEnd('retreat', 0, 0), 2500);
    } else {
      addLog('후퇴에 실패했습니다! 더 이상 후퇴할 수 없습니다.', 'damage');
      setShowRetreatConfirm(false);
      setRetreatResult('fail');
      setRetreatDisabled(true);
      api.post('/battle/session/retreat-failed').catch(() => {});
      setTimeout(() => setRetreatResult(null), 2500);
    }
  };

  if (loading || !mapData) return <div className="srpg-loading">맵 로딩 중...</div>;

  return (
    <div className={`srpg-container ${use2DMap ? 'mode-2d' : ''}`}>
      {/* 정예 몬스터 등장 알림 */}
      {eliteAlert && (
        <div className="elite-alert-overlay" onClick={() => setEliteAlert(null)}>
          <div className="elite-alert-popup" style={{ '--elite-color': eliteAlert.tier.color }}>
            <div className="elite-alert-flash" />
            <div className="elite-alert-icon">{eliteAlert.tier.icon}</div>
            <div className="elite-alert-img-wrap">
              <img
                src={`/monsters_nobg/${eliteAlert.monsterId}_full.png`}
                alt={eliteAlert.name}
                className="elite-alert-img"
                onError={(e) => { e.target.src = `/monsters/${eliteAlert.monsterId}_full.png`; e.target.onerror = () => { e.target.style.display = 'none'; }; }}
              />
              <div className="elite-alert-aura" />
            </div>
            <div className="elite-alert-tier" style={{ color: eliteAlert.tier.color }}>
              {eliteAlert.tier.icon} {eliteAlert.tier.label}
            </div>
            <div className="elite-alert-name">
              <span style={{ color: eliteAlert.tier.color }}>{eliteAlert.tier.label}</span> {eliteAlert.name}
            </div>
            <div className="elite-alert-subtitle">이(가) 등장했습니다!!</div>
            <div className="elite-alert-mult">
              능력치 x{eliteAlert.tier.mult} / 보상 x{eliteAlert.tier.rewardMult}
            </div>
            <div className="elite-alert-hint">터치하여 계속</div>
          </div>
        </div>
      )}
      <div className="srpg-map">
        <PixelMap2D
            mapData={mapData}
            units={units}
            activeUnit={activeUnit}
            movableRange={movableRange}
            attackRange={attackRange}
            selectedTile={null}
            onTileClick={handleTileClick}
            damagePopups={damagePopups}
            menuState={ctxMenu}
            onMenuAction={handleMenuAction}
            onCanvasMiss={() => {}}
            skillEffects={skillEffects}
            potions={potions}
            location={location}
            movingUnit={movingUnit}
            dungeonTheme={use2DMap ? 'tower' : undefined}
          />
      </div>

      <div className="srpg-hud">
        <div className="srpg-turn-info">
          <span className="srpg-round">R{roundCount}</span>
          {activeUnit && (
            <span className={`srpg-active-unit ${activeUnit.team}`}>
              {(() => { const p = getUnitPortrait(activeUnit); return p ? <img src={p} alt="" className="srpg-active-portrait" onError={e => { e.target.replaceWith(document.createTextNode(activeUnit.icon)); }} /> : activeUnit.icon; })()}
              {activeUnit.name}
            </span>
          )}
          {phase !== PHASE.BATTLE_END && (
            <div className="srpg-turn-controls">
              <button
                className={`srpg-auto-btn ${autoAll ? 'active' : ''}`}
                onClick={() => { setAutoAll(v => !v); if (!autoAll) setAutoSummon(false); }}
              >
                {autoAll ? '⚡' : '▶'} 모두자동
              </button>
              <button
                className={`srpg-auto-btn summon ${autoSummon ? 'active' : ''}`}
                onClick={() => { setAutoSummon(v => !v); if (!autoSummon) setAutoAll(false); }}
              >
                {autoSummon ? '⚡' : '▶'} 동료자동
              </button>
              <button
                className="srpg-retreat-btn"
                onClick={() => { setRetreatDisplayPct(Math.floor(Math.random() * 41) + 30); setShowRetreatConfirm(true); }}
                disabled={retreatDisabled}
                style={retreatDisabled ? {opacity:0.4, cursor:'not-allowed'} : {}}
              >
                {retreatDisabled ? '후퇴불가' : '후퇴'}
              </button>
            </div>
          )}
        </div>

        <div className="srpg-turn-order">
          {turnQueue.map(id => {
            const u = units.find(uu => uu.id === id);
            if (!u || u.hp <= 0) return null;
            const portrait = getUnitPortrait(u);
            return (
              <div key={u.id} className={`srpg-turn-unit ${u.team} ${activeUnit && activeUnit.id === u.id ? 'active' : ''} ${u.eliteTier ? 'elite' : ''}`}
                style={u.eliteTier ? { '--elite-color': u.eliteTier.color } : undefined}>
                {u.eliteTier && <span className="srpg-turn-elite-icon">{u.eliteTier.icon}</span>}
                {portrait
                  ? <img src={portrait} alt="" className="srpg-turn-portrait" onError={e => { e.target.style.display = 'none'; e.target.nextSibling && (e.target.nextSibling.style.display = ''); }} />
                  : null}
                <span className="srpg-turn-icon" style={portrait ? { display: 'none' } : {}}>{u.icon}</span>
                <div className="srpg-turn-hp-bar">
                  <div className="srpg-turn-hp-fill" style={{ width: `${(u.hp / u.maxHp) * 100}%` }} />
                </div>
                <div className="srpg-turn-mp-bar">
                  <div className="srpg-turn-mp-fill" style={{ width: `${(u.mp / u.maxMp) * 100}%` }} />
                </div>
              </div>
            );
          })}
        </div>

        {activeUnit && (
          <div className="srpg-unit-detail">
            <div className="srpg-unit-name" style={activeUnit.eliteTier ? { color: activeUnit.eliteTier.color } : undefined}>
              {(() => { const p = getUnitPortrait(activeUnit); return p ? <img src={p} alt="" className="srpg-detail-portrait" onError={e => { e.target.replaceWith(document.createTextNode(activeUnit.icon + ' ')); }} /> : <span>{activeUnit.icon} </span>; })()}
              {activeUnit.eliteTier && <span className="srpg-elite-name-badge" style={{ background: activeUnit.eliteTier.color }}>{activeUnit.eliteTier.icon} {activeUnit.eliteTier.label}</span>}
              {activeUnit.name} Lv.{activeUnit.level}
            </div>
            <div className="srpg-unit-bars">
              <div className="srpg-bar">
                <span className="srpg-bar-label">HP</span>
                <div className="srpg-bar-track">
                  <div className="srpg-bar-fill hp" style={{ width: `${(activeUnit.hp / activeUnit.maxHp) * 100}%` }} />
                </div>
                <span className="srpg-bar-value">{activeUnit.hp}/{activeUnit.maxHp}</span>
              </div>
              {activeUnit.maxMp > 0 && (
                <div className="srpg-bar">
                  <span className="srpg-bar-label">MP</span>
                  <div className="srpg-bar-track">
                    <div className="srpg-bar-fill mp" style={{ width: `${(activeUnit.mp / activeUnit.maxMp) * 100}%` }} />
                  </div>
                  <span className="srpg-bar-value">{activeUnit.mp}/{activeUnit.maxMp}</span>
                </div>
              )}
            </div>
            <div className="srpg-unit-stats">
              <span>물공 {activeUnit.physAttack || 0}</span>
              <span>마공 {activeUnit.magAttack || 0}</span>
              <span>물방 {activeUnit.physDefense || 0}</span>
              <span>마방 {activeUnit.magDefense || 0}</span>
              <span>치명 {activeUnit.critRate || 0}%</span>
              <span>회피 {activeUnit.evasion || 0}%</span>
              <span>이동력 {activeUnit.move}</span>
              {activeUnit.weaponType && activeUnit.weaponType !== 'default' && (
                <span className="srpg-weapon-tag">
                  {getWeaponInfo(activeUnit.weaponType).label} (범위{getWeaponInfo(activeUnit.weaponType).range})
                </span>
              )}
            </div>
            {(() => {
              const tile = mapData?.tiles.find(t => t.x === activeUnit.x && t.z === activeUnit.z);
              if (!tile) return null;
              const te = getTerrainEffect(tile.tileKey || tile.type);
              const turnEff = getTileTurnEffect(tile.tileKey);
              return (
                <div className="srpg-terrain-info">
                  <span>지형: {te.label}</span>
                  {tile.height > 0 && <span>높이: {tile.height}</span>}
                  {turnEff && (
                    <span className={`srpg-terrain-effect ${turnEff.type}`}>
                      {turnEff.icon} {turnEff.label}
                      {turnEff.type === 'buff' && ` (+${turnEff.value})`}
                      {turnEff.type === 'damage' && ` (-${turnEff.percent}%)`}
                      {turnEff.type === 'heal' && ` (+${turnEff.percent}%)`}
                    </span>
                  )}
                </div>
              );
            })()}
          </div>
        )}

        {phase === PHASE.PLAYER_SELECT && !ctxMenu.show && (
          <div className="srpg-mode-hint">캐릭터를 클릭하여 행동을 선택하세요</div>
        )}
        {phase === PHASE.PLAYER_MOVE && (
          <div className="srpg-mode-hint">이동할 타일을 클릭하세요 (파란색 범위)</div>
        )}
        {(phase === PHASE.PLAYER_ATTACK || phase === PHASE.PLAYER_SKILL) && (
          <div className="srpg-mode-hint">공격 대상을 클릭하세요 (빨간색 범위)</div>
        )}
        {phase === PHASE.ENEMY_TURN && activeUnit && activeUnit.team === 'enemy' && (
          <div className="srpg-mode-hint enemy">적 턴 진행 중...</div>
        )}
        {phase === PHASE.ENEMY_TURN && activeUnit && activeUnit.team === 'player' && (
          <div className="srpg-mode-hint auto">자동 전투 중...</div>
        )}
      </div>

      <div className="srpg-log">
        <div className="srpg-log-header">전투 로그</div>
        <div className="srpg-log-content">
          {battleLog.map((log, i) => (
            <div key={i} className={`srpg-log-line ${log.type}`}>
              <span className="srpg-log-time">{log.time}</span> {log.text}
            </div>
          ))}
          <div ref={logEndRef} />
        </div>
      </div>

      {showRetreatConfirm && (() => {
        const retreatPct = retreatDisplayPct;
        const pctClass = retreatPct >= 55 ? 'high' : retreatPct >= 40 ? 'mid' : 'low';
        return (
          <div className="retreat-overlay" onClick={() => setShowRetreatConfirm(false)}>
            <div className="retreat-popup" onClick={e => e.stopPropagation()}>
              <div className="retreat-bg">
                <img src="/ui/battle/retreat_bg.png" alt="" />
                <div className="retreat-bg-overlay" />
              </div>
              <div className="retreat-fog">
                <div className="retreat-fog-particle" />
                <div className="retreat-fog-particle" />
                <div className="retreat-fog-particle" />
              </div>

              <div className="retreat-content">
                <img src="/ui/battle/retreat_emblem.png" alt="" className="retreat-emblem" />
                <div className="retreat-banner-wrap">
                  <img src="/ui/battle/retreat_banner.png" alt="" />
                </div>
                <div className="retreat-title">후퇴하시겠습니까?</div>
                <div className="retreat-subtitle">전장에서 물러나 안전한 곳으로 퇴각합니다</div>

                <div className="retreat-gauge-section">
                  <div className="retreat-gauge-label">
                    <span className="retreat-gauge-text">후퇴 성공 확률</span>
                    <span className={`retreat-gauge-pct ${pctClass}`}>{retreatPct}%</span>
                  </div>
                  <div className="retreat-gauge-track">
                    <div className={`retreat-gauge-fill ${pctClass}`} style={{width: `${retreatPct}%`}} />
                    <img src="/ui/battle/retreat_gauge_frame.png" alt="" className="retreat-gauge-frame" />
                  </div>
                </div>

                <div className="retreat-info-cards">
                  <div className="retreat-info-card fail">
                    <div className="retreat-info-card-icon">&#x1F6AB;</div>
                    <div className="retreat-info-card-label">실패 시</div>
                    <div className="retreat-info-card-value">후퇴 봉인<br/>(재시도 불가)</div>
                  </div>
                  <div className="retreat-info-card penalty">
                    <div className="retreat-info-card-icon">&#x26A0;&#xFE0F;</div>
                    <div className="retreat-info-card-label">성공 시 패널티</div>
                    <div className="retreat-info-card-value">골드 -10%<br/>경험치 -5%</div>
                  </div>
                </div>

                <div className="retreat-actions">
                  <button className="retreat-btn retreat-btn-try" onClick={handleRetreat}>
                    <span className="retreat-btn-emoji">&#x1F3C3;</span>
                    후퇴 시도
                  </button>
                  <button className="retreat-btn retreat-btn-stay" onClick={() => setShowRetreatConfirm(false)}>
                    <span className="retreat-btn-emoji">&#x2694;&#xFE0F;</span>
                    전투 계속
                  </button>
                </div>

                <div className="retreat-glow-line" />
              </div>
            </div>
          </div>
        );
      })()}

      {/* 후퇴 결과 팝업 */}
      {retreatResult && (
        <div className={`retreat-result-overlay ${retreatResult}`}>
          <div className={`retreat-result-popup ${retreatResult}`}>
            <img
              src={retreatResult === 'success' ? '/ui/battle/retreat_success_bg.png' : '/ui/battle/retreat_fail_bg.png'}
              alt="" className="retreat-result-bg"
            />
            <div className="retreat-result-bg-overlay" />
            <div className="retreat-result-content">
              <img
                src={retreatResult === 'success' ? '/ui/battle/retreat_success_icon.png' : '/ui/battle/retreat_fail_icon.png'}
                alt="" className="retreat-result-icon"
              />
              <div className="retreat-result-title">
                {retreatResult === 'success' ? '후퇴 성공!' : '후퇴 실패!'}
              </div>
              <div className="retreat-result-desc">
                {retreatResult === 'success'
                  ? '전장에서 안전하게 퇴각했습니다'
                  : '후퇴에 실패했습니다. 더 이상 후퇴할 수 없습니다!'}
              </div>
              <div className={`retreat-result-bar ${retreatResult}`} />
            </div>
          </div>
        </div>
      )}

      {/* 스킬 컷인 */}
      {skillCutIn && (
        <div className={`srpg-skill-cutin ${skillCutIn.team}`}>
          <div className="srpg-cutin-line" />
          <div className="srpg-cutin-content">
            {skillCutIn.portrait ? <img src={skillCutIn.portrait} alt="" className="srpg-cutin-portrait" onError={e => { e.target.style.display='none'; e.target.nextSibling && (e.target.nextSibling.style.display=''); }} /> : null}
            <span className="srpg-cutin-icon" style={skillCutIn.portrait ? {display:'none'} : undefined}>{skillCutIn.icon}</span>
            <span className="srpg-cutin-name">{skillCutIn.name}</span>
            <span className="srpg-cutin-skill">{skillCutIn.skillIcon} {skillCutIn.skillName}</span>
          </div>
          <div className="srpg-cutin-line" />
        </div>
      )}

      {phase === PHASE.BATTLE_END && (() => {
        const isVictory = battleResult === 'victory';
        const rd = resultData;
        const charInfo = rd?.character;
        const leveled = rd?.leveledUp;
        const summons = rd?.summonResults || [];
        const mercs = rd?.mercenaryResults || [];
        const expNeeded = charInfo ? Math.floor(120 * charInfo.level + 3 * charInfo.level * charInfo.level) : 100;
        const expPct = charInfo ? Math.min(100, (charInfo.exp / expNeeded) * 100) : 0;

        return (
          <div className="srpg-result-overlay">
            <div className={`srpg-result-screen ${isVictory ? 'victory' : 'defeat'}`}>
              {/* 배경 이미지 */}
              <div className="srpg-result-bg">
                <img src={isVictory ? '/ui/victory_bg.png' : '/ui/defeat_bg.png'} alt="" />
                <div className="srpg-result-bg-overlay" />
              </div>

              {/* 상단 타이틀 */}
              <div className="srpg-result-title-area">
                <h2 className={`srpg-result-title ${isVictory ? '' : 'defeat'}`}>
                  {isVictory ? 'VICTORY' : 'DEFEAT'}
                </h2>
                <div className="srpg-result-subtitle">
                  {isVictory ? '전투에서 승리했습니다!' : '전투에서 패배했습니다...'}
                </div>
                <div className="srpg-result-round">Round {roundCount}</div>
              </div>

              {/* 승리 시 콘텐츠 */}
              {isVictory && (
                <div className="srpg-result-content">
                  {/* 보상 섹션 */}
                  <div className="srpg-result-rewards-panel">
                    <div className="srpg-result-section-title">
                      <img src="/ui/reward_chest.png" alt="" className="srpg-result-chest-icon" />
                      <span>전투 보상</span>
                    </div>
                    <div className="srpg-result-reward-grid">
                      <div className="srpg-rr-item exp">
                        <span className="srpg-rr-label">경험치</span>
                        <span className="srpg-rr-value">+{totalExpGained}</span>
                      </div>
                      <div className="srpg-rr-item gold">
                        <span className="srpg-rr-label">골드</span>
                        <span className="srpg-rr-value">+{totalGoldGained}</span>
                      </div>
                    </div>

                    {droppedMaterials.length > 0 && (
                      <div className="srpg-result-drops">
                        <div className="srpg-result-drops-label">획득 재료</div>
                        <div className="srpg-result-drops-list">
                          {droppedMaterials.map((m, i) => (
                            <div key={i} className="srpg-result-drop-chip">
                              <span className="srpg-result-drop-icon">{m.icon}</span>
                              <span>{m.name}</span>
                              <span className="srpg-result-drop-qty">x{m.quantity}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {droppedTickets.length > 0 && (
                      <div className="srpg-result-drops">
                        <div className="srpg-result-drops-label">🎫 획득 던전 입장권</div>
                        <div className="srpg-result-drops-list">
                          {droppedTickets.map((t, i) => {
                            const gradeColor = { '일반': '#9ca3af', '고급': '#4ade80', '희귀': '#60a5fa', '영웅': '#c084fc', '전설': '#fbbf24' }[t.grade] || '#9ca3af';
                            return (
                              <div key={i} className="srpg-result-drop-chip" style={{ borderColor: gradeColor }}>
                                <span className="srpg-result-drop-icon">{t.icon}</span>
                                <span style={{ color: gradeColor }}>{t.name}</span>
                                <span className="srpg-result-drop-qty">x{t.quantity}</span>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}
                  </div>

                  {/* 캐릭터 성장 */}
                  {charInfo && (
                    <div className="srpg-result-growth-panel">
                      <div className="srpg-result-section-title">
                        <span>캐릭터 성장</span>
                      </div>
                      <div className="srpg-result-char-info">
                        <div className="srpg-result-char-level">
                          {leveled && <div className="srpg-result-lvup-glow" />}
                          <span className="srpg-result-char-lv">Lv.{charInfo.level}</span>
                          {leveled && <span className="srpg-result-lvup-badge">LEVEL UP!</span>}
                        </div>
                        <div className="srpg-result-exp-bar">
                          <div className="srpg-result-exp-fill" style={{ width: `${expPct}%` }} />
                          <span className="srpg-result-exp-text">{charInfo.exp} / {expNeeded} EXP</span>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* 캐릭터 최종 상태 */}
                  {charInfo && (
                    <div className="srpg-result-growth-panel">
                      <div className="srpg-result-section-title">
                        <span>전투 후 상태</span>
                      </div>
                      <div className="srpg-result-status-bars">
                        <div className="srpg-result-status-row">
                          <span className="srpg-result-status-label hp">HP</span>
                          <div className="srpg-result-status-track">
                            <div className="srpg-result-status-fill hp" style={{ width: `${Math.min(100, ((charInfo.current_hp ?? 0) / (charInfo.hp || 1)) * 100)}%` }} />
                          </div>
                          <span className="srpg-result-status-text">{charInfo.current_hp ?? 0} / {charInfo.hp}</span>
                        </div>
                        <div className="srpg-result-status-row">
                          <span className="srpg-result-status-label mp">MP</span>
                          <div className="srpg-result-status-track">
                            <div className="srpg-result-status-fill mp" style={{ width: `${Math.min(100, ((charInfo.current_mp ?? 0) / (charInfo.mp || 1)) * 100)}%` }} />
                          </div>
                          <span className="srpg-result-status-text">{charInfo.current_mp ?? 0} / {charInfo.mp}</span>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* 소환수 성장 */}
                  {summons.length > 0 && (
                    <div className="srpg-result-growth-panel">
                      <div className="srpg-result-section-title">
                        <span>소환수 성장</span>
                      </div>
                      <div className="srpg-result-summon-list">
                        {summons.map((s) => {
                          const sPct = s.expNeeded > 0 ? Math.min(100, (s.exp / s.expNeeded) * 100) : 0;
                          return (
                            <div key={s.id} className="srpg-result-summon-row">
                              <img src={`/summons/${s.templateId}_icon.png`} alt="" className="srpg-result-summon-icon-img" onError={e => { e.target.style.display='none'; }} />
                              <div className="srpg-result-summon-info">
                                <div className="srpg-result-summon-name">
                                  {s.name} <span className="srpg-result-summon-lv">Lv.{s.level}</span>
                                </div>
                                <div className="srpg-result-exp-bar small">
                                  <div className="srpg-result-exp-fill" style={{ width: `${sPct}%` }} />
                                  <span className="srpg-result-exp-text">{s.exp}/{s.expNeeded}</span>
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {/* 용병 성장 */}
                  {mercs.length > 0 && (
                    <div className="srpg-result-growth-panel">
                      <div className="srpg-result-section-title">
                        <span>용병 성장</span>
                      </div>
                      <div className="srpg-result-summon-list">
                        {mercs.map((m) => {
                          const mPct = m.expNeeded > 0 ? Math.min(100, (m.exp / m.expNeeded) * 100) : 0;
                          return (
                            <div key={m.id} className="srpg-result-summon-row">
                              <img src={`/mercenaries/${m.templateId}_icon.png`} alt="" className="srpg-result-summon-icon-img" onError={e => { e.target.style.display='none'; }} />
                              <div className="srpg-result-summon-info">
                                <div className="srpg-result-summon-name">
                                  {m.name} <span className="srpg-result-summon-lv">Lv.{m.level}</span>
                                </div>
                                <div className="srpg-result-exp-bar small">
                                  <div className="srpg-result-exp-fill" style={{ width: `${mPct}%` }} />
                                  <span className="srpg-result-exp-text">{m.exp}/{m.expNeeded}</span>
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {/* 기여도 (EXP 분배) */}
                  {contributions.length > 0 && (
                    <div className="srpg-result-growth-panel">
                      <div className="srpg-result-section-title">
                        <span>기여도 (EXP 분배)</span>
                      </div>
                      <div className="srpg-result-summon-list">
                        {contributions
                          .filter(c => c.pct > 0)
                          .sort((a, b) => b.pct - a.pct)
                          .map(c => (
                            <div key={c.id} className={`srpg-contrib-row ${c.id === 'player' ? 'player' : ''}`}>
                              <div className="srpg-contrib-unit">
                                <img src={c.imageUrl} alt="" className="srpg-contrib-icon" onError={e => { e.target.style.display='none'; }} />
                                <span className="srpg-contrib-name">{c.name}</span>
                              </div>
                              <div className="srpg-contrib-stats">
                                <span className="srpg-contrib-dmg">{c.damage.toLocaleString()} DMG</span>
                                {c.kills > 0 && <span className="srpg-contrib-kills">{c.kills} Kill</span>}
                              </div>
                              <div className="srpg-contrib-bar-wrap">
                                <div className="srpg-contrib-bar" style={{ width: `${c.pct}%` }} />
                                <span className="srpg-contrib-pct">{c.pct}%</span>
                              </div>
                              <span className="srpg-contrib-exp">+{c.exp} EXP</span>
                            </div>
                          ))}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* 패배 시 패널티 표시 */}
              {!isVictory && defeatPenalty && (
                <div className="srpg-result-content">
                  <div className="srpg-result-rewards-panel" style={{borderColor:'#e94560'}}>
                    <div className="srpg-result-section-title" style={{color:'#e94560'}}>
                      <span>패배 패널티</span>
                    </div>
                    <div className="srpg-result-reward-grid">
                      <div className="srpg-rr-item" style={{color:'#e94560'}}>
                        <span className="srpg-rr-label">골드 차감</span>
                        <span className="srpg-rr-value" style={{color:'#e94560'}}>-{defeatPenalty.goldLoss}</span>
                      </div>
                      <div className="srpg-rr-item" style={{color:'#e94560'}}>
                        <span className="srpg-rr-label">경험치 차감</span>
                        <span className="srpg-rr-value" style={{color:'#e94560'}}>-{defeatPenalty.expLoss}</span>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              <button
                className={`srpg-result-continue-btn ${isVictory ? 'victory' : 'defeat'}`}
                onClick={() => onBattleEnd(battleResult, totalExpGained, totalGoldGained)}
                disabled={isVictory && !rd}
              >
                {isVictory && !rd ? '저장 중...' : isVictory ? '계속하기' : '마을로 돌아가기'}
              </button>
            </div>
          </div>
        );
      })()}
    </div>
  );
}
