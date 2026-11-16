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
/**
 * B1-01 F6: highest checkpoint ever confirmed in this browser, per career INCARNATION (lineage).
 * Kept when a career is deleted, so an older backup of the same incarnation can never be restored
 * over progress (and paid events) that were already confirmed here.
 */
export const marksKey = (id: CareerId): string => `brejo-b1:marcas:${id}`;
/**
 * B1-01 F6: set when the Oeste career is deleted on purpose, so the legacy calendar index (kept for
 * older builds, never deleted) is not migrated back into a "new" Oeste career.
 */
export const LEGACY_DISMISSED_KEY = 'brejo-b1:legado-descartado';

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

  /**
   * B1-01 F6: parsed saves by their exact stored text. A checkpoint is a few hundred kB; the same
   * bytes are never validated twice (any change in the text is a cache miss and is re-validated).
   */
  private readonly parsed = new Map<string, { text: string; save: CareerSave }>();
  private parseKey(key: string, careerId: CareerId): CareerSave {
    const raw = this.storage.getItem(key);
    if (raw === null) throw new SaveError('ausente');
    const hit = this.parsed.get(key);
    if (hit && hit.text === raw && hit.save.careerId === careerId) return hit.save;
    let data: unknown;
    try { data = JSON.parse(raw); } catch { throw new SaveError('JSON inválido'); }
    const save = parseSave(data, careerId);
    this.parsed.set(key, { text: raw, save });
    return save;
  }

  /**
   * B1-01 F6: lineage → highest confirmed checkpoint. Absent key = none known yet. A key that
   * exists but cannot be read is NOT "none known" (that would let an old backup in): it throws.
   */
  marks(careerId: CareerId): Readonly<Record<string, number>> {
    const raw = this.storage.getItem(marksKey(careerId));
    if (raw === null) return {};
    let o: unknown;
    try { o = JSON.parse(raw); } catch { throw new SaveError(`Marcas anti-reversão de ${CHARACTERS[careerId].name} ilegíveis`); }
    if (typeof o !== 'object' || o === null || Array.isArray(o) || !Object.values(o as Record<string, unknown>).every((v) => Number.isSafeInteger(v) && (v as number) >= 0)) throw new SaveError(`Marcas anti-reversão de ${CHARACTERS[careerId].name} ilegíveis`);
    return o as Record<string, number>;
  }
  /**
   * F6 audit fix (comment 6916312263, block 1): the anti-rollback mark of `save` is written — and
   * read back — BEFORE the save is confirmed. Any failure (quota, unreadable marks, read-back
   * mismatch) is a failed checkpoint: nothing claims a protected save that is not protected.
   * Returns how to undo the mark if the save write itself then fails (best effort: a mark left
   * higher only makes restores MORE conservative, never less).
   */
  private persistMark(save: CareerSave): () => void {
    const id = save.careerId; const lineage = save.profile.lineageId;
    const m = { ...this.marks(id) };
    if ((m[lineage] ?? -1) >= save.checkpointSequence) return () => {};
    const before = this.storage.getItem(marksKey(id));
    m[lineage] = save.checkpointSequence;
    try { this.storage.setItem(marksKey(id), canonicalJson(m)); }
    catch (e) { throw new SaveError(`Falha ao gravar a marca anti-reversão de ${CHARACTERS[id].name}: ${(e as Error).message} — checkpoint NÃO gravado`); }
    if ((this.marks(id)[lineage] ?? -1) < save.checkpointSequence) throw new SaveError(`Marca anti-reversão de ${CHARACTERS[id].name} não confirmada — checkpoint NÃO gravado`);
    return () => { try { if (before === null) this.storage.removeItem(marksKey(id)); else this.storage.setItem(marksKey(id), before); } catch { /* stays higher: conservative */ } };
  }
  /** Highest checkpoint of `lineage` known here: marks AND the saves still present. */
  private protectedFloor(careerId: CareerId, lineage: string): number {
    let floor = this.marks(careerId)[lineage] ?? -1;
    for (const k of [saveKey(careerId), previousKey(careerId)]) {
      try { const s = this.parseKey(k, careerId); if (s.profile.lineageId === lineage) floor = Math.max(floor, s.checkpointSequence); } catch { /* absent/unreadable */ }
    }
    return floor;
  }
  /**
   * F6 audit fix (block 2): the open shift of ANY career (decision 8: only one career works at a
   * time). While it exists no save of any character may be imported or deleted.
   */
  openShift(): { careerId: CareerId; shiftId: string } | null {
    for (const id of CAREER_IDS) {
      const r = this.read(id);
      if (r.persisted && r.save.profile.activeShiftId !== null) return { careerId: id, shiftId: r.save.profile.activeShiftId };
    }
    return null;
  }
  private refuseDuringShift(what: string): void {
    const open = this.openShift();
    if (open) throw new SaveError(`Expediente ${open.shiftId} de ${CHARACTERS[open.careerId].name} aberto: ${what} só depois de encerrá-lo em casa`);
  }
  legacyDismissed(): boolean { return this.storage.getItem(LEGACY_DISMISSED_KEY) === '1'; }

  /** Lê o save de UMA carreira. Não grava nada (nem ao migrar o legado ou criar um perfil novo). */
  read(careerId: CareerId): LoadResult {
    if (!isCareerId(careerId)) throw new SaveError(`Carreira inválida: ${String(careerId)}`);
    let problem: string | null = null;
    try { return { save: this.parseKey(saveKey(careerId), careerId), source: 'principal', problem, persisted: true }; }
    catch (e) { if (this.storage.getItem(saveKey(careerId)) !== null) problem = `Save principal rejeitado: ${(e as Error).message}`; }
    try { return { save: this.parseKey(previousKey(careerId), careerId), source: 'anterior', problem, persisted: true }; }
    catch (e) {
      // F3.5.1 (auditoria 6903966725): a previous copy that exists but cannot be read is DATA, not
      // an empty slot. It is reported (never ignored, never deleted) so nobody starts over it.
      if (this.storage.getItem(previousKey(careerId)) !== null) {
        const why = `Cópia anterior rejeitada: ${(e as Error).message}`;
        problem = problem ? `${problem} · ${why}` : why;
      }
    }
    // Unreadable data and no valid copy: a fresh profile is returned ONLY as a placeholder, flagged
    // with the problem (callers must refuse to write it: menu, enterCareer). The legacy calendar is
    // not used to "migrate" over unreadable data either.
    if (problem !== null) {
      return { save: sealSave({ careerId, checkpointSequence: 0, profile: defaultProfile(careerId), shift: null }), source: 'novo', problem, persisted: false };
    }
    const legacy = careerId === DEFAULT_CAREER && !this.legacyDismissed() ? readLegacyCalendar(this.storage) : null;
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
   * exige EXATAMENTE o checkpoint seguinte ao gravado: nem retrocesso, nem salto (um salto permitiria
   * a um conteúdo antigo "vencer" um mais novo só por ter número maior). Preserva a cópia íntegra
   * atual em `…:anterior`.
   */
  write(save: CareerSave): CareerSave { return this.writeChecked(save, false); }

  private writeChecked(save: CareerSave, importing: boolean): CareerSave {
    const valid = parseSave(JSON.parse(canonicalJson(save)));
    const id = valid.careerId;
    const stored = this.storedSequence(id);
    // An imported backup keeps its own (higher) checkpoint number: that is its place in its lineage.
    if (importing ? valid.checkpointSequence <= stored : valid.checkpointSequence !== stored + 1) throw new SaveError(`Checkpoint ${valid.checkpointSequence} fora da sequência: o gravado é ${stored}, esperado ${stored + 1} (sessão desatualizada?)`);
    const text = canonicalJson(valid);
    const oldPrevious = this.storage.getItem(previousKey(id));
    let promoted = false;
    // Block 1: the anti-rollback mark first; if it cannot be made durable, nothing is written.
    const undoMark = this.persistMark(valid);
    try {
      const current = this.storage.getItem(saveKey(id));
      if (current !== null) {
        let intact = true;
        try { this.parseKey(saveKey(id), id); } catch { intact = false; }
        // Só promove a "anterior" uma cópia íntegra: um principal corrompido nunca apaga o backup bom.
        if (intact) { this.storage.setItem(previousKey(id), current); promoted = true; }
      }
      this.storage.setItem(saveKey(id), text);
    } catch (e) {
      // F3.5 (auditoria): se o principal não foi gravado, a cópia anterior volta a ser a de antes.
      if (promoted) {
        try { if (oldPrevious === null) this.storage.removeItem(previousKey(id)); else this.storage.setItem(previousKey(id), oldPrevious); } catch { /* best effort */ }
      }
      undoMark();
      throw new SaveError(`Falha ao gravar o save de ${id}: ${(e as Error).message}`);
    }
    this.parsed.set(saveKey(id), { text, save: valid });
    return valid;
  }

  /**
   * Próximo checkpoint de UMA carreira. `baseSequence` é o checkpoint em que os dados do chamador se
   * basearam (-1 = nada gravado). Se o armazenamento já avançou (outra aba, backup restaurado), a
   * escrita é recusada como sessão desatualizada: nunca há mescla silenciosa nem "último vence".
   */
  commit(careerId: CareerId, profile: CareerProfile, shift: ShiftSnapshot | null, baseSequence: number): CareerSave {
    const stored = this.storedSequence(careerId);
    if (baseSequence !== stored) throw new SaveError(`Sessão desatualizada: baseada no checkpoint ${baseSequence}, mas o gravado é ${stored}. Recarregue a carreira.`);
    return this.write(sealSave({ careerId, checkpointSequence: stored + 1, profile, shift }));
  }

  /** Checkpoint persistido atual de uma carreira (-1 se nenhum): base para a próxima escrita. */
  baseSequence(careerId: CareerId): number { return this.storedSequence(careerId); }

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

  /**
   * B1-01 F6 — backup policy (decision 12; engineering policy, auditable):
   * - a backup is the career's own canonical save (format, schema version, career, lineage,
   *   checkpoint, checksum), exported only between shifts: never with an open shift;
   * - importing validates EVERYTHING before writing (JSON, checksum, schema/migration, career);
   * - refused: a backup with an open shift, over an open shift, of an incarnation already seen
   *   at a HIGHER checkpoint in this browser (it would undo confirmed operations and pay again),
   *   or over a different incarnation without explicit `replace`;
   * - the current save is kept as the previous copy (`…:anterior`) by the write itself.
   */
  exportBackup(careerId: CareerId): string {
    // Read-only: exporting a CLOSED career stays possible while another one works (nothing changes).
    const r = this.read(careerId);
    if (!r.persisted) throw new SaveError(`${CHARACTERS[careerId].name} não tem save gravado para exportar`);
    if (r.save.profile.activeShiftId !== null) throw new SaveError('Backup só entre expedientes: termine o expediente aberto antes de exportar');
    return canonicalJson(r.save);
  }

  /** What an import would do, without writing (shown to the player before confirming). */
  previewBackup(text: string, expected?: CareerId): BackupPreview {
    let data: unknown;
    try { data = JSON.parse(text); } catch { throw new SaveError('Backup não é JSON válido'); }
    const backup = parseSave(data, expected);
    const id = backup.careerId;
    this.refuseDuringShift('importar backups');
    if (backup.profile.activeShiftId !== null || backup.shift !== null) throw new SaveError('Backup com expediente aberto não é aceito: exporte entre expedientes');
    const current = this.read(id);
    if (current.persisted && current.save.profile.activeShiftId !== null) throw new SaveError('Não restaurar backup sobre expediente aberto');
    const seen = this.protectedFloor(id, backup.profile.lineageId);
    if (backup.checkpointSequence < seen) throw new SaveError(`Backup desatualizado: esta carreira já chegou ao checkpoint ${seen} neste navegador (o backup é do ${backup.checkpointSequence}); restaurá-lo desfaria operações e pagamentos já confirmados`);
    const sameLineage = current.persisted && current.save.profile.lineageId === backup.profile.lineageId;
    if (sameLineage && backup.checkpointSequence <= current.save.checkpointSequence) throw new SaveError(backup.checkpointSequence === current.save.checkpointSequence ? 'Este backup já é o save atual (mesmo checkpoint): nada a restaurar' : `Backup desatualizado: o save atual está no checkpoint ${current.save.checkpointSequence}`);
    return Object.freeze({ save: backup, replaces: current.persisted && !sameLineage ? current.save : null, unreadable: !current.persisted && current.problem !== null });
  }

  /**
   * Restores a backup (see `previewBackup` for every refusal). `replace` must be true to put it
   * over a DIFFERENT incarnation of the same character (explicit confirmation by the player).
   */
  importBackup(text: string, expected?: CareerId, options: { replace?: boolean } = {}): CareerSave {
    const preview = this.previewBackup(text, expected);
    if (preview.replaces && !options.replace) throw new SaveError(`Já existe outra carreira de ${CHARACTERS[preview.save.careerId].name} neste navegador: confirme a substituição (exporte-a antes)`);
    if (preview.unreadable && !options.replace) throw new SaveError(`O save atual de ${CHARACTERS[preview.save.careerId].name} está ilegível: confirme a substituição`);
    const b = preview.save;
    const stored = this.storedSequence(b.careerId);
    return this.writeChecked(sealSave({ careerId: b.careerId, checkpointSequence: Math.max(stored + 1, b.checkpointSequence), profile: b.profile, shift: null }), true);
  }

  /**
   * B1-01 F6: deletes ONE career (main save and previous copy) after explicit confirmation by the
   * character's name. Refused with an open shift. Unreadable data can be deleted (that is how a
   * corrupted slot is freed). Oeste: the legacy calendar key is KEPT (older builds), but marked as
   * dismissed so it does not come back as this career. Other careers are never touched.
   */
  deleteCareer(careerId: CareerId, confirmName: string): void {
    if (!isCareerId(careerId)) throw new SaveError(`Carreira inválida: ${String(careerId)}`);
    const name = CHARACTERS[careerId].name;
    if (confirmName !== name) throw new SaveError(`Confirmação inválida: digite ${name} para apagar`);
    const r = this.read(careerId);
    if (r.persisted && r.save.profile.activeShiftId !== null) throw new SaveError(`Expediente ${r.save.profile.activeShiftId} aberto: termine-o antes de apagar a carreira`);
    this.refuseDuringShift('apagar carreiras');
    const keys = [previousKey(careerId), saveKey(careerId)];
    // Block 1: before anything is removed, the marks must durably cover every readable copy
    // (a save written before marks existed, or whose mark was lost, is protected now or not deleted).
    for (const k of keys) {
      let copy: CareerSave | null = null;
      try { copy = this.parseKey(k, careerId); } catch { /* absent/unreadable: nothing to protect */ }
      if (copy) {
        try { this.persistMark(copy); }
        catch (e) { throw new SaveError(`Carreira de ${name} NÃO apagada: ${(e as Error).message.replace(/ — checkpoint NÃO gravado$/, '')}`); }
      }
    }
    const before = keys.map((k) => this.storage.getItem(k));
    try {
      if (careerId === DEFAULT_CAREER && readLegacyCalendar(this.storage) !== null) this.storage.setItem(LEGACY_DISMISSED_KEY, '1');
      for (const k of keys) this.storage.removeItem(k);
    } catch (e) {
      // All or nothing: put back what was removed.
      keys.forEach((k, i) => { try { if (before[i] !== null) this.storage.setItem(k, before[i]!); } catch { /* best effort */ } });
      throw new SaveError(`Falha ao apagar a carreira de ${name}: ${(e as Error).message}`);
    }
    for (const k of keys) this.parsed.delete(k);
  }
}

