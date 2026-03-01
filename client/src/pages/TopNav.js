import React, { useState } from 'react';

const CLASS_IMAGES = {
  '풍수사': '/characters/pungsu_icon.png',
  '무당': '/characters/mudang_icon.png',
  '승려': '/characters/monk_icon.png',
};

const CLASS_ICONS = {
  '풍수사': '✨',
  '무당': '🌙',
  '승려': '☸️',
};

const MENU_ITEMS = [
  { id: 'home', name: '홈', icon: '/ui/nav_home.png' },
  { id: 'village', name: '마을', icon: '/ui/nav_village.png' },
  { id: 'stage', name: '스테이지', icon: '/ui/nav_stage.png' },
  { id: 'dungeon', name: '던전', icon: '/ui/nav_dungeon.png' },
  { id: 'bestiary', name: '도감', icon: '/ui/nav_bestiary.png' },
];

function NavIcon({ src, fallback, className }) {
  const [err, setErr] = useState(false);
  if (err) return <span className={className}>{fallback}</span>;
  return <img src={src} alt="" className={className} onError={() => setErr(true)} />;
}

function TopNav({ character, charState, currentLocation, onLocationChange, onLogout, onGoToCharacterSelect }) {
  const [imgError, setImgError] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <nav className="top-nav-v2">
      {/* 배경 장식 */}
      <div className="top-nav-v2-bg" style={{ backgroundImage: 'url(/ui/nav_bg.png)', backgroundSize: 'cover', backgroundPosition: 'center' }} />

      <div className="top-nav-v2-inner">
        {/* 왼쪽: 로고 + 프로필 */}
        <div className="top-nav-v2-left">
          <div className="top-nav-v2-logo">
            <img src="/ui/game_logo.png" alt="logo" onError={(e) => { e.target.style.display = 'none'; }} />
          </div>
          <div className="top-nav-v2-profile">
            <div className="top-nav-v2-avatar">
              {!imgError && CLASS_IMAGES[character.class_type] ? (
                <img
                  src={CLASS_IMAGES[character.class_type]}
                  alt={character.class_type}
                  onError={() => setImgError(true)}
                />
              ) : (
                <span className="top-nav-v2-avatar-fallback">{CLASS_ICONS[character.class_type]}</span>
              )}
            </div>
            <div className="top-nav-v2-info">
              <span className="top-nav-v2-name">{character.name}</span>
              <div className="top-nav-v2-stats">
                <span className="top-nav-v2-stat class-tag">{character.class_type}</span>
                <span className="top-nav-v2-stat level-tag">Lv.{charState.level}</span>
                <span className="top-nav-v2-stat gold-tag">
                  <img src="/ui/gold_coin.png" alt="" className="top-nav-v2-coin" onError={(e) => { e.target.style.display = 'none'; }} />
                  {(charState.gold ?? 0).toLocaleString()}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* 모바일 토글 */}
        <button className="top-nav-v2-toggle" onClick={() => setMenuOpen(!menuOpen)}>
          <span /><span /><span />
        </button>

        {/* 오른쪽: 메뉴 */}
        <div className={`top-nav-v2-menu${menuOpen ? ' open' : ''}`}>
          {MENU_ITEMS.map((item) => (
            <button
              key={item.id}
              className={`top-nav-v2-btn${currentLocation === item.id ? ' active' : ''}`}
              onClick={() => { onLocationChange(item.id); setMenuOpen(false); }}
            >
              <div className="top-nav-v2-btn-icon-wrap">
                <NavIcon src={item.icon} fallback="?" className="top-nav-v2-btn-icon" />
                {currentLocation === item.id && <div className="top-nav-v2-btn-glow" />}
              </div>
              <span className="top-nav-v2-btn-name">{item.name}</span>
            </button>
          ))}
          {onGoToCharacterSelect && (
            <button className="top-nav-v2-btn" onClick={() => { onGoToCharacterSelect(); setMenuOpen(false); }}>
              <div className="top-nav-v2-btn-icon-wrap">
                <NavIcon src="/ui/nav_charswitch.png" fallback="👤" className="top-nav-v2-btn-icon" />
              </div>
              <span className="top-nav-v2-btn-name">캐릭터</span>
            </button>
          )}
          <button className="top-nav-v2-btn logout" onClick={() => { onLogout(); setMenuOpen(false); }}>
            <div className="top-nav-v2-btn-icon-wrap">
              <NavIcon src="/ui/logout_icon.png" fallback="🚪" className="top-nav-v2-btn-icon" />
            </div>
            <span className="top-nav-v2-btn-name">나가기</span>
          </button>
        </div>
      </div>
    </nav>
  );
}

export default TopNav;
