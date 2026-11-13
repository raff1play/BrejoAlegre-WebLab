import type { Box2D } from '../../core/collision.ts';
import { CROSS_Z, CURB_H, FRONT, ROAD_HALF, SIDEWALK, SHOP, frameAxes, framePoint, frameRect, type Frame, type HouseSpec } from '../layout.ts';

/**
 * CORE-013 city plan: a PLAYABLE RE-READING inspired by Brejo Alegre/SP (IBGE 3507753), not a
 * map of it. Street names and landmarks with documented existence are used as homage, but their
 * positions here are invented (see docs/CITY_REFERENCE.md). Pure data, no renderer imports: the
 * same plan feeds the road builder, colliders, traffic, pedestrians and the minimap.
 *
 * Axes as in layout.ts: +x east, +z north, metres. The W009/CORE-010 core (junction at z = -20)
 * becomes the Centro; new streets form a 3×3 grid around it plus rural exits.
 */
export type NodeControl = 'signal' | 'stop' | 'free';
export type CityNode = Readonly<{ id: string; x: number; z: number; control: NodeControl; exit?: boolean }>;
export type RoadKind = 'urban' | 'rural' | 'yard';
export type CityRoad = Readonly<{
  id: string; name: string; a: string; b: string; kind: RoadKind;
  /** Higher wins at unsignalised junctions (preferential road). */
  priority: number;
  /** Heavy vehicles (truck, bus) may use it. */
  heavy: boolean;
}>;

export const CITY_BOUNDS: Box2D = { minX: -158, maxX: 158, minZ: -166, maxZ: 160 };
/** CORE-014 outer grid lines (west column, south and north rows). */
export const FAR_X = 146;
export const FAR_SOUTH_Z = -146;
export const FAR_NORTH_Z = 146;
export const GRID_X = 70;
export const NORTH_Z = 76;
export const SOUTH_Z = -86;
export const RING_X = 146;
/** Old core streets (W009) are drawn by temporaryWorld up to this distance from the axes. */
export const CORE_EXTENT = 63.8;

/** Exits sit far beyond the playable bounds (≥ 80 m) so traffic appears and vanishes out of reach, in the haze. */
export const EXIT_REACH = 226;

const node = (id: string, x: number, z: number, control: NodeControl, exit = false): CityNode => ({ id, x, z, control, exit });

export const NODES: readonly CityNode[] = [
  node('centro', 0, CROSS_Z, 'signal'),
  node('leste', GRID_X, CROSS_Z, 'signal'),
  node('sul', 0, SOUTH_Z, 'signal'),
  node('oeste', -GRID_X, CROSS_Z, 'stop'),
  node('norte', 0, NORTH_Z, 'stop'),
  node('ne', GRID_X, NORTH_Z, 'free'),
  node('no', -GRID_X, NORTH_Z, 'free'),
  node('so', -GRID_X, SOUTH_Z, 'free'),
  node('se', GRID_X, SOUTH_Z, 'stop'),
  node('base', RING_X, SOUTH_Z, 'free'),
  node('portao', 106, SOUTH_Z, 'stop'),
  node('docas', 106, -115, 'free'),
  node('anel', RING_X, CROSS_Z, 'stop'),
  // CORE-014 expansion: west column, south and north rows, north-east corner.
  node('oo', -FAR_X, CROSS_Z, 'stop'), node('ono', -FAR_X, NORTH_Z, 'free'), node('oso', -FAR_X, SOUTH_Z, 'stop'),
  node('sso', -FAR_X, FAR_SOUTH_Z, 'free'), node('ss1', -GRID_X, FAR_SOUTH_Z, 'stop'), node('ssul', 0, FAR_SOUTH_Z, 'stop'),
  node('sse', GRID_X, FAR_SOUTH_Z, 'free'),
  node('non', -FAR_X, FAR_NORTH_Z, 'free'), node('nno', -GRID_X, FAR_NORTH_Z, 'stop'), node('nn', 0, FAR_NORTH_Z, 'stop'),
  node('nne', GRID_X, FAR_NORTH_Z, 'stop'), node('ane', RING_X, NORTH_Z, 'stop'), node('nee', RING_X, FAR_NORTH_Z, 'free'),
  node('saida-norte', 0, EXIT_REACH, 'free', true),
  node('saida-sul', 0, -EXIT_REACH, 'free', true),
  node('saida-oeste', -EXIT_REACH, CROSS_Z, 'free', true),
];

const road = (id: string, name: string, a: string, b: string, kind: RoadKind, priority: number, heavy: boolean): CityRoad =>
  ({ id, name, a, b, kind, priority, heavy });

