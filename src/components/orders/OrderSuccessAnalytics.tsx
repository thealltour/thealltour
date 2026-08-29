"use client";

import { useEffect, useRef } from "react";
import { trackOrderSuccessView } from "@/lib/analytics/trackCheckoutEvents";

export function OrderSuccessAnalytics({
  hasBookingNumber,
  isMember,
}: {
  hasBookingNumber: boolean;
  isMember: boolean;
}) {
  const firedRef = useRef(false);

  useEffect(() => {
    if (firedRef.current) return;
    firedRef.current = true;
    trackOrderSuccessView({ hasBookingNumber, isMember });
  }, [hasBookingNumber, isMember]);

  return null;
}
