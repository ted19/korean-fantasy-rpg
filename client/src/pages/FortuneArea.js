import React, { useState, useEffect, useCallback } from 'react';
import api from '../api';
import './FortuneArea.css';

const BUFF_LABELS = {
  attack: '공격력', defense: '방어력', gold: '골드 획득',
  crit: '치명타율', regen: 'HP 회복', all: '공격·방어·골드',
};

const NPC_MESSAGES = {
  daily: [
    '오늘의 운명을 점쳐드리겠습니다... 손을 내밀어 보십시오.',
    '하늘의 별이 당신의 운명을 속삭이고 있습니다.',
    '운명의 실은 이미 짜여져 있습니다. 확인해 보시겠습니까?',
  ],
  divination: [
    '점괘를 통해 힘의 기운을 불러올 수 있습니다.',
    '올바른 점괘는 전장에서 큰 힘이 됩니다.',
    '어떤 기운을 끌어당기고 싶으십니까?',
  ],
  talisman: [
    '부적에는 강력한 주술이 깃들어 있습니다.',
    '좋은 부적 하나면 전투가 한결 수월해지죠.',
    '어떤 부적을 원하십니까? 각각 고유한 힘이 있습니다.',
  ],
  tarot: [
    '78장의 타로 카드에는 운명의 비밀이 담겨 있습니다...',
    '원 카드, 쓰리 카드, 켈틱 크로스... 어떤 스프레드로 운명을 읽으시겠습니까?',
    '카드를 뒤집어 운명을 마주하시겠습니까?',
  ],
};

const SUIT_LABELS = { major: '메이저', wands: '지팡이', cups: '성배', swords: '검', pentacles: '동전' };
const SUIT_ICONS = { major: '⭐', wands: '🔥', cups: '💧', swords: '⚔️', pentacles: '🪙' };
const SPREAD_ICONS = { one: '🎴', three: '🔮', celtic: '✦' };

function NpcImg({ className }) {
  const [err, setErr] = useState(false);
  if (err) return <span className={className}>🔮</span>;
  return <img src="/village/fortune_portrait.png" alt="운명술사" className={className} onError={() => setErr(true)} />;
}

function formatCooldown(ms) {
  if (!ms || ms <= 0) return null;
  const totalSec = Math.ceil(ms / 1000);
  const h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const s = totalSec % 60;
  if (h > 0) return `${h}시간 ${m}분`;
  if (m > 0) return `${m}분 ${s}초`;
  return `${s}초`;
}

