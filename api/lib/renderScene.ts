import * as THREE from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import type { SceneData } from "../../src/types";
import { BASE_THICKNESS_MM } from "../../src/geometryUtils";
import createGL from "gl";
import jpeg from "jpeg-js";

// ---- Camera angle presets (matching client-side ANGLES + hero) ----

export const RENDER_JOBS: {
  label: string;
  position: [number, number, number];
  target: [number, number, number];
}[] = [
  { label: "Hero", position: [250, 180, 300], target: [0, 20, 0] },
  { label: "Front view", position: [0, 120, 380], target: [0, 20, 0] },
  { label: "Three-quarter view", position: [250, 180, 300], target: [0, 20, 0] },
  { label: "Side view", position: [380, 100, 0], target: [0, 20, 0] },
  { label: "Top-down view", position: [0, 400, 40], target: [0, 0, 0] },
];

// ---- Geometry helpers ----

function polygonToShape(poly: [number, number][]): THREE.Shape {
  const shape = new THREE.Shape();
  for (let i = 0; i < poly.length; i++) {
    const [x, y] = poly[i];
    if (i === 0) shape.moveTo(x, y);
    else shape.lineTo(x, y);
  }
  shape.closePath();
  return shape;
}

// ---- Scene builders ----

function buildMergedBuildings(
  buildings: SceneData["buildings"]
): THREE.Mesh | null {
  if (buildings.length === 0) return null;
  const geos: THREE.ExtrudeGeometry[] = [];
  for (const b of buildings) {
    const shape = polygonToShape(b.polygon);
    geos.push(
      new THREE.ExtrudeGeometry(shape, { depth: b.heightMm, bevelEnabled: false })
    );
  }
  const merged = mergeGeometries(geos, false);
  for (const g of geos) g.dispose();
  if (!merged) return null;

  const mesh = new THREE.Mesh(
    merged,
    new THREE.MeshStandardMaterial({
      color: 0xb0b0b0,
      roughness: 0.65,
      metalness: 0.05,
    })
  );
  mesh.rotation.x = -Math.PI / 2;
  mesh.position.y = BASE_THICKNESS_MM / 2;
  mesh.castShadow = true;
  return mesh;
}

function buildMergedRoads(roads: SceneData["roads"]): THREE.Mesh | null {
  if (roads.length === 0) return null;
  const geos: THREE.ExtrudeGeometry[] = [];
  for (const r of roads) {
    const depth = r.kind === "major" ? 0.35 : r.kind === "minor" ? 0.25 : 0.15;
    const shape = polygonToShape(r.polygon);
    geos.push(new THREE.ExtrudeGeometry(shape, { depth, bevelEnabled: false }));
  }
  const merged = mergeGeometries(geos, false);
  for (const g of geos) g.dispose();
  if (!merged) return null;

  const mesh = new THREE.Mesh(
    merged,
    new THREE.MeshStandardMaterial({ color: 0x6b7280, roughness: 0.85, metalness: 0 })
  );
  mesh.rotation.x = -Math.PI / 2;
  mesh.position.y = BASE_THICKNESS_MM / 2 - 0.1;
  return mesh;
}

function buildMergedWater(water: SceneData["water"]): THREE.Mesh | null {
  if (water.length === 0) return null;
  const geos: THREE.ExtrudeGeometry[] = [];
  for (const w of water) {
    const shape = polygonToShape(w.polygon);
    geos.push(new THREE.ExtrudeGeometry(shape, { depth: 0.5, bevelEnabled: false }));
  }
  const merged = mergeGeometries(geos, false);
  for (const g of geos) g.dispose();
  if (!merged) return null;

  const mesh = new THREE.Mesh(
    merged,
    new THREE.MeshStandardMaterial({
      color: 0x60a5fa,
      roughness: 0.2,
      metalness: 0.1,
    })
  );
  mesh.rotation.x = -Math.PI / 2;
  mesh.position.y = BASE_THICKNESS_MM / 2 - 0.3;
  return mesh;
}

