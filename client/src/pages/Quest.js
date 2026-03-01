import React, { useState, useEffect } from 'react';
import { Badge, ProgressBar } from 'react-bootstrap';
import api from '../api';

const TYPE_LABELS = { hunt: '사냥', hunt_location: '지역 사냥', level: '성장' };
const TYPE_ICONS = { hunt: '⚔️', hunt_location: '🗺️', level: '⭐' };
const LOC_NAMES = { forest: '어둠의 숲', cave: '지하 동굴', temple: '폐허 사원' };

function NpcImg({ src, className }) {
  const [err, setErr] = useState(false);
  if (err) return null;
  return <img src={src} alt="" className={className} onError={() => setErr(true)} />;
}

function Quest({ charState, onCharStateUpdate, onLog }) {
  const [tab, setTab] = useState('available');
  const [available, setAvailable] = useState([]);
  const [myQuests, setMyQuests] = useState([]);
  const [npcMsg, setNpcMsg] = useState('모험가여, 의뢰가 있다네.');

  const NPC_MSGS = {
    available: [
      '새로운 의뢰가 들어왔다. 확인해보게.',
      '위험한 일이지만, 자네라면 해낼 수 있을 거야.',
      '모험가여, 길드에 자네의 힘이 필요하다네.',
    ],
    active: [
      '진행 중인 의뢰를 잘 완수해주게.',
      '서둘러야 할 의뢰도 있으니 확인해보게.',
      '무리하지 말게. 살아 돌아오는 것이 우선이야.',
    ],
    completed: [
      '잘 해냈군! 보상을 가져가게.',
      '훌륭하다, 모험가! 수고했네.',
      '길드의 자랑이야. 보상을 받으려무나.',
    ],
  };

  const loadData = async () => {
    try {
      const [avRes, myRes] = await Promise.all([
        api.get('/quest/available'),
        api.get('/quest/my'),
      ]);
      setAvailable(avRes.data.quests);
      setMyQuests(myRes.data.quests);
    } catch {
      onLog('퀘스트 정보를 불러올 수 없습니다.', 'damage');
    }
  };

  useEffect(() => { loadData(); }, []);

  useEffect(() => {
    const msgs = NPC_MSGS[tab] || NPC_MSGS.available;
    setNpcMsg(msgs[Math.floor(Math.random() * msgs.length)]);
  }, [tab]);

  const handleAccept = async (questId) => {
    try {
      const res = await api.post('/quest/accept', { questId });
      onLog(res.data.message, 'system');
      setNpcMsg('좋아, 의뢰를 수락했군. 행운을 빌지.');
      loadData();
    } catch (err) {
      onLog(err.response?.data?.message || '수락 실패', 'damage');
    }
  };

  const handleReward = async (questId) => {
    try {
      const res = await api.post('/quest/reward', { questId });
      onLog(res.data.message, 'level');
      const c = res.data.character;
      onCharStateUpdate({
        level: c.level, exp: c.exp, gold: c.gold,
        maxHp: c.hp, maxMp: c.mp,
        attack: c.attack, defense: c.defense,
        currentHp: c.current_hp ?? c.hp,
        currentMp: c.current_mp ?? c.mp,
      });
      setNpcMsg('훌륭하다! 보상을 받아가게.');
      loadData();
    } catch (err) {
      onLog(err.response?.data?.message || '보상 수령 실패', 'damage');
    }
  };

  const handleAbandon = async (questId) => {
    try {
      const res = await api.post('/quest/abandon', { questId });
      onLog(res.data.message, 'system');
      setNpcMsg('흠, 아쉽지만 다음에 다시 도전하게.');
      loadData();
    } catch (err) {
      onLog(err.response?.data?.message || '포기 실패', 'damage');
    }
  };

  const formatTarget = (q) => {
    if (q.type === 'hunt') return `${q.target} ${q.target_count}마리 처치`;
    if (q.type === 'hunt_location') return `${LOC_NAMES[q.target] || q.target}에서 ${q.target_count}마리 처치`;
    if (q.type === 'level') return `레벨 ${q.target} 달성`;
    return q.target;
  };

  const activeQuests = myQuests.filter((q) => q.status === 'active');
  const completedQuests = myQuests.filter((q) => q.status === 'completed');

  const renderQuests = () => {
    if (tab === 'available') {
      if (available.length === 0) return <div className="facility-empty">수락 가능한 퀘스트가 없습니다.</div>;
      return available.map((q) => (
        <div key={q.id} className="quest-card">
          <div className="quest-top">
            <span className="quest-type-icon">{TYPE_ICONS[q.type]}</span>
            <div className="quest-info">
              <div className="quest-title">{q.title}</div>
              <div className="quest-desc">{q.description}</div>
            </div>
          </div>
          <div className="quest-objective">
            <Badge bg="dark" style={{ color: '#60a5fa', background: 'rgba(59, 130, 246, 0.1)' }}>{TYPE_LABELS[q.type]}</Badge>
            <span className="quest-target">{formatTarget(q)}</span>
          </div>
          <div className="quest-rewards">
            {q.reward_exp > 0 && <span className="qr exp">EXP +{q.reward_exp}</span>}
            {q.reward_gold > 0 && <span className="qr gold">Gold +{q.reward_gold}</span>}
            {q.reward_item_id && <span className="qr item">아이템 보상</span>}
          </div>
          <div className="quest-bottom">
            {q.required_level > 1 && <span className="quest-req">Lv.{q.required_level}+</span>}
            <button className="fitem-btn buy" style={{ marginLeft: 'auto' }} onClick={() => handleAccept(q.id)}>수락</button>
          </div>
        </div>
      ));
    }

    if (tab === 'active') {
      if (activeQuests.length === 0) return <div className="facility-empty">진행중인 퀘스트가 없습니다.</div>;
      return activeQuests.map((q) => (
        <div key={q.quest_id} className="quest-card active">
          <div className="quest-top">
            <span className="quest-type-icon">{TYPE_ICONS[q.type]}</span>
            <div className="quest-info">
              <div className="quest-title">{q.title}</div>
              <div className="quest-desc">{q.description}</div>
            </div>
          </div>
          <div className="quest-objective">
            <Badge bg="dark" style={{ color: '#60a5fa', background: 'rgba(59, 130, 246, 0.1)' }}>{TYPE_LABELS[q.type]}</Badge>
            <span className="quest-target">{formatTarget(q)}</span>
          </div>
          <div className="d-flex align-items-center gap-2 mb-2">
            <ProgressBar
              now={Math.min(100, (q.progress / q.target_count) * 100)}
              className="flex-grow-1"
              style={{ height: 8 }}
            />
            <span style={{ fontSize: 12, color: '#888', whiteSpace: 'nowrap' }}>{q.progress} / {q.target_count}</span>
          </div>
          <div className="quest-rewards">
            {q.reward_exp > 0 && <span className="qr exp">EXP +{q.reward_exp}</span>}
            {q.reward_gold > 0 && <span className="qr gold">Gold +{q.reward_gold}</span>}
            {q.reward_item_name && <span className="qr item">{q.reward_item_name} x{q.reward_item_qty}</span>}
          </div>
          <div className="quest-bottom">
            <button className="fitem-btn sell" style={{ marginLeft: 'auto' }} onClick={() => handleAbandon(q.quest_id)}>포기</button>
          </div>
        </div>
      ));
    }

    if (tab === 'completed') {
      if (completedQuests.length === 0) return <div className="facility-empty">완료된 퀘스트가 없습니다.</div>;
      return completedQuests.map((q) => (
        <div key={q.quest_id} className="quest-card completed">
          <div className="quest-top">
            <span className="quest-type-icon">{TYPE_ICONS[q.type]}</span>
            <div className="quest-info">
              <div className="quest-title">{q.title}</div>
              <div className="quest-desc">{q.description}</div>
            </div>
          </div>
          <div className="d-flex align-items-center gap-2 mb-2">
            <ProgressBar now={100} variant="success" className="flex-grow-1" style={{ height: 8 }} />
            <span style={{ fontSize: 12, color: '#888', whiteSpace: 'nowrap' }}>{q.target_count} / {q.target_count}</span>
          </div>
          <div className="quest-rewards">
            {q.reward_exp > 0 && <span className="qr exp">EXP +{q.reward_exp}</span>}
            {q.reward_gold > 0 && <span className="qr gold">Gold +{q.reward_gold}</span>}
            {q.reward_item_name && <span className="qr item">{q.reward_item_name} x{q.reward_item_qty}</span>}
          </div>
          <div className="quest-bottom">
            <button className="fitem-btn reward" style={{ marginLeft: 'auto' }} onClick={() => handleReward(q.quest_id)}>보상 수령</button>
          </div>
        </div>
      ));
    }
  };

  return (
    <div className="facility-page guild-page">
      {/* Banner */}
      <div className="facility-banner guild-banner">
        <NpcImg src="/village/guildmaster_banner.png" className="facility-banner-img" />
        <div className="facility-banner-overlay" />
        <div className="facility-banner-title">모험가 길드</div>
      </div>

      {/* NPC Section */}
      <div className="facility-npc">
        <div className="facility-npc-portrait-wrap">
          <NpcImg src="/village/guildmaster_portrait.png" className="facility-npc-portrait" />
        </div>
        <div className="facility-npc-speech">
          <div className="facility-npc-name">길드마스터 <span className="npc-name-sub">이 서연</span></div>
          <div className="facility-npc-msg">{npcMsg}</div>
        </div>
      </div>

      {/* Tabs */}
      <div className="facility-tabs">
        <button className={`facility-tab ${tab === 'available' ? 'active' : ''}`} onClick={() => setTab('available')}>
          의뢰 게시판 <span className="tab-badge">{available.length}</span>
        </button>
        <button className={`facility-tab ${tab === 'active' ? 'active' : ''}`} onClick={() => setTab('active')}>
          진행중 <span className="tab-badge">{activeQuests.length}</span>
        </button>
        <button className={`facility-tab ${tab === 'completed' ? 'active' : ''}`} onClick={() => setTab('completed')}>
          완료 <span className="tab-badge">{completedQuests.length}</span>
        </button>
      </div>

      {/* Quest List */}
      <div className="quest-list">
        {renderQuests()}
      </div>
    </div>
  );
}

export default Quest;
