import MyPageLayout from "@/components/mypage/MyPageLayout";

const MOCK_REVIEWS = Array.from({ length: 10 }).map((_, index) => ({
  id: `review-${index + 1}`,
  title: `내 리뷰 제목 ${index + 1}`,
  productName: `여행 상품 ${index + 1}`,
  createdAt: `2026-02-${String((index % 9) + 1).padStart(2, "0")}`,
}));

export default function MyPageReviewsPage() {
  return (
    <MyPageLayout title="리뷰 관리" description="내가 작성한 리뷰를 확인할 수 있습니다.">
      <section className="space-y-2">
        {MOCK_REVIEWS.map((review) => (
          <article key={review.id} className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-4">
            <p className="text-sm font-semibold text-[var(--text-primary)]">{review.title}</p>
            <p className="mt-1 text-xs text-[var(--text-secondary)]">{review.productName}</p>
            <p className="mt-1 text-xs text-[var(--text-secondary)]">작성일 {review.createdAt}</p>
            <button type="button" className="mt-3 rounded-lg border border-[var(--border)] px-3 py-1.5 text-xs text-[var(--text-secondary)]">
              상세보기 (준비중)
            </button>
          </article>
        ))}
      </section>
    </MyPageLayout>
  );
}
