import Link from "next/link";

export default function MypageProfilePage() {
  return (
    <div className="space-y-8">
      <section className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-6">
        <h2 className="mb-4 text-lg font-semibold text-[var(--text-primary)]">개인정보 / 배송지</h2>
        <p className="text-sm text-[var(--text-muted)]">
          개인정보 수정 및 기본 배송지 관리는 준비 중입니다. 문의 사항은 고객센터로 연락해 주세요.
        </p>
        <Link
          href="/mypage"
          className="mt-4 inline-block text-sm font-medium text-[var(--primary)] underline-offset-2 hover:underline"
        >
          대시보드로 돌아가기
        </Link>
      </section>
    </div>
  );
}
