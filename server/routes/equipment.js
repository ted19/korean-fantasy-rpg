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

const SLOT_NAMES = {
  helmet: '투구',
  chest: '갑옷',
  boots: '장화',
  weapon: '무기',
  shield: '방패',
  ring: '반지',
  necklace: '목걸이',
};

// 장비 슬롯 + 인벤토리 조회
router.get('/info', auth, async (req, res) => {
  try {
    const [chars] = await pool.query(
      req.selectedCharId
        ? 'SELECT * FROM characters WHERE id = ? AND user_id = ?'
        : 'SELECT * FROM characters WHERE user_id = ? ORDER BY id LIMIT 1',
      req.selectedCharId ? [req.selectedCharId, req.user.id] : [req.user.id]
    );
    if (chars.length === 0) return res.json({ equipped: {}, inventory: [] });

    const charId = chars[0].id;

    // 장착 중인 장비
    const [equipped] = await pool.query(
      `SELECT e.slot, e.item_id, it.*,
              IFNULL((SELECT inv.enhance_level FROM inventory inv WHERE inv.character_id = e.character_id AND inv.item_id = e.item_id LIMIT 1), 0) as enhance_level,
              IFNULL(it.max_enhance, 0) as max_enhance,
              IFNULL(it.grade, '일반') as grade
       FROM equipment e
       JOIN items it ON e.item_id = it.id
       WHERE e.character_id = ?`,
      [charId]
    );

    const equippedMap = {};
    equipped.forEach((e) => {
      equippedMap[e.slot] = {
        item_id: e.item_id,
        name: e.name,
        type: e.type,
        slot: e.slot,
        weapon_hand: e.weapon_hand,
        description: e.description,
        effect_hp: e.effect_hp,
        effect_mp: e.effect_mp,
        effect_attack: e.effect_attack,
        effect_defense: e.effect_defense,
        effect_phys_attack: e.effect_phys_attack || 0,
        effect_phys_defense: e.effect_phys_defense || 0,
        effect_mag_attack: e.effect_mag_attack || 0,
        effect_mag_defense: e.effect_mag_defense || 0,
        effect_crit_rate: e.effect_crit_rate || 0,
        effect_evasion: e.effect_evasion || 0,
        enhance_level: e.enhance_level || 0,
        max_enhance: e.max_enhance || 0,
        grade: e.grade || '일반',
      };
    });

    // 인벤토리 (장비류만, 장착 중인 것 제외)
    const [inventory] = await pool.query(
      `SELECT i.*, it.name, it.type, it.slot, it.weapon_hand, it.description, it.price, it.sell_price,
              it.effect_hp, it.effect_mp, it.effect_attack, it.effect_defense, it.required_level, it.class_restriction,
              IFNULL(it.effect_phys_attack,0) as effect_phys_attack,
              IFNULL(it.effect_phys_defense,0) as effect_phys_defense,
              IFNULL(it.effect_mag_attack,0) as effect_mag_attack,
              IFNULL(it.effect_mag_defense,0) as effect_mag_defense,
              IFNULL(it.effect_crit_rate,0) as effect_crit_rate,
              IFNULL(it.effect_evasion,0) as effect_evasion,
              IFNULL(it.max_enhance, 0) as max_enhance,
              IFNULL(it.grade, '일반') as grade,
              it.cosmetic_effect
       FROM inventory i
       JOIN items it ON i.item_id = it.id
       WHERE i.character_id = ? AND it.type != 'potion'
       ORDER BY it.type, it.name`,
      [charId]
    );

    // 장착 중인 item_id별 개수 카운트 (캐릭터 + 소환수 + 용병)
    const equippedCountMap = {};
    for (const e of equipped) {
      equippedCountMap[e.item_id] = (equippedCountMap[e.item_id] || 0) + 1;
    }

    const [summonEquipped] = await pool.query(
      `SELECT se.item_id FROM summon_equipment se
       JOIN character_summons cs ON se.summon_id = cs.id
       WHERE cs.character_id = ?`,
      [charId]
    );
    for (const e of summonEquipped) {
      equippedCountMap[e.item_id] = (equippedCountMap[e.item_id] || 0) + 1;
    }

    const [mercEquipped] = await pool.query(
      `SELECT me.item_id FROM mercenary_equipment me
       JOIN character_mercenaries cm ON me.mercenary_id = cm.id
       WHERE cm.character_id = ?`,
      [charId]
    );
    for (const e of mercEquipped) {
      equippedCountMap[e.item_id] = (equippedCountMap[e.item_id] || 0) + 1;
    }

    const [cosmeticEquipped] = await pool.query(
      'SELECT item_id FROM equipped_cosmetics WHERE character_id = ?', [charId]
    );
    for (const e of cosmeticEquipped) {
      equippedCountMap[e.item_id] = (equippedCountMap[e.item_id] || 0) + 1;
    }

    // 인벤토리에서 장착 중인 개수만큼 제외 (나머지는 표시)
    const usedCount = {};
    const availableInventory = inventory.filter((inv) => {
      const equipped = equippedCountMap[inv.item_id] || 0;
      const used = usedCount[inv.item_id] || 0;
      if (used < equipped) {
        usedCount[inv.item_id] = used + 1;
        return false;
      }
      return true;
    });

    // 물약(소모품)
    const [potions] = await pool.query(
      `SELECT i.id as inv_id, i.item_id, i.quantity, it.name, it.type, it.description, it.price, it.sell_price,
              it.effect_hp, it.effect_mp, IFNULL(it.grade, '일반') as grade
       FROM inventory i
       JOIN items it ON i.item_id = it.id
       WHERE i.character_id = ? AND it.type = 'potion' AND i.quantity > 0
       ORDER BY it.name`,
      [charId]
    );

    res.json({ equipped: equippedMap, inventory: availableInventory, potions });
  } catch (err) {
    console.error('Equipment info error:', err);
    res.status(500).json({ message: '서버 오류가 발생했습니다.' });
  }
});

