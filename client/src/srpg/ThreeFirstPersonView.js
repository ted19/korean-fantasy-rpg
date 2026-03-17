import React, { useRef, useEffect } from 'react';
import * as THREE from 'three';

// ===== 던전 테마 =====
const THEMES = {
  forest:       { wall:0x2a4a1a, floor:0x1a1208, ceil:0x0a1a08, fog:0x0a1a0c, light:0xb4ff64, ambient:0x1e5028, particle:'firefly' },
  slime_cave:   { wall:0x1e3438, floor:0x0a1618, ceil:0x081012, fog:0x081820, light:0x64dcff, ambient:0x285a6e, particle:'drip' },
  cave:         { wall:0x2d2338, floor:0x1a1828, ceil:0x0c0a18, fog:0x0c0a14, light:0xffc878, ambient:0x3a2850, particle:'dust' },
  swamp:        { wall:0x283218, floor:0x121a0a, ceil:0x0a1208, fog:0x0e160a, light:0xc8e050, ambient:0x2a3818, particle:'spore' },
  mountain:     { wall:0x384048, floor:0x1a2028, ceil:0x101418, fog:0x101820, light:0xe0e8ff, ambient:0x384858, particle:'dust' },
  ocean:        { wall:0x1a3040, floor:0x0a1820, ceil:0x081018, fog:0x081420, light:0x50c8ff, ambient:0x1a4060, particle:'bubble' },
  spirit_forest:{ wall:0x1a3028, floor:0x0a180e, ceil:0x081210, fog:0x081410, light:0x80ffa0, ambient:0x185030, particle:'firefly' },
  temple:       { wall:0x302828, floor:0x181010, ceil:0x100a0a, fog:0x100808, light:0xff8050, ambient:0x503028, particle:'ember' },
  demon:        { wall:0x381010, floor:0x180808, ceil:0x100505, fog:0x140404, light:0xff4020, ambient:0x501010, particle:'ember' },
  dragon:       { wall:0x302018, floor:0x181008, ceil:0x100a05, fog:0x100a04, light:0xffa030, ambient:0x503820, particle:'ember' },
  goblin:       { wall:0x2d2820, floor:0x1a1510, ceil:0x0c0a08, fog:0x0c0a08, light:0xffc060, ambient:0x3a3020, particle:'dust' },
};
const DEF_THEME = THEMES.cave;

