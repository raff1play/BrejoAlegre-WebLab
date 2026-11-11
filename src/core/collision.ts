export type Box2D = Readonly<{minX:number;maxX:number;minZ:number;maxZ:number}>;
export type MotionGuard = (x:number,z:number,radius:number)=>boolean;

/** Pure, deterministic, axis-aligned collision approximation for the disposable web lab. */
export function circleIntersectsBox(x:number,z:number,radius:number,box:Box2D):boolean {
  if (!Number.isFinite(x) || !Number.isFinite(z) || !Number.isFinite(radius) || radius < 0) return true;
  const closestX=Math.max(box.minX,Math.min(x,box.maxX));
  const closestZ=Math.max(box.minZ,Math.min(z,box.maxZ));
  return (x-closestX)**2+(z-closestZ)**2 <= radius**2;
}
export function createMotionGuard(bounds:Box2D,obstacles:readonly Box2D[]):MotionGuard {
  return (x,z,r)=> {
    if (![x,z,r].every(Number.isFinite) || r < 0) return false;
    if (x-r < bounds.minX || x+r > bounds.maxX || z-r < bounds.minZ || z+r > bounds.maxZ) return false;
    return !obstacles.some(o=>circleIntersectsBox(x,z,r,o));
  };
}
