import React from 'react';

// ============================================================
// 프로시저럴 3D 모델
// 플레이어 3종, 소환수 12종, 몬스터 126종
// ============================================================

// ============================================================
// ===== 플레이어 캐릭터 모델 (3종) =====
// ============================================================

// 풍수사 - 도포 입은 동양 마법사, 부적과 나침반, 풍수 지팡이
export function FengShuiMasterModel({ color }) {
  return (
    <group>
      {/* 도포 하의 (넓은 치마) */}
      <mesh position={[0, 0.18, 0]}>
        <coneGeometry args={[0.35, 0.52, 10]} />
        <meshStandardMaterial color="#1a237e" />
      </mesh>
      {/* 도포 상의 */}
      <mesh position={[0, 0.48, 0]}>
        <cylinderGeometry args={[0.16, 0.24, 0.24, 10]} />
        <meshStandardMaterial color="#283593" />
      </mesh>
      {/* 도포 깃 (V자 앞여밈) */}
      <mesh position={[0, 0.48, 0.14]} rotation={[0.2, 0, 0]}>
        <boxGeometry args={[0.16, 0.2, 0.02]} />
        <meshStandardMaterial color="#e8eaf6" />
      </mesh>
      {/* 허리띠 */}
      <mesh position={[0, 0.38, 0]}>
        <cylinderGeometry args={[0.25, 0.25, 0.04, 10]} />
        <meshStandardMaterial color="#ffd54f" metalness={0.4} roughness={0.5} />
      </mesh>
      {/* 머리 */}
      <mesh position={[0, 0.66, 0]}>
        <sphereGeometry args={[0.14, 10, 10]} />
        <meshStandardMaterial color="#ffe0b2" />
      </mesh>
      {/* 상투 (탕건) */}
      <mesh position={[0, 0.78, 0]}>
        <cylinderGeometry args={[0.06, 0.1, 0.1, 8]} />
        <meshStandardMaterial color="#212121" />
      </mesh>
      {/* 탕건 장식 */}
      <mesh position={[0, 0.84, 0]}>
        <sphereGeometry args={[0.04, 6, 6]} />
        <meshStandardMaterial color="#ffd54f" metalness={0.6} />
      </mesh>
      {/* 풍수 나침반 (왼손) */}
      <mesh position={[-0.28, 0.42, 0.05]} rotation={[-Math.PI/2, 0, 0]}>
        <cylinderGeometry args={[0.08, 0.08, 0.02, 12]} />
        <meshStandardMaterial color="#5d4037" />
      </mesh>
      <mesh position={[-0.28, 0.43, 0.05]} rotation={[-Math.PI/2, 0, 0]}>
        <cylinderGeometry args={[0.06, 0.06, 0.015, 12]} />
        <meshStandardMaterial color="#c8e6c9" emissive="#4caf50" emissiveIntensity={0.3} />
      </mesh>
      {/* 나침반 바늘 */}
      <mesh position={[-0.28, 0.44, 0.05]} rotation={[-Math.PI/2, 0, 0.5]}>
        <boxGeometry args={[0.08, 0.01, 0.01]} />
        <meshStandardMaterial color="#f44336" />
      </mesh>
      {/* 지팡이 (오른손) - 팔괘 무늬 봉 */}
      <mesh position={[0.26, 0.42, 0]}>
        <cylinderGeometry args={[0.025, 0.025, 0.85, 6]} />
        <meshStandardMaterial color="#4e342e" />
      </mesh>
      {/* 지팡이 상단 장식 (팔괘 원형) */}
      <mesh position={[0.26, 0.86, 0]}>
        <torusGeometry args={[0.06, 0.015, 6, 12]} />
        <meshStandardMaterial color="#ffd54f" metalness={0.7} roughness={0.2} />
      </mesh>
      {/* 지팡이 중앙 보석 */}
      <mesh position={[0.26, 0.86, 0]}>
        <octahedronGeometry args={[0.035, 0]} />
        <meshStandardMaterial color="#2196f3" emissive="#1565c0" emissiveIntensity={0.8} />
      </mesh>
      {/* 부적 (허리에 매달린 여러 장) */}
      {[-0.12, 0, 0.12].map((xOff, i) => (
        <mesh key={i} position={[xOff, 0.28, 0.26]} rotation={[0.3, (i-1)*0.2, 0]}>
          <boxGeometry args={[0.05, 0.1, 0.005]} />
          <meshStandardMaterial color="#fff9c4" emissive="#ffeb3b" emissiveIntensity={0.2} />
        </mesh>
      ))}
      {/* 기 에너지 아우라 */}
      <mesh position={[0, 0.45, 0]}>
        <sphereGeometry args={[0.42, 12, 12]} />
        <meshStandardMaterial color={color || "#42a5f5"} transparent opacity={0.06} />
      </mesh>
    </group>
  );
}

// 무당 - 한복 입은 신령 주술사, 방울과 부채, 신기
export function MudangModel({ color }) {
  return (
    <group>
      {/* 치마 (한복 하의 - 넓은 A라인) */}
      <mesh position={[0, 0.2, 0]}>
        <coneGeometry args={[0.38, 0.55, 12]} />
        <meshStandardMaterial color="#e91e63" />
      </mesh>
      {/* 치마 무늬 띠 */}
      <mesh position={[0, 0.15, 0]}>
        <cylinderGeometry args={[0.38, 0.38, 0.03, 12]} />
        <meshStandardMaterial color="#f48fb1" />
      </mesh>
      {/* 저고리 (한복 상의) */}
      <mesh position={[0, 0.5, 0]}>
        <cylinderGeometry args={[0.14, 0.2, 0.22, 10]} />
        <meshStandardMaterial color="#ffffff" />
      </mesh>
      {/* 저고리 고름 (리본) */}
      <mesh position={[0.06, 0.46, 0.15]} rotation={[0.3, 0, 0.2]}>
        <boxGeometry args={[0.04, 0.16, 0.015]} />
        <meshStandardMaterial color="#e91e63" />
      </mesh>
      <mesh position={[-0.02, 0.44, 0.15]} rotation={[0.3, 0, -0.15]}>
        <boxGeometry args={[0.04, 0.14, 0.015]} />
        <meshStandardMaterial color="#e91e63" />
      </mesh>
      {/* 머리 */}
      <mesh position={[0, 0.66, 0]}>
        <sphereGeometry args={[0.14, 10, 10]} />
        <meshStandardMaterial color="#ffe0b2" />
      </mesh>
      {/* 머리카락 (길게 내려오는) */}
      <mesh position={[0, 0.66, -0.06]}>
        <sphereGeometry args={[0.15, 10, 10]} />
        <meshStandardMaterial color="#3e2723" />
      </mesh>
      {/* 꽃 장식 머리띠 */}
      <mesh position={[0, 0.74, 0.04]}>
        <torusGeometry args={[0.1, 0.012, 6, 12]} />
        <meshStandardMaterial color="#ffd54f" metalness={0.5} roughness={0.3} />
      </mesh>
      {/* 머리띠 꽃 */}
      <mesh position={[0.08, 0.76, 0.08]}>
        <dodecahedronGeometry args={[0.04, 0]} />
        <meshStandardMaterial color="#f06292" emissive="#e91e63" emissiveIntensity={0.3} />
      </mesh>
      {/* 신령 방울 (오른손) */}
      <mesh position={[0.28, 0.48, 0]}>
        <cylinderGeometry args={[0.015, 0.015, 0.2, 4]} />
        <meshStandardMaterial color="#8d6e63" />
      </mesh>
      {/* 방울 3개 (줄에 매달린) */}
      {[0.56, 0.52, 0.48].map((yy, i) => (
        <mesh key={i} position={[0.28 + (i-1)*0.03, yy, 0]}>
          <sphereGeometry args={[0.03, 6, 6]} />
          <meshStandardMaterial color="#ffd54f" metalness={0.7} roughness={0.2} />
        </mesh>
      ))}
      {/* 부채 (왼손) */}
      <mesh position={[-0.26, 0.46, 0.04]} rotation={[0.2, 0.3, 0.5]}>
        <circleGeometry args={[0.12, 12, 0, Math.PI * 0.7]} />
        <meshStandardMaterial color="#fff9c4" side={2} />
      </mesh>
      <mesh position={[-0.26, 0.46, 0.035]} rotation={[0.2, 0.3, 0.5]}>
        <circleGeometry args={[0.12, 12, 0, Math.PI * 0.7]} />
        <meshStandardMaterial color="#ffcdd2" side={2} />
      </mesh>
      {/* 부채 자루 */}
      <mesh position={[-0.26, 0.38, -0.02]} rotation={[0, 0, 0.5]}>
        <cylinderGeometry args={[0.012, 0.012, 0.15, 4]} />
        <meshStandardMaterial color="#5d4037" />
      </mesh>
      {/* 신기 오라 */}
      <mesh position={[0, 0.45, 0]}>
        <sphereGeometry args={[0.44, 12, 12]} />
        <meshStandardMaterial color={color || "#e040fb"} transparent opacity={0.06} />
      </mesh>
    </group>
  );
}

// 승려 - 가사 입은 불교 승려, 금강저와 염주, 목탁
export function BuddhistMonkModel({ color }) {
  return (
    <group>
      {/* 법의 하의 (승복 치마) */}
      <mesh position={[0, 0.18, 0]}>
        <cylinderGeometry args={[0.24, 0.32, 0.5, 10]} />
        <meshStandardMaterial color="#e65100" />
      </mesh>
      {/* 가사 (어깨에서 비스듬히) */}
      <mesh position={[-0.06, 0.5, 0.02]} rotation={[0, 0, 0.15]}>
        <cylinderGeometry args={[0.16, 0.2, 0.28, 10]} />
        <meshStandardMaterial color="#ff8f00" />
      </mesh>
      {/* 가사 띠 (대각선) */}
      <mesh position={[0.04, 0.48, 0.15]} rotation={[0.1, 0, -0.4]}>
        <boxGeometry args={[0.06, 0.35, 0.015]} />
        <meshStandardMaterial color="#ffb300" />
      </mesh>
      {/* 머리 (깎은 머리) */}
      <mesh position={[0, 0.68, 0]}>
        <sphereGeometry args={[0.15, 10, 10]} />
        <meshStandardMaterial color="#d7ccc8" />
      </mesh>
      {/* 계점 (이마) */}
      {[0, 1, 2].map(i => (
        <mesh key={i} position={[0, 0.72 + i * 0.025, 0.14]}>
          <sphereGeometry args={[0.012, 4, 4]} />
          <meshStandardMaterial color="#795548" />
        </mesh>
      ))}
      {/* 염주 목걸이 (크게) */}
      <mesh position={[0, 0.52, 0.08]}>
        <torusGeometry args={[0.14, 0.018, 8, 20]} />
        <meshStandardMaterial color="#5d4037" />
      </mesh>
      {/* 염주 알 (큰 것) */}
      <mesh position={[0, 0.38, 0.18]}>
        <sphereGeometry args={[0.03, 6, 6]} />
        <meshStandardMaterial color="#ff6f00" emissive="#e65100" emissiveIntensity={0.3} />
      </mesh>
      {/* 금강저 (오른손 - 불교 법기) */}
      <mesh position={[0.26, 0.44, 0]}>
        <cylinderGeometry args={[0.02, 0.02, 0.35, 6]} />
        <meshStandardMaterial color="#ffd54f" metalness={0.7} roughness={0.2} />
      </mesh>
      {/* 금강저 상단 */}
      <mesh position={[0.26, 0.63, 0]}>
        <coneGeometry args={[0.04, 0.08, 6]} />
        <meshStandardMaterial color="#ffd54f" metalness={0.8} roughness={0.15} />
      </mesh>
      {/* 금강저 하단 */}
      <mesh position={[0.26, 0.26, 0]} rotation={[Math.PI, 0, 0]}>
        <coneGeometry args={[0.04, 0.08, 6]} />
        <meshStandardMaterial color="#ffd54f" metalness={0.8} roughness={0.15} />
      </mesh>
      {/* 금강저 중앙 구슬 */}
      <mesh position={[0.26, 0.44, 0]}>
        <sphereGeometry args={[0.035, 6, 6]} />
        <meshStandardMaterial color="#ff6f00" emissive="#e65100" emissiveIntensity={0.5} />
      </mesh>
      {/* 목탁 (왼손) */}
      <mesh position={[-0.24, 0.38, 0]}>
        <sphereGeometry args={[0.07, 8, 8]} />
        <meshStandardMaterial color="#4e342e" />
      </mesh>
      {/* 목탁 채 */}
      <mesh position={[-0.24, 0.38, 0.1]} rotation={[Math.PI/2, 0, 0]}>
        <cylinderGeometry args={[0.012, 0.012, 0.14, 4]} />
        <meshStandardMaterial color="#8d6e63" />
      </mesh>
      {/* 불심 오라 */}
      <mesh position={[0, 0.5, 0]}>
        <sphereGeometry args={[0.44, 12, 12]} />
        <meshStandardMaterial color={color || "#ffb74d"} transparent opacity={0.06} />
      </mesh>
    </group>
  );
}

// ============================================================
// ===== 소환수 모델 (12종) =====
// ============================================================

// 떠도는 원혼 - 하늘색 유령, 꼬리가 흩어지는 형태
export function WanderingSoulModel() {
  return (
    <group>
      <mesh position={[0, 0.3, 0]}>
        <sphereGeometry args={[0.16, 10, 10]} />
        <meshStandardMaterial color="#b3e5fc" emissive="#03a9f4" emissiveIntensity={0.5} transparent opacity={0.7} />
      </mesh>
      <mesh position={[0, 0.14, 0]}>
        <coneGeometry args={[0.18, 0.3, 8]} />
        <meshStandardMaterial color="#81d4fa" emissive="#29b6f6" emissiveIntensity={0.3} transparent opacity={0.5} />
      </mesh>
      {/* 꼬리 (아래로 흩어짐) */}
      {[-0.06, 0, 0.06].map((x, i) => (
        <mesh key={i} position={[x, -0.02 - i*0.03, 0]} rotation={[0, 0, (i-1)*0.2]}>
          <coneGeometry args={[0.04, 0.15, 4]} />
          <meshStandardMaterial color="#b3e5fc" transparent opacity={0.3 - i*0.08} />
        </mesh>
      ))}
      {/* 눈 */}
      <mesh position={[-0.05, 0.32, 0.14]}><sphereGeometry args={[0.025, 6, 6]} /><meshStandardMaterial color="#ffffff" emissive="#e3f2fd" emissiveIntensity={0.8} /></mesh>
      <mesh position={[0.05, 0.32, 0.14]}><sphereGeometry args={[0.025, 6, 6]} /><meshStandardMaterial color="#ffffff" emissive="#e3f2fd" emissiveIntensity={0.8} /></mesh>
      <mesh position={[0, 0.35, 0]}><sphereGeometry args={[0.28, 10, 10]} /><meshStandardMaterial color="#4fc3f7" transparent opacity={0.06} /></mesh>
    </group>
  );
}

// 묘지 귀신 - 보라색 귀신, 무덤에서 올라온 듯한 형태
export function GraveyardGhostModel() {
  return (
    <group>
      <mesh position={[0, 0.32, 0]}>
        <sphereGeometry args={[0.18, 10, 10]} />
        <meshStandardMaterial color="#ce93d8" emissive="#9c27b0" emissiveIntensity={0.4} transparent opacity={0.75} />
      </mesh>
      <mesh position={[0, 0.14, 0]}>
        <cylinderGeometry args={[0.12, 0.22, 0.3, 8]} />
        <meshStandardMaterial color="#ab47bc" emissive="#7b1fa2" emissiveIntensity={0.3} transparent opacity={0.6} />
      </mesh>
      {/* 팔 */}
      <mesh position={[-0.2, 0.28, 0.06]} rotation={[0, 0, 0.5]}>
        <coneGeometry args={[0.05, 0.2, 4]} />
        <meshStandardMaterial color="#ce93d8" transparent opacity={0.5} />
      </mesh>
      <mesh position={[0.2, 0.28, 0.06]} rotation={[0, 0, -0.5]}>
        <coneGeometry args={[0.05, 0.2, 4]} />
        <meshStandardMaterial color="#ce93d8" transparent opacity={0.5} />
      </mesh>
      {/* 눈 (붉은 빛) */}
      <mesh position={[-0.06, 0.35, 0.15]}><sphereGeometry args={[0.025, 6, 6]} /><meshStandardMaterial color="#ff5252" emissive="#f44336" emissiveIntensity={1.0} /></mesh>
      <mesh position={[0.06, 0.35, 0.15]}><sphereGeometry args={[0.025, 6, 6]} /><meshStandardMaterial color="#ff5252" emissive="#f44336" emissiveIntensity={1.0} /></mesh>
      {/* 묘비 파편 */}
      <mesh position={[0, -0.02, -0.08]} rotation={[0.1, 0, 0]}>
        <boxGeometry args={[0.15, 0.06, 0.04]} />
        <meshStandardMaterial color="#616161" />
      </mesh>
    </group>
  );
}

// 구미호 영혼 - 금빛 여우, 9개 꼬리, 신비로운 오라
export function NineTailFoxSummonModel() {
  return (
    <group>
      <mesh position={[0, 0.15, 0]} scale={[1, 0.8, 1.3]}>
        <sphereGeometry args={[0.18, 10, 10]} />
        <meshStandardMaterial color="#ffb74d" />
      </mesh>
      <mesh position={[0, 0.32, 0.12]}>
        <sphereGeometry args={[0.12, 10, 10]} />
        <meshStandardMaterial color="#fff3e0" />
      </mesh>
      {/* 귀 */}
      <mesh position={[-0.06, 0.42, 0.1]} rotation={[0.2, 0, -0.2]}>
        <coneGeometry args={[0.04, 0.1, 4]} />
        <meshStandardMaterial color="#ffcc80" />
      </mesh>
      <mesh position={[0.06, 0.42, 0.1]} rotation={[0.2, 0, 0.2]}>
        <coneGeometry args={[0.04, 0.1, 4]} />
        <meshStandardMaterial color="#ffcc80" />
      </mesh>
      {/* 눈 (금빛) */}
      <mesh position={[-0.04, 0.34, 0.22]}><sphereGeometry args={[0.02, 6, 6]} /><meshStandardMaterial color="#ffd600" emissive="#ff6f00" emissiveIntensity={0.8} /></mesh>
      <mesh position={[0.04, 0.34, 0.22]}><sphereGeometry args={[0.02, 6, 6]} /><meshStandardMaterial color="#ffd600" emissive="#ff6f00" emissiveIntensity={0.8} /></mesh>
      {/* 9개 꼬리 (부채꼴) */}
      {Array.from({length:9}).map((_, i) => {
        const angle = ((i - 4) * 0.25);
        return (
          <mesh key={i} position={[Math.sin(angle)*0.12, 0.15 + Math.abs(i-4)*0.02, -0.22 - Math.cos(angle)*0.05]} rotation={[0.8 + Math.abs(i-4)*0.08, angle, 0]}>
            <coneGeometry args={[0.025, 0.25, 4]} />
            <meshStandardMaterial color="#ffcc02" emissive="#ff8f00" emissiveIntensity={0.3} />
          </mesh>
        );
      })}
      {/* 여우불 오라 */}
      <mesh position={[0, 0.25, 0]}><sphereGeometry args={[0.35, 10, 10]} /><meshStandardMaterial color="#ff9800" transparent opacity={0.08} /></mesh>
    </group>
  );
}

// 들쥐 소환수 - 작은 회색 쥐
export function MouseSummonModel() {
  return (
    <group>
      <mesh position={[0, 0.1, 0]} scale={[1, 0.7, 1.3]}>
        <sphereGeometry args={[0.12, 8, 8]} />
        <meshStandardMaterial color="#9e9e9e" />
      </mesh>
      <mesh position={[0, 0.16, 0.12]}>
        <sphereGeometry args={[0.08, 8, 8]} />
        <meshStandardMaterial color="#bdbdbd" />
      </mesh>
      {/* 귀 */}
      <mesh position={[-0.05, 0.22, 0.1]}><sphereGeometry args={[0.04, 6, 6]} /><meshStandardMaterial color="#f48fb1" /></mesh>
      <mesh position={[0.05, 0.22, 0.1]}><sphereGeometry args={[0.04, 6, 6]} /><meshStandardMaterial color="#f48fb1" /></mesh>
      {/* 눈 */}
      <mesh position={[-0.03, 0.18, 0.18]}><sphereGeometry args={[0.015, 4, 4]} /><meshStandardMaterial color="#212121" /></mesh>
      <mesh position={[0.03, 0.18, 0.18]}><sphereGeometry args={[0.015, 4, 4]} /><meshStandardMaterial color="#212121" /></mesh>
      {/* 꼬리 */}
      <mesh position={[0, 0.08, -0.16]} rotation={[0.8, 0, 0]}>
        <cylinderGeometry args={[0.008, 0.015, 0.2, 4]} />
        <meshStandardMaterial color="#e0a0a0" />
      </mesh>
    </group>
  );
}

// 야생 늑대 소환수 - 은빛 늑대
export function WolfSummonModel() {
  return (
    <group>
      <mesh position={[0, 0.16, 0]} scale={[0.9, 0.8, 1.4]}>
        <sphereGeometry args={[0.18, 10, 10]} />
        <meshStandardMaterial color="#78909c" />
      </mesh>
      <mesh position={[0, 0.24, 0.2]}>
        <sphereGeometry args={[0.11, 8, 8]} />
        <meshStandardMaterial color="#90a4ae" />
      </mesh>
      {/* 주둥이 */}
      <mesh position={[0, 0.22, 0.3]} rotation={[-0.2, 0, 0]}>
        <coneGeometry args={[0.05, 0.12, 6]} />
        <meshStandardMaterial color="#b0bec5" />
      </mesh>
      {/* 귀 */}
      <mesh position={[-0.06, 0.34, 0.16]} rotation={[0.3, 0, -0.15]}>
        <coneGeometry args={[0.035, 0.1, 4]} />
        <meshStandardMaterial color="#546e7a" />
      </mesh>
      <mesh position={[0.06, 0.34, 0.16]} rotation={[0.3, 0, 0.15]}>
        <coneGeometry args={[0.035, 0.1, 4]} />
        <meshStandardMaterial color="#546e7a" />
      </mesh>
      {/* 눈 */}
      <mesh position={[-0.05, 0.27, 0.26]}><sphereGeometry args={[0.018, 6, 6]} /><meshStandardMaterial color="#ffeb3b" emissive="#ffc107" emissiveIntensity={0.6} /></mesh>
      <mesh position={[0.05, 0.27, 0.26]}><sphereGeometry args={[0.018, 6, 6]} /><meshStandardMaterial color="#ffeb3b" emissive="#ffc107" emissiveIntensity={0.6} /></mesh>
      {/* 꼬리 */}
      <mesh position={[0, 0.18, -0.22]} rotation={[0.6, 0, 0]}>
        <coneGeometry args={[0.06, 0.22, 6]} />
        <meshStandardMaterial color="#607d8b" />
      </mesh>
      {/* 다리 */}
      {[[-0.08, 0, 0.08],[0.08, 0, 0.08],[-0.08, 0, -0.08],[0.08, 0, -0.08]].map((p,i) => (
        <mesh key={i} position={p}><cylinderGeometry args={[0.025, 0.03, 0.16, 4]} /><meshStandardMaterial color="#546e7a" /></mesh>
      ))}
    </group>
  );
}

// 골렘 파편 소환수 - 작은 바위 골렘
export function GolemFragmentModel() {
  return (
    <group>
      <mesh position={[0, 0.18, 0]}>
        <dodecahedronGeometry args={[0.2, 0]} />
        <meshStandardMaterial color="#795548" roughness={0.9} />
      </mesh>
      <mesh position={[0, 0.38, 0]}>
        <dodecahedronGeometry args={[0.13, 0]} />
        <meshStandardMaterial color="#8d6e63" roughness={0.85} />
      </mesh>
      {/* 눈 (빛나는 틈) */}
      <mesh position={[-0.06, 0.4, 0.1]}><boxGeometry args={[0.04, 0.02, 0.02]} /><meshStandardMaterial color="#ff9800" emissive="#ff6d00" emissiveIntensity={1.0} /></mesh>
      <mesh position={[0.06, 0.4, 0.1]}><boxGeometry args={[0.04, 0.02, 0.02]} /><meshStandardMaterial color="#ff9800" emissive="#ff6d00" emissiveIntensity={1.0} /></mesh>
      {/* 팔 (바위) */}
      <mesh position={[-0.22, 0.28, 0]}><dodecahedronGeometry args={[0.07, 0]} /><meshStandardMaterial color="#6d4c41" roughness={0.9} /></mesh>
      <mesh position={[0.22, 0.28, 0]}><dodecahedronGeometry args={[0.07, 0]} /><meshStandardMaterial color="#6d4c41" roughness={0.9} /></mesh>
      {/* 균열 빛 */}
      <mesh position={[0, 0.25, 0.12]}><boxGeometry args={[0.02, 0.15, 0.01]} /><meshStandardMaterial color="#ffab00" emissive="#ff6d00" emissiveIntensity={0.6} /></mesh>
    </group>
  );
}

// 독거미 여왕 소환수 - 큰 보라색 거미
export function SpiderQueenSummonModel() {
  return (
    <group>
      <mesh position={[0, 0.15, -0.04]} scale={[1.2, 0.8, 1.4]}>
        <sphereGeometry args={[0.14, 8, 8]} />
        <meshStandardMaterial color="#6a1b9a" />
      </mesh>
      <mesh position={[0, 0.18, 0.12]}>
        <sphereGeometry args={[0.09, 8, 8]} />
        <meshStandardMaterial color="#7b1fa2" />
      </mesh>
      {/* 눈 (8개) */}
      {[[-0.04,0.22,0.18],[0.04,0.22,0.18],[-0.06,0.2,0.16],[0.06,0.2,0.16]].map((p,i)=>(
        <mesh key={i} position={p}><sphereGeometry args={[0.012, 4, 4]} /><meshStandardMaterial color="#f44336" emissive="#d50000" emissiveIntensity={0.8} /></mesh>
      ))}
      {/* 다리 8개 */}
      {[[-0.15,0.12,0.08],[0.15,0.12,0.08],[-0.18,0.1,0],[0.18,0.1,0],[-0.16,0.1,-0.06],[0.16,0.1,-0.06],[-0.12,0.11,-0.1],[0.12,0.11,-0.1]].map((p,i)=>(
        <mesh key={i} position={p} rotation={[0, 0, (p[0]>0?-1:1)*0.6]}>
          <cylinderGeometry args={[0.012, 0.008, 0.18, 3]} />
          <meshStandardMaterial color="#4a148c" />
        </mesh>
      ))}
      {/* 독 파티클 */}
      <mesh position={[0, 0.15, 0]}><sphereGeometry args={[0.25, 8, 8]} /><meshStandardMaterial color="#e040fb" transparent opacity={0.06} /></mesh>
    </group>
  );
}

// 물의 정령 소환수 - 물방울 형태 정령
export function WaterSpiritSummonModel() {
  return (
    <group>
      <mesh position={[0, 0.22, 0]}>
        <sphereGeometry args={[0.2, 12, 12]} />
        <meshStandardMaterial color="#4fc3f7" transparent opacity={0.7} emissive="#0288d1" emissiveIntensity={0.3} />
      </mesh>
      <mesh position={[0, 0.42, 0]}>
        <coneGeometry args={[0.12, 0.18, 8]} />
        <meshStandardMaterial color="#29b6f6" transparent opacity={0.6} emissive="#0277bd" emissiveIntensity={0.3} />
      </mesh>
      {/* 눈 */}
      <mesh position={[-0.06, 0.25, 0.16]}><sphereGeometry args={[0.025, 6, 6]} /><meshStandardMaterial color="#e3f2fd" emissive="#bbdefb" emissiveIntensity={0.8} /></mesh>
      <mesh position={[0.06, 0.25, 0.16]}><sphereGeometry args={[0.025, 6, 6]} /><meshStandardMaterial color="#e3f2fd" emissive="#bbdefb" emissiveIntensity={0.8} /></mesh>
      {/* 물방울 파티클 */}
      {[[-0.15,0.35,0.05],[0.12,0.38,-0.05],[0.05,0.1,0.12],[-0.1,0.08,-0.1]].map((p,i) => (
        <mesh key={i} position={p}><sphereGeometry args={[0.03, 6, 6]} /><meshStandardMaterial color="#81d4fa" transparent opacity={0.5} /></mesh>
      ))}
      <mesh position={[0, 0.22, 0]}><sphereGeometry args={[0.32, 10, 10]} /><meshStandardMaterial color="#03a9f4" transparent opacity={0.06} /></mesh>
    </group>
  );
}

// 불의 정령 소환수 - 불꽃 형태 정령
export function FireSpiritSummonModel() {
  return (
    <group>
      <mesh position={[0, 0.2, 0]}>
        <sphereGeometry args={[0.18, 10, 10]} />
        <meshStandardMaterial color="#ff7043" emissive="#e64a19" emissiveIntensity={0.6} />
      </mesh>
      <mesh position={[0, 0.4, 0]}>
        <coneGeometry args={[0.14, 0.25, 8]} />
        <meshStandardMaterial color="#ff5722" emissive="#bf360c" emissiveIntensity={0.5} />
      </mesh>
      <mesh position={[0, 0.56, 0]}>
        <coneGeometry args={[0.07, 0.15, 6]} />
        <meshStandardMaterial color="#ffab00" emissive="#ff6d00" emissiveIntensity={0.8} />
      </mesh>
      {/* 눈 */}
      <mesh position={[-0.06, 0.24, 0.14]}><sphereGeometry args={[0.025, 6, 6]} /><meshStandardMaterial color="#fff176" emissive="#fdd835" emissiveIntensity={1.0} /></mesh>
      <mesh position={[0.06, 0.24, 0.14]}><sphereGeometry args={[0.025, 6, 6]} /><meshStandardMaterial color="#fff176" emissive="#fdd835" emissiveIntensity={1.0} /></mesh>
      {/* 불꽃 파편 */}
      {[[-0.14,0.3,0.08],[0.14,0.32,-0.06],[-0.08,0.48,0.08],[0.1,0.5,-0.04]].map((p,i) => (
        <mesh key={i} position={p}><coneGeometry args={[0.03, 0.1, 4]} /><meshStandardMaterial color="#ffab40" emissive="#ff6d00" emissiveIntensity={0.6} /></mesh>
      ))}
      <mesh position={[0, 0.3, 0]}><sphereGeometry args={[0.3, 10, 10]} /><meshStandardMaterial color="#ff3d00" transparent opacity={0.08} /></mesh>
    </group>
  );
}

// 바람의 정령 소환수 - 소용돌이 형태 정령
export function WindSpiritSummonModel() {
  return (
    <group>
      <mesh position={[0, 0.25, 0]}>
        <sphereGeometry args={[0.16, 10, 10]} />
        <meshStandardMaterial color="#e0f7fa" transparent opacity={0.5} emissive="#00bcd4" emissiveIntensity={0.3} />
      </mesh>
      {/* 소용돌이 링 */}
      {[0.1, 0.22, 0.34].map((y, i) => (
        <mesh key={i} position={[0, y, 0]} rotation={[0, i * 1.2, Math.PI/2 * 0.9]}>
          <torusGeometry args={[0.12 + i*0.03, 0.02, 6, 16]} />
          <meshStandardMaterial color="#80deea" transparent opacity={0.4 - i*0.08} emissive="#00acc1" emissiveIntensity={0.3} />
        </mesh>
      ))}
      {/* 눈 */}
      <mesh position={[-0.05, 0.28, 0.13]}><sphereGeometry args={[0.022, 6, 6]} /><meshStandardMaterial color="#e0f7fa" emissive="#84ffff" emissiveIntensity={0.8} /></mesh>
      <mesh position={[0.05, 0.28, 0.13]}><sphereGeometry args={[0.022, 6, 6]} /><meshStandardMaterial color="#e0f7fa" emissive="#84ffff" emissiveIntensity={0.8} /></mesh>
      {/* 바람 파티클 */}
      {[[0.2,0.3,0],[-0.18,0.2,0.1],[0.1,0.4,-0.12]].map((p,i) => (
        <mesh key={i} position={p} rotation={[0, i, 0]}>
          <boxGeometry args={[0.06, 0.015, 0.015]} />
          <meshStandardMaterial color="#b2ebf2" transparent opacity={0.4} />
        </mesh>
      ))}
    </group>
  );
}

// 해골 전사 소환수 - 갑옷 입은 해골
export function SkeletonWarriorSummonModel() {
  return (
    <group>
      {/* 갑옷 하체 */}
      <mesh position={[0, 0.16, 0]}>
        <cylinderGeometry args={[0.14, 0.18, 0.34, 6]} />
        <meshStandardMaterial color="#455a64" metalness={0.4} roughness={0.6} />
      </mesh>
      {/* 갑옷 상체 */}
      <mesh position={[0, 0.38, 0]}>
        <cylinderGeometry args={[0.12, 0.16, 0.2, 6]} />
        <meshStandardMaterial color="#546e7a" metalness={0.5} roughness={0.5} />
      </mesh>
      {/* 해골 머리 */}
      <mesh position={[0, 0.54, 0]}>
        <sphereGeometry args={[0.11, 8, 8]} />
        <meshStandardMaterial color="#efebe9" />
      </mesh>
      {/* 눈구멍 */}
      <mesh position={[-0.04, 0.56, 0.09]}><sphereGeometry args={[0.025, 4, 4]} /><meshStandardMaterial color="#d50000" emissive="#f44336" emissiveIntensity={0.8} /></mesh>
      <mesh position={[0.04, 0.56, 0.09]}><sphereGeometry args={[0.025, 4, 4]} /><meshStandardMaterial color="#d50000" emissive="#f44336" emissiveIntensity={0.8} /></mesh>
      {/* 검 */}
      <mesh position={[0.2, 0.32, 0]}>
        <boxGeometry args={[0.03, 0.45, 0.015]} />
        <meshStandardMaterial color="#b0bec5" metalness={0.7} roughness={0.3} />
      </mesh>
      <mesh position={[0.2, 0.1, 0]}>
        <boxGeometry args={[0.1, 0.03, 0.03]} />
        <meshStandardMaterial color="#5d4037" />
      </mesh>
      {/* 방패 */}
      <mesh position={[-0.18, 0.32, 0.06]}>
        <cylinderGeometry args={[0.1, 0.1, 0.02, 8]} />
        <meshStandardMaterial color="#37474f" metalness={0.6} roughness={0.4} />
      </mesh>
    </group>
  );
}

