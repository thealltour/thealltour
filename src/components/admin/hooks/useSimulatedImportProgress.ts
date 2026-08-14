"use client";

import { useCallback, useEffect, useRef, useState } from "react";

type ProgressState = {
  open: boolean;
  percent: number;
  label: string;
};

const INITIAL: ProgressState = { open: false, percent: 0, label: "" };

export function useSimulatedImportProgress() {
  const [state, setState] = useState<ProgressState>(INITIAL);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const hideTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clearTimers = useCallback(() => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    if (hideTimerRef.current) {
      clearTimeout(hideTimerRef.current);
      hideTimerRef.current = null;
    }
  }, []);

  useEffect(() => clearTimers, [clearTimers]);

  const start = useCallback(() => {
    clearTimers();
    setState({ open: true, percent: 5, label: "준비 중…" });

    let percent = 5;
    let tick = 0;
    const labels = [
      "AI 메타 분석 중…",
      "AI 일정 분석 중…",
      "사진 업로드·배치 중…",
    ];

    timerRef.current = setInterval(() => {
      tick += 1;
      let label: string;
      if (percent < 45) {
        label = labels[0];
        percent = Math.min(45, percent + 2);
      } else if (percent < 75) {
        label = labels[1];
        percent = Math.min(75, percent + 2);
      } else if (percent < 88) {
        label = labels[2];
        percent += 1;
      } else {
        label = labels[2];
        percent = Math.min(95, percent + (tick % 3 === 0 ? 1 : 0));
      }
      setState({ open: true, percent, label });
    }, 1200);
  }, [clearTimers]);

  const complete = useCallback(() => {
    clearTimers();
    setState({ open: true, percent: 100, label: "등록 완료" });
    hideTimerRef.current = setTimeout(() => {
      setState(INITIAL);
    }, 1000);
  }, [clearTimers]);

  const stop = useCallback(() => {
    clearTimers();
    setState(INITIAL);
  }, [clearTimers]);

  return {
    open: state.open,
    percent: state.percent,
    label: state.label,
    start,
    complete,
    stop,
  };
}
