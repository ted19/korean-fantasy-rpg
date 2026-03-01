import React, { useState, useEffect, useCallback } from 'react';
import { Row, Col, Card, Badge } from 'react-bootstrap';
import api from '../api';

const SLOT_CONFIG = [
  { id: 'helmet', name: '투구', icon: '🪖', img: '/ui/slot_helmet.png', row: 1, col: 2 },
  { id: 'weapon', name: '무기', icon: '⚔️', img: '/ui/slot_weapon.png', row: 2, col: 1 },
  { id: 'chest', name: '갑옷', icon: '🛡️', img: '/ui/slot_chest.png', row: 2, col: 2 },
  { id: 'shield', name: '방패', icon: '🛡️', img: '/ui/slot_shield.png', row: 2, col: 3 },
  { id: 'ring', name: '반지', icon: '💍', img: '/ui/slot_ring.png', row: 3, col: 1 },
  { id: 'boots', name: '장화', icon: '👢', img: '/ui/slot_boots.png', row: 3, col: 2 },
  { id: 'necklace', name: '목걸이', icon: '📿', img: '/ui/slot_necklace.png', row: 3, col: 3 },
];

const TYPE_ICONS = {
  weapon: '⚔️',
  chest: '🛡️',
  helmet: '🪖',
  boots: '👢',
  ring: '💍',
  necklace: '📿',
  shield: '🛡️',
  potion: '🧪',
};

const GRADE_COLORS = {
  '일반': '#aaa',
  '고급': '#4ade80',
  '희귀': '#60a5fa',
  '영웅': '#c084fc',
  '전설': '#fbbf24',
  '신화': '#ff6b6b',
};

function EquipImg({ itemId, fallback, className }) {
  const [err, setErr] = useState(false);
  if (err || !itemId) return <span className={className}>{fallback}</span>;
  return <img src={`/equipment/${itemId}_icon.png`} alt="" className={className} onError={() => setErr(true)} />;
}

