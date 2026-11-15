import test from 'node:test';
import assert from 'node:assert/strict';
import {LogisticsDay} from '../src/core/delivery/logisticsDay.ts';
import {courierTrafficObstacles} from '../src/core/delivery/couriers.ts';
import {COURIER_DEPART_HOUR,WORKDAY_START} from '../src/core/city/clock.ts';
import {depotWorld,CITY_BOUNDS} from '../src/world/city/cityPlan.ts';
import {solidPolygons} from '../src/world/city/cityLayout.ts';
import {createMotionGuard} from '../src/core/collision.ts';

const guard=createMotionGuard(CITY_BOUNDS,[],solidPolygons());
const makeDay=()=>{
 const day=new LogisticsDay({seed:2026,dayIndex:0,free:(x,z)=>guard(x,z,.45)});
 day.update(WORKDAY_START,.1);
 day.update(COURIER_DEPART_HOUR,.1);
 assert.ok(day.couriers.every(c=>c.state==='to-store'));
 return day;
};

test('LOG006: purple courier yields to blocking van, van can pass, then courier resumes',()=>{
 const day=makeDay(),purple=day.couriers[2]!;
 assert.equal(purple.id,'npc3');
 const start={...purple.bike};
 day.trafficBlocked=(id)=>id==='npc3'?'traffic':null;
 day.update(COURIER_DEPART_HOUR+.001,.1);
 assert.equal(purple.state,'to-store');
 assert.equal(purple.yieldingToTraffic,true);
 assert.deepEqual(purple.bike,start,'courier remains stationary instead of driving through a van');
 const candidates=courierTrafficObstacles(day.couriers);
 assert.equal(candidates.length,2,'ambient van can leave the circular standstill');
 assert.ok(!candidates.some(v=>v.x===purple.bike.x&&v.z===purple.bike.z));
 day.trafficBlocked=()=>null;
 day.update(COURIER_DEPART_HOUR+.002,.1);
 assert.equal(purple.yieldingToTraffic,false);
 assert.ok(Math.hypot(purple.bike.x-start.x,purple.bike.z-start.z)>0,'courier moves when van clears');
 assert.equal(courierTrafficObstacles(day.couriers).length,3);
});

test('LOG006: parked bikes do not stop passing vans; player blockers remain solid',()=>{
 const day=makeDay(),purple=day.couriers[2]!;
 purple.state='stow';
 assert.equal(purple.riding,false);
 assert.equal(courierTrafficObstacles(day.couriers).length,2,'stopped collecting courier does not lock a van');
 purple.state='to-store';
 day.trafficBlocked=(id)=>id==='npc3'?'player':null;
 const start={...purple.bike};
 day.update(COURIER_DEPART_HOUR+.001,.1);
 assert.equal(purple.yieldingToTraffic,false,'a nearby player must never release the physical blocker');
 assert.deepEqual(purple.bike,start);
 assert.equal(courierTrafficObstacles(day.couriers).length,3);
});
