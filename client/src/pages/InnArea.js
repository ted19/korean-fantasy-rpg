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

function InnArea({ charState, onCharStateUpdate, onLog, onMercenariesChanged }) {
  const [tab, setTab] = useState('templates');
  const [templates, setTemplates] = useState([]);
  const [myMercs, setMyMercs] = useState([]);
  const [selectedTemplate, setSelectedTemplate] = useState(null);
  const [selectedMerc, setSelectedMerc] = useState(null);
  const [loading, setLoading] = useState(false);
  const [npcMsg, setNpcMsg] = useState('');

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
    } catch {}
  }, []);

  useEffect(() => { loadTemplates(); loadMyMercs(); }, [loadTemplates, loadMyMercs]);

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
      onCharStateUpdate({ gold: res.data.gold });
      setSelectedMerc(null);
      await loadMyMercs();
      if (onMercenariesChanged) onMercenariesChanged();
    } catch (err) {
      onLog(err.response?.data?.message || '해고 실패', 'damage');
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
        <div className="facility-banner-text">여관</div>
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

      {/* 탭 */}
      <div className="facility-tabs">
        {[
          { id: 'templates', label: '용병 고용' },
          { id: 'my', label: `내 용병 (${myMercs.length}/5)` },
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
            {templates.map(t => {
              const canHire = charState.level >= t.required_level && charState.gold >= t.price && myMercs.length < 5;
              const el = ELEMENT_INFO[t.element] || ELEMENT_INFO.neutral;
              return (
                <div
                  key={t.id}
                  className={`inn-merc-card${selectedTemplate?.id === t.id ? ' selected' : ''}${!canHire ? ' disabled' : ''}`}
                  onClick={() => setSelectedTemplate(t)}
                >
                  <div className="inn-merc-icon">
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
                <MercImg src={`/mercenaries/${selectedTemplate.id}_full.png`} fallback={WEAPON_ICONS[selectedTemplate.weapon_type]} className="inn-detail-portrait" />
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

              <button
                className="inn-hire-btn"
                disabled={loading || charState.level < selectedTemplate.required_level || charState.gold < selectedTemplate.price || myMercs.length >= 5}
                onClick={() => handleHire(selectedTemplate.id)}
              >
                {loading ? '고용 중...' :
                 charState.level < selectedTemplate.required_level ? `Lv.${selectedTemplate.required_level} 필요` :
                 charState.gold < selectedTemplate.price ? '골드 부족' :
                 myMercs.length >= 5 ? '용병 최대' :
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
              const expNeeded = m.level * 50;
              return (
                <div
                  key={m.id}
                  className={`inn-merc-card${selectedMerc?.id === m.id ? ' selected' : ''}`}
                  onClick={() => setSelectedMerc(m)}
                >
                  <div className="inn-merc-icon">
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
                  </div>
                </div>
              );
            })}
          </div>

          {selectedMerc && (
            <div className="inn-detail">
              <div className="inn-detail-header">
                <MercImg src={`/mercenaries/${selectedMerc.template_id}_full.png`} fallback={WEAPON_ICONS[selectedMerc.weapon_type]} className="inn-detail-portrait" />
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

              <button
                className="inn-fire-btn"
                disabled={loading}
                onClick={() => handleFire(selectedMerc.id)}
              >
                {loading ? '해고 중...' : `해고 (${(selectedMerc.sell_price || 0).toLocaleString()}G 반환)`}
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default InnArea;
