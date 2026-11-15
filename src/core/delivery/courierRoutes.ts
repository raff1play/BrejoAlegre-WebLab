import {buildRoadGraph,nearestLane,routeBetween,pathPose,type Path,type Vec} from '../city/roadGraph.ts';
const graph=buildRoadGraph();
function part(path:Path,start:number,end:number):Vec[]{return [{...pathPose(path,start)},...path.points.filter((_,i)=>path.cum[i]!>start&&path.cum[i]!<end),{...pathPose(path,end)}];}
/** Lane-level routing: actual right-hand carriageways and intersection movements. */
export function courierRoadRoute(from:Vec,to:Vec):Vec[]{
 const f=nearestLane(graph,from.x,from.z)!,t=nearestLane(graph,to.x,to.z)!;
 let chain=routeBetween(graph,f.lane.index,t.lane.index,()=>true);
 if(chain===null)throw new Error('Courier street route disconnected');
 if(f.lane.index===t.lane.index&&t.s<f.s){
  const candidates=f.lane.out.map(mi=>{const m=graph.movements[mi]!,tail=routeBetween(graph,m.to,t.lane.index,()=>true);return tail?[mi,...tail]:null;}).filter((x):x is number[]=>!!x);
  chain=candidates.sort((a,b)=>a.length-b.length)[0]??null;
  if(!chain)throw new Error('No legal street turnaround');
 }
 const points:Vec[]=[from];
 if(!chain.length)points.push(...part(f.lane.path,f.s,t.s));
 else{
  points.push(...part(f.lane.path,f.s,f.lane.path.length));
  for(const [i,mi]of chain.entries()){const m=graph.movements[mi]!;points.push(...m.path.points);const lane=graph.lanes[m.to]!;points.push(...part(lane.path,0,i===chain.length-1?t.s:lane.path.length));}
 }
 points.push(to);return points.filter((p,i)=>!i||Math.hypot(p.x-points[i-1]!.x,p.z-points[i-1]!.z)>.001);
}
/** Local foot navigation. Obstacles come from the same world guard as the player. */
export function courierFootRoute(from:Vec,to:Vec,free:(x:number,z:number)=>boolean):Vec[]{
 const step=.4,key=(x:number,z:number)=>`${x},${z}`;
 const link=(a:Vec,b:Vec)=>{const n=Math.ceil(Math.hypot(a.x-b.x,a.z-b.z)/.1);for(let i=0;i<=n;i++){const k=n?i/n:0;if(!free(a.x+(b.x-a.x)*k,a.z+(b.z-a.z)*k))return false;}return true;};
 if(link(from,to))return [to];
 const snap=(p:Vec)=>{const out:Vec[]=[];for(let dx=-2;dx<=2;dx++)for(let dz=-2;dz<=2;dz++)out.push({x:Math.round(p.x/step)+dx,z:Math.round(p.z/step)+dz});out.sort((a,b)=>Math.hypot(a.x*step-p.x,a.z*step-p.z)-Math.hypot(b.x*step-p.x,b.z*step-p.z));return out.find(a=>link(p,{x:a.x*step,z:a.z*step}));};
 const start=snap(from),end=snap(to);if(!start||!end)throw new Error('Courier foot endpoint blocked');
 const queue=[start],prev=new Map<string,string|null>([[key(start.x,start.z),null]]);let found=false;
 for(let i=0;i<queue.length&&i<20000;i++){
  const p=queue[i]!;if(p.x===end.x&&p.z===end.z){found=true;break;}
  for(const [dx,dz]of [[1,0],[-1,0],[0,1],[0,-1]]){const next={x:p.x+dx!,z:p.z+dz!},k=key(next.x,next.z);if(prev.has(k)||Math.abs(next.x-start.x)>85||Math.abs(next.z-start.z)>85||!link({x:p.x*step,z:p.z*step},{x:next.x*step,z:next.z*step}))continue;prev.set(k,key(p.x,p.z));queue.push(next);}
 }
 if(!found)throw new Error('Courier foot path disconnected');const route:Vec[]=[to];let at:string|null=key(end.x,end.z);while(at){const [x,z]=at.split(',').map(Number);route.push({x:x!*step,z:z!*step});at=prev.get(at)??null;}return route.reverse();
}
