import React, { useState, useEffect, useRef } from 'react';
import { Badge } from 'react-bootstrap';
import api from '../api';
import { ELITE_TIERS } from '../srpg/battleEngine';
import './DungeonArea.css';
import './MonsterBestiary.css';

// ========== 던전 진입 컷신 ==========
const DUNGEON_INTRO_SCENES = {
  '풍수사': [
    {
      bg: '/dungeons/forest_bg.png',
      speaker: '나레이션',
      text: '스테이지의 전장 너머, 더 깊고 위험한 곳이 있었다. 자연의 기운이 뒤틀린 곳—던전이라 불리는 마물의 소굴.',
    },
    {
      bg: '/dungeons/forest_bg.png',
      speaker: '풍수사',
      text: '이곳의 용맥은 완전히 역류하고 있어... 마물이 둥지를 틀기 딱 좋은 환경이야.',
    },
    {
      bg: '/dungeons/cave_bg.png',
      speaker: '나레이션',
      text: '어둠의 숲, 수정 동굴, 심해 유적... 각 던전에는 고유한 마물 생태계가 형성되어 있다.',
    },
    {
      bg: '/dungeons/cave_bg.png',
      speaker: '풍수사',
      text: '던전을 하나씩 정화하면 이 땅의 기운도 되살아날 거야. 나침반이 가리키는 대로 가보자.',
    },
    {
      bg: '/dungeons/dungeon_map_bg.png',
      speaker: '나레이션',
      text: '풍수사는 던전 지도를 펼쳤다. 각 던전마다 입장 티켓이 필요하고, 더 깊이 들어갈수록 강력한 마물이 기다리고 있다.',
    },
  ],
  '무당': [
    {
      bg: '/dungeons/spirit_forest_bg.png',
      speaker: '나레이션',
      text: '영혼의 울음소리가 가장 강하게 들리는 곳. 던전—이승과 저승의 경계가 가장 얇은 장소들이다.',
    },
    {
      bg: '/dungeons/spirit_forest_bg.png',
      speaker: '무당',
      text: '여기에선 영혼의 소리가 비명처럼 울려... 원혼만이 아니야, 살아있는 마물도 득실거리고 있어.',
    },
    {
      bg: '/dungeons/swamp_bg.png',
      speaker: '나레이션',
      text: '독안개 늪, 정령의 숲, 망자의 신전... 각 던전은 서로 다른 종류의 저주와 마기로 오염되어 있다.',
    },
    {
      bg: '/dungeons/swamp_bg.png',
      speaker: '무당',
      text: '방울 소리로 길을 열고, 부적으로 마물을 봉인하겠어. 하나씩 정화해 나가면 돼.',
    },
    {
      bg: '/dungeons/dungeon_map_bg.png',
      speaker: '나레이션',
      text: '무당은 영안으로 던전의 위치를 감지했다. 입장 티켓을 모아 각 던전의 심층부까지 도달해야 한다.',
    },
  ],
  '승려': [
    {
      bg: '/dungeons/cave_bg.png',
      speaker: '나레이션',
      text: '산 아래에는 사람의 손이 닿지 않는 동굴과 숲이 있다. 그곳에 마물이 서식하는 던전이 형성되었다.',
    },
    {
      bg: '/dungeons/cave_bg.png',
      speaker: '승려',
      text: '나무아미타불... 이 안에서 느껴지는 마기가 심상치 않구나. 수행의 힘으로 정화해야겠다.',
    },
    {
      bg: '/dungeons/mountain_bg.png',
      speaker: '나레이션',
      text: '수정 동굴, 서리 산맥, 용의 둥지... 각 던전에는 승려의 법력으로도 쉽지 않은 강적이 도사리고 있다.',
    },
    {
      bg: '/dungeons/mountain_bg.png',
      speaker: '승려',
      text: '두려움은 없다. 진언으로 마물을 정화하고, 결계로 동료를 지키겠다.',
    },
    {
      bg: '/dungeons/dungeon_map_bg.png',
      speaker: '나레이션',
      text: '승려는 목탁을 쥐고 첫 번째 던전을 향해 걸어갔다. 던전 입장 티켓을 모아 심층 탐험에 도전해야 한다.',
    },
  ],
  '저승사자': [
    {
      bg: '/dungeons/demon_bg.png',
      speaker: '나레이션',
      text: '이승에는 저승보다 어두운 곳이 있다. 던전—마물이 넘쳐나는 이승의 지옥이다.',
    },
    {
      bg: '/dungeons/demon_bg.png',
      speaker: '저승사자',
      text: '이곳의 마기는 저승의 그것과 다르군. 살아있는 마물이 스스로 만들어낸 지옥이라니...',
    },
    {
      bg: '/dungeons/dragon_bg.png',
      speaker: '나레이션',
      text: '마왕성, 용의 둥지, 심해 유적... 가장 강력한 마물들이 던전의 최심부에서 기다리고 있다.',
    },
    {
      bg: '/dungeons/dragon_bg.png',
      speaker: '저승사자',
      text: '명부에 이름이 오른 마물도 있군. 낫으로 영혼을 거두고, 이 던전들을 저승의 관할 아래 두겠다.',
    },
    {
      bg: '/dungeons/dungeon_map_bg.png',
      speaker: '나레이션',
      text: '저승사자는 명부를 펼쳤다. 각 던전의 마물을 하나씩 처리하며 이승의 질서를 바로잡아야 한다.',
    },
  ],
  '북채비': [
    {
      bg: '/dungeons/cave_bg.png',
      speaker: '나레이션',
      text: '마을을 지키던 북채비의 시선이 멀리 향했다. 산 너머에서 마물이 쏟아져 나오는 곳—던전이 형성되고 있었다.',
    },
    {
      bg: '/dungeons/cave_bg.png',
      speaker: '북채비',
      text: '마을 주변만 지켜서는 한계가 있어. 마물의 소굴을 직접 부수러 가야 한다.',
    },
    {
      bg: '/dungeons/mountain_bg.png',
      speaker: '나레이션',
      text: '어둠의 동굴, 수정 광산, 용의 둥지... 각 던전에는 방패로도 막기 어려운 강력한 마물이 도사리고 있다.',
    },
    {
      bg: '/dungeons/mountain_bg.png',
      speaker: '북채비',
      text: '좋아. 이 방패로 앞장서서 돌파하겠다. 동료들은 내 뒤에서 안전하게 따라오면 돼.',
    },
    {
      bg: '/dungeons/dungeon_map_bg.png',
      speaker: '나레이션',
      text: '북채비는 방패를 단단히 쥐고 첫 번째 던전으로 향했다. 입장 티켓을 모아 심층부를 정복해야 한다.',
    },
  ],
  '강신무': [
    {
      bg: '/dungeons/forest_bg.png',
      speaker: '나레이션',
      text: '신령의 불꽃이 이끄는 곳. 던전—마물의 어둠이 가장 짙게 응축된 장소들이다.',
    },
    {
      bg: '/dungeons/forest_bg.png',
      speaker: '강신무',
      text: '신령이 속삭이고 있어. 이 안에 강력한 마기가 있다고... 내 칼이 불타오르고 있다.',
    },
    {
      bg: '/dungeons/demon_bg.png',
      speaker: '나레이션',
      text: '독안개 늪, 마왕성, 심해 유적... 각 던전의 마물은 신령의 힘을 가진 강신무조차 긴장하게 만든다.',
    },
    {
      bg: '/dungeons/demon_bg.png',
      speaker: '강신무',
      text: '좋아, 불꽃이여! 더 뜨겁게 타올라라. 이 어둠을 전부 태워버리겠다!',
    },
    {
      bg: '/dungeons/dungeon_map_bg.png',
      speaker: '나레이션',
      text: '강신무는 화염을 두른 신칼을 들고 던전으로 뛰어들었다. 티켓을 모아 각 던전의 최심부까지 도전해야 한다.',
    },
  ],
};

