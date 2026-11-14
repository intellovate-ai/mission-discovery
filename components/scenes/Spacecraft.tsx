"use client";
// The players' CubeSat, built from the design. True scale: 10 cm per U, long axis vertical,
// origin at the bottom center, instrument apertures on the front (+z) face.
//   bus     -> frame size (1U 10x10x10 cm, 3U 10x10x30, 6U 20x10x30)
//   solar   -> cells on the body, or two deployable wings
//   inst1/2 -> instrument modules with their apertures on the front face (radar adds a panel)
//   radio   -> UHF tape antennas or an S-band patch on the top face
//   pointing wheels -> star tracker; thruster -> nozzle on the back
import { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import type { Design } from "@/lib/protocol";
import { Pop } from "./sceneKit";

export function busDims(design: Design) {
  const b = design.bus;
  const rows = b === "bus-1u" ? 1 : 3;
  const cols = b === "bus-6u" ? 2 : 1;
  return { rows, cols, W: 0.1 * cols, D: 0.1, H: 0.1 * rows + 0.014, hasBus: !!b };
}

let cellTex: THREE.CanvasTexture | null = null;
function solarTexture() {
  if (cellTex) return cellTex;
  const c = document.createElement("canvas");
  c.width = 256;
  c.height = 256;
  const g = c.getContext("2d")!;
  g.fillStyle = "#c9ccd1"; // substrate between cells
  g.fillRect(0, 0, 256, 256);
  for (let i = 0; i < 2; i++) {
    const x = 10 + i * 123;
    const y = 12;
    const w = 113;
    const h = 232;
    const cut = 16;
    g.beginPath();
    g.moveTo(x + cut, y);
    g.lineTo(x + w - cut, y);
    g.lineTo(x + w, y + cut);
    g.lineTo(x + w, y + h - cut);
    g.lineTo(x + w - cut, y + h);
    g.lineTo(x + cut, y + h);
    g.lineTo(x, y + h - cut);
    g.lineTo(x, y + cut);
    g.closePath();
    const grad = g.createLinearGradient(x, y, x + w, y + h);
    grad.addColorStop(0, "#1d2a5e");
    grad.addColorStop(0.5, "#16204a");
    grad.addColorStop(1, "#1f2f6b");
    g.fillStyle = grad;
    g.fill();
    g.strokeStyle = "rgba(200,205,215,0.55)";
    g.lineWidth = 1;
    for (let k = 1; k < 24; k++) {
      g.beginPath();
      g.moveTo(x + 4, y + (k * h) / 24);
      g.lineTo(x + w - 4, y + (k * h) / 24);
      g.stroke();
    }
    g.lineWidth = 3;
    g.strokeStyle = "rgba(215,220,228,0.9)";
    g.beginPath();
    g.moveTo(x + w / 2, y + 2);
    g.lineTo(x + w / 2, y + h - 2);
    g.stroke();
  }
  cellTex = new THREE.CanvasTexture(c);
  cellTex.colorSpace = THREE.SRGBColorSpace;
  cellTex.wrapS = cellTex.wrapT = THREE.RepeatWrapping;
  cellTex.anisotropy = 4;
  return cellTex;
}

function useMats() {
  return useMemo(() => {
    const solar = (rx: number, ry: number) => {
      const t = solarTexture().clone();
      t.repeat.set(rx, ry);
      t.needsUpdate = true;
      return new THREE.MeshStandardMaterial({ map: t, roughness: 0.22, metalness: 0.55, envMapIntensity: 1.3 });
    };
    return {
      solar,
      rail: new THREE.MeshStandardMaterial({ color: "#b9bec5", roughness: 0.32, metalness: 0.85 }),
      panel: new THREE.MeshStandardMaterial({ color: "#d4d8dd", roughness: 0.42, metalness: 0.7 }),
      black: new THREE.MeshStandardMaterial({ color: "#16181c", roughness: 0.55, metalness: 0.3 }),
      glass: new THREE.MeshStandardMaterial({ color: "#0b1830", roughness: 0.04, metalness: 0.9, envMapIntensity: 2 }),
      gold: new THREE.MeshStandardMaterial({ color: "#d9a542", roughness: 0.28, metalness: 1 }),
      germanium: new THREE.MeshStandardMaterial({ color: "#2b2e33", roughness: 0.1, metalness: 0.95, envMapIntensity: 1.8 }),
      tape: new THREE.MeshStandardMaterial({ color: "#e4e6ea", roughness: 0.3, metalness: 0.9, side: THREE.DoubleSide }),
      white: new THREE.MeshStandardMaterial({ color: "#f1f2f4", roughness: 0.6 }),
      pcb: new THREE.MeshStandardMaterial({ color: "#1f5c3a", roughness: 0.5 }),
      ghost: new THREE.MeshBasicMaterial({ color: "#7a8592", wireframe: true, transparent: true, opacity: 0.45 }),
    };
  }, []);
}
type Mats = ReturnType<typeof useMats>;

export default function Spacecraft({ design }: { design: Design }) {
  const m = useMats();
  const { rows, cols, W, D, H, hasBus } = busDims(design);
  const bodySolar = design.solar === "solar-body";
  const faceMat = useMemo(
    () => ({
      side: bodySolar ? m.solar(1, rows) : m.panel,
      cell: bodySolar ? m.solar(1, 1) : m.panel,
      back: bodySolar ? m.solar(cols, rows) : m.panel,
    }),
    [bodySolar, rows, cols, m],
  );

  if (!hasBus) {
    return (
      <mesh position={[0, 0.17, 0]} material={m.ghost}>
        <boxGeometry args={[0.1, 0.34, 0.1, 1, 3, 1]} />
      </mesh>
    );
  }

  // Front face cells, bottom row first: instruments take cells, the rest are panels.
  const insts = [design.instrument1, design.instrument2].filter(Boolean) as string[];
  const cells: { r: number; c: number; inst?: string; span?: number }[] = [];
  const taken = new Set<string>();
  let cursor = 0;
  for (const id of insts) {
    const need = id === "inst-radar" ? 2 : 1;
    if (cursor + need > rows * cols) break;
    const r = Math.floor(cursor / cols);
    const c = cursor % cols;
    cells.push({ r, c, inst: id, span: need });
    for (let k = 0; k < need; k++) taken.add(`${Math.floor((cursor + k) / cols)}:${(cursor + k) % cols}`);
    cursor += need;
  }
  for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) if (!taken.has(`${r}:${c}`)) cells.push({ r, c });

  const cellX = (c: number) => -W / 2 + 0.05 + c * 0.1;
  const cellY = (r: number) => 0.007 + 0.05 + r * 0.1;
  const rail = 0.0085;

  return (
    <group key={design.bus}>
      <Pop speed={5}>
        {/* rails */}
        {[
          [-1, -1],
          [1, -1],
          [-1, 1],
          [1, 1],
        ].map(([sx, sz]) => (
          <mesh key={`${sx}${sz}`} position={[(sx * (W - rail)) / 2, H / 2, (sz * (D - rail)) / 2]} material={m.rail} castShadow>
            <boxGeometry args={[rail, H, rail]} />
          </mesh>
        ))}
        {/* end plates */}
        {[0.0035, H - 0.0035].map((y) => (
          <mesh key={y} position={[0, y, 0]} material={m.rail} castShadow receiveShadow>
            <boxGeometry args={[W - 0.002, 0.007, D - 0.002]} />
          </mesh>
        ))}
        {/* side and back faces */}
        <mesh position={[W / 2 - 0.0035, H / 2, 0]} rotation={[0, Math.PI / 2, 0]} material={faceMat.side} castShadow>
          <planeGeometry args={[D - rail * 2, H - 0.016]} />
        </mesh>
        <mesh position={[-W / 2 + 0.0035, H / 2, 0]} rotation={[0, -Math.PI / 2, 0]} material={faceMat.side} castShadow>
          <planeGeometry args={[D - rail * 2, H - 0.016]} />
        </mesh>
        <mesh position={[0, H / 2, -D / 2 + 0.0035]} rotation={[0, Math.PI, 0]} material={faceMat.back} castShadow>
          <planeGeometry args={[W - rail * 2, H - 0.016]} />
        </mesh>
        {/* inner volume so the faces never look hollow */}
        <mesh position={[0, H / 2, 0]} material={m.black}>
          <boxGeometry args={[W - 0.012, H - 0.02, D - 0.012]} />
        </mesh>
        {/* front cells */}
        {cells.map((cell) =>
          cell.inst ? (
            <Pop key={`${cell.inst}-${cell.r}-${cell.c}`}>
              <group position={[cellX(cell.c), cellY(cell.r) + (cell.span === 2 && cols === 1 ? 0.05 : 0), D / 2 - 0.0035]}>
                <Instrument id={cell.inst} m={m} wide={cell.span === 2 && cols === 2} tall={cell.span === 2 && cols === 1} />
              </group>
            </Pop>
          ) : (
            <mesh key={`p-${cell.r}-${cell.c}`} position={[cellX(cell.c), cellY(cell.r), D / 2 - 0.0035]} material={faceMat.cell} castShadow>
              <planeGeometry args={[0.1 - rail * 1.4, 0.1 - 0.004]} />
            </mesh>
          ),
        )}
      </Pop>

      {design.solar === "solar-wings" && <Wings key={`w-${design.bus}`} W={W} D={D} H={H} m={m} />}
      {insts.includes("inst-radar") && (
        <Pop key="radar-panel">
          <RadarPanel W={W} D={D} H={H} m={m} />
        </Pop>
      )}
      {design.radio && (
        <group position={[0, H, 0]}>
          <Pop key={design.radio}>{design.radio === "radio-sband" ? <SBand m={m} W={W} /> : <Uhf m={m} W={W} D={D} />}</Pop>
        </group>
      )}
      {design.pointing === "pointing-wheels" && (
        <group position={[W / 2 - 0.03, H, -D / 2 + 0.03]}>
          <Pop key="tracker">
            <mesh position={[0, 0.025, 0]} rotation={[-0.35, 0, 0.25]} material={m.black} castShadow>
              <cylinderGeometry args={[0.016, 0.022, 0.05, 16, 1, true]} />
            </mesh>
            <mesh position={[0, 0.006, 0]} material={m.black}>
              <boxGeometry args={[0.035, 0.012, 0.035]} />
            </mesh>
          </Pop>
        </group>
      )}
      {design.thruster && (
        <group position={[0, 0.06, -D / 2]}>
          <Pop key="thruster">
            <mesh position={[0, 0, -0.012]} rotation={[-Math.PI / 2, 0, 0]} material={m.gold} castShadow>
              <cylinderGeometry args={[0.006, 0.016, 0.024, 16, 1, true]} />
            </mesh>
          </Pop>
        </group>
      )}
    </group>
  );
}

