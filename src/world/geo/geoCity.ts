import { makePoly, type Box2D, type Poly2D } from '../../core/collision.ts';
import { CURB_H, ROAD_HALF, SIDEWALK, frameCorners, framePoint, type Frame } from '../layout.ts';
import { NETWORK, PLAY_BOUNDS, SEDE, degreeOf, type NetRoad } from './network.ts';
import { GEO } from './brejoAlegreData.ts';
import type { XZ } from './geoTypes.ts';

/**
 * CORE-015 town layout on the REAL street network (OSM). Blocks are the faces of the street graph
 * inside the urban seat; everything placed in them (house lots, the eight shops, the depot) is an
 * ESTIMATED / GAME placement on real blocks — OSM has almost no buildings or addresses here.
 */
const E = ROAD_HALF + SIDEWALK; // carriageway half (4 m, approximation) + pavement (2.2 m)
type P = XZ;

const area = (p: readonly P[]) => p.reduce((t, a, i) => { const b = p[(i + 1) % p.length]!; return t + a[0] * b[1] - b[0] * a[1]; }, 0) / 2;
const centroid = (p: readonly P[]): P => [p.reduce((t, a) => t + a[0], 0) / p.length, p.reduce((t, a) => t + a[1], 0) / p.length];
export const pointInPolygon = (p: readonly P[], x: number, z: number): boolean => {
  let inside = false;
  for (let i = 0, j = p.length - 1; i < p.length; j = i++) {
    const a = p[i]!; const b = p[j]!;
    if ((a[1] > z) !== (b[1] > z) && x < ((b[0] - a[0]) * (z - a[1])) / (b[1] - a[1]) + a[0]) inside = !inside;
  }
  return inside;
};

// ------------------------------------------------------------------ faces of the street graph

type Half = { road: NetRoad; from: string; to: string; pts: P[]; angle: number };

function faces(): P[][] {
  const out = new Map<string, Half[]>();
  for (const r of NETWORK.roads) {
    const fwd = r.pts; const back = [...r.pts].reverse();
    for (const [from, to, pts] of [[r.a, r.b, fwd], [r.b, r.a, back]] as const) {
      const p0 = pts[0]!; const p1 = pts[1]!;
      const h: Half = { road: r, from, to, pts: pts as P[], angle: Math.atan2(p1[1] - p0[1], p1[0] - p0[0]) };
      (out.get(from) ?? out.set(from, []).get(from)!).push(h);
    }
  }
  for (const list of out.values()) list.sort((a, b) => a.angle - b.angle);
  const used = new Set<Half>();
  const result: P[][] = [];
  for (const list of out.values()) {
    for (const start of list) {
      if (used.has(start)) continue;
      const poly: P[] = [];
      let h = start; let guard = 0;
      while (!used.has(h) && guard++ < 200) {
        used.add(h);
        poly.push(...h.pts.slice(0, -1));
        // At the end node, take the next edge clockwise from the reverse direction (face on the left).
        const atEnd = out.get(h.to)!;
        const n = h.pts.length;
        const back = Math.atan2(h.pts[n - 2]![1] - h.pts[n - 1]![1], h.pts[n - 2]![0] - h.pts[n - 1]![0]);
        let best: Half | null = null; let bestTurn = Infinity;
        for (const c of atEnd) {
          if (c.road === h.road && c.to === h.from && atEnd.length > 1) continue;
          let turn = back - c.angle; while (turn <= 0) turn += Math.PI * 2;
          if (turn < bestTurn) { bestTurn = turn; best = c; }
        }
        if (!best) break;
        h = best;
      }
      if (h === start && poly.length >= 3) result.push(poly);
    }
  }
  return result;
}

/**
 * CORE-015.1: simplifies a block face with Douglas–Peucker (the result never leaves the real road
 * axis by more than `tol` metres — the old "merge bends under 4°" rule collapsed whole curves into
 * chords, which put kerbs and walls on the asphalt). Dead-end roads inside a block appear in the
 * face as a slit (out and back along the same axis); their tip gets a square cap so the inset goes
 * AROUND the dead end instead of through it.
 */
