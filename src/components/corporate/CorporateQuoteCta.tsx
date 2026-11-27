import Link from "next/link";
import { buttonVariants } from "@/components/ui/Button";
import { cn } from "@/lib/cn";

export function CorporateQuoteCta({
  href,
  label = "기업·기관 견적 요청",
  className,
}: {
  href: string;
  label?: string;
  className?: string;
}) {
  return (
    <Link
      href={href}
      className={cn(buttonVariants({ variant: "accent", size: "md" }), className)}
    >
      {label}
    </Link>
  );
}