// 장비 장착
router.post('/equip', auth, async (req, res) => {
  const conn = await pool.getConnection();
  try {
    const { itemId, slot } = req.body;

    const [chars] = await conn.query(
      req.selectedCharId
        ? 'SELECT * FROM characters WHERE id = ? AND user_id = ?'
        : 'SELECT * FROM characters WHERE user_id = ? ORDER BY id LIMIT 1',
      req.selectedCharId ? [req.selectedCharId, req.user.id] : [req.user.id]
    );
    if (chars.length === 0) return res.status(404).json({ message: '캐릭터가 없습니다.' });
    const char = chars[0];

    // 아이템 확인
    const [itemRows] = await conn.query('SELECT * FROM items WHERE id = ?', [itemId]);
    if (itemRows.length === 0) return res.status(404).json({ message: '아이템을 찾을 수 없습니다.' });
    const item = itemRows[0];

    // 인벤토리에 있는지 확인 (보유 개수)
    const [invRows] = await conn.query(
      'SELECT * FROM inventory WHERE character_id = ? AND item_id = ?',
      [char.id, itemId]
    );
    if (invRows.length === 0) return res.status(400).json({ message: '보유하지 않은 아이템입니다.' });
    const ownedCount = invRows.reduce((s, r) => s + (r.quantity || 1), 0);

    // 슬롯 유효성 검사
    if (item.slot !== slot) {
      return res.status(400).json({ message: '해당 슬롯에 장착할 수 없는 아이템입니다.' });
    }

    // 클래스 제한 검사
    if (item.class_restriction && item.class_restriction !== char.class_type) {
      return res.status(400).json({ message: `${item.class_restriction} 전용 아이템입니다.` });
    }

    // 레벨 제한 검사
    if (char.level < item.required_level) {
      return res.status(400).json({ message: `레벨 ${item.required_level} 이상만 장착할 수 있습니다.` });
    }

    // 장착 중인 총 개수 확인 (캐릭터 + 소환수 + 용병)
    const [eqCnt] = await conn.query('SELECT COUNT(*) as cnt FROM equipment WHERE character_id = ? AND item_id = ?', [char.id, itemId]);
    const [seCnt] = await conn.query(
      `SELECT COUNT(*) as cnt FROM summon_equipment se JOIN character_summons cs ON se.summon_id = cs.id WHERE cs.character_id = ? AND se.item_id = ?`,
      [char.id, itemId]
    );
    const [meCnt] = await conn.query(
      `SELECT COUNT(*) as cnt FROM mercenary_equipment me JOIN character_mercenaries cm ON me.mercenary_id = cm.id WHERE cm.character_id = ? AND me.item_id = ?`,
      [char.id, itemId]
    );
    const totalEquipped = (eqCnt[0].cnt || 0) + (seCnt[0].cnt || 0) + (meCnt[0].cnt || 0);
    if (totalEquipped >= ownedCount) {
      return res.status(400).json({ message: '사용 가능한 아이템이 없습니다. (모두 장착 중)' });
    }

    // 방패 장착 시 양손무기 체크
    if (slot === 'shield') {
      const [weaponEquip] = await conn.query(
        `SELECT e.item_id, it.weapon_hand FROM equipment e
         JOIN items it ON e.item_id = it.id
         WHERE e.character_id = ? AND e.slot = 'weapon'`,
        [char.id]
      );
      if (weaponEquip.length > 0 && weaponEquip[0].weapon_hand === '2h') {
        return res.status(400).json({ message: '양손 무기를 장착 중이라 방패를 장착할 수 없습니다.' });
      }
    }

    await conn.beginTransaction();

    // 양손 무기 장착 시 방패 자동 해제
    if (slot === 'weapon' && item.weapon_hand === '2h') {
      const [shieldEquip] = await conn.query(
        `SELECT e.item_id, it.effect_hp, it.effect_mp, it.effect_attack, it.effect_defense, it.effect_phys_attack, it.effect_phys_defense, it.effect_mag_attack, it.effect_mag_defense, it.effect_crit_rate, it.effect_evasion, it.name
         FROM equipment e JOIN items it ON e.item_id = it.id
         WHERE e.character_id = ? AND e.slot = 'shield'`,
        [char.id]
      );
      if (shieldEquip.length > 0) {
        const s = shieldEquip[0];
        await conn.query('DELETE FROM equipment WHERE character_id = ? AND slot = ?', [char.id, 'shield']);
        await conn.query(
          'UPDATE characters SET hp = hp - ?, mp = mp - ?, attack = attack - ?, defense = defense - ?, phys_attack = phys_attack - ?, phys_defense = phys_defense - ?, mag_attack = mag_attack - ?, mag_defense = mag_defense - ?, crit_rate = crit_rate - ?, evasion = evasion - ? WHERE id = ?',
          [s.effect_hp, s.effect_mp, s.effect_attack, s.effect_defense, s.effect_phys_attack||0, s.effect_phys_defense||0, s.effect_mag_attack||0, s.effect_mag_defense||0, s.effect_crit_rate||0, s.effect_evasion||0, char.id]
        );
      }
    }

    // 기존 장비 해제
    const [currentEquip] = await conn.query(
      `SELECT e.item_id, it.effect_hp, it.effect_mp, it.effect_attack, it.effect_defense, it.effect_phys_attack, it.effect_phys_defense, it.effect_mag_attack, it.effect_mag_defense, it.effect_crit_rate, it.effect_evasion, it.name
       FROM equipment e JOIN items it ON e.item_id = it.id
       WHERE e.character_id = ? AND e.slot = ?`,
      [char.id, slot]
    );

    if (currentEquip.length > 0) {
      const old = currentEquip[0];
      await conn.query('DELETE FROM equipment WHERE character_id = ? AND slot = ?', [char.id, slot]);
      await conn.query(
        'UPDATE characters SET hp = hp - ?, mp = mp - ?, attack = attack - ?, defense = defense - ?, phys_attack = phys_attack - ?, phys_defense = phys_defense - ?, mag_attack = mag_attack - ?, mag_defense = mag_defense - ?, crit_rate = crit_rate - ?, evasion = evasion - ? WHERE id = ?',
        [old.effect_hp, old.effect_mp, old.effect_attack, old.effect_defense, old.effect_phys_attack||0, old.effect_phys_defense||0, old.effect_mag_attack||0, old.effect_mag_defense||0, old.effect_crit_rate||0, old.effect_evasion||0, char.id]
      );
    }

    // 새 장비 장착
    await conn.query(
      'INSERT INTO equipment (character_id, slot, item_id) VALUES (?, ?, ?)',
      [char.id, slot, itemId]
    );
    await conn.query(
      'UPDATE characters SET hp = hp + ?, mp = mp + ?, attack = attack + ?, defense = defense + ?, phys_attack = phys_attack + ?, phys_defense = phys_defense + ?, mag_attack = mag_attack + ?, mag_defense = mag_defense + ?, crit_rate = crit_rate + ?, evasion = evasion + ? WHERE id = ?',
      [item.effect_hp, item.effect_mp, item.effect_attack, item.effect_defense, item.effect_phys_attack||0, item.effect_phys_defense||0, item.effect_mag_attack||0, item.effect_mag_defense||0, item.effect_crit_rate||0, item.effect_evasion||0, char.id]
    );

    // current_hp, current_mp 보정
    await conn.query('UPDATE characters SET current_hp = LEAST(current_hp, hp), current_mp = LEAST(current_mp, mp) WHERE id = ?', [char.id]);

    await conn.commit();

    const [updated] = await pool.query('SELECT * FROM characters WHERE id = ?', [char.id]);
    const c = updated[0];

    let msg = `${item.name}을(를) ${SLOT_NAMES[slot]}에 장착했습니다.`;
    if (currentEquip.length > 0) {
      msg = `${currentEquip[0].name} -> ${item.name}(으)로 교체했습니다.`;
    }

    res.json({
      message: msg,
      character: {
        hp: c.hp, mp: c.mp, attack: c.attack, defense: c.defense,
        phys_attack: c.phys_attack, phys_defense: c.phys_defense,
        mag_attack: c.mag_attack, mag_defense: c.mag_defense,
        crit_rate: c.crit_rate, evasion: c.evasion,
        current_hp: c.current_hp, current_mp: c.current_mp, gold: c.gold,
      },
    });
  } catch (err) {
    await conn.rollback();
    console.error('Equip error:', err);
    res.status(500).json({ message: '서버 오류가 발생했습니다.' });
  } finally {
    conn.release();
  }
});

