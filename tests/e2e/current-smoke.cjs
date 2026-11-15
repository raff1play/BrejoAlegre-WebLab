/** Current integrated browser baseline (not the archived CORE-014 fixtures).
 * Runs the real Vite page in headless Chromium with ambient traffic enabled.
 * Neither rendering on SwiftShader nor scripted touches prove real Android FPS.
 */
const assert = require('node:assert/strict');
const {spawn} = require('node:child_process');
const {setTimeout:delay} = require('node:timers/promises');
const {chromium} = require('playwright');
const port = 4179;
const url=process.env.WEBLAB_URL || `http://127.0.0.1:${port}/`;
let server=null, browser=null;
const notes=[],errors=[];
function check(label,ok){ assert.ok(ok,label);notes.push(label);console.log('PASS',label); }
async function waitReady(){
 for(let i=0;i<180;i++){
  if(server&&server.exitCode!==null)throw Error(`Vite exited with code ${server.exitCode}`);
  try{const r=await fetch(url,{signal:AbortSignal.timeout(1500)});if(r.ok)return;}catch{}
  await delay(700);
 }
 throw Error('Vite did not start within deadline');
}
async function run(){
 if(!process.env.WEBLAB_URL){
  server=spawn(process.platform==='win32'?'npm.cmd':'npm',['run','dev','--','--host','127.0.0.1','--port',String(port),'--strictPort'],{stdio:'ignore'});
  await waitReady();
 }
 browser=await chromium.launch({headless:true,args:['--no-sandbox','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
 const context=await browser.newContext({viewport:{width:915,height:412},isMobile:true,hasTouch:true,deviceScaleFactor:1});
 const page=await context.newPage();
 page.on('pageerror',e=>errors.push(e.message));
 await page.goto(url+'?gfx=mobile&trafego=1&dia=0',{waitUntil:'domcontentloaded',timeout:120000});
 await page.waitForFunction(()=>!!window.__weblab?.snapshot?.().delivery?.logistics,{timeout:120000});
 const snapshot=()=>page.evaluate(()=>window.__weblab.snapshot());
 let s=await snapshot();
 check('single-player mobile landscape starts at or after 11:45',s.clock.hour>=11.75&&s.clock.hour<13);
 check('three physical NPC couriers and eight functioning stores',s.delivery.logistics.couriers.length===3&&s.delivery.stores.length===8);
 check('one player, four sectors and 10 depot workers',s.delivery.depot.workers.length===10&&Object.keys(s.delivery.logistics.assignments).length===4);
 check('parcels have unique IDs from a single inventory',s.delivery.parcels.length>=21&&s.delivery.parcels.length===new Set(s.delivery.parcels.map(p=>p.id)).size);
 check('landscape control and minimap elements exist',await page.locator('#movement-stick').count()===1&&await page.locator('#minimap').count()===1&&await page.locator('[data-control="accelerate"]').count()===1);
 await page.locator('#minimap').tap();
 s=await snapshot();check('touch expands minimap',s.minimap.expanded);
 await page.locator('#minimap').tap();
 await page.locator('.pause-button').tap();
 s=await snapshot();check('touch opens pause and logistics panel',s.paused&&await page.locator('#logistics-panel').isVisible());
 const panel=await page.locator('#logistics-panel').innerText();
 check('logistics panel lists three named employees',panel.includes('Rosa')&&panel.includes('Caio')&&panel.includes('Davi'));
 await page.locator('#pause [data-action="pause"]').tap();
 await page.waitForFunction(()=>window.__weblab.snapshot().clock.hour>=11+47/60 && window.__weblab.snapshot().delivery.logistics.couriers.some(c=>c.state!=='waiting'),{timeout:65000});
 s=await snapshot();
 check('NPCs begin their routes by 11:47 simulated',s.delivery.logistics.couriers.some(c=>c.state!=='waiting'));
 check('ambient traffic simulator has vehicles',s.city.vehicles>0);
 check('no fatal JavaScript errors',errors.length===0);
 console.log('Browser smoke completed:',notes.length,'checks; Chromium emulated mobile/SwiftShader, NOT physical Android.');
}
run().catch(e=>{console.error('FAIL',e,errors);process.exitCode=1;}).finally(async()=>{if(browser)await browser.close();if(server)server.kill('SIGTERM');});
