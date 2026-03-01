const mysql = require('mysql2/promise');

const pool = mysql.createPool({
  host: 'localhost',
  port: 3306,
  user: 'root',
  password: 'root',
  database: 'game',
  waitForConnections: true,
  connectionLimit: 10,
});

async function initialize() {
  const conn = await mysql.createConnection({
    host: 'localhost',
    port: 3306,
    user: 'root',
    password: 'root',
  });

  await conn.query('CREATE DATABASE IF NOT EXISTS `game`');
  await conn.end();

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

  await pool.query(`
    CREATE TABLE IF NOT EXISTS characters (
      id INT AUTO_INCREMENT PRIMARY KEY,
      user_id INT NOT NULL,
      name VARCHAR(50) NOT NULL UNIQUE,
      class_type ENUM('풍수사', '무당', '승려') NOT NULL,
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
      UNIQUE KEY unique_char_item (character_id, item_id)
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

  await pool.query(`
    CREATE TABLE IF NOT EXISTS quests (
      id INT AUTO_INCREMENT PRIMARY KEY,
      title VARCHAR(100) NOT NULL,
      description VARCHAR(300) NOT NULL,
      type ENUM('hunt', 'hunt_location', 'level') NOT NULL,
      target VARCHAR(50) NOT NULL,
      target_count INT NOT NULL DEFAULT 1,
      reward_exp INT DEFAULT 0,
      reward_gold INT DEFAULT 0,
      reward_item_id INT DEFAULT NULL,
      reward_item_qty INT DEFAULT 1,
      required_level INT DEFAULT 1,
      prerequisite_quest_id INT DEFAULT NULL
    )
  `);

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

  const [existingQuests] = await pool.query('SELECT COUNT(*) as cnt FROM quests');
  if (existingQuests[0].cnt === 0) {
    await pool.query(`INSERT INTO quests (title, description, type, target, target_count, reward_exp, reward_gold, reward_item_id, reward_item_qty, required_level, prerequisite_quest_id) VALUES
      ('첫 번째 사냥', '어둠의 숲에서 몬스터 3마리를 처치하세요.', 'hunt_location', 'forest', 3, 50, 30, NULL, 0, 1, NULL),
      ('숲의 청소부', '어둠의 숲에서 몬스터 10마리를 처치하세요.', 'hunt_location', 'forest', 10, 150, 100, NULL, 0, 1, 1),
      ('들쥐 퇴치', '들쥐를 5마리 처치하세요.', 'hunt', '들쥐', 5, 80, 50, NULL, 0, 1, NULL),
      ('늑대 사냥꾼', '야생 늑대를 5마리 처치하세요.', 'hunt', '야생 늑대', 5, 120, 80, NULL, 0, 1, NULL),
      ('동굴 탐험가', '지하 동굴에서 몬스터 5마리를 처치하세요.', 'hunt_location', 'cave', 5, 200, 150, NULL, 0, 2, 2),
      ('골렘 파괴자', '골렘을 3마리 처치하세요.', 'hunt', '골렘', 3, 250, 200, NULL, 0, 3, NULL),
      ('사원의 비밀', '폐허 사원에서 몬스터 5마리를 처치하세요.', 'hunt_location', 'temple', 5, 400, 300, NULL, 0, 4, 5),
      ('어둠의 수호자 토벌', '어둠의 수호자를 2마리 처치하세요.', 'hunt', '어둠의 수호자', 2, 600, 500, NULL, 0, 5, 7),
      ('성장의 증거', '레벨 3을 달성하세요.', 'level', '3', 1, 100, 80, NULL, 0, 1, NULL),
      ('숙련 모험가', '레벨 5를 달성하세요.', 'level', '5', 1, 300, 200, NULL, 0, 3, 9),
      ('전설의 시작', '레벨 8을 달성하세요.', 'level', '8', 1, 500, 400, NULL, 0, 5, 10),
      ('독거미 소탕', '독거미를 8마리 처치하세요.', 'hunt', '독거미', 8, 150, 100, 13, 3, 1, NULL),
      ('박쥐 퇴치 의뢰', '동굴 박쥐를 6마리 처치하세요.', 'hunt', '동굴 박쥐', 6, 250, 180, 14, 2, 2, NULL),
      ('원혼 정화', '원혼을 4마리 처치하세요.', 'hunt', '원혼', 4, 400, 300, 15, 2, 4, 7)
    `);
  }

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
      ('화염부', '풍수사', '불의 기운을 모아 적에게 화염을 날린다.', 'attack', 10, 2.0, 0, NULL, 0, 0, 1, 0),
      ('수맥파', '풍수사', '대지의 수맥을 터뜨려 강력한 일격을 가한다.', 'attack', 20, 3.0, 0, NULL, 0, 0, 3, 1),
      ('풍수결계', '풍수사', '풍수 결계를 펼쳐 방어력을 높인다.', 'buff', 15, 0, 0, 'defense', 8, 3, 2, 2),
      ('용맥폭발', '풍수사', '용맥의 힘을 폭발시켜 막대한 피해를 입힌다.', 'attack', 40, 5.0, 0, NULL, 0, 0, 6, 3),
      ('기운회복', '풍수사', '자연의 기운을 흡수하여 체력을 회복한다.', 'heal', 25, 0, 60, NULL, 0, 0, 4, 2),

      ('부적소환', '무당', '저주의 부적을 소환하여 적을 공격한다.', 'attack', 8, 1.8, 0, NULL, 0, 0, 1, 0),
      ('영혼흡수', '무당', '적의 생명력을 흡수하여 피해를 주고 체력을 회복한다.', 'attack', 18, 2.2, 30, NULL, 0, 0, 3, 1),
      ('신내림', '무당', '신의 힘을 빌려 공격력을 높인다.', 'buff', 15, 0, 0, 'attack', 8, 3, 2, 2),
      ('강신술', '무당', '강력한 영혼을 불러 적에게 큰 피해를 입힌다.', 'attack', 35, 4.5, 0, NULL, 0, 0, 6, 3),
      ('치유의식', '무당', '치유의 의식을 행하여 체력을 회복한다.', 'heal', 20, 0, 50, NULL, 0, 0, 4, 2),

      ('금강권', '승려', '금강의 힘을 담은 주먹으로 적을 강타한다.', 'attack', 8, 1.8, 0, NULL, 0, 0, 1, 0),
      ('파사권', '승려', '사악함을 부수는 강력한 권법을 펼친다.', 'attack', 18, 2.8, 0, NULL, 0, 0, 3, 1),
      ('철벽수호', '승려', '몸을 강철처럼 단단하게 만든다.', 'buff', 12, 0, 0, 'defense', 12, 3, 2, 2),
      ('나한신권', '승려', '나한의 힘을 깨워 초월적인 일격을 가한다.', 'attack', 35, 4.0, 0, NULL, 0, 0, 6, 3),
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
      ('풍수사', 8, 7, 2.0, 1.0, 0.8, 0.5, 2.5, 2.0, 1, 2),
      ('무당',  9, 6, 2.0, 1.5, 1.5, 1.0, 2.0, 1.5, 2, 2),
      ('승려', 12, 3, 2.5, 2.0, 2.5, 2.0, 0.5, 0.5, 2, 1)
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

  const [existingDungeons] = await pool.query('SELECT COUNT(*) as cnt FROM dungeons');
  if (existingDungeons[0].cnt === 0) {
    // 어둠의 숲
    await pool.query(`INSERT INTO dungeons (key_name, name, description, icon, required_level, map_width, map_height, base_tile_type, tile_overrides, player_spawns, monster_spawns) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`, [
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
    await pool.query(`INSERT INTO dungeons (key_name, name, description, icon, required_level, map_width, map_height, base_tile_type, tile_overrides, player_spawns, monster_spawns) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`, [
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
    await pool.query(`INSERT INTO dungeons (key_name, name, description, icon, required_level, map_width, map_height, base_tile_type, tile_overrides, player_spawns, monster_spawns) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`, [
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
    await pool.query(`INSERT INTO dungeons (key_name, name, description, icon, required_level, map_width, map_height, base_tile_type, tile_overrides, player_spawns, monster_spawns) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`, [
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
    await pool.query(`INSERT INTO dungeons (key_name, name, description, icon, required_level, map_width, map_height, base_tile_type, tile_overrides, player_spawns, monster_spawns) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`, [
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
    await pool.query(`INSERT INTO dungeons (key_name, name, description, icon, required_level, map_width, map_height, base_tile_type, tile_overrides, player_spawns, monster_spawns) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`, [
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
    await pool.query(`INSERT INTO dungeons (key_name, name, description, icon, required_level, map_width, map_height, base_tile_type, tile_overrides, player_spawns, monster_spawns) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`, [
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
    await pool.query(`INSERT INTO dungeons (key_name, name, description, icon, required_level, map_width, map_height, base_tile_type, tile_overrides, player_spawns, monster_spawns) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`, [
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
    await pool.query(`INSERT INTO dungeons (key_name, name, description, icon, required_level, map_width, map_height, base_tile_type, tile_overrides, player_spawns, monster_spawns) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`, [
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
    await pool.query(`INSERT INTO dungeons (key_name, name, description, icon, required_level, map_width, map_height, base_tile_type, tile_overrides, player_spawns, monster_spawns) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`, [
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
    await pool.query(`INSERT INTO dungeons (key_name, name, description, icon, required_level, map_width, map_height, base_tile_type, tile_overrides, player_spawns, monster_spawns) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`, [
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
      ('가고일',       ${dMap.demon}, '🗿', 90, 16, 10, 2, 45, 35, 8, ${cMap['악마/마족']}, 3, '돌에서 깨어난 악마의 하인')
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
      ('히드라',       ${dMap.dragon}, '🐍', 280, 36, 10, 2, 200, 160, 3, ${cMap['용족']}, 9, '머리가 여러 개인 거대한 뱀')
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
      ('점액 군주',    ${dMap.slime_cave}, '🫧', 200, 22, 10, 2, 100, 80, 3, ${cMap['슬라임/연체']}, 6, '모든 것을 녹이는 거대 슬라임')
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
    "UPDATE monsters SET ai_type='boss' WHERE name IN ('어둠의 수호자','정령왕','깨비대왕','마왕','용왕','리치왕','크라켄','바다 용','암흑룡','이무기','히드라','화룡','빙룡','발록','세계수의 파편','점액 군주','균류 군주','킹 슬라임')",
    "UPDATE monsters SET ai_type='coward' WHERE name IN ('초록 슬라임','파랑 슬라임','꼬마 도깨비','떠도는 영혼','독버섯','포자 군체','봉사귀','숲 도깨비','금속 슬라임')",
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
    // 마법형으로 변경된 몬스터 MP 보정 (마법형은 스킬 위주이므로 MP 상향)
    "UPDATE monsters SET mp=GREATEST(mp, 35) WHERE range_type='magic' AND tier <= 3",
    "UPDATE monsters SET mp=GREATEST(mp, 50) WHERE range_type='magic' AND tier BETWEEN 4 AND 5",
    "UPDATE monsters SET mp=GREATEST(mp, 70) WHERE range_type='magic' AND tier >= 6 AND ai_type != 'boss'",
  ];
  for (const sql of aiTypeUpdates) {
    await pool.query(sql).catch(() => {});
  }

  // 몬스터-스킬 연결 (INSERT IGNORE로 중복 안전)
  const [allMonsters] = await pool.query('SELECT id, name, ai_type FROM monsters');
  const [allMSkills] = await pool.query('SELECT id, name FROM monster_skills');
  const mMap = {}; for (const m of allMonsters) mMap[m.name] = m.id;
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
    [['드래곤 해츨링'], ['화염 토','물기']],
    [['와이번'], ['할퀴기','돌진']],
    [['화룡'], ['화염 토','꼬리 휘두르기','포효','지진']],
    [['빙룡'], ['얼음 숨결','꼬리 휘두르기','포효','방어 태세']],
    [['암흑룡'], ['암흑 구체','화염 토','꼬리 휘두르기','저주','포효']],
    [['용왕'], ['화염 토','얼음 숨결','번개 강타','꼬리 휘두르기','대치유','포효']],
    [['드레이크'], ['화염 토','돌진']],
    [['히드라'], ['독 공격','물기','꼬리 휘두르기','치유']],
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
    [['젤리피쉬'], ['독 공격']],
    [['대왕 게'], ['할퀴기','방어 태세']],
    [['상어'], ['물기','돌진']],
    [['대왕 문어'], ['할퀴기','독 공격']],
    [['인어 전사'], ['치유','마법 화살']],
    [['심해어'], ['물기','암흑 구체']],
    [['크라켄'], ['꼬리 휘두르기','지진','생명력 흡수','포효']],
    [['해마 기사'], ['치유','돌진']],
    [['바다 용'], ['얼음 숨결','꼬리 휘두르기','지진','포효']],
  ];

  for (const [monsterNames, skillNames] of skillAssignments) {
    for (const mName of monsterNames) {
      if (!mMap[mName]) continue;
      for (const sName of skillNames) {
        if (!sMap[sName]) continue;
        await pool.query(
          'INSERT IGNORE INTO monster_skill_map (monster_id, skill_id) VALUES (?, ?)',
          [mMap[mName], sMap[sName]]
        ).catch(() => {});
      }
    }
  }

  // ========== 히스토리 스테이지 시스템 ==========
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
      bg_color VARCHAR(20) DEFAULT '#1a1a2e'
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

  // 히스토리 스테이지 그룹 시드
  const [existGroups] = await pool.query('SELECT COUNT(*) as cnt FROM stage_groups');
  if (existGroups[0].cnt === 0) {
    const groups = [
      ['gojoseon',   '고조선',     '단군의 개국신화가 깃든 태초의 땅',                '🏔️', '고조선 (BC 2333)', 1,  1, '#2d1b0e'],
      ['samhan',     '삼한',       '마한, 변한, 진한 세 부족의 전장',                '⚔️', '삼한시대',         3,  2, '#1a2e1a'],
      ['goguryeo',   '고구려',     '북방의 기마민족, 광개토대왕의 영토',              '🐎', '삼국시대',         5,  3, '#2e1a1a'],
      ['baekje',     '백제',       '한강 유역의 문화 강국',                          '🌸', '삼국시대',         7,  4, '#1a1a2e'],
      ['silla',      '신라',       '화랑도의 정신으로 삼국을 통일',                   '👑', '삼국시대',         9,  5, '#2e2e1a'],
      ['balhae',     '발해',       '해동성국, 고구려를 계승한 대제국',               '🦁', '남북국시대',       11, 6, '#1a2e2e'],
      ['goryeo',     '고려',       '불교 문화가 꽃피운 고려 왕조',                   '📿', '고려시대',         13, 7, '#2e1a2e'],
      ['joseon',     '조선',       '유교의 이상향, 오백년 조선 왕조',                '📜', '조선시대',         16, 8, '#0e1a2e'],
      ['imjin',      '임진왜란',   '이순신 장군과 의병들의 구국 전쟁',               '🛡️', '조선시대',         19, 9, '#2e0e0e'],
      ['modern',     '근대',       '격변의 시대, 새로운 힘이 깨어난다',              '🔥', '근대',             22, 10, '#1a0e2e'],
    ];

    for (const [key, name, desc, icon, era, lvl, order, bg] of groups) {
      await pool.query(
        'INSERT IGNORE INTO stage_groups (key_name, name, description, icon, era, required_level, display_order, bg_color) VALUES (?,?,?,?,?,?,?,?)',
        [key, name, desc, icon, era, lvl, order, bg]
      );
    }

    // 스테이지 레벨 시드
    const [gRows] = await pool.query('SELECT id, key_name FROM stage_groups ORDER BY display_order');
    const gMap = {};
    for (const g of gRows) gMap[g.key_name] = g.id;

    // 던전 키 매핑 (몬스터 소스)
    const groupDungeonMap = {
      'gojoseon':  'forest',
      'samhan':    'slime_cave',
      'goguryeo':  'cave',
      'baekje':    'swamp',
      'silla':     'goblin',
      'balhae':    'mountain',
      'goryeo':    'spirit_forest',
      'joseon':    'temple',
      'imjin':     'demon',
      'modern':    'dragon',
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
        { n:11, name:'연개소문의 시련',    desc:'독재자의 야망이 깃든 전장',    boss:0, mc:5, lmin:9,  lmax:12, exp:310,  gold:135, w:12, h:10, base:'stone' },
        { n:12, name:'고구려 최후의 전투', desc:'동방의 대제국 최후의 날',      boss:1, mc:6, lmin:9,  lmax:13, exp:400,  gold:200, w:12, h:12, base:'stone' },
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
        { n:10, name:'계백 장군의 결전',   desc:'충의의 장군과의 결전',         boss:1, mc:5, lmin:10, lmax:14, exp:420,  gold:210, w:12, h:12, base:'grass' },
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
        { n:11, name:'문무왕 해중릉',     desc:'바다 용이 된 왕의 시련',       boss:0, mc:5, lmin:13, lmax:16, exp:350,  gold:165, w:12, h:10, base:'stone' },
        { n:12, name:'삼국통일 대전',     desc:'천년 전쟁의 종결',             boss:1, mc:6, lmin:13, lmax:17, exp:500,  gold:250, w:12, h:12, base:'grass' },
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
        { n:10, name:'해동성국 최후',     desc:'발해 멸망의 마지막 전쟁',      boss:1, mc:6, lmin:15, lmax:18, exp:550,  gold:275, w:12, h:12, base:'stone' },
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
        { n:11, name:'만월대 공방',       desc:'고려 궁궐의 최후 방어',        boss:0, mc:5, lmin:17, lmax:20, exp:460,  gold:220, w:12, h:10, base:'stone' },
        { n:12, name:'고려 최후의 전투',   desc:'왕조의 종말',                  boss:0, mc:5, lmin:17, lmax:20, exp:480,  gold:230, w:12, h:10, base:'stone' },
        { n:13, name:'강감찬 대원수 결전', desc:'귀주의 영웅과의 최종 결전',    boss:1, mc:6, lmin:18, lmax:21, exp:650,  gold:325, w:14, h:12, base:'grass' },
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
        { n:11, name:'실학자의 서재',     desc:'실학의 정신이 깃든 전장',      boss:0, mc:5, lmin:20, lmax:23, exp:530,  gold:260, w:12, h:10, base:'stone' },
        { n:12, name:'동학농민 전장',     desc:'민중 봉기의 전쟁터',           boss:0, mc:5, lmin:20, lmax:23, exp:550,  gold:270, w:12, h:10, base:'grass' },
        { n:13, name:'경회루 결전',       desc:'연못 위의 누각에서의 결전',    boss:0, mc:5, lmin:20, lmax:23, exp:570,  gold:280, w:12, h:10, base:'stone' },
        { n:14, name:'세종대왕의 시련',   desc:'성군이 남긴 최후의 시험',      boss:1, mc:6, lmin:21, lmax:25, exp:750,  gold:375, w:14, h:12, base:'stone' },
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
        { n:11, name:'사천해전',          desc:'거북선의 포화',               boss:0, mc:5, lmin:23, lmax:26, exp:620,  gold:305, w:12, h:10, base:'stone' },
        { n:12, name:'명량해협',          desc:'13척의 기적',                 boss:0, mc:5, lmin:23, lmax:26, exp:650,  gold:320, w:12, h:10, base:'stone' },
        { n:13, name:'노량해전 전야',     desc:'마지막 해전 직전의 전투',      boss:0, mc:5, lmin:24, lmax:27, exp:680,  gold:335, w:12, h:10, base:'stone' },
        { n:14, name:'노량 최후의 전투',   desc:'이순신 장군 전사의 해전',      boss:0, mc:6, lmin:24, lmax:27, exp:710,  gold:350, w:12, h:12, base:'stone' },
        { n:15, name:'이순신 장군 결전',   desc:'불멸의 영웅과의 최종 결전',    boss:1, mc:7, lmin:25, lmax:28, exp:900,  gold:450, w:14, h:14, base:'stone' },
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
        { n:11, name:'윤봉길 의거',       desc:'도시락 폭탄의 전장',          boss:0, mc:5, lmin:26, lmax:29, exp:740,  gold:370, w:12, h:10, base:'stone' },
        { n:12, name:'광복군 전선',       desc:'마지막 독립전쟁',             boss:0, mc:5, lmin:26, lmax:29, exp:770,  gold:385, w:12, h:10, base:'grass' },
        { n:13, name:'해방 전야',         desc:'광복 직전의 최후 전투',        boss:0, mc:6, lmin:27, lmax:30, exp:800,  gold:400, w:12, h:12, base:'dark' },
        { n:14, name:'안중근의 결의',     desc:'동양 평화를 위한 영웅의 전투', boss:0, mc:6, lmin:27, lmax:30, exp:840,  gold:420, w:12, h:12, base:'stone' },
        { n:15, name:'독립의 새벽 결전',   desc:'모든 역사의 힘이 모인 최종전', boss:1, mc:7, lmin:28, lmax:32, exp:1200, gold:600, w:14, h:14, base:'dark' },
      ],
    };

    // 맵 타일 오버라이드 자동 생성
    function generateMapOverrides(w, h, base, stageNum, isBoss) {
      const overrides = [];
      const rng = (seed) => {
        let s = seed;
        return () => { s = (s * 16807 + 11) % 2147483647; return s / 2147483647; };
      };
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
        for (let dx = 0; dx < size && cx + dx < w; dx++) {
          for (let dz = 0; dz < size && cz + dz < h; dz++) {
            coords.push([cx + dx, cz + dz]);
          }
        }
        if (coords.length > 0) {
          overrides.push({ coords, height, type });
        }
      }

      // 보스맵 중앙 고지대
      if (isBoss) {
        const cx = Math.floor(w / 2);
        const cz = Math.floor(h / 2);
        overrides.push({
          coords: [[cx, cz], [cx-1, cz], [cx, cz-1], [cx-1, cz-1]],
          height: 3,
          type: 'stone'
        });
      }

      return overrides;
    }

    function generateSpawns(w, h, side, count) {
      const spawns = [];
      if (side === 'player') {
        for (let i = 0; i < count; i++) {
          spawns.push({ x: i % 2, z: Math.floor(i / 2) });
        }
      } else {
        for (let i = 0; i < count; i++) {
          spawns.push({ x: w - 1 - (i % 2), z: h - 1 - Math.floor(i / 2) });
        }
      }
      return spawns;
    }

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

  for (const [dungeonKey, stages] of Object.entries(dungeonStageData)) {
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

  // ========== 대장간 시스템 ==========

  // items 테이블에 등급, 강화 관련 컬럼 추가
  await pool.query("ALTER TABLE items ADD COLUMN grade ENUM('일반','고급','희귀','영웅','전설','신화') DEFAULT '일반'").catch(() => {});
  await pool.query("ALTER TABLE items MODIFY COLUMN grade ENUM('일반','고급','희귀','영웅','전설','신화') DEFAULT '일반'").catch(() => {});
  await pool.query("ALTER TABLE items ADD COLUMN max_enhance INT DEFAULT 0").catch(() => {});
  await pool.query("ALTER TABLE items ADD COLUMN craftable TINYINT(1) DEFAULT 0").catch(() => {});

  // inventory 테이블에 강화 레벨 추가
  await pool.query("ALTER TABLE inventory ADD COLUMN enhance_level INT DEFAULT 0").catch(() => {});

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
      grade ENUM('일반','고급','희귀','영웅','전설','신화') DEFAULT '일반',
      description VARCHAR(200),
      sell_price INT DEFAULT 5
    )
  `);
  await pool.query("ALTER TABLE materials MODIFY COLUMN grade ENUM('일반','고급','희귀','영웅','전설','신화') DEFAULT '일반'").catch(() => {});

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
      (1,  1.00,   100, 1, 0.05),
      (2,  0.95,   200, 1, 0.05),
      (3,  0.90,   400, 2, 0.05),
      (4,  0.85,   600, 2, 0.06),
      (5,  0.75,   1000, 3, 0.06),
      (6,  0.65,   1500, 3, 0.07),
      (7,  0.55,   2000, 4, 0.07),
      (8,  0.45,   3000, 5, 0.08),
      (9,  0.35,   4000, 6, 0.08),
      (10, 0.25,   5000, 7, 0.09),
      (11, 0.18,   7000, 8, 0.09),
      (12, 0.12,   9000, 10, 0.10),
      (13, 0.08,  12000, 12, 0.10),
      (14, 0.05,  15000, 15, 0.11),
      (15, 0.03,  20000, 20, 0.12),
      (16, 0.025, 30000, 25, 0.13),
      (17, 0.02,  40000, 30, 0.13),
      (18, 0.015, 55000, 35, 0.14),
      (19, 0.01,  75000, 40, 0.14),
      (20, 0.005, 100000, 50, 0.15)
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

  // 몬스터 드랍 설정 (카테고리 기반)
  const [existingDrops] = await pool.query('SELECT COUNT(*) as cnt FROM monster_drops');
  if (existingDrops[0].cnt === 0) {
    const [matRows] = await pool.query('SELECT id, name FROM materials');
    const mMat = {};
    for (const m of matRows) mMat[m.name] = m.id;

    const [monsterRows] = await pool.query('SELECT m.id, m.name, m.category_id, m.tier, mc.name as cat_name FROM monsters m LEFT JOIN monster_categories mc ON m.category_id = mc.id');

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

      // 불/얼음 정수 (정령 특화)
      if (mon.name.includes('불') && mMat['불꽃 정수']) dropInserts.push(`(${mon.id}, ${mMat['불꽃 정수']}, 0.20, 1, 1)`);
      if (mon.name.includes('얼음') && mMat['얼음 정수']) dropInserts.push(`(${mon.id}, ${mMat['얼음 정수']}, 0.20, 1, 1)`);

      // 고티어 암흑 정수
      if (tier >= 5 && (cat === '악마/마족' || cat === '언데드') && mMat['암흑의 정수']) {
        dropInserts.push(`(${mon.id}, ${mMat['암흑의 정수']}, 0.08, 1, 1)`);
      }
    }

    // batch insert
    if (dropInserts.length > 0) {
      const batchSize = 100;
      for (let i = 0; i < dropInserts.length; i += batchSize) {
        const batch = dropInserts.slice(i, i + batchSize);
        await pool.query(`INSERT IGNORE INTO monster_drops (monster_id, material_id, drop_rate, min_quantity, max_quantity) VALUES ${batch.join(',')}`);
      }
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

  // 몬스터 속성 배정 (카테고리 기반)
  const [elMonCheck] = await pool.query("SELECT COUNT(*) as cnt FROM monsters WHERE element != 'neutral'");
  if (elMonCheck[0].cnt === 0) {
    // 카테고리별 속성 매핑
    await pool.query("UPDATE monsters m JOIN monster_categories mc ON m.category_id = mc.id SET m.element='fire' WHERE mc.name IN ('악마/마족','용족') AND m.element='neutral'").catch(() => {});
    await pool.query("UPDATE monsters m JOIN monster_categories mc ON m.category_id = mc.id SET m.element='water' WHERE mc.name IN ('수생/해양','슬라임/연체') AND m.element='neutral'").catch(() => {});
    await pool.query("UPDATE monsters m JOIN monster_categories mc ON m.category_id = mc.id SET m.element='earth' WHERE mc.name IN ('야수','곤충/벌레','식물/균류') AND m.element='neutral'").catch(() => {});
    await pool.query("UPDATE monsters m JOIN monster_categories mc ON m.category_id = mc.id SET m.element='wind' WHERE mc.name IN ('정령','마법생물') AND m.element='neutral'").catch(() => {});
    await pool.query("UPDATE monsters m JOIN monster_categories mc ON m.category_id = mc.id SET m.element='neutral' WHERE mc.name IN ('귀신/원혼','언데드','인간형','도깨비') AND m.element='neutral'").catch(() => {});
    // 이름 기반 보정 (불/얼음 등)
    await pool.query("UPDATE monsters SET element='fire' WHERE name LIKE '%불%' OR name LIKE '%화염%'").catch(() => {});
    await pool.query("UPDATE monsters SET element='water' WHERE name LIKE '%얼음%' OR name LIKE '%빙%' OR name LIKE '%물%'").catch(() => {});
    await pool.query("UPDATE monsters SET element='wind' WHERE name LIKE '%바람%' OR name LIKE '%뇌%' OR name LIKE '%번개%'").catch(() => {});
  }

  // 소환수 속성 배정
  const [elSumCheck] = await pool.query("SELECT COUNT(*) as cnt FROM summon_templates WHERE element != 'neutral'");
  if (elSumCheck[0].cnt === 0) {
    await pool.query("UPDATE summon_templates SET element='fire' WHERE name LIKE '%불%' OR name LIKE '%화%' OR type='공격'").catch(() => {});
    await pool.query("UPDATE summon_templates SET element='water' WHERE name LIKE '%물%' OR name LIKE '%해%' OR type='회복'").catch(() => {});
    await pool.query("UPDATE summon_templates SET element='earth' WHERE name LIKE '%산%' OR name LIKE '%토%' OR type='방어'").catch(() => {});
    await pool.query("UPDATE summon_templates SET element='wind' WHERE name LIKE '%바람%' OR name LIKE '%풍%' OR type='지원'").catch(() => {});
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
      ('검사 이준', '검사', '빠르고 정확한 검술로 적을 베는 검사.', '⚔️', 300, 150,
       90, 25, 10, 6, 2, 3, 8, 5, 14, 3, 2.5, 1.5, 0.3, 0.5, 1, 'melee', 'neutral', 'sword'),
      ('창병 박무', '창병', '긴 창으로 적을 찌르는 전선의 수호자.', '🔱', 350, 175,
       100, 20, 9, 8, 1, 4, 5, 3, 15, 2, 2.0, 2.0, 0.2, 0.5, 1, 'melee', 'earth', 'spear'),
      ('궁수 한소이', '궁수', '먼 거리에서 화살로 적을 관통하는 명궁.', '🏹', 400, 200,
       70, 30, 11, 3, 4, 3, 12, 8, 10, 4, 2.5, 0.8, 0.8, 0.5, 2, 'ranged', 'wind', 'bow'),
      ('도사 최현', '도사', '부적과 주문으로 적을 공격하는 술사.', '📜', 450, 225,
       65, 60, 3, 3, 12, 6, 6, 4, 8, 8, 0.5, 0.5, 2.5, 1.5, 3, 'magic', 'fire', 'talisman'),
      ('무사 강철', '무사', '묵직한 일격으로 적을 쓰러뜨리는 전사.', '🗡️', 500, 250,
       120, 15, 12, 10, 1, 5, 7, 2, 18, 2, 2.8, 2.5, 0.2, 0.5, 3, 'melee', 'neutral', 'sword'),
      ('치유사 윤하나', '치유사', '동료의 상처를 치유하는 은빛 치유사.', '💚', 550, 275,
       75, 80, 2, 4, 8, 8, 3, 5, 10, 10, 0.3, 1.0, 2.0, 2.0, 4, 'magic', 'water', 'staff'),
      ('자객 서영', '자객', '그림자 속에서 치명적 일격을 노리는 암살자.', '🗡️', 600, 300,
       60, 35, 14, 2, 6, 2, 18, 15, 8, 3, 3.0, 0.5, 1.0, 0.3, 5, 'melee', 'wind', 'dagger'),
      ('마법사 정은비', '마법사', '강력한 마법으로 광역 피해를 주는 마도사.', '🔮', 700, 350,
       55, 90, 2, 2, 15, 7, 5, 3, 6, 12, 0.3, 0.3, 3.0, 1.5, 6, 'magic', 'fire', 'staff')
    `);
  }

  console.log('Database initialized');
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

module.exports = { pool, initialize, getSelectedChar };
