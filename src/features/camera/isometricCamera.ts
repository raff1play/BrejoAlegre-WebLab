import {ArcRotateCamera,Scene,Vector3} from '@babylonjs/core';

export function createIsometricCamera(scene:Scene,initialTarget:Vector3):ArcRotateCamera {
  const camera=new ArcRotateCamera('isometric-camera',-Math.PI/3,1.0,28,initialTarget,scene);
  camera.lowerRadiusLimit=12;
  camera.upperRadiusLimit=46;
  camera.lowerBetaLimit=.68;
  camera.upperBetaLimit=1.28;
  camera.inputs.clear();
  return camera;
}
export function rotateCamera(camera:ArcRotateCamera,deltaRadians:number):void {
  camera.alpha+=deltaRadians;
}
export function zoomCamera(camera:ArcRotateCamera,deltaRadius:number):void {
  camera.radius=Math.min(camera.upperRadiusLimit??46,Math.max(camera.lowerRadiusLimit??12,camera.radius+deltaRadius));
}
