/** Fictional, persistent workweek. The first playable date is Monday, 16 Nov 2026. */
export const CALENDAR_START_UTC = Date.UTC(2026,10,16);
export const CALENDAR_STORAGE_KEY = 'brejo-log003-workday-index';
export type DemandTier = 'alta'|'normal'|'media'|'fraca'|'folga';
export type DayPlan = Readonly<{
  weekday: number; name: string; tier: DemandTier; storeMin: number; storeMax: number;
  vanMin: number; vanMax: number; depotTarget: number; depotTolerance: number;
}>;
export const WEEK: readonly DayPlan[] = [
  {weekday:0,name:'Segunda',tier:'alta',storeMin:4,storeMax:5,vanMin:12,vanMax:15,depotTarget:16,depotTolerance:16},
  {weekday:1,name:'Terça',tier:'alta',storeMin:4,storeMax:5,vanMin:12,vanMax:15,depotTarget:16,depotTolerance:16},
  {weekday:2,name:'Quarta',tier:'normal',storeMin:3,storeMax:4,vanMin:8,vanMax:11,depotTarget:15,depotTolerance:16},
  {weekday:3,name:'Quinta',tier:'media',storeMin:3,storeMax:4,vanMin:8,vanMax:11,depotTarget:15,depotTolerance:16},
  {weekday:4,name:'Sexta',tier:'media',storeMin:3,storeMax:4,vanMin:8,vanMax:11,depotTarget:15,depotTolerance:16},
  {weekday:5,name:'Sábado',tier:'fraca',storeMin:2,storeMax:3,vanMin:5,vanMax:7,depotTarget:15,depotTolerance:16},
  {weekday:6,name:'Domingo',tier:'folga',storeMin:0,storeMax:0,vanMin:0,vanMax:0,depotTarget:0,depotTolerance:0},
];
export type CalendarDay = DayPlan & {index:number; date:string; label:string; minParcels:number; maxParcels:number; seed:number};
export function calendarDay(index:number):CalendarDay {
 if(!Number.isSafeInteger(index)||index<0||index>36500)throw new Error('Dia de calendário inválido');
 const plan=WEEK[index%7]!,at=new Date(CALENDAR_START_UTC+index*86400000);
 const date=at.toISOString().slice(0,10);
 return {...plan,index,date,label:`${plan.name}, ${date.slice(8,10)}/${date.slice(5,7)}/${date.slice(0,4)}`,
  minParcels:8*plan.storeMin+plan.vanMin,maxParcels:8*plan.storeMax+plan.vanMax,
  seed:(2026+index*7919)>>>0};
}
export function nextWorkday(index:number):CalendarDay{
 let next=index+1;while(WEEK[next%7]!.tier==='folga')next++;return calendarDay(next);
}
export function calendarWeek(index:number):CalendarDay[] {
 const start=index-index%7;return WEEK.map((_,i)=>calendarDay(start+i));
}
