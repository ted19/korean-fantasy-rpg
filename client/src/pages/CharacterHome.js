import React, { useState, useEffect, useCallback } from 'react';
import { Nav, Row, Col, Card, Badge, ProgressBar, Button } from 'react-bootstrap';
import api from '../api';
import Equipment from './Equipment';
import SkillPanel from './SkillPanel';
import SummonEquipment from './SummonEquipment';

const CLASS_IMAGES = {
  '풍수사': '/characters/pungsu_full.png',
  '무당': '/characters/mudang_full.png',
  '승려': '/characters/monk_full.png',
};

const SKILL_TYPE_ICONS = { attack: '⚔️', heal: '💚', buff: '🔺' };

function SummonImg({ src, fallback, className }) {
  const [err, setErr] = useState(false);
  if (err) return <span className={className}>{fallback}</span>;
  return <img src={src} alt="" className={className} onError={() => setErr(true)} />;
}

function CharacterHome({ character, charState, onCharStateUpdate, onLog, onSkillsUpdate, onCharacterDeleted, onSummonsChanged }) {
  const [tab, setTab] = useState('character');
  const [mySummons, setMySummons] = useState([]);
  const [selectedSummon, setSelectedSummon] = useState(null);
  const [showEquipment, setShowEquipment] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const loadMySummons = useCallback(async () => {
    try {
      const res = await api.get('/summon/my');
      setMySummons(res.data.summons);
    } catch {}
  }, []);

  useEffect(() => { loadMySummons(); }, [loadMySummons]);
  useEffect(() => { if (mySummons.length > 0 && !selectedSummon) setSelectedSummon(mySummons[0]); }, [mySummons]);

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

  // 소환수 장비 뷰
  if (showEquipment && selectedSummon) {
    return (
      <div>
        <Button variant="outline-secondary" size="sm" className="mb-3" onClick={() => setShowEquipment(false)}>
          &larr; 소환수 목록으로
        </Button>
        <SummonEquipment
          summon={selectedSummon}
          onLog={onLog}
          onSummonUpdate={() => { loadMySummons(); if (onSummonsChanged) onSummonsChanged(); }}
        />
      </div>
    );
  }

  return (
    <div className="char-home">
      <Nav variant="tabs" className="mb-3">
        <Nav.Item>
          <Nav.Link active={tab === 'character'} onClick={() => setTab('character')}>
            캐릭터
          </Nav.Link>
        </Nav.Item>
        <Nav.Item>
          <Nav.Link active={tab === 'equipment'} onClick={() => setTab('equipment')}>
            장비
          </Nav.Link>
        </Nav.Item>
        <Nav.Item>
          <Nav.Link active={tab === 'summons'} onClick={() => { setTab('summons'); if (mySummons.length > 0 && !selectedSummon) setSelectedSummon(mySummons[0]); }}>
            소환수 <Badge bg="secondary" className="ms-1">{mySummons.length}</Badge>
          </Nav.Link>
        </Nav.Item>
      </Nav>

      {/* ====== 캐릭터 탭 ====== */}
      {tab === 'character' && (
        <Row>
          {/* 왼쪽: 캐릭터 프로필 */}
          <Col lg={5} className="mb-3">
            <Card className="char-profile-card">
              <Card.Body>
                <div className="text-center mb-3">
                  <div className="char-home-avatar">
                    <img
                      src={CLASS_IMAGES[character.class_type]}
                      alt={character.class_type}
                      onError={(e) => { e.target.style.display='none'; }}
                    />
                  </div>
                </div>
                <h4 className="game-title mb-1 text-center" style={{ fontSize: '1.3rem' }}>{character.name}</h4>
                <div className="text-center" style={{ color: 'var(--text-muted)', fontSize: 14, marginBottom: 12 }}>
                  {character.class_type} · Lv.{charState.level}
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
                    <div className="d-flex justify-content-between" style={{ fontSize: 11, color: 'var(--text-dim)' }}>
                      <span>HP</span><span>{charState.currentHp}/{charState.maxHp}</span>
                    </div>
                    <ProgressBar now={Math.min(100, (charState.currentHp / charState.maxHp) * 100)} variant="success" style={{ height: 8 }} />
                  </div>
                  <div>
                    <div className="d-flex justify-content-between" style={{ fontSize: 11, color: 'var(--text-dim)' }}>
                      <span>MP</span><span>{charState.currentMp}/{charState.maxMp}</span>
                    </div>
                    <ProgressBar now={Math.min(100, (charState.currentMp / charState.maxMp) * 100)} variant="primary" style={{ height: 8 }} />
                  </div>
                  <div>
                    <div className="d-flex justify-content-between" style={{ fontSize: 11, color: 'var(--text-dim)' }}>
                      <span>EXP</span><span>{charState.exp}/{charState.level * 100}</span>
                    </div>
                    <ProgressBar now={Math.min(100, (charState.exp / (charState.level * 100)) * 100)} variant="warning" style={{ height: 8 }} />
                  </div>
                </div>

                {/* 캐릭터 삭제 */}
                <div className="text-center mt-3">
                  {!showDeleteConfirm ? (
                    <Button variant="outline-danger" size="sm" onClick={() => setShowDeleteConfirm(true)}>
                      캐릭터 삭제
                    </Button>
                  ) : (
                    <div className="d-flex align-items-center gap-2 flex-wrap justify-content-center">
                      <span style={{ color: 'var(--red)', fontSize: 13, fontWeight: 600 }}>정말 삭제하시겠습니까?</span>
                      <Button variant="danger" size="sm" onClick={handleDelete} disabled={deleting}>
                        {deleting ? '삭제 중...' : '삭제 확인'}
                      </Button>
                      <Button variant="secondary" size="sm" onClick={() => setShowDeleteConfirm(false)}>취소</Button>
                    </div>
                  )}
                </div>
              </Card.Body>
            </Card>
          </Col>

          {/* 오른쪽: 스킬 패널 */}
          <Col lg={7} className="mb-3">
            <Card className="char-skill-card">
              <Card.Body className="d-flex flex-column">
                <div style={{ fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: 2, fontWeight: 600, marginBottom: 10 }}>
                  스킬 목록
                </div>
                <SkillPanel
                  charState={charState}
                  onLog={onLog}
                  onSkillsUpdate={onSkillsUpdate}
                />
              </Card.Body>
            </Card>
          </Col>
        </Row>
      )}

      {/* ====== 장비 탭 ====== */}
      {tab === 'equipment' && (
        <Equipment
          character={character}
          charState={charState}
          onCharStateUpdate={onCharStateUpdate}
          onLog={onLog}
        />
      )}

      {/* ====== 소환수 탭 ====== */}
      {tab === 'summons' && (
        <Row>
          {/* 왼쪽: 선택된 소환수 프로필 */}
          <Col lg={5} className="mb-3">
            <Card className="char-profile-card">
              <Card.Body>
                {selectedSummon ? (
                  <>
                    <div className="text-center mb-3">
                      <div className="char-home-avatar">
                        <SummonImg
                          src={selectedSummon.icon_url_img || `/summons/${selectedSummon.template_id}_full.png`}
                          fallback={selectedSummon.icon}
                          className="summon-profile-img"
                        />
                      </div>
                    </div>
                    <h4 className="game-title mb-1 text-center" style={{ fontSize: '1.3rem' }}>{selectedSummon.name}</h4>
                    <div className="text-center" style={{ color: 'var(--text-muted)', fontSize: 14, marginBottom: 12 }}>
                      {selectedSummon.type} · Lv.{selectedSummon.level}
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
                    </div>

                    <div className="d-flex flex-column gap-2">
                      <div>
                        <div className="d-flex justify-content-between" style={{ fontSize: 11, color: 'var(--text-dim)' }}>
                          <span>HP</span><span>{selectedSummon.hp}</span>
                        </div>
                        <ProgressBar now={100} variant="success" style={{ height: 8 }} />
                      </div>
                      <div>
                        <div className="d-flex justify-content-between" style={{ fontSize: 11, color: 'var(--text-dim)' }}>
                          <span>MP</span><span>{selectedSummon.mp}</span>
                        </div>
                        <ProgressBar now={100} variant="primary" style={{ height: 8 }} />
                      </div>
                      <div>
                        <div className="d-flex justify-content-between" style={{ fontSize: 11, color: 'var(--text-dim)' }}>
                          <span>EXP</span><span>{selectedSummon.exp}/{selectedSummon.level * 50}</span>
                        </div>
                        <ProgressBar now={(selectedSummon.exp / (selectedSummon.level * 50)) * 100} variant="warning" style={{ height: 8 }} />
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

                    <div className="text-center mt-3">
                      <Button size="sm" variant="primary" onClick={() => setShowEquipment(true)}>
                        장비 관리
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
                        <SummonImg
                          src={s.icon_url_img || `/summons/${s.template_id}_icon.png`}
                          fallback={s.icon}
                          className="summon-list-icon"
                        />
                        <div className="flex-grow-1">
                          <div style={{ fontWeight: 600, color: 'var(--text-bright)', fontSize: 13 }}>{s.name}</div>
                          <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{s.type} · Lv.{s.level}</div>
                        </div>
                        <div className="d-flex gap-1 flex-wrap" style={{ fontSize: 10 }}>
                          <span className="eff hp">HP {s.hp}</span>
                          <span className="eff mp">MP {s.mp}</span>
                          <span className="eff atk">물공 {s.phys_attack || 0}</span>
                          <span className="eff atk">마공 {s.mag_attack || 0}</span>
                          <span className="eff mp">이동 3</span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </Card.Body>
            </Card>
          </Col>
        </Row>
      )}
    </div>
  );
}

export default CharacterHome;
