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
  // monsters 테이블에 ai_type 컬럼 추가
  await pool.query("ALTER TABLE monsters ADD COLUMN ai_type ENUM('aggressive','defensive','ranged','support','boss','coward') DEFAULT 'aggressive'").catch(() => {});
  await pool.query("ALTER TABLE monsters ADD COLUMN mp INT DEFAULT 0").catch(() => {});

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
    "UPDATE monsters SET ai_type='aggressive', mp=20 WHERE name IN ('들쥐','야생 늑대','멧돼지','독사','흑곰','설표','지하 도마뱀','삼두견','백호','산토끼')",
    "UPDATE monsters SET ai_type='aggressive', mp=15 WHERE name IN ('독거미','거대 지네','독나방','킬러비','전갈','사마귀 전사','장수풍뎅이')",
    "UPDATE monsters SET ai_type='defensive', mp=20 WHERE name IN ('골렘','마법 갑옷','가디언','트렌트','대지의 정령','돌 도깨비','불가사리','가고일','마나 골렘')",
    "UPDATE monsters SET ai_type='ranged', mp=40 WHERE name IN ('원혼','흑마법사','네크로맨서','대마법사','불의 정령','번개 정령','빛의 정령','어둠의 정령','서큐버스','불 도깨비','마법 화살')",
    "UPDATE monsters SET ai_type='support', mp=50 WHERE name IN ('여왕 개미','물의 정령','유니콘','처녀귀신','독 거미 여왕','연못 도깨비','인어 전사','해마 기사')",
    "UPDATE monsters SET ai_type='boss', mp=60 WHERE name IN ('어둠의 수호자','정령왕','깨비대왕','마왕','용왕','리치왕','크라켄','바다 용','암흑룡','이무기','히드라','화룡','빙룡','발록','세계수의 파편','점액 군주','균류 군주','킹 슬라임')",
    "UPDATE monsters SET ai_type='coward', mp=10 WHERE name IN ('초록 슬라임','파랑 슬라임','꼬마 도깨비','떠도는 영혼','독버섯','포자 군체','봉사귀','숲 도깨비','금속 슬라임')",
    "UPDATE monsters SET mp=25 WHERE mp=0 AND ai_type='aggressive'",
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

  console.log('Database initialized');
}

module.exports = { pool, initialize };
