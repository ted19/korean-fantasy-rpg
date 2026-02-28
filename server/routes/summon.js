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

// 구매 가능한 소환수 목록
router.get('/templates', auth, async (req, res) => {
  try {
    const [templates] = await pool.query('SELECT * FROM summon_templates ORDER BY type, required_level, price');
    const templatesWithImages = templates.map(t => ({
      ...t,
      image_url: `/summons/${t.id}_full.png`,
      icon_url: `/summons/${t.id}_icon.png`,
    }));
    res.json({ templates: templatesWithImages });
  } catch (err) {
    console.error('Summon templates error:', err);
    res.status(500).json({ message: '서버 오류가 발생했습니다.' });
  }
});

// 내 소환수 목록
router.get('/my', auth, async (req, res) => {
  try {
    const [chars] = await pool.query('SELECT id FROM characters WHERE user_id = ?', [req.user.id]);
    if (chars.length === 0) return res.json({ summons: [] });

    const [summons] = await pool.query(
      `SELECT cs.id, cs.level, cs.exp, cs.hp, cs.mp, cs.attack, cs.defense,
              cs.phys_attack, cs.phys_defense, cs.mag_attack, cs.mag_defense, cs.crit_rate, cs.evasion,
              cs.template_id,
              st.name, st.type, st.icon, st.base_hp, st.base_mp, st.base_attack, st.base_defense,
              st.base_phys_attack, st.base_phys_defense, st.base_mag_attack, st.base_mag_defense, st.base_crit_rate, st.base_evasion,
              st.sell_price
       FROM character_summons cs
       JOIN summon_templates st ON cs.template_id = st.id
       WHERE cs.character_id = ?
       ORDER BY st.type, st.name`,
      [chars[0].id]
    );

    // 이미지 URL 추가
    for (const s of summons) {
      s.image_url = `/summons/${s.template_id}_full.png`;
      s.icon_url_img = `/summons/${s.template_id}_icon.png`;
    }

    // 각 소환수의 습득 스킬 목록도 포함
    for (const s of summons) {
      const [learned] = await pool.query(
        `SELECT ss.* FROM summon_learned_skills sls
         JOIN summon_skills ss ON sls.skill_id = ss.id
         WHERE sls.summon_id = ?`,
        [s.id]
      );
      s.learned_skills = learned;
    }

    res.json({ summons });
  } catch (err) {
    console.error('My summons error:', err);
    res.status(500).json({ message: '서버 오류가 발생했습니다.' });
  }
});

// 소환수 구매
router.post('/buy', auth, async (req, res) => {
  const conn = await pool.getConnection();
  try {
    const { templateId } = req.body;

    const [chars] = await conn.query('SELECT * FROM characters WHERE user_id = ?', [req.user.id]);
    if (chars.length === 0) return res.status(404).json({ message: '캐릭터가 없습니다.' });
    const char = chars[0];

    const [templates] = await conn.query('SELECT * FROM summon_templates WHERE id = ?', [templateId]);
    if (templates.length === 0) return res.status(404).json({ message: '소환수를 찾을 수 없습니다.' });
    const tmpl = templates[0];

    if (char.level < tmpl.required_level) {
      return res.status(400).json({ message: `레벨 ${tmpl.required_level} 이상만 고용할 수 있습니다.` });
    }

    const gold = char.gold || 0;
    if (gold < tmpl.price) {
      return res.status(400).json({ message: `골드가 부족합니다. (필요: ${tmpl.price}G, 보유: ${gold}G)` });
    }

    const [existing] = await conn.query(
      'SELECT id FROM character_summons WHERE character_id = ? AND template_id = ?',
      [char.id, templateId]
    );
    if (existing.length > 0) {
      return res.status(400).json({ message: '이미 고용한 소환수입니다.' });
    }

    await conn.beginTransaction();

    await conn.query('UPDATE characters SET gold = gold - ? WHERE id = ?', [tmpl.price, char.id]);
    await conn.query(
      `INSERT INTO character_summons (character_id, template_id, hp, mp, attack, defense,
        phys_attack, phys_defense, mag_attack, mag_defense, crit_rate, evasion)
       VALUES (?, ?, ?, ?, ?, ?, 0, 0, 0, 0, 0, 0)`,
      [char.id, templateId, tmpl.base_hp, tmpl.base_mp, tmpl.base_attack, tmpl.base_defense]
    );

    await conn.commit();

    const [updatedChar] = await pool.query('SELECT gold FROM characters WHERE id = ?', [char.id]);

    res.json({
      message: `${tmpl.name}을(를) 고용했습니다!`,
      gold: updatedChar[0].gold,
    });
  } catch (err) {
    await conn.rollback();
    console.error('Buy summon error:', err);
    res.status(500).json({ message: '서버 오류가 발생했습니다.' });
  } finally {
    conn.release();
  }
});

