import type {Address} from './addresses.ts';
import {TOWN_CENTRE} from '../../world/geo/geoCity.ts';
import {streetRoute} from '../city/streetRoute.ts';
export const SECTORS=['Norte','Oeste','Leste','Sul'] as const;
export type Sector=typeof SECTORS[number];
export const SECTOR_CENTRE={x:TOWN_CENTRE[0],z:TOWN_CENTRE[1]};
/** `actor` is the LEGACY default role (player = Oeste). B1-01: the live role comes from the career roster (`src/core/career/careers.ts`). */
export const SECTOR_DATA={Norte:{dock:'D01',load:'ROTA-N',actor:'npc1',x:96,color:'#4da6de'},Oeste:{dock:'D02',load:'ROTA-O',actor:'jogador',x:104,color:'#e4a949'},Leste:{dock:'D03',load:'ROTA-L',actor:'npc2',x:112,color:'#60ac67'},Sul:{dock:'D04',load:'ROTA-S',actor:'npc3',x:120,color:'#bf7dcb'}} as const;
/** OSM tangent-plane projection: +x east, +z north. Dominant-axis wedges, deterministic ties. */
export function sectorOf(p:{x:number;z:number}):Sector{const dx=p.x-SECTOR_CENTRE.x,dz=p.z-SECTOR_CENTRE.z;return Math.abs(dz)>=Math.abs(dx)?(dz>=0?'Norte':'Sul'):(dx<0?'Oeste':'Leste');}
const distances=new Map<string,number>();
export function roadDistance(a:{x:number;z:number},b:{x:number;z:number}):number{const key=`${a.x},${a.z}:${b.x},${b.z}`;let d=distances.get(key);if(d===undefined){d=streetRoute(a,b)?.length??Infinity;distances.set(key,d);}return d;}
export function recommendedRoute(addresses:readonly Address[],from:{x:number;z:number}):string[]{const left=[...addresses],out:string[]=[];let at=from;while(left.length){left.sort((a,b)=>roadDistance(at,a.stop)-roadDistance(at,b.stop)||a.id.localeCompare(b.id));const next=left.shift()!;if(!Number.isFinite(roadDistance(at,next.stop)))throw new Error('Unreachable destination '+next.id);out.push(next.id);at=next.stop;}
 // Bounded 2-opt on network costs; evaluate directed edges again after reversing a segment.
 const byId=new Map(addresses.map(a=>[a.id,a.stop])),cost=(ids:string[])=>ids.reduce((sum,id,i)=>sum+roadDistance(i?byId.get(ids[i-1]!)!:from,byId.get(id)!),0);
 for(let pass=0;pass<3;pass++){let improved=false;for(let i=0;i<out.length-1;i++)for(let j=i+1;j<out.length;j++){const candidate=[...out.slice(0,i),...out.slice(i,j+1).reverse(),...out.slice(j+1)];if(cost(candidate)+.01<cost(out)){out.splice(0,out.length,...candidate);improved=true;}}if(!improved)break;}return out;}
