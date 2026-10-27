import { draw, drawCircle } from 'replicad';

import { normalize } from './sun-arcs-params';
const circle = (r, x = 0, y = 0) => drawCircle(r).translate(x, y);
const ring = (r, w, x = 0, y = 0) => circle(r, x, y).cut(circle(r - w, x, y));
export function buildSunArcs(input) {
  const p = normalize(input), radius = 15, sx = -2, sy = -1.5, sunRadius = 6.4;
  const solid = d => d.sketchOnPlane("XY").extrude(p.depth);
  let body = solid(circle(sunRadius, sx, sy));
  const apply = (operation, tool) => {
    const previous = body;
    try { body = previous[operation](tool); }
    finally { tool.delete(); }
    previous.delete();
  };
  try {
  for (let i = 0; i < p.rays; i++) {
    const a = i * Math.PI * 2 / p.rays, dx = Math.cos(a), dy = Math.sin(a), w = p.stroke / 2;
    const point = (r, side) => [sx + dx * r - dy * w * side, sy + dy * r + dx * w * side];
    apply('fuse', solid(draw(point(5.8, 1)).lineTo(point(35, 1)).lineTo(point(35, -1)).lineTo(point(5.8, -1)).close()));
  }
  // Back-to-front footprints erase underlying rays and earlier arc families.
  const centers = [[15, -1], [-3, 16], [11, 11], [-13, 9], [8, -13]];
  for (let i = 0; i < p.groups; i++) {
    const [x, y] = centers[i], outer = [12.5, 13, 12.5, 11, 11][i];
    apply('cut', solid(circle(outer - p.stroke, x, y)));
    for (let j = 0; j < p.rings; j++) {
      const r = outer - j * Math.min(p.spacing, (outer - 1.3) / Math.max(1, p.rings - 1));
      apply('fuse', solid(ring(r, p.stroke, x, y)));
    }
  }
  apply('intersect', solid(circle(radius)));
  apply('fuse', solid(ring(radius, 0.65)));
  return { shape: body, params: p };
  } catch (error) { body.delete(); throw error; }
}
