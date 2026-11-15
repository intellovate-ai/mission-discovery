"use client";
// The Flight Path: black space, stars and the real Earth (NASA Blue Marble by day, Black Marble
// city lights by night). The mission's mini games sit as glowing nodes on a path that climbs from
// the pad to orbit; the node for the current step is highlighted and the camera glides to it.
// When an orbit is chosen, the players' spacecraft flies on that orbit at its true altitude.
import { Suspense, useMemo, useRef } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { Billboard, Line, Stars, useTexture } from "@react-three/drei";
import { Bloom, EffectComposer, ToneMapping, Vignette } from "@react-three/postprocessing";
import * as THREE from "three";
import { stepsFor, type MinigameId, type RoleId } from "@/lib/protocol";
import { ORBITS } from "@/lib/game/data/ember";
import type { SceneProps } from "./types";
import Spacecraft from "./Spacecraft";
import { ROLE_COLOR, useDevOverrides } from "./sceneKit";

const ACES_FILMIC = 6;
const TEXTURES = ["/textures/earth-day-4k.jpg", "/textures/earth-night-3600.jpg"];
// Start loading the Earth maps as soon as this module is imported, before the scene shows.
if (typeof window !== "undefined") useTexture.preload(TEXTURES);
export const R = 5; // Earth radius in scene units (6,371 km)
const KM = R / 6371;
const DEFAULT_ALT_KM = 550;

/** Mini game titles (their proper names, Words Bible) and owners, for the node labels. */
const NODES: Record<MinigameId, { label: string; owner: RoleId | "team" }> = {
  fairing: { label: "FAIRING", owner: "forge" },
  "launch-vehicle": { label: "LAUNCH VEHICLE", owner: "zenith" },
  "launch-window": { label: "LAUNCH WINDOW", owner: "vector" },
  "ground-track": { label: "GROUND TRACK", owner: "prism" },
  downlink: { label: "DOWNLINK", owner: "vector" },
  "trade-study": { label: "TRADE STUDY", owner: "team" },
  "design-review": { label: "DESIGN REVIEW", owner: "team" },
};

const INCLINATION: Record<string, number> = { "leo-400": 51.6, "sso-550": 97.6, "sso-700": 98.2, "sso-dd-550": 97.6 };

/** Where along the path (radians around the orbit) each mini game node sits, by order. */
const NODE_THETA = [0, 0.2, 0.4, 0.66, 0.95, 1.24, 1.53];
const ASCENT_END = 0.66;

interface Geometry {
  q: THREE.Quaternion;
  altU: number;
  pos: (theta: number) => THREE.Vector3;
  tangent: (theta: number) => THREE.Vector3;
  normal: THREE.Vector3;
}

function makeGeometry(altKm: number, inclinationDeg: number): Geometry {
  const q = new THREE.Quaternion().setFromEuler(new THREE.Euler(THREE.MathUtils.degToRad(inclinationDeg) - Math.PI / 2, 0.6, 0, "YXZ"));
  const altU = altKm * KM;
  const altAt = (th: number) => {
    const u = THREE.MathUtils.clamp(th / ASCENT_END, 0, 1);
    return 0.015 + (altU - 0.015) * (u * u * (3 - 2 * u));
  };
  const pos = (th: number) => {
    const r = R + altAt(th);
    return new THREE.Vector3(Math.cos(th) * r, Math.sin(th) * r, 0).applyQuaternion(q);
  };
  const tangent = (th: number) => pos(th + 0.002).sub(pos(th - 0.002)).normalize();
  const normal = new THREE.Vector3(0, 0, 1).applyQuaternion(q);
  return { q, altU, pos, tangent, normal };
}

