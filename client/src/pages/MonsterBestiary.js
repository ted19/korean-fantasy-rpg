import React, { useState, useEffect, useCallback } from 'react';
import { Row, Col, Form } from 'react-bootstrap';
import api from '../api';
import { ELITE_TIERS } from '../srpg/battleEngine';
import './MonsterBestiary.css';

const ELEMENT_INFO = {
  fire:    { name: '불', icon: '🔥', color: '#ff6b35', aura: 'flame' },
  water:   { name: '물', icon: '💧', color: '#4da6ff', aura: 'ice' },
  earth:   { name: '땅', icon: '🪨', color: '#8bc34a', aura: 'aura_gold' },
  wind:    { name: '바람', icon: '🌀', color: '#b388ff', aura: 'wind' },
  neutral: { name: '중립', icon: '⚪', color: '#9ca3af', aura: '' },
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
  cosmetic: '오라',
};

const TYPE_ICONS = {
  weapon: '⚔️', chest: '🛡️', helmet: '🪖', boots: '👢',
  ring: '💍', necklace: '📿', shield: '🛡️', armor: '🛡️',
  cosmetic: '✨',
};

const COSMETIC_AURA_MAP = {
  aura_gold: { name: '황금 기운', aura: 'aura_gold', color: '#ffa502' },
  flame: { name: '불꽃 오라', aura: 'flame', color: '#ff4500' },
  ice: { name: '빙결 오라', aura: 'ice', color: '#87cefa' },
  lightning: { name: '번개 오라', aura: 'lightning', color: '#ffd700' },
  shadow: { name: '암흑 오라', aura: 'shadow', color: '#9b59b6' },
  holy: { name: '신성 오라', aura: 'holy', color: '#fff3bf' },
  poison: { name: '독기 오라', aura: 'poison', color: '#2ed573' },
  wind: { name: '바람 오라', aura: 'wind', color: '#96dcff' },
  blood: { name: '혈기 오라', aura: 'blood', color: '#b40000' },
  spirit: { name: '영혼 오라', aura: 'spirit', color: '#b482ff' },
  dragon_breath: { name: '용의 숨결', aura: 'dragon_breath', color: '#ff8c00' },
  celestial: { name: '천상의 빛', aura: 'celestial', color: '#e0c0ff' },
  abyssal_flame: { name: '심연의 화염', aura: 'abyssal_flame', color: '#8b00c8' },
  starlight: { name: '별빛 오라', aura: 'starlight', color: '#aab8ff' },
  phoenix: { name: '봉황의 기운', aura: 'phoenix', color: '#ff6600' },
  chaos_vortex: { name: '혼돈의 소용돌이', aura: 'chaos_vortex', color: '#c850ff' },
};

function ImgWithFallback({ src, fallback, className, onLoad }) {
  const [err, setErr] = useState(false);
  if (err) return <span className={className}>{fallback || '?'}</span>;
  return <img src={src} alt="" className={className} onLoad={onLoad} onError={() => setErr(true)} />;
}

/* ================================
   MONSTER BESTIARY TAB
   ================================ */
const COUNTRY_FILTERS = [
  { key: null, label: '전체', icon: '🌏' },
  { key: 'korea', label: '한국', icon: '🏔️' },
  { key: 'japan', label: '일본', icon: '⛩️' },
  { key: 'china', label: '중국', icon: '🐉' },
  { key: 'etc', label: '기타', icon: '📦' },
];

const DISCOVER_FILTERS = [
  { key: 'all', label: '전체' },
  { key: 'discovered', label: '발견됨' },
  { key: 'undiscovered', label: '미발견' },
];

