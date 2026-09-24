"use client";

import { Component, type ReactNode, useMemo, useRef } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { ContactShadows, Html, RoundedBox } from "@react-three/drei";
import * as THREE from "three";

type Props = {
  progress: number;
  active: number;
  onReady?: () => void;
};

const STATIONS = [0, 6.4, 12.8, 19.2, 25.6, 32] as const;
const PALETTE = {
  paper: "#f7f5ef",
  porcelain: "#e7e5de",
  steel: "#b9bdb8",
  graphite: "#202521",
  graphite2: "#343a35",
  warm: "#c7aa78",
  floor: "#d9d7cf",
  rail: "#aeb2ad",
  glow: "#fdfbf5",
};

class WebGLErrorBoundary extends Component<
  { children: ReactNode },
  { failed: boolean }
> {
  state = { failed: false };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  render() {
    if (this.state.failed) {
      return <div className="scroll-world-webgl-error">3D preview unavailable</div>;
    }
    return this.props.children;
  }
}

function CameraRig({ progress }: { progress: number }) {
  const { camera, size } = useThree();
  const target = useRef(new THREE.Vector3());

  const desktopFrames = useMemo(
    () => [
      { position: [0.6, 5.2, 8.2] as const, target: [0, 1.05, 0] as const, fov: 38 },
      { position: [6.0, 4.8, 7.4] as const, target: [6.4, 1.25, 0.05] as const, fov: 36 },
      { position: [12.15, 4.2, 7.0] as const, target: [12.8, 1.2, 0] as const, fov: 34 },
      { position: [18.55, 4.4, 6.9] as const, target: [19.2, 1.22, 0.05] as const, fov: 33 },
      { position: [25.0, 3.8, 6.2] as const, target: [25.6, 1.25, 0.1] as const, fov: 31 },
      { position: [31.35, 4.35, 6.5] as const, target: [32, 1.35, 0.15] as const, fov: 32 },
    ],
    [],
  );

  const mobileFrames = useMemo(
    () => [
      { position: [0.15, 4.45, 6.15] as const, target: [0, 1.05, 0] as const, fov: 32 },
      { position: [6.5, 4.35, 5.9] as const, target: [6.4, 1.18, 0] as const, fov: 31 },
      { position: [12.9, 4.2, 5.75] as const, target: [12.8, 1.2, 0] as const, fov: 30 },
      { position: [19.3, 4.1, 5.65] as const, target: [19.2, 1.25, 0] as const, fov: 29 },
      { position: [25.62, 3.8, 5.35] as const, target: [25.6, 1.25, 0] as const, fov: 28 },
      { position: [32.02, 4.0, 5.45] as const, target: [32, 1.32, 0] as const, fov: 28 },
    ],
    [],
  );

  useFrame((_, delta) => {
    const p = THREE.MathUtils.clamp(progress, 0, 1) * (STATIONS.length - 1);
    const from = Math.floor(p);
    const to = Math.min(STATIONS.length - 1, from + 1);
    const t = THREE.MathUtils.smoothstep(p - from, 0, 1);
    const frames = size.width < 720 ? mobileFrames : desktopFrames;
    const a = frames[from];
    const b = frames[to];

    const px = THREE.MathUtils.lerp(a.position[0], b.position[0], t);
    const py = THREE.MathUtils.lerp(a.position[1], b.position[1], t);
    const pz = THREE.MathUtils.lerp(a.position[2], b.position[2], t);
    const tx = THREE.MathUtils.lerp(a.target[0], b.target[0], t);
    const ty = THREE.MathUtils.lerp(a.target[1], b.target[1], t);
    const tz = THREE.MathUtils.lerp(a.target[2], b.target[2], t);
    const fov = THREE.MathUtils.lerp(a.fov, b.fov, t);

    camera.position.x = THREE.MathUtils.damp(camera.position.x, px, 6.8, delta);
    camera.position.y = THREE.MathUtils.damp(camera.position.y, py, 6.8, delta);
    camera.position.z = THREE.MathUtils.damp(camera.position.z, pz, 6.8, delta);

    target.current.x = THREE.MathUtils.damp(target.current.x, tx, 8, delta);
    target.current.y = THREE.MathUtils.damp(target.current.y, ty, 8, delta);
    target.current.z = THREE.MathUtils.damp(target.current.z, tz, 8, delta);

    if (camera instanceof THREE.PerspectiveCamera) {
      camera.fov = THREE.MathUtils.damp(camera.fov, fov, 8, delta);
      camera.updateProjectionMatrix();
    }
    camera.lookAt(target.current);
  });

  return null;
}

