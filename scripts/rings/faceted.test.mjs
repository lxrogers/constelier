import test, { after } from 'node:test';
import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { buildFaceted, normalizeFaceted, facetedResolution, serializeFaceted, parseFaceted, FACETED_CONTROLS, FACETED_PRESETS, FACETED_DEFAULTS, FACETED_MAX_TRIANGLES, FACETED_FAMILY } from '../../modules/rings/faceted.mjs';
import { validateMesh } from '../../modules/rings/validate.mjs';
import { sampleWallThickness } from '../../modules/rings/wall.mjs';
import { meshToSTL } from '../../modules/rings/stl.mjs';

const destination = process.env.FACETED_EVIDENCE || '/workspace/faceted-evidence';
const evidence = { version: 1, node: process.version, seed: '0x510e527f', cases: [], benchmarks: [], stress: null,
  limitations: ['Published shared validator excludes incident face pairs. An independent radial-sector/orientation invariant is checked here; the integration owner must also run the newer validator.', '256 normal chords per mesh are a diagnostic, not continuous minimum wall or casting certification.', 'No Library reference pixels could be materialized on this executor.'] };
const started = performance.now();
after(async () => {
  evidence.elapsedMs = performance.now() - started;
  evidence.summary = { meshes: evidence.cases.length, minBoreMarginMm: Math.min(...evidence.cases.map(c => c.boreMarginMm)),
    minSampledWallMm: Math.min(...evidence.cases.map(c => c.wallMm)), maxTriangles: Math.max(...evidence.cases.map(c => c.triangles)),
    missedRays: evidence.cases.reduce((n,c) => n+c.missedRays,0), backfacingHits: evidence.cases.reduce((n,c) => n+c.backfacingHits,0),
    intersections: evidence.cases.reduce((n,c) => n+c.intersections,0), maxGenerationMs: Math.max(...evidence.cases.map(c => c.generationMs)) };
  await mkdir(destination, { recursive: true });
  await writeFile(`${destination}/geometry.json`, JSON.stringify(evidence, null, 2) + '\n');
});

// Independent projection invariant, including incident faces skipped by the
// base SAT check: each horizontal row winds once with positive angular steps,
// and every triangle has a strict radial (or cap axial) orientation throughout
// its interior. Test all three vertices: the radial dot product is affine on a
// planar triangle. This also catches folding between sheared sampling rails.
function assertRadialGraph(mesh) {
  const { positions: p, indices, resolution: { loops, sections } } = mesh;
  const point = i => Array.from(p.subarray(i*3,i*3+3));
  for (let i=0;i<loops;i++) for(let j=0;j<sections;j++) {
    const a=point(i*sections+j), b=point(((i+1)%loops)*sections+j);
    const step=Math.atan2(a[0]*b[2]-a[2]*b[0],a[0]*b[0]+a[2]*b[2]);
    assert.ok(step>0 && Math.abs(step-2*Math.PI/loops)<2e-7,'angular row folded or lost its periodic ordering');
    assert.equal(a[1],p[j*3+1],'section Y changed across the ring');
  }
  for(let i=0;i<indices.length;i+=3) {
    const ids=Array.from(indices.subarray(i,i+3)), [a,b,c]=ids.map(point);
    const u=b.map((x,k)=>x-a[k]),v=c.map((x,k)=>x-a[k]);
    const n=[u[1]*v[2]-u[2]*v[1],u[2]*v[0]-u[0]*v[2],u[0]*v[1]-u[1]*v[0]];
    const strip=Math.floor(i/6)%sections, next=(strip+1)%sections;
    const dy=p[next*3+1]-p[strip*3+1];
    if(dy!==0) {
      for(const q of [a,b,c]) assert.ok((n[0]*q[0]+n[2]*q[2])*dy>0,'local radial foldover');
    } else {
      const r0=Math.hypot(p[strip*3],p[strip*3+2]),r1=Math.hypot(p[next*3],p[next*3+2]);
      assert.ok(n[1]*(r0-r1)>0,'local cap foldover');
    }
  }
}
function assess(name,input,quality='settled') {
  const start=performance.now(),m=buildFaceted(input,quality);
  const v=validateMesh(m,{minInnerRadius:m.params.innerDiameter/2});
  const validationMs=performance.now()-start-m.generationMs;
  assert.equal(v.valid,true,`${name}/${quality}: ${v.errors.join('; ')}`);
  assert.equal(v.components,1);assert.equal(v.boundaryEdges+v.nonmanifoldEdges+v.windingErrors+v.degenerateTriangles+v.unusedVertices,0);
  assert.equal(v.intersectionPairs,0);assert.equal(v.intersectionsCapped,false);
  assertRadialGraph(m);
  const w=sampleWallThickness(m,{samples:256});
  const record={name,quality,params:m.params,triangles:v.triangleCount,vertices:v.vertexCount,generationMs:m.generationMs,validationMs,wallMs:w.elapsedMs,
    boreMarginMm:v.minInnerRadius-m.params.innerDiameter/2,wallMm:w.sampledMinWallMm,missedRays:w.missedRays,backfacingHits:w.backfacingHits,intersections:v.intersectionPairs};
  evidence.cases.push(record);
  assert.equal(w.missedRays,0,`${name}: missing ray`);assert.equal(w.backfacingHits,0,`${name}: backfacing ray`);
  assert.ok(w.sampledMinWallMm>=0.8,`${name}/${quality}: wall ${w.sampledMinWallMm}`);
  assert.ok(record.boreMarginMm>=0.00199,'triangle-interior clearance needs its numeric margin');
  assert.ok(m.indices.length/3<=({preview:6912,settled:23040,export:73728}[quality]));
  assert.ok(m.positions instanceof Float32Array && m.normals instanceof Float32Array && m.indices instanceof Uint32Array);
  assert.equal(m.units,'mm');assert.equal(m.family,'faceted');assert.deepEqual(m.resolution,facetedResolution(m.params,quality));
  assert.equal(m.positions.length/3,m.resolution.loops*m.resolution.sections);
  assert.equal(m.indices.length/3,2*m.positions.length/3);
  return m;
}