// 소환수 판매(해고) - 장비 자동 해제
router.post('/sell', auth, async (req, res) => {
  const conn = await pool.getConnection();
  try {
    const { summonId } = req.body;

    const [chars] = await conn.query('SELECT * FROM characters WHERE user_id = ?', [req.user.id]);
    if (chars.length === 0) return res.status(404).json({ message: '캐릭터가 없습니다.' });
    const char = chars[0];

    const [summons] = await conn.query(
      `SELECT cs.id, st.name, st.sell_price
       FROM character_summons cs
       JOIN summon_templates st ON cs.template_id = st.id
       WHERE cs.id = ? AND cs.character_id = ?`,
      [summonId, char.id]
    );
    if (summons.length === 0) return res.status(404).json({ message: '소환수를 찾을 수 없습니다.' });
    const summon = summons[0];

    await conn.beginTransaction();

    // 장비 자동 해제 (summon_equipment 삭제 - 아이템은 인벤토리에 남음)
    await conn.query('DELETE FROM summon_equipment WHERE summon_id = ?', [summonId]);
    await conn.query('DELETE FROM character_summons WHERE id = ?', [summonId]);
    await conn.query('UPDATE characters SET gold = gold + ? WHERE id = ?', [summon.sell_price, char.id]);

    await conn.commit();

    const [updatedChar] = await pool.query('SELECT gold FROM characters WHERE id = ?', [char.id]);

    res.json({
      message: `${summon.name}을(를) ${summon.sell_price}G에 해고했습니다.`,
      gold: updatedChar[0].gold,
    });
  } catch (err) {
    await conn.rollback();
    console.error('Sell summon error:', err);
    res.status(500).json({ message: '서버 오류가 발생했습니다.' });
  } finally {
    conn.release();
  }
});

