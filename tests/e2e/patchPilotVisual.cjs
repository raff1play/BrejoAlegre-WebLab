/* Visual-only inspection: navigate actual game camera near Patch GLB actors.
 * Runs on Vite development server so __scene/__debug are available.
 * These screenshots are evidence only, not proof of device FPS.
 */
const fs = require('node:fs');
const path = require('node:path');
const { chromium } = require('playwright');
(async () => {
  const browser = await chromium.launch({headless:true,args:['--use-gl=angle','--use-angle=swiftshader','--enable-webgl']});
  const page = await browser.newPage({viewport:{width:1280,height:720},deviceScaleFactor:1});
  const errors=[];
  page.on('pageerror', e=>errors.push(e.message));
  const out=path.join(__dirname,'../../docs/evidence');fs.mkdirSync(out,{recursive:true});
  try {
    await page.goto('http://127.0.0.1:5173/?gfx=desktop&assets=patch&devtime=1&hora=12',{waitUntil:'load',timeout:60000});
    await page.waitForFunction(()=>window.__weblab?.snapshot()?.city?.patch?.pedestrian==='ready' && window.__weblab?.snapshot()?.city?.patch?.bus==='ready',null,{timeout:75000});
    await page.waitForTimeout(1200);
    const get=(name)=>page.evaluate(name=>{const n=window.__scene.getTransformNodeByName(name);return n?{x:n.position.x,y:n.position.y,z:n.position.z,enabled:n.isEnabled()}:null},name);
    const bus=await get('patch-onibus-0');const ped=await get('patch-transeunte-animada');
    console.log('PATCH_VISUAL_ACTORS',JSON.stringify({bus,ped}));
    if(!bus||!ped)throw Error('Patch model root nodes not found in live scene');
    await page.evaluate(loc=>{window.__debug.teleport(loc.x-8,loc.z-8,Math.PI/2);window.__debug.camera(-Math.PI/4,1.24,12);},bus);
    await page.waitForTimeout(3600);
    await page.screenshot({path:path.join(out,'patch-pilot-bus-detail.jpg'),type:'jpeg',quality:86});
    // Foot view near the current character. The full game simulation remains active.
    const near=await get('patch-transeunte-animada');
    await page.evaluate(loc=>{window.__debug.placeWalker(loc.x-3,loc.z-3,0);window.__debug.camera(-Math.PI/4,1.18,6);},near);
    await page.waitForTimeout(2600);
    await page.screenshot({path:path.join(out,'patch-pilot-pedestrian-detail.jpg'),type:'jpeg',quality:86});
    console.log('PATCH_VISUAL_CAPTURE_OK',JSON.stringify({errors,bus,near}));
    if(errors.length) throw Error(errors.join(' | '));
  }finally{await browser.close()}
})().catch(e=>{console.error(e);process.exitCode=1});
