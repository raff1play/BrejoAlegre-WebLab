import type { KeyValueStorage } from './careerStore.ts';

/**
 * B1-01 F6 (F1 re-audit: real concurrency between two tabs): ONE game tab writes the saves of this
 * browser at a time. The browser module (`features/career/tabLock.ts`) uses the Web Locks API — an
 * exclusive lock held for the tab's whole life and released by the browser when the tab closes or
 * crashes. Where Web Locks do not exist, this storage LEASE is the fallback: the owner renews it
 * every `LEASE_RENEW_MS`; a lease not renewed for `LEASE_MS` is free (closed/crashed tab).
 * The checkpoint sequence check (`CareerStore.commit`) stays as a second, independent defence.
 */
export const GAME_LOCK_NAME = 'brejo-b1:jogo';
export const LEASE_KEY = 'brejo-b1:aba-ativa';
export const LEASE_MS = 8000;
export const LEASE_RENEW_MS = 2000;

export type Lease = Readonly<{ owner: string; until: number }>;

export function parseLease(raw: string | null): Lease | null {
  if (raw === null) return null;
  try {
    const o = JSON.parse(raw) as unknown;
    if (typeof o === 'object' && o !== null && typeof (o as Lease).owner === 'string' && Number.isFinite((o as Lease).until)) return { owner: (o as Lease).owner, until: (o as Lease).until };
  } catch { /* unreadable lease = free */ }
  return null;
}
export const leaseFree = (lease: Lease | null, me: string, now: number): boolean => lease === null || lease.owner === me || lease.until < now;

export class StorageLease {
  private readonly storage: KeyValueStorage; readonly me: string; private readonly now: () => number;
  constructor(storage: KeyValueStorage, me: string, now: () => number = () => Date.now()) { this.storage = storage; this.me = me; this.now = now; }
  /** Takes (or renews) the lease when it is free or ours; true when this tab now owns it. */
  acquire(): boolean {
    const t = this.now();
    if (!leaseFree(parseLease(this.storage.getItem(LEASE_KEY)), this.me, t)) return false;
    try { this.storage.setItem(LEASE_KEY, JSON.stringify({ owner: this.me, until: t + LEASE_MS })); } catch { return false; }
    // Read back: if another tab wrote in between, the last writer owns it and the other one backs off.
    return parseLease(this.storage.getItem(LEASE_KEY))?.owner === this.me;
  }
  held(): boolean { const l = parseLease(this.storage.getItem(LEASE_KEY)); return l !== null && l.owner === this.me && l.until >= this.now(); }
  release(): void { if (parseLease(this.storage.getItem(LEASE_KEY))?.owner === this.me) { try { this.storage.removeItem(LEASE_KEY); } catch { /* ignore */ } } }
}
