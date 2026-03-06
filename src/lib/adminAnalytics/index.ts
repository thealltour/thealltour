/**
 * 관리자 analytics 읽기 전용 집계 레이어 진입점.
 * 기존 UI/라우트에는 연결하지 않음. 후속 PR에서 /api/admin/dashboard, taxonomy 화면에서 import.
 */

export { parseAdminDateRange } from "./dateRange";
export type { AdminDateRangeResult } from "./dateRange";

export {
  buildAnalyticsDateRangeFilter,
  toSafeCount,
  toTopItems,
  toSearchKeywordStats,
  getAdminAnalyticsOverview,
  getTopAnalyticsItemsByEvent,
  getSearchKeywordStats,
  getTaxonomyAnalyticsMetrics,
} from "./aggregation";

export type {
  AnalyticsEventSource,
  AnalyticsSummaryCounts,
  AnalyticsTopItem,
  AnalyticsSearchKeywordStat,
  AnalyticsTaxonomyMetric,
  AdminAnalyticsOverview,
  AdminAnalyticsQueryParams,
} from "./types";
