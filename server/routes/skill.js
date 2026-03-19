const express = require('express');
const jwt = require('jsonwebtoken');
const { pool, getSelectedChar } = require('../db');

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

// GET /skill/encyclopedia - 스킬 도감 (전체 스킬 노드)
router.get('/encyclopedia', auth, async (req, res) => {
  try {
    const { class_type, branch, node_type, search } = req.query;
    let sql = 'SELECT * FROM skill_tree_nodes WHERE 1=1';
    const params = [];
    if (class_type) { sql += ' AND class_type = ?'; params.push(class_type); }
    if (branch) { sql += ' AND branch = ?'; params.push(branch); }
    if (node_type) { sql += ' AND node_type = ?'; params.push(node_type); }
    if (search) { sql += ' AND name LIKE ?'; params.push(`%${search}%`); }
    sql += ' ORDER BY class_type, branch, tier ASC, pos_x';
    const [nodes] = await pool.query(sql, params);
    res.json({ skills: nodes });
  } catch (err) {
    console.error('Skill encyclopedia error:', err);
    res.status(500).json({ message: '서버 오류' });
  }
});

// GET /skill/merc-encyclopedia - 용병 스킬 도감
router.get('/merc-encyclopedia', auth, async (req, res) => {
  try {
    const { class_type, grade, search } = req.query;
    let sql = 'SELECT * FROM mercenary_skills WHERE 1=1';
    const params = [];
    if (class_type && class_type !== 'all') {
      if (class_type === '공용') {
        sql += ' AND is_common = 1';
      } else {
        sql += ' AND (class_type = ? OR is_common = 1 OR class_type IS NULL)';
        params.push(class_type);
      }
    }
    if (grade && grade !== 'all') {
      const GRADE_ORDER = ['일반','고급','희귀','영웅','전설','신화','초월'];
      const idx = GRADE_ORDER.indexOf(grade);
      const eligible = GRADE_ORDER.slice(0, idx + 1);
      sql += ' AND (min_grade IS NULL OR min_grade IN (?))';
      params.push(eligible);
    }
    if (search) { sql += ' AND name LIKE ?'; params.push(`%${search}%`); }
    sql += ' ORDER BY COALESCE(class_type, "공용"), required_level, id';
    const [skills] = await pool.query(sql, params);
    // 공용 스킬에 class_type 표시 + 등급 표시
    for (const s of skills) {
      if (!s.class_type || s.is_common) s.class_type_display = '공용';
      else s.class_type_display = s.class_type;
      s.grade_display = s.min_grade || '전체';
    }
    res.json({ skills });
  } catch (err) {
    console.error('Merc skill encyclopedia error:', err);
    res.status(500).json({ message: '서버 오류' });
  }
});

// GET /skill/summon-encyclopedia - 소환수 스킬 도감
router.get('/summon-encyclopedia', auth, async (req, res) => {
  try {
    const { summon_type, search } = req.query;
    let sql = `SELECT ss.*, st.name as template_name, st.type as template_type, st.icon as template_icon
               FROM summon_skills ss
               LEFT JOIN summon_templates st ON ss.template_id = st.id
               WHERE 1=1`;
    const params = [];
    if (summon_type && summon_type !== 'all') {
      if (summon_type === '공용') {
        sql += ' AND ss.is_common = 1';
      } else {
        sql += ' AND ss.summon_type = ?';
        params.push(summon_type);
      }
    }
    if (search) { sql += ' AND ss.name LIKE ?'; params.push(`%${search}%`); }
    sql += ' ORDER BY COALESCE(ss.summon_type, "공용"), ss.required_level, ss.id';
    const [skills] = await pool.query(sql, params);
    for (const s of skills) {
      if (!s.summon_type || s.is_common) s.type_display = '공용';
      else s.type_display = s.summon_type;
    }
    res.json({ skills });
  } catch (err) {
    console.error('Summon skill encyclopedia error:', err);
    res.status(500).json({ message: '서버 오류' });
  }
});