function StationLabel({ children, active }: { children: ReactNode; active: boolean }) {
  return (
    <Html center transform distanceFactor={8.2} position={[0, 3.35, 0]} style={{ pointerEvents: "none" }}>
      <div className={`world3d-label ${active ? "active" : ""}`}>{children}</div>
    </Html>
  );
}

function ActiveLight({ x, active }: { x: number; active: boolean }) {
  return active ? (
    <>
      <pointLight position={[x - 1.2, 4.8, 3.8]} intensity={17} distance={8.5} color="#fffdf7" />
      <pointLight position={[x + 2.2, 2.6, -2.6]} intensity={6} distance={7} color="#d7d9d4" />
    </>
  ) : null;
}

function Base({ active }: { active: boolean }) {
  return (
    <group>
      <RoundedBox args={[4.9, 0.28, 4.45]} radius={0.22} smoothness={5} position={[0, 0, 0]} receiveShadow>
        <meshPhysicalMaterial
          color={active ? "#f2f0e9" : "#dddcd6"}
          roughness={0.72}
          metalness={0.08}
          clearcoat={0.3}
          clearcoatRoughness={0.72}
        />
      </RoundedBox>
      <RoundedBox args={[4.3, 0.055, 3.85]} radius={0.08} smoothness={4} position={[0, 0.18, 0]} receiveShadow>
        <meshPhysicalMaterial color="#f8f6f0" roughness={0.9} />
      </RoundedBox>
      <mesh position={[0, 0.21, -1.72]}>
        <boxGeometry args={[3.8, 0.035, 0.035]} />
        <meshStandardMaterial color="#c9cbc6" />
      </mesh>
    </group>
  );
}

function IntakeStation({ active }: { active: boolean }) {
  const group = useRef<THREE.Group>(null);
  const docs = useRef<THREE.Group>(null);

  useFrame((state, delta) => {
    if (!group.current || !docs.current) return;
    const targetScale = active ? 1.04 : 0.965;
    const next = THREE.MathUtils.damp(group.current.scale.x, targetScale, 6, delta);
    group.current.scale.setScalar(next);
    docs.current.position.y = THREE.MathUtils.damp(docs.current.position.y, active ? 1.28 : 1.05, 5, delta);
    docs.current.rotation.y = THREE.MathUtils.damp(docs.current.rotation.y, active ? -0.08 : 0.03, 4, delta);
    docs.current.position.z = Math.sin(state.clock.elapsedTime * 0.75) * 0.035;
  });

  const pages = [
    { x: -1.05, y: -0.05, r: -0.12, color: "#efe8df" },
    { x: 0, y: 0.1, r: 0.02, color: "#e7ebe7" },
    { x: 1.05, y: -0.02, r: 0.1, color: "#ecece8" },
  ];

  return (
    <group ref={group} position={[STATIONS[0], 0, 0]}>
      <Base active={active} />
      <StationLabel active={active}>01 / INTAKE</StationLabel>
      <group ref={docs} position={[0, 1.05, 0.1]}>
        {pages.map((page, i) => (
          <group key={i} position={[page.x, page.y, 0]} rotation={[0.02, page.r, page.r * 0.25]}>
            <RoundedBox args={[1.05, 1.5, 0.1]} radius={0.06} smoothness={4} castShadow>
              <meshPhysicalMaterial color={page.color} roughness={0.68} clearcoat={0.14} />
            </RoundedBox>
            <mesh position={[0, 0.38, 0.058]}>
              <boxGeometry args={[0.58, 0.075, 0.012]} />
              <meshStandardMaterial color={i === 0 ? "#8b7166" : "#8d918d"} />
            </mesh>
            {[0.12, -0.06, -0.24].map((y, j) => (
              <mesh key={j} position={[0, y, 0.058]}>
                <boxGeometry args={[0.7 - j * 0.08, 0.04, 0.012]} />
                <meshStandardMaterial color="#bfc1bd" />
              </mesh>
            ))}
          </group>
        ))}
      </group>
      <RoundedBox args={[3.25, 0.14, 1.8]} radius={0.08} position={[0, 0.38, -0.65]} receiveShadow>
        <meshPhysicalMaterial color="#d7d7d1" roughness={0.82} metalness={0.05} />
      </RoundedBox>
      <ActiveLight x={STATIONS[0]} active={active} />
    </group>
  );
}

