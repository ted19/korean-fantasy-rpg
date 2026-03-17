import React, { useState, useEffect, useCallback, useRef } from 'react';
import api from '../api';
import ThreeFirstPersonView from './ThreeFirstPersonView';
import './DungeonCrawler.css';

const CLASS_IMAGE_MAP = { '풍수사': 'pungsu', '무당': 'mudang', '승려': 'monk', '저승사자': 'reaper' };
const CLASS_ELEMENT_MAP = { '풍수사': 'wind', '무당': 'dark', '승려': 'light', '저승사자': 'dark' };
const ELEMENT_AURA_MAP = { fire: 'flame', water: 'ice', earth: 'aura_gold', wind: 'wind', neutral: 'holy', light: 'holy', dark: 'shadow', lightning: 'lightning', poison: 'poison' };

// ========== 미로 생성 (Recursive Backtracking) ==========
function generateMaze(width, height, monsterCount, stage, dbMonsters) {
  // 벽 격자 (홀수 좌표 = 통로, 짝수 좌표 = 벽)
  const W = width * 2 + 1;
  const H = height * 2 + 1;
  const grid = Array.from({ length: H }, () => Array(W).fill(1)); // 1 = 벽

  const visited = Array.from({ length: height }, () => Array(width).fill(false));
  const stack = [];
  const dirs = [[0, -1], [1, 0], [0, 1], [-1, 0]];

  const startX = 0, startY = 0;
  visited[startY][startX] = true;
  stack.push([startX, startY]);
  grid[startY * 2 + 1][startX * 2 + 1] = 0;

  while (stack.length > 0) {
    const [cx, cy] = stack[stack.length - 1];
    const neighbors = dirs
      .map(([dx, dy]) => [cx + dx, cy + dy, dx, dy])
      .filter(([nx, ny]) => nx >= 0 && nx < width && ny >= 0 && ny < height && !visited[ny][nx]);

    if (neighbors.length === 0) {
      stack.pop();
    } else {
      const [nx, ny, dx, dy] = neighbors[Math.floor(Math.random() * neighbors.length)];
      visited[ny][nx] = true;
      // 벽 허물기
      grid[cy * 2 + 1 + dy][cx * 2 + 1 + dx] = 0;
      grid[ny * 2 + 1][nx * 2 + 1] = 0;
      stack.push([nx, ny]);
    }
  }

  // 추가 통로 뚫기 (미로가 너무 좁지 않게)
  const extraPaths = Math.floor(width * height * 0.15);
  for (let i = 0; i < extraPaths; i++) {
    const rx = Math.floor(Math.random() * (W - 2)) + 1;
    const ry = Math.floor(Math.random() * (H - 2)) + 1;
    if (grid[ry][rx] === 1) {
      const adj = [[0,1],[0,-1],[1,0],[-1,0]].filter(([dx,dy]) => {
        const nx = rx+dx, ny = ry+dy;
        return nx > 0 && nx < W-1 && ny > 0 && ny < H-1 && grid[ny][nx] === 0;
      });
      if (adj.length >= 2) grid[ry][rx] = 0;
    }
  }

  // 플레이어 시작 위치 (좌상단)
  const playerStart = { x: 1, y: 1 };

  // 출구 (우하단)
  const exitPos = { x: W - 2, y: H - 2 };
  grid[exitPos.y][exitPos.x] = 0;

  // 빈 타일 목록 (시작/출구 제외)
  const emptyTiles = [];
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      if (grid[y][x] === 0 && !(x === playerStart.x && y === playerStart.y) && !(x === exitPos.x && y === exitPos.y)) {
        const dist = Math.abs(x - playerStart.x) + Math.abs(y - playerStart.y);
        if (dist >= 3) emptyTiles.push({ x, y });
      }
    }
  }

  // 몬스터 배치 (실제 몬스터 템플릿 ID 배정) — 필수 처치, 전부 배회
  const shuffled = emptyTiles.sort(() => Math.random() - 0.5);
  const monsters = [];
  const count = Math.min(monsterCount || 5, shuffled.length);
  const pool = dbMonsters || [];
  for (let i = 0; i < count; i++) {
    const template = pool.length > 0 ? pool[Math.floor(Math.random() * pool.length)] : null;
    monsters.push({
      id: `mob_${i}`, ...shuffled[i], defeated: false,
      roaming: true, roamDir: Math.floor(Math.random() * 4),
      monsterId: template?.id || null,
      monsterName: template?.name || '???',
    });
  }

  // 숨겨진 적 배치 (1~3마리, 출구 탈출 필수 아님)
  const hiddenCount = Math.min(1 + Math.floor(Math.random() * 3), Math.max(0, shuffled.length - count - 4));
  for (let i = 0; i < hiddenCount; i++) {
    const slot = shuffled[count + i];
    if (slot) {
      const template = pool.length > 0 ? pool[Math.floor(Math.random() * pool.length)] : null;
      monsters.push({
        id: `hmob_${i}`, ...slot, defeated: false, hidden: true,
        monsterId: template?.id || null,
        monsterName: template?.name || '???',
      });
    }
  }

  // 보물 배치 (2~3개)
  const treasureStart = count + hiddenCount;
  const treasureCount = Math.min(2 + Math.floor(Math.random() * 2), shuffled.length - treasureStart);
  const treasures = [];
  for (let i = 0; i < treasureCount; i++) {
    const t = shuffled[treasureStart + i];
    if (t) treasures.push({ id: `tr_${i}`, ...t, collected: false });
  }

  // 추가 배회형 몬스터 (1~2마리, 선택 처치 보너스)
  const roamStart = treasureStart + treasureCount;
  const roamCount = Math.min(1 + Math.floor(Math.random() * 2), Math.max(0, shuffled.length - roamStart - 2));
  for (let i = 0; i < roamCount; i++) {
    const slot = shuffled[roamStart + i];
    if (slot) {
      const template = pool.length > 0 ? pool[Math.floor(Math.random() * pool.length)] : null;
      monsters.push({
        id: `roam_${i}`, ...slot, defeated: false, roaming: true, hidden: true,
        monsterId: template?.id || null,
        monsterName: template?.name || '???',
        roamDir: Math.floor(Math.random() * 4),
      });
    }
  }

  return { grid, width: W, height: H, playerStart, exitPos, monsters, treasures, isBoss: stage?.isBoss };
}

// ========== 방향 상수 ==========
const DIR = { N: 0, E: 1, S: 2, W: 3 };
// eslint-disable-next-line no-unused-vars
const DIR_NAMES = ['북', '동', '남', '서'];
const DIR_DX = [0, 1, 0, -1];
const DIR_DY = [-1, 0, 1, 0];

// ========== 1인칭 던전 뷰 렌더링 ==========
// ========== 던전별 3D 테마 정의 ==========
const DUNGEON_3D_THEMES = {
  forest: {
    name: '숲',
    wallNS: [28, 55, 22], wallEW: [35, 65, 28],  // 이끼 낀 녹색 벽
    wallAccent: [18, 40, 15],                       // 그라우트/이끼
    ceilTop: [5, 18, 8], ceilBot: [12, 30, 15],    // 짙은 나뭇잎 천장
    floorTop: [35, 28, 18], floorBot: [18, 14, 8], // 흙/낙엽 바닥
    fogColor: [20, 45, 25], fogDensity: 0.7,
    torchColor: [180, 255, 100], torchAlpha: 0.06,  // 녹색빛 발광
    ambientColor: [30, 80, 40], ambientAlpha: 0.04,
    particleType: 'firefly',                         // 반딧불이
    wallPattern: 'bark',                             // 나무껍질 패턴
    floorPattern: 'leaves',                          // 낙엽 패턴
    vineFactor: 0.4,                                 // 벽 덩굴 비율
    mushroomGlow: true,                              // 바닥 버섯 발광
  },
  slime_cave: {
    wallNS: [30, 50, 55], wallEW: [38, 60, 65], wallAccent: [20, 35, 40],
    ceilTop: [8, 15, 18], ceilBot: [15, 28, 32],
    floorTop: [25, 40, 45], floorBot: [10, 20, 22],
    fogColor: [15, 40, 45], fogDensity: 0.65,
    torchColor: [100, 220, 255], torchAlpha: 0.08,
    ambientColor: [40, 120, 140], ambientAlpha: 0.03,
    particleType: 'drip', wallPattern: 'slime', floorPattern: 'wet',
  },
  cave: {
    wallNS: [45, 35, 55], wallEW: [55, 45, 65], wallAccent: [30, 22, 40],
    ceilTop: [8, 6, 13], ceilBot: [15, 12, 25],
    floorTop: [30, 25, 40], floorBot: [12, 10, 18],
    fogColor: [20, 15, 35], fogDensity: 0.6,
    torchColor: [255, 160, 50], torchAlpha: 0.1,
    ambientColor: [80, 50, 120], ambientAlpha: 0.03,
    particleType: 'dust', wallPattern: 'brick', floorPattern: 'stone',
  },
  swamp: {
    wallNS: [40, 50, 25], wallEW: [48, 58, 30], wallAccent: [28, 35, 15],
    ceilTop: [10, 15, 5], ceilBot: [20, 28, 12],
    floorTop: [30, 38, 20], floorBot: [15, 20, 8],
    fogColor: [25, 40, 15], fogDensity: 0.8,
    torchColor: [200, 255, 80], torchAlpha: 0.07,
    ambientColor: [60, 80, 30], ambientAlpha: 0.05,
    particleType: 'spore', wallPattern: 'moss', floorPattern: 'mud',
  },
  ocean: {
    wallNS: [25, 45, 65], wallEW: [30, 55, 75], wallAccent: [15, 30, 50],
    ceilTop: [5, 12, 22], ceilBot: [10, 25, 45],
    floorTop: [20, 35, 50], floorBot: [8, 18, 30],
    fogColor: [10, 30, 55], fogDensity: 0.75,
    torchColor: [80, 180, 255], torchAlpha: 0.09,
    ambientColor: [30, 80, 150], ambientAlpha: 0.05,
    particleType: 'bubble', wallPattern: 'coral', floorPattern: 'sand',
  },
  demon: {
    wallNS: [60, 20, 20], wallEW: [75, 28, 25], wallAccent: [45, 12, 12],
    ceilTop: [15, 3, 3], ceilBot: [30, 8, 8],
    floorTop: [40, 15, 12], floorBot: [20, 6, 5],
    fogColor: [40, 10, 10], fogDensity: 0.55,
    torchColor: [255, 80, 30], torchAlpha: 0.12,
    ambientColor: [150, 40, 20], ambientAlpha: 0.04,
    particleType: 'ember', wallPattern: 'hellstone', floorPattern: 'lava',
  },
  dragon: {
    wallNS: [55, 45, 20], wallEW: [65, 55, 28], wallAccent: [40, 32, 12],
    ceilTop: [12, 8, 3], ceilBot: [25, 18, 8],
    floorTop: [45, 35, 15], floorBot: [22, 16, 6],
    fogColor: [35, 25, 10], fogDensity: 0.5,
    torchColor: [255, 200, 50], torchAlpha: 0.11,
    ambientColor: [120, 90, 30], ambientAlpha: 0.04,
    particleType: 'ember', wallPattern: 'scale', floorPattern: 'bone',
  },
};
// 기본 테마
const DEFAULT_3D_THEME = DUNGEON_3D_THEMES.cave;

