import { useCallback, useState, useEffect } from "react";
import MapSelector from "./MapSelector";
import ModelPreview from "./ModelPreview";
import { useOverpassData } from "./useOverpassData";
import type { Bounds } from "./types";

function useIsMobile(breakpoint = 768) {
  const [isMobile, setIsMobile] = useState(
    () => window.innerWidth < breakpoint
  );
  useEffect(() => {
    const onResize = () => setIsMobile(window.innerWidth < breakpoint);
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, [breakpoint]);
  return isMobile;
}

export default function App() {
  const { loading, error, sceneData, fetchData } = useOverpassData();
  const isMobile = useIsMobile();
  const [activeTab, setActiveTab] = useState<"map" | "preview">("map");

  const handleBoundsSelected = useCallback(
    (bounds: Bounds) => {
      fetchData(bounds);
      if (isMobile) setActiveTab("preview");
    },
    [fetchData, isMobile]
  );

  const fontFamily =
    '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';

  if (isMobile) {
    return (
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          width: "100vw",
          height: "100vh",
          fontFamily,
          overflow: "hidden",
        }}
      >
        {/* Tab bar */}
        <div style={{ display: "flex", background: "#16213e", flexShrink: 0 }}>
          {(["map", "preview"] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              style={{
                flex: 1,
                padding: "14px 0",
                background: activeTab === tab ? "#1e3a5f" : "transparent",
                color: "#fff",
                border: "none",
                borderBottom:
                  activeTab === tab
                    ? "3px solid #3b82f6"
                    : "3px solid transparent",
                fontSize: 15,
                fontWeight: 600,
                cursor: "pointer",
                letterSpacing: 0.3,
              }}
            >
              {tab === "map" ? "Map Selection" : "Print Preview"}
            </button>
          ))}
        </div>

        {/* Content — both mounted, toggle visibility so map keeps state */}
        <div style={{ flex: 1, minHeight: 0, position: "relative" }}>
          <div
            style={{
              width: "100%",
              height: "100%",
              display: activeTab === "map" ? "flex" : "none",
            }}
          >
            <MapSelector
              onBoundsSelected={handleBoundsSelected}
              visible={activeTab === "map"}
            />
          </div>
          <div
            style={{
              width: "100%",
              height: "100%",
              display: activeTab === "preview" ? "flex" : "none",
            }}
          >
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

  // Desktop layout
  return (
    <div
      style={{
        display: "flex",
        width: "100vw",
        height: "100vh",
        fontFamily,
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
          <MapSelector onBoundsSelected={handleBoundsSelected} />
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
