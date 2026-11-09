// Build 3D for every outline JSON in tools/organic-compare/out and dump meshes for rendering.
// Run from the repo root: node tools/organic-compare/build3d.mjs [filter]
import fs from 'fs';
import path from 'path';
import { setOC } from 'replicad';
import { buildPendant3D, filletShape } from '../../modules/replicad-pipeline.js';
// The OpenCascade loader ships as CommonJS-flavoured ESM that Node can't load
// directly, so keep a patched copy in ./vendor (gitignored), made on first run.
const vendor = new URL('./vendor/replicad_single.mjs', import.meta.url);
if (!fs.existsSync(vendor)) {
  fs.mkdirSync(new URL('./vendor/', import.meta.url), { recursive: true });
  const src = fs.readFileSync(path.resolve('node_modules/replicad-opencascadejs/src/replicad_single.js'), 'utf8');
  const prefix = "import { createRequire } from 'module'; import { fileURLToPath } from 'url'; import { dirname } from 'path'; const require = createRequire(import.meta.url); const __filename = fileURLToPath(import.meta.url); const __dirname = dirname(__filename);\n";
  fs.writeFileSync(vendor, prefix + src);
}
const { default: ocInit } = await import(vendor.href);
const out = new URL('./out/', import.meta.url).pathname;
setOC(await ocInit({ locateFile: () => path.resolve('node_modules/replicad-opencascadejs/src/replicad_single.wasm') }));
const files = fs.readdirSync(out).filter(f => /^[a-z]+-[a-z]+\.json$/.test(f) && !f.includes('loops') && !f.startsWith('dbg') && f !== 'metrics.json');
const only = process.argv[2];
const report = {};
for (const f of files) {
  if (only && !f.includes(only)) continue;
  const data = JSON.parse(fs.readFileSync(out + f));
  const t0 = performance.now();
  const res = buildPendant3D(data, 5);
  const t1 = performance.now();
  const fl = filletShape(res.shape, 5, 2);
  const t2 = performance.now();
  const mesh = fl.shape.mesh({ tolerance: 0.05, angularTolerance: 1 });
  const name = f.replace('.json', '');
  fs.writeFileSync(out + name + '.mesh.bin', Buffer.concat([
    Buffer.from(new Uint32Array([mesh.vertices.length / 3, mesh.triangles.length / 3]).buffer),
    Buffer.from(new Float32Array(mesh.vertices).buffer),
    Buffer.from(new Float32Array(mesh.normals).buffer),
    Buffer.from(new Uint32Array(mesh.triangles).buffer),
  ]));
  report[name] = { cutOk: res.cutOk, cutFail: res.cutFail, fillet: fl.filletInfo, buildMs: Math.round(t1 - t0), filletMs: Math.round(t2 - t1), tris: mesh.triangles.length / 3 };
  console.log(name, JSON.stringify(report[name]));
}
fs.writeFileSync(out + 'report3d' + (only ? '-' + only : '') + '.json', JSON.stringify(report, null, 1));
