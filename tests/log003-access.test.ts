import test from 'node:test';import assert from 'node:assert/strict';
import {courierRoadRoute,depotDrivingCurve,courierFootRoute} from '../src/core/delivery/courierRoutes.ts';
import {CITY_BOUNDS,STORES,depotWorld,storeLayout} from '../src/world/city/cityPlan.ts';
import {createMotionGuard} from '../src/core/collision.ts';
import {solidPolygons} from '../src/world/city/cityLayout.ts';
import {COURIER_BAYS,DISPATCH_POINTS,depotPath,DEPOT_POINTS} from '../src/world/city/depotPlan.ts';
import {SupplierVan} from '../src/core/delivery/supplierVan.ts';
const guard=createMotionGuard(CITY_BOUNDS,[],solidPolygons());
function clear(points:readonly{x:number;z:number}[],radius:number){for(let i=1;i<points.length;i++){const a=points[i-1]!,b=points[i]!,n=Math.ceil(Math.hypot(b.x-a.x,b.z-a.z)/.2);for(let k=0;k<=n;k++){const t=k/(n||1);assert.ok(guard(a.x+(b.x-a.x)*t,a.z+(b.z-a.z)*t,radius),`blocked ${JSON.stringify({a,b,t,radius})}`);}}}
test('LOG003 every shop-to-shop lane route clears real static obstacles',()=>{for(const a of [depotWorld(106,-87),...STORES.map(s=>s.stop)])for(const b of STORES)clear(courierRoadRoute(a,b.stop),.45);});
test('LOG003 four rounded bike approaches, dismounts, receiver and four docks are accessible',()=>{
 for(const bay of Object.values(COURIER_BAYS)){
  for(const x of [103.5,108.5])clear(depotDrivingCurve([bay,{x:bay.x,z:-107},{x,z:-107},{x,z:-96},{x,z:-87}]).map(p=>depotWorld(p.x,p.z)),.95);
  for(const to of [DEPOT_POINTS.receiving,...DISPATCH_POINTS])clear(depotPath({x:bay.x,z:bay.z-1.25},to).map(p=>depotWorld(p.x,p.z)),.3);
 }
 for(const s of STORES)clear(courierFootRoute(s.stop,storeLayout(s).pickup,(x,z)=>guard(x,z,.45)),.35);
});
test('LOG003 van opens before unloading, stays open during task, closes only after last handoff',()=>{const v=new SupplierVan();assert.equal(v.door,0);assert.equal(v.update(12,1,true,false),false);assert.equal(v.update(13,.1,true,false),true);v.update(13,2,true,false);assert.ok(v.unloading);v.update(13,1,false,true);assert.equal(v.door,1);v.update(13,1,false,false);v.update(13,2,false,false);assert.equal(v.state,'departed');assert.equal(v.door,0);});
