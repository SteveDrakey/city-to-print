import { useEffect, useState } from "react";

interface Props {
  sessionId: string;
  onContinue: () => void;
}

type Status = "verifying" | "verified" | "failed";

export default function PaymentSuccess({ sessionId, onContinue }: Props) {
  const [status, setStatus] = useState<Status>("verifying");

  useEffect(() => {
    fetch(`/api/verify-session?session_id=${encodeURIComponent(sessionId)}`)
      .then((r) => r.json())
      .then((data) => setStatus(data.verified ? "verified" : "failed"))
      .catch(() => setStatus("failed"));
  }, [sessionId]);

  if (status === "verifying") {
    return (
      <div className="fixed inset-0 z-[9999] bg-[#faf9f7] flex items-center justify-center p-6">
        <div className="max-w-[480px] w-full text-center">
          <div className="w-20 h-20 rounded-full bg-blue-50 border-[3px] border-blue-300 flex items-center justify-center mx-auto mb-8 animate-pulse">
            <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="#3b82f6" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="10" />
              <path d="M12 6v6l4 2" />
            </svg>
          </div>
          <h1 className="text-[clamp(24px,5vw,36px)] font-bold text-[#1a1a2e] mb-3 leading-tight">
            Confirming your payment&hellip;
          </h1>
          <p className="text-[clamp(15px,2.5vw,18px)] text-gray-500 leading-relaxed">
            Just a moment while we verify with Stripe.
          </p>
        </div>
      </div>
    );
  }

  if (status === "failed") {
    return (
      <div className="fixed inset-0 z-[9999] bg-[#faf9f7] flex items-center justify-center p-6">
        <div className="max-w-[480px] w-full text-center">
          <div className="w-20 h-20 rounded-full bg-amber-50 border-[3px] border-amber-400 flex items-center justify-center mx-auto mb-8">
            <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="#f59e0b" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="10" />
              <line x1="12" y1="8" x2="12" y2="12" />
              <line x1="12" y1="16" x2="12.01" y2="16" />
            </svg>
          </div>
          <h1 className="text-[clamp(24px,5vw,36px)] font-bold text-[#1a1a2e] mb-3 leading-tight">
            We couldn&rsquo;t verify this payment
          </h1>
          <p className="text-[clamp(15px,2.5vw,18px)] text-gray-600 leading-relaxed mb-10">
            If you were charged, don&rsquo;t worry&nbsp;&mdash; please contact us
            and we&rsquo;ll sort it out.
          </p>
          <a
            href="https://www.etsy.com/uk/shop/Drakey3DPrints"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-block px-10 py-4 bg-[#1a1a2e] text-white rounded-[10px] text-base font-semibold tracking-wide no-underline hover:bg-[#2a2a3e] transition-colors mb-4"
          >
            Contact us on Etsy
          </a>
          <br />
          <button
            onClick={onContinue}
            className="px-6 py-3 bg-transparent border-none text-blue-500 cursor-pointer text-sm font-medium"
          >
            Back to City&nbsp;to&nbsp;Print
          </button>

          <div className="flex justify-center gap-3 mt-6 text-[11px] text-gray-400">
            <a href="https://www.etsy.com/uk/shop/Drakey3DPrints/policy" target="_blank" rel="noopener noreferrer" className="text-gray-400 hover:text-gray-600 transition-colors no-underline">
              Shipping &amp; Returns
            </a>
            <span className="text-gray-300">|</span>
            <a href="https://www.etsy.com/uk/shop/Drakey3DPrints/policy" target="_blank" rel="noopener noreferrer" className="text-gray-400 hover:text-gray-600 transition-colors no-underline">
              Privacy Policy
            </a>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-[9999] bg-[#faf9f7] flex items-center justify-center p-6">
      <div className="max-w-[480px] w-full text-center">
        {/* Success icon */}
        <div className="w-20 h-20 rounded-full bg-emerald-50 border-[3px] border-emerald-500 flex items-center justify-center mx-auto mb-8">
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
        <h1 className="text-[clamp(24px,5vw,36px)] font-bold text-[#1a1a2e] mb-3 leading-tight">
          Order confirmed
        </h1>
        <p className="text-[clamp(15px,2.5vw,18px)] text-gray-600 leading-relaxed mb-10">
          Thank you for your purchase. Your custom city model is on its way to
          being made.
        </p>

        {/* What happens next */}
        <div className="bg-white border border-[#e8e5e0] rounded-2xl p-7 text-left mb-10">
          <p className="text-[13px] font-semibold tracking-[2px] uppercase text-gray-500 mb-5">
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
              className={`flex gap-4 items-start ${item.step === "3" ? "" : "mb-5"}`}
            >
              <div className="w-8 h-8 rounded-full bg-blue-50 border-[1.5px] border-blue-500 text-blue-500 text-sm font-bold flex items-center justify-center shrink-0">
                {item.step}
              </div>
              <div className="flex-1 min-w-0">
                <div className="font-semibold text-[15px] text-[#1a1a2e] mb-1">
                  {item.title}
                </div>
                <div className="text-[13px] text-gray-500 leading-normal">
                  {item.desc}
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* CTA button */}
        <button
          onClick={onContinue}
          className="px-10 py-4 bg-[#1a1a2e] text-white border-none rounded-[10px] cursor-pointer text-base font-semibold tracking-wide transition-colors duration-150 mb-4 hover:bg-[#2a2a3e]"
        >
          Create another model
        </button>

        <p className="text-xs text-gray-400 leading-relaxed">
          Questions about your order?{" "}
          <a
            href="https://www.etsy.com/uk/shop/Drakey3DPrints"
            target="_blank"
            rel="noopener noreferrer"
            className="text-blue-500 no-underline"
          >
            Contact us on Etsy
          </a>
        </p>

        <div className="flex justify-center gap-3 mt-6 text-[11px] text-gray-400">
          <a href="https://www.etsy.com/uk/shop/Drakey3DPrints/policy" target="_blank" rel="noopener noreferrer" className="text-gray-400 hover:text-gray-600 transition-colors no-underline">
            Shipping &amp; Returns
          </a>
          <span className="text-gray-300">|</span>
          <a href="https://www.etsy.com/uk/shop/Drakey3DPrints/policy" target="_blank" rel="noopener noreferrer" className="text-gray-400 hover:text-gray-600 transition-colors no-underline">
            Privacy Policy
          </a>
        </div>
      </div>
    </div>
  );
}
