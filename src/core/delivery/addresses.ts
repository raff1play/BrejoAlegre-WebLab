import { LOT_WIDTH, SIDEWALK, framePoint, yawOf, type Frame } from '../../world/layout.ts';
import { BLOCKS, CITY_LOTS, ROADS } from '../../world/city/cityPlan.ts';
import { TOWN_CENTRE } from '../../world/geo/geoCity.ts';

/**
 * CORE-015 deliverable addresses on the REAL streets of Brejo Alegre (names from OpenStreetMap).
 * House positions are ESTIMATED (OSM has no lots or house numbers here) and the numbers follow the
 * Brazilian metric rule from the end of the street nearest the town centre (even on the right):
 * they are game numbers, not the real numbering of any property.
 */
export type Address = Readonly<{
  id: string; lot: string; street: string; number: number; bairro: string; label: string;
  frame: Frame;
  door: { x: number; z: number };
  stop: { x: number; z: number };
  plate: { x: number; z: number; yaw: number };
  estimated: true;
}>;

export const DELIVERABLE_COUNT = 48;

/** Street origin (end closest to the centre) and direction, from all its real OSM segments. */
function streetFrame(name: string): { ox: number; oz: number; dx: number; dz: number } | null {
  const pts = ROADS.filter((r) => r.name === name).flatMap((r) => r.pts);
  if (pts.length < 2) return null;
  // The two most distant points are the street ends.
  let best = { d: -1, a: pts[0]!, b: pts[1]! };
  for (const a of pts) for (const b of pts) { const d = Math.hypot(a[0] - b[0], a[1] - b[1]); if (d > best.d) best = { d, a, b }; }
  const da = Math.hypot(best.a[0] - TOWN_CENTRE[0], best.a[1] - TOWN_CENTRE[1]);
  const db = Math.hypot(best.b[0] - TOWN_CENTRE[0], best.b[1] - TOWN_CENTRE[1]);
  const [o, e] = da <= db ? [best.a, best.b] : [best.b, best.a];
  const L = Math.hypot(e[0] - o[0], e[1] - o[1]) || 1;
  return { ox: o[0], oz: o[1], dx: (e[0] - o[0]) / L, dz: (e[1] - o[1]) / L };
}

/** `free` (optional) checks a pavement spot; the door slides along the frontage around trees/poles. */
export function buildAddresses(free: (x: number, z: number) => boolean = () => true): Address[] {
  // Spread the deliverable houses over the whole seat: farthest-point sampling, deterministic.
  const candidates = CITY_LOTS.filter((l) => l.street && !l.street.startsWith('Via sem nome') && !l.street.startsWith('Estrada'));
  const centreOf = (l: (typeof CITY_LOTS)[number]) => framePoint(l.frame, l.width / 2, 0);
  const chosen: (typeof CITY_LOTS)[number][] = [];
  if (candidates.length) chosen.push(candidates[0]!);
  while (chosen.length < Math.min(DELIVERABLE_COUNT, candidates.length)) {
    let best = candidates[0]!; let bestD = -1;
    for (const c of candidates) {
      const p = centreOf(c);
      const d = Math.min(...chosen.map((q) => { const r = centreOf(q); return Math.hypot(p.x - r.x, p.z - r.z); }));
      if (d > bestD) { bestD = d; best = c; }
    }
    chosen.push(best);
  }
  chosen.sort((a, b) => a.id.localeCompare(b.id, 'en', { numeric: true }));
  const frames = new Map<string, ReturnType<typeof streetFrame>>();
  const used = new Set<string>();
  const out: Address[] = [];
  for (const l of chosen) {
    const frame = l.frame; const W = l.width ?? LOT_WIDTH;
    let lx = W / 2;
    for (const t of [W / 2, W / 2 - 1.4, W / 2 + 1.4, 2.5, W - 2.5]) { const p = framePoint(frame, t, -0.9); if (free(p.x, p.z)) { lx = t; break; } }
    const door = framePoint(frame, lx, -0.9);
    const stop = framePoint(frame, lx, -SIDEWALK - 1.3);
    const plateAt = framePoint(frame, 0.55, -0.02);
    const street = l.street!;
    if (!frames.has(street)) frames.set(street, streetFrame(street));
    const sf = frames.get(street)!;
    const centre = framePoint(frame, W / 2, -0.9);
    let number = 1;
    if (sf) {
      const along = (centre.x - sf.ox) * sf.dx + (centre.z - sf.oz) * sf.dz;
      const across = (centre.x - sf.ox) * sf.dz - (centre.z - sf.oz) * sf.dx; // > 0: right-hand side
      number = Math.max(1, Math.round(along));
      if ((number % 2 === 0) !== across > 0) number += 1;
    }
    while (used.has(`${street}#${number}`)) number += 2;
    used.add(`${street}#${number}`);
    const block = BLOCKS.find((b) => b.id === l.block);
    const bairro = block?.sector === 'centro' ? 'Centro' : 'Brejo Alegre';
    out.push({
      id: `end-${l.id}`, lot: l.id, street, number, bairro, label: `${street}, ${number} — ${bairro}`,
      frame, door, stop, plate: { ...plateAt, yaw: yawOf(frame) + Math.PI }, estimated: true,
    });
  }
  return out;
}
