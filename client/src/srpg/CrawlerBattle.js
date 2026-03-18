import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  createCardPlayerUnit, createCardSummonUnit, createCardMercenaryUnit, createCardMonsterUnit,
  assignGridPositions,
  calculateTurnOrder, getValidTargets, getHealTargets, getGuardTargets,
  executeAttack, executeSkill, executeGuard,
  onTurnStart, decideAIAction, checkBattleEnd, calculateRewards, isStunned, isCharmed,
} from './cardBattleEngine';
import { rollEliteTier, applyEliteStats } from './battleEngine';
import api from '../api';
import './CrawlerBattle.css';

const CLASS_ELEMENT_MAP = { '풍수사': 'wind', '무당': 'dark', '승려': 'light', '저승사자': 'dark' };

const MONSTER_BATTLE_LINES = [
  '크아아아!! 덤벼라!', '잡아주마!', '이 힘을 보여주겠다!',
  '도망칠 생각은 마!', '으라차차!', '여기가 네 무덤이다!',
  '크르르... 가만 안 둬!', '한 놈도 못 보내!', '크허허, 맛있겠다!',
  '감히 내 앞에...!', '이번엔 봐주지 않는다!', '으하하! 약하군!',
  '그 정도로 나를 이길 수 있을 것 같아?', '인간 따위에게...!', '후회하게 될 거다!',
  '이, 이게 무슨...!', '제법이군... 하지만!', '크윽... 아직 안 끝났어!',
  '이번엔 진심이다!', '내가 이렇게 당하다니!', '비, 비겁한 놈들!',
  '동료들이 오면 끝장이야!', '크르르... 화났어!', '한 번만 더!',
  '흥, 간지러워!', '날 무시하는 거야?!', '크억... 이 일격은...',
  '우리 우두머리가 가만 안 둘 거야!', '잠, 잠깐! 타임!', '그, 그만 때려!',
];
const MONSTER_LOW_HP_LINES = [
  '크으... 이럴 수가...', '으악... 너무 아파...', '도, 도망쳐야...', '제발... 그만...',
  '이대로 끝이야...?', '더 이상은... 못 버텨...', '눈앞이... 깜깜해...',
  '나를... 이기다니...', '크윽... 동료들에게...', '살려... 줘...',
];
const MONSTER_START_LINES = [
  '감히 우리 던전에?!', '침입자다! 잡아라!', '오늘 네가 마지막이다!',
  '크하하! 먹잇감이 왔다!', '으르르... 후회할 거다!', '여기서 뼈를 묻어라!',
];

const BUFF_ICONS = {
  attack: { icon: '⚔️', label: '공격력' },
  defense: { icon: '🛡️', label: '방어력' },
  phys_attack: { icon: '💪', label: '물리공격' },
  phys_defense: { icon: '🧱', label: '물리방어' },
  mag_attack: { icon: '🔮', label: '마법공격' },
  mag_defense: { icon: '🌀', label: '마법방어' },
  speed: { icon: '💨', label: '속도' },
  crit_rate: { icon: '🎯', label: '치명타' },
  evasion: { icon: '👻', label: '회피' },
  hp: { icon: '❤️', label: 'HP' },
  stun: { icon: '⚡', label: '마비' },
  poison: { icon: '🧪', label: '독' },
  charm: { icon: '💘', label: '매혹' },
  seal: { icon: '🚫', label: '봉인' },
  regen: { icon: '💚', label: '재생' },
  mp_regen: { icon: '💎', label: '마력충전' },
  immortal: { icon: '🛡️', label: '불멸' },
  auto_revive: { icon: '🔄', label: '부활' },
  next_double: { icon: '⚔️', label: '파천' },
};

function BuffIcons({ unit }) {
  const buffs = unit.buffs || [];
  const debuffs = unit.debuffs || [];
  if (buffs.length === 0 && debuffs.length === 0) return null;
  return (
    <div className="cwb-buff-icons">
      {buffs.map((b, i) => (
        <div key={`b${i}`} className="cwb-buff-icon buff" title={`${BUFF_ICONS[b.stat]?.label || b.stat} +${b.value} (${b.duration}턴)`}>
          <span className="cwb-buff-emoji">{BUFF_ICONS[b.stat]?.icon || '⬆️'}</span>
          <span className="cwb-buff-dur">{b.duration}</span>
        </div>
      ))}
      {debuffs.map((b, i) => (
        <div key={`d${i}`} className="cwb-buff-icon debuff" title={`${BUFF_ICONS[b.stat]?.label || b.stat} -${b.value} (${b.duration}턴)`}>
          <span className="cwb-buff-emoji">{BUFF_ICONS[b.stat]?.icon || '⬇️'}</span>
          <span className="cwb-buff-dur">{b.duration}</span>
        </div>
      ))}
    </div>
  );
}

