# The hero film: the natal chart drawing itself on paper and its pendant
# flowing in as gold, as on the homepage hero (src/app/halo/hero), rendered in Cycles.
# One run renders a stretch of frames: the set is built once, and from frame
# to frame only what moves is changed (the camera, the chart on the paper, the
# metal while it flows), so Blender starts and the renderer loads once.
#
#   blender -b --factory-startup -P tools/blender/film.py -- --frame 120 --count 24 --width 1920 --samples 200
#
#   --frame    the first frame to render (24 a second; --frames prints how many there are)
#   --count    how many frames to render from there (default 1)
#   --step     render every Nth frame (default 1)
#   --width    image width in pixels (16:9)
#   --samples  Cycles samples
#   --out      output folder (default tools/blender/renders/film)
#
# What it needs, in tools/blender/film:
#   chart/f0000.png ...  the 2D chart's animation, baked by the homepage in dev (/?bake=1)
#   chart.json           when each of those frames was drawn, and the chart's size
#   pendant.stl/.json    the pendant and its outline, from export-film.mjs
#   grid/00.stl ...      the eleven other pendants of the last shot, from export-film.mjs
#   grid/ink.png         their charts' ink, from grid-ink.py
#
# Everything is at real size, in the pendant's own frame: flat in XY, front
# face +Z, bail toward +Y, the paper just under it.
#
# The metal mid-flow is not the finished mesh. As in the browser
# (modules/traced-gold/glsl.js), it is a solid defined by a distance field
# that limits where the finished outline's metal has got to; here that solid
# is turned into a mesh for each frame (flow_mesh). The finished mesh takes
# over at the cut to the last shot.
import bpy, sys, os, json, math, argparse
import numpy as np
from mathutils import Vector

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
sys.path += [p for p in os.environ.get('FILM_PYLIBS', '').split(':') if p]     # scipy and scikit-image, where Blender's Python lacks them
import render as R                      # materials, lights, world and the STL loader
from render import MM, V

FILM = os.path.join(HERE, 'film')
FPS = 24

# ───────────────────────── the cut ─────────────────────────
# Seconds. Four shots: the flat chart while the planets move; close in while
# the lines draw, the outline thickens and the gold flows in; low and angled,
# travelling across the finished piece; then from above, pulling back to show
# it is one of twelve.
T_HOLD = 0.7        # the opening chart, still
T_GLIDE = 2.6       # the planets move round to the new sky
T_DRAW = 4.4        # the lines draw and the outline thickens
T_FLOW = 4.8        # the rim runs round as a loop, then the inside flows in
T_OVERLAP = 1.7     # the gold sets off while the outline is still settling, so there is no wait between them
T_STAY = 0.6        # the close-up holds on the finished piece
T_PAN = 4.6         # the low pan
T_GRID = 5.0        # the pull-back over the grid
CUT_1 = T_HOLD + T_GLIDE
DRAW_END = CUT_1 + T_DRAW
FLOW_AT = DRAW_END - T_OVERLAP
CUT_2 = FLOW_AT + T_FLOW + T_STAY
CUT_3 = CUT_2 + T_PAN
END = CUT_3 + T_GRID
FRAMES = int(round(END * FPS))

# The grid of the last shot: 4 across, 3 down, the film's own pendant third in the second row.
GRID = dict(cols=4, rows=3, col=2, row=1, gap=1.14)     # gap: neighbours sit this many chart-widths apart

CURVE = (0.4, 0.1, 0.3, 1.0)            # the flow-in's timing: gathers slowly, runs, then a long settle


def clamp01(x):
    return min(1.0, max(0.0, x))

def smooth(x):
    x = clamp01(x)
    return x * x * (3 - 2 * x)

def lerp(a, b, t):
    return a + (b - a) * t

def long_tail(u):
    """Most of the way there quickly, then a long settle: 95% of the change is
    done by half time."""
    return 1 - (1 - clamp01(u)) ** 4.32

def bezier(curve, x):
    x1, y1, x2, y2 = curve
    at = lambda a, b, t: 3 * a * t * (1 - t) ** 2 + 3 * b * t * t * (1 - t) + t ** 3
    lo, hi = 0.0, 1.0
    for _ in range(30):
        t = (lo + hi) / 2
        if at(x1, x2, t) < x:
            lo = t
        else:
            hi = t
    return at(y1, y2, (lo + hi) / 2)

