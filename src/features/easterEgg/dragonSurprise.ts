import { Color3, Color4 } from '@babylonjs/core/Maths/math.color';
import { Vector3 } from '@babylonjs/core/Maths/math.vector';
import { DynamicTexture } from '@babylonjs/core/Materials/Textures/dynamicTexture';
import { StandardMaterial } from '@babylonjs/core/Materials/standardMaterial';
import { Mesh } from '@babylonjs/core/Meshes/mesh';
import { MeshBuilder } from '@babylonjs/core/Meshes/meshBuilder';
import { TransformNode } from '@babylonjs/core/Meshes/transformNode';
import { VertexData } from '@babylonjs/core/Meshes/mesh.vertexData';
import { ParticleSystem } from '@babylonjs/core/Particles/particleSystem';
import { PointLight } from '@babylonjs/core/Lights/pointLight';
import { DragonAudio } from './dragonAudio';
import { LocalDragonModel } from './localDragonModel';
import type { ArcRotateCamera } from '@babylonjs/core/Cameras/arcRotateCamera';
import type { Scene } from '@babylonjs/core/scene';
import { DRAGON_DURATION, DRAGON_MESSAGE, dragonCanStart, dragonPhase } from '../../core/dragonSurprise.ts';

export type DragonBike = Readonly<{ x: number; y: number; z: number; yaw: number; speed: number; riding: boolean }>;
type Spark = { x: number; y: number; hue: number; seed: number };

/**
 * One-shot, disposable 3D easter egg. Never touches collision, the motorcycle,
 * game physics or the normal renderer. Loaded only if ?dragon=1 is present.
 */
export class DragonSurprise {
  private fired = false;
  private done = false;
  private t = 0;
  private dragon: TransformNode | null = null;
  private leftWing: TransformNode | null = null;
  private rightWing: TransformNode | null = null;
  private rocket: Mesh | null = null;
  private skyPlane: Mesh | null = null;
  private textTexture: DynamicTexture | null = null;
  private sparkTexture: DynamicTexture | null = null;
  private flame: ParticleSystem | null = null;
  private coreFire: ParticleSystem | null = null;
  private smoke: ParticleSystem | null = null;
  private fireLight: PointLight | null = null;
  private scalesTexture: DynamicTexture | null = null;
  private readonly audio = new DragonAudio();
  private readonly model: LocalDragonModel;
  private trail: ParticleSystem | null = null;
  private burst: ParticleSystem | null = null;
  private readonly paints: StandardMaterial[] = [];
  private readonly flameAt = Vector3.Zero();
  private readonly trailAt = Vector3.Zero();
  private readonly burstAt = Vector3.Zero();
  private sparkPoints: Spark[] = [];
  private lastPaint = -1;
  private flameOn = false;
  private trailOn = false;
  private burstOn = false;

  constructor(
    private readonly scene: Scene,
    private readonly camera: ArcRotateCamera,
    private readonly announce: (message: string) => void,
  ) {
    this.model = new LocalDragonModel(scene, () => this.fired);
  }

  get status(): 'waiting' | 'playing' | 'finished' {
    return this.done ? 'finished' : this.fired ? 'playing' : 'waiting';
  }

