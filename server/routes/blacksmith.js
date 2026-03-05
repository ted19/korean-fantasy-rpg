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

// 재료 인벤토리 조회
router.get('/materials', auth, async (req, res) => {
  try {
    const [chars] = await pool.query(
      req.selectedCharId
        ? 'SELECT id FROM characters WHERE id = ? AND user_id = ?'
        : 'SELECT id FROM characters WHERE user_id = ? ORDER BY id LIMIT 1',
      req.selectedCharId ? [req.selectedCharId, req.user.id] : [req.user.id]
    );
    if (chars.length === 0) return res.json({ materials: [] });

    const [materials] = await pool.query(
      `SELECT mi.*, m.name, m.icon, m.grade, m.description, m.sell_price
       FROM material_inventory mi
       JOIN materials m ON mi.material_id = m.id
       WHERE mi.character_id = ? AND mi.quantity > 0
       ORDER BY m.grade, m.name`,
      [chars[0].id]
    );
    res.json({ materials });
  } catch (err) {
    console.error('Materials error:', err);
    res.status(500).json({ message: '서버 오류' });
  }
});

// 제작 레시피 목록
router.get('/recipes', auth, async (req, res) => {
  try {
    const [chars] = await pool.query(
      req.selectedCharId
        ? 'SELECT id, level FROM characters WHERE id = ? AND user_id = ?'
        : 'SELECT id, level FROM characters WHERE user_id = ? ORDER BY id LIMIT 1',
      req.selectedCharId ? [req.selectedCharId, req.user.id] : [req.user.id]
    );
    if (chars.length === 0) return res.json({ recipes: [] });

    const [recipes] = await pool.query(
      `SELECT cr.id as recipe_id, cr.gold_cost, cr.required_level,
              i.id as item_id, i.name, i.type, i.grade, i.description,
              i.effect_hp, i.effect_mp, i.effect_attack, i.effect_defense,
              IFNULL(i.effect_phys_attack,0) as effect_phys_attack,
              IFNULL(i.effect_phys_defense,0) as effect_phys_defense,
              IFNULL(i.effect_mag_attack,0) as effect_mag_attack,
              IFNULL(i.effect_mag_defense,0) as effect_mag_defense,
              IFNULL(i.effect_crit_rate,0) as effect_crit_rate,
              IFNULL(i.effect_evasion,0) as effect_evasion,
              i.class_restriction, i.max_enhance
       FROM crafting_recipes cr
       JOIN items i ON cr.result_item_id = i.id
       ORDER BY cr.required_level, i.type, i.name`
    );

    // 각 레시피에 필요 재료 첨부
    for (const recipe of recipes) {
      const [mats] = await pool.query(
        `SELECT rm.material_id, rm.quantity as required_qty, m.name, m.icon, m.grade
         FROM recipe_materials rm
         JOIN materials m ON rm.material_id = m.id
         WHERE rm.recipe_id = ?`,
        [recipe.recipe_id]
      );

      // 캐릭터 보유량 확인
      for (const mat of mats) {
        const [inv] = await pool.query(
          'SELECT quantity FROM material_inventory WHERE character_id = ? AND material_id = ?',
          [chars[0].id, mat.material_id]
        );
        mat.owned_qty = inv.length > 0 ? inv[0].quantity : 0;
      }
      recipe.materials = mats;
    }

    res.json({ recipes, characterLevel: chars[0].level });
  } catch (err) {
    console.error('Recipes error:', err);
    res.status(500).json({ message: '서버 오류' });
  }
});