def chart_time(t, marks):
    """Which moment of the baked chart (its own milliseconds) shows at film time t."""
    if t < T_HOLD:
        return marks['change']
    if t < CUT_1:
        return lerp(marks['change'], marks['lines'], long_tail((t - T_HOLD) / T_GLIDE))
    if t < DRAW_END:
        return lerp(marks['lines'], marks['grown'], long_tail((t - CUT_1) / T_DRAW))
    return marks['grown'] + (t - DRAW_END) * 1000        # the dots under the metal keep moving

def grid_cells(pitch):
    """Where each neighbour sits (x, y), reading across each row and skipping the film's own place."""
    return [((col - GRID['col']) * pitch, (GRID['row'] - row) * pitch)
            for row in range(GRID['rows']) for col in range(GRID['cols']) if (col, row) != (GRID['col'], GRID['row'])]

def camera_at(t, pitch):
    """Distance, elevation and azimuth (degrees) and the point looked at, in the
    pendant's model units, as on the hero page; plus an f-number."""
    if t < CUT_1:
        return dict(dist=900 - 14 * t, el=87, az=270, tx=0, ty=0, fstop=90)
    if t < CUT_2:
        tl = t - CUT_1
        return dict(dist=400 - 9 * tl, el=58, az=261 + 2.2 * tl, tx=0, ty=0, fstop=64)
    if t >= CUT_3:
        # From above the pendant, pulling back and across until the whole grid is in view.
        k = 1 - math.exp(-(t - CUT_3) / 1.3)
        cx, cy = ((GRID['cols'] - 1) / 2 - GRID['col']) * pitch, (GRID['row'] - (GRID['rows'] - 1) / 2) * pitch
        return dict(dist=lerp(1000, 2900, k), el=82, az=270, tx=cx * k, ty=cy * k, fstop=180)
    since = 5 * (1 - math.exp(-(t - CUT_2) / 5))
    along, az = -24 + 9 * since, 300
    return dict(dist=345, el=23, az=az, tx=-math.sin(math.radians(az)) * along, ty=math.cos(math.radians(az)) * along, fstop=56)

def flow_at(t):
    """None before the gold arrives; then how far the rim's loop and the inside
    have got (0 to 1 each) and how beaded the metal's edges still are."""
    if t < FLOW_AT:
        return None
    q = clamp01(bezier(CURVE, clamp01((t - FLOW_AT) / T_FLOW)))
    return dict(rim=smooth(q / 0.5), inside=clamp01((q - 0.42) / 0.58))


# ───────────────────────── the flowing metal ─────────────────────────

def outline_fields(P, n=768, ss=3):
    """Distance fields of the pendant's outline on an n x n grid over
    [-extent, extent] (model units, rig frame): to the nearest metal edge
    (negative inside the metal) and to the outer edge alone (negative inside
    it, voids included)."""
    from scipy import ndimage
    from skimage.draw import polygon
    extent = P['extent'] * 1.2
    N = n * ss
    k = N / (2 * extent)
    metal = np.zeros((N, N), dtype=bool)
    outer = np.zeros((N, N), dtype=bool)
    for loop in sorted(P['loops'], key=lambda l: l['hole']):        # the outer edge first, then the voids cut out of it
        pts = np.asarray(loop['pts'], dtype=np.float64)
        rr, cc = polygon((pts[:, 0] + extent) * k, (-pts[:, 1] + extent) * k, (N, N))    # rig y = -model y
        if loop['hole']:
            metal[rr, cc] = False
        else:
            metal[rr, cc] = True
            outer[rr, cc] = True
    def signed(mask):
        d = ndimage.distance_transform_edt(~mask) - ndimage.distance_transform_edt(mask)
        d = d.reshape(n, ss, n, ss).mean(axis=(1, 3)) / k
        return ndimage.gaussian_filter(d, 0.7).astype(np.float32)
    xs = (np.arange(n) + 0.5) / n * 2 * extent - extent
    return dict(d=signed(metal), outer=signed(outer), xs=xs, extent=extent)