// 리치 소환수 - 어둠 마법사 해골, 보라 로브
export function LichSummonModel() {
  return (
    <group>
      {/* 로브 */}
      <mesh position={[0, 0.2, 0]}>
        <coneGeometry args={[0.3, 0.55, 8]} />
        <meshStandardMaterial color="#311b92" />
      </mesh>
      {/* 상체 */}
      <mesh position={[0, 0.5, 0]}>
        <cylinderGeometry args={[0.13, 0.2, 0.2, 8]} />
        <meshStandardMaterial color="#4527a0" />
      </mesh>
      {/* 해골 머리 */}
      <mesh position={[0, 0.66, 0]}>
        <sphereGeometry args={[0.13, 8, 8]} />
        <meshStandardMaterial color="#d7ccc8" />
      </mesh>
      {/* 왕관 */}
      {[0, 1, 2, 3, 4].map(i => {
        const a = (i / 5) * Math.PI * 2;
        return (
          <mesh key={i} position={[Math.sin(a)*0.09, 0.76, Math.cos(a)*0.09]}>
            <coneGeometry args={[0.02, 0.06, 3]} />
            <meshStandardMaterial color="#ffd54f" metalness={0.7} />
          </mesh>
        );
      })}
      {/* 눈 (보라 불꽃) */}
      <mesh position={[-0.05, 0.68, 0.11]}><sphereGeometry args={[0.025, 6, 6]} /><meshStandardMaterial color="#e040fb" emissive="#aa00ff" emissiveIntensity={1.0} /></mesh>
      <mesh position={[0.05, 0.68, 0.11]}><sphereGeometry args={[0.025, 6, 6]} /><meshStandardMaterial color="#e040fb" emissive="#aa00ff" emissiveIntensity={1.0} /></mesh>
      {/* 마법 지팡이 */}
      <mesh position={[0.24, 0.4, 0]}>
        <cylinderGeometry args={[0.018, 0.018, 0.7, 4]} />
        <meshStandardMaterial color="#4a148c" />
      </mesh>
      <mesh position={[0.24, 0.76, 0]}>
        <octahedronGeometry args={[0.05, 0]} />
        <meshStandardMaterial color="#aa00ff" emissive="#7c4dff" emissiveIntensity={0.8} />
      </mesh>
      {/* 어둠 오라 */}
      <mesh position={[0, 0.4, 0]}><sphereGeometry args={[0.4, 10, 10]} /><meshStandardMaterial color="#7c4dff" transparent opacity={0.07} /></mesh>
    </group>
  );
}

// ============================================================
// ===== 몬스터 모델 (126종) - 기존 =====

// ==================== 1. 야수 (Beasts) ====================

// 산토끼 (Mountain Rabbit)
export function RabbitModel() {
  return (
    <group>
      <mesh position={[0, 0.14, 0]} scale={[0.9, 0.8, 1.1]}>
        <sphereGeometry args={[0.14, 8, 8]} />
        <meshStandardMaterial color="#bcaaa4" />
      </mesh>
      <mesh position={[0, 0.24, 0.1]}>
        <sphereGeometry args={[0.1, 8, 8]} />
        <meshStandardMaterial color="#d7ccc8" />
      </mesh>
      {/* 긴 귀 */}
      <mesh position={[-0.04, 0.4, 0.08]} rotation={[0.2, 0, -0.1]}>
        <capsuleGeometry args={[0.02, 0.14, 4, 6]} />
        <meshStandardMaterial color="#ef9a9a" />
      </mesh>
      <mesh position={[0.04, 0.4, 0.08]} rotation={[0.2, 0, 0.1]}>
        <capsuleGeometry args={[0.02, 0.14, 4, 6]} />
        <meshStandardMaterial color="#ef9a9a" />
      </mesh>
      {/* 눈 */}
      <mesh position={[-0.04, 0.27, 0.18]}>
        <sphereGeometry args={[0.02, 4, 4]} />
        <meshStandardMaterial color="#d32f2f" />
      </mesh>
      <mesh position={[0.04, 0.27, 0.18]}>
        <sphereGeometry args={[0.02, 4, 4]} />
        <meshStandardMaterial color="#d32f2f" />
      </mesh>
      {/* 솜 꼬리 */}
      <mesh position={[0, 0.14, -0.16]}>
        <sphereGeometry args={[0.05, 6, 6]} />
        <meshStandardMaterial color="#fafafa" />
      </mesh>
      {/* 다리 */}
      {[[-0.06, 0, 0.04], [0.06, 0, 0.04], [-0.05, 0.02, -0.08], [0.05, 0.02, -0.08]].map((p, i) => (
        <mesh key={i} position={p}>
          <cylinderGeometry args={[0.02, 0.025, i < 2 ? 0.08 : 0.12, 4]} />
          <meshStandardMaterial color="#a1887f" />
        </mesh>
      ))}
    </group>
  );
}

// 멧돼지 (Wild Boar)
export function BoarModel() {
  return (
    <group>
      <mesh position={[0, 0.18, 0]} scale={[1, 0.85, 1.3]}>
        <sphereGeometry args={[0.2, 8, 8]} />
        <meshStandardMaterial color="#5d4037" />
      </mesh>
      <mesh position={[0, 0.24, 0.22]}>
        <sphereGeometry args={[0.13, 8, 8]} />
        <meshStandardMaterial color="#6d4c41" />
      </mesh>
      {/* 엄니 */}
      <mesh position={[-0.06, 0.2, 0.34]} rotation={[-0.3, 0, -0.2]}>
        <coneGeometry args={[0.015, 0.1, 4]} />
        <meshStandardMaterial color="#fff8e1" />
      </mesh>
      <mesh position={[0.06, 0.2, 0.34]} rotation={[-0.3, 0, 0.2]}>
        <coneGeometry args={[0.015, 0.1, 4]} />
        <meshStandardMaterial color="#fff8e1" />
      </mesh>
      {/* 콧구멍 */}
      <mesh position={[0, 0.22, 0.34]}>
        <cylinderGeometry args={[0.05, 0.05, 0.03, 6]} />
        <meshStandardMaterial color="#ff8a80" />
      </mesh>
      {/* 눈 */}
      <mesh position={[-0.06, 0.28, 0.28]}>
        <sphereGeometry args={[0.02, 4, 4]} />
        <meshStandardMaterial color="#f44336" emissive="#d32f2f" emissiveIntensity={0.3} />
      </mesh>
      <mesh position={[0.06, 0.28, 0.28]}>
        <sphereGeometry args={[0.02, 4, 4]} />
        <meshStandardMaterial color="#f44336" emissive="#d32f2f" emissiveIntensity={0.3} />
      </mesh>
      {/* 갈기 */}
      <mesh position={[0, 0.3, 0.05]}>
        <boxGeometry args={[0.06, 0.08, 0.2]} />
        <meshStandardMaterial color="#3e2723" />
      </mesh>
      {/* 다리 */}
      {[[-0.1, 0, 0.1], [0.1, 0, 0.1], [-0.1, 0, -0.1], [0.1, 0, -0.1]].map((p, i) => (
        <mesh key={i} position={p}>
          <cylinderGeometry args={[0.03, 0.04, 0.16, 4]} />
          <meshStandardMaterial color="#3e2723" />
        </mesh>
      ))}
    </group>
  );
}

