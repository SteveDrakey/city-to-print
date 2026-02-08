import type { Bounds, Point2D, Polygon, RoadData } from "./types";

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

/**
 * Classify an OSM highway tag into a road kind for width/styling.
 */
export function classifyRoad(
  highway: string
): RoadData["kind"] {
  switch (highway) {
    case "motorway":
    case "trunk":
    case "primary":
    case "secondary":
    case "motorway_link":
    case "trunk_link":
    case "primary_link":
    case "secondary_link":
      return "major";
    case "tertiary":
    case "residential":
    case "unclassified":
    case "living_street":
    case "service":
    case "tertiary_link":
      return "minor";
    default:
      return "path";
  }
}

/**
 * Get road half-width in real-world metres based on classification.
 */
function roadHalfWidthMetres(kind: RoadData["kind"]): number {
  switch (kind) {
    case "major":
      return 6;
    case "minor":
      return 3;
    case "path":
      return 1.5;
  }
}

/**
 * Buffer a line (array of 2D points in model mm) into a polygon strip.
 * Each segment gets a perpendicular offset to create the road width.
 */
export function bufferLineToPolygon(
  line: Point2D[],
  halfWidthMm: number
): Polygon {
  if (line.length < 2) return [];

  const left: Point2D[] = [];
  const right: Point2D[] = [];

  for (let i = 0; i < line.length; i++) {
    let nx: number, ny: number;

    if (i === 0) {
      // First point: use direction to next point
      const dx = line[1][0] - line[0][0];
      const dy = line[1][1] - line[0][1];
      const len = Math.sqrt(dx * dx + dy * dy) || 1;
      nx = -dy / len;
      ny = dx / len;
    } else if (i === line.length - 1) {
      // Last point: use direction from previous point
      const dx = line[i][0] - line[i - 1][0];
      const dy = line[i][1] - line[i - 1][1];
      const len = Math.sqrt(dx * dx + dy * dy) || 1;
      nx = -dy / len;
      ny = dx / len;
    } else {
      // Middle point: average of the two adjacent segment normals
      const dx1 = line[i][0] - line[i - 1][0];
      const dy1 = line[i][1] - line[i - 1][1];
      const len1 = Math.sqrt(dx1 * dx1 + dy1 * dy1) || 1;
      const nx1 = -dy1 / len1;
      const ny1 = dx1 / len1;

      const dx2 = line[i + 1][0] - line[i][0];
      const dy2 = line[i + 1][1] - line[i][1];
      const len2 = Math.sqrt(dx2 * dx2 + dy2 * dy2) || 1;
      const nx2 = -dy2 / len2;
      const ny2 = dx2 / len2;

      nx = (nx1 + nx2) / 2;
      ny = (ny1 + ny2) / 2;
      const nlen = Math.sqrt(nx * nx + ny * ny) || 1;
      nx /= nlen;
      ny /= nlen;
    }

    left.push([line[i][0] + nx * halfWidthMm, line[i][1] + ny * halfWidthMm]);
    right.push([line[i][0] - nx * halfWidthMm, line[i][1] - ny * halfWidthMm]);
  }

  // Form a closed polygon: left side forward, right side reversed
  return [...left, ...right.reverse()];
}

/**
 * Compute the centroid (average of vertices) of a polygon.
 */
export function polygonCentroid(poly: Polygon): Point2D {
  let cx = 0;
  let cy = 0;
  for (const [x, y] of poly) {
    cx += x;
    cy += y;
  }
  return [cx / poly.length, cy / poly.length];
}

/**
 * Ray-casting point-in-polygon test.
 * Returns true if the point (px, py) lies inside the polygon.
 */
export function pointInPolygon(px: number, py: number, poly: Polygon): boolean {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const xi = poly[i][0], yi = poly[i][1];
    const xj = poly[j][0], yj = poly[j][1];
    if ((yi > py) !== (yj > py) &&
        px < ((xj - xi) * (py - yi)) / (yj - yi) + xi) {
      inside = !inside;
    }
  }
  return inside;
}

/**
 * Check whether a polygon's centroid falls inside any of the given water polygons.
 */
export function isInsideWater(poly: Polygon, waterPolygons: Polygon[]): boolean {
  const [cx, cy] = polygonCentroid(poly);
  for (const water of waterPolygons) {
    if (pointInPolygon(cx, cy, water)) return true;
  }
  return false;
}

/**
 * Project a road linestring (lat/lon) to model-space and buffer it
 * into a polygon strip, clipped to the base plate.
 */
export function projectRoad(
  coords: [number, number][],
  bounds: Bounds,
  scaleMMperM: number,
  kind: RoadData["kind"],
  modelWidthMm: number,
  modelDepthMm: number
): Polygon {
  // Project line points to model mm
  const line: Point2D[] = coords.map(([lat, lon]) => {
    const [xm, ym] = latLonToLocalMetres(lat, lon, bounds);
    return [xm * scaleMMperM, ym * scaleMMperM] as Point2D;
  });

  const halfWidthMm = roadHalfWidthMetres(kind) * scaleMMperM;
  const poly = bufferLineToPolygon(line, halfWidthMm);
  if (poly.length < 3) return [];

  // Clip to base plate
  const halfW = modelWidthMm / 2;
  const halfD = modelDepthMm / 2;
  return clipPolygon(poly, -halfW, -halfD, halfW, halfD);
}