def smax(a, b, k):
    """Smooth intersection: where the two meet, the corner is a rounded bead."""
    h = np.clip(0.5 + 0.5 * (b - a) / k, 0.0, 1.0)
    return a + (b - a) * h + k * h * (1 - h)

def corner(x, z, hh, a, b):
    """Distance to a slab whose edge is rounded by a quarter ellipse a wide and
    b tall (see corner() in glsl.js)."""
    wx, wz = (x + a) / a, (z - hh + b) / b
    return (np.minimum(np.maximum(wx, wz), 0.0) + np.hypot(np.maximum(wx, 0.0), np.maximum(wz, 0.0)) - 1.0) * np.minimum(a, b)

def w_rim(r, rim_r):
    w = np.clip((r - (rim_r - 7.0)) / 6.0, 0.0, 1.0)
    return w * w * (3 - 2 * w)

def redistance(d, dx, rho, ss=3):
    """The true signed distance to the zero line of `d` (grid step dx), with
    outward corners rounded to radius `rho` (a number or a grid)."""
    from scipy import ndimage
    n = d.shape[0]
    up = ndimage.zoom(d, ss, order=1, grid_mode=True, mode='nearest')
    px = dx / ss
    signed = lambda mask: (ndimage.distance_transform_edt(~mask) - ndimage.distance_transform_edt(mask)) * px
    s = signed(up < 0)
    top = float(np.max(rho))
    if top > 0.05:
        # Shrink by the radius and grow back: outward corners come back round. Where rho is smaller, less of it is used.
        rounded = signed(s < -top) - top
        k = ndimage.zoom(rho, ss, order=1, grid_mode=True, mode='nearest') / top if np.ndim(rho) else 1.0
        s = s + (rounded - s) * k
        # And the other way (grow, then shrink back) to fill any notch in a tip.
        fill = 0.5 * top
        s = s + (signed(s < fill) + fill - s) * k
    s = s.reshape(n, ss, n, ss).mean(axis=(1, 3))
    return ndimage.gaussian_filter(s, 0.7).astype(np.float32)

def flow_mesh(P, F, state):
    """The metal part-way through arriving, as vertices (model units), triangles
    and normals; None while there is none yet."""
    from skimage import measure
    d0, to_outer, xs = F['d'], F['outer'], F['xs']
    X, Y = np.meshgrid(xs, xs, indexing='ij')
    r = np.hypot(X, Y)
    rim_r, rim_w, half, rnd = P['rimR'], P['rimWidth'], P['thickness'] / 2, min(P['edgeRound'], P['thickness'] / 2)
    rim_p, inside = state['rim'], state['inside']

    # The rim, as a loop: gold sets off from the bail and runs both ways round to meet at the bottom.
    mid = rim_r + 0.5 * rim_w
    # It starts as a drop at the top of the bail, runs down the bail, then round the rim.
    down = P['extent'] - (rim_r + rim_w)
    round_ = np.abs(np.arctan2(X, Y)) * mid + P['extent'] - np.maximum(r, rim_r + rim_w)
    lead = rim_p * (3.35 * mid + down) - 3.0
    rim = smax(np.maximum(d0, rim_r - r), round_ - lead, 6.0)
    # The inside, flowing in from the rim behind a wavy front.
    ang = np.arctan2(Y, X)
    wave = 0.3 * np.sin(3 * ang + 1.3) + 0.2 * np.sin(5 * ang + 0.4)
    front = lerp(rim_r + rim_w + 8.0, -18.0, inside) + 14.0 * min(1.0, inside * 5.0) * wave - r
    d = np.minimum(rim, smax(np.maximum(d0, r - (rim_r + rim_w)), front, 20.0))     # the bail belongs to the rim's loop, not to this
    if d.min() >= 0:
        return None
    # Make it a true distance again, with the flowing tips rounded off; the rounding goes as the metal settles.
    moving = lerp(1 - smooth(inside), 1 - smooth((rim_p - 0.9) / 0.1), w_rim(r, rim_r))
    d = redistance(d, xs[1] - xs[0], 5.0 * moving * smooth(rim_p / 0.12))     # no rounding at the very start: it would swallow the first drop

    # Edges are beaded while the metal is moving and tighten to the finished rounding.
    w = w_rim(r, rim_r)                                               # 1 on the rim, which has its own pace
    a = lerp(lerp(8.0, rnd, inside), lerp(7.0, rnd, rim_p), w)
    b = np.minimum(lerp(lerp(2 * half, rnd, inside), lerp(2 * half, rnd, rim_p), w), half)

    dz = 0.3
    zs = np.arange(-half - 0.9, half + 0.9 + dz / 2, dz, dtype=np.float32)
    az = np.abs(zs)[None, None, :]
    vol = np.maximum(corner(d[:, :, None], az, half, a[:, :, None], b[:, :, None]),
                     corner(to_outer[:, :, None], az, half, P['rimRound'], min(P['rimDrop'], half))).astype(np.float32)
    dx = xs[1] - xs[0]
    verts, faces, normals, _ = measure.marching_cubes(vol, level=0.0, spacing=(dx, dx, dz), gradient_direction='ascent')
    verts += (xs[0], xs[0], zs[0])
    # Make sure the triangles face the way the field's gradient does (outward).
    tri = verts[faces[:2000]]
    if np.sum(np.cross(tri[:, 1] - tri[:, 0], tri[:, 2] - tri[:, 0]) * normals[faces[:2000, 0]]) < 0:
        faces = faces[:, ::-1]
    return verts, faces, normals

