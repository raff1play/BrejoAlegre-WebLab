import type {Scene} from '@babylonjs/core/scene';
import type {Materials} from '../../world/materials';
import type {LogisticsDay} from '../../core/delivery/logisticsDay';
import {Motorcycle} from '../driving/motorcycle';
import {NpcPerson,civilianLook} from '../city/npcPerson';
import {SECTOR_DATA} from '../../core/delivery/sectors';
/** Three permanent visual actors; inventories and tasks belong exclusively to LogisticsDay. */
export class CourierViews {
 readonly actors:{bike:Motorcycle;person:NpcPerson}[]=[];
 constructor(scene:Scene,mats:Materials,day:LogisticsDay){
  for(const c of day.couriers){const color=SECTOR_DATA[c.sector].color;
   const bike=new Motorcycle(scene,mats,{paint:color,box:color,helmet:color},c.bike.x,c.bike.z,c.bike.yaw,.15);
   const person=new NpcPerson(scene,mats,`entregador-${c.id}`,civilianLook({shirt:color,trousers:'#30343b',skin:'#ae7e59',hair:'#242522'}));person.showCargo=false;
   this.actors.push({bike,person});
  }
 }
 update(day:LogisticsDay,dt:number,player:{x:number;z:number},ground:(x:number,z:number)=>number):void{
  for(const [i,c]of day.couriers.entries()){const a=this.actors[i]!,near=Math.hypot(player.x-c.bike.x,player.z-c.bike.z)<110;
   a.bike.root.setEnabled(near);a.person.setEnabled(near&&!c.riding);if(!near)continue;
   Object.assign(a.bike.state,c.bike,{speed:c.riding&&c.route.length?8:0});a.bike.setRidden(c.riding);a.bike.setTrunkCargo(c.trunk(day).length);
   if(['stow','unload','take-parcel','return-load'].includes(c.state))a.bike.openTrunk();
   a.bike.renderCourier(dt,ground(c.bike.x,c.bike.z));a.person.activity=c.hands(day).length?'carry':['pickup','deposit','handoff','take-load'].includes(c.state)?'give':'idle';
   if(!c.riding)a.person.follow(c.person.x,c.person.z,c.person.yaw,dt,ground(c.person.x,c.person.z));
  }
 }
}
