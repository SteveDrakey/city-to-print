# city-to-print

Turn any place in the world into a 3D-printable city model.

Pick an area on the map, and the app fetches real building, road, and water data from OpenStreetMap, then generates a 200mm x 200mm scale model you can preview in 3D right in the browser.

## How it works

1. **Search or browse** the interactive map to find the area you want
2. **Frame your selection** — a dashed rectangle shows exactly what will be printed
3. **Hit "Generate Preview"** — real data is pulled from OpenStreetMap (buildings with actual heights, roads, rivers, lakes)
4. **Rotate and inspect** the 3D preview, shown sitting on a table so you can see how the final print will look
5. **Send to your 3D printer**

## What's in the model

- **Buildings** with real heights from OpenStreetMap (or estimated from floor count)
- **Roads** at varying widths based on type (highways wider than paths)
- **Water features** — rivers, lakes, reservoirs
- **A base plate** that everything sits on (4mm thick)

All geometry is clipped and scaled to fit a 200mm x 200mm print bed.

## Running locally

```bash
npm install
npm run dev
```

## Tech stack

React, TypeScript, Vite, Three.js (via React Three Fiber), MapLibre GL, and OpenStreetMap data via the Overpass API.
