import { advance, move, restow, ParcelError, type Parcel, type ParcelState, type Stowage } from './parcels.ts';

/**
 * B1-01 F3 (decisions 7 and 15, AC-06/AC-07, contract C2): the boot of the player's own car.
 *
 * The parcel inventory stays the single source of truth: a parcel is "in the boot" because its own
 * `place` is `'porta-malas'`, and its slot is its own `stowage`. This module only decides WHERE a
 * box fits (automatic, deterministic arrangement by real dimensions) and performs the custody
 * transitions hands ⇄ boot through `move`/`restow`. A box that does not fit is refused and stays in
 * the hands, under the same custody. The 3D view renders `stowage`; it keeps no inventory of its own.
 *
 * Numbers below are an auditable ENGINEERING calibration (the user approved the function, not the
 * values): a small old hatch boot of ~340 L and three box classes. Tests check that the real daily
 * demand of every sector fits, and that more than the boot holds is refused.
 */
export type Dims = Readonly<{ w: number; h: number; d: number }>;
export type Compartment = Readonly<{ id: 'porta-malas'; width: number; height: number; depth: number }>;

/** Usable boot volume (m): width between the wheel arches, floor to parcel shelf, seat back to tailgate. */
export const CAR_TRUNK: Compartment = Object.freeze({ id: 'porta-malas', width: 1.06, height: 0.5, depth: 0.64 });

export type SizeClass = 'P' | 'M' | 'G';
/** Box classes (w across, h up, d deep), metres. "This side up": boxes only turn about the vertical. */
export const PARCEL_SIZES: Readonly<Record<SizeClass, Dims>> = Object.freeze({
  P: Object.freeze({ w: 0.22, h: 0.09, d: 0.15 }),
  M: Object.freeze({ w: 0.3, h: 0.15, d: 0.22 }),
  G: Object.freeze({ w: 0.4, h: 0.22, d: 0.3 }),
});
export const SIZE_LABEL: Readonly<Record<SizeClass, string>> = Object.freeze({ P: 'pequena', M: 'média', G: 'grande' });

/** Size class of a parcel, derived ONLY from its stable ID (same box in every session and save). */
export function parcelSizeClass(id: string): SizeClass {
  let h = 0x811c9dc5;
  for (let i = 0; i < id.length; i++) { h ^= id.charCodeAt(i); h = Math.imul(h, 0x01000193) >>> 0; }
  // murmur3 finaliser: consecutive IDs (J2026-001, -002…) spread evenly over the classes.
  h ^= h >>> 16; h = Math.imul(h, 0x85ebca6b) >>> 0; h ^= h >>> 13; h = Math.imul(h, 0xc2b2ae35) >>> 0; h ^= h >>> 16;
  const k = (h >>> 0) % 100;
  return k < 45 ? 'P' : k < 85 ? 'M' : 'G';
}
export const parcelDims = (id: string): Dims => PARCEL_SIZES[parcelSizeClass(id)];

export type Slot = Readonly<{ x: number; y: number; z: number; w: number; h: number; d: number }>;
export type Box = Readonly<{ id: string; dims: Dims }>;
type Placed = Readonly<{ box: Box; slot: Slot }>;

const EPS = 1e-6;
/** Minimum share of a box's base that must rest on the floor or on boxes right below it. */
export const SUPPORT_MIN = 0.6;
const r4 = (v: number): number => Math.round(v * 1e4) / 1e4;
const span = (a0: number, a1: number, b0: number, b1: number): number => Math.max(0, Math.min(a1, b1) - Math.max(a0, b0));
const baseOverlap = (a: Slot, b: Slot): number => span(a.x, a.x + a.w, b.x, b.x + b.w) * span(a.z, a.z + a.d, b.z, b.z + b.d);