for(const preset of FACETED_PRESETS) for(const quality of ['preview','settled','export']) test(`${preset.id}/${quality}: closed, oriented, clearance, intersections and normal walls`,()=>{
  assert.deepEqual(normalizeFaceted(preset.params),{params:preset.params,adjustments:[]});
  const m=assess(preset.id,preset.params,quality);
  if(quality==='export') {
    const bytes=meshToSTL(m),view=new DataView(bytes),vertices=[],idx=[],weld=new Map();
    assert.equal(view.getUint32(80,true),m.indices.length/3);assert.equal(bytes.byteLength,84+50*m.indices.length/3);
    for(let face=0;face<m.indices.length/3;face++) for(let j=0;j<3;j++) {
      const at=84+50*face+12+12*j, p=[0,1,2].map(k=>view.getFloat32(at+k*4,true));
      assert.deepEqual(p,Array.from(m.positions.subarray(m.indices[face*3+j]*3,m.indices[face*3+j]*3+3)));
      const key=p.join(',');if(!weld.has(key)){weld.set(key,vertices.length/3);vertices.push(...p);}idx.push(weld.get(key));
    }
    const report=validateMesh({positions:new Float32Array(vertices),indices:new Uint32Array(idx)},{minInnerRadius:m.params.innerDiameter/2});
    assert.equal(report.valid,true,report.errors.join('; '));assert.equal(report.vertexCount,m.positions.length/3);
  }
});

const low=Object.fromEntries(FACETED_CONTROLS.map(c=>[c.key,c.min]));
const high=Object.fromEntries(FACETED_CONTROLS.map(c=>[c.key,c.max]));
const extrema=[['low',low],['high',high],['thin-wide-deep-hard',{...high,innerDiameter:14,thickness:1.5,segments:6,softness:0}],
  ['thin-small-deep-tilted',{...high,width:4,thickness:1.5,segments:6,faceRatio:.25,softness:0}],
  ['negative-tilt',{...high,tilt:-.8,softness:0}],['zero-relief',{...high,depth:0,softness:0}]];
for(const [name,p] of extrema) for(const q of ['preview','settled','export']) test(`${name}/${q}: regression for deep, thin, tilted and degenerate limits`,()=>assess(name,p,q));

test('all 256 corners of the supported eight-control box',()=>{
  for(let bits=0;bits<256;bits++) assess(`corner-${bits}`,Object.fromEntries(FACETED_CONTROLS.map((c,k)=>[c.key,bits&(1<<k)?c.max:c.min])));
});
test('100 deterministic random settled combinations',()=>{
  let seed=0x510e527f;const random=()=>((seed=(Math.imul(seed,1664525)+1013904223)>>>0)/2**32);
  for(let i=0;i<100;i++) assess(`random-${i}`,Object.fromEntries(FACETED_CONTROLS.map(c=>[c.key,c.min+(c.max-c.min)*random()])));
});

