import { DynamicTexture } from '@babylonjs/core/Materials/Textures/dynamicTexture';
import { Texture } from '@babylonjs/core/Materials/Textures/texture';
import type { Scene } from '@babylonjs/core/scene';

/**
 * Every texture in the lab is painted at start-up on a 2D canvas: no downloads, no third-party
 * assets and therefore no licence to track. Deterministic thanks to a seeded generator.
 */
type Ctx = CanvasRenderingContext2D;
type Painter = (ctx: Ctx, size: number, random: () => number) => void;

function seeded(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export type TextureOptions = { size: number; seed?: number; alpha?: boolean; clamp?: boolean; anisotropy: number; width?: number };

export function paintTexture(scene: Scene, name: string, options: TextureOptions, painter: Painter): DynamicTexture {
  const height = options.size;
  const width = options.width ?? options.size;
  const texture = new DynamicTexture(name, { width, height }, scene, true, Texture.TRILINEAR_SAMPLINGMODE);
  const ctx = texture.getContext() as unknown as Ctx;
  if (!options.alpha) { ctx.fillStyle = '#808080'; ctx.fillRect(0, 0, width, height); }
  painter(ctx, height, seeded(options.seed ?? 1));
  texture.hasAlpha = options.alpha === true;
  texture.update(true);
  texture.anisotropicFilteringLevel = options.anisotropy;
  // DynamicTexture clamps by default; tiling surfaces need the texture to repeat.
  const mode = options.clamp ? Texture.CLAMP_ADDRESSMODE : Texture.WRAP_ADDRESSMODE;
  texture.wrapU = mode;
  texture.wrapV = mode;
  return texture;
}

function speckle(ctx: Ctx, size: number, random: () => number, count: number, shades: string[], maxDot = 2): void {
  for (let i = 0; i < count; i++) {
    ctx.fillStyle = shades[Math.floor(random() * shades.length)]!;
    const dot = 1 + random() * (maxDot - 1) * (size / 256);
    ctx.fillRect(random() * size, random() * size, dot, dot);
  }
}

function blotches(ctx: Ctx, size: number, random: () => number, count: number, color: string, radius: number): void {
  for (let i = 0; i < count; i++) {
    const x = random() * size;
    const y = random() * size;
    const r = radius * size * (0.4 + random());
    // Draw wrapped copies so the texture tiles without seams.
    for (const ox of [-size, 0, size]) for (const oy of [-size, 0, size]) {
      const g = ctx.createRadialGradient(x + ox, y + oy, 0, x + ox, y + oy, r);
      g.addColorStop(0, color);
      g.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = g;
      ctx.fillRect(x + ox - r, y + oy - r, r * 2, r * 2);
    }
  }
}

export const paintAsphalt: Painter = (ctx, size, random) => {
  // CORE-010: darker, cleaner asphalt with fine aggregate and only a few faint repairs/cracks.
  ctx.fillStyle = '#4e5054';
  ctx.fillRect(0, 0, size, size);
  blotches(ctx, size, random, 8, 'rgba(30,30,34,0.14)', 0.2);
  blotches(ctx, size, random, 6, 'rgba(120,118,112,0.08)', 0.22);
  speckle(ctx, size, random, size * 40, ['#45474b', '#5b5d61', '#66676a', '#3e4044', '#58564f'], 1.6);
  ctx.strokeStyle = 'rgba(28,28,30,0.3)';
  ctx.lineWidth = Math.max(1, size / 512);
  for (let i = 0; i < 3; i++) {
    let x = random() * size;
    let y = random() * size;
    ctx.beginPath();
    ctx.moveTo(x, y);
    for (let j = 0; j < 7; j++) { x += (random() - 0.5) * size * 0.07; y += (random() - 0.2) * size * 0.05; ctx.lineTo(x, y); }
    ctx.stroke();
  }
};

export const paintConcrete: Painter = (ctx, size, random) => {
  ctx.fillStyle = '#b7b1a5';
  ctx.fillRect(0, 0, size, size);
  blotches(ctx, size, random, 12, 'rgba(90,84,74,0.16)', 0.18);
  blotches(ctx, size, random, 8, 'rgba(235,230,220,0.18)', 0.14);
  speckle(ctx, size, random, size * 14, ['#a39d91', '#c7c1b6', '#958f84', '#bdb7ab'], 2);
  // Expansion joints: two slabs per tile in each direction.
  ctx.strokeStyle = 'rgba(70,66,60,0.5)';
  ctx.lineWidth = Math.max(1.2, size / 150);
  for (const p of [0, size / 2, size]) {
    ctx.beginPath(); ctx.moveTo(p, 0); ctx.lineTo(p, size); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(0, p); ctx.lineTo(size, p); ctx.stroke();
  }
};

/** Light plaster, tinted per house by the material colour. The bottom carries rain splash dirt. */
export const paintPlaster: Painter = (ctx, size, random) => {
  ctx.fillStyle = '#f3f1ec';
  ctx.fillRect(0, 0, size, size);
  blotches(ctx, size, random, 16, 'rgba(160,150,135,0.10)', 0.2);
  speckle(ctx, size, random, size * 10, ['#e9e6df', '#fbfaf7', '#dedad2'], 2);
  for (let i = 0; i < 14; i++) {
    const x = random() * size;
    const g = ctx.createLinearGradient(0, 0, 0, size * (0.3 + random() * 0.5));
    g.addColorStop(0, 'rgba(110,100,88,0.16)');
    g.addColorStop(1, 'rgba(110,100,88,0)');
    ctx.fillStyle = g;
    ctx.fillRect(x, 0, size * (0.01 + random() * 0.02), size);
  }
  const dirt = ctx.createLinearGradient(0, size * 0.78, 0, size);
  dirt.addColorStop(0, 'rgba(120,96,70,0)');
  dirt.addColorStop(1, 'rgba(120,96,70,0.42)');
  ctx.fillStyle = dirt;
  ctx.fillRect(0, size * 0.78, size, size * 0.22);
};

/** Unplastered hollow clay blocks ("tijolo baiano"), typical of side and back walls. */
export const paintBlockwork: Painter = (ctx, size, random) => {
  ctx.fillStyle = '#9a8f82';
  ctx.fillRect(0, 0, size, size);
  const rows = 8;
  const cols = 4;
  const bh = size / rows;
  const bw = size / cols;
  const gap = Math.max(1.5, size / 90);
  for (let r = 0; r < rows; r++) {
    for (let c = -1; c < cols; c++) {
      const tone = 0.86 + random() * 0.22;
      ctx.fillStyle = `rgb(${Math.round(172 * tone)},${Math.round(102 * tone)},${Math.round(72 * tone)})`;
      const x = c * bw + (r % 2 ? bw / 2 : 0);
      ctx.fillRect(x + gap / 2, r * bh + gap / 2, bw - gap, bh - gap);
      ctx.fillStyle = 'rgba(70,35,20,0.22)';
      for (let k = 1; k < 4; k++) ctx.fillRect(x + gap, r * bh + (k * bh) / 4, bw - gap * 2, Math.max(1, size / 256));
    }
  }
  blotches(ctx, size, random, 8, 'rgba(60,50,45,0.18)', 0.16);
};

/** Clay "capa e canal" roof tiles: u runs along the eave, v up the slope. */
export const paintRoofTiles: Painter = (ctx, size, random) => {
  const cols = 8;
  const rows = 4;
  const cw = size / cols;
  const rh = size / rows;
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const tone = 0.8 + random() * 0.3;
      const g = ctx.createLinearGradient(c * cw, 0, (c + 1) * cw, 0);
      const shade = (k: number) => `rgb(${Math.min(255, Math.round(218 * tone * k))},${Math.round(112 * tone * k)},${Math.round(58 * tone * k)})`;
      g.addColorStop(0, shade(0.55));
      g.addColorStop(0.35, shade(1.02));
      g.addColorStop(0.6, shade(1.1));
      g.addColorStop(1, shade(0.6));
      ctx.fillStyle = g;
      ctx.fillRect(c * cw, r * rh, cw + 1, rh + 1);
    }
    const lap = ctx.createLinearGradient(0, r * rh, 0, r * rh + rh * 0.22);
    lap.addColorStop(0, 'rgba(60,22,8,0.55)');
    lap.addColorStop(1, 'rgba(40,16,8,0)');
    ctx.fillStyle = lap;
    ctx.fillRect(0, r * rh, size, rh * 0.22);
  }
  blotches(ctx, size, random, 7, 'rgba(70,40,25,0.16)', 0.14);
  blotches(ctx, size, random, 4, 'rgba(120,125,95,0.1)', 0.1);
};