/** Edges always run from `a` to `b` west→east or south→north. Two-way, one lane each direction. */
export const ROADS: readonly CityRoad[] = [
  road('av-sul', 'Av. Pedro de Paula Castilho', 'sul', 'centro', 'urban', 3, true),
  road('av-centro', 'Av. Pedro de Paula Castilho', 'centro', 'norte', 'urban', 3, true),
  road('av-saida-sul', 'Estrada de acesso (sul)', 'saida-sul', 'ssul', 'rural', 3, true),
  road('av-sul2', 'Av. Pedro de Paula Castilho', 'ssul', 'sul', 'urban', 3, true),
  road('av-norte2', 'Av. Pedro de Paula Castilho', 'norte', 'nn', 'urban', 3, true),
  road('av-saida-norte', 'Estrada de acesso (norte)', 'nn', 'saida-norte', 'rural', 3, true),
  road('coroados-oeste', 'R. Coroados', 'oeste', 'centro', 'urban', 2, true),
  road('coroados-leste', 'R. Coroados', 'centro', 'leste', 'urban', 2, true),
  road('coroados-anel', 'R. Coroados', 'leste', 'anel', 'urban', 2, true),
  road('saida-oeste', 'Estrada rural (oeste)', 'saida-oeste', 'oo', 'rural', 2, false),
  road('coroados-far', 'R. Coroados', 'oo', 'oeste', 'urban', 2, false),
  road('sete-sul', 'R. 7 de Setembro', 'se', 'leste', 'urban', 1, true),
  road('sete-norte', 'R. 7 de Setembro', 'leste', 'ne', 'urban', 1, true),
  road('palmeiras-sul', 'R. das Palmeiras', 'so', 'oeste', 'urban', 1, false),
  road('palmeiras-norte', 'R. das Palmeiras', 'oeste', 'no', 'urban', 1, false),
  road('nove-oeste', 'R. 9 de Julho', 'no', 'norte', 'urban', 1, false),
  road('nove-leste', 'R. 9 de Julho', 'norte', 'ne', 'urban', 1, true),
  road('treze-oeste', 'R. 13 de Maio', 'so', 'sul', 'urban', 1, false),
  road('treze-centro', 'R. 13 de Maio', 'sul', 'se', 'urban', 2, true),
  road('treze-base', 'R. 13 de Maio', 'se', 'portao', 'urban', 2, true),
  road('treze-portao', 'R. 13 de Maio', 'portao', 'base', 'urban', 2, true),
  road('patio', 'Pátio do galpão', 'docas', 'portao', 'yard', 0, true),
  road('anel-base', 'Estrada da Base', 'base', 'anel', 'urban', 2, true),
  // CORE-014 (names "Rua 1–4" and the bairro are FICTIONAL; continuations keep the real names).
  road('treze-far', 'R. 13 de Maio', 'oso', 'so', 'urban', 1, false),
  road('nove-far', 'R. 9 de Julho', 'ono', 'no', 'urban', 1, false),
  road('rua1-s', 'Rua 1 (Jd. Tietê)', 'sso', 'oso', 'urban', 1, false),
  road('rua1-c', 'Rua 1 (Jd. Tietê)', 'oso', 'oo', 'urban', 1, false),
  road('rua1-n', 'Rua 1 (Jd. Tietê)', 'oo', 'ono', 'urban', 1, false),
  road('rua1-nn', 'Rua 1 (Jd. Tietê)', 'ono', 'non', 'urban', 1, false),
  road('rua2-o', 'Rua 2 (Jd. Tietê)', 'sso', 'ss1', 'urban', 1, false),
  road('rua2-c', 'Rua 2 (Jd. Tietê)', 'ss1', 'ssul', 'urban', 1, false),
  road('rua2-e', 'Rua 2 (Jd. Tietê)', 'ssul', 'sse', 'urban', 1, true),
  road('palm-sul2', 'R. das Palmeiras', 'ss1', 'so', 'urban', 1, false),
  road('sete-sul2', 'R. 7 de Setembro', 'sse', 'se', 'urban', 1, true),
  road('palm-norte2', 'R. das Palmeiras', 'no', 'nno', 'urban', 1, false),
  road('sete-norte2', 'R. 7 de Setembro', 'ne', 'nne', 'urban', 1, false),
  road('rua3-o', 'Rua 3 (Jd. Primavera)', 'non', 'nno', 'urban', 1, false),
  road('rua3-c', 'Rua 3 (Jd. Primavera)', 'nno', 'nn', 'urban', 1, false),
  road('rua3-e', 'Rua 3 (Jd. Primavera)', 'nn', 'nne', 'urban', 1, false),
  road('rua3-ee', 'Rua 3 (Jd. Primavera)', 'nne', 'nee', 'urban', 1, false),
  road('nove-ext', 'R. 9 de Julho', 'ne', 'ane', 'urban', 1, false),
  road('rua4-s', 'Rua 4 (Vila Nova)', 'anel', 'ane', 'urban', 1, false),
  road('rua4-n', 'Rua 4 (Vila Nova)', 'ane', 'nee', 'urban', 1, false),
];