  update(dt: number, bike: DragonBike): void {
    this.audio.update(bike.speed, bike.riding);
    if (this.done || !Number.isFinite(dt)) return;
    if (!this.fired) {
      if (!dragonCanStart(bike.speed, bike.riding)) return;
      this.fired = true;
      this.create();
      this.audio.roar();
      this.announce('UM DRAGÃO! Prepare-se para o espetáculo!');
    }
    this.t += Math.max(0, Math.min(dt, 0.05));
    this.model.update(this.t);
    if (dragonPhase(this.t) === 'finished') {
      this.dispose();
      this.done = true;
      return;
    }
    const scale = Math.max(0.48, Math.min(1.14, this.camera.radius / 16));
    const towardCamera = this.camera.position.subtract(this.camera.target).normalize();
    const right = Vector3.Cross(Vector3.Up(), towardCamera).normalize();
    const up = Vector3.Cross(towardCamera, right).normalize();
    const centre = new Vector3(bike.x, bike.y + 1.0, bike.z);
    const above = (rightAmount: number, upAmount: number) =>
      centre.add(right.scale(rightAmount * scale)).add(up.scale(upAmount * scale));
    const drag = this.dragon!;
    const approach = Math.min(1, this.t / 2.2);
    const ease = approach * approach * (3 - 2 * approach);
    const exit = Math.max(0, Math.min(1, (this.t - 4.0) / 1.4));
    const horizontal = -9 + 5.9 * ease + 13 * exit * exit;
    drag.position.copyFrom(above(horizontal, 1.5 + Math.sin(this.t * 5) * 0.13));
    drag.scaling.setAll(scale * (this.model.ready ? 0.42 : 0.88));
    drag.rotation.y = Math.atan2(centre.x - drag.position.x, centre.z - drag.position.z);
    drag.rotation.z = Math.sin(this.t * 2.6) * 0.075;
    if (this.leftWing) this.leftWing.rotation.z = -0.27 - Math.sin(this.t * 8.2) * 0.36;
    if (this.rightWing) this.rightWing.rotation.z = 0.27 + Math.sin(this.t * 8.2) * 0.36;
    drag.computeWorldMatrix(true);

    if (this.t >= 2.2 && this.t < 4.1) {
      // Rigged Ashwing has a dedicated mouth socket. Procedural fallback stays unchanged.
      const socket = this.model.mouthWorldPosition();
      this.flameAt.copyFrom(socket ?? Vector3.TransformCoordinates(new Vector3(0, 0.23, 1.55), drag.getWorldMatrix()));
      const v = centre.subtract(this.flameAt).normalize().scale(12);
      this.flame!.direction1.copyFrom(v.add(new Vector3(-1.1, -0.5, -0.7)));
      this.flame!.direction2.copyFrom(v.add(new Vector3(1.1, 0.5, 0.7)));
      this.coreFire!.direction1.copyFrom(v.add(new Vector3(-0.4, -0.3, -0.4)));
      this.coreFire!.direction2.copyFrom(v.add(new Vector3(0.4, 0.3, 0.4)));
      this.smoke!.direction1.copyFrom(v.scale(0.65).add(new Vector3(-1.8, -1, -1.8)));
      this.smoke!.direction2.copyFrom(v.scale(0.65).add(new Vector3(1.8, 1, 1.8)));
      if (!this.flameOn) {
        this.flame!.start(); this.coreFire!.start(); this.smoke!.start();
        this.flameOn = true;
        this.audio.fire();
      }
      this.fireLight!.position.copyFrom(this.flameAt);
      this.fireLight!.intensity = 1.85 + Math.sin(this.t * 22) * 0.35;
    } else if (this.flameOn) {
      this.flame!.stop(); this.coreFire!.stop(); this.smoke!.stop();
      this.fireLight!.intensity = 0;
      this.flameOn = false;
    }

    const sky = above(0, 3.0);
    const label = this.skyPlane!;
    label.position.copyFrom(sky);
    label.scaling.setAll(scale);
    if (this.t < 5.3) label.visibility = 0;
    else label.visibility = Math.min(1, (this.t - 5.3) / 0.4) *
      Math.max(0, Math.min(1, (DRAGON_DURATION - this.t) / 1.25));

    if (this.t >= 4.1 && this.t < 5.3) {
      const f = (this.t - 4.1) / 1.2;
      const rear = new Vector3(
        bike.x - Math.sin(bike.yaw) * 1.0 + Math.cos(bike.yaw) * 0.2,
        bike.y + 0.65,
        bike.z - Math.cos(bike.yaw) * 1.0 - Math.sin(bike.yaw) * 0.2,
      );
      this.rocket!.isVisible = true;
      this.rocket!.position.copyFrom(Vector3.Lerp(rear, sky, f));
      this.rocket!.position.addInPlace(right.scale(Math.sin(f * Math.PI) * scale * 1.4));
      this.trailAt.copyFrom(this.rocket!.position);
      if (!this.trailOn) { this.trail!.start(); this.trailOn = true; this.audio.launch(); }
    } else {
      this.rocket!.isVisible = false;
      if (this.trailOn) { this.trail!.stop(); this.trailOn = false; }
    }

    if (this.t >= 5.3) {
      this.burstAt.copyFrom(sky);
      if (!this.burstOn) {
        this.burst!.start();
        this.burstOn = true;
        this.announce(DRAGON_MESSAGE + '!');
        this.audio.fireworks();
      }
      if (this.t >= 6.1) this.burst!.stop();
      if (this.t - this.lastPaint > 0.12) {
        this.paintText();
        this.lastPaint = this.t;
      }
    }
  }

