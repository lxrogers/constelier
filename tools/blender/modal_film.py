# Render the hero film (film.py) on Modal and join the frames into an MP4.
# Each container renders a stretch of frames in one Blender run, so Blender
# starts and the renderer loads once per stretch, not once per frame.
#
#   tools/blender/.venv/bin/modal run tools/blender/modal_film.py --width 640 --samples 32 --step 3 --run preview
#   tools/blender/.venv/bin/modal run tools/blender/modal_film.py --width 1920 --samples 200 --run final
#
#   --width    image width in pixels (16:9)
#   --samples  Cycles samples
#   --step     render every Nth frame (previews); the video plays at the film's real speed either way
#   --first, --last   only this part of the film (frame numbers); no video is made
#   --chunk    frames per container (default 32)
#   --run      a name for this run: frames are kept on the Modal volume
#              `constelier-film` under it, and the video is saved here as
#              tools/blender/renders/film/<run>.mp4
#   --join     skip rendering and only join the run's frames into its video
#   --keep     how many frames to also save here as PNGs, spread through the run (default 12)
#
# Renders with Cycles on a GPU: FILM_GPU picks the card (default L40S; an L4 is
# cheaper by the hour but slower, and Modal often has none free). RENDER_CPU=1 uses 16
# CPU cores instead.
# Needs tools/blender/film (see film.py and export-film.mjs) and tools/blender/hdri (fetch-hdris.sh).
import os
import modal

HERE = os.path.dirname(os.path.abspath(__file__))
BLENDER_URL = 'https://download.blender.org/release/Blender5.3/blender-5.3.0-linux-x64.tar.xz'
BLENDER_SHA256 = 'dacb8264197a3f7fda6001285a5a506fc97ee943881261c2c3bd63c882f22e05'
FPS = 24

image = (
    modal.Image.debian_slim(python_version='3.11')
    .apt_install('wget', 'xz-utils', 'ffmpeg', 'libx11-6', 'libxi6', 'libxxf86vm1', 'libxfixes3', 'libxrender1',
                 'libgl1', 'libegl1', 'libxkbcommon0', 'libsm6', 'libice6')
    .run_commands(
        f'wget -q {BLENDER_URL} -O /tmp/blender.tar.xz',
        f'echo "{BLENDER_SHA256}  /tmp/blender.tar.xz" | sha256sum -c -',
        'mkdir -p /opt/blender && tar -xJf /tmp/blender.tar.xz -C /opt/blender --strip-components=1',
        'rm /tmp/blender.tar.xz',
        # film.py turns a distance field into a mesh inside Blender, with scipy and scikit-image.
        'PY=$(ls /opt/blender/*/python/bin/python3* | grep -v config | head -1) && $PY -m ensurepip && '
        '$PY -m pip install --no-cache-dir scipy scikit-image',
    )
    .add_local_dir(os.path.join(HERE, 'hdri'), '/work/hdri')
    .add_local_dir(os.path.join(HERE, 'film'), '/work/film')
    .add_local_file(os.path.join(HERE, 'render.py'), '/work/render.py')
    .add_local_file(os.path.join(HERE, 'film.py'), '/work/film.py')
)

app = modal.App('constelier-film', image=image)
frames_vol = modal.Volume.from_name('constelier-film', create_if_missing=True)
# Beside a GPU, ask for little: an L4 machine has 4 cores and 16 GB in all, and a request for all of it is never placed (the job just waits).
HARDWARE = dict(cpu=16, memory=16384) if os.environ.get('RENDER_CPU') else dict(gpu=os.environ.get('FILM_GPU', 'L40S'), cpu=2, memory=8192)


