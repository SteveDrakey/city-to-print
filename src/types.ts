/** Geographic bounding box: [south, west, north, east] */
export type Bounds = [number, number, number, number];

/** A 2D point in local model coordinates (millimetres) */
export type Point2D = [number, number];

/** A polygon is an array of 2D points (closed ring) */
export type Polygon = Point2D[];

export interface BuildingData {
  polygon: Polygon;
  /** Height in model-space millimetres */
  heightMm: number;
}

export interface WaterData {
  polygon: Polygon;
}

export interface SceneData {
  buildings: BuildingData[];
  water: WaterData[];
  /** Width of the model in mm (≤200) */
  modelWidthMm: number;
  /** Depth of the model in mm (≤200) */
  modelDepthMm: number;
}
