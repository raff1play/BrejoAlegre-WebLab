import { MeshBuilder, Scene, TransformNode, Vector3 } from '@babylonjs/core';
import { solid } from '../../world/materials';
import { GameInput } from '../controls/input';
import type { MotionGuard } from '../../core/collision';

export class Pedestrian {
  readonly root: TransformNode;
  constructor(scene: Scene) {
    this.root=new TransformNode('walking-character',scene);
    this.root.setEnabled(false);
    const clothes=solid(scene,'walk-jacket','#293645');
    const skin=solid(scene,'walk-skin','#c6a180');
    const pants=solid(scene,'walk-pants','#34495e');
    const torso=MeshBuilder.CreateBox('walking-torso',{height:.78,width:.5,depth:.33},scene);
    torso.parent=this.root; torso.position.y=1.18; torso.material=clothes;
    const head=MeshBuilder.CreateSphere('walking-head',{diameter:.42,segments:12},scene);
    head.parent=this.root;head.position.y=1.83;head.material=skin;
    for(const side of [-1,1]) {
      const leg=MeshBuilder.CreateBox(`walking-leg-${side}`,{width:.19,height:.69,depth:.21},scene);
      leg.parent=this.root; leg.position.set(side*.14,.43,0);leg.material=pants;
    }
  }
  update(dt: number,input: GameInput,mayMove:MotionGuard):void {
    const f=(input.pressed('accelerate')?1:0)-(input.pressed('brake')?1:0);
    const side=(input.pressed('right')?1:0)-(input.pressed('left')?1:0);
    const dir=new Vector3(side,0,f);
    if(dir.lengthSquared()>0) {
      dir.normalize();
      const next = this.root.position.add(dir.scale(3*dt));
      if (mayMove(next.x, next.z, 0.3)) this.root.position.copyFrom(next);
      this.root.rotation.y=Math.atan2(dir.x,dir.z);
    }
  }
}
