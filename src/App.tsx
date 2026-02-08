import { useCallback, useState, useRef, useEffect } from "react";
import MapSelector from "./MapSelector";
import ProductPage from "./ProductPage";
import { ViewerOverlay } from "./ModelPreview";
import { useOverpassData } from "./useOverpassData";
import type { Bounds } from "./types";

export default function App() {
  const { loading, error, sceneData, fetchData } = useOverpassData();
  const [locationName, setLocationName] = useState("");
  const [showViewer, setShowViewer] = useState(false);
  const productRef = useRef<HTMLDivElement>(null);

  const fontFamily =
    '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';

  const handleBoundsSelected = useCallback(
    (bounds: Bounds, name?: string) => {
      fetchData(bounds);
      if (name) setLocationName(name);
    },
    [fetchData]
  );

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
          display: "flex",
          flexDirection: "column",
          position: "relative",
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
          <MapSelector onBoundsSelected={handleBoundsSelected} />
        </div>
      </div>

      {/* ── Loading indicator ── */}
      {loading && (
        <div
          style={{
            padding: "64px 24px",
            textAlign: "center",
            background: "#faf9f7",
          }}
        >
          <div
            style={{
              width: 36,
              height: 36,
              border: "3px solid #ddd",
              borderTopColor: "#3b82f6",
              borderRadius: "50%",
              margin: "0 auto",
              animation: "spin 0.8s linear infinite",
            }}
          />
          <div style={{ marginTop: 16, fontSize: 14, color: "#888" }}>
            Building your city model...
          </div>
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
