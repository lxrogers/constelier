# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

"Constelier" — a natal chart (astrology) pendant generator. Users input birth details, the app computes planetary aspects as chord lines inside a circle, and renders them as both a 2D SVG chart and a 3D gold pendant with filleted edges.

## Design direction

What the owner is going for, written down from the homepage work in November 2026. These are observations of what was asked for and what was rejected; where they are a reading rather than a stated rule, they say so. Ask before departing from them.

### The feel
- Warm, soft and quiet, closer to a wellness or fine-jewelry brand than a storefront. The stated reference for the homepage layout is ouraring.com. A white, bold-sans, sportswear-style storefront was tried first and dropped.
- One look only: the cream theme. Page `#f6f1ea`, warm charcoal ink `#3a3834` (never pure black), hairlines in a slightly darker cream. The dark, night and mono themes were tried and abandoned; do not bring them back unasked.
- The gold is the only strong colour on the page, and it comes from the pendant itself. (Reading: no accent colours competing with it.)
- Type: Instrument Serif for headlines (it replaced Moulin), light and in sentence case; Graphik for body and controls; the CONSTELIER wordmark in Bodoni Moda caps. No uppercase shouting, no heavy weights.

### Pictures
- Photography leads. Show the real thing: realistic renders of the pendant on stone or against a wall in sunlight, the maker at the bench, and the real configurator on screen. No illustrations or abstract decoration standing in for the product.
- The story is craft: "Handcrafted in Brooklyn, New York", made by hand, one piece per person.
- Stand-in images are fine while the real one is being made, as long as they are marked as stand-ins in the code.

### Chrome and layout
- Plain and calm. The nav is a full-width bar pinned to the top, solid page colour with a hairline, with room on the right for the bag and later an account icon. No floating or card-style nav.
- Do not stack card on card. The configurator's control panel is already a card, so nothing else near it should be a second panel with its own background.
- No announcement bars. One clear action per section ("Design yours"); extra buttons were removed when offered.
- Labels stay minimal: "1, 2, 3" rather than "01 Design".
- Rounded picture cards (about 14px), generous spacing, native scrolling, gentle fade-and-rise on entry.

### Copy
- Short, plain and concrete. A specific line ("Handcrafted in Brooklyn, New York") beats a generic one ("How it's made", which the owner called lame).
- Do not invent claims about materials, process, shipping or customers. Reuse what the site already says or ask.

### Polish
- Things must separate cleanly from what is behind them. A sheet the same colour as the page reads as a mistake; give it a white surface and a soft shadow, or a hairline.
- The homepage and the configurator should read as one site: same wordmark size, same nav treatment, same palette.
- Check work in a real browser at desktop and phone widths before calling it done.
- No leftovers. When a direction is dropped, delete its pages, components, styles, images and any code that only existed for it, rather than keeping them "for comparison".
- The owner works by trying things quickly ("let's try it") and reacting to what is on screen, so make the change and show it rather than describing options at length.

## Commands

- `npm run dev` — Start Next.js dev server (Turbopack)
- `npm run build` — Production build
- `npm run start` — Serve production build
- `npm run release` — Move the `production` branch up to `main`. `main` is staging (staging.constelier.com, its own database); `production` is the live site. See `docs/environments.md`.
- No test suite configured

## Architecture

The project has two parallel entry points for the same core logic:

### Standalone HTML (primary, feature-complete)
- **`natal-chart.html`** — Main application. Self-contained single-page app with inline styles, imports ES modules via importmap. Contains the full natal chart UI: birth data inputs, SVG chart rendering, 3D pendant overlay, aspect filtering, and geocoding.
- **`viewer.html`** — Standalone aspect viewer with adjustable parameters (expansion, fillet, border, min area/angle) and 3D pendant preview.
- **`3d-viewer.html`** — Isolated 3D pendant preview tool with mesh quality controls.

### Next.js App (`src/`)
- Uses the App Router (`src/app/`). `/` is the homepage (`src/app/page.tsx`, with its parts in `src/app/halo/`); `/chart` is the configurator.
- The homepage hero is a live film, not a picture (`src/app/halo/hero/`): the real chart engine draws a chart and makes its pendant, and `hero-director.ts` films them in four cut shots. The 2D chart is printed on the paper under the pendant by the traced-gold shader. The last shot's eleven other pendants are pictures in `public/hero/grid/`, retaken in dev at `/?grid=1`. Its outlines are made ahead of time (`public/hero/outlines/`, remade in dev at `/?outlines=1`); they record the pendant defaults they were made for and are ignored when those change, so remake them after changing `pendant-defaults.json`.
- `src/app/chart/page.tsx` renders the `NatalChart` component (`src/app/chart/NatalChart.tsx`), which drives the chart engine.
- `src/lib/horoscope.ts` re-exports from the root `horoscope-bundle.js`.
- Tailwind CSS v4 via `@tailwindcss/postcss`. Graphik is in `public/fonts/`; Instrument Serif (headlines) and Bodoni Moda (wordmark) load through `next/font` in `src/app/layout.tsx`.

