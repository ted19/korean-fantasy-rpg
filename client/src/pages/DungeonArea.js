import React, { useState, useEffect } from 'react';
import { Row, Col, Badge, Button } from 'react-bootstrap';
import api from '../api';
import './DungeonArea.css';

function DungeonImg({ keyName, type, fallback, className }) {
  const [err, setErr] = useState(false);
  if (err || !keyName) return <span className={className}>{fallback}</span>;
  return <img src={`/dungeons/${keyName}_${type}.png`} alt="" className={className} onError={() => setErr(true)} />;
}

function DungeonArea({ charState, mySummons, activeSummonIds, onToggleSummon, onStartBattle }) {
  const [dungeons, setDungeons] = useState([]);
  const [selectedDungeon, setSelectedDungeon] = useState(null);
  const [dungeonDetail, setDungeonDetail] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadDungeons() {
      try {
        const res = await api.get('/dungeon/list');
        setDungeons(res.data.dungeons);
      } catch (err) {
        console.error('Failed to load dungeons:', err);
      }
      setLoading(false);
    }
    loadDungeons();
  }, []);

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
    onStartBattle(selectedDungeon.key_name, stage);
  };

  const handleBack = () => {
    setSelectedDungeon(null);
    setDungeonDetail(null);
  };

  if (loading) return <div className="dungeon-loading">던전 목록 로딩 중...</div>;

  // 던전 상세 - 스테이지 로드맵
  if (selectedDungeon && dungeonDetail) {
    const clearedStage = dungeonDetail.clearedStage || 0;
    const stages = dungeonDetail.stages || [];

    return (
      <div className="dungeon-detail">
        <Button variant="outline-secondary" size="sm" className="mb-3" onClick={handleBack}>← 던전 목록</Button>
        <div className="dungeon-detail-header">
          <DungeonImg keyName={selectedDungeon.key_name} type="icon" fallback={selectedDungeon.icon} className="dungeon-detail-img" />
          <div>
            <h3>{selectedDungeon.name}</h3>
            <p>{selectedDungeon.description}</p>
          </div>
        </div>

        <div className="dungeon-roadmap">
          <div className="roadmap-title">스테이지 로드맵</div>
          <div className="roadmap-progress">
            진행도: {clearedStage} / {stages.length}
          </div>
          <div className="roadmap-track">
            {stages.map((stage, idx) => {
              const isCleared = stage.stageNumber <= clearedStage;
              const isUnlocked = stage.stageNumber <= clearedStage + 1;
              const isCurrent = stage.stageNumber === clearedStage + 1;

              return (
                <React.Fragment key={stage.id}>
                  {idx > 0 && (
                    <div className={`roadmap-connector ${isCleared ? 'cleared' : ''}`} />
                  )}
                  <div
                    className={`roadmap-node ${stage.isBoss ? 'boss' : ''} ${isCleared ? 'cleared' : ''} ${isCurrent ? 'current' : ''} ${!isUnlocked ? 'locked' : ''}`}
                    onClick={() => isUnlocked && handleStageClick(stage)}
                    title={!isUnlocked ? '이전 스테이지를 클리어하세요' : stage.isBoss ? '보스 스테이지!' : `스테이지 ${stage.stageNumber}`}
                  >
                    <div className="roadmap-node-inner">
                      {!isUnlocked && <span className="roadmap-lock">🔒</span>}
                      {isCleared && <span className="roadmap-check">✓</span>}
                      {isCurrent && !isCleared && <span className="roadmap-arrow">▶</span>}
                      {stage.isBoss ? (
                        <span className="roadmap-boss-icon">💀</span>
                      ) : (
                        <span className="roadmap-stage-num">{stage.stageNumber}</span>
                      )}
                    </div>
                    <div className="roadmap-node-label">
                      {stage.isBoss ? 'BOSS' : `${stage.stageNumber}`}
                    </div>
                    {stage.isBoss && (
                      <div className="roadmap-boss-tag">보스</div>
                    )}
                  </div>
                </React.Fragment>
              );
            })}
          </div>

          {mySummons && mySummons.length > 0 && (
            <div className="roadmap-summons">
              <div className="roadmap-info-title">소환수 동행 ({activeSummonIds.length}/{mySummons.length})</div>
              <div className="roadmap-summon-list">
                {mySummons.map((s) => (
                  <button
                    key={s.id}
                    className={`summon-select-btn ${activeSummonIds.includes(s.id) ? 'active' : ''}`}
                    onClick={() => onToggleSummon(s.id)}
                  >
                    <span className="summon-select-icon"><img src={`/summons/${s.template_id}_icon.png`} alt="" style={{width:24,height:24,borderRadius:4}} onError={(e)=>{e.target.style.display='none'; e.target.parentNode.textContent=s.icon}}/></span>
                    <span className="summon-select-name">{s.name}</span>
                    <span className="summon-select-lv">Lv.{s.level}</span>
                    {activeSummonIds.includes(s.id) && <span className="summon-select-check">✓</span>}
                  </button>
                ))}
              </div>
            </div>
          )}

          <div className="roadmap-info">
            <div className="roadmap-monsters">
              <div className="roadmap-info-title">출현 몬스터</div>
              <div className="roadmap-monster-list">
                {(dungeonDetail.monsters || []).map((m) => (
                  <Badge key={m.id} bg="dark" className="roadmap-monster-tag border border-secondary">
                    <span>{m.icon}</span> {m.name}
                    <span className="roadmap-monster-stat"> HP:{m.hp} 물공:{m.phys_attack || 0} 마공:{m.mag_attack || 0} 이동:{m.moveRange || 3}</span>
                  </Badge>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // 던전 목록 - 맵 스타일
  return (
    <div className="dungeon-scene">
      <div className="dungeon-map-bg">
        <img src="/dungeons/dungeon_map_bg.png" alt="던전 월드맵" className="dungeon-map-bg-img" />
        <div className="dungeon-map-bg-overlay" />
      </div>
      <div className="dungeon-map-title">던전</div>
      <Row className="g-3 dungeon-map-grid">
        {dungeons.map((d, idx) => {
          const locked = !d.unlocked;
          const progress = d.clearedStage || 0;
          const total = d.totalStages || 10;
          const prevName = idx > 0 ? dungeons[idx - 1].name : null;
          return (
            <Col xs={6} sm={4} lg={3} key={d.id}>
              <div
                className={`dungeon-map-card ${locked ? 'locked' : ''} ${progress >= total ? 'cleared' : ''}`}
                onClick={() => !locked && selectDungeon(d)}
              >
                <div className="dungeon-map-card-img-wrap">
                  <img
                    src={`/dungeons/${d.key_name}_card.png`}
                    alt={d.name}
                    className="dungeon-map-card-img"
                    onError={(e) => { e.target.style.display = 'none'; }}
                  />
                  <div className="dungeon-map-card-glow" />
                  {locked && (
                    <div className="dungeon-map-lock-overlay">
                      <span className="dungeon-map-lock-icon">🔒</span>
                      <span className="dungeon-map-lock-text">{prevName ? `${prevName} 클리어 필요` : ''}</span>
                    </div>
                  )}
                  {progress >= total && (
                    <div className="dungeon-map-clear-badge">완료</div>
                  )}
                </div>
                <div className="dungeon-map-card-info">
                  <div className="dungeon-map-card-name">{d.name}</div>
                  <div className="dungeon-map-card-meta">
                    <Badge bg="warning" text="dark" className="dungeon-map-lv-badge">Lv.{d.required_level}+</Badge>
                    <span className="dungeon-map-progress">{progress}/{total}</span>
                  </div>
                </div>
              </div>
            </Col>
          );
        })}
      </Row>
    </div>
  );
}

export default DungeonArea;
