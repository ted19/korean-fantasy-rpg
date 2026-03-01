import React, { useState, useEffect, useCallback } from 'react';
import { Row, Col, Form } from 'react-bootstrap';
import api from '../api';
import './MonsterBestiary.css';

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

const SKILL_TYPE_COLORS = {
  attack: '#ef4444', heal: '#22c55e', buff: '#f59e0b', debuff: '#a855f7', aoe: '#f97316',
};

const GRADE_COLORS = {
  '일반': '#9ca3af', '고급': '#4ade80', '희귀': '#60a5fa',
  '영웅': '#c084fc', '전설': '#fbbf24', '신화': '#ff6b6b',
};

const TYPE_LABELS = {
  weapon: '무기', chest: '갑옷', helmet: '투구', boots: '장화',
  ring: '반지', necklace: '목걸이', shield: '방패', armor: '방어구',
};

const TYPE_ICONS = {
  weapon: '⚔️', chest: '🛡️', helmet: '🪖', boots: '👢',
  ring: '💍', necklace: '📿', shield: '🛡️', armor: '🛡️',
};

function ImgWithFallback({ src, fallback, className, onLoad }) {
  const [err, setErr] = useState(false);
  if (err) return <span className={className}>{fallback || '?'}</span>;
  return <img src={src} alt="" className={className} onLoad={onLoad} onError={() => setErr(true)} />;
}

/* ================================
   MONSTER BESTIARY TAB
   ================================ */
