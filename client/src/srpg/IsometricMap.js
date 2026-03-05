import React, { useRef, useMemo, useState, useCallback, useEffect } from 'react';
import { Canvas, useThree, useFrame } from '@react-three/fiber';
import { Text, Html } from '@react-three/drei';
import * as THREE from 'three';
import { GLTFLoader } from 'three-stdlib';
import { TILE_COLORS, TILE_SIDE_COLORS } from './mapData';
import {
  RabbitModel, BoarModel, ViperModel, BlackBearModel, SnowLeopardModel,
  GrayBearModel, PythonModel, WhiteTigerModel, ThreeHeadedHoundModel, AncientFoxModel,
  CentipedeModel, PoisonMothModel, KillerBeeModel, ScorpionModel, QueenAntModel,
  StagBeetleModel, SpiderQueenModel, MantisWarriorModel,
  ZombieModel, GhoulModel, WraithModel, VampireModel, DeathKnightModel,
  LichKingModel, SkeletalArcherModel, MummyModel,
  WanderingSpiritModel, MaidenGhostModel, YakshaModel, WaterGhostModel,
  BlackShadowModel, BlindSpiritModel, MoonGhostModel, ImoogiModel,
  EarthElementalModel, LightningElementalModel, IceElementalModel,
  LightElementalModel, DarkElementalModel, ElementalKingModel,
  ImpModel, SuccubusModel, IncubusModel, HellHoundModel, BalrogModel,
  DemonServantModel, FallenAngelModel, DemonKingModel, GargoyleModel,
  DragonHatchlingModel, WyvernModel, FireDragonModel, IceDragonModel,
  DarkDragonModel, DragonKingModel, DrakeModel, HydraModel,
  MagicArmorModel, GuardianModel, HomunculusModel, ManaGolemModel,
  UnicornModel, GriffinModel, PhoenixModel, MimicModel,
  PoisonMushroomModel, VineMonsterModel, TreantModel, CarnivorousPlantModel,
  SporeSwarmModel, MandrakeModel, WorldTreeFragmentModel, FungalLordModel,
  BanditModel, AssassinModel, DarkWizardModel, FallenKnightModel,
  BerserkerModel, NecromancerModel, GrandWizardModel, ThiefLeaderModel,
  SmallDokkaebiModel, FireDokkaebiModel, StoneDokkaebiModel, DokkaebiGeneralModel,
  DokkaebiKingModel, PondDokkaebiModel, DokkaebiClubModel, ForestDokkaebiModel,
  HaetaeModel, BulgasariModel, ChimeraModel, MinotaurModel,
  MedusaModel, GiantModel, WerewolfModel,
  GreenSlimeModel, BlueSlimeModel, RedSlimeModel, PoisonSlimeModel,
  MetalSlimeModel, KingSlimeModel, JellyfishModel, SlimeLordModel,
  KingCrabModel, SharkModel, GiantOctopusModel, MermaidWarriorModel,
  DeepSeaFishModel, KrakenModel, SeahorseKnightModel, SeaDragonModel,
  FengShuiMasterModel, MudangModel, BuddhistMonkModel,
  WanderingSoulModel, GraveyardGhostModel, NineTailFoxSummonModel,
  MouseSummonModel, WolfSummonModel, GolemFragmentModel, SpiderQueenSummonModel,
  WaterSpiritSummonModel, FireSpiritSummonModel, WindSpiritSummonModel,
  SkeletonWarriorSummonModel, LichSummonModel,
} from './MonsterModels';

const TILE_SIZE = 1.5;
const HEIGHT_SCALE = 0.5;
const PUB = process.env.PUBLIC_URL || '';

// ========== PBR 텍스처 맵핑 ==========
const TERRAIN_TEXTURES = {
  grass: {
    diff: `${PUB}/textures/grass_diff.jpg`,
    norm: `${PUB}/textures/grass_norm.jpg`,
    rough: `${PUB}/textures/grass_rough.jpg`,
  },
  stone: {
    diff: `${PUB}/textures/stone_diff.jpg`,
    norm: `${PUB}/textures/stone_norm.jpg`,
    rough: `${PUB}/textures/stone_rough.jpg`,
  },
  dirt: {
    diff: `${PUB}/textures/dirt_diff.jpg`,
    norm: `${PUB}/textures/dirt_norm.jpg`,
    rough: `${PUB}/textures/dirt_rough.jpg`,
  },
  dark: {
    diff: `${PUB}/textures/dark_diff.jpg`,
    norm: `${PUB}/textures/dark_norm.jpg`,
    rough: `${PUB}/textures/dark_rough.jpg`,
  },
};

// 텍스처 캐시 (전역)
const textureCache = {};
const loader = new THREE.TextureLoader();

function loadCachedTexture(url) {
  if (textureCache[url]) return textureCache[url];
  const tex = loader.load(url);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(1, 1);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.minFilter = THREE.LinearMipmapLinearFilter;
  tex.magFilter = THREE.LinearFilter;
  tex.anisotropy = 8;
  tex.generateMipmaps = true;
  textureCache[url] = tex;
  return tex;
}

// 물 타일용 애니메이션 셰이더 재질
function WaterMaterial({ isHighlight, highlightColor }) {
  const ref = useRef();

  useFrame((state) => {
    if (ref.current) {
      ref.current.uniforms.uTime.value = state.clock.elapsedTime;
    }
  });

  const uniforms = useMemo(() => ({
    uTime: { value: 0 },
    uHighlight: { value: isHighlight ? 1.0 : 0.0 },
    uHighlightColor: { value: new THREE.Color(highlightColor || '#1e4d8c') },
  }), []); // eslint-disable-line

  useEffect(() => {
    if (ref.current) {
      ref.current.uniforms.uHighlight.value = isHighlight ? 1.0 : 0.0;
      ref.current.uniforms.uHighlightColor.value.set(highlightColor || '#1e4d8c');
    }
  }, [isHighlight, highlightColor]);

  return (
    <shaderMaterial
      ref={ref}
      uniforms={uniforms}
      transparent
      vertexShader={`
        varying vec2 vUv;
        void main() {
          vUv = uv;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `}
      fragmentShader={`
        uniform float uTime;
        uniform float uHighlight;
        uniform vec3 uHighlightColor;
        varying vec2 vUv;
        void main() {
          vec2 uv = vUv;
          float wave1 = sin(uv.x * 8.0 + uTime * 1.5) * 0.03;
          float wave2 = sin(uv.y * 6.0 + uTime * 1.2 + 1.5) * 0.025;
          float wave = wave1 + wave2;

          vec3 deepColor = vec3(0.08, 0.22, 0.45);
          vec3 shallowColor = vec3(0.15, 0.4, 0.65);
          vec3 waterColor = mix(deepColor, shallowColor, wave + 0.5);

          // 반짝임 하이라이트
          float sparkle = pow(max(0.0, sin(uv.x * 20.0 + uTime * 2.0) * sin(uv.y * 20.0 - uTime * 1.7)), 8.0) * 0.4;
          waterColor += vec3(sparkle);

          // 선택/이동/공격 하이라이트 블렌딩
          if (uHighlight > 0.5) {
            waterColor = mix(waterColor, uHighlightColor, 0.6);
          }

          gl_FragColor = vec4(waterColor, 0.85);
        }
      `}
    />
  );
}

// 개별 타일 메시 (PBR 텍스처 적용, 오버레이 하이라이트)
function PulsingOverlay({ position, color, baseOpacity }) {
  const matRef = useRef();
  useFrame((state) => {
    if (matRef.current) {
      matRef.current.opacity = baseOpacity + Math.sin(state.clock.elapsedTime * 4) * 0.15;
    }
  });
  return (
    <mesh position={position}>
      <boxGeometry args={[TILE_SIZE * 0.95, 0.01, TILE_SIZE * 0.95]} />
      <meshBasicMaterial ref={matRef} color={color} transparent opacity={baseOpacity} side={THREE.DoubleSide} depthWrite={false} />
    </mesh>
  );
}

function Tile({ tile, isMovable, isAttackable, isSelected, isHovered, onClick, onHover, onUnhover }) {
  const meshRef = useRef();
  const h = tile.height * HEIGHT_SCALE;
  const sideColor = TILE_SIDE_COLORS[tile.type] || '#333';
  const isWater = tile.type === 'water';

  // 오버레이 색상/투명도
  const overlayColor = isSelected ? '#ffeb3b' :
    isMovable ? '#4fc3f7' :
    isAttackable ? '#ef5350' :
    isHovered ? '#7986cb' : null;
  const overlayOpacity = isSelected ? 0.5 :
    isMovable ? 0.4 :
    isAttackable ? 0.45 :
    isHovered ? 0.3 : 0;
  const shouldPulse = isMovable || isAttackable;

  // PBR 텍스처 로드 (물 제외)
  const textures = useMemo(() => {
    if (isWater) return null;
    const terrainTex = TERRAIN_TEXTURES[tile.type];
    if (!terrainTex) return null;
    return {
      map: loadCachedTexture(terrainTex.diff),
      normalMap: loadCachedTexture(terrainTex.norm),
      roughnessMap: loadCachedTexture(terrainTex.rough),
    };
  }, [tile.type, isWater]);

  // 상단 면 재질: 항상 텍스처 유지
  const topMatProps = useMemo(() => {
    if (textures) {
      return {
        map: textures.map,
        normalMap: textures.normalMap,
        roughnessMap: textures.roughnessMap,
        roughness: 1,
        metalness: 0,
      };
    }
    return { color: TILE_COLORS[tile.type] || '#555' };
  }, [textures, tile.type]);

  return (
    <group position={[tile.x * TILE_SIZE, h / 2, tile.z * TILE_SIZE]}>
      {/* 상단 면 (항상 텍스처) */}
      <mesh
        ref={meshRef}
        position={[0, h / 2, 0]}
        receiveShadow
        onClick={(e) => { e.stopPropagation(); onClick(tile); }}
        onPointerOver={(e) => { e.stopPropagation(); onHover(tile); }}
        onPointerOut={(e) => { e.stopPropagation(); onUnhover(); }}
      >
        <boxGeometry args={[TILE_SIZE * 0.95, 0.08, TILE_SIZE * 0.95]} />
        {isWater ? (
          <WaterMaterial isHighlight={!!overlayColor} highlightColor={overlayColor} />
        ) : (
          <meshStandardMaterial {...topMatProps} />
        )}
      </mesh>
      {/* 하이라이트 오버레이 (텍스처 위에 반투명 색상) */}
      {overlayColor && !isWater && shouldPulse && (
        <PulsingOverlay position={[0, h / 2 + 0.045, 0]} color={overlayColor} baseOpacity={overlayOpacity} />
      )}
      {overlayColor && !isWater && !shouldPulse && (
        <mesh position={[0, h / 2 + 0.045, 0]}>
          <boxGeometry args={[TILE_SIZE * 0.95, 0.01, TILE_SIZE * 0.95]} />
          <meshBasicMaterial color={overlayColor} transparent opacity={overlayOpacity} side={THREE.DoubleSide} depthWrite={false} />
        </mesh>
      )}
      {/* 측면 기둥 */}
      {h > 0 && (
        <mesh position={[0, 0, 0]} castShadow receiveShadow>
          <boxGeometry args={[TILE_SIZE * 0.95, h, TILE_SIZE * 0.95]} />
          <meshStandardMaterial color={sideColor} roughness={0.85} metalness={0.02} />
        </mesh>
      )}
      {/* 그리드 선 (타일 가장자리) */}
      <lineSegments position={[0, h / 2 + 0.05, 0]}>
        <edgesGeometry args={[new THREE.BoxGeometry(TILE_SIZE * 0.95, 0.01, TILE_SIZE * 0.95)]} />
        <lineBasicMaterial color="#ffffff" opacity={0.08} transparent />
      </lineSegments>
    </group>
  );
}

// ========== 유닛별 3D 모델 ==========

// 풍수사 (Feng Shui Master) - 로브 입은 마법사
// 플레이어/소환수 모델은 MonsterModels.js에서 import

// 들쥐 (Field Mouse) - 작은 쥐
function MouseModel() {
  return (
    <group>
      {/* 몸통 (납작한 타원) */}
      <mesh position={[0, 0.12, 0]} scale={[1, 0.7, 1.3]}>
        <sphereGeometry args={[0.15, 8, 8]} />
        <meshStandardMaterial color="#8d6e63" />
      </mesh>
      {/* 머리 */}
      <mesh position={[0, 0.18, 0.14]}>
        <sphereGeometry args={[0.1, 8, 8]} />
        <meshStandardMaterial color="#a1887f" />
      </mesh>
      {/* 귀 좌우 */}
      <mesh position={[-0.08, 0.28, 0.12]}>
        <sphereGeometry args={[0.05, 6, 6]} />
        <meshStandardMaterial color="#ffab91" />
      </mesh>
      <mesh position={[0.08, 0.28, 0.12]}>
        <sphereGeometry args={[0.05, 6, 6]} />
        <meshStandardMaterial color="#ffab91" />
      </mesh>
      {/* 꼬리 */}
      <mesh position={[0, 0.1, -0.2]} rotation={[0.5, 0, 0]}>
        <cylinderGeometry args={[0.01, 0.015, 0.25, 4]} />
        <meshStandardMaterial color="#a1887f" />
      </mesh>
      {/* 눈 */}
      <mesh position={[-0.04, 0.22, 0.22]}>
        <sphereGeometry args={[0.02, 4, 4]} />
        <meshStandardMaterial color="#111" />
      </mesh>
      <mesh position={[0.04, 0.22, 0.22]}>
        <sphereGeometry args={[0.02, 4, 4]} />
        <meshStandardMaterial color="#111" />
      </mesh>
    </group>
  );
}

