import { useMemo } from "react";
import { Canvas } from "@react-three/fiber";
import * as THREE from "three";
import type { SceneData, Polygon } from "./types";
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
    const geo = new THREE.ExtrudeGeometry(shape, {
      depth: heightMm,
      bevelEnabled: false,
    });
    return geo;
  }, [polygon, heightMm]);

  return (
    <mesh
      geometry={geometry}
      rotation={[-Math.PI / 2, 0, 0]}
      position={[0, BASE_THICKNESS_MM / 2, 0]}
    >
      <meshStandardMaterial color="#9ca3af" flatShading />
    </mesh>
  );
}

function Water({ polygon }: { polygon: Polygon }) {
  const geometry = useMemo(() => {
    const shape = polygonToShape(polygon);
    const geo = new THREE.ExtrudeGeometry(shape, {
      depth: 0.5,
      bevelEnabled: false,
    });
    return geo;
  }, [polygon]);

  return (
    <mesh
      geometry={geometry}
      rotation={[-Math.PI / 2, 0, 0]}
      position={[0, BASE_THICKNESS_MM / 2 - 0.3, 0]}
    >
      <meshStandardMaterial color="#3b82f6" flatShading />
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
  const frameWidth = 2;

  return (
    <group>
      <mesh position={[0, 0, 0]}>
        <boxGeometry args={[widthMm, BASE_THICKNESS_MM, depthMm]} />
        <meshStandardMaterial color="#d4d4d4" />
      </mesh>
      {/* Front */}
      <mesh position={[0, 0, depthMm / 2 + frameWidth / 2]}>
        <boxGeometry
          args={[widthMm + frameWidth * 2, BASE_THICKNESS_MM + 0.5, frameWidth]}
        />
        <meshStandardMaterial color="#1a1a1a" />
      </mesh>
      {/* Back */}
      <mesh position={[0, 0, -(depthMm / 2 + frameWidth / 2)]}>
        <boxGeometry
          args={[widthMm + frameWidth * 2, BASE_THICKNESS_MM + 0.5, frameWidth]}
        />
        <meshStandardMaterial color="#1a1a1a" />
      </mesh>
      {/* Left */}
      <mesh position={[-(widthMm / 2 + frameWidth / 2), 0, 0]}>
        <boxGeometry
          args={[frameWidth, BASE_THICKNESS_MM + 0.5, depthMm + frameWidth * 2]}
        />
        <meshStandardMaterial color="#1a1a1a" />
      </mesh>
      {/* Right */}
      <mesh position={[widthMm / 2 + frameWidth / 2, 0, 0]}>
        <boxGeometry
          args={[frameWidth, BASE_THICKNESS_MM + 0.5, depthMm + frameWidth * 2]}
        />
        <meshStandardMaterial color="#1a1a1a" />
      </mesh>
    </group>
  );
}

/**
 * A wooden table surface and legs for the room mockup.
 * The table top is at y=0 in scene units, model sits on top.
 */
function Table() {
  const tableW = 500;
  const tableD = 350;
  const tableThick = 8;
  const legH = 160;
  const legW = 12;
  const woodColor = "#8B6914";
  const legInset = 30;

  return (
    <group position={[0, -(tableThick / 2), 0]}>
      {/* Table top */}
      <mesh position={[0, 0, 0]} receiveShadow>
        <boxGeometry args={[tableW, tableThick, tableD]} />
        <meshStandardMaterial color={woodColor} roughness={0.7} />
      </mesh>
      {/* Four legs */}
      {[
        [-(tableW / 2 - legInset), 0, -(tableD / 2 - legInset)],
        [(tableW / 2 - legInset), 0, -(tableD / 2 - legInset)],
        [-(tableW / 2 - legInset), 0, (tableD / 2 - legInset)],
        [(tableW / 2 - legInset), 0, (tableD / 2 - legInset)],
      ].map(([x, , z], i) => (
        <mesh key={i} position={[x, -(tableThick / 2 + legH / 2), z]}>
          <boxGeometry args={[legW, legH, legW]} />
          <meshStandardMaterial color={woodColor} roughness={0.7} />
        </mesh>
      ))}
    </group>
  );
}

/**
 * Simple room backdrop: floor and back wall.
 */
function Room() {
  return (
    <group>
      {/* Floor */}
      <mesh
        rotation={[-Math.PI / 2, 0, 0]}
        position={[0, -172, 0]}
        receiveShadow
      >
        <planeGeometry args={[1200, 1200]} />
        <meshStandardMaterial color="#e8e0d4" roughness={0.9} />
      </mesh>
      {/* Back wall */}
      <mesh position={[0, 200, -350]} receiveShadow>
        <planeGeometry args={[1200, 800]} />
        <meshStandardMaterial color="#f5f0eb" roughness={0.95} />
      </mesh>
    </group>
  );
}

// ---- Main preview component ----

interface Props {
  sceneData: SceneData | null;
  loading: boolean;
  error: string | null;
}

export default function ModelPreview({ sceneData, loading, error }: Props) {
  if (loading) {
    return (
      <div style={overlayStyle}>
        <span style={{ fontSize: 18 }}>Loading OSM data…</span>
      </div>
    );
  }

  if (!sceneData) {
    return (
      <div style={overlayStyle}>
        <span style={{ color: "#888", fontSize: 14 }}>
          Select an area on the map to preview the 3D model.
        </span>
      </div>
    );
  }

  return (
    <div style={{ width: "100%", height: "100%", position: "relative" }}>
      <Canvas
        camera={{
          position: [220, 200, 320],
          fov: 30,
          near: 1,
          far: 5000,
        }}
        shadows
        style={{ background: "linear-gradient(180deg, #d4cfc7 0%, #e8e0d4 100%)" }}
      >
        <ambientLight intensity={0.5} />
        <directionalLight
          position={[200, 400, 200]}
          intensity={0.9}
          castShadow
          shadow-mapSize-width={1024}
          shadow-mapSize-height={1024}
        />
        <directionalLight position={[-100, 200, -150]} intensity={0.25} />

        {/* Room environment */}
        <Room />
        <Table />

        {/* City model sitting on the table */}
        <group position={[0, BASE_THICKNESS_MM / 2 + 4, 0]}>
          <BasePlate
            widthMm={sceneData.modelWidthMm}
            depthMm={sceneData.modelDepthMm}
          />

          {sceneData.buildings.map((b, i) => (
            <Building key={`b-${i}`} polygon={b.polygon} heightMm={b.heightMm} />
          ))}

          {sceneData.water.map((w, i) => (
            <Water key={`w-${i}`} polygon={w.polygon} />
          ))}
        </group>
      </Canvas>

      {/* Info badge */}
      <div
        style={{
          position: "absolute",
          bottom: 12,
          left: 12,
          background: "rgba(0,0,0,0.6)",
          color: "#fff",
          padding: "6px 12px",
          borderRadius: 4,
          fontSize: 12,
        }}
      >
        200 mm print &middot;{" "}
        {sceneData.buildings.length} buildings &middot;{" "}
        {sceneData.water.length} water bodies
      </div>

      {error && (
        <div
          style={{
            position: "absolute",
            top: 12,
            left: 12,
            background: "rgba(239,68,68,0.85)",
            color: "#fff",
            padding: "6px 12px",
            borderRadius: 4,
            fontSize: 12,
          }}
        >
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
  background: "#f5f5f5",
  color: "#333",
};
