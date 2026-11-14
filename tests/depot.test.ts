import test from 'node:test';
import assert from 'node:assert/strict';
import { circleIntersectsBox, createMotionGuard } from '../src/core/collision.ts';
import { CITY_BOUNDS, depotLocal, depotWorld, depotYaw, cityPolygons, depotPoly } from '../src/world/city/cityPlan.ts';
import { DEPOT_POINTS, CAR_PARKING, MOTO_PARKING, depotFixtures, depotPath, depotFree, gateLeaves, validDepotParking } from '../src/world/city/depotPlan.ts';
const guard=createMotionGuard(CITY_BOUNDS,[],cityPolygons());
test('ART002B shared fixture collision blocks walkers and motorcycles at every relevant solid',()=>{
 for(const f of depotFixtures()){
  const p=depotWorld((f.minX+f.maxX)/2,(f.minZ+f.maxZ)/2);
  for(const r of [.3,.55])assert.equal(guard(p.x,p.z,r),false,`${f.id} radius ${r}`);
 }
 for(const p of [DEPOT_POINTS.parking,DEPOT_POINTS.receiving,DEPOT_POINTS.dispatch,{x:106,z:-96},{x:106,z:-109}]){
  const w=depotWorld(p.x,p.z);assert.ok(guard(w.x,w.z,.35),JSON.stringify(p));
 }
});
test('ART002B entry sliding leaves block exactly where rendered, open gap has no ghost collider',()=>{
 const p=depotWorld(106,-92.32);
 assert.ok(gateLeaves(0).some(b=>circleIntersectsBox(106,-92.32,.55,b)));
 assert.ok(!gateLeaves(1).some(b=>circleIntersectsBox(106,-92.32,.55,b)));
 assert.ok(guard(p.x,p.z,.55),'no permanent collider across the vehicle opening');
 const pedestrian=depotWorld(93.4,-92.32);assert.ok(guard(pedestrian.x,pedestrian.z,.35));
 for(const k of [0,.25,.5,.75,1])for(const b of gateLeaves(k)){
  const g=createMotionGuard(CITY_BOUNDS,[],[depotPoly(b)]);const w=depotWorld((b.minX+b.maxX)/2,-92.32);assert.ok(!g(w.x,w.z,.35));
 }
});
test('ART002B usable parking dimensions, dismount and protected receiving/dispatch routes',()=>{
 for(const r of CAR_PARKING){assert.ok(r.maxX-r.minX>=3);assert.ok(r.maxZ-r.minZ>=5);}
 for(const r of MOTO_PARKING){assert.ok(r.maxX-r.minX>1.7);assert.ok(r.maxZ-r.minZ>3);}
 assert.ok(validDepotParking({...DEPOT_POINTS.parking,yaw:0,moving:false}));
 assert.ok(!validDepotParking({...DEPOT_POINTS.parking,yaw:0,moving:true}));
 assert.ok(!validDepotParking({...DEPOT_POINTS.parking,yaw:Math.PI/2,moving:false}));
 for(const destination of [DEPOT_POINTS.receiving,DEPOT_POINTS.dispatch,...[{x:101,z:-120.7},{x:106,z:-128},{x:116,z:-128},{x:120.5,z:-134.7},{x:125.5,z:-134.7},{x:104,z:-121.3},{x:128,z:-119.4}]]){
  const path=depotPath({x:84,z:-113.5},destination);
  for(let i=0;i<path.length;i++){
   assert.ok(depotFree(path[i]!));const w=depotWorld(path[i]!.x,path[i]!.z);assert.ok(guard(w.x,w.z,.3));
   if(i){const a=path[i-1]!,b=path[i]!;for(let t=0;t<=1;t+=.2)assert.ok(depotFree({x:a.x+(b.x-a.x)*t,z:a.z+(b.z-a.z)*t}));}
  }
 }
 const local=depotLocal(...Object.values(depotWorld(84,-111)) as [number,number]);assert.ok(Math.abs(local.x-84)<1e-8&&Math.abs(local.z+111)<1e-8);
 assert.equal(depotYaw(0)-depotYaw(1),-1);
});