// ===== 1024px 프로시저럴 벽 텍스처 + 노멀맵 =====
function makeWallMaps(color) {
  const S = 1024;
  const diffCanvas = document.createElement('canvas');
  diffCanvas.width = S; diffCanvas.height = S;
  const dCtx = diffCanvas.getContext('2d');
  const normCanvas = document.createElement('canvas');
  normCanvas.width = S; normCanvas.height = S;
  const nCtx = normCanvas.getContext('2d');
  // 노멀맵 기본: 평평한 면 = rgb(128,128,255)
  nCtx.fillStyle = 'rgb(128,128,255)'; nCtx.fillRect(0,0,S,S);

  const R=(color>>16)&0xff, G=(color>>8)&0xff, B=color&0xff;
  dCtx.fillStyle = `rgb(${R},${G},${B})`; dCtx.fillRect(0,0,S,S);

  const bH = 64, bW = 128;
  for (let row = 0; row < Math.ceil(S/bH)+1; row++) {
    const off = (row%2)*(bW/2);
    for (let col = -1; col < Math.ceil(S/bW)+1; col++) {
      const x0 = col*bW - off, y0 = row*bH;
      const v = ((row*13+col*37)%30-15);
      // 벽돌 면
      dCtx.fillStyle = `rgb(${Math.max(0,Math.min(255,R+v))},${Math.max(0,Math.min(255,G+v))},${Math.max(0,Math.min(255,B+v))})`;
      dCtx.fillRect(x0+3, y0+3, bW-5, bH-5);
      // 벽돌 상단 하이라이트
      dCtx.fillStyle = 'rgba(255,255,255,0.06)';
      dCtx.fillRect(x0+3, y0+3, bW-5, 3);
      // 벽돌 하단 그림자
      dCtx.fillStyle = 'rgba(0,0,0,0.1)';
      dCtx.fillRect(x0+3, y0+bH-6, bW-5, 3);
      // 노멀맵: 벽돌 돌출 (위=밝은 초록, 아래=어두운 초록, 좌=밝은 빨강, 우=어두운 빨강)
      nCtx.fillStyle = 'rgb(128,145,255)'; // 위쪽 가장자리 (살짝 위로 튀어나온 느낌)
      nCtx.fillRect(x0+3, y0+3, bW-5, 4);
      nCtx.fillStyle = 'rgb(128,110,255)'; // 아래쪽 가장자리
      nCtx.fillRect(x0+3, y0+bH-7, bW-5, 4);
      nCtx.fillStyle = 'rgb(145,128,255)'; // 좌측
      nCtx.fillRect(x0+3, y0+3, 4, bH-5);
      nCtx.fillStyle = 'rgb(110,128,255)'; // 우측
      nCtx.fillRect(x0+bW-4, y0+3, 4, bH-5);
    }
    // 줄눈
    dCtx.fillStyle = `rgb(${Math.max(0,R-50)},${Math.max(0,G-50)},${Math.max(0,B-45)})`;
    dCtx.fillRect(0, row*bH, S, 3);
    nCtx.fillStyle = 'rgb(128,128,200)'; // 줄눈은 안쪽으로 들어감
    nCtx.fillRect(0, row*bH, S, 3);
    for (let col = -1; col < Math.ceil(S/bW)+1; col++) {
      const x0 = col*bW - (row%2)*(bW/2);
      dCtx.fillRect(x0, row*bH, 3, bH);
      nCtx.fillStyle = 'rgb(128,128,200)';
      nCtx.fillRect(x0, row*bH, 3, bH);
    }
  }
  // 거칠기 노이즈
  const dId = dCtx.getImageData(0,0,S,S);
  for (let i = 0; i < dId.data.length; i+=4) {
    const n = (Math.random()-0.5)*12;
    dId.data[i]=Math.max(0,Math.min(255,dId.data[i]+n));
    dId.data[i+1]=Math.max(0,Math.min(255,dId.data[i+1]+n));
    dId.data[i+2]=Math.max(0,Math.min(255,dId.data[i+2]+n));
  }
  dCtx.putImageData(dId,0,0);
  // 균열
  dCtx.strokeStyle='rgba(0,0,0,0.3)'; dCtx.lineWidth=2;
  for(let k=0;k<4;k++){dCtx.beginPath();let cx=Math.random()*S,cy=Math.random()*S;dCtx.moveTo(cx,cy);for(let s=0;s<10;s++){cx+=(Math.random()-0.5)*25;cy+=Math.random()*20;dCtx.lineTo(cx,cy);}dCtx.stroke();}
  // 얼룩
  for(let k=0;k<8;k++){dCtx.fillStyle=`rgba(0,0,0,${0.02+Math.random()*0.05})`;dCtx.beginPath();dCtx.arc(Math.random()*S,Math.random()*S,15+Math.random()*50,0,Math.PI*2);dCtx.fill();}
  // 이끼
  for(let k=0;k<6;k++){const mx=Math.random()*S,my=S*0.6+Math.random()*S*0.4;dCtx.fillStyle=`rgba(${30+Math.random()*30},${60+Math.random()*40},${20+Math.random()*20},${0.1+Math.random()*0.1})`;dCtx.beginPath();dCtx.arc(mx,my,10+Math.random()*30,0,Math.PI*2);dCtx.fill();}

  const diffTex = new THREE.CanvasTexture(diffCanvas);
  diffTex.wrapS=diffTex.wrapT=THREE.RepeatWrapping; diffTex.colorSpace=THREE.SRGBColorSpace; diffTex.anisotropy=8;
  const normTex = new THREE.CanvasTexture(normCanvas);
  normTex.wrapS=normTex.wrapT=THREE.RepeatWrapping;
  return { diffuse: diffTex, normal: normTex };
}

