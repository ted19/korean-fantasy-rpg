import React, { useState } from 'react';
import { Row, Col, Card, Button } from 'react-bootstrap';
import api from '../api';
import Shop from './Shop';
import Quest from './Quest';
import Summon from './Summon';
import BlacksmithArea from './BlacksmithArea';
import InnArea from './InnArea';
import FortuneArea from './FortuneArea';

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
];

function VillageArea({ character, charState, onCharStateUpdate, onLog, onSummonsChanged, onMercenariesChanged, initialView, initialViewData, onInitialViewConsumed }) {
  const [activeView, setActiveView] = useState(initialView || null);
  const [viewData, setViewData] = useState(initialViewData || null);

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
      inn: <InnArea charState={charState} onCharStateUpdate={onCharStateUpdate} onLog={onLog} onMercenariesChanged={onMercenariesChanged} />,
      shop: <Shop character={character} charState={charState} onCharStateUpdate={onCharStateUpdate} onLog={onLog} />,
      blacksmith: <BlacksmithArea charState={charState} onCharStateUpdate={onCharStateUpdate} onLog={onLog} />,
      quest: <Quest charState={charState} onCharStateUpdate={onCharStateUpdate} onLog={onLog} />,
      summon: <Summon charState={charState} onCharStateUpdate={onCharStateUpdate} onLog={onLog} initialSummonId={viewData?.summonId} />,
      fortune: <FortuneArea charState={charState} onCharStateUpdate={onCharStateUpdate} onLog={onLog} />,
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
              <div className="village-building-img-wrap">
                <img
                  src={`/village/${action.id}_card.png`}
                  alt={action.name}
                  className="village-building-img"
                  onError={(e) => { e.target.style.display='none'; }}
                />
                <div className="village-building-glow" />
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
