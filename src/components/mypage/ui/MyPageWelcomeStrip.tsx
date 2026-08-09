import { cn } from "@/lib/cn";

type MyPageWelcomeStripProps = {
  userName?: string | null;
  /** @deprecated 대시보드는 benefitHeadline 사용 */
  points?: number | null;
  benefitHeadline?: string | null;
  benefitCaption?: string | null;
  className?: string;
};

export function MyPageWelcomeStrip({
  userName,
  points,
  benefitHeadline,
  benefitCaption = "골프투어 혜택",
  className,
}: MyPageWelcomeStripProps) {
  const displayName = userName?.trim() || "회원";
  const headline =
    benefitHeadline?.trim() ||
    (typeof points === "number" ? `${points.toLocaleString("ko-KR")}P` : null);
  const caption = benefitHeadline?.trim()
    ? benefitCaption?.trim() || "골프투어 혜택"
    : typeof points === "number"
      ? "포인트 잔액"
      : null;

  return (
    <div
      className={cn(
        "relative overflow-hidden rounded-2xl border border-[var(--primary)]/20 p-5 sm:p-6",
        "bg-[var(--primary)] [background-image:var(--gradient-primary)] text-white shadow-[var(--shadow-soft-strong)]",
        className,
      )}
    >
      <div className="relative z-[1] flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-sm font-medium text-white/80">THEALL TOUR MEMBERS</p>
          <h2 className="mt-1 text-xl font-semibold tracking-tight sm:text-2xl">
            {displayName}님, 안녕하세요
          </h2>
          <p className="mt-1 text-sm text-white/75">여행·포인트·리워드를 한곳에서 관리하세요.</p>
        </div>
        {headline ? (
          <div className="rounded-xl bg-white/15 px-4 py-3 backdrop-blur-sm">
            <p className="text-xs font-medium text-white/80">{caption}</p>
            <p className="font-price-strong mt-0.5 text-2xl text-white">{headline}</p>
          </div>
        ) : null}
      </div>
      <div
        aria-hidden
        className="pointer-events-none absolute -right-8 -top-8 size-32 rounded-full bg-white/10 blur-2xl"
      />
    </div>
  );
}
