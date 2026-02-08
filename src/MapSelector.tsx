import { useEffect, useRef, useState, useCallback } from "react";
import maplibregl from "maplibre-gl";
import type { Bounds } from "./types";

// MapLibre GL CSS is loaded via a <link> in index.html or imported here.
// We'll inject it via a side-effect import handled by Vite.
import "maplibre-gl/dist/maplibre-gl.css";

interface Props {
  onBoundsSelected: (bounds: Bounds) => void;
  onClear: () => void;
}

/**
 * Interactive map with rectangle selection.
 *
 * Two-click workflow:
 *   1. Click to set first corner
 *   2. Move mouse to see preview rectangle
 *   3. Click to set second corner → selection emitted
 *
 * A "Clear selection" button resets everything.
 */
export default function MapSelector({ onBoundsSelected, onClear }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);

  // Selection state: null → picking first corner → picking second corner
  const [firstCorner, setFirstCorner] = useState<maplibregl.LngLat | null>(
    null
  );
  const [selectedBounds, setSelectedBounds] = useState<Bounds | null>(null);
  const [cursorPos, setCursorPos] = useState<maplibregl.LngLat | null>(null);

  // ---- Initialise map ----
  useEffect(() => {
    if (!containerRef.current) return;

    const map = new maplibregl.Map({
      container: containerRef.current,
      // OpenStreetMap raster tile server (free, no key required)
      style: {
        version: 8,
        sources: {
          osm: {
            type: "raster",
            tiles: ["https://tile.openstreetmap.org/{z}/{x}/{y}.png"],
            tileSize: 256,
            attribution:
              '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
          },
        },
        layers: [
          {
            id: "osm-tiles",
            type: "raster",
            source: "osm",
            minzoom: 0,
            maxzoom: 19,
          },
        ],
      },
      center: [13.405, 52.52], // Berlin default
      zoom: 13,
    });

    map.addControl(new maplibregl.NavigationControl(), "top-right");
    mapRef.current = map;

    return () => {
      map.remove();
      mapRef.current = null;
    };
  }, []);

  // ---- Rectangle drawing source/layer ----
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    const onLoad = () => {
      if (map.getSource("selection-rect")) return;

      map.addSource("selection-rect", {
        type: "geojson",
        data: { type: "FeatureCollection", features: [] },
      });

      map.addLayer({
        id: "selection-rect-fill",
        type: "fill",
        source: "selection-rect",
        paint: {
          "fill-color": "#3b82f6",
          "fill-opacity": 0.15,
        },
      });

      map.addLayer({
        id: "selection-rect-line",
        type: "line",
        source: "selection-rect",
        paint: {
          "line-color": "#3b82f6",
          "line-width": 2,
        },
      });
    };

    if (map.loaded()) {
      onLoad();
    } else {
      map.on("load", onLoad);
    }
  }, []);

  // ---- Update rectangle geometry whenever corners change ----
  const updateRect = useCallback(
    (corner1: maplibregl.LngLat, corner2: maplibregl.LngLat) => {
      const map = mapRef.current;
      const src = map?.getSource("selection-rect") as
        | maplibregl.GeoJSONSource
        | undefined;
      if (!src) return;

      const sw = [
        Math.min(corner1.lng, corner2.lng),
        Math.min(corner1.lat, corner2.lat),
      ];
      const ne = [
        Math.max(corner1.lng, corner2.lng),
        Math.max(corner1.lat, corner2.lat),
      ];

      src.setData({
        type: "Feature",
        properties: {},
        geometry: {
          type: "Polygon",
          coordinates: [
            [
              [sw[0], sw[1]],
              [ne[0], sw[1]],
              [ne[0], ne[1]],
              [sw[0], ne[1]],
              [sw[0], sw[1]],
            ],
          ],
        },
      });
    },
    []
  );

  // ---- Map click handler ----
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    const onClick = (e: maplibregl.MapMouseEvent) => {
      if (selectedBounds) return; // already have a selection

      if (!firstCorner) {
        setFirstCorner(e.lngLat);
      } else {
        // Second click — finalise
        const s = Math.min(firstCorner.lat, e.lngLat.lat);
        const n = Math.max(firstCorner.lat, e.lngLat.lat);
        const w = Math.min(firstCorner.lng, e.lngLat.lng);
        const ee = Math.max(firstCorner.lng, e.lngLat.lng);
        const bounds: Bounds = [s, w, n, ee];
        updateRect(firstCorner, e.lngLat);
        setSelectedBounds(bounds);
        onBoundsSelected(bounds);
        setCursorPos(null);
      }
    };

    map.on("click", onClick);
    return () => {
      map.off("click", onClick);
    };
  }, [firstCorner, selectedBounds, onBoundsSelected, updateRect]);

  // ---- Mouse-move for preview rectangle ----
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    const onMove = (e: maplibregl.MapMouseEvent) => {
      if (!firstCorner || selectedBounds) return;
      setCursorPos(e.lngLat);
      updateRect(firstCorner, e.lngLat);
    };

    map.on("mousemove", onMove);
    return () => {
      map.off("mousemove", onMove);
    };
  }, [firstCorner, selectedBounds, updateRect]);

  // ---- Clear ----
  const handleClear = () => {
    setFirstCorner(null);
    setSelectedBounds(null);
    setCursorPos(null);
    onClear();

    const src = mapRef.current?.getSource("selection-rect") as
      | maplibregl.GeoJSONSource
      | undefined;
    src?.setData({ type: "FeatureCollection", features: [] });
  };

  // ---- Status text ----
  let status: string;
  if (selectedBounds) {
    const [s, w, n, e] = selectedBounds;
    status = `Selected: ${s.toFixed(5)}°N ${w.toFixed(5)}°E → ${n.toFixed(5)}°N ${e.toFixed(5)}°E`;
  } else if (firstCorner) {
    status = `First corner set (${firstCorner.lat.toFixed(5)}, ${firstCorner.lng.toFixed(5)}). Click to set second corner.`;
  } else {
    status = "Click on the map to set the first corner of your selection.";
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%" }}>
      <div
        ref={containerRef}
        style={{ flex: 1, minHeight: 0 }}
      />
      <div
        style={{
          padding: "10px 14px",
          background: "#1a1a2e",
          color: "#e0e0e0",
          fontSize: 13,
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 12,
        }}
      >
        <span style={{ flex: 1 }}>{status}</span>
        <button
          onClick={handleClear}
          style={{
            padding: "5px 14px",
            background: "#ef4444",
            color: "#fff",
            border: "none",
            borderRadius: 4,
            cursor: "pointer",
            fontSize: 13,
            whiteSpace: "nowrap",
          }}
        >
          Clear selection
        </button>
      </div>
    </div>
  );
}