function simplify(p: P[], tol = 0.3): P[] {
  const pts = p.filter((a, i) => { const b = p[(i + 1) % p.length]!; return Math.hypot(a[0] - b[0], a[1] - b[1]) > 0.05; });
  const n = pts.length;
  if (n <= 4) return pts;
  // Corners that must survive: U-turns (dead-end tips) and sharp turns.
  const keep = new Array<boolean>(n).fill(false);
  const turnAt = (i: number) => {
    const a = pts[(i - 1 + n) % n]!; const b = pts[i]!; const c = pts[(i + 1) % n]!;
    let t = Math.abs(Math.atan2(c[1] - b[1], c[0] - b[0]) - Math.atan2(b[1] - a[1], b[0] - a[0]));
    if (t > Math.PI) t = Math.PI * 2 - t;
    return t;
  };
  for (let i = 0; i < n; i++) if (turnAt(i) > 0.6) keep[i] = true;
  if (!keep.some(Boolean)) { keep[0] = true; keep[Math.floor(n / 2)] = true; }
  const dist = (q: P, a: P, b: P) => {
    const dx = b[0] - a[0]; const dz = b[1] - a[1]; const L2 = dx * dx + dz * dz;
    if (L2 < 1e-9) return Math.hypot(q[0] - a[0], q[1] - a[1]);
    const t = Math.max(0, Math.min(1, ((q[0] - a[0]) * dx + (q[1] - a[1]) * dz) / L2));
    return Math.hypot(a[0] + dx * t - q[0], a[1] + dz * t - q[1]);
  };
  const dp = (i0: number, i1: number) => { // indices along the ring, i1 may exceed n
    if (i1 - i0 < 2) return;
    let worst = -1; let at = -1;
    for (let k = i0 + 1; k < i1; k++) { const d = dist(pts[k % n]!, pts[i0 % n]!, pts[i1 % n]!); if (d > worst) { worst = d; at = k; } }
    if (worst > tol) { keep[at % n] = true; dp(i0, at); dp(at, i1); }
  };
  const anchors = keep.map((k, i) => (k ? i : -1)).filter((i) => i >= 0);
  for (let k = 0; k < anchors.length; k++) {
    const i0 = anchors[k]!; const i1 = k + 1 < anchors.length ? anchors[k + 1]! : anchors[0]! + n;
    dp(i0, i1);
  }
  const kept = pts.filter((_, i) => keep[i]);
  // Square cap at every U-turn (dead-end tip): two vertices 2 cm apart, across the travel direction.
  const out: P[] = [];
  for (let i = 0; i < kept.length; i++) {
    const a = kept[(i - 1 + kept.length) % kept.length]!; const b = kept[i]!; const c = kept[(i + 1) % kept.length]!;
    const d1 = Math.atan2(b[1] - a[1], b[0] - a[0]); const d2 = Math.atan2(c[1] - b[1], c[0] - b[0]);
    let t = Math.abs(d2 - d1); if (t > Math.PI) t = Math.PI * 2 - t;
    if (t > 2.6) {
      const L = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1;
      const ux = (b[0] - a[0]) / L; const uz = (b[1] - a[1]) / L; // travel direction into the tip
      // The face is on the left, so the path turns clockwise at the tip: left bank first.
      out.push([b[0] - uz * 0.01, b[1] + ux * 0.01], [b[0] + uz * 0.01, b[1] - ux * 0.01]);
    } else out.push(b);
  }
  return out;
}