// ========== 프로시저럴 텍스처 생성 (128x128, HD 캐시) ==========
const textureCache = {};
function generateTexture(type, theme) {
  const key = type + '_' + (theme?.name || 'default') + '_v3';
  if (textureCache[key]) return textureCache[key];
  const S = 128;
  const data = new Uint8Array(S * S * 3);
  const set = (x, y, r, g, b) => { const i = (y * S + x) * 3; data[i] = r; data[i+1] = g; data[i+2] = b; };
  const hash = (x, y) => ((x * 374761393 + y * 668265263) ^ (x * 1274126177)) & 0x7FFFFFFF;
  const noise = (x, y) => (hash(x, y) % 1000) / 1000;

  if (type === 'wall_bark') {
    for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
      // 석조 블록 구조 (나무 뿌리 사이 돌벽)
      const blockH = 24, blockW = 40;
      const bRow = Math.floor(y / blockH);
      const bOff = (bRow % 2) * (blockW / 2);
      const bx = (x + bOff) % blockW;
      const by = y % blockH;
      const isJoint = by < 2 || bx < 2;
      const jointDark = isJoint ? -0.12 : 0;
      // 나무결
      const grain = Math.sin(y * 0.2 + x * 0.06 + noise(x, y) * 3) * 0.18;
      const ring = Math.sin(Math.sqrt((x-64)*(x-64)+(y-64)*(y-64)) * 0.15) * 0.08;
      const crack = (noise(x>>1, y>>1) > 0.88) ? -0.22 : 0;
      const v = 0.45 + grain + ring + crack + jointDark + noise(x, y) * 0.12;
      const mossy = y > 88 ? (y - 88) / 40 * noise(x*3, y*2) : 0;
      // 나뭇결에 거칠기
      const rough = (noise(x * 4, y * 4) - 0.5) * 0.06;
      const vf = v + rough;
      set(x, y, Math.max(0,(55*(1-mossy)+20*mossy)*vf)|0, Math.max(0,(70*(1-mossy)+85*mossy)*vf)|0, Math.max(0,(35*(1-mossy)+25*mossy)*vf)|0);
    }
  } else if (type === 'wall_brick') {
    for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
      const brickH = 16, brickW = 32;
      const row = Math.floor(y / brickH);
      const off = (row % 2) * (brickW / 2);
      const bx = (x + off) % brickW;
      const by = y % brickH;
      // 줄눈 (모르타르) - 2px 두께로 더 선명하게
      const isGroutH = by < 1;
      const isGroutV = bx < 1;
      const isGroutEdge = by === 1 || bx === 1; // 줄눈 하이라이트 엣지
      const brickId = Math.floor((x + off) / brickW) * 7 + row * 13;
      const brickN = noise(brickId, row);
      const wc = theme?.wallNS || [45, 35, 60];
      if (isGroutH || isGroutV) {
        // 줄눈: 어두운 모르타르
        const gv = 0.15 + noise(x, y) * 0.08;
        const gc = theme?.wallAccent || [20, 18, 25];
        set(x, y, gc[0] * gv | 0, gc[1] * gv | 0, gc[2] * gv | 0);
      } else if (isGroutEdge) {
        // 줄눈 바로 옆: 살짝 밝은 엣지 (입체감)
        const ev = 0.35 + noise(x, y) * 0.1;
        set(x, y, wc[0] * ev * 1.1 | 0, wc[1] * ev * 1.1 | 0, wc[2] * ev * 1.1 | 0);
      } else {
        // 벽돌 본체
        let v = 0.42 + brickN * 0.2 + noise(x, y) * 0.1;
        // 벽돌 색조 변형 (같은 줄 다른 벽돌마다 약간 다른 색)
        const colorShift = (brickId * 37 % 100) / 100 * 0.12 - 0.06;
        v += colorShift;
        // 균열 (일부 벽돌에만)
        if (brickN > 0.75) {
          const crackLine = Math.abs(Math.sin(bx * 0.8 + by * 1.2 + brickN * 10));
          if (crackLine > 0.95) v *= 0.55;
        }
        // 얼룩/풍화 (벽돌 아래쪽에 약간)
        if (by > 5) v *= 0.92 + noise(x * 3, y * 2) * 0.06;
        // 벽돌 표면 거칠기
        v += (noise(x * 5, y * 5) - 0.5) * 0.06;
        set(x, y, Math.min(255, wc[0] * v) | 0, Math.min(255, wc[1] * v) | 0, Math.min(255, wc[2] * v) | 0);
      }
    }
  } else if (type === 'wall_slime') {
    for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
      // 석조 블록 + 슬라임 침식
      const bH = 20, bW = 36;
      const bRow = Math.floor(y / bH); const bOff = (bRow % 2) * 9;
      const bx = (x + bOff) % bW; const by = y % bH;
      const isJoint = by < 1 || bx < 1;
      let base = isJoint ? 0.2 : 0.4 + noise(x,y)*0.15;
      // 슬라임 흘러내림
      const drip = y > 35 ? Math.sin(x*0.5+noise(x*2,0)*3)*0.5+0.5 : 0;
      const glow = drip * (y-35)/29 * 0.5;
      // 석조 표면 거칠기
      base += (noise(x*3, y*3) - 0.5) * 0.06;
      const wc = theme?.wallNS || [30,50,55];
      set(x, y, Math.max(0,wc[0]*base)|0, Math.max(0,(wc[1]+glow*90)*base)|0, Math.max(0,(wc[2]+glow*70)*base)|0);
    }
  } else if (type === 'wall_hellstone') {
    for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
      // 용암석 블록 + 균열 발광
      const bH = 20, bW = 28;
      const bRow = Math.floor(y / bH); const bOff = (bRow % 2) * 7;
      const bx = (x + bOff) % bW; const by = y % bH;
      const isJoint = by < 1 || bx < 1;
      const crack = Math.sin(x*0.4+y*0.25+noise(x,y)*5);
      const glow = crack > 0.8 ? 0.5 + (crack-0.8)*4 : 0;
      const jointGlow = isJoint ? 0.3 + Math.sin(x*0.3+y*0.2)*0.15 : 0;
      let v = isJoint ? 0.15 : 0.35 + noise(x,y)*0.18 + (noise(x*4,y*4)-0.5)*0.06;
      const totalGlow = glow + jointGlow;
      set(x, y, Math.min(255,(60+totalGlow*300)*v)|0, Math.max(0,(20+totalGlow*100)*v)|0, Math.max(0,(15+jointGlow*40)*v)|0);
    }
  } else if (type === 'wall_coral') {
    for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
      // 산호 벽돌 + 해초 패턴
      const bH = 20, bW = 32;
      const bRow = Math.floor(y / bH); const bOff = (bRow % 2) * 8;
      const bx = (x + bOff) % bW; const by = y % bH;
      const isJoint = by < 1 || bx < 1;
      const pat = Math.sin(x*0.3+y*0.2)*Math.cos(x*0.2-y*0.3);
      let v = isJoint ? 0.18 + noise(x,y)*0.06 : 0.4 + pat*0.12 + noise(x,y)*0.12;
      // 산호 돌기
      const bump = noise(x*2, y*2) > 0.8 ? 0.1 : 0;
      v += bump + (noise(x*5,y*5)-0.5)*0.05;
      const wc = theme?.wallNS || [25,45,65];
      set(x, y, Math.max(0,wc[0]*v)|0, Math.max(0,wc[1]*v)|0, Math.max(0,wc[2]*v)|0);
    }
  } else if (type === 'wall_scale') {
    for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
      // 비늘 패턴 (더 세밀하게)
      const scaleH = 10, scaleW = 10;
      const r2 = Math.floor(y/scaleH); const off2 = (r2%2)*Math.floor(scaleW/2);
      const sx = (x+off2)%scaleW; const sy = y%scaleH;
      const edge = sy < 1 || sx < 1;
      const scaleId = Math.floor((x+off2)/scaleW)*7+r2*13;
      const colorVar = (scaleId % 10) / 50 - 0.1;
      let v = edge ? 0.2 : 0.45+((scaleId%5)/20)+noise(x,y)*0.08+colorVar;
      // 비늘 광택
      if (!edge && sx === Math.floor(scaleW/2) && sy === Math.floor(scaleH/2)) v += 0.08;
      v += (noise(x*4,y*4)-0.5)*0.05;
      const wc = theme?.wallNS || [55,45,20];
      set(x, y, Math.max(0,wc[0]*v)|0, Math.max(0,wc[1]*v)|0, Math.max(0,wc[2]*v)|0);
    }
  } else if (type === 'wall_moss') {
    for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
      // 이끼 낀 석조벽
      const bH = 20, bW = 32;
      const bRow = Math.floor(y / bH); const bOff = (bRow % 2) * 8;
      const bx = (x + bOff) % bW; const by = y % bH;
      const isJoint = by < 1 || bx < 1;
      const mp = noise(x>>1, y>>1);
      let v = isJoint ? 0.18 + noise(x,y)*0.06 : 0.35 + mp*0.22 + noise(x,y)*0.1;
      // 이끼 패치 (불규칙)
      const mossP = noise(x*2+13, y*2+7);
      if (mossP > 0.55 && !isJoint) {
        const mInt = (mossP - 0.55) * 3;
        const wc = theme?.wallNS || [40,50,25];
        set(x, y, Math.max(0,(wc[0]-10*mInt)*v)|0, Math.max(0,(wc[1]+15*mInt)*v)|0, Math.max(0,(wc[2]-5*mInt)*v)|0);
      } else {
        v += (noise(x*4,y*4)-0.5)*0.05;
        const wc = theme?.wallNS || [40,50,25];
        set(x, y, Math.max(0,wc[0]*v)|0, Math.max(0,wc[1]*v)|0, Math.max(0,wc[2]*v)|0);
      }
    }
  } else if (type === 'floor_leaves') {
    for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
      const n = noise(x, y);
      const leafy = noise(x>>2, y>>2) > 0.5;
      const r = leafy ? 90+n*40 : 45+n*20;
      const g = leafy ? 50+n*25 : 35+n*15;
      const b = leafy ? 20+n*10 : 18+n*10;
      const v = 0.4 + n * 0.2;
      set(x, y, r*v|0, g*v|0, b*v|0);
    }
  } else if (type === 'floor_stone') {
    for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
      const tile = (Math.floor(x/32)+Math.floor(y/32))%2;
      const edge = (x%32<2)||(y%32<2);
      const v = edge ? 0.18 : tile ? 0.32+noise(x,y)*0.12 : 0.28+noise(x,y)*0.12;
      const fc = theme?.floorTop || [30,25,40];
      set(x, y, fc[0]*v|0, fc[1]*v|0, fc[2]*v|0);
    }
  } else if (type === 'floor_mud') {
    for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
      const puddle = noise(x>>2,y>>2) > 0.65 ? 0.3 : 0;
      const v = 0.3 + noise(x,y)*0.15 + puddle;
      set(x, y, (35-puddle*15)*v|0, (30+puddle*10)*v|0, (18+puddle*20)*v|0);
    }
  } else if (type === 'floor_sand') {
    for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
      const v = 0.35 + noise(x,y)*0.15 + Math.sin(x*0.3+y*0.1)*0.05;
      set(x, y, 50*v|0, 45*v|0, 35*v|0);
    }
  } else if (type === 'floor_lava') {
    for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
      const hot = noise(x>>1,y>>1); const v = 0.3+noise(x,y)*0.2;
      const glow = hot > 0.6 ? (hot-0.6)*2.5 : 0;
      set(x, y, Math.min(255,(40+glow*200)*v)|0, (15+glow*60)*v|0, (10+glow*10)*v|0);
    }
  } else if (type === 'floor_wet') {
    for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
      const v = 0.3+noise(x,y)*0.15;
      set(x, y, 25*v|0, 40*v|0, 48*v|0);
    }
  } else if (type === 'floor_bone') {
    for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
      const bone = noise(x>>2,y>>2)>0.7;
      const v = 0.3+noise(x,y)*0.15;
      set(x, y, bone?(55*v|0):(40*v|0), bone?(50*v|0):(30*v|0), bone?(40*v|0):(15*v|0));
    }
  } else { // ceil / default
    for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
      const v = 0.25+noise(x,y)*0.1;
      const cc = theme?.ceilBot || [15,12,25];
      set(x, y, cc[0]*v|0, cc[1]*v|0, cc[2]*v|0);
    }
  }
  textureCache[key] = data;
  return data;
}

const WALL_TEX_MAP = { bark: 'wall_bark', brick: 'wall_brick', slime: 'wall_slime', hellstone: 'wall_hellstone', coral: 'wall_coral', scale: 'wall_scale', moss: 'wall_moss' };
const FLOOR_TEX_MAP = { leaves: 'floor_leaves', stone: 'floor_stone', mud: 'floor_mud', sand: 'floor_sand', lava: 'floor_lava', wet: 'floor_wet', bone: 'floor_bone' };