function ExtractStation({ active }: { active: boolean }) {
  const group = useRef<THREE.Group>(null);
  const cards = useRef<THREE.Group>(null);

  useFrame((_, delta) => {
    if (!group.current || !cards.current) return;
    const s = THREE.MathUtils.damp(group.current.scale.x, active ? 1.04 : 0.965, 6, delta);
    group.current.scale.setScalar(s);
    cards.current.position.x = THREE.MathUtils.damp(cards.current.position.x, active ? 1.8 : 1.5, 5, delta);
  });

  return (
    <group ref={group} position={[STATIONS[1], 0, 0]}>
      <Base active={active} />
      <StationLabel active={active}>02 / EXTRACT</StationLabel>
      <RoundedBox args={[2.25, 2.85, 1.95]} radius={0.32} smoothness={6} position={[-0.45, 1.52, 0]} castShadow>
        <meshPhysicalMaterial color="#d4d5d0" roughness={0.4} metalness={0.28} clearcoat={0.35} clearcoatRoughness={0.5} />
      </RoundedBox>
      <RoundedBox args={[1.35, 1.28, 0.16]} radius={0.1} position={[-0.45, 1.28, 1.0]} castShadow>
        <meshPhysicalMaterial color={PALETTE.graphite} roughness={0.62} metalness={0.25} clearcoat={0.22} />
      </RoundedBox>
      <mesh position={[-0.45, 0.74, 1.11]}>
        <boxGeometry args={[0.72, 0.055, 0.04]} />
        <meshStandardMaterial color={active ? "#f1d6a2" : "#747b75"} emissive={active ? "#b48231" : "#000000"} emissiveIntensity={active ? 0.5 : 0} />
      </mesh>
      <group ref={cards} position={[1.5, 1.05, 0]}>
        {[0.58, 0, -0.58].map((z, i) => (
          <group key={i} position={[0, i * 0.42 - 0.42, z * 0.4]} rotation={[0, -0.08, -0.02]}>
            <RoundedBox args={[1.7, 0.3, 0.72]} radius={0.08} castShadow>
              <meshPhysicalMaterial color="#fbfaf6" roughness={0.82} />
            </RoundedBox>
            <mesh position={[-0.32, 0.155, 0]}>
              <boxGeometry args={[0.58, 0.018, 0.12]} />
              <meshStandardMaterial color={i === 0 ? "#777d78" : "#aeb2ad"} />
            </mesh>
          </group>
        ))}
      </group>
      <ActiveLight x={STATIONS[1]} active={active} />
    </group>
  );
}

function ResolveStation({ active }: { active: boolean }) {
  const group = useRef<THREE.Group>(null);
  const core = useRef<THREE.Group>(null);

  useFrame((state, delta) => {
    if (!group.current || !core.current) return;
    const s = THREE.MathUtils.damp(group.current.scale.x, active ? 1.04 : 0.965, 6, delta);
    group.current.scale.setScalar(s);
    core.current.rotation.y = THREE.MathUtils.damp(core.current.rotation.y, active ? -0.08 : 0, 4, delta);
    core.current.position.y = 1.48 + (active ? Math.sin(state.clock.elapsedTime * 1.4) * 0.025 : 0);
  });

  return (
    <group ref={group} position={[STATIONS[2], 0, 0]}>
      <Base active={active} />
      <StationLabel active={active}>03 / RESOLVE</StationLabel>
      <group ref={core} position={[-0.45, 1.48, 0]}>
        <RoundedBox args={[2.35, 2.65, 2.25]} radius={0.38} smoothness={7} castShadow>
          <meshPhysicalMaterial color="#c8cbc6" roughness={0.34} metalness={0.32} clearcoat={0.42} clearcoatRoughness={0.38} />
        </RoundedBox>
        <RoundedBox args={[1.15, 0.38, 1.05]} radius={0.12} position={[0, 0.02, 1.18]} castShadow>
          <meshPhysicalMaterial color={PALETTE.graphite} roughness={0.54} metalness={0.25} />
        </RoundedBox>
        <mesh position={[0, 0.02, 1.39]}>
          <boxGeometry args={[0.58, 0.06, 0.02]} />
          <meshStandardMaterial color={active ? "#e7d1a5" : "#6e756f"} emissive={active ? "#9e7635" : "#000"} emissiveIntensity={active ? 0.45 : 0} />
        </mesh>
      </group>
      <group position={[1.58, 1.0, 0]}>
        {[-0.64, 0, 0.64].map((z, i) => (
          <group key={i} position={[0, i * 0.52 - 0.52, z * 0.35]}>
            <RoundedBox args={[1.5, 0.38, 0.64]} radius={0.08} castShadow>
              <meshPhysicalMaterial color="#f7f6f2" roughness={0.86} />
            </RoundedBox>
            <mesh position={[0.32, 0.2, 0]}>
              <boxGeometry args={[0.46, 0.025, 0.1]} />
              <meshStandardMaterial color={i === 1 && active ? "#b39a71" : "#aaaea9"} />
            </mesh>
          </group>
        ))}
      </group>
      <ActiveLight x={STATIONS[2]} active={active} />
    </group>
  );
}