// GET /skill/tree - 스킬 트리 전체 + 해금 현황
router.get('/tree', auth, async (req, res) => {
  try {
    const char = await getSelectedChar(req);
    if (!char) return res.json({ nodes: [], edges: [], unlocked: [], skillPoints: 0 });

    const [nodes] = await pool.query(
      'SELECT * FROM skill_tree_nodes WHERE class_type = ? ORDER BY branch, tier, pos_x',
      [char.class_type]
    );

    const nodeIds = nodes.map(n => n.id);
    let edges = [];
    if (nodeIds.length > 0) {
      [edges] = await pool.query(
        `SELECT * FROM skill_tree_edges WHERE parent_node_id IN (?) OR child_node_id IN (?)`,
        [nodeIds, nodeIds]
      );
    }

    const [unlocked] = await pool.query(
      'SELECT node_id FROM character_skill_nodes WHERE character_id = ?',
      [char.id]
    );

    res.json({
      nodes,
      edges,
      unlocked: unlocked.map(u => u.node_id),
      skillPoints: char.skill_points || 0,
      totalSkillPoints: char.total_skill_points || 0,
      level: char.level,
      gold: char.gold || 0,
    });
  } catch (err) {
    console.error('Skill tree error:', err);
    res.status(500).json({ message: '서버 오류가 발생했습니다.' });
  }
});

// POST /skill/allocate - 스킬 포인트 투자
router.post('/allocate', auth, async (req, res) => {
  const conn = await pool.getConnection();
  try {
    const { nodeId } = req.body;
    if (!nodeId) return res.status(400).json({ message: '노드 ID가 필요합니다.' });

    const [chars] = await conn.query(
      req.selectedCharId
        ? 'SELECT * FROM characters WHERE id = ? AND user_id = ? FOR UPDATE'
        : 'SELECT * FROM characters WHERE user_id = ? ORDER BY id LIMIT 1 FOR UPDATE',
      req.selectedCharId ? [req.selectedCharId, req.user.id] : [req.user.id]
    );
    if (chars.length === 0) return res.status(404).json({ message: '캐릭터가 없습니다.' });
    const char = chars[0];

    // 노드 조회
    const [nodes] = await conn.query('SELECT * FROM skill_tree_nodes WHERE id = ?', [nodeId]);
    if (nodes.length === 0) return res.status(404).json({ message: '스킬 노드를 찾을 수 없습니다.' });
    const node = nodes[0];

    // 클래스 체크
    if (node.class_type !== char.class_type) {
      return res.status(400).json({ message: '다른 직업의 스킬은 습득할 수 없습니다.' });
    }

    // 레벨 체크
    if (char.level < node.required_level) {
      return res.status(400).json({ message: `레벨 ${node.required_level} 이상이 필요합니다.` });
    }

    // 포인트 체크
    if ((char.skill_points || 0) < node.point_cost) {
      return res.status(400).json({ message: `스킬 포인트가 부족합니다. (필요: ${node.point_cost})` });
    }

    // 이미 해금 체크
    const [existing] = await conn.query(
      'SELECT id FROM character_skill_nodes WHERE character_id = ? AND node_id = ?',
      [char.id, nodeId]
    );
    if (existing.length > 0) {
      return res.status(409).json({ message: '이미 해금한 스킬 노드입니다.' });
    }

    // 선행 조건 체크: 부모 노드가 있으면 최소 1개는 해금해야 함
    const [parentEdges] = await conn.query(
      'SELECT parent_node_id FROM skill_tree_edges WHERE child_node_id = ?',
      [nodeId]
    );
    if (parentEdges.length > 0) {
      const parentIds = parentEdges.map(e => e.parent_node_id);
      const [unlockedParents] = await conn.query(
        'SELECT node_id FROM character_skill_nodes WHERE character_id = ? AND node_id IN (?)',
        [char.id, parentIds]
      );
      if (unlockedParents.length === 0) {
        return res.status(400).json({ message: '선행 스킬을 먼저 해금해야 합니다.' });
      }
    }

    // 해금 처리
    await conn.beginTransaction();
    await conn.query(
      'INSERT INTO character_skill_nodes (character_id, node_id) VALUES (?, ?)',
      [char.id, nodeId]
    );
    await conn.query(
      'UPDATE characters SET skill_points = skill_points - ? WHERE id = ?',
      [node.point_cost, char.id]
    );
    await conn.commit();

    res.json({ message: `[${node.name}] 스킬을 해금했습니다!`, remainingPoints: (char.skill_points || 0) - node.point_cost });
  } catch (err) {
    await conn.rollback().catch(() => {});
    console.error('Skill allocate error:', err);
    res.status(500).json({ message: '서버 오류가 발생했습니다.' });
  } finally {
    conn.release();
  }
});

