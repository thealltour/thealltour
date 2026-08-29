import Link from "next/link";
import { cookies } from "next/headers";
import SiteHeader from "@/components/site-chrome/SiteHeader";
import { OrderSuccessAnalytics } from "@/components/orders/OrderSuccessAnalytics";
import { getMemberSessionFromCookies } from "@/lib/memberSession";
import { getSiteSettings } from "@/lib/siteSettings";

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

  const cookieStore = await cookies();
  const session = getMemberSessionFromCookies(cookieStore);
  const isMember = Boolean(session?.memberId);

  const settings = await getSiteSettings();
  const kakaoHref =
    settings.kakao_chat_url?.trim() ||
    settings.kakao_channel_url?.trim() ||
    "https://pf.kakao.com";

  const memberDetailHref = bookingNumber
    ? `/mypage/bookings/${encodeURIComponent(bookingNumber)}`
    : bookingId
      ? `/mypage/bookings/${encodeURIComponent(bookingId)}`
      : "/mypage/bookings";

  return (
    <div className="min-h-screen bg-[var(--bg)] text-[var(--fg)]">
      <SiteHeader />
      <OrderSuccessAnalytics hasBookingNumber={Boolean(bookingNumber)} isMember={isMember} />
      <main className="mx-auto flex w-full max-w-lg flex-col px-5 py-16 sm:py-24">
        <p className="text-xs font-medium uppercase tracking-wide text-slate-400">예약 접수</p>
        <h1 className="mt-2 text-2xl font-semibold tracking-tight text-slate-900 sm:text-3xl">
          예약 접수가 완료되었습니다
        </h1>
        <p className="mt-3 text-sm leading-relaxed text-slate-600">
          결제가 확인되었습니다. 예약이 정상적으로 접수되었으며, 담당 매니저 확인 후 다음 절차를
          안내해 드립니다.
        </p>

        {bookingNumber ? (
          <div className="mt-8 rounded-2xl border border-slate-200 bg-white px-4 py-5">
            <p className="text-xs font-medium text-slate-500">예약번호</p>
            <p className="mt-1.5 font-mono text-xl font-semibold tracking-wide text-slate-900 sm:text-2xl">
              {bookingNumber}
            </p>
            {!isMember ? (
              <p className="mt-3 text-xs leading-relaxed text-slate-500">
                예약 확인 및 상담 시 필요한 번호입니다. 안전하게 보관해 주세요.
              </p>
            ) : (
              <p className="mt-3 text-xs leading-relaxed text-slate-500">
                마이페이지 예약 내역에서도 확인할 수 있습니다.
              </p>
            )}
          </div>
        ) : (
          <p className="mt-8 text-sm text-slate-600">
            예약번호 확인이 지연될 수 있습니다. 문자·이메일 안내를 확인해 주세요.
          </p>
        )}

        <div className="mt-10 flex flex-col gap-3 sm:flex-row">
          {isMember ? (
            <>
              <Link
                href={memberDetailHref}
                className="inline-flex min-h-12 items-center justify-center rounded-xl bg-[var(--accent)] px-5 text-sm font-semibold text-[var(--on-accent)]"
              >
                예약 상세 보기
              </Link>
              <Link
                href="/products"
                className="inline-flex min-h-12 items-center justify-center rounded-xl border border-slate-200 bg-white px-5 text-sm font-semibold text-slate-800"
              >
                다른 여행 둘러보기
              </Link>
            </>
          ) : (
            <>
              <a
                href={kakaoHref}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex min-h-12 items-center justify-center rounded-xl bg-[var(--accent)] px-5 text-sm font-semibold text-[var(--on-accent)]"
              >
                카톡으로 예약 문의하기
              </a>
              <Link
                href="/products"
                className="inline-flex min-h-12 items-center justify-center rounded-xl border border-slate-200 bg-white px-5 text-sm font-semibold text-slate-800"
              >
                여행상품 둘러보기
              </Link>
            </>
          )}
        </div>

        {!isMember ? (
          <p className="mt-4 text-center text-xs text-slate-400">
            <Link href="/" className="underline-offset-2 hover:underline">
              홈으로
            </Link>
          </p>
        ) : (
          <p className="mt-4 text-center text-xs text-slate-400">
            <Link href="/" className="underline-offset-2 hover:underline">
              홈으로
            </Link>
          </p>
        )}
      </main>
    </div>
  );
}
