# Constelier pendant renders in Blender (Cycles).
#
#   /Applications/Blender.app/Contents/MacOS/Blender -b --factory-startup \
#       -P tools/blender/render.py -- --scene all --pendant nyc-1990
#
#   --scene    studio-soft | studio-grey | oxblood | stone-sun | wall-dangle | wall-rest | night-sky | eclipse | all
#   --pendant  a mesh id from tools/blender/meshes (run export-meshes.mjs first)
#   --stl      or any pendant STL file (mm, bail toward -y); its bail hole is measured
#   --scale    resolution percentage (100 = 2400x3000)
#   --samples  Cycles samples
#   --out      output folder (default tools/blender/renders)
#   --blend    also save the .blend next to the image, to open and tweak
#
# Everything is built at real size (the pendant is 25 mm across), so camera
# f-stops and depth of field behave like a real macro lens.
import bpy, bmesh, sys, os, json, math, random, argparse
import numpy as np
from mathutils import Vector, Matrix

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.abspath(os.path.join(HERE, '..', '..'))
MM = 0.001

# ───────────────────────── basics ─────────────────────────

def V(x, y, z):
    return Vector((x * MM, y * MM, z * MM))

def link(obj):
    bpy.context.scene.collection.objects.link(obj)
    return obj

def new_obj(name, mesh, mat=None, smooth=True):
    if mat:
        mesh.materials.append(mat)
    if smooth:
        mesh.polygons.foreach_set('use_smooth', [True] * len(mesh.polygons))
    mesh.update()
    return link(bpy.data.objects.new(name, mesh))

def mesh_from(name, verts, faces):
    me = bpy.data.meshes.new(name)
    me.from_pydata([tuple(v) for v in verts], [], faces)
    me.update()
    return me

def look_at(obj, target):
    obj.rotation_euler = (Vector(target) - obj.location).to_track_quat('-Z', 'Y').to_euler()

def frame_of(tangent, normal):
    """3x3 with X = tangent, Z = normal (made perpendicular), Y = Z x X."""
    x = Vector(tangent).normalized()
    z = Vector(normal)
    z = (z - x * z.dot(x)).normalized()
    y = z.cross(x)
    return Matrix((x, y, z)).transposed()

# ───────────────────────── materials ─────────────────────────

def new_mat(name):
    m = bpy.data.materials.new(name)
    m.use_nodes = True
    nt = m.node_tree
    nt.nodes.clear()
    out = nt.nodes.new('ShaderNodeOutputMaterial')
    bsdf = nt.nodes.new('ShaderNodeBsdfPrincipled')
    nt.links.new(bsdf.outputs['BSDF'], out.inputs['Surface'])
    return m, nt, bsdf

def obj_coords(nt, scale=(1, 1, 1)):
    tc = nt.nodes.new('ShaderNodeTexCoord')
    mp = nt.nodes.new('ShaderNodeMapping')
    mp.inputs['Scale'].default_value = scale
    nt.links.new(tc.outputs['Object'], mp.inputs['Vector'])
    return mp.outputs['Vector']

def noise(nt, vec, scale, detail=4.0, rough=0.5):
    n = nt.nodes.new('ShaderNodeTexNoise')
    n.inputs['Scale'].default_value = scale
    n.inputs['Detail'].default_value = detail
    n.inputs['Roughness'].default_value = rough
    nt.links.new(vec, n.inputs['Vector'])
    return n.outputs['Fac']

def remap(nt, sock, lo, hi):
    r = nt.nodes.new('ShaderNodeMapRange')
    r.inputs['To Min'].default_value = lo
    r.inputs['To Max'].default_value = hi
    nt.links.new(sock, r.inputs['Value'])
    return r.outputs['Result']

def ramp(nt, sock, stops):
    r = nt.nodes.new('ShaderNodeValToRGB')
    el = r.color_ramp.elements
    while len(el) < len(stops):
        el.new(0.5)
    for e, (pos, col) in zip(el, stops):
        e.position = pos
        e.color = (*col, 1.0)
    nt.links.new(sock, r.inputs['Fac'])
    return r.outputs['Color']

def bump(nt, bsdf, height, strength, distance):
    b = nt.nodes.new('ShaderNodeBump')
    b.inputs['Strength'].default_value = strength
    b.inputs['Distance'].default_value = distance
    nt.links.new(height, b.inputs['Height'])
    nt.links.new(b.outputs['Normal'], bsdf.inputs['Normal'])

def add_sockets(nt, a, b):
    m = nt.nodes.new('ShaderNodeMath')
    m.operation = 'ADD'
    nt.links.new(a, m.inputs[0])
    nt.links.new(b, m.inputs[1])
    return m.outputs[0]

def mat_gold(name='Gold', color=(1.0, 0.69, 0.29), rough=0.085):
    """Polished cast gold: mirror-bright, with the faint waviness and
    roughness drift that keeps reflections from looking computer-perfect."""
    m, nt, b = new_mat(name)
    b.inputs['Base Color'].default_value = (*color, 1)
    b.inputs['Metallic'].default_value = 1.0
    vec = obj_coords(nt)
    nt.links.new(remap(nt, noise(nt, vec, 900, 5), rough - 0.035, rough + 0.06), b.inputs['Roughness'])
    wav = add_sockets(nt, noise(nt, vec, 260, 2), remap(nt, noise(nt, vec, 5000, 3), 0, 0.25))
    bump(nt, b, wav, 0.06, 0.00004)
    return m

def mat_paper(color=(0.80, 0.765, 0.71)):
    m, nt, b = new_mat('Paper')
    b.inputs['Base Color'].default_value = (*color, 1)
    b.inputs['Roughness'].default_value = 0.9
    vec = obj_coords(nt)
    fib = add_sockets(nt, noise(nt, vec, 3500, 6, 0.7), remap(nt, noise(nt, vec, 40, 3), 0, 1.5))
    bump(nt, b, fib, 0.25, 0.00006)
    return m