export const nodeById = (id: string): CityNode => {
  const n = NODES.find((v) => v.id === id);
  if (!n) throw new Error(`nó ${id} inexistente`);
  return n;
};

/** Carriageway half-width (lanes 2 × 3.5 m plus gutter) and whether a road is drawn by the old core. */
export const LANE_OFFSET = 2.0;
export const roadAxis = (r: CityRoad): 'x' | 'z' => (nodeById(r.a).z === nodeById(r.b).z ? 'x' : 'z');

/** Urban blocks (lots level, solid unless listed in WALKABLE). Rects already exclude road + pavement. */
export type Block = Readonly<{ id: string; box: Box2D; sector: Sector }>;
export type Sector = 'centro' | 'residencial' | 'comercial' | 'logistico' | 'periferia';
const E = ROAD_HALF + SIDEWALK; // 6.2
export const BLOCKS: readonly Block[] = [
  { id: 'nordeste', box: { minX: E, maxX: GRID_X - E, minZ: CROSS_Z + E, maxZ: NORTH_Z - E }, sector: 'residencial' },
  { id: 'noroeste', box: { minX: -GRID_X + E, maxX: -E, minZ: CROSS_Z + E, maxZ: NORTH_Z - E }, sector: 'residencial' },
  { id: 'sudeste', box: { minX: E, maxX: GRID_X - E, minZ: SOUTH_Z + E, maxZ: CROSS_Z - E }, sector: 'comercial' },
  { id: 'sudoeste', box: { minX: -GRID_X + E, maxX: -E, minZ: SOUTH_Z + E, maxZ: CROSS_Z - E }, sector: 'centro' },
  { id: 'leste', box: { minX: GRID_X + E, maxX: RING_X - E, minZ: SOUTH_Z + E, maxZ: CROSS_Z - E }, sector: 'comercial' },
  // CORE-014: Jd. Tietê (west/south), Jd. Primavera (north), Vila Nova (north-east). Fictional bairros.
  ...([
    ['tiete-so', -FAR_X, -GRID_X, FAR_SOUTH_Z, SOUTH_Z], ['tiete-o', -FAR_X, -GRID_X, SOUTH_Z, CROSS_Z],
    ['tiete-no', -FAR_X, -GRID_X, CROSS_Z, NORTH_Z], ['primavera-o', -FAR_X, -GRID_X, NORTH_Z, FAR_NORTH_Z],
    ['tiete-s', -GRID_X, 0, FAR_SOUTH_Z, SOUTH_Z], ['tiete-se', 0, GRID_X, FAR_SOUTH_Z, SOUTH_Z],
    ['primavera-c', -GRID_X, 0, NORTH_Z, FAR_NORTH_Z], ['primavera-e', 0, GRID_X, NORTH_Z, FAR_NORTH_Z],
    ['vilanova-s', GRID_X, RING_X, CROSS_Z, NORTH_Z], ['vilanova-n', GRID_X, RING_X, NORTH_Z, FAR_NORTH_Z],
  ] as const).map(([id, x0, x1, z0, z1]): Block => ({ id, box: { minX: x0 + E, maxX: x1 - E, minZ: z0 + E, maxZ: z1 - E }, sector: 'residencial' })),
];

/** Logistics hub (south of R. 13 de Maio, east): building, yard, gate, docks. */
export const DEPOT = Object.freeze({
  lot: { minX: GRID_X + E, maxX: RING_X - E, minZ: -150, maxZ: SOUTH_Z - E } as Box2D,
  building: { minX: 92, maxX: 136, minZ: -142, maxZ: -118 } as Box2D,
  yard: { minX: GRID_X + E, maxX: RING_X - E, minZ: -118, maxZ: SOUTH_Z - E } as Box2D,
  gate: { x0: 100, x1: 112 },
  docks: [96, 104, 112, 120, 128] as readonly number[],
  motoBays: { x0: 79, x1: 89, z: -112 },
  height: 9,
  name: 'Galpão Logístico Brejo Alegre',
});

