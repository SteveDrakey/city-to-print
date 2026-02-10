import { useCallback, useRef, useState } from "react";
import type { Bounds, Polygon, SceneData } from "./types";
import {
  buildingHeightMm,
  classifyRoad,
  computeScale,
  projectPolygon,
  projectRoad,
} from "./geometryUtils";

/** Maximum number of retry attempts before falling back to mock data */
const MAX_RETRIES = 10;

/** Base delay in ms — doubles each attempt, capped at 16s */
const BASE_DELAY_MS = 2000;

/** Cap retry delay so it doesn't become absurdly long */
const MAX_DELAY_MS = 16000;

/**
 * Build an Overpass QL query that fetches buildings and water features
 * within the given bounding box.
 *
 * The bbox format Overpass expects is (south, west, north, east).
 * We request ways and relations for both buildings and water bodies.
 */
function overpassQuery(bounds: Bounds): string {
  const [s, w, n, e] = bounds;
  const bbox = `${s},${w},${n},${e}`;
  return `
[out:json][timeout:30];
(
  way["building"](${bbox});
  relation["building"](${bbox});
  way["natural"="water"](${bbox});
  way["landuse"="reservoir"](${bbox});
  relation["natural"="water"](${bbox});
  relation["landuse"="reservoir"](${bbox});
  way["natural"="bay"](${bbox});
  relation["natural"="bay"](${bbox});
  way["natural"="coastline"](${bbox});
  way["highway"]["tunnel"!="yes"]["tunnel"!="building_passage"]["covered"!="yes"](${bbox});
  way["railway"~"^(rail|light_rail|subway|tram|narrow_gauge|monorail)$"]["tunnel"!="yes"](${bbox});
);
out body;
>;
out skel qt;
`.trim();
}

/** Overpass JSON element types we care about */
interface OsmNode {
  type: "node";
  id: number;
  lat: number;
  lon: number;
}

interface OsmWay {
  type: "way";
  id: number;
  nodes: number[];
  tags?: Record<string, string>;
}

interface OsmRelation {
  type: "relation";
  id: number;
  members: { type: string; ref: number; role: string }[];
  tags?: Record<string, string>;
}

type OsmElement = OsmNode | OsmWay | OsmRelation;

/**
 * Resolve a way's node refs into lat/lon coordinate pairs using a
 * pre-built node lookup map.
 */
function resolveWayCoords(
  nodeIds: number[],
  nodeMap: Map<number, [number, number]>
): [number, number][] | null {
  const coords: [number, number][] = [];
  for (const nid of nodeIds) {
    const c = nodeMap.get(nid);
    if (!c) return null; // incomplete way
    coords.push(c);
  }
  return coords;
}

/**
 * Assemble multiple open way segments into closed rings by chaining
 * them via shared endpoint node IDs.
 *
 * In OSM multipolygon relations, the outer boundary of a feature like
 * a river is split across many small ways. Each individual way is open,
 * but they connect end-to-end (sharing node IDs) to form a closed ring.
 * This function reconstructs those rings.
 */
function assembleRings(
  memberWays: OsmWay[],
  nodeMap: Map<number, [number, number]>
): [number, number][][] {
  const rings: [number, number][][] = [];

  // Work with node-ID sequences so matching is exact (not float comparison)
  const remaining = memberWays.map((w) => [...w.nodes]);

  while (remaining.length > 0) {
    let chain = remaining.shift()!;
    let changed = true;

    // Keep extending the chain until it closes or we run out of matches
    while (changed && chain[0] !== chain[chain.length - 1]) {
      changed = false;
      const tail = chain[chain.length - 1];

      for (let i = 0; i < remaining.length; i++) {
        const seg = remaining[i];
        if (tail === seg[0]) {
          // Append segment forward (skip duplicate junction node)
          chain = chain.concat(seg.slice(1));
          remaining.splice(i, 1);
          changed = true;
          break;
        } else if (tail === seg[seg.length - 1]) {
          // Append segment reversed
          chain = chain.concat(seg.slice().reverse().slice(1));
          remaining.splice(i, 1);
          changed = true;
          break;
        }
      }
    }

    // Resolve node IDs to coordinates
    const coords: [number, number][] = [];
    let valid = true;
    for (const nid of chain) {
      const c = nodeMap.get(nid);
      if (!c) {
        valid = false;
        break;
      }
      coords.push(c);
    }

    if (valid && coords.length >= 3) {
      rings.push(coords);
    }
  }

  return rings;
}

