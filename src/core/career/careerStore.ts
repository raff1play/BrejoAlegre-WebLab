import { CALENDAR_STORAGE_KEY } from '../delivery/operatingCalendar.ts';
import { CAREER_IDS, CHARACTERS, DEFAULT_CAREER, isCareerId, type CareerId } from './careers.ts';
import {
  SaveError, canonicalJson, defaultProfile, deepFreeze, parseSave, sealSave,
  type CareerProfile, type CareerSave, type ShiftSnapshot,
} from './snapshot.ts';

/**
 * B1-01 F1: armazenamento local de saves, UMA chave por carreira (isolamento físico dos quatro
 * perfis). Usa a interface síncrona do `localStorage` (cada `setItem` é atômico); a troca por
 * IndexedDB continua possível atrás desta interface, sujeita à revisão técnica.
 *
 * Garantias:
 * - uma carreira nunca é gravada sob a chave de outra (o ID vem do próprio save validado);
 * - antes de substituir um save íntegro, a cópia anterior é preservada em `…:anterior`;
 * - um save corrompido/versão inválida é rejeitado ANTES de qualquer escrita;
 * - `checkpointSequence` nunca retrocede;
 * - o calendário legado é migrado sem ser apagado e continua espelhado para a carreira Oeste.
 */
export interface KeyValueStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

/** Armazenamento em memória: testes e fallback quando o navegador bloqueia `localStorage`. */
export class MemoryStorage implements KeyValueStorage {
  private readonly data = new Map<string, string>();
  getItem(key: string): string | null { return this.data.get(key) ?? null; }
  setItem(key: string, value: string): void { this.data.set(key, String(value)); }
  removeItem(key: string): void { this.data.delete(key); }
  keys(): string[] { return [...this.data.keys()].sort(); }
}

export const STORAGE_PREFIX = 'brejo-b1:carreira:';
export const ACTIVE_CAREER_KEY = 'brejo-b1:carreira-ativa';
export const saveKey = (id: CareerId): string => `${STORAGE_PREFIX}${id}`;
export const previousKey = (id: CareerId): string => `${saveKey(id)}:anterior`;

export type LoadSource = 'principal' | 'anterior' | 'legado' | 'novo';
export type LoadResult = Readonly<{ save: CareerSave; source: LoadSource; problem: string | null; persisted: boolean }>;

const readLegacyCalendar = (storage: KeyValueStorage): number | null => {
  const raw = storage.getItem(CALENDAR_STORAGE_KEY);
  if (raw === null) return null;
  const n = Number(raw);
  return Number.isSafeInteger(n) && n >= 0 && n <= 36500 ? n : null;
};

export class CareerStore {
  readonly storage: KeyValueStorage;
  constructor(storage: KeyValueStorage) { this.storage = storage; }

  private parseKey(key: string, careerId: CareerId): CareerSave {
    const raw = this.storage.getItem(key);
    if (raw === null) throw new SaveError('ausente');
    let data: unknown;
    try { data = JSON.parse(raw); } catch { throw new SaveError('JSON inválido'); }
    return parseSave(data, careerId);
  }

  /** Lê o save de UMA carreira. Não grava nada (nem ao migrar o legado ou criar um perfil novo). */
  read(careerId: CareerId): LoadResult {
    if (!isCareerId(careerId)) throw new SaveError(`Carreira inválida: ${String(careerId)}`);
    let problem: string | null = null;
    try { return { save: this.parseKey(saveKey(careerId), careerId), source: 'principal', problem, persisted: true }; }
    catch (e) { if (this.storage.getItem(saveKey(careerId)) !== null) problem = `Save principal rejeitado: ${(e as Error).message}`; }
    try { return { save: this.parseKey(previousKey(careerId), careerId), source: 'anterior', problem, persisted: true }; }
    catch { /* sem cópia anterior válida */ }
    const legacy = careerId === DEFAULT_CAREER ? readLegacyCalendar(this.storage) : null;
    const save = sealSave({ careerId, checkpointSequence: 0, profile: defaultProfile(careerId, legacy ?? 0), shift: null });
    return { save, source: legacy === null ? 'novo' : 'legado', problem, persisted: false };
  }

  readAll(): Readonly<Record<CareerId, LoadResult>> {
    return Object.freeze(Object.fromEntries(CAREER_IDS.map((id) => [id, this.read(id)])) as Record<CareerId, LoadResult>);
  }

  /** Sequência do último save PERSISTIDO e íntegro (principal ou anterior); -1 se nenhum. */
  private storedSequence(careerId: CareerId): number {
    const r = this.read(careerId);
    return r.persisted ? r.save.checkpointSequence : -1;
  }

  /**
   * Grava um save já selado. Revalida tudo (inclusive checksum) antes de tocar no armazenamento e
   * recusa retrocesso de sequência. Preserva a cópia íntegra atual em `…:anterior`.
   */
  write(save: CareerSave): CareerSave {
    const valid = parseSave(JSON.parse(JSON.stringify(save)));
    const id = valid.careerId;
    const stored = this.storedSequence(id);
    if (valid.checkpointSequence <= stored) throw new SaveError(`Checkpoint ${valid.checkpointSequence} não é mais novo que o gravado (${stored})`);
    const text = canonicalJson(valid);
    try {
      const current = this.storage.getItem(saveKey(id));
      if (current !== null) {
        let intact = true;
        try { parseSave(JSON.parse(current), id); } catch { intact = false; }
        // Só promove a "anterior" uma cópia íntegra: um principal corrompido nunca apaga o backup bom.
        if (intact) this.storage.setItem(previousKey(id), current);
      }
      this.storage.setItem(saveKey(id), text);
    } catch (e) {
      throw new SaveError(`Falha ao gravar o save de ${id}: ${(e as Error).message}`);
    }
    return valid;
  }

