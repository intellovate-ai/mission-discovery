"use client";
// The Clean Room: the one bright scene, so it reads instantly as "build mode". The CubeSat sits on
// an integration stand at center, built live from the design; the four crew stand at their
// stations and the active role steps up under a spotlight. Slow cinematic camera drift.
import { useEffect, useMemo, useRef, useState } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { Environment, Lightformer, RoundedBox } from "@react-three/drei";
import * as THREE from "three";
import { ROLES, type Design, type RoleId } from "@/lib/protocol";
import type { SceneProps } from "./types";
import Astronaut from "./Astronaut";
import Spacecraft from "./Spacecraft";
import { ROLE_COLOR, useDevOverrides } from "./sceneKit";

const STAND_TOP = 1.02;

/** Stations in a half ring behind the stand (the camera looks from +z). */
const STATIONS: Record<RoleId, [number, number]> = {
  zenith: [-1.85, -1.25],
  forge: [-0.75, -2.15],
  prism: [0.75, -2.15],
  vector: [1.85, -1.25],
};

const CYCLE: Design[] = [
  {},
  { bus: "bus-3u" },
  { bus: "bus-3u", solar: "solar-body" },
  { bus: "bus-3u", solar: "solar-body", instrument1: "inst-color" },
  { bus: "bus-3u", solar: "solar-body", instrument1: "inst-color", radio: "radio-uhf" },
  { bus: "bus-3u", solar: "solar-wings", instrument1: "inst-thermal", radio: "radio-uhf", pointing: "pointing-wheels" },
  { bus: "bus-6u", solar: "solar-wings", instrument1: "inst-thermal", instrument2: "inst-multi", radio: "radio-sband", pointing: "pointing-wheels", thruster: "thruster" },
  { bus: "bus-6u", solar: "solar-body", instrument1: "inst-radar", radio: "radio-sband" },
  { bus: "bus-1u", solar: "solar-body", instrument1: "inst-color", radio: "radio-uhf" },
];

export default function CleanRoom(props: SceneProps) {
  const { state, activeRole, cycle } = useDevOverrides(props.state, props.sim, props.activeRole);
  const [cycleIx, setCycleIx] = useState(0);
  useEffect(() => {
    if (!cycle) return;
    const id = setInterval(() => setCycleIx((i) => (i + 1) % CYCLE.length), 2600);
    return () => clearInterval(id);
  }, [cycle]);
  const design = cycle ? CYCLE[cycleIx] : state.design;

  return (
    <Canvas
      shadows="percentage"
      dpr={[1, 1.75]}
      camera={{ position: [0, 1.45, 1.6], fov: 42, near: 0.05, far: 60 }}
      gl={{ antialias: true }}
      style={{ position: "absolute", inset: 0 }}
    >
      <color attach="background" args={["#e7eaee"]} />
      <fog attach="fog" args={["#e7eaee", 7, 16]} />
      <hemisphereLight args={["#ffffff", "#b9c0ca", 0.75]} />
      <directionalLight
        position={[2.5, 5.5, 2.2]}
        intensity={2.4}
        castShadow
        shadow-mapSize={[2048, 2048]}
        shadow-bias={-0.0004}
        shadow-normalBias={0.02}
        shadow-camera-left={-4}
        shadow-camera-right={4}
        shadow-camera-top={4}
        shadow-camera-bottom={-4}
        shadow-camera-near={0.5}
        shadow-camera-far={14}
      />
      <Environment resolution={256} frames={1}>
        <color attach="background" args={["#d9dde3"]} />
        {[-2, 0, 2].map((x) =>
          [-2, 0, 2].map((z) => <Lightformer key={`${x}${z}`} form="rect" intensity={2.2} position={[x, 3.2, z]} rotation-x={Math.PI / 2} scale={[1.4, 0.7, 1]} />),
        )}
        <Lightformer form="rect" intensity={1} position={[0, 1.5, -5]} scale={[10, 3, 1]} />
        <Lightformer form="rect" intensity={0.8} position={[5, 1.5, 0]} rotation-y={-Math.PI / 2} scale={[10, 3, 1]} />
      </Environment>

      <Room />
      <Stand design={design} />
      {ROLES.map((r) => (
        <Station key={r} role={r} active={activeRole === r} dimmed={!!activeRole && activeRole !== r} />
      ))}
      <CameraDrift activeRole={activeRole ?? null} />
    </Canvas>
  );
}

