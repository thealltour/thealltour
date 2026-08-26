"use client";

import { useCallback, useEffect, useState } from "react";
import { formatPhoneInput } from "@/lib/payments/checkoutFormValidation";

export type MemberCheckoutProfile = {
  name: string;
  phone: string;
  email: string;
};

export type MemberCheckoutProfileState = {
  status: "loading" | "guest" | "member";
  profile: MemberCheckoutProfile | null;
  refresh: () => Promise<void>;
};

/**
 * 간편 결제 모달용 회원 프로필.
 * /api/me/profile 은 비회원도 200(authenticated:false) — 401 콘솔 노이즈 없음.
 */
export function useMemberCheckoutProfile(): MemberCheckoutProfileState {
  const [status, setStatus] = useState<"loading" | "guest" | "member">("loading");
  const [profile, setProfile] = useState<MemberCheckoutProfile | null>(null);

  const refresh = useCallback(async () => {
    setStatus((prev) => (prev === "member" ? "member" : "loading"));
    try {
      const res = await fetch("/api/me/profile", {
        cache: "no-store",
        credentials: "include",
      });

      if (!res.ok) {
        console.error("[useMemberCheckoutProfile] profile fetch failed", res.status);
        setStatus((prev) => (prev === "member" ? "member" : "guest"));
        return;
      }

      const data = (await res.json()) as {
        authenticated?: boolean;
        name?: string;
        phone?: string;
        email?: string;
      };

      if (data.authenticated === false) {
        setStatus("guest");
        setProfile(null);
        return;
      }

      setProfile({
        name: String(data.name ?? "").trim(),
        phone: formatPhoneInput(String(data.phone ?? "")),
        email: String(data.email ?? "").trim(),
      });
      setStatus("member");
    } catch (error) {
      console.error("[useMemberCheckoutProfile]", error);
      setStatus((prev) => (prev === "member" ? "member" : "guest"));
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  return { status, profile, refresh };
}
