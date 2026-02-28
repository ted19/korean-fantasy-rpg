import React, { useState, useEffect, useRef, useCallback } from 'react';
import IsometricMap from './IsometricMap';
import { buildMapFromDungeon } from './mapData';
import {
  createPlayerUnit, createSummonUnit, createMonsterUnit,
  getMovementRange, getAttackRange, getSkillRange,
  calcDamage, calcHeal, determineTurnOrder, aiDecide,
  checkBattleEnd, generateEnemies, getWeaponInfo, getTerrainEffect,
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

export default function SrpgBattle({
  location,
  stage,
  character,
  charState,
  learnedSkills,
  activeSummons,
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
  const [battleLog, setBattleLog] = useState([]);
  const [damagePopups, setDamagePopups] = useState([]);
  const [skillEffects, setSkillEffects] = useState([]);
  const [battleResult, setBattleResult] = useState(null);
  const [totalExpGained, setTotalExpGained] = useState(0);
  const [totalGoldGained, setTotalGoldGained] = useState(0);
  const [roundCount, setRoundCount] = useState(1);
  const [loading, setLoading] = useState(true);
  const [showRetreatConfirm, setShowRetreatConfirm] = useState(false);
  const [autoAll, setAutoAll] = useState(false);
  const [autoSummon, setAutoSummon] = useState(false);
  const [ctxMenu, setCtxMenu] = useState({ show: false, mode: 'main' });
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
    setDamagePopups(prev => [...prev.slice(-5), { x, y, z, text, type, time: Date.now() }]);
  };

  // 플레이어 스프라이트 상태 변경 (idle/attack/skill/hurt)
  const setSpriteState = useCallback((state, duration = 600) => {
    setUnits(prev => {
      const updated = prev.map(u => u.id === 'player' ? { ...u, spriteState: state } : u);
      unitsRef.current = updated;
      return updated;
    });
    if (state !== 'idle') {
      setTimeout(() => {
        setUnits(prev => {
          const updated = prev.map(u => u.id === 'player' ? { ...u, spriteState: 'idle' } : u);
          unitsRef.current = updated;
          return updated;
        });
      }, duration);
    }
  }, []); // eslint-disable-line

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

        // 스테이지별 맵 데이터 사용
        let mapSource = dungeon;
        if (stage && stages) {
          const stageData = stages.find(s => s.stageNumber === stage.stageNumber);
          if (stageData && stageData.tileOverrides) {
            mapSource = {
              name: `${dungeon.name} ${stage.stageNumber}${stage.isBoss ? ' (보스)' : ''}`,
              mapWidth: stageData.mapWidth,
              mapHeight: stageData.mapHeight,
              baseTileType: stageData.baseTileType,
              tileOverrides: stageData.tileOverrides,
              playerSpawns: stageData.playerSpawns,
              monsterSpawns: stageData.monsterSpawns,
            };
          }
        }

        const map = buildMapFromDungeon(mapSource);
        setMapData(map);

        // 장착 무기 정보 로드
        let equippedWeapon = null;
        try {
          const eqRes = await api.get('/equipment/info');
          if (eqRes.data.equipped?.weapon) {
            equippedWeapon = eqRes.data.equipped.weapon;
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
        allUnits.push(createPlayerUnit(playerData, learnedSkills, map.playerSpawns[0], equippedWeapon));

        // 소환수
        if (activeSummons && activeSummons.length > 0) {
          activeSummons.forEach((s, i) => {
            if (i + 1 < map.playerSpawns.length) {
              allUnits.push(createSummonUnit(s, map.playerSpawns[i + 1]));
            }
          });
        }

        // 적 생성 (DB 몬스터 데이터 기반 + 스테이지 보너스)
        const enemies = generateEnemies(dbMonsters, charState.level, stage);
        enemies.forEach((m, i) => {
          if (i < map.monsterSpawns.length) {
            allUnits.push(createMonsterUnit(m, map.monsterSpawns[i], i));
          }
        });

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
            const isSummon = firstUnit.id.startsWith('summon_');
            const shouldAuto = autoAllRef.current || (autoSummonRef.current && isSummon);
            setPhase(shouldAuto ? PHASE.ENEMY_TURN : PHASE.PLAYER_SELECT);
          } else {
            setPhase(PHASE.PLAYER_SELECT);
          }
        }

        const summonNames = activeSummons?.length > 0
          ? ` (동행: ${activeSummons.map(s => (s.icon || '👻') + s.name).join(', ')})`
          : '';
        const monsterNames = enemies.map(m => m.icon + m.name).join(', ');
        addLog(`전투 시작! ${monsterNames} 출현!${summonNames}`, 'system');
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
          const reset = prev.map(u => ({ ...u, acted: false, moved: false }));
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
        const isSummon = nextUnit.id.startsWith('summon_');
        const shouldAuto = autoAllRef.current || (autoSummonRef.current && isSummon);
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

  // phase 변경시 메뉴 닫기 (이동/공격 모드 진입 등)
  useEffect(() => {
    if (phase !== PHASE.PLAYER_SELECT) {
      setCtxMenu({ show: false, mode: 'main' });
    }
  }, [phase]);

  // 자동 모드 토글시 현재 플레이어 턴이면 즉시 전환
  useEffect(() => {
    if (phase !== PHASE.PLAYER_SELECT) return;
    const au = unitsRef.current.find(u => u.id === activeUnitId);
    if (!au || au.team !== 'player') return;
    const isSummon = au.id.startsWith('summon_');
    const shouldAuto = autoAll || (autoSummon && isSummon);
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
      const isSummon = currentUnit.id.startsWith('summon_');
      const shouldAuto = autoAllRef.current || (autoSummonRef.current && isSummon);
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

      // AI 이동
      if (decision.moveTarget) {
        setUnits(prev => {
          const updated = prev.map(u =>
            u.id === latestUnit.id ? { ...u, x: decision.moveTarget.x, z: decision.moveTarget.z, moved: true } : u
          );
          unitsRef.current = updated;
          return updated;
        });
        addLog(`[R${roundCount}] ${latestUnit.icon}${latestUnit.name}이(가) 이동!`, 'system');
      }

      await wait(500);
      if (cancelled) return;

      const movedUnit = unitsRef.current.find(u => u.id === latestUnit.id);
      if (!movedUnit || movedUnit.hp <= 0) { advanceTurn(); return; }

      // ===== AI 행동 실행 =====
      if (decision.action === 'heal' && decision.skill && decision.target) {
        // 힐 스킬 사용
        const healTarget = unitsRef.current.find(u => u.id === decision.target.id);
        if (healTarget && healTarget.hp > 0) {
          const healAmt = decision.skill.heal_amount || 30;
          setUnits(prev => {
            const updated = prev.map(u => {
              if (u.id === healTarget.id) {
                return { ...u, hp: Math.min(u.maxHp, u.hp + healAmt) };
              }
              if (u.id === movedUnit.id) {
                const cd = { ...(u.skillCooldowns || {}) };
                cd[decision.skill.id] = decision.skill.cooldown || 0;
                return { ...u, mp: u.mp - (decision.skill.mp_cost || 0), acted: true, skillCooldowns: cd };
              }
              return u;
            });
            unitsRef.current = updated;
            const healed = updated.find(u => u.id === healTarget.id);
            const selfHeal = healTarget.id === movedUnit.id;
            addLog(
              `[R${roundCount}] ${movedUnit.icon}${movedUnit.name}의 ${decision.skill.icon || '✨'}[${decision.skill.name}]! ${selfHeal ? '자신을' : `${healTarget.icon}${healTarget.name}을(를)`} ${healAmt} 치유! (HP: ${healed?.hp}/${healed?.maxHp})`,
              'heal'
            );
            addPopup(healTarget.x, healTarget.z, `+${healAmt}`, 'heal');
            addEffect(healTarget.x, healTarget.z, 'heal');
            return updated;
          });
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
          const STAT_NAMES = { attack:'공격력', defense:'방어력', phys_attack:'물공', phys_defense:'물방', mag_attack:'마공', mag_defense:'마방', crit_rate:'치명타', evasion:'회피' };
          const statName = STAT_NAMES[decision.skill.buff_stat] || decision.skill.buff_stat;
          addLog(
            `[R${roundCount}] ${movedUnit.icon}${movedUnit.name}의 ${decision.skill.icon || '✨'}[${decision.skill.name}]! ${statName}${decision.skill.buff_value > 0 ? '+' : ''}${decision.skill.buff_value}!`,
            'system'
          );
          addPopup(movedUnit.x, movedUnit.z, `${statName}${decision.skill.buff_value > 0 ? '↑' : '↓'}`, 'system');
          addEffect(movedUnit.x, movedUnit.z, 'buff', decision.skill.buff_stat === 'attack' || decision.skill.buff_stat === 'phys_attack' || decision.skill.buff_stat === 'mag_attack' ? '#ff6600' : '#4488ff');
          return updated;
        });
      } else if (decision.canAttack && decision.target) {
        // 공격 (일반 or 스킬)
        const targetUnit = unitsRef.current.find(u => u.id === decision.target.id);
        if (movedUnit && movedUnit.hp > 0 && targetUnit && targetUnit.hp > 0) {
          const skill = decision.skill;
          const result = calcDamage(movedUnit, targetUnit, skill, mapRef.current);
          const dmg = result.damage;

          // 플레이어가 피격당하면 hurt 포즈
          if (decision.target.id === 'player' && !result.evaded) {
            setSpriteState('hurt');
          }

          setUnits(prev => {
            const updated = prev.map(u => {
              if (u.id === decision.target.id) {
                if (result.evaded) return u;
                const newHp = Math.max(0, u.hp - dmg);
                return { ...u, hp: newHp };
              }
              if (u.id === movedUnit.id) {
                let newMp = u.mp;
                let newHp = u.hp;
                const cd = { ...(u.skillCooldowns || {}) };
                if (skill) {
                  newMp -= (skill.mp_cost || 0);
                  cd[skill.id] = skill.cooldown || 0;
                  // 생명력 흡수
                  if (!result.evaded && skill.heal_amount > 0) {
                    const healed = Math.min(skill.heal_amount, u.maxHp - u.hp);
                    newHp = Math.min(u.maxHp, u.hp + skill.heal_amount);
                    if (healed > 0) {
                      addLog(`  ${movedUnit.icon}${movedUnit.name} 생명력 ${healed} 흡수!`, 'heal');
                      addPopup(u.x, u.z, `+${healed}`, 'heal');
                    }
                  }
                  // 자폭
                  if (skill.name === '자폭') {
                    newHp = 0;
                  }
                }
                return { ...u, mp: newMp, hp: newHp, acted: true, skillCooldowns: cd };
              }
              return u;
            });
            unitsRef.current = updated;

            const target = updated.find(u => u.id === decision.target.id);
            const skillName = skill ? `${skill.icon || '✨'}[${skill.name}]` : '공격';

            if (result.evaded) {
              addLog(`[R${roundCount}] ${movedUnit.icon}${movedUnit.name}의 ${skillName}! ${decision.target.icon}${decision.target.name}이(가) 회피!`, 'system');
              addPopup(decision.target.x, decision.target.z, 'MISS', 'system');
            } else {
              let extra = result.heightInfo.label ? ` (${result.heightInfo.label})` : '';
              addLog(
                `[R${roundCount}] ${movedUnit.icon}${movedUnit.name}의 ${skillName}! ${decision.target.icon}${decision.target.name}에게 ${dmg} 데미지!${extra} (HP: ${target?.hp}/${target?.maxHp})`,
                'damage'
              );
              addPopup(decision.target.x, decision.target.z, result.isCrit ? `💥${dmg}` : `-${dmg}`, 'damage');
              if (result.isCrit) addLog(`치명타!`, 'damage');
              // 스킬 이펙트
              const fx = skill ? (skill.type === 'aoe' ? 'explosion' : skill.damage_multiplier >= 1.5 ? 'magic' : 'slash') : 'slash';
              const fxColor = skill ? '#8844ff' : '#ff4444';
              addEffect(decision.target.x, decision.target.z, fx, fxColor);
            }
            if (target && target.hp <= 0) {
              addLog(`${decision.target.icon}${decision.target.name} 쓰러짐!`, 'system');
            }
            return updated;
          });
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
      // 다른 곳 클릭시 메뉴 닫기
      if (ctxMenu.show) {
        setCtxMenu({ show: false, mode: 'main' });
        return;
      }
    }

    // 이동 모드
    if (phase === PHASE.PLAYER_MOVE) {
      const canMove = movableRange.some(t => t.x === tile.x && t.z === tile.z);
      if (canMove) {
        setUnits(prev => {
          const updated = prev.map(u =>
            u.id === activeUnit.id ? { ...u, x: tile.x, z: tile.z, moved: true } : u
          );
          unitsRef.current = updated;
          return updated;
        });
        setMovableRange([]);
        setPhase(PHASE.PLAYER_SELECT);
        addLog(`${activeUnit.icon}${activeUnit.name}이(가) (${tile.x},${tile.z})로 이동!`, 'system');
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
          if (activeUnit.id === 'player') setSpriteState('skill');
          setUnits(prev => {
            const updated = prev.map(u => {
              if (u.id === targetUnit.id) {
                const actualHeal = Math.min(healAmt, u.maxHp - u.hp);
                addLog(`[R${roundCount}] ${activeUnit.icon}${activeUnit.name}의 [${selectedSkill.name}]! ${u.icon}${u.name} HP ${actualHeal} 회복!`, 'heal');
                addPopup(u.x, u.z, `+${actualHeal}`, 'heal');
                addEffect(u.x, u.z, 'heal', '#44ff88');
                return { ...u, hp: Math.min(u.maxHp, u.hp + healAmt) };
              }
              if (u.id === activeUnit.id) {
                return { ...u, mp: u.mp - selectedSkill.mp_cost, acted: true };
              }
              return u;
            });
            unitsRef.current = updated;
            return updated;
          });
          setAttackRange([]);
          setSelectedSkill(null);
          setTimeout(() => advanceTurn(), 500);
        }
        return;
      }

      // 공격/공격스킬
      if (targetUnit && targetUnit.team === 'enemy') {
        const skill = selectedSkill;
        const result = calcDamage(activeUnit, targetUnit, skill, mapRef.current);
        const dmg = result.damage;

        // 플레이어 스프라이트: 공격/스킬 포즈
        if (activeUnit.id === 'player') {
          setSpriteState(skill ? 'skill' : 'attack');
        }

        setUnits(prev => {
          const updated = prev.map(u => {
            if (u.id === targetUnit.id) {
              if (result.evaded) return u; // 회피 시 HP 변동 없음
              const newHp = Math.max(0, u.hp - dmg);
              return { ...u, hp: newHp };
            }
            if (u.id === activeUnit.id) {
              let newMp = u.mp;
              let newHp = u.hp;
              if (skill) newMp -= skill.mp_cost;
              if (!result.evaded && skill && skill.heal_amount > 0) {
                const healed = Math.min(skill.heal_amount, u.maxHp - u.hp);
                newHp = Math.min(u.maxHp, u.hp + skill.heal_amount);
                if (healed > 0) {
                  addLog(`  생명력 ${healed} 흡수!`, 'heal');
                  addPopup(u.x, u.z, `+${healed}`, 'heal');
                }
              }
              return { ...u, mp: newMp, hp: newHp, acted: true };
            }
            return u;
          });
          unitsRef.current = updated;

          const target = updated.find(u => u.id === targetUnit.id);
          const skillName = skill ? `[${skill.name}]` : '공격';

          if (result.evaded) {
            addLog(`[R${roundCount}] ${activeUnit.icon}${activeUnit.name}의 ${skillName}! ${targetUnit.icon}${targetUnit.name}이(가) 회피!`, 'system');
            addPopup(targetUnit.x, targetUnit.z, 'MISS', 'system');
          } else {
            let extra = '';
            if (result.heightInfo.label) extra += ` ${result.heightInfo.label}`;
            if (result.terrainDef !== 0) extra += ` 지형방어${result.terrainDef > 0 ? '+' : ''}${result.terrainDef}`;
            addLog(
              `[R${roundCount}] ${activeUnit.icon}${activeUnit.name}의 ${skillName}! ${targetUnit.icon}${targetUnit.name}에게 ${dmg} 데미지!${extra} (HP: ${target?.hp}/${target?.maxHp})`,
              'normal'
            );
            addPopup(targetUnit.x, targetUnit.z, result.isCrit ? `💥${dmg}` : `-${dmg}`, 'damage');
            if (result.isCrit) addLog(`치명타!`, 'damage');
            // 플레이어 공격 이펙트
            const fx = skill ? (skill.type === 'aoe' ? 'explosion' : skill.damage_multiplier >= 1.5 ? 'magic' : 'slash') : 'slash';
            const fxColor = skill ? '#8844ff' : '#ff4444';
            addEffect(targetUnit.x, targetUnit.z, fx, fxColor);
            if (target && target.hp <= 0) {
              addLog(`${targetUnit.icon}${targetUnit.name} 처치!`, 'heal');
            }
          }

          return updated;
        });

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
      if (activeUnit.id === 'player') setSpriteState('skill');
      setUnits(prev => {
        const updated = prev.map(u => {
          if (u.id === activeUnit.id) {
            const newU = { ...u, mp: u.mp - skill.mp_cost, acted: true };
            const bs = skill.buff_stat;
            if (bs === 'attack') newU.attack += skill.buff_value;
            if (bs === 'defense') newU.defense += skill.buff_value;
            if (bs === 'phys_attack') newU.physAttack = (newU.physAttack||0) + skill.buff_value;
            if (bs === 'phys_defense') newU.physDefense = (newU.physDefense||0) + skill.buff_value;
            if (bs === 'mag_attack') newU.magAttack = (newU.magAttack||0) + skill.buff_value;
            if (bs === 'mag_defense') newU.magDefense = (newU.magDefense||0) + skill.buff_value;
            if (bs === 'crit_rate') newU.critRate = (newU.critRate||0) + skill.buff_value;
            if (bs === 'evasion') newU.evasion = (newU.evasion||0) + skill.buff_value;
            const STAT_NAMES = { attack:'공격력', defense:'방어력', phys_attack:'물공', phys_defense:'물방', mag_attack:'마공', mag_defense:'마방', crit_rate:'치명타', evasion:'회피' };
            const statLabel = STAT_NAMES[bs] || bs;
            addLog(`[R${roundCount}] ${u.icon}${u.name}의 [${skill.name}]! ${statLabel}+${skill.buff_value}!`, 'system');
            addPopup(u.x, u.z, `${statLabel}↑`, 'system');
            addEffect(u.x, u.z, 'buff', bs === 'attack' || bs === 'phys_attack' || bs === 'mag_attack' ? '#ff6600' : '#4488ff');
            return newU;
          }
          return u;
        });
        unitsRef.current = updated;
        return updated;
      });
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

  // 컨텍스트 메뉴 액션 핸들러
  const handleMenuAction = (action, data) => {
    if (action === 'move') {
      handleMove();
      setCtxMenu({ show: false, mode: 'main' });
    } else if (action === 'attack') {
      handleAttack();
      setCtxMenu({ show: false, mode: 'main' });
    } else if (action === 'showSkills') {
      setCtxMenu({ show: true, mode: 'skills' });
    } else if (action === 'skill') {
      handleSkill(data);
      setCtxMenu({ show: false, mode: 'main' });
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

    if (victory) {
      let tExp = 0, tGold = 0;
      for (const m of defeated) {
        tExp += m.expReward || 0;
        tGold += m.goldReward || 0;
      }
      setTotalExpGained(tExp);
      setTotalGoldGained(tGold);
      addLog(`승리! EXP +${tExp}, Gold +${tGold}`, 'level');
      api.post('/battle/srpg-result', {
        location, victory: true,
        monstersDefeated: defeated.map(m => m.name),
        expGained: tExp, goldGained: tGold, rounds: roundCount,
        activeSummonIds: (activeSummons || []).map(s => s.id),
      }).catch(console.error);
    } else {
      addLog('패배... 마을에서 휴식하세요.', 'damage');
      api.post('/battle/srpg-result', {
        location, victory: false,
        monstersDefeated: [], expGained: 0, goldGained: 0, rounds: roundCount,
        activeSummonIds: [],
      }).catch(console.error);
    }
  }, [phase, battleResult]); // eslint-disable-line

  const handleRetreat = () => {
    addLog('전투에서 후퇴했습니다.', 'damage');
    onBattleEnd('retreat', 0, 0);
  };

  if (loading || !mapData) return <div className="srpg-loading">맵 로딩 중...</div>;

  return (
    <div className="srpg-container">
      <div className="srpg-map">
        <IsometricMap
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
          onCanvasMiss={() => { if (ctxMenu.show) setCtxMenu({ show: false, mode: 'main' }); }}
          skillEffects={skillEffects}
        />
      </div>

      <div className="srpg-hud">
        <div className="srpg-turn-info">
          <span className="srpg-round">Round {roundCount}</span>
          {activeUnit && (
            <span className={`srpg-active-unit ${activeUnit.team}`}>
              {activeUnit.icon} {activeUnit.name}의 턴
            </span>
          )}
          {phase !== PHASE.BATTLE_END && (
            <div className="srpg-turn-controls">
              <button
                className={`srpg-auto-btn ${autoAll ? 'active' : ''}`}
                onClick={() => { setAutoAll(v => !v); if (!autoAll) setAutoSummon(false); }}
              >
                모두자동 {autoAll ? 'ON' : 'OFF'}
              </button>
              <button
                className={`srpg-auto-btn summon ${autoSummon ? 'active' : ''}`}
                onClick={() => { setAutoSummon(v => !v); if (!autoSummon) setAutoAll(false); }}
                disabled={!activeSummons || activeSummons.length === 0}
              >
                소환수자동 {autoSummon ? 'ON' : 'OFF'}
              </button>
              <button
                className="srpg-retreat-btn"
                onClick={() => setShowRetreatConfirm(true)}
              >
                후퇴
              </button>
            </div>
          )}
        </div>

        <div className="srpg-turn-order">
          {turnQueue.map(id => {
            const u = units.find(uu => uu.id === id);
            if (!u || u.hp <= 0) return null;
            return (
              <div key={u.id} className={`srpg-turn-unit ${u.team} ${activeUnit && activeUnit.id === u.id ? 'active' : ''}`}>
                <span className="srpg-turn-icon">{u.icon}</span>
                <div className="srpg-turn-hp-bar">
                  <div className="srpg-turn-hp-fill" style={{ width: `${(u.hp / u.maxHp) * 100}%` }} />
                </div>
              </div>
            );
          })}
        </div>

        {activeUnit && (
          <div className="srpg-unit-detail">
            <div className="srpg-unit-name">{activeUnit.icon} {activeUnit.name} Lv.{activeUnit.level}</div>
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
              const te = getTerrainEffect(tile.type);
              return (
                <div className="srpg-terrain-info">
                  <span>지형: {te.label}</span>
                  {tile.height > 0 && <span>높이: {tile.height}</span>}
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

      {showRetreatConfirm && (
        <div className="srpg-result-overlay">
          <div className="srpg-result-box defeat">
            <h2>후퇴하시겠습니까?</h2>
            <p className="srpg-retreat-desc">
              전투를 포기하고 마을로 돌아갑니다.<br/>경험치와 골드를 받을 수 없습니다.
            </p>
            <div className="srpg-retreat-actions">
              <button className="srpg-result-btn" onClick={handleRetreat}>
                후퇴하기
              </button>
              <button
                className="srpg-result-btn srpg-result-btn-cancel"
                onClick={() => setShowRetreatConfirm(false)}
              >
                전투 계속
              </button>
            </div>
          </div>
        </div>
      )}

      {phase === PHASE.BATTLE_END && (
        <div className="srpg-result-overlay">
          <div className={`srpg-result-box ${battleResult}`}>
            <h2>{battleResult === 'victory' ? '승리!' : '패배...'}</h2>
            {battleResult === 'victory' && (
              <div className="srpg-result-rewards">
                <div className="srpg-reward-row">
                  <span>획득 경험치</span>
                  <span className="srpg-reward-val exp">+{totalExpGained} EXP</span>
                </div>
                <div className="srpg-reward-row">
                  <span>획득 골드</span>
                  <span className="srpg-reward-val gold">+{totalGoldGained} Gold</span>
                </div>
                <div className="srpg-reward-row">
                  <span>전투 라운드</span>
                  <span className="srpg-reward-val">{roundCount} R</span>
                </div>
              </div>
            )}
            <button
              className="srpg-result-btn"
              onClick={() => onBattleEnd(battleResult, totalExpGained, totalGoldGained)}
            >
              {battleResult === 'victory' ? '계속하기' : '마을로 돌아가기'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
