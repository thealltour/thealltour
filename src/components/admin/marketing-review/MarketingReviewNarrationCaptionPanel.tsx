"use client";
import { useEffect, useState, useRef } from "react";
import AdminButton from "@/components/admin/ui/AdminButton";
type Caption = { text: string; fingerprint: string; approvedAt: string | null };
export function MarketingReviewNarrationCaptionPanel({ candidateId, adaptationFingerprint, canEdit }: { candidateId: string; adaptationFingerprint: string; canEdit: boolean }) {
  const endpoint = `/api/admin/marketing-review/${encodeURIComponent(candidateId)}/narration-instagram/caption`;
  const [caption, setCaption] = useState<Caption | null>(null); const [text, setText] = useState("");
  const [fresh, setFresh] = useState(false); const [dirty, setDirty] = useState(false); const dirtyRef = useRef(false);
  const [busy, setBusy] = useState(false); const [message, setMessage] = useState("");
  useEffect(() => { let cancelled = false; void fetch(endpoint, { cache: "no-store" }).then(async r => { const data = await r.json(); if (!r.ok) throw new Error(data.message); if (!cancelled && !dirtyRef.current) { setCaption(data.caption); setText(data.caption?.text ?? ""); setFresh(data.fresh); } }).catch(e => { if (!cancelled) setMessage(e.message); }); return () => { cancelled = true; }; }, [endpoint, adaptationFingerprint]);
  async function run(action: "generate" | "save" | "approve") {
    if (action === "generate" && dirty && !window.confirm("작성 중인 캡션을 새 초안으로 바꿀까요?")) return;
    setBusy(true); setMessage("");
    try { const response = await fetch(endpoint, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action, adaptationFingerprint, expectedFingerprint: caption?.fingerprint ?? null, ...(action === "save" ? { text } : {}) }) }); const data = await response.json(); if (!response.ok) throw new Error(data.message); setCaption(data.caption); setText(data.caption.text); setFresh(data.fresh); dirtyRef.current = false; setDirty(false); setMessage(action === "generate" ? "Narration 기반 캡션 초안을 생성했습니다. 검토 후 승인해주세요." : action === "approve" ? "현재 캡션을 승인했습니다." : "캡션을 저장했습니다."); }
    catch (e) { setMessage(e instanceof Error ? e.message : "캡션 처리 실패"); } finally { setBusy(false); }
  }
  return <div className="space-y-2 rounded-lg border border-[var(--border)] p-3 text-sm"><h4 className="font-semibold">Narration 기반 Instagram 캡션</h4><p>승인된 원고와 카드 카피를 바탕으로 캡션을 발전시킵니다. 게시 전 직접 검토해주세요.</p><AdminButton disabled={!canEdit || busy} onClick={() => void run("generate")}>{busy ? "처리 중…" : "Hermes 캡션 초안 생성"}</AdminButton><textarea aria-label="Instagram 캡션" value={text} maxLength={2200} disabled={!canEdit || busy} onChange={e => { setText(e.target.value); dirtyRef.current = true; setDirty(true); }} className="block min-h-40 w-full rounded border bg-[var(--bg)] p-2" /><div className="flex gap-2"><AdminButton disabled={!canEdit || busy || !text.trim()} onClick={() => void run("save")}>캡션 저장</AdminButton><AdminButton disabled={!canEdit || busy || dirty || !caption || !fresh} onClick={() => void run("approve")}>캡션 검토·승인</AdminButton><AdminButton variant="secondary" disabled={!caption?.approvedAt || !fresh || dirty} onClick={() => void navigator.clipboard.writeText(text).then(() => setMessage("캡션을 복사했습니다.")).catch(() => setMessage("직접 선택해 복사해주세요."))}>승인된 캡션 복사</AdminButton></div><p role="status">{message || (caption && !fresh ? "카드·원고가 변경됐습니다. 캡션을 다시 검토·저장해주세요." : caption?.approvedAt ? "승인됨" : "검토 필요")}</p></div>;
}
