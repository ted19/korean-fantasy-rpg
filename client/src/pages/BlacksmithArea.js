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
  }, [tab]);

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
        <button className={`facility-tab ${tab === 'craft' ? 'active' : ''}`} onClick={() => setTab('craft')}>
          제조
        </button>
        <button className={`facility-tab ${tab === 'enhance' ? 'active' : ''}`} onClick={() => setTab('enhance')}>
          강화
        </button>
        <button className={`facility-tab ${tab === 'materials' ? 'active' : ''}`} onClick={() => setTab('materials')}>
          재료
        </button>
      </div>

      {/* Craft Tab */}
      {tab === 'craft' && (
        <div className="bs-craft-panel">
          <div className="facility-filters">
            <button className={`facility-filter-btn ${craftFilter === 'all' ? 'active' : ''}`} onClick={() => setCraftFilter('all')}>전체</button>
            {uniqueTypes.map(t => (
              <button key={t} className={`facility-filter-btn ${craftFilter === t ? 'active' : ''}`} onClick={() => setCraftFilter(t)}>
                {TYPE_NAMES[t] || t}
              </button>
            ))}
          </div>

          <div className="bs-recipe-list">
            {filteredRecipes.map(recipe => {
              const craftable = canCraft(recipe);
              const levelOk = charState && charState.level >= recipe.required_level;
              return (
                <div
                  key={recipe.recipe_id}
                  className={`bs-recipe-card ${selectedRecipe?.recipe_id === recipe.recipe_id ? 'selected' : ''} ${!craftable ? 'disabled' : ''}`}
                  onClick={() => setSelectedRecipe(recipe)}
                >
                  <div className="bs-recipe-icon">
                    <img src={`/equipment/${recipe.item_id}_icon.png`} alt={recipe.name} className="bs-recipe-img" onError={(e) => { e.target.style.display = 'none'; }} />
                  </div>
                  <div className="bs-recipe-info">
                    <div className="bs-recipe-name" style={{ color: GRADE_COLORS[recipe.grade] }}>
                      {recipe.name} <span className="bs-recipe-grade">[{recipe.grade}]</span>
                    </div>
                    <div className="bs-recipe-desc">{recipe.description}</div>
                    <div className="bs-recipe-meta">
                      <span className="bs-recipe-type">{TYPE_NAMES[recipe.type] || recipe.type}</span>
                      {recipe.class_restriction && <span className="bs-recipe-class">{recipe.class_restriction}</span>}
                      {!levelOk && <span className="bs-recipe-level-warn">Lv.{recipe.required_level} 필요</span>}
                    </div>
                  </div>
                  <div className="bs-recipe-cost">{recipe.gold_cost.toLocaleString()}G</div>
                </div>
              );
            })}
            {filteredRecipes.length === 0 && <div className="facility-empty">해당 카테고리의 레시피가 없습니다.</div>}
          </div>

          {selectedRecipe && (
            <div className="bs-recipe-detail">
              <div className="bs-detail-header">
                <h3 style={{ color: GRADE_COLORS[selectedRecipe.grade] }}>
                  {selectedRecipe.name} <span className="bs-grade-tag">[{selectedRecipe.grade}]</span>
                </h3>
                <div className="bs-detail-stats">
                  {selectedRecipe.effect_hp > 0 && <span>HP+{selectedRecipe.effect_hp}</span>}
                  {selectedRecipe.effect_mp > 0 && <span>MP+{selectedRecipe.effect_mp}</span>}
                  {selectedRecipe.effect_attack > 0 && <span>ATK+{selectedRecipe.effect_attack}</span>}
                  {selectedRecipe.effect_defense > 0 && <span>DEF+{selectedRecipe.effect_defense}</span>}
                  {selectedRecipe.max_enhance > 0 && <span>최대 +{selectedRecipe.max_enhance}</span>}
                </div>
              </div>
              <div className="bs-detail-mats">
                <div className="bs-detail-mats-title">필요 재료:</div>
                {selectedRecipe.materials.map((mat, i) => (
                  <div key={i} className={`bs-mat-row ${mat.owned_qty >= mat.required_qty ? 'ok' : 'missing'}`}>
                    <span className="bs-mat-icon">{mat.icon}</span>
                    <span className="bs-mat-name" style={{ color: GRADE_COLORS[mat.grade] }}>{mat.name}</span>
                    <span className="bs-mat-qty">{mat.owned_qty}/{mat.required_qty}</span>
                  </div>
                ))}
                <div className={`bs-mat-row ${(charState?.gold || 0) >= selectedRecipe.gold_cost ? 'ok' : 'missing'}`}>
                  <span className="bs-mat-icon">G</span>
                  <span className="bs-mat-name">골드</span>
                  <span className="bs-mat-qty">{(charState?.gold || 0).toLocaleString()}/{selectedRecipe.gold_cost.toLocaleString()}</span>
                </div>
              </div>
              <button className="bs-craft-btn" disabled={!canCraft(selectedRecipe) || loading} onClick={() => handleCraft(selectedRecipe.recipe_id)}>
                {loading ? '제작 중...' : '제작하기'}
              </button>
            </div>
          )}
        </div>
      )}

      {/* Enhance Tab */}
      {tab === 'enhance' && (
        <div className="bs-enhance-panel">
          <div className="bs-enhance-list">
            {enhanceItems.map(item => {
              const rate = getEnhanceRate(item.enhance_level);
              const maxed = item.enhance_level >= item.max_enhance;
              return (
                <div
                  key={item.inventory_id}
                  className={`bs-enhance-card ${selectedEnhance?.inventory_id === item.inventory_id ? 'selected' : ''} ${maxed ? 'maxed' : ''}`}
                  onClick={() => { setSelectedEnhance(item); setEnhanceResult(null); }}
                >
                  <div className="bs-enhance-icon">
                    <img src={`/equipment/${item.item_id}_icon.png`} alt={item.name} className="bs-enhance-img" onError={(e) => { e.target.style.display = 'none'; }} />
                    {item.enhance_level > 0 && <span className="bs-enhance-badge">+{item.enhance_level}</span>}
                  </div>
                  <div className="bs-enhance-info">
                    <div className="bs-enhance-name" style={{ color: GRADE_COLORS[item.grade] }}>
                      {item.name} {item.enhance_level > 0 ? `+${item.enhance_level}` : ''}
                    </div>
                    <div className="bs-enhance-meta">
                      <span className="bs-enhance-grade">[{item.grade}]</span>
                      <span>{TYPE_NAMES[item.type] || item.type}</span>
                      {item.equipped ? <span className="bs-equipped-tag">장착중</span> : null}
                    </div>
                    <div className="bs-enhance-bar">
                      <div className="bs-enhance-bar-fill" style={{ width: `${(item.enhance_level / item.max_enhance) * 100}%` }} />
                      <span className="bs-enhance-bar-text">{item.enhance_level}/{item.max_enhance}</span>
                    </div>
                  </div>
                  {!maxed && rate && <div className="bs-enhance-rate">{Math.round(rate.success_rate * 100)}%</div>}
                  {maxed && <div className="bs-enhance-max">MAX</div>}
                </div>
              );
            })}
            {enhanceItems.length === 0 && <div className="facility-empty">강화 가능한 장비가 없습니다.</div>}
          </div>

          {selectedEnhance && (
            <div className="bs-enhance-detail">
              <h3 style={{ color: GRADE_COLORS[selectedEnhance.grade] }}>
                {selectedEnhance.name} +{selectedEnhance.enhance_level}
              </h3>
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
                        <span>현재 강화:</span>
                        <span>+{selectedEnhance.enhance_level} → +{selectedEnhance.enhance_level + 1}</span>
                      </div>
                      <div className="bs-enhance-stat-row">
                        <span>성공 확률:</span>
                        <span className={rate.success_rate >= 0.5 ? 'rate-high' : rate.success_rate >= 0.2 ? 'rate-mid' : 'rate-low'}>
                          {Math.round(rate.success_rate * 100)}%
                        </span>
                      </div>
                      <div className={`bs-enhance-stat-row ${(charState?.gold || 0) >= rate.gold_cost ? '' : 'missing'}`}>
                        <span>필요 골드:</span>
                        <span>{rate.gold_cost.toLocaleString()}G</span>
                      </div>
                      <div className={`bs-enhance-stat-row ${ownedStones >= rate.material_count ? '' : 'missing'}`}>
                        <span>필요 {stoneName}:</span>
                        <span>{ownedStones}/{rate.material_count}</span>
                      </div>
                      {selectedEnhance.enhance_level >= 7 && (
                        <div className="bs-enhance-warning">+7 이상에서 실패 시 강화 단계가 1 하락합니다!</div>
                      )}
                    </div>
                    {enhanceResult && (
                      <div className={`bs-enhance-result ${enhanceResult.enhanced ? 'success' : 'fail'}`}>
                        {enhanceResult.enhanced ? '' : ''}{enhanceResult.message}
                      </div>
                    )}
                    <button
                      className="bs-enhance-btn"
                      disabled={loading || (charState?.gold || 0) < rate.gold_cost || ownedStones < rate.material_count}
                      onClick={() => handleEnhance(selectedEnhance.inventory_id)}
                    >
                      {loading ? '강화 중...' : `강화하기 (${Math.round(rate.success_rate * 100)}%)`}
                    </button>
                  </>
                );
              })()}
            </div>
          )}
        </div>
      )}

      {/* Materials Tab */}
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
                      <div className="bs-mat-card-icon">{mat.icon}</div>
                      <div className="bs-mat-card-info">
                        <div className="bs-mat-card-name" style={{ color: GRADE_COLORS[mat.grade] }}>{mat.name}</div>
                        <div className="bs-mat-card-desc">{mat.description}</div>
                        <div className="bs-mat-card-qty">보유: {mat.quantity}개</div>
                      </div>
                      <button
                        className="bs-mat-sell-btn"
                        onClick={() => handleSellMaterial(mat.material_id, 1)}
                        disabled={mat.quantity <= 0}
                        title={`판매 (${mat.sell_price}G)`}
                      >
                        판매 ({mat.sell_price}G)
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
    </div>
  );
}

export default BlacksmithArea;
