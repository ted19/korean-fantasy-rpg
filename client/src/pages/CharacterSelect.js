import React, { useState, useEffect } from 'react';
import api from '../api';

const CLASS_IMAGES = {
  '풍수사': '/characters/pungsu_full.png',
  '무당': '/characters/mudang_full.png',
  '승려': '/characters/monk_full.png',
};

const CLASS_ICONS = { '풍수사': '✨', '무당': '🌙', '승려': '☸️' };

const ELEMENT_INFO = {
  fire:    { name: '불', icon: '🔥', color: '#ff6b35' },
  water:   { name: '물', icon: '💧', color: '#4da6ff' },
  earth:   { name: '땅', icon: '🪨', color: '#8bc34a' },
  wind:    { name: '바람', icon: '🌀', color: '#b388ff' },
  neutral: { name: '중립', icon: '⚪', color: '#9ca3af' },
};

function CharacterSelect({ onSelectCharacter, onCreateNew, onLogout }) {
  const [characters, setCharacters] = useState([]);
  const [loading, setLoading] = useState(true);
  const [deleting, setDeleting] = useState(null);
  const [hoveredChar, setHoveredChar] = useState(null);
  const [bgLoaded, setBgLoaded] = useState(false);

  useEffect(() => {
    const img = new Image();
    img.onload = () => setBgLoaded(true);
    img.src = '/ui/charsel_bg.png';
  }, []);

  const loadCharacters = async () => {
    try {
      const res = await api.get('/characters/list');
      setCharacters(res.data.characters);
    } catch {}
    setLoading(false);
  };

  useEffect(() => { loadCharacters(); }, []);

  const handleSelect = async (char) => {
    localStorage.setItem('selectedCharId', char.id);
    try {
      const res = await api.get(`/characters/me?charId=${char.id}`);
      if (res.data.character) {
        onSelectCharacter(res.data.character);
      }
    } catch {}
  };

  const handleDelete = async (charId, e) => {
    e.stopPropagation();
    setDeleting(charId);
    try {
      await api.delete(`/characters/me?charId=${charId}`);
      localStorage.removeItem('selectedCharId');
      await loadCharacters();
    } catch {}
    setDeleting(null);
  };

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
          <div className="charsel-header-logo">
            <img src="/ui/auth_logo_bg.png" alt="" onError={(e) => { e.target.style.display = 'none'; }} />
          </div>
          <h1 className="charsel-header-title">캐릭터 선택</h1>
          <p className="charsel-header-sub">모험을 함께할 캐릭터를 선택하세요</p>
          <div className="charsel-header-divider">
            <img src="/ui/charsel_banner.png" alt="" onError={(e) => { e.target.style.display = 'none'; }} />
          </div>
        </div>

        {/* 캐릭터 카드 그리드 */}
        <div className="charsel-cards">
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
                {/* 카드 프레임 */}
                <div className="charsel-char-frame">
                  <img src="/ui/charsel_card_frame.png" alt="" onError={(e) => { e.target.style.display = 'none'; }} />
                </div>

                {/* 발판 */}
                <div className="charsel-char-pedestal">
                  <img src="/ui/charsel_pedestal.png" alt="" onError={(e) => { e.target.style.display = 'none'; }} />
                </div>

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
                      <span className="charsel-stat-val hp">{char.hp}</span>
                    </div>
                    <div className="charsel-char-stat">
                      <span className="charsel-stat-label">MP</span>
                      <span className="charsel-stat-val mp">{char.mp}</span>
                    </div>
                    <div className="charsel-char-stat">
                      <span className="charsel-stat-label">ATK</span>
                      <span className="charsel-stat-val atk">{char.attack}</span>
                    </div>
                  </div>
                </div>

                {/* 삭제 */}
                <button
                  className="charsel-char-delete"
                  onClick={(e) => handleDelete(char.id, e)}
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

          {/* 빈 슬롯 */}
          {characters.length < 3 && (
            <div
              className="charsel-char-card charsel-new-slot"
              onClick={onCreateNew}
              style={{ animationDelay: `${characters.length * 0.15}s` }}
            >
              <div className="charsel-new-inner">
                <div className="charsel-new-circle">
                  <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                    <line x1="12" y1="5" x2="12" y2="19" />
                    <line x1="5" y1="12" x2="19" y2="12" />
                  </svg>
                </div>
                <div className="charsel-new-text">새 캐릭터 생성</div>
                <div className="charsel-new-count">{characters.length} / 3</div>
              </div>
            </div>
          )}
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
    </div>
  );
}

export default CharacterSelect;
