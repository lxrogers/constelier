// Mesh checks before sending a file to the caster: weld, manifold edges, consistent
// orientation, genus (should equal the number of voids), volume, self-intersections.
export function weld(V, T, eps = 1e-5) {
  const map = new Map(), remap = new Uint32Array(V.length / 3), out = [];
  for (let i = 0; i < V.length / 3; i++) {
    const k = Math.round(V[3*i]/eps) + ',' + Math.round(V[3*i+1]/eps) + ',' + Math.round(V[3*i+2]/eps);
    let j = map.get(k); if (j === undefined) { j = out.length / 3; map.set(k, j); out.push(V[3*i], V[3*i+1], V[3*i+2]); }
    remap[i] = j;
  }
  const tris = [];
  for (let t = 0; t < T.length; t += 3) { const a = remap[T[t]], b = remap[T[t+1]], c = remap[T[t+2]]; if (a !== b && b !== c && a !== c) tris.push(a, b, c); }
  return { V: new Float64Array(out), T: new Uint32Array(tris) };
}
export function topology({ V, T }) {
  const und = new Map(), dir = new Map(); let badDir = 0;
  for (let t = 0; t < T.length; t += 3) for (let e = 0; e < 3; e++) {
    const a = T[t+e], b = T[t+(e+1)%3]; const k = a < b ? a*4294967296 + b : b*4294967296 + a;
    und.set(k, (und.get(k) || 0) + 1);
    const dk = a*4294967296 + b; if (dir.has(dk)) badDir++; dir.set(dk, 1);
  }
  let boundary = 0, nonManifold = 0; for (const c of und.values()) { if (c === 1) boundary++; else if (c > 2) nonManifold++; }
  const nV = new Set(T).size, E = und.size, F = T.length / 3; const chi = nV - E + F;
  let vol = 0; for (let t = 0; t < T.length; t += 3) { const a = 3*T[t], b = 3*T[t+1], c = 3*T[t+2];
    vol += (V[a]*(V[b+1]*V[c+2]-V[b+2]*V[c+1]) - V[a+1]*(V[b]*V[c+2]-V[b+2]*V[c]) + V[a+2]*(V[b]*V[c+1]-V[b+1]*V[c])) / 6; }
  return { verts: nV, tris: F, boundaryEdges: boundary, nonManifoldEdges: nonManifold, flippedEdges: badDir, genus: (2 - chi) / 2, volume: vol, watertight: boundary === 0 && nonManifold === 0 && badDir === 0 };
}
// ---- triangle-triangle intersection (segment through triangle), grid accelerated ----
function sub(a,b){return [a[0]-b[0],a[1]-b[1],a[2]-b[2]];} function cross(a,b){return [a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]];} function dot(a,b){return a[0]*b[0]+a[1]*b[1]+a[2]*b[2];}
function segTri(o, e, t, eps) { // strict crossing of segment o->e through the interior of triangle t
  const d = sub(e, o), e1 = sub(t[1], t[0]), e2 = sub(t[2], t[0]); const h = cross(d, e2); const det = dot(e1, h);
  if (Math.abs(det) < 1e-12) return false; const f = 1 / det; const s = sub(o, t[0]); const u = f * dot(s, h); if (u < eps || u > 1 - eps) return false;
  const q = cross(s, e1); const v = f * dot(d, q); if (v < eps || u + v > 1 - eps) return false; const tt = f * dot(e2, q); return tt > eps && tt < 1 - eps;
}
function triTri(p, q) {
  const eps = 1e-6;
  for (let i = 0; i < 3; i++) { if (segTri(p[i], p[(i+1)%3], q, eps)) return true; if (segTri(q[i], q[(i+1)%3], p, eps)) return true; }
  return false;
}
export function selfIntersections({ V, T }, cell = 1.0, limit = 50) {
  const grid = new Map(); const nT = T.length / 3; const P = i => [V[3*i], V[3*i+1], V[3*i+2]];
  const LO = new Int32Array(nT * 3);
  for (let t = 0; t < nT; t++) {
    const a=P(T[3*t]),b=P(T[3*t+1]),c=P(T[3*t+2]);
    const lo=[0,1,2].map(k=>Math.floor(Math.min(a[k],b[k],c[k])/cell)), hi=[0,1,2].map(k=>Math.floor(Math.max(a[k],b[k],c[k])/cell));
    LO[3*t]=lo[0]; LO[3*t+1]=lo[1]; LO[3*t+2]=lo[2];
    for(let x=lo[0];x<=hi[0];x++)for(let y=lo[1];y<=hi[1];y++)for(let z=lo[2];z<=hi[2];z++){const k=x+','+y+','+z; let l=grid.get(k); if(!l)grid.set(k,l={c:[x,y,z],t:[]}); l.t.push(t);}
  }
  let hits = 0; const samples = [];
  for (const { c, t: l } of grid.values()) for (let i = 0; i < l.length; i++) for (let j = i+1; j < l.length; j++) {
    const s = l[i], t = l[j];
    // test each pair once: in the lowest cell both triangles share
    if (Math.max(LO[3*s],LO[3*t]) !== c[0] || Math.max(LO[3*s+1],LO[3*t+1]) !== c[1] || Math.max(LO[3*s+2],LO[3*t+2]) !== c[2]) continue;
    const A=[T[3*s],T[3*s+1],T[3*s+2]], B=[T[3*t],T[3*t+1],T[3*t+2]]; if (A.some(x=>B.includes(x))) continue;
    if (triTri(A.map(P), B.map(P))) { hits++; if (samples.length < 5) samples.push({A:A.map(P),B:B.map(P)}); if (hits >= limit) return { hits, samples, capped: true }; }
  }
  return { hits, samples };
}
