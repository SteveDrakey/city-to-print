import { useEffect, useRef, useState } from "react";

interface Review {
  name: string;
  location: string;
  stars: number;
  text: string;
  productLabel: string;
  gradient: string;
}

const REVIEWS: Review[] = [
  {
    name: "Sarah T.",
    location: "London, UK",
    stars: 5,
    text: "Absolutely stunning! I ordered my neighbourhood in Shoreditch and every tiny street is there. It sits on my desk and I can't stop looking at it. The detail is insane for the price.",
    productLabel: "Shoreditch, London",
    gradient: "from-slate-700 via-slate-600 to-slate-800",
  },
  {
    name: "James M.",
    location: "Edinburgh, UK",
    stars: 5,
    text: "Bought this as a gift for my dad — the area around Arthur's Seat where he grew up. He was genuinely moved. You can see the castle, the Royal Mile, everything. Arrived beautifully packaged.",
    productLabel: "Old Town, Edinburgh",
    gradient: "from-zinc-700 via-zinc-600 to-zinc-800",
  },
  {
    name: "Emma R.",
    location: "Manchester, UK",
    stars: 5,
    text: "Third purchase now! I'm collecting all the places that mean something to me. The Northern Quarter print is my favourite — every back alley and rooftop. Delivery was super fast too.",
    productLabel: "Northern Quarter, Manchester",
    gradient: "from-gray-700 via-gray-600 to-gray-800",
  },
  {
    name: "Tom K.",
    location: "Bristol, UK",
    stars: 5,
    text: "Got Clifton as a housewarming gift for friends. They absolutely loved it. The suspension bridge is recognisable even at this scale. Really well made — solid and weighty.",
    productLabel: "Clifton, Bristol",
    gradient: "from-neutral-700 via-neutral-600 to-neutral-800",
  },
  {
    name: "Rachel D.",
    location: "New York, USA",
    stars: 5,
    text: "Shipped all the way to NYC and arrived in perfect condition. I got the area around Central Park — it's like a tiny Manhattan on my bookshelf. Worth every penny and the wait!",
    productLabel: "Central Park, NYC",
    gradient: "from-stone-700 via-stone-600 to-stone-800",
  },
  {
    name: "David L.",
    location: "Cardiff, UK",
    stars: 5,
    text: "Ordered the Bay area as a retirement gift for a colleague. The print quality is superb — you can even make out the Millennium Centre. Arrived in 4 days. Will order again.",
    productLabel: "Cardiff Bay",
    gradient: "from-slate-800 via-slate-700 to-slate-900",
  },
];

function Stars({ count }: { count: number }) {
  return (
    <div className="flex gap-0.5">
      {Array.from({ length: 5 }).map((_, i) => (
        <svg
          key={i}
          className={`w-4 h-4 ${i < count ? "text-amber-400" : "text-gray-300"}`}
          fill="currentColor"
          viewBox="0 0 20 20"
        >
          <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
        </svg>
      ))}
    </div>
  );
}

interface Props {
  compact: boolean;
}

