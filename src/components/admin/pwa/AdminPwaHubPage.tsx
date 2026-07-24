"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import {
  ADMIN_PWA_HUB_HREF,
  getTabletAdminHubMenus,
} from "@/components/admin/mobile/mobileAdmin.constants";
import { useAdminSession } from "@/components/admin/AdminRoleContext";
import {
  ADMIN_PWA_INSTALL_DISMISS_KEY,
  isAdminPwaStandalone,
} from "@/lib/adminPwaClient";

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
  const [standalone, setStandalone] = useState(false);
  const [isIos, setIsIos] = useState(false);

  useEffect(() => {
    setStandalone(isAdminPwaStandalone());
    setIsIos(detectIosSafari());
  }, []);

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
        <section className="rounded-2xl border border-[var(--border)] bg-[var(--surface-muted)] px-4 py-3 text-sm text-[var(--text-secondary)]">
          앱으로 실행 중입니다. 아래 메뉴로 이동하세요. 화면을 가로로 돌리면 좌측 메뉴가 펼쳐집니다.
        </section>
      )}

      <section>
        <h3 className="mb-3 text-sm font-semibold text-[var(--text-primary)]">사용 가능한 메뉴</h3>
        <ul className="grid gap-3 sm:grid-cols-2">
          {menus.map((item) => (
            <li key={item.key}>
              <Link
                href={item.href}
                className="flex h-full flex-col rounded-2xl border border-[var(--border)] bg-[var(--surface)] px-4 py-4 transition-colors hover:border-[var(--primary)] hover:bg-[var(--surface-muted)]"
              >
                <span className="text-base font-semibold text-[var(--text-primary)]">{item.label}</span>
                <span className="mt-1 text-xs leading-relaxed text-[var(--text-muted)]">
                  {item.description}
                </span>
              </Link>
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