def mat_stone():
    """Honed travertine: banded warm beige with small dark pits."""
    m, nt, b = new_mat('Travertine')
    vec = obj_coords(nt, (1, 3.5, 1))
    bands = noise(nt, vec, 30, 6, 0.6)
    col = ramp(nt, bands, [(0.25, (0.50, 0.40, 0.30)), (0.5, (0.69, 0.60, 0.48)), (0.78, (0.80, 0.73, 0.62))])
    vec2 = obj_coords(nt, (1, 3, 1))
    pits = noise(nt, vec2, 420, 3, 0.75)
    pit_mask = ramp(nt, pits, [(0.30, (0, 0, 0)), (0.36, (1, 1, 1))])
    mix = nt.nodes.new('ShaderNodeMix')
    mix.data_type = 'RGBA'
    mix.blend_type = 'MULTIPLY'
    mix.inputs[0].default_value = 0.75
    nt.links.new(col, mix.inputs[6])
    nt.links.new(pit_mask, mix.inputs[7])
    nt.links.new(mix.outputs[2], b.inputs['Base Color'])
    nt.links.new(remap(nt, bands, 0.45, 0.7), b.inputs['Roughness'])
    h = add_sockets(nt, pit_mask, remap(nt, noise(nt, vec2, 2500, 4), 0, 0.12))
    bump(nt, b, h, 0.6, 0.00025)
    return m

def mat_plaster(color=(0.78, 0.73, 0.66)):
    """Limewashed plaster wall: soft trowel waves plus fine grain."""
    m, nt, b = new_mat('Plaster')
    vec = obj_coords(nt)
    blot = noise(nt, vec, 18, 5, 0.6)
    c2 = tuple(c * 0.86 for c in color)
    nt.links.new(ramp(nt, blot, [(0.3, c2), (0.7, color)]), b.inputs['Base Color'])
    b.inputs['Roughness'].default_value = 0.92
    h = add_sockets(nt, remap(nt, noise(nt, vec, 45, 4, 0.55), 0, 3.0), noise(nt, vec, 1400, 5, 0.7))
    bump(nt, b, h, 0.35, 0.0005)
    return m

def mat_black_gloss():
    m, nt, b = new_mat('BlackGloss')
    b.inputs['Base Color'].default_value = (0.004, 0.004, 0.005, 1)
    vec = obj_coords(nt)
    nt.links.new(remap(nt, noise(nt, vec, 30, 4), 0.04, 0.16), b.inputs['Roughness'])
    return m

def mat_emit(name, color, strength):
    m = bpy.data.materials.new(name)
    m.use_nodes = True
    nt = m.node_tree
    nt.nodes.clear()
    out = nt.nodes.new('ShaderNodeOutputMaterial')
    e = nt.nodes.new('ShaderNodeEmission')
    e.inputs['Color'].default_value = (*color, 1)
    e.inputs['Strength'].default_value = strength
    nt.links.new(e.outputs['Emission'], out.inputs['Surface'])
    return m, nt, e

# ───────────────────────── geometry ─────────────────────────

def read_stl(path):
    """Triangle corners of a binary STL as an (n*3, 3) float array."""
    with open(path, 'rb') as f:
        f.seek(80)
        n = np.frombuffer(f.read(4), dtype='<u4')[0]
        rec = np.frombuffer(f.read(), dtype=np.dtype([('n', '<f4', 3), ('v', '<f4', (3, 3)), ('a', '<u2')]), count=n)
    return rec['v'].reshape(-1, 3).astype(np.float64)

def stl_info(pid, path):
    """Size and bail hole of a pendant STL, measured from the mesh itself, in
    the same shape as an entry of pendants.json. Expects what the app exports:
    millimetres, disc centred on the origin, bail toward -y, z from 0 up.
    The bail is found by slicing the mesh along its centre line (x = 0,
    mid-thickness): going up from the bottom tip the slice crosses the tip of
    the bail, then the two sides of the hole."""
    tri = read_stl(path).reshape(-1, 3, 3)
    lo, hi = tri.reshape(-1, 3).min(axis=0), tri.reshape(-1, 3).max(axis=0)
    zm = (lo[2] + hi[2]) / 2
    x0 = 1e-4                                   # just off centre, to dodge vertices lying exactly on it
    ys = []
    side = tri[:, :, 0] > x0
    for t in tri[side.any(axis=1) & ~side.all(axis=1)]:
        pts = []
        for i in range(3):
            p, q = t[i], t[(i + 1) % 3]
            if (p[0] > x0) != (q[0] > x0):
                pts.append(p + (q - p) * (x0 - p[0]) / (q[0] - p[0]))
        (_, y1, z1), (_, y2, z2) = pts
        if (z1 > zm) != (z2 > zm):
            ys.append(y1 + (y2 - y1) * (zm - z1) / (z2 - z1))
    ys = sorted(ys)
    ys = [y for i, y in enumerate(ys) if i == 0 or y - ys[i - 1] > 1e-3]
    if len(ys) < 3:
        raise SystemExit('BAIL NOT FOUND: the STL needs a bail with a hole at the -y end')
    tip, h0, h1 = ys[:3]
    r, cy = (h1 - h0) / 2, (h0 + h1) / 2
    if not 0.25 < r < 3.0:
        raise SystemExit('BAIL NOT FOUND: no plausible hole at the -y end (got radius %.2f mm)' % r)
    info = {'id': pid, 'path': path, 'bboxMm': [lo.tolist(), hi.tolist()], 'diameterMm': float(hi[0] - lo[0]),
            'bail': {'centerMm': [0, float(cy)], 'holeRadiusMm': float(r), 'outerRadiusMm': float(cy - tip)}}
    print('STL INFO', json.dumps({k: info[k] for k in ('diameterMm', 'bail')}))
    return info

def load_pendant(pid, mat):
    """Binary STL (mm, bail at -y, z 0..t) -> welded smooth mesh in metres,
    centred on the disc, bail at +Y, front face +Z."""
    tri = read_stl(PENDANTS[pid].get('path') or os.path.join(HERE, 'meshes', pid + '.stl'))
    t = tri[:, 2].max()
    key = np.round(tri * 1e4).astype(np.int64)
    _, first, inv = np.unique(key, axis=0, return_index=True, return_inverse=True)
    verts = tri[first]
    verts = np.column_stack([verts[:, 0], -verts[:, 1], t / 2 - verts[:, 2]]) * MM
    faces = inv.reshape(-1, 3)
    me = bpy.data.meshes.new('Pendant')
    me.vertices.add(len(verts))
    me.vertices.foreach_set('co', verts.ravel())
    me.loops.add(len(faces) * 3)
    me.loops.foreach_set('vertex_index', faces.ravel().astype(np.int32))
    me.polygons.add(len(faces))
    me.polygons.foreach_set('loop_start', np.arange(0, len(faces) * 3, 3, dtype=np.int32))
    me.polygons.foreach_set('loop_total', np.full(len(faces), 3, dtype=np.int32))
    me.update(calc_edges=True)
    me.validate()
    # The two faces are flat, but smooth shading blends their normals toward
    # the rounded rim along long thin triangles, which shows up as faint
    # creases in reflections. Pin every vertex lying on a face plane to that
    # face's true normal; the rim keeps its own.
    me.polygons.foreach_set('use_smooth', [True] * len(faces))
    nor = np.zeros(len(verts) * 3, dtype=np.float32)
    me.vertices.foreach_get('normal', nor)
    nor = nor.reshape(-1, 3)
    zz = verts[:, 2]
    top, bot = zz > (t / 2 - 2e-3) * MM, zz < (-t / 2 + 2e-3) * MM
    nor[top] = (0, 0, 1)
    nor[bot] = (0, 0, -1)
    me.normals_split_custom_set_from_vertices(nor.tolist())
    print('FLAT FACE VERTS', int(top.sum()), int(bot.sum()), 'of', len(verts))
    return new_obj('Pendant', me, mat), t

