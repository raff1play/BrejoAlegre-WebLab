import type { Scene } from '@babylonjs/core/scene';
import type { Mesh } from '@babylonjs/core/Meshes/mesh';
import { TransformNode } from '@babylonjs/core/Meshes/transformNode';
import { BatchSet } from '../../world/geometry';
import { rodPart } from '../../world/modelParts';
import type { Materials } from '../../world/materials';
import { depotWorld, depotYaw } from '../../world/city/cityPlan';
import type { SupplierVan } from '../../core/delivery/supplierVan';
/** Original, fictitious yellow logistics van. Empty space inside contains the actual parcel views. */
export class SupplierVanView {
 readonly meshes:Mesh[];private readonly leaves:TransformNode[]=[];private readonly shutter:Mesh[];
 constructor(scene:Scene,mats:Materials){
  const b=new BatchSet(),y=mats.paint('#eac431'),black=mats.paint('#282f31'),glass=mats.glass();
  const transform=(p:readonly[number,number,number]):[number,number,number]=>{const q=depotWorld(p[0],p[2]);return[q.x,p[1]+.15,q.z]};b.setTransform(transform);
  b.box(black,126.85,129.15,.55,.85,-117.65,-111.1);
  b.box(y,126.85,129.15,.85,1.05,-117.65,-111.1);
  for(const x of [126.85,129.05])b.box(y,x,x+.1,1.05,2.85,-117.65,-113.3);
  b.box(y,126.85,129.15,2.75,2.88,-117.65,-112.4);
  b.box(y,126.85,129.15,.85,1.55,-113.3,-111.1);
  b.box(glass,126.96,129.04,1.55,2.5,-111.25,-111.15);
  for(const x of [126.86,129.08])b.box(glass,x,x+.06,1.6,2.5,-113.15,-111.35);
  b.box(y,126.85,129.15,2.5,2.75,-113.3,-111.1);
  b.box(black,126.78,129.22,.5,.7,-111.15,-110.95);
  for(const x of [126.95,128.65]){b.box(mats.glow('#fff3cc'),x,x+.35,1,1.2,-111.14,-111.12);b.box(mats.paint('#c34129'),x,x+.18,1,1.5,-117.7,-117.66);}
  for(const x of [126.72,129.13])for(const z of [-116.6,-112.5])b.absorb(black,rodPart(scene,[x,.55,z],[x+.15,.55,z],.91,.91,12));
  for(const x of [126.6,129.15])b.box(black,x,x+.25,1.75,1.95,-112,-111.65);
  const sign=mats.sign('log003-van','#eac431','#284e4b',[{text:'BREJO • CARGAS',size:.65,color:'#284e4b',weight:'800'}],3.5,128);
  b.of(sign).quad([129.16,1.55,-117],[129.16,1.55,-114],[129.16,2.3,-114],[129.16,2.3,-117],1,1);
  b.box(black,127.2,128.8,.05,.12,-118.45,-117.8);
  this.meshes=b.build('log003-van',scene);
  for(const side of [-1,1]){
   const leaf=new TransformNode('van-rear-hinge',scene),q=depotWorld(128+side*1.1,-117.65);leaf.position.set(q.x,.15,q.z);leaf.rotation.y=depotYaw(0);
   const s=new BatchSet();s.box(y,side<0?0:-1.1,side<0?1.1:0,1.05,2.75,-.05,.05);
   const ms=s.build('van-door',scene);ms.forEach(m=>{m.parent=leaf;this.meshes.push(m)});this.leaves.push(leaf);
  }
  const s=new BatchSet();s.setTransform(transform);s.box(mats.ribbed('#536c63'),126.12,129.88,0,3.35,-118.28,-118.12);this.shutter=s.build('log003-d05-door',scene);
 }
 update(v:SupplierVan,near:boolean):void{
  this.meshes.forEach(m=>m.setEnabled(v.present&&near));
  this.leaves.forEach((n,i)=>n.rotation.y=depotYaw(0)+(i===0?1:-1)*v.door*Math.PI*.48);
  this.shutter.forEach(m=>{m.position.y=v.door*3.4;m.setEnabled(near)});
 }
}