### Pendant settings and the lab (`/lab`)
- `src/config/pendant-params.ts` defines every tunable setting (range, group, label). `src/config/pendant-defaults.json` holds the saved defaults that both `/chart` and `/lab` start from.
- `/chart` shows only params marked `prod: true` (none today). `/lab` shows all of them, previews 4 sample charts (`src/config/lab-samples.ts`), and has a 3D-print cart that downloads a zip of mm-scale STLs + `manifest.json`.
- "Save as default" in the lab POSTs to `/api/lab/defaults`, which rewrites the JSON file (dev only; commit the file to ship new defaults).
- The chart engine takes params via `initChartEngine(..., { params })` and `engine.setParams(partial, { draft })`.

### Quote requests, pendant pages and the admin panel
- The configurator's last step posts to `/api/quote-requests`, which saves the customer, their design and a `quote_requests` row (`src/lib/quotes/`).
- `/admin` (one password, `ADMIN_PASSWORD`) lists requests and, per request, edits the offer behind `/pendant/[offerId]` (`src/lib/commerce/offers-store.ts`) and sends and shows email and text (`src/lib/messaging/`, Twilio and Twilio SendGrid over plain HTTPS). Its address names the data shown: `/admin/production` or `/admin/staging` (`src/lib/admin/env.ts`).
- Flow, tables, env vars and provider setup: `docs/quotes-admin.md`.

### Shared ES Modules (`modules/`)
These are plain JS ES modules imported by both the standalone HTML files and the Next.js app:

- **`pendant-geometry.js`** — MakerJS-based 2D geometry: builds the pendant outline from aspect chords via `buildPendantModel()` (expand paths → boolean combine with circle → filter small regions → add border → apply fillets). Also `serializeChainsFor3D()` to extract chain data for the 3D pipeline.
- **`pendant-builder.js`** — Orchestrates WASM init and calls into replicad to produce 3D shapes (`buildPendant3DFromModel`, `buildRing3DShape`).
- **`replicad-pipeline.js`** — OpenCascade/replicad wrapper. Loads WASM from `/wasm/replicad_single.wasm`, converts serialized chain data into replicad drawings, extrudes, boolean-cuts voids, and applies 3D fillets.
- **`three-pendant-viewer.js`** — `PendantViewer` class: Three.js scene with PerspectiveCamera, OrbitControls, HDRI environment (`softbox.hdr`), post-processing (TAA, SMAA, color grading, vignette), shadow-casting directional + point lights, and cross-fade mesh transitions.
- **`easing.js`** — Easing functions for animations.

### Key Dependencies
- **MakerJS** — 2D CAD geometry (boolean ops, path expansion, chain finding, SVG export)
- **replicad + replicad-opencascadejs** — BREP solid modeling via OpenCascade WASM
- **Three.js** — 3D rendering with PBR materials, HDRI reflections, post-processing
- **circular-natal-horoscope-js** — Astrological calculations (bundled as `horoscope-bundle.js`)

### Path Aliases (tsconfig)
- `@/*` → `./src/*`
- `@/modules/*` → `./modules/*`

## Key Patterns

- The 3D pipeline is: MakerJS 2D model → `serializeChainsFor3D()` → `buildPendant3D()` (replicad BREP) → `PendantViewer.updateMesh()` or `.crossFadeMesh()` (Three.js rendering)
- WASM is loaded lazily on first 3D build; `preloadWASM()` can warm it up
- Fillet operations (both 2D MakerJS and 3D replicad) retry with progressively smaller radii on failure
- The standalone HTML files use `<script type="importmap">` to resolve bare specifiers for `three`, `three/addons/`, and `replicad` to `node_modules/` paths
- `next.config.js` enables async WebAssembly in webpack and sets immutable cache headers for `/wasm/` and `/softbox.hdr`

## Component & Abstraction Guidelines

The standalone HTML files (`natal-chart.html`, `viewer.html`, `3d-viewer.html`) are monoliths with everything inlined. As we migrate to the Next.js app, break things into focused, reusable pieces instead of replicating that pattern.

### Component structure
- One component per file. Name the file after the component (`BirthDataForm.tsx`, `ChartCanvas.tsx`, `PendantViewer3D.tsx`).
- Keep components small and single-purpose. If a component handles both form input and chart rendering, split it.
- Colocate component-specific styles, types, and helpers next to the component (e.g. `src/app/chart/components/ChartCanvas.tsx` with `ChartCanvas.css` alongside it).
- Page components (`page.tsx`) should be thin orchestrators — compose feature components, don't contain business logic.

### Separation of concerns
- **UI components** should own rendering and user interaction only. They receive data via props and emit changes via callbacks.
- **Hooks** (`src/hooks/`) for stateful logic that doesn't belong in a component: `useHoroscope()`, `usePendantBuilder()`, `useThreeViewer()`, etc. These wrap the imperative APIs from `modules/` and manage lifecycle (init, cleanup, loading states).
- **Pure logic** stays in `modules/` as plain JS/TS functions — no React imports, no DOM access. This keeps them usable from both the standalone HTML files and the React app.
- Don't mix Three.js or MakerJS imperative code directly into React component bodies. Wrap them in hooks or refs.

### Extracting from the monoliths
When porting logic from the HTML files into React:
- Identify distinct UI regions (birth form, chart SVG, aspect filters, planet table, 3D overlay) and make each its own component.
- Pull inline constants (SIGNS, PLANET_GLYPHS, ASPECT_STYLES, etc.) into shared files under `src/lib/` or `src/constants/`.
- Convert imperative DOM manipulation (createElement, addEventListener, style mutations) into declarative React — state + JSX.
- Canvas/WebGL elements should live inside a dedicated component that manages the renderer via `useRef` + `useEffect`.