@app.function(**HARDWARE, timeout=3600, volumes={'/vol': frames_vol}, retries=1)
def render_stretch(first: int, count: int, step: int, width: int, samples: int, run: str, send: list[int]) -> dict:
    """Render `count` frames from `first`, every `step`th, in one Blender run. Returns the frames in `send` as PNG bytes."""
    import shutil, subprocess, time
    began = time.time()
    print(f'[{first}] container started', flush=True)
    out = f'/tmp/out-{first}'                 # its own folder: a container may be given several stretches, one after another
    cmd = ['/opt/blender/blender', '-b', '--factory-startup', '-P', '/work/film.py', '--', '--frame', str(first), '--count', str(count),
           '--step', str(step), '--width', str(width), '--samples', str(samples), '--out', out]
    log = []
    with subprocess.Popen(cmd, stdout=subprocess.PIPE, stderr=subprocess.STDOUT, text=True) as proc:
        for line in proc.stdout:
            log.append(line)
            if line.startswith(('FRAME', 'SET BUILT', 'CYCLES', 'GPU setup')):
                print(f'[{first}]', line.rstrip(), flush=True)
    frames = sorted(f for f in os.listdir(out)) if os.path.isdir(out) else []
    if len(frames) < count and not frames:
        raise RuntimeError(f'stretch from {first} failed:\n' + ''.join(log[-60:]))
    os.makedirs(f'/vol/{run}', exist_ok=True)
    for f in frames:
        shutil.copy(f'{out}/{f}', f'/vol/{run}/{f}')
    frames_vol.commit()
    print(f'[{first}] {len(frames)} frames in {time.time() - began:.0f}s', flush=True)
    out = {}
    for n in send:
        with open(f'{out}/f{n:04d}.png', 'rb') as fh:
            out[n] = fh.read()
    return out


@app.function(cpu=8, memory=8192, timeout=1800, volumes={'/vol': frames_vol})
def encode(run: str, frames: list[int], step: int) -> bytes:
    """Join a run's frames into an MP4 that plays at the film's real speed."""
    import subprocess
    frames_vol.reload()
    os.makedirs('/tmp/seq', exist_ok=True)
    for i, frame in enumerate(frames):
        os.symlink(f'/vol/{run}/f{frame:04d}.png', f'/tmp/seq/{i:04d}.png')
    cmd = ['ffmpeg', '-y', '-framerate', f'{FPS}/{step}', '-i', '/tmp/seq/%04d.png', '-r', str(FPS),
           '-c:v', 'libx264', '-preset', 'slow', '-crf', '14', '-pix_fmt', 'yuv420p', '-movflags', '+faststart', '/tmp/film.mp4']
    done = subprocess.run(cmd, capture_output=True, text=True)
    if done.returncode:
        raise RuntimeError(done.stderr[-3000:])
    with open('/tmp/film.mp4', 'rb') as f:
        return f.read()


@app.function()
def count() -> int:
    import subprocess
    out = subprocess.run(['/opt/blender/blender', '-b', '--factory-startup', '-P', '/work/film.py', '--', '--frames'], capture_output=True, text=True).stdout
    return int([l for l in out.splitlines() if l.startswith('FRAMES')][0].split()[1])


@app.local_entrypoint()
def main(width: int = 640, samples: int = 32, step: int = 1, first: int = 0, last: int = -1, chunk: int = 32, run: str = 'preview', keep: int = 12, join: bool = False):
    total = count.remote()
    whole = first == 0 and last < 0
    todo = list(range(first, total if last < 0 else min(total, last + 1), step))
    kept = set(todo[::max(1, len(todo) // max(1, keep))])
    out = os.path.join(HERE, 'renders', 'film', run)
    os.makedirs(out, exist_ok=True)
    stretches = [todo[i:i + chunk] for i in range(0, len(todo), chunk)]
    print(f'{len(todo)} of {total} frames at {width}px, {samples} samples, in {len(stretches)} stretches, run "{run}"')
    jobs = [(part[0], len(part), step, width, samples, run, [f for f in part if f in kept]) for part in stretches]
    results = [] if join else list(render_stretch.starmap(jobs))      # --join: the frames are already on the volume; only make the video
    for part, pngs in zip(stretches, results):
        for n, png in pngs.items():
            with open(os.path.join(out, f'f{n:04d}.png'), 'wb') as fh:
                fh.write(png)
        print('frames', part[0], 'to', part[-1], 'done', flush=True)
    if whole:
        video = os.path.join(HERE, 'renders', 'film', run + '.mp4')
        with open(video, 'wb') as fh:
            fh.write(encode.remote(run, todo, step))
        print('WROTE', video)
