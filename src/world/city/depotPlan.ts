import { circleIntersectsBox, type Box2D } from '../../core/collision.ts';

/** ART-002 single source, metres in the existing depot frame. No change to the mapped site. */
export type DepotFixture = Box2D & { id: string; kind: 'wall' | 'fence' | 'column' | 'table' | 'belt' | 'cage' | 'rack' | 'guard' | 'booth' | 'parked'; height: number };
export const rect = (minX: number, maxX: number, minZ: number, maxZ: number): Box2D => ({minX,maxX,minZ,maxZ});
export const DEPOT_POINTS = {
  door: {x:91,z:-122.2}, receiving:{x:97.8,z:-122.3}, dispatch:{x:104,z:-116.7}, sorting:{x:106,z:-127.8},
  shelves:{x:122,z:-134}, dock:{x:128,z:-119}, gatehouse:{x:97.8,z:-96.8}, office:{x:131,z:-138.5},
  entry:{x:106,z:-91}, parking:{x:84,z:-111}, truck:{x:128,z:-119.4},
} as const;
export const REGIONAL_CAGES = [rect(119,122,-137,-135.5),rect(124,127,-137,-135.5)];
export const DISPATCH_DOCK = 'D02';
export const MIXED_LOAD = 'ROTA-01';
export const MOTO_PARKING = [81,84,87,90].map(x=>({...rect(x-.9,x+.9,-112.6,-109.4),x,z:-111}));
export const CAR_PARKING = [80,83.2,86.4].map(x=>rect(x-1.5,x+1.5,-104.8,-99.4));
export const PEDESTRIAN_GATE = rect(92.5,94.3,-92.42,-92.22);
export const VEHICLE_GATE = rect(100,112,-92.42,-92.22);
/** Sliding leaves: geometry and live collision use these SAME rectangles for every opening. */
export function gateLeaves(open: number): Box2D[] {
  const k=Math.max(0,Math.min(1,open));
  return [rect(100-6.15*k,106-6.15*k,-92.42,-92.22),rect(106+6.15*k,112+6.15*k,-92.42,-92.22)];
}
export function depotFixtures(): DepotFixture[] {
 const out:DepotFixture[]=[];
 const add=(id:string,kind:DepotFixture['kind'],b:Box2D,height:number)=>out.push({...b,id,kind,height});
 add('back','wall',rect(92,136,-142,-141.7),7.8);
 add('east','wall',rect(135.7,136,-142,-118),7.8);
 add('west-back','wall',rect(92,92.3,-142,-124.2),7.8);
 add('west-front','wall',rect(92,92.3,-120.2,-118),7.8);
 let x=92;
 for(const d of [96,104,112,120,128]){add(`front-${d}`,'wall',rect(x,d-1.9,-118.3,-118),7.8);x=d+1.9;}
 add('front-end','wall',rect(x,136,-118.3,-118),7.8);
 for(const x of [92.6,106,120,135.4])for(const z of [-141.3,-118.7])add(`column-${x}-${z}`,'column',rect(x-.18,x+.18,z-.18,z+.18),7.8);
 add('receiving','table',rect(99.2,103.2,-123,-121.6),.94);
 add('belt','belt',rect(105,117,-130.8,-129.2),.9);
 REGIONAL_CAGES.forEach((r,i)=>add(`region-${i}`,'cage',r,1.65));
 add('dispatch','table',rect(103,105,-120.4,-119.2),.45);
 add('reserve-rack','rack',rect(129,134,-141.5,-140),3.8);
 // Guard booth has an actual doorway to the west, no solid glass cube.
 add('booth-front','booth',rect(96,99.3,-95,-94.8),2.7);
 add('booth-back','booth',rect(96,99.3,-98.5,-98.3),2.7);
 add('booth-east','booth',rect(99.1,99.3,-98.3,-95),2.7);
 add('booth-west-a','booth',rect(96,96.2,-98.3,-97.7),2.7);
 add('booth-west-b','booth',rect(96,96.2,-96.4,-95),2.7);
 for(const [a,b]of [[76.2,92.5],[94.3,100],[112,139.8]])add(`fence-front-${a}`,'fence',rect(a!,b!,-92.42,-92.22),2.35);
 add('fence-west','fence',rect(76.2,76.4,-150,-92.42),2.35);
 add('fence-east','fence',rect(139.6,139.8,-150,-92.42),2.35);
 add('fence-back','fence',rect(76.4,139.6,-150,-149.8),2.35);
 for(const x of [92.4,94.4,99.8,112.2])add(`gate-post-${x}`,'column',rect(x-.12,x+.12,-92.6,-92.12),2.8);
 // Footway barrier protects the public approach; crosswalk gaps at both ends.
 add('footway-guard','guard',rect(94.8,95,-116,-100),.95);
 add('decoy-bike','parked',rect(86.65,87.35,-112.1,-109.9),1.35);
 return out;
}
export const insideRect=(b:Box2D,p:{x:number;z:number},margin=0)=>p.x>=b.minX+margin&&p.x<=b.maxX-margin&&p.z>=b.minZ+margin&&p.z<=b.maxZ-margin;
export function validDepotParking(b:{x:number;z:number;yaw:number;moving:boolean}):boolean {
 const aligned=Math.abs(Math.sin(b.yaw))<.4;
 return !b.moving&&aligned&&MOTO_PARKING.some(r=>insideRect(r,b,.18));
}
export function depotFree(p:{x:number;z:number},r=.34):boolean {
 return insideRect(rect(76.4,139.6,-149.8,-92.5),p,r)&&!depotFixtures().some(b=>circleIntersectsBox(p.x,p.z,r,b));
}
/** Deterministic 0.5 m navigation grid. Every edge is checked against the shared fixtures. */
export function depotPath(from:{x:number;z:number},to:{x:number;z:number}):{x:number;z:number}[] {
 if(!depotFree(from)||!depotFree(to))throw new Error(`depot route endpoint blocked: ${JSON.stringify({from,to})}`);
 const cell=.5,key=(x:number,z:number)=>`${x},${z}`;
 const start={x:Math.round(from.x/cell),z:Math.round(from.z/cell)},end={x:Math.round(to.x/cell),z:Math.round(to.z/cell)};
 const queue=[start],prev=new Map<string,string|null>([[key(start.x,start.z),null]]);let found=false;
 const fixtures=depotFixtures();
 const free=(x:number,z:number)=>insideRect(rect(76.4,139.6,-149.8,-92.5),{x,z},.34)&&!fixtures.some(b=>circleIntersectsBox(x,z,.34,b));
 for(let i=0;i<queue.length;i++){
  const p=queue[i]!;if(p.x===end.x&&p.z===end.z){found=true;break;}
  for(const [dx,dz]of [[1,0],[-1,0],[0,1],[0,-1]]){const x=p.x+dx!,z=p.z+dz!,k=key(x,z);if(prev.has(k)||!free(x*cell,z*cell)||!free((x+p.x)*cell/2,(z+p.z)*cell/2))continue;prev.set(k,key(p.x,p.z));queue.push({x,z});}
 }
 if(!found)throw new Error('No safe depot route');
 const path:{x:number;z:number}[]=[to];let at:string|null=key(end.x,end.z);
 while(at){const [x,z]=at.split(',').map(Number);path.push({x:x!*cell,z:z!*cell});at=prev.get(at)??null;}
 return path.reverse();
}
