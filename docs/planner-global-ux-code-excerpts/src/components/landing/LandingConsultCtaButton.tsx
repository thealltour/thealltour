"use client";

import { usePathname } from "next/navigation";
import { useConsultModal } from "@/components/inquiry/ConsultModal";

type LandingConsultCtaButtonProps = {
  label: string;
  className?: string;
};

export function LandingConsultCtaButton({
  label,
  className,
}: LandingConsultCtaButtonProps) {
  const pathname = usePathname();
  const { openModal } = useConsultModal();

  return (
    <button
      type="button"
      onClick={() =>
        openModal({
          sourcePath: `${pathname || "/"}#landing-hero-consult`,
        })
      }
      className={className}
    >
      {label}
    </button>
  );
}