// 소환수 장비 조회
router.get('/:summonId/equipment', auth, async (req, res) => {
  try {
    const { summonId } = req.params;

    const [chars] = await pool.query('SELECT id FROM characters WHERE user_id = ?', [req.user.id]);
    if (chars.length === 0) return res.json({ equipped: {}, inventory: [] });
    const charId = chars[0].id;

    // 소환수 소유 확인
    const [summons] = await pool.query(
      'SELECT id FROM character_summons WHERE id = ? AND character_id = ?',
      [summonId, charId]
    );
    if (summons.length === 0) return res.status(404).json({ message: '소환수를 찾을 수 없습니다.' });

    // 소환수 장착 장비
    const [equipped] = await pool.query(
      `SELECT se.slot, se.item_id, it.*
       FROM summon_equipment se
       JOIN items it ON se.item_id = it.id
       WHERE se.summon_id = ?`,
      [summonId]
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
        effect_phys_attack: e.effect_phys_attack,
        effect_phys_defense: e.effect_phys_defense,
        effect_mag_attack: e.effect_mag_attack,
        effect_mag_defense: e.effect_mag_defense,
        effect_crit_rate: e.effect_crit_rate,
        effect_evasion: e.effect_evasion,
      };
    });

    // 캐릭터 장착 아이템 ID
    const [charEquipped] = await pool.query(
      'SELECT item_id FROM equipment WHERE character_id = ?',
      [charId]
    );
    const charEquippedIds = charEquipped.map((e) => e.item_id);

    // 모든 소환수 장착 아이템 ID (현재 소환수 제외)
    const [allSummonEquipped] = await pool.query(
      `SELECT se.item_id FROM summon_equipment se
       JOIN character_summons cs ON se.summon_id = cs.id
       WHERE cs.character_id = ? AND se.summon_id != ?`,
      [charId, summonId]
    );
    const otherSummonEquippedIds = allSummonEquipped.map((e) => e.item_id);

    // 현재 소환수 장착 아이템 ID
    const currentSummonEquippedIds = equipped.map((e) => e.item_id);

    // 사용 가능 인벤토리 (장비류만, 캐릭터 장착/다른 소환수 장착 제외, 클래스 제한 아이템 제외)
    const [inventory] = await pool.query(
      `SELECT i.*, it.name, it.type, it.slot, it.weapon_hand, it.description, it.price, it.sell_price,
              it.effect_hp, it.effect_mp, it.effect_attack, it.effect_defense,
              it.effect_phys_attack, it.effect_phys_defense, it.effect_mag_attack, it.effect_mag_defense,
              it.effect_crit_rate, it.effect_evasion,
              it.required_level, it.class_restriction
       FROM inventory i
       JOIN items it ON i.item_id = it.id
       WHERE i.character_id = ? AND it.type != 'potion' AND it.class_restriction IS NULL
       ORDER BY it.type, it.name`,
      [charId]
    );

    const excludeIds = [...charEquippedIds, ...otherSummonEquippedIds, ...currentSummonEquippedIds];
    const availableInventory = inventory.filter((inv) => !excludeIds.includes(inv.item_id));

    res.json({ equipped: equippedMap, inventory: availableInventory });
  } catch (err) {
    console.error('Summon equipment info error:', err);
    res.status(500).json({ message: '서버 오류가 발생했습니다.' });
  }
});

