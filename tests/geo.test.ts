import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createMotionGuard, pointInPoly } from '../src/core/collision.ts';
import { GEO } from '../src/world/geo/brejoAlegreData.ts';
import { NETWORK, SEDE, degreeOf } from '../src/world/geo/network.ts';
import { DEPOT_SITE, GEO_BLOCKS, GEO_LOTS, GEO_WALLS, pointInPolygon, roadDistance } from '../src/world/geo/geoCity.ts';
import { CITY_BOUNDS, CITY_LOTS, DEPOT, ROADS, STORES, cityPolygons, depotPoly, depotWorld, nearestRoad, storeLayout } from '../src/world/city/cityPlan.ts';
import { solidPolygons } from '../src/world/city/cityLayout.ts';
import { HOUSE_DEPTH, HOUSE_STYLES, HOUSE_WIDTH, ROAD_HALF, SIDEWALK, frameCorners, framePoint, houseSpan } from '../src/world/layout.ts';
import { DEPOT_SPOTS } from '../src/core/delivery/workday.ts';

const raw = JSON.parse(readFileSync('data/osm/brejo-alegre.raw.json', 'utf8'));
const source = JSON.parse(readFileSync('data/osm/SOURCE.json', 'utf8'));
const haversine = (a: { lat: number; lon: number }, b: { lat: number; lon: number }) => {
  const R = 6371008.8; const rad = Math.PI / 180;
  const dLat = (b.lat - a.lat) * rad; const dLon = (b.lon - a.lon) * rad;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(a.lat * rad) * Math.cos(b.lat * rad) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
};
const rawWays = raw.elements.filter((e: { type: string; tags?: Record<string, string> }) => e.type === 'way' && e.tags?.highway);

test('provenance: OSM extract with licence, date and bounding box', () => {
  assert.match(source.license, /ODbL/);
  assert.match(source.license, /OpenStreetMap contributors/);
  assert.ok(Date.parse(source.fetchedAt) > 0 && source.osmBase);
  assert.ok(source.bbox.south < -21.1 && source.bbox.north > -21.2 && source.bbox.west < -50.15);
  assert.equal(GEO.source.fetchedAt, source.fetchedAt);
});

test('scale 1:1: game distances equal the geodesic distances of the OSM coordinates (< 0.05 %)', () => {
  let checked = 0;
  for (const w of rawWays) {
    const g = w.geometry as { lat: number; lon: number }[];
    if (!g || g.length < 2) continue;
    const street = GEO.streets.find((s) => s.id === w.id)!;
    const a = g[0]!; const b = g[g.length - 1]!;
    const real = haversine(a, b);
    if (real < 150) continue;
    const pa = street.pts[0]!; const pb = street.pts[street.pts.length - 1]!;
    const game = Math.hypot(pb[0] - pa[0], pb[1] - pa[1]);
    // Coordinates are stored to 0.1 m, so up to 0.15 m of rounding on top of < 0.05 % projection error.
    assert.ok(Math.abs(game - real) < real * 0.0005 + 0.15, `${w.tags.name ?? w.id}: ${game.toFixed(1)} m vs ${real.toFixed(1)} m`);
    checked++;
  }
  assert.ok(checked >= 20, `${checked} ways checked`);
});

test('real streets and junctions imported (names from OSM, no invented street)', () => {
  assert.ok(NETWORK.roads.length >= 150 && NETWORK.nodes.length >= 100);
  const junctions = NETWORK.nodes.filter((n) => degreeOf(NETWORK, n.id) >= 3);
  assert.ok(junctions.length >= 80, `${junctions.length} junctions`);
  const names = new Set(ROADS.map((r) => r.name));
  for (const n of ['Rua Nove de Julho', 'Rua Coroados', 'Rua das Palmeiras', 'Rua Sete de Setembro', 'Rua Treze de Maio', 'Rua Quinze de Novembro', 'Rua Oito de Julho', 'Rua General Osório', 'Rua Santos Dumont']) {
    assert.ok(names.has(n), n);
  }
  // Every road is a piece of a real OSM way.
  const osmIds = new Set(GEO.streets.map((s) => s.id));
  for (const r of ROADS) assert.ok(osmIds.has(r.osmWay), `${r.id} comes from OSM way ${r.osmWay}`);
  // One connected network.
  const adj = new Map<string, string[]>();
  for (const r of NETWORK.roads) { (adj.get(r.a) ?? adj.set(r.a, []).get(r.a)!).push(r.b); (adj.get(r.b) ?? adj.set(r.b, []).get(r.b)!).push(r.a); }
  const seen = new Set([NETWORK.nodes[0]!.id]); const stack = [NETWORK.nodes[0]!.id];
  while (stack.length) for (const q of adj.get(stack.pop()!) ?? []) if (!seen.has(q)) { seen.add(q); stack.push(q); }
  assert.equal(seen.size, NETWORK.nodes.length);
});

