import {COURIER_LABEL} from '../../core/delivery/couriers';
import type {LogisticsDay} from '../../core/delivery/logisticsDay';
import {SECTORS,SECTOR_DATA,SECTOR_CENTRE,sectorOf} from '../../core/delivery/sectors';
import {ROADS,STORES} from '../../world/city/cityPlan';
import {calendarWeek,type CalendarDay} from '../../core/delivery/operatingCalendar';
/** Consultation lives in the pause screen, leaving the driving HUD and touch controls clear. */
export class LogisticsPanel {
 private readonly lines:HTMLDivElement;private readonly button:HTMLButtonElement;
 private readonly nextButton:HTMLButtonElement;private readonly calendarStatus:HTMLParagraphElement;private last=-1;
 constructor(doc:Document,day:LogisticsDay,hour:()=>number,resume:()=>void,selected:CalendarDay|null,nextDay:()=>void){
  const panel=doc.createElement('details');panel.id='logistics-panel';panel.open=true;
  const title=doc.createElement('summary');title.textContent='Logística — equipe e quatro setores';panel.append(title);
  this.lines=doc.createElement('div');this.lines.className='logistics-lines';panel.append(this.lines);
  this.button=doc.createElement('button');this.button.id='release-team';this.button.className='primary wide';panel.append(this.button);
  this.button.onclick=()=>{if(day.release(hour()))resume();};
  const mapToggle=doc.createElement('details'),mapTitle=doc.createElement('summary');mapTitle.textContent='Mapa dos setores • norte geográfico ↑';mapToggle.append(mapTitle);
  const canvas=doc.createElement('canvas');canvas.width=480;canvas.height=400;canvas.style.width='100%';canvas.id='sector-map';mapToggle.append(canvas);panel.append(mapToggle);
  const schedule=doc.createElement('details');schedule.id='game-calendar';
  const calendarTitle=doc.createElement('summary');calendarTitle.textContent='Calendário de trabalho · demanda semanal';schedule.append(calendarTitle);
  this.calendarStatus=doc.createElement('p');this.calendarStatus.className='calendar-current';schedule.append(this.calendarStatus);
  const grid=doc.createElement('div');grid.className='calendar-week';schedule.append(grid);
  for(const entry of calendarWeek(selected?.index??0)){
    const tile=doc.createElement('div');tile.className='calendar-day'+(entry.index===selected?.index?' selected':'');
    const name=doc.createElement('strong');name.textContent=entry.name.slice(0,3);
    const date=doc.createElement('small');date.textContent=entry.date.slice(8,10)+'/'+entry.date.slice(5,7);
    const tier=doc.createElement('span');tier.textContent=entry.tier==='folga'?'Folga':entry.tier.toUpperCase();
    const volumes=doc.createElement('small');volumes.textContent=entry.tier==='folga'?'Sem coleta':entry.minParcels+'–'+entry.maxParcels+' vol.';
    tile.append(name,date,tier,volumes);grid.append(tile);
  }
  this.nextButton=doc.createElement('button');this.nextButton.id='next-workday';this.nextButton.textContent='Encerrar e iniciar próximo dia útil';this.nextButton.onclick=nextDay;this.nextButton.disabled=true;schedule.append(this.nextButton);
  const note=doc.createElement('p');note.className='calendar-note';note.textContent='Quarta: normal; domingo: folga (configuração inicial). A demanda é sorteada por dia e permanece fixa durante a jornada.';schedule.append(note);
  panel.append(schedule);
  doc.querySelector('.pause-actions')!.after(panel);this.map(canvas,day);
 }
 update(day:LogisticsDay,hour:number,time:number):void{
  if(time-this.last<.5)return;this.last=time;
  const fmt=(h:number)=>`${String(Math.floor(h)).padStart(2,'0')}:${String(Math.floor((h%1)*60)).padStart(2,'0')}`;
  const status=day.calendar?.tier.toUpperCase()??'CENÁRIO DE TESTE';
  const expected=day.calendar?.depotTarget??15;
  this.calendarStatus.textContent=day.calendar?`${day.calendar.label} · demanda ${status} (${day.calendar.minParcels}–${day.calendar.maxParcels} pacotes) · meta de separação ${fmt(expected)}`:'Cenário de testes: seed fixa sem sazonalidade. O calendário semanal continua disponível.';
  this.nextButton.disabled=!day.calendar||!['CONCLUIDA','ENCERRADA'].includes(day.phase);
  const list:string[]=[
   `Seu setor: OESTE / D02 · jornada até 21h · restam ${Math.max(0,Math.floor((21-hour)*60))} min`,
   `NPCs: retorno ideal 14h · tolerância máxima 14h20 · triagem ${fmt(expected)} (meta)`,
   ...day.assigned.map(id=>{const total=day.parcels.filter(p=>p.origin===id);return `${STORES.find(s=>s.id===id)!.name}: ${total.filter(p=>p.state!=='NA_LOJA').length}/${total.length} coletados`;}),
   ...day.couriers.map(c=>`${c.name} (${c.sector}): ${COURIER_LABEL[c.state]} · ${c.returnedAt===null?'retorno pendente':`retornou ${fmt(c.returnedAt)}`}${c.deadlineReported?' · ATRASADO':''} · ${c.trunk(day).length} no baú${c.error?' · acesso bloqueado':''}`),
   `Equipe de base: ${day.depot.workers.length} funcionários · ${day.couriers.filter(c=>c.state==='help-sort').length} motoboys ajudando`,
   `Recebimento/conferência: ${day.parcels.filter(p=>['recebimento','conferencia'].includes(p.place)).length} · triagem/transferência: ${day.parcels.filter(p=>['triagem','transferencia'].includes(p.place)).length}`,
   ...SECTORS.map(s=>{const parcels=day.parcels.filter(p=>p.sector===s);return `${SECTOR_DATA[s].dock} ${s}: ${parcels.filter(p=>p.place==='saca').length} prontos · ${parcels.filter(p=>p.state==='ENTREGUE').length}/${parcels.length} entregues`;}),
   `Separação de todas as cargas: ${day.allSortedAt===null?'em andamento':fmt(day.allSortedAt)} · meta ${fmt(expected)}${day.allSortedAt!==null&&day.allSortedAt>expected?' · FORA DA META':''}`,
   `Van: ${({scheduled:'prevista às 13h',opening:'abrindo portas',unloading:'descarregando',closing:'fechando portas',departed:'saída assistida concluída'})[day.van.state]}`
  ];
  this.lines.replaceChildren(...list.map(s=>{const p=document.createElement('p');p.textContent=s;return p;}));
  this.button.disabled=!day.teamReady||day.released||hour<15||hour>=21;
  this.button.textContent=day.released?'Equipe em rota':day.teamReady?'Equipe pronta — iniciar rota de entregas':'Aguardando quatro cargas guardadas nos baús';
 }
 private map(canvas:HTMLCanvasElement,day:LogisticsDay):void{
  const c=canvas.getContext('2d')!,points=ROADS.flatMap(r=>r.pts),xs=points.map(p=>p[0]),zs=points.map(p=>p[1]);
  const x0=Math.min(...xs)-20,z1=Math.max(...zs)+20,scale=Math.min(460/(Math.max(...xs)-x0+20),380/(z1-Math.min(...zs)+20));
  const project=(x:number,z:number)=>[10+(x-x0)*scale,10+(z1-z)*scale] as const;
  c.fillStyle='#1b292c';c.fillRect(0,0,480,400);
  for(let x=0;x<480;x+=4)for(let y=0;y<400;y+=4){const sector=sectorOf({x:x0+(x-10)/scale,z:z1-(y-10)/scale});c.globalAlpha=.25;c.fillStyle=SECTOR_DATA[sector].color;c.fillRect(x,y,4,4);}c.globalAlpha=1;
  c.strokeStyle='#c6cecb';c.lineWidth=1.2;for(const r of ROADS){c.beginPath();r.pts.forEach((p,i)=>{const q=project(p[0],p[1]);if(i)c.lineTo(...q);else c.moveTo(...q);});c.stroke();}
  for(const a of day.addresses){const p=project(a.door.x,a.door.z);c.fillStyle=SECTOR_DATA[sectorOf(a.door)].color;c.beginPath();c.arc(...p,2.5,0,Math.PI*2);c.fill();}
  const at=project(SECTOR_CENTRE.x,SECTOR_CENTRE.z);c.strokeStyle='#fff';c.beginPath();c.moveTo(at[0]-5,at[1]);c.lineTo(at[0]+5,at[1]);c.moveTo(at[0],at[1]-5);c.lineTo(at[0],at[1]+5);c.stroke();
  c.font='bold 14px sans-serif';c.fillStyle='#fff';c.fillText('↑ N',12,20);SECTORS.forEach((s,i)=>{c.fillStyle=SECTOR_DATA[s].color;c.fillText(s,10+i*115,392);});
 }
}
