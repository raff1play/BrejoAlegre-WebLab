/** Install prompt is optional: Android/Chrome decides when to offer it.
 * The game still works in a normal browser tab when installation is unavailable.
 */
interface InstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

export function isAppDisplayMode(matches: (query: string) => boolean): boolean {
  return ['standalone', 'fullscreen', 'minimal-ui']
    .some((mode) => matches(`(display-mode: ${mode})`));
}

export function initializePwa(doc: Document, win: Window): void {
  const installButtons = [...doc.querySelectorAll<HTMLButtonElement>('[data-pwa-install]')];
  const hint = doc.querySelector<HTMLElement>('#pwa-install-feedback');
  const toast = doc.querySelector<HTMLElement>('#toast');
  let promptEvent: InstallPromptEvent | null = null;
  let toastTimeout: ReturnType<typeof setTimeout> | null = null;

  const appMode = () => isAppDisplayMode((query) => win.matchMedia(query).matches);
  const updateButtons = () => {
    for (const button of installButtons) button.hidden = appMode();
  };
  const tell = (message: string) => {
    if (hint) hint.textContent = message;
    if (toast && !appMode()) {
      toast.textContent = message;
      toast.classList.add('visible');
      if (toastTimeout !== null) win.clearTimeout(toastTimeout);
      toastTimeout = win.setTimeout(() => toast.classList.remove('visible'), 6000);
    }
  };

  win.addEventListener('beforeinstallprompt', (event) => {
    event.preventDefault();
    promptEvent = event as InstallPromptEvent;
    updateButtons();
  });

  win.addEventListener('appinstalled', () => {
    promptEvent = null;
    updateButtons();
    tell('Instalado. Abra o jogo pelo novo ícone na tela inicial.');
  });

  for (const button of installButtons) {
    button.addEventListener('click', async () => {
      if (appMode()) return;
      if (!promptEvent) {
        tell('No Chrome, toque em ⋮ → Instalar app (ou Adicionar à tela inicial). Depois abra pelo ícone.');
        return;
      }

      const current = promptEvent;
      promptEvent = null;
      try {
        await current.prompt();
        const choice = await current.userChoice;
        tell(choice.outcome === 'accepted'
          ? 'Instalação solicitada. Abra pelo ícone do aplicativo, não pela aba do Chrome.'
          : 'Instalação cancelada. Você ainda pode usar ⋮ → Instalar app.');
      } catch {
        tell('O Chrome não permitiu instalar agora. Use o menu ⋮ → Instalar app.');
      }
    });
  }
  updateButtons();

  // Never cache dev HMR responses. Pages staging/production are HTTPS and can host the SW.
  if (import.meta.env.PROD && 'serviceWorker' in win.navigator) {
    win.addEventListener('load', () => {
      void win.navigator.serviceWorker.register(`${import.meta.env.BASE_URL}sw.js`, {
        scope: import.meta.env.BASE_URL,
      }).catch((error: unknown) => {
        console.warn('PWA: service worker não registrado (jogo online continua disponível)', error);
      });
    }, { once: true });
  }
}
