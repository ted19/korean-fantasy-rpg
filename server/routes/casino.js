const express = require('express');
const jwt = require('jsonwebtoken');
const { pool, getSelectedChar } = require('../db');

const router = express.Router();
const JWT_SECRET = 'game-secret-key-change-in-production';

// 하이로우 서버 세션 (치팅 방지)
const hlSessions = new Map();

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

// 미들웨어: selectedCharId
router.use(auth, (req, res, next) => {
  req.selectedCharId = req.headers['x-char-id'] || null;
  next();
});

// ── 게임 플레이 ──
router.post('/play', async (req, res) => {
  const conn = await pool.getConnection();
  try {
    const char = await getSelectedChar(req, conn);
    if (!char) { conn.release(); return res.status(400).json({ message: '캐릭터를 찾을 수 없습니다.' }); }

    const { game, bet, result } = req.body;
    if (!game) { conn.release(); return res.status(400).json({ message: '잘못된 요청입니다.' }); }
    if (game !== 'highlow_cashout' && game !== 'highlow') {
      if (!bet || bet <= 0) { conn.release(); return res.status(400).json({ message: '잘못된 요청입니다.' }); }
      if (bet > 10000) { conn.release(); return res.status(400).json({ message: '최대 베팅은 10,000G입니다.' }); }
      if (char.gold < bet) { conn.release(); return res.status(400).json({ message: '골드가 부족합니다.' }); }
    }

    // 서버에서 결과 재계산 (클라이언트 조작 방지)
    let winAmount = 0;
    let serverResult = {};

    if (game === 'dice') {
      const d1 = Math.floor(Math.random() * 6) + 1;
      const d2 = Math.floor(Math.random() * 6) + 1;
      const sum = d1 + d2;
      if (sum === 12) winAmount = bet * 5;
      else if (sum >= 7) winAmount = bet * 2;
      else winAmount = -bet;
      serverResult = { d1, d2, sum, win: winAmount };

    } else if (game === 'coin') {
      const flip = Math.random() < 0.5 ? 'heads' : 'tails';
      const choice = result?.choice || 'heads';
      const correct = choice === flip;
      winAmount = correct ? bet : -bet;
      serverResult = { flip, choice, win: winAmount };

    } else if (game === 'highlow_start') {
      // 게임 시작: 베팅금 차감, 첫 카드 공개, 세션 생성
      const card = Math.floor(Math.random() * 10) + 1;
      const session = { bet, card, pot: bet, streak: 0 };
      hlSessions.set(char.id, session);
      winAmount = -bet;
      serverResult = { card, pot: bet, streak: 0 };

    } else if (game === 'highlow') {
      // 하이로우 추측: 서버 세션에서 검증
      const session = hlSessions.get(char.id);
      if (!session) { conn.release(); return res.status(400).json({ message: '게임이 진행중이지 않습니다.' }); }

      const guess = result?.guess || 'high';
      const prev = session.card;
      const next = Math.floor(Math.random() * 10) + 1;

      if (next === prev) {
        // 같은 숫자 = 무조건 패배 (하우스 엣지)
        hlSessions.delete(char.id);
        winAmount = 0; // 베팅금은 시작 시 이미 차감됨
        serverResult = { prev, next, guess, correct: false, same: true, pot: 0, streak: 0, lostPot: session.pot };
      } else {
        const correct = (guess === 'high' && next > prev) || (guess === 'low' && next < prev);
        if (correct) {
          // 리스크 기반 배율: 어려운 선택 = 높은 배율, 쉬운 선택 = 낮은 배율
          // 5% 하우스 엣지: 어떤 카드/선택이든 기대값 -5%
          const favorable = guess === 'high' ? (10 - prev) : (prev - 1);
          const multiplier = (10 / favorable) * 0.95;
          session.streak++;
          session.pot = Math.floor(session.pot * multiplier);
          session.card = next;
          winAmount = 0;
          serverResult = { prev, next, guess, correct: true, pot: session.pot, streak: session.streak, multiplier: parseFloat(multiplier.toFixed(2)) };
        } else {
          // 오답 = 베팅금 + 누적 팟 모두 잃음
          const lostPot = session.pot;
          hlSessions.delete(char.id);
          winAmount = 0;
          serverResult = { prev, next, guess, correct: false, pot: 0, streak: 0, lostPot };
        }
      }

    } else if (game === 'highlow_cashout') {
      // 연승 보상 정산 (서버 세션에서 검증)
      const session = hlSessions.get(char.id);
      if (!session || session.pot <= 0) { conn.release(); return res.status(400).json({ message: '정산할 보상이 없습니다.' }); }
      winAmount = session.pot;
      hlSessions.delete(char.id);
      serverResult = { cashout: winAmount };

    } else {
      conn.release();
      return res.status(400).json({ message: '알 수 없는 게임입니다.' });
    }

    await conn.beginTransaction();
    const newGold = Math.max(0, char.gold + winAmount);
    await conn.query('UPDATE characters SET gold = ? WHERE id = ?', [newGold, char.id]);
    await conn.commit();

    res.json({ gold: newGold, result: serverResult, winAmount });
  } catch (err) {
    await conn.rollback().catch(() => {});
    console.error('Casino play error:', err);
    res.status(500).json({ message: '서버 오류가 발생했습니다.' });
  } finally {
    conn.release();
  }
});

module.exports = router;