/**
 * House number plates (CORE-010): `rows` white enamel plates stacked vertically, each with the
 * fictional street name and a number. Shared atlas, so all plates cost one material.
 */
export const paintHousePlates = (numbers: readonly string[]): Painter => (ctx, size) => {
  const w = size / 2;
  const h = size / numbers.length;
  numbers.forEach((n, i) => {
    const y = i * h;
    ctx.fillStyle = '#1d3f7a';
    ctx.fillRect(0, y, w, h);
    ctx.fillStyle = '#f7f6f1';
    ctx.fillRect(w * 0.03, y + h * 0.07, w * 0.94, h * 0.86);
    ctx.fillStyle = '#1d3f7a';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.font = `700 ${h * 0.2}px Arial, sans-serif`;
    ctx.fillText('R. PROVISÓRIA', w / 2, y + h * 0.28, w * 0.86);
    ctx.font = `800 ${h * 0.5}px Arial, sans-serif`;
    ctx.fillText(n, w / 2, y + h * 0.66, w * 0.86);
  });
};

export const paintGrass: Painter = (ctx, size, random) => {
  ctx.fillStyle = '#6a8250';
  ctx.fillRect(0, 0, size, size);
  blotches(ctx, size, random, 16, 'rgba(140,150,80,0.30)', 0.16);
  blotches(ctx, size, random, 10, 'rgba(40,70,30,0.30)', 0.14);
  blotches(ctx, size, random, 5, 'rgba(150,120,80,0.30)', 0.1);
  speckle(ctx, size, random, size * 30, ['#56733f', '#84995a', '#738c50', '#4f6c3a', '#93a468'], 3);
};

