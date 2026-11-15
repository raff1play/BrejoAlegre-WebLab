import test from 'node:test';
import assert from 'node:assert/strict';
import {calendarDay,calendarWeek,nextWorkday} from '../src/core/delivery/operatingCalendar.ts';
import {dailyDemand} from '../src/core/delivery/dailyDemand.ts';
import {buildAddresses} from '../src/core/delivery/addresses.ts';
import {LogisticsDay} from '../src/core/delivery/logisticsDay.ts';
import {depotWorld,depotYaw,CITY_BOUNDS} from '../src/world/city/cityPlan.ts';
import {solidPolygons} from '../src/world/city/cityLayout.ts';
import {createMotionGuard} from '../src/core/collision.ts';
const free=createMotionGuard(CITY_BOUNDS,[],solidPolygons());
const parking={player:{...depotWorld(84,-112.25),riding:false},bike:{...depotWorld(84,-111),yaw:depotYaw(0),moving:false}};
const receiving={player:{...depotWorld(97.8,-122.3),riding:false},bike:parking.bike};

test('LOG004 calendar: recurring weekday cycle, stable dates and explicit unassigned days',()=>{
 const days=calendarWeek(0);
 assert.deepEqual(days.map(x=>x.name),['Segunda','Terça','Quarta','Quinta','Sexta','Sábado','Domingo']);
 assert.deepEqual(days.map(x=>x.tier),['alta','alta','normal','media','media','fraca','folga']);
 assert.equal(days[0]!.date,'2026-11-16');
 assert.equal(days[0]!.minParcels,44);assert.equal(days[0]!.maxParcels,55);
 assert.equal(days[5]!.minParcels,21);assert.equal(days[5]!.maxParcels,31);
 assert.equal(nextWorkday(5).index,7);assert.equal(calendarDay(7).name,'Segunda');
});
test('LOG004 demand: weekday presets preserve eight stores and deterministic IDs',()=>{
 const addresses=buildAddresses();
 for(const index of [0,1,2,3,4,5,7,8]){
  const plan=calendarDay(index),d=dailyDemand(addresses,11,{dayIndex:index});
  assert.ok(d.parcels.length>=plan.minParcels&&d.parcels.length<=plan.maxParcels);
  for(const pair of Object.values(d.assignments))for(const store of pair){
   const n=d.parcels.filter(p=>p.origin===store).length;
   assert.ok(n>=plan.storeMin&&n<=plan.storeMax,plan.name+': '+store+' '+n);
  }
  assert.ok(d.vanCount>=plan.vanMin&&d.vanCount<=plan.vanMax);
  assert.equal(new Set(d.parcels.map(p=>p.id)).size,d.parcels.length);
  assert.deepEqual(d,dailyDemand(addresses,11,{dayIndex:index}));
 }
 assert.throws(()=>dailyDemand(addresses,11,{dayIndex:6}),/sem expediente/);
});
test('LOG004 high Monday: NPCs return by 14h20 and all 55 volumes sorted by 16h',()=>{
 const day=new LogisticsDay({seed:2026,dayIndex:0,boundary:'maximum',free:(x,z)=>free(x,z,.45)});
 day.start(11);assert.equal(day.parcels.length,55);assert.equal(day.depot.workers.length,10);
 for(let t=0;t<150;t+=.1)day.update(11+t/150,.1);
 for(const store of day.assigned)while(day.readyAt(store).length){assert.ok(day.collect(store,12)>0);day.stow(12);}
 let assisted=false;
 for(let t=0;t<600;t+=.1){
  const hour=12+t/150;
  if(day.trunkForDepot().length&&!day.inHands().length)day.unloadForDepot(hour,false,parking);
  if(day.inHands().some(p=>p.state==='EM_TRANSPORTE'))day.handOver(hour,receiving);
  day.update(hour,.1);
  if(day.depot.allWorkers.some(w=>w.role.startsWith('auxiliar-')&&w.active&&w.task))assisted=true;
  for(const courier of day.couriers)assert.notEqual(courier.state,'blocked',courier.id+': '+courier.error);
  if(day.allSortedAt!==null&&day.couriers.every(c=>c.returnedAt!==null))break;
 }
 console.log('LOG004 segunda/55: retornos',day.couriers.map(c=>[c.id,c.returnedAt]),'triagem',day.allSortedAt);
 for(const courier of day.couriers){
  assert.ok(courier.returnedAt!==null&&courier.returnedAt<=14+20/60,courier.id+' chegou '+courier.returnedAt);
 }
 assert.ok(assisted,'At least one NPC works a real parcel task after unloading');
 assert.ok(day.allSortedAt!==null&&day.allSortedAt<=16,'55 packets ready by 16h; actual '+day.allSortedAt);
 assert.deepEqual(day.depot.errors,[]);
 assert.equal(new Set(day.parcels.map(p=>p.id)).size,55);
});

for(const [index,label] of [[3,'quinta'],[5,'sábado']] as const)test(`LOG004 ${label}: carga máxima do dia pronta até 15h`,()=>{
 const plan=calendarDay(index);
 const day=new LogisticsDay({seed:2026,dayIndex:index,boundary:'maximum',free:(x,z)=>free(x,z,.45)});
 day.start(11);assert.equal(day.parcels.length,plan.maxParcels);
 for(let t=0;t<150;t+=.1)day.update(11+t/150,.1);
 for(const store of day.assigned)while(day.readyAt(store).length){assert.ok(day.collect(store,12)>0);day.stow(12);}
 for(let t=0;t<450;t+=.1){
  const hour=12+t/150;
  if(day.trunkForDepot().length&&!day.inHands().length)day.unloadForDepot(hour,false,parking);
  if(day.inHands().some(p=>p.state==='EM_TRANSPORTE'))day.handOver(hour,receiving);
  day.update(hour,.1);
  for(const courier of day.couriers)assert.notEqual(courier.state,'blocked',courier.id+': '+courier.error);
  if(day.allSortedAt!==null&&day.couriers.every(c=>c.returnedAt!==null))break;
 }
 console.log('LOG004',label,'volume',day.parcels.length,'retornos',day.couriers.map(c=>[c.id,c.returnedAt]),'triagem',day.allSortedAt);
 assert.ok(day.couriers.every(c=>c.returnedAt!==null&&c.returnedAt<=14+20/60),'NPC ultrapassou a tolerância de 14h20');
 assert.ok(day.allSortedAt!==null&&day.allSortedAt<=15,label+' saiu da meta de 15h: '+day.allSortedAt);
 assert.equal(day.depot.errors.length,0);
});
