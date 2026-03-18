const express = require('express');
const cors = require('cors');
const authRoutes = require('./routes/auth');
const characterRoutes = require('./routes/character');
const battleRoutes = require('./routes/battle');
const shopRoutes = require('./routes/shop');
const questRoutes = require('./routes/quest');
const skillRoutes = require('./routes/skill');
const equipmentRoutes = require('./routes/equipment');
const summonRoutes = require('./routes/summon');
const dungeonRoutes = require('./routes/dungeon');
const monsterRoutes = require('./routes/monster');
const stageRoutes = require('./routes/stage');
const formationRoutes = require('./routes/formation');
const blacksmithRoutes = require('./routes/blacksmith');
const mercenaryRoutes = require('./routes/mercenary');
const fortuneRoutes = require('./routes/fortune');
const specialDungeonRoutes = require('./routes/special-dungeon');
const gachaRoutes = require('./routes/gacha');
const db = require('./db');

const http = require('http');
const path = require('path');
const app = express();
const PORT = process.env.PORT || 3000;

// 헤더 크기 제한 확장 (431 오류 방지)
http.maxHeaderSize = 64 * 1024; // 64KB

const CORS_ORIGIN = process.env.CORS_ORIGIN || 'http://localhost:4000';

// Private Network Access preflight 처리 (외부 → loopback 요청 허용)
app.use((req, res, next) => {
  if (req.method === 'OPTIONS' && req.headers['access-control-request-private-network']) {
    res.setHeader('Access-Control-Allow-Private-Network', 'true');
  }
  next();
});

app.use(cors({
  origin: function(origin, callback) {
    if (!origin || origin.includes('localhost') || origin.includes('127.0.0.1') || origin.includes('iptime.org')) {
      callback(null, true);
    } else {
      callback(null, CORS_ORIGIN);
    }
  },
  credentials: true
}));
app.use(express.json());

// X-Char-Id 헤더 기반으로 선택된 캐릭터 ID를 req에 주입
app.use((req, res, next) => {
  const charId = req.headers['x-char-id'];
  if (charId) req.selectedCharId = parseInt(charId, 10);
  next();
});

// 중복 로그인 방지: auth 이외 API에서 세션 토큰 검증
const jwt = require('jsonwebtoken');
const SESSION_SECRET = 'game-secret-key-change-in-production';
app.use('/api', async (req, res, next) => {
  // auth 라우트는 검증 제외 (로그인/회원가입/me)
  if (req.path.startsWith('/auth')) return next();

  const authHeader = req.headers.authorization;
  if (!authHeader) return next();
  // SESSION 체크 로그 (디버그용, 평시 비활성)
  // console.log(`[SESSION] Checking ${req.method} ${req.path}`);

  try {
    const token = authHeader.split(' ')[1];
    const decoded = jwt.verify(token, SESSION_SECRET);
    const [rows] = await db.pool.query(
      'SELECT session_token FROM users WHERE id = ?', [decoded.id]
    );
    if (rows.length > 0) {
      const dbToken = rows[0].session_token;
      if (dbToken && (!decoded.sessionToken || dbToken !== decoded.sessionToken)) {
        console.log(`[SESSION] BLOCKED user=${decoded.id} jwt=${decoded.sessionToken?.slice(0,8)} db=${dbToken.slice(0,8)} path=${req.path}`);
        return res.status(409).json({
          message: '다른 기기에서 로그인되어 현재 세션이 종료되었습니다.',
          code: 'SESSION_EXPIRED_DUPLICATE',
        });
      }
      if (!dbToken && !decoded.sessionToken) {
        return res.status(401).json({
          message: '세션이 만료되었습니다. 다시 로그인해주세요.',
          code: 'SESSION_REQUIRED',
        });
      }
    }
  } catch (err) {
    if (err.name !== 'JsonWebTokenError' && err.name !== 'TokenExpiredError') {
      console.error('Session middleware error:', err.message);
    }
  }
  next();
});

app.use('/api/auth', authRoutes);
app.use('/api/characters', characterRoutes);
app.use('/api/battle', battleRoutes);
app.use('/api/shop', shopRoutes);
app.use('/api/quest', questRoutes);
app.use('/api/skill', skillRoutes);
app.use('/api/equipment', equipmentRoutes);
app.use('/api/summon', summonRoutes);
app.use('/api/dungeon', dungeonRoutes);
app.use('/api/monsters', monsterRoutes);
app.use('/api/stage', stageRoutes);
app.use('/api/formation', formationRoutes);
app.use('/api/blacksmith', blacksmithRoutes);
app.use('/api/mercenary', mercenaryRoutes);
app.use('/api/fortune', fortuneRoutes);
app.use('/api/special-dungeon', specialDungeonRoutes);
app.use('/api/gacha', gachaRoutes);

// Global error handler
app.use((err, req, res, next) => {
  console.log('GLOBAL_ERROR:', req.method, req.path, err.message);
  if (!res.headersSent) {
    res.status(500).json({ message: '서버 오류가 발생했습니다.', error: err.message });
  }
});

// 프로덕션: 클라이언트 빌드 정적 파일 서빙
const clientBuildPath = path.join(__dirname, '..', 'client', 'build');
app.use(express.static(clientBuildPath));
app.get('{*path}', (req, res) => {
  res.sendFile(path.join(clientBuildPath, 'index.html'));
});

async function start() {
  await db.initialize();
  app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

start();
