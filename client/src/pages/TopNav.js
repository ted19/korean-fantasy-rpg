import React, { useState, useEffect, useCallback } from 'react';
import api from '../api';
import '../srpg/StageBattle.css';

const CLASS_IMAGES = {
  '풍수사': '/characters/pungsu_icon.png',
  '무당': '/characters/mudang_icon.png',
  '승려': '/characters/monk_icon.png',
  '저승사자': '/characters/reaper_icon.png',
};

const CLASS_FULL_IMAGES = {
  '풍수사': '/characters/pungsu_full.png',
  '무당': '/characters/mudang_full.png',
  '승려': '/characters/monk_full.png',
  '저승사자': '/characters/reaper_full.png',
};

const CLASS_ICONS = {
  '풍수사': '⬥',
  '무당': '◈',
  '승려': '◆',
  '저승사자': '☠',
};

const ELEMENT_INFO = {
  fire:    { name: '화(火)', color: '#c87a4a' },
  water:   { name: '수(水)', color: '#5a8ab4' },
  earth:   { name: '지(地)', color: '#7a9a5a' },
  wind:    { name: '풍(風)', color: '#9a7ab4' },
  neutral: { name: '무(無)', color: '#8a7a60' },
};

const MENU_ITEMS_ALL = [
  { id: 'prologue', name: '프롤로그', icon: '/ui/nav_prologue.png', fallback: '📜', prologueOnly: true },
  { id: 'home', name: '홈', icon: '/ui/nav_home.png' },
  { id: 'village', name: '마을', icon: '/ui/nav_village.png', requirePrologue: true },
  { id: 'stage', name: '스테이지', icon: '/ui/nav_stage.png', requirePrologue: true },
  { id: 'dungeon', name: '던전', icon: '/ui/nav_dungeon.png', requirePrologue: true, minLevel: 3 },
  { id: 'special', name: '스페셜', icon: '/ui/nav_special.png', requirePrologue: true, minLevel: 5 },
  { id: 'bestiary', name: '도감', icon: '/ui/nav_bestiary.png', requirePrologue: true },
];

const ELEMENT_AURA = {
  fire: 'flame', water: 'ice', earth: 'aura_gold', wind: 'wind', neutral: 'holy',
  light: 'holy', dark: 'shadow', lightning: 'lightning', poison: 'poison',
};

const BUFF_TYPE_LABELS = {
  attack: '공격력', defense: '방어력', gold: '골드 보너스',
  crit: '치명타율', regen: '재생력', all: '전체 능력',
  exp: '경험치', evasion: '회피율',
};

const STAMINA_INTERVAL = 5 * 60; // 5분 = 300초

function NavIcon({ src, fallback, className }) {
  const [err, setErr] = useState(false);
  if (err) return <span className={className}>{fallback}</span>;
  return <img src={src} alt="" className={className} onError={() => setErr(true)} />;
}

function StaminaDisplay({ stamina, maxStamina, lastStaminaTime }) {
  const [display, setDisplay] = useState({ stamina: stamina ?? 0, countdown: '' });

  const calcStamina = useCallback(() => {
    const baseStamina = stamina ?? 0;
    const max = maxStamina ?? 10;

    if (baseStamina >= max) {
      return { stamina: max, countdown: '' };
    }

    if (!lastStaminaTime) {
      return { stamina: baseStamina, countdown: '' };
    }

    const lastTime = new Date(lastStaminaTime).getTime();
    const now = Date.now();
    const elapsed = Math.max(0, now - lastTime) / 1000; // 초 단위

    const recovered = Math.floor(elapsed / STAMINA_INTERVAL);
    const currentStamina = Math.min(max, baseStamina + recovered);

    if (currentStamina >= max) {
      return { stamina: max, countdown: '' };
    }

    // 다음 회복까지 남은 시간
    const elapsedInCurrent = elapsed - (recovered * STAMINA_INTERVAL);
    const remaining = Math.max(0, Math.ceil(STAMINA_INTERVAL - elapsedInCurrent));
    const mins = Math.floor(remaining / 60);
    const secs = remaining % 60;
    const countdown = `${mins}:${String(secs).padStart(2, '0')}`;

    return { stamina: currentStamina, countdown };
  }, [stamina, maxStamina, lastStaminaTime]);

  useEffect(() => {
    setDisplay(calcStamina());
    const timer = setInterval(() => {
      setDisplay(calcStamina());
    }, 1000);
    return () => clearInterval(timer);
  }, [calcStamina]);

  const max = maxStamina ?? 10;
  const isFull = display.stamina >= max;
  const isLow = display.stamina <= Math.floor(max * 0.3);

  return (
    <span
      className={`top-nav-v2-stat stamina-tag${isFull ? ' full' : ''}${isLow ? ' low' : ''}`}
      title="행동력 (5분마다 1 회복)"
    >
      <span className="stamina-icon">⚡</span>
      <span className="stamina-value">{display.stamina}/{max}</span>
      {display.countdown && (
        <span className="stamina-timer">{display.countdown}</span>
      )}
    </span>
  );
}