function ConfidenceStation({ active }: { active: boolean }) {
  const group = useRef<THREE.Group>(null);
  const amber = useRef<THREE.Mesh>(null);

  useFrame((state, delta) => {
    if (!group.current) return;
    const s = THREE.MathUtils.damp(group.current.scale.x, active ? 1.04 : 0.965, 6, delta);
    group.current.scale.setScalar(s);
    if (amber.current) {
      amber.current.position.x = active ? 1.65 + Math.sin(state.clock.elapsedTime * 1.2) * 0.08 : 1.45;
    }
  });

  return (
    <group ref={group} position={[STATIONS[3], 0, 0]}>
      <Base active={active} />
      <StationLabel active={active}>04 / CONFIDENCE</StationLabel>
      <RoundedBox args={[0.42, 2.72, 1.1]} radius={0.13} position={[-1.28, 1.45, 0]} castShadow>
        <meshPhysicalMaterial color="#c7cac5" metalness={0.34} roughness={0.42} clearcoat={0.3} />
      </RoundedBox>
      <RoundedBox args={[0.42, 2.72, 1.1]} radius={0.13} position={[1.28, 1.45, 0]} castShadow>
        <meshPhysicalMaterial color="#c7cac5" metalness={0.34} roughness={0.42} clearcoat={0.3} />
      </RoundedBox>
      <RoundedBox args={[3.0, 0.42, 1.1]} radius={0.13} position={[0, 2.62, 0]} castShadow>
        <meshPhysicalMaterial color="#d4d6d1" metalness={0.26} roughness={0.46} />
      </RoundedBox>
      <RoundedBox args={[1.55, 0.1, 0.78]} radius={0.04} position={[0, 0.4, 0]} castShadow>
        <meshStandardMaterial color={PALETTE.graphite2} roughness={0.7} />
      </RoundedBox>
      <mesh ref={amber} position={[1.45, 0.28, 1.18]} rotation={[0, -0.43, 0]}>
        <boxGeometry args={[2.75, 0.095, 0.42]} />
        <meshPhysicalMaterial color={PALETTE.warm} roughness={0.7} />
      </mesh>
      <mesh position={[-1.85, 0.29, -0.72]}>
        <boxGeometry args={[1.8, 0.08, 0.36]} />
        <meshStandardMaterial color="#8e9690" />
      </mesh>
      <ActiveLight x={STATIONS[3]} active={active} />
    </group>
  );
}

