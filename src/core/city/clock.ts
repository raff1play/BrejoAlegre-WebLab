/**
 * Virtual clock: one game hour = 150 real seconds (user-approved 14/11/2026),
 * working day 11:45–21:00. The clock runs a full 24 h day (so night and morning exist) and
 * starts at 11:45; a development control may jump to any hour without changing the scale.
 */
export const REAL_SECONDS_PER_VIRTUAL_HOUR = 150;
export const WORKDAY_START = 11 + 45 / 60;
/** Couriers wait for two VIRTUAL minutes after the visible game starts. */
export const COURIER_DEPART_DELAY_VIRTUAL_MINUTES = 2;
export const COURIER_DEPART_HOUR = WORKDAY_START + COURIER_DEPART_DELAY_VIRTUAL_MINUTES / 60;
/** 21h: deadline after which work is LATE (decisions 14/17). It never ends the shift by itself. */
export const WORKDAY_END = 21;

export class VirtualClock {
  /**
   * B1-01 F5 (decisions 14/17, AC-15): minutes since midnight of the SHIFT's first day. It only
   * grows: crossing 00:00 does not restart anything; the visible hour wraps, the shift hour does not.
   */
  private total: number;
  /** Development fast-forward factor (1 = the approved scale). */
  speedFactor = 1;

  constructor(startHour = WORKDAY_START) {
    this.total = Math.max(0, startHour * 60);
  }

  private static wrap(m: number): number {
    return ((m % 1440) + 1440) % 1440;
  }

  advance(realSeconds: number): void {
    if (!(realSeconds > 0) || !Number.isFinite(realSeconds)) return;
    this.total += (realSeconds * 60 * this.speedFactor) / REAL_SECONDS_PER_VIRTUAL_HOUR;
  }

  /** Development only: jump to an hour (0–24) of the shift's first day. */
  setHour(hour: number): void {
    this.total = VirtualClock.wrap(hour * 60);
  }

  /** Development only: jump to a shift hour (may be ≥ 24 = after midnight, same shift). */
  setShiftHour(hour: number): void {
    if (Number.isFinite(hour) && hour >= 0 && hour < 72) this.total = hour * 60;
  }

  /** Visible time of day, [0, 24): lighting, traffic, the HUD clock. */
  get hour(): number { return VirtualClock.wrap(this.total) / 60; }

  /** Monotonic hour of the shift (25.5 = 01:30 after midnight, same shift): every work rule. */
  get shiftHour(): number { return this.total / 60; }

  /** Whole days crossed since the shift started (0 before midnight). */
  get daysCrossed(): number { return Math.floor(this.total / 1440); }

  get label(): string {
    const total = Math.floor(VirtualClock.wrap(this.total));
    return `${String(Math.floor(total / 60)).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}`;
  }

  /** Inside the planned working hours (21h is a deadline for lateness, not the end of work). */
  get isWorkday(): boolean { return this.shiftHour >= WORKDAY_START && this.shiftHour < WORKDAY_END; }
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
