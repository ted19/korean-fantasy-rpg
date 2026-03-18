const express = require('express');
const jwt = require('jsonwebtoken');
const { pool } = require('../db');

const router = express.Router();
const JWT_SECRET = 'game-secret-key-change-in-production';

function auth(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader) return res.status(401).json({ message: '인증 토큰이 필요합니다.' });
  try {
    req.user = jwt.verify(authHeader.split(' ')[1], JWT_SECRET);
    next();
  } catch {
    return res.status(401).json({ message: '유효하지 않은 토큰입니다.' });
  }
}

const FATIGUE_RECOVERY_INTERVAL_MS = 10 * 60 * 1000; // 10분에 1 회복

// 피로도 자동 회복 처리
async function recoverFatigue(conn, characterId) {
  const now = Date.now();
  const [mercs] = await conn.query(
    'SELECT id, fatigue, max_fatigue, last_fatigue_recovery FROM character_mercenaries WHERE character_id = ?',
    [characterId]
  );
  for (const m of mercs) {
    if (m.fatigue >= m.max_fatigue) continue;
    const lastRecovery = new Date(m.last_fatigue_recovery).getTime();
    const elapsed = now - lastRecovery;
    const recovered = Math.floor(elapsed / FATIGUE_RECOVERY_INTERVAL_MS);
    if (recovered > 0) {
      const newFatigue = Math.min(m.max_fatigue, m.fatigue + recovered);
      const newLastRecovery = new Date(lastRecovery + recovered * FATIGUE_RECOVERY_INTERVAL_MS);
      await conn.query(
        'UPDATE character_mercenaries SET fatigue = ?, last_fatigue_recovery = ? WHERE id = ?',
        [newFatigue, newLastRecovery, m.id]
      );
    }
  }
}

// 전체 용병 목록 (도감용)
router.get('/templates-all', auth, async (req, res) => {
  try {
    const [templates] = await pool.query('SELECT * FROM mercenary_templates ORDER BY FIELD(grade,"일반","고급","희귀","영웅","전설","신화","초월"), required_level');
    res.json({ templates });
  } catch (err) {
    console.error('Mercenary templates-all error:', err);
    res.status(500).json({ message: '서버 오류가 발생했습니다.' });
  }
});

// 용병 템플릿 목록 (여관에서 고용 가능한 용병)
router.get('/templates', auth, async (req, res) => {
  try {
    // 상점에서는 일반/고급 + shop 타입만 표시 (희귀 이상은 가챠/퀘스트/보스로 획득)
    const [templates] = await pool.query(
      "SELECT * FROM mercenary_templates WHERE acquisition_type = 'shop' AND grade IN ('일반','고급') ORDER BY required_level, price"
    );
    res.json({ templates });
  } catch (err) {
    console.error('Mercenary templates error:', err);
    res.status(500).json({ message: '서버 오류가 발생했습니다.' });
  }
});

// 내 용병 목록
router.get('/my', auth, async (req, res) => {
  try {
    const [chars] = await pool.query(
      req.selectedCharId
        ? 'SELECT id FROM characters WHERE id = ? AND user_id = ?'
        : 'SELECT id FROM characters WHERE user_id = ? ORDER BY id LIMIT 1',
      req.selectedCharId ? [req.selectedCharId, req.user.id] : [req.user.id]
    );
    if (chars.length === 0) return res.json({ mercenaries: [], mercSlots: { current: 0, max: 1, next: { level: 10, slots: 2 } } });

    const charId = chars[0].id;
    // 캐릭터 레벨 조회
    const [charInfo] = await pool.query('SELECT level FROM characters WHERE id = ?', [charId]);
    const charLevel = charInfo[0]?.level || 1;

    // 피로도 자동 회복
    await recoverFatigue(pool, charId);

    const [mercenaries] = await pool.query(
      `SELECT cm.*, mt.class_type, mt.description, mt.icon, mt.range_type, mt.element, mt.weapon_type,
              mt.sell_price, mt.growth_hp, mt.growth_mp, mt.growth_phys_attack, mt.growth_phys_defense,
              mt.growth_mag_attack, mt.growth_mag_defense, mt.grade, mt.growth_mult
       FROM character_mercenaries cm
       JOIN mercenary_templates mt ON cm.template_id = mt.id
       WHERE cm.character_id = ?
       ORDER BY cm.level DESC, cm.name`,
      [charId]
    );

    // 각 용병의 학습된 스킬 + 장착 장비 수 로드
    for (const merc of mercenaries) {
      const [skills] = await pool.query(
        `SELECT ms.*, mls.auto_priority FROM mercenary_skills ms
         JOIN mercenary_learned_skills mls ON ms.id = mls.skill_id
         WHERE mls.mercenary_id = ?
         ORDER BY ms.required_level, ms.id`,
        [merc.id]
      );
      merc.learned_skills = skills;
      const [[{ cnt }]] = await pool.query(
        'SELECT COUNT(*) as cnt FROM mercenary_equipment WHERE mercenary_id = ?',
        [merc.id]
      );
      merc.equipped_count = cnt;
    }

    // 고용 슬롯 정보
    const MERC_SLOTS = [
      { level: 1, slots: 1 }, { level: 8, slots: 2 }, { level: 18, slots: 3 },
      { level: 30, slots: 4 }, { level: 45, slots: 5 },
    ];
    const maxSlots = MERC_SLOTS.filter(s => charLevel >= s.level).pop()?.slots || 1;
    const nextSlot = MERC_SLOTS.find(s => s.slots > maxSlots) || null;

    res.json({ mercenaries, mercSlots: { current: mercenaries.length, max: maxSlots, next: nextSlot } });
  } catch (err) {
    console.error('My mercenaries error:', err);
    res.status(500).json({ message: '서버 오류가 발생했습니다.' });
  }
});

