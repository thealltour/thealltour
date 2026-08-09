"use client";

import { useEffect, useMemo, useState, type ChangeEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { cn } from "@/lib/cn";
import { buildAdminBookingNewUrl } from "@/lib/bookings/bookingNewUrl";
import { MemberInquiryLinkPanel } from "@/components/admin/members/MemberInquiryLinkPanel";
import {
  COUPON_PACKS,
  type CouponPackTier,
} from "@/lib/points/couponPacks";

type Props = {
  memberId: string;
  mode?: "page" | "modal";
  onClose?: () => void;
  navigation?: {
    currentIndex: number;
    total: number;
    onPrev: () => void;
    onNext: () => void;
    hasPrev: boolean;
    hasNext: boolean;
  };
};

type MemberDetail = {
  id: string;
  username: string;
  name: string;
  phone: string;
  /** 소셜(카카오) 가입 시 이메일 동의항목을 받지 않으면 null일 수 있음 */
  email: string | null;
  birth_date: string;
  gender: "male" | "female" | "other";
  agree_email: boolean;
  points?: number;
  point_balance?: number;
  point_pending?: number;
  created_at: string | null;
};

type PointLedgerRow = {
  id: string;
  type: string;
  status: string;
  amount: number;
  reason: string | null;
  ref_type: string | null;
  ref_id: string | null;
  expires_at: string | null;
  created_at: string;
};

type ReviewEligibilityRow = {
  eligibility_id: string | null;
  eligibility_status: string | null;
  claimed_by_member_id: string | null;
  inquiry_id: string | null;
  inquiry_created_at: string | null;
  product_title: string | null;
  product_id: string | null;
  booking_status: string | null;
  booking_id: string | null;
  departure_date: string | null;
  return_date: string | null;
  customer_profile_id: string;
  can_claim: boolean;
  claim_reason: string | null;
};

const TYPE_LABEL: Record<string, string> = {
  EARN: "적립",
  USE: "사용",
  ADJUST: "조정",
  EXPIRE: "소멸",
  RESERVE: "예약",
  RELEASE: "해제",
};

const STATUS_LABEL: Record<string, string> = {
  CONFIRMED: "확정",
  PENDING: "대기",
  CANCELED: "취소",
};

const BOOKING_STATUS_LABEL: Record<string, string> = {
  none: "미예약",
  reserved: "예약 확정",
  completed: "여행 완료",
  canceled: "취소",
};

const ELIGIBILITY_STATUS_LABEL: Record<string, string> = {
  eligible: "작성 가능",
  claimed: "회원 연결됨",
  submitted: "작성 완료",
  expired: "만료",
  blocked: "차단",
};

const REASON_PRESETS = [
  "관리자 지급",
  "예약 확인 적립",
  "이벤트 지급",
  "CS 보상",
  "수동 조정",
];

function formatDate(value: string | null) {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return date.toLocaleDateString("ko-KR");
}

function formatDateTime(value: string | null) {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return date.toLocaleString("ko-KR");
}

function genderLabel(gender: MemberDetail["gender"]) {
  if (gender === "male") return "남성";
  if (gender === "female") return "여성";
  return "기타";
}

function formatNumber(value: string) {
  const num = Number(value.replace(/,/g, ""));
  if (!Number.isFinite(num)) return "";
  return num.toLocaleString("ko-KR");
}

export default function AdminMemberDetailPage({
  memberId,
  mode = "page",
  onClose,
  navigation,
}: Props) {
  const router = useRouter();
  const [member, setMember] = useState<MemberDetail | null>(null);
  const [ledger, setLedger] = useState<PointLedgerRow[]>([]);
  const [isLoadingMember, setIsLoadingMember] = useState(true);
  const [isLoadingLedger, setIsLoadingLedger] = useState(true);
  const [errorMessage, setErrorMessage] = useState("");
  const [ledgerErrorMessage, setLedgerErrorMessage] = useState("");
  const [grantAmount, setGrantAmount] = useState("");
  const [grantReason, setGrantReason] = useState("관리자 지급");
  const [grantStatus, setGrantStatus] = useState<"CONFIRMED" | "PENDING">("CONFIRMED");
  const [grantRefType, setGrantRefType] = useState("");
  const [grantRefId, setGrantRefId] = useState("");
  const [grantExpiresAt, setGrantExpiresAt] = useState("");
  const [grantSubmitting, setGrantSubmitting] = useState(false);
  const [grantMessage, setGrantMessage] = useState<{ type: "ok" | "err"; text: string } | null>(
    null,
  );
  const [highlightLedgerId, setHighlightLedgerId] = useState<string | null>(null);
  const [reviewRows, setReviewRows] = useState<ReviewEligibilityRow[]>([]);
  const [linkedProfiles, setLinkedProfiles] = useState<Array<{ id: string; name: string; phone: string }>>([]);
  const [isLoadingReviews, setIsLoadingReviews] = useState(true);
  const [reviewError, setReviewError] = useState("");
  const [claimingId, setClaimingId] = useState<string | null>(null);
  const [couponRecommendedTier, setCouponRecommendedTier] = useState<CouponPackTier>("WELCOME");
  const [hasWelcomePack, setHasWelcomePack] = useState(false);
  const [hasReturningPack, setHasReturningPack] = useState(false);
  const [isLoadingCouponPack, setIsLoadingCouponPack] = useState(true);

  async function loadCouponPackStatus() {
    setIsLoadingCouponPack(true);
    try {
      const res = await fetch(`/api/admin/members/${memberId}/coupon-pack`, { cache: "no-store" });
      const data = (await res.json()) as {
        recommendedTier?: CouponPackTier;
        hasWelcomePack?: boolean;
        hasReturningPack?: boolean;
        message?: string;
      };
      if (!res.ok) return;
      if (data.recommendedTier === "WELCOME" || data.recommendedTier === "RETURNING") {
        setCouponRecommendedTier(data.recommendedTier);
      }
      setHasWelcomePack(Boolean(data.hasWelcomePack));
      setHasReturningPack(Boolean(data.hasReturningPack));
    } catch {
      // 쿠폰팩 메타는 보조 정보 — 실패해도 수동 지급은 가능
    } finally {
      setIsLoadingCouponPack(false);
    }
  }

  useEffect(() => {
    let mounted = true;

    async function load() {
      try {
        setErrorMessage("");
        setLedgerErrorMessage("");
        setIsLoadingMember(true);
        setIsLoadingLedger(true);

        const [memberResponse, ledgerResponse] = await Promise.all([
          fetch(`/api/admin/members/${memberId}`, { cache: "no-store" }),
          fetch(`/api/admin/members/${memberId}/point-ledger?limit=20`, { cache: "no-store" }),
        ]);

        const memberResult = (await memberResponse.json()) as
          | MemberDetail
          | { message?: string };
        if (!memberResponse.ok) {
          const msg =
            "message" in memberResult
              ? memberResult.message
              : "회원 정보를 불러오지 못했습니다.";
          if (mounted) setErrorMessage(msg ?? "회원 정보를 불러오지 못했습니다.");
          return;
        }

        if (mounted) setMember(memberResult as MemberDetail);

        const ledgerResult = (await ledgerResponse.json()) as
          | PointLedgerRow[]
          | { message?: string };
        if (!ledgerResponse.ok) {
          const msg =
            "message" in ledgerResult
              ? ledgerResult.message
              : "포인트 내역을 불러오지 못했습니다.";
          if (mounted) {
            setLedger([]);
            setLedgerErrorMessage(msg ?? "포인트 내역을 불러오지 못했습니다.");
          }
          return;
        }

        if (mounted) setLedger(Array.isArray(ledgerResult) ? ledgerResult : []);
      } catch {
        if (mounted) {
          setErrorMessage("회원 상세 정보를 불러오는 중 오류가 발생했습니다.");
          setLedger([]);
        }
      } finally {
        if (mounted) {
          setIsLoadingMember(false);
          setIsLoadingLedger(false);
        }
      }
    }

    load();
    void loadCouponPackStatus();
    return () => {
      mounted = false;
    };
  }, [memberId]);

  async function loadReviewEligibilities() {
    setIsLoadingReviews(true);
    setReviewError("");
    try {
      const res = await fetch(`/api/admin/members/${memberId}/review-eligibilities`, { cache: "no-store" });
      const data = (await res.json()) as
        | {
            rows?: ReviewEligibilityRow[];
            linkedProfiles?: Array<{ id: string; name: string; phone: string }>;
          }
        | { message?: string };
      if (!res.ok) {
        setReviewError("message" in data ? (data.message ?? "리뷰 권한을 불러오지 못했습니다.") : "리뷰 권한을 불러오지 못했습니다.");
        return;
      }
      const summary = data as {
        rows?: ReviewEligibilityRow[];
        linkedProfiles?: Array<{ id: string; name: string; phone: string }>;
      };
      setReviewRows(Array.isArray(summary.rows) ? summary.rows : []);
      setLinkedProfiles(Array.isArray(summary.linkedProfiles) ? summary.linkedProfiles : []);
    } catch {
      setReviewError("리뷰 권한을 불러오는 중 오류가 발생했습니다.");
    } finally {
      setIsLoadingReviews(false);
    }
  }

  useEffect(() => {
    void loadReviewEligibilities();
  }, [memberId]);

  async function handleClaimEligibility(eligibilityId: string) {
    if (claimingId) return;
    setClaimingId(eligibilityId);
    try {
      const res = await fetch(
        `/api/admin/members/${memberId}/review-eligibilities/${eligibilityId}/claim`,
        { method: "POST" },
      );
      const data = (await res.json()) as { message?: string };
      if (!res.ok) {
        setReviewError(data.message ?? "권한 부여에 실패했습니다.");
        return;
      }
      await loadReviewEligibilities();
    } finally {
      setClaimingId(null);
    }
  }

  useEffect(() => {
    if (!highlightLedgerId) return;
    const t = setTimeout(() => setHighlightLedgerId(null), 2500);
    return () => clearTimeout(t);
  }, [highlightLedgerId]);

  const pointBalance = useMemo(() => {
    if (!member) return 0;
    const raw = member.point_balance ?? member.points ?? 0;
    return Number(raw) || 0;
  }, [member]);

  const pointPending = useMemo(() => {
    if (!member) return 0;
    return Number(member.point_pending ?? 0) || 0;
  }, [member]);

  const formattedAmount = grantAmount ? formatNumber(grantAmount) : "";
  const parsedGrantAmount = Number(grantAmount || "0");
  const isGrantAmountValid = Number.isFinite(parsedGrantAmount) && parsedGrantAmount > 0;

  function handleAmountChange(e: ChangeEvent<HTMLInputElement>) {
    const raw = e.target.value.replace(/[^0-9]/g, "");
    setGrantAmount(raw);
  }

  async function handleGrant() {
    if (grantSubmitting) return;
    if (!member) return;

    const amount = Number(grantAmount);
    if (!Number.isFinite(amount) || amount <= 0) {
      setGrantMessage({ type: "err", text: "포인트는 1 이상의 숫자여야 합니다." });
      return;
    }

    setGrantSubmitting(true);
    setGrantMessage(null);

    try {
      const expiresAtIso =
        grantExpiresAt.trim() && !Number.isNaN(new Date(grantExpiresAt).getTime())
          ? new Date(grantExpiresAt).toISOString()
          : undefined;

      const response = await fetch("/api/admin/points/grant", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId: member.id,
          amount,
          reason: grantReason.trim() || "관리자 지급",
          status: grantStatus,
          refType: grantRefType.trim() || undefined,
          refId: grantRefId.trim() || undefined,
          expiresAt: expiresAtIso,
        }),
      });

      const result = (await response.json().catch(() => ({}))) as {
        message?: string;
        ledgerId?: string;
      };

      if (!response.ok) {
        setGrantMessage({ type: "err", text: result.message || "포인트 지급에 실패했습니다." });
        return;
      }

      const amountText = formatNumber(grantAmount) || amount.toLocaleString("ko-KR");
      const successText =
        grantStatus === "CONFIRMED"
          ? `${amountText}P가 즉시 반영되었습니다.`
          : `${amountText}P가 대기 포인트로 기록되었습니다.`;
      setGrantMessage({ type: "ok", text: successText });

      setMember((current) => {
        if (!current) return current;

        if (grantStatus === "CONFIRMED") {
          if (current.point_balance !== undefined) {
            return {
              ...current,
              point_balance: Number(current.point_balance ?? 0) + amount,
            };
          }
          return {
            ...current,
            points: Number(current.points ?? 0) + amount,
          };
        }

        return {
          ...current,
          point_pending: Number(current.point_pending ?? 0) + amount,
        };
      });

      const newId = result.ledgerId || `temp-${Date.now()}`;
      setLedger((prev) => [
        {
          id: newId,
          type: "EARN",
          status: grantStatus,
          amount,
          reason: grantReason.trim() || "관리자 지급",
          ref_type: grantRefType.trim() || null,
          ref_id: grantRefId.trim() || null,
          expires_at: expiresAtIso ?? null,
          created_at: new Date().toISOString(),
        },
        ...prev,
      ]);
      setHighlightLedgerId(newId);

      setGrantAmount("");
      setGrantReason("관리자 지급");
      setGrantRefType("");
      setGrantRefId("");
      setGrantExpiresAt("");
      await loadCouponPackStatus();
    } finally {
      setGrantSubmitting(false);
    }
  }

  async function handleGrantCouponPack(tier: CouponPackTier) {
    if (grantSubmitting || !member) return;

    const pack = COUPON_PACKS[tier];
    if (tier !== couponRecommendedTier) {
      const ok = window.confirm(
        `권장 티어는 ${COUPON_PACKS[couponRecommendedTier].label}입니다.\n그래도 "${pack.buttonLabel}"을(를) 지급할까요?`,
      );
      if (!ok) return;
    }

    const alreadyGranted = tier === "WELCOME" ? hasWelcomePack : hasReturningPack;
    if (alreadyGranted) {
      const ok = window.confirm(
        `이 회원에게 "${pack.buttonLabel}"이(가) 이미 지급된 이력이 있습니다.\n그래도 다시 지급할까요?`,
      );
      if (!ok) return;
    }

    setGrantAmount(String(pack.amount));
    setGrantReason(pack.reason);
    setGrantRefType(pack.refType);
    setGrantRefId(member.id);
    setGrantStatus("CONFIRMED");
    setGrantExpiresAt("");
    setGrantSubmitting(true);
    setGrantMessage(null);

    try {
      const response = await fetch("/api/admin/coupons/grant", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId: member.id,
          tier,
          reason: pack.reason,
        }),
      });

      const result = (await response.json().catch(() => ({}))) as {
        message?: string;
        packId?: string;
        ledgerId?: string;
      };

      if (!response.ok) {
        setGrantMessage({ type: "err", text: result.message || "쿠폰팩 지급에 실패했습니다." });
        return;
      }

      setGrantMessage({
        type: "ok",
        text: result.message || `${pack.buttonLabel}이 지급되었습니다.`,
      });

      setGrantAmount("");
      setGrantReason("관리자 지급");
      setGrantRefType("");
      setGrantRefId("");
      setGrantExpiresAt("");
      await loadCouponPackStatus();
      // 원장 새로고침
      const ledgerResponse = await fetch(`/api/admin/members/${memberId}/point-ledger?limit=20`, {
        cache: "no-store",
      });
      if (ledgerResponse.ok) {
        const ledgerResult = (await ledgerResponse.json()) as PointLedgerRow[];
        if (Array.isArray(ledgerResult)) setLedger(ledgerResult);
      }
    } finally {
      setGrantSubmitting(false);
    }
  }

  if (isLoadingMember) {
    return <p className="px-6 py-8 text-sm text-[var(--text-muted)]">회원 정보를 불러오는 중입니다...</p>;
  }

  if (errorMessage || !member) {
    return (
      <div className="space-y-4 px-6 py-8">
        <p className="text-sm text-[var(--danger)]">
          {errorMessage || "회원 정보를 불러오지 못했습니다."}
        </p>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() =>
            mode === "modal" && onClose
              ? onClose()
              : router.push("/theall_manager_only/members")
          }
        >
          {mode === "modal" ? "닫기" : "회원 목록으로"}
        </Button>
      </div>
    );
  }

  const isModal = mode === "modal";

  const basicInfoSection = (
    <section className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5">
      <h3 className="text-base font-semibold text-[var(--text-primary)]">기본 정보</h3>
      <div className="mt-4 grid gap-4 sm:grid-cols-2">
        {!isModal ? (
          <>
            <div>
              <p className="text-xs text-[var(--text-muted)]">이름</p>
              <p className="mt-1 text-sm text-[var(--text-primary)]">{member.name || "-"}</p>
            </div>
            <div>
              <p className="text-xs text-[var(--text-muted)]">아이디</p>
              <p className="mt-1 text-sm text-[var(--text-primary)]">{member.username || "-"}</p>
            </div>
            <div>
              <p className="text-xs text-[var(--text-muted)]">이메일</p>
              <p className="mt-1 text-sm text-[var(--text-primary)]">{member.email || "-"}</p>
            </div>
            <div>
              <p className="text-xs text-[var(--text-muted)]">연락처</p>
              <p className="mt-1 text-sm text-[var(--text-primary)]">{member.phone || "-"}</p>
            </div>
            <div>
              <p className="text-xs text-[var(--text-muted)]">이메일 수신동의</p>
              <div className="mt-1">
                <Badge variant={member.agree_email ? "success" : "neutral"}>
                  {member.agree_email ? "이메일 수신 동의" : "이메일 수신 미동의"}
                </Badge>
              </div>
            </div>
          </>
        ) : (
          <div className="sm:col-span-2">
            <p className="text-xs text-[var(--text-muted)]">아이디</p>
            <p className="mt-1 text-sm text-[var(--text-primary)]">{member.username || "-"}</p>
          </div>
        )}
        <div>
          <p className="text-xs text-[var(--text-muted)]">생년월일</p>
          <p className="mt-1 text-sm text-[var(--text-primary)]">{member.birth_date || "-"}</p>
        </div>
        <div>
          <p className="text-xs text-[var(--text-muted)]">성별</p>
          <p className="mt-1 text-sm text-[var(--text-primary)]">{genderLabel(member.gender)}</p>
        </div>
        <div className="sm:col-span-2">
          <p className="text-xs text-[var(--text-muted)]">가입일시</p>
          <p className="mt-1 text-sm text-[var(--text-primary)]">{formatDateTime(member.created_at)}</p>
        </div>
      </div>
    </section>
  );

  const pointGrantSection = (
    <section className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5">
      <h3 className="text-base font-semibold text-[var(--text-primary)]">포인트 지급</h3>
      <p className="mt-1 text-sm text-[var(--text-muted)]">
        이 회원에게 포인트를 수동 지급합니다.
      </p>

      <div className="mt-4 rounded-xl border border-[var(--border)] bg-[var(--surface-muted)] p-3">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs font-medium text-[var(--text-muted)]">쿠폰팩 권장 티어</span>
          {isLoadingCouponPack ? (
            <span className="text-xs text-[var(--text-muted)]">확인 중…</span>
          ) : (
            <Badge variant={couponRecommendedTier === "WELCOME" ? "success" : "blue"}>
              {COUPON_PACKS[couponRecommendedTier].label}
            </Badge>
          )}
          {hasWelcomePack ? (
            <span className="text-[11px] text-[var(--text-muted)]">웰컴 지급됨</span>
          ) : null}
          {hasReturningPack ? (
            <span className="text-[11px] text-[var(--text-muted)]">리턴 지급됨</span>
          ) : null}
        </div>
        <div className="mt-3 flex flex-wrap gap-2">
          {(["WELCOME", "RETURNING"] as const).map((tier) => {
            const pack = COUPON_PACKS[tier];
            const recommended = tier === couponRecommendedTier;
            return (
              <Button
                key={tier}
                type="button"
                variant={recommended ? "primary" : "outline"}
                size="sm"
                disabled={grantSubmitting || isLoadingCouponPack}
                onClick={() => void handleGrantCouponPack(tier)}
              >
                {pack.buttonLabel}
                {recommended ? " · 권장" : ""}
              </Button>
            );
          })}
        </div>
      </div>

      <div className="mt-4 grid gap-4 sm:grid-cols-2">
        <div>
          <label className="text-xs font-medium text-[var(--text-muted)]">포인트(amount) *</label>
          <input
            type="text"
            inputMode="numeric"
            value={formattedAmount}
            onChange={handleAmountChange}
            className="mt-1 h-10 w-full rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 text-sm text-[var(--text-primary)] outline-none transition focus:border-[var(--primary)] focus:ring-2 focus:ring-[var(--primary-soft)]"
          />
        </div>
        <div>
          <label className="text-xs font-medium text-[var(--text-muted)]">상태(status)</label>
          <select
            value={grantStatus}
            onChange={(e) => setGrantStatus(e.target.value as "CONFIRMED" | "PENDING")}
            className="mt-1 h-10 w-full rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 text-sm text-[var(--text-primary)] outline-none transition focus:border-[var(--primary)] focus:ring-2 focus:ring-[var(--primary-soft)]"
          >
            <option value="CONFIRMED">CONFIRMED (즉시 반영)</option>
            <option value="PENDING">PENDING (대기 적립)</option>
          </select>
        </div>
        <div className="sm:col-span-2">
          <label className="text-xs font-medium text-[var(--text-muted)]">사유(reason) *</label>
          <input
            type="text"
            value={grantReason}
            onChange={(e) => setGrantReason(e.target.value)}
            className="mt-1 h-10 w-full rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 text-sm text-[var(--text-primary)] outline-none transition focus:border-[var(--primary)] focus:ring-2 focus:ring-[var(--primary-soft)]"
          />
          <div className="mt-2 flex flex-wrap gap-2">
            {REASON_PRESETS.map((preset) => (
              <Button
                key={preset}
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setGrantReason(preset)}
                className="min-h-0 rounded-full px-2 py-1 text-xs text-[var(--text-muted)] hover:bg-[var(--surface-muted)]"
              >
                {preset}
              </Button>
            ))}
          </div>
        </div>
        <div>
          <label className="text-xs font-medium text-[var(--text-muted)]">refType (선택)</label>
          <input
            type="text"
            value={grantRefType}
            onChange={(e) => setGrantRefType(e.target.value)}
            className="mt-1 h-10 w-full rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 text-sm text-[var(--text-primary)] outline-none transition focus:border-[var(--primary)] focus:ring-2 focus:ring-[var(--primary-soft)]"
          />
        </div>
        <div>
          <label className="text-xs font-medium text-[var(--text-muted)]">refId (선택)</label>
          <input
            type="text"
            value={grantRefId}
            onChange={(e) => setGrantRefId(e.target.value)}
            className="mt-1 h-10 w-full rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 text-sm text-[var(--text-primary)] outline-none transition focus:border-[var(--primary)] focus:ring-2 focus:ring-[var(--primary-soft)]"
          />
        </div>
        <div>
          <label className="text-xs font-medium text-[var(--text-muted)]">expiresAt (선택)</label>
          <input
            type="datetime-local"
            value={grantExpiresAt}
            onChange={(e) => setGrantExpiresAt(e.target.value)}
            className="mt-1 h-10 w-full rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 text-sm text-[var(--text-primary)] outline-none transition focus:border-[var(--primary)] focus:ring-2 focus:ring-[var(--primary-soft)]"
          />
        </div>
      </div>

      {grantAmount ? (
        <div className="mt-4 rounded-xl border border-[var(--border)] bg-[var(--surface-muted)] p-3 text-xs text-[var(--text-muted)]">
          <p>
            지급 대상: {member.name || "-"} · {member.username}
          </p>
          <p>지급 포인트: {formattedAmount}P</p>
          <p>상태: {grantStatus === "CONFIRMED" ? "즉시 반영" : "대기 적립"}</p>
          <p>사유: {grantReason || "-"}</p>
        </div>
      ) : null}

      {grantMessage ? (
        <p
          className={`mt-3 text-sm ${
            grantMessage.type === "ok" ? "text-[var(--success)]" : "text-[var(--danger)]"
          }`}
        >
          {grantMessage.text}
        </p>
      ) : null}

      <div className="mt-4 flex justify-end">
        <Button
          type="button"
          variant="primary"
          size="sm"
          onClick={handleGrant}
          disabled={grantSubmitting || !grantAmount || !isGrantAmountValid}
          loading={grantSubmitting}
        >
          {grantSubmitting ? "처리 중…" : "포인트 지급"}
        </Button>
      </div>
    </section>
  );

  const pointLedgerSection = (
    <section className="flex h-full min-h-0 flex-col rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-base font-semibold text-[var(--text-primary)]">최근 포인트 내역</h3>
        <p className="text-xs text-[var(--text-muted)]">최신 20건</p>
      </div>

      {ledgerErrorMessage ? (
        <p className="mt-3 text-sm text-[var(--danger)]">{ledgerErrorMessage}</p>
      ) : null}

      {isLoadingLedger ? (
        <p className="mt-3 text-sm text-[var(--text-muted)]">포인트 내역을 불러오는 중입니다...</p>
      ) : ledger.length === 0 ? (
        <p className="mt-3 text-sm text-[var(--text-muted)]">포인트 내역이 없습니다.</p>
      ) : (
        <div className="mt-3 min-h-0 flex-1 overflow-y-auto lg:max-h-[28rem] xl:max-h-[min(32rem,50vh)]">
          <table className="w-full min-w-[520px] border-collapse text-sm">
            <thead className="sticky top-0 bg-[var(--surface-muted)] text-[var(--text-secondary)]">
              <tr>
                <th className="px-3 py-2 text-left font-semibold">일시</th>
                <th className="px-3 py-2 text-left font-semibold">유형</th>
                <th className="px-3 py-2 text-left font-semibold">상태</th>
                <th className="px-3 py-2 text-right font-semibold">포인트</th>
                <th className="px-3 py-2 text-left font-semibold">사유</th>
              </tr>
            </thead>
            <tbody>
              {ledger.map((row) => (
                <tr
                  key={row.id}
                  className={cn(
                    "border-t border-[var(--divider)]",
                    highlightLedgerId === row.id && "bg-[var(--primary-soft)]",
                  )}
                >
                  <td className="px-3 py-2 text-[var(--text-secondary)]">
                    {formatDateTime(row.created_at)}
                  </td>
                  <td className="px-3 py-2 text-[var(--text-primary)]">
                    {TYPE_LABEL[row.type] ?? row.type}
                  </td>
                  <td className="px-3 py-2">
                    <Badge variant="neutral" className="px-2 py-0.5 text-[11px]">
                      {STATUS_LABEL[row.status] ?? row.status}
                    </Badge>
                  </td>
                  <td className="px-3 py-2 text-right font-medium tabular-nums text-[var(--text-primary)]">
                    {Number(row.amount ?? 0).toLocaleString("ko-KR")}P
                  </td>
                  <td className="px-3 py-2 text-[var(--text-secondary)]">{row.reason || "-"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );

  const reviewSection = (
    <section className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="text-base font-semibold text-[var(--text-primary)]">리뷰 권한</h3>
          <p className="mt-1 text-sm text-[var(--text-muted)]">
            연결된 문의·예약 건에 대한 후기 작성 권한을 확인하고 수동 부여할 수 있습니다.
          </p>
        </div>
        {linkedProfiles[0] ? (
          <Link
            href={buildAdminBookingNewUrl({
              customer_profile_id: linkedProfiles[0].id,
              member_id: memberId,
              product_id: reviewRows.find((r) => r.product_id)?.product_id ?? reviewRows[0]?.product_id,
              product_title: reviewRows.find((r) => r.product_title)?.product_title ?? undefined,
              inquiry_id: reviewRows.find((r) => r.inquiry_id)?.inquiry_id ?? undefined,
            })}
            className="rounded-lg border border-[var(--border)] bg-[var(--surface-muted)] px-3 py-2 text-sm font-medium text-[var(--text-primary)] hover:bg-[var(--surface)]"
          >
            예약 생성
          </Link>
        ) : null}
      </div>

      {linkedProfiles.length > 0 ? (
        <p className="mt-2 text-xs text-[var(--text-muted)]">
          연결된 고객 프로필: {linkedProfiles.map((p) => `${p.name}(${p.phone})`).join(", ")}
        </p>
      ) : (
        <p className="mt-2 text-xs text-[var(--text-subtle)]">
          아직 연결된 고객 프로필이 없습니다. 아래 문의를 연결하거나 문의 상세에서 회원 연결을 사용하세요.
        </p>
      )}

      {reviewError ? <p className="mt-2 text-sm text-[var(--danger)]">{reviewError}</p> : null}

      {isLoadingReviews ? (
        <p className="mt-3 text-sm text-[var(--text-muted)]">리뷰 권한을 불러오는 중입니다...</p>
      ) : reviewRows.length === 0 ? (
        <p className="mt-3 text-sm text-[var(--text-muted)]">연결된 문의·예약 건이 없습니다.</p>
      ) : (
        <div className="mt-3 overflow-x-auto">
          <table className="w-full min-w-[720px] border-collapse text-sm">
            <thead className="bg-[var(--surface-muted)] text-[var(--text-secondary)]">
              <tr>
                <th className="px-3 py-2 text-left font-semibold">상품/문의</th>
                <th className="px-3 py-2 text-left font-semibold">예약 상태</th>
                <th className="px-3 py-2 text-left font-semibold">자격 상태</th>
                <th className="px-3 py-2 text-left font-semibold">안내</th>
                <th className="px-3 py-2 text-right font-semibold">액션</th>
              </tr>
            </thead>
            <tbody>
              {reviewRows.map((row) => (
                <tr
                  key={`${row.inquiry_id ?? row.booking_id ?? row.customer_profile_id}`}
                  className="border-t border-[var(--divider)]"
                >
                  <td className="px-3 py-2">
                    <p className="font-medium text-[var(--text-primary)]">{row.product_title || "일반 문의"}</p>
                    <p className="text-xs text-[var(--text-muted)]">{formatDate(row.inquiry_created_at)}</p>
                  </td>
                  <td className="px-3 py-2 text-[var(--text-secondary)]">
                    {BOOKING_STATUS_LABEL[row.booking_status ?? "none"] ?? row.booking_status ?? "-"}
                  </td>
                  <td className="px-3 py-2">
                    {row.eligibility_status ? (
                      <Badge variant="neutral" className="px-2 py-0.5 text-[11px]">
                        {ELIGIBILITY_STATUS_LABEL[row.eligibility_status] ?? row.eligibility_status}
                      </Badge>
                    ) : (
                      <span className="text-[var(--text-muted)]">—</span>
                    )}
                  </td>
                  <td className="px-3 py-2 text-xs text-[var(--text-muted)]">{row.claim_reason ?? "-"}</td>
                  <td className="px-3 py-2 text-right">
                    {row.can_claim && row.eligibility_id ? (
                      <Button
                        type="button"
                        variant="primary"
                        size="sm"
                        onClick={() => handleClaimEligibility(row.eligibility_id!)}
                        disabled={claimingId === row.eligibility_id}
                        loading={claimingId === row.eligibility_id}
                      >
                        권한 부여
                      </Button>
                    ) : null}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );

  return (
    <div className="flex flex-col">
      {mode === "modal" ? (
        <div className="sticky top-0 z-10 border-b border-[var(--border)] bg-[var(--surface-elevated)] px-6 py-4">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="min-w-0 space-y-1">
              <p className="text-xs font-medium uppercase tracking-wide text-[var(--text-muted)]">회원 상세</p>
              <p className="text-lg font-semibold text-[var(--text-primary)]">
                {member.name || "-"} · {member.username}
              </p>
              <p className="text-sm text-[var(--text-muted)]">
                {member.email || "-"} · {member.phone || "-"}
              </p>
              <Badge variant={member.agree_email ? "success" : "neutral"} className="mt-1 px-2 py-0.5 text-xs">
                {member.agree_email ? "이메일 수신 동의" : "이메일 수신 미동의"}
              </Badge>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              {navigation ? (
                <>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={navigation.onPrev}
                    disabled={!navigation.hasPrev}
                    className="min-h-0 py-1 text-xs disabled:cursor-not-allowed"
                  >
                    이전
                  </Button>
                  <span className="text-xs text-[var(--text-muted)]">
                    {Math.max(0, navigation.currentIndex + 1)} / {navigation.total}
                  </span>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={navigation.onNext}
                    disabled={!navigation.hasNext}
                    className="min-h-0 py-1 text-xs disabled:cursor-not-allowed"
                  >
                    다음
                  </Button>
                </>
              ) : null}
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="min-h-0 py-1 text-xs"
                onClick={() => router.push(`/theall_manager_only/members/${member.id}`)}
              >
                전체 페이지 보기
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="min-h-0 py-1 text-xs"
                onClick={onClose}
              >
                닫기
              </Button>
            </div>
          </div>
        </div>
      ) : (
        <div className="flex flex-wrap items-center justify-between gap-3 px-6 pt-6">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => router.push("/theall_manager_only/members")}
          >
            회원 목록으로
          </Button>
          <p className="text-sm text-[var(--text-muted)]">
            <span className="font-semibold text-[var(--text-primary)]">{member.name || "-"}</span>
            {" · "}
            {member.username}
          </p>
        </div>
      )}

      <div className="space-y-6 p-6">
        <div className="grid gap-4 md:grid-cols-3">
          <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5">
            <p className="text-xs text-[var(--text-muted)]">현재 사용 가능 포인트</p>
            <p className="mt-2 text-2xl font-bold tabular-nums text-[var(--primary)]">
              {pointBalance.toLocaleString("ko-KR")}P
            </p>
            <div className="mt-3 border-t border-[var(--border)] pt-3">
              <p className="text-xs font-medium text-[var(--text-muted)]">보유 중인 쿠폰팩</p>
              {isLoadingCouponPack ? (
                <p className="mt-1.5 text-xs text-[var(--text-muted)]">확인 중…</p>
              ) : !hasWelcomePack && !hasReturningPack ? (
                <p className="mt-1.5 text-sm text-[var(--text-secondary)]">없음</p>
              ) : (
                <div className="mt-1.5 flex flex-wrap gap-1.5">
                  {hasWelcomePack ? (
                    <Badge variant="success" className="px-2 py-0.5 text-[11px]">
                      웰컴 {COUPON_PACKS.WELCOME.amount.toLocaleString("ko-KR")}원
                    </Badge>
                  ) : null}
                  {hasReturningPack ? (
                    <Badge variant="blue" className="px-2 py-0.5 text-[11px]">
                      리턴 {COUPON_PACKS.RETURNING.amount.toLocaleString("ko-KR")}원
                    </Badge>
                  ) : null}
                </div>
              )}
              <p className="mt-1.5 text-[11px] text-[var(--text-muted)]">
                쿠폰팩은 포인트 잔액과 별도로 관리됩니다.
              </p>
            </div>
          </div>
          <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5">
            <p className="text-xs text-[var(--text-muted)]">대기 포인트</p>
            <p className="mt-2 text-2xl font-bold tabular-nums text-[var(--text-primary)]">
              {pointPending.toLocaleString("ko-KR")}P
            </p>
          </div>
          <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5">
            <p className="text-xs text-[var(--text-muted)]">가입일</p>
            <p className="mt-2 text-xl font-semibold text-[var(--text-primary)]">
              {formatDate(member.created_at)}
            </p>
          </div>
        </div>

        <div className="grid gap-6 xl:grid-cols-12">
          <div className="xl:col-span-4">{basicInfoSection}</div>

          <div className="space-y-6 xl:col-span-8">
            <div className="grid gap-6 lg:grid-cols-2 lg:items-start">
              {pointGrantSection}
              {pointLedgerSection}
            </div>

            <MemberInquiryLinkPanel
              memberId={memberId}
              memberPhone={member.phone}
              onChanged={() => void loadReviewEligibilities()}
            />

            {reviewSection}
          </div>
        </div>
      </div>
    </div>
  );
}