// POST /skill/reset - 스킬 초기화
router.post('/reset', auth, async (req, res) => {
  const conn = await pool.getConnection();
  try {
    const [chars] = await conn.query(
      req.selectedCharId
        ? 'SELECT * FROM characters WHERE id = ? AND user_id = ? FOR UPDATE'
        : 'SELECT * FROM characters WHERE user_id = ? ORDER BY id LIMIT 1 FOR UPDATE',
      req.selectedCharId ? [req.selectedCharId, req.user.id] : [req.user.id]
    );
    if (chars.length === 0) return res.status(404).json({ message: '캐릭터가 없습니다.' });
    const char = chars[0];

    // 해금 노드 수 계산
    const [unlockedNodes] = await conn.query(
      'SELECT COUNT(*) as cnt FROM character_skill_nodes WHERE character_id = ?',
      [char.id]
    );
    const nodeCount = unlockedNodes[0].cnt;
    if (nodeCount === 0) {
      return res.status(400).json({ message: '초기화할 스킬이 없습니다.' });
    }

    const cost = 500 + nodeCount * 100;
    if ((char.gold || 0) < cost) {
      return res.status(400).json({ message: `골드가 부족합니다. (필요: ${cost}G)` });
    }

    await conn.beginTransaction();
    await conn.query('DELETE FROM character_skill_nodes WHERE character_id = ?', [char.id]);
    await conn.query(
      'UPDATE characters SET skill_points = total_skill_points, gold = gold - ? WHERE id = ?',
      [cost, char.id]
    );
    await conn.commit();

    res.json({
      message: `스킬 트리가 초기화되었습니다. (${cost}G 사용)`,
      skillPoints: char.total_skill_points || 0,
      gold: (char.gold || 0) - cost,
    });
  } catch (err) {
    await conn.rollback().catch(() => {});
    console.error('Skill reset error:', err);
    res.status(500).json({ message: '서버 오류가 발생했습니다.' });
  } finally {
    conn.release();
  }
});

// GET /skill/active-skills - 전투용 액티브 스킬 + 패시브 보너스
router.get('/active-skills', auth, async (req, res) => {
  try {
    const char = await getSelectedChar(req);
    if (!char) return res.json({ skills: [], passiveBonuses: {} });

    // 해금한 노드 조회
    const [unlocked] = await pool.query(
      `SELECT stn.*, csn.auto_priority FROM character_skill_nodes csn
       JOIN skill_tree_nodes stn ON csn.node_id = stn.id
       WHERE csn.character_id = ?`,
      [char.id]
    );

    // 액티브 스킬 목록 (전투에서 사용)
    const activeSkills = unlocked
      .filter(n => n.node_type === 'active')
      .map(n => ({
        id: n.id,
        name: n.name,
        description: n.description,
        icon: n.icon,
        type: n.skill_type || 'attack',
        mp_cost: n.mp_cost,
        damage_multiplier: n.damage_multiplier,
        damage_type: n.damage_type,
        heal_amount: n.heal_amount,
        buff_stat: n.buff_stat,
        buff_value: n.buff_value,
        buff_duration: n.buff_duration,
        cooldown: n.cooldown,
        skill_range: n.skill_range,
        node_key: n.node_key,
        auto_priority: n.auto_priority ?? 100,
      }));

    // 패시브 보너스 합산
    const passiveBonuses = {};
    for (const n of unlocked) {
      if (n.node_type === 'passive' && n.passive_stat) {
        const key = n.passive_stat;
        if (!passiveBonuses[key]) passiveBonuses[key] = { flat: 0, percent: 0 };
        if (n.passive_is_percent) {
          passiveBonuses[key].percent += n.passive_value;
        } else {
          passiveBonuses[key].flat += n.passive_value;
        }
      }
    }

    res.json({ skills: activeSkills, passiveBonuses });
  } catch (err) {
    console.error('Active skills error:', err);
    res.status(500).json({ message: '서버 오류가 발생했습니다.' });
  }
});

