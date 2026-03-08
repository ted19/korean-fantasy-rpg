import React, { useState, useRef, useEffect } from 'react';
import { getWeaponInfo } from './battleEngine';

/* ========== UnitImg: 이미지 로드 실패시 fallback 체인 ========== */
function UnitImg({ src, fallbackSrc, fallback, className, style }) {
  const [imgStage, setImgStage] = useState(0);
  const prevSrcRef = useRef(src);
  if (prevSrcRef.current !== src) {
    prevSrcRef.current = src;
    setImgStage(0);
  }
  const imgSrc = imgStage === 0 ? src : imgStage === 1 ? fallbackSrc : null;
  if (!imgSrc) return <span className={className || 'pm2d-unit-icon-text'} style={style}>{fallback || '?'}</span>;
  return <img src={imgSrc} alt="" className={className} style={style} onError={() => {
    if (imgStage === 0 && fallbackSrc) setImgStage(1);
    else setImgStage(2);
  }} />;
}

/* ========== 유닛 스프라이트 이미지 URL ========== */
function getUnitImage(unit) {
  if (unit.id === 'player') {
    const classKey = { '풍수사': 'pungsu', '무당': 'mudang', '승려': 'monk', '저승사자': 'reaper' };
    const key = classKey[unit.classType];
    return { src: key ? `/tower_sprites/${key}.png` : null, fallbackSrc: key ? `/characters/${key}_icon.png` : null };
  }
  if (unit.id.startsWith('summon_')) {
    const tid = unit.templateId || unit.summonId;
    return { src: tid ? `/tower_sprites/summon_${tid}.png` : null, fallbackSrc: unit.imageUrl || (tid ? `/summons/${tid}_icon.png` : null) };
  }
  if (unit.id.startsWith('merc_')) {
    const tid = unit.templateId || unit.mercId;
    return { src: tid ? `/tower_sprites/merc_${tid}.png` : null, fallbackSrc: unit.imageUrl || (tid ? `/mercenaries/${tid}_icon.png` : null) };
  }
  if (unit.monsterId) {
    return { src: `/tower_sprites/monster_${unit.monsterId}.png`, fallbackSrc: `/monsters/${unit.monsterId}_icon.png` };
  }
  return { src: null, fallbackSrc: null };
}

/* ========== 타일 배경 이미지 URL ========== */
function getTileBg() {
  return '/textures/tile_goblin_bush.png';
}

/* ========== HP 비율 클래스 ========== */
function hpClass(u) {
  const pct = u.hp / u.maxHp;
  if (pct > 0.5) return 'high';
  if (pct > 0.25) return 'mid';
  return 'low';
}