function ReviewStation({ active }: { active: boolean }) {
  const group = useRef<THREE.Group>(null);
  const screen = useRef<THREE.Mesh>(null);

  useFrame((state, delta) => {
    if (!group.current) return;
    const s = THREE.MathUtils.damp(group.current.scale.x, active ? 1.045 : 0.965, 6, delta);
    group.current.scale.setScalar(s);
    if (screen.current) {
      screen.current.rotation.y = THREE.MathUtils.damp(screen.current.rotation.y, active ? -0.05 : 0, 4, delta);
      screen.current.position.y = 1.82 + (active ? Math.sin(state.clock.elapsedTime * 1.5) * 0.015 : 0);
    }
  });

  return (
    <group ref={group} position={[STATIONS[4], 0, 0]}>
      <Base active={active} />
      <StationLabel active={active}>05 / REVIEW</StationLabel>
      <RoundedBox args={[3.2, 0.32, 1.62]} radius={0.18} position={[0, 0.72, 0]} castShadow>
        <meshPhysicalMaterial color="#d1d2cd" roughness={0.62} metalness={0.08} />
      </RoundedBox>
      <mesh ref={screen} position={[0, 1.82, -0.12]}>
        <boxGeometry args={[2.36, 1.55, 0.16]} />
        <meshPhysicalMaterial color={PALETTE.graphite} roughness={0.5} metalness={0.22} clearcoat={0.25} />
      </mesh>
      <mesh position={[0, 1.82, -0.015]}>
        <planeGeometry args={[1.92, 1.12]} />
        <meshStandardMaterial color="#f3f1ea" emissive="#fffaf0" emissiveIntensity={active ? 0.2 : 0.05} />
      </mesh>
      <RoundedBox args={[0.96, 0.22, 0.44]} radius={0.11} position={[0, 0.96, 0.76]} castShadow>
        <meshPhysicalMaterial color={PALETTE.graphite} roughness={0.58} />
      </RoundedBox>
      <RoundedBox args={[0.7, 0.06, 0.3]} radius={0.03} position={[0.55, 1.35, 0.02]}>
        <meshStandardMaterial color={active ? "#baa06f" : "#989d98"} />
      </RoundedBox>
      <ActiveLight x={STATIONS[4]} active={active} />
    </group>
  );
}

function QuoteStation({ active }: { active: boolean }) {
  const group = useRef<THREE.Group>(null);
  const paper = useRef<THREE.Group>(null);

  useFrame((state, delta) => {
    if (!group.current || !paper.current) return;
    const s = THREE.MathUtils.damp(group.current.scale.x, active ? 1.045 : 0.965, 6, delta);
    group.current.scale.setScalar(s);
    paper.current.position.y = THREE.MathUtils.damp(paper.current.position.y, active ? 1.95 : 1.68, 5, delta);
    paper.current.rotation.z = -0.07 + (active ? Math.sin(state.clock.elapsedTime * 0.8) * 0.01 : 0);
  });

  return (
    <group ref={group} position={[STATIONS[5], 0, 0]}>
      <Base active={active} />
      <StationLabel active={active}>06 / QUOTE</StationLabel>
      <RoundedBox args={[3.0, 3.2, 2.18]} radius={0.36} position={[0, 1.7, 0]} castShadow>
        <meshPhysicalMaterial color="#d2d4cf" roughness={0.36} metalness={0.24} clearcoat={0.42} clearcoatRoughness={0.45} />
      </RoundedBox>
      <group ref={paper} position={[0, 1.68, 1.14]}>
        <RoundedBox args={[1.95, 2.38, 0.1]} radius={0.08} castShadow>
          <meshPhysicalMaterial color="#fffdf7" roughness={0.9} />
        </RoundedBox>
        <mesh position={[0, 0.58, 0.058]}>
          <boxGeometry args={[1.42, 0.08, 0.012]} />
          <meshStandardMaterial color="#4c544e" />
        </mesh>
        {[0.3, 0.08, -0.14].map((y, i) => (
          <mesh key={i} position={[0, y, 0.058]}>
            <boxGeometry args={[1.42 - i * 0.08, 0.05, 0.012]} />
            <meshStandardMaterial color="#c7c9c5" />
          </mesh>
        ))}
        <mesh position={[0.42, -0.72, 0.058]}>
          <boxGeometry args={[0.64, 0.1, 0.012]} />
          <meshStandardMaterial color={PALETTE.graphite} />
        </mesh>
      </group>
      <ActiveLight x={STATIONS[5]} active={active} />
    </group>
  );
}

