import React, { useRef, useEffect } from 'react';
import * as THREE from 'three';

const FACE_ROTATIONS = {
  1: { x: 0, z: 0 },             // +Y 위 (기본)
  2: { x: -Math.PI / 2, z: 0 },  // +Z → 위
  3: { x: 0, z: -Math.PI / 2 },  // +X → 위
  4: { x: 0, z: Math.PI / 2 },   // -X → 위
  5: { x: Math.PI / 2, z: 0 },   // -Z → 위
  6: { x: Math.PI, z: 0 },       // -Y → 위
};

function createDiceMesh() {
  const size = 1;
  const geometry = new THREE.BoxGeometry(size, size, size, 4, 4, 4);
  const pos = geometry.attributes.position;
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i), y = pos.getY(i), z = pos.getZ(i);
    const half = size / 2;
    const nx = Math.max(-half, Math.min(half, x));
    const ny = Math.max(-half, Math.min(half, y));
    const nz = Math.max(-half, Math.min(half, z));
    const dx = x - nx, dy = y - ny, dz = z - nz;
    const d = Math.sqrt(dx * dx + dy * dy + dz * dz);
    if (d > 0.01) {
      const s = 0.12 / d;
      pos.setXYZ(i, nx + dx * s, ny + dy * s, nz + dz * s);
    }
  }
  geometry.computeVertexNormals();

  const dotPositions = {
    1: [[0.5, 0.5]],
    2: [[0.25, 0.25], [0.75, 0.75]],
    3: [[0.25, 0.25], [0.5, 0.5], [0.75, 0.75]],
    4: [[0.25, 0.25], [0.75, 0.25], [0.25, 0.75], [0.75, 0.75]],
    5: [[0.25, 0.25], [0.75, 0.25], [0.5, 0.5], [0.25, 0.75], [0.75, 0.75]],
    6: [[0.25, 0.25], [0.75, 0.25], [0.25, 0.5], [0.75, 0.5], [0.25, 0.75], [0.75, 0.75]],
  };
  const faceOrder = [4, 3, 1, 6, 2, 5];
  const materials = [];

  for (let i = 0; i < 6; i++) {
    const face = faceOrder[i];
    const canvas = document.createElement('canvas');
    canvas.width = 256; canvas.height = 256;
    const ctx = canvas.getContext('2d');
    const grad = ctx.createRadialGradient(128, 128, 20, 128, 128, 180);
    grad.addColorStop(0, '#e8dcc8'); grad.addColorStop(1, '#c4b49a');
    ctx.fillStyle = grad; ctx.fillRect(0, 0, 256, 256);
    ctx.strokeStyle = '#8b7355'; ctx.lineWidth = 4; ctx.strokeRect(4, 4, 248, 248);
    for (const [dx, dy] of dotPositions[face]) {
      ctx.beginPath();
      ctx.arc(dx * 220 + 18, dy * 220 + 18, 18, 0, Math.PI * 2);
      ctx.fillStyle = face === 1 ? '#cc3333' : '#1a1a1a';
      ctx.fill();
    }
    const texture = new THREE.CanvasTexture(canvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    materials.push(new THREE.MeshStandardMaterial({ map: texture, roughness: 0.3, metalness: 0.1 }));
  }

  const mesh = new THREE.Mesh(geometry, materials);
  mesh.castShadow = true;
  return mesh;
}

