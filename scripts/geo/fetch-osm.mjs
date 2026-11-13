#!/usr/bin/env node
/**
 * CORE-015: downloads the OpenStreetMap data of Brejo Alegre/SP (IBGE 3507753) from the public
 * Overpass API into data/osm/brejo-alegre.raw.json, with a provenance record.
 * Data © OpenStreetMap contributors, ODbL 1.0 (https://www.openstreetmap.org/copyright).
 * Usage: node scripts/geo/fetch-osm.mjs [south west north east]
 */
import { writeFileSync, mkdirSync } from 'node:fs';

const ENDPOINTS = ['https://overpass-api.de/api/interpreter', 'https://overpass.kumi.systems/api/interpreter'];
async function overpass(q) {
  let last = null;
  for (const url of ENDPOINTS) {
    try {
      const res = await fetch(url, { method: 'POST', body: new URLSearchParams({ data: q }), headers: { 'User-Agent': 'BrejoAlegre-WebLab/0.1 (game prototype)' } });
      if (!res.ok) throw new Error(`${url}: HTTP ${res.status}`);
      return { url, json: await res.json() };
    } catch (err) { last = err; console.error(String(err)); }
  }
  throw last;
}

// 1) Locate the town (place node named Brejo Alegre inside São Paulo state, IBGE 3507753).
let box = process.argv.slice(2).map(Number);
let place = null;
if (box.length !== 4) {
  const { json } = await overpass(`[out:json][timeout:60];
area["ISO3166-2"="BR-SP"]->.sp;
( node["place"]["name"="Brejo Alegre"](area.sp);
  relation["boundary"="administrative"]["name"="Brejo Alegre"](area.sp); );
out center tags;`);
  place = json.elements.find((el) => el.type === 'node') ?? json.elements[0];
  if (!place) throw new Error('Brejo Alegre não encontrado no OSM');
  const lat = place.lat ?? place.center.lat; const lon = place.lon ?? place.center.lon;
  // ±0.02° ≈ ±2.2 km north–south and ±2.1 km east–west: the urban seat plus its approaches.
  box = [lat - 0.02, lon - 0.022, lat + 0.02, lon + 0.022];
  console.log('lugar', place.type, place.id, place.tags, lat, lon);
}
const [s, w, n, e] = box;
const query = `[out:json][timeout:120];
(
  way["highway"](${s},${w},${n},${e});
  way["building"](${s},${w},${n},${e});
  relation["building"](${s},${w},${n},${e});
  way["landuse"](${s},${w},${n},${e});
  way["leisure"](${s},${w},${n},${e});
  way["amenity"](${s},${w},${n},${e});
  node["amenity"](${s},${w},${n},${e});
  node["shop"](${s},${w},${n},${e});
  way["shop"](${s},${w},${n},${e});
  node["place"](${s},${w},${n},${e});
  node["leisure"](${s},${w},${n},${e});
  node["tourism"](${s},${w},${n},${e});
  node["office"](${s},${w},${n},${e});
  way["natural"="water"](${s},${w},${n},${e});
  way["waterway"](${s},${w},${n},${e});
  relation["boundary"="administrative"]["name"="Brejo Alegre"];
);
out body geom;`;

const { url, json } = await overpass(query);
mkdirSync('data/osm', { recursive: true });
writeFileSync('data/osm/brejo-alegre.raw.json', JSON.stringify(json));
const count = (pred) => json.elements.filter(pred).length;
const meta = {
  source: 'OpenStreetMap via Overpass API', endpoint: url, fetchedAt: new Date().toISOString(),
  osmBase: json.osm3s?.timestamp_osm_base ?? null, place: place ? { type: place.type, id: place.id, tags: place.tags } : null,
  bbox: { south: s, west: w, north: n, east: e },
  license: 'ODbL 1.0 — © OpenStreetMap contributors — https://www.openstreetmap.org/copyright',
  counts: {
    elements: json.elements.length,
    highways: count((el) => el.type === 'way' && el.tags?.highway),
    namedHighways: count((el) => el.type === 'way' && el.tags?.highway && el.tags?.name),
    buildings: count((el) => el.tags?.building),
    pois: count((el) => el.type === 'node' && (el.tags?.amenity || el.tags?.shop || el.tags?.leisure)),
  },
  query,
};
writeFileSync('data/osm/SOURCE.json', JSON.stringify(meta, null, 2) + '\n');
console.log(JSON.stringify(meta.counts));
