"use client";

import { useEffect } from "react";
import { trackClientEvent } from "@/lib/analytics/trackClientEvent";
import { createAnalyticsPayload } from "@/lib/analytics/payload";
import { ANALYTICS_EVENTS, ANALYTICS_SOURCES } from "@/lib/analytics/events";
import type { DepositPageInfo } from "@/lib/deposit/getDepositPageInfo";

type DepositPageContentProps = {
  info: DepositPageInfo;
};

export function DepositPageContent({ info }: DepositPageContentProps) {
  useEffect(() => {
    trackClientEvent(
      createAnalyticsPayload({
        eventName: ANALYTICS_EVENTS.deposit_link_click,
        source: ANALYTICS_SOURCES.deposit_page,
        pagePath: "/deposit",
        metadata: { inquiryId: info.inquiryId },
      }),
    );
  }, [info.inquiryId]);

  return (
    <div className="mx-auto max-w-xl space-y-6 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
      <div>
        <p className="text-xs font-semibold tracking-wider text-slate-500">THEALL TOUR DEPOSIT</p>
        <h1 className="mt-1 text-2xl font-bold text-slate-900">예약금 안내</h1>
        <p className="mt-2 text-sm text-slate-600">
          {info.customerName}님, 상담 확정 후 예약금 입금을 안내드립니다.
        </p>
      </div>

      {info.productTitle ? (
        <div className="rounded-lg bg-slate-50 px-4 py-3 text-sm">
          상품: <span className="font-semibold">{info.productTitle}</span>
        </div>
      ) : null}

      <dl className="space-y-3 text-sm">
        <div>
          <dt className="font-semibold text-slate-700">예약금</dt>
          <dd className="mt-1 text-lg font-bold text-[var(--primary)]">{info.depositAmount}</dd>
        </div>
        {info.bankInfo ? (
          <div>
            <dt className="font-semibold text-slate-700">입금 계좌</dt>
            <dd className="mt-1 text-slate-800">{info.bankInfo}</dd>
          </div>
        ) : null}
      </dl>

      {info.paymentLinks.length > 0 ? (
        <div className="space-y-2">
          <p className="text-sm font-semibold text-slate-700">온라인 결제</p>
          {info.paymentLinks.map((link) => (
            <a
              key={link.id}
              href={link.url}
              target="_blank"
              rel="noopener noreferrer"
              onClick={() => {
                trackClientEvent(
                  createAnalyticsPayload({
                    eventName: ANALYTICS_EVENTS.deposit_payment_click,
                    source: ANALYTICS_SOURCES.deposit_page,
                    pagePath: "/deposit",
                    label: link.label,
                    href: link.url,
                    metadata: { inquiryId: info.inquiryId, paymentLinkId: link.id },
                  }),
                );
              }}
              className="inline-flex w-full items-center justify-center rounded-xl bg-[var(--primary)] px-4 py-3 text-sm font-semibold text-white hover:opacity-90"
            >
              {link.label}
            </a>
          ))}
        </div>
      ) : null}

      {info.mainPhone ? (
        <p className="text-center text-xs text-slate-500">
          문의: {info.companyName} · {info.mainPhone}
        </p>
      ) : null}
    </div>
  );
}