// 용병 고용
router.post('/hire', auth, async (req, res) => {
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

    const [templates] = await conn.query('SELECT * FROM mercenary_templates WHERE id = ?', [templateId]);
    if (templates.length === 0) return res.status(404).json({ message: '용병을 찾을 수 없습니다.' });
    const tpl = templates[0];

    // 상점 구매는 일반/고급 + shop 타입만 허용
    if (tpl.acquisition_type !== 'shop' || !['일반', '고급'].includes(tpl.grade)) {
      return res.status(400).json({ message: '이 용병은 상점에서 고용할 수 없습니다. (가챠/퀘스트/보스 클리어로 획득)' });
    }

    if (char.level < tpl.required_level) {
      return res.status(400).json({ message: `레벨 ${tpl.required_level} 이상이어야 고용할 수 있습니다.` });
    }

    const gold = char.gold || 0;
    if (gold < tpl.price) {
      return res.status(400).json({ message: `골드가 부족합니다. (필요: ${tpl.price}G, 보유: ${gold}G)` });
    }

    // 레벨별 고용 인원 제한
    const MERC_SLOTS = [
      { level: 1,  slots: 1 },
      { level: 8,  slots: 2 },
      { level: 18, slots: 3 },
      { level: 30, slots: 4 },
      { level: 45, slots: 5 },
    ];
    const maxSlots = MERC_SLOTS.filter(s => char.level >= s.level).pop()?.slots || 1;
    const [countCheck] = await conn.query(
      'SELECT COUNT(*) as cnt FROM character_mercenaries WHERE character_id = ?', [char.id]
    );
    if (countCheck[0].cnt >= maxSlots) {
      const nextSlot = MERC_SLOTS.find(s => s.slots > maxSlots);
      const msg = nextSlot
        ? `현재 레벨에서는 용병을 ${maxSlots}명까지만 고용할 수 있습니다. (Lv.${nextSlot.level}에서 ${nextSlot.slots}명)`
        : `용병은 최대 ${maxSlots}명까지 고용할 수 있습니다.`;
      return res.status(400).json({ message: msg });
    }

    await conn.beginTransaction();

    await conn.query('UPDATE characters SET gold = gold - ? WHERE id = ?', [tpl.price, char.id]);

    await conn.query(
      `INSERT INTO character_mercenaries
       (character_id, template_id, name, level, exp, hp, mp,
        phys_attack, phys_defense, mag_attack, mag_defense, crit_rate, evasion,
        fatigue, max_fatigue, last_fatigue_recovery)
       VALUES (?, ?, ?, 1, 0, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())`,
      [char.id, tpl.id, tpl.name, tpl.base_hp, tpl.base_mp,
       tpl.base_phys_attack, tpl.base_phys_defense, tpl.base_mag_attack, tpl.base_mag_defense,
       tpl.base_crit_rate, tpl.base_evasion, tpl.max_fatigue || 7, tpl.max_fatigue || 7]
    );

    // 고용한 용병의 ID 가져오기
    const [inserted] = await conn.query('SELECT LAST_INSERT_ID() as mercId');
    const newMercId = inserted[0].mercId;

    // 기본 스킬 자동 학습 (레벨 1 이하 스킬만)
    const [defaultSkills] = await conn.query(
      `SELECT id FROM mercenary_skills
       WHERE (is_common = 1 AND required_level <= 1)
          OR (class_type = ? AND required_level <= 1)`,
      [tpl.class_type]
    );
    for (const sk of defaultSkills) {
      await conn.query(
        'INSERT IGNORE INTO mercenary_learned_skills (mercenary_id, skill_id) VALUES (?, ?)',
        [newMercId, sk.id]
      );
    }

    await conn.commit();

    const [updatedChar] = await pool.query('SELECT gold FROM characters WHERE id = ?', [char.id]);

    res.json({
      message: `${tpl.name}을(를) 고용했습니다!`,
      gold: updatedChar[0].gold,
    });
  } catch (err) {
    await conn.rollback();
    console.error('Hire mercenary error:', err);
    res.status(500).json({ message: '서버 오류가 발생했습니다.' });
  } finally {
    conn.release();
  }
});

// 용병 해고
router.post('/fire', auth, async (req, res) => {
  const conn = await pool.getConnection();
  try {
    const { mercenaryId } = req.body;
    const [chars] = await conn.query(
      req.selectedCharId
        ? 'SELECT * FROM characters WHERE id = ? AND user_id = ?'
        : 'SELECT * FROM characters WHERE user_id = ? ORDER BY id LIMIT 1',
      req.selectedCharId ? [req.selectedCharId, req.user.id] : [req.user.id]
    );
    if (chars.length === 0) return res.status(404).json({ message: '캐릭터가 없습니다.' });
    const char = chars[0];

    const [mercs] = await conn.query(
      `SELECT cm.*, mt.name FROM character_mercenaries cm
       JOIN mercenary_templates mt ON cm.template_id = mt.id
       WHERE cm.id = ? AND cm.character_id = ?`,
      [mercenaryId, char.id]
    );
    if (mercs.length === 0) return res.status(404).json({ message: '용병을 찾을 수 없습니다.' });
    const merc = mercs[0];

    // 장비 장착 여부 확인
    const [equipped] = await conn.query(
      'SELECT COUNT(*) as cnt FROM mercenary_equipment WHERE mercenary_id = ?',
      [mercenaryId]
    );
    if (equipped[0].cnt > 0) {
      return res.status(400).json({ message: '장비를 장착한 용병은 해고할 수 없습니다. 먼저 장비를 해제해주세요.' });
    }

    await conn.query('DELETE FROM character_mercenaries WHERE id = ?', [mercenaryId]);

    res.json({
      message: `${merc.name}을(를) 해고했습니다.`,
    });
  } catch (err) {
    await conn.rollback();
    console.error('Fire mercenary error:', err);
    res.status(500).json({ message: '서버 오류가 발생했습니다.' });
  } finally {
    conn.release();
  }
});

