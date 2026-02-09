import { useEffect, useRef, useState, useCallback } from "react";
import maplibregl from "maplibre-gl";
import type { Bounds } from "./types";

import "maplibre-gl/dist/maplibre-gl.css";

interface SearchResult {
  display_name: string;
  lat: string;
  lon: string;
  boundingbox: [string, string, string, string];
}

interface Props {
  onBoundsSelected: (bounds: Bounds, locationName?: string) => void;
  /** When controlled by a tab layout, signals whether this pane is visible. */
  visible?: boolean;
  /** True while data is being fetched — disables generate button. */
  loading?: boolean;
}

/** Minimum zoom level required to generate a preview / place an order. */
const MIN_ZOOM_FOR_GENERATE = 11;

/**
 * Interactive map with viewport-frame area selection.
 *
 * A fixed selection rectangle overlays the map. The user pans & zooms
 * to frame the area they want, then taps "Generate Preview" to capture
 * the bounds. Works naturally on both touch and mouse devices.
 */
export default function MapSelector({ onBoundsSelected, visible, loading }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const frameRef = useRef<HTMLDivElement>(null);
  const dimensionsRef = useRef<HTMLDivElement>(null);
  const mapAreaRef = useRef<HTMLDivElement>(null);

  // Search state
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const [showResults, setShowResults] = useState(false);
  const searchTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Zoom tracking — drives the "too far out" UI
  const [currentZoom, setCurrentZoom] = useState(13);
  const tooFarOut = currentZoom < MIN_ZOOM_FOR_GENERATE;

  // ---- Dimensions display (updated directly on DOM for perf) ----
  const updateDimensions = useCallback(() => {
    const map = mapRef.current;
    const frame = frameRef.current;
    const dimEl = dimensionsRef.current;
    if (!map || !frame || !dimEl) return;

    const frameRect = frame.getBoundingClientRect();
    if (frameRect.width === 0 || frameRect.height === 0) return;

    const mapRect = map.getContainer().getBoundingClientRect();
    const tl = map.unproject([
      frameRect.left - mapRect.left,
      frameRect.top - mapRect.top,
    ]);
    const br = map.unproject([
      frameRect.right - mapRect.left,
      frameRect.bottom - mapRect.top,
    ]);

    const latDiff = Math.abs(tl.lat - br.lat);
    const lngDiff = Math.abs(tl.lng - br.lng);
    const avgLat = (tl.lat + br.lat) / 2;
    const metersH = latDiff * 111320;
    const metersW = lngDiff * 111320 * Math.cos((avgLat * Math.PI) / 180);

    const fmt = (m: number) =>
      m >= 1000 ? `${(m / 1000).toFixed(1)}km` : `${Math.round(m)}m`;
    dimEl.textContent = `${fmt(metersW)} × ${fmt(metersH)}`;
  }, []);

  // ---- Keep selection frame as a perfect square ----
  const updateFrameLayout = useCallback(() => {
    const container = mapAreaRef.current;
    const frame = frameRef.current;
    const dimEl = dimensionsRef.current;
    if (!container || !frame) return;

    const { width, height } = container.getBoundingClientRect();
    if (width === 0 || height === 0) return;

    const padding = 0.12;
    const maxW = width * (1 - 2 * padding);
    const maxH = height * (1 - 2 * padding);
    const size = Math.min(maxW, maxH);

    frame.style.width = `${size}px`;
    frame.style.height = `${size}px`;
    frame.style.top = `${(height - size) / 2}px`;
    frame.style.left = `${(width - size) / 2}px`;

    if (dimEl) {
      dimEl.style.top = `${(height + size) / 2 + 8}px`;
    }
  }, []);

  useEffect(() => {
    const container = mapAreaRef.current;
    if (!container) return;

    const observer = new ResizeObserver(updateFrameLayout);
    observer.observe(container);
    return () => observer.disconnect();
  }, [updateFrameLayout]);

  // ---- Resize map when tab becomes visible ----
  useEffect(() => {
    if (visible === false) return;
    const timer = setTimeout(() => {
      mapRef.current?.resize();
      updateDimensions();
    }, 60);
    return () => clearTimeout(timer);
  }, [visible, updateDimensions]);

  // ---- Search handlers ----
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
      zoom: 15,
      duration: 1500,
    });
  }, []);

  const handleUseLocation = useCallback(() => {
    if (!navigator.geolocation) return;
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        mapRef.current?.flyTo({
          center: [pos.coords.longitude, pos.coords.latitude],
          zoom: 15,
          duration: 1500,
        });
      },
      (err) => console.error("Geolocation error:", err)
    );
  }, []);

  // ---- Initialise map ----
  useEffect(() => {
    if (!containerRef.current) return;

    // Read initial center/zoom from URL hash (e.g. #lat=52.52&lng=13.405&z=13)
    let initCenter: [number, number] = [13.405, 52.52];
    let initZoom = 13;
    const hash = window.location.hash.slice(1);
    if (hash) {
      const params = new URLSearchParams(hash);
      const lat = parseFloat(params.get("lat") || "");
      const lng = parseFloat(params.get("lng") || "");
      const z = parseFloat(params.get("z") || "");
      if (!isNaN(lat) && !isNaN(lng)) initCenter = [lng, lat];
      if (!isNaN(z) && z >= 0 && z <= 16) initZoom = z;
    }

    const map = new maplibregl.Map({
      container: containerRef.current,
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
            maxzoom: 16,
          },
        ],
      },
      center: initCenter,
      zoom: initZoom,
      maxZoom: 16,
      maxTileCacheSize: 64,
    });

    map.addControl(new maplibregl.NavigationControl(), "top-right");
    mapRef.current = map;

    // Sync map position to URL hash so shared links restore the view
    const updateHash = () => {
      const c = map.getCenter();
      const z = map.getZoom();
      const newHash = `lat=${c.lat.toFixed(5)}&lng=${c.lng.toFixed(5)}&z=${z.toFixed(2)}`;
      history.replaceState(null, "", `#${newHash}`);
    };

    map.on("move", updateDimensions);
    map.on("load", updateDimensions);
    map.on("moveend", updateHash);
    map.on("zoom", () => setCurrentZoom(map.getZoom()));
    // Seed initial zoom into state once the map is ready
    map.on("load", () => setCurrentZoom(map.getZoom()));

    return () => {
      map.remove();
      mapRef.current = null;
    };
  }, [updateDimensions]);

  // ---- Generate bounds from current frame position ----
  const handleGenerate = useCallback(() => {
    const map = mapRef.current;
    const frame = frameRef.current;
    if (!map || !frame) return;

    const frameRect = frame.getBoundingClientRect();
    if (frameRect.width === 0 || frameRect.height === 0) return;

    const mapRect = map.getContainer().getBoundingClientRect();
    const tl = map.unproject([
      frameRect.left - mapRect.left,
      frameRect.top - mapRect.top,
    ]);
    const br = map.unproject([
      frameRect.right - mapRect.left,
      frameRect.bottom - mapRect.top,
    ]);

    const bounds: Bounds = [br.lat, tl.lng, tl.lat, br.lng];
    // Extract a short location name from the search query
    const name = searchQuery.split(",")[0].trim() || "";
    onBoundsSelected(bounds, name);
  }, [onBoundsSelected, searchQuery]);

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        height: "100%",
        width: "100%",
      }}
    >
      {/* Search bar + location button */}
      <div
        style={{
          position: "relative",
          padding: "8px 12px",
          background: "#f0f0f0",
          borderBottom: "1px solid #ddd",
          flexShrink: 0,
          display: "flex",
          gap: 8,
          alignItems: "center",
        }}
      >
        <button
          onClick={handleUseLocation}
          title="Use my location"
          style={{
            padding: "10px 12px",
            background: "#fff",
            border: "1px solid #ccc",
            borderRadius: 6,
            cursor: "pointer",
            flexShrink: 0,
            minHeight: 44,
            minWidth: 44,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <svg
            width="18"
            height="18"
            viewBox="0 0 24 24"
            fill="none"
            stroke="#333"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <circle cx="12" cy="12" r="4" />
            <line x1="12" y1="2" x2="12" y2="6" />
            <line x1="12" y1="18" x2="12" y2="22" />
            <line x1="2" y1="12" x2="6" y2="12" />
            <line x1="18" y1="12" x2="22" y2="12" />
          </svg>
        </button>
        <div style={{ position: "relative", flex: 1 }}>
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => handleSearchInput(e.target.value)}
            onFocus={(e) => {
              if (searchResults.length > 0) setShowResults(true);
              e.target.select();
            }}
            placeholder="Search for a city or location..."
            style={{
              width: "100%",
              padding: "10px 14px",
              paddingRight: searchQuery ? 40 : 14,
              fontSize: 16,
              border: "1px solid #ccc",
              borderRadius: 6,
              outline: "none",
              boxSizing: "border-box",
            }}
          />
          {searchQuery && !searchLoading && (
            <button
              onClick={() => {
                setSearchQuery("");
                setSearchResults([]);
                setShowResults(false);
              }}
              aria-label="Clear search"
              style={{
                position: "absolute",
                right: 8,
                top: "50%",
                transform: "translateY(-50%)",
                background: "rgba(0,0,0,0.1)",
                border: "none",
                borderRadius: "50%",
                width: 28,
                height: 28,
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                padding: 0,
                color: "#666",
                fontSize: 16,
                lineHeight: 1,
              }}
            >
              ✕
            </button>
          )}
          {searchLoading && (
            <span
              style={{
                position: "absolute",
                right: 12,
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
                left: 0,
                right: 0,
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
                    minHeight: 44,
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
      </div>

      {/* Map + selection frame overlay */}
      <div
        ref={mapAreaRef}
        style={{
          flex: 1,
          minHeight: 0,
          position: "relative",
          overflow: "hidden",
        }}
        onClick={() => setShowResults(false)}
      >
        <div ref={containerRef} style={{ width: "100%", height: "100%" }} />

        {/* Selection frame — always square, darkened outside, clear inside */}
        <div
          ref={frameRef}
          style={{
            position: "absolute",
            /* size & position set by updateFrameLayout via ResizeObserver */
            top: "12%",
            left: "12%",
            width: "76%",
            height: "76%",
            border: `2.5px dashed ${tooFarOut ? "#f59e0b" : "#3b82f6"}`,
            borderRadius: 4,
            boxShadow: "0 0 0 9999px rgba(0, 0, 0, 0.25)",
            pointerEvents: "none",
            zIndex: 1,
            transition: "border-color 0.3s",
          }}
        />

        {/* Dimensions badge — vertical position set by updateFrameLayout */}
        <div
          ref={dimensionsRef}
          style={{
            position: "absolute",
            left: "50%",
            transform: "translateX(-50%)",
            background: "rgba(0,0,0,0.7)",
            backdropFilter: "blur(8px)",
            color: "#fff",
            padding: "6px 14px",
            borderRadius: 6,
            fontSize: 13,
            fontWeight: 500,
            letterSpacing: 0.3,
            pointerEvents: "none",
            zIndex: 2,
            whiteSpace: "nowrap",
          }}
        />

        {/* "Zoom in" banner — shown when too far out to generate */}
        {tooFarOut && (
          <div
            style={{
              position: "absolute",
              top: 12,
              left: "50%",
              transform: "translateX(-50%)",
              background: "rgba(245, 158, 11, 0.92)",
              backdropFilter: "blur(8px)",
              color: "#1a1a2e",
              padding: "10px 20px",
              borderRadius: 8,
              fontSize: 14,
              fontWeight: 600,
              pointerEvents: "none",
              zIndex: 10,
              whiteSpace: "nowrap",
              boxShadow: "0 2px 12px rgba(0,0,0,0.25)",
              textAlign: "center",
            }}
          >
            Zoom in closer to generate a model
          </div>
        )}
      </div>

      {/* Bottom action bar */}
      <div
        style={{
          padding: "12px 16px",
          background: "#1a1a2e",
          flexShrink: 0,
          display: "flex",
          alignItems: "center",
          gap: 12,
        }}
      >
        <span
          style={{
            flex: 1,
            color: tooFarOut ? "#f59e0b" : "#a0a0b0",
            fontSize: 13,
            lineHeight: 1.4,
            transition: "color 0.3s",
          }}
        >
          {tooFarOut
            ? "Zoom in to select an area for printing"
            : "Pan & zoom to frame your area"}
        </span>
        <button
          onClick={handleGenerate}
          disabled={loading || tooFarOut}
          style={{
            padding: "12px 24px",
            background: loading || tooFarOut ? "#6b7280" : "#3b82f6",
            color: "#fff",
            border: "none",
            borderRadius: 6,
            cursor: loading || tooFarOut ? "not-allowed" : "pointer",
            fontSize: 15,
            fontWeight: 600,
            whiteSpace: "nowrap",
            minHeight: 48,
            opacity: loading || tooFarOut ? 0.8 : 1,
            transition: "background 0.2s, opacity 0.2s",
          }}
        >
          {loading ? "Generating..." : "Generate Preview"}
        </button>
      </div>
    </div>
  );
}
