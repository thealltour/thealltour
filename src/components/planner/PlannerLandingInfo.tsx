/**
 * Below-wizard SEO info + short FAQ. Must not appear above PlannerWizard.
 */
export function PlannerLandingInfo() {
  return (
    <section
      className="mt-10 space-y-8 border-t border-[var(--border)] pt-8 sm:mt-12 sm:pt-10"
      aria-label="자유여행 플래너 안내"
    >
      <div className="space-y-3">
        <h2 className="type-h3 text-[var(--foreground)]">자유여행 플래너로 할 수 있는 것</h2>
        <ul className="list-disc space-y-1.5 pl-5 type-small leading-relaxed text-[var(--text-secondary)] sm:text-[1rem]">
          <li>여행 날짜와 동행에 맞춘 일정 초안</li>
          <li>맛집·관광·휴식 등 취향 반영</li>
          <li>완성된 일정에서 항공권 등 여행 준비 연결</li>
        </ul>
      </div>

      <div className="space-y-4">
        <h2 className="type-h3 text-[var(--foreground)]">자주 묻는 질문</h2>
        <dl className="space-y-4">
          <div className="space-y-1">
            <dt className="type-body font-medium text-[var(--foreground)]">
              여행 일정은 어떻게 만들어지나요?
            </dt>
            <dd className="type-small leading-relaxed text-[var(--text-secondary)] sm:text-[1rem]">
              입력한 목적지, 날짜, 동행, 취향 등을 바탕으로 AI가 일정 초안을 구성합니다.
            </dd>
          </div>
          <div className="space-y-1">
            <dt className="type-body font-medium text-[var(--foreground)]">
              만든 일정은 수정할 수 있나요?
            </dt>
            <dd className="type-small leading-relaxed text-[var(--text-secondary)] sm:text-[1rem]">
              결과 화면에서 AI 수정 기능으로 원하는 조건을 다시 반영할 수 있습니다.
            </dd>
          </div>
          <div className="space-y-1">
            <dt className="type-body font-medium text-[var(--foreground)]">
              항공권도 확인할 수 있나요?
            </dt>
            <dd className="type-small leading-relaxed text-[var(--text-secondary)] sm:text-[1rem]">
              이용 가능한 경우 결과 화면의 여행 준비 영역에서 항공 검색으로 연결됩니다.
            </dd>
          </div>
        </dl>
      </div>
    </section>
  );
}
