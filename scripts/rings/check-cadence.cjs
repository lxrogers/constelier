const {chromium}=require('@playwright/test');const fs=require('node:fs');const path=require('node:path');const assert=require('node:assert/strict');
const base=process.env.RING_URL||'http://localhost:3002/prototypes/rings';const destination=process.env.RING_EVIDENCE||'/workspace/ring-evidence/cadence';const baseline=process.env.RING_BASELINE==='1';
const family=process.env.RING_FAMILY||'wave';
const control=process.env.RING_CONTROL||(family==='faceted'?'softness':'radial');const finalValue=Number(process.env.RING_FINAL_VALUE||(control==='softness'?'0.65':'1.35'));
const report={url:base,family,control,finalValue,baseline,started:new Date().toISOString(),runs:[],errors:[],externalFailures:[]};fs.mkdirSync(destination,{recursive:true});
const median=a=>{a=[...a].sort((x,y)=>x-y);return a[Math.floor(a.length/2)]??null;};
(async()=>{const browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH||'/usr/bin/chromium',headless:true,proxy:process.env.RING_PROXY?{server:process.env.RING_PROXY}:undefined,args:['--no-sandbox','--use-angle=swiftshader','--enable-unsafe-swiftshader']});try{
const context=await browser.newContext({viewport:{width:1100,height:850}});
if(process.env.VERCEL_OIDC_TOKEN)await context.route('**/*',async route=>{const request=route.request();if(new URL(request.url()).origin===new URL(base).origin){const headers={...request.headers(),'x-vercel-trusted-oidc-idp-token':process.env.VERCEL_OIDC_TOKEN};try{if(process.env.RING_TRUSTED_FETCH)await route.fulfill({response:await route.fetch({headers,maxRedirects:0})});else await route.continue({headers});}catch{report.errors.push('Authenticated request failed');await route.abort();}}else await route.continue();});
const page=await context.newPage();page.on('pageerror',e=>report.errors.push(e.message));page.on('console',m=>{if(m.type()==='error'){if(m.location().url==='https://vercel.live/_next-live/feedback/feedback.js')report.externalFailures.push(m.text());else report.errors.push(m.text());}});
await page.addInitScript(()=>{
 window.__cadence={workerJobs:[],workerReplies:[],commits:[],delayMs:0};
 document.addEventListener('ring-mesh-rendered',event=>window.__cadence.commits.push(event.detail));
 const NativeWorker=window.Worker;
 window.Worker=class extends EventTarget {
  constructor(...args){super();this.native=new NativeWorker(...args);this.onmessage=null;this.onerror=null;this.closed=false;this.timers=new Set();this.sent=new Map();
   this.native.onmessage=event=>{const sent=this.sent.get(event.data.id);const deliver=()=>{if(this.closed)return;window.__cadence.workerReplies.push({id:event.data.id,quality:event.data.quality,at:performance.now(),sentAt:sent?.at,totalMs:event.data.timing?.totalMs,error:event.data.error});const message=new MessageEvent('message',{data:event.data});this.onmessage?.(message);this.dispatchEvent(message);};
    const remaining=Math.max(0,(sent?.at||performance.now())+window.__cadence.delayMs-performance.now());
    if(remaining){const timer=setTimeout(()=>{this.timers.delete(timer);deliver();},remaining);this.timers.add(timer);}else deliver();};
   this.native.onerror=event=>{this.onerror?.(event);this.dispatchEvent(new ErrorEvent('error',{message:event.message}));};
  }
  postMessage(data,...rest){const item={id:data.id,quality:data.quality,params:data.params,at:performance.now()};this.sent.set(data.id,item);window.__cadence.workerJobs.push(item);this.native.postMessage(data,...rest);}
  terminate(){this.closed=true;for(const timer of this.timers)clearTimeout(timer);this.native.terminate();}
 };
});
await page.goto(base,{waitUntil:'domcontentloaded'});if(family!=='wave')await page.locator(`[data-family-id="${family}"]`).click();if(process.env.RING_PRESET)await page.getByRole('button',{name:new RegExp(process.env.RING_PRESET)}).click();await page.waitForFunction(()=>document.querySelector('[data-quality]')?.getAttribute('data-quality')==='settled');await page.waitForFunction(()=>window.__ringStudio?.diagnostics().hdrLoaded);
const preset=process.env.RING_PRESET;
const defaultValue=await page.evaluate(control=>JSON.parse(document.querySelector('[data-mesh-params]').getAttribute('data-mesh-params'))[control],control);
// Fixed small canvas makes software rendering less likely to throttle the input
// timer. Actual observed input intervals are recorded; requested Hz is not FPS.
await page.addStyleTag({content:'.ring-canvas{width:400px!important;height:300px!important;min-height:300px!important;max-height:300px!important;flex:0 0 auto!important}'});
await page.waitForTimeout(300);
for(const delayMs of [0,32])for(const hz of [60,120]){
 await page.getByRole('button',preset?{name:new RegExp(preset)}:{name:'Reset',exact:true}).click();await page.waitForFunction(({control,defaultValue})=>document.querySelector('[data-quality]')?.getAttribute('data-quality')==='settled'&&JSON.parse(document.querySelector('[data-mesh-params]').getAttribute('data-mesh-params'))[control]===defaultValue,{control,defaultValue});await page.waitForTimeout(150);
 const run=await page.evaluate(async({hz,delayMs,control,finalValue})=>{
  const s=window.__cadence;s.workerJobs=[];s.workerReplies=[];s.commits=[];s.delayMs=delayMs;const inputs=[];
  const el=document.getElementById('ring-'+control),set=Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set;
  const start=performance.now(),duration=5000,period=1000/hz;let sequence=0;
  const update=value=>{const at=performance.now();set.call(el,String(value));el.dispatchEvent(new Event('input',{bubbles:true}));el.dispatchEvent(new Event('change',{bubbles:true}));inputs.push({at,value});};
  await new Promise(resolve=>{let due=start;const tick=()=>{const now=performance.now();if(now-start>=duration){resolve();return;}update(Number((Number(el.min)+(sequence++%39+1)/40*(Number(el.max)-Number(el.min))).toFixed(4)));due+=period;setTimeout(tick,Math.max(0,due-performance.now()));};tick();});
  const motionEnd=performance.now();update(finalValue);return{hz,delayMs,start,motionEnd,inputs,diagnostics:window.__ringStudio.diagnostics()};
 },{hz,delayMs,control,finalValue});
 await page.waitForFunction(({control,finalValue})=>document.querySelector('[data-quality]')?.getAttribute('data-quality')==='settled'&&JSON.parse(document.querySelector('[data-mesh-params]').getAttribute('data-mesh-params'))[control]===finalValue,{control,finalValue});await page.waitForTimeout(100);
 Object.assign(run,await page.evaluate(()=>({jobs:window.__cadence.workerJobs,replies:window.__cadence.workerReplies,commits:window.__cadence.commits,final:window.__ringStudio.diagnostics()})));
 run.inDragCommits=run.commits.filter(x=>x.renderedAt>=run.start&&x.renderedAt<run.motionEnd);run.inDragReplies=run.replies.filter(x=>x.at>=run.start&&x.at<run.motionEnd);
 const intervals=run.inputs.slice(1,-1).map((x,i)=>x.at-run.inputs[i].at);run.actualInputHz=(run.inputs.length-1)*1000/(run.motionEnd-run.start);run.medianInputIntervalMs=median(intervals);run.maxInputIntervalMs=Math.max(...intervals);run.commitGapsMs=run.inDragCommits.slice(1).map((x,i)=>x.renderedAt-run.inDragCommits[i].renderedAt);run.maxCommitGapMs=Math.max(0,...run.commitGapsMs);run.medianWorkerMs=median(run.inDragReplies.map(x=>x.totalMs));
 for(let i=1;i<run.commits.length;i++)assert(run.commits[i].requestId>run.commits[i-1].requestId,'displayed request IDs must strictly increase');assert.equal(run.commits.at(-1).params[control],finalValue);
 if(!baseline){assert(run.inDragCommits.length>=40,`starvation: ${hz}Hz/${delayMs}ms: ${run.inDragCommits.length} in-drag commits`);assert(run.maxCommitGapMs<750,'no long motion freeze');}
 report.runs.push(run);console.log(JSON.stringify({hz,delayMs,actualInputHz:run.actualInputHz,medianInputIntervalMs:run.medianInputIntervalMs,medianWorkerMs:run.medianWorkerMs,inDragReplies:run.inDragReplies.length,inDragCommits:run.inDragCommits.length,maxCommitGapMs:run.maxCommitGapMs,finalValue:run.commits.at(-1).params[control]}));
}
assert.deepEqual(report.errors,[]);report.passed=true;
}finally{fs.writeFileSync(path.join(destination,'cadence.json'),JSON.stringify(report,null,2));await browser.close();}})().catch(e=>{console.error(e.message);process.exitCode=1});