// 제작 실행
router.post('/craft', auth, async (req, res) => {
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    const { recipeId } = req.body;

    const [chars] = await conn.query(
      req.selectedCharId
        ? 'SELECT * FROM characters WHERE id = ? AND user_id = ?'
        : 'SELECT * FROM characters WHERE user_id = ? ORDER BY id LIMIT 1',
      req.selectedCharId ? [req.selectedCharId, req.user.id] : [req.user.id]
    );
    if (chars.length === 0) throw new Error('캐릭터 없음');
    const char = chars[0];

    // 레시피 확인
    const [recipes] = await conn.query(
      `SELECT cr.*, i.name as item_name FROM crafting_recipes cr JOIN items i ON cr.result_item_id = i.id WHERE cr.id = ?`,
      [recipeId]
    );
    if (recipes.length === 0) throw new Error('존재하지 않는 레시피');
    const recipe = recipes[0];

    // 레벨 확인
    if (char.level < recipe.required_level) {
      await conn.rollback();
      return res.status(400).json({ message: `레벨 ${recipe.required_level} 이상이어야 합니다.` });
    }

    // 골드 확인
    if (char.gold < recipe.gold_cost) {
      await conn.rollback();
      return res.status(400).json({ message: '골드가 부족합니다.' });
    }

    // 재료 확인
    const [reqMats] = await conn.query(
      'SELECT rm.material_id, rm.quantity, m.name FROM recipe_materials rm JOIN materials m ON rm.material_id = m.id WHERE rm.recipe_id = ?',
      [recipeId]
    );

    for (const mat of reqMats) {
      const [inv] = await conn.query(
        'SELECT quantity FROM material_inventory WHERE character_id = ? AND material_id = ?',
        [char.id, mat.material_id]
      );
      if (inv.length === 0 || inv[0].quantity < mat.quantity) {
        await conn.rollback();
        return res.status(400).json({ message: `재료 부족: ${mat.name} (${inv[0]?.quantity || 0}/${mat.quantity})` });
      }
    }

    // 재료 차감
    for (const mat of reqMats) {
      await conn.query(
        'UPDATE material_inventory SET quantity = quantity - ? WHERE character_id = ? AND material_id = ?',
        [mat.quantity, char.id, mat.material_id]
      );
    }

    // 골드 차감
    await conn.query('UPDATE characters SET gold = gold - ? WHERE id = ?', [recipe.gold_cost, char.id]);

    // 아이템 지급
    await conn.query(
      `INSERT INTO inventory (character_id, item_id, quantity, equipped, enhance_level)
       VALUES (?, ?, 1, 0, 0)
       ON DUPLICATE KEY UPDATE quantity = quantity + 1`,
      [char.id, recipe.result_item_id]
    );

    await conn.commit();
    res.json({ success: true, message: `${recipe.item_name} 제작 완료!`, itemName: recipe.item_name });
  } catch (err) {
    await conn.rollback();
    console.error('Craft error:', err);
    res.status(500).json({ message: err.message || '제작 실패' });
  } finally {
    conn.release();
  }
});

// 강화 가능한 장비 목록
router.get('/enhance-list', auth, async (req, res) => {
  try {
    const [chars] = await pool.query(
      req.selectedCharId
        ? 'SELECT id FROM characters WHERE id = ? AND user_id = ?'
        : 'SELECT id FROM characters WHERE user_id = ? ORDER BY id LIMIT 1',
      req.selectedCharId ? [req.selectedCharId, req.user.id] : [req.user.id]
    );
    if (chars.length === 0) return res.json({ items: [] });

    const [items] = await pool.query(
      `SELECT inv.id as inventory_id, inv.item_id, inv.quantity, inv.enhance_level, inv.equipped,
              i.name, i.type, i.grade, i.max_enhance, i.slot,
              i.effect_hp, i.effect_mp, i.effect_attack, i.effect_defense,
              IFNULL(i.effect_phys_attack,0) as effect_phys_attack,
              IFNULL(i.effect_phys_defense,0) as effect_phys_defense,
              IFNULL(i.effect_mag_attack,0) as effect_mag_attack,
              IFNULL(i.effect_mag_defense,0) as effect_mag_defense,
              IFNULL(i.effect_crit_rate,0) as effect_crit_rate,
              IFNULL(i.effect_evasion,0) as effect_evasion,
              i.class_restriction
       FROM inventory inv
       JOIN items i ON inv.item_id = i.id
       WHERE inv.character_id = ? AND i.type != 'potion' AND i.max_enhance > 0
       ORDER BY i.grade DESC, inv.enhance_level DESC, i.name`,
      [chars[0].id]
    );

    // 강화 비용/확률 정보
    const [rates] = await pool.query('SELECT * FROM enhance_rates ORDER BY enhance_level');

    res.json({ items, rates, characterId: chars[0].id });
  } catch (err) {
    console.error('Enhance list error:', err);
    res.status(500).json({ message: '서버 오류' });
  }
});

