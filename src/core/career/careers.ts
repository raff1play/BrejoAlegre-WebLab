import { CITY_LOTS, type CityLot } from '../../world/city/cityPlan.ts';
import { SIDEWALK, framePoint } from '../../world/layout.ts';
import { ACTORS, type ActorId } from '../delivery/dailyDemand.ts';
import { SECTORS, sectorOf, type Sector } from '../delivery/sectors.ts';

/**
 * B1-01 F1 (contrato C1): identidade PERSISTENTE de personagem/carreira, separada do PAPEL
 * temporário que ele ocupa na simulação (`ActorId`: jogador, npc1, npc2, npc3).
 *
 * - Quatro personagens predefinidos, exatamente um por setor, cada um com casa fixa (decisões 1–2).
 * - Nomes, cores e o catálogo de equipamentos são PROVISÓRIOS (fora do escopo congelado); os IDs não.
 * - Nenhum quinto personagem: `buildRoster` mapeia um e somente um personagem para `jogador`.
 */
export const CAREER_IDS = ['personagem-norte', 'personagem-oeste', 'personagem-leste', 'personagem-sul'] as const;
export type CareerId = (typeof CAREER_IDS)[number];
/** Carreira jogada pelo save legado (LOG-003/004): o jogador sempre foi o setor Oeste. */
export const DEFAULT_CAREER: CareerId = 'personagem-oeste';

export const HOME_IDS = ['casa-norte', 'casa-oeste', 'casa-leste', 'casa-sul'] as const;
export type HomeId = (typeof HOME_IDS)[number];

/** Aparência: somente presets predefinidos masculino/feminino (sem editor facial/corporal). */
export const APPEARANCE_PRESETS = ['masculino', 'feminino'] as const;
export type AppearancePreset = (typeof APPEARANCE_PRESETS)[number];

/**
 * Equipamentos predefinidos. Catálogo PROVISÓRIO de engenharia (o catálogo final não foi decidido);
 * B1-02 liga estes IDs aos itens físicos da casa. Trocar rótulos não muda IDs salvos.
 */
export const EQUIPMENT_PRESETS = [
  { id: 'kit-jaqueta', label: 'Capacete fechado e jaqueta' },
  { id: 'kit-refletivo', label: 'Capacete fechado e colete refletivo' },
] as const;
export type EquipmentPresetId = (typeof EQUIPMENT_PRESETS)[number]['id'];

/** Veículo inicial próprio e quitado (decisões 5–6). A física do carro é F2; aqui só a identidade. */
export const VEHICLE_KINDS = ['moto-antiga', 'carro-antigo'] as const;
export type VehicleKind = (typeof VEHICLE_KINDS)[number];

export type CharacterDefinition = Readonly<{
  careerId: CareerId;
  /** Nome provisório de exibição; não é usado como chave. */
  name: string;
  provisionalName: true;
  sector: Sector;
  homeId: HomeId;
  defaultAppearance: AppearancePreset;
  defaultEquipment: EquipmentPresetId;
}>;

/** Os três NPCs existentes (Rosa/Caio/Davi) mantêm nome e setor; Oeste recebe nome provisório. */
export const CHARACTERS: Readonly<Record<CareerId, CharacterDefinition>> = Object.freeze({
  'personagem-norte': { careerId: 'personagem-norte', name: 'Rosa', provisionalName: true, sector: 'Norte', homeId: 'casa-norte', defaultAppearance: 'feminino', defaultEquipment: 'kit-jaqueta' },
  'personagem-oeste': { careerId: 'personagem-oeste', name: 'Lia', provisionalName: true, sector: 'Oeste', homeId: 'casa-oeste', defaultAppearance: 'feminino', defaultEquipment: 'kit-jaqueta' },
  'personagem-leste': { careerId: 'personagem-leste', name: 'Caio', provisionalName: true, sector: 'Leste', homeId: 'casa-leste', defaultAppearance: 'masculino', defaultEquipment: 'kit-jaqueta' },
  'personagem-sul': { careerId: 'personagem-sul', name: 'Davi', provisionalName: true, sector: 'Sul', homeId: 'casa-sul', defaultAppearance: 'masculino', defaultEquipment: 'kit-jaqueta' },
});