const SLOT_NAMES = {
  helmet: '투구', chest: '갑옷', boots: '장화',
  weapon: '무기', shield: '방패', ring: '반지', necklace: '목걸이',
};

// 용병 장비 조회
router.get('/:mercId/equipment', auth, async (req, res) => {
  try {
    const { getSelectedChar } = require('../db');
    const char = await getSelectedChar(req, pool);
    if (!char) return res.json({ equipped: {}, inventory: [] });

    const [mercs] = await pool.query(
      'SELECT id FROM character_mercenaries WHERE id = ? AND character_id = ?',
      [req.params.mercId, char.id]
    );
    if (mercs.length === 0) return res.status(404).json({ message: '용병을 찾을 수 없습니다.' });

    // 용병 장착 장비
    const [equipped] = await pool.query(
      `SELECT me.slot, me.item_id, me.enhance_level as equip_enhance_level, it.*
       FROM mercenary_equipment me
       JOIN items it ON me.item_id = it.id
       WHERE me.mercenary_id = ?`,
      [req.params.mercId]
    );

    const equippedMap = {};
    equipped.forEach((e) => {
      equippedMap[e.slot] = {
        item_id: e.item_id, name: e.name, type: e.type, slot: e.slot,
        weapon_hand: e.weapon_hand, description: e.description,
        effect_hp: e.effect_hp, effect_mp: e.effect_mp,
        effect_attack: e.effect_attack, effect_defense: e.effect_defense,
        effect_phys_attack: e.effect_phys_attack, effect_phys_defense: e.effect_phys_defense,
        effect_mag_attack: e.effect_mag_attack, effect_mag_defense: e.effect_mag_defense,
        effect_crit_rate: e.effect_crit_rate, effect_evasion: e.effect_evasion,
        grade: e.grade, enhance_level: e.equip_enhance_level || 0, max_enhance: e.max_enhance,
        required_level: e.required_level,
      };
    });

    // 장착 중인 item_id별 개수 카운트
    const equippedCountMap = {};
    const addCount = (rows) => { for (const r of rows) equippedCountMap[r.item_id] = (equippedCountMap[r.item_id] || 0) + 1; };

    const [charEquipped] = await pool.query('SELECT item_id FROM equipment WHERE character_id = ?', [char.id]);
    addCount(charEquipped);

    const [summonEquipped] = await pool.query(
      `SELECT se.item_id FROM summon_equipment se
       JOIN character_summons cs ON se.summon_id = cs.id
       WHERE cs.character_id = ?`, [char.id]
    );
    addCount(summonEquipped);

    const [otherMercEquipped] = await pool.query(
      `SELECT me.item_id FROM mercenary_equipment me
       JOIN character_mercenaries cm ON me.mercenary_id = cm.id
       WHERE cm.character_id = ? AND me.mercenary_id != ?`,
      [char.id, req.params.mercId]
    );
    addCount(otherMercEquipped);
    addCount(equipped); // 현재 용병 장착

    const [cosmeticEquipped] = await pool.query('SELECT item_id FROM equipped_cosmetics WHERE character_id = ?', [char.id]);
    addCount(cosmeticEquipped);

    const [inventory] = await pool.query(
      `SELECT i.*, it.name, it.type, it.slot, it.weapon_hand, it.description, it.price, it.sell_price,
              it.effect_hp, it.effect_mp, it.effect_attack, it.effect_defense,
              it.effect_phys_attack, it.effect_phys_defense, it.effect_mag_attack, it.effect_mag_defense,
              it.effect_crit_rate, it.effect_evasion, it.required_level, it.class_restriction,
              IFNULL(it.grade, '일반') as grade, it.max_enhance, it.cosmetic_effect
       FROM inventory i
       JOIN items it ON i.item_id = it.id
       WHERE i.character_id = ? AND it.type != 'potion'
       ORDER BY it.type, it.name`,
      [char.id]
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
      [char.id]
    );

    res.json({ equipped: equippedMap, inventory: availableInventory, potions });
  } catch (err) {
    console.error('Mercenary equipment info error:', err);
    res.status(500).json({ message: '서버 오류가 발생했습니다.' });
  }
});

