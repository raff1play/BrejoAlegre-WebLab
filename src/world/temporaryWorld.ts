import { MeshBuilder, Scene, Vector3 } from '@babylonjs/core';
import { solid } from './materials';
import { createMotionGuard, type Box2D } from '../core/collision';

/** Fictional placeholder! Do not represent this as verified cartography of Brejo Alegre. */
export function buildTemporaryWorld(scene: Scene): ReturnType<typeof createMotionGuard> {
  const blockers: Box2D[] = [];
  const grass = solid(scene, 'capim', '#7b966b');
  const road = solid(scene, 'asfalto', '#404750');
  const roadMark = solid(scene, 'faixas', '#dec980');
  const sidewalk = solid(scene, 'calcada', '#b9b3a3');
  const wall = solid(scene, 'muro', '#e0d6bf');
  const roof = solid(scene, 'telha', '#a9573a');
  const trunkMat = solid(scene, 'tronco', '#594432');
  const foliage = solid(scene, 'folhagem', '#557a45');
  const houseColors = ['#e6d6bd', '#d5dbd0', '#f2e4cf', '#f0d3bf'];
  const ground = MeshBuilder.CreateGround('terrain', { width: 130, height: 130 }, scene);
  ground.material = grass;
  const street = MeshBuilder.CreateGround('street', { width: 9.5, height: 120 }, scene);
  street.position.y = 0.015; street.material = road;
  const cross = MeshBuilder.CreateGround('crossroad', { width: 120, height: 8.2 }, scene);
  cross.position.y = 0.016; cross.position.z = -23; cross.material = road;
  for (const x of [-5.3, 5.3]) {
    const curb = MeshBuilder.CreateBox(`sidewalk-${x}`, {width: 1.8, height: .17, depth: 120}, scene);
    curb.position.set(x, .09, 0); curb.material = sidewalk;
  }
  for (let i=-55; i<=55; i+=7) {
    if (Math.abs(i + 23) < 6) continue;
    const stripe = MeshBuilder.CreateBox(`stripe-${i}`, { width: .13, height: .025, depth: 3 }, scene);
    stripe.position.set(0, .03, i); stripe.material = roadMark;
  }
  for (let side of [-1, 1]) {
    for (let i=0; i<10; i++) {
      const z = -49 + i*11.5;
      if (Math.abs(z + 23) < 7 || (side === -1 && i === 6)) continue;
      const x = side * (10.5 + (i%2)*1.1);
      const house = MeshBuilder.CreateBox(`house-${side}-${i}`, {width: 7, height: 3.4, depth: 7}, scene);
      house.position.set(x, 1.79, z);
      blockers.push({minX:x-3.5,maxX:x+3.5,minZ:z-3.5,maxZ:z+3.5});
      house.material = solid(scene, `wall-${side}-${i}`, houseColors[i%4]);
      const top = MeshBuilder.CreateBox(`roof-${side}-${i}`, {width: 7.8, height: .34, depth: 7.8}, scene);
      top.position.set(x, 3.62, z); top.material = roof;
      const garage = MeshBuilder.CreateBox(`gate-${side}-${i}`, {width: .12, height: 2.2, depth: 2.4}, scene);
      garage.position.set(x - side*3.57, 1.2, z); garage.material = wall;
      const treeX = side * 18.6;
      if (i%2===0) {
        const trunk = MeshBuilder.CreateCylinder(`tree-trunk-${side}-${i}`, {height: 2.8, diameter: .34}, scene);
        trunk.position.set(treeX, 1.4, z+4); trunk.material = trunkMat;
        const crown = MeshBuilder.CreateSphere(`tree-crown-${side}-${i}`, {diameter: 3.4, segments: 8}, scene);
        crown.position.set(treeX, 3.55, z+4); crown.material = foliage;
      }
    }
  }
  // A simple distinctive shop for driving landmark; not an operational pickup site.
  const shop = MeshBuilder.CreateBox('placeholder-shop', {width: 8.7, height: 4.1, depth: 8.5},scene);
  shop.position = new Vector3(-10.9, 2.15, 20);
  blockers.push({minX:-15.25,maxX:-6.55,minZ:15.75,maxZ:24.25});
  shop.material = solid(scene, 'shop-cream', '#f7d4ac');
  const awning = MeshBuilder.CreateBox('shop-awning', {width: 3.7, height: .3, depth: 8.7},scene);
  awning.position = new Vector3(-5.75, 2.7, 20); awning.material = solid(scene,'shop-awning-red','#b24c34');
  return createMotionGuard({minX:-64,maxX:64,minZ:-64,maxZ:64},blockers);
}
