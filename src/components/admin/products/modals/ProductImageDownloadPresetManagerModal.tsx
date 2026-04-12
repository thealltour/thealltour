"use client";

import { useEffect, useState } from "react";
import { X } from "lucide-react";
import type { ImageFileNamingMode, ImageOutputFormat } from "@/lib/images/imageDownload.types";
import type { CreateImageDownloadPresetInput } from "@/lib/images/imageDownloadPreset.helpers";
import type { StoredImageDownloadPreset } from "@/lib/images/imageDownloadPreset.storage";
import { getImageDownloadPresetSummary } from "@/lib/images/getImageDownloadPresetSummary";

const QUALITY_MIN = 0.6;
const QUALITY_MAX = 1;
const QUALITY_STEP = 0.05;

type ConfirmDialog = (options: {
  title: string;
  description?: string;
  confirmLabel?: string;
  cancelLabel?: string;
}) => Promise<boolean>;

export type ProductImageDownloadPresetManagerModalProps = {
  open: boolean;
  presets: StoredImageDownloadPreset[];
  defaultPresetId: string | null;
  quickRunEnabled: boolean;
  onClose: () => void;
  onCreatePreset: (input: CreateImageDownloadPresetInput) => void;
  onUpdatePreset: (presetId: string, patch: Partial<StoredImageDownloadPreset>) => void;
  onDeletePreset: (presetId: string) => void;
  onDuplicatePreset: (presetId: string) => void;
  onSetDefaultPreset: (presetId: string) => void;
  onSetQuickRunEnabled: (enabled: boolean) => void;
  requestConfirm: ConfirmDialog;
};

