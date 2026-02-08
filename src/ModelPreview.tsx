import { useMemo, useEffect, useRef } from "react";
import { Canvas, useThree, useFrame } from "@react-three/fiber";
import { OrbitControls, ContactShadows } from "@react-three/drei";
import * as THREE from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import type { SceneData, SceneType, Polygon, RoadData } from "./types";
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

// ---- Merged geometry components (one draw call each) ----

function MergedBuildings({ buildings }: { buildings: SceneData["buildings"] }) {
  const geometry = useMemo(() => {
    if (buildings.length === 0) return null;
    const geos: THREE.ExtrudeGeometry[] = [];
    for (const b of buildings) {
      const shape = polygonToShape(b.polygon);
      geos.push(new THREE.ExtrudeGeometry(shape, { depth: b.heightMm, bevelEnabled: false }));
    }
    const merged = mergeGeometries(geos, false);
    for (const g of geos) g.dispose();
    return merged;
  }, [buildings]);

  if (!geometry) return null;
  return (
    <mesh geometry={geometry} rotation={[-Math.PI / 2, 0, 0]} position={[0, BASE_THICKNESS_MM / 2, 0]} castShadow>
      <meshStandardMaterial color="#b0b0b0" roughness={0.65} metalness={0.05} />
    </mesh>
  );
}

function MergedRoads({ roads }: { roads: SceneData["roads"] }) {
  const geometry = useMemo(() => {
    if (roads.length === 0) return null;
    const geos: THREE.ExtrudeGeometry[] = [];
    for (const r of roads) {
      const depth = r.kind === "major" ? 0.35 : r.kind === "minor" ? 0.25 : 0.15;
      const shape = polygonToShape(r.polygon);
      geos.push(new THREE.ExtrudeGeometry(shape, { depth, bevelEnabled: false }));
    }
    const merged = mergeGeometries(geos, false);
    for (const g of geos) g.dispose();
    return merged;
  }, [roads]);

  if (!geometry) return null;
  return (
    <mesh geometry={geometry} rotation={[-Math.PI / 2, 0, 0]} position={[0, BASE_THICKNESS_MM / 2 - 0.1, 0]}>
      <meshStandardMaterial color="#6b7280" roughness={0.85} metalness={0} />
    </mesh>
  );
}

