# Draw loops JSON from sweep.mjs as a grid of dark pendants on cream.
import json, sys
from PIL import Image, ImageDraw
src, dst = sys.argv[1], sys.argv[2]
data = json.load(open(src))
S = 220; R = 108
rows = list(data.items())
cols = list(rows[0][1].keys())
img = Image.new('RGB', (S * len(cols), S * len(rows)), (245, 240, 230))
for r, (day, byv) in enumerate(rows):
    for c, v in enumerate(cols):
        big = Image.new('L', (S * 3, S * 3), 0)
        d = ImageDraw.Draw(big)
        k = S * 3 / (2 * R + 8); cx = cy = S * 3 / 2
        d.ellipse([cx - R * k, cy - R * k, cx + R * k, cy + R * k], fill=255)
        for loop in byv[v]:
            d.polygon([(cx + x * k, cy - y * k) for x, y in loop], fill=0)
        m = big.resize((S, S), Image.LANCZOS)
        tile = Image.new('RGB', (S, S), (245, 240, 230))
        tile.paste((40, 34, 26), (0, 0), m)
        ImageDraw.Draw(tile).text((6, 4), f'{v}', fill=(160, 60, 40))
        img.paste(tile, (c * S, r * S))
img.save(dst)