// 야생 늑대 (Wild Wolf)
function WolfModel() {
  return (
    <group>
      {/* 몸통 */}
      <mesh position={[0, 0.2, 0]} scale={[0.8, 0.8, 1.4]}>
        <sphereGeometry args={[0.2, 8, 8]} />
        <meshStandardMaterial color="#616161" />
      </mesh>
      {/* 머리 */}
      <mesh position={[0, 0.28, 0.22]}>
        <sphereGeometry args={[0.14, 8, 8]} />
        <meshStandardMaterial color="#757575" />
      </mesh>
      {/* 주둥이 */}
      <mesh position={[0, 0.24, 0.36]} scale={[0.7, 0.6, 1]}>
        <sphereGeometry args={[0.08, 6, 6]} />
        <meshStandardMaterial color="#9e9e9e" />
      </mesh>
      {/* 귀 */}
      <mesh position={[-0.08, 0.42, 0.18]}>
        <coneGeometry args={[0.04, 0.12, 4]} />
        <meshStandardMaterial color="#616161" />
      </mesh>
      <mesh position={[0.08, 0.42, 0.18]}>
        <coneGeometry args={[0.04, 0.12, 4]} />
        <meshStandardMaterial color="#616161" />
      </mesh>
      {/* 다리 (4개) */}
      {[[-0.1, 0, 0.1], [0.1, 0, 0.1], [-0.1, 0, -0.1], [0.1, 0, -0.1]].map((p, i) => (
        <mesh key={i} position={p}>
          <cylinderGeometry args={[0.03, 0.03, 0.15, 4]} />
          <meshStandardMaterial color="#424242" />
        </mesh>
      ))}
      {/* 꼬리 */}
      <mesh position={[0, 0.28, -0.28]} rotation={[0.8, 0, 0]}>
        <coneGeometry args={[0.04, 0.2, 4]} />
        <meshStandardMaterial color="#757575" />
      </mesh>
      {/* 눈 (빨간) */}
      <mesh position={[-0.05, 0.32, 0.34]}>
        <sphereGeometry args={[0.02, 4, 4]} />
        <meshStandardMaterial color="#ff1744" emissive="#ff1744" emissiveIntensity={0.5} />
      </mesh>
      <mesh position={[0.05, 0.32, 0.34]}>
        <sphereGeometry args={[0.02, 4, 4]} />
        <meshStandardMaterial color="#ff1744" emissive="#ff1744" emissiveIntensity={0.5} />
      </mesh>
    </group>
  );
}

// 독거미 (Poison Spider)
function SpiderModel() {
  return (
    <group>
      {/* 복부 */}
      <mesh position={[0, 0.14, -0.08]} scale={[1, 0.7, 1.2]}>
        <sphereGeometry args={[0.15, 8, 8]} />
        <meshStandardMaterial color="#4a148c" />
      </mesh>
      {/* 두흉부 */}
      <mesh position={[0, 0.16, 0.1]}>
        <sphereGeometry args={[0.1, 8, 8]} />
        <meshStandardMaterial color="#6a1b9a" />
      </mesh>
      {/* 다리 (8개) */}
      {[
        [-0.18, 0.1, 0.08, 0.4], [0.18, 0.1, 0.08, -0.4],
        [-0.2, 0.1, 0.02, 0.2], [0.2, 0.1, 0.02, -0.2],
        [-0.2, 0.1, -0.04, -0.2], [0.2, 0.1, -0.04, 0.2],
        [-0.18, 0.1, -0.1, -0.4], [0.18, 0.1, -0.1, 0.4],
      ].map(([x, y, z, r], i) => (
        <mesh key={i} position={[x, y, z]} rotation={[0, 0, r]}>
          <cylinderGeometry args={[0.01, 0.015, 0.2, 4]} />
          <meshStandardMaterial color="#311b92" />
        </mesh>
      ))}
      {/* 눈 (여러 개) */}
      {[[-0.04, 0.22, 0.17], [0.04, 0.22, 0.17], [-0.02, 0.24, 0.16], [0.02, 0.24, 0.16]].map((p, i) => (
        <mesh key={i} position={p}>
          <sphereGeometry args={[0.015, 4, 4]} />
          <meshStandardMaterial color="#f44336" emissive="#f44336" emissiveIntensity={0.8} />
        </mesh>
      ))}
      {/* 독 표시 (초록 광택) */}
      <mesh position={[0, 0.12, -0.2]}>
        <sphereGeometry args={[0.03, 4, 4]} />
        <meshStandardMaterial color="#76ff03" emissive="#76ff03" emissiveIntensity={0.6} />
      </mesh>
    </group>
  );
}

// 동굴 박쥐 (Cave Bat)
function BatModel() {
  return (
    <group>
      {/* 몸통 */}
      <mesh position={[0, 0.25, 0]}>
        <sphereGeometry args={[0.1, 8, 8]} />
        <meshStandardMaterial color="#37474f" />
      </mesh>
      {/* 머리 */}
      <mesh position={[0, 0.35, 0.04]}>
        <sphereGeometry args={[0.08, 8, 8]} />
        <meshStandardMaterial color="#455a64" />
      </mesh>
      {/* 귀 */}
      <mesh position={[-0.06, 0.44, 0.02]}>
        <coneGeometry args={[0.03, 0.1, 4]} />
        <meshStandardMaterial color="#37474f" />
      </mesh>
      <mesh position={[0.06, 0.44, 0.02]}>
        <coneGeometry args={[0.03, 0.1, 4]} />
        <meshStandardMaterial color="#37474f" />
      </mesh>
      {/* 날개 좌 */}
      <mesh position={[-0.25, 0.28, 0]} rotation={[0, 0, 0.3]} scale={[1.5, 0.1, 1]}>
        <boxGeometry args={[0.22, 0.02, 0.2]} />
        <meshStandardMaterial color="#263238" transparent opacity={0.8} />
      </mesh>
      {/* 날개 우 */}
      <mesh position={[0.25, 0.28, 0]} rotation={[0, 0, -0.3]} scale={[1.5, 0.1, 1]}>
        <boxGeometry args={[0.22, 0.02, 0.2]} />
        <meshStandardMaterial color="#263238" transparent opacity={0.8} />
      </mesh>
      {/* 눈 */}
      <mesh position={[-0.03, 0.37, 0.1]}>
        <sphereGeometry args={[0.02, 4, 4]} />
        <meshStandardMaterial color="#ffeb3b" emissive="#ffeb3b" emissiveIntensity={0.6} />
      </mesh>
      <mesh position={[0.03, 0.37, 0.1]}>
        <sphereGeometry args={[0.02, 4, 4]} />
        <meshStandardMaterial color="#ffeb3b" emissive="#ffeb3b" emissiveIntensity={0.6} />
      </mesh>
    </group>
  );
}

// 골렘 (Golem) - 크고 단단한 바위 덩어리
function GolemModel() {
  return (
    <group>
      {/* 하체 (큰 박스) */}
      <mesh position={[0, 0.2, 0]}>
        <boxGeometry args={[0.4, 0.35, 0.35]} />
        <meshStandardMaterial color="#78909c" roughness={0.9} />
      </mesh>
      {/* 상체 */}
      <mesh position={[0, 0.48, 0]}>
        <boxGeometry args={[0.48, 0.25, 0.38]} />
        <meshStandardMaterial color="#607d8b" roughness={0.9} />
      </mesh>
      {/* 머리 */}
      <mesh position={[0, 0.68, 0]}>
        <boxGeometry args={[0.25, 0.2, 0.22]} />
        <meshStandardMaterial color="#546e7a" roughness={0.9} />
      </mesh>
      {/* 눈 (발광) */}
      <mesh position={[-0.06, 0.7, 0.12]}>
        <boxGeometry args={[0.04, 0.03, 0.02]} />
        <meshStandardMaterial color="#ff9100" emissive="#ff6d00" emissiveIntensity={1} />
      </mesh>
      <mesh position={[0.06, 0.7, 0.12]}>
        <boxGeometry args={[0.04, 0.03, 0.02]} />
        <meshStandardMaterial color="#ff9100" emissive="#ff6d00" emissiveIntensity={1} />
      </mesh>
      {/* 팔 좌 */}
      <mesh position={[-0.32, 0.38, 0]}>
        <boxGeometry args={[0.15, 0.35, 0.15]} />
        <meshStandardMaterial color="#78909c" roughness={0.9} />
      </mesh>
      {/* 팔 우 */}
      <mesh position={[0.32, 0.38, 0]}>
        <boxGeometry args={[0.15, 0.35, 0.15]} />
        <meshStandardMaterial color="#78909c" roughness={0.9} />
      </mesh>
      {/* 이끼/균열 표시 */}
      <mesh position={[0.1, 0.35, 0.18]}>
        <boxGeometry args={[0.08, 0.06, 0.01]} />
        <meshStandardMaterial color="#558b2f" />
      </mesh>
    </group>
  );
}

// 지하 도마뱀 (Underground Lizard)
function LizardModel() {
  return (
    <group>
      {/* 몸통 */}
      <mesh position={[0, 0.13, 0]} scale={[0.8, 0.5, 1.5]}>
        <sphereGeometry args={[0.16, 8, 8]} />
        <meshStandardMaterial color="#2e7d32" />
      </mesh>
      {/* 머리 */}
      <mesh position={[0, 0.16, 0.22]} scale={[0.8, 0.6, 1]}>
        <sphereGeometry args={[0.1, 8, 8]} />
        <meshStandardMaterial color="#388e3c" />
      </mesh>
      {/* 눈 (돌출) */}
      <mesh position={[-0.06, 0.22, 0.28]}>
        <sphereGeometry args={[0.03, 4, 4]} />
        <meshStandardMaterial color="#fdd835" />
      </mesh>
      <mesh position={[0.06, 0.22, 0.28]}>
        <sphereGeometry args={[0.03, 4, 4]} />
        <meshStandardMaterial color="#fdd835" />
      </mesh>
      {/* 다리 */}
      {[[-0.14, 0.04, 0.1], [0.14, 0.04, 0.1], [-0.14, 0.04, -0.08], [0.14, 0.04, -0.08]].map((p, i) => (
        <mesh key={i} position={p} rotation={[0, 0, i < 2 ? 0.4 : -0.4]}>
          <cylinderGeometry args={[0.02, 0.03, 0.12, 4]} />
          <meshStandardMaterial color="#1b5e20" />
        </mesh>
      ))}
      {/* 꼬리 */}
      <mesh position={[0, 0.1, -0.3]} rotation={[0.2, 0, 0]} scale={[0.5, 0.4, 1]}>
        <coneGeometry args={[0.06, 0.3, 6]} />
        <meshStandardMaterial color="#2e7d32" />
      </mesh>
      {/* 등 돌기 */}
      {[0, 0.08, 0.16].map((z, i) => (
        <mesh key={i} position={[0, 0.22, z - 0.04]}>
          <coneGeometry args={[0.02, 0.06, 4]} />
          <meshStandardMaterial color="#1b5e20" />
        </mesh>
      ))}
    </group>
  );
}

// 원혼 (Vengeful Spirit) - 투명한 유령
function GhostModel() {
  return (
    <group>
      {/* 유령 몸체 (아래 넓어지는 형태) */}
      <mesh position={[0, 0.25, 0]}>
        <coneGeometry args={[0.28, 0.55, 8]} />
        <meshStandardMaterial color="#b388ff" transparent opacity={0.5} />
      </mesh>
      {/* 머리 */}
      <mesh position={[0, 0.55, 0]}>
        <sphereGeometry args={[0.16, 8, 8]} />
        <meshStandardMaterial color="#ce93d8" transparent opacity={0.6} />
      </mesh>
      {/* 눈 */}
      <mesh position={[-0.06, 0.57, 0.14]}>
        <sphereGeometry args={[0.04, 6, 6]} />
        <meshStandardMaterial color="#e1f5fe" emissive="#e1f5fe" emissiveIntensity={1} />
      </mesh>
      <mesh position={[0.06, 0.57, 0.14]}>
        <sphereGeometry args={[0.04, 6, 6]} />
        <meshStandardMaterial color="#e1f5fe" emissive="#e1f5fe" emissiveIntensity={1} />
      </mesh>
      {/* 흔들리는 팔 */}
      <mesh position={[-0.2, 0.4, 0.05]} rotation={[0, 0, 0.5]}>
        <coneGeometry args={[0.04, 0.2, 4]} />
        <meshStandardMaterial color="#b388ff" transparent opacity={0.4} />
      </mesh>
      <mesh position={[0.2, 0.4, 0.05]} rotation={[0, 0, -0.5]}>
        <coneGeometry args={[0.04, 0.2, 4]} />
        <meshStandardMaterial color="#b388ff" transparent opacity={0.4} />
      </mesh>
      {/* 영혼 오라 */}
      <mesh position={[0, 0.4, 0]}>
        <sphereGeometry args={[0.35, 8, 8]} />
        <meshStandardMaterial color="#7c4dff" transparent opacity={0.1} />
      </mesh>
    </group>
  );
}

// 저주받은 승려 (Cursed Monk) - 어둡게 변한 승려
function CursedMonkModel() {
  return (
    <group>
      {/* 승복 하의 (찢어진) */}
      <mesh position={[0, 0.2, 0]}>
        <coneGeometry args={[0.3, 0.5, 8]} />
        <meshStandardMaterial color="#37474f" />
      </mesh>
      {/* 상체 */}
      <mesh position={[0, 0.45, 0]}>
        <cylinderGeometry args={[0.16, 0.22, 0.2, 8]} />
        <meshStandardMaterial color="#263238" />
      </mesh>
      {/* 머리 */}
      <mesh position={[0, 0.62, 0]}>
        <sphereGeometry args={[0.15, 8, 8]} />
        <meshStandardMaterial color="#78909c" />
      </mesh>
      {/* 저주의 눈 (빨간 발광) */}
      <mesh position={[-0.05, 0.64, 0.13]}>
        <sphereGeometry args={[0.03, 4, 4]} />
        <meshStandardMaterial color="#f44336" emissive="#f44336" emissiveIntensity={1.2} />
      </mesh>
      <mesh position={[0.05, 0.64, 0.13]}>
        <sphereGeometry args={[0.03, 4, 4]} />
        <meshStandardMaterial color="#f44336" emissive="#f44336" emissiveIntensity={1.2} />
      </mesh>
      {/* 저주 염주 */}
      <mesh position={[0, 0.5, 0.14]}>
        <torusGeometry args={[0.1, 0.015, 6, 12]} />
        <meshStandardMaterial color="#4a148c" emissive="#7b1fa2" emissiveIntensity={0.4} />
      </mesh>
      {/* 어둠 오라 */}
      <mesh position={[0, 0.4, 0]}>
        <sphereGeometry args={[0.38, 8, 8]} />
        <meshStandardMaterial color="#311b92" transparent opacity={0.12} />
      </mesh>
    </group>
  );
}

