import json,urllib.request,struct,collections,time,os
from pathlib import Path
out=Path(os.environ.get("PROTOTYPE_ARTIFACTS", "/tmp/sun-arcs-checks"));out.mkdir(parents=True,exist_ok=True)
base=os.environ.get('PROTOTYPE_URL', 'http://localhost:3000')+'/api/prototypes/sun-arcs'
cases={'low':dict(groups=1,rings=1,rays=6,stroke=.3,spacing=2,depth=.6),'default':{},'high':dict(groups=5,rings=5,rays=32,stroke=.8,spacing=3.5,depth=2.4),'waves':dict(groups=5,rings=4,rays=24,spacing=2.2),'repeat':{}}
for name,p in cases.items():
 t=time.time(); data=urllib.request.urlopen(urllib.request.Request(base,json.dumps(p).encode(),{'Content-Type':'application/json'}),timeout=180).read();open(out/(name+'.json'),'wb').write(data);m=json.loads(data);print(name,len(m['triangles'])//3,round(time.time()-t,2),flush=True)
 p['export']='stl'; b=urllib.request.urlopen(urllib.request.Request(base,json.dumps(p).encode(),{'Content-Type':'application/json'}),timeout=180).read();open(out/(name+'.stl'),'wb').write(b)
 n=struct.unpack_from('<I',b,80)[0];assert len(b)==84+50*n
 edges=collections.Counter();adj=collections.defaultdict(set)
 for i in range(n):
  v=struct.unpack_from('<12f',b,84+50*i)[3:];vs=[tuple(round(x,4) for x in v[j:j+3]) for j in (0,3,6)]
  for a,c in zip(vs,vs[1:]+vs[:1]):edges[tuple(sorted((a,c)))]+=1;adj[a].add(c);adj[c].add(a)
 seen=set();components=0
 for v in adj:
  if v in seen:continue
  components+=1;stack=[v]
  while stack:
   a=stack.pop()
   if a in seen:continue
   seen.add(a);stack.extend(adj[a]-seen)
 print('STL',name,'triangles',n,'nonmanifold edges',sum(v!=2 for v in edges.values()),'components',components,flush=True)

 assert components == 1 and all(v == 2 for v in edges.values()), name
