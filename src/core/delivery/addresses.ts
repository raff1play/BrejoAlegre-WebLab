import { HOUSES, LOT_WIDTH, SIDEWALK, framePoint, frameYaw, type Frame } from '../../world/layout.ts';
import { BLOCKS, CITY_LOTS, ROADS, roadSpan, type CityRoad } from '../../world/city/cityPlan.ts';

/**
 * CORE-014 deliverable addresses: every house lot of the town (W009 core + expansion). Numbers
 * follow the Brazilian metric rule (distance from the start of the street, even on the right,
 * odd on the left); street names come from the plan, bairros other than Centro are fictional.
 */
export type Address = Readonly<{
  id: string; lot: string; street: string; number: number; bairro: string; label: string;
  frame: Frame;
  /** On the pavement in front of the gate: where the parcel is handed over. */
  door: { x: number; z: number };
  /** Kerb-side spot on the carriageway to park the motorcycle. */
  stop: { x: number; z: number };
  /** Number plate on the front wall, facing the street. */
  plate: { x: number; z: number; yaw: number };
}>;

const BAIRRO: Record<string, string> = {
  tiete: 'Jardim Tietê', primavera: 'Jardim Primavera', vilanova: 'Vila Nova',
};

function bairroAt(x: number, z: number): string {
  const block = BLOCKS.find((b) => x >= b.box.minX - 1 && x <= b.box.maxX + 1 && z >= b.box.minZ - 1 && z <= b.box.maxZ + 1);
  const key = block?.id.split('-')[0] ?? '';
  return BAIRRO[key] ?? 'Centro';
}

/** Street segment the lot fronts: the road whose axis is closest to the pavement point. */
function frontingRoad(x: number, z: number): CityRoad {
  let best: CityRoad = ROADS[0]!; let bestD = Infinity;
  for (const r of ROADS) {
    if (r.kind !== 'urban') continue;
    const s = roadSpan(r);
    const [along, across] = s.axis === 'x' ? [x, z] : [z, x];
    const out = Math.max(0, s.lo - along, along - s.hi);
    const d = Math.hypot(out, across - s.c);
    if (d < bestD) { bestD = d; best = r; }
  }
  return best;
}

/** `free` (optional) checks a pavement spot; the door slides along the frontage around trees/shelters. */
export function buildAddresses(free: (x: number, z: number) => boolean = () => true): Address[] {
  const lots = [
    ...HOUSES.map((h) => ({ lot: h.id, frame: h.frame })),
    ...CITY_LOTS.map((l) => ({ lot: l.id, frame: l.frame })),
  ];
  const used = new Set<string>();
  const out: Address[] = [];
  for (const { lot, frame } of lots) {
    let lx = LOT_WIDTH / 2;
    for (const t of [6, 4.6, 7.4, 3.2, 8.8, 2]) { const p = framePoint(frame, t, -0.9); if (free(p.x, p.z)) { lx = t; break; } }
    const door = framePoint(frame, lx, -0.9);
    const stop = framePoint(frame, lx, -SIDEWALK - 1.3);
    const plateAt = framePoint(frame, 0.55, -0.02);
    // Street and number come from the lot centre (stable whatever spot the door slides to).
    const centre = framePoint(frame, LOT_WIDTH / 2, -0.9);
    const road = frontingRoad(centre.x, centre.z);
    const street = road.name;
    // The whole street (all segments with the same name) is numbered from its lowest coordinate.
    const segments = ROADS.filter((r) => r.name === street).map(roadSpan);
    const start = Math.min(...segments.map((s) => s.lo));
    const s = roadSpan(road);
    const along = (s.axis === 'x' ? centre.x : centre.z) - start;
    // Right-hand side when walking towards increasing numbers: even.
    const across = (s.axis === 'x' ? centre.z : centre.x) - s.c;
    const right = s.axis === 'x' ? across < 0 : across > 0;
    let number = Math.max(1, Math.round(along));
    if ((number % 2 === 0) !== right) number += 1;
    while (used.has(`${street}#${number}`)) number += 2;
    used.add(`${street}#${number}`);
    const bairro = bairroAt(door.x + (stop.x - door.x) * -4, door.z + (stop.z - door.z) * -4);
    out.push({
      id: `end-${lot}`, lot, street, number, bairro, label: `${street}, ${number} — ${bairro}`,
      frame, door, stop, plate: { ...plateAt, yaw: frameYaw(frame.side) + Math.PI },
    });
  }
  return out;
}
