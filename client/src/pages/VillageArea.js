import React, { useState, useEffect, useRef } from 'react';
import { Row, Col } from 'react-bootstrap';
import api from '../api';
import Shop from './Shop';
import Quest from './Quest';
import Summon from './Summon';
import BlacksmithArea from './BlacksmithArea';
import InnArea from './InnArea';
import FortuneArea from './FortuneArea';
import CasinoArea from './CasinoArea';

const VILLAGE_SCENES = [
  {
    bg: '/village/village_bg.png',
    speaker: '나레이션',
    text: '황혼이 내려앉은 길을 따라 걸으니, 저 멀리 희미한 불빛이 보인다. 폐허 같은 마을... 그래도 살아있는 곳이다.',
  },
  {
    bg: '/village/village_bg.png',
    speaker: '나레이션',
    text: '바람에 실려 오는 건 피와 약초 냄새가 뒤섞인 공기. 어딘가에서 대장간의 망치 소리가 끊임없이 울려 퍼진다.',
  },
  {
    bg: '/village/village_bg.png',
    speaker: '???',
    text: '...또 한 명의 모험자인가. 살아서 돌아온 것만으로도 대단하군.',
  },
  {
    bg: '/village/village_bg.png',
    speaker: '마을 경비병',
    text: '여기는 최전선이다. 편히 쉴 곳은 여관뿐이고, 필요한 건 상점에서 구하게. 오래 살고 싶다면 길드의 의뢰도 챙기고.',
  },
  {
    bg: '/village/village_bg.png',
    speaker: '나레이션',
    text: '낡은 간판들이 삐걱이는 거리. 여관, 상점, 대장간, 길드... 이곳이 앞으로의 거점이 될 것이다.',
  },
];

