"use client";

import type { Dispatch, SetStateAction } from "react";
import type { ProductFormState } from "@/types/adminProductForm";
import type { SelectedEventRef } from "@/types/product";
import type { DayScheduleDraft } from "@/components/admin/products/editor/adminProductForm.helpers";
import { HintDisclosure } from "@/components/admin/common/HintDisclosure";
import { ScheduleVisualEditorV2 } from "@/components/admin/ScheduleVisualEditorV2";
import { StructuredDaysEditor } from "@/components/admin/itinerary/structured/StructuredDaysEditor";
import { ImageUploadField } from "@/components/admin/ImageUploadField";

export type ScheduleSectionProps = {
  form: ProductFormState;
  setForm: Dispatch<SetStateAction<ProductFormState>>;
  scheduleEditorMode: "visual" | "legacy";
  setScheduleEditorMode: (mode: "visual" | "legacy") => void;
  selectedEvent: SelectedEventRef | null;
  setSelectedEvent: Dispatch<SetStateAction<SelectedEventRef | null>>;
  pasteToAddValue: string;
  setPasteToAddValue: (v: string) => void;
  getSelectedEventLabel: () => string | null;
  addImagesToEvent: (ref: SelectedEventRef | null, urls: string[]) => number;
  showToast: (type: "success" | "error" | "warning", message: string) => void;
  previewImageObjectUrl: string | null;
  activeSchedulePreviewIndex: number;
  setActiveSchedulePreviewIndex: Dispatch<SetStateAction<number>>;
  showRawScheduleEditor: boolean;
  setShowRawScheduleEditor: Dispatch<SetStateAction<boolean>>;
  scheduleDrafts: DayScheduleDraft[];
  effectiveDayCount: number;
  updateScheduleDrafts: (updater: (current: DayScheduleDraft[]) => DayScheduleDraft[]) => void;
  addScheduleDay: () => void;
  appendScheduleTemplate: (index: number, templateText: string) => void;
};

