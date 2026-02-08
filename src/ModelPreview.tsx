import { useMemo, useEffect } from "react";
import { Canvas, useThree } from "@react-three/fiber";
import { OrbitControls, ContactShadows } from "@react-three/drei";
import * as THREE from "three";
import type { SceneData, Polygon, RoadData } from "./types";
import { BASE_THICKNESS_MM } from "./geometryUtils";

// ---- Helpers to turn 2D polygon outlines into three.js geometry ----

function polygonToShape(poly: Polygon): THREE.Shape {
  const shape = new THREE.Shape();
  for (let i = 0; i < poly.length; i++) {
    const [x, y] = poly[i];
    if (i === 0) shape.moveTo(x, y);
    else shape.lineTo(x, y);
  }
  shape.closePath();
  return shape;
}

// ---- Sub-components for individual geometry types ----

function Building({
  polygon,
  heightMm,
}: {
  polygon: Polygon;
  heightMm: number;
}) {
  const geometry = useMemo(() => {
    const shape = polygonToShape(polygon);
    return new THREE.ExtrudeGeometry(shape, {
      depth: heightMm,
      bevelEnabled: false,
    });
  }, [polygon, heightMm]);

  return (
    <mesh
      geometry={geometry}
      rotation={[-Math.PI / 2, 0, 0]}
      position={[0, BASE_THICKNESS_MM / 2, 0]}
      castShadow
    >
      <meshStandardMaterial
        color="#b0b0b0"
        roughness={0.65}
        metalness={0.05}
      />
    </mesh>
  );
}

function Road({
  polygon,
  kind,
}: {
  polygon: Polygon;
  kind: RoadData["kind"];
}) {
  const depth = kind === "major" ? 0.35 : kind === "minor" ? 0.25 : 0.15;

  const geometry = useMemo(() => {
    const shape = polygonToShape(polygon);
    return new THREE.ExtrudeGeometry(shape, {
      depth,
      bevelEnabled: false,
    });
  }, [polygon, depth]);

  return (
    <mesh
      geometry={geometry}
      rotation={[-Math.PI / 2, 0, 0]}
      position={[0, BASE_THICKNESS_MM / 2 - 0.1, 0]}
    >
      <meshStandardMaterial
        color="#6b7280"
        roughness={0.85}
        metalness={0}
      />
    </mesh>
  );
}

function Water({ polygon }: { polygon: Polygon }) {
  const geometry = useMemo(() => {
    const shape = polygonToShape(polygon);
    return new THREE.ExtrudeGeometry(shape, {
      depth: 0.5,
      bevelEnabled: false,
    });
  }, [polygon]);

  return (
    <mesh
      geometry={geometry}
      rotation={[-Math.PI / 2, 0, 0]}
      position={[0, BASE_THICKNESS_MM / 2 - 0.3, 0]}
    >
      <meshStandardMaterial
        color="#60a5fa"
        roughness={0.2}
        metalness={0.1}
      />
    </mesh>
  );
}

function BasePlate({
  widthMm,
  depthMm,
}: {
  widthMm: number;
  depthMm: number;
}) {
  const frameWidth = 3;
  const frameHeight = BASE_THICKNESS_MM + 1.5;

  return (
    <group>
      {/* Main base */}
      <mesh position={[0, 0, 0]} receiveShadow castShadow>
        <boxGeometry args={[widthMm, BASE_THICKNESS_MM, depthMm]} />
        <meshStandardMaterial color="#e5e5e5" roughness={0.4} metalness={0} />
      </mesh>
      {/* Frame - 4 sides */}
      {[
        { pos: [0, 0, depthMm / 2 + frameWidth / 2] as const, size: [widthMm + frameWidth * 2, frameHeight, frameWidth] as const },
        { pos: [0, 0, -(depthMm / 2 + frameWidth / 2)] as const, size: [widthMm + frameWidth * 2, frameHeight, frameWidth] as const },
        { pos: [-(widthMm / 2 + frameWidth / 2), 0, 0] as const, size: [frameWidth, frameHeight, depthMm + frameWidth * 2] as const },
        { pos: [widthMm / 2 + frameWidth / 2, 0, 0] as const, size: [frameWidth, frameHeight, depthMm + frameWidth * 2] as const },
      ].map((side, i) => (
        <mesh key={i} position={[side.pos[0], side.pos[1], side.pos[2]]} castShadow>
          <boxGeometry args={[side.size[0], side.size[1], side.size[2]]} />
          <meshStandardMaterial color="#1a1a1a" roughness={0.3} metalness={0.1} />
        </mesh>
      ))}
    </group>
  );
}

