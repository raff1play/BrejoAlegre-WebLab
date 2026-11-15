/** Current integrated browser baseline (not the archived CORE-014 fixtures).
 * Runs the real Vite page in headless Chromium with ambient traffic enabled.
 * Neither rendering on SwiftShader nor scripted touches prove real Android FPS.
 * HUD-001/CTRL-001/MAP-001: adaptive HUD (base/riding/walking) at 915×412 and 780×360, floating
 * stick with real multi-touch (CDP touch points), heading-up minimap, speed zoom, turn guidance
 * and rerouting. Teleports use the development-only __debug fixture: they are NOT a human ride.
 */
const assert = require('node:assert/strict');
const {spawn} = require('node:child_process');
const {setTimeout:delay} = require('node:timers/promises');
const {chromium} = require('playwright');
const port = 4179;
const url=process.env.WEBLAB_URL || `http://127.0.0.1:${port}/`;
let server=null, browser=null;
const notes=[],errors=[];
function check(label,ok,detail){ assert.ok(ok,detail?`${label} — ${JSON.stringify(detail)}`:label);notes.push(label);console.log('PASS',label); }
async function waitReady(){
 for(let i=0;i<180;i++){
  if(server&&server.exitCode!==null)throw Error(`Vite exited with code ${server.exitCode}`);
  try{const r=await fetch(url,{signal:AbortSignal.timeout(1500)});if(r.ok)return;}catch{}
  await delay(700);
 }
 throw Error('Vite did not start within deadline');
}
/** Bounding boxes of the HUD pieces that must never overlap, plus the toast. */
function layout(){
 const box=(sel)=>{const e=document.querySelector(sel);if(!e)return null;const s=getComputedStyle(e);if(s.display==='none'||s.visibility==='hidden')return null;const r=e.getBoundingClientRect();return r.width&&r.height?{sel,l:r.left,t:r.top,r:r.right,b:r.bottom}:null;};
 return {w:innerWidth,h:innerHeight,boxes:['.pause-button','.objective','.telemetry','#minimap','.pad-right','#movement-stick-base','.devtime'].map(box).filter(Boolean),
  toast:box('.toast.visible'),visible:Object.fromEntries(['#base-status','#objective-distance','#cargo-status','#team-progress','#parcel-progress','.telemetry .speed','#nav-turn'].map(s=>[s,!!box(s)]))};
}
function assertLayout(tag,L){
 const hit=(a,b)=>a.l<b.r-1&&b.l<a.r-1&&a.t<b.b-1&&b.t<a.b-1;
 const pairs=[];
 for(let i=0;i<L.boxes.length;i++)for(let j=i+1;j<L.boxes.length;j++)if(hit(L.boxes[i],L.boxes[j]))pairs.push([L.boxes[i],L.boxes[j]]);
 check(`${tag}: no two of ${L.boxes.length} HUD panels overlap`,pairs.length===0,pairs);
 // The road ahead of the bike (screen centre) stays free of HUD panels.
 const centre={l:L.w*.32,r:L.w*.68,t:L.h*.36,b:L.h*.74};
 check(`${tag}: centre of the screen free of HUD panels`,L.boxes.every(b=>!hit(b,centre)),L.boxes.filter(b=>hit(b,centre)));
 check(`${tag}: every HUD panel inside the screen`,L.boxes.every(b=>b.l>=-1&&b.t>=-1&&b.r<=L.w+1&&b.b<=L.h+1),L.boxes);
 if(L.toast)check(`${tag}: toast stays left of the centre`,L.toast.r<=L.w*.5,L.toast);
}
/**
 * B1-01 F2 (AC-03, AC-05): a career that chooses the old popular car. Driving uses real touch
 * (CDP touch points) and keyboard; teleports/camera use the development-only __debug fixture.
 */
