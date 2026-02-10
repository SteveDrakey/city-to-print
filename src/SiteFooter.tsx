export default function SiteFooter() {
  return (
    <footer className="bg-[#0f1729] px-6 py-10 text-center">
      <p className="text-lg font-bold text-white mb-2 tracking-wide">
        Drakey 3D Prints
      </p>
      <p className="text-sm text-white/55 mb-5 leading-relaxed">
        Handmade 3D-printed city models,{" "}
        crafted with care in the UK.
      </p>
      <a
        href="https://www.etsy.com/uk/shop/Drakey3DPrints"
        target="_blank"
        rel="noopener noreferrer"
        className="inline-flex items-center gap-2 px-7 py-3 bg-[#f56400] hover:bg-[#e05a00] text-white text-sm font-semibold rounded-lg no-underline tracking-wide transition-colors"
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
          <path d="M9.16 4.23C9.16 4.23 8 4.72 8 6.59c0 1.42.52 2.23.52 2.23H5.88c-.98 0-1.88.86-1.88 1.89v1.78c0 .44.36.8.8.8h1.6v5.42c0 1.03.84 1.87 1.87 1.87h7.46c1.03 0 1.87-.84 1.87-1.87v-5.42h1.6c.44 0 .8-.36.8-.8v-1.78c0-1.03-.86-1.89-1.88-1.89h-2.64s.52-.81.52-2.23c0-1.87-1.16-2.36-1.16-2.36S13.56 3 12 3s-2.84 1.23-2.84 1.23zM12 5.5c.71 0 1.5.5 1.5 1.09 0 .78-.5 1.72-.5 1.72h-2s-.5-.94-.5-1.72C10.5 6 11.29 5.5 12 5.5z" />
        </svg>
        Visit our Etsy Shop
      </a>
      <div className="flex justify-center gap-4 mt-6 text-xs text-white/40">
        <a href="https://www.etsy.com/uk/shop/Drakey3DPrints/policy" target="_blank" rel="noopener noreferrer" className="hover:text-white/70 transition-colors no-underline text-white/40">
          Shipping &amp; Returns
        </a>
        <span className="text-white/20">|</span>
        <a href="https://www.etsy.com/uk/shop/Drakey3DPrints/policy" target="_blank" rel="noopener noreferrer" className="hover:text-white/70 transition-colors no-underline text-white/40">
          Privacy Policy
        </a>
        <span className="text-white/20">|</span>
        <a href="https://www.etsy.com/uk/shop/Drakey3DPrints" target="_blank" rel="noopener noreferrer" className="hover:text-white/70 transition-colors no-underline text-white/40">
          Contact
        </a>
      </div>
      <p className="text-xs text-white/30 mt-4">
        &copy; {new Date().getFullYear()} Drakey 3D Prints. All rights reserved.
      </p>
    </footer>
  );
}
