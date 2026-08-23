"use client";

import { useId, useState } from "react";
import { ChevronDown } from "lucide-react";

const USAGE_STEPS = [
  {
    title: "1. 설치·업데이트 (현재 0.4.32)",
    body: [
      "Chrome 툴바의 thealltour_hanatour_collector 아이콘을 누르면 **독립 패널 창**이 열립니다. (탭을 바꿔도 패널이 유지됩니다.)",
      "권한: activeTab, scripting, storage, tabs, windows. 접속 허용: hanatour.com, thealltour.com, localhost:3000.",
      "Chrome은 압축 해제(개발자 모드) 확장을 자동 업데이트하지 않습니다. 이 페이지에서 새 ZIP을 받은 뒤, 기존 폴더에 덮어쓰고 chrome://extensions에서 해당 확장의 새로고침(원형 화살표)을 눌러야 새 버전이 적용됩니다.",
      "확장을 새로고침한 뒤에는 하나투어 상품 상세 탭도 한 번 새로고침한 다음 아이콘을 누르세요.",
      "버전은 chrome://extensions의 확장 카드와 이 페이지 다운로드 카드의 버전이 같아야 합니다. (예: 0.4.32)",
      "구버전 thealltour_extension / hanatour-extractor 는 폐기되었습니다. 남아 있으면 제거한 뒤 이 ZIP만 설치하세요.",
    ].join("\n"),
  },
  {
    title: "2. 사전 준비",
    body: [
      "같은 Chrome 브라우저에서 더올투어 관리자(https://www.thealltour.com/theall_manager_only)에 로그인합니다. 서버 전송 시 그 로그인 쿠키로 API를 호출합니다.",
      "AI 파싱은 서버에서 수행합니다. 기본 모델은 Google Gemini 3.5 Flash Lite이며, RPD/쿼터·혼잡 오류 시 Gemini 3.1 Flash Lite로 한 번 자동 전환합니다. 운영/로컬 서버에 `GOOGLE_GENERATIVE_AI_API_KEY` 또는 `GEMINI_API_KEY`가 있어야 합니다.",
      "Google 키가 없을 때만 `OPENAI_API_KEY`로 폴백합니다.",
      "로컬에서 `tools/thealltour_hanatour_collector` 폴더를 직접 로드할 때는 `npm run dev`로 API 서버를 켜 둡니다.",
    ].join("\n"),
  },
  {
    title: "3. API 주소",
    body: [
      "관리자에서 받은 ZIP을 설치하면 API 주소는 `https://thealltour.com`으로 자동 설정됩니다. 패널에 주소 입력 UI는 없습니다.",
      "로컬에서 `tools/thealltour_hanatour_collector` 폴더를 압축 해제 로드하면 기본값은 `http://localhost:3000` 입니다.",
      "예전 localhost 값이 남아 있으면 설치/시작 시 운영 주소로 고칩니다. 그래도 실패하면 확장을 제거한 뒤 이 페이지 ZIP을 다시 설치하세요.",
    ].join("\n"),
  },
  {
    title: "4. 패널에서 하는 일",
    body: [
      "하나투어 상품 상세(`/trp/pkg/...` 또는 `pkgCd`)를 연 뒤 툴바 아이콘 → 패널 창 → **수집**을 누릅니다.",
      "검색·리스트 탭만 열려 있으면 수집 버튼이 비활성입니다. 상세 페이지에서 실행하세요.",
      "수집 후 **Markdown / JSON 다운로드**로 AI 크레딧 없이 결과를 검증할 수 있습니다. (캘린더 0건이어도 파일은 받을 수 있습니다.)",
      "**서버 전송**은 캘린더(출발일)가 1건 이상일 때만 등록을 진행합니다. `importMode: full`(Gemini 메타·일정 파싱).",
      "다운로드 `.md`에서 `1일차`·식사·호텔명·`searchCalendar` 월별 출발일·요금을 확인하세요.",
    ].join("\n"),
  },
  {
    title: "5. 하나투어 — 출발일·일정",
    body: [
      "권장: 검색·패키지 목록(예: major-products) 탭을 연 채로, 달력에서 출발일 하나를 눌러 상세로 들어갑니다. 부모 탭을 닫지 마세요.",
      "캘린더 API가 비면 부모 탭 DOM 월/일 순회로 출발일을 모읍니다. (최대 수개월, 가격 배지 포함)",
      "일정: 일차 아코디언/탭을 펼친 뒤 관광지 설명·사진, 호텔(안내 문구·성급·영문명), 식사·항공 블록을 수집합니다.",
      "호텔 썸네일이 DOM에 없으면 이미지 0장인 것이 정상입니다. `상세보기` 링크 문구는 수집하지 않습니다.",
    ].join("\n"),
  },
  {
    title: "6. 문제 해결",
    body: [
      "네트워크/401: 같은 Chrome에서 관리자 로그인 → chrome://extensions에서 확장 새로고침. localhost가 남아 있으면 ZIP을 다시 설치하세요.",
      "이미 등록된 URL: 기존 상품 ID가 안내됩니다. 새로 만들지 않습니다.",
      "출발일 0건: 부모 탭이 같은 창에 있는지, 달력에서 날짜를 눌러 상세로 들어왔는지 확인하세요. Markdown 다운로드는 가능하고, 서버 전송만 막힙니다.",
      "검색 페이지에서는 수집할 수 없습니다: 상품 상세에서 아이콘을 누르세요.",
      "패널이 안 보이거나 바로 닫히면: 0.4.22 이후는 독립 창 패널입니다. 팝업이 아니라 별도 창이 뜨는지 확인하세요.",
      "이 페이지 버전이 안 바뀌면 브라우저 새로고침 후 다시 다운로드하세요. ZIP을 받아도 Chrome 확장이 안 바뀌면 압축 해제 폴더를 덮어쓴 뒤 확장 새로고침이 필요합니다.",
      "0.4.32: 호텔 안내(총 N개·출발 3일전) 수집, 성급/영문명, 마케팅 문구·상세보기 중복 블록 제거, 관광지 설명 주어 복원, 캘린더 DOM 폴백 안정화.",
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
