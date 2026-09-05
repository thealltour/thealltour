/**
 * Free Travel Planner analytics (PR-1: landing_view + started only).
 * Reuses trackClientAnalytics — UTM/first-touch remain via FirstTouchInit + existing pipeline.
 */

import { ANALYTICS_EVENTS, ANALYTICS_SOURCES } from "./events";
import { trackClientAnalytics } from "./trackEvent";

export function trackPlannerLandingView(): void {
  trackClientAnalytics({
    eventName: ANALYTICS_EVENTS.planner_landing_view,
    source: ANALYTICS_SOURCES.planner,
    section: "planner_entry",
    label: "planner_landing",
  });
}

export function trackPlannerStarted(params: {
  sessionId: string;
  destination: string;
  sourceProductId?: string | null;
}): void {
  trackClientAnalytics({
    eventName: ANALYTICS_EVENTS.planner_started,
    source: ANALYTICS_SOURCES.planner,
    section: "planner_entry",
    label: "planner_started",
    productId: params.sourceProductId?.trim() || null,
    metadata: {
      sessionId: params.sessionId,
      destination: params.destination.trim().slice(0, 120),
    },
  });
}
