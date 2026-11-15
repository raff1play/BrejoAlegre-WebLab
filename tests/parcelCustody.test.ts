import test from 'node:test';import assert from 'node:assert/strict';
import{createParcel,move,advance}from'../src/core/delivery/parcels.ts';
test('ART002C atomic receipt preserves identity, position and custody; rejects duplicate/positionless receipt',()=>{
 const p=createParcel('BA-X','loja','addr','LOJA','Centro','EM_TRANSPORTE','jogador',13,'maos');
 assert.throws(()=>move(p,'recebimento','recebimento',13));assert.equal(p.place,'maos');assert.equal(p.history.length,1);
 move(p,'recebimento','recebimento',13,{x:100,y:.94,z:-122});
 assert.equal(p.id,'BA-X');assert.equal(p.holder,'recebimento');assert.equal(p.history.at(-1)!.position!.x,100);
 assert.throws(()=>move(p,'recebimento','recebimento',13));assert.equal(p.history.length,2);
 assert.throws(()=>advance(p,'TRIADO','separador',14));
 move(p,'conferencia','conferente',13.1,p.position);advance(p,'RECEBIDO_BASE','conferente',13.1);
 assert.equal(p.history.at(-1)!.holder,p.holder);assert.equal(p.history.at(-1)!.place,'conferencia');
});
