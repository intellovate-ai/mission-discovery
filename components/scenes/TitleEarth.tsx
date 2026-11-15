"use client";
// Title screen motion shot: from low orbit, looking along Earth's curved horizon as the Sun
// breaks past the limb. Same NASA Blue Marble / Black Marble Earth as the Flight Path.
// Slow motion only: the Earth turns, the camera drifts along the horizon, the Sun climbs a little.
import { Suspense, useMemo, useRef } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { Stars } from "@react-three/drei";
import { Bloom, EffectComposer, ToneMapping, Vignette } from "@react-three/postprocessing";
import * as THREE from "three";
import { Atmosphere, Earth, FallbackEarth, R, Sun } from "./FlightPath";

const ACES_FILMIC = 6;
const CAM_DIST = R * 1.12; // about 770 km up: high enough that clouds and land read
const HORIZON = Math.asin(R / CAM_DIST); // angle from straight down to the horizon
const DIAG = new THREE.Vector3(1, 1, 0).normalize(); // direction the camera faces along the horizon
const ROLL = -0.45; // radians: tilts the horizon so it falls from upper left to lower right

/** A direction that starts straight down (toward Earth) and tilts `angle` radians toward DIAG. */
function tilt(angle: number) {
  return new THREE.Vector3(0, 0, -1).multiplyScalar(Math.cos(angle)).addScaledVector(DIAG, Math.sin(angle)).normalize();
}

export default function TitleEarth() {
  const earthRef = useRef<THREE.Mesh>(null);
  // Sun a little below the camera's local horizontal: from orbit the limb dips well below
  // horizontal, so the Sun still shows just above it, and the ground toward it is in low,
  // grazing daylight.
  const sunDir = useMemo(() => tilt(Math.PI / 2 - 0.13).applyAxisAngle(new THREE.Vector3(0, 0, 1), -0.08), []);
  return (
    <div style={{ position: "absolute", inset: 0, overflow: "hidden" }}>
      <Canvas
        dpr={[1, 1.5]}
        camera={{ position: [0, 0, CAM_DIST], fov: 55, near: 0.01, far: 3000 }}
        gl={{ antialias: false }}
        onCreated={({ gl }) => {
          gl.toneMappingExposure = 1.1;
        }}
        style={{ position: "absolute", inset: 0 }}
      >
        <color attach="background" args={["#000003"]} />
        <Stars radius={600} depth={200} count={4000} factor={4} saturation={0} fade speed={0} />
        <directionalLight position={sunDir.clone().multiplyScalar(50)} intensity={2.4} color="#fff4e6" />
        <Sun dir={sunDir} />
        <Suspense fallback={<FallbackEarth earthRef={earthRef} sunDir={sunDir} />}>
          <Earth earthRef={earthRef} sunDir={sunDir} />
        </Suspense>
        <Atmosphere sunDir={sunDir} />
        <Drift />
        <EffectComposer multisampling={4}>
          <Bloom mipmapBlur luminanceThreshold={1.1} luminanceSmoothing={0.2} intensity={1.6} radius={0.8} />
          <ToneMapping mode={ACES_FILMIC} />
          <Vignette offset={0.25} darkness={0.7} />
        </EffectComposer>
      </Canvas>
    </div>
  );
}

/** Camera looks just below the horizon and sways slowly along it. */
function Drift() {
  useFrame(({ camera, clock }) => {
    const t = clock.elapsedTime;
    const look = tilt(HORIZON + 0.06 + Math.sin(t * 0.07) * 0.012).applyAxisAngle(new THREE.Vector3(0, 0, 1), Math.sin(t * 0.05) * 0.05);
    // "Up" is away from Earth's center, then rolled so the horizon runs corner to corner.
    const up = new THREE.Vector3(0, 0, 1).applyAxisAngle(look, ROLL + Math.sin(t * 0.04) * 0.02);
    camera.position.set(0, 0, CAM_DIST);
    camera.up.copy(up);
    camera.lookAt(camera.position.clone().add(look));
  });
  return null;
}
