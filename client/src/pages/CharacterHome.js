import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Nav, Row, Col, Card, Badge, ProgressBar, Button } from 'react-bootstrap';
import api from '../api';
import Equipment from './Equipment';
import SkillTreePanel from './SkillTreePanel';
import SummonEquipment from './SummonEquipment';
import MercenaryEquipment from './MercenaryEquipment';
import FormationArea from './FormationArea';
import '../srpg/StageBattle.css';

const ELEMENT_AURA = {
  fire: 'flame', water: 'ice', earth: 'aura_gold', wind: 'wind', neutral: 'holy',
  light: 'holy', dark: 'shadow', lightning: 'lightning', poison: 'poison',
};

const CLASS_IMAGES = {
  '풍수사': '/characters/pungsu_full.png',
  '무당': '/characters/mudang_full.png',
  '승려': '/characters/monk_full.png',
  '저승사자': '/characters/reaper_full.png',
};

const SKILL_TYPE_ICONS = { attack: '⚔️', heal: '💚', buff: '🔺', debuff: '🔻' };

const BUFF_STAT_NAMES = {
  attack: '공격력', defense: '방어력', phys_attack: '물리공격', phys_defense: '물리방어',
  mag_attack: '마법공격', mag_defense: '마법방어', crit_rate: '치명률', evasion: '회피율',
};

function renderSkillTags(sk) {
  return (
    <div className="skill-manage-tags">
      <span className="skill-manage-tag">{sk.type === 'attack' ? '공격' : sk.type === 'heal' ? '회복' : sk.type === 'buff' ? '버프' : sk.type === 'debuff' ? '디버프' : sk.type}</span>
      {sk.mp_cost > 0 && <span className="skill-manage-tag mp">MP {sk.mp_cost}</span>}
      {sk.damage_multiplier > 0 && <span className="skill-manage-tag pow">배율 x{sk.damage_multiplier}</span>}
      {sk.heal_amount > 0 && <span className="skill-manage-tag heal">회복 {sk.heal_amount}</span>}
      {sk.buff_stat && <span className="skill-manage-tag buff">{BUFF_STAT_NAMES[sk.buff_stat] || sk.buff_stat} {sk.buff_value >= 0 ? '+' : ''}{sk.buff_value} ({sk.buff_duration}턴)</span>}
      {sk.cooldown > 0 && <span className="skill-manage-tag cd">쿨타임 {sk.cooldown}턴</span>}
    </div>
  );
}

const PRIORITY_PRESETS = [
  { value: 0, label: '사용안함', color: '#555', icon: '🚫' },
  { value: 50, label: '소극적', color: '#60a5fa', icon: '🔹' },
  { value: 100, label: '보통', color: '#4ade80', icon: '✅' },
  { value: 150, label: '적극적', color: '#fbbf24', icon: '🔸' },
  { value: 200, label: '최우선', color: '#ef4444', icon: '🔥' },
];

function getPriorityInfo(value) {
  if (value === 0) return PRIORITY_PRESETS[0];
  if (value <= 50) return PRIORITY_PRESETS[1];
  if (value <= 100) return PRIORITY_PRESETS[2];
  if (value <= 150) return PRIORITY_PRESETS[3];
  return PRIORITY_PRESETS[4];
}

function SkillManagePanel({ skills, onPriorityChange }) {
  if (!skills || skills.length === 0) {
    return (
      <div className="skill-manage-empty">
        <div className="skill-manage-empty-icon">📭</div>
        <div className="skill-manage-empty-text">습득한 액티브 스킬이 없습니다.</div>
        <div className="skill-manage-empty-hint">스킬 트리에서 스킬을 해금하세요.</div>
      </div>
    );
  }

  return (
    <div className="skill-manage-panel">
      <div className="skill-manage-header-bar">
        <span className="skill-manage-header-title">자동전투 스킬 우선도</span>
        <span className="skill-manage-header-desc">전투 AI가 스킬을 선택할 때의 우선도를 조절합니다</span>
      </div>
      <div className="skill-manage-legend">
        {PRIORITY_PRESETS.map(p => (
          <span key={p.value} className="skill-manage-legend-item" style={{ color: p.color }}>
            {p.icon} {p.label}
          </span>
        ))}
      </div>
      <div className="skill-manage-list-v2">
        {skills.map(sk => {
          const pri = sk.auto_priority ?? 100;
          const info = getPriorityInfo(pri);
          return (
            <div key={sk.id} className={`skill-manage-card ${pri === 0 ? 'disabled' : ''}`}>
              <div className="skill-manage-card-left">
                <div className="skill-manage-card-icon">
                  <img src={`/skills/${sk.id}_icon.png`} alt="" className="skill-manage-card-icon-img" onError={(e) => { e.target.style.display='none'; e.target.nextSibling.style.display='flex'; }} />
                  <span className="skill-manage-card-icon-fallback" style={{ display: 'none' }}>{sk.icon}</span>
                </div>
                <div className="skill-manage-card-info">
                  <div className="skill-manage-card-name">{sk.name}</div>
                  <div className="skill-manage-card-desc">{sk.description}</div>
                  {renderSkillTags(sk)}
                </div>
              </div>
              <div className="skill-manage-card-right">
                <div className="skill-manage-priority-label" style={{ color: info.color }}>
                  {info.icon} {info.label}
                </div>
                <div className="skill-manage-priority-btns">
                  {PRIORITY_PRESETS.map(p => (
                    <button
                      key={p.value}
                      className={`skill-manage-pri-btn ${pri === p.value ? 'active' : ''}`}
                      style={pri === p.value ? { background: p.color, borderColor: p.color } : {}}
                      onClick={() => onPriorityChange(sk.id, p.value)}
                      title={p.label}
                    >
                      {p.icon}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          );
        })}
      </div>
      <div className="skill-manage-tip">
        💡 <strong>사용안함</strong>: 자동전투에서 해당 스킬을 사용하지 않습니다.
        <strong>최우선</strong>: 가능한 한 항상 이 스킬을 먼저 사용합니다.
      </div>
    </div>
  );
}

const ELEMENT_INFO = {
  fire:    { name: '불', icon: '🔥', color: '#ff6b35' },
  water:   { name: '물', icon: '💧', color: '#4da6ff' },
  earth:   { name: '땅', icon: '🪨', color: '#8bc34a' },
  wind:    { name: '바람', icon: '🌀', color: '#b388ff' },
  neutral: { name: '중립', icon: '⚪', color: '#9ca3af' },
};

const CLASS_RANGE_TYPE = {
  '풍수사': { type: '마법형', icon: '🔮', color: '#a78bfa' },
  '무당': { type: '마법형', icon: '🔮', color: '#a78bfa' },
  '승려': { type: '근거리', icon: '👊', color: '#fb923c' },
  '저승사자': { type: '근거리', icon: '💀', color: '#c084fc' },
};

function SummonImg({ src, fallback, className }) {
  const [err, setErr] = useState(false);
  if (err) return <span className={className}>{fallback}</span>;
  return <img src={src} alt="" className={className} onError={() => setErr(true)} />;
}

function SkillIcon({ src, fallback, className }) {
  const [err, setErr] = useState(false);
  if (err || !src) return <span className={className}>{fallback}</span>;
  return <img src={src} alt="" className={className} onError={() => setErr(true)} />;
}

const RANGE_TYPE_INFO = {
  melee: { type: '근거리', icon: '👊', color: '#fb923c' },
  ranged: { type: '원거리', icon: '🏹', color: '#22d3ee' },
  magic: { type: '마법형', icon: '🔮', color: '#a78bfa' },
};

const COSMETIC_EFFECT_INFO = {
  aura_gold: { name: '황금 기운', color: '#ffa502' }, flame: { name: '불꽃 오라', color: '#ff4500' },
  ice: { name: '빙결 오라', color: '#87cefa' }, lightning: { name: '번개 오라', color: '#ffd700' },
  shadow: { name: '암흑 오라', color: '#9b59b6' }, holy: { name: '신성 오라', color: '#fff3bf' },
  poison: { name: '독기 오라', color: '#2ed573' }, wind: { name: '바람 오라', color: '#96dcff' },
  blood: { name: '혈기 오라', color: '#b40000' }, spirit: { name: '영혼 오라', color: '#b482ff' },
  dragon_breath: { name: '용의 숨결', color: '#ff8c00' }, celestial: { name: '천상의 빛', color: '#e0c0ff' },
  abyssal_flame: { name: '심연의 화염', color: '#8b00c8' }, starlight: { name: '별빛 오라', color: '#aab8ff' },
  phoenix: { name: '봉황의 기운', color: '#ff6600' }, chaos_vortex: { name: '혼돈의 소용돌이', color: '#c850ff' },
};

function CosmeticSection({ character, mercenaries, onLog }) {
  const [cosmetics, setCosmetics] = useState({});
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    try {
      const res = await api.get('/shop/cosmetics/equipped');
      setCosmetics(res.data.cosmetics || {});
    } catch {} finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleUnequip = async (entityType, entityId) => {
    try {
      const res = await api.post('/shop/cosmetic/unequip', { entityType, entityId });
      if (onLog) onLog(res.data.message, 'heal');
      load();
    } catch (err) {
      if (onLog) onLog(err.response?.data?.message || '해제 실패', 'damage');
    }
  };

  if (loading) return null;
  const hasAny = Object.keys(cosmetics).length > 0;
  if (!hasAny) return null;

  const entries = [];
  if (cosmetics['player']) entries.push({ key: 'player', label: character?.name || '캐릭터', ...cosmetics['player'], entityType: 'character', entityId: 0 });
  (mercenaries || []).forEach(m => {
    const k = `merc_${m.id}`;
    if (cosmetics[k]) entries.push({ key: k, label: m.name, ...cosmetics[k], entityType: 'mercenary', entityId: m.id });
  });

  if (entries.length === 0) return null;

  return (
    <Card className="mt-3" style={{ background: 'rgba(20,25,40,0.9)', border: '1px solid #2a2f4a' }}>
      <Card.Body>
        <div style={{ fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: 2, fontWeight: 600, marginBottom: 10 }}>
          코스메틱 초상화 효과
        </div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10 }}>
          {entries.map(e => {
            const info = COSMETIC_EFFECT_INFO[e.effect] || { name: e.effect, color: '#aaa' };
            return (
              <div key={e.key} style={{ background: 'rgba(30,35,55,0.8)', borderRadius: 8, padding: '8px 14px', border: `1px solid ${info.color}44`, display: 'flex', alignItems: 'center', gap: 10, minWidth: 200 }}>
                <div style={{ width: 10, height: 10, borderRadius: '50%', background: info.color, boxShadow: `0 0 8px ${info.color}88` }} />
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 13, color: '#eee' }}>{e.label}</div>
                  <div style={{ fontSize: 11, color: info.color }}>{info.name} - {e.itemName}</div>
                </div>
                <button onClick={() => handleUnequip(e.entityType, e.entityId)}
                  style={{ background: 'rgba(200,50,50,0.3)', border: '1px solid #e9456044', color: '#e94560', fontSize: 11, padding: '2px 8px', borderRadius: 4, cursor: 'pointer' }}>
                  해제
                </button>
              </div>
            );
          })}
        </div>
      </Card.Body>
    </Card>
  );
}