// 어둠의 수호자 (Dark Guardian) - 뿔 달린 큰 악마형
function DarkGuardianModel() {
  return (
    <group>
      {/* 하체 */}
      <mesh position={[0, 0.22, 0]}>
        <cylinderGeometry args={[0.24, 0.3, 0.45, 8]} />
        <meshStandardMaterial color="#b71c1c" />
      </mesh>
      {/* 상체 (넓은 어깨) */}
      <mesh position={[0, 0.52, 0]}>
        <boxGeometry args={[0.5, 0.25, 0.3]} />
        <meshStandardMaterial color="#880e4f" />
      </mesh>
      {/* 머리 */}
      <mesh position={[0, 0.72, 0]}>
        <sphereGeometry args={[0.14, 8, 8]} />
        <meshStandardMaterial color="#4a148c" />
      </mesh>
      {/* 뿔 좌 */}
      <mesh position={[-0.12, 0.88, 0]} rotation={[0, 0, 0.3]}>
        <coneGeometry args={[0.03, 0.18, 4]} />
        <meshStandardMaterial color="#1a1a1a" />
      </mesh>
      {/* 뿔 우 */}
      <mesh position={[0.12, 0.88, 0]} rotation={[0, 0, -0.3]}>
        <coneGeometry args={[0.03, 0.18, 4]} />
        <meshStandardMaterial color="#1a1a1a" />
      </mesh>
      {/* 눈 (강한 발광) */}
      <mesh position={[-0.05, 0.74, 0.12]}>
        <sphereGeometry args={[0.03, 4, 4]} />
        <meshStandardMaterial color="#ff1744" emissive="#d50000" emissiveIntensity={1.5} />
      </mesh>
      <mesh position={[0.05, 0.74, 0.12]}>
        <sphereGeometry args={[0.03, 4, 4]} />
        <meshStandardMaterial color="#ff1744" emissive="#d50000" emissiveIntensity={1.5} />
      </mesh>
      {/* 어깨 가시 */}
      <mesh position={[-0.3, 0.58, 0]} rotation={[0, 0, 0.6]}>
        <coneGeometry args={[0.04, 0.14, 4]} />
        <meshStandardMaterial color="#880e4f" />
      </mesh>
      <mesh position={[0.3, 0.58, 0]} rotation={[0, 0, -0.6]}>
        <coneGeometry args={[0.04, 0.14, 4]} />
        <meshStandardMaterial color="#880e4f" />
      </mesh>
      {/* 어둠 불꽃 오라 */}
      <mesh position={[0, 0.45, 0]}>
        <sphereGeometry args={[0.42, 8, 8]} />
        <meshStandardMaterial color="#d50000" transparent opacity={0.08} />
      </mesh>
    </group>
  );
}

// 구미호 영혼 (Nine-Tailed Fox Spirit)
function FoxModel() {
  return (
    <group>
      {/* 몸통 */}
      <mesh position={[0, 0.18, 0]} scale={[0.7, 0.7, 1.2]}>
        <sphereGeometry args={[0.18, 8, 8]} />
        <meshStandardMaterial color="#ff8a65" />
      </mesh>
      {/* 머리 */}
      <mesh position={[0, 0.26, 0.18]}>
        <sphereGeometry args={[0.12, 8, 8]} />
        <meshStandardMaterial color="#ffab91" />
      </mesh>
      {/* 귀 */}
      <mesh position={[-0.08, 0.38, 0.16]}>
        <coneGeometry args={[0.035, 0.12, 4]} />
        <meshStandardMaterial color="#ff7043" />
      </mesh>
      <mesh position={[0.08, 0.38, 0.16]}>
        <coneGeometry args={[0.035, 0.12, 4]} />
        <meshStandardMaterial color="#ff7043" />
      </mesh>
      {/* 주둥이 */}
      <mesh position={[0, 0.22, 0.28]} scale={[0.6, 0.5, 1]}>
        <sphereGeometry args={[0.06, 6, 6]} />
        <meshStandardMaterial color="#ffe0b2" />
      </mesh>
      {/* 꼬리 (영적 발광) */}
      {[-0.08, 0, 0.08].map((x, i) => (
        <mesh key={i} position={[x, 0.22 + i * 0.03, -0.25]} rotation={[0.6, x * 2, 0]}>
          <coneGeometry args={[0.03, 0.2, 4]} />
          <meshStandardMaterial color="#ce93d8" emissive="#ab47bc" emissiveIntensity={0.4} transparent opacity={0.7} />
        </mesh>
      ))}
      {/* 눈 */}
      <mesh position={[-0.04, 0.3, 0.28]}>
        <sphereGeometry args={[0.02, 4, 4]} />
        <meshStandardMaterial color="#ffeb3b" emissive="#ffc107" emissiveIntensity={0.6} />
      </mesh>
      <mesh position={[0.04, 0.3, 0.28]}>
        <sphereGeometry args={[0.02, 4, 4]} />
        <meshStandardMaterial color="#ffeb3b" emissive="#ffc107" emissiveIntensity={0.6} />
      </mesh>
    </group>
  );
}

// 물의 정령 (Water Elemental)
function WaterElementalModel() {
  return (
    <group>
      {/* 하체 (물 소용돌이) */}
      <mesh position={[0, 0.18, 0]}>
        <coneGeometry args={[0.25, 0.4, 8]} />
        <meshStandardMaterial color="#29b6f6" transparent opacity={0.5} />
      </mesh>
      {/* 상체 */}
      <mesh position={[0, 0.4, 0]}>
        <sphereGeometry args={[0.18, 8, 8]} />
        <meshStandardMaterial color="#4fc3f7" transparent opacity={0.6} />
      </mesh>
      {/* 머리 */}
      <mesh position={[0, 0.6, 0]}>
        <sphereGeometry args={[0.12, 8, 8]} />
        <meshStandardMaterial color="#81d4fa" transparent opacity={0.65} />
      </mesh>
      {/* 눈 */}
      <mesh position={[-0.04, 0.62, 0.1]}>
        <sphereGeometry args={[0.025, 4, 4]} />
        <meshStandardMaterial color="#e1f5fe" emissive="#e1f5fe" emissiveIntensity={1} />
      </mesh>
      <mesh position={[0.04, 0.62, 0.1]}>
        <sphereGeometry args={[0.025, 4, 4]} />
        <meshStandardMaterial color="#e1f5fe" emissive="#e1f5fe" emissiveIntensity={1} />
      </mesh>
      {/* 물 오라 */}
      <mesh position={[0, 0.35, 0]}>
        <sphereGeometry args={[0.32, 8, 8]} />
        <meshStandardMaterial color="#039be5" transparent opacity={0.1} />
      </mesh>
    </group>
  );
}

// 불의 정령 (Fire Elemental)
function FireElementalModel() {
  return (
    <group>
      {/* 하체 (불꽃) */}
      <mesh position={[0, 0.18, 0]}>
        <coneGeometry args={[0.25, 0.4, 8]} />
        <meshStandardMaterial color="#f57c00" transparent opacity={0.6} />
      </mesh>
      {/* 상체 */}
      <mesh position={[0, 0.4, 0]}>
        <sphereGeometry args={[0.18, 8, 8]} />
        <meshStandardMaterial color="#ff9800" emissive="#e65100" emissiveIntensity={0.4} />
      </mesh>
      {/* 머리 */}
      <mesh position={[0, 0.6, 0]}>
        <sphereGeometry args={[0.12, 8, 8]} />
        <meshStandardMaterial color="#ffb74d" emissive="#ff6d00" emissiveIntensity={0.5} />
      </mesh>
      {/* 불꽃 정수리 */}
      <mesh position={[0, 0.76, 0]}>
        <coneGeometry args={[0.08, 0.15, 6]} />
        <meshStandardMaterial color="#ff5722" emissive="#dd2c00" emissiveIntensity={0.8} />
      </mesh>
      {/* 눈 */}
      <mesh position={[-0.04, 0.62, 0.1]}>
        <sphereGeometry args={[0.025, 4, 4]} />
        <meshStandardMaterial color="#fff9c4" emissive="#fff9c4" emissiveIntensity={1.2} />
      </mesh>
      <mesh position={[0.04, 0.62, 0.1]}>
        <sphereGeometry args={[0.025, 4, 4]} />
        <meshStandardMaterial color="#fff9c4" emissive="#fff9c4" emissiveIntensity={1.2} />
      </mesh>
      {/* 불 오라 */}
      <mesh position={[0, 0.35, 0]}>
        <sphereGeometry args={[0.3, 8, 8]} />
        <meshStandardMaterial color="#ff3d00" transparent opacity={0.1} />
      </mesh>
    </group>
  );
}

// 바람의 정령 (Wind Elemental)
function WindElementalModel() {
  return (
    <group>
      {/* 소용돌이 하체 */}
      <mesh position={[0, 0.18, 0]}>
        <coneGeometry args={[0.22, 0.4, 8]} />
        <meshStandardMaterial color="#b2dfdb" transparent opacity={0.35} />
      </mesh>
      {/* 상체 */}
      <mesh position={[0, 0.4, 0]}>
        <sphereGeometry args={[0.16, 8, 8]} />
        <meshStandardMaterial color="#80cbc4" transparent opacity={0.45} />
      </mesh>
      {/* 머리 */}
      <mesh position={[0, 0.58, 0]}>
        <sphereGeometry args={[0.11, 8, 8]} />
        <meshStandardMaterial color="#b2dfdb" transparent opacity={0.5} />
      </mesh>
      {/* 눈 */}
      <mesh position={[-0.04, 0.6, 0.09]}>
        <sphereGeometry args={[0.02, 4, 4]} />
        <meshStandardMaterial color="#e0f7fa" emissive="#e0f7fa" emissiveIntensity={1} />
      </mesh>
      <mesh position={[0.04, 0.6, 0.09]}>
        <sphereGeometry args={[0.02, 4, 4]} />
        <meshStandardMaterial color="#e0f7fa" emissive="#e0f7fa" emissiveIntensity={1} />
      </mesh>
      {/* 바람 나선 */}
      <mesh position={[0, 0.35, 0]} rotation={[0.3, 0, 0]}>
        <torusGeometry args={[0.28, 0.015, 6, 16]} />
        <meshStandardMaterial color="#4db6ac" transparent opacity={0.25} />
      </mesh>
    </group>
  );
}

// 해골 전사 (Skeleton Warrior)
function SkeletonModel() {
  return (
    <group>
      {/* 다리 */}
      <mesh position={[-0.06, 0.12, 0]}>
        <cylinderGeometry args={[0.03, 0.04, 0.24, 4]} />
        <meshStandardMaterial color="#efebe9" />
      </mesh>
      <mesh position={[0.06, 0.12, 0]}>
        <cylinderGeometry args={[0.03, 0.04, 0.24, 4]} />
        <meshStandardMaterial color="#efebe9" />
      </mesh>
      {/* 골반 */}
      <mesh position={[0, 0.26, 0]}>
        <boxGeometry args={[0.2, 0.06, 0.12]} />
        <meshStandardMaterial color="#d7ccc8" />
      </mesh>
      {/* 흉곽 */}
      <mesh position={[0, 0.4, 0]}>
        <boxGeometry args={[0.22, 0.2, 0.14]} />
        <meshStandardMaterial color="#efebe9" />
      </mesh>
      {/* 두개골 */}
      <mesh position={[0, 0.58, 0]}>
        <sphereGeometry args={[0.11, 8, 8]} />
        <meshStandardMaterial color="#fff8e1" />
      </mesh>
      {/* 눈구멍 */}
      <mesh position={[-0.04, 0.6, 0.09]}>
        <sphereGeometry args={[0.025, 4, 4]} />
        <meshStandardMaterial color="#111" />
      </mesh>
      <mesh position={[0.04, 0.6, 0.09]}>
        <sphereGeometry args={[0.025, 4, 4]} />
        <meshStandardMaterial color="#111" />
      </mesh>
      {/* 검 */}
      <mesh position={[0.2, 0.35, 0]} rotation={[0, 0, -0.2]}>
        <boxGeometry args={[0.03, 0.35, 0.02]} />
        <meshStandardMaterial color="#90a4ae" metalness={0.7} roughness={0.3} />
      </mesh>
      {/* 방패 */}
      <mesh position={[-0.2, 0.38, 0.04]}>
        <boxGeometry args={[0.04, 0.16, 0.12]} />
        <meshStandardMaterial color="#5d4037" />
      </mesh>
    </group>
  );
}

// 리치 (Lich) - 강력한 언데드 마법사
function LichModel() {
  return (
    <group>
      {/* 로브 */}
      <mesh position={[0, 0.22, 0]}>
        <coneGeometry args={[0.3, 0.5, 8]} />
        <meshStandardMaterial color="#1a237e" />
      </mesh>
      {/* 상체 */}
      <mesh position={[0, 0.48, 0]}>
        <cylinderGeometry args={[0.14, 0.2, 0.18, 8]} />
        <meshStandardMaterial color="#0d47a1" />
      </mesh>
      {/* 두개골 */}
      <mesh position={[0, 0.64, 0]}>
        <sphereGeometry args={[0.13, 8, 8]} />
        <meshStandardMaterial color="#e8eaf6" />
      </mesh>
      {/* 왕관 */}
      <mesh position={[0, 0.78, 0]}>
        <cylinderGeometry args={[0.08, 0.12, 0.06, 6]} />
        <meshStandardMaterial color="#7b1fa2" emissive="#4a148c" emissiveIntensity={0.5} />
      </mesh>
      {/* 눈 (보라 발광) */}
      <mesh position={[-0.04, 0.66, 0.11]}>
        <sphereGeometry args={[0.03, 4, 4]} />
        <meshStandardMaterial color="#d500f9" emissive="#aa00ff" emissiveIntensity={1.5} />
      </mesh>
      <mesh position={[0.04, 0.66, 0.11]}>
        <sphereGeometry args={[0.03, 4, 4]} />
        <meshStandardMaterial color="#d500f9" emissive="#aa00ff" emissiveIntensity={1.5} />
      </mesh>
      {/* 마법 지팡이 */}
      <mesh position={[0.25, 0.4, 0]}>
        <cylinderGeometry args={[0.02, 0.02, 0.65, 4]} />
        <meshStandardMaterial color="#4a148c" />
      </mesh>
      {/* 지팡이 보석 */}
      <mesh position={[0.25, 0.75, 0]}>
        <octahedronGeometry args={[0.06, 0]} />
        <meshStandardMaterial color="#e040fb" emissive="#e040fb" emissiveIntensity={0.8} />
      </mesh>
      {/* 어둠 오라 */}
      <mesh position={[0, 0.4, 0]}>
        <sphereGeometry args={[0.38, 8, 8]} />
        <meshStandardMaterial color="#4a148c" transparent opacity={0.08} />
      </mesh>
    </group>
  );
}

// 골렘 파편 (소환수 - 작은 바위)
function MiniGolemModel() {
  return (
    <group>
      <mesh position={[0, 0.15, 0]}>
        <boxGeometry args={[0.25, 0.25, 0.22]} />
        <meshStandardMaterial color="#90a4ae" roughness={0.9} />
      </mesh>
      <mesh position={[0, 0.32, 0]}>
        <boxGeometry args={[0.2, 0.12, 0.18]} />
        <meshStandardMaterial color="#78909c" roughness={0.9} />
      </mesh>
      <mesh position={[-0.04, 0.35, 0.1]}>
        <sphereGeometry args={[0.02, 4, 4]} />
        <meshStandardMaterial color="#ff9100" emissive="#ff6d00" emissiveIntensity={0.8} />
      </mesh>
      <mesh position={[0.04, 0.35, 0.1]}>
        <sphereGeometry args={[0.02, 4, 4]} />
        <meshStandardMaterial color="#ff9100" emissive="#ff6d00" emissiveIntensity={0.8} />
      </mesh>
    </group>
  );
}

