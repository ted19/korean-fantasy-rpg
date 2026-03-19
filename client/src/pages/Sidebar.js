import React from 'react';
import { Nav, ProgressBar, Offcanvas } from 'react-bootstrap';

const CLASS_ICONS = {
  '풍수사': '✨',
  '무당': '🌙',
  '승려': '☸️',
  '저승사자': '💀',
  '북채비': '🛡️',
  '강신무': '🗡️',
};

const CLASS_IMAGES = {
  '풍수사': '/characters/pungsu_icon.png',
  '무당': '/characters/mudang_icon.png',
  '승려': '/characters/monk_icon.png',
  '저승사자': '/characters/reaper_icon.png',
  '북채비': '/characters/bukchaebi_icon.png',
  '강신무': '/characters/gangsinmu_icon.png',
};

const MENU_ITEMS = [
  { id: 'village', name: '마을', icon: '🏠' },
  { id: 'dungeon', name: '던전', icon: '⚔️' },
  { id: 'bestiary', name: '몬스터 도감', icon: '📖' },
];

function SidebarContent({ character, charState, onLocationChange, currentLocation, onShowCharDetail, onLogout }) {
  if (!charState || !character) return null;
  const expNeeded = (charState.level || 1) * 100;
  const hpPercent = charState.maxHp > 0 ? Math.min(100, ((charState.currentHp || 0) / charState.maxHp) * 100) : 0;
  const mpPercent = charState.maxMp > 0 ? Math.min(100, ((charState.currentMp || 0) / charState.maxMp) * 100) : 0;
  const expPercent = expNeeded > 0 ? Math.min(100, ((charState.exp || 0) / expNeeded) * 100) : 0;

  return (
    <>
      <div className="sidebar-profile" onClick={onShowCharDetail} role="button" title="캐릭터 상세보기">
        <div className="profile-icon">
          {CLASS_IMAGES[character.class_type]
            ? <img src={CLASS_IMAGES[character.class_type]} alt={character.class_type} style={{width:'100%',height:'100%',objectFit:'cover',borderRadius:'50%'}} onError={(e) => { e.target.style.display='none'; e.target.parentNode.textContent = CLASS_ICONS[character.class_type]; }} />
            : CLASS_ICONS[character.class_type]
          }
        </div>
        <div className="profile-name">{character.name}</div>
        <div className="profile-class">{character.class_type}
          {character.element && character.element !== 'neutral' && (
            <span style={{ marginLeft: 6 }}>
              {{ fire: '🔥', water: '💧', earth: '🪨', wind: '🌀', neutral: '⚪' }[character.element]}
            </span>
          )}
        </div>
        <div className="profile-level">Lv. {charState.level}</div>
      </div>

      <div className="sidebar-bars">
        <div className="bar-group">
          <div className="bar-label"><span>HP</span><span>{charState.currentHp}/{charState.maxHp}</span></div>
          <ProgressBar now={hpPercent} variant="success" style={{ height: 10 }} />
        </div>
        <div className="bar-group">
          <div className="bar-label"><span>MP</span><span>{charState.currentMp}/{charState.maxMp}</span></div>
          <ProgressBar now={mpPercent} variant="primary" style={{ height: 10 }} />
        </div>
        <div className="bar-group">
          <div className="bar-label"><span>EXP</span><span>{charState.exp}/{expNeeded}</span></div>
          <ProgressBar now={expPercent} variant="warning" style={{ height: 10 }} />
        </div>
      </div>

      <div className="sidebar-stats">
        <div className="sidebar-stat-row"><span>공격력</span><span>{charState.attack}</span></div>
        <div className="sidebar-stat-row"><span>방어력</span><span>{charState.defense}</span></div>
        <div className="sidebar-stat-row"><span>골드</span><span className="gold-text">{charState.gold}G</span></div>
      </div>

      <Nav className="flex-column sidebar-menu">
        {MENU_ITEMS.map((item) => (
          <Nav.Link
            key={item.id}
            className={`sidebar-menu-item ${currentLocation === item.id ? 'active' : ''}`}
            onClick={() => onLocationChange(item.id)}
          >
            <span className="sidebar-menu-icon">{item.icon}</span>
            <span className="sidebar-menu-name">{item.name}</span>
          </Nav.Link>
        ))}
      </Nav>

      <div className="sidebar-bottom">
        <button className="btn-char-detail" onClick={onShowCharDetail}>캐릭터 상세</button>
        <button className="btn-logout" onClick={onLogout}>로그아웃</button>
      </div>
    </>
  );
}

function Sidebar({ character, charState, onLocationChange, currentLocation, onShowCharDetail, onLogout, show, onHide }) {
  const sidebarProps = { character, charState, onLocationChange, currentLocation, onShowCharDetail, onLogout };

  return (
    <>
      {/* 데스크탑 사이드바 */}
      <aside className="game-sidebar d-none d-md-flex">
        <SidebarContent {...sidebarProps} />
      </aside>

      {/* 모바일 Offcanvas */}
      <Offcanvas show={show} onHide={onHide} className="d-md-none" style={{ width: 280, background: 'var(--bg-panel)' }}>
        <Offcanvas.Header closeButton closeVariant="white">
          <Offcanvas.Title className="game-title" style={{ fontSize: 16 }}>메뉴</Offcanvas.Title>
        </Offcanvas.Header>
        <Offcanvas.Body className="p-0">
          <SidebarContent {...sidebarProps} />
        </Offcanvas.Body>
      </Offcanvas>
    </>
  );
}

export default Sidebar;