/** House lots of the expansion (reusing the W009 house builder and styles). */
export type CityLot = Readonly<{ id: string; frame: Frame; style: number }>;
const lot = (id: string, ox: number, oz: number, side: Frame['side'], style: number): CityLot => ({ id, frame: { ox, oz, side }, style });
const LOT_W = 12;
export const CITY_LOTS: readonly CityLot[] = [
  // Nordeste: R. 7 de Setembro (west side, facing east) and R. 9 de Julho (south side, facing north).
  lot('c-7set-1', GRID_X - E, 8, -1, 0), lot('c-7set-2', GRID_X - E, 20, -1, 3), lot('c-7set-3', GRID_X - E, 32, -1, 1),
  lot('c-7set-4', GRID_X - E, 44, -1, 4), lot('c-7set-5', GRID_X - E, 56, -1, 2),
  lot('c-9jul-1', 18.2, NORTH_Z - E, -2, 6), lot('c-9jul-2', 30.2, NORTH_Z - E, -2, 8),
  // Noroeste: R. das Palmeiras (east side, facing west) and R. 9 de Julho (south side).
  lot('c-palm-1', -GRID_X + E, 30, 1, 5), lot('c-palm-2', -GRID_X + E, 42, 1, 7), lot('c-palm-3', -GRID_X + E, 54, 1, 9),
  lot('c-palm-4', -GRID_X + E, 66, 1, 2),
  lot('c-9jul-3', -6.2, NORTH_Z - E, -2, 1), lot('c-9jul-4', -18.2, NORTH_Z - E, -2, 4), lot('c-9jul-5', -30.2, NORTH_Z - E, -2, 0),
  // Sudeste: avenue east side and R. 13 de Maio north side.
  lot('c-av-1', E, -52, 1, 3), lot('c-av-2', E, -64, 1, 6),
  // Sudoeste: R. 13 de Maio north side.
  lot('c-13mai-3', -62, SOUTH_Z + E, 2, 7), lot('c-13mai-4', -50, SOUTH_Z + E, 2, 8),
  // CORE-014: 20 more deliverable houses in the new bairros (rows along block edges).
  ...lotRow('tiete-r1', 'west', -FAR_X + E, NORTH_Z - E, 5, 0),
  ...lotRow('tiete-palm', 'east', -GRID_X - E, CROSS_Z + E, 5, 3),
  ...lotRow('prim-9jul', 'south', -GRID_X + E, NORTH_Z + E, 4, 6),
  ...lotRow('prim-r3', 'north', GRID_X - E, FAR_NORTH_Z - E, 4, 1),
  ...lotRow('vila-7set', 'west', GRID_X + E, NORTH_Z - E, 2, 8),
];

/**
 * A row of house lots along one block edge, starting 9 m in from the corner the edge begins at.
 * `edge` is the side of the block the street is on; houses face that street.
 */
function lotRow(prefix: string, edge: 'west' | 'east' | 'south' | 'north', ox: number, oz: number, count: number, style0: number): CityLot[] {
  const out: CityLot[] = [];
  for (let i = 0; i < count; i++) {
    const k = 9 + i * LOT_W;
    const style = (style0 + i * 3) % 10;
    if (edge === 'west') out.push(lot(`${prefix}-${i + 1}`, ox, oz - k, 1, style));
    else if (edge === 'east') out.push(lot(`${prefix}-${i + 1}`, ox, oz + k, -1, style));
    else if (edge === 'south') out.push(lot(`${prefix}-${i + 1}`, ox + k, oz, 2, style));
    else out.push(lot(`${prefix}-${i + 1}`, ox - k, oz, -2, style));
  }
  return out;
}

/** The eight shops / pickup points (CORE-013 central config). Names are fictional businesses. */
export type StoreKind = 'mercearia' | 'farmacia' | 'papelaria' | 'supermercado' | 'padaria' | 'variedades' | 'construcao' | 'hortifruti';
export type Store = Readonly<{
  id: StoreKind; name: string; subtitle: string;
  frame: Frame; width: number; depth: number; height: number;
  wall: string; band: string; sign: [string, string];
  /** Where a delivery vehicle or the player stops (on the kerb lane), and the pickup door. */
  stop: { x: number; z: number }; door: { x: number; z: number };
  sector: Sector;
}>;

function store(id: StoreKind, name: string, subtitle: string, frame: Frame, width: number, depth: number,
  colours: { wall: string; band: string; sign: [string, string] }, sector: Sector, height = 4.4): Store {
  const door = framePoint(frame, width / 2, -0.6);
  // Stop point: in the kerb-side lane in front of the door (pavement is 2.2 m, lane centre 2 m further).
  const stopPoint = framePoint(frame, width / 2, -SIDEWALK - LANE_OFFSET);
  return { id, name, subtitle, frame, width, depth, height, ...colours, stop: stopPoint, door, sector };
}