// 기본 폴백 모델 (원래 실린더 + 구 스타일)
function DefaultModel({ color, isPlayer }) {
  return (
    <group>
      <mesh position={[0, 0.25, 0]}>
        <cylinderGeometry args={[0.25, 0.3, 0.5, 8]} />
        <meshStandardMaterial color={color} />
      </mesh>
      <mesh position={[0, 0.6, 0]}>
        <sphereGeometry args={[0.18, 8, 8]} />
        <meshStandardMaterial color={isPlayer ? '#e3f2fd' : '#ffcdd2'} />
      </mesh>
    </group>
  );
}

// 유닛 이름/아이콘으로 적절한 3D 모델 선택
function getUnitModel(unit) {
  const name = unit.name || '';
  const icon = unit.icon || '';
  const classType = unit.classType || '';

  // 플레이어 클래스
  if (unit.id === 'player') {
    if (classType === '풍수사') return 'mage';
    if (classType === '무당') return 'shaman';
    if (classType === '승려') return 'monk';
    return 'mage';
  }

  // 용병 (mercId 기반)
  if (unit.team === 'player' && unit.id.startsWith('merc_') && unit.mercId) {
    return `merc_${unit.mercId}`;
  }

  // 소환수 (먼저 체크 - 이름/아이콘 기반)
  if (unit.team === 'player' && unit.id.startsWith('summon_')) {
    if (name.includes('떠도는 원혼')) return 'wanderingSoul';
    if (name.includes('묘지 귀신')) return 'graveyardGhost';
    if (name.includes('구미호')) return 'nineTailFoxSummon';
    if (name.includes('들쥐')) return 'mouseSummon';
    if (name.includes('야생 늑대') || name.includes('늑대')) return 'wolfSummon';
    if (name.includes('골렘 파편')) return 'golemFragment';
    if (name.includes('독거미')) return 'spiderQueenSummon';
    if (name.includes('물의 정령')) return 'waterSpiritSummon';
    if (name.includes('불의 정령')) return 'fireSpiritSummon';
    if (name.includes('바람')) return 'windSpiritSummon';
    if (name.includes('해골')) return 'skeletonWarriorSummon';
    if (name.includes('리치')) return 'lichSummon';
    // 아이콘 폴백
    if (icon === '🦊') return 'nineTailFoxSummon';
    if (icon === '💧') return 'waterSpiritSummon';
    if (icon === '🔥') return 'fireSpiritSummon';
    if (icon === '🌪️') return 'windSpiritSummon';
    if (icon === '💀') return 'skeletonWarriorSummon';
    if (icon === '☠️') return 'lichSummon';
    if (icon === '🐀') return 'mouseSummon';
    if (icon === '🐺') return 'wolfSummon';
    if (icon === '🪨') return 'golemFragment';
    if (icon === '🕷️') return 'spiderQueenSummon';
    if (icon === '👻') return 'wanderingSoul';
    return 'wanderingSoul'; // 기본 소환수
  }

  // === 야수 (Beasts) ===
  if (name.includes('산토끼')) return 'rabbit';
  if (name.includes('들쥐')) return 'mouse';
  if (name.includes('멧돼지')) return 'boar';
  if (name.includes('독사')) return 'viper';
  if (name.includes('야생') && name.includes('늑대')) return 'wolf';
  if (name.includes('흑곰')) return 'blackBear';
  if (name.includes('설표')) return 'snowLeopard';
  if (name.includes('회색') && name.includes('곰')) return 'grayBear';
  if (name.includes('구렁이')) return 'python';
  if (name.includes('백호')) return 'whiteTiger';
  if (name.includes('삼두견')) return 'threeHeadedHound';
  if (name.includes('천년') && name.includes('여우')) return 'ancientFox';

  // === 곤충 (Insects) ===
  if (name.includes('거대') && name.includes('지네')) return 'centipede';
  if (name.includes('독나방')) return 'poisonMoth';
  if (name.includes('킬러비')) return 'killerBee';
  if (name.includes('전갈')) return 'scorpion';
  if (name.includes('여왕') && name.includes('개미')) return 'queenAnt';
  if (name.includes('장수풍뎅이')) return 'stagBeetle';
  if (name.includes('독거미') && name.includes('여왕')) return 'spiderQueen';
  if (name.includes('독거미') || name.includes('거미')) return 'spider';
  if (name.includes('사마귀')) return 'mantisWarrior';

  // === 언데드 (Undead) ===
  if (name.includes('스켈레톤') || (name.includes('해골') && name.includes('전사'))) return 'skeleton';
  if (name.includes('해골') && name.includes('궁수')) return 'skeletalArcher';
  if (name.includes('좀비')) return 'zombie';
  if (name.includes('구울')) return 'ghoul';
  if (name.includes('레이스')) return 'wraith';
  if (name.includes('뱀파이어')) return 'vampire';
  if (name.includes('데스나이트')) return 'deathKnight';
  if (name.includes('리치왕')) return 'lichKing';
  if (name.includes('리치')) return 'lich';
  if (name.includes('미라')) return 'mummy';

  // === 귀신 (Ghosts) ===
  if (name.includes('원혼')) return 'ghost';
  if (name.includes('떠도는') && name.includes('영혼')) return 'wanderingSpirit';
  if (name.includes('처녀귀신')) return 'maidenGhost';
  if (name.includes('야차')) return 'yaksha';
  if (name.includes('물귀신')) return 'waterGhost';
  if (name.includes('이무기')) return 'imoogi';
  if (name.includes('검은') && name.includes('그림자')) return 'blackShadow';
  if (name.includes('봉사귀')) return 'blindSpirit';
  if (name.includes('달귀')) return 'moonGhost';

  // === 정령 (Elementals) ===
  if (name.includes('물의') && name.includes('정령')) return 'waterElemental';
  if (name.includes('불의') && name.includes('정령')) return 'fireElemental';
  if (name.includes('바람의') && name.includes('정령')) return 'windElemental';
  if (name.includes('대지') && name.includes('정령')) return 'earthElemental';
  if (name.includes('번개') && name.includes('정령')) return 'lightningElemental';
  if (name.includes('얼음') && name.includes('정령')) return 'iceElemental';
  if (name.includes('빛의') && name.includes('정령')) return 'lightElemental';
  if (name.includes('어둠의') && name.includes('정령')) return 'darkElemental';
  if (name.includes('정령왕')) return 'elementalKing';

  // === 악마 (Demons) ===
  if (name.includes('임프')) return 'imp';
  if (name.includes('서큐버스')) return 'succubus';
  if (name.includes('인큐버스')) return 'incubus';
  if (name.includes('지옥견')) return 'hellHound';
  if (name.includes('발록')) return 'balrog';
  if (name.includes('마왕의') || (name.includes('마왕') && name.includes('부하'))) return 'demonServant';
  if (name.includes('타락') && name.includes('천사')) return 'fallenAngel';
  if (name === '마왕') return 'demonKing';
  if (name.includes('가고일')) return 'gargoyle';

  // === 용족 (Dragons) ===
  if (name.includes('드래곤') && name.includes('해츨링')) return 'dragonHatchling';
  if (name.includes('와이번')) return 'wyvern';
  if (name.includes('화룡')) return 'fireDragon';
  if (name.includes('빙룡')) return 'iceDragon';
  if (name.includes('암흑룡')) return 'darkDragon';
  if (name.includes('용왕')) return 'dragonKing';
  if (name.includes('드레이크')) return 'drake';
  if (name.includes('히드라')) return 'hydra';

  // === 마법생물 (Magic Creatures) ===
  if (name.includes('마법') && name.includes('갑옷')) return 'magicArmor';
  if (name.includes('가디언')) return 'guardian';
  if (name.includes('호문쿨루스')) return 'homunculus';
  if (name.includes('마나') && name.includes('골렘')) return 'manaGolem';
  if (name.includes('골렘')) return 'golem';
  if (name.includes('유니콘')) return 'unicorn';
  if (name.includes('그리핀')) return 'griffin';
  if (name.includes('피닉스')) return 'phoenix';
  if (name.includes('미믹')) return 'mimic';

  // === 식물 (Plants) ===
  if (name.includes('독버섯')) return 'poisonMushroom';
  if (name.includes('덩굴')) return 'vineMonster';
  if (name.includes('트렌트')) return 'treant';
  if (name.includes('식인화')) return 'carnivorousPlant';
  if (name.includes('포자')) return 'sporeSwarm';
  if (name.includes('만드레이크')) return 'mandrake';
  if (name.includes('세계수')) return 'worldTreeFragment';
  if (name.includes('균류')) return 'fungalLord';

  // === 인간형 (Humanoids) ===
  if (name.includes('산적')) return 'bandit';
  if (name.includes('암살자')) return 'assassin';
  if (name.includes('흑마법사')) return 'darkWizard';
  if (name.includes('타락') && name.includes('기사')) return 'fallenKnight';
  if (name.includes('광전사')) return 'berserker';
  if (name.includes('네크로맨서')) return 'necromancer';
  if (name.includes('대마법사')) return 'grandWizard';
  if (name.includes('도적') && name.includes('두목')) return 'thiefLeader';

  // === 도깨비 (Dokkaebi) ===
  if (name.includes('깨비대왕')) return 'dokkaebiKing';
  if (name.includes('도깨비') && name.includes('장군')) return 'dokkaebiGeneral';
  if (name.includes('꼬마') && name.includes('도깨비')) return 'smallDokkaebi';
  if (name.includes('불') && name.includes('도깨비')) return 'fireDokkaebi';
  if (name.includes('돌') && name.includes('도깨비')) return 'stoneDokkaebi';
  if (name.includes('연못') && name.includes('도깨비')) return 'pondDokkaebi';
  if (name.includes('도깨비') && name.includes('방망이')) return 'dokkaebiClub';
  if (name.includes('숲') && name.includes('도깨비')) return 'forestDokkaebi';

  // === 요괴 (Yokai/Mutants) ===
  if (name.includes('구미호')) return 'fox';
  if (name.includes('해태')) return 'haetae';
  if (name.includes('불가사리')) return 'bulgasari';
  if (name.includes('키메라')) return 'chimera';
  if (name.includes('미노타우르스')) return 'minotaur';
  if (name.includes('메두사')) return 'medusa';
  if (name.includes('거인')) return 'giant';
  if (name.includes('늑대인간')) return 'werewolf';

  // === 슬라임 (Slimes) ===
  if (name.includes('킹') && name.includes('슬라임')) return 'kingSlime';
  if (name.includes('초록') && name.includes('슬라임')) return 'greenSlime';
  if (name.includes('파랑') && name.includes('슬라임')) return 'blueSlime';
  if (name.includes('빨강') && name.includes('슬라임')) return 'redSlime';
  if (name.includes('독') && name.includes('슬라임')) return 'poisonSlime';
  if (name.includes('금속') && name.includes('슬라임')) return 'metalSlime';
  if (name.includes('젤리피쉬')) return 'jellyfish';
  if (name.includes('점액') && name.includes('군주')) return 'slimeLord';

  // === 수생 (Aquatic) ===
  if (name.includes('대왕') && name.includes('게')) return 'kingCrab';
  if (name.includes('상어')) return 'shark';
  if (name.includes('대왕') && name.includes('문어')) return 'giantOctopus';
  if (name.includes('인어') && name.includes('전사')) return 'mermaidWarrior';
  if (name.includes('심해어')) return 'deepSeaFish';
  if (name.includes('크라켄')) return 'kraken';
  if (name.includes('해마') && name.includes('기사')) return 'seahorseKnight';
  if (name.includes('바다') && name.includes('용')) return 'seaDragon';

  // === 기존 모델 폴백 ===
  if (name.includes('늑대')) return 'wolf';
  if (name.includes('박쥐')) return 'bat';
  if (name.includes('도마뱀')) return 'lizard';
  if (name.includes('저주받은')) return 'cursedMonk';
  if (name.includes('수호자')) return 'darkGuardian';
  if (name.includes('귀신')) return 'ghost';

  // 아이콘 기반 폴백
  if (icon === '🐀') return 'mouse';
  if (icon === '🐺') return 'wolf';
  if (icon === '🕷️') return 'spider';
  if (icon === '🦇') return 'bat';
  if (icon === '🗿') return 'golem';
  if (icon === '🦎') return 'lizard';
  if (icon === '😈') return 'darkGuardian';
  if (icon === '🧟') return 'cursedMonk';
  if (icon === '👻') return 'ghost';

  return 'default';
}