/* ========== PixelMap2D: 2D 픽셀아트 그리드 맵 ========== */
export default function PixelMap2D({
  mapData,
  units,
  activeUnit,
  movableRange,
  attackRange,
  selectedTile,
  onTileClick,
  damagePopups,
  skillEffects,
  menuState,
  onMenuAction,
  onCanvasMiss,
  potions,
  location,
  movingUnit,
}) {
  const [hitEffects, setHitEffects] = useState([]);
  const [shakeUnit, setShakeUnit] = useState(null);
  const [deadUnits, setDeadUnits] = useState(new Set());
  const effectIdRef = useRef(0);
  const prevUnitsRef = useRef([]);

  // 드래그 팬 (맵 영역 밖에서만) + 줌 (휠)
  const areaRef = useRef(null);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const dragRef = useRef({ dragging: false, startX: 0, startY: 0, panX: 0, panY: 0 });

  const handleAreaPointerDown = (e) => {
    if (e.button !== 0) return;
    // 맵 영역(pm2d-area) 자체를 클릭했을 때만 드래그 시작
    if (e.target !== areaRef.current) return;
    dragRef.current = { dragging: true, startX: e.clientX, startY: e.clientY, panX: pan.x, panY: pan.y };
    e.currentTarget.setPointerCapture(e.pointerId);
  };
  const handleAreaPointerMove = (e) => {
    if (!dragRef.current.dragging) return;
    setPan({ x: dragRef.current.panX + (e.clientX - dragRef.current.startX), y: dragRef.current.panY + (e.clientY - dragRef.current.startY) });
  };
  const handleAreaPointerUp = () => {
    dragRef.current.dragging = false;
  };
  const handleWheel = (e) => {
    e.preventDefault();
    setZoom(prev => Math.min(2, Math.max(0.3, prev + (e.deltaY < 0 ? 0.1 : -0.1))));
  };
  useEffect(() => {
    const el = areaRef.current;
    if (!el) return;
    el.addEventListener('wheel', handleWheel, { passive: false });
    return () => el.removeEventListener('wheel', handleWheel);
  }, []);

  // 유닛 HP 변화 감지 → 히트 이펙트 + 셰이크 + 공격 연출
  useEffect(() => {
    const prevUnits = prevUnitsRef.current;
    if (prevUnits.length === 0) { prevUnitsRef.current = units; return; }

    // attackAnim이 새로 설정된 유닛들 수집 (공격자들)
    const newAttackers = [];
    units.forEach(u => {
      const prev = prevUnits.find(p => p.id === u.id);
      if (!prev) return;
      if (u.attackAnim && (!prev.attackAnim || prev.attackAnim.tx !== u.attackAnim.tx || prev.attackAnim.tz !== u.attackAnim.tz)) {
        newAttackers.push(u);
      }
    });

    // 공격자별 타겟ID 맵 구축 (attackAnim.tx/tz → 해당 좌표의 유닛 ID)
    // 정확한 타겟 매칭을 위해 현재 좌표 + 이전 좌표 모두 확인
    const attackerTargetMap = new Map(); // attackerId → targetUnitId
    newAttackers.forEach(atk => {
      const tx = atk.attackAnim.tx;
      const tz = atk.attackAnim.tz;
      // 현재 좌표로 찾기
      let target = units.find(u => u.id !== atk.id && u.x === tx && u.z === tz);
      // 못 찾으면 이전 좌표로 찾기 (이동 전 스냅샷)
      if (!target) target = prevUnits.find(u => u.id !== atk.id && u.x === tx && u.z === tz);
      if (target) attackerTargetMap.set(atk.id, target.id);
    });

    // 공격 발사 이펙트 (공격자→대상 방향): 피격 유닛의 현재 좌표에 표시
    newAttackers.forEach(u => {
      const targetId = attackerTargetMap.get(u.id);
      const targetUnit = targetId ? units.find(t => t.id === targetId) : null;
      // 타겟의 현재 좌표 사용 (이동했을 수 있으므로)
      const fx_x = targetUnit ? targetUnit.x : u.attackAnim.tx;
      const fx_z = targetUnit ? targetUnit.z : u.attackAnim.tz;

      const wt = u.weaponType || 'default';
      const isRanged = ['bow', 'talisman', 'staff', 'bell'].includes(wt);
      const isMagic = ['staff', 'bell', 'talisman'].includes(wt);
      const fxType = isMagic ? 'magic-proj' : isRanged ? 'arrow-proj' : 'melee-rush';
      const id = ++effectIdRef.current;
      setHitEffects(prev2 => [...prev2.slice(-8), { id, x: fx_x, z: fx_z, type: fxType, fromX: u.x, fromZ: u.z }]);
      setTimeout(() => setHitEffects(prev2 => prev2.filter(e => e.id !== id)), 500);
    });

    // HP 변화 감지 → 피격 이펙트 (피격 유닛의 현재 좌표에 정확히 표시)
    units.forEach(u => {
      const prev = prevUnits.find(p => p.id === u.id);
      if (!prev) return;
      if (u.hp < prev.hp && u.hp >= 0) {
        setShakeUnit(u.id);
        setTimeout(() => setShakeUnit(null), 300);
        // 이 유닛을 타겟으로 하는 공격자 찾기 (ID 기반 매칭 - 좌표 비교보다 정확)
        const attackers = newAttackers.filter(a => attackerTargetMap.get(a.id) === u.id);
        if (attackers.length > 0) {
          // 각 공격자별로 피격 이펙트 (협공 포함) - 유닛의 현재 좌표에 표시
          attackers.forEach(attacker => {
            const wt = attacker.weaponType || 'default';
            const hitType = ['staff','bell','talisman'].includes(wt) ? 'magic' : ['bow'].includes(wt) ? 'arrow-hit' : 'slash';
            const id = ++effectIdRef.current;
            setHitEffects(prev2 => [...prev2.slice(-8), { id, x: u.x, z: u.z, type: hitType, fromX: attacker.x, fromZ: attacker.z }]);
            setTimeout(() => setHitEffects(prev2 => prev2.filter(e => e.id !== id)), 450);
          });
        } else {
          // 공격자를 찾을 수 없으면 기본 slash 이펙트 (유닛 현재 좌표)
          const id = ++effectIdRef.current;
          setHitEffects(prev2 => [...prev2.slice(-8), { id, x: u.x, z: u.z, type: 'slash' }]);
          setTimeout(() => setHitEffects(prev2 => prev2.filter(e => e.id !== id)), 450);
        }
      }
      if (u.hp > prev.hp) {
        const id = ++effectIdRef.current;
        setHitEffects(prev2 => [...prev2.slice(-8), { id, x: u.x, z: u.z, type: 'heal-fx' }]);
        setTimeout(() => setHitEffects(prev2 => prev2.filter(e => e.id !== id)), 400);
      }
      if (u.hp <= 0 && prev.hp > 0) {
        setDeadUnits(s => new Set([...s, u.id]));
      }
    });
    prevUnitsRef.current = units;
  }, [units]);

  if (!mapData) return null;

  const movableSet = new Set((movableRange || []).map(r => `${r.x},${r.z}`));
  const attackSet = new Set((attackRange || []).map(r => `${r.x},${r.z}`));
  const isSkillRange = menuState?.mode === 'skills' || attackRange?.length > 0;

  // 유닛 위치 맵
  const unitMap = {};
  units.filter(u => u.hp > 0 || deadUnits.has(u.id)).forEach(u => { unitMap[`${u.x},${u.z}`] = u; });

  const handleClick = (tile) => {
    if (onTileClick) onTileClick(tile);
  };

  const handleBgClick = (e) => {
    if (e.target === e.currentTarget && onCanvasMiss) onCanvasMiss();
  };

  return (
    <div
      className="pm2d-area"
      ref={areaRef}
      onClick={handleBgClick}
      onPointerDown={handleAreaPointerDown}
      onPointerMove={handleAreaPointerMove}
      onPointerUp={handleAreaPointerUp}
    >
      <div
        className="pm2d-grid"
        style={{
          gridTemplateColumns: `repeat(${mapData.width}, 104px)`,
          gridTemplateRows: `repeat(${mapData.height}, 104px)`,
          transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
          transformOrigin: 'center center',
        }}
      >
        {/* 타일 레이어: 지형 + 장애물만 (유닛 없음) */}
        {mapData.tiles.map((tile, i) => {
          const key = `${tile.x},${tile.z}`;
          const unit = unitMap[key];
          const isMovable = movableSet.has(key);
          const isAttackable = attackSet.has(key);
          const isWall = tile.tileKey === 'wall';
          const TILE_CLASS_MAP = { wall:'wall', water:'water', danger:'water', special:'special', accent1:'accent1', accent2:'accent2', ice:'ice', poison:'poison', holy:'holy', thorns:'thorns', wind:'wind', lava:'lava', shadow:'shadow', crystal:'crystal' };
          const tileColorClass = TILE_CLASS_MAP[tile.tileKey] || 'floor';
          const OBSTACLE_TILES = new Set(['wall','water','danger','special','accent2','ice','poison','holy','thorns','wind','lava','shadow','crystal']);
          const hasObstacle = OBSTACLE_TILES.has(tile.tileKey);
          const TILE_TOOLTIPS = { wall:'🪨 바위 (이동 불가)', water:'💧 물 (마공 +3)', danger:'🔥 위험 (HP -8%)', special:'✦ 룬 (HP +10%)', accent2:'🪨 돌 (방어 +3)', ice:'🧊 빙결 (회피 -5)', poison:'☠️ 독 (HP -5%)', holy:'🕊️ 신성 (HP +6%)', thorns:'🌿 가시 (HP -4%)', wind:'🌀 바람 (회피 +5)', lava:'🌋 용암 (HP -12%)', shadow:'🌑 그림자 (치명타 +5)', crystal:'💎 수정 (마방 +4)' };
          const tileTooltip = TILE_TOOLTIPS[tile.tileKey] || '';
          const tileBgUrl = getTileBg();
          return (
            <div
              key={i}
              className={`pm2d-tile pm2d-${tileColorClass} ${tile.height > 0 ? `h${Math.min(tile.height, 3)}` : ''} ${isMovable ? 'move-range' : ''} ${isAttackable ? (isSkillRange ? 'skill-range' : 'atk-range') : ''} ${unit && activeUnit && unit.id === activeUnit.id ? 'selected-tile' : ''} ${isWall ? 'pm2d-wall' : ''}`}
              style={{ backgroundImage: `url(${tileBgUrl})`, backgroundSize: 'cover', backgroundPosition: 'center' }}
              title={tileTooltip}
              onClick={() => handleClick(tile)}
            >
              {hasObstacle && <div className={`pm2d-obstacle pm2d-obs-${tile.tileKey}`} />}
            </div>
          );
        })}

        {/* ===== 유닛 오버레이 레이어 (타일 위, 별도 absolute layer) ===== */}
        <div className="pm2d-unit-layer" style={{ width: mapData.width * 104, height: mapData.height * 104 }}>
          {/* 유닛 렌더 */}
          {units.filter(u => (u.hp > 0 || deadUnits.has(u.id)) && !(movingUnit && movingUnit.id === u.id)).map(u => {
            const isDead = deadUnits.has(u.id) && u.hp <= 0;
            const left = u.x * 104;
            const top = u.z * 104;
            // 유닛 클릭 → 해당 좌표의 타일 클릭으로 전달
            const unitTile = mapData.tiles.find(t => t.x === u.x && t.z === u.z);
            return (
              <div
                key={u.id}
                className={`pm2d-unit ${u.team === 'player' ? 'ally' : 'enemy'} ${activeUnit && u.id === activeUnit.id ? 'active-unit' : ''} ${u.acted ? 'acted' : ''} ${isDead ? 'dead-unit' : ''} ${shakeUnit === u.id ? 'shake' : ''} ${u.eliteTier ? 'elite' : ''}`}
                style={{ left: left + 52, top: top + 52, ...(u.eliteTier ? { '--elite-color': u.eliteTier.color } : {}) }}
                onClick={() => unitTile && handleClick(unitTile)}
              >
                <div className="pm2d-unit-aura" />
                {u.eliteTier && <div className="pm2d-elite-badge">{u.eliteTier.icon}</div>}
                <UnitImg src={getUnitImage(u).src} fallbackSrc={getUnitImage(u).fallbackSrc} fallback={u.icon} className="pm2d-unit-sprite" />
                <div className="pm2d-unit-hp-bar">
                  <div className={`pm2d-unit-hp-fill ${hpClass(u)}`} style={{ width: `${Math.max(0, u.hp / u.maxHp * 100)}%` }} />
                </div>
                {u.maxMp > 0 && (
                  <div className="pm2d-unit-mp-bar">
                    <div className="pm2d-unit-mp-fill" style={{ width: `${Math.max(0, u.mp / u.maxMp * 100)}%` }} />
                  </div>
                )}
                <div className="pm2d-unit-name">{u.eliteTier ? `${u.eliteTier.icon} ` : ''}{u.name}</div>
              </div>
            );
          })}

          {/* 걷기 애니메이션 */}
          {movingUnit && (() => {
            const mu = units.find(u => u.id === movingUnit.id);
            if (!mu) return null;
            const { src, fallbackSrc } = getUnitImage(mu);
            return (
              <div
                className={`pm2d-walking-unit ${mu.team === 'player' ? 'ally' : 'enemy'}`}
                style={{
                  '--from-x': `${movingUnit.fromX * 104 + 52}px`,
                  '--from-y': `${movingUnit.fromZ * 104 + 52}px`,
                  '--to-x': `${movingUnit.toX * 104 + 52}px`,
                  '--to-y': `${movingUnit.toZ * 104 + 52}px`,
                }}
              >
                <UnitImg src={src} fallbackSrc={fallbackSrc} fallback={mu.icon} className="pm2d-unit-sprite" />
              </div>
            );
          })()}

          {/* 히트 이펙트 */}
          {hitEffects.map(e => {
            let rotStyle = {};
            if (e.fromX !== undefined && e.fromZ !== undefined) {
              const dx = e.x - e.fromX;
              const dz = e.z - e.fromZ;
              const angle = Math.atan2(dz, dx) * (180 / Math.PI);
              rotStyle = { '--fx-angle': `${angle}deg` };
            }
            return (
              <div key={e.id} className={`pm2d-hit-fx ${e.type}`} style={{ left: e.x * 104 + 52, top: e.z * 104 + 42, ...rotStyle }} />
            );
          })}

          {/* 데미지 팝업 */}
          {(damagePopups || []).map((p, j) => (
            <div key={`popup-${p.time}-${j}`} className={`pm2d-dmg-popup ${p.type}`} style={{ left: p.x * 104 + 52, top: p.z * 104 + 20 }}>{p.text}</div>
          ))}
        </div>
      </div>

      {/* 컨텍스트 메뉴 (활성 유닛 위에 표시) */}
      {activeUnit && menuState && menuState.show && (
        <PixelCtxMenu
          unit={activeUnit}
          menuState={menuState}
          onAction={onMenuAction}
          potions={potions}
          mapData={mapData}
        />
      )}
    </div>
  );
}

