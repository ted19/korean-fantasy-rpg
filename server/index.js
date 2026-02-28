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
const db = require('./db');

const app = express();
const PORT = 4000;

app.use(cors({ origin: 'http://localhost:3000', credentials: true }));
app.use(express.json());

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

async function start() {
  await db.initialize();
  app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

start();
