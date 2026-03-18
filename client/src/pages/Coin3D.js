import React, { useRef, useEffect } from 'react';
import * as THREE from 'three';

function createCoinMesh() {
  const radius = 0.6;
  const thickness = 0.06;
  const segments = 64;

  const geometry = new THREE.CylinderGeometry(radius, radius, thickness, segments);

  // 앞면 텍스처 (☀️ 태양)
  const canvasFront = document.createElement('canvas');
  canvasFront.width = 256; canvasFront.height = 256;
  const ctxF = canvasFront.getContext('2d');
  // 금색 배경
  const gradF = ctxF.createRadialGradient(128, 128, 20, 128, 128, 128);
  gradF.addColorStop(0, '#ffe066'); gradF.addColorStop(0.6, '#fbbf24'); gradF.addColorStop(1, '#b8860b');
  ctxF.fillStyle = gradF; ctxF.beginPath(); ctxF.arc(128, 128, 120, 0, Math.PI * 2); ctxF.fill();
  // 테두리
  ctxF.strokeStyle = '#8b6914'; ctxF.lineWidth = 6;
  ctxF.beginPath(); ctxF.arc(128, 128, 117, 0, Math.PI * 2); ctxF.stroke();
  // 태양 심볼
  ctxF.fillStyle = '#b8860b';
  ctxF.beginPath(); ctxF.arc(128, 128, 35, 0, Math.PI * 2); ctxF.fill();
  for (let i = 0; i < 12; i++) {
    const a = (i / 12) * Math.PI * 2;
    ctxF.beginPath();
    ctxF.moveTo(128 + Math.cos(a) * 42, 128 + Math.sin(a) * 42);
    ctxF.lineTo(128 + Math.cos(a) * 70, 128 + Math.sin(a) * 70);
    ctxF.lineWidth = i % 2 === 0 ? 6 : 3;
    ctxF.strokeStyle = '#b8860b';
    ctxF.stroke();
  }
  ctxF.fillStyle = '#ffe066';
  ctxF.beginPath(); ctxF.arc(128, 128, 22, 0, Math.PI * 2); ctxF.fill();

  // 뒷면 텍스처 (🌙 달)
  const canvasBack = document.createElement('canvas');
  canvasBack.width = 256; canvasBack.height = 256;
  const ctxB = canvasBack.getContext('2d');
  const gradB = ctxB.createRadialGradient(128, 128, 20, 128, 128, 128);
  gradB.addColorStop(0, '#d4c5f9'); gradB.addColorStop(0.6, '#a78bfa'); gradB.addColorStop(1, '#6d28d9');
  ctxB.fillStyle = gradB; ctxB.beginPath(); ctxB.arc(128, 128, 120, 0, Math.PI * 2); ctxB.fill();
  ctxB.strokeStyle = '#5b21b6'; ctxB.lineWidth = 6;
  ctxB.beginPath(); ctxB.arc(128, 128, 117, 0, Math.PI * 2); ctxB.stroke();
  // 달 심볼 (초승달)
  ctxB.fillStyle = '#e0d4fa';
  ctxB.beginPath(); ctxB.arc(128, 128, 40, 0, Math.PI * 2); ctxB.fill();
  ctxB.fillStyle = gradB;
  ctxB.beginPath(); ctxB.arc(148, 118, 38, 0, Math.PI * 2); ctxB.fill();
  // 별 장식
  for (let i = 0; i < 5; i++) {
    const sx = 60 + Math.random() * 136;
    const sy = 60 + Math.random() * 136;
    ctxB.fillStyle = '#e0d4fa';
    ctxB.beginPath(); ctxB.arc(sx, sy, 3, 0, Math.PI * 2); ctxB.fill();
  }

  // 옆면 텍스처
  const canvasSide = document.createElement('canvas');
  canvasSide.width = 256; canvasSide.height = 32;
  const ctxS = canvasSide.getContext('2d');
  const gradS = ctxS.createLinearGradient(0, 0, 0, 32);
  gradS.addColorStop(0, '#daa520'); gradS.addColorStop(0.5, '#ffd700'); gradS.addColorStop(1, '#b8860b');
  ctxS.fillStyle = gradS; ctxS.fillRect(0, 0, 256, 32);
  // 톱니 패턴
  for (let x = 0; x < 256; x += 8) {
    ctxS.fillStyle = '#aa8500'; ctxS.fillRect(x, 0, 1, 32);
  }

  const texFront = new THREE.CanvasTexture(canvasFront); texFront.colorSpace = THREE.SRGBColorSpace;
  const texBack = new THREE.CanvasTexture(canvasBack); texBack.colorSpace = THREE.SRGBColorSpace;
  const texSide = new THREE.CanvasTexture(canvasSide); texSide.colorSpace = THREE.SRGBColorSpace;

  // CylinderGeometry 면 순서: 옆면(0), 윗면(1), 아랫면(2)
  const materials = [
    new THREE.MeshStandardMaterial({ map: texSide, roughness: 0.2, metalness: 0.7 }),  // 옆면
    new THREE.MeshStandardMaterial({ map: texFront, roughness: 0.3, metalness: 0.5 }), // 윗면 (앞=태양)
    new THREE.MeshStandardMaterial({ map: texBack, roughness: 0.3, metalness: 0.5 }),  // 아랫면 (뒤=달)
  ];

  const mesh = new THREE.Mesh(geometry, materials);
  mesh.castShadow = true;
  return mesh;
}