function FortuneArea({ charState, onCharStateUpdate, onLog }) {
  const [tab, setTab] = useState('daily');
  const [npcMsg, setNpcMsg] = useState('');
  const [loading, setLoading] = useState(false);

  // Daily fortune
  const [todayFortune, setTodayFortune] = useState(null);
  const [drawing, setDrawing] = useState(false);
  const [drawResult, setDrawResult] = useState(null);

  // Divinations
  const [divinations, setDivinations] = useState([]);

  // Talismans
  const [talismans, setTalismans] = useState([]);

  // Tarot
  const [tarotStatus, setTarotStatus] = useState(null);
  const [tarotPhase, setTarotPhase] = useState('select'); // select | shuffling | spread | reading
  const [selectedSpread, setSelectedSpread] = useState(null);
  const [tarotResult, setTarotResult] = useState(null);
  const [tarotFlipped, setTarotFlipped] = useState([]);
  const [tarotAllRevealed, setTarotAllRevealed] = useState(false);

  // Active buffs
  const [buffs, setBuffs] = useState([]);

  // Cooldowns
  const [cooldowns, setCooldowns] = useState(null);

  const updateNpcMsg = useCallback((t) => {
    const msgs = NPC_MESSAGES[t] || NPC_MESSAGES.daily;
    setNpcMsg(msgs[Math.floor(Math.random() * msgs.length)]);
  }, []);

  useEffect(() => { updateNpcMsg(tab); }, [tab, updateNpcMsg]);

  const loadDaily = useCallback(async () => {
    try {
      const res = await api.get('/fortune/daily');
      setTodayFortune(res.data.todayFortune);
    } catch {}
  }, []);

  const loadDivinations = useCallback(async () => {
    try {
      const res = await api.get('/fortune/divinations');
      setDivinations(res.data.divinations);
    } catch {}
  }, []);

  const loadTalismans = useCallback(async () => {
    try {
      const res = await api.get('/fortune/talismans');
      setTalismans(res.data.talismans);
    } catch {}
  }, []);

  const loadBuffs = useCallback(async () => {
    try {
      const res = await api.get('/fortune/buffs');
      setBuffs(res.data.buffs);
    } catch {}
  }, []);

  const loadTarotStatus = useCallback(async () => {
    try {
      const res = await api.get('/fortune/tarot/status');
      setTarotStatus(res.data);
    } catch {}
  }, []);

  const loadCooldowns = useCallback(async () => {
    try {
      const res = await api.get('/fortune/cooldowns');
      setCooldowns(res.data);
    } catch {}
  }, []);

  useEffect(() => {
    loadDaily();
    loadDivinations();
    loadTalismans();
    loadBuffs();
    loadTarotStatus();
    loadCooldowns();
  }, [loadDaily, loadDivinations, loadTalismans, loadBuffs, loadTarotStatus, loadCooldowns]);

  // 쿨타임 카운트다운 (매초 갱신)
  useEffect(() => {
    if (!cooldowns) return;
    const timer = setInterval(() => {
      setCooldowns(prev => {
        if (!prev) return prev;
        const update = {};
        for (const key of ['daily', 'divination', 'tarot']) {
          const cd = prev[key];
          if (cd && cd.cooldown > 0) {
            const remaining = Math.max(0, cd.cooldown - 1000);
            update[key] = { cooldown: remaining, available: remaining === 0 };
          } else {
            update[key] = cd;
          }
        }
        return update;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, [cooldowns !== null]); // eslint-disable-line

  const handleDrawFortune = async () => {
    if (loading || todayFortune) return;
    setDrawing(true);
    setDrawResult(null);
    setLoading(true);

    // 연출용 딜레이
    await new Promise(r => setTimeout(r, 1500));

    try {
      const res = await api.post('/fortune/daily');
      setDrawResult(res.data.fortune);
      setTodayFortune(res.data.fortune);
      setNpcMsg(res.data.fortune.fortune_msg);
      onLog(res.data.message, 'heal');
      loadBuffs();
      loadCooldowns();
    } catch (err) {
      onLog(err.response?.data?.message || '운세 실패', 'damage');
    }
    setLoading(false);
    setTimeout(() => setDrawing(false), 500);
  };

  const handleDivination = async (divId) => {
    if (loading) return;
    setLoading(true);
    try {
      const res = await api.post('/fortune/divination', { divId });
      onLog(res.data.message, 'heal');
      onCharStateUpdate({ gold: res.data.gold });
      setNpcMsg(res.data.message);
      loadBuffs();
      loadCooldowns();
    } catch (err) {
      onLog(err.response?.data?.message || '점괘 실패', 'damage');
      if (err.response?.data?.message) setNpcMsg(err.response.data.message);
    }
    setLoading(false);
  };

  const handleTalisman = async (talismanId) => {
    if (loading) return;
    setLoading(true);
    try {
      const res = await api.post('/fortune/talisman', { talismanId });
      onLog(res.data.message, 'heal');
      onCharStateUpdate({ gold: res.data.gold });
      setNpcMsg(res.data.message);
      loadBuffs();
      loadCooldowns();
    } catch (err) {
      onLog(err.response?.data?.message || '부적 구매 실패', 'damage');
      if (err.response?.data?.message) setNpcMsg(err.response.data.message);
    }
    setLoading(false);
  };

  const handleTarotDraw = async (spreadType) => {
    if (loading) return;
    setLoading(true);
    setSelectedSpread(spreadType);
    setTarotPhase('shuffling');
    setTarotResult(null);
    setTarotFlipped([]);
    setTarotAllRevealed(false);
    setNpcMsg('78장의 카드를 섞고 있습니다... 운명이 당신을 부릅니다.');

    // 셔플 연출
    await new Promise(r => setTimeout(r, 2000));

    try {
      const res = await api.post('/fortune/tarot/draw', { spreadType });
      setTarotResult(res.data);
      setTarotFlipped(new Array(res.data.spread.length).fill(false));
      setTarotPhase('spread');
      onCharStateUpdate({ gold: res.data.gold });
      setNpcMsg('카드가 펼쳐졌습니다... 하나씩 뒤집어 운명을 확인하세요.');
      loadTarotStatus();
      loadBuffs();
      loadCooldowns();
    } catch (err) {
      onLog(err.response?.data?.message || '타로 점술 실패', 'damage');
      if (err.response?.data?.message) setNpcMsg(err.response.data.message);
      setTarotPhase('select');
    }
    setLoading(false);
  };

  const flipCard = (idx) => {
    if (tarotFlipped[idx]) return;
    const next = [...tarotFlipped];
    next[idx] = true;
    setTarotFlipped(next);
    if (next.every(Boolean)) {
      setTarotAllRevealed(true);
      setTarotPhase('reading');
      if (tarotResult) {
        const bc = tarotResult.buffCard;
        const dir = bc.reversed ? '역방향' : '정방향';
        setNpcMsg(`${bc.name} (${dir}) — ${BUFF_LABELS[bc.buff_type] || bc.buff_type} +${bc.buff_value}%의 기운이 ${bc.duration}전투 동안 깃듭니다.`);
        onLog(tarotResult.message, 'heal');
      }
    }
  };

  const resetTarot = () => {
    setTarotPhase('select');
    setTarotResult(null);
    setSelectedSpread(null);
    setTarotFlipped([]);
    setTarotAllRevealed(false);
  };

  const gold = charState.gold || 0;

  return (
    <div className="facility-page fortune-page">
      {/* 배너 */}
      <div className="facility-banner">
        <img src="/village/fortune_banner.png" alt="" className="facility-banner-img" onError={(e) => { e.target.style.display='none'; }} />
        <div className="facility-banner-overlay" />
        <div className="facility-banner-title">운명술사의 집</div>
      </div>

      {/* NPC */}
      <div className="facility-npc">
        <div className="facility-npc-portrait-wrap">
          <NpcImg className="facility-npc-portrait" />
        </div>
        <div className="facility-npc-speech">
          <div className="facility-npc-name">운명술사 서린</div>
          <div className="facility-npc-msg">{npcMsg}</div>
        </div>
        <div className="facility-gold">{gold.toLocaleString()} G</div>
      </div>

      {/* 활성 버프 표시 */}
      {buffs.length > 0 && (
        <div className="fort-buffs-bar">
          <span className="fort-buffs-label">활성 효과</span>
          <div className="fort-buffs-list">
            {buffs.map(b => (
              <div key={b.id} className="fort-buff-pill">
                <span className="fort-buff-icon">{b.icon}</span>
                <span className="fort-buff-name">{BUFF_LABELS[b.buff_type] || b.buff_type} +{b.buff_value}%</span>
                <span className="fort-buff-remain">{b.remaining_battles}전투</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 탭 */}
      <div className="facility-tabs">
        {[
          { id: 'daily', label: '오늘의 운세', cdKey: 'daily' },
          { id: 'divination', label: '점괘', cdKey: 'divination' },
          { id: 'talisman', label: '부적' },
          { id: 'tarot', label: '🃏 타로', cdKey: 'tarot' },
        ].map(t => {
          const cd = t.cdKey && cooldowns?.[t.cdKey];
          const onCd = cd && cd.cooldown > 0;
          return (
            <button
              key={t.id}
              className={`facility-tab${tab === t.id ? ' active' : ''}${onCd ? ' on-cooldown' : ''}`}
              onClick={() => { setTab(t.id); setDrawResult(null); }}
            >
              {t.label}
              {onCd && <span className="tab-cd-dot" />}
            </button>
          );
        })}
      </div>

      {/* 오늘의 운세 탭 */}
      {tab === 'daily' && (
        <div className="fort-daily">
          {todayFortune ? (
            <div className="fort-daily-result">
              <div className="fort-result-icon" style={{ color: todayFortune.color }}>{todayFortune.icon}</div>
              <div className="fort-result-grade" style={{ color: todayFortune.color }}>{todayFortune.fortune_grade}</div>
              <div className="fort-result-msg">{todayFortune.fortune_msg}</div>
              {todayFortune.buff_type && (
                <div className="fort-result-buff">
                  {BUFF_LABELS[todayFortune.buff_type]} +{todayFortune.buff_value}% ({todayFortune.remaining_battles}전투 남음)
                </div>
              )}
              <div className="fort-result-note">
                {cooldowns?.daily?.cooldown > 0
                  ? `다음 운세까지 ${formatCooldown(cooldowns.daily.cooldown)}`
                  : '내일 다시 운세를 확인할 수 있습니다.'}
              </div>
            </div>
          ) : (
            <div className="fort-daily-draw">
              <div className={`fort-draw-orb${drawing ? ' spinning' : ''}`}>
                <span>🔮</span>
              </div>
              <div className="fort-draw-text">
                {drawing ? '운명의 실을 읽고 있습니다...' : '수정구에 손을 대어 오늘의 운세를 확인하세요.'}
              </div>
              <button
                className="fort-draw-btn"
                disabled={loading || drawing}
                onClick={handleDrawFortune}
              >
                {drawing ? '점술 중...' : '무료 · 오늘의 운세 보기'}
              </button>
            </div>
          )}
        </div>
      )}

      {/* 점괘 탭 */}
      {tab === 'divination' && (
        <div className="fort-grid">
          {cooldowns?.divination?.cooldown > 0 && (
            <div className="fort-cooldown-banner">
              <span className="fort-cd-icon">⏳</span>
              다음 점괘까지 <strong>{formatCooldown(cooldowns.divination.cooldown)}</strong>
            </div>
          )}
          {divinations.map(d => {
            const onCd = cooldowns?.divination?.cooldown > 0;
            return (
              <div key={d.id} className={`fort-card${onCd ? ' on-cooldown' : ''}`}>
                <div className="fort-card-icon">{d.icon}</div>
                <div className="fort-card-name">{d.name}</div>
                <div className="fort-card-desc">{d.desc}</div>
                <div className="fort-card-effect">
                  {BUFF_LABELS[d.buff_type]} +{d.buff_value}% · {d.duration}전투
                </div>
                <button
                  className="fort-card-btn"
                  disabled={loading || gold < d.price || onCd}
                  onClick={() => handleDivination(d.id)}
                >
                  {onCd ? '쿨타임 중' : gold < d.price ? '골드 부족' : `${d.price.toLocaleString()}G`}
                </button>
              </div>
            );
          })}
        </div>
      )}

      {/* 부적 탭 */}
      {tab === 'talisman' && (
        <div className="fort-grid">
          {talismans.map(t => (
            <div key={t.id} className={`fort-card ${t.grade === '희귀' ? 'rare' : ''}`}>
              <div className="fort-card-icon">{t.icon}</div>
              {t.grade === '희귀' && <span className="fort-card-badge">희귀</span>}
              <div className="fort-card-name">{t.name}</div>
              <div className="fort-card-desc">{t.desc}</div>
              <div className="fort-card-effect">
                {BUFF_LABELS[t.buff_type]} +{t.buff_value}% · {t.duration}전투
              </div>
              <button
                className="fort-card-btn"
                disabled={loading || gold < t.price}
                onClick={() => handleTalisman(t.id)}
              >
                {gold < t.price ? '골드 부족' : `${t.price.toLocaleString()}G`}
              </button>
            </div>
          ))}
        </div>
      )}

      {/* 타로 탭 */}
      {tab === 'tarot' && (
        <div className="tarot-tab">

          {/* Phase: 스프레드 선택 */}
          {tarotPhase === 'select' && (
            <div className="tarot-select-phase">
              {cooldowns?.tarot?.cooldown > 0 && (
                <div className="fort-cooldown-banner">
                  <span className="fort-cd-icon">⏳</span>
                  다음 타로 점술까지 <strong>{formatCooldown(cooldowns.tarot.cooldown)}</strong>
                </div>
              )}
              <div className="tarot-deck-display">
                <div className="tarot-deck">
                  <img src="/tarot/back.png" alt="타로 카드 덱" className="tarot-deck-img" />
                  <div className="tarot-deck-shadow" />
                  <div className="tarot-deck-shadow second" />
                </div>
                <div className="tarot-deck-label">78장의 타로 덱</div>
              </div>
              <div className="tarot-spread-select">
                <div className="tarot-select-title">스프레드를 선택하세요</div>
                {!tarotStatus && <div className="tarot-loading-msg">점술 정보를 불러오는 중...</div>}
                <div className="tarot-spread-options">
                  {tarotStatus?.spreads?.map(s => {
                    const tarotOnCd = cooldowns?.tarot?.cooldown > 0;
                    const disabled = loading || s.remaining <= 0 || gold < s.cost || tarotOnCd;
                    return (
                      <div key={s.id} className={`tarot-spread-option${disabled ? ' disabled' : ''}`} onClick={() => !disabled && handleTarotDraw(s.id)}>
                        <div className="tso-header">
                          <span className="tso-icon">{SPREAD_ICONS[s.id] || '🃏'}</span>
                          <span className="tso-name">{s.name}</span>
                          <span className="tso-cards">{s.cardCount}장</span>
                        </div>
                        <div className="tso-desc">{s.desc}</div>
                        <div className="tso-positions">
                          {s.positions.map((p, i) => (
                            <span key={i} className="tso-pos-pill">{p.label}</span>
                          ))}
                        </div>
                        <div className="tso-footer">
                          <span className="tso-cost">{s.cost.toLocaleString()}G</span>
                          <span className={`tso-remain${s.remaining <= 0 ? ' tso-remain-zero' : ''}`}>
                            {s.remaining <= 0 ? '오늘 소진' : `남은 횟수 ${s.remaining}/${s.maxPerDay}`}
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          )}

          {/* Phase: 셔플 중 */}
          {tarotPhase === 'shuffling' && (
            <div className="tarot-shuffle-phase">
              <div className="tarot-shuffle-cards">
                {[0,1,2,3,4,5,6].map(i => (
                  <div key={i} className="tarot-shuffle-card" style={{ animationDelay: `${i * 0.12}s` }}>
                    <img src="/tarot/back.png" alt="" />
                  </div>
                ))}
              </div>
              <div className="tarot-shuffle-text">
                {selectedSpread && tarotStatus?.spreads?.find(s => s.id === selectedSpread)?.name} — 78장의 카드를 섞는 중...
              </div>
            </div>
          )}

          {/* Phase: 스프레드 (카드 뒤집기) */}
          {tarotPhase === 'spread' && tarotResult && (() => {
            const flippedCount = tarotFlipped.filter(Boolean).length;
            const totalCards = tarotFlipped.length;
            return (
            <div className="tarot-spread">
              <div className="tarot-spread-header">
                <span className="tarot-spread-header-name">{tarotResult.spreadDef?.name}</span>
                <span className="tarot-spread-header-progress">{flippedCount} / {totalCards}</span>
              </div>
              <div className={`tarot-spread-cards count-${totalCards}`}>
                {tarotResult.spread.map((card, idx) => (
                  <div key={idx} className="tarot-card-slot">
                    <div className="tarot-spread-label">{card.position}</div>
                    <div
                      className={`tarot-card-flip${tarotFlipped[idx] ? ' flipped' : ''}${card.reversed && tarotFlipped[idx] ? ' reversed' : ''}`}
                      onClick={() => flipCard(idx)}
                    >
                      <div className="tarot-card-inner">
                        <div className="tarot-card-front">
                          <img src="/tarot/back.png" alt="카드 뒷면" />
                        </div>
                        <div className="tarot-card-back">
                          <img src={`/tarot/${card.index}.png`} alt={card.name} className={card.reversed ? 'reversed-img' : ''} />
                        </div>
                      </div>
                    </div>
                    {tarotFlipped[idx] && (
                      <div className="tarot-card-info">
                        <div className="tarot-card-name">
                          {card.name}
                          {card.suit && card.suit !== 'major' && (
                            <span className="tarot-card-suit">{SUIT_ICONS[card.suit]}</span>
                          )}
                        </div>
                        <div className="tarot-card-dir" style={{ color: card.reversed ? '#f87171' : '#4ade80' }}>
                          {card.reversed ? '↓ 역방향' : '↑ 정방향'}
                        </div>
                        <div className="tarot-card-keyword">
                          {card.reversed ? card.reversedText : card.upright}
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
              {!tarotAllRevealed && (
                <div className="tarot-hint">카드를 터치하여 운명을 확인하세요</div>
              )}
            </div>
            );
          })()}

          {/* Phase: 리딩 결과 */}
          {tarotPhase === 'reading' && tarotResult && (
            <div className="tarot-reading-phase">
              {/* 카드 미니뷰 */}
              <div className="tarot-mini-spread">
                {tarotResult.spread.map((card, idx) => (
                  <div key={idx} className="tarot-mini-card">
                    <img src={`/tarot/${card.index}.png`} alt={card.name} className={card.reversed ? 'reversed-img' : ''} />
                    <div className="tarot-mini-pos">{card.position}</div>
                  </div>
                ))}
              </div>

              {/* 종합 해석 */}
              <div className="tarot-reading-section">
                <div className="tarot-reading-title">
                  {tarotResult.spreadDef?.name} — 운명술사의 해석
                </div>
                {tarotResult.summary && (
                  <div className="tarot-reading-summary">{tarotResult.summary}</div>
                )}
                <div className="tarot-reading-cards">
                  {tarotResult.spread.map((card, idx) => (
                    <div key={idx} className="tarot-reading-card-row">
                      <div className="tarot-reading-row-top">
                        <img
                          src={`/tarot/${card.index}.png`}
                          alt={card.name}
                          className={`tarot-reading-thumb${card.reversed ? ' reversed-img' : ''}`}
                        />
                        <div className="tarot-reading-row-info">
                          <div className="tarot-reading-pos">
                            <span className="tarot-reading-pos-label">{card.position}</span>
                            <span className="tarot-reading-pos-name">
                              {card.suit !== 'major' && <span className="suit-icon">{SUIT_ICONS[card.suit]}</span>}
                              {card.name}
                            </span>
                            <span className="tarot-reading-pos-dir" style={{ color: card.reversed ? '#f87171' : '#4ade80' }}>
                              {card.reversed ? '↓역' : '↑정'}
                            </span>
                          </div>
                          {card.positionDesc && <div className="tarot-reading-pos-desc">{card.positionDesc}</div>}
                          <div className="tarot-reading-text">{card.reading}</div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* 버프 정보 */}
              <div className="tarot-result-buff-section">
                <div className="tarot-result-title">적용된 기운</div>
                <div className="tarot-result-card">
                  <span className="tarot-result-icon">🃏</span>
                  <span className="tarot-result-name">
                    {tarotResult.buffCard.name}
                    <span style={{ color: tarotResult.buffCard.reversed ? '#f87171' : '#4ade80', marginLeft: 6 }}>
                      ({tarotResult.buffCard.reversed ? '역방향' : '정방향'})
                    </span>
                  </span>
                </div>
                <div className="tarot-result-buff">
                  {BUFF_LABELS[tarotResult.buffCard.buff_type] || tarotResult.buffCard.buff_type} +{tarotResult.buffCard.buff_value}% · {tarotResult.buffCard.duration}전투
                </div>
              </div>
              <button className="tarot-draw-btn" onClick={resetTarot}>
                다시 점술하기
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default FortuneArea;
