import { useCallback } from "react";
import MapSelector from "./MapSelector";
import ModelPreview from "./ModelPreview";
import { useOverpassData } from "./useOverpassData";
import type { Bounds } from "./types";

export default function App() {
  const { loading, error, sceneData, fetchData } = useOverpassData();

  const handleBoundsSelected = useCallback(
    (bounds: Bounds) => {
      fetchData(bounds);
    },
    [fetchData]
  );

  const handleClear = useCallback(() => {
    // Reset is handled inside the hook on next fetch; nothing to do here
    // except letting the preview go blank (it reads sceneData which we don't
    // reset externally — we could, but keeping last preview is also fine).
  }, []);

  return (
    <div
      style={{
        display: "flex",
        width: "100vw",
        height: "100vh",
        fontFamily:
          '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
        overflow: "hidden",
      }}
    >
      {/* Left pane: map + controls */}
      <div
        style={{
          flex: 1,
          display: "flex",
          flexDirection: "column",
          borderRight: "2px solid #222",
        }}
      >
        <div
          style={{
            padding: "10px 14px",
            background: "#16213e",
            color: "#fff",
            fontSize: 15,
            fontWeight: 600,
            letterSpacing: 0.3,
          }}
        >
          City to Print &mdash; Map Selection
        </div>
        <div style={{ flex: 1, minHeight: 0 }}>
          <MapSelector
            onBoundsSelected={handleBoundsSelected}
            onClear={handleClear}
          />
        </div>
      </div>

      {/* Right pane: 3D preview */}
      <div
        style={{
          flex: 1,
          display: "flex",
          flexDirection: "column",
        }}
      >
        <div
          style={{
            padding: "10px 14px",
            background: "#16213e",
            color: "#fff",
            fontSize: 15,
            fontWeight: 600,
            letterSpacing: 0.3,
          }}
        >
          Print Preview
        </div>
        <div style={{ flex: 1, minHeight: 0 }}>
          <ModelPreview
            sceneData={sceneData}
            loading={loading}
            error={error}
          />
        </div>
      </div>
    </div>
  );
}
