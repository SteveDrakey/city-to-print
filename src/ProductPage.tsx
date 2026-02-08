import { useState, useCallback, useEffect, useMemo } from "react";
import { CaptureRender, SCENE_CONFIGS } from "./ModelPreview";
import type { SceneData, SceneType, SceneOption } from "./types";

/**
 * Base camera offsets (relative to the scene's camera target).
 * Position = target + posOffset.  Target for all shots = scene camera target.
 */
const BASE_ANGLES: {
  label: string;
  posOffset: readonly [number, number, number];
}[] = [
  { label: "Front view",        posOffset: [0, 100, 380] },
  { label: "Three-quarter view", posOffset: [250, 160, 300] },
  { label: "Side view",         posOffset: [380, 80, 0] },
  { label: "Top-down view",     posOffset: [0, 380, 40] },
];

/** Compute absolute camera positions/targets for a given scene type. */
function getAnglesForScene(sceneType: SceneType) {
  const t = SCENE_CONFIGS[sceneType].cameraTarget;
  return BASE_ANGLES.map((a) => ({
    label: a.label,
    position: [
      t[0] + a.posOffset[0],
      t[1] + a.posOffset[1],
      t[2] + a.posOffset[2],
    ] as [number, number, number],
    target: [...t] as [number, number, number],
  }));
}

/** Build render jobs (hero + gallery) for a given scene type. */
function getRenderJobs(sceneType: SceneType) {
  const angles = getAnglesForScene(sceneType);
  return [
    { label: "Hero", position: angles[1].position, target: angles[1].target },
    ...angles.map((a) => ({ label: a.label, position: a.position, target: a.target })),
  ];
}

const SCENE_OPTIONS: SceneOption[] = [
  { id: "desk",       label: "Desk",         description: "Wooden desk with books & plant" },
  { id: "wallShelf",  label: "Wall Shelf",    description: "Floating shelf in a living room" },
  { id: "pedestal",   label: "Gallery",       description: "Museum-style display pedestal" },
  { id: "bookshelf",  label: "Bookshelf",     description: "Nestled between books on a shelf" },
  { id: "windowSill", label: "Window Sill",   description: "Bathed in natural window light" },
];

/** SVG icons for each scene (small, inline) */
function SceneIcon({ sceneType, size = 24 }: { sceneType: SceneType; size?: number }) {
  const s = size;
  const stroke = "currentColor";
  const sw = 1.5;
  const common = { width: s, height: s, viewBox: "0 0 24 24", fill: "none", stroke, strokeWidth: sw, strokeLinecap: "round" as const, strokeLinejoin: "round" as const };

  switch (sceneType) {
    case "desk":
      return (
        <svg {...common}>
          <rect x="3" y="10" width="18" height="2" rx="0.5" />
          <line x1="5" y1="12" x2="5" y2="20" />
          <line x1="19" y1="12" x2="19" y2="20" />
          <rect x="8" y="5" width="8" height="5" rx="0.5" />
        </svg>
      );
    case "wallShelf":
      return (
        <svg {...common}>
          <line x1="2" y1="14" x2="22" y2="14" />
          <line x1="5" y1="14" x2="5" y2="18" />
          <line x1="19" y1="14" x2="19" y2="18" />
          <rect x="8" y="9" width="8" height="5" rx="0.5" />
          <rect x="16" y="4" width="5" height="7" rx="0.5" />
        </svg>
      );
    case "pedestal":
      return (
        <svg {...common}>
          <rect x="7" y="8" width="10" height="14" rx="0.5" />
          <rect x="5" y="7" width="14" height="2" rx="0.5" />
          <rect x="9" y="3" width="6" height="4" rx="0.5" />
        </svg>
      );
    case "bookshelf":
      return (
        <svg {...common}>
          <line x1="2" y1="4" x2="22" y2="4" />
          <line x1="2" y1="20" x2="22" y2="20" />
          <line x1="2" y1="4" x2="2" y2="20" />
          <line x1="22" y1="4" x2="22" y2="20" />
          <rect x="4" y="6" width="3" height="12" rx="0.3" />
          <rect x="7.5" y="7" width="2.5" height="11" rx="0.3" />
          <rect x="14" y="6" width="3" height="12" rx="0.3" />
          <rect x="17.5" y="7.5" width="2.5" height="10.5" rx="0.3" />
        </svg>
      );
    case "windowSill":
      return (
        <svg {...common}>
          <rect x="3" y="2" width="18" height="16" rx="0.5" />
          <line x1="12" y1="2" x2="12" y2="18" />
          <line x1="3" y1="10" x2="21" y2="10" />
          <line x1="2" y1="18" x2="22" y2="18" />
          <line x1="1" y1="20" x2="23" y2="20" />
        </svg>
      );
  }
}

