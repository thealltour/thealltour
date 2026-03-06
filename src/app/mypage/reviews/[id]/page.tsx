import { cookies } from "next/headers";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import MyPageLayout from "@/components/mypage/MyPageLayout";
import { getMemberSessionFromCookies } from "@/lib/memberSession";
import { getReviewById } from "@/lib/reviews";

type Props = {
  params: Promise<{ id: string }>;
};

function formatDate(value?: string | null) {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return date.toLocaleDateString("ko-KR", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

function StarDisplay({ rating, label }: { rating?: number; label: string }) {
  if (typeof rating !== "number") return null;
  return (
    <div className="flex items-center justify-between text-sm">
      <span className="text-[var(--text-secondary)]">{label}</span>
      <span className="text-amber-500">
        {"★".repeat(rating)}{"☆".repeat(5 - rating)}
      </span>
    </div>
  );
}

function ContentSection({ title, content }: { title: string; content?: string }) {
  if (!content) return null;
  return (
    <div className="space-y-2">
      <h3 className="text-sm font-semibold text-[var(--text-primary)]">{title}</h3>
      <p className="whitespace-pre-wrap text-sm text-[var(--text-secondary)]">{content}</p>
    </div>
  );
}

export default async function MyPageReviewDetailPage({ params }: Props) {
  const { id } = await params;
  const cookieStore = await cookies();
  const session = getMemberSessionFromCookies(cookieStore);

  if (!session) {
    notFound();
  }

  const review = await getReviewById(id);

  if (!review) {
    notFound();
  }

  if (review.member_id !== session.memberId) {
    notFound();
  }

  const images = review.image_urls ?? (review.image_url ? [review.image_url] : []);
  const hasStructuredContent = review.content_good || review.content_bad || review.content_tip;
  const hasDetailRatings =
    review.rating_schedule || review.rating_stay || review.rating_guide || review.rating_food;

  return (
    <MyPageLayout title="후기 상세" description="작성한 후기의 상세 내용입니다.">
      <div className="space-y-6">
        <Link
          href="/mypage/reviews"
          className="inline-flex items-center gap-1 text-sm text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
        >
          <span>←</span>
          <span>목록으로</span>
        </Link>

        <article className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-6">
          <header className="mb-4 border-b border-[var(--border)] pb-4">
            <h1 className="text-lg font-bold text-[var(--text-primary)]">{review.title}</h1>
            {review.summary && (
              <p className="mt-1 text-sm text-[var(--text-secondary)]">{review.summary}</p>
            )}
            <div className="mt-2 flex flex-wrap items-center gap-3 text-xs text-[var(--text-secondary)]">
              <span>작성자: {review.author_name}</span>
              <span>작성일: {formatDate(review.created_at)}</span>
              {typeof review.rating === "number" && (
                <span className="text-amber-500">
                  {"★".repeat(review.rating)}{"☆".repeat(5 - review.rating)}
                  <span className="ml-1 text-[var(--text-muted)]">({review.rating}점)</span>
                </span>
              )}
            </div>
          </header>

          {hasDetailRatings && (
            <div className="mb-4 rounded-lg bg-slate-50 p-4">
              <h3 className="mb-2 text-xs font-medium text-[var(--text-muted)]">세부 평점</h3>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                <StarDisplay rating={review.rating_schedule} label="일정" />
                <StarDisplay rating={review.rating_stay} label="숙소" />
                <StarDisplay rating={review.rating_guide} label="가이드" />
                <StarDisplay rating={review.rating_food} label="식사" />
              </div>
            </div>
          )}

          {images.length > 0 && (
            <div className="mb-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
              {images.map((url, index) => (
                <div
                  key={`${url}-${index}`}
                  className="relative aspect-square overflow-hidden rounded-lg ring-1 ring-[var(--border)]"
                >
                  <Image
                    src={url}
                    alt={`후기 이미지 ${index + 1}`}
                    fill
                    sizes="(max-width: 640px) 50vw, 25vw"
                    className="object-cover"
                  />
                </div>
              ))}
            </div>
          )}

          {hasStructuredContent ? (
            <div className="space-y-4">
              <ContentSection title="좋았던 점" content={review.content_good} />
              <ContentSection title="아쉬웠던 점" content={review.content_bad} />
              <ContentSection title="여행 팁" content={review.content_tip} />
              {review.content && !isGeneratedContent(review.content, review) && (
                <ContentSection title="추가 내용" content={review.content} />
              )}
            </div>
          ) : (
            <div className="prose prose-sm max-w-none text-[var(--text-primary)]">
              <p className="whitespace-pre-wrap">{review.content}</p>
            </div>
          )}
        </article>
      </div>
    </MyPageLayout>
  );
}

function isGeneratedContent(
  content: string,
  review: { content_good?: string; content_bad?: string; content_tip?: string },
): boolean {
  const parts: string[] = [];
  if (review.content_good) parts.push(`[좋았던 점]\n${review.content_good}`);
  if (review.content_bad) parts.push(`[아쉬웠던 점]\n${review.content_bad}`);
  if (review.content_tip) parts.push(`[여행 팁]\n${review.content_tip}`);
  const generated = parts.join("\n\n");
  return content.trim() === generated.trim();
}
