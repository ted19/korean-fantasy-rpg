import React, { useState, useEffect, useCallback } from 'react';
import api from '../api';
import './BlacksmithArea.css';

const GRADE_COLORS = {
  '일반': '#aaa', '고급': '#4ade80', '희귀': '#60a5fa',
  '영웅': '#c084fc', '전설': '#fbbf24', '신화': '#ff6b6b',
};
const GRADE_ORDER = ['일반', '고급', '희귀', '영웅', '전설', '신화'];
const TYPE_NAMES = {
  weapon: '무기', chest: '갑옷', helmet: '투구', boots: '장화',
  shield: '방패', ring: '반지', necklace: '목걸이',
};

function NpcImg({ src, className }) {
  const [err, setErr] = useState(false);
  if (err) return null;
  return <img src={src} alt="" className={className} onError={() => setErr(true)} />;
}

function ItemStatTags({ item }) {
  const stats = [];
  if (item.effect_hp > 0) stats.push({ label: 'HP', val: `+${item.effect_hp}`, cls: 'hp' });
  if (item.effect_mp > 0) stats.push({ label: 'MP', val: `+${item.effect_mp}`, cls: 'mp' });
  if (item.effect_attack > 0) stats.push({ label: '공격', val: `+${item.effect_attack}`, cls: 'atk' });
  if (item.effect_defense > 0) stats.push({ label: '방어', val: `+${item.effect_defense}`, cls: 'def' });
  if (item.effect_phys_attack > 0) stats.push({ label: '물공', val: `+${item.effect_phys_attack}`, cls: 'patk' });
  if (item.effect_phys_defense > 0) stats.push({ label: '물방', val: `+${item.effect_phys_defense}`, cls: 'pdef' });
  if (item.effect_mag_attack > 0) stats.push({ label: '마공', val: `+${item.effect_mag_attack}`, cls: 'matk' });
  if (item.effect_mag_defense > 0) stats.push({ label: '마방', val: `+${item.effect_mag_defense}`, cls: 'mdef' });
  if (item.effect_crit_rate > 0) stats.push({ label: '치명', val: `+${item.effect_crit_rate}%`, cls: 'crit' });
  if (item.effect_evasion > 0) stats.push({ label: '회피', val: `+${item.effect_evasion}%`, cls: 'eva' });
  if (stats.length === 0) return null;
  return (
    <div className="bs-item-stats">
      {stats.map((s, i) => (
        <span key={i} className={`bs-stat-tag ${s.cls}`}>{s.label} {s.val}</span>
      ))}
    </div>
  );
}

