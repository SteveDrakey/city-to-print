import { useEffect, useRef, useState, useCallback } from "react";
import maplibregl from "maplibre-gl";
import type { Bounds } from "./types";

// MapLibre GL CSS is loaded via a <link> in index.html or imported here.
// We'll inject it via a side-effect import handled by Vite.
import "maplibre-gl/dist/maplibre-gl.css";

interface SearchResult {
  display_name: string;
  lat: string;
  lon: string;
  boundingbox: [string, string, string, string]; // [south, north, west, east]
}

interface Props {
  onBoundsSelected: (bounds: Bounds) => void;
  onClear: () => void;
  /** When controlled by a tab layout, signals whether this pane is visible. */
  visible?: boolean;
}

const isTouchDevice =
  typeof window !== "undefined" &&
  ("ontouchstart" in window || navigator.maxTouchPoints > 0);

/**
 * Interactive map with rectangle selection.
 *
 * Two-tap/click workflow:
 *   1. Tap/click to set first corner (marker shown)
 *   2. Move mouse to see preview rectangle (desktop) or just navigate (mobile)
 *   3. Tap/click to set second corner → selection emitted
 *
 * A "Clear selection" button resets everything.
 */
export default function MapSelector({
  onBoundsSelected,
  onClear,
  visible,
}: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const markerRef = useRef<maplibregl.Marker | null>(null);

  // Selection state: null → picking first corner → picking second corner
  const [firstCorner, setFirstCorner] = useState<maplibregl.LngLat | null>(
    null
  );
  const [selectedBounds, setSelectedBounds] = useState<Bounds | null>(null);
  const [cursorPos, setCursorPos] = useState<maplibregl.LngLat | null>(null);

  // Search state
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const [showResults, setShowResults] = useState(false);
  const searchTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ---- Resize map when tab becomes visible again ----
  useEffect(() => {
    if (visible === false) return;
    const timer = setTimeout(() => {
      mapRef.current?.resize();
    }, 60);
    return () => clearTimeout(timer);
  }, [visible]);

  const handleSearch = useCallback(async (query: string) => {
    if (query.trim().length < 2) {
      setSearchResults([]);
      setShowResults(false);
      return;
    }
    setSearchLoading(true);
    try {
      const res = await fetch(
        `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}&limit=5`,
        { headers: { Accept: "application/json" } }
      );
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data: SearchResult[] = await res.json();
      setSearchResults(data);
      setShowResults(data.length > 0);
    } catch (err) {
      console.error("Nominatim search failed:", err);
      setSearchResults([]);
    } finally {
      setSearchLoading(false);
    }
  }, []);

  const handleSearchInput = useCallback(
    (value: string) => {
      setSearchQuery(value);
      if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current);
      searchTimeoutRef.current = setTimeout(() => handleSearch(value), 400);
    },
    [handleSearch]
  );

  const handleSelectResult = useCallback((result: SearchResult) => {
    setShowResults(false);
    setSearchQuery(result.display_name);
    const map = mapRef.current;
    if (!map) return;
    map.flyTo({
      center: [parseFloat(result.lon), parseFloat(result.lat)],
      zoom: 14,
      duration: 1500,
    });
  }, []);

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

  // ---- Mouse-move for preview rectangle (desktop) ----
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

  // ---- First-corner marker (visual feedback, especially useful on touch) ----
  useEffect(() => {
    const map = mapRef.current;
    if (markerRef.current) {
      markerRef.current.remove();
      markerRef.current = null;
    }
    if (firstCorner && !selectedBounds && map) {
      markerRef.current = new maplibregl.Marker({ color: "#3b82f6" })
        .setLngLat(firstCorner)
        .addTo(map);
    }
    return () => {
      if (markerRef.current) {
        markerRef.current.remove();
        markerRef.current = null;
      }
    };
  }, [firstCorner, selectedBounds]);

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
  const tapOrClick = isTouchDevice ? "Tap" : "Click";
  let status: string;
  if (selectedBounds) {
    const [s, w, n, e] = selectedBounds;
    status = `Selected: ${s.toFixed(4)}°N ${w.toFixed(4)}°E → ${n.toFixed(4)}°N ${e.toFixed(4)}°E`;
  } else if (firstCorner) {
    status = `Corner 1 set. ${tapOrClick} to set the second corner.`;
  } else {
    status = `${tapOrClick} on the map to set the first corner of your selection.`;
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%", width: "100%" }}>
      {/* Search bar */}
      <div
        style={{
          position: "relative",
          padding: "8px 12px",
          background: "#f0f0f0",
          borderBottom: "1px solid #ddd",
          flexShrink: 0,
        }}
      >
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => handleSearchInput(e.target.value)}
          onFocus={() => searchResults.length > 0 && setShowResults(true)}
          placeholder="Search for a city or location..."
          style={{
            width: "100%",
            padding: "10px 14px",
            fontSize: 16, // 16px prevents iOS auto-zoom on focus
            border: "1px solid #ccc",
            borderRadius: 6,
            outline: "none",
            boxSizing: "border-box",
          }}
        />
        {searchLoading && (
          <span
            style={{
              position: "absolute",
              right: 22,
              top: "50%",
              transform: "translateY(-50%)",
              fontSize: 12,
              color: "#888",
            }}
          >
            searching...
          </span>
        )}
        {showResults && searchResults.length > 0 && (
          <div
            style={{
              position: "absolute",
              top: "100%",
              left: 12,
              right: 12,
              background: "#fff",
              border: "1px solid #ddd",
              borderRadius: "0 0 6px 6px",
              boxShadow: "0 4px 12px rgba(0,0,0,0.15)",
              zIndex: 1000,
              maxHeight: 250,
              overflowY: "auto",
            }}
          >
            {searchResults.map((r, i) => (
              <div
                key={i}
                onClick={() => handleSelectResult(r)}
                style={{
                  padding: "12px 16px",
                  cursor: "pointer",
                  fontSize: 14,
                  minHeight: 44, // Apple-recommended minimum touch target
                  display: "flex",
                  alignItems: "center",
                  borderBottom:
                    i < searchResults.length - 1
                      ? "1px solid #eee"
                      : "none",
                }}
                onMouseEnter={(e) =>
                  (e.currentTarget.style.background = "#f5f5f5")
                }
                onMouseLeave={(e) =>
                  (e.currentTarget.style.background = "#fff")
                }
              >
                {r.display_name}
              </div>
            ))}
          </div>
        )}
      </div>
      <div
        ref={containerRef}
        style={{ flex: 1, minHeight: 0 }}
        onClick={() => setShowResults(false)}
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
          flexShrink: 0,
        }}
      >
        <span style={{ flex: 1, lineHeight: 1.4 }}>{status}</span>
        <button
          onClick={handleClear}
          style={{
            padding: "10px 18px",
            background: "#ef4444",
            color: "#fff",
            border: "none",
            borderRadius: 4,
            cursor: "pointer",
            fontSize: 14,
            fontWeight: 500,
            whiteSpace: "nowrap",
            minHeight: 44, // touch-friendly
          }}
        >
          Clear
        </button>
      </div>
    </div>
  );
}