function buildBasePlate(widthMm: number, depthMm: number): THREE.Group {
  const group = new THREE.Group();
  const frameWidth = 3;
  const frameHeight = BASE_THICKNESS_MM + 1.5;

  // Main base
  const baseMat = new THREE.MeshStandardMaterial({
    color: 0xe5e5e5,
    roughness: 0.4,
    metalness: 0,
  });
  const base = new THREE.Mesh(
    new THREE.BoxGeometry(widthMm, BASE_THICKNESS_MM, depthMm),
    baseMat
  );
  base.receiveShadow = true;
  base.castShadow = true;
  group.add(base);

  // Frame sides
  const frameMat = new THREE.MeshStandardMaterial({
    color: 0x1a1a1a,
    roughness: 0.3,
    metalness: 0.1,
  });
  const sides = [
    {
      pos: [0, 0, depthMm / 2 + frameWidth / 2],
      size: [widthMm + frameWidth * 2, frameHeight, frameWidth],
    },
    {
      pos: [0, 0, -(depthMm / 2 + frameWidth / 2)],
      size: [widthMm + frameWidth * 2, frameHeight, frameWidth],
    },
    {
      pos: [-(widthMm / 2 + frameWidth / 2), 0, 0],
      size: [frameWidth, frameHeight, depthMm + frameWidth * 2],
    },
    {
      pos: [widthMm / 2 + frameWidth / 2, 0, 0],
      size: [frameWidth, frameHeight, depthMm + frameWidth * 2],
    },
  ];

  for (const side of sides) {
    const mesh = new THREE.Mesh(
      new THREE.BoxGeometry(side.size[0], side.size[1], side.size[2]),
      frameMat
    );
    mesh.position.set(side.pos[0], side.pos[1], side.pos[2]);
    mesh.castShadow = true;
    group.add(mesh);
  }

  return group;
}

function buildTable(): THREE.Group {
  const group = new THREE.Group();
  const tableW = 480;
  const tableD = 340;
  const tableThick = 10;
  const legH = 155;
  const legTopW = 14;
  const legBottomW = 8;
  const woodColor = 0x5c3d1e;
  const legInset = 35;

  const woodMat = new THREE.MeshStandardMaterial({
    color: woodColor,
    roughness: 0.55,
    metalness: 0.02,
  });

  // Tabletop
  const top = new THREE.Mesh(
    new THREE.BoxGeometry(tableW, tableThick, tableD),
    woodMat
  );
  top.receiveShadow = true;
  top.castShadow = true;
  group.add(top);

  // Edge strip
  const edgeMat = new THREE.MeshStandardMaterial({
    color: 0x4a3118,
    roughness: 0.6,
  });
  const edge = new THREE.Mesh(
    new THREE.BoxGeometry(tableW - 4, 1, tableD - 4),
    edgeMat
  );
  edge.position.y = -(tableThick / 2 + 0.5);
  group.add(edge);

  // Leg geometry (tapered shape)
  const legShape = new THREE.Shape();
  const hw = legTopW / 2;
  const hb = legBottomW / 2;
  legShape.moveTo(-hw, 0);
  legShape.lineTo(hw, 0);
  legShape.lineTo(hb, -legH);
  legShape.lineTo(-hb, -legH);
  legShape.closePath();

  const legGeo = new THREE.ExtrudeGeometry(legShape, {
    depth: legTopW,
    bevelEnabled: true,
    bevelThickness: 1,
    bevelSize: 1,
    bevelSegments: 2,
  });

  const legPositions = [
    { x: -(tableW / 2 - legInset), z: -(tableD / 2 - legInset) },
    { x: tableW / 2 - legInset, z: -(tableD / 2 - legInset) },
    { x: -(tableW / 2 - legInset), z: tableD / 2 - legInset },
    { x: tableW / 2 - legInset, z: tableD / 2 - legInset },
  ];

  for (const pos of legPositions) {
    const leg = new THREE.Mesh(legGeo, woodMat);
    leg.position.set(pos.x, -(tableThick / 2), pos.z - legTopW / 2);
    group.add(leg);
  }

  group.position.y = -(tableThick / 2);
  return group;
}

function buildPlantPot(): THREE.Group {
  const group = new THREE.Group();
  group.position.set(160, 0, -90);

  // Pot
  const pot = new THREE.Mesh(
    new THREE.CylinderGeometry(14, 11, 24, 16),
    new THREE.MeshStandardMaterial({ color: 0xc4956a, roughness: 0.8 })
  );
  pot.position.y = 12;
  pot.castShadow = true;
  group.add(pot);

  // Dirt
  const dirt = new THREE.Mesh(
    new THREE.CylinderGeometry(13, 13, 1, 16),
    new THREE.MeshStandardMaterial({ color: 0x3d2b1f, roughness: 0.95 })
  );
  dirt.position.y = 24.5;
  group.add(dirt);

  // Leaves (fixed sizes for deterministic rendering)
  const leafPositions = [
    { pos: [0, 42, 0], r: 10 },
    { pos: [-8, 36, 5], r: 9 },
    { pos: [6, 38, -4], r: 9.5 },
    { pos: [3, 45, 6], r: 10.5 },
    { pos: [-5, 44, -3], r: 8.5 },
  ];
  const leafMat = new THREE.MeshStandardMaterial({
    color: 0x4a7c59,
    roughness: 0.8,
  });

  for (const l of leafPositions) {
    const leaf = new THREE.Mesh(
      new THREE.SphereGeometry(l.r, 8, 8),
      leafMat
    );
    leaf.position.set(l.pos[0], l.pos[1], l.pos[2]);
    leaf.castShadow = true;
    group.add(leaf);
  }

  return group;
}

