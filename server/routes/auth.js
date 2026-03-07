const express = require('express');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const { pool } = require('../db');

const router = express.Router();
const JWT_SECRET = 'game-secret-key-change-in-production';

// 회원가입
router.post('/register', async (req, res) => {
  try {
    const { username, email, password } = req.body;

    if (!username || !email || !password) {
      return res.status(400).json({ message: '모든 필드를 입력해주세요.' });
    }

    const [existing] = await pool.query(
      'SELECT id FROM users WHERE username = ? OR email = ?',
      [username, email]
    );

    if (existing.length > 0) {
      return res.status(409).json({ message: '이미 존재하는 사용자명 또는 이메일입니다.' });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const [result] = await pool.query(
      'INSERT INTO users (username, email, password) VALUES (?, ?, ?)',
      [username, email, hashedPassword]
    );

    res.status(201).json({ message: '회원가입이 완료되었습니다.', userId: result.insertId });
  } catch (err) {
    console.error('Register error:', err);
    res.status(500).json({ message: '서버 오류가 발생했습니다.' });
  }
});

// 로그인
router.post('/login', async (req, res) => {
  try {
    const { username, password } = req.body;

    if (!username || !password) {
      return res.status(400).json({ message: '사용자명과 비밀번호를 입력해주세요.' });
    }

    const [users] = await pool.query(
      'SELECT * FROM users WHERE username = ?',
      [username]
    );

    if (users.length === 0) {
      return res.status(401).json({ message: '사용자명 또는 비밀번호가 올바르지 않습니다.' });
    }

    const user = users[0];
    const isMatch = await bcrypt.compare(password, user.password);

    if (!isMatch) {
      return res.status(401).json({ message: '사용자명 또는 비밀번호가 올바르지 않습니다.' });
    }

    // 고유 세션 토큰 생성 → DB에 저장 (이전 세션 자동 무효화)
    const sessionToken = crypto.randomBytes(32).toString('hex');
    await pool.query('UPDATE users SET session_token = ? WHERE id = ?', [sessionToken, user.id]);
    console.log(`[SESSION] LOGIN user=${user.id} newToken=${sessionToken.slice(0,8)}...`);

    const token = jwt.sign(
      { id: user.id, username: user.username, sessionToken },
      JWT_SECRET,
      { expiresIn: '24h' }
    );

    res.json({
      message: '로그인 성공',
      token,
      user: { id: user.id, username: user.username, email: user.email },
    });
  } catch (err) {
    console.error('Login error:', err);
    res.status(500).json({ message: '서버 오류가 발생했습니다.' });
  }
});

// 내 정보 조회 (토큰 검증)
router.get('/me', async (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader) {
      return res.status(401).json({ message: '인증 토큰이 필요합니다.' });
    }

    const token = authHeader.split(' ')[1];
    const decoded = jwt.verify(token, JWT_SECRET);

    const [users] = await pool.query(
      'SELECT id, username, email, created_at, session_token FROM users WHERE id = ?',
      [decoded.id]
    );

    if (users.length === 0) {
      return res.status(404).json({ message: '사용자를 찾을 수 없습니다.' });
    }

    // 세션 토큰 검증 (중복 로그인 차단)
    const dbSessionToken = users[0].session_token;
    if (dbSessionToken) {
      if (!decoded.sessionToken || dbSessionToken !== decoded.sessionToken) {
        return res.status(409).json({
          message: '다른 기기에서 로그인되어 현재 세션이 종료되었습니다.',
          code: 'SESSION_EXPIRED_DUPLICATE',
        });
      }
    }

    const { session_token, ...userData } = users[0];
    res.json({ user: userData });
  } catch (err) {
    if (err.name === 'JsonWebTokenError' || err.name === 'TokenExpiredError') {
      return res.status(401).json({ message: '유효하지 않은 토큰입니다.' });
    }
    console.error('Me error:', err);
    res.status(500).json({ message: '서버 오류가 발생했습니다.' });
  }
});

module.exports = router;
