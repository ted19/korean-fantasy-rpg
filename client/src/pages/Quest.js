import React, { useState, useEffect } from 'react';
import { Nav, Badge, Button, ProgressBar } from 'react-bootstrap';
import api from '../api';

const TYPE_LABELS = { hunt: '사냥', hunt_location: '지역 사냥', level: '성장' };
const TYPE_ICONS = { hunt: '⚔️', hunt_location: '🗺️', level: '⭐' };
const LOC_NAMES = { forest: '어둠의 숲', cave: '지하 동굴', temple: '폐허 사원' };

function Quest({ charState, onCharStateUpdate, onLog }) {
  const [tab, setTab] = useState('available');
  const [available, setAvailable] = useState([]);
  const [myQuests, setMyQuests] = useState([]);

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

  const handleAccept = async (questId) => {
    try {
      const res = await api.post('/quest/accept', { questId });
      onLog(res.data.message, 'system');
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
      loadData();
    } catch (err) {
      onLog(err.response?.data?.message || '보상 수령 실패', 'damage');
    }
  };

  const handleAbandon = async (questId) => {
    try {
      const res = await api.post('/quest/abandon', { questId });
      onLog(res.data.message, 'system');
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
      if (available.length === 0) return <div className="quest-empty">수락 가능한 퀘스트가 없습니다.</div>;
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
            <Badge bg="dark" style={{ color: 'var(--blue)', background: 'rgba(59, 130, 246, 0.1)' }}>{TYPE_LABELS[q.type]}</Badge>
            <span className="quest-target">{formatTarget(q)}</span>
          </div>
          <div className="quest-rewards">
            {q.reward_exp > 0 && <span className="qr exp">EXP +{q.reward_exp}</span>}
            {q.reward_gold > 0 && <span className="qr gold">Gold +{q.reward_gold}</span>}
            {q.reward_item_id && <span className="qr item">아이템 보상</span>}
          </div>
          <div className="quest-bottom">
            {q.required_level > 1 && <span className="quest-req">Lv.{q.required_level}+</span>}
            <Button size="sm" variant="primary" className="ms-auto" onClick={() => handleAccept(q.id)}>수락</Button>
          </div>
        </div>
      ));
    }

    if (tab === 'active') {
      if (activeQuests.length === 0) return <div className="quest-empty">진행중인 퀘스트가 없습니다.</div>;
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
            <Badge bg="dark" style={{ color: 'var(--blue)', background: 'rgba(59, 130, 246, 0.1)' }}>{TYPE_LABELS[q.type]}</Badge>
            <span className="quest-target">{formatTarget(q)}</span>
          </div>
          <div className="d-flex align-items-center gap-2 mb-2">
            <ProgressBar
              now={Math.min(100, (q.progress / q.target_count) * 100)}
              className="flex-grow-1"
              style={{ height: 8 }}
            />
            <span style={{ fontSize: 12, color: 'var(--text-dim)', whiteSpace: 'nowrap' }}>{q.progress} / {q.target_count}</span>
          </div>
          <div className="quest-rewards">
            {q.reward_exp > 0 && <span className="qr exp">EXP +{q.reward_exp}</span>}
            {q.reward_gold > 0 && <span className="qr gold">Gold +{q.reward_gold}</span>}
            {q.reward_item_name && <span className="qr item">{q.reward_item_name} x{q.reward_item_qty}</span>}
          </div>
          <div className="quest-bottom">
            <Button size="sm" variant="outline-secondary" className="ms-auto" onClick={() => handleAbandon(q.quest_id)}>포기</Button>
          </div>
        </div>
      ));
    }

    if (tab === 'completed') {
      if (completedQuests.length === 0) return <div className="quest-empty">완료된 퀘스트가 없습니다.</div>;
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
            <span style={{ fontSize: 12, color: 'var(--text-dim)', whiteSpace: 'nowrap' }}>{q.target_count} / {q.target_count}</span>
          </div>
          <div className="quest-rewards">
            {q.reward_exp > 0 && <span className="qr exp">EXP +{q.reward_exp}</span>}
            {q.reward_gold > 0 && <span className="qr gold">Gold +{q.reward_gold}</span>}
            {q.reward_item_name && <span className="qr item">{q.reward_item_name} x{q.reward_item_qty}</span>}
          </div>
          <div className="quest-bottom">
            <Button size="sm" variant="warning" className="ms-auto btn-quest-reward" onClick={() => handleReward(q.quest_id)}>보상 수령</Button>
          </div>
        </div>
      ));
    }
  };

  return (
    <div className="quest-container">
      <Nav variant="tabs" className="mb-3">
        <Nav.Item>
          <Nav.Link active={tab === 'available'} onClick={() => setTab('available')}>
            의뢰 게시판 <Badge bg="secondary" className="ms-1">{available.length}</Badge>
          </Nav.Link>
        </Nav.Item>
        <Nav.Item>
          <Nav.Link active={tab === 'active'} onClick={() => setTab('active')}>
            진행중 <Badge bg="secondary" className="ms-1">{activeQuests.length}</Badge>
          </Nav.Link>
        </Nav.Item>
        <Nav.Item>
          <Nav.Link active={tab === 'completed'} onClick={() => setTab('completed')}>
            완료 <Badge bg="secondary" className="ms-1">{completedQuests.length}</Badge>
          </Nav.Link>
        </Nav.Item>
      </Nav>

      <div className="quest-list">
        {renderQuests()}
      </div>
    </div>
  );
}

export default Quest;