def sweep_loop(name, path, r, segs=12):
    """Tube of radius r (mm) around a closed path lying in the local XY plane."""
    n = len(path)
    verts, faces = [], []
    for i in range(n):
        p = Vector(path[i])
        tan = (Vector(path[(i + 1) % n]) - Vector(path[i - 1])).normalized()
        nor = tan.cross(Vector((0, 0, 1)))
        for j in range(segs):
            a = 2 * math.pi * j / segs
            verts.append((p + r * (math.cos(a) * nor + math.sin(a) * Vector((0, 0, 1)))) * MM)
            faces.append((i * segs + j, i * segs + (j + 1) % segs,
                          ((i + 1) % n) * segs + (j + 1) % segs, ((i + 1) % n) * segs + j))
    return mesh_from(name, verts, faces)

# Fine cable chain and the jump ring that joins it to the bail (mm).
LINK_L, LINK_W, LINK_D = 2.25, 1.45, 0.38
PITCH = LINK_L - 2 * LINK_D - 0.02
RING_R, RING_r = 2.5, 0.30          # centre-line radius, wire radius
CHAIN_REST_Z = (LINK_W / 2 - LINK_D / 2) * math.sin(math.radians(45)) + LINK_D / 2

def link_mesh():
    rc, a = LINK_W / 2 - LINK_D / 2, (LINK_L - LINK_W) / 2
    path = []
    for k in range(13):
        t = -math.pi / 2 + math.pi * k / 12
        path.append((a + rc * math.cos(t), rc * math.sin(t), 0))
    for k in range(13):
        t = math.pi / 2 + math.pi * k / 12
        path.append((-a + rc * math.cos(t), rc * math.sin(t), 0))
    return sweep_loop('Link', path, LINK_D / 2, 10)

def ring_mesh():
    path = [(RING_R * math.cos(2 * math.pi * k / 64), RING_R * math.sin(2 * math.pi * k / 64), 0) for k in range(64)]
    return sweep_loop('JumpRing', path, RING_r, 14)

def catmull(points, per=24):
    pts = [Vector(p) for p in points]
    pts = [pts[0] * 2 - pts[1]] + pts + [pts[-1] * 2 - pts[-2]]
    out = []
    for i in range(1, len(pts) - 2):
        p0, p1, p2, p3 = pts[i - 1], pts[i], pts[i + 1], pts[i + 2]
        for k in range(per):
            t = k / per
            out.append(0.5 * ((2 * p1) + (-p0 + p2) * t + (2 * p0 - 5 * p1 + 4 * p2 - p3) * t * t
                              + (-p0 + 3 * p1 - 3 * p2 + p3) * t ** 3))
    out.append(pts[-2])
    return out

def resample(path, step):
    out, acc, want = [], 0.0, 0.0
    for a, b in zip(path, path[1:]):
        seg = (b - a).length
        while want <= acc + seg and seg > 0:
            out.append((a.lerp(b, (want - acc) / seg), (b - a).normalized()))
            want += step
        acc += seg
    return out

def build_chain(points, ref_normal, mat, parent=None, seed=1):
    """Links along a smooth path through `points` (mm). Alternate links are
    turned +-45 degrees about the path, the way a cable chain settles."""
    rnd = random.Random(seed)
    me = link_mesh()
    me.materials.append(mat)
    me.polygons.foreach_set('use_smooth', [True] * len(me.polygons))
    samples = points if isinstance(points[0][1], Vector) else resample(catmull(points), PITCH)
    for i, (p, tan) in enumerate(samples):
        ref = ref_normal(p) if callable(ref_normal) else Vector(ref_normal)
        base = frame_of(tan, ref)
        drift = 28 * math.sin(i * 0.045 + seed) + 14 * math.sin(i * 0.17 + 2 * seed)
        twist = math.radians((45 if i % 2 else -45) + drift + rnd.uniform(-8, 8))
        rot = base @ Matrix.Rotation(twist, 3, 'X')
        o = link(bpy.data.objects.new('Link', me))
        o.matrix_basis = Matrix.Translation(p * MM) @ rot.to_4x4()
        if parent:
            o.parent = parent
    return me

def plane(name, sx, sy, mat, loc=(0, 0, 0), rot=(0, 0, 0)):
    """Rectangle sx x sy mm in local XY."""
    me = mesh_from(name, [(-sx / 2 * MM, -sy / 2 * MM, 0), (sx / 2 * MM, -sy / 2 * MM, 0),
                          (sx / 2 * MM, sy / 2 * MM, 0), (-sx / 2 * MM, sy / 2 * MM, 0)], [(0, 1, 2, 3)])
    o = new_obj(name, me, mat, smooth=False)
    o.location = V(*loc)
    o.rotation_euler = rot
    return o

def window_gobo(name, panes=(2, 3), pane=(150, 190), bar=22, margin=1500):
    """A wall with a mullioned window cut in it, in local XY (mm)."""
    nx, ny = panes
    w, h = nx * pane[0] + (nx - 1) * bar, ny * pane[1] + (ny - 1) * bar
    quads = []
    def rect(x0, y0, x1, y1):
        quads.append([(x0, y0), (x1, y0), (x1, y1), (x0, y1)])
    rect(-margin, -margin, -w / 2, margin); rect(w / 2, -margin, margin, margin)
    rect(-w / 2, h / 2, w / 2, margin); rect(-w / 2, -margin, w / 2, -h / 2)
    for i in range(1, nx):
        x = -w / 2 + i * pane[0] + (i - 1) * bar
        rect(x, -h / 2, x + bar, h / 2)
    for j in range(1, ny):
        y = -h / 2 + j * pane[1] + (j - 1) * bar
        rect(-w / 2, y, w / 2, y + bar)
    verts, faces = [], []
    for q in quads:
        faces.append(tuple(range(len(verts), len(verts) + 4)))
        verts += [(x * MM, y * MM, 0) for x, y in q]
    m, nt, b = new_mat(name + 'Mat')
    b.inputs['Base Color'].default_value = (0.02, 0.02, 0.02, 1)
    o = new_obj(name, mesh_from(name, verts, faces), m, smooth=False)
    o.visible_camera = False
    o.visible_glossy = False
    o.visible_diffuse = False
    return o

