# Continuous-wave ring studio

Branch: `prototype/ring-studio-wave`. Route: `/prototypes/rings`.
Start `npm run dev` and open that route. Production build: `npm run build`.
The astrology pendant and sun-arcs prototype are unchanged. No production release.

![Tide in the ring studio](rings/tide.png)

## Source and visual review status

The actual algorithm reference was inspected from
`lxrogers/generative-rings-testing` commit
`eee66e5d256c7cec17bf3d7cbaa7f966ff39dfbc`: `ring.js`, `lib.js`,
`ringGUI.js`, and `index2.js`. This implementation retains its direct indexed
cross-section-loop construction and axial/radial wave idea. It replaces the
arbitrary radius, discontinuous exterior modifier and unbounded GUI resolution
with millimetres, smooth sections and explicit budgets. No CAD booleans,
multi-ring CSG, noise, or subdivision run during dragging.

Constelier's viewer, actual `public/softbox.hdr`, and the sun-arcs source at
`97fe1f12a11f10b97583e876d529561a17f0e5d6` were read for rendering. The ring uses
its own camera, lighting and viewer; geometry is never scaled for display.

**Reference-photo comparison remains blocked.** All eight supplied Library IDs
resolved, but the current supported materialization helper returned `download
failed` for every signed transfer in this executor. No image pixels were
available locally. Library read returned captions/pointers, which are not pixel
inspection. Therefore these are provisional authored presets, not a claim to
have matched the photos. The supplied references must be viewed before the
parent accepts the visual-match gate or expands to other families.

Actual rendered screenshots were inspected and revised: the initial hard shadow
became a blurred contact shadow, the 4096×2048 HDR reflection input was capped,
and the neutral diagnostic material was darkened to reveal contours. Gold,
neutral, top, profile, close-up, extreme and mobile views were captured.
[Ribbon](rings/ribbon.png), [Swell](rings/swell.png), [Clay close-up](rings/clay.png).
Library saving of these screenshots failed before upload preparation with
`hosted apps tools/list request failed: network`; no Library items were created.
The review images are consequently retained here on the isolated branch.

## Shape and controls

Finger axis is Y; X/Z form the ring plane. At each angular station the band
section is a convex superellipse (exponent 2–8), with independent axial width
and radial thickness. This produces real rounded edges, not a shading-only bevel.
The axial center follows an integer-period sine. Radial variation adds material
only outside the bore. The inner sample radius compensates for polygon chord
inset and includes a 0.002 mm numerical margin, preserving the requested
cylindrical clearance over triangle interiors as well as vertices.

| Control | Domain |
|---|---|
| Inside diameter | 14–24 mm, 0.1 mm increments |
| Band width | 1.4–7 mm, 0.1 mm increments |
| Radial thickness | 1.2–3.2 mm, 0.05 mm increments |
| Section | ellipse to rounded square, 0–1 |
| Wave count | 1–6, integer only |
| Axial wave | 0–2.8 mm, additionally limited to 0.75 × bore radius / wave count |
| Radial variation | 0–2 mm, 0.05 mm increments |

Every value is finite, clamped and quantized to its UI step. Coupled amplitude
limits round down to a supported step, with a visible explanation. This fixed a
browser-discovered mismatch where a 1.64 mm clamp rendered a 1.65 mm slider.
Invalid/nonfinite imported values are rejected. Design links contain a versioned
JSON fragment; JSON download and three presets are reproducible.

## Small interface for the next family workers

Keep the worker assignments disjoint:

- Liquid-accent owner: `modules/rings/liquid-accent.mjs` and its own
  `scripts/rings/liquid-accent.test.mjs` only.
- Ribbed/faceted owner: `modules/rings/faceted.mjs` and its own
  `scripts/rings/faceted.test.mjs` only.
- Integration owner: `modules/rings/families.mjs`, the route components, worker,
  renderer and shared validators. Do not have both family workers edit these.

`families.mjs` currently registers only `wave`. Each new module should provide:

```js
{
  id, name,
  controls: [{ key, label, min, max, step, unit, group }],
  presets: [{ id, name, note, params }],
  normalize(input): { params, adjustments: string[] },
  build(input, quality /* preview | settled | export */): Mesh,
  serialize(input): string, // JSON { version: 1, family: id, params }
  parse(text): { params, adjustments }
}
```

`Mesh` is a plain transferable object, with no Three.js or DOM dependency:

```js
{
  positions: Float32Array, // xyz in mm; Y finger axis; origin at ring center
  normals: Float32Array,  // one finite unit outward normal per vertex
  indices: Uint32Array,   // indexed CCW triangles, welded periodic seams
  params, adjustments, family, units: 'mm', quality,
  resolution: { loops, sections }, // optional for non-loop families; used by wall sampling
  bounds: { minY, maxY },
  dimensions: { innerDiameter, minRadialWall, axialSectionWidth },
  generationMs
}
```

Provide `params.innerDiameter`; shared validation uses it as required clearance.
`RingStudio.update(mesh)` preserves orbit and accepts the same mesh contract.
`RingControls` takes schema/params/callback. The worker selects the registered
builder and rejects invalid geometry; the parent can add a family picker after
accepting this milestone. Avoid cloning the viewer or changing other families.

Shared utilities:

- `validate.mjs`: topology, signed volume, finite/unit normals, triangle-interior
  clearance, BVH nonadjacent triangle intersection tests (including coplanar).
- `wall.mjs`: 256 distributed inward-normal ray chords, including extrema;
  detects missing/backfacing opposite surfaces and reports a sampled minimum.
- `stl.mjs`: binary STL from the same mm geometry, with no display transform.
- `studio.ts` / `contact-shadow.ts`: HDR gold, neutral inspection, orbit/resize,
  bounded reflection textures and a fixed 512px blurred contact shadow.

## Bounded interaction

One active preview worker job plus one replaceable pending job. Stale replies
never replace the latest geometry. A 220 ms quiet interval requests settled
validation. Preview performs structural checks; settled/export additionally run
intersection and wall checks. Export captures parameters at click time in one
temporary worker, terminated on completion/error/30 s timeout.

| Quality | Typical triangles | Maximum supported triangles |
|---|---:|---:|
| Drag preview | 6,144 | 6,912 |
| Settled | 20,480 | 23,040 |
| STL export | 65,536 | 73,728 |

The defensive hard budget is 98,304 triangles; user inputs cannot select mesh
resolution. Generation is O(vertices + triangles); BVH validation is bounded by
that fixed mesh budget. No exponential subdivision or boolean cascade exists.
Old BufferGeometry is disposed on each update; materials/environment are reused.
Rendering is demand-driven, with no idle animation loop. Pixel ratio is capped
at 1.75 and 2.5 million framebuffer pixels. PMREM input is 1024×512 (256px cube
faces), reduced from the actual shared 4096×2048 HDR before GPU upload.

## Verification, 2026-10-30

`npm run build`, `npx tsc --noEmit`, `git diff --check` and `npm run test:rings`
passed. The existing generic `npm test` remains the repository's unimplemented
placeholder; the new ring-specific command is explicit.

The 73 tests cover validator failure fixtures, 127 generated meshes (100 seeded
random settled cases), nine binary STL parse/weld/revalidation round trips,
and 51 sampled-wall cases including 30 further seeded cases. No boundaries,
nonmanifold edges, inconsistent winding, degenerate triangles or nonadjacent
intersections were found. Minimum tested bore margin: 0.0019995 mm.
13,056 wall rays had zero misses/backfacing hits; smallest sampled chord was
1.016109 mm. Settled/export shapes are rejected if the sampled minimum falls
below 0.8 mm or a wall ray fails.

Uncontended Node 24 measurements (median of five, generation + applicable checks):