// ========== GLB 모델 로딩 시스템 (option 2) ==========
// public/models/ 폴더에 GLB 파일이 있으면 자동으로 로드
// 파일명 규칙: {modelType}.glb (예: wolf.glb, ghost.glb, mage.glb)
const GLB_MODEL_SCALES = {
  // 플레이어 (기준 0.55)
  player_pungsu: 0.55, player_mudang: 0.55, player_monk: 0.55,
  mage: 0.55, shaman: 0.55, monk: 0.55,
  // 소형 (0.35)
  mouse: 0.35, rabbit: 0.35, mouseSummon: 0.35,
  // 소형+ (0.40)
  bat: 0.40, spider: 0.40, imp: 0.40, homunculus: 0.40,
  smallDokkaebi: 0.40, poisonMushroom: 0.40, sporeSwarm: 0.40, mandrake: 0.40,
  greenSlime: 0.40, blueSlime: 0.40, redSlime: 0.40, poisonSlime: 0.40,
  metalSlime: 0.40, jellyfish: 0.40,
  // 중형- (0.45)
  viper: 0.45, centipede: 0.45, poisonMoth: 0.45, killerBee: 0.45,
  scorpion: 0.45, stagBeetle: 0.45, mimic: 0.45, kingCrab: 0.45,
  deepSeaFish: 0.45, dragonHatchling: 0.45,
  fireDokkaebi: 0.45, stoneDokkaebi: 0.45, pondDokkaebi: 0.45,
  dokkaebiClub: 0.45, forestDokkaebi: 0.45,
  // 중형 (0.50) - 일반 몬스터/용병/소환수
  wolf: 0.50, lizard: 0.50, boar: 0.50, python: 0.50, fox: 0.50,
  snowLeopard: 0.50, ancientFox: 0.50, queenAnt: 0.50,
  skeleton: 0.50, zombie: 0.50, ghoul: 0.50, skeletalArcher: 0.50, mummy: 0.50,
  ghost: 0.50, wraith: 0.50, wanderingSpirit: 0.50, waterGhost: 0.50,
  blackShadow: 0.50, blindSpirit: 0.50, moonGhost: 0.50,
  waterElemental: 0.50, fireElemental: 0.50, windElemental: 0.50,
  earthElemental: 0.50, lightningElemental: 0.50, iceElemental: 0.50,
  lightElemental: 0.50, darkElemental: 0.50,
  bandit: 0.50, assassin: 0.50, thiefLeader: 0.50,
  shark: 0.50, giantOctopus: 0.50, seahorseKnight: 0.50, mermaidWarrior: 0.50,
  vineMonster: 0.50, carnivorousPlant: 0.50, phoenix: 0.50, griffin: 0.50,
  kingSlime: 0.50, slimeLord: 0.50,
  wanderingSoul: 0.50, graveyardGhost: 0.50, wolfSummon: 0.50,
  nineTailFoxSummon: 0.50, spiderQueenSummon: 0.50,
  waterSpiritSummon: 0.50, fireSpiritSummon: 0.50, windSpiritSummon: 0.50,
  skeletonWarriorSummon: 0.50, lichSummon: 0.50, golemFragment: 0.50,
  merc_1: 0.55, merc_2: 0.55, merc_3: 0.55, merc_4: 0.55,
  merc_5: 0.55, merc_6: 0.55, merc_7: 0.55, merc_8: 0.55,
  // 중형+ (0.55)
  cursedMonk: 0.55, blackBear: 0.55, hellHound: 0.55,
  maidenGhost: 0.55, vampire: 0.55, deathKnight: 0.55,
  succubus: 0.55, incubus: 0.55, demonServant: 0.55, gargoyle: 0.55,
  wyvern: 0.55, drake: 0.55, unicorn: 0.55,
  darkWizard: 0.55, fallenKnight: 0.55, berserker: 0.55,
  necromancer: 0.55, grandWizard: 0.55, mantisWarrior: 0.55, spiderQueen: 0.55,
  dokkaebiGeneral: 0.55, haetae: 0.55, medusa: 0.55, werewolf: 0.55,
  fungalLord: 0.55, treant: 0.55, worldTreeFragment: 0.55,
  lich: 0.55, miniGolem: 0.40,
  kraken: 0.55, imoogi: 0.55,
  // 대형 (0.60)
  golem: 0.60, darkGuardian: 0.60, grayBear: 0.60,
  whiteTiger: 0.60, threeHeadedHound: 0.60,
  yaksha: 0.60, lichKing: 0.60, elementalKing: 0.60,
  balrog: 0.60, fallenAngel: 0.60, demonKing: 0.65,
  fireDragon: 0.60, iceDragon: 0.60, darkDragon: 0.60,
  dragonKing: 0.65, hydra: 0.60, seaDragon: 0.60,
  magicArmor: 0.55, guardian: 0.55, manaGolem: 0.55,
  bulgasari: 0.60, chimera: 0.60, minotaur: 0.60, giant: 0.65,
  dokkaebiKing: 0.60,
};

// GLB 모델 존재 여부 캐시
const glbAvailableCache = {};

function GLBModelLoader({ modelType, glbUrl, fallback }) {
  const cacheKey = glbUrl || modelType;
  const [hasGlb, setHasGlb] = useState(glbAvailableCache[cacheKey]);
  const [gltf, setGltf] = useState(null);

  useEffect(() => {
    if (glbAvailableCache[cacheKey] === false) return;
    if (glbAvailableCache[cacheKey] === true && gltf) return;

    const url = glbUrl || `${process.env.PUBLIC_URL}/characters/models/${modelType}.glb`;
    const loader = new GLTFLoader();
    loader.load(
      url,
      (loaded) => {
        glbAvailableCache[cacheKey] = true;
        setHasGlb(true);
        setGltf(loaded);
      },
      undefined,
      () => {
        glbAvailableCache[cacheKey] = false;
        setHasGlb(false);
      }
    );
  }, [cacheKey, glbUrl, modelType, gltf]);

  if (hasGlb && gltf) {
    const scale = GLB_MODEL_SCALES[modelType] || (modelType.startsWith('monster_') ? 0.50 : 0.50);
    const clonedScene = gltf.scene.clone();
    // vertex color 지원: GLB 메시의 vertex color가 있으면 활성화
    clonedScene.traverse((child) => {
      if (child.isMesh && child.geometry) {
        if (child.geometry.attributes.color) {
          child.material = child.material.clone();
          child.material.vertexColors = true;
        }
      }
    });
    return (
      <primitive
        object={clonedScene}
        scale={[scale, scale, scale]}
        position={[0, 0, 0]}
      />
    );
  }

  return fallback;
}

// 프로시저 모델 렌더 (폴백)
function ProceduralModel({ unit }) {
  const modelType = getUnitModel(unit);

  const MODEL_MAP = {
    // 플레이어
    mage: () => <FengShuiMasterModel color={unit.color} />,
    shaman: () => <MudangModel color={unit.color} />,
    monk: () => <BuddhistMonkModel color={unit.color} />,
    // 소환수 모델
    wanderingSoul: () => <WanderingSoulModel />,
    graveyardGhost: () => <GraveyardGhostModel />,
    nineTailFoxSummon: () => <NineTailFoxSummonModel />,
    mouseSummon: () => <MouseSummonModel />,
    wolfSummon: () => <WolfSummonModel />,
    golemFragment: () => <GolemFragmentModel />,
    spiderQueenSummon: () => <SpiderQueenSummonModel />,
    waterSpiritSummon: () => <WaterSpiritSummonModel />,
    fireSpiritSummon: () => <FireSpiritSummonModel />,
    windSpiritSummon: () => <WindSpiritSummonModel />,
    skeletonWarriorSummon: () => <SkeletonWarriorSummonModel />,
    lichSummon: () => <LichSummonModel />,
    // 기존 모델 (IsometricMap 내)
    mouse: () => <MouseModel />, wolf: () => <WolfModel />, spider: () => <SpiderModel />,
    bat: () => <BatModel />, golem: () => <GolemModel />, lizard: () => <LizardModel />,
    ghost: () => <GhostModel />, cursedMonk: () => <CursedMonkModel />,
    darkGuardian: () => <DarkGuardianModel />, fox: () => <FoxModel />,
    waterElemental: () => <WaterElementalModel />, fireElemental: () => <FireElementalModel />,
    windElemental: () => <WindElementalModel />, skeleton: () => <SkeletonModel />,
    lich: () => <LichModel />, miniGolem: () => <MiniGolemModel />,
    // 야수
    rabbit: () => <RabbitModel />, boar: () => <BoarModel />, viper: () => <ViperModel />,
    blackBear: () => <BlackBearModel />, snowLeopard: () => <SnowLeopardModel />,
    grayBear: () => <GrayBearModel />, python: () => <PythonModel />,
    whiteTiger: () => <WhiteTigerModel />, threeHeadedHound: () => <ThreeHeadedHoundModel />,
    ancientFox: () => <AncientFoxModel />,
    // 곤충
    centipede: () => <CentipedeModel />, poisonMoth: () => <PoisonMothModel />,
    killerBee: () => <KillerBeeModel />, scorpion: () => <ScorpionModel />,
    queenAnt: () => <QueenAntModel />, stagBeetle: () => <StagBeetleModel />,
    spiderQueen: () => <SpiderQueenModel />, mantisWarrior: () => <MantisWarriorModel />,
    // 언데드
    zombie: () => <ZombieModel />, ghoul: () => <GhoulModel />, wraith: () => <WraithModel />,
    vampire: () => <VampireModel />, deathKnight: () => <DeathKnightModel />,
    lichKing: () => <LichKingModel />, skeletalArcher: () => <SkeletalArcherModel />,
    mummy: () => <MummyModel />,
    // 귀신
    wanderingSpirit: () => <WanderingSpiritModel />, maidenGhost: () => <MaidenGhostModel />,
    yaksha: () => <YakshaModel />, waterGhost: () => <WaterGhostModel />,
    blackShadow: () => <BlackShadowModel />, blindSpirit: () => <BlindSpiritModel />,
    moonGhost: () => <MoonGhostModel />, imoogi: () => <ImoogiModel />,
    // 정령
    earthElemental: () => <EarthElementalModel />, lightningElemental: () => <LightningElementalModel />,
    iceElemental: () => <IceElementalModel />, lightElemental: () => <LightElementalModel />,
    darkElemental: () => <DarkElementalModel />, elementalKing: () => <ElementalKingModel />,
    // 악마
    imp: () => <ImpModel />, succubus: () => <SuccubusModel />, incubus: () => <IncubusModel />,
    hellHound: () => <HellHoundModel />, balrog: () => <BalrogModel />,
    demonServant: () => <DemonServantModel />, fallenAngel: () => <FallenAngelModel />,
    demonKing: () => <DemonKingModel />, gargoyle: () => <GargoyleModel />,
    // 용족
    dragonHatchling: () => <DragonHatchlingModel />, wyvern: () => <WyvernModel />,
    fireDragon: () => <FireDragonModel />, iceDragon: () => <IceDragonModel />,
    darkDragon: () => <DarkDragonModel />, dragonKing: () => <DragonKingModel />,
    drake: () => <DrakeModel />, hydra: () => <HydraModel />,
    // 마법생물
    magicArmor: () => <MagicArmorModel />, guardian: () => <GuardianModel />,
    homunculus: () => <HomunculusModel />, manaGolem: () => <ManaGolemModel />,
    unicorn: () => <UnicornModel />, griffin: () => <GriffinModel />,
    phoenix: () => <PhoenixModel />, mimic: () => <MimicModel />,
    // 식물
    poisonMushroom: () => <PoisonMushroomModel />, vineMonster: () => <VineMonsterModel />,
    treant: () => <TreantModel />, carnivorousPlant: () => <CarnivorousPlantModel />,
    sporeSwarm: () => <SporeSwarmModel />, mandrake: () => <MandrakeModel />,
    worldTreeFragment: () => <WorldTreeFragmentModel />, fungalLord: () => <FungalLordModel />,
    // 인간형
    bandit: () => <BanditModel />, assassin: () => <AssassinModel />,
    darkWizard: () => <DarkWizardModel />, fallenKnight: () => <FallenKnightModel />,
    berserker: () => <BerserkerModel />, necromancer: () => <NecromancerModel />,
    grandWizard: () => <GrandWizardModel />, thiefLeader: () => <ThiefLeaderModel />,
    // 도깨비
    smallDokkaebi: () => <SmallDokkaebiModel />, fireDokkaebi: () => <FireDokkaebiModel />,
    stoneDokkaebi: () => <StoneDokkaebiModel />, dokkaebiGeneral: () => <DokkaebiGeneralModel />,
    dokkaebiKing: () => <DokkaebiKingModel />, pondDokkaebi: () => <PondDokkaebiModel />,
    dokkaebiClub: () => <DokkaebiClubModel />, forestDokkaebi: () => <ForestDokkaebiModel />,
    // 요괴
    haetae: () => <HaetaeModel />, bulgasari: () => <BulgasariModel />,
    chimera: () => <ChimeraModel />, minotaur: () => <MinotaurModel />,
    medusa: () => <MedusaModel />, giant: () => <GiantModel />, werewolf: () => <WerewolfModel />,
    // 슬라임
    greenSlime: () => <GreenSlimeModel />, blueSlime: () => <BlueSlimeModel />,
    redSlime: () => <RedSlimeModel />, poisonSlime: () => <PoisonSlimeModel />,
    metalSlime: () => <MetalSlimeModel />, kingSlime: () => <KingSlimeModel />,
    jellyfish: () => <JellyfishModel />, slimeLord: () => <SlimeLordModel />,
    // 수생
    kingCrab: () => <KingCrabModel />, shark: () => <SharkModel />,
    giantOctopus: () => <GiantOctopusModel />, mermaidWarrior: () => <MermaidWarriorModel />,
    deepSeaFish: () => <DeepSeaFishModel />, kraken: () => <KrakenModel />,
    seahorseKnight: () => <SeahorseKnightModel />, seaDragon: () => <SeaDragonModel />,
  };

  const renderer = MODEL_MAP[modelType];
  if (renderer) return renderer();
  return <DefaultModel color={unit.color} isPlayer={unit.team === 'player'} />;
}

// 플레이어 캐릭터 GLB 매핑 (Hunyuan3D 생성 모델)
const PLAYER_GLB_MAP = { '풍수사': 'pungsu', '무당': 'mudang', '승려': 'monk' };
const PLAYER_GLB_SCALE = 1.05;

// 모델 렌더 컴포넌트 (GLB 우선, 없으면 프로시저 폴백)
function UnitModelRenderer({ unit }) {
  const modelType = getUnitModel(unit);
  const proceduralFallback = <ProceduralModel unit={unit} />;

  // 플레이어: 전용 AI 생성 3D 캐릭터 모델 사용
  if (unit.id === 'player' && unit.classType) {
    const charKey = PLAYER_GLB_MAP[unit.classType];
    if (charKey) {
      const charUrl = `/characters/models/${charKey}.glb`;
      return (
        <GLBModelLoader
          modelType={`player_${charKey}`}
          glbUrl={charUrl}
          fallback={proceduralFallback}
        />
      );
    }
  }

  // 용병: mercId 기반 GLB 로드 (merc_{id}.glb)
  if (unit.mercId && modelType.startsWith('merc_')) {
    const mercGlbUrl = `/characters/models/merc_${unit.mercId}.glb`;
    return (
      <GLBModelLoader
        modelType={`merc_${unit.mercId}`}
        glbUrl={mercGlbUrl}
        fallback={proceduralFallback}
      />
    );
  }

  // 나라별 몬스터: monsterId 기반 GLB 로드 (monster_{id}.glb)
  if (unit.monsterId && modelType === 'default') {
    const monsterGlbUrl = `/characters/models/monster_${unit.monsterId}.glb`;
    return (
      <GLBModelLoader
        modelType={`monster_${unit.monsterId}`}
        glbUrl={monsterGlbUrl}
        fallback={proceduralFallback}
      />
    );
  }

  return (
    <GLBModelLoader
      modelType={modelType}
      fallback={proceduralFallback}
    />
  );
}

// HP 위험 경고 글로우
function LowHpWarning() {
  const matRef = useRef();
  useFrame((state) => {
    if (matRef.current) {
      matRef.current.opacity = 0.3 + Math.sin(state.clock.elapsedTime * 6) * 0.25;
    }
  });
  return (
    <mesh position={[0, 0, 0.002]}>
      <planeGeometry args={[1.5, 0.22]} />
      <meshBasicMaterial ref={matRef} color="#ff0000" transparent opacity={0.3} side={THREE.DoubleSide} />
    </mesh>
  );
}

