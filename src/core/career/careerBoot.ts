import { buildRoster, careerHome, type Home, type Roster } from './careers.ts';
import { CareerSession, CareerStore, type KeyValueStorage } from './careerStore.ts';
import { SaveError, type CareerSave } from './snapshot.ts';

/**
 * B1-01 F1: inicialização do jogo a partir da carreira ativa. Pura (sem DOM) para ser testável.
 * Mantém o comportamento legado: sem nenhum save novo, a carreira ativa é Oeste e o dia vem do
 * índice antigo `brejo-log003-workday-index`, que é migrado (gravado no save novo) sem ser apagado.
 */
export type CareerBoot = Readonly<{
  session: CareerSession;
  roster: Roster;
  home: Home;
  calendarIndex: number;
  /** Mensagens para diagnóstico (ex.: save principal rejeitado e cópia anterior usada). */
  notes: readonly string[];
}>;

export function bootCareer(storage: KeyValueStorage): CareerBoot {
  const store = new CareerStore(storage);
  const session = new CareerSession(store);
  const notes: string[] = [];
  if (session.loadProblem) notes.push(session.loadProblem);
  if (session.loadSource === 'legado') {
    // Persiste a migração não destrutiva do calendário legado (que continua no armazenamento).
    try { session.commit(session.careerId, (p, s) => ({ profile: p, shift: s })); notes.push('Calendário legado migrado para a carreira Oeste'); }
    catch (e) { notes.push(`Migração legada não gravada: ${(e as Error).message}`); }
  }
  return Object.freeze({
    session, roster: buildRoster(session.careerId), home: careerHome(session.careerId),
    calendarIndex: session.profile.calendarIndex, notes: Object.freeze(notes),
  });
}

/** Checkpoint do avanço de dia (após expediente encerrado). Só toca a carreira ativa. */
export function commitNextDay(session: CareerSession, nextIndex: number): CareerSave {
  if (!Number.isSafeInteger(nextIndex) || nextIndex < 0 || nextIndex > 36500) throw new SaveError('Dia de calendário inválido');
  if (nextIndex <= session.profile.calendarIndex) throw new SaveError('O calendário da carreira não retrocede');
  // Decisões 9/14/17: o dia só avança com o expediente encerrado; 00h não encerra nada.
  const open = session.profile.activeShiftId ?? session.save.shift?.shiftId ?? null;
  if (open !== null) throw new SaveError(`Expediente ${open} aberto: o calendário só avança após encerrá-lo`);
  return session.commit(session.careerId, (p) => ({ profile: { ...p, calendarIndex: nextIndex }, shift: null }));
}
