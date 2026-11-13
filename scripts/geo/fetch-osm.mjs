#!/usr/bin/env node
/**
 * CORE-015: downloads the OpenStreetMap data of Brejo Alegre/SP (IBGE 3507753) from the public
 * Overpass API into data/osm/brejo-alegre.raw.json, with a provenance record.
 * Data © OpenStreetMap contributors, ODbL 1.0 (https://www.openstreetmap.org/copyright).
 * Usage: node scripts/geo/fetch-osm.mjs [south west north east]
 */
import { writeFileSync, mkdirSync } from 'node:fs';

const ENDPOINTS = ['https://overpass-api.de/api/interpreter', 'https://overpass.kumi.systems/api/interpreter'];
// Default box: the urban seat and its approaches (generous; trimmed later by the importer).
const [s, w, n, e] = process.argv.slice(2).map(Number).length === 4 ? process.argv.slice(2).map(Number) : [-21.185, -50.205, -21.150, -50.160];
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

let lastError = null;
for (const url of ENDPOINTS) {
  try {
    const res = await fetch(url, { method: 'POST', body: new URLSearchParams({ data: query }), headers: { 'User-Agent': 'BrejoAlegre-WebLab/0.1 (game prototype)' } });
    if (!res.ok) throw new Error(`${url}: HTTP ${res.status}`);
    const json = await res.json();
    mkdirSync('data/osm', { recursive: true });
    writeFileSync('data/osm/brejo-alegre.raw.json', JSON.stringify(json));
    const meta = {
      source: 'OpenStreetMap via Overpass API', endpoint: url, fetchedAt: new Date().toISOString(),
      osmBase: json.osm3s?.timestamp_osm_base ?? null, bbox: { south: s, west: w, north: n, east: e },
      license: 'ODbL 1.0 — © OpenStreetMap contributors — https://www.openstreetmap.org/copyright',
      elements: json.elements?.length ?? 0, query,
    };
    writeFileSync('data/osm/SOURCE.json', JSON.stringify(meta, null, 2) + '\n');
    console.log(`ok ${meta.elements} elementos de ${url} (base OSM ${meta.osmBase})`);
    process.exit(0);
  } catch (err) { lastError = err; console.error(String(err)); }
}
console.error('falhou:', lastError);
process.exit(1);