// 소환수 장비 장착
router.post('/:summonId/equip', auth, async (req, res) => {
  const conn = await pool.getConnection();
  try {
    const { summonId } = req.params;
    const { itemId, slot } = req.body;

    const [chars] = await conn.query('SELECT * FROM characters WHERE user_id = ?', [req.user.id]);
    if (chars.length === 0) return res.status(404).json({ message: '캐릭터가 없습니다.' });
    const char = chars[0];

    // 소환수 소유 확인
    const [summons] = await conn.query(
      'SELECT * FROM character_summons WHERE id = ? AND character_id = ?',
      [summonId, char.id]
    );
    if (summons.length === 0) return res.status(404).json({ message: '소환수를 찾을 수 없습니다.' });
    const summon = summons[0];

    // 아이템 확인
    const [itemRows] = await conn.query('SELECT * FROM items WHERE id = ?', [itemId]);
    if (itemRows.length === 0) return res.status(404).json({ message: '아이템을 찾을 수 없습니다.' });
    const item = itemRows[0];

    // 인벤토리 확인
    const [invRows] = await conn.query(
      'SELECT * FROM inventory WHERE character_id = ? AND item_id = ?',
      [char.id, itemId]
    );
    if (invRows.length === 0) return res.status(400).json({ message: '보유하지 않은 아이템입니다.' });

    // 슬롯 유효성
    if (item.slot !== slot) {
      return res.status(400).json({ message: '해당 슬롯에 장착할 수 없는 아이템입니다.' });
    }

    // 클래스 제한 아이템은 소환수에 장착 불가
    if (item.class_restriction) {
      return res.status(400).json({ message: '클래스 제한 아이템은 소환수에 장착할 수 없습니다.' });
    }

    // 캐릭터가 장착 중인지 확인
    const [charEquip] = await conn.query(
      'SELECT id FROM equipment WHERE character_id = ? AND item_id = ?',
      [char.id, itemId]
    );
    if (charEquip.length > 0) {
      return res.status(400).json({ message: '캐릭터가 장착 중인 아이템입니다.' });
    }

    // 다른 소환수가 장착 중인지 확인
    const [otherEquip] = await conn.query(
      `SELECT se.id FROM summon_equipment se
       JOIN character_summons cs ON se.summon_id = cs.id
       WHERE cs.character_id = ? AND se.item_id = ? AND se.summon_id != ?`,
      [char.id, itemId, summonId]
    );
    if (otherEquip.length > 0) {
      return res.status(400).json({ message: '다른 소환수가 장착 중인 아이템입니다.' });
    }

    // 방패 장착 시 양손무기 체크
    if (slot === 'shield') {
      const [weaponEquip] = await conn.query(
        `SELECT se.item_id, it.weapon_hand FROM summon_equipment se
         JOIN items it ON se.item_id = it.id
         WHERE se.summon_id = ? AND se.slot = 'weapon'`,
        [summonId]
      );
      if (weaponEquip.length > 0 && weaponEquip[0].weapon_hand === '2h') {
        return res.status(400).json({ message: '양손 무기를 장착 중이라 방패를 장착할 수 없습니다.' });
      }
    }

    await conn.beginTransaction();

    // 양손 무기 장착 시 방패 자동 해제
    if (slot === 'weapon' && item.weapon_hand === '2h') {
      const [shieldEquip] = await conn.query(
        `SELECT se.item_id, it.effect_hp, it.effect_mp, it.effect_attack, it.effect_defense,
                it.effect_phys_attack, it.effect_phys_defense, it.effect_mag_attack, it.effect_mag_defense,
                it.effect_crit_rate, it.effect_evasion
         FROM summon_equipment se JOIN items it ON se.item_id = it.id
         WHERE se.summon_id = ? AND se.slot = 'shield'`,
        [summonId]
      );
      if (shieldEquip.length > 0) {
        const s = shieldEquip[0];
        await conn.query('DELETE FROM summon_equipment WHERE summon_id = ? AND slot = ?', [summonId, 'shield']);
        await conn.query(
          `UPDATE character_summons SET hp = hp - ?, mp = mp - ?, attack = attack - ?, defense = defense - ?,
            phys_attack = phys_attack - ?, phys_defense = phys_defense - ?,
            mag_attack = mag_attack - ?, mag_defense = mag_defense - ?,
            crit_rate = crit_rate - ?, evasion = evasion - ?
           WHERE id = ?`,
          [s.effect_hp, s.effect_mp, s.effect_attack, s.effect_defense,
           s.effect_phys_attack, s.effect_phys_defense,
           s.effect_mag_attack, s.effect_mag_defense,
           s.effect_crit_rate, s.effect_evasion, summonId]
        );
      }
    }

    // 기존 장비 해제
    const [currentEquip] = await conn.query(
      `SELECT se.item_id, it.effect_hp, it.effect_mp, it.effect_attack, it.effect_defense,
              it.effect_phys_attack, it.effect_phys_defense, it.effect_mag_attack, it.effect_mag_defense,
              it.effect_crit_rate, it.effect_evasion, it.name
       FROM summon_equipment se JOIN items it ON se.item_id = it.id
       WHERE se.summon_id = ? AND se.slot = ?`,
      [summonId, slot]
    );

    if (currentEquip.length > 0) {
      const old = currentEquip[0];
      await conn.query('DELETE FROM summon_equipment WHERE summon_id = ? AND slot = ?', [summonId, slot]);
      await conn.query(
        `UPDATE character_summons SET hp = hp - ?, mp = mp - ?, attack = attack - ?, defense = defense - ?,
          phys_attack = phys_attack - ?, phys_defense = phys_defense - ?,
          mag_attack = mag_attack - ?, mag_defense = mag_defense - ?,
          crit_rate = crit_rate - ?, evasion = evasion - ?
         WHERE id = ?`,
        [old.effect_hp, old.effect_mp, old.effect_attack, old.effect_defense,
         old.effect_phys_attack, old.effect_phys_defense,
         old.effect_mag_attack, old.effect_mag_defense,
         old.effect_crit_rate, old.effect_evasion, summonId]
      );
    }

    // 새 장비 장착
    await conn.query(
      'INSERT INTO summon_equipment (summon_id, slot, item_id) VALUES (?, ?, ?)',
      [summonId, slot, itemId]
    );
    await conn.query(
      `UPDATE character_summons SET hp = hp + ?, mp = mp + ?, attack = attack + ?, defense = defense + ?,
        phys_attack = phys_attack + ?, phys_defense = phys_defense + ?,
        mag_attack = mag_attack + ?, mag_defense = mag_defense + ?,
        crit_rate = crit_rate + ?, evasion = evasion + ?
       WHERE id = ?`,
      [item.effect_hp, item.effect_mp, item.effect_attack, item.effect_defense,
       item.effect_phys_attack, item.effect_phys_defense,
       item.effect_mag_attack, item.effect_mag_defense,
       item.effect_crit_rate, item.effect_evasion, summonId]
    );

    await conn.commit();

    const [updated] = await pool.query('SELECT * FROM character_summons WHERE id = ?', [summonId]);

    let msg = `${item.name}을(를) ${SLOT_NAMES[slot]}에 장착했습니다.`;
    if (currentEquip.length > 0) {
      msg = `${currentEquip[0].name} -> ${item.name}(으)로 교체했습니다.`;
    }

    res.json({
      message: msg,
      summon: updated[0],
    });
  } catch (err) {
    await conn.rollback();
    console.error('Summon equip error:', err);
    res.status(500).json({ message: '서버 오류가 발생했습니다.' });
  } finally {
    conn.release();
  }
});