/** True when two boxes share volume (touching faces do not count). */
export function slotsIntersect(a: Slot, b: Slot): boolean {
  return span(a.x, a.x + a.w, b.x, b.x + b.w) > EPS && span(a.y, a.y + a.h, b.y, b.y + b.h) > EPS && span(a.z, a.z + a.d, b.z, b.z + b.d) > EPS;
}
export function insideCompartment(c: Compartment, s: Slot): boolean {
  return s.x >= -EPS && s.y >= -EPS && s.z >= -EPS && s.x + s.w <= c.width + EPS && s.y + s.h <= c.height + EPS && s.z + s.d <= c.depth + EPS && s.w > 0 && s.h > 0 && s.d > 0;
}
/** Share of the base resting on the floor (1) or on the tops of boxes exactly underneath. */
export function supportOf(s: Slot, others: readonly Slot[]): number {
  if (s.y <= EPS) return 1;
  let area = 0;
  for (const o of others) if (Math.abs(o.y + o.h - s.y) < 1e-4) area += baseOverlap(s, o);
  return area / (s.w * s.d);
}
const orientations = (d: Dims): Dims[] => (Math.abs(d.w - d.d) < EPS ? [d] : [d, { w: d.d, h: d.h, d: d.w }]);
const matchesDims = (s: Slot, d: Dims): boolean => orientations(d).some((o) => Math.abs(o.w - s.w) < 1e-6 && Math.abs(o.h - s.h) < 1e-6 && Math.abs(o.d - s.d) < 1e-6);

/** Height a box with this base would come to rest at (dropped from above onto what is there). */
function restHeight(slots: readonly Slot[], x: number, z: number, w: number, d: number): number {
  const probe: Slot = { x, y: 0, z, w, h: 1, d };
  let y = 0;
  for (const s of slots) if (baseOverlap(probe, s) > EPS) y = Math.max(y, s.y + s.h);
  return y;
}

/**
 * Best free slot for one box (deterministic): lowest resting height, then nearest the seat back,
 * then nearest the left wall; candidate corners are the floor origin and the edges of placed boxes.
 */
export function placeBox(c: Compartment, slots: readonly Slot[], dims: Dims): Slot | null {
  const xs = new Set<number>([0]); const zs = new Set<number>([0]);
  for (const s of slots) { xs.add(r4(s.x)); xs.add(r4(s.x + s.w)); zs.add(r4(s.z)); zs.add(r4(s.z + s.d)); }
  let best: Slot | null = null; let key: [number, number, number] | null = null;
  for (const o of orientations(dims)) {
    for (const x of xs) for (const z of zs) {
      if (x + o.w > c.width + EPS || z + o.d > c.depth + EPS) continue;
      const y = restHeight(slots, x, z, o.w, o.d);
      const cand: Slot = { x, y, z, w: o.w, h: o.h, d: o.d };
      if (!insideCompartment(c, cand) || slots.some((s) => slotsIntersect(s, cand)) || supportOf(cand, slots) < SUPPORT_MIN) continue;
      const k: [number, number, number] = [r4(y), r4(z), r4(x)];
      if (!key || k[0] < key[0] || (k[0] === key[0] && (k[1] < key[1] || (k[1] === key[1] && k[2] < key[2])))) { best = cand; key = k; }
    }
  }
  return best;
}

const bigFirst = (a: Box, b: Box): number =>
  b.dims.w * b.dims.d - a.dims.w * a.dims.d || b.dims.h - a.dims.h || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0);

const byId = (a: Box, b: Box): number => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0);
/** Deterministic orders tried by a full re-pack (the first that leaves the fewest boxes out wins). */
const REPACK_ORDERS: readonly ((a: Box, b: Box) => number)[] = [
  bigFirst,
  (a, b) => b.dims.h - a.dims.h || b.dims.w * b.dims.d - a.dims.w * a.dims.d || byId(a, b),
  (a, b) => b.dims.w * b.dims.h * b.dims.d - a.dims.w * a.dims.h * a.dims.d || b.dims.w - a.dims.w || byId(a, b),
  (a, b) => Math.max(b.dims.w, b.dims.d) - Math.max(a.dims.w, a.dims.d) || b.dims.h - a.dims.h || byId(a, b),
];

