const { chromium } = require('@playwright/test');
const fs = require('node:fs');
const crypto = require('node:crypto');
const assert = require('node:assert/strict');
const path = require('node:path');
const destination = process.env.RING_EVIDENCE || '/workspace/ring-evidence';
const base = process.env.RING_URL || 'http://localhost:3000/prototypes/rings';
const labels = ['Inside diameter','Band width','Radial thickness','Section shape','Wave count','Axial wave','Radial variation'];
const keys = ['innerDiameter','width','thickness','section','waves','amplitude','radial'];
fs.mkdirSync(destination,{recursive:true});
const report = {url:base,started:new Date().toISOString(),errors:[],externalFailures:[],sliders:[],screenshots:[],performance:{}};
(async()=>{
 const browser = await chromium.launch({executablePath:process.env.CHROMIUM_PATH || '/usr/bin/chromium',headless:true,proxy:process.env.RING_PROXY?{server:process.env.RING_PROXY}:undefined,args:['--no-sandbox','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
 try {
 const context = await browser.newContext({viewport:{width:1440,height:1000},acceptDownloads:true});
 // Optional short-lived same-project OIDC header, scoped to the exact origin.
 if(process.env.VERCEL_OIDC_TOKEN) await context.route('**/*', async route=>{
   const request=route.request();
   if(new URL(request.url()).origin===new URL(base).origin) {
     const headers={...request.headers(),'x-vercel-trusted-oidc-idp-token':process.env.VERCEL_OIDC_TOKEN};
     // The cloud proxy CA is trusted by Node's request stack. Chromium's
     // separate CA store may lack it. Fetch through that verified TLS stack,
     // keeping the real deployment origin and never relaxing certificate checks.
     try { if(process.env.RING_TRUSTED_FETCH) await route.fulfill({response:await route.fetch({headers,maxRedirects:0})}); else await route.continue({headers}); }
     catch { report.errors.push('Authenticated preview request failed.'); await route.abort(); }
   } else await route.continue();
 });
 const page=await context.newPage();
 page.on('pageerror',e=>report.errors.push(e.message));
 page.on('console',m=>{if(m.type()==='error') {
   // Vercel injects its optional feedback toolbar on previews. This cloud's
   // destination policy blocks vercel.live; keep that failure explicit and
   // separate from application failures. No app assets use that hostname.
   if(m.location().url==='https://vercel.live/_next-live/feedback/feedback.js') report.externalFailures.push({url:m.location().url,message:m.text()});
   else report.errors.push(m.text());
 }});
 await page.addInitScript(()=>{window.__longTasks=[];new PerformanceObserver(list=>{for(const e of list.getEntries())window.__longTasks.push({start:e.startTime,duration:e.duration});}).observe({entryTypes:['longtask']});});
 await page.goto(base,{waitUntil:'domcontentloaded'});
 async function settled(){await page.waitForFunction(()=>{
   const host=document.querySelector('[data-quality]');if(host?.getAttribute('data-quality')!=='settled')return false;
   const mesh=JSON.parse(host.getAttribute('data-mesh-params')||'{}');
   return [...document.querySelectorAll('input[type=range]')].every(el=>Math.abs(mesh[el.id.replace('ring-','')]-Number(el.value))<0.00001);
 },{timeout:30000});await page.evaluate(()=>new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r))));}
 await settled(); await page.waitForFunction(()=>window.__ringStudio?.diagnostics().hdrLoaded,{timeout:30000});
 const canvas=page.locator('.ring-canvas canvas');
 const hash=async()=>crypto.createHash('sha256').update(await canvas.screenshot({timeout:60000})).digest('hex');
 async function shot(name,full=true){const file=path.join(destination,name+'.png');await (full?page:canvas).screenshot({path:file,fullPage:full||undefined,timeout:60000});report.screenshots.push(file);}
 report.initial=await page.evaluate(()=>window.__ringStudio.diagnostics());
 await shot('tide-gold');
 const cameraBefore=report.initial.camera;
 for(let i=0;i<labels.length;i++){
   const input=page.getByRole('slider',{name:labels[i],exact:true});const box=await input.boundingBox();
   const old=await input.inputValue(), before=await hash();
   await page.mouse.move(box.x+box.width*.35,box.y+box.height/2);await page.mouse.down();
   await page.mouse.move(box.x+box.width*.78,box.y+box.height/2,{steps:12});await page.mouse.up();
   await settled();
   const value=await input.inputValue(), after=await hash();assert.notEqual(value,old);assert.notEqual(before,after);
   const mesh=JSON.parse(await page.locator('[data-mesh-params]').getAttribute('data-mesh-params'));
   assert.equal(mesh[keys[i]],Number(value));report.sliders.push({label:labels[i],old,value,meshChanged:true});
   assert.deepEqual(await page.evaluate(()=>window.__ringStudio.diagnostics().camera),cameraBefore);
 }
 await page.getByRole('button',{name:'Reset',exact:true}).click();await settled();
 assert.equal(await page.getByRole('slider',{name:'Band width',exact:true}).inputValue(),'4.3');
 for(const name of ['Ribbon','Swell','Tide']){
   await page.getByRole('button',{name:new RegExp(name)}).click();await settled();await shot(name.toLowerCase()+'-gold');
 }
 await page.getByRole('button',{name:'Clay',exact:true}).click();await shot('tide-clay');
 await page.getByRole('button',{name:'Top',exact:true}).click();await shot('tide-clay-top');
 await page.getByRole('button',{name:'Front',exact:true}).click();await shot('tide-clay-profile');
 await page.getByRole('button',{name:'Perspective',exact:true}).click();
 await page.mouse.move(560,530);await page.mouse.wheel(0,-350);await shot('tide-clay-close');
 await page.getByRole('button',{name:'Gold',exact:true}).click();await shot('tide-gold-close');
 await page.getByRole('button',{name:'Perspective',exact:true}).click();
 const beforeOrbit=await hash();const cb=await canvas.boundingBox();await page.mouse.move(cb.x+cb.width*.5,cb.y+cb.height*.5);await page.mouse.down();await page.mouse.move(cb.x+cb.width*.65,cb.y+cb.height*.6,{steps:12});await page.mouse.up();assert.notEqual(beforeOrbit,await hash());report.orbit=true;
 await page.getByRole('button',{name:'Perspective',exact:true}).click();
 // Worst supported combination via real keyboard input on the sliders.
 for(const label of labels){const el=page.getByRole('slider',{name:label,exact:true});await el.focus();await page.keyboard.press(label==='Inside diameter'?'Home':'End');}
 await settled();await shot('maximum-gold');report.maximum={params:JSON.parse(await page.locator('[data-mesh-params]').getAttribute('data-mesh-params')),triangles:Number(await page.locator('[data-triangles]').getAttribute('data-triangles'))};
 assert(report.maximum.params.amplitude<=0.75*7/6);
 await page.getByRole('button',{name:'Clay',exact:true}).click();await shot('maximum-clay');
 await page.getByRole('button',{name:'Reset',exact:true}).click();await settled();
 // Sustained real drags; collect renderer allocation counts and JS heap after GC.
 const cdp=await context.newCDPSession(page);await cdp.send('Performance.enable');
 await cdp.send('HeapProfiler.collectGarbage');
 report.performance.before=await cdp.send('Performance.getMetrics');
 report.performance.gpuBefore=await page.evaluate(()=>window.__ringStudio.diagnostics());
 const start=Date.now();const input=page.getByRole('slider',{name:'Axial wave',exact:true});const ib=await input.boundingBox();
 await page.mouse.move(ib.x+ib.width*.1,ib.y+ib.height/2);await page.mouse.down();
 for(let j=0;j<24;j++)await page.mouse.move(ib.x+ib.width*(j%2?.18:.82),ib.y+ib.height/2,{steps:8});
 await page.mouse.up();await settled();
 report.performance.realDragMs=Date.now()-start;report.performance.realDragMoves=192;
 // Faster-than-human input burst confirms final convergence under coalescing.
 await page.evaluate(async()=>{const el=document.getElementById('ring-radial'),set=Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set;for(let batch=0;batch<15;batch++){for(let j=0;j<40;j++){set.call(el,String(((batch*40+j)%40)*.05));el.dispatchEvent(new Event('input',{bubbles:true}));el.dispatchEvent(new Event('change',{bubbles:true}));}await new Promise(r=>setTimeout(r,20));}set.call(el,'1.35');el.dispatchEvent(new Event('input',{bubbles:true}));el.dispatchEvent(new Event('change',{bubbles:true}));});
 await settled();assert.equal(JSON.parse(await page.locator('[data-mesh-params]').getAttribute('data-mesh-params')).radial,1.35);
 await cdp.send('HeapProfiler.collectGarbage');report.performance.after=await cdp.send('Performance.getMetrics');report.performance.gpuAfter=await page.evaluate(()=>window.__ringStudio.diagnostics());
 assert.equal(report.performance.gpuAfter.geometries,report.performance.gpuBefore.geometries);assert.equal(report.performance.gpuAfter.textures,report.performance.gpuBefore.textures);
 report.performance.longTasks=await page.evaluate(()=>window.__longTasks);
 const idle=await page.evaluate(()=>window.__ringStudio.diagnostics().renderCount);await page.waitForTimeout(1100);assert.equal(await page.evaluate(()=>window.__ringStudio.diagnostics().renderCount),idle);report.performance.idleRendering=false;
 await page.getByRole('button',{name:'Reset',exact:true}).click();await settled();
 const [download]=await Promise.all([page.waitForEvent('download',{timeout:30000}),page.getByRole('button',{name:'Export ring'}).click()]);const stlPath=path.join(destination,'browser-wave-mm.stl');await download.saveAs(stlPath);const bytes=fs.readFileSync(stlPath);const count=bytes.readUInt32LE(80);assert.equal(bytes.length,84+count*50);report.export={path:stlPath,triangles:count,bytes:bytes.length};
 const {buildWave,WAVE_DEFAULTS}=await import('../../modules/rings/wave.mjs');const {meshToSTL}=await import('../../modules/rings/stl.mjs');
 assert.equal(Buffer.compare(bytes,Buffer.from(meshToSTL(buildWave(WAVE_DEFAULTS,'export')))),0);
 // Start export while a newer preview is still pending, then change presets.
 // The downloaded shape must remain the parameters captured at the click.
 await page.evaluate(()=>{const el=document.getElementById('ring-width');Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set.call(el,'3.2');el.dispatchEvent(new Event('input',{bubbles:true}));});
 await page.evaluate(()=>new Promise(r=>requestAnimationFrame(r)));
 const exportParams=await page.locator('input[type=range]').evaluateAll(els=>Object.fromEntries(els.map(el=>[el.id.replace('ring-',''),Number(el.value)])));
 const snapshotDownload=page.waitForEvent('download',{timeout:30000});await page.getByRole('button',{name:'Export ring'}).click();
 await page.getByRole('button',{name:/Ribbon/}).click();await settled();
 const captured=await snapshotDownload;const snapshotPath=path.join(destination,'browser-snapshot-mm.stl');await captured.saveAs(snapshotPath);
 assert.equal(Buffer.compare(fs.readFileSync(snapshotPath),Buffer.from(meshToSTL(buildWave(exportParams,'export')))),0);
 assert.equal(JSON.parse(await page.locator('[data-mesh-params]').getAttribute('data-mesh-params')).width,1.6);
 report.exportSnapshot={params:exportParams,path:snapshotPath,byteIdentical:true,presetChangedDuringExport:true};
 await page.getByRole('button',{name:'Reset',exact:true}).click();await settled();
 await page.getByRole('button',{name:'Copy design link'}).click();const saved=page.url();assert(saved.includes('#ring='));await page.reload();await settled();assert.equal(await page.getByRole('slider',{name:'Band width',exact:true}).inputValue(),'4.3');report.serializedLink=true;
 await page.setViewportSize({width:390,height:844});await page.waitForTimeout(200);await shot('mobile-gold');assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));const mobileCanvas=await canvas.boundingBox();assert(mobileCanvas.width<390&&mobileCanvas.width>300);report.mobile={canvas:mobileCanvas,overflow:false};
 await page.setViewportSize({width:1440,height:1000});await settled();
 assert.deepEqual(report.errors,[]);report.passed=true;
 console.log(JSON.stringify({passed:true,sliders:report.sliders.length,export:report.export,performance:{realDragMs:report.performance.realDragMs,gpuBefore:report.performance.gpuBefore,gpuAfter:report.performance.gpuAfter},screenshots:report.screenshots.length},null,2));
 }catch(e){report.failure=e.stack;throw e;}finally{fs.writeFileSync(path.join(destination,'browser.json'),JSON.stringify(report,null,2));await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1});
