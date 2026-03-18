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
    if (game !== 'highlow_cashout') {
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

    } else if (game === 'highlow') {
      const prev = result?.prev || 5;
      const next = Math.floor(Math.random() * 10) + 1;
      const guess = result?.guess || 'high';
      const correct = (guess === 'high' && next > prev) || (guess === 'low' && next < prev) || next === prev;
      const streak = correct ? (result?.streak || 0) + 1 : 0;
      // 맞추면 골드 변동 없음 (연승 중 누적), 틀리면 베팅금 차감
      winAmount = correct ? 0 : -bet;
      serverResult = { prev, next, guess, correct, win: winAmount, streak };

    } else if (game === 'highlow_cashout') {
      // 연승 보상 정산
      const cashout = Math.max(0, Math.floor(result?.cashout || 0));
      winAmount = cashout;
      serverResult = { cashout, win: winAmount };

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
