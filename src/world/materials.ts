import { StandardMaterial } from '@babylonjs/core/Materials/standardMaterial';
import { Color3 } from '@babylonjs/core/Maths/math.color';
import type { Scene } from '@babylonjs/core/scene';
import type { BaseTexture } from '@babylonjs/core/Materials/Textures/baseTexture';
import type { GraphicsProfile } from '../config/graphics';
import {
  paintAsphalt, paintBlockwork, paintConcrete, paintDirt, paintFoliage, paintGrass, paintPlaster, paintRailing,
  paintRibbedMetal, paintRoofTiles, paintSign, paintStripes, paintTexture, paintWindow, paintWoodDoor, type SignLine,
} from './textures';

/** A material plus the real-world size of one texture repeat, used to generate UVs in metres. */
export type LabMaterial = Readonly<{
  material: StandardMaterial; tileU: number; tileV: number; receiveShadows: boolean;
  /** Per-vertex colour (0..1). Parts that differ only in colour share one material and one draw call. */
  tint?: readonly [number, number, number];
}>;

type Options = { tile?: number; tileV?: number; specular?: number; receiveShadows?: boolean; emissive?: number };

export class Materials {
  private readonly cache = new Map<string, LabMaterial>();
  private readonly textures = new Map<string, BaseTexture>();

  readonly asphalt: LabMaterial;
  readonly pavement: LabMaterial;
  readonly curb: LabMaterial;
  readonly plazaPaving: LabMaterial;
  readonly grass: LabMaterial;
  readonly dirt: LabMaterial;
  readonly blockwork: LabMaterial;
  readonly roofTiles: LabMaterial;
  readonly door: LabMaterial;
  readonly window: LabMaterial;
  readonly railing: LabMaterial;
  readonly lineWhite: LabMaterial;
  readonly lineYellow: LabMaterial;
  readonly asphaltPatch: LabMaterial;

  constructor(private readonly scene: Scene, private readonly profile: GraphicsProfile) {
    const size = (base: number) => Math.max(64, Math.round(base * profile.textureScale));
    const tex = (name: string, base: number, seed: number, painter: Parameters<typeof paintTexture>[3]) =>
      this.texture(name, () => paintTexture(scene, name, { size: size(base), seed, anisotropy: profile.anisotropy }, painter));

    this.asphalt = this.make('asfalto', '#ffffff', { tile: 6, specular: 0.05 }, tex('tx-asfalto', 512, 11, paintAsphalt));
    const concrete = tex('tx-concreto', 256, 23, paintConcrete);
    this.pavement = this.make('calcada', '#ffffff', { tile: 2.2 }, concrete);
    this.plazaPaving = this.make('praca-piso', '#e9d9c0', { tile: 1.6 }, concrete);
    this.curb = this.paint('#d6d2c8');
    this.grass = this.make('grama', '#ffffff', { tile: 5 }, tex('tx-grama', 256, 37, paintGrass));
    this.dirt = this.make('terra', '#ffffff', { tile: 6 }, tex('tx-terra', 256, 41, paintDirt));
    this.blockwork = this.make('bloco-ceramico', '#ffffff', { tile: 1.2 }, tex('tx-bloco', 256, 53, paintBlockwork));
    this.roofTiles = this.make('telha-ceramica', '#ffffff', { tile: 1.6, specular: 0.04 }, tex('tx-telha', 256, 67, paintRoofTiles));
    this.door = this.make('porta-madeira', '#ffffff', { tile: 1 }, tex('tx-porta', 128, 71, paintWoodDoor));
    this.window = this.make('janela', '#ffffff', { tile: 1, specular: 0.5 }, tex('tx-janela', 256, 73, paintWindow));
    const railingTexture = this.texture('tx-grade', () =>
      paintTexture(scene, 'tx-grade', { size: size(128), alpha: true, anisotropy: profile.anisotropy }, paintRailing));
    this.railing = this.make('grade-ferro', '#ffffff', { tile: 1, receiveShadows: false }, railingTexture);
    this.railing.material.useAlphaFromDiffuseTexture = false;
    this.railing.material.alphaCutOff = 0.5;
    this.railing.material.backFaceCulling = false;
    // Road paint sits a hair above the asphalt; the depth offset avoids flicker without a visible gap.
    const roadPaint = this.make('tinta-de-solo', '#ffffff');
    roadPaint.material.zOffset = -2;
    this.lineWhite = this.tinted(roadPaint, '#e9e7df');
    this.lineYellow = this.tinted(roadPaint, '#e3b93a');
    this.asphaltPatch = this.tinted(roadPaint, '#3f4042');
  }

