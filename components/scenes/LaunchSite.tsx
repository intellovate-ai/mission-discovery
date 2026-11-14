"use client";
// Launch Site: a coastal pad at dusk, low warm sun, long shadows. The rocket stands on its
// launch mount beside a lattice gantry.
//   Lobby (stepIndex -1): character select. The four crew stand on the gantry walkway; a role
//   lights up (spotlight, full color) once it is claimed.
//   Otherwise: the rocket is the hero; the camera drifts slowly around it.
import { useLayoutEffect, useMemo, useRef } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { Environment, Sky } from "@react-three/drei";
import { Bloom, EffectComposer, ToneMapping, Vignette } from "@react-three/postprocessing";
import * as THREE from "three";
import { ROLES, type RoleId } from "@/lib/protocol";
import type { SceneProps } from "./types";
import Astronaut from "./Astronaut";
import { seeded, useDevOverrides } from "./sceneKit";

const ACES_FILMIC = 6; // postprocessing ToneMappingMode.ACES_FILMIC
const SUN_DIR = new THREE.Vector3(-1, 0.03, -0.72).normalize();
const MOUNT_H = 6;
const TOWER_X = -7.5;

interface RocketSpec {
  height: number;
  radius: number;
  body: string;
  band: string;
  fairingR: number;
  fairingH: number;
  engines: number;
}
const ROCKET: Record<string, RocketSpec> = {
  // A medium launcher that carries many small satellites as rideshare.
  rideshare: { height: 44, radius: 1.85, body: "#eceef1", band: "#1c1e22", fairingR: 2.5, fairingH: 11, engines: 9 },
  // A small dedicated launcher: one customer, its own rocket.
  dedicated: { height: 19, radius: 0.62, body: "#202226", band: "#e8e9ec", fairingR: 0.62, fairingH: 3.6, engines: 5 },
};

/** Walkway spots for character select, left to right. */
const LOBBY_X: Record<RoleId, number> = { zenith: -5.2, forge: -4.0, prism: -2.8, vector: -1.6 };
const LOBBY_Z = 4.2;

export default function LaunchSite(props: SceneProps) {
  const { state } = useDevOverrides(props.state, props.sim, props.activeRole);
  const lobby = state.stepIndex === -1;
  const spec = ROCKET[state.design.rocket ?? "rideshare"] ?? ROCKET.rideshare;
  const sunPos = useMemo(() => SUN_DIR.clone().multiplyScalar(400), []);

  return (
    <Canvas
      shadows="percentage"
      dpr={[1, 1.5]}
      camera={{ position: [30, 12, 60], fov: 40, near: 0.3, far: 6000 }}
      gl={{ antialias: false }}
      onCreated={({ gl }) => {
        gl.toneMappingExposure = 0.55;
      }}
      style={{ position: "absolute", inset: 0 }}
    >
      <Sky distance={4500} sunPosition={[sunPos.x, sunPos.y, sunPos.z]} turbidity={10} rayleigh={3.2} mieCoefficient={0.005} mieDirectionalG={0.88} />
      <fog attach="fog" args={["#a7776a", 160, 1500]} />
      <Environment resolution={128} frames={1} near={1} far={10000}>
        <Sky distance={4500} sunPosition={[sunPos.x, sunPos.y, sunPos.z]} turbidity={10} rayleigh={3.2} mieCoefficient={0.005} mieDirectionalG={0.88} />
      </Environment>
      <hemisphereLight args={["#7f93bd", "#4a3a2e", 0.55]} />
      <SunLight />

      <Ground />
      <LaunchMount size={spec.radius > 1 ? 9 : 5} />
      <Rocket spec={spec} />
      <Gantry rocket={spec} />
      <Walkway />
      {lobby &&
        ROLES.map((r) => {
          const claimed = !!state.roles[r];
          return (
            <Astronaut
              key={r}
              role={r}
              active={claimed}
              dim={!claimed}
              step={false}
              spotIntensity={70}
              position={[LOBBY_X[r], MOUNT_H, LOBBY_Z]}
              rotation={[0, 0.12, 0]}
            />
          );
        })}

      <CameraRig lobby={lobby} rocketTop={MOUNT_H + spec.height} />
      <EffectComposer multisampling={4}>
        <Bloom mipmapBlur luminanceThreshold={1.4} luminanceSmoothing={0.2} intensity={0.7} />
        <ToneMapping mode={ACES_FILMIC} />
        <Vignette offset={0.32} darkness={0.55} />
      </EffectComposer>
    </Canvas>
  );
}

