import test from 'node:test';import assert from 'node:assert/strict';
import {LogisticsDay} from '../src/core/delivery/logisticsDay.ts';
import {PARCEL_FLOW,PLACE_MOVES} from '../src/core/delivery/parcels.ts';
import {depotWorld,depotYaw,CITY_BOUNDS} from '../src/world/city/cityPlan.ts';
import {solidPolygons} from '../src/world/city/cityLayout.ts';
import {createMotionGuard} from '../src/core/collision.ts';
import {SECTOR_DATA} from '../src/core/delivery/sectors.ts';
const guard=createMotionGuard(CITY_BOUNDS,[],solidPolygons());
const bike={...depotWorld(84,-111),yaw:depotYaw(0),moving:false};
const parking={player:{...depotWorld(84,-112.25),riding:false},bike};
const receiving={player:{...depotWorld(97.8,-122.3),riding:false},bike};
const dispatch={player:{...depotWorld(104,-116.7),riding:false},bike};
for(const [seed,boundary]of [[2026,'minimum'],[2026,'maximum'],[1,undefined],[2,undefined],[9987,undefined],[674161,undefined],[357183,undefined]] as const)test(`LOG003 complete authoritative operation ${seed}/${boundary}`,()=>{
 const d=new LogisticsDay({seed,boundary,free:(x,z)=>guard(x,z,.45)});d.start(11);if(seed===674161)assert.equal(d.parcels.length,21);if(seed===357183)assert.equal(d.parcels.length,55);const ids=d.parcels.map(p=>p.id);let partial=false,releaseAt=0,earlyProcessed=false;
 for(const kind of d.assigned)while(d.readyAt(kind).length){const before=d.readyAt(kind).length,n=d.collect(kind,12);assert.ok(n>0&&n<=4);if(before===5){assert.equal(n,4);partial=true;}d.stow(12);}
 if(boundary==='maximum')assert.ok(partial);
 assert.equal(d.unloadForDepot(12,true,parking),0);
 assert.equal(d.unloadForDepot(12,false,{...parking,bike:{...bike,moving:true}}),0);
 assert.equal(d.handOver(12,{...receiving,player:{...depotWorld(100,-105),riding:false}}),0);
 assert.equal(d.takeSack(14,dispatch),0);assert.equal(d.release(15),false);
 let sawSimultaneous=false,playerFinishedBeforeTeam=false,loadedAtDocks=false;
 for(let t=0;t<1350;t+=.1){const hour=12+t/150;
  if(d.trunkForDepot().length&&!d.inHands().length)d.unloadForDepot(hour,false,parking);
  if(d.inHands().some(p=>p.state==='EM_TRANSPORTE'))d.handOver(hour,receiving);
  d.update(hour,.1);
  if(hour<13&&d.parcels.some(p=>p.state==='RECEBIDO_BASE'||p.state==='TRIADO'))earlyProcessed=true;
  if(d.couriers.every(c=>c.state==='to-store'))sawSimultaneous=true;
  for(const c of d.couriers)assert.notEqual(c.state,'blocked',`${c.id}: ${c.error}`);
  for(const p of d.parcels){assert.ok(p.holder);if(['saca','doca'].includes(p.place)){assert.equal(p.dock,SECTOR_DATA[p.sector!].dock);assert.equal(p.load,SECTOR_DATA[p.sector!].load);}}
  if(d.canTakeSack(hour)){assert.equal(d.takeLoad('jogador',hour,depotWorld(112,-116.7)),0);loadedAtDocks=true;d.takeSack(hour,dispatch);d.stow(hour);}
  if(d.teamReady&&!d.released){assert.ok(d.release(hour));releaseAt=hour;assert.equal(d.release(hour),false);}
  if(d.released)for(const id of [...d.route]){d.takeForAddress(id,hour);d.deliver(id,hour);assert.equal(d.deliver(id,hour),0);}
  if(d.released&&!d.route.length&&d.couriers.some(c=>c.state!=='complete')){playerFinishedBeforeTeam=true;assert.notEqual(d.phase,'CONCLUIDA');}
  if(d.phase==='CONCLUIDA')break;
 }
 assert.equal(d.parcels.length,ids.length);assert.deepEqual(d.parcels.map(p=>p.id),ids);
 assert.ok(sawSimultaneous);assert.ok(earlyProcessed);assert.ok(loadedAtDocks);assert.ok(playerFinishedBeforeTeam);assert.ok(releaseAt>=15&&releaseAt<20);assert.equal(d.count('ENTREGUE'),ids.length);assert.equal(d.phase,'CONCLUIDA');assert.deepEqual(d.depot.errors,[]);
 d.couriers[0]!.state='return-address';d.phase='ENTREGAS';d.update(21,.1);assert.equal(d.phase,'CONCLUIDA','closing time recognizes all completed handoffs even during the last walk back');
 for(const p of d.parcels){assert.equal(p.place,'destinatario');const transfers=p.history.filter(e=>e.operation.startsWith('transferência:'));assert.equal(transfers.filter(e=>e.place==='recebimento').length,1);assert.equal(transfers.filter(e=>e.place==='destinatario').length,1);for(let i=1;i<p.history.length;i++){const a=p.history[i-1]!,b=p.history[i]!;assert.ok(b.hour>=a.hour);if(a.state!==b.state)assert.equal(PARCEL_FLOW.indexOf(b.state),PARCEL_FLOW.indexOf(a.state)+1);if(a.place!==b.place)assert.ok(PLACE_MOVES[a.place].includes(b.place));}}
});
test('LOG003 time jump cannot perform physical jobs or unlock sector loads',()=>{const d=new LogisticsDay();d.start(11);const before=d.parcels.map(p=>p.state);d.update(20,.001);assert.deepEqual(d.parcels.map(p=>p.state),before);assert.ok(!d.teamReady);assert.ok(!d.canTakeSack(20));d.update(21,.001);assert.equal(d.phase,'ENCERRADA');assert.equal(d.count('ENTREGUE'),0);});
