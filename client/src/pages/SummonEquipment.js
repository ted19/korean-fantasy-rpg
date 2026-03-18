import React, { useState, useEffect, useCallback } from 'react';
import { Row, Col, Card, Badge } from 'react-bootstrap';
import api from '../api';
import EnhancePopup from './EnhancePopup';
import '../srpg/StageBattle.css';

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
  weapon: '⚔️',
  chest: '🛡️',
  helmet: '🪖',
  boots: '👢',
  ring: '💍',
  necklace: '📿',
  shield: '🛡️',
  potion: '🧪',
  talisman: '📜',
};

function EquipImg({ itemId, fallback, className, style }) {
  const [err, setErr] = useState(false);
  if (err || !itemId) return <span className={className} style={style}>{fallback}</span>;
  return <img src={`/equipment/${itemId}_icon.png`} alt="" className={className} style={style} onError={() => setErr(true)} />;
}

function SummonEquipment({ summon, onLog, onSummonUpdate }) {
  const [equipped, setEquipped] = useState({});
  const [inventory, setInventory] = useState([]);
  const [potions, setPotions] = useState([]);
  const [invTab, setInvTab] = useState('equip');
  const [dragItem, setDragItem] = useState(null);
  const [dragOverSlot, setDragOverSlot] = useState(null);
  const [tooltip, setTooltip] = useState(null);
  const [invTooltip, setInvTooltip] = useState(null);
  const [summonStats, setSummonStats] = useState(summon);
  const [selectedItem, setSelectedItem] = useState(null);
  const [levelLockPopup, setLevelLockPopup] = useState(null);
  const [enhanceInfo, setEnhanceInfo] = useState(null);
  const [enhancing, setEnhancing] = useState(false);

  const STAR_LEVEL_REQ = { 1: 1, 2: 10, 3: 20, 4: 35, 5: 50, 6: 70 };
  const GRADE_ENHANCE_MAP = { '일반': '일반소환수강화권', '고급': '고급소환수강화권', '희귀': '희귀소환수강화권', '영웅': '영웅소환수강화권', '전설': '전설소환수강화권', '신화': '신화소환수강화권', '초월': '초월소환수강화권' };

  const loadEnhanceInfo = useCallback(async () => {
    try {
      const res = await api.get(`/summon/enhance-info/${summon.id}`);
      setEnhanceInfo(res.data);
    } catch { setEnhanceInfo(null); }
  }, [summon.id]);

  useEffect(() => { loadEnhanceInfo(); }, [loadEnhanceInfo]);

  const [showEnhancePopup, setShowEnhancePopup] = useState(false);

  const handleEnhanceApi = async () => {
    const res = await api.post('/summon/enhance', { summonId: summon.id });
    onLog(res.data.message, res.data.success ? 'heal' : 'damage');
    await loadData();
    await loadEnhanceInfo();
    if (onSummonUpdate) onSummonUpdate();
    return res.data;
  };

  const loadData = useCallback(async () => {
    try {
      const res = await api.get(`/summon/${summon.id}/equipment`);
      setEquipped(res.data.equipped);
      setInventory(res.data.inventory);
      setPotions(res.data.potions || []);
    } catch {
      onLog('소환수 장비 정보를 불러올 수 없습니다.', 'damage');
    }
  }, [summon.id, onLog]);

  useEffect(() => { loadData(); }, [loadData]);

  const handleEquip = async (itemId, slot) => {
    const item = inventory.find(i => i.item_id === itemId);
    if (item && item.required_level > (summonStats?.level || 1)) {
      setLevelLockPopup({ itemName: item.name, itemLevel: item.required_level, unitLevel: summonStats?.level || 1, grade: item.grade, unitName: summonStats?.name || '소환수' });
      return;
    }
    try {
      const res = await api.post(`/summon/${summon.id}/equip`, { itemId, slot });
      onLog(res.data.message, 'system');
      setSummonStats((prev) => ({ ...prev, ...res.data.summon }));
      onSummonUpdate();
      loadData();
    } catch (err) {
      const msg = err.response?.data?.message || '장착 실패';
      if (msg.includes('레벨')) {
        setLevelLockPopup({ itemName: item?.name || '아이템', itemLevel: item?.required_level || 0, unitLevel: summonStats?.level || 1, grade: item?.grade, unitName: summonStats?.name || '소환수' });
      } else {
        onLog(msg, 'damage');
      }
    }
  };

  const handleUnequip = async (slot) => {
    try {
      const res = await api.post(`/summon/${summon.id}/unequip`, { slot });
      onLog(res.data.message, 'system');
      setSummonStats((prev) => ({ ...prev, ...res.data.summon }));
      onSummonUpdate();
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
    if (dragItem && dragItem.slot === slotId) {
      handleEquip(dragItem.item_id, slotId);
    }
    setDragItem(null);
  };

  const onDragEnd = () => {
    setDragItem(null);
    setDragOverSlot(null);
  };

  const handleUsePotion = async (item) => {
    try {
      const res = await api.post('/shop/use', { itemId: item.item_id });
      onLog(res.data.message, 'system');
      loadData();
    } catch (err) {
      onLog(err.response?.data?.message || '사용 실패', 'damage');
    }
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
          <Card.Body>
            <div className="equip-panel">
              <div className="equip-panel-title">{summon.name}</div>
              <div className="text-center" style={{ color: 'var(--text-muted)', fontSize: 13, marginTop: -10, marginBottom: 14 }}>
                {summon.type} · Lv.{summonStats.level || 1}
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
                          <EquipImg itemId={item.item_id} fallback={TYPE_ICONS[item.type] || slot.icon} className="equip-slot-img"
                            style={item.grade && GRADE_COLORS[item.grade] ? { border: `2px solid ${GRADE_COLORS[item.grade]}`, borderRadius: '4px' } : undefined} />

                          {item.type === 'weapon' && item.weapon_hand && <span className="weapon-hand-tag">{item.weapon_hand === '2h' ? '양손' : '한손'}</span>}
                        </div>
                      ) : (
                        <div className="equip-slot-empty">
                          <span className="equip-slot-icon empty">{slot.icon}</span>
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
                  <div className="tooltip-name" style={tooltip.grade ? { color: GRADE_COLORS[tooltip.grade] || '#eee' } : undefined}>
                    {tooltip.name}{tooltip.enhance_level > 0 ? ` +${tooltip.enhance_level}` : ''}
                  </div>
                  {tooltip.grade && <div className="tooltip-grade" style={{ color: GRADE_COLORS[tooltip.grade] || '#aaa' }}>[{tooltip.grade}]{tooltip.enhance_level > 0 ? ` 강화 ${tooltip.enhance_level}/${tooltip.max_enhance || '?'}` : ''}</div>}
                  <div className="tooltip-desc">{tooltip.description}</div>
                  <div className="tooltip-stats">
                    {(() => {
                      const el=tooltip.enhance_level||0;const gm={'일반':1,'고급':1.2,'희귀':1.5,'영웅':1.8,'전설':2,'신화':2.5,'초월':3};
                      const pct=el>0?el*0.06*(gm[tooltip.grade]||1):0;const e=(v)=>v>0&&el>0?Math.floor(v*pct):0;
                      const s=(label,val,cls)=>{const ev=e(val||0);if(!val&&!ev)return null;return <span key={label} className={`ts ${cls}`}>{label}+{(val||0)+ev}{ev>0&&<span style={{color:'#fbbf24',fontSize:'9px'}}>(+{ev})</span>}</span>;};
                      return <>{s('HP',tooltip.effect_hp,'hp')}{s('MP',tooltip.effect_mp,'mp')}{s('물공',tooltip.effect_phys_attack,'atk')}{s('마공',tooltip.effect_mag_attack,'atk')}{s('물방',tooltip.effect_phys_defense,'def')}{s('마방',tooltip.effect_mag_defense,'def')}{s('치명',tooltip.effect_crit_rate,'atk')}{s('회피',tooltip.effect_evasion,'def')}</>;
                    })()}
                  </div>
                  <div className="tooltip-hint">클릭하여 해제</div>
                </div>
              )}

              {/* 스탯 표시 */}
              <div className="equip-stats-summary">
                <div className="equip-stat-row">
                  <Badge bg="dark" className="equip-stat-badge" style={{ color: 'var(--green)', background: 'rgba(34, 197, 94, 0.1)' }}>
                    HP {summonStats.hp} {formatBonus(equipBonus.hp)}
                  </Badge>
                  <Badge bg="dark" className="equip-stat-badge" style={{ color: 'var(--blue)', background: 'rgba(59, 130, 246, 0.1)' }}>
                    MP {summonStats.mp} {formatBonus(equipBonus.mp)}
                  </Badge>
                </div>
                <div className="equip-stat-row">
                  <Badge bg="dark" className="equip-stat-badge" style={{ color: 'var(--orange)', background: 'rgba(245, 158, 11, 0.1)' }}>
                    물공 {summonStats.phys_attack || 0} {formatBonus(equipBonus.physAttack)}
                  </Badge>
                  <Badge bg="dark" className="equip-stat-badge" style={{ color: '#a78bfa', background: 'rgba(167, 139, 250, 0.1)' }}>
                    마공 {summonStats.mag_attack || 0} {formatBonus(equipBonus.magAttack)}
                  </Badge>
                </div>
                <div className="equip-stat-row">
                  <Badge bg="dark" className="equip-stat-badge" style={{ color: 'var(--cyan)', background: 'rgba(6, 182, 212, 0.1)' }}>
                    물방 {summonStats.phys_defense || 0} {formatBonus(equipBonus.physDefense)}
                  </Badge>
                  <Badge bg="dark" className="equip-stat-badge" style={{ color: '#60a5fa', background: 'rgba(96, 165, 250, 0.1)' }}>
                    마방 {summonStats.mag_defense || 0} {formatBonus(equipBonus.magDefense)}
                  </Badge>
                </div>
                <div className="equip-stat-row">
                  <Badge bg="dark" className="equip-stat-badge" style={{ color: 'var(--red)', background: 'rgba(239, 68, 68, 0.1)' }}>
                    치명 {summonStats.crit_rate || 0}% {formatBonus(equipBonus.critRate)}
                  </Badge>
                  <Badge bg="dark" className="equip-stat-badge" style={{ color: 'var(--green)', background: 'rgba(34, 197, 94, 0.1)' }}>
                    회피 {summonStats.evasion || 0}% {formatBonus(equipBonus.evasion)}
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
                        {pot.name?.includes('용병강화권') ? (
                          <button className="inv-potion-use-btn disabled" disabled title="용병 장비 화면에서 사용하세요">용병용</button>
                        ) : pot.name?.includes('소환수강화권') ? (() => {
                          const grade = summonStats?.grade || '일반';
                          const requiredTicket = GRADE_ENHANCE_MAP[grade];
                          const isMatchGrade = pot.name === requiredTicket;
                          const starLevel = summonStats?.star_level || 0;
                          const isMaxStar = starLevel >= 6;
                          const nextStar = starLevel + 1;
                          const reqLv = STAR_LEVEL_REQ[nextStar] || 1;
                          const unitLv = enhanceInfo?.unitLevel || summonStats?.level || 1;
                          const levelOk = unitLv >= reqLv;
                          const canUse = isMatchGrade && !isMaxStar && levelOk && pot.quantity > 0;
                          return (
                            <button
                              className={`inv-potion-use-btn${canUse ? '' : ' disabled'}`}
                              disabled={!canUse || enhancing}
                              onClick={() => canUse && setShowEnhancePopup(true)}
                              title={
                                isMaxStar ? '이미 6성입니다' :
                                !isMatchGrade ? `이 소환수는 ${requiredTicket}이(가) 필요합니다` :
                                !levelOk ? `${nextStar}성 강화는 소환수 Lv.${reqLv} 필요 (현재 Lv.${unitLv})` :
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
                  <div style={{ marginTop: 12, padding: '10px 14px', background: 'rgba(233, 69, 96, 0.1)', border: '1px solid rgba(233, 69, 96, 0.3)', borderRadius: 8, color: '#e94560', fontSize: 13, textAlign: 'center', lineHeight: 1.6 }}>
                    소환수에는 오라를 장착할 수 없습니다.<br/>캐릭터 또는 용병의 장비 화면에서 장착해주세요.
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
          unitType="summon"
          unit={{ ...summonStats, template_id: summon.template_id }}
          enhanceInfo={enhanceInfo}
          onEnhance={handleEnhanceApi}
          onClose={() => setShowEnhancePopup(false)}
        />
      )}
    </Row>
  );
}

export default SummonEquipment;
