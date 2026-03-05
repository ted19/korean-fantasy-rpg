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
const db = require('./db');

const app = express();
const PORT = 4000;

app.use(cors({ origin: 'http://localhost:3000', credentials: true }));
app.use(express.json());

// X-Char-Id 헤더 기반으로 선택된 캐릭터 ID를 req에 주입
app.use((req, res, next) => {
  const charId = req.headers['x-char-id'];
  if (charId) req.selectedCharId = parseInt(charId, 10);
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

// Global error handler
app.use((err, req, res, next) => {
  console.log('GLOBAL_ERROR:', req.method, req.path, err.message);
  if (!res.headersSent) {
    res.status(500).json({ message: '서버 오류가 발생했습니다.', error: err.message });
  }
});

async function start() {
  await db.initialize();
  app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

start();
