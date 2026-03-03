import { cookies } from "next/headers";
import Link from "next/link";
import { getMemberSessionFromCookies } from "@/lib/memberSession";

const REDEMPTION_STATUS_LABEL: Record<string, string> = {
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

export default async function MypageDashboardPage() {
  const cookieStore = await cookies();
  const session = getMemberSessionFromCookies(cookieStore);
  if (!session) return null;

  const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
  const cookieHeader = cookieStore.toString();

  const [pointsData, redemptions] = await Promise.all([
    fetchPoints(baseUrl, cookieHeader),
    fetchRedemptions(baseUrl, cookieHeader),
  ]);

  const balance = pointsData?.balance ?? 0;
  const pending = pointsData?.pending ?? 0;
  const expiringSoon = pointsData?.expiringSoon ?? 0;
  const recentRedemptions = (redemptions ?? []).slice(0, 5);
  const showStatuses = ["REQUESTED", "APPROVED", "SHIPPED"];

  return (
    <div className="space-y-8">
      <section className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-6">
        <h2 className="mb-4 text-lg font-semibold text-[var(--text-primary)]">포인트 요약</h2>
        <div className="grid gap-4 sm:grid-cols-3">
          <div className="rounded-lg bg-[var(--surface-muted)] p-4">
            <p className="text-sm text-[var(--text-muted)]">사용 가능</p>
            <p className="mt-1 text-2xl font-bold text-[var(--primary)]">{Number(balance).toLocaleString()}P</p>
          </div>
          <div className="rounded-lg bg-[var(--surface-muted)] p-4">
            <p className="text-sm text-[var(--text-muted)]">적립 대기</p>
            <p className="mt-1 text-xl font-semibold text-[var(--text-secondary)]">{Number(pending).toLocaleString()}P</p>
          </div>
          <div className="rounded-lg bg-[var(--surface-muted)] p-4">
            <p className="text-sm text-[var(--text-muted)]">소멸 예정 (30일)</p>
            <p className="mt-1 text-xl font-semibold text-[var(--warning)]">{Number(expiringSoon).toLocaleString()}P</p>
          </div>
        </div>
        <p className="mt-3 text-xs text-[var(--text-muted)]">
          포인트는 리워드 교환에 사용됩니다. 교환 신청 시 잔액에서 차감(RESERVE)되며, 반려 시 복구됩니다.
        </p>
        <Link
          href="/mypage/points"
          className="mt-3 inline-block text-sm font-medium text-[var(--primary)] underline-offset-2 hover:underline"
        >
          포인트 내역 보기 →
        </Link>
      </section>

      <section className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-6">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-[var(--text-primary)]">최근 교환 신청</h2>
          <Link
            href="/mypage/redemptions"
            className="text-sm font-medium text-[var(--primary)] underline-offset-2 hover:underline"
          >
            전체 보기
          </Link>
        </div>
        {recentRedemptions.length === 0 ? (
          <p className="text-sm text-[var(--text-muted)]">최근 교환 신청이 없습니다.</p>
        ) : (
          <ul className="space-y-3">
            {recentRedemptions.map((r: { id: string; catalog_title?: string; point_amount: number; status: string; requested_at: string }) => (
              <li
                key={r.id}
                className="flex flex-wrap items-center justify-between gap-2 border-b border-[var(--border)] pb-3 last:border-0 last:pb-0"
              >
                <span className="font-medium text-[var(--text-primary)]">{r.catalog_title ?? "경품"}</span>
                <span className="text-[var(--primary)]">{Number(r.point_amount).toLocaleString()}P</span>
                <span
                  className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${
                    showStatuses.includes(r.status)
                      ? "bg-[var(--primary-soft)] text-[var(--primary)]"
                      : r.status === "REJECTED"
                        ? "bg-[var(--danger-bg)] text-[var(--danger)]"
                        : "bg-[var(--surface-muted)] text-[var(--text-secondary)]"
                  }`}
                >
                  {REDEMPTION_STATUS_LABEL[r.status] ?? r.status}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