test('normalization, canonical serialization, finite limits and every sampling budget',()=>{
  assert.equal(FACETED_FAMILY.id,'faceted');assert.deepEqual(normalizeFaceted({}).params,FACETED_DEFAULTS);
  for(const c of FACETED_CONTROLS) for(const invalid of [NaN,Infinity,-Infinity,'1',true,{},[]]) assert.throws(()=>normalizeFaceted({[c.key]:invalid}),/finite number/);
  for(const input of [null,[],1,'bad'])assert.throws(()=>normalizeFaceted(input));
  for(const input of [low,high,{...high,tilt:-.8},Object.fromEntries(FACETED_CONTROLS.map(c=>[c.key,1e12]))]) {
    const n=normalizeFaceted(input);assert.deepEqual(normalizeFaceted(n.params),{params:n.params,adjustments:[]});
    assert.deepEqual(parseFaceted(serializeFaceted(input)),{params:n.params,adjustments:[]});
    for(const c of FACETED_CONTROLS){assert.ok(n.params[c.key]>=c.min&&n.params[c.key]<=c.max);assert.ok(Math.abs((n.params[c.key]-c.min)/c.step-Math.round((n.params[c.key]-c.min)/c.step))<1e-7);}
  }
  assert.throws(()=>buildFaceted({},'infinite'),/quality/);
  for(const bad of ['null','{}','[]','bad',' '.repeat(2049),null,'{"version":2,"family":"faceted","params":{}}','{"version":1,"family":"wave","params":{}}','{"version":1,"family":"faceted","params":[]}'])assert.throws(()=>parseFaceted(bad));
  for(let segments=6;segments<=36;segments++)for(const tilt of [0,.8,-.8])for(const q of ['preview','settled','export']){
    const r=facetedResolution({segments,tilt},q);assert.equal(r.loops%segments,0);assert.ok(2*r.loops*r.sections<=({preview:6912,settled:23040,export:FACETED_MAX_TRIANGLES}[q]));
  }
  const a=buildFaceted(FACETED_DEFAULTS),b=buildFaceted(FACETED_DEFAULTS);assert.deepEqual(a.positions,b.positions);assert.deepEqual(a.normals,b.normals);assert.deepEqual(a.indices,b.indices);
});

test('protected inside, real relief, explicit foldover and broken-seam fixtures',()=>{
  const flat=buildFaceted({...FACETED_DEFAULTS,depth:0}),rib=buildFaceted(FACETED_DEFAULTS);
  const {loops,sections}=rib.resolution;let changed=0,protectedCount=0;
  const minR=Math.min(...Array.from({length:sections},(_,j)=>Math.hypot(flat.positions[j*3],flat.positions[j*3+2])));
  for(let i=0;i<loops;i++)for(let j=0;j<sections;j++){
    const at=(i*sections+j)*3,r=Math.hypot(flat.positions[at],flat.positions[at+2]);
    if(r-minR<flat.params.thickness/2-1e-5){assert.deepEqual(Array.from(rib.positions.subarray(at,at+3)),Array.from(flat.positions.subarray(at,at+3)));protectedCount++;}
    if(flat.positions[at]!==rib.positions[at])changed++;
  }
  assert.ok(protectedCount>loops*2);assert.ok(changed>loops*2,'rib must change actual positions');
  const folded=buildFaceted(FACETED_DEFAULTS);folded.positions[sections*3+1]+=2;
  assert.throws(()=>assertRadialGraph(folded),/section Y|foldover/);
  const reversed=buildFaceted(FACETED_DEFAULTS);[reversed.indices[0],reversed.indices[1]]=[reversed.indices[1],reversed.indices[0]];
  assert.throws(()=>assertRadialGraph(reversed),/foldover/);
  const open={...rib,indices:rib.indices.slice(3)};assert.equal(validateMesh(open,{intersections:false}).valid,false);
  const inward=buildFaceted(FACETED_DEFAULTS);inward.positions[0]=0;inward.positions[2]=0;
  assert.equal(validateMesh(inward,{intersections:false,minInnerRadius:inward.params.innerDiameter/2}).valid,false);
});