// 활성 유닛 회전 글로우 링
function ActiveUnitRing() {
  const ref = useRef();
  const matRef = useRef();
  useFrame((state) => {
    if (ref.current) {
      ref.current.rotation.z = state.clock.elapsedTime * 1.5;
    }
    if (matRef.current) {
      matRef.current.opacity = 0.6 + Math.sin(state.clock.elapsedTime * 4) * 0.3;
    }
  });
  return (
    <group position={[0, 0.03, 0]} rotation={[-Math.PI / 2, 0, 0]} ref={ref}>
      <mesh>
        <ringGeometry args={[0.6, 0.7, 24]} />
        <meshBasicMaterial ref={matRef} color="#ffeb3b" side={THREE.DoubleSide} transparent opacity={0.7} />
      </mesh>
      {/* 4방향 노치 */}
      {[0, 1, 2, 3].map(i => {
        const a = (i / 4) * Math.PI * 2;
        return (
          <mesh key={i} position={[Math.cos(a) * 0.65, Math.sin(a) * 0.65, 0]}>
            <circleGeometry args={[0.06, 6]} />
            <meshBasicMaterial color="#fff8c4" side={THREE.DoubleSide} transparent opacity={0.9} />
          </mesh>
        );
      })}
    </group>
  );
}

// 이동 먼지 이펙트
function MoveDustEffect({ x, z, mapData }) {
  const ref = useRef();
  const [opacity, setOpacity] = useState(0.6);
  const age = useRef(0);
  const tile = mapData.tiles.find(t => t.x === x && t.z === z);
  const tileH = tile ? tile.height * HEIGHT_SCALE : 0;

  useFrame((_, delta) => {
    age.current += delta;
    if (ref.current) {
      const s = 0.5 + age.current * 3;
      ref.current.scale.set(s, s * 0.5, s);
      setOpacity(Math.max(0, 0.6 - age.current * 1.5));
    }
  });

  if (opacity <= 0) return null;

  return (
    <group ref={ref} position={[x * TILE_SIZE, tileH + 0.2, z * TILE_SIZE]}>
      {[0, 1, 2, 3, 4].map(i => {
        const a = (i / 5) * Math.PI * 2;
        const r = 0.15 + i * 0.05;
        return (
          <mesh key={i} position={[Math.sin(a) * r, i * 0.03, Math.cos(a) * r]}>
            <sphereGeometry args={[0.06, 4, 4]} />
            <meshStandardMaterial color="#b8a88a" transparent opacity={opacity * (1 - i * 0.15)} />
          </mesh>
        );
      })}
    </group>
  );
}

// 사망 이펙트 (페이드 + 파편)
function DeathEffect({ x, z, team, mapData }) {
  const ref = useRef();
  const [opacity, setOpacity] = useState(1);
  const age = useRef(0);
  const tile = mapData.tiles.find(t => t.x === x && t.z === z);
  const tileH = tile ? tile.height * HEIGHT_SCALE : 0;
  const color = team === 'player' ? '#4488ff' : '#ff4444';

  const particles = useMemo(() => {
    const pts = [];
    for (let i = 0; i < 12; i++) {
      const a = (i / 12) * Math.PI * 2;
      const speed = 0.8 + Math.random() * 1.2;
      pts.push({ a, speed, ySpeed: 1 + Math.random() * 2, size: 0.04 + Math.random() * 0.06 });
    }
    return pts;
  }, []);

  useFrame((_, delta) => {
    age.current += delta;
    setOpacity(Math.max(0, 1 - age.current * 1.2));
  });

  if (opacity <= 0) return null;

  return (
    <group ref={ref} position={[x * TILE_SIZE, tileH + 0.8, z * TILE_SIZE]}>
      {/* 중심 플래시 */}
      <mesh>
        <sphereGeometry args={[0.3 + age.current * 0.5, 8, 8]} />
        <meshStandardMaterial color="#ffffff" emissive={color} emissiveIntensity={3} transparent opacity={opacity * 0.4} />
      </mesh>
      {/* 파편들 */}
      {particles.map((p, i) => {
        const dist = age.current * p.speed;
        return (
          <mesh key={i} position={[Math.sin(p.a) * dist, age.current * p.ySpeed, Math.cos(p.a) * dist]}>
            <sphereGeometry args={[p.size, 4, 4]} />
            <meshStandardMaterial color={color} emissive={color} emissiveIntensity={2} transparent opacity={opacity * 0.7} />
          </mesh>
        );
      })}
    </group>
  );
}

// 씬 배경 파티클 (부유하는 먼지/빛 입자)
function AmbientParticles({ mapWidth, mapHeight }) {
  const count = 30;
  const particles = useMemo(() => {
    const pts = [];
    for (let i = 0; i < count; i++) {
      pts.push({
        x: Math.random() * mapWidth * TILE_SIZE,
        y: 1 + Math.random() * 4,
        z: Math.random() * mapHeight * TILE_SIZE,
        speed: 0.2 + Math.random() * 0.4,
        phase: Math.random() * Math.PI * 2,
        size: 0.03 + Math.random() * 0.04,
      });
    }
    return pts;
  }, [mapWidth, mapHeight]);

  const ref = useRef();

  useFrame((state) => {
    if (!ref.current) return;
    const t = state.clock.elapsedTime;
    ref.current.children.forEach((child, i) => {
      const p = particles[i];
      child.position.y = p.y + Math.sin(t * p.speed + p.phase) * 0.5;
      child.position.x = p.x + Math.sin(t * 0.3 + p.phase) * 0.3;
      child.material.opacity = 0.3 + Math.sin(t * 1.5 + p.phase) * 0.2;
    });
  });

  return (
    <group ref={ref}>
      {particles.map((p, i) => (
        <mesh key={i} position={[p.x, p.y, p.z]}>
          <sphereGeometry args={[p.size, 4, 4]} />
          <meshStandardMaterial color="#ffeedd" emissive="#ffddaa" emissiveIntensity={1} transparent opacity={0.3} />
        </mesh>
      ))}
    </group>
  );
}

