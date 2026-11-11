import { MeshBuilder, Scene, TransformNode, Vector3 } from '@babylonjs/core';
import { solid } from '../../world/materials';
import { GameInput } from '../controls/input';
import type { MotionGuard } from '../../core/collision';

export type VehicleState = { speedMps: number; yaw: number };

export class Motorcycle {
  readonly root: TransformNode;
  readonly state: VehicleState = {speedMps:0, yaw:0};
  private rider: TransformNode;
  private wheels: ReturnType<typeof MeshBuilder.CreateCylinder>[] = [];

  constructor(scene: Scene) {
    const steel = solid(scene,'moto-chassis','#22282d');
    const paint = solid(scene,'moto-vermelha','#a72c2d');
    const rubber = solid(scene,'moto-pneus','#16191b');
    const chrome = solid(scene,'metal','#7c8488');
    const boxMat = solid(scene,'bau-preto','#272b2d');
    const skin = solid(scene,'skin','#c6a180');
    const jeans = solid(scene,'pants','#2b4b64');
    const jacket = solid(scene,'jacket','#252b33');
    this.root = new TransformNode('moto-root',scene);
    this.root.position.set(0,0,8);
    const body = MeshBuilder.CreateBox('fuel-tank',{width:.7,height:.4,depth:1.1},scene);
    body.position.set(0,1.08,.18);body.material=paint;body.parent=this.root;
    const saddle = MeshBuilder.CreateBox('saddle',{width:.6,height:.13,depth:.8},scene);
    saddle.position.set(0,1.18,-.38); saddle.material=steel;saddle.parent=this.root;
    const engine = MeshBuilder.CreateBox('engine',{width:.65,height:.57,depth:.55},scene);
    engine.position.set(0,.72,-.02);engine.material=chrome;engine.parent=this.root;
    for(const z of [-.86,.89]) {
      const wheel = MeshBuilder.CreateCylinder(`wheel-${z}`,{diameter:.76,height:.18,tessellation:18},scene);
      wheel.rotation.z=Math.PI/2; wheel.position.set(0,.43,z); wheel.material=rubber;wheel.parent=this.root;
      this.wheels.push(wheel);
    }
    const handle = MeshBuilder.CreateBox('handlebar',{width:1.05,height:.08,depth:.11},scene);
    handle.position.set(0,1.48,.67);handle.material=steel;handle.parent=this.root;
    const cargo = MeshBuilder.CreateBox('cargo-box',{width:.86,height:.7,depth:.85},scene);
    cargo.position.set(0,1.47,-1.00);cargo.material=boxMat;cargo.parent=this.root;
    const stripe = MeshBuilder.CreateBox('cargo-stripe',{width:.88,height:.07,depth:.88},scene);
    stripe.position.set(0,1.76,-1.00);stripe.material=chrome;stripe.parent=this.root;
    this.rider = new TransformNode('rider',scene);this.rider.parent=this.root;
    const torso = MeshBuilder.CreateBox('rider-body',{width:.6,height:.7,depth:.4},scene);
    torso.position.set(0,1.7,-.34);torso.material=jacket;torso.parent=this.rider;
    const helmet=MeshBuilder.CreateSphere('helmet',{diameter:.53,segments:12},scene);
    helmet.position.set(0,2.27,-.23);helmet.material=steel;helmet.parent=this.rider;
    for(const side of [-1,1]) {
      const leg=MeshBuilder.CreateBox(`leg-${side}`,{width:.17,height:.58,depth:.2},scene);
      leg.position.set(side*.36,1.1,-.38);leg.material=jeans;leg.parent=this.rider;
      const arm=MeshBuilder.CreateBox(`arm-${side}`,{width:.17,height:.58,depth:.18},scene);
      arm.position.set(side*.37,1.51,.02);arm.rotation.x=-.35;arm.material=skin;arm.parent=this.rider;
    }
  }

  setRiderVisible(visible: boolean): void { this.rider.setEnabled(visible); }

  update(dt: number, input: GameInput, mayMove: MotionGuard): void {
    const acceleration=3.2;
    if(input.pressed('accelerate')) this.state.speedMps += acceleration*dt;
    else if(input.pressed('brake')) this.state.speedMps -= 6*dt;
    else this.state.speedMps *= Math.pow(.94,dt*60);
    this.state.speedMps = Math.max(-2, Math.min(14,this.state.speedMps));
    if(Math.abs(this.state.speedMps)<.03) this.state.speedMps=0;
    const steer=(input.pressed('left')?1:0)-(input.pressed('right')?1:0);
    this.state.yaw += steer * dt * (this.state.speedMps/7) * .9;
    this.root.rotation.y=this.state.yaw;
    const next = this.root.position.add(new Vector3(Math.sin(this.state.yaw),0,Math.cos(this.state.yaw)).scale(this.state.speedMps*dt));
    if (mayMove(next.x, next.z, 0.55)) this.root.position.copyFrom(next);
    else this.state.speedMps = 0;
    this.root.rotation.z += ((-steer*.12*Math.min(1,Math.abs(this.state.speedMps)/6)) - this.root.rotation.z) * Math.min(1,dt*5);
    // The wheels rotate visually. This is deliberately NOT rigid-body motorcycle physics.
    for(const wheel of this.wheels) wheel.rotation.x += this.state.speedMps*dt/.38;
  }
}