// 장비 해제
router.post('/unequip', auth, async (req, res) => {
  const conn = await pool.getConnection();
  try {
    const { slot } = req.body;

    const [chars] = await conn.query(
      req.selectedCharId
        ? 'SELECT * FROM characters WHERE id = ? AND user_id = ?'
        : 'SELECT * FROM characters WHERE user_id = ? ORDER BY id LIMIT 1',
      req.selectedCharId ? [req.selectedCharId, req.user.id] : [req.user.id]
    );
    if (chars.length === 0) return res.status(404).json({ message: '캐릭터가 없습니다.' });
    const char = chars[0];

    const [equipRows] = await conn.query(
      `SELECT e.item_id, it.effect_hp, it.effect_mp, it.effect_attack, it.effect_defense, it.effect_phys_attack, it.effect_phys_defense, it.effect_mag_attack, it.effect_mag_defense, it.effect_crit_rate, it.effect_evasion, it.name
       FROM equipment e JOIN items it ON e.item_id = it.id
       WHERE e.character_id = ? AND e.slot = ?`,
      [char.id, slot]
    );
    if (equipRows.length === 0) return res.status(400).json({ message: '해당 슬롯에 장착된 장비가 없습니다.' });

    const equip = equipRows[0];

    await conn.beginTransaction();

    await conn.query('DELETE FROM equipment WHERE character_id = ? AND slot = ?', [char.id, slot]);
    await conn.query(
      'UPDATE characters SET hp = hp - ?, mp = mp - ?, attack = attack - ?, defense = defense - ?, phys_attack = phys_attack - ?, phys_defense = phys_defense - ?, mag_attack = mag_attack - ?, mag_defense = mag_defense - ?, crit_rate = crit_rate - ?, evasion = evasion - ? WHERE id = ?',
      [equip.effect_hp, equip.effect_mp, equip.effect_attack, equip.effect_defense, equip.effect_phys_attack||0, equip.effect_phys_defense||0, equip.effect_mag_attack||0, equip.effect_mag_defense||0, equip.effect_crit_rate||0, equip.effect_evasion||0, char.id]
    );
    await conn.query('UPDATE characters SET current_hp = LEAST(current_hp, hp), current_mp = LEAST(current_mp, mp) WHERE id = ?', [char.id]);

    await conn.commit();

    const [updated] = await pool.query('SELECT * FROM characters WHERE id = ?', [char.id]);
    const c = updated[0];

    res.json({
      message: `${equip.name}을(를) 해제했습니다.`,
      character: {
        hp: c.hp, mp: c.mp, attack: c.attack, defense: c.defense,
        phys_attack: c.phys_attack, phys_defense: c.phys_defense,
        mag_attack: c.mag_attack, mag_defense: c.mag_defense,
        crit_rate: c.crit_rate, evasion: c.evasion,
        current_hp: c.current_hp, current_mp: c.current_mp, gold: c.gold,
      },
    });
  } catch (err) {
    await conn.rollback();
    console.error('Unequip error:', err);
    res.status(500).json({ message: '서버 오류가 발생했습니다.' });
  } finally {
    conn.release();
  }
});