function makeFloorMaps(color) {
  const S = 1024;
  const c = document.createElement('canvas'); c.width=S; c.height=S;
  const g = c.getContext('2d');
  const nc = document.createElement('canvas'); nc.width=S; nc.height=S;
  const ng = nc.getContext('2d');
  ng.fillStyle='rgb(128,128,255)'; ng.fillRect(0,0,S,S);
  const R=(color>>16)&0xff, G=(color>>8)&0xff, B=color&0xff;
  const ts=128;
  for(let ty=0;ty<S;ty+=ts)for(let tx=0;tx<S;tx+=ts){
    const v=((tx/ts+ty/ts)%2)*12-6;
    g.fillStyle=`rgb(${Math.max(0,Math.min(255,R+v))},${Math.max(0,Math.min(255,G+v))},${Math.max(0,Math.min(255,B+v))})`;
    g.fillRect(tx+2,ty+2,ts-3,ts-3);
    g.strokeStyle='rgba(0,0,0,0.35)';g.lineWidth=2;g.strokeRect(tx,ty,ts,ts);
    // 노멀: 타일 엣지 돌출
    ng.fillStyle='rgb(128,140,255)';ng.fillRect(tx+2,ty+2,ts-3,3);
    ng.fillStyle='rgb(128,116,255)';ng.fillRect(tx+2,ty+ts-4,ts-3,3);
    ng.fillStyle='rgb(140,128,255)';ng.fillRect(tx+2,ty+2,3,ts-3);
    ng.fillStyle='rgb(116,128,255)';ng.fillRect(tx+ts-4,ty+2,3,ts-3);
    ng.fillStyle='rgb(128,128,220)';ng.fillRect(tx,ty,ts,2);ng.fillRect(tx,ty,2,ts);
  }
  // 거칠기 노이즈
  const id=g.getImageData(0,0,S,S);
  for(let i=0;i<id.data.length;i+=4){const n=(Math.random()-0.5)*10;id.data[i]=Math.max(0,Math.min(255,id.data[i]+n));id.data[i+1]=Math.max(0,Math.min(255,id.data[i+1]+n));id.data[i+2]=Math.max(0,Math.min(255,id.data[i+2]+n));}
  g.putImageData(id,0,0);
  // 바닥 얼룩/먼지
  for(let k=0;k<12;k++){g.fillStyle=`rgba(0,0,0,${0.03+Math.random()*0.05})`;g.beginPath();g.arc(Math.random()*S,Math.random()*S,10+Math.random()*40,0,Math.PI*2);g.fill();}
  const dt=new THREE.CanvasTexture(c);dt.wrapS=dt.wrapT=THREE.RepeatWrapping;dt.colorSpace=THREE.SRGBColorSpace;dt.anisotropy=8;
  const nt=new THREE.CanvasTexture(nc);nt.wrapS=nt.wrapT=THREE.RepeatWrapping;
  return {diffuse:dt,normal:nt};
}

