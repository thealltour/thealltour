/**
 * 홈 전환 UX 계측 — Quick Action, Promo, Section More.
 */

import { ANALYTICS_EVENTS, ANALYTICS_SOURCES } from "./events";
import {
  createAnalyticsPayload,
  inferDeviceType,
  normalizeAnalyticsHref,
  normalizeAnalyticsLabel,
} from "./payload";
import { trackClientEvent } from "./trackClientEvent";

function getPagePath(): string | null {
  if (typeof window === "undefined") return null;
  return window.location.pathname;
}

function getDeviceType() {
  return inferDeviceType(undefined, typeof window !== "undefined" ? window.innerWidth : undefined);
}

export function trackHomeQuickActionClick(params: {
  label: string;
  href: string;
  position: number;
}): void {
  trackClientEvent(
    createAnalyticsPayload({
      eventName: ANALYTICS_EVENTS.home_quick_action_click,
      source: ANALYTICS_SOURCES.home_hero,
      pagePath: getPagePath(),
      deviceType: getDeviceType(),
      label: normalizeAnalyticsLabel(params.label),
      href: normalizeAnalyticsHref(params.href),
      position: params.position,
    }),
  );
}

export function trackHomeSectionMoreClick(params: {
  section: string;
  label: string;
  href: string;
}): void {
  trackClientEvent(
    createAnalyticsPayload({
      eventName: ANALYTICS_EVENTS.home_section_more_click,
      source: ANALYTICS_SOURCES.home_section,
      pagePath: getPagePath(),
      deviceType: getDeviceType(),
      section: params.section,
      label: normalizeAnalyticsLabel(params.label),
      href: normalizeAnalyticsHref(params.href),
    }),
  );
}

export function trackHomePromoImpression(): void {
  trackClientEvent(
    createAnalyticsPayload({
      eventName: ANALYTICS_EVENTS.home_promo_impression,
      source: ANALYTICS_SOURCES.home_promo_banner,
      pagePath: getPagePath(),
      deviceType: getDeviceType(),
    }),
  );
}

export function trackHomePromoClick(): void {
  trackClientEvent(
    createAnalyticsPayload({
      eventName: ANALYTICS_EVENTS.home_promo_click,
      source: ANALYTICS_SOURCES.home_promo_banner,
      pagePath: getPagePath(),
      deviceType: getDeviceType(),
    }),
  );
}

export function trackHomePromoDismiss(): void {
  trackClientEvent(
    createAnalyticsPayload({
      eventName: ANALYTICS_EVENTS.home_promo_dismiss,
      source: ANALYTICS_SOURCES.home_promo_banner,
      pagePath: getPagePath(),
      deviceType: getDeviceType(),
    }),
  );
}

export function trackHomeGolfScheduleClick(params: { href: string; label?: string }): void {
  trackClientEvent(
    createAnalyticsPayload({
      eventName: ANALYTICS_EVENTS.home_golf_schedule_click,
      source: ANALYTICS_SOURCES.home_section,
      pagePath: getPagePath(),
      deviceType: getDeviceType(),
      section: "golf_schedule",
      label: normalizeAnalyticsLabel(params.label ?? "골프 출발 일정 확인"),
      href: normalizeAnalyticsHref(params.href),
    }),
  );
}
