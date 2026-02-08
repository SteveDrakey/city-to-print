import { useEffect, useState } from "react";

/** Funky messages shown while waiting or retrying */
const BUILDING_MESSAGES = [
  "Laying the foundations...",
  "Pouring the concrete...",
  "Raising the skyline...",
  "Wiring up the streets...",
  "Planting some trees...",
  "Adding the finishing touches...",
];

const RETRY_MESSAGES = [
  "City planners took a coffee break... trying again!",
  "The cranes need a tune-up... one more go!",
  "Construction crew got lost... rerouting!",
  "Blueprint got blown away... reprinting!",
  "Hard hats misplaced... found 'em!",
  "Permit office was slow... sorted now!",
];

interface Props {
  /** Current retry attempt (0 = first try, 1+ = retrying) */
  retryAttempt: number;
  /** Total max retries */
  maxRetries: number;
}

/** Number of buildings in the skyline */
const BUILDING_COUNT = 12;

/** Pre-defined building properties so they don't change on re-render */
const BUILDINGS = Array.from({ length: BUILDING_COUNT }, (_, i) => ({
  width: 14 + Math.sin(i * 2.7) * 8,
  maxHeight: 30 + Math.sin(i * 1.3 + 1) * 25 + Math.cos(i * 0.7) * 15,
  x: i * 22,
  hue: 210 + Math.sin(i * 1.1) * 30,
  delay: i * 0.15,
  windowRows: 2 + Math.floor(Math.sin(i * 1.3 + 1) * 1.5 + 1.5),
}));