# ───────────────────────── lights, camera, world ─────────────────────────

def area(name, loc, target, size, power, color=(1, 1, 1), spread=None, glossy=True):
    L = bpy.data.lights.new(name, 'AREA')
    L.shape = 'RECTANGLE'
    L.size, L.size_y = size[0] * MM, size[1] * MM
    L.energy = power
    L.color = color
    if spread is not None:
        L.spread = math.radians(spread)
    o = link(bpy.data.objects.new(name, L))
    o.location = V(*loc)
    look_at(o, V(*target))
    o.visible_glossy = glossy
    return o

def math_node(nt, op, a, b=None):
    m = nt.nodes.new('ShaderNodeMath')
    m.operation = op
    for i, x in enumerate((a, b)):
        if x is None:
            continue
        if isinstance(x, (int, float)):
            m.inputs[i].default_value = x
        else:
            nt.links.new(x, m.inputs[i])
    return m.outputs[0]

def smooth_range(nt, sock, a, b, lo, hi):
    r = nt.nodes.new('ShaderNodeMapRange')
    r.interpolation_type = 'SMOOTHSTEP'
    r.inputs['From Min'].default_value, r.inputs['From Max'].default_value = a, b
    r.inputs['To Min'].default_value, r.inputs['To Max'].default_value = lo, hi
    nt.links.new(sock, r.inputs['Value'])
    return r.outputs['Result']

def mirror_card(cam, center, normal, dist, size, strength, color=(1, 1, 1), lo=0.15, roll=0.0,
                span=None, bands=(), face=25):
    """A glowing gradient card placed exactly where the camera sees it mirrored
    in a flat polished face (at `center`, facing `normal`). It is what turns
    the face from a black mirror into a sweep of gold. Reflection-only: it
    doesn't light the set."""
    O, n = V(*center), Vector(normal).normalized()
    d = (O - cam.location).normalized()
    r = d - 2 * d.dot(n) * n
    m, nt, e = mat_emit('CardMat', color, strength)
    tc = nt.nodes.new('ShaderNodeTexCoord')
    sep = nt.nodes.new('ShaderNodeSeparateXYZ')
    if span is None:        # one slow gradient over the whole card
        nt.links.new(tc.outputs['Generated'], sep.inputs['Vector'])
        g = ramp(nt, sep.outputs['Y'], [(0.22, tuple(c * lo for c in color)), (0.78, color)])
        nt.links.new(g, e.inputs['Color'])
    else:
        # The face only mirrors a small patch of the card (it is a flat mirror
        # a long way from the camera), so the pattern is drawn in units of that
        # patch: one smooth bright-to-dim falloff across the face, like the
        # feathered edge of a softbox. (`bands` can add flags, unused for now.)
        cam_d = (O - cam.location).length
        patch = face * MM * (dist * MM + cam_d) / cam_d
        mp = nt.nodes.new('ShaderNodeMapping')
        mp.inputs['Scale'].default_value = (1 / patch, 1 / patch, 1 / patch)
        nt.links.new(tc.outputs['Object'], mp.inputs['Vector'])
        nt.links.new(mp.outputs['Vector'], sep.inputs['Vector'])
        u, v = sep.outputs['X'], sep.outputs['Y']
        val = smooth_range(nt, v, -span / 2, span / 2, lo, 1.0)
        for ang, off, hw, soft, depth in bands:
            a = math.radians(ang)
            t = math_node(nt, 'ADD', math_node(nt, 'MULTIPLY', u, math.cos(a)), math_node(nt, 'MULTIPLY', v, math.sin(a)))
            dist_to = math_node(nt, 'ABSOLUTE', math_node(nt, 'SUBTRACT', t, off))
            val = math_node(nt, 'MULTIPLY', val, smooth_range(nt, dist_to, hw, hw + soft, depth, 1.0))
        sc = nt.nodes.new('ShaderNodeVectorMath')
        sc.operation = 'SCALE'
        sc.inputs[0].default_value = color
        nt.links.new(val, sc.inputs['Scale'])
        nt.links.new(sc.outputs['Vector'], e.inputs['Color'])
    o = plane('Card', size[0], size[1], m)
    o.location = O + r * dist * MM
    look_at(o, O)
    o.rotation_euler.rotate_axis('Z', roll)
    o.visible_camera = False
    o.visible_diffuse = False
    o.visible_shadow = False
    return o

def flat_normal(root):
    """Front-face normal of a flat-lay pendant: it is tipped a few degrees by
    the ring under its bail, then turned with the rig."""
    n = Matrix.Rotation(root.rotation_euler.z, 3, 'Z') @ Matrix.Rotation(root['tilt'], 3, 'X') @ Vector((0, 0, 1))
    return tuple(n)

def yaw_normal(deg):
    """Front-face normal of a hanging pendant turned `deg` about the vertical."""
    a = math.radians(deg)
    return (math.sin(a), -math.cos(a), 0)

def hdri(name):
    return os.path.join(HERE, 'hdri', name + '_2k.hdr')

def sun(name, direction, strength, angle_deg=1.0, color=(1.0, 0.93, 0.84)):
    L = bpy.data.lights.new(name, 'SUN')
    L.energy = strength
    L.angle = math.radians(angle_deg)
    L.color = color
    o = link(bpy.data.objects.new(name, L))
    o.rotation_euler = Vector(direction).to_track_quat('-Z', 'Y').to_euler()
    return o

def camera(target, from_dir, frame_h, lens=100, fstop=8, focus=None, shift=(0, 0)):
    """Portrait camera whose frame is `frame_h` mm tall at the target."""
    cam = bpy.data.cameras.new('Camera')
    cam.lens = lens
    cam.sensor_width = 36
    cam.clip_start, cam.clip_end = 0.005, 50
    cam.shift_x, cam.shift_y = shift
    o = link(bpy.data.objects.new('Camera', cam))
    if OVERRIDE.get('frame'):
        frame_h = OVERRIDE['frame']
    if OVERRIDE.get('aim'):
        target = OVERRIDE['aim']
    dist = frame_h * lens / 36.0
    o.location = V(*target) + Vector(from_dir).normalized() * dist * MM
    look_at(o, V(*target))
    cam.dof.use_dof = True
    cam.dof.aperture_fstop = fstop
    cam.dof.aperture_blades = 9
    cam.dof.focus_distance = (o.location - V(*(focus or target))).length
    bpy.context.scene.camera = o
    return o

