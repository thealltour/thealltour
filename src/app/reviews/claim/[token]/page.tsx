"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { solidButtonShadowClasses } from "@/components/ui/Button";
import { cn } from "@/lib/cn";
import SiteHeaderUI from "@/components/site-chrome/SiteHeaderUI";
import { SectionBody } from "@/components/layout/SectionBody";
import { ContentCard } from "@/components/layout/ContentCard";

type ClaimStatus = "loading" | "success" | "error" | "need_login";
type ErrorType = "not_found" | "expired" | "already_submitted" | "already_claimed_by_other" | "unauthorized" | "unknown";

const ERROR_MESSAGES: Record<ErrorType, { title: string; description: string }> = {
  not_found: {
    title: "유효하지 않은 링크",
    description: "후기 작성 링크가 올바르지 않습니다. 링크를 다시 확인해주세요.",
  },
  expired: {
    title: "링크 만료",
    description: "후기 작성 링크가 만료되었습니다. 새 링크를 요청해주세요.",
  },
  already_submitted: {
    title: "이미 작성된 후기",
    description: "이 여행건의 후기가 이미 작성되었습니다.",
  },
  already_claimed_by_other: {
    title: "이미 연결된 권한",
    description: "이 후기 작성 권한은 다른 계정에서 이미 연결되었습니다.",
  },
  unauthorized: {
    title: "로그인 필요",
    description: "후기를 작성하려면 로그인이 필요합니다.",
  },
  unknown: {
    title: "오류 발생",
    description: "후기 권한 연결 중 오류가 발생했습니다. 잠시 후 다시 시도해주세요.",
  },
};

export default function ClaimTokenPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const router = useRouter();
  const [status, setStatus] = useState<ClaimStatus>("loading");
  const [errorType, setErrorType] = useState<ErrorType>("unknown");
  const [token, setToken] = useState<string>("");

  useEffect(() => {
    async function claim() {
      const { token: claimToken } = await params;
      setToken(claimToken);

      try {
        const response = await fetch("/api/reviews/claim", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ claim_token: claimToken }),
        });

        const result = await response.json() as { success?: boolean; error?: string; message?: string };

        if (response.status === 401) {
          setStatus("need_login");
          setErrorType("unauthorized");
          return;
        }

        if (result.success) {
          setStatus("success");
          setTimeout(() => {
            router.push("/mypage/reviews");
          }, 2000);
          return;
        }

        setStatus("error");
        setErrorType((result.error as ErrorType) || "unknown");
      } catch {
        setStatus("error");
        setErrorType("unknown");
      }
    }

    claim();
  }, [params, router]);

  return (
    <div className="min-h-screen bg-gradient-to-b from-[#f3f8ff] to-white text-content-primary">
      <SiteHeaderUI activeTab="reviews" session={null} memberPoints={null} />
      <SectionBody className="flex flex-col items-center gap-[var(--space-5)] py-12">
        <ContentCard className="w-full max-w-md text-center">
          {status === "loading" && (
            <div className="space-y-4 py-8">
              <div className="mx-auto h-12 w-12 animate-spin rounded-full border-4 border-blue-200 border-t-blue-600" />
              <p className="text-sm text-[var(--text-secondary)]">
                후기 작성 권한을 연결하고 있습니다...
              </p>
            </div>
          )}

          {status === "success" && (
            <div className="space-y-4 py-8">
              <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-green-100">
                <svg className="h-8 w-8 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <div>
                <h2 className="text-lg font-bold text-[var(--text-primary)]">
                  연결 완료
                </h2>
                <p className="mt-2 text-sm text-[var(--text-secondary)]">
                  후기 작성 권한이 연결되었습니다.
                </p>
                <p className="mt-1 text-xs text-[var(--text-muted)]">
                  마이페이지로 이동합니다...
                </p>
              </div>
            </div>
          )}

          {status === "need_login" && (
            <div className="space-y-4 py-8">
              <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-blue-100">
                <svg className="h-8 w-8 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                </svg>
              </div>
              <div>
                <h2 className="text-lg font-bold text-[var(--text-primary)]">
                  로그인이 필요합니다
                </h2>
                <p className="mt-2 text-sm text-[var(--text-secondary)]">
                  후기를 작성하려면 먼저 로그인해주세요.
                </p>
              </div>
              <div className="flex flex-col gap-2 pt-2">
                <Link
                  href={`/auth/signin?redirect=/reviews/claim/${token}`}
                  className={cn(
                    "inline-flex items-center justify-center rounded-lg bg-[var(--primary)] px-6 py-3 text-sm font-medium text-white transition hover:bg-[var(--primary-dark)]",
                    solidButtonShadowClasses,
                  )}
                >
                  로그인하기
                </Link>
                <Link
                  href={`/auth/signup?redirect=/reviews/claim/${token}`}
                  className="inline-flex items-center justify-center rounded-lg border border-[var(--border)] bg-white px-6 py-3 text-sm font-medium text-[var(--text-primary)] transition hover:bg-[var(--surface-hover)]"
                >
                  회원가입하기
                </Link>
              </div>
            </div>
          )}

          {status === "error" && errorType !== "unauthorized" && (
            <div className="space-y-4 py-8">
              <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-red-100">
                <svg className="h-8 w-8 text-red-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </div>
              <div>
                <h2 className="text-lg font-bold text-[var(--text-primary)]">
                  {ERROR_MESSAGES[errorType].title}
                </h2>
                <p className="mt-2 text-sm text-[var(--text-secondary)]">
                  {ERROR_MESSAGES[errorType].description}
                </p>
              </div>
              <div className="pt-2">
                <Link
                  href="/"
                  className="inline-flex items-center justify-center rounded-lg border border-[var(--border)] bg-white px-6 py-3 text-sm font-medium text-[var(--text-primary)] transition hover:bg-[var(--surface-hover)]"
                >
                  홈으로 돌아가기
                </Link>
              </div>
            </div>
          )}
        </ContentCard>
      </SectionBody>
    </div>
  );
}
