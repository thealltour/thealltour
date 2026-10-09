"use client";
import { useEffect, useRef, useState } from "react";
import AdminButton from "@/components/admin/ui/AdminButton";

type Range = { startSample: number; endSampleExclusive: number };
type EdgeView = { sentenceId: string; status: string; rawSha256: string; sampleRate: number; rawSampleCount: number; samplesPerPeak: number; peaks: number[]; detected: Range | null;
  suggestion: (Range & { warnings: string[] }) | null; current: Range; decision: (Range & { mode: "auto_range" | "manual_range"; warnings: string[] }) | null; editable: boolean;
  policyReview: { maxSideTrimMs: number; maxTotalTrimRatio: number; minKeptMs: number } };
type Choice = "keep_raw" | "auto_range" | "manual_range";
const warningLabels: Record<string, string> = { leading_trim_exceeds_1500ms: "앞부분을 1.5초 넘게 자릅니다", trailing_trim_exceeds_1500ms: "뒷부분을 1.5초 넘게 자릅니다",
  total_trim_at_least_40_percent: "원본의 40% 이상을 자릅니다", kept_audio_too_short: "남는 음성이 0.2초보다 짧습니다", cuts_detected_speech: "자동으로 찾은 말소리 구간 일부가 잘립니다", no_speech_detected: "자동 분석에서 말소리를 찾지 못했습니다" };
/** Same limits the server applies; the server re-checks and refuses unacknowledged warnings. */
function warningsFor(view: EdgeView, range: Range) {
  const samples = (ms: number) => Math.round(view.sampleRate * ms / 1000); const total = view.rawSampleCount; const warnings: string[] = [];
  if (range.startSample > samples(view.policyReview.maxSideTrimMs)) warnings.push("leading_trim_exceeds_1500ms");
  if (total - range.endSampleExclusive > samples(view.policyReview.maxSideTrimMs)) warnings.push("trailing_trim_exceeds_1500ms");
  if ((range.startSample + total - range.endSampleExclusive) / total >= view.policyReview.maxTotalTrimRatio) warnings.push("total_trim_at_least_40_percent");
  if (range.endSampleExclusive - range.startSample < samples(view.policyReview.minKeptMs)) warnings.push("kept_audio_too_short");
  if (!view.detected) warnings.push("no_speech_detected");
  else if (range.startSample > view.detected.startSample || range.endSampleExclusive < view.detected.endSampleExclusive) warnings.push("cuts_detected_speech");
  return warnings;
}
const ms = (samples: number, rate: number) => Math.round(samples * 1000 / rate);