def world(color=(0.02, 0.02, 0.02), strength=1.0, hdri=None, hdri_strength=1.0, rot_z=0.0, camera_color=None):
    w = bpy.data.worlds.new('World')
    w.use_nodes = True
    nt = w.node_tree
    nt.nodes.clear()
    out = nt.nodes.new('ShaderNodeOutputWorld')
    bg = nt.nodes.new('ShaderNodeBackground')
    bg.inputs['Strength'].default_value = strength
    bg.inputs['Color'].default_value = (*color, 1)
    if hdri:
        env = nt.nodes.new('ShaderNodeTexEnvironment')
        env.image = bpy.data.images.load(hdri)
        tc = nt.nodes.new('ShaderNodeTexCoord')
        mp = nt.nodes.new('ShaderNodeMapping')
        mp.inputs['Rotation'].default_value = (0, 0, rot_z)
        nt.links.new(tc.outputs['Generated'], mp.inputs['Vector'])
        nt.links.new(mp.outputs['Vector'], env.inputs['Vector'])
        nt.links.new(env.outputs['Color'], bg.inputs['Color'])
        bg.inputs['Strength'].default_value = hdri_strength
    if camera_color is None:
        nt.links.new(bg.outputs['Background'], out.inputs['Surface'])
    else:  # the camera sees a flat colour; lighting and reflections see the rest
        lp = nt.nodes.new('ShaderNodeLightPath')
        bg2 = nt.nodes.new('ShaderNodeBackground')
        bg2.inputs['Color'].default_value = (*camera_color, 1)
        mx = nt.nodes.new('ShaderNodeMixShader')
        nt.links.new(lp.outputs['Is Camera Ray'], mx.inputs['Fac'])
        nt.links.new(bg.outputs['Background'], mx.inputs[1])
        nt.links.new(bg2.outputs['Background'], mx.inputs[2])
        nt.links.new(mx.outputs['Shader'], out.inputs['Surface'])
    bpy.context.scene.world = w

OVERRIDE = {}

# ───────────────────────── pendant rigs ─────────────────────────

def rig_flat(pid, gold, chain='loop', seed=3):
    """Pendant lying face-up on z = 0 with its jump ring and chain. The ring
    has to stand fairly upright to pass through the bail, so the bail end
    rests on it, a few degrees off the surface, as it does in real life.
    Returns the root empty (pendant centre at its origin, bail toward +Y)."""
    info = PENDANTS[pid]
    yb = -info['bail']['centerMm'][1]
    hole = info['bail']['holeRadiusMm']
    root = link(bpy.data.objects.new('Rig', None))
    pend, t = load_pendant(pid, gold)
    a = math.radians(64)                                   # ring lean from the surface
    zc = RING_r + RING_R * math.sin(a)                     # ring centre height
    low = min(v[1] for v in info['bboxMm'])                # far rim (STL y) -> after flip it's -max
    y_far = -max(v[1] for v in info['bboxMm'])
    tilt = math.asin((zc - t / 2) / (yb - y_far))
    pend.matrix_basis = (Matrix.Translation(V(0, y_far, 0)) @ Matrix.Rotation(tilt, 4, 'X')
                         @ Matrix.Translation(V(0, -y_far, t / 2)))
    pend.parent = root
    root['tilt'] = tilt

    cy = yb + hole - RING_r - 0.1 + RING_R
    D = Vector((math.cos(a), 0, math.sin(a)))
    Y = Vector((0, 1, 0))
    rot = Matrix((Y, D, Y.cross(D))).transposed()
    ring = new_obj('JumpRing', ring_mesh(), gold)
    ring.matrix_basis = Matrix.Translation(V(0, cy, zc)) @ rot.to_4x4()
    ring.parent = root

    z = CHAIN_REST_Z
    c = Vector((0, cy, zc))
    through = c - 0.45 * RING_R * D + Vector((0, 0.5, 0))   # where the chain passes the ring
    if chain == 'loop':      # an open necklace loop rising out of the top of frame
        left = [(-22, cy + 150, z), (-33, cy + 100, z), (-30, cy + 58, z), (-19, cy + 26, z), (-9, cy + 7, z), (-3.2, cy + 0.6, z)]
        right = [(3.6, cy + 1.2, z), (10, cy + 6, z), (22, cy + 22, z), (36, cy + 52, z), (41, cy + 96, z), (30, cy + 150, z)]
    else:                    # both strands swept off to one side in a lazy S
        left = [(-70, cy + 120, z), (-58, cy + 70, z), (-34, cy + 44, z), (-14, cy + 30, z), (-7, cy + 12, z), (-3.2, cy + 1.5, z)]
        right = [(3.6, cy + 0.2, z), (11, cy - 3, z), (26, cy + 4, z), (40, cy + 26, z), (66, cy + 40, z), (110, cy + 30, z), (150, cy + 60, z)]
    build_chain(left + [tuple(through)] + right, (0, 0, 1), gold, parent=root, seed=seed)
    return root

def rig_hang(pid, gold, spread_deg=13, length=220, seed=5, yaw=0.0):
    """Pendant hanging in the XZ plane facing -Y, centre at the origin, on a
    jump ring and a chain that rises in a narrow V. Returns the root empty."""
    info = PENDANTS[pid]
    yb = -info['bail']['centerMm'][1]
    hole = info['bail']['holeRadiusMm']
    root = link(bpy.data.objects.new('Rig', None))
    pend, t = load_pendant(pid, gold)
    pend.matrix_basis = Matrix.Rotation(yaw, 4, 'Z') @ Matrix.Rotation(math.radians(90), 4, 'X')
    pend.parent = root
    zr = yb + hole - RING_r + RING_R                         # ring centre
    ring = new_obj('JumpRing', ring_mesh(), gold)
    ring.matrix_basis = (Matrix.Translation(V(0, 0, zr)) @ Matrix.Rotation(yaw + math.radians(24), 4, 'Z')
                         @ Matrix.Rotation(math.radians(90), 4, 'Y'))
    ring.parent = root
    # The ring hangs on the chain: its top wire rests across one link, and the
    # two strands rise from that link's ends, pulled straight by the weight.
    apex = zr + RING_R - RING_r - 0.62
    th = math.radians(spread_deg)
    n = int(length / PITCH)
    samples = []
    for side in (-1, 1):
        u = Vector((side * math.sin(th), 0, math.cos(th)))
        joint = Vector((side * PITCH / 2, 0, apex))
        strand = [(joint + u * (k - 0.5) * PITCH, u * side) for k in range(1, n)]
        samples += strand[::-1] + [(Vector((0, 0, apex)), Vector((1, 0, 0)))] if side < 0 else strand
    build_chain(samples, (0, -1, 0), gold, parent=root, seed=seed)
    return root

