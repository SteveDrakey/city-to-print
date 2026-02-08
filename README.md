# city-to-print

Turn any place in the world into a miniature 3D-printed model you can hold in your hand.

Ever wanted a physical model of your neighbourhood, a favourite holiday spot, or the city you grew up in? This app makes it possible. You pick a spot on the map, and it builds a detailed scale model — complete with buildings, streets, and waterways — that you can preview on screen and then 3D print.

## How to use it

1. **Find your location** — type a place name into the search bar, or just scroll around the map
2. **Frame the area** — a dashed rectangle on the map shows exactly what will end up in your model. Zoom in for a few streets, zoom out for a whole neighbourhood
3. **Generate a preview** — hit the button and the app pulls in real-world data: actual building shapes and heights, road layouts, rivers, and lakes
4. **Inspect your model in 3D** — spin it around, zoom in, and see how it'll look sitting on your desk
5. **Print it** — the model is sized at 200mm x 200mm (about 8 inches square), ready for a standard 3D printer

No design skills needed. No 3D modelling software. Just pick a place and go.

## What ends up in the model

- **Buildings** — real shapes and heights pulled from map data. Tall buildings are taller, small ones are shorter
- **Streets and roads** — major roads appear wider than side streets and footpaths
- **Water** — rivers, lakes, and reservoirs show up as flat blue features
- **A base plate** — everything sits on a solid base so the print holds together

---

## Development

### Setup

```bash
npm install
npm run dev
```

Then open the URL shown in your terminal.

### Build

```bash
npm run build      # type-check (tsc) + production build (vite)
npm run preview    # serve the production build locally
```

### Project structure

```
src/
  main.tsx            — entry point
  App.tsx             — root layout (split pane on desktop, tabs on mobile)
  MapSelector.tsx     — interactive map with search and area framing
  ModelPreview.tsx    — 3D scene with room, table, and city model
  useOverpassData.ts  — fetches and parses OpenStreetMap data
  geometryUtils.ts    — coordinate projection, polygon clipping, scaling
  types.ts            — shared TypeScript interfaces
```

### Tech stack

- **React 18** + **TypeScript** — UI and type safety
- **Vite** — dev server and bundler
- **Three.js** via **React Three Fiber** / **Drei** — 3D rendering
- **MapLibre GL** — interactive map
- **Overpass API** — building, road, and water data from OpenStreetMap
- **Nominatim API** — location search
