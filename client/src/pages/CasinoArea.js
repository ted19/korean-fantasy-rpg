import React, { useState, useEffect, useCallback } from 'react';
import api from '../api';
import Dice3D from './Dice3D';
import Coin3D from './Coin3D';
import Card3D from './Card3D';
import './InnArea.css';

const NPC_MESSAGES = {
  dice: [
    '크큭! 운을 시험해볼 텐가? 도깨비의 주사위는 절대 거짓말을 하지 않지!',
    '자, 골드를 걸어봐! 두 배로 돌려줄 수도 있고... 크큭큭.',
    '도깨비 방망이가 금을 만들듯, 여기서도 금이 쏟아질 수 있다네!',
  ],
  coin: [
    '동전 하나에 운명이 갈린다... 앞? 뒤? 크큭!',
    '간단하지만 가장 짜릿한 도박이지!',
    '용기 있는 자만이 두 배의 보상을 얻는다네!',
  ],
  highlow: [
    '숫자를 맞춰봐! 높을까 낮을까? 크큭큭!',
    '감이 좋은 자에게 행운이 따르는 법이지!',
    '연속으로 맞추면 보상이 눈덩이처럼 불어난다고!',
  ],
};

function NpcImg({ src, className }) {
  const [err, setErr] = useState(false);
  if (err) return <span className={className}>👺</span>;
  return <img src={src} alt="" className={className} onError={() => setErr(true)} />;
}