export function ScheduleSection({
  form,
  setForm,
  scheduleEditorMode,
  setScheduleEditorMode,
  selectedEvent,
  setSelectedEvent,
  pasteToAddValue,
  setPasteToAddValue,
  getSelectedEventLabel,
  addImagesToEvent,
  showToast,
  previewImageObjectUrl,
  activeSchedulePreviewIndex,
  setActiveSchedulePreviewIndex,
  showRawScheduleEditor,
  setShowRawScheduleEditor,
  scheduleDrafts,
  effectiveDayCount,
  updateScheduleDrafts,
  addScheduleDay,
  appendScheduleTemplate,
}: ScheduleSectionProps) {
  return (
﻿        <div className="space-y-3" id="field-schedule-root" tabIndex={-1}>
          {selectedEvent && getSelectedEventLabel() && (
            <div className="rounded-lg border border-[var(--primary)] bg-[var(--primary-soft)]/40 px-3 py-2">
              <p className="text-sm font-semibold text-[var(--primary)]">
                현재 이미지 추가 대상: {getSelectedEventLabel()}
              </p>
            </div>
          )}
          <div className="rounded-lg border border-[var(--border)] bg-[var(--surface-muted)]/30 p-3">
            <HintDisclosure
              id="schedule.pasteToAddGuide"
              summary="URL을 줄바꿈으로 붙여넣으면 이미지가 추가됩니다."
            >
              {`1) 상단 이미지 자동 등록 [!] 버튼으로 북마클릿 복사
2) 브라우저 북마크 URL에 붙여넣기
3) 모두투어 등 원본 페이지에서 북마클릿 실행 → URL 복사됨
4) 아래 입력란에 URL을 붙여넣기 (줄바꿈 또는 쉼표 구분)

※ 먼저 아래 일정에서 "이 이벤트에 추가 대상"을 선택한 뒤, "선택 이벤트에 추가"를 누르세요.`}
            </HintDisclosure>
            <p className="mb-2 mt-2 text-xs font-semibold text-[var(--text-secondary)]">붙여넣기로 이미지 추가 (Paste-to-Add)</p>
            <textarea
              value={pasteToAddValue}
              onChange={(e) => setPasteToAddValue(e.target.value)}
              placeholder="북마클릿으로 복사한 URL을 여기에 붙여넣으세요 (줄바꿈·쉼표 구분)"
              rows={3}
              className="w-full rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm text-[var(--text-primary)] outline-none focus:border-[var(--primary)] focus:ring-2 focus:ring-[var(--primary-soft)]"
            />
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <button
                type="button"
                disabled={selectedEvent == null}
                onClick={() => {
                  if (selectedEvent == null) return;
                  const count = addImagesToEvent(selectedEvent, [pasteToAddValue]);
                  setPasteToAddValue("");
                  if (count > 0) showToast("success", `선택 이벤트에 ${count}개 이미지 추가됨`);
                  else showToast("warning", "추가할 수 있는 URL이 없습니다. (중복 또는 비허용 URL)");
                }}
                className="rounded-lg border border-[var(--primary)] bg-[var(--primary)] px-3 py-2 text-sm font-semibold text-[var(--on-primary)] hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
              >
                선택 이벤트에 추가
              </button>
              {selectedEvent == null && (
                <span className="text-xs text-[var(--text-muted)]">
                  먼저 아래 일정에서 &quot;이 이벤트에 추가 대상&quot;을 선택하세요.
                </span>
              )}
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2 border-b border-[var(--divider)] pb-2">
            <span className="text-xs font-semibold text-[var(--text-muted)]">일정 입력 방식</span>
            <div className="flex rounded-lg border border-[var(--border)] bg-slate-50 p-0.5">
              <button
                type="button"
                onClick={() => setScheduleEditorMode("visual")}
                className={`rounded-md px-3 py-1.5 text-sm font-medium transition ${
                  scheduleEditorMode === "visual"
                    ? "bg-[var(--surface)] text-[var(--primary)] shadow-sm"
                    : "text-[var(--text-secondary)] hover:text-slate-900"
                }`}
              >
                시각화 일정(권장)
              </button>
              <button
                type="button"
                onClick={() => setScheduleEditorMode("legacy")}
                className={`rounded-md px-3 py-1.5 text-sm font-medium transition ${
                  scheduleEditorMode === "legacy"
                    ? "bg-[var(--surface)] text-[var(--primary)] shadow-sm"
                    : "text-[var(--text-secondary)] hover:text-slate-900"
                }`}
              >
                레거시 텍스트(기존)
              </button>
            </div>
          </div>

          {scheduleEditorMode === "visual" ? (
            <ScheduleVisualEditorV2
              form={form}
              setForm={setForm}
              previewProductImageUrl={previewImageObjectUrl ?? form.images_json[0] ?? form.image_url ?? ""}
              activeDayIndex={activeSchedulePreviewIndex}
              setActiveDayIndex={setActiveSchedulePreviewIndex}
              selectedEvent={selectedEvent}
              onSelectEvent={setSelectedEvent}
            />
          ) : (
        <div className="flex flex-col space-y-3 md:space-y-0 md:grid md:grid-cols-2 md:gap-3">
          <div className="space-y-3 rounded-lg border border-[var(--border)] bg-[var(--primary-soft)] p-3 md:col-span-2">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <p className="text-sm font-semibold text-[var(--primary)]">상세일정 작성 도우미</p>
                <p className="text-xs text-[var(--text-muted)]">일차별로 작성하면 자동으로 탭 형식으로 저장됩니다.</p>
                <p className="mt-0.5 text-xs text-blue-700">이 일정은 상세 첫 화면의 여행 오버뷰 타임라인에도 자동 반영됩니다.</p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={addScheduleDay}
                  className="rounded-lg border border-[var(--primary)]/30 bg-[var(--surface)] px-3 py-1.5 text-xs font-semibold text-[var(--primary)] hover:bg-[var(--primary-soft)]"
                >
                  + 일차 추가
                </button>
                <button
                  type="button"
                  onClick={() => setShowRawScheduleEditor((prev) => !prev)}
                  className="rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-1.5 text-xs font-semibold text-[var(--text-primary)] hover:bg-[var(--surface-muted)]"
                >
                  {showRawScheduleEditor ? "원문 편집 숨기기" : "원문 직접 편집"}
                </button>
              </div>
            </div>

            {!showRawScheduleEditor ? (
              <StructuredDaysEditor
                days={form.itinerary_days_json}
                onDaysChange={(updater) =>
                  setForm((prev) => ({ ...prev, itinerary_days_json: updater(prev.itinerary_days_json) }))
                }
                onDayFocus={setActiveSchedulePreviewIndex}
                selectedEvent={selectedEvent}
                onSelectEvent={setSelectedEvent}
              />
            ) : (
            <>
            {scheduleDrafts.length === 0 ? (
              <button
                type="button"
                onClick={addScheduleDay}
                className="w-full rounded-lg border border-dashed border-[var(--border)] bg-[var(--surface)] px-3 py-6 text-sm font-semibold text-[var(--text-secondary)] hover:bg-[var(--surface-muted)]"
              >
                일차를 추가하고 상세일정을 입력해 주세요
              </button>
            ) : (
              <div className="space-y-3">
                {scheduleDrafts.map((item, index) => (
                  <article key={`${item.label}-${index}`} className="rounded-lg border border-[var(--border)] bg-[var(--surface)] p-3">
                    <div className="mb-2 flex flex-wrap items-center gap-2">
                      <input
                        value={item.label}
                        onFocus={() => setActiveSchedulePreviewIndex(index)}
                        onChange={(event) =>
                          updateScheduleDrafts((current) =>
                            current.map((draft, draftIndex) =>
                              draftIndex === index ? { ...draft, label: event.target.value } : draft,
                            ),
                          )
                        }
                        placeholder="예: 1일차"
                        className="w-28 rounded-md border border-[var(--border)] px-2.5 py-1.5 text-xs font-semibold text-[var(--text-primary)] outline-none focus:border-[var(--primary)] focus:ring-2 focus:ring-[var(--primary-soft)]"
                      />
                      <div className="ml-auto flex items-center gap-1.5">
                        <button
                          type="button"
                          disabled={index === 0}
                          onClick={() =>
                            updateScheduleDrafts((current) => {
                              if (index <= 0) return current;
                              const next = [...current];
                              const target = next[index];
                              next[index] = next[index - 1];
                              next[index - 1] = target;
                              return next;
                            })
                          }
                          className="rounded border border-[var(--border)] px-2 py-1 text-[11px] text-[var(--text-primary)] disabled:opacity-40"
                        >
                          위로
                        </button>
                        <button
                          type="button"
                          disabled={index >= scheduleDrafts.length - 1}
                          onClick={() =>
                            updateScheduleDrafts((current) => {
                              if (index >= current.length - 1) return current;
                              const next = [...current];
                              const target = next[index];
                              next[index] = next[index + 1];
                              next[index + 1] = target;
                              return next;
                            })
                          }
                          className="rounded border border-[var(--border)] px-2 py-1 text-[11px] text-[var(--text-primary)] disabled:opacity-40"
                        >
                          아래로
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            updateScheduleDrafts((current) =>
                              current.filter((_, draftIndex) => draftIndex !== index),
                            );
                            setActiveSchedulePreviewIndex((prev) =>
                              prev > index ? prev - 1 : Math.max(0, Math.min(prev, scheduleDrafts.length - 2)),
                            );
                          }}
                          className="rounded border border-rose-200 px-2 py-1 text-[11px] text-rose-600 hover:bg-rose-50"
                        >
                          삭제
                        </button>
                      </div>
                    </div>
                    <textarea
                      value={item.content}
                      onFocus={() => setActiveSchedulePreviewIndex(index)}
                      onChange={(event) =>
                        updateScheduleDrafts((current) =>
                          current.map((draft, draftIndex) =>
                            draftIndex === index ? { ...draft, content: event.target.value } : draft,
                          ),
                        )
                      }
                      rows={5}
                      placeholder="해당 일차의 일정을 입력해 주세요."
                      className="w-full rounded-lg border border-[var(--border)] px-3 py-2 text-sm leading-6 outline-none focus:border-[var(--primary)] focus:ring-2 focus:ring-[var(--primary-soft)]"
                    />
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      {[
                        { label: "TEE OFF", text: "▷TEE OFF TIME: " },
                        { label: "식사", text: "▷식사: " },
                        { label: "이동", text: "▷이동: " },
                        { label: "호텔", text: "▷숙소: " },
                      ].map((template) => (
                        <button
                          key={template.label}
                          type="button"
                          onClick={() => appendScheduleTemplate(index, template.text)}
                          className="rounded-md border border-[var(--border)] bg-[var(--surface)] px-2 py-1 text-[11px] font-semibold text-[var(--text-primary)] hover:bg-[var(--surface-muted)]"
                        >
                          + {template.label}
                        </button>
                      ))}
                    </div>
                  </article>
                ))}
              </div>
            )}

            </>
            )}

            {effectiveDayCount > 0 ? (
              <div className="rounded-xl border border-[var(--primary)]/20 bg-[var(--surface)] p-4">
                <p className="mb-2 text-xs font-semibold text-blue-700">실시간 미리보기</p>
                <div className="mb-2 inline-flex items-center rounded-full bg-[var(--primary-soft)] px-2.5 py-1 text-xs font-bold text-[var(--primary)]">
                  {form.itinerary_days_json.length > 0
                    ? form.itinerary_days_json[activeSchedulePreviewIndex]?.title || `Day ${(form.itinerary_days_json[activeSchedulePreviewIndex]?.day ?? activeSchedulePreviewIndex + 1)}`
                    : scheduleDrafts[activeSchedulePreviewIndex]?.label || `${activeSchedulePreviewIndex + 1}일차`}
                </div>
                <p className="whitespace-pre-line text-sm leading-7 text-[var(--text-primary)]">
                  {form.itinerary_days_json.length > 0
                    ? (form.itinerary_days_json[activeSchedulePreviewIndex]?.events ?? [])
                        .map((e) => (e.description ? `${e.heading}: ${e.description}` : e.heading))
                        .join("\n") || "입력한 일정이 여기에 표시됩니다."
                    : scheduleDrafts[activeSchedulePreviewIndex]?.content || "입력한 일정이 여기에 표시됩니다."}
                </p>
              </div>
            ) : null}

            {effectiveDayCount > 0 ? (
              <div className="rounded-xl border border-[var(--border)] bg-[var(--surface-muted)] p-4">
                <p className="mb-2 text-xs font-semibold text-[var(--text-primary)]">Day별 대표 이미지 (선택)</p>
                <p className="mb-3 text-xs text-[var(--text-muted)]">
                  일차별로 업로드하거나 URL을 넣으면 상세 일정 타임라인에 표시됩니다. 비우면 상품 대표 이미지로 대체됩니다.
                </p>
                <div className="flex flex-col space-y-3 sm:space-y-0 sm:grid sm:grid-cols-2 sm:gap-4">
                  {Array.from({ length: effectiveDayCount }, (_, i) => i + 1).map((dayNum) => {
                    const dayKey = String(dayNum);
                    const url = form.itinerary_media_json[dayKey] ?? "";
                    return (
                      <div key={dayKey} className="space-y-1 rounded-lg border border-[var(--border)] bg-[var(--surface)] p-3">
                        <p className="text-xs font-semibold text-[var(--text-primary)]">Day {dayNum}</p>
                        <ImageUploadField
                          value={url}
                          onChange={(v) =>
                            setForm((prev) => ({
                              ...prev,
                              itinerary_media_json: { ...prev.itinerary_media_json, [dayKey]: v },
                            }))
                          }
                          onUploaded={(v) =>
                            setForm((prev) => ({
                              ...prev,
                              itinerary_media_json: { ...prev.itinerary_media_json, [dayKey]: v },
                            }))
                          }
                          uploadedUrlKey="card"
                          optional
                          placeholder="Day 이미지 URL 또는 업로드"
                        />
                      </div>
                    );
                  })}
                </div>
              </div>
            ) : null}

            {showRawScheduleEditor ? (
              <textarea
                value={form.detailed_schedule}
                onChange={(event) => setForm((prev) => ({ ...prev, detailed_schedule: event.target.value }))}
                rows={8}
                placeholder={"원문 직접 편집\n예시:\n[1일차]\n인천 출발 / 하노이 도착\n...\n\n[2일차]\n하노이 시내관광\n..."}
                className="w-full rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm text-[var(--text-primary)] outline-none focus:border-[var(--primary)] focus:ring-2 focus:ring-[var(--primary-soft)]"
              />
            ) : null}
          </div>
        </div>
          )}
        </div>
  );
}
