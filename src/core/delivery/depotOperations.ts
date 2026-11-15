import {SECTORS,SECTOR_DATA} from './sectors.ts';
import { depotPath, MIXED_LOAD, DISPATCH_DOCK, REGIONAL_CAGES } from '../../world/city/depotPlan.ts';
import { advance, move, type Parcel, type ParcelPosition } from './parcels.ts';

export type AssistantId='npc1'|'npc2'|'npc3';
export type WorkerRole='conferente'|'conferente-2'|'descarregador-1'|'descarregador-2'|'separador-1'|'separador-2'|'separador-3'|'expedidor'|'expedidor-2'|'supervisor'|`auxiliar-${AssistantId}`;
export type DepotWorker={role:WorkerRole;x:number;z:number;yaw:number;activity:'idle'|'work'|'carry';parcel:string|null;task:DepotTask|null;active:boolean};
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
  {role:'separador-2',x:120,z:-133},{role:'expedidor',x:104,z:-121.3},{role:'supervisor',x:124,z:-133},
  {role:'conferente-2',x:102.2,z:-121.1},{role:'separador-3',x:112,z:-128.35},{role:'expedidor-2',x:110.5,z:-123.8},
 ].map(w=>({...w,role:w.role as WorkerRole,yaw:Math.PI,activity:'idle',parcel:null,task:null,active:true}));
 /** Couriers assist in the SAME parcel controller, and never acquire a duplicate visual body. */
 private readonly assistants:DepotWorker[]=['npc1','npc2','npc3'].map((id,i)=>({
  role:`auxiliar-${id}` as WorkerRole,x:98+i*4,z:-123,yaw:Math.PI,activity:'idle',parcel:null,task:null,active:false
 }));
 get allWorkers():DepotWorker[]{return [...this.workers,...this.assistants];}
 assistant(id:AssistantId):DepotWorker{return this.assistants.find(w=>w.role===`auxiliar-${id}`)!;}
 /** A courier may leave to collect its sack only after completing its current physical parcel task. */
 setAssistant(id:AssistantId,enabled:boolean,at?:{x:number;z:number}):boolean {
  const w=this.assistant(id);
  if(!enabled){if(w.task)return false;w.active=false;w.activity='idle';return true;}
  if(!w.active){if(at){w.x=at.x;w.z=at.z;}w.active=true;}
  return true;
 }
 readonly errors:string[]=[];
 truckAvailable=false;
 private handoffIndex=0;
 private receivingSlot(parcels:readonly Parcel[]):ParcelPosition|null {
  const used=[...parcels.filter(p=>p.place==='recebimento'||p.place==='conferencia').map(p=>p.position),...this.allWorkers.filter(w=>w.task?.kind==='truck').map(w=>w.task!.destination)];
  for(let i=0;i<12;i++){const at=depotReceivingPosition(i);if(!used.some(p=>p&&Math.hypot(p.x-at.x,p.y-at.y,p.z-at.z)<.1))return at;}return null;
 }
 receive(p:Parcel,hour:number,parcels?:readonly Parcel[]):boolean {
  if(p.place!=='maos'||p.state!=='EM_TRANSPORTE')return false;
  const at=parcels?this.receivingSlot(parcels):depotReceivingPosition(this.handoffIndex++);
  if(!at)return false;move(p,'recebimento','recebimento',hour,at);return true;
 }
 private plan(w:DepotWorker,p:Parcel,kind:TaskKind,at:{x:number;z:number},to:{x:number;z:number},destination:ParcelPosition):void {
  const origin=p.position??{x:128,y:.6,z:-119.8};
  w.parcel=p.id;w.task={id:p.id,kind,stage:'approach',route:depotPath(w,at),timer:0,origin:{...origin},destination,to,expected:p.place,state:p.state};
 }
 private assign(w:DepotWorker,parcels:readonly Parcel[]):void {
  const claimed=new Set(this.allWorkers.filter(w=>w.task).map(w=>w.parcel));
  const pick=(f:(p:Parcel)=>boolean)=>parcels.find(p=>!claimed.has(p.id)&&f(p));
  const sectorIndex=(p:Parcel)=>p.sector?SECTORS.indexOf(p.sector):p.region==='Centro'?0:1;
  const cage=(p:Parcel)=>REGIONAL_CAGES[sectorIndex(p)]!;
  const slot=(p:Parcel)=>parcels.filter(q=>p.sector?q.sector===p.sector:q.region===p.region).indexOf(p);
  let p:Parcel|undefined;
  switch(w.role){
   case 'descarregador-1':p=this.truckAvailable?pick(p=>p.place==='caminhao'):undefined;if(p){const at=this.receivingSlot(parcels);if(at)this.plan(w,p,'truck',{x:128,z:-119.4},receivingStand,at);}break;
   case 'conferente':case 'conferente-2':p=pick(p=>p.place==='recebimento'&&p.state==='EM_TRANSPORTE');if(p)this.plan(w,p,'check',receivingStand,receivingStand,p.position!);break;
   case 'descarregador-2':case 'auxiliar-npc1':{
     const lanes=[-129.6,-130.25,-130.9];
     const occupied=[...parcels.filter(p=>p.place==='triagem'&&p.state==='RECEBIDO_BASE').map(p=>p.position?.z),
      ...this.allWorkers.filter(q=>q.task?.kind==='feed').map(q=>q.task!.destination.z)];
     const lane=lanes.find(z=>!occupied.some(v=>v!==undefined&&Math.abs(v-z)<.12));
     if(lane!==undefined){p=pick(p=>p.place==='conferencia'&&p.state==='RECEBIDO_BASE');if(p)this.plan(w,p,'feed',receivingStand,feedStand,{x:105.7,y:.93,z:lane});}
     break;
    }
   case 'separador-1':case 'separador-3':case 'auxiliar-npc2':
     p=pick(p=>p.place==='triagem'&&p.state==='RECEBIDO_BASE');
     if(p)this.plan(w,p,'belt',{x:110,z:-128.35},{x:110,z:-128.35},{x:116.3,y:.93,z:p.position?.z??-129.6});
     break;
   case 'separador-2':case 'auxiliar-npc3':p=pick(p=>p.place==='triagem'&&p.state==='TRIADO');if(p){const c=cage(p);this.plan(w,p,'region',outStand,{x:(c.minX+c.maxX)/2,z:-134.65},{x:c.minX+.45+(slot(p)%3)*.85,y:.2+Math.floor(slot(p)/6)*.3,z:-136.1-(Math.floor(slot(p)/3)%2)*.8});}break;
   case 'supervisor':case 'expedidor':case 'expedidor-2':p=pick(p=>p.place==='gaiola'&&p.state==='TRIADO');if(p){const c=cage(p);const n=slot(p),x=p.sector?SECTOR_DATA[p.sector].x:104;this.plan(w,p,'dispatch',{x:(c.minX+c.maxX)/2,z:-134.65},p.sector?{x,z:-121.3}:dispatchStand,{x:x-.65+(n%3)*.65,y:.46+Math.floor(n/6)*.3,z:-119.55-(Math.floor(n/3)%2)*.55});}break;
  }
 }
 private walk(w:DepotWorker,dt:number):boolean {
  const t=w.task!.route[0];if(!t)return true;
  const dx=t.x-w.x,dz=t.z-w.z,d=Math.hypot(dx,dz),s=Math.min(d,2.05*dt);
  if(d>1e-8){w.x+=dx/d*s;w.z+=dz/d*s;w.yaw=Math.atan2(dx,dz);}
  if(d<=s+.001)w.task!.route.shift();return w.task!.route.length===0;
 }
 update(parcels:readonly Parcel[],hour:number,seconds:number):void {
  if(!(seconds>0)||hour>=21)return;
  const dt=Math.min(seconds,.4);
  for(const w of this.allWorkers){
   if(!w.active)continue;
   w.activity='idle';if(!w.task)this.assign(w,parcels);
   const t=w.task;if(!t)continue;const p=parcels.find(p=>p.id===t.id);
   if(!p||p.place!==t.expected||p.state!==t.state){this.errors.push(`${t.id}: tarefa invalidada ${t.kind}`);w.task=null;w.parcel=null;continue;}
   switch(t.stage){
    case 'approach':
     if(!this.walk(w,dt))break;
     w.yaw=t.kind==='truck'?0:Math.PI;w.activity='work';t.timer=0;
     if(t.kind==='check'){move(p,'conferencia',w.role,hour,p.position);t.expected='conferencia';t.stage='process';}
     else if(t.kind==='belt')t.stage='process';
     else {move(p,'transferencia',w.role,hour,t.origin);t.expected='transferencia';t.stage='lift';}
     break;
    case 'lift':w.activity='work';t.timer+=dt;p.position=mix(t.origin,hand(w),Math.min(1,t.timer/.7));if(t.timer>=.7){t.stage='carry';t.route=depotPath(w,t.to);t.timer=0;}break;
    case 'carry':w.activity='carry';if(this.walk(w,dt)){t.stage='drop';t.origin=hand(w);t.timer=0;}p.position=hand(w);break;
    case 'drop':
     w.activity='work';t.timer+=dt;p.position=mix(t.origin,t.destination,Math.min(1,t.timer/.7));if(t.timer<.7)break;
     if(t.kind==='truck')move(p,'recebimento','recebimento',hour,t.destination);
     if(t.kind==='feed')move(p,'triagem',w.role,hour,t.destination);
     if(t.kind==='region')move(p,'gaiola',`gaiola:${p.region}`,hour,t.destination);
     if(t.kind==='dispatch'){
      p.dock=p.sector?SECTOR_DATA[p.sector].dock:DISPATCH_DOCK;p.load=p.sector?SECTOR_DATA[p.sector].load:MIXED_LOAD;move(p,'doca',w.role,hour,t.destination);
      advance(p,'NA_SACA',w.role,hour);move(p,'saca',w.role,hour,t.destination);
     }
     w.task=null;w.parcel=null;break;
    case 'process':
     w.activity='work';t.timer+=dt;
     if(t.kind==='check'){if(t.timer<2.4)break;advance(p,'RECEBIDO_BASE',w.role,hour);}
     else {p.position=mix(t.origin,t.destination,Math.min(1,t.timer/13));if(t.timer<13)break;advance(p,'TRIADO',w.role,hour);}
     w.task=null;w.parcel=null;break;
   }
  }
 }
}