// 용병 장비 장착
router.post('/:mercId/equip', auth, async (req, res) => {
  const conn = await pool.getConnection();
  try {
    const { getSelectedChar } = require('../db');
    const char = await getSelectedChar(req, conn);
    if (!char) return res.status(404).json({ message: '캐릭터가 없습니다.' });
    const mercId = req.params.mercId;
    const { itemId, slot } = req.body;

    const [mercs] = await conn.query(
      'SELECT * FROM character_mercenaries WHERE id = ? AND character_id = ?', [mercId, char.id]
    );
    if (mercs.length === 0) return res.status(404).json({ message: '용병을 찾을 수 없습니다.' });

    const [itemRows] = await conn.query('SELECT * FROM items WHERE id = ?', [itemId]);
    if (itemRows.length === 0) return res.status(404).json({ message: '아이템을 찾을 수 없습니다.' });
    const item = itemRows[0];

    const [invRows] = await conn.query('SELECT * FROM inventory WHERE character_id = ? AND item_id = ?', [char.id, itemId]);
    if (invRows.length === 0) return res.status(400).json({ message: '보유하지 않은 아이템입니다.' });
    const ownedCount = invRows.reduce((s, r) => s + (r.quantity || 1), 0);
    if (item.slot !== slot) return res.status(400).json({ message: '해당 슬롯에 장착할 수 없는 아이템입니다.' });
    if (item.class_restriction) return res.status(400).json({ message: '클래스 제한 아이템은 용병에 장착할 수 없습니다.' });
    const merc = mercs[0];
    if (item.required_level && merc.level < item.required_level) {
      return res.status(400).json({ message: `용병 레벨이 부족합니다. (필요: Lv.${item.required_level}, 현재: Lv.${merc.level})` });
    }

    // 장착 중인 총 개수 확인 (캐릭터 + 소환수 + 용병)
    const [eqCnt] = await conn.query('SELECT COUNT(*) as cnt FROM equipment WHERE character_id = ? AND item_id = ?', [char.id, itemId]);
    const [seCnt] = await conn.query(
      `SELECT COUNT(*) as cnt FROM summon_equipment se JOIN character_summons cs ON se.summon_id = cs.id WHERE cs.character_id = ? AND se.item_id = ?`,
      [char.id, itemId]
    );
    const [meCnt] = await conn.query(
      `SELECT COUNT(*) as cnt FROM mercenary_equipment me JOIN character_mercenaries cm ON me.mercenary_id = cm.id WHERE cm.character_id = ? AND me.item_id = ? AND me.mercenary_id != ?`,
      [char.id, itemId, mercId]
    );
    const totalEquipped = (eqCnt[0].cnt || 0) + (seCnt[0].cnt || 0) + (meCnt[0].cnt || 0);
    if (totalEquipped >= ownedCount) {
      return res.status(400).json({ message: '사용 가능한 아이템이 없습니다. (모두 장착 중)' });
    }

    // 방패 vs 양손무기 체크
    if (slot === 'shield') {
      const [weaponEquip] = await conn.query(
        `SELECT me.item_id, it.weapon_hand FROM mercenary_equipment me JOIN items it ON me.item_id = it.id WHERE me.mercenary_id = ? AND me.slot = 'weapon'`,
        [mercId]
      );
      if (weaponEquip.length > 0 && weaponEquip[0].weapon_hand === '2h') {
        return res.status(400).json({ message: '양손 무기를 장착 중이라 방패를 장착할 수 없습니다.' });
      }
    }

    await conn.beginTransaction();

    // 양손무기 장착 시 방패 자동 해제
    if (slot === 'weapon' && item.weapon_hand === '2h') {
      const [shieldEquip] = await conn.query(
        `SELECT me.item_id, it.effect_hp, it.effect_mp, it.effect_attack, it.effect_defense,
                it.effect_phys_attack, it.effect_phys_defense, it.effect_mag_attack, it.effect_mag_defense,
                it.effect_crit_rate, it.effect_evasion
         FROM mercenary_equipment me JOIN items it ON me.item_id = it.id
         WHERE me.mercenary_id = ? AND me.slot = 'shield'`, [mercId]
      );
      if (shieldEquip.length > 0) {
        const s = shieldEquip[0];
        await conn.query('DELETE FROM mercenary_equipment WHERE mercenary_id = ? AND slot = ?', [mercId, 'shield']);
        await conn.query(
          `UPDATE character_mercenaries SET
            hp = GREATEST(1, hp - ?), mp = GREATEST(0, mp - ?),
            phys_attack = GREATEST(0, phys_attack - ?), phys_defense = GREATEST(0, phys_defense - ?),
            mag_attack = GREATEST(0, mag_attack - ?), mag_defense = GREATEST(0, mag_defense - ?),
            crit_rate = GREATEST(0, crit_rate - ?), evasion = GREATEST(0, evasion - ?)
           WHERE id = ?`,
          [s.effect_hp, s.effect_mp, s.effect_phys_attack, s.effect_phys_defense,
           s.effect_mag_attack, s.effect_mag_defense, s.effect_crit_rate, s.effect_evasion, mercId]
        );
      }
    }

    // 기존 장비 해제
    const [currentEquip] = await conn.query(
      `SELECT me.item_id, it.effect_hp, it.effect_mp, it.effect_attack, it.effect_defense,
              it.effect_phys_attack, it.effect_phys_defense, it.effect_mag_attack, it.effect_mag_defense,
              it.effect_crit_rate, it.effect_evasion, it.name
       FROM mercenary_equipment me JOIN items it ON me.item_id = it.id
       WHERE me.mercenary_id = ? AND me.slot = ?`, [mercId, slot]
    );

    if (currentEquip.length > 0) {
      const old = currentEquip[0];
      await conn.query('DELETE FROM mercenary_equipment WHERE mercenary_id = ? AND slot = ?', [mercId, slot]);
      await conn.query(
        `UPDATE character_mercenaries SET
          hp = GREATEST(1, hp - ?), mp = GREATEST(0, mp - ?),
          phys_attack = GREATEST(0, phys_attack - ?), phys_defense = GREATEST(0, phys_defense - ?),
          mag_attack = GREATEST(0, mag_attack - ?), mag_defense = GREATEST(0, mag_defense - ?),
          crit_rate = GREATEST(0, crit_rate - ?), evasion = GREATEST(0, evasion - ?)
         WHERE id = ?`,
        [old.effect_hp, old.effect_mp, old.effect_phys_attack, old.effect_phys_defense,
         old.effect_mag_attack, old.effect_mag_defense, old.effect_crit_rate, old.effect_evasion, mercId]
      );
    }

    // 새 장비 장착 (강화 레벨 포함)
    const invEnhLevel = invRows[0]?.enhance_level || 0;
    await conn.query('INSERT INTO mercenary_equipment (mercenary_id, slot, item_id, enhance_level) VALUES (?, ?, ?, ?)', [mercId, slot, itemId, invEnhLevel]);
    await conn.query(
      `UPDATE character_mercenaries SET hp = hp + ?, mp = mp + ?,
        phys_attack = phys_attack + ?, phys_defense = phys_defense + ?,
        mag_attack = mag_attack + ?, mag_defense = mag_defense + ?,
        crit_rate = crit_rate + ?, evasion = evasion + ?
       WHERE id = ?`,
      [item.effect_hp, item.effect_mp, item.effect_phys_attack, item.effect_phys_defense,
       item.effect_mag_attack, item.effect_mag_defense, item.effect_crit_rate, item.effect_evasion, mercId]
    );

    await conn.commit();
    const [updated] = await pool.query('SELECT * FROM character_mercenaries WHERE id = ?', [mercId]);

    let msg = `${item.name}을(를) ${SLOT_NAMES[slot]}에 장착했습니다.`;
    if (currentEquip.length > 0) msg = `${currentEquip[0].name} -> ${item.name}(으)로 교체했습니다.`;

    res.json({ message: msg, mercenary: updated[0] });
  } catch (err) {
    await conn.rollback();
    console.error('Mercenary equip error:', err);
    res.status(500).json({ message: '서버 오류가 발생했습니다.' });
  } finally { conn.release(); }
});