function SunLight() {
  const light = useRef<THREE.DirectionalLight>(null);
  useLayoutEffect(() => {
    const l = light.current;
    if (!l) return;
    l.target.position.set(-4, 0, 6);
    l.target.updateMatrixWorld();
  }, []);
  const p = SUN_DIR.clone().multiplyScalar(160);
  return (
    <directionalLight
      ref={light}
      position={[p.x, p.y + 6, p.z]}
      color="#ffb078"
      intensity={3.2}
      castShadow
      shadow-mapSize={[2048, 2048]}
      shadow-bias={-0.0006}
      shadow-normalBias={0.05}
      shadow-camera-left={-60}
      shadow-camera-right={60}
      shadow-camera-top={60}
      shadow-camera-bottom={-60}
      shadow-camera-near={10}
      shadow-camera-far={400}
    />
  );
}

function Ground() {
  const poles = useMemo(() => {
    const out: [number, number][] = [
      [26, -22],
      [-26, -22],
    ];
    return out;
  }, []);
  const scrub = useMemo(() => {
    const rnd = seeded(7);
    return Array.from({ length: 60 }, () => {
      const a = rnd() * Math.PI * 2;
      const r = 70 + rnd() * 200;
      return { x: Math.cos(a) * r, z: -Math.abs(Math.sin(a)) * r * 0.5 - 20, s: 1.2 + rnd() * 2.5 };
    });
  }, []);
  return (
    <group>
      {/* ocean */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.6, -1400]}>
        <planeGeometry args={[6000, 2600]} />
        <meshStandardMaterial color="#1b2a38" roughness={0.12} metalness={0.4} />
      </mesh>
      {/* beach and scrubland */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.3, -120]} receiveShadow>
        <planeGeometry args={[6000, 24]} />
        <meshStandardMaterial color="#b49a78" roughness={0.95} />
      </mesh>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.05, 1300]} receiveShadow>
        <planeGeometry args={[6000, 2840]} />
        <meshStandardMaterial color="#5f5a43" roughness={1} />
      </mesh>
      {/* concrete pad */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.02, 0]} receiveShadow>
        <circleGeometry args={[42, 64]} />
        <meshStandardMaterial color="#8f8b84" roughness={0.92} />
      </mesh>
      {scrub.map((b, i) => (
        <mesh key={i} position={[b.x, b.s * 0.3, b.z]} scale={[b.s * 1.4, b.s * 0.6, b.s]} castShadow receiveShadow>
          <sphereGeometry args={[1, 8, 6]} />
          <meshStandardMaterial color="#3e4430" roughness={1} />
        </mesh>
      ))}
      {/* lightning protection towers */}
      {poles.map(([x, z]) => (
        <group key={`${x}${z}`} position={[x, 0, z]}>
          <mesh position={[0, 30, 0]} castShadow>
            <cylinderGeometry args={[0.35, 0.6, 60, 8]} />
            <meshStandardMaterial color="#8c9096" roughness={0.6} metalness={0.4} />
          </mesh>
          <mesh position={[0, 60.5, 0]}>
            <sphereGeometry args={[0.45, 8, 6]} />
            <meshStandardMaterial color="#300" emissive="#ff2a1a" emissiveIntensity={1.2} />
          </mesh>
        </group>
      ))}
      {/* distant water tower and hangar for scale */}
      <mesh position={[70, 9, -40]} castShadow>
        <boxGeometry args={[30, 18, 22]} />
        <meshStandardMaterial color="#cfcac2" roughness={0.85} />
      </mesh>
      <mesh position={[-75, 22, -30]} castShadow>
        <cylinderGeometry args={[0.8, 0.8, 44, 8]} />
        <meshStandardMaterial color="#9aa0a7" />
      </mesh>
      <mesh position={[-75, 46, -30]} castShadow>
        <sphereGeometry args={[6, 16, 12]} />
        <meshStandardMaterial color="#d8d6d1" roughness={0.6} />
      </mesh>
    </group>
  );
}

