export const ADMIN_PWA_SW_PATH = "/theall_manager_only/sw.js";
export const ADMIN_PWA_SCOPE = "/theall_manager_only/";
export const ADMIN_PWA_INSTALL_DISMISS_KEY = "theall-admin-pwa-install-dismissed";

export function isAdminPwaStandalone(): boolean {
  if (typeof window === "undefined") return false;
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    (window.navigator as Navigator & { standalone?: boolean }).standalone === true
  );
}

export function isPushNotificationSupported(): boolean {
  if (typeof window === "undefined") return false;
  return "serviceWorker" in navigator && "PushManager" in window && "Notification" in window;
}

export function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; i += 1) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

export async function registerAdminServiceWorker(): Promise<ServiceWorkerRegistration | null> {
  if (!("serviceWorker" in navigator)) return null;
  try {
    return await navigator.serviceWorker.register(ADMIN_PWA_SW_PATH, {
      scope: ADMIN_PWA_SCOPE,
    });
  } catch {
    return null;
  }
}

export async function getAdminServiceWorkerRegistration(): Promise<ServiceWorkerRegistration | null> {
  if (!("serviceWorker" in navigator)) return null;
  return (await navigator.serviceWorker.getRegistration(ADMIN_PWA_SCOPE)) ?? null;
}

export async function syncAdminAppBadge(unreadCount: number): Promise<void> {
  if (!("setAppBadge" in navigator)) return;
  try {
    if (unreadCount > 0) {
      await navigator.setAppBadge(unreadCount);
    } else {
      await navigator.clearAppBadge();
    }
  } catch {
    // ignore — 일부 브라우저/컨텍스트에서 거부될 수 있음
  }
}

export async function clearAdminAppBadge(): Promise<void> {
  if (!("clearAppBadge" in navigator)) return;
  try {
    await navigator.clearAppBadge();
  } catch {
    // ignore
  }
}