/** Inward offset of a counter-clockwise polygon by d (intersection of offset edge lines). */
export function inset(p: readonly P[], d: number): P[] | null {
  const n = p.length;
  const lines = p.map((a, i) => {
    const b = p[(i + 1) % n]!;
    const L = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1;
    const nx = -(b[1] - a[1]) / L; const nz = (b[0] - a[0]) / L; // left normal = inside for CCW
    return { a: [a[0] + nx * d, a[1] + nz * d] as P, dir: [(b[0] - a[0]) / L, (b[1] - a[1]) / L] as P };
  });
  const out: P[] = [];
  for (let i = 0; i < n; i++) {
    const l1 = lines[(i - 1 + n) % n]!; const l2 = lines[i]!;
    const den = l1.dir[0] * l2.dir[1] - l1.dir[1] * l2.dir[0];
    if (Math.abs(den) < 1e-6) { out.push(l2.a); continue; }
    const t = ((l2.a[0] - l1.a[0]) * l2.dir[1] - (l2.a[1] - l1.a[1]) * l2.dir[0]) / den;
    out.push([l1.a[0] + l1.dir[0] * t, l1.a[1] + l1.dir[1] * t]);
  }
  if (area(out) <= 0) return null;
  // Reject inversions: every inset vertex must stay inside the original polygon.
  if (!out.every((q) => pointInPolygon(p, q[0], q[1]))) return null;
  return out;
}

export type GeoBlock = { id: string; face: P[]; kerb: P[]; lot: P[]; area: number; centre: P };

function buildBlocks(): GeoBlock[] {
  const blocks: GeoBlock[] = [];
  for (const raw of faces()) {
    const a = area(raw);
    if (a <= 0) continue; // the outer face (clockwise)
    const face = simplify(raw);
    const c = centroid(face);
    if (a < 600 || a > 60000 || !pointInPolygon([[SEDE.minX, SEDE.minZ], [SEDE.maxX, SEDE.minZ], [SEDE.maxX, SEDE.maxZ], [SEDE.minX, SEDE.maxZ]], c[0], c[1])) continue;
    const kerb = inset(face, ROAD_HALF); const lot = inset(face, E);
    if (!kerb || !lot || area(lot) < 200) continue;
    blocks.push({ id: `q${blocks.length + 1}`, face, kerb, lot, area: a, centre: c });
  }
  return blocks;
}

export const GEO_BLOCKS = buildBlocks();

// ------------------------------------------------------------------ lots along the frontages

export type LotUse = 'casa' | 'loja' | 'galpao' | 'vazio';
export type GeoLot = { id: string; block: string; frame: Frame; width: number; depth: number; use: LotUse; style: number; street: string | null };
export type GeoWall = { block: string; frame: Frame; length: number };

const LOT_W = 12; const LOT_D = 20; const CORNER = 6;

/** Oriented rectangle overlap (separating axes). */
function rectsOverlap(a: P[], b: P[]): boolean {
  for (const poly of [a, b]) {
    for (let i = 0; i < 4; i++) {
      const p = poly[i]!; const q = poly[(i + 1) % 4]!;
      const ax = -(q[1] - p[1]); const az = q[0] - p[0];
      const pa = a.map((v) => v[0] * ax + v[1] * az); const pb = b.map((v) => v[0] * ax + v[1] * az);
      if (Math.max(...pa) <= Math.min(...pb) + 0.05 || Math.max(...pb) <= Math.min(...pa) + 0.05) return false;
    }
  }
  return true;
}

/** True when a lot rectangle comes closer than the carriageway + pavement to any road axis. */
function rectNearRoad(rect: P[]): boolean {
  const pts: P[] = [...rect];
  for (let i = 0; i < 4; i++) { const a = rect[i]!; const b = rect[(i + 1) % 4]!; pts.push([(a[0] + b[0]) / 2, (a[1] + b[1]) / 2]); }
  const minX = Math.min(...pts.map((q) => q[0])) - E; const maxX = Math.max(...pts.map((q) => q[0])) + E;
  const minZ = Math.min(...pts.map((q) => q[1])) - E; const maxZ = Math.max(...pts.map((q) => q[1])) + E;
  for (const r of NETWORK.roads) {
    for (let i = 1; i < r.pts.length; i++) {
      const a = r.pts[i - 1]!; const b = r.pts[i]!;
      if (Math.max(a[0], b[0]) < minX || Math.min(a[0], b[0]) > maxX || Math.max(a[1], b[1]) < minZ || Math.min(a[1], b[1]) > maxZ) continue;
      const dx = b[0] - a[0]; const dz = b[1] - a[1]; const L2 = dx * dx + dz * dz || 1;
      for (const q of pts) {
        const t = Math.max(0, Math.min(1, ((q[0] - a[0]) * dx + (q[1] - a[1]) * dz) / L2));
        if (Math.hypot(a[0] + dx * t - q[0], a[1] + dz * t - q[1]) < E - 0.05) return true;
      }
    }
  }
  return false;
}