// ===== 3D 장식물 =====
function addDecorations(scene, grid, mW, mH, theme) {
  const hash = (x,y) => ((x*374761393+y*668265263)^(x*1274126177))&0x7FFFFFFF;

  for (let gy=1;gy<mH-1;gy++) for (let gx=1;gx<mW-1;gx++) {
    if (grid[gy][gx]!==0) continue;
    const h = hash(gx,gy);

    // 벽 옆에만 장식 (인접 벽 확인)
    const adjWall = [[0,-1],[0,1],[-1,0],[1,0]].find(([dx,dy])=>{
      const nx=gx+dx,ny=gy+dy;
      return nx>=0&&nx<mW&&ny>=0&&ny<mH&&grid[ny][nx]===1;
    });

    // 바닥 뼈 (10%)
    if (h%10===0) {
      const boneMat = new THREE.MeshStandardMaterial({color:0xd4c8a0,roughness:0.7,metalness:0});
      const bone = new THREE.Mesh(new THREE.CylinderGeometry(0.01,0.01,0.08,4), boneMat);
      bone.position.set(gx+0.3+Math.random()*0.4, 0.01, gy+0.3+Math.random()*0.4);
      bone.rotation.set(Math.random()*0.3, Math.random()*Math.PI, Math.PI/2+Math.random()*0.2);
      scene.add(bone);
      // 마디
      const knob = new THREE.Mesh(new THREE.SphereGeometry(0.015,4,4), boneMat);
      knob.position.copy(bone.position); knob.position.x+=0.04;
      scene.add(knob);
    }

    // 바닥 돌 (15%)
    if (h%7===0) {
      const rockMat = new THREE.MeshStandardMaterial({color:0x555560,roughness:0.85,metalness:0.05});
      const rock = new THREE.Mesh(new THREE.DodecahedronGeometry(0.02+Math.random()*0.03,0), rockMat);
      rock.position.set(gx+0.2+Math.random()*0.6, 0.015, gy+0.2+Math.random()*0.6);
      rock.rotation.set(Math.random(),Math.random(),Math.random());
      scene.add(rock);
    }

    // 벽면 횃불 브라켓 (벽 옆, 8%)
    if (adjWall && h%13===0) {
      const [dx,dy] = adjWall;
      const bracketMat = new THREE.MeshStandardMaterial({color:0x554433,roughness:0.6,metalness:0.3});
      const bracket = new THREE.Mesh(new THREE.CylinderGeometry(0.015,0.015,0.12,6), bracketMat);
      bracket.position.set(gx+0.5-dx*0.42, 0.7, gy+0.5-dy*0.42);
      bracket.rotation.z = Math.PI/2;
      bracket.rotation.y = Math.atan2(dy,dx);
      scene.add(bracket);
      // 불꽃 구체
      const flameMat = new THREE.MeshBasicMaterial({color:theme.light});
      const flame = new THREE.Mesh(new THREE.SphereGeometry(0.025,6,4), flameMat);
      flame.position.set(gx+0.5-dx*0.35, 0.75, gy+0.5-dy*0.35);
      scene.add(flame);
    }

    // 거미줄 (천장 근처, 6%)
    if (adjWall && h%17===0) {
      const [dx,dy] = adjWall;
      const webMat = new THREE.MeshBasicMaterial({color:0xcccccc,transparent:true,opacity:0.08,side:THREE.DoubleSide});
      const webGeo = new THREE.PlaneGeometry(0.3,0.3);
      const web = new THREE.Mesh(webGeo, webMat);
      web.position.set(gx+0.5-dx*0.4, 0.9, gy+0.5-dy*0.4);
      web.rotation.y = Math.atan2(dy,dx);
      web.rotation.x = -0.3;
      scene.add(web);
    }

    // 물웅덩이 (바닥 반사, 5%)
    if (h%20===0) {
      const puddleMat = new THREE.MeshStandardMaterial({
        color:0x1a2a3a, roughness:0.1, metalness:0.8, transparent:true, opacity:0.4,
      });
      const puddle = new THREE.Mesh(new THREE.CircleGeometry(0.1+Math.random()*0.1,12), puddleMat);
      puddle.rotation.x = -Math.PI/2;
      puddle.position.set(gx+0.3+Math.random()*0.4, 0.005, gy+0.3+Math.random()*0.4);
      scene.add(puddle);
    }

    // 두개골 (바닥, 3%)
    if (h%33===0) {
      const skullMat = new THREE.MeshStandardMaterial({color:0xc8b890,roughness:0.6,metalness:0});
      const skull = new THREE.Mesh(new THREE.SphereGeometry(0.03,6,5), skullMat);
      skull.position.set(gx+0.3+Math.random()*0.4, 0.03, gy+0.3+Math.random()*0.4);
      skull.scale.set(1,0.8,0.9);
      scene.add(skull);
      // 눈구멍
      const eyeMat = new THREE.MeshBasicMaterial({color:0x000000});
      [-1,1].forEach(s=>{
        const e=new THREE.Mesh(new THREE.SphereGeometry(0.008,4,4),eyeMat);
        e.position.copy(skull.position);e.position.x+=s*0.012;e.position.y+=0.01;e.position.z+=0.025;
        scene.add(e);
      });
    }
  }
}

