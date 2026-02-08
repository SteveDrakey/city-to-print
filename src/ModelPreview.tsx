import { useMemo } from "react";
import { Canvas } from "@react-three/fiber";
import { OrbitControls } from "@react-three/drei";
import * as THREE from "three";
import type { SceneData, Polygon } from "./types";
import { BASE_THICKNESS_MM, MODEL_SIZE_MM } from "./geometryUtils";

// ---- Helpers to turn 2D polygon outlines into three.js geometry ----

/**
 * Create a THREE.Shape from a polygon (array of [x, y] pairs).
 * The shape is used both for extruded buildings and flat water.
 */
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
    // Extrude upward (along Z in shape space → we'll rotate later)
    const geo = new THREE.ExtrudeGeometry(shape, {
      depth: heightMm,
      bevelEnabled: false,
    });
    return geo;
  }, [polygon, heightMm]);

  return (
    <mesh
      geometry={geometry}
      // Place building so its base sits on the base plate surface
      // ExtrudeGeometry extrudes along +Z in shape space.
      // We rotate so Z becomes Y (up in the 3D scene),
      // then shift up by half base thickness so it sits on the plate.
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
    // Slightly recessed below the base plate top surface
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
      // Recess water slightly into the base plate
      position={[0, BASE_THICKNESS_MM / 2 - 0.3, 0]}
    >
      <meshStandardMaterial color="#3b82f6" flatShading />
    </mesh>
  );
}

/**
 * Base plate: a box centred at the origin with a thin black frame
 * around the perimeter.
 */
function BasePlate({
  widthMm,
  depthMm,
}: {
  widthMm: number;
  depthMm: number;
}) {
  const frameWidth = 2; // mm

  return (
    <group>
      {/* Main plate (slightly inset from frame) */}
      <mesh position={[0, 0, 0]}>
        <boxGeometry args={[widthMm, BASE_THICKNESS_MM, depthMm]} />
        <meshStandardMaterial color="#d4d4d4" />
      </mesh>

      {/* Frame — four thin strips around the perimeter */}
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

  /**
   * Camera distance: place camera far enough to see the whole model.
   * We use an isometric-ish perspective from the top-right-front.
   */
  const camDist = MODEL_SIZE_MM * 1.6;

  return (
    <div style={{ width: "100%", height: "100%", position: "relative" }}>
      <Canvas
        camera={{
          position: [camDist * 0.7, camDist * 0.6, camDist * 0.7],
          fov: 35,
          near: 0.1,
          far: camDist * 10,
        }}
        style={{ background: "#f5f5f5" }}
      >
        {/* Neutral lighting for a model display */}
        <ambientLight intensity={0.6} />
        <directionalLight position={[100, 200, 150]} intensity={0.8} />
        <directionalLight position={[-80, 100, -100]} intensity={0.3} />

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

        <OrbitControls
          target={[0, BASE_THICKNESS_MM, 0]}
          enablePan
          enableZoom
          enableRotate
          maxPolarAngle={Math.PI / 2}
        />
      </Canvas>

      {/* Info badge */}
      <div
        style={{
          position: "absolute",
          bottom: 12,
          left: 12,
          background: "rgba(0,0,0,0.7)",
          color: "#fff",
          padding: "6px 12px",
          borderRadius: 4,
          fontSize: 12,
        }}
      >
        Fixed 200 mm footprint &middot;{" "}
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