function MonsterTab() {
  const [categories, setCategories] = useState([]);
  const [monsters, setMonsters] = useState([]);
  const [selectedCountry, setSelectedCountry] = useState(null);
  const [selectedCat, setSelectedCat] = useState(null);
  const [selectedTier, setSelectedTier] = useState(null);
  const [searchText, setSearchText] = useState('');
  const [discoverFilter, setDiscoverFilter] = useState('all');
  const [selectedMonster, setSelectedMonster] = useState(null);
  const [monsterSkills, setMonsterSkills] = useState([]);
  const [monsterDrops, setMonsterDrops] = useState([]);
  const [bestiaryInfo, setBestiaryInfo] = useState(null);
  const [loading, setLoading] = useState(true);
  const [imageLoading, setImageLoading] = useState({});
  const [detailImgLoaded, setDetailImgLoaded] = useState(false);
  const [totalMonsters, setTotalMonsters] = useState(0);
  const [discoveredCount, setDiscoveredCount] = useState(0);

  useEffect(() => {
    api.get('/monsters/categories').then(r => setCategories(r.data.categories)).catch(() => {});
  }, []);

  const loadMonsters = useCallback(async () => {
    setLoading(true);
    try {
      const params = {};
      if (selectedCountry) params.country = selectedCountry;
      if (selectedCat) params.category_id = selectedCat;
      if (selectedTier) params.tier = selectedTier;
      if (searchText) params.search = searchText;
      const res = await api.get('/monsters/encyclopedia', { params });
      let list = res.data.monsters;
      if (discoverFilter === 'discovered') list = list.filter(m => m.discovered);
      else if (discoverFilter === 'undiscovered') list = list.filter(m => !m.discovered);
      setMonsters(list);
      setTotalMonsters(res.data.totalMonsters || 0);
      setDiscoveredCount(res.data.discoveredCount || 0);
    } catch { setMonsters([]); }
    setLoading(false);
  }, [selectedCountry, selectedCat, selectedTier, searchText, discoverFilter]);

  useEffect(() => { loadMonsters(); }, [loadMonsters]);

  const openDetail = async (m) => {
    if (!m.discovered) return; // 미발견 몬스터는 상세보기 불가
    setSelectedMonster(m);
    setDetailImgLoaded(false);
    setMonsterSkills([]);
    setMonsterDrops([]);
    setBestiaryInfo(null);
    try {
      const res = await api.get(`/monsters/${m.id}`);
      const detail = res.data.monster;
      detail.image_url = `/monsters/${detail.id}_full.png`;
      detail.icon_url = `/monsters/${detail.id}_icon.png`;
      detail.discovered = m.discovered;
      detail.killCount = m.killCount;
      setSelectedMonster(detail);
      setMonsterSkills(res.data.skills || []);
      setMonsterDrops(res.data.drops || []);
      setBestiaryInfo(res.data.bestiary || null);
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

  const discoverPct = totalMonsters > 0 ? Math.round((discoveredCount / totalMonsters) * 100) : 0;

  return (
    <>
      <div className="bestiary-discover-bar">
        <div className="bestiary-discover-header">
          <span className="bestiary-discover-label">도감 달성률</span>
          <span className="bestiary-discover-count">{discoveredCount} / {totalMonsters}</span>
          <span className="bestiary-discover-pct">{discoverPct}%</span>
        </div>
        <div className="bestiary-discover-track">
          <div className="bestiary-discover-fill" style={{ width: `${discoverPct}%` }} />
        </div>
      </div>

      <div className="bestiary-filters">
        <div className="bestiary-filter-row">
          <div className="bestiary-cat-pills bestiary-country-pills">
            {COUNTRY_FILTERS.map(cf => (
              <button key={cf.key || 'all'} className={`bestiary-pill bestiary-country-pill ${selectedCountry === cf.key ? 'active' : ''}`}
                onClick={() => setSelectedCountry(cf.key)}>
                {cf.icon} {cf.label}
              </button>
            ))}
          </div>
        </div>
        <div className="bestiary-filter-row">
          <div className="bestiary-cat-pills">
            {DISCOVER_FILTERS.map(df => (
              <button key={df.key} className={`bestiary-pill bestiary-discover-pill ${discoverFilter === df.key ? 'active' : ''}`}
                onClick={() => setDiscoverFilter(df.key)}>
                {df.key === 'discovered' ? '\u2611 ' : df.key === 'undiscovered' ? '\u2610 ' : ''}{df.label}
              </button>
            ))}
          </div>
        </div>
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
              <div className={`bestiary-card ${!m.discovered ? 'bestiary-card-locked' : ''}`}
                onClick={() => openDetail(m)}
                style={{ borderColor: m.discovered ? tierColor(m.tier) : '#333' }}>
                <div className="bestiary-card-img">
                  {m.discovered ? (
                    <>
                      {imageLoading[m.id] !== 'loaded' && (
                        <div className="bestiary-img-placeholder"><span className="bestiary-icon-large">{m.icon}</span></div>
                      )}
                      <img src={m.icon_url} alt={m.name}
                        onLoad={() => setImageLoading(prev => ({ ...prev, [m.id]: 'loaded' }))}
                        onError={() => setImageLoading(prev => ({ ...prev, [m.id]: 'error' }))}
                        style={imageLoading[m.id] === 'loaded' ? {} : { display: 'none' }}
                      />
                      {m.element && ELEMENT_INFO[m.element]?.aura && (
                        <div className={`bestiary-card-aura bd-aura-${ELEMENT_INFO[m.element].aura}`} />
                      )}
                    </>
                  ) : (
                    <div className="bestiary-img-placeholder bestiary-img-unknown">
                      <span className="bestiary-icon-large">?</span>
                    </div>
                  )}
                </div>
                <div className="bestiary-card-info">
                  <div className="bestiary-card-name">{m.discovered ? m.name : '???'}</div>
                  <div className="bestiary-card-tier">{tierStars(m.tier)}</div>
                  {m.discovered ? (
                    <div className="bestiary-card-cat">
                      {m.category_icon} {m.category_name || ''}
                      {m.element && ELEMENT_INFO[m.element] && (
                        <span className="bestiary-card-element" style={{ color: ELEMENT_INFO[m.element].color }}>
                          {ELEMENT_INFO[m.element].icon}
                        </span>
                      )}
                    </div>
                  ) : (
                    <div className="bestiary-card-cat" style={{ color: '#555' }}>미발견</div>
                  )}
                  {m.discovered && m.killCount > 0 && (
                    <div className="bestiary-card-kills">{m.killCount}회 처치</div>
                  )}
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
                  {sm.element && ELEMENT_INFO[sm.element]?.aura && (
                    <div className={`bd-portrait-aura bd-aura-${ELEMENT_INFO[sm.element].aura}`} />
                  )}
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
              {/* 도감 정보 */}
              {bestiaryInfo && (
                <div className="bd-section bd-bestiary-section">
                  <h3 className="bd-section-title">도감 기록</h3>
                  <div className="bd-bestiary-stats">
                    <div className="bd-bestiary-stat">
                      <span className="bd-bestiary-stat-icon">⚔️</span>
                      <span className="bd-bestiary-stat-label">총 처치</span>
                      <span className="bd-bestiary-stat-value">{bestiaryInfo.kill_count.toLocaleString()}회</span>
                    </div>
                    <div className="bd-bestiary-stat">
                      <span className="bd-bestiary-stat-icon">🔍</span>
                      <span className="bd-bestiary-stat-label">최초 발견</span>
                      <span className="bd-bestiary-stat-value">{new Date(bestiaryInfo.first_discovered).toLocaleDateString('ko-KR')}</span>
                    </div>
                    <div className="bd-bestiary-stat">
                      <span className="bd-bestiary-stat-icon">{bestiaryInfo.kill_count >= 100 ? '⭐' : bestiaryInfo.kill_count >= 50 ? '👑' : bestiaryInfo.kill_count >= 10 ? '⚔️' : '👁️'}</span>
                      <span className="bd-bestiary-stat-label">숙련도</span>
                      <span className={`bd-bestiary-stat-value bd-mastery-${bestiaryInfo.kill_count >= 100 ? 'master' : bestiaryInfo.kill_count >= 50 ? 'expert' : bestiaryInfo.kill_count >= 10 ? 'skilled' : 'novice'}`}>
                        {bestiaryInfo.kill_count >= 100 ? '대가' : bestiaryInfo.kill_count >= 50 ? '숙련' : bestiaryInfo.kill_count >= 10 ? '경험' : '초보'}
                      </span>
                    </div>
                  </div>
                </div>
              )}

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
                        <span className="bd-elite-stat">❤️ HP {Math.floor((sm.hp || 0) * tier.mult)}</span>
                        <span className="bd-elite-stat">💎 MP {Math.floor((sm.mp || 0) * tier.mult)}</span>
                        <span className="bd-elite-stat">⚔️ 물공 {Math.floor((sm.phys_attack || 0) * tier.mult)}</span>
                        <span className="bd-elite-stat">🛡️ 물방 {Math.floor((sm.phys_defense || 0) * tier.mult)}</span>
                        <span className="bd-elite-stat">✨ 마공 {Math.floor((sm.mag_attack || 0) * tier.mult)}</span>
                        <span className="bd-elite-stat">🔮 마방 {Math.floor((sm.mag_defense || 0) * tier.mult)}</span>
                        <span className="bd-elite-stat">💥 치명 {Math.floor((sm.crit_rate || 0) * tier.mult)}</span>
                        <span className="bd-elite-stat">💨 회피 {Math.floor((sm.evasion || 0) * tier.mult)}</span>
                      </div>
                      <div className="bd-elite-tier-rewards">
                        <span className="bd-elite-reward">EXP x{tier.rewardMult}</span>
                        <span className="bd-elite-reward">Gold x{tier.rewardMult}</span>
                      </div>
                    </div>
                  ))}
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
  const types = ['weapon', 'chest', 'helmet', 'boots', 'shield', 'ring', 'necklace', 'cosmetic'];

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
          {items.map(item => {
            const isCosmetic = item.type === 'cosmetic' && item.cosmetic_effect;
            const auraInfo = isCosmetic ? COSMETIC_AURA_MAP[item.cosmetic_effect] : null;
            return (
              <Col xs={6} sm={4} md={3} lg={2} key={item.id}>
                <div className="bestiary-card equip-card" onClick={() => setSelectedItem(item)}
                  style={{ borderColor: isCosmetic ? (auraInfo?.color || '#a78bfa') : (GRADE_COLORS[item.grade] || '#555') }}>
                  <div className={`bestiary-card-img equip-card-img ${isCosmetic ? 'cosmetic-card-img' : ''}`}>
                    {isCosmetic ? (
                      <>
                        <ImgWithFallback src={`/cosmetics/${item.cosmetic_effect}.png`} fallback="✨"
                          className="equip-bestiary-icon cosmetic-orb-icon" />
                        <div className={`bestiary-card-aura bd-aura-${auraInfo?.aura || 'aura_gold'}`} />
                      </>
                    ) : (
                      <ImgWithFallback src={`/equipment/${item.id}_icon.png`} fallback={TYPE_ICONS[item.type] || '📦'}
                        className="equip-bestiary-icon" />
                    )}
                  </div>
                  <div className="bestiary-card-info">
                    <div className="bestiary-card-name" style={{ color: isCosmetic ? (auraInfo?.color || '#a78bfa') : GRADE_COLORS[item.grade] }}>{item.name}</div>
                    {!isCosmetic && <div className="equip-card-grade" style={{ color: GRADE_COLORS[item.grade] }}>[{item.grade}]</div>}
                    <div className="bestiary-card-cat">
                      {TYPE_ICONS[item.type]} {TYPE_LABELS[item.type]}
                      {item.class_restriction && <span className="equip-class-tag">{item.class_restriction}</span>}
                    </div>
                  </div>
                </div>
              </Col>
            );
          })}
        </Row>
      )}

      {/* Equipment Detail Modal */}
      {selectedItem && (() => {
        const si = selectedItem;
        const isCos = si.type === 'cosmetic' && si.cosmetic_effect;
        const cosAura = isCos ? COSMETIC_AURA_MAP[si.cosmetic_effect] : null;
        return (
          <div className="bd-overlay" onClick={() => setSelectedItem(null)}>
            <div className="bd-modal equip-detail-modal" onClick={e => e.stopPropagation()}>
              <button className="bd-close" onClick={() => setSelectedItem(null)}>&times;</button>

              <div className="equip-detail-header" style={{ '--grade-color': isCos ? (cosAura?.color || '#a78bfa') : (GRADE_COLORS[si.grade] || '#9ca3af') }}>
                <div className={`equip-detail-icon-wrap ${isCos ? 'cosmetic-detail-icon-wrap' : ''}`}>
                  {isCos ? (
                    <>
                      <ImgWithFallback src={`/cosmetics/${si.cosmetic_effect}.png`}
                        fallback="✨" className="equip-detail-icon cosmetic-detail-orb" />
                      <div className={`cosmetic-detail-aura bd-aura-${cosAura?.aura || 'aura_gold'}`} />
                    </>
                  ) : (
                    <ImgWithFallback src={`/equipment/${si.id}_icon.png`}
                      fallback={TYPE_ICONS[si.type] || '📦'} className="equip-detail-icon" />
                  )}
                </div>
                <div className="equip-detail-info">
                  <div className="equip-detail-name" style={{ color: isCos ? (cosAura?.color || '#a78bfa') : GRADE_COLORS[si.grade] }}>
                    {si.name}
                  </div>
                  <div className="equip-detail-grade" style={{ color: isCos ? (cosAura?.color || '#a78bfa') : GRADE_COLORS[si.grade] }}>
                    {isCos ? `✨ ${cosAura?.name || '오라'}` : `[${si.grade}] ${TYPE_LABELS[si.type]}`}
                  </div>
                  <div className="equip-detail-desc">{si.description}</div>
                  <div className="equip-detail-tags">
                    {si.class_restriction && (
                      <span className="bd-tag" style={{ borderColor: '#e94560', color: '#e94560' }}>{si.class_restriction} 전용</span>
                    )}
                    {si.required_level > 1 && (
                      <span className="bd-tag">Lv.{si.required_level}+</span>
                    )}
                    {si.weapon_hand && (
                      <span className="bd-tag">{si.weapon_hand === '2h' ? '양손' : '한손'}</span>
                    )}
                    {!isCos && si.max_enhance > 0 && (
                      <span className="bd-tag" style={{ borderColor: '#ffa502', color: '#ffa502' }}>최대 +{si.max_enhance}</span>
                    )}
                    {isCos && (
                      <span className="bd-tag" style={{ borderColor: cosAura?.color || '#a78bfa', color: cosAura?.color || '#a78bfa' }}>코스메틱</span>
                    )}
                  </div>
                </div>
              </div>

              <div className="bd-body">
                {isCos ? (
                  <div className="bd-section">
                    <h3 className="bd-section-title">오라 미리보기</h3>
                    <div className="cosmetic-preview-section">
                      <div className="cosmetic-preview-orb-large">
                        <ImgWithFallback src={`/cosmetics/${si.cosmetic_effect}.png`} fallback="✨" className="cosmetic-preview-orb-img" />
                        <div className={`cosmetic-preview-orb-aura bd-aura-${cosAura?.aura || 'aura_gold'}`} />
                      </div>
                      <div className="cosmetic-preview-name" style={{ color: cosAura?.color }}>{cosAura?.name || si.name}</div>
                      <div className="cosmetic-preview-desc">장착 시 캐릭터 초상화에 오라 효과가 적용됩니다.</div>
                    </div>
                  </div>
                ) : (
                  <div className="bd-section">
                    <h3 className="bd-section-title">장비 효과</h3>
                    <div className="equip-detail-stats">
                      {[
                        { label: 'HP', value: si.effect_hp, icon: '❤️', cls: 'hp' },
                        { label: 'MP', value: si.effect_mp, icon: '💎', cls: 'mp' },
                        { label: '물리공격', value: si.effect_phys_attack, icon: '⚔️', cls: 'atk' },
                        { label: '마법공격', value: si.effect_mag_attack, icon: '✨', cls: 'atk' },
                        { label: '물리방어', value: si.effect_phys_defense, icon: '🛡️', cls: 'def' },
                        { label: '마법방어', value: si.effect_mag_defense, icon: '🔮', cls: 'def' },
                        { label: '치명타', value: si.effect_crit_rate, icon: '💥', cls: 'atk' },
                        { label: '회피율', value: si.effect_evasion, icon: '💨', cls: 'def' },
                      ].filter(s => s.value && s.value !== 0).map(stat => (
                        <div className="equip-stat-row" key={stat.label}>
                          <span className="equip-stat-icon">{stat.icon}</span>
                          <span className="equip-stat-label">{stat.label}</span>
                          <span className={`equip-stat-value equip-sv-${stat.cls}`}>+{stat.value}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                <div className="bd-section">
                  <h3 className="bd-section-title">거래 정보</h3>
                  <div className="equip-detail-trade">
                    <div className="equip-trade-row">
                      <span className="equip-trade-label">구매가</span>
                      <span className="equip-trade-value gold">{si.price.toLocaleString()}G</span>
                    </div>
                    <div className="equip-trade-row">
                      <span className="equip-trade-label">판매가</span>
                      <span className="equip-trade-value sell">{si.sell_price.toLocaleString()}G</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        );
      })()}
    </>
  );
}

/* ================================
   SKILL BESTIARY TAB
   ================================ */
const CLASS_INFO = {
  '풍수사': { icon: '🔮', color: '#60a5fa' },
  '무당':   { icon: '🪬', color: '#c084fc' },
  '승려':   { icon: '📿', color: '#fbbf24' },
  '저승사자': { icon: '💀', color: '#9b59b6' },
};

const SKILL_NODE_TYPE_LABELS = { active: '액티브', passive: '패시브' };
const SKILL_NODE_TYPE_COLORS = { active: '#3b82f6', passive: '#f59e0b' };
const SKILL_STAT_LABELS = {
  hp: 'HP', mp: 'MP', attack: 'ATK', defense: 'DEF',
  phys_attack: '물공', phys_defense: '물방', mag_attack: '마공', mag_defense: '마방',
  crit_rate: '치명', evasion: '회피',
};

function SkillTab() {
  const [skills, setSkills] = useState([]);
  const [classFilter, setClassFilter] = useState('all');
  const [branchFilter, setBranchFilter] = useState('all');
  const [typeFilter, setTypeFilter] = useState('all');
  const [searchText, setSearchText] = useState('');
  const [selectedSkill, setSelectedSkill] = useState(null);
  const [loading, setLoading] = useState(true);

  const loadSkills = useCallback(async () => {
    setLoading(true);
    try {
      const params = {};
      if (classFilter !== 'all') params.class_type = classFilter;
      if (branchFilter !== 'all') params.branch = branchFilter;
      if (typeFilter !== 'all') params.node_type = typeFilter;
      if (searchText) params.search = searchText;
      const res = await api.get('/skill/encyclopedia', { params });
      setSkills(res.data.skills);
    } catch { setSkills([]); }
    setLoading(false);
  }, [classFilter, branchFilter, typeFilter, searchText]);

  useEffect(() => { loadSkills(); }, [loadSkills]);

  // 브랜치 목록 추출
  const branches = [];
  const branchSet = new Set();
  for (const s of skills) {
    if (!branchSet.has(s.branch)) {
      branchSet.add(s.branch);
      branches.push({ key: s.branch, name: s.branch_name });
    }
  }

  const classes = ['풍수사', '무당', '승려', '저승사자'];

  const tierLabel = (tier) => {
    if (tier === 7) return '신화';
    if (tier === 6) return '전설';
    if (tier === 5) return '초월';
    if (tier === 4) return '궁극';
    return `Tier ${tier}`;
  };

  const ss = selectedSkill;

  return (
    <>
      <div className="bestiary-subtitle">{skills.length}종 등록</div>

      <div className="bestiary-filters">
        <div className="bestiary-filter-row">
          <div className="bestiary-cat-pills">
            <button className={`bestiary-pill ${classFilter === 'all' ? 'active' : ''}`} onClick={() => { setClassFilter('all'); setBranchFilter('all'); }}>전체</button>
            {classes.map(c => (
              <button key={c} className={`bestiary-pill ${classFilter === c ? 'active' : ''}`}
                onClick={() => { setClassFilter(classFilter === c ? 'all' : c); setBranchFilter('all'); }}
                style={classFilter === c ? { borderColor: CLASS_INFO[c].color, color: CLASS_INFO[c].color } : {}}>
                {CLASS_INFO[c].icon} {c}
              </button>
            ))}
          </div>
        </div>
        <div className="bestiary-filter-row">
          <div className="bestiary-cat-pills">
            <button className={`bestiary-pill ${typeFilter === 'all' ? 'active' : ''}`} onClick={() => setTypeFilter('all')}>전체</button>
            <button className={`bestiary-pill ${typeFilter === 'active' ? 'active' : ''}`}
              onClick={() => setTypeFilter(typeFilter === 'active' ? 'all' : 'active')}
              style={typeFilter === 'active' ? { borderColor: '#3b82f6', color: '#3b82f6' } : {}}>
              액티브
            </button>
            <button className={`bestiary-pill ${typeFilter === 'passive' ? 'active' : ''}`}
              onClick={() => setTypeFilter(typeFilter === 'passive' ? 'all' : 'passive')}
              style={typeFilter === 'passive' ? { borderColor: '#f59e0b', color: '#f59e0b' } : {}}>
              패시브
            </button>
          </div>
          {branches.length > 0 && (
            <div className="bestiary-cat-pills">
              <button className={`bestiary-pill ${branchFilter === 'all' ? 'active' : ''}`} onClick={() => setBranchFilter('all')}>전체 계열</button>
              {branches.map(b => (
                <button key={b.key} className={`bestiary-pill ${branchFilter === b.key ? 'active' : ''}`}
                  onClick={() => setBranchFilter(branchFilter === b.key ? 'all' : b.key)}>
                  {b.name}
                </button>
              ))}
            </div>
          )}
        </div>
        <div className="bestiary-filter-row">
          <input type="text" placeholder="스킬 이름 검색..." value={searchText}
            onChange={e => setSearchText(e.target.value)} className="bestiary-search" />
        </div>
      </div>

      {loading ? (
        <div className="bestiary-loading">로딩중...</div>
      ) : skills.length === 0 ? (
        <div className="bestiary-empty">조건에 맞는 스킬이 없습니다.</div>
      ) : (
        <Row className="bestiary-grid g-2">
          {skills.map(skill => (
            <Col xs={6} sm={4} md={3} lg={2} key={skill.id}>
              <div className="bestiary-card skill-bestiary-card" onClick={() => setSelectedSkill(skill)}
                style={{ borderColor: SKILL_NODE_TYPE_COLORS[skill.node_type] || '#555' }}>
                <div className="bestiary-card-img skill-card-img">
                  <ImgWithFallback src={`/skills/${skill.id}_icon.png`} fallback={skill.icon}
                    className="skill-bestiary-icon" />
                </div>
                <div className="bestiary-card-info">
                  <div className="bestiary-card-name">{skill.name}</div>
                  <div className="skill-card-meta">
                    <span className="skill-card-type" style={{ color: SKILL_NODE_TYPE_COLORS[skill.node_type] }}>
                      {SKILL_NODE_TYPE_LABELS[skill.node_type]}
                    </span>
                    <span className="skill-card-class" style={{ color: CLASS_INFO[skill.class_type]?.color }}>
                      {skill.class_type}
                    </span>
                  </div>
                  <div className="bestiary-card-cat" style={{ fontSize: '0.6rem' }}>
                    {skill.branch_name} · {tierLabel(skill.tier)}
                  </div>
                </div>
              </div>
            </Col>
          ))}
        </Row>
      )}

      {/* Skill Detail Modal */}
      {ss && (
        <div className="bd-overlay" onClick={() => setSelectedSkill(null)}>
          <div className="bd-modal skill-detail-modal" onClick={e => e.stopPropagation()}>
            <button className="bd-close" onClick={() => setSelectedSkill(null)}>&times;</button>

            <div className="skill-detail-header" style={{ '--skill-color': SKILL_NODE_TYPE_COLORS[ss.node_type] || '#9ca3af' }}>
              <div className="skill-detail-icon-wrap">
                <ImgWithFallback src={`/skills/${ss.id}_icon.png`}
                  fallback={ss.icon} className="skill-detail-icon" />
              </div>
              <div className="skill-detail-info">
                <div className="skill-detail-name">{ss.name}</div>
                <div className="skill-detail-tags">
                  <span className="bd-tag" style={{ borderColor: CLASS_INFO[ss.class_type]?.color, color: CLASS_INFO[ss.class_type]?.color }}>
                    {CLASS_INFO[ss.class_type]?.icon} {ss.class_type}
                  </span>
                  <span className="bd-tag" style={{ borderColor: SKILL_NODE_TYPE_COLORS[ss.node_type], color: SKILL_NODE_TYPE_COLORS[ss.node_type] }}>
                    {SKILL_NODE_TYPE_LABELS[ss.node_type]}
                  </span>
                  <span className="bd-tag">{ss.branch_name}</span>
                  <span className="bd-tag" style={ss.tier >= 5 ? { borderColor: '#ff6b6b', color: '#ff6b6b' } : ss.tier === 4 ? { borderColor: '#fbbf24', color: '#fbbf24' } : {}}>
                    {tierLabel(ss.tier)}
                  </span>
                </div>
                <div className="skill-detail-desc">{ss.description}</div>
              </div>
            </div>

            <div className="bd-body">
              {ss.node_type === 'active' && (
                <div className="bd-section">
                  <h3 className="bd-section-title">스킬 능력치</h3>
                  <div className="equip-detail-stats">
                    {ss.mp_cost > 0 && (
                      <div className="equip-stat-row"><span className="equip-stat-icon">💎</span><span className="equip-stat-label">MP 소모</span><span className="equip-stat-value equip-sv-mp">{ss.mp_cost}</span></div>
                    )}
                    {ss.damage_multiplier > 1 && (
                      <div className="equip-stat-row"><span className="equip-stat-icon">⚔️</span><span className="equip-stat-label">데미지 배율</span><span className="equip-stat-value equip-sv-atk">x{ss.damage_multiplier}</span></div>
                    )}
                    {ss.damage_type && (
                      <div className="equip-stat-row"><span className="equip-stat-icon">{ss.damage_type === 'physical' ? '🗡️' : '✨'}</span><span className="equip-stat-label">데미지 유형</span><span className="equip-stat-value">{ss.damage_type === 'physical' ? '물리' : '마법'}</span></div>
                    )}
                    {ss.heal_amount > 0 && (
                      <div className="equip-stat-row"><span className="equip-stat-icon">💚</span><span className="equip-stat-label">치유량</span><span className="equip-stat-value equip-sv-hp">+{ss.heal_amount}</span></div>
                    )}
                    {ss.buff_stat && (
                      <div className="equip-stat-row"><span className="equip-stat-icon">✨</span><span className="equip-stat-label">버프 ({SKILL_STAT_LABELS[ss.buff_stat] || ss.buff_stat})</span><span className="equip-stat-value equip-sv-atk">+{ss.buff_value} ({ss.buff_duration}턴)</span></div>
                    )}
                    {ss.cooldown > 0 && (
                      <div className="equip-stat-row"><span className="equip-stat-icon">⏱️</span><span className="equip-stat-label">쿨타임</span><span className="equip-stat-value">{ss.cooldown}턴</span></div>
                    )}
                    {ss.skill_range > 1 && (
                      <div className="equip-stat-row"><span className="equip-stat-icon">📏</span><span className="equip-stat-label">사거리</span><span className="equip-stat-value">{ss.skill_range}</span></div>
                    )}
                  </div>
                </div>
              )}
              {ss.node_type === 'passive' && ss.passive_stat && (
                <div className="bd-section">
                  <h3 className="bd-section-title">패시브 효과</h3>
                  <div className="equip-detail-stats">
                    <div className="equip-stat-row">
                      <span className="equip-stat-icon">🔰</span>
                      <span className="equip-stat-label">{SKILL_STAT_LABELS[ss.passive_stat] || ss.passive_stat}</span>
                      <span className="equip-stat-value equip-sv-atk">+{ss.passive_value}{ss.passive_is_percent ? '%' : ''}</span>
                    </div>
                  </div>
                </div>
              )}
              <div className="bd-section">
                <h3 className="bd-section-title">습득 조건</h3>
                <div className="equip-detail-stats">
                  <div className="equip-stat-row"><span className="equip-stat-icon">📊</span><span className="equip-stat-label">필요 레벨</span><span className="equip-stat-value">{ss.required_level}</span></div>
                  <div className="equip-stat-row"><span className="equip-stat-icon">💠</span><span className="equip-stat-label">포인트 비용</span><span className="equip-stat-value">{ss.point_cost}</span></div>
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
   MONSTER SKILL TAB
   ================================ */
const MSKILL_TYPE_LABELS = { attack: '공격', heal: '치유', buff: '버프', debuff: '디버프', aoe: '광역' };
const MSKILL_TYPE_ICONS = { attack: '⚔️', heal: '💚', buff: '✨', debuff: '⬇️', aoe: '💥' };
const MSKILL_PATTERN_LABELS = { diamond: '마름모', cross: '십자', line: '직선' };

function MonsterSkillTab() {
  const [skills, setSkills] = useState([]);
  const [typeFilter, setTypeFilter] = useState('all');
  const [searchText, setSearchText] = useState('');
  const [selectedSkill, setSelectedSkill] = useState(null);
  const [loading, setLoading] = useState(true);

  const loadSkills = useCallback(async () => {
    setLoading(true);
    try {
      const params = {};
      if (typeFilter !== 'all') params.type = typeFilter;
      if (searchText) params.search = searchText;
      const res = await api.get('/monsters/skills/encyclopedia', { params });
      setSkills(res.data.skills);
    } catch { setSkills([]); }
    setLoading(false);
  }, [typeFilter, searchText]);

  useEffect(() => { loadSkills(); }, [loadSkills]);

  const ss = selectedSkill;

  return (
    <>
      <div className="bestiary-subtitle">{skills.length}종 몬스터 스킬</div>

      <div className="bestiary-filters">
        <div className="bestiary-filter-row">
          <div className="bestiary-cat-pills">
            <button className={`bestiary-pill ${typeFilter === 'all' ? 'active' : ''}`} onClick={() => setTypeFilter('all')}>전체</button>
            {Object.entries(MSKILL_TYPE_LABELS).map(([k, v]) => (
              <button key={k} className={`bestiary-pill ${typeFilter === k ? 'active' : ''}`}
                onClick={() => setTypeFilter(typeFilter === k ? 'all' : k)}
                style={typeFilter === k ? { borderColor: SKILL_TYPE_COLORS[k], color: SKILL_TYPE_COLORS[k] } : {}}>
                {MSKILL_TYPE_ICONS[k]} {v}
              </button>
            ))}
          </div>
        </div>
        <div className="bestiary-filter-row">
          <input type="text" placeholder="스킬 이름 검색..." value={searchText}
            onChange={e => setSearchText(e.target.value)} className="bestiary-search" />
        </div>
      </div>

      {loading ? (
        <div className="bestiary-loading">로딩중...</div>
      ) : skills.length === 0 ? (
        <div className="bestiary-empty">조건에 맞는 스킬이 없습니다.</div>
      ) : (
        <Row className="bestiary-grid g-2">
          {skills.map(skill => (
            <Col xs={6} sm={4} md={3} lg={2} key={skill.id}>
              <div className="bestiary-card mskill-card" onClick={() => setSelectedSkill(skill)}
                style={{ borderColor: SKILL_TYPE_COLORS[skill.type] || '#555' }}>
                <div className="bestiary-card-img mskill-card-icon">
                  <span className="mskill-icon-emoji">{skill.icon}</span>
                </div>
                <div className="bestiary-card-info">
                  <div className="bestiary-card-name">{skill.name}</div>
                  <div className="skill-card-meta">
                    <span className="skill-card-type" style={{ color: SKILL_TYPE_COLORS[skill.type] }}>
                      {MSKILL_TYPE_ICONS[skill.type]} {MSKILL_TYPE_LABELS[skill.type]}
                    </span>
                  </div>
                  <div className="bestiary-card-cat" style={{ fontSize: '0.6rem' }}>
                    {skill.monsterCount}마리 사용
                  </div>
                </div>
              </div>
            </Col>
          ))}
        </Row>
      )}

      {/* Monster Skill Detail Modal */}
      {ss && (
        <div className="bd-overlay" onClick={() => setSelectedSkill(null)}>
          <div className="bd-modal mskill-detail-modal" onClick={e => e.stopPropagation()}>
            <button className="bd-close" onClick={() => setSelectedSkill(null)}>&times;</button>

            <div className="mskill-detail-header">
              <span className="mskill-detail-icon">{ss.icon}</span>
              <div className="mskill-detail-info">
                <div className="skill-detail-name">{ss.name}</div>
                <div className="skill-detail-tags">
                  <span className="bd-tag" style={{ borderColor: SKILL_TYPE_COLORS[ss.type], color: SKILL_TYPE_COLORS[ss.type] }}>
                    {MSKILL_TYPE_ICONS[ss.type]} {MSKILL_TYPE_LABELS[ss.type]}
                  </span>
                  {ss.pattern && (
                    <span className="bd-tag">{MSKILL_PATTERN_LABELS[ss.pattern] || ss.pattern}</span>
                  )}
                </div>
                <div className="skill-detail-desc">{ss.description}</div>
              </div>
            </div>

            <div className="bd-body">
              <div className="bd-section">
                <h3 className="bd-section-title">스킬 능력치</h3>
                <div className="equip-detail-stats">
                  {ss.mp_cost > 0 && (
                    <div className="equip-stat-row"><span className="equip-stat-icon">💎</span><span className="equip-stat-label">MP 소모</span><span className="equip-stat-value equip-sv-mp">{ss.mp_cost}</span></div>
                  )}
                  {ss.damage_multiplier > 1 && (
                    <div className="equip-stat-row"><span className="equip-stat-icon">⚔️</span><span className="equip-stat-label">데미지 배율</span><span className="equip-stat-value equip-sv-atk">x{ss.damage_multiplier}</span></div>
                  )}
                  {ss.heal_amount > 0 && (
                    <div className="equip-stat-row"><span className="equip-stat-icon">💚</span><span className="equip-stat-label">치유량</span><span className="equip-stat-value equip-sv-hp">+{ss.heal_amount}</span></div>
                  )}
                  {ss.buff_stat && (
                    <div className="equip-stat-row"><span className="equip-stat-icon">{ss.buff_value > 0 ? '⬆️' : '⬇️'}</span><span className="equip-stat-label">{ss.buff_stat === 'attack' ? '공격력' : ss.buff_stat === 'defense' ? '방어력' : ss.buff_stat}</span><span className="equip-stat-value" style={{ color: ss.buff_value > 0 ? '#22c55e' : '#ef4444' }}>{ss.buff_value > 0 ? '+' : ''}{ss.buff_value}</span></div>
                  )}
                  {ss.cooldown > 0 && (
                    <div className="equip-stat-row"><span className="equip-stat-icon">⏱️</span><span className="equip-stat-label">쿨타임</span><span className="equip-stat-value">{ss.cooldown}턴</span></div>
                  )}
                  {ss.range_val > 0 && (
                    <div className="equip-stat-row"><span className="equip-stat-icon">📏</span><span className="equip-stat-label">사거리</span><span className="equip-stat-value">{ss.range_val}</span></div>
                  )}
                </div>
              </div>

              {ss.monsters && ss.monsters.length > 0 && (
                <div className="bd-section">
                  <h3 className="bd-section-title">사용 몬스터 ({ss.monsters.length})</h3>
                  <div className="mskill-monster-list">
                    {ss.monsters.map(m => (
                      <div key={m.id} className="mskill-monster-item">
                        <ImgWithFallback src={`/monsters/${m.id}_icon.png`} fallback={m.icon} className="mskill-monster-icon" />
                        <span className="mskill-monster-name">{m.name}</span>
                        <span className="mskill-monster-tier">T{m.tier}</span>
                      </div>
                    ))}
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
   TAROT CARD TAB (78-card collection)
   ================================ */
const BUFF_LABELS = {
  attack: '공격력', defense: '방어력', gold: '골드 획득',
  crit: '치명타율', regen: 'HP 회복', all: '공격·방어·골드',
};

const SUIT_FILTERS = [
  { key: 'all', label: '전체', icon: '🃏' },
  { key: 'major', label: '메이저', icon: '⭐' },
  { key: 'wands', label: '지팡이', icon: '🔥' },
  { key: 'cups', label: '성배', icon: '💧' },
  { key: 'swords', label: '검', icon: '⚔️' },
  { key: 'pentacles', label: '동전', icon: '🪙' },
];

const SUIT_NAMES = { major: '메이저 아르카나', wands: '지팡이', cups: '성배', swords: '검', pentacles: '동전' };
const SUIT_COLORS = { major: '#c084fc', wands: '#f97316', cups: '#60a5fa', swords: '#94a3b8', pentacles: '#fbbf24' };

function getSuit(card) {
  if (card.suit) return card.suit;
  if (card.index < 22) return 'major';
  if (card.index < 36) return 'wands';
  if (card.index < 50) return 'cups';
  if (card.index < 64) return 'swords';
  return 'pentacles';
}

function TarotTab() {
  const [cards, setCards] = useState([]);
  const [totalCount, setTotalCount] = useState(0);
  const [discoveredCount, setDiscoveredCount] = useState(0);
  const [filter, setFilter] = useState('all');
  const [suitFilter, setSuitFilter] = useState('all');
  const [selectedCard, setSelectedCard] = useState(null);
  const [loading, setLoading] = useState(true);

  const loadCollection = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get('/fortune/tarot/collection');
      setCards(res.data.cards);
      setTotalCount(res.data.totalCount);
      setDiscoveredCount(res.data.discoveredCount);
    } catch { setCards([]); }
    setLoading(false);
  }, []);

  useEffect(() => { loadCollection(); }, [loadCollection]);

  const filtered = cards.filter(c => {
    if (filter === 'discovered' && !c.discovered) return false;
    if (filter === 'undiscovered' && c.discovered) return false;
    if (suitFilter !== 'all' && getSuit(c) !== suitFilter) return false;
    return true;
  });

  const suitCounts = {};
  SUIT_FILTERS.forEach(s => {
    if (s.key === 'all') return;
    const inSuit = cards.filter(c => getSuit(c) === s.key);
    suitCounts[s.key] = { total: inSuit.length, discovered: inSuit.filter(c => c.discovered).length };
  });

  const pct = totalCount > 0 ? Math.round((discoveredCount / totalCount) * 100) : 0;
  const sc = selectedCard;
  const scSuit = sc ? getSuit(sc) : null;

  return (
    <>
      {/* 수집 진행도 */}
      <div className="tarot-progress-bar">
        <div className="tarot-progress-header">
          <span className="tarot-progress-label">🃏 타로 수집</span>
          <span className="tarot-progress-count">{discoveredCount}<span className="tarot-progress-total">/{totalCount}</span></span>
        </div>
        <div className="tarot-progress-track">
          <div className="tarot-progress-fill" style={{ width: `${pct}%` }} />
        </div>
        <div className="tarot-progress-suits">
          {SUIT_FILTERS.filter(s => s.key !== 'all').map(s => {
            const c = suitCounts[s.key];
            return (
              <span key={s.key} className="tarot-progress-suit" style={{ color: SUIT_COLORS[s.key] }}>
                {s.icon} {c ? c.discovered : 0}/{c ? c.total : 0}
              </span>
            );
          })}
        </div>
      </div>

      {/* 필터 */}
      <div className="bestiary-filters">
        <div className="bestiary-filter-row">
          <div className="bestiary-cat-pills">
            {SUIT_FILTERS.map(f => (
              <button key={f.key}
                className={`bestiary-pill tarot-suit-pill${suitFilter === f.key ? ' active' : ''}`}
                style={suitFilter === f.key && f.key !== 'all' ? { borderColor: SUIT_COLORS[f.key], color: SUIT_COLORS[f.key], background: `${SUIT_COLORS[f.key]}12` } : {}}
                onClick={() => setSuitFilter(f.key)}>
                {f.icon} {f.label}
                {f.key !== 'all' && suitCounts[f.key] && (
                  <span className="tarot-pill-count">{suitCounts[f.key].discovered}/{suitCounts[f.key].total}</span>
                )}
              </button>
            ))}
          </div>
        </div>
        <div className="bestiary-filter-row">
          <div className="bestiary-cat-pills">
            {[
              { key: 'all', label: '전체' },
              { key: 'discovered', label: '✨ 발견' },
              { key: 'undiscovered', label: '❓ 미발견' },
            ].map(f => (
              <button key={f.key} className={`bestiary-pill ${filter === f.key ? 'active' : ''}`}
                onClick={() => setFilter(f.key)}>
                {f.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {loading ? (
        <div className="bestiary-loading">로딩중...</div>
      ) : filtered.length === 0 ? (
        <div className="bestiary-empty">조건에 맞는 카드가 없습니다.</div>
      ) : (
        <div className="tarot-collection-grid">
          {filtered.map(card => {
            const suit = getSuit(card);
            const sColor = SUIT_COLORS[suit];
            return (
              <div key={card.index}
                className={`tarot-col-card${card.discovered ? ' discovered' : ' undiscovered'}`}
                style={card.discovered ? { '--suit-color': sColor } : {}}
                onClick={() => setSelectedCard(card)}>
                <div className="tarot-col-img">
                  {card.discovered ? (
                    <img src={`/tarot/${card.index}.png`} alt={card.name} />
                  ) : (
                    <img src="/tarot/back.png" alt="미발견" className="tarot-col-undiscovered" />
                  )}
                  {card.discovered && (
                    <div className="tarot-col-suit-badge" style={{ background: sColor }}>
                      {SUIT_FILTERS.find(s => s.key === suit)?.icon}
                    </div>
                  )}
                </div>
                <div className="tarot-col-info">
                  <div className="tarot-col-number" style={{ color: sColor }}>
                    No.{card.index}
                  </div>
                  <div className="tarot-col-name">{card.discovered ? card.name : '???'}</div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* 상세 모달 */}
      {sc && (
        <div className="bd-overlay" onClick={() => setSelectedCard(null)}>
          <div className="bd-modal tarot-detail-modal" onClick={e => e.stopPropagation()}>
            <button className="bd-close" onClick={() => setSelectedCard(null)}>&times;</button>

            {/* 카드 이미지 배경 */}
            <div className="tarot-detail-hero" style={{ '--suit-color': SUIT_COLORS[scSuit] || '#c084fc' }}>
              <div className="tarot-detail-hero-bg" />
              <div className="tarot-detail-hero-content">
                <div className="tarot-detail-img-wrap" style={{ borderColor: SUIT_COLORS[scSuit] }}>
                  {sc.discovered ? (
                    <img src={`/tarot/${sc.index}.png`} alt={sc.name} className="tarot-detail-img" />
                  ) : (
                    <img src="/tarot/back.png" alt="미발견" className="tarot-detail-img tarot-col-undiscovered" />
                  )}
                </div>
                <div className="tarot-detail-info">
                  <div className="tarot-detail-suit-badge" style={{ background: SUIT_COLORS[scSuit], color: scSuit === 'pentacles' || scSuit === 'wands' ? '#000' : '#fff' }}>
                    {SUIT_FILTERS.find(s => s.key === scSuit)?.icon} {SUIT_NAMES[scSuit]}
                  </div>
                  <div className="tarot-detail-number">No. {sc.index}</div>
                  <div className="tarot-detail-name">{sc.discovered ? sc.name : '???'}</div>
                  {sc.discovered && <div className="tarot-detail-name-en">{sc.nameEn}</div>}
                  {sc.discovered && (
                    <div className="tarot-detail-buff-tag">
                      {BUFF_LABELS[sc.buff_type]} +{sc.buff_value}%
                    </div>
                  )}
                  {sc.discovered && sc.discovered_at && (
                    <div className="tarot-detail-discovered">
                      발견일: {new Date(sc.discovered_at).toLocaleDateString('ko-KR')}
                    </div>
                  )}
                </div>
              </div>
            </div>

            {sc.discovered && (
              <div className="bd-body">
                <div className="bd-section">
                  <h3 className="bd-section-title">카드 해석</h3>
                  <div className="tarot-interp-pair">
                    <div className="tarot-interp upright">
                      <div className="tarot-interp-header">
                        <span className="tarot-interp-dir">↑ 정방향</span>
                        <span className="tarot-interp-buff">
                          {BUFF_LABELS[sc.buff_type]} +{sc.buff_value}%
                        </span>
                      </div>
                      <p className="tarot-interp-text">{sc.upright}</p>
                    </div>
                    <div className="tarot-interp reversed">
                      <div className="tarot-interp-header">
                        <span className="tarot-interp-dir">↓ 역방향</span>
                        <span className="tarot-interp-buff dim">
                          {BUFF_LABELS[sc.buff_type]} +{Math.round(sc.buff_value * 0.5)}%
                        </span>
                      </div>
                      <p className="tarot-interp-text">{sc.reversed}</p>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {!sc.discovered && (
              <div className="bd-body">
                <div className="tarot-undiscovered-msg">
                  <span className="tarot-undiscovered-icon">🔮</span>
                  <p>아직 발견하지 못한 카드입니다.</p>
                  <p className="tarot-undiscovered-hint">운명술사의 집에서 타로 점술을 통해 발견할 수 있습니다.</p>
                </div>
              </div>
            )}
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
          <span>몬스터</span>
        </button>
        <button className={`bestiary-main-tab ${mainTab === 'equipment' ? 'active' : ''}`} onClick={() => setMainTab('equipment')}>
          <ImgWithFallback src="/ui/tab_equipment_bestiary.png" className="bestiary-tab-icon" fallback="⚔️" />
          <span>장비</span>
        </button>
        <button className={`bestiary-main-tab ${mainTab === 'skill' ? 'active' : ''}`} onClick={() => setMainTab('skill')}>
          <ImgWithFallback src="/ui/tab_skill_bestiary.png" className="bestiary-tab-icon" fallback="💠" />
          <span>스킬</span>
        </button>
        <button className={`bestiary-main-tab ${mainTab === 'mskill' ? 'active' : ''}`} onClick={() => setMainTab('mskill')}>
          <span className="bestiary-tab-icon" style={{ fontSize: 18 }}>👹</span>
          <span>몬스터 스킬</span>
        </button>
        <button className={`bestiary-main-tab ${mainTab === 'tarot' ? 'active' : ''}`} onClick={() => setMainTab('tarot')}>
          <span className="bestiary-tab-icon" style={{ fontSize: 18 }}>🃏</span>
          <span>타로</span>
        </button>
      </div>

      {/* Tab Content */}
      {mainTab === 'monster' ? <MonsterTab /> : mainTab === 'equipment' ? <EquipmentTab /> : mainTab === 'skill' ? <SkillTab /> : mainTab === 'mskill' ? <MonsterSkillTab /> : <TarotTab />}
    </div>
  );
}

export default MonsterBestiary;