def metal_object(name, verts_m, faces, normals, mat):
    me = bpy.data.meshes.new(name)
    me.vertices.add(len(verts_m))
    me.vertices.foreach_set('co', verts_m.astype(np.float32).ravel())
    me.loops.add(len(faces) * 3)
    me.loops.foreach_set('vertex_index', faces.ravel().astype(np.int32))
    me.polygons.add(len(faces))
    me.polygons.foreach_set('loop_start', np.arange(0, len(faces) * 3, 3, dtype=np.int32))
    me.polygons.foreach_set('loop_total', np.full(len(faces), 3, dtype=np.int32))
    me.update(calc_edges=True)
    me.polygons.foreach_set('use_smooth', [True] * len(faces))
    me.normals_split_custom_set_from_vertices(normals.astype(np.float32).tolist())
    return R.new_obj(name, me, mat)


# ───────────────────────── the set ─────────────────────────

def mat_chart_paper(half_m, sheet):
    """Cotton paper with the chart drawn on it: the baked frame either side of
    a moment, blended, as ink over the paper's own tone and grain; and, when
    shown, the ink of the grid's other charts (`sheet`: image, centre x, centre
    y, width, height, in metres). Returns the material and what changes from
    frame to frame: the two image nodes, the sockets that blend them, and the
    socket that shows the grid's ink."""
    m, nt, b = R.new_mat('ChartPaper')
    b.inputs['Roughness'].default_value = 0.92
    vec = R.obj_coords(nt)
    # Tone: a slow mottle, and paler flecks of fibre.
    paper = (0.93, 0.89, 0.815)
    tone = R.remap(nt, R.noise(nt, vec, 55, 3), 0.955, 1.03)
    fibre = R.remap(nt, R.noise(nt, R.obj_coords(nt, (1, 6, 1)), 5200, 4, 0.75), 0.96, 1.025)
    shade = R.math_node(nt, 'MULTIPLY', tone, fibre)
    base = nt.nodes.new('ShaderNodeVectorMath')
    base.operation = 'SCALE'
    base.inputs[0].default_value = paper
    nt.links.new(shade, base.inputs['Scale'])
    # The chart: its canvas covers the square of half-width `half_m` about the pendant.
    uv = nt.nodes.new('ShaderNodeMapping')
    uv.inputs['Scale'].default_value = (1 / (2 * half_m), 1 / (2 * half_m), 1)
    uv.inputs['Location'].default_value = (0.5, 0.5, 0)
    tc = nt.nodes.new('ShaderNodeTexCoord')
    nt.links.new(tc.outputs['Object'], uv.inputs['Vector'])
    def frame():
        t = nt.nodes.new('ShaderNodeTexImage')
        t.extension = 'CLIP'
        t.interpolation = 'Cubic'
        nt.links.new(uv.outputs['Vector'], t.inputs['Vector'])
        return t
    ta, tb = frame(), frame()
    mixes = []
    def blend(kind, fac, x, y):
        """A Mix node. Its sockets share names across data types, so they are picked by position."""
        n = nt.nodes.new('ShaderNodeMix')
        n.data_type = kind
        first = {'FLOAT': 2, 'RGBA': 6}[kind]
        for sock, v in ((n.inputs[0], fac), (n.inputs[first], x), (n.inputs[first + 1], y)):
            if v is None:
                mixes.append(sock)             # set for each frame
            elif isinstance(v, (int, float)):
                sock.default_value = v
            else:
                nt.links.new(v, sock)
        return n.outputs[{'FLOAT': 0, 'RGBA': 2}[kind]]
    ink = blend('RGBA', None, ta.outputs['Color'], tb.outputs['Color'])
    alpha = blend('FLOAT', None, ta.outputs['Alpha'], tb.outputs['Alpha'])
    # Ink sits in the paper, so it takes the paper's mottle too.
    inked = nt.nodes.new('ShaderNodeVectorMath')
    inked.operation = 'SCALE'
    nt.links.new(ink, inked.inputs[0])
    nt.links.new(shade, inked.inputs['Scale'])
    colour = blend('RGBA', alpha, base.outputs['Vector'], inked.outputs['Vector'])
    # The other charts of the grid.
    path, cx, cy, w, h = sheet
    uv2 = nt.nodes.new('ShaderNodeMapping')
    uv2.inputs['Scale'].default_value = (1 / w, 1 / h, 1)
    uv2.inputs['Location'].default_value = (0.5 - cx / w, 0.5 - cy / h, 0)
    nt.links.new(tc.outputs['Object'], uv2.inputs['Vector'])
    ts = nt.nodes.new('ShaderNodeTexImage')
    ts.image = bpy.data.images.load(path)
    ts.extension = 'CLIP'
    ts.interpolation = 'Cubic'
    nt.links.new(uv2.outputs['Vector'], ts.inputs['Vector'])
    inked2 = nt.nodes.new('ShaderNodeVectorMath')
    inked2.operation = 'SCALE'
    nt.links.new(ts.outputs['Color'], inked2.inputs[0])
    nt.links.new(shade, inked2.inputs['Scale'])
    shown = nt.nodes.new('ShaderNodeMath')
    shown.operation = 'MULTIPLY'
    nt.links.new(ts.outputs['Alpha'], shown.inputs[0])
    shown.inputs[1].default_value = 0.0
    colour = blend('RGBA', shown.outputs[0], colour, inked2.outputs['Vector'])
    nt.links.new(colour, b.inputs['Base Color'])
    # Tooth: fine grain, long fibres and a faint cockle across the sheet.
    grain = R.add_sockets(nt, R.remap(nt, R.noise(nt, vec, 9000, 5, 0.7), 0, 1.0),
                          R.remap(nt, R.noise(nt, R.obj_coords(nt, (1, 7, 1)), 2600, 3, 0.6), 0, 1.6))
    grain = R.add_sockets(nt, grain, R.remap(nt, R.noise(nt, vec, 60, 2), 0, 14.0))
    R.bump(nt, b, grain, 0.85, 0.00001)
    return m, dict(frames=(ta, tb), mixes=mixes, grid=shown.inputs[1])

