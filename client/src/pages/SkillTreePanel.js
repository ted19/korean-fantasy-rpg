import React, { useState, useEffect, useCallback, useRef } from 'react';
import api from '../api';
import './SkillTree.css';

const STAT_LABELS = {
  hp: 'HP', mp: 'MP', attack: 'ATK', defense: 'DEF',
  phys_attack: '물공', phys_defense: '물방', mag_attack: '마공', mag_defense: '마방',
  crit_rate: '치명', evasion: '회피',
};

const SKILL_TYPE_LABELS = {
  attack: '공격', heal: '치유', buff: '버프', debuff: '디버프', aoe: '광역',
};

function SkillTreePanel({ charState, onLog, onSkillsUpdate }) {
  const [treeData, setTreeData] = useState({ nodes: [], edges: [], unlocked: [], skillPoints: 0, totalSkillPoints: 0, level: 1, gold: 0 });
  const [selectedNode, setSelectedNode] = useState(null);
  const [activeBranch, setActiveBranch] = useState(null);
  const [loading, setLoading] = useState(false);
  const [resetConfirm, setResetConfirm] = useState(false);
  const containerRef = useRef(null);
  const detailRef = useRef(null);

  const loadTree = useCallback(async () => {
    try {
      const res = await api.get('/skill/tree');
      setTreeData(res.data);
      // 첫 로드시 첫 번째 브랜치 선택
      if (!activeBranch && res.data.nodes.length > 0) {
        const branches = [...new Set(res.data.nodes.map(n => n.branch))];
        setActiveBranch(branches[0]);
      }
      // 스킬 업데이트 콜백
      if (onSkillsUpdate) {
        try {
          const skillRes = await api.get('/skill/active-skills');
          onSkillsUpdate(skillRes.data.skills);
        } catch {}
      }
    } catch {}
  }, [activeBranch, onSkillsUpdate]);

  useEffect(() => { loadTree(); }, [charState?.level]);

  // 브랜치 목록
  const branches = [];
  const branchMap = {};
  for (const n of treeData.nodes) {
    if (!branchMap[n.branch]) {
      branchMap[n.branch] = { key: n.branch, name: n.branch_name, nodes: [] };
      branches.push(branchMap[n.branch]);
    }
    branchMap[n.branch].nodes.push(n);
  }

  // 현재 브랜치 노드
  const currentBranch = branchMap[activeBranch];
  const branchNodes = currentBranch?.nodes || [];

  // 해금 셋
  const unlockedSet = new Set(treeData.unlocked);

  // 엣지 맵 (child → parents)
  const parentMap = {};
  for (const e of treeData.edges) {
    if (!parentMap[e.child_node_id]) parentMap[e.child_node_id] = [];
    parentMap[e.child_node_id].push(e.parent_node_id);
  }

  // 노드 상태 계산
  const getNodeState = (node) => {
    if (unlockedSet.has(node.id)) return 'unlocked';
    const parents = parentMap[node.id] || [];
    if (parents.length === 0) {
      // 티어1 루트 노드 - 레벨/포인트만 체크
      if (treeData.level >= node.required_level && treeData.skillPoints >= node.point_cost) return 'available';
      if (treeData.level >= node.required_level) return 'available'; // 표시는 하되 포인트 부족
      return 'locked';
    }
    // 부모 중 하나라도 해금되어 있으면
    const hasUnlockedParent = parents.some(pid => unlockedSet.has(pid));
    if (!hasUnlockedParent) return 'locked';
    if (treeData.level >= node.required_level) return 'available';
    return 'locked';
  };

  // 티어별 그룹 (동적으로 감지)
  const tierSet = new Set(branchNodes.map(n => n.tier));
  const tiers = [...tierSet].sort((a, b) => a - b);
  const nodesByTier = {};
  for (const t of tiers) {
    nodesByTier[t] = branchNodes.filter(n => n.tier === t).sort((a, b) => a.pos_x - b.pos_x);
  }

  // SVG 연결선 좌표 계산
  const nodePositions = {};
  const NODE_W = 64;
  const NODE_H = 64;
  const TIER_GAP = 88;
  const NODE_GAP = 80;
  const TOP_PAD = 30;

  for (let ti = 0; ti < tiers.length; ti++) {
    const t = tiers[ti];
    const nodes = nodesByTier[t] || [];
    const totalW = nodes.length * NODE_W + (nodes.length - 1) * (NODE_GAP - NODE_W);
    const startX = (400 - totalW) / 2; // assume ~400px width
    nodes.forEach((n, i) => {
      const x = startX + i * NODE_GAP + NODE_W / 2;
      const y = TOP_PAD + ti * TIER_GAP + NODE_H / 2;
      nodePositions[n.id] = { x, y };
    });
  }

  // 브랜치 관련 엣지만
  const branchNodeIds = new Set(branchNodes.map(n => n.id));
  const branchEdges = treeData.edges.filter(e => branchNodeIds.has(e.parent_node_id) && branchNodeIds.has(e.child_node_id));

  const handleAllocate = async (nodeId) => {
    if (loading) return;
    setLoading(true);
    try {
      const res = await api.post('/skill/allocate', { nodeId });
      if (onLog) onLog(res.data.message, 'level');
      await loadTree();
      setSelectedNode(prev => prev?.id === nodeId ? { ...prev, _justUnlocked: true } : prev);
    } catch (err) {
      if (onLog) onLog(err.response?.data?.message || '스킬 해금 실패', 'damage');
    }
    setLoading(false);
  };

  const handleReset = async () => {
    if (loading) return;
    setLoading(true);
    try {
      const res = await api.post('/skill/reset');
      if (onLog) onLog(res.data.message, 'system');
      setSelectedNode(null);
      setResetConfirm(false);
      await loadTree();
    } catch (err) {
      if (onLog) onLog(err.response?.data?.message || '초기화 실패', 'damage');
    }
    setLoading(false);
  };

  const svgH = TOP_PAD + (tiers.length - 1) * TIER_GAP + NODE_H + 10;

  return (
    <div className="skill-tree-panel">
      {/* Header */}
      <div className="skill-tree-header">
        <div className="skill-tree-points">
          <span>스킬 포인트</span>
          <span className="sp-count">{treeData.skillPoints}</span>
          <span style={{ fontSize: 10, color: 'var(--text-muted)' }}>/ {treeData.totalSkillPoints} 총</span>
        </div>
        <button
          className="skill-tree-reset-btn"
          onClick={() => setResetConfirm(true)}
          disabled={loading || treeData.unlocked.length === 0}
        >
          초기화 ({500 + treeData.unlocked.length * 100}G)
        </button>
      </div>

      {/* Branch Tabs */}
      {branches.length > 0 && (
        <div className="skill-tree-tabs">
          {branches.map(b => (
            <button
              key={b.key}
              className={`skill-tree-tab ${activeBranch === b.key ? 'active' : ''}`}
              onClick={() => { setActiveBranch(b.key); setSelectedNode(null); }}
            >
              {b.name}
            </button>
          ))}
        </div>
      )}

      {/* Tree */}
      {branchNodes.length > 0 ? (
        <div className="skill-tree-container" ref={containerRef}>
          <svg className="skill-tree-svg" viewBox={`0 0 400 ${svgH}`} preserveAspectRatio="xMidYMid meet">
            {branchEdges.map((e, i) => {
              const p1 = nodePositions[e.parent_node_id];
              const p2 = nodePositions[e.child_node_id];
              if (!p1 || !p2) return null;
              const isUnlocked = unlockedSet.has(e.parent_node_id) && unlockedSet.has(e.child_node_id);
              return (
                <line
                  key={i}
                  className={`skill-tree-edge ${isUnlocked ? 'unlocked' : ''}`}
                  x1={p1.x} y1={p1.y + NODE_H / 2 - 4}
                  x2={p2.x} y2={p2.y - NODE_H / 2 + 4}
                />
              );
            })}
          </svg>

          <svg style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', pointerEvents: 'none', zIndex: 0 }} viewBox={`0 0 400 ${svgH}`} preserveAspectRatio="xMidYMid meet">
          </svg>

          <div className="skill-tree-nodes" style={{ minHeight: svgH }}>
            {tiers.map(t => {
              const tierNodes = nodesByTier[t] || [];
              if (tierNodes.length === 0) return null;
              return (
                <div key={t} className="skill-tree-tier" style={{ marginTop: t === 1 ? 0 : undefined }}>
                  {tierNodes.map(n => {
                    const state = getNodeState(n);
                    const isUltimate = n.tier >= 4;
                    const isSelected = selectedNode?.id === n.id;
                    return (
                      <div
                        key={n.id}
                        className={`skill-tree-node ${state} ${isUltimate ? 'ultimate' : ''} ${n.tier >= 5 ? `tier${n.tier}` : ''} ${isSelected ? 'selected' : ''}`}
                        onClick={() => { setSelectedNode(n); setTimeout(() => detailRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' }), 100); }}
                      >
                        <img className="node-icon-img" src={`/skills/${n.id}_icon.png`} alt={n.name} onError={e => { e.target.style.display='none'; e.target.nextSibling.style.display='inline'; }} />
                        <span className="node-icon" style={{ display: 'none' }}>{n.icon}</span>
                        <span className="node-name">{n.name}</span>
                        {state !== 'unlocked' && (
                          <span className="node-cost">{n.point_cost}</span>
                        )}
                        <span className={`node-type-badge ${n.node_type === 'active' ? 'active-badge' : 'passive-badge'}`}>
                          {n.node_type === 'active' ? 'ACT' : 'PAS'}
                        </span>
                      </div>
                    );
                  })}
                </div>
              );
            })}
          </div>
        </div>
      ) : (
        <div className="skill-tree-empty">스킬 트리 데이터를 불러오는 중...</div>
      )}

      {/* Detail Panel */}
      {/* Reset Confirm Popup */}
      {resetConfirm && (
        <div className="skt-reset-overlay" onClick={() => setResetConfirm(false)}>
          <div className="skt-reset-popup" onClick={e => e.stopPropagation()}>
            <div className="skt-reset-icon-wrap">
              <span className="skt-reset-icon">⚠️</span>
            </div>
            <div className="skt-reset-title">스킬 트리 초기화</div>
            <div className="skt-reset-desc">
              모든 해금된 스킬이 초기화되고<br/>
              스킬 포인트가 반환됩니다.
            </div>
            <div className="skt-reset-info">
              <div className="skt-reset-info-row">
                <span>해금된 스킬</span>
                <span className="skt-reset-val">{treeData.unlocked.length}개</span>
              </div>
              <div className="skt-reset-info-row">
                <span>반환 포인트</span>
                <span className="skt-reset-val point">+{treeData.nodes.filter(n => treeData.unlocked.includes(n.id)).reduce((s, n) => s + (n.point_cost || 1), 0)}P</span>
              </div>
              <div className="skt-reset-info-row cost">
                <span>초기화 비용</span>
                <span className="skt-reset-val gold">{500 + treeData.unlocked.length * 100}G</span>
              </div>
            </div>
            <div className="skt-reset-warn">⚡ 이 작업은 되돌릴 수 없습니다!</div>
            <div className="skt-reset-btns">
              <button className="skt-reset-cancel" onClick={() => setResetConfirm(false)}>취소</button>
              <button className="skt-reset-confirm" onClick={handleReset} disabled={loading}>
                {loading ? '처리 중...' : '초기화'}
              </button>
            </div>
          </div>
        </div>
      )}

      {selectedNode && (
        <div className="skill-tree-detail" ref={detailRef}>
          <div className="skill-tree-detail-header">
            <div className="skill-tree-detail-icon">
              <img src={`/skills/${selectedNode.id}_icon.png`} alt={selectedNode.name} style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: 8 }} onError={e => { e.target.style.display='none'; }} />
            </div>
            <div className="skill-tree-detail-info">
              <div className="skill-tree-detail-name">{selectedNode.name}</div>
              <span className={`skill-tree-detail-type ${selectedNode.node_type === 'active' ? 'active-type' : 'passive-type'}`}>
                {selectedNode.node_type === 'active'
                  ? `액티브 · ${SKILL_TYPE_LABELS[selectedNode.skill_type] || selectedNode.skill_type}`
                  : `패시브`
                }
              </span>
            </div>
          </div>
          <div className="skill-tree-detail-desc">{selectedNode.description}</div>
          <div className="skill-tree-detail-stats">
            {selectedNode.node_type === 'active' && (
              <>
                {selectedNode.mp_cost > 0 && <span className="skill-tree-stat-tag mp">MP {selectedNode.mp_cost}</span>}
                {selectedNode.damage_multiplier > 1 && <span className="skill-tree-stat-tag dmg">x{selectedNode.damage_multiplier} {selectedNode.damage_type === 'physical' ? '물리' : '마법'}</span>}
                {selectedNode.heal_amount > 0 && <span className="skill-tree-stat-tag heal">HP+{selectedNode.heal_amount}</span>}
                {selectedNode.buff_stat && <span className="skill-tree-stat-tag buff">{STAT_LABELS[selectedNode.buff_stat] || selectedNode.buff_stat}{selectedNode.buff_value > 0 ? '+' : ''}{selectedNode.buff_value} ({selectedNode.buff_duration}턴)</span>}
                {selectedNode.cooldown > 0 && <span className="skill-tree-stat-tag cd">CD:{selectedNode.cooldown}</span>}
                {selectedNode.skill_range > 1 && <span className="skill-tree-stat-tag range">범위:{selectedNode.skill_range}</span>}
              </>
            )}
            {selectedNode.node_type === 'passive' && selectedNode.passive_stat && (
              <span className="skill-tree-stat-tag passive">
                {STAT_LABELS[selectedNode.passive_stat] || selectedNode.passive_stat}
                +{selectedNode.passive_value}{selectedNode.passive_is_percent ? '%' : ''}
              </span>
            )}
            <span className="skill-tree-stat-tag cd">Lv.{selectedNode.required_level} · {selectedNode.point_cost}포인트</span>
          </div>

          {(() => {
            const state = getNodeState(selectedNode);
            if (state === 'unlocked') {
              return <button className="skill-tree-alloc-btn already-unlocked" disabled>해금 완료</button>;
            }
            const canAllocate = state === 'available' && treeData.skillPoints >= selectedNode.point_cost;
            return (
              <button
                className="skill-tree-alloc-btn"
                disabled={!canAllocate || loading}
                onClick={() => handleAllocate(selectedNode.id)}
              >
                {loading ? '처리 중...'
                  : state === 'locked' ? (treeData.level < selectedNode.required_level ? `Lv.${selectedNode.required_level} 필요` : '선행 스킬 필요')
                  : treeData.skillPoints < selectedNode.point_cost ? `포인트 부족 (${selectedNode.point_cost}필요)`
                  : `해금 (${selectedNode.point_cost} 포인트)`
                }
              </button>
            );
          })()}
        </div>
      )}
    </div>
  );
}

export default SkillTreePanel;
