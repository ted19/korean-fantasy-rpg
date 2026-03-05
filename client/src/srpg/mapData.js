// SRPG 맵 데이터 - DB에서 받은 던전 데이터로 맵 생성

const TILE_TYPES = {
  GRASS: 'grass',
  DIRT: 'dirt',
  STONE: 'stone',
  WATER: 'water',
  DARK: 'dark',
};

const TILE_COLORS = {
  grass: '#3a7d44',
  dirt: '#8b6914',
  stone: '#6b6b6b',
  water: '#1e4d8c',
  dark: '#2d1b4e',
};

const TILE_SIDE_COLORS = {
  grass: '#2d5e34',
  dirt: '#6b5010',
  stone: '#4d4d4d',
  water: '#143a6b',
  dark: '#1f1338',
};

// DB 던전 데이터로 맵 생성
export function buildMapFromDungeon(dungeon) {
  const { mapWidth, mapHeight, baseTileType, tileOverrides, playerSpawns, monsterSpawns } = dungeon;

  // 기본 타일로 채우기
  const tiles = [];
  for (let z = 0; z < mapHeight; z++) {
    for (let x = 0; x < mapWidth; x++) {
      tiles.push({ x, z, height: 0, type: baseTileType || 'grass' });
    }
  }

  // 오버라이드 적용
  if (tileOverrides && Array.isArray(tileOverrides)) {
    for (const override of tileOverrides) {
      const { coords, height, type } = override;
      if (!coords) continue;
      for (const [x, z] of coords) {
        const idx = tiles.findIndex(t => t.x === x && t.z === z);
        if (idx !== -1) {
          if (height !== undefined) tiles[idx].height = height;
          if (type !== undefined) tiles[idx].type = type;
        }
      }
    }
  }

  // playerSpawns가 부족하면 기존 스폰 주변에 자동 확장 (최소 6개)
  const MIN_PLAYER_SPAWNS = 9;
  let spawns = playerSpawns && playerSpawns.length > 0 ? [...playerSpawns] : [{ x: 0, z: 0 }];
  if (spawns.length < MIN_PLAYER_SPAWNS) {
    const occupied = new Set(spawns.map(s => `${s.x},${s.z}`));
    const waterTiles = new Set(tiles.filter(t => t.type === 'water').map(t => `${t.x},${t.z}`));
    const dirs = [{dx:1,dz:0},{dx:-1,dz:0},{dx:0,dz:1},{dx:0,dz:-1},{dx:1,dz:1},{dx:-1,dz:1},{dx:1,dz:-1},{dx:-1,dz:-1}];
    let queue = [...spawns];
    while (spawns.length < MIN_PLAYER_SPAWNS && queue.length > 0) {
      const base = queue.shift();
      for (const d of dirs) {
        if (spawns.length >= MIN_PLAYER_SPAWNS) break;
        const nx = base.x + d.dx;
        const nz = base.z + d.dz;
        const key = `${nx},${nz}`;
        if (nx >= 0 && nx < mapWidth && nz >= 0 && nz < mapHeight && !occupied.has(key) && !waterTiles.has(key)) {
          occupied.add(key);
          const newSpawn = { x: nx, z: nz };
          spawns.push(newSpawn);
          queue.push(newSpawn);
        }
      }
    }
  }

  return {
    name: dungeon.name,
    width: mapWidth,
    height: mapHeight,
    tiles,
    playerSpawns: spawns,
    monsterSpawns: monsterSpawns || [{ x: 9, z: 9 }],
  };
}

export { TILE_TYPES, TILE_COLORS, TILE_SIDE_COLORS };
