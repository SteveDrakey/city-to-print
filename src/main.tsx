import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import "./index.css";

// Global reset
const style = document.createElement("style");
style.textContent = `
  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
  html, body, #root { width: 100%; min-height: 100%; }
  html { overflow-x: hidden; }
  body { overflow-x: hidden; overflow-y: auto; }
`;
document.head.appendChild(style);

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
