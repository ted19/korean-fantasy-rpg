import React, { useState, useEffect, useRef } from 'react';
import api from '../api';

const CLASS_IMAGES = {
  '풍수사': '/characters/pungsu_full.png',
  '무당': '/characters/mudang_full.png',
  '승려': '/characters/monk_full.png',
  '저승사자': '/characters/reaper_full.png',
};

const CLASS_ICONS = { '풍수사': '⬥', '무당': '◈', '승려': '◆', '저승사자': '☠' };

const ELEMENT_INFO = {
  fire:    { name: '화', icon: '◆', color: '#c87a4a' },
  water:   { name: '수', icon: '◆', color: '#5a8ab4' },
  earth:   { name: '지', icon: '◆', color: '#7a9a5a' },
  wind:    { name: '풍', icon: '◆', color: '#9a7ab4' },
  neutral: { name: '무', icon: '◇', color: '#8a7a60' },
};

const MAX_CHARACTERS = 3;

function CharacterSelect({ onSelectCharacter, onCreateNew, onLogout }) {
  const [characters, setCharacters] = useState([]);
  const [loading, setLoading] = useState(true);
  const [deleting, setDeleting] = useState(null);
  const [hoveredChar, setHoveredChar] = useState(null);
  const [bgLoaded, setBgLoaded] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleteInput, setDeleteInput] = useState('');
  const [deleteError, setDeleteError] = useState('');
  const deleteInputRef = useRef(null);

  useEffect(() => {
    const img = new Image();
    img.onload = () => setBgLoaded(true);
    img.src = '/ui/charsel_bg.png';
  }, []);

  const loadCharacters = async () => {
    try {
      const res = await api.get('/characters/list');
      setCharacters(res.data.characters || []);
    } catch (err) {
      console.error('캐릭터 목록 로드 실패:', err);
      setCharacters([]);
    }
    setLoading(false);
  };

  useEffect(() => { loadCharacters(); }, []);

  useEffect(() => {
    if (deleteTarget && deleteInputRef.current) {
      deleteInputRef.current.focus();
    }
  }, [deleteTarget]);

  const handleSelect = async (char) => {
    if (deleteTarget) return;
    localStorage.setItem('selectedCharId', char.id);
    try {
      const res = await api.get(`/characters/me?charId=${char.id}`);
      if (res.data.character) {
        onSelectCharacter(res.data.character);
      }
    } catch (err) {
      console.error('캐릭터 선택 실패:', err);
    }
  };

  const openDeleteModal = (char, e) => {
    e.stopPropagation();
    setDeleteTarget(char);
    setDeleteInput('');
    setDeleteError('');
  };

  const closeDeleteModal = () => {
    setDeleteTarget(null);
    setDeleteInput('');
    setDeleteError('');
  };

  const handleDeleteConfirm = async () => {
    if (!deleteTarget) return;
    if (deleteInput !== deleteTarget.name) {
      setDeleteError('캐릭터 이름이 일치하지 않습니다.');
      return;
    }
    setDeleting(deleteTarget.id);
    try {
      await api.delete(`/characters/me?charId=${deleteTarget.id}`);
      localStorage.removeItem('selectedCharId');
      closeDeleteModal();
      await loadCharacters();
    } catch (err) {
      console.error('캐릭터 삭제 실패:', err);
      setDeleteError('삭제에 실패했습니다.');
    }
    setDeleting(null);
  };

  // 항상 3칸: 캐릭터 + 빈 슬롯
  const emptySlots = MAX_CHARACTERS - characters.length;

  if (loading) {
    return (
      <div className="charsel-loading-screen">
        <div className="charsel-loading-spinner" />
        <p>캐릭터 불러오는 중...</p>
      </div>
    );
  }

  return (
    <div className={`charsel-page ${bgLoaded ? 'loaded' : ''}`}>
      {/* 배경 */}
      <div className="charsel-bg-img" style={{ backgroundImage: 'url(/ui/charsel_bg.png)' }} />
      <div className="charsel-bg-overlay" />

      {/* 파티클 */}
      <div className="charsel-particles">
        {Array.from({ length: 30 }).map((_, i) => (
          <div
            key={i}
            className="charsel-particle"
            style={{
              left: `${Math.random() * 100}%`,
              animationDelay: `${Math.random() * 10}s`,
              animationDuration: `${5 + Math.random() * 10}s`,
              opacity: 0.2 + Math.random() * 0.6,
              width: `${1 + Math.random() * 3}px`,
              height: `${1 + Math.random() * 3}px`,
            }}
          />
        ))}
      </div>

      {/* 콘텐츠 */}
      <div className="charsel-main">
        {/* 상단 헤더 */}
        <div className="charsel-header">
          <div className="charsel-header-ornament">— ◆ —</div>
          <h1 className="charsel-header-title">캐릭터 선택</h1>
          <p className="charsel-header-sub">모험을 함께할 캐릭터를 선택하세요 ({characters.length}/{MAX_CHARACTERS})</p>
          <div className="charsel-header-ornament bottom">— ◇ —</div>
        </div>

        {/* 캐릭터 카드 그리드 - 항상 3칸 */}
        <div className="charsel-cards">
          {/* 생성된 캐릭터 (왼쪽부터) */}
          {characters.map((char, idx) => {
            const el = ELEMENT_INFO[char.element] || ELEMENT_INFO.neutral;
            const isHovered = hoveredChar === char.id;
            return (
              <div
                key={char.id}
                className={`charsel-char-card ${isHovered ? 'hovered' : ''}`}
                onClick={() => handleSelect(char)}
                onMouseEnter={() => setHoveredChar(char.id)}
                onMouseLeave={() => setHoveredChar(null)}
                style={{ animationDelay: `${idx * 0.15}s` }}
              >
                {/* 캐릭터 이미지 */}
                <div className="charsel-char-portrait">
                  <img
                    src={CLASS_IMAGES[char.class_type]}
                    alt={char.class_type}
                    onError={(e) => { e.target.style.display = 'none'; }}
                  />
                  <div className="charsel-char-glow" style={{ background: `radial-gradient(ellipse, ${el.color}30 0%, transparent 70%)` }} />
                </div>

                {/* 속성 뱃지 */}
                <div className="charsel-char-element" style={{ borderColor: el.color, color: el.color }}>
                  <span>{el.icon}</span>
                  <span>{el.name}</span>
                </div>

                {/* 정보 */}
                <div className="charsel-char-info">
                  <div className="charsel-char-name">{char.name}</div>
                  <div className="charsel-char-class">
                    <span>{CLASS_ICONS[char.class_type]}</span>
                    <span>{char.class_type}</span>
                  </div>
                  <div className="charsel-char-level">
                    <div className="charsel-char-level-badge">Lv.{char.level}</div>
                  </div>
                  <div className="charsel-char-stats">
                    <div className="charsel-char-stat">
                      <span className="charsel-stat-label">HP</span>
                      <span className="charsel-stat-val hp">{char.hp ?? '?'}</span>
                    </div>
                    <div className="charsel-char-stat">
                      <span className="charsel-stat-label">MP</span>
                      <span className="charsel-stat-val mp">{char.mp ?? '?'}</span>
                    </div>
                    <div className="charsel-char-stat">
                      <span className="charsel-stat-label">ATK</span>
                      <span className="charsel-stat-val atk">{char.attack ?? '?'}</span>
                    </div>
                  </div>
                </div>

                {/* 삭제 */}
                <button
                  className="charsel-char-delete"
                  onClick={(e) => openDeleteModal(char, e)}
                  disabled={deleting === char.id}
                  title="캐릭터 삭제"
                >
                  {deleting === char.id ? '...' : '×'}
                </button>

                {/* 선택 표시 */}
                <div className="charsel-char-select-hint">선택하기</div>
              </div>
            );
          })}

          {/* 빈 슬롯들 (항상 3칸 채우기) */}
          {Array.from({ length: emptySlots }).map((_, idx) => (
            <div
              key={`empty-${idx}`}
              className="charsel-char-card charsel-new-slot"
              onClick={onCreateNew}
              style={{ animationDelay: `${(characters.length + idx) * 0.15}s` }}
            >
              <div className="charsel-new-inner">
                <div className="charsel-new-slot-number">슬롯 {characters.length + idx + 1}</div>
                <div className="charsel-new-circle">
                  <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                    <line x1="12" y1="5" x2="12" y2="19" />
                    <line x1="5" y1="12" x2="19" y2="12" />
                  </svg>
                </div>
                <div className="charsel-new-text">새 캐릭터 생성</div>
              </div>
            </div>
          ))}
        </div>

        {/* 하단 */}
        <div className="charsel-footer">
          <button className="charsel-logout-btn" onClick={onLogout}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4"/>
              <polyline points="16 17 21 12 16 7"/>
              <line x1="21" y1="12" x2="9" y2="12"/>
            </svg>
            <span>로그아웃</span>
          </button>
        </div>
      </div>

      {/* 삭제 확인 모달 */}
      {deleteTarget && (
        <div className="charsel-delete-overlay" onClick={closeDeleteModal}>
          <div className="charsel-delete-modal" onClick={(e) => e.stopPropagation()}>
            <button className="charsel-delete-modal-close" onClick={closeDeleteModal}>&times;</button>
            <div className="charsel-delete-modal-icon">
              <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="#ef4444" strokeWidth="1.5">
                <path d="M12 9v4m0 4h.01M3 12a9 9 0 1118 0 9 9 0 01-18 0z"/>
              </svg>
            </div>
            <h3 className="charsel-delete-modal-title">캐릭터 삭제</h3>
            <p className="charsel-delete-modal-desc">
              이 작업은 되돌릴 수 없습니다.<br/>
              캐릭터의 모든 데이터(장비, 스킬, 소환수 등)가 영구 삭제됩니다.
            </p>
            <div className="charsel-delete-modal-charinfo">
              <img
                src={CLASS_IMAGES[deleteTarget.class_type]}
                alt=""
                className="charsel-delete-modal-portrait"
                onError={(e) => { e.target.style.display = 'none'; }}
              />
              <div>
                <div className="charsel-delete-modal-charname">{deleteTarget.name}</div>
                <div className="charsel-delete-modal-charsub">
                  {CLASS_ICONS[deleteTarget.class_type]} {deleteTarget.class_type} · Lv.{deleteTarget.level}
                </div>
              </div>
            </div>
            <div className="charsel-delete-modal-inputwrap">
              <label className="charsel-delete-modal-label">
                삭제하려면 캐릭터 이름 <strong>"{deleteTarget.name}"</strong>을(를) 입력하세요
              </label>
              <input
                ref={deleteInputRef}
                type="text"
                className={`charsel-delete-modal-input ${deleteError ? 'error' : ''}`}
                value={deleteInput}
                onChange={(e) => { setDeleteInput(e.target.value); setDeleteError(''); }}
                onKeyDown={(e) => { if (e.key === 'Enter') handleDeleteConfirm(); }}
                placeholder="캐릭터 이름 입력"
                autoComplete="off"
              />
              {deleteError && <div className="charsel-delete-modal-error">{deleteError}</div>}
            </div>
            <div className="charsel-delete-modal-actions">
              <button className="charsel-delete-modal-cancel" onClick={closeDeleteModal}>취소</button>
              <button
                className="charsel-delete-modal-confirm"
                onClick={handleDeleteConfirm}
                disabled={deleting || deleteInput !== deleteTarget.name}
              >
                {deleting ? '삭제 중...' : '삭제'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default CharacterSelect;