function BlacksmithArea({ charState, onCharStateUpdate, onLog }) {
  const [tab, setTab] = useState('craft');
  const [recipes, setRecipes] = useState([]);
  const [materials, setMaterials] = useState([]);
  const [enhanceItems, setEnhanceItems] = useState([]);
  const [enhanceRates, setEnhanceRates] = useState([]);
  const [selectedRecipe, setSelectedRecipe] = useState(null);
  const [selectedEnhance, setSelectedEnhance] = useState(null);
  const [enhanceResult, setEnhanceResult] = useState(null);
  const [craftFilter, setCraftFilter] = useState('all');
  const [loading, setLoading] = useState(false);
  const [npcMsg, setNpcMsg] = useState('이 대장간에서 못 만드는 건 없지!');
  const [sellPopup, setSellPopup] = useState(null);
  const [sellQty, setSellQty] = useState(1);
  const [confirmPopup, setConfirmPopup] = useState(null); // { type: 'craft'|'enhance', data }

  const NPC_MSGS = {
    craft: [
      '이 대장간에서 못 만드는 건 없지!',
      '좋은 재료를 가져왔나? 명품을 만들어주마.',
      '뭘 만들어볼까? 한번 골라보게.',
    ],
    enhance: [
      '강화는 운도 실력이야. 준비됐나?',
      '불꽃이 뜨거울수록 좋은 결과가 나오는 법이지.',
      '자, 어떤 장비를 더 강하게 만들어볼까?',
    ],
    materials: [
      '재료가 많으면 좋은 장비를 만들 수 있지.',
      '쓸모없는 재료는 팔아도 좋아.',
      '몬스터를 더 잡으면 좋은 재료를 얻을 수 있을 거야.',
    ],
  };

  const loadData = useCallback(async () => {
    try {
      const [recipesRes, matsRes, enhRes] = await Promise.all([
        api.get('/blacksmith/recipes'),
        api.get('/blacksmith/materials'),
        api.get('/blacksmith/enhance-list'),
      ]);
      setRecipes(recipesRes.data.recipes || []);
      setMaterials(matsRes.data.materials || []);
      setEnhanceItems(enhRes.data.items || []);
      setEnhanceRates(enhRes.data.rates || []);
    } catch (err) {
      console.error('Blacksmith load error:', err);
    }
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  useEffect(() => {
    const msgs = NPC_MSGS[tab] || NPC_MSGS.craft;
    setNpcMsg(msgs[Math.floor(Math.random() * msgs.length)]);
  }, [tab]); // eslint-disable-line

  const handleCraft = async (recipeId) => {
    setLoading(true);
    try {
      const res = await api.post('/blacksmith/craft', { recipeId });
      onLog(`${res.data.message}`, 'system');
      setNpcMsg('하하! 명작이 탄생했군!');
      setSelectedRecipe(null);
      await loadData();
      const charRes = await api.get('/characters/me');
      if (charRes.data.character) onCharStateUpdate({ gold: charRes.data.character.gold });
    } catch (err) {
      onLog(`${err.response?.data?.message || '제작 실패'}`, 'damage');
      setNpcMsg('으음... 재료가 부족한 것 같군.');
    }
    setLoading(false);
  };

  const handleEnhance = async (inventoryId) => {
    setLoading(true);
    setEnhanceResult(null);
    try {
      const res = await api.post('/blacksmith/enhance', { inventoryId });
      setEnhanceResult(res.data);
      if (res.data.enhanced) {
        onLog(`${res.data.message}`, 'level');
        setNpcMsg('성공이다! 장비가 더 강해졌어!');
      } else {
        onLog(`${res.data.message}`, 'damage');
        setNpcMsg('이런... 다음엔 반드시 성공할 거야.');
      }
      await loadData();
      const charRes = await api.get('/characters/me');
      if (charRes.data.character) onCharStateUpdate({ gold: charRes.data.character.gold });
    } catch (err) {
      onLog(`${err.response?.data?.message || '강화 실패'}`, 'damage');
    }
    setLoading(false);
  };

  const handleSellMaterial = async (materialId, qty) => {
    try {
      const res = await api.post('/blacksmith/sell-material', { materialId, quantity: qty });
      onLog(`${res.data.message}`, 'gold');
      await loadData();
      const charRes = await api.get('/characters/me');
      if (charRes.data.character) onCharStateUpdate({ gold: charRes.data.character.gold });
    } catch (err) {
      onLog(`${err.response?.data?.message || '판매 실패'}`, 'damage');
    }
  };

  const canCraft = (recipe) => {
    if (!charState || charState.level < recipe.required_level) return false;
    if (!charState || (charState.gold || 0) < recipe.gold_cost) return false;
    return recipe.materials.every(m => m.owned_qty >= m.required_qty);
  };

  const getEnhanceRate = (enhLevel) => enhanceRates.find(r => r.enhance_level === enhLevel + 1) || null;

  const getEnhanceStoneName = (grade) => {
    const map = { '일반': '강화석', '고급': '고급 강화석', '희귀': '희귀 강화석', '영웅': '영웅 강화석', '전설': '전설 강화석', '신화': '신화 강화석' };
    return map[grade] || '강화석';
  };

  const getOwnedStones = (grade) => {
    const mat = materials.find(m => m.name === getEnhanceStoneName(grade));
    return mat ? mat.quantity : 0;
  };

  const filteredRecipes = recipes.filter(r => craftFilter === 'all' || r.type === craftFilter);
  const uniqueTypes = [...new Set(recipes.map(r => r.type))];

  return (
    <div className="facility-page blacksmith-page">
      {/* Banner */}
      <div className="facility-banner bs-banner">
        <NpcImg src="/village/blacksmith_banner.png" className="facility-banner-img" />
        <div className="facility-banner-overlay" />
        <div className="facility-banner-title">대장간</div>
      </div>

      {/* NPC Section */}
      <div className="facility-npc">
        <div className="facility-npc-portrait-wrap">
          <NpcImg src="/village/blacksmith_portrait.png" className="facility-npc-portrait" />
        </div>
        <div className="facility-npc-speech">
          <div className="facility-npc-name">대장장이 <span className="npc-name-sub">김 철수</span></div>
          <div className="facility-npc-msg">{npcMsg}</div>
        </div>
        <div className="facility-gold">
          <span>{(charState?.gold ?? 0).toLocaleString()}G</span>
        </div>
      </div>

      {/* Tabs */}
      <div className="facility-tabs">
        <button className={`facility-tab ${tab === 'craft' ? 'active' : ''}`} onClick={() => { setTab('craft'); setSelectedRecipe(null); }}>
          제조
        </button>
        <button className={`facility-tab ${tab === 'enhance' ? 'active' : ''}`} onClick={() => { setTab('enhance'); setSelectedEnhance(null); setEnhanceResult(null); }}>
          강화
        </button>
        <button className={`facility-tab ${tab === 'materials' ? 'active' : ''}`} onClick={() => setTab('materials')}>
          재료
        </button>
      </div>

      {/* ===== Craft Tab (Left-Right split) ===== */}
      {tab === 'craft' && (
        <div className="bs-split-layout">
          {/* Left: Craft area */}
          <div className="bs-split-left">
            <div className="bs-section-title">제조 작업대</div>
            {!selectedRecipe ? (
              <div className="bs-empty-work">
                <div className="bs-empty-icon">🔨</div>
                <div className="bs-empty-text">오른쪽 목록에서 제조할<br/>아이템을 선택하세요</div>
              </div>
            ) : (
              <div className="bs-work-area">
                <div className="bs-work-item-preview">
                  <div className="bs-work-icon-wrap">
                    <img src={`/equipment/${selectedRecipe.item_id}_icon.png`} alt="" className="bs-work-icon-img" onError={(e) => { e.target.style.display = 'none'; }} />
                  </div>
                  <div className="bs-work-item-info">
                    <div className="bs-work-item-name" style={{ color: GRADE_COLORS[selectedRecipe.grade] }}>
                      {selectedRecipe.name}
                    </div>
                    <span className="bs-work-grade-tag" style={{ borderColor: GRADE_COLORS[selectedRecipe.grade], color: GRADE_COLORS[selectedRecipe.grade] }}>
                      {selectedRecipe.grade}
                    </span>
                    <div className="bs-work-item-type">
                      {TYPE_NAMES[selectedRecipe.type] || selectedRecipe.type}
                      {selectedRecipe.class_restriction && <span> · {selectedRecipe.class_restriction}</span>}
                    </div>
                  </div>
                </div>
                <div className="bs-work-item-desc">{selectedRecipe.description}</div>
                <ItemStatTags item={selectedRecipe} />
                {selectedRecipe.max_enhance > 0 && (
                  <div className="bs-work-enhance-info">최대 강화 +{selectedRecipe.max_enhance}</div>
                )}
                <div className="bs-work-divider" />
                <div className="bs-detail-mats">
                  <div className="bs-detail-mats-title">필요 재료</div>
                  {selectedRecipe.materials.map((mat, i) => (
                    <div key={i} className={`bs-mat-row ${mat.owned_qty >= mat.required_qty ? 'ok' : 'missing'}`}>
                      <span className="bs-mat-icon"><img src={`/materials/${mat.material_id}_icon.png`} alt="" style={{ width: 20, height: 20, objectFit: 'cover', borderRadius: 3 }} onError={e => { e.target.style.display='none'; e.target.parentElement.insertAdjacentText('beforeend', mat.icon); }} /></span>
                      <span className="bs-mat-name" style={{ color: GRADE_COLORS[mat.grade] }}>{mat.name}</span>
                      <span className="bs-mat-qty">{mat.owned_qty}/{mat.required_qty}</span>
                    </div>
                  ))}
                  <div className={`bs-mat-row ${(charState?.gold || 0) >= selectedRecipe.gold_cost ? 'ok' : 'missing'}`}>
                    <span className="bs-mat-icon">💰</span>
                    <span className="bs-mat-name">골드</span>
                    <span className="bs-mat-qty">{(charState?.gold || 0).toLocaleString()}/{selectedRecipe.gold_cost.toLocaleString()}</span>
                  </div>
                </div>
                <button className="bs-craft-btn" disabled={!canCraft(selectedRecipe) || loading} onClick={() => setConfirmPopup({ type: 'craft', data: selectedRecipe })}>
                  {loading ? '제작 중...' : '제작하기'}
                </button>
              </div>
            )}
          </div>

          {/* Right: Recipe item list */}
          <div className="bs-split-right">
            <div className="bs-section-title">레시피 목록</div>
            <div className="facility-filters">
              <button className={`facility-filter-btn ${craftFilter === 'all' ? 'active' : ''}`} onClick={() => setCraftFilter('all')}>전체</button>
              {uniqueTypes.map(t => (
                <button key={t} className={`facility-filter-btn ${craftFilter === t ? 'active' : ''}`} onClick={() => setCraftFilter(t)}>
                  {TYPE_NAMES[t] || t}
                </button>
              ))}
            </div>
            <div className="bs-item-list">
              {filteredRecipes.map(recipe => {
                const craftable = canCraft(recipe);
                const isSelected = selectedRecipe?.recipe_id === recipe.recipe_id;
                return (
                  <div
                    key={recipe.recipe_id}
                    className={`bs-item-card ${isSelected ? 'selected' : ''} ${!craftable ? 'disabled' : ''}`}
                    onClick={() => setSelectedRecipe(recipe)}
                  >
                    <div className="bs-item-card-icon">
                      <img src={`/equipment/${recipe.item_id}_icon.png`} alt={recipe.name} className="bs-item-card-img" onError={(e) => { e.target.style.display = 'none'; }} />
                    </div>
                    <div className="bs-item-card-body">
                      <div className="bs-item-card-header">
                        <span className="bs-item-card-name" style={{ color: GRADE_COLORS[recipe.grade] }}>{recipe.name}</span>
                        <span className="bs-item-card-cost">{recipe.gold_cost.toLocaleString()}G</span>
                      </div>
                      <div className="bs-item-card-meta">
                        <span className="bs-item-card-type">{TYPE_NAMES[recipe.type] || recipe.type}</span>
                        <span className="bs-item-card-grade" style={{ color: GRADE_COLORS[recipe.grade] }}>[{recipe.grade}]</span>
                        {recipe.class_restriction && <span className="bs-item-card-class">{recipe.class_restriction}</span>}
                      </div>
                      <ItemStatTags item={recipe} />
                    </div>
                  </div>
                );
              })}
              {filteredRecipes.length === 0 && <div className="facility-empty">해당 카테고리의 레시피가 없습니다.</div>}
            </div>
          </div>
        </div>
      )}

      {/* ===== Enhance Tab (Left-Right split) ===== */}
      {tab === 'enhance' && (
        <div className="bs-split-layout">
          {/* Left: Enhance area */}
          <div className="bs-split-left">
            <div className="bs-section-title">강화 작업대</div>
            {!selectedEnhance ? (
              <div className="bs-empty-work">
                <div className="bs-empty-icon">🔥</div>
                <div className="bs-empty-text">오른쪽 목록에서 강화할<br/>장비를 선택하세요</div>
              </div>
            ) : (
              <div className="bs-work-area">
                <div className="bs-work-item-preview">
                  <div className="bs-work-icon-wrap enhance">
                    <img src={`/equipment/${selectedEnhance.item_id}_icon.png`} alt="" className="bs-work-icon-img" onError={(e) => { e.target.style.display = 'none'; }} />
                    {selectedEnhance.enhance_level > 0 && (
                      <span className="bs-work-enhance-badge">+{selectedEnhance.enhance_level}</span>
                    )}
                  </div>
                  <div className="bs-work-item-info">
                    <div className="bs-work-item-name" style={{ color: GRADE_COLORS[selectedEnhance.grade] }}>
                      {selectedEnhance.name} {selectedEnhance.enhance_level > 0 ? `+${selectedEnhance.enhance_level}` : ''}
                    </div>
                    <span className="bs-work-grade-tag" style={{ borderColor: GRADE_COLORS[selectedEnhance.grade], color: GRADE_COLORS[selectedEnhance.grade] }}>
                      {selectedEnhance.grade}
                    </span>
                    <div className="bs-work-item-type">
                      {TYPE_NAMES[selectedEnhance.type] || selectedEnhance.type}
                      {selectedEnhance.equipped ? <span className="bs-equipped-inline"> · 장착중</span> : null}
                    </div>
                  </div>
                </div>
                <ItemStatTags item={selectedEnhance} />
                <div className="bs-enhance-progress-section">
                  <div className="bs-enhance-progress-label">강화 단계</div>
                  <div className="bs-enhance-progress-bar">
                    <div className="bs-enhance-progress-fill" style={{ width: `${(selectedEnhance.enhance_level / selectedEnhance.max_enhance) * 100}%` }} />
                  </div>
                  <div className="bs-enhance-progress-text">{selectedEnhance.enhance_level} / {selectedEnhance.max_enhance}</div>
                </div>
                <div className="bs-work-divider" />
                {selectedEnhance.enhance_level >= selectedEnhance.max_enhance ? (
                  <div className="bs-enhance-maxed">최대 강화 단계입니다!</div>
                ) : (() => {
                  const rate = getEnhanceRate(selectedEnhance.enhance_level);
                  const stoneName = getEnhanceStoneName(selectedEnhance.grade);
                  const ownedStones = getOwnedStones(selectedEnhance.grade);
                  if (!rate) return null;
                  return (
                    <>
                      <div className="bs-enhance-stats">
                        <div className="bs-enhance-stat-row">
                          <span>강화</span>
                          <span>+{selectedEnhance.enhance_level} → <strong>+{selectedEnhance.enhance_level + 1}</strong></span>
                        </div>
                        <div className="bs-enhance-stat-row">
                          <span>성공 확률</span>
                          <span className={rate.success_rate >= 0.5 ? 'rate-high' : rate.success_rate >= 0.2 ? 'rate-mid' : 'rate-low'}>
                            {Math.round(rate.success_rate * 100)}%
                          </span>
                        </div>
                        <div className={`bs-enhance-stat-row ${(charState?.gold || 0) >= rate.gold_cost ? '' : 'missing'}`}>
                          <span>필요 골드</span>
                          <span>{rate.gold_cost.toLocaleString()}G</span>
                        </div>
                        <div className={`bs-enhance-stat-row ${ownedStones >= rate.material_count ? '' : 'missing'}`}>
                          <span>필요 {stoneName}</span>
                          <span>{ownedStones}/{rate.material_count}</span>
                        </div>
                        {selectedEnhance.enhance_level >= 7 && (
                          <div className="bs-enhance-warning">+7 이상에서 실패 시 강화 단계가 1 하락합니다!</div>
                        )}
                      </div>
                      {enhanceResult && (
                        <div className={`bs-enhance-result ${enhanceResult.enhanced ? 'success' : 'fail'}`}>
                          {enhanceResult.message}
                        </div>
                      )}
                      <button
                        className="bs-enhance-btn"
                        disabled={loading || (charState?.gold || 0) < rate.gold_cost || ownedStones < rate.material_count}
                        onClick={() => setConfirmPopup({ type: 'enhance', data: selectedEnhance, rate })}
                      >
                        {loading ? '강화 중...' : `강화하기 (${Math.round(rate.success_rate * 100)}%)`}
                      </button>
                    </>
                  );
                })()}
              </div>
            )}
          </div>

          {/* Right: Equipment item list */}
          <div className="bs-split-right">
            <div className="bs-section-title">보유 장비</div>
            <div className="bs-item-list">
              {enhanceItems.map(item => {
                const rate = getEnhanceRate(item.enhance_level);
                const maxed = item.enhance_level >= item.max_enhance;
                const isSelected = selectedEnhance?.inventory_id === item.inventory_id;
                return (
                  <div
                    key={item.inventory_id}
                    className={`bs-item-card ${isSelected ? 'selected' : ''} ${maxed ? 'maxed' : ''}`}
                    onClick={() => { setSelectedEnhance(item); setEnhanceResult(null); }}
                  >
                    <div className="bs-item-card-icon">
                      <img src={`/equipment/${item.item_id}_icon.png`} alt={item.name} className="bs-item-card-img" onError={(e) => { e.target.style.display = 'none'; }} />
                      {item.enhance_level > 0 && <span className="bs-item-card-badge">+{item.enhance_level}</span>}
                    </div>
                    <div className="bs-item-card-body">
                      <div className="bs-item-card-header">
                        <span className="bs-item-card-name" style={{ color: GRADE_COLORS[item.grade] }}>
                          {item.name} {item.enhance_level > 0 ? `+${item.enhance_level}` : ''}
                        </span>
                        {!maxed && rate && <span className="bs-item-card-rate">{Math.round(rate.success_rate * 100)}%</span>}
                        {maxed && <span className="bs-item-card-max">MAX</span>}
                      </div>
                      <div className="bs-item-card-meta">
                        <span className="bs-item-card-type">{TYPE_NAMES[item.type] || item.type}</span>
                        <span className="bs-item-card-grade" style={{ color: GRADE_COLORS[item.grade] }}>[{item.grade}]</span>
                        {item.equipped ? <span className="bs-item-card-equipped">장착중</span> : null}
                      </div>
                      <div className="bs-item-card-enhance-bar">
                        <div className="bs-item-card-enhance-fill" style={{ width: `${(item.enhance_level / item.max_enhance) * 100}%` }} />
                        <span className="bs-item-card-enhance-text">{item.enhance_level}/{item.max_enhance}</span>
                      </div>
                      <ItemStatTags item={item} />
                    </div>
                  </div>
                );
              })}
              {enhanceItems.length === 0 && <div className="facility-empty">강화 가능한 장비가 없습니다.</div>}
            </div>
          </div>
        </div>
      )}

      {/* ===== Materials Tab ===== */}
      {tab === 'materials' && (
        <div className="bs-materials-panel">
          {GRADE_ORDER.map(grade => {
            const gradeMats = materials.filter(m => m.grade === grade);
            if (gradeMats.length === 0) return null;
            return (
              <div key={grade} className="bs-mat-section">
                <div className="bs-mat-section-title" style={{ color: GRADE_COLORS[grade] }}>[{grade}]</div>
                <div className="bs-mat-grid">
                  {gradeMats.map(mat => (
                    <div key={mat.material_id} className="bs-mat-card">
                      <div className="bs-mat-card-icon"><img src={`/materials/${mat.material_id}_icon.png`} alt="" style={{ width: 36, height: 36, objectFit: 'cover', borderRadius: 6 }} onError={e => { e.target.style.display='none'; e.target.parentElement.insertAdjacentText('beforeend', mat.icon); }} /></div>
                      <div className="bs-mat-card-info">
                        <div className="bs-mat-card-name" style={{ color: GRADE_COLORS[mat.grade] }}>{mat.name}</div>
                        <div className="bs-mat-card-desc">{mat.description}</div>
                        <div className="bs-mat-card-qty">보유: {mat.quantity}개</div>
                      </div>
                      <button
                        className="bs-mat-sell-btn"
                        onClick={() => { setSellPopup(mat); setSellQty(1); }}
                        disabled={mat.quantity <= 0}
                      >
                        판매
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
          {materials.length === 0 && <div className="facility-empty">보유한 재료가 없습니다. 몬스터를 사냥하여 재료를 획득하세요!</div>}
        </div>
      )}

      {/* 제조/강화 확인 팝업 */}
      {confirmPopup && (
        <div className="bs-confirm-overlay" onClick={() => setConfirmPopup(null)}>
          <div className="bs-confirm-popup" onClick={e => e.stopPropagation()}>
            {confirmPopup.type === 'craft' ? (
              <>
                <div className="bs-confirm-icon-wrap craft">
                  <img src={`/equipment/${confirmPopup.data.item_id}_icon.png`} alt="" className="bs-confirm-item-img" onError={e => { e.target.style.display='none'; }} />
                </div>
                <div className="bs-confirm-badge craft">제작 확인</div>
                <div className="bs-confirm-item-name" style={{ color: GRADE_COLORS[confirmPopup.data.grade] }}>
                  {confirmPopup.data.name}
                  <span className="bs-confirm-grade" style={{ color: GRADE_COLORS[confirmPopup.data.grade] }}>[{confirmPopup.data.grade}]</span>
                </div>
                <div className="bs-confirm-desc">{confirmPopup.data.description}</div>
                <div className="bs-confirm-cost-section">
                  <div className="bs-confirm-cost-title">소모 재료</div>
                  {confirmPopup.data.materials.map((mat, i) => (
                    <div key={i} className="bs-confirm-cost-row">
                      <img src={`/materials/${mat.material_id}_icon.png`} alt="" className="bs-confirm-cost-icon" onError={e => { e.target.style.display='none'; }} />
                      <span style={{ color: GRADE_COLORS[mat.grade] }}>{mat.name}</span>
                      <span className="bs-confirm-cost-qty">{mat.required_qty}개</span>
                    </div>
                  ))}
                  <div className="bs-confirm-cost-row">
                    <img src="/ui/gold_coin.png" alt="" className="bs-confirm-cost-icon" onError={e => { e.target.style.display='none'; }} />
                    <span>골드</span>
                    <span className="bs-confirm-cost-qty">{confirmPopup.data.gold_cost.toLocaleString()}G</span>
                  </div>
                </div>
                <div className="bs-confirm-question">이 장비를 제작하시겠습니까?</div>
                <div className="bs-confirm-actions">
                  <button className="bs-confirm-btn craft" onClick={() => { const d = confirmPopup.data; setConfirmPopup(null); handleCraft(d.recipe_id); }}>
                    🔨 제작하기
                  </button>
                  <button className="bs-confirm-cancel-btn" onClick={() => setConfirmPopup(null)}>취소</button>
                </div>
              </>
            ) : (
              <>
                <div className="bs-confirm-icon-wrap enhance">
                  <img src={`/equipment/${confirmPopup.data.item_id}_icon.png`} alt="" className="bs-confirm-item-img" onError={e => { e.target.style.display='none'; }} />
                  {confirmPopup.data.enhance_level > 0 && (
                    <span className="bs-confirm-enhance-badge">+{confirmPopup.data.enhance_level}</span>
                  )}
                </div>
                <div className="bs-confirm-badge enhance">강화 확인</div>
                <div className="bs-confirm-item-name" style={{ color: GRADE_COLORS[confirmPopup.data.grade] }}>
                  {confirmPopup.data.name} {confirmPopup.data.enhance_level > 0 ? `+${confirmPopup.data.enhance_level}` : ''}
                </div>
                <div className="bs-confirm-enhance-arrow">
                  <span className="bs-confirm-from">+{confirmPopup.data.enhance_level}</span>
                  <span className="bs-confirm-arrow">→</span>
                  <span className="bs-confirm-to">+{confirmPopup.data.enhance_level + 1}</span>
                </div>
                <div className="bs-confirm-rate-wrap">
                  <div className="bs-confirm-rate-bar">
                    <div className="bs-confirm-rate-fill" style={{ width: `${Math.round(confirmPopup.rate.success_rate * 100)}%` }} />
                  </div>
                  <span className={`bs-confirm-rate-text ${confirmPopup.rate.success_rate >= 0.5 ? 'high' : confirmPopup.rate.success_rate >= 0.2 ? 'mid' : 'low'}`}>
                    성공률 {Math.round(confirmPopup.rate.success_rate * 100)}%
                  </span>
                </div>
                <div className="bs-confirm-cost-section">
                  <div className="bs-confirm-cost-row">
                    <img src="/ui/gold_coin.png" alt="" className="bs-confirm-cost-icon" onError={e => { e.target.style.display='none'; }} />
                    <span>골드</span>
                    <span className="bs-confirm-cost-qty">{confirmPopup.rate.gold_cost.toLocaleString()}G</span>
                  </div>
                  <div className="bs-confirm-cost-row">
                    <span className="bs-confirm-cost-icon">💎</span>
                    <span>{getEnhanceStoneName(confirmPopup.data.grade)}</span>
                    <span className="bs-confirm-cost-qty">{confirmPopup.rate.material_count}개</span>
                  </div>
                </div>
                {confirmPopup.data.enhance_level >= 7 && (
                  <div className="bs-confirm-warning">⚠️ +7 이상에서 실패 시 강화 단계가 1 하락합니다!</div>
                )}
                <div className="bs-confirm-question">강화를 진행하시겠습니까?</div>
                <div className="bs-confirm-actions">
                  <button className="bs-confirm-btn enhance" onClick={() => { const d = confirmPopup.data; setConfirmPopup(null); handleEnhance(d.inventory_id); }}>
                    🔥 강화하기
                  </button>
                  <button className="bs-confirm-cancel-btn" onClick={() => setConfirmPopup(null)}>취소</button>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* 재료 판매 팝업 */}
      {sellPopup && (
        <div className="bs-sell-overlay" onClick={() => setSellPopup(null)}>
          <div className="bs-sell-popup" onClick={e => e.stopPropagation()}>
            <div className="bs-sell-popup-header">
              <span className="bs-sell-popup-title">재료 판매</span>
              <button className="bs-sell-popup-close" onClick={() => setSellPopup(null)}>&times;</button>
            </div>
            <div className="bs-sell-popup-item">
              <div className="bs-sell-popup-icon">
                <img src={`/materials/${sellPopup.material_id}_icon.png`} alt="" onError={e => { e.target.style.display='none'; }} />
              </div>
              <div className="bs-sell-popup-info">
                <div className="bs-sell-popup-name" style={{ color: GRADE_COLORS[sellPopup.grade] }}>{sellPopup.name}</div>
                <div className="bs-sell-popup-desc">{sellPopup.description}</div>
                <div className="bs-sell-popup-owned">보유: {sellPopup.quantity}개 · 개당 {sellPopup.sell_price}G</div>
              </div>
            </div>
            <div className="bs-sell-popup-controls">
              <div className="bs-sell-qty-row">
                <button className="bs-sell-qty-btn" onClick={() => setSellQty(q => Math.max(1, q - 10))}>-10</button>
                <button className="bs-sell-qty-btn" onClick={() => setSellQty(q => Math.max(1, q - 1))}>-1</button>
                <input
                  type="number"
                  className="bs-sell-qty-input"
                  value={sellQty}
                  min={1}
                  max={sellPopup.quantity}
                  onChange={e => {
                    const v = Math.max(1, Math.min(sellPopup.quantity, Math.floor(Number(e.target.value) || 1)));
                    setSellQty(v);
                  }}
                />
                <button className="bs-sell-qty-btn" onClick={() => setSellQty(q => Math.min(sellPopup.quantity, q + 1))}>+1</button>
                <button className="bs-sell-qty-btn" onClick={() => setSellQty(q => Math.min(sellPopup.quantity, q + 10))}>+10</button>
              </div>
              <input
                type="range"
                className="bs-sell-slider"
                min={1}
                max={sellPopup.quantity}
                value={sellQty}
                onChange={e => setSellQty(Number(e.target.value))}
              />
              <div className="bs-sell-qty-labels">
                <span>1</span>
                <button className="bs-sell-all-btn" onClick={() => setSellQty(sellPopup.quantity)}>전체</button>
                <span>{sellPopup.quantity}</span>
              </div>
            </div>
            <div className="bs-sell-popup-total">
              <img src="/ui/gold_coin.png" alt="" className="bs-sell-gold-icon" onError={e => { e.target.style.display='none'; }} />
              <span className="bs-sell-total-gold">{(sellQty * sellPopup.sell_price).toLocaleString()}G</span>
            </div>
            <div className="bs-sell-popup-actions">
              <button
                className="bs-sell-confirm-btn"
                onClick={async () => {
                  await handleSellMaterial(sellPopup.material_id, sellQty);
                  setSellPopup(null);
                }}
              >
                {sellQty}개 판매하기
              </button>
              <button className="bs-sell-cancel-btn" onClick={() => setSellPopup(null)}>취소</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default BlacksmithArea;
