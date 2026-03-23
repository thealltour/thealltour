"use client";

const RECOMMENDED_ANCHOR_ID = "recommended-products";
const SCROLL_OFFSET_DESKTOP_PX = 80;
const SCROLL_OFFSET_MOBILE_PX = 100;

/**
 * 가이드 브리지 히어로용 CTA (/destinations·/themes LandingHero 버튼 스타일 정렬).
 * 스크롤은 부드럽게, 노션은 새 탭.
 */
export function GuideBridgeHeroCtas({ notionUrl }: { notionUrl: string | null }) {
  const hasNotion = Boolean(notionUrl?.trim());

  function scrollToRecommended() {
    const el = document.getElementById(RECOMMENDED_ANCHOR_ID);
    if (!el) return;
    const narrow = window.matchMedia("(max-width: 639px)").matches;
    const offset = narrow ? SCROLL_OFFSET_MOBILE_PX : SCROLL_OFFSET_DESKTOP_PX;
    const top = el.getBoundingClientRect().top + window.scrollY - offset;
    window.scrollTo({ top: Math.max(0, top), behavior: "smooth" });
  }

  const primaryClass =
    "inline-flex min-h-[44px] items-center justify-center rounded-xl bg-[var(--primary)] px-5 py-2.5 text-sm font-semibold text-white transition hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)]";
  const secondaryClass =
    "inline-flex min-h-[44px] items-center justify-center rounded-xl border border-white/60 bg-white/10 px-5 py-2.5 text-sm font-semibold text-white backdrop-blur-sm transition hover:bg-white/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/40";

  return (
    <div className="mt-5 flex flex-wrap gap-3">
      {hasNotion ? (
        <a
          href={notionUrl!.trim()}
          target="_blank"
          rel="noopener noreferrer"
          className={primaryClass}
        >
          가이드 원문 전체 보기
        </a>
      ) : null}
      {hasNotion ? (
        <button type="button" onClick={scrollToRecommended} className={secondaryClass}>
          추천 여행 보기
        </button>
      ) : (
        <button type="button" onClick={scrollToRecommended} className={primaryClass}>
          추천 여행 보기
        </button>
      )}
    </div>
  );
}