function Instrument({ id, m, wide, tall }: { id: string; m: Mats; wide?: boolean; tall?: boolean }) {
  const pw = wide ? 0.19 : 0.088;
  const ph = tall ? 0.19 : 0.094;
  const plate = (
    <mesh material={m.black} castShadow>
      <boxGeometry args={[pw, ph, 0.004]} />
    </mesh>
  );
  if (id === "inst-color")
    return (
      <group>
        {plate}
        <mesh position={[0, 0, 0.012]} rotation={[Math.PI / 2, 0, 0]} material={m.black} castShadow>
          <cylinderGeometry args={[0.02, 0.022, 0.024, 20]} />
        </mesh>
        <mesh position={[0, 0, 0.0245]} rotation={[Math.PI / 2, 0, 0]} material={m.glass}>
          <cylinderGeometry args={[0.015, 0.015, 0.002, 20]} />
        </mesh>
      </group>
    );
  if (id === "inst-multi")
    return (
      <group>
        {plate}
        {[
          [-1, -1],
          [1, -1],
          [-1, 1],
          [1, 1],
        ].map(([a, b]) => (
          <group key={`${a}${b}`} position={[a * 0.021, b * 0.021, 0]}>
            <mesh position={[0, 0, 0.009]} rotation={[Math.PI / 2, 0, 0]} material={m.panel} castShadow>
              <cylinderGeometry args={[0.014, 0.015, 0.018, 16]} />
            </mesh>
            <mesh position={[0, 0, 0.0185]} rotation={[Math.PI / 2, 0, 0]} material={m.glass}>
              <cylinderGeometry args={[0.01, 0.01, 0.002, 16]} />
            </mesh>
          </group>
        ))}
      </group>
    );
  if (id === "inst-thermal")
    return (
      <group>
        {plate}
        <mesh position={[0, 0, 0.016]} rotation={[Math.PI / 2, 0, 0]} material={m.gold} castShadow>
          <cylinderGeometry args={[0.036, 0.04, 0.032, 24]} />
        </mesh>
        <mesh position={[0, 0, 0.0325]} rotation={[Math.PI / 2, 0, 0]} material={m.germanium}>
          <cylinderGeometry args={[0.029, 0.029, 0.002, 24]} />
        </mesh>
      </group>
    );
  // radar electronics: plate with connector rows
  return (
    <group>
      {plate}
      {[-1, 0, 1].map((k) => (
        <mesh key={k} position={[0, k * 0.03, 0.004]} material={m.gold}>
          <boxGeometry args={[pw * 0.6, 0.008, 0.004]} />
        </mesh>
      ))}
    </group>
  );
}

