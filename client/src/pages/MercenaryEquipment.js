import React, { useState, useEffect, useCallback } from 'react';
import { Row, Col, Card, Badge } from 'react-bootstrap';
import api from '../api';
import EnhancePopup from './EnhancePopup';
import '../srpg/StageBattle.css';

const GRADE_COLORS = {
  '일반': '#aaa',
  '고급': '#4ade80',
  '희귀': '#60a5fa',
  '영웅': '#c084fc',
  '전설': '#fbbf24',
  '신화': '#ff6b6b',
};

const SLOT_CONFIG = [
  { id: 'helmet', name: '투구', icon: '🪖', row: 1, col: 2 },
  { id: 'weapon', name: '무기', icon: '⚔️', row: 2, col: 1 },
  { id: 'chest', name: '갑옷', icon: '🛡️', row: 2, col: 2 },
  { id: 'shield', name: '방패', icon: '🛡️', row: 2, col: 3 },
  { id: 'ring', name: '반지', icon: '💍', row: 3, col: 1 },
  { id: 'boots', name: '장화', icon: '👢', row: 3, col: 2 },
  { id: 'necklace', name: '목걸이', icon: '📿', row: 3, col: 3 },
];

const TYPE_ICONS = {
  weapon: '⚔️', chest: '🛡️', helmet: '🪖',
  boots: '👢', ring: '💍', necklace: '📿', shield: '🛡️', potion: '🧪', talisman: '📜',
};

const COSMETIC_EFFECT_LABELS = {
  aura_gold: '황금 기운', flame: '불꽃 오라', ice: '빙결 오라', lightning: '번개 오라',
  shadow: '암흑 오라', holy: '신성 오라', poison: '독기 오라', wind: '바람 오라',
  blood: '혈기 오라', spirit: '영혼 오라',
  dragon_breath: '용의 숨결', celestial: '천상의 빛', abyssal_flame: '심연의 화염',
  starlight: '별빛 오라', phoenix: '봉황의 기운', chaos_vortex: '혼돈의 소용돌이',
};
const COSMETIC_EFFECT_COLORS = {
  aura_gold: '#ffa502', flame: '#ff4500', ice: '#87cefa', lightning: '#ffd700',
  shadow: '#9b59b6', holy: '#fff3bf', poison: '#2ed573', wind: '#96dcff',
  blood: '#b40000', spirit: '#b482ff',
  dragon_breath: '#ff8c00', celestial: '#e0c0ff', abyssal_flame: '#8b00c8',
  starlight: '#aab8ff', phoenix: '#ff6600', chaos_vortex: '#c850ff',
};

function EquipImg({ itemId, fallback, className, style }) {
  const [err, setErr] = useState(false);
  if (err || !itemId) return <span className={className} style={style}>{fallback}</span>;
  return <img src={`/equipment/${itemId}_icon.png`} alt="" className={className} style={style} onError={() => setErr(true)} />;
}

