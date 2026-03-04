import MyPageLayout from "@/components/mypage/MyPageLayout";
import { cookies } from "next/headers";

const TYPE_LABEL: Record<string, string> = {
  EARN: "적립",
  USE: "사용",
  EXPIRE: "소멸",
  ADJUST: "조정",
  RESERVE: "예약",
  RELEASE: "예약해제",
};

async function fetchPoints(baseUrl: string, cookieHeader: string) {
  const res = await fetch(`${baseUrl}/api/me/points`, {
    headers: { Cookie: cookieHeader },
    cache: "no-store",
  });
  if (!res.ok) return null;
  return res.json();
}

export default async function MyPagePointsPage() {
  const cookieStore = await cookies();
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
  const data = await fetchPoints(baseUrl, cookieStore.toString());
  const ledger = Array.isArray(data?.ledger) ? data.ledger : [];
  return (
    <MyPageLayout title="포인트" description="잔액 및 포인트 내역을 확인할 수 있습니다.">
      <div className="space-y-6">
        <section className="flex flex-col space-y-3 sm:space-y-0 sm:grid sm:grid-cols-2 sm:gap-4">
          <article className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-4">
            <p className="text-sm text-[var(--text-secondary)]">포인트 잔액</p>
            <p className="mt-2 text-2xl font-semibold text-[var(--text-primary)]">
              {Number(data?.balance ?? 0).toLocaleString()}P
            </p>
          </article>
          <article className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-4">
            <p className="text-sm text-[var(--text-secondary)]">적립 예정</p>
            <p className="mt-2 text-2xl font-semibold text-[var(--text-primary)]">
              {Number(data?.pending ?? 0).toLocaleString()}P
            </p>
          </article>
        </section>
        {Number(data?.expiringSoon ?? 0) > 0 ? (
          <p className="rounded-lg border border-[var(--warning)] bg-[var(--warning-bg)] px-3 py-2 text-sm text-[var(--warning)]">
            30일 이내 소멸 예정 포인트: {Number(data?.expiringSoon ?? 0).toLocaleString()}P
          </p>
        ) : null}
        <a
          href="/mypage/points/request"
          className="inline-flex rounded-lg border border-[var(--border)] bg-[var(--surface-muted)] px-3 py-2 text-sm text-[var(--text-primary)]"
        >
          예약 증빙으로 포인트 적립 요청하기
        </a>

        <section className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-4">
          <h2 className="text-base font-semibold text-[var(--text-primary)]">포인트 내역</h2>
          <ul className="mt-3 space-y-2">
            {ledger.length === 0 ? (
              <li className="rounded-lg border border-[var(--border)] px-3 py-2 text-sm text-[var(--text-secondary)]">
                포인트 내역이 없습니다.
              </li>
            ) : (
              ledger.map((item: { id: string; type: string; status: string; amount: number; reason: string | null; created_at: string }) => (
                <li key={item.id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-[var(--border)] px-3 py-2">
                  <div>
                    <p className="text-sm font-medium text-[var(--text-primary)]">
                      {TYPE_LABEL[item.type] ?? item.type} · {item.reason ?? "-"}
                    </p>
                    <p className="text-xs text-[var(--text-secondary)]">{new Date(item.created_at).toLocaleString("ko-KR")}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-semibold text-[var(--text-primary)]">{Number(item.amount).toLocaleString()}P</p>
                    <span className="rounded-md bg-[var(--surface-muted)] px-2 py-0.5 text-xs text-[var(--text-secondary)]">
                      {item.status}
                    </span>
                  </div>
                </li>
              ))
            )}
          </ul>
        </section>
      </div>
    </MyPageLayout>
  );
}
