import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  createCardPlayerUnit, createCardSummonUnit, createCardMercenaryUnit, createCardMonsterUnit,
  assignGridPositions,
  calculateTurnOrder, getValidTargets, getHealTargets, getGuardTargets,
  executeAttack, executeSkill, executeGuard,
  onTurnStart, decideAIAction, checkBattleEnd, calculateRewards,
} from './cardBattleEngine';
import { rollEliteTier, applyEliteStats, ELITE_TIERS } from './battleEngine';
import api from '../api';
import './StageBattle.css';
import './SrpgBattle.css';

// 속성별 기본 오라 매핑
const ELEMENT_AURA_MAP = {
  fire: 'flame', water: 'ice', earth: 'aura_gold', wind: 'wind', neutral: 'holy',
  light: 'holy', dark: 'shadow', lightning: 'lightning', poison: 'poison',
};
const CLASS_ELEMENT_MAP = {
  '풍수사': 'wind', '무당': 'dark', '승려': 'light', '저승사자': 'dark',
};

function StageBattle({ stage, character, charState, learnedSkills, passiveBonuses, activeSummons, activeMercenaries, monsters, groupKey, onBattleEnd, onLog, savedEnemySetup, savedRetreatFailed, isStageCleared }) {
  const [units, setUnits] = useState([]);
  const [turnOrder, setTurnOrder] = useState([]);
  const [currentTurnIdx, setCurrentTurnIdx] = useState(0);
  const [round, setRound] = useState(1);
  const [phase, setPhase] = useState('init'); // init, player_action, select_target, enemy_turn, animating, battle_end
  const [selectedAction, setSelectedAction] = useState(null); // 'attack','skill','guard','retreat'
  const [selectedSkill, setSelectedSkill] = useState(null);
  const [battleResult, setBattleResult] = useState(null);
  const [logs, setLogs] = useState([]);
  const [animatingUnit, setAnimatingUnit] = useState(null);
  const [damagePopups, setDamagePopups] = useState([]);
  const [combatAnim, setCombatAnim] = useState(null); // { attackerId, targetId, type: 'melee'|'ranged'|'skill', phase: 'rush'|'hit'|'return'|'projectile' }
  const [projectiles, setProjectiles] = useState([]);
  const [hitEffects, setHitEffects] = useState([]);
  const [skillCutIn, setSkillCutIn] = useState(null); // { skillName, skillIcon, casterName }
  const [showItemList, setShowItemList] = useState(false);
  const [potions, setPotions] = useState([]);
  const [droppedMaterials, setDroppedMaterials] = useState([]);
  const [droppedTickets, setDroppedTickets] = useState([]);
  const [resultData, setResultData] = useState(null);
  const [totalExpGained, setTotalExpGained] = useState(0);
  const [totalGoldGained, setTotalGoldGained] = useState(0);
  const [dropAnims, setDropAnims] = useState([]);
  const [defeatPenalty, setDefeatPenalty] = useState(null); // { goldLoss, expLoss }
  const isPrologue = groupKey === 'prologue';
  const [autoAll, setAutoAll] = useState(isPrologue); // 전체 자동전투 (프롤로그는 강제 자동)
  const [autoCompanion, setAutoCompanion] = useState(false); // 소환수/용병만 자동전투
  const [showRetreatConfirm, setShowRetreatConfirm] = useState(false);
  const [retreatFailed, setRetreatFailed] = useState(false); // 후퇴 실패 여부
  const [retreatDisabled, setRetreatDisabled] = useState(!!savedRetreatFailed); // 후퇴 버튼 비활성화 (DB에서 복원)
  const [retreatResult, setRetreatResult] = useState(null); // 'success' | 'fail'
  const [retreatDisplayPct, setRetreatDisplayPct] = useState(50);
  const [battleEntering, setBattleEntering] = useState(true); // 입장 연출
  const [contributions, setContributions] = useState([]); // {id, name, icon, imageUrl, damage, kills, pct, exp}
  const [eliteAlert, setEliteAlert] = useState(null); // { name, icon, monsterId, tier }
  const battleSummonIdsRef = useRef([]);
  const battleMercIdsRef = useRef([]);
  const contributionRef = useRef({}); // unitId -> { damage, kills }
  const initDoneRef = useRef(false); // 중복 초기화 방지
  const logRef = useRef(null);
  const popupId = useRef(0);
  const projectileId = useRef(0);
  const hitEffectId = useRef(0);
  const cardRefsMap = useRef({}); // unitId -> DOM element ref

  const addLog = useCallback((text, type = 'normal') => {
    setLogs(prev => [...prev.slice(-80), { text, type, id: Date.now() + Math.random() }]);
  }, []);

  const addPopup = useCallback((unitId, text, type) => {
    const id = ++popupId.current;
    setDamagePopups(prev => [...prev, { id, unitId, text, type }]);
    setTimeout(() => {
      setDamagePopups(prev => prev.filter(p => p.id !== id));
    }, 1200);
  }, []);

  // 히트 이펙트 추가 (effectType: 'hit' | 'crit' | 'evade')
  const addHitEffect = useCallback((unitId, effectType = 'hit') => {
    const id = ++hitEffectId.current;
    setHitEffects(prev => [...prev, { id, unitId, effectType }]);
    setTimeout(() => setHitEffects(prev => prev.filter(e => e.id !== id)), effectType === 'crit' ? 800 : 600);
  }, []);

  // 전투 로그를 팝업/이펙트로 처리하는 공통 헬퍼 (attackerId로 기여도 추적)
  const processLogEntry = useCallback((l, targetId, attackerId) => {
    addLog(l.text, l.type);
    if (l.type === 'damage') {
      const tid = l.targetId || targetId;
      const dmgMatch = l.text.match(/(\d+) 피해/);
      const dmg = dmgMatch ? parseInt(dmgMatch[1]) : 0;
      addPopup(tid, `-${dmg || '?'}`, l.isCrit ? 'crit' : 'damage');
      if (l.isCrit) {
        addPopup(tid, '치명타!', 'crit-label');
        addHitEffect(tid, 'crit');
      }
      if (l.elementLabel) addPopup(tid, l.elementLabel, l.elementMult > 1 ? 'element-strong' : 'element-weak');
      // 기여도 기록
      if (attackerId && dmg > 0) {
        const c = contributionRef.current;
        if (!c[attackerId]) c[attackerId] = { damage: 0, kills: 0 };
        c[attackerId].damage += dmg;
      }
    }
    if (l.type === 'evade') {
      const tid = l.targetId || targetId;
      addPopup(tid, 'MISS', 'evade');
      addHitEffect(tid, 'evade');
    }
    if (l.type === 'heal') {
      const tid = l.targetId || targetId;
      addPopup(tid, `+${l.text.match(/\+(\d+)/)?.[1] || '?'}`, 'heal');
    }
    if (l.type === 'kill') {
      const tid = l.targetId || targetId;
      addPopup(tid, 'KO', 'kill');
      // 킬 기여도 기록
      if (attackerId) {
        const c = contributionRef.current;
        if (!c[attackerId]) c[attackerId] = { damage: 0, kills: 0 };
        c[attackerId].kills += 1;
      }
    }
  }, [addLog, addPopup, addHitEffect]);

  // 드랍 아이콘 애니메이션
  const addDropAnim = useCallback((unitId, icon, name) => {
    const id = Date.now() + Math.random();
    setDropAnims(prev => [...prev, { id, unitId, icon, name }]);
    setTimeout(() => setDropAnims(prev => prev.filter(d => d.id !== id)), 1800);
  }, []);

  // 몬스터 사망 시 드랍 아이콘 표시
  const monsterDropsRef = useRef({});
  const showMonsterDropAnim = useCallback((deadUnit) => {
    // monsterDropsRef에 캐시된 드랍 데이터 사용
    const drops = monsterDropsRef.current[deadUnit.name];
    if (!drops || drops.length === 0) return;
    let delay = 0;
    drops.forEach(d => {
      if (Math.random() < d.drop_rate) {
        setTimeout(() => addDropAnim(deadUnit.id, d.icon, d.name), delay);
        delay += 300;
      }
    });
  }, [addDropAnim]);

  // 투사체 추가 (projectileType: 'arrow' | 'magic' | 'fire' | 'ice' | 'lightning' | 'dark' | 'heal' | 'default')
  const addProjectile = useCallback((attackerId, targetId, projectileType = 'default') => {
    const id = ++projectileId.current;
    setProjectiles(prev => [...prev, { id, attackerId, targetId, projectileType }]);
    setTimeout(() => setProjectiles(prev => prev.filter(p => p.id !== id)), 800);
  }, []);

  // 스킬 이름으로 투사체 타입 결정
  const getProjectileType = useCallback((rangeType, skill = null) => {
    if (skill) {
      const name = skill.name || '';
      const icon = skill.icon || '';
      if (name.includes('화염') || name.includes('불') || icon === '🔥') return 'fire';
      if (name.includes('얼음') || name.includes('빙') || icon === '❄️') return 'ice';
      if (name.includes('번개') || icon === '⚡') return 'lightning';
      if (name.includes('암흑') || name.includes('저주') || icon === '🌑' || icon === '🔮') return 'dark';
      if (name.includes('치유') || name.includes('대치유') || icon === '💚' || icon === '💖') return 'heal';
      if (name.includes('독') || icon === '☠️' || icon === '💨') return 'poison';
      if (name.includes('마법 화살') || icon === '🏹') return 'arrow';
    }
    if (rangeType === 'magic') return 'magic';
    if (rangeType === 'ranged') return 'arrow';
    return 'default';
  }, []);

  // 전투 애니메이션 실행 (Promise 기반)
  const playCombatAnimation = useCallback((attacker, target, rangeType, skill = null) => {
    return new Promise((resolve) => {
      if (rangeType === 'ranged' || rangeType === 'magic') {
        // 원거리/마법: 공격자 반동 + 투사체 발사
        const pType = getProjectileType(rangeType, skill);
        setCombatAnim({ attackerId: attacker.id, targetId: target.id, type: rangeType, phase: 'cast' });
        setTimeout(() => {
          addProjectile(attacker.id, target.id, pType);
          setTimeout(() => {
            addHitEffect(target.id);
            setCombatAnim(null);
            resolve();
          }, 400);
        }, 200);
      } else {
        // 근거리: 카드가 타겟 방향으로 돌진 -> 타격 -> 복귀
        setCombatAnim({ attackerId: attacker.id, targetId: target.id, type: 'melee', phase: 'rush' });
        setTimeout(() => {
          setCombatAnim(prev => prev ? { ...prev, phase: 'hit' } : null);
          addHitEffect(target.id);
          setTimeout(() => {
            setCombatAnim(prev => prev ? { ...prev, phase: 'return' } : null);
            setTimeout(() => {
              setCombatAnim(null);
              resolve();
            }, 250);
          }, 200);
        }, 300);
      }
    });
  }, [addProjectile, addHitEffect, getProjectileType]);

  // 스킬 발동 컷인 연출
  const playSkillCutIn = useCallback((skill, caster) => {
    return new Promise((resolve) => {
      setSkillCutIn({
        skillName: skill.name,
        skillIcon: skill.icon || '✨',
        skillIconUrl: skill.iconUrl || null,
        skillType: skill.type,
        casterName: caster.name,
      });
      setTimeout(() => {
        setSkillCutIn(null);
        resolve();
      }, 1000);
    });
  }, []);

  // 초기화
  useEffect(() => {
    if (phase !== 'init') return;
    if (initDoneRef.current) return; // 이미 초기화 완료
    initDoneRef.current = true;

    const initBattle = async () => {
      const playerUnit = createCardPlayerUnit(
        {
          ...character,
          level: charState.level,
          hp: charState.maxHp, mp: charState.maxMp,
          current_hp: charState.currentHp, current_mp: charState.currentMp,
          attack: charState.attack, defense: charState.defense,
          phys_attack: charState.physAttack, phys_defense: charState.physDefense,
          mag_attack: charState.magAttack, mag_defense: charState.magDefense,
          crit_rate: charState.critRate, evasion: charState.evasion,
        },
        learnedSkills,
        passiveBonuses
      );

      // 최신 진형/소환수/용병 데이터를 서버에서 가져오기
      let freshSummons = activeSummons || [];
      let freshMercenaries = activeMercenaries || [];
      let formationGrid = null;
      let cosmeticMap = {};
      try {
        const [summonRes, mercRes, fRes, cosmeticRes] = await Promise.all([
          api.get('/summon/my'),
          api.get('/mercenary/my'),
          api.get('/formation/list'),
          api.get('/shop/cosmetics/equipped').catch(() => ({ data: { cosmetics: {} } })),
        ]);
        freshSummons = summonRes.data.summons || [];
        freshMercenaries = mercRes.data.mercenaries || [];
        cosmeticMap = cosmeticRes.data.cosmetics || {};
        const mainFormation = fRes.data.formations.find(f => f.slotIndex === 0);
        if (mainFormation && mainFormation.gridData) {
          const grid = mainFormation.gridData;
          const hasUnits = grid.some(row => row.some(cell => cell && cell.unitId));
          if (hasUnits) formationGrid = grid;
        }
      } catch {}

      // 진형에 배치된 유닛만 참전 (진형이 있는 경우)
      const formationUnitIds = new Set();
      if (formationGrid) {
        formationGrid.forEach(row => row.forEach(cell => {
          if (cell && cell.unitId) formationUnitIds.add(cell.unitId);
        }));
      }
      const battleSummons = formationGrid
        ? freshSummons.filter(s => formationUnitIds.has(`summon_${s.id}`))
        : freshSummons;
      const battleMercs = formationGrid
        ? freshMercenaries.filter(m => formationUnitIds.has(`merc_${m.id}`))
        : freshMercenaries;
      battleSummonIdsRef.current = battleSummons.map(s => s.id);
      battleMercIdsRef.current = battleMercs.map(m => m.id);

      const summonUnits = battleSummons.slice(0, 5).map(s => createCardSummonUnit(s));
      const mercUnits = battleMercs.slice(0, 5).map(m => createCardMercenaryUnit(m));
      const playerTeam = [playerUnit, ...summonUnits, ...mercUnits].slice(0, 9);

      // 코스메틱 효과 주입 (장착된 오라가 없으면 기본 오라 적용)
      for (const unit of playerTeam) {
        const cm = cosmeticMap[unit.id];
        if (cm) {
          unit.portraitEffect = cm.effect;
        } else {
          const el = unit.element || (unit.id === 'player' ? CLASS_ELEMENT_MAP[unit.classType] : null) || 'neutral';
          unit.portraitEffect = ELEMENT_AURA_MAP[el] || 'aura_gold';
        }
      }

      // 진영 데이터가 있으면 적용
      if (formationGrid) {
        const placedIds = new Set();
        formationGrid.forEach((row, ri) => {
          row.forEach((cell, ci) => {
            if (!cell || !cell.unitId) return;
            const unit = playerTeam.find(u => u.id === cell.unitId);
            if (unit) {
              unit.gridRow = ri;
              unit.gridCol = ci;
              // col 기준으로 row 결정: col0=후열, col1=중열, col2=전열
              unit.row = ci >= 2 ? 'front' : 'back';
              placedIds.add(unit.id);
            }
          });
        });

        // 진영에 배치되지 않은 유닛은 빈 칸에 자동 배치
        const unplaced = playerTeam.filter(u => !placedIds.has(u.id));
        if (unplaced.length > 0) {
          const occupied = new Set();
          formationGrid.forEach((row, ri) => {
            row.forEach((cell, ci) => {
              if (cell && cell.unitId && playerTeam.some(u => u.id === cell.unitId)) {
                occupied.add(`${ri},${ci}`);
              }
            });
          });
          const emptyCells = [];
          for (let r = 0; r < 3; r++) {
            for (let c = 0; c < 3; c++) {
              if (!occupied.has(`${r},${c}`)) emptyCells.push({ r, c });
            }
          }
          unplaced.forEach((u, idx) => {
            if (idx < emptyCells.length) {
              u.gridRow = emptyCells[idx].r;
              u.gridCol = emptyCells[idx].c;
              u.row = emptyCells[idx].c >= 2 ? 'front' : 'back';
            }
          });
        }

        // 적군은 기본 배치
        const { enemyTeam, eliteInfo } = buildEnemyTeam();
        const eFront = enemyTeam.filter(u => u.row === 'front');
        if (eFront.length === 0 && enemyTeam.length > 0) enemyTeam[0].row = 'front';
        // 적군만 assignGridPositions의 적 로직 적용
        assignEnemyGrid(enemyTeam);

        finalizeBattle(playerTeam, enemyTeam, eliteInfo);
      } else {
        // 진영 데이터 없으면 기존 로직
        const { enemyTeam, eliteInfo } = buildEnemyTeam();

        const pFront = playerTeam.filter(u => u.row === 'front');
        if (pFront.length === 0 && playerTeam.length > 0) playerTeam[0].row = 'front';
        const eFront = enemyTeam.filter(u => u.row === 'front');
        if (eFront.length === 0 && enemyTeam.length > 0) enemyTeam[0].row = 'front';

        assignGridPositions(playerTeam, enemyTeam);
        finalizeBattle(playerTeam, enemyTeam, eliteInfo);
      }
    };

    // === 구간 레벨 + 부분 스케일링 시스템 ===
    // zoneLv: 스테이지 기준 레벨, playerLv: 플레이어 레벨
    // s=0.5: 플레이어가 구간보다 높아도 몬스터는 50%만 따라감
    // → 노가다하면 세지지만 완전 무쌍은 안 되는 구조
    const SCALE_RATIO = 0.5;
    const calcEffectiveLevel = (zoneLvMin, zoneLvMax, playerLv) => {
      if (isPrologue) return 1;
      const zoneMid = (zoneLvMin + zoneLvMax) / 2;
      const maxGap = (zoneLvMax - zoneLvMin) + 5;
      const gap = Math.max(0, playerLv - zoneMid);
      const scaledGap = Math.min(gap, maxGap) * SCALE_RATIO;
      return Math.max(zoneLvMin, Math.floor(zoneMid + scaledGap));
    };

    const scaleMonsterStats = (template, effectiveLv) => {
      if (isPrologue) {
        return {
          ...template, level: 1,
          hp: Math.max(5, Math.floor(template.hp * 0.05)),
          attack: Math.max(1, Math.floor(template.attack * 0.05)),
          defense: Math.floor((template.defense || 0) * 0.05),
          phys_attack: Math.max(1, Math.floor((template.phys_attack || 0) * 0.05)),
          mag_attack: Math.max(1, Math.floor((template.mag_attack || 0) * 0.05)),
          phys_defense: 0, mag_defense: 0,
          crit_rate: 0, evasion: 0, skills: [],
        };
      }
      const lv = effectiveLv - 1;
      // HP: 레벨당 +10%, 공격: +8%, 방어: +4%
      const scaled = {
        ...template,
        level: effectiveLv,
        hp: Math.max(10, Math.floor(template.hp * (1 + lv * 0.10))),
        attack: Math.max(2, Math.floor(template.attack * (1 + lv * 0.08))),
        defense: Math.floor((template.defense || 0) * (1 + lv * 0.04)),
        phys_attack: Math.max(2, Math.floor((template.phys_attack || 0) * (1 + lv * 0.08))),
        mag_attack: Math.max(1, Math.floor((template.mag_attack || 0) * (1 + lv * 0.08))),
        phys_defense: Math.floor((template.phys_defense || 0) * (1 + lv * 0.04)),
        mag_defense: Math.floor((template.mag_defense || 0) * (1 + lv * 0.04)),
      };
      // 초반 스테이지(Lv1~3): 몬스터 스킬 제거 → 일반공격만 사용
      if (effectiveLv <= 3) {
        scaled.skills = [];
      }
      return scaled;
    };

    const buildEnemyTeam = () => {
      const monsterCount = Math.min(stage.monsterCount || 3, 9);
      const availableMonsters = monsters || [];
      const playerLv = character?.level || 1;
      const zoneLvMin = stage.monsterLevelMin || 1;
      const zoneLvMax = stage.monsterLevelMax || 3;
      const effectiveLv = calcEffectiveLevel(zoneLvMin, zoneLvMax, playerLv);

      // 저장된 적 구성이 있으면 그대로 복원 (정예 리롤 방지)
      if (savedEnemySetup && savedEnemySetup.length > 0) {
        let eliteInfo = null;
        const enemyTeam = [];
        for (let i = 0; i < savedEnemySetup.length; i++) {
          const setup = savedEnemySetup[i];
          const template = availableMonsters.find(m => m.id === setup.templateId);
          if (!template) continue;
          let scaled = scaleMonsterStats(template, setup.level);
          if (setup.eliteTier) {
            scaled = applyEliteStats(scaled, setup.eliteTier);
            eliteInfo = { name: scaled.name, icon: scaled.icon, monsterId: scaled.id, tier: setup.eliteTier };
          }
          enemyTeam.push(createCardMonsterUnit(scaled, i));
        }
        return { enemyTeam, eliteInfo };
      }

      // 프롤로그 및 미클리어 스테이지에서는 정예 등장 안 함
      const eliteTier = (isPrologue || !isStageCleared) ? null : rollEliteTier();
      const eliteIdx = eliteTier ? Math.floor(Math.random() * monsterCount) : -1;

      // 스테이지 레벨 범위에 맞는 티어만 등장하도록 필터링
      const maxTier = Math.ceil(zoneLvMax / 3);
      const tierFiltered = availableMonsters.filter(m => (m.tier || 1) <= maxTier);
      const monsterPool = tierFiltered.length > 0 ? tierFiltered : availableMonsters;

      let eliteInfo = null;
      const enemyTeam = [];
      const enemySetup = [];
      for (let i = 0; i < monsterCount && monsterPool.length > 0; i++) {
        const template = monsterPool[Math.floor(Math.random() * monsterPool.length)];
        // 개별 몬스터 레벨에 약간의 랜덤 편차 (±1)
        const lvVariance = Math.floor(Math.random() * 3) - 1;
        const monLv = Math.max(1, effectiveLv + lvVariance);
        let scaled = scaleMonsterStats(template, monLv);

        const isElite = (i === eliteIdx && eliteTier);
        if (isElite) {
          scaled = applyEliteStats(scaled, eliteTier);
          eliteInfo = { name: scaled.name, icon: scaled.icon, monsterId: scaled.id, tier: eliteTier };
        }

        enemySetup.push({ templateId: template.id, level: monLv, eliteTier: isElite ? eliteTier : null });
        enemyTeam.push(createCardMonsterUnit(scaled, i));
      }

      // 적 구성을 DB 세션에 저장 (정예 리롤 방지, 프롤로그 제외)
      if (!isPrologue) {
        try {
          api.post('/battle/session/save', {
            battleType: 'stage',
            context: {
              dungeonKey: stage.dungeonKey || 'forest',
              stage, monsters, groupKey,
              enemySetup,
            },
          });
        } catch {}
      }

      return { enemyTeam, eliteInfo };
    };

    const assignEnemyGrid = (enemyTeam) => {
      const front = enemyTeam.filter(u => u.row === 'front');
      const back = enemyTeam.filter(u => u.row === 'back');
      front.slice(0, 3).forEach((u, i) => { u.gridCol = 0; u.gridRow = i; });
      back.slice(0, 3).forEach((u, i) => { u.gridCol = 2; u.gridRow = i; });
      const overflow = [...front.slice(3), ...back.slice(3)];
      overflow.slice(0, 3).forEach((u, i) => { u.gridCol = 1; u.gridRow = i; });
    };

    const finalizeBattle = async (playerTeam, enemyTeam, eliteInfo) => {
      const allUnits = [...playerTeam, ...enemyTeam];
      setUnits(allUnits);
      if (eliteInfo) setEliteAlert(eliteInfo);

      const order = calculateTurnOrder(allUnits);
      setTurnOrder(order);
      setCurrentTurnIdx(0);
      setRound(1);

      // 물약 인벤토리 로드
      try {
        const invRes = await api.get('/shop/inventory');
        const potionItems = (invRes.data.inventory || []).filter(i => (i.type === 'potion' || i.type === 'talisman') && i.quantity > 0);
        setPotions(potionItems);
      } catch {}

      // 몬스터 드랍 데이터 프리로드
      const enemyNames = [...new Set(enemyTeam.map(u => u.name))];
      try {
        const dropRes = await api.post('/battle/monster-drops', { monsterNames: enemyNames });
        if (dropRes.data.drops) monsterDropsRef.current = dropRes.data.drops;
      } catch {}

      addLog(`=== 전투 시작: ${stage.name} ===`, 'system');
      addLog(`아군 ${playerTeam.length}명 vs 적 ${enemyTeam.length}명`, 'system');

      const startFirstTurn = () => {
        const firstUnit = allUnits.find(u => u.id === order[0]);
        if (firstUnit) {
          onTurnStart(firstUnit);
          if (firstUnit.team === 'player') {
            setPhase('player_action');
          } else {
            setPhase('enemy_turn');
          }
        }
      };

      // 입장 연출 후 전투 시작
      setBattleEntering(true);
      setTimeout(() => {
        setBattleEntering(false);
        startFirstTurn();
      }, 1800);
    };

    initBattle();
  }, [phase, character, charState, learnedSkills, activeSummons, activeMercenaries, monsters, stage, addLog]);

  // 로그 자동 스크롤
  useEffect(() => {
    if (logRef.current) logRef.current.scrollTop = logRef.current.scrollHeight;
  }, [logs]);

  const getCurrentUnit = useCallback(() => {
    if (turnOrder.length === 0) return null;
    const id = turnOrder[currentTurnIdx % turnOrder.length];
    return units.find(u => u.id === id && u.hp > 0);
  }, [units, turnOrder, currentTurnIdx]);

  // ref로 최신 상태 추적 (stale closure 방지)
  const turnOrderRef = useRef(turnOrder);
  const currentTurnIdxRef = useRef(currentTurnIdx);
  const roundRef = useRef(round);
  const unitsRef = useRef(units);
  useEffect(() => { turnOrderRef.current = turnOrder; }, [turnOrder]);
  useEffect(() => { currentTurnIdxRef.current = currentTurnIdx; }, [currentTurnIdx]);
  useEffect(() => { roundRef.current = round; }, [round]);
  useEffect(() => { unitsRef.current = units; }, [units]);
  const autoAllRef = useRef(autoAll);
  const autoCompanionRef = useRef(autoCompanion);
  useEffect(() => { autoAllRef.current = autoAll; }, [autoAll]);
  useEffect(() => { autoCompanionRef.current = autoCompanion; }, [autoCompanion]);

  const advanceTurn = useCallback(() => {
    const currentUnits = unitsRef.current;
    const end = checkBattleEnd(currentUnits);
    if (end) {
      setBattleResult(end);
      // 프롤로그는 승리 팝업 건너뛰고 바로 종료
      if (isPrologue && end === 'victory') {
        onBattleEnd('victory', 0, 0);
        return;
      }
      setPhase('battle_end');
      return;
    }

    let curOrder = turnOrderRef.current;
    let nextIdx = currentTurnIdxRef.current + 1;
    let newRound = roundRef.current;

    if (nextIdx >= curOrder.length) {
      newRound++;
      curOrder = calculateTurnOrder(currentUnits);
      setTurnOrder(curOrder);
      turnOrderRef.current = curOrder;
      nextIdx = 0;
      setRound(newRound);
      roundRef.current = newRound;
      addLog(`\n=== 라운드 ${newRound} ===`, 'system');
    }

    // 죽은 유닛 건너뛰기 (최대 turnOrder 길이만큼만 시도)
    let attempts = 0;
    while (attempts < curOrder.length) {
      if (nextIdx >= curOrder.length) {
        newRound++;
        curOrder = calculateTurnOrder(currentUnits);
        setTurnOrder(curOrder);
        turnOrderRef.current = curOrder;
        nextIdx = 0;
        setRound(newRound);
        roundRef.current = newRound;
        addLog(`\n=== 라운드 ${newRound} ===`, 'system');
      }

      const nextUnit = currentUnits.find(u => u.id === curOrder[nextIdx] && u.hp > 0);
      if (nextUnit) {
        setCurrentTurnIdx(nextIdx);
        currentTurnIdxRef.current = nextIdx;
        onTurnStart(nextUnit);
        if (nextUnit.team === 'player') {
          setPhase('player_action');
        } else {
          setPhase('enemy_turn');
        }
        return;
      }
      nextIdx++;
      attempts++;
    }

    // 모든 유닛이 죽은 경우 (여기까지 오면 안되지만 안전장치)
    const end2 = checkBattleEnd(currentUnits);
    setBattleResult(end2 || 'defeat');
    setPhase('battle_end');
  }, [addLog]);

  // 아군 자동전투 AI 결정
  const decidePlayerAutoAction = useCallback((unit, allUnits) => {
    const allies = allUnits.filter(u => u.team === 'player' && u.hp > 0);
    const enemies = allUnits.filter(u => u.team === 'enemy' && u.hp > 0);
    if (enemies.length === 0) return { action: 'wait' };

    const attackType = (unit.rangeType === 'ranged' || unit.rangeType === 'magic') ? unit.rangeType : 'melee';
    const validTargets = getValidTargets(unit, enemies, attackType);

    const usableSkills = unit.skills.filter(s => {
      if (s.currentCooldown > 0 || (s.mp_cost || 0) > unit.mp) return false;
      if (s.auto_priority !== undefined && Number(s.auto_priority) <= 0) return false;
      return true;
    });

    // 아군 체력이 50% 미만이면 치유 스킬 우선
    const healSkill = usableSkills.find(s => s.type === 'heal');
    if (healSkill) {
      const hurtAlly = allies.find(u => u.hp < u.maxHp * 0.5);
      if (hurtAlly) return { action: 'skill', skill: healSkill, target: hurtAlly };
    }

    // 버프 스킬 (30% 확률)
    const buffSkill = usableSkills.find(s => s.type === 'buff');
    if (buffSkill && Math.random() < 0.3) {
      const buffTarget = allies[Math.floor(Math.random() * allies.length)];
      return { action: 'skill', skill: buffSkill, target: buffTarget };
    }

    // 공격 스킬 (50% 확률)
    if (usableSkills.length > 0 && Math.random() < 0.5) {
      const atkSkills = usableSkills.filter(s => s.type === 'attack' || s.type === 'aoe' || s.type === 'debuff');
      if (atkSkills.length > 0) {
        const skill = atkSkills[Math.floor(Math.random() * atkSkills.length)];
        if (skill.type === 'aoe') {
          return { action: 'skill', skill, target: enemies[0] };
        }
        if (skill.type === 'debuff') {
          if (validTargets.length > 0) {
            return { action: 'skill', skill, target: validTargets[0] };
          }
          return { action: 'wait' };
        }
        if (validTargets.length > 0) {
          const target = validTargets.reduce((a, b) => a.hp < b.hp ? a : b);
          return { action: 'skill', skill, target };
        }
      }
    }

    // 기본 공격: HP 가장 낮은 적 우선
    if (validTargets.length > 0) {
      const target = validTargets.reduce((a, b) => a.hp < b.hp ? a : b);
      return { action: 'attack', target };
    }

    return { action: 'wait' };
  }, []);

  // 아군 자동전투 실행 (autoAll 또는 autoCompanion)
  const executeAutoPlayerTurn = useCallback(async (unit) => {
    setAnimatingUnit(unit.id);
    setPhase('animating');
    const currentUnits = unitsRef.current;
    const decision = decidePlayerAutoAction(unit, currentUnits);

    if (!decision || decision.action === 'wait') {
      addLog(`${unit.name} 대기 (자동)`, 'system');
    } else if (decision.action === 'attack') {
      await playCombatAnimation(unit, decision.target, unit.rangeType);
      const attackLogs = executeAttack(unit, decision.target, currentUnits);
      attackLogs.forEach(l => {
        processLogEntry(l, decision.target.id, unit.id);
        if (l.type === 'kill' && decision.target.team === 'enemy') showMonsterDropAnim(decision.target);
      });
    } else if (decision.action === 'skill' && decision.skill) {
      await playSkillCutIn(decision.skill, unit);
      const skillRange = (decision.skill.range_val || decision.skill.range || 1) >= 2 ? 'ranged' : unit.rangeType;
      const isOffensive = decision.skill.type === 'attack' || decision.skill.type === 'aoe' || decision.skill.type === 'debuff';
      if (isOffensive && decision.target) {
        await playCombatAnimation(unit, decision.target, skillRange, decision.skill);
      }
      const result = executeSkill(unit, decision.skill, decision.target, currentUnits);
      result.logs.forEach(l => {
        processLogEntry(l, decision.target?.id, unit.id);
        if (l.type === 'kill' && (l.targetId || decision.target?.id)) {
          const deadUnit = currentUnits.find(u => u.id === (l.targetId || decision.target?.id));
          if (deadUnit?.team === 'enemy') showMonsterDropAnim(deadUnit);
        }
      });
    }

    setUnits([...currentUnits]);
    setTimeout(() => {
      setAnimatingUnit(null);
      advanceTurn();
    }, 400);
  }, [decidePlayerAutoAction, processLogEntry, playCombatAnimation, playSkillCutIn, showMonsterDropAnim, advanceTurn]);

  // 자동전투: player_action일 때 자동 실행
  useEffect(() => {
    if (phase !== 'player_action') return;
    const current = getCurrentUnit();
    if (!current || current.team !== 'player') return;

    // autoAll이면 모든 아군 자동
    // autoCompanion이면 소환수/용병만 자동 (id가 'player'가 아닌 유닛)
    const shouldAuto = autoAll || (autoCompanion && current.id !== 'player');
    if (!shouldAuto) return;

    const timer = setTimeout(() => {
      executeAutoPlayerTurn(current);
    }, 400);
    return () => clearTimeout(timer);
  }, [phase, autoAll, autoCompanion, getCurrentUnit, executeAutoPlayerTurn]);

  // 적 턴 자동 실행
  useEffect(() => {
    if (phase !== 'enemy_turn') return;
    const current = getCurrentUnit();
    if (!current || current.team !== 'enemy') {
      // 안전장치: 빈 enemy_turn이면 바로 다음 턴으로
      const tid = setTimeout(() => advanceTurn(), 50);
      return () => clearTimeout(tid);
    }

    const timer = setTimeout(async () => {
      setAnimatingUnit(current.id);
      const currentUnits = unitsRef.current;
      const decision = decideAIAction(current, currentUnits);

      if (!decision || decision.action === 'wait') {
        addLog(`${current.name} 대기`, 'system');
      } else if (decision.action === 'attack') {
        await playCombatAnimation(current, decision.target, current.rangeType);
        const attackLogs = executeAttack(current, decision.target, currentUnits);
        attackLogs.forEach(l => processLogEntry(l, decision.target.id, current.id));
      } else if (decision.action === 'skill') {
        await playSkillCutIn(decision.skill, current);
        const skillRange = (decision.skill.range_val || decision.skill.range || 1) >= 2 ? 'ranged' : current.rangeType;
        const isOffensive = decision.skill.type === 'attack' || decision.skill.type === 'aoe' || decision.skill.type === 'debuff';
        if (isOffensive && decision.target) {
          await playCombatAnimation(current, decision.target, skillRange, decision.skill);
        }
        const result = executeSkill(current, decision.skill, decision.target, currentUnits);
        result.logs.forEach(l => processLogEntry(l, decision.target?.id, current.id));
      } else if (decision.action === 'guard') {
        const guardLogs = executeGuard(current, decision.target);
        guardLogs.forEach(l => addLog(l.text, l.type));
      }

      setUnits([...currentUnits]);
      setTimeout(() => {
        setAnimatingUnit(null);
        advanceTurn();
      }, 400);
    }, 500);

    return () => clearTimeout(timer);
  }, [phase, getCurrentUnit, advanceTurn, addLog, addPopup]);

  // 전투 종료 처리
  useEffect(() => {
    if (phase !== 'battle_end' || !battleResult) return;
    const rewards = calculateRewards(units, stage);
    const playerUnit = units.find(u => u.id === 'player');
    if (battleResult === 'victory') {
      setTotalExpGained(rewards.exp);
      setTotalGoldGained(rewards.gold);

      // 기여도 계산 (아군만)
      const contribData = contributionRef.current;
      const playerTeam = units.filter(u => u.team === 'player');
      const totalDamage = Object.values(contribData).reduce((sum, c) => sum + c.damage, 0) || 1;
      const contribList = playerTeam.map(u => {
        const c = contribData[u.id] || { damage: 0, kills: 0 };
        const rawPct = c.damage / totalDamage;
        return { id: u.id, name: u.name, icon: u.icon, imageUrl: u.imageUrl, damage: c.damage, kills: c.kills, rawPct };
      });
      // 최소 참여 보너스: 살아있었던 유닛에게 최소 5% 보장
      const participantCount = contribList.filter(c => c.damage > 0 || units.find(u => u.id === c.id)?.hp > 0).length || 1;
      const minPct = Math.min(0.05, 1 / participantCount);
      let adjustedPcts = contribList.map(c => {
        const participated = c.damage > 0 || (units.find(u => u.id === c.id)?.hp ?? 0) > 0;
        return { ...c, adjPct: participated ? Math.max(minPct, c.rawPct) : 0 };
      });
      const totalAdjPct = adjustedPcts.reduce((s, c) => s + c.adjPct, 0) || 1;
      const finalContrib = adjustedPcts.map(c => ({
        ...c,
        pct: Math.round((c.adjPct / totalAdjPct) * 100),
        exp: Math.floor(rewards.exp * (c.adjPct / totalAdjPct)),
      }));
      setContributions(finalContrib);

      // 서버에 전달할 각 유닛별 경험치
      const playerExp = finalContrib.find(c => c.id === 'player')?.exp || rewards.exp;
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

      addLog(`\n전투 승리! EXP +${rewards.exp}, Gold +${rewards.gold}`, 'heal');
      const deadEnemyUnits = units.filter(u => u.team === 'enemy' && u.hp <= 0);
      const deadEnemies = deadEnemyUnits.map(u => u.name);
      // 몬스터 도감 기록
      const defeatedMonsterIds = deadEnemyUnits.map(u => u.monsterId).filter(Boolean);
      if (defeatedMonsterIds.length > 0) {
        api.post('/monsters/record-kills', { monsterIds: defeatedMonsterIds }).catch(() => {});
      }
      api.post('/stage/battle-result', {
        monstersDefeated: deadEnemies,
        expGained: playerExp,
        goldGained: rewards.gold,
        victory: true,
        groupKey: groupKey || null,
        activeSummonIds: battleSummonIdsRef.current,
        activeMercenaryIds: battleMercIdsRef.current,
        summonExpMap,
        mercExpMap,
        playerHp: playerUnit ? playerUnit.hp : 0,
        playerMp: playerUnit ? playerUnit.mp : 0,
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
      }).catch(() => {
        // API 실패 시에도 결과 화면 진행 가능하도록 fallback
        setResultData({ character: null, leveledUp: false });
      });
    } else {
      addLog(`\n전투 패배...`, 'damage');
      api.post('/stage/battle-result', {
        monstersDefeated: [], expGained: 0, goldGained: 0, victory: false,
        playerHp: 0, playerMp: 0,
        activeSummonIds: battleSummonIdsRef.current,
        activeMercenaryIds: battleMercIdsRef.current,
      }).catch(() => {});
      // 패배 패널티 적용
      api.post('/battle/session/penalty', { penaltyType: 'defeat' }).then(res => {
        if (res.data.penalty) {
          const p = res.data.penalty;
          setDefeatPenalty(p);
          addLog(`패배 패널티: 골드 -${p.goldLoss}, 경험치 -${p.expLoss}`, 'damage');
        }
      }).catch(() => {});
    }
  }, [phase, battleResult, units, stage, addLog]); // eslint-disable-line

  // === 플레이어 액션 핸들러 ===

  const [showSkillList, setShowSkillList] = useState(false);

  const handleSelectAction = (action) => {
    setSelectedAction(action);
    setSelectedSkill(null);
    setShowSkillList(false);
    setShowItemList(false);
    if (action === 'retreat') {
      setRetreatDisplayPct(Math.floor(Math.random() * 41) + 30);
      setShowRetreatConfirm(true);
      return;
    }
    if (action === 'wait') {
      const current = getCurrentUnit();
      if (current) addLog(`${current.name} 대기`, 'system');
      advanceTurn();
      return;
    }
    if (action === 'skill') {
      setShowSkillList(true);
      return;
    }
    if (action === 'items') {
      setShowItemList(true);
      return;
    }
    if (action === 'attack' || action === 'guard') {
      setPhase('select_target');
    }
  };

  // 물약/부적 사용
  const handleUseItem = async (item) => {
    const current = getCurrentUnit();
    if (!current || current.id !== 'player') return;

    try {
      const res = await api.post('/shop/use', { itemId: item.item_id });
      const { current_hp, current_mp } = res.data.character;

      if (item.type === 'talisman') {
        // 부적: 버프 적용
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
        addLog(`${current.name}이(가) ${item.name} 사용! (${effectText})`, 'buff');
        addPopup('player', `📜 ${item.name}`, 'buff');
      } else {
        // 물약: HP/MP 업데이트
        setUnits(prev => prev.map(u => {
          if (u.id !== 'player') return u;
          const newHp = Math.min(u.maxHp, current_hp);
          const newMp = Math.min(u.maxMp, current_mp);
          return { ...u, hp: newHp, mp: newMp };
        }));
        const healText = [];
        if (item.effect_hp > 0) healText.push(`HP +${item.effect_hp}`);
        if (item.effect_mp > 0) healText.push(`MP +${item.effect_mp}`);
        addLog(`${current.name}이(가) ${item.name} 사용! (${healText.join(', ')})`, 'heal');
        addPopup('player', `+${healText.join(' ')}`, 'heal');
      }

      // 인벤토리 업데이트
      setPotions(prev => prev.map(p => {
        if (p.item_id !== item.item_id) return p;
        return { ...p, quantity: p.quantity - 1 };
      }).filter(p => p.quantity > 0));

      setShowItemList(false);
      advanceTurn();
    } catch (err) {
      addLog(err.response?.data?.message || '아이템 사용 실패', 'system');
    }
  };

  const handleSelectSkill = (skill) => {
    setSelectedSkill(skill);
    setSelectedAction('skill');
    setShowSkillList(false);
    setPhase('select_target');
  };

  const handleSelectTarget = async (target) => {
    const current = getCurrentUnit();
    if (!current) return;

    setAnimatingUnit(current.id);
    setPhase('animating');
    const currentUnits = unitsRef.current;

    if (selectedAction === 'attack') {
      await playCombatAnimation(current, target, current.rangeType);
      const attackLogs = executeAttack(current, target, currentUnits);
      attackLogs.forEach(l => {
        processLogEntry(l, target.id, current.id);
        if (l.type === 'kill' && target.team === 'enemy') showMonsterDropAnim(target);
      });
    } else if (selectedAction === 'skill' && selectedSkill) {
      await playSkillCutIn(selectedSkill, current);
      const skillRange = (selectedSkill.range_val || selectedSkill.range || 1) >= 2 ? 'ranged' : current.rangeType;
      const isOffensive = selectedSkill.type === 'attack' || selectedSkill.type === 'aoe' || selectedSkill.type === 'debuff';
      if (isOffensive) {
        await playCombatAnimation(current, target, skillRange, selectedSkill);
      }
      const result = executeSkill(current, selectedSkill, target, currentUnits);
      result.logs.forEach(l => {
        processLogEntry(l, target.id, current.id);
        if (l.type === 'kill') {
          const deadUnit = currentUnits.find(u => u.id === (l.targetId || target.id));
          if (deadUnit?.team === 'enemy') showMonsterDropAnim(deadUnit);
        }
      });
    } else if (selectedAction === 'guard') {
      const guardLogs = executeGuard(current, target);
      guardLogs.forEach(l => addLog(l.text, l.type));
      addPopup(target.id, '🛡️', 'guard');
    }

    setUnits([...currentUnits]);
    setSelectedAction(null);
    setSelectedSkill(null);

    setTimeout(() => {
      setAnimatingUnit(null);
      advanceTurn();
    }, 400);
  };

  const handleBattleEndClick = () => {
    if (battleResult === 'victory') {
      onBattleEnd('victory', totalExpGained, totalGoldGained);
    } else {
      onBattleEnd('defeat', 0, 0);
    }
  };

  // === 타겟 목록 계산 ===
  const getTargetList = () => {
    const current = getCurrentUnit();
    if (!current) return [];
    const currentUnits = units; // render 시점의 최신 state

    if (selectedAction === 'attack') {
      const enemies = currentUnits.filter(u => u.team !== current.team && u.hp > 0);
      return getValidTargets(current, enemies, current.rangeType);
    }
    if (selectedAction === 'skill' && selectedSkill) {
      if (selectedSkill.type === 'heal') {
        return getHealTargets(current, currentUnits.filter(u => u.team === current.team));
      }
      if (selectedSkill.type === 'buff') {
        return currentUnits.filter(u => u.team === current.team && u.hp > 0);
      }
      if (selectedSkill.type === 'debuff' || selectedSkill.type === 'attack') {
        const enemies = currentUnits.filter(u => u.team !== current.team && u.hp > 0);
        const range = (selectedSkill.range_val || selectedSkill.range || 1) >= 2 ? 'ranged' : current.rangeType;
        return getValidTargets(current, enemies, range);
      }
      if (selectedSkill.type === 'aoe') {
        const enemies = currentUnits.filter(u => u.team !== current.team && u.hp > 0);
        return enemies.length > 0 ? [enemies[0]] : [];
      }
    }
    if (selectedAction === 'guard') {
      return getGuardTargets(current, currentUnits.filter(u => u.team === current.team));
    }
    return [];
  };

  const currentUnit = getCurrentUnit();
  const validTargets = phase === 'select_target' ? getTargetList() : [];

  // 양쪽 3x3 그리드 생성 (각 팀 최대 9명)
  const buildTeamGrid = (team) => {
    const teamUnits = units.filter(u => u.team === team);
    const grid = Array(3).fill(null).map(() => Array(3).fill(null));
    teamUnits.forEach(u => {
      if (u.gridRow >= 0 && u.gridRow < 3 && u.gridCol >= 0 && u.gridCol < 3) {
        grid[u.gridRow][u.gridCol] = u;
      }
    });
    return grid;
  };
  const playerGrid = buildTeamGrid('player');
  const enemyGrid = buildTeamGrid('enemy');

  // combatAnim에서 해당 유닛의 애니메이션 클래스 결정
  const getCardAnimClass = (unitId) => {
    if (!combatAnim) return '';
    if (combatAnim.attackerId === unitId) {
      if (combatAnim.type === 'melee') {
        if (combatAnim.phase === 'rush') return 'anim-melee-rush';
        if (combatAnim.phase === 'hit') return 'anim-melee-hit';
        if (combatAnim.phase === 'return') return 'anim-melee-return';
      }
      if (combatAnim.type === 'ranged' && combatAnim.phase === 'cast') {
        return 'anim-ranged-cast';
      }
      if (combatAnim.type === 'magic' && combatAnim.phase === 'cast') {
        return 'anim-magic-cast';
      }
    }
    return '';
  };

  const getHitAnimClass = (unitId) => {
    const effect = hitEffects.find(e => e.unitId === unitId);
    if (!effect) return '';
    if (effect.effectType === 'crit') return 'hit-crit-flash';
    if (effect.effectType === 'evade') return 'hit-evade';
    return 'hit-flash';
  };

  const renderCell = (cell, zone) => {
    if (cell) {
      const animClass = getCardAnimClass(cell.id);
      const hitClass = getHitAnimClass(cell.id);
      // 근거리 공격 방향 결정 (플레이어→적: 오른쪽으로 돌진, 적→플레이어: 왼쪽으로 돌진)
      let rushDir = '';
      if (combatAnim && combatAnim.attackerId === cell.id && combatAnim.type === 'melee') {
        rushDir = cell.team === 'player' ? 'rush-right' : 'rush-left';
      }
      return (
        <div className={`cb-grid-cell occupied ${zone}`} ref={el => { if (el) cardRefsMap.current[cell.id] = el; }}>
          <UnitCard
            unit={cell}
            isCurrent={currentUnit?.id === cell.id}
            isTarget={validTargets.some(t => t.id === cell.id)}
            onSelect={() => validTargets.some(t => t.id === cell.id) && handleSelectTarget(cell)}
            animating={animatingUnit === cell.id}
            popups={damagePopups.filter(p => p.unitId === cell.id)}
            drops={dropAnims.filter(d => d.unitId === cell.id)}
            animClass={`${animClass} ${rushDir}`}
            hitClass={hitClass}
          />
        </div>
      );
    }
    return (
      <div className={`cb-grid-cell empty ${zone}`}>
        <div className="cb-empty-cell" />
      </div>
    );
  };

  return (
    <div className="card-battle">
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

      {/* 전투 배경 이미지 */}
      <div className="cb-bg-layer">
        <img src={isPrologue ? '/dungeons/swamp_bg.png' : `/stages/levels/${groupKey}_${stage.stageNumber}.png`} alt="" className="cb-bg-img" onError={(e) => { e.target.src = '/ui/battle/battle_bg.png'; e.target.onerror = () => { e.target.style.display='none'; }; }} />
        <div className="cb-bg-overlay" />
      </div>

      {/* 상단 정보 */}
      <div className="cb-header">
        <img src="/ui/battle/header_bg.png" alt="" className="cb-header-bg" onError={(e) => { e.target.style.display='none'; }} />
        <div className="cb-header-inner">
          <div className="cb-stage-name">{stage.name}</div>
          <div className="cb-round">
            <img src="/ui/battle/round_badge.png" alt="" className="cb-round-icon" onError={(e) => { e.target.style.display='none'; }} />
            라운드 {round}
          </div>
          {!isPrologue && (
            <div className="cb-auto-btns">
              <button
                className={`cb-auto-btn ${autoAll ? 'active' : ''}`}
                onClick={() => { setAutoAll(v => !v); if (!autoAll) setAutoCompanion(false); }}
                title="전체 자동전투"
              >
                {autoAll ? '⚡' : '▶'} 모두자동
              </button>
              <button
                className={`cb-auto-btn companion ${autoCompanion ? 'active' : ''}`}
                onClick={() => { setAutoCompanion(v => !v); if (!autoCompanion) setAutoAll(false); }}
                title="소환수/용병만 자동전투"
              >
                {autoCompanion ? '⚡' : '▶'} 동료자동
              </button>
            </div>
          )}
          {!isPrologue && (
            <button className="cb-retreat-btn" onClick={() => { setRetreatDisplayPct(Math.floor(Math.random() * 41) + 30); setShowRetreatConfirm(true); }} disabled={retreatDisabled} style={retreatDisabled ? {opacity:0.4, cursor:'not-allowed'} : {}}>
              <img src="/ui/battle/action_retreat.png" alt="" className="cb-btn-icon" onError={(e) => { e.target.style.display='none'; }} />
              {retreatDisabled ? '후퇴불가' : '후퇴'}
            </button>
          )}
        </div>
      </div>

      {/* 턴 순서 바 */}
      <div className="cb-turn-bar">
        <img src="/ui/battle/turnbar_bg.png" alt="" className="cb-turnbar-bg" onError={(e) => { e.target.style.display='none'; }} />
        <span className="cb-turn-label">턴 순서</span>
        {turnOrder.map((id, idx) => {
          const u = units.find(uu => uu.id === id);
          if (!u || u.hp <= 0) return null;
          return (
            <div
              key={id}
              className={`cb-turn-icon ${idx === (currentTurnIdx % turnOrder.length) ? 'active' : ''} ${u.team}`}
              title={u.name}
            >
              <TurnPortrait unit={u} />
            </div>
          );
        })}
      </div>

      {/* 배틀 필드: 아군 3x3 | VS | 적군 3x3 */}
      <div className="cb-field">
        <div className={`cb-side cb-side-player${battleEntering ? ' entering' : ''}`}>
          <div className="cb-side-label">아군</div>
          <div className="cb-side-grid">
            {playerGrid.map((row, rIdx) => (
              <React.Fragment key={rIdx}>
                {row.map((cell, cIdx) => (
                  <React.Fragment key={`p${rIdx}_${cIdx}`}>
                    {renderCell(cell, 'player-zone')}
                  </React.Fragment>
                ))}
              </React.Fragment>
            ))}
          </div>
        </div>

        <div className={`cb-vs${battleEntering ? ' entering' : ''}`}>
          <img src="/ui/battle/vs_emblem.png" alt="VS" className="cb-vs-img" onError={(e) => { e.target.style.display='none'; e.target.nextSibling.style.display=''; }} />
          <span className="cb-vs-text" style={{ display: 'none' }}>VS</span>
        </div>

        <div className={`cb-side cb-side-enemy${battleEntering ? ' entering' : ''}`}>
          <div className="cb-side-label">적군</div>
          <div className="cb-side-grid">
            {enemyGrid.map((row, rIdx) => (
              <React.Fragment key={rIdx}>
                {row.map((cell, cIdx) => (
                  <React.Fragment key={`e${rIdx}_${cIdx}`}>
                    {renderCell(cell, 'enemy-zone')}
                  </React.Fragment>
                ))}
              </React.Fragment>
            ))}
          </div>
        </div>
      </div>

      {/* 투사체 애니메이션 */}
      {projectiles.map(p => {
        const attackerEl = cardRefsMap.current[p.attackerId];
        const targetEl = cardRefsMap.current[p.targetId];
        if (!attackerEl || !targetEl) return null;
        const aRect = attackerEl.getBoundingClientRect();
        const tRect = targetEl.getBoundingClientRect();
        const fieldEl = attackerEl.closest('.card-battle');
        const fRect = fieldEl ? fieldEl.getBoundingClientRect() : { left: 0, top: 0 };
        const sx = aRect.left + aRect.width / 2 - fRect.left;
        const sy = aRect.top + aRect.height / 2 - fRect.top;
        const ex = tRect.left + tRect.width / 2 - fRect.left;
        const ey = tRect.top + tRect.height / 2 - fRect.top;
        return (
          <div
            key={p.id}
            className={`cb-projectile cb-proj-${p.projectileType || 'default'}`}
            style={{
              '--start-x': `${sx}px`, '--start-y': `${sy}px`,
              '--end-x': `${ex}px`, '--end-y': `${ey}px`,
            }}
          />
        );
      })}

      {/* 스킬 컷인 연출 */}
      {skillCutIn && (
        <div className="cb-skill-cutin">
          <div className="cb-skill-cutin-bg" />
          <div className="cb-skill-cutin-content">
            <span className="cb-skill-cutin-icon">
              {skillCutIn.skillIconUrl
                ? <img src={skillCutIn.skillIconUrl} alt="" className="cb-skill-cutin-img" onError={(e) => { e.target.style.display='none'; e.target.nextSibling && (e.target.nextSibling.style.display='inline'); }} />
                : null}
              <span style={skillCutIn.skillIconUrl ? {display:'none'} : {}}>{skillCutIn.skillIcon}</span>
            </span>
            <div className="cb-skill-cutin-info">
              <div className="cb-skill-cutin-name">{skillCutIn.skillName}</div>
              <div className="cb-skill-cutin-caster">{skillCutIn.casterName}</div>
            </div>
          </div>
        </div>
      )}

      {/* 액션 패널 */}
      {!isPrologue && phase === 'player_action' && currentUnit && currentUnit.team === 'player' && !showSkillList && !showItemList && (
        <div className="cb-actions">
          <img src="/ui/battle/action_panel_bg.png" alt="" className="cb-actions-bg" onError={(e) => { e.target.style.display='none'; }} />
          <div className="cb-actions-inner">
            <div className="cb-action-label">{currentUnit.name}의 행동 선택</div>
            <div className="cb-action-buttons">
              <button className="cb-action-btn attack" onClick={() => handleSelectAction('attack')}>
                <img src="/ui/battle/action_attack.png" alt="" className="cb-btn-icon" onError={(e) => { e.target.style.display='none'; }} />
                공격
              </button>
              <button className="cb-action-btn skill" onClick={() => handleSelectAction('skill')}>
                <img src="/ui/battle/action_skill.png" alt="" className="cb-btn-icon" onError={(e) => { e.target.style.display='none'; }} />
                스킬
              </button>
              <button className="cb-action-btn items" onClick={() => handleSelectAction('items')} disabled={potions.length === 0}>
                🧪 물품
                {potions.length > 0 && <span className="cb-item-count">{potions.reduce((a, p) => a + p.quantity, 0)}</span>}
              </button>
              <button className="cb-action-btn guard" onClick={() => handleSelectAction('guard')}>
                <img src="/ui/battle/action_guard.png" alt="" className="cb-btn-icon" onError={(e) => { e.target.style.display='none'; }} />
                수호
              </button>
              <button className="cb-action-btn wait" onClick={() => handleSelectAction('wait')}>
                <img src="/ui/battle/action_wait.png" alt="" className="cb-btn-icon" onError={(e) => { e.target.style.display='none'; }} />
                대기
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 스킬 목록 */}
      {!isPrologue && phase === 'player_action' && currentUnit && currentUnit.team === 'player' && showSkillList && (
        <div className="cb-actions">
          <div className="cb-action-label">스킬 선택</div>
          <div className="cb-action-buttons">
            {currentUnit.skills.filter(s => s.currentCooldown <= 0 && (s.mp_cost || 0) <= currentUnit.mp).length === 0 && (
              <div className="cb-no-skills">사용 가능한 스킬이 없습니다</div>
            )}
            {currentUnit.skills.filter(s => s.currentCooldown <= 0 && (s.mp_cost || 0) <= currentUnit.mp).map(skill => (
              <button
                key={skill.id || skill.name}
                className={`cb-action-btn skill ${skill.type}`}
                onClick={() => handleSelectSkill(skill)}
                title={`MP: ${skill.mp_cost || 0} | ${skill.description || ''}`}
              >
                {skill.iconUrl
                  ? <img src={skill.iconUrl} alt="" className="cb-skill-btn-img" onError={(e) => { e.target.style.display='none'; }} />
                  : <span className="cb-skill-btn-emoji">{skill.icon || '✨'}</span>
                }
                {skill.name}
                <span className="cb-skill-cost">MP {skill.mp_cost || 0}</span>
              </button>
            ))}
          </div>
          <button className="cb-cancel-btn" onClick={() => setShowSkillList(false)}>
            ← 뒤로가기
          </button>
        </div>
      )}

      {/* 물품 목록 */}
      {!isPrologue && phase === 'player_action' && currentUnit && currentUnit.team === 'player' && showItemList && (
        <div className="cb-actions">
          <div className="cb-action-label">물품 사용</div>
          <div className="cb-action-buttons cb-item-list">
            {potions.length === 0 && (
              <div className="cb-no-skills">사용 가능한 물품이 없습니다</div>
            )}
            {potions.map(p => (
              <button
                key={p.item_id}
                className={`cb-action-btn item ${p.type === 'talisman' ? 'talisman' : p.effect_hp > 0 ? 'hp-potion' : 'mp-potion'}`}
                onClick={() => handleUseItem(p)}
                title={p.description || p.name}
              >
                <img src={`/equipment/${p.item_id}_icon.png`} alt="" className="cb-item-icon" onError={(e) => { e.target.style.display='none'; }} />
                <span className="cb-item-name">{p.name}</span>
                <span className="cb-item-effect">
                  {p.type === 'talisman' ? (
                    <span className="cb-talisman-text">📜 부적</span>
                  ) : (
                    <>
                      {p.effect_hp > 0 && <span className="cb-hp-text">HP+{p.effect_hp}</span>}
                      {p.effect_mp > 0 && <span className="cb-mp-text">MP+{p.effect_mp}</span>}
                    </>
                  )}
                </span>
                <span className="cb-item-qty">x{p.quantity}</span>
              </button>
            ))}
          </div>
          <button className="cb-cancel-btn" onClick={() => setShowItemList(false)}>
            ← 뒤로가기
          </button>
        </div>
      )}

      {!isPrologue && phase === 'select_target' && (
        <div className="cb-actions">
          <div className="cb-action-label">
            대상 선택 ({selectedAction === 'guard' ? '수호할 아군' : selectedSkill?.type === 'heal' ? '치유할 아군' : '공격할 적'})
          </div>
          <button className="cb-cancel-btn" onClick={() => { setPhase('player_action'); setSelectedAction(null); setSelectedSkill(null); setShowSkillList(false); }}>
            ← 취소
          </button>
        </div>
      )}

      {!isPrologue && phase === 'enemy_turn' && (
        <div className="cb-actions">
          <div className="cb-action-label cb-enemy-label">{currentUnit?.name || '적'}의 턴...</div>
        </div>
      )}

      {/* 전투 종료 화면 (던전 전투와 동일) */}
      {phase === 'battle_end' && (() => {
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
                  {isVictory ? '전투에서 승리했습니다!' : '어둠이 전장을 뒤덮었다...'}
                </div>
                {!isVictory && <div className="defeat-subtitle-flavor">전사들이 쓰러지고, 마물의 포효가 울려 퍼진다.</div>}
                <div className="srpg-result-round">Round {round}</div>
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

                  {/* 기여도 */}
                  {contributions.length > 0 && (
                    <div className="srpg-result-growth-panel">
                      <div className="srpg-result-section-title">
                        <span>기여도 (EXP 분배)</span>
                      </div>
                      <div className="srpg-contrib-list">
                        {contributions.filter(c => c.pct > 0).sort((a, b) => b.pct - a.pct).map(c => (
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
                </div>
              )}

              {/* 패배 시 상세 UI */}
              {!isVictory && (
                <div className="srpg-result-content">
                  {/* 전투 요약 */}
                  <div className="defeat-summary-panel">
                    <div className="defeat-summary-header">
                      <span className="defeat-skull-icon">&#9760;</span>
                      <span>전투 요약</span>
                    </div>
                    <div className="defeat-stats-grid">
                      <div className="defeat-stat-item">
                        <span className="defeat-stat-label">전투 라운드</span>
                        <span className="defeat-stat-value">{round}</span>
                      </div>
                      <div className="defeat-stat-item">
                        <span className="defeat-stat-label">처치한 적</span>
                        <span className="defeat-stat-value">{units.filter(u => u.team === 'enemy' && u.hp <= 0).length} / {units.filter(u => u.team === 'enemy').length}</span>
                      </div>
                      <div className="defeat-stat-item">
                        <span className="defeat-stat-label">아군 생존</span>
                        <span className="defeat-stat-value defeat-zero">{units.filter(u => u.team === 'player' && u.hp > 0).length} / {units.filter(u => u.team === 'player').length}</span>
                      </div>
                      <div className="defeat-stat-item">
                        <span className="defeat-stat-label">총 피해량</span>
                        <span className="defeat-stat-value">{contributions.reduce((s, c) => s + c.damage, 0).toLocaleString()}</span>
                      </div>
                    </div>
                  </div>

                  {/* 쓰러진 아군 */}
                  <div className="defeat-fallen-panel">
                    <div className="defeat-fallen-header">쓰러진 전사들</div>
                    <div className="defeat-fallen-list">
                      {units.filter(u => u.team === 'player').map(u => (
                        <div key={u.id} className={`defeat-fallen-unit ${u.hp <= 0 ? 'dead' : 'alive'}`}>
                          <img src={u.imageUrl} alt="" className="defeat-fallen-portrait" onError={e => { e.target.style.display='none'; }} />
                          <div className="defeat-fallen-info">
                            <span className="defeat-fallen-name">{u.name}</span>
                            <span className={`defeat-fallen-status ${u.hp <= 0 ? 'dead' : 'alive'}`}>
                              {u.hp <= 0 ? '전사' : `생존 (HP ${u.hp})`}
                            </span>
                          </div>
                          {u.hp <= 0 && <span className="defeat-fallen-x">&#10060;</span>}
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* 패널티 */}
                  {defeatPenalty && (
                    <div className="defeat-penalty-panel">
                      <div className="defeat-penalty-header">
                        <span className="defeat-penalty-icon">&#9888;</span>
                        <span>패배 패널티</span>
                      </div>
                      <div className="defeat-penalty-grid">
                        <div className="defeat-penalty-item">
                          <img src="/ui/gold_coin.png" alt="" className="defeat-penalty-img" onError={e => { e.target.style.display='none'; }} />
                          <div className="defeat-penalty-detail">
                            <span className="defeat-penalty-label">골드 차감</span>
                            <span className="defeat-penalty-value">-{defeatPenalty.goldLoss}</span>
                          </div>
                        </div>
                        <div className="defeat-penalty-item">
                          <img src="/ui/exp_icon.png" alt="" className="defeat-penalty-img" onError={e => { e.target.style.display='none'; }} />
                          <div className="defeat-penalty-detail">
                            <span className="defeat-penalty-label">경험치 차감</span>
                            <span className="defeat-penalty-value">-{defeatPenalty.expLoss}</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* 조언 */}
                  <div className="defeat-tip-panel">
                    <div className="defeat-tip-icon">&#128161;</div>
                    <div className="defeat-tip-text">
                      {round <= 3
                        ? '적의 전력이 너무 강합니다. 레벨을 올리거나 장비를 강화해보세요.'
                        : round <= 6
                        ? '아군 편성을 재검토하고, 소환수나 용병을 활용해보세요.'
                        : '아깝습니다! 스킬 사용 타이밍과 방어를 적극 활용해보세요.'}
                    </div>
                  </div>
                </div>
              )}

              <button
                className={`srpg-result-continue-btn ${isVictory ? 'victory' : 'defeat'}`}
                onClick={handleBattleEndClick}
                disabled={isVictory && !rd}
              >
                {isVictory && !rd ? '저장 중...' : isVictory ? '계속하기' : '마을로 퇴각하기'}
              </button>
            </div>
          </div>
        );
      })()}

      {/* 후퇴 확인 팝업 */}
      {showRetreatConfirm && (() => {
        const retreatPct = retreatDisplayPct;
        const pctClass = retreatPct >= 55 ? 'high' : retreatPct >= 40 ? 'mid' : 'low';
        return (
          <div className="retreat-overlay" onClick={() => setShowRetreatConfirm(false)}>
            <div className="retreat-popup" onClick={e => e.stopPropagation()}>
              {/* 배경 */}
              <div className="retreat-bg">
                <img src="/ui/battle/retreat_bg.png" alt="" />
                <div className="retreat-bg-overlay" />
              </div>
              {/* 안개 */}
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

                {/* 확률 게이지 */}
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

                {/* 경고 카드 */}
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

                {/* 버튼 */}
                <div className="retreat-actions">
                  <button className="retreat-btn retreat-btn-try" onClick={() => {
                    const successRate = (Math.floor(Math.random() * 41) + 30) / 100;
                    if (Math.random() < successRate) {
                      addLog('후퇴에 성공했습니다!', 'system');
                      setShowRetreatConfirm(false);
                      setRetreatResult('success');
                      api.post('/battle/session/penalty', { penaltyType: 'retreat' }).then(res => {
                        if (res.data.penalty) {
                          addLog(`패널티: 골드 -${res.data.penalty.goldLoss}, 경험치 -${res.data.penalty.expLoss}`, 'damage');
                        }
                      }).catch(() => {});
                      setTimeout(() => onBattleEnd('retreat', 0, 0), 2500);
                    } else {
                      addLog('후퇴에 실패했습니다! 더 이상 후퇴할 수 없습니다.', 'damage');
                      setShowRetreatConfirm(false);
                      setRetreatResult('fail');
                      setRetreatFailed(true);
                      setRetreatDisabled(true);
                      api.post('/battle/session/retreat-failed').catch(() => {});
                      setTimeout(() => setRetreatResult(null), 2500);
                    }
                  }}>
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

      {/* 전투 로그 */}
      <div className="cb-log" ref={logRef}>
        <img src="/ui/battle/log_bg.png" alt="" className="cb-log-bg" onError={(e) => { e.target.style.display='none'; }} />
        {logs.map(l => (
          <div key={l.id} className={`cb-log-entry ${l.type}`}>{l.text}</div>
        ))}
      </div>
    </div>
  );
}

// ========== 턴 순서 초상화 ==========

function TurnPortrait({ unit }) {
  const [imgErr, setImgErr] = useState(false);
  if (!unit.imageUrl || imgErr) {
    return <span className="cb-turn-emoji">{unit.icon}</span>;
  }
  return <img src={unit.imageUrl} alt="" className="cb-turn-img" onError={() => setImgErr(true)} />;
}

// ========== 유닛 카드 (세로 직사각형) ==========

function UnitCard({ unit, isCurrent, isTarget, onSelect, animating, popups, drops, animClass, hitClass }) {
  const [imgErr, setImgErr] = useState(0);
  const hpPct = unit.maxHp > 0 ? (unit.hp / unit.maxHp) * 100 : 0;
  const mpPct = unit.maxMp > 0 ? (unit.mp / unit.maxMp) * 100 : 0;
  const isDead = unit.hp <= 0;
  const hpColor = hpPct > 50 ? '#2ed573' : hpPct > 25 ? '#ffa502' : '#e94560';

  return (
    <div
      className={`cb-card ${unit.team} ${isCurrent ? 'current' : ''} ${isTarget ? 'targetable' : ''} ${isDead ? 'dead' : ''} ${animating ? 'animating' : ''} ${unit.isGuarding ? 'guarding' : ''} ${unit.eliteTier ? 'elite' : ''} ${animClass || ''} ${hitClass || ''}`}
      onClick={isTarget && !isDead ? onSelect : undefined}
      style={unit.eliteTier ? { '--elite-color': unit.eliteTier.color } : undefined}
    >
      {/* 데미지 팝업 */}
      {popups.map(p => (
        <div key={p.id} className={`cb-popup ${p.type}`}>{p.text}</div>
      ))}

      {/* 드랍 아이템 애니메이션 */}
      {(drops || []).map((d, i) => (
        <div key={d.id} className="cb-drop-anim" style={{ animationDelay: `${i * 0.2}s` }}>
          <span className="cb-drop-icon">{d.icon}</span>
          <span className="cb-drop-name">{d.name}</span>
        </div>
      ))}

      {/* 수호 배지 */}
      {unit.isGuarding && <div className="cb-guard-badge">🛡️</div>}

      {/* 공격 타입 배지 */}
      <div className="cb-card-range">{unit.rangeType === 'magic' ? '🔮' : unit.rangeType === 'ranged' ? '🏹' : '⚔️'}</div>

      {/* 카드 상단: 이미지 영역 */}
      <div className="cb-card-portrait">
        {unit.portraitEffect && (
          <div className={`cb-portrait-effect cb-effect-${unit.portraitEffect}`} />
        )}
        {unit.imageUrl && imgErr < 2 ? (
          <img
            src={imgErr === 0 ? unit.imageUrl : unit.imageUrl.replace('/monsters_nobg/', '/monsters/').replace('/summons_nobg/', '/summons/')}
            alt={unit.name}
            className="cb-card-img"
            onError={() => setImgErr(prev => prev + 1)}
          />
        ) : (
          <span className="cb-card-emoji">{unit.icon}</span>
        )}
        <div className="cb-card-portrait-overlay" />
        {/* 레벨 배지 */}
        <div className="cb-card-lv-badge">Lv.{unit.level}</div>
      </div>

      {/* 정예 배지 */}
      {unit.eliteTier && (
        <div className="cb-elite-badge" style={{ background: unit.eliteTier.color }}>
          {unit.eliteTier.icon} {unit.eliteTier.label}
        </div>
      )}

      {/* 카드 하단: 정보 */}
      <div className="cb-card-info">
        <div className="cb-card-name" style={unit.eliteTier ? { color: unit.eliteTier.color } : undefined}>{unit.eliteTier ? `${unit.eliteTier.label} ` : ''}{unit.name}</div>

        {/* HP 바 */}
        <div className="cb-card-bar hp">
          <div className="cb-card-bar-fill" style={{ width: `${hpPct}%`, background: hpColor }} />
          <span className="cb-card-bar-text">{unit.hp}/{unit.maxHp}</span>
        </div>

        {/* MP 바 */}
        {unit.maxMp > 0 && (
          <div className="cb-card-bar mp">
            <div className="cb-card-bar-fill" style={{ width: `${mpPct}%` }} />
            <span className="cb-card-bar-text">{unit.mp}/{unit.maxMp}</span>
          </div>
        )}

        {/* 버프/디버프 */}
        {((unit.buffs?.length > 0) || (unit.debuffs?.length > 0)) && (
          <div className="cb-card-effects">
            {(unit.buffs || []).map((b, i) => (
              <span key={`b${i}`} className="cb-effect buff" title={`${b.name} (${b.duration}턴)`}>▲<span className="cb-effect-dur">{b.duration}</span></span>
            ))}
            {(unit.debuffs || []).map((b, i) => (
              <span key={`d${i}`} className="cb-effect debuff" title={`${b.name} (${b.duration}턴)`}>▼<span className="cb-effect-dur">{b.duration}</span></span>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export default StageBattle;