# ───────────────────────── scenes ─────────────────────────

def scene_studio_soft(pid):
    """Clean e-commerce hero: flat-lay on warm paper under one big soft source,
    with a strip light for a bright edge."""
    grade('Standard', exposure=-1.0)
    gold = mat_gold(color=GOLD_RICH)
    plane('Paper', 3000, 3000, mat_paper((0.74, 0.70, 0.64)))
    root = rig_flat(pid, gold, 'loop')
    root.rotation_euler = (0, 0, math.radians(-14))
    world(hdri=hdri('studio_small_08'), hdri_strength=0.35, rot_z=math.radians(60))
    area('Key', (-260, 60, 380), (0, 10, 0), (420, 420), 5.0, glossy=False)
    area('Strip', (330, -60, 150), (0, 0, 0), (60, 500), 1.6, color=(1.0, 0.95, 0.9))
    cam = camera((2, 17, 0), (0.0, -0.38, 1.0), 78, lens=100, fstop=13, focus=(0, 0, 1))
    mirror_card(cam, (0, 0, 1), flat_normal(root), 380, (520, 520), 2.5, color=(1.0, 0.97, 0.93), lo=0.30, roll=math.radians(35), span=1.4)

def scene_studio_grey(pid):
    """Catalogue shot: hanging in front of a soft grey seamless, one large
    key from the upper left, a gentle shadow falling on the backdrop."""
    grade('Standard', exposure=-1.8)
    gold = mat_gold(color=GOLD_RICH)
    plane('Backdrop', 4000, 4000, mat_paper((0.50, 0.50, 0.51)), loc=(0, 38, 0), rot=(math.radians(90), 0, 0))
    rig_hang(pid, gold, spread_deg=10, yaw=math.radians(6))
    world(hdri=hdri('studio_small_09'), hdri_strength=0.16, rot_z=math.radians(30))
    area('Key', (-210, -300, 250), (0, 0, 0), (110, 110), 1.5, glossy=False)
    area('Pool', (-60, -260, 120), (10, 38, -8), (60, 60), 0.35, spread=50, glossy=False)
    area('Rim', (230, 20, 60), (0, 0, 0), (40, 320), 1.4)
    cam = camera((0, 0, 5), (0.0, -1.0, 0.02), 80, lens=100, fstop=16, focus=(0, 0, 0))
    mirror_card(cam, (0, 0, 0), yaw_normal(6), 360, (520, 520), 4.3, color=(1.0, 0.98, 0.95), lo=0.28, roll=math.radians(-150), span=1.4)

def scene_oxblood(pid):
    """Holiday editorial: deep red paper, one hard light, a long crisp shadow."""
    gold = mat_gold()
    plane('Paper', 3000, 3000, mat_paper((0.20, 0.012, 0.02)))
    root = rig_flat(pid, gold, 'sweep', seed=12)
    root.rotation_euler = (0, 0, math.radians(-28))
    world(hdri=hdri('photo_studio_01'), hdri_strength=0.3, rot_z=math.radians(300))
    sun('Hard', Vector((0.55, -0.35, -0.75)), 4.0, angle_deg=1.6, color=(1.0, 0.96, 0.92))
    cam = camera((6, 10, 0), (0.0, -0.22, 1.0), 82, lens=100, fstop=13, focus=(0, 0, 1))
    mirror_card(cam, (0, 0, 1), (0, 0, 1), 380, (520, 520), 1.45, color=(1.0, 0.93, 0.84), lo=0.05, roll=math.radians(-60))

def scene_stone_sun(pid):
    """Editorial: travertine in low afternoon sun through a window, hard
    shadows across the stone."""
    grade('Standard', exposure=-0.4)
    gold = mat_gold(color=GOLD_RICH)
    plane('Stone', 3000, 3000, mat_stone())
    root = rig_flat(pid, gold, 'sweep', seed=8)
    root.rotation_euler = (0, 0, math.radians(24))
    world(hdri=hdri('brown_photostudio_02'), hdri_strength=0.35, rot_z=math.radians(200))
    d = Vector((0.72, 0.42, -0.50)).normalized()            # direction the light travels
    sun('Sun', d, 5.0, angle_deg=0.9)
    g = window_gobo('Window', panes=(2, 2), pane=(100, 130), bar=16)
    g.location = -d * 0.9 + V(22, 8, 0)
    g.rotation_euler = d.to_track_quat('-Z', 'Y').to_euler()
    g.rotation_euler.rotate_axis('Z', math.radians(12))
    cam = camera((3, 8, 0), (0.18, -0.80, 1.0), 70, lens=100, fstop=16, focus=(0, 0, 1))
    mirror_card(cam, (0, 0, 1), (0, 0, 1), 380, (520, 520), 1.75, color=(1.0, 0.95, 0.88), lo=0.2, roll=math.radians(100))

def scene_wall_dangle(pid):
    """Hanging in front of a limewashed wall in raking window light, so the
    chart's cut-outs throw their own shadow beside it."""
    grade('Standard', exposure=-0.5)
    gold = mat_gold(color=GOLD_RICH)
    wall_y = 34
    plane('Wall', 4000, 4000, mat_plaster(), loc=(0, wall_y, 0), rot=(math.radians(90), 0, 0))
    rig_hang(pid, gold, spread_deg=9, yaw=math.radians(-7))
    world(hdri=hdri('brown_photostudio_02'), hdri_strength=0.3, rot_z=math.radians(120))
    d = Vector((0.66, 0.62, -0.42)).normalized()
    sun('Sun', d, 5.5, angle_deg=0.7)
    g = window_gobo('Window', panes=(2, 3), pane=(70, 78), bar=13)
    g.location = -d * 0.8 + V(20, 0, 2)
    g.rotation_euler = d.to_track_quat('-Z', 'Y').to_euler()
    g.rotation_euler.rotate_axis('Z', math.radians(-6))
    cam = camera((15, 0, 2), (0.10, -1.0, 0.04), 84, lens=100, fstop=18, focus=(0, 0, 0))
    mirror_card(cam, (0, 0, 0), yaw_normal(-7), 360, (520, 520), 1.75, color=(1.0, 0.95, 0.87), lo=0.30, roll=math.radians(160), span=1.4)