  private texture(name: string, create: () => BaseTexture): BaseTexture {
    let texture = this.textures.get(name);
    if (!texture) { texture = create(); this.textures.set(name, texture); }
    return texture;
  }

  private make(name: string, color: string, options: Options = {}, texture?: BaseTexture): LabMaterial {
    const cached = this.cache.get(name);
    if (cached) return cached;
    const material = new StandardMaterial(name, this.scene);
    material.diffuseColor = Color3.FromHexString(color);
    const specular = options.specular ?? 0.02;
    material.specularColor = new Color3(specular, specular, specular);
    material.specularPower = 48;
    if (options.emissive) material.emissiveColor = Color3.FromHexString(color).scale(options.emissive);
    if (texture) material.diffuseTexture = texture;
    const entry: LabMaterial = {
      material, tileU: options.tile ?? 1, tileV: options.tileV ?? options.tile ?? 1,
      receiveShadows: options.receiveShadows ?? true,
    };
    this.cache.set(name, entry);
    return entry;
  }

  private tinted(base: LabMaterial, color: string): LabMaterial {
    const key = `${base.material.name}#${color}`;
    let entry = this.cache.get(key);
    if (!entry) {
      const c = Color3.FromHexString(color);
      entry = { ...base, tint: [c.r, c.g, c.b] };
      this.cache.set(key, entry);
    }
    return entry;
  }

  /** Flat painted surface. All matte paints share one material, all glossy ones another. */
  paint(color: string, specular = 0.03): LabMaterial {
    const base = specular >= 0.15
      ? this.make('tinta-brilhante', '#ffffff', { specular: 0.45 })
      : this.make('tinta-fosca', '#ffffff', { specular: 0.03 });
    return this.tinted(base, color);
  }

  /** Glowing surface (lamps, tail lights). */
  glow(color: string): LabMaterial {
    return this.make(`luz-${color}`, color, { emissive: 0.9, receiveShadows: false });
  }

  /** Plastered wall tinted in `color`; the texture spans the wall height once (see Batch.box fitV). */
  plaster(color: string): LabMaterial {
    const texture = this.texture('tx-reboco', () => paintTexture(this.scene, 'tx-reboco',
      { size: Math.max(64, Math.round(256 * this.profile.textureScale)), seed: 5, anisotropy: this.profile.anisotropy }, paintPlaster));
    return this.tinted(this.make('reboco', '#ffffff', { tile: 3 }, texture), color);
  }

  /** Corrugated sheet metal tinted in `color`. */
  ribbed(color: string): LabMaterial {
    const texture = this.texture('tx-chapa', () => paintTexture(this.scene, 'tx-chapa',
      { size: 64, seed: 3, anisotropy: this.profile.anisotropy }, paintRibbedMetal));
    return this.tinted(this.make('chapa', '#ffffff', { tile: 1, tileV: 0.8, specular: 0.18 }, texture), color);
  }

  foliage(kind: 'oiti' | 'ipe'): LabMaterial {
    const painter = kind === 'oiti'
      ? paintFoliage('#4a7036', 'rgba(125,160,75,0.35)', 'rgba(30,58,26,0.35)')
      : paintFoliage('#e0b32a', 'rgba(255,228,110,0.45)', 'rgba(160,115,20,0.35)');
    const texture = this.texture(`tx-copa-${kind}`, () => paintTexture(this.scene, `tx-copa-${kind}`,
      { size: Math.max(64, Math.round(256 * this.profile.textureScale)), seed: kind === 'oiti' ? 81 : 83, anisotropy: 2 }, painter));
    return this.make(`copa-${kind}`, '#ffffff', { tile: 1 }, texture);
  }

  stripes(name: string, a: string, b: string, count: number, diagonal: boolean, tile: number): LabMaterial {
    const texture = this.texture(`tx-${name}`, () => paintTexture(this.scene, `tx-${name}`,
      { size: 128, anisotropy: this.profile.anisotropy }, paintStripes(a, b, count, diagonal)));
    return this.make(name, '#ffffff', { tile }, texture);
  }

  /** Text board; the texture covers the face exactly once (tile = board size is handled by the caller). */
  sign(name: string, background: string, border: string, lines: SignLine[], aspect: number, height = 256): LabMaterial {
    const texture = this.texture(`tx-${name}`, () => paintTexture(this.scene, `tx-${name}`,
      { size: height, width: Math.round(height * aspect), clamp: true, anisotropy: this.profile.anisotropy },
      paintSign(background, border, lines, aspect)));
    return this.make(name, '#ffffff', { receiveShadows: false, emissive: 0.12 }, texture);
  }
}