/**
 * Modern wooden table with rounded edges and tapered legs.
 */
function Table() {
  const tableW = 480;
  const tableD = 340;
  const tableThick = 10;
  const legH = 155;
  const legTopW = 14;
  const legBottomW = 8;
  const woodColor = "#5c3d1e";
  const legInset = 35;

  const legGeometry = useMemo(() => {
    const shape = new THREE.Shape();
    const hw = legTopW / 2;
    const hb = legBottomW / 2;
    shape.moveTo(-hw, 0);
    shape.lineTo(hw, 0);
    shape.lineTo(hb, -legH);
    shape.lineTo(-hb, -legH);
    shape.closePath();

    return new THREE.ExtrudeGeometry(shape, {
      depth: legTopW,
      bevelEnabled: true,
      bevelThickness: 1,
      bevelSize: 1,
      bevelSegments: 2,
    });
  }, []);

  return (
    <group position={[0, -(tableThick / 2), 0]}>
      <mesh position={[0, 0, 0]} receiveShadow castShadow>
        <boxGeometry args={[tableW, tableThick, tableD]} />
        <meshStandardMaterial
          color={woodColor}
          roughness={0.55}
          metalness={0.02}
        />
      </mesh>
      <mesh position={[0, -(tableThick / 2 + 0.5), 0]}>
        <boxGeometry args={[tableW - 4, 1, tableD - 4]} />
        <meshStandardMaterial color="#4a3118" roughness={0.6} />
      </mesh>
      {[
        { x: -(tableW / 2 - legInset), z: -(tableD / 2 - legInset) },
        { x: (tableW / 2 - legInset), z: -(tableD / 2 - legInset) },
        { x: -(tableW / 2 - legInset), z: (tableD / 2 - legInset) },
        { x: (tableW / 2 - legInset), z: (tableD / 2 - legInset) },
      ].map((pos, i) => (
        <mesh
          key={i}
          geometry={legGeometry}
          position={[pos.x, -(tableThick / 2), pos.z - legTopW / 2]}
        >
          <meshStandardMaterial color={woodColor} roughness={0.55} metalness={0.02} />
        </mesh>
      ))}
    </group>
  );
}

function PlantPot() {
  return (
    <group position={[160, 0, -90]}>
      <mesh position={[0, 12, 0]} castShadow>
        <cylinderGeometry args={[14, 11, 24, 16]} />
        <meshStandardMaterial color="#c4956a" roughness={0.8} />
      </mesh>
      <mesh position={[0, 24.5, 0]}>
        <cylinderGeometry args={[13, 13, 1, 16]} />
        <meshStandardMaterial color="#3d2b1f" roughness={0.95} />
      </mesh>
      {[
        [0, 42, 0],
        [-8, 36, 5],
        [6, 38, -4],
        [3, 45, 6],
        [-5, 44, -3],
      ].map(([x, y, z], i) => (
        <mesh key={i} position={[x, y, z]} castShadow>
          <sphereGeometry args={[8 + Math.random() * 3, 8, 8]} />
          <meshStandardMaterial color="#4a7c59" roughness={0.8} />
        </mesh>
      ))}
    </group>
  );
}

function Books() {
  const books = [
    { w: 50, h: 6, d: 35, color: "#2c3e50", y: 3 },
    { w: 48, h: 5, d: 33, color: "#8b4513", y: 8.5 },
    { w: 46, h: 7, d: 32, color: "#1a3a4a", y: 14.5 },
  ];

  return (
    <group position={[-170, 0, -60]} rotation={[0, 0.15, 0]}>
      {books.map((b, i) => (
        <mesh key={i} position={[0, b.y, 0]} castShadow>
          <boxGeometry args={[b.w, b.h, b.d]} />
          <meshStandardMaterial color={b.color} roughness={0.7} />
        </mesh>
      ))}
    </group>
  );
}