// PUT /skill/auto-priority - 스킬 자동전투 우선도 설정
router.put('/auto-priority', auth, async (req, res) => {
  try {
    const char = await getSelectedChar(req);
    if (!char) return res.status(400).json({ message: '캐릭터를 선택해주세요.' });
    const { node_id, priority } = req.body;
    if (!node_id || priority === undefined) return res.status(400).json({ message: '잘못된 요청입니다.' });
    const p = Math.max(0, Math.min(200, Math.round(Number(priority))));
    await pool.query(
      'UPDATE character_skill_nodes SET auto_priority = ? WHERE character_id = ? AND node_id = ?',
      [p, char.id, node_id]
    );
    res.json({ success: true, auto_priority: p });
  } catch (err) {
    console.error('Auto priority error:', err);
    res.status(500).json({ message: '서버 오류가 발생했습니다.' });
  }
});

// PUT /skill/auto-priority-batch - 일괄 우선도 설정
router.put('/auto-priority-batch', auth, async (req, res) => {
  try {
    const char = await getSelectedChar(req);
    if (!char) return res.status(400).json({ message: '캐릭터를 선택해주세요.' });
    const { priorities } = req.body; // [{node_id, priority}]
    if (!Array.isArray(priorities)) return res.status(400).json({ message: '잘못된 요청입니다.' });
    for (const { node_id, priority } of priorities) {
      const p = Math.max(0, Math.min(200, Math.round(Number(priority))));
      await pool.query(
        'UPDATE character_skill_nodes SET auto_priority = ? WHERE character_id = ? AND node_id = ?',
        [p, char.id, node_id]
      );
    }
    res.json({ success: true });
  } catch (err) {
    console.error('Auto priority batch error:', err);
    res.status(500).json({ message: '서버 오류가 발생했습니다.' });
  }
});

// 기존 호환: GET /skill/list (레거시 지원 - 스킬 트리 기반으로 반환)
router.get('/list', auth, async (req, res) => {
  try {
    const char = await getSelectedChar(req);
    if (!char) return res.json({ skills: [] });

    const [unlocked] = await pool.query(
      `SELECT stn.* FROM character_skill_nodes csn
       JOIN skill_tree_nodes stn ON csn.node_id = stn.id
       WHERE csn.character_id = ? AND stn.node_type = 'active'`,
      [char.id]
    );

    const skills = unlocked.map(n => ({
      id: n.id,
      name: n.name,
      description: n.description,
      type: n.skill_type || 'attack',
      mp_cost: n.mp_cost,
      damage_multiplier: n.damage_multiplier,
      heal_amount: n.heal_amount,
      buff_stat: n.buff_stat,
      buff_value: n.buff_value,
      buff_duration: n.buff_duration,
      cooldown: n.cooldown,
      class_type: n.class_type,
      required_level: n.required_level,
      learned: true,
    }));

    res.json({ skills });
  } catch (err) {
    console.error('Skill list error:', err);
    res.status(500).json({ message: '서버 오류가 발생했습니다.' });
  }
});

module.exports = router;
