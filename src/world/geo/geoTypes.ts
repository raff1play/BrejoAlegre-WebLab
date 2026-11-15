/** CORE-015 shapes of the OpenStreetMap-derived data (metres in the local tangent plane). */
export type XZ = [number, number];
export type GeoStreet = { id: number; name: string | null; highway: string; oneway: boolean; surface: string | null; lanes: number | null; width: number | null; nodes: (number | null)[]; pts: XZ[] };
export type GeoPolygon = { id: number; kind: string; name: string | null; pts: XZ[]; levels?: number | null };
export type GeoPoi = { id: number; osm: string; name: string | null; kind: string; x: number; z: number; tags: Record<string, string> };
export type GeoData = {
  source: { endpoint: string; fetchedAt: string; osmBase: string | null; bbox: { south: number; west: number; north: number; east: number }; license: string; place: unknown };
  projection: { kind: string; origin: { lat: number; lon: number }; R: number; units: string };
  stats: Record<string, number>;
  streets: GeoStreet[]; walkways: GeoStreet[]; buildings: GeoPolygon[]; areas: GeoPolygon[]; water: { id: number; kind: string; pts: XZ[] }[];
  pois: GeoPoi[]; intersections: number[];
};