function DungeonCutscene({ charId, classType, onComplete }) {
  const scenes = DUNGEON_INTRO_SCENES[classType] || DUNGEON_INTRO_SCENES['풍수사'];
  const [sceneIdx, setSceneIdx] = useState(0);
  const [textVisible, setTextVisible] = useState('');
  const [textDone, setTextDone] = useState(false);
  const [fadeOut, setFadeOut] = useState(false);
  const timerRef = useRef(null);

  const scene = scenes[sceneIdx];

  useEffect(() => {
    setTextVisible('');
    setTextDone(false);
    const text = scene.text;
    let i = 0;
    timerRef.current = setInterval(() => {
      i++;
      setTextVisible(text.slice(0, i));
      if (i >= text.length) {
        clearInterval(timerRef.current);
        setTextDone(true);
      }
    }, 30);
    return () => clearInterval(timerRef.current);
  }, [sceneIdx]); // eslint-disable-line

  const handleClick = () => {
    if (!textDone) {
      clearInterval(timerRef.current);
      setTextVisible(scene.text);
      setTextDone(true);
      return;
    }
    if (sceneIdx < scenes.length - 1) {
      setSceneIdx(sceneIdx + 1);
    } else {
      setFadeOut(true);
      localStorage.setItem('dungeon_intro_seen_' + charId, '1');
      setTimeout(() => onComplete(), 600);
    }
  };

  return (
    <div className={`prologue-area${fadeOut ? ' fade-out' : ''}`} style={{ position: 'fixed', inset: 0, zIndex: 9999 }}>
      <div className="prologue-scene" onClick={handleClick}>
        <div className="prologue-bg">
          <img src={scene.bg} alt="" onError={(e) => { e.target.style.display = 'none'; }} />
          <div className="prologue-bg-overlay" />
        </div>
        <div className="prologue-chapter-title">
          <div className="prologue-chapter-label">던전 탐험</div>
          <div className="prologue-chapter-name">마물의 소굴</div>
        </div>
        <div className="prologue-progress">
          {scenes.map((_, i) => (
            <div key={i} className={`prologue-progress-dot${i <= sceneIdx ? ' active' : ''}`} />
          ))}
        </div>
        <div className="prologue-dialog">
          <div className="prologue-dialog-inner">
            <div className={`prologue-speaker${scene.speaker === '나레이션' ? ' narration' : ''}`}>
              {scene.speaker === '나레이션' ? '' : scene.speaker}
            </div>
            <div className="prologue-text">{textVisible}</div>
            {textDone && (
              <div className="prologue-next-hint">
                {sceneIdx < scenes.length - 1 ? '클릭하여 계속...' : '클릭하여 던전 목록으로...'}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// 던전별 테마 색상
const DUNGEON_THEMES = {
  forest: { accent: '#4ade80' },
  slime_cave: { accent: '#67e8f9' },
  cave: { accent: '#a78bfa' },
  swamp: { accent: '#a3e635' },
  goblin: { accent: '#fb923c' },
  mountain: { accent: '#94a3b8' },
  ocean: { accent: '#60a5fa' },
  spirit_forest: { accent: '#c084fc' },
  temple: { accent: '#f472b6' },
  demon: { accent: '#f87171' },
  dragon: { accent: '#fbbf24' },
  // 한국 던전
  kr_forest: { accent: '#86efac' },
  kr_mountain: { accent: '#bfdbfe' },
  kr_swamp: { accent: '#d9f99d' },
  kr_temple: { accent: '#fda4af' },
  kr_spirit: { accent: '#e9d5ff' },
  // 일본 던전
  jp_forest: { accent: '#fca5a5' },
  jp_mountain: { accent: '#fdba74' },
  jp_temple: { accent: '#f9a8d4' },
  jp_ocean: { accent: '#7dd3fc' },
  jp_spirit: { accent: '#d4d4d8' },
  // 중국 던전
  cn_forest: { accent: '#6ee7b7' },
  cn_mountain: { accent: '#fde68a' },
  cn_temple: { accent: '#fca5a5' },
  cn_swamp: { accent: '#bef264' },
  cn_spirit: { accent: '#c4b5fd' },
};

const ELEMENT_INFO = {
  fire:    { name: '불', icon: '🔥', color: '#ff6b35' },
  water:   { name: '물', icon: '💧', color: '#4da6ff' },
  earth:   { name: '땅', icon: '🪨', color: '#8bc34a' },
  wind:    { name: '바람', icon: '🌀', color: '#b388ff' },
  neutral: { name: '중립', icon: '⚪', color: '#9ca3af' },
};

const ELEMENT_TABLE = {
  fire:    { fire:1.0, water:0.5, earth:1.5, wind:1.5, neutral:1.0 },
  water:   { fire:2.0, water:1.0, earth:1.5, wind:0.5, neutral:1.0 },
  earth:   { fire:0.5, water:0.5, earth:1.0, wind:2.0, neutral:1.0 },
  wind:    { fire:1.5, water:2.0, earth:0.5, wind:1.0, neutral:1.0 },
  neutral: { fire:1.0, water:1.0, earth:1.0, wind:1.0, neutral:1.0 },
};

const AI_TYPE_INFO = {
  aggressive: { label: '공격형', icon: '⚔️', color: '#ef4444' },
  defensive: { label: '방어형', icon: '🛡️', color: '#3b82f6' },
  ranged: { label: '원거리형', icon: '🏹', color: '#a855f7' },
  support: { label: '지원형', icon: '💚', color: '#22c55e' },
  boss: { label: '보스', icon: '👑', color: '#f59e0b' },
  coward: { label: '도주형', icon: '💨', color: '#94a3b8' },
};

const SKILL_TYPE_COLORS = { attack: '#ef4444', heal: '#22c55e', buff: '#f59e0b', debuff: '#a855f7', aoe: '#f97316' };

function DungeonImg({ src, fallback, className, alt }) {
  const [err, setErr] = useState(false);
  if (err) return fallback ? <span className={className}>{fallback}</span> : null;
  return <img src={src} alt={alt || ''} className={className} onError={() => setErr(true)} />;
}

function DungeonArea({ character, charState, mySummons, activeSummonIds, onToggleSummon, onStartBattle, returnDungeonKey, onReturnHandled, contentCharges }) {
  const charId = charState?.id || character?.id;
  const classType = character?.class_type || '풍수사';
  const seenKey = 'dungeon_intro_seen_' + charId;
  const [showCutscene, setShowCutscene] = useState(() => !localStorage.getItem(seenKey));
  const [dungeons, setDungeons] = useState([]);
  const [selectedDungeon, setSelectedDungeon] = useState(null);
  const [dungeonDetail, setDungeonDetail] = useState(null);
  const [loading, setLoading] = useState(true);
  const [monsterPopup, setMonsterPopup] = useState(null);
  const [monsterSkills, setMonsterSkills] = useState([]);
  const [monsterDrops, setMonsterDrops] = useState([]);
  const [popupImgLoaded, setPopupImgLoaded] = useState(false);
  const [stagePopup, setStagePopup] = useState(null);

  useEffect(() => {
    async function loadDungeons() {
      try {
        const res = await api.get('/dungeon/list');
        setDungeons(res.data.dungeons);

        if (returnDungeonKey) {
          const target = res.data.dungeons.find(d => d.key_name === returnDungeonKey);
          if (target) {
            setSelectedDungeon(target);
            try {
              const detailRes = await api.get(`/dungeon/${returnDungeonKey}`);
              setDungeonDetail(detailRes.data);
            } catch {}
          }
          if (onReturnHandled) onReturnHandled();
        }
      } catch (err) {
        console.error('Failed to load dungeons:', err);
      }
      setLoading(false);
    }
    loadDungeons();
  }, []); // eslint-disable-line

  const selectDungeon = async (dungeon) => {
    setSelectedDungeon(dungeon);
    try {
      const res = await api.get(`/dungeon/${dungeon.key_name}`);
      setDungeonDetail(res.data);
    } catch (err) {
      console.error('Failed to load dungeon detail:', err);
    }
  };

  const handleStageClick = (stage) => {
    if (!dungeonDetail) return;
    const clearedStage = dungeonDetail.clearedStage || 0;
    if (stage.stageNumber > clearedStage + 1) return;
    setStagePopup(stage);
  };

  const handleStartBattle = (useAutoPath = false) => {
    if (!stagePopup || !dungeonDetail) return;
    if ((selectedDungeon?.ticketCount || 0) <= 0) return;
    // 로컬 티켓 카운트 차감 (서버에서 실제 차감은 Home.js에서 처리)
    setSelectedDungeon(prev => prev ? { ...prev, ticketCount: Math.max(0, (prev.ticketCount || 0) - 1) } : prev);
    setDungeons(prev => prev.map(d => d.key_name === selectedDungeon.key_name ? { ...d, ticketCount: Math.max(0, (d.ticketCount || 0) - 1) } : d));
    const stageData = useAutoPath ? { ...stagePopup, autoPath: true } : stagePopup;
    setStagePopup(null);
    onStartBattle(selectedDungeon.key_name, stageData);
  };

  const handleBack = () => {
    setSelectedDungeon(null);
    setDungeonDetail(null);
  };

  const openMonsterPopup = async (m) => {
    setMonsterPopup(m);
    setPopupImgLoaded(false);
    setMonsterSkills([]);
    setMonsterDrops([]);
    try {
      const res = await api.get(`/monsters/${m.id}`);
      const detail = res.data.monster;
      detail.image_url = `/monsters/${detail.id}_full.png`;
      setMonsterPopup(detail);
      setMonsterSkills(res.data.skills || []);
      setMonsterDrops(res.data.drops || []);
    } catch (err) {
      console.error('Monster detail error:', err);
    }
  };

  if (loading) return <div className="dg-loading">던전 목록 로딩 중...</div>;

  if (showCutscene) {
    return <DungeonCutscene charId={charId} classType={classType} onComplete={() => setShowCutscene(false)} />;
  }

  // 던전 상세 - 스테이지 로드맵
  if (selectedDungeon && dungeonDetail) {
    const clearedStage = dungeonDetail.clearedStage || 0;
    const stages = dungeonDetail.stages || [];
    const dungeon = dungeonDetail.dungeon;
    const dungeonIdx = dungeons.findIndex(d => d.key_name === selectedDungeon.key_name);
    const theme = DUNGEON_THEMES[selectedDungeon.key_name] || DUNGEON_THEMES.forest;

    return (
      <div className="dg-detail">
        <button className="dg-back-btn" onClick={handleBack}>
          ← 던전 목록
        </button>

        <div className="dg-detail-header" style={{ '--dg-accent': theme.accent }}>
          <div className="dg-detail-banner">
            <DungeonImg src={`/dungeons/${selectedDungeon.key_name}_banner.png`} alt={dungeon.name} className="dg-detail-banner-img" />
            <div className="dg-detail-banner-overlay" />
          </div>
          <div className="dg-detail-info">
            <span className="dg-detail-label" style={{ color: theme.accent }}>Dungeon {dungeonIdx + 1}</span>
            <h3>{dungeon.name}</h3>
            <p>{dungeon.description}</p>
            <div className="dg-detail-stats">
              <Badge bg="warning" text="dark" className="dg-detail-lv">Lv.{dungeon.requiredLevel}+</Badge>
              <span className="dg-detail-progress-text">
                진행도 <strong>{clearedStage}</strong> / {stages.length}
              </span>
            </div>
          </div>
        </div>

        <div className="dg-roadmap">
          <div className="dg-roadmap-header">
            <div className="dg-roadmap-title-area">
              <span className="dg-roadmap-title">스테이지 로드맵</span>
              <span className="dg-roadmap-label">Dungeon {dungeonIdx + 1}</span>
            </div>
            <span className="dg-roadmap-progress">{clearedStage} / {stages.length}</span>
          </div>

          <div className="dg-progress-bar">
            <div
              className="dg-progress-fill"
              style={{ width: `${stages.length > 0 ? (clearedStage / stages.length) * 100 : 0}%` }}
            />
            <div className="dg-progress-glow" style={{ left: `${stages.length > 0 ? (clearedStage / stages.length) * 100 : 0}%` }} />
          </div>

          <div className="dg-roadmap-track-v">
            <div className="dg-roadmap-path-line" style={{
              '--path-progress': `${stages.length > 1 ? (clearedStage / (stages.length - 1)) * 100 : 0}%`
            }} />
            {stages.map((stage, idx) => {
              const isCleared = stage.stageNumber <= clearedStage;
              const isUnlocked = stage.stageNumber <= clearedStage + 1;
              const isCurrent = stage.stageNumber === clearedStage + 1;
              const isLeft = idx % 2 === 0;

              return (
                <div
                  key={stage.id}
                  className={`dg-row ${isLeft ? 'left' : 'right'} ${stage.isBoss ? 'boss-row' : ''}`}
                >
                  <div className={`dg-path-dot ${isCleared ? 'cleared' : ''} ${isCurrent ? 'current' : ''} ${stage.isBoss ? 'boss' : ''}`}>
                    <span>{stage.isBoss ? '💀' : stage.stageNumber}</span>
                  </div>
                  <div
                    className={`dg-node ${stage.isBoss ? 'boss' : ''} ${isCleared ? 'cleared' : ''} ${isCurrent ? 'current' : ''} ${!isUnlocked ? 'locked' : ''}`}
                    onClick={() => isUnlocked && handleStageClick(stage)}
                    style={{ '--dg-accent': theme.accent }}
                  >
                    <div className="dg-node-bg">
                      <DungeonImg
                        src={`/dungeons/levels/${selectedDungeon.key_name}_${stage.stageNumber}.png`}
                        fallback={null}
                        alt=""
                        className="dg-node-bg-img"
                      />
                      <div className={`dg-node-bg-overlay ${stage.isBoss ? 'boss-overlay' : ''}`} />
                    </div>
                    {stage.isBoss && (
                      <div className="dg-boss-frame">
                        <div className="dg-boss-tag">BOSS</div>
                        <div className="dg-boss-horns" />
                      </div>
                    )}
                    <div className="dg-node-inner">
                      <div className="dg-node-number">
                        {stage.isBoss ? '💀' : `${dungeonIdx + 1}-${stage.stageNumber}`}
                      </div>
                      <div className="dg-node-name">{stage.name}</div>
                      {stage.description && <div className="dg-node-desc">{stage.description}</div>}
                    </div>
                    {isCleared && <div className="dg-node-check">✓</div>}
                    {isCurrent && !isCleared && <div className="dg-node-arrow">▶</div>}
                    {!isUnlocked && <div className="dg-node-lock">🔒</div>}
                    <div className="dg-node-rewards">
                      <span className="dg-reward-exp">EXP +{stage.rewardExpBonus}</span>
                      <span className="dg-reward-gold">Gold +{stage.rewardGoldBonus}</span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          <div className="dg-monsters">
            <div className="dg-section-title">
              <span className="dg-section-icon">👹</span>
              출현 몬스터
            </div>
            <div className="dg-monster-list">
              {(dungeonDetail.monsters || []).slice(0, 12).map((m) => (
                <div key={m.id} className="dg-monster-card" onClick={() => openMonsterPopup(m)} role="button">
                  <div className="dg-monster-img-wrap">
                    <img src={`/monsters/${m.id}_icon.png`} alt="" className="dg-monster-img" onError={(e) => { e.target.style.display='none'; e.target.parentNode.innerHTML = `<span style="font-size:1.4rem">${m.icon}</span>`; }} />
                  </div>
                  <div className="dg-monster-info">
                    <span className="dg-monster-name">{m.name}</span>
                    <div className="dg-monster-stats">
                      <span>HP {m.hp}</span>
                      <span>공 {m.phys_attack || 0}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* 스테이지 상세 팝업 */}
        {stagePopup && (
          <div className="dg-popup-overlay" onClick={() => setStagePopup(null)}>
            <div className="dg-popup" onClick={e => e.stopPropagation()}>
              <button className="dg-popup-close" onClick={() => setStagePopup(null)}>&times;</button>
              <div className="dg-popup-banner">
                <img
                  src={`/dungeons/levels/${selectedDungeon.key_name}_${stagePopup.stageNumber}.png`}
                  alt={stagePopup.name}
                  className="dg-popup-banner-img"
                  onError={e => { e.target.style.display = 'none'; }}
                />
                <div className="dg-popup-banner-overlay" />
                {stagePopup.isBoss && <div className="dg-popup-boss-tag">BOSS</div>}
                <div className="dg-popup-title-area">
                  <span className="dg-popup-chapter">{dungeonIdx + 1}-{stagePopup.stageNumber}</span>
                  <h3 className="dg-popup-name">{stagePopup.name}</h3>
                </div>
              </div>
              <div className="dg-popup-body">
                <p className="dg-popup-desc">{stagePopup.description || '알려진 정보가 없습니다.'}</p>
                <div className="dg-popup-info-grid">
                  <div className="dg-popup-info-item">
                    <span className="dg-popup-info-label">몬스터 수</span>
                    <span className="dg-popup-info-value">{stagePopup.monsterCount}마리</span>
                  </div>
                  <div className="dg-popup-info-item">
                    <span className="dg-popup-info-label">레벨 보너스</span>
                    <span className="dg-popup-info-value">+{stagePopup.monsterLevelBonus}</span>
                  </div>
                  <div className="dg-popup-info-item">
                    <span className="dg-popup-info-label">경험치</span>
                    <span className="dg-popup-info-value dg-popup-exp">+{stagePopup.rewardExpBonus} EXP</span>
                  </div>
                  <div className="dg-popup-info-item">
                    <span className="dg-popup-info-label">골드</span>
                    <span className="dg-popup-info-value dg-popup-gold">+{stagePopup.rewardGoldBonus}G</span>
                  </div>
                  <div className="dg-popup-info-item">
                    <span className="dg-popup-info-label">맵 크기</span>
                    <span className="dg-popup-info-value">{stagePopup.mapWidth}x{stagePopup.mapHeight}</span>
                  </div>
                  <div className="dg-popup-info-item">
                    <span className="dg-popup-info-label">지형</span>
                    <span className="dg-popup-info-value">{{ grass: '초원', stone: '바위', dirt: '흙', water: '물', dark: '암흑' }[stagePopup.baseTileType] || stagePopup.baseTileType}</span>
                  </div>
                </div>
                <div className="dg-popup-ticket-info">
                  <span className="dg-popup-ticket-label">입장권</span>
                  <span className={`dg-popup-ticket-count ${(selectedDungeon?.ticketCount || 0) > 0 ? 'has' : 'empty'}`}>
                    {selectedDungeon?.ticketIcon || '🎫'} {selectedDungeon?.ticketCount || 0}장 보유
                  </span>
                </div>
                {contentCharges && selectedDungeon && stagePopup && (() => {
                  const ck = contentCharges[`dungeon_${selectedDungeon.key_name}_${stagePopup.stageNumber}`] || { charges: 5, maxCharges: 5, cooldown: 0 };
                  return (
                  <div className="stage-popup-charges" style={{marginBottom:'8px'}}>
                    입장 횟수: {[...Array(ck.maxCharges || 5)].map((_, i) => (
                      <span key={i} className={`charge-pip ${i < (ck.charges ?? 5) ? 'active' : 'empty'}`} />
                    ))}
                    <span className="charge-count">{ck.charges ?? 5}/{ck.maxCharges || 5}</span>
                    {ck.charges === 0 && ck.cooldown > 0 && (
                      <span className="charge-cooldown">충전까지 {Math.floor(ck.cooldown / 3600000)}시간 {Math.floor((ck.cooldown % 3600000) / 60000)}분</span>
                    )}
                  </div>
                  );
                })()}
                {(() => {
                  const ck = (selectedDungeon && stagePopup) ? (contentCharges?.[`dungeon_${selectedDungeon.key_name}_${stagePopup.stageNumber}`] || { charges: 5 }) : { charges: 5 };
                  const isCleared = stagePopup.stageNumber <= clearedStage;
                  const canStart = (selectedDungeon?.ticketCount || 0) > 0 && ck.charges > 0;
                  return (
                  <>
                  <button
                    className={`dg-popup-start-btn ${!canStart ? 'disabled' : ''}`}
                    onClick={() => handleStartBattle(false)}
                    disabled={!canStart}
                  >
                    {ck.charges === 0 ? '입장 횟수 부족' : (selectedDungeon?.ticketCount || 0) > 0 ? `⚔️ 전투 시작 (입장권 1장 + 행동력 2 소모)` : '🎫 입장권이 부족합니다'}
                  </button>
                  {isCleared && (
                    <button
                      className={`dg-popup-auto-btn ${!canStart ? 'disabled' : ''}`}
                      onClick={() => handleStartBattle(true)}
                      disabled={!canStart}
                    >
                      🧭 자동길찾기 (클리어 던전)
                    </button>
                  )}
                  </>
                  );
                })()}
              </div>
            </div>
          </div>
        )}

        {/* 몬스터 상세 팝업 */}
        {monsterPopup && (
          <div className="bd-overlay" onClick={() => setMonsterPopup(null)}>
            <div className="bd-modal" onClick={e => e.stopPropagation()}>
              <button className="bd-close" onClick={() => setMonsterPopup(null)}>&times;</button>
              <div className="bd-header">
                <div className="bd-header-bg">
                  <img src={`/monsters/${monsterPopup.id}_full.png`} alt="" className="bd-header-bg-img" onError={e => { e.target.style.display='none'; }} />
                  <div className="bd-header-gradient" />
                </div>
                <div className="bd-header-content">
                  <div className="bd-portrait">
                    {!popupImgLoaded && <div className="bd-portrait-placeholder">{monsterPopup.icon}</div>}
                    <img src={`/monsters/${monsterPopup.id}_full.png`} alt={monsterPopup.name}
                      onLoad={() => setPopupImgLoaded(true)}
                      onError={e => { e.target.style.display='none'; }}
                      style={popupImgLoaded ? {} : { display: 'none' }}
                    />
                  </div>
                  <div className="bd-header-info">
                    <div className="bd-name-row">
                      <h2 className="bd-name">{monsterPopup.name}</h2>
                    </div>
                    <div className="bd-tags">
                      {monsterPopup.element && ELEMENT_INFO[monsterPopup.element] && (
                        <span className="bd-tag" style={{ borderColor: ELEMENT_INFO[monsterPopup.element].color, color: ELEMENT_INFO[monsterPopup.element].color }}>
                          {ELEMENT_INFO[monsterPopup.element].icon} {ELEMENT_INFO[monsterPopup.element].name}
                        </span>
                      )}
                      {monsterPopup.ai_type && AI_TYPE_INFO[monsterPopup.ai_type] && (
                        <span className="bd-tag" style={{ borderColor: AI_TYPE_INFO[monsterPopup.ai_type].color, color: AI_TYPE_INFO[monsterPopup.ai_type].color }}>
                          {AI_TYPE_INFO[monsterPopup.ai_type].icon} {AI_TYPE_INFO[monsterPopup.ai_type].label}
                        </span>
                      )}
                    </div>
                    <p className="bd-desc">{monsterPopup.description || ''}</p>
                  </div>
                </div>
              </div>
              <div className="bd-body">
                <div className="bd-section">
                  <h3 className="bd-section-title">전투 능력치</h3>
                  <div className="bd-stats">
                    {[
                      { label: 'HP', value: monsterPopup.hp, max: 1000, icon: '❤️', cls: 'hp' },
                      { label: 'MP', value: monsterPopup.mp || 0, max: 100, icon: '💎', cls: 'mp' },
                      { label: '물공', value: monsterPopup.phys_attack || 0, max: 50, icon: '⚔️', cls: 'atk' },
                      { label: '마공', value: monsterPopup.mag_attack || 0, max: 50, icon: '✨', cls: 'atk' },
                      { label: '물방', value: monsterPopup.phys_defense || 0, max: 50, icon: '🛡️', cls: 'def' },
                      { label: '마방', value: monsterPopup.mag_defense || 0, max: 50, icon: '🔮', cls: 'def' },
                    ].map(stat => (
                      <div className="bd-stat-row" key={stat.label}>
                        <span className="bd-stat-icon">{stat.icon}</span>
                        <span className="bd-stat-label">{stat.label}</span>
                        <div className="bd-stat-bar-wrap">
                          <div className={`bd-stat-bar bd-stat-bar-${stat.cls}`}
                            style={{ width: `${Math.min((stat.value / stat.max) * 100, 100)}%` }} />
                        </div>
                        <span className={`bd-stat-value bd-sv-${stat.cls}`}>{stat.value}</span>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="bd-section">
                  <h3 className="bd-section-title">정예 등급 정보</h3>
                  <p className="bd-elite-desc">이 몬스터가 정예로 등장할 경우 예상 능력치입니다.</p>
                  <div className="bd-elite-tiers">
                    {ELITE_TIERS.map(tier => (
                      <div key={tier.key} className="bd-elite-tier" style={{ '--elite-color': tier.color }}>
                        <div className="bd-elite-tier-header">
                          <span className="bd-elite-tier-icon">{tier.icon}</span>
                          <span className="bd-elite-tier-label" style={{ color: tier.color }}>{tier.label}</span>
                          <span className="bd-elite-tier-chance">{Math.round(tier.chance * 100)}%</span>
                        </div>
                        <div className="bd-elite-tier-stats">
                          <span className="bd-elite-stat">❤️ HP {Math.floor((monsterPopup.hp || 0) * tier.mult)}</span>
                          <span className="bd-elite-stat">💎 MP {Math.floor((monsterPopup.mp || 0) * tier.mult)}</span>
                          <span className="bd-elite-stat">⚔️ 물공 {Math.floor((monsterPopup.phys_attack || 0) * tier.mult)}</span>
                          <span className="bd-elite-stat">🛡️ 물방 {Math.floor((monsterPopup.phys_defense || 0) * tier.mult)}</span>
                          <span className="bd-elite-stat">✨ 마공 {Math.floor((monsterPopup.mag_attack || 0) * tier.mult)}</span>
                          <span className="bd-elite-stat">🔮 마방 {Math.floor((monsterPopup.mag_defense || 0) * tier.mult)}</span>
                          <span className="bd-elite-stat">💥 치명 {Math.floor((monsterPopup.crit_rate || 0) * tier.mult)}</span>
                          <span className="bd-elite-stat">💨 회피 {Math.floor((monsterPopup.evasion || 0) * tier.mult)}</span>
                        </div>
                        <div className="bd-elite-tier-rewards">
                          <span className="bd-elite-reward">EXP x{tier.rewardMult}</span>
                          <span className="bd-elite-reward">Gold x{tier.rewardMult}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {monsterPopup.element && monsterPopup.element !== 'neutral' && ELEMENT_INFO[monsterPopup.element] && (
                  <div className="bd-section">
                    <h3 className="bd-section-title">속성 상성</h3>
                    <div className="bd-element-info">
                      <div className="bd-element-current">
                        <span className="bd-element-icon" style={{ color: ELEMENT_INFO[monsterPopup.element].color }}>{ELEMENT_INFO[monsterPopup.element].icon}</span>
                        <span className="bd-element-name" style={{ color: ELEMENT_INFO[monsterPopup.element].color }}>{ELEMENT_INFO[monsterPopup.element].name} 속성</span>
                      </div>
                      <div className="bd-element-relations">
                        {Object.entries(ELEMENT_TABLE[monsterPopup.element]).filter(([el]) => el !== 'neutral' && el !== monsterPopup.element).map(([el, mult]) => {
                          const info = ELEMENT_INFO[el];
                          const defMult = ELEMENT_TABLE[el]?.[monsterPopup.element] ?? 1.0;
                          return (
                            <div key={el} className="bd-element-row">
                              <span style={{ color: info.color, fontSize: 16 }}>{info.icon}</span>
                              <span className="bd-element-rel-name" style={{ color: info.color }}>{info.name}</span>
                              <div className="bd-element-mults">
                                <span className={`bd-element-mult ${mult > 1 ? 'strong' : mult < 1 ? 'weak' : ''}`}>공격 x{mult}</span>
                                <span className={`bd-element-mult ${defMult > 1 ? 'weak' : defMult < 1 ? 'strong' : ''}`}>피격 x{defMult}</span>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                )}

                {monsterSkills.length > 0 && (
                  <div className="bd-section">
                    <h3 className="bd-section-title">보유 스킬</h3>
                    <div className="bd-skills">
                      {monsterSkills.map(skill => (
                        <div className="bd-skill" key={skill.id} style={{ '--skill-color': SKILL_TYPE_COLORS[skill.type] || '#888' }}>
                          <div className="bd-skill-icon">{skill.icon}</div>
                          <div className="bd-skill-info">
                            <div className="bd-skill-header">
                              <span className="bd-skill-name">{skill.name}</span>
                              <span className="bd-skill-type" style={{ color: SKILL_TYPE_COLORS[skill.type] }}>
                                {skill.type === 'attack' ? '공격' : skill.type === 'heal' ? '치유' : skill.type === 'buff' ? '버프' : skill.type === 'debuff' ? '디버프' : '광역'}
                              </span>
                            </div>
                            <div className="bd-skill-desc">{skill.description}</div>
                            <div className="bd-skill-meta">
                              <span>💎 MP {skill.mp_cost || 0}</span>
                              {skill.damage_multiplier > 1 && <span>⚔️ x{skill.damage_multiplier}</span>}
                              {skill.heal_amount > 0 && <span>💚 +{skill.heal_amount}</span>}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {monsterDrops.length > 0 && (
                  <div className="bd-section">
                    <h3 className="bd-section-title">드랍 아이템</h3>
                    <div className="bd-drops">
                      {monsterDrops.map((drop, i) => {
                        const pct = Math.round(drop.drop_rate * 100);
                        const gradeColor = { '일반': '#9ca3af', '고급': '#4ade80', '희귀': '#60a5fa', '영웅': '#c084fc', '전설': '#fbbf24', '신화': '#ff6b6b' }[drop.grade] || '#9ca3af';
                        return (
                          <div className="bd-drop" key={i}>
                            <div className="bd-drop-icon">{drop.icon}</div>
                            <div className="bd-drop-info">
                              <div className="bd-drop-name" style={{ color: gradeColor }}>
                                {drop.name} <span className="bd-drop-grade">[{drop.grade}]</span>
                              </div>
                            </div>
                            <span className={`bd-drop-rate-text ${pct >= 30 ? 'high' : pct >= 15 ? 'mid' : 'low'}`}>{pct}%</span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  // 던전 목록 - 세로 로드맵
  const totalCleared = dungeons.filter(d => d.unlocked && (d.clearedStage || 0) >= (d.totalStages || 10)).length;
  return (
    <div className="dg-scene">
      <div className="dg-scene-bg">
        <div className="dg-scene-bg-img" style={{ backgroundImage: 'url(/dungeons/dungeon_map_bg.png)' }} />
        <div className="dg-scene-bg-overlay" />
      </div>
      <div className="dg-title-area">
        <div className="dg-title">던전 탐험</div>
      </div>
      <div className="dg-subtitle">어둠의 심연에 도전하라 ({totalCleared}/{dungeons.length})</div>

      {/* 보유 입장권 요약 */}
      {dungeons.some(d => (d.ticketCount || 0) > 0) && (
        <div className="dg-ticket-summary">
          <div className="dg-ticket-summary-label">🎫 보유 입장권</div>
          <div className="dg-ticket-summary-list">
            {dungeons.filter(d => (d.ticketCount || 0) > 0).map(d => {
              const theme = DUNGEON_THEMES[d.key_name] || DUNGEON_THEMES.forest;
              return (
                <div key={d.id} className="dg-ticket-chip" style={{ borderColor: theme.accent }} onClick={() => !d.unlocked ? null : selectDungeon(d)}>
                  <span className="dg-ticket-chip-icon">{d.ticketIcon || '🎫'}</span>
                  <span className="dg-ticket-chip-name">{d.name}</span>
                  <span className="dg-ticket-chip-count" style={{ color: theme.accent }}>{d.ticketCount}장</span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      <div className="dg-list-roadmap">
        <div className="dg-list-path" style={{
          '--list-progress': `${dungeons.length > 1 ? (totalCleared / (dungeons.length - 1)) * 100 : 0}%`
        }} />
        {dungeons.map((d, idx) => {
          const locked = !d.unlocked;
          const progress = d.clearedStage || 0;
          const total = d.totalStages || 10;
          const isComplete = progress >= total && total > 0;
          const prevName = idx > 0 ? dungeons[idx - 1].name : null;
          const theme = DUNGEON_THEMES[d.key_name] || DUNGEON_THEMES.forest;
          const isLeft = idx % 2 === 0;

          return (
            <div key={d.id} className={`dg-list-row ${isLeft ? 'left' : 'right'}`}>
              <div className={`dg-list-dot ${isComplete ? 'complete' : ''} ${!locked && !isComplete ? 'active' : ''} ${locked ? 'locked' : ''}`}>
                <span>{isComplete ? '✓' : locked ? '🔒' : idx + 1}</span>
              </div>
              <div
                className={`dg-card ${locked ? 'locked' : ''} ${isComplete ? 'complete' : ''}`}
                onClick={() => !locked && selectDungeon(d)}
                style={{ '--dg-accent': theme.accent }}
              >
                <div className="dg-card-img-wrap">
                  <DungeonImg src={`/dungeons/${d.key_name}_card.png`} alt={d.name} className="dg-card-img" />
                  <div className="dg-card-chapter">Dungeon {idx + 1}</div>
                  <div className="dg-card-glow" />
                  {locked && (
                    <div className="dg-card-lock-overlay">
                      <span className="dg-card-lock-icon">🔒</span>
                      {prevName && <span className="dg-card-lock-text">{prevName} 클리어 필요</span>}
                    </div>
                  )}
                  {isComplete && <div className="dg-card-complete-badge">완료</div>}
                </div>
                <div className="dg-card-info">
                  <div className="dg-card-label" style={{ color: theme.accent }}>{d.icon}</div>
                  <div className="dg-card-name">{d.name}</div>
                  <div className="dg-card-desc">{d.description}</div>
                  <div className="dg-card-meta">
                    <Badge bg="warning" text="dark" className="dg-card-lv">Lv.{d.required_level}+</Badge>
                    <span className={`dg-card-ticket ${(d.ticketCount || 0) > 0 ? 'has' : 'empty'}`}>
                      {d.ticketIcon || '🎫'} {d.ticketCount || 0}
                    </span>
                    <span className="dg-card-progress-text">{progress}/{total}</span>
                  </div>
                  <div className="dg-card-progress-bar">
                    <div
                      className="dg-card-progress-fill"
                      style={{ width: `${total > 0 ? (progress / total) * 100 : 0}%` }}
                    />
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default DungeonArea;