// ========== 레이캐스팅 3D 뷰 (DOOM 스타일) ==========
function FirstPersonView({ maze, px, py, facing, monsters, treasures, exitPos, monsterSpeech, dungeonKey, allies }) {
  const canvasRef = useRef(null);
  const spriteCache = useRef({});
  const animRef = useRef(null);
  const smoothPos = useRef({ x: px + 0.5, y: py + 0.5, angle: [(-Math.PI / 2), 0, (Math.PI / 2), Math.PI][facing % 4] });
  const propsRef = useRef({ px, py, facing, monsters, treasures, exitPos, monsterSpeech, dungeonKey });
  const particlesRef = useRef([]);
  const imgDataRef = useRef(null);

  useEffect(() => {
    propsRef.current = { px, py, facing, monsters, treasures, exitPos, monsterSpeech, dungeonKey, allies };
  });

  const getSprite = (src) => {
    if (spriteCache.current[src]) return spriteCache.current[src];
    const img = new Image();
    img.src = src + '?v=2';
    img.onerror = () => {
      if (src.includes('_nobg/')) {
        const fb = new Image();
        fb.src = src.replace('_nobg/', '/') + '?v=2';
        spriteCache.current[src] = fb;
      }
    };
    spriteCache.current[src] = img;
    return img;
  };

  const renderFrame = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas || !maze) return;
    const ctx = canvas.getContext('2d');
    const W = canvas.width;
    const H = canvas.height;
    const grid = maze.grid;
    const mW = maze.width;
    const mH = maze.height;
    const FOV = Math.PI / 3;
    const HALF_FOV = FOV / 2;
    const MAX_DEPTH = 20;
    const now = Date.now();

    const p = propsRef.current;
    const theme = DUNGEON_3D_THEMES[p.dungeonKey] || DEFAULT_3D_THEME;
    const facingAngle = [(-Math.PI / 2), 0, (Math.PI / 2), Math.PI][p.facing % 4];
    const sp = smoothPos.current;

    let angleDiff = facingAngle - sp.angle;
    while (angleDiff > Math.PI) angleDiff -= 2 * Math.PI;
    while (angleDiff < -Math.PI) angleDiff += 2 * Math.PI;
    const LERP = 0.16;
    sp.x += (p.px + 0.5 - sp.x) * LERP;
    sp.y += (p.py + 0.5 - sp.y) * LERP;
    sp.angle += angleDiff * LERP;

    const posX = sp.x, posY = sp.y, angle = sp.angle;

    // 횃불 흔들림
    const tf = 0.88 + Math.sin(now * 0.005) * 0.06 + Math.sin(now * 0.013) * 0.04 + Math.sin(now * 0.0073) * 0.03;

    // 텍스처 로드
    const wallTexType = WALL_TEX_MAP[theme.wallPattern] || 'wall_brick';
    const floorTexType = FLOOR_TEX_MAP[theme.floorPattern] || 'floor_stone';
    const wallTex = generateTexture(wallTexType, theme);
    const floorTex = generateTexture(floorTexType, theme);
    const ceilTex = generateTexture('ceil', theme);
    const TS = 128; // 텍스처 사이즈 (HD)

    // ImageData 직접 조작 (fillRect보다 수배 빠름)
    if (!imgDataRef.current || imgDataRef.current.width !== W) {
      imgDataRef.current = ctx.createImageData(W, H);
    }
    const imgData = imgDataRef.current;
    const buf = imgData.data;

    // 횃불 거리 감쇠 (화면 중앙이 밝고 가장자리 어두움)
    const torchCX = W / 2, torchCY = H * 0.4;
    const torchR = W * 0.7;
    const tc = theme.torchColor;
    const ta = theme.torchAlpha;

    const zBuffer = new Float32Array(W);

    // ===== 레이캐스팅 (1px 해상도) =====
    for (let col = 0; col < W; col++) {
      const rayAngle = angle - HALF_FOV + (col / W) * FOV;
      const sinR = Math.sin(rayAngle);
      const cosR = Math.cos(rayAngle);
      const deltaDistX = Math.abs(1 / (cosR || 1e-10));
      const deltaDistY = Math.abs(1 / (sinR || 1e-10));
      let stepX, stepY, sideDistX, sideDistY, hitSide = 0;
      let mX = Math.floor(posX), mY = Math.floor(posY);

      if (cosR < 0) { stepX = -1; sideDistX = (posX - mX) * deltaDistX; }
      else { stepX = 1; sideDistX = (mX + 1 - posX) * deltaDistX; }
      if (sinR < 0) { stepY = -1; sideDistY = (posY - mY) * deltaDistY; }
      else { stepY = 1; sideDistY = (mY + 1 - posY) * deltaDistY; }

      let hit = false, dist = MAX_DEPTH;
      for (let s = 0; s < 128; s++) {
        if (sideDistX < sideDistY) { sideDistX += deltaDistX; mX += stepX; hitSide = 1; }
        else { sideDistY += deltaDistY; mY += stepY; hitSide = 0; }
        if (mX < 0 || mX >= mW || mY < 0 || mY >= mH || grid[mY][mX] === 1) { hit = true; break; }
      }
      if (hit) {
        dist = hitSide === 1
          ? (mX - posX + (1 - stepX) / 2) / (cosR || 1e-10)
          : (mY - posY + (1 - stepY) / 2) / (sinR || 1e-10);
      }

      const corrDist = dist * Math.cos(rayAngle - angle);
      zBuffer[col] = corrDist;
      const wallH = H / (corrDist || 0.001);
      const wallTop = (H - wallH) / 2;
      const wallBot = wallTop + wallH;

      // 텍스처 U 좌표
      let wallU = hitSide === 1 ? posY + dist * sinR : posX + dist * cosR;
      wallU = wallU - Math.floor(wallU);
      const texX = (wallU * TS) & (TS - 1);
      const sideMul = hitSide === 1 ? 1.15 : 0.85; // EW 벽 밝게

      const yTop = Math.max(0, Math.floor(wallTop));
      const yBot = Math.min(H, Math.ceil(wallBot));

      // 벽 셀 기반 변형 (장식/덩굴/이끼)
      const wallHash = ((mX * 73 + mY * 137) & 0xFFFF);
      const hasVine = theme.vineFactor && (wallHash % 5) < 2;
      // 벽 장식 종류 결정 (해시 기반, 약 30% 벽에 장식)
      const decorType = wallHash % 10; // 0-2: 장식 있음
      const hasTorch = decorType === 0 && corrDist < 6;  // 횃대
      const hasSkull = decorType === 1 && corrDist < 5;   // 두개골
      const hasChain = decorType === 2 && corrDist < 5;   // 쇠사슬
      const hasCrack = (wallHash % 7) === 0;              // 벽 균열
      const hasStain = (wallHash % 6) === 0;              // 얼룩

      for (let row = yTop; row < yBot; row++) {
        const wallV = (row - wallTop) / wallH;
        const texY = (wallV * TS) & (TS - 1);
        const tIdx = (texY * TS + texX) * 3;
        let r = wallTex[tIdx], g = wallTex[tIdx + 1], b = wallTex[tIdx + 2];

        // 덩굴 (숲 테마)
        if (hasVine && theme.wallPattern === 'bark') {
          const vineX = Math.sin(wallU * 6.28 + wallHash) * 0.15 + 0.5;
          const vineW = 0.05 + Math.sin(wallV * 10) * 0.015;
          if (Math.abs(wallU - vineX) < vineW) {
            const vs = 0.8 + Math.sin(wallV * 20) * 0.15;
            r = r * 0.3 + 20 * vs; g = g * 0.3 + 65 * vs; b = b * 0.3 + 12 * vs;
          }
        }

        // === 벽 장식 오버레이 ===
        // 횃대 (벽 중앙 상단 1/3에 횃대 모양)
        if (hasTorch) {
          const tu = wallU, tv = wallV;
          // 횃대 받침 (세로 막대)
          if (Math.abs(tu - 0.5) < 0.03 && tv > 0.25 && tv < 0.55) {
            r = 50; g = 35; b = 20; // 나무색 막대
          }
          // 불꽃 (위쪽에 삼각형)
          if (tv > 0.12 && tv < 0.3) {
            const flameW = 0.06 * (1 - (tv - 0.12) / 0.18);
            if (Math.abs(tu - 0.5) < flameW) {
              const fi = 1 - (tv - 0.12) / 0.18;
              const flicker = 0.8 + Math.sin(now * 0.01 + wallHash) * 0.2;
              r = Math.min(255, r * 0.2 + 255 * fi * flicker);
              g = Math.min(255, g * 0.2 + 160 * fi * flicker);
              b = Math.min(255, b * 0.1 + 30 * fi * flicker);
            }
          }
          // 횃대 고정 브라켓
          if (Math.abs(tv - 0.55) < 0.025 && Math.abs(tu - 0.5) < 0.06) {
            r = 60; g = 55; b = 50; // 쇠 색
          }
        }

        // 두개골 (벽 중앙 하단)
        if (hasSkull) {
          const su = wallU - 0.5, sv = wallV - 0.65;
          const sdist = Math.sqrt(su * su * 4 + sv * sv * 6);
          if (sdist < 0.1) {
            // 두개골 윤곽
            const sint = 1 - sdist / 0.1;
            r = r * (1 - sint * 0.7) + 180 * sint * 0.7;
            g = r * 0.9; b = r * 0.75;
            // 눈구멍
            if ((Math.abs(su + 0.015) < 0.015 || Math.abs(su - 0.015) < 0.015) && Math.abs(sv + 0.01) < 0.015) {
              r *= 0.15; g *= 0.15; b *= 0.15;
            }
          }
        }

        // 쇠사슬 (벽에 세로로 매달린 사슬)
        if (hasChain) {
          const cu = wallU - 0.35;
          if (Math.abs(cu) < 0.015) {
            const link = Math.sin(wallV * 40) * 0.5 + 0.5;
            r = r * 0.4 + 90 * link; g = r * 0.85; b = r * 0.75;
          }
        }

        // 벽 균열 (어두운 선)
        if (hasCrack) {
          const crU = wallU * 64, crV = wallV * 64;
          const crLine = Math.sin(crU * 0.7 + crV * 1.3 + wallHash * 0.01);
          if (Math.abs(crLine) < 0.04 && wallV > 0.2 && wallV < 0.8) {
            r *= 0.4; g *= 0.4; b *= 0.4;
          }
        }

        // 얼룩/풍화 (불규칙한 어두운 패치)
        if (hasStain) {
          const stX = wallU * 10 + wallHash * 0.001;
          const stY = wallV * 8;
          const stN = Math.sin(stX * 2.3) * Math.cos(stY * 1.7) * 0.5 + 0.5;
          if (stN > 0.7 && wallV > 0.4) {
            const stInt = (stN - 0.7) * 2;
            r *= 1 - stInt * 0.35;
            g *= 1 - stInt * 0.3;
            b *= 1 - stInt * 0.25;
          }
        }

        // 거리 감쇠 + 횃불 색상
        const shade = Math.max(0.06, 1 - corrDist / MAX_DEPTH) * tf * sideMul;
        r = r * shade | 0; g = g * shade | 0; b = b * shade | 0;

        // 횃불 따뜻한 빛 가산
        const tdx = col - torchCX, tdy = row - torchCY;
        const tDist = Math.sqrt(tdx * tdx + tdy * tdy) / torchR;
        if (tDist < 1) {
          const tInt = (1 - tDist) * (1 - tDist) * ta * tf * 80;
          r = Math.min(255, r + tc[0] / 255 * tInt | 0);
          g = Math.min(255, g + tc[1] / 255 * tInt | 0);
          b = Math.min(255, b + tc[2] / 255 * tInt | 0);
        }

        const idx = (row * W + col) * 4;
        buf[idx] = r; buf[idx + 1] = g; buf[idx + 2] = b; buf[idx + 3] = 255;
      }

      // ===== 바닥/천장 텍스처 캐스팅 =====
      for (let row = yBot; row < H; row++) {
        // 바닥
        const rowDist = H / (2.0 * row - H);
        const floorX = posX + rowDist * cosR;
        const floorY = posY + rowDist * sinR;
        const ftx = ((floorX * TS) & (TS - 1));
        const fty = ((floorY * TS) & (TS - 1));
        const fIdx = (fty * TS + ftx) * 3;
        const fShade = Math.max(0.04, 1 - rowDist / (MAX_DEPTH * 0.6)) * tf;
        let fr = floorTex[fIdx] * fShade;
        let fg = floorTex[fIdx + 1] * fShade;
        let fb = floorTex[fIdx + 2] * fShade;

        // 바닥 장식 (타일 좌표 기반 해시로 결정)
        const fCellX = Math.floor(floorX), fCellY = Math.floor(floorY);
        const fHash = ((fCellX * 97 + fCellY * 151) & 0xFFFF);
        const fLocalX = floorX - fCellX, fLocalY = floorY - fCellY;

        // 뼈다귀 (약 15% 타일)
        if (fHash % 7 === 0 && rowDist < 5) {
          const boneAngle = fHash * 0.1;
          const bx = (fLocalX - 0.5) * Math.cos(boneAngle) - (fLocalY - 0.5) * Math.sin(boneAngle);
          const by2 = (fLocalX - 0.5) * Math.sin(boneAngle) + (fLocalY - 0.5) * Math.cos(boneAngle);
          if (Math.abs(by2) < 0.04 && Math.abs(bx) < 0.2) {
            // 뼈 본체
            fr = fr * 0.3 + 140 * fShade; fg = fg * 0.3 + 130 * fShade; fb = fb * 0.3 + 110 * fShade;
          }
          // 뼈 끝 마디
          if ((Math.abs(bx - 0.18) < 0.04 || Math.abs(bx + 0.18) < 0.04) && Math.abs(by2) < 0.06) {
            fr = fr * 0.5 + 120 * fShade; fg = fg * 0.5 + 110 * fShade; fb = fb * 0.5 + 95 * fShade;
          }
        }

        // 자갈/돌 (약 20% 타일)
        if (fHash % 5 === 0 && rowDist < 6) {
          const sx = fLocalX - 0.3 - (fHash % 4) * 0.1;
          const sy = fLocalY - 0.4 - (fHash % 3) * 0.1;
          const sd = Math.sqrt(sx * sx + sy * sy);
          if (sd < 0.06) {
            const sv = 0.6 + (fHash % 20) / 100;
            fr = 55 * sv * fShade; fg = 50 * sv * fShade; fb = 45 * sv * fShade;
          }
        }

        // 웅덩이/물기 (약 10% 타일, 가까운 곳만)
        if (fHash % 10 === 3 && rowDist < 4) {
          const px2 = fLocalX - 0.5, py2 = fLocalY - 0.5;
          const pd = Math.sqrt(px2 * px2 + py2 * py2);
          if (pd < 0.15) {
            const pInt = 1 - pd / 0.15;
            // 반사광 (약간 밝게)
            fr = fr * (1 - pInt * 0.3) + 20 * pInt * fShade;
            fg = fg * (1 - pInt * 0.3) + 30 * pInt * fShade;
            fb = fb * (1 - pInt * 0.2) + 40 * pInt * fShade;
          }
        }

        // 횃불
        const fdx = col - torchCX, fdy = row - torchCY;
        const fDist = Math.sqrt(fdx * fdx + fdy * fdy) / torchR;
        if (fDist < 1) {
          const fInt = (1 - fDist) * (1 - fDist) * ta * tf * 50;
          fr = Math.min(255, fr + tc[0] / 255 * fInt);
          fg = Math.min(255, fg + tc[1] / 255 * fInt);
          fb = Math.min(255, fb + tc[2] / 255 * fInt);
        }

        const fidx = (row * W + col) * 4;
        buf[fidx] = fr | 0; buf[fidx + 1] = fg | 0; buf[fidx + 2] = fb | 0; buf[fidx + 3] = 255;
      }

      for (let row = Math.min(yTop - 1, H / 2 | 0); row >= 0; row--) {
        // 천장
        const rowDist = H / (H - 2.0 * row);
        const ceilX = posX + rowDist * cosR;
        const ceilY = posY + rowDist * sinR;
        const ctx2 = ((ceilX * TS) & (TS - 1));
        const cty = ((ceilY * TS) & (TS - 1));
        const cIdx = (cty * TS + ctx2) * 3;
        const cShade = Math.max(0.03, 1 - rowDist / (MAX_DEPTH * 0.6)) * tf * 0.6;
        let cr = ceilTex[cIdx] * cShade;
        let cg = ceilTex[cIdx + 1] * cShade;
        let cb = ceilTex[cIdx + 2] * cShade;

        // 숲: 빛줄기
        if (theme.wallPattern === 'bark') {
          const lx = (col / W * 5 + Math.sin(now * 0.0003 + col * 0.01) * 0.5) % 1;
          if (lx > 0.42 && lx < 0.58) {
            const lInt = (0.58 - Math.abs(lx - 0.5)) * 15 * tf * (1 - row / (H * 0.5));
            cr = Math.min(255, cr + 100 * lInt / 255 * 30);
            cg = Math.min(255, cg + 200 * lInt / 255 * 30);
            cb = Math.min(255, cb + 80 * lInt / 255 * 30);
          }
        }

        const cidx = (row * W + col) * 4;
        buf[cidx] = cr | 0; buf[cidx + 1] = cg | 0; buf[cidx + 2] = cb | 0; buf[cidx + 3] = 255;
      }
    }

    // 비네팅 (픽셀 버퍼에 직접)
    for (let row = 0; row < H; row++) {
      for (let col = 0; col < W; col++) {
        const vdx = (col - W / 2) / (W * 0.5);
        const vdy = (row - H / 2) / (H * 0.5);
        const vDist = Math.sqrt(vdx * vdx + vdy * vdy);
        if (vDist > 0.5) {
          const dark = Math.min(1, (vDist - 0.5) * 1.2);
          const idx = (row * W + col) * 4;
          buf[idx] = buf[idx] * (1 - dark * 0.55) | 0;
          buf[idx + 1] = buf[idx + 1] * (1 - dark * 0.55) | 0;
          buf[idx + 2] = buf[idx + 2] * (1 - dark * 0.55) | 0;
        }
      }
    }

    // 안개 오버레이 (픽셀 버퍼에)
    if (theme.fogDensity > 0) {
      const fogA = theme.fogDensity * 0.06 * tf;
      const fr = theme.fogColor[0], fgg = theme.fogColor[1], fbb = theme.fogColor[2];
      for (let i = 0; i < W * H * 4; i += 4) {
        buf[i] = buf[i] * (1 - fogA) + fr * fogA | 0;
        buf[i + 1] = buf[i + 1] * (1 - fogA) + fgg * fogA | 0;
        buf[i + 2] = buf[i + 2] * (1 - fogA) + fbb * fogA | 0;
      }
    }

    // ===== 바닥 반사 (젖은 바닥 느낌 — 벽 하단을 바닥에 희미하게 반사) =====
    const reflectStrength = theme.floorPattern === 'wet' || theme.floorPattern === 'lava' ? 0.08 : 0.03;
    const halfH = H >> 1;
    for (let col = 0; col < W; col += 2) { // 2px씩 건너뛰어 성능 보존
      for (let row = halfH + 20; row < Math.min(halfH + 80, H); row++) {
        const mirrorRow = H - row; // 반사할 원본 위치
        if (mirrorRow < 0 || mirrorRow >= H) continue;
        const srcIdx = (mirrorRow * W + col) * 4;
        const dstIdx = (row * W + col) * 4;
        const fade = 1 - (row - halfH - 20) / 60;
        const rStr = reflectStrength * fade * tf;
        buf[dstIdx] = Math.min(255, buf[dstIdx] + buf[srcIdx] * rStr) | 0;
        buf[dstIdx+1] = Math.min(255, buf[dstIdx+1] + buf[srcIdx+1] * rStr) | 0;
        buf[dstIdx+2] = Math.min(255, buf[dstIdx+2] + buf[srcIdx+2] * rStr) | 0;
        // 옆 픽셀도 같이 (2px 단위)
        if (col + 1 < W) {
          const d2 = dstIdx + 4;
          buf[d2] = Math.min(255, buf[d2] + buf[srcIdx] * rStr) | 0;
          buf[d2+1] = Math.min(255, buf[d2+1] + buf[srcIdx+1] * rStr) | 0;
          buf[d2+2] = Math.min(255, buf[d2+2] + buf[srcIdx+2] * rStr) | 0;
        }
      }
    }

    ctx.putImageData(imgData, 0, 0);

    // ===== 스프라이트 (Canvas API로 그리기) =====
    const sprites = [];
    // 몬스터
    p.monsters.filter(m => !m.defeated).forEach(m => {
      sprites.push({ x: m.x + 0.5, y: m.y + 0.5, type: 'monster', img: m.monsterId ? getSprite(`/monsters_nobg/${m.monsterId}_full.png`) : null, id: m.id, name: m.monsterName });
    });
    // 보물/출구
    p.treasures.filter(t => !t.collected).forEach(t => {
      sprites.push({ x: t.x + 0.5, y: t.y + 0.5, type: 'treasure', img: getSprite('/ui/dungeon/dc_treasure_nobg.png') });
    });
    sprites.push({ x: p.exitPos.x + 0.5, y: p.exitPos.y + 0.5, type: 'exit', img: getSprite('/ui/dungeon/dc_exit_nobg.png') });
    // 아군 파티 스프라이트 (비활성화)

    sprites.forEach(s => { s.dist = Math.sqrt((s.x - posX) ** 2 + (s.y - posY) ** 2); });
    sprites.sort((a, b) => b.dist - a.dist);

    sprites.forEach(s => {
      let nAngle = Math.atan2(s.y - posY, s.x - posX) - angle;
      while (nAngle > Math.PI) nAngle -= 2 * Math.PI;
      while (nAngle < -Math.PI) nAngle += 2 * Math.PI;
      if (Math.abs(nAngle) > HALF_FOV + 0.3) return;

      const screenX = W / 2 + (nAngle / HALF_FOV) * (W / 2);
      const corrD = Math.max(0.3, s.dist * Math.cos(nAngle));
      const baseH = Math.min(H * 1.5, H / corrD);
      const sprScale = s.type === 'treasure' ? 0.45 : s.type === 'exit' ? 0.7 : s.type === 'ally' ? 0.32 : 1;
      const sprH = baseH * sprScale;
      const sprW = sprH * (s.type === 'monster' ? 0.8 : s.type === 'ally' ? 0.5 : 0.7);
      const bobY = s.bobOffset || 0;
      // ally: 바닥에 붙도록 위치 조정 (baseH 기준으로 하단 정렬)
      const sprTop = s.type === 'ally'
        ? (H + baseH) / 2 - sprH + bobY * H * 0.15
        : (H - sprH) / 2 + (s.type === 'treasure' ? baseH * 0.28 : 0);
      const sprShade = Math.max(0.15, 1 - corrD / MAX_DEPTH) * tf;

      const stripIdx = Math.floor(screenX);
      // 아군은 z-buffer 체크 스킵 (항상 플레이어 앞에 있으므로)
      if (s.type !== 'ally' && stripIdx >= 0 && stripIdx < W && zBuffer[stripIdx] < corrD * 0.9) return;

      // 그림자
      if (corrD < 8) {
        ctx.save();
        ctx.globalAlpha = sprShade * 0.3;
        ctx.fillStyle = '#000';
        ctx.beginPath();
        ctx.ellipse(screenX, (H + sprH) / 2 - 2, sprW * 0.4, sprH * 0.05, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      }

      if (s.img && s.img.complete && s.img.naturalWidth > 0) {
        ctx.save();
        // 아군은 약간 투명 + 걷는 좌우 기울기
        const allyAlpha = s.type === 'ally' ? 0.75 : 1;
        ctx.globalAlpha = sprShade * allyAlpha;
        if (s.type === 'ally') {
          const sway = Math.sin(now * 0.003 + (s.id?.charCodeAt?.(0) || 0)) * 0.04;
          ctx.translate(screenX, sprTop + sprH / 2);
          ctx.rotate(sway);
          ctx.drawImage(s.img, -sprW / 2, -sprH / 2, sprW, sprH);
        } else {
          ctx.drawImage(s.img, screenX - sprW / 2, sprTop, sprW, sprH);
        }
        ctx.restore();
      } else {
        ctx.globalAlpha = sprShade * 0.6;
        ctx.fillStyle = { monster: '#e94560', treasure: '#ffa502', exit: '#2ed573', ally: '#a78bfa' }[s.type] || '#fff';
        ctx.beginPath();
        ctx.ellipse(screenX, sprTop + sprH * 0.35, sprW * 0.3, sprH * 0.3, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.globalAlpha = 1;
        ctx.font = `${Math.max(14, sprH * 0.35) | 0}px serif`;
        ctx.textAlign = 'center';
        ctx.fillText({ monster: '👹', treasure: '📦', exit: '🚪', ally: '🧙' }[s.type], screenX, sprTop + sprH * 0.45);
      }

      if (s.type === 'monster' && p.monsterSpeech?.mobId === s.id && corrD < 4) {
        ctx.save();
        ctx.font = 'bold 12px sans-serif';
        const txt = p.monsterSpeech.text;
        const tw = ctx.measureText(txt).width + 14;
        ctx.fillStyle = 'rgba(0,0,0,0.8)';
        ctx.fillRect(screenX - tw / 2, sprTop - 26, tw, 22);
        ctx.fillStyle = '#fff';
        ctx.textAlign = 'center';
        ctx.fillText(txt, screenX, sprTop - 10);
        ctx.restore();
      }
    });

    // ===== 파티클 (Canvas API) =====
    const parts = particlesRef.current;
    if (parts.length < 40) {
      const pt = theme.particleType || 'dust';
      if (pt === 'firefly') parts.push({ x: Math.random()*W, y: H*0.2+Math.random()*H*0.6, vx: (Math.random()-0.5)*0.5, vy: (Math.random()-0.5)*0.3, life: 200+Math.random()*300, maxLife: 500, size: 2.5+Math.random()*2, type: 'firefly' });
      else if (pt === 'ember') parts.push({ x: Math.random()*W, y: H, vx: (Math.random()-0.5)*0.8, vy: -0.5-Math.random()*1.5, life: 100+Math.random()*150, maxLife: 250, size: 2+Math.random()*2, type: 'ember' });
      else if (pt === 'bubble') parts.push({ x: Math.random()*W, y: H, vx: (Math.random()-0.5)*0.3, vy: -0.3-Math.random()*0.8, life: 150+Math.random()*200, maxLife: 350, size: 2.5+Math.random()*3, type: 'bubble' });
      else if (pt === 'spore') parts.push({ x: Math.random()*W, y: H*0.3+Math.random()*H*0.5, vx: (Math.random()-0.5)*0.4, vy: -0.1+Math.random()*0.2, life: 200+Math.random()*250, maxLife: 450, size: 2+Math.random()*2, type: 'spore' });
      else if (pt === 'drip' && Math.random()<0.15) parts.push({ x: Math.random()*W, y: 0, vx: 0, vy: 1+Math.random()*2, life: 80+Math.random()*60, maxLife: 140, size: 1.5, type: 'drip' });
      else if (pt !== 'drip') parts.push({ x: Math.random()*W, y: Math.random()*H, vx: (Math.random()-0.5)*0.3, vy: (Math.random()-0.5)*0.2, life: 100+Math.random()*200, maxLife: 300, size: 1.5+Math.random(), type: 'dust' });
    }
    ctx.save();
    for (let pi = parts.length - 1; pi >= 0; pi--) {
      const pp = parts[pi]; pp.x += pp.vx; pp.y += pp.vy; pp.life--;
      if (pp.life <= 0 || pp.x < -10 || pp.x > W+10 || pp.y < -10 || pp.y > H+10) { parts.splice(pi, 1); continue; }
      const al = Math.min(1, pp.life / (pp.maxLife * 0.3)) * 0.7;
      if (pp.type === 'firefly') {
        const pulse = 0.5 + Math.sin(now*0.008+pi*3)*0.5;
        pp.vx += (Math.random()-0.5)*0.1; pp.vy += (Math.random()-0.5)*0.08; pp.vx *= 0.98; pp.vy *= 0.98;
        const gl = ctx.createRadialGradient(pp.x, pp.y, 0, pp.x, pp.y, pp.size*6);
        gl.addColorStop(0, `rgba(150,255,80,${al*pulse*0.35})`); gl.addColorStop(1, 'rgba(150,255,80,0)');
        ctx.fillStyle = gl; ctx.fillRect(pp.x-pp.size*6, pp.y-pp.size*6, pp.size*12, pp.size*12);
        ctx.fillStyle = `rgba(200,255,150,${al*pulse})`; ctx.beginPath(); ctx.arc(pp.x, pp.y, pp.size*0.8, 0, Math.PI*2); ctx.fill();
      } else if (pp.type === 'ember') {
        ctx.fillStyle = `rgba(255,${120+Math.random()*80|0},30,${al})`; ctx.beginPath(); ctx.arc(pp.x, pp.y, pp.size, 0, Math.PI*2); ctx.fill();
      } else if (pp.type === 'bubble') {
        ctx.strokeStyle = `rgba(120,200,255,${al*0.5})`; ctx.lineWidth = 0.8; ctx.beginPath(); ctx.arc(pp.x, pp.y, pp.size, 0, Math.PI*2); ctx.stroke();
      } else if (pp.type === 'spore') {
        ctx.fillStyle = `rgba(180,220,80,${al*0.5})`; ctx.beginPath(); ctx.arc(pp.x, pp.y, pp.size, 0, Math.PI*2); ctx.fill();
      } else if (pp.type === 'drip') {
        ctx.fillStyle = `rgba(100,180,220,${al*0.6})`; ctx.fillRect(pp.x, pp.y, 1.5, pp.size*3);
      } else {
        ctx.fillStyle = `rgba(200,180,160,${al*0.3})`; ctx.beginPath(); ctx.arc(pp.x, pp.y, pp.size, 0, Math.PI*2); ctx.fill();
      }
    }
    ctx.restore();

    // ===== 횃불 화면 효과 (화면 가장자리 따뜻한 빛) =====
    ctx.save();
    const torchGrd = ctx.createRadialGradient(W/2, H*0.55, H*0.15, W/2, H*0.55, H*0.85);
    torchGrd.addColorStop(0, 'rgba(0,0,0,0)');
    torchGrd.addColorStop(0.6, 'rgba(0,0,0,0)');
    torchGrd.addColorStop(1, `rgba(${tc[0]*0.3|0},${tc[1]*0.15|0},0,${0.15*tf})`);
    ctx.fillStyle = torchGrd;
    ctx.fillRect(0, 0, W, H);
    ctx.restore();

    // ===== 화면 하단 무기/손 오버레이 (1인칭 느낌) =====
    ctx.save();
    // 하단 그라디언트 (어둡게)
    const bottomGrd = ctx.createLinearGradient(0, H*0.85, 0, H);
    bottomGrd.addColorStop(0, 'rgba(0,0,0,0)');
    bottomGrd.addColorStop(1, 'rgba(0,0,0,0.3)');
    ctx.fillStyle = bottomGrd;
    ctx.fillRect(0, H*0.85, W, H*0.15);
    ctx.restore();

    // ===== 상단 천장 그라디언트 (분위기) =====
    ctx.save();
    const topGrd = ctx.createLinearGradient(0, 0, 0, H*0.12);
    topGrd.addColorStop(0, 'rgba(0,0,0,0.25)');
    topGrd.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = topGrd;
    ctx.fillRect(0, 0, W, H*0.12);
    ctx.restore();

    // ===== 벽 가장자리 앰비언트 오클루전 (좌우 어둡게) =====
    ctx.save();
    const aoLeft = ctx.createLinearGradient(0, 0, W*0.08, 0);
    aoLeft.addColorStop(0, 'rgba(0,0,0,0.2)');
    aoLeft.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = aoLeft;
    ctx.fillRect(0, 0, W*0.08, H);
    const aoRight = ctx.createLinearGradient(W, 0, W*0.92, 0);
    aoRight.addColorStop(0, 'rgba(0,0,0,0.2)');
    aoRight.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = aoRight;
    ctx.fillRect(W*0.92, 0, W*0.08, H);
    ctx.restore();

    // ===== 수평선 안개 (원거리 페이드) =====
    ctx.save();
    const horizonY = H / 2;
    const hFog = ctx.createLinearGradient(0, horizonY - H*0.08, 0, horizonY + H*0.08);
    hFog.addColorStop(0, 'rgba(0,0,0,0)');
    hFog.addColorStop(0.4, `rgba(${theme.fogColor[0]},${theme.fogColor[1]},${theme.fogColor[2]},${0.06*tf})`);
    hFog.addColorStop(0.6, `rgba(${theme.fogColor[0]},${theme.fogColor[1]},${theme.fogColor[2]},${0.06*tf})`);
    hFog.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = hFog;
    ctx.fillRect(0, horizonY - H*0.08, W, H*0.16);
    ctx.restore();

    // ===== 색수차 효과 (화면 가장자리 RGB 분리) =====
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    ctx.globalAlpha = 0.015;
    // 좌측 빨강 쉬프트
    ctx.drawImage(canvas, -2, 0);
    ctx.globalAlpha = 0.01;
    // 우측 파랑 쉬프트
    ctx.drawImage(canvas, 2, 0);
    ctx.globalCompositeOperation = 'source-over';
    ctx.globalAlpha = 1;
    ctx.restore();

    // ===== 횃불 벽 광원 (가까운 벽에 따뜻한 광원 원) =====
    ctx.save();
    const torchWallDist = 3;
    for (let tw = 0; tw < 3; tw++) {
      const twAngle = angle + (tw - 1) * 0.4;
      const twX = posX + Math.cos(twAngle) * torchWallDist;
      const twY = posY + Math.sin(twAngle) * torchWallDist;
      const twGx = Math.floor(twX), twGy = Math.floor(twY);
      if (twGx >= 0 && twGx < mW && twGy >= 0 && twGy < mH && grid[twGy][twGx] === 1) {
        // 벽에 닿았으면 광원 효과
        const twScreenAngle = Math.atan2(twY - posY, twX - posX) - angle;
        if (Math.abs(twScreenAngle) < HALF_FOV) {
          const twSx = W / 2 + (twScreenAngle / HALF_FOV) * (W / 2);
          const twDist = Math.sqrt((twX-posX)**2 + (twY-posY)**2);
          const twRadius = H / twDist * 0.3;
          const twGlow = ctx.createRadialGradient(twSx, H/2, 0, twSx, H/2, twRadius);
          twGlow.addColorStop(0, `rgba(${tc[0]},${tc[1]},${tc[2]},${0.04*tf})`);
          twGlow.addColorStop(1, 'rgba(0,0,0,0)');
          ctx.fillStyle = twGlow;
          ctx.fillRect(twSx - twRadius, H/2 - twRadius, twRadius*2, twRadius*2);
        }
      }
    }
    ctx.restore();

    // ===== 나침반 UI (업그레이드) =====
    ctx.save();
    const compassSize = 30;
    const cx2 = W/2, cy2 = 22;
    // 배경
    ctx.beginPath(); ctx.arc(cx2, cy2, compassSize/2+4, 0, Math.PI*2);
    ctx.fillStyle = 'rgba(0,0,0,0.55)'; ctx.fill();
    ctx.strokeStyle = `rgba(${tc[0]},${tc[1]},${tc[2]},0.3)`; ctx.lineWidth = 1.5; ctx.stroke();
    // 방향 문자
    ctx.font = 'bold 15px monospace'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    const dirs4 = ['N','E','S','W'];
    const dirFull = ['북','동','남','서'];
    ctx.fillStyle = `rgb(${Math.min(255,tc[0]+100)},${Math.min(255,tc[1]+100)},${Math.min(255,tc[2]+100)})`;
    ctx.fillText(dirFull[p.facing], cx2, cy2+1);
    // 작은 방향 표시
    ctx.font = '8px monospace'; ctx.globalAlpha = 0.4;
    ctx.fillText(dirs4[(p.facing+3)%4], cx2-16, cy2+1);
    ctx.fillText(dirs4[(p.facing+1)%4], cx2+16, cy2+1);
    ctx.globalAlpha = 1;
    ctx.restore();

    // ===== 방향 화살표 (업그레이드) =====
    ctx.save();
    const chk = (x2,y2) => x2>=0 && x2<mW && y2>=0 && y2<mH && grid[y2][x2]===0;
    const gx = Math.floor(posX), gy = Math.floor(posY);
    const arrowAlpha = 0.3 + Math.sin(now * 0.003) * 0.1;
    ctx.globalAlpha = arrowAlpha;
    ctx.font = '22px sans-serif'; ctx.textAlign = 'center';
    ctx.fillStyle = `rgb(${Math.min(255,tc[0]+60)},${Math.min(255,tc[1]+60)},${Math.min(255,tc[2]+60)})`;
    if (chk(gx+DIR_DX[p.facing], gy+DIR_DY[p.facing])) {
      ctx.fillText('▲', W/2, H-14);
    }
    if (chk(gx+DIR_DX[(p.facing+3)%4], gy+DIR_DY[(p.facing+3)%4])) ctx.fillText('◀', 18, H/2);
    if (chk(gx+DIR_DX[(p.facing+1)%4], gy+DIR_DY[(p.facing+1)%4])) ctx.fillText('▶', W-18, H/2);
    ctx.globalAlpha = 1;
    ctx.restore();

    // ===== 화면 노이즈/그레인 (분위기) =====
    ctx.save();
    ctx.globalAlpha = 0.015;
    ctx.globalCompositeOperation = 'overlay';
    for (let gi = 0; gi < 60; gi++) {
      const gx2 = Math.random() * W;
      const gy2 = Math.random() * H;
      const gs = 1 + Math.random() * 3;
      ctx.fillStyle = Math.random() > 0.5 ? '#fff' : '#000';
      ctx.fillRect(gx2, gy2, gs, gs);
    }
    ctx.globalCompositeOperation = 'source-over';
    ctx.globalAlpha = 1;
    ctx.restore();
  }, [maze]); // eslint-disable-line

  useEffect(() => {
    if (!maze) return;
    let running = true;
    const loop = () => {
      if (!running) return;
      renderFrame();
      animRef.current = requestAnimationFrame(loop);
    };
    animRef.current = requestAnimationFrame(loop);
    return () => { running = false; if (animRef.current) cancelAnimationFrame(animRef.current); };
  }, [maze, renderFrame]);

  return (
    <div className="dc-fpv" style={{ position: 'relative', width: '100%', height: '100%', background: '#0a0a15' }}>
      <canvas ref={canvasRef} width={1280} height={800}
        style={{ width: '100%', height: '100%', display: 'block', imageRendering: 'auto' }} />
    </div>
  );
}