// 물약 사용
router.post('/use-potion', auth, async (req, res) => {
  try {
    const { invId } = req.body;
    if (!invId) return res.status(400).json({ message: '물약 정보가 필요합니다.' });

    const [chars] = await pool.query(
      req.selectedCharId
        ? 'SELECT * FROM characters WHERE id = ? AND user_id = ?'
        : 'SELECT * FROM characters WHERE user_id = ? ORDER BY id LIMIT 1',
      req.selectedCharId ? [req.selectedCharId, req.user.id] : [req.user.id]
    );
    if (chars.length === 0) return res.status(404).json({ message: '캐릭터를 찾을 수 없습니다.' });
    const charId = chars[0].id;

    const [rows] = await pool.query(
      `SELECT i.id as inv_id, i.item_id, i.quantity, it.effect_hp, it.effect_mp, it.name
       FROM inventory i JOIN items it ON i.item_id = it.id
       WHERE i.id = ? AND i.character_id = ? AND it.type = 'potion' AND i.quantity > 0`,
      [invId, charId]
    );
    if (rows.length === 0) return res.status(400).json({ message: '사용할 수 없는 물약입니다.' });

    const potion = rows[0];
    await pool.query('UPDATE inventory SET quantity = quantity - 1 WHERE id = ?', [invId]);

    res.json({ message: `${potion.name} 사용!`, effect_hp: potion.effect_hp || 0, effect_mp: potion.effect_mp || 0 });
  } catch (err) {
    console.error('Use potion error:', err);
    res.status(500).json({ message: '서버 오류가 발생했습니다.' });
  }
});

module.exports = router;
