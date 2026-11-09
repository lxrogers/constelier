# Organic outline comparison

Scripts that compare today's 2D pendant outline with the three organic
options in `modules/organic/` (tapered, liquid, pebble) on four fixed charts.
Run everything from the repo root. Output goes to `tools/organic-compare/out/`
(gitignored).

```
node tools/organic-compare/run2d.mjs [algorithm]     # 2D outlines, SVGs, metrics.json
node tools/organic-compare/build3d.mjs [filter]      # replicad solids + edge fillet, meshes
node tools/organic-compare/render.mjs tools/organic-compare/out [filter]   # gold PNGs
node tools/organic-compare/svgs.mjs                  # flat outlines for a comparison page
node tools/organic-compare/scan.mjs                  # sweep many charts for dropped voids
node tools/organic-compare/selfx.mjs <name>          # self-intersection check on one outline
```

- Charts: sparse 1977-10-14, medium 1996-10-14, dense 1987-02-14, busiest
  1997-02-14, all 9:30 New York. Same parameters as the chart page
  (r 100, bar half-width 3, border 8, min area 185).
- `build3d.mjs` writes a patched copy of the OpenCascade loader to
  `vendor/` on first run, because Node can't load the shipped one directly.
- `render.mjs` is a small software rasterizer with a fake softbox
  environment, for side-by-side images without a browser. It is not the
  site's Three.js look.
- Metrics: `minWire` is the narrowest metal between two voids or a void and
  the rim; `minR` is the tightest curvature radius on any void outline.
