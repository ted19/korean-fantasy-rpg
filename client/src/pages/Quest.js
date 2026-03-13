import React, { useState, useEffect, useCallback } from 'react';
import api from '../api';
import './Quest.css';

const CATEGORY_INFO = {
  main:        { label: '메인', icon: '📜', color: '#e94560' },
  daily:       { label: '일일', icon: '🔄', color: '#60a5fa' },
  bounty:      { label: '현상금', icon: '💰', color: '#fb923c' },
  achievement: { label: '업적', icon: '🏆', color: '#fbbf24' },
};

const TYPE_LABELS = {
  hunt: '사냥', hunt_location: '지역', level: '성장',
  clear_stage: '스테이지', clear_dungeon: '던전', collect_material: '수집',
};

const CHAPTER_NAMES = {
  1: '어둠의 시작',
  2: '동굴의 비밀',
  3: '확장되는 세계',
  4: '어둠의 심연',
  5: '최종 결전',
};

const NPC_MSGS = {
  main: [
    '메인 임무를 차례대로 완수하게. 자네의 이야기가 펼쳐질 것이야.',
    '메인 퀘스트는 순서대로 진행해야 하네. 서두르지 말고 차근차근.',
  ],
  daily: [
    '오늘의 임무를 확인하게. 매일 새로운 의뢰가 들어온다네.',
    '일일 퀘스트는 자정에 초기화되니 놓치지 말게.',
  ],
  bounty: [
    '현상금이 걸린 의뢰가 있다네. 실력을 보여주게.',
    '위험하지만 보상이 짭짤한 의뢰들이야. 한번 도전해보게.',
  ],
  achievement: [
    '업적은 자동으로 진행되니, 꾸준히 모험하면 되네.',
    '오랜 여정의 기록이지. 하나하나 달성해보게.',
  ],
};

function NpcImg({ src, className }) {
  const [err, setErr] = useState(false);
  if (err) return null;
  return <img src={src} alt="" className={className} onError={() => setErr(true)} />;
}

