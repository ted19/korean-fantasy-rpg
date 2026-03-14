import React, { useState, useEffect, useCallback } from 'react';
import api from '../api';
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

  useEffect(() => { loadTemplates(); loadMyMercs(); loadAuras(); }, [loadTemplates, loadMyMercs, loadAuras]);

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
        {[
          { id: 'templates', label: '용병 고용' },
          { id: 'my', label: `내 용병 (${mercSlots.current}/${mercSlots.max})` },
        ].map(t => (
          <button
            key={t.id}
            className={`facility-tab${tab === t.id ? ' active' : ''}`}
            onClick={() => handleTabChange(t.id)}
          >
            {t.label}
          </button>
        ))}
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
                    <MercImg src={`/mercenaries/${t.id}_icon.png`} fallback={WEAPON_ICONS[t.weapon_type] || '⚔️'} className="inn-merc-img" />
                  </div>
                  <div className="inn-merc-info">
                    <div className="inn-merc-name">
                      {t.name}
                      <span className="inn-merc-class">{t.class_type}</span>
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
                  <MercImg src={`/mercenaries/${selectedTemplate.id}_full.png`} fallback={WEAPON_ICONS[selectedTemplate.weapon_type]} className="inn-detail-portrait" />
                </div>
                <div>
                  <h3>{selectedTemplate.name}</h3>
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
                    <MercImg src={`/mercenaries/${m.template_id}_icon.png`} fallback={WEAPON_ICONS[m.weapon_type] || '⚔️'} className="inn-merc-img" />
                    <span className="inn-merc-level-badge">Lv.{m.level}</span>
                  </div>
                  <div className="inn-merc-info">
                    <div className="inn-merc-name">
                      {m.name}
                      <span className="inn-merc-class">{m.class_type}</span>
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
                  <MercImg src={`/mercenaries/${selectedMerc.template_id}_full.png`} fallback={WEAPON_ICONS[selectedMerc.weapon_type]} className="inn-detail-portrait" />
                </div>
                <div>
                  <h3>{selectedMerc.name} <span className="inn-detail-level">Lv.{selectedMerc.level}</span></h3>
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
                <MercImg src={`/mercenaries/${restPopup.merc.template_id}_icon.png`} fallback="⚔️" className="dismiss-icon-img" />
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
