/* eslint-disable no-restricted-globals */
/** 관리자 PWA 전용 Service Worker — scope: /theall_manager_only/ */

const DEFAULT_ICON = "/theall_manager_only/icon-192.png";
const DEFAULT_URL = "/theall_manager_only/notifications";

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
