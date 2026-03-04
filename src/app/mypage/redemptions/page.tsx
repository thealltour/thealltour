import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import MyPageLayout from "@/components/mypage/MyPageLayout";

const STATUS_LABEL: Record<string, string> = {
  REQUESTED: "승인 대기",
  APPROVED: "승인됨",
  REJECTED: "반려",
  SHIPPED: "발송 완료",
  COMPLETED: "수령 완료",
  CANCELED: "취소",
};

async function fetchRedemptions(baseUrl: string, cookieHeader: string) {
  const res = await fetch(`${baseUrl}/api/me/rewards/redemptions`, {
    headers: { Cookie: cookieHeader },
    cache: "no-store",
  });
  if (!res.ok) return null;
  return res.json();
}

export default async function MypageRedemptionsPage() {
  const cookieStore = await cookies();
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
  const list = await fetchRedemptions(baseUrl, cookieStore.toString());
  if (!Array.isArray(list)) {
    redirect("/mypage/rewards");
  }

  return (
    <MyPageLayout title="교환 신청 내역" description="리워드 교환 진행 상태를 확인할 수 있습니다.">
      <section className="space-y-2">
        {list.length === 0 ? (
          <p className="rounded-lg border border-[var(--border)] px-3 py-2 text-sm text-[var(--text-secondary)]">
            신청 내역이 없습니다.
          </p>
        ) : (
          list.map((row: { id: string; catalog_title: string | null; point_amount: number; status: string; requested_at: string }) => (
            <article key={row.id} className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-sm font-semibold text-[var(--text-primary)]">{row.catalog_title ?? "리워드"}</p>
                <span className="rounded-md bg-[var(--surface-muted)] px-2 py-0.5 text-xs text-[var(--text-secondary)]">
                  {STATUS_LABEL[row.status] ?? row.status}
                </span>
              </div>
              <p className="mt-1 text-sm text-[var(--text-secondary)]">{Number(row.point_amount).toLocaleString()}P</p>
              <p className="mt-1 text-xs text-[var(--text-secondary)]">
                신청일 {new Date(row.requested_at).toLocaleString("ko-KR")}
              </p>
            </article>
          ))
        )}
      </section>
    </MyPageLayout>
  );
}