export default function FlightPath(props: SceneProps) {
  const { state } = useDevOverrides(props.state, props.sim, props.activeRole);
  const orbit = ORBITS.find((o) => o.id === state.design.orbit);
  const geo = useMemo(() => makeGeometry(orbit?.altitudeKm ?? DEFAULT_ALT_KM, orbit ? INCLINATION[orbit.id] ?? 97.6 : 97.6), [orbit]);

  // Mini game steps in order, and which one is "now" (the current step, or the next one coming up).
  const { nodes, current } = useMemo(() => {
    const steps = stepsFor(state.missionId);
    const list: { id: MinigameId; stepIndex: number }[] = [];
    steps.forEach((s, i) => {
      if (s.kind === "mg") list.push({ id: s.id, stepIndex: i });
    });
    let cur = list.findIndex((n) => n.stepIndex >= state.stepIndex);
    if (cur < 0) cur = list.length - 1;
    return { nodes: list, current: cur };
  }, [state.missionId, state.stepIndex]);

  const sunDir = useMemo(() => geo.pos(1.75).normalize().addScaledVector(geo.normal, 0.5).normalize(), [geo]);
  const labelEls = useRef<(HTMLDivElement | null)[]>([]);
  const nodePos = useMemo(() => nodes.map((_, i) => geo.pos(NODE_THETA[Math.min(i, NODE_THETA.length - 1)])), [nodes, geo]);
  const earthRef = useRef<THREE.Mesh>(null);

  return (
    <div style={{ position: "absolute", inset: 0, overflow: "hidden" }}>
    <Canvas
      dpr={[1, 1.5]}
      camera={{ position: [0, 0, 18], fov: 42, near: 0.01, far: 3000 }}
      gl={{ antialias: false }}
      onCreated={({ gl }) => {
        gl.toneMappingExposure = 1.05;
      }}
      style={{ position: "absolute", inset: 0 }}
    >
      <color attach="background" args={["#000005"]} />
      <Stars radius={600} depth={200} count={6000} factor={5} saturation={0.1} fade speed={0} />
      <hemisphereLight args={["#cfe0ff", "#1a2a44", 0.9]} />
      <directionalLight position={sunDir.clone().multiplyScalar(50)} intensity={2.4} color="#fff4e6" />
      <Sun dir={sunDir} />

      <Suspense fallback={<FallbackEarth earthRef={earthRef} sunDir={sunDir} />}>
        <Earth earthRef={earthRef} sunDir={sunDir} />
      </Suspense>
      <Atmosphere sunDir={sunDir} />

      <PathLine geo={geo} currentTheta={NODE_THETA[Math.min(current, NODE_THETA.length - 1)]} showRing={!!orbit} />
      {nodes.map((n, i) => (
        <Node
          key={n.id}
          id={n.id}
          position={nodePos[i]}
          state={i < current ? "done" : i === current ? "current" : "future"}
        />
      ))}
      <LabelProjector positions={nodePos} els={labelEls} current={current} />
      {orbit && <Satellite geo={geo} theta={NODE_THETA[Math.min(current, NODE_THETA.length - 1)]} design={state.design} />}

      <CameraGlide geo={geo} theta={NODE_THETA[Math.min(current, NODE_THETA.length - 1)]} />
      <EffectComposer multisampling={4}>
        <Bloom mipmapBlur luminanceThreshold={1.15} luminanceSmoothing={0.15} intensity={1.1} radius={0.7} />
        <ToneMapping mode={ACES_FILMIC} />
        <Vignette offset={0.3} darkness={0.6} />
      </EffectComposer>
    </Canvas>
      {/* Node labels: plain DOM over the canvas, positioned each frame (no glow on UI text). */}
      <div style={{ position: "absolute", inset: 0, pointerEvents: "none" }}>
        {nodes.map((n, i) => {
          const st = i < current ? "done" : i === current ? "current" : "future";
          return (
            <div
              key={n.id}
              ref={(el) => {
                labelEls.current[i] = el;
              }}
              style={{
                position: "absolute",
                left: 0,
                top: 0,
                opacity: 0,
                whiteSpace: "nowrap",
                fontFamily: "var(--font-display), sans-serif",
                fontWeight: 600,
                fontSize: st === "current" ? 28 : 20,
                lineHeight: 1,
                color: st === "future" ? "#979797" : "#ECEFF3",
                willChange: "transform",
              }}
            >
              {NODES[n.id].label}
            </div>
          );
        })}
      </div>
    </div>
  );
}