function Room() {
  return (
    <group>
      <mesh
        rotation={[-Math.PI / 2, 0, 0]}
        position={[0, -170, 0]}
        receiveShadow
      >
        <planeGeometry args={[1500, 1500]} />
        <meshStandardMaterial color="#c4a676" roughness={0.7} metalness={0.01} />
      </mesh>

      <mesh position={[0, 230, -420]} receiveShadow>
        <planeGeometry args={[1500, 900]} />
        <meshStandardMaterial color="#f0ebe3" roughness={0.95} />
      </mesh>

      <mesh
        position={[-500, 230, 0]}
        rotation={[0, Math.PI / 2, 0]}
        receiveShadow
      >
        <planeGeometry args={[1200, 900]} />
        <meshStandardMaterial color="#ede8e0" roughness={0.95} />
      </mesh>

      <mesh position={[0, -155, -418]}>
        <boxGeometry args={[1500, 30, 4]} />
        <meshStandardMaterial color="#f5f2ed" roughness={0.6} />
      </mesh>

      <mesh
        position={[-498, -155, 0]}
        rotation={[0, Math.PI / 2, 0]}
      >
        <boxGeometry args={[1200, 30, 4]} />
        <meshStandardMaterial color="#f5f2ed" roughness={0.6} />
      </mesh>
    </group>
  );
}

// ---- Shared lighting setup ----

export function SceneLighting() {
  return (
    <>
      <ambientLight intensity={0.35} color="#fff5e6" />
      <directionalLight
        position={[300, 500, 250]}
        intensity={1.0}
        color="#fff8ee"
        castShadow
        shadow-mapSize-width={2048}
        shadow-mapSize-height={2048}
        shadow-camera-left={-400}
        shadow-camera-right={400}
        shadow-camera-top={400}
        shadow-camera-bottom={-400}
        shadow-camera-near={1}
        shadow-camera-far={1500}
        shadow-bias={-0.0005}
      />
      <directionalLight
        position={[-250, 300, 100]}
        intensity={0.3}
        color="#e0e8ff"
      />
      <directionalLight
        position={[-100, 200, -300]}
        intensity={0.2}
        color="#ffe8d0"
      />
      <pointLight position={[0, 400, 0]} intensity={0.15} color="#ffffff" />
    </>
  );
}

// ---- Exported scene that can be reused in static angle renders ----

export function CityScene({ sceneData }: { sceneData: SceneData }) {
  return (
    <>
      <SceneLighting />
      <Room />
      <Table />
      <PlantPot />
      <Books />
      <ContactShadows
        position={[0, -0.5, 0]}
        opacity={0.5}
        scale={500}
        blur={2.5}
        far={20}
        color="#2a1f14"
      />
      <group position={[0, BASE_THICKNESS_MM / 2 + 4, 10]}>
        <BasePlate
          widthMm={sceneData.modelWidthMm}
          depthMm={sceneData.modelDepthMm}
        />
        {sceneData.roads.map((r, i) => (
          <Road key={`r-${i}`} polygon={r.polygon} kind={r.kind} />
        ))}
        {sceneData.buildings.map((b, i) => (
          <Building key={`b-${i}`} polygon={b.polygon} heightMm={b.heightMm} />
        ))}
        {sceneData.water.map((w, i) => (
          <Water key={`w-${i}`} polygon={w.polygon} />
        ))}
      </group>
    </>
  );
}

// ---- Static camera for angle shots (no orbit controls) ----

function StaticCamera({ position, target }: { position: [number, number, number]; target: [number, number, number] }) {
  const { camera } = useThree();
  useEffect(() => {
    camera.position.set(...position);
    camera.lookAt(new THREE.Vector3(...target));
    camera.updateProjectionMatrix();
  }, [camera, position, target]);
  return null;
}