function Equipment({ character, charState, onCharStateUpdate, onLog }) {
  const [equipped, setEquipped] = useState({});
  const [inventory, setInventory] = useState([]);
  const [materials, setMaterials] = useState([]);
  const [invTab, setInvTab] = useState('equip'); // 'equip' or 'materials'
  const [dragItem, setDragItem] = useState(null);
  const [dragOverSlot, setDragOverSlot] = useState(null);
  const [tooltip, setTooltip] = useState(null);
  const [invTooltip, setInvTooltip] = useState(null);

  const loadData = useCallback(async () => {
    try {
      const [equipRes, matRes] = await Promise.all([
        api.get('/equipment/info'),
        api.get('/blacksmith/materials'),
      ]);
      setEquipped(equipRes.data.equipped);
      setInventory(equipRes.data.inventory);
      setMaterials(matRes.data.materials || []);
    } catch {
      onLog('장비 정보를 불러올 수 없습니다.', 'damage');
    }
  }, [onLog]);

  useEffect(() => { loadData(); }, [loadData]);

  const handleEquip = async (itemId, slot) => {
    try {
      const res = await api.post('/equipment/equip', { itemId, slot });
      onLog(res.data.message, 'system');
      const c = res.data.character;
      onCharStateUpdate({
        maxHp: c.hp, maxMp: c.mp,
        attack: c.attack, defense: c.defense,
        physAttack: c.phys_attack, physDefense: c.phys_defense,
        magAttack: c.mag_attack, magDefense: c.mag_defense,
        critRate: c.crit_rate, evasion: c.evasion,
        currentHp: c.current_hp, currentMp: c.current_mp,
        gold: c.gold,
      });
      loadData();
    } catch (err) {
      onLog(err.response?.data?.message || '장착 실패', 'damage');
    }
  };

  const handleUnequip = async (slot) => {
    try {
      const res = await api.post('/equipment/unequip', { slot });
      onLog(res.data.message, 'system');
      const c = res.data.character;
      onCharStateUpdate({
        maxHp: c.hp, maxMp: c.mp,
        attack: c.attack, defense: c.defense,
        physAttack: c.phys_attack, physDefense: c.phys_defense,
        magAttack: c.mag_attack, magDefense: c.mag_defense,
        critRate: c.crit_rate, evasion: c.evasion,
        currentHp: c.current_hp, currentMp: c.current_mp,
        gold: c.gold,
      });
      loadData();
    } catch (err) {
      onLog(err.response?.data?.message || '해제 실패', 'damage');
    }
  };

  const onDragStart = (e, item) => {
    setDragItem(item);
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', item.item_id);
  };

  const onDragOver = (e, slotId) => {
    e.preventDefault();
    if (dragItem && dragItem.slot === slotId) {
      e.dataTransfer.dropEffect = 'move';
      setDragOverSlot(slotId);
    }
  };

  const onDragLeave = () => {
    setDragOverSlot(null);
  };

  const onDrop = (e, slotId) => {
    e.preventDefault();
    setDragOverSlot(null);
    if (dragItem && dragItem.slot === slotId) {
      handleEquip(dragItem.item_id, slotId);
    }
    setDragItem(null);
  };

  const onDragEnd = () => {
    setDragItem(null);
    setDragOverSlot(null);
  };

  const weaponIs2h = equipped.weapon?.weapon_hand === '2h';

  // 장비 보너스 합산
  const equipBonus = { hp: 0, mp: 0, attack: 0, defense: 0, physAttack: 0, physDefense: 0, magAttack: 0, magDefense: 0, critRate: 0, evasion: 0 };
  Object.values(equipped).forEach((item) => {
    if (!item) return;
    equipBonus.hp += item.effect_hp || 0;
    equipBonus.mp += item.effect_mp || 0;
    equipBonus.attack += item.effect_attack || 0;
    equipBonus.defense += item.effect_defense || 0;
    equipBonus.physAttack += item.effect_phys_attack || 0;
    equipBonus.physDefense += item.effect_phys_defense || 0;
    equipBonus.magAttack += item.effect_mag_attack || 0;
    equipBonus.magDefense += item.effect_mag_defense || 0;
    equipBonus.critRate += item.effect_crit_rate || 0;
    equipBonus.evasion += item.effect_evasion || 0;
  });

  const formatBonus = (val) => {
    if (val > 0) return <span style={{ color: 'var(--green)', fontSize: 12 }}>(+{val})</span>;
    if (val < 0) return <span style={{ color: 'var(--red)', fontSize: 12 }}>({val})</span>;
    return null;
  };

  return (
    <Row className="equip-container g-3">
      <Col xs={12} lg={4} className="mb-3">
        <Card className="equip-card">
          <div className="equip-card-bg" style={{ position:'absolute', inset:0, background:'url(/ui/equip_panel_bg.png) center/cover no-repeat', opacity:0.08, pointerEvents:'none' }} />
          <Card.Body style={{ position:'relative' }}>
            <div className="equip-panel">
              <div className="equip-panel-title">{character.name}</div>
              <div className="text-center" style={{ color: 'var(--text-muted)', fontSize: 13, marginTop: -10, marginBottom: 14 }}>
                {character.class_type}
              </div>

              <div className="equip-slots-grid">
                {SLOT_CONFIG.map((slot) => {
                  const item = equipped[slot.id];
                  const isLocked = slot.id === 'shield' && weaponIs2h;
                  const isOver = dragOverSlot === slot.id;
                  const canDrop = dragItem && dragItem.slot === slot.id && !isLocked;

                  return (
                    <div
                      key={slot.id}
                      className={`equip-slot ${item ? 'filled' : ''} ${isLocked ? 'locked' : ''} ${isOver && canDrop ? 'drag-over' : ''}`}
                      style={{ gridRow: slot.row, gridColumn: slot.col }}
                      onDragOver={(e) => !isLocked && onDragOver(e, slot.id)}
                      onDragLeave={onDragLeave}
                      onDrop={(e) => !isLocked && onDrop(e, slot.id)}
                      onClick={() => item && handleUnequip(slot.id)}
                      onMouseEnter={() => item && setTooltip({ ...item, slotName: slot.name })}
                      onMouseLeave={() => setTooltip(null)}
                    >
                      {item ? (
                        <div className="equip-slot-item">
                          <EquipImg itemId={item.item_id} fallback={TYPE_ICONS[item.type] || slot.icon} className="equip-slot-img" />
                          <span className="equip-slot-name">{item.name}</span>
                        </div>
                      ) : (
                        <div className="equip-slot-empty">
                          <img src={slot.img} alt="" className="equip-slot-placeholder" onError={(e) => { e.target.style.display='none'; e.target.nextSibling && (e.target.nextSibling.style.display=''); }} />
                          <span className="equip-slot-icon empty" style={{ display: 'none' }}>{slot.icon}</span>
                          <span className="equip-slot-label">
                            {isLocked ? '양손무기' : slot.name}
                          </span>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>

              {tooltip && (
                <div className="equip-tooltip">
                  <div className="tooltip-name">{tooltip.name}</div>
                  <div className="tooltip-desc">{tooltip.description}</div>
                  <div className="tooltip-stats">
                    {tooltip.effect_hp !== 0 && <span className="ts hp">HP+{tooltip.effect_hp}</span>}
                    {tooltip.effect_mp !== 0 && <span className="ts mp">MP+{tooltip.effect_mp}</span>}
                    {!!tooltip.effect_phys_attack && <span className="ts atk">물공+{tooltip.effect_phys_attack}</span>}
                    {!!tooltip.effect_mag_attack && <span className="ts atk">마공+{tooltip.effect_mag_attack}</span>}
                    {!!tooltip.effect_phys_defense && <span className="ts def">물방+{tooltip.effect_phys_defense}</span>}
                    {!!tooltip.effect_mag_defense && <span className="ts def">마방+{tooltip.effect_mag_defense}</span>}
                    {!!tooltip.effect_crit_rate && <span className="ts atk">치명+{tooltip.effect_crit_rate}</span>}
                    {!!tooltip.effect_evasion && <span className="ts def">회피+{tooltip.effect_evasion}</span>}
                  </div>
                  <div className="tooltip-hint">클릭하여 해제</div>
                </div>
              )}

              {/* 스탯 표시 */}
              <div className="equip-stats-summary">
                <div className="equip-stat-row">
                  <Badge bg="dark" className="equip-stat-badge" style={{ color: 'var(--green)', background: 'rgba(34, 197, 94, 0.1)' }}>
                    HP {charState.maxHp} {formatBonus(equipBonus.hp)}
                  </Badge>
                  <Badge bg="dark" className="equip-stat-badge" style={{ color: 'var(--blue)', background: 'rgba(59, 130, 246, 0.1)' }}>
                    MP {charState.maxMp} {formatBonus(equipBonus.mp)}
                  </Badge>
                </div>
                <div className="equip-stat-row">
                  <Badge bg="dark" className="equip-stat-badge" style={{ color: 'var(--orange)', background: 'rgba(245, 158, 11, 0.1)' }}>
                    물공 {charState.physAttack} {formatBonus(equipBonus.physAttack)}
                  </Badge>
                  <Badge bg="dark" className="equip-stat-badge" style={{ color: '#a78bfa', background: 'rgba(167, 139, 250, 0.1)' }}>
                    마공 {charState.magAttack} {formatBonus(equipBonus.magAttack)}
                  </Badge>
                </div>
                <div className="equip-stat-row">
                  <Badge bg="dark" className="equip-stat-badge" style={{ color: 'var(--cyan)', background: 'rgba(6, 182, 212, 0.1)' }}>
                    물방 {charState.physDefense} {formatBonus(equipBonus.physDefense)}
                  </Badge>
                  <Badge bg="dark" className="equip-stat-badge" style={{ color: '#60a5fa', background: 'rgba(96, 165, 250, 0.1)' }}>
                    마방 {charState.magDefense} {formatBonus(equipBonus.magDefense)}
                  </Badge>
                </div>
                <div className="equip-stat-row">
                  <Badge bg="dark" className="equip-stat-badge" style={{ color: 'var(--red)', background: 'rgba(239, 68, 68, 0.1)' }}>
                    치명 {charState.critRate}% {formatBonus(equipBonus.critRate)}
                  </Badge>
                  <Badge bg="dark" className="equip-stat-badge" style={{ color: 'var(--green)', background: 'rgba(34, 197, 94, 0.1)' }}>
                    회피 {charState.evasion}% {formatBonus(equipBonus.evasion)}
                  </Badge>
                </div>
              </div>
            </div>
          </Card.Body>
        </Card>
      </Col>

      <Col xs={12} lg={8} className="mb-3">
        <Card className="equip-inv-card">
          <div style={{ position:'absolute', inset:0, background:'url(/ui/inventory_bg.png) center/cover no-repeat', opacity:0.06, pointerEvents:'none' }} />
          <Card.Body className="d-flex flex-column" style={{ position:'relative' }}>
            <div className="inv-tab-bar">
              <button className={`inv-tab-btn ${invTab === 'equip' ? 'active' : ''}`} onClick={() => setInvTab('equip')}>
                🎒 장비 ({inventory.length})
              </button>
              <button className={`inv-tab-btn ${invTab === 'materials' ? 'active' : ''}`} onClick={() => setInvTab('materials')}>
                🧱 재료 ({materials.reduce((s, m) => s + m.quantity, 0)})
              </button>
            </div>

            {invTab === 'equip' && (
              <>
                <div className="inv-grid-10x10">
                  {Array.from({ length: 100 }, (_, i) => {
                    const item = inventory[i] || null;
                    const isDragging = item && dragItem?.item_id === item.item_id;
                    return (
                      <div
                        key={i}
                        className={`inv-grid-cell ${item ? 'has-item' : ''} ${isDragging ? 'dragging' : ''}`}
                        draggable={!!item}
                        onDragStart={(e) => item && onDragStart(e, item)}
                        onDragEnd={onDragEnd}
                        onMouseEnter={() => item && setInvTooltip({ ...item, slotName: SLOT_CONFIG.find(s => s.id === item.slot)?.name || item.slot })}
                        onMouseLeave={() => setInvTooltip(null)}
                      >
                        {item ? (
                          <>
                            <EquipImg itemId={item.item_id} fallback={TYPE_ICONS[item.type] || TYPE_ICONS[item.slot]} className="inv-cell-img" />
                            <span className="inv-cell-name">{item.name}</span>
                          </>
                        ) : null}
                      </div>
                    );
                  })}
                </div>
                {invTooltip && (
                  <div className="inv-tooltip">
                    <div className="tooltip-name">{invTooltip.name}</div>
                    <div className="tooltip-desc">{invTooltip.description}</div>
                    <div className="tooltip-stats">
                      {invTooltip.effect_hp !== 0 && <span className="ts hp">HP+{invTooltip.effect_hp}</span>}
                      {invTooltip.effect_mp !== 0 && <span className="ts mp">MP+{invTooltip.effect_mp}</span>}
                      {!!invTooltip.effect_phys_attack && <span className="ts atk">물공+{invTooltip.effect_phys_attack}</span>}
                      {!!invTooltip.effect_mag_attack && <span className="ts atk">마공+{invTooltip.effect_mag_attack}</span>}
                      {!!invTooltip.effect_phys_defense && <span className="ts def">물방+{invTooltip.effect_phys_defense}</span>}
                      {!!invTooltip.effect_mag_defense && <span className="ts def">마방+{invTooltip.effect_mag_defense}</span>}
                      {!!invTooltip.effect_crit_rate && <span className="ts atk">치명+{invTooltip.effect_crit_rate}</span>}
                      {!!invTooltip.effect_evasion && <span className="ts def">회피+{invTooltip.effect_evasion}</span>}
                    </div>
                    <div className="tooltip-slot">{invTooltip.slotName}</div>
                    {invTooltip.required_level > 1 && <div className="tooltip-lvl">Lv.{invTooltip.required_level} 필요</div>}
                  </div>
                )}
              </>
            )}

            {invTab === 'materials' && (
              <div className="inv-materials-panel">
                {materials.length === 0 ? (
                  <div className="inv-mat-empty">보유한 재료가 없습니다.<br/>몬스터를 사냥하여 재료를 획득하세요!</div>
                ) : (
                  <div className="inv-mat-list">
                    {materials.map(mat => (
                      <div key={mat.material_id} className="inv-mat-item">
                        <div className="inv-mat-icon">{mat.icon}</div>
                        <div className="inv-mat-info">
                          <div className="inv-mat-name" style={{ color: GRADE_COLORS[mat.grade] || '#aaa' }}>
                            {mat.name}
                            <span className="inv-mat-grade">[{mat.grade}]</span>
                          </div>
                          <div className="inv-mat-desc">{mat.description}</div>
                        </div>
                        <div className="inv-mat-qty">x{mat.quantity}</div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </Card.Body>
        </Card>
      </Col>
    </Row>
  );
}

export default Equipment;
