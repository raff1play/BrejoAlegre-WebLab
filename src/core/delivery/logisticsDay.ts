import {Workday,type WorkdayOptions,type DepotVisit,type Objective,DEPOT_SPOTS} from './workday.ts';
import {dailyDemand,type DemandOptions,type ActorId} from './dailyDemand.ts';
import {Courier,COURIER_LABEL} from './couriers.ts';
import {SECTOR_DATA,recommendedRoute,type Sector} from './sectors.ts';
import {depotLocal,depotWorld,type StoreKind} from '../../world/city/cityPlan.ts';
import {DEPOT_POINTS} from '../../world/city/depotPlan.ts';
import {advance,move} from './parcels.ts';
import {depotVisitAllowed} from './workday.ts';
import {calendarDay,type CalendarDay} from './operatingCalendar.ts';
import type {CarTrunk} from './carTrunk.ts';
import {CHARACTERS,DEFAULT_CAREER,assertRoster,buildRoster,type Roster} from '../career/careers.ts';
export type LogisticsDayOptions=WorkdayOptions&DemandOptions&{roster?:Roster};
/**
 * Four actors share inherited parcels/depot. Actor inventories are queries, never copies.
 * B1-01 F1: the `roster` maps each persistent character (careerId) to its role for THIS shift; the
 * player's sector comes from the active career. Default roster = legacy (player Oeste; Rosa/Caio/Davi).
 */
