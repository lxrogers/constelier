import fs from 'fs';
import { outlineDataToLoops } from '../../modules/organic/outline-common.js';
const out = {};
for (const s of ['sparse', 'medium', 'dense', 'extreme']) for (const a of ['current', 'liquid', 'pebble']) {
  const data = JSON.parse(fs.readFileSync(`tools/organic-compare/out/${s}-${a}.json`));
  const loops = outlineDataToLoops(data, 0.7);
  const R = 108, f = v => v.toFixed(1);
  let d = `M${R} 0A${R} ${R} 0 1 0 ${-R} 0A${R} ${R} 0 1 0 ${R} 0Z`;
  for (const l of loops) d += 'M' + l.map(p => f(p[0]) + ' ' + f(-p[1])).join('L') + 'Z';
  out[`${s}-${a}`] = `<svg viewBox="-112 -112 224 224" role="img"><path fill="currentColor" fill-rule="evenodd" d="${d}"/></svg>`;
}
fs.writeFileSync('tools/organic-compare/out/svgs.json', JSON.stringify(out));
console.log(Object.values(out).reduce((a, s) => a + s.length, 0));