function LaunchMount({ size }: { size: number }) {
  const clamp = size * 0.27;
  return (
    <group>
      <mesh position={[0, MOUNT_H / 2, 0]} castShadow receiveShadow>
        <boxGeometry args={[size, MOUNT_H, size]} />
        <meshStandardMaterial color="#7f7c76" roughness={0.9} />
      </mesh>
      {/* flame trench opening */}
      <mesh position={[0, 1.8, size / 2 + 0.01]}>
        <planeGeometry args={[size * 0.55, 3.6]} />
        <meshStandardMaterial color="#141414" roughness={1} />
      </mesh>
      {/* hold-down clamps */}
      {[0, 1, 2, 3].map((k) => {
        const a = (k * Math.PI) / 2 + Math.PI / 4;
        return (
          <mesh key={k} position={[Math.cos(a) * clamp, MOUNT_H + 0.7, Math.sin(a) * clamp]} rotation={[0, -a, 0]} castShadow>
            <boxGeometry args={[1.4, 1.4, 0.6]} />
            <meshStandardMaterial color="#5a5e64" metalness={0.5} roughness={0.5} />
          </mesh>
        );
      })}
    </group>
  );
}

function Rocket({ spec }: { spec: RocketSpec }) {
  const { height: H, radius: R, fairingR: FR, fairingH: FH } = spec;
  const fairing = useMemo(() => {
    const pts: THREE.Vector2[] = [];
    pts.push(new THREE.Vector2(R, 0));
    pts.push(new THREE.Vector2(FR, FR > R ? 1.2 : 0.01));
    const cyl = FH * 0.45;
    pts.push(new THREE.Vector2(FR, cyl));
    for (let i = 1; i <= 14; i++) {
      const u = i / 14;
      const y = cyl + (FH - cyl) * u;
      const r = FR * Math.sqrt(Math.max(0, 1 - u * u)) * (1 - 0.15 * u) + 0.02;
      pts.push(new THREE.Vector2(i === 14 ? 0 : r, y));
    }
    return new THREE.LatheGeometry(pts, 48);
  }, [R, FR, FH]);
  const bodyH = H - FH;
  const engineR = R * 0.24;
  const engines = useMemo(() => {
    const out: [number, number][] = [[0, 0]];
    for (let k = 0; k < spec.engines - 1; k++) {
      const a = (k / (spec.engines - 1)) * Math.PI * 2;
      out.push([Math.cos(a) * R * 0.62, Math.sin(a) * R * 0.62]);
    }
    return out;
  }, [spec.engines, R]);
  return (
    <group position={[0, MOUNT_H + 1.4, 0]}>
      {/* engines */}
      {engines.map(([x, z], i) => (
        <mesh key={i} position={[x, -0.7, z]} castShadow>
          <cylinderGeometry args={[engineR * 0.45, engineR, 1.4, 16, 1, true]} />
          <meshStandardMaterial color="#2a2a2c" metalness={0.8} roughness={0.35} side={THREE.DoubleSide} />
        </mesh>
      ))}
      {/* first stage */}
      <mesh position={[0, bodyH * 0.36, 0]} castShadow receiveShadow>
        <cylinderGeometry args={[R, R, bodyH * 0.72, 48]} />
        <meshStandardMaterial color={spec.body} roughness={0.45} metalness={0.1} />
      </mesh>
      {/* interstage band */}
      <mesh position={[0, bodyH * 0.76, 0]} castShadow>
        <cylinderGeometry args={[R * 1.005, R * 1.005, bodyH * 0.08, 48]} />
        <meshStandardMaterial color={spec.band} roughness={0.5} metalness={0.2} />
      </mesh>
      {/* second stage */}
      <mesh position={[0, bodyH * 0.9, 0]} castShadow receiveShadow>
        <cylinderGeometry args={[R, R, bodyH * 0.2, 48]} />
        <meshStandardMaterial color={spec.body} roughness={0.45} metalness={0.1} />
      </mesh>
      {/* payload fairing */}
      <mesh geometry={fairing} position={[0, bodyH, 0]} castShadow receiveShadow>
        <meshStandardMaterial color="#f2f3f5" roughness={0.4} metalness={0.05} />
      </mesh>
      {/* a thin seam line around the base of the fairing */}
      <mesh position={[0, bodyH + 0.02, 0]}>
        <cylinderGeometry args={[R * 1.01, R * 1.01, 0.08, 48, 1, true]} />
        <meshStandardMaterial color="#3a3c40" />
      </mesh>
    </group>
  );
}