export class LogisticsDay extends Workday {
 readonly roster:Roster;readonly playerSector:Sector;readonly couriers:Courier[];
 /** The player's own sector counter (depot-local / world). Oeste = the legacy D02 dispatch point. */
 readonly playerDispatchLocal:{x:number;z:number};readonly playerDispatch:{x:number;z:number};
 assignments:Record<ActorId,StoreKind[]>={jogador:[],npc1:[],npc2:[],npc3:[]};
 readonly demandOptions:DemandOptions;readonly calendar:CalendarDay|null;
 allSortedAt:number|null=null;private readinessWarned=false;
 trafficTime=0;trafficBlocked:((id:string,x:number,z:number,yaw:number)=>'traffic'|'player'|'courier'|null)|null=null;
 gateOpen=1;released=false;releaseHour:number|null=null;private previousHour:number|null=null;
 readonly local=(p:{x:number;z:number})=>depotLocal(p.x,p.z);
 constructor(options:LogisticsDayOptions={}){
  super(options);this.demandOptions=options;this.calendar=options.dayIndex===undefined?null:calendarDay(options.dayIndex);
  this.roster=options.roster??buildRoster(DEFAULT_CAREER);assertRoster(this.roster);
  this.playerSector=CHARACTERS[this.roster.jogador].sector;
  this.playerDispatchLocal=Object.freeze({x:SECTOR_DATA[this.playerSector].x,z:DEPOT_POINTS.dispatch.z});
  this.playerDispatch=Object.freeze(depotWorld(this.playerDispatchLocal.x,this.playerDispatchLocal.z));
  this.couriers=(['npc1','npc2','npc3'] as const).map(id=>{const c=CHARACTERS[this.roster[id]];return new Courier(id,c.name,c.sector);});
 }
 override start(hour:number):void{
  if(this.phase!=='ANTES')return;const d=dailyDemand(this.addresses,hour,this.demandOptions);
  this.assignments=d.assignments;this.assigned=d.assignments.jogador;this.parcels.push(...d.parcels);
  for(const c of this.couriers)c.stores=this.assignments[c.id];
  this.phase='COLETA';this.events.push(`Equipe designada: 8 lojas · ${this.calendar?.tier??'demanda padrão'} · 4 setores. Consulte Logística.`);
 }
 actorSector(actor:ActorId):Sector{return actor==='jogador'?this.playerSector:this.couriers.find(c=>c.id===actor)!.sector;}
 load(actor:ActorId){return this.parcels.filter(p=>p.sector===this.actorSector(actor));}
 canTakeLoad(actor:ActorId,hour:number):boolean{
  const list=this.load(actor),s=SECTOR_DATA[this.actorSector(actor)];
  return hour>=15&&hour<21&&list.length>0&&!this.parcels.some(p=>p.holder===actor&&p.place==='maos')&&list.every(p=>p.state==='NA_SACA'&&p.place==='saca'&&p.dock===s.dock&&p.load===s.load&&p.position);
 }
 takeLoad(actor:ActorId,hour:number,at:{x:number;z:number}):number{
  const s=SECTOR_DATA[this.actorSector(actor)],dock=depotWorld(s.x,-116.7);
  if(!this.canTakeLoad(actor,hour)||Math.hypot(at.x-dock.x,at.z-dock.z)>1.45)return 0;
  const list=this.load(actor);
  const route=recommendedRoute([...new Set(list.map(p=>p.destination))].map(id=>this.byAddress.get(id)!),DEPOT_SPOTS.entry);
  for(const p of list){advance(p,'EM_ROTA',actor,hour);move(p,'maos',actor,hour);}
  if(actor==='jogador'){this.sackInHands=true;this.route=route;this.phase='ENTREGAS';}
  else this.couriers.find(c=>c.id===actor)!.stops=route;
  return list.length;
 }
 override canTakeSack(hour:number):boolean{return this.canTakeLoad('jogador',hour);}
 override takeSack(hour:number,visit?:DepotVisit):number{return depotVisitAllowed(visit,this.playerDispatchLocal)?this.takeLoad('jogador',hour,visit!.player):0;}
 /** Ready to leave: the whole sector load in the player's own vehicle (top box or, B1-01 F4, car boot). */
 get playerReady():boolean{return this.load('jogador').length>0&&this.load('jogador').every(p=>p.state==='EM_ROTA'&&(p.place==='bau'||p.place==='porta-malas')&&p.holder==='jogador');}
 get teamReady():boolean{return this.playerReady&&this.couriers.every(c=>c.state==='ready');}
 release(hour:number):boolean{if(!this.teamReady||this.released||hour<15||hour>=21)return false;this.released=true;this.releaseHour=hour;this.couriers.forEach(c=>c.timer=0);this.events.push('Equipe liberada — quatro rotas iniciadas');return true;}
 releaseDelay(id:string):number{return (this.couriers.findIndex(c=>c.id===id)+1)*3;}
 override takeForAddress(id:string,hour:number,moving=false):number{return this.released&&hour<21?super.takeForAddress(id,hour,moving):0;}
 /** B1-01 F4: same rule as the top box (team released, before 21h — F5 revises the 21h rule for both). */
 override takeFromCarForAddress(trunk:CarTrunk,id:string,hour:number,parked:boolean):number{return this.released&&hour<21?super.takeFromCarForAddress(trunk,id,hour,parked):0;}
 override deliver(id:string,hour:number):number{return this.released&&hour<21?super.deliver(id,hour):0;}
 override update(hour:number,dt:number,truckDocked=false):void{
  this.trafficTime+=dt;
  super.update(hour,dt,truckDocked);
  if(this.parcels.length&&this.allSortedAt===null&&this.parcels.every(p=>['NA_SACA','EM_ROTA','ENTREGUE'].includes(p.state))){
    this.allSortedAt=hour;
    this.events.push(`Quatro cargas separadas às ${String(Math.floor(hour)).padStart(2,'0')}:${String(Math.floor((hour%1)*60)).padStart(2,'0')}`);
  }
  if(this.calendar&&!this.readinessWarned&&hour>this.calendar.depotTarget&&this.allSortedAt===null){
    this.readinessWarned=true;this.events.push(`Atenção: triagem ainda pendente após ${this.calendar.depotTarget}h`);
  }
  const dh=this.previousHour===null?0:Math.max(0,hour-this.previousHour);this.previousHour=hour;
  const seconds=Math.min(4,dt*Math.max(1,Math.min(8,dt>0?dh*150/dt:1)));
  for(let t=0;t<seconds;t+=.1)for(const c of this.couriers)c.update(this,hour,Math.min(.1,seconds-t));
  if(hour>=21){this.phase=this.count('ENTREGUE')===this.parcels.length?'CONCLUIDA':'ENCERRADA';return;}
  if(this.parcels.length&&this.count('ENTREGUE')===this.parcels.length&&this.couriers.every(c=>c.state==='complete'))this.phase='CONCLUIDA';
  else if(this.load('jogador').some(p=>p.state==='EM_ROTA'||p.state==='ENTREGUE'))this.phase='ENTREGAS';
  else if(this.load('jogador').length&&this.load('jogador').every(p=>p.state==='NA_SACA'&&p.place==='saca'))this.phase='SACA';
 }
 override objective(hour:number,bike?:{x:number;z:number}):Objective{
  if(this.phase==='ENTREGAS'&&!this.released){
   const car=this.vehicleKind==='carro-antigo';
   if(this.sackInHands)return {title:`Guardar a saca ${this.playerSector} no ${this.compartment}`,detail:this.cargoLabel(),target:bike?{kind:'moto',id:'moto',...bike,label:car?'Porta-malas do carro':'Baú da moto'}:null,waitUntil:null};
   return {title:this.teamReady?'Equipe pronta — iniciar rota de entregas':'Preparação da equipe para saída conjunta',detail:`${this.couriers.map(c=>`${c.name}: ${COURIER_LABEL[c.state]}`).join(' · ')} · menu Logística · jornada até 21h`,target:null,waitUntil:null};
  }
  if(this.phase==='ENTREGAS'&&!this.route.length)return {title:`Setor ${this.playerSector} concluído — acompanhando a equipe`,detail:this.couriers.map(c=>`${c.name}: ${COURIER_LABEL[c.state]}`).join(' · '),target:null,waitUntil:null};
  const base=super.objective(hour,bike);
  // The dispatch counter is the player's sector dock (unchanged D02 for the legacy Oeste career).
  const objective=base.target?.label==='Expedição'?{...base,target:{...base.target,...this.playerDispatch}}:base;
  if(['CONFERENCIA','TRIAGEM'].includes(this.phase)&&this.calendar)return {...objective,detail:`${objective.detail} · meta de separação até ${this.calendar.depotTarget}h`};
  if(this.phase==='SACA')return {...objective,title:hour<15?`Carga ${this.playerSector} liberada às 15h`:`Retirar a carga ${this.playerSector} na ${SECTOR_DATA[this.playerSector].dock}`,detail:`${this.load('jogador').length} volumes ML/SHP • somente seu setor`};
  return objective;
 }
 override progress(){return {collected:this.parcels.filter(p=>p.collector==='jogador'&&p.state!=='NA_LOJA').length,delivered:this.count('ENTREGUE'),total:this.parcels.length};}
}