class Stage:
    """The set, built once. show(t) moves it to a moment of the film."""

    def __init__(self, a):
        with open(os.path.join(FILM, 'pendant.json')) as f:
            self.P = P = json.load(f)
        with open(os.path.join(FILM, 'chart.json')) as f:
            self.C = C = json.load(f)
        self.a = a
        self.unit = unit = P['mmPerUnit']              # model units -> mm
        self.half_mm = P['thickness'] / 2 * unit
        self.pitch = pitch = 2 * C['half'] * GRID['gap']
        self.fields = None                             # the outline's distance fields, made when the metal first flows
        self.metal = self.card = None
        R.grade('Standard', exposure=a.exposure)

        # Paper, with the chart and (for the last shot) the grid's other charts on it.
        cx, cy = ((GRID['cols'] - 1) / 2 - GRID['col']) * pitch, (GRID['row'] - (GRID['rows'] - 1) / 2) * pitch
        sheet = (os.path.join(FILM, 'grid', 'ink.png'), cx * unit * MM, cy * unit * MM, GRID['cols'] * pitch * unit * MM, GRID['rows'] * pitch * unit * MM)
        paper, self.paper = mat_chart_paper(C['half'] * unit * MM, sheet)
        R.plane('Paper', 3000, 3000, paper, loc=(0, 0, -self.half_mm))

        # The finished metal: the film's own pendant and the grid's eleven others. Hidden until their shots.
        self.gold = gold = R.mat_gold(color=R.GOLD_RICH)
        R.PENDANTS = {'film': {'path': os.path.join(FILM, 'pendant.stl')}}
        self.pendant, _ = R.load_pendant('film', gold)
        self.others = []
        for i, (x, y) in enumerate(grid_cells(pitch)):
            R.PENDANTS['n%02d' % i] = {'path': os.path.join(FILM, 'grid', '%02d.stl' % i)}
            o, _ = R.load_pendant('n%02d' % i, gold)
            o.location = (x * unit * MM, y * unit * MM, 0)
            self.others.append(o)

        # Light: sun through a window some way off, and a quiet studio around it.
        R.world(hdri=R.hdri('studio_small_08'), hdri_strength=0.6, rot_z=math.radians(200))
        # The room's own light is warm, so the window's shadows are cream rather than grey.
        nt = bpy.context.scene.world.node_tree
        bg = next(n for n in nt.nodes if n.type == 'BACKGROUND')
        warm = nt.nodes.new('ShaderNodeVectorMath')
        warm.operation = 'MULTIPLY'
        warm.inputs[1].default_value = (1.0, 0.93, 0.83)
        nt.links.new(bg.inputs['Color'].links[0].from_socket, warm.inputs[0])
        nt.links.new(warm.outputs['Vector'], bg.inputs['Color'])
        toward = Vector((-0.55, 0.45, 0.70)).normalized()
        R.sun('Sun', -toward, 3.0, angle_deg=0.05, color=(1.0, 0.96, 0.89))
        # The window's shadow: one edge that splits the scene in two, as on the
        # website (SHADOW in src/app/halo/hero/hero-director.ts). On the paper the edge runs downhill
        # to the right at 24 degrees and passes 35 units below the pendant's centre;
        # everything below it is in shade. It is cast by the edge of a sheet a
        # long way up the sun's rays: far enough to hide little of the room's own
        # light from the paper, which would otherwise darken away from the edge.
        # The sun is made small to match, so the edge stays about a millimetre soft.
        n = Vector((math.cos(math.radians(66)), math.sin(math.radians(66)), 0))        # across the edge, toward the light
        along = Vector((-n.y, n.x, 0))
        lift, wide, deep = toward * 1.5, 1.5, 0.5
        corners = [n * (-35 * unit * MM) + along * u - n * c + lift for u, c in ((-wide, 0), (wide, 0), (wide, deep), (-wide, deep))]
        m, _, b = R.new_mat('ShadeMat')
        b.inputs['Base Color'].default_value = (0.02, 0.02, 0.02, 1)
        shade = R.new_obj('Shade', R.mesh_from('Shade', [tuple(v) for v in corners], [(0, 1, 2, 3)]), m, smooth=False)
        shade.visible_camera = shade.visible_glossy = shade.visible_diffuse = False

        # Camera, as on the hero: a 30 degree view, the pendant right of centre.
        cam = bpy.data.cameras.new('Camera')
        cam.sensor_fit = 'VERTICAL'
        cam.sensor_height = 24
        cam.lens = 12 / math.tan(math.radians(15))
        cam.clip_start, cam.clip_end = 0.002, 20
        cam.shift_x = -0.15
        cam.dof.use_dof = True
        cam.dof.aperture_blades = 9
        self.camera = R.link(bpy.data.objects.new('Camera', cam))
        bpy.context.scene.camera = self.camera

    def show(self, t):
        P, C, unit = self.P, self.C, self.unit
        # The chart as it stands at this moment: the baked frame either side of it, blended.
        at = (chart_time(t, C['marks']) - C['times'][0]) / C['stepMs']
        i0 = int(min(len(C['times']) - 1, max(0, math.floor(at))))
        i1 = min(len(C['times']) - 1, i0 + 1)
        for node, i in zip(self.paper['frames'], (i0, i1)):
            old = node.image
            node.image = bpy.data.images.load(os.path.join(FILM, 'chart', 'f%04d.png' % i), check_existing=True)
            if old and old != node.image and old.users == 0:
                bpy.data.images.remove(old)
        for sock in self.paper['mixes']:
            sock.default_value = at - i0 if i1 > i0 else 0.0

        # The metal: flowing (a new mesh each frame) until the cut to the pan, the finished piece after it;
        # the neighbours are there for the last shot only, as on the website.
        if self.metal:
            me = self.metal.data
            bpy.data.objects.remove(self.metal)
            bpy.data.meshes.remove(me)
            self.metal = None
        grid = t >= CUT_3
        self.paper['grid'].default_value = 1.0 if grid else 0.0
        self.pendant.hide_render = t < CUT_2
        for o in self.others:
            o.hide_render = not grid
        state = flow_at(t)
        if t < CUT_2 and state:
            self.fields = self.fields or outline_fields(P, self.a.grid)
            mesh = flow_mesh(P, self.fields, state)
            if mesh:
                verts, faces, normals = mesh
                self.metal = metal_object('Metal', verts * unit * MM, faces, normals, self.gold)

        # The camera.
        c = camera_at(t, self.pitch)
        el, az = math.radians(c['el']), math.radians(c['az'])
        target = Vector((c['tx'], c['ty'], 0)) * unit * MM
        eye = target + Vector((math.cos(el) * math.cos(az), math.cos(el) * math.sin(az), math.sin(el))) * c['dist'] * unit * MM
        o = self.camera
        o.location = eye
        o.rotation_euler = (target - eye).to_track_quat('-Z', 'Y').to_euler()
        o.data.dof.aperture_fstop = c['fstop']
        o.data.dof.focus_distance = (eye - target).length
        bpy.context.view_layer.update()
        # What the flat face of the gold mirrors back to this camera: it sits where the camera's reflection looks, so it moves with it.
        if self.card:
            me, mats = self.card.data, [s.material for s in self.card.material_slots]
            bpy.data.objects.remove(self.card)
            bpy.data.meshes.remove(me)
            for m in mats:
                if m and m.users == 0:
                    bpy.data.materials.remove(m)
        self.card = R.mirror_card(o, (0, 0, self.half_mm), (0, 0, 1), 300, (460, 460), 1.5, color=(1.0, 0.97, 0.92), lo=0.5, roll=math.radians(150), span=1.4, face=P['extent'] * 2 * unit)

