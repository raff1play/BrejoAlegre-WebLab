/**
 * CORE-015 verifiable map comparison: the RAW OpenStreetMap extract (data/osm/brejo-alegre.raw.json,
 * re-projected here from latitude/longitude, independently of the importer) against what the game
 * actually uses (street network, nodes, blocks, lots, minimap). Writes metrics and an SVG render of
 * the raw OSM data at the minimap scale (1.2 px/m, north up, same bounds) to
 * docs/evidence/core015-mapa/. Run with:
 *
 *   node --experimental-strip-types scripts/geo/compare-map.ts
 *
 * Map data © OpenStreetMap contributors, ODbL 1.0.
 */
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { NETWORK, PLAY_BOUNDS, SEDE, degreeOf } from '../../src/world/geo/network.ts';
import { GEO_BLOCKS, GEO_LOTS } from '../../src/world/geo/geoCity.ts';
import { CITY_LOTS, STORES } from '../../src/world/city/cityPlan.ts';
import { buildAddresses } from '../../src/core/delivery/addresses.ts';

type LL = { lat: number; lon: number };
type Way = { id: number; tags: Record<string, string>; geometry?: LL[]; nodes?: number[] };
const OUT = 'docs/evidence/core015-mapa';
const raw = JSON.parse(readFileSync('data/osm/brejo-alegre.raw.json', 'utf8')) as { osm3s: { timestamp_osm_base: string }; elements: (Way & { type: string; lat?: number; lon?: number })[] };
const source = JSON.parse(readFileSync('data/osm/SOURCE.json', 'utf8'));

