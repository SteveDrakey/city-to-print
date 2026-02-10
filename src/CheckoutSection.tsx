import { useState } from "react";
import type { Bounds } from "./types";

type ShippingRegion = "uk" | "usa";

interface Props {
  heroImage: string | null;
  locationName: string;
  bounds: Bounds | null;
}

const PRODUCT_PRICE = 40;
const SHIPPING: Record<ShippingRegion, { label: string; price: number }> = {
  uk: { label: "United Kingdom", price: 5 },
  usa: { label: "United States", price: 15 },
};

export default function CheckoutSection({ heroImage, locationName, bounds }: Props) {
  const [region, setRegion] = useState<ShippingRegion>("uk");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const shipping = SHIPPING[region];
  const total = PRODUCT_PRICE + shipping.price;

  const handleCheckout = async () => {
    if (!bounds) return;
    setLoading(true);
    setError(null);

    try {
      // Extract bearing from the URL hash so we pass it explicitly to Stripe
      const hashParams = new URLSearchParams(window.location.hash.slice(1));
      const bearing = parseFloat(hashParams.get("b") || "0") || 0;

      const res = await fetch("/api/create-checkout-session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          bounds,
          locationName,
          shippingRegion: region,
          bearing,
          mapUrl: window.location.href,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Checkout failed");
      }

      window.location.href = data.url;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
      setLoading(false);
    }
  };

  return (
    <div className="max-w-[480px] mx-auto px-6 pb-16">
      {/* ── Order Summary Card ── */}
      <div className="bg-white border border-[#e8e5e0] rounded-2xl overflow-hidden">
        {/* Header */}
        <div className="px-6 py-5 border-b border-[#f0ede8]">
          <p className="text-[13px] font-semibold tracking-[2px] uppercase text-gray-500 m-0">
            Order Summary
          </p>
        </div>

        {/* Product row */}
        <div className="px-6 py-5 flex gap-4 items-center border-b border-[#f0ede8]">
          {heroImage && (
            <div
              className="w-[72px] h-[72px] rounded-[10px] overflow-hidden shrink-0"
              style={{
                background: "linear-gradient(165deg, #e8e2d8 0%, #cfc5b7 100%)",
              }}
            >
              <img
                src={heroImage}
                alt="Model preview"
                className="w-full h-full object-cover block"
              />
            </div>
          )}
          <div className="flex-1 min-w-0">
            <div className="font-semibold text-[15px] text-[#1a1a2e] mb-1 whitespace-nowrap overflow-hidden text-ellipsis">
              {locationName || "Custom City Model"}
            </div>
            <div className="text-[13px] text-gray-400">
              3D printed PLA &middot; 20cm x 20cm
            </div>
          </div>
          <div className="font-bold text-base text-[#1a1a2e] shrink-0">
            &pound;{PRODUCT_PRICE.toFixed(2)}
          </div>
        </div>

        {/* Shipping selection */}
        <div className="px-6 py-5 border-b border-[#f0ede8]">
          <p className="text-[13px] font-semibold text-gray-600 mb-3">
            Shipping destination
          </p>
          <div className="flex flex-col gap-2">
            {(Object.keys(SHIPPING) as ShippingRegion[]).map((key) => {
              const opt = SHIPPING[key];
              const selected = region === key;
              return (
                <label
                  key={key}
                  className={`flex items-center gap-3 px-4 py-3 rounded-[10px] cursor-pointer transition-all duration-150 ${
                    selected
                      ? "border-2 border-blue-500 bg-blue-50"
                      : "border border-[#e8e5e0] bg-[#faf9f7]"
                  }`}
                >
                  <input
                    type="radio"
                    name="shipping"
                    checked={selected}
                    onChange={() => setRegion(key)}
                    className="accent-blue-500"
                  />
                  <span
                    className={`flex-1 text-sm text-[#1a1a2e] ${selected ? "font-semibold" : ""}`}
                  >
                    {opt.label}
                  </span>
                  <span className="text-sm font-semibold text-gray-600">
                    &pound;{opt.price.toFixed(2)}
                  </span>
                </label>
              );
            })}
          </div>
        </div>

        {/* Price breakdown */}
        <div className="px-6 py-5 border-b border-[#f0ede8]">
          <div className="flex justify-between mb-2 text-sm text-gray-600">
            <span>Model</span>
            <span>&pound;{PRODUCT_PRICE.toFixed(2)}</span>
          </div>
          <div className="flex justify-between mb-3 text-sm text-gray-600">
            <span>Shipping ({shipping.label})</span>
            <span>&pound;{shipping.price.toFixed(2)}</span>
          </div>
          <div className="flex justify-between pt-3 border-t border-[#f0ede8] text-lg font-bold text-[#1a1a2e]">
            <span>Total</span>
            <span>&pound;{total.toFixed(2)}</span>
          </div>
        </div>

        {/* Checkout button */}
        <div className="px-6 py-5">
          <button
            onClick={handleCheckout}
            disabled={!bounds || loading}
            className={`w-full py-4 px-6 text-white border-none rounded-[10px] text-base font-semibold tracking-wide transition-colors duration-150 ${
              bounds && !loading
                ? "bg-[#1a1a2e] cursor-pointer hover:bg-[#2a2a3e]"
                : "bg-slate-400 cursor-not-allowed"
            }`}
          >
            {loading ? "Redirecting to checkout\u2026" : `Pay \u00A3${total.toFixed(2)}`}
          </button>
          {error && (
            <p className="text-center mt-2.5 text-xs text-red-600">
              {error}
            </p>
          )}
          <p className="text-center mt-3 text-xs text-gray-400 leading-relaxed">
            Secure checkout powered by Stripe.
            <br />
            Apple Pay, Google Pay, and cards accepted.
          </p>
        </div>
      </div>
    </div>
  );
}
