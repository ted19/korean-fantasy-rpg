// 스탯 시스템 마이그레이션: attack/defense → 6개 스탯
const mysql = require('mysql2/promise');

(async () => {
  const pool = mysql.createPool({ host:'localhost', user:'root', password:'root', database:'game' });

  console.log('=== 스탯 시스템 마이그레이션 시작 ===\n');

  // 1. characters 테이블에 새 컬럼 추가
  console.log('1. characters 테이블 마이그레이션...');
  const charCols = [
    ['phys_attack', 'INT DEFAULT 10'],
    ['phys_defense', 'INT DEFAULT 5'],
    ['mag_attack', 'INT DEFAULT 5'],
    ['mag_defense', 'INT DEFAULT 3'],
    ['crit_rate', 'INT DEFAULT 5'],
    ['evasion', 'INT DEFAULT 3'],
  ];
  for (const [col, def] of charCols) {
    await pool.query(`ALTER TABLE characters ADD COLUMN ${col} ${def}`).catch(() => {});
  }
  // 기존 attack/defense 값 기반으로 새 스탯 채우기
  // 풍수사: 마법형 (mag_attack 높음, phys 낮음)
  await pool.query(`UPDATE characters SET phys_attack = FLOOR(attack * 0.4), mag_attack = FLOOR(attack * 0.8), phys_defense = FLOOR(defense * 0.5), mag_defense = FLOOR(defense * 0.8), crit_rate = 5, evasion = 5 WHERE class_type = '풍수사' AND phys_attack = 10`);
  // 무당: 균형형
  await pool.query(`UPDATE characters SET phys_attack = FLOOR(attack * 0.5), mag_attack = FLOOR(attack * 0.7), phys_defense = FLOOR(defense * 0.6), mag_defense = FLOOR(defense * 0.7), crit_rate = 8, evasion = 8 WHERE class_type = '무당' AND phys_attack = 10`);
  // 승려: 물리형 (phys 높음, mag 낮음)
  await pool.query(`UPDATE characters SET phys_attack = FLOOR(attack * 0.9), mag_attack = FLOOR(attack * 0.3), phys_defense = FLOOR(defense * 0.9), mag_defense = FLOOR(defense * 0.4), crit_rate = 10, evasion = 3 WHERE class_type = '승려' AND phys_attack = 10`);
  console.log('  characters OK');

  // 2. monsters 테이블에 새 컬럼 추가
  console.log('2. monsters 테이블 마이그레이션...');
  const monCols = [
    ['phys_attack', 'INT DEFAULT 5'],
    ['phys_defense', 'INT DEFAULT 3'],
    ['mag_attack', 'INT DEFAULT 3'],
    ['mag_defense', 'INT DEFAULT 2'],
    ['crit_rate', 'INT DEFAULT 5'],
    ['evasion', 'INT DEFAULT 3'],
  ];
  for (const [col, def] of monCols) {
    await pool.query(`ALTER TABLE monsters ADD COLUMN ${col} ${def}`).catch(() => {});
  }
  // 몬스터: attack 기반으로 물리/마법 분배 (ai_type에 따라)
  // ranged/support → 마법 위주, aggressive → 물리 위주, boss → 균형
  await pool.query(`UPDATE monsters SET phys_attack = FLOOR(attack * 0.8), mag_attack = FLOOR(attack * 0.3), phys_defense = FLOOR(defense * 0.7), mag_defense = FLOOR(defense * 0.4), crit_rate = 5, evasion = 3 WHERE ai_type = 'aggressive' AND phys_attack = 5`);
  await pool.query(`UPDATE monsters SET phys_attack = FLOOR(attack * 0.9), mag_attack = FLOOR(attack * 0.2), phys_defense = FLOOR(defense * 0.9), mag_defense = FLOOR(defense * 0.3), crit_rate = 3, evasion = 2 WHERE ai_type = 'defensive' AND phys_attack = 5`);
  await pool.query(`UPDATE monsters SET phys_attack = FLOOR(attack * 0.3), mag_attack = FLOOR(attack * 0.9), phys_defense = FLOOR(defense * 0.4), mag_defense = FLOOR(defense * 0.8), crit_rate = 8, evasion = 5 WHERE ai_type = 'ranged' AND phys_attack = 5`);
  await pool.query(`UPDATE monsters SET phys_attack = FLOOR(attack * 0.3), mag_attack = FLOOR(attack * 0.8), phys_defense = FLOOR(defense * 0.5), mag_defense = FLOOR(defense * 0.9), crit_rate = 5, evasion = 5 WHERE ai_type = 'support' AND phys_attack = 5`);
  await pool.query(`UPDATE monsters SET phys_attack = FLOOR(attack * 0.7), mag_attack = FLOOR(attack * 0.7), phys_defense = FLOOR(defense * 0.7), mag_defense = FLOOR(defense * 0.7), crit_rate = 10, evasion = 5 WHERE ai_type = 'boss' AND phys_attack = 5`);
  await pool.query(`UPDATE monsters SET phys_attack = FLOOR(attack * 0.5), mag_attack = FLOOR(attack * 0.3), phys_defense = FLOOR(defense * 0.3), mag_defense = FLOOR(defense * 0.3), crit_rate = 3, evasion = 15 WHERE ai_type = 'coward' AND phys_attack = 5`);
  // 아직 기본값인 경우 (ai_type이 null이거나 미분류)
  await pool.query(`UPDATE monsters SET phys_attack = FLOOR(attack * 0.7), mag_attack = FLOOR(attack * 0.4), phys_defense = FLOOR(defense * 0.6), mag_defense = FLOOR(defense * 0.5), crit_rate = 5, evasion = 3 WHERE phys_attack = 5 AND attack > 5`);
  await pool.query(`UPDATE monsters SET phys_attack = attack, mag_attack = FLOOR(attack * 0.3), phys_defense = defense, mag_defense = FLOOR(defense * 0.3), crit_rate = 5, evasion = 3 WHERE phys_attack = 5 AND attack <= 5`);
  console.log('  monsters OK');

  // 3. summon_templates 테이블에 새 컬럼 추가
  console.log('3. summon_templates 테이블 마이그레이션...');
  const sumTCols = [
    ['base_phys_attack', 'INT DEFAULT 3'],
    ['base_phys_defense', 'INT DEFAULT 2'],
    ['base_mag_attack', 'INT DEFAULT 2'],
    ['base_mag_defense', 'INT DEFAULT 2'],
    ['base_crit_rate', 'INT DEFAULT 5'],
    ['base_evasion', 'INT DEFAULT 3'],
  ];
  for (const [col, def] of sumTCols) {
    await pool.query(`ALTER TABLE summon_templates ADD COLUMN ${col} ${def}`).catch(() => {});
  }
  // 소환수 타입별 분배
  // 귀신: 마법형
  await pool.query(`UPDATE summon_templates SET base_phys_attack = FLOOR(base_attack * 0.3), base_mag_attack = FLOOR(base_attack * 0.9), base_phys_defense = FLOOR(base_defense * 0.4), base_mag_defense = FLOOR(base_defense * 0.8), base_crit_rate = 8, base_evasion = 10 WHERE type = '귀신' AND base_phys_attack = 3`);
  // 몬스터: 물리형
  await pool.query(`UPDATE summon_templates SET base_phys_attack = FLOOR(base_attack * 0.9), base_mag_attack = FLOOR(base_attack * 0.2), base_phys_defense = FLOOR(base_defense * 0.8), base_mag_defense = FLOOR(base_defense * 0.3), base_crit_rate = 10, base_evasion = 5 WHERE type = '몬스터' AND base_phys_attack = 3`);
  // 정령: 마법형
  await pool.query(`UPDATE summon_templates SET base_phys_attack = FLOOR(base_attack * 0.3), base_mag_attack = FLOOR(base_attack * 0.9), base_phys_defense = FLOOR(base_defense * 0.5), base_mag_defense = FLOOR(base_defense * 0.9), base_crit_rate = 5, base_evasion = 5 WHERE type = '정령' AND base_phys_attack = 3`);
  // 언데드: 균형형
  await pool.query(`UPDATE summon_templates SET base_phys_attack = FLOOR(base_attack * 0.6), base_mag_attack = FLOOR(base_attack * 0.6), base_phys_defense = FLOOR(base_defense * 0.7), base_mag_defense = FLOOR(base_defense * 0.5), base_crit_rate = 5, base_evasion = 3 WHERE type = '언데드' AND base_phys_attack = 3`);
  console.log('  summon_templates OK');

  // 4. character_summons 테이블에 새 컬럼 추가
  console.log('4. character_summons 테이블 마이그레이션...');
  const sumCCols = [
    ['phys_attack', 'INT DEFAULT 0'],
    ['phys_defense', 'INT DEFAULT 0'],
    ['mag_attack', 'INT DEFAULT 0'],
    ['mag_defense', 'INT DEFAULT 0'],
    ['crit_rate', 'INT DEFAULT 0'],
    ['evasion', 'INT DEFAULT 0'],
  ];
  for (const [col, def] of sumCCols) {
    await pool.query(`ALTER TABLE character_summons ADD COLUMN ${col} ${def}`).catch(() => {});
  }
  // 기존 소환수의 레벨업 보너스를 새 스탯으로 분배
  await pool.query(`UPDATE character_summons cs JOIN summon_templates st ON cs.template_id = st.id SET cs.phys_attack = FLOOR(cs.attack * IF(st.type='몬스터', 0.9, IF(st.type IN ('귀신','정령'), 0.3, 0.6))), cs.mag_attack = FLOOR(cs.attack * IF(st.type IN ('귀신','정령'), 0.9, IF(st.type='몬스터', 0.2, 0.6))), cs.phys_defense = FLOOR(cs.defense * IF(st.type='몬스터', 0.8, IF(st.type='정령', 0.5, 0.6))), cs.mag_defense = FLOOR(cs.defense * IF(st.type IN ('귀신','정령'), 0.8, 0.4)) WHERE cs.phys_attack = 0 AND (cs.attack > 0 OR cs.defense > 0)`);
  console.log('  character_summons OK');

  // 5. items 테이블에 새 이펙트 컬럼 추가
  console.log('5. items 테이블 마이그레이션...');
  const itemCols = [
    ['effect_phys_attack', 'INT DEFAULT 0'],
    ['effect_phys_defense', 'INT DEFAULT 0'],
    ['effect_mag_attack', 'INT DEFAULT 0'],
    ['effect_mag_defense', 'INT DEFAULT 0'],
    ['effect_crit_rate', 'INT DEFAULT 0'],
    ['effect_evasion', 'INT DEFAULT 0'],
  ];
  for (const [col, def] of itemCols) {
    await pool.query(`ALTER TABLE items ADD COLUMN ${col} ${def}`).catch(() => {});
  }
  // 무기: effect_attack → 물리/마법 분배 (클래스별)
  // 풍수사 무기: 마법 위주
  await pool.query(`UPDATE items SET effect_phys_attack = FLOOR(effect_attack * 0.3), effect_mag_attack = FLOOR(effect_attack * 0.8) WHERE type = 'weapon' AND class_restriction = '풍수사' AND effect_phys_attack = 0 AND effect_attack > 0`);
  // 무당 무기: 균형
  await pool.query(`UPDATE items SET effect_phys_attack = FLOOR(effect_attack * 0.5), effect_mag_attack = FLOOR(effect_attack * 0.6) WHERE type = 'weapon' AND class_restriction = '무당' AND effect_phys_attack = 0 AND effect_attack > 0`);
  // 승려 무기: 물리 위주
  await pool.query(`UPDATE items SET effect_phys_attack = FLOOR(effect_attack * 0.8), effect_mag_attack = FLOOR(effect_attack * 0.2) WHERE type = 'weapon' AND class_restriction = '승려' AND effect_phys_attack = 0 AND effect_attack > 0`);
  // 공용 무기: 물리 위주
  await pool.query(`UPDATE items SET effect_phys_attack = FLOOR(effect_attack * 0.8), effect_mag_attack = FLOOR(effect_attack * 0.2) WHERE type = 'weapon' AND class_restriction IS NULL AND effect_phys_attack = 0 AND effect_attack > 0`);
  // 방어구: effect_defense → 물리/마법 분배
  await pool.query(`UPDATE items SET effect_phys_defense = FLOOR(effect_defense * 0.7), effect_mag_defense = FLOOR(effect_defense * 0.4) WHERE type != 'weapon' AND type != 'potion' AND effect_phys_defense = 0 AND effect_defense > 0`);
  // 반지/목걸이: 마법방어 보너스 추가 + 치명타/회피
  await pool.query(`UPDATE items SET effect_mag_defense = GREATEST(effect_mag_defense, 1), effect_crit_rate = FLOOR(effect_attack * 0.3) WHERE type = 'ring' AND effect_crit_rate = 0 AND effect_attack > 0`);
  await pool.query(`UPDATE items SET effect_evasion = FLOOR(effect_defense * 0.5) WHERE type = 'necklace' AND effect_evasion = 0 AND effect_defense > 0`);
  // 장화: 회피 보너스
  await pool.query(`UPDATE items SET effect_evasion = GREATEST(1, FLOOR(effect_attack * 0.5)) WHERE type = 'boots' AND effect_evasion = 0 AND effect_attack > 0`);
  console.log('  items OK');

  // 확인
  const [chars] = await pool.query('SELECT name, class_type, attack, defense, phys_attack, phys_defense, mag_attack, mag_defense, crit_rate, evasion FROM characters LIMIT 5');
  console.log('\n=== 캐릭터 스탯 확인 ===');
  console.table(chars);

  const [mons] = await pool.query('SELECT name, attack, defense, phys_attack, phys_defense, mag_attack, mag_defense, crit_rate, evasion FROM monsters LIMIT 10');
  console.log('\n=== 몬스터 스탯 확인 ===');
  console.table(mons);

  const [sums] = await pool.query('SELECT name, base_attack, base_defense, base_phys_attack, base_phys_defense, base_mag_attack, base_mag_defense, base_crit_rate, base_evasion FROM summon_templates');
  console.log('\n=== 소환수 템플릿 확인 ===');
  console.table(sums);

  const [items] = await pool.query('SELECT name, effect_attack, effect_defense, effect_phys_attack, effect_phys_defense, effect_mag_attack, effect_mag_defense, effect_crit_rate, effect_evasion FROM items WHERE effect_attack > 0 OR effect_defense > 0 LIMIT 15');
  console.log('\n=== 아이템 이펙트 확인 ===');
  console.table(items);

  await pool.end();
  console.log('\n=== 마이그레이션 완료 ===');
})();