GOLD_RICH = (1.0, 0.74, 0.33)       # a little yellower than the default gold

def grade(view='Standard', look='None', exposure=0.0):
    """Swap the default AgX grade for a scene. AgX rolls highlights off gently
    but pulls bright colour toward grey; Standard keeps whites white and gold
    yellow, at the cost of clipping, so light those scenes just under white."""
    vs = bpy.context.scene.view_settings
    vs.view_transform = view
    vs.look = look
    vs.exposure = exposure

def scene_wall_rest(pid):
    """Catalogue: hanging flat against an off-white wall, seen straight on.
    The wall is a millimetre or two behind the metal, so pendant, ring and
    every chain link drop a tight, soft shadow just below and to the right."""
    grade('Standard')
    gold = mat_gold(color=GOLD_RICH)
    wall_y = 2.0                                             # just clear of the ring and links
    plane('Wall', 4000, 4000, mat_paper((0.88, 0.865, 0.83)), loc=(0, wall_y, 0), rot=(math.radians(90), 0, 0))
    rig_hang(pid, gold, spread_deg=15, yaw=0.0)
    world(hdri=hdri('studio_small_08'), hdri_strength=0.42, rot_z=math.radians(200))
    # One sun, softened to about a small softbox, from the upper left.
    sun('Key', Vector((0.60, 0.62, -0.50)), 3.1, angle_deg=9.0, color=(1.0, 0.98, 0.95))
    cam = camera((0, 0, 36), (0.0, -1.0, 0.0), 138, lens=100, fstop=16, focus=(0, 0, 0))
    mirror_card(cam, (0, 0, 0), yaw_normal(0), 360, (520, 520), 1.25, color=(1.0, 0.98, 0.94), lo=0.55, roll=math.radians(150), span=1.4)

def stars(n, seed, box, size, mat):
    """n tiny emitters scattered in a box (mm): they blur into bokeh discs."""
    rnd = random.Random(seed)
    verts, faces = [], []
    for _ in range(n):
        c = Vector((rnd.uniform(*box[0]), rnd.uniform(*box[1]), rnd.uniform(*box[2])))
        r = size * rnd.uniform(0.4, 1.6)
        k = len(verts)
        for dx, dy, dz in ((1, 0, 0), (-1, 0, 0), (0, 1, 0), (0, -1, 0), (0, 0, 1), (0, 0, -1)):
            verts.append((c + r * Vector((dx, dy, dz))) * MM)
        faces += [(k, k + 2, k + 4), (k + 2, k + 1, k + 4), (k + 1, k + 3, k + 4), (k + 3, k, k + 4),
                  (k + 2, k, k + 5), (k + 1, k + 2, k + 5), (k + 3, k + 1, k + 5), (k, k + 3, k + 5)]
    o = new_obj('Stars', mesh_from('Stars', verts, faces), mat, smooth=False)
    o.visible_diffuse = False
    o.visible_glossy = False
    o.visible_shadow = False
    return o

def night_backdrop(top=(0.002, 0.004, 0.016), mid=(0.008, 0.016, 0.05), low=(0.022, 0.045, 0.085), y=3000):
    m, nt, e = mat_emit('Sky', (0, 0, 0), 1.0)
    tc = nt.nodes.new('ShaderNodeTexCoord')
    sep = nt.nodes.new('ShaderNodeSeparateXYZ')
    nt.links.new(tc.outputs['Generated'], sep.inputs['Vector'])
    nt.links.new(ramp(nt, sep.outputs['Y'], [(0.36, low), (0.50, mid), (0.66, top)]), e.inputs['Color'])
    sky = plane('Sky', 6000, 6000, m, loc=(0, y, 0), rot=(math.radians(90), 0, 0))
    sky.visible_diffuse = False
    sky.visible_glossy = False
    return sky

def scene_night_sky(pid):
    """Night: the pendant hangs against a deep blue sky of soft, out-of-focus
    stars, warm key from one side, cool moonlight on the rim."""
    gold = mat_gold(rough=0.075)
    rig_hang(pid, gold, spread_deg=11, yaw=math.radians(12))
    night_backdrop()
    # Stars sit just behind the pendant so the lens blurs them into small discs.
    for i, (col, st, n, sz, ybox) in enumerate([
            ((1.0, 0.88, 0.70), 55, 34, 0.16, (14, 70)),
            ((0.74, 0.85, 1.0), 60, 46, 0.14, (16, 60)),
            ((1, 1, 1), 150, 14, 0.12, (10, 40))]):
        sm, _, _ = mat_emit('Star%d' % i, col, st)
        stars(n, 21 + i, ((-75, 75), ybox, (-70, 85)), sz, sm)
    world(color=(0.003, 0.005, 0.010), strength=1.0)
    area('Key', (-230, -260, 130), (0, 0, 2), (220, 320), 1.6, color=(1.0, 0.86, 0.68), glossy=False)
    area('Moon', (150, 190, 140), (0, 0, 0), (50, 260), 3.4, color=(0.62, 0.76, 1.0))
    area('MoonL', (-170, 150, -40), (0, 0, 0), (36, 200), 1.2, color=(0.55, 0.70, 1.0))
    cam = camera((0, 0, 6), (-0.16, -1.0, -0.03), 76, lens=100, fstop=7.1, focus=(0, 0, 0))
    mirror_card(cam, (0, 0, 0), yaw_normal(12), 360, (480, 480), 1.5, color=(1.0, 0.84, 0.62), lo=0.03, roll=math.radians(200))