export const STORES: readonly Store[] = [
  // The W009 shop keeps its own builder; this entry only places it in the configuration.
  { ...store('mercearia', 'Mercearia do Bairro', 'Padaria · Bebidas · Hortifruti', SHOP.frame, SHOP.width, SHOP.depth,
    { wall: '#eadfc4', band: '#2f6688', sign: ['#f4c531', '#a3211c'] }, 'centro'), stop: { x: 2, z: -37 } },
  store('farmacia', 'Farmácia Popular', 'Medicamentos · Perfumaria', { ox: 28, oz: CROSS_Z + E, side: 2 }, 14, 14,
    { wall: '#eef3f0', band: '#1f8a5b', sign: ['#ffffff', '#1f8a5b'] }, 'comercial'),
  store('papelaria', 'Papelaria Central', 'Escolar · Xerox · Presentes', { ox: 44, oz: CROSS_Z + E, side: 2 }, 13, 14,
    { wall: '#f2ead9', band: '#2b5aa8', sign: ['#2b5aa8', '#f2c230'] }, 'comercial'),
  store('supermercado', 'Supermercado Boa Vista', 'Açougue · Frios · Mercearia', { ox: GRID_X - E - 2, oz: CROSS_Z - E, side: -2 }, 24, 20,
    { wall: '#f4efe4', band: '#c9302c', sign: ['#c9302c', '#ffffff'] }, 'comercial', 5.2),
  store('padaria', 'Padaria Pão Quente', 'Pães · Lanches · Café', { ox: 27, oz: SOUTH_Z + E, side: 2 }, 13, 14,
    { wall: '#f6e3c4', band: '#a4622e', sign: ['#7a3e1d', '#f6d27a'] }, 'comercial'),
  store('variedades', 'Casa & Lar Variedades', 'Utilidades · Presentes', { ox: 41, oz: SOUTH_Z + E, side: 2 }, 15, 14,
    { wall: '#f0e6f0', band: '#7a3f8f', sign: ['#ffffff', '#7a3f8f'] }, 'comercial'),
  store('construcao', 'Depósito Tietê', 'Material de Construção', { ox: 116, oz: CROSS_Z - E, side: -2 }, 30, 22,
    { wall: '#e9e3d6', band: '#d0761f', sign: ['#d0761f', '#ffffff'] }, 'comercial', 6),
  store('hortifruti', 'Hortifruti da Praça', 'Frutas · Verduras · Ovos', { ox: 42.2, oz: NORTH_Z - E, side: -2 }, 12, 14,
    { wall: '#eef0d9', band: '#4f8a2f', sign: ['#4f8a2f', '#fff7d6'] }, 'residencial'),
];

/** Civic and landmark buildings (homage, positions invented). */
export const CHURCH = Object.freeze({
  name: 'Igreja Sagrado Coração de Jesus', frame: { ox: -15, oz: -50.2, side: -2 } as Frame, width: 14, depth: 22,
});
export const SCHOOL = Object.freeze({
  name: 'E.E. Agostinho Grigoleto', frame: { ox: -63.8, oz: CROSS_Z + E, side: 2 } as Frame, width: 30, depth: 26,
});
export const SERVICES = Object.freeze({
  name: 'Centro de Serviços Municipais', frame: { ox: -GRID_X + E, oz: -28, side: 1 } as Frame, width: 22, depth: 18,
});

/** Bus line: a loop around the centre, stops on the right-hand pavement in the travel direction. */
export const BUS_LOOP: readonly string[] = ['sul', 'centro', 'norte', 'ne', 'leste', 'se', 'sul'];
export type BusStop = Readonly<{ id: string; x: number; z: number; road: string; shelter: { x: number; z: number; alongZ: boolean } }>;
export const BUS_STOPS: readonly BusStop[] = [
  { id: 'ponto-avenida', x: LANE_OFFSET, z: 30, road: 'av-centro', shelter: { x: ROAD_HALF + 0.9, z: 30, alongZ: true } },
  { id: 'ponto-9-julho', x: 34, z: NORTH_Z - LANE_OFFSET, road: 'nove-leste', shelter: { x: 34, z: NORTH_Z - ROAD_HALF - 0.9, alongZ: false } },
  { id: 'ponto-7-setembro', x: GRID_X - LANE_OFFSET, z: 4, road: 'sete-norte', shelter: { x: GRID_X - ROAD_HALF - 0.9, z: 4, alongZ: true } },
  { id: 'ponto-13-maio', x: 36, z: SOUTH_Z + LANE_OFFSET, road: 'treze-centro', shelter: { x: 36, z: SOUTH_Z + ROAD_HALF + 0.9, alongZ: false } },
];

/** Speed humps ("lombadas") near the school and the square. */
export const SPEED_HUMPS: readonly { x: number; z: number; alongX: boolean }[] = [
  { x: -46, z: CROSS_Z, alongX: false },
  { x: 0, z: -62, alongX: true },
];

/**
 * CORE-014 store floor plan in lot coordinates (lx along the frontage, lz into the lot): an open
 * shop floor behind a glass front with a central door, a counter, stock shelves at the back and a
 * customer queue. The W009 mercearia keeps its own building: it serves at its door.
 */