function CasinoArea({ charState, onCharStateUpdate, onLog }) {
  const [tab, setTab] = useState('dice');
  const [npcMsg, setNpcMsg] = useState('');
  const [loading, setLoading] = useState(false);

  // 주사위 게임 상태
  const [diceBet, setDiceBet] = useState(100);
  const [diceResult, setDiceResult] = useState(null);
  const [diceRolling, setDiceRolling] = useState(false);
  const diceResultRef = React.useRef(null);

  // 동전 던지기 상태
  const [coinBet, setCoinBet] = useState(100);
  const [coinChoice, setCoinChoice] = useState('heads');
  const [coinResult, setCoinResult] = useState(null);
  const [coinFlipping, setCoinFlipping] = useState(false);
  const coinResultRef = React.useRef(null);

  // 하이로우 상태
  const [hlBet, setHlBet] = useState(100);
  const [hlCurrent, setHlCurrent] = useState(null);
  const [hlResult, setHlResult] = useState(null);
  const [hlStreak, setHlStreak] = useState(0);
  const [hlFlipping, setHlFlipping] = useState(false);
  const [hlCardNumber, setHlCardNumber] = useState(null);

  const updateNpcMsg = useCallback((t) => {
    const msgs = NPC_MESSAGES[t] || NPC_MESSAGES.dice;
    setNpcMsg(msgs[Math.floor(Math.random() * msgs.length)]);
  }, []);

  useEffect(() => { updateNpcMsg(tab); }, [tab, updateNpcMsg]);

  // ── 주사위 게임: 2개 주사위, 합이 7 이상이면 승리 (x2), 12면 대박 (x5) ──
  const playDice = async () => {
    if (loading || diceRolling || charState.gold < diceBet) return;
    setLoading(true);
    setDiceResult(null);

    // 서버에서 결과 먼저 받기
    let serverResult = null;
    try {
      const res = await api.post('/casino/play', { game: 'dice', bet: diceBet, result: {} });
      serverResult = res.data;
    } catch (err) {
      onLog(err.response?.data?.message || '게임 오류', 'damage');
      setLoading(false);
      return;
    }

    const { d1, d2, sum, win: winAmount } = serverResult.result;

    // rolling 먼저 시작, result는 ref로 전달
    diceResultRef.current = { d1, d2, sum, win: winAmount };
    setDiceRolling(true);

    // 4.5초 후 결과 표시 (4초 애니메이션 + 0.5초 정렬)
    setTimeout(() => {
      setDiceRolling(false);
      setDiceResult({ d1, d2, sum, win: winAmount });

      let msg = '';
      if (sum === 12) {
        msg = `🎲 ${d1} + ${d2} = ${sum}! 대박!! ×5 보상! +${(diceBet * 5).toLocaleString()}G`;
      } else if (sum >= 7) {
        msg = `🎲 ${d1} + ${d2} = ${sum}! 승리! ×2 보상! +${(diceBet * 2).toLocaleString()}G`;
      } else {
        msg = `🎲 ${d1} + ${d2} = ${sum}... 패배! -${diceBet.toLocaleString()}G`;
      }

      onCharStateUpdate({ gold: serverResult.gold });
      onLog(msg, winAmount > 0 ? 'heal' : 'damage');
      setLoading(false);
    }, 4500);
  };

  // cleanup

  // ── 동전 던지기: 앞/뒤 맞추면 x2 ──
  const playCoin = async () => {
    if (loading || coinFlipping || charState.gold < coinBet) return;
    setLoading(true);
    setCoinResult(null);

    let serverResult = null;
    try {
      const res = await api.post('/casino/play', { game: 'coin', bet: coinBet, result: { choice: coinChoice } });
      serverResult = res.data;
    } catch (err) {
      onLog(err.response?.data?.message || '게임 오류', 'damage');
      setLoading(false);
      return;
    }

    const { flip, win: winAmount } = serverResult.result;
    coinResultRef.current = flip;
    setCoinFlipping(true);

    setTimeout(() => {
      setCoinFlipping(false);
      const isWin = coinChoice === flip;
      setCoinResult({ flip, win: isWin, amount: winAmount });
      const flipName = flip === 'heads' ? '앞면' : '뒷면';
      const msg = isWin
        ? `🪙 ${flipName}! 맞았다! +${coinBet.toLocaleString()}G`
        : `🪙 ${flipName}! 빗나갔다... -${coinBet.toLocaleString()}G`;
      onCharStateUpdate({ gold: serverResult.gold });
      onLog(msg, isWin ? 'heal' : 'damage');
      setLoading(false);
    }, 3500);
  };

  // ── 하이로우: 리스크 기반 배율 시스템 ──
  const [hlPot, setHlPot] = useState(0); // 서버에서 관리하는 누적 팟

  // 배율 계산 (UI 표시용)
  const getMultiplier = (card, guess) => {
    if (!card) return 0;
    const favorable = guess === 'high' ? (10 - card) : (card - 1);
    if (favorable <= 0) return 0;
    return parseFloat(((10 / favorable) * 0.95).toFixed(2));
  };

  const startHighLow = async () => {
    if (loading || charState.gold < hlBet) return;
    setLoading(true);
    setHlResult(null);
    setHlStreak(0);
    setHlPot(0);
    try {
      const res = await api.post('/casino/play', { game: 'highlow_start', bet: hlBet, result: {} });
      const { card, pot } = res.data.result;
      setHlCurrent(card);
      setHlPot(pot);
      onCharStateUpdate({ gold: res.data.gold });
      onLog(`📊 하이로우 시작! ${hlBet.toLocaleString()}G 베팅, 첫 카드: ${card}`, 'info');
    } catch (err) {
      onLog(err.response?.data?.message || '게임 오류', 'damage');
    }
    setLoading(false);
  };

  const playHighLow = async (guess) => {
    if (loading || hlFlipping || !hlCurrent) return;
    setLoading(true);
    setHlResult(null);

    let serverResult = null;
    try {
      const res = await api.post('/casino/play', { game: 'highlow', bet: hlBet, result: { guess } });
      serverResult = res.data;
    } catch (err) {
      onLog(err.response?.data?.message || '게임 오류', 'damage');
      setLoading(false);
      return;
    }

    const { next, correct, same, pot, streak: newStreak, multiplier, lostPot } = serverResult.result;

    setHlCardNumber(next);
    setHlFlipping(true);

    setTimeout(() => {
      setHlFlipping(false);

      if (correct) {
        setHlPot(pot);
        const msg = `📊 ${hlCurrent} → ${next}! 정답! ×${multiplier} → 팟 ${pot.toLocaleString()}G (${newStreak}연승)`;
        onLog(msg, 'heal');
        setHlCurrent(next);
        setHlStreak(newStreak);
      } else {
        setHlPot(0);
        const reason = same ? `같은 숫자!` : `오답!`;
        const msg = `📊 ${hlCurrent} → ${next}! ${reason} -${(lostPot || hlBet).toLocaleString()}G 잃음`;
        onLog(msg, 'damage');
        setHlCurrent(null);
        setHlStreak(0);
      }

      setHlResult({ prev: hlCurrent, next, correct, same, streak: newStreak || 0 });
      setLoading(false);
    }, 1500);
  };

  const cashOutHighLow = async () => {
    if (loading || hlPot <= 0) return;
    setLoading(true);
    try {
      const res = await api.post('/casino/play', { game: 'highlow_cashout', bet: 0, result: {} });
      onCharStateUpdate({ gold: res.data.gold });
      const profit = hlPot - hlBet;
      onLog(`📊 ${hlStreak}연승 정산! +${hlPot.toLocaleString()}G 회수! (순이익 ${profit >= 0 ? '+' : ''}${profit.toLocaleString()}G)`, 'heal');
    } catch (err) {
      onLog(err.response?.data?.message || '정산 오류', 'damage');
    }
    setHlCurrent(null);
    setHlStreak(0);
    setHlPot(0);
    setHlResult(null);
    setLoading(false);
  };

  const BET_OPTIONS = [50, 100, 200, 500, 1000, 5000];

  return (
    <div className="facility-page casino-page">
      {/* 배너 */}
      <div className="facility-banner" style={{ background: 'linear-gradient(135deg, #1a0a0a, #2a1008)' }}>
        <NpcImg src="/village/casino_banner.png" className="facility-banner-img" />
        <div className="facility-banner-overlay" />
        <div className="facility-banner-title">도깨비 노름방</div>
      </div>

      {/* NPC */}
      <div className="facility-npc">
        <div className="facility-npc-portrait-wrap" style={{ borderColor: 'rgba(255, 80, 30, 0.35)' }}>
          <NpcImg src="/village/casino_portrait.png" className="facility-npc-portrait" />
        </div>
        <div className="facility-npc-speech">
          <div className="facility-npc-name">도깨비 <span className="npc-name-sub">노름방 주인</span></div>
          <div className="facility-npc-msg">{npcMsg}</div>
        </div>
        <div className="facility-gold">{(charState.gold || 0).toLocaleString()} G</div>
      </div>

      {/* 탭 */}
      <div className="facility-tabs">
        {[
          { id: 'dice', label: '🎲 주사위' },
          { id: 'coin', label: '🪙 동전 던지기' },
          { id: 'highlow', label: '📊 하이로우' },
        ].map(t => (
          <button key={t.id} className={`facility-tab${tab === t.id ? ' active' : ''}`}
            onClick={() => { setTab(t.id); setDiceResult(null); setCoinResult(null); setHlResult(null); }}>
            {t.label}
          </button>
        ))}
      </div>

      {/* ── 주사위 게임 ── */}
      {tab === 'dice' && (
        <div style={{ padding: '16px 0' }}>
          <div style={{ background: '#181c2e', borderRadius: 12, padding: 20, textAlign: 'center' }}>
            <h4 style={{ color: '#fbbf24', marginBottom: 8 }}>🎲 도깨비 주사위</h4>
            <p style={{ color: '#888', fontSize: 13, marginBottom: 16 }}>두 주사위의 합이 7 이상이면 승리! 12면 대박(×5)!</p>

            <div style={{ display: 'flex', gap: 6, justifyContent: 'center', flexWrap: 'wrap', marginBottom: 16 }}>
              {BET_OPTIONS.map(b => (
                <button key={b} onClick={() => setDiceBet(b)}
                  style={{ padding: '6px 14px', borderRadius: 8, border: diceBet === b ? '2px solid #fbbf24' : '1px solid #333',
                    background: diceBet === b ? '#fbbf2420' : '#0f1320', color: diceBet === b ? '#fbbf24' : '#888',
                    cursor: 'pointer', fontSize: 13, fontWeight: diceBet === b ? 700 : 400 }}>
                  {b.toLocaleString()}G
                </button>
              ))}
            </div>

            {/* 3D 주사위 */}
            <div style={{ marginBottom: 16 }}>
              <Dice3D
                rolling={diceRolling}
                result={diceResultRef.current ? [diceResultRef.current.d1, diceResultRef.current.d2] : (diceResult ? [diceResult.d1, diceResult.d2] : [1, 1])}
                width={300}
                height={200}
              />
            </div>

            {/* 결과 텍스트 */}
            {diceResult && !diceRolling && (
              <div style={{ fontSize: 18, margin: '0 0 16px', fontWeight: 700,
                color: diceResult.win > 0 ? '#4ade80' : '#ef4444',
                animation: 'dice-result-pop 0.4s ease' }}>
                {diceResult.d1} + {diceResult.d2} = {diceResult.sum}
                {diceResult.sum === 12 && <span style={{ color: '#fbbf24' }}> 대박!! ×5</span>}
                <div style={{ fontSize: 14, marginTop: 4 }}>
                  {diceResult.win > 0 ? `승리! +${diceResult.win.toLocaleString()}G` : `패배... -${diceBet.toLocaleString()}G`}
                </div>
              </div>
            )}

            {diceRolling && (
              <div style={{ fontSize: 14, color: '#fbbf24', marginBottom: 16, letterSpacing: 3, animation: 'gacha-text-blink 0.5s ease-in-out infinite alternate' }}>
                주사위 굴리는 중...
              </div>
            )}

            <button onClick={playDice} disabled={loading || diceRolling || charState.gold < diceBet}
              style={{ padding: '12px 36px', borderRadius: 12, border: 'none', marginTop: 12,
                background: (charState.gold >= diceBet && !diceRolling) ? 'linear-gradient(135deg, #f59e0b, #d97706)' : '#333',
                color: (charState.gold >= diceBet && !diceRolling) ? '#000' : '#666', fontWeight: 700, fontSize: 16, cursor: (charState.gold >= diceBet && !diceRolling) ? 'pointer' : 'default' }}>
              {diceRolling ? '🎲 굴리는 중...' : charState.gold < diceBet ? '골드 부족' : `🎲 ${diceBet.toLocaleString()}G 걸고 굴리기!`}
            </button>
          </div>
        </div>
      )}

      {/* ── 동전 던지기 ── */}
      {tab === 'coin' && (
        <div style={{ padding: '16px 0' }}>
          <div style={{ background: '#181c2e', borderRadius: 12, padding: 20, textAlign: 'center' }}>
            <h4 style={{ color: '#60a5fa', marginBottom: 8 }}>🪙 동전 던지기</h4>
            <p style={{ color: '#888', fontSize: 13, marginBottom: 16 }}>앞면? 뒷면? 맞추면 ×2!</p>

            <div style={{ display: 'flex', gap: 6, justifyContent: 'center', flexWrap: 'wrap', marginBottom: 12 }}>
              {BET_OPTIONS.map(b => (
                <button key={b} onClick={() => setCoinBet(b)}
                  style={{ padding: '6px 14px', borderRadius: 8, border: coinBet === b ? '2px solid #60a5fa' : '1px solid #333',
                    background: coinBet === b ? '#60a5fa20' : '#0f1320', color: coinBet === b ? '#60a5fa' : '#888',
                    cursor: 'pointer', fontSize: 13, fontWeight: coinBet === b ? 700 : 400 }}>
                  {b.toLocaleString()}G
                </button>
              ))}
            </div>

            <div style={{ display: 'flex', gap: 10, justifyContent: 'center', marginBottom: 16 }}>
              <button onClick={() => setCoinChoice('heads')}
                style={{ padding: '10px 24px', borderRadius: 10, border: coinChoice === 'heads' ? '2px solid #fbbf24' : '1px solid #333',
                  background: coinChoice === 'heads' ? '#fbbf2420' : '#0f1320', color: coinChoice === 'heads' ? '#fbbf24' : '#888',
                  cursor: 'pointer', fontSize: 15, fontWeight: 600 }}>
                ☀️ 앞면
              </button>
              <button onClick={() => setCoinChoice('tails')}
                style={{ padding: '10px 24px', borderRadius: 10, border: coinChoice === 'tails' ? '2px solid #c084fc' : '1px solid #333',
                  background: coinChoice === 'tails' ? '#c084fc20' : '#0f1320', color: coinChoice === 'tails' ? '#c084fc' : '#888',
                  cursor: 'pointer', fontSize: 15, fontWeight: 600 }}>
                🌙 뒷면
              </button>
            </div>

            {/* 3D 동전 */}
            <div style={{ marginBottom: 16 }}>
              <Coin3D
                flipping={coinFlipping}
                result={coinResultRef.current || (coinResult ? coinResult.flip : 'heads')}
                width={300}
                height={200}
              />
            </div>

            {/* 결과 */}
            {coinResult && !coinFlipping && (
              <div style={{ fontSize: 18, margin: '0 0 16px', fontWeight: 700,
                color: coinResult.win ? '#4ade80' : '#ef4444',
                animation: 'dice-result-pop 0.4s ease' }}>
                {coinResult.flip === 'heads' ? '☀️ 앞면' : '🌙 뒷면'}!
                <div style={{ fontSize: 14, marginTop: 4 }}>
                  {coinResult.win ? `정답! +${coinBet.toLocaleString()}G` : `오답... -${coinBet.toLocaleString()}G`}
                </div>
              </div>
            )}

            {coinFlipping && (
              <div style={{ fontSize: 14, color: '#60a5fa', marginBottom: 16, letterSpacing: 3, animation: 'gacha-text-blink 0.5s ease-in-out infinite alternate' }}>
                동전 던지는 중...
              </div>
            )}

            <button onClick={playCoin} disabled={loading || coinFlipping || charState.gold < coinBet}
              style={{ padding: '12px 36px', borderRadius: 12, border: 'none', marginTop: 12,
                background: (charState.gold >= coinBet && !coinFlipping) ? 'linear-gradient(135deg, #3b82f6, #2563eb)' : '#333',
                color: (charState.gold >= coinBet && !coinFlipping) ? '#fff' : '#666', fontWeight: 700, fontSize: 16, cursor: (charState.gold >= coinBet && !coinFlipping) ? 'pointer' : 'default' }}>
              {coinFlipping ? '🪙 던지는 중...' : charState.gold < coinBet ? '골드 부족' : `🪙 ${coinBet.toLocaleString()}G 걸고 던지기!`}
            </button>
          </div>
        </div>
      )}

      {/* ── 하이로우 ── */}
      {tab === 'highlow' && (
        <div style={{ padding: '16px 0' }}>
          <div style={{ background: '#181c2e', borderRadius: 12, padding: 20, textAlign: 'center' }}>
            <h4 style={{ color: '#4ade80', marginBottom: 8 }}>📊 하이로우</h4>
            <p style={{ color: '#888', fontSize: 13, marginBottom: 4 }}>다음 카드(1~10)가 높을까 낮을까? 맞추면 배율만큼 팟 증가!</p>
            <p style={{ color: '#666', fontSize: 12, marginBottom: 16 }}>⚠ 같은 숫자 = 무조건 패배 | 쉬운 선택 = 낮은 배율, 어려운 선택 = 높은 배율 | 틀리면 팟 전액 잃음</p>

            {!hlCurrent && (
              <div style={{ display: 'flex', gap: 6, justifyContent: 'center', flexWrap: 'wrap', marginBottom: 16 }}>
                {BET_OPTIONS.map(b => (
                  <button key={b} onClick={() => setHlBet(b)}
                    style={{ padding: '6px 14px', borderRadius: 8, border: hlBet === b ? '2px solid #4ade80' : '1px solid #333',
                      background: hlBet === b ? '#4ade8020' : '#0f1320', color: hlBet === b ? '#4ade80' : '#888',
                      cursor: 'pointer', fontSize: 13, fontWeight: hlBet === b ? 700 : 400 }}>
                    {b.toLocaleString()}G
                  </button>
                ))}
              </div>
            )}

            {!hlCurrent ? (
              <>
                <div style={{ marginBottom: 16 }}>
                  <Card3D flipping={false} number={0} width={160} height={220} />
                </div>
                <button onClick={startHighLow} disabled={loading || charState.gold < hlBet}
                  style={{ padding: '12px 36px', borderRadius: 12, border: 'none',
                    background: charState.gold >= hlBet ? 'linear-gradient(135deg, #22c55e, #16a34a)' : '#333',
                    color: charState.gold >= hlBet ? '#fff' : '#666', fontWeight: 700, fontSize: 16,
                    cursor: charState.gold >= hlBet ? 'pointer' : 'default' }}>
                  {charState.gold < hlBet ? '골드 부족' : `${hlBet.toLocaleString()}G 걸고 시작!`}
                </button>
              </>
            ) : (
              <>
                {/* 3D 카드 */}
                <div style={{ marginBottom: 12 }}>
                  <Card3D
                    flipping={hlFlipping}
                    number={hlFlipping ? hlCardNumber : hlCurrent}
                    width={160}
                    height={220}
                  />
                </div>

                {/* 팟 & 연승 정보 */}
                <div style={{ marginBottom: 12, padding: '10px 16px', background: '#0f1320', borderRadius: 10, display: 'inline-block' }}>
                  <div style={{ color: '#fbbf24', fontSize: 15, fontWeight: 700 }}>
                    💰 팟: {hlPot.toLocaleString()}G
                    {hlPot > hlBet && <span style={{ color: '#4ade80', fontSize: 12, marginLeft: 6 }}>(+{(hlPot - hlBet).toLocaleString()}G)</span>}
                  </div>
                  {hlStreak > 0 && (
                    <div style={{ color: '#4ade80', fontSize: 13, marginTop: 2 }}>🔥 {hlStreak}연승 중</div>
                  )}
                </div>

                {hlResult && (
                  <div style={{ fontSize: 14, color: hlResult.correct ? '#4ade80' : '#ef4444', marginBottom: 12, padding: '8px 14px', background: hlResult.correct ? '#4ade8015' : '#ef444415', borderRadius: 8 }}>
                    {hlResult.prev} → {hlResult.next}: {hlResult.correct ? `정답!` : hlResult.same ? `같은 숫자! 패배...` : `오답...`}
                  </div>
                )}

                {/* 배율 표시 + 버튼 */}
                <div style={{ display: 'flex', gap: 10, justifyContent: 'center', flexWrap: 'wrap', marginBottom: 8 }}>
                  {(() => {
                    const highMul = getMultiplier(hlCurrent, 'high');
                    const highFav = 10 - hlCurrent;
                    return (
                      <button onClick={() => playHighLow('high')} disabled={loading || hlFlipping || highFav <= 0}
                        style={{ padding: '12px 24px', borderRadius: 12, border: 'none',
                          background: (!loading && !hlFlipping && highFav > 0) ? '#ef4444' : '#555',
                          color: '#fff', fontWeight: 700, fontSize: 15, cursor: (!loading && !hlFlipping && highFav > 0) ? 'pointer' : 'default',
                          opacity: highFav <= 0 ? 0.3 : 1, minWidth: 130 }}>
                        🔺 높다!
                        {highFav > 0 && <div style={{ fontSize: 11, marginTop: 2, opacity: 0.85 }}>×{highMul} ({highFav}0%)</div>}
                      </button>
                    );
                  })()}
                  {(() => {
                    const lowMul = getMultiplier(hlCurrent, 'low');
                    const lowFav = hlCurrent - 1;
                    return (
                      <button onClick={() => playHighLow('low')} disabled={loading || hlFlipping || lowFav <= 0}
                        style={{ padding: '12px 24px', borderRadius: 12, border: 'none',
                          background: (!loading && !hlFlipping && lowFav > 0) ? '#3b82f6' : '#555',
                          color: '#fff', fontWeight: 700, fontSize: 15, cursor: (!loading && !hlFlipping && lowFav > 0) ? 'pointer' : 'default',
                          opacity: lowFav <= 0 ? 0.3 : 1, minWidth: 130 }}>
                        🔻 낮다!
                        {lowFav > 0 && <div style={{ fontSize: 11, marginTop: 2, opacity: 0.85 }}>×{lowMul} ({lowFav}0%)</div>}
                      </button>
                    );
                  })()}
                </div>

                <div style={{ color: '#555', fontSize: 11, marginBottom: 8 }}>같은 숫자 나올 확률: 10% (패배)</div>

                {/* 정산 버튼 (1연승 이상부터) */}
                {hlStreak > 0 && hlPot > 0 && (
                  <button onClick={cashOutHighLow} disabled={loading}
                    style={{ marginTop: 8, padding: '10px 30px', borderRadius: 12, border: '2px solid #fbbf24',
                      background: '#fbbf2420', color: '#fbbf24', fontWeight: 700, fontSize: 14, cursor: 'pointer' }}>
                    💰 {hlPot.toLocaleString()}G 받고 멈추기
                  </button>
                )}
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export default CasinoArea;
