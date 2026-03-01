import React, { useState } from 'react';
import { Container, Row, Col, Card, Form, Button, Alert, ProgressBar } from 'react-bootstrap';
import api from '../api';

const ELEMENT_INFO = {
  fire:    { name: '불', icon: '🔥', color: '#ff6b35', desc: '높은 순간 화력과 지속 피해. 물에 약하고 땅/바람에 강하다.' },
  water:   { name: '물', icon: '💧', color: '#4da6ff', desc: '회복 특화와 넓은 범위 공격. 불에 강하고 바람에 약하다.' },
  earth:   { name: '땅', icon: '🪨', color: '#8bc34a', desc: '방어/탱킹 최적화와 지형 변화. 바람에 강하고 불/물에 약하다.' },
  wind:    { name: '바람', icon: '🌀', color: '#b388ff', desc: '속도/회피 기반 다중 타겟 공격. 물에 강하고 땅에 약하다.' },
  neutral: { name: '중립', icon: '⚪', color: '#aaa', desc: '모든 속성에 균등한 대미지. 상극이 없는 안정적인 속성.' },
};

const CLASS_INFO = {
  '풍수사': {
    description: '자연의 기운을 다루는 술사. 강력한 마법 공격과 높은 마력을 지녔다.',
    stats: { hp: 80, mp: 120, phys_attack: 6, mag_attack: 12, phys_defense: 2, mag_defense: 5, crit_rate: 5, evasion: 5 },
    icon: '✨',
    image: '/characters/pungsu_full.png',
  },
  '무당': {
    description: '영혼과 소통하는 주술사. 균형 잡힌 능력치로 다양한 상황에 대응한다.',
    stats: { hp: 90, mp: 100, phys_attack: 6, mag_attack: 8, phys_defense: 3, mag_defense: 4, crit_rate: 8, evasion: 8 },
    icon: '🌙',
    image: '/characters/mudang_full.png',
  },
  '승려': {
    description: '수행을 통해 깨달음을 얻은 전사. 높은 체력과 방어력으로 전선을 지킨다.',
    stats: { hp: 120, mp: 60, phys_attack: 7, mag_attack: 2, phys_defense: 11, mag_defense: 5, crit_rate: 10, evasion: 3 },
    icon: '☸️',
    image: '/characters/monk_full.png',
  },
};

const statColors = { hp: 'success', mp: 'primary', phys_attack: 'danger', mag_attack: 'info', phys_defense: 'warning', mag_defense: 'secondary', crit_rate: 'danger', evasion: 'success' };
const statMax = { hp: 120, mp: 120, phys_attack: 12, mag_attack: 12, phys_defense: 11, mag_defense: 5, crit_rate: 10, evasion: 8 };
const statLabels = { hp: 'HP', mp: 'MP', phys_attack: '물공', mag_attack: '마공', phys_defense: '물방', mag_defense: '마방', crit_rate: '치명', evasion: '회피' };

