# Blender renders

Photo-shoot style stills of the pendant, rendered with Cycles. Everything is
built at real size (25 mm pendant, 100 mm macro lens), with one jump ring
through the bail and a cable chain through that ring.

```sh
node tools/blender/export-meshes.mjs      # sample pendants (saved defaults) -> meshes/*.stl
tools/blender/fetch-hdris.sh              # CC0 studio HDRIs from Poly Haven -> hdri/
/Applications/Blender.app/Contents/MacOS/Blender -b --factory-startup \
  -P tools/blender/render.py -- --scene all --pendant nyc-1990
```

Scenes: `studio-soft` (cream paper flat-lay), `studio-grey` (hanging, grey
seamless), `oxblood` (deep red paper, hard light), `stone-sun` (travertine,
window light), `wall-dangle` (hanging by a plaster wall, casting its shadow),
`night-sky` (bokeh stars), `eclipse` (black glass, corona).

Useful flags: `--scale 40 --samples 64` for a ten-second preview, `--blend`
to save the scene as a .blend to open and adjust, `--frame 24 --aim 0,0,17`
to zoom the camera in on a detail (mm).

The polished face is a flat mirror, so each scene places a gradient "mirror
card" exactly where the camera sees it reflected; that card's strength and
gradient set how the gold face reads.

## Rendering on Modal (off this machine)

`modal_render.py` runs the same `render.py` on Modal GPUs, one container per
scene/pendant pair, in parallel, and writes the PNGs back to `renders/`.

One-time setup:

    python3 -m venv tools/blender/.venv
    tools/blender/.venv/bin/pip install modal
    tools/blender/.venv/bin/modal token new      # opens the browser to log in

Then:

    tools/blender/.venv/bin/modal run tools/blender/modal_render.py --scene all --pendant nyc-1990

`--scene` and `--pendant` take one name, a comma list, or `all`; `--scale` and
`--samples` work as they do locally. The `meshes/` and `hdri/` folders are
uploaded with the script, so run `export-meshes.mjs` and `fetch-hdris.sh` first.
The first run builds the image (downloads Blender for Linux), which takes a few
minutes; later runs reuse it.

GPUs (the default, an L4) need a payment method on the Modal account. Without
one, prefix the command with `RENDER_CPU=1` to render on 16 CPU cores instead:

    RENDER_CPU=1 tools/blender/.venv/bin/modal run tools/blender/modal_render.py --scene all --pendant nyc-1990

All seven scenes at full quality take about 3.5 minutes that way.

## Render API (deployed on Modal)

The same Modal app serves an HTTP API for the two production scenes: the
pendant against a wall (`wall`) and on speckled stone (`stone`). You send a
pendant STL; it measures the bail, threads the ring and chain, and renders.

Deploy (or redeploy after editing `render.py`):

    RENDER_CPU=1 tools/blender/.venv/bin/modal deploy tools/blender/modal_render.py

Base URL: `https://lawrence-x-rogers--constelier-renders-api.us-east.modal.run`

Every request needs a Modal proxy auth token (Modal dashboard > Settings >
Proxy Auth Tokens), sent as `Modal-Key` and `Modal-Secret` headers.

Start a render (returns at once with an id):

    curl -X POST "$URL/renders?scene=wall&quality=standard" \
      -H "Modal-Key: $MODAL_KEY" -H "Modal-Secret: $MODAL_SECRET" \
      --data-binary @pendant.stl

    {"id": "fc-...", "status_url": "/renders/fc-...", "scene": "wall-rest", "width": 1600, "height": 2000, "samples": 400}

Fetch it (202 with `{"status": "rendering"}` until done, then the PNG):

    curl "$URL/renders/fc-..." -H "Modal-Key: $MODAL_KEY" -H "Modal-Secret: $MODAL_SECRET" -o render.png

| Parameter | Values | Default |
|---|---|---|
| `scene` | `wall`, `stone` | `wall` |
| `quality` | `draft` (960 px wide, 128 samples), `standard` (1600, 400), `high` (2400, 700) | `standard` |
| `width` | 320-3600 px, overrides the preset; height is width x 1.25 | |
| `samples` | 16-2000, overrides the preset | |

The STL must be binary, in millimetres, with the bail toward -y and the disc
centred on the origin, which is what the app's exporter writes. A mesh with no
bail hole fails with a 422. Results are kept for 7 days.