// 독사 (Viper)
export function ViperModel() {
  return (
    <group>
      {/* 또아리 몸통 */}
      <mesh position={[0, 0.06, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <torusGeometry args={[0.12, 0.04, 6, 12]} />
        <meshStandardMaterial color="#2e7d32" />
      </mesh>
      <mesh position={[0, 0.12, 0]} rotation={[-Math.PI / 2, 0, 0.5]}>
        <torusGeometry args={[0.09, 0.04, 6, 12]} />
        <meshStandardMaterial color="#388e3c" />
      </mesh>
      {/* 머리 (삼각형) */}
      <mesh position={[0.1, 0.18, 0.08]} rotation={[0, -0.3, 0.4]} scale={[1, 0.6, 1.2]}>
        <coneGeometry args={[0.06, 0.1, 4]} />
        <meshStandardMaterial color="#1b5e20" />
      </mesh>
      {/* 눈 */}
      <mesh position={[0.12, 0.22, 0.12]}>
        <sphereGeometry args={[0.015, 4, 4]} />
        <meshStandardMaterial color="#ffeb3b" emissive="#fdd835" emissiveIntensity={0.5} />
      </mesh>
      {/* 혀 */}
      <mesh position={[0.16, 0.17, 0.12]} rotation={[0, 0, 0.2]}>
        <boxGeometry args={[0.06, 0.005, 0.005]} />
        <meshStandardMaterial color="#f44336" />
      </mesh>
      {/* 독 무늬 */}
      {[0, 1.5, 3].map((r, i) => (
        <mesh key={i} position={[Math.cos(r) * 0.11, 0.06, Math.sin(r) * 0.11]}>
          <boxGeometry args={[0.02, 0.02, 0.02]} />
          <meshStandardMaterial color="#c6ff00" />
        </mesh>
      ))}
    </group>
  );
}

// 흑곰 (Black Bear)
export function BlackBearModel() {
  return (
    <group>
      <mesh position={[0, 0.22, 0]} scale={[1.1, 0.9, 1.3]}>
        <sphereGeometry args={[0.24, 8, 8]} />
        <meshStandardMaterial color="#212121" />
      </mesh>
      <mesh position={[0, 0.32, 0.24]}>
        <sphereGeometry args={[0.16, 8, 8]} />
        <meshStandardMaterial color="#333333" />
      </mesh>
      {/* 귀 */}
      <mesh position={[-0.1, 0.46, 0.2]}>
        <sphereGeometry args={[0.04, 6, 6]} />
        <meshStandardMaterial color="#212121" />
      </mesh>
      <mesh position={[0.1, 0.46, 0.2]}>
        <sphereGeometry args={[0.04, 6, 6]} />
        <meshStandardMaterial color="#212121" />
      </mesh>
      {/* 주둥이 */}
      <mesh position={[0, 0.28, 0.38]} scale={[0.8, 0.7, 1]}>
        <sphereGeometry args={[0.07, 6, 6]} />
        <meshStandardMaterial color="#4e342e" />
      </mesh>
      {/* 눈 */}
      <mesh position={[-0.06, 0.36, 0.36]}>
        <sphereGeometry args={[0.02, 4, 4]} />
        <meshStandardMaterial color="#111" />
      </mesh>
      <mesh position={[0.06, 0.36, 0.36]}>
        <sphereGeometry args={[0.02, 4, 4]} />
        <meshStandardMaterial color="#111" />
      </mesh>
      {/* 가슴 V 무늬 */}
      <mesh position={[0, 0.22, 0.22]}>
        <boxGeometry args={[0.1, 0.06, 0.01]} />
        <meshStandardMaterial color="#f5f5f5" />
      </mesh>
      {/* 다리 */}
      {[[-0.12, 0, 0.1], [0.12, 0, 0.1], [-0.12, 0, -0.12], [0.12, 0, -0.12]].map((p, i) => (
        <mesh key={i} position={p}>
          <cylinderGeometry args={[0.05, 0.06, 0.18, 5]} />
          <meshStandardMaterial color="#1a1a1a" />
        </mesh>
      ))}
      {/* 발톱 */}
      {[[-0.12, 0, 0.16], [0.12, 0, 0.16]].map((p, i) => (
        <mesh key={`c${i}`} position={p}>
          <coneGeometry args={[0.025, 0.04, 4]} />
          <meshStandardMaterial color="#e0e0e0" />
        </mesh>
      ))}
    </group>
  );
}

// 설표 (Snow Leopard)
export function SnowLeopardModel() {
  return (
    <group>
      <mesh position={[0, 0.18, 0]} scale={[0.7, 0.65, 1.4]}>
        <sphereGeometry args={[0.18, 8, 8]} />
        <meshStandardMaterial color="#cfd8dc" />
      </mesh>
      <mesh position={[0, 0.26, 0.22]}>
        <sphereGeometry args={[0.12, 8, 8]} />
        <meshStandardMaterial color="#eceff1" />
      </mesh>
      {/* 귀 */}
      <mesh position={[-0.07, 0.38, 0.18]}>
        <coneGeometry args={[0.03, 0.08, 4]} />
        <meshStandardMaterial color="#b0bec5" />
      </mesh>
      <mesh position={[0.07, 0.38, 0.18]}>
        <coneGeometry args={[0.03, 0.08, 4]} />
        <meshStandardMaterial color="#b0bec5" />
      </mesh>
      {/* 눈 */}
      <mesh position={[-0.04, 0.3, 0.32]}>
        <sphereGeometry args={[0.02, 4, 4]} />
        <meshStandardMaterial color="#42a5f5" emissive="#1e88e5" emissiveIntensity={0.3} />
      </mesh>
      <mesh position={[0.04, 0.3, 0.32]}>
        <sphereGeometry args={[0.02, 4, 4]} />
        <meshStandardMaterial color="#42a5f5" emissive="#1e88e5" emissiveIntensity={0.3} />
      </mesh>
      {/* 반점 */}
      {[[0.08, 0.2, 0.05], [-0.06, 0.22, -0.04], [0.04, 0.16, -0.1], [-0.1, 0.18, 0.08]].map((p, i) => (
        <mesh key={i} position={p}>
          <sphereGeometry args={[0.025, 4, 4]} />
          <meshStandardMaterial color="#78909c" />
        </mesh>
      ))}
      {/* 긴 꼬리 */}
      <mesh position={[0, 0.14, -0.3]} rotation={[0.6, 0, 0]}>
        <capsuleGeometry args={[0.025, 0.25, 4, 6]} />
        <meshStandardMaterial color="#b0bec5" />
      </mesh>
      {/* 다리 */}
      {[[-0.08, 0, 0.1], [0.08, 0, 0.1], [-0.08, 0, -0.08], [0.08, 0, -0.08]].map((p, i) => (
        <mesh key={i} position={p}>
          <cylinderGeometry args={[0.025, 0.03, 0.14, 4]} />
          <meshStandardMaterial color="#90a4ae" />
        </mesh>
      ))}
    </group>
  );
}

// 회색곰 (Gray Bear)
export function GrayBearModel() {
  return (
    <group>
      <mesh position={[0, 0.25, 0]} scale={[1.2, 1, 1.3]}>
        <sphereGeometry args={[0.26, 8, 8]} />
        <meshStandardMaterial color="#616161" />
      </mesh>
      <mesh position={[0, 0.38, 0.26]}>
        <sphereGeometry args={[0.17, 8, 8]} />
        <meshStandardMaterial color="#757575" />
      </mesh>
      {/* 귀 */}
      <mesh position={[-0.12, 0.52, 0.22]}>
        <sphereGeometry args={[0.045, 6, 6]} />
        <meshStandardMaterial color="#616161" />
      </mesh>
      <mesh position={[0.12, 0.52, 0.22]}>
        <sphereGeometry args={[0.045, 6, 6]} />
        <meshStandardMaterial color="#616161" />
      </mesh>
      <mesh position={[0, 0.34, 0.42]} scale={[0.8, 0.7, 1]}>
        <sphereGeometry args={[0.08, 6, 6]} />
        <meshStandardMaterial color="#9e9e9e" />
      </mesh>
      {/* 눈 (분노) */}
      <mesh position={[-0.07, 0.42, 0.38]}>
        <sphereGeometry args={[0.025, 4, 4]} />
        <meshStandardMaterial color="#ff5722" emissive="#e64a19" emissiveIntensity={0.4} />
      </mesh>
      <mesh position={[0.07, 0.42, 0.38]}>
        <sphereGeometry args={[0.025, 4, 4]} />
        <meshStandardMaterial color="#ff5722" emissive="#e64a19" emissiveIntensity={0.4} />
      </mesh>
      {/* 다리 */}
      {[[-0.14, 0, 0.12], [0.14, 0, 0.12], [-0.14, 0, -0.14], [0.14, 0, -0.14]].map((p, i) => (
        <mesh key={i} position={p}>
          <cylinderGeometry args={[0.06, 0.07, 0.22, 5]} />
          <meshStandardMaterial color="#424242" />
        </mesh>
      ))}
      {/* 상처 흉터 */}
      <mesh position={[0.12, 0.3, 0.2]} rotation={[0, 0, 0.5]}>
        <boxGeometry args={[0.12, 0.01, 0.01]} />
        <meshStandardMaterial color="#c62828" />
      </mesh>
    </group>
  );
}

// 구렁이 (Python - large snake)
export function PythonModel() {
  return (
    <group>
      {/* 두꺼운 또아리 */}
      <mesh position={[0, 0.07, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <torusGeometry args={[0.16, 0.06, 6, 12]} />
        <meshStandardMaterial color="#4e342e" />
      </mesh>
      <mesh position={[0, 0.16, 0]} rotation={[-Math.PI / 2, 0, 0.8]}>
        <torusGeometry args={[0.12, 0.06, 6, 12]} />
        <meshStandardMaterial color="#5d4037" />
      </mesh>
      <mesh position={[0, 0.24, 0]} rotation={[-Math.PI / 2, 0, 1.6]}>
        <torusGeometry args={[0.08, 0.055, 6, 12]} />
        <meshStandardMaterial color="#6d4c41" />
      </mesh>
      {/* 머리 */}
      <mesh position={[0.08, 0.32, 0.06]} scale={[1, 0.6, 1.3]}>
        <sphereGeometry args={[0.08, 8, 8]} />
        <meshStandardMaterial color="#3e2723" />
      </mesh>
      {/* 눈 */}
      <mesh position={[0.06, 0.36, 0.12]}>
        <sphereGeometry args={[0.02, 4, 4]} />
        <meshStandardMaterial color="#fdd835" />
      </mesh>
      <mesh position={[0.12, 0.36, 0.1]}>
        <sphereGeometry args={[0.02, 4, 4]} />
        <meshStandardMaterial color="#fdd835" />
      </mesh>
      {/* 무늬 */}
      {[0.5, 1.5, 2.5, 3.5].map((r, i) => (
        <mesh key={i} position={[Math.cos(r) * 0.15, 0.07, Math.sin(r) * 0.15]}>
          <boxGeometry args={[0.03, 0.025, 0.03]} />
          <meshStandardMaterial color="#8d6e63" />
        </mesh>
      ))}
    </group>
  );
}

// 백호 (White Tiger)
export function WhiteTigerModel() {
  return (
    <group>
      <mesh position={[0, 0.22, 0]} scale={[0.9, 0.8, 1.5]}>
        <sphereGeometry args={[0.22, 8, 8]} />
        <meshStandardMaterial color="#f5f5f5" />
      </mesh>
      <mesh position={[0, 0.32, 0.28]}>
        <sphereGeometry args={[0.16, 8, 8]} />
        <meshStandardMaterial color="#fafafa" />
      </mesh>
      {/* 귀 */}
      <mesh position={[-0.1, 0.48, 0.24]}>
        <coneGeometry args={[0.04, 0.1, 4]} />
        <meshStandardMaterial color="#e0e0e0" />
      </mesh>
      <mesh position={[0.1, 0.48, 0.24]}>
        <coneGeometry args={[0.04, 0.1, 4]} />
        <meshStandardMaterial color="#e0e0e0" />
      </mesh>
      {/* 줄무늬 */}
      {[[-0.08, 0.28, 0.1], [0.08, 0.24, 0.05], [-0.06, 0.2, -0.05], [0.1, 0.22, -0.08], [0, 0.18, 0.02]].map((p, i) => (
        <mesh key={i} position={p} rotation={[0, 0, 0.3 * (i % 2 ? 1 : -1)]}>
          <boxGeometry args={[0.08, 0.015, 0.02]} />
          <meshStandardMaterial color="#1a237e" />
        </mesh>
      ))}
      {/* 눈 (신성한 금색) */}
      <mesh position={[-0.06, 0.36, 0.4]}>
        <sphereGeometry args={[0.025, 4, 4]} />
        <meshStandardMaterial color="#ffd54f" emissive="#ffab00" emissiveIntensity={0.8} />
      </mesh>
      <mesh position={[0.06, 0.36, 0.4]}>
        <sphereGeometry args={[0.025, 4, 4]} />
        <meshStandardMaterial color="#ffd54f" emissive="#ffab00" emissiveIntensity={0.8} />
      </mesh>
      {/* 신성 오라 */}
      <mesh position={[0, 0.25, 0]}>
        <sphereGeometry args={[0.38, 8, 8]} />
        <meshStandardMaterial color="#ffd54f" transparent opacity={0.06} />
      </mesh>
      {/* 다리 */}
      {[[-0.1, 0, 0.12], [0.1, 0, 0.12], [-0.1, 0, -0.12], [0.1, 0, -0.12]].map((p, i) => (
        <mesh key={i} position={p}>
          <cylinderGeometry args={[0.04, 0.045, 0.2, 4]} />
          <meshStandardMaterial color="#e0e0e0" />
        </mesh>
      ))}
      {/* 꼬리 */}
      <mesh position={[0, 0.2, -0.32]} rotation={[0.8, 0, 0]}>
        <capsuleGeometry args={[0.025, 0.22, 4, 6]} />
        <meshStandardMaterial color="#e0e0e0" />
      </mesh>
    </group>
  );
}

// 삼두견 (Three-Headed Hound)
export function ThreeHeadedHoundModel() {
  return (
    <group>
      {/* 몸통 */}
      <mesh position={[0, 0.22, 0]} scale={[1, 0.85, 1.3]}>
        <sphereGeometry args={[0.24, 8, 8]} />
        <meshStandardMaterial color="#1a1a1a" />
      </mesh>
      {/* 머리 3개 */}
      {[[-0.14, 0.36, 0.22], [0, 0.4, 0.26], [0.14, 0.36, 0.22]].map((p, i) => (
        <group key={i}>
          <mesh position={p}>
            <sphereGeometry args={[0.1, 8, 8]} />
            <meshStandardMaterial color="#212121" />
          </mesh>
          {/* 주둥이 */}
          <mesh position={[p[0], p[1] - 0.02, p[2] + 0.1]} scale={[0.7, 0.5, 1]}>
            <sphereGeometry args={[0.05, 6, 6]} />
            <meshStandardMaterial color="#333" />
          </mesh>
          {/* 눈 */}
          <mesh position={[p[0] - 0.03, p[1] + 0.03, p[2] + 0.08]}>
            <sphereGeometry args={[0.018, 4, 4]} />
            <meshStandardMaterial color="#ff1744" emissive="#d50000" emissiveIntensity={1} />
          </mesh>
          <mesh position={[p[0] + 0.03, p[1] + 0.03, p[2] + 0.08]}>
            <sphereGeometry args={[0.018, 4, 4]} />
            <meshStandardMaterial color="#ff1744" emissive="#d50000" emissiveIntensity={1} />
          </mesh>
        </group>
      ))}
      {/* 다리 */}
      {[[-0.12, 0, 0.1], [0.12, 0, 0.1], [-0.12, 0, -0.12], [0.12, 0, -0.12]].map((p, i) => (
        <mesh key={i} position={p}>
          <cylinderGeometry args={[0.04, 0.05, 0.2, 4]} />
          <meshStandardMaterial color="#111" />
        </mesh>
      ))}
      {/* 어둠 오라 */}
      <mesh position={[0, 0.25, 0]}>
        <sphereGeometry args={[0.4, 8, 8]} />
        <meshStandardMaterial color="#b71c1c" transparent opacity={0.08} />
      </mesh>
    </group>
  );
}

// 천년여우 (Thousand-Year Fox)
export function AncientFoxModel() {
  return (
    <group>
      <mesh position={[0, 0.2, 0]} scale={[0.8, 0.75, 1.3]}>
        <sphereGeometry args={[0.2, 8, 8]} />
        <meshStandardMaterial color="#e1bee7" />
      </mesh>
      <mesh position={[0, 0.3, 0.2]}>
        <sphereGeometry args={[0.13, 8, 8]} />
        <meshStandardMaterial color="#f3e5f5" />
      </mesh>
      {/* 귀 */}
      <mesh position={[-0.08, 0.44, 0.16]}>
        <coneGeometry args={[0.035, 0.12, 4]} />
        <meshStandardMaterial color="#ce93d8" />
      </mesh>
      <mesh position={[0.08, 0.44, 0.16]}>
        <coneGeometry args={[0.035, 0.12, 4]} />
        <meshStandardMaterial color="#ce93d8" />
      </mesh>
      {/* 9개 꼬리 */}
      {[-0.12, -0.08, -0.04, 0, 0.04, 0.08, 0.12, -0.06, 0.06].map((x, i) => (
        <mesh key={i} position={[x, 0.18 + (i % 3) * 0.04, -0.25 - (i % 2) * 0.05]} rotation={[0.5 + i * 0.1, x * 1.5, 0]}>
          <coneGeometry args={[0.02, 0.2, 4]} />
          <meshStandardMaterial color="#ab47bc" emissive="#9c27b0" emissiveIntensity={0.3} transparent opacity={0.8} />
        </mesh>
      ))}
      {/* 눈 (영적) */}
      <mesh position={[-0.05, 0.34, 0.3]}>
        <sphereGeometry args={[0.025, 4, 4]} />
        <meshStandardMaterial color="#e040fb" emissive="#e040fb" emissiveIntensity={0.8} />
      </mesh>
      <mesh position={[0.05, 0.34, 0.3]}>
        <sphereGeometry args={[0.025, 4, 4]} />
        <meshStandardMaterial color="#e040fb" emissive="#e040fb" emissiveIntensity={0.8} />
      </mesh>
      {/* 영적 오라 */}
      <mesh position={[0, 0.25, 0]}>
        <sphereGeometry args={[0.36, 8, 8]} />
        <meshStandardMaterial color="#9c27b0" transparent opacity={0.1} />
      </mesh>
      {/* 다리 */}
      {[[-0.08, 0, 0.08], [0.08, 0, 0.08], [-0.08, 0, -0.08], [0.08, 0, -0.08]].map((p, i) => (
        <mesh key={i} position={p}>
          <cylinderGeometry args={[0.025, 0.03, 0.14, 4]} />
          <meshStandardMaterial color="#ba68c8" />
        </mesh>
      ))}
    </group>
  );
}

// ==================== 2. 곤충 (Insects) ====================

// 거대지네 (Giant Centipede)
export function CentipedeModel() {
  return (
    <group>
      {/* 긴 몸통 세그먼트 */}
      {[0.15, 0.08, 0, -0.08, -0.15].map((z, i) => (
        <group key={i}>
          <mesh position={[0, 0.08, z]}>
            <sphereGeometry args={[0.06, 6, 6]} />
            <meshStandardMaterial color={i === 0 ? '#d32f2f' : '#8d6e63'} />
          </mesh>
          {/* 다리 쌍 */}
          <mesh position={[-0.1, 0.04, z]} rotation={[0, 0, 0.6]}>
            <cylinderGeometry args={[0.008, 0.01, 0.08, 3]} />
            <meshStandardMaterial color="#5d4037" />
          </mesh>
          <mesh position={[0.1, 0.04, z]} rotation={[0, 0, -0.6]}>
            <cylinderGeometry args={[0.008, 0.01, 0.08, 3]} />
            <meshStandardMaterial color="#5d4037" />
          </mesh>
        </group>
      ))}
      {/* 독 턱 */}
      <mesh position={[-0.04, 0.08, 0.2]} rotation={[0.3, 0, -0.3]}>
        <coneGeometry args={[0.01, 0.06, 3]} />
        <meshStandardMaterial color="#76ff03" />
      </mesh>
      <mesh position={[0.04, 0.08, 0.2]} rotation={[0.3, 0, 0.3]}>
        <coneGeometry args={[0.01, 0.06, 3]} />
        <meshStandardMaterial color="#76ff03" />
      </mesh>
      {/* 촉각 */}
      <mesh position={[-0.03, 0.12, 0.2]} rotation={[0.5, 0, -0.3]}>
        <cylinderGeometry args={[0.004, 0.004, 0.1, 3]} />
        <meshStandardMaterial color="#d32f2f" />
      </mesh>
      <mesh position={[0.03, 0.12, 0.2]} rotation={[0.5, 0, 0.3]}>
        <cylinderGeometry args={[0.004, 0.004, 0.1, 3]} />
        <meshStandardMaterial color="#d32f2f" />
      </mesh>
    </group>
  );
}

// 독나방 (Poison Moth)
export function PoisonMothModel() {
  return (
    <group>
      {/* 몸통 */}
      <mesh position={[0, 0.22, 0]} scale={[0.5, 0.5, 1]}>
        <capsuleGeometry args={[0.04, 0.12, 4, 6]} />
        <meshStandardMaterial color="#7b1fa2" />
      </mesh>
      {/* 머리 */}
      <mesh position={[0, 0.24, 0.1]}>
        <sphereGeometry args={[0.05, 6, 6]} />
        <meshStandardMaterial color="#9c27b0" />
      </mesh>
      {/* 날개 좌 */}
      <mesh position={[-0.18, 0.25, 0]} rotation={[0.1, 0, 0.15]} scale={[1, 0.05, 0.8]}>
        <sphereGeometry args={[0.16, 8, 6]} />
        <meshStandardMaterial color="#ce93d8" transparent opacity={0.7} />
      </mesh>
      {/* 날개 우 */}
      <mesh position={[0.18, 0.25, 0]} rotation={[0.1, 0, -0.15]} scale={[1, 0.05, 0.8]}>
        <sphereGeometry args={[0.16, 8, 6]} />
        <meshStandardMaterial color="#ce93d8" transparent opacity={0.7} />
      </mesh>
      {/* 날개 무늬 (독) */}
      <mesh position={[-0.16, 0.26, 0.02]}>
        <sphereGeometry args={[0.04, 4, 4]} />
        <meshStandardMaterial color="#76ff03" emissive="#64dd17" emissiveIntensity={0.5} />
      </mesh>
      <mesh position={[0.16, 0.26, 0.02]}>
        <sphereGeometry args={[0.04, 4, 4]} />
        <meshStandardMaterial color="#76ff03" emissive="#64dd17" emissiveIntensity={0.5} />
      </mesh>
      {/* 촉각 */}
      <mesh position={[-0.03, 0.32, 0.12]} rotation={[0.5, 0, -0.5]}>
        <cylinderGeometry args={[0.004, 0.004, 0.1, 3]} />
        <meshStandardMaterial color="#ea80fc" />
      </mesh>
      <mesh position={[0.03, 0.32, 0.12]} rotation={[0.5, 0, 0.5]}>
        <cylinderGeometry args={[0.004, 0.004, 0.1, 3]} />
        <meshStandardMaterial color="#ea80fc" />
      </mesh>
      {/* 독 가루 오라 */}
      <mesh position={[0, 0.22, 0]}>
        <sphereGeometry args={[0.3, 8, 8]} />
        <meshStandardMaterial color="#76ff03" transparent opacity={0.06} />
      </mesh>
    </group>
  );
}

// 킬러비 (Killer Bee)
export function KillerBeeModel() {
  return (
    <group>
      {/* 복부 (줄무늬) */}
      <mesh position={[0, 0.18, -0.06]} scale={[0.8, 0.7, 1.2]}>
        <sphereGeometry args={[0.12, 8, 8]} />
        <meshStandardMaterial color="#fdd835" />
      </mesh>
      <mesh position={[0, 0.18, -0.08]} scale={[0.82, 0.72, 0.4]}>
        <sphereGeometry args={[0.12, 8, 8]} />
        <meshStandardMaterial color="#212121" />
      </mesh>
      {/* 흉부 */}
      <mesh position={[0, 0.2, 0.06]}>
        <sphereGeometry args={[0.07, 6, 6]} />
        <meshStandardMaterial color="#f9a825" />
      </mesh>
      {/* 머리 */}
      <mesh position={[0, 0.22, 0.14]}>
        <sphereGeometry args={[0.06, 6, 6]} />
        <meshStandardMaterial color="#212121" />
      </mesh>
      {/* 날개 */}
      <mesh position={[-0.12, 0.28, 0]} rotation={[0, 0, 0.3]} scale={[1, 0.03, 0.6]}>
        <sphereGeometry args={[0.1, 6, 4]} />
        <meshStandardMaterial color="#e3f2fd" transparent opacity={0.4} />
      </mesh>
      <mesh position={[0.12, 0.28, 0]} rotation={[0, 0, -0.3]} scale={[1, 0.03, 0.6]}>
        <sphereGeometry args={[0.1, 6, 4]} />
        <meshStandardMaterial color="#e3f2fd" transparent opacity={0.4} />
      </mesh>
      {/* 침 */}
      <mesh position={[0, 0.14, -0.2]} rotation={[0.5, 0, 0]}>
        <coneGeometry args={[0.015, 0.08, 4]} />
        <meshStandardMaterial color="#111" />
      </mesh>
      {/* 눈 */}
      <mesh position={[-0.03, 0.24, 0.18]}>
        <sphereGeometry args={[0.02, 4, 4]} />
        <meshStandardMaterial color="#f44336" />
      </mesh>
      <mesh position={[0.03, 0.24, 0.18]}>
        <sphereGeometry args={[0.02, 4, 4]} />
        <meshStandardMaterial color="#f44336" />
      </mesh>
    </group>
  );
}

// 전갈 (Scorpion)
export function ScorpionModel() {
  return (
    <group>
      {/* 몸통 */}
      <mesh position={[0, 0.08, 0]} scale={[1, 0.5, 1.3]}>
        <sphereGeometry args={[0.14, 8, 8]} />
        <meshStandardMaterial color="#4e342e" />
      </mesh>
      {/* 꼬리 (위로 구부러진) */}
      <mesh position={[0, 0.14, -0.14]} rotation={[-0.4, 0, 0]}>
        <capsuleGeometry args={[0.03, 0.1, 4, 6]} />
        <meshStandardMaterial color="#5d4037" />
      </mesh>
      <mesh position={[0, 0.24, -0.18]} rotation={[-0.8, 0, 0]}>
        <capsuleGeometry args={[0.025, 0.08, 4, 6]} />
        <meshStandardMaterial color="#6d4c41" />
      </mesh>
      {/* 독침 */}
      <mesh position={[0, 0.34, -0.16]}>
        <coneGeometry args={[0.02, 0.06, 4]} />
        <meshStandardMaterial color="#76ff03" emissive="#64dd17" emissiveIntensity={0.5} />
      </mesh>
      {/* 집게 */}
      <mesh position={[-0.16, 0.08, 0.12]} rotation={[0, 0.3, 0]}>
        <boxGeometry args={[0.08, 0.04, 0.04]} />
        <meshStandardMaterial color="#3e2723" />
      </mesh>
      <mesh position={[0.16, 0.08, 0.12]} rotation={[0, -0.3, 0]}>
        <boxGeometry args={[0.08, 0.04, 0.04]} />
        <meshStandardMaterial color="#3e2723" />
      </mesh>
      {/* 다리 */}
      {[[-0.12, 0.04, 0.06], [0.12, 0.04, 0.06], [-0.14, 0.04, 0], [0.14, 0.04, 0],
        [-0.12, 0.04, -0.06], [0.12, 0.04, -0.06], [-0.1, 0.04, -0.1], [0.1, 0.04, -0.1]].map((p, i) => (
        <mesh key={i} position={p} rotation={[0, 0, i % 2 ? -0.5 : 0.5]}>
          <cylinderGeometry args={[0.008, 0.012, 0.08, 3]} />
          <meshStandardMaterial color="#4e342e" />
        </mesh>
      ))}
      {/* 눈 */}
      <mesh position={[-0.03, 0.12, 0.12]}>
        <sphereGeometry args={[0.015, 4, 4]} />
        <meshStandardMaterial color="#111" />
      </mesh>
      <mesh position={[0.03, 0.12, 0.12]}>
        <sphereGeometry args={[0.015, 4, 4]} />
        <meshStandardMaterial color="#111" />
      </mesh>
    </group>
  );
}

// 여왕개미 (Queen Ant)
export function QueenAntModel() {
  return (
    <group>
      {/* 큰 복부 */}
      <mesh position={[0, 0.14, -0.1]} scale={[0.9, 0.7, 1.3]}>
        <sphereGeometry args={[0.16, 8, 8]} />
        <meshStandardMaterial color="#4a148c" />
      </mesh>
      {/* 흉부 */}
      <mesh position={[0, 0.16, 0.06]}>
        <sphereGeometry args={[0.08, 6, 6]} />
        <meshStandardMaterial color="#6a1b9a" />
      </mesh>
      {/* 머리 */}
      <mesh position={[0, 0.2, 0.16]}>
        <sphereGeometry args={[0.07, 6, 6]} />
        <meshStandardMaterial color="#7b1fa2" />
      </mesh>
      {/* 왕관 */}
      <mesh position={[0, 0.3, 0.16]}>
        <cylinderGeometry args={[0.03, 0.06, 0.04, 6]} />
        <meshStandardMaterial color="#ffd54f" metalness={0.6} />
      </mesh>
      {/* 더듬이 */}
      <mesh position={[-0.03, 0.26, 0.2]} rotation={[0.6, 0, -0.3]}>
        <cylinderGeometry args={[0.004, 0.004, 0.12, 3]} />
        <meshStandardMaterial color="#4a148c" />
      </mesh>
      <mesh position={[0.03, 0.26, 0.2]} rotation={[0.6, 0, 0.3]}>
        <cylinderGeometry args={[0.004, 0.004, 0.12, 3]} />
        <meshStandardMaterial color="#4a148c" />
      </mesh>
      {/* 다리 6개 */}
      {[[-0.1, 0.1, 0.08], [0.1, 0.1, 0.08], [-0.12, 0.08, 0], [0.12, 0.08, 0],
        [-0.1, 0.08, -0.08], [0.1, 0.08, -0.08]].map((p, i) => (
        <mesh key={i} position={p} rotation={[0, 0, i % 2 ? -0.5 : 0.5]}>
          <cylinderGeometry args={[0.01, 0.012, 0.1, 3]} />
          <meshStandardMaterial color="#311b92" />
        </mesh>
      ))}
      {/* 턱 */}
      <mesh position={[-0.04, 0.16, 0.22]}>
        <coneGeometry args={[0.012, 0.04, 3]} />
        <meshStandardMaterial color="#3e2723" />
      </mesh>
      <mesh position={[0.04, 0.16, 0.22]}>
        <coneGeometry args={[0.012, 0.04, 3]} />
        <meshStandardMaterial color="#3e2723" />
      </mesh>
    </group>
  );
}

// 장수풍뎅이 (Stag Beetle)
export function StagBeetleModel() {
  return (
    <group>
      {/* 몸통 (단단한 갑각) */}
      <mesh position={[0, 0.1, 0]} scale={[1, 0.5, 1.2]}>
        <sphereGeometry args={[0.14, 8, 8]} />
        <meshStandardMaterial color="#1b5e20" metalness={0.3} roughness={0.4} />
      </mesh>
      {/* 머리 */}
      <mesh position={[0, 0.12, 0.14]}>
        <sphereGeometry args={[0.08, 6, 6]} />
        <meshStandardMaterial color="#2e7d32" metalness={0.3} />
      </mesh>
      {/* 큰 뿔 (갈라진) */}
      <mesh position={[-0.03, 0.2, 0.2]} rotation={[0.5, 0, -0.2]}>
        <coneGeometry args={[0.015, 0.14, 4]} />
        <meshStandardMaterial color="#33691e" />
      </mesh>
      <mesh position={[0.03, 0.2, 0.2]} rotation={[0.5, 0, 0.2]}>
        <coneGeometry args={[0.015, 0.14, 4]} />
        <meshStandardMaterial color="#33691e" />
      </mesh>
      {/* 날개 덮개 */}
      <mesh position={[0, 0.14, -0.02]} scale={[1.1, 0.15, 1]}>
        <sphereGeometry args={[0.13, 8, 6]} />
        <meshStandardMaterial color="#2e7d32" metalness={0.4} roughness={0.3} />
      </mesh>
      {/* 다리 */}
      {[[-0.12, 0.04, 0.06], [0.12, 0.04, 0.06], [-0.14, 0.04, -0.02], [0.14, 0.04, -0.02],
        [-0.12, 0.04, -0.08], [0.12, 0.04, -0.08]].map((p, i) => (
        <mesh key={i} position={p} rotation={[0, 0, i % 2 ? -0.5 : 0.5]}>
          <cylinderGeometry args={[0.012, 0.015, 0.1, 3]} />
          <meshStandardMaterial color="#1b5e20" />
        </mesh>
      ))}
    </group>
  );
}

// 독거미 여왕 (Poison Spider Queen)
export function SpiderQueenModel() {
  return (
    <group>
      {/* 큰 복부 */}
      <mesh position={[0, 0.18, -0.1]} scale={[1.2, 0.8, 1.4]}>
        <sphereGeometry args={[0.18, 8, 8]} />
        <meshStandardMaterial color="#311b92" />
      </mesh>
      {/* 두흉부 */}
      <mesh position={[0, 0.2, 0.1]}>
        <sphereGeometry args={[0.12, 8, 8]} />
        <meshStandardMaterial color="#4a148c" />
      </mesh>
      {/* 왕관 */}
      <mesh position={[0, 0.34, 0.1]}>
        <cylinderGeometry args={[0.04, 0.07, 0.04, 6]} />
        <meshStandardMaterial color="#ffd54f" metalness={0.7} />
      </mesh>
      {/* 다리 8개 */}
      {[
        [-0.22, 0.12, 0.1, 0.4], [0.22, 0.12, 0.1, -0.4],
        [-0.24, 0.12, 0.02, 0.2], [0.24, 0.12, 0.02, -0.2],
        [-0.24, 0.12, -0.06, -0.2], [0.24, 0.12, -0.06, 0.2],
        [-0.22, 0.12, -0.14, -0.4], [0.22, 0.12, -0.14, 0.4],
      ].map(([x, y, z, r], i) => (
        <mesh key={i} position={[x, y, z]} rotation={[0, 0, r]}>
          <cylinderGeometry args={[0.012, 0.018, 0.22, 4]} />
          <meshStandardMaterial color="#1a237e" />
        </mesh>
      ))}
      {/* 여러 눈 */}
      {[[-0.05, 0.26, 0.18], [0.05, 0.26, 0.18], [-0.03, 0.28, 0.17], [0.03, 0.28, 0.17],
        [-0.02, 0.24, 0.19], [0.02, 0.24, 0.19]].map((p, i) => (
        <mesh key={i} position={p}>
          <sphereGeometry args={[0.015, 4, 4]} />
          <meshStandardMaterial color="#e040fb" emissive="#e040fb" emissiveIntensity={0.8} />
        </mesh>
      ))}
      {/* 독 오라 */}
      <mesh position={[0, 0.15, -0.25]}>
        <sphereGeometry args={[0.05, 4, 4]} />
        <meshStandardMaterial color="#76ff03" emissive="#76ff03" emissiveIntensity={0.6} />
      </mesh>
      <mesh position={[0, 0.18, 0]}>
        <sphereGeometry args={[0.35, 8, 8]} />
        <meshStandardMaterial color="#7c4dff" transparent opacity={0.08} />
      </mesh>
    </group>
  );
}

// 사마귀 전사 (Mantis Warrior)
export function MantisWarriorModel() {
  return (
    <group>
      {/* 복부 */}
      <mesh position={[0, 0.12, -0.06]} scale={[0.6, 0.5, 1.2]}>
        <capsuleGeometry args={[0.06, 0.1, 4, 6]} />
        <meshStandardMaterial color="#2e7d32" />
      </mesh>
      {/* 흉부 (직립) */}
      <mesh position={[0, 0.28, 0.04]}>
        <capsuleGeometry args={[0.05, 0.12, 4, 6]} />
        <meshStandardMaterial color="#388e3c" />
      </mesh>
      {/* 머리 (삼각형) */}
      <mesh position={[0, 0.42, 0.06]} rotation={[0.3, 0, 0]}>
        <coneGeometry args={[0.06, 0.08, 4]} />
        <meshStandardMaterial color="#4caf50" />
      </mesh>
      {/* 큰 복안 */}
      <mesh position={[-0.05, 0.44, 0.1]}>
        <sphereGeometry args={[0.03, 6, 6]} />
        <meshStandardMaterial color="#ffeb3b" emissive="#fbc02d" emissiveIntensity={0.4} />
      </mesh>
      <mesh position={[0.05, 0.44, 0.1]}>
        <sphereGeometry args={[0.03, 6, 6]} />
        <meshStandardMaterial color="#ffeb3b" emissive="#fbc02d" emissiveIntensity={0.4} />
      </mesh>
      {/* 낫 팔 (좌) */}
      <mesh position={[-0.14, 0.34, 0.08]} rotation={[0.3, 0, 0.8]}>
        <boxGeometry args={[0.16, 0.02, 0.03]} />
        <meshStandardMaterial color="#1b5e20" />
      </mesh>
      <mesh position={[-0.24, 0.3, 0.12]} rotation={[-0.2, 0, 0.3]}>
        <boxGeometry args={[0.1, 0.015, 0.02]} />
        <meshStandardMaterial color="#c6ff00" metalness={0.3} />
      </mesh>
      {/* 낫 팔 (우) */}
      <mesh position={[0.14, 0.34, 0.08]} rotation={[0.3, 0, -0.8]}>
        <boxGeometry args={[0.16, 0.02, 0.03]} />
        <meshStandardMaterial color="#1b5e20" />
      </mesh>
      <mesh position={[0.24, 0.3, 0.12]} rotation={[-0.2, 0, -0.3]}>
        <boxGeometry args={[0.1, 0.015, 0.02]} />
        <meshStandardMaterial color="#c6ff00" metalness={0.3} />
      </mesh>
      {/* 다리 */}
      {[[-0.06, 0, 0], [0.06, 0, 0], [-0.06, 0, -0.08], [0.06, 0, -0.08]].map((p, i) => (
        <mesh key={i} position={p}>
          <cylinderGeometry args={[0.012, 0.015, 0.14, 3]} />
          <meshStandardMaterial color="#2e7d32" />
        </mesh>
      ))}
    </group>
  );
}

// ==================== 3. 언데드 (Undead) ====================

// 좀비 (Zombie)
export function ZombieModel() {
  return (
    <group>
      {/* 다리 */}
      <mesh position={[-0.06, 0.12, 0]}>
        <cylinderGeometry args={[0.04, 0.05, 0.24, 4]} />
        <meshStandardMaterial color="#4e342e" />
      </mesh>
      <mesh position={[0.06, 0.12, 0]} rotation={[0, 0, 0.05]}>
        <cylinderGeometry args={[0.04, 0.05, 0.24, 4]} />
        <meshStandardMaterial color="#3e2723" />
      </mesh>
      {/* 몸통 (찢어진 옷) */}
      <mesh position={[0, 0.36, 0]}>
        <boxGeometry args={[0.22, 0.24, 0.14]} />
        <meshStandardMaterial color="#556b2f" />
      </mesh>
      {/* 머리 */}
      <mesh position={[0, 0.56, 0.02]} rotation={[0, 0, 0.15]}>
        <sphereGeometry args={[0.12, 8, 8]} />
        <meshStandardMaterial color="#8fbc8f" />
      </mesh>
      {/* 눈 (빈 눈구멍 + 노란빛) */}
      <mesh position={[-0.04, 0.58, 0.1]}>
        <sphereGeometry args={[0.025, 4, 4]} />
        <meshStandardMaterial color="#cddc39" emissive="#9e9d24" emissiveIntensity={0.5} />
      </mesh>
      <mesh position={[0.04, 0.58, 0.1]}>
        <sphereGeometry args={[0.025, 4, 4]} />
        <meshStandardMaterial color="#cddc39" emissive="#9e9d24" emissiveIntensity={0.5} />
      </mesh>
      {/* 팔 (한쪽 쭉 뻗은) */}
      <mesh position={[-0.18, 0.4, 0.08]} rotation={[0.5, 0, 0.4]}>
        <cylinderGeometry args={[0.03, 0.035, 0.22, 4]} />
        <meshStandardMaterial color="#6d8f6d" />
      </mesh>
      <mesh position={[0.18, 0.34, 0.04]} rotation={[0.3, 0, -0.6]}>
        <cylinderGeometry args={[0.03, 0.035, 0.2, 4]} />
        <meshStandardMaterial color="#6d8f6d" />
      </mesh>
      {/* 피 흔적 */}
      <mesh position={[0.08, 0.32, 0.08]}>
        <boxGeometry args={[0.04, 0.06, 0.01]} />
        <meshStandardMaterial color="#b71c1c" />
      </mesh>
    </group>
  );
}

// 구울 (Ghoul)
export function GhoulModel() {
  return (
    <group>
      {/* 웅크린 몸 */}
      <mesh position={[0, 0.18, 0]}>
        <cylinderGeometry args={[0.12, 0.18, 0.3, 6]} />
        <meshStandardMaterial color="#37474f" />
      </mesh>
      {/* 머리 */}
      <mesh position={[0, 0.4, 0.06]}>
        <sphereGeometry args={[0.13, 8, 8]} />
        <meshStandardMaterial color="#546e7a" />
      </mesh>
      {/* 큰 입 */}
      <mesh position={[0, 0.35, 0.16]} scale={[1.2, 0.6, 0.8]}>
        <sphereGeometry args={[0.06, 6, 6]} />
        <meshStandardMaterial color="#1a1a1a" />
      </mesh>
      {/* 이빨 */}
      {[-0.03, -0.01, 0.01, 0.03].map((x, i) => (
        <mesh key={i} position={[x, 0.32, 0.2]}>
          <coneGeometry args={[0.008, 0.03, 3]} />
          <meshStandardMaterial color="#fff8e1" />
        </mesh>
      ))}
      {/* 눈 (탐욕) */}
      <mesh position={[-0.05, 0.43, 0.14]}>
        <sphereGeometry args={[0.025, 4, 4]} />
        <meshStandardMaterial color="#ff6f00" emissive="#e65100" emissiveIntensity={0.8} />
      </mesh>
      <mesh position={[0.05, 0.43, 0.14]}>
        <sphereGeometry args={[0.025, 4, 4]} />
        <meshStandardMaterial color="#ff6f00" emissive="#e65100" emissiveIntensity={0.8} />
      </mesh>
      {/* 날카로운 손톱 */}
      <mesh position={[-0.2, 0.2, 0.1]} rotation={[0.3, 0, 0.6]}>
        <coneGeometry args={[0.02, 0.12, 4]} />
        <meshStandardMaterial color="#455a64" />
      </mesh>
      <mesh position={[0.2, 0.2, 0.1]} rotation={[0.3, 0, -0.6]}>
        <coneGeometry args={[0.02, 0.12, 4]} />
        <meshStandardMaterial color="#455a64" />
      </mesh>
    </group>
  );
}

// 레이스 (Wraith)
export function WraithModel() {
  return (
    <group>
      {/* 하체 (사라지는 형태) */}
      <mesh position={[0, 0.15, 0]}>
        <coneGeometry args={[0.26, 0.4, 8]} />
        <meshStandardMaterial color="#263238" transparent opacity={0.4} />
      </mesh>
      {/* 상체 */}
      <mesh position={[0, 0.38, 0]}>
        <cylinderGeometry args={[0.12, 0.2, 0.16, 8]} />
        <meshStandardMaterial color="#37474f" transparent opacity={0.5} />
      </mesh>
      {/* 후드 */}
      <mesh position={[0, 0.54, -0.02]}>
        <sphereGeometry args={[0.15, 8, 8]} />
        <meshStandardMaterial color="#1a1a1a" transparent opacity={0.6} />
      </mesh>
      {/* 눈 (흰 발광) */}
      <mesh position={[-0.05, 0.55, 0.12]}>
        <sphereGeometry args={[0.03, 4, 4]} />
        <meshStandardMaterial color="#e0f7fa" emissive="#e0f7fa" emissiveIntensity={1.5} />
      </mesh>
      <mesh position={[0.05, 0.55, 0.12]}>
        <sphereGeometry args={[0.03, 4, 4]} />
        <meshStandardMaterial color="#e0f7fa" emissive="#e0f7fa" emissiveIntensity={1.5} />
      </mesh>
      {/* 떠도는 손 */}
      <mesh position={[-0.22, 0.38, 0.06]}>
        <sphereGeometry args={[0.04, 4, 4]} />
        <meshStandardMaterial color="#455a64" transparent opacity={0.4} />
      </mesh>
      <mesh position={[0.22, 0.38, 0.06]}>
        <sphereGeometry args={[0.04, 4, 4]} />
        <meshStandardMaterial color="#455a64" transparent opacity={0.4} />
      </mesh>
      {/* 어둠 오라 */}
      <mesh position={[0, 0.35, 0]}>
        <sphereGeometry args={[0.35, 8, 8]} />
        <meshStandardMaterial color="#000" transparent opacity={0.12} />
      </mesh>
    </group>
  );
}

// 뱀파이어 (Vampire)
export function VampireModel() {
  return (
    <group>
      {/* 다리 */}
      <mesh position={[-0.06, 0.14, 0]}>
        <cylinderGeometry args={[0.04, 0.045, 0.28, 4]} />
        <meshStandardMaterial color="#1a1a1a" />
      </mesh>
      <mesh position={[0.06, 0.14, 0]}>
        <cylinderGeometry args={[0.04, 0.045, 0.28, 4]} />
        <meshStandardMaterial color="#1a1a1a" />
      </mesh>
      {/* 몸통 */}
      <mesh position={[0, 0.42, 0]}>
        <boxGeometry args={[0.22, 0.28, 0.14]} />
        <meshStandardMaterial color="#b71c1c" />
      </mesh>
      {/* 머리 */}
      <mesh position={[0, 0.64, 0]}>
        <sphereGeometry args={[0.12, 8, 8]} />
        <meshStandardMaterial color="#e8eaf6" />
      </mesh>
      {/* 눈 (빨간) */}
      <mesh position={[-0.04, 0.66, 0.1]}>
        <sphereGeometry args={[0.025, 4, 4]} />
        <meshStandardMaterial color="#f44336" emissive="#d50000" emissiveIntensity={1} />
      </mesh>
      <mesh position={[0.04, 0.66, 0.1]}>
        <sphereGeometry args={[0.025, 4, 4]} />
        <meshStandardMaterial color="#f44336" emissive="#d50000" emissiveIntensity={1} />
      </mesh>
      {/* 송곳니 */}
      <mesh position={[-0.03, 0.58, 0.1]}>
        <coneGeometry args={[0.008, 0.04, 3]} />
        <meshStandardMaterial color="#fafafa" />
      </mesh>
      <mesh position={[0.03, 0.58, 0.1]}>
        <coneGeometry args={[0.008, 0.04, 3]} />
        <meshStandardMaterial color="#fafafa" />
      </mesh>
      {/* 망토 */}
      <mesh position={[0, 0.38, -0.1]} scale={[1.4, 1, 0.3]}>
        <cylinderGeometry args={[0.18, 0.28, 0.5, 8]} />
        <meshStandardMaterial color="#1a1a1a" />
      </mesh>
      {/* 머리카락 */}
      <mesh position={[0, 0.72, -0.04]}>
        <boxGeometry args={[0.18, 0.06, 0.08]} />
        <meshStandardMaterial color="#111" />
      </mesh>
      {/* 빨간 오라 */}
      <mesh position={[0, 0.4, 0]}>
        <sphereGeometry args={[0.35, 8, 8]} />
        <meshStandardMaterial color="#d50000" transparent opacity={0.06} />
      </mesh>
    </group>
  );
}

// 데스나이트 (Death Knight)
export function DeathKnightModel() {
  return (
    <group>
      {/* 다리 (갑옷) */}
      <mesh position={[-0.07, 0.14, 0]}>
        <cylinderGeometry args={[0.05, 0.06, 0.28, 4]} />
        <meshStandardMaterial color="#263238" metalness={0.6} roughness={0.4} />
      </mesh>
      <mesh position={[0.07, 0.14, 0]}>
        <cylinderGeometry args={[0.05, 0.06, 0.28, 4]} />
        <meshStandardMaterial color="#263238" metalness={0.6} roughness={0.4} />
      </mesh>
      {/* 몸통 (흑철 갑옷) */}
      <mesh position={[0, 0.42, 0]}>
        <boxGeometry args={[0.3, 0.28, 0.18]} />
        <meshStandardMaterial color="#1a1a1a" metalness={0.7} roughness={0.3} />
      </mesh>
      {/* 어깨 갑옷 */}
      <mesh position={[-0.2, 0.52, 0]}>
        <boxGeometry args={[0.1, 0.08, 0.14]} />
        <meshStandardMaterial color="#263238" metalness={0.7} />
      </mesh>
      <mesh position={[0.2, 0.52, 0]}>
        <boxGeometry args={[0.1, 0.08, 0.14]} />
        <meshStandardMaterial color="#263238" metalness={0.7} />
      </mesh>
      {/* 투구 */}
      <mesh position={[0, 0.64, 0]}>
        <sphereGeometry args={[0.13, 8, 8]} />
        <meshStandardMaterial color="#212121" metalness={0.6} />
      </mesh>
      {/* 투구 뿔 */}
      <mesh position={[-0.1, 0.78, 0]} rotation={[0, 0, 0.3]}>
        <coneGeometry args={[0.02, 0.1, 4]} />
        <meshStandardMaterial color="#111" />
      </mesh>
      <mesh position={[0.1, 0.78, 0]} rotation={[0, 0, -0.3]}>
        <coneGeometry args={[0.02, 0.1, 4]} />
        <meshStandardMaterial color="#111" />
      </mesh>
      {/* 눈 (붉은 발광) */}
      <mesh position={[-0.04, 0.66, 0.11]}>
        <sphereGeometry args={[0.025, 4, 4]} />
        <meshStandardMaterial color="#f44336" emissive="#d50000" emissiveIntensity={1.2} />
      </mesh>
      <mesh position={[0.04, 0.66, 0.11]}>
        <sphereGeometry args={[0.025, 4, 4]} />
        <meshStandardMaterial color="#f44336" emissive="#d50000" emissiveIntensity={1.2} />
      </mesh>
      {/* 대검 */}
      <mesh position={[0.24, 0.38, 0]} rotation={[0, 0, -0.15]}>
        <boxGeometry args={[0.04, 0.5, 0.02]} />
        <meshStandardMaterial color="#37474f" metalness={0.8} roughness={0.2} />
      </mesh>
      {/* 검 손잡이 */}
      <mesh position={[0.24, 0.12, 0]}>
        <cylinderGeometry args={[0.02, 0.02, 0.06, 4]} />
        <meshStandardMaterial color="#4a148c" />
      </mesh>
      {/* 어둠 오라 */}
      <mesh position={[0, 0.4, 0]}>
        <sphereGeometry args={[0.4, 8, 8]} />
        <meshStandardMaterial color="#4a148c" transparent opacity={0.08} />
      </mesh>
    </group>
  );
}

// 리치왕 (Lich King)
export function LichKingModel() {
  return (
    <group>
      {/* 로브 */}
      <mesh position={[0, 0.25, 0]}>
        <coneGeometry args={[0.34, 0.55, 8]} />
        <meshStandardMaterial color="#0d47a1" />
      </mesh>
      {/* 상체 */}
      <mesh position={[0, 0.52, 0]}>
        <boxGeometry args={[0.32, 0.2, 0.2]} />
        <meshStandardMaterial color="#1a237e" />
      </mesh>
      {/* 두개골 */}
      <mesh position={[0, 0.7, 0]}>
        <sphereGeometry args={[0.14, 8, 8]} />
        <meshStandardMaterial color="#e8eaf6" />
      </mesh>
      {/* 왕관 (화려한) */}
      <mesh position={[0, 0.86, 0]}>
        <cylinderGeometry args={[0.1, 0.14, 0.08, 8]} />
        <meshStandardMaterial color="#ffd54f" metalness={0.8} roughness={0.2} />
      </mesh>
      {/* 왕관 보석 */}
      <mesh position={[0, 0.88, 0.12]}>
        <sphereGeometry args={[0.025, 4, 4]} />
        <meshStandardMaterial color="#d500f9" emissive="#aa00ff" emissiveIntensity={1} />
      </mesh>
      {/* 눈 (강한 보라) */}
      <mesh position={[-0.05, 0.72, 0.12]}>
        <sphereGeometry args={[0.035, 4, 4]} />
        <meshStandardMaterial color="#d500f9" emissive="#aa00ff" emissiveIntensity={2} />
      </mesh>
      <mesh position={[0.05, 0.72, 0.12]}>
        <sphereGeometry args={[0.035, 4, 4]} />
        <meshStandardMaterial color="#d500f9" emissive="#aa00ff" emissiveIntensity={2} />
      </mesh>
      {/* 영혼 지팡이 */}
      <mesh position={[0.28, 0.42, 0]}>
        <cylinderGeometry args={[0.025, 0.025, 0.75, 4]} />
        <meshStandardMaterial color="#311b92" />
      </mesh>
      <mesh position={[0.28, 0.82, 0]}>
        <octahedronGeometry args={[0.08, 0]} />
        <meshStandardMaterial color="#e040fb" emissive="#e040fb" emissiveIntensity={1} />
      </mesh>
      {/* 영혼 오라 */}
      <mesh position={[0, 0.45, 0]}>
        <sphereGeometry args={[0.45, 8, 8]} />
        <meshStandardMaterial color="#7c4dff" transparent opacity={0.1} />
      </mesh>
    </group>
  );
}

// 해골 궁수 (Skeletal Archer)
export function SkeletalArcherModel() {
  return (
    <group>
      {/* 다리 */}
      <mesh position={[-0.05, 0.11, 0]}>
        <cylinderGeometry args={[0.025, 0.035, 0.22, 4]} />
        <meshStandardMaterial color="#efebe9" />
      </mesh>
      <mesh position={[0.05, 0.11, 0]}>
        <cylinderGeometry args={[0.025, 0.035, 0.22, 4]} />
        <meshStandardMaterial color="#efebe9" />
      </mesh>
      {/* 골반 */}
      <mesh position={[0, 0.24, 0]}>
        <boxGeometry args={[0.16, 0.05, 0.1]} />
        <meshStandardMaterial color="#d7ccc8" />
      </mesh>
      {/* 흉곽 */}
      <mesh position={[0, 0.36, 0]}>
        <boxGeometry args={[0.18, 0.16, 0.12]} />
        <meshStandardMaterial color="#efebe9" />
      </mesh>
      {/* 두개골 */}
      <mesh position={[0, 0.52, 0]}>
        <sphereGeometry args={[0.1, 8, 8]} />
        <meshStandardMaterial color="#fff8e1" />
      </mesh>
      {/* 눈구멍 */}
      <mesh position={[-0.03, 0.54, 0.08]}>
        <sphereGeometry args={[0.02, 4, 4]} />
        <meshStandardMaterial color="#111" />
      </mesh>
      <mesh position={[0.03, 0.54, 0.08]}>
        <sphereGeometry args={[0.02, 4, 4]} />
        <meshStandardMaterial color="#111" />
      </mesh>
      {/* 활 */}
      <mesh position={[-0.16, 0.36, 0.04]} rotation={[0, 0, 0]}>
        <torusGeometry args={[0.14, 0.01, 4, 8, Math.PI]} />
        <meshStandardMaterial color="#5d4037" />
      </mesh>
      {/* 시위 */}
      <mesh position={[-0.16, 0.36, 0.04]}>
        <cylinderGeometry args={[0.003, 0.003, 0.28, 3]} />
        <meshStandardMaterial color="#bdbdbd" />
      </mesh>
      {/* 화살통 */}
      <mesh position={[0.12, 0.34, -0.08]} rotation={[0.1, 0, -0.1]}>
        <cylinderGeometry args={[0.03, 0.04, 0.16, 4]} />
        <meshStandardMaterial color="#795548" />
      </mesh>
    </group>
  );
}

// 미라 (Mummy)
export function MummyModel() {
  return (
    <group>
      {/* 다리 (붕대) */}
      <mesh position={[-0.06, 0.12, 0]}>
        <cylinderGeometry args={[0.04, 0.05, 0.24, 4]} />
        <meshStandardMaterial color="#d7ccc8" />
      </mesh>
      <mesh position={[0.06, 0.12, 0]}>
        <cylinderGeometry args={[0.04, 0.05, 0.24, 4]} />
        <meshStandardMaterial color="#d7ccc8" />
      </mesh>
      {/* 몸통 (붕대 감긴) */}
      <mesh position={[0, 0.38, 0]}>
        <cylinderGeometry args={[0.14, 0.16, 0.28, 8]} />
        <meshStandardMaterial color="#efebe9" />
      </mesh>
      {/* 붕대 줄 */}
      {[0.3, 0.36, 0.42].map((y, i) => (
        <mesh key={i} position={[0, y, 0.01]}>
          <torusGeometry args={[0.15, 0.008, 3, 12]} />
          <meshStandardMaterial color="#bcaaa4" />
        </mesh>
      ))}
      {/* 머리 */}
      <mesh position={[0, 0.58, 0]}>
        <sphereGeometry args={[0.12, 8, 8]} />
        <meshStandardMaterial color="#d7ccc8" />
      </mesh>
      {/* 눈 (노란 발광) */}
      <mesh position={[-0.04, 0.6, 0.1]}>
        <sphereGeometry args={[0.025, 4, 4]} />
        <meshStandardMaterial color="#ffd54f" emissive="#ff8f00" emissiveIntensity={0.8} />
      </mesh>
      <mesh position={[0.04, 0.6, 0.1]}>
        <sphereGeometry args={[0.025, 4, 4]} />
        <meshStandardMaterial color="#ffd54f" emissive="#ff8f00" emissiveIntensity={0.8} />
      </mesh>
      {/* 팔 (뻗은) */}
      <mesh position={[-0.2, 0.4, 0.06]} rotation={[0.4, 0, 0.5]}>
        <cylinderGeometry args={[0.03, 0.04, 0.2, 4]} />
        <meshStandardMaterial color="#d7ccc8" />
      </mesh>
      <mesh position={[0.2, 0.4, 0.06]} rotation={[0.4, 0, -0.5]}>
        <cylinderGeometry args={[0.03, 0.04, 0.2, 4]} />
        <meshStandardMaterial color="#d7ccc8" />
      </mesh>
      {/* 먼지 오라 */}
      <mesh position={[0, 0.35, 0]}>
        <sphereGeometry args={[0.28, 8, 8]} />
        <meshStandardMaterial color="#8d6e63" transparent opacity={0.08} />
      </mesh>
    </group>
  );
}

// ==================== 4. 귀신/원혼 (Ghosts) ====================

// 떠도는 영혼 (Wandering Spirit)
export function WanderingSpiritModel() {
  return (
    <group>
      <mesh position={[0, 0.2, 0]}>
        <coneGeometry args={[0.22, 0.45, 8]} />
        <meshStandardMaterial color="#90caf9" transparent opacity={0.35} />
      </mesh>
      <mesh position={[0, 0.48, 0]}>
        <sphereGeometry args={[0.13, 8, 8]} />
        <meshStandardMaterial color="#bbdefb" transparent opacity={0.45} />
      </mesh>
      <mesh position={[-0.05, 0.5, 0.11]}>
        <sphereGeometry args={[0.03, 4, 4]} />
        <meshStandardMaterial color="#e3f2fd" emissive="#e3f2fd" emissiveIntensity={0.8} />
      </mesh>
      <mesh position={[0.05, 0.5, 0.11]}>
        <sphereGeometry args={[0.03, 4, 4]} />
        <meshStandardMaterial color="#e3f2fd" emissive="#e3f2fd" emissiveIntensity={0.8} />
      </mesh>
      <mesh position={[0, 0.35, 0]}>
        <sphereGeometry args={[0.3, 8, 8]} />
        <meshStandardMaterial color="#42a5f5" transparent opacity={0.06} />
      </mesh>
    </group>
  );
}

// 처녀귀신 (Maiden Ghost)
export function MaidenGhostModel() {
  return (
    <group>
      <mesh position={[0, 0.2, 0]}>
        <coneGeometry args={[0.25, 0.5, 8]} />
        <meshStandardMaterial color="#f8bbd0" transparent opacity={0.4} />
      </mesh>
      <mesh position={[0, 0.48, 0]}>
        <sphereGeometry args={[0.14, 8, 8]} />
        <meshStandardMaterial color="#fce4ec" transparent opacity={0.5} />
      </mesh>
      {/* 긴 머리카락 */}
      <mesh position={[0, 0.48, -0.06]} scale={[1.2, 1, 0.3]}>
        <coneGeometry args={[0.16, 0.45, 6]} />
        <meshStandardMaterial color="#111" transparent opacity={0.7} />
      </mesh>
      {/* 눈 (핏빛) */}
      <mesh position={[-0.05, 0.5, 0.12]}>
        <sphereGeometry args={[0.025, 4, 4]} />
        <meshStandardMaterial color="#f44336" emissive="#d32f2f" emissiveIntensity={1} />
      </mesh>
      <mesh position={[0.05, 0.5, 0.12]}>
        <sphereGeometry args={[0.025, 4, 4]} />
        <meshStandardMaterial color="#f44336" emissive="#d32f2f" emissiveIntensity={1} />
      </mesh>
      {/* 피눈물 */}
      <mesh position={[-0.05, 0.46, 0.13]}>
        <boxGeometry args={[0.008, 0.04, 0.005]} />
        <meshStandardMaterial color="#b71c1c" />
      </mesh>
      <mesh position={[0.05, 0.46, 0.13]}>
        <boxGeometry args={[0.008, 0.04, 0.005]} />
        <meshStandardMaterial color="#b71c1c" />
      </mesh>
      <mesh position={[0, 0.35, 0]}>
        <sphereGeometry args={[0.32, 8, 8]} />
        <meshStandardMaterial color="#e91e63" transparent opacity={0.08} />
      </mesh>
    </group>
  );
}

// 야차 (Yaksha)
export function YakshaModel() {
  return (
    <group>
      <mesh position={[0, 0.22, 0]}>
        <cylinderGeometry args={[0.18, 0.24, 0.4, 8]} />
        <meshStandardMaterial color="#c62828" />
      </mesh>
      <mesh position={[0, 0.5, 0]}>
        <boxGeometry args={[0.32, 0.2, 0.2]} />
        <meshStandardMaterial color="#b71c1c" />
      </mesh>
      <mesh position={[0, 0.68, 0]}>
        <sphereGeometry args={[0.14, 8, 8]} />
        <meshStandardMaterial color="#d32f2f" />
      </mesh>
      {/* 뿔 */}
      <mesh position={[-0.1, 0.84, 0]} rotation={[0, 0, 0.25]}>
        <coneGeometry args={[0.025, 0.14, 4]} />
        <meshStandardMaterial color="#111" />
      </mesh>
      <mesh position={[0.1, 0.84, 0]} rotation={[0, 0, -0.25]}>
        <coneGeometry args={[0.025, 0.14, 4]} />
        <meshStandardMaterial color="#111" />
      </mesh>
      {/* 눈 */}
      <mesh position={[-0.05, 0.7, 0.12]}>
        <sphereGeometry args={[0.03, 4, 4]} />
        <meshStandardMaterial color="#ffd54f" emissive="#ff8f00" emissiveIntensity={1} />
      </mesh>
      <mesh position={[0.05, 0.7, 0.12]}>
        <sphereGeometry args={[0.03, 4, 4]} />
        <meshStandardMaterial color="#ffd54f" emissive="#ff8f00" emissiveIntensity={1} />
      </mesh>
      {/* 큰 이빨 */}
      <mesh position={[-0.04, 0.62, 0.12]}>
        <coneGeometry args={[0.01, 0.04, 3]} />
        <meshStandardMaterial color="#fff" />
      </mesh>
      <mesh position={[0.04, 0.62, 0.12]}>
        <coneGeometry args={[0.01, 0.04, 3]} />
        <meshStandardMaterial color="#fff" />
      </mesh>
      <mesh position={[0, 0.4, 0]}>
        <sphereGeometry args={[0.38, 8, 8]} />
        <meshStandardMaterial color="#ff1744" transparent opacity={0.08} />
      </mesh>
    </group>
  );
}

// 물귀신 (Water Ghost)
export function WaterGhostModel() {
  return (
    <group>
      <mesh position={[0, 0.18, 0]}>
        <coneGeometry args={[0.24, 0.4, 8]} />
        <meshStandardMaterial color="#0d47a1" transparent opacity={0.45} />
      </mesh>
      <mesh position={[0, 0.42, 0]}>
        <sphereGeometry args={[0.15, 8, 8]} />
        <meshStandardMaterial color="#1565c0" transparent opacity={0.5} />
      </mesh>
      {/* 해초같은 머리카락 */}
      {[-0.08, -0.04, 0, 0.04, 0.08].map((x, i) => (
        <mesh key={i} position={[x, 0.56, -0.02]} rotation={[0.2 * (i - 2), 0, 0]}>
          <cylinderGeometry args={[0.008, 0.012, 0.15, 3]} />
          <meshStandardMaterial color="#1b5e20" transparent opacity={0.6} />
        </mesh>
      ))}
      {/* 눈 */}
      <mesh position={[-0.05, 0.44, 0.13]}>
        <sphereGeometry args={[0.03, 4, 4]} />
        <meshStandardMaterial color="#80deea" emissive="#00bcd4" emissiveIntensity={1} />
      </mesh>
      <mesh position={[0.05, 0.44, 0.13]}>
        <sphereGeometry args={[0.03, 4, 4]} />
        <meshStandardMaterial color="#80deea" emissive="#00bcd4" emissiveIntensity={1} />
      </mesh>
      {/* 물방울 오라 */}
      <mesh position={[0, 0.3, 0]}>
        <sphereGeometry args={[0.32, 8, 8]} />
        <meshStandardMaterial color="#0277bd" transparent opacity={0.1} />
      </mesh>
    </group>
  );
}

// 검은 그림자 (Black Shadow)
export function BlackShadowModel() {
  return (
    <group>
      <mesh position={[0, 0.22, 0]}>
        <coneGeometry args={[0.26, 0.5, 8]} />
        <meshStandardMaterial color="#111" transparent opacity={0.6} />
      </mesh>
      <mesh position={[0, 0.5, 0]}>
        <sphereGeometry args={[0.14, 8, 8]} />
        <meshStandardMaterial color="#1a1a1a" transparent opacity={0.7} />
      </mesh>
      {/* 눈만 보이는 */}
      <mesh position={[-0.05, 0.52, 0.12]}>
        <sphereGeometry args={[0.03, 4, 4]} />
        <meshStandardMaterial color="#f44336" emissive="#f44336" emissiveIntensity={1.5} />
      </mesh>
      <mesh position={[0.05, 0.52, 0.12]}>
        <sphereGeometry args={[0.03, 4, 4]} />
        <meshStandardMaterial color="#f44336" emissive="#f44336" emissiveIntensity={1.5} />
      </mesh>
      {/* 그림자 촉수 */}
      {[-0.2, -0.1, 0.1, 0.2].map((x, i) => (
        <mesh key={i} position={[x, 0.08, 0]} rotation={[0, 0, x * 2]}>
          <coneGeometry args={[0.03, 0.15, 4]} />
          <meshStandardMaterial color="#000" transparent opacity={0.5} />
        </mesh>
      ))}
      <mesh position={[0, 0.3, 0]}>
        <sphereGeometry args={[0.35, 8, 8]} />
        <meshStandardMaterial color="#000" transparent opacity={0.15} />
      </mesh>
    </group>
  );
}

// 봉사귀 (Blind Spirit)
export function BlindSpiritModel() {
  return (
    <group>
      <mesh position={[0, 0.2, 0]}>
        <coneGeometry args={[0.22, 0.45, 8]} />
        <meshStandardMaterial color="#7e57c2" transparent opacity={0.4} />
      </mesh>
      <mesh position={[0, 0.48, 0]}>
        <sphereGeometry args={[0.13, 8, 8]} />
        <meshStandardMaterial color="#9575cd" transparent opacity={0.5} />
      </mesh>
      {/* 눈 감은 표시 (가로줄) */}
      <mesh position={[0, 0.5, 0.12]}>
        <boxGeometry args={[0.14, 0.015, 0.01]} />
        <meshStandardMaterial color="#311b92" />
      </mesh>
      {/* 더듬는 손 */}
      <mesh position={[-0.2, 0.36, 0.1]} rotation={[0.5, 0, 0.6]}>
        <coneGeometry args={[0.03, 0.15, 4]} />
        <meshStandardMaterial color="#7e57c2" transparent opacity={0.5} />
      </mesh>
      <mesh position={[0.2, 0.36, 0.1]} rotation={[0.5, 0, -0.6]}>
        <coneGeometry args={[0.03, 0.15, 4]} />
        <meshStandardMaterial color="#7e57c2" transparent opacity={0.5} />
      </mesh>
      <mesh position={[0, 0.35, 0]}>
        <sphereGeometry args={[0.3, 8, 8]} />
        <meshStandardMaterial color="#512da8" transparent opacity={0.08} />
      </mesh>
    </group>
  );
}

// 달귀 (Moon Ghost)
export function MoonGhostModel() {
  return (
    <group>
      <mesh position={[0, 0.2, 0]}>
        <coneGeometry args={[0.24, 0.46, 8]} />
        <meshStandardMaterial color="#e8eaf6" transparent opacity={0.4} />
      </mesh>
      <mesh position={[0, 0.48, 0]}>
        <sphereGeometry args={[0.14, 8, 8]} />
        <meshStandardMaterial color="#c5cae9" transparent opacity={0.5} />
      </mesh>
      {/* 달 장식 */}
      <mesh position={[0, 0.66, 0]}>
        <sphereGeometry args={[0.06, 8, 8]} />
        <meshStandardMaterial color="#ffd54f" emissive="#ffab00" emissiveIntensity={0.8} />
      </mesh>
      {/* 눈 (은빛) */}
      <mesh position={[-0.05, 0.5, 0.12]}>
        <sphereGeometry args={[0.025, 4, 4]} />
        <meshStandardMaterial color="#e8eaf6" emissive="#c5cae9" emissiveIntensity={1} />
      </mesh>
      <mesh position={[0.05, 0.5, 0.12]}>
        <sphereGeometry args={[0.025, 4, 4]} />
        <meshStandardMaterial color="#e8eaf6" emissive="#c5cae9" emissiveIntensity={1} />
      </mesh>
      {/* 달빛 오라 */}
      <mesh position={[0, 0.35, 0]}>
        <sphereGeometry args={[0.32, 8, 8]} />
        <meshStandardMaterial color="#ffd54f" transparent opacity={0.08} />
      </mesh>
    </group>
  );
}

// 이무기 (Imoogi - proto-dragon serpent)
export function ImoogiModel() {
  return (
    <group>
      {/* 뱀 몸통 (거대) */}
      <mesh position={[0, 0.1, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <torusGeometry args={[0.2, 0.08, 8, 12]} />
        <meshStandardMaterial color="#1a237e" />
      </mesh>
      <mesh position={[0, 0.22, 0]} rotation={[-Math.PI / 2, 0, 0.8]}>
        <torusGeometry args={[0.14, 0.07, 8, 12]} />
        <meshStandardMaterial color="#283593" />
      </mesh>
      {/* 머리 (용에 가까운) */}
      <mesh position={[0.12, 0.34, 0.08]} scale={[1, 0.7, 1.3]}>
        <sphereGeometry args={[0.1, 8, 8]} />
        <meshStandardMaterial color="#1a237e" />
      </mesh>
      {/* 작은 뿔 (아직 용이 아닌) */}
      <mesh position={[0.08, 0.44, 0.06]} rotation={[0.3, 0, -0.2]}>
        <coneGeometry args={[0.015, 0.06, 4]} />
        <meshStandardMaterial color="#3949ab" />
      </mesh>
      <mesh position={[0.16, 0.44, 0.06]} rotation={[0.3, 0, 0.2]}>
        <coneGeometry args={[0.015, 0.06, 4]} />
        <meshStandardMaterial color="#3949ab" />
      </mesh>
      {/* 눈 */}
      <mesh position={[0.1, 0.38, 0.16]}>
        <sphereGeometry args={[0.025, 4, 4]} />
        <meshStandardMaterial color="#ffd54f" emissive="#ffab00" emissiveIntensity={0.8} />
      </mesh>
      <mesh position={[0.16, 0.38, 0.14]}>
        <sphereGeometry args={[0.025, 4, 4]} />
        <meshStandardMaterial color="#ffd54f" emissive="#ffab00" emissiveIntensity={0.8} />
      </mesh>
      {/* 비늘 광택 */}
      <mesh position={[0, 0.15, 0]}>
        <sphereGeometry args={[0.32, 8, 8]} />
        <meshStandardMaterial color="#1a237e" transparent opacity={0.06} />
      </mesh>
      {/* 수염 */}
      <mesh position={[0.06, 0.3, 0.18]} rotation={[0.5, 0, -0.3]}>
        <cylinderGeometry args={[0.004, 0.004, 0.12, 3]} />
        <meshStandardMaterial color="#9fa8da" />
      </mesh>
      <mesh position={[0.18, 0.3, 0.16]} rotation={[0.5, 0, 0.3]}>
        <cylinderGeometry args={[0.004, 0.004, 0.12, 3]} />
        <meshStandardMaterial color="#9fa8da" />
      </mesh>
    </group>
  );
}

// ==================== 5. 정령 (Elementals) ====================

// 대지의 정령 (Earth Elemental)
export function EarthElementalModel() {
  return (
    <group>
      <mesh position={[0, 0.16, 0]}>
        <boxGeometry args={[0.3, 0.3, 0.28]} />
        <meshStandardMaterial color="#5d4037" roughness={0.9} />
      </mesh>
      <mesh position={[0, 0.38, 0]}>
        <boxGeometry args={[0.26, 0.18, 0.24]} />
        <meshStandardMaterial color="#6d4c41" roughness={0.9} />
      </mesh>
      <mesh position={[0, 0.52, 0]}>
        <boxGeometry args={[0.2, 0.14, 0.18]} />
        <meshStandardMaterial color="#795548" roughness={0.9} />
      </mesh>
      {/* 눈 */}
      <mesh position={[-0.05, 0.54, 0.1]}>
        <boxGeometry args={[0.04, 0.03, 0.02]} />
        <meshStandardMaterial color="#8bc34a" emissive="#689f38" emissiveIntensity={0.8} />
      </mesh>
      <mesh position={[0.05, 0.54, 0.1]}>
        <boxGeometry args={[0.04, 0.03, 0.02]} />
        <meshStandardMaterial color="#8bc34a" emissive="#689f38" emissiveIntensity={0.8} />
      </mesh>
      {/* 이끼 */}
      <mesh position={[0.08, 0.3, 0.15]}>
        <boxGeometry args={[0.06, 0.04, 0.01]} />
        <meshStandardMaterial color="#33691e" />
      </mesh>
      {/* 바위 팔 */}
      <mesh position={[-0.24, 0.32, 0]}>
        <boxGeometry args={[0.12, 0.24, 0.12]} />
        <meshStandardMaterial color="#5d4037" roughness={0.9} />
      </mesh>
      <mesh position={[0.24, 0.32, 0]}>
        <boxGeometry args={[0.12, 0.24, 0.12]} />
        <meshStandardMaterial color="#5d4037" roughness={0.9} />
      </mesh>
    </group>
  );
}

// 번개 정령 (Lightning Elemental)
export function LightningElementalModel() {
  return (
    <group>
      <mesh position={[0, 0.18, 0]}>
        <coneGeometry args={[0.22, 0.4, 8]} />
        <meshStandardMaterial color="#ffd54f" transparent opacity={0.5} />
      </mesh>
      <mesh position={[0, 0.4, 0]}>
        <sphereGeometry args={[0.16, 8, 8]} />
        <meshStandardMaterial color="#ffeb3b" emissive="#f9a825" emissiveIntensity={0.5} transparent opacity={0.6} />
      </mesh>
      <mesh position={[0, 0.58, 0]}>
        <sphereGeometry args={[0.11, 8, 8]} />
        <meshStandardMaterial color="#fff9c4" emissive="#fdd835" emissiveIntensity={0.6} transparent opacity={0.65} />
      </mesh>
      {/* 번개 볼트 */}
      {[[-0.18, 0.35, 0.05], [0.18, 0.4, -0.03], [-0.1, 0.5, 0.08], [0.12, 0.3, -0.06]].map((p, i) => (
        <mesh key={i} position={p} rotation={[0, 0, (i - 1.5) * 0.5]}>
          <boxGeometry args={[0.015, 0.12, 0.015]} />
          <meshStandardMaterial color="#ffff00" emissive="#ffff00" emissiveIntensity={1.5} />
        </mesh>
      ))}
      {/* 눈 */}
      <mesh position={[-0.04, 0.6, 0.09]}>
        <sphereGeometry args={[0.025, 4, 4]} />
        <meshStandardMaterial color="#fff" emissive="#fff" emissiveIntensity={1.5} />
      </mesh>
      <mesh position={[0.04, 0.6, 0.09]}>
        <sphereGeometry args={[0.025, 4, 4]} />
        <meshStandardMaterial color="#fff" emissive="#fff" emissiveIntensity={1.5} />
      </mesh>
      <mesh position={[0, 0.35, 0]}>
        <sphereGeometry args={[0.3, 8, 8]} />
        <meshStandardMaterial color="#ffeb3b" transparent opacity={0.1} />
      </mesh>
    </group>
  );
}

// 얼음 정령 (Ice Elemental)
export function IceElementalModel() {
  return (
    <group>
      <mesh position={[0, 0.18, 0]}>
        <coneGeometry args={[0.24, 0.4, 6]} />
        <meshStandardMaterial color="#b3e5fc" transparent opacity={0.55} />
      </mesh>
      <mesh position={[0, 0.4, 0]}>
        <octahedronGeometry args={[0.16, 0]} />
        <meshStandardMaterial color="#e1f5fe" transparent opacity={0.6} metalness={0.3} roughness={0.1} />
      </mesh>
      <mesh position={[0, 0.6, 0]}>
        <octahedronGeometry args={[0.1, 0]} />
        <meshStandardMaterial color="#e3f2fd" transparent opacity={0.65} metalness={0.4} roughness={0.1} />
      </mesh>
      {/* 얼음 결정 */}
      <mesh position={[-0.18, 0.35, 0.06]} rotation={[0, 0, 0.4]}>
        <coneGeometry args={[0.03, 0.12, 4]} />
        <meshStandardMaterial color="#81d4fa" transparent opacity={0.7} />
      </mesh>
      <mesh position={[0.18, 0.38, -0.04]} rotation={[0, 0, -0.5]}>
        <coneGeometry args={[0.025, 0.1, 4]} />
        <meshStandardMaterial color="#81d4fa" transparent opacity={0.7} />
      </mesh>
      {/* 눈 */}
      <mesh position={[-0.04, 0.42, 0.12]}>
        <sphereGeometry args={[0.025, 4, 4]} />
        <meshStandardMaterial color="#e1f5fe" emissive="#e1f5fe" emissiveIntensity={1} />
      </mesh>
      <mesh position={[0.04, 0.42, 0.12]}>
        <sphereGeometry args={[0.025, 4, 4]} />
        <meshStandardMaterial color="#e1f5fe" emissive="#e1f5fe" emissiveIntensity={1} />
      </mesh>
      <mesh position={[0, 0.35, 0]}>
        <sphereGeometry args={[0.3, 8, 8]} />
        <meshStandardMaterial color="#29b6f6" transparent opacity={0.08} />
      </mesh>
    </group>
  );
}

// 빛의 정령 (Light Elemental)
export function LightElementalModel() {
  return (
    <group>
      <mesh position={[0, 0.2, 0]}>
        <coneGeometry args={[0.2, 0.38, 8]} />
        <meshStandardMaterial color="#fff9c4" transparent opacity={0.45} />
      </mesh>
      <mesh position={[0, 0.42, 0]}>
        <sphereGeometry args={[0.16, 8, 8]} />
        <meshStandardMaterial color="#fffde7" emissive="#fff176" emissiveIntensity={0.6} transparent opacity={0.55} />
      </mesh>
      <mesh position={[0, 0.6, 0]}>
        <sphereGeometry args={[0.11, 8, 8]} />
        <meshStandardMaterial color="#fff" emissive="#fff9c4" emissiveIntensity={0.8} transparent opacity={0.6} />
      </mesh>
      {/* 빛 광선 */}
      {[0, Math.PI / 3, Math.PI * 2 / 3, Math.PI, Math.PI * 4 / 3, Math.PI * 5 / 3].map((r, i) => (
        <mesh key={i} position={[Math.cos(r) * 0.2, 0.42, Math.sin(r) * 0.2]} rotation={[0, 0, r]}>
          <boxGeometry args={[0.15, 0.01, 0.01]} />
          <meshStandardMaterial color="#fff176" emissive="#fff176" emissiveIntensity={1} />
        </mesh>
      ))}
      {/* 눈 */}
      <mesh position={[-0.04, 0.62, 0.09]}>
        <sphereGeometry args={[0.02, 4, 4]} />
        <meshStandardMaterial color="#fff" emissive="#fff" emissiveIntensity={2} />
      </mesh>
      <mesh position={[0.04, 0.62, 0.09]}>
        <sphereGeometry args={[0.02, 4, 4]} />
        <meshStandardMaterial color="#fff" emissive="#fff" emissiveIntensity={2} />
      </mesh>
      <mesh position={[0, 0.4, 0]}>
        <sphereGeometry args={[0.32, 8, 8]} />
        <meshStandardMaterial color="#fff176" transparent opacity={0.12} />
      </mesh>
    </group>
  );
}

// 어둠의 정령 (Dark Elemental)
export function DarkElementalModel() {
  return (
    <group>
      <mesh position={[0, 0.18, 0]}>
        <coneGeometry args={[0.24, 0.4, 8]} />
        <meshStandardMaterial color="#1a1a1a" transparent opacity={0.6} />
      </mesh>
      <mesh position={[0, 0.4, 0]}>
        <sphereGeometry args={[0.17, 8, 8]} />
        <meshStandardMaterial color="#212121" transparent opacity={0.65} />
      </mesh>
      <mesh position={[0, 0.58, 0]}>
        <sphereGeometry args={[0.12, 8, 8]} />
        <meshStandardMaterial color="#111" transparent opacity={0.7} />
      </mesh>
      {/* 어둠 촉수 */}
      {[-0.2, -0.1, 0.1, 0.2].map((x, i) => (
        <mesh key={i} position={[x, 0.12, 0]} rotation={[0, 0, x * 1.5]}>
          <coneGeometry args={[0.025, 0.14, 4]} />
          <meshStandardMaterial color="#000" transparent opacity={0.5} />
        </mesh>
      ))}
      {/* 눈 (보라 발광) */}
      <mesh position={[-0.04, 0.6, 0.1]}>
        <sphereGeometry args={[0.025, 4, 4]} />
        <meshStandardMaterial color="#d500f9" emissive="#aa00ff" emissiveIntensity={1.2} />
      </mesh>
      <mesh position={[0.04, 0.6, 0.1]}>
        <sphereGeometry args={[0.025, 4, 4]} />
        <meshStandardMaterial color="#d500f9" emissive="#aa00ff" emissiveIntensity={1.2} />
      </mesh>
      <mesh position={[0, 0.35, 0]}>
        <sphereGeometry args={[0.32, 8, 8]} />
        <meshStandardMaterial color="#311b92" transparent opacity={0.12} />
      </mesh>
    </group>
  );
}

// 정령왕 (Elemental King)
export function ElementalKingModel() {
  return (
    <group>
      <mesh position={[0, 0.2, 0]}>
        <coneGeometry args={[0.28, 0.45, 8]} />
        <meshStandardMaterial color="#ffd54f" transparent opacity={0.5} />
      </mesh>
      <mesh position={[0, 0.48, 0]}>
        <sphereGeometry args={[0.2, 8, 8]} />
        <meshStandardMaterial color="#fff176" emissive="#f9a825" emissiveIntensity={0.4} transparent opacity={0.6} />
      </mesh>
      <mesh position={[0, 0.7, 0]}>
        <sphereGeometry args={[0.14, 8, 8]} />
        <meshStandardMaterial color="#fff9c4" emissive="#fdd835" emissiveIntensity={0.5} transparent opacity={0.65} />
      </mesh>
      {/* 왕관 */}
      <mesh position={[0, 0.86, 0]}>
        <cylinderGeometry args={[0.08, 0.12, 0.06, 6]} />
        <meshStandardMaterial color="#ffd54f" metalness={0.8} roughness={0.2} />
      </mesh>
      {/* 4원소 구슬 */}
      <mesh position={[-0.22, 0.5, 0.1]}>
        <sphereGeometry args={[0.04, 4, 4]} />
        <meshStandardMaterial color="#f44336" emissive="#d32f2f" emissiveIntensity={0.8} />
      </mesh>
      <mesh position={[0.22, 0.5, 0.1]}>
        <sphereGeometry args={[0.04, 4, 4]} />
        <meshStandardMaterial color="#2196f3" emissive="#1565c0" emissiveIntensity={0.8} />
      </mesh>
      <mesh position={[-0.18, 0.5, -0.12]}>
        <sphereGeometry args={[0.04, 4, 4]} />
        <meshStandardMaterial color="#4caf50" emissive="#2e7d32" emissiveIntensity={0.8} />
      </mesh>
      <mesh position={[0.18, 0.5, -0.12]}>
        <sphereGeometry args={[0.04, 4, 4]} />
        <meshStandardMaterial color="#9e9e9e" emissive="#616161" emissiveIntensity={0.8} />
      </mesh>
      {/* 눈 */}
      <mesh position={[-0.05, 0.72, 0.12]}>
        <sphereGeometry args={[0.03, 4, 4]} />
        <meshStandardMaterial color="#fff" emissive="#fff" emissiveIntensity={1.5} />
      </mesh>
      <mesh position={[0.05, 0.72, 0.12]}>
        <sphereGeometry args={[0.03, 4, 4]} />
        <meshStandardMaterial color="#fff" emissive="#fff" emissiveIntensity={1.5} />
      </mesh>
      <mesh position={[0, 0.45, 0]}>
        <sphereGeometry args={[0.4, 8, 8]} />
        <meshStandardMaterial color="#ffd54f" transparent opacity={0.1} />
      </mesh>
    </group>
  );
}

// ==================== 6. 악마 (Demons) ====================

// 임프 (Imp)
export function ImpModel() {
  return (
    <group>
      <mesh position={[0, 0.12, 0]}>
        <sphereGeometry args={[0.12, 8, 8]} />
        <meshStandardMaterial color="#c62828" />
      </mesh>
      <mesh position={[0, 0.28, 0]}>
        <sphereGeometry args={[0.1, 8, 8]} />
        <meshStandardMaterial color="#d32f2f" />
      </mesh>
      {/* 뿔 */}
      <mesh position={[-0.06, 0.38, 0]} rotation={[0, 0, 0.3]}>
        <coneGeometry args={[0.015, 0.06, 4]} />
        <meshStandardMaterial color="#111" />
      </mesh>
      <mesh position={[0.06, 0.38, 0]} rotation={[0, 0, -0.3]}>
        <coneGeometry args={[0.015, 0.06, 4]} />
        <meshStandardMaterial color="#111" />
      </mesh>
      {/* 날개 */}
      <mesh position={[-0.14, 0.22, -0.04]} rotation={[0.2, 0, 0.4]} scale={[1, 0.05, 0.7]}>
        <boxGeometry args={[0.1, 0.02, 0.1]} />
        <meshStandardMaterial color="#880e4f" />
      </mesh>
      <mesh position={[0.14, 0.22, -0.04]} rotation={[0.2, 0, -0.4]} scale={[1, 0.05, 0.7]}>
        <boxGeometry args={[0.1, 0.02, 0.1]} />
        <meshStandardMaterial color="#880e4f" />
      </mesh>
      {/* 눈 */}
      <mesh position={[-0.04, 0.3, 0.08]}>
        <sphereGeometry args={[0.02, 4, 4]} />
        <meshStandardMaterial color="#ffeb3b" emissive="#fbc02d" emissiveIntensity={0.6} />
      </mesh>
      <mesh position={[0.04, 0.3, 0.08]}>
        <sphereGeometry args={[0.02, 4, 4]} />
        <meshStandardMaterial color="#ffeb3b" emissive="#fbc02d" emissiveIntensity={0.6} />
      </mesh>
      {/* 꼬리 (뾰족) */}
      <mesh position={[0, 0.1, -0.14]} rotation={[0.8, 0, 0]}>
        <coneGeometry args={[0.015, 0.12, 4]} />
        <meshStandardMaterial color="#b71c1c" />
      </mesh>
      {/* 삼지창 */}
      <mesh position={[0.14, 0.18, 0.02]}>
        <cylinderGeometry args={[0.01, 0.01, 0.26, 3]} />
        <meshStandardMaterial color="#5d4037" />
      </mesh>
    </group>
  );
}

// 서큐버스 (Succubus)
export function SuccubusModel() {
  return (
    <group>
      <mesh position={[-0.05, 0.14, 0]}>
        <cylinderGeometry args={[0.035, 0.04, 0.28, 4]} />
        <meshStandardMaterial color="#4a148c" />
      </mesh>
      <mesh position={[0.05, 0.14, 0]}>
        <cylinderGeometry args={[0.035, 0.04, 0.28, 4]} />
        <meshStandardMaterial color="#4a148c" />
      </mesh>
      <mesh position={[0, 0.42, 0]}>
        <cylinderGeometry args={[0.13, 0.16, 0.28, 8]} />
        <meshStandardMaterial color="#880e4f" />
      </mesh>
      <mesh position={[0, 0.64, 0]}>
        <sphereGeometry args={[0.12, 8, 8]} />
        <meshStandardMaterial color="#f8bbd0" />
      </mesh>
      {/* 뿔 */}
      <mesh position={[-0.08, 0.76, 0]} rotation={[0, 0, 0.3]}>
        <coneGeometry args={[0.015, 0.08, 4]} />
        <meshStandardMaterial color="#311b92" />
      </mesh>
      <mesh position={[0.08, 0.76, 0]} rotation={[0, 0, -0.3]}>
        <coneGeometry args={[0.015, 0.08, 4]} />
        <meshStandardMaterial color="#311b92" />
      </mesh>
      {/* 날개 */}
      <mesh position={[-0.2, 0.48, -0.06]} rotation={[0.2, 0.3, 0.4]}>
        <boxGeometry args={[0.14, 0.18, 0.01]} />
        <meshStandardMaterial color="#4a148c" transparent opacity={0.7} />
      </mesh>
      <mesh position={[0.2, 0.48, -0.06]} rotation={[0.2, -0.3, -0.4]}>
        <boxGeometry args={[0.14, 0.18, 0.01]} />
        <meshStandardMaterial color="#4a148c" transparent opacity={0.7} />
      </mesh>
      {/* 눈 (매혹) */}
      <mesh position={[-0.04, 0.66, 0.1]}>
        <sphereGeometry args={[0.02, 4, 4]} />
        <meshStandardMaterial color="#e040fb" emissive="#e040fb" emissiveIntensity={0.8} />
      </mesh>
      <mesh position={[0.04, 0.66, 0.1]}>
        <sphereGeometry args={[0.02, 4, 4]} />
        <meshStandardMaterial color="#e040fb" emissive="#e040fb" emissiveIntensity={0.8} />
      </mesh>
      {/* 꼬리 */}
      <mesh position={[0, 0.3, -0.18]} rotation={[0.6, 0, 0]}>
        <coneGeometry args={[0.012, 0.16, 4]} />
        <meshStandardMaterial color="#880e4f" />
      </mesh>
      <mesh position={[0, 0.42, 0]}>
        <sphereGeometry args={[0.3, 8, 8]} />
        <meshStandardMaterial color="#e040fb" transparent opacity={0.06} />
      </mesh>
    </group>
  );
}

// 인큐버스 (Incubus)
export function IncubusModel() {
  return (
    <group>
      <mesh position={[-0.06, 0.14, 0]}>
        <cylinderGeometry args={[0.04, 0.045, 0.28, 4]} />
        <meshStandardMaterial color="#1a1a1a" />
      </mesh>
      <mesh position={[0.06, 0.14, 0]}>
        <cylinderGeometry args={[0.04, 0.045, 0.28, 4]} />
        <meshStandardMaterial color="#1a1a1a" />
      </mesh>
      <mesh position={[0, 0.44, 0]}>
        <boxGeometry args={[0.24, 0.28, 0.16]} />
        <meshStandardMaterial color="#311b92" />
      </mesh>
      <mesh position={[0, 0.66, 0]}>
        <sphereGeometry args={[0.12, 8, 8]} />
        <meshStandardMaterial color="#b39ddb" />
      </mesh>
      {/* 뿔 */}
      <mesh position={[-0.09, 0.78, 0]} rotation={[-0.1, 0, 0.3]}>
        <coneGeometry args={[0.018, 0.1, 4]} />
        <meshStandardMaterial color="#111" />
      </mesh>
      <mesh position={[0.09, 0.78, 0]} rotation={[-0.1, 0, -0.3]}>
        <coneGeometry args={[0.018, 0.1, 4]} />
        <meshStandardMaterial color="#111" />
      </mesh>
      {/* 날개 */}
      <mesh position={[-0.22, 0.5, -0.06]} rotation={[0.2, 0.3, 0.3]}>
        <boxGeometry args={[0.16, 0.22, 0.01]} />
        <meshStandardMaterial color="#1a237e" transparent opacity={0.7} />
      </mesh>
      <mesh position={[0.22, 0.5, -0.06]} rotation={[0.2, -0.3, -0.3]}>
        <boxGeometry args={[0.16, 0.22, 0.01]} />
        <meshStandardMaterial color="#1a237e" transparent opacity={0.7} />
      </mesh>
      {/* 눈 */}
      <mesh position={[-0.04, 0.68, 0.1]}>
        <sphereGeometry args={[0.025, 4, 4]} />
        <meshStandardMaterial color="#b388ff" emissive="#7c4dff" emissiveIntensity={0.8} />
      </mesh>
      <mesh position={[0.04, 0.68, 0.1]}>
        <sphereGeometry args={[0.025, 4, 4]} />
        <meshStandardMaterial color="#b388ff" emissive="#7c4dff" emissiveIntensity={0.8} />
      </mesh>
      <mesh position={[0, 0.44, 0]}>
        <sphereGeometry args={[0.32, 8, 8]} />
        <meshStandardMaterial color="#7c4dff" transparent opacity={0.06} />
      </mesh>
    </group>
  );
}

// 지옥견 (Hell Hound)
export function HellHoundModel() {
  return (
    <group>
      <mesh position={[0, 0.2, 0]} scale={[0.9, 0.8, 1.4]}>
        <sphereGeometry args={[0.22, 8, 8]} />
        <meshStandardMaterial color="#1a1a1a" />
      </mesh>
      <mesh position={[0, 0.3, 0.24]}>
        <sphereGeometry args={[0.14, 8, 8]} />
        <meshStandardMaterial color="#212121" />
      </mesh>
      {/* 불타는 눈 */}
      <mesh position={[-0.05, 0.34, 0.36]}>
        <sphereGeometry args={[0.025, 4, 4]} />
        <meshStandardMaterial color="#ff3d00" emissive="#dd2c00" emissiveIntensity={1.5} />
      </mesh>
      <mesh position={[0.05, 0.34, 0.36]}>
        <sphereGeometry args={[0.025, 4, 4]} />
        <meshStandardMaterial color="#ff3d00" emissive="#dd2c00" emissiveIntensity={1.5} />
      </mesh>
      {/* 불꽃 갈기 */}
      {[[-0.06, 0.36, 0.12], [0, 0.38, 0.1], [0.06, 0.36, 0.12]].map((p, i) => (
        <mesh key={i} position={p}>
          <coneGeometry args={[0.025, 0.1, 4]} />
          <meshStandardMaterial color="#ff6d00" emissive="#e65100" emissiveIntensity={0.6} />
        </mesh>
      ))}
      {/* 다리 */}
      {[[-0.1, 0, 0.1], [0.1, 0, 0.1], [-0.1, 0, -0.1], [0.1, 0, -0.1]].map((p, i) => (
        <mesh key={i} position={p}>
          <cylinderGeometry args={[0.035, 0.04, 0.18, 4]} />
          <meshStandardMaterial color="#111" />
        </mesh>
      ))}
      {/* 불 오라 */}
      <mesh position={[0, 0.22, 0]}>
        <sphereGeometry args={[0.36, 8, 8]} />
        <meshStandardMaterial color="#ff3d00" transparent opacity={0.08} />
      </mesh>
    </group>
  );
}

// 발록 (Balrog)
export function BalrogModel() {
  return (
    <group>
      <mesh position={[0, 0.25, 0]}>
        <cylinderGeometry args={[0.2, 0.28, 0.5, 8]} />
        <meshStandardMaterial color="#1a1a1a" />
      </mesh>
      <mesh position={[0, 0.58, 0]}>
        <boxGeometry args={[0.44, 0.28, 0.24]} />
        <meshStandardMaterial color="#b71c1c" />
      </mesh>
      <mesh position={[0, 0.8, 0]}>
        <sphereGeometry args={[0.15, 8, 8]} />
        <meshStandardMaterial color="#d32f2f" />
      </mesh>
      {/* 큰 뿔 */}
      <mesh position={[-0.14, 0.98, 0]} rotation={[0, 0, 0.35]}>
        <coneGeometry args={[0.03, 0.18, 4]} />
        <meshStandardMaterial color="#111" />
      </mesh>
      <mesh position={[0.14, 0.98, 0]} rotation={[0, 0, -0.35]}>
        <coneGeometry args={[0.03, 0.18, 4]} />
        <meshStandardMaterial color="#111" />
      </mesh>
      {/* 불꽃 날개 */}
      <mesh position={[-0.32, 0.6, -0.06]} rotation={[0.2, 0.3, 0.3]}>
        <boxGeometry args={[0.2, 0.3, 0.01]} />
        <meshStandardMaterial color="#ff6d00" emissive="#e65100" emissiveIntensity={0.5} transparent opacity={0.7} />
      </mesh>
      <mesh position={[0.32, 0.6, -0.06]} rotation={[0.2, -0.3, -0.3]}>
        <boxGeometry args={[0.2, 0.3, 0.01]} />
        <meshStandardMaterial color="#ff6d00" emissive="#e65100" emissiveIntensity={0.5} transparent opacity={0.7} />
      </mesh>
      {/* 눈 */}
      <mesh position={[-0.05, 0.82, 0.13]}>
        <sphereGeometry args={[0.03, 4, 4]} />
        <meshStandardMaterial color="#ffab00" emissive="#ff6d00" emissiveIntensity={1.5} />
      </mesh>
      <mesh position={[0.05, 0.82, 0.13]}>
        <sphereGeometry args={[0.03, 4, 4]} />
        <meshStandardMaterial color="#ffab00" emissive="#ff6d00" emissiveIntensity={1.5} />
      </mesh>
      {/* 불 채찍 */}
      <mesh position={[0.3, 0.4, 0.1]} rotation={[0.5, -0.3, -0.4]}>
        <cylinderGeometry args={[0.015, 0.01, 0.5, 4]} />
        <meshStandardMaterial color="#ff3d00" emissive="#dd2c00" emissiveIntensity={0.6} />
      </mesh>
      <mesh position={[0, 0.5, 0]}>
        <sphereGeometry args={[0.45, 8, 8]} />
        <meshStandardMaterial color="#ff3d00" transparent opacity={0.1} />
      </mesh>
    </group>
  );
}

// 마왕의 부하 (Demon Servant)
export function DemonServantModel() {
  return (
    <group>
      <mesh position={[-0.06, 0.12, 0]}>
        <cylinderGeometry args={[0.04, 0.05, 0.24, 4]} />
        <meshStandardMaterial color="#37474f" />
      </mesh>
      <mesh position={[0.06, 0.12, 0]}>
        <cylinderGeometry args={[0.04, 0.05, 0.24, 4]} />
        <meshStandardMaterial color="#37474f" />
      </mesh>
      <mesh position={[0, 0.38, 0]}>
        <boxGeometry args={[0.24, 0.24, 0.16]} />
        <meshStandardMaterial color="#4a148c" />
      </mesh>
      <mesh position={[0, 0.58, 0]}>
        <sphereGeometry args={[0.12, 8, 8]} />
        <meshStandardMaterial color="#6a1b9a" />
      </mesh>
      {/* 뿔 */}
      <mesh position={[-0.08, 0.7, 0]} rotation={[0, 0, 0.2]}>
        <coneGeometry args={[0.015, 0.08, 4]} />
        <meshStandardMaterial color="#111" />
      </mesh>
      <mesh position={[0.08, 0.7, 0]} rotation={[0, 0, -0.2]}>
        <coneGeometry args={[0.015, 0.08, 4]} />
        <meshStandardMaterial color="#111" />
      </mesh>
      <mesh position={[-0.04, 0.6, 0.1]}>
        <sphereGeometry args={[0.02, 4, 4]} />
        <meshStandardMaterial color="#f44336" emissive="#d50000" emissiveIntensity={0.8} />
      </mesh>
      <mesh position={[0.04, 0.6, 0.1]}>
        <sphereGeometry args={[0.02, 4, 4]} />
        <meshStandardMaterial color="#f44336" emissive="#d50000" emissiveIntensity={0.8} />
      </mesh>
      {/* 도끼 */}
      <mesh position={[0.2, 0.34, 0]}>
        <cylinderGeometry args={[0.012, 0.012, 0.3, 3]} />
        <meshStandardMaterial color="#5d4037" />
      </mesh>
      <mesh position={[0.2, 0.5, 0.03]} rotation={[0, 0, -0.2]}>
        <boxGeometry args={[0.08, 0.06, 0.02]} />
        <meshStandardMaterial color="#455a64" metalness={0.6} />
      </mesh>
    </group>
  );
}

// 타락 천사 (Fallen Angel)
export function FallenAngelModel() {
  return (
    <group>
      <mesh position={[-0.05, 0.14, 0]}>
        <cylinderGeometry args={[0.035, 0.04, 0.28, 4]} />
        <meshStandardMaterial color="#212121" />
      </mesh>
      <mesh position={[0.05, 0.14, 0]}>
        <cylinderGeometry args={[0.035, 0.04, 0.28, 4]} />
        <meshStandardMaterial color="#212121" />
      </mesh>
      <mesh position={[0, 0.42, 0]}>
        <cylinderGeometry args={[0.13, 0.16, 0.28, 8]} />
        <meshStandardMaterial color="#263238" />
      </mesh>
      <mesh position={[0, 0.64, 0]}>
        <sphereGeometry args={[0.12, 8, 8]} />
        <meshStandardMaterial color="#cfd8dc" />
      </mesh>
      {/* 타락한 후광 */}
      <mesh position={[0, 0.82, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <torusGeometry args={[0.1, 0.01, 4, 12]} />
        <meshStandardMaterial color="#4a148c" emissive="#7b1fa2" emissiveIntensity={0.6} />
      </mesh>
      {/* 검은 날개 */}
      <mesh position={[-0.24, 0.5, -0.08]} rotation={[0.2, 0.4, 0.3]}>
        <boxGeometry args={[0.2, 0.28, 0.01]} />
        <meshStandardMaterial color="#111" />
      </mesh>
      <mesh position={[0.24, 0.5, -0.08]} rotation={[0.2, -0.4, -0.3]}>
        <boxGeometry args={[0.2, 0.28, 0.01]} />
        <meshStandardMaterial color="#111" />
      </mesh>
      {/* 눈 */}
      <mesh position={[-0.04, 0.66, 0.1]}>
        <sphereGeometry args={[0.02, 4, 4]} />
        <meshStandardMaterial color="#b388ff" emissive="#7c4dff" emissiveIntensity={1} />
      </mesh>
      <mesh position={[0.04, 0.66, 0.1]}>
        <sphereGeometry args={[0.02, 4, 4]} />
        <meshStandardMaterial color="#b388ff" emissive="#7c4dff" emissiveIntensity={1} />
      </mesh>
      {/* 타락 검 */}
      <mesh position={[0.2, 0.36, 0.02]} rotation={[0, 0, -0.15]}>
        <boxGeometry args={[0.025, 0.35, 0.015]} />
        <meshStandardMaterial color="#4a148c" metalness={0.5} />
      </mesh>
      <mesh position={[0, 0.44, 0]}>
        <sphereGeometry args={[0.34, 8, 8]} />
        <meshStandardMaterial color="#7c4dff" transparent opacity={0.06} />
      </mesh>
    </group>
  );
}

// 마왕 (Demon King)
export function DemonKingModel() {
  return (
    <group>
      <mesh position={[0, 0.26, 0]}>
        <cylinderGeometry args={[0.22, 0.3, 0.5, 8]} />
        <meshStandardMaterial color="#4a148c" />
      </mesh>
      <mesh position={[0, 0.6, 0]}>
        <boxGeometry args={[0.46, 0.3, 0.26]} />
        <meshStandardMaterial color="#311b92" />
      </mesh>
      <mesh position={[0, 0.84, 0]}>
        <sphereGeometry args={[0.16, 8, 8]} />
        <meshStandardMaterial color="#1a237e" />
      </mesh>
      {/* 거대한 뿔 */}
      <mesh position={[-0.16, 1.04, 0]} rotation={[-0.1, 0, 0.4]}>
        <coneGeometry args={[0.035, 0.22, 4]} />
        <meshStandardMaterial color="#111" />
      </mesh>
      <mesh position={[0.16, 1.04, 0]} rotation={[-0.1, 0, -0.4]}>
        <coneGeometry args={[0.035, 0.22, 4]} />
        <meshStandardMaterial color="#111" />
      </mesh>
      {/* 왕관 */}
      <mesh position={[0, 0.98, 0]}>
        <cylinderGeometry args={[0.1, 0.14, 0.06, 8]} />
        <meshStandardMaterial color="#ffd54f" metalness={0.8} roughness={0.2} />
      </mesh>
      {/* 눈 */}
      <mesh position={[-0.06, 0.86, 0.14]}>
        <sphereGeometry args={[0.035, 4, 4]} />
        <meshStandardMaterial color="#ff1744" emissive="#d50000" emissiveIntensity={2} />
      </mesh>
      <mesh position={[0.06, 0.86, 0.14]}>
        <sphereGeometry args={[0.035, 4, 4]} />
        <meshStandardMaterial color="#ff1744" emissive="#d50000" emissiveIntensity={2} />
      </mesh>
      {/* 거대 날개 */}
      <mesh position={[-0.36, 0.65, -0.08]} rotation={[0.2, 0.3, 0.2]}>
        <boxGeometry args={[0.24, 0.36, 0.01]} />
        <meshStandardMaterial color="#1a1a1a" transparent opacity={0.8} />
      </mesh>
      <mesh position={[0.36, 0.65, -0.08]} rotation={[0.2, -0.3, -0.2]}>
        <boxGeometry args={[0.24, 0.36, 0.01]} />
        <meshStandardMaterial color="#1a1a1a" transparent opacity={0.8} />
      </mesh>
      {/* 마검 */}
      <mesh position={[0.3, 0.44, 0]} rotation={[0, 0, -0.1]}>
        <boxGeometry args={[0.04, 0.55, 0.02]} />
        <meshStandardMaterial color="#d500f9" emissive="#aa00ff" emissiveIntensity={0.4} metalness={0.5} />
      </mesh>
      {/* 마왕 오라 */}
      <mesh position={[0, 0.55, 0]}>
        <sphereGeometry args={[0.5, 8, 8]} />
        <meshStandardMaterial color="#d500f9" transparent opacity={0.1} />
      </mesh>
    </group>
  );
}

// 가고일 (Gargoyle)
export function GargoyleModel() {
  return (
    <group>
      <mesh position={[0, 0.2, 0]}>
        <cylinderGeometry args={[0.16, 0.2, 0.35, 6]} />
        <meshStandardMaterial color="#616161" roughness={0.9} />
      </mesh>
      <mesh position={[0, 0.44, 0]}>
        <boxGeometry args={[0.28, 0.18, 0.16]} />
        <meshStandardMaterial color="#757575" roughness={0.9} />
      </mesh>
      <mesh position={[0, 0.6, 0]}>
        <sphereGeometry args={[0.12, 8, 8]} />
        <meshStandardMaterial color="#9e9e9e" roughness={0.8} />
      </mesh>
      {/* 뿔 */}
      <mesh position={[-0.08, 0.72, 0]} rotation={[0, 0, 0.3]}>
        <coneGeometry args={[0.02, 0.08, 4]} />
        <meshStandardMaterial color="#424242" />
      </mesh>
      <mesh position={[0.08, 0.72, 0]} rotation={[0, 0, -0.3]}>
        <coneGeometry args={[0.02, 0.08, 4]} />
        <meshStandardMaterial color="#424242" />
      </mesh>
      {/* 날개 (돌) */}
      <mesh position={[-0.22, 0.44, -0.04]} rotation={[0.1, 0.2, 0.3]}>
        <boxGeometry args={[0.14, 0.16, 0.02]} />
        <meshStandardMaterial color="#757575" roughness={0.9} />
      </mesh>
      <mesh position={[0.22, 0.44, -0.04]} rotation={[0.1, -0.2, -0.3]}>
        <boxGeometry args={[0.14, 0.16, 0.02]} />
        <meshStandardMaterial color="#757575" roughness={0.9} />
      </mesh>
      {/* 눈 */}
      <mesh position={[-0.04, 0.62, 0.1]}>
        <sphereGeometry args={[0.025, 4, 4]} />
        <meshStandardMaterial color="#ff9100" emissive="#ff6d00" emissiveIntensity={0.8} />
      </mesh>
      <mesh position={[0.04, 0.62, 0.1]}>
        <sphereGeometry args={[0.025, 4, 4]} />
        <meshStandardMaterial color="#ff9100" emissive="#ff6d00" emissiveIntensity={0.8} />
      </mesh>
    </group>
  );
}

// ==================== 7. 용족 (Dragons) ====================

// 드래곤 해츨링 (Dragon Hatchling)
export function DragonHatchlingModel() {
  return (
    <group>
      <mesh position={[0, 0.14, 0]} scale={[0.9, 0.8, 1.1]}>
        <sphereGeometry args={[0.14, 8, 8]} />
        <meshStandardMaterial color="#4caf50" />
      </mesh>
      <mesh position={[0, 0.24, 0.12]}>
        <sphereGeometry args={[0.1, 8, 8]} />
        <meshStandardMaterial color="#66bb6a" />
      </mesh>
      {/* 작은 뿔 */}
      <mesh position={[-0.04, 0.34, 0.1]} rotation={[0.3, 0, -0.2]}>
        <coneGeometry args={[0.01, 0.04, 4]} />
        <meshStandardMaterial color="#2e7d32" />
      </mesh>
      <mesh position={[0.04, 0.34, 0.1]} rotation={[0.3, 0, 0.2]}>
        <coneGeometry args={[0.01, 0.04, 4]} />
        <meshStandardMaterial color="#2e7d32" />
      </mesh>
      {/* 작은 날개 */}
      <mesh position={[-0.14, 0.18, -0.02]} rotation={[0, 0, 0.4]} scale={[1, 0.05, 0.6]}>
        <boxGeometry args={[0.08, 0.02, 0.08]} />
        <meshStandardMaterial color="#81c784" />
      </mesh>
      <mesh position={[0.14, 0.18, -0.02]} rotation={[0, 0, -0.4]} scale={[1, 0.05, 0.6]}>
        <boxGeometry args={[0.08, 0.02, 0.08]} />
        <meshStandardMaterial color="#81c784" />
      </mesh>
      {/* 눈 */}
      <mesh position={[-0.04, 0.28, 0.2]}>
        <sphereGeometry args={[0.02, 4, 4]} />
        <meshStandardMaterial color="#ffd54f" emissive="#ffab00" emissiveIntensity={0.5} />
      </mesh>
      <mesh position={[0.04, 0.28, 0.2]}>
        <sphereGeometry args={[0.02, 4, 4]} />
        <meshStandardMaterial color="#ffd54f" emissive="#ffab00" emissiveIntensity={0.5} />
      </mesh>
      {/* 꼬리 */}
      <mesh position={[0, 0.1, -0.18]} rotation={[0.5, 0, 0]}>
        <coneGeometry args={[0.025, 0.14, 4]} />
        <meshStandardMaterial color="#4caf50" />
      </mesh>
      {/* 다리 */}
      {[[-0.06, 0, 0.04], [0.06, 0, 0.04], [-0.06, 0, -0.06], [0.06, 0, -0.06]].map((p, i) => (
        <mesh key={i} position={p}>
          <cylinderGeometry args={[0.02, 0.025, 0.1, 4]} />
          <meshStandardMaterial color="#388e3c" />
        </mesh>
      ))}
    </group>
  );
}

// 와이번 (Wyvern)
export function WyvernModel() {
  return (
    <group>
      <mesh position={[0, 0.2, 0]} scale={[0.9, 0.8, 1.3]}>
        <sphereGeometry args={[0.2, 8, 8]} />
        <meshStandardMaterial color="#5d4037" />
      </mesh>
      <mesh position={[0, 0.3, 0.2]}>
        <sphereGeometry args={[0.12, 8, 8]} />
        <meshStandardMaterial color="#6d4c41" />
      </mesh>
      {/* 주둥이 */}
      <mesh position={[0, 0.28, 0.32]} scale={[0.6, 0.5, 1]}>
        <coneGeometry args={[0.05, 0.1, 4]} />
        <meshStandardMaterial color="#795548" />
      </mesh>
      {/* 큰 날개 */}
      <mesh position={[-0.28, 0.28, -0.02]} rotation={[0, 0, 0.3]} scale={[1.5, 0.05, 1]}>
        <boxGeometry args={[0.18, 0.02, 0.18]} />
        <meshStandardMaterial color="#4e342e" transparent opacity={0.8} />
      </mesh>
      <mesh position={[0.28, 0.28, -0.02]} rotation={[0, 0, -0.3]} scale={[1.5, 0.05, 1]}>
        <boxGeometry args={[0.18, 0.02, 0.18]} />
        <meshStandardMaterial color="#4e342e" transparent opacity={0.8} />
      </mesh>
      {/* 눈 */}
      <mesh position={[-0.04, 0.34, 0.3]}>
        <sphereGeometry args={[0.02, 4, 4]} />
        <meshStandardMaterial color="#ff6f00" emissive="#e65100" emissiveIntensity={0.6} />
      </mesh>
      <mesh position={[0.04, 0.34, 0.3]}>
        <sphereGeometry args={[0.02, 4, 4]} />
        <meshStandardMaterial color="#ff6f00" emissive="#e65100" emissiveIntensity={0.6} />
      </mesh>
      {/* 꼬리 (독침) */}
      <mesh position={[0, 0.14, -0.28]} rotation={[0.6, 0, 0]}>
        <coneGeometry args={[0.03, 0.22, 4]} />
        <meshStandardMaterial color="#5d4037" />
      </mesh>
      <mesh position={[0, 0.08, -0.36]}>
        <coneGeometry args={[0.02, 0.06, 4]} />
        <meshStandardMaterial color="#c62828" />
      </mesh>
    </group>
  );
}

// 화룡 (Fire Dragon)
export function FireDragonModel() {
  return (
    <group>
      <mesh position={[0, 0.24, 0]} scale={[1, 0.9, 1.4]}>
        <sphereGeometry args={[0.26, 8, 8]} />
        <meshStandardMaterial color="#c62828" />
      </mesh>
      <mesh position={[0, 0.4, 0.28]}>
        <sphereGeometry args={[0.16, 8, 8]} />
        <meshStandardMaterial color="#d32f2f" />
      </mesh>
      {/* 뿔 */}
      <mesh position={[-0.1, 0.56, 0.24]} rotation={[0.3, 0, -0.3]}>
        <coneGeometry args={[0.025, 0.14, 4]} />
        <meshStandardMaterial color="#1a1a1a" />
      </mesh>
      <mesh position={[0.1, 0.56, 0.24]} rotation={[0.3, 0, 0.3]}>
        <coneGeometry args={[0.025, 0.14, 4]} />
        <meshStandardMaterial color="#1a1a1a" />
      </mesh>
      {/* 날개 */}
      <mesh position={[-0.34, 0.32, -0.04]} rotation={[0.1, 0, 0.25]}>
        <boxGeometry args={[0.24, 0.28, 0.01]} />
        <meshStandardMaterial color="#e53935" transparent opacity={0.75} />
      </mesh>
      <mesh position={[0.34, 0.32, -0.04]} rotation={[0.1, 0, -0.25]}>
        <boxGeometry args={[0.24, 0.28, 0.01]} />
        <meshStandardMaterial color="#e53935" transparent opacity={0.75} />
      </mesh>
      {/* 눈 */}
      <mesh position={[-0.06, 0.44, 0.4]}>
        <sphereGeometry args={[0.025, 4, 4]} />
        <meshStandardMaterial color="#ffab00" emissive="#ff6d00" emissiveIntensity={1.2} />
      </mesh>
      <mesh position={[0.06, 0.44, 0.4]}>
        <sphereGeometry args={[0.025, 4, 4]} />
        <meshStandardMaterial color="#ffab00" emissive="#ff6d00" emissiveIntensity={1.2} />
      </mesh>
      {/* 불꽃 입 */}
      <mesh position={[0, 0.36, 0.44]}>
        <coneGeometry args={[0.03, 0.08, 4]} />
        <meshStandardMaterial color="#ff6d00" emissive="#e65100" emissiveIntensity={0.8} />
      </mesh>
      {/* 다리 */}
      {[[-0.14, 0, 0.1], [0.14, 0, 0.1], [-0.14, 0, -0.12], [0.14, 0, -0.12]].map((p, i) => (
        <mesh key={i} position={p}>
          <cylinderGeometry args={[0.05, 0.06, 0.2, 4]} />
          <meshStandardMaterial color="#b71c1c" />
        </mesh>
      ))}
      <mesh position={[0, 0.3, 0]}>
        <sphereGeometry args={[0.42, 8, 8]} />
        <meshStandardMaterial color="#ff3d00" transparent opacity={0.08} />
      </mesh>
    </group>
  );
}

// 빙룡 (Ice Dragon)
export function IceDragonModel() {
  return (
    <group>
      <mesh position={[0, 0.24, 0]} scale={[1, 0.9, 1.4]}>
        <sphereGeometry args={[0.26, 8, 8]} />
        <meshStandardMaterial color="#0277bd" />
      </mesh>
      <mesh position={[0, 0.4, 0.28]}>
        <sphereGeometry args={[0.16, 8, 8]} />
        <meshStandardMaterial color="#0288d1" />
      </mesh>
      {/* 뿔 (얼음) */}
      <mesh position={[-0.1, 0.56, 0.24]} rotation={[0.3, 0, -0.3]}>
        <coneGeometry args={[0.025, 0.14, 4]} />
        <meshStandardMaterial color="#b3e5fc" transparent opacity={0.8} />
      </mesh>
      <mesh position={[0.1, 0.56, 0.24]} rotation={[0.3, 0, 0.3]}>
        <coneGeometry args={[0.025, 0.14, 4]} />
        <meshStandardMaterial color="#b3e5fc" transparent opacity={0.8} />
      </mesh>
      {/* 날개 */}
      <mesh position={[-0.34, 0.32, -0.04]} rotation={[0.1, 0, 0.25]}>
        <boxGeometry args={[0.24, 0.28, 0.01]} />
        <meshStandardMaterial color="#4fc3f7" transparent opacity={0.6} />
      </mesh>
      <mesh position={[0.34, 0.32, -0.04]} rotation={[0.1, 0, -0.25]}>
        <boxGeometry args={[0.24, 0.28, 0.01]} />
        <meshStandardMaterial color="#4fc3f7" transparent opacity={0.6} />
      </mesh>
      {/* 눈 */}
      <mesh position={[-0.06, 0.44, 0.4]}>
        <sphereGeometry args={[0.025, 4, 4]} />
        <meshStandardMaterial color="#e1f5fe" emissive="#e1f5fe" emissiveIntensity={1} />
      </mesh>
      <mesh position={[0.06, 0.44, 0.4]}>
        <sphereGeometry args={[0.025, 4, 4]} />
        <meshStandardMaterial color="#e1f5fe" emissive="#e1f5fe" emissiveIntensity={1} />
      </mesh>
      {/* 다리 */}
      {[[-0.14, 0, 0.1], [0.14, 0, 0.1], [-0.14, 0, -0.12], [0.14, 0, -0.12]].map((p, i) => (
        <mesh key={i} position={p}>
          <cylinderGeometry args={[0.05, 0.06, 0.2, 4]} />
          <meshStandardMaterial color="#01579b" />
        </mesh>
      ))}
      <mesh position={[0, 0.3, 0]}>
        <sphereGeometry args={[0.42, 8, 8]} />
        <meshStandardMaterial color="#29b6f6" transparent opacity={0.08} />
      </mesh>
    </group>
  );
}

// 암흑룡 (Dark Dragon)
export function DarkDragonModel() {
  return (
    <group>
      <mesh position={[0, 0.24, 0]} scale={[1, 0.9, 1.4]}>
        <sphereGeometry args={[0.26, 8, 8]} />
        <meshStandardMaterial color="#1a1a1a" />
      </mesh>
      <mesh position={[0, 0.4, 0.28]}>
        <sphereGeometry args={[0.16, 8, 8]} />
        <meshStandardMaterial color="#212121" />
      </mesh>
      {/* 뿔 */}
      <mesh position={[-0.1, 0.56, 0.24]} rotation={[0.3, 0, -0.3]}>
        <coneGeometry args={[0.025, 0.16, 4]} />
        <meshStandardMaterial color="#4a148c" />
      </mesh>
      <mesh position={[0.1, 0.56, 0.24]} rotation={[0.3, 0, 0.3]}>
        <coneGeometry args={[0.025, 0.16, 4]} />
        <meshStandardMaterial color="#4a148c" />
      </mesh>
      {/* 날개 */}
      <mesh position={[-0.34, 0.32, -0.04]} rotation={[0.1, 0, 0.25]}>
        <boxGeometry args={[0.24, 0.3, 0.01]} />
        <meshStandardMaterial color="#311b92" transparent opacity={0.75} />
      </mesh>
      <mesh position={[0.34, 0.32, -0.04]} rotation={[0.1, 0, -0.25]}>
        <boxGeometry args={[0.24, 0.3, 0.01]} />
        <meshStandardMaterial color="#311b92" transparent opacity={0.75} />
      </mesh>
      {/* 눈 */}
      <mesh position={[-0.06, 0.44, 0.4]}>
        <sphereGeometry args={[0.025, 4, 4]} />
        <meshStandardMaterial color="#d500f9" emissive="#aa00ff" emissiveIntensity={1.5} />
      </mesh>
      <mesh position={[0.06, 0.44, 0.4]}>
        <sphereGeometry args={[0.025, 4, 4]} />
        <meshStandardMaterial color="#d500f9" emissive="#aa00ff" emissiveIntensity={1.5} />
      </mesh>
      {/* 다리 */}
      {[[-0.14, 0, 0.1], [0.14, 0, 0.1], [-0.14, 0, -0.12], [0.14, 0, -0.12]].map((p, i) => (
        <mesh key={i} position={p}>
          <cylinderGeometry args={[0.05, 0.06, 0.2, 4]} />
          <meshStandardMaterial color="#111" />
        </mesh>
      ))}
      <mesh position={[0, 0.3, 0]}>
        <sphereGeometry args={[0.42, 8, 8]} />
        <meshStandardMaterial color="#7c4dff" transparent opacity={0.1} />
      </mesh>
    </group>
  );
}

// 용왕 (Dragon King)
export function DragonKingModel() {
  return (
    <group>
      <mesh position={[0, 0.28, 0]} scale={[1.1, 0.95, 1.5]}>
        <sphereGeometry args={[0.28, 8, 8]} />
        <meshStandardMaterial color="#f9a825" metalness={0.3} />
      </mesh>
      <mesh position={[0, 0.46, 0.3]}>
        <sphereGeometry args={[0.18, 8, 8]} />
        <meshStandardMaterial color="#fbc02d" />
      </mesh>
      {/* 왕관뿔 */}
      {[-0.12, -0.04, 0.04, 0.12].map((x, i) => (
        <mesh key={i} position={[x, 0.64, 0.26]} rotation={[0.3, 0, x * 1.5]}>
          <coneGeometry args={[0.02, 0.12, 4]} />
          <meshStandardMaterial color="#ffd54f" metalness={0.7} />
        </mesh>
      ))}
      {/* 거대 날개 */}
      <mesh position={[-0.38, 0.36, -0.06]} rotation={[0.1, 0, 0.2]}>
        <boxGeometry args={[0.28, 0.34, 0.01]} />
        <meshStandardMaterial color="#ff8f00" transparent opacity={0.7} />
      </mesh>
      <mesh position={[0.38, 0.36, -0.06]} rotation={[0.1, 0, -0.2]}>
        <boxGeometry args={[0.28, 0.34, 0.01]} />
        <meshStandardMaterial color="#ff8f00" transparent opacity={0.7} />
      </mesh>
      {/* 눈 */}
      <mesh position={[-0.07, 0.5, 0.44]}>
        <sphereGeometry args={[0.03, 4, 4]} />
        <meshStandardMaterial color="#fff" emissive="#ffd54f" emissiveIntensity={1.5} />
      </mesh>
      <mesh position={[0.07, 0.5, 0.44]}>
        <sphereGeometry args={[0.03, 4, 4]} />
        <meshStandardMaterial color="#fff" emissive="#ffd54f" emissiveIntensity={1.5} />
      </mesh>
      {/* 수염 */}
      <mesh position={[-0.08, 0.4, 0.42]} rotation={[0.8, 0, -0.3]}>
        <cylinderGeometry args={[0.006, 0.006, 0.16, 3]} />
        <meshStandardMaterial color="#fff9c4" />
      </mesh>
      <mesh position={[0.08, 0.4, 0.42]} rotation={[0.8, 0, 0.3]}>
        <cylinderGeometry args={[0.006, 0.006, 0.16, 3]} />
        <meshStandardMaterial color="#fff9c4" />
      </mesh>
      {/* 다리 */}
      {[[-0.16, 0, 0.12], [0.16, 0, 0.12], [-0.16, 0, -0.14], [0.16, 0, -0.14]].map((p, i) => (
        <mesh key={i} position={p}>
          <cylinderGeometry args={[0.06, 0.07, 0.24, 4]} />
          <meshStandardMaterial color="#f57f17" />
        </mesh>
      ))}
      <mesh position={[0, 0.34, 0]}>
        <sphereGeometry args={[0.48, 8, 8]} />
        <meshStandardMaterial color="#ffd54f" transparent opacity={0.1} />
      </mesh>
    </group>
  );
}

// 드레이크 (Drake)
export function DrakeModel() {
  return (
    <group>
      <mesh position={[0, 0.2, 0]} scale={[0.9, 0.8, 1.4]}>
        <sphereGeometry args={[0.22, 8, 8]} />
        <meshStandardMaterial color="#33691e" />
      </mesh>
      <mesh position={[0, 0.3, 0.24]}>
        <sphereGeometry args={[0.14, 8, 8]} />
        <meshStandardMaterial color="#558b2f" />
      </mesh>
      {/* 등 돌기 */}
      {[-0.05, 0.02, 0.09].map((z, i) => (
        <mesh key={i} position={[0, 0.34, z]}>
          <coneGeometry args={[0.025, 0.08, 4]} />
          <meshStandardMaterial color="#1b5e20" />
        </mesh>
      ))}
      {/* 눈 */}
      <mesh position={[-0.05, 0.34, 0.36]}>
        <sphereGeometry args={[0.02, 4, 4]} />
        <meshStandardMaterial color="#ff6f00" emissive="#e65100" emissiveIntensity={0.5} />
      </mesh>
      <mesh position={[0.05, 0.34, 0.36]}>
        <sphereGeometry args={[0.02, 4, 4]} />
        <meshStandardMaterial color="#ff6f00" emissive="#e65100" emissiveIntensity={0.5} />
      </mesh>
      {/* 다리 */}
      {[[-0.1, 0, 0.1], [0.1, 0, 0.1], [-0.1, 0, -0.1], [0.1, 0, -0.1]].map((p, i) => (
        <mesh key={i} position={p}>
          <cylinderGeometry args={[0.04, 0.05, 0.18, 4]} />
          <meshStandardMaterial color="#2e7d32" />
        </mesh>
      ))}
      {/* 꼬리 */}
      <mesh position={[0, 0.14, -0.3]} rotation={[0.5, 0, 0]}>
        <coneGeometry args={[0.04, 0.22, 4]} />
        <meshStandardMaterial color="#33691e" />
      </mesh>
    </group>
  );
}

// 히드라 (Hydra)
export function HydraModel() {
  return (
    <group>
      <mesh position={[0, 0.22, 0]} scale={[1.1, 0.9, 1.2]}>
        <sphereGeometry args={[0.26, 8, 8]} />
        <meshStandardMaterial color="#1b5e20" />
      </mesh>
      {/* 5개 머리 */}
      {[[-0.16, 0.5, 0.18], [-0.08, 0.56, 0.22], [0, 0.6, 0.24], [0.08, 0.56, 0.22], [0.16, 0.5, 0.18]].map((p, i) => (
        <group key={i}>
          {/* 목 */}
          <mesh position={[p[0] * 0.6, 0.36, p[2] * 0.5]} rotation={[-0.4, 0, p[0] * 2]}>
            <cylinderGeometry args={[0.03, 0.04, 0.2, 4]} />
            <meshStandardMaterial color="#2e7d32" />
          </mesh>
          {/* 머리 */}
          <mesh position={p}>
            <sphereGeometry args={[0.07, 6, 6]} />
            <meshStandardMaterial color="#388e3c" />
          </mesh>
          {/* 눈 */}
          <mesh position={[p[0] - 0.02, p[1] + 0.02, p[2] + 0.06]}>
            <sphereGeometry args={[0.012, 4, 4]} />
            <meshStandardMaterial color="#ff6f00" emissive="#e65100" emissiveIntensity={0.8} />
          </mesh>
          <mesh position={[p[0] + 0.02, p[1] + 0.02, p[2] + 0.06]}>
            <sphereGeometry args={[0.012, 4, 4]} />
            <meshStandardMaterial color="#ff6f00" emissive="#e65100" emissiveIntensity={0.8} />
          </mesh>
        </group>
      ))}
      {/* 다리 */}
      {[[-0.14, 0, 0.08], [0.14, 0, 0.08], [-0.14, 0, -0.12], [0.14, 0, -0.12]].map((p, i) => (
        <mesh key={i} position={p}>
          <cylinderGeometry args={[0.05, 0.06, 0.2, 4]} />
          <meshStandardMaterial color="#1b5e20" />
        </mesh>
      ))}
      <mesh position={[0, 0.28, 0]}>
        <sphereGeometry args={[0.4, 8, 8]} />
        <meshStandardMaterial color="#76ff03" transparent opacity={0.06} />
      </mesh>
    </group>
  );
}

// ==================== 8. 마법생물 (Magic Creatures) ====================

// 마법 갑옷 (Magic Armor)
export function MagicArmorModel() {
  return (
    <group>
      <mesh position={[-0.07, 0.14, 0]}>
        <cylinderGeometry args={[0.05, 0.055, 0.28, 4]} />
        <meshStandardMaterial color="#455a64" metalness={0.7} roughness={0.3} />
      </mesh>
      <mesh position={[0.07, 0.14, 0]}>
        <cylinderGeometry args={[0.05, 0.055, 0.28, 4]} />
        <meshStandardMaterial color="#455a64" metalness={0.7} roughness={0.3} />
      </mesh>
      <mesh position={[0, 0.42, 0]}>
        <boxGeometry args={[0.28, 0.28, 0.18]} />
        <meshStandardMaterial color="#546e7a" metalness={0.7} roughness={0.3} />
      </mesh>
      <mesh position={[-0.2, 0.52, 0]}>
        <boxGeometry args={[0.1, 0.08, 0.14]} />
        <meshStandardMaterial color="#607d8b" metalness={0.7} />
      </mesh>
      <mesh position={[0.2, 0.52, 0]}>
        <boxGeometry args={[0.1, 0.08, 0.14]} />
        <meshStandardMaterial color="#607d8b" metalness={0.7} />
      </mesh>
      {/* 투구 (빈) */}
      <mesh position={[0, 0.64, 0]}>
        <sphereGeometry args={[0.13, 8, 8]} />
        <meshStandardMaterial color="#37474f" metalness={0.7} />
      </mesh>
      {/* 마법 눈 */}
      <mesh position={[0, 0.66, 0.12]}>
        <sphereGeometry args={[0.04, 6, 6]} />
        <meshStandardMaterial color="#7c4dff" emissive="#651fff" emissiveIntensity={1} />
      </mesh>
      {/* 검 */}
      <mesh position={[0.24, 0.36, 0]}>
        <boxGeometry args={[0.035, 0.4, 0.02]} />
        <meshStandardMaterial color="#90a4ae" metalness={0.8} roughness={0.2} />
      </mesh>
      {/* 방패 */}
      <mesh position={[-0.22, 0.38, 0.06]}>
        <boxGeometry args={[0.04, 0.18, 0.14]} />
        <meshStandardMaterial color="#455a64" metalness={0.6} />
      </mesh>
      <mesh position={[0, 0.4, 0]}>
        <sphereGeometry args={[0.32, 8, 8]} />
        <meshStandardMaterial color="#7c4dff" transparent opacity={0.06} />
      </mesh>
    </group>
  );
}

// 가디언 (Guardian)
export function GuardianModel() {
  return (
    <group>
      <mesh position={[0, 0.22, 0]}>
        <boxGeometry args={[0.36, 0.4, 0.3]} />
        <meshStandardMaterial color="#78909c" roughness={0.8} metalness={0.4} />
      </mesh>
      <mesh position={[0, 0.5, 0]}>
        <boxGeometry args={[0.42, 0.22, 0.32]} />
        <meshStandardMaterial color="#607d8b" roughness={0.8} metalness={0.4} />
      </mesh>
      <mesh position={[0, 0.68, 0]}>
        <boxGeometry args={[0.26, 0.18, 0.22]} />
        <meshStandardMaterial color="#546e7a" roughness={0.8} metalness={0.4} />
      </mesh>
      {/* 눈 (삼각형 슬릿) */}
      <mesh position={[-0.06, 0.7, 0.12]}>
        <boxGeometry args={[0.05, 0.02, 0.02]} />
        <meshStandardMaterial color="#00e5ff" emissive="#00b8d4" emissiveIntensity={1.2} />
      </mesh>
      <mesh position={[0.06, 0.7, 0.12]}>
        <boxGeometry args={[0.05, 0.02, 0.02]} />
        <meshStandardMaterial color="#00e5ff" emissive="#00b8d4" emissiveIntensity={1.2} />
      </mesh>
      {/* 팔 */}
      <mesh position={[-0.3, 0.4, 0]}>
        <boxGeometry args={[0.14, 0.32, 0.14]} />
        <meshStandardMaterial color="#78909c" roughness={0.8} metalness={0.4} />
      </mesh>
      <mesh position={[0.3, 0.4, 0]}>
        <boxGeometry args={[0.14, 0.32, 0.14]} />
        <meshStandardMaterial color="#78909c" roughness={0.8} metalness={0.4} />
      </mesh>
      {/* 문양 */}
      <mesh position={[0, 0.44, 0.17]}>
        <boxGeometry args={[0.08, 0.08, 0.01]} />
        <meshStandardMaterial color="#00e5ff" emissive="#00b8d4" emissiveIntensity={0.5} />
      </mesh>
    </group>
  );
}

// 호문쿨루스 (Homunculus)
export function HomunculusModel() {
  return (
    <group>
      <mesh position={[0, 0.1, 0]}>
        <sphereGeometry args={[0.1, 8, 8]} />
        <meshStandardMaterial color="#e8eaf6" />
      </mesh>
      <mesh position={[0, 0.24, 0]}>
        <sphereGeometry args={[0.14, 8, 8]} />
        <meshStandardMaterial color="#c5cae9" transparent opacity={0.8} />
      </mesh>
      {/* 큰 눈 */}
      <mesh position={[-0.06, 0.28, 0.1]}>
        <sphereGeometry args={[0.04, 6, 6]} />
        <meshStandardMaterial color="#e8eaf6" />
      </mesh>
      <mesh position={[0.06, 0.28, 0.1]}>
        <sphereGeometry args={[0.04, 6, 6]} />
        <meshStandardMaterial color="#e8eaf6" />
      </mesh>
      <mesh position={[-0.06, 0.28, 0.13]}>
        <sphereGeometry args={[0.02, 4, 4]} />
        <meshStandardMaterial color="#7c4dff" emissive="#651fff" emissiveIntensity={0.6} />
      </mesh>
      <mesh position={[0.06, 0.28, 0.13]}>
        <sphereGeometry args={[0.02, 4, 4]} />
        <meshStandardMaterial color="#7c4dff" emissive="#651fff" emissiveIntensity={0.6} />
      </mesh>
      {/* 작은 팔 */}
      <mesh position={[-0.12, 0.2, 0.04]} rotation={[0, 0, 0.6]}>
        <capsuleGeometry args={[0.015, 0.06, 3, 4]} />
        <meshStandardMaterial color="#c5cae9" />
      </mesh>
      <mesh position={[0.12, 0.2, 0.04]} rotation={[0, 0, -0.6]}>
        <capsuleGeometry args={[0.015, 0.06, 3, 4]} />
        <meshStandardMaterial color="#c5cae9" />
      </mesh>
      <mesh position={[0, 0.2, 0]}>
        <sphereGeometry args={[0.22, 8, 8]} />
        <meshStandardMaterial color="#7c4dff" transparent opacity={0.06} />
      </mesh>
    </group>
  );
}

// 마나 골렘 (Mana Golem)
export function ManaGolemModel() {
  return (
    <group>
      <mesh position={[0, 0.2, 0]}>
        <boxGeometry args={[0.36, 0.35, 0.32]} />
        <meshStandardMaterial color="#1a237e" roughness={0.7} />
      </mesh>
      <mesh position={[0, 0.46, 0]}>
        <boxGeometry args={[0.42, 0.22, 0.34]} />
        <meshStandardMaterial color="#283593" roughness={0.7} />
      </mesh>
      <mesh position={[0, 0.64, 0]}>
        <boxGeometry args={[0.24, 0.18, 0.2]} />
        <meshStandardMaterial color="#3949ab" roughness={0.7} />
      </mesh>
      {/* 마나 코어 */}
      <mesh position={[0, 0.4, 0.18]}>
        <octahedronGeometry args={[0.06, 0]} />
        <meshStandardMaterial color="#7c4dff" emissive="#651fff" emissiveIntensity={1} />
      </mesh>
      {/* 눈 */}
      <mesh position={[-0.06, 0.66, 0.11]}>
        <boxGeometry args={[0.04, 0.03, 0.02]} />
        <meshStandardMaterial color="#b388ff" emissive="#7c4dff" emissiveIntensity={1} />
      </mesh>
      <mesh position={[0.06, 0.66, 0.11]}>
        <boxGeometry args={[0.04, 0.03, 0.02]} />
        <meshStandardMaterial color="#b388ff" emissive="#7c4dff" emissiveIntensity={1} />
      </mesh>
      {/* 팔 */}
      <mesh position={[-0.3, 0.36, 0]}>
        <boxGeometry args={[0.14, 0.3, 0.14]} />
        <meshStandardMaterial color="#1a237e" roughness={0.7} />
      </mesh>
      <mesh position={[0.3, 0.36, 0]}>
        <boxGeometry args={[0.14, 0.3, 0.14]} />
        <meshStandardMaterial color="#1a237e" roughness={0.7} />
      </mesh>
      {/* 마나 룬 */}
      {[[0.14, 0.3, 0.17], [-0.12, 0.44, 0.18]].map((p, i) => (
        <mesh key={i} position={p}>
          <boxGeometry args={[0.04, 0.04, 0.01]} />
          <meshStandardMaterial color="#b388ff" emissive="#7c4dff" emissiveIntensity={0.6} />
        </mesh>
      ))}
      <mesh position={[0, 0.38, 0]}>
        <sphereGeometry args={[0.38, 8, 8]} />
        <meshStandardMaterial color="#7c4dff" transparent opacity={0.08} />
      </mesh>
    </group>
  );
}

// 유니콘 (Unicorn)
export function UnicornModel() {
  return (
    <group>
      <mesh position={[0, 0.22, 0]} scale={[0.8, 0.8, 1.4]}>
        <sphereGeometry args={[0.2, 8, 8]} />
        <meshStandardMaterial color="#f5f5f5" />
      </mesh>
      <mesh position={[0, 0.34, 0.24]}>
        <sphereGeometry args={[0.12, 8, 8]} />
        <meshStandardMaterial color="#fafafa" />
      </mesh>
      {/* 뿔 (빛나는) */}
      <mesh position={[0, 0.52, 0.26]} rotation={[0.5, 0, 0]}>
        <coneGeometry args={[0.025, 0.18, 6]} />
        <meshStandardMaterial color="#ffd54f" emissive="#ffab00" emissiveIntensity={0.8} metalness={0.5} />
      </mesh>
      {/* 갈기 */}
      <mesh position={[0, 0.38, 0.08]}>
        <boxGeometry args={[0.04, 0.12, 0.16]} />
        <meshStandardMaterial color="#e1bee7" />
      </mesh>
      {/* 눈 */}
      <mesh position={[-0.04, 0.38, 0.34]}>
        <sphereGeometry args={[0.02, 4, 4]} />
        <meshStandardMaterial color="#7c4dff" emissive="#651fff" emissiveIntensity={0.5} />
      </mesh>
      <mesh position={[0.04, 0.38, 0.34]}>
        <sphereGeometry args={[0.02, 4, 4]} />
        <meshStandardMaterial color="#7c4dff" emissive="#651fff" emissiveIntensity={0.5} />
      </mesh>
      {/* 다리 */}
      {[[-0.08, 0, 0.1], [0.08, 0, 0.1], [-0.08, 0, -0.1], [0.08, 0, -0.1]].map((p, i) => (
        <mesh key={i} position={p}>
          <cylinderGeometry args={[0.025, 0.03, 0.2, 4]} />
          <meshStandardMaterial color="#e0e0e0" />
        </mesh>
      ))}
      {/* 꼬리 */}
      <mesh position={[0, 0.2, -0.28]} rotation={[0.6, 0, 0]}>
        <capsuleGeometry args={[0.02, 0.14, 3, 4]} />
        <meshStandardMaterial color="#ce93d8" />
      </mesh>
      <mesh position={[0, 0.28, 0]}>
        <sphereGeometry args={[0.32, 8, 8]} />
        <meshStandardMaterial color="#ffd54f" transparent opacity={0.06} />
      </mesh>
    </group>
  );
}

// 그리핀 (Griffin)
export function GriffinModel() {
  return (
    <group>
      <mesh position={[0, 0.22, 0]} scale={[1, 0.85, 1.3]}>
        <sphereGeometry args={[0.22, 8, 8]} />
        <meshStandardMaterial color="#8d6e63" />
      </mesh>
      <mesh position={[0, 0.34, 0.22]}>
        <sphereGeometry args={[0.13, 8, 8]} />
        <meshStandardMaterial color="#ffd54f" />
      </mesh>
      {/* 부리 */}
      <mesh position={[0, 0.32, 0.34]} rotation={[-0.3, 0, 0]}>
        <coneGeometry args={[0.04, 0.1, 4]} />
        <meshStandardMaterial color="#ff8f00" />
      </mesh>
      {/* 독수리 날개 */}
      <mesh position={[-0.3, 0.3, -0.02]} rotation={[0.1, 0, 0.3]}>
        <boxGeometry args={[0.22, 0.24, 0.01]} />
        <meshStandardMaterial color="#5d4037" />
      </mesh>
      <mesh position={[0.3, 0.3, -0.02]} rotation={[0.1, 0, -0.3]}>
        <boxGeometry args={[0.22, 0.24, 0.01]} />
        <meshStandardMaterial color="#5d4037" />
      </mesh>
      {/* 눈 */}
      <mesh position={[-0.05, 0.38, 0.32]}>
        <sphereGeometry args={[0.02, 4, 4]} />
        <meshStandardMaterial color="#ff6f00" emissive="#e65100" emissiveIntensity={0.5} />
      </mesh>
      <mesh position={[0.05, 0.38, 0.32]}>
        <sphereGeometry args={[0.02, 4, 4]} />
        <meshStandardMaterial color="#ff6f00" emissive="#e65100" emissiveIntensity={0.5} />
      </mesh>
      {/* 사자 뒷다리 */}
      {[[-0.1, 0, -0.1], [0.1, 0, -0.1]].map((p, i) => (
        <mesh key={i} position={p}>
          <cylinderGeometry args={[0.04, 0.05, 0.2, 4]} />
          <meshStandardMaterial color="#8d6e63" />
        </mesh>
      ))}
      {/* 독수리 앞다리 */}
      {[[-0.1, 0, 0.1], [0.1, 0, 0.1]].map((p, i) => (
        <mesh key={i} position={p}>
          <cylinderGeometry args={[0.03, 0.04, 0.2, 4]} />
          <meshStandardMaterial color="#ffc107" />
        </mesh>
      ))}
    </group>
  );
}

// 피닉스 (Phoenix)
export function PhoenixModel() {
  return (
    <group>
      <mesh position={[0, 0.22, 0]} scale={[0.8, 0.8, 1.1]}>
        <sphereGeometry args={[0.16, 8, 8]} />
        <meshStandardMaterial color="#ff6d00" emissive="#e65100" emissiveIntensity={0.3} />
      </mesh>
      <mesh position={[0, 0.36, 0.12]}>
        <sphereGeometry args={[0.1, 8, 8]} />
        <meshStandardMaterial color="#ff9100" emissive="#ff6d00" emissiveIntensity={0.4} />
      </mesh>
      {/* 부리 */}
      <mesh position={[0, 0.34, 0.22]} rotation={[-0.3, 0, 0]}>
        <coneGeometry args={[0.025, 0.06, 4]} />
        <meshStandardMaterial color="#ffd54f" />
      </mesh>
      {/* 불꽃 날개 */}
      <mesh position={[-0.26, 0.28, 0]} rotation={[0, 0, 0.35]}>
        <boxGeometry args={[0.2, 0.22, 0.01]} />
        <meshStandardMaterial color="#ff3d00" emissive="#dd2c00" emissiveIntensity={0.5} transparent opacity={0.8} />
      </mesh>
      <mesh position={[0.26, 0.28, 0]} rotation={[0, 0, -0.35]}>
        <boxGeometry args={[0.2, 0.22, 0.01]} />
        <meshStandardMaterial color="#ff3d00" emissive="#dd2c00" emissiveIntensity={0.5} transparent opacity={0.8} />
      </mesh>
      {/* 불꽃 꼬리 */}
      {[-0.04, 0, 0.04].map((x, i) => (
        <mesh key={i} position={[x, 0.16, -0.2]} rotation={[0.4 + i * 0.1, 0, 0]}>
          <coneGeometry args={[0.02, 0.18, 4]} />
          <meshStandardMaterial color="#ffab00" emissive="#ff6d00" emissiveIntensity={0.6} transparent opacity={0.8} />
        </mesh>
      ))}
      {/* 눈 */}
      <mesh position={[-0.04, 0.4, 0.2]}>
        <sphereGeometry args={[0.02, 4, 4]} />
        <meshStandardMaterial color="#fff9c4" emissive="#fff176" emissiveIntensity={1} />
      </mesh>
      <mesh position={[0.04, 0.4, 0.2]}>
        <sphereGeometry args={[0.02, 4, 4]} />
        <meshStandardMaterial color="#fff9c4" emissive="#fff176" emissiveIntensity={1} />
      </mesh>
      {/* 불꽃 오라 */}
      <mesh position={[0, 0.26, 0]}>
        <sphereGeometry args={[0.34, 8, 8]} />
        <meshStandardMaterial color="#ff6d00" transparent opacity={0.12} />
      </mesh>
    </group>
  );
}

// 미믹 (Mimic)
export function MimicModel() {
  return (
    <group>
      {/* 상자 하단 */}
      <mesh position={[0, 0.1, 0]}>
        <boxGeometry args={[0.3, 0.18, 0.24]} />
        <meshStandardMaterial color="#5d4037" />
      </mesh>
      {/* 상자 뚜껑 (열린) */}
      <mesh position={[0, 0.22, -0.08]} rotation={[-0.5, 0, 0]}>
        <boxGeometry args={[0.3, 0.04, 0.24]} />
        <meshStandardMaterial color="#6d4c41" />
      </mesh>
      {/* 금속 장식 */}
      <mesh position={[0, 0.1, 0.13]}>
        <boxGeometry args={[0.08, 0.06, 0.01]} />
        <meshStandardMaterial color="#ffd54f" metalness={0.7} />
      </mesh>
      {/* 이빨 (뚜껑과 하단 사이) */}
      {[-0.1, -0.05, 0, 0.05, 0.1].map((x, i) => (
        <mesh key={i} position={[x, 0.2, 0.1]}>
          <coneGeometry args={[0.012, 0.04, 3]} />
          <meshStandardMaterial color="#fff8e1" />
        </mesh>
      ))}
      {/* 혀 */}
      <mesh position={[0, 0.14, 0.2]} rotation={[-0.5, 0, 0]}>
        <boxGeometry args={[0.06, 0.01, 0.1]} />
        <meshStandardMaterial color="#e91e63" />
      </mesh>
      {/* 눈 */}
      <mesh position={[-0.06, 0.22, 0.1]}>
        <sphereGeometry args={[0.025, 4, 4]} />
        <meshStandardMaterial color="#ffd54f" emissive="#ffab00" emissiveIntensity={0.6} />
      </mesh>
      <mesh position={[0.06, 0.22, 0.1]}>
        <sphereGeometry args={[0.025, 4, 4]} />
        <meshStandardMaterial color="#ffd54f" emissive="#ffab00" emissiveIntensity={0.6} />
      </mesh>
    </group>
  );
}

// ==================== 9. 식물/균류 (Plants) ====================

export function PoisonMushroomModel() {
  return (
    <group>
      <mesh position={[0, 0.06, 0]}>
        <cylinderGeometry args={[0.06, 0.08, 0.12, 6]} />
        <meshStandardMaterial color="#e0e0e0" />
      </mesh>
      <mesh position={[0, 0.18, 0]}>
        <sphereGeometry args={[0.16, 8, 6]} />
        <meshStandardMaterial color="#c62828" />
      </mesh>
      {/* 점 */}
      {[[-0.06, 0.24, 0.1], [0.08, 0.22, 0.08], [0, 0.28, 0.04], [-0.04, 0.2, -0.1]].map((p, i) => (
        <mesh key={i} position={p}>
          <sphereGeometry args={[0.025, 4, 4]} />
          <meshStandardMaterial color="#fff" />
        </mesh>
      ))}
      <mesh position={[-0.04, 0.14, 0.12]}>
        <sphereGeometry args={[0.015, 4, 4]} />
        <meshStandardMaterial color="#111" />
      </mesh>
      <mesh position={[0.04, 0.14, 0.12]}>
        <sphereGeometry args={[0.015, 4, 4]} />
        <meshStandardMaterial color="#111" />
      </mesh>
      <mesh position={[0, 0.15, 0]}>
        <sphereGeometry args={[0.22, 8, 8]} />
        <meshStandardMaterial color="#76ff03" transparent opacity={0.06} />
      </mesh>
    </group>
  );
}

export function VineMonsterModel() {
  return (
    <group>
      <mesh position={[0, 0.18, 0]}>
        <cylinderGeometry args={[0.1, 0.18, 0.35, 6]} />
        <meshStandardMaterial color="#33691e" />
      </mesh>
      {/* 덩굴 촉수 */}
      {[[-0.2, 0.28, 0.1, -0.6], [0.2, 0.28, 0.1, 0.6], [-0.18, 0.22, -0.08, -0.4], [0.18, 0.22, -0.08, 0.4]].map(([x, y, z, r], i) => (
        <mesh key={i} position={[x, y, z]} rotation={[0.3, 0, r]}>
          <cylinderGeometry args={[0.015, 0.025, 0.22, 4]} />
          <meshStandardMaterial color="#2e7d32" />
        </mesh>
      ))}
      {/* 꽃봉오리 머리 */}
      <mesh position={[0, 0.4, 0.04]}>
        <sphereGeometry args={[0.1, 8, 8]} />
        <meshStandardMaterial color="#4caf50" />
      </mesh>
      <mesh position={[-0.04, 0.42, 0.1]}>
        <sphereGeometry args={[0.02, 4, 4]} />
        <meshStandardMaterial color="#f44336" emissive="#d32f2f" emissiveIntensity={0.4} />
      </mesh>
      <mesh position={[0.04, 0.42, 0.1]}>
        <sphereGeometry args={[0.02, 4, 4]} />
        <meshStandardMaterial color="#f44336" emissive="#d32f2f" emissiveIntensity={0.4} />
      </mesh>
    </group>
  );
}

export function TreantModel() {
  return (
    <group>
      <mesh position={[0, 0.24, 0]}>
        <cylinderGeometry args={[0.16, 0.22, 0.48, 6]} />
        <meshStandardMaterial color="#5d4037" roughness={0.9} />
      </mesh>
      <mesh position={[0, 0.56, 0]}>
        <sphereGeometry args={[0.2, 8, 8]} />
        <meshStandardMaterial color="#2e7d32" />
      </mesh>
      {/* 나뭇가지 팔 */}
      <mesh position={[-0.24, 0.4, 0]} rotation={[0, 0, 0.5]}>
        <cylinderGeometry args={[0.03, 0.05, 0.25, 4]} />
        <meshStandardMaterial color="#4e342e" roughness={0.9} />
      </mesh>
      <mesh position={[0.24, 0.4, 0]} rotation={[0, 0, -0.5]}>
        <cylinderGeometry args={[0.03, 0.05, 0.25, 4]} />
        <meshStandardMaterial color="#4e342e" roughness={0.9} />
      </mesh>
      {/* 눈 */}
      <mesh position={[-0.06, 0.38, 0.14]}>
        <sphereGeometry args={[0.025, 4, 4]} />
        <meshStandardMaterial color="#8bc34a" emissive="#689f38" emissiveIntensity={0.5} />
      </mesh>
      <mesh position={[0.06, 0.38, 0.14]}>
        <sphereGeometry args={[0.025, 4, 4]} />
        <meshStandardMaterial color="#8bc34a" emissive="#689f38" emissiveIntensity={0.5} />
      </mesh>
      {/* 수관 이파리 */}
      {[[-0.1, 0.68, 0.06], [0.1, 0.66, -0.04], [0, 0.72, 0], [-0.06, 0.64, -0.08]].map((p, i) => (
        <mesh key={i} position={p}>
          <sphereGeometry args={[0.08, 6, 6]} />
          <meshStandardMaterial color="#43a047" />
        </mesh>
      ))}
    </group>
  );
}

export function CarnivorousPlantModel() {
  return (
    <group>
      <mesh position={[0, 0.12, 0]}>
        <cylinderGeometry args={[0.06, 0.12, 0.22, 6]} />
        <meshStandardMaterial color="#2e7d32" />
      </mesh>
      {/* 입 (벌린) 하단 */}
      <mesh position={[0, 0.28, 0.04]} rotation={[0.3, 0, 0]} scale={[1, 0.5, 1]}>
        <sphereGeometry args={[0.14, 8, 6]} />
        <meshStandardMaterial color="#4caf50" />
      </mesh>
      {/* 입 상단 */}
      <mesh position={[0, 0.36, 0.04]} rotation={[-0.3, 0, 0]} scale={[1, 0.5, 1]}>
        <sphereGeometry args={[0.14, 8, 6]} />
        <meshStandardMaterial color="#c62828" />
      </mesh>
      {/* 이빨 */}
      {[-0.06, -0.02, 0.02, 0.06].map((x, i) => (
        <mesh key={i} position={[x, 0.32, 0.16]}>
          <coneGeometry args={[0.008, 0.03, 3]} />
          <meshStandardMaterial color="#fff" />
        </mesh>
      ))}
      {/* 덩굴 */}
      <mesh position={[-0.16, 0.16, 0.06]} rotation={[0.2, 0, 0.8]}>
        <cylinderGeometry args={[0.012, 0.018, 0.16, 3]} />
        <meshStandardMaterial color="#1b5e20" />
      </mesh>
      <mesh position={[0.16, 0.16, 0.06]} rotation={[0.2, 0, -0.8]}>
        <cylinderGeometry args={[0.012, 0.018, 0.16, 3]} />
        <meshStandardMaterial color="#1b5e20" />
      </mesh>
    </group>
  );
}

export function SporeSwarmModel() {
  return (
    <group>
      {/* 중심 균체 */}
      <mesh position={[0, 0.12, 0]}>
        <sphereGeometry args={[0.12, 8, 8]} />
        <meshStandardMaterial color="#6d4c41" />
      </mesh>
      {/* 떠다니는 포자들 */}
      {[[-0.12, 0.26, 0.08], [0.1, 0.3, -0.06], [-0.06, 0.34, -0.1], [0.14, 0.22, 0.1],
        [-0.08, 0.2, -0.14], [0.04, 0.38, 0.04], [0.12, 0.28, -0.12], [-0.14, 0.32, 0.02]].map((p, i) => (
        <mesh key={i} position={p}>
          <sphereGeometry args={[0.03 + (i % 3) * 0.01, 4, 4]} />
          <meshStandardMaterial color="#c6ff00" emissive="#aeea00" emissiveIntensity={0.3} transparent opacity={0.7} />
        </mesh>
      ))}
      <mesh position={[0, 0.25, 0]}>
        <sphereGeometry args={[0.28, 8, 8]} />
        <meshStandardMaterial color="#c6ff00" transparent opacity={0.08} />
      </mesh>
    </group>
  );
}

export function MandrakeModel() {
  return (
    <group>
      {/* 뿌리 다리 */}
      {[-0.06, 0, 0.06].map((x, i) => (
        <mesh key={i} position={[x, 0.06, 0]} rotation={[0, 0, x * 2]}>
          <cylinderGeometry args={[0.02, 0.03, 0.12, 4]} />
          <meshStandardMaterial color="#8d6e63" />
        </mesh>
      ))}
      {/* 몸통 */}
      <mesh position={[0, 0.18, 0]}>
        <cylinderGeometry args={[0.08, 0.1, 0.16, 6]} />
        <meshStandardMaterial color="#a5d6a7" />
      </mesh>
      {/* 머리 */}
      <mesh position={[0, 0.3, 0]}>
        <sphereGeometry args={[0.1, 8, 8]} />
        <meshStandardMaterial color="#81c784" />
      </mesh>
      {/* 이파리 머리 */}
      {[-0.06, 0, 0.06].map((x, i) => (
        <mesh key={i} position={[x, 0.42, 0]} rotation={[0, i * 1.2, x * 2]}>
          <boxGeometry args={[0.04, 0.1, 0.01]} />
          <meshStandardMaterial color="#2e7d32" />
        </mesh>
      ))}
      {/* 눈 (울상) */}
      <mesh position={[-0.04, 0.32, 0.08]}>
        <sphereGeometry args={[0.015, 4, 4]} />
        <meshStandardMaterial color="#111" />
      </mesh>
      <mesh position={[0.04, 0.32, 0.08]}>
        <sphereGeometry args={[0.015, 4, 4]} />
        <meshStandardMaterial color="#111" />
      </mesh>
      {/* 벌린 입 (비명) */}
      <mesh position={[0, 0.26, 0.08]}>
        <sphereGeometry args={[0.03, 6, 6]} />
        <meshStandardMaterial color="#1a1a1a" />
      </mesh>
    </group>
  );
}

export function WorldTreeFragmentModel() {
  return (
    <group>
      <mesh position={[0, 0.2, 0]}>
        <cylinderGeometry args={[0.14, 0.2, 0.4, 6]} />
        <meshStandardMaterial color="#4e342e" roughness={0.9} />
      </mesh>
      <mesh position={[0, 0.48, 0]}>
        <sphereGeometry args={[0.18, 8, 8]} />
        <meshStandardMaterial color="#1b5e20" emissive="#2e7d32" emissiveIntensity={0.2} />
      </mesh>
      {/* 빛나는 룬 */}
      {[[0.12, 0.2, 0.12], [-0.1, 0.3, 0.14], [0.08, 0.38, 0.1]].map((p, i) => (
        <mesh key={i} position={p}>
          <boxGeometry args={[0.03, 0.03, 0.01]} />
          <meshStandardMaterial color="#ffd54f" emissive="#ffab00" emissiveIntensity={1} />
        </mesh>
      ))}
      {/* 눈 (고대) */}
      <mesh position={[-0.06, 0.36, 0.14]}>
        <sphereGeometry args={[0.025, 4, 4]} />
        <meshStandardMaterial color="#ffd54f" emissive="#ffab00" emissiveIntensity={0.8} />
      </mesh>
      <mesh position={[0.06, 0.36, 0.14]}>
        <sphereGeometry args={[0.025, 4, 4]} />
        <meshStandardMaterial color="#ffd54f" emissive="#ffab00" emissiveIntensity={0.8} />
      </mesh>
      {/* 가지 */}
      <mesh position={[-0.2, 0.44, 0]} rotation={[0, 0, 0.6]}>
        <cylinderGeometry args={[0.02, 0.035, 0.2, 3]} />
        <meshStandardMaterial color="#3e2723" />
      </mesh>
      <mesh position={[0.2, 0.44, 0]} rotation={[0, 0, -0.6]}>
        <cylinderGeometry args={[0.02, 0.035, 0.2, 3]} />
        <meshStandardMaterial color="#3e2723" />
      </mesh>
      <mesh position={[0, 0.35, 0]}>
        <sphereGeometry args={[0.32, 8, 8]} />
        <meshStandardMaterial color="#ffd54f" transparent opacity={0.08} />
      </mesh>
    </group>
  );
}

export function FungalLordModel() {
  return (
    <group>
      <mesh position={[0, 0.18, 0]}>
        <cylinderGeometry args={[0.12, 0.16, 0.3, 6]} />
        <meshStandardMaterial color="#795548" />
      </mesh>
      {/* 거대 버섯 갓 */}
      <mesh position={[0, 0.38, 0]} scale={[1, 0.5, 1]}>
        <sphereGeometry args={[0.24, 8, 6]} />
        <meshStandardMaterial color="#4a148c" />
      </mesh>
      {/* 발광 반점 */}
      {[[-0.1, 0.4, 0.14], [0.08, 0.42, 0.1], [0, 0.46, 0.06], [-0.06, 0.38, -0.12]].map((p, i) => (
        <mesh key={i} position={p}>
          <sphereGeometry args={[0.03, 4, 4]} />
          <meshStandardMaterial color="#76ff03" emissive="#64dd17" emissiveIntensity={0.8} />
        </mesh>
      ))}
      {/* 눈 */}
      <mesh position={[-0.05, 0.3, 0.12]}>
        <sphereGeometry args={[0.025, 4, 4]} />
        <meshStandardMaterial color="#e040fb" emissive="#d500f9" emissiveIntensity={0.6} />
      </mesh>
      <mesh position={[0.05, 0.3, 0.12]}>
        <sphereGeometry args={[0.025, 4, 4]} />
        <meshStandardMaterial color="#e040fb" emissive="#d500f9" emissiveIntensity={0.6} />
      </mesh>
      {/* 균사 팔 */}
      <mesh position={[-0.2, 0.22, 0.06]} rotation={[0.2, 0, 0.6]}>
        <cylinderGeometry args={[0.02, 0.03, 0.18, 4]} />
        <meshStandardMaterial color="#6d4c41" />
      </mesh>
      <mesh position={[0.2, 0.22, 0.06]} rotation={[0.2, 0, -0.6]}>
        <cylinderGeometry args={[0.02, 0.03, 0.18, 4]} />
        <meshStandardMaterial color="#6d4c41" />
      </mesh>
      <mesh position={[0, 0.3, 0]}>
        <sphereGeometry args={[0.32, 8, 8]} />
        <meshStandardMaterial color="#76ff03" transparent opacity={0.08} />
      </mesh>
    </group>
  );
}

// ==================== 10. 인간형 (Humanoids) ====================

export function BanditModel() {
  return (
    <group>
      <mesh position={[-0.05, 0.12, 0]}><cylinderGeometry args={[0.035, 0.04, 0.24, 4]} /><meshStandardMaterial color="#5d4037" /></mesh>
      <mesh position={[0.05, 0.12, 0]}><cylinderGeometry args={[0.035, 0.04, 0.24, 4]} /><meshStandardMaterial color="#5d4037" /></mesh>
      <mesh position={[0, 0.38, 0]}><boxGeometry args={[0.2, 0.24, 0.12]} /><meshStandardMaterial color="#795548" /></mesh>
      <mesh position={[0, 0.56, 0]}><sphereGeometry args={[0.1, 8, 8]} /><meshStandardMaterial color="#e0c9a8" /></mesh>
      {/* 두건 */}
      <mesh position={[0, 0.62, -0.02]}><boxGeometry args={[0.16, 0.06, 0.12]} /><meshStandardMaterial color="#3e2723" /></mesh>
      <mesh position={[-0.04, 0.58, 0.08]}><sphereGeometry args={[0.015, 4, 4]} /><meshStandardMaterial color="#111" /></mesh>
      <mesh position={[0.04, 0.58, 0.08]}><sphereGeometry args={[0.015, 4, 4]} /><meshStandardMaterial color="#111" /></mesh>
      <mesh position={[0.18, 0.34, 0]} rotation={[0, 0, -0.2]}><boxGeometry args={[0.025, 0.24, 0.015]} /><meshStandardMaterial color="#9e9e9e" metalness={0.6} /></mesh>
    </group>
  );
}

export function AssassinModel() {
  return (
    <group>
      <mesh position={[-0.05, 0.14, 0]}><cylinderGeometry args={[0.03, 0.035, 0.28, 4]} /><meshStandardMaterial color="#212121" /></mesh>
      <mesh position={[0.05, 0.14, 0]}><cylinderGeometry args={[0.03, 0.035, 0.28, 4]} /><meshStandardMaterial color="#212121" /></mesh>
      <mesh position={[0, 0.42, 0]}><cylinderGeometry args={[0.1, 0.12, 0.28, 8]} /><meshStandardMaterial color="#1a1a1a" /></mesh>
      <mesh position={[0, 0.62, 0]}><sphereGeometry args={[0.1, 8, 8]} /><meshStandardMaterial color="#1a1a1a" /></mesh>
      {/* 마스크 */}
      <mesh position={[0, 0.6, 0.08]}><boxGeometry args={[0.12, 0.04, 0.02]} /><meshStandardMaterial color="#212121" /></mesh>
      <mesh position={[-0.04, 0.62, 0.1]}><sphereGeometry args={[0.015, 4, 4]} /><meshStandardMaterial color="#f44336" emissive="#d50000" emissiveIntensity={0.8} /></mesh>
      <mesh position={[0.04, 0.62, 0.1]}><sphereGeometry args={[0.015, 4, 4]} /><meshStandardMaterial color="#f44336" emissive="#d50000" emissiveIntensity={0.8} /></mesh>
      {/* 단검 */}
      <mesh position={[-0.16, 0.38, 0.06]}><boxGeometry args={[0.015, 0.16, 0.01]} /><meshStandardMaterial color="#b0bec5" metalness={0.7} /></mesh>
      <mesh position={[0.16, 0.38, 0.06]}><boxGeometry args={[0.015, 0.16, 0.01]} /><meshStandardMaterial color="#b0bec5" metalness={0.7} /></mesh>
    </group>
  );
}

export function DarkWizardModel() {
  return (
    <group>
      <mesh position={[0, 0.2, 0]}><coneGeometry args={[0.28, 0.45, 8]} /><meshStandardMaterial color="#311b92" /></mesh>
      <mesh position={[0, 0.44, 0]}><cylinderGeometry args={[0.12, 0.18, 0.16, 8]} /><meshStandardMaterial color="#1a237e" /></mesh>
      <mesh position={[0, 0.58, 0]}><sphereGeometry args={[0.12, 8, 8]} /><meshStandardMaterial color="#cfd8dc" /></mesh>
      <mesh position={[0, 0.74, 0]}><coneGeometry args={[0.1, 0.2, 6]} /><meshStandardMaterial color="#1a237e" /></mesh>
      <mesh position={[-0.04, 0.6, 0.1]}><sphereGeometry args={[0.02, 4, 4]} /><meshStandardMaterial color="#d500f9" emissive="#aa00ff" emissiveIntensity={0.8} /></mesh>
      <mesh position={[0.04, 0.6, 0.1]}><sphereGeometry args={[0.02, 4, 4]} /><meshStandardMaterial color="#d500f9" emissive="#aa00ff" emissiveIntensity={0.8} /></mesh>
      <mesh position={[0.22, 0.38, 0]}><cylinderGeometry args={[0.015, 0.015, 0.5, 4]} /><meshStandardMaterial color="#4a148c" /></mesh>
      <mesh position={[0.22, 0.66, 0]}><sphereGeometry args={[0.04, 6, 6]} /><meshStandardMaterial color="#e040fb" emissive="#d500f9" emissiveIntensity={0.8} /></mesh>
      <mesh position={[0, 0.38, 0]}><sphereGeometry args={[0.32, 8, 8]} /><meshStandardMaterial color="#7c4dff" transparent opacity={0.08} /></mesh>
    </group>
  );
}

export function FallenKnightModel() {
  return (
    <group>
      <mesh position={[-0.06, 0.14, 0]}><cylinderGeometry args={[0.045, 0.05, 0.28, 4]} /><meshStandardMaterial color="#37474f" metalness={0.5} /></mesh>
      <mesh position={[0.06, 0.14, 0]}><cylinderGeometry args={[0.045, 0.05, 0.28, 4]} /><meshStandardMaterial color="#37474f" metalness={0.5} /></mesh>
      <mesh position={[0, 0.42, 0]}><boxGeometry args={[0.26, 0.26, 0.16]} /><meshStandardMaterial color="#263238" metalness={0.6} /></mesh>
      <mesh position={[0, 0.62, 0]}><sphereGeometry args={[0.12, 8, 8]} /><meshStandardMaterial color="#37474f" metalness={0.5} /></mesh>
      <mesh position={[-0.04, 0.64, 0.1]}><sphereGeometry args={[0.02, 4, 4]} /><meshStandardMaterial color="#f44336" emissive="#d50000" emissiveIntensity={0.8} /></mesh>
      <mesh position={[0.04, 0.64, 0.1]}><sphereGeometry args={[0.02, 4, 4]} /><meshStandardMaterial color="#f44336" emissive="#d50000" emissiveIntensity={0.8} /></mesh>
      <mesh position={[0.22, 0.36, 0]} rotation={[0, 0, -0.15]}><boxGeometry args={[0.035, 0.38, 0.018]} /><meshStandardMaterial color="#455a64" metalness={0.7} /></mesh>
      <mesh position={[-0.2, 0.4, 0.06]}><boxGeometry args={[0.04, 0.16, 0.12]} /><meshStandardMaterial color="#263238" metalness={0.5} /></mesh>
      <mesh position={[0, 0.4, 0]}><sphereGeometry args={[0.3, 8, 8]} /><meshStandardMaterial color="#b71c1c" transparent opacity={0.06} /></mesh>
    </group>
  );
}

export function BerserkerModel() {
  return (
    <group>
      <mesh position={[-0.06, 0.14, 0]}><cylinderGeometry args={[0.045, 0.055, 0.28, 4]} /><meshStandardMaterial color="#5d4037" /></mesh>
      <mesh position={[0.06, 0.14, 0]}><cylinderGeometry args={[0.045, 0.055, 0.28, 4]} /><meshStandardMaterial color="#5d4037" /></mesh>
      <mesh position={[0, 0.44, 0]}><boxGeometry args={[0.3, 0.28, 0.18]} /><meshStandardMaterial color="#d84315" /></mesh>
      <mesh position={[0, 0.66, 0]}><sphereGeometry args={[0.13, 8, 8]} /><meshStandardMaterial color="#e0c9a8" /></mesh>
      <mesh position={[-0.04, 0.68, 0.11]}><sphereGeometry args={[0.02, 4, 4]} /><meshStandardMaterial color="#f44336" emissive="#d50000" emissiveIntensity={0.6} /></mesh>
      <mesh position={[0.04, 0.68, 0.11]}><sphereGeometry args={[0.02, 4, 4]} /><meshStandardMaterial color="#f44336" emissive="#d50000" emissiveIntensity={0.6} /></mesh>
      {/* 큰 도끼 */}
      <mesh position={[0.24, 0.38, 0]}><cylinderGeometry args={[0.015, 0.015, 0.4, 3]} /><meshStandardMaterial color="#5d4037" /></mesh>
      <mesh position={[0.24, 0.6, 0.03]} rotation={[0, 0, -0.2]}><boxGeometry args={[0.1, 0.08, 0.02]} /><meshStandardMaterial color="#546e7a" metalness={0.6} /></mesh>
      {/* 분노 오라 */}
      <mesh position={[0, 0.42, 0]}><sphereGeometry args={[0.34, 8, 8]} /><meshStandardMaterial color="#ff3d00" transparent opacity={0.08} /></mesh>
    </group>
  );
}

export function NecromancerModel() {
  return (
    <group>
      <mesh position={[0, 0.22, 0]}><coneGeometry args={[0.3, 0.48, 8]} /><meshStandardMaterial color="#1a1a1a" /></mesh>
      <mesh position={[0, 0.46, 0]}><cylinderGeometry args={[0.13, 0.2, 0.18, 8]} /><meshStandardMaterial color="#212121" /></mesh>
      <mesh position={[0, 0.62, 0]}><sphereGeometry args={[0.12, 8, 8]} /><meshStandardMaterial color="#78909c" /></mesh>
      {/* 후드 */}
      <mesh position={[0, 0.66, -0.06]}><sphereGeometry args={[0.14, 8, 6]} /><meshStandardMaterial color="#111" /></mesh>
      <mesh position={[-0.04, 0.64, 0.1]}><sphereGeometry args={[0.025, 4, 4]} /><meshStandardMaterial color="#76ff03" emissive="#64dd17" emissiveIntensity={1} /></mesh>
      <mesh position={[0.04, 0.64, 0.1]}><sphereGeometry args={[0.025, 4, 4]} /><meshStandardMaterial color="#76ff03" emissive="#64dd17" emissiveIntensity={1} /></mesh>
      <mesh position={[0.22, 0.4, 0]}><cylinderGeometry args={[0.015, 0.015, 0.5, 4]} /><meshStandardMaterial color="#3e2723" /></mesh>
      <mesh position={[0.22, 0.68, 0]}><sphereGeometry args={[0.04, 6, 6]} /><meshStandardMaterial color="#76ff03" emissive="#64dd17" emissiveIntensity={0.8} /></mesh>
      <mesh position={[0, 0.4, 0]}><sphereGeometry args={[0.34, 8, 8]} /><meshStandardMaterial color="#1b5e20" transparent opacity={0.08} /></mesh>
    </group>
  );
}

export function GrandWizardModel() {
  return (
    <group>
      <mesh position={[0, 0.22, 0]}><coneGeometry args={[0.3, 0.48, 8]} /><meshStandardMaterial color="#1565c0" /></mesh>
      <mesh position={[0, 0.46, 0]}><cylinderGeometry args={[0.14, 0.2, 0.18, 8]} /><meshStandardMaterial color="#0d47a1" /></mesh>
      <mesh position={[0, 0.62, 0]}><sphereGeometry args={[0.12, 8, 8]} /><meshStandardMaterial color="#e0c9a8" /></mesh>
      <mesh position={[0, 0.78, 0]}><coneGeometry args={[0.11, 0.22, 6]} /><meshStandardMaterial color="#0d47a1" /></mesh>
      <mesh position={[0, 0.68, -0.04]}><boxGeometry args={[0.16, 0.04, 0.06]} /><meshStandardMaterial color="#bdbdbd" /></mesh>
      <mesh position={[-0.04, 0.64, 0.1]}><sphereGeometry args={[0.02, 4, 4]} /><meshStandardMaterial color="#42a5f5" emissive="#1e88e5" emissiveIntensity={0.6} /></mesh>
      <mesh position={[0.04, 0.64, 0.1]}><sphereGeometry args={[0.02, 4, 4]} /><meshStandardMaterial color="#42a5f5" emissive="#1e88e5" emissiveIntensity={0.6} /></mesh>
      <mesh position={[0.24, 0.4, 0]}><cylinderGeometry args={[0.018, 0.018, 0.6, 4]} /><meshStandardMaterial color="#5d4037" /></mesh>
      <mesh position={[0.24, 0.72, 0]}><octahedronGeometry args={[0.06, 0]} /><meshStandardMaterial color="#42a5f5" emissive="#1e88e5" emissiveIntensity={1} /></mesh>
      <mesh position={[0, 0.4, 0]}><sphereGeometry args={[0.36, 8, 8]} /><meshStandardMaterial color="#2196f3" transparent opacity={0.08} /></mesh>
    </group>
  );
}

export function ThiefLeaderModel() {
  return (
    <group>
      <mesh position={[-0.05, 0.14, 0]}><cylinderGeometry args={[0.04, 0.045, 0.28, 4]} /><meshStandardMaterial color="#3e2723" /></mesh>
      <mesh position={[0.05, 0.14, 0]}><cylinderGeometry args={[0.04, 0.045, 0.28, 4]} /><meshStandardMaterial color="#3e2723" /></mesh>
      <mesh position={[0, 0.42, 0]}><boxGeometry args={[0.24, 0.26, 0.14]} /><meshStandardMaterial color="#4e342e" /></mesh>
      <mesh position={[0, 0.62, 0]}><sphereGeometry args={[0.11, 8, 8]} /><meshStandardMaterial color="#e0c9a8" /></mesh>
      {/* 넓은 모자 */}
      <mesh position={[0, 0.72, 0]} rotation={[-Math.PI / 2, 0, 0]}><cylinderGeometry args={[0.18, 0.18, 0.02, 8]} /><meshStandardMaterial color="#3e2723" /></mesh>
      <mesh position={[0, 0.76, 0]}><coneGeometry args={[0.08, 0.1, 6]} /><meshStandardMaterial color="#3e2723" /></mesh>
      <mesh position={[-0.04, 0.64, 0.09]}><sphereGeometry args={[0.015, 4, 4]} /><meshStandardMaterial color="#111" /></mesh>
      <mesh position={[0.04, 0.64, 0.09]}><sphereGeometry args={[0.015, 4, 4]} /><meshStandardMaterial color="#111" /></mesh>
      <mesh position={[0.18, 0.36, 0.04]}><boxGeometry args={[0.02, 0.22, 0.012]} /><meshStandardMaterial color="#ffd54f" metalness={0.6} /></mesh>
    </group>
  );
}

// ==================== 11. 도깨비 (Dokkaebi) ====================

export function SmallDokkaebiModel() {
  return (
    <group>
      <mesh position={[0, 0.1, 0]}><sphereGeometry args={[0.12, 8, 8]} /><meshStandardMaterial color="#4caf50" /></mesh>
      <mesh position={[0, 0.24, 0]}><sphereGeometry args={[0.1, 8, 8]} /><meshStandardMaterial color="#66bb6a" /></mesh>
      <mesh position={[0, 0.36, 0]}><coneGeometry args={[0.03, 0.08, 4]} /><meshStandardMaterial color="#ff8f00" /></mesh>
      <mesh position={[-0.04, 0.26, 0.08]}><sphereGeometry args={[0.025, 4, 4]} /><meshStandardMaterial color="#ffeb3b" /></mesh>
      <mesh position={[0.04, 0.26, 0.08]}><sphereGeometry args={[0.025, 4, 4]} /><meshStandardMaterial color="#ffeb3b" /></mesh>
      <mesh position={[0, 0.2, 0.08]}><boxGeometry args={[0.06, 0.02, 0.01]} /><meshStandardMaterial color="#c62828" /></mesh>
      <mesh position={[0.1, 0.12, 0]}><cylinderGeometry args={[0.012, 0.012, 0.14, 3]} /><meshStandardMaterial color="#5d4037" /></mesh>
    </group>
  );
}

export function FireDokkaebiModel() {
  return (
    <group>
      <mesh position={[0, 0.14, 0]}><sphereGeometry args={[0.14, 8, 8]} /><meshStandardMaterial color="#d32f2f" /></mesh>
      <mesh position={[0, 0.3, 0]}><sphereGeometry args={[0.12, 8, 8]} /><meshStandardMaterial color="#e53935" /></mesh>
      <mesh position={[0, 0.44, 0]}><coneGeometry args={[0.035, 0.1, 4]} /><meshStandardMaterial color="#ff6d00" emissive="#e65100" emissiveIntensity={0.5} /></mesh>
      <mesh position={[-0.04, 0.32, 0.1]}><sphereGeometry args={[0.025, 4, 4]} /><meshStandardMaterial color="#ffab00" emissive="#ff8f00" emissiveIntensity={0.6} /></mesh>
      <mesh position={[0.04, 0.32, 0.1]}><sphereGeometry args={[0.025, 4, 4]} /><meshStandardMaterial color="#ffab00" emissive="#ff8f00" emissiveIntensity={0.6} /></mesh>
      <mesh position={[0.14, 0.16, 0.04]}><cylinderGeometry args={[0.015, 0.015, 0.18, 3]} /><meshStandardMaterial color="#5d4037" /></mesh>
      <mesh position={[0.14, 0.26, 0.04]}><sphereGeometry args={[0.03, 4, 4]} /><meshStandardMaterial color="#ff3d00" emissive="#dd2c00" emissiveIntensity={0.8} /></mesh>
      <mesh position={[0, 0.22, 0]}><sphereGeometry args={[0.22, 8, 8]} /><meshStandardMaterial color="#ff3d00" transparent opacity={0.08} /></mesh>
    </group>
  );
}

export function StoneDokkaebiModel() {
  return (
    <group>
      <mesh position={[0, 0.14, 0]}><boxGeometry args={[0.2, 0.22, 0.18]} /><meshStandardMaterial color="#757575" roughness={0.9} /></mesh>
      <mesh position={[0, 0.3, 0]}><boxGeometry args={[0.18, 0.14, 0.16]} /><meshStandardMaterial color="#9e9e9e" roughness={0.9} /></mesh>
      <mesh position={[0, 0.42, 0]}><coneGeometry args={[0.03, 0.08, 4]} /><meshStandardMaterial color="#616161" /></mesh>
      <mesh position={[-0.04, 0.32, 0.09]}><sphereGeometry args={[0.02, 4, 4]} /><meshStandardMaterial color="#ff9100" emissive="#ff6d00" emissiveIntensity={0.6} /></mesh>
      <mesh position={[0.04, 0.32, 0.09]}><sphereGeometry args={[0.02, 4, 4]} /><meshStandardMaterial color="#ff9100" emissive="#ff6d00" emissiveIntensity={0.6} /></mesh>
      <mesh position={[0.14, 0.16, 0]}><cylinderGeometry args={[0.015, 0.015, 0.16, 3]} /><meshStandardMaterial color="#5d4037" /></mesh>
    </group>
  );
}

export function DokkaebiGeneralModel() {
  return (
    <group>
      <mesh position={[-0.05, 0.12, 0]}><cylinderGeometry args={[0.04, 0.045, 0.24, 4]} /><meshStandardMaterial color="#1b5e20" /></mesh>
      <mesh position={[0.05, 0.12, 0]}><cylinderGeometry args={[0.04, 0.045, 0.24, 4]} /><meshStandardMaterial color="#1b5e20" /></mesh>
      <mesh position={[0, 0.38, 0]}><boxGeometry args={[0.24, 0.24, 0.16]} /><meshStandardMaterial color="#2e7d32" /></mesh>
      <mesh position={[0, 0.58, 0]}><sphereGeometry args={[0.12, 8, 8]} /><meshStandardMaterial color="#4caf50" /></mesh>
      <mesh position={[-0.08, 0.72, 0]} rotation={[0, 0, 0.2]}><coneGeometry args={[0.02, 0.1, 4]} /><meshStandardMaterial color="#ffd54f" /></mesh>
      <mesh position={[0.08, 0.72, 0]} rotation={[0, 0, -0.2]}><coneGeometry args={[0.02, 0.1, 4]} /><meshStandardMaterial color="#ffd54f" /></mesh>
      {/* 갑옷 */}
      <mesh position={[0, 0.4, 0.09]}><boxGeometry args={[0.16, 0.12, 0.01]} /><meshStandardMaterial color="#ffd54f" metalness={0.6} /></mesh>
      <mesh position={[-0.04, 0.6, 0.1]}><sphereGeometry args={[0.02, 4, 4]} /><meshStandardMaterial color="#f44336" /></mesh>
      <mesh position={[0.04, 0.6, 0.1]}><sphereGeometry args={[0.02, 4, 4]} /><meshStandardMaterial color="#f44336" /></mesh>
      <mesh position={[0.2, 0.36, 0]}><cylinderGeometry args={[0.015, 0.015, 0.3, 3]} /><meshStandardMaterial color="#5d4037" /></mesh>
      <mesh position={[0.2, 0.52, 0.03]}><boxGeometry args={[0.08, 0.05, 0.02]} /><meshStandardMaterial color="#9e9e9e" metalness={0.5} /></mesh>
    </group>
  );
}

export function DokkaebiKingModel() {
  return (
    <group>
      <mesh position={[-0.06, 0.14, 0]}><cylinderGeometry args={[0.045, 0.05, 0.28, 4]} /><meshStandardMaterial color="#1b5e20" /></mesh>
      <mesh position={[0.06, 0.14, 0]}><cylinderGeometry args={[0.045, 0.05, 0.28, 4]} /><meshStandardMaterial color="#1b5e20" /></mesh>
      <mesh position={[0, 0.42, 0]}><boxGeometry args={[0.28, 0.28, 0.18]} /><meshStandardMaterial color="#2e7d32" /></mesh>
      <mesh position={[0, 0.64, 0]}><sphereGeometry args={[0.14, 8, 8]} /><meshStandardMaterial color="#4caf50" /></mesh>
      {/* 왕관 */}
      <mesh position={[0, 0.8, 0]}><cylinderGeometry args={[0.08, 0.12, 0.06, 6]} /><meshStandardMaterial color="#ffd54f" metalness={0.8} /></mesh>
      {/* 큰 뿔 */}
      <mesh position={[-0.1, 0.82, 0]} rotation={[0, 0, 0.3]}><coneGeometry args={[0.025, 0.14, 4]} /><meshStandardMaterial color="#ff6f00" /></mesh>
      <mesh position={[0.1, 0.82, 0]} rotation={[0, 0, -0.3]}><coneGeometry args={[0.025, 0.14, 4]} /><meshStandardMaterial color="#ff6f00" /></mesh>
      <mesh position={[-0.05, 0.66, 0.12]}><sphereGeometry args={[0.025, 4, 4]} /><meshStandardMaterial color="#f44336" emissive="#d50000" emissiveIntensity={0.6} /></mesh>
      <mesh position={[0.05, 0.66, 0.12]}><sphereGeometry args={[0.025, 4, 4]} /><meshStandardMaterial color="#f44336" emissive="#d50000" emissiveIntensity={0.6} /></mesh>
      <mesh position={[0.24, 0.38, 0]}><cylinderGeometry args={[0.02, 0.02, 0.35, 3]} /><meshStandardMaterial color="#ff6f00" /></mesh>
      <mesh position={[0.24, 0.58, 0]}><sphereGeometry args={[0.05, 6, 6]} /><meshStandardMaterial color="#ffd54f" metalness={0.6} /></mesh>
    </group>
  );
}

export function PondDokkaebiModel() {
  return (
    <group>
      <mesh position={[0, 0.12, 0]}><sphereGeometry args={[0.14, 8, 8]} /><meshStandardMaterial color="#0277bd" /></mesh>
      <mesh position={[0, 0.28, 0]}><sphereGeometry args={[0.12, 8, 8]} /><meshStandardMaterial color="#0288d1" /></mesh>
      <mesh position={[0, 0.42, 0]}><coneGeometry args={[0.03, 0.08, 4]} /><meshStandardMaterial color="#29b6f6" /></mesh>
      <mesh position={[-0.04, 0.3, 0.1]}><sphereGeometry args={[0.025, 4, 4]} /><meshStandardMaterial color="#80deea" emissive="#00bcd4" emissiveIntensity={0.5} /></mesh>
      <mesh position={[0.04, 0.3, 0.1]}><sphereGeometry args={[0.025, 4, 4]} /><meshStandardMaterial color="#80deea" emissive="#00bcd4" emissiveIntensity={0.5} /></mesh>
      <mesh position={[0, 0.2, 0]}><sphereGeometry args={[0.22, 8, 8]} /><meshStandardMaterial color="#0288d1" transparent opacity={0.1} /></mesh>
    </group>
  );
}

export function DokkaebiClubModel() {
  return (
    <group>
      <mesh position={[0, 0.14, 0]}><sphereGeometry args={[0.14, 8, 8]} /><meshStandardMaterial color="#388e3c" /></mesh>
      <mesh position={[0, 0.3, 0]}><sphereGeometry args={[0.12, 8, 8]} /><meshStandardMaterial color="#43a047" /></mesh>
      <mesh position={[0, 0.44, 0]}><coneGeometry args={[0.03, 0.08, 4]} /><meshStandardMaterial color="#ffc107" /></mesh>
      <mesh position={[-0.04, 0.32, 0.1]}><sphereGeometry args={[0.02, 4, 4]} /><meshStandardMaterial color="#ffeb3b" /></mesh>
      <mesh position={[0.04, 0.32, 0.1]}><sphereGeometry args={[0.02, 4, 4]} /><meshStandardMaterial color="#ffeb3b" /></mesh>
      {/* 큰 방망이 */}
      <mesh position={[0.16, 0.18, 0]}><cylinderGeometry args={[0.015, 0.015, 0.24, 3]} /><meshStandardMaterial color="#5d4037" /></mesh>
      <mesh position={[0.16, 0.32, 0]}><boxGeometry args={[0.06, 0.08, 0.06]} /><meshStandardMaterial color="#795548" /></mesh>
      {/* 박힌 못 */}
      {[[-0.03, 0.34, 0.03], [0.03, 0.3, 0.03]].map((p, i) => (
        <mesh key={i} position={[0.16 + p[0], p[1], p[2]]}><coneGeometry args={[0.006, 0.02, 3]} /><meshStandardMaterial color="#9e9e9e" /></mesh>
      ))}
    </group>
  );
}

export function ForestDokkaebiModel() {
  return (
    <group>
      <mesh position={[0, 0.14, 0]}><sphereGeometry args={[0.14, 8, 8]} /><meshStandardMaterial color="#2e7d32" /></mesh>
      <mesh position={[0, 0.3, 0]}><sphereGeometry args={[0.12, 8, 8]} /><meshStandardMaterial color="#388e3c" /></mesh>
      <mesh position={[0, 0.44, 0]}><coneGeometry args={[0.03, 0.08, 4]} /><meshStandardMaterial color="#1b5e20" /></mesh>
      {/* 이파리 장식 */}
      <mesh position={[-0.08, 0.42, 0]}><boxGeometry args={[0.04, 0.06, 0.01]} /><meshStandardMaterial color="#4caf50" /></mesh>
      <mesh position={[0.08, 0.42, 0]}><boxGeometry args={[0.04, 0.06, 0.01]} /><meshStandardMaterial color="#4caf50" /></mesh>
      <mesh position={[-0.04, 0.32, 0.1]}><sphereGeometry args={[0.02, 4, 4]} /><meshStandardMaterial color="#8bc34a" emissive="#689f38" emissiveIntensity={0.5} /></mesh>
      <mesh position={[0.04, 0.32, 0.1]}><sphereGeometry args={[0.02, 4, 4]} /><meshStandardMaterial color="#8bc34a" emissive="#689f38" emissiveIntensity={0.5} /></mesh>
    </group>
  );
}

// ==================== 12. 요괴/변이 (Yokai/Mutants) ====================

export function HaetaeModel() {
  return (
    <group>
      <mesh position={[0, 0.2, 0]} scale={[1, 0.85, 1.3]}><sphereGeometry args={[0.22, 8, 8]} /><meshStandardMaterial color="#ffd54f" /></mesh>
      <mesh position={[0, 0.32, 0.2]}><sphereGeometry args={[0.16, 8, 8]} /><meshStandardMaterial color="#ffca28" /></mesh>
      {/* 뿔 */}
      <mesh position={[0, 0.5, 0.18]}><coneGeometry args={[0.03, 0.12, 4]} /><meshStandardMaterial color="#ff8f00" /></mesh>
      {/* 갈기 */}
      <mesh position={[0, 0.38, 0.04]}><boxGeometry args={[0.2, 0.08, 0.14]} /><meshStandardMaterial color="#e65100" /></mesh>
      <mesh position={[-0.06, 0.36, 0.32]}><sphereGeometry args={[0.02, 4, 4]} /><meshStandardMaterial color="#f44336" emissive="#d50000" emissiveIntensity={0.5} /></mesh>
      <mesh position={[0.06, 0.36, 0.32]}><sphereGeometry args={[0.02, 4, 4]} /><meshStandardMaterial color="#f44336" emissive="#d50000" emissiveIntensity={0.5} /></mesh>
      {[[-0.1,0,0.1],[0.1,0,0.1],[-0.1,0,-0.1],[0.1,0,-0.1]].map((p,i)=>(<mesh key={i} position={p}><cylinderGeometry args={[0.04, 0.05, 0.18, 4]} /><meshStandardMaterial color="#f9a825" /></mesh>))}
      <mesh position={[0, 0.25, 0]}><sphereGeometry args={[0.35, 8, 8]} /><meshStandardMaterial color="#ffd54f" transparent opacity={0.06} /></mesh>
    </group>
  );
}

export function BulgasariModel() {
  return (
    <group>
      <mesh position={[0, 0.22, 0]} scale={[1.1, 0.9, 1.2]}><sphereGeometry args={[0.24, 8, 8]} /><meshStandardMaterial color="#37474f" metalness={0.4} roughness={0.6} /></mesh>
      <mesh position={[0, 0.38, 0.22]}><sphereGeometry args={[0.14, 8, 8]} /><meshStandardMaterial color="#455a64" metalness={0.4} /></mesh>
      <mesh position={[0, 0.48, 0.32]} rotation={[-0.3, 0, 0]}><coneGeometry args={[0.04, 0.1, 4]} /><meshStandardMaterial color="#263238" /></mesh>
      {/* 눈 */}
      <mesh position={[-0.05, 0.42, 0.34]}><sphereGeometry args={[0.02, 4, 4]} /><meshStandardMaterial color="#ff1744" emissive="#d50000" emissiveIntensity={0.8} /></mesh>
      <mesh position={[0.05, 0.42, 0.34]}><sphereGeometry args={[0.02, 4, 4]} /><meshStandardMaterial color="#ff1744" emissive="#d50000" emissiveIntensity={0.8} /></mesh>
      {/* 등 돌기 */}
      {[-0.06, 0, 0.06, -0.1, 0.1].map((z, i) => (
        <mesh key={i} position={[0, 0.38 + i * 0.01, z]}><coneGeometry args={[0.02, 0.06, 4]} /><meshStandardMaterial color="#546e7a" metalness={0.5} /></mesh>
      ))}
      {[[-0.12,0,0.1],[0.12,0,0.1],[-0.12,0,-0.1],[0.12,0,-0.1]].map((p,i)=>(<mesh key={i} position={p}><cylinderGeometry args={[0.05, 0.06, 0.2, 4]} /><meshStandardMaterial color="#263238" /></mesh>))}
    </group>
  );
}

export function ChimeraModel() {
  return (
    <group>
      <mesh position={[0, 0.22, 0]} scale={[1, 0.85, 1.3]}><sphereGeometry args={[0.24, 8, 8]} /><meshStandardMaterial color="#795548" /></mesh>
      {/* 사자 머리 */}
      <mesh position={[-0.1, 0.38, 0.22]}><sphereGeometry args={[0.1, 8, 8]} /><meshStandardMaterial color="#fbc02d" /></mesh>
      {/* 염소 머리 */}
      <mesh position={[0.1, 0.38, 0.22]}><sphereGeometry args={[0.08, 8, 8]} /><meshStandardMaterial color="#9e9e9e" /></mesh>
      <mesh position={[0.1, 0.48, 0.2]} rotation={[0, 0, -0.3]}><coneGeometry args={[0.015, 0.06, 4]} /><meshStandardMaterial color="#616161" /></mesh>
      {/* 뱀 꼬리 */}
      <mesh position={[0, 0.18, -0.26]} rotation={[0.6, 0, 0]}><cylinderGeometry args={[0.025, 0.035, 0.2, 4]} /><meshStandardMaterial color="#2e7d32" /></mesh>
      <mesh position={[0, 0.16, -0.38]}><sphereGeometry args={[0.04, 6, 6]} /><meshStandardMaterial color="#388e3c" /></mesh>
      {/* 날개 */}
      <mesh position={[-0.24, 0.3, -0.02]} rotation={[0, 0, 0.3]}><boxGeometry args={[0.14, 0.16, 0.01]} /><meshStandardMaterial color="#4e342e" /></mesh>
      <mesh position={[0.24, 0.3, -0.02]} rotation={[0, 0, -0.3]}><boxGeometry args={[0.14, 0.16, 0.01]} /><meshStandardMaterial color="#4e342e" /></mesh>
      {[[-0.1,0,0.1],[0.1,0,0.1],[-0.1,0,-0.1],[0.1,0,-0.1]].map((p,i)=>(<mesh key={i} position={p}><cylinderGeometry args={[0.04, 0.05, 0.2, 4]} /><meshStandardMaterial color="#6d4c41" /></mesh>))}
    </group>
  );
}

export function MinotaurModel() {
  return (
    <group>
      <mesh position={[-0.07, 0.14, 0]}><cylinderGeometry args={[0.05, 0.06, 0.28, 4]} /><meshStandardMaterial color="#5d4037" /></mesh>
      <mesh position={[0.07, 0.14, 0]}><cylinderGeometry args={[0.05, 0.06, 0.28, 4]} /><meshStandardMaterial color="#5d4037" /></mesh>
      <mesh position={[0, 0.44, 0]}><boxGeometry args={[0.34, 0.3, 0.2]} /><meshStandardMaterial color="#6d4c41" /></mesh>
      <mesh position={[0, 0.68, 0]}><sphereGeometry args={[0.14, 8, 8]} /><meshStandardMaterial color="#795548" /></mesh>
      {/* 뿔 */}
      <mesh position={[-0.14, 0.8, 0]} rotation={[0, 0, 0.5]}><coneGeometry args={[0.025, 0.14, 4]} /><meshStandardMaterial color="#e0e0e0" /></mesh>
      <mesh position={[0.14, 0.8, 0]} rotation={[0, 0, -0.5]}><coneGeometry args={[0.025, 0.14, 4]} /><meshStandardMaterial color="#e0e0e0" /></mesh>
      {/* 코 링 */}
      <mesh position={[0, 0.62, 0.14]} rotation={[-Math.PI/2, 0, 0]}><torusGeometry args={[0.03, 0.006, 4, 8]} /><meshStandardMaterial color="#ffd54f" metalness={0.7} /></mesh>
      <mesh position={[-0.05, 0.7, 0.12]}><sphereGeometry args={[0.02, 4, 4]} /><meshStandardMaterial color="#f44336" /></mesh>
      <mesh position={[0.05, 0.7, 0.12]}><sphereGeometry args={[0.02, 4, 4]} /><meshStandardMaterial color="#f44336" /></mesh>
      <mesh position={[0.26, 0.4, 0]}><cylinderGeometry args={[0.02, 0.02, 0.4, 3]} /><meshStandardMaterial color="#5d4037" /></mesh>
      <mesh position={[0.26, 0.62, 0.03]}><boxGeometry args={[0.1, 0.08, 0.02]} /><meshStandardMaterial color="#757575" metalness={0.5} /></mesh>
    </group>
  );
}

export function MedusaModel() {
  return (
    <group>
      <mesh position={[0, 0.2, 0]}><coneGeometry args={[0.26, 0.44, 8]} /><meshStandardMaterial color="#2e7d32" /></mesh>
      <mesh position={[0, 0.44, 0]}><cylinderGeometry args={[0.12, 0.16, 0.18, 8]} /><meshStandardMaterial color="#388e3c" /></mesh>
      <mesh position={[0, 0.6, 0]}><sphereGeometry args={[0.12, 8, 8]} /><meshStandardMaterial color="#4caf50" /></mesh>
      {/* 뱀 머리카락 */}
      {[[-0.1, 0.72, 0.02], [0.1, 0.72, 0.02], [-0.06, 0.74, -0.06], [0.06, 0.74, -0.06], [0, 0.76, 0]].map((p, i) => (
        <mesh key={i} position={p} rotation={[0.3 * (i - 2), 0, (i - 2) * 0.3]}><cylinderGeometry args={[0.01, 0.015, 0.12, 3]} /><meshStandardMaterial color="#1b5e20" /></mesh>
      ))}
      <mesh position={[-0.04, 0.62, 0.1]}><sphereGeometry args={[0.025, 4, 4]} /><meshStandardMaterial color="#ffeb3b" emissive="#fbc02d" emissiveIntensity={0.8} /></mesh>
      <mesh position={[0.04, 0.62, 0.1]}><sphereGeometry args={[0.025, 4, 4]} /><meshStandardMaterial color="#ffeb3b" emissive="#fbc02d" emissiveIntensity={0.8} /></mesh>
    </group>
  );
}

export function GiantModel() {
  return (
    <group>
      <mesh position={[-0.08, 0.16, 0]}><cylinderGeometry args={[0.06, 0.07, 0.32, 4]} /><meshStandardMaterial color="#6d4c41" /></mesh>
      <mesh position={[0.08, 0.16, 0]}><cylinderGeometry args={[0.06, 0.07, 0.32, 4]} /><meshStandardMaterial color="#6d4c41" /></mesh>
      <mesh position={[0, 0.48, 0]}><boxGeometry args={[0.36, 0.34, 0.22]} /><meshStandardMaterial color="#795548" /></mesh>
      <mesh position={[0, 0.74, 0]}><sphereGeometry args={[0.14, 8, 8]} /><meshStandardMaterial color="#8d6e63" /></mesh>
      <mesh position={[-0.05, 0.76, 0.12]}><sphereGeometry args={[0.02, 4, 4]} /><meshStandardMaterial color="#111" /></mesh>
      <mesh position={[0.05, 0.76, 0.12]}><sphereGeometry args={[0.02, 4, 4]} /><meshStandardMaterial color="#111" /></mesh>
      <mesh position={[-0.28, 0.48, 0]}><boxGeometry args={[0.12, 0.32, 0.12]} /><meshStandardMaterial color="#8d6e63" /></mesh>
      <mesh position={[0.28, 0.48, 0]}><boxGeometry args={[0.12, 0.32, 0.12]} /><meshStandardMaterial color="#8d6e63" /></mesh>
      <mesh position={[0.32, 0.3, 0]}><cylinderGeometry args={[0.03, 0.03, 0.4, 4]} /><meshStandardMaterial color="#5d4037" /></mesh>
    </group>
  );
}

export function WerewolfModel() {
  return (
    <group>
      <mesh position={[-0.06, 0.14, 0]}><cylinderGeometry args={[0.045, 0.055, 0.28, 4]} /><meshStandardMaterial color="#424242" /></mesh>
      <mesh position={[0.06, 0.14, 0]}><cylinderGeometry args={[0.045, 0.055, 0.28, 4]} /><meshStandardMaterial color="#424242" /></mesh>
      <mesh position={[0, 0.44, 0]}><boxGeometry args={[0.28, 0.28, 0.18]} /><meshStandardMaterial color="#616161" /></mesh>
      <mesh position={[0, 0.66, 0.04]}><sphereGeometry args={[0.13, 8, 8]} /><meshStandardMaterial color="#757575" /></mesh>
      {/* 주둥이 */}
      <mesh position={[0, 0.62, 0.16]} scale={[0.7, 0.6, 1]}><sphereGeometry args={[0.06, 6, 6]} /><meshStandardMaterial color="#9e9e9e" /></mesh>
      {/* 귀 */}
      <mesh position={[-0.08, 0.8, 0.02]}><coneGeometry args={[0.03, 0.1, 4]} /><meshStandardMaterial color="#616161" /></mesh>
      <mesh position={[0.08, 0.8, 0.02]}><coneGeometry args={[0.03, 0.1, 4]} /><meshStandardMaterial color="#616161" /></mesh>
      <mesh position={[-0.05, 0.7, 0.14]}><sphereGeometry args={[0.02, 4, 4]} /><meshStandardMaterial color="#ffd54f" emissive="#ffab00" emissiveIntensity={0.8} /></mesh>
      <mesh position={[0.05, 0.7, 0.14]}><sphereGeometry args={[0.02, 4, 4]} /><meshStandardMaterial color="#ffd54f" emissive="#ffab00" emissiveIntensity={0.8} /></mesh>
      {/* 발톱 */}
      <mesh position={[-0.2, 0.4, 0.08]}><coneGeometry args={[0.02, 0.08, 4]} /><meshStandardMaterial color="#bdbdbd" /></mesh>
      <mesh position={[0.2, 0.4, 0.08]}><coneGeometry args={[0.02, 0.08, 4]} /><meshStandardMaterial color="#bdbdbd" /></mesh>
    </group>
  );
}

// ==================== 13. 슬라임 (Slimes) ====================

export function GreenSlimeModel() {
  return (<group><mesh position={[0, 0.1, 0]} scale={[1.2, 0.7, 1.2]}><sphereGeometry args={[0.16, 8, 8]} /><meshStandardMaterial color="#4caf50" transparent opacity={0.7} /></mesh><mesh position={[-0.04, 0.16, 0.1]}><sphereGeometry args={[0.025, 4, 4]} /><meshStandardMaterial color="#1b5e20" /></mesh><mesh position={[0.04, 0.16, 0.1]}><sphereGeometry args={[0.025, 4, 4]} /><meshStandardMaterial color="#1b5e20" /></mesh></group>);
}

export function BlueSlimeModel() {
  return (<group><mesh position={[0, 0.1, 0]} scale={[1.2, 0.7, 1.2]}><sphereGeometry args={[0.16, 8, 8]} /><meshStandardMaterial color="#42a5f5" transparent opacity={0.7} /></mesh><mesh position={[-0.04, 0.16, 0.1]}><sphereGeometry args={[0.025, 4, 4]} /><meshStandardMaterial color="#0d47a1" /></mesh><mesh position={[0.04, 0.16, 0.1]}><sphereGeometry args={[0.025, 4, 4]} /><meshStandardMaterial color="#0d47a1" /></mesh></group>);
}

export function RedSlimeModel() {
  return (<group><mesh position={[0, 0.1, 0]} scale={[1.2, 0.7, 1.2]}><sphereGeometry args={[0.16, 8, 8]} /><meshStandardMaterial color="#e53935" transparent opacity={0.7} /></mesh><mesh position={[-0.04, 0.16, 0.1]}><sphereGeometry args={[0.025, 4, 4]} /><meshStandardMaterial color="#b71c1c" /></mesh><mesh position={[0.04, 0.16, 0.1]}><sphereGeometry args={[0.025, 4, 4]} /><meshStandardMaterial color="#b71c1c" /></mesh></group>);
}

export function PoisonSlimeModel() {
  return (<group><mesh position={[0, 0.1, 0]} scale={[1.2, 0.7, 1.2]}><sphereGeometry args={[0.16, 8, 8]} /><meshStandardMaterial color="#7b1fa2" transparent opacity={0.7} /></mesh><mesh position={[-0.04, 0.16, 0.1]}><sphereGeometry args={[0.025, 4, 4]} /><meshStandardMaterial color="#4a148c" /></mesh><mesh position={[0.04, 0.16, 0.1]}><sphereGeometry args={[0.025, 4, 4]} /><meshStandardMaterial color="#4a148c" /></mesh><mesh position={[0, 0.2, 0]}><sphereGeometry args={[0.05, 4, 4]} /><meshStandardMaterial color="#76ff03" emissive="#64dd17" emissiveIntensity={0.5} transparent opacity={0.6} /></mesh></group>);
}

export function MetalSlimeModel() {
  return (<group><mesh position={[0, 0.1, 0]} scale={[1.2, 0.7, 1.2]}><sphereGeometry args={[0.16, 8, 8]} /><meshStandardMaterial color="#b0bec5" metalness={0.8} roughness={0.2} /></mesh><mesh position={[-0.04, 0.16, 0.1]}><sphereGeometry args={[0.025, 4, 4]} /><meshStandardMaterial color="#37474f" /></mesh><mesh position={[0.04, 0.16, 0.1]}><sphereGeometry args={[0.025, 4, 4]} /><meshStandardMaterial color="#37474f" /></mesh></group>);
}

export function KingSlimeModel() {
  return (
    <group>
      <mesh position={[0, 0.14, 0]} scale={[1.4, 0.8, 1.4]}><sphereGeometry args={[0.2, 8, 8]} /><meshStandardMaterial color="#ffd54f" transparent opacity={0.7} /></mesh>
      <mesh position={[0, 0.26, 0]}><cylinderGeometry args={[0.06, 0.1, 0.04, 6]} /><meshStandardMaterial color="#ffd54f" metalness={0.8} roughness={0.2} /></mesh>
      <mesh position={[-0.06, 0.2, 0.14]}><sphereGeometry args={[0.03, 4, 4]} /><meshStandardMaterial color="#f57f17" /></mesh>
      <mesh position={[0.06, 0.2, 0.14]}><sphereGeometry args={[0.03, 4, 4]} /><meshStandardMaterial color="#f57f17" /></mesh>
    </group>
  );
}

export function JellyfishModel() {
  return (
    <group>
      <mesh position={[0, 0.22, 0]} scale={[1, 0.6, 1]}><sphereGeometry args={[0.16, 8, 6]} /><meshStandardMaterial color="#e1bee7" transparent opacity={0.5} /></mesh>
      {/* 촉수 */}
      {[-0.08, -0.04, 0, 0.04, 0.08].map((x, i) => (
        <mesh key={i} position={[x, 0.06, 0]}><cylinderGeometry args={[0.006, 0.01, 0.16, 3]} /><meshStandardMaterial color="#ce93d8" transparent opacity={0.5} /></mesh>
      ))}
      <mesh position={[0, 0.22, 0.04]}><sphereGeometry args={[0.03, 4, 4]} /><meshStandardMaterial color="#e040fb" emissive="#d500f9" emissiveIntensity={0.6} /></mesh>
      <mesh position={[0, 0.2, 0]}><sphereGeometry args={[0.24, 8, 8]} /><meshStandardMaterial color="#e040fb" transparent opacity={0.06} /></mesh>
    </group>
  );
}

export function SlimeLordModel() {
  return (
    <group>
      <mesh position={[0, 0.16, 0]} scale={[1.5, 0.9, 1.5]}><sphereGeometry args={[0.22, 8, 8]} /><meshStandardMaterial color="#880e4f" transparent opacity={0.65} /></mesh>
      <mesh position={[0, 0.32, 0]}><cylinderGeometry args={[0.08, 0.12, 0.05, 6]} /><meshStandardMaterial color="#ffd54f" metalness={0.7} /></mesh>
      <mesh position={[-0.08, 0.24, 0.16]}><sphereGeometry args={[0.035, 4, 4]} /><meshStandardMaterial color="#4a148c" /></mesh>
      <mesh position={[0.08, 0.24, 0.16]}><sphereGeometry args={[0.035, 4, 4]} /><meshStandardMaterial color="#4a148c" /></mesh>
      {/* 슬라임 촉수 */}
      {[-0.18, -0.06, 0.06, 0.18].map((x, i) => (
        <mesh key={i} position={[x, 0.04, 0.1]} rotation={[0.3, 0, x]}><coneGeometry args={[0.02, 0.12, 4]} /><meshStandardMaterial color="#880e4f" transparent opacity={0.5} /></mesh>
      ))}
      <mesh position={[0, 0.18, 0]}><sphereGeometry args={[0.36, 8, 8]} /><meshStandardMaterial color="#880e4f" transparent opacity={0.08} /></mesh>
    </group>
  );
}

// ==================== 14. 수생/해양 (Aquatic) ====================

export function KingCrabModel() {
  return (
    <group>
      <mesh position={[0, 0.08, 0]} scale={[1.4, 0.5, 1]}><sphereGeometry args={[0.16, 8, 6]} /><meshStandardMaterial color="#c62828" /></mesh>
      {/* 집게 */}
      <mesh position={[-0.22, 0.1, 0.08]}><boxGeometry args={[0.08, 0.06, 0.04]} /><meshStandardMaterial color="#d32f2f" /></mesh>
      <mesh position={[-0.28, 0.1, 0.08]} rotation={[0, 0, 0.3]}><boxGeometry args={[0.04, 0.05, 0.03]} /><meshStandardMaterial color="#e53935" /></mesh>
      <mesh position={[0.22, 0.1, 0.08]}><boxGeometry args={[0.08, 0.06, 0.04]} /><meshStandardMaterial color="#d32f2f" /></mesh>
      <mesh position={[0.28, 0.1, 0.08]} rotation={[0, 0, -0.3]}><boxGeometry args={[0.04, 0.05, 0.03]} /><meshStandardMaterial color="#e53935" /></mesh>
      {/* 눈줄기 */}
      <mesh position={[-0.04, 0.16, 0.1]}><cylinderGeometry args={[0.006, 0.006, 0.06, 3]} /><meshStandardMaterial color="#c62828" /></mesh>
      <mesh position={[-0.04, 0.2, 0.1]}><sphereGeometry args={[0.015, 4, 4]} /><meshStandardMaterial color="#111" /></mesh>
      <mesh position={[0.04, 0.16, 0.1]}><cylinderGeometry args={[0.006, 0.006, 0.06, 3]} /><meshStandardMaterial color="#c62828" /></mesh>
      <mesh position={[0.04, 0.2, 0.1]}><sphereGeometry args={[0.015, 4, 4]} /><meshStandardMaterial color="#111" /></mesh>
      {/* 다리 */}
      {[[-0.16,0.04,0.06],[0.16,0.04,0.06],[-0.18,0.04,0],[0.18,0.04,0],[-0.16,0.04,-0.06],[0.16,0.04,-0.06]].map((p,i)=>(<mesh key={i} position={p} rotation={[0,0,i%2?-0.5:0.5]}><cylinderGeometry args={[0.008,0.012,0.08,3]} /><meshStandardMaterial color="#b71c1c" /></mesh>))}
    </group>
  );
}

export function SharkModel() {
  return (
    <group>
      <mesh position={[0, 0.14, 0]} scale={[0.6, 0.5, 1.6]}><sphereGeometry args={[0.18, 8, 8]} /><meshStandardMaterial color="#546e7a" /></mesh>
      {/* 지느러미 */}
      <mesh position={[0, 0.26, 0]}><coneGeometry args={[0.04, 0.14, 4]} /><meshStandardMaterial color="#37474f" /></mesh>
      {/* 꼬리 */}
      <mesh position={[0, 0.16, -0.3]} rotation={[0, 0, 0]} scale={[0.06, 1, 0.5]}><boxGeometry args={[0.1, 0.12, 0.08]} /><meshStandardMaterial color="#455a64" /></mesh>
      <mesh position={[-0.04, 0.16, 0.24]}><sphereGeometry args={[0.015, 4, 4]} /><meshStandardMaterial color="#111" /></mesh>
      <mesh position={[0.04, 0.16, 0.24]}><sphereGeometry args={[0.015, 4, 4]} /><meshStandardMaterial color="#111" /></mesh>
      {/* 이빨 */}
      <mesh position={[0, 0.1, 0.28]} scale={[1, 0.5, 0.6]}><sphereGeometry args={[0.05, 6, 6]} /><meshStandardMaterial color="#e0e0e0" /></mesh>
    </group>
  );
}

export function GiantOctopusModel() {
  return (
    <group>
      <mesh position={[0, 0.2, 0]}><sphereGeometry args={[0.16, 8, 8]} /><meshStandardMaterial color="#880e4f" /></mesh>
      <mesh position={[-0.05, 0.24, 0.12]}><sphereGeometry args={[0.03, 4, 4]} /><meshStandardMaterial color="#ffd54f" /></mesh>
      <mesh position={[0.05, 0.24, 0.12]}><sphereGeometry args={[0.03, 4, 4]} /><meshStandardMaterial color="#ffd54f" /></mesh>
      {/* 촉수 8개 */}
      {[0, 0.8, 1.6, 2.4, 3.2, 4, 4.8, 5.6].map((r, i) => (
        <mesh key={i} position={[Math.cos(r) * 0.14, 0.06, Math.sin(r) * 0.14]} rotation={[0.4, 0, Math.cos(r) * 0.5]}>
          <cylinderGeometry args={[0.012, 0.02, 0.16, 4]} /><meshStandardMaterial color="#ad1457" /></mesh>
      ))}
    </group>
  );
}

export function MermaidWarriorModel() {
  return (
    <group>
      <mesh position={[0, 0.18, 0]}><coneGeometry args={[0.2, 0.36, 8]} /><meshStandardMaterial color="#00897b" /></mesh>
      <mesh position={[0, 0.38, 0]}><cylinderGeometry args={[0.1, 0.14, 0.16, 8]} /><meshStandardMaterial color="#4db6ac" /></mesh>
      <mesh position={[0, 0.52, 0]}><sphereGeometry args={[0.1, 8, 8]} /><meshStandardMaterial color="#80cbc4" /></mesh>
      <mesh position={[-0.04, 0.54, 0.08]}><sphereGeometry args={[0.02, 4, 4]} /><meshStandardMaterial color="#00bcd4" emissive="#0097a7" emissiveIntensity={0.5} /></mesh>
      <mesh position={[0.04, 0.54, 0.08]}><sphereGeometry args={[0.02, 4, 4]} /><meshStandardMaterial color="#00bcd4" emissive="#0097a7" emissiveIntensity={0.5} /></mesh>
      <mesh position={[0.18, 0.34, 0]} rotation={[0, 0, -0.2]}><boxGeometry args={[0.02, 0.26, 0.015]} /><meshStandardMaterial color="#b0bec5" metalness={0.6} /></mesh>
      {/* 지느러미 */}
      <mesh position={[0, 0.04, 0.08]} rotation={[0.5, 0, 0]} scale={[1.5, 0.1, 1]}><boxGeometry args={[0.12, 0.02, 0.08]} /><meshStandardMaterial color="#26a69a" transparent opacity={0.7} /></mesh>
    </group>
  );
}

export function DeepSeaFishModel() {
  return (
    <group>
      <mesh position={[0, 0.14, 0]} scale={[0.7, 0.6, 1.3]}><sphereGeometry args={[0.16, 8, 8]} /><meshStandardMaterial color="#1a237e" /></mesh>
      {/* 초롱 (안구어) */}
      <mesh position={[0, 0.26, 0.14]} rotation={[0.3, 0, 0]}><cylinderGeometry args={[0.005, 0.005, 0.12, 3]} /><meshStandardMaterial color="#283593" /></mesh>
      <mesh position={[0, 0.34, 0.18]}><sphereGeometry args={[0.03, 6, 6]} /><meshStandardMaterial color="#00e5ff" emissive="#00b8d4" emissiveIntensity={1.5} /></mesh>
      {/* 큰 눈 */}
      <mesh position={[-0.06, 0.16, 0.14]}><sphereGeometry args={[0.04, 6, 6]} /><meshStandardMaterial color="#e8eaf6" /></mesh>
      <mesh position={[-0.06, 0.16, 0.17]}><sphereGeometry args={[0.02, 4, 4]} /><meshStandardMaterial color="#111" /></mesh>
      <mesh position={[0.06, 0.16, 0.14]}><sphereGeometry args={[0.04, 6, 6]} /><meshStandardMaterial color="#e8eaf6" /></mesh>
      <mesh position={[0.06, 0.16, 0.17]}><sphereGeometry args={[0.02, 4, 4]} /><meshStandardMaterial color="#111" /></mesh>
      {/* 이빨 */}
      {[-0.04, -0.02, 0, 0.02, 0.04].map((x, i) => (
        <mesh key={i} position={[x, 0.08, 0.16]}><coneGeometry args={[0.005, 0.02, 3]} /><meshStandardMaterial color="#e0e0e0" /></mesh>
      ))}
    </group>
  );
}

export function KrakenModel() {
  return (
    <group>
      <mesh position={[0, 0.24, 0]}><sphereGeometry args={[0.2, 8, 8]} /><meshStandardMaterial color="#311b92" /></mesh>
      <mesh position={[-0.06, 0.28, 0.16]}><sphereGeometry args={[0.04, 6, 6]} /><meshStandardMaterial color="#ff6f00" emissive="#e65100" emissiveIntensity={0.8} /></mesh>
      <mesh position={[0.06, 0.28, 0.16]}><sphereGeometry args={[0.04, 6, 6]} /><meshStandardMaterial color="#ff6f00" emissive="#e65100" emissiveIntensity={0.8} /></mesh>
      {/* 거대 촉수 */}
      {[0, 0.6, 1.2, 1.8, 2.4, 3, 3.6, 4.2, 4.8, 5.4].map((r, i) => (
        <mesh key={i} position={[Math.cos(r) * 0.18, 0.06, Math.sin(r) * 0.18]} rotation={[0.5, 0, Math.cos(r) * 0.6]}>
          <cylinderGeometry args={[0.015, 0.03, 0.22, 4]} /><meshStandardMaterial color="#4a148c" /></mesh>
      ))}
      <mesh position={[0, 0.18, 0]}><sphereGeometry args={[0.36, 8, 8]} /><meshStandardMaterial color="#4a148c" transparent opacity={0.08} /></mesh>
    </group>
  );
}

export function SeahorseKnightModel() {
  return (
    <group>
      {/* 꼬리 (말린) */}
      <mesh position={[0, 0.06, -0.06]} rotation={[-Math.PI / 2, 0, 0]}><torusGeometry args={[0.06, 0.025, 6, 8, Math.PI * 1.5]} /><meshStandardMaterial color="#0277bd" /></mesh>
      <mesh position={[0, 0.2, 0]}><cylinderGeometry args={[0.06, 0.08, 0.2, 6]} /><meshStandardMaterial color="#0288d1" /></mesh>
      <mesh position={[0, 0.36, 0.04]}><sphereGeometry args={[0.08, 8, 8]} /><meshStandardMaterial color="#039be5" /></mesh>
      {/* 주둥이 */}
      <mesh position={[0, 0.34, 0.12]} rotation={[-0.3, 0, 0]}><cylinderGeometry args={[0.015, 0.02, 0.08, 4]} /><meshStandardMaterial color="#4fc3f7" /></mesh>
      {/* 등 지느러미 */}
      <mesh position={[0, 0.3, -0.06]}><boxGeometry args={[0.01, 0.1, 0.06]} /><meshStandardMaterial color="#81d4fa" transparent opacity={0.6} /></mesh>
      <mesh position={[-0.03, 0.38, 0.08]}><sphereGeometry args={[0.015, 4, 4]} /><meshStandardMaterial color="#ffd54f" /></mesh>
      <mesh position={[0.03, 0.38, 0.08]}><sphereGeometry args={[0.015, 4, 4]} /><meshStandardMaterial color="#ffd54f" /></mesh>
      {/* 갑옷 */}
      <mesh position={[0, 0.24, 0.04]}><boxGeometry args={[0.08, 0.06, 0.06]} /><meshStandardMaterial color="#b0bec5" metalness={0.5} /></mesh>
      {/* 창 */}
      <mesh position={[0.1, 0.22, 0.04]} rotation={[0, 0, -0.1]}><cylinderGeometry args={[0.008, 0.008, 0.3, 3]} /><meshStandardMaterial color="#5d4037" /></mesh>
    </group>
  );
}

export function SeaDragonModel() {
  return (
    <group>
      <mesh position={[0, 0.22, 0]} scale={[0.9, 0.8, 1.4]}><sphereGeometry args={[0.24, 8, 8]} /><meshStandardMaterial color="#00695c" /></mesh>
      <mesh position={[0, 0.36, 0.26]}><sphereGeometry args={[0.15, 8, 8]} /><meshStandardMaterial color="#00796b" /></mesh>
      {/* 수염 */}
      <mesh position={[-0.06, 0.3, 0.38]} rotation={[0.5, 0, -0.3]}><cylinderGeometry args={[0.005, 0.005, 0.14, 3]} /><meshStandardMaterial color="#b2dfdb" /></mesh>
      <mesh position={[0.06, 0.3, 0.38]} rotation={[0.5, 0, 0.3]}><cylinderGeometry args={[0.005, 0.005, 0.14, 3]} /><meshStandardMaterial color="#b2dfdb" /></mesh>
      {/* 뿔 */}
      <mesh position={[-0.08, 0.5, 0.22]} rotation={[0.3, 0, -0.3]}><coneGeometry args={[0.02, 0.1, 4]} /><meshStandardMaterial color="#e0f2f1" /></mesh>
      <mesh position={[0.08, 0.5, 0.22]} rotation={[0.3, 0, 0.3]}><coneGeometry args={[0.02, 0.1, 4]} /><meshStandardMaterial color="#e0f2f1" /></mesh>
      {/* 눈 */}
      <mesh position={[-0.06, 0.4, 0.38]}><sphereGeometry args={[0.025, 4, 4]} /><meshStandardMaterial color="#80deea" emissive="#00bcd4" emissiveIntensity={1} /></mesh>
      <mesh position={[0.06, 0.4, 0.38]}><sphereGeometry args={[0.025, 4, 4]} /><meshStandardMaterial color="#80deea" emissive="#00bcd4" emissiveIntensity={1} /></mesh>
      {/* 지느러미 날개 */}
      <mesh position={[-0.28, 0.26, 0]} rotation={[0.1, 0, 0.3]}><boxGeometry args={[0.18, 0.2, 0.01]} /><meshStandardMaterial color="#4db6ac" transparent opacity={0.6} /></mesh>
      <mesh position={[0.28, 0.26, 0]} rotation={[0.1, 0, -0.3]}><boxGeometry args={[0.18, 0.2, 0.01]} /><meshStandardMaterial color="#4db6ac" transparent opacity={0.6} /></mesh>
      {[[-0.12,0,0.1],[0.12,0,0.1],[-0.12,0,-0.1],[0.12,0,-0.1]].map((p,i)=>(<mesh key={i} position={p}><cylinderGeometry args={[0.04, 0.05, 0.2, 4]} /><meshStandardMaterial color="#004d40" /></mesh>))}
      <mesh position={[0, 0.28, 0]}><sphereGeometry args={[0.38, 8, 8]} /><meshStandardMaterial color="#00bcd4" transparent opacity={0.08} /></mesh>
    </group>
  );
}
