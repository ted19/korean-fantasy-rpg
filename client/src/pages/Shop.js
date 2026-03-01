import React, { useState, useEffect } from 'react';
import api from '../api';

const TYPE_LABELS = { weapon: '무기', chest: '갑옷', helmet: '투구', boots: '장화', ring: '반지', necklace: '목걸이', shield: '방패', potion: '물약', armor: '방어구' };
const TYPE_ICONS = { weapon: '⚔️', chest: '🛡️', helmet: '🪖', boots: '👢', ring: '💍', necklace: '📿', shield: '🛡️', potion: '🧪', armor: '🛡️' };
const GRADE_COLORS = { '일반': '#aaa', '고급': '#4ade80', '희귀': '#60a5fa', '영웅': '#c084fc', '전설': '#fbbf24', '신화': '#ff6b6b' };

function ShopImg({ itemId, type, className }) {
  const [err, setErr] = useState(false);
  if (err || !itemId) return <span className={className}>{TYPE_ICONS[type] || '📦'}</span>;
  return <img src={`/equipment/${itemId}_icon.png`} alt="" className={className} onError={() => setErr(true)} />;
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
      const [shopRes, invRes] = await Promise.all([
        api.get('/shop/items'),
        api.get('/shop/inventory'),
      ]);
      setShopItems(shopRes.data.items);
      setInventory(invRes.data.inventory);
    } catch {
      onLog('상점 정보를 불러올 수 없습니다.', 'damage');
    }
  };

  useEffect(() => { loadData(); }, []);

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
      loadData();
    } catch (err) {
      onLog(err.response?.data?.message || '구매 실패', 'damage');
      setNpcMsg('흠, 그건 좀 어렵겠는걸...');
    }
  };

  const handleSell = async (item) => {
    try {
      const res = await api.post('/shop/sell', { itemId: item.item_id });
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

  const canBuy = (item) => {
    if (charState.gold < item.price) return false;
    if (charState.level < item.required_level) return false;
    if (item.class_restriction && item.class_restriction !== character.class_type) return false;
    return true;
  };

  const filteredShopItems = typeFilter === 'all'
    ? shopItems
    : shopItems.filter((i) => i.type === typeFilter);

  const filteredInventory = typeFilter === 'all'
    ? inventory
    : inventory.filter((i) => i.type === typeFilter);

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

      {/* Tabs */}
      <div className="facility-tabs">
        <button className={`facility-tab ${tab === 'buy' ? 'active' : ''}`} onClick={() => setTab('buy')}>
          구매
        </button>
        <button className={`facility-tab ${tab === 'inventory' ? 'active' : ''}`} onClick={() => setTab('inventory')}>
          인벤토리 <span className="tab-badge">{inventory.length}</span>
        </button>
      </div>

      {/* Filters */}
      <div className="facility-filters">
        {['all', 'weapon', 'chest', 'helmet', 'boots', 'shield', 'ring', 'necklace', 'potion'].map((t) => (
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
            const restricted = item.class_restriction && item.class_restriction !== character.class_type;
            return (
              <div key={item.id} className={`facility-item-card ${restricted ? 'restricted' : ''}`}>
                <div className="fitem-top">
                  <ShopImg itemId={item.id} type={item.type} className="fitem-icon" />
                  <div className="fitem-info">
                    <div className="fitem-name">
                      <span style={{ color: GRADE_COLORS[item.grade] || '#aaa' }}>{item.name}</span>
                      {item.grade && item.type !== 'potion' && <span className="fitem-grade" style={{ color: GRADE_COLORS[item.grade] }}>[{item.grade}]</span>}
                      {item.class_restriction && <span className="fitem-class">{item.class_restriction}</span>}
                    </div>
                    <div className="fitem-desc">{item.description}</div>
                  </div>
                </div>
                <div className="fitem-effects">
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
                    onClick={() => handleBuy(item)}
                    disabled={!canBuy(item)}
                  >
                    {restricted ? '착용불가' : charState.gold < item.price ? '골드부족' : charState.level < item.required_level ? '레벨부족' : '구매'}
                  </button>
                </div>
              </div>
            );
          })}
          {filteredShopItems.length === 0 && <div className="facility-empty">판매 중인 아이템이 없습니다.</div>}
        </div>
      ) : (
        <div className="facility-item-list">
          {filteredInventory.length === 0 ? (
            <div className="facility-empty">인벤토리가 비어있습니다.</div>
          ) : (
            filteredInventory.map((item) => (
              <div key={item.item_id} className={`facility-item-card ${item.equipped ? 'equipped' : ''}`}>
                <div className="fitem-top">
                  <ShopImg itemId={item.item_id} type={item.type} className="fitem-icon" />
                  <div className="fitem-info">
                    <div className="fitem-name">
                      {item.name}
                      {item.equipped ? <span className="fitem-equipped-tag">장착중</span> : null}
                      {item.type === 'potion' && item.quantity > 1 && <span className="fitem-qty">x{item.quantity}</span>}
                    </div>
                    <div className="fitem-desc">{item.description}</div>
                  </div>
                </div>
                <div className="fitem-effects">
                  {item.effect_hp !== 0 && <span className="eff hp">HP+{item.effect_hp}</span>}
                  {item.effect_mp !== 0 && <span className="eff mp">MP+{item.effect_mp}</span>}
                  {!!item.effect_phys_attack && <span className="eff atk">물공+{item.effect_phys_attack}</span>}
                  {!!item.effect_mag_attack && <span className="eff atk">마공+{item.effect_mag_attack}</span>}
                  {!!item.effect_phys_defense && <span className="eff def">물방+{item.effect_phys_defense}</span>}
                  {!!item.effect_mag_defense && <span className="eff def">마방+{item.effect_mag_defense}</span>}
                  {!!item.effect_crit_rate && <span className="eff atk">치명+{item.effect_crit_rate}</span>}
                  {!!item.effect_evasion && <span className="eff def">회피+{item.effect_evasion}</span>}
                </div>
                <div className="fitem-bottom">
                  <span className="fitem-price sell">{item.sell_price}G</span>
                  <div className="fitem-actions">
                    {item.type === 'potion' && (
                      <button className="fitem-btn use" onClick={() => handleUse(item)}>사용</button>
                    )}
                    <button className="fitem-btn sell" onClick={() => handleSell(item)}>판매</button>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}

export default Shop;
