import React, { useState, useEffect, useCallback } from 'react';
import { Badge, Button, ProgressBar } from 'react-bootstrap';
import api from '../api';
import SummonEquipment from './SummonEquipment';

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
  if (err) return <span className={className}>{fallback}</span>;
  return <img src={src} alt="" className={className} onError={() => setErr(true)} />;
}

const SKILL_TYPE_ICONS = { attack: '⚔️', heal: '💚', buff: '🔺' };

function Summon({ charState, onCharStateUpdate, onLog }) {
  const [tab, setTab] = useState('shop');
  const [templates, setTemplates] = useState([]);
  const [mySummons, setMySummons] = useState([]);
  const [typeFilter, setTypeFilter] = useState('전체');
  const [selectedSummon, setSelectedSummon] = useState(null);
  const [showEquipment, setShowEquipment] = useState(false);
  const [showSkills, setShowSkills] = useState(null);
  const [skillsData, setSkillsData] = useState({ skills: [], summonLevel: 1 });
  const [npcMsg, setNpcMsg] = useState('이 세계에는 다양한 소환수가 있지...');

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
    } catch {
      onLog('소환수 정보를 불러올 수 없습니다.', 'damage');
    }
  }, [onLog]);

  useEffect(() => {
    loadTemplates();
    loadMySummons();
  }, [loadTemplates, loadMySummons]);

  useEffect(() => {
    const msgs = NPC_MSGS[tab] || NPC_MSGS.shop;
    setNpcMsg(msgs[Math.floor(Math.random() * msgs.length)]);
  }, [tab]);

  const handleBuy = async (templateId) => {
    try {
      const res = await api.post('/summon/buy', { templateId });
      onLog(res.data.message, 'system');
      onCharStateUpdate({ gold: res.data.gold });
      setNpcMsg('좋은 선택이다. 잘 키워보거라.');
      loadMySummons();
    } catch (err) {
      onLog(err.response?.data?.message || '고용 실패', 'damage');
      setNpcMsg('아직 준비가 되지 않은 것 같구나.');
    }
  };

  const handleSell = async (summonId) => {
    try {
      const res = await api.post('/summon/sell', { summonId });
      onLog(res.data.message, 'system');
      onCharStateUpdate({ gold: res.data.gold });
      loadMySummons();
      if (selectedSummon?.id === summonId) setSelectedSummon(null);
    } catch (err) {
      onLog(err.response?.data?.message || '해고 실패', 'damage');
    }
  };

  const loadSkills = async (summonId) => {
    try {
      const res = await api.get(`/summon/${summonId}/skills`);
      setSkillsData(res.data);
      setShowSkills(summonId);
    } catch {
      onLog('스킬 정보를 불러올 수 없습니다.', 'damage');
    }
  };

  const handleLearnSkill = async (summonId, skillId) => {
    try {
      const res = await api.post(`/summon/${summonId}/learn-skill`, { skillId });
      onLog(res.data.message, 'system');
      loadSkills(summonId);
      loadMySummons();
    } catch (err) {
      onLog(err.response?.data?.message || '스킬 습득 실패', 'damage');
    }
  };

  const ownedTemplateIds = mySummons.map((s) => s.template_id);
  const filteredTemplates = templates.filter((t) => typeFilter === '전체' || t.type === typeFilter);
  const filteredSummons = mySummons.filter((s) => typeFilter === '전체' || s.type === typeFilter);

  if (showEquipment && selectedSummon) {
    return (
      <div>
        <Button variant="outline-secondary" size="sm" className="mb-3" onClick={() => setShowEquipment(false)}>
          &larr; 소환수 목록으로
        </Button>
        <SummonEquipment
          summon={selectedSummon}
          onLog={onLog}
          onSummonUpdate={() => loadMySummons()}
        />
      </div>
    );
  }

  if (showSkills !== null) {
    const summon = mySummons.find((s) => s.id === showSkills);
    return (
      <div className="summon-skills-view">
        <Button variant="outline-secondary" size="sm" className="mb-3" onClick={() => setShowSkills(null)}>
          &larr; 소환수 목록으로
        </Button>
        <div className="summon-skills-header">
          <SummonImg src={summon?.icon_url_img || `/summons/${summon?.template_id}_icon.png`} fallback={summon?.icon} className="summon-card-icon" />
          <div>
            <div className="summon-card-name">{summon?.name}</div>
            <div className="summon-card-type">
              {summon?.type} · Lv.{summon?.level}
              {summon?.element && ELEMENT_INFO[summon.element] && (
                <span className="summon-element" style={{ color: ELEMENT_INFO[summon.element].color }}>
                  {ELEMENT_INFO[summon.element].icon} {ELEMENT_INFO[summon.element].name}
                </span>
              )}
            </div>
          </div>
        </div>
        <div className="summon-skills-list">
          {skillsData.skills.map((skill) => (
            <div key={skill.id} className={`summon-skill-card ${skill.learned ? 'learned' : ''} ${summon?.level < skill.required_level ? 'locked' : ''}`}>
              <div className="summon-skill-top">
                <span className="summon-skill-type-icon">{SKILL_TYPE_ICONS[skill.type]}</span>
                <span className="summon-skill-name">{skill.name}</span>
                <Badge bg="dark" style={{ color: '#fbbf24', background: 'rgba(245, 158, 11, 0.1)' }}>{skill.skill_category}</Badge>
                <Badge bg="dark" style={{ color: '#60a5fa', background: 'rgba(59, 130, 246, 0.1)' }}>{skill.mp_cost}MP</Badge>
              </div>
              <div className="summon-skill-desc">{skill.description}</div>
              <div className="summon-skill-meta">
                {skill.type === 'attack' && <span className="skill-tag atk">x{skill.damage_multiplier}</span>}
                {skill.heal_amount > 0 && <span className="skill-tag heal">+{skill.heal_amount}HP</span>}
                {skill.buff_stat && <span className="skill-tag buff">{{attack:'ATK', defense:'DEF', phys_attack:'물공', phys_defense:'물방', mag_attack:'마공', mag_defense:'마방', crit_rate:'치명', evasion:'회피'}[skill.buff_stat] || skill.buff_stat}+{skill.buff_value} ({skill.buff_duration}턴)</span>}
                {skill.cooldown > 0 && <span className="skill-tag cd">CD:{skill.cooldown}</span>}
                <span className="skill-tag lvl">Lv.{skill.required_level}</span>
              </div>
              <div className="summon-skill-bottom">
                {skill.learned ? (
                  <Badge bg="success" className="py-1 px-3">습득 완료</Badge>
                ) : (
                  <Button
                    size="sm"
                    variant="primary"
                    disabled={summon?.level < skill.required_level}
                    onClick={() => handleLearnSkill(showSkills, skill.id)}
                  >
                    {summon?.level < skill.required_level ? `Lv.${skill.required_level} 필요` : '습득하기'}
                  </Button>
                )}
              </div>
            </div>
          ))}
          {skillsData.skills.length === 0 && (
            <div className="facility-empty">배울 수 있는 스킬이 없습니다.</div>
          )}
        </div>
      </div>
    );
  }

  return (
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
        <button className={`facility-tab ${tab === 'shop' ? 'active' : ''}`} onClick={() => setTab('shop')}>
          고용하기
        </button>
        <button className={`facility-tab ${tab === 'my' ? 'active' : ''}`} onClick={() => setTab('my')}>
          내 소환수 <span className="tab-badge">{mySummons.length}</span>
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

      {tab === 'shop' ? (
        <div className="summon-grid">
          {filteredTemplates.map((t) => {
            const owned = ownedTemplateIds.includes(t.id);
            const cantAfford = charState.gold < t.price;
            const cantLevel = charState.level < t.required_level;
            return (
              <div key={t.id} className={`summon-card ${owned ? 'owned' : ''} ${cantLevel ? 'restricted' : ''}`}>
                <div className="summon-card-top">
                  <SummonImg src={t.icon_url || `/summons/${t.id}_icon.png`} fallback={t.icon} className="summon-card-icon" />
                  <div className="summon-card-info">
                    <div className="summon-card-name">
                      {t.name}
                      {owned && <Badge bg="success" className="ms-1" style={{ fontSize: 10 }}>보유</Badge>}
                    </div>
                    <div className="summon-card-type">
                      {t.type}
                      {t.element && ELEMENT_INFO[t.element] && (
                        <span className="summon-element" style={{ color: ELEMENT_INFO[t.element].color }}>
                          {ELEMENT_INFO[t.element].icon} {ELEMENT_INFO[t.element].name}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
                <div className="summon-card-stats">
                  <span className="eff hp">HP {t.base_hp}</span>
                  <span className="eff mp">MP {t.base_mp}</span>
                  <span className="eff atk">물공 {t.base_phys_attack || 0}</span>
                  <span className="eff atk">마공 {t.base_mag_attack || 0}</span>
                  <span className="eff def">물방 {t.base_phys_defense || 0}</span>
                  <span className="eff def">마방 {t.base_mag_defense || 0}</span>
                  <span className="eff mp">이동 3</span>
                  {t.required_level > 1 && <span className="eff lvl">Lv.{t.required_level}</span>}
                </div>
                <div className="summon-card-bottom">
                  <span className="fitem-price">{t.price.toLocaleString()}G</span>
                  <button
                    className={`fitem-btn buy ${(owned || cantAfford || cantLevel) ? 'disabled' : ''}`}
                    disabled={owned || cantAfford || cantLevel}
                    onClick={() => handleBuy(t.id)}
                  >
                    {owned ? '보유 중' : cantLevel ? `Lv.${t.required_level}` : cantAfford ? '골드 부족' : '고용'}
                  </button>
                </div>
              </div>
            );
          })}
          {filteredTemplates.length === 0 && (
            <div className="facility-empty">해당 타입의 소환수가 없습니다.</div>
          )}
        </div>
      ) : (
        <div className="summon-grid">
          {filteredSummons.map((s) => (
            <div key={s.id} className="summon-card owned">
              <div className="summon-card-top">
                <SummonImg src={s.icon_url_img || `/summons/${s.template_id}_icon.png`} fallback={s.icon} className="summon-card-icon" />
                <div className="summon-card-info">
                  <div className="summon-card-name">{s.name}</div>
                  <div className="summon-card-type">
                    {s.type} · Lv.{s.level}
                    {s.element && ELEMENT_INFO[s.element] && (
                      <span className="summon-element" style={{ color: ELEMENT_INFO[s.element].color }}>
                        {ELEMENT_INFO[s.element].icon} {ELEMENT_INFO[s.element].name}
                      </span>
                    )}
                  </div>
                </div>
              </div>
              <div className="summon-card-level-bar">
                <div className="bar-label">
                  <span>EXP</span>
                  <span>{s.exp}/{s.level * 50}</span>
                </div>
                <ProgressBar now={(s.exp / (s.level * 50)) * 100} variant="warning" style={{ height: 6 }} />
              </div>
              <div className="summon-card-stats">
                <span className="eff hp">HP {s.hp}</span>
                <span className="eff mp">MP {s.mp}</span>
                <span className="eff atk">물공 {s.phys_attack || 0}</span>
                <span className="eff atk">마공 {s.mag_attack || 0}</span>
                <span className="eff def">물방 {s.phys_defense || 0}</span>
                <span className="eff def">마방 {s.mag_defense || 0}</span>
                <span className="eff mp">이동 3</span>
              </div>
              {s.learned_skills && s.learned_skills.length > 0 && (
                <div className="summon-card-skills">
                  {s.learned_skills.map((sk) => (
                    <Badge key={sk.id} bg="dark" className="summon-skill-tag" title={sk.description}
                      style={{ background: 'rgba(59, 130, 246, 0.08)', color: '#60a5fa' }}>
                      {SKILL_TYPE_ICONS[sk.type]} {sk.name}
                    </Badge>
                  ))}
                </div>
              )}
              <div className="summon-card-actions">
                <button className="fitem-btn buy" onClick={() => { setSelectedSummon(s); setShowEquipment(true); }}>장비</button>
                <button className="fitem-btn buy" onClick={() => loadSkills(s.id)}>스킬</button>
                <button className="fitem-btn sell" onClick={() => handleSell(s.id)}>해고 ({s.sell_price}G)</button>
              </div>
            </div>
          ))}
          {filteredSummons.length === 0 && (
            <div className="facility-empty">보유한 소환수가 없습니다.</div>
          )}
        </div>
      )}
    </div>
  );
}

export default Summon;
