"use client";

import { useEffect, useRef, useState } from "react";

export const PANEL_TRANSITION_MS = 200;

/**
 * framer-motion 등 애니메이션 라이브러리를 새로 추가하지 않고, 순수 CSS 트랜지션으로
 * 열림/닫힘 애니메이션을 구현하기 위한 마운트 상태 관리 훅.
 * open=true → 즉시 마운트 후 다음 프레임에 entered=true로 전환(트랜지션 트리거).
 * open=false → entered=false로 되돌린 뒤 트랜지션 시간만큼 대기 후 언마운트.
 */
export function usePanelPresence(open: boolean, durationMs = PANEL_TRANSITION_MS) {
  const [mounted, setMounted] = useState(open);
  const [entered, setEntered] = useState(false);
  // 렌더링 중 이전 prop 값을 state로 추적해 비교하는 React 공식 패턴("Adjusting state when a prop
  // changes"). ref 대신 state를 쓰므로 렌더 중 ref 접근/변경 금지 규칙(react-hooks/refs)에 걸리지
  // 않고, effect 본문에서 직접 setState하지 않아 react-hooks/set-state-in-effect도 피할 수 있다.
  const [prevOpen, setPrevOpen] = useState(open);
  const unmountTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  if (open !== prevOpen) {
    setPrevOpen(open);
    if (open) {
      setMounted(true);
    } else {
      setEntered(false);
    }
  }

  useEffect(() => {
    if (!open) {
      unmountTimerRef.current = setTimeout(() => setMounted(false), durationMs);
      return () => {
        if (unmountTimerRef.current) clearTimeout(unmountTimerRef.current);
      };
    }

    if (unmountTimerRef.current) {
      clearTimeout(unmountTimerRef.current);
      unmountTimerRef.current = null;
    }
    // 트랜지션이 트리거되려면 "닫힌 스타일"이 한 번 페인트된 뒤 "열린 스타일"로 바뀌어야 하므로
    // 더블 rAF로 한 프레임 이상 지연시켜 entered=true를 적용한다.
    let raf2 = 0;
    const raf1 = requestAnimationFrame(() => {
      raf2 = requestAnimationFrame(() => setEntered(true));
    });
    return () => {
      cancelAnimationFrame(raf1);
      cancelAnimationFrame(raf2);
    };
  }, [open, durationMs]);

  return { mounted, entered };
}
