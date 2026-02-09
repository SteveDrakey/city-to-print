import { useEffect, useRef, useState } from "react";

/** Funky messages shown while waiting */
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

const LONG_WAIT_MESSAGES = [
  "This is taking much longer than usual...",
  "The server seems really busy right now...",
  "Still trying — hang tight!",
  "We haven't given up yet!",
  "Patience of a saint required...",
  "Almost there... probably...",
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
  const retryBannerRef = useRef<HTMLDivElement>(null);

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

  // Scroll retry banner into view when it appears or updates
  useEffect(() => {
    if (retryAttempt > 0 && retryBannerRef.current) {
      retryBannerRef.current.scrollIntoView({ behavior: "smooth", block: "center" });
    }
  }, [retryAttempt]);

  const isRetrying = retryAttempt > 0;
  const isTakingLong = retryAttempt >= 5;
  const retryMsg = isTakingLong
    ? LONG_WAIT_MESSAGES[(retryAttempt - 5) % LONG_WAIT_MESSAGES.length]
    : RETRY_MESSAGES[(retryAttempt - 1) % RETRY_MESSAGES.length];

  // Celestial progress: 0 (initial) to 1 (max retries reached)
  const progress = Math.min(retryAttempt / Math.max(maxRetries, 1), 1);

  // ── Moon: arcs from upper-right across to lower-left, sets around 70% ──
  const moonPhase = Math.min(progress / 0.7, 1);
  const moonLeft = 75 - moonPhase * 60;
  const moonTop = 10 + Math.sin(moonPhase * Math.PI) * -8 + moonPhase * 65;
  const moonOpacity = moonPhase < 0.8 ? 1 : Math.max(0, 1 - (moonPhase - 0.8) / 0.2);

  // ── Sun: rises from the horizon starting around progress 0.35 ──
  const sunThreshold = 0.35;
  const sunPhase = progress > sunThreshold
    ? (progress - sunThreshold) / (1 - sunThreshold)
    : 0;
  const sunTop = 85 - sunPhase * 60;
  const sunLeft = 70 + sunPhase * 5;
  const sunOpacity = Math.min(sunPhase * 2.5, 1);
  const sunScale = 0.4 + sunPhase * 0.6;

  // ── Stars fade out as dawn approaches ──
  const starOpacity = progress < 0.3
    ? 1
    : Math.max(0, 1 - (progress - 0.3) / 0.35);

  // ── Sky overlays ──
  const dawnGlow = progress > 0.2
    ? Math.min((progress - 0.2) / 0.4, 1)
    : 0;
  const sunriseGlow = progress > 0.5
    ? Math.min((progress - 0.5) / 0.5, 1)
    : 0;

  const skylineWidth = BUILDING_COUNT * 22;
  const progressPct = ((retryAttempt + 1) / (maxRetries + 1)) * 100;

  return (
    <div
      style={{
        padding: "48px 24px 32px",
        textAlign: "center",
        background:
          "linear-gradient(180deg, #0f1729 0%, #1a2744 40%, #2a3f6a 100%)",
        overflow: "hidden",
        position: "relative",
      }}
    >
      {/* Dawn sky overlay */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          background:
            "linear-gradient(180deg, #1a1040 0%, #4a2050 40%, #c05535 100%)",
          opacity: dawnGlow * 0.7,
          transition: "opacity 3s ease",
          pointerEvents: "none",
        }}
      />

      {/* Sunrise sky overlay */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          background:
            "linear-gradient(180deg, #3a5a8a 0%, #8a90c0 35%, #f0b86a 100%)",
          opacity: sunriseGlow * 0.85,
          transition: "opacity 3s ease",
          pointerEvents: "none",
        }}
      />

      {/* Horizon glow (warm radial near bottom) */}
      {dawnGlow > 0 && (
        <div
          style={{
            position: "absolute",
            bottom: 0,
            left: 0,
            right: 0,
            height: "55%",
            background: `radial-gradient(ellipse 130% 55% at 70% 100%, rgba(255,140,50,${dawnGlow * 0.4}) 0%, transparent 70%)`,
            transition: "all 3s ease",
            pointerEvents: "none",
            zIndex: 1,
          }}
        />
      )}

      {/* Stars — fade out at dawn */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          overflow: "hidden",
          opacity: starOpacity,
          transition: "opacity 3s ease",
        }}
      >
        {Array.from({ length: 20 }, (_, i) => (
          <div
            key={i}
            style={{
              position: "absolute",
              width: 2,
              height: 2,
              background: "#fff",
              borderRadius: "50%",
              top: `${5 + ((i * 37) % 35)}%`,
              left: `${((i * 53 + 17) % 100)}%`,
              opacity: 0.3 + (i % 3) * 0.3,
              animation: `starTwinkle ${1.5 + (i % 3) * 0.7}s ease-in-out infinite alternate`,
              animationDelay: `${i * 0.2}s`,
            }}
          />
        ))}
      </div>

      {/* Moon — arcs across the sky and sets */}
      <div
        style={{
          position: "absolute",
          top: `${moonTop}%`,
          left: `${moonLeft}%`,
          width: 32,
          height: 32,
          borderRadius: "50%",
          background:
            "radial-gradient(circle at 40% 40%, #fef3c7, #fbbf24)",
          boxShadow: `0 0 20px 4px rgba(251,191,36,${0.3 * moonOpacity})`,
          opacity: moonOpacity,
          transform: "translate(-50%, -50%)",
          transition: "top 3s ease, left 3s ease, opacity 2s ease",
          animation: "moonFloat 4s ease-in-out infinite",
          zIndex: 2,
        }}
      />

      {/* Sun — rises from the horizon */}
      <div
        style={{
          position: "absolute",
          top: `${sunTop}%`,
          left: `${sunLeft}%`,
          width: 44,
          height: 44,
          borderRadius: "50%",
          background:
            "radial-gradient(circle at 45% 45%, #fff9e6, #fbbf24, #f59e0b)",
          boxShadow: `0 0 ${30 + sunPhase * 40}px ${10 + sunPhase * 20}px rgba(251,191,36,${0.3 * sunOpacity}), 0 0 ${60 + sunPhase * 60}px ${30 + sunPhase * 30}px rgba(245,158,11,${0.15 * sunOpacity})`,
          opacity: sunOpacity,
          transform: `translate(-50%, -50%) scale(${sunScale})`,
          transition:
            "top 3s ease, left 3s ease, opacity 2s ease, transform 3s ease, box-shadow 3s ease",
          animation: sunOpacity > 0 ? "sunPulse 3s ease-in-out infinite" : "none",
          zIndex: 2,
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
          zIndex: 3,
        }}
      >
        <svg
          width={skylineWidth}
          height="100"
          viewBox={`0 0 ${skylineWidth} 100`}
          style={{ overflow: "visible" }}
        >
          {/* Ground line */}
          <rect
            x="-10"
            y="98"
            width={skylineWidth + 20}
            height="4"
            rx="1"
            fill="#1e3a5f"
          />

          {BUILDINGS.map((b, i) => (
            <g key={i}>
              {/* Building body — grows upward, warms with sunrise */}
              <rect
                x={b.x}
                y={100 - b.maxHeight}
                width={b.width}
                height={b.maxHeight}
                rx="1"
                fill={`hsl(${b.hue + sunriseGlow * 20}, ${40 + sunriseGlow * 10}%, ${35 + sunriseGlow * 10}%)`}
                stroke={`hsl(${b.hue + sunriseGlow * 15}, 30%, 25%)`}
                strokeWidth="0.5"
                style={{
                  transformOrigin: `${b.x + b.width / 2}px 100px`,
                  animation: `buildingRise 1.8s cubic-bezier(0.34, 1.56, 0.64, 1) ${b.delay}s both`,
                  transition: "fill 3s ease, stroke 3s ease",
                }}
              />
              {/* Lit windows */}
              {Array.from({ length: b.windowRows }, (_, row) => (
                <rect
                  key={row}
                  x={b.x + 3}
                  y={
                    100 -
                    b.maxHeight +
                    6 +
                    row * (b.maxHeight / (b.windowRows + 1))
                  }
                  width={b.width - 6}
                  height={3}
                  rx="0.5"
                  fill={sunriseGlow > 0.5 ? "#ffe4b5" : "#fbbf24"}
                  opacity="0.7"
                  style={{
                    transformOrigin: `${b.x + b.width / 2}px 100px`,
                    animation: `buildingRise 1.8s cubic-bezier(0.34, 1.56, 0.64, 1) ${b.delay}s both, windowGlow 2s ease-in-out ${b.delay + 1.8}s infinite alternate`,
                    transition: "fill 3s ease",
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
              {/* Crane on some buildings */}
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
          color: sunriseGlow > 0.5 ? "#3d2b1a" : "#e2e8f0",
          letterSpacing: 0.3,
          position: "relative",
          zIndex: 4,
          minHeight: 24,
          transition: "color 3s ease",
        }}
      >
        {BUILDING_MESSAGES[msgIndex]}
        {dots}
      </div>

      {/* Retry banner */}
      {isRetrying && (
        <div
          ref={retryBannerRef}
          style={{
            marginTop: 16,
            padding: "12px 20px",
            background: isTakingLong
              ? "rgba(239, 68, 68, 0.15)"
              : "rgba(251, 191, 36, 0.15)",
            border: `1px solid ${isTakingLong ? "rgba(239, 68, 68, 0.3)" : "rgba(251, 191, 36, 0.3)"}`,
            borderRadius: 10,
            display: "inline-block",
            animation: "retrySlideIn 0.5s cubic-bezier(0.34, 1.56, 0.64, 1)",
            position: "relative",
            zIndex: 4,
            transition: "background 0.5s ease, border-color 0.5s ease",
          }}
        >
          {/* Long-wait warning label */}
          {isTakingLong && (
            <div
              style={{
                fontSize: 11,
                color: "#f87171",
                fontWeight: 700,
                textTransform: "uppercase",
                letterSpacing: 1,
                marginBottom: 6,
                animation: "retrySlideIn 0.5s ease",
              }}
            >
              Taking much longer than expected
            </div>
          )}
          <div
            style={{
              fontSize: 14,
              color: isTakingLong ? "#fca5a5" : "#fbbf24",
              fontWeight: 600,
            }}
          >
            {retryMsg}
          </div>
          <div style={{ fontSize: 12, color: "#94a3b8", marginTop: 4 }}>
            Attempt {retryAttempt + 1} of {maxRetries + 1}
          </div>
          {/* Progress bar */}
          <div
            style={{
              marginTop: 8,
              height: 4,
              borderRadius: 2,
              background: "rgba(148,163,184,0.2)",
              overflow: "hidden",
              width: 140,
              marginLeft: "auto",
              marginRight: "auto",
            }}
          >
            <div
              style={{
                height: "100%",
                borderRadius: 2,
                background: isTakingLong
                  ? "linear-gradient(90deg, #f87171, #ef4444)"
                  : "linear-gradient(90deg, #fbbf24, #f59e0b)",
                width: `${progressPct}%`,
                transition: "width 0.5s ease, background 0.5s ease",
              }}
            />
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
        @keyframes moonFloat {
          0%, 100% { transform: translate(-50%, -50%) translateY(0); }
          50%      { transform: translate(-50%, -50%) translateY(-3px); }
        }
        @keyframes sunPulse {
          0%, 100% { filter: brightness(1); }
          50%      { filter: brightness(1.15); }
        }
      `}</style>
    </div>
  );
}
