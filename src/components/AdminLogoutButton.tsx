"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export default function AdminLogoutButton() {
  const router = useRouter();
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleLogout() {
    setIsSubmitting(true);
    try {
      await fetch("/api/admin/logout", { method: "POST" });
    } finally {
      router.push("/theall_manager_only/login");
      router.refresh();
      setIsSubmitting(false);
    }
  }

  return (
    <button
      type="button"
      onClick={handleLogout}
      disabled={isSubmitting}
      className="rounded-lg border border-[#bfdbfe] bg-white px-4 py-2 text-sm font-medium text-[#1e3a8a] transition hover:bg-[#eff6ff] disabled:cursor-not-allowed"
    >
      {isSubmitting ? "로그아웃 중..." : "로그아웃"}
    </button>
  );
}
