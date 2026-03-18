"use client";

import { useEffect } from "react";
import { initFirstTouch } from "@/lib/analytics/firstTouch";

export function FirstTouchInit() {
  useEffect(() => {
    initFirstTouch();
  }, []);
  return null;
}
