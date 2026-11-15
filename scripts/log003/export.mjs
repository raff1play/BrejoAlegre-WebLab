/** Pure replay + actual browser records. No parcel state/history is manufactured. */
import fs from 'node:fs';
import {LogisticsDay} from '../../src/core/delivery/logisticsDay.ts';
import {depotWorld,depotYaw,CITY_BOUNDS,ROADS,STORES} from '../../src/world/city/cityPlan.ts';
import {createMotionGuard} from '../../src/core/collision.ts';
import {solidPolygons} from '../../src/world/city/cityLayout.ts';
import {SECTORS,SECTOR_DATA,SECTOR_CENTRE,sectorOf} from '../../src/core/delivery/sectors.ts';
const out='docs/evidence/log-003',guard=createMotionGuard(CITY_BOUNDS,[],solidPolygons());
const bike={...depotWorld(84,-111),yaw:depotYaw(0),moving:false},visit=(x,z)=>({bike,player:{...depotWorld(x,z),riding:false}});
for(const seed of [2026,674161,357183]){
 const day=new LogisticsDay({seed,free:(x,z)=>guard(x,z,.45)});day.start(11);const initial=structuredClone(day.parcels);let releasedAt=null,endedAt=null;const docks=new Map();
 for(const kind of day.assigned)while(day.readyAt(kind).length){day.collect(kind,12);day.stow(12);}
 for(let t=0;t<1350;t+=.1){const hour=12+t/150;if(day.trunkForDepot().length&&!day.inHands().length)day.unloadForDepot(hour,false,visit(84,-112.25));if(day.inHands().some(p=>p.state==='EM_TRANSPORTE'))day.handOver(hour,visit(97.8,-122.3));day.update(hour,.1);
  for(const p of day.parcels)if(p.place==='saca'&&!docks.has(p.id))docks.set(p.id,{id:p.id,dock:p.dock,load:p.load,hour,position:{...p.position}});
  if(day.canTakeSack(hour)){day.takeSack(hour,visit(104,-116.7));day.stow(hour);}
  if(day.teamReady&&!day.released){day.release(hour);releasedAt=hour;}
  if(day.released)for(const id of [...day.route]){day.takeForAddress(id,hour);day.deliver(id,hour);}
  if(day.phase==='CONCLUIDA'){endedAt=hour;break;}
 }
 const result={method:'Pure deterministic replay; human actions use valid parked visits; player city travel omitted; NPC travel simulated on lanes, with stops/signals. Browser evidence separate.',seed,total:initial.length,assignments:day.assignments,releasedAt,endedAt,phase:day.phase,van:day.van.state,errors:day.depot.errors,couriers:day.couriers.map(c=>({id:c.id,state:c.state,error:c.error,routeLog:c.routeLog})),docks:[...docks.values()],parcels:day.parcels};
 if(day.phase!=='CONCLUIDA'||day.depot.errors.length)throw Error('Replay failed '+seed);
 fs.writeFileSync(`${out}/seed-${seed}.json`,JSON.stringify(result,null,2));
 const quote=s=>'"'+String(s).replaceAll('"','""')+'"';
 const rows=[['ID','origem','coletor','plataforma','setor','doca','destino_ID','endereço','x_leste_m','z_norte_m'],...initial.map(p=>{const a=day.byAddress.get(p.destination);return [p.id,p.origin,p.collector,p.platform,p.sector,SECTOR_DATA[p.sector].dock,p.destination,a.label,a.door.x,a.door.z];})];
 fs.writeFileSync(`${out}/seed-${seed}-packages.csv`,rows.map(r=>r.map(quote).join(',')).join('\n')+'\n');
 console.log(seed,result.total,result.releasedAt,result.endedAt,result.phase);
 if(seed===2026){
  const actual=JSON.parse(fs.readFileSync(`${out}/browser-operation.json`)).final.parcels;
  if(JSON.stringify(actual.map(p=>[p.id,p.destination]))!==JSON.stringify(initial.map(p=>[p.id,p.destination])))throw Error('Browser demand differs from export');
  const traces=['jogador','npc1','motorista'].map(actor=>day.parcels.find(p=>p.collector===actor));fs.writeFileSync(`${out}/custody-examples.json`,JSON.stringify(traces,null,2));
  const all=day.addresses,minX=Math.min(...all.map(a=>a.door.x))-70,maxX=Math.max(...all.map(a=>a.door.x))+70,minZ=Math.min(...all.map(a=>a.door.z))-70,maxZ=Math.max(...all.map(a=>a.door.z))+70;
  const scale=Math.min(880/(maxX-minX),760/(maxZ-minZ)),pos=(x,z)=>[30+(x-minX)*scale,30+(maxZ-z)*scale];
  let svg='<svg xmlns="http://www.w3.org/2000/svg" width="940" height="860" viewBox="0 0 940 860"><rect width="940" height="860" fill="#192b2d"/>';
  const [cx,cy]=pos(SECTOR_CENTRE.x,SECTOR_CENTRE.z),r=3000;
  const wedges={Norte:[[cx,cy],[cx-r,cy-r],[cx+r,cy-r]],Oeste:[[cx,cy],[cx-r,cy-r],[cx-r,cy+r]],Leste:[[cx,cy],[cx+r,cy-r],[cx+r,cy+r]],Sul:[[cx,cy],[cx-r,cy+r],[cx+r,cy+r]]};
  for(const s of SECTORS)svg+=`<polygon points="${wedges[s].map(p=>p.join(',')).join(' ')}" fill="${SECTOR_DATA[s].color}" opacity=".2"/>`;
  svg+=ROADS.map(r=>`<polyline points="${r.pts.map(p=>pos(...p).join(',')).join(' ')}" stroke="#bcc9c4" stroke-width="2" fill="none"/>`).join('');
  for(const a of all){const [x,y]=pos(a.door.x,a.door.z),s=sectorOf(a.door);svg+=`<circle cx="${x}" cy="${y}" r="4" fill="${SECTOR_DATA[s].color}"/>`;}
  const center=pos(SECTOR_CENTRE.x,SECTOR_CENTRE.z);svg+=`<text x="${center[0]}" y="${center[1]}" fill="white" font-size="18">+</text><text x="20" y="30" fill="white" font-size="24">↑ Norte geográfico · +z</text>`;
  SECTORS.forEach((s,i)=>svg+=`<text x="${20+i*230}" y="850" fill="${SECTOR_DATA[s].color}" font-size="20">${s} · ${SECTOR_DATA[s].dock}</text>`);svg+='</svg>';fs.writeFileSync(`${out}/geographic-sectors.svg`,svg);
  let table='| Entregador | Setor / doca | Lojas | Volumes de coleta |\n|---|---|---|---:|\n';for(const [actor,shops]of Object.entries(day.assignments)){const sector=day.actorSector(actor);table+=`| ${actor} | ${sector} / ${SECTOR_DATA[sector].dock} | ${shops.map(id=>STORES.find(s=>s.id===id).name).join(' + ')} | ${initial.filter(p=>p.collector===actor).length} |\n`;}
  fs.writeFileSync(`${out}/assignment-table.md`,table);
 }
}