// 용병 장비 해제
router.post('/:mercId/unequip', auth, async (req, res) => {
  const conn = await pool.getConnection();
  try {
    const { getSelectedChar } = require('../db');
    const char = await getSelectedChar(req, conn);
    if (!char) return res.status(404).json({ message: '캐릭터가 없습니다.' });
    const mercId = req.params.mercId;
    const { slot } = req.body;

    const [mercs] = await conn.query(
      'SELECT id FROM character_mercenaries WHERE id = ? AND character_id = ?', [mercId, char.id]
    );
    if (mercs.length === 0) return res.status(404).json({ message: '용병을 찾을 수 없습니다.' });

    const [equipRows] = await conn.query(
      `SELECT me.item_id, it.effect_hp, it.effect_mp, it.effect_attack, it.effect_defense,
              it.effect_phys_attack, it.effect_phys_defense, it.effect_mag_attack, it.effect_mag_defense,
              it.effect_crit_rate, it.effect_evasion, it.name
       FROM mercenary_equipment me JOIN items it ON me.item_id = it.id
       WHERE me.mercenary_id = ? AND me.slot = ?`, [mercId, slot]
    );
    if (equipRows.length === 0) return res.status(400).json({ message: '해당 슬롯에 장착된 장비가 없습니다.' });
    const equip = equipRows[0];

    await conn.beginTransaction();
    await conn.query('DELETE FROM mercenary_equipment WHERE mercenary_id = ? AND slot = ?', [mercId, slot]);
    await conn.query(
      `UPDATE character_mercenaries SET
        hp = GREATEST(1, hp - ?), mp = GREATEST(0, mp - ?),
        phys_attack = GREATEST(0, phys_attack - ?), phys_defense = GREATEST(0, phys_defense - ?),
        mag_attack = GREATEST(0, mag_attack - ?), mag_defense = GREATEST(0, mag_defense - ?),
        crit_rate = GREATEST(0, crit_rate - ?), evasion = GREATEST(0, evasion - ?)
       WHERE id = ?`,
      [equip.effect_hp, equip.effect_mp, equip.effect_phys_attack, equip.effect_phys_defense,
       equip.effect_mag_attack, equip.effect_mag_defense, equip.effect_crit_rate, equip.effect_evasion, mercId]
    );
    await conn.commit();

    const [updated] = await pool.query('SELECT * FROM character_mercenaries WHERE id = ?', [mercId]);
    res.json({ message: `${equip.name}을(를) 해제했습니다.`, mercenary: updated[0] });
  } catch (err) {
    await conn.rollback();
    console.error('Mercenary unequip error:', err);
    res.status(500).json({ message: '서버 오류가 발생했습니다.' });
  } finally { conn.release(); }
});

// 용병 스킬 목록 (학습 가능 + 학습 완료)
router.get('/:mercId/skills', auth, async (req, res) => {
  try {
    const { getSelectedChar } = require('../db');
    const char = await getSelectedChar(req, pool);
    if (!char) return res.status(404).json({ message: '캐릭터를 찾을 수 없습니다.' });

    const [mercs] = await pool.query(
      `SELECT cm.*, mt.class_type FROM character_mercenaries cm
       JOIN mercenary_templates mt ON cm.template_id = mt.id
       WHERE cm.id = ? AND cm.character_id = ?`,
      [req.params.mercId, char.id]
    );
    if (mercs.length === 0) return res.status(404).json({ message: '용병을 찾을 수 없습니다.' });
    const merc = mercs[0];

    // 학습 가능한 스킬 (공통 + class_type 매칭)
    const [available] = await pool.query(
      `SELECT * FROM mercenary_skills
       WHERE (is_common = 1) OR (class_type = ?)
       ORDER BY required_level, id`,
      [merc.class_type]
    );

    // 이미 학습한 스킬 ID + 우선도
    const [learned] = await pool.query(
      'SELECT skill_id, auto_priority FROM mercenary_learned_skills WHERE mercenary_id = ?',
      [merc.id]
    );
    const learnedMap = {};
    for (const l of learned) learnedMap[l.skill_id] = l.auto_priority ?? 100;

    const skills = available.map(s => ({
      ...s,
      learned: s.id in learnedMap,
      auto_priority: learnedMap[s.id] ?? 100,
      canLearn: !(s.id in learnedMap) && merc.level >= s.required_level,
      gold_cost: Math.floor(s.required_level * 50 * (1 + (merc.level - 1) * 0.1)),
    }));

    res.json({ skills, mercLevel: merc.level });
  } catch (err) {
    console.error('Mercenary skills error:', err);
    res.status(500).json({ message: '서버 오류가 발생했습니다.' });
  }
});