function Stand({ design }: { design: Design }) {
  const turn = useRef<THREE.Group>(null);
  useFrame((st) => {
    if (turn.current) turn.current.rotation.y = Math.sin(st.clock.elapsedTime * 0.22) * 0.75;
  });
  const mats = useMemo(
    () => ({
      steel: new THREE.MeshStandardMaterial({ color: "#c5cad1", roughness: 0.3, metalness: 0.85 }),
      base: new THREE.MeshStandardMaterial({ color: "#8d949c", roughness: 0.45, metalness: 0.6 }),
      top: new THREE.MeshStandardMaterial({ color: "#2b2f35", roughness: 0.5, metalness: 0.4 }),
    }),
    [],
  );
  return (
    <group>
      <mesh position={[0, 0.03, 0]} material={mats.base} castShadow receiveShadow>
        <cylinderGeometry args={[0.36, 0.4, 0.06, 40]} />
      </mesh>
      <mesh position={[0, 0.5, 0]} material={mats.steel} castShadow receiveShadow>
        <cylinderGeometry args={[0.06, 0.08, 0.9, 24]} />
      </mesh>
      <mesh position={[0, 0.96, 0]} material={mats.steel} castShadow>
        <cylinderGeometry args={[0.16, 0.08, 0.06, 32]} />
      </mesh>
      <group ref={turn} position={[0, STAND_TOP - 0.03, 0]}>
        <mesh position={[0, 0.015, 0]} material={mats.top} castShadow receiveShadow>
          <cylinderGeometry args={[0.2, 0.2, 0.03, 40]} />
        </mesh>
        <group position={[0, 0.03, 0]}>
          <Spacecraft design={design} />
        </group>
      </group>
    </group>
  );
}