/** Packs a set of boxes from scratch. Null when any `required` box has no room in every order tried. */
function repack(c: Compartment, boxes: readonly Box[], required: ReadonlySet<string>): { placed: Placed[]; rejected: string[] } | null {
  let best: { placed: Placed[]; rejected: string[] } | null = null;
  for (const order of REPACK_ORDERS) {
    const placed: Placed[] = []; const rejected: string[] = [];
    let ok = true;
    for (const box of [...boxes].sort(order)) {
      const slot = placeBox(c, placed.map((p) => p.slot), box.dims);
      if (slot) placed.push({ box, slot });
      else if (required.has(box.id)) { ok = false; break; }
      else rejected.push(box.id);
    }
    if (ok && (!best || rejected.length < best.rejected.length)) best = { placed, rejected };
    if (best && !best.rejected.length) break;
  }
  return best;
}

export type Arrangement = Readonly<{ placed: readonly Placed[]; accepted: readonly string[]; rejected: readonly string[]; rearranged: boolean }>;

/**
 * Automatic arrangement when boxes are added. A box is accepted only if the WHOLE resulting load
 * can still be packed from scratch (so taking any box out later always leaves a valid
 * arrangement). Accepted boxes go into free space and keep everything else where it is; when the
 * free space is too fragmented the boot is re-packed. A box without room is rejected: never
 * squeezed through another box, never dropped.
 */
export function arrange(c: Compartment, current: readonly Placed[], incoming: readonly Box[]): Arrangement {
  let placed: Placed[] = [...current]; const rejected: string[] = []; const accepted: string[] = [];
  let rearranged = false;
  for (const box of incoming) {
    const all = [...placed.map((p) => p.box), box];
    const full = repack(c, all, new Set(all.map((b) => b.id)));
    if (!full) { rejected.push(box.id); continue; }
    const slot = placeBox(c, placed.map((p) => p.slot), box.dims);
    if (slot) placed.push({ box, slot });
    else { placed = full.placed; rearranged = true; }
    accepted.push(box.id);
  }
  return { placed, accepted, rejected, rearranged };
}

/**
 * Taking boxes out: what remains settles straight down (gravity); boxes left resting on too little
 * are lifted and put back in free space; failing that, the remaining load is re-packed. Null when
 * no valid arrangement remains (the take is then refused and nothing changes).
 */
export function arrangeAfterRemoval(c: Compartment, current: readonly Placed[], removed: ReadonlySet<string>): { placed: Placed[]; rearranged: boolean } | null {
  const keep = current.filter((p) => !removed.has(p.box.id)).sort((a, b) => a.slot.y - b.slot.y || a.slot.z - b.slot.z || a.slot.x - b.slot.x);
  const settled: Placed[] = [];
  let moved = false;
  for (const p of keep) {
    const y = restHeight(settled.map((q) => q.slot), p.slot.x, p.slot.z, p.slot.w, p.slot.d);
    if (Math.abs(y - p.slot.y) > EPS) moved = true;
    settled.push({ box: p.box, slot: { ...p.slot, y } });
  }
  if (layoutProblem(c, settled) === null) return { placed: settled, rearranged: moved };
  // Lift the boxes that lost their support (and anything resting on them), then put them back.
  const slots = settled.map((q) => q.slot);
  const loose = new Set(settled.filter((q) => supportOf(q.slot, slots) < SUPPORT_MIN - 1e-9).map((q) => q.box.id));
  let grew = true;
  while (grew) {
    grew = false;
    for (const q of settled) {
      if (loose.has(q.box.id)) continue;
      if (settled.some((r) => loose.has(r.box.id) && q.slot.y > r.slot.y + EPS && baseOverlap(q.slot, r.slot) > EPS)) { loose.add(q.box.id); grew = true; }
    }
  }
  const fixed = settled.filter((q) => !loose.has(q.box.id));
  let ok = true;
  for (const q of settled.filter((r) => loose.has(r.box.id)).map((r) => r.box).sort(bigFirst)) {
    const slot = placeBox(c, fixed.map((r) => r.slot), q.dims);
    if (!slot) { ok = false; break; }
    fixed.push({ box: q, slot });
  }
  if (ok && layoutProblem(c, fixed) === null) return { placed: fixed, rearranged: true };
  const full = repack(c, keep.map((p) => p.box), new Set(keep.map((p) => p.box.id)));
  return full ? { placed: full.placed, rearranged: true } : null;
}