export type BackupPreview = Readonly<{ save: CareerSave; replaces: CareerSave | null; unreadable: boolean }>;

/**
 * Sessão da carreira ATIVA. É o único caminho de escrita do jogo: as três carreiras que atuam
 * como NPCs são somente leitura (cópias congeladas), então trabalhar como NPC jamais grava
 * dinheiro, experiência, calendário ou progresso nos saves inativos (decisão 3 / AC-16).
 *
 * Política de múltiplas abas/sessões da mesma carreira: cada sessão lembra o checkpoint em que se
 * baseia. A primeira a gravar vence; qualquer outra sessão que ainda esteja no checkpoint antigo
 * tem TODA escrita recusada (`SaveError` "Sessão desatualizada") até chamar `reload()`, que
 * descarta o estado em memória dela e relê o mais novo. Não há mescla automática.
 */
export class CareerSession {
  readonly careerId: CareerId;
  private current: CareerSave;
  readonly loadSource: LoadSource;
  readonly loadProblem: string | null;
  private readonly store: CareerStore;
  /** Checkpoint persistido em que `current` se baseia (-1 = ainda nada gravado). */
  private base: number;

  constructor(store: CareerStore, careerId: CareerId = store.activeCareer()) {
    this.store = store;
    if (!isCareerId(careerId)) throw new SaveError(`Carreira inválida: ${String(careerId)}`);
    this.careerId = careerId;
    const r = store.read(careerId);
    this.current = r.save; this.loadSource = r.source; this.loadProblem = r.problem;
    this.base = r.persisted ? r.save.checkpointSequence : -1;
  }

  /** Relê o save mais novo do armazenamento (após ser recusada como desatualizada). */
  reload(): CareerSave {
    const r = this.store.read(this.careerId);
    this.current = r.save; this.base = r.persisted ? r.save.checkpointSequence : -1;
    return this.current;
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
    this.current = this.store.commit(this.careerId, next.profile, next.shift, this.base);
    this.base = this.current.checkpointSequence;
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