function CreateCharacter({ onCharacterCreated, onBack }) {
  const [name, setName] = useState('');
  const [selectedClass, setSelectedClass] = useState(null);
  const [selectedElement, setSelectedElement] = useState(null);
  const [error, setError] = useState('');
  const [creating, setCreating] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (!name.trim()) {
      setError('캐릭터 이름을 입력해주세요.');
      return;
    }
    if (!selectedClass) {
      setError('직업을 선택해주세요.');
      return;
    }
    if (!selectedElement) {
      setError('속성을 선택해주세요.');
      return;
    }

    setCreating(true);
    try {
      const res = await api.post('/characters', { name: name.trim(), classType: selectedClass, element: selectedElement });
      onCharacterCreated(res.data.character);
    } catch (err) {
      setError(err.response?.data?.message || '캐릭터 생성에 실패했습니다.');
    } finally {
      setCreating(false);
    }
  };

  return (
    <div className="create-char-container">
      <Container style={{ maxWidth: 900 }}>
        {onBack && (
          <Button variant="outline-secondary" size="sm" className="mb-3" onClick={onBack}>
            &larr; 캐릭터 선택으로
          </Button>
        )}
        <h2 className="text-center game-title mb-1">캐릭터 생성</h2>
        <p className="text-center mb-4" style={{ color: 'var(--text-muted)', fontSize: 14 }}>직업을 선택하고 이름을 지어주세요</p>

        {error && <Alert variant="danger" className="text-center py-2">{error}</Alert>}

        <Row className="g-3 mb-4">
          {Object.entries(CLASS_INFO).map(([className, info]) => (
            <Col xs={12} md={4} key={className}>
              <Card
                className={`h-100 text-center class-card ${selectedClass === className ? 'selected' : ''}`}
                onClick={() => setSelectedClass(className)}
                style={{ cursor: 'pointer' }}
              >
                <Card.Body className="p-3">
                  <div className="class-icon">
                    <img src={info.image} alt={className} onError={(e) => { e.target.style.display='none'; e.target.parentNode.textContent = info.icon; }} />
                  </div>
                  <div className="class-name">{className}</div>
                  <div className="class-desc">{info.description}</div>
                  <div className="d-flex flex-column gap-2 mt-2">
                    {Object.entries(info.stats).map(([stat, val]) => (
                      <div key={stat} className="d-flex align-items-center gap-2">
                        <span style={{ fontSize: 11, color: 'var(--text-muted)', width: 30, textAlign: 'right', fontWeight: 500 }}>
                          {statLabels[stat]}
                        </span>
                        <ProgressBar
                          now={(val / statMax[stat]) * 100}
                          variant={statColors[stat]}
                          className="flex-grow-1"
                          style={{ height: 6 }}
                        />
                        <span style={{ fontSize: 11, color: 'var(--text-dim)', width: 26, fontWeight: 500 }}>{val}</span>
                      </div>
                    ))}
                  </div>
                </Card.Body>
              </Card>
            </Col>
          ))}
        </Row>

        {/* 속성 선택 */}
        <h5 className="text-center mb-3" style={{ color: 'var(--text-muted)', fontSize: 15 }}>속성을 선택하세요</h5>
        <Row className="g-2 mb-4 justify-content-center" style={{ maxWidth: 700, margin: '0 auto' }}>
          {Object.entries(ELEMENT_INFO).map(([key, el]) => (
            <Col xs={4} sm key={key}>
              <div
                className={`element-card ${selectedElement === key ? 'selected' : ''}`}
                onClick={() => setSelectedElement(key)}
                style={{
                  cursor: 'pointer',
                  textAlign: 'center',
                  padding: '12px 8px',
                  borderRadius: 10,
                  border: selectedElement === key ? `2px solid ${el.color}` : '2px solid rgba(255,255,255,0.08)',
                  background: selectedElement === key ? `${el.color}15` : 'rgba(255,255,255,0.02)',
                  transition: 'all 0.2s',
                }}
              >
                <div style={{ fontSize: 28 }}>{el.icon}</div>
                <div style={{ fontSize: 14, fontWeight: 600, color: el.color, marginTop: 4 }}>{el.name}</div>
                <div style={{ fontSize: 10, color: '#888', marginTop: 4, lineHeight: 1.3 }}>{el.desc}</div>
              </div>
            </Col>
          ))}
        </Row>

        <Form onSubmit={handleSubmit} style={{ maxWidth: 420, margin: '0 auto' }}>
          <Form.Group className="mb-3">
            <Form.Label>캐릭터 이름</Form.Label>
            <Form.Control
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="캐릭터 이름을 입력하세요"
              maxLength={20}
              required
            />
          </Form.Group>
          <Button type="submit" variant="primary" className="w-100 py-2" disabled={creating}>
            {creating ? '생성 중...' : '캐릭터 생성'}
          </Button>
        </Form>
      </Container>
    </div>
  );
}

export default CreateCharacter;
