import React, { useState, useEffect, useCallback } from 'react';
import api from '../api';
import './SpecialDungeonArea.css';

const ELEMENT_INFO = {
  fire:   { name: '불', icon: '🔥', color: '#ff6b35' },
  water:  { name: '물', icon: '💧', color: '#4da6ff' },
  earth:  { name: '땅', icon: '🪨', color: '#8bc34a' },
  wind:   { name: '바람', icon: '🌀', color: '#b388ff' },
};

const TYPE_ACCENTS = {
  tower: '#a78bfa',
  elemental: '#22d3ee',
  boss_raid: '#f97316',
};

const TYPE_ICONS = {
  tower: '🗼',
  elemental: '🌀',
  boss_raid: '💀',
};

function SpdImg({ src, fallback, className, alt }) {
  const [err, setErr] = useState(false);
  if (err || !src) return fallback || null;
  return <img src={src} alt={alt || ''} className={className} onError={() => setErr(true)} />;
}

function SpecialDungeonArea({ charState, onStartBattle, onStartStageBattle }) {
  const [view, setView] = useState('select');
  const [dungeonList, setDungeonList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [towerInfo, setTowerInfo] = useState(null);
  const [elementalInfo, setElementalInfo] = useState(null);
  const [bossList, setBossList] = useState([]);
  const [popup, setPopup] = useState(null);
  const [rewardPopup, setRewardPopup] = useState(null);

  const loadList = useCallback(async () => {
    try {
      setLoading(true);
      const res = await api.get('/special-dungeon/list');
      setDungeonList(res.data.dungeons || []);
    } catch (err) {
      console.error('Failed to load special dungeons:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadList(); }, [loadList]);

  // 전투 후 복귀 시 현재 뷰 데이터 자동 새로고침
  useEffect(() => {
    if (view === 'tower') loadTower();
    else if (view === 'elemental') loadElemental();
    else if (view === 'boss_raid') loadBossRaid();
    else if (view === 'select') loadList();
  }, [charState?.level, charState?.exp]); // eslint-disable-line

  const loadTower = async () => {
    try { setLoading(true); const res = await api.get('/special-dungeon/tower/info'); setTowerInfo(res.data); }
    catch (err) { console.error(err); }
    finally { setLoading(false); }
  };
  const loadElemental = async () => {
    try { setLoading(true); const res = await api.get('/special-dungeon/elemental/info'); setElementalInfo(res.data); }
    catch (err) { console.error(err); }
    finally { setLoading(false); }
  };
  const loadBossRaid = async () => {
    try { setLoading(true); const res = await api.get('/special-dungeon/boss-raid/list'); setBossList(res.data.bosses || []); }
    catch (err) { console.error(err); }
    finally { setLoading(false); }
  };

  const handleTypeSelect = (key) => {
    const dungeon = dungeonList.find(d => d.key === key);
    if (!dungeon || charState.level < dungeon.requiredLevel) return;
    setView(key);
    if (key === 'tower') loadTower();
    else if (key === 'elemental') loadElemental();
    else if (key === 'boss_raid') loadBossRaid();
  };

  const handleBack = () => { setView('select'); setPopup(null); loadList(); };

  // ===== Battle handlers =====
  const handleTowerChallenge = () => {
    if (!towerInfo?.nextFloor) return;
    const nf = towerInfo.nextFloor;
    setPopup({
      type: 'tower', title: `${nf.floor}층 도전`, icon: nf.isBoss ? '👑' : '🗼',
      desc: nf.isBoss ? '보스층입니다! 강력한 적이 기다리고 있습니다.' : `무한의 탑 ${nf.floor}층에 도전합니다.`,
      info: [
        { label: '몬스터', value: `${nf.monsterCount}마리` },
        { label: '레벨 보너스', value: `+${nf.levelBonus} (HP×${(1 + nf.levelBonus * 0.1).toFixed(1)} 공격×${(1 + nf.levelBonus * 0.08).toFixed(1)} 방어×${(1 + nf.levelBonus * 0.05).toFixed(1)})` },
        { label: '경험치', value: `${nf.expReward}` },
        { label: '골드', value: `${nf.goldReward}` },
      ],
      data: nf,
    });
  };

  const handleTowerStart = async () => {
    if (!popup || popup.type !== 'tower') return;
    try {
      const res = await api.get(`/special-dungeon/tower/floor/${popup.data.floor}`);
      setPopup(null);
      onStartBattle(popup.data.dungeonKey, res.data.stage, { type: 'tower', floor: popup.data.floor });
    } catch (err) { console.error(err); }
  };

  const handleTrialChallenge = (trial) => {
    if (!elementalInfo) return;
    const elem = ELEMENT_INFO[elementalInfo.todayElement];
    setPopup({
      type: 'elemental', title: trial.name, icon: elem?.icon || '🌀',
      desc: `오늘의 속성: ${elem?.icon || ''} ${elem?.name || ''}\n${trial.materialCount}x ${trial.materialGrade} 재료를 획득할 수 있습니다.`,
      info: [
        { label: '몬스터', value: `${trial.monsterCount}마리` },
        { label: '요구 레벨', value: `Lv.${trial.requiredLevel}` },
        { label: '경험치', value: `${trial.expReward}` },
        { label: '재료', value: `${trial.materialCount}개 (${trial.materialGrade})` },
      ],
      data: trial,
    });
  };

  const handleTrialStart = async () => {
    if (!popup || popup.type !== 'elemental') return;
    try {
      const res = await api.get(`/special-dungeon/elemental/tier/${popup.data.tier}`);
      setPopup(null);
      onStartStageBattle('elemental_trial', res.data.stage, res.data.monsters, { type: 'elemental', tier: popup.data.tier });
    } catch (err) { console.error(err); }
  };

  const handleBossChallenge = (boss) => {
    if (boss.todayCleared || boss.todayAttempted || charState.level < boss.requiredLevel) return;
    setPopup({
      type: 'boss_raid', title: `${boss.name} 토벌`, icon: '💀', desc: boss.description,
      info: [
        { label: '몬스터', value: `${boss.monsterCount}마리` },
        { label: '요구 레벨', value: `Lv.${boss.requiredLevel}` },
        { label: '경험치', value: `${boss.expReward}` },
        { label: '골드', value: `${boss.goldReward}` },
      ],
      data: boss,
    });
  };

  const handleBossStart = async () => {
    if (!popup || popup.type !== 'boss_raid') return;
    try {
      const res = await api.get(`/special-dungeon/boss-raid/${popup.data.id}`);
      setPopup(null);
      onStartBattle(popup.data.dungeonKey, res.data.stage, { type: 'boss_raid', bossId: popup.data.id });
    } catch (err) { console.error(err); }
  };

  // ===== Render helpers =====
  function renderPopup() {
    if (!popup) return null;
    const startHandler = popup.type === 'tower' ? handleTowerStart
      : popup.type === 'elemental' ? handleTrialStart : handleBossStart;

    // Tower gets premium popup
    if (popup.type === 'tower') {
      const isBoss = popup.data?.isBoss;
      const floor = popup.data?.floor || 0;
      return (
        <div className="spd-popup-overlay" onClick={() => setPopup(null)}>
          <div className="spd-tower-popup" onClick={e => e.stopPropagation()}>
            {/* Header image */}
            <div className="spd-tp-header">
              <SpdImg
                src={isBoss ? '/special_dungeons/tower_floor_boss.png' : '/special_dungeons/tower_floor_normal.png'}
                className="spd-tp-header-img"
              />
              <div className="spd-tp-header-overlay" />
              <div className="spd-tp-floor-badge" data-boss={isBoss ? 'true' : undefined}>
                <span className="spd-tp-floor-num">{floor}</span>
                <span className="spd-tp-floor-label">FLOOR</span>
              </div>
              {isBoss && <div className="spd-tp-boss-ribbon">BOSS</div>}
            </div>

            {/* Body */}
            <div className="spd-tp-body">
              <div className="spd-tp-title">{popup.title}</div>
              <div className="spd-tp-desc">{popup.desc}</div>

              {/* Stats grid */}
              <div className="spd-tp-stats">
                {popup.info.map((item, i) => (
                  <div key={i} className="spd-tp-stat">
                    <div className="spd-tp-stat-val">{item.value}</div>
                    <div className="spd-tp-stat-label">{item.label}</div>
                  </div>
                ))}
              </div>

              {/* Dungeon theme indicator */}
              <div className="spd-tp-theme">
                <SpdImg src="/special_dungeons/tower_icon.png" className="spd-tp-theme-icon" />
                <span>던전 테마: {popup.data?.dungeonKey || '미정'}</span>
              </div>

              {/* Buttons */}
              <div className="spd-tp-btns">
                <button className="spd-tp-btn cancel" onClick={() => setPopup(null)}>취소</button>
                <button className="spd-tp-btn start" onClick={startHandler}>
                  <span className="spd-tp-btn-icon">⚔️</span>
                  도전 시작
                </button>
              </div>
            </div>
          </div>
        </div>
      );
    }

    // Elemental gets premium popup
    if (popup.type === 'elemental') {
      const elem = elementalInfo ? ELEMENT_INFO[elementalInfo.todayElement] : null;
      const elemKey = elementalInfo?.todayElement || 'fire';
      const tier = popup.data?.tier || 1;
      const TIER_NAMES = ['초급', '중급', '고급', '최고급', '전설'];
      return (
        <div className="spd-popup-overlay" onClick={() => setPopup(null)}>
          <div className={`spd-elem-popup ${elemKey}`} onClick={e => e.stopPropagation()}>
            {/* Header with tier image */}
            <div className="spd-ep-header">
              <SpdImg
                src={`/special_dungeons/elem_tier_${tier}.png`}
                className="spd-ep-header-img"
              />
              <div className="spd-ep-header-overlay" />
              <div className="spd-ep-tier-badge" data-tier={tier}>
                <span className="spd-ep-tier-num">{tier}</span>
                <span className="spd-ep-tier-label">TIER</span>
              </div>
              <div className="spd-ep-elem-tag">
                <SpdImg src={`/special_dungeons/elem_${elemKey}_icon.png`} className="spd-ep-elem-tag-icon" />
                <span>{elem?.name || ''}</span>
              </div>
            </div>

            {/* Body */}
            <div className="spd-ep-body">
              <div className="spd-ep-title">{popup.title}</div>
              <div className="spd-ep-subtitle">{TIER_NAMES[tier - 1] || ''} 시련 - {elem?.name} 속성</div>
              <div className="spd-ep-desc">
                {elem?.name} 속성 정령들이 출현합니다. {popup.data?.materialCount}x {popup.data?.materialGrade} 재료를 획득할 수 있습니다.
              </div>

              {/* Stats grid */}
              <div className="spd-ep-stats">
                {popup.info.map((item, i) => (
                  <div key={i} className="spd-ep-stat">
                    <div className="spd-ep-stat-val">{item.value}</div>
                    <div className="spd-ep-stat-label">{item.label}</div>
                  </div>
                ))}
              </div>

              {/* Element indicator */}
              <div className={`spd-ep-element-indicator ${elemKey}`}>
                <SpdImg src={`/special_dungeons/elem_${elemKey}_icon.png`} className="spd-ep-ei-icon" />
                <span>오늘의 속성: {elem?.icon} {elem?.name}</span>
              </div>

              {/* Buttons */}
              <div className="spd-ep-btns">
                <button className="spd-ep-btn cancel" onClick={() => setPopup(null)}>취소</button>
                <button className={`spd-ep-btn start ${elemKey}`} onClick={startHandler}>
                  <span className="spd-ep-btn-icon">⚔️</span>
                  시련 도전
                </button>
              </div>
            </div>
          </div>
        </div>
      );
    }

    // Boss raid premium popup
    if (popup.type === 'boss_raid') {
      const bossIdx = popup.data?.id ? bossList.findIndex(b => b.id === popup.data.id) + 1 : 1;
      return (
        <div className="spd-popup-overlay" onClick={() => setPopup(null)}>
          <div className="spd-br-popup" onClick={e => e.stopPropagation()}>
            {/* Header with boss scene image */}
            <div className="spd-bp-header">
              <SpdImg
                src={`/special_dungeons/br_scene_${bossIdx}.png`}
                className="spd-bp-header-img"
                fallback={<SpdImg src="/special_dungeons/br_popup_bg.png" className="spd-bp-header-img" />}
              />
              <div className="spd-bp-header-overlay" />
              <div className="spd-bp-boss-portrait">
                <SpdImg src={`/special_dungeons/boss_${bossIdx}.png`} className="spd-bp-portrait-img" />
              </div>
              <div className="spd-bp-danger-tag">BOSS RAID</div>
            </div>

            {/* Body */}
            <div className="spd-bp-body">
              <div className="spd-bp-title">{popup.title}</div>
              <div className="spd-bp-desc">{popup.desc}</div>

              {/* Stats grid */}
              <div className="spd-bp-stats">
                {popup.info.map((item, i) => (
                  <div key={i} className="spd-bp-stat">
                    <div className="spd-bp-stat-val">{item.value}</div>
                    <div className="spd-bp-stat-label">{item.label}</div>
                  </div>
                ))}
              </div>

              {/* Daily limit warning */}
              <div className="spd-bp-warning">
                <span className="spd-bp-warning-icon">⚠️</span>
                하루 1회 도전 가능 · 실패해도 소멸됩니다
              </div>

              {/* Buttons */}
              <div className="spd-bp-btns">
                <button className="spd-bp-btn cancel" onClick={() => setPopup(null)}>취소</button>
                <button className="spd-bp-btn start" onClick={startHandler}>
                  <span className="spd-bp-btn-icon">⚔️</span>
                  토벌 시작
                </button>
              </div>
            </div>
          </div>
        </div>
      );
    }

    // Fallback generic popup
    return (
      <div className="spd-popup-overlay" onClick={() => setPopup(null)}>
        <div className="spd-popup" onClick={e => e.stopPropagation()} style={{ '--spd-accent': TYPE_ACCENTS[popup.type] }}>
          <div className="spd-popup-icon">{popup.icon}</div>
          <div className="spd-popup-title">{popup.title}</div>
          <div className="spd-popup-desc">{popup.desc}</div>
          <div className="spd-popup-info">
            {popup.info.map((item, i) => (
              <div key={i} className="spd-popup-info-item">{item.label}: <span>{item.value}</span></div>
            ))}
          </div>
          <div className="spd-popup-btns">
            <button className="spd-popup-btn cancel" onClick={() => setPopup(null)}>취소</button>
            <button className="spd-popup-btn start" onClick={startHandler}>도전 시작 (행동력 {popup?.type === 'boss_raid' ? 4 : 3} 소모)</button>
          </div>
        </div>
      </div>
    );
  }

  function renderRewardPopup() {
    if (!rewardPopup) return null;
    return (
      <div className="spd-popup-overlay" onClick={() => setRewardPopup(null)}>
        <div className="spd-reward-popup" onClick={e => e.stopPropagation()}>
          <div className="spd-reward-icon">🎁</div>
          <div className="spd-reward-title">재료 획득!</div>
          <div className="spd-reward-item">
            <span className="mat-icon">{rewardPopup.icon}</span>
            <span>{rewardPopup.name}</span>
            <span className="mat-qty">x{rewardPopup.quantity}</span>
          </div>
          <button className="spd-popup-btn start" style={{ '--spd-accent': '#22d3ee' }} onClick={() => setRewardPopup(null)}>확인</button>
        </div>
      </div>
    );
  }

  // ===== SELECT VIEW =====
  if (loading && view === 'select') {
    return <div className="spd-scene"><div className="spd-loading">스페셜 던전 로딩 중...</div></div>;
  }

  if (view === 'select') {
    return (
      <div className="spd-scene">
        <div className="spd-map-bg">
          <SpdImg src="/special_dungeons/special_map_bg.png" className="spd-map-bg-img" />
          <div className="spd-map-bg-overlay" />
        </div>
        <div className="spd-title-area">
          <h2 className="spd-title">스페셜 던전</h2>
          <p className="spd-subtitle">특별한 보상과 도전이 기다리고 있습니다</p>
        </div>
        <div className="spd-type-grid">
          {dungeonList.map(d => {
            const locked = charState.level < d.requiredLevel;
            return (
              <div
                key={d.key}
                className={`spd-type-card${locked ? ' locked' : ''}`}
                style={{ '--spd-accent': d.accentColor || TYPE_ACCENTS[d.key] }}
                onClick={() => !locked && handleTypeSelect(d.key)}
              >
                <div className="spd-card-img-wrap">
                  <SpdImg
                    src={`/special_dungeons/${d.key}_card.png`}
                    className="spd-card-img"
                    fallback={<div className="spd-card-icon-fallback">{TYPE_ICONS[d.key] || '⚔️'}</div>}
                  />
                  <div className="spd-card-img-overlay" />
                </div>
                <div className="spd-card-content">
                  <div className="spd-card-name">{d.name}</div>
                  <div className="spd-card-desc">{d.description}</div>
                  <div className="spd-card-tags">
                    <span className="spd-card-tag">Lv.{d.requiredLevel}+</span>
                    <span className="spd-card-tag">행동력 {d.staminaCost}</span>
                    <span className="spd-card-tag accent">
                      {d.resetType === 'weekly' ? '주간 리셋' : d.resetType === 'daily' ? '일일 리셋' : '보스별 일일'}
                    </span>
                  </div>
                  <div className="spd-card-progress">
                    {d.key === 'tower' && (
                      <><span>현재 {d.currentFloor || 0}층</span><span className="spd-card-progress-val">최고 {d.bestRecord || 0}층</span></>
                    )}
                    {d.key === 'elemental' && (
                      <><span>오늘: {ELEMENT_INFO[d.todayElement]?.icon} {ELEMENT_INFO[d.todayElement]?.name}</span><span className="spd-card-progress-val">{d.clearedTier || 0}/5 클리어</span></>
                    )}
                    {d.key === 'boss_raid' && (
                      <><span>오늘 클리어: {d.todayClears || 0}</span><span className="spd-card-progress-val">총 {d.totalClears || 0}회</span></>
                    )}
                  </div>
                  {locked && <div className="spd-card-locked-msg">Lv.{d.requiredLevel} 이상 필요</div>}
                </div>
              </div>
            );
          })}
        </div>
        {renderPopup()}
      </div>
    );
  }

  // ===== TOWER VIEW =====
  if (view === 'tower') {
    const floorPct = towerInfo ? Math.round((towerInfo.currentFloor / 50) * 100) : 0;
    const nf = towerInfo?.nextFloor;
    return (
      <div className="spd-scene" style={{ '--spd-accent': '#a78bfa' }}>
        <div className="spd-map-bg">
          <SpdImg src="/special_dungeons/tower_bg.png" className="spd-map-bg-img" />
          <div className="spd-map-bg-overlay" />
        </div>
        <div className="spd-detail-scene">
          {/* Banner */}
          <div className="spd-banner">
            <SpdImg src="/special_dungeons/tower_banner.png" className="spd-banner-img" />
            <div className="spd-banner-overlay" />
            <div className="spd-banner-content">
              <div className="spd-banner-title-area">
                <SpdImg src="/special_dungeons/tower_icon.png" className="spd-banner-icon"
                  fallback={<div className="spd-banner-icon-fallback">🗼</div>} />
                <div>
                  <div className="spd-banner-title">무한의 탑</div>
                  <div className="spd-banner-sub">매주 월요일 초기화 · 최대 50층</div>
                </div>
              </div>
              <button className="spd-back-btn" onClick={handleBack}>← 돌아가기</button>
            </div>
          </div>

          {loading ? <div className="spd-loading">로딩 중...</div> : towerInfo ? (
            <>
              {/* Tower visual + progress */}
              <div className="tw-hero">
                <div className="tw-hero-img-wrap">
                  <SpdImg src="/special_dungeons/tower_exterior.png" className="tw-hero-img" />
                  <div className="tw-hero-img-overlay" />
                  {/* Floor progress overlay */}
                  <div className="tw-hero-progress">
                    <div className="tw-hero-progress-fill" style={{ height: `${floorPct}%` }} />
                  </div>
                  <div className="tw-hero-floor-label">
                    <span className="tw-hero-floor-num">{towerInfo.currentFloor}</span>
                    <span className="tw-hero-floor-max">/ 50</span>
                  </div>
                </div>

                {/* Stats column */}
                <div className="tw-hero-stats">
                  <div className="tw-stat-card">
                    <SpdImg src="/special_dungeons/tower_stat_floor.png" className="tw-stat-bg" />
                    <div className="tw-stat-content">
                      <SpdImg src="/special_dungeons/tower_stat_icon_floor.png" className="tw-stat-icon-img" />
                      <div className="tw-stat-info">
                        <div className="tw-stat-val">{towerInfo.currentFloor}<span>/50</span></div>
                        <div className="tw-stat-label">현재 층</div>
                      </div>
                    </div>
                  </div>
                  <div className="tw-stat-card">
                    <SpdImg src="/special_dungeons/tower_stat_best.png" className="tw-stat-bg" />
                    <div className="tw-stat-content">
                      <SpdImg src="/special_dungeons/tower_stat_icon_best.png" className="tw-stat-icon-img" />
                      <div className="tw-stat-info">
                        <div className="tw-stat-val">{towerInfo.bestRecord}<span>층</span></div>
                        <div className="tw-stat-label">최고 기록</div>
                      </div>
                    </div>
                  </div>
                  <div className="tw-stat-card">
                    <SpdImg src="/special_dungeons/tower_stat_clears.png" className="tw-stat-bg" />
                    <div className="tw-stat-content">
                      <SpdImg src="/special_dungeons/tower_stat_icon_battle.png" className="tw-stat-icon-img" />
                      <div className="tw-stat-info">
                        <div className="tw-stat-val">{towerInfo.totalClears}<span>회</span></div>
                        <div className="tw-stat-label">총 클리어</div>
                      </div>
                    </div>
                  </div>

                  {/* Progress bar */}
                  <div className="tw-progress-wrap">
                    <div className="tw-progress-header">
                      <span>탑 진행도</span>
                      <span className="tw-progress-pct">{floorPct}%</span>
                    </div>
                    <div className="tw-progress-bar">
                      <div className="tw-progress-fill" style={{ width: `${floorPct}%` }} />
                      {[10,20,30,40,50].map(f => (
                        <div key={f} className={`tw-progress-mark${towerInfo.currentFloor >= f ? ' done' : ''}`}
                          style={{ left: `${(f/50)*100}%` }}>
                          <span>{f}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>

              {/* Next floor challenge card */}
              {nf ? (
                <div className={`tw-next-card${nf.isBoss ? ' boss' : ''}`}>
                  <div className="tw-next-img-wrap">
                    <SpdImg
                      src={nf.isBoss ? '/special_dungeons/tower_boss_door.png' : '/special_dungeons/tower_next_door.png'}
                      className="tw-next-img" />
                    <div className="tw-next-img-overlay" />
                    <div className="tw-next-floor-badge">
                      <span className="tw-next-floor-num">{nf.floor}</span>
                      <span className="tw-next-floor-text">FLOOR</span>
                    </div>
                    {nf.isBoss && <div className="tw-next-boss-tag">BOSS FLOOR</div>}
                  </div>
                  <div className="tw-next-body">
                    <div className="tw-next-title">
                      {nf.floor}층 {nf.isBoss ? '- 보스 전투' : '도전'}
                    </div>
                    <div className="tw-next-desc">
                      {nf.isBoss ? '이 층에는 강력한 보스가 기다리고 있습니다!' : `무한의 탑 ${nf.floor}층에 도전합니다.`}
                    </div>
                    <div className="tw-next-stats">
                      <div className="tw-ns">
                        <SpdImg src="/special_dungeons/tower_info_monster.png" className="tw-ns-icon-img" />
                        <span className="tw-ns-val">{nf.monsterCount}마리</span>
                        <span className="tw-ns-label">몬스터</span>
                      </div>
                      <div className="tw-ns tw-ns-level-bonus">
                        <SpdImg src="/special_dungeons/tower_info_level.png" className="tw-ns-icon-img" />
                        <span className="tw-ns-val">+{nf.levelBonus}</span>
                        <span className="tw-ns-label">레벨 보너스</span>
                        <div className="tw-ns-tooltip">
                          <div className="tw-ns-tooltip-title">레벨 보너스 +{nf.levelBonus}</div>
                          <div className="tw-ns-tooltip-desc">높은 층일수록 몬스터가 강해집니다</div>
                          <div className="tw-ns-tooltip-stats">
                            <span>HP ×{(1 + nf.levelBonus * 0.1).toFixed(1)}</span>
                            <span>공격 ×{(1 + nf.levelBonus * 0.08).toFixed(1)}</span>
                            <span>방어 ×{(1 + nf.levelBonus * 0.05).toFixed(1)}</span>
                          </div>
                        </div>
                      </div>
                      <div className="tw-ns">
                        <SpdImg src="/special_dungeons/tower_info_exp.png" className="tw-ns-icon-img" />
                        <span className="tw-ns-val">{nf.expReward}</span>
                        <span className="tw-ns-label">경험치</span>
                      </div>
                      <div className="tw-ns">
                        <SpdImg src="/special_dungeons/tower_info_gold.png" className="tw-ns-icon-img" />
                        <span className="tw-ns-val">{nf.goldReward}</span>
                        <span className="tw-ns-label">골드</span>
                      </div>
                    </div>

                    {/* 레벨 보너스 설명 바 */}
                    <div className="tw-level-bonus-bar">
                      <div className="tw-lb-header">
                        <SpdImg src="/special_dungeons/tower_info_level.png" className="tw-lb-icon" />
                        <span className="tw-lb-title">레벨 보너스 +{nf.levelBonus}</span>
                      </div>
                      <div className="tw-lb-desc">몬스터 능력치가 기본 대비 강화됩니다</div>
                      <div className="tw-lb-stats">
                        <div className="tw-lb-stat">
                          <span className="tw-lb-stat-label">HP</span>
                          <div className="tw-lb-stat-bar"><div className="tw-lb-stat-fill hp" style={{ width: `${Math.min(100, nf.levelBonus * 4)}%` }} /></div>
                          <span className="tw-lb-stat-val">×{(1 + nf.levelBonus * 0.1).toFixed(1)}</span>
                        </div>
                        <div className="tw-lb-stat">
                          <span className="tw-lb-stat-label">공격</span>
                          <div className="tw-lb-stat-bar"><div className="tw-lb-stat-fill atk" style={{ width: `${Math.min(100, nf.levelBonus * 3.2)}%` }} /></div>
                          <span className="tw-lb-stat-val">×{(1 + nf.levelBonus * 0.08).toFixed(1)}</span>
                        </div>
                        <div className="tw-lb-stat">
                          <span className="tw-lb-stat-label">방어</span>
                          <div className="tw-lb-stat-bar"><div className="tw-lb-stat-fill def" style={{ width: `${Math.min(100, nf.levelBonus * 2)}%` }} /></div>
                          <span className="tw-lb-stat-val">×{(1 + nf.levelBonus * 0.05).toFixed(1)}</span>
                        </div>
                      </div>
                    </div>

                    <button className={`tw-challenge-btn${nf.isBoss ? ' boss' : ''}`} onClick={handleTowerChallenge}>
                      {nf.floor}층 도전하기
                    </button>
                  </div>
                </div>
              ) : (
                <div className="tw-complete-card">
                  <SpdImg src="/special_dungeons/tower_complete.png" className="tw-complete-img" />
                  <div className="tw-complete-overlay" />
                  <div className="tw-complete-content">
                    <SpdImg src="/special_dungeons/tower_trophy.png" className="tw-complete-trophy-img" />
                    <div className="tw-complete-title">축하합니다!</div>
                    <div className="tw-complete-text">이번 주 50층을 모두 클리어했습니다!<br/>다음 주에 다시 도전하세요.</div>
                  </div>
                </div>
              )}
            </>
          ) : null}
        </div>
        {renderPopup()}
      </div>
    );
  }

  // ===== ELEMENTAL VIEW =====
  if (view === 'elemental') {
    const elemKey = elementalInfo?.todayElement || 'fire';
    const elem = elementalInfo ? ELEMENT_INFO[elemKey] : null;
    const clearedTier = elementalInfo?.clearedTier || 0;
    const tierPct = (clearedTier / 5) * 100;
    const TIER_NAMES = ['초급', '중급', '고급', '최고급', '전설'];
    return (
      <div className="spd-scene" style={{ '--spd-accent': '#22d3ee' }}>
        <div className="spd-map-bg">
          <SpdImg src={`/special_dungeons/elem_${elemKey}_bg.png`} className="spd-map-bg-img" />
          <div className="spd-map-bg-overlay" />
        </div>
        <div className="spd-detail-scene">
          <div className="spd-banner">
            <SpdImg src="/special_dungeons/elemental_banner.png" className="spd-banner-img" />
            <div className="spd-banner-overlay" />
            <div className="spd-banner-content">
              <div className="spd-banner-title-area">
                <SpdImg
                  src="/special_dungeons/elemental_icon.png"
                  className="spd-banner-icon"
                  fallback={<div className="spd-banner-icon-fallback">🌀</div>}
                />
                <div>
                  <div className="spd-banner-title">정령의 시련</div>
                  <div className="spd-banner-sub">매일 속성이 변경됩니다</div>
                </div>
              </div>
              <button className="spd-back-btn" onClick={handleBack}>← 돌아가기</button>
            </div>
          </div>

          {loading ? <div className="spd-loading">로딩 중...</div> : elementalInfo ? (
            <>
              {/* Hero: altar image + element info */}
              <div className="el-hero">
                <div className="el-hero-img-wrap">
                  <SpdImg src="/special_dungeons/elem_altar.png" className="el-hero-img" />
                  <div className="el-hero-img-overlay" />
                  {/* Element orb overlay */}
                  <div className={`el-hero-orb ${elemKey}`}>
                    <SpdImg src={`/special_dungeons/elem_${elemKey}_icon.png`} className="el-hero-orb-img" />
                  </div>
                  <div className="el-hero-floor-label">
                    <div className="el-hero-tier-num">{clearedTier}<span>/5</span></div>
                    <div className="el-hero-tier-text">시련 클리어</div>
                  </div>
                </div>

                <div className="el-hero-stats">
                  {/* Today's element card */}
                  <div className={`el-element-card ${elemKey}`}>
                    <SpdImg src={`/special_dungeons/elem_${elemKey}_icon.png`} className="el-ec-icon" />
                    <div className="el-ec-info">
                      <div className="el-ec-label">오늘의 속성</div>
                      <div className="el-ec-name">{elem?.icon} {elem?.name}</div>
                    </div>
                  </div>

                  {/* Stats */}
                  <div className="el-stat-card">
                    <SpdImg src="/special_dungeons/elem_progress_orb.png" className="el-stat-bg" />
                    <div className="el-stat-content">
                      <div className="el-stat-icon">🏆</div>
                      <div className="el-stat-info">
                        <div className="el-stat-val">{clearedTier}<span>/5</span></div>
                        <div className="el-stat-label">클리어 티어</div>
                      </div>
                    </div>
                  </div>

                  <div className="el-stat-card">
                    <SpdImg src="/special_dungeons/elemental_card.png" className="el-stat-bg" />
                    <div className="el-stat-content">
                      <div className="el-stat-icon">💎</div>
                      <div className="el-stat-info">
                        <div className="el-stat-val">{clearedTier >= 5 ? '완료' : TIER_NAMES[clearedTier]}</div>
                        <div className="el-stat-label">다음 시련</div>
                      </div>
                    </div>
                  </div>

                  {/* Progress bar */}
                  <div className="el-progress-wrap">
                    <div className="el-progress-header">
                      <span>시련 진행도</span>
                      <span className="el-progress-pct">{Math.round(tierPct)}%</span>
                    </div>
                    <div className="el-progress-bar">
                      <div className="el-progress-fill" style={{ width: `${tierPct}%` }} />
                      {[1,2,3,4,5].map(t => (
                        <div
                          key={t}
                          className={`el-progress-mark${t <= clearedTier ? ' done' : ''}`}
                          style={{ left: `${(t / 5) * 100}%` }}
                        >
                          <span>{TIER_NAMES[t-1]}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>

              {/* Trial cards */}
              <div className="el-trial-list">
                {elementalInfo.trials.map(t => {
                  const cleared = t.tier <= clearedTier;
                  const canChallenge = t.tier === clearedTier + 1;
                  const locked = charState.level < t.requiredLevel || (!cleared && !canChallenge);
                  return (
                    <div
                      key={t.tier}
                      className={`el-trial-card${cleared ? ' cleared' : ''}${locked ? ' locked' : ''}${canChallenge && !locked ? ' active' : ''}`}
                      onClick={() => canChallenge && !locked && handleTrialChallenge(t)}
                    >
                      <div className="el-trial-img-wrap">
                        <SpdImg src={`/special_dungeons/elem_tier_${t.tier}.png`} className="el-trial-img" />
                        <div className="el-trial-img-overlay" />
                        <div className="el-trial-tier-badge" data-tier={t.tier}>
                          <span className="el-trial-tier-num">{cleared ? '✓' : t.tier}</span>
                          <span className="el-trial-tier-label">{TIER_NAMES[t.tier - 1]}</span>
                        </div>
                        {canChallenge && !locked && <div className={`el-trial-elem-tag ${elemKey}`}>{elem?.icon} {elem?.name}</div>}
                      </div>
                      <div className="el-trial-body">
                        <div className="el-trial-name">{t.name}</div>
                        <div className="el-trial-meta">Lv.{t.requiredLevel}+ · 몬스터 {t.monsterCount}마리</div>
                        <div className="el-trial-rewards">
                          <span className="el-trial-rw">✨ {t.expReward} EXP</span>
                          <span className="el-trial-rw mat">{t.materialCount}x {t.materialGrade}</span>
                        </div>
                        {cleared && <div className="el-trial-status cleared">클리어 완료</div>}
                        {canChallenge && !locked && (
                          <button className={`el-trial-btn ${elemKey}`}>
                            ⚔️ 도전하기
                          </button>
                        )}
                        {locked && <div className="el-trial-status locked">잠금</div>}
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* All cleared */}
              {clearedTier >= 5 && (
                <div className="el-complete-card">
                  <SpdImg src="/special_dungeons/elem_complete.png" className="el-complete-img" />
                  <div className="el-complete-overlay" />
                  <div className="el-complete-content">
                    <div className="el-complete-trophy">🌟</div>
                    <div className="el-complete-title">정령 마스터!</div>
                    <div className="el-complete-text">오늘의 모든 시련을 완료했습니다!<br/>내일 새로운 속성으로 다시 도전하세요.</div>
                  </div>
                </div>
              )}
            </>
          ) : null}
        </div>
        {renderPopup()}
        {renderRewardPopup()}
      </div>
    );
  }

  // ===== BOSS RAID VIEW =====
  if (view === 'boss_raid') {
    const clearedCount = bossList.filter(b => b.todayCleared).length;
    const attemptedCount = bossList.filter(b => b.todayAttempted || b.todayCleared).length;
    const totalBosses = bossList.length || 6;
    const clearPct = (clearedCount / totalBosses) * 100;
    return (
      <div className="spd-scene" style={{ '--spd-accent': '#f97316' }}>
        <div className="spd-map-bg">
          <SpdImg src="/special_dungeons/boss_raid_bg.png" className="spd-map-bg-img" />
          <div className="spd-map-bg-overlay" />
        </div>
        <div className="spd-detail-scene">
          <div className="spd-banner">
            <SpdImg src="/special_dungeons/boss_raid_banner.png" className="spd-banner-img" />
            <div className="spd-banner-overlay" />
            <div className="spd-banner-content">
              <div className="spd-banner-title-area">
                <SpdImg
                  src="/special_dungeons/boss_raid_icon.png"
                  className="spd-banner-icon"
                  fallback={<div className="spd-banner-icon-fallback">💀</div>}
                />
                <div>
                  <div className="spd-banner-title">보스 토벌전</div>
                  <div className="spd-banner-sub">각 보스 하루 1회 도전 가능</div>
                </div>
              </div>
              <button className="spd-back-btn" onClick={handleBack}>← 돌아가기</button>
            </div>
          </div>

          {loading ? <div className="spd-loading">로딩 중...</div> : (
            <>
              {/* Hero: arena image + stats */}
              <div className="br-hero">
                <div className="br-hero-img-wrap">
                  <SpdImg src="/special_dungeons/br_arena.png" className="br-hero-img" />
                  <div className="br-hero-img-overlay" />
                  <div className="br-hero-skull">💀</div>
                  <div className="br-hero-floor-label">
                    <div className="br-hero-clear-num">{clearedCount}<span>/{totalBosses}</span></div>
                    <div className="br-hero-clear-text">오늘 토벌</div>
                  </div>
                </div>

                <div className="br-hero-stats">
                  {/* Daily status card */}
                  <div className="br-daily-card">
                    <div className="br-daily-left">
                      <div className="br-daily-label">오늘의 토벌 현황</div>
                      <div className="br-daily-nums">
                        <span className="br-daily-cleared">{clearedCount} 클리어</span>
                        <span className="br-daily-sep">/</span>
                        <span className="br-daily-attempted">{attemptedCount} 도전</span>
                        <span className="br-daily-sep">/</span>
                        <span className="br-daily-total">{totalBosses} 전체</span>
                      </div>
                    </div>
                  </div>

                  {/* Stat cards */}
                  <div className="br-stat-card">
                    <SpdImg src="/special_dungeons/br_stat_kills.png" className="br-stat-bg" />
                    <div className="br-stat-content">
                      <div className="br-stat-icon">🏆</div>
                      <div className="br-stat-info">
                        <div className="br-stat-val">{clearedCount}<span>/{totalBosses}</span></div>
                        <div className="br-stat-label">토벌 완료</div>
                      </div>
                    </div>
                  </div>

                  <div className="br-stat-card">
                    <SpdImg src="/special_dungeons/br_stat_streak.png" className="br-stat-bg" />
                    <div className="br-stat-content">
                      <div className="br-stat-icon">🔥</div>
                      <div className="br-stat-info">
                        <div className="br-stat-val">{totalBosses - attemptedCount}</div>
                        <div className="br-stat-label">남은 도전</div>
                      </div>
                    </div>
                  </div>

                  {/* Progress bar */}
                  <div className="br-progress-wrap">
                    <div className="br-progress-header">
                      <span>토벌 진행도</span>
                      <span className="br-progress-pct">{Math.round(clearPct)}%</span>
                    </div>
                    <div className="br-progress-bar">
                      <div className="br-progress-fill" style={{ width: `${clearPct}%` }} />
                    </div>
                  </div>
                </div>
              </div>

              {/* Boss cards */}
              <div className="br-boss-list">
                {bossList.map((b, idx) => {
                  const locked = charState.level < b.requiredLevel;
                  const done = b.todayCleared || b.todayAttempted;
                  return (
                    <div
                      key={b.id}
                      className={`br-boss-card${locked ? ' locked' : ''}${done ? ' done' : ''}${!locked && !done ? ' active' : ''}`}
                      onClick={() => !locked && !done && handleBossChallenge(b)}
                    >
                      <div className="br-boss-img-wrap">
                        <SpdImg src={`/special_dungeons/br_scene_${idx + 1}.png`} className="br-boss-scene-img" />
                        <div className="br-boss-img-overlay" />
                        {/* Boss portrait circle */}
                        <div className="br-boss-portrait">
                          <SpdImg
                            src={`/special_dungeons/boss_${idx + 1}.png`}
                            className="br-boss-portrait-img"
                            fallback={<div className="br-boss-portrait-fallback">💀</div>}
                          />
                        </div>
                        <div className="br-boss-rank">#{idx + 1}</div>
                        {done && (
                          <div className={`br-boss-done-tag ${b.todayCleared ? 'success' : 'fail'}`}>
                            {b.todayCleared ? '클리어' : '실패'}
                          </div>
                        )}
                      </div>
                      <div className="br-boss-body">
                        <div className="br-boss-name">{b.name}</div>
                        <div className="br-boss-desc">{b.description}</div>
                        <div className="br-boss-stats">
                          <span className="br-bs">Lv.{b.requiredLevel}+</span>
                          <span className="br-bs">{b.monsterCount}마리</span>
                          <span className="br-bs gold">💰 {b.goldReward}</span>
                          <span className="br-bs exp">✨ {b.expReward}</span>
                        </div>
                        {!locked && !done && (
                          <button className="br-boss-btn">
                            ⚔️ 토벌 도전
                          </button>
                        )}
                        {done && (
                          <div className={`br-boss-result ${b.todayCleared ? 'success' : 'fail'}`}>
                            {b.todayCleared ? '✅ 오늘 토벌 완료' : '❌ 오늘 도전 완료 (실패)'}
                          </div>
                        )}
                        {locked && <div className="br-boss-locked">🔒 Lv.{b.requiredLevel} 이상 필요</div>}
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* All cleared */}
              {clearedCount >= totalBosses && (
                <div className="br-complete-card">
                  <SpdImg src="/special_dungeons/br_complete.png" className="br-complete-img" />
                  <div className="br-complete-overlay" />
                  <div className="br-complete-content">
                    <div className="br-complete-trophy">👑</div>
                    <div className="br-complete-title">전설의 토벌사!</div>
                    <div className="br-complete-text">오늘의 모든 보스를 토벌했습니다!<br/>내일 다시 도전하세요.</div>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
        {renderPopup()}
      </div>
    );
  }

  return null;
}

export default SpecialDungeonArea;