// ========== 미니맵 ==========
function MiniMap({ maze, px, py, facing, explored, monsters, treasures, exitPos }) {
  const viewRadius = 5;
  const cellSize = 12;
  const viewSize = viewRadius * 2 + 1;

  const cells = [];
  for (let dy = -viewRadius; dy <= viewRadius; dy++) {
    for (let dx = -viewRadius; dx <= viewRadius; dx++) {
      const mx = px + dx;
      const my = py + dy;
      const key = `${mx},${my}`;
      const isExplored = explored.has(key);
      const inBounds = mx >= 0 && mx < maze.width && my >= 0 && my < maze.height;
      const isWall = !inBounds || maze.grid[my][mx] === 1;
      const isPlayer = dx === 0 && dy === 0;
      const monster = monsters.find(m => !m.defeated && m.x === mx && m.y === my);
      const treasure = treasures.find(t => !t.collected && t.x === mx && t.y === my);
      const isExit = exitPos.x === mx && exitPos.y === my;

      let cellClass = 'dc-mm-cell';
      if (!isExplored) cellClass += ' fog';
      else if (isWall) cellClass += ' wall';
      else cellClass += ' floor';

      cells.push(
        <div key={`${dx},${dy}`} className={cellClass} style={{
          left: (dx + viewRadius) * cellSize,
          top: (dy + viewRadius) * cellSize,
          width: cellSize, height: cellSize,
        }}>
          {isPlayer && <div className={`dc-mm-player facing-${facing}`} />}
          {isExplored && monster && <div className={`dc-mm-monster${monster.hidden ? ' roaming' : ''}`} />}
          {isExplored && treasure && <div className="dc-mm-treasure" />}
          {isExplored && isExit && <div className="dc-mm-exit" />}
        </div>
      );
    }
  }

  return (
    <div className="dc-minimap" style={{ width: viewSize * cellSize, height: viewSize * cellSize }}>
      {cells}
      <div className="dc-mm-border" />
    </div>
  );
}

// ========== 메인 던전 크롤러 ==========
// ========== BFS 길찾기 ==========
function bfsPath(maze, from, to) {
  const { grid, width, height } = maze;
  const key = (x, y) => `${x},${y}`;
  const visited = new Set();
  const queue = [{ x: from.x, y: from.y, path: [] }];
  visited.add(key(from.x, from.y));
  while (queue.length > 0) {
    const cur = queue.shift();
    if (cur.x === to.x && cur.y === to.y) return cur.path;
    for (const [dx, dy] of [[0,-1],[1,0],[0,1],[-1,0]]) {
      const nx = cur.x + dx, ny = cur.y + dy;
      if (nx >= 0 && nx < width && ny >= 0 && ny < height && grid[ny][nx] === 0 && !visited.has(key(nx, ny))) {
        visited.add(key(nx, ny));
        queue.push({ x: nx, y: ny, path: [...cur.path, { x: nx, y: ny }] });
      }
    }
  }
  return null; // 경로 없음
}

// 현재 위치에서 목표까지 이동에 필요한 facing 방향 변환 계산
function getMovesToTarget(cx, cy, currentFacing, tx, ty) {
  const dx = tx - cx, dy = ty - cy;
  // 목표 방향
  let targetDir;
  if (dy < 0) targetDir = DIR.N;
  else if (dx > 0) targetDir = DIR.E;
  else if (dy > 0) targetDir = DIR.S;
  else targetDir = DIR.W;

  const moves = [];
  // 현재 방향 → 목표 방향까지 회전
  let f = currentFacing;
  const diff = (targetDir - f + 4) % 4;
  if (diff === 1) { moves.push('right'); }
  else if (diff === 2) { moves.push('right'); moves.push('right'); }
  else if (diff === 3) { moves.push('left'); }
  moves.push('forward');
  return moves;
}

