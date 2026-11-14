"use client";
// STUB: replaced by the 3D scenes session.
import { Canvas } from "@react-three/fiber";
import { Stars } from "@react-three/drei";
import type { SceneProps } from "./types";

export default function FlightPath(props: SceneProps) {
  void props;
  return (
    <Canvas camera={{ position: [0, 1.5, 5] }} style={{ position: "absolute", inset: 0 }}>
      <color attach="background" args={["#05060a"]} />
      <Stars />
      <ambientLight intensity={0.6} />
      <mesh>
        <boxGeometry args={[1, 1, 3]} />
        <meshStandardMaterial color="#888" />
      </mesh>
    </Canvas>
  );
}
