/**
 * 무한의 탑 절차적 맵 생성기
 * 던전 테마별로 고유한 맵 레이아웃을 생성한다.
 * 층 번호를 시드로 사용하여 동일한 층은 항상 같은 맵을 생성.
 */

// 타일 타입 정의 (던전 테마별)
const THEME_TILES = {
  cave: {
    floor: 'cave_floor', wall: 'cave_wall', water: 'cave_water',
    special: 'cave_crystal', accent1: 'cave_moss', accent2: 'cave_stalagmite',
    danger: 'cave_lava', poison: 'cave_poison', crystal: 'cave_gem',
  },
  goblin: {
    floor: 'goblin_grass', wall: 'goblin_tree', water: 'goblin_mud',
    special: 'goblin_camp', accent1: 'goblin_bush', accent2: 'goblin_mushroom',
    danger: 'goblin_mud', thorns: 'goblin_thorn', poison: 'goblin_swamp',
  },
  mountain: {
    floor: 'mountain_stone', wall: 'mountain_cliff', water: 'mountain_ice',
    special: 'mountain_peak', accent1: 'mountain_snow', accent2: 'mountain_path',
    danger: 'mountain_wind', ice: 'mountain_frost', wind: 'mountain_gale',
  },
  ocean: {
    floor: 'ocean_sand', wall: 'ocean_rock', water: 'ocean_deep',
    special: 'ocean_treasure', accent1: 'ocean_shallow', accent2: 'ocean_coral',
    danger: 'ocean_seaweed', ice: 'ocean_glacier', crystal: 'ocean_pearl',
  },
  temple: {
    floor: 'temple_floor', wall: 'temple_pillar', water: 'temple_void',
    special: 'temple_altar', accent1: 'temple_carpet', accent2: 'temple_garden',
    danger: 'temple_gate', holy: 'temple_blessing', shadow: 'temple_shadow',
  },
  demon: {
    floor: 'demon_stone', wall: 'demon_bone', water: 'demon_abyss',
    special: 'demon_throne', accent1: 'demon_fire', accent2: 'demon_portal',
    danger: 'demon_lava', lava: 'demon_magma', shadow: 'demon_shadow',
  },
  dragon: {
    floor: 'dragon_stone', wall: 'dragon_bone', water: 'dragon_lava',
    special: 'dragon_treasure', accent1: 'dragon_scale', accent2: 'dragon_nest',
    danger: 'dragon_ruin', lava: 'dragon_flame', wind: 'dragon_breath',
  },
};

// 테마별 추가 타일 키 목록 (맵에 랜덤 배치용)
const THEME_EXTRA_TILES = {
  cave: ['poison', 'crystal'],
  goblin: ['thorns', 'poison'],
  mountain: ['ice', 'wind'],
  ocean: ['ice', 'crystal'],
  temple: ['holy', 'shadow'],
  demon: ['lava', 'shadow'],
  dragon: ['lava', 'wind'],
};

// 시드 기반 난수 생성기 (동일 층 = 동일 맵)
function seededRandom(seed) {
  let s = seed;
  return function () {
    s = (s * 1103515245 + 12345) & 0x7fffffff;
    return s / 0x7fffffff;
  };
}

// 맵 레이아웃 템플릿
const LAYOUT_TEMPLATES = [
  // 0: 열린 평원 (초반 층)
  'open',
  // 1: 중앙 장애물
  'center_obstacle',
  // 2: 좌우 대칭 통로
  'corridor',
  // 3: 섬 지형 (물로 둘러싸인)
  'island',
  // 4: 미로형
  'maze',
  // 5: L자 통로
  'l_shape',
  // 6: 십자형
  'cross',
  // 7: 보스 아레나
  'boss_arena',
];