/** Projects node positions to screen space and moves the DOM labels; hides ones behind Earth. */
function LabelProjector({ positions, els, current }: { positions: THREE.Vector3[]; els: React.RefObject<(HTMLDivElement | null)[]>; current: number }) {
  const v = useMemo(() => new THREE.Vector3(), []);
  const dir = useMemo(() => new THREE.Vector3(), []);
  useFrame((st) => {
    const cam = st.camera;
    const { width, height } = st.size;
    positions.forEach((p, i) => {
      const el = els.current[i];
      if (!el) return;
      // occluded if the camera-to-node segment passes through the Earth sphere
      dir.copy(p).sub(cam.position);
      const len = dir.length();
      dir.divideScalar(len);
      const b = cam.position.dot(dir);
      const c = cam.position.lengthSq() - R * R;
      const disc = b * b - c;
      const tHit = disc > 0 ? -b - Math.sqrt(disc) : Infinity;
      const hidden = tHit > 0 && tHit < len - 0.01;
      v.copy(p).project(cam);
      const off = v.z > 1 || Math.abs(v.x) > 1.2 || Math.abs(v.y) > 1.2;
      const x = ((v.x + 1) / 2) * width;
      const y = ((1 - v.y) / 2) * height;
      el.style.transform = `translate(${x}px, ${y - 22}px) translate(-50%, -100%)`;
      // Only the current node and the next one are labeled, so distant labels never pile up.
      const near = i === current || i === current + 1;
      el.style.opacity = hidden || off || !near ? "0" : "1";
    });
  });
  return null;
}

const earthVert = /* glsl */ `
  varying vec2 vUv;
  varying vec3 vNormalW;
  varying vec3 vPosW;
  void main() {
    vUv = uv;
    vNormalW = normalize(mat3(modelMatrix) * normal);
    vec4 w = modelMatrix * vec4(position, 1.0);
    vPosW = w.xyz;
    gl_Position = projectionMatrix * viewMatrix * w;
  }
`;
const earthFrag = /* glsl */ `
  uniform sampler2D dayMap;
  uniform sampler2D nightMap;
  uniform vec3 sunDir;
  uniform float hasMaps;
  varying vec2 vUv;
  varying vec3 vNormalW;
  varying vec3 vPosW;
  void main() {
    vec3 N = normalize(vNormalW);
    vec3 V = normalize(cameraPosition - vPosW);
    float d = dot(N, sunDir);
    vec3 day = hasMaps > 0.5 ? texture2D(dayMap, vUv).rgb : vec3(0.03, 0.07, 0.16);
    vec3 night = hasMaps > 0.5 ? texture2D(nightMap, vUv).rgb : vec3(0.0);
    float dayMix = smoothstep(-0.10, 0.20, d);
    // Black Marble has a blue base: keep only the warm city lights, below bloom threshold.
    vec3 lights = max(night - vec3(0.07, 0.08, 0.16), 0.0) * vec3(1.5, 1.2, 0.8);
    lights = min(lights * 1.3, vec3(0.95));
    vec3 lit = day * (0.04 + 1.15 * max(d, 0.0));
    // sun glint on the oceans
    float ocean = smoothstep(0.02, 0.0, max(day.r, day.g) - day.b * 0.9) * (1.0 - smoothstep(0.12, 0.3, dot(day, vec3(0.333))));
    vec3 H = normalize(sunDir + V);
    float spec = pow(max(dot(N, H), 0.0), 70.0) * 0.55 * ocean * smoothstep(0.0, 0.2, d) * hasMaps;
    vec3 col = mix(lights + day * 0.035, lit, dayMix) + spec * vec3(1.0, 0.92, 0.8);
    // atmospheric haze on the limb, day side only
    float fres = pow(1.0 - max(dot(N, V), 0.0), 3.0);
    col += vec3(0.28, 0.5, 1.0) * fres * 0.55 * smoothstep(-0.25, 0.35, d);
    gl_FragColor = vec4(col, 1.0);
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
  }
`;

function useEarthMaterial(sunDir: THREE.Vector3, day: THREE.Texture | null, night: THREE.Texture | null) {
  return useMemo(
    () =>
      new THREE.ShaderMaterial({
        uniforms: {
          dayMap: { value: day },
          nightMap: { value: night },
          sunDir: { value: sunDir },
          hasMaps: { value: day && night ? 1 : 0 },
        },
        vertexShader: earthVert,
        fragmentShader: earthFrag,
      }),
    [sunDir, day, night],
  );
}

export function Earth({ earthRef, sunDir }: { earthRef: React.RefObject<THREE.Mesh | null>; sunDir: THREE.Vector3 }) {
  const [day, night] = useTexture(TEXTURES, (ts) => {
    for (const t of ts) {
      t.colorSpace = THREE.SRGBColorSpace;
      t.anisotropy = 8;
    }
  });
  const mat = useEarthMaterial(sunDir, day, night);
  return <EarthMesh earthRef={earthRef} material={mat} />;
}