export default function Dice3D({ rolling, result = [1, 1], width = 280, height = 180 }) {
  const mountRef = useRef(null);
  const stateRef = useRef({
    scene: null, renderer: null, camera: null,
    dice: [null, null], animId: null,
    isRolling: false, startTime: 0, targetResult: [1, 1],
  });

  // 초기화 (한 번만)
  useEffect(() => {
    const el = mountRef.current;
    if (!el) return;

    const st = stateRef.current;
    const scene = new THREE.Scene();
    scene.background = new THREE.Color('#0f1320');

    const camera = new THREE.PerspectiveCamera(40, width / height, 0.1, 100);
    camera.position.set(0, 4.5, 4.5);
    camera.lookAt(0, 0, 0);

    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.shadowMap.enabled = true;
    el.appendChild(renderer.domElement);

    scene.add(new THREE.AmbientLight(0xffffff, 0.6));
    const dir = new THREE.DirectionalLight(0xffd700, 1.2);
    dir.position.set(3, 5, 3); dir.castShadow = true;
    scene.add(dir);
    scene.add(new THREE.PointLight(0xff6600, 0.8, 10).translateX(-2).translateY(3));

    const floor = new THREE.Mesh(
      new THREE.PlaneGeometry(8, 8),
      new THREE.MeshStandardMaterial({ color: 0x3a2a1a, roughness: 0.8 })
    );
    floor.rotation.x = -Math.PI / 2; floor.position.y = -0.5;
    floor.receiveShadow = true; scene.add(floor);

    const d1 = createDiceMesh(); d1.position.set(-0.8, 0, 0); scene.add(d1);
    const d2 = createDiceMesh(); d2.position.set(0.8, 0, 0); scene.add(d2);

    st.scene = scene; st.renderer = renderer; st.camera = camera;
    st.dice = [d1, d2];

    // 초기 면
    const r1 = FACE_ROTATIONS[result[0]] || FACE_ROTATIONS[1];
    const r2 = FACE_ROTATIONS[result[1]] || FACE_ROTATIONS[1];
    d1.rotation.set(r1.x, 0, r1.z);
    d2.rotation.set(r2.x, 0, r2.z);

    // 주사위별 물리 상태
    const physics = [
      { vx: 0, vy: 0, vz: 0, vrx: 0, vry: 0, vrz: 0, grounded: false },
      { vx: 0, vy: 0, vz: 0, vrx: 0, vry: 0, vrz: 0, grounded: false },
    ];
    st.physics = physics;

    const GRAVITY = -9.8;
    const FLOOR_Y = 0;
    const BOUNCE = 0.4;     // 바운스 계수
    const FRICTION = 0.97;  // 마찰
    const ROT_FRICTION = 0.96;
    const SETTLE_SPEED = 0.08; // 최종 정렬 속도

    // 렌더 루프
    let lastTime = Date.now();
    const animate = () => {
      st.animId = requestAnimationFrame(animate);
      const now = Date.now();
      const dt = Math.min((now - lastTime) / 1000, 0.05); // 최대 50ms
      lastTime = now;
      const s = stateRef.current;

      if (s.isRolling) {
        const elapsed = (now - s.startTime) / 1000;
        const duration = 4.0;
        const t = Math.min(elapsed / duration, 1);

        for (let i = 0; i < 2; i++) {
          const dice = s.dice[i];
          const p = physics[i];
          if (!dice) continue;
          const tr = FACE_ROTATIONS[s.targetResult[i]] || FACE_ROTATIONS[1];

          if (t < 0.85) {
            // 물리 시뮬레이션
            // 중력
            p.vy += GRAVITY * dt;

            // 위치 업데이트
            dice.position.x += p.vx * dt;
            dice.position.y += p.vy * dt;
            dice.position.z += p.vz * dt;

            // 바닥 충돌
            if (dice.position.y <= FLOOR_Y) {
              dice.position.y = FLOOR_Y;
              if (p.vy < -0.5) {
                // 바운스
                p.vy = -p.vy * BOUNCE;
                // 바운스할 때 약간의 랜덤 수평 속도 추가
                p.vx += (Math.random() - 0.5) * 0.8;
                p.vz += (Math.random() - 0.5) * 0.6;
                // 바운스할 때 회전 추가
                p.vrx += (Math.random() - 0.5) * 3;
                p.vrz += (Math.random() - 0.5) * 2;
              } else {
                p.vy = 0;
              }
            }

            // 마찰 (바닥에 닿았을 때만)
            if (dice.position.y <= FLOOR_Y + 0.01) {
              p.vx *= FRICTION;
              p.vz *= FRICTION;
              p.vrx *= ROT_FRICTION;
              p.vry *= ROT_FRICTION;
              p.vrz *= ROT_FRICTION;
            }

            // 회전 업데이트
            dice.rotation.x += p.vrx * dt;
            dice.rotation.y += p.vry * dt;
            dice.rotation.z += p.vrz * dt;

            // 벽 바운스 (테이블 범위)
            const homeX = i === 0 ? -0.8 : 0.8;
            if (Math.abs(dice.position.x - homeX) > 1.5) {
              p.vx *= -0.5;
              dice.position.x = homeX + Math.sign(dice.position.x - homeX) * 1.5;
            }
            if (Math.abs(dice.position.z) > 1.0) {
              p.vz *= -0.5;
              dice.position.z = Math.sign(dice.position.z) * 1.0;
            }

          } else {
            // 정렬 단계: 목표 회전/위치로 부드럽게 수렴
            const lerpSpeed = SETTLE_SPEED + (t - 0.85) * 0.5; // 점점 빨라짐

            // 목표 회전으로 정렬 (최단 경로)
            dice.rotation.x += (tr.x - dice.rotation.x) * lerpSpeed;
            dice.rotation.y += (0 - dice.rotation.y) * lerpSpeed;
            dice.rotation.z += (tr.z - dice.rotation.z) * lerpSpeed;

            // 목표 위치로
            const homeX = i === 0 ? -0.8 : 0.8;
            dice.position.x += (homeX - dice.position.x) * lerpSpeed;
            dice.position.y += (FLOOR_Y - dice.position.y) * lerpSpeed;
            dice.position.z += (0 - dice.position.z) * lerpSpeed;
          }
        }
      }

      renderer.render(scene, camera);
    };
    animate();

    return () => {
      cancelAnimationFrame(st.animId);
      if (el.contains(renderer.domElement)) el.removeChild(renderer.domElement);
      renderer.forceContextLoss();
      renderer.dispose();
    };
  }, []); // eslint-disable-line

  // rolling 변경 감지
  useEffect(() => {
    const s = stateRef.current;
    if (rolling) {
      for (let i = 0; i < 2; i++) {
        if (s.dice[i]) {
          // 시작 위치: 위에서 약간 다른 높이
          s.dice[i].position.set(
            (i === 0 ? -0.5 : 0.5) + (Math.random() - 0.5) * 0.5,
            2.5 + Math.random() * 0.5,
            -0.5 + Math.random() * 0.3
          );
          s.dice[i].rotation.set(Math.random() * Math.PI * 2, Math.random() * Math.PI * 2, Math.random() * Math.PI * 2);

          // 초기 속도: 던지는 느낌
          if (s.physics && s.physics[i]) {
            s.physics[i].vx = (Math.random() - 0.5) * 2;
            s.physics[i].vy = -1 + Math.random() * 2;  // 약간 위로 or 아래로
            s.physics[i].vz = (Math.random() - 0.5) * 1.5;
            s.physics[i].vrx = (Math.random() - 0.5) * 15; // 빠른 회전
            s.physics[i].vry = (Math.random() - 0.5) * 12;
            s.physics[i].vrz = (Math.random() - 0.5) * 10;
          }
        }
      }
      s.targetResult = result;
      s.startTime = Date.now();
      s.isRolling = true;
    } else {
      s.isRolling = false;
      // 면 고정
      for (let i = 0; i < 2; i++) {
        if (s.dice[i]) {
          const r = FACE_ROTATIONS[result[i]] || FACE_ROTATIONS[1];
          s.dice[i].rotation.set(r.x, 0, r.z);
          s.dice[i].position.set(i === 0 ? -0.8 : 0.8, 0, 0);
        }
      }
    }
  }, [rolling, result]);

  return (
    <div ref={mountRef} style={{
      width, height, margin: '0 auto', borderRadius: 12, overflow: 'hidden',
      border: '1px solid #2a2f45',
    }} />
  );
}