  private material(name: string, color: string, emissive = 0): StandardMaterial {
    const m = new StandardMaterial('surpresa-' + name, this.scene);
    const c = Color3.FromHexString(color);
    m.diffuseColor = c;
    m.emissiveColor = c.scale(emissive);
    m.specularColor = new Color3(0.12, 0.12, 0.12);
    m.backFaceCulling = false;
    this.paints.push(m);
    return m;
  }

  private sphere(name: string, parent: TransformNode, material: StandardMaterial,
    x: number, y: number, z: number, sx: number, sy: number, sz: number): Mesh {
    const mesh = MeshBuilder.CreateSphere('surpresa-' + name, { diameter: 1, segments: 14 }, this.scene);
    mesh.position.set(x, y, z);
    mesh.scaling.set(sx, sy, sz);
    mesh.material = material;
    mesh.parent = parent;
    mesh.isPickable = false;
    return mesh;
  }

  private wing(parent: TransformNode, side: -1 | 1, mat: StandardMaterial): TransformNode {
    const pivot = new TransformNode('surpresa-asa-pivo', this.scene);
    pivot.parent = parent;
    pivot.position.set(side * 0.6, 0.35, -0.2);
    const wing = new Mesh('surpresa-asa', this.scene);
    const verts = [
      0,0,0, side*1.3,.8,.1, side*2.9,1.7,-.2, side*4,1.35,-.65,
      side*2.75,.25,-.77, side*3.5,-.15,-1.51, side*2.1,-.2,-1.39,
      side*2.3,-.85,-2.13, side*1.1,-.36,-1.57, side*.45,-.5,-1.2,
    ];
    const data = new VertexData();
    data.positions = verts;
    data.indices = Array.from({length:verts.length/3-2},(_,i)=>[0,i+1,i+2]).flat();
    const normals: number[] = [];
    VertexData.ComputeNormals(verts, data.indices, normals);
    data.normals = normals;
    data.applyToMesh(wing);
    wing.material = mat;
    wing.parent = pivot;
    wing.isPickable = false;
    const rib = this.material('asa-ossos', '#241c18');
    for(const [i,p] of [[side*2.9,1.7,-.2],[side*4,1.35,-.65],[side*3.5,-.15,-1.51],[side*2.3,-.85,-2.13]].entries()){
      const endpoint = p as number[];
      const mesh = MeshBuilder.CreateTube('surpresa-asa-nervura-'+i,{
        path:[Vector3.Zero(), new Vector3(endpoint[0]*.56,endpoint[1]*.56,endpoint[2]*.56),
          new Vector3(endpoint[0],endpoint[1],endpoint[2])],
        radius:i===0?.065:.043,tessellation:5,
      },this.scene);
      mesh.material=rib;mesh.parent=pivot;mesh.isPickable=false;
    }
    return pivot;
  }

  private makeScaleTexture(): DynamicTexture {
    const tex=new DynamicTexture('surpresa-escamas',{width:256,height:256},this.scene,true);
    const ctx=tex.getContext() as CanvasRenderingContext2D;
    ctx.fillStyle='#322f29';ctx.fillRect(0,0,256,256);
    let seed=82315;const random=()=>{seed=(Math.imul(seed,1664525)+1013904223)|0;return (seed>>>0)/4294967296};
    for(let row=0;row<16;row++)for(let col=-1;col<17;col++){
      const x=col*20+(row%2)*10,y=row*17,v=Math.floor(random()*24);
      ctx.fillStyle='rgb('+(43+v)+','+(40+Math.floor(v*.8))+','+(35+Math.floor(v*.65))+')';
      ctx.beginPath();ctx.moveTo(x-9,y+1);ctx.quadraticCurveTo(x-12,y+13,x,y+19);
      ctx.quadraticCurveTo(x+12,y+13,x+9,y+1);ctx.closePath();ctx.fill();
      ctx.strokeStyle='rgba(9,7,6,.5)';ctx.lineWidth=1.5;ctx.stroke();
    }
    tex.update(false);return tex;
  }