function Wings({ W, D, H, m }: { W: number; D: number; H: number; m: Mats }) {
  const deploy = useRef(0);
  const left1 = useRef<THREE.Group>(null);
  const left2 = useRef<THREE.Group>(null);
  const right1 = useRef<THREE.Group>(null);
  const right2 = useRef<THREE.Group>(null);
  const mat = useMemo(() => m.solar(1, (H - 0.014) / 0.1), [m, H]);
  useFrame((_, dt) => {
    deploy.current = Math.min(1, deploy.current + dt * 0.45);
    const e = deploy.current * deploy.current * (3 - 2 * deploy.current);
    const a1 = (1 - e) * (Math.PI / 2);
    const a2 = (1 - e) * Math.PI;
    if (right1.current) right1.current.rotation.y = -a1;
    if (right2.current) right2.current.rotation.y = a2;
    if (left1.current) left1.current.rotation.y = a1;
    if (left2.current) left2.current.rotation.y = -a2;
  });
  const pw = 0.098;
  const ph = H - 0.02;
  const panel = (s: number) => (
    <mesh position={[(s * pw) / 2, 0, 0]} material={mat} castShadow receiveShadow>
      <boxGeometry args={[pw, ph, 0.003]} />
    </mesh>
  );
  return (
    <group position={[0, H / 2, -D / 2 - 0.004]}>
      <group ref={right1} position={[W / 2, 0, 0]}>
        {panel(1)}
        <group ref={right2} position={[pw + 0.002, 0, 0]}>
          {panel(1)}
        </group>
      </group>
      <group ref={left1} position={[-W / 2, 0, 0]}>
        {panel(-1)}
        <group ref={left2} position={[-pw - 0.002, 0, 0]}>
          {panel(-1)}
        </group>
      </group>
    </group>
  );
}

