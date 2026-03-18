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

  // ── 하이로우: 현재 숫자보다 높을지 낮을지 맞추기 ──
  const [hlPendingWin, setHlPendingWin] = useState(0); // 연승 중 누적 보상

  const startHighLow = () => {
    setHlCurrent(Math.floor(Math.random() * 10) + 1);
    setHlResult(null);
    setHlStreak(0);
    setHlPendingWin(0);
  };

  const playHighLow = async (guess) => {
    if (loading || hlFlipping || !hlCurrent || charState.gold < hlBet) return;
    setLoading(true);
    setHlResult(null);

    let serverResult = null;
    try {
      const res = await api.post('/casino/play', { game: 'highlow', bet: hlBet, result: { prev: hlCurrent, guess, streak: hlStreak } });
      serverResult = res.data;
    } catch (err) {
      onLog(err.response?.data?.message || '게임 오류', 'damage');
      setLoading(false);
      return;
    }

    const { next, correct, win: winAmount, streak: newStreak } = serverResult.result;

    // 카드 뒤집기 애니메이션
    setHlCardNumber(next);
    setHlFlipping(true);

    setTimeout(() => {
      setHlFlipping(false);

      if (correct) {
        const totalWin = Math.floor(hlBet * Math.pow(1.5, newStreak));
        setHlPendingWin(totalWin);
        const msg = `📊 ${hlCurrent} → ${next}! 정답! ${newStreak}연승! (누적 ${totalWin.toLocaleString()}G)`;
        onLog(msg, 'heal');
      } else {
        setHlPendingWin(0);
        const msg = `📊 ${hlCurrent} → ${next}! 오답... -${hlBet.toLocaleString()}G`;
        onCharStateUpdate({ gold: serverResult.gold });
        onLog(msg, 'damage');
      }

      setHlResult({ prev: hlCurrent, next, correct, amount: winAmount, streak: newStreak });
      setHlCurrent(correct ? next : null);
      setHlStreak(correct ? newStreak : 0);
      if (!correct) setHlPendingWin(0);
      setLoading(false);
    }, 1500);
  };

  // 연승 중 멈추고 보상 확정
  const cashOutHighLow = async () => {
    if (loading || hlPendingWin <= 0) return;
    setLoading(true);
    try {
      // 보상 확정 (bet=0으로 보내서 보상만 처리)
      const res = await api.post('/casino/play', { game: 'highlow_cashout', bet: 0, result: { cashout: hlPendingWin } });
      onCharStateUpdate({ gold: res.data.gold });
      onLog(`📊 ${hlStreak}연승 정산! +${hlPendingWin.toLocaleString()}G 획득!`, 'heal');
    } catch (err) {
      onLog(err.response?.data?.message || '정산 오류', 'damage');
    }
    setHlCurrent(null);
    setHlStreak(0);
    setHlPendingWin(0);
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
            <p style={{ color: '#888', fontSize: 13, marginBottom: 16 }}>다음 숫자(1~10)가 높을까 낮을까? 연승하면 보상 ×1.5배!</p>

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

            {!hlCurrent ? (
              <>
                <div style={{ marginBottom: 16 }}>
                  <Card3D flipping={false} number={0} width={160} height={220} />
                </div>
                <button onClick={startHighLow}
                  style={{ padding: '12px 36px', borderRadius: 12, border: 'none', background: 'linear-gradient(135deg, #22c55e, #16a34a)',
                    color: '#fff', fontWeight: 700, fontSize: 16, cursor: 'pointer' }}>
                  게임 시작!
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

                {hlStreak > 0 && (
                  <div style={{ marginBottom: 12 }}>
                    <div style={{ color: '#4ade80', fontSize: 15, fontWeight: 700, marginBottom: 4 }}>🔥 {hlStreak}연승! (×{Math.pow(1.5, hlStreak).toFixed(1)})</div>
                    <div style={{ color: '#fbbf24', fontSize: 13 }}>누적 보상: <b>{hlPendingWin.toLocaleString()}G</b></div>
                  </div>
                )}

                {hlResult && (
                  <div style={{ fontSize: 14, color: hlResult.correct ? '#4ade80' : '#ef4444', marginBottom: 12, padding: '8px 14px', background: hlResult.correct ? '#4ade8015' : '#ef444415', borderRadius: 8 }}>
                    {hlResult.prev} → {hlResult.next}: {hlResult.correct ? `정답!` : `오답... -${hlBet.toLocaleString()}G`}
                  </div>
                )}

                <div style={{ display: 'flex', gap: 10, justifyContent: 'center', flexWrap: 'wrap' }}>
                  <button onClick={() => playHighLow('high')} disabled={loading || hlFlipping || charState.gold < hlBet}
                    style={{ padding: '12px 30px', borderRadius: 12, border: 'none', background: (!loading && !hlFlipping) ? '#ef4444' : '#555', color: '#fff', fontWeight: 700, fontSize: 15, cursor: (!loading && !hlFlipping) ? 'pointer' : 'default' }}>
                    🔺 높다!
                  </button>
                  <button onClick={() => playHighLow('low')} disabled={loading || hlFlipping || charState.gold < hlBet}
                    style={{ padding: '12px 30px', borderRadius: 12, border: 'none', background: (!loading && !hlFlipping) ? '#3b82f6' : '#555', color: '#fff', fontWeight: 700, fontSize: 15, cursor: (!loading && !hlFlipping) ? 'pointer' : 'default' }}>
                    🔻 낮다!
                  </button>
                </div>

                {/* 멈추고 보상 받기 버튼 */}
                {hlStreak > 0 && hlPendingWin > 0 && (
                  <button onClick={cashOutHighLow} disabled={loading}
                    style={{ marginTop: 14, padding: '10px 30px', borderRadius: 12, border: '2px solid #fbbf24',
                      background: '#fbbf2420', color: '#fbbf24', fontWeight: 700, fontSize: 14, cursor: 'pointer' }}>
                    💰 {hlPendingWin.toLocaleString()}G 받고 멈추기
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
