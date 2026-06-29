"use client";

import { useId, useState } from "react";
import { ChevronDown } from "lucide-react";

const USAGE_STEPS = [
  {
    title: "1. 사전 준비",
    body: [
      "동일 Chrome 브라우저에서 더올투어 관리자에 로그인합니다.",
      "로컬 개발 시 `npm run dev`로 API 서버를 실행합니다.",
      "서버 `.env`에 `OPENAI_API_KEY`가 설정되어 있어야 AI 파싱이 동작합니다.",
    ].join("\n"),
  },
  {
    title: "2. API 주소 설정 (운영 사용 시)",
    body: [
      "기본값은 `http://localhost:3000` 입니다.",
      "운영 도메인 사용 시 Chrome 개발자 도구 → Application → Extension storage에서 `apiBaseUrl`을 `https://thealltour.com`으로 설정하세요.",
      "또는 익스텐션 Service Worker 콘솔에서:",
      'chrome.storage.sync.set({ apiBaseUrl: "https://thealltour.com" });',
    ].join("\n"),
  },
  {
    title: "3. 상품 임포트",
    body: [
      "하나투어(`/trp/pkg/...`) 또는 모두투어 상품 상세 페이지를 엽니다.",
      "툴바의 thealltour_extension 아이콘을 클릭합니다.",
      "우측 하단 진행 오버레이(다크 배경 + 그라데이션 바)로 수집·AI 분석 진행 상황을 확인합니다.",
      "완료 alert에 상품 ID가 표시되면 관리자 상품 목록에서 편집을 이어갑니다.",
    ].join("\n"),
  },
  {
    title: "4. 문제 해결",
    body: [
      "401 오류: 관리자 로그인 후 다시 시도하세요.",
      "이미 등록된 URL: 기존 상품 ID가 alert로 안내됩니다.",
      "익스텐션 없이 테스트: 관리자 → 상품 → 상품 등록(WEB) 메뉴에서 동일 API를 수동 호출할 수 있습니다.",
    ].join("\n"),
  },
] as const;

export default function ThealltourExtensionUsageGuide() {
  const [open, setOpen] = useState(false);
  const contentId = useId().replace(/:/g, "-");
  const buttonId = useId().replace(/:/g, "-");

  return (
    <div className="rounded-xl border border-[var(--border)] bg-[var(--surface-muted)]/40">
      <button
        type="button"
        id={buttonId}
        aria-expanded={open}
        aria-controls={contentId}
        onClick={() => setOpen((prev) => !prev)}
        className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left"
      >
        <span className="text-sm font-semibold text-[var(--text-primary)]">사용 매뉴얼</span>
        <ChevronDown
          className={`h-4 w-4 shrink-0 text-[var(--text-muted)] transition-transform ${open ? "rotate-180" : ""}`}
        />
      </button>
      {open ? (
        <div
          id={contentId}
          role="region"
          aria-labelledby={buttonId}
          className="space-y-4 border-t border-[var(--border)] px-4 py-4"
        >
          {USAGE_STEPS.map((step) => (
            <div key={step.title}>
              <p className="text-sm font-semibold text-[var(--text-primary)]">{step.title}</p>
              <p className="mt-1 whitespace-pre-wrap text-sm text-[var(--text-secondary)]">{step.body}</p>
            </div>
          ))}
        </div>
      ) : null}
    </div>
  );
}
