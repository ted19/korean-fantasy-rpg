import React, { useState, useEffect, useCallback } from 'react';
import { Row, Col, Form, Nav } from 'react-bootstrap';
import api from '../api';
import './MonsterBestiary.css';

const AI_TYPE_INFO = {
  aggressive: { label: '공격형', icon: '⚔️', color: '#ef4444' },
  defensive: { label: '방어형', icon: '🛡️', color: '#3b82f6' },
  ranged: { label: '원거리형', icon: '🏹', color: '#a855f7' },
  support: { label: '지원형', icon: '💚', color: '#22c55e' },
  boss: { label: '보스', icon: '👑', color: '#f59e0b' },
  coward: { label: '도주형', icon: '💨', color: '#94a3b8' },
};

const SKILL_TYPE_COLORS = {
  attack: '#ef4444',
  heal: '#22c55e',
  buff: '#f59e0b',
  debuff: '#a855f7',
  aoe: '#f97316',
};

function MonsterBestiary() {
  const [categories, setCategories] = useState([]);
  const [monsters, setMonsters] = useState([]);
  const [selectedCat, setSelectedCat] = useState(null);
  const [selectedTier, setSelectedTier] = useState(null);
  const [searchText, setSearchText] = useState('');
  const [selectedMonster, setSelectedMonster] = useState(null);
  const [monsterSkills, setMonsterSkills] = useState([]);
  const [loading, setLoading] = useState(true);
  const [imageLoading, setImageLoading] = useState({});
  const [detailImgLoaded, setDetailImgLoaded] = useState(false);

  useEffect(() => {
    api.get('/monsters/categories').then(r => setCategories(r.data.categories)).catch(() => {});
  }, []);

  const loadMonsters = useCallback(async () => {
    setLoading(true);
    try {
      const params = {};
      if (selectedCat) params.category_id = selectedCat;
      if (selectedTier) params.tier = selectedTier;
      if (searchText) params.search = searchText;
      const res = await api.get('/monsters/encyclopedia', { params });
      setMonsters(res.data.monsters);
    } catch {
      setMonsters([]);
    }
    setLoading(false);
  }, [selectedCat, selectedTier, searchText]);

  useEffect(() => { loadMonsters(); }, [loadMonsters]);

  const openDetail = async (m) => {
    setSelectedMonster(m);
    setDetailImgLoaded(false);
    setMonsterSkills([]);
    try {
      const res = await api.get(`/monsters/${m.id}`);
      const detail = res.data.monster;
      detail.image_url = `/monsters/${detail.id}_full.png`;
      detail.icon_url = `/monsters/${detail.id}_icon.png`;
      setSelectedMonster(detail);
      setMonsterSkills(res.data.skills || []);
    } catch (err) {
      console.error('Monster detail load error:', err);
    }
  };

  const closeDetail = () => {
    setSelectedMonster(null);
    setMonsterSkills([]);
  };

  const handleImageLoad = (id) => {
    setImageLoading(prev => ({ ...prev, [id]: 'loaded' }));
  };
  const handleImageError = (id) => {
    setImageLoading(prev => ({ ...prev, [id]: 'error' }));
  };

  const tierStars = (tier) => {
    const stars = [];
    for (let i = 0; i < Math.min(tier, 10); i++) {
      stars.push(<span key={i} className={`tier-star ${tier >= 8 ? 'legendary' : tier >= 5 ? 'epic' : tier >= 3 ? 'rare' : ''}`}>&#9733;</span>);
    }
    return stars;
  };

  const tierColor = (tier) => {
    if (tier >= 8) return '#ff6b00';
    if (tier >= 5) return '#a855f7';
    if (tier >= 3) return '#3b82f6';
    return '#9ca3af';
  };

  const tierLabel = (tier) => {
    if (tier >= 8) return '전설';
    if (tier >= 5) return '영웅';
    if (tier >= 3) return '희귀';
    return '일반';
  };

  const sm = selectedMonster;

  return (
    <div className="bestiary-container">
      <h2 className="bestiary-title">몬스터 도감</h2>
      <div className="bestiary-count">{monsters.length}종 발견</div>

      {/* 필터 영역 */}
      <div className="bestiary-filters">
        <div className="bestiary-filter-row">
          <Nav variant="pills" className="flex-wrap gap-1">
            <Nav.Item>
              <Nav.Link active={!selectedCat} onClick={() => setSelectedCat(null)} className="py-1 px-2">
                전체
              </Nav.Link>
            </Nav.Item>
            {categories.map(c => (
              <Nav.Item key={c.id}>
                <Nav.Link
                  active={selectedCat === c.id}
                  onClick={() => setSelectedCat(selectedCat === c.id ? null : c.id)}
                  className="py-1 px-2"
                  title={c.description}
                >
                  {c.icon} {c.name}
                </Nav.Link>
              </Nav.Item>
            ))}
          </Nav>
        </div>
        <div className="bestiary-filter-row">
          <Form.Select
            size="sm"
            value={selectedTier || ''}
            onChange={e => setSelectedTier(e.target.value ? Number(e.target.value) : null)}
            style={{ width: 'auto', minWidth: 100 }}
          >
            <option value="">전체 등급</option>
            {[1,2,3,4,5,6,7,8,9,10].map(t => (
              <option key={t} value={t}>Tier {t}</option>
            ))}
          </Form.Select>
          <Form.Control
            size="sm"
            type="text"
            placeholder="몬스터 이름 검색..."
            value={searchText}
            onChange={e => setSearchText(e.target.value)}
            className="flex-grow-1"
            style={{ minWidth: 120 }}
          />
        </div>
      </div>

      {/* 몬스터 그리드 */}
      {loading ? (
        <div className="bestiary-loading">로딩중...</div>
      ) : monsters.length === 0 ? (
        <div className="bestiary-empty">조건에 맞는 몬스터가 없습니다.</div>
      ) : (
        <Row className="bestiary-grid g-2">
          {monsters.map(m => (
            <Col xs={6} sm={4} md={3} lg={2} key={m.id}>
              <div
                className="bestiary-card"
                onClick={() => openDetail(m)}
                style={{ borderColor: tierColor(m.tier) }}
              >
                <div className="bestiary-card-img">
                  {imageLoading[m.id] !== 'loaded' && (
                    <div className="bestiary-img-placeholder">
                      <span className="bestiary-icon-large">{m.icon}</span>
                    </div>
                  )}
                  <img
                    src={m.icon_url}
                    alt={m.name}
                    onLoad={() => handleImageLoad(m.id)}
                    onError={() => handleImageError(m.id)}
                    style={imageLoading[m.id] === 'loaded' ? {} : { display: 'none' }}
                  />
                </div>
                <div className="bestiary-card-info">
                  <div className="bestiary-card-name">{m.name}</div>
                  <div className="bestiary-card-tier">{tierStars(m.tier)}</div>
                  <div className="bestiary-card-cat">{m.category_icon} {m.category_name || ''}</div>
                </div>
              </div>
            </Col>
          ))}
        </Row>
      )}

      {/* 상세 모달 - 커스텀 오버레이 */}
      {sm && (
        <div className="bd-overlay" onClick={closeDetail}>
          <div className="bd-modal" onClick={e => e.stopPropagation()}>
            <button className="bd-close" onClick={closeDetail}>&times;</button>

            {/* 상단: 이미지 + 기본 정보 */}
            <div className="bd-header" style={{ '--tier-color': tierColor(sm.tier) }}>
              <div className="bd-header-bg">
                <img
                  src={sm.image_url}
                  alt=""
                  className="bd-header-bg-img"
                  onError={(e) => { e.target.style.display='none'; }}
                />
                <div className="bd-header-gradient" />
              </div>
              <div className="bd-header-content">
                <div className="bd-portrait">
                  {!detailImgLoaded && (
                    <div className="bd-portrait-placeholder">{sm.icon}</div>
                  )}
                  <img
                    src={sm.image_url}
                    alt={sm.name}
                    onLoad={() => setDetailImgLoaded(true)}
                    onError={(e) => { e.target.style.display='none'; }}
                    style={detailImgLoaded ? {} : { display: 'none' }}
                  />
                </div>
                <div className="bd-header-info">
                  <div className="bd-name-row">
                    <h2 className="bd-name">{sm.name}</h2>
                    <span className="bd-tier-badge" style={{ background: tierColor(sm.tier) }}>
                      {tierLabel(sm.tier)} Tier {sm.tier}
                    </span>
                  </div>
                  <div className="bd-stars">{tierStars(sm.tier)}</div>
                  <div className="bd-tags">
                    <span className="bd-tag bd-tag-category">
                      {sm.category_icon} {sm.category_name || '미분류'}
                    </span>
                    {sm.ai_type && AI_TYPE_INFO[sm.ai_type] && (
                      <span className="bd-tag" style={{ borderColor: AI_TYPE_INFO[sm.ai_type].color, color: AI_TYPE_INFO[sm.ai_type].color }}>
                        {AI_TYPE_INFO[sm.ai_type].icon} {AI_TYPE_INFO[sm.ai_type].label}
                      </span>
                    )}
                    <span className="bd-tag bd-tag-dungeon">
                      📍 {sm.dungeon_name || '알 수 없음'}
                    </span>
                  </div>
                  <p className="bd-desc">{sm.description || '알려진 정보가 없습니다.'}</p>
                </div>
              </div>
            </div>

            {/* 스탯 바 영역 */}
            <div className="bd-body">
              <div className="bd-section">
                <h3 className="bd-section-title">전투 능력치</h3>
                <div className="bd-stats">
                  {[
                    { label: 'HP', value: sm.hp, max: 1000, icon: '❤️', cls: 'hp' },
                    { label: 'MP', value: sm.mp || 0, max: 100, icon: '💎', cls: 'mp' },
                    { label: '물공', value: sm.phys_attack || 0, max: 50, icon: '⚔️', cls: 'atk' },
                    { label: '마공', value: sm.mag_attack || 0, max: 50, icon: '✨', cls: 'atk' },
                    { label: '물방', value: sm.phys_defense || 0, max: 50, icon: '🛡️', cls: 'def' },
                    { label: '마방', value: sm.mag_defense || 0, max: 50, icon: '🔮', cls: 'def' },
                    { label: '치명', value: sm.crit_rate || 0, max: 30, icon: '💥', cls: 'atk' },
                    { label: '회피', value: sm.evasion || 0, max: 30, icon: '💨', cls: 'def' },
                    { label: '이동력', value: sm.moveRange || sm.move_range || 3, max: 6, icon: '👟', cls: 'mp' },
                  ].map(stat => (
                    <div className="bd-stat-row" key={stat.label}>
                      <span className="bd-stat-icon">{stat.icon}</span>
                      <span className="bd-stat-label">{stat.label}</span>
                      <div className="bd-stat-bar-wrap">
                        <div
                          className={`bd-stat-bar bd-stat-bar-${stat.cls}`}
                          style={{ width: `${Math.min((stat.value / stat.max) * 100, 100)}%` }}
                        />
                      </div>
                      <span className={`bd-stat-value bd-sv-${stat.cls}`}>{stat.value}</span>
                    </div>
                  ))}
                </div>
                <div className="bd-stat-extras">
                  <div className="bd-extra">
                    <span className="bd-extra-icon">👟</span>
                    <span className="bd-extra-label">이동력</span>
                    <span className="bd-extra-value">{sm.move_range}</span>
                  </div>
                  <div className="bd-extra">
                    <span className="bd-extra-icon">✨</span>
                    <span className="bd-extra-label">경험치</span>
                    <span className="bd-extra-value bd-ev-exp">{sm.exp_reward}</span>
                  </div>
                  <div className="bd-extra">
                    <span className="bd-extra-icon">💰</span>
                    <span className="bd-extra-label">골드</span>
                    <span className="bd-extra-value bd-ev-gold">{sm.gold_reward}</span>
                  </div>
                </div>
              </div>

              {/* 스킬 영역 */}
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
                            {skill.mp_cost > 0 && <span>💎 {skill.mp_cost}</span>}
                            {skill.range_val > 0 && <span>📏 사거리 {skill.range_val}</span>}
                            {skill.cooldown > 0 && <span>⏱️ 쿨타임 {skill.cooldown}</span>}
                            {skill.damage_multiplier > 1 && <span>⚔️ x{skill.damage_multiplier}</span>}
                            {skill.heal_amount > 0 && <span>💚 +{skill.heal_amount}</span>}
                          </div>
                        </div>
                      </div>
                    ))}
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

export default MonsterBestiary;
