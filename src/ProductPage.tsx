import { useState, useCallback } from "react";
import { CaptureRender } from "./ModelPreview";
import CheckoutSection from "./CheckoutSection";
import type { SceneData } from "./types";

/** Camera angles for the product gallery shots. */
const ANGLES: {
  label: string;
  position: [number, number, number];
  target: [number, number, number];
}[] = [
  {
    label: "Front view",
    position: [0, 120, 380],
    target: [0, 20, 0],
  },
  {
    label: "Three-quarter view",
    position: [250, 180, 300],
    target: [0, 20, 0],
  },
  {
    label: "Side view",
    position: [380, 100, 0],
    target: [0, 20, 0],
  },
  {
    label: "Top-down view",
    position: [0, 400, 40],
    target: [0, 0, 0],
  },
];

/**
 * Render jobs: hero first (three-quarter angle), then the 4 gallery angles.
 * Only ONE Canvas exists at a time — each is captured to a JPEG image,
 * then the Canvas is unmounted before the next one starts.
 */
const RENDER_JOBS = [
  { label: "Hero", position: ANGLES[1].position, target: ANGLES[1].target },
  ...ANGLES.map((a) => ({ label: a.label, position: a.position, target: a.target })),
];

interface Props {
  sceneData: SceneData;
  locationName: string;
  areaDescription?: string;
  onOpenViewer: () => void;
}

/** Truncate text to a maximum number of sentences for a concise blurb. */
function truncateToSentences(text: string, max = 3): string {
  const sentences = text.match(/[^.!?]+[.!?]+/g);
  if (!sentences) return text;
  return sentences.slice(0, max).join(" ").trim();
}

export default function ProductPage({ sceneData, locationName, areaDescription, onOpenViewer }: Props) {
  const displayName = locationName || "Your Selected Area";

  // Sequential render-to-image state
  const [images, setImages] = useState<string[]>([]);
  const [readyForNext, setReadyForNext] = useState(true);

  const currentIndex = images.length;
  const totalJobs = RENDER_JOBS.length;
  const isRendering = currentIndex < totalJobs;
  const shouldRender = isRendering && readyForNext;
  const currentJob = shouldRender ? RENDER_JOBS[currentIndex] : null;

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

        {/* ── About the area (from Wikipedia) ── */}
        {areaDescription && (
          <div
            style={{
              background: "#f5f3f0",
              borderRadius: 12,
              padding: "24px 28px",
              marginBottom: 48,
              borderLeft: "3px solid #3b82f6",
            }}
          >
            <p
              style={{
                fontSize: 13,
                fontWeight: 600,
                letterSpacing: 1.5,
                textTransform: "uppercase",
                color: "#6b7280",
                marginBottom: 12,
              }}
            >
              About {displayName}
            </p>
            <p
              style={{
                fontSize: 15,
                color: "#444",
                lineHeight: 1.7,
                margin: 0,
              }}
            >
              {truncateToSentences(areaDescription)}
            </p>
            <p
              style={{
                fontSize: 11,
                color: "#aaa",
                marginTop: 10,
                marginBottom: 0,
              }}
            >
              Source: Wikipedia
            </p>
          </div>
        )}

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
          {ANGLES.map((angle, i) => (
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

      {/* ── 3D Viewer CTA ── */}
      <div
        style={{
          textAlign: "center",
          padding: "0 24px 48px",
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
      </div>

      {/* ── Checkout ── */}
      <CheckoutSection heroImage={heroImage} locationName={displayName} />

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