export function MarketingReviewNarrationEdgeRangeEditor({ endpoint, jobId, sentenceId, keepRawApproved, canEdit, onKeepRaw, onApplied }: { endpoint: string; jobId: string; sentenceId: string;
  keepRawApproved: boolean | null; canEdit: boolean; onKeepRaw: () => Promise<void>; onApplied: (message: string) => Promise<void> }) {
  const [view, setView] = useState<EdgeView | null>(null); const [message, setMessage] = useState(""); const [busy, setBusy] = useState(false);
  const [choice, setChoice] = useState<Choice | null>(null); const [range, setRange] = useState<Range | null>(null); const [heard, setHeard] = useState<string | null>(null); const [acknowledged, setAcknowledged] = useState<string[]>([]);
  const audio = useRef<{ context: AudioContext; buffer: AudioBuffer; source: AudioBufferSourceNode | null } | null>(null);
  const src = `${endpoint}?jobId=${encodeURIComponent(jobId)}&sentenceId=${encodeURIComponent(sentenceId)}`;
  useEffect(() => () => { void audio.current?.context.close(); }, []);
  async function open() {
    setBusy(true); setMessage("");
    try { const response = await fetch(`${src}&waveform=1`, { cache: "no-store" }); const data = await response.json(); if (!response.ok) throw new Error(data.message); setView(data); }
    catch (error) { setMessage(error instanceof Error ? error.message : "파형을 불러오지 못했습니다."); } finally { setBusy(false); }
  }
  function select(next: Choice) {
    if (!view) return; setChoice(next); setHeard(null); setAcknowledged([]);
    setRange(next === "keep_raw" ? { startSample: 0, endSampleExclusive: view.rawSampleCount } : next === "auto_range" ? view.suggestion : view.decision ?? view.suggestion ?? { startSample: 0, endSampleExclusive: view.rawSampleCount });
  }
  async function listen() {
    if (!view || !range) return;
    try {
      if (!audio.current) { const response = await fetch(`${src}&variant=raw`, { cache: "no-store" }); if (!response.ok) throw new Error("원본 음성을 불러오지 못했습니다.");
        const context = new AudioContext(); audio.current = { context, buffer: await context.decodeAudioData(await response.arrayBuffer()), source: null }; }
      const player = audio.current; player.source?.stop(); const source = player.context.createBufferSource(); source.buffer = player.buffer; source.connect(player.context.destination);
      source.start(0, range.startSample / view.sampleRate, (range.endSampleExclusive - range.startSample) / view.sampleRate); player.source = source; setHeard(`${range.startSample}-${range.endSampleExclusive}`);
    } catch (error) { setMessage(error instanceof Error ? error.message : "미리 듣기 실패"); }
  }
  async function apply() {
    if (!view || !range || (choice !== "auto_range" && choice !== "manual_range")) return;
    if (!window.confirm("선택한 구간으로 새 음성 작업을 만듭니다. 원본과 기존 음성은 지우지 않습니다. 장면 계획·자막·정렬·영상은 새 음성 기준으로 다시 확인해야 합니다. 진행할까요?")) return;
    setBusy(true); setMessage("");
    try {
      const response = await fetch(endpoint, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "apply-edge-ranges", sourceJobId: jobId,
        decisions: [{ sentenceId, mode: choice, startSample: range.startSample, endSampleExclusive: range.endSampleExclusive, expectedRawSha256: view.rawSha256, acknowledgedWarnings: acknowledged }] }) });
      const data = await response.json(); if (!response.ok) throw new Error(data.message);
      await onApplied(`${choice === "auto_range" ? "자동 제안 구간" : "직접 지정한 구간"}으로 새 음성 작업을 만들었습니다. 길이는 새 파일에서 다시 측정했습니다.`);
    } catch (error) { setMessage(error instanceof Error ? error.message : "구간 적용 실패"); } finally { setBusy(false); }
  }
  if (!view) return <div className="space-y-1"><AdminButton type="button" variant="secondary" disabled={busy || !canEdit} onClick={() => void open()}>앞뒤 구간 검토 열기</AdminButton>{message && <p className="text-xs">{message}</p>}</div>;
  const width = 800; const height = 80; const x = (sample: number) => sample / view.rawSampleCount * width;
  const warnings = range && choice !== "keep_raw" ? warningsFor(view, range) : []; const valid = !!range && range.startSample >= 0 && range.startSample < range.endSampleExclusive && range.endSampleExclusive <= view.rawSampleCount;
  const listened = !!range && heard === `${range.startSample}-${range.endSampleExclusive}`;
  const setMs = (key: keyof Range, value: string) => { if (!range || value === "" || !Number.isFinite(Number(value))) return; setHeard(null); setAcknowledged([]);
    setRange({ ...range, [key]: Math.min(view.rawSampleCount, Math.max(0, Math.round(Number(value) * view.sampleRate / 1000))) }); };
  return <div className="space-y-2 rounded border border-[var(--border)] p-2 text-xs">
    <p>원본 {ms(view.rawSampleCount, view.sampleRate)}ms · {view.rawSampleCount} 샘플 · {view.sampleRate}Hz. 앞뒤 끝만 자릅니다. 문장 안의 쉼은 지우지 않고, 구간을 이어 붙이거나 속도를 바꾸지 않습니다.</p>
    <svg viewBox={`0 0 ${width} ${height}`} className="h-20 w-full rounded bg-[var(--bg)]" role="img" aria-label="원본 음성 파형"
      onClick={e => { if (choice !== "manual_range" || !range) return; const box = e.currentTarget.getBoundingClientRect(); const sample = Math.round((e.clientX - box.left) / box.width * view.rawSampleCount);
        setHeard(null); setAcknowledged([]); setRange(Math.abs(sample - range.startSample) <= Math.abs(sample - range.endSampleExclusive) ? { ...range, startSample: sample } : { ...range, endSampleExclusive: sample }); }}>
      {range && <rect x={x(range.startSample)} y={0} width={Math.max(1, x(range.endSampleExclusive) - x(range.startSample))} height={height} fill="currentColor" opacity={0.12} />}
      {view.peaks.map((peak, i) => { const px = i * view.samplesPerPeak / view.rawSampleCount * width; return <line key={i} x1={px} x2={px} y1={height / 2 - peak * height / 2} y2={height / 2 + peak * height / 2} stroke="currentColor" strokeWidth={1} opacity={0.7} />; })}
      {view.detected && <><line x1={x(view.detected.startSample)} x2={x(view.detected.startSample)} y1={0} y2={height} stroke="currentColor" strokeDasharray="2 3" /><line x1={x(view.detected.endSampleExclusive)} x2={x(view.detected.endSampleExclusive)} y1={0} y2={height} stroke="currentColor" strokeDasharray="2 3" /></>}
      {range && <><line x1={x(range.startSample)} x2={x(range.startSample)} y1={0} y2={height} stroke="currentColor" strokeWidth={2} /><line x1={x(range.endSampleExclusive)} x2={x(range.endSampleExclusive)} y1={0} y2={height} stroke="currentColor" strokeWidth={2} /></>}
    </svg>
    <p className="text-[var(--text-secondary)]">점선: 자동으로 찾은 말소리 시작·끝{view.detected ? ` (${ms(view.detected.startSample, view.sampleRate)}~${ms(view.detected.endSampleExclusive, view.sampleRate)}ms)` : " (찾지 못함)"}. 굵은 선과 음영: 선택한 구간.</p>
    <audio controls preload="none" className="w-full" src={`${src}&variant=raw`} />
    <fieldset className="space-y-1"><legend className="font-medium">어떻게 할까요?</legend>
      {view.status === "review_required" && <label className="flex items-center gap-1"><input type="radio" name={`edge-${sentenceId}`} checked={choice === "keep_raw"} onChange={() => select("keep_raw")} />원본 길이 유지 (자르지 않음){keepRawApproved ? " · 승인됨" : ""}</label>}
      <label className="flex items-center gap-1"><input type="radio" name={`edge-${sentenceId}`} disabled={!view.suggestion} checked={choice === "auto_range"} onChange={() => select("auto_range")} />
        자동 제안 구간 사용{view.suggestion ? ` (${ms(view.suggestion.startSample, view.sampleRate)}~${ms(view.suggestion.endSampleExclusive, view.sampleRate)}ms)` : " (제안 없음)"}</label>
      <label className="flex items-center gap-1"><input type="radio" name={`edge-${sentenceId}`} checked={choice === "manual_range"} onChange={() => select("manual_range")} />직접 구간 지정</label>
    </fieldset>
    {choice === "manual_range" && range && <div className="flex flex-wrap items-center gap-2">
      <label>시작(ms)<input type="number" min={0} max={ms(view.rawSampleCount, view.sampleRate)} step={1} value={ms(range.startSample, view.sampleRate)} disabled={!canEdit} className="ml-1 w-24 rounded border bg-[var(--bg)] p-1" onChange={e => setMs("startSample", e.target.value)} /></label>
      <label>끝(ms)<input type="number" min={0} max={ms(view.rawSampleCount, view.sampleRate)} step={1} value={ms(range.endSampleExclusive, view.sampleRate)} disabled={!canEdit} className="ml-1 w-24 rounded border bg-[var(--bg)] p-1" onChange={e => setMs("endSampleExclusive", e.target.value)} /></label>
      <span className="text-[var(--text-secondary)]">샘플 {range.startSample} ~ {range.endSampleExclusive} (저장은 샘플 번호 기준)</span>
      {view.suggestion && <AdminButton type="button" variant="secondary" disabled={!canEdit} onClick={() => { setHeard(null); setAcknowledged([]); setRange(view.suggestion); }}>자동 제안 값으로 채우기</AdminButton>}
    </div>}
    {choice === "keep_raw" && (keepRawApproved ? <p>원본 길이 유지가 승인되어 있습니다.</p> : <AdminButton type="button" variant="secondary" disabled={busy || !canEdit} onClick={() => void onKeepRaw()}>원본 길이 유지로 승인</AdminButton>)}
    {range && (choice === "auto_range" || choice === "manual_range") && <div className="space-y-1">
      <p>남는 길이 {valid ? ms(range.endSampleExclusive - range.startSample, view.sampleRate) : "-"}ms · 앞 {ms(range.startSample, view.sampleRate)}ms / 뒤 {ms(view.rawSampleCount - range.endSampleExclusive, view.sampleRate)}ms 제거</p>
      {!valid && <p className="font-semibold">시작은 끝보다 앞이어야 하고 원본 범위 안이어야 합니다.</p>}
      <AdminButton type="button" variant="secondary" disabled={!valid} onClick={() => void listen()}>선택 구간 미리 듣기</AdminButton>
      {warnings.map(w => <label key={w} className="flex items-center gap-1 font-semibold"><input type="checkbox" checked={acknowledged.includes(w)} onChange={e => setAcknowledged(e.target.checked ? [...acknowledged, w] : acknowledged.filter(a => a !== w))} />확인함: {warningLabels[w] ?? w}</label>)}
      <AdminButton type="button" disabled={busy || !canEdit || !valid || !listened || !warnings.every(w => acknowledged.includes(w))} onClick={() => void apply()}>들어본 구간으로 적용</AdminButton>
      {!listened && valid && <p className="text-[var(--text-secondary)]">적용 전에 선택 구간을 들어봐야 합니다.</p>}
    </div>}
    {view.decision && <p>현재 적용: {view.decision.mode === "auto_range" ? "자동 제안 구간" : "직접 지정 구간"} {ms(view.decision.startSample, view.sampleRate)}~{ms(view.decision.endSampleExclusive, view.sampleRate)}ms</p>}
    {message && <p role="status">{message}</p>}
  </div>;
}
