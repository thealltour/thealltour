import Link from "next/link";
import SiteHeader from "@/components/site-chrome/SiteHeader";

export const metadata = {
  title: "변경 이력",
  description: "더올투어 서비스 변경 이력 및 릴리즈 안내",
};

const ENTRIES = [
  {
    date: "2026-04",
    title: "운영·보안",
    items: [
      "관리자 세션을 JWT(HS256) 기반으로 강화",
      "프로덕션 크론 엔드포인트에 CRON_SECRET 필수 적용",
      "선택적 Sentry 연동 및 배치 실패 시 Slack 알림 지원",
      "서비스 상태·변경 이력·개인정보 요청 안내 페이지 추가",
    ],
  },
] as const;

export default function ChangelogPage() {
  return (
    <div className="min-h-screen page-bg-wash text-[var(--text-primary)]">
      <SiteHeader />
      <main className="mx-auto w-full max-w-3xl space-y-8 px-6 py-12 md:px-10">
        <section className="rounded-3xl bg-[var(--primary)] p-8 text-[var(--on-primary)] shadow-xl">
          <h1 className="text-3xl font-bold md:text-4xl">변경 이력</h1>
          <p className="mt-2 text-sm text-blue-100">주요 기능·보안·운영 변경을 요약해 올립니다.</p>
        </section>
        <div className="space-y-8">
          {ENTRIES.map((entry) => (
            <section
              key={entry.date}
              className="rounded-3xl bg-white p-8 shadow-md ring-1 ring-[var(--primary-soft)]"
            >
              <h2 className="text-lg font-bold text-slate-900">
                {entry.date} — {entry.title}
              </h2>
              <ul className="mt-4 list-inside list-disc space-y-2 text-sm leading-7 text-slate-700">
                {entry.items.map((line) => (
                  <li key={line}>{line}</li>
                ))}
              </ul>
            </section>
          ))}
        </div>
        <p className="text-center text-sm text-slate-500">
          상세 커밋 이력은 저장소 또는 내부 위키를 참고하세요.{" "}
          <Link href="/status" className="text-[var(--primary)] underline underline-offset-2">
            서비스 상태
          </Link>
        </p>
      </main>
    </div>
  );
}
