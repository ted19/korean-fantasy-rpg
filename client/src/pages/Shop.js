import React, { useState, useEffect } from 'react';
import { Nav, Badge, Button } from 'react-bootstrap';
import api from '../api';

const TYPE_LABELS = { weapon: '무기', chest: '갑옷', helmet: '투구', boots: '장화', ring: '반지', necklace: '목걸이', shield: '방패', potion: '물약', armor: '방어구' };
const TYPE_ICONS = { weapon: '⚔️', chest: '🛡️', helmet: '🪖', boots: '👢', ring: '💍', necklace: '📿', shield: '🛡️', potion: '🧪', armor: '🛡️' };

function ShopImg({ itemId, type, className }) {
  const [err, setErr] = useState(false);
  if (err || !itemId) return <span className={className}>{TYPE_ICONS[type] || '📦'}</span>;
  return <img src={`/equipment/${itemId}_icon.png`} alt="" className={className} onError={() => setErr(true)} />;
}

function Shop({ character, charState, onCharStateUpdate, onLog }) {
  const [shopItems, setShopItems] = useState([]);
  const [inventory, setInventory] = useState([]);
  const [tab, setTab] = useState('buy');
  const [typeFilter, setTypeFilter] = useState('all');

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

  const handleBuy = async (item) => {
    try {
      const res = await api.post('/shop/buy', { itemId: item.id });
      onLog(res.data.message, 'heal');
      onCharStateUpdate({ gold: res.data.gold });
      loadData();
    } catch (err) {
      onLog(err.response?.data?.message || '구매 실패', 'damage');
    }
  };

  const handleSell = async (item) => {
    try {
      const res = await api.post('/shop/sell', { itemId: item.item_id });
      onLog(res.data.message, 'heal');
      onCharStateUpdate({ gold: res.data.gold });
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
    <div className="shop-container">
      <Nav variant="tabs" className="mb-3">
        <Nav.Item>
          <Nav.Link active={tab === 'buy'} onClick={() => setTab('buy')}>구매</Nav.Link>
        </Nav.Item>
        <Nav.Item>
          <Nav.Link active={tab === 'inventory'} onClick={() => setTab('inventory')}>
            인벤토리 <Badge bg="secondary" className="ms-1">{inventory.length}</Badge>
          </Nav.Link>
        </Nav.Item>
      </Nav>

      <div className="shop-filters">
        <Nav variant="pills" className="flex-wrap gap-1 flex-grow-1">
          {['all', 'weapon', 'chest', 'helmet', 'boots', 'shield', 'ring', 'necklace', 'potion'].map((t) => (
            <Nav.Item key={t}>
              <Nav.Link
                active={typeFilter === t}
                onClick={() => setTypeFilter(t)}
                className="py-1 px-2"
              >
                {t === 'all' ? '전체' : `${TYPE_ICONS[t] || ''} ${TYPE_LABELS[t] || t}`}
              </Nav.Link>
            </Nav.Item>
          ))}
        </Nav>
        <span className="shop-gold ms-2">{charState.gold}G</span>
      </div>

      {tab === 'buy' ? (
        <div className="shop-grid">
          {filteredShopItems.map((item) => {
            const restricted = item.class_restriction && item.class_restriction !== character.class_type;
            return (
              <div key={item.id} className={`shop-item ${restricted ? 'restricted' : ''}`}>
                <div className="item-top">
                  <ShopImg itemId={item.id} type={item.type} className="shop-item-img" />
                  <div className="item-info">
                    <div className="item-name">
                      {item.name}
                      {item.class_restriction && <Badge bg="dark" className="ms-1" style={{ fontSize: 10, color: 'var(--accent)' }}>{item.class_restriction}</Badge>}
                    </div>
                    <div className="item-desc">{item.description}</div>
                  </div>
                </div>
                <div className="item-effects">
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
                <div className="item-bottom">
                  <span className="item-price">{item.price}G</span>
                  <Button
                    size="sm"
                    variant="primary"
                    onClick={() => handleBuy(item)}
                    disabled={!canBuy(item)}
                  >
                    {restricted ? '착용불가' : charState.gold < item.price ? '골드부족' : charState.level < item.required_level ? '레벨부족' : '구매'}
                  </Button>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="shop-grid">
          {filteredInventory.length === 0 ? (
            <div className="empty-inv">인벤토리가 비어있습니다.</div>
          ) : (
            filteredInventory.map((item) => (
              <div key={item.item_id} className={`shop-item ${item.equipped ? 'equipped' : ''}`}>
                <div className="item-top">
                  <ShopImg itemId={item.item_id} type={item.type} className="shop-item-img" />
                  <div className="item-info">
                    <div className="item-name">
                      {item.name}
                      {item.equipped ? <Badge bg="success" className="ms-1" style={{ fontSize: 10 }}>장착중</Badge> : null}
                      {item.type === 'potion' && item.quantity > 1 && <span className="qty-tag ms-1">x{item.quantity}</span>}
                    </div>
                    <div className="item-desc">{item.description}</div>
                  </div>
                </div>
                <div className="item-effects">
                  {item.effect_hp !== 0 && <span className="eff hp">HP+{item.effect_hp}</span>}
                  {item.effect_mp !== 0 && <span className="eff mp">MP+{item.effect_mp}</span>}
                  {!!item.effect_phys_attack && <span className="eff atk">물공+{item.effect_phys_attack}</span>}
                  {!!item.effect_mag_attack && <span className="eff atk">마공+{item.effect_mag_attack}</span>}
                  {!!item.effect_phys_defense && <span className="eff def">물방+{item.effect_phys_defense}</span>}
                  {!!item.effect_mag_defense && <span className="eff def">마방+{item.effect_mag_defense}</span>}
                  {!!item.effect_crit_rate && <span className="eff atk">치명+{item.effect_crit_rate}</span>}
                  {!!item.effect_evasion && <span className="eff def">회피+{item.effect_evasion}</span>}
                </div>
                <div className="item-bottom">
                  <span className="item-price sell">{item.sell_price}G</span>
                  <div className="item-actions">
                    {item.type === 'potion' && (
                      <Button size="sm" variant="success" onClick={() => handleUse(item)}>사용</Button>
                    )}
                    <Button size="sm" variant="outline-danger" onClick={() => handleSell(item)}>판매</Button>
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
