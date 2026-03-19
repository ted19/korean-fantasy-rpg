import React, { useState } from 'react';
import { Modal, Nav, Badge, Button } from 'react-bootstrap';
import api from '../api';
import Equipment from './Equipment';
import SkillPanel from './SkillPanel';

const CLASS_IMAGES = {
  '풍수사': '/characters/pungsu_full.png',
  '무당': '/characters/mudang_full.png',
  '승려': '/characters/monk_full.png',
  '저승사자': '/characters/reaper_full.png',
  '북채비': '/characters/bukchaebi_full.png',
  '강신무': '/characters/gangsinmu_full.png',
};

const ELEMENT_INFO = {
  fire:    { name: '불', icon: '🔥', color: '#ff6b35' },
  water:   { name: '물', icon: '💧', color: '#4da6ff' },
  earth:   { name: '땅', icon: '🪨', color: '#8bc34a' },
  wind:    { name: '바람', icon: '🌀', color: '#b388ff' },
  neutral: { name: '중립', icon: '⚪', color: '#9ca3af' },
};

function CharacterDetail({ character, charState, onCharStateUpdate, onLog, onSkillsUpdate, onClose, onCharacterDeleted }) {
  const [activeTab, setActiveTab] = useState('equipment');
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const handleDelete = async () => {
    setDeleting(true);
    try {
      await api.delete('/characters/me');
      onCharacterDeleted();
    } catch (err) {
      onLog(err.response?.data?.message || '캐릭터 삭제 실패', 'damage');
      setDeleting(false);
      setShowDeleteConfirm(false);
    }
  };

  const expNeeded = Math.floor(120 * charState.level + 3 * charState.level * charState.level);

  return (
    <Modal show onHide={onClose} centered size="lg" scrollable>
      <Modal.Header closeButton closeVariant="white" style={{
        background: 'linear-gradient(135deg, rgba(139, 92, 246, 0.08), rgba(212, 168, 67, 0.06))',
        borderBottom: '1px solid var(--border-dark)'
      }}>
        <div className="d-flex align-items-center gap-3">
          <div className="char-detail-avatar">
            <img
              src={CLASS_IMAGES[character.class_type]}
              alt={character.class_type}
              onError={(e) => { e.target.style.display='none'; }}
            />
          </div>
          <div>
            <h5 className="game-title mb-1" style={{ fontSize: '1.2rem' }}>{character.name}</h5>
            <div style={{ color: 'var(--text-muted)', fontSize: 14, display: 'flex', alignItems: 'center', gap: 6 }}>
              {character.class_type} · Lv.{charState.level}
              {character.element && ELEMENT_INFO[character.element] && (
                <span style={{ color: ELEMENT_INFO[character.element].color, fontWeight: 600 }}>
                  {ELEMENT_INFO[character.element].icon} {ELEMENT_INFO[character.element].name}
                </span>
              )}
            </div>
            <div className="d-flex gap-1 flex-wrap mt-1">
              <Badge bg="dark" style={{ color: 'var(--green)', background: 'rgba(34, 197, 94, 0.1)' }}>HP {charState.currentHp}/{charState.maxHp}</Badge>
              <Badge bg="dark" style={{ color: 'var(--blue)', background: 'rgba(59, 130, 246, 0.1)' }}>MP {charState.currentMp}/{charState.maxMp}</Badge>
              <Badge bg="dark" style={{ color: 'var(--orange)', background: 'rgba(245, 158, 11, 0.1)' }}>ATK {charState.attack}</Badge>
              <Badge bg="dark" style={{ color: 'var(--cyan)', background: 'rgba(6, 182, 212, 0.1)' }}>DEF {charState.defense}</Badge>
            </div>
            <div className="d-flex gap-1 flex-wrap mt-1">
              <Badge bg="dark" style={{ color: 'var(--accent)', background: 'rgba(139, 92, 246, 0.1)' }}>EXP {charState.exp}/{expNeeded}</Badge>
              <Badge bg="dark" style={{ color: 'var(--gold-bright)', background: 'rgba(212, 168, 67, 0.1)' }}>Gold {charState.gold}G</Badge>
            </div>
          </div>
        </div>
      </Modal.Header>

      <Nav variant="tabs" className="px-3 pt-2" style={{ background: 'var(--bg-dark)' }}>
        <Nav.Item>
          <Nav.Link active={activeTab === 'equipment'} onClick={() => setActiveTab('equipment')}>
            🛡️ 장비 · 인벤토리
          </Nav.Link>
        </Nav.Item>
        <Nav.Item>
          <Nav.Link active={activeTab === 'skills'} onClick={() => setActiveTab('skills')}>
            ⚡ 스킬
          </Nav.Link>
        </Nav.Item>
      </Nav>

      <Modal.Body style={{ maxHeight: '50vh', overflowY: 'auto' }}>
        {activeTab === 'equipment' && (
          <Equipment
            character={character}
            charState={charState}
            onCharStateUpdate={onCharStateUpdate}
            onLog={onLog}
          />
        )}
        {activeTab === 'skills' && (
          <SkillPanel
            charState={charState}
            onLog={onLog}
            onSkillsUpdate={onSkillsUpdate}
          />
        )}
      </Modal.Body>

      <Modal.Footer className="justify-content-center" style={{ borderTop: '1px solid var(--border-dark)' }}>
        {!showDeleteConfirm ? (
          <Button variant="outline-danger" size="sm" onClick={() => setShowDeleteConfirm(true)}>
            캐릭터 삭제
          </Button>
        ) : (
          <div className="d-flex align-items-center gap-2 flex-wrap justify-content-center">
            <span style={{ color: 'var(--red)', fontSize: 13, fontWeight: 600 }}>정말 삭제하시겠습니까? 모든 데이터가 사라집니다!</span>
            <Button variant="danger" size="sm" onClick={handleDelete} disabled={deleting}>
              {deleting ? '삭제 중...' : '삭제 확인'}
            </Button>
            <Button variant="secondary" size="sm" onClick={() => setShowDeleteConfirm(false)}>
              취소
            </Button>
          </div>
        )}
      </Modal.Footer>
    </Modal>
  );
}

export default CharacterDetail;