// 유닛 표시
function UnitMesh({ unit, isActive, mapData }) {
  const ref = useRef();
  const modelRef = useRef();
  const prevPos = useRef({ x: unit.x, z: unit.z });
  const lerpPos = useRef({ x: unit.x * TILE_SIZE, z: unit.z * TILE_SIZE });
  const prevHp = useRef(unit.hp);
  const prevActed = useRef(unit.acted || false);
  const hitTime = useRef(0);
  const atkTime = useRef(0);
  const atkDir = useRef({ x: 0, z: 0 });
  const deathFade = useRef(null); // 사망 페이드 시작 시간
  const tile = mapData.tiles.find(t => t.x === unit.x && t.z === unit.z);
  const tileH = tile ? tile.height * HEIGHT_SCALE : 0;
  const y = tileH + 0.15;

  // HP 감소 감지 → 피격 애니메이션 트리거
  if (unit.hp < prevHp.current) {
    hitTime.current = performance.now();
  }
  // 사망 감지
  if (unit.hp <= 0 && prevHp.current > 0) {
    deathFade.current = performance.now();
  }
  prevHp.current = unit.hp;

  // acted 변화 감지 → 공격 모션 트리거
  if (unit.acted && !prevActed.current) {
    atkTime.current = performance.now();
    // attackAnim이 있으면 그 방향으로, 없으면 기본 전방
    if (unit.attackAnim) {
      const dx = unit.attackAnim.tx - unit.x;
      const dz = unit.attackAnim.tz - unit.z;
      const len = Math.sqrt(dx * dx + dz * dz) || 1;
      atkDir.current = { x: dx / len, z: dz / len };
    } else {
      atkDir.current = { x: unit.team === 'player' ? 1 : -1, z: 0 };
    }
  }
  prevActed.current = unit.acted || false;

  // 이동 감지 + 부드러운 보간 + 피격 흔들림 + 공격 모션
  useFrame((state, delta) => {
    if (!ref.current) return;
    const targetX = unit.x * TILE_SIZE;
    const targetZ = unit.z * TILE_SIZE;

    // 이동 시 부드러운 lerp
    const speed = 8;
    lerpPos.current.x += (targetX - lerpPos.current.x) * Math.min(1, delta * speed);
    lerpPos.current.z += (targetZ - lerpPos.current.z) * Math.min(1, delta * speed);

    if (Math.abs(targetX - lerpPos.current.x) < 0.01) lerpPos.current.x = targetX;
    if (Math.abs(targetZ - lerpPos.current.z) < 0.01) lerpPos.current.z = targetZ;

    ref.current.position.x = lerpPos.current.x;
    ref.current.position.z = lerpPos.current.z;

    // 사망 페이드아웃
    if (deathFade.current) {
      const deathElapsed = (performance.now() - deathFade.current) / 1000;
      if (deathElapsed < 0.6) {
        const fadeScale = 1 - deathElapsed / 0.6;
        ref.current.scale.setScalar(fadeScale);
        ref.current.position.y = y + deathElapsed * 0.5;
        return; // 다른 애니메이션 무시
      }
    }

    // 피격 흔들림 (0.3초간)
    const hitElapsed = (performance.now() - hitTime.current) / 1000;
    const isHit = hitElapsed < 0.3;

    // 공격 모션 (0.4초: 돌진 0.15초 + 복귀 0.25초)
    const atkElapsed = (performance.now() - atkTime.current) / 1000;
    const isAttacking = atkElapsed < 0.4 && atkTime.current > 0;

    // 이동 중 살짝 위로 뛰는 효과
    const isMoving = Math.abs(targetX - lerpPos.current.x) > 0.05 || Math.abs(targetZ - lerpPos.current.z) > 0.05;

    if (isAttacking && modelRef.current) {
      // 돌진 + 복귀 (전반: 앞으로, 후반: 뒤로)
      const lungeDistance = 0.5;
      let lungeFactor;
      if (atkElapsed < 0.15) {
        // 돌진 (0~0.15초): ease-out
        lungeFactor = Math.sin((atkElapsed / 0.15) * Math.PI * 0.5);
      } else {
        // 복귀 (0.15~0.4초): ease-in
        lungeFactor = Math.cos(((atkElapsed - 0.15) / 0.25) * Math.PI * 0.5);
      }
      modelRef.current.position.x = atkDir.current.x * lungeDistance * lungeFactor * TILE_SIZE;
      modelRef.current.position.z = atkDir.current.z * lungeDistance * lungeFactor * TILE_SIZE;
      // 돌진 시 살짝 위로
      modelRef.current.position.y = Math.sin(lungeFactor * Math.PI) * 0.1;
      // 기울임 (찌르기 느낌)
      modelRef.current.rotation.x = lungeFactor * 0.2 * -atkDir.current.z;
      modelRef.current.rotation.z = lungeFactor * 0.2 * -atkDir.current.x;
    } else if (modelRef.current) {
      modelRef.current.position.x = 0;
      modelRef.current.position.z = 0;
      modelRef.current.position.y = 0;
      modelRef.current.rotation.x = 0;
      modelRef.current.rotation.z = 0;
    }

    // 호흡 애니메이션 (아이들 상태에서 미세한 스케일 변화)
    const breathScale = 1 + Math.sin(state.clock.elapsedTime * 2) * 0.015;
    ref.current.scale.set(breathScale, breathScale, breathScale);

    if (isHit) {
      const shake = Math.sin(hitElapsed * 60) * 0.12 * (1 - hitElapsed / 0.3);
      ref.current.position.x = lerpPos.current.x + shake;
      ref.current.position.y = y;
    } else if (isMoving) {
      ref.current.position.y = y + Math.abs(Math.sin(state.clock.elapsedTime * 10)) * 0.15;
    } else if (isActive) {
      ref.current.position.y = y + Math.sin(state.clock.elapsedTime * 3) * 0.08;
    } else {
      ref.current.position.y = y;
    }

    prevPos.current = { x: unit.x, z: unit.z };
  });

  const hpPercent = unit.hp / unit.maxHp;
  const hpColor = hpPercent > 0.5 ? '#2ed573' : hpPercent > 0.25 ? '#ffa502' : '#e94560';

  // 사망 페이드 완료 후 숨김
  if (unit.hp <= 0) {
    if (!deathFade.current) return null;
    const deathElapsed = (performance.now() - deathFade.current) / 1000;
    if (deathElapsed > 0.6) return null;
  }

  // 모델 높이 오프셋 (큰 모델은 더 높이 배치)
  const modelType = getUnitModel(unit);
  const tallModels = [
    'golem', 'darkGuardian', 'lich', 'cursedMonk',
    'grayBear', 'whiteTiger', 'threeHeadedHound',
    'yaksha', 'deathKnight', 'lichKing', 'vampire',
    'balrog', 'demonKing', 'demonServant', 'fallenAngel', 'succubus', 'incubus',
    'fireDragon', 'iceDragon', 'darkDragon', 'dragonKing', 'hydra', 'seaDragon',
    'magicArmor', 'guardian', 'manaGolem', 'treant', 'worldTreeFragment',
    'darkWizard', 'fallenKnight', 'berserker', 'necromancer', 'grandWizard',
    'dokkaebiGeneral', 'dokkaebiKing',
    'minotaur', 'giant', 'werewolf',
    'elementalKing', 'gargoyle', 'medusa',
  ];
  const isTall = tallModels.includes(modelType);
  const baseY = isTall ? 2.0 : 1.8;
  const mpY = baseY;
  const hpY = mpY + 0.16;
  const nameY = hpY + 0.42;

  const isAlly = unit.team === 'player';
  const nameColor = isAlly ? '#90caf9' : '#ff8a80';

  const mpPercent = unit.maxMp > 0 ? unit.mp / unit.maxMp : 0;
  const showMp = unit.maxMp > 0;

  return (
    <group ref={ref} position={[lerpPos.current.x, y, lerpPos.current.z]}>
      <group ref={modelRef} scale={[2.2, 2.2, 2.2]}>
        <UnitModelRenderer unit={unit} />
      </group>
      {/* 아군/적군 구별 링 */}
      <mesh position={[0, 0.01, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[0.55, 0.62, 24]} />
        <meshBasicMaterial color={isAlly ? '#42a5f5' : '#ef5350'} side={THREE.DoubleSide} transparent opacity={0.6} />
      </mesh>
      {/* 활성 표시 링 (회전 + 펄스 글로우) */}
      {isActive && <ActiveUnitRing />}
      {/* MP 바 (아래) */}
      {showMp && (
        <group position={[0, mpY, 0]}>
          <mesh>
            <planeGeometry args={[1.4, 0.1]} />
            <meshBasicMaterial color="#222" side={THREE.DoubleSide} />
          </mesh>
          <mesh position={[(mpPercent - 1) * 0.7, 0, 0.001]}>
            <planeGeometry args={[1.4 * mpPercent, 0.1]} />
            <meshBasicMaterial color="#4488ff" side={THREE.DoubleSide} />
          </mesh>
        </group>
      )}
      {/* HP 바 (위) */}
      <group position={[0, hpY, 0]}>
        <mesh>
          <planeGeometry args={[1.4, 0.14]} />
          <meshBasicMaterial color="#333" side={THREE.DoubleSide} />
        </mesh>
        <mesh position={[(hpPercent - 1) * 0.7, 0, 0.001]}>
          <planeGeometry args={[1.4 * hpPercent, 0.14]} />
          <meshBasicMaterial color={hpColor} side={THREE.DoubleSide} />
        </mesh>
        {/* 위험 경고 (HP 25% 이하: 빨간 글로우) */}
        {hpPercent <= 0.25 && hpPercent > 0 && (
          <LowHpWarning />
        )}
      </group>
      {/* 이름 */}
      <Text
        position={[0, nameY, 0]}
        fontSize={0.36}
        color={nameColor}
        anchorX="center"
        anchorY="middle"
        outlineWidth={0.05}
        outlineColor="#000000"
      >
        {unit.isBoss ? `👿 ${unit.name}` : unit.name}
      </Text>
    </group>
  );
}

// 데미지 팝업 (크게 + 바운스 효과)
function DamagePopup({ popup }) {
  const ref = useRef();
  const [opacity, setOpacity] = useState(1);
  const [scale, setScale] = useState(0.3);
  const age = useRef(0);

  useFrame((_, delta) => {
    if (ref.current) {
      age.current += delta;
      ref.current.position.y += delta * 1.8;
      setOpacity(prev => Math.max(0, prev - delta * 0.9));
      // 바운스 스케일: 처음 커졌다 줄어듦
      if (age.current < 0.15) {
        setScale(0.3 + age.current * 8);
      } else if (age.current < 0.3) {
        setScale(1.5 - (age.current - 0.15) * 3.5);
      } else {
        setScale(1.0);
      }
    }
  });

  if (opacity <= 0) return null;

  const isDamage = popup.type === 'damage';
  const isHeal = popup.type === 'heal';
  const isElement = popup.type === 'element';
  const isElementWeak = popup.type === 'element-weak';
  const fontSize = isDamage ? 0.85 : isHeal ? 0.7 : (isElement || isElementWeak) ? 0.55 : 0.6;
  const color = isDamage ? '#ff2222' : isHeal ? '#22ff66' : isElement ? '#ffa502' : isElementWeak ? '#7b93b3' : '#ffee44';
  const outlineColor = isDamage ? '#660000' : isHeal ? '#005500' : isElement ? '#553300' : isElementWeak ? '#334455' : '#554400';

  return (
    <group ref={ref} position={[popup.x * TILE_SIZE, popup.y + 2.5, popup.z * TILE_SIZE]} scale={[scale, scale, scale]}>
      {/* 데미지 글로우 배경 */}
      {isDamage && (
        <mesh>
          <sphereGeometry args={[0.5, 8, 8]} />
          <meshBasicMaterial color={color} transparent opacity={opacity * 0.15} />
        </mesh>
      )}
      <Text
        fontSize={fontSize}
        color={color}
        anchorX="center"
        anchorY="middle"
        outlineWidth={0.08}
        outlineColor={outlineColor}
        fillOpacity={opacity}
        font={undefined}
      >
        {popup.text}
      </Text>
    </group>
  );
}

// ========== 스킬 이펙트 시스템 ==========

// 슬래시 이펙트 (공격)
function SlashEffect({ position, color = '#ff4444' }) {
  const ref = useRef();
  const [opacity, setOpacity] = useState(1);
  const age = useRef(0);

  useFrame((_, delta) => {
    age.current += delta;
    if (ref.current) {
      ref.current.rotation.z += delta * 12;
      ref.current.scale.setScalar(1 + age.current * 3);
      setOpacity(Math.max(0, 1 - age.current * 2.5));
    }
  });

  if (opacity <= 0) return null;

  return (
    <group ref={ref} position={position}>
      {/* X자 슬래시 */}
      <mesh rotation={[0, 0, 0.785]}>
        <boxGeometry args={[0.8, 0.06, 0.02]} />
        <meshStandardMaterial color={color} emissive={color} emissiveIntensity={2} transparent opacity={opacity} />
      </mesh>
      <mesh rotation={[0, 0, -0.785]}>
        <boxGeometry args={[0.8, 0.06, 0.02]} />
        <meshStandardMaterial color={color} emissive={color} emissiveIntensity={2} transparent opacity={opacity} />
      </mesh>
    </group>
  );
}

// 폭발 이펙트 (강공격/스킬)
function ExplosionEffect({ position, color = '#ff6600' }) {
  const ref = useRef();
  const [opacity, setOpacity] = useState(1);
  const age = useRef(0);

  useFrame((_, delta) => {
    age.current += delta;
    if (ref.current) {
      const s = 0.3 + age.current * 4;
      ref.current.scale.set(s, s, s);
      setOpacity(Math.max(0, 1 - age.current * 2));
    }
  });

  if (opacity <= 0) return null;

  return (
    <group ref={ref} position={position}>
      {/* 중심 구 */}
      <mesh>
        <sphereGeometry args={[0.3, 12, 12]} />
        <meshStandardMaterial color={color} emissive={color} emissiveIntensity={3} transparent opacity={opacity * 0.8} />
      </mesh>
      {/* 외곽 링 */}
      <mesh rotation={[Math.PI / 2, 0, 0]}>
        <ringGeometry args={[0.25, 0.4, 16]} />
        <meshStandardMaterial color="#ffffff" emissive={color} emissiveIntensity={2} transparent opacity={opacity * 0.5} side={2} />
      </mesh>
      {/* 파편 */}
      {[0, 1, 2, 3, 4, 5].map(i => {
        const a = (i / 6) * Math.PI * 2;
        return (
          <mesh key={i} position={[Math.sin(a) * 0.35, Math.cos(a) * 0.2, Math.cos(a) * 0.35]}>
            <sphereGeometry args={[0.06, 4, 4]} />
            <meshStandardMaterial color={color} emissive={color} emissiveIntensity={2} transparent opacity={opacity * 0.6} />
          </mesh>
        );
      })}
    </group>
  );
}

// 힐 이펙트 (치유)
function HealEffect({ position }) {
  const ref = useRef();
  const [opacity, setOpacity] = useState(1);
  const age = useRef(0);

  useFrame((_, delta) => {
    age.current += delta;
    if (ref.current) {
      ref.current.rotation.y += delta * 3;
      setOpacity(Math.max(0, 1 - age.current * 1.5));
    }
  });

  if (opacity <= 0) return null;

  return (
    <group ref={ref} position={position}>
      {/* 상승하는 빛 기둥 */}
      <mesh position={[0, 0.4, 0]}>
        <cylinderGeometry args={[0.15, 0.35, 1.2, 8, 1, true]} />
        <meshStandardMaterial color="#44ff88" emissive="#22ff66" emissiveIntensity={2} transparent opacity={opacity * 0.4} side={2} />
      </mesh>
      {/* 십자가 모양 빛 */}
      <mesh position={[0, 0.8, 0]}>
        <boxGeometry args={[0.4, 0.08, 0.08]} />
        <meshStandardMaterial color="#88ffaa" emissive="#44ff88" emissiveIntensity={3} transparent opacity={opacity * 0.7} />
      </mesh>
      <mesh position={[0, 0.8, 0]}>
        <boxGeometry args={[0.08, 0.4, 0.08]} />
        <meshStandardMaterial color="#88ffaa" emissive="#44ff88" emissiveIntensity={3} transparent opacity={opacity * 0.7} />
      </mesh>
      {/* 파티클 상승 */}
      {[0, 1, 2, 3].map(i => {
        const a = (i / 4) * Math.PI * 2 + age.current * 2;
        const yOff = (age.current * 2 + i * 0.3) % 1.2;
        return (
          <mesh key={i} position={[Math.sin(a) * 0.25, yOff, Math.cos(a) * 0.25]}>
            <sphereGeometry args={[0.04, 4, 4]} />
            <meshStandardMaterial color="#aaffcc" emissive="#66ff99" emissiveIntensity={2} transparent opacity={opacity * 0.6} />
          </mesh>
        );
      })}
    </group>
  );
}

// 버프 이펙트
function BuffEffect({ position, color = '#ffaa00' }) {
  const ref = useRef();
  const [opacity, setOpacity] = useState(1);
  const age = useRef(0);

  useFrame((_, delta) => {
    age.current += delta;
    if (ref.current) {
      ref.current.rotation.y += delta * 4;
      setOpacity(Math.max(0, 1 - age.current * 1.5));
    }
  });

  if (opacity <= 0) return null;

  return (
    <group ref={ref} position={position}>
      {/* 회전하는 링 3개 */}
      {[0, 1, 2].map(i => (
        <mesh key={i} position={[0, 0.2 + i * 0.35, 0]} rotation={[Math.PI / 2, 0, (i * Math.PI) / 3]}>
          <torusGeometry args={[0.3 - i * 0.05, 0.025, 6, 16]} />
          <meshStandardMaterial color={color} emissive={color} emissiveIntensity={2} transparent opacity={opacity * (0.7 - i * 0.15)} side={2} />
        </mesh>
      ))}
      {/* 상승 화살표 */}
      <mesh position={[0, 1.0, 0]}>
        <coneGeometry args={[0.1, 0.2, 6]} />
        <meshStandardMaterial color={color} emissive={color} emissiveIntensity={2} transparent opacity={opacity * 0.8} />
      </mesh>
    </group>
  );
}

// 마법 이펙트 (원거리 스킬)
function MagicEffect({ position, color = '#8844ff' }) {
  const ref = useRef();
  const [opacity, setOpacity] = useState(1);
  const age = useRef(0);

  useFrame((_, delta) => {
    age.current += delta;
    if (ref.current) {
      ref.current.rotation.y += delta * 6;
      const s = 0.5 + age.current * 2.5;
      ref.current.scale.set(s, s, s);
      setOpacity(Math.max(0, 1 - age.current * 2));
    }
  });

  if (opacity <= 0) return null;

  return (
    <group ref={ref} position={position}>
      {/* 마법진 */}
      <mesh rotation={[Math.PI / 2, 0, 0]}>
        <ringGeometry args={[0.2, 0.3, 6]} />
        <meshStandardMaterial color={color} emissive={color} emissiveIntensity={3} transparent opacity={opacity * 0.6} side={2} />
      </mesh>
      <mesh rotation={[Math.PI / 2, 0, Math.PI / 6]}>
        <ringGeometry args={[0.15, 0.22, 6]} />
        <meshStandardMaterial color="#ffffff" emissive={color} emissiveIntensity={2} transparent opacity={opacity * 0.4} side={2} />
      </mesh>
      {/* 중심 에너지 */}
      <mesh>
        <octahedronGeometry args={[0.15, 0]} />
        <meshStandardMaterial color={color} emissive={color} emissiveIntensity={4} transparent opacity={opacity * 0.7} />
      </mesh>
    </group>
  );
}

// 근접 이펙트 (칼/주먹 등 - 수평 슬래시 + 충격파)
function MeleeEffect({ position, color = '#ff6644' }) {
  const ref = useRef();
  const [opacity, setOpacity] = useState(1);
  const age = useRef(0);

  useFrame((_, delta) => {
    age.current += delta;
    if (ref.current) {
      const s = 0.5 + age.current * 5;
      ref.current.scale.set(s, s, s);
      setOpacity(Math.max(0, 1 - age.current * 3));
    }
  });

  if (opacity <= 0) return null;

  return (
    <group ref={ref} position={position}>
      {/* 수평 슬래시 */}
      <mesh rotation={[0, 0, 0.2]}>
        <boxGeometry args={[1.0, 0.08, 0.03]} />
        <meshStandardMaterial color={color} emissive={color} emissiveIntensity={3} transparent opacity={opacity} />
      </mesh>
      {/* 충격파 링 */}
      <mesh rotation={[Math.PI / 2, 0, 0]}>
        <ringGeometry args={[0.1, 0.25, 12]} />
        <meshStandardMaterial color="#ffffff" emissive={color} emissiveIntensity={2} transparent opacity={opacity * 0.5} side={2} />
      </mesh>
      {/* 파편 */}
      {[0, 1, 2, 3].map(i => {
        const a = (i / 4) * Math.PI * 2;
        return (
          <mesh key={i} position={[Math.sin(a) * 0.3, Math.cos(a) * 0.15, 0]}>
            <boxGeometry args={[0.08, 0.03, 0.02]} />
            <meshStandardMaterial color={color} emissive={color} emissiveIntensity={2} transparent opacity={opacity * 0.7} />
          </mesh>
        );
      })}
    </group>
  );
}

// 원거리 이펙트 (화살/투사체 - 관통 라인 + 임팩트)
function RangedEffect({ position, color = '#44aaff' }) {
  const ref = useRef();
  const [opacity, setOpacity] = useState(1);
  const age = useRef(0);

  useFrame((_, delta) => {
    age.current += delta;
    if (ref.current) {
      ref.current.rotation.z += delta * 8;
      setOpacity(Math.max(0, 1 - age.current * 2.5));
    }
  });

  if (opacity <= 0) return null;

  return (
    <group ref={ref} position={position}>
      {/* 관통 화살 궤적 */}
      <mesh rotation={[0, 0, 0.4]}>
        <boxGeometry args={[1.2, 0.04, 0.02]} />
        <meshStandardMaterial color="#ffffff" emissive={color} emissiveIntensity={3} transparent opacity={opacity * 0.8} />
      </mesh>
      {/* 임팩트 원 */}
      <mesh rotation={[Math.PI / 2, 0, 0]}>
        <ringGeometry args={[0.15, 0.3, 8]} />
        <meshStandardMaterial color={color} emissive={color} emissiveIntensity={2} transparent opacity={opacity * 0.6} side={2} />
      </mesh>
      {/* 충돌 파편 */}
      {[0, 1, 2].map(i => {
        const a = (i / 3) * Math.PI * 2 + 0.5;
        return (
          <mesh key={i} position={[Math.sin(a) * 0.2, Math.cos(a) * 0.2, 0]}>
            <sphereGeometry args={[0.04, 4, 4]} />
            <meshStandardMaterial color={color} emissive={color} emissiveIntensity={2} transparent opacity={opacity * 0.5} />
          </mesh>
        );
      })}
    </group>
  );
}

// 치명타 이펙트 (화면 진동 느낌 - 큰 별 + 스파크)
function CritEffect({ position, color = '#ffdd00' }) {
  const ref = useRef();
  const [opacity, setOpacity] = useState(1);
  const age = useRef(0);

  useFrame((_, delta) => {
    age.current += delta;
    if (ref.current) {
      const s = 0.3 + age.current * 6;
      ref.current.scale.set(s, s, s);
      ref.current.rotation.z += delta * 15;
      setOpacity(Math.max(0, 1 - age.current * 2.5));
    }
  });

  if (opacity <= 0) return null;

  return (
    <group ref={ref} position={position}>
      {/* 중심 플래시 */}
      <mesh>
        <sphereGeometry args={[0.25, 8, 8]} />
        <meshStandardMaterial color="#ffffff" emissive={color} emissiveIntensity={5} transparent opacity={opacity * 0.9} />
      </mesh>
      {/* 스타 버스트 (8방향) */}
      {[0, 1, 2, 3, 4, 5, 6, 7].map(i => {
        const a = (i / 8) * Math.PI * 2;
        return (
          <mesh key={i} position={[Math.sin(a) * 0.4, Math.cos(a) * 0.4, 0]} rotation={[0, 0, a]}>
            <boxGeometry args={[0.5, 0.04, 0.02]} />
            <meshStandardMaterial color={color} emissive={color} emissiveIntensity={3} transparent opacity={opacity * 0.7} />
          </mesh>
        );
      })}
      {/* 외곽 충격파 */}
      <mesh rotation={[Math.PI / 2, 0, 0]}>
        <ringGeometry args={[0.35, 0.5, 16]} />
        <meshStandardMaterial color={color} emissive={color} emissiveIntensity={2} transparent opacity={opacity * 0.4} side={2} />
      </mesh>
    </group>
  );
}

// 이펙트 렌더러
function SkillEffectRenderer({ effect }) {
  const tile = { x: effect.x * TILE_SIZE, z: effect.z * TILE_SIZE };
  const pos = [tile.x, effect.y + 1.0, tile.z];

  switch (effect.effectType) {
    case 'slash': return <SlashEffect position={pos} color={effect.color} />;
    case 'melee': return <MeleeEffect position={pos} color={effect.color} />;
    case 'ranged': return <RangedEffect position={pos} color={effect.color} />;
    case 'crit': return <CritEffect position={pos} color={effect.color} />;
    case 'explosion': return <ExplosionEffect position={pos} color={effect.color} />;
    case 'heal': return <HealEffect position={pos} />;
    case 'buff': return <BuffEffect position={pos} color={effect.color} />;
    case 'magic': return <MagicEffect position={pos} color={effect.color} />;
    default: return <SlashEffect position={pos} color={effect.color} />;
  }
}

// 유닛 컨텍스트 메뉴 (3D 공간에 HTML 오버레이)
function UnitContextMenu({ unit, mapData, menuState, onAction, potions }) {
  if (!unit || !menuState || !menuState.show) return null;

  const tile = mapData.tiles.find(t => t.x === unit.x && t.z === unit.z);
  const tileH = tile ? tile.height * HEIGHT_SCALE : 0;
  const y = tileH + 1.0;

  return (
    <group position={[unit.x * TILE_SIZE, y, unit.z * TILE_SIZE]}>
      <Html
        position={[1.0, 0, 0]}
        style={{ pointerEvents: 'auto' }}
        center={false}
        distanceFactor={undefined}
        zIndexRange={[50, 0]}
      >
        <div className="srpg-ctx-menu" onClick={e => e.stopPropagation()}>
          {menuState.mode === 'main' && (
            <>
              <button className="srpg-ctx-btn move" onClick={() => onAction('move')} disabled={unit.moved}>
                이동
              </button>
              <button className="srpg-ctx-btn attack" onClick={() => onAction('attack')}>
                공격
              </button>
              <button className="srpg-ctx-btn skill" onClick={() => onAction('showSkills')}>
                스킬
              </button>
              <button className="srpg-ctx-btn items" onClick={() => onAction('showItems')}>
                물품 {potions && potions.length > 0 && <span className="srpg-ctx-item-count">{potions.length}</span>}
              </button>
              <button className="srpg-ctx-btn wait" onClick={() => onAction('wait')}>
                대기
              </button>
            </>
          )}
          {menuState.mode === 'skills' && (
            <>
              {(unit.skills || []).map(sk => (
                <button
                  key={sk.id}
                  className={`srpg-ctx-btn skill-item ${unit.mp < sk.mp_cost ? 'disabled' : ''}`}
                  onClick={() => onAction('skill', sk)}
                  disabled={unit.mp < sk.mp_cost}
                  title={sk.description}
                >
                  {sk.iconUrl && <img src={sk.iconUrl} alt="" className="srpg-ctx-skill-icon" onError={(e) => { e.target.style.display='none'; }} />}
                  {sk.name}
                  <span className="srpg-ctx-mp">{sk.mp_cost}MP</span>
                </button>
              ))}
              <button className="srpg-ctx-btn back" onClick={() => onAction('back')}>
                뒤로가기
              </button>
            </>
          )}
          {menuState.mode === 'items' && (
            <>
              {(!potions || potions.length === 0) ? (
                <div className="srpg-ctx-empty">사용 가능한 물품이 없습니다</div>
              ) : (
                potions.map(p => (
                  <button
                    key={p.item_id}
                    className={`srpg-ctx-btn item-entry ${p.effect_hp > 0 ? 'hp' : 'mp'}`}
                    onClick={() => onAction('useItem', p)}
                  >
                    <span className="srpg-ctx-item-name">{p.effect_hp > 0 ? '❤️' : '💎'} {p.name}</span>
                    <span className="srpg-ctx-item-qty">x{p.quantity}</span>
                  </button>
                ))
              )}
              <button className="srpg-ctx-btn back" onClick={() => onAction('back')}>
                뒤로가기
              </button>
            </>
          )}
        </div>
      </Html>
    </group>
  );
}

// 카메라 컨트롤 (줌인/줌아웃 + 드래그 이동)
function CameraController({ mapWidth, mapHeight }) {
  const { camera, size, gl } = useThree();
  const zoomRef = useRef(50);
  const panRef = useRef({ x: 0, z: 0 });
  const isDragging = useRef(false);
  const lastMouse = useRef({ x: 0, y: 0 });

  const center = useMemo(() => ({
    x: (mapWidth - 1) * TILE_SIZE / 2,
    z: (mapHeight - 1) * TILE_SIZE / 2,
  }), [mapWidth, mapHeight]);

  // 초기 카메라 설정
  React.useEffect(() => {
    const maxDim = Math.max(mapWidth, mapHeight) * TILE_SIZE;
    const baseZoom = Math.min(size.width, size.height) / (maxDim * 1.4);
    const zoom = Math.max(20, Math.min(60, baseZoom));
    zoomRef.current = zoom;

    camera.position.set(center.x + 10, 12, center.z + 10);
    camera.lookAt(center.x, 0, center.z);
    camera.zoom = zoom;
    camera.updateProjectionMatrix();
  }, [camera, center, size, mapWidth, mapHeight]);

  // 마우스 휠 줌 + 우클릭 드래그 이동
  React.useEffect(() => {
    const canvas = gl.domElement;

    const handleWheel = (e) => {
      e.preventDefault();
      const delta = e.deltaY > 0 ? -4 : 4;
      zoomRef.current = Math.max(15, Math.min(120, zoomRef.current + delta));
      camera.zoom = zoomRef.current;
      camera.updateProjectionMatrix();
    };

    const handleMouseDown = (e) => {
      if (e.button === 2 || e.button === 1) { // 우클릭 또는 중클릭
        isDragging.current = true;
        lastMouse.current = { x: e.clientX, y: e.clientY };
        e.preventDefault();
      }
    };

    const handleMouseMove = (e) => {
      if (!isDragging.current) return;
      const dx = (e.clientX - lastMouse.current.x) / zoomRef.current * 2;
      const dy = (e.clientY - lastMouse.current.y) / zoomRef.current * 2;
      lastMouse.current = { x: e.clientX, y: e.clientY };

      // 아이소메트릭 방향으로 이동
      panRef.current.x -= (dx + dy) * 0.5;
      panRef.current.z -= (-dx + dy) * 0.5;

      const cx = center.x + panRef.current.x;
      const cz = center.z + panRef.current.z;
      camera.position.set(cx + 10, 12, cz + 10);
      camera.lookAt(cx, 0, cz);
      camera.updateProjectionMatrix();
    };

    const handleMouseUp = () => {
      isDragging.current = false;
    };

    const handleContextMenu = (e) => e.preventDefault();

    canvas.addEventListener('wheel', handleWheel, { passive: false });
    canvas.addEventListener('mousedown', handleMouseDown);
    canvas.addEventListener('mousemove', handleMouseMove);
    canvas.addEventListener('mouseup', handleMouseUp);
    canvas.addEventListener('mouseleave', handleMouseUp);
    canvas.addEventListener('contextmenu', handleContextMenu);

    return () => {
      canvas.removeEventListener('wheel', handleWheel);
      canvas.removeEventListener('mousedown', handleMouseDown);
      canvas.removeEventListener('mousemove', handleMouseMove);
      canvas.removeEventListener('mouseup', handleMouseUp);
      canvas.removeEventListener('mouseleave', handleMouseUp);
      canvas.removeEventListener('contextmenu', handleContextMenu);
    };
  }, [gl, camera, center]);

  return null;
}

// 메인 맵 컴포넌트
function MapScene({
  mapData,
  units,
  activeUnit,
  movableRange,
  attackRange,
  selectedTile,
  onTileClick,
  damagePopups,
  skillEffects,
  menuState,
  onMenuAction,
  potions,
}) {
  const [hoveredTile, setHoveredTile] = useState(null);
  const [deathEffects, setDeathEffects] = useState([]);
  const [dustEffects, setDustEffects] = useState([]);
  const prevUnitsRef = useRef({});
  const prevPosRef = useRef({});

  // 유닛 사망/이동 감지
  useEffect(() => {
    const prevUnits = prevUnitsRef.current;
    const newDeaths = [];
    const newDusts = [];
    units.forEach(u => {
      // 사망 감지
      if (u.hp <= 0 && prevUnits[u.id] && prevUnits[u.id].hp > 0) {
        newDeaths.push({ x: u.x, z: u.z, team: u.team, time: Date.now() });
      }
      // 이동 감지 (먼지)
      const prevP = prevPosRef.current[u.id];
      if (prevP && (prevP.x !== u.x || prevP.z !== u.z)) {
        newDusts.push({ x: prevP.x, z: prevP.z, time: Date.now() });
      }
      prevPosRef.current[u.id] = { x: u.x, z: u.z };
    });
    if (newDeaths.length > 0) {
      setDeathEffects(prev => [...prev.slice(-3), ...newDeaths]);
    }
    if (newDusts.length > 0) {
      setDustEffects(prev => [...prev.slice(-4), ...newDusts]);
    }
    const map = {};
    units.forEach(u => { map[u.id] = { hp: u.hp }; });
    prevUnitsRef.current = map;
  }, [units]);

  const movableSet = useMemo(() => {
    const set = new Set();
    (movableRange || []).forEach(t => set.add(`${t.x},${t.z}`));
    return set;
  }, [movableRange]);

  const attackSet = useMemo(() => {
    const set = new Set();
    (attackRange || []).forEach(t => set.add(`${t.x},${t.z}`));
    return set;
  }, [attackRange]);

  const handleHover = useCallback((tile) => setHoveredTile(tile), []);
  const handleUnhover = useCallback(() => setHoveredTile(null), []);

  return (
    <>
      <CameraController mapWidth={mapData.width} mapHeight={mapData.height} />
      <ambientLight intensity={0.45} />
      <directionalLight
        position={[5, 12, 5]}
        intensity={1.2}
        castShadow
        shadow-mapSize-width={1024}
        shadow-mapSize-height={1024}
        shadow-camera-left={-15}
        shadow-camera-right={15}
        shadow-camera-top={15}
        shadow-camera-bottom={-15}
        shadow-bias={-0.001}
      />
      <directionalLight position={[-3, 6, -3]} intensity={0.35} />
      <hemisphereLight args={['#b1e1ff', '#4a3728', 0.35]} />

      {/* 타일들 */}
      {mapData.tiles.map((tile) => (
        <Tile
          key={`${tile.x}-${tile.z}`}
          tile={tile}
          isMovable={movableSet.has(`${tile.x},${tile.z}`)}
          isAttackable={attackSet.has(`${tile.x},${tile.z}`)}
          isSelected={selectedTile && selectedTile.x === tile.x && selectedTile.z === tile.z}
          isHovered={hoveredTile && hoveredTile.x === tile.x && hoveredTile.z === tile.z}
          onClick={onTileClick}
          onHover={handleHover}
          onUnhover={handleUnhover}
        />
      ))}

      {/* 유닛들 */}
      {units.map((unit) => (
        <UnitMesh
          key={unit.id}
          unit={unit}
          isActive={activeUnit && activeUnit.id === unit.id}
          mapData={mapData}
        />
      ))}

      {/* 스킬 이펙트 */}
      {(skillEffects || []).map((e, i) => (
        <SkillEffectRenderer key={`fx-${i}-${e.time}`} effect={e} />
      ))}

      {/* 데미지 팝업 */}
      {damagePopups.map((p, i) => (
        <DamagePopup key={`popup-${i}-${p.time}`} popup={p} />
      ))}

      {/* 사망 이펙트 */}
      {deathEffects.map((de, i) => (
        <DeathEffect key={`death-${i}-${de.time}`} x={de.x} z={de.z} team={de.team} mapData={mapData} />
      ))}

      {/* 이동 먼지 */}
      {dustEffects.map((dust, i) => (
        <MoveDustEffect key={`dust-${i}-${dust.time}`} x={dust.x} z={dust.z} mapData={mapData} />
      ))}

      {/* 배경 부유 파티클 */}
      <AmbientParticles mapWidth={mapData.width} mapHeight={mapData.height} />

      {/* 유닛 컨텍스트 메뉴 */}
      {activeUnit && menuState && menuState.show && (
        <UnitContextMenu
          unit={activeUnit}
          mapData={mapData}
          menuState={menuState}
          onAction={onMenuAction}
          potions={potions}
        />
      )}
    </>
  );
}

export default function IsometricMap(props) {
  const handleMiss = useCallback(() => {
    if (props.onCanvasMiss) props.onCanvasMiss();
  }, [props]);

  return (
    <Canvas
      style={{ width: '100%', height: '100%', background: 'var(--bg-darkest, #0b0e14)' }}
      orthographic
      camera={{ zoom: 50, position: [10, 12, 10], near: 0.1, far: 100 }}
      onPointerMissed={handleMiss}
      dpr={[1, 2]}
      shadows
      gl={{ antialias: true, toneMapping: THREE.ACESFilmicToneMapping, toneMappingExposure: 1.1 }}
    >
      <MapScene {...props} />
    </Canvas>
  );
}
