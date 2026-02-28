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

// 상점 아이템 목록
router.get('/items', auth, async (req, res) => {
  try {
    const [items] = await pool.query('SELECT * FROM items ORDER BY type, required_level, price');
    res.json({ items });
  } catch (err) {
    console.error('Shop items error:', err);
    res.status(500).json({ message: '서버 오류가 발생했습니다.' });
  }
});

// 내 인벤토리
router.get('/inventory', auth, async (req, res) => {
  try {
    const [chars] = await pool.query('SELECT id FROM characters WHERE user_id = ?', [req.user.id]);
    if (chars.length === 0) return res.json({ inventory: [] });

    const [inventory] = await pool.query(
      `SELECT i.*, it.name, it.type, it.description, it.price, it.sell_price,
              it.effect_hp, it.effect_mp, it.effect_attack, it.effect_defense,
              it.effect_phys_attack, it.effect_phys_defense, it.effect_mag_attack, it.effect_mag_defense,
              it.effect_crit_rate, it.effect_evasion, it.class_restriction
       FROM inventory i
       JOIN items it ON i.item_id = it.id
       WHERE i.character_id = ?
       ORDER BY it.type, it.name`,
      [chars[0].id]
    );

    res.json({ inventory });
  } catch (err) {
    console.error('Inventory error:', err);
    res.status(500).json({ message: '서버 오류가 발생했습니다.' });
  }
});

// 아이템 구매
router.post('/buy', auth, async (req, res) => {
  const conn = await pool.getConnection();
  try {
    const { itemId, quantity = 1 } = req.body;

    const [chars] = await conn.query('SELECT * FROM characters WHERE user_id = ?', [req.user.id]);
    if (chars.length === 0) return res.status(404).json({ message: '캐릭터가 없습니다.' });
    const char = chars[0];

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

    // 장비는 1개만
    if (item.type !== 'potion') {
      const [existing] = await conn.query(
        'SELECT id FROM inventory WHERE character_id = ? AND item_id = ?',
        [char.id, item.id]
      );
      if (existing.length > 0) {
        return res.status(400).json({ message: '이미 보유하고 있는 장비입니다.' });
      }
    }

    await conn.beginTransaction();

    await conn.query('UPDATE characters SET gold = gold - ? WHERE id = ?', [totalPrice, char.id]);

    if (item.type === 'potion') {
      await conn.query(
        `INSERT INTO inventory (character_id, item_id, quantity)
         VALUES (?, ?, ?)
         ON DUPLICATE KEY UPDATE quantity = quantity + ?`,
        [char.id, item.id, quantity, quantity]
      );
    } else {
      await conn.query(
        'INSERT INTO inventory (character_id, item_id, quantity, equipped) VALUES (?, ?, 1, 0)',
        [char.id, item.id]
      );
    }

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
    const { itemId, quantity = 1 } = req.body;

    const [chars] = await conn.query('SELECT * FROM characters WHERE user_id = ?', [req.user.id]);
    if (chars.length === 0) return res.status(404).json({ message: '캐릭터가 없습니다.' });
    const char = chars[0];

    const [invRows] = await conn.query(
      `SELECT i.*, it.name, it.sell_price, it.type, it.effect_attack, it.effect_defense, it.effect_hp, it.effect_mp
       FROM inventory i JOIN items it ON i.item_id = it.id
       WHERE i.character_id = ? AND i.item_id = ?`,
      [char.id, itemId]
    );
    if (invRows.length === 0) return res.status(404).json({ message: '보유하지 않은 아이템입니다.' });

    const inv = invRows[0];

    if (inv.equipped) {
      return res.status(400).json({ message: '장착 중인 아이템은 해제 후 판매하세요.' });
    }

    // 소환수 장착 중인 아이템 판매 차단
    const [summonEquip] = await conn.query(
      `SELECT se.id FROM summon_equipment se
       JOIN character_summons cs ON se.summon_id = cs.id
       WHERE cs.character_id = ? AND se.item_id = ?`,
      [char.id, itemId]
    );
    if (summonEquip.length > 0) {
      return res.status(400).json({ message: '소환수가 장착 중인 아이템은 해제 후 판매하세요.' });
    }

    const sellQty = Math.min(quantity, inv.quantity);
    const totalGold = inv.sell_price * sellQty;

    await conn.beginTransaction();

    if (inv.quantity <= sellQty) {
      await conn.query('DELETE FROM inventory WHERE character_id = ? AND item_id = ?', [char.id, itemId]);
    } else {
      await conn.query(
        'UPDATE inventory SET quantity = quantity - ? WHERE character_id = ? AND item_id = ?',
        [sellQty, char.id, itemId]
      );
    }

    await conn.query('UPDATE characters SET gold = gold + ? WHERE id = ?', [totalGold, char.id]);

    await conn.commit();

    const [updatedChar] = await pool.query('SELECT * FROM characters WHERE id = ?', [char.id]);

    res.json({
      message: `${inv.name}${sellQty > 1 ? ' x' + sellQty : ''}을(를) ${totalGold}G에 판매했습니다.`,
      gold: updatedChar[0].gold,
    });
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

    const [chars] = await conn.query('SELECT * FROM characters WHERE user_id = ?', [req.user.id]);
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
      await conn.query('DELETE FROM inventory WHERE character_id = ? AND item_id = ?', [char.id, itemId]);
    } else {
      await conn.query('UPDATE inventory SET quantity = quantity - 1 WHERE character_id = ? AND item_id = ?', [char.id, itemId]);
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

module.exports = router;
