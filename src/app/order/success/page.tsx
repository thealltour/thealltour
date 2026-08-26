import Link from "next/link";
import SiteHeader from "@/components/site-chrome/SiteHeader";

type OrderSuccessPageProps = {
  searchParams: Promise<{
    bookingNumber?: string;
    bookingId?: string;
  }>;
};

export default async function OrderSuccessPage({ searchParams }: OrderSuccessPageProps) {
  const params = await searchParams;
  const bookingNumber = params.bookingNumber?.trim() || null;
  const bookingId = params.bookingId?.trim() || null;
  const detailHref = bookingNumber
    ? `/mypage/bookings/${encodeURIComponent(bookingNumber)}`
    : bookingId
      ? `/mypage/bookings/${encodeURIComponent(bookingId)}`
      : "/mypage/bookings";

  return (
    <div className="min-h-screen bg-[var(--bg)] text-[var(--fg)]">
      <SiteHeader />
      <main className="mx-auto flex w-full max-w-lg flex-col px-5 py-16 sm:py-24">
        <p className="text-xs font-medium uppercase tracking-wide text-slate-400">예약 완료</p>
        <h1 className="mt-2 text-2xl font-semibold tracking-tight text-slate-900 sm:text-3xl">
          결제가 확인되었습니다
        </h1>
        <p className="mt-3 text-sm leading-relaxed text-slate-600">
          포트원 서버 검증이 완료되어 예약금이 반영되었습니다. 매니저가 일정·좌석을 확인한 뒤
          잔금 안내를 드립니다.
        </p>

        {bookingNumber ? (
          <div className="mt-8 border-y border-slate-200 py-5">
            <p className="text-xs font-medium text-slate-500">예약번호</p>
            <p className="mt-1 font-mono text-lg font-semibold tracking-wide text-slate-900">
              {bookingNumber}
            </p>
            <p className="mt-2 text-xs text-slate-500">
              비회원으로 결제하신 경우 예약번호를 안전하게 보관해 주세요.
            </p>
          </div>
        ) : (
          <p className="mt-8 text-sm text-slate-600">
            예약번호 확인이 지연될 수 있습니다. 문자·이메일 안내를 확인해 주세요.
          </p>
        )}

        <div className="mt-10 flex flex-col gap-3 sm:flex-row">
          <Link
            href={detailHref}
            className="inline-flex min-h-12 items-center justify-center rounded-xl bg-[var(--accent)] px-5 text-sm font-semibold text-[var(--on-accent)]"
          >
            예약 상세 보기
          </Link>
          <Link
            href="/"
            className="inline-flex min-h-12 items-center justify-center rounded-xl border border-slate-200 bg-white px-5 text-sm font-semibold text-slate-800"
          >
            홈으로
          </Link>
        </div>
      </main>
    </div>
  );
}
