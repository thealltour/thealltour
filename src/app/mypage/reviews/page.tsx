import { cookies } from "next/headers";
import Link from "next/link";
import MyPageLayout from "@/components/mypage/MyPageLayout";
import { MyPageCard } from "@/components/mypage/ui/MyPageCard";
import { MyPageEmptyState } from "@/components/mypage/ui/MyPageEmptyState";
import { MyPageStatusBadge } from "@/components/mypage/ui/MyPageStatusBadge";
import { MyPageSectionHeader } from "@/components/mypage/ui/MyPageSectionHeader";
import { Card } from "@/components/ui/Card";
import { buttonVariants } from "@/components/ui/Button";
import { getMyPageMemberSummary } from "@/lib/mypage/memberSummary";
import { getMemberSessionFromCookies } from "@/lib/memberSession";
import { getMyPageReviewSections } from "@/lib/mypageReviews";
import { cn } from "@/lib/cn";
import type {
  MyPageWritableReviewItem,
  MyPageDraftReviewItem,
  MyPageSubmittedReviewItem,
} from "@/types/review";

function formatDate(value?: string | null) {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return date.toLocaleDateString("ko-KR");
}

function formatDateRange(departure?: string | null, returnDate?: string | null) {
  if (!departure && !returnDate) return null;
  const from = formatDate(departure);
  const to = formatDate(returnDate);
  if (from === "-" && to === "-") return null;
  return `${from} ~ ${to}`;
}

function WritableReviewCard({ item }: { item: MyPageWritableReviewItem }) {
  const dateRange = formatDateRange(item.departure_date, item.return_date);
  return (
    <MyPageCard className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex-1 space-y-1">
        <MyPageStatusBadge reviewVariant="writable" />
        <p className="text-sm font-semibold text-[var(--text-primary)]">{item.product_title || "상품명 없음"}</p>
        {dateRange ? <p className="text-xs text-[var(--text-secondary)]">여행일정: {dateRange}</p> : null}
        <p className="text-xs text-[var(--text-muted)]">후기 가능일: {formatDate(item.review_open_at)}</p>
      </div>
      <Link
        href={`/reviews/write?eligibility=${item.eligibility_id}`}
        className={cn(buttonVariants({ variant: "primary", size: "md" }), "shrink-0")}
      >
        후기 작성
      </Link>
    </MyPageCard>
  );
}

function DraftReviewCard({ item }: { item: MyPageDraftReviewItem }) {
  return (
    <MyPageCard className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex-1 space-y-1">
        <MyPageStatusBadge reviewVariant="draft" />
        <p className="text-sm font-semibold text-[var(--text-primary)]">
          {item.title || "제목 없는 임시저장 후기"}
        </p>
        <p className="text-xs text-[var(--text-secondary)]">
          마지막 저장: {formatDate(item.updated_at || item.created_at)}
        </p>
      </div>
      <Link
        href={
          item.eligibility_id
            ? `/reviews/write?eligibility=${item.eligibility_id}`
            : `/reviews/write?review=${item.review_id}`
        }
        className={cn(buttonVariants({ variant: "outline", size: "md" }), "shrink-0")}
      >
        이어쓰기
      </Link>
    </MyPageCard>
  );
}

function SubmittedReviewCard({ item }: { item: MyPageSubmittedReviewItem }) {
  return (
    <Card variant="interactive" className="p-4 sm:p-5">
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 space-y-1">
          <div className="flex flex-wrap items-center gap-2">
            <MyPageStatusBadge reviewVariant="submitted" />
            {typeof item.rating === "number" ? (
              <span className="text-xs text-[var(--secondary)]">
                {"★".repeat(item.rating)}{"☆".repeat(5 - item.rating)}
              </span>
            ) : null}
          </div>
          <p className="text-sm font-semibold text-[var(--text-primary)]">{item.title}</p>
          <p className="text-xs text-[var(--text-secondary)]">작성일: {formatDate(item.created_at)}</p>
          <p className="mt-2 line-clamp-2 text-xs text-[var(--text-secondary)]">{item.content}</p>
        </div>
        <Link href={`/mypage/reviews/${item.id}`} className={cn(buttonVariants({ variant: "outline", size: "sm" }), "shrink-0")}>
          보기
        </Link>
      </div>
    </Card>
  );
}

export default async function MyPageReviewsPage() {
  const cookieStore = await cookies();
  const session = getMemberSessionFromCookies(cookieStore);
  const [memberSummary, sections] = session
    ? await Promise.all([
        getMyPageMemberSummary(),
        getMyPageReviewSections(session.memberId),
      ])
    : [null, { writable: [], drafts: [], submitted: [] }];

  const hasAnyData =
    sections.writable.length > 0 || sections.drafts.length > 0 || sections.submitted.length > 0;

  return (
    <MyPageLayout
      title="리뷰 관리"
      description="내 후기를 작성하고 관리할 수 있습니다."
      memberSummary={memberSummary}
    >
      {!hasAnyData ? (
        <MyPageEmptyState
          message="리뷰를 남기고 5,000포인트를 적립해 보세요"
          description="여행 후기를 작성하면 포인트가 적립됩니다. 문의·예약이 회원 계정과 연결되면 여행 완료 후 이곳에서 작성할 수 있습니다."
          dashed={false}
        />
      ) : (
        <div className="space-y-8">
          <section>
            <MyPageSectionHeader
              title="작성 가능한 후기"
              description="여행을 마친 상품의 후기를 작성할 수 있습니다."
            />
            {sections.writable.length === 0 ? (
              <MyPageEmptyState message="현재 작성 가능한 후기가 없습니다." dashed className="mt-4" />
            ) : (
              <div className="mt-4 space-y-3">
                {sections.writable.map((item) => (
                  <WritableReviewCard key={item.eligibility_id} item={item} />
                ))}
              </div>
            )}
          </section>

          <section>
            <MyPageSectionHeader title="작성 중인 후기" description="임시저장된 후기를 이어서 작성하세요." />
            {sections.drafts.length === 0 ? (
              <MyPageEmptyState message="임시저장된 후기가 없습니다." dashed className="mt-4" />
            ) : (
              <div className="mt-4 space-y-3">
                {sections.drafts.map((item) => (
                  <DraftReviewCard key={item.review_id} item={item} />
                ))}
              </div>
            )}
          </section>

          <section>
            <MyPageSectionHeader title="작성 완료 후기" description="이미 등록한 후기를 확인할 수 있습니다." />
            {sections.submitted.length === 0 ? (
              <MyPageEmptyState message="아직 작성 완료한 후기가 없습니다." dashed className="mt-4" />
            ) : (
              <div className="mt-4 space-y-3">
                {sections.submitted.map((item) => (
                  <SubmittedReviewCard key={item.id} item={item} />
                ))}
              </div>
            )}
          </section>
        </div>
      )}
    </MyPageLayout>
  );
}
