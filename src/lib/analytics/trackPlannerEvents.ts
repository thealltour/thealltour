/**
 * Free Travel Planner analytics.
 */

import { ANALYTICS_EVENTS, ANALYTICS_SOURCES } from "./events";
import { trackClientAnalytics } from "./trackEvent";
import { draftTripDurationDays } from "@/lib/planner/dates";
import type {
  PlannerCompanionType,
  PlannerDraftInput,
  PlannerPace,
  PlannerSummaryEditSection,
} from "@/types/planner";

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
      tripDurationDays: draftTripDurationDays(input),
      dateMode: input.dates.mode,
      adultCount: input.travelers.adults,
      childCount: input.travelers.children,
      companionType: input.companionType as PlannerCompanionType,
      interestCount: input.interests.length,
      pace: input.pace as PlannerPace,
      hasBudget: input.budget.amount != null,
      budgetStyle: input.budget.style,
      hasThemeRequest: Boolean(input.themeRequest.trim()),
      hasAdditionalRequest: Boolean(input.additionalRequest.trim()),
    },
  });
}

export function trackPlannerSummaryEditClicked(params: {
  sessionId: string;
  section: PlannerSummaryEditSection;
}): void {
  trackClientAnalytics({
    eventName: ANALYTICS_EVENTS.planner_summary_edit_clicked,
    source: ANALYTICS_SOURCES.planner,
    section: "planner_wizard",
    label: "planner_summary_edit_clicked",
    metadata: {
      sessionId: params.sessionId,
      section: params.section,
    },
  });
}

type GenerationMetaBase = {
  sessionId: string;
  input: PlannerDraftInput;
  sourceProductId?: string | null;
};

function generationBaseMetadata(params: GenerationMetaBase) {
  const { input } = params;
  return {
    sessionId: params.sessionId,
    destination: input.destination.text.trim().slice(0, 120),
    tripDurationDays: draftTripDurationDays(input),
    dateMode: input.dates.mode,
    companionType: input.companionType as PlannerCompanionType,
    pace: input.pace as PlannerPace,
    interestCount: input.interests.length,
  };
}

export function trackPlannerGenerationStarted(params: GenerationMetaBase): void {
  trackClientAnalytics({
    eventName: ANALYTICS_EVENTS.planner_generation_started,
    source: ANALYTICS_SOURCES.planner,
    section: "planner_generation",
    label: "planner_generation_started",
    productId: params.sourceProductId?.trim() || null,
    metadata: generationBaseMetadata(params),
  });
}

export function trackPlannerPlanGenerated(
  params: GenerationMetaBase & { dayCount: number; totalItemCount: number },
): void {
  trackClientAnalytics({
    eventName: ANALYTICS_EVENTS.planner_plan_generated,
    source: ANALYTICS_SOURCES.planner,
    section: "planner_generation",
    label: "planner_plan_generated",
    productId: params.sourceProductId?.trim() || null,
    metadata: {
      ...generationBaseMetadata(params),
      dayCount: params.dayCount,
      totalItemCount: params.totalItemCount,
    },
  });
}

export function trackPlannerGenerationFailed(
  params: GenerationMetaBase & { failureCategory?: string | null },
): void {
  trackClientAnalytics({
    eventName: ANALYTICS_EVENTS.planner_generation_failed,
    source: ANALYTICS_SOURCES.planner,
    section: "planner_generation",
    label: "planner_generation_failed",
    productId: params.sourceProductId?.trim() || null,
    metadata: {
      ...generationBaseMetadata(params),
      failureCategory: params.failureCategory ?? null,
    },
  });
}

type SaveMetaBase = {
  sessionId: string;
  destination?: string | null;
  sourceProductId?: string | null;
};

export function trackPlannerSaveClicked(
  params: SaveMetaBase & { wasAlreadyLoggedIn: boolean },
): void {
  trackClientAnalytics({
    eventName: ANALYTICS_EVENTS.planner_save_clicked,
    source: ANALYTICS_SOURCES.planner,
    section: "planner_save",
    label: "planner_save_clicked",
    productId: params.sourceProductId?.trim() || null,
    metadata: {
      sessionId: params.sessionId,
      destination: params.destination?.trim().slice(0, 120) || null,
      wasAlreadyLoggedIn: params.wasAlreadyLoggedIn,
    },
  });
}

export function trackPlannerKakaoLoginStarted(params: SaveMetaBase): void {
  trackClientAnalytics({
    eventName: ANALYTICS_EVENTS.planner_kakao_login_started,
    source: ANALYTICS_SOURCES.planner,
    section: "planner_save",
    label: "planner_kakao_login_started",
    productId: params.sourceProductId?.trim() || null,
    metadata: {
      sessionId: params.sessionId,
      destination: params.destination?.trim().slice(0, 120) || null,
    },
  });
}

export function trackPlannerSaved(
  params: SaveMetaBase & {
    wasAlreadyLoggedIn: boolean;
    saveMethod: "kakao" | "existing_member";
  },
): void {
  trackClientAnalytics({
    eventName: ANALYTICS_EVENTS.planner_saved,
    source: ANALYTICS_SOURCES.planner,
    section: "planner_save",
    label: "planner_saved",
    productId: params.sourceProductId?.trim() || null,
    metadata: {
      sessionId: params.sessionId,
      destination: params.destination?.trim().slice(0, 120) || null,
      wasAlreadyLoggedIn: params.wasAlreadyLoggedIn,
      saveMethod: params.saveMethod,
    },
  });
}

