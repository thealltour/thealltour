import type { LucideIcon } from "lucide-react";
import { BadgeCheck, CheckCircle2, Route, ShieldCheck, Users } from "lucide-react";
import { SectionBlock } from "@/components/layout/SectionBlock";

const TRUST_H3 = "안심하고 맡길 수 있는 여행 파트너";
const TRUST_LEAD =
  "대형 여행사와의 공식 제휴와 검증된 일정 운영 경험을 바탕으로, 안정적인 예약과 운영을 약속드립니다.";

const CARD_CLASS =
  "flex h-full flex-col rounded-none bg-transparent p-0 shadow-none ring-0 sm:rounded-2xl sm:bg-[var(--surface)] sm:p-5 sm:shadow-[var(--shadow-soft)] sm:ring-1 sm:ring-[var(--border)] text-[var(--foreground)]";

const CARD_CLASS_STACK =
  "flex h-full flex-col rounded-none bg-transparent p-0 shadow-none ring-0 text-[var(--foreground)]";

type TrustCard = {
  title: string;
  body: string;
  icon: LucideIcon;
};

const TRUST_CARDS: TrustCard[] = [
  {
    icon: ShieldCheck,
    title: "대형 여행사 공식 제휴",
    body: "국내 주요 파트너와 협력하여, 검증된 상품과 안정적인 예약 시스템을 기반으로 운영합니다.",
  },
  {
    icon: Users,
    title: "전문 상담사 1:1 배정",
    body: "연령대·동행 구성·예산을 이해하는 담당자가 처음 상담부터 귀국까지 책임지고 함께하며, 필요한 내용을 차분하게 설명해 드립니다.",
  },
  {
    icon: Route,
    title: "단체·동호회 맞춤 설계",
    body: "회사·동호회·가족 모임 등 인원과 목적에 맞춘 일정으로 이동 동선과 일정 피로도를 최소화한 코스를 제안합니다.",
  },
  {
    icon: CheckCircle2,
    title: "안전 기준을 통과한 일정",
    body: "현지 가이드·차량·숙소까지 사전 점검된 일정만 운영하며, 돌발 상황에도 대응 가능한 안전 프로세스를 갖추고 있습니다.",
  },
];

function normalizeTourismRegNo(value?: string): string | null {
  const trimmed = value?.trim() ?? "";
  if (!trimmed || trimmed === "미정") return null;
  return trimmed;
}

export type HomeTrustSectionProps = {
  tourismRegNo?: string;
  className?: string;
  /** true면 뷰포트 브레이크포인트 없이 모바일 1열 스택 (폰 프레임 랜딩용) */
  stackCards?: boolean;
};

export function HomeTrustSection({ tourismRegNo, className, stackCards }: HomeTrustSectionProps) {
  const regNo = normalizeTourismRegNo(tourismRegNo);
  const cardClass = stackCards ? CARD_CLASS_STACK : CARD_CLASS;

  return (
    <SectionBlock
      surface="none"
      padding="md"
      className={className ?? (stackCards ? "!px-4 !py-3" : "!px-4 !py-3 sm:!p-6 md:!p-8")}
    >
      <div className={stackCards ? "mb-6 space-y-3 text-center" : "mb-6 space-y-3 text-center sm:mb-8"}>
        <h3
          className={
            stackCards
              ? "heading-display section-title type-h3 text-[var(--foreground)]"
              : "heading-display section-title type-h3 md:text-[1.75rem] text-[var(--foreground)]"
          }
        >
          {TRUST_H3}
        </h3>
        <p className="mx-auto max-w-2xl type-small text-[var(--text-muted)]">{TRUST_LEAD}</p>
      </div>
      <div
        className={
          stackCards
            ? "flex flex-col space-y-3"
            : "flex flex-col space-y-3 md:space-y-0 md:grid md:grid-cols-2 md:gap-7 lg:grid-cols-3"
        }
      >
        {TRUST_CARDS.map((card) => (
          <TrustCardItem
            key={card.title}
            icon={card.icon}
            title={card.title}
            body={card.body}
            cardClass={cardClass}
          />
        ))}
        <TrustCardItem
          icon={BadgeCheck}
          title="관광사업자 정식 등록"
          body="문화체육관광부 기준 관광사업 등록 업체로 운영합니다. 검증된 일정과 책임 있는 예약·운영을 약속드립니다."
          footer={regNo ? `관광사업등록번호 ${regNo}` : undefined}
          cardClass={cardClass}
        />
      </div>
    </SectionBlock>
  );
}

function TrustCardItem({
  icon: Icon,
  title,
  body,
  footer,
  cardClass,
}: {
  icon: LucideIcon;
  title: string;
  body: string;
  footer?: string;
  cardClass: string;
}) {
  return (
    <div className={cardClass}>
      <div className="mb-3 flex items-center gap-2">
        <span className="flex h-9 w-9 items-center justify-center rounded-full bg-[var(--surface-muted)] ring-1 ring-[var(--border)]">
          <Icon className="h-5 w-5 text-[var(--primary)]" />
        </span>
        <p className="text-sm font-semibold text-[var(--foreground)] type-small">{title}</p>
      </div>
      <p className="text-xs leading-relaxed text-[var(--text-muted)] type-caption">{body}</p>
      {footer ? (
        <p className="mt-2 text-xs font-medium leading-relaxed text-[var(--foreground)] type-caption">
          {footer}
        </p>
      ) : null}
    </div>
  );
}
