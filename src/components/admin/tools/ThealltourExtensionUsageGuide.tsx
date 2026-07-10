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
    title: "2. API 주소",
    body: [
      "관리자에서 다운로드한 ZIP 설치 시 API 주소는 `https://thealltour.com`으로 자동 설정됩니다.",
      "로컬에서 `tools/thealltour_extension` 폴더를 압축 해제 로드하면 기본값은 `http://localhost:3000` 입니다.",
      "다른 도메인을 쓸 때만 Extension storage의 `apiBaseUrl`을 수동 변경하세요.",
    ].join("\n"),
  },
  {
    title: "3. 하나투어 — 부모탭 유지 (출발일·일정 수집)",
    body: [
      "하나투어 상품은 출발일·여행일정을 수집할 때 같은 Chrome 창의 부모탭(검색·목록·달력 페이지)을 참조합니다. 부모탭을 닫으면 1년치 출발일·일정 수집이 제대로 되지 않을 수 있습니다.",
      "① 하나투어 검색·패키지 목록 페이지(예: all-search)를 부모탭으로 엽니다.",
      "② 부모탭에서 해당 상품의 출발일 달력(일정 스트립)을 엽니다.",
      "③ 달력에서 원하는 출발일(일정) 하나를 클릭해 상품 상세 페이지(/trp/pkg/...)로 이동합니다.",
      "④ 상세 페이지에서 thealltour_extension 아이콘을 클릭합니다.",
      "※ 상세 페이지는 부모탭에서 일정을 클릭해 연 같은 창 탭이어야 합니다.",
      "진행 오버레이에 「부모 탭 출발일·가격 수집…」「일정 N일차 수집 중…」 등이 표시되면 정상 동작입니다.",
    ].join("\n"),
  },
  {
    title: "4. 상품 임포트",
    body: [
      "모두투어: 상품 상세 페이지를 연 뒤 바로 thealltour_extension 아이콘을 클릭합니다.",
      "하나투어: 위 3번(부모탭 유지) 절차를 완료한 뒤 상세 페이지에서 아이콘을 클릭합니다.",
      "우측 하단 진행 오버레이(다크 배경 + 그라데이션 바)로 수집·AI 분석 진행 상황을 확인합니다.",
      "완료 alert에 상품 ID가 표시되면 관리자 상품 목록에서 편집을 이어갑니다.",
    ].join("\n"),
  },
  {
    title: "5. 문제 해결",
    body: [
      "네트워크 오류: Chrome에서 https://thealltour.com/theall_manager_only 로그인 후 익스텐션을 새로고침하세요. 로컬 주소(localhost)가 남아 있으면 익스텐션을 제거 후 관리자에서 ZIP을 다시 설치하세요.",
      "401 오류: 관리자 로그인 후 다시 시도하세요.",
      "이미 등록된 URL: 기존 상품 ID가 alert로 안내됩니다.",
      "출발일·일정 누락: 부모탭이 같은 Chrome 창에 열려 있는지, 달력에서 출발일(일정)을 클릭해 상세 페이지로 들어왔는지 확인하세요.",
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
