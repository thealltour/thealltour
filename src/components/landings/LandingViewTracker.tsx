"use client";

import { useEffect, useRef } from "react";
import { trackLandingView } from "@/lib/analytics/trackLandingQuoteFunnel";
import type { AdminLandingDetail } from "@/types/adminLanding";

type LandingViewTrackerProps = {
  landing: AdminLandingDetail;
  sourcePath: string;
};

export function LandingViewTracker({ landing, sourcePath }: LandingViewTrackerProps) {
  const sent = useRef(false);

  useEffect(() => {
    if (sent.current) return;
    sent.current = true;
    trackLandingView(landing, sourcePath);
  }, [landing, sourcePath]);

  return null;
}
