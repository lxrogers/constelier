# Render the pendant scenes on Modal GPUs instead of this machine.
#
#   tools/blender/.venv/bin/modal run tools/blender/modal_render.py \
#       --scene all --pendant nyc-1990
#
#   --scene    one scene, a comma list, or "all"
#   --pendant  one mesh id, a comma list, or "all"
#   --scale    resolution percentage (100 = 2400x3000)
#   --samples  Cycles samples
#   --out      local output folder (default tools/blender/renders)
#
# Prefix the command with RENDER_CPU=1 to use 16 CPU cores instead of an L4 GPU
# (slower, but needs no payment method on the Modal account).
#
# Each scene/pendant pair renders in its own container, in parallel, with the
# same render.py, meshes and HDRIs as a local run. The PNGs come back here.
# Run export-meshes.mjs and fetch-hdris.sh first: both folders are uploaded.
import os
import modal

HERE = os.path.dirname(os.path.abspath(__file__))
BLENDER_URL = 'https://download.blender.org/release/Blender5.3/blender-5.3.0-linux-x64.tar.xz'
BLENDER_SHA256 = 'dacb8264197a3f7fda6001285a5a506fc97ee943881261c2c3bd63c882f22e05'
SCENES = ['studio-soft', 'studio-grey', 'oxblood', 'stone-sun', 'wall-dangle', 'wall-rest', 'night-sky', 'eclipse']
PENDANTS = ['chicago-1995', 'nyc-1990', 'paris-1968', 'sydney-2010']

image = (
    modal.Image.debian_slim(python_version='3.11')
    .apt_install('wget', 'xz-utils', 'libx11-6', 'libxi6', 'libxxf86vm1', 'libxfixes3', 'libxrender1',
                 'libgl1', 'libegl1', 'libxkbcommon0', 'libsm6', 'libice6')
    .run_commands(
        f'wget -q {BLENDER_URL} -O /tmp/blender.tar.xz',
        f'echo "{BLENDER_SHA256}  /tmp/blender.tar.xz" | sha256sum -c -',
        'mkdir -p /opt/blender && tar -xJf /tmp/blender.tar.xz -C /opt/blender --strip-components=1',
        'rm /tmp/blender.tar.xz',
    )
    .pip_install('fastapi[standard]')
    .add_local_dir(os.path.join(HERE, 'meshes'), '/work/meshes')
    .add_local_dir(os.path.join(HERE, 'hdri'), '/work/hdri')
    .add_local_file(os.path.join(HERE, 'render.py'), '/work/render.py')
)

app = modal.App('constelier-renders', image=image)


def _blender(args, out_name):
    import subprocess
    cmd = ['/opt/blender/blender', '-b', '--factory-startup', '-P', '/work/render.py', '--', *args, '--out', '/tmp/out']
    run = subprocess.run(cmd, capture_output=True, text=True)
    keep = [l for l in run.stdout.splitlines() if l.startswith(('CYCLES', 'WROTE', 'GPU setup', 'STL INFO'))]
    print(*args, *keep, sep='\n  ')
    path = f'/tmp/out/{out_name}.png'
    if not os.path.exists(path):
        why = [l for l in (run.stdout + run.stderr).splitlines() if 'BAIL NOT FOUND' in l]
        raise RuntimeError(why[0] if why else f'render failed:\n{run.stdout[-3000:]}\n{run.stderr[-2000:]}')
    with open(path, 'rb') as f:
        return f.read()


def _render(scene: str, pendant: str, scale: int, samples: int) -> bytes:
    return _blender(['--scene', scene, '--pendant', pendant, '--scale', str(scale), '--samples', str(samples)],
                    f'{scene}_{pendant}')


# RENDER_CPU=1 asks for 16 CPU cores instead of an L4 GPU. It is an environment
# variable rather than a flag because Modal checks every registered function's
# hardware up front, and GPUs need a payment method on the account.
HARDWARE = dict(cpu=16, memory=16384, timeout=3600) if os.environ.get('RENDER_CPU') else dict(gpu='L4', timeout=1800)


@app.function(**HARDWARE)
def render(scene: str, pendant: str, scale: int, samples: int) -> bytes:
    return _render(scene, pendant, scale, samples)


