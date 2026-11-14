"use client";

// Generic smoke test: proves three.js, React Three Fiber, drei and postprocessing
// all render in this Next.js build. Delete this file once real scenes exist.
import { Canvas, useFrame } from "@react-three/fiber";
import { OrbitControls, Stars } from "@react-three/drei";
import { Bloom, EffectComposer } from "@react-three/postprocessing";
import { useRef } from "react";
import type { Mesh } from "three";

function SpinningBox() {
  const ref = useRef<Mesh>(null);
  useFrame((_, dt) => {
    if (ref.current) ref.current.rotation.y += dt;
  });
  return (
    <mesh ref={ref}>
      <boxGeometry args={[1.5, 1.5, 1.5]} />
      <meshStandardMaterial color="#e12128" emissive="#e12128" emissiveIntensity={0.6} />
    </mesh>
  );
}

export default function SmokeTest() {
  return (
    <Canvas camera={{ position: [3, 2, 4] }} style={{ height: "100vh" }}>
      <color attach="background" args={["#05060a"]} />
      <ambientLight intensity={0.4} />
      <directionalLight position={[5, 5, 5]} />
      <Stars />
      <SpinningBox />
      <OrbitControls />
      <EffectComposer>
        <Bloom intensity={0.8} />
      </EffectComposer>
    </Canvas>
  );
}