function Quest({ charState, onCharStateUpdate, onLog }) {
  const [category, setCategory] = useState('main');
  const [quests, setQuests] = useState([]);
  const [dailyResetMs, setDailyResetMs] = useState(0);
  const [npcMsg, setNpcMsg] = useState('모험가여, 의뢰가 있다네.');
  const [dailyTimer, setDailyTimer] = useState('');

  const loadData = useCallback(async () => {
    try {
      const res = await api.get('/quest/list');
      setQuests(res.data.quests || []);
      setDailyResetMs(res.data.dailyResetMs || 0);
    } catch {
      onLog('퀘스트 정보를 불러올 수 없습니다.', 'damage');
    }
  }, [onLog]);

  useEffect(() => { loadData(); }, [loadData]);

  useEffect(() => {
    const msgs = NPC_MSGS[category] || NPC_MSGS.main;
    setNpcMsg(msgs[Math.floor(Math.random() * msgs.length)]);
  }, [category]);

  // Daily timer countdown
  useEffect(() => {
    if (category !== 'daily') return;
    let remaining = dailyResetMs;
    const updateTimer = () => {
      if (remaining <= 0) { setDailyTimer('00:00:00'); return; }
      const h = Math.floor(remaining / 3600000);
      const m = Math.floor((remaining % 3600000) / 60000);
      const s = Math.floor((remaining % 60000) / 1000);
      setDailyTimer(`${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`);
      remaining -= 1000;
    };
    updateTimer();
    const iv = setInterval(updateTimer, 1000);
    return () => clearInterval(iv);
  }, [category, dailyResetMs]);

  const handleAccept = async (questId) => {
    try {
      const res = await api.post('/quest/accept', { questId });
      onLog(res.data.message, 'system');
      loadData();
    } catch (err) {
      onLog(err.response?.data?.message || '수락 실패', 'damage');
    }
  };

  const handleAcceptAll = async (questIds) => {
    try {
      const res = await api.post('/quest/accept-all', { questIds });
      onLog(res.data.message, 'system');
      loadData();
    } catch (err) {
      onLog(err.response?.data?.message || '일괄 수락 실패', 'damage');
    }
  };

  const [rewardPopup, setRewardPopup] = useState(null);

  const handleReward = async (questId) => {
    try {
      const res = await api.post('/quest/reward', { questId });
      onLog(res.data.message, 'level');
      const c = res.data.character;
      onCharStateUpdate({
        level: c.level, exp: c.exp, gold: c.gold,
        maxHp: c.hp, maxMp: c.mp,
        attack: c.attack, defense: c.defense,
        currentHp: c.current_hp ?? c.hp,
        currentMp: c.current_mp ?? c.mp,
      });
      if (res.data.reward) {
        setRewardPopup(res.data.reward);
      }
      loadData();
    } catch (err) {
      onLog(err.response?.data?.message || '보상 수령 실패', 'damage');
    }
  };

  const handleAbandon = async (questId) => {
    try {
      await api.post('/quest/abandon', { questId });
      onLog('퀘스트를 포기했습니다.', 'system');
      loadData();
    } catch (err) {
      onLog(err.response?.data?.message || '포기 실패', 'damage');
    }
  };

  const catQuests = quests.filter(q => q.category === category);

  // Counts per category
  const getCatCounts = (cat) => {
    const qs = quests.filter(q => q.category === cat);
    const completed = qs.filter(q => q.status === 'completed').length;
    const active = qs.filter(q => q.status === 'active').length;
    return { total: qs.length, completed, active };
  };

  const renderRewards = (q) => (
    <>
      {q.rewardExp > 0 && <span className="qr-tag exp">EXP +{q.rewardExp}</span>}
      {q.rewardGold > 0 && <span className="qr-tag gold">Gold +{q.rewardGold}</span>}
      {q.rewardItemName && <span className="qr-tag item">{q.rewardItemName} x{q.rewardItemQty}</span>}
      {q.rewardItemId && !q.rewardItemName && <span className="qr-tag item">아이템 x{q.rewardItemQty}</span>}
    </>
  );

  const renderActionBtn = (q) => {
    if (q.status === 'completed') return <button className="quest-btn reward" onClick={(e) => { e.stopPropagation(); handleReward(q.id); }}>보상 수령</button>;
    if (q.status === 'active') return <button className="quest-btn abandon" onClick={(e) => { e.stopPropagation(); handleAbandon(q.id); }}>포기</button>;
    if (q.status === 'available') return <button className="quest-btn accept" onClick={(e) => { e.stopPropagation(); handleAccept(q.id); }}>수락</button>;
    return null;
  };

  const progressPct = (q) => {
    if (q.status === 'rewarded') return 100;
    if (q.targetCount <= 0) return 0;
    return Math.min(100, (q.progress / q.targetCount) * 100);
  };

  // ========== MAIN QUEST ROADMAP ==========
  const renderMainQuests = () => {
    const chapters = {};
    catQuests.forEach(q => {
      if (!chapters[q.chapter]) chapters[q.chapter] = [];
      chapters[q.chapter].push(q);
    });

    const chapterKeys = Object.keys(chapters).map(Number).sort((a,b) => a - b);
    if (chapterKeys.length === 0) return <div className="quest-empty"><div className="quest-empty-icon">📜</div>메인 퀘스트가 없습니다.</div>;

    return (
      <div className="quest-main-roadmap">
        {chapterKeys.map(ch => {
          const cQuests = chapters[ch];
          const rewarded = cQuests.filter(q => q.status === 'rewarded').length;
          const completed = cQuests.filter(q => q.status === 'completed').length;

          return (
            <div key={ch} className="quest-chapter-group">
              <div className="quest-chapter-header">
                <div className="quest-chapter-number">{ch}</div>
                <div className="quest-chapter-info">
                  <div className="quest-chapter-title">Chapter {ch}: {CHAPTER_NAMES[ch] || `제 ${ch}장`}</div>
                  <div className="quest-chapter-sub">{rewarded}/{cQuests.length} 완료</div>
                  <div className="quest-chapter-progress-bar">
                    <div className="quest-chapter-progress-fill" style={{ width: `${(rewarded / cQuests.length) * 100}%` }} />
                  </div>
                </div>
                {completed > 0 && <span className="quest-chapter-progress" style={{ color: '#ffa502' }}>{completed}개 보상 대기</span>}
              </div>
              <div className="quest-chapter-body">
                {cQuests.map(q => {
                  const isLocked = q.status === 'locked_level' || q.status === 'locked_prereq';
                  const dotClass = q.status === 'rewarded' ? 'rewarded'
                    : q.status === 'completed' ? 'completed'
                    : q.status === 'active' ? 'active' : '';

                  return (
                    <div key={q.id} className={`quest-main-node ${isLocked ? 'locked' : ''}`}>
                      <div className={`quest-main-dot ${dotClass}`}>
                        {q.status === 'rewarded' ? '✓' : (q.icon || q.sortOrder)}
                      </div>
                      <div className={`quest-main-card ${q.status === 'completed' ? 'completed' : ''} ${q.status === 'rewarded' ? 'rewarded' : ''}`}>
                        <div className="quest-main-title-row">
                          <span className="quest-main-title">{q.title}</span>
                          {q.status !== 'available' && q.status !== 'locked_level' && q.status !== 'locked_prereq' && (
                            <span className={`quest-main-status-tag ${q.status}`}>
                              {q.status === 'active' ? '진행중' : q.status === 'completed' ? '완료' : '수령완료'}
                            </span>
                          )}
                          <span className={`quest-type-tag ${q.type}`}>{TYPE_LABELS[q.type]}</span>
                        </div>
                        <div className="quest-main-desc">{q.description}</div>
                        {q.status === 'active' && (
                          <div className="quest-main-progress">
                            <div className="quest-main-progress-bar">
                              <div className="quest-main-progress-fill" style={{ width: `${progressPct(q)}%` }} />
                            </div>
                            <span className="quest-main-progress-text">{q.progress}/{q.targetCount}</span>
                          </div>
                        )}
                        <div className="quest-main-bottom">
                          <div className="quest-main-rewards">{renderRewards(q)}</div>
                          {renderActionBtn(q)}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    );
  };

  // ========== CARD LIST (Daily/Bounty/Achievement) ==========
  const renderCardList = () => {
    if (catQuests.length === 0) {
      const info = CATEGORY_INFO[category];
      return <div className="quest-empty"><div className="quest-empty-icon">{info.icon}</div>{info.label} 퀘스트가 없습니다.</div>;
    }

    // For daily/bounty: show accept-all bar if there are available quests
    const availableIds = catQuests.filter(q => q.status === 'available').map(q => q.id);

    // Sort: completed > active > available > locked > rewarded
    const sortOrder = { completed: 0, active: 1, available: 2, locked_level: 3, locked_prereq: 4, rewarded: 5 };
    const sorted = [...catQuests].sort((a, b) => (sortOrder[a.status] ?? 9) - (sortOrder[b.status] ?? 9) || a.sortOrder - b.sortOrder);

    return (
      <>
        {availableIds.length > 1 && (
          <div className="quest-accept-bar">
            <span className="quest-accept-bar-text">수락 가능한 퀘스트 {availableIds.length}개</span>
            <button className="quest-accept-all-btn" onClick={() => handleAcceptAll(availableIds)}>전체 수락</button>
          </div>
        )}
        <div className="quest-card-list">
          {sorted.map(q => {
            const isLocked = q.status === 'locked_level' || q.status === 'locked_prereq';
            const isActive = q.status === 'active';
            const isCompleted = q.status === 'completed';
            const isRewarded = q.status === 'rewarded';
            const showProgress = isActive || isCompleted || isRewarded;

            return (
              <div key={q.id} className={`quest-card ${isCompleted ? 'completed' : ''} ${isRewarded ? 'rewarded' : ''} ${isLocked ? 'locked' : ''} ${category === 'achievement' ? 'quest-achievement-card' : ''}`}>
                <div className="quest-card-top">
                  <div className="quest-card-icon">{q.icon || CATEGORY_INFO[category].icon}</div>
                  <div className="quest-card-info">
                    <div className="quest-card-title">{q.title}</div>
                    <div className="quest-card-desc">{q.description}</div>
                  </div>
                  <span className={`quest-type-tag ${q.type}`}>{TYPE_LABELS[q.type]}</span>
                </div>
                {showProgress && (
                  <div className="quest-card-progress">
                    <div className="quest-card-progress-bar">
                      <div className={`quest-card-progress-fill ${isCompleted || isRewarded ? 'complete' : category}`} style={{ width: `${progressPct(q)}%` }} />
                    </div>
                    <span className="quest-card-progress-text">{isRewarded ? q.targetCount : q.progress}/{q.targetCount}</span>
                  </div>
                )}
                <div className="quest-card-bottom">
                  <div className="quest-card-rewards">
                    {renderRewards(q)}
                    {q.requiredLevel > 1 && <span className="quest-lv-req">Lv.{q.requiredLevel}+</span>}
                  </div>
                  {renderActionBtn(q)}
                </div>
              </div>
            );
          })}
        </div>
      </>
    );
  };

  return (
    <div className="quest-scene">
      <div className="quest-scene-bg" />

      {/* Banner */}
      <div className="quest-banner">
        <NpcImg src="/village/guild_banner.png" className="quest-banner-img" />
        <div className="quest-banner-overlay" />
        <div className="quest-banner-title">모험가 길드</div>
      </div>

      {/* NPC */}
      <div className="quest-npc">
        <div className="quest-npc-portrait-wrap">
          <NpcImg src="/village/guildmaster_portrait.png" className="quest-npc-portrait" />
        </div>
        <div className="quest-npc-speech">
          <div className="quest-npc-name">길드마스터 <span className="npc-name-sub">이 서연</span></div>
          <div className="quest-npc-msg">{npcMsg}</div>
        </div>
      </div>

      {/* Category Nav */}
      <div className="quest-category-nav">
        {Object.entries(CATEGORY_INFO).map(([key, info]) => {
          const counts = getCatCounts(key);
          const hasCompleted = counts.completed > 0;
          return (
            <button
              key={key}
              className={`quest-category-btn ${category === key ? 'active' : ''}`}
              style={{ '--cat-color': info.color }}
              onClick={() => setCategory(key)}
            >
              <span className="quest-cat-icon">{info.icon}</span>
              {info.label}
              <span className={`quest-cat-badge ${hasCompleted ? 'has-completed' : ''}`}>
                {hasCompleted ? counts.completed : counts.active || counts.total}
              </span>
            </button>
          );
        })}
      </div>

      {/* Daily Timer */}
      {category === 'daily' && (
        <div className="quest-daily-timer">
          <span className="quest-daily-timer-icon">⏰</span>
          초기화까지
          <span className="quest-daily-timer-value">{dailyTimer}</span>
        </div>
      )}

      {/* Quest Content */}
      <div className="quest-scroll">
        {category === 'main' ? renderMainQuests() : renderCardList()}
      </div>

      {/* 보상 수령 팝업 */}
      {rewardPopup && (
        <div className="qreward-overlay" onClick={() => setRewardPopup(null)}>
          <div className="qreward-popup" onClick={e => e.stopPropagation()}>
            {/* 배경 */}
            <div className="qreward-bg">
              <img src="/ui/quest/reward_bg.png" alt="" className="qreward-bg-img" onError={e => { e.target.style.display = 'none'; }} />
              <div className="qreward-bg-overlay" />
            </div>
            {/* 파티클 */}
            <div className="qreward-particles">
              <img src="/ui/quest/reward_particles.png" alt="" className="qreward-particles-img" onError={e => { e.target.style.display = 'none'; }} />
              {[...Array(14)].map((_, i) => <div key={i} className="qreward-particle" style={{ '--pi': i }} />)}
            </div>
            {/* 빛줄기 */}
            <div className="qreward-light-rays" />
            {/* 콘텐츠 */}
            <div className="qreward-content">
              {/* 프레임 */}
              <img src="/ui/quest/reward_frame.png" alt="" className="qreward-frame" onError={e => { e.target.style.display = 'none'; }} />
              {/* 아이콘 */}
              <div className="qreward-icon-wrap">
                <img src="/ui/quest/reward_icon.png" alt="" className="qreward-icon-img" onError={e => { e.target.textContent = '🎁'; }} />
                <div className="qreward-icon-glow" />
                <div className="qreward-icon-sparkles">
                  {[...Array(6)].map((_, i) => <span key={i} style={{ '--si': i }} />)}
                </div>
              </div>
              {/* 타이틀 */}
              <div className="qreward-title">보상 획득!</div>
              <div className="qreward-quest-name">{rewardPopup.questTitle}</div>
              {/* 배너 */}
              <div className="qreward-banner-wrap">
                <img src="/ui/quest/reward_banner.png" alt="" onError={e => { e.target.style.display = 'none'; }} />
              </div>
              {/* 보상 목록 */}
              <div className="qreward-rewards">
                {rewardPopup.exp > 0 && (
                  <div className="qreward-row">
                    <span className="qreward-row-icon">⭐</span>
                    <span className="qreward-row-label">경험치</span>
                    <span className="qreward-row-val exp">+{rewardPopup.exp.toLocaleString()}</span>
                  </div>
                )}
                {rewardPopup.gold > 0 && (
                  <div className="qreward-row">
                    <span className="qreward-row-icon">💰</span>
                    <span className="qreward-row-label">골드</span>
                    <span className="qreward-row-val gold">+{rewardPopup.gold.toLocaleString()}</span>
                  </div>
                )}
                {rewardPopup.itemName && (
                  <div className="qreward-row">
                    <span className="qreward-row-icon">📦</span>
                    <span className="qreward-row-label">{rewardPopup.itemName}</span>
                    <span className="qreward-row-val item">x{rewardPopup.itemQty}</span>
                  </div>
                )}
                {rewardPopup.levelUp && (
                  <div className="qreward-row levelup">
                    <span className="qreward-row-icon">🎉</span>
                    <span className="qreward-row-label">레벨 업!</span>
                    <span className="qreward-row-val level">Lv.{rewardPopup.levelUp}</span>
                  </div>
                )}
              </div>
              {/* 닫기 버튼 */}
              <button className="qreward-close-btn" onClick={() => setRewardPopup(null)}>
                <span className="qreward-close-shimmer" />
                <span className="qreward-close-text">확인</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default Quest;