export const paintDirt: Painter = (ctx, size, random) => {
  ctx.fillStyle = '#a17a56';
  ctx.fillRect(0, 0, size, size);
  blotches(ctx, size, random, 14, 'rgba(120,80,50,0.3)', 0.18);
  blotches(ctx, size, random, 8, 'rgba(110,140,70,0.35)', 0.12);
  speckle(ctx, size, random, size * 20, ['#8d6947', '#b48d66', '#94714d', '#7f9150'], 3);
};

/** Corrugated sheet (gates, roll-up doors, carport roofs); tinted by the material colour. */
export const paintRibbedMetal: Painter = (ctx, size) => {
  const ribs = 8;
  const rh = size / ribs;
  for (let i = 0; i < ribs; i++) {
    const g = ctx.createLinearGradient(0, i * rh, 0, (i + 1) * rh);
    g.addColorStop(0, '#ffffff');
    g.addColorStop(0.55, '#d9d9d9');
    g.addColorStop(0.9, '#8f8f8f');
    g.addColorStop(1, '#bdbdbd');
    ctx.fillStyle = g;
    ctx.fillRect(0, i * rh, size, rh + 1);
  }
};

export const paintWoodDoor: Painter = (ctx, size, random) => {
  ctx.fillStyle = '#6d4630';
  ctx.fillRect(0, 0, size, size);
  for (let i = 0; i < 60; i++) {
    ctx.fillStyle = `rgba(${random() > 0.5 ? '40,22,12' : '150,100,66'},0.18)`;
    ctx.fillRect(random() * size, 0, 1 + random() * 2, size);
  }
  ctx.strokeStyle = 'rgba(35,20,12,0.8)';
  ctx.lineWidth = size / 40;
  ctx.strokeRect(size * 0.04, size * 0.02, size * 0.92, size * 0.96);
  for (const [y, h] of [[0.08, 0.38], [0.54, 0.38]] as const) ctx.strokeRect(size * 0.18, size * y, size * 0.64, size * h);
  ctx.fillStyle = '#c9c2b4';
  ctx.beginPath(); ctx.arc(size * 0.86, size * 0.5, size * 0.035, 0, Math.PI * 2); ctx.fill();
};

/** Window with a light frame, dark reflective glass and the usual iron bars. */
export const paintWindow: Painter = (ctx, size) => {
  ctx.fillStyle = '#ece9e1';
  ctx.fillRect(0, 0, size, size);
  const m = size * 0.07;
  const glass = ctx.createLinearGradient(0, m, size, size - m);
  glass.addColorStop(0, '#2c4152');
  glass.addColorStop(0.5, '#4f7186');
  glass.addColorStop(0.52, '#253746');
  glass.addColorStop(1, '#1b2832');
  ctx.fillStyle = glass;
  ctx.fillRect(m, m, size - 2 * m, size - 2 * m);
  ctx.fillStyle = '#ece9e1';
  ctx.fillRect(size / 2 - m / 3, m, (m * 2) / 3, size - 2 * m);
  ctx.fillStyle = '#2a2c2e';
  for (let i = 1; i < 8; i++) ctx.fillRect((i * size) / 8 - size / 140, m, size / 70, size - 2 * m);
  for (const y of [0.3, 0.7]) ctx.fillRect(m, size * y, size - 2 * m, size / 70);
};

