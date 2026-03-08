"use client";

import { useRef, useCallback } from "react";
import {
  trackReviewExperimentImpression,
  trackReviewExperimentClick,
  trackReviewExperimentExpand,
  trackReviewExperimentViewSummary,
} from "@/lib/reviewExperimentTracking";
import type { ReviewExperimentKey, ReviewExperimentVariant } from "@/types/reviewExperiment";

type UseReviewExperimentTrackingOptions = {
  experimentKey: ReviewExperimentKey;
  variant: ReviewExperimentVariant;
  productId: string;
  /** impression 1회만 보내기 위해 사용 */
  enabled?: boolean;
};

export function useReviewExperimentTracking({
  experimentKey,
  variant,
  productId,
  enabled = true,
}: UseReviewExperimentTrackingOptions) {
  const impressionSent = useRef(false);

  const sendImpression = useCallback(() => {
    if (!enabled || !productId || impressionSent.current) return;
    impressionSent.current = true;
    trackReviewExperimentImpression(experimentKey, variant, productId);
  }, [enabled, productId, experimentKey, variant]);

  const trackClick = useCallback(
    (reviewId?: string) => {
      if (!enabled || !productId) return;
      trackReviewExperimentClick(experimentKey, variant, productId, reviewId);
    },
    [enabled, productId, experimentKey, variant],
  );

  const trackExpand = useCallback(
    (reviewId?: string) => {
      if (!enabled || !productId) return;
      trackReviewExperimentExpand(experimentKey, variant, productId, reviewId);
    },
    [enabled, productId, experimentKey, variant],
  );

  const trackViewSummary = useCallback(() => {
    if (!enabled || !productId) return;
    trackReviewExperimentViewSummary(experimentKey, variant, productId);
  }, [enabled, productId, experimentKey, variant]);

  return {
    sendImpression,
    trackClick,
    trackExpand,
    trackViewSummary,
  };
}
