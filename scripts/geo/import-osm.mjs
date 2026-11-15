#!/usr/bin/env node
/**
 * CORE-015 importer: data/osm/brejo-alegre.raw.json (Overpass `out body geom` or OSM API 0.6 JSON)
 * → src/world/geo/brejoAlegre.data.json, the single geographic source for roads, buildings and
 * points of interest. Data © OpenStreetMap contributors, ODbL 1.0.
 *
 * Projection: local equirectangular (tangent plane) centred on the OSM place node of the town:
 *   x = R · Δλ · cos φ0   (metres east)      z = R · Δφ   (metres north)      R = 6 371 008.8 m
 * Within ±3 km of the origin the distortion is < 0.02 % (< 0.6 m over 3 km); 1 game unit = 1 m.
 */
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';

const raw = JSON.parse(readFileSync('data/osm/brejo-alegre.raw.json', 'utf8'));
const source = JSON.parse(readFileSync('data/osm/SOURCE.json', 'utf8'));
const R = 6371008.8;
const rad = Math.PI / 180;
const lat0 = source.place?.lat ?? (source.bbox.south + source.bbox.north) / 2;
const lon0 = source.place?.lon ?? (source.bbox.west + source.bbox.east) / 2;
const k = Math.cos(lat0 * rad);
const project = (lat, lon) => [Math.round(R * (lon - lon0) * rad * k * 10) / 10, Math.round(R * (lat - lat0) * rad * 10) / 10];

// Node coordinates (OSM API format) and way geometry (Overpass `geom`).
const nodes = new Map();
for (const el of raw.elements) if (el.type === 'node' && el.lat !== undefined) nodes.set(el.id, el);
const geomOf = (way) => {
  if (way.geometry) return way.geometry.map((g, i) => ({ id: way.nodes?.[i] ?? null, ...g }));
  return (way.nodes ?? []).map((id) => { const n = nodes.get(id); return n ? { id, lat: n.lat, lon: n.lon } : null; }).filter(Boolean);
};

const DRIVE = new Set(['motorway', 'trunk', 'primary', 'secondary', 'tertiary', 'unclassified', 'residential', 'living_street', 'service', 'road', 'primary_link', 'secondary_link', 'tertiary_link', 'track']);
const WALK = new Set(['footway', 'pedestrian', 'path', 'steps', 'cycleway']);
const streets = []; const walkways = []; const buildings = []; const areas = []; const pois = []; const water = [];
const nodeUse = new Map();

for (const el of raw.elements) {
  if (el.type !== 'way' || !el.tags) continue;
  const g = geomOf(el);
  if (g.length < 2) continue;
  const pts = g.map((p) => project(p.lat, p.lon));
  const t = el.tags;
  if (t.highway && (DRIVE.has(t.highway) || WALK.has(t.highway))) {
    const rec = {
      id: el.id, name: t.name ?? null, highway: t.highway, oneway: t.oneway === 'yes' || t.oneway === '1',
      surface: t.surface ?? null, lanes: t.lanes ? Number(t.lanes) : null, width: t.width ? Number(t.width) : null,
      nodes: g.map((p) => p.id), pts,
    };
    (DRIVE.has(t.highway) ? streets : walkways).push(rec);
    if (DRIVE.has(t.highway)) for (const p of g) if (p.id) nodeUse.set(p.id, (nodeUse.get(p.id) ?? 0) + 1);
  } else if (t.building) {
    buildings.push({ id: el.id, kind: t.building, levels: t['building:levels'] ? Number(t['building:levels']) : null, name: t.name ?? null, pts });
  } else if (t.landuse || t.leisure || t.amenity) {
    areas.push({ id: el.id, kind: t.landuse ? `landuse:${t.landuse}` : t.leisure ? `leisure:${t.leisure}` : `amenity:${t.amenity}`, name: t.name ?? null, pts });
    if (t.name && (t.amenity || t.leisure || t.shop)) {
      const cx = pts.reduce((a, p) => a + p[0], 0) / pts.length; const cz = pts.reduce((a, p) => a + p[1], 0) / pts.length;
      pois.push({ id: el.id, osm: 'way', name: t.name, kind: t.amenity ?? t.leisure ?? t.shop, x: Math.round(cx * 10) / 10, z: Math.round(cz * 10) / 10, tags: pick(t) });
    }
  } else if (t.natural === 'water' || t.waterway) {
    water.push({ id: el.id, kind: t.natural ?? t.waterway, pts });
  }
}
for (const el of raw.elements) {
  if (el.type !== 'node' || !el.tags) continue;
  const t = el.tags;
  if (t.amenity || t.shop || t.leisure || t.tourism || t.office || t.place) {
    const [x, z] = project(el.lat, el.lon);
    pois.push({ id: el.id, osm: 'node', name: t.name ?? null, kind: t.place ? `place:${t.place}` : t.amenity ?? t.shop ?? t.leisure ?? t.tourism ?? t.office, x, z, tags: pick(t) });
  }
}
function pick(t) {
  const keep = ['name', 'amenity', 'shop', 'leisure', 'tourism', 'office', 'addr:street', 'addr:housenumber', 'religion', 'opening_hours', 'place', 'sport'];
  return Object.fromEntries(Object.entries(t).filter(([key]) => keep.includes(key)));
}

// Intersections: OSM nodes shared by two or more drivable ways (or used twice by one way).
const intersections = [...nodeUse].filter(([, n]) => n >= 2).map(([id]) => id);
const lengthOf = (pts) => pts.slice(1).reduce((a, p, i) => a + Math.hypot(p[0] - pts[i][0], p[1] - pts[i][1]), 0);
const stats = {
  streets: streets.length, namedStreets: new Set(streets.filter((s) => s.name).map((s) => s.name)).size,
  streetMetres: Math.round(streets.reduce((a, s) => a + lengthOf(s.pts), 0)),
  intersections: intersections.length, walkways: walkways.length, buildings: buildings.length, areas: areas.length,
  pois: pois.length, namedPois: pois.filter((p) => p.name).length,
};
mkdirSync('src/world/geo', { recursive: true });
const data = {
  source: { endpoint: source.endpoint, fetchedAt: source.fetchedAt, osmBase: source.osmBase, bbox: source.bbox, license: source.license, place: source.place },
  projection: { kind: 'local equirectangular (tangent plane)', origin: { lat: lat0, lon: lon0 }, R, units: 'metres; +x east, +z north' },
  stats, streets, walkways, buildings, areas, water, pois, intersections,
};
// The same data as a typed TypeScript module (imported by the game and by the Node tests).
writeFileSync('src/world/geo/brejoAlegreData.ts', `/* GERADO por scripts/geo/import-osm.mjs — não editar à mão.
 * Dados © OpenStreetMap contributors, ODbL 1.0 (https://www.openstreetmap.org/copyright).
 * Origem: ${source.endpoint}, extração ${source.fetchedAt}, base OSM ${source.osmBase}. */
import type { GeoData } from './geoTypes.ts';
export const GEO: GeoData = ${JSON.stringify(data)};
`);
console.log(JSON.stringify(stats, null, 1));
