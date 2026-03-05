import React, { useState, useEffect } from 'react';
import { Row, Col, Badge } from 'react-bootstrap';
import api from '../api';
import './StageArea.css';
import './MonsterBestiary.css';

// 기본 accent (서버에서 못 받아올 때 fallback)
const DEFAULT_ACCENT = '#4ade80';

function StageImg({ src, fallback, className, alt }) {
  const [err, setErr] = useState(false);
  if (err) return fallback ? <span className={className}>{fallback}</span> : null;
  return <img src={src} alt={alt || ''} className={className} onError={() => setErr(true)} />;
}

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

function StageArea({ charState, onStartStageBattle, returnGroupKey, onReturnHandled }) {
  const [groups, setGroups] = useState([]);
  const [selectedGroup, setSelectedGroup] = useState(null);
  const [groupDetail, setGroupDetail] = useState(null);
  const [loading, setLoading] = useState(true);
  const [monsterPopup, setMonsterPopup] = useState(null);
  const [monsterSkills, setMonsterSkills] = useState([]);
  const [monsterDrops, setMonsterDrops] = useState([]);
  const [popupImgLoaded, setPopupImgLoaded] = useState(false);
  const [stagePopup, setStagePopup] = useState(null);
  const [countryIdx, setCountryIdx] = useState(0);
  const [countries, setCountries] = useState([]);

  useEffect(() => {
    async function loadData() {
      try {
        const [groupsRes, countriesRes] = await Promise.all([
          api.get('/stage/groups'),
          api.get('/stage/countries'),
        ]);
        setGroups(groupsRes.data.groups);
        setCountries(countriesRes.data.countries || []);

        if (returnGroupKey) {
          const target = groupsRes.data.groups.find(g => g.key === returnGroupKey);
          if (target) {
            // 해당 그룹의 국가 인덱스로 이동
            const cList = countriesRes.data.countries || [];
            const cIdx = cList.findIndex(c => c.key === target.country);
            if (cIdx >= 0) setCountryIdx(cIdx);
            setSelectedGroup(target);
            try {
              const detailRes = await api.get(`/stage/group/${returnGroupKey}`);
              setGroupDetail(detailRes.data);
            } catch {}
          }
          if (onReturnHandled) onReturnHandled();
        }
      } catch (err) {
        console.error('Failed to load stage data:', err);
      }
      setLoading(false);
    }
    loadData();
  }, []); // eslint-disable-line

  const selectGroup = async (group) => {
    setSelectedGroup(group);
    try {
      const res = await api.get(`/stage/group/${group.key}`);
      setGroupDetail(res.data);
    } catch (err) {
      console.error('Failed to load group detail:', err);
    }
  };

  const handleStageClick = (stage) => {
    if (!groupDetail) return;
    const clearedStage = groupDetail.clearedStage || 0;
    if (stage.stageNumber > clearedStage + 1) return;
    setStagePopup(stage);
  };

  const handleStartBattle = () => {
    if (!stagePopup || !groupDetail) return;
    setStagePopup(null);
    onStartStageBattle(selectedGroup.key, stagePopup, groupDetail.monsters);
  };

  const handleBack = () => {
    setSelectedGroup(null);
    setGroupDetail(null);
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

  if (loading) return <div className="stage-loading">스테이지 로딩 중...</div>;

  // 그룹 상세 - 스테이지 로드맵
  if (selectedGroup && groupDetail) {
    const clearedStage = groupDetail.clearedStage || 0;
    const stages = groupDetail.stages || [];
    const group = groupDetail.group;
    const groupIdx = groups.findIndex(g => g.key === selectedGroup.key);
    const theme = { accent: selectedGroup.accentColor || DEFAULT_ACCENT };

    return (
      <div className="stage-detail">
        <button className="stage-back-btn" onClick={handleBack}>
          ← 스테이지 목록
        </button>

        <div className="stage-detail-header" style={{ '--era-accent': theme.accent }}>
          <div className="stage-detail-banner">
            <StageImg src={`/stages/${selectedGroup.key}_banner.png`} alt={group.name} className="stage-detail-banner-img" />
            <div className="stage-detail-banner-overlay" />
          </div>
          <div className="stage-detail-info">
            <span className="stage-detail-era" style={{ color: theme.accent }}>{group.era}</span>
            <h3>{group.name}</h3>
            <p>{group.description}</p>
            <div className="stage-detail-stats">
              <Badge bg="warning" text="dark" className="stage-detail-lv">Lv.{group.requiredLevel}+</Badge>
              <span className="stage-detail-progress-text">
                진행도 <strong>{clearedStage}</strong> / {stages.length}
              </span>
            </div>
          </div>
        </div>

        <div className="stage-roadmap">
          <div className="stage-roadmap-header">
            <div className="stage-roadmap-title-area">
              <span className="stage-roadmap-title">스테이지 로드맵</span>
              <span className="stage-roadmap-chapter">Chapter {groupIdx + 1}</span>
            </div>
            <span className="stage-roadmap-progress">{clearedStage} / {stages.length}</span>
          </div>

          <div className="stage-progress-bar">
            <div
              className="stage-progress-fill"
              style={{ width: `${stages.length > 0 ? (clearedStage / stages.length) * 100 : 0}%` }}
            />
            <div className="stage-progress-glow" style={{ left: `${stages.length > 0 ? (clearedStage / stages.length) * 100 : 0}%` }} />
          </div>

          <div className="stage-roadmap-track">
            {stages.map((stage, idx) => {
              const isCleared = stage.stageNumber <= clearedStage;
              const isUnlocked = stage.stageNumber <= clearedStage + 1;
              const isCurrent = stage.stageNumber === clearedStage + 1;

              return (
                <React.Fragment key={stage.id}>
                  {idx > 0 && (
                    <div className={`stage-connector ${isCleared ? 'cleared' : ''} ${stage.isBoss ? 'boss-connector' : ''}`}>
                      <div className="stage-connector-line" />
                      {isCleared && <div className="stage-connector-dot" />}
                    </div>
                  )}
                  <div
                    className={`stage-node ${stage.isBoss ? 'boss' : ''} ${isCleared ? 'cleared' : ''} ${isCurrent ? 'current' : ''} ${!isUnlocked ? 'locked' : ''}`}
                    onClick={() => isUnlocked && handleStageClick(stage)}
                    style={{ '--era-accent': theme.accent }}
                  >
                    <div className="stage-node-bg">
                      <StageImg
                        src={`/stages/levels/${selectedGroup.key}_${stage.stageNumber}.png`}
                        fallback={null}
                        alt=""
                        className="stage-node-bg-img"
                      />
                      <div className={`stage-node-bg-overlay ${stage.isBoss ? 'boss-overlay' : ''}`} />
                    </div>
                    {stage.isBoss && (
                      <div className="stage-boss-frame">
                        <div className="stage-boss-tag">BOSS</div>
                        <div className="stage-boss-horns" />
                      </div>
                    )}
                    <div className="stage-node-inner">
                      <div className="stage-node-number">
                        {stage.isBoss ? '💀' : `${groupIdx + 1}-${stage.stageNumber}`}
                      </div>
                      <div className="stage-node-name">{stage.name}</div>
                    </div>
                    {isCleared && <div className="stage-node-check">✓</div>}
                    {isCurrent && !isCleared && <div className="stage-node-arrow">▶</div>}
                    {!isUnlocked && <div className="stage-node-lock">🔒</div>}
                    <div className="stage-node-rewards">
                      <span className="stage-reward-exp">EXP {stage.rewardExp}</span>
                      <span className="stage-reward-gold">Gold {stage.rewardGold}</span>
                    </div>
                  </div>
                </React.Fragment>
              );
            })}
          </div>

          <div className="stage-monsters">
            <div className="stage-section-title">
              <span className="stage-section-icon">👹</span>
              출현 몬스터
            </div>
            <div className="stage-monster-list">
              {(groupDetail.monsters || []).slice(0, 12).map((m) => (
                <div key={m.id} className="stage-monster-card" onClick={() => openMonsterPopup(m)} role="button">
                  <div className="stage-monster-img-wrap">
                    <img src={`/monsters/${m.id}_icon.png`} alt="" className="stage-monster-img" onError={(e) => { e.target.style.display='none'; e.target.parentNode.innerHTML = `<span style="font-size:1.4rem">${m.icon}</span>`; }} />
                  </div>
                  <div className="stage-monster-info">
                    <span className="stage-monster-name">{m.name}</span>
                    <div className="stage-monster-stats">
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
          <div className="stage-popup-overlay" onClick={() => setStagePopup(null)}>
            <div className="stage-popup" onClick={e => e.stopPropagation()}>
              <button className="stage-popup-close" onClick={() => setStagePopup(null)}>&times;</button>
              <div className="stage-popup-banner">
                <img
                  src={`/stages/levels/${selectedGroup.key}_${stagePopup.stageNumber}.png`}
                  alt={stagePopup.name}
                  className="stage-popup-banner-img"
                  onError={e => { e.target.style.display = 'none'; }}
                />
                <div className="stage-popup-banner-overlay" />
                {stagePopup.isBoss && <div className="stage-popup-boss-tag">BOSS</div>}
                <div className="stage-popup-title-area">
                  <span className="stage-popup-chapter">{groups.findIndex(g => g.key === selectedGroup.key) + 1}-{stagePopup.stageNumber}</span>
                  <h3 className="stage-popup-name">{stagePopup.name}</h3>
                </div>
              </div>
              <div className="stage-popup-body">
                <p className="stage-popup-desc">{stagePopup.description || '알려진 정보가 없습니다.'}</p>
                <div className="stage-popup-info-grid">
                  <div className="stage-popup-info-item">
                    <span className="stage-popup-info-label">몬스터 수</span>
                    <span className="stage-popup-info-value">{stagePopup.monsterCount}마리</span>
                  </div>
                  <div className="stage-popup-info-item">
                    <span className="stage-popup-info-label">몬스터 레벨</span>
                    <span className="stage-popup-info-value">Lv.{stagePopup.monsterLevelMin}~{stagePopup.monsterLevelMax}</span>
                  </div>
                  <div className="stage-popup-info-item">
                    <span className="stage-popup-info-label">경험치</span>
                    <span className="stage-popup-info-value stage-popup-exp">+{stagePopup.rewardExp} EXP</span>
                  </div>
                  <div className="stage-popup-info-item">
                    <span className="stage-popup-info-label">골드</span>
                    <span className="stage-popup-info-value stage-popup-gold">+{stagePopup.rewardGold}G</span>
                  </div>
                  <div className="stage-popup-info-item">
                    <span className="stage-popup-info-label">맵 크기</span>
                    <span className="stage-popup-info-value">{stagePopup.mapWidth}x{stagePopup.mapHeight}</span>
                  </div>
                  <div className="stage-popup-info-item">
                    <span className="stage-popup-info-label">지형</span>
                    <span className="stage-popup-info-value">{{ grass: '초원', stone: '바위', dirt: '흙', water: '물', dark: '암흑' }[stagePopup.baseTileType] || stagePopup.baseTileType}</span>
                  </div>
                </div>
                <button className="stage-popup-start-btn" onClick={handleStartBattle}>
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

  // 현재 국가 (DB에서 가져온 countries 사용)
  const currentCountry = countries[countryIdx] || countries[0];
  const filteredGroups = currentCountry
    ? groups.filter(g => g.country === currentCountry.key)
    : groups;

  // 이전/다음 국가 해금 여부 확인
  const isCountryLocked = (cIdx) => {
    if (cIdx === 0) return false;
    const prevC = countries[cIdx - 1];
    if (!prevC) return true;
    const prevGroups = groups.filter(g => g.country === prevC.key);
    if (prevGroups.length === 0) return true;
    const lastGroup = prevGroups[prevGroups.length - 1];
    return !(lastGroup.clearedStage >= lastGroup.totalStages && lastGroup.totalStages > 0);
  };

  const prevCountry = () => setCountryIdx(i => Math.max(0, i - 1));
  const nextCountry = () => {
    if (countryIdx < countries.length - 1) setCountryIdx(i => i + 1);
  };

  // 그룹 목록 - 좌우 화살표 국가 전환
  return (
    <div className="stage-scene">
      <div className="stage-scene-bg">
        <img src="/stages/stage_map_bg.png" alt="스테이지 월드맵" className="stage-scene-bg-img" />
        <div className="stage-scene-bg-overlay" />
      </div>
      {/* 국가 네비게이션 - 좌우 화살표 */}
      <div className="stage-country-nav">
        <button
          className="stage-country-arrow left"
          onClick={prevCountry}
          disabled={countryIdx === 0}
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            <polyline points="15 18 9 12 15 6"/>
          </svg>
        </button>

        <div className="stage-country-center">
          <div className="stage-country-indicator">
            {countries.map((c, i) => (
              <span
                key={c.key}
                className={`stage-country-dot ${i === countryIdx ? 'active' : ''} ${isCountryLocked(i) ? 'locked' : ''}`}
                onClick={() => !isCountryLocked(i) && setCountryIdx(i)}
              />
            ))}
          </div>
          <div className="stage-country-title">{currentCountry.name}</div>
          <div className="stage-country-subtitle">{currentCountry.subtitle}</div>
          {isCountryLocked(countryIdx) && (
            <div className="stage-country-locked-msg">
              이전 국가 스테이지를 모두 클리어하면 해금됩니다
            </div>
          )}
        </div>

        <button
          className="stage-country-arrow right"
          onClick={nextCountry}
          disabled={countryIdx >= countries.length - 1}
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            <polyline points="9 18 15 12 9 6"/>
          </svg>
        </button>
      </div>

      <Row className="g-3 stage-grid">
        {filteredGroups.map((g, idx) => {
          const locked = !g.unlocked;
          const progress = g.clearedStage || 0;
          const total = g.totalStages || 0;
          const isComplete = progress >= total && total > 0;
          const prevName = idx > 0 ? filteredGroups[idx - 1].name : null;
          const accent = g.accentColor || DEFAULT_ACCENT;

          return (
            <Col xs={6} sm={4} lg={3} key={g.id}>
              <div
                className={`stage-card ${locked ? 'locked' : ''} ${isComplete ? 'complete' : ''}`}
                onClick={() => !locked && selectGroup(g)}
                style={{ '--group-color': g.bgColor, '--era-accent': accent }}
              >
                <div className="stage-card-img-wrap">
                  <StageImg src={`/stages/${g.key}_card.png`} alt={g.name} className="stage-card-img" />
                  <div className="stage-card-chapter">Chapter {idx + 1}</div>
                  <div className="stage-card-glow" />
                  {locked && (
                    <div className="stage-card-lock-overlay">
                      <span className="stage-card-lock-icon">🔒</span>
                      {prevName && <span className="stage-card-lock-text">{prevName} 클리어 필요</span>}
                    </div>
                  )}
                  {isComplete && <div className="stage-card-complete-badge">완료</div>}
                </div>
                <div className="stage-card-info">
                  <div className="stage-card-era" style={{ color: accent }}>{g.era}</div>
                  <div className="stage-card-name">{g.name}</div>
                  <div className="stage-card-desc">{g.description}</div>
                  <div className="stage-card-meta">
                    <Badge bg="warning" text="dark" className="stage-card-lv">Lv.{g.requiredLevel}+</Badge>
                    <span className="stage-card-progress-text">{progress}/{total}</span>
                  </div>
                  <div className="stage-card-progress-bar">
                    <div
                      className="stage-card-progress-fill"
                      style={{ width: `${total > 0 ? (progress / total) * 100 : 0}%` }}
                    />
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

export default StageArea;