export function trackPlannerSavedListViewed(params: { savedPlanCount: number }): void {
  trackClientAnalytics({
    eventName: ANALYTICS_EVENTS.planner_saved_list_viewed,
    source: ANALYTICS_SOURCES.planner,
    section: "planner_saved_list",
    label: "planner_saved_list_viewed",
    metadata: {
      savedPlanCount: params.savedPlanCount,
    },
  });
}

export function trackPlannerSavedPlanOpened(params: {
  sessionId: string;
  destination?: string | null;
  sourceProductId?: string | null;
}): void {
  trackClientAnalytics({
    eventName: ANALYTICS_EVENTS.planner_saved_plan_opened,
    source: ANALYTICS_SOURCES.planner,
    section: "planner_saved_list",
    label: "planner_saved_plan_opened",
    productId: params.sourceProductId?.trim() || null,
    metadata: {
      sessionId: params.sessionId,
      destination: params.destination?.trim().slice(0, 120) || null,
    },
  });
}

type EditMetaBase = {
  sessionId: string;
  destination?: string | null;
  sourceProductId?: string | null;
  instructionLength: number;
  status: "generated" | "saved";
};

function editBaseMetadata(params: EditMetaBase) {
  return {
    sessionId: params.sessionId,
    destination: params.destination?.trim().slice(0, 120) || null,
    instructionLength: params.instructionLength,
    status: params.status,
  };
}

export function trackPlannerEditStarted(params: EditMetaBase): void {
  trackClientAnalytics({
    eventName: ANALYTICS_EVENTS.planner_edit_started,
    source: ANALYTICS_SOURCES.planner,
    section: "planner_edit",
    label: "planner_edit_started",
    productId: params.sourceProductId?.trim() || null,
    metadata: editBaseMetadata(params),
  });
}

export function trackPlannerEditSucceeded(
  params: EditMetaBase & { dayCount: number },
): void {
  trackClientAnalytics({
    eventName: ANALYTICS_EVENTS.planner_edit_succeeded,
    source: ANALYTICS_SOURCES.planner,
    section: "planner_edit",
    label: "planner_edit_succeeded",
    productId: params.sourceProductId?.trim() || null,
    metadata: {
      ...editBaseMetadata(params),
      dayCount: params.dayCount,
    },
  });
}

export function trackPlannerEditFailed(params: EditMetaBase): void {
  trackClientAnalytics({
    eventName: ANALYTICS_EVENTS.planner_edit_failed,
    source: ANALYTICS_SOURCES.planner,
    section: "planner_edit",
    label: "planner_edit_failed",
    productId: params.sourceProductId?.trim() || null,
    metadata: editBaseMetadata(params),
  });
}

export function trackPlannerEnrichmentLoaded(params: {
  sessionId: string;
  resolvedPlaceCount: number;
  ambiguousPlaceCount: number;
  unresolvedPlaceCount: number;
  weatherAvailability: string;
}): void {
  trackClientAnalytics({
    eventName: ANALYTICS_EVENTS.planner_enrichment_loaded,
    source: ANALYTICS_SOURCES.planner,
    section: "planner_enrichment",
    label: "planner_enrichment_loaded",
    metadata: {
      sessionId: params.sessionId,
      resolvedPlaceCount: params.resolvedPlaceCount,
      ambiguousPlaceCount: params.ambiguousPlaceCount,
      unresolvedPlaceCount: params.unresolvedPlaceCount,
      weatherAvailability: params.weatherAvailability,
    },
  });
}

export function trackPlannerEnrichmentFailed(params: { sessionId: string }): void {
  trackClientAnalytics({
    eventName: ANALYTICS_EVENTS.planner_enrichment_failed,
    source: ANALYTICS_SOURCES.planner,
    section: "planner_enrichment",
    label: "planner_enrichment_failed",
    metadata: {
      sessionId: params.sessionId,
    },
  });
}

export function trackPlannerMapLoaded(params: {
  sessionId: string;
  dayNumber: number;
  mappedPlaceCount: number;
}): void {
  trackClientAnalytics({
    eventName: ANALYTICS_EVENTS.planner_map_loaded,
    source: ANALYTICS_SOURCES.planner,
    section: "planner_map",
    label: "planner_map_loaded",
    metadata: {
      sessionId: params.sessionId,
      dayNumber: params.dayNumber,
      mappedPlaceCount: params.mappedPlaceCount,
    },
  });
}

export function trackPlannerRoutesLoaded(params: {
  sessionId: string;
  resolvedRouteCount: number;
  fallbackRouteCount: number;
}): void {
  trackClientAnalytics({
    eventName: ANALYTICS_EVENTS.planner_routes_loaded,
    source: ANALYTICS_SOURCES.planner,
    section: "planner_routes",
    label: "planner_routes_loaded",
    metadata: {
      sessionId: params.sessionId,
      resolvedRouteCount: params.resolvedRouteCount,
      fallbackRouteCount: params.fallbackRouteCount,
    },
  });
}

export function trackPlannerRoutesFailed(params: { sessionId: string }): void {
  trackClientAnalytics({
    eventName: ANALYTICS_EVENTS.planner_routes_failed,
    source: ANALYTICS_SOURCES.planner,
    section: "planner_routes",
    label: "planner_routes_failed",
    metadata: {
      sessionId: params.sessionId,
    },
  });
}