/** Lattice service tower beside the rocket, instanced: one draw call for the steel. */
function Gantry({ rocket }: { rocket: RocketSpec }) {
  const ref = useRef<THREE.InstancedMesh>(null);
  const towerH = Math.max(30, MOUNT_H + rocket.height - 4);
  const W = 6;
  const beams = useMemo(() => {
    const out: { p: THREE.Vector3; s: THREE.Vector3; r: THREE.Euler }[] = [];
    const half = W / 2;
    const post = 0.45;
    for (const [sx, sz] of [
      [-1, -1],
      [1, -1],
      [-1, 1],
      [1, 1],
    ])
      out.push({ p: new THREE.Vector3(TOWER_X + sx * half, towerH / 2, sz * half), s: new THREE.Vector3(post, towerH, post), r: new THREE.Euler() });
    const level = 4.5;
    for (let y = level; y <= towerH; y += level) {
      // ring beams
      out.push({ p: new THREE.Vector3(TOWER_X, y, -half), s: new THREE.Vector3(W, 0.3, 0.3), r: new THREE.Euler() });
      out.push({ p: new THREE.Vector3(TOWER_X, y, half), s: new THREE.Vector3(W, 0.3, 0.3), r: new THREE.Euler() });
      out.push({ p: new THREE.Vector3(TOWER_X - half, y, 0), s: new THREE.Vector3(0.3, 0.3, W), r: new THREE.Euler() });
      out.push({ p: new THREE.Vector3(TOWER_X + half, y, 0), s: new THREE.Vector3(0.3, 0.3, W), r: new THREE.Euler() });
      // diagonal braces on each face
      const diag = Math.hypot(W, level);
      const ang = Math.atan2(level, W);
      const flip = (Math.round(y / level) % 2) * 2 - 1;
      out.push({ p: new THREE.Vector3(TOWER_X, y - level / 2, -half), s: new THREE.Vector3(diag, 0.2, 0.2), r: new THREE.Euler(0, 0, ang * flip) });
      out.push({ p: new THREE.Vector3(TOWER_X, y - level / 2, half), s: new THREE.Vector3(diag, 0.2, 0.2), r: new THREE.Euler(0, 0, -ang * flip) });
      out.push({ p: new THREE.Vector3(TOWER_X - half, y - level / 2, 0), s: new THREE.Vector3(0.2, 0.2, diag), r: new THREE.Euler(ang * flip, 0, 0) });
      out.push({ p: new THREE.Vector3(TOWER_X + half, y - level / 2, 0), s: new THREE.Vector3(0.2, 0.2, diag), r: new THREE.Euler(-ang * flip, 0, 0) });
      // deck
      out.push({ p: new THREE.Vector3(TOWER_X, y, 0), s: new THREE.Vector3(W - 0.4, 0.12, W - 0.4), r: new THREE.Euler() });
    }
    // crew access arm near the top of the rocket, reaching to the fairing
    const armY = MOUNT_H + rocket.height - rocket.fairingH - 2;
    const armLen = Math.abs(TOWER_X) - half - rocket.radius;
    out.push({ p: new THREE.Vector3(TOWER_X + half + armLen / 2, armY, 0), s: new THREE.Vector3(armLen, 2.4, 1.8), r: new THREE.Euler() });
    return out;
  }, [towerH, rocket.height, rocket.fairingH, rocket.radius]);

  useLayoutEffect(() => {
    const mesh = ref.current;
    if (!mesh) return;
    const m = new THREE.Matrix4();
    const q = new THREE.Quaternion();
    beams.forEach((b, i) => {
      q.setFromEuler(b.r);
      m.compose(b.p, q, b.s);
      mesh.setMatrixAt(i, m);
    });
    mesh.instanceMatrix.needsUpdate = true;
    mesh.computeBoundingSphere();
  }, [beams]);

  return (
    <group>
      <instancedMesh key={beams.length} ref={ref} args={[undefined, undefined, beams.length]} castShadow receiveShadow>
        <boxGeometry args={[1, 1, 1]} />
        <meshStandardMaterial color="#6f747b" roughness={0.6} metalness={0.5} />
      </instancedMesh>
      {/* aviation light */}
      <mesh position={[TOWER_X, towerH + 1.2, 0]}>
        <cylinderGeometry args={[0.08, 0.08, 2.4, 6]} />
        <meshStandardMaterial color="#555" />
      </mesh>
      <BlinkLight position={[TOWER_X, towerH + 2.5, 0]} />
    </group>
  );
}

