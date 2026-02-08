import type { Bounds, Point2D, Polygon } from "./types";

/**
 * Fixed physical footprint of the model in millimetres.
 * The longest axis of the selected area will be scaled to this size,
 * with the other axis scaled proportionally (letterboxed).
 */
export const MODEL_SIZE_MM = 200;

/** Base plate thickness in mm */
export const BASE_THICKNESS_MM = 4;

/** Maximum building height in mm (to keep the model printable) */
const MAX_BUILDING_HEIGHT_MM = 40;

/**
 * Convert a single lat/lon to local metres relative to the centre of
 * the given bounds, using a simple Web Mercator-style approximation.
 *
 * This is accurate enough for city-scale areas (a few km).
 * X = east, Y = north (right-hand screen coords).
 */
export function latLonToLocalMetres(
  lat: number,
  lon: number,
  bounds: Bounds
): [number, number] {
  const [south, west, north, east] = bounds;
  const centLat = (south + north) / 2;
  const centLon = (west + east) / 2;

  // Metres per degree at centre latitude
  const mPerDegLat = 111_320;
  const mPerDegLon = 111_320 * Math.cos((centLat * Math.PI) / 180);

  const x = (lon - centLon) * mPerDegLon;
  const y = (lat - centLat) * mPerDegLat;
  return [x, y];
}

/**
 * Compute the real-world width and height (metres) of the selection,
 * and return the scale factor (mm per metre) that fits the longest
 * axis into MODEL_SIZE_MM.
 */
export function computeScale(bounds: Bounds): {
  scaleMMperM: number;
  realWidthM: number;
  realHeightM: number;
  modelWidthMm: number;
  modelDepthMm: number;
} {
  const [south, west, north, east] = bounds;
  const [w, _h1] = latLonToLocalMetres(south, east, bounds);
  const [_w2, h] = latLonToLocalMetres(north, west, bounds);

  // Width = east-west span, Height = north-south span
  const realWidthM = Math.abs(w) * 2;
  const realHeightM = Math.abs(h) * 2;
  const maxDim = Math.max(realWidthM, realHeightM);
  const scaleMMperM = maxDim > 0 ? MODEL_SIZE_MM / maxDim : 1;

  return {
    scaleMMperM,
    realWidthM,
    realHeightM,
    modelWidthMm: realWidthM * scaleMMperM,
    modelDepthMm: realHeightM * scaleMMperM,
  };
}

/**
 * Sutherland-Hodgman polygon clipping against an axis-aligned rectangle.
 * Clips the polygon to [minX, minY] – [maxX, maxY].
 * Returns the clipped polygon, or an empty array if fully outside.
 */
function clipPolygon(
  poly: Point2D[],
  minX: number,
  minY: number,
  maxX: number,
  maxY: number
): Point2D[] {
  if (poly.length === 0) return [];

  type Edge = (p: Point2D) => { inside: boolean; intersect: (a: Point2D, b: Point2D) => Point2D };

  const edges: Edge[] = [
    // Left edge
    (p) => ({
      inside: p[0] >= minX,
      intersect: (a, b) => {
        const t = (minX - a[0]) / (b[0] - a[0]);
        return [minX, a[1] + t * (b[1] - a[1])] as Point2D;
      },
    }),
    // Right edge
    (p) => ({
      inside: p[0] <= maxX,
      intersect: (a, b) => {
        const t = (maxX - a[0]) / (b[0] - a[0]);
        return [maxX, a[1] + t * (b[1] - a[1])] as Point2D;
      },
    }),
    // Bottom edge
    (p) => ({
      inside: p[1] >= minY,
      intersect: (a, b) => {
        const t = (minY - a[1]) / (b[1] - a[1]);
        return [a[0] + t * (b[0] - a[0]), minY] as Point2D;
      },
    }),
    // Top edge
    (p) => ({
      inside: p[1] <= maxY,
      intersect: (a, b) => {
        const t = (maxY - a[1]) / (b[1] - a[1]);
        return [a[0] + t * (b[0] - a[0]), maxY] as Point2D;
      },
    }),
  ];

  let output = [...poly];

  for (const edge of edges) {
    if (output.length === 0) return [];
    const input = output;
    output = [];

    for (let i = 0; i < input.length; i++) {
      const current = input[i];
      const prev = input[(i + input.length - 1) % input.length];
      const currEdge = edge(current);
      const prevEdge = edge(prev);

      if (currEdge.inside) {
        if (!prevEdge.inside) {
          output.push(currEdge.intersect(prev, current));
        }
        output.push(current);
      } else if (prevEdge.inside) {
        output.push(currEdge.intersect(prev, current));
      }
    }
  }

  return output;
}

/**
 * Convert an array of [lat, lon] pairs (an OSM way/polygon) to
 * model-space mm coordinates centred on the selection, clipped to
 * the model boundary so nothing extends outside the base plate.
 */
export function projectPolygon(
  coords: [number, number][],
  bounds: Bounds,
  scaleMMperM: number,
  modelWidthMm?: number,
  modelDepthMm?: number
): Polygon {
  const projected = coords.map(([lat, lon]) => {
    const [xm, ym] = latLonToLocalMetres(lat, lon, bounds);
    return [xm * scaleMMperM, ym * scaleMMperM] as Point2D;
  });

  // If model dimensions provided, clip to the base plate boundary
  if (modelWidthMm != null && modelDepthMm != null) {
    const halfW = modelWidthMm / 2;
    const halfD = modelDepthMm / 2;
    return clipPolygon(projected, -halfW, -halfD, halfW, halfD);
  }

  return projected;
}

/**
 * Derive building height in real-world metres from OSM tags,
 * then convert to model mm.
 *
 * Priority:
 *   1. height=* tag (already in metres)
 *   2. building:levels=* (≈3m per level)
 *   3. Random default (6-18m)
 */
export function buildingHeightMm(
  tags: Record<string, string>,
  scaleMMperM: number
): number {
  let metres: number;

  if (tags["height"]) {
    metres = parseFloat(tags["height"]);
    if (isNaN(metres)) metres = 10;
  } else if (tags["building:levels"]) {
    const levels = parseInt(tags["building:levels"], 10);
    metres = (isNaN(levels) ? 3 : levels) * 3;
  } else {
    // Deterministic-ish default: 6-18m
    metres = 6 + Math.random() * 12;
  }

  const mm = metres * scaleMMperM;
  // Clamp so buildings don't dwarf the base
  return Math.min(mm, MAX_BUILDING_HEIGHT_MM);
}
