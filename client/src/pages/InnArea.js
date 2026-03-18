import React, { useState, useEffect, useCallback } from 'react';
import api from '../api';
import GachaPopup from './GachaPopup';
import './InnArea.css';

const WEAPON_ICONS = {
  sword: '⚔️', spear: '🔱', bow: '🏹', dagger: '🗡️', staff: '🪄', talisman: '📜', default: '⚔️',
};

const ELEMENT_INFO = {
  fire:    { name: '불', icon: '🔥', color: '#ff6b35' },
  water:   { name: '물', icon: '💧', color: '#4da6ff' },
  earth:   { name: '땅', icon: '🪨', color: '#8bc34a' },
  wind:    { name: '바람', icon: '🌀', color: '#b388ff' },
  neutral: { name: '중립', icon: '⚪', color: '#9ca3af' },
};

const RANGE_LABELS = { melee: '근거리', ranged: '원거리', magic: '마법' };

const starDisplay = (sl) => { const s = sl || 0; return s === 0 ? '☆' : '★'.repeat(s); };
const GRADE_COLORS = {
  '일반': '#9ca3af', '고급': '#4ade80', '희귀': '#60a5fa',
  '영웅': '#c084fc', '전설': '#fbbf24', '신화': '#ff6b6b', '초월': '#ff44cc',
};
const GRADE_STARS = { '일반': '★', '고급': '★★', '희귀': '★★★', '영웅': '★★★★', '전설': '★★★★★', '신화': '★★★★★★', '초월': '★★★★★★★' };

const ELEMENT_AURA = {
  fire: 'flame', water: 'ice', earth: 'aura_gold', wind: 'wind', neutral: 'holy',
  light: 'holy', dark: 'shadow', lightning: 'lightning', poison: 'poison',
};

const NPC_MESSAGES = {
  templates: [
    '어서 오세요, 여행자! 뛰어난 용병들이 기다리고 있답니다.',
    '좋은 동료가 있으면 던전도 두렵지 않죠!',
    '용병들은 전투 경험을 쌓으면 더 강해집니다.',
  ],
  my: [
    '당신의 용병들을 잘 관리하세요. 충성스러운 부하들이에요.',
    '더 이상 필요 없는 용병은 해고할 수 있습니다.',
    '용병도 전투에서 경험치를 얻어 성장합니다!',
  ],
};

function NpcImg({ className }) {
  const [err, setErr] = useState(false);
  if (err) return <span className={className}>🏨</span>;
  return <img src="/village/innkeeper_portrait.png" alt="여관주인" className={className} onError={() => setErr(true)} />;
}

function MercImg({ src, fallback, className }) {
  const [err, setErr] = useState(false);
  if (err) return <span className={className}>{fallback || '⚔️'}</span>;
  return <img src={src} alt="" className={className} onError={() => setErr(true)} />;
}