/**
 * Clip a lat/lon line segment against the bounding box, returning
 * the intersection point where the segment exits/enters the box.
 */
function segmentBoxIntersection(
  ax: number, ay: number, bx: number, by: number,
  minX: number, minY: number, maxX: number, maxY: number
): [number, number] | null {
  // Check all four edges and return the closest intersection to point a
  const edges: { t: number; pt: [number, number] }[] = [];

  // Left edge (x = minX)
  if (bx !== ax) {
    const t = (minX - ax) / (bx - ax);
    if (t >= 0 && t <= 1) {
      const iy = ay + t * (by - ay);
      if (iy >= minY && iy <= maxY) edges.push({ t, pt: [minX, iy] });
    }
  }
  // Right edge (x = maxX)
  if (bx !== ax) {
    const t = (maxX - ax) / (bx - ax);
    if (t >= 0 && t <= 1) {
      const iy = ay + t * (by - ay);
      if (iy >= minY && iy <= maxY) edges.push({ t, pt: [maxX, iy] });
    }
  }
  // Bottom edge (y = minY)
  if (by !== ay) {
    const t = (minY - ay) / (by - ay);
    if (t >= 0 && t <= 1) {
      const ix = ax + t * (bx - ax);
      if (ix >= minX && ix <= maxX) edges.push({ t, pt: [ix, minY] });
    }
  }
  // Top edge (y = maxY)
  if (by !== ay) {
    const t = (maxY - ay) / (by - ay);
    if (t >= 0 && t <= 1) {
      const ix = ax + t * (bx - ax);
      if (ix >= minX && ix <= maxX) edges.push({ t, pt: [ix, maxY] });
    }
  }

  if (edges.length === 0) return null;
  edges.sort((a, b) => a.t - b.t);
  return edges[0].pt;
}

/**
 * Returns the angle (0-4 scale, one per side) of a point on the bounding box
 * perimeter, going clockwise from the top-left corner.
 * This is used to walk the box boundary clockwise when closing coastline gaps.
 *
 * Convention for clockwise traversal (geographic coords where Y increases northward):
 *   Top (maxY):    left→right  = 0..1
 *   Right (maxX):  top→bottom  = 1..2
 *   Bottom (minY): right→left  = 2..3
 *   Left (minX):   bottom→top  = 3..4
 */
function boxAngle(
  x: number, y: number,
  minX: number, minY: number, maxX: number, maxY: number
): number {
  const eps = 1e-9;
  const w = maxX - minX;
  const h = maxY - minY;

  // Top edge (y ≈ maxY)
  if (Math.abs(y - maxY) < eps) return (x - minX) / w;
  // Right edge (x ≈ maxX)
  if (Math.abs(x - maxX) < eps) return 1 + (maxY - y) / h;
  // Bottom edge (y ≈ minY)
  if (Math.abs(y - minY) < eps) return 2 + (maxX - x) / w;
  // Left edge (x ≈ minX)
  if (Math.abs(x - minX) < eps) return 3 + (y - minY) / h;

  return 0;
}

/**
 * Generate the clockwise box-corner waypoints between two angles.
 */
function boxCornersBetween(
  startAngle: number, endAngle: number,
  minX: number, minY: number, maxX: number, maxY: number
): [number, number][] {
  const corners: [number, number][] = [
    [maxX, maxY], // angle 1: top-right
    [maxX, minY], // angle 2: bottom-right
    [minX, minY], // angle 3: bottom-left
    [minX, maxY], // angle 4: top-left (= 0 when wrapped)
  ];
  const cornerAngles = [1, 2, 3, 4];

  const result: [number, number][] = [];
  let a = startAngle;
  // Walk clockwise: if end < start, we wrap around
  let target = endAngle <= a ? endAngle + 4 : endAngle;

  for (let i = 0; i < 4; i++) {
    let ca = cornerAngles[i];
    if (ca <= a) ca += 4;
    if (ca > a && ca < target) {
      result.push(corners[i]);
    }
  }
  return result;
}