/**
 * Lotes residenciais reais (GEO_LOTS uso 'casa') reservados como casa fixa de cada personagem:
 * fora dos 48 endereços de entrega, no interior do próprio setor e perto dos seus destinos.
 * Interiores e a rotina das 11h30 ficam para o B1-02; aqui existem ID, lote e âncora navegável.
 */
export const HOME_LOTS: Readonly<Record<HomeId, string>> = Object.freeze({
  'casa-norte': 'q44-l696',
  'casa-oeste': 'q29-l490',
  'casa-leste': 'q43-l681',
  'casa-sul': 'q36-l568',
});

export type Home = Readonly<{
  id: HomeId;
  careerId: CareerId;
  sector: Sector;
  lot: string;
  street: string;
  /** Porta na calçada (a pé). */
  door: { x: number; z: number };
  /** Ponto de parada no leito da rua (veículo). */
  stop: { x: number; z: number };
}>;

const homes = new Map<HomeId, Home>();
export function homeOf(id: HomeId): Home {
  const cached = homes.get(id);
  if (cached) return cached;
  const lot: CityLot | undefined = CITY_LOTS.find((l) => l.id === HOME_LOTS[id]);
  if (!lot || !lot.street) throw new Error(`Casa ${id}: lote ${HOME_LOTS[id]} inexistente no mapa`);
  const careerId = CAREER_IDS.find((c) => CHARACTERS[c].homeId === id)!;
  const home: Home = Object.freeze({
    id, careerId, sector: CHARACTERS[careerId].sector, lot: lot.id, street: lot.street,
    door: framePoint(lot.frame, lot.width / 2, -0.9),
    stop: framePoint(lot.frame, lot.width / 2, -SIDEWALK - 1.3),
  });
  if (sectorOf(home.door) !== home.sector) throw new Error(`Casa ${id} fora do setor ${home.sector}`);
  homes.set(id, home);
  return home;
}
export const careerHome = (careerId: CareerId): Home => homeOf(CHARACTERS[careerId].homeId);
export const careerOfSector = (sector: Sector): CareerId => CAREER_IDS.find((c) => CHARACTERS[c].sector === sector)!;

export function isCareerId(v: unknown): v is CareerId {
  return typeof v === 'string' && (CAREER_IDS as readonly string[]).includes(v);
}

/**
 * Papel de cada personagem NESTE expediente. Sempre os quatro personagens, cada um em um único
 * papel; o ativo é `jogador`. A ordem fixa dos NPCs preserva o legado quando Oeste é jogado:
 * npc1=Norte (Rosa), npc2=Leste (Caio), npc3=Sul (Davi), mesmas vagas COURIER_BAYS.
 */
export type Roster = Readonly<Record<ActorId, CareerId>>;
const NPC_ORDER: readonly Sector[] = ['Norte', 'Leste', 'Sul', 'Oeste'];
export function buildRoster(active: CareerId): Roster {
  if (!isCareerId(active)) throw new Error(`Carreira inválida: ${String(active)}`);
  const npcs = NPC_ORDER.map(careerOfSector).filter((c) => c !== active);
  return Object.freeze({ jogador: active, npc1: npcs[0]!, npc2: npcs[1]!, npc3: npcs[2]! });
}
export function actorOfCareer(roster: Roster, careerId: CareerId): ActorId {
  return ACTORS.find((a) => roster[a] === careerId)!;
}
export const actorSector = (roster: Roster, actor: ActorId): Sector => CHARACTERS[roster[actor]].sector;

/** Invariantes do roster: quatro papéis, quatro personagens distintos, quatro setores distintos. */
export function assertRoster(roster: Roster): void {
  const ids = ACTORS.map((a) => roster[a]);
  if (!ids.every(isCareerId) || new Set(ids).size !== 4) throw new Error('Roster deve ter os quatro personagens, sem repetição');
  if (new Set(ids.map((c) => CHARACTERS[c].sector)).size !== SECTORS.length) throw new Error('Roster deve cobrir os quatro setores');
}
