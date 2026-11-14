/** Real browser acceptance. Long city trips use fixtures; depot walking/driving uses real controls.
 * processDepot advances bounded simulation steps between rendered frames to keep headless tests short.
 */
const {chromium}=require('playwright');const fs=require('node:fs');
const out='docs/evidence/art-002/operation';fs.mkdirSync(out,{recursive:true});
(async()=>{const b=await chromium.launch({executablePath:'/usr/bin/chromium',args:['--use-angle=swiftshader','--enable-unsafe-swiftshader']});const p=await b.newPage({viewport:{width:960,height:540}});const errors=[];p.on('pageerror',e=>errors.push(e.message));
const ok=(name,value,detail='')=>{console.log(`${value?'PASS':'FAIL'} ${name} ${detail}`);if(!value)throw new Error(name)};
await p.goto('http://localhost:5173/?gfx=mobile&trafego=0&hora=12.1&depotTest=partial');await p.waitForFunction(()=>window.__debug);await p.evaluate(()=>window.__scene.getEngine().setHardwareScalingLevel(3));
const ev=(fn,x)=>p.evaluate(fn,x),snap=()=>ev(()=>window.__weblab.snapshot());
const wait=async(fn,ms=30000)=>{const end=Date.now()+ms;let s;do{s=await snap();if(fn(s))return s;await p.waitForTimeout(40)}while(Date.now()<end);throw new Error('timeout '+fn+'\n'+JSON.stringify({walker:s.walker,moto:s.moto,mode:s.mode,delivery:s.delivery}))};
const local=async(x,z)=>ev(([x,z])=>window.__debug.depot(x,z),[x,z]);
const place=async(x,z,yaw=0)=>{const q=await local(x,z);await ev(([q,yaw])=>window.__debug.placeWalker(q.x,q.z,yaw),[q,yaw]);};
const park=async(x,z,yaw=0)=>{const q=await local(x,z);await ev(([q,yaw])=>window.__debug.parkAt(q.x,q.z,window.__debug.depotYaw(yaw)),[q,yaw]);};
const act=()=>ev(()=>window.__debug.act());
const label=async(re)=>wait(s=>re.test(s.delivery.action||''));
const shot=async(name)=>{await ev(()=>window.__scene.getEngine().setHardwareScalingLevel(1));await p.setViewportSize({width:1280,height:720});await p.waitForTimeout(300);await p.screenshot({path:`${out}/${name}.jpg`,quality:90,type:'jpeg'});await p.setViewportSize({width:960,height:540});await ev(()=>window.__scene.getEngine().setHardwareScalingLevel(3));};
const view=async(x,z,r=9,beta=1.2,y=1)=>{const q=await local(x,z);await ev(([q,r,beta,y])=>{const a=window.__debug.depot(110,-100),c=window.__debug.depot(110,-120);window.__debug.view(Math.atan2(a.z-c.z,a.x-c.x),beta,r,q.x,q.z);window.__scene.activeCamera.target.y=y},[q,r,beta,y]);};
const walk=async(to)=>{
 if(process.env.ART_FAST==='1'){console.log('FIXTURE depot walking',to);await place(to.x,to.z);return;}
 let s=await snap();const start=await ev(([x,z])=>window.__debug.depotLocal(x,z),[s.walker.x,s.walker.z]);
 const raw=await ev(([a,b])=>window.__debug.depotPath(a,b),[start,to]);
 // Keep only corners; movement still goes through the game's walking/collision implementation.
 const route=raw.filter((a,i)=>i===raw.length-1||i===0||Math.abs((a.x-raw[i-1].x)*(raw[i+1]?.z-a.z)-(a.z-raw[i-1].z)*(raw[i+1]?.x-a.x))>.001);
 for(const at of route){const q=await local(at.x,at.z);s=await snap();if(Math.hypot(s.walker.x-q.x,s.walker.z-q.z)<.16)continue;
 console.log('WALK',at);const yaw=Math.atan2(q.x-s.walker.x,q.z-s.walker.z),alpha=Math.atan2(-Math.cos(yaw),-Math.sin(yaw));await ev(([alpha,q])=>window.__debug.view(alpha,1.25,5,q.x,q.z),[alpha,q]);await p.keyboard.down('KeyW');try{await wait(v=>Math.hypot(v.walker.x-q.x,v.walker.z-q.z)<.19,60000)}finally{await p.keyboard.up('KeyW')}
 }
};
let s=await wait(s=>s.delivery.stores.every(st=>st.shutter>.98));const ids=s.delivery.parcels.map(p=>p.id);ok('10 original IDs for partial-unload fixture',ids.length===10);
for(const id of s.delivery.assigned){const st=s.delivery.stores.find(q=>q.id===id);await ev(st=>{window.__debug.parkNear(st.pickup.x,st.pickup.z);window.__debug.placeWalker(st.pickup.x,st.pickup.z,st.facing)},st);await label(/Retirar com/);await act();const tr=(await snap()).delivery.cargo.trunkSpot;await ev(q=>window.__debug.placeWalker(q.x,q.z),tr);await label(/Guardar no baú/);await act();}
s=await snap();ok('two shops: six collected in the same trunk',s.delivery.cargo.trunk===6);
// Mount outside the base, close the gate, then use the real throttle against it.
await park(106,-86,Math.PI);const gateBike=(await snap()).moto;await ev(b=>window.__debug.placeWalker(b.x+.8,b.z,b.yaw),gateBike);await act();await wait(s=>s.mode==='riding');await ev(()=>window.__debug.depotGate(false));await wait(s=>s.delivery.depot.gateOpen<.01);
const gate=await local(106,-92.32);ok('closed gate is solid to bike',!(await ev(q=>window.__debug.canStand(q.x,q.z,.55,true),gate)));
await p.keyboard.down('KeyW');await wait(s=>s.moto.speed===0&&Math.hypot(s.moto.x-gateBike.x,s.moto.z-gateBike.z)>3,30000);await p.keyboard.up('KeyW');await p.keyboard.down('KeyS');await p.waitForTimeout(200);await wait(s=>s.moto.speed===0);await p.keyboard.up('KeyS');
s=await snap();let lp=await ev(b=>window.__debug.depotLocal(b.x,b.z),s.moto);ok('real riding cannot cross closed gate',lp.z>-92.2,JSON.stringify(lp));await shot('01-gate-closed');
await ev(()=>window.__debug.depotGate(true));await wait(s=>s.delivery.depot.gateOpen>.99);ok('open gate leaves a clear gap',await ev(q=>window.__debug.canStand(q.x,q.z,.55,true),gate));
await p.keyboard.down('KeyW');await wait(s=>{const a=s.moto;return Math.hypot(a.x-gate.x,a.z-gate.z)>5&&a.speed>1},30000);await p.keyboard.up('KeyW');await p.keyboard.down('KeyS');await p.waitForTimeout(200);await wait(s=>s.moto.speed===0);await p.keyboard.up('KeyS');
s=await snap();lp=await ev(b=>window.__debug.depotLocal(b.x,b.z),s.moto);ok('real riding enters the yard through open gate',lp.z<-94,JSON.stringify(lp));
// Valid bay, real dismount and walk to the rear of the bike.
await park(84,-111);await act();await wait(s=>s.mode==='walking');await walk({x:83,z:-113.5});await walk({x:84,z:-112.25});await label(/Retirar do baú/);await act();
s=await snap();ok('first trip: 4 in hands, 2 remain in trunk',s.delivery.cargo.hands===4&&s.delivery.cargo.trunk===2);
await walk({x:97.8,z:-122.3});await label(/Entregar ao conferente/);await act();s=await snap();ok('4 IDs deposited physically',s.delivery.parcels.filter(q=>q.place==='recebimento'||q.place==='conferencia').length===4);await view(101,-122,3.4,1.15);await shot('02-receiving');
await walk({x:84,z:-113.5});await walk({x:84,z:-112.25});await label(/Retirar do baú/);await act();await walk({x:97.8,z:-122.3});await label(/Entregar ao conferente/);await act();ok('second trip empties the vehicle',(await snap()).delivery.cargo.trunk===0);
await ev(()=>window.__debug.setHour(14.2));
const stages=new Set(),trace=[];let last=null;let captured=new Set();
for(let i=0;i<2400;i++){
 await ev(()=>window.__debug.processDepot(.6));await ev(()=>new Promise(resolve=>window.__scene.onAfterRenderObservable.addOnce(()=>resolve(null))));s=await snap();const d=s.delivery;const parcel=d.parcels.find(q=>q.id===ids[0]);
 okQuiet(d.parcels.length===ids.length&&new Set(d.parcels.map(q=>q.id)).size===ids.length,'ID conservation');
 for(const q of d.parcels)if(q.position&&q.place!=='maos'&&q.place!=='bau')okQuiet(d.depot.visibleIds.includes(q.id),'live parcel representation '+q.id);
 if(parcel.place!==last){trace.push(JSON.parse(JSON.stringify(parcel)));last=parcel.place;console.log('TRACE',parcel.id,parcel.state,parcel.place,parcel.holder,parcel.position);}
 stages.add(parcel.place);
 if(!captured.has('triagem')&&d.parcels.some(q=>q.place==='triagem')){await view(110,-130,8,1.2);await shot('03-sorting-live-IDs');captured.add('triagem');}
 if(!captured.has('gaiola')&&d.parcels.some(q=>q.place==='gaiola')){await view(123,-136,8,1.15);await shot('04-regional-cages');captured.add('gaiola');}
 if(d.phase==='SACA')break;
}
ok('same load completed at D02',(await snap()).delivery.parcels.every(q=>q.place==='saca'&&q.dock==='D02'&&q.load==='ROTA-01'));
await view(104,-120,8,1.25);await shot('05-load-ready-at-dock');
await place(104,-116.7);await label(/Saca às 15h/);await act();ok('early withdrawal refused',(await snap()).delivery.cargo.hands===0);
await ev(()=>window.__debug.setHour(15.1));await place(112,-116.7);await act();ok('wrong dock cannot release load',(await snap()).delivery.cargo.hands===0);
await place(104,-116.7);await label(/Retirar a saca/);await act();s=await snap();ok('same 10 IDs in mixed sack, ML and SHP',s.delivery.cargo.hands===10&&s.delivery.parcels.some(q=>q.platform==='ML')&&s.delivery.parcels.some(q=>q.platform==='SHP'));
await walk({x:84,z:-113.5});await walk({x:84,z:-112.25});await label(/Guardar a saca/);await act();ok('mixed sack stowed before delivery',(await snap()).delivery.cargo.trunk===10);
// Existing address handoff mechanics, with original IDs, until the whole route is finished.
while((s=await snap()).delivery.route.length){const t=s.delivery.objective.target;await ev(q=>{window.__debug.parkNear(q.x,q.z);window.__debug.placeWalker(q.x,q.z,q.yaw||0)},t);const trunk=(await snap()).delivery.cargo.trunkSpot;await ev(q=>window.__debug.placeWalker(q.x,q.z),trunk);await label(/Retirar pacote/);await act();await ev(q=>window.__debug.placeWalker(q.x,q.z,q.yaw||0),t);await label(/Entregar nº/);await act();}
s=await snap();ok('complete delivery workday, no replacement IDs',s.delivery.phase==='CONCLUIDA'&&s.delivery.progress.delivered===10&&ids.every(id=>s.delivery.parcels.some(q=>q.id===id&&q.state==='ENTREGUE')));
ok('no browser or task errors',errors.length===0&&s.delivery.depot.errors.length===0,JSON.stringify(errors));
fs.writeFileSync(`${out}/trace.json`,JSON.stringify({method:'real browser controls + fixture teleports for city trips, bounded task steps for headless',ids,trace,final:s.delivery,errors},null,2));
await b.close();
function okQuiet(v,name){if(!v)throw new Error(name)}
})().catch(e=>{console.error(e);process.exit(1)});
