import { GAME_LOCK_NAME, LEASE_RENEW_MS, StorageLease } from '../../core/career/tabLease';
import type { KeyValueStorage } from '../../core/career/careerStore';

/**
 * B1-01 F6: the single-writer tab (see `core/career/tabLease.ts`). The game tab holds an exclusive
 * Web Lock for its whole life; a second tab of the same browser opens the menu READ-ONLY until the
 * first one is closed (the browser releases the lock even if that tab crashed).
 */
export type GameLock = { held: boolean; mode: 'web-locks' | 'lease' | 'memoria'; retry: () => Promise<boolean> };

type Locks = { request: (name: string, options: { ifAvailable: boolean; mode: 'exclusive' }, cb: (lock: unknown) => Promise<void>) => Promise<unknown> };

export async function acquireGameLock(win: Window, storage: KeyValueStorage, durable: boolean): Promise<GameLock> {
  // Nothing is persisted without storage: there is nothing to protect.
  if (!durable) return { held: true, mode: 'memoria', retry: async () => true };
  const locks = (win.navigator as unknown as { locks?: Locks }).locks;
  if (locks && typeof locks.request === 'function') {
    const lock: GameLock = { held: false, mode: 'web-locks', retry: async () => false };
    const attempt = (): Promise<boolean> => new Promise<boolean>((resolve) => {
      locks.request(GAME_LOCK_NAME, { ifAvailable: true, mode: 'exclusive' }, async (l) => {
        if (!l) { resolve(false); return; }
        resolve(true);
        // Held until the tab goes away.
        await new Promise<void>(() => {});
      }).catch(() => resolve(false));
    });
    lock.retry = async () => { if (!lock.held) lock.held = await attempt(); return lock.held; };
    await lock.retry();
    return lock;
  }
  const me = `aba-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
  const lease = new StorageLease(storage, me);
  const lock: GameLock = { held: false, mode: 'lease', retry: async () => false };
  let timer: number | null = null;
  lock.retry = async () => {
    lock.held = lease.acquire();
    if (lock.held && timer === null) {
      timer = win.setInterval(() => { if (!lease.acquire()) lock.held = false; }, LEASE_RENEW_MS);
      win.addEventListener('pagehide', () => lease.release());
    }
    return lock.held;
  };
  await lock.retry();
  return lock;
}
