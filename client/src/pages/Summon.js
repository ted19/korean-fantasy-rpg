import React, { useState, useEffect, useCallback } from 'react';
import { Nav, Badge, Button, ProgressBar } from 'react-bootstrap';
import api from '../api';
import SummonEquipment from './SummonEquipment';

const TYPE_FILTERS = ['전체', '귀신', '몬스터', '정령', '언데드'];

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

  const handleBuy = async (templateId) => {
    try {
      const res = await api.post('/summon/buy', { templateId });
      onLog(res.data.message, 'system');
      onCharStateUpdate({ gold: res.data.gold });
      loadMySummons();
    } catch (err) {
      onLog(err.response?.data?.message || '고용 실패', 'damage');
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

  const filteredTemplates = templates.filter(
    (t) => typeFilter === '전체' || t.type === typeFilter
  );

  const filteredSummons = mySummons.filter(
    (s) => typeFilter === '전체' || s.type === typeFilter
  );

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
            <div className="summon-card-type">{summon?.type} · Lv.{summon?.level}</div>
          </div>
        </div>
        <div className="summon-skills-list">
          {skillsData.skills.map((skill) => (
            <div key={skill.id} className={`summon-skill-card ${skill.learned ? 'learned' : ''} ${summon?.level < skill.required_level ? 'locked' : ''}`}>
              <div className="summon-skill-top">
                <span className="summon-skill-type-icon">{SKILL_TYPE_ICONS[skill.type]}</span>
                <span className="summon-skill-name">{skill.name}</span>
                <Badge bg="dark" style={{ color: 'var(--orange)', background: 'rgba(245, 158, 11, 0.1)' }}>{skill.skill_category}</Badge>
                <Badge bg="dark" style={{ color: 'var(--blue)', background: 'rgba(59, 130, 246, 0.1)' }}>{skill.mp_cost}MP</Badge>
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
            <div className="summon-empty">배울 수 있는 스킬이 없습니다.</div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="summon-container">
      <Nav variant="tabs" className="mb-3">
        <Nav.Item>
          <Nav.Link active={tab === 'shop'} onClick={() => setTab('shop')}>고용하기</Nav.Link>
        </Nav.Item>
        <Nav.Item>
          <Nav.Link active={tab === 'my'} onClick={() => setTab('my')}>
            내 소환수 <Badge bg="secondary" className="ms-1">{mySummons.length}</Badge>
          </Nav.Link>
        </Nav.Item>
      </Nav>

      <div className="shop-filters">
        <Nav variant="pills" className="flex-wrap gap-1 flex-grow-1">
          {TYPE_FILTERS.map((f) => (
            <Nav.Item key={f}>
              <Nav.Link
                active={typeFilter === f}
                onClick={() => setTypeFilter(f)}
                className="py-1 px-2"
              >
                {f}
              </Nav.Link>
            </Nav.Item>
          ))}
        </Nav>
        <span className="shop-gold ms-2">{charState.gold}G</span>
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
                    <div className="summon-card-type">{t.type}</div>
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
                  <span className="item-price">{t.price}G</span>
                  <Button
                    size="sm"
                    variant="primary"
                    disabled={owned || cantAfford || cantLevel}
                    onClick={() => handleBuy(t.id)}
                  >
                    {owned ? '보유 중' : cantLevel ? `Lv.${t.required_level}` : cantAfford ? '골드 부족' : '고용'}
                  </Button>
                </div>
              </div>
            );
          })}
          {filteredTemplates.length === 0 && (
            <div className="summon-empty">해당 타입의 소환수가 없습니다.</div>
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
                  <div className="summon-card-type">{s.type} · Lv.{s.level}</div>
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
                      style={{ background: 'rgba(59, 130, 246, 0.08)', color: 'var(--blue)' }}>
                      {SKILL_TYPE_ICONS[sk.type]} {sk.name}
                    </Badge>
                  ))}
                </div>
              )}
              <div className="summon-card-actions">
                <Button size="sm" variant="primary" onClick={() => { setSelectedSummon(s); setShowEquipment(true); }}>
                  장비
                </Button>
                <Button size="sm" variant="primary" onClick={() => loadSkills(s.id)}>
                  스킬
                </Button>
                <Button size="sm" variant="outline-danger" onClick={() => handleSell(s.id)}>
                  해고 ({s.sell_price}G)
                </Button>
              </div>
            </div>
          ))}
          {filteredSummons.length === 0 && (
            <div className="summon-empty">보유한 소환수가 없습니다.</div>
          )}
        </div>
      )}
    </div>
  );
}

export default Summon;
