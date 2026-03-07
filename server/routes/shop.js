const express = require('express');
const jwt = require('jsonwebtoken');
const { pool } = require('../db');

const router = express.Router();
const JWT_SECRET = 'game-secret-key-change-in-production';

function auth(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader) {
    return res.status(401).json({ message: '인증 토큰이 필요합니다.' });
  }
  try {
    req.user = jwt.verify(authHeader.split(' ')[1], JWT_SECRET);
    next();
  } catch {
    return res.status(401).json({ message: '유효하지 않은 토큰입니다.' });
  }
}

// 상점 재고 테이블 초기화 (캐릭터별)
(async () => {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS shop_stock (
      id INT AUTO_INCREMENT PRIMARY KEY,
      character_id INT NOT NULL,
      item_id INT NOT NULL,
      refresh_at DATETIME NOT NULL,
      sold TINYINT(1) NOT NULL DEFAULT 0,
      INDEX idx_char_refresh (character_id, refresh_at)
    )
  `).catch(() => {});
  // character_id 컬럼이 없을 수 있으므로 추가 시도
  await pool.query(`ALTER TABLE shop_stock ADD COLUMN character_id INT NOT NULL DEFAULT 0 AFTER id`).catch(() => {});
  await pool.query(`ALTER TABLE shop_stock ADD INDEX idx_char_refresh (character_id, refresh_at)`).catch(() => {});
  await pool.query(`ALTER TABLE shop_stock ADD COLUMN sold TINYINT(1) NOT NULL DEFAULT 0`).catch(() => {});
})();

const REFRESH_INTERVAL_MS = 5 * 60 * 60 * 1000; // 5시간
const SHOP_ITEM_COUNT = 8;

async function refreshShopStock(conn, characterId, classType) {
  const now = Date.now();
  const epoch = new Date('2025-01-01T00:00:00Z').getTime();
  const windowStart = epoch + Math.floor((now - epoch) / REFRESH_INTERVAL_MS) * REFRESH_INTERVAL_MS;
  const refreshAt = new Date(windowStart + REFRESH_INTERVAL_MS);
  const refreshAtStr = refreshAt.toISOString().slice(0, 19).replace('T', ' ');

  // 이미 현재 윈도우 재고가 있는지 확인 (캐릭터별)
  const [existing] = await conn.query(
    'SELECT id FROM shop_stock WHERE character_id = ? AND refresh_at = ? LIMIT 1',
    [characterId, refreshAtStr]
  );
  if (existing.length > 0) return refreshAt;

  // 해당 캐릭터의 기존 재고 삭제
  await conn.query('DELETE FROM shop_stock WHERE character_id = ?', [characterId]);

  // 캐릭터 레벨에 맞는 장비 + 물약에서 랜덤 선택
  // 현재 레벨 +10 범위까지의 아이템만 표시 (너무 높은 장비 제외)
  const [charRow] = await conn.query('SELECT level FROM characters WHERE id = ?', [characterId]);
  const charLevel = charRow.length > 0 ? charRow[0].level : 1;
  const maxItemLevel = Math.min(100, charLevel + 10);

  const [candidates] = await conn.query(
    `SELECT id FROM items
     WHERE (class_restriction IS NULL OR class_restriction = ?)
       AND type != 'cosmetic'
       AND required_level <= ?
       AND IFNULL(grade, '일반') IN ('일반', '고급')
     ORDER BY RAND()
     LIMIT ?`,
    [classType, maxItemLevel, SHOP_ITEM_COUNT]
  );

  if (candidates.length > 0) {
    const values = candidates.map(r => `(${characterId}, ${r.id}, '${refreshAtStr}')`).join(',');
    await conn.query(`INSERT INTO shop_stock (character_id, item_id, refresh_at) VALUES ${values}`);
  }

  return refreshAt;
}

// 상점 아이템 목록
router.get('/items', auth, async (req, res) => {
  try {
    const [chars] = await pool.query(
      req.selectedCharId
        ? 'SELECT id, class_type FROM characters WHERE id = ? AND user_id = ?'
        : 'SELECT id, class_type FROM characters WHERE user_id = ? ORDER BY id LIMIT 1',
      req.selectedCharId ? [req.selectedCharId, req.user.id] : [req.user.id]
    );
    if (chars.length === 0) return res.json({ items: [], refreshAt: null });
    const char = chars[0];

    const refreshAt = await refreshShopStock(pool, char.id, char.class_type);

    const [items] = await pool.query(
      `SELECT i.* FROM items i
       JOIN shop_stock ss ON i.id = ss.item_id
       WHERE ss.character_id = ? AND ss.sold = 0
       ORDER BY i.type, i.required_level, i.price`,
      [char.id]
    );
    res.json({ items, refreshAt });
  } catch (err) {
    console.error('Shop items error:', err);
    res.status(500).json({ message: '서버 오류가 발생했습니다.' });
  }
});

// 내 인벤토리
router.get('/inventory', auth, async (req, res) => {
  try {
    const [chars] = await pool.query(
      req.selectedCharId
        ? 'SELECT id FROM characters WHERE id = ? AND user_id = ?'
        : 'SELECT id FROM characters WHERE user_id = ? ORDER BY id LIMIT 1',
      req.selectedCharId ? [req.selectedCharId, req.user.id] : [req.user.id]
    );
    if (chars.length === 0) return res.json({ inventory: [] });

    const charId = chars[0].id;

    // 장착된 item_id별 개수 카운트 (캐릭터 + 소환수 + 용병)
    const equippedCountMap = {};
    const addCount = (rows) => { for (const r of rows) equippedCountMap[r.item_id] = (equippedCountMap[r.item_id] || 0) + 1; };

    const [charEquipped] = await pool.query('SELECT item_id FROM equipment WHERE character_id = ?', [charId]);
    addCount(charEquipped);

    const [summonEquipped] = await pool.query(
      `SELECT se.item_id FROM summon_equipment se
       JOIN character_summons cs ON se.summon_id = cs.id
       WHERE cs.character_id = ? AND se.item_id IS NOT NULL`,
      [charId]
    );
    addCount(summonEquipped);

    const [mercEquipped] = await pool.query(
      `SELECT me.item_id FROM mercenary_equipment me
       JOIN character_mercenaries cm ON me.mercenary_id = cm.id
       WHERE cm.character_id = ?`,
      [charId]
    );
    addCount(mercEquipped);

    const [cosmeticEquipped] = await pool.query('SELECT item_id FROM equipped_cosmetics WHERE character_id = ?', [charId]);
    addCount(cosmeticEquipped);

    const [inventory] = await pool.query(
      `SELECT i.id as inv_id, i.*, it.name, it.type, it.slot, it.description, it.price, it.sell_price,
              it.effect_hp, it.effect_mp, it.effect_attack, it.effect_defense,
              it.effect_phys_attack, it.effect_phys_defense, it.effect_mag_attack, it.effect_mag_defense,
              it.effect_crit_rate, it.effect_evasion, it.class_restriction,
              IFNULL(it.grade, '일반') as grade,
              IFNULL(i.enhance_level, 0) as enhance_level,
              IFNULL(it.max_enhance, 0) as max_enhance,
              it.cosmetic_effect
       FROM inventory i
       JOIN items it ON i.item_id = it.id
       WHERE i.character_id = ?
       ORDER BY it.type, it.name`,
      [charId]
    );

    // 장비: 장착중인 개수만큼 제외, 물약: 수량 그대로
    const usedCount = {};
    const result = inventory.filter(i => {
      if (i.type === 'potion') return i.quantity > 0;
      const equipped = equippedCountMap[i.item_id] || 0;
      const used = usedCount[i.item_id] || 0;
      if (used < equipped) {
        usedCount[i.item_id] = used + 1;
        return false;
      }
      return true;
    }).map(i => ({ ...i, available_qty: i.type === 'potion' ? i.quantity : 1 }));

    res.json({ inventory: result });
  } catch (err) {
    console.error('Inventory error:', err);
    res.status(500).json({ message: '서버 오류가 발생했습니다.' });
  }
});

// 아이템 구매
router.post('/buy', auth, async (req, res) => {
  const conn = await pool.getConnection();
  try {
    const { itemId, quantity: rawQty = 1 } = req.body;
    const quantity = Math.max(1, Math.min(99, Math.floor(Number(rawQty) || 1)));

    const [chars] = await conn.query(
      req.selectedCharId
        ? 'SELECT * FROM characters WHERE id = ? AND user_id = ?'
        : 'SELECT * FROM characters WHERE user_id = ? ORDER BY id LIMIT 1',
      req.selectedCharId ? [req.selectedCharId, req.user.id] : [req.user.id]
    );
    if (chars.length === 0) return res.status(404).json({ message: '캐릭터가 없습니다.' });
    const char = chars[0];

    // 상점 재고에 있는 아이템인지 확인 (sold=0인 것만)
    const [stockCheck] = await conn.query(
      'SELECT id FROM shop_stock WHERE character_id = ? AND item_id = ? AND sold = 0',
      [char.id, itemId]
    );
    if (stockCheck.length === 0) return res.status(400).json({ message: '상점에 해당 아이템이 없습니다.' });

    const [items] = await conn.query('SELECT * FROM items WHERE id = ?', [itemId]);
    if (items.length === 0) return res.status(404).json({ message: '아이템을 찾을 수 없습니다.' });
    const item = items[0];

    if (char.level < item.required_level) {
      return res.status(400).json({ message: `레벨 ${item.required_level} 이상만 구매할 수 있습니다.` });
    }

    if (item.class_restriction && item.class_restriction !== char.class_type) {
      return res.status(400).json({ message: `${item.class_restriction} 전용 아이템입니다.` });
    }

    const totalPrice = item.price * quantity;
    const gold = char.gold || 0;
    if (gold < totalPrice) {
      return res.status(400).json({ message: `골드가 부족합니다. (필요: ${totalPrice}G, 보유: ${gold}G)` });
    }

    await conn.beginTransaction();

    await conn.query('UPDATE characters SET gold = gold - ? WHERE id = ?', [totalPrice, char.id]);

    if (item.type === 'potion') {
      // 물약: 수량 스택 (최대 99)
      const [existing] = await conn.query(
        'SELECT quantity FROM inventory WHERE character_id = ? AND item_id = ?',
        [char.id, item.id]
      );
      const currentQty = existing.length > 0 ? existing[0].quantity : 0;
      if (currentQty + quantity > 99) {
        await conn.rollback();
        return res.status(400).json({ message: `물약은 최대 99개까지 보유할 수 있습니다. (현재: ${currentQty}개)` });
      }
      await conn.query(
        `INSERT INTO inventory (character_id, item_id, quantity)
         VALUES (?, ?, ?)
         ON DUPLICATE KEY UPDATE quantity = quantity + ?`,
        [char.id, item.id, quantity, quantity]
      );
    } else {
      // 장비: 개별 행으로 삽입 (각각 강화 가능)
      for (let i = 0; i < quantity; i++) {
        await conn.query(
          'INSERT INTO inventory (character_id, item_id, quantity) VALUES (?, ?, 1)',
          [char.id, item.id]
        );
      }
    }

    // 상점 재고에서 판매 완료 처리
    await conn.query(
      'UPDATE shop_stock SET sold = 1 WHERE character_id = ? AND item_id = ? AND sold = 0 LIMIT 1',
      [char.id, item.id]
    );

    await conn.commit();

    const [updatedChar] = await pool.query('SELECT * FROM characters WHERE id = ?', [char.id]);

    res.json({
      message: `${item.name}${quantity > 1 ? ' x' + quantity : ''}을(를) 구매했습니다.`,
      gold: updatedChar[0].gold,
    });
  } catch (err) {
    await conn.rollback();
    console.error('Buy error:', err);
    res.status(500).json({ message: '서버 오류가 발생했습니다.' });
  } finally {
    conn.release();
  }
});

// 아이템 판매
router.post('/sell', auth, async (req, res) => {
  const conn = await pool.getConnection();
  try {
    const { itemId, invId, quantity = 1 } = req.body;

    const [chars] = await conn.query(
      req.selectedCharId
        ? 'SELECT * FROM characters WHERE id = ? AND user_id = ?'
        : 'SELECT * FROM characters WHERE user_id = ? ORDER BY id LIMIT 1',
      req.selectedCharId ? [req.selectedCharId, req.user.id] : [req.user.id]
    );
    if (chars.length === 0) return res.status(404).json({ message: '캐릭터가 없습니다.' });
    const char = chars[0];

    // invId가 있으면 특정 행, 없으면 item_id로 조회
    const [invRows] = invId
      ? await conn.query(
          `SELECT i.*, it.name, it.sell_price, it.type FROM inventory i JOIN items it ON i.item_id = it.id WHERE i.id = ? AND i.character_id = ?`,
          [invId, char.id]
        )
      : await conn.query(
          `SELECT i.*, it.name, it.sell_price, it.type FROM inventory i JOIN items it ON i.item_id = it.id WHERE i.character_id = ? AND i.item_id = ?`,
          [char.id, itemId]
        );
    if (invRows.length === 0) return res.status(404).json({ message: '보유하지 않은 아이템입니다.' });

    const inv = invRows[0];

    // 같은 item_id의 장착 개수 합산
    let equippedCount = 0;

    const [equipCheck] = await conn.query(
      'SELECT COUNT(*) as cnt FROM equipment WHERE character_id = ? AND item_id = ?',
      [char.id, inv.item_id]
    );
    equippedCount += equipCheck[0].cnt;

    const [summonEquip] = await conn.query(
      `SELECT COUNT(*) as cnt FROM summon_equipment se
       JOIN character_summons cs ON se.summon_id = cs.id
       WHERE cs.character_id = ? AND se.item_id = ?`,
      [char.id, inv.item_id]
    );
    equippedCount += summonEquip[0].cnt;

    const [mercEquip] = await conn.query(
      `SELECT COUNT(*) as cnt FROM mercenary_equipment me
       JOIN character_mercenaries cm ON me.mercenary_id = cm.id
       WHERE cm.character_id = ? AND me.item_id = ?`,
      [char.id, inv.item_id]
    );
    equippedCount += mercEquip[0].cnt;

    const [cosmeticEquip] = await conn.query(
      'SELECT COUNT(*) as cnt FROM equipped_cosmetics WHERE character_id = ? AND item_id = ?',
      [char.id, inv.item_id]
    );
    equippedCount += cosmeticEquip[0].cnt;

    // 같은 item_id의 인벤토리 총 보유 수 확인
    const [totalInv] = await conn.query(
      'SELECT COUNT(*) as cnt FROM inventory WHERE character_id = ? AND item_id = ?',
      [char.id, inv.item_id]
    );
    const totalOwned = totalInv[0].cnt;

    // 판매 후 장착 수보다 보유 수가 적어지면 차단
    if (totalOwned <= equippedCount) {
      return res.status(400).json({ message: '장착 중인 아이템은 해제 후 판매하세요.' });
    }

    await conn.beginTransaction();

    if (inv.type === 'potion') {
      // 물약: 수량 감소
      const sellQty = Math.min(quantity, inv.quantity);
      const totalGold = inv.sell_price * sellQty;
      if (inv.quantity <= sellQty) {
        await conn.query('DELETE FROM inventory WHERE id = ?', [inv.id]);
      } else {
        await conn.query('UPDATE inventory SET quantity = quantity - ? WHERE id = ?', [sellQty, inv.id]);
      }
      await conn.query('UPDATE characters SET gold = gold + ? WHERE id = ?', [totalGold, char.id]);
      await conn.commit();
      const [updatedChar] = await pool.query('SELECT * FROM characters WHERE id = ?', [char.id]);
      res.json({
        message: `${inv.name}${sellQty > 1 ? ' x' + sellQty : ''}을(를) ${totalGold}G에 판매했습니다.`,
        gold: updatedChar[0].gold,
      });
    } else {
      // 장비: 해당 행 삭제
      const totalGold = inv.sell_price;
      await conn.query('DELETE FROM inventory WHERE id = ?', [inv.id]);
      await conn.query('UPDATE characters SET gold = gold + ? WHERE id = ?', [totalGold, char.id]);
      await conn.commit();
      const [updatedChar] = await pool.query('SELECT * FROM characters WHERE id = ?', [char.id]);
      res.json({
        message: `${inv.name}을(를) ${totalGold}G에 판매했습니다.`,
        gold: updatedChar[0].gold,
      });
    }
  } catch (err) {
    await conn.rollback();
    console.error('Sell error:', err);
    res.status(500).json({ message: '서버 오류가 발생했습니다.' });
  } finally {
    conn.release();
  }
});

// 장비 장착/해제 (레거시 - 상점에서 사용)
router.post('/equip', auth, async (req, res) => {
  return res.status(400).json({ message: '장비 장착은 장비 화면에서 해주세요.' });
});

// 물약 사용
router.post('/use', auth, async (req, res) => {
  const conn = await pool.getConnection();
  try {
    const { itemId } = req.body;

    const [chars] = await conn.query(
      req.selectedCharId
        ? 'SELECT * FROM characters WHERE id = ? AND user_id = ?'
        : 'SELECT * FROM characters WHERE user_id = ? ORDER BY id LIMIT 1',
      req.selectedCharId ? [req.selectedCharId, req.user.id] : [req.user.id]
    );
    if (chars.length === 0) return res.status(404).json({ message: '캐릭터가 없습니다.' });
    const char = chars[0];

    const [invRows] = await conn.query(
      `SELECT i.*, it.name, it.type, it.effect_hp, it.effect_mp
       FROM inventory i JOIN items it ON i.item_id = it.id
       WHERE i.character_id = ? AND i.item_id = ?`,
      [char.id, itemId]
    );
    if (invRows.length === 0) return res.status(404).json({ message: '보유하지 않은 아이템입니다.' });

    const inv = invRows[0];
    if (inv.type !== 'potion') return res.status(400).json({ message: '사용할 수 없는 아이템입니다.' });

    await conn.beginTransaction();

    const currentHp = char.current_hp ?? char.hp;
    const currentMp = char.current_mp ?? char.mp;
    const newHp = Math.min(char.hp, currentHp + inv.effect_hp);
    const newMp = Math.min(char.mp, currentMp + inv.effect_mp);

    await conn.query('UPDATE characters SET current_hp = ?, current_mp = ? WHERE id = ?', [newHp, newMp, char.id]);

    if (inv.quantity <= 1) {
      await conn.query('DELETE FROM inventory WHERE id = ?', [inv.id]);
    } else {
      await conn.query('UPDATE inventory SET quantity = quantity - 1 WHERE id = ?', [inv.id]);
    }

    await conn.commit();

    res.json({
      message: `${inv.name}을(를) 사용했습니다.`,
      character: { current_hp: newHp, current_mp: newMp },
    });
  } catch (err) {
    await conn.rollback();
    console.error('Use item error:', err);
    res.status(500).json({ message: '서버 오류가 발생했습니다.' });
  } finally {
    conn.release();
  }
});

// 코스메틱 장착 현황 조회
router.get('/cosmetics/equipped', auth, async (req, res) => {
  try {
    const [chars] = await pool.query(
      req.selectedCharId
        ? 'SELECT id FROM characters WHERE id = ? AND user_id = ?'
        : 'SELECT id FROM characters WHERE user_id = ? ORDER BY id LIMIT 1',
      req.selectedCharId ? [req.selectedCharId, req.user.id] : [req.user.id]
    );
    if (chars.length === 0) return res.json({ cosmetics: {} });
    const charId = chars[0].id;

    const [rows] = await pool.query(
      `SELECT ec.entity_type, ec.entity_id, ec.item_id, i.cosmetic_effect, i.name as item_name
       FROM equipped_cosmetics ec
       JOIN items i ON ec.item_id = i.id
       WHERE ec.character_id = ?`,
      [charId]
    );

    const cosmetics = {};
    for (const r of rows) {
      const key = r.entity_type === 'character' ? 'player' : `merc_${r.entity_id}`;
      cosmetics[key] = { effect: r.cosmetic_effect, itemId: r.item_id, itemName: r.item_name };
    }
    res.json({ cosmetics });
  } catch (err) {
    console.error('Cosmetics equipped error:', err);
    res.status(500).json({ message: '서버 오류가 발생했습니다.' });
  }
});

// 코스메틱 장착
router.post('/cosmetic/equip', auth, async (req, res) => {
  const conn = await pool.getConnection();
  try {
    const { invId, entityType, entityId } = req.body;
    if (!invId || !entityType) return res.status(400).json({ message: '필수 파라미터가 누락되었습니다.' });

    const [chars] = await conn.query(
      req.selectedCharId
        ? 'SELECT id FROM characters WHERE id = ? AND user_id = ?'
        : 'SELECT id FROM characters WHERE user_id = ? ORDER BY id LIMIT 1',
      req.selectedCharId ? [req.selectedCharId, req.user.id] : [req.user.id]
    );
    if (chars.length === 0) return res.status(404).json({ message: '캐릭터가 없습니다.' });
    const charId = chars[0].id;

    // 인벤토리 확인
    const [invRows] = await conn.query(
      `SELECT i.*, it.cosmetic_effect, it.name as item_name FROM inventory i
       JOIN items it ON i.item_id = it.id
       WHERE i.id = ? AND i.character_id = ? AND it.type = 'cosmetic'`,
      [invId, charId]
    );
    if (invRows.length === 0) return res.status(404).json({ message: '보유하지 않은 코스메틱입니다.' });

    const eId = entityType === 'character' ? charId : (entityId || 0);

    await conn.query(
      `INSERT INTO equipped_cosmetics (character_id, entity_type, entity_id, item_id)
       VALUES (?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE item_id = VALUES(item_id)`,
      [charId, entityType, eId, invRows[0].item_id]
    );

    res.json({ message: `${invRows[0].item_name} 코스메틱을 장착했습니다.`, effect: invRows[0].cosmetic_effect });
  } catch (err) {
    console.error('Cosmetic equip error:', err);
    res.status(500).json({ message: '서버 오류가 발생했습니다.' });
  } finally {
    conn.release();
  }
});

// 코스메틱 해제
router.post('/cosmetic/unequip', auth, async (req, res) => {
  try {
    const { entityType, entityId } = req.body;

    const [chars] = await pool.query(
      req.selectedCharId
        ? 'SELECT id FROM characters WHERE id = ? AND user_id = ?'
        : 'SELECT id FROM characters WHERE user_id = ? ORDER BY id LIMIT 1',
      req.selectedCharId ? [req.selectedCharId, req.user.id] : [req.user.id]
    );
    if (chars.length === 0) return res.status(404).json({ message: '캐릭터가 없습니다.' });
    const charId = chars[0].id;

    const eId = entityType === 'character' ? charId : (entityId || 0);
    await pool.query(
      'DELETE FROM equipped_cosmetics WHERE character_id = ? AND entity_type = ? AND entity_id = ?',
      [charId, entityType, eId]
    );

    res.json({ message: '코스메틱을 해제했습니다.' });
  } catch (err) {
    console.error('Cosmetic unequip error:', err);
    res.status(500).json({ message: '서버 오류가 발생했습니다.' });
  }
});

module.exports = router;
