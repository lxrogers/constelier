const {chromium}=require('@playwright/test'),path=require('node:path'),fs=require('node:fs');
const base=process.env.RING_URL||'http://localhost:3008/prototypes/rings',out=process.env.RING_EVIDENCE||'/workspace/ring-evidence/ring-gallery';
fs.mkdirSync(out,{recursive:true});
(async()=>{const browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH||'/usr/bin/chromium',headless:true,args:['--no-sandbox','--use-angle=swiftshader','--enable-unsafe-swiftshader']});try{
const page=await browser.newPage({viewport:{width:1440,height:1150}});await page.goto(base,{waitUntil:'domcontentloaded'});
const {RING_FAMILIES}=await import('../../modules/rings/families.mjs');
for(const family of Object.values(RING_FAMILIES)){await page.locator(`[data-family-id="${family.id}"]`).click();
for(const preset of family.presets){await page.getByRole('button',{name:new RegExp(preset.name)}).click();await page.waitForFunction(({family,params})=>{
 const e=document.querySelector('[data-mesh-params]');return e?.dataset.meshFamily===family&&e?.dataset.quality==='settled'&&document.querySelector('.ring-details summary')?.textContent.includes('Mesh checked')&&JSON.stringify(JSON.parse(e.dataset.meshParams))===JSON.stringify(params);
},{family:family.id,params:family.normalize(preset.params).params},{timeout:30000});await page.getByRole('button',{name:'Gold',exact:true}).click();await page.getByRole('button',{name:'Perspective',exact:true}).click();await page.waitForFunction(()=>window.__ringStudio?.diagnostics().hdrLoaded);await page.evaluate(()=>new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r))));await page.evaluate(()=>scrollTo(0,0));
await page.screenshot({path:path.join(out,`${family.id}-${preset.id}-studio.png`),fullPage:true});await page.locator('.ring-canvas canvas').screenshot({path:path.join(out,`${family.id}-${preset.id}.png`)});
}}
console.log(JSON.stringify({presets:Object.values(RING_FAMILIES).reduce((n,f)=>n+f.presets.length,0),destination:out}));
}finally{await browser.close();}})().catch(e=>{console.error(e);process.exitCode=1});