function buildBooks(): THREE.Group {
  const group = new THREE.Group();
  group.position.set(-170, 0, -60);
  group.rotation.y = 0.15;

  const books = [
    { w: 50, h: 6, d: 35, color: 0x2c3e50, y: 3 },
    { w: 48, h: 5, d: 33, color: 0x8b4513, y: 8.5 },
    { w: 46, h: 7, d: 32, color: 0x1a3a4a, y: 14.5 },
  ];

  for (const b of books) {
    const mesh = new THREE.Mesh(
      new THREE.BoxGeometry(b.w, b.h, b.d),
      new THREE.MeshStandardMaterial({ color: b.color, roughness: 0.7 })
    );
    mesh.position.y = b.y;
    mesh.castShadow = true;
    group.add(mesh);
  }

  return group;
}

function buildRoom(): THREE.Group {
  const group = new THREE.Group();

  // Floor
  const floor = new THREE.Mesh(
    new THREE.PlaneGeometry(1500, 1500),
    new THREE.MeshStandardMaterial({
      color: 0xc4a676,
      roughness: 0.7,
      metalness: 0.01,
    })
  );
  floor.rotation.x = -Math.PI / 2;
  floor.position.y = -170;
  floor.receiveShadow = true;
  group.add(floor);

  // Back wall
  const backWall = new THREE.Mesh(
    new THREE.PlaneGeometry(1500, 900),
    new THREE.MeshStandardMaterial({ color: 0xf0ebe3, roughness: 0.95 })
  );
  backWall.position.set(0, 230, -420);
  backWall.receiveShadow = true;
  group.add(backWall);

  // Left wall
  const leftWall = new THREE.Mesh(
    new THREE.PlaneGeometry(1200, 900),
    new THREE.MeshStandardMaterial({ color: 0xede8e0, roughness: 0.95 })
  );
  leftWall.position.set(-500, 230, 0);
  leftWall.rotation.y = Math.PI / 2;
  leftWall.receiveShadow = true;
  group.add(leftWall);

  // Baseboard - back
  const bbBack = new THREE.Mesh(
    new THREE.BoxGeometry(1500, 30, 4),
    new THREE.MeshStandardMaterial({ color: 0xf5f2ed, roughness: 0.6 })
  );
  bbBack.position.set(0, -155, -418);
  group.add(bbBack);

  // Baseboard - left
  const bbLeft = new THREE.Mesh(
    new THREE.BoxGeometry(1200, 30, 4),
    new THREE.MeshStandardMaterial({ color: 0xf5f2ed, roughness: 0.6 })
  );
  bbLeft.position.set(-498, -155, 0);
  bbLeft.rotation.y = Math.PI / 2;
  group.add(bbLeft);

  return group;
}

function addLighting(scene: THREE.Scene): void {
  // Ambient
  scene.add(new THREE.AmbientLight(0xfff5e6, 0.35));

  // Main directional (with shadows)
  const mainLight = new THREE.DirectionalLight(0xfff8ee, 1.0);
  mainLight.position.set(300, 500, 250);
  mainLight.castShadow = true;
  mainLight.shadow.mapSize.width = 2048;
  mainLight.shadow.mapSize.height = 2048;
  mainLight.shadow.camera.left = -400;
  mainLight.shadow.camera.right = 400;
  mainLight.shadow.camera.top = 400;
  mainLight.shadow.camera.bottom = -400;
  mainLight.shadow.camera.near = 1;
  mainLight.shadow.camera.far = 1500;
  mainLight.shadow.bias = -0.0005;
  scene.add(mainLight);

  // Fill lights
  const fill1 = new THREE.DirectionalLight(0xe0e8ff, 0.3);
  fill1.position.set(-250, 300, 100);
  scene.add(fill1);

  const fill2 = new THREE.DirectionalLight(0xffe8d0, 0.2);
  fill2.position.set(-100, 200, -300);
  scene.add(fill2);

  // Top point
  const point = new THREE.PointLight(0xffffff, 0.15);
  point.position.set(0, 400, 0);
  scene.add(point);
}

// ---- Main scene builder ----