  /** Próximo checkpoint de UMA carreira, a partir do último gravado. */
  commit(careerId: CareerId, profile: CareerProfile, shift: ShiftSnapshot | null): CareerSave {
    const next = Math.max(0, this.storedSequence(careerId) + 1);
    return this.write(sealSave({ careerId, checkpointSequence: next, profile, shift }));
  }

  activeCareer(): CareerId {
    const v = this.storage.getItem(ACTIVE_CAREER_KEY);
    return isCareerId(v) ? v : DEFAULT_CAREER;
  }

  /**
   * Troca a carreira ativa. Bloqueada enquanto a carreira atual tiver expediente aberto
   * (decisão 8 / AC-17). A conclusão válida do expediente é responsabilidade das etapas F5/F6.
   */
  setActiveCareer(next: CareerId): void {
    if (!isCareerId(next)) throw new SaveError(`Carreira inválida: ${String(next)}`);
    const current = this.activeCareer();
    if (next === current) return;
    const open = this.read(current).save.profile.activeShiftId;
    if (open !== null) throw new SaveError(`Expediente ${open} aberto: troca de carreira só após finalizar o expediente`);
    this.storage.setItem(ACTIVE_CAREER_KEY, next);
  }

  /** Backup exportável de UMA carreira: o próprio save canônico, com versão e checksum. */
  exportBackup(careerId: CareerId): string {
    return canonicalJson(this.read(careerId).save);
  }

  /**
   * Restaura um backup. Toda a validação ocorre antes de qualquer escrita: JSON inválido, checksum
   * errado, versão desconhecida ou carreira diferente da esperada são rejeitados sem tocar no save
   * íntegro. O conteúdo restaurado entra como checkpoint NOVO (a sequência não retrocede).
   * Política de conflito/ledger de pagamentos entre backup e save atual: F6 (pendência registrada).
   */
  importBackup(text: string, expected?: CareerId): CareerSave {
    let data: unknown;
    try { data = JSON.parse(text); } catch { throw new SaveError('Backup não é JSON válido'); }
    const backup = parseSave(data, expected);
    const id = backup.careerId;
    if (id === this.activeCareer() && this.read(id).save.profile.activeShiftId !== null) throw new SaveError('Não restaurar backup sobre expediente aberto');
    return this.commit(id, backup.profile, backup.shift);
  }
}

/**
 * Sessão da carreira ATIVA. É o único caminho de escrita do jogo: as três carreiras que atuam
 * como NPCs são somente leitura (cópias congeladas), então trabalhar como NPC jamais grava
 * dinheiro, experiência, calendário ou progresso nos saves inativos (decisão 3 / AC-16).
 */
export class CareerSession {
  readonly careerId: CareerId;
  private current: CareerSave;
  readonly loadSource: LoadSource;
  readonly loadProblem: string | null;
  private readonly store: CareerStore;

  constructor(store: CareerStore, careerId: CareerId = store.activeCareer()) {
    this.store = store;
    if (!isCareerId(careerId)) throw new SaveError(`Carreira inválida: ${String(careerId)}`);
    this.careerId = careerId;
    const r = store.read(careerId);
    this.current = r.save; this.loadSource = r.source; this.loadProblem = r.problem;
  }

  get save(): CareerSave { return this.current; }
  get profile(): CareerProfile { return this.current.profile; }
  get character() { return CHARACTERS[this.careerId]; }

  /** Leitura de outra carreira (ex.: nome/aparência do NPC). Somente leitura, sem escrita possível. */
  peek(careerId: CareerId): CareerProfile {
    return deepFreeze(JSON.parse(JSON.stringify(this.store.read(careerId).save.profile)) as CareerProfile);
  }

  /** Grava um checkpoint da carreira ativa. `careerId` explícito impede escrita cruzada por engano. */
  commit(careerId: CareerId, update: (profile: CareerProfile, shift: ShiftSnapshot | null) => { profile: CareerProfile; shift: ShiftSnapshot | null }): CareerSave {
    if (careerId !== this.careerId) throw new SaveError(`Escrita recusada: ${careerId} não é a carreira ativa (${this.careerId})`);
    const next = update(this.current.profile, this.current.shift);
    if (next.profile.careerId !== this.careerId || (next.shift && next.shift.careerId !== this.careerId)) throw new SaveError('Escrita recusada: dados de outra carreira');
    this.current = this.store.commit(this.careerId, next.profile, next.shift);
    // Compatibilidade/rollback: builds anteriores leem só o índice legado, que pertence à carreira Oeste.
    if (this.careerId === DEFAULT_CAREER) {
      try { this.store.storage.setItem(CALENDAR_STORAGE_KEY, String(this.current.profile.calendarIndex)); } catch { /* espelho opcional */ }
    }
    return this.current;
  }
}

/** `localStorage` quando disponível; caso contrário memória (o jogo continua, sem persistência). */
export function browserStorage(): { storage: KeyValueStorage; durable: boolean } {
  try {
    const ls = globalThis.localStorage;
    const probe = `${STORAGE_PREFIX}__teste__`;
    ls.setItem(probe, '1'); ls.removeItem(probe);
    return { storage: ls, durable: true };
  } catch {
    return { storage: new MemoryStorage(), durable: false };
  }
}