  private createDragon(): void {
    const realistic = this.model.begin();
    if (realistic) { this.dragon = realistic; return; }
    const dragon=new TransformNode('surpresa-dragao-ancestral',this.scene);
    this.dragon=dragon;
    const scales=this.material('escamas-sombrias','#e3d3bd');
    this.scalesTexture=this.makeScaleTexture();scales.diffuseTexture=this.scalesTexture;
    scales.specularColor=new Color3(.15,.12,.1);
    const belly=this.material('peito-couro','#59413a');
    const wingMat=this.material('membrana-sangue-seco','#57292d');
    const ivory=this.material('ossos','#b8a28b');
    const eyes=this.material('olhos-brasa','#ff5b18',2.1);
    const abyss=this.material('boca-escura','#160c0d');
    const teeth=this.material('presas','#f2dfb6');
    const embers=this.material('garganta-brasa','#e63b08',1.3);
    this.sphere('torax',dragon,scales,0,0,-.3,1.5,1.06,2.5);
    this.sphere('peito',dragon,belly,0,-.3,.35,1.02,.68,1.55);
    this.sphere('pescoço',dragon,scales,0,.4,.96,.76,.84,1.2);
    this.sphere('cranio',dragon,scales,0,.72,1.55,.98,.71,1.08);
    this.sphere('focinho',dragon,scales,0,.47,2.05,.8,.36,.94);
    this.sphere('mandibula',dragon,abyss,0,.2,2.09,.70,.20,.84);
    this.sphere('garganta',dragon,embers,0,.30,2.40,.36,.045,.5);
    for(const side of [-1,1] as const){
      this.sphere('sobrancelha',dragon,scales,side*.52,.99,1.91,.46,.15,.35);
      this.sphere('olho',dragon,eyes,side*.5,.90,2.00,.16,.10,.09);
      this.sphere('pupila',dragon,abyss,side*.502,.9,2.07,.05,.09,.035);
      this.sphere('narina',dragon,abyss,side*.32,.61,2.51,.095,.075,.06);
      for(let n=0;n<5;n++){
        const fang=MeshBuilder.CreateCylinder('surpresa-presa',{
          diameterTop:0,diameterBottom:.08,height:.22-n*.012,tessellation:6,
        },this.scene);
        fang.position.set(side*(.12+n*.105),.15,2.47-n*.1);
        fang.rotation.x=.28;fang.material=teeth;fang.parent=dragon;
      }
      for(let i=0;i<3;i++){
        const horn=MeshBuilder.CreateCylinder('surpresa-chifre',{
          height:.67+i*.07,diameterTop:0,diameterBottom:.18-i*.028,tessellation:8,
        },this.scene);
        horn.position.set(side*(.29+i*.2),1.23-i*.12,1.68-i*.32);
        horn.rotation.z=side*.58;horn.rotation.x=-.67;
        horn.material=ivory;horn.parent=dragon;
      }
      for(const z of [.84,-.96]){
        this.sphere('ombro',dragon,scales,side*.69,-.34,z,.42,.48,.45);
        this.sphere('pata',dragon,scales,side*.89,-.8,z+.12,.29,.46,.30);
        for(let i=0;i<3;i++){
          const claw=MeshBuilder.CreateCylinder('surpresa-garra',{height:.32,diameterTop:0,diameterBottom:.10,tessellation:6},this.scene);
          claw.position.set(side*(.73+i*.16),-1.12,z+.39);
          claw.rotation.x=.76;claw.material=abyss;claw.parent=dragon;
        }
      }
    }
    for(let i=0;i<11;i++){
      const z=.9-i*.46,rad=Math.max(.12,.60-i*.038);
      this.sphere('cauda',dragon,scales,0,.1-i*.028,z-.78,rad,.30*(rad/.60),.59);
      const spine=MeshBuilder.CreateCylinder('surpresa-espinha',{
        height:.43-i*.015,diameterTop:0,diameterBottom:.25-i*.011,tessellation:7,
      },this.scene);
      spine.position.set(0,.78-i*.08,z);spine.rotation.x=-.48;
      spine.material=ivory;spine.parent=dragon;
    }
    for(let i=0;i<22;i++){
      const a=i*2.399963;
      this.sphere('placa-pele',dragon,ivory,Math.sin(a)*.69,.44+Math.cos(a)*.22,-1.12+(i%6)*.27,.17,.075,.25);
    }
    this.leftWing=this.wing(dragon,-1,wingMat);
    this.rightWing=this.wing(dragon,1,wingMat);

    // Merge unanimated pieces per material; moving wing meshes keep their own pivots.
    const groups=new Map<unknown,Mesh[]>();
    for(const m of dragon.getChildMeshes(false)){
      if(!(m instanceof Mesh) || m.parent!==dragon)continue;
      const items=groups.get(m.material)??[];items.push(m);groups.set(m.material,items);
    }
    for(const items of groups.values()){
      if(items.length<2)continue;
      const merged=Mesh.MergeMeshes(items,true,true,undefined,false,true);
      if(merged){merged.parent=dragon;merged.isPickable=false;}
    }
  }