/** Physical validity of a whole boot: inside, right sizes, no two boxes sharing volume, all resting. */
export function layoutProblem(c: Compartment, placed: readonly Placed[]): string | null {
  const ids = new Set<string>();
  for (const p of placed) {
    if (ids.has(p.box.id)) return `${p.box.id}: caixa duplicada no porta-malas`;
    ids.add(p.box.id);
    if (!insideCompartment(c, p.slot)) return `${p.box.id}: caixa fora dos limites do porta-malas`;
    if (!matchesDims(p.slot, p.box.dims)) return `${p.box.id}: dimensões da caixa não correspondem ao volume`;
  }
  for (let i = 0; i < placed.length; i++) for (let j = i + 1; j < placed.length; j++) {
    if (slotsIntersect(placed[i]!.slot, placed[j]!.slot)) return `${placed[i]!.box.id} e ${placed[j]!.box.id}: caixas se atravessando`;
  }
  const slots = placed.map((p) => p.slot);
  for (const p of placed) if (supportOf(p.slot, slots) < SUPPORT_MIN - 1e-9) return `${p.box.id}: caixa sem apoio`;
  return null;
}

/** States in which a parcel may travel in the player's vehicle (collected, to the base, on the route). */
export const STOWABLE: readonly ParcelState[] = ['COLETADO', 'EM_TRANSPORTE', 'EM_ROTA'];
export type TrunkContext = Readonly<{ parked: boolean }>;
export type StowResult = Readonly<{ stowed: readonly string[]; rejected: readonly string[]; refused: string | null }>;

const slotOf = (s: Stowage): Slot => ({ x: s.x, y: s.y, z: s.z, w: s.w, h: s.h, d: s.d });
const sameSlot = (a: Slot, b: Slot): boolean => [a.x - b.x, a.y - b.y, a.z - b.z, a.w - b.w, a.h - b.h, a.d - b.d].every((v) => Math.abs(v) < 1e-9);

/** The boot of ONE vehicle, operating on the shared parcel list (it never stores parcels itself). */
export class CarTrunk {
  /** Tailgate state (true = open). Loading and unloading only with the tailgate open and the car parked. */
  open = false;
  readonly vehicleId: string;
  readonly holder: string;
  readonly compartment: Compartment;
  constructor(vehicleId: string, holder = 'jogador', compartment: Compartment = CAR_TRUNK) {
    this.vehicleId = vehicleId; this.holder = holder; this.compartment = compartment;
  }

  setOpen(open: boolean): void { this.open = open; }
  contents(parcels: readonly Parcel[]): Parcel[] { return parcels.filter((p) => p.place === 'porta-malas' && p.stowage?.vehicleId === this.vehicleId); }
  private placed(parcels: readonly Parcel[]): Placed[] { return this.contents(parcels).map((p) => ({ box: { id: p.id, dims: parcelDims(p.id) }, slot: slotOf(p.stowage!) })); }
  private stowage(slot: Slot): Stowage { return { compartment: 'porta-malas', vehicleId: this.vehicleId, ...slot }; }
  private hands(parcels: readonly Parcel[]): Parcel[] { return parcels.filter((p) => p.place === 'maos' && p.holder === this.holder); }

