# Makes the chart ink for the eleven other pendants of the film's last shot
# (tools/blender/film/grid/ink.png), laid out as the grid is: 4 across, 3 down,
# the hero's own place (third in the second row) left empty.
#
#   <python with Pillow> tools/blender/grid-ink.py
#
# STAND-IN: the ink is lifted from the website's top-down pictures of each
# neighbour (public/hero/grid/NN.webp), which have the pendant in
# them. Only what lies outside the pendant is kept (the zodiac ring, its
# lettering and the planets), as darkness against the paper. The proper source
# is each chart's own finished 2D drawing, baked like the hero's chart.
import os, json, math
import numpy as np
from PIL import Image

HERE = os.path.dirname(os.path.abspath(__file__))
SRC = os.path.join(HERE, '../../public/hero/grid')
OUT = os.path.join(HERE, 'film/grid/ink.png')
COLS, ROWS, OWN = 4, 3, (2, 1)
GAP = 1.14                      # neighbours sit this many chart-widths apart (GRID_GAP in src/app/halo/hero/hero-grid.ts)
TILE = 512

with open(os.path.join(HERE, 'film/chart.json')) as f:
    half = json.load(f)['half']
with open(os.path.join(HERE, 'film/pendant.json')) as f:
    P = json.load(f)
rim = P['rimR'] + P['rimWidth']                       # the pendant's outer edge, in the chart's units
cell = int(round(TILE * GAP))
sheet = np.zeros((ROWS * cell, COLS * cell, 4), dtype=np.float32)
ys, xs = np.mgrid[0:TILE, 0:TILE]
x, y = (xs + 0.5) / TILE * 2 * half - half, half - (ys + 0.5) / TILE * 2 * half
r = np.hypot(x, y)
# Outside the pendant and its shadow's darkest part, and clear of the bail at the top.
keep = np.clip((r - (rim + 5.0)) / 2.5, 0, 1) * (1 - np.clip(1 - (np.hypot(x, y - (P['extent'] - 16)) - 30) / 4, 0, 1))
n = 0
for row in range(ROWS):
    for col in range(COLS):
        if (col, row) == OWN:
            continue
        img = np.asarray(Image.open(os.path.join(SRC, '%02d.webp' % n)).convert('RGB').resize((TILE, TILE)), dtype=np.float32) / 255
        n += 1
        lum = img @ np.array([0.3, 0.59, 0.11], dtype=np.float32)
        paper = np.median(lum[r > rim + 30])
        dark = np.clip((paper - lum) / paper, 0, 1)
        alpha = np.clip((dark - 0.16) / 0.3, 0, 1) * keep     # the pendant's soft shadow is too faint to count as ink
        oy, ox = row * cell + (cell - TILE) // 2, col * cell + (cell - TILE) // 2
        sheet[oy:oy + TILE, ox:ox + TILE, :3] = (0.23, 0.22, 0.2)
        sheet[oy:oy + TILE, ox:ox + TILE, 3] = alpha
Image.fromarray((sheet * 255).astype(np.uint8), 'RGBA').save(OUT)
print('WROTE', OUT, sheet.shape)