export type StoreLayout = Readonly<{
  floor: Box2D; walls: Box2D[]; counter: Box2D; shelves: Box2D[];
  door: { x: number; z: number }; pickup: { x: number; z: number }; employee: { x: number; z: number };
  stock: { x: number; z: number }; queue: { x: number; z: number }[]; facing: number;
}>;
export const STORE_SETBACK = 1.5;
export function storeLayout(s: Store): StoreLayout {
  const f = s.frame; const W = s.width; const D = s.depth; const t = 0.25;
  const P = (lx: number, lz: number) => framePoint(f, lx, lz);
  const R = (x0: number, x1: number, z0: number, z1: number) => frameRect(f, x0, x1, z0, z1);
  const yaw = Math.atan2(frameAxes(f.side).ix, frameAxes(f.side).iz); // facing into the shop
  if (s.id === 'mercearia') {
    const door = P(W / 2, -0.3);
    return { floor: R(0, 0, 0, 0), walls: [], counter: R(0, 0, 0, 0), shelves: [], door, pickup: P(W / 2, -1.2), employee: P(W / 2, 0.2), stock: P(W / 2 + 2, 0.2), queue: [P(W / 2 - 1.5, -1.6), P(W / 2 - 1.5, -2.6)], facing: yaw };
  }
  const cz = D * 0.52;
  const door0 = W / 2 - 1.3; const door1 = W / 2 + 1.3;
  return {
    floor: R(0, W, 0, D),
    walls: [
      R(0, t, STORE_SETBACK, D), R(W - t, W, STORE_SETBACK, D), R(0, W, D - t, D),
      R(0, door0, STORE_SETBACK, STORE_SETBACK + t), R(door1, W, STORE_SETBACK, STORE_SETBACK + t),
    ],
    counter: R(1.2, W - 3.2, cz - 0.35, cz + 0.35),
    shelves: [R(0.6, W - 0.6, D - 1.0, D - t), R(t, t + 0.6, cz + 1.2, D - 1.6)],
    door: P(W / 2, STORE_SETBACK - 0.6),
    pickup: P(W / 2 + 1.0, cz - 1.0),
    employee: P(W / 2 - 0.5, cz + 0.9),
    stock: P(W / 2 + 1.5, D - 1.6),
    queue: [P(W / 2 - 1.6, cz - 1.0), P(W / 2 - 1.6, cz - 2.0), P(W / 2 - 2.6, cz - 2.6), P(W / 2 - 3.4, cz - 3.2)],
    facing: yaw,
  };
}

/** CORE-014 depot: walls with a staff door (west) and dock doors (north), interior furniture. */
export function depotLayout(): { walls: Box2D[]; furniture: Box2D[]; floor: Box2D } {
  const b = DEPOT.building; const t = 0.3;
  const walls: Box2D[] = [
    { minX: b.minX, maxX: b.maxX, minZ: b.minZ, maxZ: b.minZ + t },
    { minX: b.maxX - t, maxX: b.maxX, minZ: b.minZ, maxZ: b.maxZ },
    // West wall with the staff door (z -123.4 … -121).
    { minX: b.minX, maxX: b.minX + t, minZ: b.minZ, maxZ: -123.4 }, { minX: b.minX, maxX: b.minX + t, minZ: -121, maxZ: b.maxZ },
  ];
  // North (yard) wall between the dock doors (each 3.2 m wide).
  let x = b.minX;
  for (const d of DEPOT.docks) { walls.push({ minX: x, maxX: d - 1.6, minZ: b.maxZ - t, maxZ: b.maxZ }); x = d + 1.6; }
  walls.push({ minX: x, maxX: b.maxX, minZ: b.maxZ - t, maxZ: b.maxZ });
  const furniture: Box2D[] = [
    { minX: 93.2, maxX: 94.4, minZ: -124.4, maxZ: -120.6 }, // receiving desk
    { minX: 93.2, maxX: 94.4, minZ: -133, maxZ: -129 },     // dispatch counter
    { minX: 105, maxX: 117, minZ: -130.4, maxZ: -128.6 },    // sorting conveyor / bench
    { minX: 100, maxX: 134, minZ: -141.6, maxZ: -140.2 },    // racks along the back wall
    { minX: 124, maxX: 134, minZ: -137, maxZ: -136.4 },      // office partition
    { minX: 100, maxX: 103, minZ: -126, maxZ: -124 },        // pallets
    { minX: 120, maxX: 123, minZ: -126, maxZ: -124 },
    { minX: 127, maxX: 129.5, minZ: -131, maxZ: -128.6 },    // roll cages
  ];
  return { walls, furniture, floor: b };
}

/** CORE-014 open spaces (fictional): dirt football pitch and a neighbourhood square. */
export const CAMPINHO: Box2D = { minX: -58, maxX: -12, minZ: -134, maxZ: SOUTH_Z - E };
export const PRACA_PRIMAVERA: Box2D = { minX: -FAR_X + E, maxX: -100, minZ: NORTH_Z + E, maxZ: 122 };