/** Distance from a point to the nearest road axis (any drivable road of the network). */
export function roadDistance(x: number, z: number): number {
  let best = Infinity;
  for (const r of NETWORK.roads) {
    for (let i = 1; i < r.pts.length; i++) {
      const a = r.pts[i - 1]!; const b = r.pts[i]!;
      if (Math.min(a[0], b[0]) - best > x || Math.max(a[0], b[0]) + best < x || Math.min(a[1], b[1]) - best > z || Math.max(a[1], b[1]) + best < z) continue;
      const dx = b[0] - a[0]; const dz = b[1] - a[1]; const L2 = dx * dx + dz * dz || 1;
      const t = Math.max(0, Math.min(1, ((x - a[0]) * dx + (z - a[1]) * dz) / L2));
      best = Math.min(best, Math.hypot(a[0] + dx * t - x, a[1] + dz * t - z));
    }
  }
  return best;
}

function streetNear(x: number, z: number): string | null {
  let best: { d: number; name: string | null } = { d: Infinity, name: null };
  for (const r of NETWORK.roads) {
    for (let i = 1; i < r.pts.length; i++) {
      const a = r.pts[i - 1]!; const b = r.pts[i]!;
      const dx = b[0] - a[0]; const dz = b[1] - a[1]; const L2 = dx * dx + dz * dz || 1;
      const t = Math.max(0, Math.min(1, ((x - a[0]) * dx + (z - a[1]) * dz) / L2));
      const d = Math.hypot(a[0] + dx * t - x, a[1] + dz * t - z);
      if (d < best.d) best = { d, name: r.name };
    }
  }
  return best.name;
}

function buildLots(): { lots: GeoLot[]; walls: GeoWall[] } {
  const lots: GeoLot[] = []; const walls: GeoWall[] = [];
  let style = 0;
  for (const b of GEO_BLOCKS) {
    const placed: P[][] = [];
    const p = b.lot; const n = p.length;
    for (let i = 0; i < n; i++) {
      const a = p[i]!; const c = p[(i + 1) % n]!;
      const L = Math.hypot(c[0] - a[0], c[1] - a[1]);
      const tx = (c[0] - a[0]) / L; const tz = (c[1] - a[1]) / L;
      // Polygon is CCW: inside is on the left of a→c; frame frontage (fx) must equal a→c,
      // which (fx = (iz, −ix)) means inward = (−tz, tx).
      const yaw = Math.atan2(-tz, tx);
      const frameAt = (s: number): Frame => ({ ox: a[0] + tx * s, oz: a[1] + tz * s, side: 1, yaw });
      const usable = L - 2 * CORNER;
      const count = usable >= 10 ? Math.max(1, Math.round(usable / LOT_W)) : 0;
      const w = count ? usable / count : 0;
      let covered: [number, number][] = [];
      for (let k = 0; k < count; k++) {
        const s0 = CORNER + k * w;
        const f = frameAt(s0);
        let ok = false;
        for (const depth of [LOT_D, 16, 12]) {
          const rect = frameCorners(f, 0.05, w - 0.05, 0.05, depth);
          if (!rect.every((q) => pointInPolygon(p, q[0], q[1]))) continue;
          if (placed.some((o) => rectsOverlap(o, rect))) continue;
          // Dead-end or internal ways inside a block (OSM): keep every lot off every carriageway.
          if (rectNearRoad(rect)) continue;
          placed.push(rect);
          const mid = framePoint(f, w / 2, -SIDEWALK - 1);
          lots.push({ id: `${b.id}-l${lots.length + 1}`, block: b.id, frame: f, width: w, depth, use: 'casa', style: style++ % 10, street: streetNear(mid.x, mid.z) });
          covered.push([s0, s0 + w]);
          ok = true;
          break;
        }
        void ok;
      }
      // Walls close the frontage between lots and at the corners (no open block edge).
      covered = covered.sort((u, v) => u[0] - v[0]);
      let cursor = 0;
      for (const [s0, s1] of [...covered, [L, L] as [number, number]]) {
        if (s0 - cursor > 0.3) {
          // CORE-015.1: a wall never stands on a carriageway or pavement of ANY road (tight
          // junction triangles and internal ways): keep only the stretches clear of every axis.
          let run: number | null = null;
          const end = s0;
          for (let q = cursor; ; q = Math.min(end, q + 0.5)) {
            const pt = framePoint(frameAt(q), 0, 0.11);
            const clear = roadDistance(pt.x, pt.z) >= E - 0.2;
            if (clear && run === null) run = q;
            if ((!clear || q >= end) && run !== null) {
              const stop = clear ? q : q - 0.5;
              if (stop - run > 0.6) walls.push({ block: b.id, frame: frameAt(run), length: stop - run });
              run = null;
            }
            if (q >= end) break;
          }
        }
        cursor = Math.max(cursor, s1);
      }
    }
  }
  return { lots, walls };
}