function buildScene(sceneData: SceneData): THREE.Scene {
  const scene = new THREE.Scene();

  addLighting(scene);
  scene.add(buildRoom());
  scene.add(buildTable());
  scene.add(buildPlantPot());
  scene.add(buildBooks());

  // City model group (same positioning as client)
  const cityGroup = new THREE.Group();
  cityGroup.position.set(0, BASE_THICKNESS_MM / 2 + 4, 10);

  cityGroup.add(buildBasePlate(sceneData.modelWidthMm, sceneData.modelDepthMm));

  const roads = buildMergedRoads(sceneData.roads);
  if (roads) cityGroup.add(roads);

  const buildings = buildMergedBuildings(sceneData.buildings);
  if (buildings) cityGroup.add(buildings);

  const water = buildMergedWater(sceneData.water);
  if (water) cityGroup.add(water);

  scene.add(cityGroup);
  return scene;
}

// ---- Pixel readback and JPEG encoding ----

function readPixelsFlipped(
  glCtx: WebGLRenderingContext,
  width: number,
  height: number
): Uint8Array {
  const pixels = new Uint8Array(width * height * 4);
  glCtx.readPixels(0, 0, width, height, glCtx.RGBA, glCtx.UNSIGNED_BYTE, pixels);

  // OpenGL has (0,0) at bottom-left; flip vertically for image convention
  const rowSize = width * 4;
  const temp = new Uint8Array(rowSize);
  for (let y = 0; y < Math.floor(height / 2); y++) {
    const topOffset = y * rowSize;
    const bottomOffset = (height - 1 - y) * rowSize;
    temp.set(pixels.subarray(topOffset, topOffset + rowSize));
    pixels.copyWithin(topOffset, bottomOffset, bottomOffset + rowSize);
    pixels.set(temp, bottomOffset);
  }

  return pixels;
}

function encodeJpeg(
  pixels: Uint8Array,
  width: number,
  height: number,
  quality: number = 85
): Buffer {
  const frameData = {
    data: pixels,
    width,
    height,
  };
  const encoded = jpeg.encode(frameData, quality);
  return encoded.data;
}

// ---- Public API ----

export interface RenderedImage {
  label: string;
  /** Base64-encoded JPEG */
  data: string;
}

/**
 * Render the city scene from multiple camera angles using headless GL.
 * Returns base64-encoded JPEG images for each angle.
 */
export function renderPreviewImages(
  sceneData: SceneData,
  width = 800,
  height = 600
): RenderedImage[] {
  // Create headless GL context
  const glCtx = createGL(width, height, { preserveDrawingBuffer: true });
  if (!glCtx) {
    throw new Error("Failed to create headless GL context");
  }

  // Minimal mock canvas for Three.js (it needs width/height and event stubs)
  const mockCanvas = {
    width,
    height,
    style: { width: "", height: "" } as Record<string, string>,
    addEventListener() {},
    removeEventListener() {},
    getContext() {
      return glCtx;
    },
  };

  // Create Three.js renderer
  const renderer = new THREE.WebGLRenderer({
    canvas: mockCanvas as unknown as HTMLCanvasElement,
    context: glCtx as unknown as WebGLRenderingContext,
    antialias: true,
  });
  renderer.setSize(width, height);
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.1;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;

  // Set clear color to match the gradient background (middle tone)
  renderer.setClearColor(0xd9d0c3, 1);

  // Build the scene once
  const scene = buildScene(sceneData);

  // Camera
  const camera = new THREE.PerspectiveCamera(28, width / height, 1, 5000);

  const images: RenderedImage[] = [];

  for (const job of RENDER_JOBS) {
    camera.position.set(...job.position);
    camera.lookAt(new THREE.Vector3(...job.target));
    camera.updateProjectionMatrix();

    // Render multiple times to let shadows settle (matches client behaviour)
    renderer.render(scene, camera);
    renderer.render(scene, camera);
    renderer.render(scene, camera);

    const pixels = readPixelsFlipped(
      glCtx as unknown as WebGLRenderingContext,
      width,
      height
    );
    const jpegBuf = encodeJpeg(pixels, width, height);
    images.push({
      label: job.label,
      data: jpegBuf.toString("base64"),
    });
  }

  // Dispose everything
  scene.traverse((obj) => {
    if (obj instanceof THREE.Mesh) {
      obj.geometry?.dispose();
      if (Array.isArray(obj.material)) {
        obj.material.forEach((m) => m.dispose());
      } else {
        obj.material?.dispose();
      }
    }
  });
  renderer.dispose();

  // Destroy GL context
  const ext = glCtx.getExtension("STACKGL_destroy_context");
  if (ext) ext.destroy();

  return images;
}
