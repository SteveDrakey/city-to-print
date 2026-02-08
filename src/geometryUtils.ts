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
 * Convert an array of [lat, lon] pairs (an OSM way/polygon) to
 * model-space mm coordinates centred on the selection.
 */
export function projectPolygon(
  coords: [number, number][],
  bounds: Bounds,
  scaleMMperM: number
): Polygon {
  return coords.map(([lat, lon]) => {
    const [xm, ym] = latLonToLocalMetres(lat, lon, bounds);
    return [xm * scaleMMperM, ym * scaleMMperM] as Point2D;
  });
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
