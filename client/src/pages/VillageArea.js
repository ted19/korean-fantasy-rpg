import React, { useState } from 'react';
import { Row, Col, Card, Button } from 'react-bootstrap';
import api from '../api';
import Shop from './Shop';
import Quest from './Quest';
import Summon from './Summon';

function VillageImg({ id, fallback, className }) {
  const [err, setErr] = useState(false);
  if (err) return <span className={className}>{fallback}</span>;
  return <img src={`/village/${id}_icon.png`} alt="" className={className} onError={() => setErr(true)} />;
}

const VILLAGE_ACTIONS = [
  { id: 'rest', name: '여관', icon: '🛌', desc: 'HP/MP를 완전히 회복합니다.' },
  { id: 'shop', name: '상점', icon: '🛒', desc: '아이템을 사고팔 수 있습니다.' },
  { id: 'quest', name: '길드', icon: '📜', desc: '퀘스트를 확인합니다.' },
  { id: 'summon', name: '소환술사의 집', icon: '👻', desc: '소환수를 고용하고 관리합니다.' },
];

function VillageArea({ character, charState, onCharStateUpdate, onLog, onSummonsChanged }) {
  const [activeView, setActiveView] = useState(null);

  const handleRest = async () => {
    try {
      const res = await api.post('/battle/rest');
      const c = res.data.character;
      onCharStateUpdate({
        currentHp: c.current_hp ?? c.hp,
        currentMp: c.current_mp ?? c.mp,
      });
      onLog('여관에서 푹 쉬었습니다. HP/MP가 완전히 회복되었습니다!', 'heal');
    } catch {
      onLog('휴식에 실패했습니다.', 'damage');
    }
  };

  const handleBack = () => {
    if (activeView === 'summon' && onSummonsChanged) onSummonsChanged();
    setActiveView(null);
  };

  const handleAction = (id) => {
    if (id === 'rest') return handleRest();
    setActiveView(id);
  };

  if (activeView) {
    const maxWidth = activeView === 'summon' ? 900 : undefined;
    const Content = {
      shop: <Shop character={character} charState={charState} onCharStateUpdate={onCharStateUpdate} onLog={onLog} />,
      quest: <Quest charState={charState} onCharStateUpdate={onCharStateUpdate} onLog={onLog} />,
      summon: <Summon charState={charState} onCharStateUpdate={onCharStateUpdate} onLog={onLog} />,
    }[activeView];

    return (
      <div className="shop-wrapper" style={maxWidth ? { maxWidth } : undefined}>
        <Button variant="outline-secondary" size="sm" className="mb-3" onClick={handleBack}>
          &larr; 마을로 돌아가기
        </Button>
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
