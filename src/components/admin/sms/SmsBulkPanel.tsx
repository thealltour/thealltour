"use client";

import { useCallback, useEffect, useState } from "react";
import { SmsTemplateSelect } from "./SmsTemplateSelect";

type BulkJobSummary = {
  id: string;
  message: string;
  source_type: string;
  status: string;
  total_count: number;
  success_count: number;
  failed_count: number;
  created_at: string;
  completed_at: string | null;
};

type SourceTab = "manual" | "inquiries" | "members";

export function SmsBulkPanel() {
  const [sourceTab, setSourceTab] = useState<SourceTab>("manual");
  const [message, setMessage] = useState("");
  const [manualPhones, setManualPhones] = useState("");
  const [inquiryStatus, setInquiryStatus] = useState("pending");
  const [inquirySearch, setInquirySearch] = useState("");
  const [memberSearch, setMemberSearch] = useState("");
  const [memberIds, setMemberIds] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [feedback, setFeedback] = useState("");
  const [jobs, setJobs] = useState<BulkJobSummary[]>([]);
  const [activeJobId, setActiveJobId] = useState<string | null>(null);
  const [jobDetail, setJobDetail] = useState<{
    job: BulkJobSummary;
    items: Array<{
      id: string;
      recipient_phone: string;
      recipient_name: string | null;
      status: string;
      failure_reason: string | null;
    }>;
  } | null>(null);

  const loadJobs = useCallback(async () => {
    const res = await fetch("/api/admin/sms/bulk", { cache: "no-store" });
    const data = (await res.json()) as { items?: BulkJobSummary[] };
    if (res.ok) setJobs(data.items ?? []);
  }, []);

  const loadJobDetail = useCallback(async (jobId: string) => {
    const res = await fetch(`/api/admin/sms/bulk/${encodeURIComponent(jobId)}`, { cache: "no-store" });
    const data = (await res.json()) as {
      job?: BulkJobSummary;
      items?: Array<{
        id: string;
        recipient_phone: string;
        recipient_name: string | null;
        status: string;
        failure_reason: string | null;
      }>;
    };
    if (res.ok && data.job) {
      setJobDetail({ job: data.job, items: data.items ?? [] });
    }
  }, []);

  useEffect(() => {
    void loadJobs();
  }, [loadJobs]);

  useEffect(() => {
    if (!activeJobId) return;
    void loadJobDetail(activeJobId);
    const interval = setInterval(() => {
      void loadJobDetail(activeJobId);
      void loadJobs();
    }, 5000);
    return () => clearInterval(interval);
  }, [activeJobId, loadJobDetail, loadJobs]);

  const handleSubmit = async () => {
    setIsSubmitting(true);
    setFeedback("");
    try {
      const payload: Record<string, unknown> = { message, source_type: sourceTab };

      if (sourceTab === "manual") {
        payload.recipients = manualPhones
          .split(/\r?\n/)
          .map((line) => line.trim())
          .filter(Boolean);
      } else if (sourceTab === "inquiries") {
        payload.inquiry_filter = { status: inquiryStatus, search: inquirySearch, limit: 200 };
      } else {
        payload.member_search = memberSearch;
        payload.member_limit = 200;
        const ids = memberIds
          .split(/[\s,]+/)
          .map((s) => s.trim())
          .filter(Boolean);
        if (ids.length) payload.member_ids = ids;
      }

      const res = await fetch("/api/admin/sms/bulk", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = (await res.json()) as { jobId?: string; message?: string };
      if (!res.ok) {
        setFeedback(data.message ?? "대량 발송 생성에 실패했습니다.");
        return;
      }

      if (data.jobId) {
        setActiveJobId(data.jobId);
        await fetch(`/api/admin/sms/bulk/${encodeURIComponent(data.jobId)}/process`, { method: "POST" });
      }
      setFeedback("대량 발송 작업이 생성되었습니다. 진행 상황은 아래에서 확인하세요.");
      await loadJobs();
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-4">
      <section className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-4 shadow-sm">
        <h3 className="text-sm font-semibold text-[var(--text-primary)]">대량 SMS 발송</h3>
        <p className="mt-1 text-xs text-[var(--text-muted)]">
          수신자 소스를 선택한 뒤 메시지를 입력하고 발송 작업을 생성합니다.
        </p>

        <div className="mt-3 flex flex-wrap gap-2">
          {(["manual", "inquiries", "members"] as const).map((tab) => (
            <button
              key={tab}
              type="button"
              onClick={() => setSourceTab(tab)}
              className={`rounded-full px-3 py-1.5 text-xs font-semibold ${
                sourceTab === tab
                  ? "bg-[var(--primary)] text-white"
                  : "border border-[var(--border)] text-[var(--text-secondary)]"
              }`}
            >
              {tab === "manual" ? "직접 입력" : tab === "inquiries" ? "문의 필터" : "회원 목록"}
            </button>
          ))}
        </div>

        {sourceTab === "manual" ? (
          <textarea
            value={manualPhones}
            onChange={(e) => setManualPhones(e.target.value)}
            rows={6}
            placeholder={"01012345678\n01098765432"}
            className="mt-3 w-full rounded-lg border border-[var(--border)] bg-[var(--surface-muted)] px-3 py-2 text-sm"
          />
        ) : null}

        {sourceTab === "inquiries" ? (
          <div className="mt-3 flex flex-wrap gap-2">
            <select
              value={inquiryStatus}
              onChange={(e) => setInquiryStatus(e.target.value)}
              className="rounded-lg border border-[var(--border)] px-3 py-2 text-sm"
            >
              <option value="pending">미처리(신규·연락중)</option>
              <option value="new">신규</option>
              <option value="contacted">연락중</option>
              <option value="all">전체</option>
            </select>
            <input
              value={inquirySearch}
              onChange={(e) => setInquirySearch(e.target.value)}
              placeholder="이름·번호 검색"
              className="min-w-[200px] flex-1 rounded-lg border border-[var(--border)] px-3 py-2 text-sm"
            />
          </div>
        ) : null}

        {sourceTab === "members" ? (
          <div className="mt-3 space-y-2">
            <input
              value={memberSearch}
              onChange={(e) => setMemberSearch(e.target.value)}
              placeholder="회원 이름·번호·아이디 검색"
              className="w-full rounded-lg border border-[var(--border)] px-3 py-2 text-sm"
            />
            <input
              value={memberIds}
              onChange={(e) => setMemberIds(e.target.value)}
              placeholder="회원 ID (쉼표·공백 구분, 선택)"
              className="w-full rounded-lg border border-[var(--border)] px-3 py-2 text-sm"
            />
          </div>
        ) : null}

        <SmsTemplateSelect className="mt-3" onApply={(text) => setMessage(text)} />

        <textarea
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          rows={5}
          placeholder="발송할 메시지 (템플릿 변수: {{name}}, {{phone}}, {{product_title}})"
          className="mt-3 w-full rounded-lg border border-[var(--border)] bg-[var(--surface-muted)] px-3 py-2 text-sm"
        />

        <button
          type="button"
          disabled={isSubmitting || !message.trim()}
          onClick={() => void handleSubmit()}
          className="mt-3 rounded-lg border border-[var(--primary)] bg-[var(--primary)] px-4 py-2 text-sm font-semibold text-[var(--on-primary)] disabled:opacity-50"
        >
          {isSubmitting ? "생성 중…" : "대량 발송 작업 생성"}
        </button>

        {feedback ? <p className="mt-2 text-sm text-[var(--text-secondary)]">{feedback}</p> : null}
      </section>

      <section className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-4 shadow-sm">
        <h3 className="text-sm font-semibold text-[var(--text-primary)]">최근 작업</h3>
        {jobs.length === 0 ? (
          <p className="mt-2 text-sm text-[var(--text-muted)]">대량 발송 작업이 없습니다.</p>
        ) : (
          <ul className="mt-2 space-y-2">
            {jobs.map((job) => (
              <li key={job.id}>
                <button
                  type="button"
                  onClick={() => setActiveJobId(job.id)}
                  className={`w-full rounded-lg border px-3 py-2 text-left text-sm ${
                    activeJobId === job.id
                      ? "border-[var(--primary)] bg-[var(--primary-soft)]/20"
                      : "border-[var(--border)]"
                  }`}
                >
                  <span className="font-semibold">{job.status}</span>
                  <span className="ml-2 text-xs text-[var(--text-muted)]">
                    {job.source_type} · {job.success_count}/{job.total_count} 성공
                    {job.failed_count > 0 ? ` · 실패 ${job.failed_count}` : ""}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}

        {jobDetail ? (
          <div className="mt-4 rounded-lg border border-[var(--border)] p-3">
            <p className="text-xs font-semibold text-[var(--text-muted)]">
              작업 상세 · {jobDetail.job.status} · 성공 {jobDetail.job.success_count} / 실패{" "}
              {jobDetail.job.failed_count}
            </p>
            <ul className="mt-2 max-h-48 space-y-1 overflow-y-auto text-xs">
              {jobDetail.items.map((item) => (
                <li key={item.id} className="flex justify-between gap-2">
                  <span className="tabular-nums">
                    {item.recipient_phone}
                    {item.recipient_name ? ` (${item.recipient_name})` : ""}
                  </span>
                  <span className={item.status === "failed" ? "text-[var(--danger)]" : "text-[var(--success)]"}>
                    {item.status}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        ) : null}
      </section>
    </div>
  );
}
