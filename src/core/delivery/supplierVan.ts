/** Assisted D05 parking is explicit: street approach is not simulated in this version. */
export class SupplierVan {
 state:'scheduled'|'opening'|'unloading'|'closing'|'departed'='scheduled';
 door=0;
 get present():boolean{return this.state!=='scheduled'&&this.state!=='departed';}
 get unloading():boolean{return this.state==='unloading';}
 update(hour:number,dt:number,pending:boolean,busy:boolean):boolean {
  if(this.state==='scheduled'&&hour>=13){this.state='opening';return true;}
  if(this.state==='opening'){this.door=Math.min(1,this.door+dt/2);if(this.door===1)this.state='unloading';}
  if(this.state==='unloading'&&!pending&&!busy)this.state='closing';
  if(this.state==='closing'){this.door=Math.max(0,this.door-dt/2);if(!this.door)this.state='departed';}
  return false;
 }
}
