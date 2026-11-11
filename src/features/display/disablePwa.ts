/** Safely retires the previous Web Lab PWA without affecting other apps.
 * No new SW is registered. Only registrations whose scope exactly matches
 * this Vite base URL and caches with this project's unique prefix are removed.
 */
export const WEBLAB_CACHE_PREFIX = 'brejo-weblab-';

export function isWebLabRegistration(scope: string, origin: string, basePath: string): boolean {
  return scope === new URL(basePath, origin).href;
}

export async function disableWebLabPwa(win: Window, basePath: string): Promise<void> {
  try {
    if ('serviceWorker' in win.navigator) {
      const registrations = await win.navigator.serviceWorker.getRegistrations();
      await Promise.all(registrations
        .filter((entry) => isWebLabRegistration(entry.scope, win.location.origin, basePath))
        .map((entry) => entry.unregister()));
    }
  } catch (error) {
    console.warn('Web Lab: não foi possível encerrar o service worker antigo', error);
  }

  try {
    const store = (win as Window & { caches?: CacheStorage }).caches;
    if (!store) return;
    const keys = await store.keys();
    await Promise.all(keys.filter((key) => key.startsWith(WEBLAB_CACHE_PREFIX))
      .map((key) => store.delete(key)));
  } catch (error) {
    console.warn('Web Lab: não foi possível limpar o cache antigo do jogo', error);
  }
}
