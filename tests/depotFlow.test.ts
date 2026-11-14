import test from 'node:test';import assert from 'node:assert/strict';
import { Workday, DEPOT_SPOTS, type DepotVisit } from '../src/core/delivery/workday.ts';
import { depotWorld,depotYaw } from '../src/world/city/cityPlan.ts';
import { PLACE_MOVES,PARCEL_FLOW } from '../src/core/delivery/parcels.ts';
import {depotFree} from '../src/world/city/depotPlan.ts';
export const visit=(at:'receiving'|'dispatch'|'parking'='receiving'):DepotVisit=>({player:{...(at==='parking'?depotWorld(84,-112.25):DEPOT_SPOTS[at]),riding:false},bike:{...depotWorld(84,-111),yaw:depotYaw(0),moving:false}});
const assertConserved=(day:Workday,ids:string[])=>{
 assert.deepEqual(day.parcels.map(p=>p.id),ids);assert.equal(new Set(ids).size,ids.length);
 for(const p of day.parcels){
  assert.ok(p.holder);assert.ok(PLACE_MOVES[p.place]);
  for(let i=1;i<p.history.length;i++){
   const a=p.history[i-1]!,b=p.history[i]!;assert.ok(a.place===b.place||PLACE_MOVES[a.place].includes(b.place));
   if(a.state!==b.state)assert.equal(PARCEL_FLOW.indexOf(b.state),PARCEL_FLOW.indexOf(a.state)+1);
   assert.ok(b.holder);assert.ok(b.hour>=a.hour);
  }
 }
 for(const w of day.depot.workers)assert.ok(depotFree(w),`${w.role} in equipment at ${w.x},${w.z}`);
 assert.equal(day.depot.errors.length,0);
};
test('ART002D full ID custody, partial unloading, time jumps, truck, regional cages and same mixed sack at D02',()=>{
 const day=new Workday({stores:3,perStore:2,marketplace:4});day.update(11,0);const ids=day.parcels.map(p=>p.id);
 for(const k of day.assigned){assert.equal(day.collect(k,12),2);day.stow(12);}
 assert.equal(day.unloadForDepot(13,true,visit('parking')),0);
 assert.equal(day.unloadForDepot(13,false,{...visit('parking'),bike:{...visit().bike,...depotWorld(120,-103)}}),0);
 assert.equal(day.unloadForDepot(13,false,visit('parking')),4);
 assert.equal(day.handOver(13,{...visit(),player:{...depotWorld(110,-110),riding:false}}),0);
 assert.equal(day.handOver(13,{...visit(),bike:{...visit().bike,moving:true}}),0);
 assert.equal(day.handOver(13,visit()),4);assert.equal(day.handOver(13,visit()),0);
 assert.equal(day.unloadForDepot(13,false,visit('parking')),2);assert.equal(day.handOver(13,visit()),2);
 assert.equal(day.parcels.filter(p=>p.place==='recebimento').length,6);
 assert.equal(day.takeSack(15,visit('dispatch')),0,'no withdrawal from clock alone');
 day.update(18,.05);assert.ok(day.parcels.some(p=>p.state!=='NA_SACA'),'clock jump does not finish tasks');
 // Return the test clock forward from the last historic event. Schedule is open, but real work is still required.
 let h=18;
 const seen=new Set<string>();let previous=new Map<string,{x:number;y:number;z:number}>();
 for(let i=0;i<16000&&!day.canTakeSack(h);i++){
  h+=.05/240;day.update(h,.05);
  for(const p of day.parcels){seen.add(p.place);if(p.position){const prev=previous.get(p.id);if(prev&&p.place==='transferencia')assert.ok(Math.hypot(p.position.x-prev.x,p.position.z-prev.z)<1.1,'continuous carried position');previous.set(p.id,{...p.position});}}
  if(i%100===0)assertConserved(day,ids);
 }
 assertConserved(day,ids);assert.ok(day.canTakeSack(h),JSON.stringify(day.parcels.map(p=>[p.id,p.place,p.state])));
 for(const place of ['recebimento','conferencia','transferencia','triagem','gaiola','saca'])assert.ok(seen.has(place),place);
 assert.equal(day.takeSack(h,visit('receiving')),0,'wrong dock');
 assert.equal(day.takeSack(h,visit('dispatch')),10);assert.equal(day.takeSack(h,visit('dispatch')),0);
 assert.ok(day.inHands().some(p=>p.platform==='ML')&&day.inHands().some(p=>p.platform==='SHP'));
 assert.ok(day.sackInHands);day.stow(h);assert.equal(day.inTrunk().length,10);
 while(day.route.length){const id=day.route[0]!;day.takeForAddress(id,h);day.deliver(id,h);}
 assert.equal(day.phase,'CONCLUIDA');assertConserved(day,ids);
 for(const p of day.parcels){assert.ok(p.history.some(e=>e.place==='conferencia'));assert.ok(p.history.some(e=>e.place==='doca'&&e.dock==='D02'&&e.load==='ROTA-01'));assert.equal(p.history.filter(e=>e.operation==='estado:TRIADO').length,1);}
});