function TopNav({ character, charState, currentLocation, onLocationChange, onLogout, onGoToCharacterSelect, prologueCleared, onShowPatchNotes }) {
  const [imgError, setImgError] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [showCharPopup, setShowCharPopup] = useState(false);
  const [showLogoutPopup, setShowLogoutPopup] = useState(false);
  const [charList, setCharList] = useState([]);
  const [charListLoading, setCharListLoading] = useState(false);
  const [equippedCosmetics, setEquippedCosmetics] = useState({});
  const [fortuneBuffs, setFortuneBuffs] = useState([]);
  const [showBuffPopup, setShowBuffPopup] = useState(false);

  useEffect(() => {
    api.get('/shop/cosmetics/equipped').then(r => setEquippedCosmetics(r.data.cosmetics || {})).catch(() => {});
    api.get('/fortune/buffs').then(r => setFortuneBuffs(r.data.buffs || [])).catch(() => {});
  }, [character?.id]);

  // 60초마다 버프 갱신
  useEffect(() => {
    const timer = setInterval(() => {
      api.get('/fortune/buffs').then(r => setFortuneBuffs(r.data.buffs || [])).catch(() => {});
    }, 60000);
    return () => clearInterval(timer);
  }, [character?.id]);

  const playerAura = equippedCosmetics['player']?.effect || ELEMENT_AURA[character?.element] || 'aura_gold';

  const openCharPopup = async () => {
    setShowCharPopup(true);
    setCharListLoading(true);
    try {
      const res = await api.get('/characters/list');
      setCharList(res.data.characters || []);
    } catch (err) {
      console.error('캐릭터 목록 로드 실패:', err);
    }
    setCharListLoading(false);
  };

  const el = ELEMENT_INFO[character.element] || ELEMENT_INFO.neutral;

  return (
    <>
    {showCharPopup && (
      <div className="charpop-overlay" onClick={() => setShowCharPopup(false)}>
        <div className="charpop-panel" onClick={(e) => e.stopPropagation()}>
          {/* 닫기 */}
          <button className="charpop-close" onClick={() => setShowCharPopup(false)}>&times;</button>

          {/* 헤더 */}
          <div className="charpop-header">
            <div className="charpop-header-ornament">— ◆ —</div>
            <h2 className="charpop-header-title">캐릭터 정보</h2>
          </div>

          {/* 현재 캐릭터 상세 */}
          <div className="charpop-current">
            <div className="charpop-portrait-wrap">
              <div className={`cb-portrait-effect cb-effect-${playerAura}`} style={{ position: 'absolute', inset: 0, borderRadius: 'inherit', zIndex: 2, pointerEvents: 'none' }} />
              <img
                src={CLASS_FULL_IMAGES[character.class_type]}
                alt={character.class_type}
                className="charpop-portrait"
                onError={(e) => { e.target.style.display = 'none'; }}
              />
              <div className="charpop-portrait-glow" style={{ background: `radial-gradient(ellipse, ${el.color}25 0%, transparent 70%)` }} />
            </div>
            <div className="charpop-details">
              <div className="charpop-name">{character.name}</div>
              <div className="charpop-class">
                <span className="charpop-class-icon">{CLASS_ICONS[character.class_type]}</span>
                <span>{character.class_type}</span>
              </div>
              <div className="charpop-element" style={{ borderColor: `${el.color}60`, color: el.color }}>
                {el.name}
              </div>
              <div className="charpop-level">Lv.{charState.level}</div>
              <div className="charpop-stats-grid">
                <div className="charpop-stat">
                  <span className="charpop-stat-label">HP</span>
                  <span className="charpop-stat-val hp">{charState.hp ?? '?'}</span>
                </div>
                <div className="charpop-stat">
                  <span className="charpop-stat-label">MP</span>
                  <span className="charpop-stat-val mp">{charState.mp ?? '?'}</span>
                </div>
                <div className="charpop-stat">
                  <span className="charpop-stat-label">ATK</span>
                  <span className="charpop-stat-val atk">{charState.attack ?? '?'}</span>
                </div>
                <div className="charpop-stat">
                  <span className="charpop-stat-label">DEF</span>
                  <span className="charpop-stat-val def">{charState.defense ?? '?'}</span>
                </div>
                <div className="charpop-stat">
                  <span className="charpop-stat-label">GOLD</span>
                  <span className="charpop-stat-val gold">{(charState.gold ?? 0).toLocaleString()}</span>
                </div>
                <div className="charpop-stat">
                  <span className="charpop-stat-label">EXP</span>
                  <span className="charpop-stat-val exp">{charState.exp ?? 0}</span>
                </div>
              </div>
            </div>
          </div>

          {/* 다른 캐릭터 목록 */}
          {charListLoading ? (
            <div className="charpop-loading">불러오는 중...</div>
          ) : charList.length > 1 && (
            <div className="charpop-others">
              <div className="charpop-others-title">보유 캐릭터</div>
              <div className="charpop-others-list">
                {charList.map((c) => {
                  const isCurrent = c.id === character.id;
                  const cel = ELEMENT_INFO[c.element] || ELEMENT_INFO.neutral;
                  return (
                    <div key={c.id} className={`charpop-other-card${isCurrent ? ' current' : ''}`}>
                      <div className="charpop-other-avatar">
                        <img
                          src={CLASS_IMAGES[c.class_type]}
                          alt=""
                          onError={(e) => { e.target.style.display = 'none'; }}
                        />
                      </div>
                      <div className="charpop-other-info">
                        <div className="charpop-other-name">{c.name}</div>
                        <div className="charpop-other-sub">
                          {CLASS_ICONS[c.class_type]} {c.class_type} · Lv.{c.level}
                        </div>
                      </div>
                      <div className="charpop-other-element" style={{ color: cel.color }}>{cel.name}</div>
                      {isCurrent && <div className="charpop-other-current-badge">현재</div>}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* 하단 버튼 */}
          <div className="charpop-actions">
            <button className="charpop-btn-close" onClick={() => setShowCharPopup(false)}>닫기</button>
            <button className="charpop-btn-switch" onClick={() => { setShowCharPopup(false); onGoToCharacterSelect(); }}>
              캐릭터 선택 화면으로
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M5 12h14M12 5l7 7-7 7"/>
              </svg>
            </button>
          </div>
        </div>
      </div>
    )}
    {showLogoutPopup && (
      <div className="logout-popup-overlay" onClick={() => setShowLogoutPopup(false)}>
        <div className="logout-popup" onClick={(e) => e.stopPropagation()}>
          <div className="logout-popup-character">
            <img
              src={CLASS_FULL_IMAGES[character.class_type]}
              alt=""
              className="logout-popup-char-img"
              onError={(e) => { e.target.style.display = 'none'; }}
            />
            <div className="logout-popup-char-glow" />
          </div>
          <div className="logout-popup-content">
            <div className="logout-popup-ornament">— ◆ —</div>
            <div className="logout-popup-title">모험을 떠나시겠습니까?</div>
            <div className="logout-popup-msg">
              <span className="logout-popup-name">{character.name}</span> 님,
              정말 마을을 떠나시겠습니까?
            </div>
            <div className="logout-popup-stats">
              <span>Lv.{charState.level} {character.class_type}</span>
              <span>·</span>
              <span>골드 {(charState.gold ?? 0).toLocaleString()}</span>
            </div>
            <div className="logout-popup-buttons">
              <button className="logout-popup-btn cancel" onClick={() => setShowLogoutPopup(false)}>
                머무르기
              </button>
              <button className="logout-popup-btn confirm" onClick={() => { setShowLogoutPopup(false); onLogout(); }}>
                떠나기
              </button>
            </div>
          </div>
        </div>
      </div>
    )}
    {showBuffPopup && fortuneBuffs.length > 0 && (
      <div className="fortune-popup-overlay" onClick={() => setShowBuffPopup(false)}>
        <div className="fortune-popup" onClick={e => e.stopPropagation()}>
          <div className="fortune-popup-header">
            <span>🔮 활성 버프</span>
            <button className="fortune-popup-close" onClick={() => setShowBuffPopup(false)}>&times;</button>
          </div>
          <div className="fortune-popup-list">
            {fortuneBuffs.map((b, i) => (
              <div key={i} className="fortune-popup-item">
                <span className="fortune-popup-icon">{b.icon || '✨'}</span>
                <div className="fortune-popup-info">
                  <span className="fortune-popup-type">{BUFF_TYPE_LABELS[b.buff_type] || b.buff_type}</span>
                  <span className="fortune-popup-val">+{b.buff_value}</span>
                </div>
                <span className="fortune-popup-remain">{b.remaining_battles}전투</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    )}
    <nav className="top-nav-v2" style={currentLocation === 'prologue' ? { display: 'none' } : undefined}>
      {/* 배경 장식 */}
      <div className="top-nav-v2-bg" style={{ backgroundImage: 'url(/ui/nav_bg.png)', backgroundSize: 'cover', backgroundPosition: 'center' }} />

      <div className="top-nav-v2-inner">
        {/* 왼쪽: 로고 + 프로필 */}
        <div className="top-nav-v2-left">
          <div className="top-nav-v2-logo">
            <img src="/ui/game_logo.png" alt="logo" onError={(e) => { e.target.style.display = 'none'; }} />
          </div>
          <div className="top-nav-v2-profile">
            <div className="top-nav-v2-avatar" onClick={openCharPopup} title="캐릭터 정보">
              <div className={`cb-portrait-effect cb-effect-${playerAura}`} style={{ position: 'absolute', inset: 0, borderRadius: '50%', zIndex: 2, pointerEvents: 'none' }} />
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
                <StaminaDisplay
                  stamina={charState.stamina}
                  maxStamina={charState.maxStamina}
                  lastStaminaTime={charState.lastStaminaTime}
                />
                {fortuneBuffs.length > 0 && (
                  <span
                    className="top-nav-v2-stat fortune-tag"
                    onClick={() => setShowBuffPopup(v => !v)}
                    title="운명술사 버프"
                  >
                    <span className="fortune-tag-icon">🔮</span>
                    <span className="fortune-tag-count">{fortuneBuffs.length}</span>
                  </span>
                )}
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
          {MENU_ITEMS_ALL
            .filter(item => {
              // 프롤로그 미완료: 홈+프롤로그만 표시
              if (!prologueCleared) {
                return item.id === 'home' || item.id === 'prologue';
              }
              // 프롤로그 완료: 프롤로그 메뉴 숨김
              if (item.prologueOnly) return false;
              // 레벨 조건
              if (item.minLevel && charState.level < item.minLevel) return false;
              return true;
            })
            .map((item) => (
            <button
              key={item.id}
              className={`top-nav-v2-btn${currentLocation === item.id ? ' active' : ''}`}
              onClick={() => { onLocationChange(item.id); setMenuOpen(false); }}
            >
              <div className="top-nav-v2-btn-icon-wrap">
                <NavIcon src={item.icon} fallback={item.fallback || '?'} className="top-nav-v2-btn-icon" />
                {currentLocation === item.id && <div className="top-nav-v2-btn-glow" />}
              </div>
              <span className="top-nav-v2-btn-name">{item.name}</span>
            </button>
          ))}
          {onShowPatchNotes && (
            <button className="top-nav-v2-btn patch-notes" onClick={() => { onShowPatchNotes(); setMenuOpen(false); }}>
              <div className="top-nav-v2-btn-icon-wrap">
                <span className="top-nav-v2-btn-icon" style={{ fontSize: '18px' }}>📋</span>
                {!localStorage.getItem('patchNotes_v11') && <div className="top-nav-patch-dot" />}
              </div>
              <span className="top-nav-v2-btn-name">패치</span>
            </button>
          )}
          <button className="top-nav-v2-btn logout" onClick={() => { setShowLogoutPopup(true); setMenuOpen(false); }}>
            <div className="top-nav-v2-btn-icon-wrap">
              <NavIcon src="/ui/logout_icon.png" fallback="🚪" className="top-nav-v2-btn-icon" />
            </div>
            <span className="top-nav-v2-btn-name">나가기</span>
          </button>
        </div>
      </div>
    </nav>
    </>
  );
}

export default TopNav;
