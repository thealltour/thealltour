"use client";
import { useEffect, useState } from "react";
import AdminButton from "@/components/admin/ui/AdminButton";

type Cell = { platform: string; uiState: string; status: "not_checked" | "pass_on_real_device" | "fail" | "inconclusive"; device: string | null; checkedOn: string | null };
type View = { summary: { presetPolicyId: string; presetFingerprint: string; platformValidation: string; cells: Cell[]; otherStateRecords: number; localReferenceRecords: number; previousPresetRecords: number; statement: string };
  labels: { platforms: Record<string, string>; uiStates: Record<string, string> }; qaVideos: { size: string; available: boolean; sha256: string | null }[];
  records: { recordId: string; presetPolicyId: string; recordedAt: string; input: { platform: string; uiState: string; method: string; result: string; device: string; appVersion: string; checkedOn: string; notes: string }; evidence: { fileName: string; originalName: string }[] }[] };
const statusLabels: Record<Cell["status"], string> = { not_checked: "확인 안 함", pass_on_real_device: "실기기 통과", fail: "가림 있음", inconclusive: "판단 보류" };
const endpoint = "/api/admin/marketing-review/narration-platform-validation";
const today = () => new Date().toISOString().slice(0, 10);
export function MarketingReviewNarrationPlatformValidationPanel({ canEdit }: { canEdit: boolean }) {
  const [view, setView] = useState<View | null>(null); const [message, setMessage] = useState(""); const [busy, setBusy] = useState(false); const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ platform: "youtube_shorts", os: "android", osVersion: "", device: "", widthPx: "", heightPx: "", appVersion: "", checkedOn: today(), uiState: "default_playback", method: "real_device", result: "pass", qaVideo: "1080x1920", notes: "" });
  const [files, setFiles] = useState<File[]>([]);
  async function load() { try { const response = await fetch(endpoint, { cache: "no-store" }); const data = await response.json(); if (!response.ok) throw new Error(data.message); setView(data); } catch (error) { setMessage(error instanceof Error ? error.message : "검수 기록을 불러오지 못했습니다."); } }
  useEffect(() => { if (open && !view) void load(); }, [open, view]);
  async function save() {
    setBusy(true); setMessage("");
    try {
      const qa = view?.qaVideos.find(v => v.size === form.qaVideo); const body = new FormData();
      body.set("record", JSON.stringify({ platform: form.platform, os: form.os, osVersion: form.osVersion, device: form.device, screen: { widthPx: Number(form.widthPx), heightPx: Number(form.heightPx) }, appVersion: form.appVersion,
        checkedOn: form.checkedOn, uiState: form.uiState, method: form.method, result: form.result, qaVideo: form.qaVideo, qaVideoSha256: qa?.sha256 ?? null, notes: form.notes }));
      for (const file of files) body.append("evidence", file);
      const response = await fetch(endpoint, { method: "POST", body }); const data = await response.json(); if (!response.ok) throw new Error(data.message);
      setFiles([]); await load(); setMessage("검수 기록을 저장했습니다.");
    } catch (error) { setMessage(error instanceof Error ? error.message : "저장 실패"); } finally { setBusy(false); }
  }
  const field = (key: keyof typeof form) => ({ value: form[key], disabled: !canEdit || busy, onChange: (e: { target: { value: string } }) => setForm({ ...form, [key]: e.target.value }) });
  const input = "ml-1 rounded border bg-[var(--bg)] p-1";
  return <div className="space-y-2 rounded-lg border border-[var(--border)] p-3 text-sm">
    <button type="button" className="font-semibold" onClick={() => setOpen(!open)}>{open ? "▾" : "▸"} 플랫폼 화면 가림 검수 (실기기)</button>
    {open && <>
      <p className="text-xs">공통 안전 영역은 프로젝트가 정한 보수적 기준이며 플랫폼 공식 검증이 아닙니다. 통과는 실제 휴대폰 앱에서 검수 영상을 재생해 확인한 기록만 인정합니다. 로컬 박스 검사나 가상 오버레이는 참고 기록으로만 남습니다.</p>
      {view && <>
        <p className="text-xs">기준 {view.summary.presetPolicyId} · fingerprint {view.summary.presetFingerprint.slice(0, 12)}… · 전체 상태: {view.summary.platformValidation === "pending" ? "검수 대기(pending)" : view.summary.platformValidation}</p>
        <table className="text-xs"><thead><tr><th className="pr-3 text-left">플랫폼</th>{[...new Set(view.summary.cells.map(c => c.uiState))].map(s => <th key={s} className="pr-3 text-left">{view.labels.uiStates[s]}</th>)}</tr></thead>
          <tbody>{[...new Set(view.summary.cells.map(c => c.platform))].map(p => <tr key={p}><td className="pr-3">{view.labels.platforms[p]}</td>
            {view.summary.cells.filter(c => c.platform === p).map(c => <td key={c.uiState} className="pr-3">{statusLabels[c.status]}{c.device ? ` (${c.device}, ${c.checkedOn})` : ""}</td>)}</tr>)}</tbody></table>
        <p className="text-xs text-[var(--text-secondary)]">{view.summary.statement}{view.summary.previousPresetRecords ? ` 이전 기준의 기록 ${view.summary.previousPresetRecords}개는 현재 기준에 포함하지 않습니다.` : ""}</p>
        <p className="text-xs">검수 영상: {view.qaVideos.map(v => v.available ? <a key={v.size} className="mr-3 underline" href={`${endpoint}?qa=${v.size}`}>{v.size} 다운로드</a> : <span key={v.size} className="mr-3">{v.size} 없음(생성 스크립트 필요)</span>)}</p>
        {canEdit && <div className="space-y-1 rounded border border-[var(--border)] p-2 text-xs">
          <div className="flex flex-wrap gap-2">
            <label>플랫폼<select className={input} {...field("platform")}>{Object.entries(view.labels.platforms).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></label>
            <label>OS<select className={input} {...field("os")}><option value="android">Android</option><option value="ios">iOS</option></select></label>
            <label>OS 버전<input className={`${input} w-20`} {...field("osVersion")} /></label>
            <label>기기<input className={`${input} w-40`} {...field("device")} /></label>
            <label>화면 px<input type="number" className={`${input} w-20`} {...field("widthPx")} />×<input type="number" className={`${input} w-20`} {...field("heightPx")} /></label>
            <label>앱 버전<input className={`${input} w-24`} {...field("appVersion")} /></label>
            <label>확인일<input type="date" className={input} {...field("checkedOn")} /></label>
            <label>화면 상태<select className={input} {...field("uiState")}>{Object.entries(view.labels.uiStates).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></label>
            <label>방법<select className={input} {...field("method")}><option value="real_device">실제 기기 앱</option><option value="local_overlay">로컬·가상 오버레이(참고)</option></select></label>
            <label>결과<select className={input} {...field("result")}><option value="pass" disabled={form.method !== "real_device"}>가림 없음</option><option value="fail">가림 있음</option><option value="inconclusive">판단 보류</option></select></label>
            <label>재생한 영상<select className={input} {...field("qaVideo")}><option value="1080x1920">1080×1920</option><option value="720x1280">720×1280</option></select></label>
          </div>
          <label className="block">메모 (가린 UI 요소, 위치 등)<textarea className="mt-1 block w-full rounded border bg-[var(--bg)] p-1" {...field("notes")} /></label>
          <label className="block">증빙 (스크린샷·화면 녹화, 최대 5개)<input type="file" multiple accept="image/png,image/jpeg,image/webp,video/mp4,video/quicktime" disabled={!canEdit || busy} onChange={e => setFiles([...(e.target.files ?? [])].slice(0, 5))} /></label>
          <AdminButton type="button" disabled={busy || !form.osVersion || !form.device || !form.appVersion || !form.widthPx || !form.heightPx || (form.result === "pass" && (!files.length || form.method !== "real_device"))} onClick={() => void save()}>검수 기록 저장</AdminButton>
        </div>}
        {view.records.length > 0 && <ul className="space-y-1 text-xs">{view.records.slice(0, 10).map(r => <li key={r.recordId}>{r.input.checkedOn} · {view.labels.platforms[r.input.platform]} · {view.labels.uiStates[r.input.uiState]} · {r.input.method === "real_device" ? "실기기" : "참고"} · {r.input.result} · {r.input.device} 앱 {r.input.appVersion}
          {r.evidence.map(e => <a key={e.fileName} className="ml-2 underline" href={`${endpoint}?evidence=${e.fileName}`}>{e.originalName || "증빙"}</a>)}{r.presetPolicyId !== view.summary.presetPolicyId ? " · 이전 기준" : ""}</li>)}</ul>}
      </>}
      {message && <p role="status" className="text-xs">{message}</p>}
    </>}
  </div>;
}