@app.local_entrypoint()
def main(scene: str = 'all', pendant: str = 'nyc-1990', scale: int = 100, samples: int = 700, out: str = ''):
    scenes = SCENES if scene == 'all' else scene.split(',')
    pendants = PENDANTS if pendant == 'all' else pendant.split(',')
    out = out or os.path.join(HERE, 'renders')
    os.makedirs(out, exist_ok=True)
    jobs = [(s, p, scale, samples) for p in pendants for s in scenes]
    print(f'Rendering {len(jobs)} image(s) on Modal...')
    for i, png in enumerate(render.starmap(jobs)):
        s, p = jobs[i][:2]
        path = os.path.join(out, f'{s}_{p}.png')
        with open(path, 'wb') as f:
            f.write(png)
        print('WROTE', path)


# ───────────────────────── HTTP API ─────────────────────────
#
# Deployed with:  RENDER_CPU=1 tools/blender/.venv/bin/modal deploy tools/blender/modal_render.py
#
#   POST /renders?scene=wall|stone&quality=draft|standard|high[&width=..][&samples=..]
#        body: the pendant STL (binary; mm, bail toward -y, as the app exports it)
#        -> 202 {"id": ..., "status_url": "/renders/<id>"}
#   GET  /renders/<id>
#        -> 202 {"status": "rendering"}   while it runs
#        -> 200 image/png                 when done (kept for 7 days)
#        -> 422 / 500 {"status": "failed", "error": ...}
#
# Every request needs a Modal proxy auth token (Modal dashboard > Settings >
# Proxy Auth Tokens), sent as Modal-Key / Modal-Secret headers.

API_SCENES = {'wall': 'wall-rest', 'stone': 'stone-sun', 'wall-rest': 'wall-rest', 'stone-sun': 'stone-sun'}
QUALITY = {                       # (width in px, Cycles samples); height is width * 1.25
    'draft': (960, 128),
    'standard': (1600, 400),
    'high': (2400, 700),
}
FULL_WIDTH = 2400                 # render.py's 100% width
MAX_STL_BYTES = 60 * 1024 * 1024


@app.function(**HARDWARE)
def render_stl(stl: bytes, scene: str, scale: int, samples: int) -> bytes:
    import uuid
    os.makedirs('/tmp/in', exist_ok=True)
    name = uuid.uuid4().hex
    path = f'/tmp/in/{name}.stl'
    with open(path, 'wb') as f:
        f.write(stl)
    try:
        return _blender(['--scene', scene, '--stl', path, '--scale', str(scale), '--samples', str(samples)],
                        f'{scene}_{name}')
    finally:
        os.remove(path)


@app.function()
@modal.concurrent(max_inputs=50)
@modal.asgi_app(requires_proxy_auth=True)
def api():
    import struct
    from typing import Optional
    from fastapi import FastAPI, HTTPException, Request
    from fastapi.responses import JSONResponse, Response

    web = FastAPI(title='Constelier pendant renders')

    @web.post('/renders', status_code=202)
    async def submit(request: Request, scene: str = 'wall', quality: str = 'standard',
                     width: Optional[int] = None, samples: Optional[int] = None):
        if scene not in API_SCENES:
            raise HTTPException(400, f'scene must be one of: wall, stone')
        if quality not in QUALITY:
            raise HTTPException(400, f'quality must be one of: {", ".join(QUALITY)}')
        w, n = QUALITY[quality]
        w, n = width or w, samples or n
        if not 320 <= w <= 3600 or not 16 <= n <= 2000:
            raise HTTPException(400, 'width must be 320-3600 and samples 16-2000')
        stl = await request.body()
        if len(stl) > MAX_STL_BYTES:
            raise HTTPException(413, 'STL is larger than 60 MB')
        if len(stl) < 84 or len(stl) != 84 + 50 * struct.unpack('<I', stl[80:84])[0]:
            raise HTTPException(400, 'body must be a binary STL file')
        call = render_stl.spawn(stl, API_SCENES[scene], round(100 * w / FULL_WIDTH), n)
        return {'id': call.object_id, 'status_url': f'/renders/{call.object_id}', 'scene': API_SCENES[scene],
                'width': w, 'height': round(w * 1.25), 'samples': n}

    @web.get('/renders/{render_id}')
    async def result(render_id: str):
        try:
            call = modal.FunctionCall.from_id(render_id)
            png = await call.get.aio(timeout=0)
        except TimeoutError:
            return JSONResponse({'status': 'rendering'}, status_code=202)
        except modal.exception.NotFoundError:
            raise HTTPException(404, 'no such render')
        except Exception as ex:
            msg = str(ex)
            return JSONResponse({'status': 'failed', 'error': msg[:2000]},
                                status_code=422 if 'BAIL NOT FOUND' in msg else 500)
        return Response(png, media_type='image/png')

    return web