function MonsterTab() {
  const [categories, setCategories] = useState([]);
  const [monsters, setMonsters] = useState([]);
  const [selectedCat, setSelectedCat] = useState(null);
  const [selectedTier, setSelectedTier] = useState(null);
  const [searchText, setSearchText] = useState('');
  const [selectedMonster, setSelectedMonster] = useState(null);
  const [monsterSkills, setMonsterSkills] = useState([]);
  const [monsterDrops, setMonsterDrops] = useState([]);
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
    } catch { setMonsters([]); }
    setLoading(false);
  }, [selectedCat, selectedTier, searchText]);

  useEffect(() => { loadMonsters(); }, [loadMonsters]);

  const openDetail = async (m) => {
    setSelectedMonster(m);
    setDetailImgLoaded(false);
    setMonsterSkills([]);
    setMonsterDrops([]);
    try {
      const res = await api.get(`/monsters/${m.id}`);
      const detail = res.data.monster;
      detail.image_url = `/monsters/${detail.id}_full.png`;
      detail.icon_url = `/monsters/${detail.id}_icon.png`;
      setSelectedMonster(detail);
      setMonsterSkills(res.data.skills || []);
      setMonsterDrops(res.data.drops || []);
    } catch (err) {
      console.error('Monster detail load error:', err);
    }
  };

  const closeDetail = () => { setSelectedMonster(null); setMonsterSkills([]); setMonsterDrops([]); };

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
    <>
      <div className="bestiary-subtitle">{monsters.length}종 발견</div>

      <div className="bestiary-filters">
        <div className="bestiary-filter-row">
          <div className="bestiary-cat-pills">
            <button className={`bestiary-pill ${!selectedCat ? 'active' : ''}`} onClick={() => setSelectedCat(null)}>전체</button>
            {categories.map(c => (
              <button key={c.id} className={`bestiary-pill ${selectedCat === c.id ? 'active' : ''}`}
                onClick={() => setSelectedCat(selectedCat === c.id ? null : c.id)} title={c.description}>
                {c.icon} {c.name}
              </button>
            ))}
          </div>
        </div>
        <div className="bestiary-filter-row">
          <Form.Select size="sm" value={selectedTier || ''} onChange={e => setSelectedTier(e.target.value ? Number(e.target.value) : null)}
            className="bestiary-select">
            <option value="">전체 등급</option>
            {[1,2,3,4,5,6,7,8,9,10].map(t => (<option key={t} value={t}>Tier {t}</option>))}
          </Form.Select>
          <input type="text" placeholder="몬스터 이름 검색..." value={searchText}
            onChange={e => setSearchText(e.target.value)} className="bestiary-search" />
        </div>
      </div>

      {loading ? (
        <div className="bestiary-loading">로딩중...</div>
      ) : monsters.length === 0 ? (
        <div className="bestiary-empty">조건에 맞는 몬스터가 없습니다.</div>
      ) : (
        <Row className="bestiary-grid g-2">
          {monsters.map(m => (
            <Col xs={6} sm={4} md={3} lg={2} key={m.id}>
              <div className="bestiary-card" onClick={() => openDetail(m)} style={{ borderColor: tierColor(m.tier) }}>
                <div className="bestiary-card-img">
                  {imageLoading[m.id] !== 'loaded' && (
                    <div className="bestiary-img-placeholder"><span className="bestiary-icon-large">{m.icon}</span></div>
                  )}
                  <img src={m.icon_url} alt={m.name}
                    onLoad={() => setImageLoading(prev => ({ ...prev, [m.id]: 'loaded' }))}
                    onError={() => setImageLoading(prev => ({ ...prev, [m.id]: 'error' }))}
                    style={imageLoading[m.id] === 'loaded' ? {} : { display: 'none' }}
                  />
                </div>
                <div className="bestiary-card-info">
                  <div className="bestiary-card-name">{m.name}</div>
                  <div className="bestiary-card-tier">{tierStars(m.tier)}</div>
                  <div className="bestiary-card-cat">
                    {m.category_icon} {m.category_name || ''}
                    {m.element && ELEMENT_INFO[m.element] && (
                      <span className="bestiary-card-element" style={{ color: ELEMENT_INFO[m.element].color }}>
                        {ELEMENT_INFO[m.element].icon}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            </Col>
          ))}
        </Row>
      )}

      {/* Monster Detail Modal */}
      {sm && (
        <div className="bd-overlay" onClick={closeDetail}>
          <div className="bd-modal" onClick={e => e.stopPropagation()}>
            <button className="bd-close" onClick={closeDetail}>&times;</button>
            <div className="bd-header" style={{ '--tier-color': tierColor(sm.tier) }}>
              <div className="bd-header-bg">
                <img src={sm.image_url} alt="" className="bd-header-bg-img" onError={(e) => { e.target.style.display='none'; }} />
                <div className="bd-header-gradient" />
              </div>
              <div className="bd-header-content">
                <div className="bd-portrait">
                  {!detailImgLoaded && <div className="bd-portrait-placeholder">{sm.icon}</div>}
                  <img src={sm.image_url} alt={sm.name} onLoad={() => setDetailImgLoaded(true)}
                    onError={(e) => { e.target.style.display='none'; }} style={detailImgLoaded ? {} : { display: 'none' }} />
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
                    <span className="bd-tag bd-tag-category">{sm.category_icon} {sm.category_name || '미분류'}</span>
                    {sm.element && ELEMENT_INFO[sm.element] && (
                      <span className="bd-tag" style={{ borderColor: ELEMENT_INFO[sm.element].color, color: ELEMENT_INFO[sm.element].color }}>
                        {ELEMENT_INFO[sm.element].icon} {ELEMENT_INFO[sm.element].name}
                      </span>
                    )}
                    {sm.ai_type && AI_TYPE_INFO[sm.ai_type] && (
                      <span className="bd-tag" style={{ borderColor: AI_TYPE_INFO[sm.ai_type].color, color: AI_TYPE_INFO[sm.ai_type].color }}>
                        {AI_TYPE_INFO[sm.ai_type].icon} {AI_TYPE_INFO[sm.ai_type].label}
                      </span>
                    )}
                    <span className="bd-tag bd-tag-dungeon">📍 {sm.dungeon_name || '알 수 없음'}</span>
                  </div>
                  <p className="bd-desc">{sm.description || '알려진 정보가 없습니다.'}</p>
                </div>
              </div>
            </div>

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
                        <div className={`bd-stat-bar bd-stat-bar-${stat.cls}`}
                          style={{ width: `${Math.min((stat.value / stat.max) * 100, 100)}%` }} />
                      </div>
                      <span className={`bd-stat-value bd-sv-${stat.cls}`}>{stat.value}</span>
                    </div>
                  ))}
                </div>
                <div className="bd-stat-extras">
                  <div className="bd-extra"><span className="bd-extra-icon">👟</span><span className="bd-extra-label">이동력</span><span className="bd-extra-value">{sm.move_range}</span></div>
                  <div className="bd-extra"><span className="bd-extra-icon">✨</span><span className="bd-extra-label">경험치</span><span className="bd-extra-value bd-ev-exp">{sm.exp_reward}</span></div>
                  <div className="bd-extra"><span className="bd-extra-icon">💰</span><span className="bd-extra-label">골드</span><span className="bd-extra-value bd-ev-gold">{sm.gold_reward}</span></div>
                </div>
              </div>

              {sm.element && sm.element !== 'neutral' && ELEMENT_INFO[sm.element] && (
                <div className="bd-section">
                  <h3 className="bd-section-title">속성 상성</h3>
                  <div className="bd-element-info">
                    <div className="bd-element-current">
                      <span className="bd-element-icon" style={{ color: ELEMENT_INFO[sm.element].color }}>{ELEMENT_INFO[sm.element].icon}</span>
                      <span className="bd-element-name" style={{ color: ELEMENT_INFO[sm.element].color }}>{ELEMENT_INFO[sm.element].name} 속성</span>
                    </div>
                    <div className="bd-element-relations">
                      {Object.entries(ELEMENT_TABLE[sm.element]).filter(([el]) => el !== 'neutral' && el !== sm.element).map(([el, mult]) => {
                        const info = ELEMENT_INFO[el];
                        const defMult = ELEMENT_TABLE[el]?.[sm.element] ?? 1.0;
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

              {monsterDrops.length > 0 && (
                <div className="bd-section">
                  <h3 className="bd-section-title">드랍 아이템</h3>
                  <div className="bd-drops">
                    {monsterDrops.map((drop, i) => {
                      const pct = Math.round(drop.drop_rate * 100);
                      const gradeColor = GRADE_COLORS[drop.grade] || '#9ca3af';
                      return (
                        <div className="bd-drop" key={i}>
                          <div className="bd-drop-icon">{drop.icon}</div>
                          <div className="bd-drop-info">
                            <div className="bd-drop-name" style={{ color: gradeColor }}>
                              {drop.name} <span className="bd-drop-grade">[{drop.grade}]</span>
                            </div>
                            <div className="bd-drop-desc">{drop.description}</div>
                          </div>
                          <div className="bd-drop-rate-wrap">
                            <div className="bd-drop-rate-bar">
                              <div className="bd-drop-rate-fill" style={{ width: `${pct}%`, background: pct >= 30 ? '#4ade80' : pct >= 15 ? '#fbbf24' : '#f87171' }} />
                            </div>
                            <span className={`bd-drop-rate-text ${pct >= 30 ? 'high' : pct >= 15 ? 'mid' : 'low'}`}>{pct}%</span>
                          </div>
                          {drop.max_quantity > 1 && <span className="bd-drop-qty">{drop.min_quantity}~{drop.max_quantity}개</span>}
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
    </>
  );
}

/* ================================
   EQUIPMENT BESTIARY TAB
   ================================ */
function EquipmentTab() {
  const [items, setItems] = useState([]);
  const [typeFilter, setTypeFilter] = useState('all');
  const [gradeFilter, setGradeFilter] = useState('all');
  const [searchText, setSearchText] = useState('');
  const [selectedItem, setSelectedItem] = useState(null);
  const [loading, setLoading] = useState(true);

  const loadItems = useCallback(async () => {
    setLoading(true);
    try {
      const params = {};
      if (typeFilter !== 'all') params.type = typeFilter;
      if (gradeFilter !== 'all') params.grade = gradeFilter;
      if (searchText) params.search = searchText;
      const res = await api.get('/monsters/equipment-encyclopedia', { params });
      setItems(res.data.items);
    } catch { setItems([]); }
    setLoading(false);
  }, [typeFilter, gradeFilter, searchText]);

  useEffect(() => { loadItems(); }, [loadItems]);

  const grades = ['일반', '고급', '희귀', '영웅', '전설', '신화'];
  const types = ['weapon', 'chest', 'helmet', 'boots', 'shield', 'ring', 'necklace'];

  return (
    <>
      <div className="bestiary-subtitle">{items.length}종 등록</div>

      <div className="bestiary-filters">
        <div className="bestiary-filter-row">
          <div className="bestiary-cat-pills">
            <button className={`bestiary-pill ${typeFilter === 'all' ? 'active' : ''}`} onClick={() => setTypeFilter('all')}>전체</button>
            {types.map(t => (
              <button key={t} className={`bestiary-pill ${typeFilter === t ? 'active' : ''}`} onClick={() => setTypeFilter(t)}>
                {TYPE_ICONS[t]} {TYPE_LABELS[t]}
              </button>
            ))}
          </div>
        </div>
        <div className="bestiary-filter-row">
          <div className="bestiary-cat-pills">
            <button className={`bestiary-pill grade-pill ${gradeFilter === 'all' ? 'active' : ''}`} onClick={() => setGradeFilter('all')}>전체 등급</button>
            {grades.map(g => (
              <button key={g} className={`bestiary-pill grade-pill ${gradeFilter === g ? 'active' : ''}`}
                onClick={() => setGradeFilter(gradeFilter === g ? 'all' : g)} style={gradeFilter === g ? { borderColor: GRADE_COLORS[g], color: GRADE_COLORS[g] } : {}}>
                {g}
              </button>
            ))}
          </div>
          <input type="text" placeholder="장비 이름 검색..." value={searchText}
            onChange={e => setSearchText(e.target.value)} className="bestiary-search" />
        </div>
      </div>

      {loading ? (
        <div className="bestiary-loading">로딩중...</div>
      ) : items.length === 0 ? (
        <div className="bestiary-empty">조건에 맞는 장비가 없습니다.</div>
      ) : (
        <Row className="bestiary-grid g-2">
          {items.map(item => (
            <Col xs={6} sm={4} md={3} lg={2} key={item.id}>
              <div className="bestiary-card equip-card" onClick={() => setSelectedItem(item)}
                style={{ borderColor: GRADE_COLORS[item.grade] || '#555' }}>
                <div className="bestiary-card-img equip-card-img">
                  <ImgWithFallback src={`/equipment/${item.id}_icon.png`} fallback={TYPE_ICONS[item.type] || '📦'}
                    className="equip-bestiary-icon" />
                </div>
                <div className="bestiary-card-info">
                  <div className="bestiary-card-name" style={{ color: GRADE_COLORS[item.grade] }}>{item.name}</div>
                  <div className="equip-card-grade" style={{ color: GRADE_COLORS[item.grade] }}>[{item.grade}]</div>
                  <div className="bestiary-card-cat">
                    {TYPE_ICONS[item.type]} {TYPE_LABELS[item.type]}
                    {item.class_restriction && <span className="equip-class-tag">{item.class_restriction}</span>}
                  </div>
                </div>
              </div>
            </Col>
          ))}
        </Row>
      )}

      {/* Equipment Detail Modal */}
      {selectedItem && (
        <div className="bd-overlay" onClick={() => setSelectedItem(null)}>
          <div className="bd-modal equip-detail-modal" onClick={e => e.stopPropagation()}>
            <button className="bd-close" onClick={() => setSelectedItem(null)}>&times;</button>

            <div className="equip-detail-header" style={{ '--grade-color': GRADE_COLORS[selectedItem.grade] || '#9ca3af' }}>
              <div className="equip-detail-icon-wrap">
                <ImgWithFallback src={`/equipment/${selectedItem.id}_icon.png`}
                  fallback={TYPE_ICONS[selectedItem.type] || '📦'} className="equip-detail-icon" />
              </div>
              <div className="equip-detail-info">
                <div className="equip-detail-name" style={{ color: GRADE_COLORS[selectedItem.grade] }}>
                  {selectedItem.name}
                </div>
                <div className="equip-detail-grade" style={{ color: GRADE_COLORS[selectedItem.grade] }}>
                  [{selectedItem.grade}] {TYPE_LABELS[selectedItem.type]}
                </div>
                <div className="equip-detail-desc">{selectedItem.description}</div>
                <div className="equip-detail-tags">
                  {selectedItem.class_restriction && (
                    <span className="bd-tag" style={{ borderColor: '#e94560', color: '#e94560' }}>{selectedItem.class_restriction} 전용</span>
                  )}
                  {selectedItem.required_level > 1 && (
                    <span className="bd-tag">Lv.{selectedItem.required_level}+</span>
                  )}
                  {selectedItem.weapon_hand && (
                    <span className="bd-tag">{selectedItem.weapon_hand === '2h' ? '양손' : '한손'}</span>
                  )}
                  {selectedItem.max_enhance > 0 && (
                    <span className="bd-tag" style={{ borderColor: '#ffa502', color: '#ffa502' }}>최대 +{selectedItem.max_enhance}</span>
                  )}
                </div>
              </div>
            </div>

            <div className="bd-body">
              <div className="bd-section">
                <h3 className="bd-section-title">장비 효과</h3>
                <div className="equip-detail-stats">
                  {[
                    { label: 'HP', value: selectedItem.effect_hp, icon: '❤️', cls: 'hp' },
                    { label: 'MP', value: selectedItem.effect_mp, icon: '💎', cls: 'mp' },
                    { label: '물리공격', value: selectedItem.effect_phys_attack, icon: '⚔️', cls: 'atk' },
                    { label: '마법공격', value: selectedItem.effect_mag_attack, icon: '✨', cls: 'atk' },
                    { label: '물리방어', value: selectedItem.effect_phys_defense, icon: '🛡️', cls: 'def' },
                    { label: '마법방어', value: selectedItem.effect_mag_defense, icon: '🔮', cls: 'def' },
                    { label: '치명타', value: selectedItem.effect_crit_rate, icon: '💥', cls: 'atk' },
                    { label: '회피율', value: selectedItem.effect_evasion, icon: '💨', cls: 'def' },
                  ].filter(s => s.value && s.value !== 0).map(stat => (
                    <div className="equip-stat-row" key={stat.label}>
                      <span className="equip-stat-icon">{stat.icon}</span>
                      <span className="equip-stat-label">{stat.label}</span>
                      <span className={`equip-stat-value equip-sv-${stat.cls}`}>+{stat.value}</span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="bd-section">
                <h3 className="bd-section-title">거래 정보</h3>
                <div className="equip-detail-trade">
                  <div className="equip-trade-row">
                    <span className="equip-trade-label">구매가</span>
                    <span className="equip-trade-value gold">{selectedItem.price.toLocaleString()}G</span>
                  </div>
                  <div className="equip-trade-row">
                    <span className="equip-trade-label">판매가</span>
                    <span className="equip-trade-value sell">{selectedItem.sell_price.toLocaleString()}G</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

/* ================================
   MAIN BESTIARY COMPONENT
   ================================ */
function MonsterBestiary() {
  const [mainTab, setMainTab] = useState('monster');

  return (
    <div className="bestiary-container">
      {/* Banner */}
      <div className="bestiary-banner">
        <ImgWithFallback src="/ui/bestiary_banner.png" className="bestiary-banner-img" />
        <div className="bestiary-banner-overlay" />
        <div className="bestiary-banner-title">도감</div>
      </div>

      {/* Main Tabs */}
      <div className="bestiary-main-tabs">
        <button className={`bestiary-main-tab ${mainTab === 'monster' ? 'active' : ''}`} onClick={() => setMainTab('monster')}>
          <ImgWithFallback src="/ui/tab_monster_bestiary.png" className="bestiary-tab-icon" fallback="👹" />
          <span>몬스터 도감</span>
        </button>
        <button className={`bestiary-main-tab ${mainTab === 'equipment' ? 'active' : ''}`} onClick={() => setMainTab('equipment')}>
          <ImgWithFallback src="/ui/tab_equipment_bestiary.png" className="bestiary-tab-icon" fallback="⚔️" />
          <span>장비 도감</span>
        </button>
      </div>

      {/* Tab Content */}
      {mainTab === 'monster' ? <MonsterTab /> : <EquipmentTab />}
    </div>
  );
}

export default MonsterBestiary;