/**
 * Build sea polygons from coastline ways.
 *
 * OSM coastline convention: land is to the LEFT, sea is to the RIGHT.
 * The coastline ways trace the land-sea boundary. To form sea polygons
 * within the bounding box:
 * 1. Chain coastline segments together
 * 2. Clip them to the bounding box
 * 3. Close each chain by walking clockwise around the box boundary
 *    (since sea is to the right of the coastline direction)
 */
function buildSeaPolygons(
  coastlineWays: OsmWay[],
  nodeMap: Map<number, [number, number]>,
  bounds: Bounds
): [number, number][][] {
  if (coastlineWays.length === 0) return [];

  const [south, west, north, east] = bounds;

  // 1. Chain coastline segments by matching endpoints.
  //    IMPORTANT: Only join in the forward direction (tail→head or
  //    their-tail→our-head). Never reverse a segment — coastline
  //    direction encodes which side is land vs sea.
  const remaining = coastlineWays.map((w) => [...w.nodes]);
  const chains: number[][] = [];

  while (remaining.length > 0) {
    let chain = remaining.shift()!;
    let changed = true;

    while (changed) {
      changed = false;
      const head = chain[0];
      const tail = chain[chain.length - 1];

      for (let i = 0; i < remaining.length; i++) {
        const seg = remaining[i];
        if (tail === seg[0]) {
          // Our tail → their head: append forward
          chain = chain.concat(seg.slice(1));
          remaining.splice(i, 1);
          changed = true;
          break;
        } else if (head === seg[seg.length - 1]) {
          // Their tail → our head: prepend forward
          chain = seg.concat(chain.slice(1));
          remaining.splice(i, 1);
          changed = true;
          break;
        }
      }
    }

    chains.push(chain);
  }

  // 2. Resolve chains to coordinates and clip to bbox
  const seaPolygons: [number, number][][] = [];

  for (const chain of chains) {
    // Resolve node IDs to [lat, lon]
    const coords: [number, number][] = [];
    let valid = true;
    for (const nid of chain) {
      const c = nodeMap.get(nid);
      if (!c) { valid = false; break; }
      coords.push(c);
    }
    if (!valid || coords.length < 2) continue;

    // Check if the chain is already a closed ring
    const isClosed = chain[0] === chain[chain.length - 1];

    if (isClosed) {
      // Closed coastline ring (e.g. an island) — the interior
      // is land, so the sea is the exterior. We skip these for now
      // as they'd need hole-subtraction which is complex.
      // However, if the ring goes clockwise (in lat/lon), the
      // interior is sea (e.g. an enclosed bay).
      // For simplicity, just add it as a water polygon.
      // Check winding: if clockwise in geographic coords, interior is sea
      let area = 0;
      for (let i = 0; i < coords.length - 1; i++) {
        area += (coords[i + 1][1] - coords[i][1]) * (coords[i + 1][0] + coords[i][0]);
      }
      // area > 0 means clockwise in lat/lon = sea inside
      if (area > 0) {
        seaPolygons.push(coords);
      }
      continue;
    }

    // 3. Split the chain into segments that cross the bbox.
    //    A single chain may enter and exit multiple times, producing
    //    multiple independent sea polygons. Each segment has an entry
    //    and exit point on the box boundary.
    type Segment = {
      points: [number, number][];
      entry: [number, number];
      exit: [number, number];
    };
    const segments: Segment[] = [];
    let curPoints: [number, number][] = [];
    let curEntry: [number, number] | null = null;

    for (let i = 0; i < coords.length; i++) {
      const [lat, lon] = coords[i];
      const inside = lat >= south && lat <= north && lon >= west && lon <= east;

      if (i > 0) {
        const [pLat, pLon] = coords[i - 1];
        const pInside = pLat >= south && pLat <= north && pLon >= west && pLon <= east;

        if (!pInside && inside) {
          // Entering the bbox — start a new segment
          const inter = segmentBoxIntersection(
            pLon, pLat, lon, lat, west, south, east, north
          );
          if (inter) {
            curEntry = [inter[1], inter[0]];
            curPoints = [curEntry];
          } else {
            curEntry = [lat, lon];
            curPoints = [];
          }
        } else if (pInside && !inside) {
          // Exiting the bbox — finalize current segment
          const inter = segmentBoxIntersection(
            pLon, pLat, lon, lat, west, south, east, north
          );
          if (inter && curEntry) {
            const exit: [number, number] = [inter[1], inter[0]];
            curPoints.push(exit);
            if (curPoints.length >= 2) {
              segments.push({ points: [...curPoints], entry: curEntry, exit });
            }
          }
          curPoints = [];
          curEntry = null;
        }
      }

      if (inside) {
        curPoints.push([lat, lon]);
      }
    }
    // Note: if the chain ends inside the bbox (no final exit), we
    // discard that trailing segment since we can't close it properly
    // without a boundary exit point.

    // 4. For each segment with entry/exit on the boundary, close
    //    by walking clockwise around the bbox from exit back to entry.
    //    (Sea is to the RIGHT of coastline direction = clockwise.)
    for (const seg of segments) {
      const exitAngle = boxAngle(seg.exit[1], seg.exit[0], west, south, east, north);
      const entryAngle = boxAngle(seg.entry[1], seg.entry[0], west, south, east, north);

      const corners = boxCornersBetween(exitAngle, entryAngle, west, south, east, north);

      const seaPoly: [number, number][] = [...seg.points];
      for (const [lon, lat] of corners) {
        seaPoly.push([lat, lon]);
      }
      seaPoly.push(seg.points[0]);

      if (seaPoly.length >= 3) {
        seaPolygons.push(seaPoly);
      }
    }
  }

  return seaPolygons;
}