// 강화 실행
router.post('/enhance', auth, async (req, res) => {
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    const { inventoryId } = req.body;

    const [chars] = await conn.query(
      req.selectedCharId
        ? 'SELECT * FROM characters WHERE id = ? AND user_id = ?'
        : 'SELECT * FROM characters WHERE user_id = ? ORDER BY id LIMIT 1',
      req.selectedCharId ? [req.selectedCharId, req.user.id] : [req.user.id]
    );
    if (chars.length === 0) throw new Error('캐릭터 없음');
    const char = chars[0];

    // 인벤토리 아이템 확인
    const [invItems] = await conn.query(
      `SELECT inv.*, i.name, i.grade, i.max_enhance, i.type
       FROM inventory inv JOIN items i ON inv.item_id = i.id
       WHERE inv.id = ? AND inv.character_id = ?`,
      [inventoryId, char.id]
    );
    if (invItems.length === 0) {
      await conn.rollback();
      return res.status(400).json({ message: '아이템을 찾을 수 없습니다.' });
    }

    const item = invItems[0];
    const nextLevel = item.enhance_level + 1;

    if (nextLevel > item.max_enhance) {
      await conn.rollback();
      return res.status(400).json({ message: '이미 최대 강화 단계입니다.' });
    }

    // 강화 비용 확인
    const [rates] = await conn.query('SELECT * FROM enhance_rates WHERE enhance_level = ?', [nextLevel]);
    if (rates.length === 0) {
      await conn.rollback();
      return res.status(400).json({ message: '강화 정보를 찾을 수 없습니다.' });
    }
    const rate = rates[0];

    // 골드 확인
    if (char.gold < rate.gold_cost) {
      await conn.rollback();
      return res.status(400).json({ message: `골드가 부족합니다. (필요: ${rate.gold_cost}G)` });
    }

    // 등급별 강화석 결정
    const gradeEnhanceMap = {
      '일반': '강화석',
      '고급': '고급 강화석',
      '희귀': '희귀 강화석',
      '영웅': '영웅 강화석',
      '전설': '전설 강화석',
      '신화': '신화 강화석',
    };
    const enhanceStoneName = gradeEnhanceMap[item.grade] || '강화석';

    // 강화석 조회
    const [stones] = await conn.query('SELECT id FROM materials WHERE name = ?', [enhanceStoneName]);
    if (stones.length === 0) {
      await conn.rollback();
      return res.status(400).json({ message: '강화석 정보 오류' });
    }
    const stoneId = stones[0].id;

    // 강화석 보유량 확인
    const [stoneInv] = await conn.query(
      'SELECT quantity FROM material_inventory WHERE character_id = ? AND material_id = ?',
      [char.id, stoneId]
    );
    const ownedStones = stoneInv.length > 0 ? stoneInv[0].quantity : 0;
    if (ownedStones < rate.material_count) {
      await conn.rollback();
      return res.status(400).json({
        message: `${enhanceStoneName}이(가) 부족합니다. (${ownedStones}/${rate.material_count})`
      });
    }

    // 골드 차감
    await conn.query('UPDATE characters SET gold = gold - ? WHERE id = ?', [rate.gold_cost, char.id]);

    // 강화석 차감
    await conn.query(
      'UPDATE material_inventory SET quantity = quantity - ? WHERE character_id = ? AND material_id = ?',
      [rate.material_count, char.id, stoneId]
    );

    // 등급별 성공률 보너스
    const gradeBonus = { '일반': 0, '고급': 0.02, '희귀': -0.02, '영웅': -0.05, '전설': -0.08, '신화': -0.12 };
    const finalRate = Math.max(0.01, rate.success_rate + (gradeBonus[item.grade] || 0));

    // 성공 여부 판정
    const roll = Math.random();
    const success = roll < finalRate;

    if (success) {
      await conn.query(
        'UPDATE inventory SET enhance_level = ? WHERE id = ?',
        [nextLevel, inventoryId]
      );
      await conn.commit();
      res.json({
        success: true,
        enhanced: true,
        message: `${item.name} +${nextLevel} 강화 성공!`,
        newLevel: nextLevel,
        rate: Math.round(finalRate * 100),
      });
    } else {
      // 실패 시: +7 이상이면 강화레벨 1 하락, 아니면 유지
      let newLevel = item.enhance_level;
      let degraded = false;
      if (item.enhance_level >= 7) {
        newLevel = item.enhance_level - 1;
        degraded = true;
        await conn.query(
          'UPDATE inventory SET enhance_level = ? WHERE id = ?',
          [newLevel, inventoryId]
        );
      }
      await conn.commit();
      res.json({
        success: true,
        enhanced: false,
        message: degraded
          ? `${item.name} 강화 실패! +${newLevel}로 하락...`
          : `${item.name} 강화 실패!`,
        newLevel,
        rate: Math.round(finalRate * 100),
        degraded,
      });
    }
  } catch (err) {
    await conn.rollback();
    console.error('Enhance error:', err);
    res.status(500).json({ message: err.message || '강화 실패' });
  } finally {
    conn.release();
  }
});

