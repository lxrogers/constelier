import { draw, drawCircle } from 'replicad';

import { layout } from './sun-arcs-params';
const circle = (r, x = 0, y = 0) => drawCircle(r).translate(x, y);
const ring = (r, w, x = 0, y = 0) => circle(r, x, y).cut(circle(r - w, x, y));
export function buildSunArcs(input) {
  const { params: p, radius, rim, sun, rays, groups } = layout(input);
  const solid = d => d.sketchOnPlane("XY").extrude(p.depth);
  let body = solid(circle(sun.radius, sun.x, sun.y));
  const apply = (operation, tool) => {
    const previous = body;
    try { body = previous[operation](tool); }
    finally { tool.delete(); }
    previous.delete();
  };
  try {
  for (const points of rays) {
    apply('fuse', solid(draw(points[0]).lineTo(points[1]).lineTo(points[2]).lineTo(points[3]).close()));
  }
  for (const { x, y, maskRadius, rings } of groups) {
    apply('cut', solid(circle(maskRadius, x, y)));
    for (const r of rings) apply('fuse', solid(ring(r, p.stroke, x, y)));
  }
  apply('intersect', solid(circle(radius)));
  apply('fuse', solid(ring(radius, rim)));
  return { shape: body, params: p };
  } catch (error) { body.delete(); throw error; }
}
