/**
 * Compact SEO intro above PlannerWizard — keep vertical budget small on mobile.
 */
export function PlannerLandingIntro() {
  return (
    <header className="mb-3 space-y-1 sm:mb-4 sm:space-y-1.5">
      <h1 className="heading-display text-[1.75rem] font-bold leading-[1.25] tracking-[-0.02em] text-[var(--foreground)] sm:text-[2rem]">
        AI 자유여행 플래너
      </h1>
      <p className="type-small leading-relaxed text-[var(--text-secondary)] sm:text-[1rem]">
        출발지와 목적지, 여행 조건을 알려주시면 일정 초안을 함께 만들어드려요.
      </p>
    </header>
  );
}
