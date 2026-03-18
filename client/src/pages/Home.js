import React, { useState, useEffect, useRef } from 'react';
import api from '../api';
import TopNav from './TopNav';
import CharacterHome from './CharacterHome';
import VillageArea from './VillageArea';
import DungeonArea from './DungeonArea';
import StageArea from './StageArea';
import MonsterBestiary from './MonsterBestiary';
import BattleLog from './BattleLog';
import SrpgBattle from '../srpg/SrpgBattle';
import StageBattle from '../srpg/StageBattle';
import DungeonCrawler from '../srpg/DungeonCrawler';
import CrawlerBattle from '../srpg/CrawlerBattle';
import SpecialDungeonArea from './SpecialDungeonArea';
import PrologueArea from './PrologueArea';

const DUNGEON_DISPLAY_NAMES = {
  forest: '어둠의 숲', cave: '수정 동굴', slime_cave: '슬라임 동굴', goblin: '고블린 요새',
  swamp: '독안개 늪', mountain: '서리 산맥', ocean: '심해 유적', spirit_forest: '정령의 숲',
  temple: '망자의 신전', demon: '마왕성', dragon: '용의 둥지',
  kr_forest: '고조선 숲', kr_mountain: '태백산맥', kr_swamp: '습지대', kr_temple: '신라 사원', kr_spirit: '영혼의 숲',
  jp_mountain: '후지산', jp_temple: '교토 신궁', jp_ocean: '용궁', jp_spirit: '요괴 숲',
  cn_mountain: '곤륜산', cn_temple: '소림사', cn_swamp: '동정호', cn_spirit: '선계',
};

const STAGE_GROUP_NAMES = {
  gojoseon: '고조선', samhan: '삼한', goguryeo: '고구려', baekje: '백제', silla: '신라',
  balhae: '발해', goryeo: '고려', joseon: '조선', imjin: '임진왜란', modern: '근대',
};

