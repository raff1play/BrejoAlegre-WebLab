/**
 * B1-00: state machine and PR gate for the nine gameplay modules.
 * This is a repository control, NOT a programming agent or proof of a user's approval.
 */
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {readFileSync,writeFileSync} from 'node:fs';
import {pathToFileURL} from 'node:url';

export const STATE_PATH='docs/beta1/STATE.json';
export const IDS=Array.from({length:10},(_,i)=>'B1-'+String(i).padStart(2,'0'));
export const STATUSES=['PENDENTE','EM_DESENVOLVIMENTO','EM_TESTES','AGUARDANDO_APROVACAO','REPROVADO','APROVADO'];
const ALLOWED={
 PENDENTE:['EM_DESENVOLVIMENTO'],
 EM_DESENVOLVIMENTO:['EM_TESTES'],
 EM_TESTES:['EM_DESENVOLVIMENTO','AGUARDANDO_APROVACAO'],
 AGUARDANDO_APROVACAO:['APROVADO','REPROVADO'],
 REPROVADO:['EM_DESENVOLVIMENTO'],
 APROVADO:[]
};
const shaOk=s=>typeof s==='string'&&/^[a-f0-9]{40}$/.test(s);
const urlOk=s=>typeof s==='string'&&/^https:\/\/github\.com\/raff1play\/BrejoAlegre-WebLab\/(?:actions\/runs\/\d+|pull\/\d+)(?:\/.*)?$/.test(s);

export function validateState(state){
 assert.equal(state?.schemaVersion,1,'Versao de estado invalida');
 assert.ok(Array.isArray(state.modules),'Modulos ausentes');
 assert.equal(state.modules.length,IDS.length,'Esperados B1-00 ate B1-09');
 let foundOpen=false,activeCount=0;
 for(let i=0;i<IDS.length;i++){
  const m=state.modules[i];
  assert.equal(m.id,IDS[i],'Ordem ou identificador de modulo incorreto');
  assert.ok(typeof m.name==='string'&&m.name.trim(),'Nome do modulo vazio');
  assert.ok(STATUSES.includes(m.status),'Estado invalido para '+m.id);
  if(m.status==='APROVADO'){
   assert.ok(!foundOpen,'Modulos aprovados devem formar um prefixo continuo');
   assert.ok(shaOk(m.approvedSha),m.id+' aprovado sem commit rastreavel');
   assert.ok(typeof m.reviewNote==='string'&&m.reviewNote.trim().length>=8,m.id+' sem decisao registrada');
   assert.ok(urlOk(m.evidenceUrl),m.id+' aprovado sem evidencia GitHub');
  }else{
   foundOpen=true;
   if(m.status!=='PENDENTE')activeCount++;
  }
 }
 assert.ok(activeCount<=1,'Somente um modulo pode estar ativo');
 assert.ok(Array.isArray(state.history),'Historico de auditoria ausente');
 return state;
}

export function transition(state,id,to,{note='',evidenceUrl=null,approvedSha=null}={}){
 validateState(state);
 const idx=IDS.indexOf(id);
 assert.ok(idx>=0,'Modulo desconhecido');
 const copy=structuredClone(state);
 const m=copy.modules[idx];
 assert.ok(ALLOWED[m.status].includes(to),'Transicao nao permitida: '+m.status+' -> '+to);
 if(m.status==='PENDENTE'&&idx>0)assert.equal(copy.modules[idx-1].status,'APROVADO','Modulo anterior nao aprovado');
 if(to==='AGUARDANDO_APROVACAO'){
  assert.ok(urlOk(evidenceUrl),'Aguardando aprovacao exige link de PR/CI confirmado');
  assert.ok(shaOk(approvedSha),'Aguardando aprovacao exige commit testado/publicado');
  m.evidenceUrl=evidenceUrl;m.approvedSha=approvedSha;
 }
 if(to==='APROVADO'){
  assert.ok(typeof note==='string'&&note.trim().length>=8,'Aprovacao expressa nao registrada');
  assert.ok(urlOk(m.evidenceUrl)&&shaOk(m.approvedSha),'Aprovacao sem evidencias anteriores');
  m.reviewNote=note.trim();
 }
 if(to==='REPROVADO'){
  assert.ok(typeof note==='string'&&note.trim().length>=8,'Reprovacao sem motivo');
  m.reviewNote=note.trim();
 }
 const old=m.status;
 m.status=to;
 copy.history.push({module:id,from:old,to,on:new Date().toISOString(),note:String(note).trim()});
 validateState(copy);
 return copy;
}

