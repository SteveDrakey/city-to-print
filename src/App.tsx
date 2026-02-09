import { useCallback, useState, useRef, useEffect, lazy, Suspense } from "react";
import MapSelector from "./MapSelector";
import ProductPage from "./ProductPage";
import { useOverpassData } from "./useOverpassData";
import CityLoadingAnimation from "./CityLoadingAnimation";
import type { Bounds, SceneData } from "./types";

const LazyViewerOverlay = lazy(() =>
  import("./ModelPreview").then((m) => ({ default: m.ViewerOverlay }))
);

export default function App() {
  const { loading, error, sceneData, fetchData, retryAttempt, maxRetries } =
    useOverpassData();
  const [locationName, setLocationName] = useState("");
  const [areaDescription, setAreaDescription] = useState("");
  const [selectedBounds, setSelectedBounds] = useState<Bounds | null>(null);
  const [showViewer, setShowViewer] = useState(false);
  const [serverImages, setServerImages] = useState<string[] | null>(null);
  const [renderingOnServer, setRenderingOnServer] = useState(false);
  const productRef = useRef<HTMLDivElement>(null);
  const loadingRef = useRef<HTMLDivElement>(null);

  const fontFamily =
    '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';

  // When sceneData arrives, send it to the server for rendering
  useEffect(() => {
    if (!sceneData) {
      setServerImages(null);
      return;
    }

    let cancelled = false;
    setRenderingOnServer(true);
    setServerImages(null);

    fetch("/api/render-preview", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ sceneData }),
    })
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (cancelled) return;
        if (data?.images) {
          setServerImages(
            data.images.map((img: { data: string }) => `data:image/jpeg;base64,${img.data}`)
          );
        }
      })
      .catch(() => {
        // Server render failed — ProductPage will fall back to client-side rendering
      })
      .finally(() => {
        if (!cancelled) setRenderingOnServer(false);
      });

    return () => {
      cancelled = true;
    };
  }, [sceneData]);

  const handleBoundsSelected = useCallback(
    (bounds: Bounds, name?: string) => {
      // Start Overpass data fetch immediately
      fetchData(bounds);
      setSelectedBounds(bounds);
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

  // Auto-scroll to loading animation when generation starts or retries update
  useEffect(() => {
    if (loading && loadingRef.current) {
      loadingRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [loading, retryAttempt]);

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
            justifyContent: "space-between",
            gap: 10,
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 2L2 7l10 5 10-5-10-5z" />
              <path d="M2 17l10 5 10-5" />
              <path d="M2 12l10 5 10-5" />
            </svg>
            City to Print
          </div>
          <a
            href="https://www.etsy.com/uk/shop/Drakey3DPrints"
            target="_blank"
            rel="noopener noreferrer"
            style={{
              display: "flex",
              alignItems: "center",
              gap: 6,
              color: "#e2e8f0",
              fontSize: 13,
              fontWeight: 500,
              textDecoration: "none",
              letterSpacing: 0.2,
            }}
          >
            by Drakey 3D Prints
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M18 13v6a2 2 0 01-2 2H5a2 2 0 01-2-2V8a2 2 0 012-2h6" />
              <polyline points="15 3 21 3 21 9" />
              <line x1="10" y1="14" x2="21" y2="3" />
            </svg>
          </a>
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
            bounds={selectedBounds}
            onOpenViewer={() => setShowViewer(true)}
            serverImages={serverImages}
            renderingOnServer={renderingOnServer}
          />
        </div>
      )}

      {/* ── Fullscreen 3D Viewer Overlay (lazy-loaded) ── */}
      {showViewer && sceneData && (
        <Suspense fallback={null}>
          <LazyViewerOverlay
            sceneData={sceneData}
            onClose={() => setShowViewer(false)}
          />
        </Suspense>
      )}
    </div>
  );
}