test('main intersections sit on the shared OSM node of both streets', () => {
  const pairs = [['Rua Nove de Julho', 'Rua Coroados'], ['Rua Sete de Setembro', 'Rua General Osório'], ['Rua Treze de Maio', 'Rua Oito de Julho']];
  let found = 0;
  for (const [s1, s2] of pairs) {
    const w1 = rawWays.filter((w: { tags: Record<string, string> }) => w.tags.name === s1);
    const w2 = rawWays.filter((w: { tags: Record<string, string> }) => w.tags.name === s2);
    const ids1 = new Set(w1.flatMap((w: { nodes: number[] }) => w.nodes));
    const shared = w2.flatMap((w: { nodes: number[] }) => w.nodes).find((id: number) => ids1.has(id));
    if (shared === undefined) continue;
    const node = NETWORK.nodes.find((n) => n.osm === shared);
    assert.ok(node, `${s1} × ${s2}: OSM node ${shared} is a game junction`);
    const arms = NETWORK.roads.filter((r) => r.a === node!.id || r.b === node!.id).map((r) => r.name);
    assert.ok(arms.includes(s1) && arms.includes(s2), `${s1} × ${s2} arms: ${arms.join(', ')}`);
    found++;
  }
  assert.ok(found >= 2, `${found} named intersections verified`);
});

test('coverage: every drivable OSM way of the urban seat is in the game network', () => {
  const inSede = (p: readonly number[]) => p[0]! >= SEDE.minX && p[0]! <= SEDE.maxX && p[1]! >= SEDE.minZ && p[1]! <= SEDE.maxZ;
  const drivable = new Set(['secondary', 'tertiary', 'unclassified', 'residential', 'living_street', 'secondary_link']);
  const len = (pts: readonly (readonly number[])[]) => pts.slice(1).reduce((t, p, i) => t + Math.hypot(p[0]! - pts[i]![0]!, p[1]! - pts[i]![1]!), 0);
  let osm = 0; let game = 0;
  for (const s of GEO.streets) if (drivable.has(s.highway) && s.pts.every(inSede)) osm += len(s.pts);
  for (const r of ROADS) if (r.pts.every(inSede)) game += r.length;
  assert.ok(game / osm > 0.995, `${(100 * game / osm).toFixed(1)} % of ${osm.toFixed(0)} m`);
});

test('blocks are real faces of the street graph; lots never stand on a street or on each other', () => {
  assert.ok(GEO_BLOCKS.length >= 40);
  for (const l of GEO_LOTS) {
    for (const [x, z] of frameCorners(l.frame, 0, l.width, 0, l.depth)) {
      const n = nearestRoad(x, z)!;
      assert.ok(n.d >= ROAD_HALF + SIDEWALK - 0.1, `${l.id} corner ${n.d.toFixed(2)} m from ${n.road.name}`);
    }
    const c = framePoint(l.frame, l.width / 2, l.depth / 2);
    assert.ok(GEO_BLOCKS.some((b) => pointInPolygon(b.lot, c.x, c.z)), `${l.id} inside a real block`);
  }
  assert.ok(CITY_LOTS.length >= 500, `${CITY_LOTS.length} houses`);
  assert.equal(STORES.length, 8);
  for (const s of STORES) assert.ok(nearestRoad(s.door.x, s.door.z)!.d < ROAD_HALF + SIDEWALK + 2, `${s.id} faces a street`);
  const gate = depotWorld((DEPOT.gate.x0 + DEPOT.gate.x1) / 2, DEPOT.lot.maxZ);
  // Block edges are simplified (≤ 4° bends merged), so a frontage can sit ~1 m off a curving real road.
  assert.ok(nearestRoad(gate.x, gate.z)!.d < ROAD_HALF + SIDEWALK + 1.5, 'depot gate on a street');
});

