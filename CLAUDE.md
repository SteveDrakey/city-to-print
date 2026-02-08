# CLAUDE.md

## Project overview

City-to-print is a React web app that turns real-world map areas into 3D-printable city models. Users pick an area on an interactive map, the app fetches OpenStreetMap data (buildings, roads, water), and renders a 3D preview scaled to a 200mm x 200mm print bed.

## Commands

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
```

## Key conventions

- TypeScript strict mode, all source in `src/`
- Functional React components with hooks throughout
- 3D rendering via React Three Fiber (not raw Three.js)
- No CSS framework — inline styles
- No state management library — local state and prop drilling
- External APIs: Overpass (OSM data), Nominatim (search), OpenStreetMap tiles

## Architecture notes

- Coordinates flow: lat/lon → local metres → model millimetres (200mm max)
- Polygon clipping uses Sutherland-Hodgman algorithm in `geometryUtils.ts`
- Building heights come from OSM tags (`height`, `building:levels`), with random fallback
- If Overpass API fails, mock data is generated so the UI still works
- Mobile breakpoint is 768px — switches from split view to tab view
