import { cookies } from "next/headers";
import Link from "next/link";
import { getMemberSessionFromCookies } from "@/lib/memberSession";
import RewardsCatalogClient from "@/components/mypage/RewardsCatalogClient";

async function fetchCatalog() {
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
  const res = await fetch(`${baseUrl}/api/rewards/catalog`, { cache: "no-store" });
  if (!res.ok) return [];
  return res.json();
}

export default async function MypageRewardsPage() {
  const cookieStore = await cookies();
  const session = getMemberSessionFromCookies(cookieStore);
  if (!session) return null;

  const catalog = await fetchCatalog();

  return (
    <div className="space-y-8">
      <p className="text-sm text-[var(--text-muted)]">
        포인트로 경품을 교환할 수 있습니다. 교환 신청 시 포인트가 즉시 차감되며, 승인 후 발송됩니다.
      </p>
      <RewardsCatalogClient catalog={catalog} />
      <p>
        <Link
          href="/mypage/redemptions"
          className="inline-flex items-center rounded-lg bg-[var(--surface-muted)] px-4 py-2 text-sm font-medium text-[var(--text-primary)] border border-[var(--border)] hover:bg-[var(--border)]"
        >
          교환 신청 내역 보기
        </Link>
      </p>
    </div>
  );
}
