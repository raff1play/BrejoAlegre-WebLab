import type {Scene} from '@babylonjs/core/scene';
import {Mesh} from '@babylonjs/core/Meshes/mesh';
import '@babylonjs/core/Meshes/thinInstanceMesh';
import {Matrix} from '@babylonjs/core/Maths/math.vector';
import {StandardMaterial} from '@babylonjs/core/Materials/standardMaterial';
import {DynamicTexture} from '@babylonjs/core/Materials/Textures/dynamicTexture';
import {VertexData} from '@babylonjs/core/Meshes/mesh.vertexData';
import {VertexBuffer} from '@babylonjs/core/Buffers/buffer';
import {Color3} from '@babylonjs/core/Maths/math.color';
import {BatchSet} from '../../world/geometry';
import type {Materials} from '../../world/materials';
import {depotWorld} from '../../world/city/cityPlan';
import type {Parcel} from '../../core/delivery/parcels';

/** One instanced box batch + one ID label atlas. No decorative cargo and no state mutation. */
export class DepotParcels {
 private boxes:Mesh;
 private labels:Mesh;
 private ids:string[]=[];
 private matrices=new Float32Array(0);
 private positions: number[]=[];
 readonly visibleIds:string[]=[];
 constructor(private scene:Scene,private mats:Materials){
  const b=new BatchSet();b.box(mats.paint('#ba925b'),-.23,.23,0,.28,-.17,.17);
  b.box(mats.paint('#ddd0ad'),-.035,.035,.281,.284,-.17,.17);
  this.boxes=b.build('art002-live-parcels',scene)[0]!;this.boxes.alwaysSelectAsActiveMesh=true;this.boxes.isPickable=false;
  this.labels=new Mesh('art002-parcel-ids',scene);this.labels.alwaysSelectAsActiveMesh=true;this.labels.isPickable=false;
 }
 private initialize(parcels:readonly Parcel[]):void{
  this.ids=parcels.map(p=>p.id);this.matrices=new Float32Array(parcels.length*16);this.positions=[];
  const rows=Math.max(1,Math.ceil(parcels.length/4));
  const tx=new DynamicTexture('art002-id-atlas',{width:1024,height:rows*64},this.scene,false);const c=tx.getContext() as unknown as CanvasRenderingContext2D;
  c.fillStyle='#efe9d6';c.fillRect(0,0,1024,rows*64);c.fillStyle='#242e29';c.textAlign='center';c.font='bold 27px monospace';
  const uvs:number[]=[],normals:number[]=[],indices:number[]=[];
  parcels.forEach((p,i)=>{const x=(i%4)*256,y=Math.floor(i/4)*64;c.fillText(p.id,x+128,y+30);c.font='16px sans-serif';c.fillText(p.platform+' • '+p.region,x+128,y+53);c.font='bold 27px monospace';
   const u=(i%4)/4,v=1-(Math.floor(i/4)+1)/rows,du=1/4,dv=1/rows;
   this.positions.push(...new Array(12).fill(0));uvs.push(u,v,u+du,v,u+du,v+dv,u,v+dv);normals.push(0,1,0,0,1,0,0,1,0,0,1,0);indices.push(i*4,i*4+1,i*4+2,i*4,i*4+2,i*4+3);
  });tx.update();
  const m=new StandardMaterial('art002-id-labels',this.scene);m.diffuseTexture=tx;m.emissiveColor=Color3.White();m.disableLighting=true;m.backFaceCulling=false;
  this.labels.material=m;const data=new VertexData();data.positions=this.positions;data.normals=normals;data.uvs=uvs;data.indices=indices;data.applyToMesh(this.labels,true);
  this.boxes.thinInstanceSetBuffer('matrix',this.matrices,16,false);
  this.boxes.metadata={ids:this.ids,capacity:parcels.length};
  void this.mats;
 }
 update(parcels:readonly Parcel[],near=true):void{
  this.boxes.setEnabled(near);this.labels.setEnabled(near);if(!near){this.visibleIds.length=0;return;}
  if(!parcels.length)return;if(this.ids.length!==parcels.length)this.initialize(parcels);
  this.visibleIds.length=0;
  for(let i=0;i<parcels.length;i++){
   const p=parcels[i]!,pos=p.position;
   const visible=!!pos&&!['maos','bau','loja','destinatario'].includes(p.place);
   if(visible)this.visibleIds.push(p.id);
   const at=visible?depotWorld(pos!.x,pos!.z):{x:0,z:0},y=visible?pos!.y+.15:-100;
   const matrix=Matrix.Translation(at.x,y,at.z);matrix.copyToArray(this.matrices,i*16);
   const corners=[[-.19,-.12],[.19,-.12],[.19,.12],[-.19,.12]];
   corners.forEach(([dx,dz],k)=>{const w=visible?depotWorld(pos!.x+dx!,pos!.z+dz!):{x:0,z:0};const n=i*12+k*3;this.positions[n]=w.x;this.positions[n+1]=y+.287;this.positions[n+2]=w.z;});
  }
  this.boxes.thinInstanceBufferUpdated('matrix');this.boxes.thinInstanceCount=parcels.length;
  this.labels.updateVerticesData(VertexBuffer.PositionKind,this.positions,false,false);
 }
}
