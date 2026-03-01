import React, { useState, useEffect } from 'react';
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

const statMax = { hp: 120, mp: 120, phys_attack: 12, mag_attack: 12, phys_defense: 11, mag_defense: 5, crit_rate: 10, evasion: 8 };
const statLabels = { hp: 'HP', mp: 'MP', phys_attack: '물공', mag_attack: '마공', phys_defense: '물방', mag_defense: '마방', crit_rate: '치명', evasion: '회피' };
const statColors = { hp: '#4ade80', mp: '#60a5fa', phys_attack: '#f87171', mag_attack: '#818cf8', phys_defense: '#fbbf24', mag_defense: '#94a3b8', crit_rate: '#fb923c', evasion: '#2dd4bf' };

function CreateCharacter({ onCharacterCreated, onBack }) {
  const [name, setName] = useState('');
  const [selectedClass, setSelectedClass] = useState(null);
  const [selectedElement, setSelectedElement] = useState(null);
  const [error, setError] = useState('');
  const [creating, setCreating] = useState(false);
  const [bgLoaded, setBgLoaded] = useState(false);

  useEffect(() => {
    const img = new Image();
    img.onload = () => setBgLoaded(true);
    img.src = '/ui/charsel_bg.png';
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    if (!name.trim()) { setError('캐릭터 이름을 입력해주세요.'); return; }
    if (!selectedClass) { setError('직업을 선택해주세요.'); return; }
    if (!selectedElement) { setError('속성을 선택해주세요.'); return; }

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
    <div className={`create-page ${bgLoaded ? 'loaded' : ''}`}>
      <div className="auth-bg" style={{ backgroundImage: 'url(/ui/charsel_bg.png)' }} />
      <div className="auth-bg-overlay" />

      <div className="auth-particles">
        {Array.from({ length: 15 }).map((_, i) => (
          <div key={i} className="auth-particle" style={{
            left: `${Math.random() * 100}%`,
            animationDelay: `${Math.random() * 8}s`,
            animationDuration: `${6 + Math.random() * 8}s`,
            opacity: 0.3 + Math.random() * 0.4,
            width: `${2 + Math.random() * 3}px`,
            height: `${2 + Math.random() * 3}px`,
          }} />
        ))}
      </div>

      <div className="create-main">
        {/* 상단 */}
        <div className="create-top">
          {onBack && (
            <button className="create-back" onClick={onBack}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M19 12H5M12 19l-7-7 7-7"/>
              </svg>
              <span>캐릭터 선택</span>
            </button>
          )}
          <h1 className="create-title">캐릭터 생성</h1>
          <p className="create-subtitle">직업과 속성을 선택하고 이름을 지어주세요</p>
        </div>

        {error && (
          <div className="auth-error" style={{ maxWidth: 600, margin: '0 auto 20px' }}>
            <span className="auth-error-icon">!</span>
            {error}
          </div>
        )}

        {/* 직업 선택 */}
        <div className="create-section-label">직업 선택</div>
        <div className="create-class-grid">
          {Object.entries(CLASS_INFO).map(([className, info]) => (
            <div
              key={className}
              className={`create-class-card ${selectedClass === className ? 'selected' : ''}`}
              onClick={() => setSelectedClass(className)}
            >
              <div className="create-class-portrait">
                <img
                  src={info.image}
                  alt={className}
                  onError={(e) => { e.target.style.display = 'none'; e.target.parentNode.innerHTML = `<span style="font-size:48px">${info.icon}</span>`; }}
                />
                {selectedClass === className && <div className="create-class-selected-ring" />}
              </div>
              <div className="create-class-info">
                <div className="create-class-name">{info.icon} {className}</div>
                <div className="create-class-desc">{info.description}</div>
                <div className="create-class-stats">
                  {Object.entries(info.stats).map(([stat, val]) => (
                    <div key={stat} className="create-stat-row">
                      <span className="create-stat-label">{statLabels[stat]}</span>
                      <div className="create-stat-bar-bg">
                        <div
                          className="create-stat-bar-fill"
                          style={{
                            width: `${(val / statMax[stat]) * 100}%`,
                            background: statColors[stat],
                          }}
                        />
                      </div>
                      <span className="create-stat-val" style={{ color: statColors[stat] }}>{val}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* 속성 선택 */}
        <div className="create-section-label">속성 선택</div>
        <div className="create-element-grid">
          {Object.entries(ELEMENT_INFO).map(([key, el]) => (
            <div
              key={key}
              className={`create-element-card ${selectedElement === key ? 'selected' : ''}`}
              onClick={() => setSelectedElement(key)}
              style={{
                borderColor: selectedElement === key ? el.color : undefined,
                boxShadow: selectedElement === key ? `0 0 20px ${el.color}20, inset 0 0 20px ${el.color}08` : undefined,
              }}
            >
              <div className="create-element-icon">{el.icon}</div>
              <div className="create-element-name" style={{ color: selectedElement === key ? el.color : '#aaa' }}>{el.name}</div>
              <div className="create-element-desc">{el.desc}</div>
            </div>
          ))}
        </div>

        {/* 이름 입력 + 생성 */}
        <form onSubmit={handleSubmit} className="create-name-form">
          <div className="create-name-wrap">
            <label className="create-name-label">캐릭터 이름</label>
            <div className="auth-input-wrap">
              <span className="auth-input-icon">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M12 20h9M16.5 3.5a2.12 2.12 0 013 3L7 19l-4 1 1-4L16.5 3.5z"/>
                </svg>
              </span>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="캐릭터 이름을 입력하세요"
                maxLength={20}
                required
              />
            </div>
          </div>
          <button type="submit" className="auth-submit" disabled={creating} style={{ maxWidth: 440 }}>
            {creating ? (
              <span className="auth-submit-loading"><span className="auth-spinner" /> 생성 중...</span>
            ) : (
              <><span>캐릭터 생성</span>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M5 12h14M12 5l7 7-7 7"/>
                </svg>
              </>
            )}
          </button>
        </form>
      </div>
    </div>
  );
}

export default CreateCharacter;
