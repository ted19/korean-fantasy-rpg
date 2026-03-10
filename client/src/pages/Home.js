import React, { useState, useEffect } from 'react';
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
  const [specialBattleCtx, setSpecialBattleCtx] = useState(null);
  const [returnSpecialType, setReturnSpecialType] = useState(null);
  const [villageTarget, setVillageTarget] = useState(null);
  const [villageTargetData, setVillageTargetData] = useState(null);
  const [homeInitialTab, setHomeInitialTab] = useState(null);
  const [battleResumePrompt, setBattleResumePrompt] = useState(null); // 전투 복귀 프롬프트
  const savedEnemySetupRef = React.useRef(null); // 정예 리롤 방지용 적 구성
  const savedRetreatFailedRef = React.useRef(false); // 후퇴 실패 기록
  const [contentCharges, setContentCharges] = useState({}); // { stage_gojoseon: {charges,maxCharges,cooldown}, dungeon_cave: {...}, ... }

  const loadContentCharges = async () => {
    try {
      const res = await api.get('/stage/charges');
      setContentCharges(res.data);
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

  useEffect(() => {
    api.get('/skill/active-skills').then(res => {
      setLearnedSkills(res.data.skills || []);
      setPassiveBonuses(res.data.passiveBonuses || {});
    }).catch(() => {
      // fallback to legacy list
      api.get('/skill/list').then(res => {
        setLearnedSkills(res.data.skills.filter(s => s.learned));
      }).catch(() => {});
    });
  }, [charState.level]);

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
    if (charState.currentHp <= 0) {
      setBattleBlockMsg('HP가 0입니다!\n마을 여관에서 휴식 후 다시 도전하세요.');
      return;
    }
    const isTower = specialCtx?.type === 'tower';
    const isDungeon = !specialCtx && !stage?.groupKey; // 던전 전투인 경우
    const isBossRaid = specialCtx?.type === 'boss_raid';
    const isSpecialDungeon = !!specialCtx && !isTower;
    // 콘텐츠별 행동력 소모: 일반던전=2, 스페셜던전=3, 보스토벌=4, 기본=1
    const staminaCost = isBossRaid ? 4 : isSpecialDungeon ? 3 : isDungeon ? 2 : (stage?.isBoss ? 2 : 1);
    if (!isTower) {
      if (charState.stamina < staminaCost) {
        setBattleBlockMsg(`행동력이 부족합니다! (필요: ${staminaCost})\n시간이 지나면 자동으로 회복됩니다.`);
        return;
      }
      // 던전 전투: 티켓 소모 → 입장 횟수 소모 (티켓 먼저 체크)
      if (isDungeon && dungeonKey) {
        try {
          await api.post('/dungeon/use-ticket', { dungeonKey });
        } catch (err) {
          setBattleBlockMsg(err.response?.data?.message || '던전 티켓이 부족합니다!');
          return;
        }
        try {
          await api.post('/stage/use-charge', { contentType: `dungeon_${dungeonKey}_${stage?.stageNumber || 1}` });
          loadContentCharges();
        } catch (err) {
          setBattleBlockMsg(err.response?.data?.message || '던전 입장 횟수를 모두 소진했습니다!');
          return;
        }
      }
      try {
        const stRes = await api.post('/stage/spend-stamina', { cost: staminaCost });
        handleCharStateUpdate({ stamina: stRes.data.stamina, maxStamina: stRes.data.maxStamina, lastStaminaTime: stRes.data.last_stamina_time || new Date().toISOString() });
      } catch (err) {
        setBattleBlockMsg(err.response?.data?.message || '행동력 차감에 실패했습니다.');
        return;
      }
    }
    savedEnemySetupRef.current = null; // 새 전투는 적 구성 초기화
    savedRetreatFailedRef.current = false;
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
    const bType = specialCtx?.type === 'tower' ? 'tower' : 'srpg';
    saveBattleSession(bType, { dungeonKey, stage, specialCtx: specialCtx || null });
  };

  const handleStartStageBattle = async (groupKey, stage, monsters, specialCtx, isCleared) => {
    if (fighting || srpgBattle) return;
    if (await checkFormationEmpty()) {
      setBattleBlockMsg('__FORMATION__');
      return;
    }
    if (charState.currentHp <= 0) {
      setBattleBlockMsg('HP가 0입니다!\n마을 여관에서 휴식 후 다시 도전하세요.');
      return;
    }
    // 스테이지 전투: 보스=2, 일반=1, 스페셜=3
    const isSpecial = !!specialCtx;
    const staminaCost = isSpecial ? 3 : (stage?.isBoss ? 2 : 1);
    if (charState.stamina < staminaCost) {
      setBattleBlockMsg(`행동력이 부족합니다! (필요: ${staminaCost})\n시간이 지나면 자동으로 회복됩니다.`);
      return;
    }
    // 스테이지 입장 횟수 소모
    if (!isSpecial) {
      try {
        await api.post('/stage/use-charge', { contentType: `stage_${groupKey}_${stage.stageNumber}` });
        loadContentCharges();
      } catch (err) {
        setBattleBlockMsg(err.response?.data?.message || '스테이지 입장 횟수를 모두 소진했습니다!');
        return;
      }
    }
    try {
      const stRes = await api.post('/stage/spend-stamina', { cost: staminaCost });
      handleCharStateUpdate({ stamina: stRes.data.stamina, maxStamina: stRes.data.maxStamina, lastStaminaTime: stRes.data.last_stamina_time || new Date().toISOString() });
    } catch (err) {
      setBattleBlockMsg(err.response?.data?.message || '행동력 차감에 실패했습니다.');
      return;
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
            onSkillsUpdate={(skills) => {
              setLearnedSkills(skills);
              // Refresh passive bonuses too
              api.get('/skill/active-skills').then(res => {
                setPassiveBonuses(res.data.passiveBonuses || {});
              }).catch(() => {});
            }}
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
                    <div className="resume-stage-desc">{battleResumePrompt.battleType === 'stage' ? '스테이지 전투' : battleResumePrompt.battleType === 'tower' ? '무한의 탑' : '던전 전투'}</div>
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

      {/* 전투 불가 팝업 */}
      {battleBlockMsg && (
        <div className="battle-block-overlay" onClick={() => setBattleBlockMsg(null)}>
          <div className={`battle-block-popup ${battleBlockMsg === '__FORMATION__' ? 'formation-popup' : ''}`} onClick={e => e.stopPropagation()}>
            {battleBlockMsg === '__FORMATION__' ? (
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
            ) : (
              <>
                <div className="battle-block-icon">
                  {battleBlockMsg.includes('HP') ? '💔' : battleBlockMsg.includes('행동력') ? '⚡' : '⚠️'}
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
