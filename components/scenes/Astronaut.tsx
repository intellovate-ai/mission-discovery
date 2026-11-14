"use client";
// One shared astronaut figure built from primitives (Art Bible section 1). The role color goes on
// the visor tint, the shoulder band and the backpack light; each role holds one prop.
// Use inside an R3F <Canvas>. Origin is at the feet, the figure faces +z, about 1.8 m tall.
import { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { RoundedBox } from "@react-three/drei";
import * as THREE from "three";
import type { RoleId } from "@/lib/protocol";
import { ROLE_COLOR } from "./sceneKit";

export interface AstronautProps {
  role: RoleId;
  /** Their move: spotlight on and a small step forward. */
  active?: boolean;
  /** Pushed back into shadow while someone else has the floor. */
  dim?: boolean;
  /** Step forward when active (default true). */
  step?: boolean;
  /** Peak intensity of the overhead spotlight when active. */
  spotIntensity?: number;
  position?: [number, number, number];
  rotation?: [number, number, number];
  scale?: number;
}

const PHASE: Record<RoleId, number> = { zenith: 0, forge: 1.7, prism: 3.1, vector: 4.6 };

function useMaterials(role: RoleId) {
  return useMemo(() => {
    const c = new THREE.Color(ROLE_COLOR[role]);
    const visorTint = c.clone().multiplyScalar(0.55);
    const m = {
      suit: new THREE.MeshStandardMaterial({ color: "#e8eaed", roughness: 0.78, metalness: 0 }),
      grey: new THREE.MeshStandardMaterial({ color: "#9ba1a8", roughness: 0.6, metalness: 0.2 }),
      dark: new THREE.MeshStandardMaterial({ color: "#2a2d33", roughness: 0.55, metalness: 0.3 }),
      metal: new THREE.MeshStandardMaterial({ color: "#c9ced4", roughness: 0.25, metalness: 0.9 }),
      visor: new THREE.MeshStandardMaterial({ color: visorTint, roughness: 0.08, metalness: 0.85, envMapIntensity: 1.6 }),
      band: new THREE.MeshStandardMaterial({ color: c, roughness: 0.45 }),
      light: new THREE.MeshStandardMaterial({ color: c, emissive: c, emissiveIntensity: 1.6, roughness: 0.4 }),
      screen: new THREE.MeshStandardMaterial({ color: "#0d1117", emissive: "#0d1117", emissiveIntensity: 1, roughness: 0.3 }),
    };
    const base = Object.fromEntries(Object.entries(m).map(([k, v]) => [k, v.color.clone()])) as Record<keyof typeof m, THREE.Color>;
    /** Darken everything by `lit` (0..1); the backpack light breathes with `t`. */
    const apply = (lit: number, t: number) => {
      for (const k of Object.keys(m) as (keyof typeof m)[]) m[k].color.copy(base[k]).multiplyScalar(lit);
      m.light.emissiveIntensity = 1.6 * (0.35 + 0.65 * lit) * (0.85 + 0.15 * Math.sin(t * 3));
      m.screen.emissiveIntensity = lit;
    };
    return { m, apply, roleColor: c };
  }, [role]);
}

export default function Astronaut({ role, active = false, dim = false, step = true, spotIntensity = 40, position, rotation, scale = 1 }: AstronautProps) {
  const { m, apply, roleColor } = useMaterials(role);
  const root = useRef<THREE.Group>(null);
  const body = useRef<THREE.Group>(null);
  const head = useRef<THREE.Group>(null);
  const lShoulder = useRef<THREE.Group>(null);
  const lElbow = useRef<THREE.Group>(null);
  const rShoulder = useRef<THREE.Group>(null);
  const rElbow = useRef<THREE.Group>(null);
  const propSpin = useRef<THREE.Group>(null);
  const spot = useRef<THREE.SpotLight>(null);
  const lit = useRef(dim ? 0.35 : 1);
  const fwd = useRef(0);
  const spotTarget = useMemo(() => {
    const o = new THREE.Object3D();
    o.position.set(0, 1.1, 0);
    return o;
  }, []);

  useFrame((st, dt) => {
    const t = st.clock.elapsedTime + PHASE[role];
    // lighting state
    const wantLit = dim && !active ? 0.22 : 1;
    lit.current = THREE.MathUtils.damp(lit.current, wantLit, 4, dt);
    apply(lit.current, t);
    fwd.current = THREE.MathUtils.damp(fwd.current, active ? 1 : 0, 3, dt);
    if (spot.current) spot.current.intensity = spotIntensity * fwd.current;
    if (body.current) {
      body.current.position.z = step ? 0.35 * fwd.current : 0;
      body.current.position.y = Math.sin(t * 1.3) * 0.006;
      body.current.rotation.z = Math.sin(t * 0.6) * 0.012;
    }
    idle(role, t, { head, lShoulder, lElbow, rShoulder, rElbow, propSpin });
  });

  return (
    <group ref={root} position={position} rotation={rotation} scale={scale}>
      <spotLight ref={spot} position={[0, 3.6, 1.2]} angle={0.42} penumbra={0.7} distance={9} decay={1.6} intensity={0} color="#fff6ea" target={spotTarget} />
      <primitive object={spotTarget} />
      <group ref={body}>
        {/* boots */}
        {[-0.11, 0.11].map((x) => (
          <RoundedBox key={x} args={[0.14, 0.1, 0.26]} radius={0.03} position={[x, 0.05, 0.03]} material={m.grey} castShadow />
        ))}
        {/* legs */}
        {[-0.11, 0.11].map((x) => (
          <group key={x}>
            <mesh position={[x, 0.36, 0]} material={m.suit} castShadow>
              <capsuleGeometry args={[0.085, 0.36, 4, 10]} />
            </mesh>
            <mesh position={[x, 0.74, 0]} material={m.suit} castShadow>
              <capsuleGeometry args={[0.095, 0.24, 4, 10]} />
            </mesh>
            <mesh position={[x, 0.56, 0.06]} material={m.grey}>
              <boxGeometry args={[0.12, 0.08, 0.06]} />
            </mesh>
          </group>
        ))}
        {/* hips and torso */}
        <RoundedBox args={[0.38, 0.18, 0.26]} radius={0.06} position={[0, 0.94, 0]} material={m.suit} castShadow />
        <mesh position={[0, 1.2, 0]} scale={[1.12, 1, 0.78]} material={m.suit} castShadow>
          <capsuleGeometry args={[0.2, 0.26, 4, 14]} />
        </mesh>
        {/* chest control box */}
        <RoundedBox args={[0.2, 0.12, 0.07]} radius={0.015} position={[0, 1.18, 0.17]} material={m.grey} castShadow />
        <mesh position={[-0.05, 1.19, 0.207]} material={m.dark}>
          <boxGeometry args={[0.06, 0.035, 0.005]} />
        </mesh>
        <mesh position={[0.05, 1.19, 0.207]} material={m.dark}>
          <cylinderGeometry args={[0.015, 0.015, 0.01, 10]} />
        </mesh>
        {/* neck ring */}
        <mesh position={[0, 1.46, 0]} rotation={[Math.PI / 2, 0, 0]} material={m.metal}>
          <torusGeometry args={[0.13, 0.025, 8, 24]} />
        </mesh>
        {/* backpack with role light */}
        <RoundedBox args={[0.42, 0.52, 0.2]} radius={0.04} position={[0, 1.2, -0.24]} material={m.suit} castShadow />
        <RoundedBox args={[0.36, 0.12, 0.06]} radius={0.02} position={[0, 1.02, -0.36]} material={m.grey} />
        <mesh position={[0, 1.36, -0.345]} material={m.light}>
          <boxGeometry args={[0.22, 0.035, 0.02]} />
        </mesh>
        {role === "forge" && <ToolBelt m={m} />}

        {/* head */}
        <group ref={head} position={[0, 1.48, 0]}>
          <mesh position={[0, 0.16, 0]} material={m.suit} castShadow>
            <sphereGeometry args={[0.175, 24, 18]} />
          </mesh>
          {/* visor: front cap of a slightly larger sphere */}
          <mesh position={[0, 0.16, 0.005]} rotation={[0, 0, 0]} material={m.visor}>
            <sphereGeometry args={[0.172, 24, 16, -Math.PI * 0.32 + Math.PI / 2, Math.PI * 0.64, Math.PI * 0.3, Math.PI * 0.36]} />
          </mesh>
          <mesh position={[0, 0.16, 0]} rotation={[0.2, 0, 0]} material={m.grey}>
            <torusGeometry args={[0.178, 0.012, 6, 30, Math.PI]} />
          </mesh>
          {role === "vector" && <Headset m={m} />}
        </group>

        {/* arms */}
        <Arm side={-1} shoulder={lShoulder} elbow={lElbow} m={m}>
          {role === "zenith" && <Tablet m={m} roleColor={roleColor} />}
        </Arm>
        <Arm side={1} shoulder={rShoulder} elbow={rElbow} m={m}>
          {role === "forge" && (
            <group ref={propSpin}>
              <Wrench m={m} />
            </group>
          )}
          {role === "prism" && <CameraProp m={m} />}
        </Arm>
      </group>
    </group>
  );
}

type Mats = ReturnType<typeof useMaterials>["m"];
type R = React.RefObject<THREE.Group | null>;

function Arm({ side, shoulder, elbow, m, children }: { side: 1 | -1; shoulder: R; elbow: R; m: Mats; children?: React.ReactNode }) {
  return (
    <group ref={shoulder} position={[0.29 * side, 1.37, 0]}>
      <mesh position={[0, -0.13, 0]} material={m.suit} castShadow>
        <capsuleGeometry args={[0.075, 0.18, 4, 10]} />
      </mesh>
      {/* shoulder band in role color */}
      <mesh position={[0, -0.05, 0]} rotation={[Math.PI / 2, 0, 0]} material={m.band}>
        <torusGeometry args={[0.079, 0.022, 8, 20]} />
      </mesh>
      <group ref={elbow} position={[0, -0.29, 0]}>
        <mesh position={[0, -0.12, 0]} material={m.suit} castShadow>
          <capsuleGeometry args={[0.068, 0.16, 4, 10]} />
        </mesh>
        <mesh position={[0, -0.215, 0]} rotation={[Math.PI / 2, 0, 0]} material={m.grey}>
          <torusGeometry args={[0.066, 0.016, 6, 16]} />
        </mesh>
        <group position={[0, -0.28, 0]}>
          <mesh material={m.grey} castShadow>
            <sphereGeometry args={[0.062, 12, 10]} />
          </mesh>
          {children}
        </group>
      </group>
    </group>
  );
}

function Tablet({ m, roleColor }: { m: Mats; roleColor: THREE.Color }) {
  // Held flat in the left hand; screen shows a budget bar.
  return (
    <group position={[0.06, -0.04, 0.02]} rotation={[0, 0, 0.15]}>
      <RoundedBox args={[0.24, 0.17, 0.014]} radius={0.006} position={[0, 0, 0.07]} material={m.dark} />
      <mesh position={[0, 0, 0.078]} material={m.screen}>
        <planeGeometry args={[0.215, 0.145]} />
      </mesh>
      {/* budget bar: track and fill */}
      <mesh position={[0, -0.02, 0.0795]}>
        <planeGeometry args={[0.17, 0.022]} />
        <meshBasicMaterial color="#23272E" />
      </mesh>
      <mesh position={[-0.025, -0.02, 0.08]}>
        <planeGeometry args={[0.12, 0.022]} />
        <meshBasicMaterial color={roleColor} />
      </mesh>
      <mesh position={[-0.04, 0.03, 0.08]}>
        <planeGeometry args={[0.09, 0.012]} />
        <meshBasicMaterial color="#979797" />
      </mesh>
    </group>
  );
}

function Wrench({ m }: { m: Mats }) {
  return (
    <group position={[0, -0.05, 0.03]}>
      <mesh position={[0, -0.1, 0]} material={m.metal} castShadow>
        <boxGeometry args={[0.025, 0.2, 0.012]} />
      </mesh>
      <mesh position={[0, -0.215, 0]} material={m.metal}>
        <torusGeometry args={[0.03, 0.012, 6, 14, Math.PI * 1.5]} />
      </mesh>
      <mesh position={[0, 0.01, 0]} material={m.metal}>
        <torusGeometry args={[0.024, 0.01, 6, 14]} />
      </mesh>
    </group>
  );
}

function CameraProp({ m }: { m: Mats }) {
  return (
    <group position={[0, -0.06, 0.06]}>
      <RoundedBox args={[0.13, 0.09, 0.08]} radius={0.012} material={m.dark} castShadow />
      <mesh position={[0, 0, 0.065]} rotation={[Math.PI / 2, 0, 0]} material={m.grey}>
        <cylinderGeometry args={[0.032, 0.036, 0.06, 16]} />
      </mesh>
      <mesh position={[0, 0, 0.096]} rotation={[Math.PI / 2, 0, 0]} material={m.visor}>
        <cylinderGeometry args={[0.025, 0.025, 0.004, 16]} />
      </mesh>
      {/* screen on the back with a light spectrum */}
      {["#6a3df0", "#2f6df6", "#18b26b", "#f2d13a", "#f28a1e", "#e0342b"].map((c, i) => (
        <mesh key={c} position={[-0.045 + i * 0.018, 0, -0.041]} rotation={[0, Math.PI, 0]}>
          <planeGeometry args={[0.018, 0.05]} />
          <meshBasicMaterial color={c} />
        </mesh>
      ))}
    </group>
  );
}

function Headset({ m }: { m: Mats }) {
  return (
    <group position={[0, 0.16, 0]}>
      <mesh rotation={[0, Math.PI / 2, 0]} material={m.dark}>
        <torusGeometry args={[0.19, 0.012, 6, 24, Math.PI]} />
      </mesh>
      {[-1, 1].map((s) => (
        <mesh key={s} position={[0.19 * s, 0, 0]} rotation={[0, 0, Math.PI / 2]} material={m.dark}>
          <cylinderGeometry args={[0.05, 0.05, 0.035, 16]} />
        </mesh>
      ))}
      {/* boom mic */}
      <mesh position={[0.17, -0.06, 0.1]} rotation={[0.9, 0, 0.3]} material={m.dark}>
        <cylinderGeometry args={[0.006, 0.006, 0.18, 6]} />
      </mesh>
      {/* small antenna with a role-colored tip */}
      <mesh position={[0.205, 0.1, 0]} material={m.metal}>
        <cylinderGeometry args={[0.004, 0.004, 0.18, 6]} />
      </mesh>
      <mesh position={[0.205, 0.195, 0]} material={m.light}>
        <sphereGeometry args={[0.012, 8, 6]} />
      </mesh>
    </group>
  );
}

function ToolBelt({ m }: { m: Mats }) {
  return (
    <group position={[0, 0.94, 0]}>
      <mesh rotation={[Math.PI / 2, 0, 0]} scale={[1.02, 0.72, 1]} material={m.dark}>
        <torusGeometry args={[0.2, 0.025, 6, 28]} />
      </mesh>
      <RoundedBox args={[0.08, 0.1, 0.05]} radius={0.01} position={[-0.2, -0.04, 0.06]} material={m.grey} />
      <RoundedBox args={[0.07, 0.09, 0.05]} radius={0.01} position={[0.16, -0.04, 0.12]} material={m.grey} />
    </group>
  );
}

const ease = (x: number) => x * x * (3 - 2 * x);
/** 0..1..0 bump inside each `period` seconds, lasting `len` seconds. */
function pulse(t: number, period: number, len: number) {
  const p = ((t % period) + period) % period;
  if (p > len) return 0;
  return Math.sin((p / len) * Math.PI);
}

function idle(role: RoleId, t: number, r: { head: R; lShoulder: R; lElbow: R; rShoulder: R; rElbow: R; propSpin: R }) {
  const { head, lShoulder, lElbow, rShoulder, rElbow, propSpin } = r;
  if (!head.current || !lShoulder.current || !lElbow.current || !rShoulder.current || !rElbow.current) return;
  const sway = Math.sin(t * 1.1) * 0.03;
  // relaxed defaults
  lShoulder.current.rotation.set(-0.05 + sway, 0, -0.12);
  lElbow.current.rotation.set(-0.25, 0, 0);
  rShoulder.current.rotation.set(-0.05 - sway, 0, 0.12);
  rElbow.current.rotation.set(-0.25, 0, 0);
  head.current.rotation.set(Math.sin(t * 0.5) * 0.04, Math.sin(t * 0.33) * 0.12, 0);

  if (role === "zenith") {
    // Tablet in the left hand, right finger taps it; glances down at it now and then.
    lShoulder.current.rotation.set(-0.45, 0.25, -0.08);
    lElbow.current.rotation.set(-1.25, 0, 0);
    const tap = Math.max(0, Math.sin(t * 7)) * pulse(t, 5, 1.8);
    rShoulder.current.rotation.set(-0.5, -0.35, 0.05);
    rElbow.current.rotation.set(-1.1 + tap * 0.25, 0, 0);
    head.current.rotation.x = 0.25 * pulse(t, 5, 2.6);
    head.current.rotation.y = -0.15 * pulse(t, 5, 2.6) + Math.sin(t * 0.33) * 0.08;
  } else if (role === "forge") {
    // Wrench in the right hand; spins it once every few seconds.
    rShoulder.current.rotation.set(-0.2, 0, 0.1);
    rElbow.current.rotation.set(-0.95, 0, 0);
    if (propSpin.current) {
      const p = ((t % 4.5) + 4.5) % 4.5;
      propSpin.current.rotation.y = p < 0.8 ? ease(p / 0.8) * Math.PI * 2 : 0;
    }
  } else if (role === "prism") {
    // Raises the camera to the visor, looks around, lowers it.
    const up = ease(Math.min(1, pulse(t, 7, 3.4) * 1.6));
    rShoulder.current.rotation.set(-0.2 - up * 1.05, -0.2 * up, 0.1);
    rElbow.current.rotation.set(-0.9 - up * 0.75, 0, 0);
    head.current.rotation.y = Math.sin(t * 0.9) * (0.15 + 0.25 * (1 - up));
  } else {
    // Touches the headset, nods.
    const touch = ease(Math.min(1, pulse(t, 6, 2.4) * 1.5));
    rShoulder.current.rotation.set(-0.35 * touch, 0, 0.12 + 1.9 * touch);
    rElbow.current.rotation.set(-0.25 - 1.6 * touch, 0, 0);
    head.current.rotation.x = 0.18 * Math.max(0, Math.sin(t * 5)) * pulse(t, 6, 2.4);
  }
}