/**
 * Generate a small procedural mock dataset when Overpass is
 * unavailable or returns nothing. This lets the 3D preview still
 * show something useful during development or outages.
 */
function mockSceneData(bounds: Bounds, bearing = 0): SceneData {
  const { scaleMMperM, modelWidthMm, modelDepthMm } = computeScale(bounds, bearing);
  const buildings = [];
  const water = [];

  // Create a grid of small buildings
  const cols = 5;
  const rows = 5;
  const bw = modelWidthMm * 0.08;
  const bd = modelDepthMm * 0.08;
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const cx = -modelWidthMm / 2 + ((c + 1) / (cols + 1)) * modelWidthMm;
      const cy = -modelDepthMm / 2 + ((r + 1) / (rows + 1)) * modelDepthMm;
      const h = 2 + Math.random() * 8;
      buildings.push({
        polygon: [
          [cx - bw, cy - bd],
          [cx + bw, cy - bd],
          [cx + bw, cy + bd],
          [cx - bw, cy + bd],
        ] as [number, number][],
        heightMm: h,
      });
    }
  }

  // One water body in the middle
  const ww = modelWidthMm * 0.25;
  const wd = modelDepthMm * 0.12;
  water.push({
    polygon: [
      [-ww, -wd],
      [ww, -wd],
      [ww, wd],
      [-ww, wd],
    ] as [number, number][],
  });

  // Add some mock roads (a cross pattern)
  const roads: SceneData["roads"] = [];
  const roadHalfW = modelWidthMm * 0.015;
  // Horizontal road
  roads.push({
    polygon: [
      [-modelWidthMm / 2, -roadHalfW],
      [modelWidthMm / 2, -roadHalfW],
      [modelWidthMm / 2, roadHalfW],
      [-modelWidthMm / 2, roadHalfW],
    ] as [number, number][],
    kind: "major",
  });
  // Vertical road
  roads.push({
    polygon: [
      [-roadHalfW, -modelDepthMm / 2],
      [roadHalfW, -modelDepthMm / 2],
      [roadHalfW, modelDepthMm / 2],
      [-roadHalfW, modelDepthMm / 2],
    ] as [number, number][],
    kind: "major",
  });
  // Diagonal railway
  const railHalfW = modelWidthMm * 0.008;
  roads.push({
    polygon: [
      [-modelWidthMm / 2, -modelDepthMm / 3 - railHalfW],
      [modelWidthMm / 2, modelDepthMm / 3 - railHalfW],
      [modelWidthMm / 2, modelDepthMm / 3 + railHalfW],
      [-modelWidthMm / 2, -modelDepthMm / 3 + railHalfW],
    ] as [number, number][],
    kind: "railway",
  });

  return { buildings, water, roads, modelWidthMm, modelDepthMm };
}

/**
 * Perform a single Overpass API fetch. Throws on network/HTTP errors.
 */
