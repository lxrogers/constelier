// Run only against the isolated copy created by prepare-family-fixture.py.
const {chromium}=require('@playwright/test');
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const base=process.env.RING_URL||'http://localhost:3010/prototypes/rings';
const destination=process.env.RING_EVIDENCE||'/workspace/ring-evidence/family-fixture';
fs.mkdirSync(destination,{recursive:true});
const report={url:base,fixture:'Test-only adapter of wave geometry; not a new ring generator.',errors:[],screenshots:[]};
(async()=>{
 const browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH||'/usr/bin/chromium',headless:true,args:['--no-sandbox','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
 try {
 const context=await browser.newContext({viewport:{width:1440,height:1050},acceptDownloads:true});const page=await context.newPage();
 page.on('pageerror',e=>report.errors.push(e.message));page.on('console',m=>{if(m.type()==='error')report.errors.push(m.text());});
 await page.addInitScript(()=>{
  const s=window.__families={jobs:[],replies:[],commits:[],hold:false,held:[],failNext:false,active:0,peak:0,workers:[]};
  document.addEventListener('ring-mesh-rendered',event=>s.commits.push({...event.detail,selectedFamily:document.querySelector('main[data-selected-family]')?.dataset.selectedFamily,selectedScope:Number(document.querySelector('main[data-selected-family]')?.dataset.selectedScope)}));
  const NativeWorker=window.Worker;
  window.Worker=class extends EventTarget {
   constructor(...args){super();this.native=new NativeWorker(...args);this.closed=false;this.onmessage=null;this.onerror=null;s.workers.push(this);
    this.native.onmessage=event=>{
     let data=event.data;if(s.failNext&&data.quality!=='export'){data={...data,error:'Injected shape rejection'};s.failNext=false;}
     const deliver=()=>{if(this.closed)return;if(data.quality!=='export')s.active--;s.replies.push({id:data.id,family:data.family,selection:data.selection,quality:data.quality,at:performance.now(),error:data.error});const e=new MessageEvent('message',{data});this.onmessage?.(e);this.dispatchEvent(e);};
     if(s.hold&&data.quality!=='export')s.held.push(deliver);else deliver();
    };
    this.native.onerror=e=>{this.onerror?.(e);};
   }
   postMessage(data,...rest){s.jobs.push({...data,params:{...data.params},at:performance.now()});if(data.quality!=='export'){s.active++;s.peak=Math.max(s.peak,s.active);}this.native.postMessage(data,...rest);}
   terminate(){this.closed=true;this.native.terminate();}
  };
  s.release=()=>{s.hold=false;const held=s.held.splice(0);for(const deliver of held)deliver();};
 });
 async function settled(family){await page.waitForFunction(family=>{
  const host=document.querySelector('[data-mesh-family]'),main=document.querySelector('main[data-selected-family]');
  if(main?.dataset.selectedFamily!==family||host?.dataset.meshFamily!==family||host?.dataset.quality!=='settled'||host?.dataset.selection!==main?.dataset.selectedScope)return false;
  const params=JSON.parse(host.dataset.meshParams||'{}');return [...document.querySelectorAll('input[type=range]')].every(el=>Math.abs(params[el.id.replace('ring-','')]-Number(el.value))<1e-5);
 },family,{timeout:30000});await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));}
 async function select(family){await page.locator(`[data-family-id="${family}"]`).click();}
 async function setWidth(value){await page.locator('#ring-width').evaluate((el,value)=>{Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set.call(el,String(value));el.dispatchEvent(new Event('input',{bubbles:true}));},value);await page.evaluate(()=>new Promise(r=>requestAnimationFrame(r)));}
 async function shot(name){const file=path.join(destination,name+'.png');await page.screenshot({path:file,fullPage:true,timeout:60000});report.screenshots.push(file);}
 await page.goto(base,{waitUntil:'domcontentloaded'});await settled('wave');await page.waitForFunction(()=>window.__ringStudio?.diagnostics().hdrLoaded);
 assert.equal(await page.locator('[data-family-id="liquid-accent"]').count(),1);assert.equal(await page.locator('[data-family-id="faceted"]').count(),1);
 assert.equal(await page.locator('[data-family-id="fixture"]').count(),1,'Fixture must only be registered in the isolated test copy.');
 const camera=await page.evaluate(()=>window.__ringStudio.diagnostics().camera);
 await setWidth(6.4);await settled('wave');await select('fixture');await settled('fixture');
 assert.equal(await page.locator('#ring-width').inputValue(),'1.6');assert.equal(await page.getByRole('slider').count(),6);assert.equal(await page.locator('.ring-presets button').count(),2);assert.deepEqual(await page.evaluate(()=>window.__ringStudio.diagnostics().camera),camera);
 await page.getByRole('button',{name:/Fixture Swell/}).click();await settled('fixture');assert.equal(await page.locator('#ring-width').inputValue(),'5.3');
 await page.getByRole('button',{name:'Reset',exact:true}).click();await settled('fixture');assert.equal(await page.locator('#ring-width').inputValue(),'1.6');
 await shot('fixture-family-gold');report.switchResetPresets=true;
 await page.getByRole('button',{name:'Copy design link'}).click();const link=page.url();assert.equal(JSON.parse(decodeURIComponent(new URL(link).hash.slice(6))).family,'fixture');
 await page.reload();await settled('fixture');assert.equal(await page.locator('#ring-width').inputValue(),'1.6');
 await page.locator('.ring-details summary').click();
 const jsonPromise=page.waitForEvent('download');await page.getByRole('button',{name:'Save parameters · JSON'}).click();const jsonDownload=await jsonPromise;
 const jsonPath=path.join(destination,'fixture-parameters.json');await jsonDownload.saveAs(jsonPath);assert.equal(JSON.parse(fs.readFileSync(jsonPath,'utf8')).family,'fixture');assert.equal(jsonDownload.suggestedFilename(),'constelier-fixture.json');
 report.serialization={family:'fixture',reload:true,json:true};
 // Hold one real worker completion, then switch A -> B -> A. No old A can draw.
 await page.evaluate(()=>{window.__families.hold=true;});await setWidth(3.7);
 await page.waitForFunction(()=>window.__families.held.length>0);
 const oldScope=Number(await page.locator('main[data-selected-family]').getAttribute('data-selected-scope'));
 await select('wave');await select('fixture');
 assert.equal(await page.locator('[data-mesh-family]').getAttribute('data-mesh-family'),'');
 assert.equal(await page.evaluate(()=>window.__ringStudio.diagnostics().meshVisible),false);
 await page.evaluate(()=>window.__families.release());await settled('fixture');
 assert.equal(await page.locator('#ring-width').inputValue(),'1.6');assert(Number(await page.locator('[data-selection]').getAttribute('data-selection'))>oldScope);
 report.rapidSwitchBack=true;
 // Obsolete shape errors cannot poison the newly selected family.
 await page.evaluate(()=>{window.__families.hold=true;window.__families.failNext=true;});await setWidth(3.8);await page.waitForFunction(()=>window.__families.held.length>0);await select('wave');await page.evaluate(()=>window.__families.release());await settled('wave');
 assert(!await page.locator('.ring-notice').innerText());report.obsoleteErrorIgnored=true;
 // Reject every quality for one current input, retain valid mesh, then recover.
 await page.evaluate(()=>{window.__families.hold=true;window.__families.failNext=true;});await setWidth(3.4);await page.waitForFunction(()=>window.__families.held.length>0);await page.evaluate(()=>window.__families.release());
 await page.waitForFunction(()=>document.querySelector('.ring-notice')?.textContent.includes('Injected shape rejection'));
 await setWidth(3.5);await settled('wave');assert(!await page.locator('.ring-notice').innerText());report.currentErrorRecovery=true;
 // Export fixture parameters; change family while the detailed worker runs.
 await select('fixture');await settled('fixture');await setWidth(3.2);
 const captured={...JSON.parse(decodeURIComponent(new URL(link).hash.slice(6))).params,width:3.2};
 const exportPromise=page.waitForEvent('download',{timeout:30000});await page.getByRole('button',{name:'Export ring'}).click();await select('wave');await settled('wave');
 const download=await exportPromise;assert.equal(download.suggestedFilename(),'constelier-fixture-mm.stl');
 const stlPath=path.join(destination,'fixture-captured-mm.stl');await download.saveAs(stlPath);
 const {buildWave}=await import('../../modules/rings/wave.mjs'),{meshToSTL}=await import('../../modules/rings/stl.mjs');
 assert.equal(Buffer.compare(fs.readFileSync(stlPath),Buffer.from(meshToSTL(buildWave(captured,'export')))),0);
 report.exportSnapshot={family:'fixture',params:captured,selectedAfterExport:'wave',byteIdentical:true};
 // Sustained cross-family selection under real work; bounded active preview count.
 const before=await page.evaluate(()=>window.__ringStudio.diagnostics());
 await page.evaluate(async()=>{for(let i=0;i<40;i++){document.querySelector(`[data-family-id="${i%2?'wave':'fixture'}"]`).click();await new Promise(r=>setTimeout(r,25));}});await settled('wave');
 const after=await page.evaluate(()=>window.__ringStudio.diagnostics());assert.equal(after.geometries,before.geometries);assert.equal(after.textures,before.textures);
 const evidence=await page.evaluate(()=>({jobs:window.__families.jobs,replies:window.__families.replies,commits:window.__families.commits,peak:window.__families.peak}));
 assert.equal(evidence.peak,1);for(const commit of evidence.commits){assert.equal(commit.family,commit.selectedFamily);assert.equal(commit.selection,commit.selectedScope);}
 report.switchStress={switches:40,gpuBefore:before,gpuAfter:after,...evidence};
 // Unregistered design hashes never display another family under that identity.
 await page.evaluate(()=>{location.hash='ring='+encodeURIComponent(JSON.stringify({version:1,family:'unavailable-test-family',params:{}}));});
 await page.waitForFunction(()=>document.querySelector('.ring-notice')?.textContent.includes('could not be read'));assert.equal(await page.locator('main[data-selected-family]').getAttribute('data-selected-family'),'wave');report.unavailableLinkRejected=true;
 await page.setViewportSize({width:390,height:844});await page.waitForTimeout(200);assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));await shot('fixture-selector-mobile');
 assert.deepEqual(report.errors,[]);report.passed=true;console.log(JSON.stringify({passed:true,commits:evidence.commits.length,peakActive:evidence.peak,exportSnapshot:true,rapidSwitchBack:true},null,2));
 }catch(error){report.failure=error.stack;throw error;}finally{fs.writeFileSync(path.join(destination,'families.json'),JSON.stringify(report,null,2));await browser.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});