// 용병 스킬 학습
router.post('/:mercId/learn-skill', auth, async (req, res) => {
  try {
    const { getSelectedChar } = require('../db');
    const char = await getSelectedChar(req, pool);
    if (!char) return res.status(404).json({ message: '캐릭터를 찾을 수 없습니다.' });

    const [mercs] = await pool.query(
      `SELECT cm.*, mt.class_type FROM character_mercenaries cm
       JOIN mercenary_templates mt ON cm.template_id = mt.id
       WHERE cm.id = ? AND cm.character_id = ?`,
      [req.params.mercId, char.id]
    );
    if (mercs.length === 0) return res.status(404).json({ message: '용병을 찾을 수 없습니다.' });
    const merc = mercs[0];

    const { skillId } = req.body;
    const [skills] = await pool.query('SELECT * FROM mercenary_skills WHERE id = ?', [skillId]);
    if (skills.length === 0) return res.status(404).json({ message: '스킬을 찾을 수 없습니다.' });
    const skill = skills[0];

    // 조건 체크
    if (skill.class_type && skill.class_type !== merc.class_type && !skill.is_common) {
      return res.status(400).json({ message: '이 용병이 배울 수 없는 스킬입니다.' });
    }
    if (merc.level < skill.required_level) {
      return res.status(400).json({ message: `레벨 ${skill.required_level} 이상이어야 배울 수 있습니다.` });
    }

    // 중복 체크
    const [existing] = await pool.query(
      'SELECT id FROM mercenary_learned_skills WHERE mercenary_id = ? AND skill_id = ?',
      [merc.id, skillId]
    );
    if (existing.length > 0) {
      return res.status(400).json({ message: '이미 학습한 스킬입니다.' });
    }

    // 골드 비용: 스킬 요구레벨 기반 + 용병 레벨 비례
    const goldCost = Math.floor(skill.required_level * 50 * (1 + (merc.level - 1) * 0.1));
    if (char.gold < goldCost) {
      return res.status(400).json({ message: `골드가 부족합니다. (필요: ${goldCost}G, 보유: ${char.gold}G)` });
    }

    await pool.query('UPDATE characters SET gold = gold - ? WHERE id = ?', [goldCost, char.id]);
    await pool.query(
      'INSERT INTO mercenary_learned_skills (mercenary_id, skill_id) VALUES (?, ?)',
      [merc.id, skillId]
    );

    const [updated] = await pool.query('SELECT gold FROM characters WHERE id = ?', [char.id]);
    res.json({ message: `${skill.name} 스킬을 학습했습니다! (-${goldCost}G)`, gold: updated[0].gold });
  } catch (err) {
    console.error('Learn mercenary skill error:', err);
    res.status(500).json({ message: '서버 오류가 발생했습니다.' });
  }
});

// 여관 휴식 (HP/MP 전부 회복, 골드 OR 행동력 1 소모)
router.post('/rest', auth, async (req, res) => {
  try {
    const { getSelectedChar, refreshStamina } = require('../db');
    const char = await getSelectedChar(req, pool);
    if (!char) return res.status(404).json({ message: '캐릭터를 찾을 수 없습니다.' });

    if (char.current_hp >= char.hp && char.current_mp >= char.mp) {
      return res.status(400).json({ message: '이미 컨디션이 최상입니다!' });
    }

    const { payType } = req.body; // 'gold' or 'stamina'
    const restCost = Math.max(10, Math.floor(char.level * 5));

    if (payType === 'stamina') {
      await refreshStamina(char, pool);
      if (char.stamina <= 0) {
        return res.status(400).json({ message: '행동력이 부족합니다!' });
      }
      await pool.query(
        'UPDATE characters SET current_hp = hp, current_mp = mp, stamina = stamina - 1 WHERE id = ?',
        [char.id]
      );
      if (char.stamina >= char.max_stamina) {
        await pool.query('UPDATE characters SET last_stamina_time = NOW() WHERE id = ?', [char.id]);
      }
    } else {
      if (char.gold < restCost) {
        return res.status(400).json({ message: `골드가 부족합니다. (${restCost}G 필요)` });
      }
      await pool.query(
        'UPDATE characters SET current_hp = hp, current_mp = mp, gold = gold - ? WHERE id = ?',
        [restCost, char.id]
      );
    }

    const [updated] = await pool.query(
      'SELECT current_hp, current_mp, hp, mp, gold, stamina, max_stamina FROM characters WHERE id = ?', [char.id]
    );
    const c = updated[0];

    const msg = payType === 'stamina'
      ? '편안한 휴식으로 HP/MP가 완전히 회복되었습니다! (행동력 -1)'
      : `편안한 휴식으로 HP/MP가 완전히 회복되었습니다! (-${restCost}G)`;

    res.json({
      message: msg,
      currentHp: c.current_hp,
      currentMp: c.current_mp,
      maxHp: c.hp,
      maxMp: c.mp,
      gold: c.gold,
      stamina: c.stamina,
      maxStamina: c.max_stamina,
      cost: payType === 'stamina' ? 0 : restCost,
    });
  } catch (err) {
    console.error('Rest error:', err);
    res.status(500).json({ message: '서버 오류가 발생했습니다.' });
  }
});

