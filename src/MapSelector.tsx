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
  onBoundsSelected: (bounds: Bounds, locationName?: string, bearing?: number) => void;
  /** When controlled by a tab layout, signals whether this pane is visible. */
  visible?: boolean;
  /** True while data is being fetched — disables generate button. */
  loading?: boolean;
}

/** Minimum zoom level required to generate a preview / place an order. */
const MIN_ZOOM_FOR_GENERATE = Number(import.meta.env.VITE_MIN_ZOOM_FOR_GENERATE) || 12;

/** Cities with dense, interesting geometry that look great as 3D prints. */
const SHOWCASE_CITIES: { lng: number; lat: number; zoom: number; bearing: number }[] = [
  { lng: -0.0876, lat: 51.5074, zoom: 15.5, bearing: -15 },   // City of London — dense skyscrapers + Tower Bridge
  { lng: 2.3490, lat: 48.8530, zoom: 15.5, bearing: 10 },     // Paris — Notre-Dame & Île de la Cité
  { lng: -73.9857, lat: 40.7484, zoom: 15.5, bearing: -29 },   // Manhattan Midtown — Empire State area
  { lng: 139.7670, lat: 35.6812, zoom: 15.5, bearing: 0 },     // Tokyo — Shibuya crossing area
  { lng: -3.1883, lat: 55.9533, zoom: 15.5, bearing: 5 },      // Edinburgh Old Town — castle to Royal Mile
  { lng: 12.4964, lat: 41.9028, zoom: 15.5, bearing: -20 },    // Rome — Colosseum & Forum
  { lng: -0.1181, lat: 51.5033, zoom: 15.5, bearing: 0 },      // Westminster — Big Ben, Parliament, London Eye
  { lng: -2.2426, lat: 53.4808, zoom: 15.5, bearing: 10 },     // Manchester city centre — dense Northern Quarter
  { lng: 55.2708, lat: 25.1972, zoom: 15.5, bearing: -30 },    // Dubai Marina — tall towers along the water
  { lng: -1.8904, lat: 52.4862, zoom: 15.5, bearing: 0 },      // Birmingham city centre — canal basin area
];

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
  const prevTooFarOutRef = useRef(tooFarOut);

  // Haptic feedback when crossing the zoom threshold (mobile)
  useEffect(() => {
    if (tooFarOut !== prevTooFarOutRef.current) {
      prevTooFarOutRef.current = tooFarOut;
      if (navigator.vibrate) {
        navigator.vibrate(15);
      }
    }
  }, [tooFarOut]);

  // ---- Dimensions display (updated directly on DOM for perf) ----
  const updateDimensions = useCallback(() => {
    const map = mapRef.current;
    const frame = frameRef.current;
    const dimEl = dimensionsRef.current;
    if (!map || !frame || !dimEl) return;

    const frameRect = frame.getBoundingClientRect();
    if (frameRect.width === 0 || frameRect.height === 0) return;

    const mapRect = map.getContainer().getBoundingClientRect();
    const left = frameRect.left - mapRect.left;
    const top = frameRect.top - mapRect.top;
    const right = frameRect.right - mapRect.left;
    const bottom = frameRect.bottom - mapRect.top;

    const corners = [
      map.unproject([left, top]),
      map.unproject([right, top]),
      map.unproject([right, bottom]),
      map.unproject([left, bottom]),
    ];
    const south = Math.min(...corners.map((c) => c.lat));
    const north = Math.max(...corners.map((c) => c.lat));
    const west = Math.min(...corners.map((c) => c.lng));
    const east = Math.max(...corners.map((c) => c.lng));

    const latDiff = north - south;
    const lngDiff = east - west;
    const avgLat = (south + north) / 2;
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

  const handleRandomPlace = useCallback(() => {
    const map = mapRef.current;
    if (!map) return;
    // Pick a random city different from current view
    const current = map.getCenter();
    const candidates = SHOWCASE_CITIES.filter(
      (c) => Math.abs(c.lat - current.lat) > 0.01 || Math.abs(c.lng - current.lng) > 0.01
    );
    const city = candidates.length > 0
      ? candidates[Math.floor(Math.random() * candidates.length)]
      : SHOWCASE_CITIES[Math.floor(Math.random() * SHOWCASE_CITIES.length)];
    map.flyTo({
      center: [city.lng, city.lat],
      zoom: city.zoom,
      bearing: city.bearing,
      duration: 2000,
    });
    setSearchQuery("");
  }, []);

  // ---- Initialise map ----
  useEffect(() => {
    if (!containerRef.current) return;

    // Read initial center/zoom/bearing from URL hash, or pick a random showcase city
    const randomCity = SHOWCASE_CITIES[Math.floor(Math.random() * SHOWCASE_CITIES.length)];
    let initCenter: [number, number] = [randomCity.lng, randomCity.lat];
    let initZoom = randomCity.zoom;
    let initBearing = randomCity.bearing;
    const hash = window.location.hash.slice(1);
    if (hash) {
      const params = new URLSearchParams(hash);
      const lat = parseFloat(params.get("lat") || "");
      const lng = parseFloat(params.get("lng") || "");
      const z = parseFloat(params.get("z") || "");
      const b = parseFloat(params.get("b") || "");
      if (!isNaN(lat) && !isNaN(lng)) initCenter = [lng, lat];
      if (!isNaN(z) && z >= 0 && z <= 16) initZoom = z;
      if (!isNaN(b)) initBearing = b;
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
      bearing: initBearing,
      maxZoom: 16,
      maxPitch: 0,
      maxTileCacheSize: 64,
    });

    map.addControl(new maplibregl.NavigationControl(), "top-right");
    mapRef.current = map;

    // Sync map position to URL hash so shared links restore the view
    const updateHash = () => {
      const c = map.getCenter();
      const z = map.getZoom();
      const b = map.getBearing();
      let newHash = `lat=${c.lat.toFixed(5)}&lng=${c.lng.toFixed(5)}&z=${z.toFixed(2)}`;
      // Only include bearing when rotated away from north to keep URLs clean
      if (Math.abs(b) > 0.1) newHash += `&b=${b.toFixed(1)}`;
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
    const left = frameRect.left - mapRect.left;
    const top = frameRect.top - mapRect.top;
    const right = frameRect.right - mapRect.left;
    const bottom = frameRect.bottom - mapRect.top;

    const corners = [
      map.unproject([left, top]),
      map.unproject([right, top]),
      map.unproject([right, bottom]),
      map.unproject([left, bottom]),
    ];
    const south = Math.min(...corners.map((c) => c.lat));
    const north = Math.max(...corners.map((c) => c.lat));
    const west = Math.min(...corners.map((c) => c.lng));
    const east = Math.max(...corners.map((c) => c.lng));

    const bounds: Bounds = [south, west, north, east];
    // Extract a short location name from the search query
    const name = searchQuery.split(",")[0].trim() || "";
    const bearing = map.getBearing();
    onBoundsSelected(bounds, name, bearing);
  }, [onBoundsSelected, searchQuery]);

  return (
    <div className="flex flex-col h-full w-full">
      {/* Search bar + location button */}
      <div className="relative px-3 py-2 bg-gray-100 border-b border-gray-300 shrink-0 flex gap-2 items-center">
        <button
          onClick={handleUseLocation}
          title="Use my location"
          className="p-2.5 bg-white border border-gray-300 rounded-md cursor-pointer shrink-0 min-h-[44px] min-w-[44px] flex items-center justify-center"
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
        <div className="relative flex-1">
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => handleSearchInput(e.target.value)}
            onFocus={(e) => {
              if (searchResults.length > 0) setShowResults(true);
              e.target.select();
            }}
            placeholder="Search for a city or location..."
            className="w-full py-2.5 px-3.5 text-base border border-gray-300 rounded-md outline-none"
            style={{ paddingRight: searchQuery ? 40 : 14 }}
          />
          {searchQuery && !searchLoading && (
            <button
              onClick={() => {
                setSearchQuery("");
                setSearchResults([]);
                setShowResults(false);
              }}
              aria-label="Clear search"
              className="absolute right-2 top-1/2 -translate-y-1/2 bg-black/10 border-none rounded-full w-7 h-7 cursor-pointer flex items-center justify-center p-0 text-gray-500 text-base leading-none"
            >
              ✕
            </button>
          )}
          {searchLoading && (
            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-gray-400">
              searching...
            </span>
          )}
          {showResults && searchResults.length > 0 && (
            <div className="absolute top-full left-0 right-0 bg-white border border-gray-300 rounded-b-md shadow-lg z-[1000] max-h-[250px] overflow-y-auto">
              {searchResults.map((r, i) => (
                <div
                  key={i}
                  onClick={() => handleSelectResult(r)}
                  className="px-4 py-3 cursor-pointer text-sm min-h-[44px] flex items-center hover:bg-gray-100 border-b border-gray-100 last:border-b-0"
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
        className="flex-1 min-h-0 relative overflow-hidden"
        onClick={() => setShowResults(false)}
      >
        <div ref={containerRef} className="w-full h-full" />

        {/* Selection frame — always square, darkened outside, clear inside */}
        <div
          ref={frameRef}
          className="absolute pointer-events-none z-[1] rounded-sm transition-[border-color] duration-300"
          style={{
            /* size & position set by updateFrameLayout via ResizeObserver */
            top: "12%",
            left: "12%",
            width: "76%",
            height: "76%",
            border: `2.5px dashed ${tooFarOut ? "#f59e0b" : "#3b82f6"}`,
            boxShadow: "0 0 0 9999px rgba(0, 0, 0, 0.25)",
          }}
        />

        {/* Dimensions badge — vertical position set by updateFrameLayout */}
        <div
          ref={dimensionsRef}
          className="absolute left-1/2 -translate-x-1/2 bg-black/70 backdrop-blur-lg text-white px-3.5 py-1.5 rounded-md text-[13px] font-medium tracking-wide pointer-events-none z-[2] whitespace-nowrap"
        />

        {/* "Zoom in" banner — shown when too far out to generate */}
        {tooFarOut && (
          <div className="absolute top-3 left-1/2 -translate-x-1/2 bg-amber-500/[0.92] backdrop-blur-lg text-[#1a1a2e] px-5 py-2.5 rounded-lg text-sm font-semibold pointer-events-none z-10 whitespace-nowrap shadow-lg text-center">
            Zoom in closer to generate a model
          </div>
        )}
      </div>

      {/* Bottom action bar */}
      <div className="px-4 py-3 bg-[#1a1a2e] shrink-0 flex items-center gap-3">
        <button
          onClick={handleRandomPlace}
          disabled={loading}
          title="Take me somewhere new"
          className="p-2.5 bg-white/10 border border-white/20 rounded-md cursor-pointer shrink-0 min-h-[44px] min-w-[44px] flex items-center justify-center text-white/70 hover:bg-white/20 hover:text-white transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M1 6v16l7-4 8 4 7-4V2l-7 4-8-4-7 4z" />
            <line x1="8" y1="2" x2="8" y2="18" />
            <line x1="16" y1="6" x2="16" y2="22" />
          </svg>
        </button>
        <span
          className={`flex-1 text-[13px] leading-snug transition-colors duration-300 ${
            tooFarOut ? "text-amber-500" : "text-gray-400"
          }`}
        >
          {tooFarOut
            ? "Zoom in to select an area for printing"
            : "Pan & zoom to frame your area"}
        </span>
        <button
          onClick={handleGenerate}
          disabled={loading || tooFarOut}
          className={`px-6 py-3 text-white border-none rounded-md text-[15px] font-semibold whitespace-nowrap min-h-[48px] transition-all duration-200 ${
            loading || tooFarOut
              ? "bg-gray-500 cursor-not-allowed opacity-80"
              : "bg-blue-500 cursor-pointer hover:bg-blue-600"
          }`}
        >
          {loading ? "Generating..." : "Generate Preview"}
        </button>
      </div>
    </div>
  );
}