def main():
    import time
    argv = sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else []
    ap = argparse.ArgumentParser()
    ap.add_argument('--frame', type=int, default=0)
    ap.add_argument('--count', type=int, default=1)
    ap.add_argument('--step', type=int, default=1)
    ap.add_argument('--frames', action='store_true', help='print how many frames the film has')
    ap.add_argument('--width', type=int, default=1920)
    ap.add_argument('--samples', type=int, default=200)
    ap.add_argument('--grid', type=int, default=768, help='resolution of the flowing metal')
    ap.add_argument('--exposure', type=float, default=0.0)
    ap.add_argument('--out', default=os.path.join(HERE, 'renders', 'film'))
    a = ap.parse_args(argv)
    if a.frames:
        print('FRAMES', FRAMES)
        return
    os.makedirs(a.out, exist_ok=True)
    began = time.time()
    bpy.ops.wm.read_factory_settings(use_empty=True)
    R.setup_render(100, a.samples)
    sc = bpy.context.scene
    # No light bounced off the gold onto the paper: it is enough to wash the window's shade out all round the pendant.
    sc.cycles.caustics_reflective = False
    sc.render.use_persistent_data = True          # keep what has not changed on the renderer between frames
    sc.render.resolution_x, sc.render.resolution_y = a.width, int(round(a.width * 9 / 16 / 2)) * 2
    stage = Stage(a)
    print('SET BUILT in %.1fs' % (time.time() - began), flush=True)
    for frame in range(a.frame, min(FRAMES, a.frame + a.count * a.step), a.step):
        t0 = time.time()
        stage.show(frame / FPS)
        t1 = time.time()
        sc.render.filepath = os.path.join(a.out, 'f%04d.png' % frame)
        bpy.ops.render.render(write_still=True)
        print('FRAME %d placed in %.1fs, rendered in %.1fs' % (frame, t1 - t0, time.time() - t1), flush=True)

if __name__ == '__main__':
    main()
