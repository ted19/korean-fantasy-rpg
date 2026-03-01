import React, { useState, useEffect } from 'react';
import { Badge } from 'react-bootstrap';
import api from '../api';
import './DungeonArea.css';
import './MonsterBestiary.css';

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

function DungeonArea({ charState, mySummons, activeSummonIds, onToggleSummon, onStartBattle, returnDungeonKey, onReturnHandled }) {
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

  const handleStartBattle = () => {
    if (!stagePopup || !dungeonDetail) return;
    setStagePopup(null);
    onStartBattle(selectedDungeon.key_name, stagePopup);
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

          {mySummons && mySummons.length > 0 && (
            <div className="dg-summons">
              <div className="dg-section-title">
                <span className="dg-section-icon">⚔️</span>
                소환수 동행
                <span className="dg-section-count">({activeSummonIds.length}/{mySummons.length})</span>
              </div>
              <div className="dg-summon-list">
                {mySummons.map((s) => (
                  <button
                    key={s.id}
                    className={`dg-summon-btn ${activeSummonIds.includes(s.id) ? 'active' : ''}`}
                    onClick={() => onToggleSummon(s.id)}
                  >
                    <span className="dg-summon-img-wrap">
                      <img src={`/summons/${s.template_id}_icon.png`} alt="" className="dg-summon-img" onError={(e)=>{e.target.style.display='none'; e.target.parentNode.textContent=s.icon}}/>
                    </span>
                    <span className="dg-summon-info">
                      <span className="dg-summon-name">{s.name}</span>
                      <span className="dg-summon-lv">Lv.{s.level}</span>
                    </span>
                    {activeSummonIds.includes(s.id) && <span className="dg-summon-check">✓</span>}
                  </button>
                ))}
              </div>
            </div>
          )}

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
                <button className="dg-popup-start-btn" onClick={handleStartBattle}>
                  ⚔️ 전투 시작
                </button>
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
        <img src="/dungeons/dungeon_map_bg.png" alt="던전 월드맵" className="dg-scene-bg-img" />
        <div className="dg-scene-bg-overlay" />
      </div>
      <div className="dg-title-area">
        <div className="dg-title">던전 탐험</div>
      </div>
      <div className="dg-subtitle">어둠의 심연에 도전하라 ({totalCleared}/{dungeons.length})</div>

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
