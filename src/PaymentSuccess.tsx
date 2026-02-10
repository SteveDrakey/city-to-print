interface Props {
  onContinue: () => void;
}

export default function PaymentSuccess({ onContinue }: Props) {
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
      </div>
    </div>
  );
}
