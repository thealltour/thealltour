"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import {
  ADMIN_PWA_HUB_HREF,
  getTabletAdminHubMenus,
} from "@/components/admin/mobile/mobileAdmin.constants";
import { useAdminSession } from "@/components/admin/AdminRoleContext";
import { useAdminChat } from "@/components/admin/chat/AdminChatProvider";
import {
  ADMIN_PWA_INSTALL_DISMISS_KEY,
  getAdminServiceWorkerRegistration,
  isAdminPwaStandalone,
  isPushNotificationSupported,
} from "@/lib/adminPwaClient";
import { useAdminPwaInstallPrompt } from "@/hooks/useAdminPwaInstallPrompt";

function detectIosSafari(): boolean {
  if (typeof navigator === "undefined") return false;
  const ua = navigator.userAgent;
  return /iPad|iPhone|iPod/.test(ua) && !(window as Window & { MSStream?: unknown }).MSStream;
}

/**
 * PWA 설치 안내 + 태블릿에서 쓸 수 있는 메뉴만 모은 허브.
 * manifest start_url — 아무 메뉴에서 설치하지 말고 이 페이지에서 추가하도록 유도.
 */
export default function AdminPwaHubPage() {
  const session = useAdminSession();
  const menus = getTabletAdminHubMenus(session);
  const { setOpen, refreshRooms, totalUnread } = useAdminChat();
  const { canPrompt, promptInstall } = useAdminPwaInstallPrompt();
  const [standalone, setStandalone] = useState(false);
  const [isIos, setIsIos] = useState(false);
  const [pushSubscribed, setPushSubscribed] = useState<boolean | null>(null);
  const [installBusy, setInstallBusy] = useState(false);

  useEffect(() => {
    setStandalone(isAdminPwaStandalone());
    setIsIos(detectIosSafari());
  }, []);

  useEffect(() => {
    if (!standalone || !isPushNotificationSupported()) {
      setPushSubscribed(null);
      return;
    }
    void (async () => {
      const registration = await getAdminServiceWorkerRegistration();
      const sub = await registration?.pushManager.getSubscription();
      setPushSubscribed(Boolean(sub));
    })();
  }, [standalone]);

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <section className="space-y-2">
        <h2 className="text-xl font-bold text-[var(--text-primary)]">앱 · 메뉴</h2>
        <p className="text-sm leading-relaxed text-[var(--text-muted)]">
          태블릿·모바일에서 사용할 수 있는 메뉴만 모았습니다. 홈 화면 추가는{" "}
          <strong className="font-semibold text-[var(--text-primary)]">이 페이지에서</strong> 하면
          PC 전용 화면으로 열리지 않습니다.
        </p>
      </section>

      {!standalone ? (
        <section className="rounded-2xl border border-sky-200 bg-sky-50 px-4 py-4 text-sm text-sky-950">
          <p className="font-semibold">홈 화면에 추가 (이 화면에서)</p>
          {canPrompt ? (
            <div className="mt-3 space-y-2">
              <p className="leading-relaxed">
                이 기기에서 앱 설치를 바로 진행할 수 있습니다. 설치 후 아이콘으로 실행하면 이 허브로
                열립니다.
              </p>
              <button
                type="button"
                disabled={installBusy}
                onClick={() => {
                  setInstallBusy(true);
                  void promptInstall().finally(() => setInstallBusy(false));
                }}
                className="rounded-lg bg-sky-700 px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-50"
              >
                {installBusy ? "설치 창 여는 중…" : "앱 설치"}
              </button>
            </div>
          ) : (
            <ol className="mt-2 list-decimal space-y-1.5 pl-5 leading-relaxed">
              {isIos ? (
                <>
                  <li>Safari 하단 공유(↑)를 누릅니다.</li>
                  <li>「홈 화면에 추가」를 선택합니다.</li>
                  <li>추가된 아이콘으로 실행하면 이 메뉴 허브로 열립니다.</li>
                </>
              ) : (
                <>
                  <li>Chrome 메뉴(⋮)를 엽니다.</li>
                  <li>「홈 화면에 추가」 또는 「앱 설치」를 선택합니다.</li>
                  <li>설치 후 아이콘으로 실행하면 이 메뉴 허브로 열립니다.</li>
                </>
              )}
            </ol>
          )}
          <p className="mt-3 text-xs text-sky-800/90">
            다른 메뉴(상품·랜딩 등)에서 추가하면 PC 전용 안내가 뜰 수 있습니다.
          </p>
          <button
            type="button"
            className="mt-3 text-xs font-medium text-sky-800 underline"
            onClick={() => {
              localStorage.setItem(ADMIN_PWA_INSTALL_DISMISS_KEY, "1");
            }}
          >
            안내 배너 다시 보지 않기
          </button>
        </section>
      ) : (
        <section className="space-y-3">
          <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface-muted)] px-4 py-3 text-sm text-[var(--text-secondary)]">
            앱으로 실행 중입니다. 아래 메뉴로 이동하세요. 화면을 가로로 돌리면 좌측 메뉴가 펼쳐집니다.
          </div>
          {pushSubscribed === false ? (
            <div className="rounded-2xl border border-[var(--warning)]/40 bg-[var(--warning-bg)] px-4 py-3 text-sm text-[var(--warning)]">
              <p className="font-semibold">OS 알림이 꺼져 있습니다</p>
              <p className="mt-1 text-xs leading-relaxed opacity-90">
                새 문의·SMS·채팅을 받으려면 알림을 켜 주세요.
              </p>
              <Link
                href="/theall_manager_only/notifications/push"
                className="mt-2 inline-flex rounded-lg bg-amber-800 px-3 py-2 text-xs font-semibold text-white"
              >
                알림 켜기
              </Link>
            </div>
          ) : null}
        </section>
      )}

      <section>
        <div className="mb-3 flex items-center justify-between gap-2">
          <h3 className="text-sm font-semibold text-[var(--text-primary)]">사용 가능한 메뉴</h3>
          <button
            type="button"
            onClick={() => {
              void refreshRooms();
              setOpen(true);
            }}
            className="inline-flex items-center gap-1.5 rounded-lg border border-[var(--border)] bg-[var(--surface)] px-2.5 py-1.5 text-xs font-medium text-[var(--text-primary)]"
          >
            팀 채팅
            {totalUnread > 0 ? (
              <span className="rounded-full bg-[var(--danger)] px-1.5 py-0.5 text-[10px] font-bold text-white">
                {totalUnread > 99 ? "99+" : totalUnread}
              </span>
            ) : null}
          </button>
        </div>
        <ul className="grid gap-3 sm:grid-cols-2">
          {menus.map((item) => (
            <li key={item.key}>
              {item.key === "team-chat" ? (
                <button
                  type="button"
                  onClick={() => {
                    void refreshRooms();
                    setOpen(true);
                  }}
                  className="flex h-full w-full flex-col rounded-2xl border border-[var(--border)] bg-[var(--surface)] px-4 py-4 text-left transition-colors hover:border-[var(--primary)] hover:bg-[var(--surface-muted)]"
                >
                  <span className="text-base font-semibold text-[var(--text-primary)]">{item.label}</span>
                  <span className="mt-1 text-xs leading-relaxed text-[var(--text-muted)]">
                    {item.description}
                  </span>
                </button>
              ) : (
                <Link
                  href={item.href}
                  className="flex h-full flex-col rounded-2xl border border-[var(--border)] bg-[var(--surface)] px-4 py-4 transition-colors hover:border-[var(--primary)] hover:bg-[var(--surface-muted)]"
                >
                  <span className="text-base font-semibold text-[var(--text-primary)]">{item.label}</span>
                  <span className="mt-1 text-xs leading-relaxed text-[var(--text-muted)]">
                    {item.description}
                  </span>
                </Link>
              )}
            </li>
          ))}
        </ul>
        {menus.length === 0 ? (
          <p className="text-sm text-[var(--text-muted)]">접근 가능한 메뉴가 없습니다.</p>
        ) : null}
      </section>

      <p className="text-center text-[11px] text-[var(--text-subtle)]">
        허브 주소: {ADMIN_PWA_HUB_HREF}
      </p>
    </div>
  );
}
