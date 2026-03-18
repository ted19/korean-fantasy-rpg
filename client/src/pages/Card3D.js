import React, { useRef, useEffect } from 'react';
import * as THREE from 'three';

function createCardTexture(number, isFront = true) {
  const canvas = document.createElement('canvas');
  canvas.width = 256; canvas.height = 384;
  const ctx = canvas.getContext('2d');

  if (!isFront) {
    // 뒷면: 장식 패턴
    const grad = ctx.createLinearGradient(0, 0, 256, 384);
    grad.addColorStop(0, '#1a0a2e'); grad.addColorStop(0.5, '#2d1b69'); grad.addColorStop(1, '#1a0a2e');
    ctx.fillStyle = grad; ctx.fillRect(0, 0, 256, 384);
    // 테두리
    ctx.strokeStyle = '#fbbf24'; ctx.lineWidth = 6;
    ctx.strokeRect(8, 8, 240, 368);
    ctx.strokeStyle = '#fbbf2460'; ctx.lineWidth = 2;
    ctx.strokeRect(16, 16, 224, 352);
    // 중앙 문양
    ctx.fillStyle = '#fbbf2440';
    ctx.beginPath(); ctx.arc(128, 192, 60, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#fbbf2430';
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2;
      ctx.beginPath();
      ctx.arc(128 + Math.cos(a) * 45, 192 + Math.sin(a) * 45, 15, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.fillStyle = '#fbbf24';
    ctx.font = 'bold 32px serif';
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText('?', 128, 192);
    return canvas;
  }

  // 앞면: 숫자 카드
  const colors = {
    1: '#ef4444', 2: '#f97316', 3: '#fbbf24', 4: '#22c55e', 5: '#3b82f6',
    6: '#8b5cf6', 7: '#ec4899', 8: '#14b8a6', 9: '#f59e0b', 10: '#dc2626',
  };
  const color = colors[number] || '#fbbf24';

  // 배경
  const grad = ctx.createRadialGradient(128, 192, 30, 128, 192, 250);
  grad.addColorStop(0, '#ffffff'); grad.addColorStop(0.4, '#f5f0e8'); grad.addColorStop(1, '#e8dcc8');
  ctx.fillStyle = grad; ctx.fillRect(0, 0, 256, 384);

  // 테두리
  ctx.strokeStyle = color; ctx.lineWidth = 6;
  ctx.strokeRect(6, 6, 244, 372);
  ctx.strokeStyle = color + '40'; ctx.lineWidth = 2;
  ctx.strokeRect(14, 14, 228, 356);

  // 중앙 큰 숫자
  ctx.fillStyle = color;
  ctx.font = `bold ${number === 10 ? 100 : 130}px serif`;
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.shadowColor = color + '60'; ctx.shadowBlur = 20;
  ctx.fillText(String(number), 128, 200);
  ctx.shadowBlur = 0;

  // 좌상단/우하단 작은 숫자
  ctx.font = 'bold 28px serif';
  ctx.fillText(String(number), 30, 40);
  ctx.save();
  ctx.translate(226, 350);
  ctx.rotate(Math.PI);
  ctx.fillText(String(number), 0, 0);
  ctx.restore();

  // 장식
  ctx.fillStyle = color + '20';
  ctx.beginPath(); ctx.arc(128, 200, 80, 0, Math.PI * 2); ctx.fill();

  return canvas;
}

function createCardMesh(number) {
  const w = 1.0, h = 1.5, depth = 0.04;
  const geometry = new THREE.BoxGeometry(w, h, depth);

  const frontTex = new THREE.CanvasTexture(createCardTexture(number, true));
  frontTex.colorSpace = THREE.SRGBColorSpace;
  const backTex = new THREE.CanvasTexture(createCardTexture(number, false));
  backTex.colorSpace = THREE.SRGBColorSpace;

  const sideMat = new THREE.MeshStandardMaterial({ color: 0xe8dcc8, roughness: 0.5 });

  // BoxGeometry 면 순서: +x, -x, +y, -y, +z(앞), -z(뒤)
  const materials = [
    sideMat, sideMat, sideMat, sideMat,
    new THREE.MeshStandardMaterial({ map: frontTex, roughness: 0.4 }),   // +z = 앞면
    new THREE.MeshStandardMaterial({ map: backTex, roughness: 0.4 }),    // -z = 뒷면
  ];

  const mesh = new THREE.Mesh(geometry, materials);
  mesh.castShadow = true;
  return mesh;
}

/**
 * Card3D - 3D 하이로우 카드
 * Props:
 *   flipping: boolean
 *   number: 1~10 (현재 표시할 숫자)
 *   prevNumber: 이전 숫자 (뒤집기 전 보여줄 숫자)
 *   width/height
 */
export default function Card3D({ flipping, number = 1, prevNumber, width = 200, height = 250 }) {
  const mountRef = useRef(null);
  const stateRef = useRef({
    scene: null, renderer: null, camera: null,
    card: null, animId: null,
    isFlipping: false, startTime: 0, targetNumber: 1,
  });

  useEffect(() => {
    const el = mountRef.current;
    if (!el) return;
    const st = stateRef.current;

    const scene = new THREE.Scene();
    scene.background = new THREE.Color('#0f1320');

    const camera = new THREE.PerspectiveCamera(30, width / height, 0.1, 100);
    camera.position.set(0, 0, 4);
    camera.lookAt(0, 0, 0);

    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.shadowMap.enabled = true;
    el.appendChild(renderer.domElement);

    scene.add(new THREE.AmbientLight(0xffffff, 0.7));
    const dir = new THREE.DirectionalLight(0xffd700, 1.0);
    dir.position.set(2, 3, 4); dir.castShadow = true; scene.add(dir);
    const rim = new THREE.PointLight(0x6366f1, 0.5, 10);
    rim.position.set(-3, 2, -2); scene.add(rim);

    const card = createCardMesh(number);
    scene.add(card);
    st.card = card; st.scene = scene; st.renderer = renderer; st.camera = camera;

    let lastTime = Date.now();
    const animate = () => {
      st.animId = requestAnimationFrame(animate);
      const now = Date.now();
      const s = stateRef.current;

      if (s.isFlipping) {
        const elapsed = (now - s.startTime) / 1000;
        const duration = 1.2;
        const t = Math.min(elapsed / duration, 1);

        // 3단계: 뒤집기 시작 → 중간(뒷면) → 앞면 공개
        if (t < 0.15) {
          // 준비: 살짝 뒤로 기울이며 올라감
          const p = t / 0.15;
          card.rotation.x = -0.1 * p;
          card.position.y = p * 0.3;
          card.position.z = -p * 0.3;
        } else if (t < 0.65) {
          // 빠른 회전 (뒤집기)
          const p = (t - 0.15) / 0.5;
          const easeP = 1 - Math.pow(1 - p, 2);
          card.rotation.y = easeP * Math.PI;
          card.position.y = 0.3 + Math.sin(p * Math.PI) * 0.4;
          card.position.z = -0.3 + p * 0.3;
          card.rotation.x = -0.1 * (1 - p);

          // 중간 지점에서 텍스처 교체 (뒷면→앞면)
          if (p > 0.5 && !s.textureSwapped) {
            const frontTex = new THREE.CanvasTexture(createCardTexture(s.targetNumber, true));
            frontTex.colorSpace = THREE.SRGBColorSpace;
            card.material[4].map = frontTex;
            card.material[4].needsUpdate = true;
            s.textureSwapped = true;
          }
        } else {
          // 안착: 부드럽게 정위치
          const p = (t - 0.65) / 0.35;
          const easeP = 1 - Math.pow(1 - p, 3);
          card.rotation.y = Math.PI + easeP * Math.PI; // 한 바퀴 완성
          card.position.y = 0.3 * (1 - easeP) + Math.sin(p * Math.PI * 2) * 0.05 * (1 - p);
          card.position.z = 0;
          card.rotation.x = 0;

          // 약간의 흔들림
          card.rotation.z = Math.sin(p * Math.PI * 4) * 0.02 * (1 - p);
        }

        if (t >= 1) {
          card.rotation.set(0, 0, 0);
          card.position.set(0, 0, 0);
          s.isFlipping = false;
        }
      } else {
        // idle: 미세한 호흡 애니메이션
        const idle = Date.now() * 0.001;
        card.rotation.y = Math.sin(idle * 0.5) * 0.03;
        card.position.y = Math.sin(idle * 0.8) * 0.02;
      }

      renderer.render(scene, camera);
      lastTime = now;
    };
    animate();

    return () => {
      cancelAnimationFrame(st.animId);
      if (el.contains(renderer.domElement)) el.removeChild(renderer.domElement);
      renderer.forceContextLoss();
      renderer.dispose();
    };
  }, []); // eslint-disable-line

  // flipping 시작
  useEffect(() => {
    const s = stateRef.current;
    if (flipping) {
      // 뒷면 텍스처로 시작
      if (s.card) {
        const backTex = new THREE.CanvasTexture(createCardTexture(number, false));
        backTex.colorSpace = THREE.SRGBColorSpace;
        s.card.material[4].map = backTex;
        s.card.material[4].needsUpdate = true;
        s.card.rotation.set(0, 0, 0);
        s.card.position.set(0, 0, 0);
      }
      s.targetNumber = number;
      s.textureSwapped = false;
      s.startTime = Date.now();
      s.isFlipping = true;
    } else if (s.card) {
      // number=0이면 뒷면, 아니면 앞면
      if (number === 0) {
        const backTex = new THREE.CanvasTexture(createCardTexture(0, false));
        backTex.colorSpace = THREE.SRGBColorSpace;
        s.card.material[4].map = backTex;
        s.card.material[4].needsUpdate = true;
        s.card.rotation.set(0, 0, 0);
        s.card.position.set(0, 0, 0);
        return;
      }
      const frontTex = new THREE.CanvasTexture(createCardTexture(number, true));
      frontTex.colorSpace = THREE.SRGBColorSpace;
      s.card.material[4].map = frontTex;
      s.card.material[4].needsUpdate = true;
      s.card.rotation.set(0, 0, 0);
      s.card.position.set(0, 0, 0);
    }
  }, [flipping, number]);

  return (
    <div ref={mountRef} style={{
      width, height, margin: '0 auto', borderRadius: 12, overflow: 'hidden',
      border: '1px solid #2a2f45',
    }} />
  );
}