function Station({ role, active, dimmed }: { role: RoleId; active: boolean; dimmed: boolean }) {
  const [x, z] = STATIONS[role];
  const face = Math.atan2(-x, -z);
  const screen = useRef<THREE.MeshStandardMaterial>(null);
  useFrame((_, dt) => {
    const s = screen.current;
    if (s) s.emissiveIntensity = THREE.MathUtils.damp(s.emissiveIntensity, active ? 1.1 : dimmed ? 0.25 : 0.6, 4, dt);
  });
  return (
    <group position={[x, 0, z]} rotation={[0, face, 0]}>
      <Astronaut role={role} active={active} dim={dimmed} spotIntensity={28} />
      {/* console behind them */}
      <group position={[0, 0, -0.85]}>
        <RoundedBox args={[0.9, 0.85, 0.45]} radius={0.03} position={[0, 0.425, 0]} castShadow receiveShadow>
          <meshStandardMaterial color="#f4f5f7" roughness={0.55} />
        </RoundedBox>
        <mesh position={[0, 0.86, 0.06]} rotation={[-0.5, 0, 0]} castShadow>
          <boxGeometry args={[0.82, 0.02, 0.36]} />
          <meshStandardMaterial color="#c9ced5" roughness={0.4} metalness={0.4} />
        </mesh>
        <group position={[0, 1.22, -0.12]} rotation={[-0.08, 0, 0]}>
          <mesh castShadow>
            <boxGeometry args={[0.7, 0.42, 0.03]} />
            <meshStandardMaterial color="#1b1e23" roughness={0.5} />
          </mesh>
          <mesh position={[0, 0, 0.016]}>
            <planeGeometry args={[0.64, 0.36]} />
            <meshStandardMaterial ref={screen} color="#0d1117" emissive={ROLE_COLOR[role]} emissiveIntensity={0.6} />
          </mesh>
        </group>
        <mesh position={[0, 0.98, -0.12]}>
          <cylinderGeometry args={[0.02, 0.02, 0.2, 8]} />
          <meshStandardMaterial color="#9aa0a7" metalness={0.7} roughness={0.3} />
        </mesh>
      </group>
      {/* floor marking for the station */}
      <mesh position={[0, 0.002, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[0.42, 0.45, 48]} />
        <meshStandardMaterial color={ROLE_COLOR[role]} roughness={0.6} transparent opacity={active ? 0.9 : 0.35} />
      </mesh>
    </group>
  );
}

function Room() {
  const panels = useMemo(() => {
    const out: [number, number][] = [];
    for (let x = -4; x <= 4; x += 2) for (let z = -4; z <= 2; z += 2) out.push([x, z]);
    return out;
  }, []);
  return (
    <group>
      {/* epoxy floor */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <planeGeometry args={[16, 16]} />
        <meshStandardMaterial color="#d7dbe0" roughness={0.28} metalness={0.05} />
      </mesh>
      {/* ESD mat under the stand */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.001, 0]} receiveShadow>
        <circleGeometry args={[0.9, 64]} />
        <meshStandardMaterial color="#9fb3c2" roughness={0.7} />
      </mesh>
      {/* walls with panel seams */}
      <mesh position={[0, 2, -4.5]} receiveShadow>
        <planeGeometry args={[16, 4]} />
        <meshStandardMaterial color="#f3f4f6" roughness={0.8} />
      </mesh>
      {[-3, -1.5, 0, 1.5, 3].map((x) => (
        <mesh key={x} position={[x, 2, -4.49]}>
          <planeGeometry args={[0.02, 4]} />
          <meshStandardMaterial color="#d3d7dc" />
        </mesh>
      ))}
      <mesh position={[-5, 2, 0]} rotation={[0, Math.PI / 2, 0]} receiveShadow>
        <planeGeometry args={[16, 4]} />
        <meshStandardMaterial color="#eef0f2" roughness={0.8} />
      </mesh>
      <mesh position={[5, 2, 0]} rotation={[0, -Math.PI / 2, 0]} receiveShadow>
        <planeGeometry args={[16, 4]} />
        <meshStandardMaterial color="#eef0f2" roughness={0.8} />
      </mesh>
      {/* observation window on the back wall */}
      <mesh position={[2.6, 1.8, -4.47]}>
        <planeGeometry args={[2.2, 0.9]} />
        <meshStandardMaterial color="#5f6e7d" roughness={0.05} metalness={0.6} />
      </mesh>
      {/* ceiling with soft light panels */}
      <mesh position={[0, 3.2, 0]} rotation={[Math.PI / 2, 0, 0]}>
        <planeGeometry args={[16, 16]} />
        <meshStandardMaterial color="#f5f6f8" roughness={0.9} />
      </mesh>
      {panels.map(([x, z]) => (
        <mesh key={`${x}${z}`} position={[x, 3.19, z]} rotation={[Math.PI / 2, 0, 0]}>
          <planeGeometry args={[1.2, 0.6]} />
          <meshBasicMaterial color="#ffffff" />
        </mesh>
      ))}
    </group>
  );
}

function CameraDrift({ activeRole }: { activeRole: RoleId | null }) {
  const look = useMemo(() => new THREE.Vector3(0, 1.18, 0), []);
  const bias = useRef(0);
  useFrame((st, dt) => {
    const t = st.clock.elapsedTime;
    // lean a little toward whoever has the floor
    const want = activeRole ? Math.atan2(STATIONS[activeRole][0], 4) * 0.5 : 0;
    bias.current = THREE.MathUtils.damp(bias.current, want, 1.2, dt);
    const a = Math.sin(t * 0.07) * 0.22 + bias.current;
    const r = 1.6 + Math.sin(t * 0.05) * 0.12;
    const cam = st.camera;
    cam.position.set(Math.sin(a) * r, 1.5 + Math.sin(t * 0.09) * 0.05, Math.cos(a) * r);
    look.set(Math.sin(a) * 0.05, 1.08, -0.6);
    cam.lookAt(look);
  });
  return null;
}
