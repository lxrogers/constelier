// Find self-intersections / near-touches in outline loops.
import fs from 'fs';
import { outlineDataToLoops } from '../../modules/organic/outline-common.js';
const name = process.argv[2];
const data = JSON.parse(fs.readFileSync(`tools/organic-compare/out/${name}.json`));
const loops = outlineDataToLoops(data, 0.3);
function segX(a, b, c, d) {
  const d1 = (b[0]-a[0])*(c[1]-a[1]) - (b[1]-a[1])*(c[0]-a[0]);
  const d2 = (b[0]-a[0])*(d[1]-a[1]) - (b[1]-a[1])*(d[0]-a[0]);
  const d3 = (d[0]-c[0])*(a[1]-c[1]) - (d[1]-c[1])*(a[0]-c[0]);
  const d4 = (d[0]-c[0])*(b[1]-c[1]) - (d[1]-c[1])*(b[0]-c[0]);
  return d1*d2 < 0 && d3*d4 < 0;
}
loops.forEach((l, li) => {
  let hits = 0, at = null;
  for (let i = 0; i < l.length; i++) for (let j = i + 2; j < l.length; j++) {
    if (i === 0 && j === l.length - 1) continue;
    if (segX(l[i], l[(i+1)%l.length], l[j], l[(j+1)%l.length])) { hits++; at = l[i]; }
  }
  if (hits) console.log('loop', li, 'self-intersections', hits, 'near', at.map(v => v.toFixed(1)).join(','), 'segs', data.voidChains[li].links.length);
});
console.log('checked', loops.length);