export function FallbackEarth({ earthRef, sunDir }: { earthRef: React.RefObject<THREE.Mesh | null>; sunDir: THREE.Vector3 }) {
  const mat = useEarthMaterial(sunDir, null, null);
  return <EarthMesh earthRef={earthRef} material={mat} />;
}

function EarthMesh({ earthRef, material }: { earthRef: React.RefObject<THREE.Mesh | null>; material: THREE.Material }) {
  useFrame((_, dt) => {
    if (earthRef.current) earthRef.current.rotation.y += dt * 0.006;
  });
  return (
    <mesh ref={earthRef} material={material} rotation={[0, -1.2, 0]}>
      <sphereGeometry args={[R, 128, 64]} />
    </mesh>
  );
}

const atmoVert = /* glsl */ `
  varying vec3 vN;
  varying vec3 vPosW;
  void main() {
    vN = normalize(mat3(modelMatrix) * normal);
    vec4 w = modelMatrix * vec4(position, 1.0);
    vPosW = w.xyz;
    gl_Position = projectionMatrix * viewMatrix * w;
  }
`;
const atmoFrag = /* glsl */ `
  uniform vec3 sunDir;
  uniform float rIn;
  uniform float rOut;
  varying vec3 vN;
  varying vec3 vPosW;
  void main() {
    // How close the view ray passes to Earth's center: 1 at the surface, 0 at the shell edge.
    vec3 dir = normalize(vPosW - cameraPosition);
    float tca = dot(-cameraPosition, dir);
    float h = sqrt(max(dot(cameraPosition, cameraPosition) - tca * tca, 0.0));
    float glow = pow(clamp((rOut - h) / (rOut - rIn), 0.0, 1.0), 2.4);
    float sun = smoothstep(-0.3, 0.45, dot(normalize(vN), sunDir));
    vec3 col = mix(vec3(0.12, 0.3, 0.95), vec3(0.45, 0.68, 1.0), sun) * glow * (0.1 + 0.9 * sun) * 0.9;
    gl_FragColor = vec4(col, 1.0);
  }
`;

export function Atmosphere({ sunDir }: { sunDir: THREE.Vector3 }) {
  const mat = useMemo(
    () =>
      new THREE.ShaderMaterial({
        uniforms: { sunDir: { value: sunDir }, rIn: { value: R }, rOut: { value: R * 1.045 } },
        vertexShader: atmoVert,
        fragmentShader: atmoFrag,
        side: THREE.BackSide,
        blending: THREE.AdditiveBlending,
        transparent: true,
        depthWrite: false,
      }),
    [sunDir],
  );
  return (
    <mesh material={mat}>
      <sphereGeometry args={[R * 1.045, 96, 48]} />
    </mesh>
  );
}

export function Sun({ dir }: { dir: THREE.Vector3 }) {
  const p = dir.clone().multiplyScalar(420);
  return (
    <mesh position={p}>
      <sphereGeometry args={[4, 24, 16]} />
      <meshBasicMaterial color={[30, 27, 22]} toneMapped={false} />
    </mesh>
  );
}

function PathLine({ geo, currentTheta, showRing }: { geo: Geometry; currentTheta: number; showRing: boolean }) {
  const { done, ahead } = useMemo(() => {
    const done: THREE.Vector3[] = [];
    const ahead: THREE.Vector3[] = [];
    const end = NODE_THETA[NODE_THETA.length - 1] + 0.25;
    for (let th = -0.04; th <= end; th += 0.01) {
      const p = geo.pos(th);
      if (th <= currentTheta) done.push(p);
      if (th >= currentTheta - 0.01) ahead.push(p);
    }
    return { done, ahead };
  }, [geo, currentTheta]);
  const ring = useMemo(() => {
    const pts: THREE.Vector3[] = [];
    const r = R + geo.altU;
    for (let i = 0; i <= 256; i++) {
      const th = (i / 256) * Math.PI * 2;
      pts.push(new THREE.Vector3(Math.cos(th) * r, Math.sin(th) * r, 0).applyQuaternion(geo.q));
    }
    return pts;
  }, [geo]);
  return (
    <group>
      {showRing && <Line points={ring} color="#979797" lineWidth={1} transparent opacity={0.18} />}
      {done.length > 1 && <Line points={done} color="#ECEFF3" lineWidth={2} transparent opacity={0.85} />}
      {ahead.length > 1 && <Line points={ahead} color="#979797" lineWidth={1.5} dashed dashSize={0.06} gapSize={0.05} transparent opacity={0.6} />}
    </group>
  );
}

