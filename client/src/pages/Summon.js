import React, { useState, useEffect, useCallback } from 'react';
import { Badge } from 'react-bootstrap';
import api from '../api';
import './InnArea.css';

const TYPE_FILTERS = ['전체', '귀신', '몬스터', '정령', '언데드'];

const ELEMENT_INFO = {
  fire:    { name: '불', icon: '🔥', color: '#ff6b35' },
  water:   { name: '물', icon: '💧', color: '#4da6ff' },
  earth:   { name: '땅', icon: '🪨', color: '#8bc34a' },
  wind:    { name: '바람', icon: '🌀', color: '#b388ff' },
  neutral: { name: '중립', icon: '⚪', color: '#9ca3af' },
};

function NpcImg({ src, className }) {
  const [err, setErr] = useState(false);
  if (err) return null;
  return <img src={src} alt="" className={className} onError={() => setErr(true)} />;
}

function SummonImg({ src, fallback, className }) {
  const [err, setErr] = useState(false);
  const prevSrc = React.useRef(src);
  if (prevSrc.current !== src) { prevSrc.current = src; if (err) setErr(false); }
  if (err) return <span className={className}>{fallback}</span>;
  return <img src={src} alt="" className={className} onError={() => setErr(true)} />;
}

const SKILL_TYPE_ICONS = { attack: '⚔️', heal: '💚', buff: '🔺' };

function SkillIcon({ src, fallback, className }) {
  const [err, setErr] = useState(false);
  if (err || !src) return <span className={className}>{fallback}</span>;
  return <img src={src} alt="" className={className} onError={() => setErr(true)} />;
}

const RANGE_INFO = {
  melee:  { name: '근거리', icon: '⚔️', color: '#ef4444' },
  ranged: { name: '원거리', icon: '🏹', color: '#f59e0b' },
  magic:  { name: '마법형', icon: '🔮', color: '#a855f7' },
};

const GRADE_COLORS = {
  '일반': '#aaa', '고급': '#4da6ff', '희귀': '#a855f7',
  '영웅': '#f59e0b', '전설': '#ef4444', '신화': '#ff6b6b',
};

function detectSummonRangeType(summon) {
  if (summon.range_type) return summon.range_type;
  if (summon.type === '정령' || summon.type === '귀신') return 'magic';
  const skills = summon.learned_skills || summon.skills || [];
  const hasRanged = skills.some(s => (s.range_val || s.range || 1) >= 2);
  if (hasRanged) return 'ranged';
  // base stats로 판단: 마공 > 물공이면 magic
  const magAtk = summon.mag_attack || summon.base_mag_attack || 0;
  const physAtk = summon.phys_attack || summon.base_phys_attack || 0;
  if (magAtk > physAtk) return 'magic';
  return 'melee';
}

