"use client";

import { useState } from "react";
import { Info } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";

/**
 * Compact SEO identity above PlannerWizard — keep vertical budget small on mobile.
 */
export function PlannerLandingIntro() {
  const [infoOpen, setInfoOpen] = useState(false);

  return (
    <>
      <header className="mb-2 sm:mb-3">
        <div className="flex items-center justify-between gap-3">
          <h1 className="heading-display text-[1.25rem] font-bold leading-tight tracking-[-0.02em] text-[var(--foreground)] sm:text-[1.375rem]">
            AI 자유여행 플래너
          </h1>
          <button
            type="button"
            onClick={() => setInfoOpen(true)}
            aria-label="AI 자유여행 플래너 안내"
            className="inline-flex size-10 shrink-0 items-center justify-center rounded-md text-[var(--text-muted)] transition-colors hover:bg-[var(--surface-muted)] hover:text-[var(--foreground)] focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-[var(--focus-ring)]"
          >
            <Info className="size-5" aria-hidden />
          </button>
        </div>
        <p className="mt-1 type-caption leading-snug text-[var(--text-muted)] sm:type-small">
          출발지·목적지·여행 조건을 입력해 일정 초안을 만들어보세요.
        </p>
      </header>

      <Modal
        isOpen={infoOpen}
        onClose={() => setInfoOpen(false)}
        aria-label="AI 자유여행 플래너 안내"
        className="w-full max-w-md space-y-4"
      >
        <div className="space-y-2">
          <h2 className="type-h3 text-[var(--foreground)]">AI 자유여행 플래너</h2>
          <p className="type-small leading-relaxed text-[var(--text-secondary)]">
            출발지와 목적지, 여행 날짜, 동행, 취향을 알려주시면 여행 조건에 맞춘 일정 초안을
            만들어드려요.
          </p>
          <p className="type-small leading-relaxed text-[var(--text-secondary)]">
            완성된 일정은 다시 수정할 수 있고, 이용 가능한 경우 항공권 등 여행 준비도 이어서 확인할
            수 있습니다.
          </p>
        </div>
        <Button type="button" variant="primary" className="w-full" onClick={() => setInfoOpen(false)}>
          확인
        </Button>
      </Modal>
    </>
  );
}