export default function CityLoadingAnimation({ retryAttempt, maxRetries }: Props) {
  const [msgIndex, setMsgIndex] = useState(0);
  const [dots, setDots] = useState("");

  // Cycle through building messages
  useEffect(() => {
    const interval = setInterval(() => {
      setMsgIndex((prev) => (prev + 1) % BUILDING_MESSAGES.length);
    }, 2200);
    return () => clearInterval(interval);
  }, []);

  // Animate dots
  useEffect(() => {
    const interval = setInterval(() => {
      setDots((prev) => (prev.length >= 3 ? "" : prev + "."));
    }, 400);
    return () => clearInterval(interval);
  }, []);

  const isRetrying = retryAttempt > 0;
  const retryMsg = RETRY_MESSAGES[(retryAttempt - 1) % RETRY_MESSAGES.length];

  const skylineWidth = BUILDING_COUNT * 22;

  return (
    <div
      style={{
        padding: "48px 24px 56px",
        textAlign: "center",
        background: "linear-gradient(180deg, #0f1729 0%, #1a2744 40%, #2a3f6a 100%)",
        overflow: "hidden",
        position: "relative",
      }}
    >
      {/* Stars */}
      <div style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0, overflow: "hidden" }}>
        {Array.from({ length: 20 }, (_, i) => (
          <div
            key={i}
            style={{
              position: "absolute",
              width: 2,
              height: 2,
              background: "#fff",
              borderRadius: "50%",
              top: `${5 + (i * 37) % 35}%`,
              left: `${(i * 53 + 17) % 100}%`,
              opacity: 0.3 + (i % 3) * 0.3,
              animation: `starTwinkle ${1.5 + (i % 3) * 0.7}s ease-in-out infinite alternate`,
              animationDelay: `${i * 0.2}s`,
            }}
          />
        ))}
      </div>

      {/* Moon */}
      <div
        style={{
          position: "absolute",
          top: 20,
          right: "15%",
          width: 32,
          height: 32,
          borderRadius: "50%",
          background: "radial-gradient(circle at 40% 40%, #fef3c7, #fbbf24)",
          boxShadow: "0 0 20px 4px rgba(251,191,36,0.3)",
        }}
      />

      {/* Animated city skyline */}
      <div
        style={{
          display: "flex",
          justifyContent: "center",
          alignItems: "flex-end",
          height: 100,
          position: "relative",
          zIndex: 1,
        }}
      >
        <svg
          width={skylineWidth}
          height="100"
          viewBox={`0 0 ${skylineWidth} 100`}
          style={{ overflow: "visible" }}
        >
          {/* Ground line */}
          <rect x="-10" y="98" width={skylineWidth + 20} height="4" rx="1" fill="#1e3a5f" />

          {BUILDINGS.map((b, i) => (
            <g key={i}>
              {/* Building body — grows upward */}
              <rect
                x={b.x}
                y={100 - b.maxHeight}
                width={b.width}
                height={b.maxHeight}
                rx="1"
                fill={`hsl(${b.hue}, 40%, 35%)`}
                stroke={`hsl(${b.hue}, 30%, 25%)`}
                strokeWidth="0.5"
                style={{
                  transformOrigin: `${b.x + b.width / 2}px 100px`,
                  animation: `buildingRise 1.8s cubic-bezier(0.34, 1.56, 0.64, 1) ${b.delay}s both`,
                }}
              />
              {/* Lit windows */}
              {Array.from({ length: b.windowRows }, (_, row) => (
                <rect
                  key={row}
                  x={b.x + 3}
                  y={100 - b.maxHeight + 6 + row * (b.maxHeight / (b.windowRows + 1))}
                  width={b.width - 6}
                  height={3}
                  rx="0.5"
                  fill="#fbbf24"
                  opacity="0.7"
                  style={{
                    transformOrigin: `${b.x + b.width / 2}px 100px`,
                    animation: `buildingRise 1.8s cubic-bezier(0.34, 1.56, 0.64, 1) ${b.delay}s both, windowGlow 2s ease-in-out ${b.delay + 1.8}s infinite alternate`,
                  }}
                />
              ))}
              {/* Antenna on tall buildings */}
              {b.maxHeight > 45 && (
                <line
                  x1={b.x + b.width / 2}
                  y1={100 - b.maxHeight - 8}
                  x2={b.x + b.width / 2}
                  y2={100 - b.maxHeight}
                  stroke="#94a3b8"
                  strokeWidth="1"
                  style={{
                    transformOrigin: `${b.x + b.width / 2}px ${100 - b.maxHeight}px`,
                    animation: `buildingRise 0.6s ease-out ${b.delay + 1.6}s both`,
                  }}
                />
              )}
              {/* Crane on some buildings (during construction feel) */}
              {i % 4 === 1 && (
                <g
                  style={{
                    animation: `craneSway 3s ease-in-out ${b.delay}s infinite alternate`,
                    transformOrigin: `${b.x + b.width / 2}px ${100 - b.maxHeight}px`,
                  }}
                >
                  <line
                    x1={b.x + b.width / 2}
                    y1={100 - b.maxHeight - 15}
                    x2={b.x + b.width / 2}
                    y2={100 - b.maxHeight}
                    stroke="#f59e0b"
                    strokeWidth="1.5"
                    style={{
                      animation: `buildingRise 0.5s ease-out ${b.delay + 1.5}s both`,
                    }}
                  />
                  <line
                    x1={b.x + b.width / 2 - 12}
                    y1={100 - b.maxHeight - 15}
                    x2={b.x + b.width / 2 + 12}
                    y2={100 - b.maxHeight - 15}
                    stroke="#f59e0b"
                    strokeWidth="1"
                    style={{
                      animation: `buildingRise 0.5s ease-out ${b.delay + 1.8}s both`,
                    }}
                  />
                  {/* Hanging cable */}
                  <line
                    x1={b.x + b.width / 2 + 10}
                    y1={100 - b.maxHeight - 15}
                    x2={b.x + b.width / 2 + 10}
                    y2={100 - b.maxHeight - 6}
                    stroke="#94a3b8"
                    strokeWidth="0.5"
                    strokeDasharray="2,1"
                    style={{
                      animation: `buildingRise 0.5s ease-out ${b.delay + 2}s both`,
                    }}
                  />
                </g>
              )}
            </g>
          ))}
        </svg>
      </div>

      {/* Status message */}
      <div
        style={{
          marginTop: 28,
          fontSize: 16,
          fontWeight: 600,
          color: "#e2e8f0",
          letterSpacing: 0.3,
          position: "relative",
          zIndex: 1,
          minHeight: 24,
        }}
      >
        {BUILDING_MESSAGES[msgIndex]}{dots}
      </div>

      {/* Retry banner */}
      {isRetrying && (
        <div
          style={{
            marginTop: 16,
            padding: "10px 20px",
            background: "rgba(251, 191, 36, 0.15)",
            border: "1px solid rgba(251, 191, 36, 0.3)",
            borderRadius: 10,
            display: "inline-block",
            animation: "retrySlideIn 0.5s cubic-bezier(0.34, 1.56, 0.64, 1)",
            position: "relative",
            zIndex: 1,
          }}
        >
          <div style={{ fontSize: 14, color: "#fbbf24", fontWeight: 600 }}>
            {retryMsg}
          </div>
          <div style={{ fontSize: 12, color: "#94a3b8", marginTop: 4 }}>
            Attempt {retryAttempt + 1} of {maxRetries + 1}
          </div>
          {/* Progress dots */}
          <div style={{ display: "flex", justifyContent: "center", gap: 6, marginTop: 8 }}>
            {Array.from({ length: maxRetries + 1 }, (_, i) => (
              <div
                key={i}
                style={{
                  width: 8,
                  height: 8,
                  borderRadius: "50%",
                  background: i <= retryAttempt ? "#fbbf24" : "rgba(148,163,184,0.3)",
                  transition: "background 0.3s ease",
                }}
              />
            ))}
          </div>
        </div>
      )}

      {/* CSS Animations */}
      <style>{`
        @keyframes buildingRise {
          from { transform: scaleY(0); }
          to   { transform: scaleY(1); }
        }
        @keyframes windowGlow {
          from { opacity: 0.4; }
          to   { opacity: 0.9; }
        }
        @keyframes starTwinkle {
          from { opacity: 0.15; }
          to   { opacity: 0.8; }
        }
        @keyframes craneSway {
          from { transform: rotate(-2deg); }
          to   { transform: rotate(2deg); }
        }
        @keyframes retrySlideIn {
          from { opacity: 0; transform: translateY(10px) scale(0.95); }
          to   { opacity: 1; transform: translateY(0) scale(1); }
        }
      `}</style>
    </div>
  );
}
