import { cookies } from "next/headers";
import { getMemberSessionFromCookies } from "@/lib/memberSession";

const LEDGER_TYPE_LABEL: Record<string, string> = {
  EARN: "적립",
  USE: "사용",
  EXPIRE: "소멸",
  ADJUST: "조정",
  RESERVE: "예약(경품)",
  RELEASE: "예약 해제",
};

async function fetchPoints(baseUrl: string, cookieHeader: string) {
  const res = await fetch(`${baseUrl}/api/me/points`, {
    headers: { Cookie: cookieHeader },
    cache: "no-store",
  });
  if (!res.ok) return null;
  return res.json();
}

function formatDate(iso: string) {
  try {
    return new Date(iso).toLocaleDateString("ko-KR", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return iso;
  }
}

export default async function MypagePointsPage() {
  const cookieStore = await cookies();
  const session = getMemberSessionFromCookies(cookieStore);
  if (!session) return null;

  const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
  const pointsData = await fetchPoints(baseUrl, cookieStore.toString());
  if (!pointsData) {
    return (
      <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-6 text-[var(--text-muted)]">
        포인트 정보를 불러올 수 없습니다.
      </div>
    );
  }

  const balance = pointsData.balance ?? 0;
  const pending = pointsData.pending ?? 0;
  const expiringSoon = pointsData.expiringSoon ?? 0;
  const ledger: Array<{
    id: string;
    type: string;
    status: string;
    amount: number;
    reason: string | null;
    ref_type: string | null;
    ref_id: string | null;
    expires_at: string | null;
    created_at: string;
  }> = pointsData.ledger ?? [];
  const now = new Date();
  const in30Days = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);

  return (
    <div className="space-y-8">
      <section className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-6">
        <h2 className="mb-4 text-lg font-semibold text-[var(--text-primary)]">포인트 현황</h2>
        <div className="grid gap-4 sm:grid-cols-3">
          <div>
            <p className="text-sm text-[var(--text-muted)]">사용 가능</p>
            <p className="text-2xl font-bold text-[var(--primary)]">{Number(balance).toLocaleString()}P</p>
          </div>
          <div>
            <p className="text-sm text-[var(--text-muted)]">적립 대기</p>
            <p className="text-xl font-semibold text-[var(--text-secondary)]">{Number(pending).toLocaleString()}P</p>
          </div>
          <div>
            <p className="text-sm text-[var(--text-muted)]">소멸 예정 (30일 이내)</p>
            <p className="text-xl font-semibold text-[var(--warning)]">{Number(expiringSoon).toLocaleString()}P</p>
          </div>
        </div>
      </section>

      <section className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-6">
        <h2 className="mb-4 text-lg font-semibold text-[var(--text-primary)]">포인트 내역</h2>
        {ledger.length === 0 ? (
          <p className="text-sm text-[var(--text-muted)]">아직 내역이 없습니다.</p>
        ) : (
          <ul className="space-y-2">
            {ledger.map((row) => {
              const isEarn = row.type === "EARN";
              const isExpiringSoon =
                row.type === "EARN" &&
                row.expires_at &&
                new Date(row.expires_at) <= in30Days &&
                new Date(row.expires_at) >= now;
              return (
                <li
                  key={row.id}
                  className={`flex flex-wrap items-center justify-between gap-2 rounded-lg border border-[var(--border)] p-3 ${
                    isExpiringSoon ? "border-[var(--warning)] bg-[var(--warning-bg)]" : "bg-[var(--surface-muted)]"
                  }`}
                >
                  <div className="min-w-0 flex-1">
                    <span className="font-medium text-[var(--text-primary)]">
                      {LEDGER_TYPE_LABEL[row.type] ?? row.type}
                      {row.reason ? ` · ${row.reason}` : ""}
                    </span>
                    <div className="mt-0.5 flex flex-wrap items-center gap-2 text-xs text-[var(--text-muted)]">
                      <span
                        className={`rounded px-1.5 py-0.5 font-medium ${
                          row.status === "CONFIRMED" ? "bg-[var(--success-bg)] text-[var(--success)]" : "bg-[var(--warning-bg)] text-[var(--warning)]"
                        }`}
                      >
                        {row.status === "CONFIRMED" ? "확정" : row.status}
                      </span>
                      {isExpiringSoon && row.expires_at && (
                        <span className="text-[var(--warning)]">소멸 예정 {formatDate(row.expires_at)}</span>
                      )}
                    </div>
                  </div>
                  <span
                    className={`shrink-0 font-semibold ${
                      isEarn ? "text-[var(--success)]" : "text-[var(--danger)]"
                    }`}
                  >
                    {isEarn ? "+" : "-"}
                    {Number(row.amount).toLocaleString()}P
                  </span>
                  <span className="w-full shrink-0 text-right text-xs text-[var(--text-muted)] sm:w-auto">
                    {formatDate(row.created_at)}
                  </span>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}
