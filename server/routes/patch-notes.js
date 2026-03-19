const express = require('express');
const jwt = require('jsonwebtoken');
const { pool } = require('../db');

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

// 패치노트 목록 (페이지네이션)
router.get('/', auth, async (req, res) => {
  try {
    const page = Math.max(1, parseInt(req.query.page) || 1);
    const limit = Math.max(1, Math.min(10, parseInt(req.query.limit) || 1));
    const offset = (page - 1) * limit;

    const [[{ total }]] = await pool.query('SELECT COUNT(*) as total FROM patch_notes');
    const totalPages = Math.ceil(total / limit);

    const [notes] = await pool.query(
      'SELECT id, version, title, date, content FROM patch_notes ORDER BY date DESC, id DESC LIMIT ? OFFSET ?',
      [limit, offset]
    );

    res.json({ notes, total, page, totalPages });
  } catch (err) {
    console.error('Patch notes list error:', err);
    res.status(500).json({ message: '서버 오류가 발생했습니다.' });
  }
});

// 최신 패치노트
router.get('/latest', auth, async (req, res) => {
  try {
    const [notes] = await pool.query(
      'SELECT id, version, title, date, content FROM patch_notes ORDER BY date DESC, id DESC LIMIT 1'
    );
    res.json({ note: notes.length > 0 ? notes[0] : null });
  } catch (err) {
    console.error('Patch notes latest error:', err);
    res.status(500).json({ message: '서버 오류가 발생했습니다.' });
  }
});

module.exports = router;
