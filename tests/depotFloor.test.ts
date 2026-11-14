import test from 'node:test';import assert from 'node:assert/strict';
import { subtractSurface, surfaceArea, type SurfacePoint } from '../src/world/surfaceCut.ts';
import { DEPOT } from '../src/world/city/cityPlan.ts';
import { depotFloorSurfaces, depotTerrainHole, DEPOT_FLOOR_Y } from '../src/world/city/depotFloor.ts';
import { CURB_H } from '../src/world/layout.ts';

test('base has one main surface everywhere, no double slabs, same physical height',()=>{
 const floors=depotFloorSurfaces(),lot=DEPOT.lot;
 assert.equal(DEPOT_FLOOR_Y,CURB_H);
 const area=(b:{minX:number;maxX:number;minZ:number;maxZ:number})=>(b.maxX-b.minX)*(b.maxZ-b.minZ);
 assert.ok(Math.abs(floors.reduce((s,b)=>s+area(b),0)-area(lot))<1e-7);
 for(let i=0;i<floors.length;i++)for(let j=i+1;j<floors.length;j++){
  const a=floors[i]!,b=floors[j]!;assert.ok(Math.min(a.maxX,b.maxX)-Math.max(a.minX,b.minX)<1e-7||Math.min(a.maxZ,b.maxZ)-Math.max(a.minZ,b.minZ)<1e-7,'main floor interiors cannot overlap');
 }
 for(let x=lot.minX+.137;x<lot.maxX;x+=.71)for(let z=lot.minZ+.193;z<lot.maxZ;z+=.73)
  assert.equal(floors.filter(b=>x>b.minX&&x<b.maxX&&z>b.minZ&&z<b.maxZ).length,1,`${x},${z}`);
});
test('terrain clipping conserves exterior and removes a rotated depot hole in either winding',()=>{
 const hole=depotTerrainHole(),xs=hole.map(p=>p[0]),zs=hole.map(p=>p[1]);
 const subject:SurfacePoint[]=[[Math.min(...xs)-20,Math.min(...zs)-20],[Math.max(...xs)+20,Math.min(...zs)-20],[Math.max(...xs)+20,Math.max(...zs)+20],[Math.min(...xs)-20,Math.max(...zs)+20]];
 for(const cut of [hole,[...hole].reverse()])for(const polygon of [subject,[...subject].reverse()]){
  const pieces=subtractSurface(polygon,cut);
  assert.ok(Math.abs(pieces.reduce((s,p)=>s+surfaceArea(p),0)-(surfaceArea(subject)-surfaceArea(hole)))<1e-6);
  for(const piece of pieces){assert.ok(surfaceArea(piece)>0);assert.ok(Math.abs(subtractSurface(piece,cut).reduce((s,p)=>s+surfaceArea(p),0)-surfaceArea(piece))<1e-6,'no terrain area survives inside the hole');}
 }
});
test('convex clipping handles contained, disjoint and crossing triangles without losing outside ground',()=>{
 const cut:SurfacePoint[]=[[0,0],[10,0],[10,10],[0,10]];
 assert.equal(subtractSurface([[2,2],[3,2],[2,3]],cut).length,0);
 const outside:SurfacePoint[]=[[-5,-5],[-4,-5],[-5,-4]];assert.equal(subtractSurface(outside,cut).reduce((s,p)=>s+surfaceArea(p),0),.5);
 const crossing:SurfacePoint[]=[[-10,2],[10,2],[0,8]];const pieces=subtractSurface(crossing,cut);
 assert.ok(Math.abs(pieces.reduce((s,p)=>s+surfaceArea(p),0)-30)<1e-8);
 const at=depotWorld(110,-106);assert.ok(Number.isFinite(at.x));
});
