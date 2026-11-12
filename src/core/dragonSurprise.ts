/** Opt-in visual experiment. No gameplay physics, collisions or save state. */
export const DRAGON_SPEED_KMH = 45;
export const DRAGON_DURATION = 11.5;
export const DRAGON_MESSAGE = 'Marcos Pato';

export type DragonPhase = 'approach' | 'fire' | 'rocket' | 'message' | 'finished';

export function dragonEnabled(search: string): boolean {
  return new URLSearchParams(search).get('dragon') === '1';
}

/** Actual forward speed (m/s), not speedometer text or absolute reverse speed. */
export function dragonCanStart(speedMps: number, isRiding: boolean): boolean {
  return isRiding && Number.isFinite(speedMps) && speedMps * 3.6 >= DRAGON_SPEED_KMH;
}

export function dragonPhase(seconds: number): DragonPhase {
  if (seconds < 2.2) return 'approach';
  if (seconds < 4.1) return 'fire';
  if (seconds < 5.3) return 'rocket';
  if (seconds < DRAGON_DURATION) return 'message';
  return 'finished';
}