async function carCareer(browser){
 const ctx=await browser.newContext({viewport:{width:915,height:412},isMobile:true,hasTouch:true,deviceScaleFactor:1});
 const page=await ctx.newPage();page.on('pageerror',e=>errors.push(e.message));
 await page.goto(url+'?gfx=mobile&trafego=1&dia=0',{waitUntil:'domcontentloaded',timeout:120000});
 await page.waitForSelector('#vehicle-choice:not([hidden])',{timeout:120000});
 await page.locator('[data-vehicle="carro-antigo"]').tap();
 await page.waitForFunction(()=>!!window.__weblab?.snapshot?.().delivery?.logistics,{timeout:120000});
 const snapshot=()=>page.evaluate(()=>window.__weblab.snapshot());
 await delay(600);
 let s=await snapshot();
 check('B1-01 F2 AC-03: car career owns a paid-off old car, fixed; no motorcycle is built',s.vehicle.kind==='carro-antigo'&&s.vehicle.owned?.kind==='carro-antigo'&&s.vehicle.owned.paidOff&&s.vehicle.owned.vehicleId==='veiculo-personagem-oeste'&&s.moto===null,s.vehicle);
 check('B1-01 F2 AC-05: the car starts inside a painted depot car bay, driver at the wheel',s.vehicle.bay!==null&&s.mode==='riding'&&s.vehicle.driven&&!s.vehicle.parked,s.vehicle);
 check('B1-01 F2 AC-05: car chase camera sits further back than the bike framing',s.camera.framing.radius>6.5&&s.camera.radius>6&&s.camera.target[1]-s.vehicle.y>1.05,{camera:s.camera});
 check('B1-01 F2: HUD names the car (button, map legend) and keeps the same controls',await page.locator('[data-action="mount"]').innerText()==='Sair do carro'&&await page.locator('#legend-vehicle').innerText()==='Seu carro'&&await page.locator('[data-control="accelerate"]').count()===1&&await page.locator('#movement-stick').count()===1);
 check('B1-01 F2: same three NPC couriers and depot run in the car career',s.delivery.logistics.couriers.length===3&&s.delivery.depot.workers.length===10);
 for(const [w,h] of [[915,412],[780,360]]){await page.setViewportSize({width:w,height:h});await delay(350);assertLayout(`car base ${w}×${h}`,await page.evaluate(layout));}
 await page.setViewportSize({width:915,height:412});await delay(300);
 const hasDebug=await page.evaluate(()=>!!window.__debug);
 if(!hasDebug){console.log('SKIP car driving fixtures: __debug only exists in development builds');await ctx.close();return;}
 // Car footprint corners in depot-local coordinates (front fence of the lot is at z = -92.42).
 const cornersLocal=()=>page.evaluate(()=>{const v=window.__weblab.snapshot().vehicle,hw=1.62/2,hl=3.85/2,c=Math.cos(v.yaw),n=Math.sin(v.yaw);
  return [[-hw,-hl],[hw,-hl],[hw,hl],[-hw,hl]].map(([r,f])=>window.__debug.depotLocal(v.x+r*c+f*n,v.z-r*n+f*c));});

 // ------------------------------------------------ collision: full throttle into the lot's front fence
 const x0=s.vehicle.x,z0=s.vehicle.z;
 await page.keyboard.down('KeyW');
 let clear=true,maxZ=-1e9,maxSpeed=0;const t0=Date.now();
 // SwiftShader simulates slowly: sample until the car has moved and been stopped by the fence.
 while(Date.now()-t0<60000){await delay(250);const r=await page.evaluate(()=>({c:window.__debug.vehicleClear(),v:window.__weblab.snapshot().vehicle}));clear=clear&&r.c;maxSpeed=Math.max(maxSpeed,r.v.speed);maxZ=Math.max(maxZ,...(await cornersLocal()).map(p=>p.z));
  if(maxSpeed>1&&Math.abs(r.v.speed)<0.05&&Math.hypot(r.v.x-x0,r.v.z-z0)>1.5){await delay(1500);break;}}
 await page.keyboard.up('KeyW');
 s=await snapshot();
 check('B1-01 F2 AC-05: keyboard throttle drives the car forward',Math.hypot(s.vehicle.x-x0,s.vehicle.z-z0)>1.5&&maxSpeed>1,{moved:Math.hypot(s.vehicle.x-x0,s.vehicle.z-z0),maxSpeed});
 check('B1-01 F2 AC-05: car colliders stop it at the fence, never clipping (body clear every sample)',clear&&maxZ<=-92.42+0.06&&Math.abs(s.vehicle.speed)<0.5,{clear,maxZ,speed:s.vehicle.speed});
 // ------------------------------------------------ reverse out (brake pedal held after stopping)
 await page.keyboard.down('KeyS');
 await page.waitForFunction(()=>window.__weblab.snapshot().vehicle.speed<-0.3,null,{timeout:20000}).catch(()=>{});
 s=await snapshot();await page.keyboard.up('KeyS');
 check('B1-01 F2 AC-05: brake pedal reverses the car away from the wall',s.vehicle.speed<-0.3,s.vehicle);
 await page.keyboard.down('Space');await page.waitForFunction(()=>Math.abs(window.__weblab.snapshot().vehicle.speed)<0.3,null,{timeout:20000}).catch(()=>{});await page.keyboard.up('Space');

 // ------------------------------------------------ touch: floating stick steers, pedal button accelerates
 const probe=await page.evaluate(()=>window.__debug.probe());
 const J=probe.junction;
 await page.evaluate(j=>window.__debug.teleport(j.startX,j.startZ,j.yaw),J);
 await page.waitForFunction(()=>window.__weblab.snapshot().hud.context==='riding',null,{timeout:10000}).catch(()=>{});
 await delay(300);
 for(const [w,h] of [[915,412],[780,360]]){await page.setViewportSize({width:w,height:h});await delay(350);assertLayout(`car riding ${w}×${h}`,await page.evaluate(layout));}
 await page.setViewportSize({width:915,height:412});await delay(300);
 s=await snapshot();
 check('B1-01 F2 AC-05: driving the car on the street uses the riding HUD with speed',s.hud.context==='riding'&&s.mode==='riding'&&await page.locator('.telemetry .speed').isVisible(),s.hud);
 const cdp=await ctx.newCDPSession(page);
 const touch=(type,pts)=>cdp.send('Input.dispatchTouchEvent',{type,touchPoints:pts.map(p=>({x:p.x,y:p.y,id:p.id,radiusX:4,radiusY:4,force:1}))});
 const acc=await page.locator('[data-control="accelerate"]').boundingBox();
 const B={id:2,x:acc.x+acc.width/2,y:acc.y+acc.height/2},A0={id:1,x:190,y:300};
 await touch('touchStart',[A0]);
 await page.waitForFunction(()=>window.__weblab.snapshot().hud.stick.engaged,null,{timeout:10000}).catch(()=>{});
 const R=(await snapshot()).hud.stick.radius;
 const A1={...A0,x:A0.x+R*0.5};
 await touch('touchMove',[A1]);
 await page.waitForFunction(()=>window.__weblab.snapshot().hud.steer>0.2,null,{timeout:10000}).catch(()=>{});
 s=await snapshot();
 check('B1-01 F2: half a stick radius asks for a clear right turn of the steering wheel',s.hud.steer>0.2&&s.hud.steer<1,s.hud);
 const yaw0=s.vehicle.yaw;
 await touch('touchStart',[A1,B]);
 await page.waitForFunction(y=>{const v=window.__weblab.snapshot().vehicle;return v.yaw-y>0.05&&v.speed>0.5;},yaw0,{timeout:20000}).catch(()=>{});
 s=await snapshot();
 check('B1-01 F2 AC-05: two fingers — accelerator button + stick turn the car right (multi-touch)',s.hud.accelerate&&s.vehicle.speed>0.5&&s.vehicle.yaw-yaw0>0.05,{hud:s.hud,speed:s.vehicle.speed,yaw0,yaw:s.vehicle.yaw});
 await touch('touchEnd',[A1]);await page.evaluate(()=>new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r))));
 s=await snapshot();
 check('B1-01 F2: lifting the steering thumb returns to neutral while the pedal stays',!s.hud.stick.engaged&&s.hud.steer===0&&s.hud.accelerate,s.hud);
 await touch('touchEnd',[B]);await delay(80);
 const brake=await page.locator('[data-control="brake"]').boundingBox();
 const Bk={id:3,x:brake.x+brake.width/2,y:brake.y+brake.height/2};
 await touch('touchStart',[Bk]);
 await page.waitForFunction(()=>Math.abs(window.__weblab.snapshot().vehicle.speed)<0.3,null,{timeout:20000}).catch(()=>{});
 s=await snapshot();await touch('touchEnd',[Bk]);await delay(100);
 check('B1-01 F2 AC-05: the touch brake button stops the car',Math.abs(s.vehicle.speed)<0.3&&s.vehicle.stopped,s.vehicle);
 check('B1-01 F2 AC-05: car body still clear of the static world after touch driving',await page.evaluate(()=>window.__debug.vehicleClear()));

 // ------------------------------------------------ get out (touch on the action button), solid body, get back in
 const action=page.locator('[data-action="mount"]');
 check('B1-01 F2: stopped car offers "Sair do carro"',await action.innerText()==='Sair do carro'&&!(await action.getAttribute('class')).includes('unavailable'));
 await action.tap();
 await page.waitForFunction(()=>window.__weblab.snapshot().mode==='walking',null,{timeout:10000}).catch(()=>{});
 s=await snapshot();
 const local=(v,p)=>{const dx=p.x-v.x,dz=p.z-v.z,c=Math.cos(v.yaw),n=Math.sin(v.yaw);return {right:dx*c-dz*n,forward:dx*n+dz*c};};
 const outside=(v,p,r)=>{const l=local(v,p),dx=Math.max(0,Math.abs(l.right)-0.81),dz=Math.max(0,Math.abs(l.forward)-1.925);return Math.hypot(dx,dz)>=r-1e-6;};
 check('B1-01 F2 AC-05: driver gets out on the left, beside the car, and the car is parked (handbrake)',s.mode==='walking'&&s.vehicle.parked&&!s.vehicle.driven&&local(s.vehicle,s.walker).right<-0.81&&outside(s.vehicle,s.walker,0.3),{vehicle:s.vehicle,walker:s.walker});
 check('B1-01 F2: on foot next to the car the button offers "Entrar no carro"',await action.innerText()==='Entrar no carro');
 // Walk straight at the car body for a few seconds: the parked car is solid.
 const theta=Math.atan2(s.vehicle.x-s.walker.x,s.vehicle.z-s.walker.z);
 await page.evaluate(a=>window.__debug.camera(a,1.2,4),-theta-Math.PI/2);await delay(200);
 const parkedAt={x:s.vehicle.x,z:s.vehicle.z,yaw:s.vehicle.yaw};
 await page.keyboard.down('KeyW');
 let solid=true;const t1=Date.now();
 while(Date.now()-t1<3500){await delay(200);const q=await snapshot();solid=solid&&outside(q.vehicle,q.walker,0.29);}
 await page.keyboard.up('KeyW');
 s=await snapshot();
 check('B1-01 F2 AC-05: walking into the parked car never enters its body; the car does not move',solid&&Math.hypot(s.vehicle.x-parkedAt.x,s.vehicle.z-parkedAt.z)<1e-6&&s.vehicle.yaw===parkedAt.yaw,{walker:s.walker,vehicle:s.vehicle});
 await page.evaluate(()=>{const v=window.__weblab.snapshot().vehicle,c=Math.cos(v.yaw),n=Math.sin(v.yaw);window.__debug.placeWalker(v.x-1.31*c+.05*n,v.z+1.31*n+.05*c,v.yaw);});
 await delay(250);
 await action.tap();
 await page.waitForFunction(()=>window.__weblab.snapshot().mode==='riding',null,{timeout:10000}).catch(()=>{});
 s=await snapshot();
 check('B1-01 F2 AC-05: getting back in by the driver door releases the handbrake',s.mode==='riding'&&s.vehicle.driven&&!s.vehicle.parked,s.vehicle);
 // Too far from any door: no entry.
 await page.evaluate(()=>window.__debug.act());await page.waitForFunction(()=>window.__weblab.snapshot().mode==='walking',null,{timeout:10000}).catch(()=>{});
 await page.evaluate(()=>{const v=window.__weblab.snapshot().vehicle,c=Math.cos(v.yaw),n=Math.sin(v.yaw);window.__debug.placeWalker(v.x+5.5*n,v.z+5.5*c,v.yaw);});
 await delay(250);
 await page.evaluate(()=>window.__debug.act());await delay(300);
 s=await snapshot();
 check('B1-01 F2 AC-05: no entry from far in front of the car (only at a door)',s.mode==='walking',{mode:s.mode});

 // ------------------------------------------------ parking in a depot bay
 const bays=await page.evaluate(()=>window.__debug.carBays());
 const b0=bays[0];
 await page.evaluate(()=>{const v=window.__weblab.snapshot().vehicle,c=Math.cos(v.yaw),n=Math.sin(v.yaw);window.__debug.placeWalker(v.x-1.31*c,v.z+1.31*n,v.yaw);});await delay(200);
 await page.evaluate(()=>window.__debug.act());await page.waitForFunction(()=>window.__weblab.snapshot().mode==='riding',null,{timeout:10000}).catch(()=>{});
 const fits=await page.evaluate(b=>window.__debug.fitsAt(b.x,b.z,b.yaw),b0);
 await page.evaluate(b=>window.__debug.parkAt(b.x,b.z,b.yaw),b0);await delay(400);
 await page.evaluate(()=>window.__debug.act());
 await page.waitForFunction(()=>window.__weblab.snapshot().mode==='walking',null,{timeout:10000}).catch(()=>{});
 s=await snapshot();
 check('B1-01 F2 AC-05: car parked inside depot bay 1 is recognised (all four corners in the paint)',fits&&s.vehicle.parked&&s.vehicle.bay===0,{fits,vehicle:s.vehicle});

 // ------------------------------------------------ reload: the choice is permanent, no second dialog
 await page.reload({waitUntil:'domcontentloaded'});
 await page.waitForFunction(()=>!!window.__weblab?.snapshot?.().vehicle,{timeout:120000});
 s=await snapshot();
 check('B1-01 F2 AC-03: after reloading, the same car is loaded and the choice is not offered again',s.vehicle.kind==='carro-antigo'&&await page.locator('#vehicle-choice').isHidden()&&s.career.calendarIndex===0,{vehicle:s.vehicle,career:s.career});
 const saved=await page.evaluate(()=>({own:JSON.parse(localStorage.getItem('brejo-b1:carreira:personagem-oeste')).profile.vehicle,others:['norte','leste','sul'].map(k=>localStorage.getItem('brejo-b1:carreira:personagem-'+k))}));
 check('B1-01 F2 AC-03: only the active career save holds the vehicle; inactive careers untouched',saved.own.kind==='carro-antigo'&&saved.own.paidOff&&saved.others.every(v=>v===null),saved);
 await ctx.close();
}
async function run(){
 if(!process.env.WEBLAB_URL){
  // Own process group, so stopping it also stops Vite (killing npm alone leaves Vite running).
  server=spawn(process.platform==='win32'?'npm.cmd':'npm',['run','dev','--','--host','127.0.0.1','--port',String(port),'--strictPort'],{stdio:'ignore',detached:process.platform!=='win32'});
  await waitReady();
 }
 browser=await chromium.launch({headless:true,args:['--no-sandbox','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
 const context=await browser.newContext({viewport:{width:915,height:412},isMobile:true,hasTouch:true,deviceScaleFactor:1});
 const page=await context.newPage();
 page.on('pageerror',e=>errors.push(e.message));
 await page.goto(url+'?gfx=mobile&trafego=1&dia=0',{waitUntil:'domcontentloaded',timeout:120000});
 // B1-01 F2 (AC-03): a career without a vehicle chooses it once, by touch, before the world starts.
 await page.waitForSelector('#vehicle-choice:not([hidden])',{timeout:120000});
 check('B1-01 F2: vehicle choice offers the old motorcycle and the old popular car',await page.locator('#vehicle-choice [data-vehicle]').count()===2&&/permanente/.test(await page.locator('#vehicle-choice').innerText()));
 await page.locator('[data-vehicle="moto-antiga"]').tap();
 await page.waitForFunction(()=>!!window.__weblab?.snapshot?.().delivery?.logistics,{timeout:120000});
 const snapshot=()=>page.evaluate(()=>window.__weblab.snapshot());
 const sizes=[[915,412],[780,360]];
 let s=await snapshot();
 check('single-player mobile landscape starts at or after 11:45',s.clock.hour>=11.75&&s.clock.hour<13);
 check('HTML clock fallback and title are current (11:45, no street-experiment label)',await page.evaluate(()=>!document.querySelector('.street-experiment-label')&&!/experimento/i.test(document.title)));
 check('three physical NPC couriers and eight functioning stores',s.delivery.logistics.couriers.length===3&&s.delivery.stores.length===8);
 check('one player, four sectors and 10 depot workers',s.delivery.depot.workers.length===10&&Object.keys(s.delivery.logistics.assignments).length===4);
 check('B1-01 F1: active career Oeste, fixed home and legacy NPC roster',s.career?.id==='personagem-oeste'&&s.career.sector==='Oeste'&&s.career.home==='casa-oeste'&&s.career.roster.jogador==='personagem-oeste'&&s.career.roster.npc1==='personagem-norte'&&s.career.roster.npc2==='personagem-leste'&&s.career.roster.npc3==='personagem-sul',s.career);
 check('B1-01 F2: the motorcycle career owns a paid-off motorcycle and no car is built',s.vehicle.kind==='moto-antiga'&&s.vehicle.owned?.kind==='moto-antiga'&&s.vehicle.owned.paidOff&&s.vehicle.owned.owned&&s.moto!==null&&s.camera.framing.radius===5.6&&s.camera.framing.beta===1.27,{vehicle:s.vehicle,framing:s.camera.framing});
 check('parcels have unique IDs from a single inventory',s.delivery.parcels.length>=21&&s.delivery.parcels.length===new Set(s.delivery.parcels.map(p=>p.id)).size);
 check('landscape control and minimap elements exist',await page.locator('#movement-stick').count()===1&&await page.locator('#minimap').count()===1&&await page.locator('[data-control="accelerate"]').count()===1);

 // ---------------------------------------------------------------- HUD: base context
 await delay(400);
 s=await snapshot();
 check('HUD starts in the base context at the motorcycle bays',s.hud.context==='base',s.hud);
 for(const [w,h] of sizes){
  await page.setViewportSize({width:w,height:h});await delay(350);
  const L=await page.evaluate(layout);
  check(`base ${w}×${h}: receiving/sorting/schedule and team progress visible`,L.visible['#base-status']&&L.visible['#team-progress']&&L.visible['#parcel-progress'],L.visible);
  assertLayout(`base ${w}×${h}`,L);
 }
 const baseText=await page.locator('#base-status').innerText();
 check('base lines show receiving, sorting, own load and times',/Recebimento \d+ · Triagem \d+ · Sua carga D02 \d+\/\d+/.test(baseText)&&/Saca às 15h00/.test(baseText),baseText);
 check('mine vs team progress are distinct texts',/^Minha coleta \d+\/\d+$/.test(await page.locator('#parcel-progress').innerText())&&/^Equipe \d+\/\d+$/.test(await page.locator('#team-progress').innerText()));
 await page.setViewportSize({width:915,height:412});await delay(300);

 // ---------------------------------------------------------------- minimap tap, pause, logistics, calendar
 await page.locator('#minimap').tap();
 s=await snapshot();check('touch expands minimap',s.minimap.expanded);
 check('expanded map is north-up and keeps the OpenStreetMap credit',s.minimap.rotation===0&&!s.minimap.headingUp&&/OpenStreetMap/.test(await page.locator('.minimap-legend .credit').innerText()),s.minimap);
 check('expanded legend lists sectors and remaining stops',await page.locator('#legend-stops').count()===1&&await page.locator('.minimap-legend .sectors').count()===1);
 await page.locator('#minimap').tap();
 s=await snapshot();check('touch closes minimap and the stick was not engaged',!s.minimap.expanded&&!s.hud.stick.engaged);
 await page.locator('.pause-button').tap();
 s=await snapshot();check('touch opens pause and logistics panel',s.paused&&await page.locator('#logistics-panel').isVisible());
 const panel=await page.locator('#logistics-panel').innerText();
 check('logistics panel lists three named employees',panel.includes('Rosa')&&panel.includes('Caio')&&panel.includes('Davi'));
 check('weekly calendar is still in the pause screen',await page.locator('#game-calendar').count()===1&&await page.locator('.calendar-day').count()===7);
 await page.locator('#pause [data-action="pause"]').tap();
 await page.waitForFunction(()=>window.__weblab.snapshot().clock.hour>=11+47/60 && window.__weblab.snapshot().delivery.logistics.couriers.some(c=>c.state!=='waiting'),{timeout:65000});
 s=await snapshot();
 check('NPCs begin their routes by 11:47 simulated',s.delivery.logistics.couriers.some(c=>c.state!=='waiting'));
 check('ambient traffic simulator has vehicles',s.city.vehicles>0);

 const hasDebug=await page.evaluate(()=>!!window.__debug);
 if(!hasDebug){console.log('SKIP riding/walking fixtures: __debug only exists in development builds');}
 else{
  // ---------------------------------------------------------------- riding on a street
  const probe=await page.evaluate(()=>window.__debug.probe());
  const J=probe.junction;
  await page.evaluate(j=>window.__debug.teleport(j.startX,j.startZ,j.yaw),J);
  const contextIs=(c)=>page.waitForFunction(c=>window.__weblab.snapshot().hud.context===c,c,{timeout:10000}).catch(()=>{});
  await contextIs('riding');await delay(300);
  s=await snapshot();
  check('HUD switches to the riding context out on the street',s.mode==='riding'&&s.hud.context==='riding',s.hud);
  for(const [w,h] of sizes){
   await page.setViewportSize({width:w,height:h});await delay(350);
   const L=await page.evaluate(layout);
   check(`riding ${w}×${h}: speed shown, base lines and team chip hidden`,L.visible['.telemetry .speed']&&!L.visible['#base-status']&&!L.visible['#team-progress']&&!L.visible['#cargo-status'],L.visible);
   assertLayout(`riding ${w}×${h}`,L);
  }
  await page.setViewportSize({width:915,height:412});await delay(400);
  s=await snapshot();
  check('minimap heading-up while riding, rider below the centre',s.minimap.headingUp&&Math.abs(s.minimap.rotation-s.moto.yaw)<0.15&&s.minimap.arrow.y>0.55,s.minimap);
  check('route to the objective along the streets',s.minimap.route>1&&s.minimap.routeLength>0,s.minimap);
  const nav=await page.locator('#nav-turn');
  check('next-turn guidance shown with an arrow and a distance',await nav.isVisible()&&/^[↰↱↑] \d+(\.\d)? k?m$/.test(await nav.innerText()),{text:await nav.innerText(),nav:s.minimap.nav});
  const restRadius=s.minimap.radius;

  // ---------------------------------------------------------------- floating stick + multi-touch
  const cdp=await context.newCDPSession(page);
  /** One rendered frame later (the steer command is sampled per frame). */
  const nextFrame=()=>page.evaluate(()=>new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r))));
  /** pointermove is aligned to animation frames: wait for the stick state, not for a fixed time. */
  const stickWhen=(pred,arg)=>page.waitForFunction(([pred,arg])=>new Function('s','a','return '+pred)(window.__weblab.snapshot().hud,arg),[pred,arg],{timeout:10000}).catch(()=>{});
  const touch=(type,pts)=>cdp.send('Input.dispatchTouchEvent',{type,touchPoints:pts.map(p=>({x:p.x,y:p.y,id:p.id,radiusX:4,radiusY:4,force:1}))});
  const acc=await page.locator('[data-control="accelerate"]').boundingBox();
  const B={id:2,x:acc.x+acc.width/2,y:acc.y+acc.height/2};
  const A0={id:1,x:190,y:300};
  await touch('touchStart',[A0]);await stickWhen('s.stick.engaged');
  s=await snapshot();
  check('stick centre is placed where the thumb lands',s.hud.stick.engaged&&Math.abs(s.hud.stick.origin.x-A0.x)<1&&Math.abs(s.hud.stick.origin.y-A0.y)<1&&Math.abs(s.hud.stick.steerX)<0.01,s.hud.stick);
  const R=s.hud.stick.radius;
  const baseBox=await page.locator('#movement-stick-base').boundingBox();
  check('stick ring is drawn under the thumb',Math.abs(baseBox.x+baseBox.width/2-A0.x)<2&&Math.abs(baseBox.y+baseBox.height/2-A0.y)<2,baseBox);
  const A1={...A0,x:A0.x+R*0.3};
  await touch('touchMove',[A1]);await stickWhen('s.stick.steerX>0.25&&s.steer>0.2');
  s=await snapshot();
  check('a short thumb move (30 % of the radius) already steers right',s.hud.stick.steerX>0.25&&s.hud.steer>0.2,s.hud);
  const yaw0=s.moto.yaw;
  await touch('touchStart',[A1,B]);await delay(600);
  // SwiftShader runs at a few FPS: wait for the turn instead of a fixed time (both fingers held).
  await page.waitForFunction(y=>window.__weblab.snapshot().moto.yaw-y>0.05,yaw0,{timeout:10000}).catch(()=>{});
  s=await snapshot();
  check('two fingers: throttle held while steering (multi-touch)',s.hud.accelerate&&s.hud.stick.engaged&&s.moto.speed>0.5,{hud:s.hud,speed:s.moto.speed});
  check('bike turned right under the thumb',s.moto.yaw-yaw0>0.05,{yaw0,yaw:s.moto.yaw});
  // CDP: touchEnd lists the points being lifted; the other finger stays down.
  await touch('touchEnd',[A1]);await nextFrame();
  s=await snapshot();
  check('lifting the steering thumb returns to neutral at once while throttle stays',!s.hud.stick.engaged&&s.hud.steer===0&&s.hud.accelerate,s.hud);
  await touch('touchEnd',[B]);await delay(80);
  s=await snapshot();
  check('lifting the last finger releases the throttle (nothing stuck)',!s.hud.accelerate&&!s.hud.brake&&!s.hud.stick.engaged,s.hud);
  await page.keyboard.down('Space');await delay(1500);await page.keyboard.up('Space');
  // Speed zoom on the straight approach to the junction (keyboard throttle, no steering).
  await page.evaluate(j=>window.__debug.teleport(j.startX,j.startZ,j.yaw),J);await delay(600);
  await page.keyboard.down('KeyW');
  await page.waitForFunction(()=>window.__weblab.snapshot().moto.speed>5,{timeout:15000}).catch(()=>{});
  await delay(500);
  s=await snapshot();
  await page.keyboard.up('KeyW');
  check('speed zoom: the map zooms out while riding faster',s.moto.speed>4&&s.minimap.zoomTarget>restRadius+3&&s.minimap.radius>restRadius,{rest:restRadius,speed:s.moto.speed,map:s.minimap});
  // Brake until the bike has really stopped (simulation time is slow on SwiftShader), then let the zoom settle.
  await page.keyboard.down('Space');
  await page.waitForFunction(()=>Math.abs(window.__weblab.snapshot().moto.speed)<0.3,null,{timeout:20000}).catch(()=>{});
  await page.keyboard.up('Space');
  await page.waitForFunction(()=>window.__weblab.snapshot().minimap.zoomTarget<=61,null,{timeout:10000}).catch(()=>{});
  s=await snapshot();
  check('speed zoom returns close when slow, within its limits',s.minimap.zoomTarget<=61&&s.minimap.radius>=55&&s.minimap.radius<115,s.minimap);
  // Limited follow: past the ring the centre is dragged; reversing needs only a short move.
  const P={id:3,x:170,y:310};
  await touch('touchStart',[P]);await delay(60);
  await touch('touchMove',[{...P,x:P.x+R*2.5}]);await stickWhen('s.stick.steerX>0.99&&s.stick.center.x-s.stick.origin.x>a',R*1.4);
  s=await snapshot();
  const dragged=s.hud.stick.center.x-s.hud.stick.origin.x;
  check('floating stick follows the thumb past the ring, within its limit',dragged>R*1.4&&dragged<=R*1.6+0.5&&Math.abs(s.hud.stick.steerX-1)<0.01,s.hud.stick);
  await touch('touchMove',[{...P,x:s.hud.stick.center.x-R*0.5}]);await stickWhen('s.stick.steerX<-0.45&&s.steer<0');
  s=await snapshot();
  check('reversing after the follow needs only a short move back',s.hud.stick.steerX<-0.45&&s.hud.steer<0,s.hud);
  await touch('touchCancel',[]);await nextFrame();
  s=await snapshot();
  check('touchcancel returns the stick to neutral',!s.hud.stick.engaged&&s.hud.steer===0&&s.hud.stick.x===0&&s.hud.stick.y===0,s.hud);
  await touch('touchStart',[P]);await touch('touchMove',[{...P,x:P.x+R}]);await stickWhen('s.stick.steerX>0.9');
  await page.evaluate(()=>window.dispatchEvent(new Event('blur')));await nextFrame();
  s=await snapshot();
  check('losing focus while touching releases the stick',!s.hud.stick.engaged&&s.hud.steer===0,s.hud);
  await touch('touchEnd',[{...P,x:P.x+R}]);
  const pauseBox=await page.locator('.pause-button').boundingBox();
  await touch('touchStart',[{id:4,x:pauseBox.x+pauseBox.width/2,y:pauseBox.y+pauseBox.height/2}]);await delay(60);
  s=await snapshot();
  check('a touch on the pause button never grabs the stick',!s.hud.stick.engaged,s.hud.stick);
  await touch('touchEnd',[{id:4,x:pauseBox.x+pauseBox.width/2,y:pauseBox.y+pauseBox.height/2}]);await delay(200);
  s=await snapshot();
  if(s.paused){await page.locator('#pause [data-action="pause"]').tap();await delay(200);}

  // ---------------------------------------------------------------- rerouting
  await delay(3200);
  s=await snapshot();
  const v0=s.minimap.routeVersion;
  const away=await page.evaluate(()=>window.__debug.depot(106,-84));
  await page.evaluate(p=>window.__debug.teleport(p.x,p.z,0),away);
  await page.waitForFunction(v0=>{const m=window.__weblab.snapshot().minimap;return (m.offRoute??0)>18||m.routeVersion>v0;},v0,{timeout:8000}).catch(()=>{});
  s=await snapshot();
  if((s.minimap.offRoute??0)>18||s.minimap.routeVersion>v0){
   await page.waitForFunction(v0=>window.__weblab.snapshot().minimap.routeVersion>v0,v0,{timeout:10000}).catch(()=>{});
   await delay(300);
   s=await snapshot();
   check('leaving the route recalculates it once',s.minimap.routeVersion===v0+1&&s.minimap.offRoute<18,{v0,map:s.minimap});
   await delay(3500);
   const s2=await snapshot();
   check('no recalculation storm while standing on the new route',s2.minimap.routeVersion===v0+1,{v0,map:s2.minimap});
  } else console.log('NOTE reroute fixture landed on the current route; rerouting covered by unit tests');

  // ---------------------------------------------------------------- expanded map with remaining stops
  const previewed=await page.evaluate(()=>window.__debug.previewStops());
  await page.keyboard.press('KeyM');await delay(500);
  s=await snapshot();
  check('expanded map shows the remaining stops (numbered, next highlighted) — display fixture',previewed>0&&s.minimap.stops===previewed&&s.minimap.expanded&&/\d+ parada/.test(await page.locator('#legend-stops').innerText()),{previewed,map:s.minimap});
  if(process.env.WEBLAB_SHOTS)await page.screenshot({path:`${process.env.WEBLAB_SHOTS}/expanded-stops-915x412.png`});
  await page.keyboard.press('KeyM');await delay(300);

  // ---------------------------------------------------------------- on foot
  await page.evaluate(()=>{const m=window.__weblab.snapshot().moto;window.__debug.placeWalker(m.x+Math.cos(m.yaw)*1.4,m.z-Math.sin(m.yaw)*1.4,m.yaw);});
  await page.waitForFunction(()=>window.__weblab.snapshot().hud.context!=='riding',null,{timeout:10000}).catch(()=>{});
  await delay(300);
  s=await snapshot();
  check('HUD switches to the on-foot context',s.mode==='walking'&&(s.hud.context==='walking'||s.hud.context==='base'),s.hud);
  if(s.hud.context==='walking'){
   for(const [w,h] of sizes){
    await page.setViewportSize({width:w,height:h});await delay(350);
    const L=await page.evaluate(layout);
    check(`on foot ${w}×${h}: speed, distance and team chip hidden`,!L.visible['.telemetry .speed']&&!L.visible['#objective-distance']&&!L.visible['#team-progress']&&!L.visible['#nav-turn'],L.visible);
    assertLayout(`on foot ${w}×${h}`,L);
   }
   await page.setViewportSize({width:915,height:412});await delay(300);
  }
  s=await snapshot();
  check('on foot the minimap is north-up',!s.minimap.headingUp&&s.minimap.rotation===0,s.minimap);
  const w0=s.walker;
  const Q={id:5,x:180,y:300};
  const Q1={...Q,x:Q.x+R*0.7,y:Q.y-R*0.7};
  await touch('touchStart',[Q]);await touch('touchMove',[Q1]);await stickWhen('s.stick.x>0.5&&s.stick.y>0.5');
  await page.waitForFunction(w0=>{const w=window.__weblab.snapshot().walker;return Math.hypot(w.x-w0.x,w.z-w0.z)>0.5;},w0,{timeout:10000}).catch(()=>{});
  s=await snapshot();
  check('on foot the stick is 360°: diagonal keeps both axes',s.hud.stick.x>0.5&&s.hud.stick.y>0.5&&Math.abs(Math.hypot(s.hud.stick.x,s.hud.stick.y)-1)<0.02,s.hud.stick);
  check('walker moves with the stick',Math.hypot(s.walker.x-w0.x,s.walker.z-w0.z)>0.5,{w0,w:s.walker});
  await touch('touchEnd',[Q1]);await delay(300);
  const w1=(await snapshot()).walker;await delay(400);
  s=await snapshot();
  check('walker stops when the thumb is lifted (no drift)',Math.hypot(s.walker.x-w1.x,s.walker.z-w1.z)<0.05,{w1,w:s.walker});
  await page.evaluate(()=>{const m=window.__weblab.snapshot().moto;window.__debug.placeWalker(m.x+Math.cos(m.yaw)*1.4,m.z-Math.sin(m.yaw)*1.4,m.yaw);});
  await delay(300);
  await page.evaluate(()=>window.__debug.act());
  await page.waitForFunction(()=>window.__weblab.snapshot().mode==='riding',null,{timeout:5000}).catch(()=>{});
  s=await snapshot();
  check('getting back on the bike still works',s.mode==='riding',s.mode);
 }

 s=await snapshot();
 check('parcels still unique after the session',s.delivery.parcels.length===new Set(s.delivery.parcels.map(p=>p.id)).size);
 check('NPC couriers still active and traffic still running',s.delivery.logistics.couriers.some(c=>c.state!=='waiting')&&s.city.vehicles>0);
 check('minimap stays cheap to draw (average ms per redraw, SwiftShader)',s.minimap.drawMs<12,{drawMs:s.minimap.drawMs,draws:s.minimap.draws});
 console.log('Minimap cost:',JSON.stringify({drawMs:s.minimap.drawMs,draws:s.minimap.draws}));
 // The first page keeps rendering on SwiftShader and starves the next contexts' input: close it.
 await context.close();
 // B1-01 F1: a legacy calendar index in the real browser storage is migrated into the Oeste career save, not deleted.
 {
  const legacy=await browser.newContext({viewport:{width:915,height:412},isMobile:true,hasTouch:true,deviceScaleFactor:1});
  await legacy.addInitScript(()=>{if(!sessionStorage.getItem('b1-seeded')){sessionStorage.setItem('b1-seeded','1');localStorage.clear();localStorage.setItem('brejo-log003-workday-index','2');}});
  const lp=await legacy.newPage();lp.on('pageerror',e=>errors.push(e.message));
  await lp.goto(url+'?gfx=mobile',{waitUntil:'domcontentloaded',timeout:120000});
  await lp.waitForSelector('#vehicle-choice:not([hidden])',{timeout:120000});
  await lp.locator('[data-vehicle="moto-antiga"]').tap();
  await lp.waitForFunction(()=>!!window.__weblab?.snapshot?.().career,{timeout:120000});
  const ls=await lp.evaluate(()=>({career:window.__weblab.snapshot().career,legacy:localStorage.getItem('brejo-log003-workday-index'),save:JSON.parse(localStorage.getItem('brejo-b1:carreira:personagem-oeste')||'null'),others:['norte','leste','sul'].map(k=>localStorage.getItem('brejo-b1:carreira:personagem-'+k))}));
  check('B1-01 F1: legacy calendar migrated to the Oeste career in browser storage, legacy key kept, other careers untouched',ls.career.calendarIndex===2&&ls.career.durable===true&&ls.legacy==='2'&&ls.save?.schemaVersion===1&&ls.save.profile.calendarIndex===2&&ls.others.every(v=>v===null),ls);
  await legacy.close();
 }
 await carCareer(browser);
 check('no fatal JavaScript errors',errors.length===0,errors);
 console.log('Browser smoke completed:',notes.length,'checks; Chromium emulated mobile/SwiftShader, NOT physical Android.');
}
run().catch(e=>{console.error('FAIL',e,errors);process.exitCode=1;}).finally(async()=>{if(browser)await browser.close();if(server){try{process.platform==='win32'?server.kill('SIGTERM'):process.kill(-server.pid,'SIGTERM');}catch{server.kill('SIGTERM');}}});
