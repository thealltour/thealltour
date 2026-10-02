"use client";
import AdminButton from "@/components/admin/ui/AdminButton";

export function MarketingReviewResearchHandoffButton(props: {
  candidateId: string; approved: boolean; canEdit: boolean; busy: boolean;
  onBusy: (busy: boolean) => void; onMessage: (message: string) => void;
}) {
  async function copy() {
    if (!props.approved || !props.canEdit || props.busy) return;
    props.onBusy(true);
    try {
      const response = await fetch(`/api/admin/marketing-review/${encodeURIComponent(props.candidateId)}/research-editorial-handoff`, { method: "POST", headers: { "Content-Type": "application/json" }, body: "{}" });
      const result = await response.json() as { text?: string; message?: string };
      if (!response.ok || typeof result.text !== "string") { props.onMessage(result.message ?? "Research 검증용 JSON을 만들지 못했습니다."); return; }
      await navigator.clipboard.writeText(result.text);
      props.onMessage("Research 검증용 JSON을 복사했습니다.");
    } catch { props.onMessage("Research 검증용 JSON 복사에 실패했습니다."); }
    finally { props.onBusy(false); }
  }
  return <AdminButton type="button" disabled={props.busy || !props.canEdit || !props.approved} title={props.approved ? undefined : "1단계에서 현재 버전의 공통 원문을 승인하세요."} onClick={() => void copy()}>Research 검증용 JSON 복사</AdminButton>;
}