  private makeSparkTexture(): DynamicTexture {
    const texture = new DynamicTexture('surpresa-faisca', { width: 64, height: 64 }, this.scene, false);
    const ctx = texture.getContext() as CanvasRenderingContext2D;
    const glow = ctx.createRadialGradient(32, 32, 1, 32, 32, 31);
    glow.addColorStop(0, 'rgba(255,255,255,1)');
    glow.addColorStop(0.25, 'rgba(255,247,160,.95)');
    glow.addColorStop(0.65, 'rgba(255,115,16,.5)');
    glow.addColorStop(1, 'rgba(255,30,0,0)');
    ctx.fillStyle = glow;
    ctx.fillRect(0, 0, 64, 64);
    texture.hasAlpha = true;
    texture.update();
    return texture;
  }

  private particle(name: string, capacity: number, emitter: Vector3, rate: number): ParticleSystem {
    const p = new ParticleSystem('surpresa-' + name, capacity, this.scene);
    p.particleTexture = this.sparkTexture!;
    p.emitter = emitter;
    p.emitRate = rate;
    p.minSize = 0.08;
    p.maxSize = 0.24;
    p.minLifeTime = 0.2;
    p.maxLifeTime = 0.55;
    p.minEmitPower = 0.2;
    p.maxEmitPower = 1.2;
    p.gravity = Vector3.Zero();
    p.color1 = new Color4(1, 0.82, 0.18, 1);
    p.color2 = new Color4(1, 0.23, 0.06, 0.9);
    p.colorDead = new Color4(1, 0.1, 0.02, 0);
    p.blendMode = ParticleSystem.BLENDMODE_ONEONE;
    return p;
  }

  private makeText(): void {
    const texture = new DynamicTexture('surpresa-letras', { width: 1024, height: 256 }, this.scene, false);
    texture.hasAlpha = true;
    this.textTexture = texture;
    const ctx = texture.getContext() as CanvasRenderingContext2D;
    ctx.clearRect(0, 0, 1024, 256);
    texture.update();

    // Each glowing point is sampled from the actual letters, rather than a plain text HUD.
    const mask = document.createElement('canvas');
    mask.width = 1024;
    mask.height = 256;
    const pen = mask.getContext('2d');
    if (pen) {
      pen.clearRect(0, 0, 1024, 256);
      pen.font = 'bold 132px Arial, sans-serif';
      pen.textAlign = 'center';
      pen.fillStyle = '#fff';
      pen.fillText(DRAGON_MESSAGE, 512, 167, 970);
      const pixels = pen.getImageData(0, 0, 1024, 256).data;
      const points: Spark[] = [];
      for (let y = 51; y < 194; y += 8) for (let x = 34; x < 992; x += 8) {
        if (pixels[(y * 1024 + x) * 4 + 3]! > 140) {
          points.push({ x, y, hue: (x * 17 + y * 23) % 5, seed: (x * 7 + y * 11) % 13 });
        }
      }
      this.sparkPoints = points.sort((a, b) => a.x - b.x);
    }

    const label = MeshBuilder.CreatePlane('surpresa-marcos-pato', { width: 10, height: 2.5 }, this.scene);
    label.billboardMode = Mesh.BILLBOARDMODE_ALL;
    label.isPickable = false;
    label.visibility = 0;
    const mat = new StandardMaterial('surpresa-escrita', this.scene);
    mat.diffuseTexture = texture;
    mat.useAlphaFromDiffuseTexture = true;
    mat.disableLighting = true;
    mat.emissiveColor = Color3.White();
    mat.backFaceCulling = false;
    label.material = mat;
    this.paints.push(mat);
    this.skyPlane = label;
  }

  private paintText(): void {
    if (!this.textTexture) return;
    const ctx = this.textTexture.getContext() as CanvasRenderingContext2D;
    ctx.clearRect(0, 0, 1024, 256);
    const reveal = Math.min(1, Math.max(0, (this.t - 5.3) / 1.55));
    ctx.textAlign = 'center';
    ctx.font = 'bold 132px Arial, sans-serif';
    ctx.shadowColor = '#ffb82b';
    ctx.shadowBlur = 18;
    ctx.fillStyle = 'rgba(255,168,20,' + (0.42 * reveal).toFixed(3) + ')';
    ctx.fillText(DRAGON_MESSAGE, 512, 167, 970);
    ctx.shadowBlur = 0;
    const total = Math.floor(this.sparkPoints.length * reveal);
    const palette = ['#ffde5c', '#ffffff', '#ff8a35', '#6bf9ff', '#ffa4fa'];
    for (let i = 0; i < total; i++) {
      const spark = this.sparkPoints[i]!;
      ctx.fillStyle = palette[(spark.hue + Math.floor(this.t * 7 + spark.seed)) % palette.length]!;
      const size = ((i + Math.floor(this.t * 8)) % 9 === 0) ? 4 : 2.7;
      ctx.fillRect(spark.x - size / 2, spark.y - size / 2, size, size);
    }
    this.textTexture.update(false);
  }

