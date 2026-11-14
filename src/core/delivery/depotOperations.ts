import { depotPath, MIXED_LOAD, DISPATCH_DOCK, REGIONAL_CAGES } from '../../world/city/depotPlan.ts';
import { advance, move, type Parcel, type ParcelPosition } from './parcels.ts';

export type WorkerRole='conferente'|'descarregador-1'|'descarregador-2'|'separador-1'|'separador-2'|'expedidor';
export type DepotWorker={role:WorkerRole;x:number;z:number;yaw:number;activity:'idle'|'work'|'carry';parcel:string|null;task:DepotTask|null};
type TaskKind='truck'|'check'|'feed'|'belt'|'region'|'dispatch';
export type DepotTask={id:string;kind:TaskKind;stage:'approach'|'lift'|'carry'|'drop'|'process';route:{x:number;z:number}[];timer:number;origin:ParcelPosition;destination:ParcelPosition;to:{x:number;z:number};expected:Parcel['place'];state:Parcel['state']};
const receivingStand={x:101,z:-120.7},feedStand={x:105.7,z:-128.35},outStand={x:116.3,z:-128.35},dispatchStand={x:104,z:-121.3};
const mix=(a:ParcelPosition,b:ParcelPosition,t:number):ParcelPosition=>({x:a.x+(b.x-a.x)*t,y:a.y+(b.y-a.y)*t,z:a.z+(b.z-a.z)*t});
export const depotReceivingPosition=(index:number):ParcelPosition=>({x:99.55+(index%6)*.55,y:.95+Math.floor(index/6)*.28,z:-122.3});
const hand=(w:DepotWorker):ParcelPosition=>({x:w.x+Math.sin(w.yaw)*.4,y:1.1,z:w.z+Math.cos(w.yaw)*.4});
/** The ONLY depot processing controller. Visuals read these positions; never advance the parcel. */
export class DepotOperations {
 readonly workers:DepotWorker[]=[
  {role:'conferente',x:101,z:-120.7},{role:'descarregador-1',x:128,z:-119.4},
  {role:'descarregador-2',x:104,z:-125},{role:'separador-1',x:110,z:-128.35},
  {role:'separador-2',x:120,z:-133},{role:'expedidor',x:104,z:-121.3},
 ].map(w=>({...w,role:w.role as WorkerRole,yaw:Math.PI,activity:'idle',parcel:null,task:null}));
 readonly errors:string[]=[];
 truckAvailable=false;
 private handoffIndex=0;
 receive(p:Parcel,hour:number):void {
  move(p,'recebimento','recebimento',hour,depotReceivingPosition(this.handoffIndex++));
 }
 private plan(w:DepotWorker,p:Parcel,kind:TaskKind,at:{x:number;z:number},to:{x:number;z:number},destination:ParcelPosition):void {
  const origin=p.position??{x:128,y:.6,z:-119.8};
  w.parcel=p.id;w.task={id:p.id,kind,stage:'approach',route:depotPath(w,at),timer:0,origin:{...origin},destination,to,expected:p.place,state:p.state};
 }
 private assign(w:DepotWorker,parcels:readonly Parcel[]):void {
  const claimed=new Set(this.workers.filter(w=>w.task).map(w=>w.parcel));
  const pick=(f:(p:Parcel)=>boolean)=>parcels.find(p=>!claimed.has(p.id)&&f(p));
  const cage=(p:Parcel)=>REGIONAL_CAGES[p.region==='Centro'?0:1]!;
  let p:Parcel|undefined;
  switch(w.role){
   case 'descarregador-1':p=this.truckAvailable?pick(p=>p.place==='caminhao'):undefined;if(p)this.plan(w,p,'truck',{x:128,z:-119.4},receivingStand,depotReceivingPosition(this.handoffIndex++));break;
   case 'conferente':p=pick(p=>p.place==='recebimento'&&p.state==='EM_TRANSPORTE');if(p)this.plan(w,p,'check',receivingStand,receivingStand,p.position!);break;
   case 'descarregador-2':if(parcels.some(p=>p.place==='triagem'&&p.state==='RECEBIDO_BASE'))break;p=pick(p=>p.place==='conferencia'&&p.state==='RECEBIDO_BASE');if(p)this.plan(w,p,'feed',receivingStand,feedStand,{x:105.7,y:.93,z:-129.6});break;
   case 'separador-1':if(parcels.some(p=>p.place==='triagem'&&p.state==='TRIADO'))break;p=pick(p=>p.place==='triagem'&&p.state==='RECEBIDO_BASE');if(p)this.plan(w,p,'belt',{x:110,z:-128.35},{x:110,z:-128.35},{x:116.3,y:.93,z:-129.6});break;
   case 'separador-2':p=pick(p=>p.place==='triagem'&&p.state==='TRIADO');if(p){const c=cage(p);this.plan(w,p,'region',outStand,{x:(c.minX+c.maxX)/2,z:-134.65},{x:c.minX+.35+(parcels.indexOf(p)%4)*.55,y:.25+Math.floor(parcels.indexOf(p)/4)*.3,z:-136.2});}break;
   case 'expedidor':p=pick(p=>p.place==='gaiola'&&p.state==='TRIADO');if(p){const c=cage(p);const n=parcels.indexOf(p);this.plan(w,p,'dispatch',{x:(c.minX+c.maxX)/2,z:-134.65},dispatchStand,{x:103.3+(n%3)*.55,y:.46+Math.floor(n/3)*.32,z:-119.8});}break;
  }
 }
 private walk(w:DepotWorker,dt:number):boolean {
  const t=w.task!.route[0];if(!t)return true;
  const dx=t.x-w.x,dz=t.z-w.z,d=Math.hypot(dx,dz),s=Math.min(d,1.65*dt);
  if(d>1e-8){w.x+=dx/d*s;w.z+=dz/d*s;w.yaw=Math.atan2(dx,dz);}
  if(d<=s+.001)w.task!.route.shift();return w.task!.route.length===0;
 }
 update(parcels:readonly Parcel[],hour:number,seconds:number):void {
  if(!(seconds>0)||hour>=21)return;
  const dt=Math.min(seconds,.4);
  for(const w of this.workers){
   w.activity='idle';if(!w.task)this.assign(w,parcels);
   const t=w.task;if(!t)continue;const p=parcels.find(p=>p.id===t.id);
   if(!p||p.place!==t.expected||p.state!==t.state){this.errors.push(`${t.id}: tarefa invalidada ${t.kind}`);w.task=null;w.parcel=null;continue;}
   switch(t.stage){
    case 'approach':
     if(!this.walk(w,dt))break;
     w.yaw=t.kind==='truck'?0:Math.PI;w.activity='work';t.timer=0;
     if(t.kind==='check'){move(p,'conferencia','conferente',hour,p.position);t.expected='conferencia';t.stage='process';}
     else if(t.kind==='belt')t.stage='process';
     else {move(p,'transferencia',w.role,hour,t.origin);t.expected='transferencia';t.stage='lift';}
     break;
    case 'lift':w.activity='work';t.timer+=dt;p.position=mix(t.origin,hand(w),Math.min(1,t.timer/.7));if(t.timer>=.7){t.stage='carry';t.route=depotPath(w,t.to);t.timer=0;}break;
    case 'carry':w.activity='carry';if(this.walk(w,dt)){t.stage='drop';t.origin=hand(w);t.timer=0;}p.position=hand(w);break;
    case 'drop':
     w.activity='work';t.timer+=dt;p.position=mix(t.origin,t.destination,Math.min(1,t.timer/.7));if(t.timer<.7)break;
     if(t.kind==='truck')move(p,'recebimento','recebimento',hour,t.destination);
     if(t.kind==='feed')move(p,'triagem','separador-1',hour,t.destination);
     if(t.kind==='region')move(p,'gaiola',`gaiola:${p.region}`,hour,t.destination);
     if(t.kind==='dispatch'){
      p.dock=DISPATCH_DOCK;p.load=MIXED_LOAD;move(p,'doca','expedidor',hour,t.destination);
      advance(p,'NA_SACA','expedidor',hour);move(p,'saca','expedidor',hour,t.destination);
     }
     w.task=null;w.parcel=null;break;
    case 'process':
     w.activity='work';t.timer+=dt;
     if(t.kind==='check'){if(t.timer<2.4)break;advance(p,'RECEBIDO_BASE','conferente',hour);}
     else {p.position=mix(t.origin,t.destination,Math.min(1,t.timer/16));if(t.timer<16)break;advance(p,'TRIADO','separador-1',hour);}
     w.task=null;w.parcel=null;break;
   }
  }
 }
}