export default function ProductImageDownloadPresetManagerModal({
  open,
  presets,
  defaultPresetId,
  quickRunEnabled,
  onClose,
  onCreatePreset,
  onUpdatePreset,
  onDeletePreset,
  onDuplicatePreset,
  onSetDefaultPreset,
  onSetQuickRunEnabled,
  requestConfirm,
}: ProductImageDownloadPresetManagerModalProps) {
  const [newName, setNewName] = useState("");
  const [newFormat, setNewFormat] = useState<ImageOutputFormat>("png");
  const [newQuality, setNewQuality] = useState(0.92);
  const [newNamingMode, setNewNamingMode] = useState<ImageFileNamingMode>("detailed");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState("");

  useEffect(() => {
    if (!open) return;
    setNewName("");
    setNewFormat("png");
    setNewQuality(0.92);
    setNewNamingMode("detailed");
    setEditingId(null);
    setEditingName("");
  }, [open]);

  if (!open) return null;

  const handleAddPreset = () => {
    const name = newName.trim();
    if (!name) return;
    onCreatePreset({
      name,
      format: newFormat,
      namingMode: newNamingMode,
      quality: newQuality,
    });
    setNewName("");
  };

  const startEditName = (p: StoredImageDownloadPreset) => {
    setEditingId(p.id);
    setEditingName(p.name);
  };

  const saveEditName = (presetId: string) => {
    const name = editingName.trim();
    if (!name) return;
    onUpdatePreset(presetId, { name });
    setEditingId(null);
    setEditingName("");
  };

  const cancelEditName = () => {
    setEditingId(null);
    setEditingName("");
  };

  const handleDelete = async (p: StoredImageDownloadPreset) => {
    const ok = await requestConfirm({
      title: "preset 삭제",
      description: `「${p.name}」을(를) 삭제할까요?`,
      confirmLabel: "삭제",
      cancelLabel: "취소",
    });
    if (ok) onDeletePreset(p.id);
  };

  return (
    <div
      className="fixed inset-0 z-[86] flex items-center justify-center bg-black/50 p-3 sm:p-6"
      role="dialog"
      aria-modal="true"
      aria-labelledby="preset-manager-title"
      onClick={onClose}
    >
      <div
        className="flex max-h-[min(90vh,720px)] w-full max-w-lg flex-col rounded-xl border border-[var(--border)] bg-[var(--surface)] shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="flex shrink-0 items-start justify-between gap-2 border-b border-[var(--border)] px-4 py-3">
          <div className="min-w-0">
            <h2
              id="preset-manager-title"
              className="text-base font-bold text-[var(--text-primary)]"
            >
              다운로드 preset 관리
            </h2>
            <p className="mt-1 text-xs text-[var(--text-muted)]">
              자주 쓰는 이미지 다운로드 옵션을 저장하고 기본값으로 지정할 수 있습니다.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="shrink-0 rounded-lg p-2 text-[var(--text-muted)] hover:bg-[var(--surface-muted)]"
            aria-label="닫기"
          >
            <X className="h-5 w-5" />
          </button>
        </header>

        <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-4 py-4">
          <div className="rounded-lg border border-[var(--border)] bg-[var(--surface-muted)]/30 px-3 py-3">
            <label className="flex cursor-pointer items-start gap-2 text-sm text-[var(--text-primary)]">
              <input
                type="checkbox"
                checked={quickRunEnabled}
                onChange={(e) => onSetQuickRunEnabled(e.target.checked)}
                className="mt-0.5 accent-[var(--primary)]"
              />
              <span>
                <span className="font-semibold">기본 preset으로 바로 다운로드 실행</span>
                <span className="mt-1 block text-xs font-normal text-[var(--text-muted)]">
                  활성화하면 메인 다운로드 버튼 클릭 시 옵션 창 없이 기본 preset으로 바로 실행합니다.
                </span>
              </span>
            </label>
          </div>

          <div className="space-y-2">
            <p className="text-xs font-semibold text-[var(--text-primary)]">저장된 preset</p>
            {presets.length === 0 ? (
              <p className="rounded-lg border border-dashed border-[var(--border)] px-3 py-6 text-center text-sm text-[var(--text-muted)]">
                등록된 preset이 없습니다. 아래에서 추가할 수 있습니다.
              </p>
            ) : (
              <ul className="space-y-2">
                {presets.map((p) => {
                  const isDefault = p.id === defaultPresetId;
                  const summary = getImageDownloadPresetSummary(p);
                  const isEditing = editingId === p.id;
                  return (
                    <li
                      key={p.id}
                      className="rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-2.5"
                    >
                      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                        <div className="min-w-0 flex-1">
                          {isEditing ? (
                            <div className="flex flex-wrap items-center gap-2">
                              <input
                                type="text"
                                value={editingName}
                                onChange={(e) => setEditingName(e.target.value)}
                                className="min-w-[8rem] flex-1 rounded-md border border-[var(--border)] bg-[var(--surface)] px-2 py-1 text-sm text-[var(--text-primary)]"
                                maxLength={200}
                                aria-label="preset 이름"
                              />
                              <button
                                type="button"
                                onClick={() => saveEditName(p.id)}
                                disabled={!editingName.trim()}
                                className="rounded-md bg-[var(--primary)] px-2 py-1 text-xs font-semibold text-[var(--on-primary)] disabled:opacity-50"
                              >
                                저장
                              </button>
                              <button
                                type="button"
                                onClick={cancelEditName}
                                className="rounded-md border border-[var(--border)] px-2 py-1 text-xs font-semibold text-[var(--text-secondary)]"
                              >
                                취소
                              </button>
                            </div>
                          ) : (
                            <p
                              className="truncate text-sm font-semibold text-[var(--text-primary)]"
                              title={p.name}
                            >
                              {p.name}
                            </p>
                          )}
                          <p className="mt-0.5 font-mono text-[11px] text-[var(--text-muted)]">{summary}</p>
                          {isDefault ? (
                            <div className="mt-1 flex flex-wrap items-center gap-1.5">
                              <span className="rounded-full bg-[var(--primary-soft)] px-2 py-0.5 text-[10px] font-bold text-[var(--primary)]">
                                기본
                              </span>
                              {quickRunEnabled ? (
                                <span className="text-[10px] text-[var(--text-muted)]">
                                  빠른 실행 사용 중
                                </span>
                              ) : null}
                            </div>
                          ) : null}
                        </div>
                        {!isEditing ? (
                          <div className="flex flex-wrap gap-1 sm:justify-end">
                            {!isDefault ? (
                              <button
                                type="button"
                                onClick={() => onSetDefaultPreset(p.id)}
                                className="rounded border border-[var(--border)] px-2 py-1 text-[10px] font-semibold text-[var(--text-secondary)] hover:bg-[var(--surface-muted)]"
                              >
                                기본 지정
                              </button>
                            ) : null}
                            <button
                              type="button"
                              onClick={() => onDuplicatePreset(p.id)}
                              className="rounded border border-[var(--border)] px-2 py-1 text-[10px] font-semibold text-[var(--text-secondary)] hover:bg-[var(--surface-muted)]"
                            >
                              복제
                            </button>
                            <button
                              type="button"
                              onClick={() => startEditName(p)}
                              className="rounded border border-[var(--border)] px-2 py-1 text-[10px] font-semibold text-[var(--text-secondary)] hover:bg-[var(--surface-muted)]"
                            >
                              이름 수정
                            </button>
                            <button
                              type="button"
                              onClick={() => void handleDelete(p)}
                              className="rounded border border-[var(--danger)]/35 px-2 py-1 text-[10px] font-semibold text-[var(--danger)] hover:bg-[var(--danger-bg)]"
                            >
                              삭제
                            </button>
                          </div>
                        ) : null}
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>

          <div className="space-y-3 rounded-lg border border-[var(--border)] bg-[var(--surface-muted)]/20 px-3 py-3">
            <p className="text-xs font-semibold text-[var(--text-primary)]">새 preset 추가</p>
            <label className="block text-xs text-[var(--text-muted)]">
              이름
              <input
                type="text"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                placeholder="예: 블로그용 JPG"
                className="mt-1 w-full rounded-md border border-[var(--border)] bg-[var(--surface)] px-2 py-1.5 text-sm text-[var(--text-primary)]"
                maxLength={200}
              />
            </label>
            <fieldset className="space-y-1">
              <legend className="text-xs font-semibold text-[var(--text-primary)]">출력 포맷</legend>
              <label className="flex cursor-pointer items-center gap-2 text-sm">
                <input
                  type="radio"
                  name="new-zip-format"
                  checked={newFormat === "png"}
                  onChange={() => setNewFormat("png")}
                  className="accent-[var(--primary)]"
                />
                PNG
              </label>
              <label className="flex cursor-pointer items-center gap-2 text-sm">
                <input
                  type="radio"
                  name="new-zip-format"
                  checked={newFormat === "jpg"}
                  onChange={() => setNewFormat("jpg")}
                  className="accent-[var(--primary)]"
                />
                JPG
              </label>
            </fieldset>
            {newFormat === "jpg" ? (
              <div>
                <label className="text-xs font-semibold text-[var(--text-primary)]">
                  JPG 품질 <span className="font-mono">{newQuality.toFixed(2)}</span>
                </label>
                <input
                  type="range"
                  min={QUALITY_MIN}
                  max={QUALITY_MAX}
                  step={QUALITY_STEP}
                  value={newQuality}
                  onChange={(e) => setNewQuality(Number(e.target.value))}
                  className="mt-1 w-full accent-[var(--primary)]"
                />
              </div>
            ) : null}
            <fieldset className="space-y-1">
              <legend className="text-xs font-semibold text-[var(--text-primary)]">파일명 규칙</legend>
              <label className="flex cursor-pointer items-center gap-2 text-sm">
                <input
                  type="radio"
                  name="new-zip-naming"
                  checked={newNamingMode === "detailed"}
                  onChange={() => setNewNamingMode("detailed")}
                  className="accent-[var(--primary)]"
                />
                상세
              </label>
              <label className="flex cursor-pointer items-center gap-2 text-sm">
                <input
                  type="radio"
                  name="new-zip-naming"
                  checked={newNamingMode === "simple"}
                  onChange={() => setNewNamingMode("simple")}
                  className="accent-[var(--primary)]"
                />
                간단
              </label>
            </fieldset>
            <button
              type="button"
              disabled={!newName.trim()}
              onClick={handleAddPreset}
              className="w-full rounded-lg bg-[var(--primary)] py-2 text-sm font-semibold text-[var(--on-primary)] disabled:opacity-50"
            >
              preset 추가
            </button>
          </div>
        </div>

        <footer className="shrink-0 border-t border-[var(--border)] px-4 py-3">
          <button
            type="button"
            onClick={onClose}
            className="w-full rounded-lg border border-[var(--border)] bg-[var(--surface)] py-2 text-sm font-semibold text-[var(--text-secondary)] hover:bg-[var(--surface-muted)]"
          >
            닫기
          </button>
        </footer>
      </div>
    </div>
  );
}