// 용병 휴식 (피로도 전부 회복, 골드 OR 행동력 1 소모)
router.post('/rest-merc', auth, async (req, res) => {
  try {
    const { getSelectedChar, refreshStamina } = require('../db');
    const char = await getSelectedChar(req, pool);
    if (!char) return res.status(404).json({ message: '캐릭터를 찾을 수 없습니다.' });

    const { mercenaryId, payType } = req.body;
    const [mercs] = await pool.query(
      'SELECT * FROM character_mercenaries WHERE id = ? AND character_id = ?',
      [mercenaryId, char.id]
    );
    if (mercs.length === 0) return res.status(404).json({ message: '용병을 찾을 수 없습니다.' });
    const merc = mercs[0];

    if (merc.fatigue >= merc.max_fatigue) {
      return res.status(400).json({ message: '이미 피로도가 최대입니다!' });
    }

    const restCost = Math.max(20, Math.floor(merc.level * 10));

    if (payType === 'stamina') {
      await refreshStamina(char, pool);
      const [freshChar] = await pool.query('SELECT stamina, max_stamina FROM characters WHERE id = ?', [char.id]);
      if (freshChar[0].stamina <= 0) {
        return res.status(400).json({ message: '행동력이 부족합니다!' });
      }
      await pool.query('UPDATE characters SET stamina = stamina - 1 WHERE id = ?', [char.id]);
      if (freshChar[0].stamina >= freshChar[0].max_stamina) {
        await pool.query('UPDATE characters SET last_stamina_time = NOW() WHERE id = ?', [char.id]);
      }
    } else {
      if (char.gold < restCost) {
        return res.status(400).json({ message: `골드가 부족합니다. (${restCost}G 필요)` });
      }
      await pool.query('UPDATE characters SET gold = gold - ? WHERE id = ?', [restCost, char.id]);
    }

    await pool.query(
      'UPDATE character_mercenaries SET fatigue = max_fatigue, last_fatigue_recovery = NOW() WHERE id = ?',
      [merc.id]
    );

    const [updated] = await pool.query('SELECT gold, stamina, max_stamina FROM characters WHERE id = ?', [char.id]);
    const c = updated[0];

    const msg = payType === 'stamina'
      ? `${merc.name}의 피로가 완전히 회복되었습니다! (행동력 -1)`
      : `${merc.name}의 피로가 완전히 회복되었습니다! (-${restCost}G)`;

    res.json({
      message: msg,
      gold: c.gold,
      stamina: c.stamina,
      maxStamina: c.max_stamina,
      cost: payType === 'stamina' ? 0 : restCost,
    });
  } catch (err) {
    console.error('Merc rest error:', err);
    res.status(500).json({ message: '서버 오류가 발생했습니다.' });
  }
});

// PUT /mercenary/:id/skill-priority - 용병 스킬 자동전투 우선도
router.put('/:id/skill-priority', auth, async (req, res) => {
  try {
    const mercId = parseInt(req.params.id);
    const { skill_id, priority } = req.body;
    if (!skill_id || priority === undefined) return res.status(400).json({ message: '잘못된 요청입니다.' });
    const p = Math.max(0, Math.min(200, Math.round(Number(priority))));
    await pool.query(
      'UPDATE mercenary_learned_skills SET auto_priority = ? WHERE mercenary_id = ? AND skill_id = ?',
      [p, mercId, skill_id]
    );
    res.json({ success: true, auto_priority: p });
  } catch (err) {
    console.error('Merc skill priority error:', err);
    res.status(500).json({ message: '서버 오류가 발생했습니다.' });
  }
});

// ── 용병 성급 강화 ──
const STAR_LEVEL_REQUIREMENTS = {
  1: 1,   // 0→1성: 레벨 제한 없음
  2: 10,  // 1→2성: Lv.10
  3: 20,  // 2→3성: Lv.20
  4: 35,  // 3→4성: Lv.35
  5: 50,  // 4→5성: Lv.50
  6: 70,  // 5→6성: Lv.70
};

const GRADE_ENHANCE_TICKET = {
  '일반': '일반용병강화권', '고급': '고급용병강화권', '희귀': '희귀용병강화권',
  '영웅': '영웅용병강화권', '전설': '전설용병강화권', '신화': '신화용병강화권', '초월': '초월용병강화권',
};