// Independent projection (local tangent plane at the bbox centre) and haversine for distances.
const R = 6371008.8;
const rad = (d: number) => (d * Math.PI) / 180;
const lat0 = (source.bbox.south + source.bbox.north) / 2;
const lon0 = (source.bbox.west + source.bbox.east) / 2;
const proj = (p: LL): [number, number] => [R * rad(p.lon - lon0) * Math.cos(rad(lat0)), R * rad(p.lat - lat0)];
const haversine = (a: LL, b: LL) => {
  const dφ = rad(b.lat - a.lat); const dλ = rad(b.lon - a.lon);
  const h = Math.sin(dφ / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dλ / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
};
const unproj = (x: number, z: number): LL => ({ lat: lat0 + (z / R) * (180 / Math.PI), lon: lon0 + (x / (R * Math.cos(rad(lat0)))) * (180 / Math.PI) });

const DRIVABLE = new Set(['primary', 'secondary', 'tertiary', 'unclassified', 'residential', 'living_street', 'primary_link', 'secondary_link', 'tertiary_link']);
const ways = raw.elements.filter((e) => e.type === 'way') as Way[];
const highways = ways.filter((w) => w.tags?.highway && w.geometry);
const drivable = highways.filter((w) => DRIVABLE.has(w.tags.highway!));
const inBox = (b: typeof PLAY_BOUNDS, p: [number, number]) => p[0] >= b.minX && p[0] <= b.maxX && p[1] >= b.minZ && p[1] <= b.maxZ;

// ---------------------------------------------------------------- inventory of the raw file
const byClass: Record<string, number> = {};
for (const w of highways) byClass[w.tags.highway!] = (byClass[w.tags.highway!] ?? 0) + 1;
const named = new Set(highways.filter((w) => w.tags.name).map((w) => w.tags.name!));
// OSM intersections: nodes used by drivable ways with degree ≥ 3 (counting way ends once, interior twice).
const deg = new Map<number, number>(); const nodeLL = new Map<number, LL>();
for (const w of drivable) w.nodes!.forEach((n, i) => {
  nodeLL.set(n, w.geometry![i]!);
  deg.set(n, (deg.get(n) ?? 0) + (i === 0 || i === w.nodes!.length - 1 ? 1 : 2));
});
const osmJunctions = [...deg].filter(([, d]) => d >= 3).map(([n]) => ({ n, ll: nodeLL.get(n)!, p: proj(nodeLL.get(n)!) }));
const junctionsSede = osmJunctions.filter((j) => inBox(SEDE, j.p));
const buildings = raw.elements.filter((e) => e.tags?.building);
const lengthOf = (pts: [number, number][]) => pts.slice(1).reduce((t, p, i) => t + Math.hypot(p[0] - pts[i]![0], p[1] - pts[i]![1]), 0);

// ---------------------------------------------------------------- coverage (OSM ↔ game roads)
const gameRoads = NETWORK.roads.map((r) => r.pts as [number, number][]);
const distTo = (lines: [number, number][][], x: number, z: number) => {
  let best = Infinity;
  for (const pts of lines) for (let i = 1; i < pts.length; i++) {
    const a = pts[i - 1]!; const b = pts[i]!;
    if (Math.min(a[0], b[0]) - best > x || Math.max(a[0], b[0]) + best < x || Math.min(a[1], b[1]) - best > z || Math.max(a[1], b[1]) + best < z) continue;
    const dx = b[0] - a[0]; const dz = b[1] - a[1]; const L2 = dx * dx + dz * dz || 1;
    const t = Math.max(0, Math.min(1, ((x - a[0]) * dx + (z - a[1]) * dz) / L2));
    best = Math.min(best, Math.hypot(a[0] + dx * t - x, a[1] + dz * t - z));
  }
  return best;
};
const sample = (pts: [number, number][], step: number, visit: (x: number, z: number) => void) => {
  for (let i = 1; i < pts.length; i++) {
    const a = pts[i - 1]!; const b = pts[i]!; const L = Math.hypot(b[0] - a[0], b[1] - a[1]);
    for (let s = 0; s < L; s += step) visit(a[0] + ((b[0] - a[0]) * s) / L, a[1] + ((b[1] - a[1]) * s) / L);
  }
};
const TOL = 1.0;
const osmLines = drivable.map((w) => w.geometry!.map(proj));
let osmIn = 0; let osmHit = 0; let maxOff = 0;
for (const pts of osmLines) sample(pts, 1, (x, z) => {
  if (!inBox(PLAY_BOUNDS, [x, z])) return;
  osmIn++; const d = distTo(gameRoads, x, z); maxOff = Math.max(maxOff, Math.min(d, 99));
  if (d <= TOL) osmHit++;
});
let gameIn = 0; let gameHit = 0;
for (const pts of gameRoads) sample(pts, 1, (x, z) => {
  if (!inBox(PLAY_BOUNDS, [x, z])) return;
  gameIn++; if (distTo(osmLines, x, z) <= TOL) gameHit++;
});
// Junctions: every OSM junction in the playable area must be a game node (≤ 1 m).
const gameNodes = NETWORK.nodes.filter((n) => !n.exit && degreeOf(NETWORK, n.id) >= 3);
const jPlay = osmJunctions.filter((j) => inBox(PLAY_BOUNDS, j.p));
const matched = jPlay.filter((j) => gameNodes.some((n) => Math.hypot(n.x - j.p[0], n.z - j.p[1]) <= TOL));
const unmatched = jPlay.filter((j) => !matched.includes(j));

// Scale: haversine (on the sphere, from lat/lon) vs straight game distance between junction pairs.
const pairs: { a: string; b: string; real: number; game: number; err: number }[] = [];
const named4 = gameNodes.filter((n) => n.osm !== null).slice(0, 400);
for (let i = 0; i < named4.length && pairs.length < 12; i += 17) {
  const a = named4[i]!; const b = named4[(i * 7 + 31) % named4.length]!;
  if (a === b) continue;
  const real = haversine(nodeLL.get(a.osm!)!, nodeLL.get(b.osm!)!);
  const game = Math.hypot(a.x - b.x, a.z - b.z);
  pairs.push({ a: `n${a.osm}`, b: `n${b.osm}`, real: +real.toFixed(2), game: +game.toFixed(2), err: +(game - real).toFixed(3) });
}

// Extent of the seat in metres (real, from the OSM drivable roads inside SEDE).
const sedePts = osmLines.flat().filter((p) => inBox(SEDE, p));
const xs = sedePts.map((p) => p[0]); const zs = sedePts.map((p) => p[1]);
const ext = { westEast: Math.max(...xs) - Math.min(...xs), southNorth: Math.max(...zs) - Math.min(...zs) };
const addresses = buildAddresses();

const urbanRoads = NETWORK.roads.filter((r) => r.kind === 'urban');
const metrics = {
  generatedFor: 'CORE-015',
  source: { endpoint: source.endpoint, fetchedAt: source.fetchedAt, osmBase: raw.osm3s.timestamp_osm_base, bbox: source.bbox, license: source.license },
  projection: { kind: 'local equirectangular tangent plane', origin: { lat: lat0, lon: lon0 }, unit: '1 unit = 1 m', axes: '+x east, +z north' },
  rawFile: {
    elements: raw.elements.length, highwayWays: highways.length, highwayByClass: byClass, drivableWays: drivable.length,
    namedStreets: named.size, drivableJunctionsInBbox: osmJunctions.length, drivableJunctionsInSeat: junctionsSede.length,
    buildings: buildings.length, landuse: ways.filter((w) => w.tags?.landuse).length, leisure: ways.filter((w) => w.tags?.leisure).length,
    amenityNodes: raw.elements.filter((e) => e.type === 'node' && e.tags?.amenity).length,
  },
  seatExtentMetres: { westEast: +ext.westEast.toFixed(1), southNorth: +ext.southNorth.toFixed(1), sedeBox: SEDE, playBounds: PLAY_BOUNDS },
  game: {
    roadSegments: NETWORK.roads.length, urbanSegments: urbanRoads.length, ruralSegments: NETWORK.roads.length - urbanRoads.length,
    streetsByName: new Set(NETWORK.roads.map((r) => r.name).filter(Boolean)).size,
    junctions: gameNodes.length, junctionsInSeat: gameNodes.filter((n) => inBox(SEDE, [n.x, n.z])).length,
    roadLengthKm: +(NETWORK.roads.reduce((t, r) => t + r.length, 0) / 1000).toFixed(2),
    blocks: GEO_BLOCKS.length, lots: GEO_LOTS.length, houses: CITY_LOTS.length, shops: STORES.length, deliverableAddresses: addresses.length,
  },
  comparison: {
    toleranceMetres: TOL,
    osmDrivableCoveredByGame: +((osmHit / osmIn) * 100).toFixed(2),
    gameRoadsOnOsm: +((gameHit / gameIn) * 100).toFixed(2),
    maxOsmOffsetMetres: +maxOff.toFixed(2),
    junctionsInPlayArea: jPlay.length, junctionsMatched: matched.length,
    unmatchedJunctions: unmatched.map((j) => ({ node: j.n, x: +j.p[0].toFixed(1), z: +j.p[1].toFixed(1) })),
    scalePairs: pairs, maxScaleErrorMetres: Math.max(...pairs.map((p) => Math.abs(p.err))),
  },
};
mkdirSync(OUT, { recursive: true });
writeFileSync(`${OUT}/metricas.json`, JSON.stringify(metrics, null, 2) + '\n');

// ---------------------------------------------------------------- raw OSM render (minimap scale)
const PX = 1.2; const B = PLAY_BOUNDS;
const W = (B.maxX - B.minX) * PX; const H = (B.maxZ - B.minZ) * PX;
const sx = (x: number) => ((x - B.minX) * PX).toFixed(1); const sz = (z: number) => ((B.maxZ - z) * PX).toFixed(1);
const path = (pts: [number, number][], close = false) => `M${pts.map((p) => `${sx(p[0])},${sz(p[1])}`).join('L')}${close ? 'Z' : ''}`;
const COLOR: Record<string, string> = { secondary: '#f0c75e', secondary_link: '#f0c75e', residential: '#ffffff', unclassified: '#d9cfb8', service: '#9aa3ab', track: '#a0835a' };
let svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">\n<rect width="100%" height="100%" fill="#1f2a1c"/>\n`;
for (const w of ways.filter((q) => (q.tags?.landuse || q.tags?.leisure) && q.geometry)) svg += `<path d="${path(w.geometry!.map(proj), true)}" fill="${w.tags.landuse === 'cemetery' ? '#6d6a60' : w.tags.leisure ? '#4f7a3e' : '#2f3d2a'}" opacity="0.9"/>\n`;
for (const w of buildings as Way[]) if (w.geometry) svg += `<path d="${path(w.geometry.map(proj), true)}" fill="#e07a5f"/>\n`;
for (const w of highways) svg += `<path d="${path(w.geometry!.map(proj))}" fill="none" stroke="${COLOR[w.tags.highway!] ?? '#cccccc'}" stroke-width="${w.tags.highway === 'secondary' ? 3 : 2}" stroke-linecap="round" stroke-linejoin="round"${DRIVABLE.has(w.tags.highway!) ? '' : ' stroke-dasharray="6 4"'}/>\n`;
for (const j of osmJunctions) svg += `<circle cx="${sx(j.p[0])}" cy="${sz(j.p[1])}" r="2.4" fill="#ff4d4d"/>\n`;
svg += `<text x="12" y="${H - 14}" fill="#ffffff" font-family="sans-serif" font-size="16">© OpenStreetMap contributors (ODbL) · extração ${source.fetchedAt.slice(0, 10)} · 1,2 px/m · norte para cima</text>\n</svg>\n`;
writeFileSync(`${OUT}/osm-bruto.svg`, svg);
// Overlay layer (transparent): OSM centrelines only, to draw over the game minimap.
let over = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">\n`;
for (const w of highways) over += `<path d="${path(w.geometry!.map(proj))}" fill="none" stroke="#ff2d2d" stroke-width="1.4"${DRIVABLE.has(w.tags.highway!) ? '' : ' stroke-dasharray="5 4"'}/>\n`;
for (const j of osmJunctions) over += `<circle cx="${sx(j.p[0])}" cy="${sz(j.p[1])}" r="2" fill="none" stroke="#ff2d2d" stroke-width="1"/>\n`;
writeFileSync(`${OUT}/osm-sobreposicao.svg`, over + '</svg>\n');
void unproj;
console.log(JSON.stringify(metrics.comparison, null, 1).slice(0, 1600));
console.log(JSON.stringify({ raw: metrics.rawFile, game: metrics.game, ext: metrics.seatExtentMetres }, null, 1));
