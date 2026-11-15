/** Convex XZ surface subtraction. Cuts geometry, rather than hiding competing floors by depth bias. */
export type SurfacePoint = readonly [number,number];
const EPS=1e-9;
export const surfaceArea=(p:readonly SurfacePoint[]):number=>Math.abs(p.reduce((s,a,i)=>{const b=p[(i+1)%p.length]!;return s+a[0]*b[1]-b[0]*a[1]},0))/2;

/** The subject must be convex; triangulate a concave terrain first. Either winding is accepted. */
export function subtractSurface(subject:readonly SurfacePoint[],hole:readonly SurfacePoint[]):SurfacePoint[][] {
 const signed=hole.reduce((s,a,i)=>{const b=hole[(i+1)%hole.length]!;return s+a[0]*b[1]-b[0]*a[1]},0);
 const sign=signed>=0?1:-1;
 let inside=[...subject];const outside:SurfacePoint[][]=[];
 for(let edge=0;edge<hole.length&&inside.length>=3;edge++){
  const a=hole[edge]!,b=hole[(edge+1)%hole.length]!;
  const distance=(p:SurfacePoint)=>sign*((b[0]-a[0])*(p[1]-a[1])-(b[1]-a[1])*(p[0]-a[0]));
  const split=(keepInside:boolean):SurfacePoint[]=>{
   const out:SurfacePoint[]=[];
   for(let i=0;i<inside.length;i++){
    const p=inside[i]!,q=inside[(i+1)%inside.length]!,dp=distance(p),dq=distance(q);
    const kp=keepInside?dp>=0:dp<=0,kq=keepInside?dq>=0:dq<=0;
    if(kp)out.push(p);
    if(kp!==kq){const t=dp/(dp-dq);out.push([p[0]+(q[0]-p[0])*t,p[1]+(q[1]-p[1])*t]);}
   }
   return out.filter((p,i)=>{const prev=out[(i+out.length-1)%out.length]!;return Math.hypot(p[0]-prev[0],p[1]-prev[1])>EPS});
  };
  const piece=split(false);if(piece.length>=3&&surfaceArea(piece)>EPS)outside.push(piece);
  inside=split(true);
 }
 return outside;
}
