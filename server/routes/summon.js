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

const SUMMON_SLOTS = [
  { level: 1,  slots: 1 },
  { level: 10, slots: 2 },
  { level: 20, slots: 3 },
  { level: 30, slots: 4 },
  { level: 40, slots: 5 },
  { level: 50, slots: 6 },
];

function getSummonSlotInfo(charLevel, currentCount) {
  let maxSlots = 1;
  for (const s of SUMMON_SLOTS) {
    if (charLevel >= s.level) maxSlots = s.slots;
  }
  const next = SUMMON_SLOTS.find(s => s.slots > maxSlots);
  return { current: currentCount, max: maxSlots, next: next || null };
}

// 구매 가능한 소환수 목록
router.get('/templates', auth, async (req, res) => {
  try {
    const [templates] = await pool.query('SELECT * FROM summon_templates ORDER BY type, required_level, price');
    const [growthRates] = await pool.query('SELECT * FROM summon_growth_rates');
    const growthMap = {};
    growthRates.forEach(g => { growthMap[g.summon_type] = g; });

    // 소환 재료 비용 조회
    const [matCosts] = await pool.query(
      `SELECT smc.template_id, smc.material_id, smc.quantity, m.name, m.icon, m.grade
       FROM summon_material_costs smc
       JOIN materials m ON smc.material_id = m.id
       ORDER BY smc.template_id, m.grade, m.name`
    );
    const costMap = {};
    for (const mc of matCosts) {
      if (!costMap[mc.template_id]) costMap[mc.template_id] = [];
      costMap[mc.template_id].push({ material_id: mc.material_id, name: mc.name, icon: mc.icon, grade: mc.grade, quantity: mc.quantity });
    }

    // 캐릭터의 재료 인벤토리 조회
    const [chars] = await pool.query(
      req.selectedCharId
        ? 'SELECT id FROM characters WHERE id = ? AND user_id = ?'
        : 'SELECT id FROM characters WHERE user_id = ? ORDER BY id LIMIT 1',
      req.selectedCharId ? [req.selectedCharId, req.user.id] : [req.user.id]
    );
    let myMaterials = {};
    if (chars.length > 0) {
      const [mats] = await pool.query('SELECT material_id, quantity FROM material_inventory WHERE character_id = ?', [chars[0].id]);
      for (const m of mats) myMaterials[m.material_id] = m.quantity;
    }

    const templatesWithImages = templates.map(t => {
      const gr = growthMap[t.type] || {};
      const materials = (costMap[t.id] || []).map(mc => ({
        ...mc,
        owned: myMaterials[mc.material_id] || 0,
      }));
      return {
        ...t,
        image_url: `/summons/${t.id}_full.png`,
        icon_url: `/summons/${t.id}_icon.png`,
        growth_hp: gr.hp_per_level || 0,
        growth_mp: gr.mp_per_level || 0,
        growth_phys_attack: gr.phys_attack_per_level || 0,
        growth_phys_defense: gr.phys_defense_per_level || 0,
        growth_mag_attack: gr.mag_attack_per_level || 0,
        growth_mag_defense: gr.mag_defense_per_level || 0,
        summon_materials: materials,
      };
    });
    res.json({ templates: templatesWithImages });
  } catch (err) {
    console.error('Summon templates error:', err);
    res.status(500).json({ message: '서버 오류가 발생했습니다.' });
  }
});