export function checkModuleBranch(state,head,base='preview'){
 validateState(state);
 const match=/^(?:feat|fix)\/beta1-(0[1-9])-[a-z0-9-]+$/.exec(head);
 if(!match)return null; // normal code/docs PRs use the established workflow
 assert.equal(base,'preview','Modulo Beta 1.0 so pode ter PR para preview');
 const idx=Number(match[1]);
 assert.equal(state.modules[idx-1].status,'APROVADO','Nao iniciar '+IDS[idx]+' antes de aprovar '+IDS[idx-1]);
 assert.ok(['EM_DESENVOLVIMENTO','EM_TESTES','REPROVADO'].includes(state.modules[idx].status),
  IDS[idx]+' nao foi liberado no registro central');
 return IDS[idx];
}

function readCurrent(){return validateState(JSON.parse(readFileSync(STATE_PATH,'utf8')));}
function flag(name){const ix=process.argv.indexOf(name);return ix>=0?process.argv[ix+1]??'':'';}

function main(){
 const command=process.argv[2];
 if(command==='validate'){
  const m=readCurrent();console.log('B1-00: estado valido; '+m.modules.map(x=>x.id+'='+x.status).join(', '));return;
 }
 if(command==='pr'){
  const head=process.env.BETA1_HEAD??'';
  const base=process.env.BETA1_BASE??'';
  const sha=process.env.BETA1_BASE_SHA??'';
  assert.ok(head&&base&&shaOk(sha),'Contexto de PR incompleto');
  // The first B1-00 PR installs the state file. Other non-Beta PRs remain on normal CI.
  if(!/^(?:feat|fix)\/beta1-0[1-9]-[a-z0-9-]+$/.test(head)){
   console.log('B1-00: PR comum/preparacao; CI normal obrigatoria');return;
  }
  // Read the trusted base branch state, never the manifest controlled by a PR author.
  const raw=execFileSync('git',['show',sha+':'+STATE_PATH],{encoding:'utf8'});
  const baseState=validateState(JSON.parse(raw));
  const changed=execFileSync('git',['diff','--name-only',sha,'HEAD'],{encoding:'utf8'}).trim().split('\n');
  const module=checkModuleBranch(baseState,head,base);
  if(module)assert.ok(!changed.includes(STATE_PATH),'PR de gameplay nao altera estado central; registrar mudancas na preview separadamente');
  console.log('B1-00: PR verificado; '+(module??'nao e modulo Beta numerado'));
  return;
 }
 if(command==='transition'){
  const id=process.argv[3],to=process.argv[4];
  const state=transition(readCurrent(),id,to,{note:flag('--note'),evidenceUrl:flag('--evidence')||null,approvedSha:flag('--sha')||null});
  writeFileSync(STATE_PATH,JSON.stringify(state,null,2)+'\n');
  console.log('B1-00: transicao gravada localmente; revisar diff e criar commit. Nao implica deploy ou autorizacao.');
  return;
 }
 throw Error('Uso: node scripts/beta1-control.mjs validate | pr | transition B1-XX ESTADO [--note ...] [--evidence URL] [--sha COMMIT]');
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
 try{main();}catch(e){console.error('B1-00 gate FALHOU:',e.message);process.exitCode=1;}
}
