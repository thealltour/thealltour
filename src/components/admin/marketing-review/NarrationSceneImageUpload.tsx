"use client";

import { useEffect, useRef, useState } from "react";
import AdminButton from "@/components/admin/ui/AdminButton";

type Slot = { ready: boolean; asset?: { width: number; height: number; uploadedAt: string } | null };

/** A selected file is only a preview. Completion is shown only from the server manifest. */
export function NarrationSceneImageUpload({ index, disabled, slot, previewUrl, onUpload }: {
  index: number; disabled: boolean; slot: Slot | null; previewUrl: string;
  onUpload: (file: File, fit: boolean) => Promise<void>;
}) {
  const input = useRef<HTMLInputElement>(null);
  const submitting = useRef(false);
  const [file, setFile] = useState<File | null>(null);
  const [localUrl, setLocalUrl] = useState("");
  const [fit, setFit] = useState(true);
  const [dragging, setDragging] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");
  const [previewFailed, setPreviewFailed] = useState(false);
  const [dimensions, setDimensions] = useState<{ width: number; height: number } | null>(null);
  useEffect(() => {
    if (!file) { setLocalUrl(""); return; }
    const url = URL.createObjectURL(file);
    setLocalUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);
  useEffect(() => { setPreviewFailed(false); }, [previewUrl]);
  function select(files: FileList | null) {
    setDragging(false);
    if (disabled || submitting.current || !files?.length) return;
    if (files.length !== 1) { setError("문장 슬롯마다 이미지 한 장만 넣어주세요."); return; }
    const selected = files[0];
    if (!/\.(png|jpe?g|webp)$/i.test(selected.name) || (selected.type && !["image/png", "image/jpeg", "image/webp"].includes(selected.type))) {
      setError("PNG / JPEG / WEBP 이미지만 선택할 수 있습니다."); return;
    }
    if (!selected.size || selected.size > 15 * 1024 * 1024) { setError("이미지는 빈 파일이 아니어야 하며 최대 15MB입니다."); return; }
    setDimensions(null); setFile(selected); setError("");
  }
  async function send() {
    if (!file || disabled || submitting.current) return;
    submitting.current = true; setUploading(true); setError("");
    try { await onUpload(file, fit); setFile(null); setDimensions(null); }
    catch (failure) { setError(failure instanceof Error ? failure.message : "업로드에 실패했습니다. 다시 시도해주세요."); }
    finally { submitting.current = false; setUploading(false); }
  }
  const locked = disabled || uploading;
  return <div className="space-y-3">
    <div className={`rounded-lg border-2 border-dashed p-4 ${dragging ? "border-[var(--primary)] bg-[var(--bg)]" : "border-[var(--border)]"}`}
      onDragOver={event => { event.preventDefault(); event.dataTransfer.dropEffect = locked ? "none" : "copy"; if (!locked) setDragging(true); }}
      onDragLeave={event => { if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setDragging(false); }}
      onDrop={event => { event.preventDefault(); select(event.dataTransfer.files); }}>
      <p className="mb-2">{uploading ? "이미지 저장 중…" : "이 문장에 사용할 이미지 한 장을 여기에 끌어놓으세요."}</p>
      <AdminButton type="button" variant="secondary" disabled={locked} onClick={() => input.current?.click()}>이미지 파일 선택</AdminButton>
      <input ref={input} aria-label={`장면 ${index + 1} 이미지 선택`} className="sr-only" type="file" accept="image/png,image/jpeg,image/webp" disabled={locked}
        onChange={event => { select(event.target.files); event.target.value = ""; }} />
      <p className="mt-2 text-xs text-[var(--text-secondary)]">PNG · JPEG · WEBP / 최대 15MB · 선택 후 미리보기를 확인하고 업로드하세요.</p>
    </div>
    {file && <div className="space-y-2 rounded border border-[var(--border)] p-3">
      <p className="font-medium">선택한 이미지 · 아직 저장되지 않음</p>
      {localUrl && <img alt={`장면 ${index + 1} 업로드 전 미리보기`} src={localUrl}
        className={fit ? "aspect-[9/16] w-36 rounded bg-[#111827] object-contain" : "max-h-64 max-w-full rounded"}
        onLoad={event => { const image = event.currentTarget; setDimensions({ width: image.naturalWidth, height: image.naturalHeight }); }}
        onError={() => setError("선택한 이미지를 미리 볼 수 없습니다. 파일 형식을 확인해주세요.")} />}
      <p className="break-all text-xs">{file.name} · {(file.size / 1024 / 1024).toFixed(2)}MB{dimensions ? ` · ${dimensions.width}×${dimensions.height}` : ""}</p>
      <label className="flex items-start gap-2"><input type="checkbox" checked={fit} disabled={locked} onChange={event => setFit(event.target.checked)} />원본 보존 · 9:16 여백 맞춤</label>
      <p className="text-xs text-[var(--text-secondary)]">9:16이 아닌 이미지는 원본을 자르거나 늘리지 않고 어두운 여백을 추가합니다. 여백은 영상에도 포함됩니다.</p>
      <div className="flex gap-2"><AdminButton type="button" disabled={locked} onClick={() => void send()}>{uploading ? "업로드 중…" : slot?.ready ? "이 이미지로 교체 업로드" : "미리보기 확인 · 업로드"}</AdminButton>
        <AdminButton type="button" variant="secondary" disabled={locked} onClick={() => { setFile(null); setDimensions(null); setError(""); }}>선택 취소</AdminButton></div>
    </div>}
    {error && <p role="alert" className="text-sm text-red-600">{error}</p>}
    {slot?.ready ? <div className="space-y-2 rounded border border-green-600/30 p-3">
      <p className="font-medium text-green-700">✓ 서버 저장 완료{file ? " · 아래는 현재 저장된 이미지입니다." : ""}</p>
      <img alt={`장면 ${index + 1} 저장된 비주얼`} src={previewUrl} className="aspect-[9/16] w-36 rounded bg-[#111827] object-contain" onError={() => setPreviewFailed(true)} />
      {previewFailed && <p role="alert">저장 기록은 있지만 미리보기를 불러오지 못했습니다. 최신 음성·계획을 다시 불러와 확인해주세요.</p>}
      {slot.asset && <p className="text-xs text-[var(--text-secondary)]">{slot.asset.width}×{slot.asset.height} · 저장 시각 {new Date(slot.asset.uploadedAt).toLocaleString("ko-KR")}</p>}
    </div> : <p className="text-[var(--text-secondary)]">이미지 업로드 필요</p>}
  </div>;
}
