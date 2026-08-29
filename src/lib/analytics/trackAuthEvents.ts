/**
 * 일반 Membership Auth funnel 계측 — Sync funnel event와 분리.
 */

import { ANALYTICS_EVENTS, ANALYTICS_SOURCES } from "@/lib/analytics/events";
import { createAnalyticsPayload, inferDeviceType } from "@/lib/analytics/payload";
import { trackClientEvent } from "@/lib/analytics/trackClientEvent";

function getPagePath(): string | null {
  return typeof window !== "undefined" ? window.location.pathname : null;
}

function getDeviceType() {
  return inferDeviceType(
    typeof window !== "undefined" && window.matchMedia("(max-width: 767px)").matches
      ? "mobile"
      : "desktop",
  );
}

export function trackAuthModalOpen(params: { mode: "login" | "signup"; nextPath: string }): void {
  trackClientEvent(
    createAnalyticsPayload({
      eventName: ANALYTICS_EVENTS.auth_modal_open,
      source: ANALYTICS_SOURCES.auth_modal,
      pagePath: getPagePath(),
      deviceType: getDeviceType(),
      label: params.mode,
      href: params.nextPath,
      metadata: { mode: params.mode, nextPath: params.nextPath },
    }),
  );
}

export function trackAuthKakaoCtaClick(params: {
  mode: "login" | "signup";
  nextPath: string;
}): void {
  trackClientEvent(
    createAnalyticsPayload({
      eventName: ANALYTICS_EVENTS.auth_kakao_cta_click,
      source: ANALYTICS_SOURCES.auth_modal,
      pagePath: getPagePath(),
      deviceType: getDeviceType(),
      label: params.mode,
      href: params.nextPath,
      metadata: { mode: params.mode, nextPath: params.nextPath },
    }),
  );
}

export function trackAuthIdentifierContinue(params: {
  intent: "login" | "signup";
  status: string;
}): void {
  trackClientEvent(
    createAnalyticsPayload({
      eventName: ANALYTICS_EVENTS.auth_identifier_continue,
      source: ANALYTICS_SOURCES.auth_modal,
      pagePath: getPagePath(),
      deviceType: getDeviceType(),
      label: params.status,
      metadata: { intent: params.intent, status: params.status },
    }),
  );
}

export function trackAuthSignupSuccess(params: {
  method: "identifier" | "kakao";
  nextPath: string;
}): void {
  trackClientEvent(
    createAnalyticsPayload({
      eventName: ANALYTICS_EVENTS.auth_signup_success,
      source: ANALYTICS_SOURCES.auth_modal,
      pagePath: getPagePath(),
      deviceType: getDeviceType(),
      label: params.method,
      href: params.nextPath,
      metadata: { method: params.method, nextPath: params.nextPath },
    }),
  );
}

export function trackAuthLoginSuccess(params: { nextPath: string }): void {
  trackClientEvent(
    createAnalyticsPayload({
      eventName: ANALYTICS_EVENTS.auth_login_success,
      source: ANALYTICS_SOURCES.auth_modal,
      pagePath: getPagePath(),
      deviceType: getDeviceType(),
      href: params.nextPath,
      metadata: { nextPath: params.nextPath },
    }),
  );
}

export function trackMembershipBenefitCtaClick(params: {
  label: string;
  href: string;
  section?: string;
}): void {
  trackClientEvent(
    createAnalyticsPayload({
      eventName: ANALYTICS_EVENTS.membership_benefit_cta_click,
      source: ANALYTICS_SOURCES.mypage_membership,
      pagePath: getPagePath(),
      deviceType: getDeviceType(),
      section: params.section ?? "mypage_benefit",
      label: params.label,
      href: params.href,
    }),
  );
}