  private create(): void {
    this.createDragon();
    this.sparkTexture = this.makeSparkTexture();
    this.makeText();
    this.flame = this.particle('fogo-externo', 260, this.flameAt, 280);
    this.flame.minSize=.25;this.flame.maxSize=.95;
    this.flame.minEmitPower=9;this.flame.maxEmitPower=16;
    this.flame.minLifeTime=.24;this.flame.maxLifeTime=.6;
    this.flame.color1=new Color4(1,.28,.02,.89);
    this.flame.color2=new Color4(.82,.06,.01,.75);
    this.coreFire=this.particle('fogo-nucleo',170,this.flameAt,220);
    this.coreFire.minSize=.14;this.coreFire.maxSize=.45;
    this.coreFire.minEmitPower=12;this.coreFire.maxEmitPower=19;
    this.coreFire.minLifeTime=.18;this.coreFire.maxLifeTime=.35;
    this.coreFire.color1=new Color4(1,1,.79,1);
    this.coreFire.color2=new Color4(1,.64,.05,.94);
    this.smoke=this.particle('fumo',100,this.flameAt,95);
    this.smoke.minSize=.32;this.smoke.maxSize=1;
    this.smoke.minEmitPower=7;this.smoke.maxEmitPower=12;
    this.smoke.minLifeTime=.45;this.smoke.maxLifeTime=1.1;
    this.smoke.gravity.set(0,1.3,0);
    this.smoke.color1=new Color4(.12,.1,.09,.60);
    this.smoke.color2=new Color4(.30,.16,.12,.38);
    this.smoke.blendMode=ParticleSystem.BLENDMODE_STANDARD;
    this.fireLight=new PointLight('surpresa-iluminacao-fogo',this.flameAt,this.scene);
    this.fireLight.diffuse=new Color3(1,.22,.03);
    this.fireLight.range=8;this.fireLight.intensity=0;
    this.trail = this.particle('escapamento', 100, this.trailAt, 130);
    this.trail.direction1.set(-1.3, -2.3, -1.3);
    this.trail.direction2.set(1.3, -0.2, 1.3);
    this.trail.minSize = 0.08;
    this.trail.maxSize = 0.19;
    this.burst = this.particle('fogos', 320, this.burstAt, 400);
    this.burst.direction1.set(-7, -2, -7);
    this.burst.direction2.set(7, 7, 7);
    this.burst.minEmitPower = 2;
    this.burst.maxEmitPower = 6;
    this.burst.minLifeTime = 0.5;
    this.burst.maxLifeTime = 1.1;
    this.burst.color1 = new Color4(0.3, 0.96, 1, 1);
    this.burst.color2 = new Color4(1, 0.28, 0.75, 1);

    this.rocket = MeshBuilder.CreateSphere('surpresa-foguete', { diameter: 0.2, segments: 6 }, this.scene);
    this.rocket.material = this.material('foguete', '#ffe76e', 1.0);
    this.rocket.isPickable = false;
    this.rocket.isVisible = false;
  }

  dispose(): void {
    this.flame?.stop(); this.coreFire?.stop(); this.smoke?.stop(); this.trail?.stop(); this.burst?.stop();
    this.flame?.dispose(false); this.coreFire?.dispose(false); this.smoke?.dispose(false); this.trail?.dispose(false); this.burst?.dispose(false);
    this.flame = null; this.coreFire = null; this.smoke = null; this.trail = null; this.burst = null;
    this.fireLight?.dispose();this.fireLight=null;
    if (this.model.ready) this.model.dispose();
    else { this.dragon?.dispose(false, false); this.model.dispose(); }
    this.dragon = null;
    this.rocket?.dispose(); this.rocket = null;
    this.skyPlane?.dispose(); this.skyPlane = null;
    this.sparkTexture?.dispose(); this.sparkTexture = null;
    this.scalesTexture?.dispose();this.scalesTexture=null;
    this.textTexture?.dispose(); this.textTexture = null;
    for (const material of this.paints) material.dispose();
    this.paints.length = 0;
    this.sparkPoints = [];
  }
}
