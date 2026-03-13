import React, { useState, useEffect, useCallback, useRef } from 'react';
import api from '../api';
import './DungeonCrawler.css';

const CLASS_IMAGE_MAP = { '풍수사': 'pungsu', '무당': 'mudang', '승려': 'monk', '저승사자': 'reaper' };

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

  // 몬스터 배치 (실제 몬스터 템플릿 ID 배정)
  const shuffled = emptyTiles.sort(() => Math.random() - 0.5);
  const monsters = [];
  const count = Math.min(monsterCount || 5, shuffled.length);
  const pool = dbMonsters || [];
  for (let i = 0; i < count; i++) {
    const template = pool.length > 0 ? pool[Math.floor(Math.random() * pool.length)] : null;
    monsters.push({
      id: `mob_${i}`, ...shuffled[i], defeated: false,
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

  return { grid, width: W, height: H, playerStart, exitPos, monsters, treasures, isBoss: stage?.isBoss };
}

// ========== 방향 상수 ==========
const DIR = { N: 0, E: 1, S: 2, W: 3 };
const DIR_NAMES = ['북', '동', '남', '서'];
const DIR_DX = [0, 1, 0, -1];
const DIR_DY = [-1, 0, 1, 0];

// ========== 1인칭 던전 뷰 렌더링 ==========
function FirstPersonView({ maze, px, py, facing, monsters, treasures, exitPos, monsterSpeech }) {
  const dx = DIR_DX[facing];
  const dy = DIR_DY[facing];
  // 왼쪽/오른쪽/뒤 방향
  const ldx = DIR_DX[(facing + 3) % 4];
  const ldy = DIR_DY[(facing + 3) % 4];
  const rdx = DIR_DX[(facing + 1) % 4];
  const rdy = DIR_DY[(facing + 1) % 4];
  const bdx = DIR_DX[(facing + 2) % 4];
  const bdy = DIR_DY[(facing + 2) % 4];

  const isWall = (x, y) => {
    if (x < 0 || x >= maze.width || y < 0 || y >= maze.height) return true;
    return maze.grid[y][x] === 1;
  };

  // 최대 시야 거리 4칸
  const depth = 4;
  const layers = [];
  for (let d = 1; d <= depth; d++) {
    const fx = px + dx * d;
    const fy = py + dy * d;
    const lx = fx + ldx;
    const ly = fy + ldy;
    const rx = fx + rdx;
    const ry = fy + rdy;

    layers.push({
      depth: d,
      front: isWall(fx, fy),
      left: isWall(lx, ly),
      right: isWall(rx, ry),
      // 전방의 몬스터 객체 (monsterId 포함)
      monster: monsters.find(m => !m.defeated && m.x === fx && m.y === fy) || null,
      hasTreasure: treasures.some(t => !t.collected && t.x === fx && t.y === fy),
      isExit: exitPos.x === fx && exitPos.y === fy,
    });
    if (layers[layers.length - 1].front) break;
  }

  // 현재 칸에 있는 것들
  const hereMonster = monsters.find(m => !m.defeated && m.x === px && m.y === py);
  const hereTreasure = treasures.find(t => !t.collected && t.x === px && t.y === py);
  const hereExit = exitPos.x === px && exitPos.y === py;

  // 전방 시야 거리 계산 (벽까지 몇 칸)
  const viewDepth = layers.length > 0 && layers[layers.length - 1].front
    ? layers[layers.length - 1].depth
    : depth + 1; // 벽이 안 보이면 멀리

  // 전방 가장 가까운 벽
  const frontWall = layers.find(l => l.front);

  return (
    <div className="dc-fpv">
      {/* 메인 던전 복도 배경 */}
      <img src="/ui/dungeon/dc_corridor_bg.png" alt="" className="dc-fpv-bg" />

      {/* 깊이 안개 - 전방이 가까울수록 어둡게 */}
      <div className="dc-fpv-depth-fog" style={{
        opacity: frontWall ? Math.min(0.85, 0.3 + (1 - frontWall.depth / 5) * 0.6) : 0.1,
      }} />

      {/* 전방 벽이 가까우면 (depth 1~3) 벽 텍스처 표시 */}
      {frontWall && frontWall.depth <= 3 && (
        <div
          className={`dc-fpv-deadend depth-${frontWall.depth}`}
          style={{ backgroundImage: `url(${process.env.PUBLIC_URL}/ui/dungeon/dc_wall_front.png)` }}
        />
      )}

      {/* 전방 오브젝트 (깊이별) */}
      {layers.map(layer => {
        const d = layer.depth;
        const scale = 1 / d;
        const shade = Math.max(0.4, 1 - d * 0.15);

        if (layer.front || d > 3) return null;
        return (
          <React.Fragment key={`ent-${d}`}>
            {layer.monster && (
              <div className="dc-fpv-entity monster" style={{
                left: '50%', bottom: `${20 + d * 5}%`,
                transform: `translateX(-50%) scale(${scale * 1.4})`,
                opacity: shade, zIndex: 10 - d,
              }}>
                {monsterSpeech && monsterSpeech.mobId === layer.monster.id && (
                  <div className="dc-monster-speech">
                    <span>{monsterSpeech.text}</span>
                  </div>
                )}
                <div className="dc-entity-shadow" />
                {layer.monster.monsterId ? (
                  <img
                    src={`/monsters_nobg/${layer.monster.monsterId}_full.png`}
                    alt={layer.monster.monsterName || ''}
                    className="dc-entity-monster-img"
                    onError={e => { e.target.onerror = null; e.target.src = `/monsters/${layer.monster.monsterId}_full.png`; }}
                  />
                ) : (
                  <div className="dc-entity-monster-placeholder">👹</div>
                )}
              </div>
            )}
            {layer.hasTreasure && (
              <div className="dc-fpv-entity treasure" style={{
                left: '50%', bottom: `${15 + d * 5}%`,
                transform: `translateX(-50%) scale(${scale * 1.2})`,
                opacity: shade, zIndex: 10 - d,
              }}>
                <img src="/ui/dungeon/dc_treasure_nobg.png" alt="" className="dc-entity-img" onError={e => { e.target.onerror = null; e.target.src = '/ui/dungeon/dc_treasure.png'; }} />
              </div>
            )}
            {layer.isExit && (
              <div className="dc-fpv-entity exit" style={{
                left: '50%', bottom: `${18 + d * 5}%`,
                transform: `translateX(-50%) scale(${scale * 1.4})`,
                opacity: shade, zIndex: 10 - d,
              }}>
                <img src="/ui/dungeon/dc_exit_nobg.png" alt="" className="dc-entity-img" onError={e => { e.target.onerror = null; e.target.src = '/ui/dungeon/dc_exit.png'; }} />
              </div>
            )}
          </React.Fragment>
        );
      })}

      {/* 현재 위치 오브젝트 */}
      {hereMonster && (
        <div className="dc-fpv-here-entity monster">
          {monsterSpeech && monsterSpeech.mobId === hereMonster.id && (
            <div className="dc-monster-speech here">
              <span>{monsterSpeech.text}</span>
            </div>
          )}
          {hereMonster.monsterId ? (
            <img
              src={`/monsters_nobg/${hereMonster.monsterId}_full.png`}
              alt={hereMonster.monsterName || ''}
              className="dc-here-entity-img"
              onError={e => { e.target.onerror = null; e.target.src = `/monsters/${hereMonster.monsterId}_full.png`; }}
            />
          ) : (
            <div className="dc-here-entity-placeholder">⚔️</div>
          )}
          <span className="dc-here-label">적과 조우!</span>
        </div>
      )}
      {hereTreasure && (
        <div className="dc-fpv-here-entity treasure">
          <img src="/ui/dungeon/dc_treasure_nobg.png" alt="" className="dc-here-entity-img" onError={e => { e.target.onerror = null; e.target.src = '/ui/dungeon/dc_treasure.png'; }} />
          <span className="dc-here-label">보물 발견!</span>
        </div>
      )}
      {hereExit && (
        <div className="dc-fpv-here-entity exit">
          <img src="/ui/dungeon/dc_exit_nobg.png" alt="" className="dc-here-entity-img" onError={e => { e.target.onerror = null; e.target.src = '/ui/dungeon/dc_exit.png'; }} />
          <span className="dc-here-label">출구 발견!</span>
        </div>
      )}

      {/* 나침반 */}
      <div className="dc-compass">
        <span className="dc-compass-dir">{DIR_NAMES[facing]}</span>
      </div>

      {/* 이동 가능 방향 화살표 */}
      <div className="dc-dir-arrows">
        {!isWall(px + dx, py + dy) && <div className="dc-dir-arrow forward">▲</div>}
        {!isWall(px + ldx, py + ldy) && <div className="dc-dir-arrow left">◀</div>}
        {!isWall(px + rdx, py + rdy) && <div className="dc-dir-arrow right">▶</div>}
        {!isWall(px + bdx, py + bdy) && <div className="dc-dir-arrow back">▼</div>}
      </div>

      {/* 먼지 파티클 */}
      <div className="dc-dust-particles">
        {[...Array(8)].map((_, i) => <div key={i} className="dc-dust" style={{ '--d': i }} />)}
      </div>

      {/* 횃불 이미지 (투명 배경) */}
      <div className="dc-torch-wrap left">
        <img src="/ui/dungeon/dc_torch_nobg.png" alt="" className="dc-torch-image"
          onError={e => { e.target.style.display = 'none'; }} />
        <div className="dc-torch-glow" />
      </div>
      <div className="dc-torch-wrap right">
        <img src="/ui/dungeon/dc_torch_nobg.png" alt="" className="dc-torch-image"
          onError={e => { e.target.style.display = 'none'; }} />
        <div className="dc-torch-glow" />
      </div>

      {/* 비네팅 */}
      <div className="dc-fpv-vignette" />
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
          {isExplored && monster && <div className="dc-mm-monster" />}
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
  const logRef = useRef(null);
  const keyLock = useRef(false);
  const speechTimer = useRef(null);
  const monsterSpeechTimer = useRef(null);
  const initDone = useRef(false);

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
        if (character) rParty.push({ id: 'player', name: character.name });
        (activeSummons || []).forEach(s => rParty.push({ id: `summon_${s.id}`, name: s.name }));
        (activeMercenaries || []).forEach(m => rParty.push({ id: `merc_${m.id}`, name: m.name }));
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

    // 출구 체크 (숨겨진 적은 필수 처치 대상 아님)
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
    { type: 'npc', text: '꺼진 줄 알았던 횃불이 갑자기 타올랐다!', img: '/ui/dungeon/dc_torch_img.png' },
    { type: 'ghost', text: '벽에 새겨진 경고문이 붉게 빛난다...', img: '/ui/dungeon/dc_wall_runes.png' },
    { type: 'npc', text: '박쥐 떼가 천장에서 날아올랐다!', img: '/ui/dungeon/dc_bats.png' },
    { type: 'ghost', text: '갑자기 안개가 짙어졌다가 걷혔다.', img: '/ui/dungeon/dc_fog_overlay.png' },
    { type: 'npc', text: '이상한 버섯이 빛나고 있다... 건드리지 않는 게 좋겠다.', img: '/ui/dungeon/dc_mushroom.png' },
    { type: 'ghost', text: '누군가 지켜보고 있는 느낌이 든다...', img: '/ui/dungeon/dc_ghost.png' },
  ];

  // 이동할 때마다 랜덤 이벤트 발생
  useEffect(() => {
    if (!maze || stepCount === 0) return;

    // 15% 확률로 말풍선
    if (Math.random() < 0.15) {
      const party = [];
      if (character) party.push({ id: 'player', name: character.name });
      (activeSummons || []).forEach(s => party.push({ id: `summon_${s.id}`, name: s.name }));
      (activeMercenaries || []).forEach(m => party.push({ id: `merc_${m.id}`, name: m.name }));

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
        (activeSummons || []).forEach(s => aParty.push({ id: `summon_${s.id}`, name: s.name }));
        (activeMercenaries || []).forEach(m => aParty.push({ id: `merc_${m.id}`, name: m.name }));
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
        const dist = Math.abs(mob.x - pos.x) + Math.abs(mob.y - pos.y);
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

  const visibleMonsters = monsters.filter(m => !m.hidden);
  const allDefeated = visibleMonsters.every(m => m.defeated);
  const defeatedCount = visibleMonsters.filter(m => m.defeated).length;

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
              <span className="dc-info-val">{defeatedCount}/{visibleMonsters.length}</span>
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

        <div className={`dc-upper-right ${moveAnim ? `dc-move-${moveAnim}` : ''}`}>
          <FirstPersonView
            maze={maze} px={pos.x} py={pos.y} facing={facing}
            monsters={monsters.filter(m => !m.hidden)} treasures={treasures} exitPos={maze.exitPos}
            monsterSpeech={monsterSpeech}
          />
          {/* 이동 시 좌우 휙 지나가는 선 효과 */}
          {moveAnim === 'forward' && (
            <div className="dc-speed-lines">
              <div className="dc-speed-line left" />
              <div className="dc-speed-line right" />
              <div className="dc-speed-line left delay" />
              <div className="dc-speed-line right delay" />
            </div>
          )}
          {moveAnim === 'back' && (
            <div className="dc-speed-lines back">
              <div className="dc-speed-line left" />
              <div className="dc-speed-line right" />
            </div>
          )}
        </div>
      </div>

      {/* 하단: 컨트롤 + 파티 */}
      <div className="dc-lower">
        <div className="dc-controls" style={{ backgroundImage: `url(${process.env.PUBLIC_URL}/ui/dungeon/dc_controls_bg.png)` }}>
          <div className="dc-controls-overlay" />
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
            <button className="dc-retreat-btn" onClick={() => setRetreatConfirm(true)}>🏃 귀환</button>
          </div>
        </div>

        {/* 파티 바 */}
        <div className="dc-party-bar" style={{ backgroundImage: `url(${process.env.PUBLIC_URL}/ui/dungeon/dc_party_bg.png)` }}>
          {(() => {
            const party = [];
            // 플레이어
            if (character) {
              party.push({
                id: 'player', name: character.name, level: charState?.level || character.level,
                hp: charState?.currentHp ?? character.current_hp, maxHp: charState?.maxHp ?? character.hp,
                mp: charState?.currentMp ?? character.current_mp, maxMp: charState?.maxMp ?? character.mp,
                imageUrl: `/characters/${CLASS_IMAGE_MAP[character.class_type] || 'monk'}_icon.png`,
                type: 'player', classType: character.class_type,
              });
            }
            // 소환수
            (activeSummons || []).forEach(s => {
              const tid = s.template_id || s.summon_id || s.id;
              party.push({
                id: `summon_${s.id}`, name: s.name, level: s.level,
                hp: s.current_hp ?? s.hp, maxHp: s.hp, mp: s.current_mp ?? s.mp ?? 0, maxMp: s.mp ?? 0,
                imageUrl: `/summons_nobg/${tid}_icon.png`, type: 'summon',
              });
            });
            // 용병
            (activeMercenaries || []).forEach(m => {
              const tid = m.template_id || m.id;
              party.push({
                id: `merc_${m.id}`, name: m.name, level: m.level,
                hp: m.current_hp ?? m.hp, maxHp: m.hp, mp: m.current_mp ?? m.mp ?? 0, maxMp: m.mp ?? 0,
                imageUrl: `/mercenaries/${tid}_icon.png`, type: 'mercenary',
              });
            });
            return party.map(ally => {
              const hpPct = ally.maxHp > 0 ? Math.max(0, (ally.hp / ally.maxHp) * 100) : 0;
              const mpPct = ally.maxMp > 0 ? Math.max(0, (ally.mp / ally.maxMp) * 100) : 0;
              return (
                <div key={ally.id} className={`dc-party-member ${hpPct < 30 ? 'low-hp' : ''}`} onClick={() => openInspect(ally)}>
                  {speechBubble && speechBubble.allyId === ally.id && (
                    <div className="dc-speech-bubble">
                      <span>{speechBubble.text}</span>
                    </div>
                  )}
                  <div className="dc-party-portrait">
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
          <img src="/ui/dungeon/dc_ambush_bg.png" alt="" className="dc-ambush-bg-img" />
          <div className="dc-ambush-flash" />
          <div className="dc-ambush-text">⚠️ 기척!</div>
        </div>
      )}

      {/* 보물 발견 팝업 */}
      {treasurePopup && (
        <div className="dc-treasure-popup">
          <div className="dc-treasure-popup-inner">
            <div className="dc-treasure-glow" />
            <img src="/ui/dungeon/dc_treasure_popup_bg.png" alt="" className="dc-treasure-popup-bg"
              onError={e => { e.target.style.display = 'none'; }} />
            <div className="dc-treasure-chest-wrap">
              <img src="/ui/dungeon/dc_treasure.png" alt="" className="dc-treasure-chest-img" />
              <div className="dc-treasure-sparkles">
                {[...Array(12)].map((_, i) => (
                  <div key={i} className="dc-treasure-sparkle" style={{ '--i': i }} />
                ))}
              </div>
            </div>
            <div className="dc-treasure-title">보물 발견!</div>
            <div className="dc-treasure-gold">
              <span className="dc-treasure-gold-icon">💰</span>
              <span className="dc-treasure-gold-amount">+{treasurePopup.gold}G</span>
            </div>
            <div className="dc-treasure-rays" />
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
                  <button className="dc-exit-btn clear" onClick={() => { setExitPopup(null); if (onClear) onClear(); }}>
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

      {/* 귀환 확인 팝업 */}
      {retreatConfirm && (
        <div className="dc-retreat-confirm-overlay" onClick={() => setRetreatConfirm(false)}>
          <div className="dc-retreat-confirm" onClick={e => e.stopPropagation()}>
            <img src="/ui/dungeon/dc_retreat_bg.png" alt="" className="dc-retreat-confirm-bg"
              onError={e => { e.target.style.display = 'none'; }} />
            <div className="dc-retreat-confirm-content">
              <div className="dc-retreat-confirm-icon">🏃</div>
              <div className="dc-retreat-confirm-title">던전 귀환</div>
              <div className="dc-retreat-confirm-desc">정말 던전에서 귀환하시겠습니까?<br/>진행 중인 탐험이 초기화됩니다.</div>
              <div className="dc-retreat-confirm-btns">
                <button className="dc-retreat-confirm-yes" onClick={() => { setRetreatConfirm(false); onRetreat(); }}>귀환하기</button>
                <button className="dc-retreat-confirm-no" onClick={() => setRetreatConfirm(false)}>계속 탐험</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