function Summon({ charState, onCharStateUpdate, onLog, initialSummonId }) {
  const [tab, setTab] = useState(initialSummonId ? 'my' : 'shop');
  const [templates, setTemplates] = useState([]);
  const [mySummons, setMySummons] = useState([]);
  const [summonSlots, setSummonSlots] = useState({ current: 0, max: 1, next: null });
  const [typeFilter, setTypeFilter] = useState('전체');
  const [selectedTemplate, setSelectedTemplate] = useState(null);
  const [selectedSummon, setSelectedSummon] = useState(null);
  const [showSkillPopup, setShowSkillPopup] = useState(false);
  const [skillsData, setSkillsData] = useState({ skills: [], summonLevel: 1 });
  const [npcMsg, setNpcMsg] = useState('이 세계에는 다양한 소환수가 있지...');
  const [loading, setLoading] = useState(false);
  const [fireConfirm, setFireConfirm] = useState(null);

  const NPC_MSGS = {
    shop: [
      '이 세계에는 다양한 소환수가 있지...',
      '마음에 드는 소환수를 골라보거라.',
      '강한 소환수일수록 더 많은 힘이 필요하단다.',
    ],
    my: [
      '소환수를 잘 돌봐야 강해진다.',
      '장비와 스킬로 소환수를 키워보거라.',
      '자네 소환수들이 잘 자라고 있구만.',
    ],
  };

  const loadTemplates = useCallback(async () => {
    try {
      const res = await api.get('/summon/templates');
      setTemplates(res.data.templates);
    } catch {
      onLog('소환수 목록을 불러올 수 없습니다.', 'damage');
    }
  }, [onLog]);

  const loadMySummons = useCallback(async () => {
    try {
      const res = await api.get('/summon/my');
      setMySummons(res.data.summons);
      if (res.data.summonSlots) setSummonSlots(res.data.summonSlots);
    } catch {
      onLog('소환수 정보를 불러올 수 없습니다.', 'damage');
    }
  }, [onLog]);

  useEffect(() => {
    loadTemplates();
    loadMySummons().then(() => {
      if (initialSummonId) {
        // auto-select and open skill popup after summons are loaded
        setTimeout(() => {
          setMySummons(prev => {
            const target = prev.find(s => s.id === initialSummonId);
            if (target) {
              setSelectedSummon(target);
              loadSkills(target.id);
            }
            return prev;
          });
        }, 100);
      }
    });
  }, [loadTemplates, loadMySummons]);

  useEffect(() => {
    const msgs = NPC_MSGS[tab] || NPC_MSGS.shop;
    setNpcMsg(msgs[Math.floor(Math.random() * msgs.length)]);
  }, [tab]);

  const handleBuy = async (templateId) => {
    setLoading(true);
    try {
      const res = await api.post('/summon/buy', { templateId });
      onLog(res.data.message, 'system');
      if (res.data.gold !== undefined) onCharStateUpdate({ gold: res.data.gold });
      setNpcMsg('좋은 선택이다. 잘 키워보거라.');
      await loadMySummons();
      await loadTemplates(); // 재료 보유량 갱신
      setSelectedTemplate(null);
    } catch (err) {
      onLog(err.response?.data?.message || '소환 실패', 'damage');
      setNpcMsg('아직 준비가 되지 않은 것 같구나.');
    }
    setLoading(false);
  };

  const handleSell = async (summonId) => {
    setLoading(true);
    try {
      const res = await api.post('/summon/sell', { summonId });
      onLog(res.data.message, 'system');
      setFireConfirm(null);
      await loadMySummons();
      if (selectedSummon?.id === summonId) setSelectedSummon(null);
    } catch (err) {
      onLog(err.response?.data?.message || '소환해제 실패', 'damage');
    }
    setLoading(false);
  };

  const loadSkills = async (summonId) => {
    try {
      const res = await api.get(`/summon/${summonId}/skills`);
      setSkillsData(res.data);
      setShowSkillPopup(true);
    } catch {
      onLog('스킬 정보를 불러올 수 없습니다.', 'damage');
    }
  };

  const handleLearnSkill = async (summonId, skillId) => {
    try {
      const res = await api.post(`/summon/${summonId}/learn-skill`, { skillId });
      onLog(res.data.message, 'system');
      if (res.data.gold !== undefined) onCharStateUpdate({ gold: res.data.gold });
      loadSkills(summonId);
      loadMySummons();
    } catch (err) {
      onLog(err.response?.data?.message || '스킬 습득 실패', 'damage');
    }
  };

  const ownedTemplateIds = mySummons.map((s) => s.template_id);
  const filteredTemplates = templates.filter((t) => !ownedTemplateIds.includes(t.id) && (typeFilter === '전체' || t.type === typeFilter));
  const filteredSummons = mySummons.filter((s) => typeFilter === '전체' || s.type === typeFilter);

  return (
    <>
    {/* 스킬 관리 레이어 팝업 */}
    {showSkillPopup && selectedSummon && (
      <div className="summon-equip-overlay" onClick={() => setShowSkillPopup(false)}>
        <div className="summon-equip-modal" onClick={(e) => e.stopPropagation()}>
          <div className="summon-equip-modal-header">
            <span className="summon-equip-modal-title">{selectedSummon.name} - 스킬 관리</span>
            <button className="summon-equip-modal-close" onClick={() => setShowSkillPopup(false)}>&times;</button>
          </div>
          <div className="summon-equip-modal-body">
            <div className="skill-manage-list">
              {skillsData.skills.length === 0 ? (
                <div style={{ color: 'var(--text-dark)', textAlign: 'center', padding: '16px 0' }}>배울 수 있는 스킬이 없습니다.</div>
              ) : skillsData.skills.map((skill) => (
                <div key={skill.id} className={`skill-manage-row ${skill.learned ? 'learned' : ''}`}>
                  <SkillIcon src={`/summon_skills/${skill.id}_icon.png`} fallback={SKILL_TYPE_ICONS[skill.type] || '⚡'} className="skill-manage-icon-img" />
                  <div className="skill-manage-info">
                    <div className="skill-manage-name">
                      {skill.name}
                      <span className="skill-manage-lv">Lv.{skill.required_level}</span>
                      <Badge bg="dark" style={{ color: '#fbbf24', background: 'rgba(245, 158, 11, 0.1)', fontSize: 10, marginLeft: 4 }}>{skill.skill_category}</Badge>
                    </div>
                    <div className="skill-manage-desc">{skill.description}</div>
                    <div className="skill-manage-tags">
                      {skill.mp_cost > 0 && <span className="skill-manage-tag mp">MP {skill.mp_cost}</span>}
                      {skill.type === 'attack' && skill.damage_multiplier > 0 && <span className="skill-manage-tag pow">배율 x{skill.damage_multiplier}</span>}
                      {skill.heal_amount > 0 && <span className="skill-manage-tag heal">회복 {skill.heal_amount}</span>}
                      {skill.buff_stat && <span className="skill-manage-tag buff">{{attack:'ATK', defense:'DEF', phys_attack:'물공', phys_defense:'물방', mag_attack:'마공', mag_defense:'마방', crit_rate:'치명', evasion:'회피'}[skill.buff_stat] || skill.buff_stat}+{skill.buff_value} ({skill.buff_duration}턴)</span>}
                      {skill.cooldown > 0 && <span className="skill-manage-tag cd">쿨타임 {skill.cooldown}턴</span>}
                      {!skill.learned && <span className="skill-manage-tag" style={{ color: '#ffa502', borderColor: 'rgba(255,165,2,0.2)' }}>{(skill.gold_cost || 0).toLocaleString()}G</span>}
                    </div>
                  </div>
                  <div className="skill-manage-action">
                    {skill.learned ? (
                      <Badge bg="success" style={{ fontSize: 11 }}>습득</Badge>
                    ) : selectedSummon.level < skill.required_level ? (
                      <Badge bg="secondary" style={{ fontSize: 10 }}>Lv.{skill.required_level} 필요</Badge>
                    ) : charState.gold < (skill.gold_cost || 0) ? (
                      <Badge bg="secondary" style={{ fontSize: 10 }}>골드 부족</Badge>
                    ) : (
                      <button
                        className="inn-hire-btn"
                        style={{ padding: '6px 12px', fontSize: 12 }}
                        onClick={() => handleLearnSkill(selectedSummon.id, skill.id)}
                      >
                        {(skill.gold_cost || 0).toLocaleString()}G 습득
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    )}
    {(
    <div className="facility-page summoner-page">
      {/* Banner */}
      <div className="facility-banner summoner-banner">
        <NpcImg src="/village/summoner_banner.png" className="facility-banner-img" />
        <div className="facility-banner-overlay" />
        <div className="facility-banner-title">소환술사의 집</div>
      </div>

      {/* NPC Section */}
      <div className="facility-npc">
        <div className="facility-npc-portrait-wrap">
          <NpcImg src="/village/summoner_portrait.png" className="facility-npc-portrait" />
        </div>
        <div className="facility-npc-speech">
          <div className="facility-npc-name">소환술사 <span className="npc-name-sub">한 미령</span></div>
          <div className="facility-npc-msg">{npcMsg}</div>
        </div>
        <div className="facility-gold">
          <span>{(charState.gold ?? 0).toLocaleString()}G</span>
        </div>
      </div>

      {/* Tabs */}
      <div className="facility-tabs">
        <button className={`facility-tab ${tab === 'shop' ? 'active' : ''}`} onClick={() => { setTab('shop'); setSelectedTemplate(null); setSelectedSummon(null); }}>
          고용하기
        </button>
        <button className={`facility-tab ${tab === 'my' ? 'active' : ''}`} onClick={() => { setTab('my'); setSelectedTemplate(null); setSelectedSummon(null); }}>
          내 소환수 <span className="tab-badge">{summonSlots.current}/{summonSlots.max}</span>
        </button>
      </div>

      {/* Type Filter */}
      <div className="facility-filters">
        {TYPE_FILTERS.map((f) => (
          <button
            key={f}
            className={`facility-filter-btn ${typeFilter === f ? 'active' : ''}`}
            onClick={() => setTypeFilter(f)}
          >
            {f}
          </button>
        ))}
      </div>

      {/* 고용하기 탭 */}
      {tab === 'shop' && (
        <div className="inn-content">
          {selectedTemplate && (
            <div className="summon-full-panel">
              <SummonImg src={`/summons/${selectedTemplate.id}_full.png`} fallback={selectedTemplate.icon} className="summon-full-panel-img" />
              <div className="summon-full-panel-name">{selectedTemplate.name}</div>
              <div className="summon-full-panel-type">{selectedTemplate.type} · {(ELEMENT_INFO[selectedTemplate.element] || ELEMENT_INFO.neutral).name}</div>
            </div>
          )}
          <div className="inn-list">
            {filteredTemplates.map((t) => {
              const mats = t.summon_materials || [];
              const cantAfford = mats.length > 0
                ? mats.some(m => (m.owned || 0) < m.quantity)
                : charState.gold < t.price;
              const cantLevel = charState.level < t.required_level;
              const canHire = !cantAfford && !cantLevel;
              const el = ELEMENT_INFO[t.element] || ELEMENT_INFO.neutral;
              const rt = detectSummonRangeType(t);
              const ri = RANGE_INFO[rt] || RANGE_INFO.melee;
              return (
                <div
                  key={t.id}
                  className={`inn-merc-card${selectedTemplate?.id === t.id ? ' selected' : ''}${!canHire ? ' disabled' : ''}`}
                  onClick={() => setSelectedTemplate(t)}
                >
                  <div className="inn-merc-icon">
                    <SummonImg src={t.icon_url || `/summons/${t.id}_icon.png`} fallback={t.icon} className="inn-merc-img" />
                  </div>
                  <div className="inn-merc-info">
                    <div className="inn-merc-name">
                      {t.name}
                      <span className="inn-merc-class">{t.type}</span>
                    </div>
                    <div className="inn-merc-meta">
                      <span style={{ color: el.color }}>{el.icon}{el.name}</span>
                      <span style={{ color: ri.color }}>{ri.icon} {ri.name}</span>
                      {cantLevel && (
                        <span className="inn-merc-level-warn">Lv.{t.required_level} 필요</span>
                      )}
                    </div>
                    <div className="inn-merc-desc">{t.description || `${t.type} 소환수`}</div>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 2, alignItems: 'flex-end', flexShrink: 0 }}>
                    {mats.length > 0 ? mats.slice(0, 2).map((m, i) => (
                      <span key={i} style={{ fontSize: 11, color: (m.owned || 0) >= m.quantity ? '#4ade80' : '#ef4444', whiteSpace: 'nowrap' }}>
                        {m.icon}{m.quantity}
                      </span>
                    )) : (
                      <span className="inn-merc-price">{t.price.toLocaleString()}G</span>
                    )}
                    {mats.length > 2 && <span style={{ fontSize: 10, color: '#888' }}>+{mats.length - 2}</span>}
                  </div>
                </div>
              );
            })}
            {filteredTemplates.length === 0 && (
              <div className="facility-empty">해당 타입의 소환수가 없습니다.</div>
            )}
          </div>

          {selectedTemplate && (() => {
            const el = ELEMENT_INFO[selectedTemplate.element] || ELEMENT_INFO.neutral;
            const rt = detectSummonRangeType(selectedTemplate);
            const ri = RANGE_INFO[rt] || RANGE_INFO.melee;
            const mats = selectedTemplate.summon_materials || [];
            const cantAfford = mats.length > 0
              ? mats.some(m => (m.owned || 0) < m.quantity)
              : charState.gold < selectedTemplate.price;
            const cantLevel = charState.level < selectedTemplate.required_level;
            return (
              <div className="inn-detail">
                <div className="inn-detail-header">
                  <SummonImg src={`/summons/${selectedTemplate.id}_full.png`} fallback={selectedTemplate.icon} className="inn-detail-portrait" />
                  <div>
                    <h3>{selectedTemplate.name}</h3>
                    <div className="inn-detail-sub">
                      {selectedTemplate.type} ·
                      <span style={{ color: el.color }}> {el.icon}{el.name}</span>
                      {' '}· <span style={{ color: ri.color }}>{ri.icon} {ri.name}</span>
                    </div>
                    <div className="inn-detail-desc">{selectedTemplate.description || `${selectedTemplate.type} 소환수`}</div>
                  </div>
                </div>

                <div className="inn-detail-stats">
                  <div className="inn-stat-row"><span>HP</span><span>{selectedTemplate.base_hp}</span></div>
                  <div className="inn-stat-row"><span>MP</span><span>{selectedTemplate.base_mp}</span></div>
                  <div className="inn-stat-row"><span>물리공격</span><span>{selectedTemplate.base_phys_attack || 0}</span></div>
                  <div className="inn-stat-row"><span>물리방어</span><span>{selectedTemplate.base_phys_defense || 0}</span></div>
                  <div className="inn-stat-row"><span>마법공격</span><span>{selectedTemplate.base_mag_attack || 0}</span></div>
                  <div className="inn-stat-row"><span>마법방어</span><span>{selectedTemplate.base_mag_defense || 0}</span></div>
                  <div className="inn-stat-row"><span>치명타율</span><span>{selectedTemplate.base_crit_rate || 0}%</span></div>
                  <div className="inn-stat-row"><span>회피율</span><span>{selectedTemplate.base_evasion || 0}%</span></div>
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

                {/* 소환 재료 비용 */}
                {mats.length > 0 && (
                  <div style={{ marginBottom: 12, padding: '10px 12px', background: 'rgba(139,92,246,0.06)', border: '1px solid rgba(139,92,246,0.12)', borderRadius: 8 }}>
                    <div style={{ fontSize: 11, color: '#a855f7', fontWeight: 600, marginBottom: 8 }}>소환 재료</div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                      {mats.map((m, i) => {
                        const enough = (m.owned || 0) >= m.quantity;
                        return (
                          <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 12, padding: '3px 6px', background: 'rgba(255,255,255,0.02)', borderRadius: 4 }}>
                            <span style={{ color: GRADE_COLORS[m.grade] || '#aaa' }}>
                              {m.icon} {m.name}
                            </span>
                            <span style={{ color: enough ? '#4ade80' : '#ef4444', fontWeight: 600 }}>
                              {m.owned || 0}/{m.quantity}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                <div className="inn-slot-info">
                  소환수 슬롯: {summonSlots.current}/{summonSlots.max}
                  {summonSlots.next && <span className="inn-slot-next"> (Lv.{summonSlots.next.level}에서 {summonSlots.next.slots}마리)</span>}
                </div>
                <button
                  className="inn-hire-btn"
                  disabled={loading || cantLevel || cantAfford || mySummons.length >= summonSlots.max}
                  onClick={() => handleBuy(selectedTemplate.id)}
                >
                  {loading ? '소환 중...' :
                   cantLevel ? `Lv.${selectedTemplate.required_level} 필요` :
                   mySummons.length >= summonSlots.max ? `슬롯 부족 ${summonSlots.next ? `(Lv.${summonSlots.next.level} 해금)` : ''}` :
                   cantAfford ? (mats.length > 0 ? '재료 부족' : '골드 부족') :
                   mats.length > 0 ? '소환하기' :
                   `${selectedTemplate.price.toLocaleString()}G로 소환`}
                </button>
              </div>
            );
          })()}
        </div>
      )}

      {/* 내 소환수 탭 */}
      {tab === 'my' && (
        <div className="inn-content">
          {selectedSummon && (
            <div className="summon-full-panel">
              <SummonImg src={`/summons/${selectedSummon.template_id}_full.png`} fallback={selectedSummon.icon} className="summon-full-panel-img" />
              <div className="summon-full-panel-name">{selectedSummon.name}</div>
              <div className="summon-full-panel-type">{selectedSummon.type} · Lv.{selectedSummon.level}</div>
            </div>
          )}
          <div className="inn-list">
            {filteredSummons.length === 0 ? (
              <div className="facility-empty">보유한 소환수가 없습니다.</div>
            ) : filteredSummons.map((s) => {
              const el = ELEMENT_INFO[s.element] || ELEMENT_INFO.neutral;
              const rt = detectSummonRangeType(s);
              const ri = RANGE_INFO[rt] || RANGE_INFO.melee;
              const expNeeded = Math.floor(60 * s.level + 1.5 * s.level * s.level);
              return (
                <div
                  key={s.id}
                  className={`inn-merc-card${selectedSummon?.id === s.id ? ' selected' : ''}`}
                  onClick={() => setSelectedSummon(s)}
                >
                  <div className="inn-merc-icon">
                    <SummonImg src={s.icon_url_img || `/summons/${s.template_id}_icon.png`} fallback={s.icon} className="inn-merc-img" />
                    <span className="inn-merc-level-badge">Lv.{s.level}</span>
                  </div>
                  <div className="inn-merc-info">
                    <div className="inn-merc-name">
                      {s.name}
                      <span className="inn-merc-class">{s.type}</span>
                    </div>
                    <div className="inn-merc-meta">
                      <span style={{ color: el.color }}>{el.icon}{el.name}</span>
                      <span style={{ color: ri.color }}>{ri.icon} {ri.name}</span>
                      <span>HP {s.hp}</span>
                      <span>물공 {s.phys_attack || 0}</span>
                    </div>
                    <div className="inn-merc-exp-bar">
                      <div className="inn-merc-exp-fill" style={{ width: `${(s.exp / expNeeded) * 100}%` }} />
                      <span className="inn-merc-exp-text">EXP {s.exp}/{expNeeded}</span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {selectedSummon && (() => {
            const el = ELEMENT_INFO[selectedSummon.element] || ELEMENT_INFO.neutral;
            const rt = detectSummonRangeType(selectedSummon);
            const ri = RANGE_INFO[rt] || RANGE_INFO.melee;
            return (
              <div className="inn-detail">
                <div className="inn-detail-header">
                  <SummonImg src={`/summons/${selectedSummon.template_id}_full.png`} fallback={selectedSummon.icon} className="inn-detail-portrait" />
                  <div>
                    <h3>{selectedSummon.name} <span className="inn-detail-level">Lv.{selectedSummon.level}</span></h3>
                    <div className="inn-detail-sub">
                      {selectedSummon.type} ·
                      <span style={{ color: el.color }}> {el.icon}{el.name}</span>
                      {' '}· <span style={{ color: ri.color }}>{ri.icon} {ri.name}</span>
                    </div>
                  </div>
                </div>

                <div className="inn-detail-stats">
                  <div className="inn-stat-row"><span>HP</span><span>{selectedSummon.hp}</span></div>
                  <div className="inn-stat-row"><span>MP</span><span>{selectedSummon.mp}</span></div>
                  <div className="inn-stat-row"><span>물리공격</span><span>{selectedSummon.phys_attack || 0}</span></div>
                  <div className="inn-stat-row"><span>물리방어</span><span>{selectedSummon.phys_defense || 0}</span></div>
                  <div className="inn-stat-row"><span>마법공격</span><span>{selectedSummon.mag_attack || 0}</span></div>
                  <div className="inn-stat-row"><span>마법방어</span><span>{selectedSummon.mag_defense || 0}</span></div>
                  <div className="inn-stat-row"><span>치명타율</span><span>{selectedSummon.crit_rate || 0}%</span></div>
                  <div className="inn-stat-row"><span>회피율</span><span>{selectedSummon.evasion || 0}%</span></div>
                </div>

                <div className="inn-detail-growth">
                  <div className="inn-growth-title">레벨업 성장</div>
                  <div className="inn-growth-grid">
                    <span>HP +{selectedSummon.growth_hp || 0}</span>
                    <span>MP +{selectedSummon.growth_mp || 0}</span>
                    <span>물공 +{selectedSummon.growth_phys_attack || 0}</span>
                    <span>물방 +{selectedSummon.growth_phys_defense || 0}</span>
                    <span>마공 +{selectedSummon.growth_mag_attack || 0}</span>
                    <span>마방 +{selectedSummon.growth_mag_defense || 0}</span>
                  </div>
                </div>

                {selectedSummon.learned_skills && selectedSummon.learned_skills.length > 0 && (
                  <div style={{ marginBottom: 12 }}>
                    <div style={{ fontSize: 11, color: '#888', marginBottom: 6 }}>습득 스킬</div>
                    <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                      {selectedSummon.learned_skills.map((sk) => (
                        <Badge key={sk.id} bg="dark" title={sk.description}
                          style={{ background: 'rgba(59, 130, 246, 0.08)', color: '#60a5fa', fontSize: 11 }}>
                          {SKILL_TYPE_ICONS[sk.type]} {sk.name}
                        </Badge>
                      ))}
                    </div>
                  </div>
                )}

                <button className="inn-hire-btn" style={{ marginBottom: 8 }} onClick={() => loadSkills(selectedSummon.id)}>
                  스킬 관리
                </button>
                <button
                  className="inn-fire-btn"
                  disabled={loading}
                  onClick={() => setFireConfirm(selectedSummon)}
                >
                  소환해제
                </button>
              </div>
            );
          })()}
        </div>
      )}
    </div>
    )}

    {/* 소환수 소환해제 확인 팝업 */}
    {fireConfirm && (
      <div className="aura-popup-overlay" onClick={() => setFireConfirm(null)}>
        <div className="inn-rest-popup" onClick={e => e.stopPropagation()}>
          <div className="inn-rest-popup-header" style={{ borderColor: 'rgba(239, 68, 68, 0.3)' }}>
            <span>소환해제 확인</span>
            <button className="aura-popup-close" onClick={() => setFireConfirm(null)}>&times;</button>
          </div>
          <div className="inn-rest-popup-body">
            <div className="inn-fire-confirm-info">
              <SummonImg src={`/summons/${fireConfirm.template_id}_icon.png`} fallback={fireConfirm.icon || '⚔️'} className="inn-fire-confirm-img" />
              <div>
                <div style={{ fontWeight: 700, fontSize: 15, color: '#eee' }}>{fireConfirm.name}</div>
                <div style={{ fontSize: 12, color: '#aaa' }}>{fireConfirm.type} · Lv.{fireConfirm.level}</div>
              </div>
            </div>
            {fireConfirm.equipped_count > 0 ? (
              <div className="inn-fire-confirm-warn" style={{ background: 'rgba(239,68,68,0.12)', border: '1px solid rgba(239,68,68,0.3)', borderRadius: 8, padding: '10px 14px' }}>
                <span style={{ color: '#ef4444', fontWeight: 700 }}>⚠ 장비가 {fireConfirm.equipped_count}개 장착되어 있습니다.</span><br/>
                <span style={{ color: '#aaa' }}>장비를 먼저 해제한 후 소환해제가 가능합니다.</span>
              </div>
            ) : (
              <div className="inn-fire-confirm-warn">
                정말 소환을 해제하시겠습니까?<br/>
                <span style={{ color: '#ef4444' }}>소환해제된 소환수는 복구할 수 없습니다.</span>
              </div>
            )}
            <div className="inn-fire-confirm-btns">
              <button className="inn-fire-confirm-cancel" onClick={() => setFireConfirm(null)}>취소</button>
              <button
                className="inn-fire-confirm-ok"
                disabled={loading || fireConfirm.equipped_count > 0}
                onClick={() => handleSell(fireConfirm.id)}
              >
                {fireConfirm.equipped_count > 0 ? '장비 해제 필요' : loading ? '해제 중...' : '소환해제'}
              </button>
            </div>
          </div>
        </div>
      </div>
    )}
    </>
  );
}

export default Summon;