def scene_eclipse(pid):
    """Space: the pendant stands on black glass in front of a thin corona of
    light, like a moon crossing a sun, with its reflection beneath it."""
    gold = mat_gold(rough=0.07)
    info = PENDANTS[pid]
    r = info['diameterMm'] / 2
    pend, t = load_pendant(pid, gold)
    pend.matrix_basis = (Matrix.Translation(V(0, 0, r)) @ Matrix.Rotation(math.radians(-10), 4, 'Z')
                         @ Matrix.Rotation(math.radians(90), 4, 'X'))
    plane('Floor', 4000, 4000, mat_black_gloss())
    # Corona: a glowing ring just larger than the pendant, see-through elsewhere.
    m = bpy.data.materials.new('Corona'); m.use_nodes = True
    nt = m.node_tree; nt.nodes.clear()
    out = nt.nodes.new('ShaderNodeOutputMaterial')
    e = nt.nodes.new('ShaderNodeEmission'); e.inputs['Strength'].default_value = 4.0
    tr = nt.nodes.new('ShaderNodeBsdfTransparent')
    addn = nt.nodes.new('ShaderNodeAddShader')
    tc = nt.nodes.new('ShaderNodeTexCoord')
    ln = nt.nodes.new('ShaderNodeVectorMath'); ln.operation = 'LENGTH'
    nt.links.new(tc.outputs['Object'], ln.inputs[0])
    rad = nt.nodes.new('ShaderNodeMath'); rad.operation = 'DIVIDE'; rad.inputs[1].default_value = 80 * MM
    nt.links.new(ln.outputs['Value'], rad.inputs[0])
    nt.links.new(ramp(nt, rad.outputs[0], [(0.212, (0, 0, 0)), (0.230, (1.0, 0.78, 0.52)), (0.255, (0.05, 0.018, 0.006)), (0.34, (0.004, 0.0012, 0.001)), (0.5, (0, 0, 0))]), e.inputs['Color'])
    nt.links.new(tr.outputs['BSDF'], addn.inputs[0]); nt.links.new(e.outputs['Emission'], addn.inputs[1])
    nt.links.new(addn.outputs['Shader'], out.inputs['Surface'])
    cor = plane('Corona', 170, 170, m, loc=(-1.5, 42, r + 1.5), rot=(math.radians(90), 0, 0))
    cor.visible_shadow = False
    night_backdrop(top=(0.0, 0.0, 0.002), mid=(0.002, 0.003, 0.010), low=(0.006, 0.010, 0.026))
    world(color=(0.001, 0.0015, 0.003), strength=1.0)
    area('StripL', (-150, -170, 60), (0, 0, r), (30, 300), 0.9, color=(1.0, 0.90, 0.78))
    area('StripR', (190, -90, 90), (0, 0, r), (24, 300), 0.6, color=(0.80, 0.88, 1.0))
    cam = camera((0, 0, r - 3.5), (0.04, -1.0, 0.10), 70, lens=100, fstop=11, focus=(0, 0, r))
    mirror_card(cam, (0, 0, r), yaw_normal(-10), 340, (460, 460), 1.1, color=(1.0, 0.86, 0.66), lo=0.02, roll=math.radians(180))

SCENES = {
    'studio-soft': scene_studio_soft,
    'studio-grey': scene_studio_grey,
    'oxblood': scene_oxblood,
    'stone-sun': scene_stone_sun,
    'wall-dangle': scene_wall_dangle,
    'wall-rest': scene_wall_rest,
    'night-sky': scene_night_sky,
    'eclipse': scene_eclipse,
}

# ───────────────────────── render ─────────────────────────

def setup_render(scale, samples):
    sc = bpy.context.scene
    sc.render.engine = 'CYCLES'
    # Metal on a Mac; on Linux (the Modal containers) OptiX, then CUDA; else CPU.
    sc.cycles.device = 'CPU'
    try:
        prefs = bpy.context.preferences.addons['cycles'].preferences
        for kind in (('METAL',) if sys.platform == 'darwin' else ('OPTIX', 'CUDA')):
            try:
                prefs.compute_device_type = kind
            except TypeError:
                continue
            prefs.get_devices()
            gpus = [d for d in prefs.devices if d.type == kind]
            if gpus:
                for dev in prefs.devices:
                    dev.use = dev.type == kind or sys.platform == 'darwin'
                sc.cycles.device = 'GPU'
                break
        print('CYCLES DEVICES', sc.cycles.device, [(d.name, d.type, d.use) for d in prefs.devices])
    except Exception as ex:
        print('GPU setup failed, using CPU:', ex)
    sc.cycles.samples = samples
    sc.cycles.use_adaptive_sampling = True
    sc.cycles.adaptive_threshold = 0.006
    sc.cycles.use_denoising = True
    sc.cycles.max_bounces = 10
    sc.cycles.glossy_bounces = 8
    sc.cycles.sample_clamp_indirect = 8.0
    sc.cycles.filter_width = 1.4
    sc.render.resolution_x, sc.render.resolution_y = 2400, 3000
    sc.render.resolution_percentage = scale
    sc.render.image_settings.file_format = 'PNG'
    sc.view_settings.view_transform = 'AgX'
    for look in ('AgX - Medium High Contrast', 'Medium High Contrast'):
        try:
            sc.view_settings.look = look
            break
        except TypeError:
            pass

def main():
    argv = sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else []
    ap = argparse.ArgumentParser()
    ap.add_argument('--scene', default='all')
    ap.add_argument('--pendant', default='nyc-1990')
    ap.add_argument('--stl', help='render this STL file instead of a --pendant id')
    ap.add_argument('--name', help='with --stl: name used in the output file')
    ap.add_argument('--scale', type=int, default=100)
    ap.add_argument('--samples', type=int, default=700)
    ap.add_argument('--out', default=os.path.join(HERE, 'renders'))
    ap.add_argument('--blend', action='store_true')
    ap.add_argument('--frame', type=float, help='debug: frame height in mm (zoom)')
    ap.add_argument('--aim', help='debug: camera target x,y,z in mm')
    ap.add_argument('--tag', default='')
    a = ap.parse_args(argv)
    global PENDANTS
    if a.stl:       # any pendant STL: measure it instead of looking it up
        a.pendant = a.name or os.path.splitext(os.path.basename(a.stl))[0]
        PENDANTS = {a.pendant: stl_info(a.pendant, os.path.abspath(a.stl))}
    else:
        with open(os.path.join(HERE, 'meshes', 'pendants.json')) as f:
            meta = json.load(f)
        PENDANTS = {p['id']: {**p, 'diameterMm': meta['diameterMm']} for p in meta['pendants']}
    os.makedirs(a.out, exist_ok=True)
    if a.frame:
        OVERRIDE['frame'] = a.frame
    if a.aim:
        OVERRIDE['aim'] = tuple(float(v) for v in a.aim.split(','))
    for name in (SCENES if a.scene == 'all' else a.scene.split(',')):
        bpy.ops.wm.read_factory_settings(use_empty=True)
        setup_render(a.scale, a.samples)
        SCENES[name](a.pendant)
        out = os.path.join(a.out, '%s_%s%s.png' % (name, a.pendant, a.tag))
        bpy.context.scene.render.filepath = out
        if a.blend:
            bpy.ops.wm.save_as_mainfile(filepath=os.path.splitext(out)[0] + '.blend')
        bpy.ops.render.render(write_still=True)
        print('WROTE', out)

main()
