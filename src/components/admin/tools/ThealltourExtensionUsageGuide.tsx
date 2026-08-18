"use client";

import { useId, useState } from "react";
import { ChevronDown } from "lucide-react";

const USAGE_STEPS = [
  {
    title: "1. 설치·업데이트 (현재 0.2.30)",
    body: [
      "팝업이나 설정 화면은 없습니다. Chrome 툴바의 thealltour_extension 아이콘을 누르면 바로 수집이 시작됩니다.",
      "권한: activeTab, scripting, storage. 접속 허용: hanatour.com, modetour.com, thealltour.com, localhost:3000.",
      "Chrome은 압축 해제(개발자 모드) 확장을 자동 업데이트하지 않습니다. 이 페이지에서 새 ZIP을 받은 뒤, 기존 폴더에 덮어쓰고 chrome://extensions에서 해당 확장의 새로고침(원형 화살표)을 눌러야 새 버전이 적용됩니다.",
      "확장을 새로고침한 뒤에는 하나투어/모두투어 상품 상세 탭도 한 번 새로고침한 다음 아이콘을 누르세요. chrome://extensions 화면에서 아이콘을 누르면 반응이 없습니다.",
      "버전은 chrome://extensions의 확장 카드와 이 페이지 다운로드 카드의 버전이 같아야 합니다.",
    ].join("\n"),
  },
  {
    title: "2. 사전 준비",
    body: [
      "같은 Chrome 브라우저에서 더올투어 관리자(https://www.thealltour.com/theall_manager_only)에 로그인합니다. 익스텐션은 그 로그인 쿠키로 API를 호출합니다.",
      "AI 파싱은 서버에서 수행합니다. 기본 모델은 Google Gemini 3.6 Flash입니다. 운영/로컬 서버 환경 변수에 `GOOGLE_GENERATIVE_AI_API_KEY` 또는 `GEMINI_API_KEY`가 있어야 합니다.",
      "Google 키가 없을 때만 `OPENAI_API_KEY`(gpt-4o-mini)로 폴백합니다. `IMPORT_AI_PROVIDER=google|openai`로 강제할 수 있습니다.",
      "로컬에서 소스 폴더를 직접 로드할 때는 `npm run dev`로 API 서버를 켜 둡니다.",
    ].join("\n"),
  },
  {
    title: "3. API 주소",
    body: [
      "관리자에서 받은 ZIP을 설치하면 API 주소는 `https://thealltour.com`으로 자동 설정됩니다. 익스텐션 안에 주소 입력 UI는 없습니다.",
      "로컬에서 `tools/thealltour_extension` 폴더를 압축 해제 로드하면 기본값은 `http://localhost:3000` 입니다.",
      "예전에 저장된 localhost 값이 운영 ZIP에 남아 있으면 설치/시작 시 자동으로 운영 주소로 고칩니다. 그래도 실패하면 확장을 제거한 뒤 이 페이지 ZIP을 다시 설치하세요.",
    ].join("\n"),
  },
  {
    title: "4. 아이콘을 누르면 일어나는 일",
    body: [
      "우측 하단에 진행 바가 뜨고, 화면 전체가 잠시 잠깁니다. 수집이 끝날 때까지 페이지를 클릭하지 마세요. 클릭하거나 탭이 다른 주소로 바뀌면 수집이 중단됩니다.",
      "순서: 대표 이미지 → 상품 정보 텍스트 → 상품안내 탭 → 일정 탭 펼침 → HTML 구조 → 일정 N일차 블록 → 호텔·관광지·선택관광·참고사항 탭 → (하나투어) 출발일·가격 → 서버 전송 → AI 메타/일정 분석 → 상품 저장.",
      "페이지에 「AI 해시태그」 구간이 있으면 그 키워드를 SEO meta_title로 가져옵니다. 없으면 서버 AI가 목적지·테마 기준 검색 키워드 4~8개를 작성합니다(# 없이).",
      "서버 AI 분석은 보통 1~2분, 최대 약 3분입니다. 완료 alert에 제목·가격·갤러리 수·일정 이벤트 수·출발일 건수·상품 ID가 표시되면 관리자 상품에서 편집을 이어갑니다.",
    ].join("\n"),
  },
  {
    title: "5. 하나투어 — 출발일·일정",
    body: [
      "권장: 검색·패키지 목록(예: all-search) 탭을 연 채로, 달력에서 출발일 하나를 눌러 상세(`/trp/pkg/...`)로 들어갑니다. 부모 탭을 닫지 마세요. 확장이 부모 탭 달력을 최대 12개월까지 넘기며 출발일을 모읍니다.",
      "부모 탭이 없어도 상품 코드로 하나투어 달력 API를 호출해 출발일·가격을 보강합니다. 오버레이에 「부모 탭 달력 월 순회 중…」「출발일·가격 API 수집…」이 보이면 정상입니다.",
      "달력 API가 비어도 상품 본문·일정·카탈로그는 저장됩니다. 완료 alert에 「출발일: API 미응답」이면 출발일만 비어 있는 상태입니다.",
    ].join("\n"),
  },
  {
    title: "6. 모두투어",
    body: [
      "상품 상세 페이지를 연 뒤 툴바 아이콘만 누르면 됩니다. 부모 탭은 필요 없습니다.",
      "수집 항목은 하나투어와 같습니다(이미지, 본문, 일정, SEO 키워드, 호텔·선택관광 등 페이지에 있는 범위).",
    ].join("\n"),
  },
  {
    title: "7. 문제 해결",
    body: [
      "네트워크 오류: 같은 Chrome에서 https://www.thealltour.com/theall_manager_only 로그인 → chrome://extensions에서 확장 새로고침. localhost가 남아 있으면 ZIP을 다시 설치하세요.",
      "401 오류: 관리자 로그인이 만료된 경우입니다. 로그인 후 다시 아이콘을 누르세요.",
      "이미 등록된 URL: 기존 상품 ID가 alert로 나옵니다. 새로 만들지 않습니다.",
      "출발일 0건: 부모 탭이 같은 창에 있는지, 달력에서 날짜를 눌러 상세로 들어왔는지 확인하세요. 그래도 비면 상품은 저장된 뒤 관리자에서 출발일을 보완합니다.",
      "하나투어 검색 페이지에서는 수집할 수 없습니다: 상품 상세(`/trp/pkg/...`)에서 아이콘을 누르세요.",
      "수집 중 페이지가 이동했습니다: 일정/카탈로그를 펼치다 검색으로 나갔거나, 수집 중에 페이지를 클릭한 경우입니다. 상세로 돌아온 뒤 화면이 잠긴 상태에서 다시 아이콘을 누르세요.",
      "이 페이지 버전이 안 바뀌면 브라우저 새로고침 후 다시 다운로드하세요. ZIP을 받아도 Chrome 확장이 안 바뀌면 압축 해제 폴더를 덮어쓴 뒤 확장 새로고침이 필요합니다.",
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
