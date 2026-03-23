import { cookies } from "next/headers";
import Link from "next/link";
import { cn } from "@/lib/cn";
import { solidButtonShadowClasses } from "@/components/ui/Button";
import MyPageLayout from "@/components/mypage/MyPageLayout";
import { SectionHeader } from "@/components/layout/SectionHeader";
import { getMemberSessionFromCookies } from "@/lib/memberSession";
import { getMyPageReviewSections } from "@/lib/mypageReviews";
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

function StatusBadge({ label, variant }: { label: string; variant: "writable" | "draft" | "submitted" }) {
  const colors = {
    writable: "bg-blue-100 text-blue-700",
    draft: "bg-amber-100 text-amber-700",
    submitted: "bg-green-100 text-green-700",
  };
  return (
    <span className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-medium ${colors[variant]}`}>
      {label}
    </span>
  );
}

function WritableReviewCard({ item }: { item: MyPageWritableReviewItem }) {
  const dateRange = formatDateRange(item.departure_date, item.return_date);
  return (
    <article className="flex flex-col gap-3 rounded-xl border border-[var(--border)] bg-[var(--surface)] p-4 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex-1 space-y-1">
        <div className="flex items-center gap-2">
          <StatusBadge label="작성 가능" variant="writable" />
        </div>
        <p className="text-sm font-semibold text-[var(--text-primary)]">
          {item.product_title || "상품명 없음"}
        </p>
        {dateRange && (
          <p className="text-xs text-[var(--text-secondary)]">여행일정: {dateRange}</p>
        )}
        <p className="text-xs text-[var(--text-muted)]">
          후기 가능일: {formatDate(item.review_open_at)}
        </p>
      </div>
      <Link
        href={`/reviews/write?eligibility=${item.eligibility_id}`}
        className={cn(
          "inline-flex items-center justify-center rounded-lg bg-[var(--primary)] px-4 py-2 text-sm font-medium text-white transition hover:bg-[var(--primary-dark)]",
          solidButtonShadowClasses,
        )}
      >
        후기 작성
      </Link>
    </article>
  );
}

function DraftReviewCard({ item }: { item: MyPageDraftReviewItem }) {
  return (
    <article className="flex flex-col gap-3 rounded-xl border border-[var(--border)] bg-[var(--surface)] p-4 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex-1 space-y-1">
        <div className="flex items-center gap-2">
          <StatusBadge label="작성 중" variant="draft" />
        </div>
        <p className="text-sm font-semibold text-[var(--text-primary)]">
          {item.title || "제목 없는 임시저장 후기"}
        </p>
        <p className="text-xs text-[var(--text-secondary)]">
          마지막 저장: {formatDate(item.updated_at || item.created_at)}
        </p>
      </div>
      <Link
        href={item.eligibility_id ? `/reviews/write?eligibility=${item.eligibility_id}` : `/reviews/write?review=${item.review_id}`}
        className="inline-flex items-center justify-center rounded-lg border border-[var(--border)] bg-white px-4 py-2 text-sm font-medium text-[var(--text-primary)] transition hover:bg-[var(--surface-hover)]"
      >
        이어쓰기
      </Link>
    </article>
  );
}

function SubmittedReviewCard({ item }: { item: MyPageSubmittedReviewItem }) {
  return (
    <article className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 space-y-1">
          <div className="flex items-center gap-2">
            <StatusBadge label="작성 완료" variant="submitted" />
            {typeof item.rating === "number" && (
              <span className="text-xs text-amber-500">
                {"★".repeat(item.rating)}{"☆".repeat(5 - item.rating)}
              </span>
            )}
          </div>
          <p className="text-sm font-semibold text-[var(--text-primary)]">{item.title}</p>
          <p className="text-xs text-[var(--text-secondary)]">
            작성일: {formatDate(item.created_at)}
          </p>
          <p className="mt-2 line-clamp-2 text-xs text-[var(--text-secondary)]">
            {item.content}
          </p>
        </div>
        <Link
          href={`/mypage/reviews/${item.id}`}
          className="shrink-0 rounded-lg border border-[var(--border)] bg-white px-3 py-1.5 text-xs font-medium text-[var(--text-primary)] transition hover:bg-[var(--surface-hover)]"
        >
          보기
        </Link>
      </div>
    </article>
  );
}

function EmptyMessage({ message }: { message: string }) {
  return (
    <div className="rounded-lg border border-dashed border-[var(--border)] bg-[var(--surface)] p-4 text-center">
      <p className="text-xs text-[var(--text-muted)]">{message}</p>
    </div>
  );
}

export default async function MyPageReviewsPage() {
  const cookieStore = await cookies();
  const session = getMemberSessionFromCookies(cookieStore);
  const sections = session
    ? await getMyPageReviewSections(session.memberId)
    : { writable: [], drafts: [], submitted: [] };

  const hasAnyData =
    sections.writable.length > 0 ||
    sections.drafts.length > 0 ||
    sections.submitted.length > 0;

  return (
    <MyPageLayout title="리뷰 관리" description="내 후기를 작성하고 관리할 수 있습니다.">
      {!hasAnyData ? (
        <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-6 text-center">
          <p className="text-sm font-medium text-[var(--text-primary)]">
            아직 연결된 후기 항목이 없습니다.
          </p>
          <p className="mt-2 text-xs text-[var(--text-secondary)]">
            여행 완료 후 후기를 남길 수 있는 상품이 여기에 표시됩니다.
          </p>
        </div>
      ) : (
        <div className="space-y-8">
          {/* 작성 가능한 후기 */}
          <section>
            <SectionHeader
              title="작성 가능한 후기"
              description="여행을 마친 상품의 후기를 작성할 수 있습니다."
            />
            {sections.writable.length === 0 ? (
              <EmptyMessage message="현재 작성 가능한 후기가 없습니다." />
            ) : (
              <div className="space-y-3">
                {sections.writable.map((item) => (
                  <WritableReviewCard key={item.eligibility_id} item={item} />
                ))}
              </div>
            )}
          </section>

          {/* 작성 중인 후기 */}
          <section>
            <SectionHeader
              title="작성 중인 후기"
              description="임시저장된 후기를 이어서 작성하세요."
            />
            {sections.drafts.length === 0 ? (
              <EmptyMessage message="임시저장된 후기가 없습니다." />
            ) : (
              <div className="space-y-3">
                {sections.drafts.map((item) => (
                  <DraftReviewCard key={item.review_id} item={item} />
                ))}
              </div>
            )}
          </section>

          {/* 작성 완료 후기 */}
          <section>
            <SectionHeader
              title="작성 완료 후기"
              description="이미 등록한 후기를 확인할 수 있습니다."
            />
            {sections.submitted.length === 0 ? (
              <EmptyMessage message="아직 작성 완료한 후기가 없습니다." />
            ) : (
              <div className="space-y-3">
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
