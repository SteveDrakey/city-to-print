import chromium from "@sparticuz/chromium";
import puppeteer from "puppeteer-core";
import type { SceneData } from "../../src/types";

// ---- Camera angle presets (matching client-side ANGLES + hero) ----

const RENDER_JOBS = [
  { label: "Hero", position: [250, 180, 300], target: [0, 20, 0] },
  { label: "Front view", position: [0, 120, 380], target: [0, 20, 0] },
  { label: "Three-quarter view", position: [250, 180, 300], target: [0, 20, 0] },
  { label: "Side view", position: [380, 100, 0], target: [0, 20, 0] },
  { label: "Top-down view", position: [0, 400, 40], target: [0, 0, 0] },
];

export interface RenderedImage {
  label: string;
  /** Base64-encoded JPEG */
  data: string;
}

/**
 * Build a self-contained HTML page that uses Three.js to render
 * the city scene and capture each camera angle as a JPEG data URL.
 * The page signals completion by setting window.__images.
 */
function buildRenderPage(sceneData: SceneData, width: number, height: number): string {
  return `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="margin:0;overflow:hidden;background:#d9d0c3">
<canvas id="c" width="${width}" height="${height}"></canvas>
<script type="importmap">
{
  "imports": {
    "three": "https://cdn.jsdelivr.net/npm/three@0.160.0/build/three.module.js",
    "three/examples/jsm/utils/BufferGeometryUtils.js": "https://cdn.jsdelivr.net/npm/three@0.160.0/examples/jsm/utils/BufferGeometryUtils.js"
  }
}
</script>
<script type="module">
import * as THREE from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";

const BASE_THICKNESS_MM = 4;
const sceneData = ${JSON.stringify(sceneData)};
const jobs = ${JSON.stringify(RENDER_JOBS)};

function polygonToShape(poly) {
  const shape = new THREE.Shape();
  for (let i = 0; i < poly.length; i++) {
    const [x, y] = poly[i];
    if (i === 0) shape.moveTo(x, y);
    else shape.lineTo(x, y);
  }
  shape.closePath();
  return shape;
}

function mergeExtrude(items, getShape, getDepth) {
  if (!items.length) return null;
  const geos = items.map(item =>
    new THREE.ExtrudeGeometry(getShape(item), { depth: getDepth(item), bevelEnabled: false })
  );
  const merged = mergeGeometries(geos, false);
  geos.forEach(g => g.dispose());
  return merged;
}

// Build scene
const scene = new THREE.Scene();

// Lighting
scene.add(new THREE.AmbientLight(0xfff5e6, 0.35));
const mainLight = new THREE.DirectionalLight(0xfff8ee, 1.0);
mainLight.position.set(300, 500, 250);
mainLight.castShadow = true;
mainLight.shadow.mapSize.set(2048, 2048);
mainLight.shadow.camera.left = -400;
mainLight.shadow.camera.right = 400;
mainLight.shadow.camera.top = 400;
mainLight.shadow.camera.bottom = -400;
mainLight.shadow.camera.near = 1;
mainLight.shadow.camera.far = 1500;
mainLight.shadow.bias = -0.0005;
scene.add(mainLight);
scene.add(Object.assign(new THREE.DirectionalLight(0xe0e8ff, 0.3), { position: new THREE.Vector3(-250, 300, 100) }));
scene.add(Object.assign(new THREE.DirectionalLight(0xffe8d0, 0.2), { position: new THREE.Vector3(-100, 200, -300) }));
scene.add(Object.assign(new THREE.PointLight(0xffffff, 0.15), { position: new THREE.Vector3(0, 400, 0) }));

// Room
const floor = new THREE.Mesh(new THREE.PlaneGeometry(1500, 1500), new THREE.MeshStandardMaterial({ color: 0xc4a676, roughness: 0.7, metalness: 0.01 }));
floor.rotation.x = -Math.PI / 2; floor.position.y = -170; floor.receiveShadow = true;
scene.add(floor);
const bw = new THREE.Mesh(new THREE.PlaneGeometry(1500, 900), new THREE.MeshStandardMaterial({ color: 0xf0ebe3, roughness: 0.95 }));
bw.position.set(0, 230, -420); bw.receiveShadow = true; scene.add(bw);
const lw = new THREE.Mesh(new THREE.PlaneGeometry(1200, 900), new THREE.MeshStandardMaterial({ color: 0xede8e0, roughness: 0.95 }));
lw.position.set(-500, 230, 0); lw.rotation.y = Math.PI / 2; lw.receiveShadow = true; scene.add(lw);
const bb1 = new THREE.Mesh(new THREE.BoxGeometry(1500, 30, 4), new THREE.MeshStandardMaterial({ color: 0xf5f2ed, roughness: 0.6 }));
bb1.position.set(0, -155, -418); scene.add(bb1);
const bb2 = new THREE.Mesh(new THREE.BoxGeometry(1200, 30, 4), new THREE.MeshStandardMaterial({ color: 0xf5f2ed, roughness: 0.6 }));
bb2.position.set(-498, -155, 0); bb2.rotation.y = Math.PI / 2; scene.add(bb2);

// Table
const tg = new THREE.Group(); tg.position.y = -5;
const woodMat = new THREE.MeshStandardMaterial({ color: 0x5c3d1e, roughness: 0.55, metalness: 0.02 });
const tt = new THREE.Mesh(new THREE.BoxGeometry(480, 10, 340), woodMat); tt.receiveShadow = true; tt.castShadow = true; tg.add(tt);
const te = new THREE.Mesh(new THREE.BoxGeometry(476, 1, 336), new THREE.MeshStandardMaterial({ color: 0x4a3118, roughness: 0.6 }));
te.position.y = -5.5; tg.add(te);
const ls = new THREE.Shape(); ls.moveTo(-7, 0); ls.lineTo(7, 0); ls.lineTo(4, -155); ls.lineTo(-4, -155); ls.closePath();
const lg = new THREE.ExtrudeGeometry(ls, { depth: 14, bevelEnabled: true, bevelThickness: 1, bevelSize: 1, bevelSegments: 2 });
[{x:-205,z:-135},{x:205,z:-135},{x:-205,z:135},{x:205,z:135}].forEach(p => {
  const l = new THREE.Mesh(lg, woodMat); l.position.set(p.x, -5, p.z - 7); tg.add(l);
});
scene.add(tg);

// Plant pot
const pg = new THREE.Group(); pg.position.set(160, 0, -90);
pg.add(Object.assign(new THREE.Mesh(new THREE.CylinderGeometry(14, 11, 24, 16), new THREE.MeshStandardMaterial({ color: 0xc4956a, roughness: 0.8 })), { position: new THREE.Vector3(0, 12, 0), castShadow: true }));
pg.add(Object.assign(new THREE.Mesh(new THREE.CylinderGeometry(13, 13, 1, 16), new THREE.MeshStandardMaterial({ color: 0x3d2b1f, roughness: 0.95 })), { position: new THREE.Vector3(0, 24.5, 0) }));
const leafMat = new THREE.MeshStandardMaterial({ color: 0x4a7c59, roughness: 0.8 });
[[0,42,0,10],[-8,36,5,9],[6,38,-4,9.5],[3,45,6,10.5],[-5,44,-3,8.5]].forEach(([x,y,z,r]) => {
  pg.add(Object.assign(new THREE.Mesh(new THREE.SphereGeometry(r, 8, 8), leafMat), { position: new THREE.Vector3(x, y, z), castShadow: true }));
});
scene.add(pg);

// Books
const bg = new THREE.Group(); bg.position.set(-170, 0, -60); bg.rotation.y = 0.15;
[[50,6,35,0x2c3e50,3],[48,5,33,0x8b4513,8.5],[46,7,32,0x1a3a4a,14.5]].forEach(([w,h,d,c,y]) => {
  bg.add(Object.assign(new THREE.Mesh(new THREE.BoxGeometry(w, h, d), new THREE.MeshStandardMaterial({ color: c, roughness: 0.7 })), { position: new THREE.Vector3(0, y, 0), castShadow: true }));
});
scene.add(bg);

// City model
const cg = new THREE.Group(); cg.position.set(0, BASE_THICKNESS_MM / 2 + 4, 10);

// Base plate
const baseMat = new THREE.MeshStandardMaterial({ color: 0xe5e5e5, roughness: 0.4, metalness: 0 });
const base = new THREE.Mesh(new THREE.BoxGeometry(sceneData.modelWidthMm, BASE_THICKNESS_MM, sceneData.modelDepthMm), baseMat);
base.receiveShadow = true; base.castShadow = true; cg.add(base);
const frameMat = new THREE.MeshStandardMaterial({ color: 0x1a1a1a, roughness: 0.3, metalness: 0.1 });
const fw = 3, fh = BASE_THICKNESS_MM + 1.5, mw = sceneData.modelWidthMm, md = sceneData.modelDepthMm;
[[0,0,md/2+1.5,mw+6,fh,3],[0,0,-(md/2+1.5),mw+6,fh,3],[-(mw/2+1.5),0,0,3,fh,md+6],[mw/2+1.5,0,0,3,fh,md+6]].forEach(([x,y,z,w,h,d]) => {
  const f = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), frameMat); f.position.set(x, y, z); f.castShadow = true; cg.add(f);
});

// Buildings
const bGeo = mergeExtrude(sceneData.buildings, b => polygonToShape(b.polygon), b => b.heightMm);
if (bGeo) {
  const m = new THREE.Mesh(bGeo, new THREE.MeshStandardMaterial({ color: 0xb0b0b0, roughness: 0.65, metalness: 0.05 }));
  m.rotation.x = -Math.PI / 2; m.position.y = BASE_THICKNESS_MM / 2; m.castShadow = true; cg.add(m);
}

// Roads
const rGeo = mergeExtrude(sceneData.roads, r => polygonToShape(r.polygon), r => r.kind === "major" ? 0.35 : r.kind === "minor" ? 0.25 : 0.15);
if (rGeo) {
  const m = new THREE.Mesh(rGeo, new THREE.MeshStandardMaterial({ color: 0x6b7280, roughness: 0.85, metalness: 0 }));
  m.rotation.x = -Math.PI / 2; m.position.y = BASE_THICKNESS_MM / 2 - 0.1; cg.add(m);
}

// Water
const wGeo = mergeExtrude(sceneData.water, w => polygonToShape(w.polygon), () => 0.5);
if (wGeo) {
  const m = new THREE.Mesh(wGeo, new THREE.MeshStandardMaterial({ color: 0x60a5fa, roughness: 0.2, metalness: 0.1 }));
  m.rotation.x = -Math.PI / 2; m.position.y = BASE_THICKNESS_MM / 2 - 0.3; cg.add(m);
}

scene.add(cg);

// Renderer
const canvas = document.getElementById("c");
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, preserveDrawingBuffer: true });
renderer.setSize(${width}, ${height});
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.1;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.setClearColor(0xd9d0c3, 1);

const camera = new THREE.PerspectiveCamera(28, ${width} / ${height}, 1, 5000);
const images = [];

for (const job of jobs) {
  camera.position.set(...job.position);
  camera.lookAt(new THREE.Vector3(...job.target));
  camera.updateProjectionMatrix();
  // Render 3 frames for shadows to settle
  renderer.render(scene, camera);
  renderer.render(scene, camera);
  renderer.render(scene, camera);
  images.push({
    label: job.label,
    data: canvas.toDataURL("image/jpeg", 0.92),
  });
}

renderer.dispose();
window.__images = images;
</script>
</body>
</html>`;
}

/**
 * Render the city scene from multiple camera angles using headless Chromium.
 * Returns base64-encoded JPEG images for each angle.
 */
export async function renderPreviewImages(
  sceneData: SceneData,
  width = 800,
  height = 600
): Promise<RenderedImage[]> {
  const browser = await puppeteer.launch({
    args: chromium.args,
    defaultViewport: { width, height },
    executablePath: await chromium.executablePath(),
    headless: chromium.headless,
  });

  try {
    const page = await browser.newPage();
    const html = buildRenderPage(sceneData, width, height);
    await page.setContent(html, { waitUntil: "networkidle0" });

    // Wait for the rendering script to finish (sets window.__images)
    await page.waitForFunction("window.__images !== undefined", { timeout: 30000 });

    // Extract the rendered images
    const images = await page.evaluate(() => {
      return (window as unknown as { __images: { label: string; data: string }[] }).__images;
    });

    // Strip the data:image/jpeg;base64, prefix — our client re-adds it
    return images.map((img: { label: string; data: string }) => ({
      label: img.label,
      data: img.data.replace(/^data:image\/jpeg;base64,/, ""),
    }));
  } finally {
    await browser.close();
  }
}