const LOTS: { lots: GeoLot[]; walls: GeoWall[] } = buildLots();
// Lots never cover real open spaces mapped in OSM (parks, pitch, cemetery).
{
  const open = GEO.areas.filter((a) => a.kind.startsWith('leisure:') || a.kind === 'landuse:cemetery');
  LOTS.lots = LOTS.lots.filter((l) => {
    const c = frameCorners(l.frame, 0, l.width, 0, l.depth);
    const m = framePoint(l.frame, l.width / 2, l.depth / 2);
    return !open.some((o) => pointInPolygon(o.pts, m.x, m.z) || c.some((q) => pointInPolygon(o.pts, q[0], q[1])));
  });
}
export const GEO_LOTS = LOTS.lots;
export const GEO_WALLS = LOTS.walls;

// ------------------------------------------------------------------ shops and depot (game adaptations)

const distToOrigin = (l: GeoLot) => { const m = framePoint(l.frame, l.width / 2, 0); return Math.hypot(m.x - CENTRE[0], m.z - CENTRE[1]); };
/** Centre of the main grid (mean of urban junctions south-west of the highway) — the commercial core. */
const CENTRE: P = (() => {
  const js = NETWORK.nodes.filter((n) => degreeOf(NETWORK, n.id) >= 4 && n.x < 250 && n.z < 300);
  return [js.reduce((t, n) => t + n.x, 0) / js.length, js.reduce((t, n) => t + n.z, 0) / js.length];
})();
export const TOWN_CENTRE = CENTRE;

/** Eight shop lots near the centre (one per block side, so shops spread over the core). */
export const SHOP_LOTS: GeoLot[] = (() => {
  const picked: GeoLot[] = [];
  const sides = new Set<string>();
  for (const l of [...GEO_LOTS].filter((q) => q.depth >= 16 && q.width >= 10).sort((a, b) => distToOrigin(a) - distToOrigin(b))) {
    const key = `${l.block}:${Math.round(l.frame.yaw! * 10)}`;
    if (sides.has(key)) continue;
    sides.add(key); picked.push(l); l.use = 'loja';
    if (picked.length === 8) break;
  }
  return picked;
})();

/**
 * Depot (fictional "Galpão Logístico"): a whole block side at the edge of the seat, on the road
 * with the highest priority, deep enough for a 60 × 50 m yard + shed. Its lots become the depot.
 */
