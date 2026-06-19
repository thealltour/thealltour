import { NextResponse } from "next/server";
import { requireAdminSession } from "@/lib/apiAuth";
import {
  deleteAdminPushSubscriptionByEndpoint,
  getWebPushVapidPublicKey,
  hasAdminPushSubscriptionForEndpoint,
  isWebPushConfigured,
  resolveAdminUserKey,
  upsertAdminPushSubscription,
} from "@/lib/adminPushSubscriptions";

type PushSubscriptionBody = {
  endpoint?: string;
  keys?: {
    p256dh?: string;
    auth?: string;
  };
};

export async function GET() {
  const auth = await requireAdminSession();
  if (!auth.ok) return auth.res;

  return NextResponse.json({
    configured: isWebPushConfigured(),
    vapidPublicKey: getWebPushVapidPublicKey(),
  });
}

export async function POST(request: Request) {
  const auth = await requireAdminSession();
  if (!auth.ok) return auth.res;

  if (!isWebPushConfigured()) {
    return NextResponse.json(
      { message: "Web Push가 서버에 설정되지 않았습니다." },
      { status: 503 },
    );
  }

  let body: PushSubscriptionBody;
  try {
    body = (await request.json()) as PushSubscriptionBody;
  } catch {
    return NextResponse.json({ message: "잘못된 요청입니다." }, { status: 400 });
  }

  const endpoint = body.endpoint?.trim();
  const p256dh = body.keys?.p256dh?.trim();
  const authKey = body.keys?.auth?.trim();
  if (!endpoint || !p256dh || !authKey) {
    return NextResponse.json({ message: "Push 구독 정보가 올바르지 않습니다." }, { status: 400 });
  }

  try {
    await upsertAdminPushSubscription({
      adminUserKey: resolveAdminUserKey(auth.session),
      endpoint,
      p256dh,
      auth: authKey,
      userAgent: request.headers.get("user-agent"),
    });
    return NextResponse.json({ message: "알림 구독이 등록되었습니다.", subscribed: true });
  } catch {
    return NextResponse.json({ message: "알림 구독 등록에 실패했습니다." }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  const auth = await requireAdminSession();
  if (!auth.ok) return auth.res;

  let body: PushSubscriptionBody = {};
  try {
    body = (await request.json()) as PushSubscriptionBody;
  } catch {
    body = {};
  }

  const endpoint = body.endpoint?.trim();
  if (!endpoint) {
    return NextResponse.json({ message: "구독 endpoint가 필요합니다." }, { status: 400 });
  }

  try {
    const exists = await hasAdminPushSubscriptionForEndpoint(endpoint);
    if (exists) {
      await deleteAdminPushSubscriptionByEndpoint(endpoint);
    }
    return NextResponse.json({ message: "알림 구독이 해제되었습니다.", subscribed: false });
  } catch {
    return NextResponse.json({ message: "알림 구독 해제에 실패했습니다." }, { status: 500 });
  }
}
