#!/usr/bin/env node
/**
 * CORE-015: downloads the OpenStreetMap data of Brejo Alegre/SP (IBGE 3507753) from the public
 * Overpass API into data/osm/brejo-alegre.raw.json, with a provenance record.
 * Data © OpenStreetMap contributors, ODbL 1.0 (https://www.openstreetmap.org/copyright).
 * Usage: node scripts/geo/fetch-osm.mjs [south west north east]
 */
import { writeFileSync, mkdirSync } from 'node:fs';

const ENDPOINTS = [
  'https://overpass-api.de/api/interpreter', 'https://overpass.private.coffee/api/interpreter',
  'https://maps.mail.ru/osm/tools/overpass/api/interpreter', 'https://overpass.kumi.systems/api/interpreter',
];
const UA = { 'User-Agent': 'BrejoAlegre-WebLab/0.1 (single-player game prototype; github.com/raff1play/BrejoAlegre-WebLab)' };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
async function overpass(q) {
  let last = null;
  for (let round = 0; round < 3; round++) {
    for (const url of ENDPOINTS) {
      try {
        const res = await fetch(url, { method: 'POST', body: new URLSearchParams({ data: q }), headers: UA, signal: AbortSignal.timeout(120000) });
        if (!res.ok) throw new Error(`${url}: HTTP ${res.status}`);
        return { url, json: await res.json() };
      } catch (err) { last = err; console.error(String(err)); }
    }
    await sleep(15000 * (round + 1));
  }
  throw last;
}

/** Locator without Overpass: Nominatim (one request, per its usage policy). */
async function nominatim() {
  const res = await fetch('https://nominatim.openstreetmap.org/search?q=Brejo+Alegre,+S%C3%A3o+Paulo,+Brasil&format=jsonv2&limit=5', { headers: UA });
  if (!res.ok) throw new Error(`nominatim HTTP ${res.status}`);
  const list = await res.json();
  const hit = list.find((r) => Number(r.lat) < -19 && Number(r.lat) > -26 && Number(r.lon) < -44 && Number(r.lon) > -54);
  if (!hit) throw new Error('nominatim: sem resultado em SP');
  return { type: hit.osm_type, id: hit.osm_id, tags: { name: hit.name, display_name: hit.display_name }, lat: Number(hit.lat), lon: Number(hit.lon) };
}

// 1) Locate the town (place node named Brejo Alegre inside São Paulo state, IBGE 3507753).
let box = process.argv.slice(2).map(Number);
let place = null;
if (box.length !== 4) {
  // Light query (no area filter): every place node named Brejo Alegre; keep the one in SP.
  try {
    const { json } = await overpass(`[out:json][timeout:60];node["place"]["name"="Brejo Alegre"];out tags;`);
    place = json.elements.find((el) => el.lat < -19 && el.lat > -26 && el.lon < -44 && el.lon > -54) ?? null;
  } catch (err) { console.error('overpass (localizar) falhou:', String(err)); }
  if (!place) place = await nominatim();
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

mkdirSync('data/osm', { recursive: true });
let url; let json;
try {
  ({ url, json } = await overpass(query));
} catch (err) {
  // Fallback: the official OSM editing API returns the raw map of a small box (≤ 0.25 deg²).
  console.error('overpass (recorte) falhou, usando api.openstreetmap.org:', String(err));
  url = `https://api.openstreetmap.org/api/0.6/map.json?bbox=${w},${s},${e},${n}`;
  const res = await fetch(url, { headers: UA });
  if (!res.ok) throw new Error(`OSM API HTTP ${res.status}`);
  json = await res.json();
}
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
