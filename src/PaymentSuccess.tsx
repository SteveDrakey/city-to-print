interface Props {
  onContinue: () => void;
}

export default function PaymentSuccess({ onContinue }: Props) {
  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 9999,
        background: "#faf9f7",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 24,
      }}
    >
      <div
        style={{
          maxWidth: 480,
          width: "100%",
          textAlign: "center",
        }}
      >
        {/* Success icon */}
        <div
          style={{
            width: 80,
            height: 80,
            borderRadius: "50%",
            background: "#ecfdf5",
            border: "3px solid #10b981",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            margin: "0 auto 32px",
          }}
        >
          <svg
            width="40"
            height="40"
            viewBox="0 0 24 24"
            fill="none"
            stroke="#10b981"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <polyline points="20 6 9 17 4 12" />
          </svg>
        </div>

        {/* Heading */}
        <h1
          style={{
            fontSize: "clamp(24px, 5vw, 36px)",
            fontWeight: 700,
            color: "#1a1a2e",
            margin: "0 0 12px",
            lineHeight: 1.2,
          }}
        >
          Order confirmed
        </h1>
        <p
          style={{
            fontSize: "clamp(15px, 2.5vw, 18px)",
            color: "#555",
            lineHeight: 1.6,
            margin: "0 0 40px",
          }}
        >
          Thank you for your purchase. Your custom city model is on its way to
          being made.
        </p>

        {/* What happens next */}
        <div
          style={{
            background: "#fff",
            border: "1px solid #e8e5e0",
            borderRadius: 16,
            padding: "28px 24px",
            textAlign: "left",
            marginBottom: 40,
          }}
        >
          <p
            style={{
              fontSize: 13,
              fontWeight: 600,
              letterSpacing: 2,
              textTransform: "uppercase",
              color: "#6b7280",
              margin: "0 0 20px",
            }}
          >
            What happens next
          </p>

          {[
            {
              step: "1",
              title: "Confirmation email",
              desc: "You'll receive a receipt from Stripe with your order details.",
            },
            {
              step: "2",
              title: "We print your model",
              desc: "Your unique city model is 3D printed layer by layer in premium PLA.",
            },
            {
              step: "3",
              title: "Carefully packed and shipped",
              desc: "Inspected for quality, securely packaged, and dispatched within 5\u20137 days.",
            },
          ].map((item) => (
            <div
              key={item.step}
              style={{
                display: "flex",
                gap: 16,
                marginBottom: item.step === "3" ? 0 : 20,
                alignItems: "flex-start",
              }}
            >
              <div
                style={{
                  width: 32,
                  height: 32,
                  borderRadius: "50%",
                  background: "#f0f7ff",
                  border: "1.5px solid #3b82f6",
                  color: "#3b82f6",
                  fontSize: 14,
                  fontWeight: 700,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  flexShrink: 0,
                }}
              >
                {item.step}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div
                  style={{
                    fontWeight: 600,
                    fontSize: 15,
                    color: "#1a1a2e",
                    marginBottom: 4,
                  }}
                >
                  {item.title}
                </div>
                <div style={{ fontSize: 13, color: "#777", lineHeight: 1.5 }}>
                  {item.desc}
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* CTA button */}
        <button
          onClick={onContinue}
          style={{
            padding: "16px 40px",
            background: "#1a1a2e",
            color: "#fff",
            border: "none",
            borderRadius: 10,
            cursor: "pointer",
            fontSize: 16,
            fontWeight: 600,
            letterSpacing: 0.3,
            transition: "background 0.15s ease",
            marginBottom: 16,
          }}
        >
          Create another model
        </button>

        <p
          style={{
            fontSize: 12,
            color: "#aaa",
            margin: 0,
            lineHeight: 1.6,
          }}
        >
          Questions about your order?{" "}
          <a
            href="https://www.etsy.com/uk/shop/Drakey3DPrints"
            target="_blank"
            rel="noopener noreferrer"
            style={{ color: "#3b82f6", textDecoration: "none" }}
          >
            Contact us on Etsy
          </a>
        </p>
      </div>
    </div>
  );
}
