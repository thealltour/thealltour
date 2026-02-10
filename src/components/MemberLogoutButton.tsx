"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export default function MemberLogoutButton() {
  const router = useRouter();
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleLogout() {
    setIsSubmitting(true);
    try {
      await fetch("/api/members/logout", { method: "POST" });
    } finally {
      router.refresh();
      setIsSubmitting(false);
    }
  }

  return (
    <button
      type="button"
      onClick={handleLogout}
      disabled={isSubmitting}
      className="transition hover:text-slate-600 disabled:cursor-not-allowed"
    >
      {isSubmitting ? "로그아웃 중..." : "로그아웃"}
    </button>
  );
}
