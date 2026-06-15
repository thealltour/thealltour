"use client";

import { useEffect } from "react";
import { useSearchParams } from "next/navigation";
import { useAuthModal } from "@/components/auth/AuthModalProvider";
import { sanitizeNextPath } from "@/lib/auth/redirect";

type AuthPageAutoOpenProps = {
  mode?: "login" | "signup";
};

export default function AuthPageAutoOpen({ mode = "login" }: AuthPageAutoOpenProps) {
  const searchParams = useSearchParams();
  const { openAuth } = useAuthModal();

  const nextParam = searchParams.get("next");
  const errorParam = searchParams.get("error");

  useEffect(() => {
    openAuth({
      mode,
      next: sanitizeNextPath(nextParam ?? undefined),
      error: errorParam,
    });
  }, [mode, openAuth, nextParam, errorParam]);

  return null;
}
