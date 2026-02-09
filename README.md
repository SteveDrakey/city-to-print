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

### Payments (Stripe)

Checkout uses the [Stripe Checkout Sessions API](https://docs.stripe.com/api/checkout/sessions) via a Vercel serverless function. The server creates a Checkout Session with the model details (location name, map bounds, shipping) baked into metadata — no sensitive data passes through query params.

**How it works:**

1. User clicks **Pay** on the order summary
2. Frontend POSTs `{ bounds, locationName, shippingRegion }` to `/api/create-checkout-session`
3. The serverless function creates a Stripe Checkout Session with line items, shipping, and metadata
4. User is redirected to the Stripe-hosted checkout page (supports Apple Pay, Google Pay, cards)

**Setup:**

1. Create a [Stripe account](https://dashboard.stripe.com/register)
2. Enable **Apple Pay** and **Google Pay** in Dashboard → Settings → Payment methods
3. Copy your **Secret key** from Dashboard → Developers → API keys
4. Add it as an environment variable in Vercel (or in a local `.env`):

```
STRIPE_SECRET_KEY=sk_test_xxx
```

That's it — no products, prices, or payment links to create in the Dashboard. The serverless function creates line items on the fly (£40 model + £5 UK / £15 international shipping).

**Local development:**

The `/api/` route is a Vercel serverless function and won't run under `vite dev`. To test checkout locally, use the [Vercel CLI](https://vercel.com/docs/cli):

```bash
npm i -g vercel
vercel env pull .env.local   # pulls your env vars from Vercel
vercel dev                    # runs both Vite and serverless functions
```

See `.env.example` for reference.

### Tech stack

- **React 18** + **TypeScript** — UI and type safety
- **Vite** — dev server and bundler
- **Three.js** via **React Three Fiber** / **Drei** — 3D rendering
- **MapLibre GL** — interactive map
- **Overpass API** — building, road, and water data from OpenStreetMap
- **Nominatim API** — location search