async function fetchOverpass(query: string): Promise<OsmElement[]> {
  const res = await fetch("https://overpass-api.de/api/interpreter", {
    method: "POST",
    body: `data=${encodeURIComponent(query)}`,
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
  });
  if (!res.ok) throw new Error(`Overpass HTTP ${res.status}`);
  const json = await res.json();
  return json.elements ?? [];
}

/**
 * Parse raw OSM elements into SceneData geometry.
 * Returns null when the response has no usable features.
 */
function parseElements(
  elements: OsmElement[],
  bounds: Bounds,
  bearing = 0
): SceneData | null {
  const nodeMap = new Map<number, [number, number]>();
  const ways = new Map<number, OsmWay>();
  const relations: OsmRelation[] = [];

  for (const el of elements) {
    if (el.type === "node") {
      nodeMap.set(el.id, [el.lat, el.lon]);
    } else if (el.type === "way") {
      ways.set(el.id, el);
    } else if (el.type === "relation") {
      relations.push(el);
    }
  }

  const { scaleMMperM, modelWidthMm, modelDepthMm } = computeScale(bounds, bearing);
  const buildings: SceneData["buildings"] = [];
  const water: SceneData["water"] = [];
  const roads: SceneData["roads"] = [];

  const classify = (tags?: Record<string, string>) => {
    if (!tags) return null;
    if (tags["building"]) return "building";
    if (tags["natural"] === "coastline") return "coastline";
    if (
      tags["natural"] === "water" ||
      tags["natural"] === "bay" ||
      tags["waterway"] ||
      tags["landuse"] === "reservoir"
    )
      return "water";
    if (tags["highway"]) return "road";
    if (tags["railway"]) return "railway";
    return null;
  };

  // Collect coastline ways separately for sea polygon construction
  const coastlineWays: OsmWay[] = [];

  for (const way of ways.values()) {
    const kind = classify(way.tags);
    if (!kind) continue;

    if (kind === "coastline") {
      coastlineWays.push(way);
      continue;
    }

    const coords = resolveWayCoords(way.nodes, nodeMap);
    if (!coords) continue;

    if (kind === "road") {
      if (coords.length < 2) continue;
      const roadKind = classifyRoad(way.tags?.["highway"] ?? "");
      const poly = projectRoad(
        coords,
        bounds,
        scaleMMperM,
        roadKind,
        modelWidthMm,
        modelDepthMm,
        bearing
      );
      if (poly.length < 3) continue;
      roads.push({ polygon: poly, kind: roadKind });
    } else if (kind === "railway") {
      if (coords.length < 2) continue;
      const poly = projectRoad(
        coords,
        bounds,
        scaleMMperM,
        "railway",
        modelWidthMm,
        modelDepthMm,
        bearing
      );
      if (poly.length < 3) continue;
      roads.push({ polygon: poly, kind: "railway" });
    } else {
      if (coords.length < 3) continue;

      if (kind === "water") {
        const isClosed =
          way.nodes.length > 2 &&
          way.nodes[0] === way.nodes[way.nodes.length - 1];
        if (!isClosed) continue;
      }

      const poly = projectPolygon(
        coords,
        bounds,
        scaleMMperM,
        modelWidthMm,
        modelDepthMm,
        bearing
      );
      if (poly.length < 3) continue;

      if (kind === "building") {
        buildings.push({
          polygon: poly,
          heightMm: buildingHeightMm(way.tags ?? {}, scaleMMperM),
        });
      } else {
        water.push({ polygon: poly });
      }
    }
  }

  for (const rel of relations) {
    const kind = classify(rel.tags);
    if (!kind) continue;
    if (kind === "water" && rel.tags?.["type"] === "waterway") continue;

    if (kind === "water") {
      const outerWays: OsmWay[] = [];
      const innerWays: OsmWay[] = [];
      for (const member of rel.members) {
        if (member.type !== "way") continue;
        const way = ways.get(member.ref);
        if (!way) continue;
        if (member.role === "outer") outerWays.push(way);
        else if (member.role === "inner") innerWays.push(way);
      }

      // Assemble inner rings (islands/holes) and project them
      const innerRings = assembleRings(innerWays, nodeMap);
      const projectedHoles: Polygon[] = [];
      for (const ring of innerRings) {
        const holePoly = projectPolygon(
          ring, bounds, scaleMMperM, modelWidthMm, modelDepthMm, bearing
        );
        if (holePoly.length >= 3) projectedHoles.push(holePoly);
      }

      const outerRings = assembleRings(outerWays, nodeMap);
      for (const ring of outerRings) {
        const poly = projectPolygon(
          ring,
          bounds,
          scaleMMperM,
          modelWidthMm,
          modelDepthMm,
          bearing
        );
        if (poly.length < 3) continue;
        water.push({
          polygon: poly,
          holes: projectedHoles.length > 0 ? projectedHoles : undefined,
        });
      }
    } else {
      for (const member of rel.members) {
        if (member.type !== "way" || member.role !== "outer") continue;
        const way = ways.get(member.ref);
        if (!way) continue;

        const coords = resolveWayCoords(way.nodes, nodeMap);
        if (!coords || coords.length < 3) continue;

        const poly = projectPolygon(
          coords,
          bounds,
          scaleMMperM,
          modelWidthMm,
          modelDepthMm,
          bearing
        );
        if (poly.length < 3) continue;

        if (kind === "building") {
          buildings.push({
            polygon: poly,
            heightMm: buildingHeightMm(
              { ...rel.tags, ...way.tags },
              scaleMMperM
            ),
          });
        }
      }
    }
  }

  // Build sea polygons from coastline ways
  const seaPolygons = buildSeaPolygons(coastlineWays, nodeMap, bounds);
  for (const seaCoords of seaPolygons) {
    const poly = projectPolygon(
      seaCoords,
      bounds,
      scaleMMperM,
      modelWidthMm,
      modelDepthMm,
      bearing
    );
    if (poly.length >= 3) {
      water.push({ polygon: poly });
    }
  }

  if (buildings.length === 0 && water.length === 0 && roads.length === 0) {
    return null;
  }
  return { buildings, water, roads, modelWidthMm, modelDepthMm };
}

