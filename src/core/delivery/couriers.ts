import {depotWorld,depotYaw,storeLayout,type StoreKind} from '../../world/city/cityPlan.ts';
import {COURIER_BAYS,depotPath,DEPOT_POINTS} from '../../world/city/depotPlan.ts';
import {courierFootRoute,courierRoadRoute} from './courierRoutes.ts';
import {SECTOR_DATA,type Sector} from './sectors.ts';
import type {ActorId} from './dailyDemand.ts';
import {advance,move,type Parcel} from './parcels.ts';
import type {LogisticsDay} from './logisticsDay.ts';
type Point={x:number;z:number;yaw:number};
export type CourierState='waiting'|'to-store'|'parking'|'walk-counter'|'pickup'|'walk-bike'|'stow'|'return-base'|'unload'|'walk-receiving'|'deposit'|'walk-parking'|'waiting-load'|'walk-dock'|'take-load'|'return-load'|'ready'|'to-address'|'park-address'|'take-parcel'|'walk-address'|'handoff'|'return-address'|'complete'|'blocked';
export class Courier {
 readonly id:Exclude<ActorId,'jogador'>;readonly name:string;readonly sector:Sector;
 stores:StoreKind[]=[];storeIndex=0;state:CourierState='waiting';bike:Point;person:Point;route:{x:number;z:number}[]=[];stops:string[]=[];timer=0;error:string|null=null;routeLog:{from:{x:number;z:number};to:{x:number;z:number};points:{x:number;z:number}[]}[]=[];
 constructor(id:Exclude<ActorId,'jogador'>,name:string,sector:Sector){this.id=id;this.name=name;this.sector=sector;this.bike={...depotWorld(COURIER_BAYS[id].x,COURIER_BAYS[id].z),yaw:depotYaw(0)};this.person={...this.bike};}
 get riding():boolean{return ['waiting','to-store','parking','return-base','ready','to-address','park-address','complete'].includes(this.state);}
 hands(day:LogisticsDay):Parcel[]{return day.parcels.filter(p=>p.holder===this.id&&p.place==='maos');}
 trunk(day:LogisticsDay):Parcel[]{return day.parcels.filter(p=>p.holder===this.id&&p.place==='bau');}
 private drive(to:{x:number;z:number},fromBase=false,toBase=false):void{
  const gate=depotWorld(106,-87),bay=COURIER_BAYS[this.id],points:{x:number;z:number}[]=[];
  if(fromBase)points.push(depotWorld(bay.x,-107),depotWorld(106,-107),depotWorld(106,-96),gate);
  const street=courierRoadRoute(fromBase?gate:this.bike,toBase?gate:to);points.push(...street);
  if(toBase)points.push(depotWorld(106,-96),depotWorld(106,-107),depotWorld(bay.x,-107),to);
  this.routeLog.push({from:{...this.bike},to:{...to},points:points.map(p=>({...p}))});this.route=points;
 }
 private walk(to:{x:number;z:number},day:LogisticsDay,depot=false):void{
  if(depot){const inv=day.local(this.person),dest=day.local(to);this.route=depotPath(inv,dest).map(p=>depotWorld(p.x,p.z));}
  else this.route=courierFootRoute(this.person,to,day.options.free??(()=>true));
 }
 private travel(dt:number,day:LogisticsDay,drive:boolean):boolean{
  const p=drive?this.bike:this.person;let left=dt*(drive?8:1.65);
  while(left>0&&this.route.length){const next=this.route[0]!,dx=next.x-p.x,dz=next.z-p.z,d=Math.hypot(dx,dz),s=Math.min(d,left);
   const local=day.local({x:p.x+dx/(d||1)*s,z:p.z+dz/(d||1)*s});
   if(drive&&Math.abs(local.z+92.3)<2.2&&local.x>98&&local.x<114&&day.gateOpen<.95)return false;
   if(d>0){p.x+=dx/d*s;p.z+=dz/d*s;p.yaw=Math.atan2(dx,dz);}left-=s;if(d<=s+.001)this.route.shift();
  }
  return !this.route.length;
 }
 update(day:LogisticsDay,hour:number,dt:number):void{
  if(hour>=21||this.state==='blocked'||this.state==='complete')return;
  this.timer+=dt;
  const state=(s:CourierState)=>{this.state=s;this.timer=0;};
  const current=this.stores[this.storeIndex],store=current?day.storeOf(current):null;
  const atBike=()=>({x:this.bike.x-Math.sin(this.bike.yaw)*1.25,z:this.bike.z-Math.cos(this.bike.yaw)*1.25});
  const dock=()=>depotWorld(SECTOR_DATA[this.sector].x,-116.7);
  try{switch(this.state){
   case 'waiting':if(hour>=12&&store){this.drive(store.stop,true);state('to-store');}break;
   case 'to-store':if(this.travel(dt,day,true))state('parking');break;
   case 'parking':if(this.timer>=1){this.person={...this.bike};this.walk(storeLayout(store!).pickup,day);state('walk-counter');}break;
   case 'walk-counter':if(this.travel(dt,day,false))state('pickup');break;
   case 'pickup':if(this.timer>=1.3){const list=day.readyAt(current!).slice(0,4-this.hands(day).length);for(const p of list){advance(p,'COLETADO',this.id,hour);move(p,'maos',this.id,hour);}this.walk(atBike(),day);state('walk-bike');}break;
   case 'walk-bike':if(this.travel(dt,day,false))state('stow');break;
   case 'stow':if(this.timer>=1){for(const p of this.hands(day)){advance(p,'EM_TRANSPORTE',this.id,hour);move(p,'bau',this.id,hour);}
    if(day.readyAt(current!).length){this.walk(storeLayout(store!).pickup,day);state('walk-counter');}
    else if(++this.storeIndex<this.stores.length){this.drive(day.storeOf(this.stores[this.storeIndex]!).stop);state('to-store');}
    else{const bay=COURIER_BAYS[this.id];this.drive(depotWorld(bay.x,bay.z),false,true);state('return-base');}}break;
   case 'return-base':if(this.travel(dt,day,true)){this.bike.yaw=depotYaw(0);this.person={...atBike(),yaw:this.bike.yaw};state('unload');}break;
   case 'unload':if(this.timer>=1){const list=this.trunk(day).slice(0,4);if(!list.length){state('waiting-load');break;}for(const p of list)move(p,'maos',this.id,hour);this.walk(depotWorld(DEPOT_POINTS.receiving.x,DEPOT_POINTS.receiving.z),day,true);state('walk-receiving');}break;
   case 'walk-receiving':if(this.travel(dt,day,false))state('deposit');break;
   case 'deposit':if(this.timer>=1){for(const p of this.hands(day))day.depot.receive(p,hour,day.parcels);if(this.hands(day).length)break;this.walk(atBike(),day,true);state('walk-parking');}break;
   case 'walk-parking':if(this.travel(dt,day,false))state('unload');break;
   case 'waiting-load':if(day.canTakeLoad(this.id,hour)){this.walk(dock(),day,true);state('walk-dock');}break;
   case 'walk-dock':if(this.travel(dt,day,false))state('take-load');break;
   case 'take-load':if(this.timer>=1&&day.takeLoad(this.id,hour,this.person)){this.walk(atBike(),day,true);state('return-load');}break;
   case 'return-load':if(this.travel(dt,day,false)){for(const p of this.hands(day))move(p,'bau',this.id,hour);state('ready');}break;
   case 'ready':if(day.released&&this.timer>day.releaseDelay(this.id)){const next=day.byAddress.get(this.stops[0]!);if(next){this.drive(next.stop,true);state('to-address');}else state('complete');}break;
   case 'to-address':if(this.travel(dt,day,true))state('park-address');break;
   case 'park-address':if(this.timer>=1){this.person={...atBike(),yaw:this.bike.yaw};state('take-parcel');}break;
   case 'take-parcel':if(this.timer>=1){for(const p of this.trunk(day).filter(p=>p.destination===this.stops[0]).slice(0,4))move(p,'maos',this.id,hour);this.walk(day.byAddress.get(this.stops[0]!)!.door,day);state('walk-address');}break;
   case 'walk-address':if(this.travel(dt,day,false))state('handoff');break;
   case 'handoff':if(this.timer>=1.3){for(const p of this.hands(day)){advance(p,'ENTREGUE','destinatario',hour);move(p,'destinatario','destinatario',hour);}this.walk(atBike(),day);state('return-address');}break;
   case 'return-address':if(this.travel(dt,day,false)){if(this.trunk(day).some(p=>p.destination===this.stops[0])){state('take-parcel');break;}this.stops.shift();const next=day.byAddress.get(this.stops[0]!);if(next){this.drive(next.stop);state('to-address');}else state('complete');}break;
  }
   for(const p of this.hands(day)){const at=day.local(this.person);p.position={x:at.x+Math.sin(this.person.yaw)*.35,y:1+(this.hands(day).indexOf(p))*.3,z:at.z+Math.cos(this.person.yaw)*.35};}
  }catch(e){this.error=String(e);this.state='blocked';day.events.push(`${this.name}: rota bloqueada (${this.error})`);}
 }
}
