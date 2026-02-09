import { useState } from "react";

type ShippingRegion = "uk" | "international";

interface Props {
  heroImage: string | null;
  locationName: string;
}

const PRODUCT_PRICE = 40;
const SHIPPING: Record<ShippingRegion, { label: string; price: number }> = {
  uk: { label: "United Kingdom", price: 5 },
  international: { label: "International (USA etc.)", price: 15 },
};

export default function CheckoutSection({ heroImage, locationName }: Props) {
  const [region, setRegion] = useState<ShippingRegion>("uk");

  const shipping = SHIPPING[region];
  const total = PRODUCT_PRICE + shipping.price;

  const linkUk = import.meta.env.VITE_STRIPE_LINK_UK as string | undefined;
  const linkIntl = import.meta.env.VITE_STRIPE_LINK_INTL as string | undefined;
  const paymentLink = region === "uk" ? linkUk : linkIntl;
  const isConfigured = !!(linkUk || linkIntl);

  const handleCheckout = () => {
    if (paymentLink) {
      window.location.href = paymentLink;
    }
  };

  return (
    <div
      style={{
        maxWidth: 480,
        margin: "0 auto",
        padding: "0 24px 64px",
      }}
    >
      {/* ── Order Summary Card ── */}
      <div
        style={{
          background: "#fff",
          border: "1px solid #e8e5e0",
          borderRadius: 16,
          overflow: "hidden",
        }}
      >
        {/* Header */}
        <div
          style={{
            padding: "20px 24px",
            borderBottom: "1px solid #f0ede8",
          }}
        >
          <p
            style={{
              fontSize: 13,
              fontWeight: 600,
              letterSpacing: 2,
              textTransform: "uppercase",
              color: "#6b7280",
              margin: 0,
            }}
          >
            Order Summary
          </p>
        </div>

        {/* Product row */}
        <div
          style={{
            padding: "20px 24px",
            display: "flex",
            gap: 16,
            alignItems: "center",
            borderBottom: "1px solid #f0ede8",
          }}
        >
          {heroImage && (
            <div
              style={{
                width: 72,
                height: 72,
                borderRadius: 10,
                overflow: "hidden",
                flexShrink: 0,
                background:
                  "linear-gradient(165deg, #e8e2d8 0%, #cfc5b7 100%)",
              }}
            >
              <img
                src={heroImage}
                alt="Model preview"
                style={{
                  width: "100%",
                  height: "100%",
                  objectFit: "cover",
                  display: "block",
                }}
              />
            </div>
          )}
          <div style={{ flex: 1, minWidth: 0 }}>
            <div
              style={{
                fontWeight: 600,
                fontSize: 15,
                color: "#1a1a2e",
                marginBottom: 4,
                whiteSpace: "nowrap",
                overflow: "hidden",
                textOverflow: "ellipsis",
              }}
            >
              {locationName || "Custom City Model"}
            </div>
            <div style={{ fontSize: 13, color: "#888" }}>
              3D printed PLA &middot; 20cm x 20cm
            </div>
          </div>
          <div
            style={{
              fontWeight: 700,
              fontSize: 16,
              color: "#1a1a2e",
              flexShrink: 0,
            }}
          >
            &pound;{PRODUCT_PRICE.toFixed(2)}
          </div>
        </div>

        {/* Shipping selection */}
        <div style={{ padding: "20px 24px", borderBottom: "1px solid #f0ede8" }}>
          <p
            style={{
              fontSize: 13,
              fontWeight: 600,
              color: "#555",
              margin: "0 0 12px 0",
            }}
          >
            Shipping destination
          </p>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {(Object.keys(SHIPPING) as ShippingRegion[]).map((key) => {
              const opt = SHIPPING[key];
              const selected = region === key;
              return (
                <label
                  key={key}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 12,
                    padding: "12px 16px",
                    borderRadius: 10,
                    border: selected
                      ? "2px solid #3b82f6"
                      : "1px solid #e8e5e0",
                    background: selected ? "#f0f7ff" : "#faf9f7",
                    cursor: "pointer",
                    transition: "all 0.15s ease",
                  }}
                >
                  <input
                    type="radio"
                    name="shipping"
                    checked={selected}
                    onChange={() => setRegion(key)}
                    style={{ accentColor: "#3b82f6" }}
                  />
                  <span
                    style={{
                      flex: 1,
                      fontSize: 14,
                      fontWeight: selected ? 600 : 400,
                      color: "#1a1a2e",
                    }}
                  >
                    {opt.label}
                  </span>
                  <span
                    style={{
                      fontSize: 14,
                      fontWeight: 600,
                      color: "#555",
                    }}
                  >
                    &pound;{opt.price.toFixed(2)}
                  </span>
                </label>
              );
            })}
          </div>
        </div>

        {/* Price breakdown */}
        <div style={{ padding: "20px 24px", borderBottom: "1px solid #f0ede8" }}>
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              marginBottom: 8,
              fontSize: 14,
              color: "#555",
            }}
          >
            <span>Model</span>
            <span>&pound;{PRODUCT_PRICE.toFixed(2)}</span>
          </div>
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              marginBottom: 12,
              fontSize: 14,
              color: "#555",
            }}
          >
            <span>Shipping ({shipping.label})</span>
            <span>&pound;{shipping.price.toFixed(2)}</span>
          </div>
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              paddingTop: 12,
              borderTop: "1px solid #f0ede8",
              fontSize: 18,
              fontWeight: 700,
              color: "#1a1a2e",
            }}
          >
            <span>Total</span>
            <span>&pound;{total.toFixed(2)}</span>
          </div>
        </div>

        {/* Checkout button */}
        <div style={{ padding: "20px 24px" }}>
          {isConfigured ? (
            <>
              <button
                onClick={handleCheckout}
                disabled={!paymentLink}
                style={{
                  width: "100%",
                  padding: "16px 24px",
                  background: paymentLink ? "#1a1a2e" : "#94a3b8",
                  color: "#fff",
                  border: "none",
                  borderRadius: 10,
                  cursor: paymentLink ? "pointer" : "not-allowed",
                  fontSize: 16,
                  fontWeight: 600,
                  letterSpacing: 0.3,
                  transition: "background 0.15s ease",
                }}
              >
                {`Pay \u00A3${total.toFixed(2)}`}
              </button>
              {!paymentLink && (
                <p
                  style={{
                    textAlign: "center",
                    marginTop: 10,
                    fontSize: 12,
                    color: "#dc2626",
                  }}
                >
                  No payment link configured for this shipping region.
                </p>
              )}
              <p
                style={{
                  textAlign: "center",
                  marginTop: 12,
                  fontSize: 12,
                  color: "#aaa",
                  lineHeight: 1.6,
                }}
              >
                Secure checkout powered by Stripe.
                <br />
                Apple Pay, Google Pay, and cards accepted.
              </p>
            </>
          ) : (
            <div
              style={{
                textAlign: "center",
                padding: "12px 0",
                fontSize: 14,
                color: "#888",
                background: "#f5f3f0",
                borderRadius: 10,
              }}
            >
              Payment not configured yet.
              <br />
              <span style={{ fontSize: 12, color: "#aaa" }}>
                Set VITE_STRIPE_LINK_UK and VITE_STRIPE_LINK_INTL env vars.
              </span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