// ===== 3D 몬스터 캐릭터 =====
function createMonsterChar(colorIdx) {
  const colors = [0x8b2020,0x204080,0x208040,0x804020,0x602060,0x806020,0x205050];
  const c1 = colors[colorIdx%colors.length], c2 = colors[(colorIdx+3)%colors.length];
  const g = new THREE.Group();
  const bodyMat = new THREE.MeshStandardMaterial({color:c1,roughness:0.5,metalness:0.1});
  const body = new THREE.Mesh(new THREE.CapsuleGeometry(0.07,0.14,4,8),bodyMat);
  body.position.y=0.2; g.add(body);
  const headMat = new THREE.MeshStandardMaterial({color:c2,roughness:0.4,metalness:0.05,emissive:c2,emissiveIntensity:0.05});
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.06,8,6),headMat);
  head.position.y=0.36; g.add(head);
  // 발광 눈
  const eyeMat = new THREE.MeshStandardMaterial({color:0xff0000,emissive:0xff2020,emissiveIntensity:3});
  [-1,1].forEach(s=>{const e=new THREE.Mesh(new THREE.SphereGeometry(0.014,4,4),eyeMat);e.position.set(s*0.025,0.37,0.05);g.add(e);});
  // 팔다리
  const limbMat = new THREE.MeshStandardMaterial({color:c1,roughness:0.6});
  ['leftArm','rightArm','leftLeg','rightLeg'].forEach((name,i)=>{
    const isArm = i<2; const side = i%2===0?-1:1;
    const limb = new THREE.Mesh(new THREE.CylinderGeometry(isArm?0.018:0.022,isArm?0.018:0.022,isArm?0.1:0.12,4),limbMat);
    limb.position.set(side*(isArm?0.09:0.035),isArm?0.22:0.06,0);
    limb.name=name; g.add(limb);
  });
  g.traverse(c=>{if(c.isMesh)c.castShadow=true;});
  return g;
}

// ===== 파티클 시스템 =====
function createParticles(type,count=120) {
  const geo = new THREE.BufferGeometry();
  const pos = new Float32Array(count*3);
  const life = new Float32Array(count);
  for(let i=0;i<count;i++){pos[i*3]=0;pos[i*3+1]=0;pos[i*3+2]=0;life[i]=Math.random();}
  geo.setAttribute('position',new THREE.BufferAttribute(pos,3));
  geo.setAttribute('lifetime',new THREE.BufferAttribute(life,1));
  const colors = {firefly:0x99ff44,ember:0xff6622,dust:0xaa9988,drip:0x6699cc,bubble:0x88ccff,spore:0xaacc44};
  const mat = new THREE.PointsMaterial({
    color:colors[type]||0xffaa44, size:type==='firefly'?0.04:0.025,
    transparent:true, opacity:0.6, blending:THREE.AdditiveBlending, depthWrite:false, sizeAttenuation:true,
  });
  return new THREE.Points(geo,mat);
}

