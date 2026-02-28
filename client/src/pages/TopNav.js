import React, { useState } from 'react';
import { Navbar, Nav, Container } from 'react-bootstrap';

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
  { id: 'home', name: '홈', icon: '🏠' },
  { id: 'village', name: '마을', icon: '🏘️' },
  { id: 'dungeon', name: '던전', icon: '⚔️' },
  { id: 'bestiary', name: '몬스터 도감', icon: '📖' },
];

function TopNav({ character, charState, currentLocation, onLocationChange, onLogout }) {
  const [imgError, setImgError] = useState(false);

  return (
    <Navbar expand="md" className="top-nav" sticky="top">
      <Container fluid className="px-2 px-md-3">
        {/* 프로필 영역 */}
        <div className="top-nav-profile">
          <div className="top-nav-avatar">
            {!imgError && CLASS_IMAGES[character.class_type] ? (
              <img
                src={CLASS_IMAGES[character.class_type]}
                alt={character.class_type}
                onError={() => setImgError(true)}
              />
            ) : (
              <span className="top-nav-avatar-fallback">{CLASS_ICONS[character.class_type]}</span>
            )}
          </div>
          <div className="top-nav-info d-none d-sm-flex">
            <span className="top-nav-name">{character.name}</span>
            <div className="top-nav-tags">
              <span className="top-nav-tag class">{character.class_type}</span>
              <span className="top-nav-tag level">Lv.{charState.level}</span>
              <span className="top-nav-tag gold">🪙 {charState.gold}</span>
            </div>
          </div>
          <div className="top-nav-gold-mobile d-sm-none">
            <span className="top-nav-tag level">Lv.{charState.level}</span>
            <span className="top-nav-tag gold">🪙 {charState.gold}</span>
          </div>
        </div>

        <Navbar.Toggle aria-controls="top-nav-menu" className="top-nav-toggle" />

        <Navbar.Collapse id="top-nav-menu">
          <Nav className="ms-auto top-nav-links">
            {MENU_ITEMS.map((item) => (
              <Nav.Link
                key={item.id}
                active={currentLocation === item.id}
                onClick={() => onLocationChange(item.id)}
                className="top-nav-link"
              >
                <span className="top-nav-link-icon">{item.icon}</span>
                <span className="top-nav-link-name">{item.name}</span>
              </Nav.Link>
            ))}
            <Nav.Link onClick={onLogout} className="top-nav-link top-nav-logout">
              로그아웃
            </Nav.Link>
          </Nav>
        </Navbar.Collapse>
      </Container>
    </Navbar>
  );
}

export default TopNav;
