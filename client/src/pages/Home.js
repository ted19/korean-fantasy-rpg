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
  });
  const [fighting, setFighting] = useState(false);
  const [learnedSkills, setLearnedSkills] = useState([]);
  const [mySummons, setMySummons] = useState([]);
  const [activeSummonIds, setActiveSummonIds] = useState([]);
  const [myMercenaries, setMyMercenaries] = useState([]);
  const [srpgBattle, setSrpgBattle] = useState(false);
  const [battleLocation, setBattleLocation] = useState(null);
  const [battleStage, setBattleStage] = useState(null);
  const [returnDungeonKey, setReturnDungeonKey] = useState(null);
  const [returnStageGroupKey, setReturnStageGroupKey] = useState(null);
  const [battleStageGroup, setBattleStageGroup] = useState(null);
  const [battleStageMonsters, setBattleStageMonsters] = useState(null);

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

  useEffect(() => {
    api.get('/skill/list').then(res => {
      setLearnedSkills(res.data.skills.filter(s => s.learned));
    }).catch(() => {});
  }, [charState.level]);

  const addLog = (text, type = 'normal') => {
    setLogs((prev) => [...prev.slice(-50), { text, type, time: new Date().toLocaleTimeString() }]);
  };

  const handleLocationChange = (locId) => {
    if (fighting) return;
    setCurrentLocation(locId);
  };

  const handleCharStateUpdate = (updates) => {
    setCharState((prev) => ({ ...prev, ...updates }));
  };

  const toggleSummon = (id) => {
    setActiveSummonIds(prev =>
      prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
    );
  };

  const handleStartBattle = (dungeonKey, stage) => {
    if (fighting || srpgBattle) return;
    if (charState.currentHp <= 0) {
      addLog('HP가 0입니다! 마을에서 휴식하세요.', 'damage');
      return;
    }
    setBattleLocation(dungeonKey);
    setBattleStage(stage);
    setReturnDungeonKey(dungeonKey);
    setBattleStageGroup(null);
    setBattleStageMonsters(null);
    setSrpgBattle(true);
    setFighting(true);
  };

  const handleStartStageBattle = (groupKey, stage, monsters) => {
    if (fighting || srpgBattle) return;
    if (charState.currentHp <= 0) {
      addLog('HP가 0입니다! 마을에서 휴식하세요.', 'damage');
      return;
    }
    const dungeonKey = stage.dungeonKey || 'forest';
    setBattleLocation(dungeonKey);
    setBattleStage(stage);
    setBattleStageGroup(groupKey);
    setBattleStageMonsters(monsters);
    setReturnStageGroupKey(groupKey);
    setReturnDungeonKey(null);
    setSrpgBattle(true);
    setFighting(true);
  };

  const handleSrpgBattleEnd = async (result, expGained, goldGained) => {
    const stage = battleStage;
    const dungeonKey = battleLocation;

    // 승리시 스테이지 클리어를 먼저 저장 (UI 전환 전에)
    if (result === 'victory') {
      addLog(`SRPG 전투 승리! EXP +${expGained}, Gold +${goldGained}`, 'heal');
      if (stage && battleStageGroup) {
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
    }

    // 전투 UI 해제 (리마운트 → 최신 데이터 로드)
    setSrpgBattle(false);
    setFighting(false);
    setBattleLocation(null);
    setBattleStage(null);
    setBattleStageGroup(null);
    setBattleStageMonsters(null);

    try {
      const res = await api.get('/characters/me');
      const c = res.data.character;
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
      });
    } catch {}

    await loadMySummons();
    await loadMyMercenaries();

    if (result === 'retreat') {
      addLog('전투에서 후퇴했습니다.', 'system');
      setReturnDungeonKey(null);
      setReturnStageGroupKey(null);
      setCurrentLocation('village');
    } else if (result !== 'victory') {
      addLog('SRPG 전투 패배... 마을에서 휴식하세요.', 'damage');
      setReturnDungeonKey(null);
      setReturnStageGroupKey(null);
      setCurrentLocation('village');
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
            onSkillsUpdate={setLearnedSkills}
            onCharacterDeleted={onCharacterDeleted}
            onSummonsChanged={loadMySummons}
            onMercenariesChanged={loadMyMercenaries}
            myMercenaries={myMercenaries}
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
          />
        );
      case 'stage':
        return (
          <StageArea
            charState={charState}
            mySummons={mySummons}
            activeSummonIds={activeSummonIds}
            onToggleSummon={toggleSummon}
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
        <BattleLog logs={logs} />
      </main>
    </div>
  );
}

export default Home;