export default function DungeonCrawler({
  dungeonKey,
  stage,
  dbMonsters,
  character,
  charState,
  activeSummons,
  activeMercenaries,
  savedState,       // DB에서 로드한 크롤러 상태 (복귀 시)
  onSaveState,      // (state) => void — 상태 변경 시 DB 저장 콜백
  onEncounter,  // (encounterData) => void  — 전투 시작
  onTreasure,   // (treasureData) => void — 보물 획득
  onClear,      // () => void — 던전 클리어 (출구 도달)
  onRetreat,    // () => void — 귀환
  autoPath: autoPathProp, // 자동길찾기 모드
}) {
  const [maze, setMaze] = useState(null);
  const [pos, setPos] = useState({ x: 1, y: 1 });
  const [facing, setFacing] = useState(DIR.S);
  const [explored, setExplored] = useState(new Set());
  const [monsters, setMonsters] = useState([]);
  const [treasures, setTreasures] = useState([]);
  const [log, setLog] = useState([]);
  const [stepCount, setStepCount] = useState(0);
  const [encounterAnim, setEncounterAnim] = useState(false);
  const [moveAnim, setMoveAnim] = useState(null); // 'forward' | 'back' | 'left' | 'right' | 'blocked'
  const [showLog, setShowLog] = useState(false);
  const [inspectAlly, setInspectAlly] = useState(null);
  const [equipData, setEquipData] = useState(null); // { equipped, inventory, potions }
  const [equipLoading, setEquipLoading] = useState(false);
  const [invTab, setInvTab] = useState('equip'); // 'equip' | 'potion'
  const [selectedInvItem, setSelectedInvItem] = useState(null);
  const [unreadLog, setUnreadLog] = useState(0);
  const [treasurePopup, setTreasurePopup] = useState(null); // { gold }
  const [speechBubble, setSpeechBubble] = useState(null); // { allyId, text }
  const [ghostEvent, setGhostEvent] = useState(null); // { type, text }
  const [ambushWarning, setAmbushWarning] = useState(false);
  const [retreatConfirm, setRetreatConfirm] = useState(false);
  const [exitPopup, setExitPopup] = useState(null); // 'clear' | 'blocked'
  const [activeDir, setActiveDir] = useState(null); // 'forward'|'back'|'left'|'right'
  const [monsterSpeech, setMonsterSpeech] = useState(null); // { mobId, text }
  const [autoPath, setAutoPath] = useState(!!autoPathProp);
  const autoPathRef = useRef(!!autoPathProp);
  const autoMoveQueue = useRef([]); // 자동이동 명령 큐
  const autoTimer = useRef(null);
  const [autoTick, setAutoTick] = useState(0); // 경로 재계산 트리거
  const logRef = useRef(null);
  const keyLock = useRef(false);
  const speechTimer = useRef(null);
  const monsterSpeechTimer = useRef(null);
  const initDone = useRef(false);
  // 진형 필터링된 소환수/용병
  const [filteredSummons, setFilteredSummons] = useState(activeSummons || []);
  const [filteredMercs, setFilteredMercs] = useState(activeMercenaries || []);
  const [playerInFormation, setPlayerInFormation] = useState(true);
  const [cosmeticMap, setCosmeticMap] = useState({});

  const showMonsterSpeech = useCallback((mobId, text, duration = 5000) => {
    if (monsterSpeechTimer.current) clearTimeout(monsterSpeechTimer.current);
    setMonsterSpeech({ mobId, text });
    monsterSpeechTimer.current = setTimeout(() => { setMonsterSpeech(null); monsterSpeechTimer.current = null; }, duration);
  }, []);

  const showSpeech = useCallback((allyId, text, duration = 9000) => {
    if (speechTimer.current) clearTimeout(speechTimer.current);
    setSpeechBubble({ allyId, text });
    speechTimer.current = setTimeout(() => { setSpeechBubble(null); speechTimer.current = null; }, duration);
  }, []);

  const addLog = useCallback((text, type = 'system') => {
    setLog(prev => [...prev.slice(-50), { text, type, id: Date.now() + Math.random() }]);
    setUnreadLog(prev => prev + 1);
  }, []);

  // 진형 기반 유닛 필터링 (던전 진입 시 1회)
  useEffect(() => {
    (async () => {
      try {
        const [summonRes, mercRes, fRes, cosRes] = await Promise.all([
          api.get('/summon/my'), api.get('/mercenary/my'), api.get('/formation/list'),
          api.get('/shop/cosmetics/equipped').catch(() => ({ data: { cosmetics: {} } })),
        ]);
        setCosmeticMap(cosRes.data.cosmetics || {});
        let fSummons = summonRes.data.summons || [];
        let fMercs = mercRes.data.mercenaries || [];
        let pInF = true;
        const mainF = fRes.data.formations?.find(f => f.slotIndex === 0);
        if (mainF?.gridData) {
          const g = mainF.gridData;
          const has = g.some(row => row.some(c => c && c.unitId));
          if (has) {
            const ids = new Set();
            g.forEach(row => row.forEach(c => { if (c?.unitId) ids.add(c.unitId); }));
            pInF = ids.has('player');
            fSummons = fSummons.filter(s => ids.has(`summon_${s.id}`));
            fMercs = fMercs.filter(m => ids.has(`merc_${m.id}`));
          }
        }
        setFilteredSummons(fSummons);
        setFilteredMercs(fMercs);
        setPlayerInFormation(pInF);
      } catch {}
    })();
  }, []); // eslint-disable-line

  // 미로 생성 또는 저장된 상태 복원
  useEffect(() => {
    if (initDone.current) return;
    initDone.current = true;
    if (savedState && savedState.maze) {
      // DB에서 복원
      setMaze(savedState.maze);
      setPos(savedState.pos || savedState.maze.playerStart);
      setFacing(savedState.facing ?? DIR.S);
      // 복원된 몬스터에 monsterId 없으면 배정
      const restoredMonsters = (savedState.monsters || savedState.maze.monsters || []).map(m => {
        if (!m.monsterId && dbMonsters?.length > 0) {
          const t = dbMonsters[Math.floor(Math.random() * dbMonsters.length)];
          return { ...m, monsterId: t.id, monsterName: t.name };
        }
        return m;
      });
      setMonsters(restoredMonsters);
      setTreasures(savedState.treasures || savedState.maze.treasures);
      setStepCount(savedState.stepCount || 0);
      const restoredExplored = new Set(savedState.explored || []);
      setExplored(restoredExplored);
      addLog('던전 탐험을 이어서 진행합니다.', 'heal');
    } else {
      // 새로 생성
      const mazeW = Math.min(6 + (stage?.stageNumber || 1), 12);
      const mazeH = Math.min(6 + (stage?.stageNumber || 1), 12);
      const monsterCount = stage?.monsterCount || 5;
      const m = generateMaze(mazeW, mazeH, monsterCount, stage, dbMonsters);
      setMaze(m);
      setPos(m.playerStart);
      setFacing(DIR.S);
      setMonsters(m.monsters);
      setTreasures(m.treasures);
      setStepCount(0);

      const initExplored = new Set();
      revealAround(m.playerStart.x, m.playerStart.y, m, initExplored);
      setExplored(initExplored);

      addLog(`${stage?.name || dungeonKey} 에 진입했습니다.`);
      addLog('방향키 또는 버튼으로 이동하세요.');
    }
  }, [dungeonKey, stage]); // eslint-disable-line

  // 주변 시야 공개
  function revealAround(x, y, m, set) {
    const r = 2;
    for (let dy = -r; dy <= r; dy++) {
      for (let dx = -r; dx <= r; dx++) {
        const nx = x + dx, ny = y + dy;
        if (nx >= 0 && nx < m.width && ny >= 0 && ny < m.height) {
          set.add(`${nx},${ny}`);
        }
      }
    }
  }

  // 이동
  const move = useCallback((direction) => {
    if (!maze || keyLock.current || encounterAnim) return;

    let nx = pos.x, ny = pos.y;
    if (direction === 'forward') {
      nx += DIR_DX[facing];
      ny += DIR_DY[facing];
    } else if (direction === 'back') {
      nx -= DIR_DX[facing];
      ny -= DIR_DY[facing];
    } else if (direction === 'left') {
      setMoveAnim('turn-left');
      setTimeout(() => setMoveAnim(null), 300);
      setFacing((facing + 3) % 4);
      return;
    } else if (direction === 'right') {
      setMoveAnim('turn-right');
      setTimeout(() => setMoveAnim(null), 300);
      setFacing((facing + 1) % 4);
      return;
    }

    if (nx < 0 || nx >= maze.width || ny < 0 || ny >= maze.height || maze.grid[ny][nx] === 1) {
      addLog('벽에 막혀 이동할 수 없습니다.', 'damage');
      setMoveAnim('blocked');
      setTimeout(() => setMoveAnim(null), 300);
      return;
    }

    keyLock.current = true;
    setMoveAnim(direction);
    setTimeout(() => setMoveAnim(null), 350);
    setPos({ x: nx, y: ny });
    setStepCount(prev => prev + 1);

    setExplored(prev => {
      const next = new Set(prev);
      revealAround(nx, ny, maze, next);
      return next;
    });

    // 몬스터 조우 체크 (숨겨진 적 포함)
    const mob = monsters.find(m => !m.defeated && m.x === nx && m.y === ny);
    if (mob) {
      setEncounterAnim(true);
      addLog(mob.hidden ? '💀 숨어있던 적이 습격해왔습니다!' : '⚔️ 적과 조우했습니다!', 'damage');
      // 전투 리액션 말풍선
      {
        const rParty = [];
        if (character && playerInFormation) rParty.push({ id: 'player', name: character.name });
        (filteredSummons || []).forEach(s => rParty.push({ id: `summon_${s.id}`, name: s.name }));
        (filteredMercs || []).forEach(m => rParty.push({ id: `merc_${m.id}`, name: m.name }));
        if (rParty.length > 0) {
          const rSpeaker = rParty[Math.floor(Math.random() * rParty.length)];
          const rText = ENCOUNTER_REACT[Math.floor(Math.random() * ENCOUNTER_REACT.length)];
          showSpeech(rSpeaker.id, rText);
          addLog(`💬 ${rSpeaker.name}: "${rText}"`, 'system');
        }
      }
      setTimeout(() => {
        // 몬스터 데이터로 전투 시작
        const monsterPool = dbMonsters || [];
        const stageMonsters = [];
        const count = Math.min(3 + Math.floor(Math.random() * 2), monsterPool.length);
        for (let i = 0; i < count; i++) {
          stageMonsters.push(monsterPool[Math.floor(Math.random() * monsterPool.length)]);
        }
        if (onEncounter) onEncounter({
          mobId: mob.id,
          monsters: stageMonsters,
          isBoss: maze.isBoss && mob.id === monsters[monsters.length - 1]?.id,
        });
        setEncounterAnim(false);
        keyLock.current = false;
      }, 800);
      return;
    }

    // 보물 체크
    const tr = treasures.find(t => !t.collected && t.x === nx && t.y === ny);
    if (tr) {
      setTreasures(prev => prev.map(t => t.id === tr.id ? { ...t, collected: true } : t));
      const goldFound = 50 + Math.floor(Math.random() * 100) + (stage?.rewardGoldBonus || 0);
      addLog(`📦 보물 발견! ${goldFound}G 획득!`, 'heal');
      setTreasurePopup({ gold: goldFound });
      setTimeout(() => setTreasurePopup(null), 3500);
      if (onTreasure) onTreasure({ gold: goldFound });
    }

    // 출구 체크 (숨겨진 적은 필수 처치 대상 아님, 배회 몬스터는 필수)
    if (nx === maze.exitPos.x && ny === maze.exitPos.y) {
      const allDefeated = monsters.filter(m => !m.hidden).every(m => m.defeated);
      if (allDefeated) {
        addLog('🚪 출구를 발견했습니다!', 'heal');
        setExitPopup('clear');
      } else {
        addLog('🚪 출구를 발견했지만 아직 적이 남아있습니다.', 'system');
        setExitPopup('blocked');
      }
    }

    setTimeout(() => { keyLock.current = false; }, 150);
  }, [maze, pos, facing, monsters, treasures, encounterAnim, dbMonsters, stage, onEncounter, onTreasure, onClear, addLog]);

  // 전투 결과 처리 (외부에서 호출)
  const defeatMonster = useCallback((mobId) => {
    setMonsters(prev => prev.map(m => m.id === mobId ? { ...m, defeated: true } : m));
    addLog('적을 처치했습니다!', 'heal');
  }, [addLog]);

  // ========== 배회형 몬스터 AI ==========
  const posRef = useRef(pos);
  useEffect(() => { posRef.current = pos; }, [pos]);
  const monstersRef = useRef(monsters);
  useEffect(() => { monstersRef.current = monsters; }, [monsters]);

  useEffect(() => {
    if (!maze || encounterAnim) return;
    const grid = maze.grid;
    const mW = maze.width, mH = maze.height;

    const interval = setInterval(() => {
      if (keyLock.current || encounterAnim) return;
      const curPos = posRef.current;
      const curMonsters = monstersRef.current;
      const roamers = curMonsters.filter(m => m.roaming && !m.defeated);
      if (roamers.length === 0) return;

      let encountered = null;
      const updated = curMonsters.map(m => {
        if (!m.roaming || m.defeated || encountered) return m;

        // 이동 가능한 방향 탐색
        const dirs = [0, 1, 2, 3]; // N, E, S, W
        const passable = dirs.filter(d => {
          const nx = m.x + DIR_DX[d], ny = m.y + DIR_DY[d];
          return nx >= 0 && nx < mW && ny >= 0 && ny < mH && grid[ny][nx] === 0;
        });
        if (passable.length === 0) return m;

        // AI: 70% 직진 시도, 30% 방향 전환
        let dir = m.roamDir;
        if (!passable.includes(dir) || Math.random() < 0.3) {
          // 플레이어 쪽으로 가끔 (20%) 끌림
          const pdx = curPos.x - m.x, pdy = curPos.y - m.y;
          const dist = Math.abs(pdx) + Math.abs(pdy);
          if (dist < 8 && Math.random() < 0.35) {
            // 플레이어 방향
            if (Math.abs(pdx) > Math.abs(pdy)) dir = pdx > 0 ? 1 : 3;
            else dir = pdy > 0 ? 2 : 0;
            if (!passable.includes(dir)) dir = passable[Math.floor(Math.random() * passable.length)];
          } else {
            dir = passable[Math.floor(Math.random() * passable.length)];
          }
        }

        const nx = m.x + DIR_DX[dir], ny = m.y + DIR_DY[dir];

        // 다른 몬스터와 겹치지 않기
        const blocked = curMonsters.some(o => o.id !== m.id && !o.defeated && o.x === nx && o.y === ny);
        if (blocked) return { ...m, roamDir: passable[Math.floor(Math.random() * passable.length)] };

        // 플레이어와 만남 체크
        if (nx === curPos.x && ny === curPos.y) {
          encountered = { ...m, x: nx, y: ny, roamDir: dir };
          return encountered;
        }

        return { ...m, x: nx, y: ny, roamDir: dir };
      });

      setMonsters(updated);
      monstersRef.current = updated;

      // 배회 몬스터가 플레이어에게 도달
      if (encountered) {
        setEncounterAnim(true);
        addLog(`👻 ${encountered.monsterName || '???'}이(가) 다가왔다!`, 'damage');
        showMonsterSpeech(encountered.id, '발견했다! 도망칠 수 없다!', 3000);

        setTimeout(() => {
          const monsterPool = dbMonsters || [];
          const stageMonsters = [];
          const cnt = Math.min(3 + Math.floor(Math.random() * 2), monsterPool.length);
          for (let i = 0; i < cnt; i++) {
            stageMonsters.push(monsterPool[Math.floor(Math.random() * monsterPool.length)]);
          }
          if (onEncounter) onEncounter({
            mobId: encountered.id,
            monsters: stageMonsters,
            isBoss: false,
          });
          setEncounterAnim(false);
        }, 800);
      }
    }, 1800); // 1.8초마다 이동

    return () => clearInterval(interval);
  }, [maze, encounterAnim, dbMonsters, onEncounter, addLog, showMonsterSpeech]);

  // ========== 자동길찾기 ==========
  useEffect(() => { autoPathRef.current = autoPath; }, [autoPath]);

  const planAutoPath = useCallback(() => {
    if (!autoPathRef.current || !maze) return;
    // 몬스터 + 보물 모두 목표로 설정
    const alive = monsters.filter(m => !m.defeated && !m.hidden);
    const uncollected = treasures.filter(t => !t.collected);
    const targets = [
      ...alive.map(m => ({ x: m.x, y: m.y })),
      ...uncollected.map(t => ({ x: t.x, y: t.y })),
    ];

    let target = null;
    let bestDist = Infinity;

    for (const t of targets) {
      const path = bfsPath(maze, pos, t);
      if (path && path.length < bestDist) {
        bestDist = path.length;
        target = { x: t.x, y: t.y, path };
      }
    }

    // 몬스터+보물 다 처리했으면 출구로
    if (!target) {
      const exitPath = bfsPath(maze, pos, maze.exitPos);
      if (exitPath) {
        target = { x: maze.exitPos.x, y: maze.exitPos.y, path: exitPath };
      }
    }

    if (!target || target.path.length === 0) return;

    // 경로의 각 스텝을 이동 명령(회전+전진)으로 변환
    const allMoves = [];
    let curX = pos.x, curY = pos.y, curF = facing;
    for (const step of target.path) {
      const moves = getMovesToTarget(curX, curY, curF, step.x, step.y);
      for (const m of moves) {
        if (m === 'left') curF = (curF + 3) % 4;
        else if (m === 'right') curF = (curF + 1) % 4;
      }
      allMoves.push(...moves);
      curX = step.x;
      curY = step.y;
    }
    autoMoveQueue.current = allMoves;
    setAutoTick(t => t + 1); // effect 재트리거
  }, [maze, pos, facing, monsters, treasures]);

  // 자동이동 실행 (큐에서 하나씩 꺼내서 move)
  useEffect(() => {
    if (!autoPath || encounterAnim || exitPopup) return;
    if (autoMoveQueue.current.length === 0) {
      // 큐가 비었으면 경로 재계산
      const t = setTimeout(() => planAutoPath(), 400);
      return () => clearTimeout(t);
    }
    autoTimer.current = setTimeout(() => {
      if (!autoPathRef.current) return;
      if (keyLock.current || encounterAnim) return;
      const nextMove = autoMoveQueue.current.shift();
      if (nextMove) move(nextMove);
    }, 350);
    return () => { if (autoTimer.current) clearTimeout(autoTimer.current); };
  }, [autoPath, pos, facing, encounterAnim, exitPopup, planAutoPath, move, autoTick]);

  // 자동모드 시작 시 경로 계산
  useEffect(() => {
    if (autoPath && maze) {
      addLog('🧭 자동길찾기 시작!', 'heal');
      planAutoPath();
    }
  }, [autoPath]); // eslint-disable-line

  // 출구 팝업에서 자동 클리어
  useEffect(() => {
    if (autoPath && exitPopup === 'clear') {
      const t = setTimeout(() => {
        setExitPopup(null);
        const stats = { stepCount, monstersDefeated: monsters.filter(m => m.defeated).length, totalMonsters: monsters.filter(m => !m.hidden).length, treasuresFound: treasures.filter(t2 => t2.collected).length, totalTreasures: treasures.length };
        if (onClear) onClear(stats);
      }, 1500);
      return () => clearTimeout(t);
    }
  }, [autoPath, exitPopup, onClear]);

  // 장비 정보 로드
  const loadEquipment = useCallback(async (ally) => {
    setEquipLoading(true);
    try {
      const t = ally?.type || 'player';
      let res;
      if (t === 'summon') {
        const sid = ally.id.replace('summon_', '');
        res = await api.get(`/summon/${sid}/equipment`);
      } else if (t === 'mercenary') {
        const mid = ally.id.replace('merc_', '');
        res = await api.get(`/mercenary/${mid}/equipment`);
      } else {
        res = await api.get('/equipment/info');
      }
      setEquipData(res.data);
    } catch (e) { console.error('equip load err', e); }
    setEquipLoading(false);
  }, []);

  // 장비 장착
  const handleEquip = useCallback(async (itemId, slot) => {
    try {
      const t = inspectAlly?.type;
      if (t === 'summon') {
        const sid = inspectAlly.id.replace('summon_', '');
        await api.post(`/summon/${sid}/equip`, { itemId, slot });
      } else if (t === 'mercenary') {
        const mid = inspectAlly.id.replace('merc_', '');
        await api.post(`/mercenary/${mid}/equip`, { itemId, slot });
      } else {
        await api.post('/equipment/equip', { itemId, slot });
      }
      await loadEquipment(inspectAlly);
    } catch (e) { addLog(e.response?.data?.message || '장착 실패', 'damage'); }
  }, [inspectAlly, loadEquipment, addLog]);

  // 장비 해제
  const handleUnequip = useCallback(async (slot) => {
    try {
      const t = inspectAlly?.type;
      if (t === 'summon') {
        const sid = inspectAlly.id.replace('summon_', '');
        await api.post(`/summon/${sid}/unequip`, { slot });
      } else if (t === 'mercenary') {
        const mid = inspectAlly.id.replace('merc_', '');
        await api.post(`/mercenary/${mid}/unequip`, { slot });
      } else {
        await api.post('/equipment/unequip', { slot });
      }
      await loadEquipment(inspectAlly);
    } catch (e) { addLog(e.response?.data?.message || '해제 실패', 'damage'); }
  }, [inspectAlly, loadEquipment, addLog]);

  // 물약 사용
  const handleUsePotion = useCallback(async (invId) => {
    try {
      const res = await api.post('/equipment/use-potion', { invId });
      addLog(`💊 ${res.data.message}`, 'heal');
      await loadEquipment(inspectAlly);
    } catch (e) { addLog(e.response?.data?.message || '사용 실패', 'damage'); }
  }, [inspectAlly, loadEquipment, addLog]);

  // 아군 클릭 → 장비 정보 로드
  const openInspect = useCallback((ally) => {
    if (inspectAlly?.id === ally.id) {
      setInspectAlly(null);
      setEquipData(null);
      return;
    }
    setInspectAlly(ally);
    setSelectedInvItem(null);
    setInvTab('equip');
    loadEquipment(ally);
  }, [inspectAlly, loadEquipment]);

  // 키보드 조작
  useEffect(() => {
    const keyDirMap = { ArrowUp: 'forward', w: 'forward', W: 'forward', ArrowDown: 'back', s: 'back', S: 'back', ArrowLeft: 'left', a: 'left', A: 'left', ArrowRight: 'right', d: 'right', D: 'right' };
    const handleKeyDown = (e) => {
      const dir = keyDirMap[e.key];
      if (dir) { e.preventDefault(); setActiveDir(dir); move(dir); }
    };
    const handleKeyUp = (e) => {
      if (keyDirMap[e.key]) setActiveDir(null);
    };
    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    return () => { window.removeEventListener('keydown', handleKeyDown); window.removeEventListener('keyup', handleKeyUp); };
  }, [move]);

  // 로그 스크롤
  useEffect(() => {
    if (logRef.current) logRef.current.scrollTop = logRef.current.scrollHeight;
  }, [log]);

  // defeatMonster를 외부에서 접근할 수 있도록 ref로 노출
  useEffect(() => {
    window.__dungeonCrawlerDefeat = defeatMonster;
    return () => { delete window.__dungeonCrawlerDefeat; };
  }, [defeatMonster]);

  // 상태 변경 시 DB에 저장 (디바운스)
  const saveTimerRef = useRef(null);
  useEffect(() => {
    if (!maze || !onSaveState) return;
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(() => {
      onSaveState({
        dungeonKey,
        stage,
        maze,
        pos,
        facing,
        monsters,
        treasures,
        stepCount,
        explored: Array.from(explored),
      });
    }, 500);
    return () => { if (saveTimerRef.current) clearTimeout(saveTimerRef.current); };
  }, [pos, facing, monsters, treasures, stepCount]); // eslint-disable-line

  // ===== 재미 요소: 말풍선, 유령, 기습 =====
  const CHATTER = [
    // 탐험 (25)
    '이 던전 분위기 으스스하다...', '보물이 어디있을까?', '조심해, 뭔가 느껴져.',
    '이쪽으로 가보자!', '뭔가 소리가 들린 것 같은데...', '이 벽 뒤에 뭐가 있을까?',
    '횃불이 깜빡인다... 불길해.', '아까 그림자가 움직인 것 같았는데...', '용기를 내자!',
    '여기 공기가 좀 다른 것 같아.', '벽에 뭔가 써있는 것 같은데...',
    '이 문양은 뭐지? 함정 아니야?', '여기 발자국이 있어!',
    '저기 빛이 보이는 것 같아!', '아, 또 막다른 길이야...',
    '지도가 있었으면 좋겠다.', '이 통로 좁은데... 조심하자.',
    '공기가 점점 차가워지고 있어.', '어디선가 바람이 불어온다.',
    '이 돌벽 무늬가 인공적인 것 같아.', '멀리서 뭔가 울리는 소리가...',
    '오래된 뼈조각이 바닥에 있네...', '누군가 먼저 탐험한 흔적이 있어.',
    '여기 거미줄이 엄청 많네.', '위에서 물이 떨어지네...',
    // 잡담 (15)
    '배고프다... 빨리 끝내자.', '여기서 쉬었다 갈까?', '길을 잃은 건 아니겠지?',
    '던전 끝나면 뭐 먹지?', '내 침대가 그립다...', '아, 허리 아프다.',
    '이거 끝나면 나 쉴 거야.', '발이 아프다... 신발을 바꿔야겠어.',
    '물 좀 마시고 싶다.', '귀환하고 싶다... 아 안 돼, 참자.',
    '요즘 물약 값이 너무 올랐어.', '아, 외투 놓고 왔다.',
    '오늘 운세가 좋다고 했는데...', '어제 꿈이 이상했는데... 아 됐다.',
    '장비 점검 한번 하자.',
    // 자기 자랑 (10)
    '나만 믿어! 내가 다 처리할게.', '이 정도 몬스터는 눈 감고도 이겨.',
    '지난번엔 혼자서 보스를 잡았다고.', '내 검술을 감상하라고!',
    '봐봐, 내 장비 좀 멋지지 않아?', '전설의 용사가 왔다!',
    '이건 그냥 준비운동이야.', '나를 막을 수 있는 건 아무도 없어!',
    '나 이거 100번은 클리어했어.', '이 팀에 내가 있어서 든든하지?',
    // 농담 (10)
    '몬스터한테 길 물어볼까?', '여기 와이파이 되나?',
    '던전에 화장실은 없는 건가...', '몬스터도 퇴근시간이 있을까?',
    '미로 설계한 놈 진짜 성격 나쁘다.', '혹시 엘리베이터 없나?',
    '이 던전 리뷰 별 하나 줘야지.', '여기 인테리어 누가 했어? 센스 있네.',
    '아 맞다, 가스 잠그고 왔나?', '이 보물로 치킨 사먹자.',
  ];

  // {target} → 다른 파티원 이름으로 치환되는 인터랙티브 대사
  const INTERACTIVE_CHATTER = [
    // 놀림 & 조롱 (25)
    '{target}, 아까 몬스터 보고 움찔했지? ㅋㅋ',
    '{target} 뒤에 뭐 있다! ...거짓말~',
    '{target}, 너 겁먹은 거 다 봤어 ㅎㅎ',
    '야 {target}, 걸음이 왜 점점 느려져? 무서워?',
    '{target}아, 그 장비 언제 바꿀 거야? 눈이 아프다.',
    '{target}, 너 없었으면 내가 보물 다 먹었는데~',
    '{target}, 좀 전에 비명 지른 거 누구야?',
    '{target}... 솔직히 나보다 약하지? 인정해.',
    '아까 {target}이(가) 벽에 부딪힌 거 웃겼다 ㅋㅋ',
    '{target}, 아까부터 한숨만 쉬는데 괜찮아?',
    '{target}, 네 발소리가 제일 시끄러워. 몬스터 다 모여.',
    '에이~ {target}, 또 길 잘못 든 거 아니야?',
    '{target}, 전투 때 뒤에 숨지 좀 마...',
    '{target}... 혹시 방향치야?', '{target}, 입 좀 다물어. 몬스터가 들어.',
    '솔직히 {target} 없어도 클리어할 수 있을걸?',
    '{target}, 표정이 왜 그래? 유령 봤어?',
    '{target}아, 장비에서 삐걱거리는 소리 좀 고쳐.',
    '{target}, 코 좀 그만 골아. 잠이 온다.',
    '{target}이(가) 요리하면 몬스터도 도망갈 듯.',
    '야 {target}, 네가 방패 하면 되겠다. 덩치가 있으니까 ㅋ',
    '{target}, 그 자신감은 어디서 나오는 거야?',
    '{target}, 너 아까 몬스터 앞에서 눈 감았지?',
    '{target}, 전투할 때 좀 열심히 해라 ㅋㅋ',
    '{target}아, 그 한숨 좀 참아. 사기가 떨어져.',
    // 칭찬 & 격려 (15)
    '{target}, 아까 싸움 잘하던데? 좀 봐줄만 했어.',
    '{target} 덕분에 여기까지 왔다. 고마워!',
    '{target}, 실력 많이 늘었네? 솔직히 놀랐어.',
    '역시 {target}! 든든하다.',
    '{target}, 힘들면 말해. 내가 대신 싸워줄게.',
    '{target}이(가) 있으니까 뭔가 안심이 돼.',
    '{target}, 다음 전투에서도 잘 부탁해!',
    '{target}, 잘하고 있어. 조금만 더 힘내자.',
    '{target}아, 아까 그 기술 멋있었다!',
    '우리 팀에 {target} 있어서 다행이야.',
    '{target}, 오늘 컨디션 좋은 것 같은데?',
    '나 {target}이(가) 있어서 든든해.',
    '{target}아, 이 던전 끝나면 내가 밥 살게.',
    '{target}, 지금까지 최고의 파트너야.',
    '{target}, 포기하지 마! 거의 다 왔어.',
    // 장난 & 유머 (20)
    '{target}, 여기서 숨바꼭질 할까?',
    '야 {target}, 몬스터 요리 해먹을 줄 알아?',
    '{target}, 우리 내기하자. 누가 먼저 출구 찾나.',
    '{target}, 이 던전 인테리어 어때? 네 방보다 낫지?',
    '{target}... 너 혹시 몬스터랑 친구 먹으려고?',
    '{target}, 내 뒤에 숨지 마. 내가 더 무서워.',
    '{target}아, 만약 여기서 못 나가면 누구 잘못일까?',
    '{target}, 유언 같은 거 미리 준비해둬. 혹시 모르니까 ㅋ',
    '내가 {target}보다 레벨 높다는 거 알지?',
    '{target}, 이 보물 반반 나눌까? ...에이 농담이야.',
    '야 {target}, 방금 내가 구해줬잖아. 감사 인사는?',
    '{target}, 너 그 표정 짓지 마. 웃겨서 집중이 안 돼.',
    '만약 보스가 나오면 {target}이(가) 먼저 가 ㅋ',
    '{target}아, 네 장비 내가 가지면 안 돼?',
    '{target}, 제발 횃불 꺼뜨리지 마...',
    '{target}, 너 걸음걸이 좀 웃기다 ㅋㅋ',
    '{target}, 이 던전 클리어하면 네가 파티 열어!',
    '{target}아, 아까 한 소리 뭐였어? 비명이었어?',
    '야 {target}, 혹시 보물 몰래 챙기는 거 아니지?',
    '{target}, 얼굴에 거미줄 붙었다. 아 아니다, 원래 그런 거구나 ㅋ',
  ];
  const LOW_HP_CHATTER = [
    '으윽... 아파...', '회복이 필요해!', '체력이 얼마 안 남았어...', '물약 있나요?',
    '더 이상은 힘들어...', '좀 쉬었다 가자...', '눈앞이 빙빙 돈다...',
    '여기서 죽을 순 없어!', '누가 좀 도와줘...', '한 대만 더 맞으면 끝이야...',
  ];
  const ENCOUNTER_REACT = [
    '윽! 적이다!', '앗, 몬스터다!', '전투 준비!', '조심해, 온다!',
    '드디어 싸울 거리가 왔군!', '하... 또 싸워야 해?', '뒤로 물러서!',
    '내가 앞에 설게!', '다들 대형 잡아!', '긴장해, 강해보여.',
    '이 정도는 가볍지!', '겁먹지 마, 할 수 있어!', '무기 뽑아!',
    '여기서 막는다!', '흥, 덤벼라!',
  ];
  const AMBUSH_REACT = [
    '아이 깜짝이야!!', '으악! 뭐야?!', '심장 떨어지는 줄...',
    '뒤에 뭔가 있었어?!', '놀라서 심장 터질 뻔...', '소름 돋았다...',
    '으으... 기분 나쁜 기척이야.', '누구야?! ...아무도 없네.',
    '방금 뭐 지나간 거 아니야?!', '아 진짜 놀랐잖아!!',
    '뒤통수가 서늘해...', '이상한 느낌인데... 그냥 갈까?',
  ];
  // 몬스터 말풍선 대사
  const MONSTER_CHATTER = [
    // 위협 & 도발 (25)
    '크르르르...', '감히 여기에...?', '사냥감이 왔군!', '으르르... 다가오지 마!',
    '맛있겠다... 히히', '여긴 내 영역이다!', '비켜! 내가 먼저야!',
    '도망쳐... 지금이라도...', '크큭... 잡았다!', '고깃덩어리들이군...',
    '쉿... 놈들이 온다...', '우두머리님께 보고해야겠어.', '어이쿠, 또 왔네.',
    '그 장비 나한테 줘!', '이 던전에서 못 나간다!', '크하하, 겁먹었지?',
    '뼈도 못 추릴 줄 알아라!', '오늘 저녁은 모험가 스튜!', '어디서 냄새가...',
    '우리가 몇인지 알아?', '가만 보니 약해 보이는데?', '지금 돌아가면 살려줄게.',
    '싸울 거야 말 거야?', '크큭큭큭... 재밌겠는걸.', '비겁하게 도망치진 않겠지?',
    // 독백 & 잡담 (15)
    '아... 배고프다...', '교대 시간 언제야?', '여기 너무 습하잖아...',
    '저쪽에서 맛있는 냄새 나는데...', '우두머리가 또 화내겠지...', '이 보초 너무 지루해...',
    '아까 박쥐가 머리를 때렸어...', '새 무기 갖고 싶다...', '다른 던전으로 이직하고 싶다...',
    '비가 오나? 위에서 물이 새는데...', '오늘 운수가 좋지 않아...', '잠이 온다... 하암...',
    '벌레 소리가 거슬리네...', '이 바닥 왜 이렇게 차갑지...', '동료들 어디 갔지?',
    // 놀람 & 공포 (10)
    '우욱?! 뭐야?!', '으악! 인간이다!', '도, 도망쳐!', '저거 그 유명한 모험가 아냐?!',
    '우두머리! 침입자다!', '눈을 마주치지 마...', '보물 건드리지 마!', '가까이 오지 마!',
    '제발... 살려줘...', '왜 이런 데서 마주치는 거야!',
  ];
  // 전투 중 몬스터 대사
  // eslint-disable-next-line no-unused-vars
  const MONSTER_BATTLE_CHATTER = [
    // 전투 시작 (15)
    '크아아아!! 덤벼라!', '잡아주마!', '이 힘을 보여주겠다!',
    '도망칠 생각은 마!', '으라차차!', '여기가 네 무덤이다!',
    '크르르... 가만 안 둬!', '한 놈도 못 보내!', '크허허, 맛있겠다!',
    '감히 내 앞에...!', '이번엔 봐주지 않는다!', '으하하! 약하군!',
    '그 정도로 나를 이길 수 있을 것 같아?', '인간 따위에게...!', '후회하게 될 거다!',
    // 전투 중 (15)
    '이, 이게 무슨...!', '아파!', '제법이군... 하지만!', '크윽... 아직 안 끝났어!',
    '이번엔 진심이다!', '내가 이렇게 당하다니!', '비, 비겁한 놈들!',
    '동료들이 오면 끝장이야!', '크르르... 화났어!', '한 번만 더!',
    '흥, 간지러워!', '날 무시하는 거야?!', '크억... 이 일격은...',
    '쓸데없이 아프잖아!', '우리 우두머리가 가만 안 둘 거야!',
    // 도주 시도 (5)
    '잠, 잠깐! 타임!', '그, 그만 때려!', '항복! 항복할게!',
    '살려줘! 보물 다 줄게!', '으악! 도, 도망가야 해!',
  ];

  const GHOST_EVENTS = [
    { type: 'ghost', text: '희미한 유령이 벽을 통과해 사라졌다...', img: '/ui/dungeon/dc_ghost.png' },
    { type: 'ghost', text: '어디선가 속삭임이 들린다... "돌아가라..."', img: '/ui/dungeon/dc_ghost.png' },
    { type: 'npc', text: '떠돌이 상인의 유령이 나타났다가 사라졌다.', img: '/ui/dungeon/dc_ghost_merchant.png' },
    { type: 'npc', text: '쥐 한 마리가 후다닥 지나갔다!', img: '/ui/dungeon/dc_rat.png' },
    { type: 'npc', text: '꺼진 줄 알았던 횃불이 갑자기 타올랐다!', img: '/ui/dungeon/dc_torch_img.png?v=2' },
    { type: 'ghost', text: '벽에 새겨진 경고문이 붉게 빛난다...', img: '/ui/dungeon/dc_wall_runes.png' },
    { type: 'npc', text: '박쥐 떼가 천장에서 날아올랐다!', img: '/ui/dungeon/dc_bats.png' },
    { type: 'ghost', text: '갑자기 안개가 짙어졌다가 걷혔다.', img: '/ui/dungeon/dc_fog_overlay.png?v=2' },
    { type: 'npc', text: '이상한 버섯이 빛나고 있다... 건드리지 않는 게 좋겠다.', img: '/ui/dungeon/dc_mushroom.png' },
    { type: 'ghost', text: '누군가 지켜보고 있는 느낌이 든다...', img: '/ui/dungeon/dc_ghost.png' },
  ];

  // 이동할 때마다 랜덤 이벤트 발생
  useEffect(() => {
    if (!maze || stepCount === 0) return;

    // 15% 확률로 말풍선
    if (Math.random() < 0.15) {
      const party = [];
      // 플레이어는 던전 탐험 중이므로 항상 대화 가능
      if (character) party.push({ id: 'player', name: character.name });
      (filteredSummons || []).forEach(s => party.push({ id: `summon_${s.id}`, name: s.name }));
      (filteredMercs || []).forEach(m => party.push({ id: `merc_${m.id}`, name: m.name }));

      if (party.length > 0) {
        const speaker = party[Math.floor(Math.random() * party.length)];
        const others = party.filter(p => p.id !== speaker.id);
        const isLowHp = character && (charState?.currentHp ?? character.current_hp) < (charState?.maxHp ?? character.hp) * 0.3;
        let text;
        if (isLowHp && speaker.id === 'player' && Math.random() < 0.6) {
          text = LOW_HP_CHATTER[Math.floor(Math.random() * LOW_HP_CHATTER.length)];
        } else if (others.length > 0 && Math.random() < 0.45) {
          const target = others[Math.floor(Math.random() * others.length)];
          text = INTERACTIVE_CHATTER[Math.floor(Math.random() * INTERACTIVE_CHATTER.length)]
            .replace(/\{target\}/g, target.name);
        } else {
          text = CHATTER[Math.floor(Math.random() * CHATTER.length)];
        }
        showSpeech(speaker.id, text);
        addLog(`💬 ${speaker.name}: "${text}"`, 'system');
      }
    }

    // 5% 확률로 유령/환경 이벤트
    if (Math.random() < 0.05) {
      const evt = GHOST_EVENTS[Math.floor(Math.random() * GHOST_EVENTS.length)];
      setGhostEvent(evt);
      addLog(evt.text, 'system');
      setTimeout(() => setGhostEvent(null), 3000);
    }

    // 3% 확률로 기습 경고 (전투는 발생하지 않음, 긴장감 연출)
    if (Math.random() < 0.03 && !encounterAnim) {
      setAmbushWarning(true);
      addLog('⚠️ 뒤에서 기척이 느껴졌다! ...아무것도 없었다.', 'damage');
      // 기습 리액션 말풍선
      {
        const aParty = [];
        if (character) aParty.push({ id: 'player', name: character.name });
        (filteredSummons || []).forEach(s => aParty.push({ id: `summon_${s.id}`, name: s.name }));
        (filteredMercs || []).forEach(m => aParty.push({ id: `merc_${m.id}`, name: m.name }));
        if (aParty.length > 0) {
          const aSpeaker = aParty[Math.floor(Math.random() * aParty.length)];
          const aText = AMBUSH_REACT[Math.floor(Math.random() * AMBUSH_REACT.length)];
          showSpeech(aSpeaker.id, aText);
          addLog(`💬 ${aSpeaker.name}: "${aText}"`, 'system');
        }
      }
      setTimeout(() => setAmbushWarning(false), 1500);
    }

    // 10% 확률로 근처 몬스터가 말풍선
    if (Math.random() < 0.10 && monsters.length > 0) {
      const nearbyMobs = monsters.filter(m => !m.defeated && Math.abs(m.x - pos.x) + Math.abs(m.y - pos.y) <= 3);
      if (nearbyMobs.length > 0) {
        const mob = nearbyMobs[Math.floor(Math.random() * nearbyMobs.length)];
        const text = MONSTER_CHATTER[Math.floor(Math.random() * MONSTER_CHATTER.length)];
        showMonsterSpeech(mob.id, text);
        addLog(`👹 ${mob.monsterName || '몬스터'}: "${text}"`, 'system');
      }
    }
  }, [stepCount]); // eslint-disable-line

  if (!maze) return (
    <div className="dc-loading">
      <img src="/ui/dungeon/dc_loading_bg.png" alt="" className="dc-loading-bg" />
      <div className="dc-loading-overlay" />
      <span className="dc-loading-text">던전 생성 중</span>
    </div>
  );

  const requiredMonsters = monsters.filter(m => !m.hidden);
  const allDefeated = requiredMonsters.every(m => m.defeated);
  const defeatedCount = requiredMonsters.filter(m => m.defeated).length;

  return (
    <div className="dc-container">
      {/* 상단: 미니맵 + 1인칭 뷰 */}
      <div className="dc-upper">
        <div className="dc-upper-left">
          <div className="dc-minimap-wrapper">
            <img src="/ui/dungeon/dc_minimap_frame.png" alt="" className="dc-minimap-frame-img" />
            <MiniMap
              maze={maze} px={pos.x} py={pos.y} facing={facing}
              explored={explored} monsters={monsters.filter(m => !m.hidden)} treasures={treasures}
              exitPos={maze.exitPos}
            />
          </div>
          {/* 던전 정보 */}
          <div className="dc-info-panel">
            <img src="/ui/dungeon/dc_info_bg.png" alt="" className="dc-info-bg-img" />
            <div className="dc-info-bg-overlay" />
            <div className="dc-info-content">
            <div className="dc-info-title">{stage?.name || dungeonKey}</div>
            <div className="dc-info-row">
              <span>🗡️ 처치</span>
              <span className="dc-info-val">{defeatedCount}/{requiredMonsters.length}</span>
            </div>
            <div className="dc-info-row">
              <span>👣 이동</span>
              <span className="dc-info-val">{stepCount}</span>
            </div>
            <div className="dc-info-row">
              <span>📦 보물</span>
              <span className="dc-info-val">{treasures.filter(t => t.collected).length}/{treasures.length}</span>
            </div>
            {allDefeated && (
              <div className="dc-info-clear">모든 적 처치 완료!</div>
            )}
            </div>
          </div>
        </div>

        <div className="dc-upper-right">
          <ThreeFirstPersonView
            maze={maze} px={pos.x} py={pos.y} facing={facing}
            monsters={monsters.filter(m => !m.hidden)} treasures={treasures} exitPos={maze.exitPos}
            monsterSpeech={monsterSpeech} dungeonKey={dungeonKey}
            allies={{ character, charState, filteredSummons, filteredMercs, playerInFormation }}
          />
          {/* 3D 화면 오른쪽 상단 버튼 */}
          <div className="dc-fpv-top-btns">
            <button
              className={`dc-fpv-btn auto ${autoPath ? 'active' : ''}`}
              onClick={() => { setAutoPath(p => { autoPathRef.current = !p; if (!p) planAutoPath(); else autoMoveQueue.current = []; return !p; }); }}
            >
              {autoPath ? '⏸ 정지' : '🧭 자동'}
            </button>
            <button
              className="dc-fpv-btn retreat"
              onClick={() => { setAutoPath(false); autoPathRef.current = false; autoMoveQueue.current = []; setRetreatConfirm(true); }}
            >
              🏃 후퇴
            </button>
          </div>
        </div>
      </div>

      {/* 하단: 컨트롤 + 파티 */}
      <div className="dc-lower">
        <div className="dc-controls">
          <div className="dc-controls-inner">
            <div className="dc-ctrl-row">
              <button className={`dc-ctrl-btn ${activeDir === 'forward' ? 'active' : ''}`} onClick={() => move('forward')}>
                <span className="dc-ctrl-arrow">▲</span>
                <span className="dc-ctrl-label">전진</span>
              </button>
            </div>
            <div className="dc-ctrl-row">
              <button className={`dc-ctrl-btn ${activeDir === 'left' ? 'active' : ''}`} onClick={() => move('left')}>
                <span className="dc-ctrl-arrow">◄</span>
                <span className="dc-ctrl-label">좌회전</span>
              </button>
              <button className={`dc-ctrl-btn back ${activeDir === 'back' ? 'active' : ''}`} onClick={() => move('back')}>
                <span className="dc-ctrl-arrow">▼</span>
                <span className="dc-ctrl-label">후퇴</span>
              </button>
              <button className={`dc-ctrl-btn ${activeDir === 'right' ? 'active' : ''}`} onClick={() => move('right')}>
                <span className="dc-ctrl-arrow">►</span>
                <span className="dc-ctrl-label">우회전</span>
              </button>
            </div>
            {/* 자동길찾기/후퇴 버튼은 3D 화면 오른쪽 상단으로 이동 */}
          </div>
        </div>

        {/* 파티 바 */}
        <div className="dc-party-bar">
          {(() => {
            const party = [];
            // 플레이어 (진형에 배치된 경우만)
            // 코스메틱 오라 결정 헬퍼
            const getAura = (unitId, element) => {
              const cm = cosmeticMap[unitId];
              if (cm?.effect) return cm.effect;
              return ELEMENT_AURA_MAP[element] || 'aura_gold';
            };
            if (character && playerInFormation) {
              const el = character.element || CLASS_ELEMENT_MAP[character.class_type] || 'neutral';
              party.push({
                id: 'player', name: character.name, level: charState?.level || character.level,
                hp: charState?.currentHp ?? character.current_hp, maxHp: charState?.maxHp ?? character.hp,
                mp: charState?.currentMp ?? character.current_mp, maxMp: charState?.maxMp ?? character.mp,
                imageUrl: `/characters/${CLASS_IMAGE_MAP[character.class_type] || 'monk'}_icon.png`,
                type: 'player', classType: character.class_type,
                aura: getAura('player', el),
              });
            }
            // 소환수 (진형 필터링 적용)
            (filteredSummons || []).forEach(s => {
              const tid = s.template_id || s.summon_id || s.id;
              party.push({
                id: `summon_${s.id}`, name: s.name, level: s.level,
                hp: s.current_hp ?? s.hp, maxHp: s.hp, mp: s.current_mp ?? s.mp ?? 0, maxMp: s.mp ?? 0,
                imageUrl: `/summons_nobg/${tid}_icon.png`, type: 'summon',
                aura: getAura(`summon_${s.id}`, s.element || 'neutral'),
              });
            });
            // 용병 (진형 필터링 적용)
            (filteredMercs || []).forEach(m => {
              const tid = m.template_id || m.id;
              party.push({
                id: `merc_${m.id}`, name: m.name, level: m.level,
                hp: m.current_hp ?? m.hp, maxHp: m.hp, mp: m.current_mp ?? m.mp ?? 0, maxMp: m.mp ?? 0,
                imageUrl: `/mercenaries/${tid}_icon.png`, type: 'mercenary',
                aura: getAura(`merc_${m.id}`, 'neutral'),
              });
            });
            return party.map(ally => {
              const hpPct = ally.maxHp > 0 ? Math.max(0, (ally.hp / ally.maxHp) * 100) : 0;
              const mpPct = ally.maxMp > 0 ? Math.max(0, (ally.mp / ally.maxMp) * 100) : 0;
              return (
                <div key={ally.id} className={`dc-party-member ${hpPct < 30 ? 'low-hp' : ''}`}
                  style={speechBubble?.allyId === ally.id ? { zIndex: 100 } : undefined}
                  onClick={() => openInspect(ally)}>
                  {speechBubble && speechBubble.allyId === ally.id && (
                    <div className="dc-speech-bubble">
                      <span>{speechBubble.text}</span>
                    </div>
                  )}
                  <div className="dc-party-portrait">
                    <div className={`cb-portrait-effect cb-effect-${ally.aura || 'aura_gold'}`} style={{ position: 'absolute', inset: 0, borderRadius: '8px', zIndex: 2, pointerEvents: 'none' }} />
                    <img src={ally.imageUrl} alt={ally.name} className="dc-party-img" onError={e => { e.target.style.display = 'none'; }} />
                  </div>
                  <div className="dc-party-info">
                    <div className="dc-party-name">{ally.name}</div>
                    <div className="dc-party-bars">
                      <div className="dc-party-hp-bar"><div className="dc-party-hp-fill" style={{ width: `${hpPct}%` }} /></div>
                      {ally.maxMp > 0 && <div className="dc-party-mp-bar"><div className="dc-party-mp-fill" style={{ width: `${mpPct}%` }} /></div>}
                    </div>
                  </div>
                </div>
              );
            });
          })()}
        </div>
      </div>

      {/* 탐험 로그 토글 */}
      <button className={`dc-log-toggle ${!showLog && unreadLog > 0 ? 'has-unread' : ''}`} onClick={() => { setShowLog(!showLog); if (!showLog) setUnreadLog(0); }}>
        📜 {showLog ? '로그 닫기' : '탐험 로그'}
        {!showLog && unreadLog > 0 && <span className="dc-log-badge">{unreadLog > 99 ? '99+' : unreadLog}</span>}
      </button>
      {showLog && (
        <div className="dc-log-panel" ref={logRef}>
          <div className="dc-log-header">
            <span>📜 탐험 로그</span>
            <button className="dc-log-close" onClick={() => setShowLog(false)}>✕</button>
          </div>
          <div className="dc-log-content">
            {log.map(l => (
              <div key={l.id} className={`dc-log-line ${l.type}`}>{l.text}</div>
            ))}
          </div>
        </div>
      )}

      {/* 아군 상세 정보 + 장비 관리 패널 */}
      {inspectAlly && (
        <div className="dc-ally-inspect" onClick={() => { setInspectAlly(null); setEquipData(null); }}>
          <div className="dc-equip-panel" onClick={e => e.stopPropagation()}>
            <div className="dc-equip-header">
              <span className="dc-equip-header-title">장비 관리</span>
              <button className="dc-equip-close" onClick={() => { setInspectAlly(null); setEquipData(null); }}>✕</button>
            </div>

            {/* ===== 좌측: 캐릭터 + 장비 슬롯 + 스탯 ===== */}
            <div className="dc-equip-left">
              <div className="dc-equip-char-area">
                <div className="dc-equip-portrait">
                  <div className={`cb-portrait-effect cb-effect-${inspectAlly.aura || cosmeticMap[inspectAlly.id]?.effect || ELEMENT_AURA_MAP[character?.element] || 'aura_gold'}`} style={{ position: 'absolute', inset: 0, borderRadius: '12px', zIndex: 2, pointerEvents: 'none' }} />
                  <img src={inspectAlly.imageUrl?.replace('_icon', '_full')} alt="" className="dc-equip-portrait-img"
                    onError={e => { e.target.src = inspectAlly.imageUrl; e.target.onerror = null; }} />
                </div>
                {/* 장비 슬롯 3x3 그리드 */}
                {equipData && (
                  <div className="dc-equip-slots">
                    {[
                      { id: 'helmet', name: '투구', icon: '🪖', img: '/ui/slot_helmet.png', row: 1, col: 2 },
                      { id: 'weapon', name: '무기', icon: '⚔️', img: '/ui/slot_weapon.png', row: 2, col: 1 },
                      { id: 'chest', name: '갑옷', icon: '🛡️', img: '/ui/slot_chest.png', row: 2, col: 2 },
                      { id: 'shield', name: '방패', icon: '🔰', img: '/ui/slot_shield.png', row: 2, col: 3 },
                      { id: 'ring', name: '반지', icon: '💍', img: '/ui/slot_ring.png', row: 3, col: 1 },
                      { id: 'boots', name: '장화', icon: '👢', img: '/ui/slot_boots.png', row: 3, col: 2 },
                      { id: 'necklace', name: '목걸이', icon: '📿', img: '/ui/slot_necklace.png', row: 3, col: 3 },
                    ].map(slot => {
                      const item = equipData.equipped[slot.id];
                      const GRADE_COLORS = { '일반': '#aaa', '고급': '#4ade80', '희귀': '#60a5fa', '영웅': '#c084fc', '전설': '#fbbf24', '신화': '#ff6b6b' };
                      return (
                        <div key={slot.id} className={`dc-equip-slot ${item ? 'filled' : 'empty'}`}
                          style={{ gridRow: slot.row, gridColumn: slot.col, ...(item ? { borderColor: GRADE_COLORS[item.grade] || '#aaa' } : {}) }}
                          onClick={() => item && handleUnequip(slot.id)}
                          title={item ? `${item.name}${item.enhance_level > 0 ? ` +${item.enhance_level}` : ''} (클릭: 해제)` : slot.name}>
                          {item ? (
                            <>
                              <img src={`/equipment/${item.item_id}_icon.png`} alt="" className="dc-equip-slot-img" onError={e => { e.target.style.display = 'none'; }} />
                              {item.enhance_level > 0 && <span className="dc-equip-enhance">+{item.enhance_level}</span>}
                            </>
                          ) : (
                            <img src={slot.img} alt="" className="dc-equip-slot-placeholder" onError={e => { e.target.style.display = 'none'; e.target.nextSibling && (e.target.nextSibling.style.display = ''); }} />
                          )}
                          <span className="dc-equip-slot-label">{slot.name}</span>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* 캐릭터 정보 */}
              <div className="dc-equip-info">
                <div className="dc-equip-name">{inspectAlly.name}</div>
                <div className="dc-equip-level">Lv.{inspectAlly.level} {inspectAlly.type === 'player' ? `(${inspectAlly.classType})` : inspectAlly.type === 'summon' ? '(소환수)' : '(용병)'}</div>
                <div className="dc-equip-bars">
                  <div className="dc-equip-bar hp">
                    <div className="dc-equip-bar-fill" style={{ width: `${inspectAlly.maxHp > 0 ? (inspectAlly.hp / inspectAlly.maxHp) * 100 : 0}%` }} />
                    <span>HP {Math.floor(inspectAlly.hp)}/{inspectAlly.maxHp}</span>
                  </div>
                  {inspectAlly.maxMp > 0 && (
                    <div className="dc-equip-bar mp">
                      <div className="dc-equip-bar-fill" style={{ width: `${(inspectAlly.mp / inspectAlly.maxMp) * 100}%` }} />
                      <span>MP {Math.floor(inspectAlly.mp)}/{inspectAlly.maxMp}</span>
                    </div>
                  )}
                </div>
                {/* 장착 장비 스탯 합산 */}
                {equipData && (() => {
                  const eq = equipData.equipped;
                  const stats = { HP: 0, MP: 0, 공격: 0, 방어: 0, 물공: 0, 물방: 0, 마공: 0, 마방: 0, 치명: 0, 회피: 0 };
                  Object.values(eq).forEach(it => {
                    stats.HP += it.effect_hp || 0; stats.MP += it.effect_mp || 0;
                    stats.공격 += it.effect_attack || 0; stats.방어 += it.effect_defense || 0;
                    stats.물공 += it.effect_phys_attack || 0; stats.물방 += it.effect_phys_defense || 0;
                    stats.마공 += it.effect_mag_attack || 0; stats.마방 += it.effect_mag_defense || 0;
                    stats.치명 += it.effect_crit_rate || 0; stats.회피 += it.effect_evasion || 0;
                  });
                  const nonZero = Object.entries(stats).filter(([, v]) => v !== 0);
                  if (nonZero.length === 0) return null;
                  return (
                    <div className="dc-equip-stats">
                      {nonZero.map(([k, v]) => (
                        <div key={k} className="dc-equip-stat">
                          <span>{k}</span>
                          <span className={v > 0 ? 'positive' : 'negative'}>{v > 0 ? `+${v}` : v}</span>
                        </div>
                      ))}
                    </div>
                  );
                })()}
              </div>
            </div>

            {/* ===== 우측: 인벤토리 ===== */}
            <div className="dc-equip-right">
                <div className="dc-equip-inv-tabs">
                  <button className={`dc-equip-inv-tab ${invTab === 'equip' ? 'active' : ''}`} onClick={() => { setInvTab('equip'); setSelectedInvItem(null); }}>장비</button>
                  <button className={`dc-equip-inv-tab ${invTab === 'potion' ? 'active' : ''}`} onClick={() => { setInvTab('potion'); setSelectedInvItem(null); }}>물약</button>
                </div>

                {equipLoading ? (
                  <div className="dc-equip-inv-loading">로딩 중...</div>
                ) : equipData ? (
                  <div className="dc-equip-inv-content">
                    {invTab === 'equip' ? (
                      <>
                        <div className="dc-equip-inv-grid">
                          {equipData.inventory.map((it, i) => {
                            const GRADE_COLORS = { '일반': '#aaa', '고급': '#4ade80', '희귀': '#60a5fa', '영웅': '#c084fc', '전설': '#fbbf24', '신화': '#ff6b6b' };
                            return (
                              <div key={i} className={`dc-equip-inv-item ${selectedInvItem === i ? 'selected' : ''}`}
                                style={{ borderColor: GRADE_COLORS[it.grade] || '#555' }}
                                onClick={() => setSelectedInvItem(selectedInvItem === i ? null : i)}
                                title={it.name}>
                                <img src={`/equipment/${it.item_id}_icon.png`} alt="" className="dc-equip-inv-img" onError={e => { e.target.style.display = 'none'; }} />
                                {it.enhance_level > 0 && <span className="dc-equip-inv-enh">+{it.enhance_level}</span>}
                              </div>
                            );
                          })}
                          {equipData.inventory.length === 0 && <div className="dc-equip-inv-empty">장비가 없습니다</div>}
                        </div>
                        {selectedInvItem !== null && equipData.inventory[selectedInvItem] && (() => {
                          const it = equipData.inventory[selectedInvItem];
                          const GRADE_COLORS = { '일반': '#aaa', '고급': '#4ade80', '희귀': '#60a5fa', '영웅': '#c084fc', '전설': '#fbbf24', '신화': '#ff6b6b' };
                          return (
                            <div className="dc-equip-inv-detail">
                              <div className="dc-equip-inv-detail-name" style={{ color: GRADE_COLORS[it.grade] || '#aaa' }}>
                                {it.name}{it.enhance_level > 0 ? ` +${it.enhance_level}` : ''}
                              </div>
                              <div className="dc-equip-inv-detail-desc">{it.description || ''}</div>
                              <div className="dc-equip-inv-detail-stats">
                                {it.effect_hp ? <span>HP +{it.effect_hp}</span> : null}
                                {it.effect_mp ? <span>MP +{it.effect_mp}</span> : null}
                                {it.effect_attack ? <span>공격 +{it.effect_attack}</span> : null}
                                {it.effect_defense ? <span>방어 +{it.effect_defense}</span> : null}
                                {it.effect_phys_attack ? <span>물공 +{it.effect_phys_attack}</span> : null}
                                {it.effect_phys_defense ? <span>물방 +{it.effect_phys_defense}</span> : null}
                                {it.effect_mag_attack ? <span>마공 +{it.effect_mag_attack}</span> : null}
                                {it.effect_mag_defense ? <span>마방 +{it.effect_mag_defense}</span> : null}
                                {it.effect_crit_rate ? <span>치명 +{it.effect_crit_rate}</span> : null}
                                {it.effect_evasion ? <span>회피 +{it.effect_evasion}</span> : null}
                              </div>
                              <button className="dc-equip-inv-equip-btn" onClick={() => handleEquip(it.item_id, it.slot)}>장착</button>
                            </div>
                          );
                        })()}
                      </>
                    ) : (
                      <div className="dc-equip-inv-potions">
                        {equipData.potions.map(p => (
                          <div key={p.inv_id} className="dc-equip-potion-item">
                            <div className="dc-equip-potion-info">
                              <span className="dc-equip-potion-name">{p.name}</span>
                              <span className="dc-equip-potion-qty">x{p.quantity}</span>
                            </div>
                            <div className="dc-equip-potion-effect">
                              {p.effect_hp ? <span className="hp">HP +{p.effect_hp}</span> : null}
                              {p.effect_mp ? <span className="mp">MP +{p.effect_mp}</span> : null}
                            </div>
                            <button className="dc-equip-potion-use" onClick={() => handleUsePotion(p.inv_id)}>사용</button>
                          </div>
                        ))}
                        {equipData.potions.length === 0 && <div className="dc-equip-inv-empty">물약이 없습니다</div>}
                      </div>
                    )}
                  </div>
                ) : null}
              </div>
          </div>
        </div>
      )}

      {/* 유령/환경 이벤트 오버레이 */}
      {ghostEvent && (
        <div className="dc-ghost-event">
          {ghostEvent.img && (
            <img src={ghostEvent.img} alt="" className="dc-ghost-event-img"
              onError={e => { e.target.style.display = 'none'; }} />
          )}
          <div className="dc-ghost-event-text">{ghostEvent.text}</div>
        </div>
      )}

      {/* 기습 경고 */}
      {ambushWarning && (
        <div className="dc-ambush-warning">
          <img src="/ui/dungeon/dc_ambush_bg.png?v=2" alt="" className="dc-ambush-bg-img" />
          <div className="dc-ambush-flash" />
          <div className="dc-ambush-text">⚠️ 기척!</div>
        </div>
      )}

      {/* 보물 발견 팝업 */}
      {treasurePopup && (
        <div className="dc-treasure-popup">
          <div className="dc-treasure-popup-inner">
            <div className="dc-treasure-rays" />
            <div className="dc-treasure-glow" />
            <div className="dc-treasure-chest-wrap">
              <img src="/ui/dungeon/dc_treasure.png?v=2" alt="" className="dc-treasure-chest-img"
                onError={e => { e.target.style.display = 'none'; e.target.nextElementSibling.style.display = 'block'; }} />
              <div className="dc-treasure-chest-css" style={{ display: 'none' }}>
                <div className="dc-css-chest-body" />
                <div className="dc-css-chest-lid" />
                <div className="dc-css-chest-glow-inner" />
              </div>
              <div className="dc-treasure-sparkles">
                {[...Array(16)].map((_, i) => (
                  <div key={i} className="dc-treasure-sparkle" style={{ '--i': i, '--angle': `${i * 22.5}deg` }} />
                ))}
              </div>
              <div className="dc-treasure-coins">
                {[...Array(8)].map((_, i) => (
                  <div key={i} className="dc-treasure-coin" style={{ '--ci': i }} />
                ))}
              </div>
            </div>
            <div className="dc-treasure-title">보물 발견!</div>
            <div className="dc-treasure-gold">
              <img src="/ui/gold_coin.png" alt="" className="dc-treasure-gold-coin-img"
                onError={e => { e.target.style.display = 'none'; }} />
              <span className="dc-treasure-gold-amount">+{treasurePopup.gold}G</span>
            </div>
          </div>
        </div>
      )}

      {/* 전투 조우 오버레이 */}
      {encounterAnim && (
        <div className="dc-encounter-overlay">
          <img src="/ui/dungeon/dc_encounter_bg.png" alt="" className="dc-encounter-bg-img" />
          <div className="dc-encounter-flash" />
          <div className="dc-encounter-text">⚔️ ENCOUNTER!</div>
        </div>
      )}

      {/* 출구 팝업 */}
      {exitPopup && (
        <div className="dc-exit-overlay" onClick={() => setExitPopup(null)}>
          <div className={`dc-exit-popup ${exitPopup}`} onClick={e => e.stopPropagation()}>
            {/* 배경 이미지 */}
            <img
              src={exitPopup === 'clear' ? '/ui/dungeon/dc_exit_clear.png' : '/ui/dungeon/dc_exit_blocked.png'}
              alt="" className="dc-exit-popup-bg"
              onError={e => { e.target.style.display = 'none'; }}
            />
            <div className="dc-exit-popup-vignette" />

            {/* 파티클 */}
            <div className="dc-exit-particles">
              {Array.from({ length: 12 }).map((_, i) => (
                <div key={i} className={`dc-exit-particle ${exitPopup === 'clear' ? 'gold' : 'red'}`}
                  style={{
                    left: `${8 + Math.random() * 84}%`,
                    animationDelay: `${Math.random() * 3}s`,
                    animationDuration: `${2.5 + Math.random() * 2}s`,
                    width: `${3 + Math.random() * 4}px`,
                    height: `${3 + Math.random() * 4}px`,
                  }}
                />
              ))}
            </div>

            <div className="dc-exit-popup-content">
              {exitPopup === 'clear' ? (
                <>
                  <div className="dc-exit-icon-wrap">
                    <div className="dc-exit-icon-glow clear" />
                    <div className="dc-exit-icon">🚪</div>
                  </div>
                  <div className="dc-exit-title clear">출구 발견!</div>
                  <div className="dc-exit-desc">
                    모든 적을 처치했습니다.<br/>
                    던전의 출구가 열렸습니다!
                  </div>
                  <div className="dc-exit-divider" />
                  <div className="dc-exit-stage-info">
                    <span className="dc-exit-stage-label">탐험 완료</span>
                    <span className="dc-exit-step-count">{stepCount}걸음</span>
                  </div>
                  <button className="dc-exit-btn clear" onClick={() => {
                    setExitPopup(null);
                    const stats = { stepCount, monstersDefeated: monsters.filter(m => m.defeated).length, totalMonsters: monsters.filter(m => !m.hidden).length, treasuresFound: treasures.filter(t2 => t2.collected).length, totalTreasures: treasures.length };
                    if (onClear) onClear(stats);
                  }}>
                    <span className="dc-exit-btn-icon">🏆</span> 밖으로 나가기
                  </button>
                </>
              ) : (
                <>
                  <div className="dc-exit-icon-wrap">
                    <div className="dc-exit-icon-glow blocked" />
                    <div className="dc-exit-icon blocked">🔒</div>
                  </div>
                  <div className="dc-exit-title blocked">출구 봉쇄됨</div>
                  <div className="dc-exit-desc blocked">
                    아직 <span className="dc-exit-remain">{monsters.filter(m => !m.hidden && !m.defeated).length}마리</span>의 몬스터가<br/>
                    던전에 남아있습니다.
                  </div>
                  <div className="dc-exit-warning">
                    <span className="dc-exit-warning-icon">⚠️</span>
                    모든 몬스터를 처치해야 탈출할 수 있습니다
                  </div>
                  <button className="dc-exit-btn blocked" onClick={() => setExitPopup(null)}>
                    <span className="dc-exit-btn-icon">⚔️</span> 돌아가서 싸우기
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {/* 말풍선은 파티 멤버 카드 안에서 렌더링 */}

      {/* 귀환 확인 팝업 (패널티 경고) */}
      {retreatConfirm && (
        <div className="dc-retreat-overlay" onClick={() => setRetreatConfirm(false)}>
          <div className="dc-retreat-popup" onClick={e => e.stopPropagation()}>
            {/* 배경 */}
            <div className="dc-retreat-bg">
              <img src="/ui/dungeon/dc_retreat_bg.png" alt="" onError={e => { e.target.style.display = 'none'; }} />
              <div className="dc-retreat-bg-overlay" />
            </div>

            {/* 경고 아이콘 */}
            <div className="dc-retreat-icon-wrap">
              <div className="dc-retreat-icon-glow" />
              <div className="dc-retreat-icon">⚠️</div>
            </div>

            <div className="dc-retreat-title">던전 후퇴</div>
            <div className="dc-retreat-subtitle">정말 던전에서 후퇴하시겠습니까?</div>

            {/* 패널티 목록 */}
            <div className="dc-retreat-penalties">
              <div className="dc-retreat-penalty-header">귀환 시 패널티</div>
              <div className="dc-retreat-penalty-item">
                <span className="dc-retreat-penalty-icon">💔</span>
                <span className="dc-retreat-penalty-text">현재 HP의 <b>30%</b> 감소</span>
              </div>
              <div className="dc-retreat-penalty-item">
                <span className="dc-retreat-penalty-icon">💰</span>
                <span className="dc-retreat-penalty-text">보유 골드의 <b>10%</b> 소실</span>
              </div>
              <div className="dc-retreat-penalty-item">
                <span className="dc-retreat-penalty-icon">🗺️</span>
                <span className="dc-retreat-penalty-text">탐험 진행도 <b>초기화</b></span>
              </div>
              <div className="dc-retreat-penalty-item">
                <span className="dc-retreat-penalty-icon">📦</span>
                <span className="dc-retreat-penalty-text">미획득 보물 <b>소멸</b></span>
              </div>
            </div>

            {/* 버튼 */}
            <div className="dc-retreat-btns">
              <button className="dc-retreat-btn-yes" onClick={() => {
                setRetreatConfirm(false);
                // 패널티 적용: HP 30% 감소, 골드 10% 감소
                api.post('/battle/session/penalty', { penaltyType: 'retreat' }).catch(() => {});
                onRetreat();
              }}>
                <span className="dc-retreat-btn-shimmer" />
                그래도 후퇴하기
              </button>
              <button className="dc-retreat-btn-no" onClick={() => setRetreatConfirm(false)}>
                계속 탐험하기
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