/** Areas inside blocks that stay walkable (the rest of each block is solid behind its frontage). */
function shopForecourt(): Box2D {
  return SHOP.lot;
}
export function walkableAreas(): Box2D[] {
  const open: Box2D[] = [
    shopForecourt(),
    // W009 square in front of the church.
    { minX: -34, maxX: -E, minZ: -50, maxZ: CROSS_Z - E },
    // Open front yard of casa-leste-3 (W009 open-front house).
    frameRect({ ox: FRONT, oz: -13.8 + 3 * 12, side: 1 }, 0, 12, 0, 20),
    // Customer car park beside the supermarket (between it and the W009 shop lot).
    frameRect(STORES[3]!.frame, 24, 31.8, 0, 14),
    // CORE-014: neighbourhood football pitch (campinho) open to R. 13 de Maio, and Praça Primavera.
    CAMPINHO,
    PRACA_PRIMAVERA,
    // CORE-014: shop floors (except the W009 mercearia) and the depot interior are walkable.
    ...STORES.filter((st) => st.id !== 'mercearia').map((st) => storeLayout(st).floor),
  ];
  return open;
}

/** Inclusive rectangle subtraction: `box` minus every hole, as a list of non-overlapping boxes. */
export function subtractBoxes(box: Box2D, holes: readonly Box2D[]): Box2D[] {
  let pieces: Box2D[] = [box];
  for (const h of holes) {
    const next: Box2D[] = [];
    for (const p of pieces) {
      if (h.maxX <= p.minX || h.minX >= p.maxX || h.maxZ <= p.minZ || h.minZ >= p.maxZ) { next.push(p); continue; }
      const ix0 = Math.max(p.minX, h.minX); const ix1 = Math.min(p.maxX, h.maxX);
      if (h.minX > p.minX) next.push({ ...p, maxX: h.minX });
      if (h.maxX < p.maxX) next.push({ ...p, minX: h.maxX });
      if (h.minZ > p.minZ) next.push({ minX: ix0, maxX: ix1, minZ: p.minZ, maxZ: h.minZ });
      if (h.maxZ < p.maxZ) next.push({ minX: ix0, maxX: ix1, minZ: h.maxZ, maxZ: p.maxZ });
    }
    pieces = next;
  }
  return pieces.filter((p) => p.maxX - p.minX > 1e-6 && p.maxZ - p.minZ > 1e-6);
}

/** Solid fill of every urban block except its walkable areas, plus the depot building and fences. */
export function cityColliders(): Box2D[] {
  const open = walkableAreas();
  const solid = BLOCKS.flatMap((b) => subtractBoxes(b.box, open));
  const d = DEPOT;
  const fence = 0.15;
  for (const st of STORES) {
    if (st.id === 'mercearia') continue;
    const L = storeLayout(st);
    solid.push(...L.walls, L.counter, ...L.shelves);
  }
  const dl = depotLayout();
  solid.push(...dl.walls, ...dl.furniture);
  solid.push(
    // Yard fence along R. 13 de Maio with the gate opening, and the side fences.
    { minX: d.lot.minX, maxX: d.gate.x0, minZ: d.lot.maxZ - fence, maxZ: d.lot.maxZ },
    { minX: d.gate.x1, maxX: d.lot.maxX, minZ: d.lot.maxZ - fence, maxZ: d.lot.maxZ },
    { minX: d.lot.minX, maxX: d.lot.minX + fence, minZ: d.building.minZ, maxZ: d.lot.maxZ },
    { minX: d.lot.maxX - fence, maxX: d.lot.maxX, minZ: d.building.minZ, maxZ: d.lot.maxZ },
    { minX: d.lot.minX, maxX: d.building.minX, minZ: d.building.minZ - fence, maxZ: d.building.minZ },
    { minX: d.building.maxX, maxX: d.lot.maxX, minZ: d.building.minZ - fence, maxZ: d.building.minZ },
  );
  for (const s of BUS_STOPS) {
    const [hx, hz] = s.shelter.alongZ ? [0.45, 1.6] : [1.6, 0.45];
    solid.push({ minX: s.shelter.x - hx, maxX: s.shelter.x + hx, minZ: s.shelter.z - hz, maxZ: s.shelter.z + hz });
  }
  return solid;
}

/** Raised (kerb-height) areas of the expansion: blocks and new urban pavements. */
export function cityRaised(): { box: Box2D; height: number }[] {
  const areas: Box2D[] = BLOCKS.map((b) => b.box);
  for (const r of ROADS) {
    if (r.kind !== 'urban') continue;
    for (const strip of pavementStrips(r)) areas.push(strip);
  }
  areas.push(DEPOT.lot);
  return areas.map((box) => ({ box, height: CURB_H }));
}