// 강화 정보 조회 (특정 아이템)
router.get('/enhance-info/:inventoryId', auth, async (req, res) => {
  try {
    const [chars] = await pool.query(
      req.selectedCharId
        ? 'SELECT id FROM characters WHERE id = ? AND user_id = ?'
        : 'SELECT id FROM characters WHERE user_id = ? ORDER BY id LIMIT 1',
      req.selectedCharId ? [req.selectedCharId, req.user.id] : [req.user.id]
    );
    if (chars.length === 0) return res.status(404).json({ message: '캐릭터 없음' });

    const [items] = await pool.query(
      `SELECT inv.*, i.name, i.grade, i.max_enhance,
              i.effect_hp, i.effect_mp, i.effect_attack, i.effect_defense
       FROM inventory inv JOIN items i ON inv.item_id = i.id
       WHERE inv.id = ? AND inv.character_id = ?`,
      [req.params.inventoryId, chars[0].id]
    );
    if (items.length === 0) return res.status(404).json({ message: '아이템 없음' });

    const item = items[0];
    const nextLevel = item.enhance_level + 1;

    if (nextLevel > item.max_enhance) {
      return res.json({ item, maxed: true });
    }

    const [rates] = await pool.query('SELECT * FROM enhance_rates WHERE enhance_level = ?', [nextLevel]);
    const rate = rates[0];

    // 등급별 보너스 스탯 계산
    const gradeMultiplier = { '일반': 1.0, '고급': 1.2, '희귀': 1.5, '영웅': 1.8, '전설': 2.2, '신화': 3.0 };
    const mult = gradeMultiplier[item.grade] || 1.0;
    const bonusPerLevel = rate.stat_bonus_percent * mult;

    // 현재까지 총 강화 보너스
    let totalBonus = 0;
    for (let lv = 1; lv <= item.enhance_level; lv++) {
      const [r] = await pool.query('SELECT stat_bonus_percent FROM enhance_rates WHERE enhance_level = ?', [lv]);
      if (r.length) totalBonus += r[0].stat_bonus_percent * mult;
    }

    const gradeEnhanceMap = {
      '일반': '강화석', '고급': '고급 강화석', '희귀': '희귀 강화석',
      '영웅': '영웅 강화석', '전설': '전설 강화석', '신화': '신화 강화석',
    };

    res.json({
      item,
      nextLevel,
      successRate: rate.success_rate,
      goldCost: rate.gold_cost,
      materialCount: rate.material_count,
      enhanceStoneName: gradeEnhanceMap[item.grade] || '강화석',
      bonusPerLevel: Math.round(bonusPerLevel * 100),
      totalBonus: Math.round(totalBonus * 100),
    });
  } catch (err) {
    console.error('Enhance info error:', err);
    res.status(500).json({ message: '서버 오류' });
  }
});

// 재료 판매
router.post('/sell-material', auth, async (req, res) => {
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    const { materialId, quantity } = req.body;

    const [chars] = await conn.query(
      req.selectedCharId
        ? 'SELECT id FROM characters WHERE id = ? AND user_id = ?'
        : 'SELECT id FROM characters WHERE user_id = ? ORDER BY id LIMIT 1',
      req.selectedCharId ? [req.selectedCharId, req.user.id] : [req.user.id]
    );
    if (chars.length === 0) throw new Error('캐릭터 없음');

    const [mats] = await conn.query(
      'SELECT mi.quantity, m.sell_price, m.name FROM material_inventory mi JOIN materials m ON mi.material_id = m.id WHERE mi.character_id = ? AND mi.material_id = ?',
      [chars[0].id, materialId]
    );
    if (mats.length === 0 || mats[0].quantity < quantity) {
      await conn.rollback();
      return res.status(400).json({ message: '재료가 부족합니다.' });
    }

    const totalGold = mats[0].sell_price * quantity;
    await conn.query(
      'UPDATE material_inventory SET quantity = quantity - ? WHERE character_id = ? AND material_id = ?',
      [quantity, chars[0].id, materialId]
    );
    await conn.query('UPDATE characters SET gold = gold + ? WHERE id = ?', [totalGold, chars[0].id]);

    await conn.commit();
    res.json({ success: true, message: `${mats[0].name} x${quantity} 판매! (+${totalGold}G)`, gold: totalGold });
  } catch (err) {
    await conn.rollback();
    console.error('Sell material error:', err);
    res.status(500).json({ message: '판매 실패' });
  } finally {
    conn.release();
  }
});

module.exports = router;
