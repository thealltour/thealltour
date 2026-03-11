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
      className="btn-admin-secondary disabled:cursor-not-allowed disabled:opacity-60"
    >
      {isSubmitting ? "로그아웃 중..." : "로그아웃"}
    </button>
  );
}