/* ========== 컨텍스트 메뉴 (2D 오버레이) ========== */
function PixelCtxMenu({ unit, menuState, onAction, potions, mapData }) {
  const menuRef = useRef(null);
  const [pos, setPos] = useState({ left: 0, top: 0 });

  useEffect(() => {
    // 유닛의 그리드 위치로부터 화면 위치 계산
    const grid = document.querySelector('.pm2d-grid');
    if (!grid) return;
    const tileEls = grid.querySelectorAll('.pm2d-tile');
    const tileIdx = mapData.tiles.findIndex(t => t.x === unit.x && t.z === unit.z);
    if (tileIdx < 0 || !tileEls[tileIdx]) return;
    const tileRect = tileEls[tileIdx].getBoundingClientRect();
    const areaRect = grid.parentElement.getBoundingClientRect();
    setPos({
      left: tileRect.left - areaRect.left + tileRect.width + 4,
      top: tileRect.top - areaRect.top - 10,
    });
  }, [unit.x, unit.z, mapData]);

  const skills = unit.skills || [];
  const hasPotions = (potions || []).length > 0;

  if (menuState.mode === 'skills') {
    return (
      <div className="srpg-ctx-menu" ref={menuRef} style={{ position: 'absolute', left: pos.left, top: pos.top, zIndex: 30 }}>
        <button className="srpg-ctx-btn back" onClick={() => onAction('back')}>← 돌아가기</button>
        {skills.map(sk => {
          const cd = unit.skillCooldowns?.[sk.id] || 0;
          const noMp = (sk.mp_cost || 0) > unit.mp;
          return (
            <button
              key={sk.id}
              className={`srpg-ctx-btn skill-item ${cd > 0 || noMp ? 'disabled' : ''}`}
              disabled={cd > 0 || noMp}
              onClick={() => !(cd > 0 || noMp) && onAction('skill', sk)}
            >
              {sk.icon && <img src={`/skills/${sk.id}_icon.png`} alt="" className="srpg-ctx-skill-icon" onError={e => e.target.style.display='none'} />}
              <span>{sk.icon || '✦'} {sk.name}</span>
              <span className="srpg-ctx-mp">{cd > 0 ? `CD:${cd}` : `MP ${sk.mp_cost || 0}`}</span>
            </button>
          );
        })}
      </div>
    );
  }

  if (menuState.mode === 'items') {
    const pots = (potions || []).filter(p => p.quantity > 0);
    return (
      <div className="srpg-ctx-menu" ref={menuRef} style={{ position: 'absolute', left: pos.left, top: pos.top, zIndex: 30 }}>
        <button className="srpg-ctx-btn back" onClick={() => onAction('back')}>← 돌아가기</button>
        {pots.length === 0 && <div className="srpg-ctx-empty">소지한 물약이 없습니다</div>}
        {pots.map(p => (
          <button
            key={p.item_id}
            className={`srpg-ctx-btn item-entry ${p.effect_hp > 0 ? 'hp' : 'mp'}`}
            onClick={() => onAction('useItem', p)}
          >
            <span className="srpg-ctx-item-name">{p.icon || '🧪'} {p.name}</span>
            <span className="srpg-ctx-item-qty">x{p.quantity}</span>
          </button>
        ))}
      </div>
    );
  }

  // main menu
  return (
    <div className="srpg-ctx-menu" ref={menuRef} style={{ position: 'absolute', left: pos.left, top: pos.top, zIndex: 30 }}>
      <button className="srpg-ctx-btn move" disabled={unit.moved} onClick={() => onAction('move')}>
        이동 {unit.moved && '(완료)'}
      </button>
      <button className="srpg-ctx-btn attack" onClick={() => onAction('attack')}>
        공격
        {unit.weaponType && unit.weaponType !== 'default' && (
          <span className="srpg-ctx-mp">{getWeaponInfo(unit.weaponType).label}</span>
        )}
      </button>

      {skills.length > 0 && (
        <button className="srpg-ctx-btn skill" onClick={() => onAction('showSkills')}>
          스킬 ({skills.length})
        </button>
      )}
      {hasPotions && unit.id === 'player' && (
        <button className="srpg-ctx-btn items" onClick={() => onAction('showItems')}>
          물약 <span className="srpg-ctx-item-count">{potions.filter(p => p.quantity > 0).length}</span>
        </button>
      )}
      <button className="srpg-ctx-btn wait" onClick={() => onAction('wait')}>대기</button>
    </div>
  );
}
