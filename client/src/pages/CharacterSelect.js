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

  const handleDelete = async (charId) => {
    setDeleting(charId);
    try {
      await api.delete(`/characters/me?charId=${charId}`);
      localStorage.removeItem('selectedCharId');
      await loadCharacters();
    } catch {}
    setDeleting(null);
  };

  if (loading) {
    return <div className="charsel-loading">캐릭터 불러오는 중...</div>;
  }

  return (
    <div className="charsel-container">
      <div className="charsel-bg">
        <div className="charsel-bg-gradient" />
      </div>

      <div className="charsel-content">
        <h1 className="charsel-title">캐릭터 선택</h1>
        <p className="charsel-subtitle">모험을 함께할 캐릭터를 선택하세요</p>

        <div className="charsel-grid">
          {characters.map(char => {
            const el = ELEMENT_INFO[char.element] || ELEMENT_INFO.neutral;
            return (
              <div key={char.id} className="charsel-card" onClick={() => handleSelect(char)}>
                <div className="charsel-card-img-wrap">
                  <img
                    src={CLASS_IMAGES[char.class_type]}
                    alt={char.class_type}
                    className="charsel-card-img"
                    onError={(e) => { e.target.style.display = 'none'; }}
                  />
                  <div className="charsel-card-img-overlay" />
                </div>
                <div className="charsel-card-info">
                  <div className="charsel-card-name">{char.name}</div>
                  <div className="charsel-card-meta">
                    <span>{CLASS_ICONS[char.class_type]} {char.class_type}</span>
                    <span>Lv.{char.level}</span>
                    <span style={{ color: el.color }}>{el.icon} {el.name}</span>
                  </div>
                </div>
                <button
                  className="charsel-card-delete"
                  onClick={(e) => { e.stopPropagation(); handleDelete(char.id); }}
                  disabled={deleting === char.id}
                  title="캐릭터 삭제"
                >
                  {deleting === char.id ? '...' : '×'}
                </button>
              </div>
            );
          })}

          {/* 빈 슬롯 */}
          {characters.length < 3 && (
            <div className="charsel-card charsel-card-new" onClick={onCreateNew}>
              <div className="charsel-card-new-icon">+</div>
              <div className="charsel-card-new-text">새 캐릭터 생성</div>
              <div className="charsel-card-new-sub">{characters.length}/3</div>
            </div>
          )}
        </div>

        <button className="charsel-logout" onClick={onLogout}>로그아웃</button>
      </div>
    </div>
  );
}

export default CharacterSelect;