function RadarPanel({ W, D, H, m }: { W: number; D: number; H: number; m: Mats }) {
  // Deployable flat radar antenna on the back face, tilted out.
  const pw = W + 0.1;
  const ph = H * 1.5;
  return (
    <group position={[0, H, -D / 2 - 0.01]} rotation={[-0.35, 0, 0]}>
      <mesh position={[0, -ph / 2 + 0.02, -0.004]} material={m.white} castShadow>
        <boxGeometry args={[pw, ph, 0.006]} />
      </mesh>
      {Array.from({ length: 6 }, (_, i) =>
        Array.from({ length: 4 }, (__, j) => (
          <mesh key={`${i}-${j}`} position={[-pw / 2 + (j + 0.5) * (pw / 4), -ph + 0.02 + (i + 0.5) * (ph / 6), -0.008]} rotation={[0, Math.PI, 0]} material={m.gold}>
            <planeGeometry args={[pw / 4 - 0.012, ph / 6 - 0.012]} />
          </mesh>
        )),
      )}
    </group>
  );
}

function Uhf({ m, W, D }: { m: Mats; W: number; D: number }) {
  // Antenna deployer plate with four tape spring antennas (turnstile).
  return (
    <group>
      <mesh position={[0, 0.004, 0]} material={m.pcb} castShadow>
        <boxGeometry args={[W - 0.012, 0.008, D - 0.012]} />
      </mesh>
      {[0, 1, 2, 3].map((k) => {
        const a = (k * Math.PI) / 2 + Math.PI / 4;
        return (
          <group key={k} position={[(Math.cos(a) * W) / 2.6, 0.008, (Math.sin(a) * D) / 2.6]} rotation={[0, -a, 0]}>
            <mesh position={[0.085, 0.004, 0]} rotation={[0, 0, 0.08]} material={m.tape} castShadow>
              <boxGeometry args={[0.17, 0.0008, 0.006]} />
            </mesh>
          </group>
        );
      })}
    </group>
  );
}

function SBand({ m, W }: { m: Mats; W: number }) {
  return (
    <group position={[-(W / 2) + 0.035, 0, 0]}>
      <mesh position={[0, 0.003, 0]} material={m.white} castShadow>
        <boxGeometry args={[0.05, 0.006, 0.05]} />
      </mesh>
      <mesh position={[0, 0.0065, 0]} material={m.gold}>
        <boxGeometry args={[0.03, 0.001, 0.03]} />
      </mesh>
    </group>
  );
}