/**
 * 타워 층에 맞는 맵 생성
 * @param {number} floorNum - 층 번호
 * @param {string} dungeonKey - 던전 키 (cave, goblin, mountain, ...)
 * @param {boolean} isBoss - 보스 층 여부
 * @param {number} monsterCount - 몬스터 수
 * @returns {{ width, height, tiles, playerSpawns, monsterSpawns, theme }}
 */
export function generateTowerMap(floorNum, dungeonKey, isBoss, monsterCount) {
  const rand = seededRandom(floorNum * 7919 + dungeonKey.charCodeAt(0) * 31);
  const theme = THEME_TILES[dungeonKey] || THEME_TILES.cave;

  // 맵 크기: 층이 올라갈수록 약간 커짐
  const baseSize = isBoss ? 10 : 8;
  const sizeBonus = Math.min(Math.floor(floorNum / 15), 3);
  const width = baseSize + sizeBonus + (rand() > 0.5 ? 1 : 0);
  const height = baseSize + sizeBonus + (rand() > 0.5 ? 1 : 0);

  // 레이아웃 선택
  let layoutIdx;
  if (isBoss) {
    layoutIdx = 7; // 보스 아레나
  } else if (floorNum <= 3) {
    layoutIdx = 0; // 초반은 열린 맵
  } else {
    layoutIdx = Math.floor(rand() * 7); // 0~6
  }

  // 기본 타일 그리드 생성
  const tiles = [];
  for (let z = 0; z < height; z++) {
    for (let x = 0; x < width; x++) {
      tiles.push({ x, z, height: 0, type: theme.floor, tileKey: 'floor' });
    }
  }

  const setTile = (x, z, tileKey, h = 0) => {
    if (x < 0 || x >= width || z < 0 || z >= height) return;
    const idx = z * width + x;
    if (idx >= 0 && idx < tiles.length) {
      tiles[idx].type = theme[tileKey] || theme.floor;
      tiles[idx].tileKey = tileKey;
      tiles[idx].height = h;
    }
  };

  const getTileKey = (x, z) => {
    if (x < 0 || x >= width || z < 0 || z >= height) return null;
    return tiles[z * width + x]?.tileKey;
  };

  // 레이아웃 적용
  switch (LAYOUT_TEMPLATES[layoutIdx]) {
    case 'open': {
      // 가장자리에 약간의 장식 (벽 없음)
      for (let x = 0; x < width; x++) {
        for (let z = 0; z < height; z++) {
          if ((x === 0 || x === width - 1 || z === 0 || z === height - 1) && rand() < 0.3) {
            setTile(x, z, 'accent1');
          } else if (rand() < 0.08) {
            setTile(x, z, 'accent2');
          }
        }
      }
      break;
    }

    case 'center_obstacle': {
      // 중앙에 벽 블록 (작게, 우회 가능)
      const cx = Math.floor(width / 2);
      const cz = Math.floor(height / 2);
      // 십자형 벽 (대각선 열림)
      setTile(cx, cz, 'wall', 1);
      setTile(cx - 1, cz, 'wall', 1);
      setTile(cx + 1, cz, 'wall', 1);
      setTile(cx, cz - 1, 'wall', 1);
      setTile(cx, cz + 1, 'wall', 1);
      // 산발적 장식
      for (let i = 0; i < 6; i++) {
        const rx = Math.floor(rand() * width);
        const rz = Math.floor(rand() * height);
        if (getTileKey(rx, rz) === 'floor') setTile(rx, rz, rand() < 0.5 ? 'accent1' : 'accent2');
      }
      break;
    }

    case 'corridor': {
      // 넓은 중앙 통로 + 양쪽은 장식 (이동 가능)
      const corridorWidth = 3 + Math.floor(rand() * 2);
      const startCol = Math.floor((width - corridorWidth) / 2);
      for (let z = 0; z < height; z++) {
        for (let x = 0; x < width; x++) {
          if (x < startCol || x >= startCol + corridorWidth) {
            // 양쪽은 장식 + 간헐적 벽 (절대 전체 행을 막지 않음)
            if (rand() < 0.25 && z % 2 === 0) setTile(x, z, 'wall', 1);
            else if (rand() < 0.3) setTile(x, z, 'accent1');
            else if (rand() < 0.15) setTile(x, z, 'accent2');
          }
        }
      }
      setTile(startCol + Math.floor(corridorWidth / 2), Math.floor(height / 2), 'special');
      break;
    }

    case 'island': {
      // 가장자리만 장식 타일 (이동 가능), 물은 모서리에만 소량
      for (let z = 0; z < height; z++) {
        for (let x = 0; x < width; x++) {
          const cx2 = width / 2;
          const cz2 = height / 2;
          const dist = Math.sqrt((x - cx2) ** 2 + (z - cz2) ** 2);
          const radius = Math.min(width, height) / 2;
          if (dist > radius + 0.5) {
            // 모서리만 장식 (이동 가능)
            setTile(x, z, 'accent1');
          } else if (dist > radius - 1) {
            if (rand() < 0.3) setTile(x, z, 'accent2');
          } else if (rand() < 0.06) {
            setTile(x, z, 'accent2');
          }
        }
      }
      // 모서리 4곳에만 소량 물 장식
      setTile(0, 0, 'water'); setTile(width - 1, 0, 'water');
      setTile(0, height - 1, 'water'); setTile(width - 1, height - 1, 'water');
      break;
    }

    case 'maze': {
      // 점 형태 벽 (고립된 벽 블록, 경로 차단 안 함)
      for (let z = 0; z < height; z++) {
        for (let x = 0; x < width; x++) {
          // 격자 교차점에만 단일 벽 배치 (2x2 이상 연결 안 됨)
          if (x % 3 === 1 && z % 3 === 1 && rand() < 0.7) {
            setTile(x, z, 'wall', 1);
          } else if (rand() < 0.06) {
            setTile(x, z, 'accent2');
          } else if (rand() < 0.04) {
            setTile(x, z, 'accent1');
          }
        }
      }
      // 스폰 영역 확보
      for (let dz = 0; dz < 3; dz++) {
        for (let dx = 0; dx < 3; dx++) {
          if (dx < width && dz < height) setTile(dx, height - 1 - dz, 'floor');
          if (width - 1 - dx >= 0 && dz < height) setTile(width - 1 - dx, dz, 'floor');
        }
      }
      break;
    }

    case 'l_shape': {
      // L자 형태 - 우상단은 장식 지형 (이동 가능), 벽은 경계선 일부만
      const splitX = Math.floor(width * 0.55);
      const splitZ = Math.floor(height * 0.45);
      for (let z = 0; z < height; z++) {
        for (let x = 0; x < width; x++) {
          if (x >= splitX && z < splitZ) {
            // 우상단: 장식 (이동 가능)
            if (rand() < 0.3) setTile(x, z, 'accent1');
            else if (rand() < 0.15) setTile(x, z, 'accent2');
          } else if (rand() < 0.06) {
            setTile(x, z, 'accent1');
          }
        }
      }
      // L자 경계에 부분 벽 (통과 구간 있음)
      for (let x = splitX; x < width; x++) {
        if (rand() < 0.5) setTile(x, splitZ, 'wall', 1);
      }
      for (let z = 0; z < splitZ; z++) {
        if (rand() < 0.5) setTile(splitX, z, 'wall', 1);
      }
      // 경계 교차점은 반드시 열어둠
      setTile(splitX, splitZ, 'floor');
      setTile(splitX + 1, splitZ, 'floor');
      setTile(splitX, splitZ - 1, 'floor');
      break;
    }

    case 'cross': {
      // 십자 통로 + 모서리는 장식 (벽/물 대신)
      const armW = Math.max(2, Math.floor(width * 0.35));
      const armH = Math.max(2, Math.floor(height * 0.35));
      const cx = Math.floor(width / 2);
      const cz = Math.floor(height / 2);
      for (let z = 0; z < height; z++) {
        for (let x = 0; x < width; x++) {
          const inHorizontal = Math.abs(z - cz) < armH;
          const inVertical = Math.abs(x - cx) < armW;
          if (!inHorizontal && !inVertical) {
            // 모서리: 벽+장식 혼합 (일부는 이동 가능)
            if (rand() < 0.35) setTile(x, z, 'wall', 1);
            else if (rand() < 0.4) setTile(x, z, 'accent1');
            else setTile(x, z, 'accent2');
          }
        }
      }
      setTile(cx, cz, 'special', 1);
      break;
    }

    case 'boss_arena': {
      // 보스 전용: 넓은 아레나 + 기둥 + 외곽 장식 (이동 가능)
      for (let x = 0; x < width; x++) {
        for (let z = 0; z < height; z++) {
          if (x === 0 || x === width - 1 || z === 0 || z === height - 1) {
            setTile(x, z, 'accent1'); // danger 대신 이동 가능한 장식
          }
        }
      }
      // 4개 기둥
      const px1 = 2, px2 = width - 3, pz1 = 2, pz2 = height - 3;
      setTile(px1, pz1, 'wall', 2);
      setTile(px2, pz1, 'wall', 2);
      setTile(px1, pz2, 'wall', 2);
      setTile(px2, pz2, 'wall', 2);
      // 중앙 특수 타일
      const cx = Math.floor(width / 2);
      const cz = Math.floor(height / 2);
      setTile(cx, cz, 'special', 1);
      setTile(cx - 1, cz, 'accent1');
      setTile(cx + 1, cz, 'accent1');
      setTile(cx, cz - 1, 'accent2');
      setTile(cx, cz + 1, 'accent2');
      break;
    }

    default:
      break;
  }

  // ===== Flood fill 연결성 검증 + 자동 수정 =====
  // 모든 walkable 타일이 연결되어 있는지 확인하고, 분리된 영역의 벽을 제거
  const BLOCKED_CHECK = new Set(['wall', 'water', 'danger', 'lava']);
  function floodFill(startX, startZ) {
    const visited = new Set();
    const queue = [{ x: startX, z: startZ }];
    visited.add(`${startX},${startZ}`);
    while (queue.length > 0) {
      const { x, z } = queue.shift();
      const dirs = [{ dx: 1, dz: 0 }, { dx: -1, dz: 0 }, { dx: 0, dz: 1 }, { dx: 0, dz: -1 }];
      for (const { dx, dz } of dirs) {
        const nx = x + dx, nz = z + dz;
        const key = `${nx},${nz}`;
        if (nx < 0 || nx >= width || nz < 0 || nz >= height) continue;
        if (visited.has(key)) continue;
        const tk = getTileKey(nx, nz);
        if (BLOCKED_CHECK.has(tk)) continue;
        visited.add(key);
        queue.push({ x: nx, z: nz });
      }
    }
    return visited;
  }

  // 첫 번째 walkable 타일에서 시작
  const firstWalkable = tiles.find(t => !BLOCKED_CHECK.has(t.tileKey));
  if (firstWalkable) {
    const reachable = floodFill(firstWalkable.x, firstWalkable.z);
    // 도달 불가능한 walkable 타일이 있으면, 그쪽으로 가는 경로의 벽을 제거
    const unreachable = tiles.filter(t => !BLOCKED_CHECK.has(t.tileKey) && !reachable.has(`${t.x},${t.z}`));
    if (unreachable.length > 0) {
      // 도달 가능 영역과 불가능 영역 사이의 벽을 뚫음
      for (const ut of unreachable) {
        const dirs = [{ dx: 1, dz: 0 }, { dx: -1, dz: 0 }, { dx: 0, dz: 1 }, { dx: 0, dz: -1 }];
        for (const { dx, dz } of dirs) {
          const nx = ut.x + dx, nz = ut.z + dz;
          if (nx < 0 || nx >= width || nz < 0 || nz >= height) continue;
          const tk = getTileKey(nx, nz);
          if (BLOCKED_CHECK.has(tk)) {
            // 벽 뒤가 도달 가능 영역인지 확인
            const nx2 = nx + dx, nz2 = nz + dz;
            if (reachable.has(`${nx2},${nz2}`) || reachable.has(`${nx},${nz}`)) {
              setTile(nx, nz, 'floor');
            }
          }
        }
      }
      // 2차 검증: 아직도 분리되어 있으면 벽 강제 제거
      const reachable2 = floodFill(firstWalkable.x, firstWalkable.z);
      tiles.forEach(t => {
        if (!BLOCKED_CHECK.has(t.tileKey) && !reachable2.has(`${t.x},${t.z}`)) {
          // 이 타일에서 도달 가능 영역 방향으로 직선 벽 제거
          let found = false;
          for (let dx = -1; dx <= 1 && !found; dx++) {
            for (let dz = -1; dz <= 1 && !found; dz++) {
              if (dx === 0 && dz === 0) continue;
              for (let dist = 1; dist <= Math.max(width, height); dist++) {
                const cx = t.x + dx * dist, cz = t.z + dz * dist;
                if (cx < 0 || cx >= width || cz < 0 || cz >= height) break;
                if (reachable2.has(`${cx},${cz}`)) { found = true; break; }
                if (BLOCKED_CHECK.has(getTileKey(cx, cz))) setTile(cx, cz, 'floor');
              }
            }
          }
        }
      });
    }
  }

  // 높이 변화 추가 (층 높을수록 고저차 있음)
  if (floorNum > 5) {
    const elevations = Math.floor(rand() * 3) + 1;
    for (let i = 0; i < elevations; i++) {
      const rx = 1 + Math.floor(rand() * (width - 2));
      const rz = 1 + Math.floor(rand() * (height - 2));
      const size = Math.floor(rand() * 2) + 1;
      for (let dx = -size; dx <= size; dx++) {
        for (let dz = -size; dz <= size; dz++) {
          if (getTileKey(rx + dx, rz + dz) === 'floor') {
            const idx = (rz + dz) * width + (rx + dx);
            if (idx >= 0 && idx < tiles.length) {
              tiles[idx].height = Math.min(tiles[idx].height + 1, 3);
            }
          }
        }
      }
    }
  }

  // 테마별 추가 지형 타일 랜덤 배치 (층이 높을수록 많이)
  const extras = THEME_EXTRA_TILES[dungeonKey] || [];
  if (extras.length > 0) {
    const extraCount = 2 + Math.floor(floorNum / 8) + Math.floor(rand() * 3);
    for (let i = 0; i < extraCount; i++) {
      const rx = Math.floor(rand() * width);
      const rz = Math.floor(rand() * height);
      if (getTileKey(rx, rz) === 'floor') {
        const extraKey = extras[Math.floor(rand() * extras.length)];
        setTile(rx, rz, extraKey);
      }
    }
  }

  // 스폰 위치 계산 - 이동 불가 타일 제외
  const BLOCKED_TILES = new Set(['wall', 'water', 'danger', 'lava']);
  const walkable = tiles.filter(t => !BLOCKED_TILES.has(t.tileKey));

  // 가장 큰 연결 영역 찾기 (스폰은 여기에만 배치)
  function getConnectedRegion(startX, startZ) {
    const visited = new Set();
    const queue = [{ x: startX, z: startZ }];
    visited.add(`${startX},${startZ}`);
    while (queue.length > 0) {
      const { x, z } = queue.shift();
      for (const [dx, dz] of [[1,0],[-1,0],[0,1],[0,-1]]) {
        const nx = x + dx, nz = z + dz;
        const key = `${nx},${nz}`;
        if (nx < 0 || nx >= width || nz < 0 || nz >= height || visited.has(key)) continue;
        const tk = getTileKey(nx, nz);
        if (!BLOCKED_TILES.has(tk)) { visited.add(key); queue.push({ x: nx, z: nz }); }
      }
    }
    return visited;
  }

  // 가장 큰 연결 영역 탐색
  const allVisited = new Set();
  let largestRegion = new Set();
  for (const t of walkable) {
    const key = `${t.x},${t.z}`;
    if (allVisited.has(key)) continue;
    const region = getConnectedRegion(t.x, t.z);
    region.forEach(k => allVisited.add(k));
    if (region.size > largestRegion.size) largestRegion = region;
  }

  const mainWalkable = walkable.filter(t => largestRegion.has(`${t.x},${t.z}`));

  // 플레이어: 좌하단 근처
  const playerCandidates = mainWalkable
    .filter(t => t.x < width * 0.4 && t.z > height * 0.4)
    .sort((a, b) => (a.x + (height - a.z)) - (b.x + (height - b.z)));
  if (playerCandidates.length === 0) {
    playerCandidates.push(...mainWalkable.slice(0, 6));
  }

  const playerSpawns = [];
  const usedSpawns = new Set();
  const maxPlayers = Math.min(6, playerCandidates.length);
  for (let i = 0; i < maxPlayers; i++) {
    const key = `${playerCandidates[i].x},${playerCandidates[i].z}`;
    if (!usedSpawns.has(key)) {
      playerSpawns.push({ x: playerCandidates[i].x, z: playerCandidates[i].z });
      usedSpawns.add(key);
    }
  }

  // 몬스터: 우상단 근처 (플레이어 스폰과 겹치지 않게)
  const monsterCandidates = mainWalkable
    .filter(t => !usedSpawns.has(`${t.x},${t.z}`) && (t.x > width * 0.4 || t.z < height * 0.4))
    .sort((a, b) => ((width - a.x) + a.z) - ((width - b.x) + b.z));
  if (monsterCandidates.length === 0) {
    monsterCandidates.push(...mainWalkable.filter(t => !usedSpawns.has(`${t.x},${t.z}`)).slice(0, 8));
  }

  const monsterSpawns = [];
  const maxMonsters = Math.min(monsterCount || 4, monsterCandidates.length);
  for (let i = 0; i < maxMonsters; i++) {
    const key = `${monsterCandidates[i].x},${monsterCandidates[i].z}`;
    if (!usedSpawns.has(key)) {
      monsterSpawns.push({ x: monsterCandidates[i].x, z: monsterCandidates[i].z });
      usedSpawns.add(key);
    }
  }

  // 부족한 스폰 보충 (강제로 floor 타일 생성)
  if (playerSpawns.length < 1) {
    setTile(0, height - 1, 'floor');
    playerSpawns.push({ x: 0, z: height - 1 });
  }
  if (monsterSpawns.length < 1) {
    setTile(width - 1, 0, 'floor');
    monsterSpawns.push({ x: width - 1, z: 0 });
  }

  return {
    name: `${floorNum}층`,
    width,
    height,
    tiles,
    playerSpawns,
    monsterSpawns,
    theme: dungeonKey,
    layout: LAYOUT_TEMPLATES[layoutIdx],
  };
}

/**
 * 타워 맵 타일 타입 → 이미지 경로
 */
export function getTowerTileImage(tileType) {
  return `/tower_sprites/tile_${tileType}.png`;
}

/**
 * 타일 키로 이동 가능 여부 판단
 */
export function isTileWalkable(tileKey) {
  const BLOCKED = new Set(['wall', 'water', 'danger', 'lava']);
  return !BLOCKED.has(tileKey);
}

/**
 * 타일 키로 지형 효과 반환 (battleEngine 호환)
 */
export function getTileTerrainType(tileKey) {
  switch (tileKey) {
    case 'wall': return 'stone';
    case 'water':
    case 'danger': return 'water';
    case 'special': return 'grass';
    case 'accent1': return 'grass';
    case 'accent2': return 'dirt';
    default: return 'grass';
  }
}
