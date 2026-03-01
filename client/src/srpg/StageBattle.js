import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  createCardPlayerUnit, createCardSummonUnit, createCardMercenaryUnit, createCardMonsterUnit,
  assignGridPositions,
  calculateTurnOrder, getValidTargets, getHealTargets, getGuardTargets,
  executeAttack, executeSkill, executeGuard,
  onTurnStart, decideAIAction, checkBattleEnd, calculateRewards,
} from './cardBattleEngine';
import api from '../api';
import './StageBattle.css';

function StageBattle({ stage, character, charState, learnedSkills, activeSummons, activeMercenaries, monsters, groupKey, onBattleEnd, onLog }) {
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
  const [dropAnims, setDropAnims] = useState([]);
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

  // 히트 이펙트 추가
  const addHitEffect = useCallback((unitId) => {
    const id = ++hitEffectId.current;
    setHitEffects(prev => [...prev, { id, unitId }]);
    setTimeout(() => setHitEffects(prev => prev.filter(e => e.id !== id)), 600);
  }, []);

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

    const initBattle = async () => {
      const playerUnit = createCardPlayerUnit(
        { ...character, ...charState, current_hp: charState.currentHp, current_mp: charState.currentMp },
        learnedSkills
      );

      const summonUnits = (activeSummons || []).slice(0, 5).map(s => createCardSummonUnit(s));
      const mercUnits = (activeMercenaries || []).slice(0, 5).map(m => createCardMercenaryUnit(m));
      const playerTeam = [playerUnit, ...summonUnits, ...mercUnits].slice(0, 9);

      // 메인 진영 데이터 로드
      let formationGrid = null;
      try {
        const fRes = await api.get('/formation/list');
        const mainFormation = fRes.data.formations.find(f => f.slotIndex === 0);
        if (mainFormation && mainFormation.gridData) {
          const grid = mainFormation.gridData;
          // 배치된 유닛이 하나라도 있는지 확인
          const hasUnits = grid.some(row => row.some(cell => cell && cell.unitId));
          if (hasUnits) formationGrid = grid;
        }
      } catch {}

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
        const enemyTeam = buildEnemyTeam();
        const eFront = enemyTeam.filter(u => u.row === 'front');
        if (eFront.length === 0 && enemyTeam.length > 0) enemyTeam[0].row = 'front';
        // 적군만 assignGridPositions의 적 로직 적용
        assignEnemyGrid(enemyTeam);

        finalizeBattle(playerTeam, enemyTeam);
      } else {
        // 진영 데이터 없으면 기존 로직
        const enemyTeam = buildEnemyTeam();

        const pFront = playerTeam.filter(u => u.row === 'front');
        if (pFront.length === 0 && playerTeam.length > 0) playerTeam[0].row = 'front';
        const eFront = enemyTeam.filter(u => u.row === 'front');
        if (eFront.length === 0 && enemyTeam.length > 0) enemyTeam[0].row = 'front';

        assignGridPositions(playerTeam, enemyTeam);
        finalizeBattle(playerTeam, enemyTeam);
      }
    };

    const buildEnemyTeam = () => {
      const monsterCount = Math.min(stage.monsterCount || 3, 9);
      const availableMonsters = monsters || [];
      const enemyTeam = [];
      for (let i = 0; i < monsterCount && availableMonsters.length > 0; i++) {
        const template = availableMonsters[Math.floor(Math.random() * availableMonsters.length)];
        const levelBonus = (stage.monsterLevelMin || 1) + Math.floor(Math.random() * ((stage.monsterLevelMax || 3) - (stage.monsterLevelMin || 1) + 1));
        const scaled = {
          ...template,
          level: levelBonus,
          hp: Math.floor(template.hp * (1 + (levelBonus - 1) * 0.15)),
          attack: Math.floor(template.attack * (1 + (levelBonus - 1) * 0.1)),
          defense: Math.floor((template.defense || 0) * (1 + (levelBonus - 1) * 0.08)),
          phys_attack: Math.floor((template.phys_attack || 0) * (1 + (levelBonus - 1) * 0.1)),
          mag_attack: Math.floor((template.mag_attack || 0) * (1 + (levelBonus - 1) * 0.1)),
        };
        enemyTeam.push(createCardMonsterUnit(scaled, i));
      }
      return enemyTeam;
    };

    const assignEnemyGrid = (enemyTeam) => {
      const front = enemyTeam.filter(u => u.row === 'front');
      const back = enemyTeam.filter(u => u.row === 'back');
      front.slice(0, 3).forEach((u, i) => { u.gridCol = 0; u.gridRow = i; });
      back.slice(0, 3).forEach((u, i) => { u.gridCol = 2; u.gridRow = i; });
      const overflow = [...front.slice(3), ...back.slice(3)];
      overflow.slice(0, 3).forEach((u, i) => { u.gridCol = 1; u.gridRow = i; });
    };

    const finalizeBattle = async (playerTeam, enemyTeam) => {
      const allUnits = [...playerTeam, ...enemyTeam];
      setUnits(allUnits);

      const order = calculateTurnOrder(allUnits);
      setTurnOrder(order);
      setCurrentTurnIdx(0);
      setRound(1);

      // 물약 인벤토리 로드
      try {
        const invRes = await api.get('/shop/inventory');
        const potionItems = (invRes.data.inventory || []).filter(i => i.type === 'potion' && i.quantity > 0);
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

  const advanceTurn = useCallback(() => {
    const currentUnits = unitsRef.current;
    const end = checkBattleEnd(currentUnits);
    if (end) {
      setBattleResult(end);
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
        // 공격 애니메이션 실행
        await playCombatAnimation(current, decision.target, current.rangeType);
        const attackLogs = executeAttack(current, decision.target, currentUnits);
        attackLogs.forEach(l => {
          addLog(l.text, l.type);
          if (l.type === 'damage') {
            addPopup(decision.target.id, `-${l.text.match(/(\d+) 피해/)?.[1] || '?'}`, 'damage');
            if (l.elementLabel) addPopup(decision.target.id, l.elementLabel, l.elementMult > 1 ? 'element-strong' : 'element-weak');
          }
          if (l.type === 'kill') addPopup(decision.target.id, 'KO', 'kill');
        });
      } else if (decision.action === 'skill') {
        await playSkillCutIn(decision.skill, current);
        const skillRange = (decision.skill.range_val || decision.skill.range || 1) >= 2 ? 'ranged' : current.rangeType;
        const isOffensive = decision.skill.type === 'attack' || decision.skill.type === 'aoe' || decision.skill.type === 'debuff';
        if (isOffensive && decision.target) {
          await playCombatAnimation(current, decision.target, skillRange, decision.skill);
        }
        const result = executeSkill(current, decision.skill, decision.target, currentUnits);
        result.logs.forEach(l => {
          addLog(l.text, l.type);
          if (l.type === 'damage') {
            addPopup(decision.target.id, `-${l.text.match(/(\d+) 피해/)?.[1] || '?'}`, 'damage');
            if (l.elementLabel) addPopup(decision.target.id, l.elementLabel, l.elementMult > 1 ? 'element-strong' : 'element-weak');
          }
          if (l.type === 'heal') addPopup(decision.target.id, `+${l.text.match(/\+(\d+)/)?.[1] || '?'}`, 'heal');
        });
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
    if (battleResult === 'victory') {
      addLog(`\n전투 승리! EXP +${rewards.exp}, Gold +${rewards.gold}`, 'heal');
      // 서버에 전투 결과 전송 (재료 드랍)
      const deadEnemies = units.filter(u => u.team === 'enemy' && u.hp <= 0).map(u => u.name);
      api.post('/stage/battle-result', {
        monstersDefeated: deadEnemies,
        expGained: rewards.exp,
        goldGained: rewards.gold,
        victory: true,
      }).then(res => {
        if (res.data.droppedMaterials && res.data.droppedMaterials.length > 0) {
          setDroppedMaterials(res.data.droppedMaterials);
          res.data.droppedMaterials.forEach(m => {
            addLog(`  📦 ${m.icon} ${m.name} x${m.quantity} 획득!`, 'system');
          });
        }
      }).catch(() => {});
    } else {
      addLog(`\n전투 패배...`, 'damage');
    }
  }, [phase, battleResult, units, stage, addLog]);

  // === 플레이어 액션 핸들러 ===

  const [showSkillList, setShowSkillList] = useState(false);

  const handleSelectAction = (action) => {
    setSelectedAction(action);
    setSelectedSkill(null);
    setShowSkillList(false);
    setShowItemList(false);
    if (action === 'retreat') {
      onBattleEnd('retreat', 0, 0);
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

  // 물약 사용
  const handleUseItem = async (potion) => {
    const current = getCurrentUnit();
    if (!current || current.id !== 'player') return;

    try {
      const res = await api.post('/shop/use', { itemId: potion.item_id });
      const { current_hp, current_mp } = res.data.character;

      // 유닛 HP/MP 업데이트
      setUnits(prev => prev.map(u => {
        if (u.id !== 'player') return u;
        const newHp = Math.min(u.maxHp, current_hp);
        const newMp = Math.min(u.maxMp, current_mp);
        return { ...u, hp: newHp, mp: newMp };
      }));

      // 인벤토리 업데이트
      setPotions(prev => prev.map(p => {
        if (p.item_id !== potion.item_id) return p;
        return { ...p, quantity: p.quantity - 1 };
      }).filter(p => p.quantity > 0));

      const healText = [];
      if (potion.effect_hp > 0) healText.push(`HP +${potion.effect_hp}`);
      if (potion.effect_mp > 0) healText.push(`MP +${potion.effect_mp}`);
      addLog(`${current.name}이(가) ${potion.name} 사용! (${healText.join(', ')})`, 'heal');
      addPopup('player', `+${healText.join(' ')}`, 'heal');

      setShowItemList(false);
      advanceTurn(); // 물약 사용 = 1턴 소모
    } catch (err) {
      addLog(err.response?.data?.message || '물약 사용 실패', 'system');
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
        addLog(l.text, l.type);
        if (l.type === 'damage') {
          addPopup(target.id, `-${l.text.match(/(\d+) 피해/)?.[1] || '?'}`, 'damage');
          if (l.elementLabel) addPopup(target.id, l.elementLabel, l.elementMult > 1 ? 'element-strong' : 'element-weak');
        }
        if (l.type === 'kill') {
          addPopup(target.id, 'KO', 'kill');
          if (target.team === 'enemy') showMonsterDropAnim(target);
        }
        if (l.type === 'evade') addPopup(target.id, 'MISS', 'evade');
      });
    } else if (selectedAction === 'skill' && selectedSkill) {
      // 스킬 발동 연출
      await playSkillCutIn(selectedSkill, current);
      const skillRange = (selectedSkill.range_val || selectedSkill.range || 1) >= 2 ? 'ranged' : current.rangeType;
      const isOffensive = selectedSkill.type === 'attack' || selectedSkill.type === 'aoe' || selectedSkill.type === 'debuff';
      if (isOffensive) {
        await playCombatAnimation(current, target, skillRange, selectedSkill);
      }
      const result = executeSkill(current, selectedSkill, target, currentUnits);
      result.logs.forEach(l => {
        addLog(l.text, l.type);
        if (l.type === 'damage') {
          addPopup(target.id, `-${l.text.match(/(\d+) 피해/)?.[1] || '?'}`, 'damage');
          if (l.elementLabel) addPopup(target.id, l.elementLabel, l.elementMult > 1 ? 'element-strong' : 'element-weak');
        }
        if (l.type === 'heal') addPopup(target.id, `+${l.text.match(/\+(\d+)/)?.[1] || '?'}`, 'heal');
        if (l.type === 'kill') {
          addPopup(target.id, 'KO', 'kill');
          if (target.team === 'enemy') showMonsterDropAnim(target);
        }
        if (l.type === 'evade') addPopup(target.id, 'MISS', 'evade');
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
    const rewards = calculateRewards(units, stage);
    if (battleResult === 'victory') {
      onBattleEnd('victory', rewards.exp, rewards.gold);
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
    return hitEffects.some(e => e.unitId === unitId) ? 'hit-flash' : '';
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
      {/* 전투 배경 이미지 */}
      <div className="cb-bg-layer">
        <img src="/ui/battle/battle_bg.png" alt="" className="cb-bg-img" onError={(e) => { e.target.style.display='none'; }} />
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
          <button className="cb-retreat-btn" onClick={() => handleSelectAction('retreat')}>
            <img src="/ui/battle/action_retreat.png" alt="" className="cb-btn-icon" onError={(e) => { e.target.style.display='none'; }} />
            후퇴
          </button>
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
        <div className="cb-side cb-side-player">
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

        <div className="cb-vs">
          <img src="/ui/battle/vs_emblem.png" alt="VS" className="cb-vs-img" onError={(e) => { e.target.style.display='none'; e.target.nextSibling.style.display=''; }} />
          <span className="cb-vs-text" style={{ display: 'none' }}>VS</span>
        </div>

        <div className="cb-side cb-side-enemy">
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
            <span className="cb-skill-cutin-icon">{skillCutIn.skillIcon}</span>
            <div className="cb-skill-cutin-info">
              <div className="cb-skill-cutin-name">{skillCutIn.skillName}</div>
              <div className="cb-skill-cutin-caster">{skillCutIn.casterName}</div>
            </div>
          </div>
        </div>
      )}

      {/* 액션 패널 */}
      {phase === 'player_action' && currentUnit && currentUnit.team === 'player' && !showSkillList && !showItemList && (
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
      {phase === 'player_action' && currentUnit && currentUnit.team === 'player' && showSkillList && (
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
                {skill.icon || '✨'} {skill.name}
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
      {phase === 'player_action' && currentUnit && currentUnit.team === 'player' && showItemList && (
        <div className="cb-actions">
          <div className="cb-action-label">물품 사용</div>
          <div className="cb-action-buttons cb-item-list">
            {potions.length === 0 && (
              <div className="cb-no-skills">사용 가능한 물품이 없습니다</div>
            )}
            {potions.map(p => (
              <button
                key={p.item_id}
                className={`cb-action-btn item ${p.effect_hp > 0 ? 'hp-potion' : 'mp-potion'}`}
                onClick={() => handleUseItem(p)}
                title={p.name}
              >
                <img src={`/equipment/${p.item_id}_icon.png`} alt="" className="cb-item-icon" onError={(e) => { e.target.style.display='none'; }} />
                <span className="cb-item-name">{p.name}</span>
                <span className="cb-item-effect">
                  {p.effect_hp > 0 && <span className="cb-hp-text">HP+{p.effect_hp}</span>}
                  {p.effect_mp > 0 && <span className="cb-mp-text">MP+{p.effect_mp}</span>}
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

      {phase === 'select_target' && (
        <div className="cb-actions">
          <div className="cb-action-label">
            대상 선택 ({selectedAction === 'guard' ? '수호할 아군' : selectedSkill?.type === 'heal' ? '치유할 아군' : '공격할 적'})
          </div>
          <button className="cb-cancel-btn" onClick={() => { setPhase('player_action'); setSelectedAction(null); setSelectedSkill(null); setShowSkillList(false); }}>
            ← 취소
          </button>
        </div>
      )}

      {phase === 'enemy_turn' && (
        <div className="cb-actions">
          <div className="cb-action-label cb-enemy-label">{currentUnit?.name || '적'}의 턴...</div>
        </div>
      )}

      {/* 전투 종료 */}
      {phase === 'battle_end' && (
        <div className="cb-result-overlay">
          <div className={`cb-result ${battleResult}`}>
            <img
              src={`/ui/battle/${battleResult === 'victory' ? 'victory_bg' : 'defeat_bg'}.png`}
              alt="" className="cb-result-bg-img"
              onError={(e) => { e.target.style.display='none'; }}
            />
            <div className="cb-result-content">
              <div className="cb-result-title">{battleResult === 'victory' ? '승리!' : '패배...'}</div>
              {battleResult === 'victory' && (
                <div className="cb-result-rewards">
                  <div>EXP +{calculateRewards(units, stage).exp}</div>
                  <div>Gold +{calculateRewards(units, stage).gold}</div>
                  {droppedMaterials.length > 0 && (
                    <div className="cb-result-drops">
                      {droppedMaterials.map((m, i) => (
                        <div key={i} className="cb-result-drop-item">
                          <span className="cb-result-drop-icon">{m.icon}</span>
                          <span>{m.name} x{m.quantity}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
              <button className="cb-result-btn" onClick={handleBattleEndClick}>
                {battleResult === 'victory' ? '계속하기' : '돌아가기'}
              </button>
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
  const [imgErr, setImgErr] = useState(false);
  const hpPct = unit.maxHp > 0 ? (unit.hp / unit.maxHp) * 100 : 0;
  const mpPct = unit.maxMp > 0 ? (unit.mp / unit.maxMp) * 100 : 0;
  const isDead = unit.hp <= 0;
  const hpColor = hpPct > 50 ? '#2ed573' : hpPct > 25 ? '#ffa502' : '#e94560';

  return (
    <div
      className={`cb-card ${unit.team} ${isCurrent ? 'current' : ''} ${isTarget ? 'targetable' : ''} ${isDead ? 'dead' : ''} ${animating ? 'animating' : ''} ${unit.isGuarding ? 'guarding' : ''} ${animClass || ''} ${hitClass || ''}`}
      onClick={isTarget && !isDead ? onSelect : undefined}
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
        {unit.imageUrl && !imgErr ? (
          <img
            src={unit.imageUrl}
            alt={unit.name}
            className="cb-card-img"
            onError={() => setImgErr(true)}
          />
        ) : (
          <span className="cb-card-emoji">{unit.icon}</span>
        )}
        <div className="cb-card-portrait-overlay" />
        {/* 레벨 배지 */}
        <div className="cb-card-lv-badge">Lv.{unit.level}</div>
        {/* 열 배지 */}
        <div className="cb-card-row-badge">{unit.row === 'front' ? '앞' : '뒤'}</div>
      </div>

      {/* 카드 하단: 정보 */}
      <div className="cb-card-info">
        <div className="cb-card-name">{unit.name}</div>

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
              <span key={`b${i}`} className="cb-effect buff" title={`${b.name} (${b.duration}턴)`}>▲</span>
            ))}
            {(unit.debuffs || []).map((b, i) => (
              <span key={`d${i}`} className="cb-effect debuff" title={`${b.name} (${b.duration}턴)`}>▼</span>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export default StageBattle;