function ContentGuide({ onNavigateVillage }) {
  const [guide, setGuide] = useState(null);
  const [collapsed, setCollapsed] = useState(true);
  const [msgIdx, setMsgIdx] = useState(0);

  useEffect(() => {
    api.get('/characters/daily-guide').then(r => setGuide(r.data)).catch(() => {});
  }, []);

  const items = useMemo(() => {
    if (!guide) return [];
    const list = [];
    if (guide.pendingRewards > 0) list.push({ key: 'reward', icon: '🎁', label: '보상 수령', status: 'urgent', msg: <>보상을 받지 않은 퀘스트가 {guide.pendingRewards}개! <span className="guide-link" onClick={(e) => { e.stopPropagation(); onNavigateVillage && onNavigateVillage('quest'); }}>길드</span>에서 보상을 받으세요.</> });
    if (guide.dailyQuestsTotal > 0 && guide.dailyQuestsCompleted < guide.dailyQuestsTotal) list.push({ key: 'daily', icon: '📋', label: '일일 퀘스트', status: 'pending', msg: `오늘의 일일 퀘스트를 완료하지 않았어요. (${guide.dailyQuestsCompleted}/${guide.dailyQuestsTotal})` });
    if (!guide.fortuneDone) list.push({ key: 'fortune', icon: '🔮', label: '오늘의 운세', status: 'pending', msg: <>오늘의 운세를 확인해보세요. <span className="guide-link" onClick={(e) => { e.stopPropagation(); onNavigateVillage && onNavigateVillage('fortune'); }}>운명술사의 집</span> 방문!</> });
    if (!guide.tarotDone) list.push({ key: 'tarot', icon: '🃏', label: '타로 카드', status: 'pending', msg: '타로 카드를 뽑을 수 있어요!' });
    if (guide.stageBattlesDone === 0) list.push({ key: 'stage', icon: '⚔️', label: '스테이지', status: 'pending', msg: '오늘 스테이지 전투를 아직 하지 않았어요.' });
    if (guide.dungeonBattlesDone === 0) list.push({ key: 'dungeon', icon: '🏰', label: '던전', status: 'pending', msg: '던전 탐험을 아직 하지 않았어요.' });
    return list;
  }, [guide, onNavigateVillage]);

  useEffect(() => {
    if (items.length <= 1) { setMsgIdx(0); return; }
    const timer = setInterval(() => {
      setMsgIdx(prev => (prev + 1) % items.length);
    }, 4000);
    return () => clearInterval(timer);
  }, [items.length]);

  if (!guide) return null;

  const allDone = items.length === 0;
  const topMsg = allDone
    ? '오늘 할 일을 모두 마쳤어요! 대단해요! ✨'
    : items[msgIdx % items.length].msg;

  // mark done items
  const allCards = [
    { key: 'reward', icon: '🎁', label: '보상 수령', done: guide.pendingRewards === 0 },
    { key: 'daily', icon: '📋', label: '일일 퀘스트', done: guide.dailyQuestsTotal > 0 ? guide.dailyQuestsCompleted >= guide.dailyQuestsTotal : true },
    { key: 'fortune', icon: '🔮', label: '운세', done: guide.fortuneDone },
    { key: 'tarot', icon: '🃏', label: '타로', done: guide.tarotDone },
    { key: 'stage', icon: '⚔️', label: '스테이지', done: guide.stageBattlesDone > 0 },
    { key: 'dungeon', icon: '🏰', label: '던전', done: guide.dungeonBattlesDone > 0 },
  ];

  return (
    <div className="content-guide">
      <div className="content-guide-npc" onClick={() => setCollapsed(!collapsed)}>
        <div className="content-guide-avatar"><img src="/ui/guide_fairy_portrait.png" alt="길잡이 선녀" /></div>
        <div className="content-guide-bubble">
          <div className="content-guide-name">길잡이 선녀</div>
          <div className="content-guide-msg">{topMsg}</div>
        </div>
        <div className={`content-guide-toggle ${collapsed ? 'collapsed' : ''}`}>▼</div>
      </div>
      {!collapsed && (
        <div className="content-guide-cards">
          {allCards.map(c => {
            const pending = items.find(i => i.key === c.key);
            const status = c.done ? 'done' : (pending?.status || 'pending');
            return (
              <div key={c.key} className={`content-guide-card ${status}`}>
                <div className="content-guide-card-icon">{c.icon}</div>
                <div className="content-guide-card-label">{c.label}</div>
                <div className="content-guide-card-status">
                  {c.done ? '✅' : status === 'urgent' ? '🔴' : '⏳'}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function CharacterHome({ character, charState, onCharStateUpdate, onLog, onSkillsUpdate, onSummonsChanged, onMercenariesChanged, myMercenaries, onNavigateVillage, initialTab, onInitialTabConsumed, prologueCleared }) {
  const [tab, setTab] = useState(initialTab || 'character');

  useEffect(() => {
    if (initialTab) {
      setTab(initialTab);
      if (onInitialTabConsumed) onInitialTabConsumed();
    }
  }, [initialTab, onInitialTabConsumed]);
  const [mySummons, setMySummons] = useState([]);
  const [selectedSummon, setSelectedSummon] = useState(null);
  const [showEquipment, setShowEquipment] = useState(false);
  const [selectedMerc, setSelectedMerc] = useState(null);
  // 스킬 관리 상태
  const [showSummonSkills, setShowSummonSkills] = useState(false);
  const [summonSkillList, setSummonSkillList] = useState([]);
  const [summonSkillLevel, setSummonSkillLevel] = useState(0);
  const [showMercSkills, setShowMercSkills] = useState(false);
  const [mercSkillList, setMercSkillList] = useState([]);
  const [mercSkillLevel, setMercSkillLevel] = useState(0);
  const [showMercEquipment, setShowMercEquipment] = useState(false);
  const [equippedCosmetics, setEquippedCosmetics] = useState({});
  // 스킬 서브탭 (스킬트리 / 스킬관리)
  const [skillSubTab, setSkillSubTab] = useState('tree');
  const [managedSkills, setManagedSkills] = useState([]);

  const loadCosmetics = useCallback(async () => {
    try {
      const res = await api.get('/shop/cosmetics/equipped');
      setEquippedCosmetics(res.data.cosmetics || {});
    } catch {}
  }, []);

  useEffect(() => { loadCosmetics(); }, [loadCosmetics]);

  const getAuraEffect = useCallback((entityKey, element) => {
    const equipped = equippedCosmetics[entityKey];
    if (equipped) return equipped.effect;
    return ELEMENT_AURA[element] || 'aura_gold';
  }, [equippedCosmetics]);

  const loadManagedSkills = useCallback(async () => {
    try {
      const res = await api.get('/skill/active-skills');
      setManagedSkills((res.data.skills || []).map(s => ({ ...s })));
    } catch {}
  }, []);

  useEffect(() => { if (skillSubTab === 'manage') loadManagedSkills(); }, [skillSubTab, loadManagedSkills]);

  const updateSkillPriority = async (nodeId, priority) => {
    setManagedSkills(prev => prev.map(s => s.id === nodeId ? { ...s, auto_priority: priority } : s));
    try {
      await api.put('/skill/auto-priority', { node_id: nodeId, priority });
      // 전투용 learnedSkills도 즉시 갱신
      const res = await api.get('/skill/active-skills');
      if (onSkillsUpdate) onSkillsUpdate(res.data.skills || []);
    } catch {
      if (onLog) onLog('우선도 변경 실패');
    }
  };

  const loadMySummons = useCallback(async () => {
    try {
      const res = await api.get('/summon/my');
      setMySummons(res.data.summons);
    } catch {}
  }, []);

  useEffect(() => { loadMySummons(); }, [loadMySummons]);
  useEffect(() => {
    if (mySummons.length > 0) {
      if (!selectedSummon) {
        setSelectedSummon(mySummons[0]);
      } else {
        const updated = mySummons.find(s => s.id === selectedSummon.id);
        if (updated) setSelectedSummon(updated);
        else setSelectedSummon(mySummons[0]);
      }
    }
  }, [mySummons]);
  useEffect(() => {
    if (myMercenaries && myMercenaries.length > 0) {
      if (!selectedMerc) {
        setSelectedMerc(myMercenaries[0]);
      } else {
        const updated = myMercenaries.find(m => m.id === selectedMerc.id);
        if (updated) setSelectedMerc(updated);
        else setSelectedMerc(myMercenaries[0]);
      }
    }
  }, [myMercenaries]);

  // 소환수 스킬 로드
  const loadSummonSkills = useCallback(async (summonId) => {
    try {
      const res = await api.get(`/summon/${summonId}/skills`);
      setSummonSkillList(res.data.skills);
      setSummonSkillLevel(res.data.summonLevel);
      setShowSummonSkills(true);
    } catch (err) {
      if (onLog) onLog('스킬 정보를 불러올 수 없습니다.');
    }
  }, [onLog]);

  const learnSummonSkill = useCallback(async (summonId, skillId) => {
    try {
      const res = await api.post(`/summon/${summonId}/learn-skill`, { skillId });
      if (onLog) onLog(res.data.message);
      if (res.data.gold !== undefined && onCharStateUpdate) onCharStateUpdate({ gold: res.data.gold });
      loadSummonSkills(summonId);
      loadMySummons();
      if (onSummonsChanged) onSummonsChanged();
    } catch (err) {
      if (onLog) onLog(err.response?.data?.message || '스킬 학습 실패');
    }
  }, [onLog, loadSummonSkills, loadMySummons, onSummonsChanged, onCharStateUpdate]);

  // 용병 스킬 로드
  const loadMercSkills = useCallback(async (mercId) => {
    try {
      const res = await api.get(`/mercenary/${mercId}/skills`);
      setMercSkillList(res.data.skills);
      setMercSkillLevel(res.data.mercLevel);
      setShowMercSkills(true);
    } catch (err) {
      if (onLog) onLog('스킬 정보를 불러올 수 없습니다.');
    }
  }, [onLog]);

  const learnMercSkill = useCallback(async (mercId, skillId) => {
    try {
      const res = await api.post(`/mercenary/${mercId}/learn-skill`, { skillId });
      if (onLog) onLog(res.data.message);
      if (res.data.gold !== undefined && onCharStateUpdate) onCharStateUpdate({ gold: res.data.gold });
      loadMercSkills(mercId);
      if (onMercenariesChanged) onMercenariesChanged();
    } catch (err) {
      if (onLog) onLog(err.response?.data?.message || '스킬 학습 실패');
    }
  }, [onLog, loadMercSkills, onMercenariesChanged]);

  return (
    <>
    {/* 소환수 장비 레이어 팝업 */}
    {showEquipment && selectedSummon && (
      <div className="summon-equip-overlay" onClick={() => setShowEquipment(false)}>
        <div className="summon-equip-modal" onClick={(e) => e.stopPropagation()}>
          <div className="summon-equip-modal-header">
            <span className="summon-equip-modal-title">{selectedSummon.name} - 장비 관리</span>
            <button className="summon-equip-modal-close" onClick={() => setShowEquipment(false)}>&times;</button>
          </div>
          <div className="summon-equip-modal-body">
            <SummonEquipment
              summon={selectedSummon}
              onLog={onLog}
              onSummonUpdate={() => { loadMySummons(); if (onSummonsChanged) onSummonsChanged(); }}
            />
          </div>
        </div>
      </div>
    )}
    {/* 소환수 스킬 관리 팝업 */}
    {showSummonSkills && selectedSummon && (
      <div className="summon-equip-overlay" onClick={() => setShowSummonSkills(false)}>
        <div className="summon-equip-modal" onClick={(e) => e.stopPropagation()}>
          <div className="summon-equip-modal-header">
            <span className="summon-equip-modal-title">{selectedSummon.name} - 스킬 관리</span>
            <button className="summon-equip-modal-close" onClick={() => setShowSummonSkills(false)}>&times;</button>
          </div>
          <div className="summon-equip-modal-body">
            <div className="skill-manage-list">
              {summonSkillList.length === 0 ? (
                <div className="text-center py-3" style={{ color: 'var(--text-dark)' }}>학습 가능한 스킬이 없습니다.</div>
              ) : summonSkillList.map((sk) => (
                <div key={sk.id} className={`skill-manage-row ${sk.learned ? 'learned' : ''}`}>
                  <SkillIcon src={`/summon_skills/${sk.id}_icon.png`} fallback={SKILL_TYPE_ICONS[sk.type] || '⚡'} className="skill-manage-icon-img" />
                  <div className="skill-manage-info">
                    <div className="skill-manage-name">{sk.name} <span className="skill-manage-lv">Lv.{sk.required_level}</span></div>
                    <div className="skill-manage-desc">{sk.description}</div>
                    {renderSkillTags(sk)}
                    {sk.learned && (
                      <div className="skill-manage-priority-row">
                        <span className="skill-manage-priority-title">자동전투:</span>
                        <div className="skill-manage-priority-btns">
                          {PRIORITY_PRESETS.map(p => (
                            <button key={p.value}
                              className={`skill-manage-pri-btn ${(sk.auto_priority ?? 100) === p.value ? 'active' : ''}`}
                              style={(sk.auto_priority ?? 100) === p.value ? { background: p.color, borderColor: p.color } : {}}
                              title={p.label}
                              onClick={async () => {
                                setSummonSkillList(prev => prev.map(s => s.id === sk.id ? { ...s, auto_priority: p.value } : s));
                                try {
                                  await api.put(`/summon/${selectedSummon.id}/skill-priority`, { skill_id: sk.id, priority: p.value });
                                  loadMySummons(); if (onSummonsChanged) onSummonsChanged();
                                }
                                catch { if (onLog) onLog('우선도 변경 실패'); }
                              }}
                            >{p.icon}</button>
                          ))}
                        </div>
                        <span className="skill-manage-priority-label" style={{ color: getPriorityInfo(sk.auto_priority ?? 100).color }}>
                          {getPriorityInfo(sk.auto_priority ?? 100).label}
                        </span>
                      </div>
                    )}
                  </div>
                  <div className="skill-manage-action">
                    {sk.learned ? (
                      <Badge bg="success" style={{ fontSize: 11 }}>습득</Badge>
                    ) : summonSkillLevel < sk.required_level ? (
                      <Badge bg="secondary" style={{ fontSize: 10 }}>Lv.{sk.required_level} 필요</Badge>
                    ) : (character?.gold || 0) < (sk.gold_cost || 0) ? (
                      <Badge bg="secondary" style={{ fontSize: 10 }}>골드 부족</Badge>
                    ) : sk.canLearn ? (
                      <Button size="sm" variant="primary" onClick={() => learnSummonSkill(selectedSummon.id, sk.id)}>
                        {(sk.gold_cost || 0).toLocaleString()}G 학습
                      </Button>
                    ) : summonSkillLevel >= sk.required_level ? (
                      <Badge bg="info" style={{ fontSize: 10, whiteSpace: 'nowrap', cursor: 'pointer' }} onClick={() => onNavigateVillage && onNavigateVillage('summon', { summonId: selectedSummon.id })}>마을에서 습득</Badge>
                    ) : (
                      <Badge bg="secondary" style={{ fontSize: 10 }}>Lv.{sk.required_level} 필요</Badge>
                    )}
                  </div>
                </div>
              ))}
            </div>
            {summonSkillList.some(sk => !sk.learned && !sk.canLearn && summonSkillLevel >= sk.required_level) && (
              <div style={{ marginTop: 10, padding: '8px 12px', background: 'rgba(13,202,240,0.08)', borderRadius: 8, color: '#0dcaf0', fontSize: 12, textAlign: 'center', border: '1px solid rgba(13,202,240,0.15)' }}>
                💡 배울 수 있는 스킬이 있습니다! <span className="guide-link" onClick={() => onNavigateVillage && onNavigateVillage('summon', { summonId: selectedSummon.id })}>소환술사의 집</span>에서 스킬을 습득하세요.
              </div>
            )}
          </div>
        </div>
      </div>
    )}
    {/* 용병 스킬 관리 팝업 */}
    {showMercSkills && selectedMerc && (
      <div className="summon-equip-overlay" onClick={() => setShowMercSkills(false)}>
        <div className="summon-equip-modal" onClick={(e) => e.stopPropagation()}>
          <div className="summon-equip-modal-header">
            <span className="summon-equip-modal-title">{selectedMerc.name} - 스킬 관리</span>
            <button className="summon-equip-modal-close" onClick={() => setShowMercSkills(false)}>&times;</button>
          </div>
          <div className="summon-equip-modal-body">
            <div className="skill-manage-list">
              {mercSkillList.length === 0 ? (
                <div className="text-center py-3" style={{ color: 'var(--text-dark)' }}>학습 가능한 스킬이 없습니다.</div>
              ) : mercSkillList.map((sk) => (
                <div key={sk.id} className={`skill-manage-row ${sk.learned ? 'learned' : ''}`}>
                  <SkillIcon src={`/merc_skills/${sk.id}_icon.png`} fallback={SKILL_TYPE_ICONS[sk.type] || '⚡'} className="skill-manage-icon-img" />
                  <div className="skill-manage-info">
                    <div className="skill-manage-name">{sk.name} <span className="skill-manage-lv">Lv.{sk.required_level}</span></div>
                    <div className="skill-manage-desc">{sk.description}</div>
                    <div className="skill-manage-tags">
                      {sk.mp_cost > 0 && <span className="skill-manage-tag mp">MP {sk.mp_cost}</span>}
                      {sk.type === 'attack' && sk.damage_multiplier > 0 && <span className="skill-manage-tag pow">배율 x{sk.damage_multiplier}</span>}
                      {sk.heal_amount > 0 && <span className="skill-manage-tag heal">회복 {sk.heal_amount}</span>}
                      {sk.buff_stat && <span className="skill-manage-tag buff">{{attack:'ATK', defense:'DEF', phys_attack:'물공', phys_defense:'물방', mag_attack:'마공', mag_defense:'마방', crit_rate:'치명', evasion:'회피'}[sk.buff_stat] || sk.buff_stat}{sk.buff_value >= 0 ? '+' : ''}{sk.buff_value} ({sk.buff_duration}턴)</span>}
                      {sk.cooldown > 0 && <span className="skill-manage-tag cd">쿨타임 {sk.cooldown}턴</span>}
                      {!sk.learned && <span className="skill-manage-tag" style={{ color: '#ffa502', borderColor: 'rgba(255,165,2,0.2)' }}>{(sk.gold_cost || 0).toLocaleString()}G</span>}
                    </div>
                    {sk.learned && (
                      <div className="skill-manage-priority-row">
                        <span className="skill-manage-priority-title">자동전투:</span>
                        <div className="skill-manage-priority-btns">
                          {PRIORITY_PRESETS.map(p => (
                            <button key={p.value}
                              className={`skill-manage-pri-btn ${(sk.auto_priority ?? 100) === p.value ? 'active' : ''}`}
                              style={(sk.auto_priority ?? 100) === p.value ? { background: p.color, borderColor: p.color } : {}}
                              title={p.label}
                              onClick={async () => {
                                setMercSkillList(prev => prev.map(s => s.id === sk.id ? { ...s, auto_priority: p.value } : s));
                                try {
                                  await api.put(`/mercenary/${selectedMerc.id}/skill-priority`, { skill_id: sk.id, priority: p.value });
                                  if (onMercenariesChanged) onMercenariesChanged();
                                }
                                catch { if (onLog) onLog('우선도 변경 실패'); }
                              }}
                            >{p.icon}</button>
                          ))}
                        </div>
                        <span className="skill-manage-priority-label" style={{ color: getPriorityInfo(sk.auto_priority ?? 100).color }}>
                          {getPriorityInfo(sk.auto_priority ?? 100).label}
                        </span>
                      </div>
                    )}
                  </div>
                  <div className="skill-manage-action">
                    {sk.learned ? (
                      <Badge bg="success" style={{ fontSize: 11 }}>습득</Badge>
                    ) : !sk.canLearn ? (
                      <Badge bg="secondary" style={{ fontSize: 10 }}>Lv.{sk.required_level} 필요</Badge>
                    ) : (character?.gold || 0) < (sk.gold_cost || 0) ? (
                      <Badge bg="secondary" style={{ fontSize: 10 }}>골드 부족</Badge>
                    ) : (
                      <Button size="sm" variant="primary" onClick={() => learnMercSkill(selectedMerc.id, sk.id)}>
                        {(sk.gold_cost || 0).toLocaleString()}G 학습
                      </Button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    )}
    {/* 용병 장비 관리 팝업 */}
    {showMercEquipment && selectedMerc && (
      <div className="summon-equip-overlay" onClick={() => setShowMercEquipment(false)}>
        <div className="summon-equip-modal" onClick={(e) => e.stopPropagation()}>
          <div className="summon-equip-modal-header">
            <span className="summon-equip-modal-title">{selectedMerc.name} - 장비 관리</span>
            <button className="summon-equip-modal-close" onClick={() => setShowMercEquipment(false)}>&times;</button>
          </div>
          <div className="summon-equip-modal-body">
            <MercenaryEquipment
              mercenary={selectedMerc}
              onLog={onLog}
              onMercUpdate={() => { if (onMercenariesChanged) onMercenariesChanged(); }}
            />
          </div>
        </div>
      </div>
    )}
    {(
    <div className="char-home">
      <Nav variant="tabs" className="mb-3 char-tab-nav">
        <Nav.Item>
          <Nav.Link active={tab === 'character'} onClick={() => setTab('character')} className="char-tab-link">
            <img src="/ui/tab_character_icon.png" alt="" className="char-tab-icon" onError={(e) => { e.target.style.display='none'; }} />
            캐릭터
          </Nav.Link>
        </Nav.Item>
        <Nav.Item>
          <Nav.Link active={tab === 'equipment'} onClick={() => setTab('equipment')} className="char-tab-link">
            <img src="/ui/tab_equipment_icon.png" alt="" className="char-tab-icon" onError={(e) => { e.target.style.display='none'; }} />
            인벤토리
          </Nav.Link>
        </Nav.Item>
        {prologueCleared !== false && (
        <Nav.Item>
          <Nav.Link active={tab === 'summons'} onClick={() => { setTab('summons'); if (mySummons.length > 0 && !selectedSummon) setSelectedSummon(mySummons[0]); }} className="char-tab-link">
            <img src="/ui/tab_summon_icon.png" alt="" className="char-tab-icon" onError={(e) => { e.target.style.display='none'; }} />
            소환수 <Badge bg="secondary" className="ms-1">{mySummons.length}</Badge>
          </Nav.Link>
        </Nav.Item>
        )}
        {prologueCleared !== false && (
        <Nav.Item>
          <Nav.Link active={tab === 'mercenary'} onClick={() => setTab('mercenary')} className="char-tab-link">
            <img src="/ui/tab_mercenary_icon.png" alt="" className="char-tab-icon" onError={(e) => { e.target.style.display='none'; }} />
            용병 <Badge bg="secondary" className="ms-1">{(myMercenaries || []).length}</Badge>
          </Nav.Link>
        </Nav.Item>
        )}
        <Nav.Item>
          <Nav.Link active={tab === 'formation'} onClick={() => setTab('formation')} className="char-tab-link">
            <img src="/ui/tab_formation_icon.png" alt="" className="char-tab-icon" onError={(e) => { e.target.style.display='none'; }} />
            진영
          </Nav.Link>
        </Nav.Item>
      </Nav>

      {/* ====== 캐릭터 탭 ====== */}
      {tab === 'character' && (
        <>
        {/* 홈 배너 */}
        <div className="home-banner-v2">
          <img src="/ui/home_banner.png" alt="" className="home-banner-v2-img" onError={(e) => { e.target.style.display = 'none'; }} />
          <div className="home-banner-v2-overlay" />
          <div className="home-banner-v2-content">
            <div className="home-banner-v2-title">환영합니다, {character.name}님</div>
            <div className="home-banner-v2-sub">모험을 떠날 준비가 되었습니다</div>
          </div>
        </div>
        <ContentGuide onNavigateVillage={onNavigateVillage} />
        <Row>
          {/* 왼쪽: 캐릭터 프로필 */}
          <Col lg={5} className="mb-3">
            <Card className="char-profile-card">
              <Card.Body>
                <div className="text-center mb-3">
                  <div className="char-home-avatar">
                    <div className={`cb-portrait-effect cb-effect-${getAuraEffect('player', character.element)}`} style={{ position: 'absolute', inset: 0, zIndex: 3, borderRadius: 'inherit', pointerEvents: 'none' }} />
                    <img
                      src={CLASS_IMAGES[character.class_type]}
                      alt={character.class_type}
                      onError={(e) => { e.target.style.display='none'; }}
                    />
                  </div>
                </div>
                <h4 className="game-title mb-1 text-center" style={{ fontSize: '1.3rem' }}>{character.name}</h4>
                <div className="text-center" style={{ color: 'var(--text-muted)', fontSize: 14, marginBottom: 12, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
                  {character.class_type} · Lv.{charState.level}
                  {CLASS_RANGE_TYPE[character.class_type] && (
                    <span style={{ color: CLASS_RANGE_TYPE[character.class_type].color, fontWeight: 600 }}>
                      {CLASS_RANGE_TYPE[character.class_type].icon} {CLASS_RANGE_TYPE[character.class_type].type}
                    </span>
                  )}
                  {character.element && ELEMENT_INFO[character.element] && (
                    <span style={{ color: ELEMENT_INFO[character.element].color, fontWeight: 600 }}>
                      {ELEMENT_INFO[character.element].icon} {ELEMENT_INFO[character.element].name}
                    </span>
                  )}
                </div>

                {/* 스탯 뱃지 */}
                <div className="d-flex gap-2 flex-wrap justify-content-center mb-3">
                  <Badge bg="dark" className="char-stat-badge" style={{ color: 'var(--orange)', background: 'rgba(245, 158, 11, 0.1)' }}>
                    물공 {charState.physAttack}
                  </Badge>
                  <Badge bg="dark" className="char-stat-badge" style={{ color: '#a78bfa', background: 'rgba(167, 139, 250, 0.1)' }}>
                    마공 {charState.magAttack}
                  </Badge>
                  <Badge bg="dark" className="char-stat-badge" style={{ color: 'var(--cyan)', background: 'rgba(6, 182, 212, 0.1)' }}>
                    물방 {charState.physDefense}
                  </Badge>
                  <Badge bg="dark" className="char-stat-badge" style={{ color: '#60a5fa', background: 'rgba(96, 165, 250, 0.1)' }}>
                    마방 {charState.magDefense}
                  </Badge>
                  <Badge bg="dark" className="char-stat-badge" style={{ color: 'var(--red)', background: 'rgba(239, 68, 68, 0.1)' }}>
                    치명 {charState.critRate}%
                  </Badge>
                  <Badge bg="dark" className="char-stat-badge" style={{ color: 'var(--green)', background: 'rgba(34, 197, 94, 0.1)' }}>
                    회피 {charState.evasion}%
                  </Badge>
                  <Badge bg="dark" className="char-stat-badge" style={{ color: '#94a3b8', background: 'rgba(148, 163, 184, 0.1)' }}>
                    이동력 4
                  </Badge>
                </div>

                {/* HP/MP/EXP 바 */}
                <div className="d-flex flex-column gap-2">
                  <div>
                    <div className="d-flex justify-content-between align-items-center" style={{ fontSize: 11, color: 'var(--text-dim)' }}>
                      <span className="char-bar-label"><img src="/ui/hp_icon.png" alt="" className="char-bar-icon" />HP</span>
                      <span>{charState.currentHp}/{charState.maxHp}</span>
                    </div>
                    <ProgressBar now={Math.min(100, (charState.currentHp / charState.maxHp) * 100)} variant="success" style={{ height: 8 }} />
                  </div>
                  <div>
                    <div className="d-flex justify-content-between align-items-center" style={{ fontSize: 11, color: 'var(--text-dim)' }}>
                      <span className="char-bar-label"><img src="/ui/mp_icon.png" alt="" className="char-bar-icon" />MP</span>
                      <span>{charState.currentMp}/{charState.maxMp}</span>
                    </div>
                    <ProgressBar now={Math.min(100, (charState.currentMp / charState.maxMp) * 100)} variant="primary" style={{ height: 8 }} />
                  </div>
                  <div>
                    <div className="d-flex justify-content-between align-items-center" style={{ fontSize: 11, color: 'var(--text-dim)' }}>
                      <span className="char-bar-label"><img src="/ui/exp_icon.png" alt="" className="char-bar-icon" />EXP</span>
                      <span>{charState.exp}/{Math.floor(120 * charState.level + 3 * charState.level * charState.level)}</span>
                    </div>
                    <ProgressBar now={Math.min(100, (charState.exp / Math.floor(120 * charState.level + 3 * charState.level * charState.level)) * 100)} variant="warning" style={{ height: 8 }} />
                  </div>
                </div>

              </Card.Body>
            </Card>
          </Col>

          {/* 오른쪽: 스킬 패널 */}
          <Col lg={7} className="mb-3">
            <Card className="char-skill-card">
              <Card.Body className="d-flex flex-column">
                <div className="skill-sub-tabs">
                  <button className={`skill-sub-tab ${skillSubTab === 'tree' ? 'active' : ''}`} onClick={() => setSkillSubTab('tree')}>
                    🌳 스킬 트리
                  </button>
                  <button className={`skill-sub-tab ${skillSubTab === 'manage' ? 'active' : ''}`} onClick={() => setSkillSubTab('manage')}>
                    ⚙️ 스킬 관리
                  </button>
                </div>
                {skillSubTab === 'tree' && (
                  <SkillTreePanel
                    charState={charState}
                    onLog={onLog}
                    onSkillsUpdate={(skills) => { onSkillsUpdate(skills); loadManagedSkills(); }}
                  />
                )}
                {skillSubTab === 'manage' && (
                  <SkillManagePanel skills={managedSkills} onPriorityChange={updateSkillPriority} />
                )}
              </Card.Body>
            </Card>
          </Col>
        </Row>

        {/* 코스메틱 초상화 효과 */}
        <CosmeticSection character={character} mercenaries={myMercenaries || []} onLog={onLog} />
        </>
      )}

      {/* ====== 장비 탭 ====== */}
      {tab === 'equipment' && (
        <>
        <div className="home-banner-v2">
          <img src="/ui/tab_equipment_banner.png" alt="" className="home-banner-v2-img" onError={(e) => { e.target.style.display = 'none'; }} />
          <div className="home-banner-v2-overlay" />
          <div className="home-banner-v2-content">
            <div className="home-banner-v2-title">장비 관리</div>
            <div className="home-banner-v2-sub">장비를 드래그하여 장착할 수 있습니다</div>
          </div>
        </div>
        <Equipment
          character={character}
          charState={charState}
          onCharStateUpdate={onCharStateUpdate}
          onLog={onLog}
        />
        </>
      )}

      {/* ====== 용병 탭 ====== */}
      {tab === 'mercenary' && (
        <>
        <div className="home-banner-v2">
          <img src="/village/innkeeper_banner.png" alt="" className="home-banner-v2-img" onError={(e) => { e.target.style.display = 'none'; }} />
          <div className="home-banner-v2-overlay" />
          <div className="home-banner-v2-content">
            <div className="home-banner-v2-title">용병단</div>
            <div className="home-banner-v2-sub">고용한 용병을 확인하고 관리하세요</div>
          </div>
        </div>
        <Row>
          {/* 왼쪽: 선택된 용병 프로필 */}
          <Col lg={5} className="mb-3">
            <Card className="char-profile-card">
              <Card.Body>
                {selectedMerc ? (() => {
                  const el = ELEMENT_INFO[selectedMerc.element] || { icon: '⚪', name: '중립', color: '#9ca3af' };
                  const ri = RANGE_TYPE_INFO[selectedMerc.range_type] || RANGE_TYPE_INFO.melee;
                  const expNeeded = Math.floor(60 * selectedMerc.level + 1.5 * selectedMerc.level * selectedMerc.level);
                  return (
                    <>
                      <div className="text-center mb-3">
                        <div className="char-home-avatar">
                          <div className={`cb-portrait-effect cb-effect-${getAuraEffect(`merc_${selectedMerc.id}`, selectedMerc.element)}`} style={{ position: 'absolute', inset: 0, zIndex: 3, borderRadius: 'inherit', pointerEvents: 'none' }} />
                          <SummonImg
                            src={`/mercenaries/${selectedMerc.template_id}_full.png`}
                            fallback="🗡️"
                            className="summon-profile-img"
                          />
                        </div>
                      </div>
                      <h4 className="game-title mb-1 text-center" style={{ fontSize: '1.3rem' }}>{selectedMerc.name}</h4>
                      <div className="text-center" style={{ color: 'var(--text-muted)', fontSize: 14, marginBottom: 12, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
                        {selectedMerc.class_type} · Lv.{selectedMerc.level}
                        <span style={{ color: ri.color, fontWeight: 600 }}>
                          {ri.icon} {ri.type}
                        </span>
                        <span style={{ color: el.color, fontWeight: 600 }}>
                          {el.icon} {el.name}
                        </span>
                      </div>

                      <div className="d-flex gap-2 flex-wrap justify-content-center mb-3">
                        <Badge bg="dark" className="char-stat-badge" style={{ color: 'var(--orange)', background: 'rgba(245, 158, 11, 0.1)' }}>
                          물공 {selectedMerc.phys_attack || 0}
                        </Badge>
                        <Badge bg="dark" className="char-stat-badge" style={{ color: '#a78bfa', background: 'rgba(167, 139, 250, 0.1)' }}>
                          마공 {selectedMerc.mag_attack || 0}
                        </Badge>
                        <Badge bg="dark" className="char-stat-badge" style={{ color: 'var(--cyan)', background: 'rgba(6, 182, 212, 0.1)' }}>
                          물방 {selectedMerc.phys_defense || 0}
                        </Badge>
                        <Badge bg="dark" className="char-stat-badge" style={{ color: '#60a5fa', background: 'rgba(96, 165, 250, 0.1)' }}>
                          마방 {selectedMerc.mag_defense || 0}
                        </Badge>
                        <Badge bg="dark" className="char-stat-badge" style={{ color: 'var(--red)', background: 'rgba(239, 68, 68, 0.1)' }}>
                          치명 {selectedMerc.crit_rate || 0}%
                        </Badge>
                        <Badge bg="dark" className="char-stat-badge" style={{ color: 'var(--green)', background: 'rgba(34, 197, 94, 0.1)' }}>
                          회피 {selectedMerc.evasion || 0}%
                        </Badge>
                      </div>

                      <div className="d-flex flex-column gap-2">
                        <div>
                          <div className="d-flex justify-content-between" style={{ fontSize: 11, color: 'var(--text-dim)' }}>
                            <span className="char-bar-label">HP</span><span>{selectedMerc.hp}</span>
                          </div>
                          <ProgressBar now={100} variant="success" style={{ height: 8 }} />
                        </div>
                        <div>
                          <div className="d-flex justify-content-between" style={{ fontSize: 11, color: 'var(--text-dim)' }}>
                            <span className="char-bar-label">MP</span><span>{selectedMerc.mp}</span>
                          </div>
                          <ProgressBar now={100} variant="primary" style={{ height: 8 }} />
                        </div>
                        <div>
                          <div className="d-flex justify-content-between" style={{ fontSize: 11, color: 'var(--text-dim)' }}>
                            <span className="char-bar-label">EXP</span><span>{selectedMerc.exp}/{expNeeded}</span>
                          </div>
                          <ProgressBar now={Math.min(100, (selectedMerc.exp / expNeeded) * 100)} variant="warning" style={{ height: 8 }} />
                        </div>
                      </div>

                      {/* 스킬 */}
                      {selectedMerc.learned_skills && selectedMerc.learned_skills.length > 0 && (
                        <div className="mt-3">
                          <div style={{ fontSize: 11, color: 'var(--text-dim)', marginBottom: 6 }}>스킬</div>
                          <div className="d-flex gap-1 flex-wrap">
                            {selectedMerc.learned_skills.map((sk) => (
                              <Badge key={sk.id} bg="dark" title={sk.description}
                                style={{ background: 'rgba(59, 130, 246, 0.08)', color: 'var(--blue)', fontSize: 11 }}>
                                {SKILL_TYPE_ICONS[sk.type]} {sk.name}
                              </Badge>
                            ))}
                          </div>
                        </div>
                      )}

                      <div className="text-center mt-3 d-flex gap-2 justify-content-center">
                        <Button size="sm" variant="primary" onClick={() => setShowMercEquipment(true)}>
                          장비 관리
                        </Button>
                        <Button size="sm" variant="outline-info" onClick={() => loadMercSkills(selectedMerc.id)}>
                          스킬 관리
                        </Button>
                      </div>
                    </>
                  );
                })() : (
                  <div className="text-center py-5" style={{ color: 'var(--text-dark)' }}>
                    용병을 선택하세요
                  </div>
                )}
              </Card.Body>
            </Card>
          </Col>

          {/* 오른쪽: 용병 목록 */}
          <Col lg={7} className="mb-3">
            <Card className="char-skill-card">
              <Card.Body className="d-flex flex-column">
                <div style={{ fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: 2, fontWeight: 600, marginBottom: 10 }}>
                  용병 목록
                </div>
                {(!myMercenaries || myMercenaries.length === 0) ? (
                  <div className="text-center py-5" style={{ color: 'var(--text-dark)' }}>
                    보유한 용병이 없습니다. 마을의 여관에서 용병을 고용하세요.
                  </div>
                ) : (
                  <div className="d-flex flex-column gap-2" style={{ flex: 1, overflowY: 'auto' }}>
                    {myMercenaries.map((m) => (
                      <div
                        key={m.id}
                        className={`summon-list-item ${selectedMerc?.id === m.id ? 'active' : ''}`}
                        onClick={() => setSelectedMerc(m)}
                      >
                        <div className="summon-list-icon-wrap" style={{ position: 'relative' }}>
                          <div className={`cb-portrait-effect cb-effect-${getAuraEffect(`merc_${m.id}`, m.element)}`} style={{ position: 'absolute', inset: 0, borderRadius: 'inherit', zIndex: 0, opacity: 0.7 }} />
                          <SummonImg
                            src={`/mercenaries/${m.template_id}_icon.png`}
                            fallback="🗡️"
                            className="summon-list-icon-img"
                          />
                        </div>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 2 }}>
                            <span style={{ fontWeight: 600, color: 'var(--text-bright)', fontSize: 13, whiteSpace: 'nowrap' }}>{m.name}</span>
                            <span style={{ fontSize: 11, color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>
                              {m.class_type} · Lv.{m.level}
                              {m.element && ELEMENT_INFO[m.element] && (
                                <span style={{ color: ELEMENT_INFO[m.element].color, marginLeft: 3 }}>{ELEMENT_INFO[m.element].icon}</span>
                              )}
                            </span>
                          </div>
                          <div className="d-flex gap-1 flex-wrap" style={{ fontSize: 10 }}>
                            <span className="eff hp">HP {m.hp}</span>
                            <span className="eff mp">MP {m.mp}</span>
                            <span className="eff" style={{ color: 'var(--orange)' }}>물공 {m.phys_attack || 0}</span>
                            <span className="eff" style={{ color: '#a78bfa' }}>마공 {m.mag_attack || 0}</span>
                            <span className="eff" style={{ color: 'var(--cyan)' }}>물방 {m.phys_defense || 0}</span>
                            <span className="eff" style={{ color: '#60a5fa' }}>마방 {m.mag_defense || 0}</span>
                            <span className="eff" style={{ color: 'var(--red)' }}>치명 {m.crit_rate || 0}%</span>
                            <span className="eff" style={{ color: 'var(--green)' }}>회피 {m.evasion || 0}%</span>
                          </div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 3 }}>
                            <span style={{ fontSize: 10, color: m.fatigue <= 0 ? '#ef4444' : m.fatigue <= 2 ? '#f59e0b' : '#888' }}>
                              피로도 {m.fatigue ?? m.max_fatigue ?? 7}/{m.max_fatigue ?? 7}
                            </span>
                            {m.fatigue <= 0 && <span style={{ fontSize: 9, color: '#ef4444', background: 'rgba(239,68,68,0.15)', padding: '0 4px', borderRadius: 3, fontWeight: 700 }}>지침</span>}
                            <div style={{ flex: 1, height: 4, background: 'rgba(255,255,255,0.08)', borderRadius: 2, overflow: 'hidden', maxWidth: 80 }}>
                              <div style={{ height: '100%', borderRadius: 2, width: `${((m.fatigue ?? m.max_fatigue ?? 7) / (m.max_fatigue ?? 7)) * 100}%`, background: m.fatigue <= 0 ? '#ef4444' : m.fatigue <= 2 ? '#f59e0b' : '#4ade80', transition: 'width 0.3s' }} />
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </Card.Body>
            </Card>
          </Col>
        </Row>
        </>
      )}

      {/* ====== 소환수 탭 ====== */}
      {/* ====== 진영 탭 ====== */}
      {tab === 'formation' && (
        <>
        <div className="home-banner-v2">
          <img src="/ui/tab_formation_banner.png" alt="" className="home-banner-v2-img" onError={(e) => { e.target.style.display = 'none'; }} />
          <div className="home-banner-v2-overlay" />
          <div className="home-banner-v2-content">
            <div className="home-banner-v2-title">진영 편성</div>
            <div className="home-banner-v2-sub">전투 진영을 구성하여 전략적 우위를 확보하세요</div>
          </div>
        </div>
        <FormationArea
          character={character}
          charState={charState}
          mySummons={mySummons}
          myMercenaries={myMercenaries}
        />
        </>
      )}

      {tab === 'summons' && (
        <>
        <div className="home-banner-v2">
          <img src="/ui/tab_summon_banner.png" alt="" className="home-banner-v2-img" onError={(e) => { e.target.style.display = 'none'; }} />
          <div className="home-banner-v2-overlay" />
          <div className="home-banner-v2-content">
            <div className="home-banner-v2-title">소환수</div>
            <div className="home-banner-v2-sub">소환수를 관리하고 장비를 장착하세요</div>
          </div>
        </div>
        <Row>
          {/* 왼쪽: 선택된 소환수 프로필 */}
          <Col lg={5} className="mb-3">
            <Card className="char-profile-card">
              <Card.Body>
                {selectedSummon ? (
                  <>
                    <div className="text-center mb-3">
                      <div className="char-home-avatar">
                        <div className={`cb-portrait-effect cb-effect-${getAuraEffect(`summon_${selectedSummon.id}`, selectedSummon.element)}`} style={{ position: 'absolute', inset: 0, zIndex: 3, borderRadius: 'inherit', pointerEvents: 'none' }} />
                        <SummonImg
                          src={`/summons_nobg/${selectedSummon.template_id}_full.png`}
                          fallback={selectedSummon.icon}
                          className="summon-profile-img"
                        />
                      </div>
                    </div>
                    <h4 className="game-title mb-1 text-center" style={{ fontSize: '1.3rem' }}>{selectedSummon.name}</h4>
                    <div className="text-center" style={{ color: 'var(--text-muted)', fontSize: 14, marginBottom: 12, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
                      {selectedSummon.type} · Lv.{selectedSummon.level}
                      {selectedSummon.range_type && RANGE_TYPE_INFO[selectedSummon.range_type] && (
                        <span style={{ color: RANGE_TYPE_INFO[selectedSummon.range_type].color, fontWeight: 600 }}>
                          {RANGE_TYPE_INFO[selectedSummon.range_type].icon} {RANGE_TYPE_INFO[selectedSummon.range_type].type}
                        </span>
                      )}
                      {selectedSummon.element && ELEMENT_INFO[selectedSummon.element] && (
                        <span style={{ color: ELEMENT_INFO[selectedSummon.element].color, fontWeight: 600 }}>
                          {ELEMENT_INFO[selectedSummon.element].icon} {ELEMENT_INFO[selectedSummon.element].name}
                        </span>
                      )}
                    </div>

                    <div className="d-flex gap-2 flex-wrap justify-content-center mb-3">
                      <Badge bg="dark" className="char-stat-badge" style={{ color: 'var(--orange)', background: 'rgba(245, 158, 11, 0.1)' }}>
                        물공 {selectedSummon.phys_attack || 0}
                      </Badge>
                      <Badge bg="dark" className="char-stat-badge" style={{ color: '#a78bfa', background: 'rgba(167, 139, 250, 0.1)' }}>
                        마공 {selectedSummon.mag_attack || 0}
                      </Badge>
                      <Badge bg="dark" className="char-stat-badge" style={{ color: 'var(--cyan)', background: 'rgba(6, 182, 212, 0.1)' }}>
                        물방 {selectedSummon.phys_defense || 0}
                      </Badge>
                      <Badge bg="dark" className="char-stat-badge" style={{ color: '#60a5fa', background: 'rgba(96, 165, 250, 0.1)' }}>
                        마방 {selectedSummon.mag_defense || 0}
                      </Badge>
                      <Badge bg="dark" className="char-stat-badge" style={{ color: 'var(--red)', background: 'rgba(239, 68, 68, 0.1)' }}>
                        치명 {selectedSummon.crit_rate || 0}%
                      </Badge>
                      <Badge bg="dark" className="char-stat-badge" style={{ color: 'var(--green)', background: 'rgba(34, 197, 94, 0.1)' }}>
                        회피 {selectedSummon.evasion || 0}%
                      </Badge>
                      <Badge bg="dark" className="char-stat-badge" style={{ color: '#94a3b8', background: 'rgba(148, 163, 184, 0.1)' }}>
                        이동력 3
                      </Badge>
                    </div>

                    <div className="d-flex flex-column gap-2">
                      <div>
                        <div className="d-flex justify-content-between" style={{ fontSize: 11, color: 'var(--text-dim)' }}>
                          <span className="char-bar-label">HP</span><span>{selectedSummon.hp}</span>
                        </div>
                        <ProgressBar now={100} variant="success" style={{ height: 8 }} />
                      </div>
                      <div>
                        <div className="d-flex justify-content-between" style={{ fontSize: 11, color: 'var(--text-dim)' }}>
                          <span className="char-bar-label">MP</span><span>{selectedSummon.mp}</span>
                        </div>
                        <ProgressBar now={100} variant="primary" style={{ height: 8 }} />
                      </div>
                      <div>
                        <div className="d-flex justify-content-between" style={{ fontSize: 11, color: 'var(--text-dim)' }}>
                          <span className="char-bar-label">EXP</span><span>{selectedSummon.exp}/{Math.floor(60 * selectedSummon.level + 1.5 * selectedSummon.level * selectedSummon.level)}</span>
                        </div>
                        <ProgressBar now={(selectedSummon.exp / Math.floor(60 * selectedSummon.level + 1.5 * selectedSummon.level * selectedSummon.level)) * 100} variant="warning" style={{ height: 8 }} />
                      </div>
                    </div>

                    {/* 스킬 */}
                    {selectedSummon.learned_skills && selectedSummon.learned_skills.length > 0 && (
                      <div className="mt-3">
                        <div style={{ fontSize: 11, color: 'var(--text-dim)', marginBottom: 6 }}>스킬</div>
                        <div className="d-flex gap-1 flex-wrap">
                          {selectedSummon.learned_skills.map((sk) => (
                            <Badge key={sk.id} bg="dark" title={sk.description}
                              style={{ background: 'rgba(59, 130, 246, 0.08)', color: 'var(--blue)', fontSize: 11 }}>
                              {SKILL_TYPE_ICONS[sk.type]} {sk.name}
                            </Badge>
                          ))}
                        </div>
                      </div>
                    )}

                    <div className="text-center mt-3 d-flex gap-2 justify-content-center">
                      <Button size="sm" variant="primary" onClick={() => setShowEquipment(true)}>
                        장비 관리
                      </Button>
                      <Button size="sm" variant="outline-info" onClick={() => loadSummonSkills(selectedSummon.id)}>
                        스킬 관리
                      </Button>
                    </div>
                  </>
                ) : (
                  <div className="text-center py-5" style={{ color: 'var(--text-dark)' }}>
                    소환수를 선택하세요
                  </div>
                )}
              </Card.Body>
            </Card>
          </Col>

          {/* 오른쪽: 소환수 목록 */}
          <Col lg={7} className="mb-3">
            <Card className="char-skill-card">
              <Card.Body className="d-flex flex-column">
                <div style={{ fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: 2, fontWeight: 600, marginBottom: 10 }}>
                  소환수 목록
                </div>
                {mySummons.length === 0 ? (
                  <div className="text-center py-5" style={{ color: 'var(--text-dark)' }}>
                    보유한 소환수가 없습니다. 마을의 소환수 상점에서 고용하세요.
                  </div>
                ) : (
                  <div className="d-flex flex-column gap-2" style={{ flex: 1, overflowY: 'auto' }}>
                    {mySummons.map((s) => (
                      <div
                        key={s.id}
                        className={`summon-list-item ${selectedSummon?.id === s.id ? 'active' : ''}`}
                        onClick={() => setSelectedSummon(s)}
                      >
                        <div className="summon-list-icon-wrap">
                          <div className={`cb-portrait-effect cb-effect-${getAuraEffect(`summon_${s.id}`, s.element)}`} style={{ position: 'absolute', inset: 0, borderRadius: 'inherit', zIndex: 0, opacity: 0.7 }} />
                          <SummonImg
                            src={`/summons_nobg/${s.template_id}_icon.png`}
                            fallback={s.icon}
                            className="summon-list-icon-img"
                          />
                        </div>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 2 }}>
                            <span style={{ fontWeight: 600, color: 'var(--text-bright)', fontSize: 13, whiteSpace: 'nowrap' }}>{s.name}</span>
                            <span style={{ fontSize: 11, color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>
                              {s.type} · Lv.{s.level}
                              {s.element && ELEMENT_INFO[s.element] && (
                                <span style={{ color: ELEMENT_INFO[s.element].color, marginLeft: 3 }}>{ELEMENT_INFO[s.element].icon}</span>
                              )}
                            </span>
                          </div>
                          <div className="d-flex gap-1 flex-wrap" style={{ fontSize: 10 }}>
                            <span className="eff hp">HP {s.hp}</span>
                            <span className="eff mp">MP {s.mp}</span>
                            <span className="eff" style={{ color: 'var(--orange)' }}>물공 {s.phys_attack || 0}</span>
                            <span className="eff" style={{ color: '#a78bfa' }}>마공 {s.mag_attack || 0}</span>
                            <span className="eff" style={{ color: 'var(--cyan)' }}>물방 {s.phys_defense || 0}</span>
                            <span className="eff" style={{ color: '#60a5fa' }}>마방 {s.mag_defense || 0}</span>
                            <span className="eff" style={{ color: 'var(--red)' }}>치명 {s.crit_rate || 0}%</span>
                            <span className="eff" style={{ color: 'var(--green)' }}>회피 {s.evasion || 0}%</span>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </Card.Body>
            </Card>
          </Col>
        </Row>
        </>
      )}
    </div>
    )}
    </>
  );
}

export default CharacterHome;