function ProgressPacket({ progress }: { progress: number }) {
  const ref = useRef<THREE.Group>(null);

  useFrame((state) => {
    if (!ref.current) return;
    ref.current.position.x = THREE.MathUtils.lerp(STATIONS[0], STATIONS[5], progress);
    ref.current.position.y = 0.64 + Math.sin(state.clock.elapsedTime * 2.4) * 0.055;
    ref.current.rotation.y = -0.05 + Math.sin(state.clock.elapsedTime) * 0.025;
  });

  return (
    <group ref={ref} position={[0, 0.64, 0]}>
      <RoundedBox args={[0.72, 0.9, 0.085]} radius={0.05} castShadow>
        <meshPhysicalMaterial color="#fffdf8" roughness={0.86} />
      </RoundedBox>
      <mesh position={[0, 0.17, 0.05]}>
        <boxGeometry args={[0.42, 0.045, 0.01]} />
        <meshStandardMaterial color="#7e837f" />
      </mesh>
      <mesh position={[0, 0.02, 0.05]}>
        <boxGeometry args={[0.48, 0.035, 0.01]} />
        <meshStandardMaterial color="#c1c4c0" />
      </mesh>
    </group>
  );
}

function WorldArchitecture() {
  return (
    <>
      <mesh position={[16, -0.36, 0]} receiveShadow>
        <boxGeometry args={[39, 0.48, 10]} />
        <meshPhysicalMaterial color={PALETTE.floor} roughness={0.9} />
      </mesh>
      <RoundedBox args={[35, 0.075, 0.76]} radius={0.035} position={[16, -0.07, 0]} receiveShadow>
        <meshStandardMaterial color={PALETTE.rail} roughness={0.74} metalness={0.12} />
      </RoundedBox>
      {Array.from({ length: 18 }, (_, i) => (
        <mesh key={i} position={[-0.7 + i * 1.95, -0.022, 0.02]} receiveShadow>
          <boxGeometry args={[0.86, 0.022, 0.17]} />
          <meshStandardMaterial color="#f0efe9" />
        </mesh>
      ))}
      <mesh position={[16, 0.04, -3.2]} receiveShadow>
        <boxGeometry args={[35, 0.12, 0.22]} />
        <meshStandardMaterial color="#c1c3bf" />
      </mesh>
      <mesh position={[16, 0.04, 3.2]} receiveShadow>
        <boxGeometry args={[35, 0.12, 0.22]} />
        <meshStandardMaterial color="#c1c3bf" />
      </mesh>
    </>
  );
}

function Scene({ progress, active }: { progress: number; active: number }) {
  return (
    <>
      <color attach="background" args={["#eceae3"]} />
      <fog attach="fog" args={["#eceae3", 12, 27]} />

      <ambientLight intensity={0.78} />
      <hemisphereLight args={["#fffdf7", "#9b9d98", 0.95]} />
      <directionalLight
        position={[7, 11, 7]}
        intensity={2.15}
        color="#fffdf7"
        castShadow
        shadow-mapSize-width={1536}
        shadow-mapSize-height={1536}
        shadow-camera-left={-18}
        shadow-camera-right={18}
        shadow-camera-top={14}
        shadow-camera-bottom={-14}
        shadow-bias={-0.0005}
      />
      <directionalLight position={[-8, 5, -4]} intensity={0.55} color="#cfd3ce" />

      <WorldArchitecture />

      <IntakeStation active={active === 0} />
      <ExtractStation active={active === 1} />
      <ResolveStation active={active === 2} />
      <ConfidenceStation active={active === 3} />
      <ReviewStation active={active === 4} />
      <QuoteStation active={active === 5} />
      <ProgressPacket progress={progress} />

      <ContactShadows
        position={[16, -0.08, 0]}
        opacity={0.34}
        scale={38}
        blur={2.1}
        far={9}
        resolution={512}
        frames={1}
      />
      <CameraRig progress={progress} />
    </>
  );
}

export function ScrollWorld3D({ progress, active, onReady }: Props) {
  return (
    <WebGLErrorBoundary>
      <div className="scroll-world-webgl">
        <Canvas
          shadows
          dpr={[1, 1.5]}
          camera={{ position: [0.6, 5.2, 8.2], fov: 38, near: 0.1, far: 100 }}
          gl={{
            antialias: true,
            alpha: false,
            powerPreference: "high-performance",
          }}
          onCreated={({ gl }) => {
            gl.shadowMap.enabled = true;
            gl.shadowMap.type = THREE.PCFSoftShadowMap;
            gl.toneMapping = THREE.ACESFilmicToneMapping;
            gl.toneMappingExposure = 1.08;
            gl.outputColorSpace = THREE.SRGBColorSpace;
            onReady?.();
          }}
        >
          <Scene progress={progress} active={active} />
        </Canvas>
      </div>
    </WebGLErrorBoundary>
  );
}