// 강화 정보 조회
router.get('/enhance-info/:mercenaryId', auth, async (req, res) => {
  try {
    const char = await require('../db').getSelectedChar(req, pool);
    if (!char) return res.status(400).json({ message: '캐릭터를 찾을 수 없습니다.' });

    const [mercs] = await pool.query(
      `SELECT cm.*, mt.grade FROM character_mercenaries cm
       JOIN mercenary_templates mt ON cm.template_id = mt.id
       WHERE cm.id = ? AND cm.character_id = ?`,
      [req.params.mercenaryId, char.id]
    );
    if (mercs.length === 0) return res.status(404).json({ message: '용병을 찾을 수 없습니다.' });
    const merc = mercs[0];

    if (merc.star_level >= 6) return res.json({ maxed: true, starLevel: 6, grade: merc.grade });

    const nextStar = (merc.star_level || 0) + 1;
    const requiredLevel = STAR_LEVEL_REQUIREMENTS[nextStar] || 1;
    const [rates] = await pool.query('SELECT success_rate FROM unit_enhance_rates WHERE grade = ? AND star_level = ?', [merc.grade, nextStar]);
    const successRate = rates.length > 0 ? rates[0].success_rate : 0.5;

    const ticketName = GRADE_ENHANCE_TICKET[merc.grade];
    const [ticketItem] = await pool.query('SELECT id, name FROM items WHERE name = ?', [ticketName]);
    let ticketOwned = 0;
    if (ticketItem.length > 0) {
      const [inv] = await pool.query('SELECT quantity FROM inventory WHERE character_id = ? AND item_id = ?', [char.id, ticketItem[0].id]);
      ticketOwned = inv.length > 0 ? inv[0].quantity : 0;
    }

    res.json({
      starLevel: merc.star_level || 0,
      nextStar,
      grade: merc.grade,
      successRate,
      requiredLevel,
      unitLevel: merc.level || 1,
      ticketName,
      ticketItemId: ticketItem[0]?.id,
      ticketOwned,
      maxed: false,
    });
  } catch (err) {
    console.error('Merc enhance info error:', err);
    res.status(500).json({ message: '서버 오류가 발생했습니다.' });
  }
});

// 강화 실행
router.post('/enhance', auth, async (req, res) => {
  const conn = await pool.getConnection();
  try {
    const char = await require('../db').getSelectedChar(req, conn);
    if (!char) { conn.release(); return res.status(400).json({ message: '캐릭터를 찾을 수 없습니다.' }); }

    const { mercenaryId } = req.body;
    const [mercs] = await conn.query(
      `SELECT cm.*, mt.grade, mt.base_hp, mt.base_mp, mt.base_phys_attack, mt.base_phys_defense, mt.base_mag_attack, mt.base_mag_defense
       FROM character_mercenaries cm JOIN mercenary_templates mt ON cm.template_id = mt.id
       WHERE cm.id = ? AND cm.character_id = ?`, [mercenaryId, char.id]
    );
    if (mercs.length === 0) { conn.release(); return res.status(404).json({ message: '용병을 찾을 수 없습니다.' }); }
    const merc = mercs[0];

    const currentStar = merc.star_level || 0;
    if (currentStar >= 6) { conn.release(); return res.status(400).json({ message: '이미 최대 성급(6성)입니다.' }); }

    const nextStar = currentStar + 1;
    const requiredLevel = STAR_LEVEL_REQUIREMENTS[nextStar] || 1;
    if (merc.level < requiredLevel) {
      conn.release();
      return res.status(400).json({ message: `${nextStar}성 강화는 용병 Lv.${requiredLevel} 이상이어야 합니다. (현재 Lv.${merc.level})` });
    }

    const ticketName = GRADE_ENHANCE_TICKET[merc.grade];
    const [ticketItem] = await conn.query('SELECT id FROM items WHERE name = ?', [ticketName]);
    if (ticketItem.length === 0) { conn.release(); return res.status(500).json({ message: '강화권 아이템 오류' }); }

    const [inv] = await conn.query('SELECT quantity FROM inventory WHERE character_id = ? AND item_id = ?', [char.id, ticketItem[0].id]);
    if (!inv.length || inv[0].quantity <= 0) {
      conn.release();
      return res.status(400).json({ message: `${ticketName}이(가) 부족합니다.` });
    }

    const [rates] = await conn.query('SELECT success_rate FROM unit_enhance_rates WHERE grade = ? AND star_level = ?', [merc.grade, nextStar]);
    const successRate = rates.length > 0 ? rates[0].success_rate : 0.5;

    await conn.beginTransaction();

    // 강화권 1개 소모
    await conn.query('UPDATE inventory SET quantity = quantity - 1 WHERE character_id = ? AND item_id = ?', [char.id, ticketItem[0].id]);

    const roll = Math.random();
    const success = roll < successRate;

    if (success) {
      // 성급별 스탯 보너스 (성급이 높을수록 더 큰 보너스)
      // 1성:3%, 2성:4%, 3성:5%, 4성:6%, 5성:8%, 6성:10%
      const STAR_BONUS = { 1: 0.03, 2: 0.04, 3: 0.05, 4: 0.06, 5: 0.08, 6: 0.10 };
      const bonus = STAR_BONUS[nextStar] || 0.05;
      await conn.query(
        `UPDATE character_mercenaries SET star_level = ?,
          hp = hp + FLOOR(? * ?), mp = mp + FLOOR(? * ?),
          phys_attack = phys_attack + GREATEST(1, FLOOR(? * ?)),
          phys_defense = phys_defense + GREATEST(1, FLOOR(? * ?)),
          mag_attack = mag_attack + GREATEST(1, FLOOR(? * ?)),
          mag_defense = mag_defense + GREATEST(1, FLOOR(? * ?))
        WHERE id = ?`,
        [nextStar,
         merc.base_hp, bonus, merc.base_mp, bonus,
         merc.base_phys_attack, bonus, merc.base_phys_defense, bonus,
         merc.base_mag_attack, bonus, merc.base_mag_defense, bonus,
         mercenaryId]
      );
    }

    await conn.commit();

    res.json({
      success,
      starLevel: success ? nextStar : currentStar,
      successRate: Math.round(successRate * 100),
      message: success
        ? `강화 성공! ${merc.name} → ${nextStar}성 ⭐`
        : `강화 실패... (${Math.round(successRate * 100)}% 확률)`,
    });
  } catch (err) {
    await conn.rollback().catch(() => {});
    console.error('Merc enhance error:', err);
    res.status(500).json({ message: '서버 오류가 발생했습니다.' });
  } finally {
    conn.release();
  }
});

module.exports = router;
