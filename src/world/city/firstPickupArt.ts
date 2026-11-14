import type { Scene } from '@babylonjs/core/scene';
import { DynamicTexture } from '@babylonjs/core/Materials/Textures/dynamicTexture';
import { StandardMaterial } from '@babylonjs/core/Materials/standardMaterial';
import { Color3 } from '@babylonjs/core/Maths/math.color';
import type { BatchSet } from '../geometry';
import type { LabMaterial, Materials } from '../materials';
import { ballPart, rodPart } from '../modelParts';
import { STORE_SETBACK, storePlan, type Store } from './cityPlan';

/** ART-001: authored only for the default first pickup (seed 2026). No global palette changes. */
export function firstPickupArt(scene: Scene, set: BatchSet, mats: Materials, s: Store): void {
  const W = s.width, H = s.height, L = STORE_SETBACK;
  const p = storePlan(s);
  const cream = mats.plaster('#dec99b'), teal = mats.paint('#285751', .12);
  const iron = mats.paint('#343d3b', .25), rust = mats.paint('#8e4930');
  const box = (m: LabMaterial, x0: number, x1: number, y0: number, y1: number, z0: number, z1: number) => set.box(m, x0, x1, y0, y1, z0, z1);
  const rod = (m: LabMaterial, a: readonly [number, number, number], b: readonly [number, number, number], d = .025) => set.absorb(m, rodPart(scene, a, b, d));
  // A single bespoke painted fascia: lettering, faded sunburst, water streaks, chipped edges.
  const tx = new DynamicTexture('art001-letreiro-pintado', { width: 2048, height: 512 }, scene, false);
  const ctx = tx.getContext() as unknown as CanvasRenderingContext2D;
  ctx.fillStyle = '#d9b66d'; ctx.fillRect(0, 0, 2048, 512);
  ctx.strokeStyle = '#305952'; ctx.lineWidth = 14; ctx.strokeRect(20, 20, 2008, 472);
  ctx.fillStyle = '#305952'; ctx.fillRect(40, 362, 1968, 112);
  ctx.textAlign = 'center'; ctx.fillStyle = '#725535'; ctx.font = 'bold 34px Georgia'; ctx.fillText('MATERIAIS PARA CONSTRUIR SUA HISTÓRIA', 1024, 83);
  ctx.font = '900 174px Georgia'; ctx.fillStyle = '#f4e2ad'; ctx.fillText('DEPÓSITO', 1027, 215);
  ctx.fillStyle = '#2e514b'; ctx.fillText('DEPÓSITO', 1024, 208);
  ctx.font = '900 145px Georgia'; ctx.fillText('DE CONSTRUÇÃO', 1024, 322);
  ctx.font = 'bold 43px sans-serif'; ctx.fillStyle = '#f3dfad'; ctx.fillText('AREIA  •  PEDRA  •  CIMENTO  •  FERRAGENS', 1024, 435);
  // Deterministic painterly wear, not a random shop generator.
  for (let i = 0; i < 950; i++) {
    const x = (i * 293 + 19) % 2048, y = (i * 137 + 7) % 512;
    ctx.fillStyle = i % 3 ? 'rgba(87,66,39,.08)' : 'rgba(246,225,180,.25)';
    ctx.fillRect(x, y, 2 + i % 19, 1 + i % 4);
  }
  for (const x of [78, 384, 1500, 1932]) {ctx.fillStyle = 'rgba(68,50,29,.12)';ctx.fillRect(x, 23, 5, 100 + x % 90);}
  tx.update();
  const material = new StandardMaterial('art001-pintura-letreiro', scene);
  material.diffuseTexture = tx; material.specularColor = Color3.Black();
  const sign: LabMaterial = {material, tileU:1,tileV:1,receiveShadows:true};
  // Raised parapet and thick stepped cornice make a different silhouette.
  box(cream, -.08, W + .08, 3.3, H + .62, L - .09, L + .22);
  box(teal, -.16, W + .16, H + .59, H + .76, L - .22, L + .32);
  box(cream, .12, W - .12, H + .38, H + .51, L - .16, L + .26);
  set.of(sign).quad([.35,3.48,L-.105],[W-.35,3.48,L-.105],[W-.35,H+.35,L-.105],[.35,H+.35,L-.105],1,1);
  // Ceramic wainscot below windows; grouted individual tiles, door aisle stays clear.
  for (const [a,b] of [[.5,p.door0-.3],[p.door1+.3,W-.5]]) {
    box(mats.paint('#b8af94'), a!, b!, .03, .48, L-.035,L);
    for(let x=a!;x<b!-.05;x+=.23) for(let y=.04;y<.46;y+=.14)
      box(mats.paint((Math.round(x*7)+Math.round(y*30))%4 ? '#35675f':'#6b8572',.2),x,Math.min(x+.215,b!),y,y+.125,L-.055,L-.035);
    box(teal,a!,b!,.48,.55,L-.09,L+.05);
    // Thicker recessed joinery and transom bars.
    for(let x=a!;x<=b!;x+=.78) box(teal,x-.025,x+.025,.55,3,L-.045,L+.12);
    box(teal,a!,b!,2.35,2.41,L-.06,L+.14);
  }
  for(const x of [0,p.door0-.23,p.door1,W-.45]) {
    box(cream,x,x+.23,0,3.22,L-.08,L+.02);
    box(teal,x-.02,x+.25,.02,.22,L-.1,L+.04);
  }
  // Exposed brick scars at the outer pier, with a deliberately irregular plaster edge.
  for(let row=0;row<9;row++) for(let col=0;col<2;col++) {
    const x=.025+col*.19+(row%2)*.035;
    if(row>5&&col===1)continue;
    box(mats.paint(row%3?'#ad6849':'#c38256'),x,x+.175,.25+row*.105,.34+row*.105,L-.09,L-.081);
  }
  // Broad corrugated canopy; faded teal sheets and rust seams, curved edge brackets.
  for(let i=0;i<Math.ceil((W-.3)/.28);i++) {
    const x=.15+i*.28, end=Math.min(x+.28,W-.15);
    set.of(mats.paint(i%6===0?'#b7aa83':i%4===0?'#617b69':'#345c54',.15)).quad([x,2.95,L-1.35],[end,2.95,L-1.35],[end,3.34,L-.14],[x,3.34,L-.14],1,1);
    rod(i%3===0?rust:iron,[x,2.96,L-1.35],[x,3.35,L-.14],.014);
  }
  box(teal,.12,W-.12,2.78,2.96,L-1.38,L-1.31);
  for(const x of [.28,W-.28]) {rod(iron,[x,2.5,L],[x,2.95,L-1.3],.035);rod(iron,[x,4.05,L],[x,2.96,L-1.33],.018);}
  // Wall-mounted service mast, meter, conduit and sagging overhead service wires.
  // All ground-level volumes stay within existing solid wall/forecourt footprints.
  const px=W-.25;
  rod(mats.paint('#8b8876'),[px,.15,L-.04],[px,7.4,L-.04],.15);
  rod(iron,[px-.65,6.7,L-.04],[px+.18,6.7,L-.04],.045);
  for(const x of [px-.54,px-.18]) {
    rod(cream,[x,6.68,L-.04],[x,6.92,L-.04],.09);
    let last: readonly [number,number,number]=[x,6.9,L-.04];
    for(let i=1;i<=12;i++){const t=i/12;const next: readonly [number,number,number]=[x-W*.85*t,6.9-.8*Math.sin(t*Math.PI),L-.04];rod(iron,last,next,.018);last=next;}
  }
  box(iron,W-.49,W-.09,1.38,2.0,L-.16,L-.07);
  box(mats.paint('#c9c3ae',.3),W-.46,W-.12,1.42,1.96,L-.18,L-.16);
  set.absorb(mats.glass(),ballPart(scene,[.17,.17,.035],[W-.29,1.73,L-.2],8));
  rod(iron,[W-.29,1.4,L-.14],[W-.29,.1,L-.14],.022);
  // Entry threshold, local paving repairs and curb paint (no steps in the doorway).
  box(mats.stone,p.door0,p.door1,.013,.028,L-.34,L+.15);
  for(const [x,z,w,d] of [[.2,.15,1.1,.4],[W-1.5,.1,1.2,.3],[1.1,.8,.65,.45]])
    box(mats.paint('#a99d83'),x!,x!+w!,.013,.018,z!,z!+d!);
  // Repaired curb and a narrow ceramic border only along this storefront.
  for(let x=.05;x<W-.05;x+=.42) {
    box(mats.paint(Math.round(x*3)%3?'#d7c7a5':'#9b957f'),x,Math.min(x+.38,W),-.148,-.005,-2.21,-2.17);
    for(const z of [-1.98,-.18]) {
      box(teal,x,Math.min(x+.39,W),.014,.02,z,z+.16);
      set.of(mats.paint('#dccda5')).poly([[x+.08,.021,z+.08],[x+.18,.021,z+.015],[x+.29,.021,z+.08],[x+.18,.021,z+.145]],[[0,0],[1,0],[1,1],[0,1]]);
    }
  }
  box(iron,.5,1.3,.018,.023,-1.8,-1.3);
  for(let x=.54;x<1.28;x+=.075)box(mats.paint('#968c75'),x,x+.035,.024,.027,-1.78,-1.32);
  // Small repair scars where water runs beneath the jamb and gutter.
  for(const [x,y,w,h] of [[.12,1.6,.22,.42],[W-.44,.32,.3,.75],[.04,2.8,.34,.15]])
    box(mats.plaster('#a89a76'),x!,x!+w!,y!,y!+h!,L-.085,L-.08);
  // Painted shutters stacked at the display edge, not across the working entrance.
  for(const x0 of [.53,W-1.14]) {
    box(teal,x0,x0+.58,.57,2.92,L-.025,L+.04);
    for(let y=.64;y<2.9;y+=.12)box(mats.paint('#577367'),x0+.04,x0+.54,y,y+.035,L-.045,L-.025);
  }
  const poster=mats.sign('art001-oferta-cimento','#e2cc91','#385349',[
    {text:'CIMENTO',size:.25,color:'#385349',weight:'900'},
    {text:'50 kg',size:.37,color:'#984c2d',weight:'900'},
    {text:'CONSULTE NO BALCÃO',size:.11,color:'#385349'}],.8,256);
  set.of(poster).quad([.65,1.1,L-.055],[1.45,1.1,L-.055],[1.45,2.1,L-.055],[.65,2.1,L-.055],1,1);
  // Bracket lamp and a projecting hardware trade sign above pedestrian height.
  rod(iron,[.2,4.3,L-.1],[.2,4.3,L-1.25],.045);
  rod(iron,[.2,4.3,L-1.2],[.2,4.05,L-1.2],.025);
  set.absorb(iron,rodPart(scene,[.2,4.03,L-1.2],[.2,4.1,L-1.2],.32,.12,12));
  set.absorb(mats.glow('#efd49b'),ballPart(scene,[.14,.07,.14],[.2,4.025,L-1.2],6));
  // A plant in the existing solid forecourt corner: no obstacle in the walking aisle.
  const vx=p.forecourt.x1-.22,vz=p.forecourt.z1-.2;
  set.absorb(mats.paint('#975637'),rodPart(scene,[vx,.15,vz],[vx,.56,vz],.30,.43,12));
  for(let i=0;i<9;i++){
    const a=i*2.4;set.absorb(mats.paint(i%2?'#657b46':'#3e5d3f'),ballPart(scene,[.12,.46,.17],[vx+Math.cos(a)*.16,.67+(i%3)*.1,vz+Math.sin(a)*.14],5));
  }
  // Existing solid display footprint: timber pallet, cement sacks, terracotta pot.
  const f=p.forecourt;
  for(let x=f.x0;x<f.x1;x+=.19)box(mats.paint('#6d5135'),x,Math.min(x+.14,f.x1),.02,.14,f.z0,f.z1);
  for(let k=0;k<5;k++)for(let i=0;i<2;i++)set.absorb(mats.paint(k%2?'#aba58b':'#c4bda1'),ballPart(scene,[.68,.16,.48],[f.x0+.42+i*.72,.23+k*.15,(f.z0+f.z1)/2],6));
  // Interior fascia above stock shelving; remains behind existing solid display.
  const note=mats.sign('art001-balcao','#285751','#f1dbac',[{text:'RETIRADA • FALE COM TONINHO',size:.45,color:'#f1dbac',weight:'800'}],6,128);
  set.of(note).quad([.6,2.5,s.depth-.29],[W-.6,2.5,s.depth-.29],[W-.6,2.95,s.depth-.29],[.6,2.95,s.depth-.29],1,1);
}
