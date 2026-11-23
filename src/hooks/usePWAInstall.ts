import {useEffect, useState} from 'react';

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{outcome: 'accepted' | 'dismissed'; platform: string}>;
}

// Captura global inmediata antes de que React termine de montar
let globalDeferredPrompt: BeforeInstallPromptEvent | null = null;
let globalInstalled = false;
const listeners = new Set<() => void>();

function notifyListeners() {
  listeners.forEach((cb) => cb());
}

if (typeof window !== 'undefined') {
  globalInstalled =
    window.matchMedia('(display-mode: standalone)').matches ||
    (window.navigator as unknown as {standalone?: boolean}).standalone === true;

  window.addEventListener('beforeinstallprompt', (e: Event) => {
    e.preventDefault();
    globalDeferredPrompt = e as BeforeInstallPromptEvent;
    notifyListeners();
  });

  window.addEventListener('appinstalled', () => {
    globalInstalled = true;
    globalDeferredPrompt = null;
    notifyListeners();
  });
}

export function initPWAInstallListener(): void {
  // Referencia explícita desde main.tsx para garantizar registro temprano del listener
}

export function usePWAInstall() {
  const [, setTick] = useState(0);
  const [isIOS, setIsIOS] = useState(false);
  const [isInAppBrowser, setIsInAppBrowser] = useState(false);

  useEffect(() => {
    const ua = window.navigator.userAgent.toLowerCase();
    const isIOSDevice =
      /iphone|ipad|ipod/.test(ua) ||
      (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
    setIsIOS(isIOSDevice);

    const inApp =
      /fban|fbav|instagram|whatsapp|line|micromessenger|tiktok|musical_ly|snapchat/.test(
        ua,
      );
    setIsInAppBrowser(inApp);

    const onUpdate = () => setTick((n) => n + 1);
    listeners.add(onUpdate);
    return () => {
      listeners.delete(onUpdate);
    };
  }, []);

  const install = async () => {
    if (!globalDeferredPrompt) return false;
    const promptEvent = globalDeferredPrompt;
    globalDeferredPrompt = null;
    try {
      await promptEvent.prompt();
      const {outcome} = await promptEvent.userChoice;
      if (outcome === 'accepted') {
        globalInstalled = true;
        return true;
      }
      return false;
    } catch {
      return false;
    } finally {
      notifyListeners();
    }
  };

  return {
    isInstallable: Boolean(globalDeferredPrompt),
    isInstalled: globalInstalled,
    isIOS,
    isInAppBrowser,
    install,
  };
}
