import MyPageLayout from "@/components/mypage/MyPageLayout";
import { cookies } from "next/headers";

const STATUS_LABEL: Record<string, string> = {
  REQUESTED: "승인 대기",
  APPROVED: "승인됨",
  REJECTED: "반려",
  SHIPPED: "발송 완료",
  COMPLETED: "수령 완료",
  CANCELED: "취소",
};

async function fetchPoints(baseUrl: string, cookieHeader: string) {
  const res = await fetch(`${baseUrl}/api/me/points`, {
    headers: { Cookie: cookieHeader },
    cache: "no-store",
  });
  if (!res.ok) return null;
  return res.json();
}

async function fetchRedemptions(baseUrl: string, cookieHeader: string) {
  const res = await fetch(`${baseUrl}/api/me/rewards/redemptions`, {
    headers: { Cookie: cookieHeader },
    cache: "no-store",
  });
  if (!res.ok) return [];
  return res.json();
}

const RECENT_REVIEWS = [
  { id: "rv-1", product: "일본 오사카 3박4일", rating: 5, createdAt: "2026-03-02" },
  { id: "rv-2", product: "베트남 다낭 패키지", rating: 4, createdAt: "2026-02-26" },
  { id: "rv-3", product: "홋카이도 온천 투어", rating: 5, createdAt: "2026-02-12" },
];

export default async function MyPageDashboardPage() {
  const cookieStore = await cookies();
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
  const cookieHeader = cookieStore.toString();
  const [pointsData, redemptions] = await Promise.all([
    fetchPoints(baseUrl, cookieHeader),
    fetchRedemptions(baseUrl, cookieHeader),
  ]);
  const recentRedemptions = (redemptions ?? []).slice(0, 3);

  return (
    <MyPageLayout title="마이페이지 대시보드" description="회원 활동 요약을 확인할 수 있습니다.">
      <div className="space-y-6">
        <div className="flex flex-col space-y-3 sm:space-y-0 sm:grid sm:grid-cols-2 sm:gap-4">
          <article className="rounded-none border-0 bg-transparent p-0 sm:rounded-xl sm:border sm:border-[var(--border)] sm:bg-[var(--surface)] sm:p-4">
            <p className="text-xs font-medium text-[var(--text-secondary)]">포인트 잔액</p>
            <p className="mt-2 text-3xl font-semibold text-[var(--text-primary)]">
              {Number(pointsData?.balance ?? 0).toLocaleString()}P
            </p>
          </article>
          <article className="rounded-none border-0 bg-transparent p-0 sm:rounded-xl sm:border sm:border-[var(--border)] sm:bg-[var(--surface)] sm:p-4">
            <p className="text-xs font-medium text-[var(--text-secondary)]">적립 예정 포인트</p>
            <p className="mt-2 text-3xl font-semibold text-[var(--text-primary)]">
              {Number(pointsData?.pending ?? 0).toLocaleString()}P
            </p>
          </article>
        </div>

        <section className="rounded-none border-0 bg-transparent p-0 sm:rounded-xl sm:border sm:border-[var(--border)] sm:bg-[var(--surface)] sm:p-4">
          <h2 className="text-base font-semibold text-[var(--text-primary)]">최근 리워드 상태</h2>
          <ul className="mt-3 space-y-2">
            {recentRedemptions.length === 0 ? (
              <li className="rounded-lg border border-[var(--border)] px-3 py-2 text-sm text-[var(--text-secondary)]">
                최근 리워드 신청 내역이 없습니다.
              </li>
            ) : (
              recentRedemptions.map(
                (item: { id: string; catalog_title: string | null; status: string; requested_at: string }) => (
                  <li key={item.id} className="flex items-center justify-between rounded-lg border border-[var(--border)] px-3 py-2">
                    <div>
                      <p className="text-sm font-medium text-[var(--text-primary)]">{item.catalog_title ?? "리워드"}</p>
                      <p className="text-xs text-[var(--text-secondary)]">{new Date(item.requested_at).toLocaleDateString("ko-KR")}</p>
                    </div>
                    <span className="rounded-md bg-[var(--primary-soft)] px-2 py-1 text-xs text-[var(--primary)]">
                      {STATUS_LABEL[item.status] ?? item.status}
                    </span>
                  </li>
                ),
              )
            )}
          </ul>
        </section>

        <section className="rounded-none border-0 bg-transparent p-0 sm:rounded-xl sm:border sm:border-[var(--border)] sm:bg-[var(--surface)] sm:p-4">
          <h2 className="text-base font-semibold text-[var(--text-primary)]">최근 리뷰</h2>
          <ul className="mt-3 space-y-2">
            {RECENT_REVIEWS.map((item) => (
              <li key={item.id} className="rounded-lg border border-[var(--border)] px-3 py-2">
                <p className="text-sm font-medium text-[var(--text-primary)]">{item.product}</p>
                <p className="text-xs text-[var(--text-secondary)]">
                  평점 {item.rating}/5 · {item.createdAt}
                </p>
              </li>
            ))}
          </ul>
        </section>
      </div>
    </MyPageLayout>
  );
}
