// Pen Neer — PWA install plumbing. Captures the beforeinstallprompt event so a
// custom "Installeer app" button can trigger it, and registers the service
// worker (production only, so dev HMR is untouched).

type BIPEvent = Event & { prompt: () => Promise<void>; userChoice: Promise<{ outcome: string }> };

let deferred: BIPEvent | null = null;
const listeners = new Set<() => void>();

function notify() {
  listeners.forEach((l) => l());
}

export function isStandalone(): boolean {
  return (
    window.matchMedia?.("(display-mode: standalone)").matches ||
    (window.navigator as Navigator & { standalone?: boolean }).standalone === true
  );
}

export function canInstall(): boolean {
  return deferred !== null && !isStandalone();
}

/** iPhone/iPad. iPadOS 13+ reports itself as desktop Safari, hence the touch check. */
export function isIos(): boolean {
  const ua = navigator.userAgent;
  const nav = navigator as Navigator & { maxTouchPoints?: number };
  return /iPad|iPhone|iPod/.test(ua) || (nav.platform === "MacIntel" && (nav.maxTouchPoints ?? 0) > 1);
}

/**
 * An in-app webview (link opened from Instagram, Facebook, Snapchat...). These
 * have no "Zet op beginscherm" at all, so the user must reopen in Safari first.
 */
export function isIosInAppBrowser(): boolean {
  return isIos() && /FBAN|FBAV|Instagram|Snapchat|Line|Twitter|Pinterest/i.test(navigator.userAgent);
}

export function onInstallChange(cb: () => void): () => void {
  listeners.add(cb);
  return () => listeners.delete(cb);
}

export async function promptInstall(): Promise<boolean> {
  if (!deferred) return false;
  await deferred.prompt();
  const choice = await deferred.userChoice.catch(() => ({ outcome: "dismissed" }));
  deferred = null;
  notify();
  return choice.outcome === "accepted";
}

export function initPwa() {
  window.addEventListener("beforeinstallprompt", (e) => {
    e.preventDefault();
    deferred = e as BIPEvent;
    notify();
  });
  window.addEventListener("appinstalled", () => {
    deferred = null;
    notify();
  });
  if (import.meta.env.PROD && "serviceWorker" in navigator) {
    window.addEventListener("load", () => {
      navigator.serviceWorker.register("/sw.js").catch(() => {});
    });
  }
}