  /** Problem with the boot as it is now (null = physically valid and consistent with custody). */
  problem(parcels: readonly Parcel[]): string | null {
    const inside = this.contents(parcels);
    const bad = inside.find((p) => p.holder !== this.holder || !STOWABLE.includes(p.state));
    if (bad) return `${bad.id}: custódia inválida no porta-malas (${bad.holder}, ${bad.state})`;
    return layoutProblem(this.compartment, this.placed(parcels));
  }

  /** Dry run: which of the parcels in the hands would go in right now (no state change). */
  plan(parcels: readonly Parcel[]): Arrangement {
    const incoming = this.hands(parcels).filter((p) => STOWABLE.includes(p.state)).map((p) => ({ id: p.id, dims: parcelDims(p.id) }));
    return arrange(this.compartment, this.placed(parcels), incoming);
  }

  private refusal(ctx: TrunkContext): string | null {
    if (!ctx.parked) return 'Pare e estacione o carro (freio de mão) antes de mexer no porta-malas';
    if (!this.open) return 'Abra o porta-malas primeiro';
    return null;
  }

  /**
   * Puts the parcels in the hands into the boot, automatically arranged. Collected parcels become
   * EM_TRANSPORTE as they go in (same rule as the motorcycle top box). Atomic: the whole plan is
   * computed and checked first; parcels without room are left untouched in the hands.
   */
  stow(parcels: readonly Parcel[], hour: number, ctx: TrunkContext): StowResult {
    const refused = this.refusal(ctx);
    if (refused) return { stowed: [], rejected: [], refused };
    const hands = this.hands(parcels).filter((p) => STOWABLE.includes(p.state));
    if (!hands.length) return { stowed: [], rejected: [], refused: 'Nenhum volume nas mãos' };
    const plan = this.plan(parcels);
    const after = layoutProblem(this.compartment, plan.placed);
    if (after) throw new ParcelError(`porta-malas: arranjo inválido (${after})`);
    const byId = new Map(parcels.map((p) => [p.id, p]));
    const slotFor = new Map(plan.placed.map((p) => [p.box.id, p.slot]));
    if (plan.rearranged) for (const p of this.contents(parcels)) {
      const slot = slotFor.get(p.id)!;
      if (!sameSlot(slot, slotOf(p.stowage!))) restow(p, this.stowage(slot), this.holder, hour);
    }
    for (const id of plan.accepted) {
      const p = byId.get(id)!;
      // Same transition as the top box: collected → in transport (still in the hands), then into the boot.
      if (p.state === 'COLETADO') advance(p, 'EM_TRANSPORTE', this.holder, hour);
      move(p, 'porta-malas', this.holder, hour, null, this.stowage(slotFor.get(id)!));
    }
    return { stowed: [...plan.accepted], rejected: [...plan.rejected], refused: null };
  }

  /** Takes the given parcels out of the boot into the hands (the rest settles or is re-packed). */
  take(parcels: readonly Parcel[], ids: readonly string[], hour: number, ctx: TrunkContext, handsFree: number): { taken: readonly string[]; refused: string | null } {
    const refused = this.refusal(ctx);
    if (refused) return { taken: [], refused };
    const inside = new Map(this.contents(parcels).map((p) => [p.id, p]));
    const want = [...new Set(ids)];
    if (!want.length || want.some((id) => !inside.has(id))) return { taken: [], refused: 'Volume não está neste porta-malas' };
    if (want.length > handsFree) return { taken: [], refused: 'Mãos cheias' };
    const rest = arrangeAfterRemoval(this.compartment, this.placed(parcels), new Set(want));
    if (!rest) return { taken: [], refused: 'Sem arranjo válido para o restante da carga' };
    for (const id of want) move(inside.get(id)!, 'maos', this.holder, hour);
    if (rest.rearranged) for (const q of rest.placed) {
      const p = inside.get(q.box.id)!;
      if (!sameSlot(q.slot, slotOf(p.stowage!))) restow(p, this.stowage(q.slot), this.holder, hour);
    }
    return { taken: want, refused: null };
  }
}