function BlinkLight({ position }: { position: [number, number, number] }) {
  const mat = useRef<THREE.MeshStandardMaterial>(null);
  useFrame((st) => {
    if (mat.current) mat.current.emissiveIntensity = Math.sin(st.clock.elapsedTime * 2.2) > 0.6 ? 1.3 : 0.15;
  });
  return (
    <mesh position={position}>
      <sphereGeometry args={[0.35, 10, 8]} />
      <meshStandardMaterial ref={mat} color="#300" emissive="#ff2a1a" emissiveIntensity={1} />
    </mesh>
  );
}

/** Steel walkway off the tower, in front of the rocket: the character select stage. */
function Walkway() {
  const x0 = -6.2;
  const x1 = -0.6;
  const cx = (x0 + x1) / 2;
  const w = x1 - x0;
  return (
    <group>
      <mesh position={[cx, MOUNT_H - 0.12, LOBBY_Z]} castShadow receiveShadow>
        <boxGeometry args={[w, 0.24, 2.6]} />
        <meshStandardMaterial color="#5d6168" roughness={0.7} metalness={0.4} />
      </mesh>
      {/* link to the tower */}
      <mesh position={[(TOWER_X + 3 + x0) / 2 - 0.4, MOUNT_H - 0.12, LOBBY_Z - 0.4]} castShadow receiveShadow>
        <boxGeometry args={[2.4, 0.24, 1.6]} />
        <meshStandardMaterial color="#5d6168" roughness={0.7} metalness={0.4} />
      </mesh>
      {/* front rail */}
      <mesh position={[cx, MOUNT_H + 1.05, LOBBY_Z + 1.25]} rotation={[0, 0, Math.PI / 2]} castShadow>
        <cylinderGeometry args={[0.04, 0.04, w, 8]} />
        <meshStandardMaterial color="#b9bdc3" metalness={0.7} roughness={0.35} />
      </mesh>
      <mesh position={[cx, MOUNT_H + 0.55, LOBBY_Z + 1.25]} rotation={[0, 0, Math.PI / 2]}>
        <cylinderGeometry args={[0.03, 0.03, w, 8]} />
        <meshStandardMaterial color="#b9bdc3" metalness={0.7} roughness={0.35} />
      </mesh>
      {Array.from({ length: 6 }, (_, i) => (
        <mesh key={i} position={[x0 + (i * w) / 5, MOUNT_H + 0.52, LOBBY_Z + 1.25]} castShadow>
          <cylinderGeometry args={[0.04, 0.04, 1.05, 6]} />
          <meshStandardMaterial color="#b9bdc3" metalness={0.7} roughness={0.35} />
        </mesh>
      ))}
      {/* supports */}
      {[x0 + 0.4, x1 - 0.4].map((x) => (
        <mesh key={x} position={[x, (MOUNT_H - 0.24) / 2, LOBBY_Z]} castShadow>
          <boxGeometry args={[0.35, MOUNT_H - 0.24, 0.35]} />
          <meshStandardMaterial color="#5d6168" roughness={0.7} metalness={0.4} />
        </mesh>
      ))}
    </group>
  );
}

function CameraRig({ lobby, rocketTop }: { lobby: boolean; rocketTop: number }) {
  const look = useMemo(() => new THREE.Vector3(), []);
  const want = useMemo(() => new THREE.Vector3(), []);
  const wantLook = useMemo(() => new THREE.Vector3(), []);
  const first = useRef(true);
  useFrame((st, dt) => {
    const t = st.clock.elapsedTime;
    const cam = st.camera;
    if (lobby) {
      const a = Math.sin(t * 0.08) * 0.08;
      want.set(-3.4 + Math.sin(a) * 6.4, MOUNT_H + 1.75 + Math.sin(t * 0.11) * 0.1, LOBBY_Z + Math.cos(a) * 6.4);
      wantLook.set(-3.1, MOUNT_H + 1.5, LOBBY_Z);
    } else {
      // Frame the whole rocket, drifting slowly around it.
      const dist = rocketTop * 1.65 + 10;
      const a = 0.42 + Math.sin(t * 0.045) * 0.28;
      want.set(Math.sin(a) * dist, rocketTop * 0.28 + Math.sin(t * 0.07) * 1.2, Math.cos(a) * dist);
      wantLook.set(0, rocketTop * 0.47, 0);
    }
    if (first.current) {
      cam.position.copy(want);
      look.copy(wantLook);
      first.current = false;
    }
    const k = 1 - Math.exp(-dt * 1.6);
    cam.position.lerp(want, k);
    look.lerp(wantLook, k);
    cam.lookAt(look);
  });
  return null;
}
