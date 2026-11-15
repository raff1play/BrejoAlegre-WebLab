import {STORES,type StoreKind} from '../../world/city/cityPlan.ts';
import {rng} from '../city/traffic.ts';
import {calendarDay} from './operatingCalendar.ts';
import type {Address} from './addresses.ts';
import {createParcel,type Parcel} from './parcels.ts';
import {SECTORS,SECTOR_DATA,sectorOf} from './sectors.ts';
export const ACTORS=['jogador','npc1','npc2','npc3'] as const;
export type ActorId=typeof ACTORS[number];
export type DemandOptions={seed?:number;boundary?:'minimum'|'maximum';dayIndex?:number};
/** One daily draw. Repeated destinations are valid; IDs and store ownership never repeat. */
export function dailyDemand(addresses:readonly Address[],hour:number,options:DemandOptions={}){
 const plan=options.dayIndex===undefined?null:calendarDay(options.dayIndex);
 if(plan?.tier==='folga')throw new Error('Domingo sem expediente: avance ao próximo dia útil');
 const random=rng(options.seed??plan?.seed??2026),stores=STORES.map(s=>s.id),assignments={} as Record<ActorId,StoreKind[]>;
 for(let i=stores.length-1;i>0;i--){const j=Math.floor(random()*(i+1));[stores[i],stores[j]]=[stores[j]!,stores[i]!];}
 ACTORS.forEach((a,i)=>assignments[a]=stores.slice(i*2,i*2+2));
 const pools=SECTORS.map(s=>{const pool=addresses.filter(a=>sectorOf(a.door)===s);for(let i=pool.length-1;i>0;i--){const j=Math.floor(random()*(i+1));[pool[i],pool[j]]=[pool[j]!,pool[i]!];}return pool.slice(0,5);});
 if(pools.some(p=>!p.length))throw new Error('Setor sem endereço acessível');
 const count=(min:number,max:number)=>options.boundary==='minimum'?min:options.boundary==='maximum'?max:min+Math.floor(random()*(max-min+1));
 const parcels:Parcel[]=[],sectorCount=[0,0,0,0];let serial=0;
 const add=(origin:string,collector:string,store:boolean)=>{
  const si=serial%4,sector=SECTORS[si]!,pool=pools[si]!,destination=pool[Math.floor(random()*pool.length)]!;
  const platform=sectorCount[si]!++%2===0?'ML':'SHP';
  const p=createParcel(`J${options.seed??plan?.seed??2026}-${String(++serial).padStart(3,'0')}`,origin,destination.id,platform,sector,store?'NA_LOJA':'EM_TRANSPORTE',store?origin:'motorista',hour);
  p.collector=collector;p.sector=sector;parcels.push(p);
 };
 for(const actor of ACTORS)for(const kind of assignments[actor])for(let n=count(plan?.storeMin??2,plan?.storeMax??5);n>0;n--)add(kind,actor,true);
 const vanCount=count(plan?.vanMin??5,plan?.vanMax??15);for(let i=0;i<vanCount;i++)add('CD-VAN','motorista',false);
 return {assignments,parcels,vanCount,sectors:SECTOR_DATA};
}
