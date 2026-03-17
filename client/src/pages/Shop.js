import React, { useState, useEffect, useRef } from 'react';
import api from '../api';
import '../srpg/StageBattle.css';

const TYPE_LABELS = { weapon: '무기', chest: '갑옷', helmet: '투구', boots: '장화', ring: '반지', necklace: '목걸이', shield: '방패', potion: '물약', armor: '방어구', cosmetic: '코스메틱', talisman: '부적', consumable: '소모품' };
const TYPE_ICONS = { weapon: '⚔️', chest: '🛡️', helmet: '🪖', boots: '👢', ring: '💍', necklace: '📿', shield: '🛡️', potion: '🧪', armor: '🛡️', cosmetic: '✨', talisman: '📜', consumable: '🧪' };
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
const GRADE_COLORS = { '일반': '#aaa', '고급': '#4ade80', '희귀': '#60a5fa', '영웅': '#c084fc', '전설': '#fbbf24', '신화': '#ff6b6b' };

function ShopImg({ itemId, type, className, style }) {
  const [err, setErr] = useState(false);
  if (err || !itemId) return <span className={className} style={style}>{TYPE_ICONS[type] || '📦'}</span>;
  return <img src={`/equipment/${itemId}_icon.png`} alt="" className={className} style={style} onError={() => setErr(true)} />;
}

function NpcImg({ src, className }) {
  const [err, setErr] = useState(false);
  if (err) return null;
  return <img src={src} alt="" className={className} onError={() => setErr(true)} />;
}