function VillageCutscene({ charId, onComplete }) {
  const [sceneIdx, setSceneIdx] = useState(0);
  const [textVisible, setTextVisible] = useState('');
  const [textDone, setTextDone] = useState(false);
  const [fadeOut, setFadeOut] = useState(false);
  const timerRef = useRef(null);

  const scene = VILLAGE_SCENES[sceneIdx];

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
  }, [sceneIdx]);

  const handleClick = () => {
    if (!textDone) {
      clearInterval(timerRef.current);
      setTextVisible(scene.text);
      setTextDone(true);
      return;
    }
    if (sceneIdx < VILLAGE_SCENES.length - 1) {
      setSceneIdx(sceneIdx + 1);
    } else {
      setFadeOut(true);
      localStorage.setItem('village_intro_seen_' + charId, '1');
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
          <div className="prologue-chapter-label">마을 도착</div>
          <div className="prologue-chapter-name">최전선의 거점</div>
        </div>
        <div className="prologue-progress">
          {VILLAGE_SCENES.map((_, i) => (
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
                {sceneIdx < VILLAGE_SCENES.length - 1 ? '클릭하여 계속...' : '클릭하여 마을로 진입...'}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function VillageImg({ id, fallback, className }) {
  const [err, setErr] = useState(false);
  if (err) return <span className={className}>{fallback}</span>;
  return <img src={`/village/${id}_icon.png`} alt="" className={className} onError={() => setErr(true)} />;
}

const VILLAGE_ACTIONS = [
  { id: 'inn', name: '여관', icon: '🛌', desc: '용병 고용과 휴식을 합니다.' },
  { id: 'shop', name: '상점', icon: '🛒', desc: '아이템을 사고팔 수 있습니다.' },
  { id: 'blacksmith', name: '대장간', icon: '⚒️', desc: '장비 제작과 강화를 합니다.' },
  { id: 'quest', name: '길드', icon: '📜', desc: '퀘스트를 확인합니다.' },
  { id: 'summon', name: '소환술사의 집', icon: '👻', desc: '소환수를 고용하고 관리합니다.' },
  { id: 'fortune', name: '운명술사의 집', icon: '🔮', desc: '운세, 점괘, 부적으로 힘을 얻습니다.' },
  { id: 'casino', name: '도깨비 노름방', icon: '🎲', desc: '운을 시험하여 골드를 벌어보세요!' },
];

function VillageArea({ character, charState, onCharStateUpdate, onLog, onSummonsChanged, onMercenariesChanged, initialView, initialViewData, onInitialViewConsumed }) {
  const charId = charState?.id || character?.id;
  const seenKey = 'village_intro_seen_' + charId;
  const [showCutscene, setShowCutscene] = useState(() => !localStorage.getItem(seenKey));
  const [activeView, setActiveView] = useState(initialView || null);
  const [viewData, setViewData] = useState(initialViewData || null);
  const [questAlert, setQuestAlert] = useState(0); // 보상 대기 + 수락 가능 퀘스트 수

  React.useEffect(() => {
    api.get('/characters/daily-guide').then(r => {
      setQuestAlert(r.data.pendingRewards || 0);
    }).catch(() => {});
  }, [activeView]); // 시설에서 돌아올 때마다 갱신

  React.useEffect(() => {
    if (initialView) {
      setActiveView(initialView);
      setViewData(initialViewData || null);
      if (onInitialViewConsumed) onInitialViewConsumed();
    }
  }, [initialView]);

  const handleBack = () => {
    if (activeView === 'summon' && onSummonsChanged) onSummonsChanged();
    if (activeView === 'inn' && onMercenariesChanged) onMercenariesChanged();
    setActiveView(null);
    setViewData(null);
  };

  const handleAction = (id) => {
    setActiveView(id);
  };

  if (activeView) {
    const maxWidth = activeView === 'summon' ? 900 : undefined;
    const Content = {
      inn: <InnArea charState={charState} onCharStateUpdate={onCharStateUpdate} onLog={onLog} onMercenariesChanged={onMercenariesChanged} initialTab={viewData?.initialTab} />,
      shop: <Shop character={character} charState={charState} onCharStateUpdate={onCharStateUpdate} onLog={onLog} />,
      blacksmith: <BlacksmithArea charState={charState} onCharStateUpdate={onCharStateUpdate} onLog={onLog} />,
      quest: <Quest charState={charState} onCharStateUpdate={onCharStateUpdate} onLog={onLog} />,
      summon: <Summon charState={charState} onCharStateUpdate={onCharStateUpdate} onLog={onLog} initialSummonId={viewData?.summonId} />,
      fortune: <FortuneArea charState={charState} onCharStateUpdate={onCharStateUpdate} onLog={onLog} />,
      casino: <CasinoArea charState={charState} onCharStateUpdate={onCharStateUpdate} onLog={onLog} />,
    }[activeView];

    return (
      <div className="shop-wrapper" style={maxWidth ? { maxWidth } : undefined}>
        <button className="village-back-btn" onClick={handleBack}>
          ← 마을로 돌아가기
        </button>
        {Content}
      </div>
    );
  }

  return (
    <div className="village-scene">
      {showCutscene && (
        <VillageCutscene charId={charId} onComplete={() => setShowCutscene(false)} />
      )}
      <div className="village-bg">
        <img src="/village/village_bg.png" alt="마을" className="village-bg-img" />
        <div className="village-bg-overlay" />
      </div>
      <div className="village-title">마을</div>
      <Row className="g-3 village-buildings">
        {VILLAGE_ACTIONS.map((action) => (
          <Col xs={6} lg={3} key={action.id}>
            <div
              className="village-building"
              onClick={() => handleAction(action.id)}
            >
              <div className={`village-building-img-wrap ${action.id === 'quest' && questAlert > 0 ? 'quest-alert-glow' : ''}`}>
                <img
                  src={`/village/${action.id}_card.png`}
                  alt={action.name}
                  className="village-building-img"
                  onError={(e) => { e.target.style.display='none'; }}
                />
                <div className="village-building-glow" />
                {action.id === 'quest' && questAlert > 0 && (
                  <div className="village-quest-badge">{questAlert}</div>
                )}
              </div>
              <div className="village-building-info">
                <div className="village-building-name">{action.name}</div>
                <div className="village-building-desc">{action.desc}</div>
              </div>
            </div>
          </Col>
        ))}
      </Row>
    </div>
  );
}

export default VillageArea;