export const DEPOT_SITE: { frame: Frame; width: number; depth: number; block: string } = (() => {
  let best: { score: number; frame: Frame; width: number; depth: number; block: string } | null = null;
  for (const b of GEO_BLOCKS) {
    const p = b.lot;
    for (let i = 0; i < p.length; i++) {
      const a = p[i]!; const c = p[(i + 1) % p.length]!;
      const L = Math.hypot(c[0] - a[0], c[1] - a[1]);
      if (L < 70) continue;
      const tx = (c[0] - a[0]) / L; const tz = (c[1] - a[1]) / L;
      const yaw = Math.atan2(-tz, tx);
      // Slide the 64 × 58 m site along the side (from its middle outwards) until it fits the block
      // and stays clear of every road — also of dead-end streets inside the block (CORE-015.1).
      let frame: Frame | null = null;
      const middle = (L - 64) / 2;
      for (let k = 0; k <= Math.floor(middle / 4) && !frame; k++) {
        for (const s0 of k === 0 ? [middle] : [middle - k * 4, middle + k * 4]) {
          if (s0 < 3 || s0 + 64 > L - 3) continue;
          const f: Frame = { ox: a[0] + tx * s0, oz: a[1] + tz * s0, side: 1, yaw };
          const rect = frameCorners(f, 0, 64, 0, 58);
          if (!rect.every((q) => pointInPolygon(p, q[0], q[1])) || rectNearRoad(rect)) continue;
          frame = f; break;
        }
      }
      if (!frame) continue;
      const mid = framePoint(frame, 32, -6);
      const dist = Math.hypot(mid.x - CENTRE[0], mid.z - CENTRE[1]);
      const score = dist; // farthest suitable side from the centre keeps trucks out of the core
      if (!best || score > best.score) best = { score, frame, width: 64, depth: 58, block: b.id };
    }
  }
  if (!best) throw new Error('nenhuma quadra comporta o galpão');
  return best;
})();
for (const l of GEO_LOTS) {
  if (l.use !== 'casa') continue;
  const m = framePoint(l.frame, l.width / 2, l.depth / 2);
  const d = DEPOT_SITE;
  const local = (() => { const o = d.frame; const ix = Math.sin(o.yaw!); const iz = Math.cos(o.yaw!); const dx = m.x - o.ox; const dz = m.z - o.oz; return [dx * iz - dz * ix, dx * ix + dz * iz]; })();
  if (local[0]! > -3 && local[0]! < d.width + 3 && local[1]! > -3 && local[1]! < d.depth + 3) l.use = 'galpao';
}

// ------------------------------------------------------------------ solids, raised ground, areas

/** Real open spaces from OSM (parks, pitch, cemetery) inside the seat. */
export const OPEN_SPACES = GEO.areas.filter((a) => (a.kind.startsWith('leisure:') || a.kind === 'landuse:cemetery') && a.pts.length >= 3
  && a.pts.every((q) => q[0] > SEDE.minX && q[0] < SEDE.maxX && q[1] > SEDE.minZ && q[1] < SEDE.maxZ));

/** Polygons the player cannot enter: house lots (from the gate in), walls. Shops/depot add their own. */
export function geoSolids(): Poly2D[] {
  const out: Poly2D[] = [];
  for (const l of GEO_LOTS) if (l.use === 'casa' || l.use === 'vazio') out.push(makePoly(frameCorners(l.frame, 0, l.width, 0.05, l.depth)));
  for (const w of GEO_WALLS) out.push(makePoly(frameCorners(w.frame, 0, w.length, 0, 0.22)));
  // Block cores behind the lots: the inner area of each block (unreachable, closed by lots/walls).
  for (const b of GEO_BLOCKS) {
    const core = inset(b.lot, LOT_D + 0.5);
    if (core && isConvex(core)) out.push(makePoly(core));
  }
  return out;
}

export function isConvex(p: readonly P[]): boolean {
  let sign = 0;
  for (let i = 0; i < p.length; i++) {
    const a = p[i]!; const b = p[(i + 1) % p.length]!; const c = p[(i + 2) % p.length]!;
    const cr = (b[0] - a[0]) * (c[1] - b[1]) - (b[1] - a[1]) * (c[0] - b[0]);
    if (Math.abs(cr) < 1e-6) continue;
    if (sign === 0) sign = Math.sign(cr); else if (Math.sign(cr) !== sign) return false;
  }
  return true;
}

/** Raised ground: every urban block from the kerb line in (pavements and lots at kerb height). */
export function geoRaised(): { box: Box2D; height: number; poly: Poly2D }[] {
  return GEO_BLOCKS.map((b) => { const poly = makePoly(b.kerb); return { box: poly.box, height: CURB_H, poly }; });
}

export const GEO_BOUNDS = PLAY_BOUNDS;