/** Renders a static angle shot of the city model — no interactivity. */
export function StaticAngleRender({
  sceneData,
  cameraPosition,
  cameraTarget = [0, 20, 0],
  style,
}: {
  sceneData: SceneData;
  cameraPosition: [number, number, number];
  cameraTarget?: [number, number, number];
  style?: React.CSSProperties;
}) {
  return (
    <Canvas
      camera={{ fov: 28, near: 1, far: 5000 }}
      shadows
      gl={{ antialias: true, toneMapping: THREE.ACESFilmicToneMapping, toneMappingExposure: 1.1, preserveDrawingBuffer: true }}
      style={{
        background: "linear-gradient(165deg, #e8e2d8 0%, #d9d0c3 40%, #cfc5b7 100%)",
        ...style,
      }}
      frameloop="demand"
    >
      <StaticCamera position={cameraPosition} target={cameraTarget} />
      <CityScene sceneData={sceneData} />
    </Canvas>
  );
}

// ---- Fullscreen interactive viewer (overlay) ----

interface ViewerOverlayProps {
  sceneData: SceneData;
  onClose: () => void;
}

export function ViewerOverlay({ sceneData, onClose }: ViewerOverlayProps) {
  useEffect(() => {
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = ""; };
  }, []);

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 9999,
        background: "#000",
        display: "flex",
        flexDirection: "column",
      }}
    >
      {/* Close bar */}
      <div
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          right: 0,
          zIndex: 10,
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          padding: "12px 20px",
          background: "linear-gradient(to bottom, rgba(0,0,0,0.6), transparent)",
        }}
      >
        <span style={{ color: "rgba(255,255,255,0.7)", fontSize: 13, fontWeight: 500 }}>
          Interactive 3D View
        </span>
        <button
          onClick={onClose}
          style={{
            background: "rgba(255,255,255,0.15)",
            backdropFilter: "blur(8px)",
            border: "1px solid rgba(255,255,255,0.2)",
            color: "#fff",
            width: 40,
            height: 40,
            borderRadius: "50%",
            cursor: "pointer",
            fontSize: 18,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          ✕
        </button>
      </div>

      <Canvas
        camera={{
          position: [250, 180, 300],
          fov: 28,
          near: 1,
          far: 5000,
        }}
        shadows
        gl={{ antialias: true, toneMapping: THREE.ACESFilmicToneMapping, toneMappingExposure: 1.1 }}
        style={{
          flex: 1,
          background: "linear-gradient(165deg, #e8e2d8 0%, #d9d0c3 40%, #cfc5b7 100%)",
        }}
      >
        <CityScene sceneData={sceneData} />
        <OrbitControls
          enablePan={false}
          enableZoom={true}
          minPolarAngle={Math.PI / 6}
          maxPolarAngle={Math.PI / 2.2}
          minDistance={200}
          maxDistance={600}
          target={[0, 20, 0]}
          autoRotate
          autoRotateSpeed={0.4}
        />
      </Canvas>

      {/* Info badge */}
      <div
        style={{
          position: "absolute",
          bottom: 16,
          left: 16,
          background: "rgba(0,0,0,0.7)",
          backdropFilter: "blur(8px)",
          color: "#fff",
          padding: "8px 16px",
          borderRadius: 8,
          fontSize: 12,
          letterSpacing: 0.3,
          zIndex: 10,
        }}
      >
        <span style={{ fontWeight: 600, marginRight: 8 }}>200mm Print</span>
        <span style={{ margin: "0 6px", opacity: 0.4 }}>|</span>
        {sceneData.buildings.length} buildings
        <span style={{ margin: "0 6px", opacity: 0.4 }}>|</span>
        {sceneData.roads.length} roads
        <span style={{ margin: "0 6px", opacity: 0.4 }}>|</span>
        {sceneData.water.length} water
      </div>

      {/* Drag hint */}
      <div
        style={{
          position: "absolute",
          bottom: 16,
          right: 16,
          background: "rgba(0,0,0,0.45)",
          backdropFilter: "blur(8px)",
          color: "rgba(255,255,255,0.8)",
          padding: "6px 12px",
          borderRadius: 6,
          fontSize: 11,
          letterSpacing: 0.2,
          zIndex: 10,
        }}
      >
        {("ontouchstart" in window || navigator.maxTouchPoints > 0)
          ? "Pinch to zoom, drag to rotate"
          : "Scroll to zoom, drag to rotate"}
      </div>
    </div>
  );
}

// ---- Original preview component (kept for loading/empty states) ----