function Node({ id, position, state }: { id: MinigameId; position: THREE.Vector3; state: "done" | "current" | "future" }) {
  const meta = NODES[id];
  const base = new THREE.Color(meta.owner === "team" ? "#ECEFF3" : ROLE_COLOR[meta.owner]);
  const glow = state === "current" ? 4 : state === "done" ? 1.6 : 0.55;
  const color = base.clone().multiplyScalar(glow);
  const ring = useRef<THREE.Mesh>(null);
  const core = useRef<THREE.Mesh>(null);
  useFrame((st) => {
    const t = st.clock.elapsedTime;
    if (ring.current) {
      const k = (t * 0.6) % 1;
      ring.current.scale.setScalar(1 + k * 1.4);
      (ring.current.material as THREE.MeshBasicMaterial).opacity = 0.9 * (1 - k);
    }
    if (core.current && state === "current") core.current.scale.setScalar(1 + Math.sin(t * 3) * 0.12);
  });
  const size = state === "current" ? 0.05 : 0.03;
  return (
    <group position={position}>
      <mesh ref={core}>
        <sphereGeometry args={[size, 16, 12]} />
        <meshBasicMaterial color={color} toneMapped={false} />
      </mesh>
      {state === "current" && (
        <Billboard>
          <mesh ref={ring}>
            <ringGeometry args={[0.06, 0.066, 48]} />
            <meshBasicMaterial color={base.clone().multiplyScalar(2.2)} toneMapped={false} transparent depthWrite={false} />
          </mesh>
        </Billboard>
      )}
    </group>
  );
}

function Satellite({ geo, theta, design }: { geo: Geometry; theta: number; design: SceneProps["state"]["design"] }) {
  const ref = useRef<THREE.Group>(null);
  const r = R + geo.altU;
  useFrame((st) => {
    const g = ref.current;
    if (!g) return;
    // Fly ahead of the current node, on the chosen orbit.
    // Ahead of the current node and a little to the side of the path, at the orbit's altitude.
    const th = Math.max(theta, ASCENT_END) + 0.13 + Math.sin(st.clock.elapsedTime * 0.15) * 0.008;
    const p = new THREE.Vector3(Math.cos(th) * r, Math.sin(th) * r, 0).applyQuaternion(geo.q);
    const up = p.clone().normalize();
    const side = new THREE.Vector3().crossVectors(geo.tangent(th), up).normalize();
    p.addScaledVector(side, -0.32).setLength(r);
    g.position.copy(p);
    g.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), up);
  });
  return (
    <group ref={ref}>
      <group scale={0.75} position={[0, -0.13, 0]}>
        <Spacecraft design={design} />
      </group>
    </group>
  );
}

function CameraGlide({ geo, theta }: { geo: Geometry; theta: number }) {
  const look = useMemo(() => new THREE.Vector3(), []);
  const up = useMemo(() => new THREE.Vector3(0, 1, 0), []);
  const first = useRef(true);
  useFrame((st, dt) => {
    const t = st.clock.elapsedTime;
    const p = geo.pos(theta);
    const radial = p.clone().normalize();
    const tan = geo.tangent(theta);
    const side = new THREE.Vector3().crossVectors(tan, radial).normalize();
    const drift = Math.sin(t * 0.08) * 0.35;
    const want = p
      .clone()
      .addScaledVector(radial, 1.05)
      .addScaledVector(tan, -2.4)
      .addScaledVector(side, 0.9 + drift);
    const wantLook = p.clone().addScaledVector(tan, 0.9).addScaledVector(radial, -0.25);
    const cam = st.camera;
    if (first.current) {
      cam.position.copy(want);
      look.copy(wantLook);
      up.copy(radial);
      first.current = false;
    }
    const k = 1 - Math.exp(-dt * 0.9);
    cam.position.lerp(want, k);
    look.lerp(wantLook, k);
    up.lerp(radial, k).normalize();
    cam.up.copy(up);
    cam.lookAt(look);
  });
  return null;
}