// 소환수 장비 해제
router.post('/:summonId/unequip', auth, async (req, res) => {
  const conn = await pool.getConnection();
  try {
    const { summonId } = req.params;
    const { slot } = req.body;

    const [chars] = await conn.query('SELECT * FROM characters WHERE user_id = ?', [req.user.id]);
    if (chars.length === 0) return res.status(404).json({ message: '캐릭터가 없습니다.' });
    const char = chars[0];

    const [summons] = await conn.query(
      'SELECT id FROM character_summons WHERE id = ? AND character_id = ?',
      [summonId, char.id]
    );
    if (summons.length === 0) return res.status(404).json({ message: '소환수를 찾을 수 없습니다.' });

    const [equipRows] = await conn.query(
      `SELECT se.item_id, it.effect_hp, it.effect_mp, it.effect_attack, it.effect_defense,
              it.effect_phys_attack, it.effect_phys_defense, it.effect_mag_attack, it.effect_mag_defense,
              it.effect_crit_rate, it.effect_evasion, it.name
       FROM summon_equipment se JOIN items it ON se.item_id = it.id
       WHERE se.summon_id = ? AND se.slot = ?`,
      [summonId, slot]
    );
    if (equipRows.length === 0) return res.status(400).json({ message: '해당 슬롯에 장착된 장비가 없습니다.' });

    const equip = equipRows[0];

    await conn.beginTransaction();

    await conn.query('DELETE FROM summon_equipment WHERE summon_id = ? AND slot = ?', [summonId, slot]);
    await conn.query(
      `UPDATE character_summons SET hp = hp - ?, mp = mp - ?, attack = attack - ?, defense = defense - ?,
        phys_attack = phys_attack - ?, phys_defense = phys_defense - ?,
        mag_attack = mag_attack - ?, mag_defense = mag_defense - ?,
        crit_rate = crit_rate - ?, evasion = evasion - ?
       WHERE id = ?`,
      [equip.effect_hp, equip.effect_mp, equip.effect_attack, equip.effect_defense,
       equip.effect_phys_attack, equip.effect_phys_defense,
       equip.effect_mag_attack, equip.effect_mag_defense,
       equip.effect_crit_rate, equip.effect_evasion, summonId]
    );

    await conn.commit();

    const [updated] = await pool.query('SELECT * FROM character_summons WHERE id = ?', [summonId]);

    res.json({
      message: `${equip.name}을(를) 해제했습니다.`,
      summon: updated[0],
    });
  } catch (err) {
    await conn.rollback();
    console.error('Summon unequip error:', err);
    res.status(500).json({ message: '서버 오류가 발생했습니다.' });
  } finally {
    conn.release();
  }
});

