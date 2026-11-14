/**
 * Virtual clock: one game hour = 150 real seconds (user-approved 14/11/2026),
 * working day 11:00–21:00. The clock runs a full 24 h day (so night and morning exist) and
 * starts at 11:00; a development control may jump to any hour without changing the scale.
 */
export const REAL_SECONDS_PER_VIRTUAL_HOUR = 150;
export const WORKDAY_START = 11;
export const WORKDAY_END = 21;

export class VirtualClock {
  /** Minutes since midnight, [0, 1440). */
  private minutes: number;
  /** Development fast-forward factor (1 = the approved scale). */
  speedFactor = 1;

  constructor(startHour = WORKDAY_START) {
    this.minutes = VirtualClock.wrap(startHour * 60);
  }

  private static wrap(m: number): number {
    return ((m % 1440) + 1440) % 1440;
  }

  advance(realSeconds: number): void {
    if (!(realSeconds > 0) || !Number.isFinite(realSeconds)) return;
    this.minutes = VirtualClock.wrap(this.minutes + (realSeconds * 60 * this.speedFactor) / REAL_SECONDS_PER_VIRTUAL_HOUR);
  }

  /** Development only: jump to an hour (0–24). */
  setHour(hour: number): void {
    this.minutes = VirtualClock.wrap(hour * 60);
  }

  get hour(): number { return this.minutes / 60; }

  get label(): string {
    const total = Math.floor(this.minutes);
    return `${String(Math.floor(total / 60)).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}`;
  }

  get isWorkday(): boolean { return this.hour >= WORKDAY_START && this.hour < WORKDAY_END; }
}

/** City activity (0–1) by hour for pedestrians, general traffic and logistics. */
export function activityAt(hour: number): { people: number; traffic: number; logistics: number; commerceOpen: boolean } {
  const h = ((hour % 24) + 24) % 24;
  const bump = (centre: number, width: number) => Math.exp(-(((h - centre) / width) ** 2));
  const night = h < 5.5 || h >= 22.5;
  const people = night ? 0.12 : Math.min(1, 0.25 + 0.55 * bump(10.5, 3) + 0.6 * bump(17.5, 2.5) + (h >= 8 && h < 19 ? 0.2 : 0));
  const traffic = night ? 0.15 : Math.min(1, 0.3 + 0.7 * bump(7.5, 1.5) + 0.4 * bump(12.5, 2) + 0.7 * bump(18, 1.8));
  const logistics = h >= WORKDAY_START && h < WORKDAY_END ? 1 : h >= 7 && h < 22 ? 0.3 : 0;
  return { people, traffic, logistics, commerceOpen: h >= 8 && h < 20 };
}
