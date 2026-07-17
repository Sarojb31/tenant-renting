import { useEffect, useState } from 'react';

interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>;
  readonly userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

const DISMISSED_KEY = 'pwa_install_dismissed';

export function useInstallPrompt() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [isDismissed, setIsDismissed] = useState(() => {
    try { return localStorage.getItem(DISMISSED_KEY) === '1'; } catch { return false; }
  });
  const [isInstalled, setIsInstalled] = useState(() =>
    window.matchMedia('(display-mode: standalone)').matches,
  );

  useEffect(() => {
    const handler = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
    };
    window.addEventListener('beforeinstallprompt', handler);

    const mq = window.matchMedia('(display-mode: standalone)');
    const onInstalled = (e: MediaQueryListEvent) => {
      if (e.matches) setIsInstalled(true);
    };
    mq.addEventListener('change', onInstalled);

    return () => {
      window.removeEventListener('beforeinstallprompt', handler);
      mq.removeEventListener('change', onInstalled);
    };
  }, []);

  async function install() {
    if (!deferredPrompt) return;
    await deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === 'accepted') setIsInstalled(true);
    setDeferredPrompt(null);
  }

  function dismiss() {
    setIsDismissed(true);
    try { localStorage.setItem(DISMISSED_KEY, '1'); } catch { /* ignore */ }
  }

  const canInstall = !!deferredPrompt && !isDismissed && !isInstalled;

  return { canInstall, install, dismiss, isInstalled };
}
