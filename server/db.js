const mysql = require('mysql2/promise');
require('dotenv').config();

const DB_HOST = process.env.DB_HOST || 'localhost';
const DB_PORT = parseInt(process.env.DB_PORT || '3306', 10);
const DB_USER = process.env.DB_USER || 'root';
const DB_PASS = process.env.DB_PASSWORD || 'root';
const DB_NAME = process.env.DB_NAME || 'game';

let pool;

function getPool() {
  if (!pool) {
    pool = mysql.createPool({
      host: DB_HOST,
      port: DB_PORT,
      user: DB_USER,
      password: DB_PASS,
      database: DB_NAME,
      waitForConnections: true,
      connectionLimit: 10,
    });
  }
  return pool;
}

async function initialize() {
  const conn = await mysql.createConnection({
    host: DB_HOST,
    port: DB_PORT,
    user: DB_USER,
    password: DB_PASS,
  });

  await conn.query(`CREATE DATABASE IF NOT EXISTS \`${DB_NAME}\``);
  await conn.end();

  // DB 생성 후 pool 초기화
  pool = mysql.createPool({
    host: DB_HOST,
    port: DB_PORT,
    user: DB_USER,
    password: DB_PASS,
    database: DB_NAME,
    waitForConnections: true,
    connectionLimit: 10,
  });

  await pool.query(`
    CREATE TABLE IF NOT EXISTS users (
      id INT AUTO_INCREMENT PRIMARY KEY,
      username VARCHAR(50) NOT NULL UNIQUE,
      email VARCHAR(100) NOT NULL UNIQUE,
      password VARCHAR(255) NOT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    )
  `);

  // 세션 토큰 컬럼 (중복 로그인 방지)
  await pool.query("ALTER TABLE users ADD COLUMN session_token VARCHAR(64) DEFAULT NULL").catch(() => {});

  await pool.query(`
    CREATE TABLE IF NOT EXISTS characters (
      id INT AUTO_INCREMENT PRIMARY KEY,
      user_id INT NOT NULL,
      name VARCHAR(50) NOT NULL UNIQUE,
      class_type ENUM('풍수사', '무당', '승려', '저승사자') NOT NULL,
      level INT DEFAULT 1,
      hp INT DEFAULT 100,
      mp INT DEFAULT 50,
      attack INT DEFAULT 10,
      defense INT DEFAULT 5,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    )
  `);

  const addCol = (col, def) =>
    pool.query(`ALTER TABLE characters ADD COLUMN ${col} ${def}`).catch(() => {});
  await addCol('exp', 'INT DEFAULT 0');
  await addCol('gold', 'INT DEFAULT 0');
  await addCol('current_hp', 'INT DEFAULT NULL');
  await addCol('current_mp', 'INT DEFAULT NULL');
  await addCol('element', "ENUM('fire','water','earth','wind','neutral') DEFAULT 'neutral'");
  await addCol('stamina', 'INT DEFAULT 10');
  await addCol('max_stamina', 'INT DEFAULT 10');
  await addCol('last_stamina_time', 'TIMESTAMP DEFAULT CURRENT_TIMESTAMP');
  await addCol('prologue_cleared', 'TINYINT DEFAULT 0');
  // 기존 레벨 2 이상 캐릭터는 프롤로그 자동 완료
  await pool.query("UPDATE characters SET prologue_cleared = 1 WHERE level >= 2 AND (prologue_cleared IS NULL OR prologue_cleared = 0)").catch(() => {});

  // 저승사자 직업 추가
  await pool.query("ALTER TABLE characters MODIFY COLUMN class_type ENUM('풍수사', '무당', '승려', '저승사자') NOT NULL").catch(() => {});

  await pool.query(`
    CREATE TABLE IF NOT EXISTS battle_logs (
      id INT AUTO_INCREMENT PRIMARY KEY,
      character_id INT NOT NULL,
      location VARCHAR(50) NOT NULL,
      monster_name VARCHAR(50) NOT NULL,
      result ENUM('victory', 'defeat') NOT NULL,
      rounds INT NOT NULL,
      damage_dealt INT DEFAULT 0,
      damage_taken INT DEFAULT 0,
      exp_gained INT DEFAULT 0,
      gold_gained INT DEFAULT 0,
      level_before INT NOT NULL,
      level_after INT NOT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (character_id) REFERENCES characters(id) ON DELETE CASCADE
    )
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS items (
      id INT AUTO_INCREMENT PRIMARY KEY,
      name VARCHAR(50) NOT NULL UNIQUE,
      type ENUM('weapon', 'armor', 'potion', 'helmet', 'chest', 'boots', 'ring', 'necklace', 'shield') NOT NULL,
      slot VARCHAR(20) DEFAULT NULL,
      weapon_hand ENUM('1h', '2h') DEFAULT NULL,
      description VARCHAR(200),
      price INT NOT NULL,
      sell_price INT NOT NULL,
      effect_hp INT DEFAULT 0,
      effect_mp INT DEFAULT 0,
      effect_attack INT DEFAULT 0,
      effect_defense INT DEFAULT 0,
      required_level INT DEFAULT 1,
      class_restriction VARCHAR(50) DEFAULT NULL
    )
  `);

  // 기존 items 테이블에 새 컬럼 추가 (이미 존재하면 무시)
  await pool.query(`ALTER TABLE items MODIFY COLUMN type ENUM('weapon', 'armor', 'potion', 'helmet', 'chest', 'boots', 'ring', 'necklace', 'shield') NOT NULL`).catch(() => {});
  await pool.query(`ALTER TABLE items ADD COLUMN slot VARCHAR(20) DEFAULT NULL`).catch(() => {});
  await pool.query(`ALTER TABLE items ADD COLUMN weapon_hand ENUM('1h', '2h') DEFAULT NULL`).catch(() => {});

  await pool.query(`
    CREATE TABLE IF NOT EXISTS inventory (
      id INT AUTO_INCREMENT PRIMARY KEY,
      character_id INT NOT NULL,
      item_id INT NOT NULL,
      quantity INT DEFAULT 1,
      equipped TINYINT(1) DEFAULT 0,
      FOREIGN KEY (character_id) REFERENCES characters(id) ON DELETE CASCADE,
      FOREIGN KEY (item_id) REFERENCES items(id),
      KEY idx_char_item (character_id, item_id)
    )
  `);

  // 장비 슬롯 테이블
  await pool.query(`
    CREATE TABLE IF NOT EXISTS equipment (
      id INT AUTO_INCREMENT PRIMARY KEY,
      character_id INT NOT NULL,
      slot VARCHAR(20) NOT NULL,
      item_id INT NOT NULL,
      FOREIGN KEY (character_id) REFERENCES characters(id) ON DELETE CASCADE,
      FOREIGN KEY (item_id) REFERENCES items(id),
      UNIQUE KEY unique_char_slot (character_id, slot)
    )
  `);

  // 기본 아이템 시드
  const [existing] = await pool.query('SELECT COUNT(*) as cnt FROM items');
  if (existing[0].cnt === 0) {
    await pool.query(`INSERT INTO items (name, type, slot, weapon_hand, description, price, sell_price, effect_hp, effect_mp, effect_attack, effect_defense, required_level, class_restriction) VALUES
      ('소환의 부적', 'weapon', 'weapon', '1h', '풍수사 전용. 약한 기운이 깃든 부적.', 50, 25, 0, 10, 5, 0, 1, '풍수사'),
      ('강화 부적', 'weapon', 'weapon', '1h', '풍수사 전용. 강한 영기가 깃든 부적.', 200, 100, 0, 25, 12, 0, 3, '풍수사'),
      ('용의 부적', 'weapon', 'weapon', '2h', '풍수사 전용. 용의 기운이 봉인된 부적.', 800, 400, 0, 50, 25, 0, 6, '풍수사'),
      ('무당 방울', 'weapon', 'weapon', '1h', '무당 전용. 영혼을 부르는 방울.', 50, 25, 0, 5, 4, 2, 1, '무당'),
      ('신령 방울', 'weapon', 'weapon', '1h', '무당 전용. 신령의 힘이 깃든 방울.', 200, 100, 0, 15, 10, 4, 3, '무당'),
      ('천신 방울', 'weapon', 'weapon', '2h', '무당 전용. 천신의 축복을 받은 방울.', 800, 400, 0, 30, 20, 8, 6, '무당'),
      ('수련 목탁', 'weapon', 'weapon', '1h', '승려 전용. 기본 수련용 목탁.', 50, 25, 10, 0, 3, 4, 1, '승려'),
      ('금강 목탁', 'weapon', 'weapon', '1h', '승려 전용. 금강석으로 만든 목탁.', 200, 100, 25, 0, 7, 10, 3, '승려'),
      ('파천 목탁', 'weapon', 'weapon', '2h', '승려 전용. 하늘을 가르는 목탁.', 800, 400, 50, 0, 15, 20, 6, '승려'),
      ('가죽 갑옷', 'chest', 'chest', NULL, '기본적인 가죽 갑옷.', 80, 40, 10, 0, 0, 3, 1, NULL),
      ('사슬 갑옷', 'chest', 'chest', NULL, '촘촘한 사슬로 엮은 갑옷.', 300, 150, 25, 0, 0, 8, 3, NULL),
      ('용린 갑옷', 'chest', 'chest', NULL, '용의 비늘로 만든 갑옷.', 1000, 500, 50, 10, 0, 18, 6, NULL),
      ('체력 물약(소)', 'potion', NULL, NULL, 'HP를 30 회복합니다.', 15, 7, 30, 0, 0, 0, 1, NULL),
      ('체력 물약(중)', 'potion', NULL, NULL, 'HP를 80 회복합니다.', 40, 20, 80, 0, 0, 0, 1, NULL),
      ('체력 물약(대)', 'potion', NULL, NULL, 'HP를 200 회복합니다.', 100, 50, 200, 0, 0, 0, 1, NULL),
      ('마력 물약(소)', 'potion', NULL, NULL, 'MP를 20 회복합니다.', 20, 10, 0, 20, 0, 0, 1, NULL),
      ('마력 물약(중)', 'potion', NULL, NULL, 'MP를 60 회복합니다.', 50, 25, 0, 60, 0, 0, 1, NULL),
      ('마력 물약(대)', 'potion', NULL, NULL, 'MP를 150 회복합니다.', 120, 60, 0, 150, 0, 0, 1, NULL),
      ('가죽 투구', 'helmet', 'helmet', NULL, '기본적인 가죽 투구.', 40, 20, 5, 0, 0, 2, 1, NULL),
      ('철제 투구', 'helmet', 'helmet', NULL, '단단한 철로 만든 투구.', 150, 75, 15, 0, 0, 5, 3, NULL),
      ('용린 투구', 'helmet', 'helmet', NULL, '용의 비늘로 만든 투구.', 600, 300, 30, 5, 0, 10, 6, NULL),
      ('가죽 장화', 'boots', 'boots', NULL, '기본적인 가죽 장화.', 35, 17, 3, 0, 1, 1, 1, NULL),
      ('철제 장화', 'boots', 'boots', NULL, '단단한 철제 장화.', 120, 60, 8, 0, 2, 3, 3, NULL),
      ('용린 장화', 'boots', 'boots', NULL, '용의 비늘로 만든 장화.', 500, 250, 20, 0, 3, 7, 6, NULL),
      ('구리 반지', 'ring', 'ring', NULL, '약간의 마력이 깃든 반지.', 60, 30, 0, 5, 2, 0, 1, NULL),
      ('은 반지', 'ring', 'ring', NULL, '은으로 만든 마법 반지.', 250, 125, 0, 15, 4, 0, 3, NULL),
      ('황금 반지', 'ring', 'ring', NULL, '강력한 마력이 깃든 황금 반지.', 700, 350, 0, 25, 8, 0, 6, NULL),
      ('뼈 목걸이', 'necklace', 'necklace', NULL, '몬스터 뼈로 만든 목걸이.', 50, 25, 5, 5, 1, 1, 1, NULL),
      ('비취 목걸이', 'necklace', 'necklace', NULL, '비취로 장식된 목걸이.', 200, 100, 10, 10, 3, 3, 3, NULL),
      ('용의 눈 목걸이', 'necklace', 'necklace', NULL, '용의 눈이 박힌 전설의 목걸이.', 800, 400, 20, 20, 6, 6, 6, NULL),
      ('나무 방패', 'shield', 'shield', NULL, '가벼운 나무 방패.', 45, 22, 5, 0, 0, 4, 1, NULL),
      ('철제 방패', 'shield', 'shield', NULL, '단단한 철제 방패.', 180, 90, 15, 0, 0, 10, 3, NULL),
      ('용린 방패', 'shield', 'shield', NULL, '용의 비늘로 강화된 방패.', 650, 325, 30, 0, 0, 16, 6, NULL),
      ('사냥 활', 'weapon', 'weapon', '2h', '직선 원거리 공격. 범위4 직선.', 120, 60, 0, 0, 7, 0, 1, NULL),
      ('강철 활', 'weapon', 'weapon', '2h', '강화된 활. 범위4 직선.', 400, 200, 0, 0, 14, 0, 3, NULL),
      ('용골 활', 'weapon', 'weapon', '2h', '용의 뼈로 만든 활. 범위4 직선.', 1200, 600, 0, 0, 22, 0, 6, NULL),
      ('풍수 지팡이', 'weapon', 'weapon', '2h', '풍수사 전용. 십자 범위2 광역.', 150, 75, 0, 20, 8, 0, 2, '풍수사'),
      ('현자의 지팡이', 'weapon', 'weapon', '2h', '풍수사 전용. 십자 범위2 광역.', 600, 300, 0, 40, 16, 0, 4, '풍수사'),
      ('금강장', 'weapon', 'weapon', '2h', '승려 전용. 범위3 직선 창.', 300, 150, 15, 0, 10, 5, 2, '승려'),
      ('용린 금강장', 'weapon', 'weapon', '2h', '승려 전용. 범위3 직선 창.', 900, 450, 30, 0, 18, 10, 5, '승려'),
      ('청동 검', 'weapon', 'weapon', '1h', '기본적인 검. 범위1 마름모.', 100, 50, 0, 0, 8, 0, 1, NULL),
      ('강철 검', 'weapon', 'weapon', '1h', '단단한 강철 검. 범위1 마름모.', 350, 175, 0, 0, 15, 0, 3, NULL),
      ('용살 검', 'weapon', 'weapon', '1h', '용을 베는 전설의 검. 범위1 마름모.', 1100, 550, 0, 0, 24, 0, 6, NULL)
    `);
  } else {
    // 기존 DB에 slot/weapon_hand 값 업데이트
    await pool.query("UPDATE items SET slot = 'weapon', weapon_hand = '1h' WHERE type = 'weapon' AND slot IS NULL AND name NOT LIKE '%용%' AND name NOT LIKE '%파천%' AND name NOT LIKE '%천신%'").catch(() => {});
    await pool.query("UPDATE items SET slot = 'weapon', weapon_hand = '2h' WHERE type = 'weapon' AND slot IS NULL").catch(() => {});
    await pool.query("UPDATE items SET type = 'chest', slot = 'chest' WHERE type = 'armor' AND slot IS NULL").catch(() => {});

    // 새 장비 아이템 추가 (이미 있으면 무시)
    const newItems = [
      "('가죽 투구', 'helmet', 'helmet', NULL, '기본적인 가죽 투구.', 40, 20, 5, 0, 0, 2, 1, NULL)",
      "('철제 투구', 'helmet', 'helmet', NULL, '단단한 철로 만든 투구.', 150, 75, 15, 0, 0, 5, 3, NULL)",
      "('용린 투구', 'helmet', 'helmet', NULL, '용의 비늘로 만든 투구.', 600, 300, 30, 5, 0, 10, 6, NULL)",
      "('가죽 장화', 'boots', 'boots', NULL, '기본적인 가죽 장화.', 35, 17, 3, 0, 1, 1, 1, NULL)",
      "('철제 장화', 'boots', 'boots', NULL, '단단한 철제 장화.', 120, 60, 8, 0, 2, 3, 3, NULL)",
      "('용린 장화', 'boots', 'boots', NULL, '용의 비늘로 만든 장화.', 500, 250, 20, 0, 3, 7, 6, NULL)",
      "('구리 반지', 'ring', 'ring', NULL, '약간의 마력이 깃든 반지.', 60, 30, 0, 5, 2, 0, 1, NULL)",
      "('은 반지', 'ring', 'ring', NULL, '은으로 만든 마법 반지.', 250, 125, 0, 15, 4, 0, 3, NULL)",
      "('황금 반지', 'ring', 'ring', NULL, '강력한 마력이 깃든 황금 반지.', 700, 350, 0, 25, 8, 0, 6, NULL)",
      "('뼈 목걸이', 'necklace', 'necklace', NULL, '몬스터 뼈로 만든 목걸이.', 50, 25, 5, 5, 1, 1, 1, NULL)",
      "('비취 목걸이', 'necklace', 'necklace', NULL, '비취로 장식된 목걸이.', 200, 100, 10, 10, 3, 3, 3, NULL)",
      "('용의 눈 목걸이', 'necklace', 'necklace', NULL, '용의 눈이 박힌 전설의 목걸이.', 800, 400, 20, 20, 6, 6, 6, NULL)",
      "('나무 방패', 'shield', 'shield', NULL, '가벼운 나무 방패.', 45, 22, 5, 0, 0, 4, 1, NULL)",
      "('철제 방패', 'shield', 'shield', NULL, '단단한 철제 방패.', 180, 90, 15, 0, 0, 10, 3, NULL)",
      "('용린 방패', 'shield', 'shield', NULL, '용의 비늘로 강화된 방패.', 650, 325, 30, 0, 0, 16, 6, NULL)",
      "('사냥 활', 'weapon', 'weapon', '2h', '직선 원거리 공격. 범위4 직선.', 120, 60, 0, 0, 7, 0, 1, NULL)",
      "('강철 활', 'weapon', 'weapon', '2h', '강화된 활. 범위4 직선.', 400, 200, 0, 0, 14, 0, 3, NULL)",
      "('용골 활', 'weapon', 'weapon', '2h', '용의 뼈로 만든 활. 범위4 직선.', 1200, 600, 0, 0, 22, 0, 6, NULL)",
      "('풍수 지팡이', 'weapon', 'weapon', '2h', '풍수사 전용. 십자 범위2 광역.', 150, 75, 0, 20, 8, 0, 2, '풍수사')",
      "('현자의 지팡이', 'weapon', 'weapon', '2h', '풍수사 전용. 십자 범위2 광역.', 600, 300, 0, 40, 16, 0, 4, '풍수사')",
      "('금강장', 'weapon', 'weapon', '2h', '승려 전용. 범위3 직선 창.', 300, 150, 15, 0, 10, 5, 2, '승려')",
      "('용린 금강장', 'weapon', 'weapon', '2h', '승려 전용. 범위3 직선 창.', 900, 450, 30, 0, 18, 10, 5, '승려')",
      "('청동 검', 'weapon', 'weapon', '1h', '기본적인 검. 범위1 마름모.', 100, 50, 0, 0, 8, 0, 1, NULL)",
      "('강철 검', 'weapon', 'weapon', '1h', '단단한 강철 검. 범위1 마름모.', 350, 175, 0, 0, 15, 0, 3, NULL)",
      "('용살 검', 'weapon', 'weapon', '1h', '용을 베는 전설의 검. 범위1 마름모.', 1100, 550, 0, 0, 24, 0, 6, NULL)",
    ];
    for (const v of newItems) {
      await pool.query(`INSERT IGNORE INTO items (name, type, slot, weapon_hand, description, price, sell_price, effect_hp, effect_mp, effect_attack, effect_defense, required_level, class_restriction) VALUES ${v}`).catch(() => {});
    }
  }

  // quests 테이블이 이미 있으면 재생성하지 않음
  const [questTableCheck] = await pool.query(`SELECT COUNT(*) as cnt FROM information_schema.tables WHERE table_schema = 'game' AND table_name = 'quests'`);
  const questsExist = questTableCheck[0].cnt > 0;

  if (!questsExist) {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS quests (
      id INT AUTO_INCREMENT PRIMARY KEY,
      title VARCHAR(100) NOT NULL,
      description VARCHAR(300) NOT NULL,
      category ENUM('main', 'daily', 'bounty', 'achievement') NOT NULL DEFAULT 'bounty',
      type ENUM('hunt', 'hunt_location', 'level', 'clear_stage', 'clear_dungeon', 'collect_material') NOT NULL,
      target VARCHAR(50) NOT NULL,
      target_count INT NOT NULL DEFAULT 1,
      reward_exp INT DEFAULT 0,
      reward_gold INT DEFAULT 0,
      reward_item_id INT DEFAULT NULL,
      reward_item_qty INT DEFAULT 1,
      required_level INT DEFAULT 1,
      prerequisite_quest_id INT DEFAULT NULL,
      chapter INT DEFAULT 0,
      sort_order INT DEFAULT 0,
      icon VARCHAR(10) DEFAULT NULL
    )
  `);

  await pool.query(`INSERT INTO quests (title, description, category, type, target, target_count, reward_exp, reward_gold, reward_item_id, reward_item_qty, required_level, prerequisite_quest_id, chapter, sort_order, icon) VALUES
    -- ========== 메인 퀘스트 Chapter 1: 어둠의 시작 ==========
    ('모험의 시작', '어둠의 숲에서 몬스터 3마리를 처치하며 실전 경험을 쌓으세요.', 'main', 'hunt_location', 'forest', 3, 80, 50, NULL, 0, 1, NULL, 1, 1, '⚔️'),
    ('숲의 위협', '어둠의 숲에서 몬스터 8마리를 처치하고 숲을 정화하세요.', 'main', 'hunt_location', 'forest', 8, 150, 100, NULL, 0, 1, 1, 1, 2, '🌲'),
    ('들쥐의 습격', '들쥐 5마리를 처치하여 마을의 식량을 지키세요.', 'main', 'hunt', '들쥐', 5, 100, 70, NULL, 0, 1, 2, 1, 3, '🐀'),
    ('늑대 소탕전', '야생 늑대 5마리를 처치하여 길을 안전하게 만드세요.', 'main', 'hunt', '야생 늑대', 5, 150, 100, NULL, 0, 1, 3, 1, 4, '🐺'),
    ('첫 번째 성장', '레벨 3을 달성하여 모험가로서의 자질을 증명하세요.', 'main', 'level', '3', 1, 120, 100, NULL, 0, 1, 4, 1, 5, '⭐'),

    -- ========== 메인 퀘스트 Chapter 2: 동굴의 비밀 ==========
    ('지하 세계로', '지하 동굴에서 몬스터 5마리를 처치하세요.', 'main', 'hunt_location', 'cave', 5, 200, 150, NULL, 0, 2, 5, 2, 1, '🕳️'),
    ('독거미 소탕', '독거미 8마리를 처치하여 동굴 입구를 정리하세요.', 'main', 'hunt', '독거미', 8, 250, 180, 13, 3, 2, 6, 2, 2, '🕷️'),
    ('동굴 박쥐 퇴치', '동굴 박쥐 6마리를 처치하세요.', 'main', 'hunt', '동굴 박쥐', 6, 280, 200, 14, 2, 2, 7, 2, 3, '🦇'),
    ('슬라임 동굴 탐사', '슬라임 동굴의 스테이지를 3개 이상 클리어하세요.', 'main', 'clear_dungeon', 'slime_cave', 3, 350, 250, NULL, 0, 2, 8, 2, 4, '🟢'),
    ('숙련 모험가', '레벨 5를 달성하세요.', 'main', 'level', '5', 1, 300, 200, NULL, 0, 2, 9, 2, 5, '⭐'),

    -- ========== 메인 퀘스트 Chapter 3: 확장되는 세계 ==========
    ('골렘 파괴자', '골렘 3마리를 처치하세요.', 'main', 'hunt', '골렘', 3, 350, 250, NULL, 0, 3, 10, 3, 1, '🪨'),
    ('독안개 늪 진출', '독안개 늪에서 몬스터 5마리를 처치하세요.', 'main', 'hunt_location', 'swamp', 5, 400, 300, NULL, 0, 3, 11, 3, 2, '🌿'),
    ('도깨비 마을 습격', '도깨비 마을 스테이지를 3개 클리어하세요.', 'main', 'clear_dungeon', 'goblin', 3, 450, 350, NULL, 0, 3, 12, 3, 3, '👺'),
    ('산악 원정대', '영혼의 산에서 몬스터 5마리를 처치하세요.', 'main', 'hunt_location', 'mountain', 5, 500, 400, NULL, 0, 3, 13, 3, 4, '🏔️'),
    ('레벨 8 달성', '레벨 8을 달성하여 전사로 거듭나세요.', 'main', 'level', '8', 1, 500, 400, NULL, 0, 3, 14, 3, 5, '⭐'),

    -- ========== 메인 퀘스트 Chapter 4: 어둠의 심연 ==========
    ('해저 유적 탐사', '해저 유적 스테이지를 5개 클리어하세요.', 'main', 'clear_dungeon', 'ocean', 5, 600, 500, NULL, 0, 4, 15, 4, 1, '🌊'),
    ('정령의 숲 정화', '정령의 숲에서 몬스터 8마리를 처치하세요.', 'main', 'hunt_location', 'spirit_forest', 8, 700, 550, NULL, 0, 4, 16, 4, 2, '🧚'),
    ('사원의 비밀', '폐허 사원에서 몬스터 5마리를 처치하세요.', 'main', 'hunt_location', 'temple', 5, 800, 600, NULL, 0, 4, 17, 4, 3, '🏛️'),
    ('원혼 정화', '원혼을 4마리 처치하세요.', 'main', 'hunt', '원혼', 4, 850, 650, 15, 2, 4, 18, 4, 4, '👻'),
    ('레벨 12 달성', '레벨 12를 달성하세요.', 'main', 'level', '12', 1, 800, 600, NULL, 0, 4, 19, 4, 5, '⭐'),

    -- ========== 메인 퀘스트 Chapter 5: 최종 결전 ==========
    ('어둠의 수호자 토벌', '어둠의 수호자를 2마리 처치하세요.', 'main', 'hunt', '어둠의 수호자', 2, 1000, 800, NULL, 0, 5, 20, 5, 1, '💀'),
    ('마계 균열 돌파', '마계 균열 스테이지를 5개 클리어하세요.', 'main', 'clear_dungeon', 'demon', 5, 1200, 1000, NULL, 0, 5, 21, 5, 2, '😈'),
    ('용의 둥지 도전', '용의 둥지 스테이지를 3개 클리어하세요.', 'main', 'clear_dungeon', 'dragon', 3, 1500, 1200, NULL, 0, 7, 22, 5, 3, '🐉'),
    ('전설의 모험가', '레벨 15를 달성하세요.', 'main', 'level', '15', 1, 2000, 1500, NULL, 0, 5, 23, 5, 4, '👑'),

    -- ========== 일일 퀘스트 ==========
    ('일일 사냥', '아무 던전에서 몬스터 10마리를 처치하세요.', 'daily', 'hunt_location', 'any', 10, 100, 80, NULL, 0, 1, NULL, 0, 1, '⚔️'),
    ('스테이지 도전', '스테이지 전투를 2회 완료하세요.', 'daily', 'clear_stage', 'any', 2, 120, 100, NULL, 0, 1, NULL, 0, 2, '🗺️'),
    ('던전 탐험', '던전 스테이지를 2회 클리어하세요.', 'daily', 'clear_dungeon', 'any', 2, 120, 100, NULL, 0, 1, NULL, 0, 3, '🏰'),
    ('정예 사냥꾼', '아무 던전에서 몬스터 20마리를 처치하세요.', 'daily', 'hunt_location', 'any', 20, 200, 150, NULL, 0, 3, NULL, 0, 4, '🎯'),
    ('소재 수집가', '재료를 5개 획득하세요.', 'daily', 'collect_material', 'any', 5, 80, 120, NULL, 0, 1, NULL, 0, 5, '🧪'),

    -- ========== 현상금 의뢰 (Bounty) ==========
    ('들쥐 퇴치 의뢰', '들쥐를 10마리 처치하세요.', 'bounty', 'hunt', '들쥐', 10, 120, 80, NULL, 0, 1, NULL, 0, 1, '🐀'),
    ('야생 늑대 현상금', '야생 늑대를 8마리 처치하세요.', 'bounty', 'hunt', '야생 늑대', 8, 180, 120, NULL, 0, 1, NULL, 0, 2, '🐺'),
    ('독거미 구제', '독거미를 10마리 처치하세요.', 'bounty', 'hunt', '독거미', 10, 200, 150, 13, 2, 1, NULL, 0, 3, '🕷️'),
    ('동굴 박쥐 소탕', '동굴 박쥐를 8마리 처치하세요.', 'bounty', 'hunt', '동굴 박쥐', 8, 220, 160, 14, 2, 2, NULL, 0, 4, '🦇'),
    ('골렘 현상 수배', '골렘을 5마리 처치하세요.', 'bounty', 'hunt', '골렘', 5, 350, 250, NULL, 0, 3, NULL, 0, 5, '🪨'),
    ('숲의 청소부', '어둠의 숲에서 몬스터 15마리를 처치하세요.', 'bounty', 'hunt_location', 'forest', 15, 200, 150, NULL, 0, 1, NULL, 0, 6, '🌲'),
    ('동굴 탐사 의뢰', '지하 동굴에서 몬스터 15마리를 처치하세요.', 'bounty', 'hunt_location', 'cave', 15, 300, 220, NULL, 0, 2, NULL, 0, 7, '🕳️'),
    ('늪지 정화 의뢰', '독안개 늪에서 몬스터 10마리를 처치하세요.', 'bounty', 'hunt_location', 'swamp', 10, 350, 250, NULL, 0, 2, NULL, 0, 8, '🌿'),
    ('사원 정화 의뢰', '폐허 사원에서 몬스터 10마리를 처치하세요.', 'bounty', 'hunt_location', 'temple', 10, 500, 400, NULL, 0, 4, NULL, 0, 9, '🏛️'),
    ('원혼 퇴마 의뢰', '원혼을 6마리 처치하세요.', 'bounty', 'hunt', '원혼', 6, 500, 400, 15, 2, 4, NULL, 0, 10, '👻'),
    ('어둠의 수호자 현상금', '어둠의 수호자를 3마리 처치하세요.', 'bounty', 'hunt', '어둠의 수호자', 3, 800, 600, NULL, 0, 5, NULL, 0, 11, '💀'),

    -- ========== 업적 (Achievement) ==========
    ('첫 발걸음', '첫 번째 전투에서 승리하세요.', 'achievement', 'hunt_location', 'any', 1, 50, 30, NULL, 0, 1, NULL, 0, 1, '🏅'),
    ('10킬 달성', '몬스터를 총 10마리 처치하세요.', 'achievement', 'hunt_location', 'any', 10, 100, 80, NULL, 0, 1, NULL, 0, 2, '🎖️'),
    ('50킬 달성', '몬스터를 총 50마리 처치하세요.', 'achievement', 'hunt_location', 'any', 50, 300, 200, NULL, 0, 1, NULL, 0, 3, '🏆'),
    ('100킬 달성', '몬스터를 총 100마리 처치하세요.', 'achievement', 'hunt_location', 'any', 100, 500, 400, NULL, 0, 1, NULL, 0, 4, '💎'),
    ('300킬 달성', '몬스터를 총 300마리 처치하세요.', 'achievement', 'hunt_location', 'any', 300, 1000, 800, NULL, 0, 1, NULL, 0, 5, '🌟'),
    ('던전 마스터', '던전 스테이지를 총 30개 클리어하세요.', 'achievement', 'clear_dungeon', 'any', 30, 500, 400, NULL, 0, 1, NULL, 0, 6, '🏰'),
    ('스테이지 정복자', '스테이지를 총 30개 클리어하세요.', 'achievement', 'clear_stage', 'any', 30, 500, 400, NULL, 0, 1, NULL, 0, 7, '🗺️'),
    ('레벨 10 달성', '레벨 10에 도달하세요.', 'achievement', 'level', '10', 1, 500, 300, NULL, 0, 1, NULL, 0, 8, '⭐'),
    ('레벨 20 달성', '레벨 20에 도달하세요.', 'achievement', 'level', '20', 1, 1000, 600, NULL, 0, 1, NULL, 0, 9, '🌟'),
    ('소재 수집가', '재료를 총 50개 수집하세요.', 'achievement', 'collect_material', 'any', 50, 300, 250, NULL, 0, 1, NULL, 0, 10, '🧪')
  `);
  } // end if (!questsExist)

  await pool.query(`
    CREATE TABLE IF NOT EXISTS character_quests (
      id INT AUTO_INCREMENT PRIMARY KEY,
      character_id INT NOT NULL,
      quest_id INT NOT NULL,
      status ENUM('active', 'completed', 'rewarded') NOT NULL DEFAULT 'active',
      progress INT DEFAULT 0,
      accepted_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      completed_at TIMESTAMP NULL,
      FOREIGN KEY (character_id) REFERENCES characters(id) ON DELETE CASCADE,
      FOREIGN KEY (quest_id) REFERENCES quests(id),
      UNIQUE KEY unique_char_quest (character_id, quest_id)
    )
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS character_daily_reset (
      id INT AUTO_INCREMENT PRIMARY KEY,
      character_id INT NOT NULL,
      last_reset DATE NOT NULL,
      FOREIGN KEY (character_id) REFERENCES characters(id) ON DELETE CASCADE,
      UNIQUE KEY unique_char_daily (character_id)
    )
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS skills (
      id INT AUTO_INCREMENT PRIMARY KEY,
      name VARCHAR(50) NOT NULL,
      class_type VARCHAR(20) NOT NULL,
      description VARCHAR(200) NOT NULL,
      type ENUM('attack', 'heal', 'buff') NOT NULL,
      mp_cost INT NOT NULL DEFAULT 0,
      damage_multiplier FLOAT DEFAULT 1.0,
      heal_amount INT DEFAULT 0,
      buff_stat VARCHAR(20) DEFAULT NULL,
      buff_value INT DEFAULT 0,
      buff_duration INT DEFAULT 0,
      required_level INT DEFAULT 1,
      cooldown INT DEFAULT 0
    )
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS character_skills (
      id INT AUTO_INCREMENT PRIMARY KEY,
      character_id INT NOT NULL,
      skill_id INT NOT NULL,
      FOREIGN KEY (character_id) REFERENCES characters(id) ON DELETE CASCADE,
      FOREIGN KEY (skill_id) REFERENCES skills(id),
      UNIQUE KEY unique_char_skill (character_id, skill_id)
    )
  `);

  const [existingSkills] = await pool.query('SELECT COUNT(*) as cnt FROM skills');
  if (existingSkills[0].cnt === 0) {
    await pool.query(`INSERT INTO skills (name, class_type, description, type, mp_cost, damage_multiplier, heal_amount, buff_stat, buff_value, buff_duration, required_level, cooldown) VALUES
      ('화염부', '풍수사', '불의 기운을 모아 적에게 화염을 날린다.', 'attack', 10, 1.8, 0, NULL, 0, 0, 1, 0),
      ('수맥파', '풍수사', '대지의 수맥을 터뜨려 강력한 일격을 가한다.', 'attack', 20, 2.4, 0, NULL, 0, 0, 3, 1),
      ('풍수결계', '풍수사', '풍수 결계를 펼쳐 방어력을 높인다.', 'buff', 15, 0, 0, 'defense', 8, 3, 2, 2),
      ('용맥폭발', '풍수사', '용맥의 힘을 폭발시켜 막대한 피해를 입힌다.', 'attack', 40, 3.5, 0, NULL, 0, 0, 6, 3),
      ('기운회복', '풍수사', '자연의 기운을 흡수하여 체력을 회복한다.', 'heal', 25, 0, 60, NULL, 0, 0, 4, 2),

      ('부적소환', '무당', '저주의 부적을 소환하여 적을 공격한다.', 'attack', 8, 1.6, 0, NULL, 0, 0, 1, 0),
      ('영혼흡수', '무당', '적의 생명력을 흡수하여 피해를 주고 체력을 회복한다.', 'attack', 18, 2.0, 30, NULL, 0, 0, 3, 1),
      ('신내림', '무당', '신의 힘을 빌려 공격력을 높인다.', 'buff', 15, 0, 0, 'attack', 8, 3, 2, 2),
      ('강신술', '무당', '강력한 영혼을 불러 적에게 큰 피해를 입힌다.', 'attack', 35, 3.2, 0, NULL, 0, 0, 6, 3),
      ('치유의식', '무당', '치유의 의식을 행하여 체력을 회복한다.', 'heal', 20, 0, 50, NULL, 0, 0, 4, 2),

      ('금강권', '승려', '금강의 힘을 담은 주먹으로 적을 강타한다.', 'attack', 8, 1.7, 0, NULL, 0, 0, 1, 0),
      ('파사권', '승려', '사악함을 부수는 강력한 권법을 펼친다.', 'attack', 18, 2.3, 0, NULL, 0, 0, 3, 1),
      ('철벽수호', '승려', '몸을 강철처럼 단단하게 만든다.', 'buff', 12, 0, 0, 'defense', 12, 3, 2, 2),
      ('나한신권', '승려', '나한의 힘을 깨워 초월적인 일격을 가한다.', 'attack', 35, 3.0, 0, NULL, 0, 0, 6, 3),
      ('선정치유', '승려', '깊은 선정에 들어 체력을 크게 회복한다.', 'heal', 20, 0, 80, NULL, 0, 0, 4, 2)
    `);
  }

  // ========== 소환수 시스템 ==========
  await pool.query(`
    CREATE TABLE IF NOT EXISTS summon_templates (
      id INT AUTO_INCREMENT PRIMARY KEY,
      name VARCHAR(50) NOT NULL UNIQUE,
      type VARCHAR(20) NOT NULL,
      icon VARCHAR(10) NOT NULL,
      price INT NOT NULL,
      sell_price INT NOT NULL,
      base_hp INT DEFAULT 50,
      base_mp INT DEFAULT 20,
      base_attack INT DEFAULT 5,
      base_defense INT DEFAULT 3,
      required_level INT DEFAULT 1
    )
  `);

  // summon_templates에 range_type 컬럼 추가 (magic 포함)
  await pool.query("ALTER TABLE summon_templates ADD COLUMN range_type ENUM('melee','ranged','magic') DEFAULT 'melee'").catch(() => {});
  await pool.query("ALTER TABLE summon_templates MODIFY COLUMN range_type ENUM('melee','ranged','magic') DEFAULT 'melee'").catch(() => {});
  await pool.query("ALTER TABLE summon_templates ADD COLUMN element ENUM('fire','water','earth','wind','neutral') DEFAULT 'neutral'").catch(() => {});

  await pool.query(`
    CREATE TABLE IF NOT EXISTS character_summons (
      id INT AUTO_INCREMENT PRIMARY KEY,
      character_id INT NOT NULL,
      template_id INT NOT NULL,
      level INT DEFAULT 1,
      exp INT DEFAULT 0,
      hp INT DEFAULT 0,
      mp INT DEFAULT 0,
      attack INT DEFAULT 0,
      defense INT DEFAULT 0,
      FOREIGN KEY (character_id) REFERENCES characters(id) ON DELETE CASCADE,
      FOREIGN KEY (template_id) REFERENCES summon_templates(id),
      UNIQUE KEY unique_char_summon (character_id, template_id)
    )
  `);

  await pool.query(`ALTER TABLE character_summons ADD COLUMN level INT DEFAULT 1`).catch(() => {});
  await pool.query(`ALTER TABLE character_summons ADD COLUMN exp INT DEFAULT 0`).catch(() => {});

  await pool.query(`
    CREATE TABLE IF NOT EXISTS summon_equipment (
      id INT AUTO_INCREMENT PRIMARY KEY,
      summon_id INT NOT NULL,
      slot VARCHAR(20) NOT NULL,
      item_id INT NOT NULL,
      FOREIGN KEY (summon_id) REFERENCES character_summons(id) ON DELETE CASCADE,
      FOREIGN KEY (item_id) REFERENCES items(id),
      UNIQUE KEY unique_summon_slot (summon_id, slot)
    )
  `);

  // 소환수 스킬 테이블
  await pool.query(`
    CREATE TABLE IF NOT EXISTS summon_skills (
      id INT AUTO_INCREMENT PRIMARY KEY,
      name VARCHAR(50) NOT NULL,
      summon_type VARCHAR(20) DEFAULT NULL,
      template_id INT DEFAULT NULL,
      description VARCHAR(200) NOT NULL,
      type ENUM('attack', 'heal', 'buff') NOT NULL,
      mp_cost INT NOT NULL DEFAULT 0,
      damage_multiplier FLOAT DEFAULT 1.0,
      heal_amount INT DEFAULT 0,
      buff_stat VARCHAR(20) DEFAULT NULL,
      buff_value INT DEFAULT 0,
      buff_duration INT DEFAULT 0,
      required_level INT DEFAULT 1,
      cooldown INT DEFAULT 0,
      is_common TINYINT(1) DEFAULT 0
    )
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS summon_learned_skills (
      id INT AUTO_INCREMENT PRIMARY KEY,
      summon_id INT NOT NULL,
      skill_id INT NOT NULL,
      FOREIGN KEY (summon_id) REFERENCES character_summons(id) ON DELETE CASCADE,
      FOREIGN KEY (skill_id) REFERENCES summon_skills(id),
      UNIQUE KEY unique_summon_skill (summon_id, skill_id)
    )
  `);

  const [existingSummonSkills] = await pool.query('SELECT COUNT(*) as cnt FROM summon_skills');
  if (existingSummonSkills[0].cnt === 0) {
    await pool.query(`INSERT INTO summon_skills (name, summon_type, template_id, description, type, mp_cost, damage_multiplier, heal_amount, buff_stat, buff_value, buff_duration, required_level, cooldown, is_common) VALUES
      ('돌진', NULL, NULL, '적에게 돌진하여 피해를 입힌다.', 'attack', 5, 1.5, 0, NULL, 0, 0, 1, 0, 1),
      ('집중', NULL, NULL, '집중하여 공격력을 높인다.', 'buff', 8, 0, 0, 'attack', 5, 3, 2, 2, 1),
      ('생명력 흡수', NULL, NULL, '적의 생명력을 일부 흡수한다.', 'attack', 12, 1.3, 15, NULL, 0, 0, 3, 1, 1),
      ('수호 태세', NULL, NULL, '방어 태세를 취하여 방어력을 높인다.', 'buff', 10, 0, 0, 'defense', 8, 3, 4, 2, 1),

      ('저주의 손길', '귀신', NULL, '저주의 기운으로 적을 공격한다.', 'attack', 8, 2.0, 0, NULL, 0, 0, 1, 0, 0),
      ('원한 폭발', '귀신', NULL, '쌓인 원한을 터뜨려 강력한 피해를 입힌다.', 'attack', 20, 3.5, 0, NULL, 0, 0, 4, 2, 0),
      ('영혼 치유', '귀신', NULL, '영혼의 힘으로 체력을 회복한다.', 'heal', 15, 0, 40, NULL, 0, 0, 3, 2, 0),

      ('맹독 공격', '몬스터', NULL, '독을 품은 공격으로 적을 물어뜯는다.', 'attack', 7, 1.8, 0, NULL, 0, 0, 1, 0, 0),
      ('야성 해방', '몬스터', NULL, '야성의 힘을 해방하여 공격력을 높인다.', 'buff', 12, 0, 0, 'attack', 8, 3, 3, 2, 0),
      ('포식자의 일격', '몬스터', NULL, '치명적인 일격으로 큰 피해를 입힌다.', 'attack', 22, 4.0, 0, NULL, 0, 0, 5, 3, 0),

      ('정령의 축복', '정령', NULL, '정령의 축복으로 체력을 회복한다.', 'heal', 10, 0, 50, NULL, 0, 0, 1, 1, 0),
      ('원소 폭발', '정령', NULL, '원소의 힘을 폭발시켜 적을 공격한다.', 'attack', 15, 2.5, 0, NULL, 0, 0, 3, 1, 0),
      ('원소 강화', '정령', NULL, '원소의 기운으로 모든 능력을 높인다.', 'buff', 20, 0, 0, 'attack', 6, 4, 4, 3, 0),

      ('죽음의 손아귀', '언데드', NULL, '죽음의 기운으로 적을 움켜쥔다.', 'attack', 8, 2.2, 0, NULL, 0, 0, 1, 0, 0),
      ('뼈 갑옷', '언데드', NULL, '뼈로 된 갑옷을 둘러 방어력을 높인다.', 'buff', 10, 0, 0, 'defense', 10, 3, 2, 2, 0),
      ('부활의 힘', '언데드', NULL, '언데드의 힘으로 체력을 대폭 회복한다.', 'heal', 25, 0, 70, NULL, 0, 0, 5, 3, 0),

      ('구미호 매혹', NULL, 3, '구미호의 매혹으로 적의 방어력을 약화시킨다.', 'attack', 18, 2.8, 0, NULL, 0, 0, 3, 2, 0),
      ('골렘 지진', NULL, 6, '대지를 흔들어 강력한 충격파를 일으킨다.', 'attack', 15, 3.0, 0, NULL, 0, 0, 2, 2, 0),
      ('독거미 맹독', NULL, 7, '치명적인 맹독을 뿜어 적을 공격한다.', 'attack', 16, 2.5, 0, NULL, 0, 0, 3, 1, 0),
      ('리치의 저주', NULL, 12, '강력한 저주를 걸어 적에게 막대한 피해를 입힌다.', 'attack', 30, 5.0, 0, NULL, 0, 0, 5, 3, 0)
    `);
  }

  const [existingSummons] = await pool.query('SELECT COUNT(*) as cnt FROM summon_templates');
  if (existingSummons[0].cnt === 0) {
    await pool.query(`INSERT INTO summon_templates (name, type, icon, price, sell_price, base_hp, base_mp, base_attack, base_defense, required_level) VALUES
      ('떠도는 원혼', '귀신', '👻', 200, 100, 40, 15, 6, 3, 1),
      ('묘지 귀신', '귀신', '👻', 450, 225, 65, 25, 10, 5, 2),
      ('구미호 영혼', '귀신', '🦊', 800, 400, 90, 40, 16, 8, 4),
      ('들쥐 소환수', '몬스터', '🐀', 100, 50, 25, 5, 4, 2, 1),
      ('야생 늑대', '몬스터', '🐺', 300, 150, 55, 10, 9, 5, 2),
      ('골렘 파편', '몬스터', '🪨', 500, 250, 100, 5, 7, 15, 3),
      ('독거미 여왕', '몬스터', '🕷️', 700, 350, 70, 20, 14, 7, 4),
      ('물의 정령', '정령', '💧', 400, 200, 60, 50, 8, 6, 3),
      ('불의 정령', '정령', '🔥', 500, 250, 55, 45, 14, 4, 3),
      ('바람의 정령', '정령', '🌪️', 600, 300, 50, 55, 12, 5, 4),
      ('해골 전사', '언데드', '💀', 250, 125, 70, 10, 8, 8, 2),
      ('리치', '언데드', '☠️', 1500, 750, 80, 60, 18, 10, 6)
    `);
  }

  // 소환수 range_type 설정: 정령/귀신 → magic, 몬스터 → melee, 리치(언데드 마법) → magic
  await pool.query("UPDATE summon_templates SET range_type='magic' WHERE type IN ('귀신','정령')").catch(() => {});
  await pool.query("UPDATE summon_templates SET range_type='melee' WHERE type IN ('몬스터')").catch(() => {});
  await pool.query("UPDATE summon_templates SET range_type='magic' WHERE type='언데드' AND name='리치'").catch(() => {});
  await pool.query("UPDATE summon_templates SET range_type='melee' WHERE type='언데드' AND name != '리치'").catch(() => {});

  // ========== 레벨별 성장률 테이블 ==========
  await pool.query(`
    CREATE TABLE IF NOT EXISTS class_growth_rates (
      id INT AUTO_INCREMENT PRIMARY KEY,
      class_type VARCHAR(20) NOT NULL,
      hp_per_level FLOAT NOT NULL DEFAULT 10,
      mp_per_level FLOAT NOT NULL DEFAULT 5,
      attack_per_level FLOAT NOT NULL DEFAULT 2,
      defense_per_level FLOAT NOT NULL DEFAULT 1,
      phys_attack_per_level FLOAT NOT NULL DEFAULT 2,
      phys_defense_per_level FLOAT NOT NULL DEFAULT 1,
      mag_attack_per_level FLOAT NOT NULL DEFAULT 1,
      mag_defense_per_level FLOAT NOT NULL DEFAULT 1,
      crit_rate_per_10level FLOAT NOT NULL DEFAULT 1,
      evasion_per_10level FLOAT NOT NULL DEFAULT 1,
      UNIQUE KEY unique_class (class_type)
    )
  `);

  const [existingGrowth] = await pool.query('SELECT COUNT(*) as cnt FROM class_growth_rates');
  if (existingGrowth[0].cnt === 0) {
    await pool.query(`INSERT INTO class_growth_rates
      (class_type, hp_per_level, mp_per_level, attack_per_level, defense_per_level,
       phys_attack_per_level, phys_defense_per_level, mag_attack_per_level, mag_defense_per_level,
       crit_rate_per_10level, evasion_per_10level)
      VALUES
      ('풍수사', 8, 8, 2.0, 1.2, 0.8, 0.7, 2.8, 2.2, 0.15, 0.15),
      ('무당',  10, 6, 2.0, 1.5, 1.8, 1.2, 2.2, 1.8, 0.2, 0.2),
      ('승려', 14, 4, 2.5, 2.5, 2.5, 2.5, 1.0, 1.5, 0.15, 0.08)
    `);
  }

  // 소환수 타입별 성장률
  await pool.query(`
    CREATE TABLE IF NOT EXISTS summon_growth_rates (
      id INT AUTO_INCREMENT PRIMARY KEY,
      summon_type VARCHAR(20) NOT NULL,
      hp_per_level FLOAT NOT NULL DEFAULT 5,
      mp_per_level FLOAT NOT NULL DEFAULT 2,
      attack_per_level FLOAT NOT NULL DEFAULT 1,
      defense_per_level FLOAT NOT NULL DEFAULT 1,
      phys_attack_per_level FLOAT NOT NULL DEFAULT 1,
      phys_defense_per_level FLOAT NOT NULL DEFAULT 1,
      mag_attack_per_level FLOAT NOT NULL DEFAULT 1,
      mag_defense_per_level FLOAT NOT NULL DEFAULT 1,
      crit_rate_per_10level FLOAT NOT NULL DEFAULT 1,
      evasion_per_10level FLOAT NOT NULL DEFAULT 1,
      UNIQUE KEY unique_type (summon_type)
    )
  `);

  const [existingSumGrowth] = await pool.query('SELECT COUNT(*) as cnt FROM summon_growth_rates');
  if (existingSumGrowth[0].cnt === 0) {
    await pool.query(`INSERT INTO summon_growth_rates
      (summon_type, hp_per_level, mp_per_level, attack_per_level, defense_per_level,
       phys_attack_per_level, phys_defense_per_level, mag_attack_per_level, mag_defense_per_level,
       crit_rate_per_10level, evasion_per_10level)
      VALUES
      ('몬스터', 7, 1, 1.5, 1.5, 1.8, 1.5, 0.3, 0.3, 2, 1),
      ('귀신',   5, 4, 1.0, 0.8, 0.4, 0.4, 1.8, 1.5, 2, 3),
      ('정령',   5, 5, 1.2, 0.8, 0.4, 0.5, 2.0, 1.8, 1, 1),
      ('언데드', 6, 3, 1.2, 1.2, 1.2, 1.0, 1.0, 0.8, 1, 1)
    `);
  }

  // ========== 몬스터 카테고리 ==========
  await pool.query(`
    CREATE TABLE IF NOT EXISTS monster_categories (
      id INT AUTO_INCREMENT PRIMARY KEY,
      name VARCHAR(50) NOT NULL UNIQUE,
      icon VARCHAR(10) DEFAULT '👹',
      description VARCHAR(200)
    )
  `);

  const [existingCats] = await pool.query('SELECT COUNT(*) as cnt FROM monster_categories');
  if (existingCats[0].cnt === 0) {
    await pool.query(`INSERT INTO monster_categories (name, icon, description) VALUES
      ('야수', '🐺', '숲과 들판에 서식하는 야생 동물 몬스터'),
      ('곤충/벌레', '🕷️', '독과 끈적한 실을 사용하는 벌레류 몬스터'),
      ('언데드', '💀', '죽음에서 되돌아온 불사의 존재'),
      ('귀신/원혼', '👻', '한을 품고 떠도는 영혼과 귀신'),
      ('정령', '✨', '자연의 원소에서 태어난 정령'),
      ('악마/마족', '😈', '지옥에서 온 악의 존재'),
      ('용족', '🐉', '고대부터 이어온 드래곤의 혈통'),
      ('마법생물', '🦄', '마법의 힘으로 태어난 환상의 생물'),
      ('식물/균류', '🌿', '살아 움직이는 식물과 버섯 몬스터'),
      ('인간형', '🧟', '인간의 형태를 가진 위험한 적'),
      ('도깨비', '👺', '한국 전통 도깨비와 요물'),
      ('요괴/변이', '🎭', '기이한 형태로 변이된 괴물'),
      ('슬라임/연체', '🫧', '물렁물렁한 몸을 가진 생물'),
      ('수생/해양', '🐙', '물속에 사는 수중 몬스터')
    `);
  }

  // ========== 던전 & 몬스터 ==========
  await pool.query(`
    CREATE TABLE IF NOT EXISTS dungeons (
      id INT AUTO_INCREMENT PRIMARY KEY,
      key_name VARCHAR(50) NOT NULL UNIQUE,
      name VARCHAR(100) NOT NULL,
      description VARCHAR(300),
      icon VARCHAR(10) DEFAULT '🗺️',
      required_level INT DEFAULT 1,
      map_width INT DEFAULT 10,
      map_height INT DEFAULT 10,
      base_tile_type VARCHAR(20) DEFAULT 'grass',
      tile_overrides JSON,
      player_spawns JSON,
      monster_spawns JSON
    )
  `);

  // 던전 순서 컬럼
  await pool.query('ALTER TABLE dungeons ADD COLUMN display_order INT DEFAULT 0').catch(() => {});

  // display_order 설정 (순차 해금 순서)
  const dungeonOrder = [
    ['forest', 1], ['slime_cave', 2], ['cave', 3], ['swamp', 4],
    ['goblin', 5], ['mountain', 6], ['ocean', 7], ['spirit_forest', 8],
    ['temple', 9], ['demon', 10], ['dragon', 11]
  ];
  for (const [key, order] of dungeonOrder) {
    await pool.query('UPDATE dungeons SET display_order = ? WHERE key_name = ?', [order, key]);
  }

  await pool.query(`
    CREATE TABLE IF NOT EXISTS monsters (
      id INT AUTO_INCREMENT PRIMARY KEY,
      name VARCHAR(50) NOT NULL,
      dungeon_id INT NOT NULL,
      icon VARCHAR(10) DEFAULT '👹',
      hp INT NOT NULL,
      attack INT NOT NULL,
      defense INT DEFAULT 0,
      move_range INT DEFAULT 3,
      exp_reward INT DEFAULT 0,
      gold_reward INT DEFAULT 0,
      spawn_weight INT DEFAULT 10,
      FOREIGN KEY (dungeon_id) REFERENCES dungeons(id) ON DELETE CASCADE
    )
  `);

  // monsters 테이블에 category_id, tier, description 컬럼 추가
  await pool.query('ALTER TABLE monsters ADD COLUMN category_id INT DEFAULT NULL').catch(() => {});
  await pool.query('ALTER TABLE monsters ADD COLUMN tier INT DEFAULT 1').catch(() => {});
  await pool.query('ALTER TABLE monsters ADD COLUMN description VARCHAR(200) DEFAULT NULL').catch(() => {});
  await pool.query("ALTER TABLE monsters ADD COLUMN country VARCHAR(20) DEFAULT 'korea'").catch(() => {});

  const [existingDungeons] = await pool.query('SELECT COUNT(*) as cnt FROM dungeons');
  const [existingMonsters] = await pool.query('SELECT COUNT(*) as cnt FROM monsters');
  if (existingDungeons[0].cnt === 0 || existingMonsters[0].cnt < 135) {
    // 어둠의 숲
    await pool.query(`INSERT IGNORE INTO dungeons (key_name, name, description, icon, required_level, map_width, map_height, base_tile_type, tile_overrides, player_spawns, monster_spawns) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`, [
      'forest', '어둠의 숲', '어둠이 드리운 위험한 숲. 약한 몬스터들이 서식한다.', '🌲', 1, 10, 10, 'grass',
      JSON.stringify([
        {coords:[[2,2],[2,3],[3,2],[3,3]],height:1,type:'grass'},
        {coords:[[3,3]],height:2,type:'grass'},
        {coords:[[0,5],[1,5],[2,5],[3,5],[4,5],[5,5],[6,5],[7,5],[8,5],[9,5]],height:0,type:'dirt'},
        {coords:[[7,2],[7,3],[8,2]],height:0,type:'water'},
        {coords:[[6,7],[6,8],[7,7]],height:1,type:'stone'}
      ]),
      JSON.stringify([{x:0,z:0},{x:1,z:0},{x:0,z:1},{x:1,z:1}]),
      JSON.stringify([{x:8,z:8},{x:9,z:8},{x:8,z:9},{x:9,z:9}])
    ]);

    // 지하 동굴
    await pool.query(`INSERT IGNORE INTO dungeons (key_name, name, description, icon, required_level, map_width, map_height, base_tile_type, tile_overrides, player_spawns, monster_spawns) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`, [
      'cave', '지하 동굴', '깊은 지하에 자리한 동굴. 강력한 몬스터들이 도사린다.', '🕳️', 2, 10, 10, 'stone',
      JSON.stringify([
        {coords:[[0,4],[0,5],[1,4],[1,5]],height:3,type:'stone'},
        {coords:[[4,0],[4,1],[5,0],[5,1]],height:1,type:'stone'},
        {coords:[[4,2],[5,2]],height:2,type:'stone'},
        {coords:[[3,6],[3,7],[4,6],[4,7]],height:0,type:'water'},
        {coords:[[7,4],[7,5],[7,6],[8,4],[8,5],[8,6]],height:1,type:'dirt'}
      ]),
      JSON.stringify([{x:0,z:0},{x:1,z:0},{x:0,z:1},{x:1,z:1}]),
      JSON.stringify([{x:8,z:8},{x:9,z:9},{x:9,z:8},{x:8,z:9}])
    ]);

    // 폐허 사원
    await pool.query(`INSERT IGNORE INTO dungeons (key_name, name, description, icon, required_level, map_width, map_height, base_tile_type, tile_overrides, player_spawns, monster_spawns) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`, [
      'temple', '폐허 사원', '저주받은 고대 사원. 가장 강력한 적들이 기다린다.', '🏚️', 4, 10, 10, 'dark',
      JSON.stringify([
        {coords:[[4,4],[4,5],[5,4],[5,5]],height:2,type:'stone'},
        {coords:[[4,3],[5,3],[4,6],[5,6],[3,4],[3,5],[6,4],[6,5]],height:1,type:'stone'},
        {coords:[[2,2],[7,2],[2,7],[7,7]],height:3,type:'stone'},
        {coords:[[0,9],[1,9],[9,0],[9,1]],height:0,type:'water'}
      ]),
      JSON.stringify([{x:0,z:0},{x:1,z:0},{x:0,z:1},{x:1,z:1}]),
      JSON.stringify([{x:8,z:8},{x:9,z:9},{x:9,z:8},{x:7,z:9}])
    ]);

    // 몬스터 시드 - dungeon_id 참조
    const [dungeonRows] = await pool.query('SELECT id, key_name FROM dungeons');
    const dMap = {};
    for (const d of dungeonRows) dMap[d.key_name] = d.id;

    await pool.query(`INSERT INTO monsters (name, dungeon_id, icon, hp, attack, defense, move_range, exp_reward, gold_reward, spawn_weight) VALUES
      ('들쥐',       ${dMap.forest}, '🐀', 30,  5,  1, 4, 10,   5, 10),
      ('야생 늑대',  ${dMap.forest}, '🐺', 50,  8,  2, 3, 20,  12, 10),
      ('독거미',     ${dMap.forest}, '🕷️', 35, 10,  1, 3, 15,   8, 10),
      ('동굴 박쥐',  ${dMap.cave},   '🦇', 55, 12,  3, 4, 30,  20, 10),
      ('골렘',       ${dMap.cave},   '🗿', 100, 14,  8, 2, 50,  35, 8),
      ('지하 도마뱀',${dMap.cave},   '🦎', 70, 16,  4, 3, 40,  25, 10),
      ('원혼',       ${dMap.temple}, '👻', 90, 20,  3, 3, 60,  45, 10),
      ('저주받은 승려',${dMap.temple},'🧟',120, 24,  6, 2, 80,  60, 8),
      ('어둠의 수호자',${dMap.temple},'😈',170, 30, 10, 2, 120, 100, 5)
    `);

    // 기존 몬스터에 카테고리 할당
    const [catRows] = await pool.query('SELECT id, name FROM monster_categories');
    const cMap = {};
    for (const c of catRows) cMap[c.name] = c.id;

    await pool.query(`UPDATE monsters SET category_id=${cMap['야수']}, tier=1, description='들판에 서식하는 작은 쥐' WHERE name='들쥐'`);
    await pool.query(`UPDATE monsters SET category_id=${cMap['야수']}, tier=2, description='숲에서 무리지어 다니는 늑대' WHERE name='야생 늑대'`);
    await pool.query(`UPDATE monsters SET category_id=${cMap['곤충/벌레']}, tier=1, description='맹독을 가진 거대 거미' WHERE name='독거미'`);
    await pool.query(`UPDATE monsters SET category_id=${cMap['야수']}, tier=2, description='동굴에 사는 거대 박쥐' WHERE name='동굴 박쥐'`);
    await pool.query(`UPDATE monsters SET category_id=${cMap['마법생물']}, tier=4, description='마법으로 만들어진 바위 거인' WHERE name='골렘'`);
    await pool.query(`UPDATE monsters SET category_id=${cMap['야수']}, tier=3, description='지하 동굴의 거대 도마뱀' WHERE name='지하 도마뱀'`);
    await pool.query(`UPDATE monsters SET category_id=${cMap['귀신/원혼']}, tier=4, description='한을 품고 떠도는 원혼' WHERE name='원혼'`);
    await pool.query(`UPDATE monsters SET category_id=${cMap['인간형']}, tier=5, description='저주에 걸린 승려의 영혼' WHERE name='저주받은 승려'`);
    await pool.query(`UPDATE monsters SET category_id=${cMap['악마/마족']}, tier=6, description='어둠의 힘을 지닌 수호자' WHERE name='어둠의 수호자'`);

    // ========== 추가 던전 ==========
    // 독안개 늪
    await pool.query(`INSERT IGNORE INTO dungeons (key_name, name, description, icon, required_level, map_width, map_height, base_tile_type, tile_overrides, player_spawns, monster_spawns) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`, [
      'swamp', '독안개 늪', '독기가 가득한 늪지대. 벌레와 식물 몬스터가 서식한다.', '🌿', 2, 10, 10, 'grass',
      JSON.stringify([
        {coords:[[2,2],[3,2],[4,2],[2,3],[3,3],[4,3],[2,4],[3,4]],height:0,type:'water'},
        {coords:[[6,6],[7,6],[6,7],[7,7],[8,7]],height:0,type:'water'},
        {coords:[[5,0],[5,1],[5,2]],height:1,type:'dirt'},
        {coords:[[0,8],[1,8],[0,9]],height:1,type:'stone'}
      ]),
      JSON.stringify([{x:0,z:0},{x:1,z:0},{x:0,z:1},{x:1,z:1}]),
      JSON.stringify([{x:8,z:8},{x:9,z:8},{x:8,z:9},{x:9,z:9}])
    ]);

    // 영혼의 산
    await pool.query(`INSERT IGNORE INTO dungeons (key_name, name, description, icon, required_level, map_width, map_height, base_tile_type, tile_overrides, player_spawns, monster_spawns) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`, [
      'mountain', '영혼의 산', '영혼들이 떠도는 높은 산. 귀신과 요괴가 출몰한다.', '⛰️', 3, 10, 10, 'stone',
      JSON.stringify([
        {coords:[[4,4],[5,4],[4,5],[5,5]],height:4,type:'stone'},
        {coords:[[3,3],[6,3],[3,6],[6,6]],height:3,type:'stone'},
        {coords:[[2,2],[7,2],[2,7],[7,7]],height:2,type:'stone'},
        {coords:[[1,1],[8,1],[1,8],[8,8]],height:1,type:'dirt'},
        {coords:[[0,5],[9,5]],height:0,type:'water'}
      ]),
      JSON.stringify([{x:0,z:0},{x:1,z:0},{x:0,z:1},{x:1,z:1}]),
      JSON.stringify([{x:8,z:8},{x:9,z:8},{x:8,z:9},{x:9,z:9}])
    ]);

    // 마계 균열
    await pool.query(`INSERT IGNORE INTO dungeons (key_name, name, description, icon, required_level, map_width, map_height, base_tile_type, tile_overrides, player_spawns, monster_spawns) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`, [
      'demon', '마계 균열', '마계와 이어진 차원의 균열. 악마와 마족이 쏟아져 나온다.', '🌋', 5, 10, 10, 'dark',
      JSON.stringify([
        {coords:[[4,4],[5,4],[4,5],[5,5]],height:0,type:'water'},
        {coords:[[3,3],[6,3],[3,6],[6,6]],height:2,type:'stone'},
        {coords:[[1,1],[8,1],[1,8],[8,8]],height:3,type:'dark'},
        {coords:[[0,4],[0,5],[9,4],[9,5]],height:1,type:'stone'}
      ]),
      JSON.stringify([{x:0,z:0},{x:1,z:0},{x:0,z:1},{x:1,z:1}]),
      JSON.stringify([{x:8,z:8},{x:9,z:8},{x:8,z:9},{x:9,z:9}])
    ]);

    // 용의 둥지
    await pool.query(`INSERT IGNORE INTO dungeons (key_name, name, description, icon, required_level, map_width, map_height, base_tile_type, tile_overrides, player_spawns, monster_spawns) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`, [
      'dragon', '용의 둥지', '고대 용이 잠든 화산 동굴. 최강의 적들이 기다린다.', '🐉', 7, 12, 12, 'stone',
      JSON.stringify([
        {coords:[[5,5],[6,5],[5,6],[6,6]],height:3,type:'stone'},
        {coords:[[4,4],[7,4],[4,7],[7,7]],height:2,type:'stone'},
        {coords:[[3,5],[3,6],[8,5],[8,6],[5,3],[6,3],[5,8],[6,8]],height:1,type:'dirt'},
        {coords:[[0,0],[11,0],[0,11],[11,11]],height:0,type:'water'},
        {coords:[[1,5],[1,6],[10,5],[10,6]],height:1,type:'stone'}
      ]),
      JSON.stringify([{x:0,z:0},{x:1,z:0},{x:0,z:1},{x:1,z:1}]),
      JSON.stringify([{x:10,z:10},{x:11,z:10},{x:10,z:11},{x:11,z:11}])
    ]);

    // 해저 유적
    await pool.query(`INSERT IGNORE INTO dungeons (key_name, name, description, icon, required_level, map_width, map_height, base_tile_type, tile_overrides, player_spawns, monster_spawns) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`, [
      'ocean', '해저 유적', '바다 밑에 가라앉은 고대 유적. 수생 몬스터의 영역.', '🌊', 4, 10, 10, 'stone',
      JSON.stringify([
        {coords:[[0,0],[1,0],[0,1],[9,0],[9,1],[8,0],[0,9],[1,9],[0,8],[9,9],[8,9],[9,8]],height:0,type:'water'},
        {coords:[[3,3],[4,3],[5,3],[6,3],[3,4],[6,4],[3,5],[6,5],[3,6],[4,6],[5,6],[6,6]],height:1,type:'stone'},
        {coords:[[4,4],[5,4],[4,5],[5,5]],height:2,type:'stone'}
      ]),
      JSON.stringify([{x:0,z:0},{x:1,z:0},{x:0,z:1},{x:1,z:1}]),
      JSON.stringify([{x:8,z:8},{x:9,z:8},{x:8,z:9},{x:9,z:9}])
    ]);

    // 도깨비 마을
    await pool.query(`INSERT IGNORE INTO dungeons (key_name, name, description, icon, required_level, map_width, map_height, base_tile_type, tile_overrides, player_spawns, monster_spawns) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`, [
      'goblin', '도깨비 마을', '도깨비들이 모여 사는 마을. 장난기 넘치지만 위험하다.', '👺', 3, 10, 10, 'grass',
      JSON.stringify([
        {coords:[[2,2],[3,2],[2,3]],height:2,type:'stone'},
        {coords:[[6,6],[7,6],[7,7]],height:2,type:'stone'},
        {coords:[[4,0],[5,0],[4,1],[5,1]],height:1,type:'dirt'},
        {coords:[[0,8],[1,8],[2,8],[0,9],[1,9],[2,9]],height:0,type:'water'},
        {coords:[[8,2],[9,2],[8,3]],height:1,type:'grass'}
      ]),
      JSON.stringify([{x:0,z:0},{x:1,z:0},{x:0,z:1},{x:1,z:1}]),
      JSON.stringify([{x:8,z:8},{x:9,z:8},{x:8,z:9},{x:9,z:9}])
    ]);

    // 정령의 숲
    await pool.query(`INSERT IGNORE INTO dungeons (key_name, name, description, icon, required_level, map_width, map_height, base_tile_type, tile_overrides, player_spawns, monster_spawns) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`, [
      'spirit_forest', '정령의 숲', '원소 정령들이 깃든 신비로운 숲.', '✨', 4, 10, 10, 'grass',
      JSON.stringify([
        {coords:[[2,4],[2,5],[3,4],[3,5]],height:0,type:'water'},
        {coords:[[6,2],[7,2],[6,3],[7,3]],height:0,type:'water'},
        {coords:[[4,4],[5,4],[4,5],[5,5]],height:2,type:'grass'},
        {coords:[[1,1],[8,1],[1,8],[8,8]],height:1,type:'grass'},
        {coords:[[0,0],[9,9]],height:3,type:'stone'}
      ]),
      JSON.stringify([{x:0,z:0},{x:1,z:0},{x:0,z:1},{x:1,z:1}]),
      JSON.stringify([{x:8,z:8},{x:9,z:8},{x:8,z:9},{x:9,z:9}])
    ]);

    // 슬라임 동굴
    await pool.query(`INSERT IGNORE INTO dungeons (key_name, name, description, icon, required_level, map_width, map_height, base_tile_type, tile_overrides, player_spawns, monster_spawns) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`, [
      'slime_cave', '슬라임 동굴', '끈적끈적한 슬라임들로 가득한 동굴.', '🫧', 1, 10, 10, 'stone',
      JSON.stringify([
        {coords:[[3,3],[4,3],[5,3],[3,4],[5,4],[3,5],[4,5],[5,5]],height:0,type:'water'},
        {coords:[[4,4]],height:1,type:'stone'},
        {coords:[[7,1],[8,1],[7,2]],height:2,type:'stone'},
        {coords:[[1,7],[2,7],[1,8]],height:1,type:'dirt'}
      ]),
      JSON.stringify([{x:0,z:0},{x:1,z:0},{x:0,z:1},{x:1,z:1}]),
      JSON.stringify([{x:8,z:8},{x:9,z:8},{x:8,z:9},{x:9,z:9}])
    ]);

    // 새 던전 ID 가져오기
    const [allDungeons] = await pool.query('SELECT id, key_name FROM dungeons');
    for (const d of allDungeons) dMap[d.key_name] = d.id;

    // ========== 대량 몬스터 추가 (100+) ==========
    // 야수 (cat 1)
    await pool.query(`INSERT INTO monsters (name, dungeon_id, icon, hp, attack, defense, move_range, exp_reward, gold_reward, spawn_weight, category_id, tier, description) VALUES
      ('산토끼',       ${dMap.forest}, '🐇', 20, 3, 1, 5, 5, 3, 10, ${cMap['야수']}, 1, '겁이 많지만 빠른 산토끼'),
      ('멧돼지',       ${dMap.forest}, '🐗', 60, 9, 4, 3, 25, 15, 10, ${cMap['야수']}, 2, '거친 엄니를 가진 멧돼지'),
      ('독사',         ${dMap.swamp}, '🐍', 40, 12, 1, 4, 20, 10, 10, ${cMap['야수']}, 2, '맹독을 가진 위험한 뱀'),
      ('흑곰',         ${dMap.mountain}, '🐻', 110, 18, 7, 2, 55, 40, 8, ${cMap['야수']}, 4, '산속의 거대한 흑곰'),
      ('설표',         ${dMap.mountain}, '🐆', 90, 22, 4, 5, 65, 45, 7, ${cMap['야수']}, 5, '눈 위를 질주하는 표범'),
      ('회색 곰',      ${dMap.mountain}, '🐻', 140, 20, 9, 2, 70, 50, 6, ${cMap['야수']}, 5, '산맥의 거대한 회색곰'),
      ('구렁이',       ${dMap.swamp}, '🐍', 80, 15, 3, 3, 35, 22, 10, ${cMap['야수']}, 3, '몸을 조여 먹이를 삼키는 뱀'),
      ('백호',         ${dMap.mountain}, '🐅', 200, 32, 12, 4, 150, 120, 3, ${cMap['야수']}, 8, '전설의 흰 호랑이'),
      ('삼두견',       ${dMap.demon}, '🐕', 180, 28, 8, 3, 100, 80, 5, ${cMap['야수']}, 7, '머리 셋 달린 지옥의 개'),
      ('천년 여우',    ${dMap.mountain}, '🦊', 160, 25, 6, 4, 90, 70, 5, ${cMap['야수']}, 6, '천 년을 살아온 신비로운 여우')
    `);

    // 곤충/벌레 (cat 2)
    await pool.query(`INSERT INTO monsters (name, dungeon_id, icon, hp, attack, defense, move_range, exp_reward, gold_reward, spawn_weight, category_id, tier, description) VALUES
      ('거대 지네',     ${dMap.cave}, '🐛', 45, 11, 2, 3, 18, 10, 10, ${cMap['곤충/벌레']}, 2, '동굴에 사는 거대 지네'),
      ('독나방',       ${dMap.swamp}, '🦋', 30, 8, 1, 4, 12, 7, 10, ${cMap['곤충/벌레']}, 1, '독가루를 뿌리는 나방'),
      ('킬러비',       ${dMap.forest}, '🐝', 35, 14, 1, 5, 15, 9, 10, ${cMap['곤충/벌레']}, 2, '치명적인 독침을 가진 벌'),
      ('전갈',         ${dMap.cave}, '🦂', 60, 16, 5, 3, 30, 20, 8, ${cMap['곤충/벌레']}, 3, '꼬리의 맹독이 위험한 전갈'),
      ('여왕 개미',    ${dMap.swamp}, '🐜', 100, 12, 10, 2, 45, 35, 6, ${cMap['곤충/벌레']}, 4, '개미 군단의 여왕'),
      ('장수풍뎅이',   ${dMap.forest}, '🪲', 80, 13, 8, 2, 35, 25, 8, ${cMap['곤충/벌레']}, 3, '단단한 갑각의 장수풍뎅이'),
      ('독 거미 여왕', ${dMap.swamp}, '🕷️', 130, 22, 5, 3, 70, 55, 5, ${cMap['곤충/벌레']}, 5, '독거미 무리의 우두머리'),
      ('사마귀 전사',  ${dMap.forest}, '🦗', 70, 18, 3, 4, 40, 28, 8, ${cMap['곤충/벌레']}, 3, '낫 같은 팔을 가진 사마귀')
    `);

    // 언데드 (cat 3)
    await pool.query(`INSERT INTO monsters (name, dungeon_id, icon, hp, attack, defense, move_range, exp_reward, gold_reward, spawn_weight, category_id, tier, description) VALUES
      ('스켈레톤',     ${dMap.temple}, '💀', 60, 14, 4, 3, 25, 18, 10, ${cMap['언데드']}, 2, '움직이는 해골 전사'),
      ('좀비',         ${dMap.temple}, '🧟', 80, 10, 6, 2, 30, 20, 10, ${cMap['언데드']}, 2, '느리지만 강인한 시체'),
      ('구울',         ${dMap.cave}, '🧟', 70, 16, 3, 3, 35, 25, 8, ${cMap['언데드']}, 3, '살을 파먹는 식인 귀'),
      ('레이스',       ${dMap.temple}, '👤', 90, 20, 2, 4, 50, 40, 7, ${cMap['언데드']}, 4, '그림자처럼 스며드는 악령'),
      ('뱀파이어',     ${dMap.demon}, '🧛', 150, 26, 8, 3, 85, 65, 5, ${cMap['언데드']}, 6, '피를 갈망하는 흡혈귀'),
      ('데스나이트',   ${dMap.demon}, '⚔️', 200, 30, 14, 2, 120, 90, 4, ${cMap['언데드']}, 7, '죽음의 기사, 암흑 갑옷의 전사'),
      ('리치왕',       ${dMap.demon}, '☠️', 250, 35, 10, 2, 180, 150, 3, ${cMap['언데드']}, 9, '언데드 군단의 지배자'),
      ('해골 궁수',    ${dMap.temple}, '💀', 50, 18, 2, 3, 28, 18, 10, ${cMap['언데드']}, 2, '활을 쏘는 해골 병사'),
      ('미라',         ${dMap.temple}, '🧟', 120, 18, 10, 2, 55, 42, 6, ${cMap['언데드']}, 4, '고대 무덤의 미라')
    `);

    // 귀신/원혼 (cat 4)
    await pool.query(`INSERT INTO monsters (name, dungeon_id, icon, hp, attack, defense, move_range, exp_reward, gold_reward, spawn_weight, category_id, tier, description) VALUES
      ('떠도는 영혼',  ${dMap.temple}, '👻', 40, 12, 1, 4, 18, 12, 10, ${cMap['귀신/원혼']}, 1, '방향 없이 떠도는 슬픈 영혼'),
      ('처녀귀신',     ${dMap.mountain}, '👻', 80, 18, 2, 4, 40, 30, 8, ${cMap['귀신/원혼']}, 3, '한을 품은 처녀의 귀신'),
      ('야차',         ${dMap.mountain}, '👹', 100, 22, 5, 3, 55, 40, 7, ${cMap['귀신/원혼']}, 4, '사나운 성격의 야행성 귀신'),
      ('물귀신',       ${dMap.ocean}, '👻', 70, 15, 3, 3, 35, 25, 10, ${cMap['귀신/원혼']}, 3, '물에 빠져 죽은 영혼'),
      ('이무기',       ${dMap.mountain}, '🐲', 220, 34, 12, 3, 160, 130, 3, ${cMap['귀신/원혼']}, 8, '용이 되지 못한 거대한 뱀'),
      ('검은 그림자',  ${dMap.demon}, '🌑', 110, 24, 3, 4, 65, 50, 6, ${cMap['귀신/원혼']}, 5, '어둠 속에서 나타나는 그림자'),
      ('봉사귀',       ${dMap.temple}, '👻', 60, 14, 2, 3, 28, 18, 10, ${cMap['귀신/원혼']}, 2, '눈이 먼 원혼'),
      ('달귀',         ${dMap.mountain}, '🌙', 130, 20, 4, 4, 60, 48, 6, ${cMap['귀신/원혼']}, 5, '달빛 아래 나타나는 귀신')
    `);

    // 정령 (cat 5)
    await pool.query(`INSERT INTO monsters (name, dungeon_id, icon, hp, attack, defense, move_range, exp_reward, gold_reward, spawn_weight, category_id, tier, description) VALUES
      ('물의 정령',    ${dMap.spirit_forest}, '💧', 60, 12, 4, 3, 30, 22, 10, ${cMap['정령']}, 2, '맑은 물에서 태어난 정령'),
      ('불의 정령',    ${dMap.spirit_forest}, '🔥', 55, 18, 2, 3, 35, 25, 10, ${cMap['정령']}, 3, '불꽃에서 태어난 정령'),
      ('바람의 정령',  ${dMap.spirit_forest}, '🌪️', 50, 14, 3, 5, 32, 24, 10, ${cMap['정령']}, 2, '바람을 타고 이동하는 정령'),
      ('대지의 정령',  ${dMap.spirit_forest}, '🪨', 100, 10, 12, 2, 40, 30, 8, ${cMap['정령']}, 3, '대지의 힘을 품은 정령'),
      ('번개 정령',    ${dMap.spirit_forest}, '⚡', 70, 25, 2, 4, 55, 40, 6, ${cMap['정령']}, 4, '번개를 부리는 정령'),
      ('얼음 정령',    ${dMap.spirit_forest}, '❄️', 80, 16, 8, 3, 45, 35, 7, ${cMap['정령']}, 4, '차가운 얼음의 정령'),
      ('빛의 정령',    ${dMap.spirit_forest}, '💫', 120, 22, 6, 4, 70, 55, 5, ${cMap['정령']}, 6, '눈부신 빛을 발하는 정령'),
      ('어둠의 정령',  ${dMap.demon}, '🌑', 130, 26, 5, 3, 80, 60, 5, ${cMap['정령']}, 6, '어둠에 타락한 정령'),
      ('정령왕',       ${dMap.spirit_forest}, '👑', 200, 30, 10, 3, 140, 110, 3, ${cMap['정령']}, 8, '모든 정령을 다스리는 왕')
    `);

    // 악마/마족 (cat 6)
    await pool.query(`INSERT INTO monsters (name, dungeon_id, icon, hp, attack, defense, move_range, exp_reward, gold_reward, spawn_weight, category_id, tier, description) VALUES
      ('임프',         ${dMap.demon}, '👿', 40, 10, 2, 4, 18, 12, 10, ${cMap['악마/마족']}, 1, '장난스러운 하급 악마'),
      ('서큐버스',     ${dMap.demon}, '😈', 100, 20, 4, 3, 55, 42, 7, ${cMap['악마/마족']}, 4, '매혹으로 영혼을 빼앗는 악마'),
      ('인큐버스',     ${dMap.demon}, '😈', 110, 22, 5, 3, 60, 45, 7, ${cMap['악마/마족']}, 4, '악몽을 심는 남성 악마'),
      ('지옥견',       ${dMap.demon}, '🐕‍🦺', 130, 24, 6, 4, 70, 55, 6, ${cMap['악마/마족']}, 5, '지옥의 문을 지키는 마견'),
      ('발록',         ${dMap.demon}, '👹', 220, 35, 12, 2, 150, 120, 4, ${cMap['악마/마족']}, 8, '불꽃의 채찍을 휘두르는 악마'),
      ('마왕의 부하',  ${dMap.demon}, '😈', 160, 28, 9, 3, 100, 80, 5, ${cMap['악마/마족']}, 6, '마왕의 명을 받은 마족 전사'),
      ('타락 천사',    ${dMap.demon}, '😇', 190, 32, 8, 3, 130, 100, 4, ${cMap['악마/마족']}, 7, '천계에서 추방된 천사'),
      ('마왕',         ${dMap.demon}, '👿', 350, 45, 18, 2, 300, 250, 2, ${cMap['악마/마족']}, 10, '마계를 지배하는 절대 악의 존재'),
      ('가고일',       ${dMap.demon}, '🗿', 90, 16, 10, 2, 45, 35, 8, ${cMap['악마/마족']}, 3, '돌에서 깨어난 악마의 하인'),
      ('다크 세라핌',  ${dMap.demon}, '😇', 280, 38, 14, 3, 200, 170, 3, ${cMap['악마/마족']}, 9, '타락한 상급 천사, 어둠의 날개를 펼친 존재')
    `);

    // 용족 (cat 7)
    await pool.query(`INSERT INTO monsters (name, dungeon_id, icon, hp, attack, defense, move_range, exp_reward, gold_reward, spawn_weight, category_id, tier, description) VALUES
      ('드래곤 해츨링', ${dMap.dragon}, '🐣', 80, 16, 6, 3, 45, 35, 10, ${cMap['용족']}, 3, '갓 태어난 아기 용'),
      ('와이번',       ${dMap.dragon}, '🦅', 120, 22, 5, 4, 65, 50, 8, ${cMap['용족']}, 5, '날개 달린 비룡'),
      ('화룡',         ${dMap.dragon}, '🐉', 250, 38, 14, 3, 180, 150, 3, ${cMap['용족']}, 8, '불을 뿜는 붉은 용'),
      ('빙룡',         ${dMap.dragon}, '🐉', 240, 35, 16, 2, 170, 140, 3, ${cMap['용족']}, 8, '얼음 숨결의 푸른 용'),
      ('암흑룡',       ${dMap.dragon}, '🐉', 300, 42, 15, 3, 220, 180, 2, ${cMap['용족']}, 9, '어둠의 힘을 가진 흑룡'),
      ('용왕',         ${dMap.dragon}, '🐲', 400, 50, 20, 2, 350, 300, 1, ${cMap['용족']}, 10, '모든 용을 지배하는 용왕'),
      ('드레이크',     ${dMap.dragon}, '🦎', 100, 18, 8, 3, 50, 38, 8, ${cMap['용족']}, 4, '용의 먼 친척, 날지 못하는 용'),
      ('히드라',       ${dMap.dragon}, '🐍', 280, 36, 10, 2, 200, 160, 3, ${cMap['용족']}, 9, '머리가 여러 개인 거대한 뱀'),
      ('뇌룡',         ${dMap.dragon}, '🐉', 270, 40, 12, 4, 190, 155, 3, ${cMap['용족']}, 9, '번개를 부리는 폭풍의 용')
    `);

    // 마법생물 (cat 8)
    await pool.query(`INSERT INTO monsters (name, dungeon_id, icon, hp, attack, defense, move_range, exp_reward, gold_reward, spawn_weight, category_id, tier, description) VALUES
      ('마법 갑옷',    ${dMap.temple}, '🛡️', 90, 14, 12, 2, 40, 30, 8, ${cMap['마법생물']}, 3, '마법으로 움직이는 빈 갑옷'),
      ('가디언',       ${dMap.temple}, '🤖', 150, 22, 14, 2, 75, 60, 5, ${cMap['마법생물']}, 5, '유적을 지키는 마법 수호자'),
      ('호문쿨루스',   ${dMap.cave}, '🧪', 60, 10, 3, 3, 25, 18, 10, ${cMap['마법생물']}, 2, '연금술로 만든 인공 생명체'),
      ('마나 골렘',    ${dMap.spirit_forest}, '🔮', 140, 20, 10, 2, 70, 55, 5, ${cMap['마법생물']}, 5, '순수한 마나로 이루어진 골렘'),
      ('유니콘',       ${dMap.spirit_forest}, '🦄', 130, 18, 6, 4, 65, 50, 5, ${cMap['마법생물']}, 5, '신비로운 뿔을 가진 성스러운 말'),
      ('그리핀',       ${dMap.mountain}, '🦅', 160, 26, 8, 4, 90, 70, 4, ${cMap['마법생물']}, 6, '독수리와 사자가 합쳐진 마수'),
      ('피닉스',       ${dMap.dragon}, '🔥', 180, 30, 6, 4, 120, 95, 3, ${cMap['마법생물']}, 7, '죽어도 되살아나는 불사조'),
      ('미믹',         ${dMap.cave}, '📦', 70, 20, 8, 1, 40, 60, 6, ${cMap['마법생물']}, 3, '보물상자로 위장한 마물')
    `);

    // 식물/균류 (cat 9)
    await pool.query(`INSERT INTO monsters (name, dungeon_id, icon, hp, attack, defense, move_range, exp_reward, gold_reward, spawn_weight, category_id, tier, description) VALUES
      ('독버섯',       ${dMap.swamp}, '🍄', 30, 8, 2, 2, 10, 7, 10, ${cMap['식물/균류']}, 1, '독포자를 뿌리는 버섯'),
      ('덩굴괴물',     ${dMap.swamp}, '🌿', 60, 12, 4, 2, 25, 18, 10, ${cMap['식물/균류']}, 2, '덩굴로 적을 조이는 식물'),
      ('트렌트',       ${dMap.forest}, '🌳', 120, 16, 12, 1, 55, 42, 6, ${cMap['식물/균류']}, 4, '살아 움직이는 거대한 나무'),
      ('식인화',       ${dMap.swamp}, '🌺', 80, 18, 3, 2, 38, 28, 8, ${cMap['식물/균류']}, 3, '동물을 잡아먹는 거대 식물'),
      ('포자 군체',    ${dMap.swamp}, '🫧', 50, 6, 2, 3, 15, 10, 10, ${cMap['식물/균류']}, 1, '공기 중에 떠다니는 포자 군체'),
      ('만드레이크',   ${dMap.forest}, '🌱', 70, 14, 5, 2, 32, 24, 8, ${cMap['식물/균류']}, 3, '비명을 지르는 인형 뿌리 식물'),
      ('세계수의 파편',${dMap.spirit_forest}, '🌲', 200, 25, 15, 1, 110, 85, 3, ${cMap['식물/균류']}, 7, '세계수에서 떨어진 살아있는 나무'),
      ('균류 군주',    ${dMap.swamp}, '🍄', 150, 20, 8, 2, 80, 60, 4, ${cMap['식물/균류']}, 6, '늪지대를 지배하는 거대 균류')
    `);

    // 인간형 (cat 10)
    await pool.query(`INSERT INTO monsters (name, dungeon_id, icon, hp, attack, defense, move_range, exp_reward, gold_reward, spawn_weight, category_id, tier, description) VALUES
      ('산적',         ${dMap.forest}, '🗡️', 50, 10, 3, 3, 20, 15, 10, ${cMap['인간형']}, 1, '길목에서 약탈하는 산적'),
      ('암살자',       ${dMap.cave}, '🗡️', 70, 20, 2, 4, 40, 30, 7, ${cMap['인간형']}, 3, '그림자 속에서 기습하는 암살자'),
      ('흑마법사',     ${dMap.temple}, '🧙', 90, 24, 3, 3, 55, 42, 6, ${cMap['인간형']}, 4, '어둠의 마법을 사용하는 마법사'),
      ('타락 기사',    ${dMap.demon}, '⚔️', 140, 26, 12, 2, 75, 60, 5, ${cMap['인간형']}, 5, '어둠에 물든 전직 기사'),
      ('광전사',       ${dMap.mountain}, '⚔️', 110, 22, 6, 3, 55, 40, 7, ${cMap['인간형']}, 4, '이성을 잃은 광폭한 전사'),
      ('네크로맨서',   ${dMap.temple}, '🧙', 130, 22, 5, 2, 70, 55, 5, ${cMap['인간형']}, 5, '시체를 조종하는 사술사'),
      ('대마법사',     ${dMap.demon}, '🧙', 180, 34, 6, 3, 130, 100, 3, ${cMap['인간형']}, 7, '금지된 마법을 연구한 마법사'),
      ('도적 두목',    ${dMap.cave}, '🗡️', 100, 18, 7, 3, 48, 38, 6, ${cMap['인간형']}, 3, '도적단의 우두머리')
    `);

    // 도깨비 (cat 11)
    await pool.query(`INSERT INTO monsters (name, dungeon_id, icon, hp, attack, defense, move_range, exp_reward, gold_reward, spawn_weight, category_id, tier, description) VALUES
      ('꼬마 도깨비',  ${dMap.goblin}, '👺', 30, 7, 2, 4, 12, 8, 10, ${cMap['도깨비']}, 1, '장난치는 작은 도깨비'),
      ('불 도깨비',    ${dMap.goblin}, '🔥', 60, 14, 3, 3, 28, 20, 10, ${cMap['도깨비']}, 2, '불을 다루는 도깨비'),
      ('돌 도깨비',    ${dMap.goblin}, '🪨', 90, 12, 10, 2, 38, 28, 8, ${cMap['도깨비']}, 3, '바위같이 단단한 도깨비'),
      ('도깨비 장군',  ${dMap.goblin}, '👺', 140, 24, 8, 3, 75, 60, 5, ${cMap['도깨비']}, 5, '도깨비 군단의 장군'),
      ('깨비대왕',     ${dMap.goblin}, '👹', 200, 30, 12, 3, 130, 100, 3, ${cMap['도깨비']}, 7, '도깨비들의 왕'),
      ('연못 도깨비',  ${dMap.goblin}, '💧', 50, 10, 4, 3, 22, 16, 10, ${cMap['도깨비']}, 2, '연못에 사는 물장난 도깨비'),
      ('도깨비 방망이',${dMap.goblin}, '🏏', 110, 20, 6, 3, 55, 42, 6, ${cMap['도깨비']}, 4, '방망이를 든 힘센 도깨비'),
      ('숲 도깨비',    ${dMap.forest}, '👺', 45, 9, 3, 3, 18, 12, 10, ${cMap['도깨비']}, 1, '숲에 사는 장난꾸러기 도깨비')
    `);

    // 요괴/변이 (cat 12)
    await pool.query(`INSERT INTO monsters (name, dungeon_id, icon, hp, attack, defense, move_range, exp_reward, gold_reward, spawn_weight, category_id, tier, description) VALUES
      ('구미호',       ${dMap.mountain}, '🦊', 180, 28, 6, 4, 100, 80, 4, ${cMap['요괴/변이']}, 6, '아홉 꼬리를 가진 요호'),
      ('해태',         ${dMap.mountain}, '🦁', 200, 26, 14, 3, 120, 95, 3, ${cMap['요괴/변이']}, 7, '선악을 구별하는 신수'),
      ('불가사리',     ${dMap.mountain}, '🐃', 160, 22, 16, 2, 85, 65, 5, ${cMap['요괴/변이']}, 6, '쇠를 먹는 괴물'),
      ('키메라',       ${dMap.demon}, '🐉', 190, 30, 10, 3, 110, 88, 4, ${cMap['요괴/변이']}, 7, '여러 동물이 합쳐진 괴수'),
      ('미노타우르스', ${dMap.cave}, '🐂', 150, 26, 8, 3, 80, 62, 5, ${cMap['요괴/변이']}, 5, '소의 머리를 가진 거인'),
      ('메두사',       ${dMap.temple}, '🐍', 140, 24, 5, 3, 75, 58, 5, ${cMap['요괴/변이']}, 5, '눈을 보면 돌이 되는 괴물'),
      ('거인',         ${dMap.mountain}, '🗿', 180, 28, 12, 2, 100, 80, 4, ${cMap['요괴/변이']}, 6, '산처럼 거대한 인간형 괴물'),
      ('늑대인간',     ${dMap.forest}, '🐺', 110, 22, 5, 4, 58, 44, 6, ${cMap['요괴/변이']}, 4, '달빛에 변신하는 저주받은 인간')
    `);

    // 슬라임/연체 (cat 13)
    await pool.query(`INSERT INTO monsters (name, dungeon_id, icon, hp, attack, defense, move_range, exp_reward, gold_reward, spawn_weight, category_id, tier, description) VALUES
      ('초록 슬라임',  ${dMap.slime_cave}, '🟢', 20, 4, 1, 3, 5, 3, 10, ${cMap['슬라임/연체']}, 1, '가장 약한 기본 슬라임'),
      ('파랑 슬라임',  ${dMap.slime_cave}, '🔵', 35, 6, 2, 3, 10, 7, 10, ${cMap['슬라임/연체']}, 1, '물의 성질을 가진 슬라임'),
      ('빨강 슬라임',  ${dMap.slime_cave}, '🔴', 45, 12, 2, 3, 18, 12, 10, ${cMap['슬라임/연체']}, 2, '불의 성질을 가진 슬라임'),
      ('독 슬라임',    ${dMap.slime_cave}, '🟣', 50, 8, 3, 3, 15, 10, 10, ${cMap['슬라임/연체']}, 2, '독성을 가진 보라색 슬라임'),
      ('금속 슬라임',  ${dMap.slime_cave}, '⚪', 30, 5, 20, 5, 100, 80, 2, ${cMap['슬라임/연체']}, 4, '매우 단단하고 빠른 희귀 슬라임'),
      ('킹 슬라임',    ${dMap.slime_cave}, '👑', 150, 18, 8, 2, 70, 55, 4, ${cMap['슬라임/연체']}, 5, '슬라임들의 왕'),
      ('젤리피쉬',     ${dMap.ocean}, '🪼', 40, 10, 1, 4, 15, 10, 10, ${cMap['슬라임/연체']}, 1, '독침을 가진 해파리'),
      ('점액 군주',    ${dMap.slime_cave}, '🫧', 200, 22, 10, 2, 100, 80, 3, ${cMap['슬라임/연체']}, 6, '모든 것을 녹이는 거대 슬라임'),
      ('용암 슬라임',  ${dMap.cave}, '🔴', 80, 20, 5, 2, 40, 30, 6, ${cMap['슬라임/연체']}, 3, '녹은 용암으로 이루어진 뜨거운 슬라임'),
      ('크리스탈 슬라임', ${dMap.slime_cave}, '💎', 60, 14, 15, 3, 55, 45, 4, ${cMap['슬라임/연체']}, 4, '보석처럼 빛나는 단단한 슬라임'),
      ('포식 슬라임',  ${dMap.slime_cave}, '🟤', 170, 24, 6, 2, 85, 65, 4, ${cMap['슬라임/연체']}, 5, '모든 것을 삼키는 포식성 거대 슬라임')
    `);

    // 수생/해양 (cat 14)
    await pool.query(`INSERT INTO monsters (name, dungeon_id, icon, hp, attack, defense, move_range, exp_reward, gold_reward, spawn_weight, category_id, tier, description) VALUES
      ('대왕 게',      ${dMap.ocean}, '🦀', 80, 14, 10, 2, 35, 25, 10, ${cMap['수생/해양']}, 3, '거대한 집게를 가진 게'),
      ('상어',         ${dMap.ocean}, '🦈', 120, 24, 5, 4, 60, 45, 6, ${cMap['수생/해양']}, 5, '바다의 포식자'),
      ('대왕 문어',    ${dMap.ocean}, '🐙', 100, 18, 4, 3, 48, 35, 8, ${cMap['수생/해양']}, 4, '촉수로 적을 조이는 거대 문어'),
      ('인어 전사',    ${dMap.ocean}, '🧜', 90, 16, 6, 3, 42, 32, 8, ${cMap['수생/해양']}, 3, '물속에서 싸우는 인어 전사'),
      ('심해어',       ${dMap.ocean}, '🐟', 60, 14, 3, 3, 28, 20, 10, ${cMap['수생/해양']}, 2, '깊은 바다의 무서운 물고기'),
      ('크라켄',       ${dMap.ocean}, '🐙', 280, 38, 12, 2, 200, 160, 2, ${cMap['수생/해양']}, 9, '바다를 지배하는 거대 괴물'),
      ('해마 기사',    ${dMap.ocean}, '🐴', 70, 12, 5, 4, 30, 22, 10, ${cMap['수생/해양']}, 2, '해마를 타고 다니는 수중 기사'),
      ('바다 용',      ${dMap.ocean}, '🐉', 250, 36, 14, 3, 180, 140, 2, ${cMap['수생/해양']}, 8, '바다 깊은 곳에 사는 해룡')
    `);
  }

  // ========== 나라별 전용 던전 + 150 몬스터 추가 ==========
  const [countryMonsterCheck] = await pool.query("SELECT COUNT(*) as cnt FROM monsters WHERE country IN ('japan','china')");
  if (countryMonsterCheck[0].cnt === 0) {
    // 나라별 전용 던전 생성
    const countryDungeons = [
      // 한국 전용 던전 5개
      ['kr_forest','한국: 고조선 숲','한국 신화의 고조선 배경 숲','🌲',1,10,10,'grass'],
      ['kr_mountain','한국: 백두산','한국 설화의 신성한 산','⛰️',3,10,10,'stone'],
      ['kr_temple','한국: 고찰 폐허','한국 불교 설화의 폐사찰','🏚️',5,10,10,'dark'],
      ['kr_swamp','한국: 장자못','한국 전설의 저주받은 늪','🌿',4,10,10,'grass'],
      ['kr_spirit','한국: 신령의 숲','한국 무속신앙의 정령 숲','✨',6,10,10,'grass'],
      // 일본 전용 던전 5개
      ['jp_forest','일본: 아오키가하라','일본 요괴가 출몰하는 수해','🌲',1,10,10,'grass'],
      ['jp_mountain','일본: 오에산','일본 오니가 거처하는 산','⛩️',3,10,10,'stone'],
      ['jp_temple','일본: 폐신사','일본 원령이 서린 폐신사','⛩️',5,10,10,'dark'],
      ['jp_ocean','일본: 용궁','일본 해저 용궁성','🌊',4,10,10,'stone'],
      ['jp_spirit','일본: 요괴의 길','일본 백귀야행의 길','👺',6,10,10,'grass'],
      // 중국 전용 던전 5개
      ['cn_forest','중국: 산해경 숲','산해경에 기록된 신비의 숲','🌲',1,10,10,'grass'],
      ['cn_mountain','중국: 곤륜산','중국 신화의 곤륜산','🏔️',3,10,10,'stone'],
      ['cn_temple','중국: 봉신대','중국 봉신연의의 전장','🏯',5,10,10,'dark'],
      ['cn_swamp','중국: 황천','중국 명부의 황천길','💀',4,10,10,'stone'],
      ['cn_spirit','중국: 요계','중국 요괴들의 은신처','🐉',6,10,10,'grass'],
    ];

    const defaultSpawns = JSON.stringify([{x:0,z:0},{x:1,z:0},{x:0,z:1},{x:1,z:1}]);
    const defaultMonsterSpawns = JSON.stringify([{x:8,z:8},{x:9,z:8},{x:8,z:9},{x:9,z:9}]);
    const defaultOverrides = JSON.stringify([
      {coords:[[4,4],[5,4],[4,5],[5,5]],height:2,type:'stone'},
      {coords:[[2,2],[7,7]],height:1,type:'grass'},
      {coords:[[7,2],[2,7]],height:0,type:'water'}
    ]);

    for (const [key, name, desc, icon, lvl, w, h, base] of countryDungeons) {
      await pool.query(
        `INSERT IGNORE INTO dungeons (key_name, name, description, icon, required_level, map_width, map_height, base_tile_type, tile_overrides, player_spawns, monster_spawns) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [key, name, desc, icon, lvl, w, h, base, defaultOverrides, defaultSpawns, defaultMonsterSpawns]
      );
    }

    // 새 던전 ID 가져오기
    const [allD] = await pool.query('SELECT id, key_name FROM dungeons');
    const dm = {};
    for (const d of allD) dm[d.key_name] = d.id;

    const [catRows2] = await pool.query('SELECT id, name FROM monster_categories');
    const cm = {};
    for (const c of catRows2) cm[c.name] = c.id;

    // ===== 한국 몬스터 50개 =====
    await pool.query(`INSERT INTO monsters (name, dungeon_id, icon, hp, attack, defense, move_range, exp_reward, gold_reward, spawn_weight, category_id, tier, description, country) VALUES
      ('구미호',       ${dm.kr_spirit}, '🦊', 180, 28, 6, 4, 100, 80, 4, ${cm['요괴/변이']}, 4, '아홉 꼬리를 가진 천년 여우', 'korea'),
      ('해태',         ${dm.kr_mountain}, '🦁', 200, 26, 14, 3, 120, 95, 3, ${cm['마법생물']}, 4, '불을 먹는 신수', 'korea'),
      ('불가사리',     ${dm.kr_mountain}, '🐃', 250, 30, 18, 2, 150, 120, 3, ${cm['요괴/변이']}, 5, '쇠를 먹는 불멸의 괴수', 'korea'),
      ('이무기',       ${dm.kr_swamp}, '🐲', 220, 34, 12, 3, 160, 130, 3, ${cm['용족']}, 4, '용이 되지 못한 거대한 뱀', 'korea'),
      ('용',           ${dm.kr_spirit}, '🐉', 350, 45, 18, 3, 300, 250, 2, ${cm['용족']}, 5, '수호와 비를 관장하는 신룡', 'korea'),
      ('천리마',       ${dm.kr_spirit}, '🐴', 300, 40, 14, 5, 250, 200, 2, ${cm['마법생물']}, 5, '하루에 천리를 달리는 신마', 'korea'),
      ('봉황',         ${dm.kr_spirit}, '🐦', 320, 42, 16, 4, 280, 220, 2, ${cm['마법생물']}, 5, '태평성대에 나타나는 신조', 'korea'),
      ('삼족오',       ${dm.kr_spirit}, '🐦', 200, 32, 10, 4, 130, 100, 3, ${cm['마법생물']}, 4, '태양 속에 사는 세 발 까마귀', 'korea'),
      ('불개',         ${dm.kr_mountain}, '🐕', 140, 24, 8, 4, 80, 60, 5, ${cm['야수']}, 3, '태양과 달을 쫓는 화염의 개', 'korea'),
      ('삼족구',       ${dm.kr_forest}, '🐕', 90, 16, 6, 4, 45, 35, 8, ${cm['야수']}, 2, '악귀를 보는 세 발 개', 'korea'),
      ('처녀귀신',     ${dm.kr_temple}, '👻', 120, 22, 4, 4, 65, 50, 6, ${cm['귀신/원혼']}, 3, '한을 품은 처녀의 원혼', 'korea'),
      ('물귀신',       ${dm.kr_swamp}, '👻', 110, 20, 5, 3, 55, 42, 7, ${cm['귀신/원혼']}, 3, '물에 빠져 죽은 영혼', 'korea'),
      ('몽달귀신',     ${dm.kr_temple}, '👻', 80, 14, 3, 3, 35, 25, 8, ${cm['귀신/원혼']}, 2, '총각으로 죽은 외로운 귀신', 'korea'),
      ('달걀귀신',     ${dm.kr_temple}, '👻', 100, 18, 3, 4, 50, 38, 7, ${cm['귀신/원혼']}, 3, '눈코입이 없는 공포의 귀신', 'korea'),
      ('원혼',         ${dm.kr_temple}, '👻', 160, 26, 6, 3, 85, 65, 5, ${cm['귀신/원혼']}, 4, '억울하게 죽어 복수를 꿈꾸는 영', 'korea'),
      ('저승사자',     ${dm.kr_spirit}, '🖤', 200, 30, 10, 3, 120, 95, 3, ${cm['귀신/원혼']}, 4, '영혼을 인도하는 저승의 사자', 'korea'),
      ('야광귀',       ${dm.kr_forest}, '👻', 50, 8, 2, 4, 18, 12, 10, ${cm['귀신/원혼']}, 1, '밤에 신발을 신어보는 귀신', 'korea'),
      ('강림도령',     ${dm.kr_spirit}, '⚔️', 280, 38, 14, 3, 200, 160, 2, ${cm['귀신/원혼']}, 5, '염라대왕도 잡은 저승차사의 수장', 'korea'),
      ('도깨비',       ${dm.kr_forest}, '👺', 100, 16, 6, 3, 48, 35, 8, ${cm['도깨비']}, 3, '피 묻은 물건에서 태어난 장난꾸러기', 'korea'),
      ('참도깨비',     ${dm.kr_forest}, '👺', 120, 18, 8, 3, 55, 42, 7, ${cm['도깨비']}, 3, '선한 사람에게 복을 주는 진짜 도깨비', 'korea'),
      ('각시도깨비',   ${dm.kr_forest}, '👺', 80, 14, 4, 3, 38, 28, 8, ${cm['도깨비']}, 2, '아름다운 여인으로 변신하는 도깨비', 'korea'),
      ('귀수도깨비',   ${dm.kr_swamp}, '👹', 160, 26, 8, 3, 85, 68, 5, ${cm['도깨비']}, 4, '죽은 자의 피에서 태어난 악한 도깨비', 'korea'),
      ('산신',         ${dm.kr_mountain}, '🧓', 180, 22, 16, 2, 100, 80, 4, ${cm['마법생물']}, 4, '산을 지키는 흰수염 노인 신', 'korea'),
      ('용왕',         ${dm.kr_swamp}, '🐲', 350, 44, 18, 2, 300, 240, 2, ${cm['용족']}, 5, '모든 물을 다스리는 해저 왕', 'korea'),
      ('칠성신',       ${dm.kr_spirit}, '⭐', 140, 20, 8, 3, 70, 55, 5, ${cm['마법생물']}, 3, '북두칠성의 수호 정령', 'korea'),
      ('목신',         ${dm.kr_forest}, '🌳', 90, 14, 8, 2, 40, 30, 8, ${cm['식물/균류']}, 2, '고목에 깃든 나무 정령', 'korea'),
      ('영등할매',     ${dm.kr_mountain}, '🌪️', 150, 24, 6, 4, 80, 62, 5, ${cm['마법생물']}, 3, '제주의 바람을 다스리는 풍신', 'korea'),
      ('인면조',       ${dm.kr_spirit}, '🐦', 120, 18, 6, 4, 60, 46, 6, ${cm['마법생물']}, 3, '사람 얼굴을 가진 새', 'korea'),
      ('백호',         ${dm.kr_mountain}, '🐅', 300, 40, 16, 3, 250, 200, 2, ${cm['야수']}, 5, '서방의 수호신 백호', 'korea'),
      ('현무',         ${dm.kr_swamp}, '🐢', 300, 36, 22, 2, 250, 200, 2, ${cm['마법생물']}, 5, '북방의 수호신 현무', 'korea'),
      ('청룡',         ${dm.kr_spirit}, '🐉', 320, 42, 16, 3, 260, 210, 2, ${cm['용족']}, 5, '동방의 수호신 청룡', 'korea'),
      ('주작',         ${dm.kr_spirit}, '🐦', 310, 44, 14, 4, 260, 210, 2, ${cm['마법생물']}, 5, '남방의 수호신 주작', 'korea'),
      ('기린',         ${dm.kr_spirit}, '🦌', 200, 24, 16, 3, 120, 95, 3, ${cm['마법생물']}, 4, '성인이 태어날 때 나타나는 인수', 'korea'),
      ('불여우',       ${dm.kr_mountain}, '🦊', 130, 22, 5, 4, 70, 55, 5, ${cm['야수']}, 3, '백 년을 살아 불을 부리는 여우', 'korea'),
      ('어둑시니',     ${dm.kr_swamp}, '🌑', 120, 20, 4, 3, 60, 48, 6, ${cm['귀신/원혼']}, 3, '쳐다보면 커지는 어둠의 괴물', 'korea'),
      ('두억시니',     ${dm.kr_mountain}, '👹', 170, 28, 10, 3, 90, 72, 4, ${cm['악마/마족']}, 4, '씨름을 좋아하는 거대한 악귀', 'korea'),
      ('장산범',       ${dm.kr_mountain}, '🐅', 160, 26, 8, 4, 85, 68, 5, ${cm['야수']}, 4, '사람 울음을 흉내내는 흰 짐승', 'korea'),
      ('꽝철이',       ${dm.kr_swamp}, '🐍', 130, 22, 6, 3, 68, 52, 6, ${cm['야수']}, 3, '용이 못 된 타락한 이무기', 'korea'),
      ('장승',         ${dm.kr_forest}, '🗿', 60, 10, 10, 1, 25, 18, 10, ${cm['마법생물']}, 1, '마을을 지키는 수호 장승', 'korea'),
      ('백사',         ${dm.kr_swamp}, '🐍', 120, 20, 5, 3, 60, 48, 6, ${cm['야수']}, 3, '천 년 수행한 흰 뱀 정령', 'korea'),
      ('매구',         ${dm.kr_temple}, '🦊', 130, 22, 4, 4, 68, 54, 5, ${cm['악마/마족']}, 3, '사람에게 빙의하는 여우 악령', 'korea'),
      ('살귀',         ${dm.kr_temple}, '💀', 170, 28, 6, 3, 90, 72, 4, ${cm['악마/마족']}, 4, '역병을 퍼뜨리는 역귀', 'korea'),
      ('수귀',         ${dm.kr_swamp}, '👻', 110, 18, 5, 3, 55, 42, 7, ${cm['귀신/원혼']}, 3, '물속에서 사람을 끌어들이는 귀신', 'korea'),
      ('바리공주',     ${dm.kr_spirit}, '👸', 200, 30, 10, 3, 120, 95, 3, ${cm['귀신/원혼']}, 4, '저승에서 생명수를 구해온 공주', 'korea'),
      ('황금 사슴',    ${dm.kr_forest}, '🦌', 80, 12, 5, 5, 60, 80, 3, ${cm['야수']}, 2, '백두산의 행운을 가져다주는 금사슴', 'korea'),
      ('장자마리',     ${dm.kr_swamp}, '🐸', 50, 8, 4, 2, 20, 15, 10, ${cm['수생/해양']}, 1, '해초를 뒤집어쓴 뚱뚱한 물귀신', 'korea'),
      ('염라대왕',     ${dm.kr_spirit}, '👑', 380, 48, 20, 2, 350, 280, 1, ${cm['악마/마족']}, 5, '저승을 다스리는 심판의 왕', 'korea'),
      ('천하대장군',   ${dm.kr_mountain}, '⚔️', 150, 24, 12, 2, 80, 62, 5, ${cm['마법생물']}, 3, '천하를 지키는 수호 장군 정령', 'korea'),
      ('백 사슴',      ${dm.kr_forest}, '🦌', 70, 10, 4, 5, 30, 22, 10, ${cm['야수']}, 2, '하루에 오천리를 달리는 흰 사슴', 'korea'),
      ('장자못의 뱀',  ${dm.kr_swamp}, '🐍', 180, 28, 10, 3, 100, 80, 4, ${cm['야수']}, 4, '장자못 전설의 거대한 신뱀', 'korea')
    `);

    // ===== 일본 몬스터 50개 =====
    await pool.query(`INSERT INTO monsters (name, dungeon_id, icon, hp, attack, defense, move_range, exp_reward, gold_reward, spawn_weight, category_id, tier, description, country) VALUES
      ('킷수네',       ${dm.jp_forest}, '🦊', 180, 28, 6, 4, 100, 80, 4, ${cm['요괴/변이']}, 4, '아홉 꼬리의 변신 여우', 'japan'),
      ('타누키',       ${dm.jp_forest}, '🦝', 80, 14, 4, 3, 38, 28, 8, ${cm['요괴/변이']}, 2, '잎사귀로 변신하는 너구리', 'japan'),
      ('바케네코',     ${dm.jp_spirit}, '🐱', 120, 20, 5, 4, 60, 48, 6, ${cm['요괴/변이']}, 3, '시체를 조종하는 요괴 고양이', 'japan'),
      ('네코마타',     ${dm.jp_spirit}, '🐱', 130, 22, 5, 4, 68, 54, 5, ${cm['악마/마족']}, 3, '두 갈래 꼬리의 마성 고양이', 'japan'),
      ('갓파',         ${dm.jp_ocean}, '🐸', 80, 14, 5, 3, 38, 28, 8, ${cm['수생/해양']}, 2, '머리에 물접시를 인 물귀신', 'japan'),
      ('야마타노오로치', ${dm.jp_ocean}, '🐍', 380, 48, 20, 2, 350, 280, 1, ${cm['용족']}, 5, '여덟 머리 여덟 꼬리의 거대 뱀', 'japan'),
      ('츠치구모',     ${dm.jp_mountain}, '🕷️', 170, 26, 8, 3, 90, 72, 4, ${cm['곤충/벌레']}, 4, '산속 동굴의 거대 독거미', 'japan'),
      ('조로구모',     ${dm.jp_temple}, '🕷️', 180, 28, 6, 3, 100, 80, 4, ${cm['악마/마족']}, 4, '여인으로 변신하는 400년 거미', 'japan'),
      ('누레온나',     ${dm.jp_ocean}, '🐍', 130, 22, 5, 3, 68, 54, 5, ${cm['요괴/변이']}, 3, '여자 머리에 뱀 몸의 강가 요괴', 'japan'),
      ('누에',         ${dm.jp_mountain}, '🐒', 170, 26, 8, 4, 90, 72, 4, ${cm['요괴/변이']}, 4, '원숭이 얼굴에 호랑이 팔다리의 키메라', 'japan'),
      ('아카오니',     ${dm.jp_mountain}, '👹', 130, 22, 8, 3, 68, 54, 5, ${cm['악마/마족']}, 3, '철곤봉을 든 붉은 도깨비', 'japan'),
      ('아오오니',     ${dm.jp_mountain}, '👹', 130, 20, 10, 3, 68, 54, 5, ${cm['악마/마족']}, 3, '죄인을 벌하는 푸른 도깨비', 'japan'),
      ('슈텐도지',     ${dm.jp_mountain}, '👹', 350, 45, 18, 2, 300, 250, 2, ${cm['악마/마족']}, 5, '술을 마시는 오니의 왕', 'japan'),
      ('이바라키도지', ${dm.jp_mountain}, '👹', 320, 42, 16, 3, 280, 220, 2, ${cm['악마/마족']}, 5, '슈텐도지의 외팔 부장', 'japan'),
      ('한냐',         ${dm.jp_temple}, '😈', 170, 28, 6, 3, 90, 72, 4, ${cm['악마/마족']}, 4, '질투로 변한 뿔 달린 여귀', 'japan'),
      ('아마노자쿠',   ${dm.jp_forest}, '👿', 80, 14, 4, 4, 38, 28, 8, ${cm['악마/마족']}, 2, '사람의 어두운 욕망을 부추기는 소악마', 'japan'),
      ('야샤',         ${dm.jp_temple}, '👹', 170, 28, 8, 3, 90, 72, 4, ${cm['악마/마족']}, 4, '불교의 사나운 수호 야차', 'japan'),
      ('가키',         ${dm.jp_temple}, '💀', 70, 10, 3, 3, 30, 22, 10, ${cm['귀신/원혼']}, 2, '영원한 굶주림의 아귀', 'japan'),
      ('텐구',         ${dm.jp_mountain}, '👺', 180, 28, 8, 4, 100, 80, 4, ${cm['요괴/변이']}, 4, '긴 코의 산신 검객', 'japan'),
      ('카라스텐구',   ${dm.jp_mountain}, '🐦', 140, 24, 6, 4, 75, 58, 5, ${cm['요괴/변이']}, 3, '까마귀 머리의 하급 텐구', 'japan'),
      ('코다마',       ${dm.jp_forest}, '✨', 40, 6, 2, 3, 15, 10, 10, ${cm['정령']}, 1, '고목에 깃든 작은 나무 정령', 'japan'),
      ('자시키와라시', ${dm.jp_forest}, '👶', 50, 8, 2, 3, 20, 15, 10, ${cm['귀신/원혼']}, 1, '집에 행운을 가져다주는 어린 유령', 'japan'),
      ('유키온나',     ${dm.jp_mountain}, '❄️', 180, 30, 6, 3, 100, 80, 4, ${cm['요괴/변이']}, 4, '눈보라 속의 아름다운 설녀', 'japan'),
      ('야마우바',     ${dm.jp_mountain}, '🧓', 130, 22, 6, 3, 68, 54, 5, ${cm['요괴/변이']}, 3, '여행자를 유혹하는 산속 마녀', 'japan'),
      ('카와히메',     ${dm.jp_ocean}, '💧', 90, 16, 4, 3, 42, 32, 8, ${cm['정령']}, 2, '달빛 강에 나타나는 아름다운 강의 공주', 'japan'),
      ('츠쿠모가미',   ${dm.jp_forest}, '🏮', 50, 8, 3, 2, 20, 15, 10, ${cm['마법생물']}, 1, '100년 묵은 물건이 깨어난 요괴', 'japan'),
      ('카마이타치',   ${dm.jp_spirit}, '🌪️', 90, 18, 2, 5, 42, 32, 8, ${cm['야수']}, 2, '회오리바람 속의 낫족제비', 'japan'),
      ('우미보즈',     ${dm.jp_ocean}, '🌊', 200, 30, 12, 2, 120, 95, 3, ${cm['귀신/원혼']}, 4, '잔잔한 바다에서 솟아오르는 거대 유령', 'japan'),
      ('유레이',       ${dm.jp_temple}, '👻', 80, 14, 2, 4, 38, 28, 8, ${cm['귀신/원혼']}, 2, '하얀 수의의 일본 전통 유령', 'japan'),
      ('오이와',       ${dm.jp_temple}, '👻', 170, 28, 4, 3, 90, 72, 4, ${cm['귀신/원혼']}, 4, '독에 의해 변형된 원령', 'japan'),
      ('오키쿠',       ${dm.jp_temple}, '👻', 130, 22, 4, 3, 68, 54, 5, ${cm['귀신/원혼']}, 3, '우물에서 접시를 세는 하녀 원령', 'japan'),
      ('후나유레이',   ${dm.jp_ocean}, '👻', 120, 20, 4, 3, 60, 48, 6, ${cm['귀신/원혼']}, 3, '바다에서 배를 침몰시키는 유령들', 'japan'),
      ('가샤도쿠로',   ${dm.jp_spirit}, '💀', 300, 40, 14, 2, 250, 200, 2, ${cm['귀신/원혼']}, 5, '굶어죽은 자들의 뼈로 이뤄진 거대 해골', 'japan'),
      ('시니가미',     ${dm.jp_spirit}, '💀', 180, 28, 6, 4, 100, 80, 4, ${cm['귀신/원혼']}, 4, '죽음으로 이끄는 사신', 'japan'),
      ('류진',         ${dm.jp_ocean}, '🐉', 350, 45, 18, 3, 300, 250, 2, ${cm['용족']}, 5, '해저 궁전의 용왕', 'japan'),
      ('세이류',       ${dm.jp_spirit}, '🐉', 320, 42, 16, 3, 260, 210, 2, ${cm['용족']}, 5, '동방의 수호 청룡', 'japan'),
      ('스자쿠',       ${dm.jp_spirit}, '🐦', 310, 44, 14, 4, 260, 210, 2, ${cm['마법생물']}, 5, '남방의 수호 주작', 'japan'),
      ('뱌코',         ${dm.jp_spirit}, '🐅', 300, 40, 16, 3, 250, 200, 2, ${cm['야수']}, 5, '서방의 수호 백호', 'japan'),
      ('겐부',         ${dm.jp_ocean}, '🐢', 300, 36, 22, 2, 250, 200, 2, ${cm['마법생물']}, 5, '북방의 수호 현무', 'japan'),
      ('누라리횬',     ${dm.jp_spirit}, '🧓', 350, 44, 16, 3, 300, 240, 2, ${cm['악마/마족']}, 5, '모든 요괴의 총대장', 'japan'),
      ('잇탄모멘',     ${dm.jp_forest}, '🧻', 70, 12, 2, 5, 30, 22, 10, ${cm['요괴/변이']}, 2, '밤하늘을 나는 살아있는 천 조각', 'japan'),
      ('로쿠로쿠비',   ${dm.jp_forest}, '🙂', 80, 14, 3, 3, 38, 28, 8, ${cm['요괴/변이']}, 2, '목이 늘어나는 여자 요괴', 'japan'),
      ('후타쿠치온나', ${dm.jp_temple}, '😈', 130, 22, 5, 3, 68, 54, 5, ${cm['악마/마족']}, 3, '뒷머리에 두 번째 입이 있는 저주받은 여인', 'japan'),
      ('나마하게',     ${dm.jp_mountain}, '👹', 130, 22, 8, 3, 68, 54, 5, ${cm['악마/마족']}, 3, '게으름을 벌하는 새해 오니', 'japan'),
      ('카샤',         ${dm.jp_spirit}, '🐱', 130, 24, 5, 4, 68, 54, 5, ${cm['악마/마족']}, 3, '장례식에서 시체를 훔치는 화염 고양이 마귀', 'japan'),
      ('햐쿠메',       ${dm.jp_spirit}, '👁️', 120, 20, 5, 3, 60, 48, 6, ${cm['악마/마족']}, 3, '온 몸에 수백 개의 눈이 달린 괴물', 'japan'),
      ('와뉴도',       ${dm.jp_spirit}, '🔥', 170, 28, 4, 4, 90, 72, 4, ${cm['악마/마족']}, 4, '불타는 수레바퀴에 얼굴이 박힌 요괴', 'japan'),
      ('히히',         ${dm.jp_mountain}, '🐒', 130, 22, 6, 3, 68, 54, 5, ${cm['야수']}, 3, '인간의 감정을 읽는 거대 원숭이', 'japan'),
      ('이츠마덴',     ${dm.jp_spirit}, '🐦', 170, 28, 6, 4, 90, 72, 4, ${cm['야수']}, 4, '사람 얼굴과 뱀 꼬리를 가진 화염 괴조', 'japan'),
      ('우부메',       ${dm.jp_temple}, '👻', 80, 14, 3, 3, 38, 28, 8, ${cm['귀신/원혼']}, 2, '출산 중 죽은 여인의 슬픈 원령', 'japan')
    `);

    // ===== 중국 몬스터 50개 =====
    await pool.query(`INSERT INTO monsters (name, dungeon_id, icon, hp, attack, defense, move_range, exp_reward, gold_reward, spawn_weight, category_id, tier, description, country) VALUES
      ('도철',         ${dm.cn_mountain}, '👹', 300, 40, 16, 2, 250, 200, 2, ${cm['악마/마족']}, 5, '끝없는 탐욕의 사흉 괴수', 'china'),
      ('혼돈',         ${dm.cn_spirit}, '🌀', 320, 38, 18, 2, 260, 210, 2, ${cm['악마/마족']}, 5, '눈코입 없는 원초적 혼돈의 화신', 'china'),
      ('궁기',         ${dm.cn_spirit}, '🐅', 310, 42, 16, 3, 260, 210, 2, ${cm['악마/마족']}, 5, '날개 달린 사악한 호랑이', 'china'),
      ('도올',         ${dm.cn_mountain}, '🐅', 300, 40, 14, 3, 250, 200, 2, ${cm['악마/마족']}, 5, '사람 얼굴과 뱀 꼬리의 호랑이', 'china'),
      ('녠수',         ${dm.cn_forest}, '🦁', 170, 26, 8, 3, 90, 72, 4, ${cm['야수']}, 4, '매년 마을을 습격하는 설날의 괴수', 'china'),
      ('기린',         ${dm.cn_spirit}, '🦌', 350, 40, 20, 3, 300, 250, 2, ${cm['마법생물']}, 5, '용 비늘과 사슴 뿔의 인수', 'china'),
      ('비휴',         ${dm.cn_mountain}, '🦁', 180, 26, 12, 3, 100, 80, 4, ${cm['마법생물']}, 4, '금은을 먹는 날개 달린 사자', 'china'),
      ('백택',         ${dm.cn_spirit}, '🐂', 300, 36, 18, 2, 250, 200, 2, ${cm['마법생물']}, 5, '만 가지 요괴를 아는 지혜의 신수', 'china'),
      ('청룡',         ${dm.cn_spirit}, '🐉', 320, 42, 16, 3, 260, 210, 2, ${cm['용족']}, 5, '동방의 수호 청룡', 'china'),
      ('상류',         ${dm.cn_swamp}, '🐍', 300, 40, 14, 2, 250, 200, 2, ${cm['야수']}, 5, '아홉 머리의 독뱀 장관', 'china'),
      ('축음',         ${dm.cn_spirit}, '🐍', 350, 46, 18, 2, 300, 250, 2, ${cm['마법생물']}, 5, '눈을 뜨면 낮, 감으면 밤이 되는 거대 뱀신', 'china'),
      ('백사',         ${dm.cn_swamp}, '🐍', 170, 26, 6, 3, 90, 72, 4, ${cm['요괴/변이']}, 4, '서호의 아름다운 백사 정', 'china'),
      ('등사',         ${dm.cn_spirit}, '🐍', 140, 22, 6, 4, 75, 58, 5, ${cm['마법생물']}, 3, '안개 속을 나는 신비의 뱀', 'china'),
      ('호리정',       ${dm.cn_forest}, '🦊', 180, 28, 6, 4, 100, 80, 4, ${cm['요괴/변이']}, 4, '인간으로 변신하는 천년 여우 요정', 'china'),
      ('달기',         ${dm.cn_temple}, '🦊', 350, 46, 14, 3, 300, 250, 2, ${cm['악마/마족']}, 5, '상나라를 멸망시킨 천년 여우 요괴', 'china'),
      ('호요',         ${dm.cn_mountain}, '🐅', 170, 28, 8, 3, 90, 72, 4, ${cm['악마/마족']}, 4, '인간으로 변신하는 호랑이 요괴', 'china'),
      ('랑요',         ${dm.cn_forest}, '🐺', 130, 22, 5, 4, 68, 54, 5, ${cm['악마/마족']}, 3, '폭풍을 부르는 늑대 요마', 'china'),
      ('거미정',       ${dm.cn_temple}, '🕷️', 180, 28, 6, 3, 100, 80, 4, ${cm['악마/마족']}, 4, '환술로 여행자를 가두는 일곱 거미 자매', 'china'),
      ('사요',         ${dm.cn_swamp}, '🐍', 120, 20, 4, 3, 60, 48, 6, ${cm['요괴/변이']}, 3, '질병을 퍼뜨리는 뱀 요괴', 'china'),
      ('비파정',       ${dm.cn_temple}, '🦂', 170, 28, 6, 3, 90, 72, 4, ${cm['악마/마족']}, 4, '비파 소리로 유혹하는 전갈꼬리 요괴', 'china'),
      ('강시',         ${dm.cn_swamp}, '🧟', 120, 18, 8, 2, 60, 48, 6, ${cm['귀신/원혼']}, 3, '청나라 관복의 깡충 뛰는 시체', 'china'),
      ('여귀',         ${dm.cn_temple}, '👻', 170, 28, 4, 3, 90, 72, 4, ${cm['귀신/원혼']}, 4, '억울함을 품은 잔혹한 복수귀', 'china'),
      ('아귀',         ${dm.cn_swamp}, '💀', 70, 10, 3, 3, 30, 22, 10, ${cm['귀신/원혼']}, 2, '영원한 굶주림의 아귀', 'china'),
      ('녀귀',         ${dm.cn_temple}, '👻', 130, 22, 4, 3, 68, 54, 5, ${cm['귀신/원혼']}, 3, '붉은 옷의 원한 맺힌 여귀', 'china'),
      ('수귀',         ${dm.cn_swamp}, '👻', 110, 18, 5, 3, 55, 42, 7, ${cm['귀신/원혼']}, 3, '물속에서 익사자를 끌어당기는 물귀신', 'china'),
      ('무두귀',       ${dm.cn_swamp}, '💀', 80, 14, 3, 3, 38, 28, 8, ${cm['귀신/원혼']}, 2, '참수당해 머리 없는 유령', 'china'),
      ('조사귀',       ${dm.cn_swamp}, '👻', 80, 14, 2, 3, 38, 28, 8, ${cm['귀신/원혼']}, 2, '목매달아 죽은 붉은 혀의 귀신', 'china'),
      ('백골정',       ${dm.cn_temple}, '💀', 180, 28, 6, 3, 100, 80, 4, ${cm['귀신/원혼']}, 4, '다양한 인간으로 변신하는 해골 요마', 'china'),
      ('원귀',         ${dm.cn_temple}, '👻', 80, 14, 3, 3, 38, 28, 8, ${cm['귀신/원혼']}, 2, '억울한 죽음의 슬픈 유령', 'china'),
      ('영령',         ${dm.cn_swamp}, '👶', 50, 8, 2, 3, 20, 15, 10, ${cm['귀신/원혼']}, 1, '어린 영혼의 작고 서글픈 유령', 'china'),
      ('필방',         ${dm.cn_forest}, '🐦', 120, 22, 4, 4, 60, 48, 6, ${cm['야수']}, 3, '한 발의 학 모양 화조', 'china'),
      ('비유',         ${dm.cn_forest}, '🐍', 120, 20, 4, 3, 60, 48, 6, ${cm['야수']}, 3, '네 날개 여섯 다리의 가뭄 뱀', 'china'),
      ('희희',         ${dm.cn_swamp}, '🐟', 80, 14, 3, 3, 38, 28, 8, ${cm['수생/해양']}, 2, '날개 달린 홍수를 부르는 물고기', 'china'),
      ('제강',         ${dm.cn_spirit}, '🔴', 170, 28, 8, 3, 90, 72, 4, ${cm['마법생물']}, 4, '얼굴 없이 노래하고 춤추는 혼돈의 존재', 'china'),
      ('비렴',         ${dm.cn_spirit}, '🌪️', 180, 30, 6, 4, 100, 80, 4, ${cm['정령']}, 4, '사슴 머리 용 몸의 바람의 신', 'china'),
      ('영초',         ${dm.cn_spirit}, '🐴', 180, 26, 10, 4, 100, 80, 4, ${cm['마법생물']}, 4, '사람 얼굴의 날개 달린 줄무늬 말', 'china'),
      ('봉황',         ${dm.cn_spirit}, '🐦', 350, 44, 16, 4, 300, 250, 2, ${cm['마법생물']}, 5, '모든 새의 왕 오색 신조', 'china'),
      ('주작',         ${dm.cn_spirit}, '🐦', 310, 44, 14, 4, 260, 210, 2, ${cm['마법생물']}, 5, '남방의 수호신 주작', 'china'),
      ('현무',         ${dm.cn_swamp}, '🐢', 300, 36, 22, 2, 250, 200, 2, ${cm['마법생물']}, 5, '북방의 수호 거북 뱀', 'china'),
      ('백호',         ${dm.cn_mountain}, '🐅', 300, 40, 16, 3, 250, 200, 2, ${cm['야수']}, 5, '서방의 수호 백호', 'china'),
      ('섬서',         ${dm.cn_swamp}, '🐸', 120, 18, 6, 2, 60, 48, 6, ${cm['수생/해양']}, 3, '달에 사는 세 발 두꺼비', 'china'),
      ('귀모',         ${dm.cn_spirit}, '💀', 320, 42, 16, 2, 280, 220, 2, ${cm['악마/마족']}, 5, '귀신을 낳고 기르는 명부의 어머니', 'china'),
      ('발',           ${dm.cn_mountain}, '🔥', 180, 30, 4, 3, 100, 80, 4, ${cm['악마/마족']}, 4, '땅을 시들게 하는 가뭄의 마녀', 'china'),
      ('이매',         ${dm.cn_forest}, '🌑', 120, 20, 4, 3, 60, 48, 6, ${cm['악마/마족']}, 3, '숲속에서 여행자를 미혹하는 산림 요마', 'china'),
      ('우두마면',     ${dm.cn_swamp}, '🐂', 180, 28, 10, 2, 100, 80, 4, ${cm['귀신/원혼']}, 4, '소 머리와 말 얼굴의 지옥 문지기', 'china'),
      ('흑백무상',     ${dm.cn_swamp}, '⚫', 180, 28, 8, 3, 100, 80, 4, ${cm['귀신/원혼']}, 4, '영혼을 잡는 흑과 백의 쌍둥이 저승사자', 'china'),
      ('맹파',         ${dm.cn_swamp}, '🍵', 120, 16, 6, 2, 60, 48, 6, ${cm['귀신/원혼']}, 3, '망각의 차를 끓이는 저승 할머니', 'china'),
      ('귀거',         ${dm.cn_spirit}, '🐦', 170, 28, 6, 4, 90, 72, 4, ${cm['야수']}, 4, '아홉 머리에 피를 뿌리는 흉조', 'china'),
      ('팽후',         ${dm.cn_forest}, '🐕', 120, 20, 5, 3, 60, 48, 6, ${cm['요괴/변이']}, 3, '사람 머리의 개 모양 고목 요괴', 'china'),
      ('망량',         ${dm.cn_swamp}, '👶', 80, 14, 3, 3, 38, 28, 8, ${cm['악마/마족']}, 2, '세 살 아이 모습의 늪지 요마', 'china')
    `);

    console.log('150 country monsters seeded');
  }

  // 나라별 던전-스테이지 그룹 매핑 업데이트
  const [countryDungeonCheck] = await pool.query("SELECT key_name FROM dungeons WHERE key_name = 'kr_forest' LIMIT 1");
  if (countryDungeonCheck.length > 0) {
    const countryGroupDungeonMap = {
      'gojoseon': 'kr_forest', 'samhan': 'kr_forest', 'goguryeo': 'kr_mountain',
      'baekje': 'kr_swamp', 'silla': 'kr_temple', 'balhae': 'kr_mountain',
      'goryeo': 'kr_spirit', 'joseon': 'kr_temple', 'imjin': 'kr_spirit',
      'modern': 'kr_spirit',
      'jomon': 'jp_forest', 'yayoi': 'jp_forest', 'yamato': 'jp_mountain',
      'nara': 'jp_temple', 'heian': 'jp_spirit', 'kamakura': 'jp_mountain',
      'muromachi': 'jp_ocean', 'sengoku': 'jp_mountain', 'edo': 'jp_spirit',
      'meiji': 'jp_spirit',
      'xia_shang': 'cn_forest', 'zhou': 'cn_mountain', 'qin': 'cn_mountain',
      'han': 'cn_forest', 'three_kingdoms': 'cn_swamp', 'tang': 'cn_temple',
      'song': 'cn_spirit', 'yuan': 'cn_temple', 'ming': 'cn_spirit',
      'qing': 'cn_spirit',
    };
    // stage_levels의 dungeon_key 업데이트
    for (const [groupKey, dungeonKey] of Object.entries(countryGroupDungeonMap)) {
      await pool.query(
        'UPDATE stage_levels sl JOIN stage_groups sg ON sl.group_id = sg.id SET sl.dungeon_key = ? WHERE sg.key_name = ?',
        [dungeonKey, groupKey]
      );
    }
    console.log('Stage dungeon keys updated to country-specific dungeons');
  }

  // ========== 던전 스테이지 시스템 ==========
  await pool.query(`
    CREATE TABLE IF NOT EXISTS dungeon_stages (
      id INT AUTO_INCREMENT PRIMARY KEY,
      dungeon_id INT NOT NULL,
      stage_number INT NOT NULL,
      name VARCHAR(100) NOT NULL,
      is_boss TINYINT(1) DEFAULT 0,
      monster_count INT DEFAULT 3,
      monster_level_bonus INT DEFAULT 0,
      reward_exp_bonus INT DEFAULT 0,
      reward_gold_bonus INT DEFAULT 0,
      map_width INT DEFAULT 10,
      map_height INT DEFAULT 10,
      base_tile_type VARCHAR(20) DEFAULT 'grass',
      tile_overrides JSON,
      player_spawns JSON,
      monster_spawns JSON,
      FOREIGN KEY (dungeon_id) REFERENCES dungeons(id) ON DELETE CASCADE,
      UNIQUE KEY unique_dungeon_stage (dungeon_id, stage_number)
    )
  `);

  // 기존 테이블에 맵 컬럼 추가 (이미 존재하면 무시)
  await pool.query('ALTER TABLE dungeon_stages ADD COLUMN map_width INT DEFAULT 10').catch(() => {});
  await pool.query('ALTER TABLE dungeon_stages ADD COLUMN map_height INT DEFAULT 10').catch(() => {});
  await pool.query('ALTER TABLE dungeon_stages ADD COLUMN base_tile_type VARCHAR(20) DEFAULT \'grass\'').catch(() => {});
  await pool.query('ALTER TABLE dungeon_stages ADD COLUMN tile_overrides JSON').catch(() => {});
  await pool.query('ALTER TABLE dungeon_stages ADD COLUMN player_spawns JSON').catch(() => {});
  await pool.query('ALTER TABLE dungeon_stages ADD COLUMN monster_spawns JSON').catch(() => {});

  await pool.query(`
    CREATE TABLE IF NOT EXISTS character_stage_progress (
      id INT AUTO_INCREMENT PRIMARY KEY,
      character_id INT NOT NULL,
      dungeon_id INT NOT NULL,
      stage_number INT NOT NULL DEFAULT 0,
      cleared TINYINT(1) DEFAULT 0,
      cleared_at TIMESTAMP NULL,
      FOREIGN KEY (character_id) REFERENCES characters(id) ON DELETE CASCADE,
      FOREIGN KEY (dungeon_id) REFERENCES dungeons(id) ON DELETE CASCADE,
      UNIQUE KEY unique_char_dungeon (character_id, dungeon_id)
    )
  `);

  // 스테이지별 맵 데이터 생성
  const [existingStages] = await pool.query('SELECT COUNT(*) as cnt FROM dungeon_stages');
  const hasMapData = existingStages[0].cnt > 0
    ? (await pool.query('SELECT tile_overrides FROM dungeon_stages LIMIT 1'))[0][0]?.tile_overrides
    : null;

  if (existingStages[0].cnt === 0 || !hasMapData) {
    // 기존 맵 데이터 없는 스테이지 삭제 후 재생성
    if (existingStages[0].cnt > 0 && !hasMapData) {
      await pool.query('DELETE FROM dungeon_stages');
    }

    const [dRows] = await pool.query('SELECT id, key_name FROM dungeons');
    const dm = {};
    for (const d of dRows) dm[d.key_name] = d.id;

    // ===== 어둠의 숲 (forest) 스테이지 맵들 =====
    const forestStages = [
      { // 1-1: 숲 입구 - 작은 평지
        w: 8, h: 8, base: 'grass',
        overrides: [
          {coords:[[0,3],[0,4],[1,3],[1,4]],height:0,type:'dirt'},
          {coords:[[6,1],[7,1],[6,2]],height:1,type:'grass'},
        ],
        pSpawns: [{x:0,z:0},{x:1,z:0},{x:0,z:1}],
        mSpawns: [{x:7,z:7},{x:6,z:7}],
      },
      { // 1-2: 덤불 사이 길
        w: 9, h: 8, base: 'grass',
        overrides: [
          {coords:[[2,0],[2,1],[2,2],[2,3],[2,4],[2,5],[2,6],[2,7]],height:1,type:'grass'},
          {coords:[[6,0],[6,1],[6,2],[6,3],[6,4],[6,5],[6,6],[6,7]],height:1,type:'grass'},
          {coords:[[4,3],[4,4]],height:2,type:'stone'},
          {coords:[[3,5],[4,5],[5,5]],height:0,type:'dirt'},
        ],
        pSpawns: [{x:0,z:0},{x:1,z:0},{x:0,z:1}],
        mSpawns: [{x:8,z:7},{x:7,z:6}],
      },
      { // 1-3: 작은 연못
        w: 9, h: 9, base: 'grass',
        overrides: [
          {coords:[[3,3],[3,4],[3,5],[4,3],[4,4],[4,5],[5,3],[5,4],[5,5]],height:0,type:'water'},
          {coords:[[2,2],[2,6],[6,2],[6,6]],height:1,type:'stone'},
          {coords:[[1,4],[7,4]],height:0,type:'dirt'},
        ],
        pSpawns: [{x:0,z:0},{x:1,z:0},{x:0,z:1}],
        mSpawns: [{x:8,z:8},{x:7,z:8},{x:8,z:7}],
      },
      { // 1-4: 언덕 지형
        w: 10, h: 8, base: 'grass',
        overrides: [
          {coords:[[3,2],[4,2],[5,2],[3,3],[4,3],[5,3]],height:1,type:'grass'},
          {coords:[[4,2],[4,3]],height:2,type:'grass'},
          {coords:[[7,5],[8,5],[7,6],[8,6]],height:1,type:'dirt'},
          {coords:[[0,7],[1,7]],height:0,type:'dirt'},
        ],
        pSpawns: [{x:0,z:0},{x:1,z:0},{x:0,z:1}],
        mSpawns: [{x:9,z:7},{x:8,z:7},{x:9,z:6}],
      },
      { // 1-5: 갈림길
        w: 10, h: 10, base: 'grass',
        overrides: [
          {coords:[[4,0],[4,1],[4,2],[4,3],[4,4],[5,4],[6,4],[7,4],[8,4],[9,4]],height:0,type:'dirt'},
          {coords:[[4,5],[4,6],[4,7],[4,8],[4,9]],height:0,type:'dirt'},
          {coords:[[1,1],[2,1]],height:2,type:'stone'},
          {coords:[[1,2],[2,2],[3,1]],height:1,type:'stone'},
          {coords:[[7,7],[8,7],[7,8],[8,8]],height:1,type:'grass'},
          {coords:[[2,7],[2,8]],height:0,type:'water'},
        ],
        pSpawns: [{x:0,z:0},{x:1,z:0},{x:0,z:1},{x:1,z:1}],
        mSpawns: [{x:9,z:9},{x:8,z:9},{x:9,z:8}],
      },
      { // 1-6: 울창한 숲
        w: 10, h: 10, base: 'grass',
        overrides: [
          {coords:[[1,1],[3,0],[5,2],[7,1],[2,4],[6,3],[8,5]],height:1,type:'grass'},
          {coords:[[0,6],[1,6],[2,6],[3,6]],height:1,type:'grass'},
          {coords:[[4,8],[5,8],[4,9],[5,9]],height:0,type:'dirt'},
          {coords:[[8,8]],height:0,type:'water'},
        ],
        pSpawns: [{x:0,z:0},{x:1,z:0},{x:0,z:1},{x:1,z:1}],
        mSpawns: [{x:9,z:9},{x:8,z:9},{x:9,z:8},{x:8,z:8}],
      },
      { // 1-7: 늪지대
        w: 10, h: 10, base: 'grass',
        overrides: [
          {coords:[[3,3],[4,3],[5,3],[3,4],[4,4],[5,4],[3,5],[4,5]],height:0,type:'water'},
          {coords:[[6,6],[7,6],[6,7],[7,7]],height:0,type:'water'},
          {coords:[[1,1],[2,1]],height:1,type:'dirt'},
          {coords:[[8,1],[9,1],[8,2]],height:2,type:'stone'},
          {coords:[[0,8],[1,8]],height:1,type:'stone'},
        ],
        pSpawns: [{x:0,z:0},{x:1,z:0},{x:0,z:1},{x:1,z:1}],
        mSpawns: [{x:9,z:9},{x:8,z:9},{x:9,z:8}],
      },
      { // 1-8: 고대 유적 터
        w: 10, h: 10, base: 'grass',
        overrides: [
          {coords:[[3,3],[3,4],[3,5],[3,6],[6,3],[6,4],[6,5],[6,6]],height:2,type:'stone'},
          {coords:[[4,3],[5,3],[4,6],[5,6]],height:1,type:'stone'},
          {coords:[[4,4],[5,4],[4,5],[5,5]],height:0,type:'dirt'},
          {coords:[[1,8],[2,8],[1,9]],height:0,type:'water'},
        ],
        pSpawns: [{x:0,z:0},{x:1,z:0},{x:0,z:1},{x:1,z:1}],
        mSpawns: [{x:9,z:9},{x:8,z:9},{x:9,z:8}],
      },
      { // 1-9: 절벽 위 - 계단식 절벽과 계곡
        w: 12, h: 10, base: 'grass',
        overrides: [
          // 왼쪽 고지대 (계단식 하강: 3→2→1→0)
          {coords:[[0,0],[1,0]],height:3,type:'stone'},
          {coords:[[2,0],[0,1],[1,1]],height:2,type:'stone'},
          {coords:[[2,1],[3,0],[3,1],[0,2],[1,2]],height:1,type:'dirt'},
          // 중앙 상단 숲 언덕
          {coords:[[5,1],[6,1],[5,2],[6,2]],height:1,type:'grass'},
          {coords:[[5,0],[6,0]],height:2,type:'grass'},
          // 중앙 계곡 (물) - 돌다리로 건너기
          {coords:[[3,4],[4,4],[5,4],[6,4],[7,4]],height:0,type:'water'},
          {coords:[[4,5],[5,5],[6,5]],height:0,type:'water'},
          {coords:[[2,4]],height:1,type:'stone'},
          {coords:[[8,4]],height:1,type:'stone'},
          // 중앙 전략 언덕
          {coords:[[5,6],[6,6]],height:2,type:'grass'},
          {coords:[[4,6],[7,6],[5,7],[6,7]],height:1,type:'grass'},
          // 오른쪽 고지대 (계단식 하강: 3→2→1→0)
          {coords:[[10,9],[11,9]],height:3,type:'stone'},
          {coords:[[9,9],[11,8],[10,8]],height:2,type:'stone'},
          {coords:[[8,8],[8,9],[9,8],[11,7],[10,7]],height:1,type:'dirt'},
          // 오른쪽 숲
          {coords:[[9,2],[10,2],[10,1]],height:1,type:'grass'},
          // 웅덩이
          {coords:[[1,8]],height:0,type:'water'},
        ],
        pSpawns: [{x:0,z:0},{x:1,z:0},{x:0,z:1},{x:1,z:1}],
        mSpawns: [{x:11,z:9},{x:10,z:9},{x:11,z:8}],
      },
      { // 1-10: 숲의 심장 (보스)
        w: 12, h: 12, base: 'grass',
        overrides: [
          {coords:[[5,5],[6,5],[5,6],[6,6]],height:3,type:'stone'},
          {coords:[[4,4],[4,5],[4,6],[4,7],[7,4],[7,5],[7,6],[7,7],[5,4],[6,4],[5,7],[6,7]],height:1,type:'grass'},
          {coords:[[3,3],[8,3],[3,8],[8,8]],height:2,type:'stone'},
          {coords:[[1,10],[2,10],[1,11]],height:0,type:'water'},
          {coords:[[10,1],[11,1],[10,2]],height:0,type:'water'},
          {coords:[[0,5],[0,6],[11,5],[11,6]],height:1,type:'dirt'},
        ],
        pSpawns: [{x:0,z:0},{x:1,z:0},{x:0,z:1},{x:1,z:1}],
        mSpawns: [{x:11,z:11},{x:10,z:11},{x:11,z:10},{x:10,z:10}],
      },
    ];

    // ===== 지하 동굴 (cave) 스테이지 맵들 =====
    const caveStages = [
      { // 2-1: 동굴 입구
        w: 8, h: 8, base: 'stone',
        overrides: [
          {coords:[[0,0],[1,0],[0,1]],height:0,type:'dirt'},
          {coords:[[3,3],[4,3],[3,4],[4,4]],height:1,type:'stone'},
          {coords:[[6,6],[7,6],[6,7]],height:1,type:'stone'},
        ],
        pSpawns: [{x:0,z:0},{x:1,z:0},{x:0,z:1}],
        mSpawns: [{x:7,z:7},{x:6,z:7}],
      },
      { // 2-2: 좁은 통로
        w: 6, h: 12, base: 'stone',
        overrides: [
          {coords:[[0,0],[0,1],[0,2],[0,3],[0,4],[0,5],[0,6],[0,7],[0,8],[0,9],[0,10],[0,11]],height:3,type:'stone'},
          {coords:[[5,0],[5,1],[5,2],[5,3],[5,4],[5,5],[5,6],[5,7],[5,8],[5,9],[5,10],[5,11]],height:3,type:'stone'},
          {coords:[[2,5],[3,5]],height:1,type:'stone'},
          {coords:[[2,8],[3,8]],height:0,type:'water'},
        ],
        pSpawns: [{x:2,z:0},{x:3,z:0},{x:2,z:1}],
        mSpawns: [{x:2,z:11},{x:3,z:11}],
      },
      { // 2-3: 지하 호수
        w: 10, h: 10, base: 'stone',
        overrides: [
          {coords:[[3,3],[4,3],[5,3],[6,3],[3,4],[4,4],[5,4],[6,4],[3,5],[4,5],[5,5],[6,5],[3,6],[4,6],[5,6],[6,6]],height:0,type:'water'},
          {coords:[[2,2],[2,7],[7,2],[7,7]],height:2,type:'stone'},
          {coords:[[1,4],[1,5],[8,4],[8,5]],height:1,type:'dirt'},
        ],
        pSpawns: [{x:0,z:0},{x:1,z:0},{x:0,z:1}],
        mSpawns: [{x:9,z:9},{x:8,z:9},{x:9,z:8}],
      },
      { // 2-4: 버섯 동굴
        w: 10, h: 9, base: 'stone',
        overrides: [
          {coords:[[2,2],[5,1],[8,3],[1,6],[4,5],[7,7]],height:1,type:'dirt'},
          {coords:[[3,4],[6,4]],height:2,type:'stone'},
          {coords:[[0,8],[1,8],[9,0],[9,1]],height:0,type:'water'},
        ],
        pSpawns: [{x:0,z:0},{x:1,z:0},{x:0,z:1}],
        mSpawns: [{x:9,z:8},{x:8,z:8},{x:9,z:7}],
      },
      { // 2-5: 무너진 갱도
        w: 10, h: 10, base: 'stone',
        overrides: [
          {coords:[[3,0],[3,1],[3,2],[3,3]],height:3,type:'stone'},
          {coords:[[6,6],[6,7],[6,8],[6,9]],height:3,type:'stone'},
          {coords:[[4,1],[5,1],[4,2],[5,2]],height:1,type:'dirt'},
          {coords:[[7,7],[8,7],[7,8],[8,8]],height:1,type:'dirt'},
          {coords:[[1,5],[2,5]],height:0,type:'water'},
          {coords:[[8,4],[9,4]],height:2,type:'stone'},
        ],
        pSpawns: [{x:0,z:0},{x:1,z:0},{x:0,z:1},{x:1,z:1}],
        mSpawns: [{x:9,z:9},{x:8,z:9},{x:9,z:8}],
      },
      { // 2-6: 수정 동굴
        w: 10, h: 10, base: 'stone',
        overrides: [
          {coords:[[2,2],[3,2],[2,3]],height:3,type:'stone'},
          {coords:[[7,2],[7,3],[8,2]],height:3,type:'stone'},
          {coords:[[2,7],[3,7],[2,8]],height:3,type:'stone'},
          {coords:[[7,7],[7,8],[8,7]],height:3,type:'stone'},
          {coords:[[4,4],[5,4],[4,5],[5,5]],height:2,type:'stone'},
          {coords:[[4,3],[5,3],[3,4],[6,4],[3,5],[6,5],[4,6],[5,6]],height:1,type:'stone'},
        ],
        pSpawns: [{x:0,z:0},{x:1,z:0},{x:0,z:1},{x:1,z:1}],
        mSpawns: [{x:9,z:9},{x:8,z:9},{x:9,z:8},{x:8,z:8}],
      },
      { // 2-7: 용암 지대
        w: 10, h: 10, base: 'stone',
        overrides: [
          {coords:[[2,4],[3,4],[4,4],[5,4],[6,4],[7,4]],height:0,type:'water'},
          {coords:[[2,5],[3,5],[4,5],[5,5],[6,5],[7,5]],height:0,type:'water'},
          {coords:[[0,3],[1,3],[8,3],[9,3]],height:1,type:'dirt'},
          {coords:[[0,6],[1,6],[8,6],[9,6]],height:1,type:'dirt'},
          {coords:[[4,2],[5,2]],height:2,type:'stone'},
          {coords:[[4,7],[5,7]],height:2,type:'stone'},
        ],
        pSpawns: [{x:0,z:0},{x:1,z:0},{x:0,z:1},{x:1,z:1}],
        mSpawns: [{x:9,z:9},{x:8,z:9},{x:9,z:8}],
      },
      { // 2-8: 지하 절벽
        w: 10, h: 10, base: 'stone',
        overrides: [
          {coords:[[0,0],[1,0],[2,0],[0,1],[1,1],[0,2]],height:3,type:'stone'},
          {coords:[[3,0],[2,1],[0,3],[1,3]],height:2,type:'stone'},
          {coords:[[4,0],[3,1],[2,2],[1,2],[0,4]],height:1,type:'dirt'},
          {coords:[[9,9],[8,9],[7,9],[9,8],[8,8],[9,7]],height:0,type:'stone'},
          {coords:[[5,4],[4,5]],height:1,type:'dirt'},
          {coords:[[3,7]],height:0,type:'water'},
        ],
        pSpawns: [{x:3,z:0},{x:4,z:0},{x:4,z:1}],
        mSpawns: [{x:5,z:9},{x:6,z:9},{x:5,z:8}],
      },
      { // 2-9: 깊은 심연
        w: 10, h: 10, base: 'stone',
        overrides: [
          {coords:[[4,0],[5,0],[4,1],[5,1]],height:0,type:'water'},
          {coords:[[0,4],[0,5],[1,4],[1,5]],height:0,type:'water'},
          {coords:[[8,4],[8,5],[9,4],[9,5]],height:0,type:'water'},
          {coords:[[4,8],[5,8],[4,9],[5,9]],height:0,type:'water'},
          {coords:[[4,4],[5,4],[4,5],[5,5]],height:4,type:'stone'},
          {coords:[[3,3],[6,3],[3,6],[6,6]],height:2,type:'stone'},
          {coords:[[2,2],[7,2],[2,7],[7,7]],height:1,type:'dirt'},
        ],
        pSpawns: [{x:0,z:0},{x:1,z:0},{x:0,z:1},{x:1,z:1}],
        mSpawns: [{x:9,z:9},{x:8,z:9},{x:9,z:8}],
      },
      { // 2-10: 지하 왕좌 (보스)
        w: 12, h: 12, base: 'stone',
        overrides: [
          {coords:[[5,5],[6,5],[5,6],[6,6]],height:4,type:'stone'},
          {coords:[[4,4],[7,4],[4,7],[7,7]],height:3,type:'stone'},
          {coords:[[3,3],[8,3],[3,8],[8,8]],height:2,type:'stone'},
          {coords:[[4,5],[4,6],[7,5],[7,6],[5,4],[6,4],[5,7],[6,7]],height:2,type:'stone'},
          {coords:[[1,1],[10,1],[1,10],[10,10]],height:1,type:'dirt'},
          {coords:[[0,5],[0,6],[11,5],[11,6],[5,0],[6,0],[5,11],[6,11]],height:0,type:'water'},
        ],
        pSpawns: [{x:0,z:0},{x:1,z:0},{x:0,z:1},{x:1,z:1}],
        mSpawns: [{x:11,z:11},{x:10,z:11},{x:11,z:10},{x:10,z:10}],
      },
    ];

    // ===== 폐허 사원 (temple) 스테이지 맵들 =====
    const templeStages = [
      { // 3-1: 사원 입구
        w: 8, h: 8, base: 'dark',
        overrides: [
          {coords:[[3,0],[4,0],[3,1],[4,1]],height:1,type:'stone'},
          {coords:[[3,6],[4,6],[3,7],[4,7]],height:1,type:'stone'},
          {coords:[[0,3],[0,4],[7,3],[7,4]],height:2,type:'stone'},
        ],
        pSpawns: [{x:0,z:0},{x:1,z:0},{x:0,z:1}],
        mSpawns: [{x:7,z:7},{x:6,z:7}],
      },
      { // 3-2: 무너진 회랑
        w: 8, h: 12, base: 'dark',
        overrides: [
          {coords:[[0,0],[0,1],[0,2],[0,3],[0,4],[0,5],[0,6],[0,7],[0,8],[0,9],[0,10],[0,11]],height:2,type:'stone'},
          {coords:[[7,0],[7,1],[7,2],[7,3],[7,4],[7,5],[7,6],[7,7],[7,8],[7,9],[7,10],[7,11]],height:2,type:'stone'},
          {coords:[[3,4],[4,4],[3,5],[4,5]],height:1,type:'stone'},
          {coords:[[3,8],[4,8]],height:0,type:'water'},
        ],
        pSpawns: [{x:2,z:0},{x:3,z:0},{x:2,z:1}],
        mSpawns: [{x:5,z:11},{x:4,z:11}],
      },
      { // 3-3: 제단의 방
        w: 10, h: 10, base: 'dark',
        overrides: [
          {coords:[[4,4],[5,4],[4,5],[5,5]],height:3,type:'stone'},
          {coords:[[3,3],[6,3],[3,6],[6,6]],height:1,type:'stone'},
          {coords:[[2,2],[7,2],[2,7],[7,7]],height:0,type:'stone'},
          {coords:[[0,9],[1,9],[9,0],[9,1]],height:0,type:'water'},
        ],
        pSpawns: [{x:0,z:0},{x:1,z:0},{x:0,z:1}],
        mSpawns: [{x:9,z:9},{x:8,z:9},{x:9,z:8}],
      },
      { // 3-4: 저주받은 정원
        w: 10, h: 10, base: 'dark',
        overrides: [
          {coords:[[2,2],[3,2],[4,2],[5,2],[6,2],[7,2]],height:0,type:'grass'},
          {coords:[[2,7],[3,7],[4,7],[5,7],[6,7],[7,7]],height:0,type:'grass'},
          {coords:[[2,3],[2,4],[2,5],[2,6]],height:0,type:'grass'},
          {coords:[[7,3],[7,4],[7,5],[7,6]],height:0,type:'grass'},
          {coords:[[4,4],[5,4],[4,5],[5,5]],height:0,type:'water'},
          {coords:[[0,0],[9,0],[0,9],[9,9]],height:1,type:'stone'},
        ],
        pSpawns: [{x:0,z:0},{x:1,z:0},{x:0,z:1}],
        mSpawns: [{x:9,z:9},{x:8,z:9},{x:9,z:8}],
      },
      { // 3-5: 지하 감옥
        w: 10, h: 10, base: 'dark',
        overrides: [
          {coords:[[2,0],[2,1],[2,2],[2,3],[2,4],[2,5],[2,6],[2,7],[2,8],[2,9]],height:2,type:'stone'},
          {coords:[[7,0],[7,1],[7,2],[7,3],[7,4],[7,5],[7,6],[7,7],[7,8],[7,9]],height:2,type:'stone'},
          {coords:[[2,4],[7,4]],height:0,type:'dark'},
          {coords:[[4,2],[5,2]],height:1,type:'stone'},
          {coords:[[4,7],[5,7]],height:1,type:'stone'},
          {coords:[[0,0],[1,0],[0,1]],height:1,type:'stone'},
        ],
        pSpawns: [{x:0,z:0},{x:1,z:0},{x:0,z:1},{x:1,z:1}],
        mSpawns: [{x:9,z:9},{x:8,z:9},{x:9,z:8}],
      },
      { // 3-6: 마법진의 방
        w: 10, h: 10, base: 'dark',
        overrides: [
          {coords:[[4,1],[5,1],[1,4],[1,5],[8,4],[8,5],[4,8],[5,8]],height:1,type:'stone'},
          {coords:[[3,3],[6,3],[3,6],[6,6]],height:2,type:'stone'},
          {coords:[[4,4],[5,4],[4,5],[5,5]],height:0,type:'water'},
          {coords:[[0,0],[9,0],[0,9],[9,9]],height:1,type:'stone'},
          {coords:[[2,2],[7,2],[2,7],[7,7]],height:1,type:'dirt'},
        ],
        pSpawns: [{x:0,z:0},{x:1,z:0},{x:0,z:1},{x:1,z:1}],
        mSpawns: [{x:9,z:9},{x:8,z:9},{x:9,z:8},{x:8,z:8}],
      },
      { // 3-7: 붕괴된 도서관
        w: 10, h: 10, base: 'dark',
        overrides: [
          {coords:[[1,1],[1,2],[1,3],[1,5],[1,6],[1,7]],height:2,type:'stone'},
          {coords:[[4,1],[4,2],[4,3],[4,5],[4,6],[4,7]],height:2,type:'stone'},
          {coords:[[7,1],[7,2],[7,3],[7,5],[7,6],[7,7]],height:2,type:'stone'},
          {coords:[[2,4],[3,4],[5,4],[6,4],[8,4]],height:0,type:'dirt'},
          {coords:[[9,8],[9,9]],height:1,type:'stone'},
        ],
        pSpawns: [{x:0,z:0},{x:0,z:1},{x:0,z:2},{x:0,z:3}],
        mSpawns: [{x:9,z:9},{x:8,z:9},{x:9,z:8}],
      },
      { // 3-8: 영혼의 다리
        w: 12, h: 8, base: 'dark',
        overrides: [
          {coords:[[0,0],[0,1],[0,2],[1,0],[1,1],[1,2],[2,0],[2,1],[2,2]],height:2,type:'stone'},
          {coords:[[9,5],[9,6],[9,7],[10,5],[10,6],[10,7],[11,5],[11,6],[11,7]],height:2,type:'stone'},
          {coords:[[3,1],[4,1],[5,1],[6,1],[7,1],[8,1]],height:2,type:'stone'},
          {coords:[[3,6],[4,6],[5,6],[6,6],[7,6],[8,6]],height:2,type:'stone'},
          {coords:[[3,3],[4,3],[5,3],[6,3],[7,3],[8,3]],height:1,type:'stone'},
          {coords:[[3,4],[4,4],[5,4],[6,4],[7,4],[8,4]],height:1,type:'stone'},
          {coords:[[3,2],[8,2]],height:1,type:'stone'},
          {coords:[[4,2],[5,2],[6,2],[7,2]],height:0,type:'water'},
          {coords:[[3,5],[8,5]],height:1,type:'stone'},
          {coords:[[4,5],[5,5],[6,5],[7,5]],height:0,type:'water'},
        ],
        pSpawns: [{x:0,z:0},{x:1,z:0},{x:0,z:1},{x:1,z:1}],
        mSpawns: [{x:11,z:7},{x:10,z:7},{x:11,z:6}],
      },
      { // 3-9: 어둠의 회전
        w: 10, h: 10, base: 'dark',
        overrides: [
          {coords:[[4,0],[5,0],[4,1],[5,1]],height:1,type:'stone'},
          {coords:[[8,4],[9,4],[8,5],[9,5]],height:1,type:'stone'},
          {coords:[[4,8],[5,8],[4,9],[5,9]],height:1,type:'stone'},
          {coords:[[0,4],[1,4],[0,5],[1,5]],height:1,type:'stone'},
          {coords:[[4,4],[5,4],[4,5],[5,5]],height:3,type:'stone'},
          {coords:[[2,2],[3,2],[2,3]],height:2,type:'stone'},
          {coords:[[7,2],[7,3],[6,2]],height:2,type:'stone'},
          {coords:[[2,7],[2,6],[3,7]],height:2,type:'stone'},
          {coords:[[7,7],[7,6],[6,7]],height:2,type:'stone'},
          {coords:[[3,4],[3,5],[6,4],[6,5],[4,3],[5,3],[4,6],[5,6]],height:0,type:'water'},
        ],
        pSpawns: [{x:0,z:0},{x:1,z:0},{x:0,z:1},{x:1,z:1}],
        mSpawns: [{x:9,z:9},{x:8,z:9},{x:9,z:8}],
      },
      { // 3-10: 암흑 왕좌 (보스)
        w: 14, h: 14, base: 'dark',
        overrides: [
          {coords:[[6,6],[7,6],[6,7],[7,7]],height:5,type:'stone'},
          {coords:[[5,5],[8,5],[5,8],[8,8]],height:3,type:'stone'},
          {coords:[[5,6],[5,7],[8,6],[8,7],[6,5],[7,5],[6,8],[7,8]],height:2,type:'stone'},
          {coords:[[4,4],[9,4],[4,9],[9,9]],height:2,type:'stone'},
          {coords:[[3,3],[10,3],[3,10],[10,10]],height:1,type:'stone'},
          {coords:[[0,6],[0,7],[13,6],[13,7],[6,0],[7,0],[6,13],[7,13]],height:0,type:'water'},
          {coords:[[1,1],[12,1],[1,12],[12,12]],height:1,type:'dirt'},
          {coords:[[2,6],[2,7],[11,6],[11,7],[6,2],[7,2],[6,11],[7,11]],height:1,type:'stone'},
        ],
        pSpawns: [{x:0,z:0},{x:1,z:0},{x:0,z:1},{x:1,z:1}],
        mSpawns: [{x:13,z:13},{x:12,z:13},{x:13,z:12},{x:12,z:12}],
      },
    ];

    // ===== 새 던전 스테이지 맵 (간단한 프로시저 생성) =====
    const generateStages = (base, tileType) => {
      const stages = [];
      for (let s = 0; s < 10; s++) {
        const w = 8 + Math.floor(s / 3) * 2;
        const h = 8 + Math.floor(s / 3) * 2;
        const overrides = [];
        // 중앙 장애물
        const cx = Math.floor(w/2), cz = Math.floor(h/2);
        overrides.push({coords:[[cx,cz],[cx+1,cz],[cx,cz+1],[cx+1,cz+1]], height: 1 + Math.floor(s/3), type: 'stone'});
        // 물 타일
        if (s % 2 === 0) overrides.push({coords:[[0,h-1],[1,h-1]], height:0, type:'water'});
        if (s % 3 === 0) overrides.push({coords:[[w-1,0],[w-2,0]], height:0, type:'water'});
        // 언덕
        if (s > 3) overrides.push({coords:[[2,2],[w-3,2]], height:2, type: tileType || base});
        if (s > 6) overrides.push({coords:[[2,h-3],[w-3,h-3]], height:3, type:'stone'});
        // 흙 타일
        overrides.push({coords:[[Math.floor(w/2),0],[Math.floor(w/2),1]], height:0, type:'dirt'});

        const pSpawns = [{x:0,z:0},{x:1,z:0},{x:0,z:1},{x:1,z:1}];
        const mSpawns = [{x:w-1,z:h-1},{x:w-2,z:h-1},{x:w-1,z:h-2}];
        if (s >= 7) mSpawns.push({x:w-2,z:h-2});
        stages.push({ w, h, base, overrides, pSpawns, mSpawns });
      }
      return stages;
    };

    const swampStages = generateStages('grass', 'grass');
    const mountainStages = generateStages('stone', 'stone');
    const demonStages = generateStages('dark', 'dark');
    const dragonStages = generateStages('stone', 'stone');
    const oceanStages = generateStages('stone', 'stone');
    const goblinStages = generateStages('grass', 'grass');
    const spiritForestStages = generateStages('grass', 'grass');
    const slimeCaveStages = generateStages('stone', 'stone');

    const allStages = {
      forest: forestStages, cave: caveStages, temple: templeStages,
      swamp: swampStages, mountain: mountainStages, demon: demonStages,
      dragon: dragonStages, ocean: oceanStages, goblin: goblinStages,
      spirit_forest: spiritForestStages, slime_cave: slimeCaveStages
    };

    for (const key of Object.keys(dm)) {
      const stages = allStages[key] || forestStages;
      for (let s = 1; s <= 10; s++) {
        const isBoss = s === 10 ? 1 : 0;
        const monsterCount = isBoss ? 4 : Math.min(1 + Math.floor(s / 3), 3);
        const levelBonus = Math.floor(s / 2);
        const expBonus = s * 5 + (isBoss ? 50 : 0);
        const goldBonus = s * 3 + (isBoss ? 30 : 0);
        const stageName = isBoss ? `${s} (보스)` : `${s}`;
        const mapData = stages[s - 1];

        await pool.query(
          `INSERT INTO dungeon_stages (dungeon_id, stage_number, name, is_boss, monster_count, monster_level_bonus, reward_exp_bonus, reward_gold_bonus, map_width, map_height, base_tile_type, tile_overrides, player_spawns, monster_spawns) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [dm[key], s, stageName, isBoss, monsterCount, levelBonus, expBonus, goldBonus,
           mapData.w, mapData.h, mapData.base,
           JSON.stringify(mapData.overrides), JSON.stringify(mapData.pSpawns), JSON.stringify(mapData.mSpawns)]
        );
      }
    }
  }

  // ========== 몬스터 AI 시스템 ==========
  // monsters 테이블에 ai_type, mp, range_type 컬럼 추가
  await pool.query("ALTER TABLE monsters ADD COLUMN ai_type ENUM('aggressive','defensive','ranged','support','boss','coward') DEFAULT 'aggressive'").catch(() => {});
  await pool.query("ALTER TABLE monsters ADD COLUMN mp INT DEFAULT 0").catch(() => {});
  await pool.query("ALTER TABLE monsters ADD COLUMN range_type ENUM('melee','ranged','magic') DEFAULT 'melee'").catch(() => {});
  // range_type에 magic 추가 (기존 ENUM 확장)
  await pool.query("ALTER TABLE monsters MODIFY COLUMN range_type ENUM('melee','ranged','magic') DEFAULT 'melee'").catch(() => {});
  // 속성 컬럼 추가
  await pool.query("ALTER TABLE monsters ADD COLUMN element ENUM('fire','water','earth','wind','neutral') DEFAULT 'neutral'").catch(() => {});
  // 전투 스탯 컬럼 추가
  await pool.query("ALTER TABLE monsters ADD COLUMN phys_attack INT DEFAULT 5").catch(() => {});
  await pool.query("ALTER TABLE monsters ADD COLUMN phys_defense INT DEFAULT 3").catch(() => {});
  await pool.query("ALTER TABLE monsters ADD COLUMN mag_attack INT DEFAULT 3").catch(() => {});
  await pool.query("ALTER TABLE monsters ADD COLUMN mag_defense INT DEFAULT 2").catch(() => {});
  await pool.query("ALTER TABLE monsters ADD COLUMN crit_rate INT DEFAULT 5").catch(() => {});
  await pool.query("ALTER TABLE monsters ADD COLUMN evasion INT DEFAULT 3").catch(() => {});

  // 몬스터 스킬 테이블
  await pool.query(`
    CREATE TABLE IF NOT EXISTS monster_skills (
      id INT AUTO_INCREMENT PRIMARY KEY,
      name VARCHAR(50) NOT NULL,
      type ENUM('attack','heal','buff','debuff','aoe') NOT NULL,
      damage_multiplier FLOAT DEFAULT 1.0,
      heal_amount INT DEFAULT 0,
      buff_stat VARCHAR(20) DEFAULT NULL,
      buff_value INT DEFAULT 0,
      mp_cost INT DEFAULT 0,
      cooldown INT DEFAULT 0,
      range_val INT DEFAULT 1,
      pattern VARCHAR(20) DEFAULT 'diamond',
      description VARCHAR(200) DEFAULT NULL,
      icon VARCHAR(10) DEFAULT '✨'
    )
  `);

  // 몬스터-스킬 연결 테이블
  await pool.query(`
    CREATE TABLE IF NOT EXISTS monster_skill_map (
      id INT AUTO_INCREMENT PRIMARY KEY,
      monster_id INT NOT NULL,
      skill_id INT NOT NULL,
      FOREIGN KEY (monster_id) REFERENCES monsters(id) ON DELETE CASCADE,
      FOREIGN KEY (skill_id) REFERENCES monster_skills(id) ON DELETE CASCADE,
      UNIQUE KEY unique_monster_skill (monster_id, skill_id)
    )
  `);

  // 몬스터 스킬 시딩
  const [existingMSkills] = await pool.query('SELECT COUNT(*) as cnt FROM monster_skills');
  if (existingMSkills[0].cnt === 0) {
    await pool.query(`INSERT INTO monster_skills (name, type, damage_multiplier, heal_amount, buff_stat, buff_value, mp_cost, cooldown, range_val, pattern, description, icon) VALUES
      ('물기',       'attack', 1.3, 0, NULL, 0, 0, 0, 1, 'diamond', '날카로운 이빨로 물어뜯는다.', '🦷'),
      ('독 공격',    'attack', 1.2, 0, NULL, 0, 5, 1, 1, 'diamond', '독을 주입하는 공격.', '☠️'),
      ('할퀴기',     'attack', 1.5, 0, NULL, 0, 0, 0, 1, 'diamond', '날카로운 발톱으로 할퀸다.', '🐾'),
      ('화염 토',    'attack', 1.8, 0, NULL, 0, 10, 2, 2, 'diamond', '불꽃을 내뿜는다.', '🔥'),
      ('얼음 숨결',  'attack', 1.7, 0, NULL, 0, 10, 2, 2, 'cross', '차가운 숨결을 내뿜는다.', '❄️'),
      ('번개 강타',  'attack', 2.0, 0, NULL, 0, 15, 3, 3, 'line', '번개를 내리친다.', '⚡'),
      ('암흑 구체',  'attack', 1.6, 0, NULL, 0, 8, 1, 3, 'diamond', '어둠의 에너지를 발사한다.', '🌑'),
      ('지진',       'aoe',   1.4, 0, NULL, 0, 12, 3, 2, 'cross', '주변 땅을 뒤흔든다.', '💥'),
      ('독안개',     'aoe',   1.0, 0, NULL, 0, 8, 2, 2, 'diamond', '독기를 뿌린다.', '💨'),
      ('치유',       'heal',  0, 30, NULL, 0, 10, 2, 3, 'diamond', '아군의 상처를 치유한다.', '💚'),
      ('대치유',     'heal',  0, 60, NULL, 0, 20, 3, 3, 'diamond', '아군을 강력히 치유한다.', '💖'),
      ('포효',       'buff',  0, 0, 'attack', 5, 8, 3, 0, 'diamond', '포효하며 공격력이 올라간다.', '🗣️'),
      ('방어 태세',  'buff',  0, 0, 'defense', 5, 5, 2, 0, 'diamond', '단단하게 방어 태세를 취한다.', '🛡️'),
      ('약화의 주문','debuff', 0, 0, 'defense', -3, 10, 3, 3, 'diamond', '적의 방어력을 낮춘다.', '⬇️'),
      ('돌진',       'attack', 1.6, 0, NULL, 0, 5, 1, 1, 'diamond', '돌진하여 강력히 부딪힌다.', '💨'),
      ('자폭',       'aoe',   3.0, 0, NULL, 0, 0, 99, 1, 'diamond', '자폭하며 주변에 큰 피해를 준다.', '💣'),
      ('생명력 흡수','attack', 1.3, 15, NULL, 0, 10, 2, 1, 'diamond', '공격하며 생명력을 흡수한다.', '🩸'),
      ('꼬리 휘두르기','aoe', 1.3, 0, NULL, 0, 8, 2, 1, 'cross', '거대한 꼬리를 휘두른다.', '💫'),
      ('마법 화살',  'attack', 1.4, 0, NULL, 0, 5, 1, 4, 'line', '마법 화살을 발사한다.', '🏹'),
      ('저주',       'debuff', 0, 0, 'attack', -4, 12, 3, 3, 'diamond', '적의 공격력을 낮춘다.', '🔮')
    `);

  }

  // 몬스터별 AI 타입 + MP 설정 (항상 실행 - 누락 방지)
  const aiTypeUpdates = [
    "UPDATE monsters SET ai_type='aggressive' WHERE name IN ('들쥐','야생 늑대','멧돼지','독사','흑곰','설표','지하 도마뱀','삼두견','백호','산토끼')",
    "UPDATE monsters SET ai_type='aggressive' WHERE name IN ('독거미','거대 지네','독나방','킬러비','전갈','사마귀 전사','장수풍뎅이')",
    "UPDATE monsters SET ai_type='defensive' WHERE name IN ('골렘','마법 갑옷','가디언','트렌트','대지의 정령','돌 도깨비','불가사리','가고일','마나 골렘')",
    "UPDATE monsters SET ai_type='ranged' WHERE name IN ('원혼','흑마법사','네크로맨서','대마법사','불의 정령','번개 정령','빛의 정령','어둠의 정령','서큐버스','불 도깨비')",
    "UPDATE monsters SET ai_type='support' WHERE name IN ('여왕 개미','물의 정령','유니콘','처녀귀신','독 거미 여왕','연못 도깨비','인어 전사','해마 기사')",
    "UPDATE monsters SET ai_type='boss' WHERE name IN ('어둠의 수호자','정령왕','깨비대왕','마왕','용왕','리치왕','크라켄','바다 용','암흑룡','이무기','히드라','화룡','빙룡','발록','세계수의 파편','점액 군주','균류 군주','킹 슬라임','다크 세라핌','뇌룡')",
    "UPDATE monsters SET ai_type='coward' WHERE name IN ('초록 슬라임','파랑 슬라임','꼬마 도깨비','떠도는 영혼','독버섯','포자 군체','봉사귀','숲 도깨비','금속 슬라임','크리스탈 슬라임')",
    "UPDATE monsters SET ai_type='aggressive' WHERE name IN ('용암 슬라임','포식 슬라임')",
    // MP 설정: tier 기반 세분화 (마법형 > 지원형 > 원거리 > 방어형 > 공격형 > 도주형)
    // 공격형: 기본 스킬 1~2회 사용 가능
    "UPDATE monsters SET mp=15 WHERE ai_type='aggressive' AND tier <= 3",
    "UPDATE monsters SET mp=25 WHERE ai_type='aggressive' AND tier BETWEEN 4 AND 5",
    "UPDATE monsters SET mp=35 WHERE ai_type='aggressive' AND tier >= 6",
    // 방어형: 방어 태세 등 버프 스킬 2~3회
    "UPDATE monsters SET mp=20 WHERE ai_type='defensive' AND tier <= 3",
    "UPDATE monsters SET mp=30 WHERE ai_type='defensive' AND tier BETWEEN 4 AND 5",
    "UPDATE monsters SET mp=45 WHERE ai_type='defensive' AND tier >= 6",
    // 도주형: MP 최소
    "UPDATE monsters SET mp=10 WHERE ai_type='coward'",
    // 원거리/마법형: 스킬 주력이므로 MP 높음
    "UPDATE monsters SET mp=35 WHERE ai_type='ranged' AND tier <= 3",
    "UPDATE monsters SET mp=50 WHERE ai_type='ranged' AND tier BETWEEN 4 AND 5",
    "UPDATE monsters SET mp=70 WHERE ai_type='ranged' AND tier >= 6",
    // 지원형: 치유/버프 지속 사용
    "UPDATE monsters SET mp=40 WHERE ai_type='support' AND tier <= 3",
    "UPDATE monsters SET mp=55 WHERE ai_type='support' AND tier BETWEEN 4 AND 5",
    "UPDATE monsters SET mp=75 WHERE ai_type='support' AND tier >= 6",
    // 보스: 전투 지속력 높음
    "UPDATE monsters SET mp=80 WHERE ai_type='boss' AND tier <= 6",
    "UPDATE monsters SET mp=120 WHERE ai_type='boss' AND tier >= 7",
    // MP가 0인 몬스터에 기본값 부여
    "UPDATE monsters SET mp=20 WHERE mp=0 OR mp IS NULL",
    // 몬스터 range_type 설정: ranged/support → ranged, 나머지 → melee
    "UPDATE monsters SET range_type='ranged' WHERE ai_type IN ('ranged')",
    "UPDATE monsters SET range_type='melee' WHERE ai_type IN ('aggressive','defensive','coward')",
    // 마법형: 정령, 마법사 계열 몬스터
    // 마법형: 정령, 마법사, 영혼, 저주 계열
    "UPDATE monsters SET range_type='magic' WHERE name IN ('흑마법사','네크로맨서','대마법사','불의 정령','번개 정령','빛의 정령','어둠의 정령','물의 정령','대지의 정령','바람의 정령','얼음 정령','서큐버스','처녀귀신','원혼','불 도깨비','떠도는 영혼','레이스','저주받은 승려','인큐버스','뱀파이어','구미호','천년 여우')",
    // 원거리형: 궁수, 투사형
    "UPDATE monsters SET range_type='ranged' WHERE name IN ('해골 궁수','독나방','킬러비')",
    // 지원형 중 마법 계열은 magic, 나머지는 ranged
    "UPDATE monsters SET range_type='magic' WHERE ai_type='support' AND name IN ('물의 정령','유니콘','처녀귀신')",
    "UPDATE monsters SET range_type='ranged' WHERE ai_type='support' AND range_type='melee'",
    // boss는 개별 설정: 마법형 보스는 magic, 원거리형은 ranged, 물리형은 melee
    "UPDATE monsters SET range_type='magic' WHERE ai_type='boss' AND name IN ('마왕','리치왕','정령왕','세계수의 파편','암흑룡')",
    "UPDATE monsters SET range_type='melee' WHERE ai_type='boss' AND range_type='melee' AND name IN ('깨비대왕','용왕','크라켄','바다 용','이무기','히드라','화룡','빙룡','발록','점액 군주','균류 군주','킹 슬라임','어둠의 수호자')",
    // ===== 한국 몬스터 AI 타입 =====
    "UPDATE monsters SET ai_type='ranged' WHERE name IN ('구미호','삼족오','인면조','불여우','매구','백사') AND country='korea'",
    "UPDATE monsters SET ai_type='defensive' WHERE name IN ('해태','불가사리','산신','현무','천하대장군','장승','목신') AND country='korea'",
    "UPDATE monsters SET ai_type='aggressive' WHERE name IN ('이무기','천리마','불개','삼족구','도깨비','참도깨비','귀수도깨비','두억시니','장산범','꽝철이','장자못의 뱀','각시도깨비') AND country='korea'",
    "UPDATE monsters SET ai_type='support' WHERE name IN ('칠성신','영등할매','기린','바리공주') AND country='korea'",
    "UPDATE monsters SET ai_type='boss' WHERE name IN ('용','봉황','백호','청룡','주작','용왕','강림도령','염라대왕') AND country='korea'",
    "UPDATE monsters SET ai_type='coward' WHERE name IN ('야광귀','황금 사슴','백 사슴','장자마리','몽달귀신') AND country='korea'",
    "UPDATE monsters SET ai_type='ranged' WHERE name IN ('처녀귀신','물귀신','달걀귀신','원혼','저승사자','어둑시니','수귀','달귀','살귀') AND country='korea'",
    // ===== 일본 몬스터 AI 타입 =====
    "UPDATE monsters SET ai_type='ranged' WHERE name IN ('킷수네','바케네코','네코마타','유키온나','한냐','조로구모','오이와','시니가미','카샤','와뉴도','이츠마덴') AND country='japan'",
    "UPDATE monsters SET ai_type='defensive' WHERE name IN ('겐부','츠쿠모가미') AND country='japan'",
    "UPDATE monsters SET ai_type='aggressive' WHERE name IN ('아카오니','아오오니','텐구','카라스텐구','누에','나마하게','히히','츠치구모','야샤') AND country='japan'",
    "UPDATE monsters SET ai_type='support' WHERE name IN ('코다마','카와히메','유레이') AND country='japan'",
    "UPDATE monsters SET ai_type='boss' WHERE name IN ('야마타노오로치','슈텐도지','이바라키도지','가샤도쿠로','류진','세이류','스자쿠','뱌코','누라리횬') AND country='japan'",
    "UPDATE monsters SET ai_type='coward' WHERE name IN ('타누키','자시키와라시','잇탄모멘','로쿠로쿠비','우부메','가키','아마노자쿠') AND country='japan'",
    "UPDATE monsters SET ai_type='ranged' WHERE name IN ('누레온나','갓파','오키쿠','후나유레이','우미보즈','후타쿠치온나','햐쿠메','카마이타치') AND country='japan'",
    // ===== 중국 몬스터 AI 타입 =====
    "UPDATE monsters SET ai_type='ranged' WHERE name IN ('호리정','백사','등사','달기','거미정','비파정','여귀','백골정','사요','발','이매','비렴') AND country='china'",
    "UPDATE monsters SET ai_type='defensive' WHERE name IN ('현무','비휴','백택','섬서') AND country='china'",
    "UPDATE monsters SET ai_type='aggressive' WHERE name IN ('도철','녠수','호요','랑요','상류','우두마면','귀거','팽후','필방','비유') AND country='china'",
    "UPDATE monsters SET ai_type='support' WHERE name IN ('기린','영초','맹파') AND country='china'",
    "UPDATE monsters SET ai_type='boss' WHERE name IN ('혼돈','궁기','도올','축음','봉황','주작','청룡','백호','귀모') AND country='china'",
    "UPDATE monsters SET ai_type='coward' WHERE name IN ('아귀','영령','원귀','조사귀','무두귀','망량','희희') AND country='china'",
    "UPDATE monsters SET ai_type='ranged' WHERE name IN ('녀귀','수귀','흑백무상','제강','강시') AND country='china'",
    // 나라별 range_type 설정
    "UPDATE monsters SET range_type='magic' WHERE name IN ('구미호','삼족오','불여우','매구','처녀귀신','물귀신','원혼','저승사자','어둑시니','살귀','수귀','바리공주','영등할매','칠성신','달걀귀신','인면조','달귀','백사','몽달귀신') AND country='korea'",
    "UPDATE monsters SET range_type='magic' WHERE name IN ('킷수네','바케네코','네코마타','유키온나','한냐','조로구모','오이와','시니가미','카샤','와뉴도','누레온나','오키쿠','후나유레이','우미보즈','후타쿠치온나','햐쿠메','코다마','카와히메','유레이') AND country='japan'",
    "UPDATE monsters SET range_type='magic' WHERE name IN ('호리정','백사','등사','달기','거미정','비파정','여귀','백골정','사요','발','이매','비렴','녀귀','수귀','흑백무상','제강','맹파','기린','영초','제강') AND country='china'",
    "UPDATE monsters SET range_type='melee' WHERE name IN ('해태','불가사리','이무기','천리마','불개','삼족구','도깨비','참도깨비','귀수도깨비','두억시니','장산범','꽝철이','장자못의 뱀','각시도깨비','용','봉황','백호','청룡','주작','현무','강림도령','용왕','염라대왕','산신','천하대장군','장승','목신') AND country='korea'",
    "UPDATE monsters SET range_type='melee' WHERE name IN ('아카오니','아오오니','텐구','카라스텐구','누에','나마하게','히히','츠치구모','야샤','야마타노오로치','슈텐도지','이바라키도지','가샤도쿠로','류진','세이류','스자쿠','뱌코','겐부','누라리횬') AND country='japan'",
    "UPDATE monsters SET range_type='melee' WHERE name IN ('도철','녠수','호요','랑요','상류','우두마면','귀거','팽후','필방','비유','혼돈','궁기','도올','축음','봉황','주작','청룡','백호','현무','귀모') AND country='china'",
    // 마법형으로 변경된 몬스터 MP 보정 (마법형은 스킬 위주이므로 MP 상향)
    "UPDATE monsters SET mp=GREATEST(mp, 35) WHERE range_type='magic' AND tier <= 3",
    "UPDATE monsters SET mp=GREATEST(mp, 50) WHERE range_type='magic' AND tier BETWEEN 4 AND 5",
    "UPDATE monsters SET mp=GREATEST(mp, 70) WHERE range_type='magic' AND tier >= 6 AND ai_type != 'boss'",
    // (밸런스 패치는 아래에서 플래그 기반으로 1회만 적용)
  ];
  for (const sql of aiTypeUpdates) {
    await pool.query(sql).catch(() => {});
  }

  // ========== 몬스터 밸런스 패치 v3 (1회만 실행) ==========
  // 플래그 테이블로 중복 적용 방지
  await pool.query(`CREATE TABLE IF NOT EXISTS db_flags (flag_name VARCHAR(50) PRIMARY KEY, applied_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP)`).catch(() => {});
  const [balFlags] = await pool.query("SELECT * FROM db_flags WHERE flag_name = 'monster_balance_v4'");
  if (balFlags.length === 0) {
    // 이전 패치 제거 후 재적용
    await pool.query("DELETE FROM db_flags WHERE flag_name LIKE 'monster_balance%'").catch(() => {});
    console.log('Applying monster balance patch v4...');
    // 캐릭터 기준: Lv15 HP372, atk79, patk59, pdef52, mdef38, def72
    // SRPG공식: dmg = base * (100/(100+def*1.2))
    // Card공식: dmg = (patk + atk*0.5) - (pdef + def*0.3)*0.75
    // 캐릭→T2 Card: baseDmg = 59+79*0.5=98.5, 목표 totalDef=~40 → dmg=68 → HP 300이면 5대
    // T2몬→캐릭 Card: 목표 baseDmg=~100 → totalDef=52+72*0.3=73.6 → dmg=100-55=45 → 8대
    const balanceQueries = [
      // HP: T1=130~200, T2=200~300, T3=280~400
      "UPDATE monsters SET hp = FLOOR(hp * 3.5 + tier * 30)",
      // attack: 카드배틀 baseDmg에 *0.5 기여
      "UPDATE monsters SET attack = FLOOR(attack * 3 + tier * 6)",
      // defense: 카드배틀 totalDef에 *0.3 기여
      "UPDATE monsters SET defense = FLOOR(defense * 2.5 + tier * 4)",
      // phys_attack: 목표 T1=38, T2=48, T3=58
      "UPDATE monsters SET phys_attack = tier * 12 + 25 + FLOOR(attack * 0.05) WHERE range_type IN ('melee','ranged')",
      "UPDATE monsters SET phys_attack = tier * 7 + 15 + FLOOR(attack * 0.03) WHERE range_type = 'magic'",
      // mag_attack
      "UPDATE monsters SET mag_attack = tier * 12 + 25 + FLOOR(attack * 0.05) WHERE range_type = 'magic'",
      "UPDATE monsters SET mag_attack = tier * 7 + 15 + FLOOR(attack * 0.03) WHERE range_type IN ('melee','ranged')",
      // phys_defense: 목표 T1=16, T2=21, T3=26
      "UPDATE monsters SET phys_defense = tier * 5 + 10 + FLOOR(defense * 0.06)",
      // mag_defense
      "UPDATE monsters SET mag_defense = tier * 4 + 8 + FLOOR(defense * 0.05)",
      // crit/evasion/mp
      "UPDATE monsters SET crit_rate = GREATEST(crit_rate, tier * 2 + 3)",
      "UPDATE monsters SET evasion = GREATEST(evasion, tier + 2)",
      "UPDATE monsters SET mp = GREATEST(mp, tier * 10 + 25)",
    ];
    for (const sql of balanceQueries) {
      await pool.query(sql).catch(e => console.error('Balance query failed:', sql, e.message));
    }
    await pool.query("INSERT INTO db_flags (flag_name) VALUES ('monster_balance_v4')").catch(() => {});
    console.log('Monster balance patch v4 applied');
  }

  // 몬스터-스킬 연결 (INSERT IGNORE로 중복 안전)
  const [allMonsters] = await pool.query('SELECT id, name, ai_type FROM monsters');
  const [allMSkills] = await pool.query('SELECT id, name FROM monster_skills');
  // 이름이 같은 몬스터가 여러 개일 수 있으므로 배열로 저장
  const mMap = {}; for (const m of allMonsters) { if (!mMap[m.name]) mMap[m.name] = []; mMap[m.name].push(m.id); }
  const sMap = {}; for (const s of allMSkills) sMap[s.name] = s.id;

  const skillAssignments = [
    [['동굴 박쥐'], ['물기','할퀴기']],
    [['골렘'], ['지진','방어 태세']],
    [['지하 도마뱀'], ['물기','독 공격']],
    [['원혼'], ['암흑 구체','생명력 흡수']],
    [['저주받은 승려'], ['저주','암흑 구체','치유']],
    [['어둠의 수호자'], ['암흑 구체','번개 강타','대치유','포효']],
    [['거대 지네'], ['물기','독 공격']],
    [['독나방'], ['독안개','독 공격']],
    [['장수풍뎅이'], ['돌진','방어 태세']],
    [['들쥐','산토끼'], ['물기']],
    [['야생 늑대','흑곰','설표','회색 곰','삼두견'], ['물기','할퀴기','포효']],
    [['멧돼지'], ['돌진']],
    [['백호'], ['할퀴기','포효','돌진']],
    [['천년 여우'], ['암흑 구체','할퀴기']],
    [['독거미','독사','전갈','구렁이'], ['독 공격','물기']],
    [['킬러비','사마귀 전사'], ['독 공격','할퀴기']],
    [['여왕 개미'], ['치유','독안개','포효']],
    [['독 거미 여왕'], ['독안개','독 공격','치유']],
    [['스켈레톤','좀비','구울'], ['물기','할퀴기']],
    [['레이스','검은 그림자'], ['암흑 구체','생명력 흡수']],
    [['뱀파이어'], ['생명력 흡수','암흑 구체','할퀴기']],
    [['데스나이트'], ['돌진','할퀴기','포효']],
    [['리치왕'], ['암흑 구체','번개 강타','저주','대치유']],
    [['미라'], ['저주','독안개']],
    [['해골 궁수'], ['마법 화살']],
    [['떠도는 영혼','봉사귀'], ['암흑 구체']],
    [['처녀귀신'], ['저주','치유','암흑 구체']],
    [['야차'], ['할퀴기','포효','돌진']],
    [['물귀신'], ['생명력 흡수','저주']],
    [['이무기'], ['화염 토','꼬리 휘두르기','돌진','포효']],
    [['달귀'], ['암흑 구체','저주']],
    [['물의 정령'], ['치유','얼음 숨결']],
    [['불의 정령'], ['화염 토','독안개']],
    [['바람의 정령'], ['마법 화살','돌진']],
    [['대지의 정령'], ['지진','방어 태세']],
    [['번개 정령'], ['번개 강타','마법 화살']],
    [['얼음 정령'], ['얼음 숨결','방어 태세']],
    [['빛의 정령'], ['번개 강타','대치유']],
    [['어둠의 정령'], ['암흑 구체','생명력 흡수']],
    [['정령왕'], ['번개 강타','지진','대치유','포효']],
    [['임프'], ['화염 토']],
    [['서큐버스'], ['저주','생명력 흡수','암흑 구체']],
    [['인큐버스'], ['저주','암흑 구체','할퀴기']],
    [['지옥견'], ['화염 토','물기','돌진']],
    [['발록'], ['화염 토','지진','포효','꼬리 휘두르기']],
    [['마왕의 부하'], ['암흑 구체','돌진','포효']],
    [['타락 천사'], ['번개 강타','대치유','저주']],
    [['마왕'], ['암흑 구체','번개 강타','지진','대치유','저주','포효']],
    [['가고일'], ['할퀴기','방어 태세']],
    [['다크 세라핌'], ['번개 강타','암흑 구체','대치유','저주','포효']],
    [['드래곤 해츨링'], ['화염 토','물기']],
    [['와이번'], ['할퀴기','돌진']],
    [['화룡'], ['화염 토','꼬리 휘두르기','포효','지진']],
    [['빙룡'], ['얼음 숨결','꼬리 휘두르기','포효','방어 태세']],
    [['암흑룡'], ['암흑 구체','화염 토','꼬리 휘두르기','저주','포효']],
    [['용왕'], ['화염 토','얼음 숨결','번개 강타','꼬리 휘두르기','대치유','포효']],
    [['드레이크'], ['화염 토','돌진']],
    [['히드라'], ['독 공격','물기','꼬리 휘두르기','치유']],
    [['뇌룡'], ['번개 강타','화염 토','꼬리 휘두르기','포효']],
    [['마법 갑옷'], ['방어 태세','돌진']],
    [['가디언'], ['방어 태세','지진','돌진']],
    [['호문쿨루스'], ['독 공격']],
    [['마나 골렘'], ['지진','방어 태세','번개 강타']],
    [['유니콘'], ['대치유','치유','돌진']],
    [['그리핀'], ['할퀴기','돌진','포효']],
    [['피닉스'], ['화염 토','대치유','포효']],
    [['미믹'], ['물기','독 공격']],
    [['독버섯'], ['독안개']],
    [['덩굴괴물'], ['독 공격','할퀴기']],
    [['트렌트'], ['지진','방어 태세']],
    [['식인화'], ['물기','독 공격']],
    [['포자 군체'], ['독안개']],
    [['만드레이크'], ['저주','독안개']],
    [['세계수의 파편'], ['지진','대치유','방어 태세','포효']],
    [['균류 군주'], ['독안개','치유','저주','포효']],
    [['산적'], ['돌진']],
    [['암살자'], ['할퀴기','독 공격']],
    [['흑마법사'], ['암흑 구체','저주','마법 화살']],
    [['타락 기사'], ['돌진','포효','할퀴기']],
    [['광전사'], ['포효','돌진','할퀴기']],
    [['네크로맨서'], ['암흑 구체','저주','치유']],
    [['대마법사'], ['번개 강타','암흑 구체','저주','마법 화살']],
    [['도적 두목'], ['돌진','할퀴기','포효']],
    [['꼬마 도깨비'], ['할퀴기']],
    [['불 도깨비'], ['화염 토','돌진']],
    [['돌 도깨비'], ['지진','방어 태세']],
    [['도깨비 장군'], ['돌진','포효','할퀴기']],
    [['깨비대왕'], ['지진','포효','돌진','화염 토','대치유']],
    [['연못 도깨비'], ['치유','얼음 숨결']],
    [['도깨비 방망이'], ['돌진','할퀴기']],
    [['숲 도깨비'], ['할퀴기']],
    [['구미호'], ['암흑 구체','생명력 흡수','저주','할퀴기']],
    [['해태'], ['화염 토','돌진','포효','방어 태세']],
    [['불가사리'], ['지진','방어 태세','돌진']],
    [['키메라'], ['화염 토','독 공격','할퀴기','꼬리 휘두르기']],
    [['미노타우르스'], ['돌진','포효','할퀴기']],
    [['메두사'], ['저주','암흑 구체','독 공격']],
    [['거인'], ['지진','돌진','포효']],
    [['늑대인간'], ['할퀴기','물기','포효']],
    [['초록 슬라임','파랑 슬라임'], ['물기']],
    [['빨강 슬라임'], ['화염 토']],
    [['독 슬라임'], ['독 공격','독안개']],
    [['금속 슬라임'], ['방어 태세']],
    [['킹 슬라임'], ['지진','돌진','포효','치유']],
    [['점액 군주'], ['독안개','지진','생명력 흡수','포효']],
    [['용암 슬라임'], ['화염 토','돌진']],
    [['크리스탈 슬라임'], ['방어 태세']],
    [['포식 슬라임'], ['생명력 흡수','돌진','포효']],
    [['젤리피쉬'], ['독 공격']],
    [['대왕 게'], ['할퀴기','방어 태세']],
    [['상어'], ['물기','돌진']],
    [['대왕 문어'], ['할퀴기','독 공격']],
    [['인어 전사'], ['치유','마법 화살']],
    [['심해어'], ['물기','암흑 구체']],
    [['크라켄'], ['꼬리 휘두르기','지진','생명력 흡수','포효']],
    [['해마 기사'], ['치유','돌진']],
    [['바다 용'], ['얼음 숨결','꼬리 휘두르기','지진','포효']],
    // ===== 한국 몬스터 스킬 =====
    [['해태'], ['화염 토','돌진','포효','방어 태세']],
    [['불가사리'], ['지진','방어 태세','돌진','포효']],
    [['용'], ['화염 토','얼음 숨결','번개 강타','꼬리 휘두르기','포효']],
    [['천리마'], ['돌진','할퀴기','포효']],
    [['봉황'], ['화염 토','대치유','포효','번개 강타']],
    [['삼족오'], ['화염 토','마법 화살']],
    [['불개'], ['화염 토','물기','돌진']],
    [['삼족구'], ['물기','할퀴기']],
    [['몽달귀신'], ['저주','암흑 구체']],
    [['달걀귀신'], ['저주','암흑 구체','생명력 흡수']],
    [['저승사자'], ['암흑 구체','생명력 흡수','저주','돌진']],
    [['야광귀'], ['저주']],
    [['강림도령'], ['번개 강타','돌진','포효','암흑 구체','대치유']],
    [['참도깨비'], ['할퀴기','돌진']],
    [['각시도깨비'], ['저주','할퀴기']],
    [['귀수도깨비'], ['암흑 구체','할퀴기','포효']],
    [['산신'], ['대치유','방어 태세','지진']],
    [['칠성신'], ['치유','번개 강타','방어 태세']],
    [['목신'], ['치유','방어 태세']],
    [['영등할매'], ['얼음 숨결','치유','마법 화살']],
    [['인면조'], ['마법 화살','저주']],
    [['현무'], ['방어 태세','얼음 숨결','지진','대치유']],
    [['청룡'], ['번개 강타','화염 토','꼬리 휘두르기','포효','대치유']],
    [['주작'], ['화염 토','번개 강타','포효','마법 화살']],
    [['기린'], ['대치유','치유','번개 강타']],
    [['불여우'], ['화염 토','할퀴기']],
    [['어둑시니'], ['암흑 구체','생명력 흡수']],
    [['두억시니'], ['돌진','포효','할퀴기','지진']],
    [['장산범'], ['할퀴기','돌진','저주']],
    [['꽝철이'], ['독 공격','꼬리 휘두르기','물기']],
    [['장승'], ['방어 태세']],
    [['백사'], ['독 공격','할퀴기','저주']],
    [['매구'], ['저주','암흑 구체','생명력 흡수']],
    [['살귀'], ['독안개','저주','암흑 구체']],
    [['수귀'], ['생명력 흡수','저주']],
    [['바리공주'], ['대치유','치유','번개 강타','방어 태세']],
    [['황금 사슴'], ['돌진']],
    [['장자마리'], ['물기']],
    [['염라대왕'], ['암흑 구체','번개 강타','저주','지진','대치유','포효']],
    [['천하대장군'], ['돌진','방어 태세','포효']],
    [['백 사슴'], ['돌진']],
    [['장자못의 뱀'], ['독 공격','꼬리 휘두르기','돌진','포효']],
    [['달귀'], ['암흑 구체','저주']],
    // ===== 일본 몬스터 스킬 =====
    [['킷수네'], ['암흑 구체','생명력 흡수','저주','화염 토']],
    [['타누키'], ['저주']],
    [['바케네코'], ['암흑 구체','할퀴기','저주']],
    [['네코마타'], ['암흑 구체','할퀴기','화염 토']],
    [['갓파'], ['물기','생명력 흡수']],
    [['야마타노오로치'], ['독 공격','화염 토','꼬리 휘두르기','지진','포효','생명력 흡수']],
    [['츠치구모'], ['독 공격','물기','독안개']],
    [['조로구모'], ['독 공격','저주','생명력 흡수','암흑 구체']],
    [['누레온나'], ['저주','생명력 흡수','물기']],
    [['누에'], ['할퀴기','독 공격','돌진','포효']],
    [['아카오니'], ['돌진','할퀴기','포효']],
    [['아오오니'], ['돌진','방어 태세','할퀴기']],
    [['슈텐도지'], ['돌진','할퀴기','포효','화염 토','대치유']],
    [['이바라키도지'], ['할퀴기','돌진','포효','화염 토']],
    [['한냐'], ['화염 토','저주','암흑 구체','생명력 흡수']],
    [['아마노자쿠'], ['저주','할퀴기']],
    [['야샤'], ['돌진','할퀴기','포효']],
    [['가키'], ['물기','생명력 흡수']],
    [['텐구'], ['돌진','할퀴기','마법 화살','포효']],
    [['카라스텐구'], ['할퀴기','돌진','마법 화살']],
    [['코다마'], ['치유']],
    [['자시키와라시'], ['치유']],
    [['유키온나'], ['얼음 숨결','저주','생명력 흡수']],
    [['야마우바'], ['독 공격','저주','생명력 흡수']],
    [['카와히메'], ['치유','얼음 숨결']],
    [['츠쿠모가미'], ['방어 태세']],
    [['카마이타치'], ['할퀴기','돌진']],
    [['우미보즈'], ['지진','생명력 흡수','저주','포효']],
    [['유레이'], ['저주','암흑 구체']],
    [['오이와'], ['저주','암흑 구체','독안개','생명력 흡수']],
    [['오키쿠'], ['저주','암흑 구체']],
    [['후나유레이'], ['저주','생명력 흡수']],
    [['가샤도쿠로'], ['지진','할퀴기','포효','돌진','생명력 흡수']],
    [['시니가미'], ['암흑 구체','저주','생명력 흡수','마법 화살']],
    [['류진'], ['얼음 숨결','번개 강타','꼬리 휘두르기','대치유','포효']],
    [['세이류'], ['번개 강타','화염 토','꼬리 휘두르기','포효','대치유']],
    [['스자쿠'], ['화염 토','번개 강타','포효','마법 화살']],
    [['뱌코'], ['할퀴기','돌진','포효','번개 강타']],
    [['겐부'], ['방어 태세','얼음 숨결','지진','대치유']],
    [['누라리횬'], ['암흑 구체','저주','포효','생명력 흡수','번개 강타']],
    [['잇탄모멘'], ['할퀴기']],
    [['로쿠로쿠비'], ['물기','저주']],
    [['후타쿠치온나'], ['물기','저주','생명력 흡수']],
    [['나마하게'], ['돌진','할퀴기','포효']],
    [['카샤'], ['화염 토','할퀴기','암흑 구체']],
    [['햐쿠메'], ['저주','암흑 구체']],
    [['와뉴도'], ['화염 토','돌진','암흑 구체']],
    [['히히'], ['할퀴기','돌진','포효']],
    [['이츠마덴'], ['화염 토','할퀴기','마법 화살']],
    [['우부메'], ['저주']],
    // ===== 중국 몬스터 스킬 =====
    [['도철'], ['물기','돌진','포효','생명력 흡수']],
    [['혼돈'], ['지진','암흑 구체','포효','저주','대치유']],
    [['궁기'], ['할퀴기','돌진','포효','화염 토','번개 강타']],
    [['도올'], ['할퀴기','꼬리 휘두르기','포효','독 공격']],
    [['녠수'], ['돌진','할퀴기','포효']],
    [['비휴'], ['방어 태세','돌진','포효']],
    [['백택'], ['대치유','방어 태세','번개 강타','치유']],
    [['상류'], ['독 공격','물기','꼬리 휘두르기','독안개','포효']],
    [['축음'], ['암흑 구체','번개 강타','지진','포효','대치유']],
    [['호리정'], ['암흑 구체','생명력 흡수','저주','할퀴기']],
    [['달기'], ['저주','암흑 구체','생명력 흡수','화염 토','포효']],
    [['호요'], ['할퀴기','돌진','포효','물기']],
    [['랑요'], ['돌진','할퀴기','포효']],
    [['거미정'], ['독 공격','저주','생명력 흡수','암흑 구체']],
    [['사요'], ['독 공격','독안개','저주']],
    [['비파정'], ['저주','암흑 구체','생명력 흡수']],
    [['강시'], ['물기','돌진']],
    [['여귀'], ['저주','암흑 구체','생명력 흡수','독안개']],
    [['아귀'], ['물기','생명력 흡수']],
    [['녀귀'], ['저주','암흑 구체']],
    [['무두귀'], ['돌진','할퀴기']],
    [['조사귀'], ['저주','생명력 흡수']],
    [['백골정'], ['암흑 구체','저주','할퀴기','생명력 흡수']],
    [['등사'], ['마법 화살','돌진']],
    [['섬서'], ['방어 태세','얼음 숨결']],
    [['도깨비'], ['할퀴기','돌진']],
    [['원귀'], ['저주']],
    [['영령'], ['저주']],
    [['필방'], ['화염 토','마법 화살']],
    [['비유'], ['독 공격','할퀴기']],
    [['희희'], ['얼음 숨결']],
    [['제강'], ['포효','돌진','지진']],
    [['비렴'], ['마법 화살','돌진','포효']],
    [['영초'], ['치유','돌진','마법 화살']],
    [['우두마면'], ['돌진','할퀴기','포효','지진']],
    [['흑백무상'], ['저주','암흑 구체','생명력 흡수']],
    [['맹파'], ['저주','치유']],
    [['귀거'], ['할퀴기','독안개','마법 화살']],
    [['팽후'], ['물기','할퀴기']],
    [['망량'], ['저주','독 공격']],
    [['귀모'], ['암흑 구체','저주','생명력 흡수','포효','대치유']],
    [['발'], ['화염 토','독안개','저주']],
    [['이매'], ['저주','암흑 구체','독안개']],
  ];

  for (const [monsterNames, skillNames] of skillAssignments) {
    for (const mName of monsterNames) {
      if (!mMap[mName]) continue;
      for (const mId of mMap[mName]) {
        for (const sName of skillNames) {
          if (!sMap[sName]) continue;
          await pool.query(
            'INSERT IGNORE INTO monster_skill_map (monster_id, skill_id) VALUES (?, ?)',
            [mId, sMap[sName]]
          ).catch(() => {});
        }
      }
    }
  }

  // ========== 히스토리 스테이지 시스템 ==========
  await pool.query(`
    CREATE TABLE IF NOT EXISTS stage_countries (
      id INT AUTO_INCREMENT PRIMARY KEY,
      key_name VARCHAR(20) NOT NULL UNIQUE,
      name VARCHAR(50) NOT NULL,
      subtitle VARCHAR(100),
      icon VARCHAR(10) DEFAULT '🏔️',
      display_order INT DEFAULT 0,
      accent_color VARCHAR(20) DEFAULT '#d4a843'
    )
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS stage_groups (
      id INT AUTO_INCREMENT PRIMARY KEY,
      key_name VARCHAR(50) NOT NULL UNIQUE,
      name VARCHAR(100) NOT NULL,
      description VARCHAR(300),
      icon VARCHAR(10) DEFAULT '🗺️',
      era VARCHAR(50),
      required_level INT DEFAULT 1,
      display_order INT DEFAULT 0,
      bg_color VARCHAR(20) DEFAULT '#1a1a2e',
      country VARCHAR(20) DEFAULT 'korea',
      accent_color VARCHAR(20) DEFAULT '#4ade80'
    )
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS stage_levels (
      id INT AUTO_INCREMENT PRIMARY KEY,
      group_id INT NOT NULL,
      stage_number INT NOT NULL,
      name VARCHAR(100) NOT NULL,
      description VARCHAR(300),
      is_boss TINYINT(1) DEFAULT 0,
      monster_count INT DEFAULT 3,
      monster_level_min INT DEFAULT 1,
      monster_level_max INT DEFAULT 3,
      reward_exp INT DEFAULT 100,
      reward_gold INT DEFAULT 50,
      dungeon_key VARCHAR(50),
      map_width INT DEFAULT 10,
      map_height INT DEFAULT 10,
      base_tile_type VARCHAR(20) DEFAULT 'grass',
      tile_overrides JSON,
      player_spawns JSON,
      monster_spawns JSON,
      FOREIGN KEY (group_id) REFERENCES stage_groups(id) ON DELETE CASCADE,
      UNIQUE KEY unique_group_stage (group_id, stage_number)
    )
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS character_stage_clear (
      id INT AUTO_INCREMENT PRIMARY KEY,
      character_id INT NOT NULL,
      group_id INT NOT NULL,
      stage_number INT NOT NULL DEFAULT 0,
      stars INT DEFAULT 0,
      cleared_at TIMESTAMP NULL,
      FOREIGN KEY (character_id) REFERENCES characters(id) ON DELETE CASCADE,
      FOREIGN KEY (group_id) REFERENCES stage_groups(id) ON DELETE CASCADE,
      UNIQUE KEY unique_char_group (character_id, group_id)
    )
  `);

  // ========== 진영(Formation) 테이블 ==========
  await pool.query(`
    CREATE TABLE IF NOT EXISTS character_formations (
      id INT AUTO_INCREMENT PRIMARY KEY,
      character_id INT NOT NULL,
      slot_index INT NOT NULL DEFAULT 0,
      name VARCHAR(50) NOT NULL DEFAULT '메인 진영',
      grid_data JSON NOT NULL,
      is_default TINYINT DEFAULT 0,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      FOREIGN KEY (character_id) REFERENCES characters(id) ON DELETE CASCADE,
      UNIQUE KEY unique_char_slot (character_id, slot_index)
    )
  `);

  // 맵 타일 오버라이드 자동 생성 (스테이지 시드에서 사용)
  function generateMapOverrides(w, h, base, stageNum, isBoss) {
    const overrides = [];
    const rng = (seed) => { let s = seed; return () => { s = (s * 16807 + 11) % 2147483647; return s / 2147483647; }; };
    const rand = rng(stageNum * 137 + w * 31 + h * 17);
    const types = ['grass','stone','dirt','water','dark'];
    const obstacleCount = Math.floor(3 + rand() * (isBoss ? 6 : 4));
    for (let i = 0; i < obstacleCount; i++) {
      const cx = Math.floor(rand() * (w - 2)) + 1;
      const cz = Math.floor(rand() * (h - 2)) + 1;
      const size = Math.floor(rand() * 3) + 1;
      const height = Math.floor(rand() * 3) + 1;
      const type = types[Math.floor(rand() * types.length)];
      const coords = [];
      for (let dx = 0; dx < size && cx + dx < w; dx++) for (let dz = 0; dz < size && cz + dz < h; dz++) coords.push([cx + dx, cz + dz]);
      if (coords.length > 0) overrides.push({ coords, height, type });
    }
    if (isBoss) { const cx = Math.floor(w/2); const cz = Math.floor(h/2); overrides.push({ coords: [[cx,cz],[cx-1,cz],[cx,cz-1],[cx-1,cz-1]], height: 3, type: 'stone' }); }
    return overrides;
  }
  function generateSpawns(w, h, side, count) {
    const spawns = [];
    if (side === 'player') { for (let i = 0; i < count; i++) spawns.push({ x: i % 2, z: Math.floor(i / 2) }); }
    else { for (let i = 0; i < count; i++) spawns.push({ x: w - 1 - (i % 2), z: h - 1 - Math.floor(i / 2) }); }
    return spawns;
  }

  // 마이그레이션: country, accent_color 컬럼 추가
  await pool.query("ALTER TABLE stage_groups ADD COLUMN country VARCHAR(20) DEFAULT 'korea'").catch(() => {});
  await pool.query("ALTER TABLE stage_groups ADD COLUMN accent_color VARCHAR(20) DEFAULT '#4ade80'").catch(() => {});

  // accent_color 마이그레이션 (기본값인 경우만 업데이트)
  const accentMap = {
    gojoseon:'#4ade80',samhan:'#60a5fa',goguryeo:'#f87171',baekje:'#fbbf24',silla:'#c084fc',
    balhae:'#2dd4bf',goryeo:'#818cf8',joseon:'#fb923c',imjin:'#fb7185',modern:'#38bdf8',
    jomon:'#8b9dc3',yayoi:'#6bcb77',yamato:'#e8a87c',nara:'#d4a5a5',heian:'#c9b1ff',
    kamakura:'#ff6b6b',muromachi:'#48c9b0',sengoku:'#ff4757',edo:'#ffa502',meiji:'#70a1ff',
    xia_shang:'#d4a574',zhou:'#7ec8e3',qin:'#c0392b',han:'#e74c3c',three_kingdoms:'#f39c12',
    tang:'#e67e22',song:'#1abc9c',yuan:'#2c3e50',ming:'#e84393',qing:'#6c5ce7',
  };
  for (const [key, color] of Object.entries(accentMap)) {
    await pool.query("UPDATE stage_groups SET accent_color = ? WHERE key_name = ? AND accent_color = '#4ade80' AND key_name != 'gojoseon'", [color, key]);
  }

  // 국가 시드
  const [existCountries] = await pool.query('SELECT COUNT(*) as cnt FROM stage_countries');
  if (existCountries[0].cnt === 0) {
    const countries = [
      ['korea', '한국 스테이지', '한국 역사 속 전장을 누비며 강해지자', '🏔️', 1, '#d4a843'],
      ['japan', '일본 스테이지', '일본 열도의 역사를 관통하는 전장', '⛩️', 2, '#e84393'],
      ['china', '중국 스테이지', '대륙의 영웅호걸과 맞서 싸워라', '🐉', 3, '#e74c3c'],
    ];
    for (const [key, name, subtitle, icon, order, accent] of countries) {
      await pool.query(
        'INSERT IGNORE INTO stage_countries (key_name, name, subtitle, icon, display_order, accent_color) VALUES (?,?,?,?,?,?)',
        [key, name, subtitle, icon, order, accent]
      );
    }
  }

  // 히스토리 스테이지 그룹 시드
  const [existGroups] = await pool.query('SELECT COUNT(*) as cnt FROM stage_groups');
  if (existGroups[0].cnt === 0) {
    // [key, name, desc, icon, era, lvl, order, bg, country, accent]
    const groups = [
      // 한국 스테이지 (display_order 1~10)
      ['gojoseon',   '고조선',     '단군의 개국신화가 깃든 태초의 땅',                '🏔️', '고조선 (BC 2333)', 1,  1, '#2d1b0e', 'korea', '#4ade80'],
      ['samhan',     '삼한',       '마한, 변한, 진한 세 부족의 전장',                '⚔️', '삼한시대',         3,  2, '#1a2e1a', 'korea', '#60a5fa'],
      ['goguryeo',   '고구려',     '북방의 기마민족, 광개토대왕의 영토',              '🐎', '삼국시대',         5,  3, '#2e1a1a', 'korea', '#f87171'],
      ['baekje',     '백제',       '한강 유역의 문화 강국',                          '🌸', '삼국시대',         7,  4, '#1a1a2e', 'korea', '#fbbf24'],
      ['silla',      '신라',       '화랑도의 정신으로 삼국을 통일',                   '👑', '삼국시대',         9,  5, '#2e2e1a', 'korea', '#c084fc'],
      ['balhae',     '발해',       '해동성국, 고구려를 계승한 대제국',               '🦁', '남북국시대',       11, 6, '#1a2e2e', 'korea', '#2dd4bf'],
      ['goryeo',     '고려',       '불교 문화가 꽃피운 고려 왕조',                   '📿', '고려시대',         13, 7, '#2e1a2e', 'korea', '#818cf8'],
      ['joseon',     '조선',       '유교의 이상향, 오백년 조선 왕조',                '📜', '조선시대',         16, 8, '#0e1a2e', 'korea', '#fb923c'],
      ['imjin',      '임진왜란',   '이순신 장군과 의병들의 구국 전쟁',               '🛡️', '조선시대',         19, 9, '#2e0e0e', 'korea', '#fb7185'],
      ['modern',     '근대',       '격변의 시대, 새로운 힘이 깨어난다',              '🔥', '근대',             22, 10, '#1a0e2e', 'korea', '#38bdf8'],
      // 일본 스테이지 (display_order 11~20)
      ['jomon',      '조몬',       '토기 문화의 여명, 고대 일본의 시작',              '🏺', '조몬시대 (BC 14000)', 1,  11, '#1a1e2e', 'japan', '#8b9dc3'],
      ['yayoi',      '야요이',     '벼농사와 철기가 전래된 새 시대',                  '🌾', '야요이시대',         3,  12, '#1e2e1a', 'japan', '#6bcb77'],
      ['yamato',     '야마토',     '일본 통일 왕조의 탄생',                          '⛩️', '야마토시대',         5,  13, '#2e1e1a', 'japan', '#e8a87c'],
      ['nara',       '나라',       '불교와 율령 국가의 전성기',                      '🏛️', '나라시대',           7,  14, '#2e1a1e', 'japan', '#d4a5a5'],
      ['heian',      '헤이안',     '귀족 문화가 꽃핀 우아한 시대',                   '🌸', '헤이안시대',         9,  15, '#1e1a2e', 'japan', '#c9b1ff'],
      ['kamakura',   '가마쿠라',   '무사 정권의 시작, 사무라이의 시대',               '⚔️', '가마쿠라시대',       11, 16, '#2e0e0e', 'japan', '#ff6b6b'],
      ['muromachi',  '무로마치',   '남북조의 혼란과 무사 문화',                      '🏯', '무로마치시대',       13, 17, '#0e2e1e', 'japan', '#48c9b0'],
      ['sengoku',    '전국시대',   '천하통일을 향한 영웅들의 전쟁',                   '🔥', '전국시대',           16, 18, '#2e0e1a', 'japan', '#ff4757'],
      ['edo',        '에도',       '도쿠가와 막부의 태평성대',                       '🎎', '에도시대',           19, 19, '#1e1a0e', 'japan', '#ffa502'],
      ['meiji',      '메이지',     '개혁과 근대화의 격변기',                         '⚡', '메이지시대',         22, 20, '#0e1a2e', 'japan', '#70a1ff'],
      // 중국 스테이지 (display_order 21~30)
      ['xia_shang',  '하·상',      '중화 문명의 여명, 청동기의 시대',                '🐉', '하·상 (BC 2070)',    1,  21, '#2e1e0e', 'china', '#d4a574'],
      ['zhou',       '주',         '봉건제와 제자백가의 시대',                       '📜', '주나라',             3,  22, '#0e1e2e', 'china', '#7ec8e3'],
      ['qin',        '진',         '시황제의 천하통일 제국',                         '🏰', '진나라',             5,  23, '#2e0e0e', 'china', '#c0392b'],
      ['han',        '한',         '유방의 대한제국 400년',                          '🐎', '한나라',             7,  24, '#2e1a0e', 'china', '#e74c3c'],
      ['three_kingdoms','삼국',    '위·촉·오 영웅들의 시대',                         '⚔️', '삼국시대',           9,  25, '#1e2e0e', 'china', '#f39c12'],
      ['tang',       '당',         '세계 최대 제국, 찬란한 문화',                    '👑', '당나라',             11, 26, '#2e1e1e', 'china', '#e67e22'],
      ['song',       '송',         '문치주의와 과학 기술의 황금기',                   '🧭', '송나라',             13, 27, '#0e2e2e', 'china', '#1abc9c'],
      ['yuan',       '원',         '몽골 대제국의 중원 정복',                        '🏹', '원나라',             16, 28, '#1a0e2e', 'china', '#2c3e50'],
      ['ming',       '명',         '한족의 부흥, 정화의 대항해',                     '⛵', '명나라',             19, 29, '#2e0e1e', 'china', '#e84393'],
      ['qing',       '청',         '만주족의 마지막 왕조',                           '🐲', '청나라',             22, 30, '#1e0e2e', 'china', '#6c5ce7'],
    ];

    for (const [key, name, desc, icon, era, lvl, order, bg, country, accent] of groups) {
      await pool.query(
        'INSERT IGNORE INTO stage_groups (key_name, name, description, icon, era, required_level, display_order, bg_color, country, accent_color) VALUES (?,?,?,?,?,?,?,?,?,?)',
        [key, name, desc, icon, era, lvl, order, bg, country, accent]
      );
    }

    // 스테이지 레벨 시드
    const [gRows] = await pool.query('SELECT id, key_name FROM stage_groups ORDER BY display_order');
    const gMap = {};
    for (const g of gRows) gMap[g.key_name] = g.id;

    // 던전 키 매핑 (나라별 전용 던전)
    const groupDungeonMap = {
      // 한국
      'gojoseon':  'kr_forest',
      'samhan':    'kr_forest',
      'goguryeo':  'kr_mountain',
      'baekje':    'kr_swamp',
      'silla':     'kr_temple',
      'balhae':    'kr_mountain',
      'goryeo':    'kr_spirit',
      'joseon':    'kr_temple',
      'imjin':     'kr_spirit',
      'modern':    'kr_spirit',
      // 일본
      'jomon':     'jp_forest',
      'yayoi':     'jp_forest',
      'yamato':    'jp_mountain',
      'nara':      'jp_temple',
      'heian':     'jp_spirit',
      'kamakura':  'jp_mountain',
      'muromachi': 'jp_ocean',
      'sengoku':   'jp_mountain',
      'edo':       'jp_spirit',
      'meiji':     'jp_spirit',
      // 중국
      'xia_shang':       'cn_forest',
      'zhou':            'cn_mountain',
      'qin':             'cn_mountain',
      'han':             'cn_forest',
      'three_kingdoms':  'cn_swamp',
      'tang':            'cn_temple',
      'song':            'cn_spirit',
      'yuan':            'cn_temple',
      'ming':            'cn_spirit',
      'qing':            'cn_spirit',
    };

    const stageData = {
      'gojoseon': [
        { n:1,  name:'아사달 평원',       desc:'단군이 도읍을 세운 평원',       boss:0, mc:2, lmin:1,  lmax:2,  exp:80,   gold:40,  w:8,  h:8,  base:'grass' },
        { n:2,  name:'신단수 아래',       desc:'신성한 나무 아래의 전투',       boss:0, mc:2, lmin:1,  lmax:2,  exp:90,   gold:45,  w:8,  h:8,  base:'grass' },
        { n:3,  name:'환웅의 시련',       desc:'하늘에서 내린 시련의 장',       boss:0, mc:3, lmin:1,  lmax:3,  exp:100,  gold:50,  w:9,  h:9,  base:'grass' },
        { n:4,  name:'쑥과 마늘의 동굴',   desc:'백일의 시험이 기다리는 동굴',   boss:0, mc:3, lmin:2,  lmax:3,  exp:110,  gold:55,  w:9,  h:8,  base:'stone' },
        { n:5,  name:'풍백의 언덕',       desc:'바람의 신이 머무는 언덕',       boss:0, mc:3, lmin:2,  lmax:4,  exp:120,  gold:60,  w:10, h:8,  base:'grass' },
        { n:6,  name:'우사의 늪',         desc:'비의 신이 다스리는 늪지대',     boss:0, mc:3, lmin:2,  lmax:4,  exp:130,  gold:65,  w:10, h:9,  base:'grass' },
        { n:7,  name:'운사의 산길',       desc:'구름의 신이 감춘 산길',         boss:0, mc:4, lmin:3,  lmax:5,  exp:140,  gold:70,  w:10, h:10, base:'grass' },
        { n:8,  name:'비파산 전투',       desc:'고조선의 서쪽 요새',           boss:0, mc:4, lmin:3,  lmax:5,  exp:155,  gold:75,  w:10, h:10, base:'stone' },
        { n:9,  name:'왕검성 외곽',       desc:'수도로 향하는 마지막 관문',     boss:0, mc:4, lmin:3,  lmax:5,  exp:170,  gold:80,  w:10, h:10, base:'grass' },
        { n:10, name:'단군의 시련',       desc:'고조선의 개국자가 남긴 시험',   boss:1, mc:5, lmin:4,  lmax:6,  exp:250,  gold:120, w:12, h:12, base:'grass' },
      ],
      'samhan': [
        { n:1,  name:'마한 촌락',         desc:'마한 부족의 작은 마을',         boss:0, mc:2, lmin:3,  lmax:4,  exp:100,  gold:50,  w:8,  h:8,  base:'grass' },
        { n:2,  name:'변한 대장간',       desc:'철기문화의 중심지',             boss:0, mc:3, lmin:3,  lmax:5,  exp:110,  gold:55,  w:8,  h:9,  base:'stone' },
        { n:3,  name:'진한 의례장',       desc:'부족 제사가 열리는 성지',       boss:0, mc:3, lmin:4,  lmax:5,  exp:120,  gold:60,  w:9,  h:9,  base:'grass' },
        { n:4,  name:'소도',             desc:'하늘에 제사 지내는 신성한 땅',   boss:0, mc:3, lmin:4,  lmax:6,  exp:130,  gold:65,  w:10, h:9,  base:'grass' },
        { n:5,  name:'두레 전장',         desc:'부족 연합 전쟁터',             boss:0, mc:3, lmin:4,  lmax:6,  exp:140,  gold:70,  w:10, h:10, base:'grass' },
        { n:6,  name:'철의 계곡',         desc:'변한의 철광산 깊은 곳',         boss:0, mc:4, lmin:5,  lmax:7,  exp:155,  gold:75,  w:10, h:10, base:'stone' },
        { n:7,  name:'제천 의식장',       desc:'하늘에 기원하는 의식의 장',     boss:0, mc:4, lmin:5,  lmax:7,  exp:170,  gold:80,  w:10, h:10, base:'grass' },
        { n:8,  name:'목지국 성벽',       desc:'마한 연맹의 수도 방어선',       boss:0, mc:4, lmin:5,  lmax:8,  exp:185,  gold:90,  w:10, h:10, base:'stone' },
        { n:9,  name:'구야국 항구',       desc:'해상 무역의 거점',             boss:0, mc:4, lmin:6,  lmax:8,  exp:200,  gold:95,  w:10, h:10, base:'stone' },
        { n:10, name:'삼한 왕의 결전',     desc:'세 부족의 운명을 건 전투',     boss:1, mc:5, lmin:6,  lmax:9,  exp:300,  gold:150, w:12, h:12, base:'grass' },
      ],
      'goguryeo': [
        { n:1,  name:'졸본성',           desc:'고구려의 첫 번째 수도',         boss:0, mc:3, lmin:5,  lmax:7,  exp:140,  gold:70,  w:9,  h:9,  base:'stone' },
        { n:2,  name:'국내성 외곽',       desc:'두 번째 수도의 방어 진지',     boss:0, mc:3, lmin:5,  lmax:7,  exp:150,  gold:75,  w:9,  h:9,  base:'stone' },
        { n:3,  name:'환도산성',          desc:'험준한 산성의 전투',           boss:0, mc:3, lmin:6,  lmax:8,  exp:165,  gold:80,  w:10, h:10, base:'stone' },
        { n:4,  name:'요동 벌판',         desc:'광활한 요동의 전장',           boss:0, mc:3, lmin:6,  lmax:8,  exp:175,  gold:85,  w:10, h:10, base:'grass' },
        { n:5,  name:'살수대첩',          desc:'수나라 대군을 물리친 전장',     boss:0, mc:4, lmin:7,  lmax:9,  exp:190,  gold:90,  w:10, h:10, base:'grass' },
        { n:6,  name:'안시성',           desc:'당 태종을 막아낸 철벽 요새',   boss:0, mc:4, lmin:7,  lmax:9,  exp:205,  gold:95,  w:10, h:10, base:'stone' },
        { n:7,  name:'평양성 내성',       desc:'최후의 수도 방어전',           boss:0, mc:4, lmin:7,  lmax:10, exp:220,  gold:100, w:10, h:10, base:'stone' },
        { n:8,  name:'광개토대왕릉',      desc:'대왕의 위엄이 서린 전장',      boss:0, mc:4, lmin:8,  lmax:10, exp:235,  gold:110, w:10, h:10, base:'stone' },
        { n:9,  name:'장수왕의 남진',     desc:'한강을 향한 대진격',           boss:0, mc:4, lmin:8,  lmax:11, exp:250,  gold:115, w:10, h:10, base:'grass' },
        { n:10, name:'을지문덕의 결전',    desc:'살수에서의 최후 결전',         boss:0, mc:5, lmin:8,  lmax:11, exp:280,  gold:125, w:12, h:10, base:'grass' },
        { n:11, name:'연개소문의 시련',    desc:'독재자의 야망이 깃든 전장',    boss:0, mc:5, lmin:9,  lmax:11, exp:310,  gold:135, w:12, h:10, base:'stone' },
        { n:12, name:'고구려 최후의 전투', desc:'동방의 대제국 최후의 날',      boss:1, mc:6, lmin:9,  lmax:11, exp:400,  gold:200, w:12, h:12, base:'stone' },
      ],
      'baekje': [
        { n:1,  name:'위례성',            desc:'한강 유역의 첫 도읍',          boss:0, mc:3, lmin:7,  lmax:9,  exp:170,  gold:85,  w:9,  h:9,  base:'grass' },
        { n:2,  name:'한산 기슭',         desc:'새로운 터전의 방어',           boss:0, mc:3, lmin:7,  lmax:9,  exp:180,  gold:90,  w:9,  h:9,  base:'grass' },
        { n:3,  name:'웅진 도하',         desc:'금강을 건너는 전투',           boss:0, mc:3, lmin:8,  lmax:10, exp:195,  gold:95,  w:10, h:10, base:'grass' },
        { n:4,  name:'사비성 공방',       desc:'마지막 수도의 치열한 전투',    boss:0, mc:3, lmin:8,  lmax:10, exp:205,  gold:100, w:10, h:10, base:'grass' },
        { n:5,  name:'무령왕릉',          desc:'백제 문화의 정수가 깃든 곳',   boss:0, mc:4, lmin:8,  lmax:11, exp:220,  gold:105, w:10, h:10, base:'stone' },
        { n:6,  name:'미륵사 터',         desc:'동양 최대 사찰의 전쟁터',      boss:0, mc:4, lmin:9,  lmax:11, exp:235,  gold:110, w:10, h:10, base:'stone' },
        { n:7,  name:'백마강 전투',       desc:'낙화암의 슬픔이 서린 강가',    boss:0, mc:4, lmin:9,  lmax:12, exp:250,  gold:120, w:10, h:10, base:'grass' },
        { n:8,  name:'관산성',           desc:'성왕의 비극이 있던 전장',       boss:0, mc:4, lmin:9,  lmax:12, exp:265,  gold:125, w:10, h:10, base:'stone' },
        { n:9,  name:'황산벌 전야',       desc:'결사대 5천의 최후 전투',       boss:0, mc:5, lmin:10, lmax:13, exp:280,  gold:135, w:12, h:10, base:'grass' },
        { n:10, name:'계백 장군의 결전',   desc:'충의의 장군과의 결전',         boss:1, mc:5, lmin:10, lmax:13, exp:420,  gold:210, w:12, h:12, base:'grass' },
      ],
      'silla': [
        { n:1,  name:'경주 남산',         desc:'신라의 성스러운 산',           boss:0, mc:3, lmin:9,  lmax:11, exp:200,  gold:100, w:9,  h:9,  base:'grass' },
        { n:2,  name:'화랑 수련장',       desc:'화랑도의 심신 수련장',         boss:0, mc:3, lmin:9,  lmax:11, exp:210,  gold:105, w:9,  h:9,  base:'grass' },
        { n:3,  name:'첨성대 주변',       desc:'별을 관측하는 천문대 전장',    boss:0, mc:3, lmin:10, lmax:12, exp:225,  gold:110, w:10, h:10, base:'stone' },
        { n:4,  name:'불국사 경내',       desc:'부처의 나라가 현현한 사찰',    boss:0, mc:3, lmin:10, lmax:12, exp:235,  gold:115, w:10, h:10, base:'stone' },
        { n:5,  name:'석굴암 석실',       desc:'신비로운 석굴 속의 전투',      boss:0, mc:4, lmin:10, lmax:13, exp:250,  gold:120, w:10, h:10, base:'stone' },
        { n:6,  name:'대릉원',            desc:'왕릉 사이의 격전',            boss:0, mc:4, lmin:11, lmax:13, exp:265,  gold:130, w:10, h:10, base:'grass' },
        { n:7,  name:'김유신의 출전',     desc:'삼국통일의 영웅과 함께',       boss:0, mc:4, lmin:11, lmax:14, exp:280,  gold:135, w:10, h:10, base:'grass' },
        { n:8,  name:'매소성 전투',       desc:'당군을 몰아낸 결전지',         boss:0, mc:4, lmin:11, lmax:14, exp:295,  gold:140, w:10, h:10, base:'grass' },
        { n:9,  name:'기벌포 해전',       desc:'바다 위의 최종 결전',          boss:0, mc:5, lmin:12, lmax:15, exp:310,  gold:150, w:12, h:10, base:'stone' },
        { n:10, name:'비담의 난',         desc:'여왕을 향한 반란의 전장',      boss:0, mc:5, lmin:12, lmax:15, exp:330,  gold:155, w:12, h:10, base:'stone' },
        { n:11, name:'문무왕 해중릉',     desc:'바다 용이 된 왕의 시련',       boss:0, mc:5, lmin:13, lmax:15, exp:350,  gold:165, w:12, h:10, base:'stone' },
        { n:12, name:'삼국통일 대전',     desc:'천년 전쟁의 종결',             boss:1, mc:6, lmin:13, lmax:15, exp:500,  gold:250, w:12, h:12, base:'grass' },
      ],
      'balhae': [
        { n:1,  name:'동모산',           desc:'발해 건국의 성지',              boss:0, mc:3, lmin:11, lmax:13, exp:240,  gold:120, w:9,  h:9,  base:'stone' },
        { n:2,  name:'상경용천부',        desc:'발해의 수도',                 boss:0, mc:3, lmin:11, lmax:13, exp:255,  gold:125, w:10, h:10, base:'stone' },
        { n:3,  name:'중경현덕부',        desc:'발해 5경의 중심',              boss:0, mc:3, lmin:12, lmax:14, exp:270,  gold:130, w:10, h:10, base:'stone' },
        { n:4,  name:'장문휴의 원정',     desc:'당을 공격한 해상 원정',        boss:0, mc:4, lmin:12, lmax:14, exp:285,  gold:140, w:10, h:10, base:'stone' },
        { n:5,  name:'대조영의 전장',     desc:'건국 영웅의 전투',             boss:0, mc:4, lmin:12, lmax:15, exp:300,  gold:145, w:10, h:10, base:'grass' },
        { n:6,  name:'대무예의 진격',     desc:'영토 확장의 전쟁터',           boss:0, mc:4, lmin:13, lmax:15, exp:315,  gold:155, w:10, h:10, base:'grass' },
        { n:7,  name:'거란 접경',         desc:'북방 유목민과의 충돌',         boss:0, mc:4, lmin:13, lmax:16, exp:330,  gold:160, w:10, h:10, base:'grass' },
        { n:8,  name:'선왕의 전성기',     desc:'해동성국의 전성기 전투',       boss:0, mc:5, lmin:14, lmax:16, exp:350,  gold:170, w:10, h:10, base:'stone' },
        { n:9,  name:'발해 말기 전투',    desc:'멸망 직전의 사투',             boss:0, mc:5, lmin:14, lmax:17, exp:370,  gold:180, w:12, h:10, base:'stone' },
        { n:10, name:'해동성국 최후',     desc:'발해 멸망의 마지막 전쟁',      boss:1, mc:6, lmin:15, lmax:17, exp:550,  gold:275, w:12, h:12, base:'stone' },
      ],
      'goryeo': [
        { n:1,  name:'송악산',           desc:'왕건이 꿈꾼 통일의 산',         boss:0, mc:3, lmin:13, lmax:15, exp:280,  gold:140, w:9,  h:9,  base:'grass' },
        { n:2,  name:'개경 시가전',       desc:'수도의 격렬한 전투',           boss:0, mc:3, lmin:13, lmax:15, exp:295,  gold:145, w:10, h:10, base:'stone' },
        { n:3,  name:'서경 전투',         desc:'서경 천도를 둘러싼 전쟁',      boss:0, mc:3, lmin:14, lmax:16, exp:310,  gold:155, w:10, h:10, base:'stone' },
        { n:4,  name:'귀주대첩',          desc:'강감찬의 위대한 승리',         boss:0, mc:4, lmin:14, lmax:16, exp:330,  gold:160, w:10, h:10, base:'grass' },
        { n:5,  name:'처인성 전투',       desc:'몽골군을 물리친 승병의 전투',  boss:0, mc:4, lmin:14, lmax:17, exp:345,  gold:170, w:10, h:10, base:'stone' },
        { n:6,  name:'삼별초 항쟁',       desc:'끝까지 저항한 삼별초',         boss:0, mc:4, lmin:15, lmax:17, exp:360,  gold:175, w:10, h:10, base:'stone' },
        { n:7,  name:'팔만대장경 수호',    desc:'불교 문화유산을 지켜라',       boss:0, mc:4, lmin:15, lmax:18, exp:380,  gold:185, w:10, h:10, base:'stone' },
        { n:8,  name:'강화도 항전',       desc:'39년 항전의 요새',             boss:0, mc:5, lmin:16, lmax:18, exp:400,  gold:195, w:10, h:10, base:'stone' },
        { n:9,  name:'쌍성총관부 탈환',    desc:'빼앗긴 영토를 되찾는 전투',   boss:0, mc:5, lmin:16, lmax:19, exp:420,  gold:205, w:12, h:10, base:'grass' },
        { n:10, name:'위화도 회군',       desc:'이성계의 운명적 결단',         boss:0, mc:5, lmin:16, lmax:19, exp:440,  gold:210, w:12, h:10, base:'grass' },
        { n:11, name:'만월대 공방',       desc:'고려 궁궐의 최후 방어',        boss:0, mc:5, lmin:17, lmax:19, exp:460,  gold:220, w:12, h:10, base:'stone' },
        { n:12, name:'고려 최후의 전투',   desc:'왕조의 종말',                  boss:0, mc:5, lmin:17, lmax:19, exp:480,  gold:230, w:12, h:10, base:'stone' },
        { n:13, name:'강감찬 대원수 결전', desc:'귀주의 영웅과의 최종 결전',    boss:1, mc:6, lmin:18, lmax:19, exp:650,  gold:325, w:14, h:12, base:'grass' },
      ],
      'joseon': [
        { n:1,  name:'한양 도성',         desc:'새 왕조의 수도',               boss:0, mc:3, lmin:16, lmax:18, exp:350,  gold:175, w:10, h:10, base:'stone' },
        { n:2,  name:'경복궁 근정전',     desc:'왕의 정전 앞 전투',            boss:0, mc:3, lmin:16, lmax:18, exp:365,  gold:180, w:10, h:10, base:'stone' },
        { n:3,  name:'집현전',           desc:'학자들의 지혜가 서린 곳',       boss:0, mc:4, lmin:17, lmax:19, exp:380,  gold:190, w:10, h:10, base:'stone' },
        { n:4,  name:'4군6진',           desc:'북방 개척의 전장',             boss:0, mc:4, lmin:17, lmax:19, exp:400,  gold:195, w:10, h:10, base:'grass' },
        { n:5,  name:'사육신의 충절',     desc:'단종을 향한 충절의 전투',      boss:0, mc:4, lmin:17, lmax:20, exp:415,  gold:205, w:10, h:10, base:'stone' },
        { n:6,  name:'비변사',           desc:'국방 회의장에서의 전투',        boss:0, mc:4, lmin:18, lmax:20, exp:430,  gold:210, w:10, h:10, base:'stone' },
        { n:7,  name:'성균관',           desc:'유교 교육의 전당',             boss:0, mc:4, lmin:18, lmax:21, exp:450,  gold:220, w:10, h:10, base:'stone' },
        { n:8,  name:'종묘 제례',         desc:'왕실 제사의 성스러운 전장',    boss:0, mc:5, lmin:19, lmax:21, exp:470,  gold:230, w:10, h:10, base:'dark' },
        { n:9,  name:'창덕궁 후원',       desc:'비밀 정원의 전투',             boss:0, mc:5, lmin:19, lmax:22, exp:490,  gold:240, w:12, h:10, base:'grass' },
        { n:10, name:'수원 화성',         desc:'정조의 꿈이 서린 성곽',        boss:0, mc:5, lmin:19, lmax:22, exp:510,  gold:250, w:12, h:10, base:'stone' },
        { n:11, name:'실학자의 서재',     desc:'실학의 정신이 깃든 전장',      boss:0, mc:5, lmin:20, lmax:22, exp:530,  gold:260, w:12, h:10, base:'stone' },
        { n:12, name:'동학농민 전장',     desc:'민중 봉기의 전쟁터',           boss:0, mc:5, lmin:20, lmax:22, exp:550,  gold:270, w:12, h:10, base:'grass' },
        { n:13, name:'경회루 결전',       desc:'연못 위의 누각에서의 결전',    boss:0, mc:5, lmin:20, lmax:22, exp:570,  gold:280, w:12, h:10, base:'stone' },
        { n:14, name:'세종대왕의 시련',   desc:'성군이 남긴 최후의 시험',      boss:1, mc:6, lmin:21, lmax:22, exp:900,  gold:450, w:14, h:12, base:'stone' },
      ],
      'imjin': [
        { n:1,  name:'부산진 상륙',       desc:'왜군의 첫 상륙지',             boss:0, mc:3, lmin:19, lmax:21, exp:420,  gold:210, w:10, h:10, base:'stone' },
        { n:2,  name:'동래성 전투',       desc:'송상현의 순절',               boss:0, mc:3, lmin:19, lmax:21, exp:440,  gold:215, w:10, h:10, base:'stone' },
        { n:3,  name:'탄금대',           desc:'신립 장군의 배수진',            boss:0, mc:4, lmin:20, lmax:22, exp:460,  gold:225, w:10, h:10, base:'grass' },
        { n:4,  name:'이치 전투',         desc:'권율의 첫 승리',               boss:0, mc:4, lmin:20, lmax:22, exp:480,  gold:235, w:10, h:10, base:'grass' },
        { n:5,  name:'한산도 대첩',       desc:'학익진으로 적을 섬멸',         boss:0, mc:4, lmin:20, lmax:23, exp:500,  gold:245, w:10, h:10, base:'stone' },
        { n:6,  name:'행주대첩',          desc:'행주산성의 위대한 승리',       boss:0, mc:4, lmin:21, lmax:23, exp:520,  gold:255, w:10, h:10, base:'stone' },
        { n:7,  name:'진주성 전투',       desc:'진주목사 김시민의 전투',       boss:0, mc:4, lmin:21, lmax:24, exp:540,  gold:265, w:10, h:10, base:'stone' },
        { n:8,  name:'의병 봉기',         desc:'곽재우 의병장의 전장',         boss:0, mc:5, lmin:22, lmax:24, exp:560,  gold:275, w:10, h:10, base:'grass' },
        { n:9,  name:'직산 전투',         desc:'조명연합군의 반격',            boss:0, mc:5, lmin:22, lmax:25, exp:580,  gold:285, w:12, h:10, base:'grass' },
        { n:10, name:'울산성 전투',       desc:'혹한 속의 사투',               boss:0, mc:5, lmin:22, lmax:25, exp:600,  gold:295, w:12, h:10, base:'stone' },
        { n:11, name:'사천해전',          desc:'거북선의 포화',               boss:0, mc:5, lmin:23, lmax:25, exp:620,  gold:305, w:12, h:10, base:'stone' },
        { n:12, name:'명량해협',          desc:'13척의 기적',                 boss:0, mc:5, lmin:23, lmax:25, exp:650,  gold:320, w:12, h:10, base:'stone' },
        { n:13, name:'노량해전 전야',     desc:'마지막 해전 직전의 전투',      boss:0, mc:5, lmin:24, lmax:25, exp:680,  gold:335, w:12, h:10, base:'stone' },
        { n:14, name:'노량 최후의 전투',   desc:'이순신 장군 전사의 해전',      boss:0, mc:6, lmin:24, lmax:25, exp:710,  gold:350, w:12, h:12, base:'stone' },
        { n:15, name:'이순신 장군 결전',   desc:'불멸의 영웅과의 최종 결전',    boss:1, mc:6, lmin:25, lmax:25, exp:1100, gold:550, w:14, h:14, base:'stone' },
      ],
      'modern': [
        { n:1,  name:'강화도 포대',       desc:'서양 열강과의 첫 충돌',        boss:0, mc:3, lmin:22, lmax:24, exp:500,  gold:250, w:10, h:10, base:'stone' },
        { n:2,  name:'운양호 사건',       desc:'근대의 서막',                 boss:0, mc:3, lmin:22, lmax:24, exp:520,  gold:260, w:10, h:10, base:'stone' },
        { n:3,  name:'광화문 앞',         desc:'격변의 수도 한복판',           boss:0, mc:4, lmin:23, lmax:25, exp:545,  gold:270, w:10, h:10, base:'stone' },
        { n:4,  name:'동학혁명 전장',     desc:'녹두장군 전봉준의 전투',       boss:0, mc:4, lmin:23, lmax:25, exp:565,  gold:280, w:10, h:10, base:'grass' },
        { n:5,  name:'을미사변 궁궐',     desc:'명성황후를 지키는 전투',       boss:0, mc:4, lmin:24, lmax:26, exp:590,  gold:295, w:10, h:10, base:'dark' },
        { n:6,  name:'독립문 광장',       desc:'독립의 의지가 불타는 곳',      boss:0, mc:4, lmin:24, lmax:26, exp:610,  gold:305, w:10, h:10, base:'stone' },
        { n:7,  name:'의병 산성',         desc:'항일 의병의 산성 방어',        boss:0, mc:5, lmin:24, lmax:27, exp:635,  gold:315, w:10, h:10, base:'stone' },
        { n:8,  name:'봉오동 전투',       desc:'독립군의 첫 대승',            boss:0, mc:5, lmin:25, lmax:27, exp:660,  gold:330, w:10, h:10, base:'grass' },
        { n:9,  name:'청산리 전투',       desc:'김좌진의 위대한 승리',         boss:0, mc:5, lmin:25, lmax:28, exp:685,  gold:340, w:12, h:10, base:'grass' },
        { n:10, name:'상해 임시정부',     desc:'독립의 불꽃을 지키는 전투',    boss:0, mc:5, lmin:25, lmax:28, exp:710,  gold:355, w:12, h:10, base:'stone' },
        { n:11, name:'윤봉길 의거',       desc:'도시락 폭탄의 전장',          boss:0, mc:5, lmin:26, lmax:28, exp:740,  gold:370, w:12, h:10, base:'stone' },
        { n:12, name:'광복군 전선',       desc:'마지막 독립전쟁',             boss:0, mc:5, lmin:26, lmax:28, exp:770,  gold:385, w:12, h:10, base:'grass' },
        { n:13, name:'해방 전야',         desc:'광복 직전의 최후 전투',        boss:0, mc:6, lmin:27, lmax:28, exp:800,  gold:400, w:12, h:12, base:'dark' },
        { n:14, name:'안중근의 결의',     desc:'동양 평화를 위한 영웅의 전투', boss:0, mc:6, lmin:27, lmax:28, exp:840,  gold:420, w:12, h:12, base:'stone' },
        { n:15, name:'독립의 새벽 결전',   desc:'모든 역사의 힘이 모인 최종전', boss:1, mc:6, lmin:28, lmax:28, exp:1800, gold:900, w:14, h:14, base:'dark' },
      ],
    };

    for (const [groupKey, stages] of Object.entries(stageData)) {
      const groupId = gMap[groupKey];
      if (!groupId) continue;
      const dungeonKey = groupDungeonMap[groupKey] || 'forest';

      for (const s of stages) {
        const tileOverrides = generateMapOverrides(s.w, s.h, s.base, s.n, !!s.boss);
        const pSpawns = generateSpawns(s.w, s.h, 'player', Math.min(4, s.mc));
        const mSpawns = generateSpawns(s.w, s.h, 'monster', s.mc);

        await pool.query(
          `INSERT IGNORE INTO stage_levels
           (group_id, stage_number, name, description, is_boss, monster_count,
            monster_level_min, monster_level_max, reward_exp, reward_gold,
            dungeon_key, map_width, map_height, base_tile_type,
            tile_overrides, player_spawns, monster_spawns)
           VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
          [groupId, s.n, s.name, s.desc, s.boss, s.mc, s.lmin, s.lmax, s.exp, s.gold,
           dungeonKey, s.w, s.h, s.base,
           JSON.stringify(tileOverrides), JSON.stringify(pSpawns), JSON.stringify(mSpawns)]
        );
      }
    }
  }

  // 일본/중국 스테이지 시드
  const [newGRows] = await pool.query("SELECT id, key_name FROM stage_groups WHERE country IN ('japan','china') ORDER BY display_order");
  const newGMap = {};
  for (const g of newGRows) newGMap[g.key_name] = g.id;

  const newGroupDungeonMap = {
    'jomon':'forest','yayoi':'slime_cave','yamato':'cave','nara':'temple','heian':'spirit_forest',
    'kamakura':'mountain','muromachi':'swamp','sengoku':'demon','edo':'goblin','meiji':'dragon',
    'xia_shang':'forest','zhou':'cave','qin':'mountain','han':'slime_cave','three_kingdoms':'swamp',
    'tang':'temple','song':'spirit_forest','yuan':'demon','ming':'goblin','qing':'dragon',
  };

  const [existJpCn] = await pool.query("SELECT COUNT(*) as cnt FROM stage_levels sl JOIN stage_groups sg ON sl.group_id = sg.id WHERE sg.country IN ('japan','china')");
  if (existJpCn[0].cnt === 0) {
    const jpCnStageData = {
      // ========== 일본 스테이지 ==========
      'jomon': [
        { n:1,  name:'토기의 마을',       desc:'조몬 토기가 탄생한 원시 마을',     boss:0, mc:2, lmin:1,  lmax:2,  exp:80,   gold:40,  w:8,  h:8,  base:'grass' },
        { n:2,  name:'패총 유적',         desc:'조개더미 아래의 고대 유적',         boss:0, mc:2, lmin:1,  lmax:2,  exp:90,   gold:45,  w:8,  h:8,  base:'grass' },
        { n:3,  name:'수렵의 숲',         desc:'사슴과 멧돼지를 쫓던 숲',          boss:0, mc:3, lmin:1,  lmax:3,  exp:100,  gold:50,  w:9,  h:9,  base:'grass' },
        { n:4,  name:'환상 열도(列島)',    desc:'화산섬의 원시 전장',               boss:0, mc:3, lmin:2,  lmax:3,  exp:110,  gold:55,  w:9,  h:8,  base:'stone' },
        { n:5,  name:'흑요석 광산',       desc:'석기 재료를 캐는 광산',             boss:0, mc:3, lmin:2,  lmax:4,  exp:120,  gold:60,  w:10, h:8,  base:'stone' },
        { n:6,  name:'해안 동굴',         desc:'바다 옆 동굴의 비밀',              boss:0, mc:3, lmin:2,  lmax:4,  exp:130,  gold:65,  w:10, h:9,  base:'stone' },
        { n:7,  name:'산나이마루야마',     desc:'거대 취락 유적의 전장',            boss:0, mc:4, lmin:3,  lmax:5,  exp:140,  gold:70,  w:10, h:10, base:'grass' },
        { n:8,  name:'석인상의 언덕',     desc:'돌 조각상이 지키는 언덕',          boss:0, mc:4, lmin:3,  lmax:5,  exp:155,  gold:75,  w:10, h:10, base:'stone' },
        { n:9,  name:'화산 분화구',       desc:'지열이 솟아오르는 위험 지대',       boss:0, mc:4, lmin:3,  lmax:5,  exp:170,  gold:80,  w:10, h:10, base:'stone' },
        { n:10, name:'토우(土偶)의 시련', desc:'조몬 수호신의 최종 시험',           boss:1, mc:5, lmin:4,  lmax:6,  exp:250,  gold:120, w:12, h:12, base:'grass' },
      ],
      'yayoi': [
        { n:1,  name:'요시노가리',        desc:'환호 취락의 방어전',               boss:0, mc:2, lmin:3,  lmax:4,  exp:100,  gold:50,  w:8,  h:8,  base:'grass' },
        { n:2,  name:'벼의 평야',         desc:'벼농사가 시작된 평야',             boss:0, mc:3, lmin:3,  lmax:5,  exp:110,  gold:55,  w:8,  h:9,  base:'grass' },
        { n:3,  name:'동탁(銅鐸) 제단',   desc:'청동 방울이 울리는 제단',          boss:0, mc:3, lmin:4,  lmax:5,  exp:120,  gold:60,  w:9,  h:9,  base:'grass' },
        { n:4,  name:'나국(奴國) 왕궁',   desc:'금인을 받은 소국의 왕궁',          boss:0, mc:3, lmin:4,  lmax:6,  exp:130,  gold:65,  w:10, h:9,  base:'stone' },
        { n:5,  name:'부족 전쟁터',       desc:'왜국 대란의 전장',                boss:0, mc:3, lmin:4,  lmax:6,  exp:140,  gold:70,  w:10, h:10, base:'grass' },
        { n:6,  name:'철기 대장간',       desc:'대륙에서 전해진 철기 기술',         boss:0, mc:4, lmin:5,  lmax:7,  exp:155,  gold:75,  w:10, h:10, base:'stone' },
        { n:7,  name:'마쓰리 의식장',     desc:'풍년을 비는 의식 중 전투',          boss:0, mc:4, lmin:5,  lmax:7,  exp:170,  gold:80,  w:10, h:10, base:'grass' },
        { n:8,  name:'이토국 성벽',       desc:'소국 연합의 방어선',               boss:0, mc:4, lmin:5,  lmax:8,  exp:185,  gold:90,  w:10, h:10, base:'stone' },
        { n:9,  name:'야마타이국 입구',    desc:'히미코 여왕의 도성',               boss:0, mc:4, lmin:6,  lmax:8,  exp:200,  gold:95,  w:10, h:10, base:'stone' },
        { n:10, name:'히미코의 결전',     desc:'야마타이국 여왕의 시련',            boss:1, mc:5, lmin:6,  lmax:9,  exp:300,  gold:150, w:12, h:12, base:'grass' },
      ],
      'yamato': [
        { n:1,  name:'이즈모 신전',       desc:'출운 대사의 신전 전투',            boss:0, mc:3, lmin:5,  lmax:7,  exp:140,  gold:70,  w:9,  h:9,  base:'stone' },
        { n:2,  name:'미와산 기슭',       desc:'야마토 건국의 성산',               boss:0, mc:3, lmin:5,  lmax:7,  exp:150,  gold:75,  w:9,  h:9,  base:'grass' },
        { n:3,  name:'전방후원분',        desc:'거대 고분의 수호자',               boss:0, mc:3, lmin:6,  lmax:8,  exp:165,  gold:80,  w:10, h:10, base:'grass' },
        { n:4,  name:'하니와 벌판',       desc:'토기 인형이 지키는 벌판',          boss:0, mc:3, lmin:6,  lmax:8,  exp:175,  gold:85,  w:10, h:10, base:'grass' },
        { n:5,  name:'아스카 궁전',       desc:'아스카 시대의 왕궁 전투',          boss:0, mc:4, lmin:7,  lmax:9,  exp:190,  gold:90,  w:10, h:10, base:'stone' },
        { n:6,  name:'소가 저택',         desc:'호족 소가씨의 거대 저택',          boss:0, mc:4, lmin:7,  lmax:9,  exp:205,  gold:95,  w:10, h:10, base:'stone' },
        { n:7,  name:'하쿠손코 전투',     desc:'백촌강 전투의 일본 측',            boss:0, mc:4, lmin:7,  lmax:10, exp:220,  gold:100, w:10, h:10, base:'grass' },
        { n:8,  name:'다이카 개신',       desc:'중앙집권화의 혼란',               boss:0, mc:4, lmin:8,  lmax:10, exp:235,  gold:110, w:10, h:10, base:'stone' },
        { n:9,  name:'진신의 난',         desc:'황위 계승 전쟁',                  boss:0, mc:4, lmin:8,  lmax:11, exp:250,  gold:115, w:10, h:10, base:'grass' },
        { n:10, name:'야마토타케루 결전', desc:'일본 무신의 전설적 전투',           boss:0, mc:5, lmin:8,  lmax:11, exp:280,  gold:125, w:12, h:10, base:'grass' },
        { n:11, name:'쇼토쿠 태자 시련', desc:'불교 수호자의 시험',               boss:0, mc:5, lmin:9,  lmax:11, exp:310,  gold:135, w:12, h:10, base:'stone' },
        { n:12, name:'천손강림 결전',     desc:'신화 시대의 최종 전투',            boss:1, mc:6, lmin:9,  lmax:11, exp:400,  gold:200, w:12, h:12, base:'stone' },
      ],
      'nara': [
        { n:1,  name:'헤이조궁',          desc:'나라 수도의 궁전 전투',            boss:0, mc:3, lmin:7,  lmax:9,  exp:170,  gold:85,  w:9,  h:9,  base:'stone' },
        { n:2,  name:'도다이지',          desc:'대불이 있는 거대 사원',            boss:0, mc:3, lmin:7,  lmax:9,  exp:180,  gold:90,  w:9,  h:9,  base:'stone' },
        { n:3,  name:'쇼소인 보물고',     desc:'실크로드 보물이 잠든 창고',         boss:0, mc:3, lmin:8,  lmax:10, exp:195,  gold:95,  w:10, h:10, base:'stone' },
        { n:4,  name:'가스가 신사',       desc:'사슴이 지키는 신사',               boss:0, mc:3, lmin:8,  lmax:10, exp:205,  gold:100, w:10, h:10, base:'grass' },
        { n:5,  name:'고키시치도',        desc:'칠도의 관도를 순찰',               boss:0, mc:4, lmin:8,  lmax:11, exp:220,  gold:105, w:10, h:10, base:'grass' },
        { n:6,  name:'만요슈 정원',       desc:'시가 흐르는 정원의 전투',           boss:0, mc:4, lmin:9,  lmax:11, exp:235,  gold:110, w:10, h:10, base:'grass' },
        { n:7,  name:'감진의 도래',       desc:'중국 고승의 시련',                boss:0, mc:4, lmin:9,  lmax:12, exp:250,  gold:120, w:10, h:10, base:'stone' },
        { n:8,  name:'후지와라 저택',     desc:'세도가 후지와라의 본거지',          boss:0, mc:4, lmin:9,  lmax:12, exp:265,  gold:125, w:10, h:10, base:'stone' },
        { n:9,  name:'다카마가하라',       desc:'신들의 고원 전투',                boss:0, mc:5, lmin:10, lmax:13, exp:280,  gold:135, w:12, h:10, base:'grass' },
        { n:10, name:'나라 대불 결전',    desc:'대불의 수호신 최종 전투',           boss:1, mc:5, lmin:10, lmax:13, exp:420,  gold:210, w:12, h:12, base:'stone' },
      ],
      'heian': [
        { n:1,  name:'헤이안쿄 거리',     desc:'귀족 도시의 야간 전투',            boss:0, mc:3, lmin:9,  lmax:11, exp:200,  gold:100, w:9,  h:9,  base:'stone' },
        { n:2,  name:'겐지 저택',         desc:'빛의 공자 겐지의 저택',            boss:0, mc:3, lmin:9,  lmax:11, exp:210,  gold:105, w:9,  h:9,  base:'stone' },
        { n:3,  name:'기요미즈데라',       desc:'청수사의 무대 위 전투',            boss:0, mc:3, lmin:10, lmax:12, exp:225,  gold:110, w:10, h:10, base:'stone' },
        { n:4,  name:'후시미이나리',       desc:'천 개의 도리이 사이 전투',          boss:0, mc:3, lmin:10, lmax:12, exp:235,  gold:115, w:10, h:10, base:'stone' },
        { n:5,  name:'오닌의 숲',         desc:'요괴가 출몰하는 밤의 숲',           boss:0, mc:4, lmin:10, lmax:13, exp:250,  gold:120, w:10, h:10, base:'dark' },
        { n:6,  name:'슈겐도 수행장',     desc:'산악 수행자의 전장',               boss:0, mc:4, lmin:11, lmax:13, exp:265,  gold:130, w:10, h:10, base:'stone' },
        { n:7,  name:'미나모토 진영',     desc:'무사의 시대를 연 겐지 진영',        boss:0, mc:4, lmin:11, lmax:14, exp:280,  gold:135, w:10, h:10, base:'grass' },
        { n:8,  name:'다이라 해안',       desc:'헤이케의 해안 방어선',             boss:0, mc:4, lmin:11, lmax:14, exp:295,  gold:140, w:10, h:10, base:'stone' },
        { n:9,  name:'단노우라 전야',     desc:'겐페이 전쟁 최후의 해전',          boss:0, mc:5, lmin:12, lmax:15, exp:310,  gold:150, w:12, h:10, base:'stone' },
        { n:10, name:'아베노 세이메이',   desc:'음양사 세이메이의 시련',            boss:0, mc:5, lmin:12, lmax:15, exp:330,  gold:155, w:12, h:10, base:'dark' },
        { n:11, name:'슈텐도지 토벌',     desc:'대요괴 슈텐도지 전투',             boss:0, mc:5, lmin:13, lmax:15, exp:350,  gold:165, w:12, h:10, base:'dark' },
        { n:12, name:'헤이안 최종 결전',  desc:'귀족 시대 종말의 전투',             boss:1, mc:6, lmin:13, lmax:15, exp:500,  gold:250, w:12, h:12, base:'dark' },
      ],
      'kamakura': [
        { n:1,  name:'가마쿠라 거리',     desc:'막부의 수도 카마쿠라',             boss:0, mc:3, lmin:11, lmax:13, exp:240,  gold:120, w:9,  h:9,  base:'stone' },
        { n:2,  name:'쓰루가오카',        desc:'학강 팔번궁의 전투',               boss:0, mc:3, lmin:11, lmax:13, exp:255,  gold:125, w:10, h:10, base:'stone' },
        { n:3,  name:'대불 앞',           desc:'가마쿠라 대불의 수호',             boss:0, mc:3, lmin:12, lmax:14, exp:270,  gold:130, w:10, h:10, base:'stone' },
        { n:4,  name:'기리시마 산성',     desc:'산악 요새의 방어전',               boss:0, mc:4, lmin:12, lmax:14, exp:285,  gold:140, w:10, h:10, base:'stone' },
        { n:5,  name:'겐코의 난',         desc:'고다이고 천황의 반격',             boss:0, mc:4, lmin:12, lmax:15, exp:300,  gold:145, w:10, h:10, base:'grass' },
        { n:6,  name:'몽골 습래(1차)',    desc:'원나라 함대에 맞선 방어',           boss:0, mc:4, lmin:13, lmax:15, exp:315,  gold:155, w:10, h:10, base:'stone' },
        { n:7,  name:'하카타만 방루',     desc:'방루를 사이에 둔 전투',             boss:0, mc:4, lmin:13, lmax:16, exp:330,  gold:160, w:10, h:10, base:'stone' },
        { n:8,  name:'몽골 습래(2차)',    desc:'신풍(카미카제)의 전장',             boss:0, mc:5, lmin:14, lmax:16, exp:350,  gold:170, w:10, h:10, base:'stone' },
        { n:9,  name:'나가사키 항',       desc:'해상 결전의 전장',                 boss:0, mc:5, lmin:14, lmax:17, exp:370,  gold:180, w:12, h:10, base:'stone' },
        { n:10, name:'호조 집권 결전',    desc:'집권의 최후와 막부 붕괴',           boss:1, mc:6, lmin:15, lmax:17, exp:550,  gold:275, w:12, h:12, base:'stone' },
      ],
      'muromachi': [
        { n:1,  name:'금각사',            desc:'킨카쿠지의 황금 전장',             boss:0, mc:3, lmin:13, lmax:15, exp:280,  gold:140, w:9,  h:9,  base:'stone' },
        { n:2,  name:'은각사',            desc:'긴카쿠지의 은빛 전장',             boss:0, mc:3, lmin:13, lmax:15, exp:295,  gold:145, w:10, h:10, base:'stone' },
        { n:3,  name:'남조 산성',         desc:'남북조 분열의 전장',               boss:0, mc:3, lmin:14, lmax:16, exp:310,  gold:155, w:10, h:10, base:'stone' },
        { n:4,  name:'노 무대',           desc:'노가쿠 무대 위의 전투',            boss:0, mc:4, lmin:14, lmax:16, exp:330,  gold:160, w:10, h:10, base:'stone' },
        { n:5,  name:'정원사의 전투',     desc:'가레산스이 정원의 수호',            boss:0, mc:4, lmin:14, lmax:17, exp:345,  gold:170, w:10, h:10, base:'stone' },
        { n:6,  name:'이코 잇키',         desc:'잇코종 봉기의 전장',               boss:0, mc:4, lmin:15, lmax:17, exp:360,  gold:175, w:10, h:10, base:'grass' },
        { n:7,  name:'왜구 소탕',         desc:'해적 왜구의 근거지',               boss:0, mc:4, lmin:15, lmax:18, exp:380,  gold:185, w:10, h:10, base:'stone' },
        { n:8,  name:'오닌의 난',         desc:'교토를 태운 대란',                boss:0, mc:5, lmin:16, lmax:18, exp:400,  gold:195, w:10, h:10, base:'dark' },
        { n:9,  name:'사카이 항구',       desc:'자치 도시의 방어전',               boss:0, mc:5, lmin:16, lmax:19, exp:420,  gold:205, w:12, h:10, base:'stone' },
        { n:10, name:'쿠스노키 결전',     desc:'충신 쿠스노키의 최후',             boss:0, mc:5, lmin:16, lmax:19, exp:440,  gold:210, w:12, h:10, base:'grass' },
        { n:11, name:'아시카가 결전',     desc:'무로마치 막부 최후',               boss:1, mc:6, lmin:17, lmax:19, exp:600,  gold:300, w:12, h:12, base:'stone' },
      ],
      'sengoku': [
        { n:1,  name:'오와리 평야',       desc:'오다 노부나가의 출발점',            boss:0, mc:3, lmin:16, lmax:18, exp:350,  gold:175, w:10, h:10, base:'grass' },
        { n:2,  name:'오케하자마',        desc:'기습으로 대군을 격파한 전투',        boss:0, mc:3, lmin:16, lmax:18, exp:365,  gold:180, w:10, h:10, base:'grass' },
        { n:3,  name:'나가시노 전투',     desc:'철포대의 3단 사격전',              boss:0, mc:4, lmin:17, lmax:19, exp:380,  gold:190, w:10, h:10, base:'grass' },
        { n:4,  name:'아즈치성',          desc:'노부나가의 거대 천수각',            boss:0, mc:4, lmin:17, lmax:19, exp:400,  gold:195, w:10, h:10, base:'stone' },
        { n:5,  name:'혼노지의 변',       desc:'배신의 불꽃이 타오른 사원',         boss:0, mc:4, lmin:17, lmax:20, exp:415,  gold:205, w:10, h:10, base:'dark' },
        { n:6,  name:'시즈가타케',        desc:'히데요시의 통일 전쟁',             boss:0, mc:4, lmin:18, lmax:20, exp:430,  gold:210, w:10, h:10, base:'grass' },
        { n:7,  name:'오다와라 공성',     desc:'호조씨 최후의 거성',               boss:0, mc:4, lmin:18, lmax:21, exp:450,  gold:220, w:10, h:10, base:'stone' },
        { n:8,  name:'조선 침략 진영',    desc:'히데요시의 대륙 침공 거점',         boss:0, mc:5, lmin:19, lmax:21, exp:470,  gold:230, w:10, h:10, base:'stone' },
        { n:9,  name:'후시미성',          desc:'히데요시 최후의 성',               boss:0, mc:5, lmin:19, lmax:22, exp:490,  gold:240, w:12, h:10, base:'stone' },
        { n:10, name:'세키가하라 전야',   desc:'천하 분수령의 전야',               boss:0, mc:5, lmin:19, lmax:22, exp:510,  gold:250, w:12, h:10, base:'grass' },
        { n:11, name:'세키가하라 결전',   desc:'동군 vs 서군 천하 결전',           boss:0, mc:5, lmin:20, lmax:22, exp:530,  gold:260, w:12, h:10, base:'grass' },
        { n:12, name:'오사카 여름 진',    desc:'도요토미 가문 최후의 전투',         boss:0, mc:5, lmin:20, lmax:22, exp:550,  gold:270, w:12, h:10, base:'stone' },
        { n:13, name:'오다 노부나가 결전',desc:'제6천마왕의 최종 시련',             boss:1, mc:6, lmin:21, lmax:22, exp:900,  gold:450, w:14, h:12, base:'dark' },
      ],
      'edo': [
        { n:1,  name:'에도성 입구',       desc:'도쿠가와의 거대 성곽',             boss:0, mc:3, lmin:19, lmax:21, exp:420,  gold:210, w:10, h:10, base:'stone' },
        { n:2,  name:'닛코 도쇼궁',       desc:'이에야스의 영묘',                  boss:0, mc:3, lmin:19, lmax:21, exp:440,  gold:215, w:10, h:10, base:'stone' },
        { n:3,  name:'요시와라 거리',     desc:'환락가의 야간 전투',               boss:0, mc:4, lmin:20, lmax:22, exp:460,  gold:225, w:10, h:10, base:'stone' },
        { n:4,  name:'충신장 저택',       desc:'47인의 낭인 습격',                boss:0, mc:4, lmin:20, lmax:22, exp:480,  gold:235, w:10, h:10, base:'stone' },
        { n:5,  name:'시마바라 전투',     desc:'기독교도 봉기의 전장',             boss:0, mc:4, lmin:20, lmax:23, exp:500,  gold:245, w:10, h:10, base:'stone' },
        { n:6,  name:'데지마 무역관',     desc:'네덜란드 무역의 거점',             boss:0, mc:4, lmin:21, lmax:23, exp:520,  gold:255, w:10, h:10, base:'stone' },
        { n:7,  name:'오쿠노호소미치',    desc:'바쇼의 여행길 전투',               boss:0, mc:4, lmin:21, lmax:24, exp:540,  gold:265, w:10, h:10, base:'grass' },
        { n:8,  name:'페리 내항',         desc:'흑선 쇼크의 전장',                boss:0, mc:5, lmin:22, lmax:24, exp:560,  gold:275, w:10, h:10, base:'stone' },
        { n:9,  name:'사쿠라다 문외',     desc:'대로 이이 암살 현장',              boss:0, mc:5, lmin:22, lmax:25, exp:580,  gold:285, w:12, h:10, base:'stone' },
        { n:10, name:'이케다야 사건',     desc:'신선조 습격 사건',                boss:0, mc:5, lmin:22, lmax:25, exp:600,  gold:295, w:12, h:10, base:'stone' },
        { n:11, name:'도바 후시미',       desc:'보신전쟁의 서막',                 boss:0, mc:5, lmin:23, lmax:25, exp:620,  gold:305, w:12, h:10, base:'grass' },
        { n:12, name:'하코다테 전투',     desc:'막부군 최후의 항전',               boss:0, mc:5, lmin:23, lmax:25, exp:650,  gold:320, w:12, h:10, base:'stone' },
        { n:13, name:'에도 무혈개성',     desc:'막부 종말의 전장',                boss:0, mc:5, lmin:24, lmax:25, exp:680,  gold:335, w:12, h:10, base:'stone' },
        { n:14, name:'미야모토 무사시',   desc:'최강 검객의 최종 결전',            boss:1, mc:6, lmin:25, lmax:25, exp:1100, gold:550, w:14, h:14, base:'stone' },
      ],
      'meiji': [
        { n:1,  name:'메이지 궁',         desc:'근대화의 상징',                   boss:0, mc:3, lmin:22, lmax:24, exp:500,  gold:250, w:10, h:10, base:'stone' },
        { n:2,  name:'사이고의 거병',     desc:'세이난 전쟁의 시작',               boss:0, mc:3, lmin:22, lmax:24, exp:520,  gold:260, w:10, h:10, base:'grass' },
        { n:3,  name:'시로야마 전투',     desc:'사이고 다카모리 최후',             boss:0, mc:4, lmin:23, lmax:25, exp:545,  gold:270, w:10, h:10, base:'stone' },
        { n:4,  name:'동경 거리',         desc:'서구화 물결의 도시',               boss:0, mc:4, lmin:23, lmax:25, exp:565,  gold:280, w:10, h:10, base:'stone' },
        { n:5,  name:'청일전쟁 진지',     desc:'대륙 진출의 전장',                boss:0, mc:4, lmin:24, lmax:26, exp:590,  gold:295, w:10, h:10, base:'grass' },
        { n:6,  name:'뤼순 요새',         desc:'러일전쟁의 격전지',               boss:0, mc:4, lmin:24, lmax:26, exp:610,  gold:305, w:10, h:10, base:'stone' },
        { n:7,  name:'쓰시마 해전',       desc:'연합함대의 해전',                 boss:0, mc:5, lmin:24, lmax:27, exp:635,  gold:315, w:10, h:10, base:'stone' },
        { n:8,  name:'다이쇼 데모크라시', desc:'대정 민주주의의 전장',             boss:0, mc:5, lmin:25, lmax:27, exp:660,  gold:330, w:10, h:10, base:'stone' },
        { n:9,  name:'관동대지진',        desc:'재난 속의 혼란',                  boss:0, mc:5, lmin:25, lmax:28, exp:685,  gold:340, w:12, h:10, base:'dark' },
        { n:10, name:'2·26 사건',         desc:'청년 장교의 반란',                boss:0, mc:5, lmin:25, lmax:28, exp:710,  gold:355, w:12, h:10, base:'stone' },
        { n:11, name:'대본영',           desc:'군국주의의 심장부',                boss:0, mc:5, lmin:26, lmax:28, exp:740,  gold:370, w:12, h:10, base:'stone' },
        { n:12, name:'히로시마 전야',     desc:'종전 직전의 전투',                boss:0, mc:5, lmin:26, lmax:28, exp:770,  gold:385, w:12, h:10, base:'dark' },
        { n:13, name:'옥음방송',          desc:'항복 직전의 최후 전투',            boss:0, mc:6, lmin:27, lmax:28, exp:800,  gold:400, w:12, h:12, base:'stone' },
        { n:14, name:'사이고 다카모리',   desc:'마지막 사무라이의 결전',            boss:0, mc:6, lmin:27, lmax:28, exp:840,  gold:420, w:12, h:12, base:'stone' },
        { n:15, name:'일본 역사 최종전',  desc:'일본 역사의 모든 힘이 모인 결전',   boss:1, mc:6, lmin:28, lmax:28, exp:1800, gold:900, w:14, h:14, base:'dark' },
      ],
      // ========== 중국 스테이지 ==========
      'xia_shang': [
        { n:1,  name:'하왕조 도읍',       desc:'대우가 세운 최초의 왕조',          boss:0, mc:2, lmin:1,  lmax:2,  exp:80,   gold:40,  w:8,  h:8,  base:'grass' },
        { n:2,  name:'은허 유적',         desc:'갑골문자가 발견된 상나라 수도',     boss:0, mc:2, lmin:1,  lmax:2,  exp:90,   gold:45,  w:8,  h:8,  base:'stone' },
        { n:3,  name:'청동기 제단',       desc:'제사에 쓰인 청동 예기의 전장',     boss:0, mc:3, lmin:1,  lmax:3,  exp:100,  gold:50,  w:9,  h:9,  base:'stone' },
        { n:4,  name:'무정의 원정',       desc:'상나라 무정 왕의 전쟁',            boss:0, mc:3, lmin:2,  lmax:3,  exp:110,  gold:55,  w:9,  h:8,  base:'grass' },
        { n:5,  name:'사모무 대정',       desc:'거대 청동 솥의 수호',              boss:0, mc:3, lmin:2,  lmax:4,  exp:120,  gold:60,  w:10, h:8,  base:'stone' },
        { n:6,  name:'달기의 궁전',       desc:'요녀 달기의 마법 궁전',            boss:0, mc:3, lmin:2,  lmax:4,  exp:130,  gold:65,  w:10, h:9,  base:'dark' },
        { n:7,  name:'조가성',            desc:'상나라 수도의 방어',               boss:0, mc:4, lmin:3,  lmax:5,  exp:140,  gold:70,  w:10, h:10, base:'stone' },
        { n:8,  name:'목야 전야',         desc:'주 무왕의 출전 전야',              boss:0, mc:4, lmin:3,  lmax:5,  exp:155,  gold:75,  w:10, h:10, base:'grass' },
        { n:9,  name:'봉신대',            desc:'신들을 봉인하는 전장',             boss:0, mc:4, lmin:3,  lmax:5,  exp:170,  gold:80,  w:10, h:10, base:'dark' },
        { n:10, name:'주왕의 최후',       desc:'상나라 멸망의 결전',               boss:1, mc:5, lmin:4,  lmax:6,  exp:250,  gold:120, w:12, h:12, base:'dark' },
      ],
      'zhou': [
        { n:1,  name:'호경 도읍',         desc:'서주의 수도',                     boss:0, mc:2, lmin:3,  lmax:4,  exp:100,  gold:50,  w:8,  h:8,  base:'stone' },
        { n:2,  name:'봉화대',            desc:'봉화를 올린 포사의 전장',          boss:0, mc:3, lmin:3,  lmax:5,  exp:110,  gold:55,  w:8,  h:9,  base:'stone' },
        { n:3,  name:'낙읍 천도',         desc:'동주로의 천도',                   boss:0, mc:3, lmin:4,  lmax:5,  exp:120,  gold:60,  w:9,  h:9,  base:'stone' },
        { n:4,  name:'제환공의 회맹',     desc:'첫 번째 패자의 전장',              boss:0, mc:3, lmin:4,  lmax:6,  exp:130,  gold:65,  w:10, h:9,  base:'grass' },
        { n:5,  name:'진문공의 전장',     desc:'19년 유랑 끝의 복귀',              boss:0, mc:3, lmin:4,  lmax:6,  exp:140,  gold:70,  w:10, h:10, base:'grass' },
        { n:6,  name:'오월동주',          desc:'오나라와 월나라의 쟁패',            boss:0, mc:4, lmin:5,  lmax:7,  exp:155,  gold:75,  w:10, h:10, base:'grass' },
        { n:7,  name:'손자병법 연무장',   desc:'손자가 훈련한 전장',               boss:0, mc:4, lmin:5,  lmax:7,  exp:170,  gold:80,  w:10, h:10, base:'grass' },
        { n:8,  name:'장평 전야',         desc:'장평대전 직전의 전투',              boss:0, mc:4, lmin:5,  lmax:8,  exp:185,  gold:90,  w:10, h:10, base:'stone' },
        { n:9,  name:'합종연횡',          desc:'종횡가들의 책략 전장',              boss:0, mc:4, lmin:6,  lmax:8,  exp:200,  gold:95,  w:10, h:10, base:'grass' },
        { n:10, name:'제자백가 결전',     desc:'사상가들의 힘이 모인 결전',         boss:1, mc:5, lmin:6,  lmax:9,  exp:300,  gold:150, w:12, h:12, base:'grass' },
      ],
      'qin': [
        { n:1,  name:'함양 궁전',         desc:'진나라 수도의 궁전',               boss:0, mc:3, lmin:5,  lmax:7,  exp:140,  gold:70,  w:9,  h:9,  base:'stone' },
        { n:2,  name:'만리장성 공사장',   desc:'장성 건설 현장의 전투',             boss:0, mc:3, lmin:5,  lmax:7,  exp:150,  gold:75,  w:9,  h:9,  base:'stone' },
        { n:3,  name:'분서갱유',          desc:'사상 탄압의 현장',                boss:0, mc:3, lmin:6,  lmax:8,  exp:165,  gold:80,  w:10, h:10, base:'dark' },
        { n:4,  name:'아방궁',            desc:'거대한 궁전의 전투',               boss:0, mc:3, lmin:6,  lmax:8,  exp:175,  gold:85,  w:10, h:10, base:'stone' },
        { n:5,  name:'형가의 암살',       desc:'자객 형가의 전장',                boss:0, mc:4, lmin:7,  lmax:9,  exp:190,  gold:90,  w:10, h:10, base:'stone' },
        { n:6,  name:'영정 통일전',       desc:'6국을 멸한 통일 전쟁',             boss:0, mc:4, lmin:7,  lmax:9,  exp:205,  gold:95,  w:10, h:10, base:'grass' },
        { n:7,  name:'직도 행군',         desc:'시황제의 군사 도로',               boss:0, mc:4, lmin:7,  lmax:10, exp:220,  gold:100, w:10, h:10, base:'grass' },
        { n:8,  name:'진시황릉',          desc:'시황제의 지하 궁전',               boss:0, mc:4, lmin:8,  lmax:10, exp:235,  gold:110, w:10, h:10, base:'dark' },
        { n:9,  name:'대택향 봉기',       desc:'진승오광의 반란',                  boss:0, mc:4, lmin:8,  lmax:11, exp:250,  gold:115, w:10, h:10, base:'grass' },
        { n:10, name:'초한쟁패 전야',     desc:'유방과 항우의 결전 전야',           boss:0, mc:5, lmin:8,  lmax:11, exp:280,  gold:125, w:12, h:10, base:'grass' },
        { n:11, name:'홍문의 연회',       desc:'위기일발의 연회장',                boss:0, mc:5, lmin:9,  lmax:11, exp:310,  gold:135, w:12, h:10, base:'stone' },
        { n:12, name:'병마용 결전',       desc:'8천 병마용의 최종 시련',            boss:1, mc:6, lmin:9,  lmax:11, exp:400,  gold:200, w:12, h:12, base:'stone' },
      ],
      'han': [
        { n:1,  name:'장안 도읍',         desc:'한 고조 유방의 수도',              boss:0, mc:3, lmin:7,  lmax:9,  exp:170,  gold:85,  w:9,  h:9,  base:'stone' },
        { n:2,  name:'초한 전장',         desc:'해하 전투의 재현',                boss:0, mc:3, lmin:7,  lmax:9,  exp:180,  gold:90,  w:9,  h:9,  base:'grass' },
        { n:3,  name:'흉노 접경',         desc:'북방 유목민과의 전투',             boss:0, mc:3, lmin:8,  lmax:10, exp:195,  gold:95,  w:10, h:10, base:'grass' },
        { n:4,  name:'장건의 서역',       desc:'실크로드 개척의 전장',             boss:0, mc:3, lmin:8,  lmax:10, exp:205,  gold:100, w:10, h:10, base:'dirt' },
        { n:5,  name:'무제의 원정',       desc:'한 무제의 흉노 원정',              boss:0, mc:4, lmin:8,  lmax:11, exp:220,  gold:105, w:10, h:10, base:'grass' },
        { n:6,  name:'왕망의 신',         desc:'신나라의 혼란',                   boss:0, mc:4, lmin:9,  lmax:11, exp:235,  gold:110, w:10, h:10, base:'stone' },
        { n:7,  name:'적미군 봉기',       desc:'농민 반란의 전장',                boss:0, mc:4, lmin:9,  lmax:12, exp:250,  gold:120, w:10, h:10, base:'grass' },
        { n:8,  name:'낙양 궁전',         desc:'후한의 수도 방어',                boss:0, mc:4, lmin:9,  lmax:12, exp:265,  gold:125, w:10, h:10, base:'stone' },
        { n:9,  name:'황건의 난',         desc:'태평도 봉기의 전장',               boss:0, mc:5, lmin:10, lmax:13, exp:280,  gold:135, w:12, h:10, base:'grass' },
        { n:10, name:'한신의 결전',       desc:'국사무쌍 한신의 시련',              boss:1, mc:5, lmin:10, lmax:13, exp:420,  gold:210, w:12, h:12, base:'grass' },
      ],
      'three_kingdoms': [
        { n:1,  name:'도원결의',          desc:'유비·관우·장비의 맹세',             boss:0, mc:3, lmin:9,  lmax:11, exp:200,  gold:100, w:9,  h:9,  base:'grass' },
        { n:2,  name:'호로관 전투',       desc:'여포의 돌진',                     boss:0, mc:3, lmin:9,  lmax:11, exp:210,  gold:105, w:9,  h:9,  base:'stone' },
        { n:3,  name:'관도대전',          desc:'조조 vs 원소의 결전',              boss:0, mc:3, lmin:10, lmax:12, exp:225,  gold:110, w:10, h:10, base:'grass' },
        { n:4,  name:'삼고초려',          desc:'제갈량을 찾아가는 전장',            boss:0, mc:3, lmin:10, lmax:12, exp:235,  gold:115, w:10, h:10, base:'grass' },
        { n:5,  name:'적벽대전',          desc:'화공으로 조조 대군을 격파',         boss:0, mc:4, lmin:10, lmax:13, exp:250,  gold:120, w:10, h:10, base:'stone' },
        { n:6,  name:'형주 쟁탈',         desc:'삼국이 뒤엉킨 요충지',             boss:0, mc:4, lmin:11, lmax:13, exp:265,  gold:130, w:10, h:10, base:'grass' },
        { n:7,  name:'한중 공방',         desc:'유비의 한중왕 등극전',             boss:0, mc:4, lmin:11, lmax:14, exp:280,  gold:135, w:10, h:10, base:'stone' },
        { n:8,  name:'이릉 전투',         desc:'유비의 복수전',                   boss:0, mc:4, lmin:11, lmax:14, exp:295,  gold:140, w:10, h:10, base:'grass' },
        { n:9,  name:'출사표',            desc:'제갈량의 북벌 전장',               boss:0, mc:5, lmin:12, lmax:15, exp:310,  gold:150, w:12, h:10, base:'grass' },
        { n:10, name:'오장원',            desc:'제갈량 최후의 전장',               boss:0, mc:5, lmin:12, lmax:15, exp:330,  gold:155, w:12, h:10, base:'grass' },
        { n:11, name:'사마의의 대두',     desc:'삼국 통일의 서막',                 boss:0, mc:5, lmin:13, lmax:15, exp:350,  gold:165, w:12, h:10, base:'stone' },
        { n:12, name:'여포 결전',         desc:'삼국 최강 무장의 시련',             boss:1, mc:6, lmin:13, lmax:15, exp:500,  gold:250, w:12, h:12, base:'grass' },
      ],
      'tang': [
        { n:1,  name:'장안 성문',         desc:'세계 최대 도시의 입구',             boss:0, mc:3, lmin:11, lmax:13, exp:240,  gold:120, w:9,  h:9,  base:'stone' },
        { n:2,  name:'현무문의 변',       desc:'태종의 쿠데타 현장',               boss:0, mc:3, lmin:11, lmax:13, exp:255,  gold:125, w:10, h:10, base:'stone' },
        { n:3,  name:'정관의 치',         desc:'태평성대의 시련',                  boss:0, mc:3, lmin:12, lmax:14, exp:270,  gold:130, w:10, h:10, base:'stone' },
        { n:4,  name:'서역 원정',         desc:'서돌궐 정벌의 전장',               boss:0, mc:4, lmin:12, lmax:14, exp:285,  gold:140, w:10, h:10, base:'dirt' },
        { n:5,  name:'측천무후 궁전',     desc:'여황제의 궁전 전투',               boss:0, mc:4, lmin:12, lmax:15, exp:300,  gold:145, w:10, h:10, base:'stone' },
        { n:6,  name:'현종의 화청궁',     desc:'양귀비와 현종의 전장',              boss:0, mc:4, lmin:13, lmax:15, exp:315,  gold:155, w:10, h:10, base:'stone' },
        { n:7,  name:'안사의 난',         desc:'안록산의 대반란',                  boss:0, mc:4, lmin:13, lmax:16, exp:330,  gold:160, w:10, h:10, base:'grass' },
        { n:8,  name:'마외역의 비극',     desc:'양귀비의 비극이 서린 역참',         boss:0, mc:5, lmin:14, lmax:16, exp:350,  gold:170, w:10, h:10, base:'stone' },
        { n:9,  name:'황소의 난',         desc:'농민 반란의 불길',                 boss:0, mc:5, lmin:14, lmax:17, exp:370,  gold:180, w:12, h:10, base:'grass' },
        { n:10, name:'당 최후의 전투',    desc:'대제국의 멸망',                    boss:1, mc:6, lmin:15, lmax:17, exp:550,  gold:275, w:12, h:12, base:'stone' },
      ],
      'song': [
        { n:1,  name:'개봉 도성',         desc:'북송의 번화한 수도',               boss:0, mc:3, lmin:13, lmax:15, exp:280,  gold:140, w:9,  h:9,  base:'stone' },
        { n:2,  name:'양가장 전투',       desc:'양가장 무인의 전장',               boss:0, mc:3, lmin:13, lmax:15, exp:295,  gold:145, w:10, h:10, base:'grass' },
        { n:3,  name:'왕안석 변법',       desc:'개혁의 전장',                     boss:0, mc:3, lmin:14, lmax:16, exp:310,  gold:155, w:10, h:10, base:'stone' },
        { n:4,  name:'청명상하도',        desc:'그림 속 도시의 전투',               boss:0, mc:4, lmin:14, lmax:16, exp:330,  gold:160, w:10, h:10, base:'stone' },
        { n:5,  name:'악비의 북벌',       desc:'정충보국의 전장',                  boss:0, mc:4, lmin:14, lmax:17, exp:345,  gold:170, w:10, h:10, base:'grass' },
        { n:6,  name:'정강의 변',         desc:'금나라 침공의 전장',               boss:0, mc:4, lmin:15, lmax:17, exp:360,  gold:175, w:10, h:10, base:'stone' },
        { n:7,  name:'임안 행재소',       desc:'남송의 임시 수도',                boss:0, mc:4, lmin:15, lmax:18, exp:380,  gold:185, w:10, h:10, base:'stone' },
        { n:8,  name:'양양 공방',         desc:'6년간의 대공성전',                boss:0, mc:5, lmin:16, lmax:18, exp:400,  gold:195, w:10, h:10, base:'stone' },
        { n:9,  name:'교지 원정',         desc:'남방 원정의 전장',                boss:0, mc:5, lmin:16, lmax:19, exp:420,  gold:205, w:12, h:10, base:'grass' },
        { n:10, name:'애산 해전',         desc:'남송 최후의 해전',                boss:0, mc:5, lmin:16, lmax:19, exp:440,  gold:210, w:12, h:10, base:'stone' },
        { n:11, name:'문천상의 결의',     desc:'충신의 마지막 저항',               boss:0, mc:5, lmin:17, lmax:19, exp:460,  gold:220, w:12, h:10, base:'stone' },
        { n:12, name:'악비 결전',         desc:'민족 영웅 악비의 최종 시련',        boss:1, mc:6, lmin:18, lmax:19, exp:650,  gold:325, w:14, h:12, base:'grass' },
      ],
      'yuan': [
        { n:1,  name:'대도(베이징)',      desc:'쿠빌라이의 수도',                 boss:0, mc:3, lmin:16, lmax:18, exp:350,  gold:175, w:10, h:10, base:'stone' },
        { n:2,  name:'초원의 진격',       desc:'몽골 기마대의 돌진',               boss:0, mc:3, lmin:16, lmax:18, exp:365,  gold:180, w:10, h:10, base:'grass' },
        { n:3,  name:'서하 정벌',         desc:'서하 멸망의 전장',                boss:0, mc:4, lmin:17, lmax:19, exp:380,  gold:190, w:10, h:10, base:'grass' },
        { n:4,  name:'금 멸망전',         desc:'여진 금나라 최후',                boss:0, mc:4, lmin:17, lmax:19, exp:400,  gold:195, w:10, h:10, base:'stone' },
        { n:5,  name:'바그다드 공성',     desc:'아바스 왕조 멸망의 전장',           boss:0, mc:4, lmin:17, lmax:20, exp:415,  gold:205, w:10, h:10, base:'stone' },
        { n:6,  name:'카미카제(신풍)',    desc:'일본 침공의 전장',                boss:0, mc:4, lmin:18, lmax:20, exp:430,  gold:210, w:10, h:10, base:'stone' },
        { n:7,  name:'대운하',            desc:'대운하 위의 해상 전투',            boss:0, mc:4, lmin:18, lmax:21, exp:450,  gold:220, w:10, h:10, base:'water' },
        { n:8,  name:'마르코 폴로의 길',  desc:'동서 교역로의 전장',               boss:0, mc:5, lmin:19, lmax:21, exp:470,  gold:230, w:10, h:10, base:'stone' },
        { n:9,  name:'홍건적의 난',       desc:'원나라 말기 농민 반란',             boss:0, mc:5, lmin:19, lmax:22, exp:490,  gold:240, w:12, h:10, base:'grass' },
        { n:10, name:'칭기즈칸 결전',     desc:'대정복자의 최종 시련',              boss:1, mc:6, lmin:20, lmax:22, exp:900,  gold:450, w:14, h:12, base:'grass' },
      ],
      'ming': [
        { n:1,  name:'응천부(난징)',      desc:'주원장의 수도',                   boss:0, mc:3, lmin:19, lmax:21, exp:420,  gold:210, w:10, h:10, base:'stone' },
        { n:2,  name:'북경 천도',         desc:'영락제의 새 수도',                boss:0, mc:3, lmin:19, lmax:21, exp:440,  gold:215, w:10, h:10, base:'stone' },
        { n:3,  name:'자금성',            desc:'황제의 궁전 전투',                boss:0, mc:4, lmin:20, lmax:22, exp:460,  gold:225, w:10, h:10, base:'stone' },
        { n:4,  name:'정화의 항해',       desc:'대항해 원정의 전장',               boss:0, mc:4, lmin:20, lmax:22, exp:480,  gold:235, w:10, h:10, base:'stone' },
        { n:5,  name:'토목의 변',         desc:'오이라트에 황제가 포로',            boss:0, mc:4, lmin:20, lmax:23, exp:500,  gold:245, w:10, h:10, base:'grass' },
        { n:6,  name:'만리장성 방어',     desc:'북방 유목민 침입 방어',             boss:0, mc:4, lmin:21, lmax:23, exp:520,  gold:255, w:10, h:10, base:'stone' },
        { n:7,  name:'왜구 소탕',         desc:'척계광의 왜구 토벌',               boss:0, mc:4, lmin:21, lmax:24, exp:540,  gold:265, w:10, h:10, base:'stone' },
        { n:8,  name:'임진왜란 참전',     desc:'조선 구원의 원정',                boss:0, mc:5, lmin:22, lmax:24, exp:560,  gold:275, w:10, h:10, base:'grass' },
        { n:9,  name:'이자성 봉기',       desc:'농민 반란의 불꽃',                boss:0, mc:5, lmin:22, lmax:25, exp:580,  gold:285, w:12, h:10, base:'grass' },
        { n:10, name:'산해관 전투',       desc:'오삼계의 결단',                   boss:0, mc:5, lmin:22, lmax:25, exp:600,  gold:295, w:12, h:10, base:'stone' },
        { n:11, name:'정성공 해전',       desc:'대만 탈환의 해전',                boss:0, mc:5, lmin:23, lmax:25, exp:620,  gold:305, w:12, h:10, base:'stone' },
        { n:12, name:'자금성 함락',       desc:'명 왕조 최후의 날',               boss:0, mc:5, lmin:23, lmax:25, exp:650,  gold:320, w:12, h:10, base:'stone' },
        { n:13, name:'영락제의 북벌',     desc:'영락대제의 몽골 원정',             boss:0, mc:5, lmin:24, lmax:25, exp:680,  gold:335, w:12, h:10, base:'grass' },
        { n:14, name:'주원장 결전',       desc:'걸인에서 황제까지, 창업자의 시련',   boss:1, mc:6, lmin:25, lmax:25, exp:1100, gold:550, w:14, h:14, base:'stone' },
      ],
      'qing': [
        { n:1,  name:'심양 궁전',         desc:'후금의 수도',                     boss:0, mc:3, lmin:22, lmax:24, exp:500,  gold:250, w:10, h:10, base:'stone' },
        { n:2,  name:'산해관 통과',       desc:'만주족의 중원 진출',               boss:0, mc:3, lmin:22, lmax:24, exp:520,  gold:260, w:10, h:10, base:'stone' },
        { n:3,  name:'강희제 친정',       desc:'삼번의 난 진압',                  boss:0, mc:4, lmin:23, lmax:25, exp:545,  gold:270, w:10, h:10, base:'grass' },
        { n:4,  name:'건륭제 남순',       desc:'전성기의 순행 전장',               boss:0, mc:4, lmin:23, lmax:25, exp:565,  gold:280, w:10, h:10, base:'stone' },
        { n:5,  name:'아편전쟁',          desc:'영국과의 충돌',                   boss:0, mc:4, lmin:24, lmax:26, exp:590,  gold:295, w:10, h:10, base:'stone' },
        { n:6,  name:'태평천국',          desc:'홍수전의 난',                     boss:0, mc:4, lmin:24, lmax:26, exp:610,  gold:305, w:10, h:10, base:'grass' },
        { n:7,  name:'양무운동',          desc:'근대화 시도의 전장',               boss:0, mc:5, lmin:24, lmax:27, exp:635,  gold:315, w:10, h:10, base:'stone' },
        { n:8,  name:'무술변법',          desc:'100일 개혁의 전장',                boss:0, mc:5, lmin:25, lmax:27, exp:660,  gold:330, w:10, h:10, base:'stone' },
        { n:9,  name:'의화단 사건',       desc:'반외세 봉기의 전장',               boss:0, mc:5, lmin:25, lmax:28, exp:685,  gold:340, w:12, h:10, base:'stone' },
        { n:10, name:'신해혁명 전야',     desc:'왕조 붕괴의 전장',                boss:0, mc:5, lmin:25, lmax:28, exp:710,  gold:355, w:12, h:10, base:'stone' },
        { n:11, name:'무창 봉기',         desc:'혁명의 첫 총성',                  boss:0, mc:5, lmin:26, lmax:28, exp:740,  gold:370, w:12, h:10, base:'stone' },
        { n:12, name:'자금성 퇴위',       desc:'마지막 황제의 퇴위',               boss:0, mc:5, lmin:26, lmax:28, exp:770,  gold:385, w:12, h:10, base:'stone' },
        { n:13, name:'손문의 결의',       desc:'공화국 건국의 전투',               boss:0, mc:6, lmin:27, lmax:28, exp:800,  gold:400, w:12, h:12, base:'stone' },
        { n:14, name:'누르하치의 굴기',   desc:'만주족 창업자의 전투',              boss:0, mc:6, lmin:27, lmax:28, exp:840,  gold:420, w:12, h:12, base:'stone' },
        { n:15, name:'중국 역사 최종전',  desc:'중국 역사의 모든 힘이 모인 결전',   boss:1, mc:6, lmin:28, lmax:28, exp:1800, gold:900, w:14, h:14, base:'dark' },
      ],
    };

    for (const [groupKey, stages] of Object.entries(jpCnStageData)) {
      const groupId = newGMap[groupKey];
      if (!groupId) continue;
      const dungeonKey = newGroupDungeonMap[groupKey] || 'forest';

      for (const s of stages) {
        const tileOverrides = generateMapOverrides(s.w, s.h, s.base, s.n, !!s.boss);
        const pSpawns = generateSpawns(s.w, s.h, 'player', Math.min(4, s.mc));
        const mSpawns = generateSpawns(s.w, s.h, 'monster', s.mc);

        await pool.query(
          `INSERT IGNORE INTO stage_levels
           (group_id, stage_number, name, description, is_boss, monster_count,
            monster_level_min, monster_level_max, reward_exp, reward_gold,
            dungeon_key, map_width, map_height, base_tile_type,
            tile_overrides, player_spawns, monster_spawns)
           VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
          [groupId, s.n, s.name, s.desc, s.boss, s.mc,
           s.lmin, s.lmax, s.exp, s.gold,
           dungeonKey, s.w, s.h, s.base,
           JSON.stringify(tileOverrides), JSON.stringify(pSpawns), JSON.stringify(mSpawns)]
        );
      }
    }
  }

  // 일본/중국 스테이지 그룹 마이그레이션 (기존 한국만 있는 DB에 추가)
  const [jpCheck] = await pool.query("SELECT COUNT(*) as cnt FROM stage_groups WHERE country = 'japan'");
  if (jpCheck[0].cnt === 0) {
    // 기존 한국 그룹에 country 업데이트
    await pool.query("UPDATE stage_groups SET country = 'korea' WHERE country IS NULL OR country = ''").catch(() => {});

    const newGroups = [
      ['jomon',      '조몬',       '토기 문화의 여명, 고대 일본의 시작',              '🏺', '조몬시대 (BC 14000)', 1,  11, '#1a1e2e', 'japan'],
      ['yayoi',      '야요이',     '벼농사와 철기가 전래된 새 시대',                  '🌾', '야요이시대',         3,  12, '#1e2e1a', 'japan'],
      ['yamato',     '야마토',     '일본 통일 왕조의 탄생',                          '⛩️', '야마토시대',         5,  13, '#2e1e1a', 'japan'],
      ['nara',       '나라',       '불교와 율령 국가의 전성기',                      '🏛️', '나라시대',           7,  14, '#2e1a1e', 'japan'],
      ['heian',      '헤이안',     '귀족 문화가 꽃핀 우아한 시대',                   '🌸', '헤이안시대',         9,  15, '#1e1a2e', 'japan'],
      ['kamakura',   '가마쿠라',   '무사 정권의 시작, 사무라이의 시대',               '⚔️', '가마쿠라시대',       11, 16, '#2e0e0e', 'japan'],
      ['muromachi',  '무로마치',   '남북조의 혼란과 무사 문화',                      '🏯', '무로마치시대',       13, 17, '#0e2e1e', 'japan'],
      ['sengoku',    '전국시대',   '천하통일을 향한 영웅들의 전쟁',                   '🔥', '전국시대',           16, 18, '#2e0e1a', 'japan'],
      ['edo',        '에도',       '도쿠가와 막부의 태평성대',                       '🎎', '에도시대',           19, 19, '#1e1a0e', 'japan'],
      ['meiji',      '메이지',     '개혁과 근대화의 격변기',                         '⚡', '메이지시대',         22, 20, '#0e1a2e', 'japan'],
      ['xia_shang',  '하·상',      '중화 문명의 여명, 청동기의 시대',                '🐉', '하·상 (BC 2070)',    1,  21, '#2e1e0e', 'china'],
      ['zhou',       '주',         '봉건제와 제자백가의 시대',                       '📜', '주나라',             3,  22, '#0e1e2e', 'china'],
      ['qin',        '진',         '시황제의 천하통일 제국',                         '🏰', '진나라',             5,  23, '#2e0e0e', 'china'],
      ['han',        '한',         '유방의 대한제국 400년',                          '🐎', '한나라',             7,  24, '#2e1a0e', 'china'],
      ['three_kingdoms','삼국',    '위·촉·오 영웅들의 시대',                         '⚔️', '삼국시대',           9,  25, '#1e2e0e', 'china'],
      ['tang',       '당',         '세계 최대 제국, 찬란한 문화',                    '👑', '당나라',             11, 26, '#2e1e1e', 'china'],
      ['song',       '송',         '문치주의와 과학 기술의 황금기',                   '🧭', '송나라',             13, 27, '#0e2e2e', 'china'],
      ['yuan',       '원',         '몽골 대제국의 중원 정복',                        '🏹', '원나라',             16, 28, '#1a0e2e', 'china'],
      ['ming',       '명',         '한족의 부흥, 정화의 대항해',                     '⛵', '명나라',             19, 29, '#2e0e1e', 'china'],
      ['qing',       '청',         '만주족의 마지막 왕조',                           '🐲', '청나라',             22, 30, '#1e0e2e', 'china'],
    ];

    for (const [key, name, desc, icon, era, lvl, order, bg, country] of newGroups) {
      await pool.query(
        'INSERT IGNORE INTO stage_groups (key_name, name, description, icon, era, required_level, display_order, bg_color, country) VALUES (?,?,?,?,?,?,?,?,?)',
        [key, name, desc, icon, era, lvl, order, bg, country]
      );
    }

    // 새 그룹의 스테이지 레벨 삽입 (stageData에서 일본/중국 키만)
    const [newGRows] = await pool.query("SELECT id, key_name FROM stage_groups WHERE country IN ('japan','china') ORDER BY display_order");
    const newGMap = {};
    for (const g of newGRows) newGMap[g.key_name] = g.id;

    const newGroupDungeonMap = {
      'jomon':'forest','yayoi':'slime_cave','yamato':'cave','nara':'temple','heian':'spirit_forest',
      'kamakura':'mountain','muromachi':'swamp','sengoku':'demon','edo':'goblin','meiji':'dragon',
      'xia_shang':'forest','zhou':'cave','qin':'mountain','han':'slime_cave','three_kingdoms':'swamp',
      'tang':'temple','song':'spirit_forest','yuan':'demon','ming':'goblin','qing':'dragon',
    };

    // stageData는 위에서 이미 정의됨 — 재정의 필요
    const jpCnStageData = {
      'jomon': [
        { n:1,name:'토기의 마을',desc:'조몬 토기가 탄생한 원시 마을',boss:0,mc:2,lmin:1,lmax:2,exp:80,gold:40,w:8,h:8,base:'grass' },
        { n:2,name:'패총 유적',desc:'조개더미 아래의 고대 유적',boss:0,mc:2,lmin:1,lmax:2,exp:90,gold:45,w:8,h:8,base:'grass' },
        { n:3,name:'수렵의 숲',desc:'사슴과 멧돼지를 쫓던 숲',boss:0,mc:3,lmin:1,lmax:3,exp:100,gold:50,w:9,h:9,base:'grass' },
        { n:4,name:'환상 열도',desc:'화산섬의 원시 전장',boss:0,mc:3,lmin:2,lmax:3,exp:110,gold:55,w:9,h:8,base:'stone' },
        { n:5,name:'흑요석 광산',desc:'석기 재료를 캐는 광산',boss:0,mc:3,lmin:2,lmax:4,exp:120,gold:60,w:10,h:8,base:'stone' },
        { n:6,name:'해안 동굴',desc:'바다 옆 동굴의 비밀',boss:0,mc:3,lmin:2,lmax:4,exp:130,gold:65,w:10,h:9,base:'stone' },
        { n:7,name:'산나이마루야마',desc:'거대 취락 유적의 전장',boss:0,mc:4,lmin:3,lmax:5,exp:140,gold:70,w:10,h:10,base:'grass' },
        { n:8,name:'석인상의 언덕',desc:'돌 조각상이 지키는 언덕',boss:0,mc:4,lmin:3,lmax:5,exp:155,gold:75,w:10,h:10,base:'stone' },
        { n:9,name:'화산 분화구',desc:'지열이 솟아오르는 위험 지대',boss:0,mc:4,lmin:3,lmax:5,exp:170,gold:80,w:10,h:10,base:'stone' },
        { n:10,name:'토우의 시련',desc:'조몬 수호신의 최종 시험',boss:1,mc:5,lmin:4,lmax:6,exp:250,gold:120,w:12,h:12,base:'grass' },
      ],
      'yayoi': [
        { n:1,name:'요시노가리',desc:'환호 취락의 방어전',boss:0,mc:2,lmin:3,lmax:4,exp:100,gold:50,w:8,h:8,base:'grass' },
        { n:2,name:'벼의 평야',desc:'벼농사가 시작된 평야',boss:0,mc:3,lmin:3,lmax:5,exp:110,gold:55,w:8,h:9,base:'grass' },
        { n:3,name:'동탁 제단',desc:'청동 방울이 울리는 제단',boss:0,mc:3,lmin:4,lmax:5,exp:120,gold:60,w:9,h:9,base:'grass' },
        { n:4,name:'나국 왕궁',desc:'금인을 받은 소국의 왕궁',boss:0,mc:3,lmin:4,lmax:6,exp:130,gold:65,w:10,h:9,base:'stone' },
        { n:5,name:'부족 전쟁터',desc:'왜국 대란의 전장',boss:0,mc:3,lmin:4,lmax:6,exp:140,gold:70,w:10,h:10,base:'grass' },
        { n:6,name:'철기 대장간',desc:'대륙에서 전해진 철기 기술',boss:0,mc:4,lmin:5,lmax:7,exp:155,gold:75,w:10,h:10,base:'stone' },
        { n:7,name:'마쓰리 의식장',desc:'풍년을 비는 의식 중 전투',boss:0,mc:4,lmin:5,lmax:7,exp:170,gold:80,w:10,h:10,base:'grass' },
        { n:8,name:'이토국 성벽',desc:'소국 연합의 방어선',boss:0,mc:4,lmin:5,lmax:8,exp:185,gold:90,w:10,h:10,base:'stone' },
        { n:9,name:'야마타이국 입구',desc:'히미코 여왕의 도성',boss:0,mc:4,lmin:6,lmax:8,exp:200,gold:95,w:10,h:10,base:'stone' },
        { n:10,name:'히미코의 결전',desc:'야마타이국 여왕의 시련',boss:1,mc:5,lmin:6,lmax:9,exp:300,gold:150,w:12,h:12,base:'grass' },
      ],
      'yamato': [
        { n:1,name:'이즈모 신전',desc:'출운 대사의 신전 전투',boss:0,mc:3,lmin:5,lmax:7,exp:140,gold:70,w:9,h:9,base:'stone' },
        { n:2,name:'미와산 기슭',desc:'야마토 건국의 성산',boss:0,mc:3,lmin:5,lmax:7,exp:150,gold:75,w:9,h:9,base:'grass' },
        { n:3,name:'전방후원분',desc:'거대 고분의 수호자',boss:0,mc:3,lmin:6,lmax:8,exp:165,gold:80,w:10,h:10,base:'grass' },
        { n:4,name:'하니와 벌판',desc:'토기 인형이 지키는 벌판',boss:0,mc:3,lmin:6,lmax:8,exp:175,gold:85,w:10,h:10,base:'grass' },
        { n:5,name:'아스카 궁전',desc:'아스카 시대의 왕궁 전투',boss:0,mc:4,lmin:7,lmax:9,exp:190,gold:90,w:10,h:10,base:'stone' },
        { n:6,name:'소가 저택',desc:'호족 소가씨의 거대 저택',boss:0,mc:4,lmin:7,lmax:9,exp:205,gold:95,w:10,h:10,base:'stone' },
        { n:7,name:'하쿠손코 전투',desc:'백촌강 전투의 일본 측',boss:0,mc:4,lmin:7,lmax:10,exp:220,gold:100,w:10,h:10,base:'grass' },
        { n:8,name:'다이카 개신',desc:'중앙집권화의 혼란',boss:0,mc:4,lmin:8,lmax:10,exp:235,gold:110,w:10,h:10,base:'stone' },
        { n:9,name:'진신의 난',desc:'황위 계승 전쟁',boss:0,mc:4,lmin:8,lmax:11,exp:250,gold:115,w:10,h:10,base:'grass' },
        { n:10,name:'야마토타케루 결전',desc:'일본 무신의 전설적 전투',boss:0,mc:5,lmin:8,lmax:11,exp:280,gold:125,w:12,h:10,base:'grass' },
        { n:11,name:'쇼토쿠 태자 시련',desc:'불교 수호자의 시험',boss:0,mc:5,lmin:9,lmax:11,exp:310,gold:135,w:12,h:10,base:'stone' },
        { n:12,name:'천손강림 결전',desc:'신화 시대의 최종 전투',boss:1,mc:6,lmin:9,lmax:11,exp:400,gold:200,w:12,h:12,base:'stone' },
      ],
      'nara': [
        { n:1,name:'헤이조궁',desc:'나라 수도의 궁전 전투',boss:0,mc:3,lmin:7,lmax:9,exp:170,gold:85,w:9,h:9,base:'stone' },
        { n:2,name:'도다이지',desc:'대불이 있는 거대 사원',boss:0,mc:3,lmin:7,lmax:9,exp:180,gold:90,w:9,h:9,base:'stone' },
        { n:3,name:'쇼소인 보물고',desc:'실크로드 보물이 잠든 창고',boss:0,mc:3,lmin:8,lmax:10,exp:195,gold:95,w:10,h:10,base:'stone' },
        { n:4,name:'가스가 신사',desc:'사슴이 지키는 신사',boss:0,mc:3,lmin:8,lmax:10,exp:205,gold:100,w:10,h:10,base:'grass' },
        { n:5,name:'고키시치도',desc:'칠도의 관도를 순찰',boss:0,mc:4,lmin:8,lmax:11,exp:220,gold:105,w:10,h:10,base:'grass' },
        { n:6,name:'만요슈 정원',desc:'시가 흐르는 정원의 전투',boss:0,mc:4,lmin:9,lmax:11,exp:235,gold:110,w:10,h:10,base:'grass' },
        { n:7,name:'감진의 도래',desc:'중국 고승의 시련',boss:0,mc:4,lmin:9,lmax:12,exp:250,gold:120,w:10,h:10,base:'stone' },
        { n:8,name:'후지와라 저택',desc:'세도가 후지와라의 본거지',boss:0,mc:4,lmin:9,lmax:12,exp:265,gold:125,w:10,h:10,base:'stone' },
        { n:9,name:'다카마가하라',desc:'신들의 고원 전투',boss:0,mc:5,lmin:10,lmax:13,exp:280,gold:135,w:12,h:10,base:'grass' },
        { n:10,name:'나라 대불 결전',desc:'대불의 수호신 최종 전투',boss:1,mc:5,lmin:10,lmax:13,exp:420,gold:210,w:12,h:12,base:'stone' },
      ],
      'heian': [
        { n:1,name:'헤이안쿄 거리',desc:'귀족 도시의 야간 전투',boss:0,mc:3,lmin:9,lmax:11,exp:200,gold:100,w:9,h:9,base:'stone' },
        { n:2,name:'겐지 저택',desc:'빛의 공자 겐지의 저택',boss:0,mc:3,lmin:9,lmax:11,exp:210,gold:105,w:9,h:9,base:'stone' },
        { n:3,name:'기요미즈데라',desc:'청수사의 무대 위 전투',boss:0,mc:3,lmin:10,lmax:12,exp:225,gold:110,w:10,h:10,base:'stone' },
        { n:4,name:'후시미이나리',desc:'천 개의 도리이 사이 전투',boss:0,mc:3,lmin:10,lmax:12,exp:235,gold:115,w:10,h:10,base:'stone' },
        { n:5,name:'오닌의 숲',desc:'요괴가 출몰하는 밤의 숲',boss:0,mc:4,lmin:10,lmax:13,exp:250,gold:120,w:10,h:10,base:'dark' },
        { n:6,name:'슈겐도 수행장',desc:'산악 수행자의 전장',boss:0,mc:4,lmin:11,lmax:13,exp:265,gold:130,w:10,h:10,base:'stone' },
        { n:7,name:'미나모토 진영',desc:'무사의 시대를 연 겐지 진영',boss:0,mc:4,lmin:11,lmax:14,exp:280,gold:135,w:10,h:10,base:'grass' },
        { n:8,name:'다이라 해안',desc:'헤이케의 해안 방어선',boss:0,mc:4,lmin:11,lmax:14,exp:295,gold:140,w:10,h:10,base:'stone' },
        { n:9,name:'단노우라 전야',desc:'겐페이 전쟁 최후의 해전',boss:0,mc:5,lmin:12,lmax:15,exp:310,gold:150,w:12,h:10,base:'stone' },
        { n:10,name:'아베노 세이메이',desc:'음양사 세이메이의 시련',boss:0,mc:5,lmin:12,lmax:15,exp:330,gold:155,w:12,h:10,base:'dark' },
        { n:11,name:'슈텐도지 토벌',desc:'대요괴 슈텐도지 전투',boss:0,mc:5,lmin:13,lmax:15,exp:350,gold:165,w:12,h:10,base:'dark' },
        { n:12,name:'헤이안 최종 결전',desc:'귀족 시대 종말의 전투',boss:1,mc:6,lmin:13,lmax:15,exp:500,gold:250,w:12,h:12,base:'dark' },
      ],
      'kamakura': [
        { n:1,name:'가마쿠라 거리',desc:'막부의 수도 카마쿠라',boss:0,mc:3,lmin:11,lmax:13,exp:240,gold:120,w:9,h:9,base:'stone' },
        { n:2,name:'쓰루가오카',desc:'학강 팔번궁의 전투',boss:0,mc:3,lmin:11,lmax:13,exp:255,gold:125,w:10,h:10,base:'stone' },
        { n:3,name:'대불 앞',desc:'가마쿠라 대불의 수호',boss:0,mc:3,lmin:12,lmax:14,exp:270,gold:130,w:10,h:10,base:'stone' },
        { n:4,name:'기리시마 산성',desc:'산악 요새의 방어전',boss:0,mc:4,lmin:12,lmax:14,exp:285,gold:140,w:10,h:10,base:'stone' },
        { n:5,name:'겐코의 난',desc:'고다이고 천황의 반격',boss:0,mc:4,lmin:12,lmax:15,exp:300,gold:145,w:10,h:10,base:'grass' },
        { n:6,name:'몽골 습래(1차)',desc:'원나라 함대에 맞선 방어',boss:0,mc:4,lmin:13,lmax:15,exp:315,gold:155,w:10,h:10,base:'stone' },
        { n:7,name:'하카타만 방루',desc:'방루를 사이에 둔 전투',boss:0,mc:4,lmin:13,lmax:16,exp:330,gold:160,w:10,h:10,base:'stone' },
        { n:8,name:'몽골 습래(2차)',desc:'신풍의 전장',boss:0,mc:5,lmin:14,lmax:16,exp:350,gold:170,w:10,h:10,base:'stone' },
        { n:9,name:'나가사키 항',desc:'해상 결전의 전장',boss:0,mc:5,lmin:14,lmax:17,exp:370,gold:180,w:12,h:10,base:'stone' },
        { n:10,name:'호조 집권 결전',desc:'집권의 최후와 막부 붕괴',boss:1,mc:6,lmin:15,lmax:17,exp:550,gold:275,w:12,h:12,base:'stone' },
      ],
      'muromachi': [
        { n:1,name:'금각사',desc:'킨카쿠지의 황금 전장',boss:0,mc:3,lmin:13,lmax:15,exp:280,gold:140,w:9,h:9,base:'stone' },
        { n:2,name:'은각사',desc:'긴카쿠지의 은빛 전장',boss:0,mc:3,lmin:13,lmax:15,exp:295,gold:145,w:10,h:10,base:'stone' },
        { n:3,name:'남조 산성',desc:'남북조 분열의 전장',boss:0,mc:3,lmin:14,lmax:16,exp:310,gold:155,w:10,h:10,base:'stone' },
        { n:4,name:'노 무대',desc:'노가쿠 무대 위의 전투',boss:0,mc:4,lmin:14,lmax:16,exp:330,gold:160,w:10,h:10,base:'stone' },
        { n:5,name:'정원사의 전투',desc:'가레산스이 정원의 수호',boss:0,mc:4,lmin:14,lmax:17,exp:345,gold:170,w:10,h:10,base:'stone' },
        { n:6,name:'이코 잇키',desc:'잇코종 봉기의 전장',boss:0,mc:4,lmin:15,lmax:17,exp:360,gold:175,w:10,h:10,base:'grass' },
        { n:7,name:'왜구 소탕',desc:'해적 왜구의 근거지',boss:0,mc:4,lmin:15,lmax:18,exp:380,gold:185,w:10,h:10,base:'stone' },
        { n:8,name:'오닌의 난',desc:'교토를 태운 대란',boss:0,mc:5,lmin:16,lmax:18,exp:400,gold:195,w:10,h:10,base:'dark' },
        { n:9,name:'사카이 항구',desc:'자치 도시의 방어전',boss:0,mc:5,lmin:16,lmax:19,exp:420,gold:205,w:12,h:10,base:'stone' },
        { n:10,name:'쿠스노키 결전',desc:'충신 쿠스노키의 최후',boss:0,mc:5,lmin:16,lmax:19,exp:440,gold:210,w:12,h:10,base:'grass' },
        { n:11,name:'아시카가 결전',desc:'무로마치 막부 최후',boss:1,mc:6,lmin:17,lmax:19,exp:600,gold:300,w:12,h:12,base:'stone' },
      ],
      'sengoku': [
        { n:1,name:'오와리 평야',desc:'오다 노부나가의 출발점',boss:0,mc:3,lmin:16,lmax:18,exp:350,gold:175,w:10,h:10,base:'grass' },
        { n:2,name:'오케하자마',desc:'기습으로 대군을 격파한 전투',boss:0,mc:3,lmin:16,lmax:18,exp:365,gold:180,w:10,h:10,base:'grass' },
        { n:3,name:'나가시노 전투',desc:'철포대의 3단 사격전',boss:0,mc:4,lmin:17,lmax:19,exp:380,gold:190,w:10,h:10,base:'grass' },
        { n:4,name:'아즈치성',desc:'노부나가의 거대 천수각',boss:0,mc:4,lmin:17,lmax:19,exp:400,gold:195,w:10,h:10,base:'stone' },
        { n:5,name:'혼노지의 변',desc:'배신의 불꽃이 타오른 사원',boss:0,mc:4,lmin:17,lmax:20,exp:415,gold:205,w:10,h:10,base:'dark' },
        { n:6,name:'시즈가타케',desc:'히데요시의 통일 전쟁',boss:0,mc:4,lmin:18,lmax:20,exp:430,gold:210,w:10,h:10,base:'grass' },
        { n:7,name:'오다와라 공성',desc:'호조씨 최후의 거성',boss:0,mc:4,lmin:18,lmax:21,exp:450,gold:220,w:10,h:10,base:'stone' },
        { n:8,name:'조선 침략 진영',desc:'히데요시의 대륙 침공 거점',boss:0,mc:5,lmin:19,lmax:21,exp:470,gold:230,w:10,h:10,base:'stone' },
        { n:9,name:'후시미성',desc:'히데요시 최후의 성',boss:0,mc:5,lmin:19,lmax:22,exp:490,gold:240,w:12,h:10,base:'stone' },
        { n:10,name:'세키가하라 전야',desc:'천하 분수령의 전야',boss:0,mc:5,lmin:19,lmax:22,exp:510,gold:250,w:12,h:10,base:'grass' },
        { n:11,name:'세키가하라 결전',desc:'동군 vs 서군 천하 결전',boss:0,mc:5,lmin:20,lmax:22,exp:530,gold:260,w:12,h:10,base:'grass' },
        { n:12,name:'오사카 여름 진',desc:'도요토미 가문 최후의 전투',boss:0,mc:5,lmin:20,lmax:22,exp:550,gold:270,w:12,h:10,base:'stone' },
        { n:13,name:'오다 노부나가 결전',desc:'제6천마왕의 최종 시련',boss:1,mc:6,lmin:21,lmax:22,exp:900,gold:450,w:14,h:12,base:'dark' },
      ],
      'edo': [
        { n:1,name:'에도성 입구',desc:'도쿠가와의 거대 성곽',boss:0,mc:3,lmin:19,lmax:21,exp:420,gold:210,w:10,h:10,base:'stone' },
        { n:2,name:'닛코 도쇼궁',desc:'이에야스의 영묘',boss:0,mc:3,lmin:19,lmax:21,exp:440,gold:215,w:10,h:10,base:'stone' },
        { n:3,name:'요시와라 거리',desc:'환락가의 야간 전투',boss:0,mc:4,lmin:20,lmax:22,exp:460,gold:225,w:10,h:10,base:'stone' },
        { n:4,name:'충신장 저택',desc:'47인의 낭인 습격',boss:0,mc:4,lmin:20,lmax:22,exp:480,gold:235,w:10,h:10,base:'stone' },
        { n:5,name:'시마바라 전투',desc:'기독교도 봉기의 전장',boss:0,mc:4,lmin:20,lmax:23,exp:500,gold:245,w:10,h:10,base:'stone' },
        { n:6,name:'데지마 무역관',desc:'네덜란드 무역의 거점',boss:0,mc:4,lmin:21,lmax:23,exp:520,gold:255,w:10,h:10,base:'stone' },
        { n:7,name:'오쿠노호소미치',desc:'바쇼의 여행길 전투',boss:0,mc:4,lmin:21,lmax:24,exp:540,gold:265,w:10,h:10,base:'grass' },
        { n:8,name:'페리 내항',desc:'흑선 쇼크의 전장',boss:0,mc:5,lmin:22,lmax:24,exp:560,gold:275,w:10,h:10,base:'stone' },
        { n:9,name:'사쿠라다 문외',desc:'대로 이이 암살 현장',boss:0,mc:5,lmin:22,lmax:25,exp:580,gold:285,w:12,h:10,base:'stone' },
        { n:10,name:'이케다야 사건',desc:'신선조 습격 사건',boss:0,mc:5,lmin:22,lmax:25,exp:600,gold:295,w:12,h:10,base:'stone' },
        { n:11,name:'도바 후시미',desc:'보신전쟁의 서막',boss:0,mc:5,lmin:23,lmax:25,exp:620,gold:305,w:12,h:10,base:'grass' },
        { n:12,name:'하코다테 전투',desc:'막부군 최후의 항전',boss:0,mc:5,lmin:23,lmax:25,exp:650,gold:320,w:12,h:10,base:'stone' },
        { n:13,name:'에도 무혈개성',desc:'막부 종말의 전장',boss:0,mc:5,lmin:24,lmax:25,exp:680,gold:335,w:12,h:10,base:'stone' },
        { n:14,name:'미야모토 무사시',desc:'최강 검객의 최종 결전',boss:1,mc:6,lmin:25,lmax:25,exp:1100,gold:550,w:14,h:14,base:'stone' },
      ],
      'meiji': [
        { n:1,name:'메이지 궁',desc:'근대화의 상징',boss:0,mc:3,lmin:22,lmax:24,exp:500,gold:250,w:10,h:10,base:'stone' },
        { n:2,name:'사이고의 거병',desc:'세이난 전쟁의 시작',boss:0,mc:3,lmin:22,lmax:24,exp:520,gold:260,w:10,h:10,base:'grass' },
        { n:3,name:'시로야마 전투',desc:'사이고 다카모리 최후',boss:0,mc:4,lmin:23,lmax:25,exp:545,gold:270,w:10,h:10,base:'stone' },
        { n:4,name:'동경 거리',desc:'서구화 물결의 도시',boss:0,mc:4,lmin:23,lmax:25,exp:565,gold:280,w:10,h:10,base:'stone' },
        { n:5,name:'청일전쟁 진지',desc:'대륙 진출의 전장',boss:0,mc:4,lmin:24,lmax:26,exp:590,gold:295,w:10,h:10,base:'grass' },
        { n:6,name:'뤼순 요새',desc:'러일전쟁의 격전지',boss:0,mc:4,lmin:24,lmax:26,exp:610,gold:305,w:10,h:10,base:'stone' },
        { n:7,name:'쓰시마 해전',desc:'연합함대의 해전',boss:0,mc:5,lmin:24,lmax:27,exp:635,gold:315,w:10,h:10,base:'stone' },
        { n:8,name:'다이쇼 데모크라시',desc:'대정 민주주의의 전장',boss:0,mc:5,lmin:25,lmax:27,exp:660,gold:330,w:10,h:10,base:'stone' },
        { n:9,name:'관동대지진',desc:'재난 속의 혼란',boss:0,mc:5,lmin:25,lmax:28,exp:685,gold:340,w:12,h:10,base:'dark' },
        { n:10,name:'2·26 사건',desc:'청년 장교의 반란',boss:0,mc:5,lmin:25,lmax:28,exp:710,gold:355,w:12,h:10,base:'stone' },
        { n:11,name:'대본영',desc:'군국주의의 심장부',boss:0,mc:5,lmin:26,lmax:28,exp:740,gold:370,w:12,h:10,base:'stone' },
        { n:12,name:'히로시마 전야',desc:'종전 직전의 전투',boss:0,mc:5,lmin:26,lmax:28,exp:770,gold:385,w:12,h:10,base:'dark' },
        { n:13,name:'옥음방송',desc:'항복 직전의 최후 전투',boss:0,mc:6,lmin:27,lmax:28,exp:800,gold:400,w:12,h:12,base:'stone' },
        { n:14,name:'사이고 다카모리',desc:'마지막 사무라이의 결전',boss:0,mc:6,lmin:27,lmax:28,exp:840,gold:420,w:12,h:12,base:'stone' },
        { n:15,name:'일본 역사 최종전',desc:'일본 역사의 모든 힘이 모인 결전',boss:1,mc:6,lmin:28,lmax:28,exp:1800,gold:900,w:14,h:14,base:'dark' },
      ],
      'xia_shang': [
        { n:1,name:'하왕조 도읍',desc:'대우가 세운 최초의 왕조',boss:0,mc:2,lmin:1,lmax:2,exp:80,gold:40,w:8,h:8,base:'grass' },
        { n:2,name:'은허 유적',desc:'갑골문자가 발견된 상나라 수도',boss:0,mc:2,lmin:1,lmax:2,exp:90,gold:45,w:8,h:8,base:'stone' },
        { n:3,name:'청동기 제단',desc:'제사에 쓰인 청동 예기의 전장',boss:0,mc:3,lmin:1,lmax:3,exp:100,gold:50,w:9,h:9,base:'stone' },
        { n:4,name:'무정의 원정',desc:'상나라 무정 왕의 전쟁',boss:0,mc:3,lmin:2,lmax:3,exp:110,gold:55,w:9,h:8,base:'grass' },
        { n:5,name:'사모무 대정',desc:'거대 청동 솥의 수호',boss:0,mc:3,lmin:2,lmax:4,exp:120,gold:60,w:10,h:8,base:'stone' },
        { n:6,name:'달기의 궁전',desc:'요녀 달기의 마법 궁전',boss:0,mc:3,lmin:2,lmax:4,exp:130,gold:65,w:10,h:9,base:'dark' },
        { n:7,name:'조가성',desc:'상나라 수도의 방어',boss:0,mc:4,lmin:3,lmax:5,exp:140,gold:70,w:10,h:10,base:'stone' },
        { n:8,name:'목야 전야',desc:'주 무왕의 출전 전야',boss:0,mc:4,lmin:3,lmax:5,exp:155,gold:75,w:10,h:10,base:'grass' },
        { n:9,name:'봉신대',desc:'신들을 봉인하는 전장',boss:0,mc:4,lmin:3,lmax:5,exp:170,gold:80,w:10,h:10,base:'dark' },
        { n:10,name:'주왕의 최후',desc:'상나라 멸망의 결전',boss:1,mc:5,lmin:4,lmax:6,exp:250,gold:120,w:12,h:12,base:'dark' },
      ],
      'zhou': [
        { n:1,name:'호경 도읍',desc:'서주의 수도',boss:0,mc:2,lmin:3,lmax:4,exp:100,gold:50,w:8,h:8,base:'stone' },
        { n:2,name:'봉화대',desc:'봉화를 올린 포사의 전장',boss:0,mc:3,lmin:3,lmax:5,exp:110,gold:55,w:8,h:9,base:'stone' },
        { n:3,name:'낙읍 천도',desc:'동주로의 천도',boss:0,mc:3,lmin:4,lmax:5,exp:120,gold:60,w:9,h:9,base:'stone' },
        { n:4,name:'제환공의 회맹',desc:'첫 번째 패자의 전장',boss:0,mc:3,lmin:4,lmax:6,exp:130,gold:65,w:10,h:9,base:'grass' },
        { n:5,name:'진문공의 전장',desc:'19년 유랑 끝의 복귀',boss:0,mc:3,lmin:4,lmax:6,exp:140,gold:70,w:10,h:10,base:'grass' },
        { n:6,name:'오월동주',desc:'오나라와 월나라의 쟁패',boss:0,mc:4,lmin:5,lmax:7,exp:155,gold:75,w:10,h:10,base:'grass' },
        { n:7,name:'손자병법 연무장',desc:'손자가 훈련한 전장',boss:0,mc:4,lmin:5,lmax:7,exp:170,gold:80,w:10,h:10,base:'grass' },
        { n:8,name:'장평 전야',desc:'장평대전 직전의 전투',boss:0,mc:4,lmin:5,lmax:8,exp:185,gold:90,w:10,h:10,base:'stone' },
        { n:9,name:'합종연횡',desc:'종횡가들의 책략 전장',boss:0,mc:4,lmin:6,lmax:8,exp:200,gold:95,w:10,h:10,base:'grass' },
        { n:10,name:'제자백가 결전',desc:'사상가들의 힘이 모인 결전',boss:1,mc:5,lmin:6,lmax:9,exp:300,gold:150,w:12,h:12,base:'grass' },
      ],
      'qin': [
        { n:1,name:'함양 궁전',desc:'진나라 수도의 궁전',boss:0,mc:3,lmin:5,lmax:7,exp:140,gold:70,w:9,h:9,base:'stone' },
        { n:2,name:'만리장성 공사장',desc:'장성 건설 현장의 전투',boss:0,mc:3,lmin:5,lmax:7,exp:150,gold:75,w:9,h:9,base:'stone' },
        { n:3,name:'분서갱유',desc:'사상 탄압의 현장',boss:0,mc:3,lmin:6,lmax:8,exp:165,gold:80,w:10,h:10,base:'dark' },
        { n:4,name:'아방궁',desc:'거대한 궁전의 전투',boss:0,mc:3,lmin:6,lmax:8,exp:175,gold:85,w:10,h:10,base:'stone' },
        { n:5,name:'형가의 암살',desc:'자객 형가의 전장',boss:0,mc:4,lmin:7,lmax:9,exp:190,gold:90,w:10,h:10,base:'stone' },
        { n:6,name:'영정 통일전',desc:'6국을 멸한 통일 전쟁',boss:0,mc:4,lmin:7,lmax:9,exp:205,gold:95,w:10,h:10,base:'grass' },
        { n:7,name:'직도 행군',desc:'시황제의 군사 도로',boss:0,mc:4,lmin:7,lmax:10,exp:220,gold:100,w:10,h:10,base:'grass' },
        { n:8,name:'진시황릉',desc:'시황제의 지하 궁전',boss:0,mc:4,lmin:8,lmax:10,exp:235,gold:110,w:10,h:10,base:'dark' },
        { n:9,name:'대택향 봉기',desc:'진승오광의 반란',boss:0,mc:4,lmin:8,lmax:11,exp:250,gold:115,w:10,h:10,base:'grass' },
        { n:10,name:'초한쟁패 전야',desc:'유방과 항우의 결전 전야',boss:0,mc:5,lmin:8,lmax:11,exp:280,gold:125,w:12,h:10,base:'grass' },
        { n:11,name:'홍문의 연회',desc:'위기일발의 연회장',boss:0,mc:5,lmin:9,lmax:11,exp:310,gold:135,w:12,h:10,base:'stone' },
        { n:12,name:'병마용 결전',desc:'8천 병마용의 최종 시련',boss:1,mc:6,lmin:9,lmax:11,exp:400,gold:200,w:12,h:12,base:'stone' },
      ],
      'han': [
        { n:1,name:'장안 도읍',desc:'한 고조 유방의 수도',boss:0,mc:3,lmin:7,lmax:9,exp:170,gold:85,w:9,h:9,base:'stone' },
        { n:2,name:'초한 전장',desc:'해하 전투의 재현',boss:0,mc:3,lmin:7,lmax:9,exp:180,gold:90,w:9,h:9,base:'grass' },
        { n:3,name:'흉노 접경',desc:'북방 유목민과의 전투',boss:0,mc:3,lmin:8,lmax:10,exp:195,gold:95,w:10,h:10,base:'grass' },
        { n:4,name:'장건의 서역',desc:'실크로드 개척의 전장',boss:0,mc:3,lmin:8,lmax:10,exp:205,gold:100,w:10,h:10,base:'dirt' },
        { n:5,name:'무제의 원정',desc:'한 무제의 흉노 원정',boss:0,mc:4,lmin:8,lmax:11,exp:220,gold:105,w:10,h:10,base:'grass' },
        { n:6,name:'왕망의 신',desc:'신나라의 혼란',boss:0,mc:4,lmin:9,lmax:11,exp:235,gold:110,w:10,h:10,base:'stone' },
        { n:7,name:'적미군 봉기',desc:'농민 반란의 전장',boss:0,mc:4,lmin:9,lmax:12,exp:250,gold:120,w:10,h:10,base:'grass' },
        { n:8,name:'낙양 궁전',desc:'후한의 수도 방어',boss:0,mc:4,lmin:9,lmax:12,exp:265,gold:125,w:10,h:10,base:'stone' },
        { n:9,name:'황건의 난',desc:'태평도 봉기의 전장',boss:0,mc:5,lmin:10,lmax:13,exp:280,gold:135,w:12,h:10,base:'grass' },
        { n:10,name:'한신의 결전',desc:'국사무쌍 한신의 시련',boss:1,mc:5,lmin:10,lmax:13,exp:420,gold:210,w:12,h:12,base:'grass' },
      ],
      'three_kingdoms': [
        { n:1,name:'도원결의',desc:'유비·관우·장비의 맹세',boss:0,mc:3,lmin:9,lmax:11,exp:200,gold:100,w:9,h:9,base:'grass' },
        { n:2,name:'호로관 전투',desc:'여포의 돌진',boss:0,mc:3,lmin:9,lmax:11,exp:210,gold:105,w:9,h:9,base:'stone' },
        { n:3,name:'관도대전',desc:'조조 vs 원소의 결전',boss:0,mc:3,lmin:10,lmax:12,exp:225,gold:110,w:10,h:10,base:'grass' },
        { n:4,name:'삼고초려',desc:'제갈량을 찾아가는 전장',boss:0,mc:3,lmin:10,lmax:12,exp:235,gold:115,w:10,h:10,base:'grass' },
        { n:5,name:'적벽대전',desc:'화공으로 조조 대군을 격파',boss:0,mc:4,lmin:10,lmax:13,exp:250,gold:120,w:10,h:10,base:'stone' },
        { n:6,name:'형주 쟁탈',desc:'삼국이 뒤엉킨 요충지',boss:0,mc:4,lmin:11,lmax:13,exp:265,gold:130,w:10,h:10,base:'grass' },
        { n:7,name:'한중 공방',desc:'유비의 한중왕 등극전',boss:0,mc:4,lmin:11,lmax:14,exp:280,gold:135,w:10,h:10,base:'stone' },
        { n:8,name:'이릉 전투',desc:'유비의 복수전',boss:0,mc:4,lmin:11,lmax:14,exp:295,gold:140,w:10,h:10,base:'grass' },
        { n:9,name:'출사표',desc:'제갈량의 북벌 전장',boss:0,mc:5,lmin:12,lmax:15,exp:310,gold:150,w:12,h:10,base:'grass' },
        { n:10,name:'오장원',desc:'제갈량 최후의 전장',boss:0,mc:5,lmin:12,lmax:15,exp:330,gold:155,w:12,h:10,base:'grass' },
        { n:11,name:'사마의의 대두',desc:'삼국 통일의 서막',boss:0,mc:5,lmin:13,lmax:15,exp:350,gold:165,w:12,h:10,base:'stone' },
        { n:12,name:'여포 결전',desc:'삼국 최강 무장의 시련',boss:1,mc:6,lmin:13,lmax:15,exp:500,gold:250,w:12,h:12,base:'grass' },
      ],
      'tang': [
        { n:1,name:'장안 성문',desc:'세계 최대 도시의 입구',boss:0,mc:3,lmin:11,lmax:13,exp:240,gold:120,w:9,h:9,base:'stone' },
        { n:2,name:'현무문의 변',desc:'태종의 쿠데타 현장',boss:0,mc:3,lmin:11,lmax:13,exp:255,gold:125,w:10,h:10,base:'stone' },
        { n:3,name:'정관의 치',desc:'태평성대의 시련',boss:0,mc:3,lmin:12,lmax:14,exp:270,gold:130,w:10,h:10,base:'stone' },
        { n:4,name:'서역 원정',desc:'서돌궐 정벌의 전장',boss:0,mc:4,lmin:12,lmax:14,exp:285,gold:140,w:10,h:10,base:'dirt' },
        { n:5,name:'측천무후 궁전',desc:'여황제의 궁전 전투',boss:0,mc:4,lmin:12,lmax:15,exp:300,gold:145,w:10,h:10,base:'stone' },
        { n:6,name:'현종의 화청궁',desc:'양귀비와 현종의 전장',boss:0,mc:4,lmin:13,lmax:15,exp:315,gold:155,w:10,h:10,base:'stone' },
        { n:7,name:'안사의 난',desc:'안록산의 대반란',boss:0,mc:4,lmin:13,lmax:16,exp:330,gold:160,w:10,h:10,base:'grass' },
        { n:8,name:'마외역의 비극',desc:'양귀비의 비극이 서린 역참',boss:0,mc:5,lmin:14,lmax:16,exp:350,gold:170,w:10,h:10,base:'stone' },
        { n:9,name:'황소의 난',desc:'농민 반란의 불길',boss:0,mc:5,lmin:14,lmax:17,exp:370,gold:180,w:12,h:10,base:'grass' },
        { n:10,name:'당 최후의 전투',desc:'대제국의 멸망',boss:1,mc:6,lmin:15,lmax:17,exp:550,gold:275,w:12,h:12,base:'stone' },
      ],
      'song': [
        { n:1,name:'개봉 도성',desc:'북송의 번화한 수도',boss:0,mc:3,lmin:13,lmax:15,exp:280,gold:140,w:9,h:9,base:'stone' },
        { n:2,name:'양가장 전투',desc:'양가장 무인의 전장',boss:0,mc:3,lmin:13,lmax:15,exp:295,gold:145,w:10,h:10,base:'grass' },
        { n:3,name:'왕안석 변법',desc:'개혁의 전장',boss:0,mc:3,lmin:14,lmax:16,exp:310,gold:155,w:10,h:10,base:'stone' },
        { n:4,name:'청명상하도',desc:'그림 속 도시의 전투',boss:0,mc:4,lmin:14,lmax:16,exp:330,gold:160,w:10,h:10,base:'stone' },
        { n:5,name:'악비의 북벌',desc:'정충보국의 전장',boss:0,mc:4,lmin:14,lmax:17,exp:345,gold:170,w:10,h:10,base:'grass' },
        { n:6,name:'정강의 변',desc:'금나라 침공의 전장',boss:0,mc:4,lmin:15,lmax:17,exp:360,gold:175,w:10,h:10,base:'stone' },
        { n:7,name:'임안 행재소',desc:'남송의 임시 수도',boss:0,mc:4,lmin:15,lmax:18,exp:380,gold:185,w:10,h:10,base:'stone' },
        { n:8,name:'양양 공방',desc:'6년간의 대공성전',boss:0,mc:5,lmin:16,lmax:18,exp:400,gold:195,w:10,h:10,base:'stone' },
        { n:9,name:'교지 원정',desc:'남방 원정의 전장',boss:0,mc:5,lmin:16,lmax:19,exp:420,gold:205,w:12,h:10,base:'grass' },
        { n:10,name:'애산 해전',desc:'남송 최후의 해전',boss:0,mc:5,lmin:16,lmax:19,exp:440,gold:210,w:12,h:10,base:'stone' },
        { n:11,name:'문천상의 결의',desc:'충신의 마지막 저항',boss:0,mc:5,lmin:17,lmax:19,exp:460,gold:220,w:12,h:10,base:'stone' },
        { n:12,name:'악비 결전',desc:'민족 영웅 악비의 최종 시련',boss:1,mc:6,lmin:18,lmax:19,exp:650,gold:325,w:14,h:12,base:'grass' },
      ],
      'yuan': [
        { n:1,name:'대도(베이징)',desc:'쿠빌라이의 수도',boss:0,mc:3,lmin:16,lmax:18,exp:350,gold:175,w:10,h:10,base:'stone' },
        { n:2,name:'초원의 진격',desc:'몽골 기마대의 돌진',boss:0,mc:3,lmin:16,lmax:18,exp:365,gold:180,w:10,h:10,base:'grass' },
        { n:3,name:'서하 정벌',desc:'서하 멸망의 전장',boss:0,mc:4,lmin:17,lmax:19,exp:380,gold:190,w:10,h:10,base:'grass' },
        { n:4,name:'금 멸망전',desc:'여진 금나라 최후',boss:0,mc:4,lmin:17,lmax:19,exp:400,gold:195,w:10,h:10,base:'stone' },
        { n:5,name:'바그다드 공성',desc:'아바스 왕조 멸망의 전장',boss:0,mc:4,lmin:17,lmax:20,exp:415,gold:205,w:10,h:10,base:'stone' },
        { n:6,name:'카미카제(신풍)',desc:'일본 침공의 전장',boss:0,mc:4,lmin:18,lmax:20,exp:430,gold:210,w:10,h:10,base:'stone' },
        { n:7,name:'대운하',desc:'대운하 위의 해상 전투',boss:0,mc:4,lmin:18,lmax:21,exp:450,gold:220,w:10,h:10,base:'water' },
        { n:8,name:'마르코 폴로의 길',desc:'동서 교역로의 전장',boss:0,mc:5,lmin:19,lmax:21,exp:470,gold:230,w:10,h:10,base:'stone' },
        { n:9,name:'홍건적의 난',desc:'원나라 말기 농민 반란',boss:0,mc:5,lmin:19,lmax:22,exp:490,gold:240,w:12,h:10,base:'grass' },
        { n:10,name:'칭기즈칸 결전',desc:'대정복자의 최종 시련',boss:1,mc:6,lmin:20,lmax:22,exp:900,gold:450,w:14,h:12,base:'grass' },
      ],
      'ming': [
        { n:1,name:'응천부(난징)',desc:'주원장의 수도',boss:0,mc:3,lmin:19,lmax:21,exp:420,gold:210,w:10,h:10,base:'stone' },
        { n:2,name:'북경 천도',desc:'영락제의 새 수도',boss:0,mc:3,lmin:19,lmax:21,exp:440,gold:215,w:10,h:10,base:'stone' },
        { n:3,name:'자금성',desc:'황제의 궁전 전투',boss:0,mc:4,lmin:20,lmax:22,exp:460,gold:225,w:10,h:10,base:'stone' },
        { n:4,name:'정화의 항해',desc:'대항해 원정의 전장',boss:0,mc:4,lmin:20,lmax:22,exp:480,gold:235,w:10,h:10,base:'stone' },
        { n:5,name:'토목의 변',desc:'오이라트에 황제가 포로',boss:0,mc:4,lmin:20,lmax:23,exp:500,gold:245,w:10,h:10,base:'grass' },
        { n:6,name:'만리장성 방어',desc:'북방 유목민 침입 방어',boss:0,mc:4,lmin:21,lmax:23,exp:520,gold:255,w:10,h:10,base:'stone' },
        { n:7,name:'왜구 소탕',desc:'척계광의 왜구 토벌',boss:0,mc:4,lmin:21,lmax:24,exp:540,gold:265,w:10,h:10,base:'stone' },
        { n:8,name:'임진왜란 참전',desc:'조선 구원의 원정',boss:0,mc:5,lmin:22,lmax:24,exp:560,gold:275,w:10,h:10,base:'grass' },
        { n:9,name:'이자성 봉기',desc:'농민 반란의 불꽃',boss:0,mc:5,lmin:22,lmax:25,exp:580,gold:285,w:12,h:10,base:'grass' },
        { n:10,name:'산해관 전투',desc:'오삼계의 결단',boss:0,mc:5,lmin:22,lmax:25,exp:600,gold:295,w:12,h:10,base:'stone' },
        { n:11,name:'정성공 해전',desc:'대만 탈환의 해전',boss:0,mc:5,lmin:23,lmax:25,exp:620,gold:305,w:12,h:10,base:'stone' },
        { n:12,name:'자금성 함락',desc:'명 왕조 최후의 날',boss:0,mc:5,lmin:23,lmax:25,exp:650,gold:320,w:12,h:10,base:'stone' },
        { n:13,name:'영락제의 북벌',desc:'영락대제의 몽골 원정',boss:0,mc:5,lmin:24,lmax:25,exp:680,gold:335,w:12,h:10,base:'grass' },
        { n:14,name:'주원장 결전',desc:'걸인에서 황제까지, 창업자의 시련',boss:1,mc:6,lmin:25,lmax:25,exp:1100,gold:550,w:14,h:14,base:'stone' },
      ],
      'qing': [
        { n:1,name:'심양 궁전',desc:'후금의 수도',boss:0,mc:3,lmin:22,lmax:24,exp:500,gold:250,w:10,h:10,base:'stone' },
        { n:2,name:'산해관 통과',desc:'만주족의 중원 진출',boss:0,mc:3,lmin:22,lmax:24,exp:520,gold:260,w:10,h:10,base:'stone' },
        { n:3,name:'강희제 친정',desc:'삼번의 난 진압',boss:0,mc:4,lmin:23,lmax:25,exp:545,gold:270,w:10,h:10,base:'grass' },
        { n:4,name:'건륭제 남순',desc:'전성기의 순행 전장',boss:0,mc:4,lmin:23,lmax:25,exp:565,gold:280,w:10,h:10,base:'stone' },
        { n:5,name:'아편전쟁',desc:'영국과의 충돌',boss:0,mc:4,lmin:24,lmax:26,exp:590,gold:295,w:10,h:10,base:'stone' },
        { n:6,name:'태평천국',desc:'홍수전의 난',boss:0,mc:4,lmin:24,lmax:26,exp:610,gold:305,w:10,h:10,base:'grass' },
        { n:7,name:'양무운동',desc:'근대화 시도의 전장',boss:0,mc:5,lmin:24,lmax:27,exp:635,gold:315,w:10,h:10,base:'stone' },
        { n:8,name:'무술변법',desc:'100일 개혁의 전장',boss:0,mc:5,lmin:25,lmax:27,exp:660,gold:330,w:10,h:10,base:'stone' },
        { n:9,name:'의화단 사건',desc:'반외세 봉기의 전장',boss:0,mc:5,lmin:25,lmax:28,exp:685,gold:340,w:12,h:10,base:'stone' },
        { n:10,name:'신해혁명 전야',desc:'왕조 붕괴의 전장',boss:0,mc:5,lmin:25,lmax:28,exp:710,gold:355,w:12,h:10,base:'stone' },
        { n:11,name:'무창 봉기',desc:'혁명의 첫 총성',boss:0,mc:5,lmin:26,lmax:28,exp:740,gold:370,w:12,h:10,base:'stone' },
        { n:12,name:'자금성 퇴위',desc:'마지막 황제의 퇴위',boss:0,mc:5,lmin:26,lmax:28,exp:770,gold:385,w:12,h:10,base:'stone' },
        { n:13,name:'손문의 결의',desc:'공화국 건국의 전투',boss:0,mc:6,lmin:27,lmax:28,exp:800,gold:400,w:12,h:12,base:'stone' },
        { n:14,name:'누르하치의 굴기',desc:'만주족 창업자의 전투',boss:0,mc:6,lmin:27,lmax:28,exp:840,gold:420,w:12,h:12,base:'stone' },
        { n:15,name:'중국 역사 최종전',desc:'중국 역사의 모든 힘이 모인 결전',boss:1,mc:6,lmin:28,lmax:28,exp:1800,gold:900,w:14,h:14,base:'dark' },
      ],
    };

    for (const [groupKey, stages] of Object.entries(jpCnStageData)) {
      const groupId = newGMap[groupKey];
      if (!groupId) continue;
      const dungeonKey = newGroupDungeonMap[groupKey] || 'forest';

      for (const s of stages) {
        const tileOverrides = generateMapOverrides(s.w, s.h, s.base, s.n, !!s.boss);
        const pSpawns = generateSpawns(s.w, s.h, 'player', Math.min(4, s.mc));
        const mSpawns = generateSpawns(s.w, s.h, 'monster', s.mc);

        await pool.query(
          `INSERT IGNORE INTO stage_levels
           (group_id, stage_number, name, description, is_boss, monster_count,
            monster_level_min, monster_level_max, reward_exp, reward_gold,
            dungeon_key, map_width, map_height, base_tile_type,
            tile_overrides, player_spawns, monster_spawns)
           VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
          [groupId, s.n, s.name, s.desc, s.boss, s.mc,
           s.lmin, s.lmax, s.exp, s.gold,
           dungeonKey, s.w, s.h, s.base,
           JSON.stringify(tileOverrides), JSON.stringify(pSpawns), JSON.stringify(mSpawns)]
        );
      }
    }
  }

  // 스테이지 설명 업데이트 (더 상세한 설명)
  const stageDescriptions = {
    'gojoseon': {
      1: '태초의 빛이 비추는 아사달 평원. 단군왕검이 처음 도읍을 세운 이 광활한 들판에는 아직도 개국의 기운이 서려 있다. 약한 야수들이 배회하지만 방심하면 위험하다.',
      2: '하늘과 땅을 잇는 신단수(神檀樹) 아래. 환웅이 처음 땅에 내려온 이 신성한 장소에서 자연의 수호자들이 침입자를 경계하고 있다.',
      3: '환웅이 인간에게 내린 세 가지 시련의 장. 풍백, 우사, 운사의 힘이 소용돌이치는 이곳에서 살아남아야 진정한 전사로 인정받을 수 있다.',
      4: '곰과 호랑이가 인간이 되고자 백일간 수행한 동굴. 어둠 속에서 울리는 울음소리와 함께 동굴 깊은 곳의 마물들이 깨어나고 있다.',
      5: '바람을 다스리는 신 풍백이 머물던 언덕. 거센 바람이 끊임없이 불어오는 이곳에서는 바람에 실려 온 정령들과 마주하게 된다.',
      6: '비의 신 우사가 다스리는 안개 자욱한 늪지대. 발이 빠지는 질퍽한 땅 위로 수생 마물들이 도사리고 있다. 지형을 이용한 전략이 필요하다.',
      7: '구름의 신 운사가 자욱한 안개로 감춘 비밀의 산길. 앞이 보이지 않는 험로를 따라가면 강력한 산짐승들이 기다리고 있다.',
      8: '고조선의 서쪽 전략 요충지 비파산. 견고한 석벽과 험한 지형 사이로 적들이 매복하고 있다. 높은 곳을 선점하는 것이 승리의 열쇠다.',
      9: '왕검성으로 통하는 마지막 관문. 수도를 지키려는 수호자들이 총력을 기울여 방어하고 있다. 이곳을 돌파해야 최종 시련에 도전할 수 있다.',
      10: '고조선의 개국자 단군왕검이 후대 전사들을 위해 남긴 최후의 시험장. 신성한 기운이 가득한 이 전장에서 역사의 첫 장을 장식할 영웅이 탄생한다.',
    },
    'samhan': {
      1: '마한 78개 소국 중 하나의 작은 촌락. 초가지붕 아래 평화로워 보이지만, 밤이 되면 주변 산에서 내려온 마물들이 마을을 위협한다.',
      2: '삼한 시대 철기문화의 중심지인 변한의 대장간. 붉게 달궈진 쇳물 사이로 불의 정령들이 출몰하며, 강인한 전사만이 이 열기를 견딜 수 있다.',
      3: '진한 부족이 하늘에 제사를 올리던 신성한 의례장. 영적인 기운이 가득한 이곳에서는 고대의 제물들이 되살아나 침입자를 막아선다.',
      4: '천군(天君)이 다스리는 소도(蘇塗). 솟대가 세워진 이 신성불가침의 영역에 들어선 순간, 하늘의 수호신들이 시련을 내린다.',
      5: '삼한의 부족들이 연합하여 싸운 대규모 전쟁터. 두레의 정신으로 뭉친 전사들의 함성이 울려 퍼지는 광활한 전장이다.',
      6: '변한의 깊은 철광산 계곡. 쇳덩어리와 광석이 빛나는 어두운 갱도 속에서 지하의 마물들이 광맥을 지키고 있다.',
      7: '삼한의 제천 행사 영고, 동맹, 무천이 열리는 의식의 장. 하늘에 기원하는 제사 중 깨어난 고대의 영혼들과 맞서 싸워야 한다.',
      8: '마한 연맹의 수도 목지국을 둘러싼 견고한 성벽. 수도를 지키려는 정예 수비대와 성벽에 깃든 수호 영혼들이 방어선을 형성한다.',
      9: '가야의 전신인 구야국의 번화한 항구. 해상 무역으로 부를 쌓은 이 도시를 노리는 해적과 수생 마물들이 포구 주변에 출몰한다.',
      10: '마한, 변한, 진한 세 부족의 운명을 건 최후의 대결전. 각 부족의 최강 전사들과 고대의 수호신이 총출동하는 역사적 전투의 장이다.',
    },
    'goguryeo': {
      1: '고구려의 시조 주몽이 세운 첫 번째 수도 졸본성. 건국의 기상이 서린 이 산성에서 북방의 맹수들과 첫 전투가 시작된다.',
      2: '유리왕이 천도한 두 번째 수도 국내성의 외곽 방어 진지. 주변 부족들의 끊임없는 침공에 맞서 성을 지켜내야 한다.',
      3: '천혜의 요새 환도산성. 험준한 산세를 이용한 난공불락의 산성이지만, 산 속의 마물들도 함께 상대해야 하는 험난한 전투가 기다린다.',
      4: '만주 벌판을 호령하던 고구려 기마대가 누빈 광활한 요동 벌판. 끝없이 펼쳐진 초원에서 기동력이 승패를 가른다.',
      5: '수나라 113만 대군을 30만으로 격파한 전설의 전장. 을지문덕 장군의 지략이 깃든 살수에서 적을 유인하고 섬멸하라.',
      6: '당 태종의 20만 대군을 88일간 막아낸 철벽 안시성. 성주 양만춘의 불굴의 의지가 서린 이곳에서 압도적인 적과 맞서야 한다.',
      7: '고구려 마지막 수도 평양성의 내성. 최후의 방어전이 벌어지는 이곳에서 왕성을 사수하기 위한 결사적인 전투가 펼쳐진다.',
      8: '정복왕 광개토대왕의 능 주변. 대왕의 위엄과 기운이 서려 있어 강력한 수호 영혼들이 무덤을 지키고 있다.',
      9: '장수왕의 남하 정책으로 한강 유역까지 진격하는 대진격전. 남쪽으로 영토를 넓히며 적의 저항을 물리쳐야 한다.',
      10: '살수에서 을지문덕 장군이 펼치는 마지막 결전. 적을 깊숙이 유인한 뒤 물길을 터뜨려 섬멸하는 역사적 전투를 재현한다.',
      11: '연개소문의 철권통치와 야망이 깃든 전장. 독재자의 군대는 강력하지만, 그 야망만큼이나 위험한 마물들도 깨어나고 있다.',
      12: '700년 대제국 고구려 최후의 날. 내부 분열과 외세의 공격 속에서 제국의 마지막 빛을 지키기 위한 처절한 사투가 벌어진다.',
    },
    'baekje': {
      1: '온조가 한강 유역에 세운 백제의 첫 도읍 위례성. 강변의 비옥한 평야에서 새 왕국의 기초를 닦으며 주변의 위협을 물리쳐야 한다.',
      2: '새로운 터전을 마련한 한산 기슭의 방어전. 산 아래로 밀려오는 마물들의 공격을 막아내며 영토를 확보해야 한다.',
      3: '금강을 건너 웅진으로 천도하는 격류의 전투. 강물 위에서 벌어지는 위험천만한 도하 작전에서 적의 방해를 뚫고 나아가라.',
      4: '백제의 마지막 수도 사비성에서 벌어지는 치열한 공방전. 성벽 위에서 쏟아지는 화살과 마법 공격 속에서 성을 지켜내야 한다.',
      5: '백제 25대 무령왕의 능. 정교한 벽돌무덤 속에 잠든 왕의 수호령들이 깨어나 침입자를 시험한다. 백제 문화의 정수를 느낄 수 있는 곳이다.',
      6: '동양 최대 사찰이었던 미륵사의 폐허. 거대한 석탑 사이로 깃든 불교의 수호신과 마물들이 뒤섞여 혼돈의 전장을 만든다.',
      7: '삼천 궁녀의 전설이 서린 백마강가. 낙화암의 슬픈 역사가 깃든 이곳에서 강물에서 솟아오른 원혼들과 맞서 싸워야 한다.',
      8: '성왕이 전사한 비극의 전장 관산성. 왕의 원통한 기운이 서려 있어 강력한 원령들이 출몰하는 위험한 곳이다.',
      9: '계백 장군이 결사대 5천을 이끌고 최후의 전투를 벌인 황산벌. 죽음을 각오한 전사들의 기백이 서린 비장한 전장이다.',
      10: '백제 최후의 충신 계백 장군과의 결전. 처자식까지 스스로 베어 물러설 곳 없는 장군의 결의와 맞서는 최종 보스전이다.',
    },
    'silla': {
      1: '신라의 성스러운 산 경주 남산. 수많은 불상과 탑이 세워진 이 영험한 산에서 불교의 수호신들이 침입자를 시험한다.',
      2: '화랑도가 심신을 수련하던 훈련장. 세속오계의 정신 아래 단련된 화랑들의 영혼이 깃들어 있어, 진정한 전사만이 통과할 수 있다.',
      3: '동양 최고(最古)의 천문대 첨성대 주변. 별의 기운이 모이는 이 신비로운 장소에서 천체의 힘을 품은 마물들이 출현한다.',
      4: '부처의 나라를 현세에 구현한 불국사 경내. 청운교와 백운교를 건너면 극락의 수호자들이 기다리는 환상적인 전장이 펼쳐진다.',
      5: '동해의 일출을 바라보는 석굴암의 신비로운 석실. 본존불의 자비로운 기운과 함께 석굴 속 깊은 곳의 암흑 마물들이 공존하는 곳이다.',
      6: '신라 왕들이 잠든 대릉원의 고분군. 황금 보관과 유물들을 지키는 고대 왕들의 수호령이 무덤 사이를 떠돌고 있다.',
      7: '삼국통일의 영웅 김유신 장군과 함께하는 출정. 장군의 명검 기운이 서린 전장에서 적군을 무찔러야 한다.',
      8: '675년 당군 20만을 격파한 매소성 결전지. 나당전쟁의 승리를 결정지은 이 역사적 전장에서 외세의 침략을 물리쳐라.',
      9: '신라 수군이 당나라 함대를 격파한 기벌포 해전. 파도 위에서 벌어지는 해상 전투에서 적 함대를 침몰시켜야 한다.',
      10: '선덕여왕에 반기를 든 비담의 난. 왕궁을 향해 진격하는 반란군과 여왕을 지키려는 충신들의 혈전이 펼쳐진다.',
      11: '죽어서 동해의 용이 되어 나라를 지키겠다는 문무왕의 해중릉. 바다 속에서 깨어난 용왕의 시련을 견뎌내야 한다.',
      12: '백제와 고구려를 멸하고 당군까지 물리친 삼국통일의 최종 대전. 천년 전쟁의 종결을 알리는 장엄한 최후의 결전이다.',
    },
    'balhae': {
      1: '대조영이 발해를 건국한 성스러운 동모산. 만주 벌판을 호령한 해동성국의 기상이 서린 이곳에서 새로운 도전이 시작된다.',
      2: '발해의 찬란한 수도 상경용천부. 당나라 장안을 본떠 만든 거대한 도성에서 수도를 지키는 정예 수비대와 맞선다.',
      3: '발해 5경 중 하나인 중경현덕부. 교역의 중심지였던 이곳에서 실크로드를 통해 유입된 이국의 마물들과 전투를 벌인다.',
      4: '장문휴 장군이 당나라 등주를 공격한 해상 원정의 전장. 거친 바다를 건너 적진에 상륙하는 대담한 작전에 참여하라.',
      5: '건국 영웅 대조영이 영주에서 동모산까지 싸워온 건국 전쟁의 재현. 추격하는 당군을 물리치며 새 나라의 터전을 마련하라.',
      6: '대무예 왕의 영토 확장 전쟁. 북으로 흑수말갈, 서로 거란과 맞서며 해동성국의 광활한 영토를 개척하는 전장이다.',
      7: '북방 유목 민족 거란과의 접경 지대. 초원의 기마 전사들이 끊임없이 국경을 침범하는 긴장감 넘치는 전장이다.',
      8: '선왕 대인수 시대 발해의 전성기를 재현한 전투. 해동성국의 최전성기 군대와 겨루며 전력의 한계를 시험받는다.',
      9: '멸망 직전 거란의 침공에 맞서는 발해의 사투. 내부 분열과 외세의 공격 속에서 마지막까지 나라를 지키려는 처절한 전투다.',
      10: '해동성국 발해 최후의 전쟁. 거란 야율아보기의 대군에 맞선 마지막 방어전. 229년 대제국의 운명이 이 전투에 달려있다.',
    },
    'goryeo': {
      1: '왕건이 후삼국 통일의 꿈을 품고 올랐던 송악산. 산 정상에서 펼쳐지는 전투에서 통일의 기운을 얻어야 한다.',
      2: '고려의 수도 개경(개성)의 시가지에서 벌어지는 치열한 전투. 좁은 골목과 높은 성벽 사이에서 전략적 교전이 펼쳐진다.',
      3: '묘청이 서경(평양) 천도를 주장하며 일으킨 전쟁. 수도 이전을 둘러싼 정치적 갈등이 전장 위의 마물들과 뒤엉킨다.',
      4: '1019년 강감찬 장군이 거란 10만 대군을 섬멸한 귀주대첩의 전장. 대원수의 지략을 이어받아 압도적인 적을 무찔러라.',
      5: '1232년 몽골군 사령관 살리타이가 전사한 처인성 전투. 승려 김윤후의 활약처럼 작은 성에서 거대한 적을 물리쳐야 한다.',
      6: '몽골에 끝까지 항전한 삼별초의 전장. 진도와 제주도를 거치며 최후까지 저항하는 불굴의 전사들과 함께 싸운다.',
      7: '8만 장의 목판에 새긴 팔만대장경을 지키는 전투. 해인사를 침범하는 마물들로부터 인류 문화유산을 수호해야 한다.',
      8: '몽골의 침공에 맞서 39년간 버텨낸 강화도 항전. 바다로 둘러싸인 요새에서 끊임없는 공격을 막아내는 지구전이다.',
      9: '원나라에 빼앗긴 쌍성총관부를 탈환하는 전투. 공민왕의 반원 정책 아래 잃어버린 영토를 되찾기 위한 진격이 시작된다.',
      10: '이성계가 요동 정벌 중 위화도에서 회군한 운명적 사건의 전장. 역사의 분수령에서 거대한 선택의 기로에 선다.',
      11: '고려 왕궁 만월대에서 벌어지는 최후의 공방전. 무너져가는 왕조의 마지막 영광을 지키려는 수호자들과 맞선다.',
      12: '474년 왕조의 마지막 숨결. 고려의 충신들이 새 왕조의 탄생에 저항하며 벌이는 비장한 최후의 전투이다.',
      13: '귀주대첩의 대원수 강감찬 장군과의 최종 결전. 역사상 가장 위대한 방어전의 영웅이 남긴 궁극의 시련에 도전하라.',
    },
    'joseon': {
      1: '태조 이성계가 건설한 새 왕조의 수도 한양. 사대문으로 둘러싸인 도성에서 새 시대를 여는 전투가 시작된다.',
      2: '왕의 정전 근정전 앞 넓은 마당에서 벌어지는 의례적 전투. 왕권의 위엄이 서린 이곳에서 조선의 수호자들과 대면한다.',
      3: '세종대왕이 설립한 학문 연구 기관 집현전. 학자들의 지혜가 마법으로 변한 이곳에서 지식과 무력이 결합된 전투를 경험한다.',
      4: '세종대왕의 명으로 김종서가 개척한 북방 4군6진. 여진족과 맞서며 국경을 확장하는 혹한의 북방 전장이다.',
      5: '단종에 대한 충절을 지킨 사육신의 비극적 전장. 죽음을 불사한 충신들의 영혼이 서려있어 강렬한 의지의 힘이 전장을 지배한다.',
      6: '국방 최고 의결 기관 비변사. 전략과 전술을 논하던 이곳이 전장으로 변하면서, 지략과 무력 모두를 시험받게 된다.',
      7: '유교 최고 교육기관 성균관. 유생들의 학문적 기운이 마법으로 변해 전장을 감싸고 있다. 문무를 겸비해야 통과할 수 있다.',
      8: '조선 왕실의 제사를 모시는 종묘. 역대 왕들의 신위가 모셔진 이 신성한 장소에서 왕들의 영혼이 시련을 내린다.',
      9: '창덕궁의 비밀 정원 후원. 아름다운 연못과 정자 사이로 궁궐의 수호 영혼들이 출몰하는 몽환적인 전장이다.',
      10: '정조대왕이 아버지 사도세자를 기리며 쌓은 수원 화성. 동서양 축성술이 결합된 과학적 성곽에서 치밀한 공방전이 벌어진다.',
      11: '실학자들의 사상이 깃든 서재가 전장으로 변했다. 정약용, 박지원의 실용적 지혜가 마법으로 구현된 독특한 전투를 경험하라.',
      12: '1894년 동학농민운동의 전쟁터. 탐관오리에 맞선 민중의 함성이 울려퍼지는 우금치에서 백성들의 의지와 함께 싸운다.',
      13: '경복궁 연못 위에 세워진 경회루에서의 장엄한 결전. 물 위에 떠있는 누각에서 벌어지는 환상적인 전투의 무대다.',
      14: '한글 창제, 측우기, 해시계 등 수많은 업적을 남긴 세종대왕이 후대를 위해 남긴 최후의 시험. 성군의 지혜와 힘을 모두 상대해야 한다.',
    },
    'imjin': {
      1: '1592년 4월, 일본군이 처음 상륙한 부산진. 바다에서 밀려오는 대군에 맞서 해안을 사수하는 치열한 방어전이 시작된다.',
      2: '부산 함락 후 일본군이 진격한 동래성. 동래부사 송상현이 "싸워 죽기는 쉬우나 길을 빌려주기는 어렵다"며 순절한 비장한 전장이다.',
      3: '신립 장군이 기마대를 이끌고 배수진을 친 탄금대. 충주 달천강가에서 배수의 진을 치고 적과 맞서는 절체절명의 전투다.',
      4: '전라도를 지킨 권율 장군의 첫 승리 이치 전투. 험준한 산길에서 매복 전술로 일본군 정예를 격파한 전술의 정수를 경험하라.',
      5: '이순신 장군이 학익진으로 적 함대를 섬멸한 한산도 대첩. 거북선과 판옥선이 활약하는 해상 전투에서 적을 포위 섬멸하라.',
      6: '1593년 권율 장군이 3만 적군을 2,300명으로 격파한 행주대첩. 아낙네들까지 돌을 날라 싸운 전민항전의 현장이다.',
      7: '진주목사 김시민이 3,800명으로 3만 적군을 막아낸 진주성 1차 전투. 성벽 위에서 쏟아지는 화살과 뜨거운 기름의 방어전이다.',
      8: '홍의장군 곽재우가 의병을 일으킨 전장. 정규군이 아닌 백성들이 스스로 일어나 나라를 구하는 감동적인 전투다.',
      9: '조명연합군이 반격에 나선 직산 전투. 명나라 원군과 조선군이 합세하여 일본군을 밀어내는 대규모 반격전이 펼쳐진다.',
      10: '혹한의 겨울 울산에서 벌어진 사투. 성안에 갇힌 적군도, 포위한 아군도 얼어붙는 추위 속에서 치열한 공방전이 계속된다.',
      11: '거북선의 함포가 불을 뿜는 사천해전. 이순신 장군의 거북선이 적진을 돌파하며 함포 사격으로 적선을 격침시키는 해상 전투다.',
      12: '13척의 배로 133척의 적 함대를 격파한 기적의 명량해전. 울돌목의 빠른 물살을 이용한 이순신 장군의 신의 한 수를 체험하라.',
      13: '임진왜란 마지막 해전 직전의 긴장된 전투. 전쟁을 끝내기 위한 최후의 준비가 진행되는 노량 앞바다의 전야제다.',
      14: '이순신 장군이 "나의 죽음을 알리지 말라"는 유언을 남긴 노량해전. 전쟁을 끝내기 위해 목숨을 바친 영웅의 최후 전투다.',
      15: '불멸의 영웅 이순신 장군의 정신이 깃든 최종 결전. 23전 23승 불패 신화를 이룬 성웅과의 궁극의 대결에 도전하라.',
    },
    'modern': {
      1: '1866년 병인양요, 1871년 신미양요가 벌어진 강화도 포대. 서양의 근대 무기와 처음 맞서는 충격적인 전투의 현장이다.',
      2: '1875년 일본 군함 운양호가 강화도에 침입한 사건의 재현. 근대 외교와 무력이 충돌하는 개항기의 혼란스러운 전장이다.',
      3: '대한제국의 수도 한양 광화문 앞. 열강의 이권 다툼과 내부 개혁의 소용돌이 속에서 격변하는 시대의 한복판에 선다.',
      4: '1894년 녹두장군 전봉준이 이끈 동학농민혁명의 전장. "사람이 곧 하늘"이라는 평등 사상 아래 봉기한 농민군과 함께 싸운다.',
      5: '1895년 명성황후 시해 사건이 벌어진 경복궁. 어둠 속에서 황후를 지키기 위한 긴박한 전투가 궁궐 안에서 펼쳐진다.',
      6: '독립의 의지를 상징하는 독립문 광장. 만세 운동의 함성이 울려 퍼지는 이곳에서 자주독립의 정신으로 적에 맞선다.',
      7: '항일 의병들이 산성에서 벌이는 게릴라 전투. 정규군이 아닌 의병들이 지형을 이용한 유격전으로 일본군에 저항한다.',
      8: '1920년 홍범도 장군이 이끈 독립군의 첫 대규모 승리 봉오동 전투. 깊은 계곡에 적을 유인하여 섬멸하는 매복전이다.',
      9: '1920년 김좌진 장군이 일본 정예군을 격파한 청산리 전투. 백운평, 천수바위 등에서 벌어진 6일간의 대전투를 재현한다.',
      10: '대한민국 임시정부가 있던 상해에서 독립의 불꽃을 지키는 전투. 이국 땅에서도 꺼지지 않는 독립 의지의 전장이다.',
      11: '1932년 윤봉길 의사의 도시락 폭탄 의거를 모티브로 한 전장. 단 한 번의 결정적 공격으로 적의 사기를 꺾어야 한다.',
      12: '대한민국 임시정부 산하 한국 광복군의 마지막 독립전쟁. 조국 광복을 위해 목숨을 건 전사들과 함께하는 최후의 전선이다.',
      13: '1945년 8월 15일 광복 직전의 최후 전투. 해방의 새벽이 밝아오는 이 밤에 마지막 어둠을 물리쳐야 한다.',
      14: '하얼빈 역에서 이토 히로부미를 저격한 안중근 의사의 결의가 깃든 전장. 동양 평화를 위한 영웅의 기백으로 싸운다.',
      15: '고조선부터 근대까지 모든 역사의 영웅들의 힘이 하나로 모인 최종 결전. 한국사 전체를 관통하는 궁극의 전투에서 승리하라.',
    },
  };

  const [gRows2] = await pool.query('SELECT id, key_name FROM stage_groups ORDER BY display_order');
  const gMap2 = {};
  for (const g of gRows2) gMap2[g.key_name] = g.id;

  for (const [groupKey, descs] of Object.entries(stageDescriptions)) {
    const groupId = gMap2[groupKey];
    if (!groupId) continue;
    for (const [stageNum, desc] of Object.entries(descs)) {
      await pool.query(
        'UPDATE stage_levels SET description = ? WHERE group_id = ? AND stage_number = ?',
        [desc, groupId, parseInt(stageNum)]
      ).catch(() => {});
    }
  }

  // ========== 던전 설명 및 스테이지 이름 업데이트 ==========
  await pool.query("ALTER TABLE dungeon_stages ADD COLUMN description VARCHAR(500) DEFAULT NULL").catch(() => {});

  // 던전 설명 풍부하게 업데이트
  const dungeonDescriptions = {
    forest: '고대의 저주가 스며든 어둠의 숲. 뒤틀린 나무들 사이로 불길한 안개가 피어오르고, 달빛조차 닿지 않는 깊은 곳에서는 정체불명의 울음소리가 메아리친다. 약한 몬스터들이 서식하지만, 숲 깊숙이 들어갈수록 강력한 존재가 숨어 있다. 초보 모험가들의 첫 시련장.',
    slime_cave: '형형색색의 슬라임들이 가득한 수정 동굴. 벽면의 발광 수정이 몽환적인 빛을 내뿜고, 바닥에는 끈적끈적한 점액이 흐른다. 귀여워 보이지만, 강산성 체액을 가진 슬라임부터 불꽃·얼음·독 슬라임까지 다양한 위험이 도사리고 있다.',
    cave: '대지의 심장부로 이어지는 깊은 지하 동굴. 거대한 종유석과 석순이 숲을 이루고, 지하 강이 푸른 빛으로 흐른다. 고대 문명의 흔적이 벽면에 새겨져 있으며, 어둠 속에서 바위처럼 숨어 있다가 갑자기 습격하는 강력한 몬스터들이 도사린다.',
    swamp: '독기와 장기가 자욱한 저주받은 늪지대. 보라색 안개가 시야를 가리고, 부패한 나무들 사이로 거대 곤충과 독성 식물이 위협한다. 늪 아래에서는 알 수 없는 존재가 끊임없이 거품을 일으키며, 한번 빠지면 빠져나오기 힘든 위험지대다.',
    goblin: '장난기 넘치는 도깨비들이 모여 사는 무법 마을. 훔친 보물들로 가득한 오두막, 기상천외한 함정들, 그리고 끝없는 축제가 벌어지는 곳. 만만해 보이지만 도깨비 방망이의 힘은 무시할 수 없으며, 마을 깊숙이 자리한 도깨비 왕은 엄청난 전투력을 자랑한다.',
    mountain: '원혼과 요괴가 떠도는 유령의 산. 바람 소리에 실린 귀곡성이 등산객을 미혹하고, 고대 산신당의 등불이 길을 잃게 만든다. 산 정상에는 강력한 산신령이 깃들어 있으며, 높이 오를수록 현실과 영계의 경계가 희미해져 더욱 위험해진다.',
    ocean: '바다 밑에 가라앉은 태고의 유적. 산호로 뒤덮인 기둥들과 해초에 휘감긴 신전이 심해의 어둠 속에서 신비로운 빛을 발한다. 수생 몬스터들의 절대적 영역이며, 유적 깊은 곳에는 전설의 바다뱀이 잠들어 있다는 전설이 전해진다.',
    spirit_forest: '네 원소의 정령들이 깃든 신비의 숲. 불·물·땅·바람의 에너지가 하나로 수렴하는 세계수가 중심에 서 있고, 계절이 동시에 존재하는 환상적인 경관이 펼쳐진다. 정령의 시련을 통과한 자만이 원소의 축복을 받을 수 있다.',
    temple: '고대의 사악한 의식이 벌어졌던 저주받은 사원. 부서진 석상들 사이로 보라색 저주의 기운이 소용돌이치고, 지하에는 봉인된 어둠이 서서히 깨어나고 있다. 언데드 승려와 원혼들이 배회하며, 최심부의 대사제는 죽음 이후에도 광기에 사로잡혀 있다.',
    demon: '인간 세계와 마계를 잇는 차원의 균열. 현실이 왜곡되어 하늘이 핏빛으로 물들고, 지옥의 불꽃과 유황 냄새가 진동한다. 균열을 통해 쏟아져 나오는 악마와 마족은 점점 강해지고 있으며, 균열 너머에는 마왕이 침공의 기회를 엿보고 있다.',
    dragon: '태고의 용이 잠든 화산 심장부. 용암의 강이 흐르고, 거대한 용의 뼈가 동굴 벽면에 박혀 있다. 수천 년간 축적된 보물 더미가 빛나지만, 고대의 용은 여전히 살아 숨 쉬며 자신의 영역을 침범한 자를 용서하지 않는다. 최강의 도전.',
  };

  for (const [key, desc] of Object.entries(dungeonDescriptions)) {
    await pool.query('UPDATE dungeons SET description = ? WHERE key_name = ?', [desc, key]).catch(() => {});
  }

  // 던전 스테이지 이름 및 설명 업데이트
  const dungeonStageData = {
    forest: {
      1: { name: '숲의 입구', desc: '이끼 낀 나무 문을 지나면 어둠의 숲이 시작된다. 반딧불이 희미하게 길을 안내하지만, 풀숲 사이로 작은 몬스터들의 눈이 빛난다.' },
      2: { name: '거미줄 숲', desc: '거대한 거미줄이 나무 사이를 촘촘히 잇고 있는 구역. 독거미들이 먹잇감을 기다리며, 발광 버섯이 으스스한 빛을 뿜는다.' },
      3: { name: '달빛 공터', desc: '고대 돌기둥이 원형으로 세워진 의식의 터. 달빛이 비추면 늑대의 울음소리와 함께 어둠의 존재들이 깨어난다.' },
      4: { name: '가시덤불 지대', desc: '독가시 덩굴이 얽히고설킨 위험 지대. 썩어가는 나무의 껍질에는 얼굴 같은 형상이 새겨져 있어 소름 끼친다.' },
      5: { name: '안개 계곡', desc: '짙은 안개가 자욱한 계곡의 낡은 밧줄 다리. 아래에서 폭포 소리와 함께 박쥐 떼가 날아오른다.' },
      6: { name: '고목의 안식처', desc: '속이 텅 빈 거대한 고목 내부. 선반 버섯이 은은하게 빛나는 자연의 정령이 머무는 신비로운 공간이다.' },
      7: { name: '망자의 습지', desc: '죽은 나무들이 늘어선 습지. 도깨비불이 떠다니고, 진흙 속에서 언데드의 손이 솟아오른다.' },
      8: { name: '무너진 감시탑', desc: '담쟁이로 뒤덮인 폐허의 탑. 어둠의 에너지가 뿜어져 나오며, 보스와의 전투를 앞두고 있다.' },
      9: { name: '불타는 숲길', desc: '원인 모를 불길이 숲을 휩쓸고 있다. 탈출로가 점점 좁아지는 가운데 맹렬한 화염 속에서 전투를 벌여야 한다.' },
      10: { name: '고대 수호목', desc: '숲의 심장부, 타락한 거대 고목이 깨어나 뿌리를 폭발시키며 공격한다. 어둠의 에너지가 폭주하는 최종 보스전.' },
    },
    slime_cave: {
      1: { name: '점액 입구', desc: '알록달록한 점액이 뚝뚝 떨어지는 동굴 입구. 작고 귀여운 슬라임들이 통통 튀어다닌다.' },
      2: { name: '점액 터널', desc: '벽면에 슬라임의 흔적이 남아있는 좁은 터널. 수정 결정과 푸른 빛이 환상적이다.' },
      3: { name: '녹색 연못', desc: '초록빛 슬라임 액체로 가득 찬 지하 연못. 수면에서 거품이 올라오며 슬라임이 생겨난다.' },
      4: { name: '수정 광장', desc: '프리즘 빛이 반짝이는 수정 동굴. 무지개 슬라임들이 빛을 반사하며 반짝인다.' },
      5: { name: '산성 통로', desc: '천장에서 강산성 점액이 떨어지는 위험한 통로. 바위가 부식된 흔적이 곳곳에 보인다.' },
      6: { name: '점액 폭포', desc: '거대한 슬라임 폭포가 떨어지는 대형 공간. 발광 생물들이 아름답지만 위험하다.' },
      7: { name: '빙결 구역', desc: '동굴의 냉기가 모인 빙결 지대. 얼음 슬라임들이 주위를 꽁꽁 얼리며 다가온다.' },
      8: { name: '화산 분출구', desc: '지열이 솟아오르는 구역에서 불꽃 슬라임들이 서식한다. 용암과 불의 향연.' },
      9: { name: '왕실 근위대', desc: '경화된 슬라임으로 만들어진 왕좌가 있는 방. 황금 슬라임 근위대가 왕을 지킨다.' },
      10: { name: '슬라임 킹', desc: '작은 슬라임들을 흡수하며 거대화하는 슬라임 킹과의 최종 결전. 왕관이 떠있는 거대 보스전.' },
    },
    cave: {
      1: { name: '폐광 입구', desc: '곡괭이 자국이 남아있는 버려진 광산 입구. 녹슨 광차가 방치되어 있고, 벽면에 횃불이 깜빡인다.' },
      2: { name: '광맥 터널', desc: '빛나는 광물 맥이 벽을 따라 흐르는 좁은 터널. 지하 시내물 소리가 고요를 깬다.' },
      3: { name: '세 갈래 갈림길', desc: '세 개의 어두운 터널로 갈라지는 교차로. 고대인이 새긴 방향 표시가 희미하게 남아있다.' },
      4: { name: '지하 호수', desc: '수정처럼 맑은 물이 차있는 지하 호수. 눈 없는 물고기가 헤엄치고, 푸른 빛이 수면을 비춘다.' },
      5: { name: '붕괴 구간', desc: '천장이 무너져 잔해가 쌓인 구간. 좁은 틈을 통과해야 하며, 먼지가 빛 속에서 떠다닌다.' },
      6: { name: '지하 폭포', desc: '거대한 지하 폭포가 쏟아지는 대공동. 오래된 돌다리가 심연 위를 가로지른다.' },
      7: { name: '화석 벽', desc: '선사시대 생물의 화석이 벽면에 박혀 있는 구간. 고대의 뼈가 희미하게 빛을 발한다.' },
      8: { name: '용암 튜브', desc: '식어가는 용암이 흐르는 용암관. 흑요석 결정이 지옥 같은 붉은 빛을 내뿜는다.' },
      9: { name: '지하 도시 유적', desc: '고대 지하 문명의 흔적이 남은 폐허. 돌로 깎은 건물들이 서 있는 신비로운 공간.' },
      10: { name: '심연의 골렘', desc: '동굴 최심부에서 고대 석상 골렘이 깨어난다. 룬 문자가 빛나는 눈으로 침입자를 응시하는 최종전.' },
    },
    swamp: {
      1: { name: '늪가', desc: '갈대와 부들이 무성한 늪의 가장자리. 안개가 밀려오고 개구리 울음소리가 끊이지 않는다.' },
      2: { name: '독버섯 습지', desc: '거대한 독버섯이 즐비한 깊은 늪. 독개구리와 함께 유독 가스가 피어오른다.' },
      3: { name: '고사목 숲', desc: '죽은 나무들이 늘어선 음울한 구역. 이끼가 늘어지고 도깨비불이 떠다닌다.' },
      4: { name: '유사 지대', desc: '한번 빠지면 나올 수 없는 위험한 유사 지대. 희생자들의 유품이 흩어져 있다.' },
      5: { name: '환각 버섯밭', desc: '거대 형형색색 균류가 환각 포자를 뿜는 위험 구역. 현실과 환상의 경계가 무너진다.' },
      6: { name: '썩은 다리', desc: '깊은 늪 위를 가로지르는 낡은 나무 널빤지 길. 아래에서 정체불명의 존재가 노려본다.' },
      7: { name: '벌레 둥지', desc: '죽은 나무 사이에 거대한 벌집이 매달려 있다. 거대 말벌과 독충들이 떼로 몰려온다.' },
      8: { name: '침몰한 유적', desc: '늪 물속에 반쯤 잠긴 고대 신전. 덩굴에 휘감긴 기둥들에서 저주의 기운이 흐른다.' },
      9: { name: '부패의 심장', desc: '늪의 가장 깊은 곳, 거대한 죽은 나무가 얼굴 형상을 하고 있다. 독의 폭포가 흐른다.' },
      10: { name: '늪의 여왕', desc: '거대한 식물 몬스터 늪의 여왕과의 결전. 파리지옥 머리들이 사방에서 공격하는 최종 보스전.' },
    },
    goblin: {
      1: { name: '초소', desc: '조잡한 나무 울타리와 경고용 해골이 세워진 도깨비 초소. 모닥불 연기가 피어오른다.' },
      2: { name: '장물 시장', desc: '도깨비들이 훔친 물건으로 북적이는 혼란의 시장. 다채로운 천막과 속임수가 가득하다.' },
      3: { name: '함정 통로', desc: '스프링 장치, 함정 구덩이, 굴러오는 통나무까지. 도깨비들의 장난이 빈틈없이 설치된 위험한 길.' },
      4: { name: '발명 공방', desc: '도깨비 발명가의 작업실. 원시적인 기계와 폭발물 통이 가득하며, 언제 터질지 모른다.' },
      5: { name: '투기장', desc: '도깨비들이 환호하는 전투의 구덩이. 뼈로 장식된 투기장에서 실력을 증명해야 한다.' },
      6: { name: '보물 창고', desc: '금화가 산더미처럼 쌓인 도깨비 보물 창고. 도굴한 유물과 보석들이 가득하다.' },
      7: { name: '주술사의 오두막', desc: '도깨비 주술사의 은밀한 거처. 부적과 가마솥, 부두 인형이 가득한 마법의 공간.' },
      8: { name: '전쟁 준비', desc: '공성 무기를 제작 중인 도깨비 전쟁 캠프. 군기가 세워지고 대규모 공격을 준비하고 있다.' },
      9: { name: '왕궁 입구', desc: '정예 경비가 지키는 도깨비 왕궁의 입구. 훔친 갑옷을 입은 근위대가 대기 중이다.' },
      10: { name: '도깨비 대왕', desc: '도적질한 왕관과 갑옷을 걸친 도깨비 대왕과의 최종 결전. 방망이의 파괴력은 상상 이상이다.' },
    },
    mountain: {
      1: { name: '등산로 입구', desc: '고대 석문으로 시작되는 산길. 바람에 흔들리는 소나무와 발아래 자욱한 안개가 펼쳐진다.' },
      2: { name: '벼랑길', desc: '아찔한 높이의 바위 절벽 길. 느슨한 돌이 굴러떨어지고, 독수리 둥지가 보인다.' },
      3: { name: '영혼의 굴', desc: '영혼의 등불이 떠다니는 산속 동굴. 고대 수행자의 명상 터로, 귀곡성이 울린다.' },
      4: { name: '폭풍 능선', desc: '기도 깃발이 찢어진 채 펄럭이는 능선. 맹렬한 바람과 번개가 주변 봉우리를 때린다.' },
      5: { name: '폐사찰', desc: '버려진 산속 사찰. 서리 덮인 불상들이 서 있는 황량한 곳에 알 수 없는 평화가 감돈다.' },
      6: { name: '얼어붙은 폭포', desc: '절벽에 얼어붙은 거대한 폭포. 얼음 형상들이 빛나고, 그 뒤에 수정 동굴이 숨어 있다.' },
      7: { name: '구름 속 길', desc: '구름층을 통과하는 등산로. 신비로운 안개 속을 걷는 것 같은 초월적 경험의 영역.' },
      8: { name: '석인 행렬', desc: '산길 양옆에 늘어선 돌 무사 석상들. 침입자가 다가오면 눈에서 빛이 나며 움직이기 시작한다.' },
      9: { name: '산신당', desc: '산 정상의 번개 피뢰침 제단. 강력한 에너지가 쏠리고 있으며, 폭풍이 몰아친다.' },
      10: { name: '산신령', desc: '산 정상에서 폭풍 구름 속으로부터 나타나는 거대한 유령 전사. 천둥과 번개의 최종 보스전.' },
    },
    ocean: {
      1: { name: '해안 동굴', desc: '파도가 부딪히는 해안의 동굴 입구. 조개껍데기와 불가사리가 널려 있고 바닷물이 밀려온다.' },
      2: { name: '침수 터널', desc: '공기 주머니가 군데군데 있는 잠수 통로. 산호 벽면과 열대어가 환상적인 수중 세계.' },
      3: { name: '난파선', desc: '해저에 가라앉은 고대 선박의 잔해. 보물 상자가 흩어져 있고 해골 선원들이 떠다닌다.' },
      4: { name: '산호 도시', desc: '발광 생물들이 빛나는 수중 산호 도시. 해마 기사단이 순찰하는 환상적인 해저 세계.' },
      5: { name: '심해 열수구', desc: '극한 수압의 깊은 바다 열수구 지대. 관벌레와 심해어가 서식하는 어둠의 심연.' },
      6: { name: '유적 정문', desc: '바다뱀 조각이 새겨진 고대 수중 신전의 정문. 따개비에 뒤덮인 거대한 문이 열린다.' },
      7: { name: '수중 미궁', desc: '해류가 복잡하게 교차하는 돌 회랑의 미로. 갇힌 공기 방에서 호흡을 이어가야 한다.' },
      8: { name: '심연의 끝', desc: '해구의 가장자리, 끝없는 어둠 아래로 거대한 그림자가 움직인다. 공포의 심해.' },
      9: { name: '진주 왕좌', desc: '진주로 만들어진 왕좌가 있는 수중 왕좌실. 해파리 샹들리에가 빛나는 아름다운 공간.' },
      10: { name: '해신', desc: '심연에서 솟아오른 거대 바다뱀이 기둥을 휘감으며 공격한다. 파도와 소용돌이의 최종 보스전.' },
    },
    spirit_forest: {
      1: { name: '빛나는 입구', desc: '발광 나비가 날아다니는 환상의 숲 입구. 황금빛 낙엽이 공중에 떠다니는 신비로운 광경.' },
      2: { name: '불의 터', desc: '성스러운 돌 위에서 춤추는 화염. 따뜻한 주황빛 속에서 불의 정령들이 소용돌이친다.' },
      3: { name: '물의 샘', desc: '물방울이 거꾸로 떠오르는 수정 샘물 숲. 물의 정령이 깃든 맑고 고요한 성역.' },
      4: { name: '땅의 협곡', desc: '고대의 얼굴이 새겨진 거대한 바위 형상들의 협곡. 이끼와 수정이 어우러진 대지의 힘.' },
      5: { name: '바람의 들판', desc: '나선형으로 풀이 휘날리는 들판. 꽃잎이 공중에 떠다니며, 바람의 정령이 춤을 춘다.' },
      6: { name: '원소 교차점', desc: '네 원소 에너지 줄기가 한 지점에서 만나는 강력한 접점. 엄청난 원소 에너지가 요동친다.' },
      7: { name: '타락 지대', desc: '어둠에 오염된 정령들의 구역. 비틀린 원소의 카오스 에너지가 공간을 왜곡한다.' },
      8: { name: '정화 시련', desc: '무지개 장벽을 통과해야 하는 정화의 시련장. 정결한 빛이 불순물을 태워버린다.' },
      9: { name: '세계수 뿌리', desc: '거대한 세계수의 뿌리 네트워크가 빛나는 지하 공간. 원소 에너지의 근원이 흐른다.' },
      10: { name: '원소 수호자', desc: '불·물·땅·바람을 합친 거대한 원소 키메라 수호자와의 최종 결전. 사원소의 폭풍.' },
    },
    temple: {
      1: { name: '사원 외문', desc: '무너져가는 사원의 바깥 문. 균열에서 저주의 에너지가 새어 나오고 있다.' },
      2: { name: '회랑', desc: '부서진 석상들이 늘어선 어두운 복도. 보라색 횃불이 깜빡이고, 벽의 그림자가 움직인다.' },
      3: { name: '기도실', desc: '뒤집어진 제단과 검은 의식 원이 그려진 기도실. 검은 촛불이 타오른다.' },
      4: { name: '금서의 서고', desc: '저주받은 두루마리가 가득한 도서관. 빛나는 글자가 새겨진 책들이 공중에 떠다닌다.' },
      5: { name: '종루', desc: '거대한 금 간 종이 매달린 종탑. 어둠의 에너지가 울려 퍼지고 박쥐 떼가 날아다닌다.' },
      6: { name: '지하 납골당', desc: '관 뚜껑이 열리며 언데드 승려들이 일어나는 지하 묘소. 신성이 더럽혀진 불경의 땅.' },
      7: { name: '거울 전', desc: '다른 시간대를 비추는 거울들이 벽에 걸린 방. 시간 왜곡이 일어나는 기묘한 공간.' },
      8: { name: '내전', desc: '핏빛 연못과 공중에 떠도는 마법진이 있는 안쪽 전당. 어둠의 힘이 최고조에 달한다.' },
      9: { name: '암흑 제단', desc: '타락한 제단과 어둠의 수정이 놓인 최종 전초 지점. 대사제의 기운이 느껴진다.' },
      10: { name: '저주받은 대사제', desc: '거대한 언데드 대사제가 암흑 마법을 휘두르는 최종 결전. 사원이 무너져 내리는 보스전.' },
    },
    demon: {
      1: { name: '균열 입구', desc: '현실이 갈라진 차원의 틈. 붉은 에너지가 새어 나오며, 혼돈의 세계로 첫 발을 디딘다.' },
      2: { name: '지옥불 평원', desc: '땅이 불타는 끝없는 황무지. 재가 눈처럼 내리고, 핏빛 하늘이 펼쳐진 지옥의 풍경.' },
      3: { name: '영혼의 다리', desc: '영혼의 강 위를 가로지르는 뼈로 만들어진 다리. 물속 비명의 얼굴들이 올려다본다.' },
      4: { name: '마계 대장간', desc: '영혼을 재료로 무기를 벼리는 악마 대장간. 어둠의 대장장이들이 쉴 새 없이 망치를 내리친다.' },
      5: { name: '살아있는 미궁', desc: '살아 있는 살점으로 이루어진 벽이 맥동하는 유기체 던전. 소름 끼치는 통로가 이어진다.' },
      6: { name: '공허의 섬들', desc: '중력을 거스르며 허공에 떠 있는 바위 조각들. 물리 법칙이 무너진 혼돈의 영역.' },
      7: { name: '마족 투기장', desc: '하급 마족들이 오락을 위해 전투를 벌이는 투기장. 어둠의 관중들이 환호한다.' },
      8: { name: '고통의 탑', desc: '끝없이 이어지는 고통의 나선 계단. 벽면에 박힌 영혼들이 비명을 지르는 마의 첨탑.' },
      9: { name: '마장 작전실', desc: '인간 세계 침공 지도가 펼쳐진 마계 장군의 작전실. 침략 계획이 진행 중이다.' },
      10: { name: '마왕', desc: '해골 왕좌에 앉은 거대한 뿔 달린 마왕과의 최종 결전. 지옥불이 폭발하는 최종 보스전.' },
    },
    dragon: {
      1: { name: '화산 입구', desc: '유황 냄새가 진동하는 화산 입구. 흑요석 바위와 열기의 일렁임이 용의 영역임을 경고한다.' },
      2: { name: '용암 터널', desc: '식어가는 용암 껍질 위를 걷는 위험한 터널. 불도롱뇽이 서식하며 주황빛이 타오른다.' },
      3: { name: '용알 둥지', desc: '다채로운 색의 거대한 알들이 화산모래 속에 묻혀 있는 부화장. 보호 마법이 감돌고 있다.' },
      4: { name: '보물 동굴', desc: '금화 산더미, 보석 유물이 반짝이는 용의 보물 창고. 탐욕의 시험이 기다린다.' },
      5: { name: '용암 호수', desc: '돌 발판 위를 뛰어 건너야 하는 용암 호수. 간헐천이 폭발하는 치명적인 횡단.' },
      6: { name: '용골 묘지', desc: '거대한 고대 용의 해골이 흩어진 장엄한 묘지. 숙연한 분위기와 잔류 에너지가 감돈다.' },
      7: { name: '흑요석 결정실', desc: '어둠의 용 마법이 수정으로 응축된 방. 압도적인 원시적 힘이 느껴진다.' },
      8: { name: '마그마 분화구', desc: '아래로 거대한 마그마 방이 보이는 화산 분출구. 극한의 열기 속 최후의 접근로.' },
      9: { name: '용의 역사실', desc: '벽면에 용 문명의 역사가 새겨진 내전. 고대 용족의 영광과 몰락이 담겨 있다.' },
      10: { name: '고대 용', desc: '거대한 화산 동굴에서 날개를 펼치며 깨어나는 태고의 용. 화염 브레스의 최종 보스전.' },
    },
  };

  // 나라별 던전 스테이지 데이터
  const countryDungeonStageData = {
    // === 한국 던전 ===
    kr_forest: {
      1: { name: '장승 길목', desc: '이끼 낀 장승이 양쪽에 서 있는 숲 입구. 무당이 매단 오색 천이 바람에 펄럭인다.' },
      2: { name: '도깨비 숲', desc: '고목 사이로 도깨비불이 하나둘 떠오른다. 발걸음 소리에 깔깔대는 웃음소리가 섞인다.' },
      3: { name: '달빛 제단', desc: '보름달 아래 돌로 쌓은 제단이 은빛으로 빛난다. 산짐승의 기운이 제단 주위를 맴돈다.' },
      4: { name: '구미호 영역', desc: '아홉 갈래 꼬리의 그림자가 나뭇잎 사이로 스친다. 매혹적인 향기가 판단력을 흐린다.' },
      5: { name: '독안개 늪', desc: '수렁에서 피어오르는 독한 안개. 도깨비불에 이끌려 들어가면 빠져나올 수 없다.' },
      6: { name: '신목 동굴', desc: '수백 년 은행나무 뿌리가 만든 동굴. 나무 정령의 숨결이 나뭇잎을 통해 속삭인다.' },
      7: { name: '호랑이 고개', desc: '바위에 깊은 발톱 자국이 남아 있다. 으르렁거리는 울림이 계곡을 타고 퍼져온다.' },
      8: { name: '무당골', desc: '깨진 부적과 놋쇠 방울이 뒹구는 버려진 굿당. 원혼의 기운이 공간을 지배한다.' },
      9: { name: '영혼의 경계', desc: '이승과 저승의 경계가 흐려지는 지대. 정처 없이 떠도는 혼백들이 눈에 보이기 시작한다.' },
      10: { name: '산군 호환', desc: '산을 다스리는 거대 백호가 포효하며 나타난다. 숲 전체가 진동하는 최종 보스전.' },
    },
    kr_mountain: {
      1: { name: '돌계단', desc: '이끼 낀 돌계단으로 시작되는 산길. 절 가는 길에 걸린 기도 깃발이 아침 안개 속에 흔들린다.' },
      2: { name: '바위 절벽', desc: '깎아지른 절벽을 따라 난 좁은 길. 아래는 구름바다, 독수리가 머리 위를 선회한다.' },
      3: { name: '산사 암자', desc: '바위 틈에 지은 작은 암자. 풍경 소리와 고요한 독경이 산바람에 실려 온다.' },
      4: { name: '용소 폭포', desc: '무지개가 걸린 폭포 아래 깊은 소. 옛날 이무기가 수행했다는 전설이 전해진다.' },
      5: { name: '철쇄 비탈', desc: '쇠사슬에 의지해 올라야 하는 까마득한 바위 비탈. 발 아래 구름이 흘러간다.' },
      6: { name: '마애불 동굴', desc: '절벽에 새긴 거대한 마애불 앞 동굴. 촛불에 비친 불상의 눈이 살아있는 듯하다.' },
      7: { name: '구름다리', desc: '봉우리 사이를 잇는 흔들다리. 바람이 세차고 구름 사이로 나는 것 같은 아찔한 느낌.' },
      8: { name: '무장 능선', desc: '돌로 깎은 사천왕상이 늘어선 능선. 침입자가 다가오면 석상의 눈에서 빛이 난다.' },
      9: { name: '산신당', desc: '정상 부근의 산신각. 호랑이 그림과 백발 노인의 초상화가 모셔진 신성한 공간.' },
      10: { name: '산신령 강림', desc: '백호를 타고 폭풍 속에서 나타나는 산신령. 천둥과 벼락이 산 전체를 뒤흔드는 최종전.' },
    },
    kr_swamp: {
      1: { name: '버려진 논', desc: '수확을 멈춘 지 오래된 황폐한 논. 허수아비에 부적이 붙어 있고 물안개가 자욱하다.' },
      2: { name: '수렁길', desc: '한 발 내디딜 때마다 발이 빠지는 검은 수렁. 거머리와 기이한 벌레들이 득시글한다.' },
      3: { name: '물귀신 늪', desc: '수면 아래에서 차가운 손이 발목을 잡는다. 물귀신의 원한이 서린 저주받은 물웅덩이.' },
      4: { name: '독버섯 군락', desc: '보랏빛 포자를 뿜는 거대 독버섯 지대. 환각을 일으키는 안개가 현실감을 앗아간다.' },
      5: { name: '침몰 마을', desc: '홍수에 잠긴 옛 마을. 지붕만 간신히 보이고 그 아래서 원혼들의 곡소리가 들린다.' },
      6: { name: '저주 제단', desc: '습지 한가운데 외딴 섬에 놓인 돌 제단. 금지된 굿이 행해진 저주받은 땅.' },
      7: { name: '도깨비불 밤', desc: '사방에서 푸른 불이 떠다니는 한밤의 늪. 불을 따라가면 더 깊은 수렁으로 빠진다.' },
      8: { name: '지네 소굴', desc: '거대한 나무 뿌리 사이에 만들어진 왕지네의 둥지. 독충과 독기가 가득하다.' },
      9: { name: '부패의 심장', desc: '늪의 모든 저주가 뿜어져 나오는 거대한 고목. 썩은 기운의 원천이 맥동하고 있다.' },
      10: { name: '이무기 부활', desc: '늪 깊은 곳에서 천 년을 기다린 이무기가 솟아오른다. 물기둥과 홍수의 최종 보스전.' },
    },
    kr_temple: {
      1: { name: '일주문', desc: '무너져 가는 일주문. 덩굴에 감긴 기둥 사이로 한때 장엄했던 사찰의 위용이 엿보인다.' },
      2: { name: '탑원', desc: '부서진 석등과 쓰러진 돌탑이 흩어진 마당. 승려 유령의 그림자가 어른거린다.' },
      3: { name: '대웅전', desc: '금이 간 불상이 서 있는 본전. 꺼지지 않는 촛불과 함께 어둠의 기운이 감돈다.' },
      4: { name: '범종루', desc: '금 간 거대 범종이 매달린 종루. 저주받은 종소리가 영혼을 불러모은다.' },
      5: { name: '장경각', desc: '흩어진 경전과 저주받은 두루마리가 떠다니는 경판 보관소. 어둠의 지식이 속삭인다.' },
      6: { name: '지하 부도전', desc: '사찰 아래 숨겨진 고승들의 부도. 봉인이 약해진 사리함에서 영혼이 새어 나온다.' },
      7: { name: '석탑 묘역', desc: '각 석탑마다 봉인된 원혼이 깃들어 있다. 봉인이 풀릴 때마다 빛이 흔들린다.' },
      8: { name: '선방', desc: '좌선 자세로 굳어진 승려 유령들이 즐비한 선방. 시간이 멈춘 듯한 소름 끼치는 고요.' },
      9: { name: '비로전', desc: '타락이 시작된 비밀 법당. 어둠의 사리가 안치된 제단에서 사악한 에너지가 흘러나온다.' },
      10: { name: '사천왕 각성', desc: '타락한 사천왕 석상이 깨어나 불의 심판을 내린다. 사찰이 무너지는 최종 보스전.' },
    },
    kr_spirit: {
      1: { name: '황천 입구', desc: '이승과 저승의 경계에 선 안개 길. 현실이 옅어지며 주변이 점점 하얗게 변한다.' },
      2: { name: '영혼의 다리', desc: '황천강 위 놓인 은빛 다리를 건너는 혼백들. 달빛 아래 슬픈 행렬이 이어진다.' },
      3: { name: '첫째 전각', desc: '이승의 행적을 심판하는 첫 번째 대전. 저울 위에 놓인 영혼의 무게가 운명을 가른다.' },
      4: { name: '전생의 숲', desc: '나무마다 다른 전생이 비치는 기이한 숲. 기억의 나뭇잎이 바람에 흩날린다.' },
      5: { name: '망각의 강', desc: '이 물을 마시면 모든 기억을 잃는다. 강가에 주저앉아 우는 영혼들의 슬픈 풍경.' },
      6: { name: '혼시장', desc: '귀신 상인들이 영혼의 기운을 거래하는 저승의 시장. 기묘한 물건들이 즐비하다.' },
      7: { name: '진실의 거울', desc: '영혼의 진짜 모습을 비추는 거울들의 방. 환상이 깨지며 숨겨진 본성이 드러난다.' },
      8: { name: '형벌의 뜰', desc: '각종 형벌이 집행되는 저승의 마당. 비명 소리가 끊이지 않는 공포의 장소.' },
      9: { name: '윤회의 수레', desc: '카르마에 따라 다음 생을 결정하는 거대한 수레바퀴가 돌아가는 운명의 방.' },
      10: { name: '염라대왕', desc: '저승을 다스리는 염라대왕의 심판. 사후 세계의 지배자와의 우주적 최종 결전.' },
    },
    // === 일본 던전 ===
    jp_forest: {
      1: { name: '이끼 토리이', desc: '이끼에 덮인 토리이 문이 삼나무 숲으로 안내한다. 코다마 정령의 울림이 들린다.' },
      2: { name: '대나무 미로', desc: '바스락거리는 소리와 함께 너구리 그림자가 스친다. 신비한 등불이 길을 비춘다.' },
      3: { name: '금줄 신목', desc: '시메나와가 감긴 거대한 고목. 성스럽지만 타락한 기운이 땅속 깊은 곳에서 올라온다.' },
      4: { name: '여우 사당', desc: '버려진 봉납함과 깨진 여우 석상이 있는 숲속 사당. 기묘한 정적이 흐른다.' },
      5: { name: '수해 깊은 숲', desc: '주가이가하라를 닮은 숲. 뒤틀린 나무들, 방황하는 영혼들, 나침반이 돌아간다.' },
      6: { name: '코다마 골짜기', desc: '수백 개의 나무 정령이 빛을 내며 노래하는 아름답고 초자연적인 공간.' },
      7: { name: '킷수네 시험', desc: '여우가 강가에서 기다린다. 환술과 속임의 시험을 통과해야 길이 열린다.' },
      8: { name: '황혼 요괴', desc: '해질녘이 되자 요괴들이 하나둘 모습을 드러낸다. 숲이 완전히 다른 세계로 바뀐다.' },
      9: { name: '오염된 신목', desc: '고목이 죽어가고 있다. 어둠의 요괴들이 모여들어 숲의 마지막 생명력을 빨아들인다.' },
      10: { name: '조로구모', desc: '거미줄에 뒤덮인 숲에서 거대한 거미 마녀 조로구모가 나타난다. 요괴숲 최종 보스전.' },
    },
    jp_mountain: {
      1: { name: '돌계단 참배', desc: '붉은 토리이가 이어지는 돌계단. 삼나무 사이로 아침 햇살이 비쳐든다.' },
      2: { name: '폭포 수행', desc: '야마부시 수행자가 찬 폭포 아래서 정신을 단련하는 영적 수련의 장소.' },
      3: { name: '텐구의 흔적', desc: '바위 길에 텐구의 깃털이 떨어져 있다. 경고의 표식들, 바람이 세차게 분다.' },
      4: { name: '비전 동굴', desc: '텐구의 수행터였던 동굴. 고대 두루마리와 무술 비기가 바위에 새겨져 있다.' },
      5: { name: '구름 위 다리', desc: '구름 아래로 까마귀 텐구들이 선회하는 아찔한 다리. 담력의 시험장.' },
      6: { name: '온천 휴식처', desc: '요괴들도 평화롭게 목욕하는 산속 온천. 일시적 휴전 지대.' },
      7: { name: '뇌격 봉', desc: '벼락에 맞은 봉우리. 뇌신의 에너지가 치직거리며 위험한 접근로를 만든다.' },
      8: { name: '승병 사찰', desc: '무술을 익힌 승려들이 수행하는 산중 사찰. 무(武)와 선(禪)이 하나가 되는 곳.' },
      9: { name: '정상 관문', desc: '신풍이 몰아치고 텐구 수호자들이 마지막 길을 막아서는 최후의 관문.' },
      10: { name: '대텐구', desc: '부채 하나로 신풍을 일으키는 대텐구와의 결전. 산의 힘이 폭발하는 최종 보스전.' },
    },
    jp_temple: {
      1: { name: '인왕문', desc: '금강역사상이 지키는 웅장한 사찰 정문. 돌등이 줄지어 서고 단풍잎이 흩날린다.' },
      2: { name: '모래 정원', desc: '정성스레 정돈된 모래 무늬가 어지럽혀져 있다. 정체불명의 발자국이 남아 있다.' },
      3: { name: '본존 법당', desc: '피눈물을 흘리는 불상과 저주받은 경전이 떠다니는 본전. 신성이 오염되어 있다.' },
      4: { name: '오층탑', desc: '각 층마다 더 깊은 어둠에 빠진 오층 탑. 올라갈수록 요괴가 기다린다.' },
      5: { name: '묘지', desc: '비석이 기울어지고 흙 사이로 손이 뻗어 나오는 사찰 뒤편 묘지. 언데드의 영역.' },
      6: { name: '범종각', desc: '금 간 범종이 저주의 음파를 만든다. 소리가 방향감각을 혼란스럽게 한다.' },
      7: { name: '비밀 지하도', desc: '벽에 오니 가면이 걸린 숨겨진 지하 통로. 함정 장치가 곳곳에 설치되어 있다.' },
      8: { name: '보물 창고', desc: '저주받은 유물들이 활성화되어 스스로 움직이며 공격해 오는 위험한 수장고.' },
      9: { name: '만다라 내전', desc: '거대한 만다라가 어둠의 에너지로 빛나며 차원의 균열이 벌어지는 최심부.' },
      10: { name: '천수관음', desc: '빙의된 천수관음 거대 석상이 천 개의 팔로 공격한다. 신성과 마성의 최종 보스전.' },
    },
    jp_ocean: {
      1: { name: '해식 동굴', desc: '파도가 부서지는 해안가 동굴. 반쯤 잠긴 토리이 너머로 제물 조개가 놓여 있다.' },
      2: { name: '산호 참배', desc: '산호로 뒤덮인 수중 토리이 문. 바다거북이 안내하고 생물 발광이 길을 비춘다.' },
      3: { name: '유령 어촌', desc: '침몰한 어촌에서 유령 어부들이 여전히 일하고 있다. 그물이 떠다니는 슬픈 풍경.' },
      4: { name: '산호 정원', desc: '해룡의 산호 정원. 거대한 산호 조형물 사이로 해마 기사단이 순찰 중이다.' },
      5: { name: '갓파 영역', desc: '수중 하천의 물살이 거센 갓파의 영토. 오이 제물이 떠다니고 있다.' },
      6: { name: '닌교 만', desc: '인어의 슬픈 노랫소리가 울리는 해만. 아름답지만 깊이 빠져들면 돌아오지 못한다.' },
      7: { name: '유령선 묘지', desc: '후나유레이의 유령선들이 잠들어 있는 해저 묘지. 등불이 어둠 속에서 흔들린다.' },
      8: { name: '진주 궁전', desc: '거대한 진주가 빛나는 궁전. 보물과 함정이 공존하는 탐욕의 시험장.' },
      9: { name: '심연 접근', desc: '우미보즈의 그림자가 아래서 어른거린다. 수압이 높아지고 어둠이 짙어지는 심해.' },
      10: { name: '류진', desc: '용궁의 왕좌에서 일어선 해룡왕 류진. 쓰나미와 소용돌이의 최종 보스전.' },
    },
    jp_spirit: {
      1: { name: '경계의 문', desc: '무너져가는 토리이를 지나면 영혼들이 흘러가는 황혼의 길이 펼쳐진다.' },
      2: { name: '사자의 행렬', desc: '한 방향으로만 걸어가는 창백한 영혼들. 종이 등불이 길을 밝히는 슬픈 행렬.' },
      3: { name: '삼도천', desc: '얕은 여울, 다리, 깊은 물살의 세 갈래 길. 생전의 업에 따라 건너는 곳이 달라진다.' },
      4: { name: '아귀 벌판', desc: '영원한 굶주림에 시달리는 아귀(가키)들이 구걸하는 처참한 들판.' },
      5: { name: '엔마 법정', desc: '엔마 대왕이 죄를 저울질하는 법정. 진실을 비추는 거대한 거울이 서 있다.' },
      6: { name: '빙한 지옥', desc: '얼어붙은 죄인들이 있는 얼음 지옥. 수정 얼음 속에 갇힌 영혼들이 보인다.' },
      7: { name: '화염 지옥', desc: '불타는 대지 위에 비명이 가득한 화염 지옥. 견딜 수 없는 열기가 몰려온다.' },
      8: { name: '검산 지옥', desc: '영혼들이 칼날 위를 걸어야 하는 검의 산. 끝없는 고통의 형벌이 이어진다.' },
      9: { name: '시니가미 궁', desc: '죽음의 신들이 모여 있는 사신의 궁전. 불길한 장엄함이 감도는 어둠의 전당.' },
      10: { name: '시니가미', desc: '대낫을 든 시니가미와의 결전. 영혼을 거두는 사신의 심판, 최종 보스전.' },
    },
    // === 중국 던전 ===
    cn_forest: {
      1: { name: '석사자 입구', desc: '고대 돌사자 한 쌍이 지키는 비취색 안개의 숲 입구. 산해경의 세계가 시작된다.' },
      2: { name: '판다 영림', desc: '영적 판다들이 서식하는 대나무 숲. 고대 무사의 유령이 수련을 계속하고 있다.' },
      3: { name: '산해경 영역', desc: '신화의 기이한 짐승들이 나타나는 구역. 책에서만 보던 존재들이 눈앞에 있다.' },
      4: { name: '반도 신목', desc: '불로장생의 복숭아가 열리는 거대한 나무. 금빛 과일이 유혹적으로 빛난다.' },
      5: { name: '호리정 굴', desc: '여우 요정(호리정)의 소굴. 아름다움과 위험이 공존하는 환술의 미궁.' },
      6: { name: '약초원', desc: '신화 속 약초가 자라는 비밀 정원. 만병통치와 치명적 독초가 나란히 자란다.' },
      7: { name: '오동 괴목', desc: '사악한 정령이 둥지를 튼 썩어가는 오동나무. 어둠의 에너지가 숲에 퍼진다.' },
      8: { name: '토지묘', desc: '숲을 관장하는 토지신의 작은 사당. 제물이 놓여 있지만 신은 떠난 듯하다.' },
      9: { name: '천년 수목', desc: '천 년을 살아 정신이 깨어난 거대 나무 정령. 고대의 지혜와 대면하는 곳.' },
      10: { name: '산해경 마수', desc: '산해경에서 빠져나온 태고의 마수와의 결전. 원시 자연의 분노가 폭발하는 최종전.' },
    },
    cn_mountain: {
      1: { name: '석문 입산', desc: '도교 부적이 새겨진 돌 아치문. 순례자들이 오르는 신선의 산이 시작된다.' },
      2: { name: '다정', desc: '현자가 신비의 차를 우려내는 구름 위의 정자. 아래로 운해가 끝없이 펼쳐진다.' },
      3: { name: '연단 동굴', desc: '불로장생의 단약을 달이는 도교 연금술 동굴. 신비로운 재료들이 부글거린다.' },
      4: { name: '수렴 폭포', desc: '용이 새겨진 폭포. 물줄기 뒤에 숨겨진 동굴이 있다는 전설이 전해진다.' },
      5: { name: '운중 보도', desc: '구름 위를 밟고 걷는 길. 천상계에 가까워지며 현기증이 밀려온다.' },
      6: { name: '무림 사찰', desc: '운무 속 무술 승려들이 수행하는 사찰. 구름 속에서 쿵후를 익히는 장관.' },
      7: { name: '옥석 광맥', desc: '영적 옥이 빛나는 광맥. 초록빛 광물의 부가 가득하지만 수호자가 지킨다.' },
      8: { name: '신선 바둑판', desc: '두 신선이 바둑을 두고 있다. 시간이 다르게 흐르는 기묘한 정자.' },
      9: { name: '곤륜 도관', desc: '천상 에너지가 수렴하는 산 정상의 도교 사원. 신의 영역에 다가선다.' },
      10: { name: '타락 신선', desc: '어둠에 물든 신선과의 결전. 타락한 곤륜의 힘이 폭발하는 최종 보스전.' },
    },
    cn_temple: {
      1: { name: '산문', desc: '돌사자 한 쌍이 지키는 거대 산문. 붉은 등롱이 즐비하고 향 연기가 자욱하다.' },
      2: { name: '향전', desc: '수천 개의 향이 타오르는 전당. 연기가 얼굴 형상을 만들어내 압도적이다.' },
      3: { name: '천왕전', desc: '네 천왕의 거대 석상이 무기를 들고 서 있다. 그 위압감에 발걸음이 멈춘다.' },
      4: { name: '보리수 마당', desc: '타락한 보리수에서 어둠의 뿌리가 뻗어 나간다. 승려들이 달아난 흔적이 있다.' },
      5: { name: '지하 진신사리', desc: '사찰 창건주의 사리가 안치된 지하 묘. 토용 수호병이 경비를 서고 있다.' },
      6: { name: '대장경각', desc: '금강경이 공중에 떠서 방어 결계를 형성하고 있다. 신성한 지식의 보고.' },
      7: { name: '진마탑', desc: '악을 가두는 봉인탑. 봉인이 약해지며 균열 사이로 사악한 에너지가 새어 나온다.' },
      8: { name: '오백나한전', desc: '500 나한 석상의 눈이 빛나며 경비를 선다. 침입자를 감시하는 무서운 수호자들.' },
      9: { name: '관음전', desc: '거대한 관음 석상이 자비에서 심판으로 변한 내전. 어둠의 자비가 가득하다.' },
      10: { name: '사천왕 분노', desc: '깨어난 사대천왕이 합체하여 분노를 폭발시킨다. 사찰이 흔들리는 최종 보스전.' },
    },
    cn_swamp: {
      1: { name: '저주받은 논', desc: '허수아비에 부적 얼굴이 달린 버려진 논. 안개가 자욱하고 어딘가에서 뛰는 소리가.' },
      2: { name: '독충 영역', desc: '기묘한 벌레와 거머리가 득시글한 독늪. 고독(蠱毒) 지역의 시작.' },
      3: { name: '강시 마을', desc: '가라앉은 마을에서 강시들이 미동 없이 서 있다. 해가 지면 뛰기 시작한다.' },
      4: { name: '독련 연못', desc: '아름답지만 치명적인 연꽃이 핀 연못. 두꺼비 요괴의 소리가 울려 퍼진다.' },
      5: { name: '무녀 오두막', desc: '묘족 무녀의 버려진 집. 고독 항아리와 벌레 사육 통이 즐비한 사술의 장소.' },
      6: { name: '지전 묘지', desc: '지전(紙錢)이 썩어가는 늪지 묘지. 배고픈 귀신들이 모여드는 음침한 곳.' },
      7: { name: '귀곡 논', desc: '유령 농부들이 끝없는 추수를 반복하는 저주받은 논. 죽음의 수확이 이어진다.' },
      8: { name: '거미정 영역', desc: '비단 덫이 사방에 깔린 거미정(蜘蛛精)의 영역. 실크 함정이 가득하다.' },
      9: { name: '저주의 우물', desc: '어둠이 부글거리며 솟아오르는 우물. 늪의 모든 저주가 이곳에서 시작되었다.' },
      10: { name: '강시왕', desc: '청나라 관복의 강시왕이 군대를 이끌고 일어난다. 부적 대결의 최종 보스전.' },
    },
    cn_spirit: {
      1: { name: '귀문관', desc: '거대한 철문에 귀신 병사가 경비를 서는 지부(地府)의 관문. 중국 저승의 시작.' },
      2: { name: '나하교', desc: '망각의 강 위 세 갈래 다리. 생전의 업에 따라 건너는 길이 달라지는 운명의 다리.' },
      3: { name: '진광 법정', desc: '첫 번째 명왕 진광왕이 생전의 행적을 심판한다. 전생을 비추는 거울이 서 있다.' },
      4: { name: '업경대', desc: '모든 죄를 낱낱이 보여주는 거울. 숨길 곳이 없는 냉혹한 진실의 장소.' },
      5: { name: '도산', desc: '칼날 위를 걸어야 하는 영혼들의 산. 비명 소리 가득한 형벌의 공포.' },
      6: { name: '유정', desc: '끓는 기름에 빠진 죄인들이 벌 받는 유정. 치솟는 열기와 고통의 형벌.' },
      7: { name: '윤회 전각', desc: '육도(六道)의 수레바퀴가 도는 전각. 카르마가 다음 생을 결정하는 운명의 방.' },
      8: { name: '맹파정', desc: '할머니 맹파가 망각의 차를 끓이는 정자. 영혼들이 줄지어 마시며 기억을 잊는다.' },
      9: { name: '우두마면 초소', desc: '소 머리와 말 얼굴의 저승 문지기가 순찰하는 초소. 마지막 관문이 다가온다.' },
      10: { name: '염라왕', desc: '지부를 다스리는 염라왕의 심판대. 우주적 정의를 건 최종 보스전.' },
    },
  };

  // 기존 + 나라별 던전 스테이지 데이터 모두 업데이트
  const allDungeonStageData = { ...dungeonStageData, ...countryDungeonStageData };

  for (const [dungeonKey, stages] of Object.entries(allDungeonStageData)) {
    const [dRows] = await pool.query('SELECT id FROM dungeons WHERE key_name = ?', [dungeonKey]);
    if (dRows.length === 0) continue;
    const dungeonId = dRows[0].id;
    for (const [stageNum, data] of Object.entries(stages)) {
      await pool.query(
        'UPDATE dungeon_stages SET name = ?, description = ? WHERE dungeon_id = ? AND stage_number = ?',
        [data.name, data.desc, dungeonId, parseInt(stageNum)]
      ).catch(() => {});
    }
  }

  // 나라별 던전 display_order 및 상세 설명 업데이트
  const countryDungeonUpdates = [
    ['kr_forest',   12, '한국의 신비로운 숲. 장승과 도깨비, 구미호가 서식하는 수묵화 같은 어둠의 원시림.'],
    ['kr_mountain', 13, '산신령이 다스리는 한국의 영산. 사천왕과 석인, 폭풍의 산신이 수행자를 시험한다.'],
    ['kr_swamp',    14, '물귀신과 독충이 도사리는 저주받은 습지. 이무기가 천 년의 잠에서 깨어나려 한다.'],
    ['kr_temple',   15, '타락한 사천왕이 지키는 폐사찰. 깨진 범종 소리가 원혼을 불러모으는 금지의 성역.'],
    ['kr_spirit',   16, '이승과 저승의 경계. 염라대왕의 심판을 받으러 가는 영혼의 길, 황천으로의 여정.'],
    ['jp_forest',   17, '요괴가 서식하는 일본의 어둠의 숲. 코다마와 킷수네, 조로구모가 기다리는 마의 원림.'],
    ['jp_mountain', 18, '텐구가 지배하는 일본의 영산. 야마부시의 수행과 뇌신의 힘이 깃든 구름 위의 수련장.'],
    ['jp_temple',   19, '오니 가면의 저주가 서린 일본 사찰. 천수관음 석상이 빙의되어 깨어나는 공포의 법당.'],
    ['jp_ocean',    20, '류진의 용궁으로 가는 깊은 바다. 갓파와 닌교, 후나유레이가 출몰하는 해저 세계.'],
    ['jp_spirit',   21, '시니가미가 지배하는 일본의 저승. 삼도천을 건너 엔마 대왕의 심판을 받는 명부의 길.'],
    ['cn_forest',   22, '산해경의 마수가 서식하는 중국 신화의 숲. 호리정과 토지신, 태고의 괴물이 숨 쉬는 곳.'],
    ['cn_mountain', 23, '곤륜산을 닮은 신선의 산. 도교 연단술과 무림 사찰, 하늘에 닿는 수행의 길.'],
    ['cn_temple',   24, '사대천왕이 분노하는 중국 대사찰. 오백나한의 눈이 빛나고 진마탑이 흔들리는 성역.'],
    ['cn_swamp',    25, '강시와 고독(蠱毒)이 도사리는 저주의 늪. 부적과 주술이 난무하는 중국 공포의 습지.'],
    ['cn_spirit',   26, '염라왕이 다스리는 중국의 지부(地府). 열 명의 명왕이 심판하는 사후 세계의 여정.'],
  ];

  for (const [key, order, desc] of countryDungeonUpdates) {
    await pool.query(
      'UPDATE dungeons SET display_order = ?, description = ? WHERE key_name = ?',
      [order, desc, key]
    ).catch(() => {});
  }

  // 나라별 던전 스테이지 생성 (없는 경우만)
  const countryDungeonKeys = [
    'kr_forest','kr_mountain','kr_swamp','kr_temple','kr_spirit',
    'jp_forest','jp_mountain','jp_temple','jp_ocean','jp_spirit',
    'cn_forest','cn_mountain','cn_temple','cn_swamp','cn_spirit',
  ];
  // 타일 타입 매핑
  const countryDungeonTiles = {
    kr_forest:'grass', kr_mountain:'stone', kr_swamp:'swamp', kr_temple:'stone', kr_spirit:'grass',
    jp_forest:'grass', jp_mountain:'stone', jp_temple:'stone', jp_ocean:'water', jp_spirit:'stone',
    cn_forest:'grass', cn_mountain:'stone', cn_temple:'stone', cn_swamp:'swamp', cn_spirit:'stone',
  };
  for (const cdk of countryDungeonKeys) {
    const [dRow] = await pool.query('SELECT id FROM dungeons WHERE key_name = ?', [cdk]);
    if (dRow.length === 0) continue;
    const did = dRow[0].id;
    const [sCheck] = await pool.query('SELECT COUNT(*) as cnt FROM dungeon_stages WHERE dungeon_id = ?', [did]);
    if (sCheck[0].cnt > 0) continue; // 이미 있으면 스킵
    const baseTile = countryDungeonTiles[cdk] || 'grass';
    for (let s = 1; s <= 10; s++) {
      const isBoss = s === 10 ? 1 : 0;
      const monsterCount = isBoss ? 4 : Math.min(1 + Math.floor(s / 3), 3);
      const monsterLvBonus = Math.floor(s / 2);
      const expBonus = s * 5 + (isBoss ? 50 : 0);
      const goldBonus = s * 3 + (isBoss ? 30 : 0);
      const w = isBoss ? 12 : 10;
      const h = isBoss ? 12 : 10;
      const name = isBoss ? `${s} (보스)` : `${s}`;
      // 기본 맵 데이터 (간단 플랫폼)
      const pSpawns = JSON.stringify([{x:1,z:1},{x:2,z:1},{x:1,z:2}]);
      const mSpawns = JSON.stringify(
        isBoss ? [{x:w-2,z:h-2},{x:w-3,z:h-2},{x:w-2,z:h-3},{x:w-3,z:h-3}]
               : [{x:w-2,z:h-2},{x:w-3,z:h-2},{x:w-2,z:h-3}]
      );
      await pool.query(
        `INSERT IGNORE INTO dungeon_stages (dungeon_id, stage_number, name, is_boss, monster_count, monster_level_bonus, reward_exp_bonus, reward_gold_bonus, map_width, map_height, base_tile_type, player_spawns, monster_spawns) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)`,
        [did, s, name, isBoss, monsterCount, monsterLvBonus, expBonus, goldBonus, w, h, baseTile, pSpawns, mSpawns]
      ).catch(() => {});
    }
    console.log(`  ${cdk}: 10 stages created`);
  }

  // 나라별 던전 스테이지 이름/설명 업데이트
  for (const [dungeonKey, stages] of Object.entries(countryDungeonStageData)) {
    const [dRows2] = await pool.query('SELECT id FROM dungeons WHERE key_name = ?', [dungeonKey]);
    if (dRows2.length === 0) continue;
    const dungeonId2 = dRows2[0].id;
    for (const [stageNum, data] of Object.entries(stages)) {
      await pool.query(
        'UPDATE dungeon_stages SET name = ?, description = ? WHERE dungeon_id = ? AND stage_number = ?',
        [data.name, data.desc, dungeonId2, parseInt(stageNum)]
      ).catch(() => {});
    }
  }

  // ========== 대장간 시스템 ==========

  // items 테이블에 등급, 강화 관련 컬럼 추가
  await pool.query("ALTER TABLE items ADD COLUMN grade ENUM('일반','고급','희귀','영웅','전설','신화','초월') DEFAULT '일반'").catch(() => {});
  await pool.query("ALTER TABLE items MODIFY COLUMN grade ENUM('일반','고급','희귀','영웅','전설','신화','초월') DEFAULT '일반'").catch(() => {});
  await pool.query("ALTER TABLE items ADD COLUMN max_enhance INT DEFAULT 0").catch(() => {});
  await pool.query("ALTER TABLE items ADD COLUMN craftable TINYINT(1) DEFAULT 0").catch(() => {});

  // inventory 테이블에 강화 레벨 추가
  await pool.query("ALTER TABLE inventory ADD COLUMN enhance_level INT DEFAULT 0").catch(() => {});
  // UNIQUE KEY 제거 (장비 중복 보유 허용)
  await pool.query("ALTER TABLE inventory DROP INDEX unique_char_item").catch(() => {});

  // 기존 장비에 등급 설정 (required_level 기반)
  await pool.query("UPDATE items SET grade='일반', max_enhance=5 WHERE type != 'potion' AND required_level <= 1 AND grade='일반' AND max_enhance=0").catch(() => {});
  await pool.query("UPDATE items SET grade='고급', max_enhance=7 WHERE type != 'potion' AND required_level BETWEEN 2 AND 3 AND grade='일반' AND max_enhance=0").catch(() => {});
  await pool.query("UPDATE items SET grade='희귀', max_enhance=10 WHERE type != 'potion' AND required_level BETWEEN 4 AND 5 AND grade='일반' AND max_enhance=0").catch(() => {});
  await pool.query("UPDATE items SET grade='영웅', max_enhance=12 WHERE type != 'potion' AND required_level BETWEEN 6 AND 7 AND grade='일반' AND max_enhance=0").catch(() => {});
  await pool.query("UPDATE items SET grade='전설', max_enhance=15 WHERE type != 'potion' AND required_level BETWEEN 8 AND 12 AND grade='일반' AND max_enhance=0").catch(() => {});
  await pool.query("UPDATE items SET grade='신화', max_enhance=20 WHERE type != 'potion' AND required_level >= 13 AND (grade='일반' OR grade='전설') AND max_enhance<=15").catch(() => {});

  // 재료 아이템 테이블
  await pool.query(`
    CREATE TABLE IF NOT EXISTS materials (
      id INT AUTO_INCREMENT PRIMARY KEY,
      name VARCHAR(50) NOT NULL UNIQUE,
      icon VARCHAR(10) DEFAULT '🪨',
      grade ENUM('일반','고급','희귀','영웅','전설','신화','초월') DEFAULT '일반',
      description VARCHAR(200),
      sell_price INT DEFAULT 5
    )
  `);
  await pool.query("ALTER TABLE materials MODIFY COLUMN grade ENUM('일반','고급','희귀','영웅','전설','신화','초월') DEFAULT '일반'").catch(() => {});

  // 재료 인벤토리
  await pool.query(`
    CREATE TABLE IF NOT EXISTS material_inventory (
      id INT AUTO_INCREMENT PRIMARY KEY,
      character_id INT NOT NULL,
      material_id INT NOT NULL,
      quantity INT DEFAULT 0,
      FOREIGN KEY (character_id) REFERENCES characters(id) ON DELETE CASCADE,
      FOREIGN KEY (material_id) REFERENCES materials(id),
      UNIQUE KEY unique_char_material (character_id, material_id)
    )
  `);

  // 몬스터 드랍 테이블
  await pool.query(`
    CREATE TABLE IF NOT EXISTS monster_drops (
      id INT AUTO_INCREMENT PRIMARY KEY,
      monster_id INT NOT NULL,
      material_id INT NOT NULL,
      drop_rate FLOAT DEFAULT 0.3,
      min_quantity INT DEFAULT 1,
      max_quantity INT DEFAULT 1,
      FOREIGN KEY (monster_id) REFERENCES monsters(id) ON DELETE CASCADE,
      FOREIGN KEY (material_id) REFERENCES materials(id),
      UNIQUE KEY unique_monster_material (monster_id, material_id)
    )
  `);

  // 제작 레시피 테이블
  await pool.query(`
    CREATE TABLE IF NOT EXISTS crafting_recipes (
      id INT AUTO_INCREMENT PRIMARY KEY,
      result_item_id INT NOT NULL,
      gold_cost INT DEFAULT 100,
      required_level INT DEFAULT 1,
      FOREIGN KEY (result_item_id) REFERENCES items(id)
    )
  `);

  // 제작 재료 요구 사항
  await pool.query(`
    CREATE TABLE IF NOT EXISTS recipe_materials (
      id INT AUTO_INCREMENT PRIMARY KEY,
      recipe_id INT NOT NULL,
      material_id INT NOT NULL,
      quantity INT DEFAULT 1,
      FOREIGN KEY (recipe_id) REFERENCES crafting_recipes(id) ON DELETE CASCADE,
      FOREIGN KEY (material_id) REFERENCES materials(id)
    )
  `);

  // 강화 비용 테이블 (강화 레벨별 성공률, 비용)
  await pool.query(`
    CREATE TABLE IF NOT EXISTS enhance_rates (
      id INT AUTO_INCREMENT PRIMARY KEY,
      enhance_level INT NOT NULL,
      success_rate FLOAT NOT NULL DEFAULT 1.0,
      gold_cost INT NOT NULL DEFAULT 100,
      material_count INT NOT NULL DEFAULT 1,
      stat_bonus_percent FLOAT NOT NULL DEFAULT 0.05,
      UNIQUE KEY unique_level (enhance_level)
    )
  `);

  // 강화 레벨별 성공률/비용 시드
  const [existingEnhance] = await pool.query('SELECT COUNT(*) as cnt FROM enhance_rates');
  if (existingEnhance[0].cnt === 0) {
    await pool.query(`INSERT INTO enhance_rates (enhance_level, success_rate, gold_cost, material_count, stat_bonus_percent) VALUES
      (1,  1.00,    80, 1, 0.05),
      (2,  0.97,   160, 1, 0.05),
      (3,  0.93,   320, 2, 0.05),
      (4,  0.88,   480, 2, 0.06),
      (5,  0.82,   800, 3, 0.06),
      (6,  0.72,  1200, 3, 0.07),
      (7,  0.60,  1600, 4, 0.07),
      (8,  0.50,  2400, 5, 0.08),
      (9,  0.40,  3200, 6, 0.08),
      (10, 0.30,  4000, 7, 0.09),
      (11, 0.23,  5600, 8, 0.09),
      (12, 0.16,  7200, 10, 0.10),
      (13, 0.11,  9600, 12, 0.10),
      (14, 0.07,  12000, 15, 0.11),
      (15, 0.05,  16000, 20, 0.12),
      (16, 0.04,  24000, 25, 0.13),
      (17, 0.03,  32000, 30, 0.13),
      (18, 0.025, 44000, 35, 0.14),
      (19, 0.015, 60000, 40, 0.14),
      (20, 0.02,  80000, 50, 0.15)
    `);
  }

  // 재료 시드
  const [existingMats] = await pool.query('SELECT COUNT(*) as cnt FROM materials');
  if (existingMats[0].cnt === 0) {
    await pool.query(`INSERT INTO materials (name, icon, grade, description, sell_price) VALUES
      ('철 조각',     '🔩', '일반', '흔한 철 파편. 기본 장비 제작에 사용.', 5),
      ('가죽 조각',   '🟤', '일반', '동물에서 얻은 가죽 조각.', 5),
      ('뼈 파편',     '🦴', '일반', '몬스터의 뼈 파편.', 5),
      ('독 주머니',   '💚', '일반', '독 몬스터에서 채취한 독낭.', 8),
      ('마력 결정',   '💎', '고급', '마력이 응축된 결정체.', 15),
      ('정령석',      '✨', '고급', '정령의 힘이 깃든 돌.', 20),
      ('용의 비늘',   '🐉', '희귀', '용에서 떨어진 비늘 파편.', 50),
      ('귀혼석',      '👻', '고급', '귀신의 영혼이 깃든 돌.', 18),
      ('도깨비 방망이 조각', '👺', '고급', '도깨비 방망이의 파편.', 15),
      ('해양 진주',   '🫧', '고급', '수생 몬스터에서 얻은 진주.', 20),
      ('악마의 핵',   '😈', '희귀', '악마의 힘이 응축된 핵.', 40),
      ('불꽃 정수',   '🔥', '희귀', '불의 원소가 응축된 정수.', 35),
      ('얼음 정수',   '❄️', '희귀', '얼음의 원소가 응축된 정수.', 35),
      ('강화석',      '⬆️', '일반', '장비 강화에 사용되는 마법 돌.', 10),
      ('고급 강화석', '🔷', '고급', '고급 장비 강화에 사용되는 돌.', 25),
      ('희귀 강화석', '💠', '희귀', '희귀 이상 장비 강화에 사용되는 돌.', 60),
      ('영웅 강화석', '🏆', '영웅', '영웅 등급 장비 강화에 사용되는 돌.', 120),
      ('전설 강화석', '⭐', '전설', '전설 등급 장비 강화에 사용되는 돌.', 250),
      ('슬라임 젤리', '🫧', '일반', '슬라임에서 추출한 끈적한 젤리.', 5),
      ('식물 섬유',   '🌿', '일반', '살아있는 식물에서 얻은 섬유.', 5),
      ('암흑의 정수', '🖤', '영웅', '어둠의 힘이 응축된 정수.', 80),
      ('용의 심장',   '❤️‍🔥', '전설', '고대 용의 심장 파편.', 200),
      ('신화 강화석', '🌟', '신화', '신화 등급 장비 강화에 사용되는 신비로운 돌.', 500),
      ('천상의 정수', '🌈', '신화', '하늘에서 내린 신비로운 정수.', 400),
      ('불사조의 깃털','🪶', '전설', '전설의 불사조에서 떨어진 깃털.', 300),
      ('태초의 결정', '💫', '신화', '세상이 만들어질 때 생겨난 결정체.', 600),
      ('별의 파편',   '⭐', '전설', '하늘에서 떨어진 별의 파편.', 250),
      ('마신의 눈물', '💧', '영웅', '마신이 흘린 눈물이 결정화된 보석.', 150)
    `);
  }

  // 신규 재료 추가 (기존 시드 이후에도 추가 가능하도록)
  const newMaterials = [
    "('신화 강화석', '🌟', '신화', '신화 등급 장비 강화에 사용되는 신비로운 돌.', 500)",
    "('천상의 정수', '🌈', '신화', '하늘에서 내린 신비로운 정수.', 400)",
    "('불사조의 깃털','🪶', '전설', '전설의 불사조에서 떨어진 깃털.', 300)",
    "('태초의 결정', '💫', '신화', '세상이 만들어질 때 생겨난 결정체.', 600)",
    "('별의 파편',   '⭐', '전설', '하늘에서 떨어진 별의 파편.', 250)",
    "('마신의 눈물', '💧', '영웅', '마신이 흘린 눈물이 결정화된 보석.', 150)",
  ];
  for (const v of newMaterials) {
    await pool.query(`INSERT IGNORE INTO materials (name, icon, grade, description, sell_price) VALUES ${v}`).catch(() => {});
  }

  // 몬스터 드랍 설정 (카테고리 기반) - 드랍이 없는 몬스터가 있으면 추가
  {
    const [matRows] = await pool.query('SELECT id, name FROM materials');
    const mMat = {};
    for (const m of matRows) mMat[m.name] = m.id;

    // 드랍이 없는 몬스터만 가져오기
    const [monsterRows] = await pool.query(`
      SELECT m.id, m.name, m.category_id, m.tier, mc.name as cat_name
      FROM monsters m LEFT JOIN monster_categories mc ON m.category_id = mc.id
      WHERE m.id NOT IN (SELECT DISTINCT monster_id FROM monster_drops)
    `);

    if (monsterRows.length > 0) {
      const dropInserts = [];
      for (const mon of monsterRows) {
        const cat = mon.cat_name || '';
        const tier = mon.tier || 1;

        // 공통: 모든 몬스터는 철 조각/뼈 파편 드랍 가능
        if (mMat['철 조각']) dropInserts.push(`(${mon.id}, ${mMat['철 조각']}, ${tier >= 3 ? 0.15 : 0.25}, 1, ${tier >= 3 ? 2 : 1})`);
        if (mMat['뼈 파편']) dropInserts.push(`(${mon.id}, ${mMat['뼈 파편']}, 0.20, 1, 1)`);

        // 강화석 드랍 (레벨/티어 기반)
        if (tier <= 2 && mMat['강화석']) dropInserts.push(`(${mon.id}, ${mMat['강화석']}, 0.15, 1, 1)`);
        if (tier >= 3 && tier <= 4 && mMat['고급 강화석']) dropInserts.push(`(${mon.id}, ${mMat['고급 강화석']}, 0.12, 1, 1)`);
        if (tier >= 5 && mMat['희귀 강화석']) dropInserts.push(`(${mon.id}, ${mMat['희귀 강화석']}, 0.10, 1, 1)`);
        if (tier >= 6 && mMat['영웅 강화석']) dropInserts.push(`(${mon.id}, ${mMat['영웅 강화석']}, 0.06, 1, 1)`);

        // 카테고리별 특수 드랍
        if (cat === '야수' && mMat['가죽 조각']) dropInserts.push(`(${mon.id}, ${mMat['가죽 조각']}, 0.35, 1, 2)`);
        if (cat === '곤충/벌레' && mMat['독 주머니']) dropInserts.push(`(${mon.id}, ${mMat['독 주머니']}, 0.30, 1, 1)`);
        if (cat === '귀신/원혼' && mMat['귀혼석']) dropInserts.push(`(${mon.id}, ${mMat['귀혼석']}, 0.25, 1, 1)`);
        if (cat === '정령' && mMat['정령석']) dropInserts.push(`(${mon.id}, ${mMat['정령석']}, 0.30, 1, 1)`);
        if (cat === '정령' && mMat['마력 결정']) dropInserts.push(`(${mon.id}, ${mMat['마력 결정']}, 0.20, 1, 1)`);
        if (cat === '악마/마족' && mMat['악마의 핵']) dropInserts.push(`(${mon.id}, ${mMat['악마의 핵']}, 0.15, 1, 1)`);
        if (cat === '용족' && mMat['용의 비늘']) dropInserts.push(`(${mon.id}, ${mMat['용의 비늘']}, 0.20, 1, 1)`);
        if (cat === '용족' && tier >= 6 && mMat['용의 심장']) dropInserts.push(`(${mon.id}, ${mMat['용의 심장']}, 0.05, 1, 1)`);
        if (cat === '마법생물' && mMat['마력 결정']) dropInserts.push(`(${mon.id}, ${mMat['마력 결정']}, 0.25, 1, 1)`);
        if (cat === '도깨비' && mMat['도깨비 방망이 조각']) dropInserts.push(`(${mon.id}, ${mMat['도깨비 방망이 조각']}, 0.25, 1, 1)`);
        if (cat === '슬라임/연체' && mMat['슬라임 젤리']) dropInserts.push(`(${mon.id}, ${mMat['슬라임 젤리']}, 0.40, 1, 2)`);
        if (cat === '수생/해양' && mMat['해양 진주']) dropInserts.push(`(${mon.id}, ${mMat['해양 진주']}, 0.20, 1, 1)`);
        if (cat === '식물/균류' && mMat['식물 섬유']) dropInserts.push(`(${mon.id}, ${mMat['식물 섬유']}, 0.35, 1, 2)`);
        if (cat === '인간형' && mMat['마력 결정']) dropInserts.push(`(${mon.id}, ${mMat['마력 결정']}, 0.15, 1, 1)`);
        if (cat === '요괴/변이' && mMat['마력 결정']) dropInserts.push(`(${mon.id}, ${mMat['마력 결정']}, 0.20, 1, 1)`);

        // 불/얼음 정수 (이름 기반)
        if (mon.name.includes('불') && mMat['불꽃 정수']) dropInserts.push(`(${mon.id}, ${mMat['불꽃 정수']}, 0.20, 1, 1)`);
        if ((mon.name.includes('얼음') || mon.name.includes('빙') || mon.name.includes('유키')) && mMat['얼음 정수']) dropInserts.push(`(${mon.id}, ${mMat['얼음 정수']}, 0.20, 1, 1)`);

        // 고티어 암흑 정수
        if (tier >= 5 && (cat === '악마/마족' || cat === '언데드') && mMat['암흑의 정수']) {
          dropInserts.push(`(${mon.id}, ${mMat['암흑의 정수']}, 0.08, 1, 1)`);
        }

        // 고티어 보스 전설/신화 드랍
        if (tier >= 5 && mMat['불사조의 깃털']) dropInserts.push(`(${mon.id}, ${mMat['불사조의 깃털']}, 0.03, 1, 1)`);
        if (tier >= 5 && mMat['별의 파편']) dropInserts.push(`(${mon.id}, ${mMat['별의 파편']}, 0.04, 1, 1)`);
        if (tier >= 5 && mMat['전설 강화석']) dropInserts.push(`(${mon.id}, ${mMat['전설 강화석']}, 0.03, 1, 1)`);
      }

      // batch insert
      if (dropInserts.length > 0) {
        const batchSize = 100;
        for (let i = 0; i < dropInserts.length; i += batchSize) {
          const batch = dropInserts.slice(i, i + batchSize);
          await pool.query(`INSERT IGNORE INTO monster_drops (monster_id, material_id, drop_rate, min_quantity, max_quantity) VALUES ${batch.join(',')}`);
        }
      }
      console.log(`Monster drops seeded for ${monsterRows.length} monsters`);
    }
  }

  // 제작 레시피 시드
  const [existingRecipes] = await pool.query('SELECT COUNT(*) as cnt FROM crafting_recipes');
  if (existingRecipes[0].cnt === 0) {
    const [allItems] = await pool.query("SELECT id, name FROM items WHERE type != 'potion'");
    const iMap = {};
    for (const it of allItems) iMap[it.name] = it.id;

    const [matRows2] = await pool.query('SELECT id, name FROM materials');
    const mMat2 = {};
    for (const m of matRows2) mMat2[m.name] = m.id;

    // 레시피 정의: [아이템이름, 골드비용, 필요레벨, [[재료이름, 수량], ...]]
    const recipes = [
      // 무기
      ['청동 검', 200, 1, [['철 조각', 5], ['뼈 파편', 3]]],
      ['강철 검', 600, 3, [['철 조각', 10], ['마력 결정', 3], ['강화석', 2]]],
      ['사냥 활', 250, 1, [['가죽 조각', 5], ['뼈 파편', 4]]],
      ['강철 활', 700, 3, [['철 조각', 8], ['가죽 조각', 5], ['마력 결정', 2]]],
      ['소환의 부적', 150, 1, [['뼈 파편', 3], ['귀혼석', 2]]],
      ['강화 부적', 500, 3, [['귀혼석', 5], ['마력 결정', 3]]],
      ['무당 방울', 150, 1, [['철 조각', 3], ['귀혼석', 2]]],
      ['신령 방울', 500, 3, [['철 조각', 5], ['귀혼석', 4], ['마력 결정', 2]]],
      ['수련 목탁', 150, 1, [['철 조각', 3], ['식물 섬유', 3]]],
      ['금강 목탁', 500, 3, [['철 조각', 8], ['마력 결정', 3], ['강화석', 2]]],
      // 갑옷
      ['가죽 갑옷', 180, 1, [['가죽 조각', 6], ['철 조각', 2]]],
      ['사슬 갑옷', 600, 3, [['철 조각', 12], ['가죽 조각', 4]]],
      ['가죽 투구', 100, 1, [['가죽 조각', 4]]],
      ['철제 투구', 350, 3, [['철 조각', 8], ['가죽 조각', 2]]],
      ['가죽 장화', 90, 1, [['가죽 조각', 3], ['식물 섬유', 2]]],
      ['철제 장화', 300, 3, [['철 조각', 6], ['가죽 조각', 3]]],
      ['나무 방패', 120, 1, [['식물 섬유', 5], ['철 조각', 2]]],
      ['철제 방패', 400, 3, [['철 조각', 10], ['마력 결정', 2]]],
      // 액세서리
      ['구리 반지', 150, 1, [['철 조각', 4], ['마력 결정', 1]]],
      ['은 반지', 500, 3, [['철 조각', 6], ['마력 결정', 4], ['정령석', 2]]],
      ['뼈 목걸이', 130, 1, [['뼈 파편', 5], ['귀혼석', 1]]],
      ['비취 목걸이', 450, 3, [['정령석', 4], ['마력 결정', 3]]],
      // 고급 장비 (희귀 재료)
      ['용살 검', 2000, 6, [['철 조각', 20], ['용의 비늘', 5], ['불꽃 정수', 3], ['악마의 핵', 2]]],
      ['용골 활', 2200, 6, [['뼈 파편', 15], ['용의 비늘', 5], ['얼음 정수', 3]]],
      ['용의 부적', 1800, 6, [['귀혼석', 8], ['용의 비늘', 3], ['암흑의 정수', 2]]],
      ['천신 방울', 1800, 6, [['철 조각', 10], ['정령석', 6], ['용의 비늘', 3]]],
      ['파천 목탁', 1800, 6, [['철 조각', 15], ['마력 결정', 8], ['용의 비늘', 3]]],
      ['용린 갑옷', 2500, 6, [['용의 비늘', 8], ['철 조각', 15], ['암흑의 정수', 2]]],
      ['용린 투구', 1500, 6, [['용의 비늘', 5], ['철 조각', 10]]],
      ['용린 장화', 1200, 6, [['용의 비늘', 4], ['가죽 조각', 8]]],
      ['용린 방패', 1600, 6, [['용의 비늘', 6], ['철 조각', 12]]],
      ['황금 반지', 1500, 6, [['마력 결정', 8], ['용의 비늘', 2], ['악마의 핵', 2]]],
      ['용의 눈 목걸이', 1800, 6, [['용의 비늘', 4], ['용의 심장', 1], ['마력 결정', 6]]],
    ];

    for (const [itemName, gold, reqLv, mats] of recipes) {
      if (!iMap[itemName]) continue;
      const [result] = await pool.query(
        'INSERT INTO crafting_recipes (result_item_id, gold_cost, required_level) VALUES (?, ?, ?)',
        [iMap[itemName], gold, reqLv]
      );
      const recipeId = result.insertId;
      for (const [matName, qty] of mats) {
        if (!mMat2[matName]) continue;
        await pool.query(
          'INSERT INTO recipe_materials (recipe_id, material_id, quantity) VALUES (?, ?, ?)',
          [recipeId, mMat2[matName], qty]
        );
      }
    }

    // craftable 플래그 설정
    await pool.query(`UPDATE items SET craftable = 1 WHERE id IN (SELECT result_item_id FROM crafting_recipes)`);
  }

  // ========== 희귀 등급 장비 보충 ==========
  const [rareCheck] = await pool.query("SELECT id FROM items WHERE name = '암흑 갑옷'");
  if (rareCheck.length === 0) {
    const rareItems = [
      "('비전 활', 'weapon', 'weapon', '2h', '비전의 힘이 깃든 활. 범위4 직선.', 700, 350, 0, 0, 18, 0, 4, NULL)",
      "('뇌신 검', 'weapon', 'weapon', '1h', '번개의 힘이 깃든 검. 범위1 마름모.', 650, 325, 0, 0, 20, 0, 5, NULL)",
      "('영혼 부적', 'weapon', 'weapon', '2h', '풍수사 전용. 영혼의 힘이 깃든 부적.', 650, 325, 0, 35, 14, 0, 5, '풍수사')",
      "('무녀 방울', 'weapon', 'weapon', '1h', '무당 전용. 무녀의 축복을 받은 방울.', 600, 300, 0, 20, 12, 5, 4, '무당')",
      "('금강 법륜', 'weapon', 'weapon', '2h', '승려 전용. 금강 법륜.', 650, 325, 35, 0, 13, 12, 5, '승려')",
      "('암흑 갑옷', 'chest', 'chest', NULL, '어둠의 기운이 깃든 갑옷.', 500, 250, 35, 5, 0, 12, 5, NULL)",
      "('암흑 투구', 'helmet', 'helmet', NULL, '어둠의 기운이 깃든 투구.', 300, 150, 22, 3, 0, 7, 5, NULL)",
      "('암흑 장화', 'boots', 'boots', NULL, '어둠의 기운이 깃든 장화.', 250, 125, 12, 0, 2, 5, 4, NULL)",
      "('암흑 방패', 'shield', 'shield', NULL, '어둠의 기운이 깃든 방패.', 350, 175, 20, 0, 0, 14, 5, NULL)",
      "('마법석 반지', 'ring', 'ring', NULL, '마법석이 박힌 반지.', 400, 200, 0, 20, 6, 0, 4, NULL)",
      "('신목 목걸이', 'necklace', 'necklace', NULL, '신성한 나무로 만든 목걸이.', 350, 175, 15, 15, 4, 4, 5, NULL)",
    ];
    for (const v of rareItems) {
      await pool.query(`INSERT IGNORE INTO items (name, type, slot, weapon_hand, description, price, sell_price, effect_hp, effect_mp, effect_attack, effect_defense, required_level, class_restriction) VALUES ${v}`).catch(() => {});
    }
    // 희귀 등급 설정
    const rareNames = ['비전 활','뇌신 검','영혼 부적','무녀 방울','금강 법륜','암흑 갑옷','암흑 투구','암흑 장화','암흑 방패','마법석 반지','신목 목걸이'];
    for (const nm of rareNames) {
      await pool.query("UPDATE items SET grade='희귀', max_enhance=10 WHERE name=?", [nm]).catch(() => {});
    }
    // 세부 스탯
    await pool.query("UPDATE items SET effect_phys_attack=14, effect_mag_attack=3, effect_crit_rate=1 WHERE name='비전 활'").catch(() => {});
    await pool.query("UPDATE items SET effect_phys_attack=16, effect_mag_attack=3, effect_crit_rate=2 WHERE name='뇌신 검'").catch(() => {});
    await pool.query("UPDATE items SET effect_phys_attack=3, effect_mag_attack=10, effect_crit_rate=1 WHERE name='영혼 부적'").catch(() => {});
    await pool.query("UPDATE items SET effect_phys_attack=6, effect_mag_attack=7, effect_evasion=1 WHERE name='무녀 방울'").catch(() => {});
    await pool.query("UPDATE items SET effect_phys_attack=10, effect_mag_attack=2, effect_phys_defense=4 WHERE name='금강 법륜'").catch(() => {});
    await pool.query("UPDATE items SET effect_phys_defense=8, effect_mag_defense=5, effect_evasion=1 WHERE name='암흑 갑옷'").catch(() => {});
    await pool.query("UPDATE items SET effect_phys_defense=5, effect_mag_defense=3 WHERE name='암흑 투구'").catch(() => {});
    await pool.query("UPDATE items SET effect_phys_defense=3, effect_mag_defense=2, effect_evasion=2 WHERE name='암흑 장화'").catch(() => {});
    await pool.query("UPDATE items SET effect_phys_defense=10, effect_mag_defense=6 WHERE name='암흑 방패'").catch(() => {});
    await pool.query("UPDATE items SET effect_mag_defense=2, effect_crit_rate=2 WHERE name='마법석 반지'").catch(() => {});
    await pool.query("UPDATE items SET effect_phys_defense=3, effect_mag_defense=2, effect_evasion=2 WHERE name='신목 목걸이'").catch(() => {});

    // 희귀 레시피
    const [aiNew] = await pool.query("SELECT id, name FROM items WHERE type != 'potion'");
    const irMap = {};
    for (const it of aiNew) irMap[it.name] = it.id;
    const [mrNew] = await pool.query('SELECT id, name FROM materials');
    const mmrMap = {};
    for (const m of mrNew) mmrMap[m.name] = m.id;

    const rareRecipes = [
      ['비전 활', 900, 4, [['뼈 파편', 10], ['마력 결정', 5], ['얼음 정수', 2]]],
      ['뇌신 검', 1000, 5, [['철 조각', 15], ['마력 결정', 6], ['불꽃 정수', 2]]],
      ['영혼 부적', 900, 5, [['귀혼석', 6], ['마력 결정', 5], ['정령석', 4]]],
      ['무녀 방울', 800, 4, [['철 조각', 8], ['귀혼석', 5], ['정령석', 3]]],
      ['금강 법륜', 900, 5, [['철 조각', 12], ['마력 결정', 5], ['악마의 핵', 2]]],
      ['암흑 갑옷', 800, 5, [['가죽 조각', 10], ['악마의 핵', 3], ['암흑의 정수', 1]]],
      ['암흑 투구', 500, 5, [['철 조각', 8], ['악마의 핵', 2], ['뼈 파편', 5]]],
      ['암흑 장화', 400, 4, [['가죽 조각', 8], ['악마의 핵', 2]]],
      ['암흑 방패', 600, 5, [['철 조각', 10], ['악마의 핵', 3], ['마력 결정', 3]]],
      ['마법석 반지', 650, 4, [['마력 결정', 6], ['정령석', 4], ['용의 비늘', 1]]],
      ['신목 목걸이', 550, 5, [['식물 섬유', 10], ['정령석', 5], ['마력 결정', 4]]],
    ];
    for (const [itemName, gold, reqLv, mats] of rareRecipes) {
      if (!irMap[itemName]) continue;
      const [ec] = await pool.query('SELECT id FROM crafting_recipes WHERE result_item_id = ?', [irMap[itemName]]);
      if (ec.length > 0) continue;
      const [r] = await pool.query('INSERT INTO crafting_recipes (result_item_id, gold_cost, required_level) VALUES (?, ?, ?)', [irMap[itemName], gold, reqLv]);
      for (const [matName, qty] of mats) {
        if (!mmrMap[matName]) continue;
        await pool.query('INSERT INTO recipe_materials (recipe_id, material_id, quantity) VALUES (?, ?, ?)', [r.insertId, mmrMap[matName], qty]);
      }
    }
    await pool.query(`UPDATE items SET craftable = 1 WHERE id IN (SELECT result_item_id FROM crafting_recipes)`);
  }

  // ========== 전설/신화 등급 장비 추가 ==========
  const [legendCheck] = await pool.query("SELECT id FROM items WHERE name = '천마검'");
  if (legendCheck.length === 0) {
    // 전설 등급 장비 (required_level 8-10)
    const legendItems = [
      // 무기 - 공용
      "('천마검', 'weapon', 'weapon', '1h', '천마의 기운이 깃든 마검. 범위1 마름모.', 5000, 2500, 0, 0, 45, 0, 8, NULL)",
      "('파천궁', 'weapon', 'weapon', '2h', '하늘을 꿰뚫는 활. 범위4 직선.', 5500, 2750, 0, 0, 42, 0, 8, NULL)",
      // 무기 - 클래스
      "('태극 부적', 'weapon', 'weapon', '2h', '풍수사 전용. 태극의 힘이 깃든 부적.', 5000, 2500, 0, 80, 40, 0, 8, '풍수사')",
      "('만신 방울', 'weapon', 'weapon', '2h', '무당 전용. 만신의 축복을 받은 방울.', 5000, 2500, 0, 50, 35, 15, 8, '무당')",
      "('금강경 목탁', 'weapon', 'weapon', '2h', '승려 전용. 금강경의 힘이 깃든 목탁.', 5000, 2500, 80, 0, 28, 35, 8, '승려')",
      // 방어구
      "('천룡 갑옷', 'chest', 'chest', NULL, '천룡의 비늘로 만든 전설의 갑옷.', 4000, 2000, 80, 20, 0, 30, 8, NULL)",
      "('천룡 투구', 'helmet', 'helmet', NULL, '천룡의 뿔로 만든 전설의 투구.', 2500, 1250, 50, 10, 0, 18, 8, NULL)",
      "('천룡 장화', 'boots', 'boots', NULL, '천룡의 가죽으로 만든 전설의 장화.', 2200, 1100, 35, 0, 5, 12, 8, NULL)",
      "('천룡 방패', 'shield', 'shield', NULL, '천룡의 비늘로 만든 전설의 방패.', 3000, 1500, 50, 0, 0, 28, 8, NULL)",
      // 액세서리
      "('용왕의 반지', 'ring', 'ring', NULL, '용왕이 하사한 전설의 반지.', 3500, 1750, 0, 40, 14, 0, 8, NULL)",
      "('선녀의 목걸이', 'necklace', 'necklace', NULL, '선녀가 남긴 전설의 목걸이.', 3800, 1900, 35, 35, 10, 10, 8, NULL)",
    ];

    // 신화 등급 장비 (required_level 13-15)
    const mythItems = [
      // 무기 - 공용
      "('천제의 신검', 'weapon', 'weapon', '1h', '하늘의 제왕이 사용하던 신검. 범위1 마름모.', 15000, 7500, 0, 0, 80, 0, 13, NULL)",
      "('신궁 해모수', 'weapon', 'weapon', '2h', '태양신의 활. 범위4 직선.', 16000, 8000, 0, 0, 75, 0, 13, NULL)",
      // 무기 - 클래스
      "('천부인 부적', 'weapon', 'weapon', '2h', '풍수사 전용. 천부인의 힘이 깃든 신물.', 15000, 7500, 0, 150, 70, 0, 13, '풍수사')",
      "('무녀신의 방울', 'weapon', 'weapon', '2h', '무당 전용. 무녀신이 사용하던 방울.', 15000, 7500, 0, 90, 60, 30, 13, '무당')",
      "('석가의 목탁', 'weapon', 'weapon', '2h', '승려 전용. 깨달음의 목탁.', 15000, 7500, 150, 0, 50, 60, 13, '승려')",
      // 방어구
      "('신룡황 갑옷', 'chest', 'chest', NULL, '신룡황의 비늘로 주조한 신화의 갑옷.', 12000, 6000, 150, 40, 0, 55, 13, NULL)",
      "('신룡황 투구', 'helmet', 'helmet', NULL, '신룡황의 뿔로 만든 신화의 투구.', 8000, 4000, 90, 20, 0, 35, 13, NULL)",
      "('신룡황 장화', 'boots', 'boots', NULL, '신룡황의 가죽으로 만든 신화의 장화.', 7000, 3500, 60, 0, 10, 22, 13, NULL)",
      "('신룡황 방패', 'shield', 'shield', NULL, '신룡황의 비늘로 만든 신화의 방패.', 10000, 5000, 90, 0, 0, 50, 13, NULL)",
      // 액세서리
      "('환인의 반지', 'ring', 'ring', NULL, '환인이 하사한 신화의 반지.', 10000, 5000, 0, 80, 25, 0, 13, NULL)",
      "('삼신의 목걸이', 'necklace', 'necklace', NULL, '삼신할미의 목걸이. 생명력이 넘친다.', 11000, 5500, 70, 70, 18, 18, 13, NULL)",
    ];

    for (const v of [...legendItems, ...mythItems]) {
      await pool.query(`INSERT IGNORE INTO items (name, type, slot, weapon_hand, description, price, sell_price, effect_hp, effect_mp, effect_attack, effect_defense, required_level, class_restriction) VALUES ${v}`).catch(() => {});
    }

    // 전설 등급 설정
    const legendNames = ['천마검','파천궁','태극 부적','만신 방울','금강경 목탁','천룡 갑옷','천룡 투구','천룡 장화','천룡 방패','용왕의 반지','선녀의 목걸이'];
    for (const nm of legendNames) {
      await pool.query("UPDATE items SET grade='전설', max_enhance=15 WHERE name=? AND grade='일반'", [nm]).catch(() => {});
    }

    // 신화 등급 설정
    const mythNames = ['천제의 신검','신궁 해모수','천부인 부적','무녀신의 방울','석가의 목탁','신룡황 갑옷','신룡황 투구','신룡황 장화','신룡황 방패','환인의 반지','삼신의 목걸이'];
    for (const nm of mythNames) {
      await pool.query("UPDATE items SET grade='신화', max_enhance=20 WHERE name=?", [nm]).catch(() => {});
    }

    // 전설/신화 장비에 세부 스탯 추가
    // 전설 무기
    await pool.query("UPDATE items SET effect_phys_attack=35, effect_mag_attack=8, effect_crit_rate=3 WHERE name='천마검'").catch(() => {});
    await pool.query("UPDATE items SET effect_phys_attack=33, effect_mag_attack=7, effect_crit_rate=4 WHERE name='파천궁'").catch(() => {});
    await pool.query("UPDATE items SET effect_phys_attack=10, effect_mag_attack=32, effect_crit_rate=2 WHERE name='태극 부적'").catch(() => {});
    await pool.query("UPDATE items SET effect_phys_attack=18, effect_mag_attack=20, effect_crit_rate=2, effect_evasion=2 WHERE name='만신 방울'").catch(() => {});
    await pool.query("UPDATE items SET effect_phys_attack=22, effect_mag_attack=5, effect_phys_defense=8, effect_mag_defense=5 WHERE name='금강경 목탁'").catch(() => {});
    // 전설 방어구
    await pool.query("UPDATE items SET effect_phys_defense=20, effect_mag_defense=12, effect_evasion=2 WHERE name='천룡 갑옷'").catch(() => {});
    await pool.query("UPDATE items SET effect_phys_defense=12, effect_mag_defense=8, effect_evasion=1 WHERE name='천룡 투구'").catch(() => {});
    await pool.query("UPDATE items SET effect_phys_defense=7, effect_mag_defense=4, effect_evasion=3 WHERE name='천룡 장화'").catch(() => {});
    await pool.query("UPDATE items SET effect_phys_defense=18, effect_mag_defense=10 WHERE name='천룡 방패'").catch(() => {});
    // 전설 액세서리
    await pool.query("UPDATE items SET effect_mag_defense=3, effect_crit_rate=4 WHERE name='용왕의 반지'").catch(() => {});
    await pool.query("UPDATE items SET effect_phys_defense=6, effect_mag_defense=4, effect_evasion=4 WHERE name='선녀의 목걸이'").catch(() => {});

    // 신화 무기
    await pool.query("UPDATE items SET effect_phys_attack=65, effect_mag_attack=15, effect_crit_rate=6 WHERE name='천제의 신검'").catch(() => {});
    await pool.query("UPDATE items SET effect_phys_attack=60, effect_mag_attack=12, effect_crit_rate=8 WHERE name='신궁 해모수'").catch(() => {});
    await pool.query("UPDATE items SET effect_phys_attack=18, effect_mag_attack=58, effect_crit_rate=4 WHERE name='천부인 부적'").catch(() => {});
    await pool.query("UPDATE items SET effect_phys_attack=32, effect_mag_attack=35, effect_crit_rate=3, effect_evasion=4 WHERE name='무녀신의 방울'").catch(() => {});
    await pool.query("UPDATE items SET effect_phys_attack=40, effect_mag_attack=10, effect_phys_defense=15, effect_mag_defense=10 WHERE name='석가의 목탁'").catch(() => {});
    // 신화 방어구
    await pool.query("UPDATE items SET effect_phys_defense=38, effect_mag_defense=22, effect_evasion=3 WHERE name='신룡황 갑옷'").catch(() => {});
    await pool.query("UPDATE items SET effect_phys_defense=22, effect_mag_defense=15, effect_evasion=2 WHERE name='신룡황 투구'").catch(() => {});
    await pool.query("UPDATE items SET effect_phys_defense=14, effect_mag_defense=8, effect_evasion=5 WHERE name='신룡황 장화'").catch(() => {});
    await pool.query("UPDATE items SET effect_phys_defense=32, effect_mag_defense=20 WHERE name='신룡황 방패'").catch(() => {});
    // 신화 액세서리
    await pool.query("UPDATE items SET effect_mag_defense=5, effect_crit_rate=7 WHERE name='환인의 반지'").catch(() => {});
    await pool.query("UPDATE items SET effect_phys_defense=10, effect_mag_defense=8, effect_evasion=6 WHERE name='삼신의 목걸이'").catch(() => {});

    // ====== 전설/신화 레시피 추가 ======
    const [allItemsNew] = await pool.query("SELECT id, name FROM items WHERE type != 'potion'");
    const iMapNew = {};
    for (const it of allItemsNew) iMapNew[it.name] = it.id;

    const [matRowsNew] = await pool.query('SELECT id, name FROM materials');
    const mMatNew = {};
    for (const m of matRowsNew) mMatNew[m.name] = m.id;

    const newRecipes = [
      // 전설 무기
      ['천마검', 5000, 8, [['용의 심장', 2], ['불꽃 정수', 8], ['악마의 핵', 6], ['암흑의 정수', 4]]],
      ['파천궁', 5500, 8, [['용의 비늘', 12], ['얼음 정수', 8], ['별의 파편', 3], ['마력 결정', 10]]],
      ['태극 부적', 5000, 8, [['용의 심장', 2], ['정령석', 10], ['마력 결정', 12], ['암흑의 정수', 4]]],
      ['만신 방울', 5000, 8, [['귀혼석', 12], ['정령석', 8], ['용의 비늘', 6], ['별의 파편', 3]]],
      ['금강경 목탁', 5000, 8, [['용의 심장', 2], ['철 조각', 30], ['불꽃 정수', 6], ['마력 결정', 8]]],
      // 전설 방어구
      ['천룡 갑옷', 4000, 8, [['용의 비늘', 15], ['용의 심장', 1], ['암흑의 정수', 5], ['철 조각', 25]]],
      ['천룡 투구', 2500, 8, [['용의 비늘', 10], ['불꽃 정수', 5], ['철 조각', 15]]],
      ['천룡 장화', 2200, 8, [['용의 비늘', 8], ['가죽 조각', 15], ['별의 파편', 2]]],
      ['천룡 방패', 3000, 8, [['용의 비늘', 12], ['용의 심장', 1], ['철 조각', 20]]],
      // 전설 액세서리
      ['용왕의 반지', 3500, 8, [['용의 심장', 1], ['마력 결정', 12], ['해양 진주', 8], ['별의 파편', 3]]],
      ['선녀의 목걸이', 3800, 8, [['정령석', 10], ['얼음 정수', 6], ['불꽃 정수', 6], ['별의 파편', 4]]],
      // 신화 무기
      ['천제의 신검', 20000, 13, [['용의 심장', 5], ['불사조의 깃털', 3], ['태초의 결정', 2], ['천상의 정수', 4], ['별의 파편', 8]]],
      ['신궁 해모수', 22000, 13, [['용의 심장', 4], ['불사조의 깃털', 4], ['태초의 결정', 2], ['천상의 정수', 3], ['별의 파편', 10]]],
      ['천부인 부적', 20000, 13, [['용의 심장', 5], ['천상의 정수', 5], ['태초의 결정', 3], ['정령석', 20]]],
      ['무녀신의 방울', 20000, 13, [['용의 심장', 4], ['불사조의 깃털', 3], ['태초의 결정', 2], ['귀혼석', 20], ['천상의 정수', 3]]],
      ['석가의 목탁', 20000, 13, [['용의 심장', 5], ['태초의 결정', 3], ['천상의 정수', 4], ['마신의 눈물', 5]]],
      // 신화 방어구
      ['신룡황 갑옷', 18000, 13, [['용의 심장', 4], ['태초의 결정', 3], ['천상의 정수', 4], ['불사조의 깃털', 3], ['용의 비늘', 25]]],
      ['신룡황 투구', 12000, 13, [['용의 심장', 3], ['태초의 결정', 2], ['천상의 정수', 3], ['용의 비늘', 15]]],
      ['신룡황 장화', 10000, 13, [['용의 심장', 2], ['태초의 결정', 2], ['천상의 정수', 2], ['가죽 조각', 25]]],
      ['신룡황 방패', 15000, 13, [['용의 심장', 3], ['태초의 결정', 3], ['천상의 정수', 3], ['용의 비늘', 20]]],
      // 신화 액세서리
      ['환인의 반지', 15000, 13, [['용의 심장', 3], ['태초의 결정', 2], ['천상의 정수', 3], ['마신의 눈물', 4], ['별의 파편', 10]]],
      ['삼신의 목걸이', 16000, 13, [['용의 심장', 3], ['태초의 결정', 2], ['천상의 정수', 4], ['불사조의 깃털', 3], ['정령석', 15]]],
    ];

    for (const [itemName, gold, reqLv, mats] of newRecipes) {
      if (!iMapNew[itemName]) continue;
      // Check if recipe exists already
      const [existCheck] = await pool.query('SELECT id FROM crafting_recipes WHERE result_item_id = ?', [iMapNew[itemName]]);
      if (existCheck.length > 0) continue;
      const [result] = await pool.query(
        'INSERT INTO crafting_recipes (result_item_id, gold_cost, required_level) VALUES (?, ?, ?)',
        [iMapNew[itemName], gold, reqLv]
      );
      const recipeId = result.insertId;
      for (const [matName, qty] of mats) {
        if (!mMatNew[matName]) continue;
        await pool.query(
          'INSERT INTO recipe_materials (recipe_id, material_id, quantity) VALUES (?, ?, ?)',
          [recipeId, mMatNew[matName], qty]
        );
      }
    }

    // craftable 플래그 업데이트
    await pool.query(`UPDATE items SET craftable = 1 WHERE id IN (SELECT result_item_id FROM crafting_recipes)`);
  }

  // 신화 강화석 드랍 (고티어 보스 몬스터)
  {
    const [matCheck] = await pool.query("SELECT id FROM materials WHERE name='신화 강화석'");
    if (matCheck.length > 0) {
      const mythStoneId = matCheck[0].id;
      const [existDrop] = await pool.query("SELECT id FROM monster_drops WHERE material_id=? LIMIT 1", [mythStoneId]);
      if (existDrop.length === 0) {
        const [bossMonsters] = await pool.query("SELECT id FROM monsters WHERE tier >= 7");
        for (const mon of bossMonsters) {
          await pool.query("INSERT IGNORE INTO monster_drops (monster_id, material_id, drop_rate, min_quantity, max_quantity) VALUES (?, ?, 0.03, 1, 1)", [mon.id, mythStoneId]).catch(() => {});
        }
        // 전설 강화석도 고티어에 추가
        const [legStone] = await pool.query("SELECT id FROM materials WHERE name='전설 강화석'");
        if (legStone.length > 0) {
          const [highMonsters] = await pool.query("SELECT id FROM monsters WHERE tier >= 6");
          for (const mon of highMonsters) {
            await pool.query("INSERT IGNORE INTO monster_drops (monster_id, material_id, drop_rate, min_quantity, max_quantity) VALUES (?, ?, 0.05, 1, 1)", [mon.id, legStone[0].id]).catch(() => {});
          }
        }
        // 신규 재료 드랍 추가
        const newMatDrops = [
          ['불사조의 깃털', 7, 0.04],
          ['천상의 정수', 7, 0.03],
          ['태초의 결정', 8, 0.02],
          ['별의 파편', 6, 0.06],
          ['마신의 눈물', 6, 0.05],
        ];
        for (const [matName, minTier, rate] of newMatDrops) {
          const [mat] = await pool.query("SELECT id FROM materials WHERE name=?", [matName]);
          if (mat.length === 0) continue;
          const [tierMons] = await pool.query("SELECT id FROM monsters WHERE tier >= ?", [minTier]);
          for (const mon of tierMons) {
            await pool.query("INSERT IGNORE INTO monster_drops (monster_id, material_id, drop_rate, min_quantity, max_quantity) VALUES (?, ?, ?, 1, 1)", [mon.id, mat[0].id, rate]).catch(() => {});
          }
        }
      }
    }
  }

  // ========== 속성 시스템 ==========
  await pool.query(`
    CREATE TABLE IF NOT EXISTS element_relations (
      id INT AUTO_INCREMENT PRIMARY KEY,
      attacker ENUM('fire','water','earth','wind','neutral') NOT NULL,
      defender ENUM('fire','water','earth','wind','neutral') NOT NULL,
      multiplier FLOAT NOT NULL DEFAULT 1.0,
      UNIQUE KEY unique_relation (attacker, defender)
    )
  `);

  const [elCheck] = await pool.query('SELECT COUNT(*) as cnt FROM element_relations');
  if (elCheck[0].cnt === 0) {
    await pool.query(`INSERT INTO element_relations (attacker, defender, multiplier) VALUES
      ('fire','fire',1.0),    ('fire','water',0.5),   ('fire','earth',1.5),  ('fire','wind',1.5),   ('fire','neutral',1.0),
      ('water','fire',2.0),   ('water','water',1.0),  ('water','earth',1.5), ('water','wind',0.5),  ('water','neutral',1.0),
      ('earth','fire',0.5),   ('earth','water',0.5),  ('earth','earth',1.0), ('earth','wind',2.0),  ('earth','neutral',1.0),
      ('wind','fire',1.5),    ('wind','water',2.0),   ('wind','earth',0.5),  ('wind','wind',1.0),   ('wind','neutral',1.0),
      ('neutral','fire',1.0), ('neutral','water',1.0),('neutral','earth',1.0),('neutral','wind',1.0),('neutral','neutral',1.0)
    `);
  }

  // 몬스터 속성 배정 (카테고리 기반) - neutral인 몬스터가 있으면 항상 실행
  const [elMonNeutral] = await pool.query("SELECT COUNT(*) as cnt FROM monsters WHERE element = 'neutral' AND category_id IS NOT NULL");
  if (elMonNeutral[0].cnt > 0) {
    // 카테고리별 속성 매핑
    await pool.query("UPDATE monsters m JOIN monster_categories mc ON m.category_id = mc.id SET m.element='fire' WHERE mc.name IN ('악마/마족','용족') AND m.element='neutral'").catch(() => {});
    await pool.query("UPDATE monsters m JOIN monster_categories mc ON m.category_id = mc.id SET m.element='water' WHERE mc.name IN ('수생/해양','슬라임/연체') AND m.element='neutral'").catch(() => {});
    await pool.query("UPDATE monsters m JOIN monster_categories mc ON m.category_id = mc.id SET m.element='earth' WHERE mc.name IN ('야수','곤충/벌레','식물/균류') AND m.element='neutral'").catch(() => {});
    await pool.query("UPDATE monsters m JOIN monster_categories mc ON m.category_id = mc.id SET m.element='wind' WHERE mc.name IN ('정령','마법생물') AND m.element='neutral'").catch(() => {});
    await pool.query("UPDATE monsters m JOIN monster_categories mc ON m.category_id = mc.id SET m.element='neutral' WHERE mc.name IN ('귀신/원혼','언데드','인간형','도깨비') AND m.element='neutral'").catch(() => {});
    // 이름 기반 보정 (불/얼음 등)
    await pool.query("UPDATE monsters SET element='fire' WHERE (name LIKE '%불%' OR name LIKE '%화염%' OR name LIKE '%화룡%') AND element='neutral'").catch(() => {});
    await pool.query("UPDATE monsters SET element='water' WHERE (name LIKE '%얼음%' OR name LIKE '%빙%' OR name LIKE '%물귀%' OR name LIKE '%물의%') AND element='neutral'").catch(() => {});
    await pool.query("UPDATE monsters SET element='wind' WHERE (name LIKE '%바람%' OR name LIKE '%뇌%' OR name LIKE '%번개%') AND element='neutral'").catch(() => {});
    // 요괴/변이 카테고리 - 개별 속성 지정
    await pool.query("UPDATE monsters m JOIN monster_categories mc ON m.category_id = mc.id SET m.element='fire' WHERE mc.name = '요괴/변이' AND (m.name LIKE '%불%' OR m.name LIKE '%화%') AND m.element='neutral'").catch(() => {});
    await pool.query("UPDATE monsters m JOIN monster_categories mc ON m.category_id = mc.id SET m.element='wind' WHERE mc.name = '요괴/변이' AND m.element='neutral'").catch(() => {});
  }

  // 소환수 속성 배정
  const [elSumCheck] = await pool.query("SELECT COUNT(*) as cnt FROM summon_templates WHERE element != 'neutral'");
  if (elSumCheck[0].cnt === 0) {
    await pool.query("UPDATE summon_templates SET element='fire' WHERE name LIKE '%불%' OR name LIKE '%화%' OR type='공격'").catch(() => {});
    await pool.query("UPDATE summon_templates SET element='water' WHERE name LIKE '%물%' OR name LIKE '%해%' OR type='회복'").catch(() => {});
    await pool.query("UPDATE summon_templates SET element='earth' WHERE name LIKE '%산%' OR name LIKE '%토%' OR type='방어'").catch(() => {});
    await pool.query("UPDATE summon_templates SET element='wind' WHERE name LIKE '%바람%' OR name LIKE '%풍%' OR type='지원'").catch(() => {});
  }

  // ========== 소환수 소환 재료 비용 ==========
  await pool.query(`
    CREATE TABLE IF NOT EXISTS summon_material_costs (
      id INT AUTO_INCREMENT PRIMARY KEY,
      template_id INT NOT NULL,
      material_id INT NOT NULL,
      quantity INT NOT NULL DEFAULT 1,
      FOREIGN KEY (template_id) REFERENCES summon_templates(id) ON DELETE CASCADE,
      FOREIGN KEY (material_id) REFERENCES materials(id)
    )
  `);

  // 소환수별 재료 비용 시드
  {
    const [smcCheck] = await pool.query('SELECT COUNT(*) as cnt FROM summon_material_costs');
    if (smcCheck[0].cnt === 0) {
      const [matRows] = await pool.query('SELECT id, name FROM materials');
      const mm = {};
      for (const m of matRows) mm[m.name] = m.id;
      const [stRows] = await pool.query('SELECT id, name FROM summon_templates');
      const sm = {};
      for (const s of stRows) sm[s.name] = s.id;

      const costs = [
        // 하급 (Lv1): 일반 재료 소량
        [sm['떠도는 원혼'],  [[mm['귀혼석'], 40], [mm['뼈 파편'], 60]]],
        [sm['들쥐 소환수'],  [[mm['가죽 조각'], 60], [mm['뼈 파편'], 40]]],
        // 중하급 (Lv2): 일반+고급 재료
        [sm['묘지 귀신'],    [[mm['귀혼석'], 100], [mm['뼈 파편'], 100], [mm['마력 결정'], 40]]],
        [sm['야생 늑대'],    [[mm['가죽 조각'], 160], [mm['뼈 파편'], 100], [mm['마력 결정'], 40]]],
        [sm['해골 전사'],    [[mm['뼈 파편'], 160], [mm['귀혼석'], 60], [mm['철 조각'], 100]]],
        // 중급 (Lv3): 고급 재료 중심
        [sm['물의 정령'],    [[mm['정령석'], 100], [mm['마력 결정'], 100], [mm['해양 진주'], 60]]],
        [sm['불의 정령'],    [[mm['정령석'], 100], [mm['불꽃 정수'], 60], [mm['마력 결정'], 100]]],
        [sm['골렘 파편'],    [[mm['정령석'], 100], [mm['철 조각'], 200], [mm['마력 결정'], 100]]],
        // 중상급 (Lv4): 고급+희귀 재료
        [sm['구미호 영혼'],  [[mm['귀혼석'], 200], [mm['마력 결정'], 160], [mm['암흑의 정수'], 40]]],
        [sm['독거미 여왕'],  [[mm['독 주머니'], 200], [mm['마력 결정'], 160], [mm['불꽃 정수'], 60]]],
        [sm['바람의 정령'],  [[mm['정령석'], 200], [mm['마력 결정'], 160], [mm['별의 파편'], 40]]],
        // 상급 (Lv6): 희귀+영웅 재료
        [sm['리치'],         [[mm['암흑의 정수'], 100], [mm['귀혼석'], 300], [mm['마력 결정'], 200], [mm['용의 비늘'], 100]]],
      ];

      for (const [tid, mats] of costs) {
        if (!tid) continue;
        for (const [mid, qty] of mats) {
          if (!mid) continue;
          await pool.query('INSERT INTO summon_material_costs (template_id, material_id, quantity) VALUES (?, ?, ?)', [tid, mid, qty]);
        }
      }
    }
  }

  // 기존 소환 재료 수량 보정 (시드 기준 2배 적용)
  {
    const [smcMax] = await pool.query('SELECT MAX(quantity) as mx FROM summon_material_costs');
    if (smcMax[0].mx && smcMax[0].mx < 40) {
      await pool.query('UPDATE summon_material_costs SET quantity = quantity * 2').catch(() => {});
    }
  }

  // 소환수 스킬 required_level 10배 확대 (1→10, 2→20, ...) - 아직 변환 안 된 경우만
  {
    const [ssCheck] = await pool.query('SELECT MAX(required_level) as mx FROM summon_skills');
    if (ssCheck[0].mx <= 5) {
      await pool.query("UPDATE summon_skills SET required_level = required_level * 10").catch(() => {});
    }
  }

  // ============ 용병 시스템 ============
  await pool.query(`
    CREATE TABLE IF NOT EXISTS mercenary_templates (
      id INT AUTO_INCREMENT PRIMARY KEY,
      name VARCHAR(50) NOT NULL UNIQUE,
      class_type VARCHAR(20) NOT NULL,
      description VARCHAR(200),
      icon VARCHAR(10) DEFAULT '⚔️',
      price INT NOT NULL DEFAULT 500,
      sell_price INT NOT NULL DEFAULT 250,
      base_hp INT DEFAULT 80,
      base_mp INT DEFAULT 30,
      base_phys_attack INT DEFAULT 8,
      base_phys_defense INT DEFAULT 5,
      base_mag_attack INT DEFAULT 3,
      base_mag_defense INT DEFAULT 3,
      base_crit_rate INT DEFAULT 5,
      base_evasion INT DEFAULT 3,
      growth_hp FLOAT DEFAULT 12,
      growth_mp FLOAT DEFAULT 4,
      growth_phys_attack FLOAT DEFAULT 2,
      growth_phys_defense FLOAT DEFAULT 1.5,
      growth_mag_attack FLOAT DEFAULT 0.5,
      growth_mag_defense FLOAT DEFAULT 0.5,
      required_level INT DEFAULT 1,
      range_type ENUM('melee','ranged','magic') DEFAULT 'melee',
      element ENUM('fire','water','earth','wind','neutral') DEFAULT 'neutral',
      weapon_type VARCHAR(20) DEFAULT 'sword'
    )
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS character_mercenaries (
      id INT AUTO_INCREMENT PRIMARY KEY,
      character_id INT NOT NULL,
      template_id INT NOT NULL,
      name VARCHAR(50) NOT NULL,
      level INT DEFAULT 1,
      exp INT DEFAULT 0,
      hp INT DEFAULT 0,
      mp INT DEFAULT 0,
      phys_attack INT DEFAULT 0,
      phys_defense INT DEFAULT 0,
      mag_attack INT DEFAULT 0,
      mag_defense INT DEFAULT 0,
      crit_rate INT DEFAULT 5,
      evasion INT DEFAULT 3,
      FOREIGN KEY (character_id) REFERENCES characters(id) ON DELETE CASCADE,
      FOREIGN KEY (template_id) REFERENCES mercenary_templates(id)
    )
  `);

  // 용병 시드 데이터
  const [mercTplCheck] = await pool.query('SELECT COUNT(*) as cnt FROM mercenary_templates');
  if (mercTplCheck[0].cnt === 0) {
    await pool.query(`INSERT INTO mercenary_templates
      (name, class_type, description, icon, price, sell_price,
       base_hp, base_mp, base_phys_attack, base_phys_defense, base_mag_attack, base_mag_defense,
       base_crit_rate, base_evasion, growth_hp, growth_mp, growth_phys_attack, growth_phys_defense,
       growth_mag_attack, growth_mag_defense, required_level, range_type, element, weapon_type) VALUES
      ('검사 이준', '검사', '빠르고 정확한 검술로 적을 베는 검사.', '⚔️', 30000, 1500,
       90, 25, 10, 6, 2, 3, 8, 5, 14, 3, 2.5, 1.5, 0.3, 0.5, 1, 'melee', 'neutral', 'sword'),
      ('창병 박무', '창병', '긴 창으로 적을 찌르는 전선의 수호자.', '🔱', 35000, 1750,
       100, 20, 9, 8, 1, 4, 5, 3, 15, 2, 2.0, 2.0, 0.2, 0.5, 1, 'melee', 'earth', 'spear'),
      ('궁수 한소이', '궁수', '먼 거리에서 화살로 적을 관통하는 명궁.', '🏹', 40000, 2000,
       70, 30, 11, 3, 4, 3, 12, 8, 10, 4, 2.5, 0.8, 0.8, 0.5, 2, 'ranged', 'wind', 'bow'),
      ('도사 최현', '도사', '부적과 주문으로 적을 공격하는 술사.', '📜', 45000, 2250,
       65, 60, 3, 3, 12, 6, 6, 4, 8, 8, 0.5, 0.5, 2.5, 1.5, 3, 'magic', 'fire', 'talisman'),
      ('무사 강철', '무사', '묵직한 일격으로 적을 쓰러뜨리는 전사.', '🗡️', 50000, 2500,
       120, 15, 12, 10, 1, 5, 7, 2, 18, 2, 2.8, 2.5, 0.2, 0.5, 3, 'melee', 'neutral', 'sword'),
      ('치유사 윤하나', '치유사', '동료의 상처를 치유하는 은빛 치유사.', '💚', 55000, 2750,
       75, 80, 2, 4, 8, 8, 3, 5, 10, 10, 0.3, 1.0, 2.0, 2.0, 4, 'magic', 'water', 'staff'),
      ('자객 서영', '자객', '그림자 속에서 치명적 일격을 노리는 암살자.', '🗡️', 60000, 3000,
       60, 35, 14, 2, 6, 2, 18, 15, 8, 3, 3.0, 0.5, 1.0, 0.3, 5, 'melee', 'wind', 'dagger'),
      ('마법사 정은비', '마법사', '강력한 마법으로 광역 피해를 주는 마도사.', '🔮', 70000, 3500,
       55, 90, 2, 2, 15, 7, 5, 3, 6, 12, 0.3, 0.3, 3.0, 1.5, 6, 'magic', 'fire', 'staff')
    `);
  }

  // 용병 피로도 컬럼 추가
  await pool.query(`ALTER TABLE mercenary_templates ADD COLUMN max_fatigue INT DEFAULT 7`).catch(() => {});
  await pool.query(`ALTER TABLE character_mercenaries ADD COLUMN fatigue INT DEFAULT 7`).catch(() => {});
  await pool.query(`ALTER TABLE character_mercenaries ADD COLUMN max_fatigue INT DEFAULT 7`).catch(() => {});
  await pool.query(`ALTER TABLE character_mercenaries ADD COLUMN last_fatigue_recovery DATETIME DEFAULT CURRENT_TIMESTAMP`).catch(() => {});

  // 용병별 최대 피로도 설정 (5~10)
  await pool.query(`UPDATE mercenary_templates SET max_fatigue = 7 WHERE id = 1 AND max_fatigue = 7`);   // 검사
  await pool.query(`UPDATE mercenary_templates SET max_fatigue = 8 WHERE id = 2`);   // 창병
  await pool.query(`UPDATE mercenary_templates SET max_fatigue = 6 WHERE id = 3`);   // 궁수
  await pool.query(`UPDATE mercenary_templates SET max_fatigue = 5 WHERE id = 4`);   // 도사
  await pool.query(`UPDATE mercenary_templates SET max_fatigue = 10 WHERE id = 5`);  // 무사
  await pool.query(`UPDATE mercenary_templates SET max_fatigue = 5 WHERE id = 6`);   // 치유사
  await pool.query(`UPDATE mercenary_templates SET max_fatigue = 6 WHERE id = 7`);   // 자객
  await pool.query(`UPDATE mercenary_templates SET max_fatigue = 5 WHERE id = 8`);   // 마법사

  // 기존 용병 피로도 초기화 (max_fatigue가 기본값인 경우)
  await pool.query(`
    UPDATE character_mercenaries cm
    JOIN mercenary_templates mt ON cm.template_id = mt.id
    SET cm.max_fatigue = mt.max_fatigue, cm.fatigue = mt.max_fatigue
    WHERE cm.max_fatigue = 7 AND mt.max_fatigue != 7
  `).catch(() => {});

  // 용병 고용비 10배 적용 (기존 데이터 업데이트)
  await pool.query(`UPDATE mercenary_templates SET price = 30000, sell_price = 1500 WHERE id = 1 AND price < 30000`);
  await pool.query(`UPDATE mercenary_templates SET price = 35000, sell_price = 1750 WHERE id = 2 AND price < 35000`);
  await pool.query(`UPDATE mercenary_templates SET price = 40000, sell_price = 2000 WHERE id = 3 AND price < 40000`);
  await pool.query(`UPDATE mercenary_templates SET price = 45000, sell_price = 2250 WHERE id = 4 AND price < 45000`);
  await pool.query(`UPDATE mercenary_templates SET price = 50000, sell_price = 2500 WHERE id = 5 AND price < 50000`);
  await pool.query(`UPDATE mercenary_templates SET price = 55000, sell_price = 2750 WHERE id = 6 AND price < 55000`);
  await pool.query(`UPDATE mercenary_templates SET price = 60000, sell_price = 3000 WHERE id = 7 AND price < 60000`);
  await pool.query(`UPDATE mercenary_templates SET price = 70000, sell_price = 3500 WHERE id = 8 AND price < 70000`);

  // ========== 용병 스킬 시스템 ==========
  await pool.query(`
    CREATE TABLE IF NOT EXISTS mercenary_skills (
      id INT AUTO_INCREMENT PRIMARY KEY,
      name VARCHAR(50) NOT NULL,
      class_type VARCHAR(20) DEFAULT NULL,
      template_id INT DEFAULT NULL,
      description VARCHAR(200) NOT NULL,
      type ENUM('attack', 'heal', 'buff') NOT NULL,
      mp_cost INT NOT NULL DEFAULT 0,
      damage_multiplier FLOAT DEFAULT 1.0,
      heal_amount INT DEFAULT 0,
      buff_stat VARCHAR(20) DEFAULT NULL,
      buff_value INT DEFAULT 0,
      buff_duration INT DEFAULT 0,
      required_level INT DEFAULT 1,
      cooldown INT DEFAULT 0,
      is_common TINYINT(1) DEFAULT 0
    )
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS mercenary_learned_skills (
      id INT AUTO_INCREMENT PRIMARY KEY,
      mercenary_id INT NOT NULL,
      skill_id INT NOT NULL,
      FOREIGN KEY (mercenary_id) REFERENCES character_mercenaries(id) ON DELETE CASCADE,
      FOREIGN KEY (skill_id) REFERENCES mercenary_skills(id),
      UNIQUE KEY unique_merc_skill (mercenary_id, skill_id)
    )
  `);

  // 용병 장비 테이블
  await pool.query(`
    CREATE TABLE IF NOT EXISTS mercenary_equipment (
      id INT AUTO_INCREMENT PRIMARY KEY,
      mercenary_id INT NOT NULL,
      slot VARCHAR(20) NOT NULL,
      item_id INT NOT NULL,
      FOREIGN KEY (mercenary_id) REFERENCES character_mercenaries(id) ON DELETE CASCADE,
      FOREIGN KEY (item_id) REFERENCES items(id),
      UNIQUE KEY unique_merc_slot (mercenary_id, slot)
    )
  `);

  const [existingMercSkills] = await pool.query('SELECT COUNT(*) as cnt FROM mercenary_skills');
  if (existingMercSkills[0].cnt === 0) {
    await pool.query(`INSERT INTO mercenary_skills (name, class_type, template_id, description, type, mp_cost, damage_multiplier, heal_amount, buff_stat, buff_value, buff_duration, required_level, cooldown, is_common) VALUES
      ('강타', NULL, NULL, '힘을 모아 강하게 내려친다.', 'attack', 5, 1.5, 0, NULL, 0, 0, 1, 0, 1),
      ('방어 태세', NULL, NULL, '방어 태세를 취하여 방어력을 올린다.', 'buff', 8, 0, 0, 'defense', 6, 3, 1, 2, 1),
      ('기합', NULL, NULL, '기합을 넣어 공격력을 높인다.', 'buff', 10, 0, 0, 'attack', 5, 3, 2, 2, 1),
      ('생명력 회복', NULL, NULL, '내공으로 체력을 소량 회복한다.', 'heal', 12, 0, 25, NULL, 0, 0, 3, 2, 1),

      ('검풍', '검사', NULL, '검기를 날려 적을 벤다.', 'attack', 8, 2.0, 0, NULL, 0, 0, 1, 0, 0),
      ('쾌속 연참', '검사', NULL, '빠른 연속 베기로 적을 공격한다.', 'attack', 15, 2.8, 0, NULL, 0, 0, 3, 1, 0),
      ('일섬', '검사', NULL, '일도양단의 일격을 날린다.', 'attack', 25, 4.0, 0, NULL, 0, 0, 5, 2, 0),

      ('창격', '창병', NULL, '창으로 강하게 찔러 적을 공격한다.', 'attack', 7, 1.8, 0, NULL, 0, 0, 1, 0, 0),
      ('철벽 방어', '창병', NULL, '창을 세워 단단한 방벽을 만든다.', 'buff', 12, 0, 0, 'defense', 10, 3, 3, 2, 0),
      ('관통 찌르기', '창병', NULL, '적의 방어를 무시하는 관통 일격.', 'attack', 22, 3.5, 0, NULL, 0, 0, 5, 2, 0),

      ('관통 사격', '궁수', NULL, '화살로 적을 정확히 관통한다.', 'attack', 6, 1.8, 0, NULL, 0, 0, 1, 0, 0),
      ('속사', '궁수', NULL, '빠르게 여러 발의 화살을 쏜다.', 'attack', 14, 2.5, 0, NULL, 0, 0, 3, 1, 0),
      ('집중 조준', '궁수', NULL, '급소를 노리는 치명적 사격.', 'attack', 20, 3.8, 0, NULL, 0, 0, 5, 2, 0),

      ('부적 공격', '도사', NULL, '부적에 담긴 기운으로 적을 공격한다.', 'attack', 8, 2.0, 0, NULL, 0, 0, 1, 0, 0),
      ('결계', '도사', NULL, '보호 결계를 펼쳐 방어력을 높인다.', 'buff', 15, 0, 0, 'defense', 8, 4, 3, 2, 0),
      ('뇌전부', '도사', NULL, '번개를 부르는 강력한 부적 술법.', 'attack', 25, 3.8, 0, NULL, 0, 0, 5, 2, 0),

      ('분쇄격', '무사', NULL, '묵직한 일격으로 적을 내려친다.', 'attack', 8, 2.2, 0, NULL, 0, 0, 1, 0, 0),
      ('전투 함성', '무사', NULL, '함성을 질러 공격력을 크게 높인다.', 'buff', 15, 0, 0, 'attack', 10, 3, 3, 2, 0),
      ('파쇄격', '무사', NULL, '전력을 다한 파괴적 일격.', 'attack', 28, 4.2, 0, NULL, 0, 0, 5, 2, 0),

      ('치유의 손길', '치유사', NULL, '따뜻한 빛으로 상처를 치유한다.', 'heal', 10, 0, 40, NULL, 0, 0, 1, 1, 0),
      ('축복', '치유사', NULL, '동료에게 축복을 내려 방어력을 높인다.', 'buff', 15, 0, 0, 'defense', 8, 4, 3, 2, 0),
      ('대치유', '치유사', NULL, '강력한 치유 마법으로 대량의 체력을 회복한다.', 'heal', 30, 0, 80, NULL, 0, 0, 5, 3, 0),

      ('급소 찌르기', '자객', NULL, '적의 급소를 노려 빠르게 찌른다.', 'attack', 6, 2.0, 0, NULL, 0, 0, 1, 0, 0),
      ('그림자 습격', '자객', NULL, '그림자 속에서 기습하여 큰 피해를 입힌다.', 'attack', 16, 3.0, 0, NULL, 0, 0, 3, 1, 0),
      ('암살', '자객', NULL, '치명적인 암살 공격을 가한다.', 'attack', 28, 4.5, 0, NULL, 0, 0, 5, 2, 0),

      ('화염구', '마법사', NULL, '화염 구체를 발사하여 적을 불태운다.', 'attack', 10, 2.2, 0, NULL, 0, 0, 1, 0, 0),
      ('마력 집중', '마법사', NULL, '마력을 집중하여 마법 공격력을 높인다.', 'buff', 15, 0, 0, 'attack', 8, 3, 3, 2, 0),
      ('화염 폭풍', '마법사', NULL, '거대한 화염 폭풍을 일으킨다.', 'attack', 30, 4.5, 0, NULL, 0, 0, 5, 2, 0)
    `);
  }

  // 용병 스킬 required_level 10배 확대 (1→10, 2→20, ...) - 아직 변환 안 된 경우만
  {
    const [msCheck] = await pool.query('SELECT MAX(required_level) as mx FROM mercenary_skills');
    if (msCheck[0].mx <= 5) {
      await pool.query("UPDATE mercenary_skills SET required_level = CASE WHEN required_level = 1 THEN 1 ELSE required_level * 10 END").catch(() => {});
    }
    // 첫번째 스킬(원래 required_level=1)이 10으로 잘못 변경된 경우 → 1로 복구
    await pool.query("UPDATE mercenary_skills SET required_level = 1 WHERE required_level = 10").catch(() => {});
  }

  // 기존 용병들에게 레벨에 맞는 스킬 자동 부여 (마이그레이션)
  const [existingMercs] = await pool.query(
    `SELECT cm.id, cm.level, mt.class_type FROM character_mercenaries cm
     JOIN mercenary_templates mt ON cm.template_id = mt.id`
  );
  for (const em of existingMercs) {
    const [learnableSkills] = await pool.query(
      `SELECT id FROM mercenary_skills
       WHERE required_level <= ? AND (is_common = 1 OR class_type = ?)
       AND id NOT IN (SELECT skill_id FROM mercenary_learned_skills WHERE mercenary_id = ?)`,
      [em.level, em.class_type, em.id]
    );
    for (const sk of learnableSkills) {
      await pool.query('INSERT IGNORE INTO mercenary_learned_skills (mercenary_id, skill_id) VALUES (?, ?)', [em.id, sk.id]).catch(() => {});
    }
  }

  // ========== 스킬 트리 시스템 ==========
  // characters에 skill_points, total_skill_points 컬럼 추가
  await addCol('skill_points', 'INT DEFAULT 0');
  await addCol('total_skill_points', 'INT DEFAULT 0');

  // 기존 캐릭터에 레벨 기반 스킬 포인트 지급
  await pool.query('UPDATE characters SET skill_points = level, total_skill_points = level WHERE total_skill_points = 0 AND level > 0').catch(() => {});

  await pool.query(`
    CREATE TABLE IF NOT EXISTS skill_tree_nodes (
      id INT AUTO_INCREMENT PRIMARY KEY,
      class_type VARCHAR(20) NOT NULL,
      branch VARCHAR(30) NOT NULL,
      branch_name VARCHAR(30) NOT NULL,
      tier INT NOT NULL DEFAULT 1,
      node_key VARCHAR(50) NOT NULL UNIQUE,
      name VARCHAR(50) NOT NULL,
      description VARCHAR(300) NOT NULL,
      icon VARCHAR(10) DEFAULT '✦',
      node_type ENUM('active','passive') NOT NULL DEFAULT 'active',
      skill_type ENUM('attack','heal','buff','debuff','aoe') DEFAULT NULL,
      mp_cost INT DEFAULT 0,
      damage_multiplier FLOAT DEFAULT 1.0,
      damage_type ENUM('physical','magical') DEFAULT 'magical',
      heal_amount INT DEFAULT 0,
      buff_stat VARCHAR(20) DEFAULT NULL,
      buff_value INT DEFAULT 0,
      buff_duration INT DEFAULT 0,
      cooldown INT DEFAULT 0,
      skill_range INT DEFAULT 1,
      passive_stat VARCHAR(20) DEFAULT NULL,
      passive_value FLOAT DEFAULT 0,
      passive_is_percent TINYINT(1) DEFAULT 0,
      pos_x FLOAT DEFAULT 0,
      pos_y FLOAT DEFAULT 0,
      point_cost INT DEFAULT 1,
      required_level INT DEFAULT 1
    )
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS skill_tree_edges (
      id INT AUTO_INCREMENT PRIMARY KEY,
      parent_node_id INT NOT NULL,
      child_node_id INT NOT NULL,
      FOREIGN KEY (parent_node_id) REFERENCES skill_tree_nodes(id) ON DELETE CASCADE,
      FOREIGN KEY (child_node_id) REFERENCES skill_tree_nodes(id) ON DELETE CASCADE,
      UNIQUE KEY unique_edge (parent_node_id, child_node_id)
    )
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS character_skill_nodes (
      id INT AUTO_INCREMENT PRIMARY KEY,
      character_id INT NOT NULL,
      node_id INT NOT NULL,
      FOREIGN KEY (character_id) REFERENCES characters(id) ON DELETE CASCADE,
      FOREIGN KEY (node_id) REFERENCES skill_tree_nodes(id) ON DELETE CASCADE,
      UNIQUE KEY unique_char_node (character_id, node_id)
    )
  `);

  // 스킬 트리 노드 시드 (81개: 클래스당 27개 = 3브랜치 x 9노드)
  const [existingTreeNodes] = await pool.query('SELECT COUNT(*) as cnt FROM skill_tree_nodes');
  if (existingTreeNodes[0].cnt === 0) {
    // ===== 풍수사 =====
    await pool.query(`INSERT INTO skill_tree_nodes (class_type, branch, branch_name, tier, node_key, name, description, icon, node_type, skill_type, mp_cost, damage_multiplier, damage_type, heal_amount, buff_stat, buff_value, buff_duration, cooldown, skill_range, passive_stat, passive_value, passive_is_percent, pos_x, pos_y, point_cost, required_level) VALUES
      ('풍수사','fire','화염술',1,'ps_fire_1','화염탄','불의 기운을 모아 적에게 화염탄을 날린다.','🔥','active','attack',10,2.0,'magical',0,NULL,0,0,0,2,NULL,0,0, 1,1, 1,1),
      ('풍수사','fire','화염술',2,'ps_fire_2a','업화','맹렬한 업화로 적을 불태운다.','🔥','active','attack',18,3.0,'magical',0,NULL,0,0,1,2,NULL,0,0, 0,2, 1,3),
      ('풍수사','fire','화염술',2,'ps_fire_2b','화염폭발','폭발하는 화염으로 범위 피해를 준다.','💥','active','aoe',22,2.5,'magical',0,NULL,0,0,2,2,NULL,0,0, 2,2, 1,3),
      ('풍수사','fire','화염술',3,'ps_fire_3a','불꽃결계','불꽃 결계를 펼쳐 마공을 높인다.','🛡️','passive',NULL,0,1.0,'magical',0,NULL,0,0,0,0,'mag_attack',5,0, 0,3, 1,5),
      ('풍수사','fire','화염술',3,'ps_fire_3b','연소','화염 공격 시 추가 피해를 입힌다.','♨️','passive',NULL,0,1.0,'magical',0,NULL,0,0,0,0,'mag_attack',8,1, 1,3, 1,5),
      ('풍수사','fire','화염술',3,'ps_fire_3c','화산탄','용암을 발사하여 강력한 일격을 가한다.','🌋','active','attack',30,4.0,'magical',0,NULL,0,0,2,3,NULL,0,0, 2,3, 1,5),
      ('풍수사','fire','화염술',4,'ps_fire_4','삼매진화','삼매의 진화로 모든 것을 태운다. 궁극 화염술.','☀️','active','aoe',50,6.0,'magical',0,NULL,0,0,4,3,NULL,0,0, 1,4, 2,8),

      ('풍수사','geomancy','풍수지리',1,'ps_geo_1','풍수결계','풍수 결계를 펼쳐 방어력을 높인다.','🌀','active','buff',12,0,'magical',0,'defense',8,3,2,0,NULL,0,0, 1,1, 1,1),
      ('풍수사','geomancy','풍수지리',2,'ps_geo_2a','대지의 축복','대지의 기운으로 HP를 회복한다.','🌿','active','heal',15,0,'magical',40,NULL,0,0,1,0,NULL,0,0, 0,2, 1,3),
      ('풍수사','geomancy','풍수지리',2,'ps_geo_2b','수맥감응','수맥의 기운을 감지하여 MP를 회복한다.','💧','active','heal',0,0,'magical',0,'mp',15,1,2,0,NULL,0,0, 1,2, 1,3),
      ('풍수사','geomancy','풍수지리',2,'ps_geo_2c','바람길','바람의 길을 열어 회피율을 높인다.','💨','passive',NULL,0,1.0,'magical',0,NULL,0,0,0,0,'evasion',3,0, 2,2, 1,3),
      ('풍수사','geomancy','풍수지리',3,'ps_geo_3a','산맥호위','산맥의 기운으로 물방을 강화한다.','⛰️','passive',NULL,0,1.0,'magical',0,NULL,0,0,0,0,'phys_defense',5,0, 0,3, 1,5),
      ('풍수사','geomancy','풍수지리',3,'ps_geo_3b','기운회복','자연의 기운을 흡수하여 체력을 회복한다.','💚','active','heal',25,0,'magical',60,NULL,0,0,2,0,NULL,0,0, 2,3, 1,5),
      ('풍수사','geomancy','풍수지리',4,'ps_geo_4','천지개벽','천지를 뒤흔드는 궁극 풍수술.','🌏','active','aoe',55,5.5,'magical',0,'defense',10,3,4,4,NULL,0,0, 1,4, 2,8),

      ('풍수사','dragon','용맥술',1,'ps_dragon_1','수맥파','대지의 수맥을 터뜨려 강력한 일격을 가한다.','🐉','active','attack',15,2.5,'magical',0,NULL,0,0,1,2,NULL,0,0, 1,1, 1,1),
      ('풍수사','dragon','용맥술',2,'ps_dragon_2a','용맥감지','용맥을 감지하여 치명률을 높인다.','👁️','passive',NULL,0,1.0,'magical',0,NULL,0,0,0,0,'crit_rate',3,0, 0,2, 1,3),
      ('풍수사','dragon','용맥술',2,'ps_dragon_2b','기맥순환','기맥을 순환시켜 MP를 절약한다.','🔄','passive',NULL,0,1.0,'magical',0,NULL,0,0,0,0,'mp',10,0, 2,2, 1,3),
      ('풍수사','dragon','용맥술',3,'ps_dragon_3a','용맥강타','용맥의 힘으로 강력한 일격을 가한다.','⚡','active','attack',25,3.5,'magical',0,NULL,0,0,2,3,NULL,0,0, 0,3, 1,5),
      ('풍수사','dragon','용맥술',3,'ps_dragon_3b','용의 가호','용의 기운으로 마방을 강화한다.','🛡️','passive',NULL,0,1.0,'magical',0,NULL,0,0,0,0,'mag_defense',5,0, 1,3, 1,5),
      ('풍수사','dragon','용맥술',3,'ps_dragon_3c','지맥폭발','지맥을 폭발시켜 범위 피해를 준다.','💥','active','aoe',28,3.0,'magical',0,NULL,0,0,2,2,NULL,0,0, 2,3, 1,5),
      ('풍수사','dragon','용맥술',4,'ps_dragon_4','용맥폭발','용맥의 모든 힘을 해방하는 궁극기.','🐲','active','attack',55,7.0,'magical',0,NULL,0,0,4,3,NULL,0,0, 1,4, 2,8),

      -- ===== 무당 =====
      ('무당','spirit','강신술',1,'md_spirit_1','부적소환','저주의 부적을 소환하여 적을 공격한다.','📜','active','attack',8,1.8,'magical',0,NULL,0,0,0,2,NULL,0,0, 1,1, 1,1),
      ('무당','spirit','강신술',2,'md_spirit_2a','영혼공명','영혼과 공명하여 마공을 높인다.','👻','passive',NULL,0,1.0,'magical',0,NULL,0,0,0,0,'mag_attack',4,0, 0,2, 1,3),
      ('무당','spirit','강신술',2,'md_spirit_2b','영혼흡수','적의 생명력을 흡수한다.','💜','active','attack',18,2.2,'magical',30,NULL,0,0,1,2,NULL,0,0, 2,2, 1,3),
      ('무당','spirit','강신술',3,'md_spirit_3a','신내림','신의 힘을 빌려 공격력을 크게 높인다.','⬆️','active','buff',15,0,'magical',0,'attack',10,3,2,0,NULL,0,0, 0,3, 1,5),
      ('무당','spirit','강신술',3,'md_spirit_3b','혼백분리','혼백을 분리하여 치명 피해를 높인다.','💀','passive',NULL,0,1.0,'magical',0,NULL,0,0,0,0,'crit_rate',4,0, 1,3, 1,5),
      ('무당','spirit','강신술',3,'md_spirit_3c','영력증폭','영력을 증폭하여 마공을 강화한다.','✨','passive',NULL,0,1.0,'magical',0,NULL,0,0,0,0,'mag_attack',6,0, 2,3, 1,5),
      ('무당','spirit','강신술',4,'md_spirit_4','강신합체','강력한 영혼과 합체하는 궁극 강신술.','👹','active','attack',45,6.5,'magical',0,'attack',12,3,4,3,NULL,0,0, 1,4, 2,8),

      ('무당','healing','치유술',1,'md_heal_1','치유의식','치유의 의식을 행하여 체력을 회복한다.','💚','active','heal',12,0,'magical',35,NULL,0,0,1,2,NULL,0,0, 1,1, 1,1),
      ('무당','healing','치유술',2,'md_heal_2a','정화의 기운','정화의 기운으로 HP를 강화한다.','🌿','passive',NULL,0,1.0,'magical',0,NULL,0,0,0,0,'hp',15,0, 0,2, 1,3),
      ('무당','healing','치유술',2,'md_heal_2b','보호결계','보호 결계로 마방을 높인다.','🛡️','active','buff',14,0,'magical',0,'mag_defense',8,3,2,0,NULL,0,0, 2,2, 1,3),
      ('무당','healing','치유술',3,'md_heal_3a','대치유','강력한 치유 의식으로 대량 HP를 회복한다.','💖','active','heal',30,0,'magical',80,NULL,0,0,2,3,NULL,0,0, 0,3, 1,5),
      ('무당','healing','치유술',3,'md_heal_3b','생명의 축복','생명력을 강화하는 축복을 내린다.','🌸','passive',NULL,0,1.0,'magical',0,NULL,0,0,0,0,'hp',25,0, 1,3, 1,5),
      ('무당','healing','치유술',3,'md_heal_3c','해독의식','해독 의식으로 물방을 강화한다.','🍃','passive',NULL,0,1.0,'magical',0,NULL,0,0,0,0,'phys_defense',4,0, 2,3, 1,5),
      ('무당','healing','치유술',4,'md_heal_4','부활의 의식','죽은 자를 되살리는 궁극 치유술.','🌅','active','heal',60,0,'magical',150,NULL,0,0,4,4,NULL,0,0, 1,4, 2,8),

      ('무당','curse','저주술',1,'md_curse_1','약화저주','적의 방어력을 약화시키는 저주.','🔮','active','debuff',10,1.5,'magical',0,'defense',-5,3,0,3,NULL,0,0, 1,1, 1,1),
      ('무당','curse','저주술',2,'md_curse_2a','독기방출','독기를 방출하여 지속 피해를 준다.','☠️','active','attack',16,2.5,'magical',0,NULL,0,0,1,2,NULL,0,0, 0,2, 1,3),
      ('무당','curse','저주술',2,'md_curse_2b','저주확산','저주가 확산되어 범위 피해를 준다.','🌑','active','aoe',20,2.0,'magical',0,NULL,0,0,2,2,NULL,0,0, 2,2, 1,3),
      ('무당','curse','저주술',3,'md_curse_3a','혼란의 주문','적을 혼란에 빠뜨리는 주문.','🌀','active','debuff',22,2.8,'magical',0,'attack',-8,3,2,3,NULL,0,0, 0,3, 1,5),
      ('무당','curse','저주술',3,'md_curse_3b','원한응축','원한을 응축하여 마공을 높인다.','💢','passive',NULL,0,1.0,'magical',0,NULL,0,0,0,0,'mag_attack',7,0, 1,3, 1,5),
      ('무당','curse','저주술',3,'md_curse_3c','사령소환','사령을 소환하여 적을 공격한다.','👻','active','attack',26,3.5,'magical',0,NULL,0,0,2,3,NULL,0,0, 2,3, 1,5),
      ('무당','curse','저주술',4,'md_curse_4','망자의 저주','망자의 원한을 해방하는 궁극 저주술.','💀','active','aoe',55,6.0,'magical',0,'defense',-10,3,4,4,NULL,0,0, 1,4, 2,8),

      -- ===== 승려 =====
      ('승려','diamond','금강술',1,'mk_diamond_1','철벽수호','몸을 강철처럼 단단하게 만든다.','🛡️','active','buff',10,0,'physical',0,'defense',10,3,2,0,NULL,0,0, 1,1, 1,1),
      ('승려','diamond','금강술',2,'mk_diamond_2a','강철피부','피부를 강철처럼 단련하여 물방을 높인다.','⬛','passive',NULL,0,1.0,'physical',0,NULL,0,0,0,0,'phys_defense',5,0, 0,2, 1,3),
      ('승려','diamond','금강술',2,'mk_diamond_2b','기공방어','기공으로 마방을 높인다.','🔵','passive',NULL,0,1.0,'physical',0,NULL,0,0,0,0,'mag_defense',4,0, 2,2, 1,3),
      ('승려','diamond','금강술',3,'mk_diamond_3a','불괴금강','부서지지 않는 금강의 몸을 얻는다.','💎','passive',NULL,0,1.0,'physical',0,NULL,0,0,0,0,'hp',30,0, 0,3, 1,5),
      ('승려','diamond','금강술',3,'mk_diamond_3b','반격자세','반격 자세로 물공을 높인다.','⚔️','passive',NULL,0,1.0,'physical',0,NULL,0,0,0,0,'phys_attack',5,0, 1,3, 1,5),
      ('승려','diamond','금강술',3,'mk_diamond_3c','기력회복','기력을 회복하여 HP를 되찾는다.','💚','active','heal',15,0,'physical',50,NULL,0,0,1,0,NULL,0,0, 2,3, 1,5),
      ('승려','diamond','금강술',4,'mk_diamond_4','금강불괴체','금강불괴의 몸을 완성하는 궁극기.','🏔️','active','buff',50,0,'physical',0,'defense',20,4,4,0,NULL,0,0, 1,4, 2,8),

      ('승려','arhat','나한권',1,'mk_arhat_1','금강권','금강의 힘을 담은 주먹으로 강타한다.','👊','active','attack',8,1.8,'physical',0,NULL,0,0,0,1,NULL,0,0, 1,1, 1,1),
      ('승려','arhat','나한권',2,'mk_arhat_2a','연타수련','연타로 공격력을 높인다.','💪','passive',NULL,0,1.0,'physical',0,NULL,0,0,0,0,'phys_attack',4,0, 0,2, 1,3),
      ('승려','arhat','나한권',2,'mk_arhat_2b','파사권','사악함을 부수는 강력한 권법.','✊','active','attack',18,2.8,'physical',0,NULL,0,0,1,1,NULL,0,0, 2,2, 1,3),
      ('승려','arhat','나한권',3,'mk_arhat_3a','백보신권','100보를 꿰뚫는 신권.','💫','active','attack',25,3.5,'physical',0,NULL,0,0,2,2,NULL,0,0, 0,3, 1,5),
      ('승려','arhat','나한권',3,'mk_arhat_3b','급소타격','급소를 노려 치명률을 높인다.','🎯','passive',NULL,0,1.0,'physical',0,NULL,0,0,0,0,'crit_rate',5,0, 1,3, 1,5),
      ('승려','arhat','나한권',3,'mk_arhat_3c','연환격','연속으로 강력한 타격을 가한다.','🔥','active','attack',22,3.0,'physical',0,NULL,0,0,1,1,NULL,0,0, 2,3, 1,5),
      ('승려','arhat','나한권',4,'mk_arhat_4','나한신권','나한의 힘을 깨워 초월적 일격.','☯️','active','attack',50,7.0,'physical',0,NULL,0,0,4,2,NULL,0,0, 1,4, 2,8),

      ('승려','zen','선법',1,'mk_zen_1','선정','깊은 선정에 들어 HP를 회복한다.','🧘','active','heal',10,0,'magical',30,NULL,0,0,1,0,NULL,0,0, 1,1, 1,1),
      ('승려','zen','선법',2,'mk_zen_2a','내공수련','내공을 수련하여 물공을 높인다.','💪','passive',NULL,0,1.0,'physical',0,NULL,0,0,0,0,'phys_attack',3,0, 0,2, 1,3),
      ('승려','zen','선법',2,'mk_zen_2b','명상','깊은 명상으로 MP를 높인다.','🕯️','passive',NULL,0,1.0,'magical',0,NULL,0,0,0,0,'mp',15,0, 2,2, 1,3),
      ('승려','zen','선법',3,'mk_zen_3a','기공파','기공을 모아 강력한 파동을 발사한다.','🌊','active','attack',20,3.0,'magical',0,NULL,0,0,2,3,NULL,0,0, 0,3, 1,5),
      ('승려','zen','선법',3,'mk_zen_3b','선정의 경지','선정의 경지에 올라 회피를 높인다.','☁️','passive',NULL,0,1.0,'magical',0,NULL,0,0,0,0,'evasion',4,0, 1,3, 1,5),
      ('승려','zen','선법',3,'mk_zen_3c','만병통치','모든 상처를 치유하는 의술.','🌟','active','heal',28,0,'magical',70,NULL,0,0,2,0,NULL,0,0, 2,3, 1,5),
      ('승려','zen','선법',4,'mk_zen_4','대자대비','대자대비의 경지에 오르는 궁극 선법.','☸️','active','heal',55,0,'magical',120,'attack',10,3,4,4,NULL,0,0, 1,4, 2,8)
    `);

    // 스킬 트리 엣지 (parent → child 연결)
    const edgeDefs = [
      // 풍수사 화염술
      ['ps_fire_1','ps_fire_2a'], ['ps_fire_1','ps_fire_2b'],
      ['ps_fire_2a','ps_fire_3a'], ['ps_fire_2a','ps_fire_3b'],
      ['ps_fire_2b','ps_fire_3b'], ['ps_fire_2b','ps_fire_3c'],
      ['ps_fire_3a','ps_fire_4'], ['ps_fire_3b','ps_fire_4'], ['ps_fire_3c','ps_fire_4'],
      // 풍수사 풍수지리
      ['ps_geo_1','ps_geo_2a'], ['ps_geo_1','ps_geo_2b'], ['ps_geo_1','ps_geo_2c'],
      ['ps_geo_2a','ps_geo_3a'], ['ps_geo_2b','ps_geo_3a'], ['ps_geo_2b','ps_geo_3b'],
      ['ps_geo_2c','ps_geo_3b'],
      ['ps_geo_3a','ps_geo_4'], ['ps_geo_3b','ps_geo_4'],
      // 풍수사 용맥술
      ['ps_dragon_1','ps_dragon_2a'], ['ps_dragon_1','ps_dragon_2b'],
      ['ps_dragon_2a','ps_dragon_3a'], ['ps_dragon_2a','ps_dragon_3b'],
      ['ps_dragon_2b','ps_dragon_3b'], ['ps_dragon_2b','ps_dragon_3c'],
      ['ps_dragon_3a','ps_dragon_4'], ['ps_dragon_3b','ps_dragon_4'], ['ps_dragon_3c','ps_dragon_4'],
      // 무당 강신술
      ['md_spirit_1','md_spirit_2a'], ['md_spirit_1','md_spirit_2b'],
      ['md_spirit_2a','md_spirit_3a'], ['md_spirit_2a','md_spirit_3b'],
      ['md_spirit_2b','md_spirit_3b'], ['md_spirit_2b','md_spirit_3c'],
      ['md_spirit_3a','md_spirit_4'], ['md_spirit_3b','md_spirit_4'], ['md_spirit_3c','md_spirit_4'],
      // 무당 치유술
      ['md_heal_1','md_heal_2a'], ['md_heal_1','md_heal_2b'],
      ['md_heal_2a','md_heal_3a'], ['md_heal_2a','md_heal_3b'],
      ['md_heal_2b','md_heal_3b'], ['md_heal_2b','md_heal_3c'],
      ['md_heal_3a','md_heal_4'], ['md_heal_3b','md_heal_4'], ['md_heal_3c','md_heal_4'],
      // 무당 저주술
      ['md_curse_1','md_curse_2a'], ['md_curse_1','md_curse_2b'],
      ['md_curse_2a','md_curse_3a'], ['md_curse_2a','md_curse_3b'],
      ['md_curse_2b','md_curse_3b'], ['md_curse_2b','md_curse_3c'],
      ['md_curse_3a','md_curse_4'], ['md_curse_3b','md_curse_4'], ['md_curse_3c','md_curse_4'],
      // 승려 금강술
      ['mk_diamond_1','mk_diamond_2a'], ['mk_diamond_1','mk_diamond_2b'],
      ['mk_diamond_2a','mk_diamond_3a'], ['mk_diamond_2a','mk_diamond_3b'],
      ['mk_diamond_2b','mk_diamond_3b'], ['mk_diamond_2b','mk_diamond_3c'],
      ['mk_diamond_3a','mk_diamond_4'], ['mk_diamond_3b','mk_diamond_4'], ['mk_diamond_3c','mk_diamond_4'],
      // 승려 나한권
      ['mk_arhat_1','mk_arhat_2a'], ['mk_arhat_1','mk_arhat_2b'],
      ['mk_arhat_2a','mk_arhat_3a'], ['mk_arhat_2a','mk_arhat_3b'],
      ['mk_arhat_2b','mk_arhat_3b'], ['mk_arhat_2b','mk_arhat_3c'],
      ['mk_arhat_3a','mk_arhat_4'], ['mk_arhat_3b','mk_arhat_4'], ['mk_arhat_3c','mk_arhat_4'],
      // 승려 선법
      ['mk_zen_1','mk_zen_2a'], ['mk_zen_1','mk_zen_2b'],
      ['mk_zen_2a','mk_zen_3a'], ['mk_zen_2a','mk_zen_3b'],
      ['mk_zen_2b','mk_zen_3b'], ['mk_zen_2b','mk_zen_3c'],
      ['mk_zen_3a','mk_zen_4'], ['mk_zen_3b','mk_zen_4'], ['mk_zen_3c','mk_zen_4'],
    ];

    // node_key → id 매핑
    const [allNodes] = await pool.query('SELECT id, node_key FROM skill_tree_nodes');
    const nMap = {};
    for (const n of allNodes) nMap[n.node_key] = n.id;

    for (const [pKey, cKey] of edgeDefs) {
      if (nMap[pKey] && nMap[cKey]) {
        await pool.query(
          'INSERT INTO skill_tree_edges (parent_node_id, child_node_id) VALUES (?, ?)',
          [nMap[pKey], nMap[cKey]]
        );
      }
    }
  }

  // ── 운명술사 (운세/점괘/부적) 테이블 ──
  await pool.query(`
    CREATE TABLE IF NOT EXISTS character_fortunes (
      id INT AUTO_INCREMENT PRIMARY KEY,
      character_id INT NOT NULL,
      fortune_type ENUM('daily','divination','talisman') NOT NULL,
      fortune_grade VARCHAR(30) DEFAULT '',
      fortune_msg VARCHAR(200) DEFAULT '',
      buff_type VARCHAR(20),
      buff_value INT DEFAULT 0,
      remaining_battles INT DEFAULT 0,
      icon VARCHAR(10) DEFAULT '',
      color VARCHAR(20) DEFAULT '',
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (character_id) REFERENCES characters(id) ON DELETE CASCADE
    )
  `);

  // ── 타로카드 수집 테이블 ──
  await pool.query(`
    CREATE TABLE IF NOT EXISTS character_tarot_collection (
      id INT AUTO_INCREMENT PRIMARY KEY,
      character_id INT NOT NULL,
      card_index INT NOT NULL,
      discovered_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (character_id) REFERENCES characters(id) ON DELETE CASCADE,
      UNIQUE KEY unique_char_card (character_id, card_index)
    )
  `);

  // ── 타로 리딩 기록 테이블 ──
  await pool.query(`
    CREATE TABLE IF NOT EXISTS character_tarot_readings (
      id INT AUTO_INCREMENT PRIMARY KEY,
      character_id INT NOT NULL,
      spread_type VARCHAR(20) DEFAULT 'three',
      card1_index INT NOT NULL,
      card1_reversed TINYINT(1) DEFAULT 0,
      card2_index INT DEFAULT 0,
      card2_reversed TINYINT(1) DEFAULT 0,
      card3_index INT DEFAULT 0,
      card3_reversed TINYINT(1) DEFAULT 0,
      buff_type VARCHAR(20),
      buff_value INT DEFAULT 0,
      gold_cost INT DEFAULT 0,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (character_id) REFERENCES characters(id) ON DELETE CASCADE
    )
  `);

  // fortune_type ENUM에 'tarot' 추가
  await pool.query(`ALTER TABLE character_fortunes MODIFY COLUMN fortune_type ENUM('daily','divination','talisman','tarot') NOT NULL`).catch(() => {});

  // spread_type 컬럼 추가 (기존 테이블 호환)
  await pool.query(`ALTER TABLE character_tarot_readings ADD COLUMN spread_type VARCHAR(20) DEFAULT 'three' AFTER character_id`).catch(() => {});
  await pool.query(`ALTER TABLE character_tarot_readings MODIFY COLUMN card2_index INT DEFAULT 0`).catch(() => {});
  await pool.query(`ALTER TABLE character_tarot_readings MODIFY COLUMN card3_index INT DEFAULT 0`).catch(() => {});

  // ========== 스페셜 던전 시스템 ==========

  // 스페셜 던전 타입 정의
  await pool.query(`
    CREATE TABLE IF NOT EXISTS special_dungeon_types (
      id INT AUTO_INCREMENT PRIMARY KEY,
      key_name VARCHAR(30) NOT NULL UNIQUE,
      name VARCHAR(50) NOT NULL,
      description VARCHAR(200),
      battle_type ENUM('srpg','card') NOT NULL DEFAULT 'srpg',
      reset_type ENUM('weekly','daily','per_boss') NOT NULL,
      required_level INT DEFAULT 1,
      stamina_cost INT DEFAULT 1,
      icon VARCHAR(10) DEFAULT '🏰',
      accent_color VARCHAR(10) DEFAULT '#a78bfa',
      display_order INT DEFAULT 0
    )
  `);

  // 무한의 탑 층 데이터
  await pool.query(`
    CREATE TABLE IF NOT EXISTS tower_floors (
      id INT AUTO_INCREMENT PRIMARY KEY,
      floor_num INT NOT NULL UNIQUE,
      monster_count INT DEFAULT 3,
      level_bonus INT DEFAULT 0,
      hp_multiplier FLOAT DEFAULT 1.0,
      atk_multiplier FLOAT DEFAULT 1.0,
      is_boss TINYINT(1) DEFAULT 0,
      exp_reward INT DEFAULT 50,
      gold_reward INT DEFAULT 30,
      dungeon_key VARCHAR(30) DEFAULT 'cave'
    )
  `);

  // 정령의 시련 단계 데이터
  await pool.query(`
    CREATE TABLE IF NOT EXISTS elemental_trials (
      id INT AUTO_INCREMENT PRIMARY KEY,
      tier INT NOT NULL UNIQUE,
      name VARCHAR(50) NOT NULL,
      required_level INT DEFAULT 1,
      monster_count INT DEFAULT 3,
      hp_multiplier FLOAT DEFAULT 1.0,
      atk_multiplier FLOAT DEFAULT 1.0,
      exp_reward INT DEFAULT 80,
      gold_reward INT DEFAULT 50,
      material_grade VARCHAR(10) DEFAULT '희귀',
      material_count INT DEFAULT 1
    )
  `);

  // 보스 토벌전 보스 설정
  await pool.query(`
    CREATE TABLE IF NOT EXISTS boss_raid_configs (
      id INT AUTO_INCREMENT PRIMARY KEY,
      name VARCHAR(50) NOT NULL,
      description VARCHAR(200),
      dungeon_key VARCHAR(30) NOT NULL,
      required_level INT DEFAULT 1,
      boss_hp_mult FLOAT DEFAULT 3.0,
      boss_atk_mult FLOAT DEFAULT 2.0,
      monster_count INT DEFAULT 4,
      exp_reward INT DEFAULT 200,
      gold_reward INT DEFAULT 150,
      display_order INT DEFAULT 0
    )
  `);

  // 스페셜 던전 진행 추적
  await pool.query(`
    CREATE TABLE IF NOT EXISTS special_dungeon_progress (
      id INT AUTO_INCREMENT PRIMARY KEY,
      character_id INT NOT NULL,
      dungeon_type VARCHAR(30) NOT NULL,
      progress_value INT DEFAULT 0,
      best_record INT DEFAULT 0,
      total_clears INT DEFAULT 0,
      reset_date DATE DEFAULT NULL,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      FOREIGN KEY (character_id) REFERENCES characters(id) ON DELETE CASCADE,
      UNIQUE KEY unique_char_type (character_id, dungeon_type)
    )
  `);

  // 보스 토벌전 일일 도전 기록
  await pool.query(`
    CREATE TABLE IF NOT EXISTS boss_raid_daily (
      id INT AUTO_INCREMENT PRIMARY KEY,
      character_id INT NOT NULL,
      boss_config_id INT NOT NULL,
      attempt_date DATE NOT NULL,
      cleared TINYINT(1) DEFAULT 0,
      FOREIGN KEY (character_id) REFERENCES characters(id) ON DELETE CASCADE,
      FOREIGN KEY (boss_config_id) REFERENCES boss_raid_configs(id) ON DELETE CASCADE,
      UNIQUE KEY unique_char_boss_date (character_id, boss_config_id, attempt_date)
    )
  `);

  // 스페셜 던전 타입 시드 데이터
  const [existingSPTypes] = await pool.query('SELECT COUNT(*) as cnt FROM special_dungeon_types');
  if (existingSPTypes[0].cnt === 0) {
    await pool.query(`INSERT INTO special_dungeon_types (key_name, name, description, battle_type, reset_type, required_level, stamina_cost, icon, accent_color, display_order) VALUES
      ('tower', '무한의 탑', '끝없이 이어지는 시련의 탑. 매주 월요일에 진행도가 초기화됩니다.', 'srpg', 'weekly', 1, 1, '🗼', '#a78bfa', 1),
      ('elemental', '정령의 시련', '매일 바뀌는 속성의 정령과 싸워 정수와 결정을 획득하세요.', 'card', 'daily', 3, 1, '🌀', '#22d3ee', 2),
      ('boss_raid', '보스 토벌전', '강력한 보스에 도전하세요. 각 보스는 하루 1회 도전 가능합니다.', 'srpg', 'per_boss', 5, 2, '💀', '#f97316', 3)
    `);
  }

  // 무한의 탑 50층 시드 데이터
  const [existingFloors] = await pool.query('SELECT COUNT(*) as cnt FROM tower_floors');
  if (existingFloors[0].cnt === 0) {
    const dungeonCycle = ['cave','goblin','mountain','ocean','temple','demon','dragon'];
    const floorValues = [];
    for (let n = 1; n <= 50; n++) {
      const mc = 3 + Math.floor(n / 10);
      const isBoss = n % 10 === 0 ? 1 : 0;
      const bossExtra = isBoss ? 2 : 0;
      const expR = (50 + n * 12) * (isBoss ? 2 : 1);
      const goldR = (30 + n * 8) * (isBoss ? 2 : 1);
      const dk = dungeonCycle[(Math.floor((n - 1) / 7)) % dungeonCycle.length];
      floorValues.push(`(${n}, ${mc + bossExtra}, ${n}, ${(1.0 + n * 0.04).toFixed(2)}, ${(1.0 + n * 0.025).toFixed(3)}, ${isBoss}, ${expR}, ${goldR}, '${dk}')`);
    }
    await pool.query(`INSERT INTO tower_floors (floor_num, monster_count, level_bonus, hp_multiplier, atk_multiplier, is_boss, exp_reward, gold_reward, dungeon_key) VALUES ${floorValues.join(',')}`);
  }

  // 정령의 시련 5단계 시드 데이터
  const [existingTrials] = await pool.query('SELECT COUNT(*) as cnt FROM elemental_trials');
  if (existingTrials[0].cnt === 0) {
    await pool.query(`INSERT INTO elemental_trials (tier, name, required_level, monster_count, hp_multiplier, atk_multiplier, exp_reward, gold_reward, material_grade, material_count) VALUES
      (1, '초급 시련', 3, 3, 1.0, 1.0, 80, 50, '희귀', 1),
      (2, '중급 시련', 5, 4, 1.3, 1.2, 150, 100, '희귀', 2),
      (3, '상급 시련', 8, 5, 1.6, 1.4, 250, 170, '영웅', 1),
      (4, '영웅 시련', 12, 5, 2.0, 1.7, 400, 280, '영웅', 2),
      (5, '전설 시련', 16, 6, 2.5, 2.0, 600, 400, '영웅', 3)
    `);
  }

  // 보스 토벌전 6보스 시드 데이터
  const [existingBossRaid] = await pool.query('SELECT COUNT(*) as cnt FROM boss_raid_configs');
  if (existingBossRaid[0].cnt === 0) {
    await pool.query(`INSERT INTO boss_raid_configs (name, description, dungeon_key, required_level, boss_hp_mult, boss_atk_mult, monster_count, exp_reward, gold_reward, display_order) VALUES
      ('킹슬라임', '슬라임 동굴의 왕. 끈적끈적한 촉수로 공격합니다.', 'slime_cave', 2, 3.0, 2.0, 4, 200, 150, 1),
      ('골렘왕', '지하 동굴의 지배자. 단단한 몸체가 특징입니다.', 'cave', 4, 3.5, 2.2, 4, 350, 250, 2),
      ('도깨비대장', '도깨비 무리의 우두머리. 방망이 일격에 주의하세요.', 'goblin', 6, 4.0, 2.5, 5, 500, 350, 3),
      ('원혼군주', '산악 지대의 악령. 강력한 저주 마법을 사용합니다.', 'mountain', 8, 4.5, 2.8, 5, 700, 500, 4),
      ('마왕', '마계의 지배자. 압도적인 힘으로 모든 것을 파괴합니다.', 'demon', 12, 5.0, 3.0, 6, 1000, 700, 5),
      ('암흑룡', '용의 둥지의 최강자. 어둠의 브레스가 치명적입니다.', 'dragon', 16, 6.0, 3.5, 6, 1500, 1000, 6)
    `);
  }

  // 정령 재료 8개 (불/물/땅/바람 × 정수+결정)
  await pool.query(`INSERT IGNORE INTO materials (name, icon, grade, description, sell_price) VALUES
    ('불의 정수', '🔥', '희귀', '정령의 시련에서 얻은 불의 정수', 50),
    ('불의 결정', '❤️‍🔥', '영웅', '정령의 시련에서 얻은 불의 결정', 120),
    ('물의 정수', '💧', '희귀', '정령의 시련에서 얻은 물의 정수', 50),
    ('물의 결정', '🌊', '영웅', '정령의 시련에서 얻은 물의 결정', 120),
    ('땅의 정수', '🪨', '희귀', '정령의 시련에서 얻은 땅의 정수', 50),
    ('땅의 결정', '💎', '영웅', '정령의 시련에서 얻은 땅의 결정', 120),
    ('바람의 정수', '🌀', '희귀', '정령의 시련에서 얻은 바람의 정수', 50),
    ('바람의 결정', '🌪️', '영웅', '정령의 시련에서 얻은 바람의 결정', 120)
  `).catch(() => {});

  // ========== 던전 티켓 시스템 ==========
  await pool.query(`
    CREATE TABLE IF NOT EXISTS dungeon_tickets (
      id INT AUTO_INCREMENT PRIMARY KEY,
      dungeon_key VARCHAR(50) NOT NULL,
      name VARCHAR(100) NOT NULL,
      icon VARCHAR(10) DEFAULT '🎫',
      grade ENUM('일반','고급','희귀','영웅','전설') DEFAULT '일반',
      description VARCHAR(200),
      UNIQUE KEY unique_dungeon_ticket (dungeon_key)
    )
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS character_tickets (
      id INT AUTO_INCREMENT PRIMARY KEY,
      character_id INT NOT NULL,
      ticket_id INT NOT NULL,
      quantity INT DEFAULT 0,
      FOREIGN KEY (character_id) REFERENCES characters(id) ON DELETE CASCADE,
      FOREIGN KEY (ticket_id) REFERENCES dungeon_tickets(id),
      UNIQUE KEY unique_char_ticket (character_id, ticket_id)
    )
  `);

  // 던전 티켓 시드
  const ticketSeeds = [
    ['forest', '어둠의 숲 입장권', '🌲', '일반', '어둠의 숲에 입장할 수 있는 티켓.'],
    ['slime_cave', '슬라임 동굴 입장권', '🟢', '일반', '슬라임 동굴에 입장할 수 있는 티켓.'],
    ['cave', '지하 동굴 입장권', '🕳️', '고급', '지하 동굴에 입장할 수 있는 티켓.'],
    ['swamp', '독안개 늪 입장권', '🌿', '고급', '독안개 늪에 입장할 수 있는 티켓.'],
    ['goblin', '도깨비 마을 입장권', '👺', '고급', '도깨비 마을에 입장할 수 있는 티켓.'],
    ['mountain', '영혼의 산 입장권', '🏔️', '희귀', '영혼의 산에 입장할 수 있는 티켓.'],
    ['ocean', '해저 유적 입장권', '🌊', '희귀', '해저 유적에 입장할 수 있는 티켓.'],
    ['spirit_forest', '정령의 숲 입장권', '🧚', '희귀', '정령의 숲에 입장할 수 있는 티켓.'],
    ['temple', '폐허 사원 입장권', '🏛️', '영웅', '폐허 사원에 입장할 수 있는 티켓.'],
    ['demon', '마계 균열 입장권', '😈', '영웅', '마계 균열에 입장할 수 있는 티켓.'],
    ['dragon', '용의 둥지 입장권', '🐉', '전설', '용의 둥지에 입장할 수 있는 티켓.'],
  ];
  for (const [dKey, name, icon, grade, desc] of ticketSeeds) {
    await pool.query(
      `INSERT IGNORE INTO dungeon_tickets (dungeon_key, name, icon, grade, description) VALUES (?, ?, ?, ?, ?)`,
      [dKey, name, icon, grade, desc]
    ).catch(() => {});
  }

  // 스테이지 그룹별 티켓 드랍 설정 테이블
  await pool.query(`
    CREATE TABLE IF NOT EXISTS stage_ticket_drops (
      id INT AUTO_INCREMENT PRIMARY KEY,
      group_key VARCHAR(50) NOT NULL,
      ticket_id INT NOT NULL,
      drop_rate FLOAT DEFAULT 0.3,
      min_quantity INT DEFAULT 1,
      max_quantity INT DEFAULT 1,
      FOREIGN KEY (ticket_id) REFERENCES dungeon_tickets(id)
    )
  `);

  // 스테이지 티켓 드랍 시드 (스테이지 그룹 → 드랍되는 던전 티켓)
  const [ticketRows] = await pool.query('SELECT id, dungeon_key, grade FROM dungeon_tickets');
  const ticketMap = {};
  for (const t of ticketRows) ticketMap[t.dungeon_key] = t;

  const [existingDrops] = await pool.query('SELECT COUNT(*) as cnt FROM stage_ticket_drops');
  if (existingDrops[0].cnt === 0 && ticketRows.length > 0) {
    // 각 스테이지 그룹에서 어떤 던전 티켓이 드랍되는지 설정
    // 초반 스테이지 → 초반 던전 티켓, 후반 스테이지 → 후반 던전 티켓
    const stageTicketMapping = [
      // [stageGroupKey, dungeonTicketKey, dropRate]
      ['gojoseon', 'forest', 0.35],
      ['gojoseon', 'slime_cave', 0.25],
      ['samhan', 'slime_cave', 0.35],
      ['samhan', 'cave', 0.25],
      ['goguryeo', 'cave', 0.35],
      ['goguryeo', 'swamp', 0.25],
      ['baekje', 'swamp', 0.35],
      ['baekje', 'goblin', 0.25],
      ['silla', 'goblin', 0.35],
      ['silla', 'mountain', 0.20],
      ['balhae', 'mountain', 0.35],
      ['balhae', 'ocean', 0.20],
      ['goryeo', 'ocean', 0.35],
      ['goryeo', 'spirit_forest', 0.20],
      ['joseon', 'spirit_forest', 0.30],
      ['joseon', 'temple', 0.15],
      ['imjin', 'temple', 0.30],
      ['imjin', 'demon', 0.15],
      ['modern', 'demon', 0.25],
      ['modern', 'dragon', 0.10],
    ];
    for (const [gKey, dKey, rate] of stageTicketMapping) {
      const ticket = ticketMap[dKey];
      if (ticket) {
        await pool.query(
          'INSERT INTO stage_ticket_drops (group_key, ticket_id, drop_rate, min_quantity, max_quantity) VALUES (?, ?, ?, 1, 1)',
          [gKey, ticket.id, rate]
        ).catch(() => {});
      }
    }
  }

  // ========== 코스메틱 초상화 효과 시스템 ==========
  await pool.query(`ALTER TABLE items MODIFY COLUMN type ENUM('weapon','armor','potion','helmet','chest','boots','ring','necklace','shield','cosmetic') NOT NULL`).catch(() => {});
  await pool.query("ALTER TABLE items ADD COLUMN cosmetic_effect VARCHAR(30) DEFAULT NULL").catch(() => {});

  await pool.query(`
    CREATE TABLE IF NOT EXISTS equipped_cosmetics (
      id INT AUTO_INCREMENT PRIMARY KEY,
      character_id INT NOT NULL,
      entity_type ENUM('character','mercenary') NOT NULL,
      entity_id INT NOT NULL,
      item_id INT NOT NULL,
      UNIQUE KEY unique_entity (character_id, entity_type, entity_id),
      FOREIGN KEY (character_id) REFERENCES characters(id) ON DELETE CASCADE,
      FOREIGN KEY (item_id) REFERENCES items(id)
    )
  `);

  // 코스메틱 시드 아이템
  const cosmeticSeeds = [
    ['황금 기운의 초상', 'cosmetic', '금빛 맥동 효과가 초상화를 감싸는 코스메틱.', 500, 250, 'aura_gold'],
    ['불꽃 오라의 초상', 'cosmetic', '붉은 불꽃이 타오르는 코스메틱.', 600, 300, 'flame'],
    ['빙결 오라의 초상', 'cosmetic', '얼음 결정이 반짝이는 코스메틱.', 600, 300, 'ice'],
    ['번개 오라의 초상', 'cosmetic', '번개가 번쩍이는 코스메틱.', 700, 350, 'lightning'],
    ['암흑 오라의 초상', 'cosmetic', '어둠이 소용돌이치는 코스메틱.', 800, 400, 'shadow'],
    ['신성 오라의 초상', 'cosmetic', '신성한 빛줄기가 내리쬐는 코스메틱.', 800, 400, 'holy'],
    ['독기 오라의 초상', 'cosmetic', '녹색 독기가 피어오르는 코스메틱.', 500, 250, 'poison'],
    ['바람 오라의 초상', 'cosmetic', '청량한 바람이 감도는 코스메틱.', 500, 250, 'wind'],
    ['혈기 오라의 초상', 'cosmetic', '붉은 혈기가 맥동하는 코스메틱.', 700, 350, 'blood'],
    ['영혼 오라의 초상', 'cosmetic', '영혼의 빛이 감싸는 코스메틱.', 900, 450, 'spirit'],
    ['용의 숨결 초상', 'cosmetic', '황금빛과 붉은 불꽃이 이중으로 맥동하는 화려한 코스메틱.', 2500, 1250, 'dragon_breath'],
    ['천상의 빛 초상', 'cosmetic', '무지개빛 프리즘이 회전하며 빛나는 코스메틱.', 3000, 1500, 'celestial'],
    ['심연의 화염 초상', 'cosmetic', '검보라빛 심연의 불꽃이 타오르는 코스메틱.', 2500, 1250, 'abyssal_flame'],
    ['별빛 오라 초상', 'cosmetic', '반짝이는 별 입자가 감싸는 환상적인 코스메틱.', 2000, 1000, 'starlight'],
    ['봉황의 기운 초상', 'cosmetic', '금빛 봉황의 불꽃 날개가 감싸는 코스메틱.', 3500, 1750, 'phoenix'],
    ['혼돈의 소용돌이 초상', 'cosmetic', '다채로운 빛이 소용돌이치는 카오스 코스메틱.', 4000, 2000, 'chaos_vortex'],
  ];
  for (const [name, type, desc, price, sell, effect] of cosmeticSeeds) {
    await pool.query(
      `INSERT IGNORE INTO items (name, type, slot, weapon_hand, description, price, sell_price, effect_hp, effect_mp, effect_attack, effect_defense, required_level, class_restriction, cosmetic_effect)
       VALUES (?, ?, NULL, NULL, ?, ?, ?, 0, 0, 0, 0, 1, NULL, ?)`,
      [name, type, desc, price, sell, effect]
    ).catch(() => {});
  }

  // ========== 밸런스 패치 v2 ==========

  // -- 기존 장비 가격 정규화 (10x 인플레이션 수정) --
  // Lv1 일반: 원래 가격으로 복원
  await pool.query("UPDATE items SET price = 50, sell_price = 25 WHERE name = '소환의 부적'").catch(() => {});
  await pool.query("UPDATE items SET price = 200, sell_price = 100 WHERE name = '강화 부적'").catch(() => {});
  await pool.query("UPDATE items SET price = 800, sell_price = 400 WHERE name = '용의 부적'").catch(() => {});
  await pool.query("UPDATE items SET price = 50, sell_price = 25 WHERE name = '무당 방울'").catch(() => {});
  await pool.query("UPDATE items SET price = 200, sell_price = 100 WHERE name = '신령 방울'").catch(() => {});
  await pool.query("UPDATE items SET price = 800, sell_price = 400 WHERE name = '천신 방울'").catch(() => {});
  await pool.query("UPDATE items SET price = 50, sell_price = 25 WHERE name = '수련 목탁'").catch(() => {});
  await pool.query("UPDATE items SET price = 200, sell_price = 100 WHERE name = '금강 목탁'").catch(() => {});
  await pool.query("UPDATE items SET price = 800, sell_price = 400 WHERE name = '파천 목탁'").catch(() => {});
  await pool.query("UPDATE items SET price = 80, sell_price = 40 WHERE name = '가죽 갑옷'").catch(() => {});
  await pool.query("UPDATE items SET price = 300, sell_price = 150 WHERE name = '사슬 갑옷'").catch(() => {});
  await pool.query("UPDATE items SET price = 1000, sell_price = 500 WHERE name = '용린 갑옷'").catch(() => {});
  await pool.query("UPDATE items SET price = 40, sell_price = 20 WHERE name = '가죽 투구'").catch(() => {});
  await pool.query("UPDATE items SET price = 150, sell_price = 75 WHERE name = '철제 투구'").catch(() => {});
  await pool.query("UPDATE items SET price = 600, sell_price = 300 WHERE name = '용린 투구'").catch(() => {});
  await pool.query("UPDATE items SET price = 35, sell_price = 17 WHERE name = '가죽 장화'").catch(() => {});
  await pool.query("UPDATE items SET price = 120, sell_price = 60 WHERE name = '철제 장화'").catch(() => {});
  await pool.query("UPDATE items SET price = 500, sell_price = 250 WHERE name = '용린 장화'").catch(() => {});
  await pool.query("UPDATE items SET price = 60, sell_price = 30 WHERE name = '구리 반지'").catch(() => {});
  await pool.query("UPDATE items SET price = 250, sell_price = 125 WHERE name = '은 반지'").catch(() => {});
  await pool.query("UPDATE items SET price = 700, sell_price = 350 WHERE name = '황금 반지'").catch(() => {});
  await pool.query("UPDATE items SET price = 50, sell_price = 25 WHERE name = '뼈 목걸이'").catch(() => {});
  await pool.query("UPDATE items SET price = 200, sell_price = 100 WHERE name = '비취 목걸이'").catch(() => {});
  await pool.query("UPDATE items SET price = 800, sell_price = 400 WHERE name = '용의 눈 목걸이'").catch(() => {});
  await pool.query("UPDATE items SET price = 45, sell_price = 22 WHERE name = '나무 방패'").catch(() => {});
  await pool.query("UPDATE items SET price = 180, sell_price = 90 WHERE name = '철제 방패'").catch(() => {});
  await pool.query("UPDATE items SET price = 650, sell_price = 325 WHERE name = '용린 방패'").catch(() => {});
  await pool.query("UPDATE items SET price = 100, sell_price = 50 WHERE name = '청동 검'").catch(() => {});
  await pool.query("UPDATE items SET price = 350, sell_price = 175 WHERE name = '강철 검'").catch(() => {});
  await pool.query("UPDATE items SET price = 1100, sell_price = 550 WHERE name = '용살 검'").catch(() => {});
  await pool.query("UPDATE items SET price = 120, sell_price = 60 WHERE name = '사냥 활'").catch(() => {});
  await pool.query("UPDATE items SET price = 400, sell_price = 200 WHERE name = '강철 활'").catch(() => {});
  await pool.query("UPDATE items SET price = 1200, sell_price = 600 WHERE name = '용골 활'").catch(() => {});
  await pool.query("UPDATE items SET price = 150, sell_price = 75 WHERE name = '풍수 지팡이'").catch(() => {});
  await pool.query("UPDATE items SET price = 600, sell_price = 300 WHERE name = '현자의 지팡이'").catch(() => {});
  await pool.query("UPDATE items SET price = 300, sell_price = 150 WHERE name = '금강장'").catch(() => {});
  await pool.query("UPDATE items SET price = 900, sell_price = 450 WHERE name = '용린 금강장'").catch(() => {});
  // Lv8 전설: 원래 가격으로 복원
  await pool.query("UPDATE items SET price = 5000, sell_price = 2500 WHERE name = '천마검'").catch(() => {});
  await pool.query("UPDATE items SET price = 5500, sell_price = 2750 WHERE name = '파천궁'").catch(() => {});
  await pool.query("UPDATE items SET price = 5000, sell_price = 2500 WHERE name = '태극 부적'").catch(() => {});
  await pool.query("UPDATE items SET price = 5000, sell_price = 2500 WHERE name = '만신 방울'").catch(() => {});
  await pool.query("UPDATE items SET price = 5000, sell_price = 2500 WHERE name = '금강경 목탁'").catch(() => {});
  await pool.query("UPDATE items SET price = 4000, sell_price = 2000 WHERE name = '천룡 갑옷'").catch(() => {});
  await pool.query("UPDATE items SET price = 2500, sell_price = 1250 WHERE name = '천룡 투구'").catch(() => {});
  await pool.query("UPDATE items SET price = 2200, sell_price = 1100 WHERE name = '천룡 장화'").catch(() => {});
  await pool.query("UPDATE items SET price = 3000, sell_price = 1500 WHERE name = '천룡 방패'").catch(() => {});
  await pool.query("UPDATE items SET price = 3500, sell_price = 1750 WHERE name = '용왕의 반지'").catch(() => {});
  await pool.query("UPDATE items SET price = 3800, sell_price = 1900 WHERE name = '선녀의 목걸이'").catch(() => {});
  // Lv13 신화: 원래 가격으로 복원
  await pool.query("UPDATE items SET price = 15000, sell_price = 7500 WHERE name = '천제의 신검'").catch(() => {});
  await pool.query("UPDATE items SET price = 16000, sell_price = 8000 WHERE name = '신궁 해모수'").catch(() => {});
  await pool.query("UPDATE items SET price = 15000, sell_price = 7500 WHERE name = '천부인 부적'").catch(() => {});
  await pool.query("UPDATE items SET price = 15000, sell_price = 7500 WHERE name = '무녀신의 방울'").catch(() => {});
  await pool.query("UPDATE items SET price = 15000, sell_price = 7500 WHERE name = '석가의 목탁'").catch(() => {});
  await pool.query("UPDATE items SET price = 12000, sell_price = 6000 WHERE name = '신룡황 갑옷'").catch(() => {});
  await pool.query("UPDATE items SET price = 8000, sell_price = 4000 WHERE name = '신룡황 투구'").catch(() => {});
  await pool.query("UPDATE items SET price = 7000, sell_price = 3500 WHERE name = '신룡황 장화'").catch(() => {});
  await pool.query("UPDATE items SET price = 10000, sell_price = 5000 WHERE name = '신룡황 방패'").catch(() => {});
  await pool.query("UPDATE items SET price = 10000, sell_price = 5000 WHERE name = '환인의 반지'").catch(() => {});
  await pool.query("UPDATE items SET price = 11000, sell_price = 5500 WHERE name = '삼신의 목걸이'").catch(() => {});
  // 희귀 등급 아이템도 원래 가격 복원
  await pool.query("UPDATE items SET price = 900, sell_price = 450 WHERE name = '비전 활'").catch(() => {});
  await pool.query("UPDATE items SET price = 1000, sell_price = 500 WHERE name = '뇌신 검'").catch(() => {});
  await pool.query("UPDATE items SET price = 900, sell_price = 450 WHERE name = '영혼 부적'").catch(() => {});
  await pool.query("UPDATE items SET price = 800, sell_price = 400 WHERE name = '무녀 방울'").catch(() => {});
  await pool.query("UPDATE items SET price = 900, sell_price = 450 WHERE name = '금강 법륜'").catch(() => {});
  await pool.query("UPDATE items SET price = 800, sell_price = 400 WHERE name = '암흑 갑옷'").catch(() => {});
  await pool.query("UPDATE items SET price = 500, sell_price = 250 WHERE name = '암흑 투구'").catch(() => {});
  await pool.query("UPDATE items SET price = 400, sell_price = 200 WHERE name = '암흑 장화'").catch(() => {});
  await pool.query("UPDATE items SET price = 600, sell_price = 300 WHERE name = '암흑 방패'").catch(() => {});
  await pool.query("UPDATE items SET price = 650, sell_price = 325 WHERE name = '마법석 반지'").catch(() => {});
  await pool.query("UPDATE items SET price = 550, sell_price = 275 WHERE name = '신목 목걸이'").catch(() => {});

  // -- 용병 가격 하향 --
  await pool.query("UPDATE mercenary_templates SET price = 5000, sell_price = 500 WHERE name = '검사 이준'").catch(() => {});
  await pool.query("UPDATE mercenary_templates SET price = 6000, sell_price = 600 WHERE name = '창병 박무'").catch(() => {});
  await pool.query("UPDATE mercenary_templates SET price = 8000, sell_price = 800 WHERE name = '궁수 한소이'").catch(() => {});
  await pool.query("UPDATE mercenary_templates SET price = 10000, sell_price = 1000 WHERE name = '도사 최현'").catch(() => {});
  await pool.query("UPDATE mercenary_templates SET price = 12000, sell_price = 1200 WHERE name = '무사 강철'").catch(() => {});
  await pool.query("UPDATE mercenary_templates SET price = 15000, sell_price = 1500 WHERE name = '치유사 윤하나'").catch(() => {});
  await pool.query("UPDATE mercenary_templates SET price = 18000, sell_price = 1800 WHERE name = '자객 서영'").catch(() => {});
  await pool.query("UPDATE mercenary_templates SET price = 22000, sell_price = 2200 WHERE name = '마법사 정은비'").catch(() => {});

  // -- 추가 포션 (특대/영약/버프/해독/부활) --
  const balancePotions = [
    "('체력 물약(특대)', 'potion', NULL, NULL, 'HP를 500 회복합니다.', 300, 150, 500, 0, 0, 0, 15, NULL)",
    "('체력 영약', 'potion', NULL, NULL, 'HP를 1000 회복합니다.', 800, 400, 1000, 0, 0, 0, 30, NULL)",
    "('선단', 'potion', NULL, NULL, 'HP를 완전히 회복합니다.', 2000, 1000, 9999, 0, 0, 0, 50, NULL)",
    "('마력 물약(특대)', 'potion', NULL, NULL, 'MP를 300 회복합니다.', 350, 175, 0, 300, 0, 0, 15, NULL)",
    "('영력약', 'potion', NULL, NULL, 'MP를 완전히 회복합니다.', 1500, 750, 0, 9999, 0, 0, 40, NULL)",
    "('만병통치약', 'potion', NULL, NULL, 'HP와 MP를 500씩 회복합니다.', 600, 300, 500, 500, 0, 0, 25, NULL)",
    "('해독제', 'potion', NULL, NULL, '독과 저주 상태를 해제합니다.', 50, 25, 0, 0, 0, 0, 5, NULL)",
    "('환생석', 'potion', NULL, NULL, '전투 중 1회 부활 (HP 50%).', 500, 250, 0, 0, 0, 0, 20, NULL)",
    "('공격 부적', 'potion', NULL, NULL, '전투 시 공격력 20% 증가 (3턴).', 200, 100, 0, 0, 5, 0, 10, NULL)",
    "('방어 부적', 'potion', NULL, NULL, '전투 시 방어력 20% 증가 (3턴).', 200, 100, 0, 0, 0, 5, 10, NULL)",
    "('도주 연막', 'potion', NULL, NULL, '전투에서 즉시 도주합니다.', 30, 15, 0, 0, 0, 0, 1, NULL)",
  ];
  for (const v of balancePotions) {
    await pool.query(`INSERT IGNORE INTO items (name, type, slot, weapon_hand, description, price, sell_price, effect_hp, effect_mp, effect_attack, effect_defense, required_level, class_restriction) VALUES ${v}`).catch(() => {});
  }

  // -- 장비 티어 확장 (Lv20 고급, Lv28 고급, Lv38 희귀, Lv50 영웅, Lv65 영웅, Lv80 전설, Lv95 초월) --
  const tierExpansion = [
    // ===== Lv20 고급 (T4) =====
    // 공용 무기
    "('명월도', 'weapon', 'weapon', '1h', '달빛이 깃든 검. 범위1 마름모.', 2000, 1000, 0, 0, 30, 0, 20, NULL)",
    "('폭풍궁', 'weapon', 'weapon', '2h', '바람을 가르는 활. 범위4 직선.', 2200, 1100, 0, 0, 28, 0, 20, NULL)",
    // 클래스 무기
    "('영기 부적', 'weapon', 'weapon', '2h', '풍수사 전용. 영혼의 기운이 깃든 부적.', 2000, 1000, 0, 60, 30, 0, 20, '풍수사')",
    "('신명 방울', 'weapon', 'weapon', '2h', '무당 전용. 신명의 축복이 깃든 방울.', 2000, 1000, 0, 40, 28, 10, 20, '무당')",
    "('파사 목탁', 'weapon', 'weapon', '2h', '승려 전용. 사악한 기운을 깨는 목탁.', 2000, 1000, 60, 0, 22, 25, 20, '승려')",
    // 방어구
    "('비룡 갑옷', 'chest', 'chest', NULL, '비룡의 가죽으로 만든 갑옷.', 1800, 900, 70, 15, 0, 22, 20, NULL)",
    "('비룡 투구', 'helmet', 'helmet', NULL, '비룡의 뿔로 만든 투구.', 1200, 600, 40, 8, 0, 13, 20, NULL)",
    "('비룡 장화', 'boots', 'boots', NULL, '비룡의 가죽으로 만든 장화.', 1000, 500, 28, 0, 4, 9, 20, NULL)",
    "('비룡 방패', 'shield', 'shield', NULL, '비룡의 비늘로 만든 방패.', 1400, 700, 40, 0, 0, 20, 20, NULL)",
    "('비취 반지', 'ring', 'ring', NULL, '맑은 비취로 만든 마법 반지.', 1300, 650, 0, 30, 10, 0, 20, NULL)",
    "('호박석 목걸이', 'necklace', 'necklace', NULL, '호박석에 영력이 깃든 목걸이.', 1500, 750, 25, 25, 8, 8, 20, NULL)",

    // ===== Lv28 고급+ (T5) =====
    "('뇌광검', 'weapon', 'weapon', '1h', '번개가 깃든 검. 범위1 마름모.', 3500, 1750, 0, 0, 38, 0, 28, NULL)",
    "('현무궁', 'weapon', 'weapon', '2h', '현무의 기운이 깃든 활. 범위4 직선.', 3800, 1900, 0, 0, 35, 0, 28, NULL)",
    "('혼백 부적', 'weapon', 'weapon', '2h', '풍수사 전용. 혼백의 힘이 깃든 부적.', 3500, 1750, 0, 70, 36, 0, 28, '풍수사')",
    "('태을 방울', 'weapon', 'weapon', '2h', '무당 전용. 태을성의 축복을 받은 방울.', 3500, 1750, 0, 50, 33, 13, 28, '무당')",
    "('열반 목탁', 'weapon', 'weapon', '2h', '승려 전용. 열반의 경지에 이른 목탁.', 3500, 1750, 70, 0, 28, 30, 28, '승려')",
    "('백호 갑옷', 'chest', 'chest', NULL, '백호의 가죽으로 만든 갑옷.', 3000, 1500, 85, 20, 0, 28, 28, NULL)",
    "('백호 투구', 'helmet', 'helmet', NULL, '백호의 뿔로 만든 투구.', 2000, 1000, 50, 10, 0, 16, 28, NULL)",
    "('백호 장화', 'boots', 'boots', NULL, '백호의 발톱이 달린 장화.', 1700, 850, 35, 0, 5, 12, 28, NULL)",
    "('백호 방패', 'shield', 'shield', NULL, '백호의 가죽으로 만든 방패.', 2300, 1150, 50, 0, 0, 24, 28, NULL)",
    "('사파이어 반지', 'ring', 'ring', NULL, '깊은 푸른빛의 사파이어 반지.', 2100, 1050, 0, 35, 12, 0, 28, NULL)",
    "('월광석 목걸이', 'necklace', 'necklace', NULL, '달빛이 응축된 목걸이.', 2500, 1250, 30, 30, 10, 10, 28, NULL)",

    // ===== Lv38 희귀 (T6) =====
    "('주작도', 'weapon', 'weapon', '1h', '주작의 불꽃이 깃든 도. 범위1 마름모.', 6000, 3000, 0, 0, 50, 0, 38, NULL)",
    "('청룡궁', 'weapon', 'weapon', '2h', '청룡의 바람이 깃든 활. 범위4 직선.', 6500, 3250, 0, 0, 47, 0, 38, NULL)",
    "('천기 부적', 'weapon', 'weapon', '2h', '풍수사 전용. 천기의 비밀이 담긴 부적.', 6000, 3000, 0, 90, 48, 0, 38, '풍수사')",
    "('강신 방울', 'weapon', 'weapon', '2h', '무당 전용. 강력한 신령이 깃든 방울.', 6000, 3000, 0, 65, 43, 18, 38, '무당')",
    "('금강 법구', 'weapon', 'weapon', '2h', '승려 전용. 금강의 힘이 깃든 법구.', 6000, 3000, 90, 0, 35, 40, 38, '승려')",
    "('현무 갑옷', 'chest', 'chest', NULL, '현무의 등껍질로 만든 갑옷.', 5000, 2500, 110, 25, 0, 35, 38, NULL)",
    "('현무 투구', 'helmet', 'helmet', NULL, '현무의 뿔로 만든 투구.', 3300, 1650, 65, 12, 0, 20, 38, NULL)",
    "('현무 장화', 'boots', 'boots', NULL, '현무의 가죽으로 만든 장화.', 2800, 1400, 45, 0, 7, 15, 38, NULL)",
    "('현무 방패', 'shield', 'shield', NULL, '현무의 등껍질 방패.', 3800, 1900, 65, 0, 0, 30, 38, NULL)",
    "('루비 반지', 'ring', 'ring', NULL, '붉은 불꽃이 타오르는 루비 반지.', 3500, 1750, 0, 45, 16, 0, 38, NULL)",
    "('천계석 목걸이', 'necklace', 'necklace', NULL, '천계의 돌이 박힌 목걸이.', 4000, 2000, 40, 40, 13, 13, 38, NULL)",

    // ===== Lv50 영웅 (T7) =====
    "('사신검', 'weapon', 'weapon', '1h', '사신의 기운이 감도는 검. 범위1 마름모.', 10000, 5000, 0, 0, 65, 0, 50, NULL)",
    "('신수궁', 'weapon', 'weapon', '2h', '신수의 가호가 깃든 활. 범위4 직선.', 11000, 5500, 0, 0, 60, 0, 50, NULL)",
    "('태허 부적', 'weapon', 'weapon', '2h', '풍수사 전용. 우주의 기운이 담긴 부적.', 10000, 5000, 0, 120, 62, 0, 50, '풍수사')",
    "('천무 방울', 'weapon', 'weapon', '2h', '무당 전용. 천상의 춤이 깃든 방울.', 10000, 5000, 0, 80, 55, 24, 50, '무당')",
    "('대각 목탁', 'weapon', 'weapon', '2h', '승려 전용. 대각의 경지에 이른 목탁.', 10000, 5000, 120, 0, 45, 52, 50, '승려')",
    "('봉황 갑옷', 'chest', 'chest', NULL, '봉황의 깃털로 만든 갑옷.', 8000, 4000, 140, 30, 0, 42, 50, NULL)",
    "('봉황 투구', 'helmet', 'helmet', NULL, '봉황의 깃으로 만든 투구.', 5500, 2750, 82, 15, 0, 25, 50, NULL)",
    "('봉황 장화', 'boots', 'boots', NULL, '봉황의 발톱이 달린 장화.', 4500, 2250, 55, 0, 8, 18, 50, NULL)",
    "('봉황 방패', 'shield', 'shield', NULL, '봉황의 깃털로 강화된 방패.', 6000, 3000, 80, 0, 0, 36, 50, NULL)",
    "('에메랄드 반지', 'ring', 'ring', NULL, '생명력이 넘치는 에메랄드 반지.', 5500, 2750, 0, 55, 20, 0, 50, NULL)",
    "('용의 인장 목걸이', 'necklace', 'necklace', NULL, '용의 인장이 새겨진 목걸이.', 6500, 3250, 50, 50, 16, 16, 50, NULL)",

    // ===== Lv65 전설 (T8) =====
    "('하늘의 의지', 'weapon', 'weapon', '1h', '하늘의 의지가 담긴 신검. 범위1 마름모.', 18000, 9000, 0, 0, 88, 0, 65, NULL)",
    "('태양의 활', 'weapon', 'weapon', '2h', '태양의 빛이 깃든 신궁. 범위4 직선.', 19000, 9500, 0, 0, 82, 0, 65, NULL)",
    "('구천 부적', 'weapon', 'weapon', '2h', '풍수사 전용. 구천의 신령이 깃든 부적.', 18000, 9000, 0, 160, 85, 0, 65, '풍수사')",
    "('무극 방울', 'weapon', 'weapon', '2h', '무당 전용. 무극의 경지에 이른 방울.', 18000, 9000, 0, 110, 75, 32, 65, '무당')",
    "('보리 법구', 'weapon', 'weapon', '2h', '승려 전용. 깨달음의 법구.', 18000, 9000, 160, 0, 60, 68, 65, '승려')",
    "('기린 갑옷', 'chest', 'chest', NULL, '기린의 가죽으로 만든 전설의 갑옷.', 15000, 7500, 180, 40, 0, 52, 65, NULL)",
    "('기린 투구', 'helmet', 'helmet', NULL, '기린의 뿔로 만든 투구.', 10000, 5000, 105, 20, 0, 32, 65, NULL)",
    "('기린 장화', 'boots', 'boots', NULL, '기린의 발굽으로 만든 장화.', 8500, 4250, 70, 0, 12, 23, 65, NULL)",
    "('기린 방패', 'shield', 'shield', NULL, '기린의 비늘로 만든 방패.', 12000, 6000, 100, 0, 0, 45, 65, NULL)",
    "('다이아몬드 반지', 'ring', 'ring', NULL, '찬란한 다이아몬드 반지.', 10000, 5000, 0, 70, 26, 0, 65, NULL)",
    "('삼족오 목걸이', 'necklace', 'necklace', NULL, '삼족오의 깃이 달린 목걸이.', 12000, 6000, 65, 65, 20, 20, 65, NULL)",

    // ===== Lv80 신화 (T9) =====
    "('천상의 검', 'weapon', 'weapon', '1h', '천상에서 내린 불멸의 검. 범위1 마름모.', 30000, 15000, 0, 0, 115, 0, 80, NULL)",
    "('별의 활', 'weapon', 'weapon', '2h', '별빛을 발사하는 신궁. 범위4 직선.', 32000, 16000, 0, 0, 108, 0, 80, NULL)",
    "('천지 부적', 'weapon', 'weapon', '2h', '풍수사 전용. 천지의 이치가 담긴 부적.', 30000, 15000, 0, 200, 110, 0, 80, '풍수사')",
    "('만신전 방울', 'weapon', 'weapon', '2h', '무당 전용. 만 신령의 축복을 받은 방울.', 30000, 15000, 0, 140, 95, 42, 80, '무당')",
    "('해탈 법구', 'weapon', 'weapon', '2h', '승려 전용. 해탈의 경지에 이른 법구.', 30000, 15000, 200, 0, 78, 85, 80, '승려')",
    "('이무기 갑옷', 'chest', 'chest', NULL, '이무기의 비늘로 만든 신화의 갑옷.', 25000, 12500, 220, 50, 0, 65, 80, NULL)",
    "('이무기 투구', 'helmet', 'helmet', NULL, '이무기의 뿔로 만든 투구.', 17000, 8500, 130, 25, 0, 40, 80, NULL)",
    "('이무기 장화', 'boots', 'boots', NULL, '이무기의 발톱이 달린 장화.', 14000, 7000, 85, 0, 15, 28, 80, NULL)",
    "('이무기 방패', 'shield', 'shield', NULL, '이무기의 비늘 방패.', 20000, 10000, 130, 0, 0, 55, 80, NULL)",
    "('천의 반지', 'ring', 'ring', NULL, '천 가지 빛이 도는 반지.', 17000, 8500, 0, 90, 32, 0, 80, NULL)",
    "('태극 목걸이', 'necklace', 'necklace', NULL, '태극의 기운이 담긴 목걸이.', 20000, 10000, 80, 80, 25, 25, 80, NULL)",

    // ===== Lv95 초월 (T10) =====
    "('개벽의 검', 'weapon', 'weapon', '1h', '세상을 개벽하는 신검. 범위1 마름모.', 50000, 25000, 0, 0, 150, 0, 95, NULL)",
    "('천궁', 'weapon', 'weapon', '2h', '천상의 활. 별을 쏜다. 범위4 직선.', 55000, 27500, 0, 0, 140, 0, 95, NULL)",
    "('만물 부적', 'weapon', 'weapon', '2h', '풍수사 전용. 만물의 이치가 담긴 부적.', 50000, 25000, 0, 250, 145, 0, 95, '풍수사')",
    "('창세 방울', 'weapon', 'weapon', '2h', '무당 전용. 창세의 진동이 깃든 방울.', 50000, 25000, 0, 180, 125, 55, 95, '무당')",
    "('열반 법륜', 'weapon', 'weapon', '2h', '승려 전용. 완전한 깨달음의 법륜.', 50000, 25000, 250, 0, 100, 110, 95, '승려')",
    "('천제 갑옷', 'chest', 'chest', NULL, '하늘의 제왕이 착용한 갑옷.', 40000, 20000, 280, 60, 0, 80, 95, NULL)",
    "('천제 투구', 'helmet', 'helmet', NULL, '하늘의 제왕이 쓴 투구.', 28000, 14000, 160, 30, 0, 50, 95, NULL)",
    "('천제 장화', 'boots', 'boots', NULL, '구름 위를 걷는 장화.', 23000, 11500, 110, 0, 20, 35, 95, NULL)",
    "('천제 방패', 'shield', 'shield', NULL, '천제의 방패.', 32000, 16000, 160, 0, 0, 70, 95, NULL)",
    "('무한의 반지', 'ring', 'ring', NULL, '무한한 마력이 깃든 반지.', 28000, 14000, 0, 120, 42, 0, 95, NULL)",
    "('단군의 목걸이', 'necklace', 'necklace', NULL, '단군왕검의 목걸이.', 32000, 16000, 100, 100, 32, 32, 95, NULL)",
  ];
  for (const v of tierExpansion) {
    await pool.query(`INSERT IGNORE INTO items (name, type, slot, weapon_hand, description, price, sell_price, effect_hp, effect_mp, effect_attack, effect_defense, required_level, class_restriction) VALUES ${v}`).catch(() => {});
  }

  // 등급 설정 (고급/영웅/전설/신화/초월)
  const gradeMap = {
    '고급': ['비룡 갑옷','비룡 투구','비룡 장화','비룡 방패','비취 반지','호박석 목걸이',
             '명월도','폭풍궁','영기 부적','신명 방울','파사 목탁',
             '백호 갑옷','백호 투구','백호 장화','백호 방패','사파이어 반지','월광석 목걸이',
             '뇌광검','현무궁','혼백 부적','태을 방울','열반 목탁'],
    '희귀': ['현무 갑옷','현무 투구','현무 장화','현무 방패','루비 반지','천계석 목걸이',
             '주작도','청룡궁','천기 부적','강신 방울','금강 법구'],
    '영웅': ['봉황 갑옷','봉황 투구','봉황 장화','봉황 방패','에메랄드 반지','용의 인장 목걸이',
             '사신검','신수궁','태허 부적','천무 방울','대각 목탁'],
    '전설': ['기린 갑옷','기린 투구','기린 장화','기린 방패','다이아몬드 반지','삼족오 목걸이',
             '하늘의 의지','태양의 활','구천 부적','무극 방울','보리 법구'],
    '신화': ['이무기 갑옷','이무기 투구','이무기 장화','이무기 방패','천의 반지','태극 목걸이',
             '천상의 검','별의 활','천지 부적','만신전 방울','해탈 법구'],
    '초월': ['천제 갑옷','천제 투구','천제 장화','천제 방패','무한의 반지','단군의 목걸이',
             '개벽의 검','천궁','만물 부적','창세 방울','열반 법륜'],
  };
  for (const [grade, names] of Object.entries(gradeMap)) {
    const maxEnhance = grade === '초월' ? 25 : grade === '신화' ? 20 : grade === '전설' ? 15 : grade === '영웅' ? 12 : 10;
    for (const nm of names) {
      await pool.query("UPDATE items SET grade = ?, max_enhance = ? WHERE name = ?", [grade, maxEnhance, nm]).catch(() => {});
    }
  }

  // -- 스태미나 공식 개선: 기본 15, Lv당 1/3 증가 --
  // (calcMaxStamina 함수에서 처리 - 코드 변경 필요)

  // ========== 뽑기(가챠) 시스템 테이블 ==========
  await pool.query(`
    CREATE TABLE IF NOT EXISTS character_gacha_tickets (
      id INT AUTO_INCREMENT PRIMARY KEY,
      character_id INT NOT NULL,
      ticket_type VARCHAR(30) NOT NULL,
      quantity INT DEFAULT 0,
      FOREIGN KEY (character_id) REFERENCES characters(id) ON DELETE CASCADE,
      UNIQUE KEY unique_char_ticket (character_id, ticket_type)
    )
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS character_gacha_log (
      id INT AUTO_INCREMENT PRIMARY KEY,
      character_id INT NOT NULL,
      gacha_type VARCHAR(30) NOT NULL,
      result_name VARCHAR(100) DEFAULT '',
      result_grade VARCHAR(20) DEFAULT '',
      result_detail TEXT,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (character_id) REFERENCES characters(id) ON DELETE CASCADE
    )
  `);

  // ========== 밸런스 v3: 스킬 트리 레벨 요구 & 포인트 비용 재조정 ==========
  // Tier 1: Lv1, 1pt (유지)
  // Tier 2: Lv8, 2pt (기존 Lv3, 1pt)
  // Tier 3: Lv18, 3pt (기존 Lv5, 1pt)
  // Tier 4: Lv30, 4pt (기존 Lv8, 2pt)
  await pool.query("UPDATE skill_tree_nodes SET required_level = 8, point_cost = 2 WHERE tier = 2").catch(() => {});
  await pool.query("UPDATE skill_tree_nodes SET required_level = 18, point_cost = 3 WHERE tier = 3").catch(() => {});
  await pool.query("UPDATE skill_tree_nodes SET required_level = 30, point_cost = 4 WHERE tier = 4").catch(() => {});

  // ========== 스킬 트리 확장: Tier 5-7 (클래스당 3브랜치 x 3티어 = 9노드 추가, 총 27노드) ==========
  const [existT5] = await pool.query("SELECT COUNT(*) as cnt FROM skill_tree_nodes WHERE tier >= 5");
  if (existT5[0].cnt === 0) {
    await pool.query(`INSERT INTO skill_tree_nodes (class_type, branch, branch_name, tier, node_key, name, description, icon, node_type, skill_type, mp_cost, damage_multiplier, damage_type, heal_amount, buff_stat, buff_value, buff_duration, cooldown, skill_range, passive_stat, passive_value, passive_is_percent, pos_x, pos_y, point_cost, required_level) VALUES
      -- 풍수사 Tier 5-7
      ('풍수사','fire','화염술',5,'ps_fire_5','태양폭풍','태양의 화염을 불러내어 광역 소각한다.','🌞','active','aoe',65,7.5,'magical',0,NULL,0,0,5,4,NULL,0,0, 1,5, 5,45),
      ('풍수사','fire','화염술',6,'ps_fire_6','천화멸세','천상의 불꽃으로 만물을 정화한다.','🔆','active','aoe',85,9.0,'magical',0,'attack',15,3,6,5,NULL,0,0, 1,6, 7,65),
      ('풍수사','fire','화염술',7,'ps_fire_7','화신강림','불의 신을 강림시키는 궁극 화염술.','🌅','active','aoe',110,12.0,'magical',0,'attack',25,4,8,5,NULL,0,0, 1,7, 10,85),
      ('풍수사','geomancy','풍수지리',5,'ps_geo_5','대지신호','대지의 신이 호위하여 전원 방어 강화.','🏔️','active','buff',60,0,'magical',0,'defense',18,4,4,4,NULL,0,0, 1,5, 5,45),
      ('풍수사','geomancy','풍수지리',6,'ps_geo_6','천지합일','천지의 기운을 합일시켜 대량 회복.','🌍','active','heal',80,0,'magical',120,'defense',12,3,5,4,NULL,0,0, 1,6, 7,65),
      ('풍수사','geomancy','풍수지리',7,'ps_geo_7','만물귀일','만물의 기운을 하나로 모으는 궁극 풍수.','☯️','active','heal',100,0,'magical',200,'defense',25,5,8,5,NULL,0,0, 1,7, 10,85),
      ('풍수사','dragon','용맥술',5,'ps_dragon_5','용왕강림','용왕의 힘을 빌려 적을 쓸어버린다.','🐲','active','attack',70,8.5,'magical',0,NULL,0,0,5,4,NULL,0,0, 1,5, 5,45),
      ('풍수사','dragon','용맥술',6,'ps_dragon_6','천룡격','하늘의 용이 내려와 적을 격파한다.','⚡','active','attack',90,10.0,'magical',0,'attack',12,3,6,4,NULL,0,0, 1,6, 7,65),
      ('풍수사','dragon','용맥술',7,'ps_dragon_7','용맥해방','모든 용맥을 해방하는 최종 궁극기.','🌊','active','aoe',120,14.0,'magical',0,NULL,0,0,8,5,NULL,0,0, 1,7, 10,85),

      -- 무당 Tier 5-7
      ('무당','spirit','강신술',5,'md_spirit_5','대신강림','강력한 신을 강림시켜 적을 멸한다.','👹','active','attack',60,8.0,'magical',0,'attack',18,3,5,4,NULL,0,0, 1,5, 5,45),
      ('무당','spirit','강신술',6,'md_spirit_6','만신합체','만신의 힘을 빌려 초월적 일격.','⚔️','active','attack',80,10.5,'magical',0,'attack',22,4,6,4,NULL,0,0, 1,6, 7,65),
      ('무당','spirit','강신술',7,'md_spirit_7','천신일체','천상의 신과 하나 되는 궁극 강신.','🌟','active','aoe',110,13.0,'magical',0,'attack',30,5,8,5,NULL,0,0, 1,7, 10,85),
      ('무당','healing','치유술',5,'md_heal_5','성스러운 빛','성스러운 빛으로 전원 대량 회복.','✨','active','heal',55,0,'magical',100,NULL,0,0,4,4,NULL,0,0, 1,5, 5,45),
      ('무당','healing','치유술',6,'md_heal_6','천상의 축복','천상의 축복으로 부활 + 회복.','🌈','active','heal',75,0,'magical',160,'defense',15,4,5,4,NULL,0,0, 1,6, 7,65),
      ('무당','healing','치유술',7,'md_heal_7','윤회전생','생사를 초월하는 궁극 치유.','🔮','active','heal',100,0,'magical',250,'hp',50,5,8,5,NULL,0,0, 1,7, 10,85),
      ('무당','curse','저주술',5,'md_curse_5','원혼해방','원혼을 대량 해방하여 적을 괴멸.','💀','active','aoe',65,7.0,'magical',0,'defense',-15,4,5,4,NULL,0,0, 1,5, 5,45),
      ('무당','curse','저주술',6,'md_curse_6','저승사자','저승사자를 소환하여 적을 심판.','☠️','active','attack',85,10.0,'magical',0,'attack',-18,4,6,4,NULL,0,0, 1,6, 7,65),
      ('무당','curse','저주술',7,'md_curse_7','만귀야행','만 귀신이 행진하는 궁극 저주.','👻','active','aoe',110,12.5,'magical',0,'defense',-25,5,8,5,NULL,0,0, 1,7, 10,85),

      -- 승려 Tier 5-7
      ('승려','diamond','금강술',5,'mk_diamond_5','금강신체','금강신의 몸을 얻어 절대 방어.','💎','active','buff',55,0,'physical',0,'defense',25,4,5,0,NULL,0,0, 1,5, 5,45),
      ('승려','diamond','금강술',6,'mk_diamond_6','천왕호법','사천왕의 호법을 받아 무적.','🏯','active','buff',75,0,'physical',0,'defense',35,5,6,0,'phys_defense',15,0, 1,6, 7,65),
      ('승려','diamond','금강술',7,'mk_diamond_7','금강불멸','금강불멸의 경지에 오르는 궁극기.','🌟','active','buff',100,0,'physical',100,'defense',50,6,8,0,'hp',100,0, 1,7, 10,85),
      ('승려','arhat','나한권',5,'mk_arhat_5','항마권','악마를 항복시키는 강력한 권법.','👊','active','attack',60,8.0,'physical',0,NULL,0,0,5,2,NULL,0,0, 1,5, 5,45),
      ('승려','arhat','나한권',6,'mk_arhat_6','천권','하늘을 가르는 신권.','💫','active','attack',80,10.5,'physical',0,'attack',15,3,6,2,NULL,0,0, 1,6, 7,65),
      ('승려','arhat','나한권',7,'mk_arhat_7','나한멸세권','만팔천 나한의 힘을 모은 궁극 권법.','☄️','active','aoe',110,14.0,'physical',0,NULL,0,0,8,3,NULL,0,0, 1,7, 10,85),
      ('승려','zen','선법',5,'mk_zen_5','무아지경','무아의 경지에 올라 전원 회복.','🧘','active','heal',55,0,'magical',90,'evasion',8,4,4,4,NULL,0,0, 1,5, 5,45),
      ('승려','zen','선법',6,'mk_zen_6','열반적정','열반의 고요함으로 대량 회복.','🕉️','active','heal',75,0,'magical',150,'defense',12,4,5,4,NULL,0,0, 1,6, 7,65),
      ('승려','zen','선법',7,'mk_zen_7','성불','성불의 경지에 오르는 궁극 선법.','☸️','active','heal',100,0,'magical',250,'attack',20,5,8,5,NULL,0,0, 1,7, 10,85)
    `);

    // Tier 5-7 엣지 연결 (Tier4 → Tier5 → Tier6 → Tier7)
    const t57Edges = [
      ['ps_fire_4','ps_fire_5'], ['ps_fire_5','ps_fire_6'], ['ps_fire_6','ps_fire_7'],
      ['ps_geo_4','ps_geo_5'], ['ps_geo_5','ps_geo_6'], ['ps_geo_6','ps_geo_7'],
      ['ps_dragon_4','ps_dragon_5'], ['ps_dragon_5','ps_dragon_6'], ['ps_dragon_6','ps_dragon_7'],
      ['md_spirit_4','md_spirit_5'], ['md_spirit_5','md_spirit_6'], ['md_spirit_6','md_spirit_7'],
      ['md_heal_4','md_heal_5'], ['md_heal_5','md_heal_6'], ['md_heal_6','md_heal_7'],
      ['md_curse_4','md_curse_5'], ['md_curse_5','md_curse_6'], ['md_curse_6','md_curse_7'],
      ['mk_diamond_4','mk_diamond_5'], ['mk_diamond_5','mk_diamond_6'], ['mk_diamond_6','mk_diamond_7'],
      ['mk_arhat_4','mk_arhat_5'], ['mk_arhat_5','mk_arhat_6'], ['mk_arhat_6','mk_arhat_7'],
      ['mk_zen_4','mk_zen_5'], ['mk_zen_5','mk_zen_6'], ['mk_zen_6','mk_zen_7'],
    ];
    const [allN] = await pool.query('SELECT id, node_key FROM skill_tree_nodes');
    const nm = {};
    for (const n of allN) nm[n.node_key] = n.id;
    for (const [pKey, cKey] of t57Edges) {
      if (nm[pKey] && nm[cKey]) {
        await pool.query('INSERT IGNORE INTO skill_tree_edges (parent_node_id, child_node_id) VALUES (?, ?)', [nm[pKey], nm[cKey]]);
      }
    }
  }

  // ========== 저승사자 스킬 트리 (3브랜치 x 7티어 = 21노드) ==========
  const [existReaper] = await pool.query("SELECT COUNT(*) as cnt FROM skill_tree_nodes WHERE class_type = '저승사자'");
  if (existReaper[0].cnt === 0) {
    await pool.query(`INSERT INTO skill_tree_nodes (class_type, branch, branch_name, tier, node_key, name, description, icon, node_type, skill_type, mp_cost, damage_multiplier, damage_type, heal_amount, buff_stat, buff_value, buff_duration, cooldown, skill_range, passive_stat, passive_value, passive_is_percent, pos_x, pos_y, point_cost, required_level) VALUES
      -- ===== 사신 (reaper) 브랜치: 물리 암살 특화 =====
      ('저승사자','reaper','사신술',1,'rp_reaper_1','사신의 낫','저승의 낫으로 적을 베어낸다.','💀','active','attack',8,2.2,'physical',0,NULL,0,0,0,1,NULL,0,0, 1,1, 1,1),
      ('저승사자','reaper','사신술',2,'rp_reaper_2a','혼백 추적','혼백을 추적하여 치명타율을 높인다.','👁️','passive',NULL,0,1.0,'physical',0,NULL,0,0,0,0,'crit_rate',4,0, 0,2, 1,3),
      ('저승사자','reaper','사신술',2,'rp_reaper_2b','사신참','빠른 참격으로 적을 베어버린다.','⚔️','active','attack',14,2.8,'physical',0,NULL,0,0,0,1,NULL,0,0, 2,2, 1,3),
      ('저승사자','reaper','사신술',3,'rp_reaper_3a','사명선고','사형 선고를 내려 적의 방어를 무시한다.','📜','active','attack',20,3.5,'physical',0,NULL,0,0,1,2,NULL,0,0, 0,3, 1,5),
      ('저승사자','reaper','사신술',3,'rp_reaper_3b','낫의 달인','낫 다루기의 달인이 되어 공격력 증가.','🌙','passive',NULL,0,1.0,'physical',0,NULL,0,0,0,0,'phys_attack',6,0, 1,3, 1,5),
      ('저승사자','reaper','사신술',3,'rp_reaper_3c','처형의 일격','HP가 낮은 적에게 추가 피해를 준다.','🗡️','active','attack',25,4.5,'physical',0,NULL,0,0,2,2,NULL,0,0, 2,3, 1,5),
      ('저승사자','reaper','사신술',4,'rp_reaper_4','영혼 수확','영혼을 수확하여 적을 즉사시킨다.','☠️','active','attack',45,6.5,'physical',0,NULL,0,0,3,2,NULL,0,0, 1,4, 2,8),
      ('저승사자','reaper','사신술',5,'rp_reaper_5','사신강림','사신이 강림하여 모든 것을 벤다.','🌑','active','attack',65,8.5,'physical',0,NULL,0,0,5,3,NULL,0,0, 1,5, 5,45),
      ('저승사자','reaper','사신술',6,'rp_reaper_6','황천의 심판','황천의 심판자로서 적을 처단.','⚖️','active','aoe',85,10.5,'physical',0,'defense',-20,3,6,3,NULL,0,0, 1,6, 7,65),
      ('저승사자','reaper','사신술',7,'rp_reaper_7','절대사신','절대 사신의 경지. 만물을 벤다.','🖤','active','aoe',110,14.0,'physical',0,NULL,0,0,8,4,NULL,0,0, 1,7, 10,85),

      -- ===== 저주 (curse) 브랜치: 마법 DoT/디버프 =====
      ('저승사자','dark_curse','저주술',1,'rp_curse_1','원한의 손길','원한을 담은 손길로 적을 공격한다.','🖐️','active','attack',10,1.8,'magical',0,NULL,0,0,0,2,NULL,0,0, 1,1, 1,1),
      ('저승사자','dark_curse','저주술',2,'rp_curse_2a','저주 감염','저주를 퍼뜨려 적의 공격력을 낮춘다.','🦠','active','debuff',12,0,'magical',0,'attack',-5,3,2,3,NULL,0,0, 0,2, 1,3),
      ('저승사자','dark_curse','저주술',2,'rp_curse_2b','어둠의 손아귀','어둠으로 적을 움켜쥐어 피해를 준다.','🌑','active','attack',16,2.5,'magical',0,NULL,0,0,1,3,NULL,0,0, 2,2, 1,3),
      ('저승사자','dark_curse','저주술',3,'rp_curse_3a','마력 흡수','적의 마력을 흡수하여 MP를 회복한다.','💜','passive',NULL,0,1.0,'magical',0,NULL,0,0,0,0,'mag_attack',5,0, 0,3, 1,5),
      ('저승사자','dark_curse','저주술',3,'rp_curse_3b','생명력 착취','적의 생명력을 빼앗아 흡수한다.','🩸','active','attack',20,2.0,'magical',20,NULL,0,0,2,2,NULL,0,0, 1,3, 1,5),
      ('저승사자','dark_curse','저주술',3,'rp_curse_3c','악몽','악몽을 심어 적의 방어력을 낮춘다.','😈','active','debuff',18,0,'magical',0,'defense',-6,3,3,3,NULL,0,0, 2,3, 1,5),
      ('저승사자','dark_curse','저주술',4,'rp_curse_4','저주: 사멸','모든 것을 사멸시키는 저주.','💀','active','aoe',48,5.5,'magical',0,'defense',-10,4,4,3,NULL,0,0, 1,4, 2,8),
      ('저승사자','dark_curse','저주술',5,'rp_curse_5','원혼의 사슬','원혼의 사슬로 적을 속박한다.','⛓️','active','debuff',60,6.0,'magical',0,'attack',-18,4,5,3,NULL,0,0, 1,5, 5,45),
      ('저승사자','dark_curse','저주술',6,'rp_curse_6','저승의 불꽃','저승의 불꽃으로 적을 태운다.','🔮','active','aoe',80,9.0,'magical',0,'defense',-20,4,6,4,NULL,0,0, 1,6, 7,65),
      ('저승사자','dark_curse','저주술',7,'rp_curse_7','영원한 저주','영원히 풀리지 않는 궁극 저주.','🌀','active','aoe',105,12.0,'magical',0,'attack',-30,5,8,4,NULL,0,0, 1,7, 10,85),

      -- ===== 망자 (undead) 브랜치: 자기 버프/생존기 =====
      ('저승사자','undead','망자술',1,'rp_undead_1','영혼 갑옷','망자의 영혼으로 방어막을 만든다.','🛡️','active','buff',8,0,'magical',0,'defense',6,3,2,0,NULL,0,0, 1,1, 1,1),
      ('저승사자','undead','망자술',2,'rp_undead_2a','어둠 적응','어둠에 적응하여 회피율을 높인다.','🌑','passive',NULL,0,1.0,'magical',0,NULL,0,0,0,0,'evasion',4,0, 0,2, 1,3),
      ('저승사자','undead','망자술',2,'rp_undead_2b','망자의 힘','망자의 힘을 빌려 공격력을 높인다.','💪','active','buff',12,0,'magical',0,'attack',8,3,2,0,NULL,0,0, 2,2, 1,3),
      ('저승사자','undead','망자술',3,'rp_undead_3a','불사의 의지','죽음의 문턱에서 생존한다.','🔥','passive',NULL,0,1.0,'physical',0,NULL,0,0,0,0,'hp',15,0, 0,3, 1,5),
      ('저승사자','undead','망자술',3,'rp_undead_3b','영혼 흡수','쓰러진 적의 영혼을 흡수하여 HP 회복.','👻','active','heal',15,0,'magical',40,NULL,0,0,1,0,NULL,0,0, 1,3, 1,5),
      ('저승사자','undead','망자술',3,'rp_undead_3c','사령술','사령을 불러 공격력/방어력을 높인다.','💀','active','buff',20,0,'magical',0,'attack',10,3,3,0,NULL,0,0, 2,3, 1,5),
      ('저승사자','undead','망자술',4,'rp_undead_4','부활의 의식','망자의 힘으로 사망에서 부활한다.','☠️','active','buff',50,0,'magical',80,'defense',15,5,5,0,NULL,0,0, 1,4, 2,8),
      ('저승사자','undead','망자술',5,'rp_undead_5','저승의 권능','저승의 힘을 몸에 깃들게 한다.','🌑','active','buff',55,0,'magical',0,'attack',20,4,5,0,NULL,0,0, 1,5, 5,45),
      ('저승사자','undead','망자술',6,'rp_undead_6','사왕의 갑옷','사왕의 갑옷을 소환하여 무적.','👑','active','buff',75,0,'magical',60,'defense',35,5,6,0,'phys_defense',12,0, 1,6, 7,65),
      ('저승사자','undead','망자술',7,'rp_undead_7','사생결단','생과 사의 경계를 초월하는 궁극기.','💠','active','buff',100,0,'magical',150,'attack',30,6,8,0,'hp',80,0, 1,7, 10,85)
    `);

    // 저승사자 스킬 트리 엣지 연결
    const reaperEdges = [
      ['rp_reaper_1','rp_reaper_2a'], ['rp_reaper_1','rp_reaper_2b'],
      ['rp_reaper_2a','rp_reaper_3a'], ['rp_reaper_2a','rp_reaper_3b'], ['rp_reaper_2b','rp_reaper_3c'],
      ['rp_reaper_3a','rp_reaper_4'], ['rp_reaper_3b','rp_reaper_4'], ['rp_reaper_3c','rp_reaper_4'],
      ['rp_reaper_4','rp_reaper_5'], ['rp_reaper_5','rp_reaper_6'], ['rp_reaper_6','rp_reaper_7'],
      ['rp_curse_1','rp_curse_2a'], ['rp_curse_1','rp_curse_2b'],
      ['rp_curse_2a','rp_curse_3a'], ['rp_curse_2a','rp_curse_3c'], ['rp_curse_2b','rp_curse_3b'],
      ['rp_curse_3a','rp_curse_4'], ['rp_curse_3b','rp_curse_4'], ['rp_curse_3c','rp_curse_4'],
      ['rp_curse_4','rp_curse_5'], ['rp_curse_5','rp_curse_6'], ['rp_curse_6','rp_curse_7'],
      ['rp_undead_1','rp_undead_2a'], ['rp_undead_1','rp_undead_2b'],
      ['rp_undead_2a','rp_undead_3a'], ['rp_undead_2a','rp_undead_3b'], ['rp_undead_2b','rp_undead_3c'],
      ['rp_undead_3a','rp_undead_4'], ['rp_undead_3b','rp_undead_4'], ['rp_undead_3c','rp_undead_4'],
      ['rp_undead_4','rp_undead_5'], ['rp_undead_5','rp_undead_6'], ['rp_undead_6','rp_undead_7'],
    ];
    const [rpNodes] = await pool.query("SELECT id, node_key FROM skill_tree_nodes WHERE class_type = '저승사자'");
    const rpMap = {};
    for (const n of rpNodes) rpMap[n.node_key] = n.id;
    for (const [pKey, cKey] of reaperEdges) {
      if (rpMap[pKey] && rpMap[cKey]) {
        await pool.query('INSERT IGNORE INTO skill_tree_edges (parent_node_id, child_node_id) VALUES (?, ?)', [rpMap[pKey], rpMap[cKey]]);
      }
    }
  }

  // ========== 스페셜 던전 난이도 상향 + 레벨 제한 (v4) ==========

  // 입장 레벨: 무한의 탑=10, 정령의 시련=15, 보스 토벌전=20
  await pool.query("UPDATE special_dungeon_types SET required_level = 10 WHERE key_name = 'tower'").catch(() => {});
  await pool.query("UPDATE special_dungeon_types SET required_level = 15 WHERE key_name = 'elemental'").catch(() => {});
  await pool.query("UPDATE special_dungeon_types SET required_level = 20 WHERE key_name = 'boss_raid'").catch(() => {});

  // 무한의 탑 난이도 상향: HP배율 +50%, 공격배율 +40%, 보상 +30%
  await pool.query(`UPDATE tower_floors SET
    hp_multiplier = ROUND(1.0 + floor_num * 0.06, 2),
    atk_multiplier = ROUND(1.0 + floor_num * 0.035, 3),
    monster_count = LEAST(3 + FLOOR(floor_num / 8), 8),
    exp_reward = CASE WHEN is_boss THEN (80 + floor_num * 18) * 2 ELSE 80 + floor_num * 18 END,
    gold_reward = CASE WHEN is_boss THEN (50 + floor_num * 12) * 2 ELSE 50 + floor_num * 12 END
  `).catch(() => {});

  // 정령의 시련 난이도 상향: 요구 레벨↑, 배율↑, 보상↑
  await pool.query(`UPDATE elemental_trials SET required_level = 15, hp_multiplier = 1.3, atk_multiplier = 1.2, monster_count = 4, exp_reward = 120, gold_reward = 80 WHERE tier = 1`).catch(() => {});
  await pool.query(`UPDATE elemental_trials SET required_level = 20, hp_multiplier = 1.7, atk_multiplier = 1.5, monster_count = 4, exp_reward = 220, gold_reward = 150 WHERE tier = 2`).catch(() => {});
  await pool.query(`UPDATE elemental_trials SET required_level = 28, hp_multiplier = 2.2, atk_multiplier = 1.8, monster_count = 5, exp_reward = 380, gold_reward = 260 WHERE tier = 3`).catch(() => {});
  await pool.query(`UPDATE elemental_trials SET required_level = 38, hp_multiplier = 2.8, atk_multiplier = 2.2, monster_count = 6, exp_reward = 600, gold_reward = 420 WHERE tier = 4`).catch(() => {});
  await pool.query(`UPDATE elemental_trials SET required_level = 50, hp_multiplier = 3.5, atk_multiplier = 2.7, monster_count = 7, exp_reward = 900, gold_reward = 650 WHERE tier = 5`).catch(() => {});

  // 보스 토벌전 난이도 상향: 요구 레벨↑, 배율↑, 보상↑
  await pool.query(`UPDATE boss_raid_configs SET required_level = 20, boss_hp_mult = 4.0, boss_atk_mult = 2.5, monster_count = 4, exp_reward = 350, gold_reward = 250 WHERE display_order = 1`).catch(() => {});
  await pool.query(`UPDATE boss_raid_configs SET required_level = 25, boss_hp_mult = 5.0, boss_atk_mult = 3.0, monster_count = 5, exp_reward = 550, gold_reward = 400 WHERE display_order = 2`).catch(() => {});
  await pool.query(`UPDATE boss_raid_configs SET required_level = 32, boss_hp_mult = 6.0, boss_atk_mult = 3.5, monster_count = 5, exp_reward = 800, gold_reward = 550 WHERE display_order = 3`).catch(() => {});
  await pool.query(`UPDATE boss_raid_configs SET required_level = 40, boss_hp_mult = 7.0, boss_atk_mult = 4.0, monster_count = 6, exp_reward = 1100, gold_reward = 800 WHERE display_order = 4`).catch(() => {});
  await pool.query(`UPDATE boss_raid_configs SET required_level = 50, boss_hp_mult = 8.5, boss_atk_mult = 4.5, monster_count = 6, exp_reward = 1600, gold_reward = 1100 WHERE display_order = 5`).catch(() => {});
  await pool.query(`UPDATE boss_raid_configs SET required_level = 60, boss_hp_mult = 10.0, boss_atk_mult = 5.5, monster_count = 7, exp_reward = 2500, gold_reward = 1700 WHERE display_order = 6`).catch(() => {});

  // ========== 몬스터 도감 해금 시스템 ==========
  await pool.query(`
    CREATE TABLE IF NOT EXISTS monster_bestiary (
      id INT AUTO_INCREMENT PRIMARY KEY,
      character_id INT NOT NULL,
      monster_id INT NOT NULL,
      kill_count INT DEFAULT 0,
      first_discovered TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (character_id) REFERENCES characters(id) ON DELETE CASCADE,
      FOREIGN KEY (monster_id) REFERENCES monsters(id) ON DELETE CASCADE,
      UNIQUE KEY unique_char_monster (character_id, monster_id)
    )
  `);

  // 전투 세션 (브라우저 새로고침/이탈 시 전투 복귀용)
  await pool.query(`
    CREATE TABLE IF NOT EXISTS battle_sessions (
      id INT AUTO_INCREMENT PRIMARY KEY,
      character_id INT NOT NULL UNIQUE,
      battle_type ENUM('srpg','stage','tower') NOT NULL,
      context_json TEXT NOT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (character_id) REFERENCES characters(id) ON DELETE CASCADE
    )
  `);

  // 콘텐츠 입장 횟수 (스테이지/던전 각각 3회, 5시간 쿨타임) - 개별 키별 관리
  await pool.query(`
    CREATE TABLE IF NOT EXISTS content_charges (
      id INT AUTO_INCREMENT PRIMARY KEY,
      character_id INT NOT NULL,
      content_type VARCHAR(50) NOT NULL,
      charges INT DEFAULT 3,
      max_charges INT DEFAULT 3,
      last_recharged_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (character_id) REFERENCES characters(id) ON DELETE CASCADE,
      UNIQUE KEY unique_char_content (character_id, content_type)
    )
  `);
  // content_type ENUM → VARCHAR 마이그레이션
  await pool.query("ALTER TABLE content_charges MODIFY content_type VARCHAR(50) NOT NULL").catch(() => {});

  console.log('Database initialized (balance v4 applied)');
}

// 선택된 캐릭터 조회 헬퍼 (X-Char-Id 헤더 기반)
async function getSelectedChar(req, connOrPool) {
  const db = connOrPool || pool;
  const charId = req.headers['x-char-id'];
  if (charId) {
    const [chars] = await db.query('SELECT * FROM characters WHERE id = ? AND user_id = ?', [charId, req.user.id]);
    if (chars.length > 0) return chars[0];
  }
  // fallback: 첫 번째 캐릭터
  const [chars] = await db.query('SELECT * FROM characters WHERE user_id = ? ORDER BY id LIMIT 1', [req.user.id]);
  return chars.length > 0 ? chars[0] : null;
}

// 레벨에 따른 최대 행동력 계산
function calcMaxStamina(level) {
  return 15 + Math.floor(level / 3);
}

// 시간 경과에 따른 행동력 회복 계산 + DB 갱신
async function refreshStamina(char, connOrPool) {
  const db = connOrPool || pool;
  const now = new Date();
  const lastTime = char.last_stamina_time ? new Date(char.last_stamina_time) : now;
  const maxSt = calcMaxStamina(char.level);
  let curSt = char.stamina ?? maxSt;

  if (curSt < maxSt) {
    const elapsed = Math.max(0, now - lastTime); // ms
    const recovered = Math.floor(elapsed / (5 * 60 * 1000)); // 5분당 1
    if (recovered > 0) {
      curSt = Math.min(maxSt, curSt + recovered);
      const newLastTime = new Date(lastTime.getTime() + recovered * 5 * 60 * 1000);
      await db.query(
        'UPDATE characters SET stamina = ?, max_stamina = ?, last_stamina_time = ? WHERE id = ?',
        [curSt, maxSt, newLastTime, char.id]
      );
      char.stamina = curSt;
      char.max_stamina = maxSt;
      char.last_stamina_time = newLastTime;
    }
  }
  // max_stamina가 레벨과 안 맞으면 갱신
  if ((char.max_stamina || 0) !== maxSt) {
    await db.query('UPDATE characters SET max_stamina = ? WHERE id = ?', [maxSt, char.id]);
    char.max_stamina = maxSt;
  }
  return { stamina: curSt, maxStamina: maxSt };
}

module.exports = { get pool() { return getPool(); }, initialize, getSelectedChar, calcMaxStamina, refreshStamina };