export default function CrawlerBattle({
  stage, character, charState, learnedSkills, passiveBonuses,
  activeSummons, activeMercenaries, monsters: dbMonsters,
  groupKey, onBattleEnd, onLog,
  isBossEncounter,
  autoPath,
}) {
  const [units, setUnits] = useState([]);
  const [turnOrder, setTurnOrder] = useState([]);
  const [, setCurrentTurnIdx] = useState(0);
  const [round, setRound] = useState(1);
  const [phase, setPhase] = useState('init');
  const [turnTick, setTurnTick] = useState(0);
  const [selectedAction, setSelectedAction] = useState(null);
  const [selectedSkill, setSelectedSkill] = useState(null);
  const [battleResult, setBattleResult] = useState(null);
  const [logs, setLogs] = useState([]);
  const [damagePopups, setDamagePopups] = useState([]);
  const [inspectMonster, setInspectMonster] = useState(null);
  const [showSkillList, setShowSkillList] = useState(false);
  const [potions, setPotions] = useState([]);
  const [showItemList, setShowItemList] = useState(false);
  const [totalExpGained, setTotalExpGained] = useState(0);
  const [totalGoldGained, setTotalGoldGained] = useState(0);
  const [resultData, setResultData] = useState(null);
  const [shakeTarget, setShakeTarget] = useState(null);
  const [flashTarget, setFlashTarget] = useState(null);
  const [autoAll, setAutoAll] = useState(!!autoPath);
  const [autoCompanion, setAutoCompanion] = useState(false);
  const [showRetreatConfirm, setShowRetreatConfirm] = useState(false);
  const [, setRetreatFailed] = useState(false);
  const [retreatDisabled, setRetreatDisabled] = useState(false);
  const [retreatResult, setRetreatResult] = useState(null);
  const [retreatDisplayPct, setRetreatDisplayPct] = useState(50);
  const [eliteAlert, setEliteAlert] = useState(null);
  const [attackingEnemy, setAttackingEnemy] = useState(null);
  const [hitFlash, setHitFlash] = useState(false);
  const [attackEffect, setAttackEffect] = useState(null); // { type: 'slash'|'magic'|'heal', targetId }
  const [monsterSpeech, setMonsterSpeech] = useState(null); // { unitId, text }
  const [skillCutIn, setSkillCutIn] = useState(null); // { skillName, skillIcon, skillIconUrl, casterName }
  const [playerAttacking, setPlayerAttacking] = useState(false); // 플레이어 공격 모션
  const [inspectAlly, setInspectAlly] = useState(null); // 아군 정보 팝업
  const [contributions, setContributions] = useState([]); // 기여도
  const logRef = useRef(null);
  const unitsRef = useRef([]);
  const turnRef = useRef([]);
  const idxRef = useRef(0);
  const roundRef = useRef(1);
  const popupId = useRef(0);
  const battleSummonIdsRef = useRef([]);
  const battleMercIdsRef = useRef([]);
  const playerInBattleRef = useRef(true);
  const contributionRef = useRef({}); // unitId -> { damage, kills }
  const monsterSpeechTimer = useRef(null);
  const initDone = useRef(false);

  const addLog = useCallback((text, type = 'system') => {
    setLogs(prev => [...prev.slice(-80), { text, type, id: Date.now() + Math.random() }]);
  }, []);

  const addPopup = useCallback((unitId, text, type) => {
    const id = ++popupId.current;
    setDamagePopups(prev => [...prev, { id, unitId, text, type }]);
    setTimeout(() => setDamagePopups(prev => prev.filter(p => p.id !== id)), 1200);
  }, []);

  const showMonsterSpeech = useCallback((unitId, text, duration = 4000) => {
    if (monsterSpeechTimer.current) clearTimeout(monsterSpeechTimer.current);
    setMonsterSpeech({ unitId, text });
    monsterSpeechTimer.current = setTimeout(() => { setMonsterSpeech(null); monsterSpeechTimer.current = null; }, duration);
  }, []);

  // ===== 초기화 =====
  useEffect(() => {
    if (!character || !charState || initDone.current) return;
    initDone.current = true;
    const init = async () => {
      try {
      // 물약
      try { const r = await api.get('/equipment/info'); setPotions(r.data.potions || []); } catch {}

      // 플레이어 (HP가 0이면 최소 1로 보정 - 이전 버그 방어)
      const playerData = {
        ...character, current_hp: Math.max(1, charState.currentHp || 1), current_mp: Math.max(0, charState.currentMp || 0),
        hp: charState.maxHp || character.hp || 100, mp: charState.maxMp || character.mp || 50,
        attack: charState.attack || character.attack || 10, defense: charState.defense || character.defense || 5,
        phys_attack: charState.physAttack || 0, phys_defense: charState.physDefense || 0,
        mag_attack: charState.magAttack || 0, mag_defense: charState.magDefense || 0,
        crit_rate: charState.critRate || 5, evasion: charState.evasion || 3, level: charState.level || character.level || 1,
        element: character.element || CLASS_ELEMENT_MAP[character.class_type] || 'neutral',
      };
      const playerUnit = createCardPlayerUnit(playerData, learnedSkills, passiveBonuses);

      // 진형 기반 유닛 필터링
      let battleSummons = activeSummons || [];
      let battleMercs = (activeMercenaries || []).filter(m => m.fatigue === undefined || m.fatigue > 0);
      let playerInFormation = true;
      let cosmeticMap = {};
      try {
        const [summonRes, mercRes, fRes, cosRes] = await Promise.all([
          api.get('/summon/my'),
          api.get('/mercenary/my'),
          api.get('/formation/list'),
          api.get('/shop/cosmetics/equipped').catch(() => ({ data: { cosmetics: {} } })),
        ]);
        cosmeticMap = cosRes.data.cosmetics || {};
        const freshSummons = summonRes.data.summons || [];
        const freshMercs = mercRes.data.mercenaries || [];
        const mainFormation = fRes.data.formations?.find(f => f.slotIndex === 0);
        if (mainFormation?.gridData) {
          const grid = mainFormation.gridData;
          const hasUnits = grid.some(row => row.some(cell => cell && cell.unitId));
          if (hasUnits) {
            const unitIds = new Set();
            grid.forEach(row => row.forEach(cell => { if (cell?.unitId) unitIds.add(cell.unitId); }));
            playerInFormation = unitIds.has('player');
            battleSummons = freshSummons.filter(s => unitIds.has(`summon_${s.id}`));
            battleMercs = freshMercs.filter(m => unitIds.has(`merc_${m.id}`) && (m.fatigue === undefined || m.fatigue > 0));
          }
        }
      } catch {}

      playerInBattleRef.current = playerInFormation;
      const playerTeam = playerInFormation ? [playerUnit] : [];

      // 소환수
      const summons = battleSummons.map(s => createCardSummonUnit(s));
      battleSummonIdsRef.current = summons.map(s => s.summonId);
      playerTeam.push(...summons);

      // 용병
      const mercs = battleMercs.map(m => createCardMercenaryUnit(m));
      battleMercIdsRef.current = mercs.map(m => m.mercId);
      playerTeam.push(...mercs);

      // 코스메틱 효과 주입
      const ELEM_AURA = { fire:'flame', water:'ice', earth:'aura_gold', wind:'wind', neutral:'holy', light:'holy', dark:'shadow' };
      for (const unit of playerTeam) {
        const cm = cosmeticMap?.[unit.id];
        if (cm?.effect) {
          unit.portraitEffect = cm.effect;
        } else {
          const el = unit.element || (unit.id === 'player' ? CLASS_ELEMENT_MAP[unit.classType] : null) || 'neutral';
          unit.portraitEffect = ELEM_AURA[el] || 'aura_gold';
        }
      }

      // 적
      const monsterPool = dbMonsters || [];
      const count = stage?.monsterCount || Math.min(3 + Math.floor(Math.random() * 2), monsterPool.length);
      const enemyTeam = [];
      for (let i = 0; i < count && monsterPool.length > 0; i++) {
        const template = monsterPool[Math.floor(Math.random() * monsterPool.length)];
        const levelBonus = stage?.monsterLevelBonus || 0;
        const unit = createCardMonsterUnit(template, i, levelBonus, stage);
        // 정예 처리
        if (!isBossEncounter && Math.random() < 0.15) {
          const tier = rollEliteTier();
          if (tier) applyEliteStats(unit, tier);
        }
        if (isBossEncounter && i === count - 1) {
          unit.hp = Math.floor(unit.hp * 1.5);
          unit.maxHp = unit.hp;
          unit.attack = Math.floor(unit.attack * 1.3);
          unit.name = `🔥 ${unit.name}`;
        }
        enemyTeam.push(unit);
      }

      assignGridPositions(playerTeam, enemyTeam);
      const all = [...playerTeam, ...enemyTeam];
      const order = calculateTurnOrder(all);

      setUnits(all);
      unitsRef.current = all;
      setTurnOrder(order);
      turnRef.current = order;
      setCurrentTurnIdx(0);
      idxRef.current = 0;
      setRound(1);
      roundRef.current = 1;
      addLog(`전투 시작! 적 ${enemyTeam.length}마리 출현!`);

      // 전투 시작 몬스터 말풍선
      if (enemyTeam.length > 0) {
        const speaker = enemyTeam[Math.floor(Math.random() * enemyTeam.length)];
        const line = MONSTER_START_LINES[Math.floor(Math.random() * MONSTER_START_LINES.length)];
        setTimeout(() => showMonsterSpeech(speaker.id, line, 3000), 500);
        addLog(`👹 ${speaker.name}: "${line}"`);
      }

      // 정예 알림
      const firstElite = enemyTeam.find(u => u.eliteTier);
      if (firstElite) {
        setEliteAlert({ name: firstElite.name, monsterId: firstElite.monsterId, tier: firstElite.eliteTier });
        setTimeout(() => setEliteAlert(null), 2500);
      }

      setTurnTick(1);
      setPhase('start_turn');
      } catch (err) {
        console.error('CrawlerBattle init error:', err);
        // 에러 발생 시에도 최소한 전투 진입은 되도록
        addLog('전투 초기화 중 오류가 발생했습니다.', 'damage');
      }
    };
    init();
  }, [character, charState]); // eslint-disable-line

  // ===== 턴 진행 =====
  useEffect(() => {
    if (phase !== 'start_turn') return;
    const order = turnRef.current;
    const idx = idxRef.current;
    if (order.length === 0) return;

    const unitId = order[idx % order.length];
    const unit = unitsRef.current.find(u => u.id === unitId);
    if (!unit || unit.hp <= 0) {
      advanceTurn();
      return;
    }

    // 턴 시작 효과 (독 데미지 등)
    const turnLogs = onTurnStart(unit);
    setUnits([...unitsRef.current]);
    if (turnLogs) turnLogs.forEach(l => { addLog(l.text, l.type); if (l.type === 'poison') addPopup(l.targetId, `-${l.damage}🧪`, 'damage'); });

    if (unit.hp <= 0) { advanceTurn(); return; }

    // 마비 상태면 강제 대기
    if (isStunned(unit)) {
      addLog(`${unit.name}은(는) 마비되어 행동할 수 없다!`, 'debuff');
      setTimeout(() => advanceTurn(), 800);
      return;
    }
    // 매혹 상태면 아군 랜덤 공격
    if (isCharmed(unit)) {
      addLog(`${unit.name}은(는) 매혹되어 아군을 공격한다!`, 'debuff');
      if (unit.team === 'player') {
        setTimeout(() => executeAutoTurn(unit), 800);
      } else {
        setTimeout(() => executeEnemyTurn(unit), 900);
      }
      return;
    }

    if (unit.team === 'player') {
      const isCompanion = unit.id !== 'player';
      if (autoAll || (autoCompanion && isCompanion)) {
        setTimeout(() => executeAutoTurn(unit), 800);
      } else {
        setPhase('player_action');
      }
    } else {
      setTimeout(() => executeEnemyTurn(unit), 900);
    }
  }, [phase, turnTick]); // eslint-disable-line

  const handleBattleEndRef = useRef(null);

  const advanceTurn = useCallback(() => {
    const result = checkBattleEnd(unitsRef.current);
    if (result) {
      handleBattleEndRef.current?.(result);
      return;
    }
    // 라운드 갱신
    let newIdx = idxRef.current + 1;
    const order = turnRef.current;
    if (newIdx >= order.length) {
      newIdx = 0;
      roundRef.current += 1;
      setRound(roundRef.current);
      // 쿨다운 감소
      const updated = unitsRef.current.map(u => ({
        ...u,
        skills: u.skills?.map(s => ({ ...s, currentCooldown: Math.max(0, (s.currentCooldown || 0) - 1) })) || [],
      }));
      setUnits(updated);
      unitsRef.current = updated;
    }

    // 죽은 유닛 건너뛰기
    let tries = 0;
    while (tries < order.length) {
      const uid = order[newIdx % order.length];
      const u = unitsRef.current.find(x => x.id === uid);
      if (u && u.hp > 0) break;
      newIdx++;
      tries++;
    }

    idxRef.current = newIdx;
    setCurrentTurnIdx(newIdx);
    setTurnTick(t => t + 1);
    setPhase('start_turn');
  }, []);

  // ===== 전투 종료 =====
  const handleBattleEnd = async (result) => {
    setBattleResult(result);
    setPhase('battle_end');
    if (result === 'victory') {
      const rewards = calculateRewards(unitsRef.current, stage);
      const totalExp = rewards.exp || 0;
      const totalGold = rewards.gold || 0;
      setTotalExpGained(totalExp);
      setTotalGoldGained(totalGold);
      setResultData(rewards);

      // 기여도 계산
      const contribData = contributionRef.current;
      const playerTeamUnits = unitsRef.current.filter(u => u.team === 'player');
      const totalDamage = Object.values(contribData).reduce((sum, c) => sum + c.damage, 0) || 1;
      const contribList = playerTeamUnits.map(u => {
        const c = contribData[u.id] || { damage: 0, kills: 0 };
        const rawPct = c.damage / totalDamage;
        return { id: u.id, name: u.name, icon: u.icon, imageUrl: u.imageUrl, damage: c.damage, kills: c.kills, rawPct };
      });
      const participantCount = contribList.filter(c => c.damage > 0 || (unitsRef.current.find(u => u.id === c.id)?.hp ?? 0) > 0).length || 1;
      const minPct = Math.min(0.05, 1 / participantCount);
      let adjustedPcts = contribList.map(c => {
        const participated = c.damage > 0 || (unitsRef.current.find(u => u.id === c.id)?.hp ?? 0) > 0;
        return { ...c, adjPct: participated ? Math.max(minPct, c.rawPct) : 0 };
      });
      const totalAdjPct = adjustedPcts.reduce((s, c) => s + c.adjPct, 0) || 1;
      const finalContrib = adjustedPcts.map(c => ({
        ...c,
        pct: Math.round((c.adjPct / totalAdjPct) * 100),
        exp: Math.floor(totalExp * (c.adjPct / totalAdjPct)),
      }));
      setContributions(finalContrib);

      // 서버 반영 (기여도 기반 EXP 분배)
      const playerUnit = unitsRef.current.find(u => u.id === 'player');
      const playerExp = finalContrib.find(c => c.id === 'player')?.exp || totalExp;
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
      // 처치 몬스터 목록 (퀘스트 진행용)
      const monstersDefeated = unitsRef.current
        .filter(u => u.team === 'enemy' && u.hp <= 0)
        .map(u => u.name?.replace(/^🔥\s*/, '') || '???');
      try {
        await api.post('/stage/battle-result', {
          victory: true, expGained: playerExp, goldGained: totalGold,
          activeSummonIds: battleSummonIdsRef.current, activeMercenaryIds: battleMercIdsRef.current,
          summonExpMap, mercExpMap,
          playerHp: playerUnit ? Math.max(1, playerUnit.hp) : undefined,
          playerMp: playerUnit ? Math.max(0, playerUnit.mp) : undefined,
          monstersDefeated,
          dungeonKey: groupKey,
        });
      } catch {}
      addLog(`승리! EXP +${totalExp}, Gold +${totalGold}`, 'heal');
    } else {
      // 패배: HP/MP 0으로 서버 반영
      try {
        await api.post('/stage/battle-result', {
          victory: false, expGained: 0, goldGained: 0,
          activeSummonIds: battleSummonIdsRef.current, activeMercenaryIds: battleMercIdsRef.current,
          playerHp: playerInBattleRef.current ? 0 : undefined,
          playerMp: playerInBattleRef.current ? 0 : undefined,
        });
      } catch {}
      addLog('패배...', 'damage');
    }
  };

  handleBattleEndRef.current = handleBattleEnd;

  // 자동길찾기 모드: 승리 시 자동으로 결과 닫기
  useEffect(() => {
    if (autoPath && phase === 'battle_end' && battleResult === 'victory') {
      const t = setTimeout(() => onBattleEnd('victory', totalExpGained, totalGoldGained), 1500);
      return () => clearTimeout(t);
    }
  }, [autoPath, phase, battleResult, totalExpGained, totalGoldGained, onBattleEnd]);

  // ===== 로그 처리 =====
  const processLogEntry = useCallback((entry, attackerId) => {
    addLog(entry.text, entry.type || 'system');
    if (entry.targetId) {
      if (entry.type === 'damage') {
        const dmgNum = parseInt(entry.text.match(/(\d+)\s*(?:데미지|피해)/)?.[1] || entry.text.match(/-?(\d+)/)?.[1] || '0');
        addPopup(entry.targetId, `-${dmgNum}`, 'damage');
        setShakeTarget(entry.targetId);
        setTimeout(() => setShakeTarget(null), 300);
        // 기여도 기록
        if (attackerId && dmgNum > 0) {
          const c = contributionRef.current;
          if (!c[attackerId]) c[attackerId] = { damage: 0, kills: 0 };
          c[attackerId].damage += dmgNum;
        }
      } else if (entry.type === 'heal') {
        addPopup(entry.targetId, entry.text.match(/\+?\d+/)?.[0] || '', 'heal');
      } else if (entry.type === 'evade') {
        addPopup(entry.targetId, 'MISS', 'evade');
      } else if (entry.type === 'buff') {
        addPopup(entry.targetId, '▲BUFF', 'buff');
      } else if (entry.type === 'debuff') {
        addPopup(entry.targetId, '▼DEBUFF', 'debuff');
      } else if (entry.type === 'kill') {
        setFlashTarget(entry.targetId);
        setTimeout(() => setFlashTarget(null), 500);
        // 킬 기여도 기록
        if (attackerId) {
          const c = contributionRef.current;
          if (!c[attackerId]) c[attackerId] = { damage: 0, kills: 0 };
          c[attackerId].kills += 1;
        }
      }
    }
  }, [addLog, addPopup]);

  // ===== 적 턴 실행 =====
  const executeEnemyTurn = useCallback((unit) => {
    const decision = decideAIAction(unit, unitsRef.current);
    if (!decision) { advanceTurn(); return; }

    // 30% 확률로 몬스터 말풍선
    if (Math.random() < 0.30) {
      const hpRatio = unit.hp / unit.maxHp;
      const lines = hpRatio < 0.3 ? MONSTER_LOW_HP_LINES : MONSTER_BATTLE_LINES;
      const line = lines[Math.floor(Math.random() * lines.length)];
      showMonsterSpeech(unit.id, line, 2500);
      addLog(`👹 ${unit.name}: "${line}"`);
    }

    // 스킬 사용 시 컷인 연출
    if (decision.action === 'skill' && decision.skill) {
      setSkillCutIn({
        skillName: decision.skill.name,
        skillIcon: decision.skill.icon || '✨',
        skillIconUrl: null,
        casterName: unit.name,
      });
      setTimeout(() => setSkillCutIn(null), 1000);
    }

    // 공격 애니메이션
    setAttackingEnemy(unit.id);
    setTimeout(() => {
      setAttackingEnemy(null);
      let actionLogs = [];
      if (decision.action === 'attack') {
        actionLogs = executeAttack(unit, decision.target, unitsRef.current);
      } else if (decision.action === 'skill') {
        actionLogs = (executeSkill(unit, decision.skill, decision.target, unitsRef.current)).logs || [];
      } else if (decision.action === 'guard') {
        actionLogs = executeGuard(unit, decision.target);
      }

      // 아군이 피격당하면 화면 플래시
      const hasPlayerDamage = actionLogs.some(l => l.type === 'damage' && decision.target?.team === 'player');
      if (hasPlayerDamage) {
        setHitFlash(true);
        setTimeout(() => setHitFlash(false), 400);
      }

      setUnits([...unitsRef.current]);
      actionLogs.forEach(l => processLogEntry(l, unit.id));
      setTimeout(() => advanceTurn(), 700);
    }, 800);
  }, [advanceTurn, processLogEntry]);

  // ===== 자동 턴 =====
  const executeAutoTurn = useCallback((unit) => {
    const decision = decideAIAction({ ...unit, aiType: 'aggressive' }, unitsRef.current);
    if (!decision) { advanceTurn(); return; }

    // 아군 공격 모션
    if (unit.team === 'player') {
      setPlayerAttacking(true);
      setTimeout(() => setPlayerAttacking(false), 600);
    }
    // 공격 이펙트
    if (decision.target && (decision.action === 'attack' || decision.action === 'skill')) {
      const isMagic = decision.action === 'skill' && (decision.skill?.type === 'aoe' || decision.skill?.type === 'debuff' || (decision.skill?.type === 'attack' && unit.rangeType === 'magic'));
      const isHeal = decision.action === 'skill' && decision.skill?.type === 'heal';
      setAttackEffect({ type: isHeal ? 'heal' : isMagic ? 'magic' : 'slash', targetId: decision.target.id });
      setTimeout(() => setAttackEffect(null), 500);
    }

    let actionLogs = [];
    if (decision.action === 'attack') {
      actionLogs = executeAttack(unit, decision.target, unitsRef.current);
    } else if (decision.action === 'skill') {
      actionLogs = (executeSkill(unit, decision.skill, decision.target, unitsRef.current)).logs || [];
    }

    setUnits([...unitsRef.current]);
    actionLogs.forEach(l => processLogEntry(l, unit.id));
    setTimeout(() => advanceTurn(), 800);
  }, [advanceTurn, processLogEntry]);

  // ===== 플레이어 액션 =====
  // 클릭으로 직접 공격 (player_action 상태에서 적 클릭 시)
  const handleDirectAttack = (target) => {
    const currentUnit = getCurrentUnit();
    if (!currentUnit) return;
    // 플레이어 팀 공격 모션
    if (currentUnit.team === 'player') {
      setPlayerAttacking(true);
      setTimeout(() => setPlayerAttacking(false), 600);
    }
    setAttackEffect({ type: 'slash', targetId: target.id });
    setTimeout(() => setAttackEffect(null), 400);
    const actionLogs = executeAttack(currentUnit, target, unitsRef.current);
    setUnits([...unitsRef.current]);
    actionLogs.forEach(l => processLogEntry(l, currentUnit.id));
    setSelectedAction(null);
    setSelectedSkill(null);
    setPhase('animating');
    setTimeout(() => advanceTurn(), 600);
  };

  const handleAction = (action) => {
    setSelectedAction(action);
    if (action === 'attack') {
      setPhase('select_target');
      setShowSkillList(false);
    } else if (action === 'skill') {
      setShowSkillList(true);
    } else if (action === 'guard') {
      // 수호: 아군 선택 모드로 전환
      setSelectedAction('guard');
      setPhase('select_target');
      setShowSkillList(false);
      setShowItemList(false);
    } else if (action === 'item') {
      setShowItemList(true);
    } else if (action === 'wait') {
      advanceTurn();
    }
  };

  const handleSelectSkill = (skill) => {
    setSelectedSkill(skill);
    setSelectedAction('skill');
    setShowSkillList(false);
    setPhase('select_target');
  };

  const handleSelectTarget = (target) => {
    const currentUnit = getCurrentUnit();
    if (!currentUnit) return;

    // 스킬 사용 시 컷인 연출
    if (selectedAction === 'skill' && selectedSkill) {
      setSkillCutIn({
        skillName: selectedSkill.name,
        skillIcon: selectedSkill.icon || '✨',
        skillIconUrl: selectedSkill.iconUrl || null,
        casterName: currentUnit.name,
      });
      setTimeout(() => setSkillCutIn(null), 1000);
    }

    // 플레이어 팀 공격 모션
    if (currentUnit.team === 'player') {
      setPlayerAttacking(true);
      setTimeout(() => setPlayerAttacking(false), 600);
    }
    // 공격 이펙트
    const isHeal = selectedSkill?.type === 'heal';
    const isMagic = selectedSkill?.type === 'aoe' || selectedSkill?.type === 'debuff' || (selectedSkill?.type === 'attack' && currentUnit.rangeType === 'magic');
    setAttackEffect({ type: isHeal ? 'heal' : isMagic ? 'magic' : 'slash', targetId: target.id });
    setTimeout(() => setAttackEffect(null), 500);

    let actionLogs = [];
    if (selectedAction === 'guard') {
      // 수호: 선택한 아군을 보호
      actionLogs = executeGuard(currentUnit, target);
      addPopup(target.id, '🛡️', 'guard');
    } else if (selectedAction === 'attack') {
      actionLogs = executeAttack(currentUnit, target, unitsRef.current);
    } else if (selectedAction === 'skill' && selectedSkill) {
      actionLogs = (executeSkill(currentUnit, selectedSkill, target, unitsRef.current)).logs || [];
    }

    setUnits([...unitsRef.current]);
    actionLogs.forEach(l => processLogEntry(l, currentUnit.id));
    setSelectedAction(null);
    setSelectedSkill(null);
    setPhase('animating');
    setTimeout(() => advanceTurn(), 500);
  };

  const handleUsePotion = async (item) => {
    const currentUnit = getCurrentUnit();
    if (!currentUnit || currentUnit.id !== 'player') return;
    try {
      await api.post('/equipment/use-potion', { invId: item.inv_id });

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
        const newBuffs = [...(currentUnit.buffs || [])];
        for (const sm of statMap) {
          const val = item[sm.key] || 0;
          if (val > 0) {
            const existing = newBuffs.findIndex(b => b.stat === sm.stat && b.source === 'talisman');
            if (existing >= 0) newBuffs.splice(existing, 1);
            newBuffs.push({ stat: sm.stat, value: val, duration: 3, source: 'talisman', name: item.name });
            buffEffects.push(`${sm.label}+${val}`);
          }
        }
        // 특수 부적 처리
        if (item.name === '재생 부적') { newBuffs.push({ stat: 'regen', value: 5, duration: 5, source: 'talisman', name: item.name }); buffEffects.push('매턴 HP 5% 회복'); }
        if (item.name === '마력 충전 부적') { newBuffs.push({ stat: 'mp_regen', value: 3, duration: 5, source: 'talisman', name: item.name }); buffEffects.push('매턴 MP 3% 회복'); }
        if (item.name === '불멸 부적') { newBuffs.push({ stat: 'immortal', value: 1, duration: 3, source: 'talisman', name: item.name }); buffEffects.push('3턴간 불멸'); }
        if (item.name === '파천 부적') { newBuffs.push({ stat: 'next_double', value: 1, duration: 1, source: 'talisman', name: item.name }); buffEffects.push('다음 공격 2배'); }
        if (item.name === '부활 부적') { newBuffs.push({ stat: 'auto_revive', value: 30, duration: 99, source: 'talisman', name: item.name }); buffEffects.push('사망 시 HP 30% 부활'); }
        currentUnit.buffs = newBuffs;
        // 저주/봉인 부적: 적에게 디버프
        if (item.name === '저주 부적') {
          const enemies = unitsRef.current.filter(u => u.team === 'enemy' && u.hp > 0);
          if (enemies.length > 0) {
            const target = enemies.reduce((a, b) => (b.physAttack||0)+(b.magAttack||0) > (a.physAttack||0)+(a.magAttack||0) ? b : a);
            target.debuffs = [...(target.debuffs||[]), { stat:'attack', value:-20, duration:3, source:'talisman', name:item.name }, { stat:'defense', value:-20, duration:3, source:'talisman', name:item.name }];
            buffEffects.push(`${target.name} 공격/방어 -20%`);
          }
        }
        if (item.name === '봉인 부적') {
          const enemies = unitsRef.current.filter(u => u.team === 'enemy' && u.hp > 0);
          if (enemies.length > 0) {
            const target = enemies.reduce((a, b) => (b.skills?.length||0) > (a.skills?.length||0) ? b : a);
            target.debuffs = [...(target.debuffs||[]), { stat:'seal', value:1, duration:2, source:'talisman', name:item.name }];
            buffEffects.push(`${target.name} 스킬 봉인 2턴`);
          }
        }
        const effectText = buffEffects.length > 0 ? buffEffects.join(', ') : item.description;
        addPopup('player', `📜 ${item.name}`, 'buff');
        addLog(`${item.name} 사용! (${effectText})`, 'buff');
      } else {
        // 물약: HP/MP 회복
        const hpHeal = item.effect_hp || 0;
        const mpHeal = item.effect_mp || 0;
        if (hpHeal > 0) {
          const actual = Math.min(hpHeal, currentUnit.maxHp - currentUnit.hp);
          currentUnit.hp += actual;
          addPopup('player', `HP+${actual}`, 'heal');
          addLog(`${item.name} 사용! HP +${actual}`, 'heal');
        }
        if (mpHeal > 0) {
          const actual = Math.min(mpHeal, currentUnit.maxMp - currentUnit.mp);
          currentUnit.mp += actual;
          addPopup('player', `MP+${actual}`, 'heal');
          addLog(`${item.name} 사용! MP +${actual}`, 'heal');
        }
      }
      setUnits([...unitsRef.current]);
      setPotions(prev => prev.map(p =>
        p.inv_id === item.inv_id ? { ...p, quantity: p.quantity - 1 } : p
      ).filter(p => p.quantity > 0));
    } catch (err) {
      addLog(err.response?.data?.message || '아이템 사용 실패', 'damage');
    }
    setShowItemList(false);
    advanceTurn();
  };

  const handleRetreat = () => {
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
  };

  const getCurrentUnit = () => {
    const order = turnRef.current;
    const idx = idxRef.current;
    if (order.length === 0) return null;
    const unitId = order[idx % order.length];
    return unitsRef.current.find(u => u.id === unitId);
  };

  // 로그 스크롤
  useEffect(() => {
    if (logRef.current) logRef.current.scrollTop = logRef.current.scrollHeight;
  }, [logs]);

  const currentUnit = getCurrentUnit();
  const enemyTeam = units.filter(u => u.team === 'enemy');

  // 선택 가능한 타겟
  const validTargets = phase === 'select_target' && currentUnit
    ? (selectedAction === 'guard'
      ? getGuardTargets(currentUnit, unitsRef.current.filter(u => u.team === currentUnit.team))
      : selectedSkill?.buff_stat === 'revive'
        ? unitsRef.current.filter(u => u.team === currentUnit.team && u.hp <= 0)
        : selectedSkill?.buff_stat === 'cleanse'
          ? unitsRef.current.filter(u => u.team === currentUnit.team && u.hp > 0 && (u.debuffs || []).length > 0)
          : selectedSkill?.type === 'heal'
            ? getHealTargets(currentUnit, unitsRef.current)
            : getValidTargets(currentUnit, unitsRef.current, selectedSkill))
    : [];

  // ===== 렌더링 =====
  if (phase === 'battle_end') {
    const isVictory = battleResult === 'victory';
    const playerUnit = unitsRef.current.find(u => u.id === 'player');
    return (
      <div className="cwb-container">
        <div className={`cwb-result-screen ${battleResult}`}>
          <div className="cwb-result-bg">
            <img src={`/ui/battle/cwb_${isVictory ? 'victory' : 'defeat'}_bg.png`} alt="" className="cwb-result-bg-img" />
            <div className="cwb-result-bg-overlay" />
          </div>
          <div className="cwb-result-particles">
            <img src={`/ui/battle/cwb_${isVictory ? 'victory' : 'defeat'}_particles.png`} alt="" className="cwb-result-particles-img" />
            {[...Array(16)].map((_, i) => <div key={i} className={`cwb-result-particle ${battleResult}`} style={{ '--i': i }} />)}
          </div>
          {isVictory && <div className="cwb-result-light-rays" />}
          {!isVictory && (
            <>
              <div className="cwb-defeat-dark-rays" />
              <div className="cwb-defeat-chains">
                <img src="/ui/battle/cwb_defeat_chains.png" alt="" onError={e => { e.target.style.display = 'none'; }} />
              </div>
              <div className="cwb-defeat-fog">
                {[...Array(5)].map((_, i) => <div key={i} className="cwb-defeat-fog-wisp" style={{ '--fi': i }} />)}
              </div>
            </>
          )}
          <div className={`cwb-result-content ${!isVictory ? 'defeat-content' : ''}`}>
            {isVictory && (
              <img src="/ui/battle/cwb_victory_frame.png" alt="" className="cwb-result-frame" onError={e => { e.target.style.display = 'none'; }} />
            )}
            {!isVictory && (
              <img src="/ui/battle/cwb_defeat_frame.png" alt="" className="cwb-result-frame defeat-frame" onError={e => { e.target.style.display = 'none'; }} />
            )}
            <div className={`cwb-result-icon-wrap ${battleResult}`}>
              <img src={`/ui/battle/cwb_${isVictory ? 'victory' : 'defeat'}_icon.png`} alt="" className="cwb-result-icon-img" />
              <div className={`cwb-result-icon-glow ${battleResult}`} />
              {isVictory && <div className="cwb-result-icon-sparkles">{[...Array(6)].map((_, i) => <span key={i} style={{ '--si': i }} />)}</div>}
              {!isVictory && <div className="cwb-defeat-icon-drip">{[...Array(4)].map((_, i) => <span key={i} style={{ '--di': i }} />)}</div>}
            </div>
            <div className={`cwb-result-title ${battleResult}`}>
              {isVictory ? 'VICTORY' : 'DEFEAT'}
            </div>
            {isVictory && <div className="cwb-result-subtitle">전투에서 승리했습니다!</div>}
            {!isVictory && <div className="cwb-defeat-subtitle">어둠이 당신을 삼켰습니다</div>}
            <div className="cwb-result-divider"><span /></div>
            {isVictory && resultData && (
              <div className="cwb-result-rewards">
                {/* 보상 그리드 */}
                <div className="cwb-result-section-title">
                  <span>⚔️ 전투 보상</span>
                </div>
                <div className="cwb-reward-grid">
                  <div className="cwb-reward-card exp">
                    <span className="cwb-reward-card-icon">⭐</span>
                    <span className="cwb-reward-card-label">경험치</span>
                    <span className="cwb-reward-card-value">+{totalExpGained}</span>
                  </div>
                  <div className="cwb-reward-card gold">
                    <span className="cwb-reward-card-icon">💰</span>
                    <span className="cwb-reward-card-label">골드</span>
                    <span className="cwb-reward-card-value">+{totalGoldGained}</span>
                  </div>
                </div>

                {/* 드랍 아이템 */}
                {resultData.drops?.length > 0 && (
                  <div className="cwb-result-drops">
                    <div className="cwb-result-drops-label">📦 획득 아이템</div>
                    <div className="cwb-result-drops-list">
                      {resultData.drops.map((drop, i) => (
                        <div key={i} className="cwb-result-drop-chip">
                          <span className="cwb-result-drop-icon">{drop.icon || '📦'}</span>
                          <span>{drop.name}</span>
                          <span className="cwb-result-drop-qty">x{drop.quantity}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* 기여도 */}
                {contributions.length > 0 && (
                  <div className="cwb-contrib-section">
                    <div className="cwb-result-section-title"><span>📊 기여도 (EXP 분배)</span></div>
                    <div className="cwb-contrib-list">
                      {contributions.filter(c => c.pct > 0).sort((a, b) => b.pct - a.pct).map(c => (
                        <div key={c.id} className={`cwb-contrib-row ${c.id === 'player' ? 'player' : ''}`}>
                          <div className="cwb-contrib-unit">
                            <img src={c.imageUrl} alt="" className="cwb-contrib-icon" onError={e => { e.target.style.display = 'none'; }} />
                            <span className="cwb-contrib-name">{c.name}</span>
                          </div>
                          <div className="cwb-contrib-stats">
                            <span className="cwb-contrib-dmg">{(c.damage || 0).toLocaleString()} DMG</span>
                            {c.kills > 0 && <span className="cwb-contrib-kills">{c.kills} Kill</span>}
                          </div>
                          <div className="cwb-contrib-bar-outer">
                            <div className="cwb-contrib-bar-wrap">
                              <div className="cwb-contrib-bar" style={{ width: `${c.pct}%` }} />
                            </div>
                            <span className="cwb-contrib-pct">{c.pct}%</span>
                          </div>
                          <span className="cwb-contrib-exp">+{c.exp} EXP</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* 전투 후 상태 */}
                {playerUnit && (
                  <div className="cwb-result-status">
                    <div className="cwb-result-section-title"><span>❤️ 전투 후 상태</span></div>
                    <div className="cwb-result-status-bars">
                      <div className="cwb-status-row">
                        <span className="cwb-status-label hp">HP</span>
                        <div className="cwb-status-track">
                          <div className="cwb-status-fill hp" style={{ width: `${Math.min(100, (Math.max(1, playerUnit.hp) / playerUnit.maxHp) * 100)}%` }} />
                        </div>
                        <span className="cwb-status-text">{Math.max(1, playerUnit.hp)}/{playerUnit.maxHp}</span>
                      </div>
                      <div className="cwb-status-row">
                        <span className="cwb-status-label mp">MP</span>
                        <div className="cwb-status-track">
                          <div className="cwb-status-fill mp" style={{ width: `${playerUnit.maxMp > 0 ? Math.min(100, (playerUnit.mp / playerUnit.maxMp) * 100) : 0}%` }} />
                        </div>
                        <span className="cwb-status-text">{Math.max(0, playerUnit.mp)}/{playerUnit.maxMp}</span>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}
            {!isVictory && (
              <div className="cwb-defeat-detail">
                <div className="cwb-defeat-skull-wrap">
                  <img src="/ui/battle/cwb_defeat_skull.png" alt="" className="cwb-defeat-skull-img" onError={e => { e.target.style.display = 'none'; }} />
                  <div className="cwb-defeat-skull-glow" />
                </div>
                <div className="cwb-defeat-msg-main">의식이 희미해집니다...</div>
                <div className="cwb-defeat-msg-sub">마을 여관에서 회복할 수 있습니다</div>
                <div className="cwb-defeat-penalties">
                  <div className="cwb-defeat-penalty-item">
                    <span className="cwb-defeat-penalty-icon">💀</span>
                    <span className="cwb-defeat-penalty-text">던전 탐사 중단</span>
                  </div>
                  <div className="cwb-defeat-penalty-item">
                    <span className="cwb-defeat-penalty-icon">🏚️</span>
                    <span className="cwb-defeat-penalty-text">여관으로 이송</span>
                  </div>
                </div>
              </div>
            )}
            <button className={`cwb-result-btn ${battleResult}`} onClick={() => onBattleEnd(battleResult, totalExpGained, totalGoldGained)}>
              <span className="cwb-result-btn-shimmer" />
              <span className="cwb-result-btn-text">{isVictory ? '계속 탐험' : '여관으로 돌아가기'}</span>
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="cwb-container">
      {/* ===== 1인칭 전투 뷰 (상단) ===== */}
      <div className={`cwb-viewport${playerAttacking ? ' player-attacking' : ''}`}>
        {/* AI 던전 배경 이미지 */}
        <img src="/ui/battle/cwb_viewport_bg.png" alt="" className="cwb-viewport-bg-img" />
        <div className="cwb-viewport-bg-overlay" />
        {/* 좌우 기둥 */}
        <div className="cwb-pillar left" style={{ backgroundImage: `url(${process.env.PUBLIC_URL}/ui/battle/cwb_pillar_left.png)` }} />
        <div className="cwb-pillar right" style={{ backgroundImage: `url(${process.env.PUBLIC_URL}/ui/battle/cwb_pillar_left.png)` }} />
        {/* 횃불 이펙트 */}
        <div className="cwb-torch left" />
        <div className="cwb-torch right" />
        {/* 비네팅 */}
        <div className="cwb-vignette" />
        {/* 피격 플래시 */}
        {hitFlash && <div className="cwb-viewport-hit-flash" />}

        {/* 스킬 컷인 연출 */}
        {skillCutIn && (
          <div className="cwb-skill-cutin">
            <div className="cwb-skill-cutin-bg" />
            <div className="cwb-skill-cutin-content">
              <span className="cwb-skill-cutin-icon">
                {skillCutIn.skillIconUrl
                  ? <img src={skillCutIn.skillIconUrl} alt="" className="cwb-skill-cutin-img" onError={e => { e.target.style.display = 'none'; }} />
                  : <span>{skillCutIn.skillIcon}</span>}
              </span>
              <div className="cwb-skill-cutin-info">
                <div className="cwb-skill-cutin-name">{skillCutIn.skillName}</div>
                <div className="cwb-skill-cutin-caster">{skillCutIn.casterName}</div>
              </div>
            </div>
          </div>
        )}

        {/* 라운드 + 자동전투 */}
        <div className="cwb-top-controls">
          <div className="cwb-round-badge">R{round}</div>
          <div className="cwb-auto-btns">
            <button className={`cwb-auto-btn ${autoAll ? 'active' : ''}`} onClick={() => {
              const next = !autoAll;
              setAutoAll(next);
              if (next) { setAutoCompanion(false); if (phase === 'player_action' && currentUnit) setTimeout(() => executeAutoTurn(currentUnit), 200); }
            }}>
              {autoAll ? '⚡' : '▶'} 모두자동
            </button>
            <button className={`cwb-auto-btn companion ${autoCompanion ? 'active' : ''}`} onClick={() => {
              const next = !autoCompanion;
              setAutoCompanion(next);
              if (next) { setAutoAll(false); if (phase === 'player_action' && currentUnit && currentUnit.id !== 'player') setTimeout(() => executeAutoTurn(currentUnit), 200); }
            }}>
              {autoCompanion ? '⚡' : '▶'} 동료자동
            </button>
          </div>
        </div>

        {/* 턴 순서 바 */}
        <div className="cwb-turn-order">
          {turnOrder.map((id, idx) => {
            const u = units.find(uu => uu.id === id);
            if (!u || u.hp <= 0) return null;
            const isActive = currentUnit?.id === u.id;
            return (
              <div key={u.id} className={`cwb-turn-unit ${u.team} ${isActive ? 'active' : ''} ${u.eliteTier ? 'elite' : ''}`}
                style={u.eliteTier ? { '--elite-color': u.eliteTier.color } : undefined}>
                <img
                  src={u.team === 'enemy' ? `/monsters_nobg/${u.monsterId}_icon.png` : ((u.imageUrl || '').replace('_full.png', '_icon.png'))}
                  alt="" className="cwb-turn-portrait"
                  onError={e => {
                    // _icon 실패 시 _full로 폴백
                    const fallback = (u.imageUrl || '');
                    if (e.target.src.includes('_icon.png') && fallback) { e.target.src = fallback; }
                    else { e.target.style.display = 'none'; if (e.target.nextSibling) e.target.nextSibling.style.display = ''; }
                  }}
                />
                <span className="cwb-turn-icon" style={u.imageUrl || u.monsterId ? { display: 'none' } : {}}>{u.icon}</span>
                <div className="cwb-turn-hp">
                  <div className="cwb-turn-hp-fill" style={{ width: `${(u.hp / u.maxHp) * 100}%`, background: u.team === 'enemy' ? '#ef4444' : '#22d3ee' }} />
                </div>
              </div>
            );
          })}
        </div>

        {/* 적 몬스터 표시 (1인칭 뷰) */}
        <div className="cwb-enemies-row">
          {enemyTeam.map((enemy, i) => {
            const isDead = enemy.hp <= 0;
            const isTarget = validTargets.some(t => t.id === enemy.id);
            const isShaking = shakeTarget === enemy.id;
            const isFlashing = flashTarget === enemy.id;
            const isCurrent = currentUnit?.id === enemy.id;
            const hpPct = Math.max(0, (enemy.hp / enemy.maxHp) * 100);

            return (
              <div
                key={enemy.id}
                className={`cwb-enemy ${isDead ? 'dead' : ''} ${isTarget ? 'targetable' : ''} ${isShaking ? 'shake' : ''} ${isFlashing ? 'flash-die' : ''} ${isCurrent ? 'current' : ''} ${enemy.eliteTier ? 'elite' : ''} ${attackingEnemy === enemy.id ? 'attacking' : ''}`}
                style={enemy.eliteTier ? { '--elite-color': enemy.eliteTier.color } : undefined}
                onClick={() => {
                  if (isDead) return;
                  if (phase === 'select_target') {
                    // 타겟 선택 모드: 살아있는 적 클릭으로 타겟 선택
                    handleSelectTarget(enemy);
                  } else if (phase === 'player_action') {
                    // 일반 모드: 클릭으로 직접 공격
                    handleDirectAttack(enemy);
                  }
                }}
              >
                <div className="cwb-enemy-sprite">
                  {monsterSpeech && monsterSpeech.unitId === enemy.id && !isDead && (
                    <div className="cwb-monster-speech">
                      <span>{monsterSpeech.text}</span>
                    </div>
                  )}
                  <img
                    src={`/monsters_nobg/${enemy.monsterId}_full.png`}
                    alt={enemy.name}
                    className="cwb-enemy-img"
                    onError={e => { e.target.src = `/monsters/${enemy.monsterId}_full.png`; e.target.onerror = () => { e.target.style.display = 'none'; }; }}
                  />
                  {enemy.eliteTier && !isDead && <div className="cwb-elite-aura" style={{ boxShadow: `0 0 20px ${enemy.eliteTier.color}, 0 0 40px ${enemy.eliteTier.color}44` }} />}
                  {enemy.eliteTier && !isDead && <div className="cwb-elite-badge" style={{ background: enemy.eliteTier.color }}>{enemy.eliteTier.icon} {enemy.eliteTier.label}</div>}
                  {isDead && <div className="cwb-enemy-dead-overlay">💀</div>}
                  {/* 돋보기 아이콘 - 몬스터 상세 정보 */}
                  {!isDead && (
                    <button
                      className="cwb-inspect-btn"
                      onClick={(e) => {
                        e.stopPropagation();
                        setInspectMonster(inspectMonster?.id === enemy.id ? null : enemy);
                      }}
                      title="상세 정보"
                    >
                      <img src="/ui/battle/cwb_inspect_icon.png" alt="정보" className="cwb-inspect-btn-img" />
                    </button>
                  )}
                  {/* 공격 이펙트 */}
                  {attackEffect && attackEffect.targetId === enemy.id && (
                    <div className="cwb-attack-effect">
                      {attackEffect.type === 'slash' && <div className="cwb-slash-effect" />}
                      {attackEffect.type === 'magic' && <div className="cwb-magic-effect" />}
                      {attackEffect.type === 'heal' && (
                        <div className="cwb-heal-effect">
                          <div className="cwb-heal-particle" /><div className="cwb-heal-particle" /><div className="cwb-heal-particle" />
                        </div>
                      )}
                    </div>
                  )}
                  {/* 데미지 팝업 */}
                  {damagePopups.filter(p => p.unitId === enemy.id).map(p => (
                    <div key={p.id} className={`cwb-popup ${p.type}`}>{p.text}</div>
                  ))}
                </div>
                {!isDead && (
                  <div className="cwb-enemy-info">
                    <div className="cwb-enemy-name">{enemy.name}</div>
                    <div className="cwb-enemy-hp-bar">
                      <div className="cwb-enemy-hp-fill" style={{ width: `${hpPct}%` }} />
                    </div>
                    {enemy.maxMp > 0 && (
                      <div className="cwb-enemy-mp-bar">
                        <div className="cwb-enemy-mp-fill" style={{ width: `${Math.max(0, (enemy.mp / enemy.maxMp) * 100)}%` }} />
                      </div>
                    )}
                    <BuffIcons unit={enemy} />
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* ===== 중간: 액션 영역 ===== */}
      <div className="cwb-action-area">
        {phase === 'player_action' && currentUnit && !showSkillList && !showItemList && (
          <div className="cwb-actions">
            <div className="cwb-action-label">{currentUnit.icon} {currentUnit.name}의 행동</div>
            <div className="cwb-action-btns">
              <button className="cwb-act-btn attack" onClick={() => handleAction('attack')}>⚔️ 공격</button>
              <button className="cwb-act-btn skill" onClick={() => handleAction('skill')}
                disabled={!currentUnit.skills?.some(s => s.currentCooldown <= 0 && currentUnit.mp >= s.mp_cost)}>
                🔮 스킬
              </button>
              <button className="cwb-act-btn item" onClick={() => handleAction('item')}
                disabled={currentUnit.id !== 'player' || potions.length === 0}>
                🧪 물품
              </button>
              <button className="cwb-act-btn guard" onClick={() => handleAction('guard')}>🛡️ 수호</button>
              <button className="cwb-act-btn wait" onClick={() => handleAction('wait')}>⏳ 대기</button>
              <button className="cwb-act-btn retreat" onClick={() => { setRetreatDisplayPct(Math.floor(Math.random() * 41) + 30); setShowRetreatConfirm(true); }} disabled={retreatDisabled}>
                {retreatDisabled ? '🚫 후퇴불가' : '🏃 후퇴'}
              </button>
            </div>
          </div>
        )}

        {showSkillList && currentUnit && (
          <div className="cwb-skill-list">
            <div className="cwb-action-label">스킬 선택</div>
            <div className="cwb-skill-btns">
              {currentUnit.skills?.filter(s => s.currentCooldown <= 0 && currentUnit.mp >= s.mp_cost).map(skill => (
                <button key={skill.id} className={`cwb-skill-btn ${skill.type}`} onClick={() => handleSelectSkill(skill)}>
                  <span className="cwb-skill-icon">
                    {skill.iconUrl ? <img src={skill.iconUrl} alt="" className="cwb-skill-icon-img" onError={e => { e.target.style.display = 'none'; e.target.parentElement.textContent = skill.icon || '✨'; }} /> : (skill.icon || '✨')}
                  </span>
                  <span className="cwb-skill-name">{skill.name}</span>
                  <span className="cwb-skill-mp">MP {skill.mp_cost}</span>
                </button>
              ))}
              <button className="cwb-cancel-btn" onClick={() => setShowSkillList(false)}>취소</button>
            </div>
          </div>
        )}

        {showItemList && (
          <div className="cwb-skill-list">
            <div className="cwb-action-label">물품 선택</div>
            <div className="cwb-skill-btns">
              {potions.map((p, i) => (
                <button key={p.inv_id || i} className={`cwb-skill-btn ${p.type === 'talisman' ? 'buff' : p.effect_mp ? 'buff' : 'heal'}`} onClick={() => handleUsePotion(p)}>
                  <span className="cwb-skill-icon">
                    <img src={`/equipment/${p.item_id}_icon.png`} alt="" className="cwb-skill-icon-img" onError={e => { e.target.style.display = 'none'; e.target.parentElement.textContent = p.type === 'talisman' ? '📜' : p.effect_mp ? '💧' : '🧪'; }} />
                  </span>
                  <span className="cwb-skill-name">{p.name} x{p.quantity}</span>
                  <span className="cwb-skill-mp">
                    {p.type === 'talisman' ? '📜 부적' : (
                      `${p.effect_hp ? `HP+${p.effect_hp}` : ''}${p.effect_hp && p.effect_mp ? ' ' : ''}${p.effect_mp ? `MP+${p.effect_mp}` : ''}`
                    )}
                  </span>
                </button>
              ))}
              <button className="cwb-cancel-btn" onClick={() => setShowItemList(false)}>취소</button>
            </div>
          </div>
        )}

        {phase === 'select_target' && (
          <div className="cwb-actions">
            <div className="cwb-action-label">{selectedAction === 'guard' ? '🛡️ 수호할 아군을 선택하세요' : '🎯 대상을 선택하세요'}</div>
            <button className="cwb-cancel-btn" onClick={() => { setPhase('player_action'); setSelectedAction(null); setSelectedSkill(null); }}>취소</button>
          </div>
        )}

        {(phase === 'init' || phase === 'animating' || phase === 'start_turn' || phase === 'enemy_turn') && (
          <div className="cwb-actions">
            <div className="cwb-action-label">
              {phase === 'init' ? '전투 준비 중...' : currentUnit?.team === 'enemy' ? `${currentUnit.icon || '👹'} ${currentUnit.name}의 턴...` : '처리 중...'}
            </div>
          </div>
        )}
      </div>

      {/* ===== 하단: 파티 멤버 + 로그 ===== */}
      <div className="cwb-bottom" style={{ backgroundImage: `url(${process.env.PUBLIC_URL}/ui/battle/cwb_party_bar.png)` }}>
        <div className={`cwb-party${units.filter(u => u.team === 'player').length >= 6 ? ' large-party' : ''}`}>
          {units.filter(u => u.team === 'player').map(ally => {
            const isDead = ally.hp <= 0;
            const isCurrent = currentUnit?.id === ally.id;
            const hpPct = Math.max(0, (ally.hp / ally.maxHp) * 100);
            const mpPct = ally.maxMp > 0 ? Math.max(0, (ally.mp / ally.maxMp) * 100) : 0;
            const isAllyTarget = phase === 'select_target' && validTargets.some(t => t.id === ally.id);
            const isAllyShaking = shakeTarget === ally.id;
            const isAllyFlashing = flashTarget === ally.id;
            const isAttacking = playerAttacking && isCurrent;

            return (
              <div
                key={ally.id}
                className={`cwb-ally ${isDead ? 'dead' : ''} ${isCurrent ? 'current' : ''} ${isAllyTarget ? 'targetable' : ''} ${isAllyShaking ? 'shake' : ''} ${isAllyFlashing ? 'flash-hit' : ''} ${ally.isGuarding ? 'guarding' : ''} ${isAttacking ? 'attacking' : ''}`}
                onClick={() => { if (isAllyTarget) handleSelectTarget(ally); else setInspectAlly(ally); }}
              >
                <div className="cwb-ally-portrait">
                  {ally.portraitEffect && <div className={`cb-portrait-effect cb-effect-${ally.portraitEffect}`} style={{ position: 'absolute', inset: 0, borderRadius: '8px', zIndex: 0, pointerEvents: 'none' }} />}
                  <img src={ally.imageUrl} alt={ally.name} className="cwb-ally-img" style={{ position: 'relative', zIndex: 1 }} onError={e => { e.target.style.display = 'none'; }} />
                  {isDead && <div className="cwb-ally-dead">💀</div>}
                  {ally.isGuarding && <div className="cwb-guard-badge">🛡️</div>}
                  {/* 데미지 팝업 */}
                  {damagePopups.filter(p => p.unitId === ally.id).map(p => (
                    <div key={p.id} className={`cwb-popup ${p.type}`}>{p.text}</div>
                  ))}
                </div>
                <div className="cwb-ally-info">
                  <div className="cwb-ally-name">
                    {ally.grade && <span style={{ fontSize: 8, fontWeight: 700, color: '#fff', background: {'일반':'#9ca3af','고급':'#4ade80','희귀':'#60a5fa','영웅':'#c084fc','전설':'#fbbf24','신화':'#ff6b6b','초월':'#ff44cc'}[ally.grade] || '#9ca3af', padding: '0 3px', borderRadius: 2, marginRight: 3 }}>{ally.grade}</span>}
                    {ally.name}
                    <span style={{ fontSize: 9, color: (ally.starLevel || 0) > 0 ? '#fbbf24' : '#555', marginLeft: 3 }}>{(ally.starLevel || 0) === 0 ? '☆' : '★'.repeat(ally.starLevel)}</span>
                  </div>
                  <div className="cwb-ally-lv">Lv.{ally.level}</div>
                  <div className="cwb-bar hp">
                    <div className="cwb-bar-fill" style={{ width: `${hpPct}%` }} />
                    <span className="cwb-bar-text">{ally.hp}/{ally.maxHp}</span>
                  </div>
                  {ally.maxMp > 0 && (
                    <div className="cwb-bar mp">
                      <div className="cwb-bar-fill" style={{ width: `${mpPct}%` }} />
                      <span className="cwb-bar-text">{ally.mp}/{ally.maxMp}</span>
                    </div>
                  )}
                  <BuffIcons unit={ally} />
                </div>
              </div>
            );
          })}
        </div>

        <div className="cwb-log" ref={logRef}>
          {logs.map(l => (
            <div key={l.id} className={`cwb-log-line ${l.type}`}>{l.text}</div>
          ))}
        </div>
      </div>

      {/* ===== 몬스터 정보 패널 (클릭 시) ===== */}
      {inspectMonster && (
        <div className="cwb-inspect" onClick={() => setInspectMonster(null)}>
          <div className="cwb-inspect-panel" onClick={e => e.stopPropagation()}>
            <img src="/ui/battle/cwb_inspect_bg.png" alt="" className="cwb-inspect-bg-img" />
            <div className="cwb-inspect-bg-overlay" />
            <div className="cwb-inspect-inner">
            <button className="cwb-inspect-close" onClick={() => setInspectMonster(null)}>✕</button>
            <div className="cwb-inspect-portrait">
              <img src={`/monsters_nobg/${inspectMonster.monsterId}_full.png`} alt="" className="cwb-inspect-img"
                onError={e => { e.target.src = `/monsters/${inspectMonster.monsterId}_full.png`; e.target.onerror = () => { e.target.style.display = 'none'; }; }} />
            </div>
            <div className="cwb-inspect-name">{inspectMonster.name}</div>
            <div className="cwb-inspect-level">Lv.{inspectMonster.level}</div>

            <div className="cwb-inspect-hp-section">
              <div className="cwb-inspect-bar hp">
                <div className="cwb-inspect-bar-fill" style={{ width: `${Math.max(0, (inspectMonster.hp / inspectMonster.maxHp) * 100)}%` }} />
                <span>HP {inspectMonster.hp}/{inspectMonster.maxHp}</span>
              </div>
              {inspectMonster.maxMp > 0 && (
                <div className="cwb-inspect-bar mp">
                  <div className="cwb-inspect-bar-fill" style={{ width: `${Math.max(0, (inspectMonster.mp / inspectMonster.maxMp) * 100)}%` }} />
                  <span>MP {inspectMonster.mp}/{inspectMonster.maxMp}</span>
                </div>
              )}
            </div>

            <div className="cwb-inspect-stats">
              <div className="cwb-ins-row"><span>물리 공격</span><span>{inspectMonster.physAttack || inspectMonster.attack}</span></div>
              <div className="cwb-ins-row"><span>마법 공격</span><span>{inspectMonster.magAttack || 0}</span></div>
              <div className="cwb-ins-row"><span>물리 방어</span><span>{inspectMonster.physDefense || inspectMonster.defense}</span></div>
              <div className="cwb-ins-row"><span>마법 방어</span><span>{inspectMonster.magDefense || 0}</span></div>
              <div className="cwb-ins-row"><span>치명타</span><span>{inspectMonster.critRate || 5}%</span></div>
              <div className="cwb-ins-row"><span>회피</span><span>{inspectMonster.evasion || 3}%</span></div>
              <div className="cwb-ins-row"><span>속성</span><span>{inspectMonster.element || 'neutral'}</span></div>
              <div className="cwb-ins-row"><span>경험치</span><span>{inspectMonster.exp || 0}</span></div>
              <div className="cwb-ins-row"><span>골드</span><span>{inspectMonster.gold || 0}</span></div>
            </div>

            {inspectMonster.skills?.length > 0 && (
              <div className="cwb-inspect-skills">
                <div className="cwb-ins-section-title">스킬</div>
                {inspectMonster.skills.map((s, i) => (
                  <div key={i} className="cwb-ins-skill">
                    <span className="cwb-ins-skill-icon">{s.icon || '✨'}</span>
                    <span className="cwb-ins-skill-name">{s.name}</span>
                    <span className="cwb-ins-skill-type">{s.type}</span>
                  </div>
                ))}
              </div>
            )}
            </div>
          </div>
        </div>
      )}
      {/* ===== 아군 정보 패널 (클릭 시) ===== */}
      {inspectAlly && (
        <div className="cwb-inspect" onClick={() => setInspectAlly(null)}>
          <div className="cwb-inspect-panel ally-panel" onClick={e => e.stopPropagation()}>
            <img src="/ui/battle/cwb_inspect_bg.png" alt="" className="cwb-inspect-bg-img" />
            <div className="cwb-inspect-bg-overlay ally-overlay" />
            <div className="cwb-inspect-inner">
            <button className="cwb-inspect-close" onClick={() => setInspectAlly(null)}>✕</button>
            <div className="cwb-inspect-portrait">
              <img src={inspectAlly.imageUrl || ''} alt="" className="cwb-inspect-img"
                onError={e => { e.target.style.display = 'none'; }} />
            </div>
            <div className="cwb-inspect-name" style={{ color: '#60a5fa' }}>
              {inspectAlly.grade && <span style={{ fontSize: 9, fontWeight: 700, color: '#fff', background: {'일반':'#9ca3af','고급':'#4ade80','희귀':'#60a5fa','영웅':'#c084fc','전설':'#fbbf24','신화':'#ff6b6b','초월':'#ff44cc'}[inspectAlly.grade] || '#9ca3af', padding: '0 4px', borderRadius: 3, marginRight: 4 }}>{inspectAlly.grade}</span>}
              {inspectAlly.name}
              <span style={{ fontSize: 10, color: (inspectAlly.starLevel || 0) > 0 ? '#fbbf24' : '#555', marginLeft: 4 }}>{(inspectAlly.starLevel || 0) === 0 ? '☆' : '★'.repeat(inspectAlly.starLevel)}</span>
            </div>
            <div className="cwb-inspect-level">Lv.{inspectAlly.level}</div>
            {inspectAlly.classType && <div className="cwb-ally-class-tag">{inspectAlly.classType}</div>}

            <div className="cwb-inspect-hp-section">
              <div className="cwb-inspect-bar hp">
                <div className="cwb-inspect-bar-fill" style={{ width: `${Math.max(0, (inspectAlly.hp / inspectAlly.maxHp) * 100)}%` }} />
                <span>HP {inspectAlly.hp}/{inspectAlly.maxHp}</span>
              </div>
              {inspectAlly.maxMp > 0 && (
                <div className="cwb-inspect-bar mp">
                  <div className="cwb-inspect-bar-fill" style={{ width: `${Math.max(0, (inspectAlly.mp / inspectAlly.maxMp) * 100)}%` }} />
                  <span>MP {inspectAlly.mp}/{inspectAlly.maxMp}</span>
                </div>
              )}
            </div>

            <div className="cwb-inspect-stats">
              <div className="cwb-ins-row"><span>물리 공격</span><span>{inspectAlly.physAttack || inspectAlly.attack}</span></div>
              <div className="cwb-ins-row"><span>마법 공격</span><span>{inspectAlly.magAttack || 0}</span></div>
              <div className="cwb-ins-row"><span>물리 방어</span><span>{inspectAlly.physDefense || inspectAlly.defense}</span></div>
              <div className="cwb-ins-row"><span>마법 방어</span><span>{inspectAlly.magDefense || 0}</span></div>
              <div className="cwb-ins-row"><span>치명타</span><span>{inspectAlly.critRate || 5}%</span></div>
              <div className="cwb-ins-row"><span>회피</span><span>{inspectAlly.evasion || 3}%</span></div>
              <div className="cwb-ins-row"><span>속성</span><span>{inspectAlly.element || 'neutral'}</span></div>
            </div>

            {inspectAlly.skills?.length > 0 && (
              <div className="cwb-inspect-skills">
                <div className="cwb-ins-section-title">스킬</div>
                {inspectAlly.skills.map((s, i) => (
                  <div key={i} className="cwb-ins-skill">
                    <span className="cwb-ins-skill-icon">{s.icon || '✨'}</span>
                    <span className="cwb-ins-skill-name">{s.name}</span>
                    <span className="cwb-ins-skill-type">{s.type}</span>
                  </div>
                ))}
              </div>
            )}

            {inspectAlly.buffs?.length > 0 && (
              <div className="cwb-inspect-skills">
                <div className="cwb-ins-section-title">상태효과</div>
                {inspectAlly.buffs.map((b, i) => (
                  <div key={i} className="cwb-ins-skill">
                    <span className="cwb-ins-skill-icon">{b.icon || '🔮'}</span>
                    <span className="cwb-ins-skill-name">{b.name} ({b.duration}턴)</span>
                  </div>
                ))}
              </div>
            )}
            </div>
          </div>
        </div>
      )}
      {/* 정예 몬스터 알림 */}
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
          </div>
        </div>
      )}

      {/* 후퇴 확인 팝업 */}
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
                    <div className={`retreat-gauge-fill ${pctClass}`} style={{ width: `${retreatPct}%` }} />
                    <img src="/ui/battle/retreat_gauge_frame.png" alt="" className="retreat-gauge-frame" />
                  </div>
                </div>
                <div className="retreat-info-cards">
                  <div className="retreat-info-card fail">
                    <div className="retreat-info-card-icon">🚫</div>
                    <div className="retreat-info-card-label">실패 시</div>
                    <div className="retreat-info-card-value">후퇴 봉인<br/>(재시도 불가)</div>
                  </div>
                  <div className="retreat-info-card penalty">
                    <div className="retreat-info-card-icon">⚠️</div>
                    <div className="retreat-info-card-label">성공 시 패널티</div>
                    <div className="retreat-info-card-value">골드 -10%<br/>경험치 -5%</div>
                  </div>
                </div>
                <div className="retreat-actions">
                  <button className="retreat-btn retreat-btn-try" onClick={handleRetreat}>
                    <span className="retreat-btn-emoji">🏃</span> 후퇴 시도
                  </button>
                  <button className="retreat-btn retreat-btn-stay" onClick={() => setShowRetreatConfirm(false)}>
                    <span className="retreat-btn-emoji">⚔️</span> 전투 계속
                  </button>
                </div>
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
    </div>
  );
}
