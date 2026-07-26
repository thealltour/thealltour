/* eslint-disable no-restricted-globals */
/** 관리자 PWA 전용 Service Worker — scope: /theall_manager_only/ */

const DEFAULT_ICON = "/theall_manager_only/icon-192.png";
const DEFAULT_URL = "/theall_manager_only/notifications";
const OFFLINE_URL = "/theall_manager_only/offline.html";
const STATIC_CACHE = "admin-pwa-static-v1";
const PRECACHE_URLS = [
  OFFLINE_URL,
  DEFAULT_ICON,
  "/theall_manager_only/icon-512.png",
  "/theall_manager_only/manifest.webmanifest",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    (async () => {
      const cache = await caches.open(STATIC_CACHE);
      await cache.addAll(PRECACHE_URLS);
      // 대기열에만 두지 않고 바로 활성화할지는 클라이언트 SKIP_WAITING에 따름
    })(),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(
        keys
          .filter((key) => key.startsWith("admin-pwa-static-") && key !== STATIC_CACHE)
          .map((key) => caches.delete(key)),
      );
      await self.clients.claim();
    })(),
  );
});

self.addEventListener("message", (event) => {
  if (event.data?.type === "SKIP_WAITING") {
    void self.skipWaiting();
  }
});

/** 문서 네비게이션만 오프라인 폴백 — API/HTML 앱 셸 광역 캐시 금지 */
self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;
  if (request.mode !== "navigate") return;

  event.respondWith(
    (async () => {
      try {
        return await fetch(request);
      } catch {
        const cache = await caches.open(STATIC_CACHE);
        const offline = await cache.match(OFFLINE_URL);
        return offline ?? Response.error();
      }
    })(),
  );
});

function parsePushPayload(event) {
  const fallback = {
    title: "더올투어 관리",
    body: "",
    url: DEFAULT_URL,
    type: "admin-notification",
    unreadCount: 0,
  };
  if (!event.data) return fallback;
  try {
    return { ...fallback, ...event.data.json() };
  } catch {
    return { ...fallback, body: event.data.text() };
  }
}

async function syncAppBadge(unreadCount) {
  if (!("setAppBadge" in self.navigator)) return;
  if (unreadCount > 0) {
    await self.navigator.setAppBadge(unreadCount);
  } else {
    await self.navigator.clearAppBadge();
  }
}

self.addEventListener("push", (event) => {
  const data = parsePushPayload(event);
  event.waitUntil(
    (async () => {
      await syncAppBadge(data.unreadCount);
      await self.registration.showNotification(data.title, {
        body: data.body,
        icon: DEFAULT_ICON,
        badge: DEFAULT_ICON,
        tag: data.type || "admin-notification",
        data: { url: data.url || DEFAULT_URL },
      });
    })(),
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const targetUrl = event.notification.data?.url || DEFAULT_URL;
  const absoluteUrl = new URL(targetUrl, self.location.origin).href;

  event.waitUntil(
    (async () => {
      const windowClients = await self.clients.matchAll({
        type: "window",
        includeUncontrolled: true,
      });
      for (const client of windowClients) {
        if (!client.url.includes("/theall_manager_only")) continue;
        if ("focus" in client) {
          await client.focus();
          if ("navigate" in client) {
            await client.navigate(absoluteUrl);
          }
          return;
        }
      }
      if (self.clients.openWindow) {
        await self.clients.openWindow(absoluteUrl);
      }
    })(),
  );
});

self.addEventListener("pushsubscriptionchange", (event) => {
  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((clients) => {
      for (const client of clients) {
        client.postMessage({ type: "ADMIN_PUSH_RESUBSCRIBE" });
      }
    }),
  );
});
