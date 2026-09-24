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
    () => STATIONS.map((x) => ({ position: [x + 0.75, 5.8, 9.2] as const, target: [x, 0.9, 0] as const, fov: 40 })),
    [],
  );

  const mobileFrames = useMemo(
    () => [
      { position: [0.15, 4.5, 6.4] as const, target: [0, 1.0, 0] as const, fov: 33 },
      { position: [6.55, 4.6, 6.2] as const, target: [6.4, 1.1, 0] as const, fov: 32 },
      { position: [12.95, 4.55, 6.0] as const, target: [12.8, 1.15, 0] as const, fov: 31 },
      { position: [19.35, 4.45, 5.9] as const, target: [19.2, 1.2, 0] as const, fov: 30 },
      { position: [25.65, 4.2, 5.55] as const, target: [25.6, 1.18, 0] as const, fov: 29 },
      { position: [32.05, 4.35, 5.65] as const, target: [32, 1.25, 0] as const, fov: 29 },
    ],
    [],
  );

  useFrame((_, delta) => {
    const p = THREE.MathUtils.clamp(progress, 0, 1) * (STATIONS.length - 1);
    const from = Math.floor(p);
    const to = Math.min(STATIONS.length - 1, from + 1);
    const t = THREE.MathUtils.smoothstep(p - from, 0, 1);
    const mobile = size.width < 720;
    const frames = mobile ? mobileFrames : desktopFrames;
    const a = frames[from];
    const b = frames[to];

    const px = THREE.MathUtils.lerp(a.position[0], b.position[0], t);
    const py = THREE.MathUtils.lerp(a.position[1], b.position[1], t);
    const pz = THREE.MathUtils.lerp(a.position[2], b.position[2], t);
    const tx = THREE.MathUtils.lerp(a.target[0], b.target[0], t);
    const ty = THREE.MathUtils.lerp(a.target[1], b.target[1], t);
    const tz = THREE.MathUtils.lerp(a.target[2], b.target[2], t);
    const fov = THREE.MathUtils.lerp(a.fov, b.fov, t);

    camera.position.x = THREE.MathUtils.damp(camera.position.x, px, 7.5, delta);
    camera.position.y = THREE.MathUtils.damp(camera.position.y, py, 7.5, delta);
    camera.position.z = THREE.MathUtils.damp(camera.position.z, pz, 7.5, delta);

    target.current.x = THREE.MathUtils.damp(target.current.x, tx, 8.5, delta);
    target.current.y = THREE.MathUtils.damp(target.current.y, ty, 8.5, delta);
    target.current.z = THREE.MathUtils.damp(target.current.z, tz, 8.5, delta);

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
    <Html
      center
      transform
      distanceFactor={7}
      position={[0, 3.15, 0]}
      style={{ pointerEvents: "none" }}
    >
      <div className={`world3d-label ${active ? "active" : ""}`}>{children}</div>
    </Html>
  );
}

