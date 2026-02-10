import { useState, useCallback, useEffect, useRef, lazy, Suspense } from "react";
import CheckoutSection from "./CheckoutSection";
import type { SceneData, Bounds } from "./types";

/** Lazy-load CaptureRender — keeps Three.js out of the main bundle until needed. */
const LazyCaptureRender = lazy(() =>
  import("./ModelPreview").then((m) => ({ default: m.CaptureRender }))
);

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
  bounds: Bounds | null;
  onOpenViewer: () => void;
}

/** Truncate text to a maximum number of sentences for a concise blurb. */
function truncateToSentences(text: string, max = 3): string {
  const sentences = text.match(/[^.!?]+[.!?]+/g);
  if (!sentences) return text;
  return sentences.slice(0, max).join(" ").trim();
}

export default function ProductPage({ sceneData, locationName, areaDescription, bounds, onOpenViewer }: Props) {
  const displayName = locationName || "Your Selected Area";

  // Sequential render-to-image state
  const [images, setImages] = useState<string[]>([]);
  const [readyForNext, setReadyForNext] = useState(true);

  // Reset gallery when sceneData changes (user generated a new city).
  // Also revoke old blob URLs to free memory from previous data-URL images.
  const prevSceneRef = useRef(sceneData);
  useEffect(() => {
    if (prevSceneRef.current !== sceneData) {
      prevSceneRef.current = sceneData;
      setImages([]);
      setReadyForNext(true);
    }
  }, [sceneData]);

  const heroImage = images[0] || null;
  const galleryImages = images.slice(1);

  const currentIndex = images.length;
  const totalJobs = RENDER_JOBS.length;
  const isRendering = currentIndex < totalJobs;
  const shouldRender = currentIndex < totalJobs && readyForNext;
  const currentJob = shouldRender ? RENDER_JOBS[currentIndex] : null;

  const handleCapture = useCallback((dataUrl: string) => {
    setReadyForNext(false);
    setImages((prev) => [...prev, dataUrl]);
    // Delay between unmounting the current Canvas and mounting the next one
    // so the browser can reclaim GPU memory. 400ms works reliably on mobile.
    setTimeout(() => setReadyForNext(true), 400);
  }, []);

  return (
    <div className="bg-[#faf9f7]">
      {/* Off-screen render Canvas — only ONE exists at any time */}
      {currentJob && (
        <Suspense fallback={null}>
          <div className="fixed left-0 top-0 w-[1200px] h-[900px] opacity-[0.001] pointer-events-none -z-10">
            <LazyCaptureRender
              sceneData={sceneData}
              cameraPosition={currentJob.position}
              cameraTarget={currentJob.target}
              onCapture={handleCapture}
            />
          </div>
        </Suspense>
      )}

      {/* ── Render progress bar ── */}
      {isRendering && (
        <div
          className="px-6 py-3.5 text-center border-b border-[#2a3f6a]"
          style={{
            background: "linear-gradient(180deg, #0f1729 0%, #1a2744 100%)",
          }}
        >
          <div className="text-[13px] font-semibold text-slate-200 mb-2.5 tracking-wide">
            Preparing views... {currentIndex + 1} of {totalJobs}
          </div>
          <div className="h-1 bg-white/10 rounded-sm max-w-[300px] mx-auto overflow-hidden">
            <div
              className="h-full bg-blue-500 rounded-sm transition-[width] duration-300 ease-out"
              style={{ width: `${((currentIndex + 1) / totalJobs) * 100}%` }}
            />
          </div>
        </div>
      )}

      {/* ── Hero Section ── */}
      <div
        className={`relative w-full ${heroImage ? "cursor-pointer" : ""}`}
        onClick={heroImage ? onOpenViewer : undefined}
      >
        <div
          className="w-full aspect-[16/10]"
          style={{
            background: "linear-gradient(165deg, #e8e2d8 0%, #d9d0c3 40%, #cfc5b7 100%)",
          }}
        >
          {heroImage ? (
            <img
              src={heroImage}
              alt={`${displayName} - hero view`}
              className="w-full h-full object-cover block"
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center">
              <div className="text-center text-gray-400">
                <div className="w-6 h-6 border-[2.5px] border-gray-300 border-t-gray-500 rounded-full mx-auto animate-[spinSmall_0.8s_linear_infinite]" />
                <div className="mt-2 text-[13px]">
                  Rendering hero view...
                </div>
              </div>
            </div>
          )}
        </div>
        {/* Tap-to-view overlay hint */}
        {heroImage && (
          <div className="absolute bottom-5 right-5 bg-black/60 backdrop-blur-lg text-white px-[18px] py-2.5 rounded-lg text-[13px] font-medium tracking-wide flex items-center gap-2">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
              <circle cx="12" cy="12" r="3" />
            </svg>
            Tap to view in 3D
          </div>
        )}
      </div>

      {/* ── Title + Intro ── */}
      <div className="max-w-[720px] mx-auto px-6 pt-12">
        <div className="text-center mb-12">
          <p className="text-[13px] font-semibold tracking-[2px] uppercase text-gray-500 mb-3">
            Custom 3D City Model
          </p>
          <h1 className="text-[clamp(28px,5vw,44px)] font-bold text-[#1a1a2e] leading-[1.15] mb-4">
            {displayName}
          </h1>
          <p className="text-[clamp(15px,2.5vw,18px)] text-gray-600 leading-relaxed max-w-[520px] mx-auto">
            Every street, every building, every waterway — captured from real
            OpenStreetMap data and sculpted into a one-of-a-kind architectural model
            you can hold in your hands.
          </p>
        </div>

        {/* ── About the area (from Wikipedia) ── */}
        {areaDescription && (
          <div className="bg-[#f5f3f0] rounded-xl px-7 py-6 mb-12 border-l-[3px] border-blue-500">
            <p className="text-[13px] font-semibold tracking-[1.5px] uppercase text-gray-500 mb-3">
              About {displayName}
            </p>
            <p className="text-[15px] text-gray-700 leading-[1.7] m-0">
              {truncateToSentences(areaDescription)}
            </p>
            <p className="text-[11px] text-gray-400 mt-2.5 mb-0">
              Source: Wikipedia
            </p>
          </div>
        )}

        {/* ── Spec Cards ── */}
        <div className="grid grid-cols-[repeat(auto-fit,minmax(180px,1fr))] gap-4 mb-14">
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
              className="bg-white border border-[#e8e5e0] rounded-xl px-5 py-6 text-center"
            >
              <div className="mb-3">{card.icon}</div>
              <div className="font-bold text-base text-[#1a1a2e] mb-1.5">
                {card.title}
              </div>
              <div className="text-[13px] text-gray-500 leading-normal">
                {card.desc}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* ── Gallery: multi-angle views (rendered as images, not live Canvases) ── */}
      <div className="max-w-[900px] mx-auto px-6 pb-14">
        <p className="text-[13px] font-semibold tracking-[2px] uppercase text-gray-500 mb-5 text-center">
          From every angle
        </p>
        <div className="grid grid-cols-[repeat(auto-fill,minmax(260px,1fr))] gap-4">
          {ANGLES.map((angle, i) => (
            <div
              key={i}
              onClick={galleryImages[i] ? onOpenViewer : undefined}
              className={`rounded-xl overflow-hidden relative border border-[#e8e5e0] ${
                galleryImages[i] ? "cursor-pointer" : ""
              }`}
            >
              <div
                className="aspect-[4/3]"
                style={{
                  background: "linear-gradient(165deg, #e8e2d8 0%, #d9d0c3 40%, #cfc5b7 100%)",
                }}
              >
                {galleryImages[i] ? (
                  <img
                    src={galleryImages[i]}
                    alt={angle.label}
                    className="w-full h-full object-cover block"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center">
                    <div className="text-center text-[#b0a89e]">
                      <div className="w-6 h-6 border-[2.5px] border-gray-300 border-t-gray-500 rounded-full mx-auto animate-[spinSmall_0.8s_linear_infinite]" />
                    </div>
                  </div>
                )}
              </div>
              <div
                className="absolute bottom-0 left-0 right-0 pt-6 pb-2.5 px-3.5 text-white text-xs font-medium tracking-wide"
                style={{
                  background: "linear-gradient(to top, rgba(0,0,0,0.45), transparent)",
                }}
              >
                {angle.label}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* ── Model stats ── */}
      <div className="bg-[#1a1a2e] px-6 py-12 text-white text-center">
        <p className="text-[13px] font-semibold tracking-[2px] uppercase text-white/50 mb-7">
          What's inside your model
        </p>
        <div className="flex justify-center gap-[clamp(24px,6vw,64px)] flex-wrap">
          {[
            { value: sceneData.buildings.length, label: "Buildings" },
            {
              value: `${Math.round(sceneData.modelWidthMm)}x${Math.round(sceneData.modelDepthMm)}`,
              label: "Print size (mm)",
            },
          ].map((stat, i) => (
            <div key={i} className="min-w-[80px]">
              <div className="text-[clamp(28px,4vw,40px)] font-bold leading-tight">
                {stat.value}
              </div>
              <div className="text-xs text-white/50 mt-1 tracking-wide">
                {stat.label}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* ── Description copy ── */}
      <div className="max-w-[640px] mx-auto px-6 py-14">
        <h2 className="text-[clamp(22px,3.5vw,32px)] font-bold text-[#1a1a2e] mb-5 leading-tight">
          A piece of the city, made real
        </h2>
        <div className="text-[15px] text-gray-600 leading-[1.8]">
          <p className="mb-4">
            This isn't a generic souvenir. It's <em>your</em> selection — the
            exact neighbourhood, the precise streets, the buildings you chose.
            We pull the geometry straight from OpenStreetMap, scale it down to
            a 200mm base plate, and print it layer by layer in premium PLA
            filament.
          </p>
          <p className="mb-4">
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
      <div className="text-center px-6 pb-12">
        <button
          onClick={onOpenViewer}
          className="px-10 py-4 bg-blue-500 text-white border-none rounded-[10px] cursor-pointer text-base font-semibold tracking-wide hover:bg-blue-600 transition-colors"
        >
          View your model in 3D
        </button>
      </div>

      {/* ── Checkout ── */}
      <CheckoutSection heroImage={heroImage} locationName={displayName} bounds={bounds} />
    </div>
  );
}