function Shop({ character, charState, onCharStateUpdate, onLog }) {
  const [shopItems, setShopItems] = useState([]);
  const [inventory, setInventory] = useState([]);
  const [tab, setTab] = useState('buy');
  const [typeFilter, setTypeFilter] = useState('all');
  const [npcMsg, setNpcMsg] = useState('어서오게, 모험가! 좋은 물건이 많다네.');
  const [purchasePopup, setPurchasePopup] = useState(null);
  const [confirmPopup, setConfirmPopup] = useState(null);
  const [invTooltip, setInvTooltip] = useState(null);
  const [selectedInvItem, setSelectedInvItem] = useState(null);
  const [sellQty, setSellQty] = useState(1);
  const [cosmeticEquipPopup, setCosmeticEquipPopup] = useState(null);
  const [cosmeticPreview, setCosmeticPreview] = useState(null);
  const [mercenaries, setMercenaries] = useState([]);
  const [equippedCosmetics, setEquippedCosmetics] = useState({});
  const [refreshAt, setRefreshAt] = useState(null);
  const [countdown, setCountdown] = useState('');
  const timerRef = useRef(null);

  const NPC_MSGS_BUY = [
    '어서오게, 모험가! 좋은 물건이 많다네.',
    '오늘은 특별한 물건이 들어왔지.',
    '마음에 드는 것을 골라보게나.',
    '장비가 좋아야 전투에서 살아남지.',
  ];
  const NPC_MSGS_SELL = [
    '팔 물건이 있나? 좋은 값에 사지.',
    '인벤토리를 정리하려나? 잘 왔네.',
    '쓸만한 물건이면 제값을 쳐줄세.',
  ];

  const loadData = async () => {
    try {
      const [shopRes, invRes, mercRes, cosRes] = await Promise.all([
        api.get('/shop/items'),
        api.get('/shop/inventory'),
        api.get('/mercenary/my').catch(() => ({ data: { mercenaries: [] } })),
        api.get('/shop/cosmetics/equipped').catch(() => ({ data: { cosmetics: {} } })),
      ]);
      setShopItems(shopRes.data.items || []);
      setInventory(invRes.data.inventory || []);
      setMercenaries(mercRes.data.mercenaries || []);
      setEquippedCosmetics(cosRes.data.cosmetics || {});
      if (shopRes.data.refreshAt) setRefreshAt(new Date(shopRes.data.refreshAt));
    } catch (err) {
      console.error('Shop loadData error:', err);
      if (onLog) onLog('상점 정보를 불러올 수 없습니다.', 'damage');
    }
  };

  useEffect(() => { loadData(); }, []);

  useEffect(() => {
    if (!refreshAt) return;
    const tick = () => {
      const diff = refreshAt.getTime() - Date.now();
      if (diff <= 0) {
        setCountdown('새 물건 입고 중...');
        clearInterval(timerRef.current);
        setTimeout(() => loadData(), 1500);
        return;
      }
      const h = Math.floor(diff / 3600000);
      const m = Math.floor((diff % 3600000) / 60000);
      const s = Math.floor((diff % 60000) / 1000);
      setCountdown(`${h}시간 ${String(m).padStart(2, '0')}분 ${String(s).padStart(2, '0')}초`);
    };
    tick();
    timerRef.current = setInterval(tick, 1000);
    return () => clearInterval(timerRef.current);
  }, [refreshAt]);

  useEffect(() => {
    const msgs = tab === 'buy' ? NPC_MSGS_BUY : NPC_MSGS_SELL;
    setNpcMsg(msgs[Math.floor(Math.random() * msgs.length)]);
  }, [tab]);

  const handleBuy = async (item) => {
    try {
      const res = await api.post('/shop/buy', { itemId: item.id });
      onLog(res.data.message, 'heal');
      onCharStateUpdate({ gold: res.data.gold });
      setNpcMsg(`${item.name}, 좋은 선택이야!`);
      setPurchasePopup({ item, goldSpent: item.price, remainGold: res.data.gold });
      loadData();
    } catch (err) {
      onLog(err.response?.data?.message || '구매 실패', 'damage');
      setNpcMsg('흠, 그건 좀 어렵겠는걸...');
    }
  };

  const handleSell = async (item, quantity = 1) => {
    try {
      const res = await api.post('/shop/sell', { itemId: item.item_id, invId: item.inv_id, quantity });
      onLog(res.data.message, 'heal');
      onCharStateUpdate({ gold: res.data.gold });
      setNpcMsg('좋은 거래였네!');
      loadData();
    } catch (err) {
      onLog(err.response?.data?.message || '판매 실패', 'damage');
    }
  };

  const handleUse = async (item) => {
    try {
      const res = await api.post('/shop/use', { itemId: item.item_id });
      onLog(res.data.message, 'heal');
      const c = res.data.character;
      onCharStateUpdate({ currentHp: c.current_hp, currentMp: c.current_mp });
      loadData();
    } catch (err) {
      onLog(err.response?.data?.message || '사용 실패', 'damage');
    }
  };

  const handleCosmeticEquip = async (invId, entityType, entityId) => {
    try {
      const res = await api.post('/shop/cosmetic/equip', { invId, entityType, entityId });
      onLog(res.data.message, 'heal');
      setCosmeticEquipPopup(null);
      loadData();
    } catch (err) {
      onLog(err.response?.data?.message || '코스메틱 장착 실패', 'damage');
    }
  };

  const handleCosmeticUnequip = async (entityType, entityId) => {
    try {
      const res = await api.post('/shop/cosmetic/unequip', { entityType, entityId });
      onLog(res.data.message, 'heal');
      loadData();
    } catch (err) {
      onLog(err.response?.data?.message || '코스메틱 해제 실패', 'damage');
    }
  };

  const canBuy = (item) => {
    if (charState.gold < item.price) return false;
    return true;
  };

  const matchType = (itemType) => {
    if (typeFilter === 'all') return true;
    if (typeFilter === 'consumable') return itemType === 'potion' || itemType === 'talisman';
    return itemType === typeFilter;
  };
  const filteredShopItems = shopItems.filter(i => matchType(i.type));

  const unequippedInventory = inventory;
  const filteredInventory = unequippedInventory.filter(i => matchType(i.type));

  return (
    <div className="facility-page shop-page">
      {/* Banner */}
      <div className="facility-banner">
        <NpcImg src="/village/merchant_banner.png" className="facility-banner-img" />
        <div className="facility-banner-overlay" />
        <div className="facility-banner-title">상점</div>
      </div>

      {/* NPC Section */}
      <div className="facility-npc">
        <div className="facility-npc-portrait-wrap">
          <NpcImg src="/village/merchant_portrait.png" className="facility-npc-portrait" />
        </div>
        <div className="facility-npc-speech">
          <div className="facility-npc-name">상인 <span className="npc-name-sub">박 상단주</span></div>
          <div className="facility-npc-msg">{npcMsg}</div>
        </div>
        <div className="facility-gold">
          <img src="/ui/gold_coin.png" alt="" className="gold-icon-img" onError={(e) => { e.target.style.display='none'; }} />
          <span>{(charState.gold ?? 0).toLocaleString()}G</span>
        </div>
      </div>

      {/* 입고 카운트다운 */}
      {countdown && (
        <div className="shop-refresh-timer">
          <span className="shop-refresh-label">새 물건 입고까지</span>
          <span className="shop-refresh-countdown">{countdown}</span>
        </div>
      )}

      {/* Tabs */}
      <div className="facility-tabs">
        <button className={`facility-tab ${tab === 'buy' ? 'active' : ''}`} onClick={() => setTab('buy')}>
          구매
        </button>
        <button className={`facility-tab ${tab === 'inventory' ? 'active' : ''}`} onClick={() => setTab('inventory')}>
          인벤토리 <span className="tab-badge">{unequippedInventory.length}</span>
        </button>
      </div>

      {/* Filters */}
      <div className="facility-filters">
        {['all', 'weapon', 'chest', 'helmet', 'boots', 'shield', 'ring', 'necklace', 'consumable'].map((t) => (
          <button
            key={t}
            className={`facility-filter-btn ${typeFilter === t ? 'active' : ''}`}
            onClick={() => setTypeFilter(t)}
          >
            {t === 'all' ? '전체' : `${TYPE_ICONS[t] || ''} ${TYPE_LABELS[t] || t}`}
          </button>
        ))}
      </div>

      {/* Items Grid */}
      {tab === 'buy' ? (
        <div className="facility-item-list">
          {filteredShopItems.map((item) => {
            return (
              <div key={item.id} className="facility-item-card">
                <div className="fitem-top">
                  <ShopImg itemId={item.id} type={item.type} className="fitem-icon"
                    style={item.grade && GRADE_COLORS[item.grade] ? { border: `2px solid ${GRADE_COLORS[item.grade]}80`, borderRadius: '6px' } : undefined} />
                  <div className="fitem-info">
                    <div className="fitem-name">
                      <span style={{ color: GRADE_COLORS[item.grade] || '#aaa' }}>{item.name}</span>
                      {item.grade && item.type !== 'potion' && item.type !== 'talisman' && <span className="fitem-grade" style={{ color: GRADE_COLORS[item.grade] }}>[{item.grade}]</span>}
                      {item.type === 'weapon' && item.weapon_hand && <span className="weapon-hand-tag">{item.weapon_hand === '2h' ? '양손' : '한손'}</span>}
                      {item.class_restriction && <span className="fitem-class">{item.class_restriction}</span>}
                    </div>
                    <div className="fitem-desc">{item.description}</div>
                  </div>
                </div>
                <div className="fitem-effects">
                  {item.type === 'cosmetic' && item.cosmetic_effect && (
                    <span className="eff cosmetic-preview-btn" style={{ color: COSMETIC_EFFECT_COLORS[item.cosmetic_effect] || '#ddd', border: `1px solid ${COSMETIC_EFFECT_COLORS[item.cosmetic_effect] || '#555'}`, cursor: 'pointer' }}
                      onClick={(e) => { e.stopPropagation(); setCosmeticPreview(item.cosmetic_effect); }}>
                      {COSMETIC_EFFECT_LABELS[item.cosmetic_effect] || item.cosmetic_effect}
                    </span>
                  )}
                  {item.effect_hp !== 0 && <span className="eff hp">HP+{item.effect_hp}</span>}
                  {item.effect_mp !== 0 && <span className="eff mp">MP+{item.effect_mp}</span>}
                  {!!item.effect_phys_attack && <span className="eff atk">물공+{item.effect_phys_attack}</span>}
                  {!!item.effect_mag_attack && <span className="eff atk">마공+{item.effect_mag_attack}</span>}
                  {!!item.effect_phys_defense && <span className="eff def">물방+{item.effect_phys_defense}</span>}
                  {!!item.effect_mag_defense && <span className="eff def">마방+{item.effect_mag_defense}</span>}
                  {!!item.effect_crit_rate && <span className="eff atk">치명+{item.effect_crit_rate}</span>}
                  {!!item.effect_evasion && <span className="eff def">회피+{item.effect_evasion}</span>}
                  {item.required_level > 1 && <span className="eff lvl">Lv.{item.required_level}</span>}
                </div>
                <div className="fitem-bottom">
                  <span className="fitem-price">{item.price.toLocaleString()}G</span>
                  <button
                    className={`fitem-btn buy ${!canBuy(item) ? 'disabled' : ''}`}
                    onClick={() => setConfirmPopup(item)}
                    disabled={!canBuy(item)}
                  >
                    {charState.gold < item.price ? '골드부족' : '구매'}
                  </button>
                </div>
              </div>
            );
          })}
          {filteredShopItems.length === 0 && <div className="facility-empty">판매 중인 아이템이 없습니다.</div>}
        </div>
      ) : (
        <div className="shop-inv-section">
          <div className="shop-inv-grid">
            {Array.from({ length: Math.max(100, filteredInventory.length) }, (_, i) => {
              const item = filteredInventory[i] || null;
              const isSelected = item && selectedInvItem && item.item_id === selectedInvItem.item_id;
              return (
                <div
                  key={i}
                  className={`shop-inv-cell ${item ? 'has-item' : ''} ${isSelected ? 'selected' : ''}`}
                  onClick={() => { if (item) { setSelectedInvItem(item); setSellQty(1); } }}
                >
                  {item && (
                    <>
                      <ShopImg itemId={item.item_id} type={item.type} className="shop-inv-cell-img"
                        style={item.grade && GRADE_COLORS[item.grade] ? { border: `2px solid ${GRADE_COLORS[item.grade]}`, borderRadius: '4px' } : undefined} />
                      {item.enhance_level > 0 && <span className="shop-inv-enhance">+{item.enhance_level}</span>}
                      {item.available_qty > 1 && <span className="shop-inv-qty">x{item.available_qty}</span>}
                      <span className="shop-inv-cell-name" style={{ color: GRADE_COLORS[item.grade] || '#aaa' }}>
                        {item.name}{item.enhance_level > 0 ? ` +${item.enhance_level}` : ''}
                      </span>
                    </>
                  )}
                </div>
              );
            })}
          </div>
          {filteredInventory.length === 0 && (
            <div className="facility-empty" style={{ marginTop: 12 }}>보유한 장비가 없습니다.</div>
          )}
        </div>
      )}

      {/* 인벤토리 아이템 정보 팝업 */}
      {selectedInvItem && (() => {
        const si = selectedInvItem;
        const isPotion = si.type === 'potion' || si.type === 'talisman';
        const maxQty = isPotion ? si.available_qty : 1;
        const totalSellGold = si.sell_price * sellQty;
        return (
          <div className="shop-popup-overlay" onClick={() => setSelectedInvItem(null)}>
            <div className="shop-sell-popup" onClick={e => e.stopPropagation()}>
              {/* 헤더 */}
              <div className="sell-popup-header">
                <span className="sell-popup-title">아이템 정보</span>
                <button className="sell-popup-close" onClick={() => setSelectedInvItem(null)}>✕</button>
              </div>

              {/* 아이템 정보 영역 */}
              <div className="sell-popup-item-section">
                <div className="sell-popup-icon-wrap">
                  <ShopImg itemId={si.item_id} type={si.type} className="sell-popup-icon" />
                  {si.enhance_level > 0 && <span className="sell-popup-enhance">+{si.enhance_level}</span>}
                </div>
                <div className="sell-popup-item-info">
                  <div className="sell-popup-item-name" style={{ color: GRADE_COLORS[si.grade] || '#eee' }}>
                    {si.name}{si.enhance_level > 0 ? ` +${si.enhance_level}` : ''}
                  </div>
                  <div className="sell-popup-item-meta">
                    {si.grade && si.type !== 'potion' && si.type !== 'talisman' && (
                      <span className="sell-popup-grade" style={{ color: GRADE_COLORS[si.grade] }}>{si.grade}</span>
                    )}
                    <span className="sell-popup-type">{TYPE_LABELS[si.type] || si.type}</span>
                    {si.type === 'weapon' && si.weapon_hand && <span className="weapon-hand-tag">{si.weapon_hand === '2h' ? '양손' : '한손'}</span>}
                  </div>
                  <div className="sell-popup-desc">{si.description}</div>
                </div>
              </div>

              {/* 스탯 */}
              <div className="sell-popup-stats">
                {si.effect_hp !== 0 && <span className="eff hp">HP+{si.effect_hp}</span>}
                {si.effect_mp !== 0 && <span className="eff mp">MP+{si.effect_mp}</span>}
                {!!si.effect_phys_attack && <span className="eff atk">물공+{si.effect_phys_attack}</span>}
                {!!si.effect_mag_attack && <span className="eff atk">마공+{si.effect_mag_attack}</span>}
                {!!si.effect_phys_defense && <span className="eff def">물방+{si.effect_phys_defense}</span>}
                {!!si.effect_mag_defense && <span className="eff def">마방+{si.effect_mag_defense}</span>}
                {!!si.effect_crit_rate && <span className="eff atk">치명+{si.effect_crit_rate}</span>}
                {!!si.effect_evasion && <span className="eff def">회피+{si.effect_evasion}</span>}
              </div>

              {/* 구분선 */}
              <div className="sell-popup-divider" />

              {/* 판매 영역 */}
              <div className="sell-popup-sell-section">
                {isPotion && maxQty > 1 && (
                  <div className="sell-popup-qty-row">
                    <span className="sell-popup-qty-label">판매 수량</span>
                    <div className="sell-popup-qty-controls">
                      <button className="sell-qty-btn" onClick={() => setSellQty(q => Math.max(1, q - 10))} disabled={sellQty <= 1}>-10</button>
                      <button className="sell-qty-btn" onClick={() => setSellQty(q => Math.max(1, q - 1))} disabled={sellQty <= 1}>-</button>
                      <input
                        type="number"
                        className="sell-qty-input"
                        value={sellQty}
                        min={1}
                        max={maxQty}
                        onChange={e => {
                          const v = parseInt(e.target.value) || 1;
                          setSellQty(Math.max(1, Math.min(maxQty, v)));
                        }}
                      />
                      <button className="sell-qty-btn" onClick={() => setSellQty(q => Math.min(maxQty, q + 1))} disabled={sellQty >= maxQty}>+</button>
                      <button className="sell-qty-btn" onClick={() => setSellQty(q => Math.min(maxQty, q + 10))} disabled={sellQty >= maxQty}>+10</button>
                      <button className="sell-qty-btn max" onClick={() => setSellQty(maxQty)}>MAX</button>
                    </div>
                    <div className="sell-popup-qty-info">보유: {maxQty}개</div>
                  </div>
                )}
                <div className="sell-popup-price-row">
                  <div className="sell-popup-price-label">판매 가격</div>
                  <div className="sell-popup-price-value">
                    <img src="/ui/gold_coin.png" alt="" className="sell-popup-gold-icon" onError={e => { e.target.style.display='none'; }} />
                    <span className="sell-popup-gold-amount">{totalSellGold.toLocaleString()}G</span>
                    {isPotion && sellQty > 1 && <span className="sell-popup-unit-price">({si.sell_price}G × {sellQty})</span>}
                  </div>
                </div>
              </div>

              {/* 버튼 영역 */}
              <div className="sell-popup-actions">
                <button className="sell-popup-action-btn sell" onClick={() => { handleSell(si, sellQty); setSelectedInvItem(null); }}>
                  판매
                </button>
                <button className="sell-popup-action-btn cancel" onClick={() => setSelectedInvItem(null)}>
                  닫기
                </button>
              </div>
            </div>
          </div>
        );
      })()}

      {/* 구매 확인 팝업 */}
      {confirmPopup && (
        <div className="shop-popup-overlay" onClick={() => setConfirmPopup(null)}>
          <div className="shop-popup" onClick={(e) => e.stopPropagation()}>
            <div className="shop-popup-badge" style={{ background: 'linear-gradient(135deg, #3b82f6, #6366f1)' }}>구매 확인</div>
            <div className="shop-popup-item">
              <ShopImg itemId={confirmPopup.id} type={confirmPopup.type} className="shop-popup-icon" />
              <div className="shop-popup-item-info">
                <div className="shop-popup-item-name" style={{ color: GRADE_COLORS[confirmPopup.grade] || '#eee' }}>
                  {confirmPopup.name}
                </div>
                {confirmPopup.grade && confirmPopup.type !== 'potion' && confirmPopup.type !== 'talisman' && (
                  <span className="shop-popup-grade" style={{ color: GRADE_COLORS[confirmPopup.grade] }}>{confirmPopup.grade}</span>
                )}
              </div>
            </div>
            <div className="shop-popup-gold" style={{ marginTop: 8 }}>
              <img src="/ui/gold_coin.png" alt="" className="shop-popup-gold-icon" onError={(e) => { e.target.style.display='none'; }} />
              <span className="shop-popup-gold-spent">{confirmPopup.price.toLocaleString()}G</span>
              <span className="shop-popup-gold-remain">잔액 {((charState.gold || 0) - confirmPopup.price).toLocaleString()}G</span>
            </div>
            <div style={{ color: '#aaa', fontSize: 13, marginTop: 10, textAlign: 'center' }}>정말 구매하시겠습니까?</div>
            <div style={{ display: 'flex', gap: 10, marginTop: 14, justifyContent: 'center' }}>
              <button className="shop-popup-btn" style={{ background: 'linear-gradient(135deg, #6366f1, #8b5cf6)', flex: 1 }}
                onClick={() => { const item = confirmPopup; setConfirmPopup(null); handleBuy(item); }}>구매</button>
              <button className="shop-popup-btn" style={{ background: 'linear-gradient(135deg, #4b5563, #6b7280)', flex: 1 }}
                onClick={() => setConfirmPopup(null)}>취소</button>
            </div>
          </div>
        </div>
      )}

      {/* 코스메틱 장착 대상 선택 팝업 */}
      {cosmeticEquipPopup && (
        <div className="shop-popup-overlay" onClick={() => setCosmeticEquipPopup(null)}>
          <div className="shop-popup" onClick={e => e.stopPropagation()} style={{ maxWidth: 380 }}>
            <div className="shop-popup-badge" style={{ background: 'linear-gradient(135deg, #8b5cf6, #6366f1)' }}>코스메틱 장착</div>
            <div style={{ padding: '10px 0', color: '#ccc', fontSize: 13, textAlign: 'center' }}>
              <strong style={{ color: COSMETIC_EFFECT_COLORS[cosmeticEquipPopup.cosmetic_effect] || '#eee' }}>{cosmeticEquipPopup.name}</strong>
              <span> 을(를) 장착할 대상을 선택하세요.</span>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, padding: '8px 0' }}>
              <button className="shop-popup-btn" style={{ background: equippedCosmetics['player'] ? 'linear-gradient(135deg, #f59e0b, #d97706)' : 'linear-gradient(135deg, #6366f1, #8b5cf6)' }}
                onClick={() => handleCosmeticEquip(cosmeticEquipPopup.inv_id, 'character', 0)}>
                {character?.name || '캐릭터'} {equippedCosmetics['player'] ? `(현재: ${equippedCosmetics['player'].itemName})` : ''}
              </button>
              {mercenaries.map(m => {
                const key = `merc_${m.id}`;
                return (
                  <button key={m.id} className="shop-popup-btn" style={{ background: equippedCosmetics[key] ? 'linear-gradient(135deg, #f59e0b, #d97706)' : 'linear-gradient(135deg, #6366f1, #8b5cf6)' }}
                    onClick={() => handleCosmeticEquip(cosmeticEquipPopup.inv_id, 'mercenary', m.id)}>
                    {m.name} {equippedCosmetics[key] ? `(현재: ${equippedCosmetics[key].itemName})` : ''}
                  </button>
                );
              })}
            </div>
            <button className="shop-popup-btn" style={{ background: 'linear-gradient(135deg, #4b5563, #6b7280)', marginTop: 8 }}
              onClick={() => setCosmeticEquipPopup(null)}>취소</button>
          </div>
        </div>
      )}

      {/* 코스메틱 효과 미리보기 팝업 */}
      {cosmeticPreview && (
        <div className="shop-popup-overlay" onClick={() => setCosmeticPreview(null)}>
          <div className="shop-popup" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 320 }}>
            <div className="shop-popup-badge" style={{ background: `linear-gradient(135deg, ${COSMETIC_EFFECT_COLORS[cosmeticPreview] || '#8b5cf6'}, ${COSMETIC_EFFECT_COLORS[cosmeticPreview] || '#6366f1'}88)` }}>
              효과 미리보기
            </div>
            <div className="cosmetic-preview-container">
              <div className="cosmetic-preview-portrait">
                <img src={`/characters/${character.class_type}_icon.png`} alt="" className="cosmetic-preview-img" />
                <div className={`cb-portrait-effect cb-effect-${cosmeticPreview}`} />
              </div>
              <div className="cosmetic-preview-label" style={{ color: COSMETIC_EFFECT_COLORS[cosmeticPreview] }}>
                {COSMETIC_EFFECT_LABELS[cosmeticPreview] || cosmeticPreview}
              </div>
              <div className="cosmetic-preview-desc">
                전투 중 초상화에 적용되는 효과입니다.
              </div>
            </div>
            <button className="shop-popup-btn" onClick={() => setCosmeticPreview(null)}>닫기</button>
          </div>
        </div>
      )}

      {/* 구매 성공 팝업 */}
      {purchasePopup && (
        <div className="shop-popup-overlay" onClick={() => setPurchasePopup(null)}>
          <div className="shop-popup" onClick={(e) => e.stopPropagation()}>
            <div className="shop-popup-glow" />
            <div className="shop-popup-badge">구매 성공</div>
            <div className="shop-popup-item">
              <ShopImg itemId={purchasePopup.item.id} type={purchasePopup.item.type} className="shop-popup-icon" />
              <div className="shop-popup-item-info">
                <div className="shop-popup-item-name" style={{ color: GRADE_COLORS[purchasePopup.item.grade] || '#eee' }}>
                  {purchasePopup.item.name}
                </div>
                {purchasePopup.item.grade && purchasePopup.item.type !== 'potion' && purchasePopup.item.type !== 'talisman' && (
                  <span className="shop-popup-grade" style={{ color: GRADE_COLORS[purchasePopup.item.grade] }}>{purchasePopup.item.grade}</span>
                )}
              </div>
            </div>
            <div className="shop-popup-stats">
              {purchasePopup.item.effect_hp !== 0 && <span className="eff hp">HP+{purchasePopup.item.effect_hp}</span>}
              {purchasePopup.item.effect_mp !== 0 && <span className="eff mp">MP+{purchasePopup.item.effect_mp}</span>}
              {!!purchasePopup.item.effect_phys_attack && <span className="eff atk">물공+{purchasePopup.item.effect_phys_attack}</span>}
              {!!purchasePopup.item.effect_mag_attack && <span className="eff atk">마공+{purchasePopup.item.effect_mag_attack}</span>}
              {!!purchasePopup.item.effect_phys_defense && <span className="eff def">물방+{purchasePopup.item.effect_phys_defense}</span>}
              {!!purchasePopup.item.effect_mag_defense && <span className="eff def">마방+{purchasePopup.item.effect_mag_defense}</span>}
              {!!purchasePopup.item.effect_crit_rate && <span className="eff atk">치명+{purchasePopup.item.effect_crit_rate}</span>}
              {!!purchasePopup.item.effect_evasion && <span className="eff def">회피+{purchasePopup.item.effect_evasion}</span>}
            </div>
            <div className="shop-popup-gold">
              <img src="/ui/gold_coin.png" alt="" className="shop-popup-gold-icon" onError={(e) => { e.target.style.display='none'; }} />
              <span className="shop-popup-gold-spent">-{purchasePopup.goldSpent.toLocaleString()}G</span>
              <span className="shop-popup-gold-remain">잔액 {purchasePopup.remainGold.toLocaleString()}G</span>
            </div>
            <button className="shop-popup-btn" onClick={() => setPurchasePopup(null)}>확인</button>
          </div>
        </div>
      )}
    </div>
  );
}

export default Shop;