interface Props {
  sceneData: SceneData | null;
  loading: boolean;
  error: string | null;
}

export default function ModelPreview({ sceneData, loading, error }: Props) {
  if (loading) {
    return (
      <div style={overlayStyle}>
        <div style={{ textAlign: "center" }}>
          <div style={spinnerStyle} />
          <div style={{ marginTop: 16, fontSize: 14, color: "#666" }}>
            Fetching map data...
          </div>
        </div>
      </div>
    );
  }

  if (!sceneData) {
    return (
      <div style={overlayStyle}>
        <div style={{ textAlign: "center", maxWidth: 280 }}>
          <div style={{ fontSize: 32, marginBottom: 12, opacity: 0.3 }}>&#9634;</div>
          <div style={{ color: "#888", fontSize: 13, lineHeight: 1.5 }}>
            Select an area on the map to preview your 3D city print.
          </div>
        </div>
      </div>
    );
  }

  return (
    <div style={{ width: "100%", height: "100%", position: "relative" }}>
      <Canvas
        camera={{
          position: [250, 180, 300],
          fov: 28,
          near: 1,
          far: 5000,
        }}
        shadows
        gl={{ antialias: true, toneMapping: THREE.ACESFilmicToneMapping, toneMappingExposure: 1.1 }}
        style={{ background: "linear-gradient(165deg, #e8e2d8 0%, #d9d0c3 40%, #cfc5b7 100%)" }}
      >
        <CityScene sceneData={sceneData} />
        <OrbitControls
          enablePan={false}
          enableZoom={true}
          minPolarAngle={Math.PI / 6}
          maxPolarAngle={Math.PI / 2.2}
          minDistance={200}
          maxDistance={600}
          target={[0, 20, 0]}
          autoRotate
          autoRotateSpeed={0.4}
        />
      </Canvas>

      <div style={infoBadgeStyle}>
        <span style={{ fontWeight: 600, marginRight: 8 }}>200mm Print</span>
        <span style={dividerStyle}>|</span>
        {sceneData.buildings.length} buildings
        <span style={dividerStyle}>|</span>
        {sceneData.roads.length} roads
        <span style={dividerStyle}>|</span>
        {sceneData.water.length} water
      </div>

      <div style={dragHintStyle}>
        {("ontouchstart" in window || navigator.maxTouchPoints > 0)
          ? "Touch to rotate"
          : "Drag to rotate"}
      </div>

      {error && (
        <div style={errorBadgeStyle}>
          Overpass error: {error} — showing mock data
        </div>
      )}
    </div>
  );
}

const overlayStyle: React.CSSProperties = {
  width: "100%",
  height: "100%",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  background: "linear-gradient(165deg, #f5f0ea 0%, #ebe5db 100%)",
  color: "#333",
};

const spinnerStyle: React.CSSProperties = {
  width: 32,
  height: 32,
  border: "3px solid #ddd",
  borderTopColor: "#555",
  borderRadius: "50%",
  margin: "0 auto",
  animation: "spin 0.8s linear infinite",
};

const infoBadgeStyle: React.CSSProperties = {
  position: "absolute",
  bottom: 16,
  left: 16,
  background: "rgba(0,0,0,0.7)",
  backdropFilter: "blur(8px)",
  color: "#fff",
  padding: "8px 16px",
  borderRadius: 8,
  fontSize: 12,
  letterSpacing: 0.3,
};

const dividerStyle: React.CSSProperties = {
  margin: "0 6px",
  opacity: 0.4,
};

const dragHintStyle: React.CSSProperties = {
  position: "absolute",
  top: 16,
  right: 16,
  background: "rgba(0,0,0,0.45)",
  backdropFilter: "blur(8px)",
  color: "rgba(255,255,255,0.8)",
  padding: "6px 12px",
  borderRadius: 6,
  fontSize: 11,
  letterSpacing: 0.2,
};

const errorBadgeStyle: React.CSSProperties = {
  position: "absolute",
  top: 12,
  left: 12,
  background: "rgba(239,68,68,0.85)",
  backdropFilter: "blur(8px)",
  color: "#fff",
  padding: "8px 14px",
  borderRadius: 8,
  fontSize: 12,
};
