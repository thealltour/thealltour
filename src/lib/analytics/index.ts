/**
 * Public analytics entry — prefer importing from `@/lib/analytics`.
 *
 * Client tracking:
 * - `trackClientEvent` — low-level client event helper
 * - `trackClientAnalytics` — preferred wrapper used by most UI
 * - `trackLandingView` / `trackLandingCtaClick` / `trackQuoteView` — landing funnel
 * Domain-specific funnels (e.g. kakao sync) may import their own `track*.ts` modules;
 * keep event names in `events.ts` / `types.ts` as the single source of truth.
 */


export type {
  AnalyticsEventName,
  AnalyticsSource,
  AnalyticsPayload,
} from "./types";

export { ANALYTICS_EVENTS, ANALYTICS_SOURCES } from "./events";

export {
  createAnalyticsPayload,
  normalizeAnalyticsHref,
  normalizeAnalyticsLabel,
  inferDeviceType,
} from "./payload";

export { saveAnalyticsEvent } from "./saveAnalyticsEvent";
export type { SaveAnalyticsEventResult } from "./saveAnalyticsEvent";

export { trackClientEvent } from "./trackClientEvent";

export { trackClientAnalytics } from "./trackEvent";
export {
  landingSlugFromSourcePath,
  ensureLandingSourcePath,
} from "./createAnalyticsPayload";
export {
  trackLandingView,
  trackLandingCtaClick,
  trackQuoteView,
} from "./trackLandingQuoteFunnel";
export { persistAnalyticsEventAdmin } from "./persistAnalyticsEventAdmin";
