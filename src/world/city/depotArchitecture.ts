import type { Scene } from '@babylonjs/core/scene';
import type { Mesh } from '@babylonjs/core/Meshes/mesh';
import { BatchSet, type P3 } from '../geometry';
import type { LabMaterial, Materials } from '../materials';
import { rodPart } from '../modelParts';
import { DEPOT, depotWorld } from './cityPlan';
import { CAR_PARKING, MOTO_PARKING, depotFixtures, gateLeaves, type DepotFixture } from './depotPlan';

/** ART-002 original geometry. Every ground-level solid is in depotFixtures(). No fake parcels. */
export function buildDepotArchitecture(scene:Scene,set:BatchSet,flat:BatchSet,mats:Materials):{roof:Mesh[];gates:Mesh[]} {
 const Y=.15;
 const ink=mats.paint('#284e4b'),steel=mats.paint('#465954',.3),yellow=mats.paint('#dbb34a'),concrete=mats.plaster('#c6bd9f');
 const box=(m:LabMaterial,x0:number,x1:number,y0:number,y1:number,z0:number,z1:number)=>set.box(m,x0,x1,Y+y0,Y+y1,z0,z1);
 const sign=(id:string,text:string,x0:number,x1:number,z:number,y:number,h=.65,bg='#284e4b')=>{
  const m=mats.sign(`art002-${id}`,bg,'#f3e7c8',[{text,size:.6,color:'#f3e7c8',weight:'800'}],(x1-x0)/h,128);
  m.material.backFaceCulling=false;
  set.of(m).quad([x1,Y+y,z],[x0,Y+y,z],[x0,Y+y+h,z],[x1,Y+y+h,z],1,1);
 };
 const line=(a:P3,c:P3,d=.035,m=steel)=>set.absorb(m,rodPart(scene,[a[0],Y+a[1],a[2]],[c[0],Y+c[1],c[2]],d));
 const floor=(m:LabMaterial,x0:number,x1:number,z0:number,z1:number)=>flat.box(m,x0,x1,Y+.012,Y+.018,z0,z1,{sides:false});
 floor(mats.pavement,76.2,139.8,-150,-92.2);
 floor(mats.asphalt,96,139.5,-117.8,-92.5);
 floor(mats.paint('#a3a18e'),92.3,135.7,-141.7,-118.3);
 const rail=(r:DepotFixture,h:number)=>{
  box(steel,r.minX,r.maxX,.02,.14,r.minZ,r.maxZ);
  const xLong=r.maxX-r.minX>r.maxZ-r.minZ;
  for(const x of [r.minX,r.maxX-.035])for(const z of [r.minZ,r.maxZ-.035])box(steel,x,x+.035,.14,h,z,z+.035);
  for(let y=.4;y<h;y+=.28){
   if(xLong)box(steel,r.minX,r.maxX,y,y+.018,r.minZ,r.minZ+.025);
   else box(steel,r.minX,r.minX+.025,y,y+.018,r.minZ,r.maxZ);
  }
  const len=xLong?r.maxX-r.minX:r.maxZ-r.minZ;
  for(let t=0;t<=len;t+=.22){if(xLong)box(steel,r.minX+t,Math.min(r.minX+t+.018,r.maxX),.14,h,r.minZ,r.minZ+.025);else box(steel,r.minX,r.minX+.025,.14,h,r.minZ+t,Math.min(r.minZ+t+.018,r.maxZ));}
 };
 for(const r of depotFixtures()){
  const {minX:x0,maxX:x1,minZ:z0,maxZ:z1,height:h}=r;
  switch(r.kind){
   case 'wall':box(concrete,x0,x1,0,1.15,z0,z1);box(mats.ribbed('#c9c9b9'),x0,x1,1.15,h,z0,z1);box(ink,x0,x1,1.12,1.38,z0-.012,z1+.012);break;
   case 'booth':box(concrete,x0,x1,0,.95,z0,z1);box(mats.glass(),x0,x1,.95,2.15,z0,z1);box(ink,x0,x1,2.15,h,z0,z1);for(const x of [x0,x1-.035])box(ink,x,x+.035,.95,2.15,z0,z1);break;
   case 'column':box(steel,x0,x1,0,h,z0,z1);box(yellow,x0,x1,0,1.25,z0,z1);for(let y=.2;y<1.2;y+=.3)box(ink,x0,x1,y,y+.1,z0-.004,z1+.004);break;
   case 'fence':case 'guard':rail(r,h);break;
   case 'cage':
    box(steel,x0,x1,.06,.18,z0,z1);
    for(const x of [x0,x1-.03])for(const z of [z0,z1-.03])box(steel,x,x+.03,.18,h,z,z+.03);
    for(let y=.4;y<h;y+=.25){box(steel,x0,x1,y,y+.018,z0,z0+.025);for(const x of [x0,x1-.025])box(steel,x,x+.025,y,y+.018,z0,z1);}
    for(let x=x0;x<x1;x+=.24)box(steel,x,x+.018,.18,h,z0,z0+.018);
    break;
   case 'table':case 'belt':
    box(r.kind==='belt'?mats.paint('#303b37'):mats.paint('#8a9390',.3),x0,x1,h-.1,h,z0,z1);
    for(const x of [x0+.05,x1-.12])for(const z of [z0+.05,z1-.12])box(steel,x,x+.07,0,h-.1,z,z+.07);
    if(r.kind==='belt')for(let x=x0+.1;x<x1;x+=.35)line([x,h+.015,z0+.05],[x,h+.015,z1-.05],.07,mats.paint('#9ca7a3',.3));
    break;
   case 'rack':for(const x of [x0,x1-.08])for(const z of [z0,z1-.08])box(steel,x,x+.08,0,h,z,z+.08);for(const y of [.2,1.5,2.8,h])box(yellow,x0,x1,y-.08,y,z0,z1);break;
   case 'parked':break; // Existing ART-001 decoy rendered by main.ts, footprint shared here.
  }
 }
 // Pitched, corrugated industrial roof on trusses. Roof is a separate render group for inspection.
 const roof=new BatchSet();const tr=(p:P3):P3=>{const q=depotWorld(p[0],p[2]);return[q.x,p[1],q.z]};roof.setTransform(tr);
 const roofMat=mats.ribbed('#8a9186');
 roof.of(roofMat).quad([91.4,Y+7.8,-117.3],[136.6,Y+7.8,-117.3],[136.6,Y+9.2,-130],[91.4,Y+9.2,-130],22,6);
 roof.of(roofMat).quad([91.4,Y+9.2,-130],[136.6,Y+9.2,-130],[136.6,Y+7.8,-142.7],[91.4,Y+7.8,-142.7],22,6);
 roofMat.material.backFaceCulling=false;
 for(const x of [92.6,106,120,135.4]){
  line([x,7.65,-141.3],[x,7.65,-118.7],.13);line([x,7.7,-141.3],[x,9.08,-130],.12);line([x,9.08,-130],[x,7.7,-118.7],.12);
  for(let z=-140;z<-119;z+=2.5){line([x,7.65,z],[x,8.85-Math.abs(z+130)*.1,z+1],.05);}
 }
 for(const x of DEPOT.docks){
  box(mats.ribbed('#a5aca2'),x-1.9,x+1.9,3.4,7.8,-118.3,-118);
  box(steel,x-1.98,x-1.9,0,3.4,-118.4,-117.9);box(steel,x+1.9,x+1.98,0,3.4,-118.4,-117.9);
  box(mats.ribbed('#5d716b'),x-1.88,x+1.88,2.95,3.4,-118.3,-118.1);
  sign(`dock-${x}`,`${String(DEPOT.docks.indexOf(x)+1).padStart(2,'0')} · ${x===128?'CAMINHÃO':x===104?'RETIRADA ROTA 01':x===96?'ACESSO A PÉ':'RESERVA'}`,x-1.8,x+1.8,-117.85,3.6,.65,x===128?'#8c5735':'#284e4b');
  floor(yellow,x-1.9,x+1.9,-117.5,-117.32);
  for(const dx of [-2.1,2.1])box(mats.paint('#3c4038'),x+dx-.07,x+dx+.07,.4,1,-118,-117.8);
 }
 // Gatehouse roof, doorway, signage; public walk stays separate from the vehicle gate.
 box(ink,95.7,99.6,2.7,2.85,-98.8,-94.5);
 sign('portaria','PORTARIA · CONTROLE',96,99.3,-94.7,2.12,.5);
 sign('entry','ENTRADA / SAÍDA · 10 km/h',100,112,-92.1,3.3,.85);
 line([99.8,2.8,-92.3],[99.8,4.3,-92.3],.1);line([112.2,2.8,-92.3],[112.2,4.3,-92.3],.1);
 sign('main','BREJO ALEGRE • CENTRO DE DISTRIBUIÇÃO',98,132,-117.85,5.4,1.45);
 // Floor layout: future cars 3×5.4 m, motorcycles 1.8×3.2 m, protected 1.8 m footway.
 floor(mats.paint('#466653'),92.55,94.3,-120.2,-92.6);
 for(let z=-114;z<-99;z+=1.2)floor(mats.lineWhite,94.4,99,z,z+.35);
 for(const r of [...CAR_PARKING,...MOTO_PARKING]){
  floor(mats.lineWhite,r.minX,r.minX+.07,r.minZ,r.maxZ);floor(mats.lineWhite,r.maxX-.07,r.maxX,r.minZ,r.maxZ);floor(mats.lineWhite,r.minX,r.maxX,r.minZ,r.minZ+.07);
 }
 sign('motos','DESCARGA • MOTOS',78,91,-113.3,1.8,.6);
 // Paint-only label stands at ground edge have no physical posts in the circulation lane.
 for(const [name,text,x,z,w]of [['receiving','01 • RECEBIMENTO',101,-120.8,7],['sorting','02 • CONFERÊNCIA / TRIAGEM',111,-128.9,11],['regions','03 • CENTRO / BREJO ALEGRE',123,-135.3,10],['dispatch','04 • EXPEDIÇÃO / ROTA 01',104,-122,7]] as const){
  sign(name,text,x-w/2,x+w/2,z,2.65,.65);
 }
 for(const x of [100,112,130])for(const z of [-124,-138]){line([x,7.6,z],[x,6.6,z],.015);box(mats.glow('#f5dfab'),x-.55,x+.55,6.45,6.55,z-.18,z+.18);}
 for(const x of [99.4,134]){box(mats.paint('#b34e31'),x,x+.2,.5,1.2,-118.55,-118.4);}
 // Localized concrete patches and expansion joints, never loose cargo disguised as decoration.
 for(let x=94;x<136;x+=4)floor(mats.paint('#858b7f'),x,x+.018,-141.5,-118.5);
 for(let z=-140;z<-118;z+=4)floor(mats.paint('#858b7f'),92.5,135.5,z,z+.018);
 for(const [x,z]of [[100,-124],[128,-121],[104,-120]])floor(mats.paint('#92917c'),x-1,x+1,z-.7,z+.7);
 const gates:Mesh[]=[];
 for(const [i,r]of gateLeaves(0).entries()){
  const leaf=new BatchSet();leaf.setTransform(tr);
  for(const y of [.2,1.1,2.3])leaf.box(mats.paint('#466057'),r.minX,r.maxX,Y+y,Y+y+.06,r.minZ,r.maxZ);
  for(let x=r.minX;x<r.maxX;x+=.18)leaf.box(mats.paint('#466057'),x,x+.035,Y+.2,Y+2.35,r.minZ,r.maxZ);
  gates.push(...leaf.build(`art002-gate-${i}`,scene));
 }
 return {roof:roof.build('art002-roof',scene),gates};
}