/** Axis-aligned extent [lo, hi] of a road along its axis and its constant cross coordinate. */
export function roadSpan(r: CityRoad): { axis: 'x' | 'z'; lo: number; hi: number; c: number } {
  const a = nodeById(r.a); const b = nodeById(r.b);
  return roadAxis(r) === 'x' ? { axis: 'x', lo: a.x, hi: b.x, c: a.z } : { axis: 'z', lo: a.z, hi: b.z, c: a.x };
}

/** Distance from a node centre to where its junction box ends (no pavement inside the junction). */
export const JUNCTION_HALF = E;

/** The two pavement strips along a road, trimmed at junctions. */
export function pavementStrips(r: CityRoad): Box2D[] {
  const s = roadSpan(r);
  const a = nodeById(r.a); const b = nodeById(r.b);
  const lo = s.lo + (a.exit ? 0 : JUNCTION_HALF);
  const hi = s.hi - (b.exit ? 0 : JUNCTION_HALF);
  const strips: Box2D[] = [];
  for (const sign of [-1, 1]) {
    const c0 = s.c + sign * ROAD_HALF; const c1 = s.c + sign * E;
    const [p, q] = [Math.min(c0, c1), Math.max(c0, c1)];
    strips.push(s.axis === 'x' ? { minX: lo, maxX: hi, minZ: p, maxZ: q } : { minX: p, maxX: q, minZ: lo, maxZ: hi });
  }
  return strips;
}

/** Points of interest for the minimap and future pickup logic. */
export type Poi = Readonly<{ id: string; label: string; kind: 'loja' | 'galpao' | 'igreja' | 'escola' | 'servicos' | 'onibus' | 'praca'; x: number; z: number }>;
export function pointsOfInterest(): Poi[] {
  const pois: Poi[] = STORES.map((s) => ({ id: s.id, label: s.name, kind: 'loja' as const, x: s.door.x, z: s.door.z }));
  pois.push({ id: 'galpao', label: DEPOT.name, kind: 'galpao', x: (DEPOT.gate.x0 + DEPOT.gate.x1) / 2, z: DEPOT.yard.maxZ - 6 });
  const church = framePoint(CHURCH.frame, CHURCH.width / 2, 0);
  pois.push({ id: 'igreja', label: CHURCH.name, kind: 'igreja', x: church.x, z: church.z });
  const school = framePoint(SCHOOL.frame, SCHOOL.width / 2, 0);
  pois.push({ id: 'escola', label: SCHOOL.name, kind: 'escola', x: school.x, z: school.z });
  const services = framePoint(SERVICES.frame, SERVICES.width / 2, 0);
  pois.push({ id: 'servicos', label: SERVICES.name, kind: 'servicos', x: services.x, z: services.z });
  pois.push({ id: 'praca', label: 'Praça', kind: 'praca', x: -20, z: -38 });
  for (const b of BUS_STOPS) pois.push({ id: b.id, label: 'Ponto de ônibus', kind: 'onibus', x: b.shelter.x, z: b.shelter.z });
  return pois;
}

/** Re-export so other city modules need one import for house styles. */
export type CityHouse = HouseSpec;

/**
 * Navigable area in m² (CORE-014 target: at least twice the CORE-013 town): union of carriageways
 * (rural roads only inside the playable bounds), pavements, walkable areas and the depot yard,
 * rasterised at `cell` metres so overlaps at junctions count once.
 */
export function navigableArea(cell = 1): number {
  const boxes: Box2D[] = [...walkableAreas(), DEPOT.yard, DEPOT.building];
  for (const r of ROADS) {
    const s = roadSpan(r);
    const lo = Math.max(s.lo, s.axis === 'x' ? CITY_BOUNDS.minX : CITY_BOUNDS.minZ);
    const hi = Math.min(s.hi, s.axis === 'x' ? CITY_BOUNDS.maxX : CITY_BOUNDS.maxZ);
    const half = r.kind === 'urban' ? E : ROAD_HALF;
    const ext = r.kind === 'yard' ? 0 : ROAD_HALF;
    boxes.push(s.axis === 'x'
      ? { minX: lo - ext, maxX: hi + ext, minZ: s.c - half, maxZ: s.c + half }
      : { minX: s.c - half, maxX: s.c + half, minZ: lo - ext, maxZ: hi + ext });
  }
  let count = 0;
  for (let x = CITY_BOUNDS.minX + cell / 2; x < CITY_BOUNDS.maxX; x += cell) {
    for (let z = CITY_BOUNDS.minZ + cell / 2; z < CITY_BOUNDS.maxZ; z += cell) {
      if (boxes.some((b) => x >= b.minX && x <= b.maxX && z >= b.minZ && z <= b.maxZ)) count++;
    }
  }
  return count * cell * cell;
}
