"use client";

import { useId, useState } from "react";
import { ChevronDown } from "lucide-react";

const STEPS = [
  {
    title: "1단계 — ZIP 파일 다운로드",
    body: "위의 [익스텐션.zip 다운로드] 버튼을 눌러 ZIP 파일을 PC에 저장합니다.",
  },
  {
    title: "2단계 — ZIP 압축 풀기",
    body: "다운로드한 ZIP 파일을 원하는 폴더에 압축 해제합니다. (예: 바탕화면\\thealltour-extension)",
  },
  {
    title: "3단계 — Chrome에 수동 설치",
    body: [
      "Chrome 주소창에 chrome://extensions 입력 후 Enter",
      "우측 상단 '개발자 모드' 켜기",
      "'압축해제된 확장 프로그램을 로드합니다' 클릭",
      "압축 해제한 폴더를 선택하면 설치 완료",
    ].join("\n"),
  },
  {
    title: "4단계 — 이미 설치한 경우 (업데이트)",
    body: [
      "새 ZIP을 받아 기존에 로드한 폴더에 압축을 풀어 덮어씁니다. (폴더를 바꾸면 Chrome이 이전 경로를 찾지 못합니다.)",
      "chrome://extensions에서 해당 확장 카드의 새로고침(원형 화살표)을 누릅니다.",
      "카드에 표시된 버전이 이 페이지 다운로드 카드와 같은지 확인합니다. Chrome은 압축 해제 확장을 자동으로 올리지 않습니다.",
    ].join("\n"),
  },
] as const;

export default function ChromeExtensionInstallGuide() {
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
        <span className="text-sm font-semibold text-[var(--text-primary)]">
          크롬 수동 설치·업데이트 가이드
        </span>
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
          {STEPS.map((step) => (
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
