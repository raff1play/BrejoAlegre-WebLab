/**
 * A mobile browser can only lock orientation when its own policies allow it
 * (typically after a user gesture and while fullscreen). This is a best-effort
 * request, not a bypass of Android rotation settings.
 */
export type LandscapeMode = 'locked' | 'fullscreen-only' | 'manual';

export async function requestLandscapeMode(
  doc: Document,
  display: Screen,
): Promise<LandscapeMode> {
  if (!doc.fullscreenElement) {
    const request = doc.documentElement.requestFullscreen;
    if (typeof request !== 'function') return 'manual';
    try {
      await doc.documentElement.requestFullscreen();
    } catch {
      return 'manual';
    }
  }

  const orientation = display.orientation;
  if (!orientation || typeof orientation.lock !== 'function') return 'fullscreen-only';

  try {
    await orientation.lock('landscape');
    return 'locked';
  } catch {
    return 'fullscreen-only';
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

    const result = await requestLandscapeMode(doc, display);
    if (result === 'locked') {
      feedback.textContent = 'Modo horizontal solicitado.';
    } else if (result === 'fullscreen-only') {
      feedback.textContent = 'Tela cheia ativada, mas a rotação foi bloqueada. Ative a rotação automática ou vire o celular manualmente.';
    } else {
      feedback.textContent = 'O navegador não permitiu girar a tela. Ative a rotação automática e vire o celular manualmente.';
    }
    button.disabled = false;
  });
}
