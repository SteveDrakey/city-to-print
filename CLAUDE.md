# CLAUDE.md

## Project overview

City-to-print is a React web app that turns real-world map areas into 3D-printable city models. Users pick an area on an interactive map, the app fetches OpenStreetMap data (buildings, roads, water), and renders a 3D preview scaled to a 200mm x 200mm print bed.

## Commands

- `npm install` — **always run first** before build/dev (dependencies are not checked in)
- `npm run dev` — start dev server (Vite)
- `npm run build` — type-check with tsc then build for production
- `npm run preview` — serve the production build locally

There are no tests or linters configured yet.

## Project structure

```
src/
  main.tsx            — React entry point
  App.tsx             — Root layout (desktop split pane, mobile tabs)
  MapSelector.tsx     — MapLibre GL map with search, geolocation, area framing
  ModelPreview.tsx    — Three.js 3D scene (React Three Fiber) with room/table/model
  useOverpassData.ts  — Hook that fetches and parses Overpass API data
  geometryUtils.ts    — Coordinate projection, polygon clipping, scaling math
  types.ts            — Shared TypeScript interfaces
  ReviewCarousel.tsx    — Auto-scrolling customer review carousel (compact/full modes)
  index.css             — Tailwind CSS entry point
```

## Key conventions

- TypeScript strict mode, all source in `src/`
- Functional React components with hooks throughout
- 3D rendering via React Three Fiber (not raw Three.js)
- Tailwind CSS for styling; inline `style` kept only for dynamic values and Canvas/Three.js gradients
- No state management library — local state and prop drilling
- External APIs: Overpass (OSM data), Nominatim (search), OpenStreetMap tiles

## Architecture notes

- Coordinates flow: lat/lon → local metres → model millimetres (200mm max)
- Polygon clipping uses Sutherland-Hodgman algorithm in `geometryUtils.ts`
- Building heights come from OSM tags (`height`, `building:levels`), with random fallback
- If Overpass API fails, mock data is generated so the UI still works
- Mobile breakpoint is 768px — switches from split view to tab view

## Resource usage

Be kind to the user's device — this app runs heavy WebGL workloads and targets mobile too.

- **One WebGL context at a time.** Never mount multiple Three.js `<Canvas>` instances simultaneously. The product gallery uses sequential render-to-image: mount one Canvas, capture a JPEG screenshot, unmount it, then move to the next angle. After capture, views display as lightweight `<img>` tags.
- **Show progress immediately.** When the user clicks Generate, give instant visual feedback (disable button, scroll to loading animation) before any network request completes. Show per-view progress as gallery images render sequentially.
- **Prefer static images over live 3D.** Only use a live interactive Canvas when the user explicitly opens the 3D viewer overlay. Everything else should be a captured image.
- **Dispose between renders.** Add a short delay (~150ms) between unmounting one Canvas and mounting the next so the browser can reclaim GPU memory.
- **Keep geometry lean.** ExtrudeGeometry is expensive — avoid duplicating it across multiple contexts. Shadow maps (2048x2048) are heavy; don't run multiple shadow-casting lights in parallel contexts.