interface Props {
  sceneData: SceneData;
  locationName: string;
  sceneType: SceneType;
  onSceneChange: (scene: SceneType) => void;
  onOpenViewer: () => void;
}

export default function ProductPage({ sceneData, locationName, sceneType, onSceneChange, onOpenViewer }: Props) {
  const displayName = locationName || "Your Selected Area";

  // Compute per-scene camera angles and render jobs
  const angles = useMemo(() => getAnglesForScene(sceneType), [sceneType]);
  const renderJobs = useMemo(() => getRenderJobs(sceneType), [sceneType]);

  // Sequential render-to-image state
  const [images, setImages] = useState<string[]>([]);
  const [readyForNext, setReadyForNext] = useState(true);
  // Track which sceneType the current images were rendered for
  const [renderedScene, setRenderedScene] = useState<SceneType>(sceneType);

  // Re-render all images when sceneType changes
  useEffect(() => {
    if (sceneType !== renderedScene) {
      setImages([]);
      setReadyForNext(true);
      setRenderedScene(sceneType);
    }
  }, [sceneType, renderedScene]);

  const currentIndex = images.length;
  const totalJobs = renderJobs.length;
  const isRendering = currentIndex < totalJobs;
  const shouldRender = isRendering && readyForNext;
  const currentJob = shouldRender ? renderJobs[currentIndex] : null;

  const handleCapture = useCallback((dataUrl: string) => {
    setReadyForNext(false);
    setImages((prev) => [...prev, dataUrl]);
    // Small delay to let previous WebGL context dispose before next mount
    setTimeout(() => setReadyForNext(true), 150);
  }, []);

  const heroImage = images[0] || null;
  const galleryImages = images.slice(1);

  return (
    <div style={{ background: "#faf9f7" }}>
      {/* Off-screen render Canvas — only ONE exists at any time */}
      {currentJob && (
        <div
          style={{
            position: "fixed",
            left: 0,
            top: 0,
            width: 800,
            height: 600,
            opacity: 0.001,
            pointerEvents: "none",
            zIndex: -1,
          }}
        >
          <CaptureRender
            sceneData={sceneData}
            sceneType={sceneType}
            cameraPosition={currentJob.position}
            cameraTarget={currentJob.target}
            onCapture={handleCapture}
          />
        </div>
      )}

      {/* ── Render progress bar ── */}
      {isRendering && (
        <div
          style={{
            padding: "14px 24px",
            textAlign: "center",
            background: "linear-gradient(180deg, #0f1729 0%, #1a2744 100%)",
            borderBottom: "1px solid #2a3f6a",
          }}
        >
          <div
            style={{
              fontSize: 13,
              fontWeight: 600,
              color: "#e2e8f0",
              marginBottom: 10,
              letterSpacing: 0.3,
            }}
          >
            Preparing views... {currentIndex + 1} of {totalJobs}
          </div>
          <div
            style={{
              height: 4,
              background: "rgba(255,255,255,0.1)",
              borderRadius: 2,
              maxWidth: 300,
              margin: "0 auto",
              overflow: "hidden",
            }}
          >
            <div
              style={{
                height: "100%",
                width: `${((currentIndex + 1) / totalJobs) * 100}%`,
                background: "#3b82f6",
                borderRadius: 2,
                transition: "width 0.3s ease",
              }}
            />
          </div>
        </div>
      )}

      {/* ── Hero Section ── */}
      <div
        style={{
          position: "relative",
          width: "100%",
          cursor: heroImage ? "pointer" : "default",
        }}
        onClick={heroImage ? onOpenViewer : undefined}
      >
        <div
          style={{
            width: "100%",
            aspectRatio: "16 / 10",
            background: "linear-gradient(165deg, #e8e2d8 0%, #d9d0c3 40%, #cfc5b7 100%)",
          }}
        >
          {heroImage ? (
            <img
              src={heroImage}
              alt={`${displayName} - hero view`}
              style={{
                width: "100%",
                height: "100%",
                objectFit: "cover",
                display: "block",
              }}
            />
          ) : (
            <div
              style={{
                width: "100%",
                height: "100%",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <div style={{ textAlign: "center", color: "#999" }}>
                <div style={spinnerSmallStyle} />
                <div style={{ marginTop: 8, fontSize: 13 }}>
                  Rendering hero view...
                </div>
              </div>
            </div>
          )}
        </div>
        {/* Tap-to-view overlay hint */}
        {heroImage && (
          <div
            style={{
              position: "absolute",
              bottom: 20,
              right: 20,
              background: "rgba(0,0,0,0.6)",
              backdropFilter: "blur(8px)",
              color: "#fff",
              padding: "10px 18px",
              borderRadius: 8,
              fontSize: 13,
              fontWeight: 500,
              letterSpacing: 0.3,
              display: "flex",
              alignItems: "center",
              gap: 8,
            }}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
              <circle cx="12" cy="12" r="3" />
            </svg>
            Tap to view in 3D
          </div>
        )}
      </div>

      {/* ── Scene Selector ── */}
      <div
        style={{
          maxWidth: 720,
          margin: "0 auto",
          padding: "28px 16px 0",
        }}
      >
        <p
          style={{
            fontSize: 11,
            fontWeight: 600,
            letterSpacing: 1.5,
            textTransform: "uppercase",
            color: "#9ca3af",
            marginBottom: 12,
            textAlign: "center",
          }}
        >
          Display scene
        </p>
        <div
          style={{
            display: "flex",
            gap: 8,
            justifyContent: "center",
            flexWrap: "wrap",
          }}
        >
          {SCENE_OPTIONS.map((opt) => {
            const isActive = sceneType === opt.id;
            return (
              <button
                key={opt.id}
                onClick={() => onSceneChange(opt.id)}
                disabled={isRendering && sceneType !== opt.id}
                title={opt.description}
                style={{
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  gap: 6,
                  padding: "10px 16px",
                  border: isActive ? "2px solid #3b82f6" : "2px solid #e5e5e5",
                  borderRadius: 10,
                  background: isActive ? "#eff6ff" : "#fff",
                  cursor: isRendering && !isActive ? "not-allowed" : "pointer",
                  opacity: isRendering && !isActive ? 0.5 : 1,
                  color: isActive ? "#3b82f6" : "#666",
                  fontSize: 12,
                  fontWeight: isActive ? 600 : 500,
                  transition: "all 0.15s ease",
                  minWidth: 80,
                  fontFamily: "inherit",
                }}
              >
                <SceneIcon sceneType={opt.id} size={22} />
                {opt.label}
              </button>
            );
          })}
        </div>
        {isRendering && (
          <p
            style={{
              textAlign: "center",
              fontSize: 11,
              color: "#9ca3af",
              marginTop: 8,
            }}
          >
            Rendering... scene options available when complete
          </p>
        )}
      </div>

      {/* ── Title + Intro ── */}
      <div style={{ maxWidth: 720, margin: "0 auto", padding: "48px 24px 0" }}>
        <div style={{ textAlign: "center", marginBottom: 48 }}>
          <p style={{ fontSize: 13, fontWeight: 600, letterSpacing: 2, textTransform: "uppercase", color: "#6b7280", marginBottom: 12 }}>
            Custom 3D City Model
          </p>
          <h1
            style={{
              fontSize: "clamp(28px, 5vw, 44px)",
              fontWeight: 700,
              color: "#1a1a2e",
              lineHeight: 1.15,
              marginBottom: 16,
            }}
          >
            {displayName}
          </h1>
          <p
            style={{
              fontSize: "clamp(15px, 2.5vw, 18px)",
              color: "#555",
              lineHeight: 1.6,
              maxWidth: 520,
              margin: "0 auto",
            }}
          >
            Every street, every building, every waterway — captured from real
            OpenStreetMap data and sculpted into a one-of-a-kind architectural model
            you can hold in your hands.
          </p>
        </div>

        {/* ── Spec Cards ── */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
            gap: 16,
            marginBottom: 56,
          }}
        >
          {[
            {
              icon: (
                <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#3b82f6" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="3" y="3" width="18" height="18" rx="2" />
                  <path d="M3 12h18M12 3v18" />
                </svg>
              ),
              title: "20cm x 20cm",
              desc: "Scaled to fit perfectly on a desk, shelf, or mantelpiece",
            },
            {
              icon: (
                <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#3b82f6" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M12 2L2 7l10 5 10-5-10-5z" />
                  <path d="M2 17l10 5 10-5" />
                  <path d="M2 12l10 5 10-5" />
                </svg>
              ),
              title: "Layer by layer",
              desc: "3D printed in high-detail PLA with a matte architectural finish",
            },
            {
              icon: (
                <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#3b82f6" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="1" y="3" width="15" height="13" rx="2" />
                  <path d="M16 8h2a2 2 0 012 2v6a2 2 0 01-2 2h-2" />
                  <path d="M8 21h8" />
                  <path d="M12 17v4" />
                </svg>
              ),
              title: "Ships in 5-7 days",
              desc: "Printed, inspected, and carefully packed just for you",
            },
          ].map((card, i) => (
            <div
              key={i}
              style={{
                background: "#fff",
                border: "1px solid #e8e5e0",
                borderRadius: 12,
                padding: "24px 20px",
                textAlign: "center",
              }}
            >
              <div style={{ marginBottom: 12 }}>{card.icon}</div>
              <div style={{ fontWeight: 700, fontSize: 16, color: "#1a1a2e", marginBottom: 6 }}>
                {card.title}
              </div>
              <div style={{ fontSize: 13, color: "#777", lineHeight: 1.5 }}>
                {card.desc}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* ── Gallery: multi-angle views (rendered as images, not live Canvases) ── */}
      <div style={{ maxWidth: 900, margin: "0 auto", padding: "0 24px 56px" }}>
        <p
          style={{
            fontSize: 13,
            fontWeight: 600,
            letterSpacing: 2,
            textTransform: "uppercase",
            color: "#6b7280",
            marginBottom: 20,
            textAlign: "center",
          }}
        >
          From every angle
        </p>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))",
            gap: 16,
          }}
        >
          {angles.map((angle, i) => (
            <div
              key={i}
              onClick={galleryImages[i] ? onOpenViewer : undefined}
              style={{
                borderRadius: 12,
                overflow: "hidden",
                cursor: galleryImages[i] ? "pointer" : "default",
                position: "relative",
                border: "1px solid #e8e5e0",
              }}
            >
              <div
                style={{
                  aspectRatio: "4 / 3",
                  background: "linear-gradient(165deg, #e8e2d8 0%, #d9d0c3 40%, #cfc5b7 100%)",
                }}
              >
                {galleryImages[i] ? (
                  <img
                    src={galleryImages[i]}
                    alt={angle.label}
                    style={{
                      width: "100%",
                      height: "100%",
                      objectFit: "cover",
                      display: "block",
                    }}
                  />
                ) : (
                  <div
                    style={{
                      width: "100%",
                      height: "100%",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                    }}
                  >
                    <div style={{ textAlign: "center", color: "#b0a89e" }}>
                      <div style={spinnerSmallStyle} />
                    </div>
                  </div>
                )}
              </div>
              <div
                style={{
                  position: "absolute",
                  bottom: 0,
                  left: 0,
                  right: 0,
                  padding: "24px 14px 10px",
                  background: "linear-gradient(to top, rgba(0,0,0,0.45), transparent)",
                  color: "#fff",
                  fontSize: 12,
                  fontWeight: 500,
                  letterSpacing: 0.3,
                }}
              >
                {angle.label}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* ── Model stats ── */}
      <div
        style={{
          background: "#1a1a2e",
          padding: "48px 24px",
          color: "#fff",
          textAlign: "center",
        }}
      >
        <p
          style={{
            fontSize: 13,
            fontWeight: 600,
            letterSpacing: 2,
            textTransform: "uppercase",
            color: "rgba(255,255,255,0.5)",
            marginBottom: 28,
          }}
        >
          What's inside your model
        </p>
        <div
          style={{
            display: "flex",
            justifyContent: "center",
            gap: "clamp(24px, 6vw, 64px)",
            flexWrap: "wrap",
          }}
        >
          {[
            { value: sceneData.buildings.length, label: "Buildings" },
            { value: sceneData.roads.length, label: "Road segments" },
            { value: sceneData.water.length, label: "Water features" },
            {
              value: `${Math.round(sceneData.modelWidthMm)}x${Math.round(sceneData.modelDepthMm)}`,
              label: "Print size (mm)",
            },
          ].map((stat, i) => (
            <div key={i} style={{ minWidth: 80 }}>
              <div
                style={{
                  fontSize: "clamp(28px, 4vw, 40px)",
                  fontWeight: 700,
                  lineHeight: 1.2,
                }}
              >
                {stat.value}
              </div>
              <div
                style={{
                  fontSize: 12,
                  color: "rgba(255,255,255,0.5)",
                  marginTop: 4,
                  letterSpacing: 0.3,
                }}
              >
                {stat.label}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* ── Description copy ── */}
      <div style={{ maxWidth: 640, margin: "0 auto", padding: "56px 24px" }}>
        <h2
          style={{
            fontSize: "clamp(22px, 3.5vw, 32px)",
            fontWeight: 700,
            color: "#1a1a2e",
            marginBottom: 20,
            lineHeight: 1.2,
          }}
        >
          A piece of the city, made real
        </h2>
        <div style={{ fontSize: 15, color: "#555", lineHeight: 1.8 }}>
          <p style={{ marginBottom: 16 }}>
            This isn't a generic souvenir. It's <em>your</em> selection — the
            exact neighbourhood, the precise streets, the buildings you chose.
            We pull the geometry straight from OpenStreetMap, scale it down to
            a 200mm base plate, and print it layer by layer in premium PLA
            filament.
          </p>
          <p style={{ marginBottom: 16 }}>
            The raised buildings cast real shadows. The roads sit recessed into
            the base. Water features are subtly inset. The whole model sits in
            a clean dark frame, ready to display. No painting required, no
            assembly — just unbox and place.
          </p>
          <p>
            Whether it's the neighbourhood you grew up in, the city where you
            got married, or the view from your favourite cafe — now you can pick
            it up and hold it.
          </p>
        </div>
      </div>

      {/* ── Final CTA ── */}
      <div
        style={{
          textAlign: "center",
          padding: "0 24px 64px",
        }}
      >
        <button
          onClick={onOpenViewer}
          style={{
            padding: "16px 40px",
            background: "#3b82f6",
            color: "#fff",
            border: "none",
            borderRadius: 10,
            cursor: "pointer",
            fontSize: 16,
            fontWeight: 600,
            letterSpacing: 0.3,
          }}
        >
          View your model in 3D
        </button>
        <p style={{ marginTop: 12, fontSize: 13, color: "#999" }}>
          Checkout coming soon
        </p>
      </div>

      {/* Spinner keyframe (shared) */}
      <style>{`
        @keyframes spinSmall {
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
}

const spinnerSmallStyle: React.CSSProperties = {
  width: 24,
  height: 24,
  border: "2.5px solid #ddd",
  borderTopColor: "#999",
  borderRadius: "50%",
  margin: "0 auto",
  animation: "spinSmall 0.8s linear infinite",
};
