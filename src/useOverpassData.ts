import { useCallback, useState } from "react";
import type { Bounds, SceneData } from "./types";
import {
  buildingHeightMm,
  classifyRoad,
  computeScale,
  projectPolygon,
  projectRoad,
} from "./geometryUtils";

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
  way["waterway"](${bbox});
  way["landuse"="reservoir"](${bbox});
  relation["natural"="water"](${bbox});
  relation["waterway"](${bbox});
  relation["landuse"="reservoir"](${bbox});
  way["highway"](${bbox});
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
 * Generate a small procedural mock dataset when Overpass is
 * unavailable or returns nothing. This lets the 3D preview still
 * show something useful during development or outages.
 */
function mockSceneData(bounds: Bounds): SceneData {
  const { scaleMMperM, modelWidthMm, modelDepthMm } = computeScale(bounds);
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

  return { buildings, water, roads, modelWidthMm, modelDepthMm };
}

/**
 * Custom hook that fetches OSM data via Overpass and converts it
 * into model-space SceneData ready for 3D rendering.
 */
export function useOverpassData() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sceneData, setSceneData] = useState<SceneData | null>(null);

  const fetchData = useCallback(async (bounds: Bounds) => {
    setLoading(true);
    setError(null);
    setSceneData(null);

    try {
      const query = overpassQuery(bounds);
      const res = await fetch("https://overpass-api.de/api/interpreter", {
        method: "POST",
        body: `data=${encodeURIComponent(query)}`,
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
      });

      if (!res.ok) throw new Error(`Overpass HTTP ${res.status}`);

      const json = await res.json();
      const elements: OsmElement[] = json.elements ?? [];

      // Build lookup maps
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

      const { scaleMMperM, modelWidthMm, modelDepthMm } =
        computeScale(bounds);
      const buildings: SceneData["buildings"] = [];
      const water: SceneData["water"] = [];
      const roads: SceneData["roads"] = [];

      // Helper: classify an element as building, water, or road based on tags
      const classify = (tags?: Record<string, string>) => {
        if (!tags) return null;
        if (tags["building"]) return "building";
        if (
          tags["natural"] === "water" ||
          tags["waterway"] ||
          tags["landuse"] === "reservoir"
        )
          return "water";
        if (tags["highway"]) return "road";
        return null;
      };

      // Process ways (most buildings/water/roads come as ways)
      for (const way of ways.values()) {
        const kind = classify(way.tags);
        if (!kind) continue;

        const coords = resolveWayCoords(way.nodes, nodeMap);
        if (!coords) continue;

        if (kind === "road") {
          // Roads need at least 2 points (a line) not 3 (a polygon)
          if (coords.length < 2) continue;
          const roadKind = classifyRoad(way.tags?.["highway"] ?? "");
          const poly = projectRoad(coords, bounds, scaleMMperM, roadKind, modelWidthMm, modelDepthMm);
          if (poly.length < 3) continue;
          roads.push({ polygon: poly, kind: roadKind });
        } else {
          if (coords.length < 3) continue;

          // Water ways must be closed rings (first node == last node) to be
          // valid area polygons. Open ways like river/stream centerlines
          // would create huge bogus shapes if treated as filled polygons.
          if (kind === "water") {
            const isClosed =
              way.nodes.length > 2 &&
              way.nodes[0] === way.nodes[way.nodes.length - 1];
            if (!isClosed) continue;
          }

          const poly = projectPolygon(coords, bounds, scaleMMperM, modelWidthMm, modelDepthMm);
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

      // Process relations (multipolygons) — use outer members only
      for (const rel of relations) {
        const kind = classify(rel.tags);
        if (!kind) continue;

        for (const member of rel.members) {
          if (member.type !== "way" || member.role !== "outer") continue;
          const way = ways.get(member.ref);
          if (!way) continue;

          const coords = resolveWayCoords(way.nodes, nodeMap);
          if (!coords || coords.length < 3) continue;

          const poly = projectPolygon(coords, bounds, scaleMMperM, modelWidthMm, modelDepthMm);
          if (poly.length < 3) continue; // clipped away entirely

          if (kind === "building") {
            buildings.push({
              polygon: poly,
              heightMm: buildingHeightMm(
                { ...rel.tags, ...way.tags },
                scaleMMperM
              ),
            });
          } else {
            water.push({ polygon: poly });
          }
        }
      }

      // If Overpass returned nothing useful, fall back to mock data
      if (buildings.length === 0 && water.length === 0 && roads.length === 0) {
        console.warn("Overpass returned no usable data — using mock dataset");
        setSceneData(mockSceneData(bounds));
      } else {
        setSceneData({ buildings, water, roads, modelWidthMm, modelDepthMm });
      }
    } catch (err) {
      console.error("Overpass fetch failed, using mock data:", err);
      setError(
        err instanceof Error ? err.message : "Failed to fetch OSM data"
      );
      setSceneData(mockSceneData(bounds));
    } finally {
      setLoading(false);
    }
  }, []);

  return { loading, error, sceneData, fetchData };
}
