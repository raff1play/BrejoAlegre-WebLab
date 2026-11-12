import { Color3, Color4 } from '@babylonjs/core/Maths/math.color';
import { Vector3 } from '@babylonjs/core/Maths/math.vector';
import { DynamicTexture } from '@babylonjs/core/Materials/Textures/dynamicTexture';
import { StandardMaterial } from '@babylonjs/core/Materials/standardMaterial';
import { Mesh } from '@babylonjs/core/Meshes/mesh';
import { MeshBuilder } from '@babylonjs/core/Meshes/meshBuilder';
import { TransformNode } from '@babylonjs/core/Meshes/transformNode';
import { VertexData } from '@babylonjs/core/Meshes/mesh.vertexData';
import { ParticleSystem } from '@babylonjs/core/Particles/particleSystem';
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
  ) {}

  get status(): 'waiting' | 'playing' | 'finished' {
    return this.done ? 'finished' : this.fired ? 'playing' : 'waiting';
  }

  update(dt: number, bike: DragonBike): void {
    if (this.done || !Number.isFinite(dt)) return;
    if (!this.fired) {
      if (!dragonCanStart(bike.speed, bike.riding)) return;
      this.fired = true;
      this.create();
      this.announce('UM DRAGÃO! Prepare-se para o espetáculo!');
    }
    this.t += Math.max(0, Math.min(dt, 0.05));
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
    drag.scaling.setAll(scale * 0.88);
    drag.rotation.y = Math.atan2(centre.x - drag.position.x, centre.z - drag.position.z);
    drag.rotation.z = Math.sin(this.t * 2.6) * 0.075;
    this.leftWing!.rotation.z = -0.27 - Math.sin(this.t * 8.2) * 0.36;
    this.rightWing!.rotation.z = 0.27 + Math.sin(this.t * 8.2) * 0.36;
    drag.computeWorldMatrix(true);

    if (this.t >= 2.2 && this.t < 4.1) {
      this.flameAt.copyFrom(Vector3.TransformCoordinates(new Vector3(0, 0.23, 1.55), drag.getWorldMatrix()));
      const v = centre.subtract(this.flameAt).normalize().scale(12);
      this.flame!.direction1.copyFrom(v.add(new Vector3(-1.1, -0.5, -0.7)));
      this.flame!.direction2.copyFrom(v.add(new Vector3(1.1, 0.5, 0.7)));
      if (!this.flameOn) { this.flame!.start(); this.flameOn = true; }
    } else if (this.flameOn) {
      this.flame!.stop();
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
      if (!this.trailOn) { this.trail!.start(); this.trailOn = true; }
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
    const mesh = MeshBuilder.CreateSphere('surpresa-' + name, { diameter: 1, segments: 9 }, this.scene);
    mesh.position.set(x, y, z);
    mesh.scaling.set(sx, sy, sz);
    mesh.material = material;
    mesh.parent = parent;
    mesh.isPickable = false;
    return mesh;
  }

  private horn(parent: TransformNode, mat: StandardMaterial, x: number, y: number, z: number, height: number): void {
    const h = MeshBuilder.CreateCylinder('surpresa-chifre', {
      height, diameterTop: 0, diameterBottom: 0.19, tessellation: 7,
    }, this.scene);
    h.material = mat;
    h.position.set(x, y, z);
    h.rotation.x = -0.5;
    h.parent = parent;
    h.isPickable = false;
  }

  private wing(parent: TransformNode, side: -1 | 1, mat: StandardMaterial): TransformNode {
    const pivot = new TransformNode('surpresa-asa-pivo', this.scene);
    pivot.parent = parent;
    pivot.position.set(side * 0.6, 0.35, -0.2);
    const wing = new Mesh('surpresa-asa', this.scene);
    const verts = [
      0, 0, 0,
      side * 2.8, 1.1, -0.35,
      side * 2.2, -0.1, -1.15,
      side * 1.2, 0.2, -1.45,
    ];
    const data = new VertexData();
    data.positions = verts;
    data.indices = [0, 1, 2, 0, 2, 3];
    const normals: number[] = [];
    VertexData.ComputeNormals(verts, data.indices, normals);
    data.normals = normals;
    data.applyToMesh(wing);
    wing.material = mat;
    wing.parent = pivot;
    wing.isPickable = false;
    return pivot;
  }

  private createDragon(): void {
    const dragon = new TransformNode('surpresa-dragao', this.scene);
    this.dragon = dragon;
    const purple = this.material('escamas', '#4b2475');
    const belly = this.material('barriga', '#c18fdf');
    const green = this.material('asas', '#19b7ac', 0.12);
    const gold = this.material('chifres', '#f6cb62', 0.22);
    const eye = this.material('olhos', '#ffe74c', 1);
    const dark = this.material('pupila', '#1a1125');
    this.sphere('corpo', dragon, purple, 0, 0, 0, 1.33, 0.94, 2.2);
    this.sphere('barriga', dragon, belly, 0, -0.28, 0.4, 1.0, 0.62, 1.55);
    this.sphere('pescoco', dragon, purple, 0, 0.37, 0.95, 0.7, 0.82, 1.0);
    this.sphere('cabeca', dragon, purple, 0, 0.65, 1.35, 0.9, 0.7, 1.0);
    this.sphere('focinho', dragon, belly, 0, 0.36, 1.83, 0.66, 0.3, 0.7);
    for (const side of [-1, 1]) {
      this.sphere('olho', dragon, eye, side * 0.37, 0.83, 1.75, 0.14, 0.15, 0.08);
      this.sphere('pupila', dragon, dark, side * 0.38, 0.83, 1.817, 0.065, 0.085, 0.04);
      this.sphere('narina', dragon, dark, side * 0.23, 0.47, 2.15, 0.065, 0.06, 0.05);
      this.horn(dragon, gold, side * 0.34, 1.26, 1.15, 0.8);
      this.sphere('pata', dragon, purple, side * 0.52, -0.48, 0.65, 0.28, 0.5, 0.3);
      this.sphere('pata', dragon, purple, side * 0.46, -0.47, -0.75, 0.25, 0.42, 0.34);
    }
    for (let i = 0; i < 4; i++) {
      this.sphere('cauda', dragon, purple, 0, 0.05 - i * 0.07, -1.25 - i * 0.43,
        0.53 - i * 0.1, 0.43 - i * 0.075, 0.7 - i * 0.09);
    }
    for (let i = 0; i < 4; i++) this.horn(dragon, gold, 0, 0.52, 0.65 - i * 0.55, 0.34);
    this.leftWing = this.wing(dragon, -1, green);
    this.rightWing = this.wing(dragon, 1, green);
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
    this.flame = this.particle('fogo', 190, this.flameAt, 180);
    this.flame.minSize = 0.18;
    this.flame.maxSize = 0.55;
    this.flame.minEmitPower = 8;
    this.flame.maxEmitPower = 12;
    this.flame.minLifeTime = 0.25;
    this.flame.maxLifeTime = 0.48;
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
    this.flame?.stop(); this.trail?.stop(); this.burst?.stop();
    this.flame?.dispose(false); this.trail?.dispose(false); this.burst?.dispose(false);
    this.flame = null; this.trail = null; this.burst = null;
    this.dragon?.dispose(false, false);
    this.dragon = null;
    this.rocket?.dispose(); this.rocket = null;
    this.skyPlane?.dispose(); this.skyPlane = null;
    this.sparkTexture?.dispose(); this.sparkTexture = null;
    this.textTexture?.dispose(); this.textTexture = null;
    for (const material of this.paints) material.dispose();
    this.paints.length = 0;
    this.sparkPoints = [];
  }
}