function MergedWater({ water }: { water: SceneData["water"] }) {
  const geometry = useMemo(() => {
    if (water.length === 0) return null;
    const geos: THREE.ExtrudeGeometry[] = [];
    for (const w of water) {
      const shape = polygonToShape(w.polygon);
      geos.push(new THREE.ExtrudeGeometry(shape, { depth: 0.5, bevelEnabled: false }));
    }
    const merged = mergeGeometries(geos, false);
    for (const g of geos) g.dispose();
    return merged;
  }, [water]);

  if (!geometry) return null;
  return (
    <mesh geometry={geometry} rotation={[-Math.PI / 2, 0, 0]} position={[0, BASE_THICKNESS_MM / 2 - 0.3, 0]}>
      <meshStandardMaterial color="#60a5fa" roughness={0.2} metalness={0.1} />
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
  const legH = 160;
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
      {([
        { pos: [0, 42, 0] as const, r: 10 },
        { pos: [-8, 36, 5] as const, r: 9 },
        { pos: [6, 38, -4] as const, r: 11 },
        { pos: [3, 45, 6] as const, r: 8 },
        { pos: [-5, 44, -3] as const, r: 10 },
      ]).map((leaf, i) => (
        <mesh key={i} position={leaf.pos} castShadow>
          <sphereGeometry args={[leaf.r, 8, 8]} />
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

// ---- Wall Shelf scene: floating shelf on living room wall ----

function WallShelfRoom() {
  return (
    <group>
      {/* Floor */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -400, 0]} receiveShadow>
        <planeGeometry args={[1500, 1500]} />
        <meshStandardMaterial color="#8b7355" roughness={0.75} metalness={0.01} />
      </mesh>
      {/* Back wall */}
      <mesh position={[0, 100, -300]} receiveShadow>
        <planeGeometry args={[1500, 1200]} />
        <meshStandardMaterial color="#e8ddd0" roughness={0.95} />
      </mesh>
      {/* Floating shelf — depth 230 so a 200mm model fits with margin */}
      <mesh position={[0, -10, -55]} receiveShadow castShadow>
        <boxGeometry args={[420, 12, 230]} />
        <meshStandardMaterial color="#6b4226" roughness={0.5} metalness={0.02} />
      </mesh>
      {/* Shelf bracket left */}
      <mesh position={[-160, -30, -155]} castShadow>
        <boxGeometry args={[6, 36, 6]} />
        <meshStandardMaterial color="#2a2a2a" roughness={0.4} metalness={0.3} />
      </mesh>
      {/* Shelf bracket right */}
      <mesh position={[160, -30, -155]} castShadow>
        <boxGeometry args={[6, 36, 6]} />
        <meshStandardMaterial color="#2a2a2a" roughness={0.4} metalness={0.3} />
      </mesh>
      {/* Small framed picture on wall */}
      <group position={[250, 100, -298]}>
        {/* Frame */}
        <mesh>
          <boxGeometry args={[80, 100, 4]} />
          <meshStandardMaterial color="#3d2b1f" roughness={0.5} />
        </mesh>
        {/* Canvas/picture area */}
        <mesh position={[0, 0, 2.5]}>
          <planeGeometry args={[64, 84]} />
          <meshStandardMaterial color="#c9b99a" roughness={0.9} />
        </mesh>
      </group>
      {/* Small decorative vase */}
      <group position={[-165, 6, -30]}>
        <mesh position={[0, 10, 0]} castShadow>
          <cylinderGeometry args={[8, 10, 30, 12]} />
          <meshStandardMaterial color="#4a6741" roughness={0.6} metalness={0.05} />
        </mesh>
      </group>
    </group>
  );
}

// ---- Display Pedestal scene: museum/gallery style ----

function PedestalRoom() {
  return (
    <group>
      {/* Floor */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -350, 0]} receiveShadow>
        <planeGeometry args={[1500, 1500]} />
        <meshStandardMaterial color="#d4cfc8" roughness={0.5} metalness={0.02} />
      </mesh>
      {/* Back wall */}
      <mesh position={[0, 150, -450]} receiveShadow>
        <planeGeometry args={[1500, 1200]} />
        <meshStandardMaterial color="#f5f3f0" roughness={0.95} />
      </mesh>
      {/* Pedestal column */}
      <mesh position={[0, -175, 0]} receiveShadow castShadow>
        <boxGeometry args={[260, 350, 260]} />
        <meshStandardMaterial color="#f0ede8" roughness={0.35} metalness={0.0} />
      </mesh>
      {/* Pedestal top cap */}
      <mesh position={[0, 2, 0]} receiveShadow castShadow>
        <boxGeometry args={[280, 6, 280]} />
        <meshStandardMaterial color="#e8e4de" roughness={0.3} metalness={0.0} />
      </mesh>
      {/* Subtle floor line */}
      <mesh position={[0, -349, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[280, 300, 32]} />
        <meshStandardMaterial color="#c4bfb8" roughness={0.6} transparent opacity={0.3} />
      </mesh>
    </group>
  );
}

// ---- Bookshelf scene: model on a shelf surrounded by books ----

function BookshelfRoom() {
  const shelfColor = "#5c3d1e";
  const shelfW = 500;
  const shelfD = 240;
  const shelfThick = 10;

  return (
    <group>
      {/* Back wall */}
      <mesh position={[0, 100, -300]} receiveShadow>
        <planeGeometry args={[1500, 1200]} />
        <meshStandardMaterial color="#f0ebe3" roughness={0.95} />
      </mesh>
      {/* Bottom shelf */}
      <mesh position={[0, -12, -50]} receiveShadow castShadow>
        <boxGeometry args={[shelfW, shelfThick, shelfD]} />
        <meshStandardMaterial color={shelfColor} roughness={0.55} metalness={0.02} />
      </mesh>
      {/* Top shelf above */}
      <mesh position={[0, 200, -50]} receiveShadow castShadow>
        <boxGeometry args={[shelfW, shelfThick, shelfD]} />
        <meshStandardMaterial color={shelfColor} roughness={0.55} metalness={0.02} />
      </mesh>
      {/* Left side panel */}
      <mesh position={[-(shelfW / 2 + 5), 94, -50]} castShadow>
        <boxGeometry args={[10, 224, shelfD]} />
        <meshStandardMaterial color={shelfColor} roughness={0.55} metalness={0.02} />
      </mesh>
      {/* Right side panel */}
      <mesh position={[(shelfW / 2 + 5), 94, -50]} castShadow>
        <boxGeometry args={[10, 224, shelfD]} />
        <meshStandardMaterial color={shelfColor} roughness={0.55} metalness={0.02} />
      </mesh>
      {/* Books to the left of model */}
      {[
        { x: -175, w: 18, h: 140, color: "#8b2500" },
        { x: -155, w: 14, h: 130, color: "#2c3e50" },
        { x: -138, w: 20, h: 145, color: "#1a4a3a" },
        { x: -116, w: 12, h: 125, color: "#4a3728" },
      ].map((book, i) => (
        <mesh key={`bl${i}`} position={[book.x, book.h / 2 - 7, -60]} castShadow>
          <boxGeometry args={[book.w, book.h, 100]} />
          <meshStandardMaterial color={book.color} roughness={0.7} />
        </mesh>
      ))}
      {/* Books to the right of model */}
      {[
        { x: 130, w: 16, h: 135, color: "#5b3256" },
        { x: 148, w: 20, h: 140, color: "#1a3a5c" },
        { x: 170, w: 14, h: 120, color: "#6b4226" },
      ].map((book, i) => (
        <mesh key={`br${i}`} position={[book.x, book.h / 2 - 7, -60]} castShadow>
          <boxGeometry args={[book.w, book.h, 100]} />
          <meshStandardMaterial color={book.color} roughness={0.7} />
        </mesh>
      ))}
      {/* Small globe ornament on right */}
      <mesh position={[195, 15, -20]} castShadow>
        <sphereGeometry args={[16, 16, 16]} />
        <meshStandardMaterial color="#6b8cae" roughness={0.4} metalness={0.1} />
      </mesh>
    </group>
  );
}

// ---- Window Sill scene: model on a ledge with window frame ----

function WindowSillRoom() {
  return (
    <group>
      {/* Wall behind window */}
      <mesh position={[0, 100, -200]} receiveShadow>
        <planeGeometry args={[1500, 1200]} />
        <meshStandardMaterial color="#e8e4de" roughness={0.95} />
      </mesh>
      {/* Window opening — lighter area representing sky/light */}
      <mesh position={[0, 150, -198]}>
        <planeGeometry args={[360, 400]} />
        <meshStandardMaterial color="#b8d4e8" roughness={0.9} emissive="#8ab4d4" emissiveIntensity={0.15} />
      </mesh>
      {/* Window frame - top */}
      <mesh position={[0, 352, -196]} castShadow>
        <boxGeometry args={[380, 12, 8]} />
        <meshStandardMaterial color="#f5f2ed" roughness={0.4} />
      </mesh>
      {/* Window frame - bottom */}
      <mesh position={[0, -48, -196]} castShadow>
        <boxGeometry args={[380, 12, 8]} />
        <meshStandardMaterial color="#f5f2ed" roughness={0.4} />
      </mesh>
      {/* Window frame - left */}
      <mesh position={[-186, 150, -196]} castShadow>
        <boxGeometry args={[12, 412, 8]} />
        <meshStandardMaterial color="#f5f2ed" roughness={0.4} />
      </mesh>
      {/* Window frame - right */}
      <mesh position={[186, 150, -196]} castShadow>
        <boxGeometry args={[12, 412, 8]} />
        <meshStandardMaterial color="#f5f2ed" roughness={0.4} />
      </mesh>
      {/* Center mullion vertical */}
      <mesh position={[0, 150, -196]}>
        <boxGeometry args={[6, 400, 6]} />
        <meshStandardMaterial color="#f5f2ed" roughness={0.4} />
      </mesh>
      {/* Center mullion horizontal */}
      <mesh position={[0, 150, -196]}>
        <boxGeometry args={[360, 6, 6]} />
        <meshStandardMaterial color="#f5f2ed" roughness={0.4} />
      </mesh>
      {/* Window sill / ledge — deeper (260mm), back edge flush with wall at Z≈-200 */}
      <mesh position={[0, -10, -70]} receiveShadow castShadow>
        <boxGeometry args={[440, 16, 260]} />
        <meshStandardMaterial color="#f0ebe3" roughness={0.4} metalness={0.01} />
      </mesh>
      {/* Small succulent plant on sill */}
      <group position={[170, 5, -80]}>
        <mesh position={[0, 8, 0]} castShadow>
          <cylinderGeometry args={[12, 10, 16, 8]} />
          <meshStandardMaterial color="#d4956a" roughness={0.8} />
        </mesh>
        <mesh position={[0, 20, 0]} castShadow>
          <sphereGeometry args={[10, 8, 8]} />
          <meshStandardMaterial color="#5a8a5a" roughness={0.8} />
        </mesh>
      </group>
    </group>
  );
}

// ---- Shared lighting setup ----

/** Lighting preset per scene type */
export function SceneLighting({ sceneType = "desk" as SceneType }: { sceneType?: SceneType }) {
  // Window sill gets brighter, cooler light simulating daylight
  const isWindow = sceneType === "windowSill";
  // Pedestal gets dramatic gallery lighting
  const isPedestal = sceneType === "pedestal";

  return (
    <>
      <ambientLight
        intensity={isWindow ? 0.4 : isPedestal ? 0.2 : 0.3}
        color={isWindow ? "#e8f0ff" : "#fff5e6"}
      />
      {/* Hemisphere light for natural sky/ground fill — softens harsh shadows */}
      <hemisphereLight
        args={[isWindow ? "#d4e5f7" : "#f5efe6", "#8b7355", isWindow ? 0.35 : 0.25]}
      />
      <directionalLight
        position={isWindow ? [100, 400, -150] : [300, 500, 250]}
        intensity={isWindow ? 1.3 : isPedestal ? 1.2 : 1.0}
        color={isWindow ? "#fff" : "#fff8ee"}
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
        intensity={isPedestal ? 0.4 : 0.3}
        color="#e0e8ff"
      />
      <directionalLight
        position={[-100, 200, -300]}
        intensity={0.2}
        color={isWindow ? "#e0e8ff" : "#ffe8d0"}
      />
      <pointLight position={[0, 400, 0]} intensity={isPedestal ? 0.25 : 0.15} color="#ffffff" />
      {/* Extra spot for pedestal drama */}
      {isPedestal && (
        <spotLight
          position={[0, 500, 200]}
          angle={0.3}
          penumbra={0.8}
          intensity={0.6}
          color="#fff"
          castShadow={false}
        />
      )}
    </>
  );
}

// ---- Scene environment configs ----
// modelY = surface_top_Y + BASE_THICKNESS_MM/2  →  base-plate bottom sits exactly on the surface.
// contactShadowY = surface_top_Y  →  shadow rendered at the surface plane.
// cameraTarget = approx centre of model in world space (accounts for building height).

export const SCENE_CONFIGS: Record<SceneType, {
  modelY: number;
  modelZ: number;
  contactShadowY: number;
  contactShadowColor: string;
  cameraTarget: [number, number, number];
  cameraPosition: [number, number, number];
}> = {
  // Table top surface at Y=0
  desk:       { modelY: BASE_THICKNESS_MM / 2,         modelZ: 0,   contactShadowY: 0,   contactShadowColor: "#2a1f14", cameraTarget: [0, 15, 0],   cameraPosition: [250, 180, 300] },
  // Shelf top at Y=-4  (mesh centre -10 + half-height 6)
  wallShelf:  { modelY: -4 + BASE_THICKNESS_MM / 2,    modelZ: -50, contactShadowY: -4,  contactShadowColor: "#3d2b1f", cameraTarget: [0, 10, -45], cameraPosition: [220, 140, 260] },
  // Pedestal cap top at Y=5  (mesh centre 2 + half-height 3)
  pedestal:   { modelY: 5 + BASE_THICKNESS_MM / 2,     modelZ: 0,   contactShadowY: 5,   contactShadowColor: "#444",    cameraTarget: [0, 20, 0],   cameraPosition: [250, 200, 300] },
  // Bottom shelf top at Y=-7  (mesh centre -12 + half-height 5)
  bookshelf:  { modelY: -7 + BASE_THICKNESS_MM / 2,    modelZ: -35, contactShadowY: -7,  contactShadowColor: "#2a1f14", cameraTarget: [0, 8, -30],  cameraPosition: [220, 130, 260] },
  // Window sill top at Y=-2  (mesh centre -10 + half-height 8)
  windowSill: { modelY: -2 + BASE_THICKNESS_MM / 2,    modelZ: -70, contactShadowY: -2,  contactShadowColor: "#333",    cameraTarget: [0, 12, -65], cameraPosition: [220, 150, 250] },
};

// ---- Exported scene that can be reused in static angle renders ----

export function CityScene({ sceneData, sceneType = "desk" }: { sceneData: SceneData; sceneType?: SceneType }) {
  const cfg = SCENE_CONFIGS[sceneType];

  return (
    <>
      <SceneLighting sceneType={sceneType} />

      {sceneType === "desk" && (
        <>
          <Room />
          <Table />
          <PlantPot />
          <Books />
        </>
      )}
      {sceneType === "wallShelf" && <WallShelfRoom />}
      {sceneType === "pedestal" && <PedestalRoom />}
      {sceneType === "bookshelf" && <BookshelfRoom />}
      {sceneType === "windowSill" && <WindowSillRoom />}

      <ContactShadows
        position={[0, cfg.contactShadowY, 0]}
        opacity={sceneType === "pedestal" ? 0.35 : 0.5}
        scale={500}
        blur={2.5}
        far={20}
        color={cfg.contactShadowColor}
      />
      <group position={[0, cfg.modelY, cfg.modelZ]}>
        <BasePlate
          widthMm={sceneData.modelWidthMm}
          depthMm={sceneData.modelDepthMm}
        />
        <MergedRoads roads={sceneData.roads} />
        <MergedBuildings buildings={sceneData.buildings} />
        <MergedWater water={sceneData.water} />
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
  sceneType = "desk",
  cameraPosition,
  cameraTarget = [0, 20, 0],
  style,
}: {
  sceneData: SceneData;
  sceneType?: SceneType;
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
      <CityScene sceneData={sceneData} sceneType={sceneType} />
    </Canvas>
  );
}

// ---- Render-to-image capture (one Canvas at a time, memory-friendly) ----

/** Waits a few frames for shadows/effects to settle, then captures the canvas. */
function FrameCapture({ onCapture }: { onCapture: (url: string) => void }) {
  const { gl } = useThree();
  const captured = useRef(false);
  const frameCount = useRef(0);

  useFrame(() => {
    frameCount.current++;
    // Wait 3 frames so shadows + contact shadows fully render
    if (frameCount.current >= 3 && !captured.current) {
      captured.current = true;
      const url = gl.domElement.toDataURL("image/jpeg", 0.92);
      setTimeout(() => onCapture(url), 0);
    }
  });

  return null;
}

/**
 * Renders a single angle shot into a Canvas, captures it as an image,
 * then calls onCapture with the data URL. Designed to be mounted one
 * at a time so only one WebGL context exists at any moment.
 */
export function CaptureRender({
  sceneData,
  sceneType = "desk",
  cameraPosition,
  cameraTarget = [0, 20, 0] as [number, number, number],
  onCapture,
}: {
  sceneData: SceneData;
  sceneType?: SceneType;
  cameraPosition: [number, number, number];
  cameraTarget?: [number, number, number];
  onCapture: (dataUrl: string) => void;
}) {
  return (
    <Canvas
      camera={{ fov: 28, near: 1, far: 5000 }}
      shadows
      gl={{
        antialias: true,
        toneMapping: THREE.ACESFilmicToneMapping,
        toneMappingExposure: 1.1,
        preserveDrawingBuffer: true,
      }}
      style={{
        width: "100%",
        height: "100%",
        background: "linear-gradient(165deg, #e8e2d8 0%, #d9d0c3 40%, #cfc5b7 100%)",
      }}
    >
      <StaticCamera position={cameraPosition} target={cameraTarget} />
      <CityScene sceneData={sceneData} sceneType={sceneType} />
      <FrameCapture onCapture={onCapture} />
    </Canvas>
  );
}

// ---- Fullscreen interactive viewer (overlay) ----

interface ViewerOverlayProps {
  sceneData: SceneData;
  sceneType?: SceneType;
  onClose: () => void;
}

export function ViewerOverlay({ sceneData, sceneType = "desk", onClose }: ViewerOverlayProps) {
  const cfg = SCENE_CONFIGS[sceneType];

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
          position: cfg.cameraPosition,
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
        <CityScene sceneData={sceneData} sceneType={sceneType} />
        <OrbitControls
          enablePan={false}
          enableZoom={true}
          minPolarAngle={Math.PI / 6}
          maxPolarAngle={Math.PI / 2.2}
          minDistance={200}
          maxDistance={600}
          target={cfg.cameraTarget}
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
          position: SCENE_CONFIGS.desk.cameraPosition,
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
          target={SCENE_CONFIGS.desk.cameraTarget}
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