function InnArea({ charState, onCharStateUpdate, onLog, onMercenariesChanged, initialTab }) {
  const [tab, setTab] = useState(initialTab || 'templates');
  const [templates, setTemplates] = useState([]);
  const [myMercs, setMyMercs] = useState([]);
  const [mercSlots, setMercSlots] = useState({ current: 0, max: 1, next: null });
  const [selectedTemplate, setSelectedTemplate] = useState(null);
  const [selectedMerc, setSelectedMerc] = useState(null);
  const [loading, setLoading] = useState(false);
  const [restPopup, setRestPopup] = useState(null); // { merc, cost }
  const [npcMsg, setNpcMsg] = useState('');
  const [mercAuras, setMercAuras] = useState({});

  const updateNpcMsg = useCallback((t) => {
    const msgs = NPC_MESSAGES[t] || NPC_MESSAGES.templates;
    setNpcMsg(msgs[Math.floor(Math.random() * msgs.length)]);
  }, []);

  useEffect(() => { updateNpcMsg(tab); }, [tab, updateNpcMsg]);

  const loadTemplates = useCallback(async () => {
    try {
      const res = await api.get('/mercenary/templates');
      setTemplates(res.data.templates);
    } catch {}
  }, []);

  const loadMyMercs = useCallback(async () => {
    try {
      const res = await api.get('/mercenary/my');
      setMyMercs(res.data.mercenaries);
      if (res.data.mercSlots) setMercSlots(res.data.mercSlots);
    } catch {}
  }, []);

  const loadAuras = useCallback(async () => {
    try {
      const res = await api.get('/shop/cosmetics/equipped');
      setMercAuras(res.data.cosmetics || {});
    } catch {}
  }, []);

  // 조각 교환 데이터
  const [shardInfo, setShardInfo] = useState({ shards: {}, recipes: [], tickets: {} });
  const [exchangeLoading, setExchangeLoading] = useState(false);
  const [gachaPopup, setGachaPopup] = useState(null); // { ticketType, ticketName }

  const loadShardInfo = useCallback(async () => {
    try {
      const res = await api.get('/gacha/tickets');
      setShardInfo({
        shards: res.data.shards || {},
        recipes: (res.data.recipes || []).filter(r => r.ticket_type === 'mercenary'),
        tickets: res.data.tickets || {},
      });
    } catch {}
  }, []);

  const handleExchange = async (recipeId) => {
    setExchangeLoading(true);
    try {
      const res = await api.post('/gacha/exchange', { recipeId });
      onLog(res.data.message, 'heal');
      await loadShardInfo();
    } catch (err) {
      onLog(err.response?.data?.message || '교환 실패', 'damage');
    }
    setExchangeLoading(false);
  };

  const handleGachaPull = async (ticketType) => {
    const res = await api.post('/gacha/mercenary', { ticketType });
    onLog(res.data.message, res.data.result?.resultType === 'new' ? 'heal' : 'normal');
    return res.data.result; // GachaPopup에서 사용
  };

  const handleGachaComplete = async () => {
    await loadShardInfo();
    await loadMyMercs();
    if (onMercenariesChanged) onMercenariesChanged();
  };

  useEffect(() => { loadTemplates(); loadMyMercs(); loadAuras(); loadShardInfo(); }, [loadTemplates, loadMyMercs, loadAuras, loadShardInfo]);

  const handleHire = async (templateId) => {
    setLoading(true);
    try {
      const res = await api.post('/mercenary/hire', { templateId });
      onLog(res.data.message, 'heal');
      onCharStateUpdate({ gold: res.data.gold });
      await loadMyMercs();
      if (onMercenariesChanged) onMercenariesChanged();
    } catch (err) {
      onLog(err.response?.data?.message || '고용 실패', 'damage');
    }
    setLoading(false);
  };

  const handleFire = async (mercenaryId) => {
    setLoading(true);
    try {
      const res = await api.post('/mercenary/fire', { mercenaryId });
      onLog(res.data.message, 'heal');
      setSelectedMerc(null);
      await loadMyMercs();
      if (onMercenariesChanged) onMercenariesChanged();
    } catch (err) {
      onLog(err.response?.data?.message || '해고 실패', 'damage');
    }
    setLoading(false);
  };

  const handleMercRest = async (mercenaryId, payType) => {
    setLoading(true);
    try {
      const res = await api.post('/mercenary/rest-merc', { mercenaryId, payType });
      onLog(res.data.message, 'heal');
      onCharStateUpdate({ gold: res.data.gold, stamina: res.data.stamina, maxStamina: res.data.maxStamina });
      setRestPopup(null);
      await loadMyMercs();
      // 선택된 용병 갱신
      setSelectedMerc(prev => prev ? { ...prev, fatigue: prev.max_fatigue } : null);
    } catch (err) {
      onLog(err.response?.data?.message || '휴식 실패', 'damage');
    }
    setLoading(false);
  };

  const restCost = Math.max(10, Math.floor((charState.level || 1) * 5));
  const isFullHp = (charState.currentHp || 0) >= (charState.maxHp || 1) && (charState.currentMp || 0) >= (charState.maxMp || 1);

  const handleRest = async (payType = 'gold') => {
    if (loading) return;
    setLoading(true);
    try {
      const res = await api.post('/mercenary/rest', { payType });
      onLog(res.data.message, 'heal');
      onCharStateUpdate({
        currentHp: res.data.currentHp,
        currentMp: res.data.currentMp,
        maxHp: res.data.maxHp,
        maxMp: res.data.maxMp,
        gold: res.data.gold,
        stamina: res.data.stamina,
        maxStamina: res.data.maxStamina,
      });
      setNpcMsg('푹 쉬었으니 이제 다시 힘을 낼 수 있겠구만!');
    } catch (err) {
      onLog(err.response?.data?.message || '휴식 실패', 'damage');
      if (err.response?.data?.message) setNpcMsg(err.response.data.message);
    }
    setLoading(false);
  };

  const handleTabChange = (t) => {
    setTab(t);
    setSelectedTemplate(null);
    setSelectedMerc(null);
  };

  return (
    <div className="facility-page inn-page">
      {/* 배너 */}
      <div className="facility-banner">
        <img src="/village/innkeeper_banner.png" alt="" className="facility-banner-img" onError={(e) => { e.target.style.display='none'; }} />
        <div className="facility-banner-overlay" />
        <div className="facility-banner-title">여관</div>
      </div>

      {/* NPC */}
      <div className="facility-npc">
        <div className="facility-npc-portrait-wrap">
          <NpcImg className="facility-npc-portrait" />
        </div>
        <div className="facility-npc-speech">
          <div className="facility-npc-name">여관주인 김 옥분</div>
          <div className="facility-npc-msg">{npcMsg}</div>
        </div>
        <div className="facility-gold">{(charState.gold || 0).toLocaleString()} G</div>
      </div>

      {/* 휴식 섹션 */}
      <div className="inn-rest-section">
        <div className="inn-rest-info">
          <div className="inn-rest-bars">
            <div className="inn-rest-bar">
              <span className="inn-rest-bar-label">HP</span>
              <div className="inn-rest-bar-track">
                <div className="inn-rest-bar-fill hp" style={{ width: `${((charState.currentHp || 0) / (charState.maxHp || 1)) * 100}%` }} />
              </div>
              <span className="inn-rest-bar-text">{charState.currentHp || 0}/{charState.maxHp || 0}</span>
            </div>
            <div className="inn-rest-bar">
              <span className="inn-rest-bar-label">MP</span>
              <div className="inn-rest-bar-track">
                <div className="inn-rest-bar-fill mp" style={{ width: `${((charState.currentMp || 0) / (charState.maxMp || 1)) * 100}%` }} />
              </div>
              <span className="inn-rest-bar-text">{charState.currentMp || 0}/{charState.maxMp || 0}</span>
            </div>
          </div>
          <div className="inn-rest-btns">
            <button
              className={`inn-rest-btn gold ${isFullHp ? 'disabled' : ''}`}
              disabled={loading || isFullHp || charState.gold < restCost}
              onClick={() => handleRest('gold')}
            >
              {loading ? '휴식 중...' : isFullHp ? '컨디션 최상' : charState.gold < restCost ? '골드 부족' : `${restCost}G`}
            </button>
            <span className="inn-rest-or">or</span>
            <button
              className={`inn-rest-btn stamina ${isFullHp ? 'disabled' : ''}`}
              disabled={loading || isFullHp || (charState.stamina || 0) <= 0}
              onClick={() => handleRest('stamina')}
            >
              {isFullHp ? '최상' : (charState.stamina || 0) <= 0 ? '행동력 없음' : '⚡1'}
            </button>
          </div>
        </div>
      </div>

      {/* 탭 */}
      <div className="facility-tabs">
        {(() => {
          const hasShards = (shardInfo.shards['용병소환 조각'] || 0) >= 30;
          const hasTickets = (shardInfo.tickets['mercenary'] || 0) > 0 || (shardInfo.tickets['mercenary_premium'] || 0) > 0;
          const gachaGlow = hasShards || hasTickets;
          return [
            { id: 'templates', label: '용병 고용' },
            { id: 'my', label: `내 용병 (${mercSlots.current}/${mercSlots.max})` },
            { id: 'gacha', label: `조각 교환 🗡️`, glow: gachaGlow },
          ].map(t => (
          <button
            key={t.id}
            className={`facility-tab${tab === t.id ? ' active' : ''}${t.glow && tab !== t.id ? ' tab-glow' : ''}`}
            onClick={() => handleTabChange(t.id)}
          >
            {t.label}
          </button>
        ));
        })()}
      </div>

      {/* 용병 고용 탭 */}
      {tab === 'templates' && (
        <div className="inn-content">
          <div className="inn-list">
            {templates.filter(t => !myMercs.some(m => m.template_id === t.id)).map(t => {
              const canHire = charState.level >= t.required_level && charState.gold >= t.price && myMercs.length < mercSlots.max;
              const el = ELEMENT_INFO[t.element] || ELEMENT_INFO.neutral;
              return (
                <div
                  key={t.id}
                  className={`inn-merc-card${selectedTemplate?.id === t.id ? ' selected' : ''}${!canHire ? ' disabled' : ''}`}
                  onClick={() => setSelectedTemplate(t)}
                >
                  <div className="inn-merc-icon">
                    <div className={`cb-portrait-effect cb-effect-${ELEMENT_AURA[t.element] || 'aura_gold'}`} style={{ position: 'absolute', inset: 0, borderRadius: 'inherit', zIndex: 0, opacity: 0.6 }} />
                    <MercImg src={`/mercenaries_nobg/${t.id}_icon.png`} fallback={WEAPON_ICONS[t.weapon_type] || '⚔️'} className="inn-merc-img" />
                  </div>
                  <div className="inn-merc-info">
                    <div className="inn-merc-name">
                      <span className="inn-grade-badge" style={{ background: GRADE_COLORS[t.grade] || '#9ca3af' }}>{t.grade || '일반'}</span>
                      {t.name}
                      <span className="inn-merc-class">{t.class_type}</span>
                      <span style={{ fontSize: 10, color: '#666', marginLeft: 4 }}>☆</span>
                    </div>
                    <div className="inn-merc-meta">
                      <span style={{ color: el.color }}>{el.icon}{el.name}</span>
                      <span>{RANGE_LABELS[t.range_type] || '근거리'}</span>
                      <span>{WEAPON_ICONS[t.weapon_type] || '⚔️'}{t.weapon_type}</span>
                      {charState.level < t.required_level && (
                        <span className="inn-merc-level-warn">Lv.{t.required_level} 필요</span>
                      )}
                    </div>
                    <div className="inn-merc-desc">{t.description}</div>
                  </div>
                  <div className="inn-merc-price">{t.price.toLocaleString()}G</div>
                </div>
              );
            })}
          </div>

          {selectedTemplate && (
            <div className="inn-detail">
              <div className="inn-detail-header">
                <div className="inn-detail-portrait-wrap">
                  <div className={`cb-portrait-effect cb-effect-${ELEMENT_AURA[selectedTemplate.element] || 'aura_gold'}`} style={{ position: 'absolute', inset: 0, borderRadius: '10px', zIndex: 0, opacity: 0.6 }} />
                  <MercImg src={`/mercenaries_nobg/${selectedTemplate.id}_full.png`} fallback={WEAPON_ICONS[selectedTemplate.weapon_type]} className="inn-detail-portrait" />
                </div>
                <div>
                  <h3 style={{ color: GRADE_COLORS[selectedTemplate.grade] || '#eee' }}>
                    {selectedTemplate.grade && selectedTemplate.grade !== '일반' && (
                      <span className="inn-grade-badge" style={{ background: GRADE_COLORS[selectedTemplate.grade], marginRight: 6, verticalAlign: 'middle' }}>{selectedTemplate.grade}</span>
                    )}
                    {selectedTemplate.name}
                  </h3>
                  <div className="inn-detail-sub">
                    {selectedTemplate.class_type} ·
                    <span style={{ color: (ELEMENT_INFO[selectedTemplate.element] || ELEMENT_INFO.neutral).color }}>
                      {' '}{(ELEMENT_INFO[selectedTemplate.element] || ELEMENT_INFO.neutral).icon}
                      {(ELEMENT_INFO[selectedTemplate.element] || ELEMENT_INFO.neutral).name}
                    </span>
                    {' '}· {RANGE_LABELS[selectedTemplate.range_type] || '근거리'}
                  </div>
                  <div className="inn-detail-desc">{selectedTemplate.description}</div>
                </div>
              </div>

              <div className="inn-detail-stats">
                <div className="inn-stat-row"><span>HP</span><span>{selectedTemplate.base_hp}</span></div>
                <div className="inn-stat-row"><span>MP</span><span>{selectedTemplate.base_mp}</span></div>
                <div className="inn-stat-row"><span>물리공격</span><span>{selectedTemplate.base_phys_attack}</span></div>
                <div className="inn-stat-row"><span>물리방어</span><span>{selectedTemplate.base_phys_defense}</span></div>
                <div className="inn-stat-row"><span>마법공격</span><span>{selectedTemplate.base_mag_attack}</span></div>
                <div className="inn-stat-row"><span>마법방어</span><span>{selectedTemplate.base_mag_defense}</span></div>
                <div className="inn-stat-row"><span>치명타율</span><span>{selectedTemplate.base_crit_rate}%</span></div>
                <div className="inn-stat-row"><span>회피율</span><span>{selectedTemplate.base_evasion}%</span></div>
              </div>

              <div className="inn-detail-growth">
                <div className="inn-growth-title">레벨업 성장</div>
                <div className="inn-growth-grid">
                  <span>HP +{selectedTemplate.growth_hp}</span>
                  <span>MP +{selectedTemplate.growth_mp}</span>
                  <span>물공 +{selectedTemplate.growth_phys_attack}</span>
                  <span>물방 +{selectedTemplate.growth_phys_defense}</span>
                  <span>마공 +{selectedTemplate.growth_mag_attack}</span>
                  <span>마방 +{selectedTemplate.growth_mag_defense}</span>
                </div>
              </div>

              <div className="inn-slot-info">
                용병 슬롯: {mercSlots.current}/{mercSlots.max}
                {mercSlots.next && <span className="inn-slot-next"> (Lv.{mercSlots.next.level}에서 {mercSlots.next.slots}명)</span>}
              </div>
              <button
                className="inn-hire-btn"
                disabled={loading || charState.level < selectedTemplate.required_level || charState.gold < selectedTemplate.price || myMercs.length >= mercSlots.max}
                onClick={() => handleHire(selectedTemplate.id)}
              >
                {loading ? '고용 중...' :
                 charState.level < selectedTemplate.required_level ? `Lv.${selectedTemplate.required_level} 필요` :
                 charState.gold < selectedTemplate.price ? '골드 부족' :
                 myMercs.length >= mercSlots.max ? `슬롯 부족 ${mercSlots.next ? `(Lv.${mercSlots.next.level} 해금)` : ''}` :
                 `${selectedTemplate.price.toLocaleString()}G로 고용`}
              </button>
            </div>
          )}
        </div>
      )}

      {/* 내 용병 탭 */}
      {tab === 'my' && (
        <div className="inn-content">
          <div className="inn-list">
            {myMercs.length === 0 ? (
              <div className="facility-empty">고용한 용병이 없습니다.</div>
            ) : myMercs.map(m => {
              const el = ELEMENT_INFO[m.element] || ELEMENT_INFO.neutral;
              const expNeeded = Math.floor(60 * m.level + 1.5 * m.level * m.level);
              return (
                <div
                  key={m.id}
                  className={`inn-merc-card${selectedMerc?.id === m.id ? ' selected' : ''}`}
                  onClick={() => setSelectedMerc(m)}
                >
                  <div className="inn-merc-icon">
                    <div className={`cb-portrait-effect cb-effect-${mercAuras[`merc_${m.id}`]?.effect || ELEMENT_AURA[m.element] || 'aura_gold'}`} style={{ position: 'absolute', inset: 0, borderRadius: 'inherit', zIndex: 0 }} />
                    <MercImg src={`/mercenaries_nobg/${m.template_id}_icon.png`} fallback={WEAPON_ICONS[m.weapon_type] || '⚔️'} className="inn-merc-img" />
                    <span className="inn-merc-level-badge">Lv.{m.level}</span>
                  </div>
                  <div className="inn-merc-info">
                    <div className="inn-merc-name">
                      <span className="inn-grade-badge" style={{ background: GRADE_COLORS[m.grade] || '#9ca3af' }}>{m.grade || '일반'}</span>
                      {m.name}
                      <span className="inn-merc-class">{m.class_type}</span>
                      <span style={{ fontSize: 10, color: GRADE_COLORS[m.grade] || '#fbbf24', marginLeft: 4 }}>{starDisplay(m.star_level)}</span>
                    </div>
                    <div className="inn-merc-meta">
                      <span style={{ color: el.color }}>{el.icon}{el.name}</span>
                      <span>{RANGE_LABELS[m.range_type] || '근거리'}</span>
                      <span>HP {m.hp}</span>
                      <span>물공 {m.phys_attack}</span>
                    </div>
                    <div className="inn-merc-exp-bar">
                      <div className="inn-merc-exp-fill" style={{ width: `${(m.exp / expNeeded) * 100}%` }} />
                      <span className="inn-merc-exp-text">EXP {m.exp}/{expNeeded}</span>
                    </div>
                    <div className="inn-merc-fatigue">
                      <span style={{ color: m.fatigue <= 0 ? '#ef4444' : m.fatigue <= 2 ? '#f59e0b' : '#4ade80' }}>
                        피로도 {m.fatigue ?? m.max_fatigue ?? 7}/{m.max_fatigue ?? 7}
                      </span>
                      {m.fatigue <= 0 && <span className="inn-fatigue-warn">지침</span>}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {selectedMerc && (
            <div className="inn-detail">
              <div className="inn-detail-header">
                <div className="inn-detail-portrait-wrap">
                  <div className={`cb-portrait-effect cb-effect-${mercAuras[`merc_${selectedMerc.id}`]?.effect || ELEMENT_AURA[selectedMerc.element] || 'aura_gold'}`} style={{ position: 'absolute', inset: 0, borderRadius: '10px', zIndex: 0 }} />
                  <MercImg src={`/mercenaries_nobg/${selectedMerc.template_id}_full.png`} fallback={WEAPON_ICONS[selectedMerc.weapon_type]} className="inn-detail-portrait" />
                </div>
                <div>
                  <h3 style={{ color: GRADE_COLORS[selectedMerc.grade] || '#eee' }}>
                    <span className="inn-grade-badge" style={{ background: GRADE_COLORS[selectedMerc.grade] || '#9ca3af', marginRight: 6, verticalAlign: 'middle' }}>{selectedMerc.grade || '일반'}</span>
                    {selectedMerc.name} <span className="inn-detail-level">Lv.{selectedMerc.level}</span>
                    <span style={{ fontSize: 12, color: GRADE_COLORS[selectedMerc.grade] || '#fbbf24', marginLeft: 6 }}>{starDisplay(selectedMerc.star_level)}</span>
                  </h3>
                  <div className="inn-detail-sub">
                    {selectedMerc.class_type} ·
                    <span style={{ color: (ELEMENT_INFO[selectedMerc.element] || ELEMENT_INFO.neutral).color }}>
                      {' '}{(ELEMENT_INFO[selectedMerc.element] || ELEMENT_INFO.neutral).icon}
                      {(ELEMENT_INFO[selectedMerc.element] || ELEMENT_INFO.neutral).name}
                    </span>
                    {' '}· {RANGE_LABELS[selectedMerc.range_type] || '근거리'}
                  </div>
                </div>
              </div>

              <div className="inn-detail-fatigue">
                <span className="inn-fatigue-label">피로도</span>
                <div className="inn-fatigue-bar">
                  <div className="inn-fatigue-fill" style={{
                    width: `${((selectedMerc.fatigue ?? selectedMerc.max_fatigue ?? 7) / (selectedMerc.max_fatigue ?? 7)) * 100}%`,
                    background: (selectedMerc.fatigue ?? selectedMerc.max_fatigue) <= 0 ? '#ef4444' : (selectedMerc.fatigue ?? selectedMerc.max_fatigue) <= 2 ? '#f59e0b' : '#4ade80'
                  }} />
                </div>
                <span className="inn-fatigue-text" style={{ color: (selectedMerc.fatigue ?? selectedMerc.max_fatigue) <= 0 ? '#ef4444' : '#eee' }}>
                  {selectedMerc.fatigue ?? selectedMerc.max_fatigue ?? 7}/{selectedMerc.max_fatigue ?? 7}
                </span>
                {(selectedMerc.fatigue ?? selectedMerc.max_fatigue) <= 0 && <span className="inn-fatigue-warn">HP/MP 0으로 참전</span>}
              </div>

              <div className="inn-detail-stats">
                <div className="inn-stat-row"><span>HP</span><span>{selectedMerc.hp}</span></div>
                <div className="inn-stat-row"><span>MP</span><span>{selectedMerc.mp}</span></div>
                <div className="inn-stat-row"><span>물리공격</span><span>{selectedMerc.phys_attack}</span></div>
                <div className="inn-stat-row"><span>물리방어</span><span>{selectedMerc.phys_defense}</span></div>
                <div className="inn-stat-row"><span>마법공격</span><span>{selectedMerc.mag_attack}</span></div>
                <div className="inn-stat-row"><span>마법방어</span><span>{selectedMerc.mag_defense}</span></div>
                <div className="inn-stat-row"><span>치명타율</span><span>{selectedMerc.crit_rate}%</span></div>
                <div className="inn-stat-row"><span>회피율</span><span>{selectedMerc.evasion}%</span></div>
              </div>

              <div className="inn-detail-growth">
                <div className="inn-growth-title">레벨업 성장</div>
                <div className="inn-growth-grid">
                  <span>HP +{selectedMerc.growth_hp}</span>
                  <span>MP +{selectedMerc.growth_mp}</span>
                  <span>물공 +{selectedMerc.growth_phys_attack}</span>
                  <span>물방 +{selectedMerc.growth_phys_defense}</span>
                  <span>마공 +{selectedMerc.growth_mag_attack}</span>
                  <span>마방 +{selectedMerc.growth_mag_defense}</span>
                </div>
              </div>

              <div className="inn-detail-btn-row">
                <button
                  className="inn-rest-merc-btn"
                  disabled={loading || (selectedMerc.fatigue ?? selectedMerc.max_fatigue) >= (selectedMerc.max_fatigue ?? 7)}
                  onClick={() => setRestPopup({ merc: selectedMerc, cost: Math.max(20, Math.floor((selectedMerc.level || 1) * 10)) })}
                >
                  {(selectedMerc.fatigue ?? selectedMerc.max_fatigue) >= (selectedMerc.max_fatigue ?? 7) ? '컨디션 최상' : '휴식'}
                </button>
                <button
                  className="inn-fire-btn"
                  disabled={loading}
                  onClick={() => setRestPopup({ merc: selectedMerc, fireConfirm: true })}
                >
                  해고
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* 용병 소환 (조각 교환 + 가챠) 탭 */}
      {tab === 'gacha' && (
        <div className="inn-content" style={{ flexDirection: 'column', gap: 12 }}>
          {/* 조각 보유량 */}
          <div style={{ background: '#181c2e', borderRadius: 10, padding: '14px 18px', display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ fontSize: 22 }}>🗡️</span>
              <div>
                <div style={{ fontSize: 11, color: '#888' }}>용병소환 조각</div>
                <div style={{ fontSize: 18, fontWeight: 700, color: '#fbbf24' }}>{shardInfo.shards['용병소환 조각'] || 0}개</div>
              </div>
            </div>
            <div style={{ height: 30, width: 1, background: '#333' }} />
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ fontSize: 18 }}>📜</span>
              <div>
                <div style={{ fontSize: 11, color: '#888' }}>용병소환권</div>
                <div style={{ fontSize: 16, fontWeight: 700, color: '#c084fc' }}>{shardInfo.tickets['mercenary'] || 0}장</div>
              </div>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ fontSize: 18 }}>🌟</span>
              <div>
                <div style={{ fontSize: 11, color: '#888' }}>고급용병소환권</div>
                <div style={{ fontSize: 16, fontWeight: 700, color: '#fbbf24' }}>{shardInfo.tickets['mercenary_premium'] || 0}장</div>
              </div>
            </div>
          </div>

          {/* 조각 → 소환권 교환 */}
          <div style={{ background: '#181c2e', borderRadius: 10, padding: 16 }}>
            <h4 style={{ color: '#fbbf24', fontSize: 14, marginBottom: 10, borderBottom: '1px solid #2a2f45', paddingBottom: 6 }}>🔄 조각 교환</h4>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {shardInfo.recipes.length === 0 ? (
                <div style={{ color: '#666', fontSize: 13, textAlign: 'center', padding: 16 }}>교환 레시피 로딩중...</div>
              ) : shardInfo.recipes.map(r => {
                const shardCount = shardInfo.shards['용병소환 조각'] || 0;
                const canExchange = shardCount >= r.shard_cost;
                return (
                  <div key={r.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 12px', background: '#0f1320', borderRadius: 8, border: `1px solid ${canExchange ? '#4ade8040' : '#333'}` }}>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 13, fontWeight: 600, color: '#eee' }}>{r.ticket_name}</div>
                      <div style={{ fontSize: 11, color: '#888' }}>
                        🗡️ {r.shard_cost}개 필요 (보유: <span style={{ color: canExchange ? '#4ade80' : '#ef4444' }}>{shardCount}</span>)
                      </div>
                    </div>
                    <button
                      style={{ padding: '6px 14px', borderRadius: 6, border: 'none', background: canExchange ? '#4ade80' : '#333', color: canExchange ? '#000' : '#666', fontWeight: 700, fontSize: 12, cursor: canExchange ? 'pointer' : 'default' }}
                      disabled={!canExchange || exchangeLoading}
                      onClick={() => handleExchange(r.id)}
                    >
                      {exchangeLoading ? '...' : '교환'}
                    </button>
                  </div>
                );
              })}
            </div>
          </div>

          {/* 소환권 사용 (가챠) */}
          <div style={{ background: '#181c2e', borderRadius: 10, padding: 16 }}>
            <h4 style={{ color: '#c084fc', fontSize: 14, marginBottom: 10, borderBottom: '1px solid #2a2f45', paddingBottom: 6 }}>⚔️ 용병 소환</h4>
            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
              {[
                { type: 'mercenary', name: '용병소환권', icon: '📜', color: '#c084fc', desc: '조각 30개로 교환한 소환권' },
                { type: 'mercenary_premium', name: '고급용병소환권', icon: '🌟', color: '#fbbf24', desc: '조각 80개로 교환한 고급 소환권' },
              ].map(ticket => {
                const count = shardInfo.tickets[ticket.type] || 0;
                return (
                  <div key={ticket.type} style={{ flex: '1 1 200px', padding: 14, background: '#0f1320', borderRadius: 10, border: `1px solid ${count > 0 ? ticket.color + '40' : '#333'}`, textAlign: 'center' }}>
                    <div style={{ fontSize: 28, marginBottom: 6 }}>{ticket.icon}</div>
                    <div style={{ fontSize: 13, fontWeight: 600, color: ticket.color }}>{ticket.name}</div>
                    <div style={{ fontSize: 11, color: '#888', margin: '4px 0' }}>{ticket.desc}</div>
                    <div style={{ fontSize: 16, fontWeight: 700, color: count > 0 ? '#eee' : '#555', margin: '6px 0' }}>{count}장</div>
                    <button
                      style={{ padding: '8px 20px', borderRadius: 8, border: 'none', background: count > 0 ? ticket.color : '#333', color: count > 0 ? '#000' : '#666', fontWeight: 700, fontSize: 13, cursor: count > 0 ? 'pointer' : 'default', width: '100%' }}
                      disabled={count <= 0 || exchangeLoading}
                      onClick={() => setGachaPopup({ ticketType: ticket.type, ticketName: ticket.name })}
                    >
                      {exchangeLoading ? '소환 중...' : count > 0 ? '소환하기' : '소환권 없음'}
                    </button>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* 가챠 연출 팝업 */}
      {gachaPopup && (
        <GachaPopup
          unitType="mercenary"
          ticketType={gachaPopup.ticketType}
          ticketName={gachaPopup.ticketName}
          onPull={handleGachaPull}
          onClose={() => setGachaPopup(null)}
          onComplete={handleGachaComplete}
        />
      )}

      {/* 용병 휴식 팝업 */}
      {restPopup && !restPopup.fireConfirm && (
        <div className="aura-popup-overlay" onClick={() => setRestPopup(null)}>
          <div className="inn-rest-popup" onClick={e => e.stopPropagation()}>
            <div className="inn-rest-popup-header">
              <span>{restPopup.merc.name} 휴식</span>
              <button className="aura-popup-close" onClick={() => setRestPopup(null)}>&times;</button>
            </div>
            <div className="inn-rest-popup-body">
              <div className="inn-rest-fatigue-info">
                피로도: <span style={{ color: '#ef4444' }}>{restPopup.merc.fatigue ?? 0}</span> / {restPopup.merc.max_fatigue ?? 7}
                <span style={{ color: '#4ade80', marginLeft: 8 }}>→ {restPopup.merc.max_fatigue ?? 7} (전부 회복)</span>
              </div>
              <div className="inn-rest-options">
                <button
                  className="inn-rest-option gold"
                  disabled={loading || charState.gold < restPopup.cost}
                  onClick={() => handleMercRest(restPopup.merc.id, 'gold')}
                >
                  <span className="inn-rest-option-icon">💰</span>
                  <span className="inn-rest-option-label">골드로 휴식</span>
                  <span className="inn-rest-option-cost">{restPopup.cost.toLocaleString()}G</span>
                  {charState.gold < restPopup.cost && <span className="inn-rest-option-warn">골드 부족</span>}
                </button>
                <button
                  className="inn-rest-option stamina"
                  disabled={loading || (charState.stamina || 0) <= 0}
                  onClick={() => handleMercRest(restPopup.merc.id, 'stamina')}
                >
                  <span className="inn-rest-option-icon">⚡</span>
                  <span className="inn-rest-option-label">행동력으로 휴식</span>
                  <span className="inn-rest-option-cost">행동력 1</span>
                  {(charState.stamina || 0) <= 0 && <span className="inn-rest-option-warn">행동력 부족</span>}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 용병 해고 확인 팝업 */}
      {restPopup && restPopup.fireConfirm && (
        <div className="dismiss-overlay" onClick={() => setRestPopup(null)}>
          <div className="dismiss-popup" onClick={e => e.stopPropagation()}>
            <div className="dismiss-particles">
              {[...Array(10)].map((_, i) => <div key={i} className="dismiss-particle" style={{ '--pi': i }} />)}
            </div>
            <div className="dismiss-content">
              <div className="dismiss-top-deco" />
              <div className="dismiss-icon-wrap">
                <MercImg src={`/mercenaries_nobg/${restPopup.merc.template_id}_icon.png`} fallback="⚔️" className="dismiss-icon-img" />
                <div className="dismiss-icon-glow" />
              </div>
              <div className="dismiss-title">용병 해고</div>
              <div className="dismiss-unit-name">{restPopup.merc.name}</div>
              <div className="dismiss-unit-sub">{restPopup.merc.class_type} · Lv.{restPopup.merc.level}</div>
              <div className="dismiss-divider"><span>◆</span></div>
              {restPopup.merc.equipped_count > 0 ? (
                <div className="dismiss-warn equipped">
                  <span className="dismiss-warn-icon">⚠️</span>
                  <span>장비가 <strong>{restPopup.merc.equipped_count}개</strong> 장착되어 있습니다.</span>
                  <span className="dismiss-warn-sub">장비를 먼저 해제해주세요.</span>
                </div>
              ) : (
                <div className="dismiss-warn">
                  <span className="dismiss-warn-icon">💔</span>
                  <span>정말 해고하시겠습니까?</span>
                  <span className="dismiss-warn-sub">해고된 용병은 복구할 수 없으며 골드도 반환되지 않습니다.</span>
                </div>
              )}
              <div className="dismiss-btns">
                <button className="dismiss-btn cancel" onClick={() => setRestPopup(null)}>취소</button>
                <button className="dismiss-btn confirm" disabled={loading || restPopup.merc.equipped_count > 0} onClick={() => { setRestPopup(null); handleFire(restPopup.merc.id); }}>
                  <span className="dismiss-btn-shimmer" />
                  {restPopup.merc.equipped_count > 0 ? '장비 해제 필요' : loading ? '해고 중...' : '해고'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default InnArea;
