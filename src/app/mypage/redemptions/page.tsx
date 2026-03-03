import { cookies } from "next/headers";
import { getMemberSessionFromCookies } from "@/lib/memberSession";
import RedemptionsHistoryClient from "@/components/mypage/RedemptionsHistoryClient";

async function fetchRedemptions(baseUrl: string, cookieHeader: string) {
  const res = await fetch(`${baseUrl}/api/me/rewards/redemptions`, {
    headers: { Cookie: cookieHeader },
    cache: "no-store",
  });
  if (!res.ok) return [];
  return res.json();
}

async function fetchNotifications(baseUrl: string, cookieHeader: string) {
  const res = await fetch(`${baseUrl}/api/me/notifications?limit=30`, {
    headers: { Cookie: cookieHeader },
    cache: "no-store",
  });
  if (!res.ok) return [];
  return res.json();
}

export default async function MypageRedemptionsPage() {
  const cookieStore = await cookies();
  const session = getMemberSessionFromCookies(cookieStore);
  if (!session) return null;

  const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
  const cookieHeader = cookieStore.toString();

  const [redemptions, notifications] = await Promise.all([
    fetchRedemptions(baseUrl, cookieHeader),
    fetchNotifications(baseUrl, cookieHeader),
  ]);

  return (
    <div className="space-y-8">
      <section className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-6">
        <h2 className="mb-4 text-lg font-semibold text-[var(--text-primary)]">교환 신청 내역</h2>
        <RedemptionsHistoryClient redemptions={redemptions} notifications={notifications} />
      </section>
    </div>
  );
}
