import Link from "next/link";
import { buttonVariants } from "@/components/ui/Button";
import { cn } from "@/lib/cn";

export default function NotFound() {
  return (
    <div className="flex min-h-[60vh] items-center justify-center bg-gradient-to-b from-[var(--surface-muted)] to-[var(--surface)] px-4 py-16">
      <div className="w-full max-w-md rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-8 text-center shadow-[var(--shadow-soft)]">
        <h1 className="text-xl font-semibold text-[var(--text-primary)]">페이지를 찾을 수 없어요</h1>
        <p className="mt-3 text-sm leading-relaxed text-[var(--text-muted)]">
          주소가 변경되었거나
          <br />
          더 이상 제공되지 않는 페이지일 수 있습니다.
        </p>
        <div className="mt-8 flex flex-col gap-3">
          <Link
            href="/products"
            className={cn(buttonVariants({ variant: "primary", size: "md" }), "w-full")}
          >
            여행 상품 둘러보기
          </Link>
          <Link
            href="/"
            className={cn(buttonVariants({ variant: "outline", size: "md" }), "w-full")}
          >
            홈으로
          </Link>
        </div>
      </div>
    </div>
  );
}
