/**
 * A mobile browser can only lock orientation when its own policies allow it
 * (typically after a user gesture and while fullscreen). This is a best-effort
 * request, not a bypass of Android rotation settings.
 */
import { isAppDisplayMode } from './pwa.ts';

export type LandscapeMode = 'locked' | 'fullscreen-only' | 'manual';

export async function requestLandscapeMode(
  doc: Document,
  display: Screen,
  installedMode = false,
): Promise<LandscapeMode> {
  // Installed PWAs already have an app window: invoking requestFullscreen would
  // reintroduce the Chrome security banner that prompted this change.
  if (!installedMode && !doc.fullscreenElement) {
    const request = doc.documentElement.requestFullscreen;
    if (typeof request !== 'function') return 'manual';
    try {
      await doc.documentElement.requestFullscreen();
    } catch {
      return 'manual';
    }
  }

  // TypeScript's DOM library in this project does not yet expose this browser API.
  const orientation = display.orientation as (ScreenOrientation & {
    lock?: (mode: 'landscape') => Promise<void>;
  }) | undefined;
  if (!orientation || typeof orientation.lock !== 'function') return installedMode ? 'manual' : 'fullscreen-only';

  try {
    await orientation.lock('landscape');
    return 'locked';
  } catch {
    return installedMode ? 'manual' : 'fullscreen-only';
  }
}

/** Connect the portrait overlay button to the browser's display APIs. */
export function enableLandscapeButton(doc: Document, display: Screen): void {
  const button = doc.querySelector<HTMLButtonElement>('#landscape-start');
  const feedback = doc.querySelector<HTMLElement>('#landscape-feedback');
  if (!button || !feedback) return;

  button.addEventListener('click', async () => {
    if (button.disabled) return;
    button.disabled = true;
    feedback.textContent = 'Tentando abrir na horizontal…';

    const installedMode = isAppDisplayMode((query) => window.matchMedia(query).matches);
    const result = await requestLandscapeMode(doc, display, installedMode);
    if (result === 'locked') {
      feedback.textContent = 'Modo horizontal solicitado.';
    } else if (result === 'fullscreen-only') {
      feedback.textContent = 'Tela cheia ativada, mas a rotação foi bloqueada. Ative a rotação automática ou vire o celular manualmente.';
    } else {
      feedback.textContent = installedMode
        ? 'O Android não mudou a orientação. Ative Rotação automática ou gire o aparelho manualmente.'
        : 'O navegador não permitiu girar a tela. Ative a rotação automática e vire o celular manualmente.';
    }
    button.disabled = false;
  });
}
