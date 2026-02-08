import { useCallback, useState, useRef, useEffect } from "react";
import MapSelector from "./MapSelector";
import ProductPage from "./ProductPage";
import { ViewerOverlay } from "./ModelPreview";
import { useOverpassData } from "./useOverpassData";
import CityLoadingAnimation from "./CityLoadingAnimation";
import type { Bounds } from "./types";

export default function App() {
  const { loading, error, sceneData, fetchData, retryAttempt, maxRetries } =
    useOverpassData();
  const [locationName, setLocationName] = useState("");
  const [areaDescription, setAreaDescription] = useState("");
  const [showViewer, setShowViewer] = useState(false);
  const productRef = useRef<HTMLDivElement>(null);
  const loadingRef = useRef<HTMLDivElement>(null);

  const fontFamily =
    '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';

  const handleBoundsSelected = useCallback(
    (bounds: Bounds, name?: string) => {
      // Start Overpass data fetch immediately
      fetchData(bounds);
      setAreaDescription("");

      // Set search name as interim while we reverse geocode
      if (name) setLocationName(name);

      // Reverse geocode the center of the selected bounds
      const lat = (bounds[0] + bounds[2]) / 2;
      const lon = (bounds[1] + bounds[3]) / 2;

      fetch(
        `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lon}&zoom=14&addressdetails=1`,
        { headers: { Accept: "application/json" } }
      )
        .then((res) => (res.ok ? res.json() : null))
        .then((data) => {
          if (!data?.address) return name || "";
          const addr = data.address;
          const neighbourhood =
            addr.suburb || addr.neighbourhood || addr.city_district || "";
          const city =
            addr.city || addr.town || addr.village || addr.municipality || "";

          const parts: string[] = [];
          if (neighbourhood) parts.push(neighbourhood);
          if (city && city !== neighbourhood) parts.push(city);

          const resolved =
            parts.length > 0
              ? parts.join(", ")
              : name || (data.display_name?.split(",")[0] ?? "");
          setLocationName(resolved);

          // Return term for Wikipedia lookup (prefer city-level name)
          return city || neighbourhood || name || "";
        })
        .then((wikiTerm) => {
          if (!wikiTerm) return;
          return fetch(
            `https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(wikiTerm)}`,
            { headers: { Accept: "application/json" } }
          )
            .then((r) => (r.ok ? r.json() : null))
            .then((wiki) => {
              if (wiki?.extract) setAreaDescription(wiki.extract);
            });
        })
        .catch(() => {
          // Reverse geocode failed; keep the search name if we had one
        });
    },
    [fetchData]
  );

  // Auto-scroll to loading animation as soon as generation starts
  useEffect(() => {
    if (loading && loadingRef.current) {
      loadingRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [loading]);

  // Auto-scroll to product page when scene data arrives
  useEffect(() => {
    if (sceneData && productRef.current) {
      productRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [sceneData]);

  return (
    <div style={{ fontFamily, minHeight: "100vh" }}>
      {/* ── Map Section (takes full viewport height) ── */}
      <div
        style={{
          width: "100%",
          height: "100vh",
          background: "#111827",
          display: "flex",
          justifyContent: "center",
        }}
      >
        <div
          style={{
            width: "100%",
            maxWidth: "min(100%, 100vh)",
            height: "100%",
            display: "flex",
            flexDirection: "column",
            position: "relative",
            boxShadow: "0 0 60px rgba(0,0,0,0.4)",
          }}
        >
        {/* Header */}
        <div
          style={{
            padding: "12px 20px",
            background: "#16213e",
            color: "#fff",
            fontSize: 16,
            fontWeight: 700,
            letterSpacing: 0.4,
            flexShrink: 0,
            display: "flex",
            alignItems: "center",
            gap: 10,
          }}
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 2L2 7l10 5 10-5-10-5z" />
            <path d="M2 17l10 5 10-5" />
            <path d="M2 12l10 5 10-5" />
          </svg>
          City to Print
        </div>

        {/* Map */}
        <div style={{ flex: 1, minHeight: 0 }}>
          <MapSelector onBoundsSelected={handleBoundsSelected} loading={loading} />
        </div>
        </div>
      </div>

      {/* ── Loading animation ── */}
      {loading && (
        <div ref={loadingRef}>
          <CityLoadingAnimation
            retryAttempt={retryAttempt}
            maxRetries={maxRetries}
          />
        </div>
      )}

      {/* ── Error notice ── */}
      {error && !loading && (
        <div
          style={{
            padding: "12px 24px",
            background: "#fef2f2",
            color: "#b91c1c",
            fontSize: 13,
            textAlign: "center",
            borderTop: "1px solid #fecaca",
          }}
        >
          Overpass API issue: {error} — showing generated preview data
        </div>
      )}

      {/* ── Product Page (appears after generation) ── */}
      {sceneData && !loading && (
        <div ref={productRef}>
          <ProductPage
            sceneData={sceneData}
            locationName={locationName}
            areaDescription={areaDescription}
            onOpenViewer={() => setShowViewer(true)}
          />
        </div>
      )}

      {/* ── Fullscreen 3D Viewer Overlay ── */}
      {showViewer && sceneData && (
        <ViewerOverlay
          sceneData={sceneData}
          onClose={() => setShowViewer(false)}
        />
      )}
    </div>
  );
}