// 내 소환수 목록
router.get('/my', auth, async (req, res) => {
  try {
    const [chars] = await pool.query(
      req.selectedCharId
        ? 'SELECT id, level FROM characters WHERE id = ? AND user_id = ?'
        : 'SELECT id, level FROM characters WHERE user_id = ? ORDER BY id LIMIT 1',
      req.selectedCharId ? [req.selectedCharId, req.user.id] : [req.user.id]
    );
    if (chars.length === 0) return res.json({ summons: [], summonSlots: { current: 0, max: 1, next: null } });

    const [summons] = await pool.query(
      `SELECT cs.id, cs.level, cs.exp, cs.hp, cs.mp, cs.attack, cs.defense,
              cs.phys_attack, cs.phys_defense, cs.mag_attack, cs.mag_defense, cs.crit_rate, cs.evasion,
              cs.template_id,
              st.name, st.type, st.icon, st.base_hp, st.base_mp, st.base_attack, st.base_defense,
              st.base_phys_attack, st.base_phys_defense, st.base_mag_attack, st.base_mag_defense, st.base_crit_rate, st.base_evasion,
              st.sell_price, st.range_type, st.element
       FROM character_summons cs
       JOIN summon_templates st ON cs.template_id = st.id
       WHERE cs.character_id = ?
       ORDER BY st.type, st.name`,
      [chars[0].id]
    );

    // 성장률 조회
    const [growthRates] = await pool.query('SELECT * FROM summon_growth_rates');
    const growthMap = {};
    growthRates.forEach(g => { growthMap[g.summon_type] = g; });

    // 이미지 URL + 성장률 추가
    for (const s of summons) {
      s.image_url = `/summons/${s.template_id}_full.png`;
      s.icon_url_img = `/summons/${s.template_id}_icon.png`;
      const gr = growthMap[s.type] || {};
      s.growth_hp = gr.hp_per_level || 0;
      s.growth_mp = gr.mp_per_level || 0;
      s.growth_phys_attack = gr.phys_attack_per_level || 0;
      s.growth_phys_defense = gr.phys_defense_per_level || 0;
      s.growth_mag_attack = gr.mag_attack_per_level || 0;
      s.growth_mag_defense = gr.mag_defense_per_level || 0;
    }

    // 각 소환수의 습득 스킬 목록 + 장착 장비 수
    for (const s of summons) {
      const [learned] = await pool.query(
        `SELECT ss.*, sls.auto_priority FROM summon_learned_skills sls
         JOIN summon_skills ss ON sls.skill_id = ss.id
         WHERE sls.summon_id = ?`,
        [s.id]
      );
      s.learned_skills = learned;
      const [[{ cnt }]] = await pool.query(
        'SELECT COUNT(*) as cnt FROM summon_equipment WHERE summon_id = ?',
        [s.id]
      );
      s.equipped_count = cnt;
    }

    const slotInfo = getSummonSlotInfo(chars[0].level, summons.length);
    res.json({ summons, summonSlots: slotInfo });
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

    const [chars] = await conn.query(
      req.selectedCharId
        ? 'SELECT * FROM characters WHERE id = ? AND user_id = ?'
        : 'SELECT * FROM characters WHERE user_id = ? ORDER BY id LIMIT 1',
      req.selectedCharId ? [req.selectedCharId, req.user.id] : [req.user.id]
    );
    if (chars.length === 0) return res.status(404).json({ message: '캐릭터가 없습니다.' });
    const char = chars[0];

    const [templates] = await conn.query('SELECT * FROM summon_templates WHERE id = ?', [templateId]);
    if (templates.length === 0) return res.status(404).json({ message: '소환수를 찾을 수 없습니다.' });
    const tmpl = templates[0];

    if (char.level < tmpl.required_level) {
      return res.status(400).json({ message: `레벨 ${tmpl.required_level} 이상만 소환할 수 있습니다.` });
    }

    const [existing] = await conn.query(
      'SELECT id FROM character_summons WHERE character_id = ? AND template_id = ?',
      [char.id, templateId]
    );
    if (existing.length > 0) {
      return res.status(400).json({ message: '이미 소환한 소환수입니다.' });
    }

    // 슬롯 제한 확인
    const [summonCount] = await conn.query('SELECT COUNT(*) as cnt FROM character_summons WHERE character_id = ?', [char.id]);
    const slotInfo = getSummonSlotInfo(char.level, summonCount[0].cnt);
    if (summonCount[0].cnt >= slotInfo.max) {
      const nextMsg = slotInfo.next ? ` (Lv.${slotInfo.next.level}에서 ${slotInfo.next.slots}마리 해금)` : '';
      return res.status(400).json({ message: `소환수 슬롯이 부족합니다.${nextMsg}` });
    }

    // 재료 비용 확인
    const [matCosts] = await conn.query(
      `SELECT smc.material_id, smc.quantity, m.name
       FROM summon_material_costs smc
       JOIN materials m ON smc.material_id = m.id
       WHERE smc.template_id = ?`,
      [templateId]
    );

    if (matCosts.length > 0) {
      // 재료 충분한지 확인
      for (const mc of matCosts) {
        const [inv] = await conn.query(
          'SELECT quantity FROM material_inventory WHERE character_id = ? AND material_id = ?',
          [char.id, mc.material_id]
        );
        const owned = inv.length > 0 ? inv[0].quantity : 0;
        if (owned < mc.quantity) {
          return res.status(400).json({ message: `재료가 부족합니다. (${mc.name} 필요: ${mc.quantity}, 보유: ${owned})` });
        }
      }
    } else {
      // 재료 설정이 없으면 골드 차감 (하위 호환)
      const gold = char.gold || 0;
      if (gold < tmpl.price) {
        return res.status(400).json({ message: `골드가 부족합니다. (필요: ${tmpl.price}G, 보유: ${gold}G)` });
      }
    }

    await conn.beginTransaction();

    if (matCosts.length > 0) {
      for (const mc of matCosts) {
        await conn.query(
          'UPDATE material_inventory SET quantity = quantity - ? WHERE character_id = ? AND material_id = ?',
          [mc.quantity, char.id, mc.material_id]
        );
      }
    } else {
      await conn.query('UPDATE characters SET gold = gold - ? WHERE id = ?', [tmpl.price, char.id]);
    }
    await conn.query(
      `INSERT INTO character_summons (character_id, template_id, hp, mp, attack, defense,
        phys_attack, phys_defense, mag_attack, mag_defense, crit_rate, evasion)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [char.id, templateId, tmpl.base_hp, tmpl.base_mp, tmpl.base_attack, tmpl.base_defense,
       tmpl.base_phys_attack || 0, tmpl.base_phys_defense || 0,
       tmpl.base_mag_attack || 0, tmpl.base_mag_defense || 0,
       tmpl.base_crit_rate || 0, tmpl.base_evasion || 0]
    );

    // 기본 스킬 자동 학습 (공통 + 해당 타입 레벨1 스킬)
    const [inserted] = await conn.query('SELECT LAST_INSERT_ID() as summonId');
    const newSummonId = inserted[0].summonId;

    const [defaultSkills] = await conn.query(
      `SELECT id FROM summon_skills
       WHERE required_level <= 1
         AND ((is_common = 1)
           OR (summon_type = ? AND template_id IS NULL)
           OR (template_id = ?))`,
      [tmpl.type, templateId]
    );
    for (const sk of defaultSkills) {
      await conn.query(
        'INSERT IGNORE INTO summon_learned_skills (summon_id, skill_id) VALUES (?, ?)',
        [newSummonId, sk.id]
      );
    }

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

// 소환수 소환해제
router.post('/sell', auth, async (req, res) => {
  const conn = await pool.getConnection();
  try {
    const { summonId } = req.body;

    const [chars] = await conn.query(
      req.selectedCharId
        ? 'SELECT * FROM characters WHERE id = ? AND user_id = ?'
        : 'SELECT * FROM characters WHERE user_id = ? ORDER BY id LIMIT 1',
      req.selectedCharId ? [req.selectedCharId, req.user.id] : [req.user.id]
    );
    if (chars.length === 0) return res.status(404).json({ message: '캐릭터가 없습니다.' });
    const char = chars[0];

    const [summons] = await conn.query(
      `SELECT cs.id, st.name
       FROM character_summons cs
       JOIN summon_templates st ON cs.template_id = st.id
       WHERE cs.id = ? AND cs.character_id = ?`,
      [summonId, char.id]
    );
    if (summons.length === 0) return res.status(404).json({ message: '소환수를 찾을 수 없습니다.' });
    const summon = summons[0];

    // 장비 장착 여부 확인
    const [equipped] = await conn.query(
      'SELECT COUNT(*) as cnt FROM summon_equipment WHERE summon_id = ?',
      [summonId]
    );
    if (equipped[0].cnt > 0) {
      return res.status(400).json({ message: '장비를 장착한 소환수는 소환해제할 수 없습니다. 장비를 먼저 해제해주세요.' });
    }

    await conn.beginTransaction();
    await conn.query('DELETE FROM character_summons WHERE id = ?', [summonId]);

    await conn.commit();

    res.json({
      message: `${summon.name}의 소환을 해제했습니다.`,
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

    const [chars] = await pool.query(
      req.selectedCharId
        ? 'SELECT id FROM characters WHERE id = ? AND user_id = ?'
        : 'SELECT id FROM characters WHERE user_id = ? ORDER BY id LIMIT 1',
      req.selectedCharId ? [req.selectedCharId, req.user.id] : [req.user.id]
    );
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

    // 장착 중인 item_id별 개수 카운트
    const equippedCountMap = {};
    const addCount = (rows) => { for (const r of rows) equippedCountMap[r.item_id] = (equippedCountMap[r.item_id] || 0) + 1; };

    const [charEquipped] = await pool.query('SELECT item_id FROM equipment WHERE character_id = ?', [charId]);
    addCount(charEquipped);

    const [allSummonEquipped] = await pool.query(
      `SELECT se.item_id FROM summon_equipment se
       JOIN character_summons cs ON se.summon_id = cs.id
       WHERE cs.character_id = ? AND se.summon_id != ?`,
      [charId, summonId]
    );
    addCount(allSummonEquipped);
    addCount(equipped); // 현재 소환수 장착

    const [allMercEquipped] = await pool.query(
      `SELECT me.item_id FROM mercenary_equipment me
       JOIN character_mercenaries cm ON me.mercenary_id = cm.id
       WHERE cm.character_id = ?`,
      [charId]
    );
    addCount(allMercEquipped);

    const [cosmeticEquipped] = await pool.query('SELECT item_id FROM equipped_cosmetics WHERE character_id = ?', [charId]);
    addCount(cosmeticEquipped);

    // 사용 가능 인벤토리 (장비류만, 클래스 제한 아이템 제외)
    const [inventory] = await pool.query(
      `SELECT i.*, it.name, it.type, it.slot, it.weapon_hand, it.description, it.price, it.sell_price,
              it.effect_hp, it.effect_mp, it.effect_attack, it.effect_defense,
              it.effect_phys_attack, it.effect_phys_defense, it.effect_mag_attack, it.effect_mag_defense,
              it.effect_crit_rate, it.effect_evasion,
              it.required_level, it.class_restriction,
              IFNULL(it.grade, '일반') as grade, it.cosmetic_effect
       FROM inventory i
       JOIN items it ON i.item_id = it.id
       WHERE i.character_id = ? AND it.type != 'potion'
       ORDER BY it.type, it.name`,
      [charId]
    );

    const usedCount = {};
    const availableInventory = inventory.filter((inv) => {
      const eq = equippedCountMap[inv.item_id] || 0;
      const used = usedCount[inv.item_id] || 0;
      if (used < eq) { usedCount[inv.item_id] = used + 1; return false; }
      return true;
    });

    // 물약(소모품)
    const [potions] = await pool.query(
      `SELECT i.id as inv_id, i.item_id, i.quantity, it.name, it.type, it.description,
              it.effect_hp, it.effect_mp, IFNULL(it.grade, '일반') as grade
       FROM inventory i JOIN items it ON i.item_id = it.id
       WHERE i.character_id = ? AND it.type = 'potion' AND i.quantity > 0
       ORDER BY it.name`,
      [charId]
    );

    res.json({ equipped: equippedMap, inventory: availableInventory, potions });
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

    const [chars] = await conn.query(
      req.selectedCharId
        ? 'SELECT * FROM characters WHERE id = ? AND user_id = ?'
        : 'SELECT * FROM characters WHERE user_id = ? ORDER BY id LIMIT 1',
      req.selectedCharId ? [req.selectedCharId, req.user.id] : [req.user.id]
    );
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

    // 인벤토리 확인 (보유 개수)
    const [invRows] = await conn.query(
      'SELECT * FROM inventory WHERE character_id = ? AND item_id = ?',
      [char.id, itemId]
    );
    if (invRows.length === 0) return res.status(400).json({ message: '보유하지 않은 아이템입니다.' });
    const ownedCount = invRows.reduce((s, r) => s + (r.quantity || 1), 0);

    // 슬롯 유효성
    if (item.slot !== slot) {
      return res.status(400).json({ message: '해당 슬롯에 장착할 수 없는 아이템입니다.' });
    }

    // 클래스 제한 아이템은 소환수에 장착 불가
    if (item.class_restriction) {
      return res.status(400).json({ message: '클래스 제한 아이템은 소환수에 장착할 수 없습니다.' });
    }

    // 장착 중인 총 개수 확인 (캐릭터 + 모든 소환수 + 용병)
    const [charEquip] = await conn.query(
      'SELECT COUNT(*) as cnt FROM equipment WHERE character_id = ? AND item_id = ?',
      [char.id, itemId]
    );
    const [allSummonEquip] = await conn.query(
      `SELECT COUNT(*) as cnt FROM summon_equipment se
       JOIN character_summons cs ON se.summon_id = cs.id
       WHERE cs.character_id = ? AND se.item_id = ? AND se.summon_id != ?`,
      [char.id, itemId, summonId]
    );
    const [mercEquip] = await conn.query(
      `SELECT COUNT(*) as cnt FROM mercenary_equipment me
       JOIN character_mercenaries cm ON me.mercenary_id = cm.id
       WHERE cm.character_id = ? AND me.item_id = ?`,
      [char.id, itemId]
    );
    const totalEquipped = (charEquip[0].cnt || 0) + (allSummonEquip[0].cnt || 0) + (mercEquip[0].cnt || 0);
    if (totalEquipped >= ownedCount) {
      return res.status(400).json({ message: '사용 가능한 아이템이 없습니다. (모두 장착 중)' });
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
          `UPDATE character_summons SET
            hp = GREATEST(1, hp - ?), mp = GREATEST(0, mp - ?),
            attack = GREATEST(0, attack - ?), defense = GREATEST(0, defense - ?),
            phys_attack = GREATEST(0, phys_attack - ?), phys_defense = GREATEST(0, phys_defense - ?),
            mag_attack = GREATEST(0, mag_attack - ?), mag_defense = GREATEST(0, mag_defense - ?),
            crit_rate = GREATEST(0, crit_rate - ?), evasion = GREATEST(0, evasion - ?)
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
        `UPDATE character_summons SET
          hp = GREATEST(1, hp - ?), mp = GREATEST(0, mp - ?),
          attack = GREATEST(0, attack - ?), defense = GREATEST(0, defense - ?),
          phys_attack = GREATEST(0, phys_attack - ?), phys_defense = GREATEST(0, phys_defense - ?),
          mag_attack = GREATEST(0, mag_attack - ?), mag_defense = GREATEST(0, mag_defense - ?),
          crit_rate = GREATEST(0, crit_rate - ?), evasion = GREATEST(0, evasion - ?)
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

    const [chars] = await conn.query(
      req.selectedCharId
        ? 'SELECT * FROM characters WHERE id = ? AND user_id = ?'
        : 'SELECT * FROM characters WHERE user_id = ? ORDER BY id LIMIT 1',
      req.selectedCharId ? [req.selectedCharId, req.user.id] : [req.user.id]
    );
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
      `UPDATE character_summons SET
        hp = GREATEST(1, hp - ?), mp = GREATEST(0, mp - ?),
        attack = GREATEST(0, attack - ?), defense = GREATEST(0, defense - ?),
        phys_attack = GREATEST(0, phys_attack - ?), phys_defense = GREATEST(0, phys_defense - ?),
        mag_attack = GREATEST(0, mag_attack - ?), mag_defense = GREATEST(0, mag_defense - ?),
        crit_rate = GREATEST(0, crit_rate - ?), evasion = GREATEST(0, evasion - ?)
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

    const [chars] = await pool.query(
      req.selectedCharId
        ? 'SELECT id FROM characters WHERE id = ? AND user_id = ?'
        : 'SELECT id FROM characters WHERE user_id = ? ORDER BY id LIMIT 1',
      req.selectedCharId ? [req.selectedCharId, req.user.id] : [req.user.id]
    );
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
      `SELECT skill_id, auto_priority FROM summon_learned_skills WHERE summon_id = ?`,
      [summonId]
    );
    const learnedMap = {};
    for (const l of learned) learnedMap[l.skill_id] = l.auto_priority ?? 100;

    res.json({
      skills: skills.map((s) => ({
        ...s,
        learned: s.id in learnedMap,
        auto_priority: learnedMap[s.id] ?? 100,
        skill_category: s.is_common ? '공통' : s.template_id ? '고유' : s.summon_type,
        gold_cost: Math.floor(s.required_level * 50 * (1 + (summon.level - 1) * 0.1)),
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

    const [chars] = await conn.query(
      req.selectedCharId
        ? 'SELECT id FROM characters WHERE id = ? AND user_id = ?'
        : 'SELECT id FROM characters WHERE user_id = ? ORDER BY id LIMIT 1',
      req.selectedCharId ? [req.selectedCharId, req.user.id] : [req.user.id]
    );
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

    // 골드 비용: 스킬 요구레벨 기반 + 소환수 레벨 비례
    const goldCost = Math.floor(skill.required_level * 50 * (1 + (summon.level - 1) * 0.1));

    const [charRows] = await conn.query('SELECT gold FROM characters WHERE id = ?', [charId]);
    if (charRows[0].gold < goldCost) {
      return res.status(400).json({ message: `골드가 부족합니다. (필요: ${goldCost}G, 보유: ${charRows[0].gold}G)` });
    }

    await conn.query('UPDATE characters SET gold = gold - ? WHERE id = ?', [goldCost, charId]);
    await conn.query(
      'INSERT INTO summon_learned_skills (summon_id, skill_id) VALUES (?, ?)',
      [summonId, skillId]
    );

    const [updated] = await conn.query('SELECT gold FROM characters WHERE id = ?', [charId]);

    res.json({ message: `${skill.name} 스킬을 습득했습니다! (-${goldCost}G)`, gold: updated[0].gold });
  } catch (err) {
    console.error('Learn summon skill error:', err);
    res.status(500).json({ message: '서버 오류가 발생했습니다.' });
  } finally {
    conn.release();
  }
});

// PUT /summon/:id/skill-priority - 소환수 스킬 자동전투 우선도
router.put('/:id/skill-priority', auth, async (req, res) => {
  try {
    const summonId = parseInt(req.params.id);
    const { skill_id, priority } = req.body;
    if (!skill_id || priority === undefined) return res.status(400).json({ message: '잘못된 요청입니다.' });
    const p = Math.max(0, Math.min(200, Math.round(Number(priority))));
    await pool.query(
      'UPDATE summon_learned_skills SET auto_priority = ? WHERE summon_id = ? AND skill_id = ?',
      [p, summonId, skill_id]
    );
    res.json({ success: true, auto_priority: p });
  } catch (err) {
    console.error('Summon skill priority error:', err);
    res.status(500).json({ message: '서버 오류가 발생했습니다.' });
  }
});

module.exports = router;