| Shape / quality | Generation | Total |
|---|---:|---:|
| Tide / preview | 1.33 ms | 21.65 ms |
| Tide / settled | 2.17 ms | 210.91 ms |
| Tide / export | 6.91 ms | 695.16 ms |
| Maximum / preview | 0.71 ms | 9.39 ms |
| Maximum / settled | 2.18 ms | 233.44 ms |
| Maximum / export | 7.37 ms | 848.66 ms |

The 1,000-generation preview stress test had 0.50 ms median / 0.68 ms p95,
zero retained typed-array growth after GC, and stable RSS. These are cloud
measurements, not a universal device performance promise. [Raw timings](rings/timings.json).

Production-build browser check:

```sh
npm run build
npm run start -- --port 3001
RING_URL=http://localhost:3001/prototypes/rings npm run test:rings:browser
```

Headless Chromium with SwiftShader passed real drags of every slider (changed
pixels and latest parameters), presets/reset, orbit preservation, camera changes,
export, serialized-link reload, and mobile resize without overflow. A 192-move
drag sequence took 19.3 s on this software renderer, followed by 600 rapid input
events; geometry/texture allocation counts stayed at 3/4, the latest input won,
and idle rendering stopped. The browser's downloaded 65,536-triangle STL was
byte-for-byte identical to the validated default export (3,276,884 bytes).
[Browser evidence](rings/browser-evidence.json).

A separate held-pointer check confirmed that all seven sliders publish changed
geometry before releasing the pointer, not just after the settled debounce.
[Live-drag evidence](rings/live-drag-evidence.json).

## Preview deployment and authenticated verification

The Git integration created an isolated Preview for this branch in the existing
`constelier` project (`prj_e3FiZ4CCDnnoisZKsHUBFnbCF80R`), team
`team_UToweekwD5EbaXmKZnUJaf9i`. The branch preview is:

https://constelier-git-prototype-rin-e1f435-lawrences-projects-c9c8f187.vercel.app/prototypes/rings

The first reviewed runtime commit was
`6f4dfbc0b4c23e44fc4ab2d0622b3d810ed51179`; subsequent verification/documentation
commits leave that runtime code unchanged. Deployment protection remains enabled.
Route, all app scripts, the actual 14,443,345-byte HDR and fonts were fetched with
same-project development OIDC authentication. Hosted browser checks exercised
all seven sliders, presets, orbit, resize, design-link reload and STL download.
The optional platform feedback script at `vercel.live/_next-live/feedback/feedback.js`
is blocked by this cloud environment's destination policy. That failure is
recorded separately from application failures; it is not required by the studio.

Reproduce authenticated verification with the exact Preview URL:

```sh
RING_URL=https://<exact-preview>.vercel.app/prototypes/rings \
RING_EVIDENCE=/workspace/ring-evidence/deployed \
python3 scripts/rings/check-protected-preview.py
```

The helper uses the configured Vercel API credential to obtain a short-lived
development OIDC token via the official SDK's refresh endpoint. It does not
persist/print tokens or change access settings. The cloud proxy CA is trusted by
Node but not Chromium's separate CA store, so Playwright routes same-origin
requests through its TLS-verified request stack, then supplies the actual
deployed responses to the browser. Certificate checking stays enabled and the
credential is never forwarded across an origin redirect.

## Limits

This is a reviewable prototype, not casting certification. Numeric intersection
tests exclude triangle pairs sharing indexed vertices; they are not an exact
arithmetic proof against every possible local fold. The periodic convex-section
construction and restricted controls reduce that risk, and tested extrema are
clean, but this must remain explicit for future geometry families.

Radial wall is an exact section dimension, while inward-normal chords are a
finite sampled diagnostic. Neither is a proof of the continuous shortest 3D wall
thickness. No strength, comfort, polishing allowance, shrinkage or casting
simulation is included. A jeweller should review the exported STL before making
a ring. Preview and export sample the same shape definition at different
resolutions; preview is intentionally coarser during interaction.

No liquid-accent or faceted family is implemented here. Image matching remains
pending the reference transfer, independently of the completed source/geometry,
rendering and interaction work.
