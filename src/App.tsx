import { useCallback, useState, useRef, useEffect, lazy, Suspense } from "react";
import MapSelector from "./MapSelector";
import ProductPage from "./ProductPage";
import PaymentSuccess from "./PaymentSuccess";
import ReviewCarousel from "./ReviewCarousel";
import { useOverpassData } from "./useOverpassData";
import CityLoadingAnimation from "./CityLoadingAnimation";
import type { Bounds } from "./types";

const LazyViewerOverlay = lazy(() =>
  import("./ModelPreview").then((m) => ({ default: m.ViewerOverlay }))
);

declare const __BUILD_HASH__: string;

const isProd = typeof window !== "undefined" && window.location.hostname.endsWith("drakey.co.uk");

export default function App() {
  const { loading, error, sceneData, fetchData, retryAttempt, maxRetries } =
    useOverpassData();
  const [locationName, setLocationName] = useState("");
  const [areaDescription, setAreaDescription] = useState("");
  const [selectedBounds, setSelectedBounds] = useState<Bounds | null>(null);
  const [showViewer, setShowViewer] = useState(false);
  const [paymentSuccess, setPaymentSuccess] = useState(() => {
    const params = new URLSearchParams(window.location.search);
    return params.get("success") === "1";
  });
  const productRef = useRef<HTMLDivElement>(null);
  const loadingRef = useRef<HTMLDivElement>(null);

  // Clean the ?success=1 query param from the URL without a reload
  useEffect(() => {
    if (paymentSuccess) {
      window.history.replaceState({}, "", window.location.pathname);
    }
  }, [paymentSuccess]);

  const handlePaymentSuccessDismiss = useCallback(() => {
    setPaymentSuccess(false);
  }, []);

  const handleBoundsSelected = useCallback(
    (bounds: Bounds, name?: string, bearing?: number) => {
      // Close the 3D viewer before starting a new generation so we never
      // have two WebGL contexts (ViewerOverlay + CaptureRender) alive at once.
      setShowViewer(false);

      // Start Overpass data fetch immediately
      fetchData(bounds, bearing ?? 0);
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

  if (paymentSuccess) {
    return (
      <div className="font-sans min-h-screen">
        <PaymentSuccess onContinue={handlePaymentSuccessDismiss} />
      </div>
    );
  }

  return (
    <div className="font-sans min-h-screen">
      {/* ── Map Section (takes full viewport height) ── */}
      <div className="w-full h-screen bg-gray-900 flex justify-center">
        <div className="w-full max-w-[min(100%,100vh)] h-full flex flex-col relative shadow-[0_0_60px_rgba(0,0,0,0.4)]">
          {/* Header */}
          <div className="px-5 py-3 bg-[#16213e] text-white text-base font-bold tracking-wide shrink-0 flex items-center justify-between gap-2.5">
            <div className="flex items-center gap-2.5">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 2L2 7l10 5 10-5-10-5z" />
                <path d="M2 17l10 5 10-5" />
                <path d="M2 12l10 5 10-5" />
              </svg>
              City to Print
              {!isProd && (
                <span className="ml-2 px-1.5 py-0.5 bg-white/15 rounded text-[10px] font-mono tracking-wider opacity-70">
                  {__BUILD_HASH__}
                </span>
              )}
            </div>
            <a
              href="https://www.etsy.com/uk/shop/Drakey3DPrints"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1.5 text-slate-200 text-[13px] font-medium no-underline tracking-tight"
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
          <div className="flex-1 min-h-0">
            <MapSelector onBoundsSelected={handleBoundsSelected} loading={loading} />
          </div>
        </div>
      </div>

      {/* ── Loading animation + reviews while building ── */}
      {loading && (
        <div ref={loadingRef}>
          <CityLoadingAnimation
            retryAttempt={retryAttempt}
            maxRetries={maxRetries}
          />
          <ReviewCarousel compact loading />
        </div>
      )}

      {/* ── Error notice ── */}
      {error && !loading && (
        <div className="px-6 py-3 bg-red-50 text-red-700 text-[13px] text-center border-t border-red-200">
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
          />
        </div>
      )}

      {/* ── Review Carousel ── */}
      {!loading && (
        <ReviewCarousel compact={!!sceneData} />
      )}

      {/* ── Fullscreen 3D Viewer Overlay (lazy-loaded on interaction only) ── */}
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
