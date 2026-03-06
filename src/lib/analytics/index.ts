/**
 * 헤더/검색/CTA 계측용 analytics — 타입·상수·유틸 진입점.
 * 저장·전송은 연결하지 않음. 기존 동작 변경 없음.
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
