import "server-only";

import webpush from "web-push";
import {
  deleteAdminPushSubscriptionById,
  getAdminPushSubscriptionsForUserKeys,
  getAllAdminPushSubscriptions,
  isWebPushConfigured,
} from "@/lib/adminPushSubscriptions";
import { getUnreadNotificationCount } from "@/lib/adminNotificationCounts";
import {
  buildAdminWebPushPayload,
  isExpiredPushSubscriptionStatus,
} from "@/lib/adminWebPushPayload";

let vapidConfigured = false;

function ensureVapidConfigured() {
  if (vapidConfigured) return;
  if (!isWebPushConfigured()) return;

  webpush.setVapidDetails(
    process.env.WEB_PUSH_VAPID_SUBJECT?.trim() || "mailto:admin@thealltour.com",
    process.env.WEB_PUSH_VAPID_PUBLIC_KEY!.trim(),
    process.env.WEB_PUSH_VAPID_PRIVATE_KEY!.trim(),
  );
  vapidConfigured = true;
}

export type DispatchAdminWebPushInput = {
  title: string;
  body: string;
  targetUrl?: string | null;
  type?: string;
};

export async function dispatchAdminWebPush(input: DispatchAdminWebPushInput): Promise<void> {
  if (!isWebPushConfigured()) return;

  ensureVapidConfigured();

  const subscriptions = await getAllAdminPushSubscriptions();
  await sendPushToSubscriptions(subscriptions, input);
}

export async function dispatchAdminWebPushToUserKeys(
  userKeys: string[],
  input: DispatchAdminWebPushInput,
  options?: { chatOnly?: boolean },
): Promise<void> {
  if (!isWebPushConfigured()) return;
  if (userKeys.length === 0) return;

  ensureVapidConfigured();

  const subscriptions = await getAdminPushSubscriptionsForUserKeys(userKeys, {
    chatOnly: options?.chatOnly,
  });
  await sendPushToSubscriptions(subscriptions, input);
}

async function sendPushToSubscriptions(
  subscriptions: Awaited<ReturnType<typeof getAllAdminPushSubscriptions>>,
  input: DispatchAdminWebPushInput,
): Promise<void> {
  if (subscriptions.length === 0) return;

  const unreadCount = await getUnreadNotificationCount();
  const payload = buildAdminWebPushPayload({
    title: input.title,
    body: input.body,
    targetUrl: input.targetUrl,
    type: input.type,
    unreadCount,
  });
  const payloadString = JSON.stringify(payload);

  await Promise.allSettled(
    subscriptions.map(async (subscription) => {
      try {
        await webpush.sendNotification(
          {
            endpoint: subscription.endpoint,
            keys: {
              p256dh: subscription.p256dh,
              auth: subscription.auth,
            },
          },
          payloadString,
        );
      } catch (error) {
        const statusCode =
          error && typeof error === "object" && "statusCode" in error
            ? Number((error as { statusCode?: number }).statusCode)
            : 0;
        if (isExpiredPushSubscriptionStatus(statusCode)) {
          await deleteAdminPushSubscriptionById(subscription.id);
        }
      }
    }),
  );
}