// ===== 메인 컴포넌트 =====
export default function ThreeFirstPersonView({ maze, px, py, facing, monsters, treasures, exitPos, dungeonKey }) {
  const containerRef = useRef(null);
  const threeRef = useRef(null);
  const smoothPos = useRef(null);
  const spriteMeshes = useRef([]);
  const monsterChars = useRef([]);
  const particles = useRef(null);
  const clockRef = useRef(new THREE.Clock());

  // ===== 씬 구축 =====
  useEffect(()=>{
    if(!maze||!containerRef.current) return;
    const container = containerRef.current;
    if(threeRef.current){threeRef.current.renderer.dispose();if(threeRef.current.renderer.domElement.parentNode)threeRef.current.renderer.domElement.parentNode.removeChild(threeRef.current.renderer.domElement);}

    const theme = THEMES[dungeonKey]||DEF_THEME;
    const w=container.clientWidth||800, h=container.clientHeight||500;

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(theme.fog).multiplyScalar(0.15);
    scene.fog = new THREE.FogExp2(theme.fog, 0.2);

    const camera = new THREE.PerspectiveCamera(68, w/h, 0.05, 25);
    const renderer = new THREE.WebGLRenderer({antialias:true, powerPreference:'high-performance'});
    renderer.setSize(w,h);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio,2));
    renderer.shadowMap.enabled=true;
    renderer.shadowMap.type=THREE.PCFShadowMap;
    renderer.toneMapping=THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure=0.85;
    renderer.outputColorSpace=THREE.SRGBColorSpace;
    container.appendChild(renderer.domElement);

    const grid=maze.grid, mW=maze.width, mH=maze.height;

    // 1024px 텍스처 + 노멀맵
    const wallMaps = makeWallMaps(theme.wall);
    const floorMaps = makeFloorMaps(theme.floor);
    const ceilMaps = makeFloorMaps(theme.ceil);
    floorMaps.diffuse.repeat.set(mW/4,mH/4); floorMaps.normal.repeat.set(mW/4,mH/4);
    ceilMaps.diffuse.repeat.set(mW/4,mH/4); ceilMaps.normal.repeat.set(mW/4,mH/4);

    // 벽
    const wallMat = new THREE.MeshStandardMaterial({map:wallMaps.diffuse, normalMap:wallMaps.normal, normalScale:new THREE.Vector2(0.8,0.8), roughness:0.78, metalness:0.05});
    let wc=0; for(let y=0;y<mH;y++)for(let x=0;x<mW;x++)if(grid[y][x]===1)wc++;
    const wallMesh = new THREE.InstancedMesh(new THREE.BoxGeometry(1,1,1), wallMat, wc);
    wallMesh.castShadow=true; wallMesh.receiveShadow=true;
    const d=new THREE.Object3D(); let ii=0;
    for(let gy=0;gy<mH;gy++)for(let gx=0;gx<mW;gx++){if(grid[gy][gx]===1){d.position.set(gx+0.5,0.5,gy+0.5);d.updateMatrix();wallMesh.setMatrixAt(ii++,d.matrix);}}
    wallMesh.instanceMatrix.needsUpdate=true;
    scene.add(wallMesh);

    // 바닥 (노멀맵 + 약간 반사)
    const floorMat = new THREE.MeshStandardMaterial({map:floorMaps.diffuse, normalMap:floorMaps.normal, normalScale:new THREE.Vector2(0.6,0.6), roughness:0.5, metalness:0.1});
    const floor=new THREE.Mesh(new THREE.PlaneGeometry(mW,mH),floorMat);
    floor.rotation.x=-Math.PI/2; floor.position.set(mW/2,0,mH/2); floor.receiveShadow=true;
    scene.add(floor);

    // 천장
    const ceilMat = new THREE.MeshStandardMaterial({map:ceilMaps.diffuse, normalMap:ceilMaps.normal, normalScale:new THREE.Vector2(0.4,0.4), roughness:0.9, metalness:0});
    const ceil=new THREE.Mesh(new THREE.PlaneGeometry(mW,mH),ceilMat);
    ceil.rotation.x=Math.PI/2; ceil.position.set(mW/2,1,mH/2);
    scene.add(ceil);

    // 3D 장식물
    addDecorations(scene, grid, mW, mH, theme);

    // === 조명 ===
    scene.add(new THREE.AmbientLight(theme.ambient, 0.12));
    scene.add(new THREE.HemisphereLight(theme.light, theme.floor, 0.08));

    const playerLight = new THREE.PointLight(theme.light, 2.5, 6, 1.8);
    playerLight.castShadow=true; playerLight.shadow.mapSize.set(1024,1024);
    playerLight.shadow.radius=2; playerLight.shadow.bias=-0.002;
    scene.add(playerLight);

    const fillLight = new THREE.PointLight(theme.light, 0.3, 3, 2);
    scene.add(fillLight);

    // 벽면 횃불
    const torchLights=[];
    for(let gy=2;gy<mH-2;gy+=4)for(let gx=2;gx<mW-2;gx+=4){
      if(grid[gy][gx]===0){
        const dirs=[[0,-1],[0,1],[-1,0],[1,0]];
        for(const[dx2,dy2]of dirs){
          const nx=gx+dx2,ny=gy+dy2;
          if(nx>=0&&nx<mW&&ny>=0&&ny<mH&&grid[ny][nx]===1){
            const tl=new THREE.PointLight(theme.light,0.5,3.5,2);
            tl.position.set(gx+0.5-dx2*0.3,0.8,gy+0.5-dy2*0.3);
            scene.add(tl); torchLights.push(tl);
            break;
          }
        }
      }
    }

    // 파티클
    const pp = createParticles(theme.particle || 'dust', 150);
    scene.add(pp); particles.current = pp;

    smoothPos.current={x:px+0.5,y:py+0.5,angle:[(-Math.PI/2),0,(Math.PI/2),Math.PI][facing%4]};
    threeRef.current={scene,camera,renderer,playerLight,fillLight,theme,torchLights,grid,mW,mH};

    const onResize=()=>{const cw=container.clientWidth||800,ch=container.clientHeight||500;camera.aspect=cw/ch;camera.updateProjectionMatrix();renderer.setSize(cw,ch);};
    window.addEventListener('resize',onResize);
    return()=>{window.removeEventListener('resize',onResize);renderer.dispose();if(renderer.domElement.parentNode)renderer.domElement.parentNode.removeChild(renderer.domElement);threeRef.current=null;monsterChars.current.forEach(mc=>mc.parent?.remove(mc));monsterChars.current=[];};
  },[maze,dungeonKey]); // eslint-disable-line

  // ===== 스프라이트 + 3D 몬스터 =====
  useEffect(()=>{
    const t=threeRef.current; if(!t)return;
    const{scene}=t;
    spriteMeshes.current.forEach(s=>{scene.remove(s);if(s.material)s.material.dispose();});
    spriteMeshes.current=[];
    monsterChars.current.forEach(mc=>scene.remove(mc));
    monsterChars.current=[];
    const loader=new THREE.TextureLoader();
    const addSpr=(x,y,url,scale,yOff)=>{const tex=loader.load(url);tex.colorSpace=THREE.SRGBColorSpace;const mat=new THREE.SpriteMaterial({map:tex,transparent:true});const sp=new THREE.Sprite(mat);sp.position.set(x+0.5,yOff,y+0.5);sp.scale.set(scale,scale,1);scene.add(sp);spriteMeshes.current.push(sp);};

    monsters.filter(m=>!m.defeated).forEach((m,mi)=>{
      const mc=createMonsterChar(mi);mc.position.set(m.x+0.5,0,m.y+0.5);mc.scale.set(1.5,1.5,1.5);
      scene.add(mc);monsterChars.current.push(mc);
      if(m.monsterId)addSpr(m.x,m.y,`/monsters_nobg/${m.monsterId}_full.png`,0.45,0.7);
    });
    treasures.filter(t2=>!t2.collected).forEach(t2=>{
      addSpr(t2.x,t2.y,'/ui/dungeon/dc_treasure_nobg.png',0.25,0.15);
      const gl=new THREE.PointLight(0xffa502,0.5,1.5,2);gl.position.set(t2.x+0.5,0.25,t2.y+0.5);scene.add(gl);spriteMeshes.current.push(gl);
    });
    if(exitPos){
      addSpr(exitPos.x,exitPos.y,'/ui/dungeon/dc_exit_nobg.png',0.4,0.3);
      const gl=new THREE.PointLight(0x2ed573,0.8,2,2);gl.position.set(exitPos.x+0.5,0.5,exitPos.y+0.5);scene.add(gl);spriteMeshes.current.push(gl);
    }
  },[monsters,treasures,exitPos]);

  // ===== 애니메이션 =====
  useEffect(()=>{
    let running=true;
    const loop=()=>{
      if(!running)return;
      const t=threeRef.current,sp=smoothPos.current;
      if(!t||!sp){requestAnimationFrame(loop);return;}
      const{scene,camera,renderer,playerLight,fillLight,torchLights,theme}=t;
      const now=Date.now(), el=clockRef.current.getElapsedTime();
      const ta=[(-Math.PI/2),0,(Math.PI/2),Math.PI][facing%4];

      let ad=ta-sp.angle;while(ad>Math.PI)ad-=2*Math.PI;while(ad<-Math.PI)ad+=2*Math.PI;
      sp.x+=(px+0.5-sp.x)*0.12; sp.y+=(py+0.5-sp.y)*0.12; sp.angle+=ad*0.12;

      const wb=Math.sin(el*6)*0.006, ws=Math.sin(el*3)*0.002;
      camera.position.set(sp.x+ws, 0.5+wb, sp.y);
      camera.lookAt(sp.x+Math.cos(sp.angle)*2+ws, 0.5, sp.y+Math.sin(sp.angle)*2);

      const fl=2.2+Math.sin(now*0.005)*0.35+Math.sin(now*0.013)*0.2+Math.sin(now*0.0073)*0.15;
      playerLight.position.set(sp.x+Math.cos(sp.angle)*0.15, 0.75, sp.y+Math.sin(sp.angle)*0.15);
      playerLight.intensity=fl;
      fillLight.position.set(sp.x-Math.cos(sp.angle)*0.5, 0.4, sp.y-Math.sin(sp.angle)*0.5);

      torchLights.forEach((tl,i)=>{tl.intensity=0.4+Math.sin(now*0.004+i*2.7)*0.2+Math.sin(now*0.011+i*1.3)*0.1;});

      // 3D 몬스터 애니메이션
      monsterChars.current.forEach((mc,i)=>{
        const m=monsters.filter(m2=>!m2.defeated)[i]; if(!m)return;
        mc.position.x=m.x+0.5; mc.position.z=m.y+0.5;
        mc.lookAt(sp.x,0,sp.y);
        const wt=el*4+i*2;
        mc.children.forEach(ch=>{
          if(ch.name==='leftArm')ch.rotation.x=Math.sin(wt)*0.5;
          if(ch.name==='rightArm')ch.rotation.x=-Math.sin(wt)*0.5;
          if(ch.name==='leftLeg')ch.rotation.x=-Math.sin(wt)*0.4;
          if(ch.name==='rightLeg')ch.rotation.x=Math.sin(wt)*0.4;
        });
        mc.position.y=Math.sin(wt*0.5)*0.01;
        // 몬스터 빌보드 동기화
        const sprIdx = i;
        if(spriteMeshes.current[sprIdx]){
          spriteMeshes.current[sprIdx].position.x=m.x+0.5;
          spriteMeshes.current[sprIdx].position.z=m.y+0.5;
          spriteMeshes.current[sprIdx].position.y=0.7+Math.sin(now*0.002+i*3)*0.02;
        }
      });

      // 파티클
      if(particles.current){
        const pp=particles.current.geometry.attributes.position;
        const pl=particles.current.geometry.attributes.lifetime;
        const pType = theme.particle || 'dust';
        for(let i=0;i<pp.count;i++){
          let lt=pl.getX(i)+0.008;
          if(lt>1){
            lt=0;
            if(pType==='firefly'){pp.setXYZ(i,sp.x+(Math.random()-0.5)*4,0.2+Math.random()*0.6,sp.y+(Math.random()-0.5)*4);}
            else if(pType==='ember'){pp.setXYZ(i,sp.x+(Math.random()-0.5)*3,0.05,sp.y+(Math.random()-0.5)*3);}
            else if(pType==='drip'){pp.setXYZ(i,sp.x+(Math.random()-0.5)*3,0.95,sp.y+(Math.random()-0.5)*3);}
            else{pp.setXYZ(i,sp.x+(Math.random()-0.5)*4,Math.random()*0.8,sp.y+(Math.random()-0.5)*4);}
          } else {
            if(pType==='firefly'){pp.setX(i,pp.getX(i)+(Math.random()-0.5)*0.005);pp.setY(i,pp.getY(i)+(Math.random()-0.5)*0.003);}
            else if(pType==='ember'){pp.setY(i,pp.getY(i)+0.004);pp.setX(i,pp.getX(i)+(Math.random()-0.5)*0.002);}
            else if(pType==='drip'){pp.setY(i,pp.getY(i)-0.008);}
            else if(pType==='bubble'){pp.setY(i,pp.getY(i)+0.002);pp.setX(i,pp.getX(i)+(Math.random()-0.5)*0.002);}
            else{pp.setX(i,pp.getX(i)+(Math.random()-0.5)*0.002);pp.setY(i,pp.getY(i)+(Math.random()-0.5)*0.001);}
          }
          pl.setX(i,lt);
        }
        pp.needsUpdate=true; pl.needsUpdate=true;
        particles.current.material.opacity=0.4+Math.sin(now*0.008)*0.15;
      }

      renderer.render(scene,camera);
      requestAnimationFrame(loop);
    };
    requestAnimationFrame(loop);
    return()=>{running=false;};
  },[px,py,facing,monsters]); // eslint-disable-line

  return <div ref={containerRef} className="dc-fpv" style={{position:'relative',width:'100%',height:'100%',background:'#030308',overflow:'hidden'}} />;
}