/** Iron railing with transparent gaps; rendered with alpha test. */
export const paintRailing: Painter = (ctx, size) => {
  ctx.clearRect(0, 0, size, size);
  ctx.fillStyle = '#2b2f33';
  const bars = 8;
  for (let i = 0; i < bars; i++) ctx.fillRect((i + 0.5) * (size / bars) - size / 50, 0, size / 25, size);
  ctx.fillRect(0, size * 0.06, size, size / 18);
  ctx.fillRect(0, size * 0.86, size, size / 18);
};

export const paintFoliage = (base: string, light: string, dark: string): Painter => (ctx, size, random) => {
  ctx.fillStyle = base;
  ctx.fillRect(0, 0, size, size);
  blotches(ctx, size, random, 20, dark, 0.12);
  blotches(ctx, size, random, 20, light, 0.1);
  for (let i = 0; i < size * 3; i++) {
    ctx.globalAlpha = 0.45;
    ctx.fillStyle = random() > 0.5 ? light : dark;
    ctx.beginPath();
    ctx.ellipse(random() * size, random() * size, size / 60, size / 130, random() * Math.PI, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;
};

export const paintStripes = (a: string, b: string, count: number, diagonal: boolean): Painter => (ctx, size) => {
  ctx.fillStyle = a;
  ctx.fillRect(0, 0, size, size);
  ctx.fillStyle = b;
  const w = size / count;
  for (let i = -count; i < count * 2; i += 2) {
    ctx.beginPath();
    const skew = diagonal ? size : 0;
    ctx.moveTo(i * w, 0); ctx.lineTo((i + 1) * w, 0); ctx.lineTo((i + 1) * w - skew, size); ctx.lineTo(i * w - skew, size);
    ctx.fill();
  }
};

export type SignLine = { text: string; size: number; color?: string; weight?: string };

/** Painted sign board. `aspect` = width / height of the board it will cover. */
export const paintSign = (background: string, border: string, lines: SignLine[], aspect: number): Painter => (ctx, size) => {
  const w = size * aspect;
  ctx.fillStyle = border;
  ctx.fillRect(0, 0, w, size);
  const m = size * 0.045;
  ctx.fillStyle = background;
  ctx.fillRect(m, m, w - 2 * m, size - 2 * m);
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  const total = lines.reduce((sum, l) => sum + l.size * 1.25, 0);
  let y = (size - total * size) / 2;
  for (const line of lines) {
    const px = line.size * size;
    ctx.font = `${line.weight ?? '800'} ${px}px "Arial Narrow", Arial, "Helvetica Neue", sans-serif`;
    ctx.fillStyle = line.color ?? '#161616';
    y += px * 0.625;
    ctx.fillText(line.text, w / 2, y, w - 4 * m);
    y += px * 0.625;
  }
};

/** Vertical sky gradient with a few soft clouds, mapped on the inside of a dome. */
export const paintSky: Painter = (ctx, size, random) => {
  const w = size * 2;
  const g = ctx.createLinearGradient(0, 0, 0, size);
  g.addColorStop(0, '#2c6dc4');
  g.addColorStop(0.28, '#5a9ae0');
  g.addColorStop(0.44, '#a9cdea');
  g.addColorStop(0.49, '#f0e3c4');
  g.addColorStop(0.5, '#e8dfc9');
  g.addColorStop(1, '#e8dfc9');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, w, size);
  // Fluffy cumulus: bright sunlit tops, warm-grey undersides.
  for (let i = 0; i < 26; i++) {
    const cx = random() * w;
    const cy = size * (0.16 + random() * 0.27);
    const scale = size * (0.025 + random() * 0.045) * (1 + (cy / size - 0.16) * 1.5);
    for (let k = 0; k < 11; k++) {
      const x = cx + (random() - 0.5) * scale * 5.5;
      const y = cy + (random() - 0.7) * scale * 1.1;
      const r = scale * (0.6 + random() * 0.9);
      for (const ox of [-w, 0, w]) {
        const c = ctx.createRadialGradient(x + ox, y - r * 0.3, 0, x + ox, y, r);
        c.addColorStop(0, 'rgba(255,250,240,0.75)');
        c.addColorStop(0.6, 'rgba(236,228,220,0.45)');
        c.addColorStop(1, 'rgba(200,196,200,0)');
        ctx.fillStyle = c;
        ctx.fillRect(x + ox - r, y - r, r * 2, r * 2);
      }
    }
  }
};

/** "Canjiquinha" stone cladding: thin irregular stone slivers in warm beige, grey and rust. */
export const paintStoneCladding: Painter = (ctx, size, random) => {
  ctx.fillStyle = '#5b5248';
  ctx.fillRect(0, 0, size, size);
  const tones = ['#c9b99c', '#b6a385', '#d8cbb2', '#9d8f7c', '#b98a63', '#a7a39b', '#cfb48c'];
  let y = 0;
  while (y < size) {
    const h = size * (0.04 + random() * 0.035);
    let x = -random() * size * 0.2;
    while (x < size) {
      const w = size * (0.12 + random() * 0.22);
      ctx.fillStyle = tones[Math.floor(random() * tones.length)]!;
      const inset = Math.max(1, size / 160);
      for (const ox of [-size, 0, size]) ctx.fillRect(x + ox + inset, y + inset, w - inset * 2, h - inset * 2);
      ctx.fillStyle = 'rgba(255,255,255,0.12)';
      for (const ox of [-size, 0, size]) ctx.fillRect(x + ox + inset, y + inset, w - inset * 2, Math.max(1, h * 0.18));
      x += w;
    }
    y += h;
  }
  speckle(ctx, size, random, size * 6, ['rgba(40,30,20,0.35)', 'rgba(255,250,235,0.25)'], 2);
};

/** Classic concrete cobogó: 4×4 blocks per tile, each with a round opening in a square frame. */
export const paintCobogo: Painter = (ctx, size) => {
  ctx.clearRect(0, 0, size, size);
  const n = 4;
  const c = size / n;
  for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) {
    ctx.fillStyle = '#e9e4da';
    ctx.fillRect(i * c, j * c, c, c);
    ctx.globalCompositeOperation = 'destination-out';
    ctx.beginPath();
    ctx.arc(i * c + c / 2, j * c + c / 2, c * 0.34, 0, Math.PI * 2);
    ctx.fill();
    for (const [dx, dy] of [[0.08, 0.08], [0.92, 0.08], [0.08, 0.92], [0.92, 0.92]]) {
      ctx.beginPath();
      ctx.arc(i * c + dx! * c, j * c + dy! * c, c * 0.07, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalCompositeOperation = 'source-over';
    ctx.strokeStyle = 'rgba(120,110,95,0.6)';
    ctx.lineWidth = Math.max(1, size / 128);
    ctx.strokeRect(i * c, j * c, c, c);
  }
};

/** Encaustic cement tiles ("ladrilho hidráulico"): 2×2 tiles per texture with a diamond motif. */
export const paintHydraulicTile = (ground: string, motif: string, accent: string): Painter => (ctx, size, random) => {
  const c = size / 2;
  for (let i = 0; i < 2; i++) for (let j = 0; j < 2; j++) {
    const x = i * c; const y = j * c;
    ctx.fillStyle = ground;
    ctx.fillRect(x, y, c, c);
    ctx.fillStyle = motif;
    ctx.beginPath();
    ctx.moveTo(x + c / 2, y + c * 0.08); ctx.lineTo(x + c * 0.92, y + c / 2); ctx.lineTo(x + c / 2, y + c * 0.92); ctx.lineTo(x + c * 0.08, y + c / 2);
    ctx.fill();
    ctx.fillStyle = accent;
    ctx.beginPath();
    ctx.arc(x + c / 2, y + c / 2, c * 0.14, 0, Math.PI * 2);
    ctx.fill();
    for (const [cx, cy] of [[0, 0], [1, 0], [0, 1], [1, 1]]) {
      ctx.beginPath();
      ctx.arc(x + cx! * c, y + cy! * c, c * 0.16, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.strokeStyle = 'rgba(40,30,25,0.45)';
    ctx.lineWidth = Math.max(1, size / 200);
    ctx.strokeRect(x, y, c, c);
  }
  blotches(ctx, size, random, 10, 'rgba(60,50,40,0.18)', 0.15);
  speckle(ctx, size, random, size * 6, ['rgba(0,0,0,0.12)', 'rgba(255,255,255,0.1)'], 2);
};

/** Portuguese pavement ("pedra portuguesa"): small setts in black and white waves. */
export const paintPortuguesePavement: Painter = (ctx, size, random) => {
  const sett = size / 32;
  for (let i = 0; i < 32; i++) for (let j = 0; j < 32; j++) {
    const x = i * sett; const y = j * sett;
    const wave = Math.sin(((i + 0.5) / 32) * Math.PI * 2) * 0.18 + 0.5;
    const v = (j + 0.5) / 32;
    const dark = Math.abs(v - wave) < 0.12 || Math.abs(v - ((wave + 0.5) % 1)) < 0.12;
    const tone = 0.85 + random() * 0.2;
    ctx.fillStyle = dark ? `rgb(${Math.round(48 * tone)},${Math.round(47 * tone)},${Math.round(46 * tone)})` : `rgb(${Math.round(222 * tone)},${Math.round(217 * tone)},${Math.round(205 * tone)})`;
    const g = Math.max(1, sett * 0.14);
    ctx.fillRect(x + g * random(), y + g * random(), sett - g, sett - g);
  }
};

/** Interlocking concrete pavers in a herringbone pattern, red and grey. */
export const paintPavers: Painter = (ctx, size, random) => {
  ctx.fillStyle = '#6a625a';
  ctx.fillRect(0, 0, size, size);
  const u = size / 8;
  const g = Math.max(1, size / 150);
  for (let i = -2; i < 10; i++) for (let j = -2; j < 10; j++) {
    const tone = 0.85 + random() * 0.25;
    ctx.fillStyle = (i + j) % 5 === 0 ? `rgb(${Math.round(150 * tone)},${Math.round(80 * tone)},${Math.round(64 * tone)})` : `rgb(${Math.round(160 * tone)},${Math.round(156 * tone)},${Math.round(148 * tone)})`;
    const x = (i + j) * u;
    const y = (j - i) * u;
    if ((i + j) % 2 === 0) ctx.fillRect(((x % size) + size) % size + g, ((y % size) + size) % size + g, u * 2 - g * 2, u - g * 2);
    else ctx.fillRect(((x % size) + size) % size + g, ((y % size) + size) % size + g, u - g * 2, u * 2 - g * 2);
  }
};

/**
 * Contact-shadow atlas (alpha only): left half a linear fade (v = 1 dark → v = 0 clear) for wall
 * bases, right half a soft round blot for oil stains and object footprints.
 */
export const paintContactShadow: Painter = (ctx, size) => {
  ctx.clearRect(0, 0, size * 2, size);
  const g = ctx.createLinearGradient(0, 0, 0, size);
  g.addColorStop(0, 'rgba(0,0,0,0.55)');
  g.addColorStop(0.35, 'rgba(0,0,0,0.25)');
  g.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, size, size);
  const r = ctx.createRadialGradient(size * 1.5, size / 2, 0, size * 1.5, size / 2, size / 2);
  r.addColorStop(0, 'rgba(0,0,0,0.5)');
  r.addColorStop(0.6, 'rgba(0,0,0,0.22)');
  r.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = r;
  ctx.fillRect(size, 0, size, size);
};

/**
 * Leaf cluster for alpha-tested foliage cards (CORE-010): many small overlapping leaves (and
 * optional blossoms) inside a ragged round silhouette, transparent elsewhere.
 */
export const paintLeafCluster = (leaves: string[], blossoms: string[], blossomShare: number): Painter => (ctx, size, random) => {
  ctx.clearRect(0, 0, size, size);
  const c = size / 2;
  for (let i = 0; i < size * 2.2; i++) {
    const a = random() * Math.PI * 2;
    const r = Math.sqrt(random()) * c * 0.92;
    const x = c + Math.cos(a) * r;
    const y = c + Math.sin(a) * r * 0.9;
    const flower = random() < blossomShare;
    const palette = flower ? blossoms : leaves;
    // Lower leaves darker, upper ones lighter: baked in-cluster shading.
    const shade = 0.75 + (1 - y / size) * 0.45;
    const base = palette[Math.floor(random() * palette.length)]!;
    ctx.fillStyle = base;
    ctx.globalAlpha = 1;
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(random() * Math.PI);
    const len = size * (flower ? 0.022 : 0.036) * (0.7 + random() * 0.6);
    ctx.beginPath();
    ctx.ellipse(0, 0, len, len * (flower ? 0.9 : 0.45), 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = `rgba(${shade > 1 ? '255,255,235' : '0,0,0'},${Math.abs(shade - 1) * 0.5})`;
    ctx.fill();
    ctx.restore();
  }
};
