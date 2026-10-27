# Sun & arcs prototype

Branch: `prototype/parametric-sun-arcs`. Start with `npm run dev`, open
`http://localhost:3000/prototypes/sun-arcs`. No deployment required.

The default is based on visual inspection of the user's attached geo.jpg.
The earlier Library reference download failed in this executor; the direct image
attachment resolved pixel access. The three concentric arc families mask the
sun/rays and one another, ordered back to front. This is a recreation, not a trace.

## Construction and isolation

`modules/prototypes/sun-arcs-params.js` contains defaults, limits and presets.
`modules/prototypes/sun-arcs.js` constructs OpenCascade solids, subtracts each
family's footprint, fuses its rings, clips to a 30 mm disk and fuses a 0.65 mm rim.
Using solid booleans avoids the coincident-boundary failure observed with 2D unions.
The API uses the existing OpenCascade loader; the UI uses the existing Three.js
PendantViewer, with post-processing disabled for this experiment. Existing chart
geometry, UI and API code are unchanged. The only shared configuration addition
is WASM tracing for the new API route. Intermediate and final solids are released.

The page automatically builds the default, then builds on explicit Generate.
Controls are disabled while a request is running. Changing controls marks the
preview stale. Export rebuilds from the current parameters and downloads binary
STL in millimetres, so it does not silently export an older displayed model.

## Controls

| Parameter | Range | Default |
|---|---|---|
| Arc families | 1–5 | 3 |
| Rings per family | 1–5 | 3 |
| Rays before masking | 6–32 | 16 |
| Stroke | 0.3–0.8 mm | 0.45 |
| Requested ring spacing | 2–3.5 mm | 3.1 |
| Depth | 0.6–2.4 mm | 1.2 |

Counts are rounded and all values clamped server-side. Non-numeric/non-finite
values return 400. Ring spacing is reduced when necessary to preserve a 1.3 mm
innermost radius; increasing rings therefore does not invert circles. Visible
ray count can be lower than requested because families clip the rays. Family
centres and ordering are fixed deliberately; presets Reference, Quiet, Waves and
Bold explore different counts and thicknesses.

## Verification

`npm run build` and `npx tsc --noEmit` pass. The repository's `npm test` is an
unimplemented placeholder. With the dev server running, execute:

```
python3 scripts/prototypes/check-sun-arcs.py
```

The script tests low/default/high, Waves and repeated default builds; exports
STL for each; validates binary length, welded edge incidence and connectedness.
All five tested meshes have one connected component and zero nonmanifold/boundary
edges (vertices welded to 0.0001 mm). Final default export: 8,312 triangles;
low: 4,700; high: 12,172; Waves: 12,996. Default regeneration repeats 2,396
preview triangles. These sampled results do not certify all parameter combinations.

Headless Chromium checks passed: automatic default, all four presets, repeated
regeneration, reset, browser STL download, mobile width without horizontal
overflow, and no page JavaScript errors. A final orbit check confirmed changed
rendered pixels after dragging; the responsive canvas measured 330 px in a
390 px viewport without overflow. Reference/Quiet/Waves/Bold screenshots
were captured; default was inspected against the supplied image. Existing
Graphik/Moulin font requests return 404 and fall back to system fonts.

## Limitations

No bail, chain, edge fillets, polishing allowance, minimum-gap certification,
casting simulation or strength validation. Sharp corners and thin features are
intentional experimental geometry. Higher density can close openings; additional
combinations may produce islands. Meshing checks are not a BREP validity or
manufacturing certification. The synchronous CAD kernel serializes work in each
server process; it is suitable for this local prototype, not a hardened public
CAD service. Only STL export is implemented, not STEP. No PR or deployment made.

Preview persistence: Library prepared-upload helper failed before preparation with
`hosted apps tools/list request failed: network`. No confirmed Library IDs exist;
local previews and STL files are under `/workspace/scratch/previews/`.