test('everything needed for the job is reachable on foot from the depot; house interiors are not', () => {
  const guard = createMotionGuard(CITY_BOUNDS, [], solidPolygons());
  const start = depotWorld(84, -111);
  const step = 1;
  const key = (x: number, z: number) => `${Math.round(x / step)},${Math.round(z / step)}`;
  const seen = new Set<string>([key(start.x, start.z)]);
  const queue: [number, number][] = [[Math.round(start.x), Math.round(start.z)]];
  while (queue.length) {
    const [x, z] = queue.pop()!;
    for (const [dx, dz] of [[step, 0], [-step, 0], [0, step], [0, -step]] as const) {
      const nx = x + dx; const nz = z + dz;
      if (seen.has(key(nx, nz)) || !guard(nx, nz, 0.3)) continue;
      seen.add(key(nx, nz)); queue.push([nx, nz]);
    }
  }
  const reach = (p: { x: number; z: number }) => [[0, 0], [1, 0], [-1, 0], [0, 1], [0, -1]].some(([a, b]) => seen.has(key(p.x + a!, p.z + b!)));
  for (const s of STORES) assert.ok(reach(storeLayout(s).pickup), `${s.id} counter reachable`);
  // The desks are in world coordinates INSIDE the depot shed on the real block (not in the fields).
  const shed = depotPoly(DEPOT.building);
  for (const k of ['receiving', 'sorting', 'office'] as const) assert.ok(pointInPoly(shed.pts, DEPOT_SPOTS[k].x, DEPOT_SPOTS[k].z), `${k} inside the shed`);
  assert.ok(reach(DEPOT_SPOTS.receiving) && reach(DEPOT_SPOTS.dispatch), 'depot desks reachable');
  let blocked = 0;
  for (const l of CITY_LOTS.slice(0, 200)) { const c = framePoint(l.frame, l.width / 2, l.depth - 4); if (seen.has(key(c.x, c.z))) blocked++; }
  assert.equal(blocked, 0, 'house interiors unreachable');
});

// ------------------------------------------------------------------ CORE-015.1 regressions

test('CORE-015.1: kerbs follow the real carriageway (no pavement on the asphalt, also on curves and dead ends)', () => {
  let total = 0; let inside = 0; let worst = Infinity;
  for (const b of GEO_BLOCKS) {
    const k = b.kerb;
    assert.equal(k.length, b.lot.length, `${b.id}: kerb and lot line correspond vertex by vertex`);
    for (let i = 0; i < k.length; i++) {
      const a = k[i]!; const c = k[(i + 1) % k.length]!; const L = Math.hypot(c[0] - a[0], c[1] - a[1]);
      for (let s = 0; s <= L; s += 1) {
        const d = roadDistance(a[0] + ((c[0] - a[0]) * s) / L, a[1] + ((c[1] - a[1]) * s) / L);
        total++; worst = Math.min(worst, d);
        if (d < ROAD_HALF - 0.3) inside++;
      }
    }
  }
  // Before the fix: 357 of 16 369 samples were inside the asphalt (worst: on the road axis).
  assert.ok(inside <= total * 0.001, `${inside}/${total} kerb samples inside the carriageway`);
  assert.ok(worst > ROAD_HALF - 1, `worst kerb point ${worst.toFixed(2)} m from a road axis`);
});

test('CORE-015.1: frontage walls and house walls stay inside their lots, off every street', () => {
  const E = ROAD_HALF + SIDEWALK;
  for (const w of GEO_WALLS) {
    for (let s = 0; s <= w.length; s += 0.5) {
      const p = framePoint(w.frame, s, 0.11);
      assert.ok(roadDistance(p.x, p.z) >= E - 0.35, `wall of ${w.block} at ${p.x.toFixed(1)},${p.z.toFixed(1)} is ${roadDistance(p.x, p.z).toFixed(2)} m from a road axis`);
    }
  }
  for (const l of CITY_LOTS) {
    // The visual plan is built with the lot's own size: body, garage and walls fit inside it.
    const style = HOUSE_STYLES[l.style % HOUSE_STYLES.length]!;
    const [x0, x1] = houseSpan({ garageSide: style.garageSide, lotWidth: l.width });
    assert.ok(x0 >= 0.2 && x1 <= l.width - 0.2 && Math.abs(x1 - x0 - HOUSE_WIDTH) < 1e-9, `${l.id}: house body inside the lot width ${l.width.toFixed(1)}`);
    const setback = Math.min(style.setback, Math.max(1.5, l.depth - HOUSE_DEPTH - 0.5));
    assert.ok(setback + HOUSE_DEPTH <= l.depth - 0.2, `${l.id}: house body inside the lot depth ${l.depth}`);
    for (const c of frameCorners(l.frame, 0, l.width, 0, l.depth)) assert.ok(roadDistance(c[0], c[1]) >= E - 0.35, `${l.id}: lot corner off the street`);
  }
});

test('CORE-015.1: the depot site is clear of every road, including dead-end streets inside its block', () => {
  let min = Infinity;
  for (let x = 0; x <= DEPOT_SITE.width; x += 2) for (let z = 0; z <= DEPOT_SITE.depth; z += 2) { const p = framePoint(DEPOT_SITE.frame, x, z); min = Math.min(min, roadDistance(p.x, p.z)); }
  assert.ok(min >= ROAD_HALF + SIDEWALK - 0.1, `closest road axis ${min.toFixed(2)} m from the depot site`);
  assert.equal(nearestRoad(DEPOT_SITE.frame.ox, DEPOT_SITE.frame.oz)!.road.name, 'Estrada Municipal Manoel Leitão', 'same real street as in CORE-015');
});
