/**
 * Free Travel Planner analytics.
 */

import { ANALYTICS_EVENTS, ANALYTICS_SOURCES } from "./events";
import { trackClientAnalytics } from "./trackEvent";
import type { PlannerCompanionType, PlannerDraftInput, PlannerPace } from "@/types/planner";

function tripDurationDays(startDate: string, endDate: string): number | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(startDate) || !/^\d{4}-\d{2}-\d{2}$/.test(endDate)) {
    return null;
  }
  const start = Date.parse(`${startDate}T00:00:00Z`);
  const end = Date.parse(`${endDate}T00:00:00Z`);
  if (!Number.isFinite(start) || !Number.isFinite(end) || end < start) return null;
  return Math.round((end - start) / 86_400_000) + 1;
}

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

export function trackPlannerInputCompleted(params: {
  sessionId: string;
  input: PlannerDraftInput;
  sourceProductId?: string | null;
}): void {
  const { input } = params;
  trackClientAnalytics({
    eventName: ANALYTICS_EVENTS.planner_input_completed,
    source: ANALYTICS_SOURCES.planner,
    section: "planner_wizard",
    label: "planner_input_completed",
    productId: params.sourceProductId?.trim() || null,
    metadata: {
      sessionId: params.sessionId,
      destination: input.destination.text.trim().slice(0, 120),
      tripDurationDays: tripDurationDays(input.dates.startDate, input.dates.endDate),
      adultCount: input.travelers.adults,
      childCount: input.travelers.children,
      companionType: input.companionType as PlannerCompanionType,
      interestCount: input.interests.length,
      pace: input.pace as PlannerPace,
      hasBudget: input.budget.amount != null,
      hasAdditionalRequest: Boolean(input.additionalRequest.trim()),
    },
  });
}
