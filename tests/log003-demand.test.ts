import {test} from 'node:test';import assert from 'node:assert/strict';
import {dailyDemand,ACTORS} from '../src/core/delivery/dailyDemand.ts';
import {buildAddresses} from '../src/core/delivery/addresses.ts';
import {SECTORS,sectorOf} from '../src/core/delivery/sectors.ts';
const addresses=buildAddresses();
for(const seed of [1,2,2026,9987])for(const boundary of [undefined,'minimum','maximum'] as const)test(`LOG003 demand seed=${seed} ${boundary}`,()=>{
 const d=dailyDemand(addresses,11,{seed,boundary});assert.equal(new Set(Object.values(d.assignments).flat()).size,8);
 ACTORS.forEach(a=>assert.equal(d.assignments[a].length,2));
 for(const s of Object.values(d.assignments).flat()){const n=d.parcels.filter(p=>p.origin===s).length;assert.ok(n>=2&&n<=5);}
 assert.ok(d.vanCount>=5&&d.vanCount<=15);assert.ok(d.parcels.length>=21&&d.parcels.length<=55);
 if(boundary)assert.equal(d.parcels.length,boundary==='minimum'?21:55);
 assert.equal(new Set(d.parcels.map(p=>p.id)).size,d.parcels.length);
 for(const p of d.parcels)assert.equal(p.sector,sectorOf(addresses.find(a=>a.id===p.destination)!.door));
 for(const sector of SECTORS)assert.equal(new Set(d.parcels.filter(p=>p.sector===sector).map(p=>p.platform)).size,2);
 assert.deepEqual(d,dailyDemand(addresses,11,{seed,boundary}));
});