function MercenaryEquipment({ mercenary, onLog, onMercUpdate }) {
  const [equipped, setEquipped] = useState({});
  const [inventory, setInventory] = useState([]);
  const [potions, setPotions] = useState([]);
  const [invTab, setInvTab] = useState('equip');
  const [dragItem, setDragItem] = useState(null);
  const [dragOverSlot, setDragOverSlot] = useState(null);
  const [tooltip, setTooltip] = useState(null);
  const [invTooltip, setInvTooltip] = useState(null);
  const [mercStats, setMercStats] = useState(mercenary);
  const [equippedAura, setEquippedAura] = useState(null);
  const [cosmeticInventory, setCosmeticInventory] = useState([]);
  const [showAuraPopup, setShowAuraPopup] = useState(false);
  const [levelLockPopup, setLevelLockPopup] = useState(null);
  const [selectedItem, setSelectedItem] = useState(null);
  const [enhanceInfo, setEnhanceInfo] = useState(null);
  const [enhancing, setEnhancing] = useState(false);

  const STAR_LEVEL_REQ = { 1: 1, 2: 10, 3: 20, 4: 35, 5: 50, 6: 70 };
  const GRADE_ENHANCE_MAP = { '일반': '일반용병강화권', '고급': '고급용병강화권', '희귀': '희귀용병강화권', '영웅': '영웅용병강화권', '전설': '전설용병강화권', '신화': '신화용병강화권', '초월': '초월용병강화권' };

  const loadEnhanceInfo = useCallback(async () => {
    try {
      const res = await api.get(`/mercenary/enhance-info/${mercenary.id}`);
      setEnhanceInfo(res.data);
    } catch { setEnhanceInfo(null); }
  }, [mercenary.id]);

  useEffect(() => { loadEnhanceInfo(); }, [loadEnhanceInfo]);

  const [showEnhancePopup, setShowEnhancePopup] = useState(false);

  const handleEnhanceApi = async () => {
    const res = await api.post('/mercenary/enhance', { mercenaryId: mercenary.id });
    onLog(res.data.message, res.data.success ? 'heal' : 'damage');
    await loadData();
    await loadEnhanceInfo();
    if (onMercUpdate) onMercUpdate();
    return res.data;
  };

  const loadData = useCallback(async () => {
    try {
      const [res, cosRes, invFullRes] = await Promise.all([
        api.get(`/mercenary/${mercenary.id}/equipment`),
        api.get('/shop/cosmetics/equipped').catch(() => ({ data: { cosmetics: {} } })),
        api.get('/shop/inventory').catch(() => ({ data: { inventory: [] } })),
      ]);
      setEquipped(res.data.equipped);
      setInventory(res.data.inventory);
      setPotions(res.data.potions || []);
      const mercKey = `merc_${mercenary.id}`;
      setEquippedAura(cosRes.data.cosmetics?.[mercKey] || null);
      setCosmeticInventory((invFullRes.data.inventory || []).filter(i => i.type === 'cosmetic'));
    } catch {
      onLog('용병 장비 정보를 불러올 수 없습니다.', 'damage');
    }
  }, [mercenary.id, onLog]);

  useEffect(() => { loadData(); }, [loadData]);

  const handleEquip = async (itemId, slot) => {
    // 레벨 체크
    const item = inventory.find(i => i.item_id === itemId);
    if (item && item.required_level > (mercStats?.level || 1)) {
      setLevelLockPopup({ itemName: item.name, itemLevel: item.required_level, unitLevel: mercStats?.level || 1, grade: item.grade, unitName: mercStats?.name || '용병' });
      return;
    }
    try {
      const res = await api.post(`/mercenary/${mercenary.id}/equip`, { itemId, slot });
      onLog(res.data.message, 'system');
      setMercStats((prev) => ({ ...prev, ...res.data.mercenary }));
      onMercUpdate();
      loadData();
    } catch (err) {
      const msg = err.response?.data?.message || '장착 실패';
      if (msg.includes('레벨')) {
        setLevelLockPopup({ itemName: item?.name || '아이템', itemLevel: item?.required_level || 0, unitLevel: mercStats?.level || 1, grade: item?.grade, unitName: mercStats?.name || '용병' });
      } else {
        onLog(msg, 'damage');
      }
    }
  };

  const handleUnequip = async (slot) => {
    try {
      const res = await api.post(`/mercenary/${mercenary.id}/unequip`, { slot });
      onLog(res.data.message, 'system');
      setMercStats((prev) => ({ ...prev, ...res.data.mercenary }));
      onMercUpdate();
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
  const onDragLeave = () => { setDragOverSlot(null); };
  const onDrop = (e, slotId) => {
    e.preventDefault();
    setDragOverSlot(null);
    if (dragItem && dragItem.slot === slotId) handleEquip(dragItem.item_id, slotId);
    setDragItem(null);
  };
  const onDragEnd = () => { setDragItem(null); setDragOverSlot(null); };

  const handleUsePotion = async (item) => {
    try {
      const res = await api.post('/shop/use', { itemId: item.item_id });
      onLog(res.data.message, 'system');
      loadData();
    } catch (err) {
      onLog(err.response?.data?.message || '사용 실패', 'damage');
    }
  };

  const handleAuraEquip = async (invId) => {
    try {
      const res = await api.post('/shop/cosmetic/equip', { invId, entityType: 'mercenary', entityId: mercenary.id });
      onLog(res.data.message, 'system');
      setShowAuraPopup(false);
      loadData();
    } catch (err) {
      onLog(err.response?.data?.message || '오라 장착 실패', 'damage');
    }
  };

  const handleAuraUnequip = async () => {
    try {
      const res = await api.post('/shop/cosmetic/unequip', { entityType: 'mercenary', entityId: mercenary.id });
      onLog(res.data.message, 'system');
      loadData();
    } catch (err) {
      onLog(err.response?.data?.message || '오라 해제 실패', 'damage');
    }
  };

  const weaponIs2h = equipped.weapon?.weapon_hand === '2h';

  const equipBonus = { hp: 0, mp: 0, physAttack: 0, physDefense: 0, magAttack: 0, magDefense: 0, critRate: 0, evasion: 0 };
  Object.values(equipped).forEach((item) => {
    if (!item) return;
    equipBonus.hp += item.effect_hp || 0;
    equipBonus.mp += item.effect_mp || 0;
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
          <Card.Body>
            <div className="equip-panel">
              <div className="equip-panel-title">{mercenary.name}</div>
              <div className="text-center" style={{ color: 'var(--text-muted)', fontSize: 13, marginTop: -10, marginBottom: 14 }}>
                {mercenary.class_type} · Lv.{mercStats.level || 1}
              </div>

              <div className="equip-slots-grid">
                {/* 오라 슬롯 */}
                <div
                  className={`equip-slot aura-slot ${equippedAura ? 'filled' : ''} ${dragOverSlot === 'aura' && dragItem?.type === 'cosmetic' ? 'drag-over' : ''}`}
                  style={{ gridRow: 1, gridColumn: 1 }}
                  onClick={() => equippedAura ? handleAuraUnequip() : setShowAuraPopup(true)}
                  onDragOver={(e) => { if (dragItem?.type === 'cosmetic') { e.preventDefault(); e.dataTransfer.dropEffect = 'move'; setDragOverSlot('aura'); } }}
                  onDragLeave={onDragLeave}
                  onDrop={(e) => { e.preventDefault(); setDragOverSlot(null); if (dragItem?.type === 'cosmetic') { handleAuraEquip(dragItem.inv_id || dragItem.id); } setDragItem(null); }}
                  onMouseEnter={() => equippedAura && setTooltip({ name: equippedAura.itemName, description: '코스메틱 오라 효과', slotName: '오라', cosmetic_effect: equippedAura.effect })}
                  onMouseLeave={() => setTooltip(null)}
                >
                  {equippedAura ? (
                    <div className="equip-slot-item aura-slot-item">
                      <div className="aura-slot-preview">
                        <div className={`cb-portrait-effect cb-effect-${equippedAura.effect}`} />
                        <span className="aura-slot-icon">✨</span>
                      </div>
                      <span className="equip-slot-name" style={{ color: COSMETIC_EFFECT_COLORS[equippedAura.effect] || '#ddd' }}>
                        {COSMETIC_EFFECT_LABELS[equippedAura.effect] || equippedAura.itemName}
                      </span>
                    </div>
                  ) : (
                    <div className="equip-slot-empty" onClick={() => setShowAuraPopup(true)}>
                      <span className="equip-slot-icon empty aura-empty-icon">✨</span>
                      <span className="equip-slot-label">오라</span>
                    </div>
                  )}
                </div>
                <div className="equip-slot-spacer" style={{ gridRow: 1, gridColumn: 3 }} />

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
                          <EquipImg itemId={item.item_id} fallback={TYPE_ICONS[item.type] || slot.icon} className="equip-slot-img"
                            style={item.grade && GRADE_COLORS[item.grade] ? { border: `2px solid ${GRADE_COLORS[item.grade]}`, borderRadius: '4px' } : undefined} />

                          {item.type === 'weapon' && item.weapon_hand && <span className="weapon-hand-tag">{item.weapon_hand === '2h' ? '양손' : '한손'}</span>}
                        </div>
                      ) : (
                        <div className="equip-slot-empty">
                          <span className="equip-slot-icon empty">{slot.icon}</span>
                          <span className="equip-slot-label">{isLocked ? '양손무기' : slot.name}</span>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>

              {tooltip && (
                <div className="equip-tooltip">
                  <div className="tooltip-name" style={tooltip.grade ? { color: GRADE_COLORS[tooltip.grade] || '#eee' } : undefined}>
                    {tooltip.name}{tooltip.enhance_level > 0 ? ` +${tooltip.enhance_level}` : ''}
                  </div>
                  {tooltip.grade && <div className="tooltip-grade" style={{ color: GRADE_COLORS[tooltip.grade] || '#aaa' }}>[{tooltip.grade}]{tooltip.enhance_level > 0 ? ` 강화 ${tooltip.enhance_level}/${tooltip.max_enhance || '?'}` : ''}</div>}
                  <div className="tooltip-desc">{tooltip.description}</div>
                  <div className="tooltip-stats">
                    {(() => {
                      const el = tooltip.enhance_level || 0;
                      const gm = {'일반':1,'고급':1.2,'희귀':1.5,'영웅':1.8,'전설':2,'신화':2.5,'초월':3};
                      const pct = el > 0 ? el * 0.06 * (gm[tooltip.grade]||1) : 0;
                      const e = (v) => v > 0 && el > 0 ? Math.floor(v*pct) : 0;
                      const s = (label,val,cls) => { const ev=e(val||0); if(!val&&!ev) return null; return <span key={label} className={`ts ${cls}`}>{label}+{(val||0)+ev}{ev>0&&<span style={{color:'#fbbf24',fontSize:'9px'}}>(+{ev})</span>}</span>; };
                      return <>{s('HP',tooltip.effect_hp,'hp')}{s('MP',tooltip.effect_mp,'mp')}{s('물공',tooltip.effect_phys_attack,'atk')}{s('마공',tooltip.effect_mag_attack,'atk')}{s('물방',tooltip.effect_phys_defense,'def')}{s('마방',tooltip.effect_mag_defense,'def')}{s('치명',tooltip.effect_crit_rate,'atk')}{s('회피',tooltip.effect_evasion,'def')}</>;
                    })()}
                  </div>
                  <div className="tooltip-hint">클릭하여 해제</div>
                </div>
              )}

              <div className="equip-stats-summary">
                <div className="equip-stat-row">
                  <Badge bg="dark" className="equip-stat-badge" style={{ color: 'var(--green)', background: 'rgba(34, 197, 94, 0.1)' }}>
                    HP {mercStats.hp} {formatBonus(equipBonus.hp)}
                  </Badge>
                  <Badge bg="dark" className="equip-stat-badge" style={{ color: 'var(--blue)', background: 'rgba(59, 130, 246, 0.1)' }}>
                    MP {mercStats.mp} {formatBonus(equipBonus.mp)}
                  </Badge>
                </div>
                <div className="equip-stat-row">
                  <Badge bg="dark" className="equip-stat-badge" style={{ color: 'var(--orange)', background: 'rgba(245, 158, 11, 0.1)' }}>
                    물공 {mercStats.phys_attack || 0} {formatBonus(equipBonus.physAttack)}
                  </Badge>
                  <Badge bg="dark" className="equip-stat-badge" style={{ color: '#a78bfa', background: 'rgba(167, 139, 250, 0.1)' }}>
                    마공 {mercStats.mag_attack || 0} {formatBonus(equipBonus.magAttack)}
                  </Badge>
                </div>
                <div className="equip-stat-row">
                  <Badge bg="dark" className="equip-stat-badge" style={{ color: 'var(--cyan)', background: 'rgba(6, 182, 212, 0.1)' }}>
                    물방 {mercStats.phys_defense || 0} {formatBonus(equipBonus.physDefense)}
                  </Badge>
                  <Badge bg="dark" className="equip-stat-badge" style={{ color: '#60a5fa', background: 'rgba(96, 165, 250, 0.1)' }}>
                    마방 {mercStats.mag_defense || 0} {formatBonus(equipBonus.magDefense)}
                  </Badge>
                </div>
                <div className="equip-stat-row">
                  <Badge bg="dark" className="equip-stat-badge" style={{ color: 'var(--red)', background: 'rgba(239, 68, 68, 0.1)' }}>
                    치명 {mercStats.crit_rate || 0}% {formatBonus(equipBonus.critRate)}
                  </Badge>
                  <Badge bg="dark" className="equip-stat-badge" style={{ color: 'var(--green)', background: 'rgba(34, 197, 94, 0.1)' }}>
                    회피 {mercStats.evasion || 0}% {formatBonus(equipBonus.evasion)}
                  </Badge>
                </div>
              </div>
            </div>
          </Card.Body>
        </Card>
      </Col>

      <Col xs={12} lg={8} className="mb-3">
        <Card className="equip-inv-card">
          <Card.Body className="d-flex flex-column">
            <div className="inv-tab-bar">
              <button className={`inv-tab-btn ${invTab === 'equip' ? 'active' : ''}`} onClick={() => setInvTab('equip')}>
                🎒 장비 ({inventory.length})
              </button>
              <button className={`inv-tab-btn ${invTab === 'consumable' ? 'active' : ''}`} onClick={() => setInvTab('consumable')}>
                🧪 소모품 ({potions.reduce((s, p) => s + p.quantity, 0)})
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
                        onClick={() => item && setSelectedItem(item)}
                        onMouseEnter={() => item && setInvTooltip({ ...item, slotName: SLOT_CONFIG.find(s => s.id === item.slot)?.name || item.slot })}
                        onMouseLeave={() => setInvTooltip(null)}
                      >
                        {item ? (
                          <>
                            {item.type === 'cosmetic' && item.cosmetic_effect ? (
                              <div className="inv-cell-aura-preview">
                                <div className={`cb-portrait-effect cb-effect-${item.cosmetic_effect}`} />
                                <span className="inv-cell-aura-icon">✨</span>
                              </div>
                            ) : (
                              <EquipImg itemId={item.item_id} fallback={TYPE_ICONS[item.type] || TYPE_ICONS[item.slot]} className="inv-cell-img"
                                style={item.grade && GRADE_COLORS[item.grade] ? { border: `2px solid ${GRADE_COLORS[item.grade]}`, borderRadius: '4px' } : undefined} />
                            )}

                            <span className="inv-cell-name" style={item.grade && GRADE_COLORS[item.grade] ? { color: GRADE_COLORS[item.grade] } : (item.type === 'cosmetic' ? { color: COSMETIC_EFFECT_COLORS[item.cosmetic_effect] || '#ddd' } : undefined)}>
                              {item.name}{item.enhance_level > 0 ? ` +${item.enhance_level}` : ''}
                              {item.type === 'weapon' && item.weapon_hand && <span className="weapon-hand-tag">{item.weapon_hand === '2h' ? '양손' : '한손'}</span>}
                            </span>
                          </>
                        ) : null}
                      </div>
                    );
                  })}
                </div>
                {invTooltip && (
                  <div className="inv-tooltip">
                    <div className="tooltip-name" style={invTooltip.grade ? { color: GRADE_COLORS[invTooltip.grade] || '#eee' } : undefined}>
                      {invTooltip.name}{invTooltip.enhance_level > 0 ? ` +${invTooltip.enhance_level}` : ''}
                    </div>
                    {invTooltip.grade && <div className="tooltip-grade" style={{ color: GRADE_COLORS[invTooltip.grade] || '#aaa' }}>[{invTooltip.grade}]{invTooltip.enhance_level > 0 ? ` 강화 ${invTooltip.enhance_level}/${invTooltip.max_enhance || '?'}` : ''}</div>}
                    <div className="tooltip-desc">{invTooltip.description}</div>
                    <div className="tooltip-stats">
                      {(() => {
                        const el=invTooltip.enhance_level||0;const gm={'일반':1,'고급':1.2,'희귀':1.5,'영웅':1.8,'전설':2,'신화':2.5,'초월':3};
                        const pct=el>0?el*0.06*(gm[invTooltip.grade]||1):0;const e=(v)=>v>0&&el>0?Math.floor(v*pct):0;
                        const s=(label,val,cls)=>{const ev=e(val||0);if(!val&&!ev)return null;return <span key={label} className={`ts ${cls}`}>{label}+{(val||0)+ev}{ev>0&&<span style={{color:'#fbbf24',fontSize:'9px'}}>(+{ev})</span>}</span>;};
                        return <>{s('HP',invTooltip.effect_hp,'hp')}{s('MP',invTooltip.effect_mp,'mp')}{s('물공',invTooltip.effect_phys_attack,'atk')}{s('마공',invTooltip.effect_mag_attack,'atk')}{s('물방',invTooltip.effect_phys_defense,'def')}{s('마방',invTooltip.effect_mag_defense,'def')}{s('치명',invTooltip.effect_crit_rate,'atk')}{s('회피',invTooltip.effect_evasion,'def')}</>;
                      })()}
                    </div>
                    <div className="tooltip-slot">{invTooltip.slotName}</div>
                    {invTooltip.required_level > 1 && <div className="tooltip-lvl">Lv.{invTooltip.required_level} 필요</div>}
                  </div>
                )}
              </>
            )}

            {invTab === 'consumable' && (
              <div className="inv-consumable-panel">
                {potions.length === 0 ? (
                  <div className="inv-mat-empty">보유한 소모품이 없습니다.<br/>상점에서 물약을 구매하세요!</div>
                ) : (
                  <div className="inv-mat-list">
                    {potions.map(pot => (
                      <div key={pot.inv_id} className="inv-mat-item">
                        <div className="inv-mat-icon">
                          <EquipImg itemId={pot.item_id} fallback={pot.name?.includes('강화권') ? '⭐' : pot.type === 'talisman' ? '📜' : '🧪'} className="inv-cell-img" />
                        </div>
                        <div className="inv-mat-info">
                          <div className="inv-mat-name">{pot.name}</div>
                          <div className="inv-mat-desc">
                            {pot.type === 'talisman' ? (
                              <span style={{ color: '#fbbf24' }}>{pot.description}</span>
                            ) : (
                              <>
                                {pot.effect_hp > 0 && <span style={{ color: '#4ade80' }}>HP+{pot.effect_hp} </span>}
                                {pot.effect_mp > 0 && <span style={{ color: '#60a5fa' }}>MP+{pot.effect_mp}</span>}
                              </>
                            )}
                          </div>
                        </div>
                        <div className="inv-mat-qty">x{pot.quantity}</div>
                        {pot.name?.includes('소환수강화권') ? (
                          <button className="inv-potion-use-btn disabled" disabled title="소환수 장비 화면에서 사용하세요">소환수용</button>
                        ) : pot.name?.includes('용병강화권') ? (() => {
                          const grade = mercStats?.grade || '일반';
                          const requiredTicket = GRADE_ENHANCE_MAP[grade];
                          const isMatchGrade = pot.name === requiredTicket;
                          const starLevel = mercStats?.star_level || 0;
                          const isMaxStar = starLevel >= 6;
                          const nextStar = starLevel + 1;
                          const reqLv = STAR_LEVEL_REQ[nextStar] || 1;
                          const unitLv = enhanceInfo?.unitLevel || mercStats?.level || 1;
                          const levelOk = unitLv >= reqLv;
                          const canUse = isMatchGrade && !isMaxStar && levelOk && pot.quantity > 0;
                          return (
                            <button
                              className={`inv-potion-use-btn${canUse ? '' : ' disabled'}`}
                              disabled={!canUse || enhancing}
                              onClick={() => canUse && setShowEnhancePopup(true)}
                              title={
                                isMaxStar ? '이미 6성입니다' :
                                !isMatchGrade ? `이 용병은 ${requiredTicket}이(가) 필요합니다` :
                                !levelOk ? `${nextStar}성 강화는 용병 Lv.${reqLv} 필요 (현재 Lv.${unitLv})` :
                                `${nextStar}성으로 강화 (성공률: ${enhanceInfo?.successRate ? Math.round(enhanceInfo.successRate * 100) : '?'}%)`
                              }
                            >
                              {enhancing ? '...' : canUse ? `강화 (${nextStar}성)` : isMaxStar ? 'MAX' : !isMatchGrade ? '등급불일치' : `Lv.${reqLv}필요`}
                            </button>
                          );
                        })() : pot.type !== 'talisman' && (
                          <button className="inv-potion-use-btn" onClick={() => handleUsePotion(pot)}>사용</button>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </Card.Body>
        </Card>
      </Col>

      {/* 아이템 정보 팝업 */}
      {selectedItem && (
        <div className="aura-popup-overlay" onClick={() => setSelectedItem(null)}>
          <div className="item-detail-popup" onClick={(e) => e.stopPropagation()}>
            <div className="aura-popup-header">
              <span style={selectedItem.type === 'cosmetic' ? { color: COSMETIC_EFFECT_COLORS[selectedItem.cosmetic_effect] || '#eee' } : { color: { '일반':'#aaa','고급':'#4ade80','희귀':'#60a5fa','영웅':'#c084fc','전설':'#fbbf24','신화':'#ff6b6b' }[selectedItem.grade] || '#eee' }}>
                {selectedItem.name}
              </span>
              <button className="aura-popup-close" onClick={() => setSelectedItem(null)}>&times;</button>
            </div>
            <div className="item-detail-body">
              {selectedItem.type === 'cosmetic' ? (
                <>
                  <div className="item-detail-icon-row">
                    <div className="item-detail-icon-frame" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <div style={{ position: 'relative', width: 64, height: 64 }}>
                        <div className={`cb-portrait-effect cb-effect-${selectedItem.cosmetic_effect}`} style={{ position: 'absolute', inset: 0, borderRadius: '50%' }} />
                        <span style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 28 }}>✨</span>
                      </div>
                    </div>
                    <div className="item-detail-meta">
                      <div className="item-detail-grade" style={{ color: COSMETIC_EFFECT_COLORS[selectedItem.cosmetic_effect] || '#ddd' }}>
                        [{COSMETIC_EFFECT_LABELS[selectedItem.cosmetic_effect] || selectedItem.cosmetic_effect}]
                      </div>
                      <div className="item-detail-slot">오라</div>
                    </div>
                  </div>
                  <div className="item-detail-desc">{selectedItem.description}</div>
                  <div className="item-detail-actions">
                    <button className="item-detail-equip-btn" onClick={() => { handleAuraEquip(selectedItem.inv_id || selectedItem.id); setSelectedItem(null); }}>
                      장착하기
                    </button>
                  </div>
                </>
              ) : (
                <>
                  <div className="item-detail-icon-row">
                    <div className="item-detail-icon-frame">
                      <EquipImg itemId={selectedItem.item_id} fallback={TYPE_ICONS[selectedItem.type] || TYPE_ICONS[selectedItem.slot] || '📦'} className="item-detail-icon-img" />
                    </div>
                    <div className="item-detail-meta">
                      {selectedItem.grade && (
                        <div className="item-detail-grade" style={{ color: GRADE_COLORS[selectedItem.grade] }}>[{selectedItem.grade}]</div>
                      )}
                      <div className="item-detail-slot">{SLOT_CONFIG.find(s => s.id === selectedItem.slot)?.name || selectedItem.slot || selectedItem.type}</div>
                      {selectedItem.type === 'weapon' && selectedItem.weapon_hand && (
                        <div className="item-detail-hand">{selectedItem.weapon_hand === '2h' ? '양손 무기' : '한손 무기'}</div>
                      )}
                      {selectedItem.required_level > 1 && (
                        <div className="item-detail-lvl">필요 레벨: Lv.{selectedItem.required_level}</div>
                      )}
                      {selectedItem.enhance_level > 0 && (
                        <div className="item-detail-enhance">강화: +{selectedItem.enhance_level} / {selectedItem.max_enhance || '?'}</div>
                      )}
                    </div>
                  </div>
                  <div className="item-detail-desc">{selectedItem.description}</div>
                  <div className="item-detail-stats">
                    {(() => {
                      const el=selectedItem.enhance_level||0;const gm={'일반':1,'고급':1.2,'희귀':1.5,'영웅':1.8,'전설':2,'신화':2.5,'초월':3};
                      const pct=el>0?el*0.06*(gm[selectedItem.grade]||1):0;const e=(base)=>base>0&&el>0?Math.floor(base*pct):0;
                      const show=(label,base,cls,suf='')=>{const ev=e(base||0);if(!base&&!ev)return null;return <div className="item-stat-row" key={label}><span className="stat-label">{label}</span><span className={`stat-val ${cls}`}>+{(base||0)+ev}{suf}{ev>0&&<span style={{color:'#fbbf24',fontSize:'10px',marginLeft:'3px'}}>(+{ev})</span>}</span></div>;};
                      return <>{show('HP',selectedItem.effect_hp,'hp')}{show('MP',selectedItem.effect_mp,'mp')}{show('물리공격',selectedItem.effect_phys_attack,'atk')}{show('마법공격',selectedItem.effect_mag_attack,'atk')}{show('물리방어',selectedItem.effect_phys_defense,'def')}{show('마법방어',selectedItem.effect_mag_defense,'def')}{show('치명률',selectedItem.effect_crit_rate,'atk','%')}{show('회피율',selectedItem.effect_evasion,'def','%')}</>;
                    })()}
                  </div>
                  <div className="item-detail-actions">
                    {selectedItem.slot && SLOT_CONFIG.some(s => s.id === selectedItem.slot) && (
                      <button className="item-detail-equip-btn" onClick={() => { handleEquip(selectedItem.item_id, selectedItem.slot); setSelectedItem(null); }}>
                        장착하기
                      </button>
                    )}
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {/* 오라 선택 팝업 */}
      {showAuraPopup && (
        <div className="aura-popup-overlay" onClick={() => setShowAuraPopup(false)}>
          <div className="aura-popup" onClick={(e) => e.stopPropagation()}>
            <div className="aura-popup-header">
              <span>오라 장착</span>
              <button className="aura-popup-close" onClick={() => setShowAuraPopup(false)}>&times;</button>
            </div>
            <div className="aura-popup-body">
              {cosmeticInventory.length === 0 ? (
                <div className="aura-popup-empty">
                  보유한 코스메틱이 없습니다.<br/>상점에서 코스메틱을 구매하세요!
                </div>
              ) : (
                <div className="aura-popup-list">
                  {cosmeticInventory.map((item) => (
                    <div key={item.inv_id} className="aura-popup-item" onClick={() => handleAuraEquip(item.inv_id)}>
                      <div className="aura-popup-item-preview">
                        <div className={`cb-portrait-effect cb-effect-${item.cosmetic_effect}`} />
                        <span className="aura-popup-item-icon">✨</span>
                      </div>
                      <div className="aura-popup-item-info">
                        <div className="aura-popup-item-name" style={{ color: COSMETIC_EFFECT_COLORS[item.cosmetic_effect] || '#ddd' }}>
                          {item.name}
                        </div>
                        <div className="aura-popup-item-effect">
                          {COSMETIC_EFFECT_LABELS[item.cosmetic_effect] || item.cosmetic_effect}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
      {/* 레벨 제한 팝업 */}
      {levelLockPopup && (
        <div className="equip-lock-overlay" onClick={() => setLevelLockPopup(null)}>
          <div className="equip-lock-popup" onClick={e => e.stopPropagation()}>
            <div className="equip-lock-icon">🔒</div>
            <div className="equip-lock-title">장착 불가</div>
            <div className="equip-lock-item-name" style={{ color: GRADE_COLORS[levelLockPopup.grade] || '#fbbf24' }}>
              {levelLockPopup.itemName}
            </div>
            <div className="equip-lock-levels">
              <div className="equip-lock-level-row">
                <span className="equip-lock-level-label">{levelLockPopup.unitName} 레벨</span>
                <span className="equip-lock-level-value">Lv.{levelLockPopup.unitLevel}</span>
              </div>
              <div className="equip-lock-level-row required">
                <span className="equip-lock-level-label">필요 레벨</span>
                <span className="equip-lock-level-value">Lv.{levelLockPopup.itemLevel}</span>
              </div>
            </div>
            <div className="equip-lock-msg">
              🗡️ {levelLockPopup.itemLevel - levelLockPopup.unitLevel}레벨 더 성장하면 장착할 수 있습니다
            </div>
            <button className="equip-lock-btn" onClick={() => setLevelLockPopup(null)}>확인</button>
          </div>
        </div>
      )}
      {showEnhancePopup && enhanceInfo && !enhanceInfo.maxed && (
        <EnhancePopup
          unitType="mercenary"
          unit={{ ...mercStats, template_id: mercenary.template_id }}
          enhanceInfo={enhanceInfo}
          onEnhance={handleEnhanceApi}
          onClose={() => setShowEnhancePopup(false)}
        />
      )}
    </Row>
  );
}

export default MercenaryEquipment;