function Base({ active }: { active: boolean }) {
  return (
    <group>
      <RoundedBox args={[4.7, 0.34, 4.4]} radius={0.22} smoothness={4} position={[0, 0, 0]}>
        <meshStandardMaterial color={active ? "#f7f6f1" : "#e5e5df"} roughness={0.88} metalness={0.04} />
      </RoundedBox>
      <mesh position={[0, 0.2, 0]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <planeGeometry args={[4.1, 3.8]} />
        <meshStandardMaterial color="#efeee9" roughness={1} />
      </mesh>
    </group>
  );
}

function IntakeStation({ active }: { active: boolean }) {
  const docs = [
    { x: -1.0, z: 0.2, rot: -0.16, color: "#ece7e1" },
    { x: 0, z: -0.1, rot: 0.02, color: "#e5e9e5" },
    { x: 1.0, z: 0.2, rot: 0.14, color: "#e9e9e5" },
  ];

  return (
    <group position={[STATIONS[0], 0, 0]} scale={active ? 1.04 : 0.96}>
      <Base active={active} />
      <StationLabel active={active}>01 / INTAKE</StationLabel>
      {docs.map((doc, i) => (
        <group key={i} position={[doc.x, 1.05 + i * 0.08, doc.z]} rotation={[0, doc.rot, doc.rot * 0.35]}>
          <RoundedBox args={[1.05, 1.45, 0.12]} radius={0.08} smoothness={4} castShadow>
            <meshStandardMaterial color={doc.color} roughness={0.72} />
          </RoundedBox>
          <mesh position={[0, 0.35, 0.07]}>
            <boxGeometry args={[0.62, 0.08, 0.015]} />
            <meshStandardMaterial color="#8d918d" />
          </mesh>
          <mesh position={[0, 0.08, 0.07]}>
            <boxGeometry args={[0.72, 0.045, 0.015]} />
            <meshStandardMaterial color="#b7bab6" />
          </mesh>
          <mesh position={[0, -0.08, 0.07]}>
            <boxGeometry args={[0.6, 0.045, 0.015]} />
            <meshStandardMaterial color="#c1c3c0" />
          </mesh>
        </group>
      ))}
    </group>
  );
}

function ExtractStation({ active }: { active: boolean }) {
  return (
    <group position={[STATIONS[1], 0, 0]} scale={active ? 1.04 : 0.96}>
      <Base active={active} />
      <StationLabel active={active}>02 / EXTRACT</StationLabel>
      <RoundedBox args={[2.2, 2.7, 1.9]} radius={0.26} smoothness={5} position={[0, 1.45, 0]} castShadow>
        <meshStandardMaterial color="#d8dad6" roughness={0.5} metalness={0.25} />
      </RoundedBox>
      <RoundedBox args={[1.28, 1.25, 0.16]} radius={0.12} position={[0, 1.15, 1.0]}>
        <meshStandardMaterial color="#222622" roughness={0.82} />
      </RoundedBox>
      {[-1, 0, 1].map((z, i) => (
        <RoundedBox key={i} args={[1.65, 0.28, 0.72]} radius={0.08} position={[2.05, 0.72 + i * 0.48, z * 0.58]} castShadow>
          <meshStandardMaterial color="#faf9f5" roughness={0.9} />
        </RoundedBox>
      ))}
    </group>
  );
}

function ResolveStation({ active }: { active: boolean }) {
  return (
    <group position={[STATIONS[2], 0, 0]} scale={active ? 1.04 : 0.96}>
      <Base active={active} />
      <StationLabel active={active}>03 / RESOLVE</StationLabel>
      <RoundedBox args={[2.5, 2.75, 2.3]} radius={0.32} smoothness={5} position={[-0.35, 1.5, 0]} castShadow>
        <meshStandardMaterial color="#cfd1cd" roughness={0.46} metalness={0.3} />
      </RoundedBox>
      <RoundedBox args={[1.0, 0.3, 1.0]} radius={0.1} position={[-0.35, 1.5, 1.18]}>
        <meshStandardMaterial color="#262a26" roughness={0.78} />
      </RoundedBox>
      <group position={[1.65, 1.1, 0]}>
        {[-0.85, 0, 0.85].map((z, i) => (
          <RoundedBox key={i} args={[1.5, 0.38, 0.6]} radius={0.08} position={[0, i * 0.55 - 0.55, z * 0.28]} castShadow>
            <meshStandardMaterial color="#f9f8f4" roughness={0.9} />
          </RoundedBox>
        ))}
      </group>
      <mesh position={[-2.0, 0.72, 0]} rotation={[0, 0, Math.PI / 2]}>
        <cylinderGeometry args={[0.18, 0.18, 1.2, 18]} />
        <meshStandardMaterial color="#8d918c" metalness={0.42} roughness={0.48} />
      </mesh>
    </group>
  );
}

function ConfidenceStation({ active }: { active: boolean }) {
  return (
    <group position={[STATIONS[3], 0, 0]} scale={active ? 1.04 : 0.96}>
      <Base active={active} />
      <StationLabel active={active}>04 / CONFIDENCE</StationLabel>
      <RoundedBox args={[0.48, 2.7, 1.2]} radius={0.12} position={[-1.2, 1.45, 0]} castShadow>
        <meshStandardMaterial color="#c9ccc8" metalness={0.32} roughness={0.48} />
      </RoundedBox>
      <RoundedBox args={[0.48, 2.7, 1.2]} radius={0.12} position={[1.2, 1.45, 0]} castShadow>
        <meshStandardMaterial color="#c9ccc8" metalness={0.32} roughness={0.48} />
      </RoundedBox>
      <RoundedBox args={[2.85, 0.5, 1.2]} radius={0.12} position={[0, 2.58, 0]} castShadow>
        <meshStandardMaterial color="#d9dbd7" metalness={0.26} roughness={0.52} />
      </RoundedBox>
      <mesh position={[0, 0.38, 0]}>
        <boxGeometry args={[1.5, 0.08, 0.78]} />
        <meshStandardMaterial color="#303530" />
      </mesh>
      <mesh position={[1.5, 0.25, 1.25]} rotation={[0, -0.45, 0]}>
        <boxGeometry args={[2.8, 0.08, 0.48]} />
        <meshStandardMaterial color="#b49a74" />
      </mesh>
    </group>
  );
}

function ReviewStation({ active }: { active: boolean }) {
  return (
    <group position={[STATIONS[4], 0, 0]} scale={active ? 1.04 : 0.96}>
      <Base active={active} />
      <StationLabel active={active}>05 / REVIEW</StationLabel>
      <RoundedBox args={[3.1, 0.34, 1.55]} radius={0.16} position={[0, 0.72, 0]} castShadow>
        <meshStandardMaterial color="#d5d6d1" roughness={0.7} />
      </RoundedBox>
      <RoundedBox args={[2.25, 1.45, 0.16]} radius={0.12} position={[0, 1.72, -0.2]} castShadow>
        <meshStandardMaterial color="#242824" roughness={0.72} />
      </RoundedBox>
      <mesh position={[0, 1.72, -0.1]}>
        <planeGeometry args={[1.82, 1.05]} />
        <meshStandardMaterial color="#f1f1ed" emissive="#ffffff" emissiveIntensity={0.12} />
      </mesh>
      <RoundedBox args={[0.95, 0.28, 0.46]} radius={0.12} position={[0, 0.96, 0.8]}>
        <meshStandardMaterial color="#202420" />
      </RoundedBox>
    </group>
  );
}

function QuoteStation({ active }: { active: boolean }) {
  return (
    <group position={[STATIONS[5], 0, 0]} scale={active ? 1.04 : 0.96}>
      <Base active={active} />
      <StationLabel active={active}>06 / QUOTE</StationLabel>
      <RoundedBox args={[3.0, 3.2, 2.2]} radius={0.3} position={[0, 1.7, 0]} castShadow>
        <meshStandardMaterial color="#d6d8d4" roughness={0.52} metalness={0.22} />
      </RoundedBox>
      <group position={[0, 1.75, 1.16]} rotation={[0, 0, -0.08]}>
        <RoundedBox args={[1.95, 2.35, 0.12]} radius={0.09} castShadow>
          <meshStandardMaterial color="#fffefa" roughness={0.92} />
        </RoundedBox>
        {[0.52, 0.28, 0.04, -0.2].map((y, i) => (
          <mesh key={i} position={[0, y, 0.07]}>
            <boxGeometry args={[i === 1 ? 1.25 : 1.48, 0.065, 0.014]} />
            <meshStandardMaterial color={i === 0 ? "#4d534e" : "#c0c3bf"} />
          </mesh>
        ))}
        <mesh position={[0.42, -0.72, 0.07]}>
          <boxGeometry args={[0.65, 0.11, 0.014]} />
          <meshStandardMaterial color="#292e2a" />
        </mesh>
      </group>
    </group>
  );
}

function ProgressPacket({ progress }: { progress: number }) {
  const ref = useRef<THREE.Group>(null);

  useFrame((state) => {
    if (!ref.current) return;
    ref.current.position.x = THREE.MathUtils.lerp(STATIONS[0], STATIONS[5], progress);
    ref.current.position.y = 0.6 + Math.sin(state.clock.elapsedTime * 2.5) * 0.07;
    ref.current.rotation.y = -0.08 + Math.sin(state.clock.elapsedTime * 1.2) * 0.03;
  });

  return (
    <group ref={ref} position={[0, 0.6, 0]}>
      <RoundedBox args={[0.72, 0.9, 0.09]} radius={0.05} castShadow>
        <meshStandardMaterial color="#fffefa" roughness={0.82} />
      </RoundedBox>
      <mesh position={[0, 0.16, 0.055]}>
        <boxGeometry args={[0.42, 0.045, 0.01]} />
        <meshStandardMaterial color="#7e837f" />
      </mesh>
      <mesh position={[0, 0.02, 0.055]}>
        <boxGeometry args={[0.48, 0.035, 0.01]} />
        <meshStandardMaterial color="#c1c4c0" />
      </mesh>
    </group>
  );
}

function Scene({ progress, active }: { progress: number; active: number }) {
  return (
    <>
      <color attach="background" args={["#efeee9"]} />
      <fog attach="fog" args={["#efeee9", 13, 28]} />
      <ambientLight intensity={1.55} />
      <hemisphereLight args={["#ffffff", "#b7b5ad", 1.0]} />
      <directionalLight
        position={[8, 13, 8]}
        intensity={2.6}
        castShadow
        shadow-mapSize-width={1024}
        shadow-mapSize-height={1024}
        shadow-camera-left={-18}
        shadow-camera-right={18}
        shadow-camera-top={14}
        shadow-camera-bottom={-14}
      />
      <pointLight position={[STATIONS[active], 5, 4]} intensity={18} distance={10} color="#ffffff" />

      <mesh position={[16, -0.32, 0]} receiveShadow>
        <boxGeometry args={[39, 0.42, 10]} />
        <meshStandardMaterial color="#e3e2dc" roughness={1} />
      </mesh>

      <mesh position={[16, -0.08, 0]} receiveShadow>
        <boxGeometry args={[34, 0.08, 0.72]} />
        <meshStandardMaterial color="#bfc2be" roughness={0.74} metalness={0.08} />
      </mesh>

      {Array.from({ length: 18 }, (_, i) => (
        <mesh key={i} position={[-0.7 + i * 1.95, -0.025, 0.02]} receiveShadow>
          <boxGeometry args={[0.86, 0.025, 0.18]} />
          <meshStandardMaterial color="#f3f2ed" />
        </mesh>
      ))}

      <IntakeStation active={active === 0} />
      <ExtractStation active={active === 1} />
      <ResolveStation active={active === 2} />
      <ConfidenceStation active={active === 3} />
      <ReviewStation active={active === 4} />
      <QuoteStation active={active === 5} />
      <ProgressPacket progress={progress} />

      <ContactShadows
        position={[16, -0.08, 0]}
        opacity={0.28}
        scale={38}
        blur={2.8}
        far={8}
        resolution={256}
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
          camera={{ position: [0.15, 4.5, 6.4], fov: 33, near: 0.1, far: 100 }}
          gl={{
            antialias: true,
            alpha: false,
            powerPreference: "high-performance",
          }}
          onCreated={({ gl }) => {
            gl.shadowMap.enabled = true;
            gl.shadowMap.type = THREE.PCFSoftShadowMap;
            gl.toneMapping = THREE.ACESFilmicToneMapping;
            gl.toneMappingExposure = 1.05;
            onReady?.();
          }}
        >
          <Scene progress={progress} active={active} />
        </Canvas>
      </div>
    </WebGLErrorBoundary>
  );
}
