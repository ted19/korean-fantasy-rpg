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

function Home({ user, character, onLogout, onCharacterDeleted, onGoToCharacterSelect }) {
  const [currentLocation, setCurrentLocation] = useState('home');
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
  const [battleBlockMsg, setBattleBlockMsg] = useState(null);
  const [specialBattleCtx, setSpecialBattleCtx] = useState(null);
  const [returnSpecialType, setReturnSpecialType] = useState(null);
  const [villageTarget, setVillageTarget] = useState(null);
  const [villageTargetData, setVillageTargetData] = useState(null);

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

  useEffect(() => { loadMySummons(); loadMyMercenaries(); }, []);

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

  const handleStartBattle = async (dungeonKey, stage, specialCtx) => {
    if (fighting || srpgBattle) return;
    if (charState.currentHp <= 0) {
      setBattleBlockMsg('HP가 0입니다!\n마을 여관에서 휴식 후 다시 도전하세요.');
      return;
    }
    const isTower = specialCtx?.type === 'tower';
    const isDungeon = !specialCtx && !stage?.groupKey; // 던전 전투인 경우
    if (!isTower) {
      if (charState.stamina <= 0) {
        setBattleBlockMsg('행동력이 부족합니다!\n시간이 지나면 자동으로 회복됩니다.');
        return;
      }
      // 던전 전투 시 티켓 소모
      if (isDungeon && dungeonKey) {
        try {
          await api.post('/dungeon/use-ticket', { dungeonKey });
        } catch (err) {
          setBattleBlockMsg(err.response?.data?.message || '던전 티켓이 부족합니다!');
          return;
        }
      }
      try {
        const stRes = await api.post('/stage/spend-stamina');
        handleCharStateUpdate({ stamina: stRes.data.stamina, maxStamina: stRes.data.maxStamina, lastStaminaTime: stRes.data.last_stamina_time || new Date().toISOString() });
      } catch (err) {
        setBattleBlockMsg(err.response?.data?.message || '행동력 차감에 실패했습니다.');
        return;
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
  };

  const handleStartStageBattle = async (groupKey, stage, monsters, specialCtx) => {
    if (fighting || srpgBattle) return;
    if (charState.currentHp <= 0) {
      setBattleBlockMsg('HP가 0입니다!\n마을 여관에서 휴식 후 다시 도전하세요.');
      return;
    }
    if (charState.stamina <= 0) {
      setBattleBlockMsg('행동력이 부족합니다!\n시간이 지나면 자동으로 회복됩니다.');
      return;
    }
    try {
      const stRes = await api.post('/stage/spend-stamina');
      handleCharStateUpdate({ stamina: stRes.data.stamina, maxStamina: stRes.data.maxStamina, lastStaminaTime: stRes.data.last_stamina_time || new Date().toISOString() });
    } catch (err) {
      setBattleBlockMsg(err.response?.data?.message || '행동력 차감에 실패했습니다.');
      return;
    }
    const dungeonKey = stage.dungeonKey || 'forest';
    setBattleLocation(dungeonKey);
    setBattleStage(stage);
    setBattleStageGroup(groupKey);
    setBattleStageMonsters(monsters);
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
  };

  const handleSrpgBattleEnd = async (result, expGained, goldGained) => {
    const stage = battleStage;
    const dungeonKey = battleLocation;
    const spCtx = specialBattleCtx;

    // 승리시 클리어 기록
    if (result === 'victory') {
      addLog(`SRPG 전투 승리! EXP +${expGained}, Gold +${goldGained}`, 'heal');

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

    if (result === 'retreat') {
      addLog('전투에서 후퇴했습니다.', 'system');
      setReturnDungeonKey(null);
      setReturnStageGroupKey(null);
      if (returnSpecialType) {
        setCurrentLocation('special');
      } else {
        setCurrentLocation('village');
      }
      setReturnSpecialType(null);
    } else if (result !== 'victory') {
      addLog('SRPG 전투 패배... 마을에서 휴식하세요.', 'damage');
      setReturnDungeonKey(null);
      setReturnStageGroupKey(null);
      setReturnSpecialType(null);
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
        />
      </div>
    );
  }

  // SRPG 전투 모드 (던전)
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
        />
      </div>
    );
  }

  const renderAreaContent = () => {
    switch (currentLocation) {
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
            charState={charState}
            onStartStageBattle={handleStartStageBattle}
            returnGroupKey={returnStageGroupKey}
            onReturnHandled={() => setReturnStageGroupKey(null)}
          />
        );
      case 'dungeon':
        return (
          <DungeonArea
            charState={charState}
            mySummons={mySummons}
            activeSummonIds={activeSummonIds}
            onToggleSummon={toggleSummon}
            onStartBattle={handleStartBattle}
            returnDungeonKey={returnDungeonKey}
            onReturnHandled={() => setReturnDungeonKey(null)}
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
      />

      <main className="game-main-top">
        <div className="game-area">
          <div className="area-content">
            {renderAreaContent()}
          </div>
        </div>
      </main>

      <BattleLog logs={logs} />

      {/* 전투 불가 팝업 */}
      {battleBlockMsg && (
        <div className="battle-block-overlay" onClick={() => setBattleBlockMsg(null)}>
          <div className="battle-block-popup" onClick={e => e.stopPropagation()}>
            <div className="battle-block-icon">
              {battleBlockMsg.includes('HP') ? '💔' : battleBlockMsg.includes('행동력') ? '⚡' : '⚠️'}
            </div>
            <div className="battle-block-title">전투 불가</div>
            <div className="battle-block-msg">{battleBlockMsg}</div>
            <button className="battle-block-btn" onClick={() => setBattleBlockMsg(null)}>확인</button>
          </div>
        </div>
      )}
    </div>
  );
}

export default Home;
