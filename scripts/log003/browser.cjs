/** Real Chromium renders + real contextual actions. City-trip positions are fixtures, not driving claims.
 * logisticsStep advances the SAME simulation in <=1s batches; it never changes parcel records. */
const {chromium}=require('playwright'),fs=require('node:fs');
const out='docs/evidence/log-003';fs.mkdirSync(out,{recursive:true});
(async()=>{const b=await chromium.launch({executablePath:'/usr/bin/chromium',args:['--no-sandbox','--use-angle=swiftshader','--enable-unsafe-swiftshader']});const p=await b.newPage({viewport:{width:960,height:540}});const errors=[],checks=[];p.on('pageerror',e=>errors.push(e.message));
const check=(name,v)=>{checks.push({name,pass:!!v});console.log(v?'PASS':'FAIL',name);if(!v)throw new Error(name);};
const snap=()=>p.evaluate(()=>__weblab.snapshot()),frame=()=>p.evaluate(()=>new Promise(r=>__scene.onAfterRenderObservable.addOnce(()=>r(null))));
const wait=async fn=>{for(let i=0;i<700;i++){await frame();const s=await snap();if(fn(s))return s;}throw Error('wait '+fn);};
const act=()=>p.evaluate(()=>__debug.act());
const place=async(x,z)=>p.evaluate(([x,z])=>{const q=__debug.depot(x,z);__debug.placeWalker(q.x,q.z)},[x,z]);
const park=async(x,z,yaw=0)=>p.evaluate(([x,z,yaw])=>{const q=__debug.depot(x,z);__debug.parkAt(q.x,q.z,__debug.depotYaw(yaw))},[x,z,yaw]);
const view=async(x,z,r=24,beta=.95)=>p.evaluate(([x,z,r,beta])=>{const q=__debug.depot(x,z),a=__debug.depot(110,-100),b=__debug.depot(110,-120);__debug.view(Math.atan2(a.z-b.z,a.x-b.x),beta,r,q.x,q.z);__scene.activeCamera.target.y=1},[x,z,r,beta]);
const shot=async name=>{await p.evaluate(name=>document.querySelector('#pause').style.visibility=name==='logistics-panel-ready'?'':'hidden',name);await p.evaluate(()=>__scene.getEngine().setHardwareScalingLevel(1));await frame();await p.screenshot({path:`${out}/${name}.jpg`,quality:88});await p.evaluate(()=>{__scene.getEngine().setHardwareScalingLevel(4);document.querySelector('#pause').style.visibility=''});};
const label=async re=>wait(s=>re.test(s.delivery.action||''));
const step=async seconds=>{await p.evaluate(n=>{for(let t=0;t<n;t++)__debug.logisticsStep(1);__debug.setHour(__weblab.snapshot().clock.hour)},seconds);await frame();};
await p.goto('http://localhost:5173/?gfx=mobile&trafego=0&hora=12.05&seed=2026');await p.waitForFunction(()=>window.__debug);await p.evaluate(()=>__scene.getEngine().setHardwareScalingLevel(4));
let s=await snap();const ids=s.delivery.parcels.map(p=>p.id);check('eight unique shops, two per actor',new Set(Object.values(s.delivery.logistics.assignments).flat()).size===8&&Object.values(s.delivery.logistics.assignments).every(a=>a.length===2));
await p.evaluate(()=>__debug.depotGate(true));await wait(s=>s.delivery.depot.gateOpen>.99);await view(106,-96,38,.85);await shot('after-entry');await view(87,-108,21,1.05);await shot('after-parking');
// Real throttle against the gate, then through the open gate.
await park(106,-86,Math.PI);await place(106.7,-86);await act();await wait(s=>s.mode==='riding');await p.evaluate(()=>__debug.depotGate(false));await wait(s=>s.delivery.depot.gateOpen<.01);
const gateStart=(await snap()).moto;await p.keyboard.down('KeyW');await wait(s=>s.moto.speed===0&&Math.hypot(s.moto.x-gateStart.x,s.moto.z-gateStart.z)>3);await p.keyboard.up('KeyW');
s=await snap();let lp=await p.evaluate(m=>__debug.depotLocal(m.x,m.z),s.moto);check('closed gate blocks real motorcycle',lp.z>-92.3);
await p.evaluate(()=>__debug.depotGate(true));await wait(s=>s.delivery.depot.gateOpen>.99);await p.keyboard.down('KeyW');await wait(s=>s.moto.speed>1&&Math.hypot(s.moto.x-gateStart.x,s.moto.z-gateStart.z)>9);await p.keyboard.up('KeyW');await p.keyboard.down('KeyS');await wait(s=>s.moto.speed===0);await p.keyboard.up('KeyS');
// Reposition after the control test; all collections below use actual contextual transfer actions.
for(const id of s.delivery.assigned){
 let remaining=true;while(remaining){s=await snap();const st=s.delivery.stores.find(x=>x.id===id);
 await p.evaluate(st=>{__debug.parkNear(st.pickup.x,st.pickup.z);__debug.placeWalker(st.pickup.x,st.pickup.z,st.facing)},st);await label(/Retirar com/);await act();
 s=await snap();check('partial collection respects four hands',s.delivery.cargo.hands>0&&s.delivery.cargo.hands<=4);
 await p.evaluate(()=>{const q=__weblab.snapshot().delivery.cargo.trunkSpot;__debug.placeWalker(q.x,q.z)});await label(/Guardar no baú/);await act();s=await snap();remaining=s.delivery.parcels.some(p=>p.origin===id&&p.state==='NA_LOJA');
 }}
await park(84,-111);await place(84,-112.25);await label(/Retirar do baú/);await act();s=await snap();check('unload limits hands to four',s.delivery.cargo.hands===4&&s.delivery.cargo.trunk>0);
// Pause fixes time while contextual fixture actions are executed.
await p.keyboard.press('KeyP');
while((s=await snap()).delivery.parcels.some(q=>q.collector==='jogador'&&['maos','bau'].includes(q.place))){
 if(!s.delivery.cargo.hands){await place(84,-112.25);await label(/Retirar do baú/);await act();}
 await place(97.8,-122.3);await label(/Entregar ao conferente/);await act();await frame();
 s=await snap();if(s.delivery.cargo.hands)await step(5);
}
await view(101,-122,6,1.13);await shot('receiving-original-ids');check('player receipts persist with original IDs',s.delivery.parcels.filter(q=>q.collector==='jogador').every(q=>q.history.some(e=>e.place==='recebimento')));
await p.evaluate(()=>__scene.meshes.filter(m=>m.name.startsWith('art002-roof')).forEach(m=>m.setEnabled(false)));
let vanShot=false,sortShot=false,cageShot=false,dockShot=false,fourLoadsShot=false,sackChecked=false;
for(let i=0;i<125;i++){
 await step(10);s=await snap();const l=s.delivery.logistics;
 checkSilent(s.delivery.parcels.length===ids.length&&new Set(s.delivery.parcels.map(p=>p.id)).size===ids.length,'ID conservation');
 checkSilent(l.couriers.every(c=>c.state!=='blocked'),'NPC path '+JSON.stringify(l.couriers.map(c=>({state:c.state,error:c.error}))));
 if(!sackChecked&&l.couriers.some(c=>c.state==='return-load')){const c=l.couriers.find(c=>c.state==='return-load');check('NPC mixed sack groups exactly the held original IDs',await p.evaluate(c=>{const m=__scene.meshes.find(m=>m.name.startsWith(`sack-bag-${c.id}`));return m?.isEnabled()&&m.metadata.capacity===18&&JSON.stringify(m.metadata.ids)===JSON.stringify(c.hands)},c));sackChecked=true;}
 if(!vanShot&&l.van.state==='unloading'){await view(128,-116,10,1.05);await shot('yellow-van-front');await view(128,-117.1,7,1.05);await p.evaluate(()=>{__scene.activeCamera.alpha+=Math.PI;__scene.activeCamera.target.y=1.35});await shot('yellow-van-unloading');vanShot=true;check('D05 open while unloading',l.van.door===1);check('no static GLB shutter covers the operational D05',await p.evaluate(()=>!__scene.meshes.some(m=>m.name.startsWith('rollershutter_door@')&&m.isEnabled())));}
 if(!sortShot&&s.delivery.parcels.some(p=>p.place==='triagem')){await view(110,-130,12,1.05);await shot('after-sorting-cutaway');sortShot=true;}
 if(!cageShot&&s.delivery.parcels.some(p=>p.place==='gaiola')){await view(120,-136,13,1.1);await shot('four-regional-cages-cutaway');cageShot=true;}
 if(!dockShot&&s.delivery.parcels.some(p=>p.place==='saca')){await view(109,-119,33,.85);await shot('after-five-docks-cutaway');dockShot=true;}
 if(!fourLoadsShot&&new Set(s.delivery.parcels.filter(p=>p.place==='saca').map(p=>p.dock)).size===4){await view(109,-120,31,.85);await shot('four-loads-in-correct-docks');fourLoadsShot=true;}
 if(s.delivery.phase==='SACA'&&s.clock.hour>=15&&l.couriers.every(c=>c.state==='ready'))break;
}
s=await snap();check('NPCs collected both assigned shops and parked',s.delivery.logistics.couriers.every(c=>c.state==='ready'));check('all original IDs received and correctly sorted',s.delivery.parcels.every(p=>p.history.some(e=>e.place==='recebimento')&&p.dock===({Norte:'D01',Oeste:'D02',Leste:'D03',Sul:'D04'})[p.sector]));
fs.writeFileSync(`${out}/four-loads-before-player-pickup.json`,JSON.stringify(s.delivery,null,2));
await place(112,-116.7);await act();check('wrong dock refuses player pickup',(await snap()).delivery.cargo.hands===0);
await place(104,-116.7);await label(/Retirar a saca/);await act();await place(84,-112.25);await label(/Guardar a saca/);await act();await frame();
s=await snap();check('four original sector loads ready, player carries only West',s.delivery.logistics.teamReady&&s.delivery.parcels.filter(p=>p.holder==='jogador').every(p=>p.sector==='Oeste'));
await p.evaluate(()=>document.querySelector('#logistics-panel').open=true);await p.waitForTimeout(600);await p.locator('#release-team').scrollIntoViewIfNeeded();await shot('logistics-panel-ready');await p.locator('#release-team').click();await frame();s=await snap();check('one confirmation releases four actors',s.delivery.logistics.released&&s.delivery.logistics.releaseHour>=15);
await p.keyboard.press('KeyP');await step(10);s=await snap();check('three NPC routes depart after joint release',s.delivery.logistics.couriers.every(c=>c.state==='to-address'));
// Address trips are fixtures; hand/trunk/door transfers remain real gameplay actions.
while((s=await snap()).delivery.route.length){const target=s.delivery.objective.target;await p.evaluate(t=>{__debug.parkNear(t.x,t.z);const q=__weblab.snapshot().delivery.cargo.trunkSpot;__debug.placeWalker(q.x,q.z)},target);await label(/Retirar pacote/);await act();await p.evaluate(t=>__debug.placeWalker(t.x,t.z,t.yaw||0),target);await label(/Entregar nº/);await act();await frame();}
s=await snap();check('player finishes without ending NPC routes',s.delivery.phase==='ENTREGAS'&&s.delivery.logistics.couriers.some(c=>c.state!=='complete'));
for(let i=0;i<100&&s.delivery.phase!=='CONCLUIDA';i++){await step(10);s=await snap();}
check('full four-actor workday conserves and delivers every ID exactly once',s.delivery.phase==='CONCLUIDA'&&s.delivery.parcels.length===ids.length&&s.delivery.parcels.every(p=>p.state==='ENTREGUE'&&p.history.filter(e=>e.operation==='transferência:destinatario').length===1));
check('no browser or depot task exceptions',errors.length===0&&s.delivery.depot.errors.length===0);
fs.writeFileSync(`${out}/browser-operation.json`,JSON.stringify({method:'Chromium SwiftShader; city-position fixtures; real contextual actions; real gate throttle; bounded existing simulation steps; not Android',checks,errors,final:s.delivery},null,2));await b.close();
function checkSilent(v,name){if(!v)throw Error(name)}
})().catch(e=>{console.error(e);process.exit(1)});
