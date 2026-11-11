import './style.css';
import { Color4, DirectionalLight, Engine, HemisphericLight, Scene, Vector3 } from '@babylonjs/core';
import { GameInput } from './features/controls/input';
import { Motorcycle } from './features/driving/motorcycle';
import { Pedestrian } from './features/walking/pedestrian';
import { buildTemporaryWorld } from './world/temporaryWorld';
import { currentEnvironment } from './config/environment';
import {createIsometricCamera,rotateCamera,zoomCamera} from './features/camera/isometricCamera';

const canvas=document.querySelector<HTMLCanvasElement>('#renderCanvas');
if(!canvas) throw new Error('Canvas #renderCanvas não encontrado');

const engine=new Engine(canvas,true,{stencil:true,antialias:true,preserveDrawingBuffer:false});
engine.setHardwareScalingLevel(Math.min(2,Math.max(1,window.devicePixelRatio || 1)));
const scene=new Scene(engine);
scene.clearColor=new Color4(.70,.83,.94,1);
const ambient=new HemisphericLight('skylight',new Vector3(0,1,0),scene);
ambient.intensity=.9;
const sun=new DirectionalLight('sun',new Vector3(-.5,-1,.3),scene);
sun.intensity=1.15;

const mayMove = buildTemporaryWorld(scene);
const moto=new Motorcycle(scene);
const onFoot=new Pedestrian(scene);
const input=new GameInput();
let isRiding=true;
const camera=createIsometricCamera(scene,moto.root.position.clone());
scene.activeCamera=camera;

function updateMode():void {
  const mode=document.querySelector<HTMLElement>('#mode');
  const tips=document.querySelector<HTMLElement>('#tips');
  const action=document.querySelector<HTMLButtonElement>('[data-action="mount"]');
  if(mode) mode.textContent=isRiding?'Pilotando':'A pé';
  if(tips) tips.textContent=isRiding?'WASD ou setas: condução · F: descer':'WASD ou setas: andar · F: montar perto da moto';
  if(action) action.textContent=isRiding?'Descer':'Montar';
}
function toggleMount():void {
  if(isRiding) {
    if(Math.abs(moto.state.speedMps)>.4)return;
    isRiding=false;
    moto.setRiderVisible(false);
    onFoot.root.position=moto.root.position.add(new Vector3(-1.4,0,0));
    onFoot.root.setEnabled(true);
  } else {
    if(Vector3.Distance(onFoot.root.position,moto.root.position)>3.4)return;
    isRiding=true;
    onFoot.root.setEnabled(false);
    moto.setRiderVisible(true);
  }
  input.reset();updateMode();
}
window.addEventListener('keydown',event=>{
  if(event.key.toLowerCase()==='f') {event.preventDefault();if(!event.repeat)toggleMount();}
  else if(event.key.toLowerCase()==='q')rotateCamera(camera,-.16);
  else if(event.key.toLowerCase()==='e')rotateCamera(camera,.16);
});
for(const btn of document.querySelectorAll<HTMLButtonElement>('[data-action]')) {
  btn.addEventListener('click',()=>{
    switch(btn.dataset.action) {
      case 'mount':toggleMount();break;
      case 'camera-left':rotateCamera(camera,-.18);break;
      case 'camera-right':rotateCamera(camera,.18);break;
      case 'zoom-in':zoomCamera(camera,-3);break;
      case 'zoom-out':zoomCamera(camera,3);break;
    }
  });
}
canvas.addEventListener('wheel',e=>{
  e.preventDefault();
  zoomCamera(camera,e.deltaY>0?2:-2);
},{passive:false});
const speedEl=document.querySelector<HTMLElement>('#speed');
const fpsEl=document.querySelector<HTMLElement>('#fps');
scene.onBeforeRenderObservable.add(()=>{
  const dt=Math.min(.05,engine.getDeltaTime()/1000);
  if(isRiding)moto.update(dt,input,mayMove);
  else onFoot.update(dt,input,mayMove);
  const target=(isRiding?moto.root:onFoot.root).position.add(new Vector3(0,1.1,0));
  camera.setTarget(Vector3.Lerp(camera.target,target,Math.min(1,dt*4)));
  if(speedEl) speedEl.textContent=String(Math.round(Math.abs(isRiding?moto.state.speedMps:0)*3.6));
  if(fpsEl) fpsEl.textContent=`FPS: ${engine.getFps().toFixed(0)} · ${currentEnvironment.name}`;
});
engine.runRenderLoop(()=>scene.render());
window.addEventListener('resize',()=>engine.resize());
updateMode();
