# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

"Constelier" — a natal chart (astrology) pendant generator. Users input birth details, the app computes planetary aspects as chord lines inside a circle, and renders them as both a 2D SVG chart and a 3D gold pendant with filleted edges.

## Commands

- `npm run dev` — Start Next.js dev server (Turbopack)
- `npm run build` — Production build
- `npm run start` — Serve production build
- No test suite configured

## Architecture

The project has two parallel entry points for the same core logic:

### Standalone HTML (primary, feature-complete)
- **`natal-chart.html`** — Main application. Self-contained single-page app with inline styles, imports ES modules via importmap. Contains the full natal chart UI: birth data inputs, SVG chart rendering, 3D pendant overlay, aspect filtering, and geocoding.
- **`viewer.html`** — Standalone aspect viewer with adjustable parameters (expansion, fillet, border, min area/angle) and 3D pendant preview.
- **`3d-viewer.html`** — Isolated 3D pendant preview tool with mesh quality controls.

### Next.js App (`src/`)
- Uses the App Router (`src/app/`). Root `/` redirects to `/chart`.
- `src/app/chart/page.tsx` renders a `NatalChart` component (currently references an unbuilt component).
- `src/lib/horoscope.ts` re-exports from the root `horoscope-bundle.js`.
- Tailwind CSS v4 via `@tailwindcss/postcss`. Custom fonts (Graphik, Moulin) in `public/fonts/`.

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