function Home({ user, character, onLogout, onCharacterDeleted, onGoToCharacterSelect }) {
  const [prologueCleared, setPrologueCleared] = useState(character.prologue_cleared === 1);
  const [currentLocation, setCurrentLocation] = useState(character.prologue_cleared === 1 ? 'home' : 'prologue');

  // character props 변경 시 프롤로그 상태 동기화
  useEffect(() => {
    if (character.prologue_cleared === 1 && !prologueCleared) {
      setPrologueCleared(true);
      setCurrentLocation('home');
    }
  }, [character.prologue_cleared]); // eslint-disable-line
  const [logs, setLogs] = useState([{ text: `${character.name}님이 접속했습니다.`, type: 'system' }]);
  const [charState, setCharState] = useState({
    currentHp: character.current_hp ?? character.hp,
    currentMp: character.current_mp ?? character.mp,
    exp: character.exp || 0,
    gold: character.gold || 0,
    level: character.level,
    maxHp: character.hp,
    maxMp: character.mp,
    attack: character.attack,
    defense: character.defense,
    physAttack: character.phys_attack || 0,
    physDefense: character.phys_defense || 0,
    magAttack: character.mag_attack || 0,
    magDefense: character.mag_defense || 0,
    critRate: character.crit_rate || 0,
    evasion: character.evasion || 0,
    stamina: character.stamina ?? 10,
    maxStamina: character.max_stamina ?? 10,
    lastStaminaTime: character.last_stamina_time || null,
  });
  const [fighting, setFighting] = useState(false);
  const [learnedSkills, setLearnedSkills] = useState([]);
  const [mySummons, setMySummons] = useState([]);
  const [activeSummonIds, setActiveSummonIds] = useState([]);
  const [myMercenaries, setMyMercenaries] = useState([]);
  const [passiveBonuses, setPassiveBonuses] = useState({});
  const [srpgBattle, setSrpgBattle] = useState(false);
  const [battleLocation, setBattleLocation] = useState(null);
  const [battleStage, setBattleStage] = useState(null);
  const [returnDungeonKey, setReturnDungeonKey] = useState(null);
  const [returnStageGroupKey, setReturnStageGroupKey] = useState(null);
  const [battleStageGroup, setBattleStageGroup] = useState(null);
  const [battleStageMonsters, setBattleStageMonsters] = useState(null);
  const [battleStageCleared, setBattleStageCleared] = useState(false);
  const [battleBlockMsg, setBattleBlockMsg] = useState(null);
  const [battleLoading, setBattleLoading] = useState(null); // { type: 'dungeon'|'stage'|'tower'|'boss_raid'|'elemental', name: string }
  const [showPatchNotes, setShowPatchNotes] = useState(() => {
    const key = 'patchNotes_v11';
    if (localStorage.getItem(key)) return false;
    return true;
  });
  const [dungeonClearPopup, setDungeonClearPopup] = useState(null); // { dungeonKey, stageName, stepCount, monstersDefeated, treasuresFound, goldEarned }
  const [specialBattleCtx, setSpecialBattleCtx] = useState(null);
  const [returnSpecialType, setReturnSpecialType] = useState(null);
  // 던전 크롤러 상태
  const [dungeonCrawler, setDungeonCrawler] = useState(null); // { dungeonKey, stage, dbMonsters }
  const [crawlerEncounter, setCrawlerEncounter] = useState(null); // 크롤러에서 조우한 전투 데이터
  const [crawlerSavedState, setCrawlerSavedState] = useState(null); // DB에서 로드한 크롤러 상태
  const [villageTarget, setVillageTarget] = useState(null);
  const [villageTargetData, setVillageTargetData] = useState(null);
  const [homeInitialTab, setHomeInitialTab] = useState(null);
  const [battleResumePrompt, setBattleResumePrompt] = useState(null); // 전투 복귀 프롬프트
  const savedEnemySetupRef = React.useRef(null); // 정예 리롤 방지용 적 구성
  const savedRetreatFailedRef = React.useRef(false); // 후퇴 실패 기록
  const [contentCharges, setContentCharges] = useState({}); // { stage_gojoseon: {charges,maxCharges,cooldown}, dungeon_cave: {...}, ... }
  const chargesRequestId = useRef(0);

  const loadContentCharges = async () => {
    const reqId = ++chargesRequestId.current;
    try {
      const res = await api.get('/stage/charges');
      if (reqId === chargesRequestId.current) {
        setContentCharges(res.data);
      }
    } catch {}
  };

  const loadMySummons = async () => {
    try {
      const res = await api.get('/summon/my');
      setMySummons(res.data.summons);
      setActiveSummonIds(prev => {
        if (prev.length === 0 && res.data.summons.length > 0) {
          return res.data.summons.map(s => s.id);
        }
        return prev.filter(id => res.data.summons.some(s => s.id === id));
      });
    } catch {}
  };

  const loadMyMercenaries = async () => {
    try {
      const res = await api.get('/mercenary/my');
      setMyMercenaries(res.data.mercenaries);
    } catch {}
  };

  useEffect(() => {
    loadMySummons();
    loadMyMercenaries();
    loadContentCharges();
    // 전투 세션 복구 체크
    const checkBattleSession = async () => {
      try {
        const res = await api.get('/battle/session/check');
        if (res.data.session) {
          setBattleResumePrompt(res.data.session);
        }
      } catch {}
    };
    if (character.prologue_cleared === 1) checkBattleSession();
  }, []); // eslint-disable-line

  // 입장 횟수 쿨타임 자동 갱신 (60초마다)
  useEffect(() => {
    const hasCooldown = Object.values(contentCharges).some(c => c.charges === 0);
    if (!hasCooldown || fighting || srpgBattle) return;
    const interval = setInterval(loadContentCharges, 60000);
    return () => clearInterval(interval);
  }, [contentCharges, fighting, srpgBattle]); // eslint-disable-line

  // 캐릭터 상태 전체 갱신
  const refreshCharState = async () => {
    try {
      const res = await api.get('/characters/me');
      const c = res.data.character;
      if (!c) return;
      setCharState({
        currentHp: c.current_hp ?? c.hp,
        currentMp: c.current_mp ?? c.mp,
        exp: c.exp || 0,
        gold: c.gold || 0,
        level: c.level,
        maxHp: c.hp,
        maxMp: c.mp,
        attack: c.attack,
        defense: c.defense,
        physAttack: c.phys_attack || 0,
        physDefense: c.phys_defense || 0,
        magAttack: c.mag_attack || 0,
        magDefense: c.mag_defense || 0,
        critRate: c.crit_rate || 0,
        evasion: c.evasion || 0,
        stamina: c.stamina ?? 10,
        maxStamina: c.max_stamina ?? 10,
        lastStaminaTime: c.last_stamina_time || null,
        speedBoostBattles: c.speed_boost_battles || 0,
      });
    } catch {}
  };

  // 서버 동기화 (60초마다 전체 갱신)
  useEffect(() => {
    refreshCharState();
    const timer = setInterval(refreshCharState, 60000);
    return () => clearInterval(timer);
  }, []);

  // 홈 화면(캐릭터 탭) 진입 시 상태 갱신
  useEffect(() => {
    if (currentLocation === 'home' && !fighting && !srpgBattle) {
      refreshCharState();
    }
  }, [currentLocation, fighting, srpgBattle]);

  // 스킬 로드: 레벨 변경 시에만 (값 비교)
  const prevLevelRef = React.useRef(charState.level);
  useEffect(() => {
    const shouldLoad = prevLevelRef.current !== charState.level || !learnedSkills.length;
    prevLevelRef.current = charState.level;
    if (!shouldLoad && learnedSkills.length > 0) return;
    api.get('/skill/active-skills').then(res => {
      setLearnedSkills(res.data.skills || []);
      setPassiveBonuses(res.data.passiveBonuses || {});
    }).catch(() => {
      api.get('/skill/list').then(res => {
        setLearnedSkills(res.data.skills.filter(s => s.learned));
      }).catch(() => {});
    });
  }, [charState.level]); // eslint-disable-line

  const handleSkillsUpdate = React.useCallback((skills) => {
    setLearnedSkills(skills);
    api.get('/skill/active-skills').then(res => {
      setPassiveBonuses(res.data.passiveBonuses || {});
    }).catch(() => {});
  }, []);

  const addLog = (text, type = 'normal') => {
    setLogs((prev) => [...prev.slice(-50), { text, type, time: new Date().toLocaleTimeString() }]);
  };

  const handleLocationChange = (locId) => {
    if (fighting) return;
    setCurrentLocation(locId);
  };

  const navigateToVillage = (facilityId, data) => {
    if (fighting) return;
    setVillageTarget(facilityId);
    setVillageTargetData(data || null);
    setCurrentLocation('village');
  };

  const handleCharStateUpdate = (updates) => {
    setCharState((prev) => ({ ...prev, ...updates }));
  };

  const toggleSummon = (id) => {
    setActiveSummonIds(prev =>
      prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
    );
  };

  const checkFormationEmpty = async () => {
    try {
      const res = await api.get('/formation/list');
      const main = res.data.formations?.find(f => f.slotIndex === 0);
      if (!main || !main.gridData) return true;
      const hasUnit = main.gridData.some(row => row.some(cell => cell && cell.unitId));
      return !hasUnit;
    } catch {
      return false; // 에러 시 통과
    }
  };

  // 진영 내 피로도 0인 용병 체크 (서버에서 최신 데이터 조회)
  const checkFatiguedMercenaries = async () => {
    try {
      const [fRes, mRes] = await Promise.all([
        api.get('/formation/list'),
        api.get('/mercenary/my'),
      ]);
      const freshMercs = mRes.data.mercenaries || [];
      setMyMercenaries(freshMercs);
      const main = fRes.data.formations?.find(f => f.slotIndex === 0);
      if (!main || !main.gridData) return null;
      const mercIdsInFormation = [];
      main.gridData.forEach(row => row.forEach(cell => {
        if (cell && cell.unitId && cell.unitId.startsWith('merc_')) {
          mercIdsInFormation.push(parseInt(cell.unitId.replace('merc_', '')));
        }
      }));
      if (mercIdsInFormation.length === 0) return null;
      const fatigued = freshMercs.filter(m => mercIdsInFormation.includes(m.id) && (m.fatigue === 0 || m.fatigue === undefined));
      if (fatigued.length > 0) return fatigued;
      return null;
    } catch {
      return null;
    }
  };

  // 전투 세션 DB 저장
  const saveBattleSession = async (battleType, context) => {
    try { await api.post('/battle/session/save', { battleType, context }); } catch {}
  };
  const clearBattleSession = async () => {
    try { await api.post('/battle/session/clear'); } catch {}
  };

  // 전투 복귀 수락
  const handleResumeAccept = () => {
    const s = battleResumePrompt;
    if (!s) return;
    setBattleResumePrompt(null);
    const ctx = s.context;
    if (s.battleType === 'stage') {
      savedEnemySetupRef.current = ctx.enemySetup || null;
      savedRetreatFailedRef.current = ctx.retreatFailed || false;
      setBattleLocation(ctx.dungeonKey);
      setBattleStage(ctx.stage);
      setBattleStageGroup(ctx.groupKey);
      setBattleStageMonsters(ctx.monsters);
      setSpecialBattleCtx(ctx.specialCtx || null);
      setReturnSpecialType(ctx.specialCtx?.type || null);
      setReturnStageGroupKey(ctx.specialCtx ? null : ctx.groupKey);
      setReturnDungeonKey(ctx.specialCtx ? null : null);
      setSrpgBattle(true);
      setFighting(true);
    } else if (s.battleType === 'crawler') {
      // 던전 크롤러 복귀 - DB에서 저장된 상태 로드
      const dk = ctx.dungeonKey;
      Promise.all([
        api.get(`/dungeon/${dk}`),
        api.get('/battle/crawler/load'),
      ]).then(([dRes, cRes]) => {
        const saved = cRes.data.crawlerState || null;
        setCrawlerSavedState(saved);
        setDungeonCrawler({ dungeonKey: dk, stage: ctx.stage || saved?.stage, dbMonsters: dRes.data.monsters || [] });
        setCrawlerEncounter(ctx.encounter || null);
        setReturnDungeonKey(dk);
        setFighting(true);
        addLog(`${DUNGEON_DISPLAY_NAMES[dk] || dk} 던전 크롤러 복귀!`, 'system');
      }).catch(() => {
        clearBattleSession();
        addLog('던전 복귀에 실패했습니다.', 'damage');
      });
    } else if (s.battleType === 'srpg' || s.battleType === 'tower') {
      savedEnemySetupRef.current = ctx.enemySetup || null;
      savedRetreatFailedRef.current = ctx.retreatFailed || false;
      setBattleLocation(ctx.dungeonKey);
      setBattleStage(ctx.stage);
      setBattleStageGroup(null);
      setBattleStageMonsters(null);
      setSpecialBattleCtx(ctx.specialCtx || null);
      setReturnSpecialType(ctx.specialCtx?.type || null);
      setReturnDungeonKey(ctx.specialCtx ? null : ctx.dungeonKey);
      setSrpgBattle(true);
      setFighting(true);
    }
  };

  // 전투 복귀 포기 (패널티 적용)
  const handleResumeDecline = async () => {
    setBattleResumePrompt(null);
    try {
      const res = await api.post('/battle/session/penalty', { penaltyType: 'abandon' });
      if (res.data.penalty) {
        const p = res.data.penalty;
        addLog(`전투 포기 패널티: HP -${p.hpLoss}, 골드 -${p.goldLoss}, 경험치 -${p.expLoss}`, 'damage');
        // 즉시 반영
        handleCharStateUpdate({
          currentHp: p.newHp,
          gold: p.newGold,
          exp: p.newExp,
        });
      }
    } catch {
      await clearBattleSession();
    }
    addLog('이전 전투를 포기했습니다.', 'system');
  };

  const handleStartBattle = async (dungeonKey, stage, specialCtx) => {
    if (fighting || srpgBattle) return;
    if (await checkFormationEmpty()) {
      setBattleBlockMsg('__FORMATION__');
      return;
    }
    const fatigued = await checkFatiguedMercenaries();
    if (fatigued) {
      setBattleBlockMsg('__FATIGUE__:' + fatigued.map(m => m.name).join(','));
      return;
    }
    if (charState.currentHp <= 0) {
      setBattleBlockMsg('HP가 0입니다!\n마을 여관에서 휴식 후 다시 도전하세요.');
      return;
    }
    // 로딩 팝업 표시
    const loadingType = specialCtx?.type || (stage?.groupKey ? 'stage' : 'dungeon');
    const loadingName = specialCtx?.type === 'tower' ? `무한의 탑 ${specialCtx.floor || ''}층`
      : specialCtx?.type === 'boss_raid' ? '보스 토벌전'
      : specialCtx?.type === 'elemental' ? '정령의 시련'
      : DUNGEON_DISPLAY_NAMES[dungeonKey] || dungeonKey;
    setBattleLoading({ type: loadingType, name: loadingName });
    const isTower = specialCtx?.type === 'tower';
    const isDungeon = !specialCtx && !stage?.groupKey; // 던전 전투인 경우
    const isBossRaid = specialCtx?.type === 'boss_raid';
    const isSpecialDungeon = !!specialCtx && !isTower;
    // 콘텐츠별 행동력 소모: 일반던전=2, 스페셜던전=3, 보스토벌=4, 기본=1
    const staminaCost = isBossRaid ? 3 : isSpecialDungeon ? 3 : isDungeon ? 2 : (stage?.isBoss ? 2 : 1);
    if (!isTower) {
      if (charState.stamina < staminaCost) {
        setBattleLoading(null);
        setBattleBlockMsg(`행동력이 부족합니다! (필요: ${staminaCost})\n시간이 지나면 자동으로 회복됩니다.`);
        return;
      }
      // 던전 전투: 입장 횟수 먼저 체크 (소모 전 검증)
      if (isDungeon && dungeonKey) {
        try {
          await api.post('/dungeon/check-ticket', { dungeonKey });
        } catch (err) {
          setBattleLoading(null);
          setBattleBlockMsg(err.response?.data?.message || '던전 티켓이 부족합니다!');
          return;
        }
        try {
          await api.post('/stage/check-charge', { contentType: `dungeon_${dungeonKey}_${stage?.stageNumber || 1}` });
        } catch (err) {
          setBattleLoading(null);
          setBattleBlockMsg(err.response?.data?.message || '던전 입장 횟수를 모두 소진했습니다!');
          return;
        }
      }
      // 검증 통과 후 실제 소모
      try {
        const stRes = await api.post('/stage/spend-stamina', { cost: staminaCost });
        handleCharStateUpdate({ stamina: stRes.data.stamina, maxStamina: stRes.data.maxStamina, lastStaminaTime: stRes.data.last_stamina_time || new Date().toISOString() });
      } catch (err) {
        setBattleLoading(null);
        setBattleBlockMsg(err.response?.data?.message || '행동력 차감에 실패했습니다.');
        return;
      }
      if (isDungeon && dungeonKey) {
        try {
          await api.post('/dungeon/use-ticket', { dungeonKey });
        } catch (err) { /* 검증 통과했으므로 실패 가능성 낮음 */ }
        try {
          const contentType = `dungeon_${dungeonKey}_${stage?.stageNumber || 1}`;
          const chargeRes = await api.post('/stage/use-charge', { contentType });
          // 즉시 상태 반영 (race condition 방지)
          setContentCharges(prev => ({
            ...prev,
            [contentType]: {
              charges: chargeRes.data.charges,
              maxCharges: chargeRes.data.maxCharges,
              cooldown: chargeRes.data.cooldown,
            }
          }));
        } catch (err) { /* 검증 통과했으므로 실패 가능성 낮음 */ }
      }
    }
    savedEnemySetupRef.current = null; // 새 전투는 적 구성 초기화
    savedRetreatFailedRef.current = false;

    // 던전 전투 → 던전 크롤러 모드로 진입
    if (isDungeon && dungeonKey) {
      try {
        const dRes = await api.get(`/dungeon/${dungeonKey}`);
        setCrawlerSavedState(null);
        setDungeonCrawler({ dungeonKey, stage, dbMonsters: dRes.data.monsters || [], autoPath: !!stage?.autoPath });
        setCrawlerEncounter(null);
        setReturnDungeonKey(dungeonKey);
        setFighting(true);
        setBattleLoading(null);
        saveBattleSession('crawler', { dungeonKey, stage });
        addLog(`${DUNGEON_DISPLAY_NAMES[dungeonKey] || dungeonKey} 던전 크롤러 모드 진입!`, 'system');
        return;
      } catch (err) {
        console.error('Dungeon crawler init failed:', err);
        // 실패 시 기존 전투로 fallback
      }
    }

    setBattleLocation(dungeonKey);
    setBattleStage(stage);
    if (specialCtx) {
      setSpecialBattleCtx(specialCtx);
      setReturnSpecialType(specialCtx.type);
      setReturnDungeonKey(null);
    } else {
      setSpecialBattleCtx(null);
      setReturnSpecialType(null);
      setReturnDungeonKey(dungeonKey);
    }
    setBattleStageGroup(null);
    setBattleStageMonsters(null);
    setSrpgBattle(true);
    setFighting(true);
    setBattleLoading(null);
    const bType = specialCtx?.type === 'tower' ? 'tower' : 'srpg';
    saveBattleSession(bType, { dungeonKey, stage, specialCtx: specialCtx || null });
  };

  const handleStartStageBattle = async (groupKey, stage, monsters, specialCtx, isCleared) => {
    if (fighting || srpgBattle) return;
    if (await checkFormationEmpty()) {
      setBattleBlockMsg('__FORMATION__');
      return;
    }
    const fatiguedMercs = await checkFatiguedMercenaries();
    if (fatiguedMercs) {
      setBattleBlockMsg('__FATIGUE__:' + fatiguedMercs.map(m => m.name).join(','));
      return;
    }
    if (charState.currentHp <= 0) {
      setBattleBlockMsg('HP가 0입니다!\n마을 여관에서 휴식 후 다시 도전하세요.');
      return;
    }
    // 로딩 팝업 표시
    const stageLoadingName = specialCtx?.type === 'elemental' ? '정령의 시련'
      : STAGE_GROUP_NAMES[groupKey] || groupKey;
    setBattleLoading({ type: specialCtx?.type || 'stage', name: stageLoadingName });
    // 스테이지 전투: 보스=2, 일반=1, 스페셜=3
    const isSpecial = !!specialCtx;
    const staminaCost = isSpecial ? 3 : (stage?.isBoss ? 2 : 1);
    if (charState.stamina < staminaCost) {
      setBattleLoading(null);
      setBattleBlockMsg(`행동력이 부족합니다! (필요: ${staminaCost})\n시간이 지나면 자동으로 회복됩니다.`);
      return;
    }
    // 스테이지 입장 횟수 검증 (소모 전 체크)
    if (!isSpecial) {
      try {
        await api.post('/stage/check-charge', { contentType: `stage_${groupKey}_${stage.stageNumber}` });
      } catch (err) {
        setBattleLoading(null);
        setBattleBlockMsg(err.response?.data?.message || '스테이지 입장 횟수를 모두 소진했습니다!');
        return;
      }
    }
    // 검증 통과 후 행동력 차감
    try {
      const stRes = await api.post('/stage/spend-stamina', { cost: staminaCost });
      handleCharStateUpdate({ stamina: stRes.data.stamina, maxStamina: stRes.data.maxStamina, lastStaminaTime: stRes.data.last_stamina_time || new Date().toISOString() });
    } catch (err) {
      setBattleLoading(null);
      setBattleBlockMsg(err.response?.data?.message || '행동력 차감에 실패했습니다.');
      return;
    }
    // 행동력 차감 성공 후 실제 입장 횟수 소모
    if (!isSpecial) {
      try {
        const contentType = `stage_${groupKey}_${stage.stageNumber}`;
        const chargeRes = await api.post('/stage/use-charge', { contentType });
        // 즉시 상태 반영 (race condition 방지)
        setContentCharges(prev => ({
          ...prev,
          [contentType]: {
            charges: chargeRes.data.charges,
            maxCharges: chargeRes.data.maxCharges,
            cooldown: chargeRes.data.cooldown,
          }
        }));
      } catch (err) { /* 검증 통과했으므로 실패 가능성 낮음 */ }
    }
    savedEnemySetupRef.current = null; // 새 전투는 적 구성 초기화
    savedRetreatFailedRef.current = false;
    const dungeonKey = stage.dungeonKey || 'forest';
    setBattleLocation(dungeonKey);
    setBattleStage(stage);
    setBattleStageGroup(groupKey);
    setBattleStageMonsters(monsters);
    setBattleStageCleared(!!isCleared);
    if (specialCtx) {
      setSpecialBattleCtx(specialCtx);
      setReturnSpecialType(specialCtx.type);
      setReturnStageGroupKey(null);
      setReturnDungeonKey(null);
    } else {
      setSpecialBattleCtx(null);
      setReturnSpecialType(null);
      setReturnStageGroupKey(groupKey);
      setReturnDungeonKey(null);
    }
    setSrpgBattle(true);
    setFighting(true);
    setBattleLoading(null);
    saveBattleSession('stage', { dungeonKey: stage.dungeonKey || 'forest', stage, monsters, groupKey, specialCtx: specialCtx || null });
  };

  const handleSrpgBattleEnd = async (result, expGained, goldGained) => {
    // 전투 세션 삭제
    clearBattleSession();
    savedEnemySetupRef.current = null;
    savedRetreatFailedRef.current = false;

    const stage = battleStage;
    const dungeonKey = battleLocation;
    const spCtx = specialBattleCtx;

    // 전투 유형별 로그 라벨 결정
    const getBattleLabel = () => {
      if (spCtx) {
        if (spCtx.type === 'tower') return '무한의 탑 전투';
        if (spCtx.type === 'elemental') return '정령의 시련 전투';
        if (spCtx.type === 'boss_raid') return '보스 토벌전';
      }
      if (battleStageGroup) {
        const regionName = STAGE_GROUP_NAMES[battleStageGroup] || battleStageGroup;
        return `스테이지 전투 [${regionName}]`;
      }
      const areaName = DUNGEON_DISPLAY_NAMES[dungeonKey] || dungeonKey;
      return `던전 전투 [${areaName}]`;
    };
    const battleLabel = getBattleLabel();

    // 승리시 클리어 기록
    if (result === 'victory') {
      addLog(`${battleLabel} 승리! EXP +${expGained}, Gold +${goldGained}`, 'heal');

      // 스페셜 던전 클리어 처리
      if (spCtx) {
        try {
          if (spCtx.type === 'tower') {
            await api.post('/special-dungeon/tower/clear', { floor: spCtx.floor, victory: true });
          } else if (spCtx.type === 'elemental') {
            const clearRes = await api.post('/special-dungeon/elemental/clear', { tier: spCtx.tier, victory: true });
            if (clearRes.data.rewardMaterial) {
              addLog(`재료 획득: ${clearRes.data.rewardMaterial.icon} ${clearRes.data.rewardMaterial.name} x${clearRes.data.rewardMaterial.quantity}`, 'heal');
            }
          } else if (spCtx.type === 'boss_raid') {
            await api.post('/special-dungeon/boss-raid/clear', { bossId: spCtx.bossId, victory: true });
          }
        } catch {}
      } else if (stage && battleStageGroup) {
        // 히스토리 스테이지 클리어
        try {
          await api.post('/stage/clear', {
            groupKey: battleStageGroup,
            stageNumber: stage.stageNumber,
          });
        } catch {}
      } else if (stage && dungeonKey) {
        try {
          await api.post('/dungeon/clear-stage', {
            dungeonKey,
            stageNumber: stage.stageNumber,
          });
        } catch {}
      }
    } else if (spCtx && spCtx.type === 'boss_raid' && result !== 'retreat') {
      // 보스 토벌전 실패도 기록
      try {
        await api.post('/special-dungeon/boss-raid/clear', { bossId: spCtx.bossId, victory: false });
      } catch {}
    }

    // 전투 UI 해제
    setSrpgBattle(false);
    setFighting(false);
    setBattleLocation(null);
    setBattleStage(null);
    setBattleStageGroup(null);
    setBattleStageMonsters(null);
    setSpecialBattleCtx(null);

    await refreshCharState();
    await loadMySummons();
    await loadMyMercenaries();
    await loadContentCharges();

    if (result === 'retreat') {
      addLog('전투에서 후퇴했습니다.', 'system');
      if (returnSpecialType) {
        setCurrentLocation('special');
        setReturnSpecialType(null);
        setReturnDungeonKey(null);
        setReturnStageGroupKey(null);
      } else if (returnStageGroupKey) {
        setCurrentLocation('stage');
      } else if (returnDungeonKey) {
        setCurrentLocation('dungeon');
      } else {
        setCurrentLocation('village');
        setReturnDungeonKey(null);
        setReturnStageGroupKey(null);
      }
    } else if (result !== 'victory') {
      addLog(`${battleLabel} 패배... 마을에서 휴식하세요.`, 'damage');
      setReturnDungeonKey(null);
      setReturnStageGroupKey(null);
      setReturnSpecialType(null);
      setVillageTarget('inn');
      setCurrentLocation('village');
    } else {
      // 승리 시 스페셜 던전이었으면 스페셜로 복귀
      if (returnSpecialType) {
        setCurrentLocation('special');
        setReturnSpecialType(null);
      }
    }
  };

  // 던전 크롤러 모드 - 크롤러 내 전투 (CrawlerBattle - Wizardry 스타일)
  if (dungeonCrawler && crawlerEncounter) {
    const activeSummonData = mySummons.filter(s => activeSummonIds.includes(s.id));
    const crawlerStage = {
      ...(dungeonCrawler.stage || {}),
      name: crawlerEncounter.isBoss ? '보스 전투' : '던전 조우 전투',
      monsterCount: crawlerEncounter.monsters?.length || 3,
    };
    return (
      <div className="game-layout-top">
        <CrawlerBattle
          stage={crawlerStage}
          character={character}
          charState={charState}
          learnedSkills={learnedSkills}
          passiveBonuses={passiveBonuses}
          activeSummons={activeSummonData}
          activeMercenaries={myMercenaries}
          monsters={crawlerEncounter.monsters}
          groupKey={dungeonCrawler.dungeonKey}
          isBossEncounter={crawlerEncounter.isBoss}
          autoPath={dungeonCrawler?.autoPath}
          onBattleEnd={(result, expGained, goldGained) => {
            if (result === 'victory') {
              // 크롤러 상태에서 처치한 몬스터 업데이트 (동기적으로 먼저 반영)
              const mobId = crawlerEncounter.mobId;
              setCrawlerSavedState(prev => {
                if (!prev || !prev.monsters) return prev;
                const updated = { ...prev, monsters: prev.monsters.map(m =>
                  m.id === mobId ? { ...m, defeated: true } : m
                )};
                api.post('/battle/crawler/save', { crawlerState: updated }).catch(() => {});
                return updated;
              });
              refreshCharState();
              addLog(`전투 승리! EXP +${expGained}, Gold +${goldGained}`, 'heal');
            } else if (result === 'defeat') {
              setDungeonCrawler(null);
              setCrawlerEncounter(null);
              setCrawlerSavedState(null);
              setFighting(false);
              api.delete('/battle/crawler/clear').catch(() => {});
              refreshCharState();
              setVillageTarget('inn');
              setCurrentLocation('village');
              clearBattleSession();
              addLog('던전에서 쓰러졌습니다... 마을로 이송됩니다.', 'damage');
              return;
            } else if (result === 'retreat') {
              // 후퇴: 던전 크롤러로 복귀 (전투만 종료)
              refreshCharState();
              addLog('전투에서 후퇴했습니다.', 'system');
            }
            // 전투 세션에서 encounter 제거 (새로고침 시 전투 재진입 방지)
            saveBattleSession('crawler', {
              dungeonKey: dungeonCrawler.dungeonKey,
              stage: dungeonCrawler.stage,
            });
            setCrawlerEncounter(null);
          }}
          onLog={addLog}
        />
      </div>
    );
  }

  // 던전 크롤러 모드 - 탐험 중
  if (dungeonCrawler && !crawlerEncounter) {
    return (
      <div className="game-layout-top">
        <DungeonCrawler
          dungeonKey={dungeonCrawler.dungeonKey}
          stage={dungeonCrawler.stage}
          dbMonsters={dungeonCrawler.dbMonsters}
          character={character}
          charState={charState}
          activeSummons={mySummons.filter(s => activeSummonIds.includes(s.id))}
          activeMercenaries={myMercenaries}
          autoPath={dungeonCrawler?.autoPath}
          savedState={crawlerSavedState}
          onSaveState={(state) => {
            setCrawlerSavedState(state);
            api.post('/battle/crawler/save', { crawlerState: state }).catch(() => {});
          }}
          onEncounter={(encounterData) => {
            setCrawlerEncounter(encounterData);
            saveBattleSession('crawler', {
              dungeonKey: dungeonCrawler.dungeonKey,
              stage: dungeonCrawler.stage,
              encounter: encounterData,
            });
          }}
          onTreasure={(treasureData) => {
            // 보물 골드 반영
            if (treasureData.gold) {
              api.post('/dungeon/clear-stage', {
                dungeonKey: dungeonCrawler.dungeonKey,
                stageNumber: dungeonCrawler.stage?.stageNumber || 1,
                expGained: 0,
                goldGained: treasureData.gold,
              }).catch(() => {});
              refreshCharState();
            }
          }}
          onClear={async (stats) => {
            // 던전 클리어 - 크롤러 상태도 삭제
            const dKey = dungeonCrawler.dungeonKey;
            const stageNum = dungeonCrawler.stage?.stageNumber || 1;
            api.delete('/battle/crawler/clear').catch(() => {});
            try {
              await api.post('/dungeon/clear-stage', {
                dungeonKey: dKey,
                stageNumber: stageNum,
                expGained: 0,
                goldGained: 0,
              });
            } catch {}
            addLog('던전을 클리어했습니다!', 'heal');
            refreshCharState();
            setDungeonCrawler(null);
            setCrawlerEncounter(null);
            setCrawlerSavedState(null);
            setFighting(false);
            clearBattleSession();
            // 클리어 축하 팝업 표시
            setDungeonClearPopup({
              dungeonKey: dKey,
              dungeonName: DUNGEON_DISPLAY_NAMES[dKey] || dKey,
              stageNumber: stageNum,
              stepCount: stats?.stepCount || 0,
              monstersDefeated: stats?.monstersDefeated || 0,
              totalMonsters: stats?.totalMonsters || 0,
              treasuresFound: stats?.treasuresFound || 0,
              totalTreasures: stats?.totalTreasures || 0,
            });
          }}
          onRetreat={() => {
            setDungeonCrawler(null);
            setCrawlerEncounter(null);
            setCrawlerSavedState(null);
            setFighting(false);
            setCurrentLocation('dungeon');
            clearBattleSession();
            api.delete('/battle/crawler/clear').catch(() => {});
            addLog('던전에서 귀환했습니다.', 'system');
          }}
        />
      </div>
    );
  }

  // 스테이지 카드 전투 모드
  if (srpgBattle && battleStageGroup && battleStage) {
    const activeSummonData = mySummons.filter(s => activeSummonIds.includes(s.id));
    return (
      <div className="game-layout-top">
        <StageBattle
          stage={battleStage}
          character={character}
          charState={charState}
          learnedSkills={learnedSkills}
          passiveBonuses={passiveBonuses}
          activeSummons={activeSummonData}
          activeMercenaries={myMercenaries}
          monsters={battleStageMonsters}
          groupKey={battleStageGroup}
          onBattleEnd={handleSrpgBattleEnd}
          onLog={addLog}
          savedEnemySetup={savedEnemySetupRef.current}
          savedRetreatFailed={savedRetreatFailedRef.current}
          isStageCleared={battleStageCleared}
        />
      </div>
    );
  }

  // 무한의 탑 전투 (던전과 동일한 SRPG 전투 + 2D 픽셀아트 맵)
  if (srpgBattle && battleLocation && specialBattleCtx?.type === 'tower') {
    const activeSummonData = mySummons.filter(s => activeSummonIds.includes(s.id));
    return (
      <div className="game-layout-top">
        <SrpgBattle
          location={battleLocation}
          stage={battleStage}
          character={character}
          charState={charState}
          learnedSkills={learnedSkills}
          passiveBonuses={passiveBonuses}
          activeSummons={activeSummonData}
          activeMercenaries={myMercenaries}
          onBattleEnd={handleSrpgBattleEnd}
          onLog={addLog}
          use2DMap={true}
          savedRetreatFailed={savedRetreatFailedRef.current}
          savedEnemySetup={savedEnemySetupRef.current}
        />
      </div>
    );
  }

  // SRPG 전투 모드 (던전 - 2D 픽셀아트 맵)
  if (srpgBattle && battleLocation) {
    const activeSummonData = mySummons.filter(s => activeSummonIds.includes(s.id));
    return (
      <div className="game-layout-top">
        <SrpgBattle
          location={battleLocation}
          stage={battleStage}
          character={character}
          charState={charState}
          learnedSkills={learnedSkills}
          passiveBonuses={passiveBonuses}
          activeSummons={activeSummonData}
          activeMercenaries={myMercenaries}
          onBattleEnd={handleSrpgBattleEnd}
          onLog={addLog}
          use2DMap={true}
          savedRetreatFailed={savedRetreatFailedRef.current}
          savedEnemySetup={savedEnemySetupRef.current}
        />
      </div>
    );
  }

  const handlePrologueClear = () => {
    setPrologueCleared(true);
    setCurrentLocation('home');
    refreshCharState();
  };

  const renderAreaContent = () => {
    switch (currentLocation) {
      case 'prologue':
        return (
          <PrologueArea
            character={character}
            charState={charState}
            learnedSkills={learnedSkills}
            passiveBonuses={passiveBonuses}
            onPrologueClear={handlePrologueClear}
            onCharStateUpdate={handleCharStateUpdate}
          />
        );
      case 'home':
        return (
          <CharacterHome
            character={character}
            charState={charState}
            onCharStateUpdate={handleCharStateUpdate}
            onLog={addLog}
            onSkillsUpdate={handleSkillsUpdate}
            onSummonsChanged={loadMySummons}
            onMercenariesChanged={loadMyMercenaries}
            myMercenaries={myMercenaries}
            onNavigateVillage={navigateToVillage}
            initialTab={homeInitialTab}
            onInitialTabConsumed={() => setHomeInitialTab(null)}
            prologueCleared={prologueCleared}
          />
        );
      case 'village':
        return (
          <VillageArea
            character={character}
            charState={charState}
            onCharStateUpdate={handleCharStateUpdate}
            onLog={addLog}
            onSummonsChanged={loadMySummons}
            onMercenariesChanged={loadMyMercenaries}
            initialView={villageTarget}
            initialViewData={villageTargetData}
            onInitialViewConsumed={() => { setVillageTarget(null); setVillageTargetData(null); }}
          />
        );
      case 'stage':
        return (
          <StageArea
            character={character}
            charState={charState}
            onStartStageBattle={handleStartStageBattle}
            returnGroupKey={returnStageGroupKey}
            onReturnHandled={() => setReturnStageGroupKey(null)}
            contentCharges={contentCharges}
          />
        );
      case 'dungeon':
        return (
          <DungeonArea
            character={character}
            charState={charState}
            mySummons={mySummons}
            activeSummonIds={activeSummonIds}
            onToggleSummon={toggleSummon}
            onStartBattle={handleStartBattle}
            returnDungeonKey={returnDungeonKey}
            onReturnHandled={() => setReturnDungeonKey(null)}
            contentCharges={contentCharges}
          />
        );
      case 'special':
        return (
          <SpecialDungeonArea
            charState={charState}
            onStartBattle={handleStartBattle}
            onStartStageBattle={handleStartStageBattle}
          />
        );
      case 'bestiary':
        return <MonsterBestiary />;
      default:
        return null;
    }
  };

  return (
    <div className="game-layout-top">
      <TopNav
        character={character}
        charState={charState}
        currentLocation={currentLocation}
        onLocationChange={handleLocationChange}
        onLogout={onLogout}
        onGoToCharacterSelect={onGoToCharacterSelect}
        prologueCleared={prologueCleared}
        onShowPatchNotes={() => setShowPatchNotes(true)}
      />

      <main className="game-main-top">
        <div className="game-area">
          <div className="area-content">
            {renderAreaContent()}
          </div>
        </div>
      </main>

      <BattleLog logs={logs} />

      {/* 전투 복귀 프롬프트 */}
      {battleResumePrompt && (() => {
        const ctx = battleResumePrompt.context;
        const stageName = ctx.stage?.name || '전투';
        const dungeonKey = ctx.dungeonKey || 'forest';
        const stageNum = ctx.stage?.stageNumber;
        return (
          <div className="resume-overlay">
            <div className="resume-popup">
              {/* 배경 이미지 */}
              <div className="resume-bg">
                <img src="/ui/battle/resume_bg.png" alt="" />
                <div className="resume-bg-overlay" />
              </div>

              {/* 불씨 파티클 */}
              <div className="resume-particles">
                <div className="resume-particle" />
                <div className="resume-particle" />
                <div className="resume-particle" />
                <div className="resume-particle" />
                <div className="resume-particle" />
                <div className="resume-particle" />
              </div>

              <div className="resume-content">
                {/* 교차 검 엠블럼 */}
                <img src="/ui/battle/resume_swords.png" alt="" className="resume-emblem" />

                {/* 배너 장식 */}
                <div className="resume-banner-wrap">
                  <img src="/ui/battle/resume_banner.png" alt="" />
                </div>

                {/* 타이틀 */}
                <div className="resume-title">진행 중인 전투 발견</div>
                <div className="resume-subtitle">전장에서 이탈한 기록이 감지되었습니다</div>

                {/* 스테이지 정보 카드 */}
                <div className="resume-stage-card">
                  <img
                    src={stageNum ? `/dungeons/levels/${dungeonKey}_${stageNum}.png` : `/dungeons/${dungeonKey}_icon.png`}
                    alt=""
                    className="resume-stage-icon"
                    onError={(e) => { e.target.src = `/dungeons/${dungeonKey}_icon.png`; }}
                  />
                  <div className="resume-stage-info">
                    <div className="resume-stage-name">{stageName}</div>
                    <div className="resume-stage-desc">{battleResumePrompt.battleType === 'stage' ? '스테이지 전투' : battleResumePrompt.battleType === 'tower' ? '무한의 탑' : battleResumePrompt.battleType === 'crawler' ? '던전 크롤러' : '던전 전투'}</div>
                    <div className="resume-no-stamina">행동력 소모 없이 복귀 가능</div>
                  </div>
                </div>

                {/* 패널티 경고 섹션 */}
                <div className="resume-penalty-section">
                  <div className="resume-penalty-header">
                    <img src="/ui/battle/resume_penalty.png" alt="" className="resume-penalty-icon" />
                    <span className="resume-penalty-label">포기 시 패널티</span>
                  </div>
                  <div className="resume-penalty-list">
                    <div className="resume-penalty-chip">
                      HP <span className="penalty-val">-30%</span>
                    </div>
                    <div className="resume-penalty-chip">
                      골드 <span className="penalty-val">-30%</span>
                    </div>
                    <div className="resume-penalty-chip">
                      경험치 <span className="penalty-val">-15%</span>
                    </div>
                  </div>
                </div>

                {/* 액션 버튼 */}
                <div className="resume-actions">
                  <button className="resume-btn resume-btn-return" onClick={handleResumeAccept}>
                    <span className="resume-btn-emoji">&#x2694;&#xFE0F;</span>
                    전투 복귀
                  </button>
                  <button className="resume-btn resume-btn-abandon" onClick={handleResumeDecline}>
                    <span className="resume-btn-emoji">&#x1F6AB;</span>
                    포기
                  </button>
                </div>

                <div className="resume-glow-line" />
              </div>
            </div>
          </div>
        );
      })()}

      {/* 던전 클리어 축하 팝업 */}
      {dungeonClearPopup && (
        <div className="dclear-overlay">
          <div className="dclear-popup">
            {/* 배경 이미지 */}
            <div className="dclear-bg">
              <img src="/ui/dungeon/dc_clear_bg.png" alt="" onError={e => { e.target.style.display = 'none'; }} />
              <div className="dclear-bg-overlay" />
            </div>

            {/* 빛줄기 효과 */}
            <div className="dclear-rays">
              {[...Array(12)].map((_, i) => (
                <div key={i} className="dclear-ray" style={{ '--ri': i }} />
              ))}
            </div>

            {/* 골드 파티클 */}
            <div className="dclear-particles">
              {[...Array(20)].map((_, i) => (
                <div key={i} className="dclear-particle" style={{ '--pi': i }} />
              ))}
            </div>

            {/* 엠블럼 */}
            <div className="dclear-emblem-wrap">
              <div className="dclear-emblem-glow" />
              <img src="/ui/dungeon/dc_clear_emblem.png" alt="" className="dclear-emblem-img"
                onError={e => { e.target.style.display = 'none'; e.target.nextElementSibling.style.display = 'flex'; }} />
              <div className="dclear-emblem-fallback" style={{ display: 'none' }}>🏆</div>
            </div>

            {/* 타이틀 */}
            <div className="dclear-title">던전 클리어!</div>
            <div className="dclear-dungeon-name">{dungeonClearPopup.dungeonName}</div>
            <div className="dclear-stage-badge">Stage {dungeonClearPopup.stageNumber}</div>

            {/* 통계 카드 */}
            <div className="dclear-stats">
              <div className="dclear-stat">
                <span className="dclear-stat-icon">👣</span>
                <span className="dclear-stat-label">탐험</span>
                <span className="dclear-stat-value">{dungeonClearPopup.stepCount}걸음</span>
              </div>
              <div className="dclear-stat">
                <span className="dclear-stat-icon">⚔️</span>
                <span className="dclear-stat-label">처치</span>
                <span className="dclear-stat-value">{dungeonClearPopup.monstersDefeated}/{dungeonClearPopup.totalMonsters}</span>
              </div>
              <div className="dclear-stat">
                <span className="dclear-stat-icon">📦</span>
                <span className="dclear-stat-label">보물</span>
                <span className="dclear-stat-value">{dungeonClearPopup.treasuresFound}/{dungeonClearPopup.totalTreasures}</span>
              </div>
            </div>

            {/* 등급 표시 */}
            <div className="dclear-rank">
              <span className="dclear-rank-label">탐험 등급</span>
              <span className={`dclear-rank-grade ${
                dungeonClearPopup.monstersDefeated >= dungeonClearPopup.totalMonsters &&
                dungeonClearPopup.treasuresFound >= dungeonClearPopup.totalTreasures ? 'grade-s' :
                dungeonClearPopup.monstersDefeated >= dungeonClearPopup.totalMonsters ? 'grade-a' :
                dungeonClearPopup.treasuresFound > 0 ? 'grade-b' : 'grade-c'
              }`}>
                {dungeonClearPopup.monstersDefeated >= dungeonClearPopup.totalMonsters &&
                 dungeonClearPopup.treasuresFound >= dungeonClearPopup.totalTreasures ? 'S' :
                 dungeonClearPopup.monstersDefeated >= dungeonClearPopup.totalMonsters ? 'A' :
                 dungeonClearPopup.treasuresFound > 0 ? 'B' : 'C'}
              </span>
            </div>

            {/* 확인 버튼 */}
            <button className="dclear-btn" onClick={() => { setDungeonClearPopup(null); setCurrentLocation('dungeon'); }}>
              <span className="dclear-btn-icon">✨</span> 확인
            </button>
          </div>
        </div>
      )}

      {/* 패치노트 팝업 */}
      {showPatchNotes && (
        <div className="patch-notes-overlay" onClick={() => { setShowPatchNotes(false); localStorage.setItem('patchNotes_v11', '1'); }}>
          <div className="patch-notes-popup" onClick={e => e.stopPropagation()}>
            <div className="patch-notes-header">
              <button className="patch-notes-x" onClick={() => { setShowPatchNotes(false); localStorage.setItem('patchNotes_v11', '1'); }}>&times;</button>
              <div className="patch-notes-badge">NEW</div>
              <h2 className="patch-notes-title">패치 노트 v11 — 도깨비 노름방</h2>
              <div className="patch-notes-date">2026.03.19</div>
            </div>
            <div className="patch-notes-body">
              <div className="patch-section">
                <h3>용병/소환수 성급 강화 시스템</h3>
                <ul>
                  <li><span className="patch-tag new">신규</span> <b>0성 → 6성</b> 강화 시스템 (강화권 사용)</li>
                  <li><span className="patch-tag new">신규</span> 등급별 × 성급별 <b>차등 성공 확률</b> (일반 95%~25% / 초월 65%~5%)</li>
                  <li><span className="patch-tag new">신규</span> 성급별 <b>레벨 제한</b>: 2성(Lv10), 3성(Lv20), 4성(Lv35), 5성(Lv50), 6성(Lv70)</li>
                  <li><span className="patch-tag new">신규</span> 성급별 <b>스탯 보너스</b> 차등: 1성(+3%) ~ 6성(+10%), 총 36%</li>
                  <li><span className="patch-tag new">신규</span> <b>강화 팝업</b> 연출: AI 배경 이미지 + 마법진/대장간 이펙트 + 성공/실패 결과 화면</li>
                  <li><span className="patch-tag improve">개선</span> 용병/소환수별 다른 강화 배경 (용병: 대장간, 소환수: 크리스탈)</li>
                </ul>
              </div>
              <div className="patch-section">
                <h3>강화권 시스템</h3>
                <ul>
                  <li><span className="patch-tag new">신규</span> <b>14종 강화권</b>: 일반~초월 × 용병/소환수 (가챠 중복 시 획득)</li>
                  <li><span className="patch-tag new">신규</span> 가챠 중복 소환 시 골드 대신 <b>해당 등급 강화권</b> 지급</li>
                  <li><span className="patch-tag improve">개선</span> 강화권은 소모품 탭에 ⭐ 아이콘으로 표시</li>
                  <li><span className="patch-tag improve">개선</span> 주인공 인벤토리에서는 "용병/소환수용" 비활성 표시</li>
                  <li><span className="patch-tag improve">개선</span> 용병 장비에서 소환수강화권은 "소환수용", 반대도 동일</li>
                </ul>
              </div>
              <div className="patch-section">
                <h3>가챠 연출 대개편</h3>
                <ul>
                  <li><span className="patch-tag new">신규</span> <b>AI 고품질 배경</b> 16장 (ComfyUI + Flux.1-dev)</li>
                  <li><span className="patch-tag new">신규</span> 용병: <b>전장 봉화</b> 테마 (불꽃/검/충격파)</li>
                  <li><span className="patch-tag new">신규</span> 소환수: <b>마법진 소환</b> 테마 (마법진/빛기둥/룬문자)</li>
                  <li><span className="patch-tag new">신규</span> 고급 소환권: 일반 대비 <b>2배 긴 연출</b> + 프리미엄 배경 + 금색 이펙트</li>
                  <li><span className="patch-tag new">신규</span> 소환 결과 시 유닛별 <b>고유 소개 멘트</b> (타이핑 효과)</li>
                  <li><span className="patch-tag new">신규</span> 중복 소환 시 <b>강화권 획득 안내</b> 팝업</li>
                </ul>
              </div>
              <div className="patch-section">
                <h3>성급 표시 UI</h3>
                <ul>
                  <li><span className="patch-tag new">신규</span> 모든 화면에 <b>성급 표시</b>: 0성(☆) ~ 6성(★★★★★★)</li>
                  <li><span className="patch-tag new">신규</span> 홈/여관/소환술사/도감/전투 카드 모두 등급 뱃지 + 성급 표시</li>
                  <li><span className="patch-tag new">신규</span> 스테이지 전투/크롤러 전투/SRPG 전투 아군 카드에 등급+성급</li>
                </ul>
              </div>
              <div className="patch-section">
                <h3>스킬 대폭 보강</h3>
                <ul>
                  <li><span className="patch-tag new">신규</span> 용병 스킬 <b>38 → 86개</b> (+48): 클래스당 10개 (Lv1~Lv80)</li>
                  <li><span className="patch-tag new">신규</span> 소환수 스킬 <b>50 → 51개</b>: 신수/용/마수 타입 22종 추가</li>
                  <li><span className="patch-tag new">신규</span> 몬스터 스킬 <b>33 → 40개</b> (+7): 고티어 전용 상위 스킬</li>
                  <li><span className="patch-tag new">신규</span> 스킬 아이콘 <b>78장</b> Pillow 자동 생성 (기존 스타일 유지)</li>
                </ul>
              </div>
              <div className="patch-section">
                <h3>도깨비 노름방 (신규 시설)</h3>
                <ul>
                  <li><span className="patch-tag new">신규</span> 마을에 <b>도깨비 노름방</b> 시설 추가</li>
                  <li><span className="patch-tag new">신규</span> NPC: 도깨비 노름방 주인 (AI 생성 초상화)</li>
                  <li><span className="patch-tag new">신규</span> <b>🎲 도깨비 주사위</b>: 3D 주사위 물리 시뮬레이션 (Three.js)</li>
                  <li><span className="patch-tag new">신규</span> <b>🪙 동전 던지기</b>: 3D 금화 뒤집기 (앞면 태양 / 뒷면 달)</li>
                  <li><span className="patch-tag new">신규</span> <b>📊 하이로우</b>: 3D 카드 뒤집기 + 연승 보상 시스템</li>
                  <li><span className="patch-tag new">신규</span> 하이로우 연승 중 <b>"멈추고 보상 받기"</b> 기능</li>
                  <li><span className="patch-tag new">신규</span> 베팅 금액 선택: 50 ~ 5,000G (최대 10,000G)</li>
                  <li><span className="patch-tag new">신규</span> 서버 기반 결과 계산 (조작 방지)</li>
                </ul>
              </div>
              <div className="patch-section">
                <h3>기타 개선</h3>
                <ul>
                  <li><span className="patch-tag improve">개선</span> 캐릭터 닉네임 <b>금지어 시스템</b>: 비속어/사칭/몬스터명 등 350+ 차단</li>
                  <li><span className="patch-tag improve">개선</span> 속성 미선택 시 <b>빨간 테두리 깜박</b> + 자동 스크롤</li>
                  <li><span className="patch-tag improve">개선</span> 모든 유닛에 <b>속성 오라</b> 적용 (neutral 포함)</li>
                  <li><span className="patch-tag improve">개선</span> 자동전투 중 정예 몬스터 팝업 2초 후 자동 닫힘</li>
                  <li><span className="patch-tag fix">수정</span> 상점에서 강화권/소환권 판매 차단</li>
                  <li><span className="patch-tag fix">수정</span> 프롤로그 중복 전투 버그</li>
                  <li><span className="patch-tag fix">수정</span> WebGL 컨텍스트 누수 수정</li>
                </ul>
              </div>
            </div>
            <button className="patch-notes-close" onClick={() => { setShowPatchNotes(false); localStorage.setItem('patchNotes_v11', '1'); }}>
              확인
            </button>
          </div>
        </div>
      )}

      {/* 전투 로딩 팝업 */}
      {battleLoading && (
        <div className="battle-loading-overlay">
          <div className="battle-loading-popup">
            <div className="battle-loading-icon">
              <div className="battle-loading-sword" />
              <div className="battle-loading-shield" />
            </div>
            <div className="battle-loading-title">{battleLoading.name}</div>
            <div className="battle-loading-subtitle">
              {battleLoading.type === 'dungeon' ? '던전 진입 준비 중...' :
               battleLoading.type === 'stage' ? '전투 준비 중...' :
               battleLoading.type === 'tower' ? '탑 진입 준비 중...' :
               battleLoading.type === 'boss_raid' ? '보스 소환 중...' :
               battleLoading.type === 'elemental' ? '정령 소환 중...' : '준비 중...'}
            </div>
            <div className="battle-loading-bar">
              <div className="battle-loading-bar-fill" />
            </div>
            <div className="battle-loading-tip">
              {['진형 배치를 잘 활용하면 전투가 유리해집니다.',
                '소환수의 속성을 적에게 맞추면 큰 피해를 줄 수 있습니다.',
                '용병의 피로도가 높으면 전투력이 떨어집니다.',
                '보스 몬스터는 특수 패턴을 가지고 있습니다.',
                '스킬 조합에 따라 연계 효과가 발동됩니다.',
                '정예 몬스터는 더 좋은 보상을 드롭합니다.',
              ][Math.floor(Math.random() * 6)]}
            </div>
          </div>
        </div>
      )}

      {/* 전투 불가 팝업 */}
      {battleBlockMsg && (
        <div className="battle-block-overlay" onClick={() => setBattleBlockMsg(null)}>
          <div className={`battle-block-popup ${battleBlockMsg === '__FORMATION__' ? 'formation-popup' : battleBlockMsg.startsWith('__FATIGUE__') ? 'fatigue-popup' : battleBlockMsg.includes('행동력') ? 'stamina-popup' : ''}`} onClick={e => e.stopPropagation()}>
            {battleBlockMsg.startsWith('__FATIGUE__') ? (
              <>
                <div className="fatigue-popup-bg">
                  <img src="/ui/battle/fatigue_bg.png" alt="" />
                  <div className="fatigue-popup-bg-overlay" />
                </div>
                <div className="fatigue-popup-particles">
                  <div className="fatigue-particle" />
                  <div className="fatigue-particle" />
                  <div className="fatigue-particle" />
                  <div className="fatigue-particle" />
                  <div className="fatigue-particle" />
                  <div className="fatigue-particle" />
                </div>
                <div className="fatigue-popup-content">
                  <div className="fatigue-popup-icon-wrap">
                    <div className="fatigue-popup-icon-glow" />
                    <img src="/ui/battle/fatigue_icon.png" alt="" className="fatigue-popup-icon-img" />
                  </div>
                  <div className="fatigue-popup-title">피로한 용병</div>
                  <div className="fatigue-popup-divider"><span /></div>
                  <div className="fatigue-popup-desc">
                    진영에 배치된 용병이 극도로 피로하여<br/>전투에 참여할 수 없습니다.
                  </div>
                  <div className="fatigue-popup-names">
                    {battleBlockMsg.replace('__FATIGUE__:', '').split(',').map((name, i) => (
                      <div key={i} className="fatigue-popup-name-tag">
                        <span className="fatigue-tag-zzz">💤</span>
                        <span className="fatigue-tag-name">{name}</span>
                        <span className="fatigue-tag-status">피로</span>
                      </div>
                    ))}
                  </div>
                  <div className="fatigue-popup-hint">
                    <span className="fatigue-hint-icon">🏨</span>
                    여관에서 휴식시키거나 진영에서 제외해주세요
                  </div>
                  <div className="fatigue-popup-actions">
                    <button className="fatigue-popup-go-btn" onClick={() => {
                      setBattleBlockMsg(null);
                      setVillageTarget('inn');
                      setVillageTargetData({ initialTab: 'my' });
                      setCurrentLocation('village');
                    }}>
                      <span className="fatigue-go-shimmer" />
                      <span className="fatigue-go-text">🏨 여관으로 이동</span>
                    </button>
                    <button className="fatigue-popup-close-btn" onClick={() => setBattleBlockMsg(null)}>닫기</button>
                  </div>
                </div>
              </>
            ) : battleBlockMsg === '__FORMATION__' ? (
              <>
                <div className="formation-popup-bg">
                  <img src="/ui/formation_required_bg.png" alt="" />
                  <div className="formation-popup-bg-overlay" />
                </div>
                <div className="formation-popup-content">
                  <div className="formation-popup-icon-wrap">
                    <div className="formation-popup-icon-glow" />
                    <img src="/ui/tab_formation_icon.png" alt="" className="formation-popup-icon" onError={e => { e.target.style.display='none'; e.target.nextSibling.style.display='block'; }} />
                    <span className="formation-popup-icon-fallback" style={{display:'none'}}>&#x2694;</span>
                  </div>
                  <div className="formation-popup-title">진영 편성 필요</div>
                  <div className="formation-popup-divider"><span /></div>
                  <div className="formation-popup-desc">전투에 출전할 진영이 구성되지 않았습니다.<br/>유닛을 배치하여 전략적 진형을 완성하세요.</div>
                  <div className="formation-popup-grid-preview">
                    {[...Array(9)].map((_, i) => <div key={i} className={`formation-preview-cell ${i === 4 ? 'center' : ''}`}><span className="formation-cell-pulse" /></div>)}
                  </div>
                  <div className="battle-block-actions">
                    <button className="formation-popup-go-btn" onClick={() => {
                      setBattleBlockMsg(null);
                      setHomeInitialTab('formation');
                      setCurrentLocation('home');
                    }}>
                      <span className="formation-go-icon">&#x2694;</span>
                      진영 편성하기
                    </button>
                    <button className="formation-popup-close-btn" onClick={() => setBattleBlockMsg(null)}>닫기</button>
                  </div>
                </div>
              </>
            ) : battleBlockMsg.includes('행동력') ? (
              <>
                <div className="stamina-block-bg">
                  <img src="/ui/battle/stamina_empty_bg.png" alt="" />
                  <div className="stamina-block-bg-overlay" />
                </div>
                <div className="stamina-block-particles">
                  <div className="stamina-particle" />
                  <div className="stamina-particle" />
                  <div className="stamina-particle" />
                  <div className="stamina-particle" />
                  <div className="stamina-particle" />
                </div>
                <div className="stamina-block-content">
                  <div className="stamina-block-icon-wrap">
                    <div className="stamina-block-icon-glow" />
                    <img src="/ui/battle/stamina_empty_icon.png" alt="" className="stamina-block-icon" />
                  </div>
                  <div className="stamina-block-title">행동력 부족</div>
                  <div className="stamina-block-divider"><span /></div>
                  <div className="stamina-block-gauge">
                    <div className="stamina-block-gauge-label">
                      <span>현재 행동력</span>
                      <span className="stamina-block-gauge-val">{charState.stamina ?? 0} / {charState.maxStamina ?? 10}</span>
                    </div>
                    <div className="stamina-block-gauge-track">
                      <div className="stamina-block-gauge-fill" style={{width: `${Math.max(0, ((charState.stamina ?? 0) / (charState.maxStamina ?? 10)) * 100)}%`}} />
                    </div>
                  </div>
                  <div className="stamina-block-msg">{battleBlockMsg}</div>
                  <div className="stamina-block-hint">
                    <span className="stamina-hint-icon">&#x23F0;</span>
                    5분마다 1씩 자동 회복됩니다
                  </div>
                  <button className="stamina-block-confirm-btn" onClick={() => setBattleBlockMsg(null)}>확인</button>
                </div>
              </>
            ) : (
              <>
                <div className="battle-block-icon">
                  {battleBlockMsg.includes('HP') ? '💔' : '⚠️'}
                </div>
                <div className="battle-block-title">전투 불가</div>
                <div className="battle-block-msg">{battleBlockMsg}</div>
                <button className="battle-block-btn" onClick={() => setBattleBlockMsg(null)}>확인</button>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export default Home;