/**
 * Coin3D - 3D 동전 컴포넌트
 * Props:
 *   flipping: boolean
 *   result: 'heads' | 'tails'
 *   width/height
 */
export default function Coin3D({ flipping, result = 'heads', width = 280, height = 200 }) {
  const mountRef = useRef(null);
  const stateRef = useRef({
    scene: null, renderer: null, camera: null,
    coin: null, animId: null,
    isFlipping: false, startTime: 0, targetResult: 'heads',
    vy: 0,
  });

  useEffect(() => {
    const el = mountRef.current;
    if (!el) return;
    const st = stateRef.current;

    const scene = new THREE.Scene();
    scene.background = new THREE.Color('#0f1320');

    const camera = new THREE.PerspectiveCamera(35, width / height, 0.1, 100);
    camera.position.set(0, 3, 3);
    camera.lookAt(0, 0.5, 0);

    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.shadowMap.enabled = true;
    el.appendChild(renderer.domElement);

    scene.add(new THREE.AmbientLight(0xffffff, 0.5));
    const dir = new THREE.DirectionalLight(0xffd700, 1.5);
    dir.position.set(2, 5, 3); dir.castShadow = true; scene.add(dir);
    const point = new THREE.PointLight(0xffa500, 0.6, 8);
    point.position.set(-2, 3, -1); scene.add(point);

    // 바닥
    const floor = new THREE.Mesh(
      new THREE.PlaneGeometry(6, 6),
      new THREE.MeshStandardMaterial({ color: 0x2a1a0a, roughness: 0.9 })
    );
    floor.rotation.x = -Math.PI / 2; floor.position.y = -0.1;
    floor.receiveShadow = true; scene.add(floor);

    // 동전
    const coin = createCoinMesh();
    coin.rotation.x = Math.PI / 2;
    coin.position.y = 0.8;
    scene.add(coin);
    st.coin = coin; st.scene = scene; st.renderer = renderer; st.camera = camera;

    // 초기 면
    coin.rotation.x = result === 'heads' ? Math.PI / 2 : -Math.PI / 2;
    coin.position.y = 0.8;

    const FLOOR_Y = 0.8;

    let lastTime = Date.now();
    const animate = () => {
      st.animId = requestAnimationFrame(animate);
      const now = Date.now();
      const dt = Math.min((now - lastTime) / 1000, 0.05);
      lastTime = now;
      const s = stateRef.current;

      if (s.isFlipping) {
        const elapsed = (now - s.startTime) / 1000;
        const duration = 3.0;
        const t = Math.min(elapsed / duration, 1);

        if (t < 0.75) {
          // 물리: 위로 올라갔다 떨어짐 + 빠른 회전
          // 높이: 포물선 (초기속도 위로, 중력으로 내려옴)
          const phase = t / 0.75; // 0~1
          const h = phase < 0.4
            ? phase / 0.4 * 3.5  // 올라가기
            : 3.5 * (1 - Math.pow((phase - 0.4) / 0.6, 2)); // 내려오기 (포물선)

          coin.position.y = Math.max(FLOOR_Y, h);

          // 회전: 빠르게 돌다가 감속
          const spinSpeed = (1 - phase * 0.7) * 25;
          coin.rotation.x += spinSpeed * dt;

          // 약간의 좌우 흔들림
          coin.position.x = Math.sin(elapsed * 3) * 0.15 * (1 - phase);
          coin.rotation.z = Math.sin(elapsed * 5) * 0.1 * (1 - phase);

        } else if (t < 0.9) {
          // 바운스: 작은 바운스 1~2회
          const bPhase = (t - 0.75) / 0.15;
          const bounceH = Math.abs(Math.sin(bPhase * Math.PI * 2)) * (1 - bPhase) * 0.5;
          coin.position.y = FLOOR_Y + bounceH;

          // 회전 감속 + 목표면 접근
          const targetX = s.targetResult === 'heads' ? Math.PI / 2 : -Math.PI / 2;
          // 아직 약간 회전
          coin.rotation.x += (1 - bPhase) * 8 * dt;
          coin.position.x += (0 - coin.position.x) * 0.1;
          coin.rotation.z += (0 - coin.rotation.z) * 0.1;

        } else {
          // 정렬: 최종 면으로 수렴
          const settle = (t - 0.9) / 0.1;
          const targetX = s.targetResult === 'heads' ? Math.PI / 2 : -Math.PI / 2;
          // 현재 rotation.x를 가장 가까운 targetX 방향으로 정렬
          const normalizedX = ((coin.rotation.x % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2);
          const candidates = [targetX, targetX + Math.PI * 2, targetX - Math.PI * 2, targetX + Math.PI * 4];
          let closest = candidates[0];
          for (const c of candidates) {
            if (Math.abs(c - coin.rotation.x) < Math.abs(closest - coin.rotation.x)) closest = c;
          }
          coin.rotation.x += (closest - coin.rotation.x) * (0.1 + settle * 0.3);
          coin.position.y += (FLOOR_Y - coin.position.y) * 0.15;
          coin.position.x += (0 - coin.position.x) * 0.15;
          coin.rotation.z += (0 - coin.rotation.z) * 0.2;
        }

        // 동전 빛나기 효과 (회전 중 반짝)
        if (dir) {
          dir.intensity = 1.5 + Math.sin(elapsed * 15) * 0.5;
        }
      } else {
        if (dir) dir.intensity = 1.5;
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

  useEffect(() => {
    const s = stateRef.current;
    if (flipping) {
      if (s.coin) {
        s.coin.position.set(0, 0.8, 0);
        s.coin.rotation.set(Math.random() * Math.PI * 2, 0, 0);
      }
      s.targetResult = result;
      s.startTime = Date.now();
      s.isFlipping = true;
    } else {
      s.isFlipping = false;
      if (s.coin) {
        s.coin.rotation.x = result === 'heads' ? Math.PI / 2 : -Math.PI / 2;
        s.coin.rotation.z = 0;
        s.coin.position.set(0, 0.8, 0);
      }
    }
  }, [flipping, result]);

  return (
    <div ref={mountRef} style={{
      width, height, margin: '0 auto', borderRadius: 12, overflow: 'hidden',
      border: '1px solid #2a2f45',
    }} />
  );
}
