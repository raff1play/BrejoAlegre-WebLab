import { StandardMaterial } from '@babylonjs/core/Materials/standardMaterial';
import { Texture } from '@babylonjs/core/Materials/Textures/texture';
import { DynamicTexture } from '@babylonjs/core/Materials/Textures/dynamicTexture';
import { Color3 } from '@babylonjs/core/Maths/math.color';
import type { Scene } from '@babylonjs/core/scene';
import type { BaseTexture } from '@babylonjs/core/Materials/Textures/baseTexture';
import type { GraphicsProfile } from '../config/graphics';
import {
  normalMapFrom,
  paintAsphalt, paintBlockwork, paintCobogo, paintContactShadow, paintHydraulicTile, paintPavers, paintPortuguesePavement,
  paintStoneCladding, paintHousePlates, paintLeafCluster, paintConcrete, paintDirt, paintFoliage, paintGrass, paintPlaster, paintRailing,
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
  readonly stone: LabMaterial;
  readonly cobogo: LabMaterial;
  readonly gutter: LabMaterial;
  /** Alpha-blended ground darkening: u 0–0.5 linear fade, u 0.5–1 round blot. */
  readonly contact: LabMaterial;
  readonly sidewalkAtlas: LabMaterial;
  readonly sidewalkTiles: readonly number[];
  /** Atlas of house number plates (CORE-010): plate i uses v in [1 - (i+1)/8, 1 - i/8], u in [0, 0.5]. */
  readonly plates: LabMaterial;

  constructor(private readonly scene: Scene, private readonly profile: GraphicsProfile) {
    const size = (base: number) => Math.max(64, Math.round(base * profile.textureScale));
    const tex = (name: string, base: number, seed: number, painter: Parameters<typeof paintTexture>[3]) =>
      this.texture(name, () => paintTexture(scene, name, { size: size(base), seed, anisotropy: profile.anisotropy }, painter));

    this.asphalt = this.relief(this.make('asfalto', '#ffffff', { tile: 6, specular: 0.16 }, tex('tx-asfalto', 512, 11, paintAsphalt)), 1.3);
    this.asphalt.material.specularPower = 22;
    const concrete = tex('tx-concreto', 256, 23, paintConcrete);
    this.pavement = this.relief(this.make('calcada', '#ffffff', { tile: 2.2 }, concrete), 0.9);
    this.plazaPaving = this.make('praca-piso', '#e9d9c0', { tile: 1.6 }, concrete);
    this.curb = this.paint('#e4e1d8');
    this.grass = this.make('grama', '#ffffff', { tile: 5 }, tex('tx-grama', 256, 37, paintGrass));
    this.dirt = this.make('terra', '#ffffff', { tile: 6 }, tex('tx-terra', 256, 41, paintDirt));
    this.blockwork = this.relief(this.make('bloco-ceramico', '#ffffff', { tile: 1.2 }, tex('tx-bloco', 256, 53, paintBlockwork)), 3);
    this.roofTiles = this.relief(this.make('telha-ceramica', '#ffffff', { tile: 1.6, specular: 0.07 }, tex('tx-telha', 256, 67, paintRoofTiles)), 3.2);
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

    // W009 showcase surfaces.
    this.stone = this.relief(this.make('pedra-canjiquinha', '#ffffff', { tile: 0.9 }, tex('tx-pedra', 256, 89, paintStoneCladding)), 3);
    const cobogoTexture = this.texture('tx-cobogo', () =>
      paintTexture(scene, 'tx-cobogo', { size: size(128), alpha: true, anisotropy: profile.anisotropy }, paintCobogo));
    this.cobogo = this.make('cobogo', '#ffffff', { tile: 0.8 }, cobogoTexture);
    this.cobogo.material.alphaCutOff = 0.5;
    this.cobogo.material.backFaceCulling = false;
    this.gutter = this.make('sarjeta', '#d9d4c8', { tile: 1.5 }, concrete);
    this.gutter.material.zOffset = -2;
    // The four pavement patterns share ONE 2×2 atlas texture and material (one draw call); the
    // geometry is cut into tile-sized quads so each pattern repeats inside its own quadrant.
    const quadrant = size(256);
    const atlas = this.texture('tx-calcadas', () => paintTexture(scene, 'tx-calcadas',
      { size: quadrant * 2, seed: 91, clamp: true, anisotropy: profile.anisotropy }, (ctx, full, random) => {
        const painters = [
          paintHydraulicTile('#b9473a', '#e7ddc8', '#2f3a3f'), paintPortuguesePavement, paintPavers,
          paintHydraulicTile('#d9b44a', '#6d8f5a', '#efe8d6'),
        ];
        const half = full / 2;
        painters.forEach((painter, i) => {
          ctx.save();
          ctx.translate((i % 2) * half, Math.floor(i / 2) * half);
          ctx.beginPath(); ctx.rect(0, 0, half, half); ctx.clip();
          painter(ctx, half, random);
          ctx.restore();
        });
      }));
    this.sidewalkAtlas = this.make('calcadas', '#ffffff', { tile: 1 }, atlas);
    this.sidewalkAtlas.material.zOffset = -2;
    /** Real-world size (m) of one repeat of each atlas quadrant. */
    this.sidewalkTiles = [0.5, 2.2, 1.2, 0.5];
    const plateTexture = this.texture('tx-placas', () => paintTexture(scene, 'tx-placas',
      { size: 512, clamp: true, anisotropy: profile.anisotropy }, paintHousePlates(['12', '24', '36', '48', '13', '25', '37', '49'])));
    this.plates = this.make('placas-numero', '#ffffff', { receiveShadows: false }, plateTexture);
    const shadowTexture = this.texture('tx-sombra', () =>
      paintTexture(scene, 'tx-sombra', { size: 64, width: 128, alpha: true, clamp: true, anisotropy: 1 }, paintContactShadow));
    this.contact = this.make('sombra-contato', '#000000', { receiveShadows: false }, shadowTexture);
    this.contact.material.useAlphaFromDiffuseTexture = true;
    this.contact.material.disableLighting = true;
    this.contact.material.zOffset = -3;
    this.contact.material.fogEnabled = false;
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

  /**
   * GFX-001: normal map derived from the material's own painted texture. High profile only: on
   * the light (phone) profile the surfaces stay flat-shaded, as before.
   */
  private relief(entry: LabMaterial, strength: number): LabMaterial {
    const m = entry.material;
    if (this.profile.name !== 'desktop' || m.bumpTexture || !(m.diffuseTexture instanceof DynamicTexture)) return entry;
    m.bumpTexture = this.texture(`${m.diffuseTexture.name}-relevo`, () => normalMapFrom(this.scene, `${m.diffuseTexture!.name}-relevo`, m.diffuseTexture as DynamicTexture, strength, this.profile.anisotropy));
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

  /**
   * Tiny painted sky/ground panorama used as a cheap reflection on metal and lacquered paint:
   * one 64×32 texture lookup instead of a real-time environment probe.
   */
  private reflection(): BaseTexture {
    return this.texture('tx-reflexo', () => {
      const texture = paintTexture(this.scene, 'tx-reflexo', { size: 32, width: 64, anisotropy: 1 }, (ctx, h) => {
        const g = ctx.createLinearGradient(0, 0, 0, h);
        g.addColorStop(0, '#4f86c4');
        g.addColorStop(0.42, '#cfe1ef');
        g.addColorStop(0.5, '#f4f1e6');
        g.addColorStop(0.56, '#8d867a');
        g.addColorStop(1, '#3b3833');
        ctx.fillStyle = g;
        ctx.fillRect(0, 0, h * 2, h);
      });
      texture.coordinatesMode = Texture.EQUIRECTANGULAR_MODE;
      return texture;
    });
  }

  private reflective(name: string, specular: number, power: number, level: number): LabMaterial {
    const cached = this.cache.get(name);
    if (cached) return cached;
    const entry = this.make(name, '#ffffff', { specular });
    entry.material.specularPower = power;
    entry.material.reflectionTexture = this.reflection();
    entry.material.reflectionTexture.level = level;
    return entry;
  }

  /** Polished metal (exhaust, rims, mirrors, fork). Shared by every chrome part. */
  chrome(color = '#c3c8cc'): LabMaterial {
    return this.tinted(this.reflective('cromado', 0.9, 110, 0.35), color);
  }

  /**
   * Lacquered vehicle paint / helmet shell: tight bright highlight, no reflection map (an untinted
   * reflection washes dark and saturated colours out).
   */
  lacquer(color: string): LabMaterial {
    const base = this.make('verniz', '#ffffff', { specular: 0.6 });
    base.material.specularPower = 80;
    return this.tinted(base, color);
  }

  /** Flat painted surface. All matte paints share one material, all glossy ones another. */
  paint(color: string, specular = 0.03): LabMaterial {
    const base = specular >= 0.15
      ? this.make('tinta-brilhante', '#ffffff', { specular: 0.45 })
      : this.make('tinta-fosca', '#ffffff', { specular: 0.03 });
    return this.tinted(base, color);
  }

  /**
   * CORE-014: lacquer for thin-instanced NPC vehicles. A separate material from `lacquer` so the
   * instance-colour shader variant never mixes with the player's (faded/alpha) meshes.
   */
  npcLacquer(color: string): LabMaterial {
    const base = this.make('verniz-npc', '#ffffff', { specular: 0.6 });
    base.material.specularPower = 80;
    return this.tinted(base, color);
  }

  /**
   * CORE-014 house-number plates: one atlas with the digits 0–9 (enamel plate: white digits on
   * blue), so every number plate of the town is one draw call. u = digit / 10.
   */
  digits(): LabMaterial {
    const texture = this.texture('tx-numeros', () => paintTexture(this.scene, 'tx-numeros',
      { size: 64, width: 640, clamp: true, anisotropy: this.profile.anisotropy },
      (ctx, size) => {
        const c = ctx as unknown as CanvasRenderingContext2D;
        c.fillStyle = '#1f4f8f'; c.fillRect(0, 0, size * 10, size);
        c.fillStyle = '#ffffff'; c.font = `700 ${Math.round(size * 0.78)}px system-ui, sans-serif`;
        c.textAlign = 'center'; c.textBaseline = 'middle';
        for (let d = 0; d < 10; d++) c.fillText(String(d), d * size + size / 2, size * 0.54);
      }));
    return this.make('placa-numeros', '#ffffff', { receiveShadows: false, emissive: 0.1 }, texture);
  }

  /** CORE-014 shop-window glass: transparent, glossy, shows the interior behind it. */
  glass(): LabMaterial {
    const entry = this.make('vidro-vitrine', '#9fb7c4', { specular: 0.9, receiveShadows: false });
    entry.material.alpha = 0.26;
    entry.material.specularPower = 110;
    entry.material.backFaceCulling = false;
    return entry;
  }

  /** Glowing surface (lamps, tail lights). */
  glow(color: string): LabMaterial {
    // One unlit material for every lamp: the output is the vertex colour itself, so lights of any
    // colour share a single draw call per mesh group.
    let base = this.cache.get('luz');
    if (!base) {
      base = this.make('luz', '#ffffff', { receiveShadows: false });
      // Unlit: final colour = (emissive white) × vertex colour.
      base.material.disableLighting = true;
      base.material.emissiveColor = new Color3(1, 1, 1);
    }
    return this.tinted(base, color);
  }

  /** Plastered wall tinted in `color`; the texture spans the wall height once (see Batch.box fitV). */
  plaster(color: string): LabMaterial {
    const texture = this.texture('tx-reboco', () => paintTexture(this.scene, 'tx-reboco',
      { size: Math.max(64, Math.round(256 * this.profile.textureScale)), seed: 5, anisotropy: this.profile.anisotropy }, paintPlaster));
    return this.tinted(this.relief(this.make('reboco', '#ffffff', { tile: 3 }, texture), 1.1), color);
  }

  /** Corrugated sheet metal tinted in `color`. */
  ribbed(color: string): LabMaterial {
    const texture = this.texture('tx-chapa', () => paintTexture(this.scene, 'tx-chapa',
      { size: 64, seed: 3, anisotropy: this.profile.anisotropy }, paintRibbedMetal));
    return this.tinted(this.make('chapa', '#ffffff', { tile: 1, tileV: 0.8, specular: 0.18 }, texture), color);
  }

  foliage(kind: 'oiti' | 'ipe' | 'ipe-roxo'): LabMaterial {
    const painter = kind === 'oiti'
      ? paintFoliage('#4f7a37', 'rgba(150,185,90,0.35)', 'rgba(34,62,28,0.32)')
      : kind === 'ipe'
        ? paintFoliage('#e8b828', 'rgba(255,232,120,0.5)', 'rgba(170,120,20,0.38)')
        : paintFoliage('#b98ac9', 'rgba(236,200,236,0.5)', 'rgba(120,70,130,0.35)');
    const seed = kind === 'oiti' ? 81 : kind === 'ipe' ? 83 : 85;
    const texture = this.texture(`tx-copa-${kind}`, () => paintTexture(this.scene, `tx-copa-${kind}`,
      { size: Math.max(64, Math.round(256 * this.profile.textureScale)), seed, anisotropy: 2 }, painter));
    return this.make(`copa-${kind}`, '#ffffff', { tile: 1 }, texture);
  }

  /**
   * Alpha-tested leaf-card material per species (CORE-010). Cards are double sided; the alpha test
   * also cuts the shadows, so canopies cast dappled shade.
   */
  leafCards(kind: 'oiti' | 'ipe' | 'ipe-roxo' | 'buganvilia' | 'arbusto'): LabMaterial {
    const palettes: Record<typeof kind, [string[], string[], number]> = {
      oiti: [['#3f6e2f', '#4f8236', '#5f9440', '#365f28', '#6aa04a'], [], 0],
      arbusto: [['#3d6b2d', '#4c7d34', '#5c8f3d', '#335a26'], [], 0],
      ipe: [['#5f8a38', '#4f7a30'], ['#f2c21d', '#f6d24a', '#e5a912', '#fbe27a'], 0.82],
      'ipe-roxo': [['#5f8a38', '#4f7a30'], ['#c48ad6', '#d7a6e2', '#a86bc0', '#e6c2ea'], 0.82],
      buganvilia: [['#3e6e2c', '#4d7f33'], ['#d0338b', '#e0569f', '#b8237a', '#ef7db8'], 0.62],
    };
    const [leaves, blossoms, share] = palettes[kind];
    const name = `tx-cartao-${kind}`;
    const texture = this.texture(name, () => paintTexture(this.scene, name,
      { size: Math.max(128, Math.round(256 * this.profile.textureScale)), alpha: true, seed: 300 + kind.length, anisotropy: 1 },
      paintLeafCluster(leaves, blossoms, share)));
    const entry = this.make(`cartao-${kind}`, '#ffffff', { tile: 1 }, texture);
    entry.material.backFaceCulling = false;
    entry.material.alphaCutOff = 0.45;
    entry.material.specularColor = new Color3(0.04, 0.04, 0.04);
    return entry;
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