// 소환수 스킬 목록 (배울 수 있는 스킬들)
router.get('/:summonId/skills', auth, async (req, res) => {
  try {
    const { summonId } = req.params;

    const [chars] = await pool.query('SELECT id FROM characters WHERE user_id = ?', [req.user.id]);
    if (chars.length === 0) return res.json({ skills: [], learned: [] });
    const charId = chars[0].id;

    const [summons] = await pool.query(
      `SELECT cs.*, st.type as summon_type, st.name as summon_name
       FROM character_summons cs
       JOIN summon_templates st ON cs.template_id = st.id
       WHERE cs.id = ? AND cs.character_id = ?`,
      [summonId, charId]
    );
    if (summons.length === 0) return res.status(404).json({ message: '소환수를 찾을 수 없습니다.' });
    const summon = summons[0];

    // 공통 스킬 + 해당 타입 스킬 + 고유 스킬
    const [skills] = await pool.query(
      `SELECT * FROM summon_skills
       WHERE is_common = 1
          OR (summon_type = ? AND template_id IS NULL)
          OR template_id = ?
       ORDER BY required_level, name`,
      [summon.summon_type, summon.template_id]
    );

    const [learned] = await pool.query(
      `SELECT skill_id FROM summon_learned_skills WHERE summon_id = ?`,
      [summonId]
    );
    const learnedIds = learned.map((l) => l.skill_id);

    res.json({
      skills: skills.map((s) => ({
        ...s,
        learned: learnedIds.includes(s.id),
        skill_category: s.is_common ? '공통' : s.template_id ? '고유' : s.summon_type,
      })),
      summonLevel: summon.level,
    });
  } catch (err) {
    console.error('Summon skills error:', err);
    res.status(500).json({ message: '서버 오류가 발생했습니다.' });
  }
});

// 소환수 스킬 습득
router.post('/:summonId/learn-skill', auth, async (req, res) => {
  const conn = await pool.getConnection();
  try {
    const { summonId } = req.params;
    const { skillId } = req.body;

    const [chars] = await conn.query('SELECT id FROM characters WHERE user_id = ?', [req.user.id]);
    if (chars.length === 0) return res.status(404).json({ message: '캐릭터가 없습니다.' });
    const charId = chars[0].id;

    const [summons] = await conn.query(
      `SELECT cs.*, st.type as summon_type
       FROM character_summons cs
       JOIN summon_templates st ON cs.template_id = st.id
       WHERE cs.id = ? AND cs.character_id = ?`,
      [summonId, charId]
    );
    if (summons.length === 0) return res.status(404).json({ message: '소환수를 찾을 수 없습니다.' });
    const summon = summons[0];

    const [skillRows] = await conn.query('SELECT * FROM summon_skills WHERE id = ?', [skillId]);
    if (skillRows.length === 0) return res.status(404).json({ message: '스킬을 찾을 수 없습니다.' });
    const skill = skillRows[0];

    // 스킬 적합성 확인
    if (!skill.is_common) {
      if (skill.template_id && skill.template_id !== summon.template_id) {
        return res.status(400).json({ message: '이 소환수가 배울 수 없는 고유 스킬입니다.' });
      }
      if (skill.summon_type && skill.summon_type !== summon.summon_type) {
        return res.status(400).json({ message: '이 소환수 타입이 배울 수 없는 스킬입니다.' });
      }
    }

    if (summon.level < skill.required_level) {
      return res.status(400).json({ message: `소환수 레벨 ${skill.required_level} 이상이 필요합니다. (현재: Lv.${summon.level})` });
    }

    const [existing] = await conn.query(
      'SELECT id FROM summon_learned_skills WHERE summon_id = ? AND skill_id = ?',
      [summonId, skillId]
    );
    if (existing.length > 0) {
      return res.status(400).json({ message: '이미 습득한 스킬입니다.' });
    }

    await conn.query(
      'INSERT INTO summon_learned_skills (summon_id, skill_id) VALUES (?, ?)',
      [summonId, skillId]
    );

    res.json({ message: `${skill.name} 스킬을 습득했습니다!` });
  } catch (err) {
    console.error('Learn summon skill error:', err);
    res.status(500).json({ message: '서버 오류가 발생했습니다.' });
  } finally {
    conn.release();
  }
});

module.exports = router;
