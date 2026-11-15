import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {validateState,transition,checkModuleBranch,IDS} from '../scripts/beta1-control.mjs';

const initial=()=>JSON.parse(readFileSync('docs/beta1/STATE.json','utf8'));
const developing=()=>{const state=initial();state.modules[0].status='EM_DESENVOLVIMENTO';return state;};
const sha='a'.repeat(40),url='https://github.com/raff1play/BrejoAlegre-WebLab/pull/10';

test('B1-00: manifesto deve conter os dez modulos em ordem e sem aprovacao presumida',()=>{
 const state=validateState(initial());
 assert.deepEqual(state.modules.map(m=>m.id),IDS);
 assert.equal(state.modules[0].status,'EM_TESTES');
 assert.ok(state.modules.slice(1).every(m=>m.status==='PENDENTE'));
});

test('B1-00: nao permite iniciar B1-01 antes de aprovar B1-00',()=>{
 const state=initial();
 assert.throws(()=>transition(state,'B1-01','EM_DESENVOLVIMENTO'),/anterior nao aprovado/);
 assert.throws(()=>checkModuleBranch(state,'feat/beta1-01-carreiras','preview'),/antes de aprovar/);
});

test('B1-00: aprovar somente depois de teste com evidencia e nota expressa',()=>{
 let state=developing();
 assert.throws(()=>transition(state,'B1-00','APROVADO',{note:'aprovado'}),/Transicao nao permitida/);
 state=transition(state,'B1-00','EM_TESTES');
 assert.throws(()=>transition(state,'B1-00','AGUARDANDO_APROVACAO'),/link de PR\/CI confirmado/);
 state=transition(state,'B1-00','AGUARDANDO_APROVACAO',{evidenceUrl:url,approvedSha:sha});
 assert.throws(()=>transition(state,'B1-00','APROVADO'),/Aprovacao expressa/);
 state=transition(state,'B1-00','APROVADO',{note:'APROVO B1-00: autorizei explicitamente.'});
 assert.equal(state.modules[0].status,'APROVADO');
 assert.equal(state.modules[1].status,'PENDENTE');
 assert.throws(()=>checkModuleBranch(state,'feat/beta1-01-carreiras','preview'),/nao foi liberado/);
});

test('B1-00: reprovar reabre o mesmo modulo, nao libera o proximo',()=>{
 let state=transition(developing(),'B1-00','EM_TESTES');
 state=transition(state,'B1-00','AGUARDANDO_APROVACAO',{evidenceUrl:url,approvedSha:sha});
 state=transition(state,'B1-00','REPROVADO',{note:'Corrigir verificacao do fluxo'});
 assert.throws(()=>transition(state,'B1-01','EM_DESENVOLVIMENTO'),/anterior nao aprovado/);
 state=transition(state,'B1-00','EM_DESENVOLVIMENTO');
 assert.equal(state.modules[0].status,'EM_DESENVOLVIMENTO');
});

test('B1-00: detecta avancos falsos e aprovacoes fora de ordem',()=>{
 const state=initial();
 state.modules[1].status='APROVADO';
 state.modules[1].approvedSha=sha;
 state.modules[1].evidenceUrl=url;
 state.modules[1].reviewNote='Aprovado pelo usuario';
 assert.throws(()=>validateState(state),/prefixo continuo/);
});

test('B1-00: branches comuns nao burlam nem liberam estado, gameplay exige preview',()=>{
 let state=transition(developing(),'B1-00','EM_TESTES');
 state=transition(state,'B1-00','AGUARDANDO_APROVACAO',{evidenceUrl:url,approvedSha:sha});
 state=transition(state,'B1-00','APROVADO',{note:'APROVO B1-00 expressamente'});
 state=transition(state,'B1-01','EM_DESENVOLVIMENTO');
 assert.equal(checkModuleBranch(state,'feat/beta1-01-carreiras','preview'),'B1-01');
 assert.throws(()=>checkModuleBranch(state,'feat/beta1-01-carreiras','main'),/so pode/);
 assert.equal(checkModuleBranch(state,'chore/beta1-00-orquestracao','preview'),null);
});
