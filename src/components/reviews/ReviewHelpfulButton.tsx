"use client";

import { useState } from "react";
import { usePathname } from "next/navigation";
import { useAuthModal } from "@/components/auth/AuthModalProvider";

type Props = {
  reviewId: string;
  helpfulCount?: number;
  viewerVotedHelpful?: boolean;
};

export default function ReviewHelpfulButton({
  reviewId,
  helpfulCount: initialCount = 0,
  viewerVotedHelpful: initialVoted = false,
}: Props) {
  const pathname = usePathname();
  const { openAuth } = useAuthModal();
  const [count, setCount] = useState(initialCount);
  const [voted, setVoted] = useState(initialVoted);
  const [loading, setLoading] = useState(false);

  const handleClick = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (loading) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/reviews/${reviewId}/vote`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ voteType: "helpful" }),
        credentials: "include",
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        const msg = data?.message ?? "투표에 실패했습니다.";
        if (res.status === 401) {
          openAuth({ mode: "login", next: pathname });
          return;
        }
        alert(msg);
        return;
      }
      const data = (await res.json()) as { helpfulCount: number; voted: boolean };
      setCount(data.helpfulCount);
      setVoted(data.voted);
    } finally {
      setLoading(false);
    }
  };

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={loading}
      className={`inline-flex items-center gap-1 rounded-full border px-3 py-1.5 text-sm transition ${
        voted
          ? "border-blue-600 bg-blue-50 text-blue-700"
          : "border-slate-200 bg-white text-slate-600 hover:border-slate-300 hover:bg-slate-50"
      } ${loading ? "pointer-events-none opacity-70" : ""}`}
      aria-pressed={voted}
    >
      <span aria-hidden>👍</span>
      <span>도움됨</span>
      {count > 0 && <span className="font-medium">{count}</span>}
    </button>
  );
}