/**
 * Custom hook that fetches OSM data via Overpass and converts it
 * into model-space SceneData ready for 3D rendering.
 *
 * Includes automatic retry with exponential backoff (2s, 4s, 8s)
 * and exposes retry state so the UI can show progress.
 */
export function useOverpassData() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sceneData, setSceneData] = useState<SceneData | null>(null);
  const [retryAttempt, setRetryAttempt] = useState(0);

  // Allow cancellation when a new fetch is triggered while retrying
  const abortRef = useRef<AbortController | null>(null);

  const fetchData = useCallback(async (bounds: Bounds, bearing = 0) => {
    // Cancel any in-flight retry chain
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    setLoading(true);
    setError(null);
    setSceneData(null);
    setRetryAttempt(0);

    const query = overpassQuery(bounds);

    for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
      if (controller.signal.aborted) return;

      // Wait before retries (not before the first attempt)
      if (attempt > 0) {
        setRetryAttempt(attempt);
        const delay = Math.min(BASE_DELAY_MS * Math.pow(2, attempt - 1), MAX_DELAY_MS);
        await new Promise((r) => setTimeout(r, delay));
        if (controller.signal.aborted) return;
      }

      try {
        const elements = await fetchOverpass(query);
        if (controller.signal.aborted) return;

        const parsed = parseElements(elements, bounds, bearing);
        if (parsed) {
          setSceneData(parsed);
          setLoading(false);
          return;
        }

        // Overpass returned no usable data — treat as soft failure,
        // only retry if we haven't exhausted attempts
        if (attempt === MAX_RETRIES) {
          console.warn(
            "Overpass returned no usable data after retries — using mock dataset"
          );
          setSceneData(mockSceneData(bounds, bearing));
          setLoading(false);
          return;
        }
      } catch (err) {
        if (controller.signal.aborted) return;

        // On last attempt, give up and fall back to mock data
        if (attempt === MAX_RETRIES) {
          console.error(
            `Overpass fetch failed after ${MAX_RETRIES + 1} attempts, using mock data:`,
            err
          );
          setError(
            err instanceof Error ? err.message : "Failed to fetch OSM data"
          );
          setSceneData(mockSceneData(bounds, bearing));
          setLoading(false);
          return;
        }
        // Otherwise loop will retry
      }
    }
  }, []);

  return {
    loading,
    error,
    sceneData,
    fetchData,
    retryAttempt,
    maxRetries: MAX_RETRIES,
  };
}