export default function ReviewCarousel({ compact }: Props) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [isPaused, setIsPaused] = useState(false);

  // Auto-scroll the carousel
  useEffect(() => {
    const el = scrollRef.current;
    if (!el || isPaused) return;

    const speed = 0.5; // px per frame
    let animId: number;

    const step = () => {
      el.scrollLeft += speed;
      // Loop: when we've scrolled half (the duplicated set), reset
      if (el.scrollLeft >= el.scrollWidth / 2) {
        el.scrollLeft = 0;
      }
      animId = requestAnimationFrame(step);
    };

    animId = requestAnimationFrame(step);
    return () => cancelAnimationFrame(animId);
  }, [isPaused]);

  // Double the reviews for seamless infinite scroll
  const allReviews = [...REVIEWS, ...REVIEWS];

  return (
    <section
      className={`w-full overflow-hidden transition-all duration-500 ${
        compact
          ? "bg-gray-50 py-6"
          : "bg-gradient-to-b from-slate-900 to-slate-800 py-16"
      }`}
    >
      {/* Header */}
      <div className={`text-center mb-6 px-6 ${compact ? "" : "mb-10"}`}>
        {!compact && (
          <p className="text-xs font-semibold tracking-[0.2em] uppercase text-blue-400 mb-3">
            Loved by customers
          </p>
        )}
        <h2
          className={`font-bold transition-all duration-500 ${
            compact
              ? "text-base text-gray-700"
              : "text-2xl sm:text-3xl text-white"
          }`}
        >
          {compact ? "What our customers say" : "Over 100 happy customers"}
        </h2>
        {!compact && (
          <p className="text-slate-400 mt-2 text-sm max-w-md mx-auto">
            Real reviews from our Etsy shop — every model handmade in the UK
          </p>
        )}
      </div>

      {/* Scrolling track */}
      <div
        ref={scrollRef}
        className="flex gap-4 overflow-x-auto scrollbar-hide px-4"
        style={{ scrollbarWidth: "none", msOverflowStyle: "none" }}
        onMouseEnter={() => setIsPaused(true)}
        onMouseLeave={() => setIsPaused(false)}
        onTouchStart={() => setIsPaused(true)}
        onTouchEnd={() => setIsPaused(false)}
      >
        {allReviews.map((review, i) => (
          <div
            key={i}
            className={`flex-shrink-0 rounded-xl overflow-hidden transition-all duration-500 ${
              compact
                ? "w-64 bg-white border border-gray-200 shadow-sm"
                : "w-80 bg-white/10 backdrop-blur-sm border border-white/10"
            }`}
          >
            {/* Product photo placeholder */}
            <div
              className={`relative bg-gradient-to-br ${review.gradient} ${
                compact ? "h-28" : "h-44"
              } flex items-center justify-center transition-all duration-500`}
            >
              {/* Faux city model silhouette */}
              <div className="absolute inset-0 flex items-end justify-center pb-3 opacity-30">
                <div className="flex items-end gap-[2px]">
                  {[20, 35, 28, 42, 18, 38, 24, 30, 15, 33, 22, 40, 26, 36, 20].map(
                    (h, j) => (
                      <div
                        key={j}
                        className="bg-white/80 rounded-t-sm"
                        style={{
                          width: compact ? 4 : 6,
                          height: compact ? h * 0.6 : h,
                        }}
                      />
                    )
                  )}
                </div>
              </div>
              <span
                className={`relative z-10 font-semibold tracking-wide ${
                  compact ? "text-[10px] text-white/70" : "text-xs text-white/80"
                }`}
              >
                {review.productLabel}
              </span>
            </div>

            {/* Review content */}
            <div className={compact ? "p-3" : "p-5"}>
              <Stars count={review.stars} />
              <p
                className={`mt-2 leading-relaxed ${
                  compact
                    ? "text-xs text-gray-600 line-clamp-2"
                    : "text-sm text-white/80 line-clamp-4"
                }`}
              >
                &ldquo;{review.text}&rdquo;
              </p>
              <div className={`mt-3 flex items-center gap-2 ${compact ? "mt-2" : ""}`}>
                <div
                  className={`rounded-full flex items-center justify-center font-bold text-white ${
                    compact
                      ? "w-6 h-6 text-[10px] bg-blue-500"
                      : "w-8 h-8 text-xs bg-blue-500"
                  }`}
                >
                  {review.name[0]}
                </div>
                <div>
                  <p
                    className={`font-semibold ${
                      compact
                        ? "text-[11px] text-gray-800"
                        : "text-sm text-white"
                    }`}
                  >
                    {review.name}
                  </p>
                  <p
                    className={
                      compact
                        ? "text-[10px] text-gray-400"
                        : "text-xs text-white/50"
                    }
                  >
                    {review.location}
                  </p>
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Etsy CTA — only in expanded mode */}
      {!compact && (
        <div className="text-center mt-10 px-6">
          <a
            href="https://www.etsy.com/uk/shop/Drakey3DPrints"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 bg-[#f56400] hover:bg-[#e05a00] text-white font-semibold text-sm px-6 py-3 rounded-lg transition-colors"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
              <path d="M9.16 4.23C9.16 4.23 8 4.72 8 6.59c0 1.42.52 2.23.52 2.23H5.88c-.98 0-1.88.86-1.88 1.89v1.78c0 .44.36.8.8.8h1.6v5.42c0 1.03.84 1.87 1.87 1.87h7.46c1.03 0 1.87-.84 1.87-1.87v-5.42h1.6c.44 0 .8-.36.8-.8v-1.78c0-1.03-.86-1.89-1.88-1.89h-2.64s.52-.81.52-2.23c0-1.87-1.16-2.36-1.16-2.36S13.56 3 12 3s-2.84 1.23-2.84 1.23zM12 5.5c.71 0 1.5.5 1.5 1.09 0 .78-.5 1.72-.5 1.72h-2s-.5-.94-.5-1.72C10.5 6 11.29 5.5 12 5.5z" />
            </svg>
            See all reviews on Etsy
          </a>
        </div>
      )}

      {/* Hide scrollbar */}
      <style>{`
        .scrollbar-hide::-webkit-scrollbar { display: none; }
      `}</style>
    </section>
  );
}