test('Chisel has straight central rails, chord faces and no local shear fold',()=>{
  const p=FACETED_PRESETS.find(p=>p.id==='chisel').params,m=buildFaceted(p,'export');
  const {loops,sections}=m.resolution, rows=[];
  for(let j=0;j<sections;j++) {
    const x=m.positions[j*3],y=m.positions[j*3+1],z=m.positions[j*3+2];
    if(Math.abs(y)<p.width*.3 && Math.hypot(x,z)>p.innerDiameter/2+p.thickness-.01)rows.push({j,y,theta:Math.atan2(z,x)});
  }
  assert.ok(rows.length>=6);
  const first=rows[0],last=rows.at(-1),slope=(last.theta-first.theta)/(last.y-first.y);
  for(const r of rows)assert.ok(Math.abs(r.theta-first.theta-slope*(r.y-first.y))<2e-7,'central groove must not have an S curve');
  const perCell=loops/p.segments, row=rows[Math.floor(rows.length/2)].j;
  const points=[];for(let i=0;i<perCell;i++)if(i/perCell>.3&&i/perCell<.7){const at=(i*sections+row)*3;points.push([m.positions[at],m.positions[at+2]]);}
  assert.ok(points.length>8);
  const a=points[0],b=points.at(-1),length=Math.hypot(b[0]-a[0],b[1]-a[1]);
  for(const q of points)assert.ok(Math.abs((q[0]-a[0])*(b[1]-a[1])-(q[1]-a[1])*(b[0]-a[0]))/length<2e-6,'broad face must be a geometric chord, not a domed rib');
  const bad=buildFaceted(p),j=1,c=Math.cos(2),s=Math.sin(2);
  for(let i=0;i<bad.resolution.loops;i++){const at=(i*bad.resolution.sections+j)*3,x=bad.positions[at],z=bad.positions[at+2];bad.positions[at]=c*x-s*z;bad.positions[at+2]=s*x+c*z;}
  assert.throws(()=>assertRadialGraph(bad),/fold/);
});

test('median typical/worst generation + worker-equivalent checks; 1000-preview bounded retention',()=>{
  for(const [name,p] of [['typical',FACETED_DEFAULTS],['tilted',FACETED_PRESETS[2].params],['worst',{...high,tilt:0}],['worst-tilted',high]])for(const quality of ['preview','settled','export']){
    const rows=[];for(let i=0;i<5;i++){
      const start=performance.now(),m=buildFaceted(p,quality),v=validateMesh(m,{intersections:quality!=='preview',minInnerRadius:m.params.innerDiameter/2});assert.equal(v.valid,true);
      if(quality!=='preview'){const w=sampleWallThickness(m);assert.ok(w.sampledMinWallMm>=.8&&w.missedRays===0&&w.backfacingHits===0);}
      rows.push({generationMs:m.generationMs,totalMs:performance.now()-start,triangles:m.indices.length/3});
    }
    const median=k=>rows.map(r=>r[k]).sort((a,b)=>a-b)[2];evidence.benchmarks.push({name,quality,generationMs:median('generationMs'),totalMs:median('totalMs'),triangles:rows[0].triangles});
  }
  for(let i=0;i<30;i++)buildFaceted(FACETED_DEFAULTS,'preview');
  const snapshots=[],times=[];const sample=i=>{global.gc?.();global.gc?.();const m=process.memoryUsage();snapshots.push({iteration:i,heapUsed:m.heapUsed,arrayBuffers:m.arrayBuffers,rss:m.rss});};sample(0);
  for(let i=0;i<1000;i++){
    const start=performance.now();let m=buildFaceted({...FACETED_PRESETS[i%3].params,segments:6+i%31,tilt:i%2?.8:0},'preview');times.push(performance.now()-start);assert.ok(m.indices.length/3<=6912);m=null;if((i+1)%100===0)sample(i+1);
  }
  times.sort((a,b)=>a-b);evidence.stress={iterations:1000,medianMs:times[500],p95Ms:times[950],maxMs:times[999],gcAvailable:typeof global.gc==='function',snapshots};
  if(global.gc){assert.ok(snapshots.at(-1).arrayBuffers-snapshots[0].arrayBuffers<2*1024*1024);assert.ok(snapshots.at(-1).heapUsed-snapshots[0].heapUsed<16*1024*1024);}
});
