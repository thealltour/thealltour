"use client";

import { useCallback, useEffect, useState } from "react";
import {
  getAdminServiceWorkerRegistration,
  isPushNotificationSupported,
  registerAdminServiceWorker,
  urlBase64ToUint8Array,
} from "@/lib/adminPwaClient";

type PushConfigResponse = {
  configured?: boolean;
  vapidPublicKey?: string | null;
  message?: string;
};

export function AdminPushNotificationSettings() {
  const [supported, setSupported] = useState(false);
  const [configured, setConfigured] = useState(false);
  const [subscribed, setSubscribed] = useState(false);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [vapidPublicKey, setVapidPublicKey] = useState<string | null>(null);

  const refreshSubscriptionState = useCallback(async () => {
    const registration = await getAdminServiceWorkerRegistration();
    const subscription = await registration?.pushManager.getSubscription();
    setSubscribed(Boolean(subscription));
  }, []);

  const subscribePush = useCallback(async () => {
    if (!vapidPublicKey) {
      setErrorMessage("서버 Web Push 설정(VAPID)이 필요합니다.");
      return;
    }

    setBusy(true);
    setErrorMessage("");
    try {
      const permission = await Notification.requestPermission();
      if (permission !== "granted") {
        setErrorMessage("알림 권한이 거부되었습니다. 기기 설정에서 허용해 주세요.");
        return;
      }

      const registration =
        (await registerAdminServiceWorker()) ?? (await getAdminServiceWorkerRegistration());
      if (!registration) {
        setErrorMessage("Service Worker 등록에 실패했습니다.");
        return;
      }

      let subscription = await registration.pushManager.getSubscription();
      if (!subscription) {
        subscription = await registration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToUint8Array(vapidPublicKey) as BufferSource,
        });
      }

      const json = subscription.toJSON();
      const res = await fetch("/api/admin/push-subscriptions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          endpoint: json.endpoint,
          keys: json.keys,
        }),
      });
      const data = (await res.json()) as { message?: string };
      if (!res.ok) {
        setErrorMessage(data.message ?? "알림 구독 등록에 실패했습니다.");
        return;
      }
      setSubscribed(true);
    } catch {
      setErrorMessage("알림 구독 등록 중 오류가 발생했습니다.");
    } finally {
      setBusy(false);
    }
  }, [vapidPublicKey]);

  const unsubscribePush = useCallback(async () => {
    setBusy(true);
    setErrorMessage("");
    try {
      const registration = await getAdminServiceWorkerRegistration();
      const subscription = await registration?.pushManager.getSubscription();
      if (subscription) {
        const endpoint = subscription.endpoint;
        await subscription.unsubscribe();
        await fetch("/api/admin/push-subscriptions", {
          method: "DELETE",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ endpoint }),
        });
      }
      setSubscribed(false);
    } catch {
      setErrorMessage("알림 구독 해제 중 오류가 발생했습니다.");
    } finally {
      setBusy(false);
    }
  }, []);

  useEffect(() => {
    setSupported(isPushNotificationSupported());
    void (async () => {
      try {
        const res = await fetch("/api/admin/push-subscriptions", { cache: "no-store" });
        const data = (await res.json()) as PushConfigResponse;
        if (!res.ok) {
          setErrorMessage(data.message ?? "알림 설정을 불러오지 못했습니다.");
          return;
        }
        setConfigured(Boolean(data.configured));
        setVapidPublicKey(data.vapidPublicKey ?? null);
        await refreshSubscriptionState();
      } catch {
        setErrorMessage("알림 설정을 불러오지 못했습니다.");
      } finally {
        setLoading(false);
      }
    })();
  }, [refreshSubscriptionState]);

  useEffect(() => {
    function handleResubscribe() {
      void subscribePush();
    }
    window.addEventListener("admin-push-resubscribe", handleResubscribe);
    return () => window.removeEventListener("admin-push-resubscribe", handleResubscribe);
  }, [subscribePush]);

  if (loading) {
    return (
      <div className="rounded-xl border border-[var(--border)] bg-[var(--surface-muted)] px-4 py-3 text-sm text-[var(--text-muted)]">
        OS 알림 설정을 불러오는 중…
      </div>
    );
  }

  if (!supported) {
    return (
      <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
        이 브라우저는 OS 푸시 알림을 지원하지 않습니다. iOS 16.4+에서 홈 화면에 추가한
        뒤 Safari PWA로 이용해 주세요.
      </div>
    );
  }

  return (
    <section className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-sm font-semibold text-[var(--text-primary)]">OS 푸시 알림</h2>
          <p className="mt-1 text-xs text-[var(--text-muted)]">
            홈 화면에 추가한 관리자 앱이 꺼져 있어도 신규 문의·SMS 등을 알림센터로 받습니다.
          </p>
          {!configured ? (
            <p className="mt-2 text-xs text-amber-700">
              서버 VAPID 키가 설정되지 않았습니다. 배포 환경변수를 확인해 주세요.
            </p>
          ) : null}
        </div>
        <button
          type="button"
          disabled={busy || !configured}
          onClick={() => void (subscribed ? unsubscribePush() : subscribePush())}
          className="shrink-0 rounded-lg bg-[var(--primary)] px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
        >
          {busy ? "처리 중…" : subscribed ? "OS 알림 끄기" : "OS 알림 켜기"}
        </button>
      </div>
      {errorMessage ? <p className="mt-3 text-xs text-red-600">{errorMessage}</p> : null}
      <ul className="mt-3 list-disc space-y-1 pl-5 text-xs text-[var(--text-muted)]">
        <li>Android: Chrome에서 홈 화면에 추가 후 「OS 알림 켜기」</li>
        <li>iOS 16.4+: Safari → 공유 → 홈 화면에 추가 → 앱 실행 후 알림 허용</li>
      </ul>
    </section>
  );
}
