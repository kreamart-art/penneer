// Pen Neer — Web Push subscription plumbing (the client half of real
// notifications while the app is closed). The flow:
//   permission granted + logged-in account + service worker registered
//   -> PushManager.subscribe with the server's VAPID key
//   -> POST the subscription to the server, tied to the account token.
// iOS: only available once the PWA is installed on the home screen (16.4+);
// everywhere unsupported this is a silent no-op.

function accountToken(): string | null {
  try {
    return localStorage.getItem("penneer.accountToken");
  } catch {
    return null;
  }
}

function urlBase64ToUint8Array(base64: string): Uint8Array {
  const padding = "=".repeat((4 - (base64.length % 4)) % 4);
  const raw = atob((base64 + padding).replace(/-/g, "+").replace(/_/g, "/"));
  const out = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
  return out;
}

let busy = false;

export async function ensurePushSubscription(): Promise<void> {
  if (busy) return;
  busy = true;
  try {
    const token = accountToken();
    if (!token) return;
    if (!("serviceWorker" in navigator) || !("PushManager" in window) || !("Notification" in window)) return;
    if (Notification.permission !== "granted") return;
    const reg = await navigator.serviceWorker.ready;
    if (!reg.pushManager) return;

    let sub = await reg.pushManager.getSubscription();
    if (!sub) {
      const res = await fetch("/api/push/key");
      const data = await res.json();
      if (!data.enabled || !data.key) return;
      sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(data.key) as BufferSource,
      });
    }
    await fetch("/api/push/subscribe", {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify(sub.toJSON()),
    });
  } catch {
    /* best-effort: push is a bonus, never break the app over it */
  } finally {
    busy = false;
  }
}
