"use client";

import type { Dispatch, SetStateAction } from "react";
import type { ProductFormState } from "@/types/adminProductForm";
import type { SelectedEventRef } from "@/types/product";
import { MultiImageUploadField } from "@/components/admin/MultiImageUploadField";
import { normalizeProductImageUrl } from "@/lib/media/normalizeProductImageUrl";
import { BOOKMARKLET_EXTRACT_IMAGE_URLS } from "@/lib/bookmarkletExtractImageUrls";

export type BasicInfoSectionProps = {
  form: ProductFormState;
  setForm: Dispatch<SetStateAction<ProductFormState>>;
  /** 가격·구간 필드 콤마 포맷 (숫자만 허용, 음수·문자 제거) */
  formatPriceWithCommas: (raw: string) => string;
  setTitleExtractPaste: (v: string) => void;
  setTitleCandidates: (v: string[]) => void;
  setShowTitleExtractModal: (open: boolean) => void;
  selectedEvent: SelectedEventRef | null;
  addProductImageToSelectedEvent: (url: string) => boolean;
  showToast: (type: "success" | "error" | "warning", message: string) => void;
  previewImageFile: File | null;
  setPreviewImageFile: (f: File | null) => void;
  openCoverRecommendModal: () => void;
  setShowImageImportGuideModal: (open: boolean) => void;
};

export function BasicInfoSection({
  form,
  setForm,
  formatPriceWithCommas,
  setTitleExtractPaste,
  setTitleCandidates,
  setShowTitleExtractModal,
  selectedEvent,
  addProductImageToSelectedEvent,
  showToast,
  previewImageFile,
  setPreviewImageFile,
  openCoverRecommendModal,
  setShowImageImportGuideModal,
}: BasicInfoSectionProps) {
  return (
        <div className="flex flex-col gap-3">
          <div className="flex flex-wrap items-center gap-2">
          <input
            value={form.title}
            onChange={(event) => setForm((prev) => ({ ...prev, title: event.target.value }))}
            required
            placeholder="상품명"
            id="field-product-name"
            className="min-w-0 flex-1 rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm text-[var(--text-primary)] outline-none focus:border-[var(--primary)] focus:ring-2 focus:ring-[var(--primary-soft)]"
          />
          <button
            type="button"
            onClick={() => {
              setTitleExtractPaste("");
              setTitleCandidates([]);
              setShowTitleExtractModal(true);
            }}
            className="shrink-0 rounded-lg border border-[var(--primary)]/50 bg-[var(--primary-soft)] px-3 py-2 text-sm font-medium text-[var(--primary)] hover:bg-[var(--primary-soft)]/80"
          >
            상품명 추출
          </button>
          </div>
          <div>
            <label className="mb-1 block text-xs font-semibold text-[var(--text-secondary)]">한 줄 소개 (상세 상단 요약)</label>
            <input
              value={form.one_liner}
              onChange={(event) => setForm((prev) => ({ ...prev, one_liner: event.target.value }))}
              placeholder="비우면 상품 설명 첫 줄 사용"
              id="form-field-basic-one_liner"
              className="w-full rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm text-[var(--text-primary)] outline-none focus:border-[var(--primary)] focus:ring-2 focus:ring-[var(--primary-soft)]"
            />
          </div>

          <div className="space-y-4 rounded-xl border border-[var(--border)] bg-[var(--surface)] p-4">
            <div className="space-y-1">
              <label
                htmlFor="field-price-main"
                className="block text-xs font-semibold text-[var(--text-secondary)]"
              >
                기본 가격 (대표가, fallback)
              </label>
              <input
                id="field-price-main"
                value={form.price}
                onChange={(e) =>
                  setForm((prev) => ({ ...prev, price: formatPriceWithCommas(e.target.value) }))
                }
                placeholder="예: 899000"
                inputMode="numeric"
                autoComplete="off"
                className="w-full rounded-lg border border-[var(--border)] bg-[var(--surface-muted)] px-3 py-2 text-sm text-[var(--text-primary)] outline-none focus:border-[var(--primary)] focus:ring-2 focus:ring-[var(--primary-soft)]"
              />
              <p className="text-[11px] leading-relaxed text-[var(--text-muted)]">
                기본 가격(최저가 기준)입니다. 가격 구간을 입력하면 상세페이지에 함께 표시됩니다.
              </p>
            </div>

            <div className="space-y-3 border-t border-[var(--border)] pt-4">
              <div>
                <p className="text-sm font-semibold text-[var(--text-primary)]">가격 구간 (선택 입력)</p>
                <p className="mt-1 text-xs leading-relaxed text-[var(--text-muted)]">
                  비수기/주말/성수기 대표 가격만 입력하세요. 모든 날짜를 입력할 필요는 없습니다. 정확한 가격은
                  상담을 통해 안내됩니다.
                </p>
              </div>
              <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
                <div className="space-y-1">
                  <label htmlFor="field-seasonal-off" className="block text-xs font-medium text-[var(--text-secondary)]">
                    비수기
                  </label>
                  <input
                    id="field-seasonal-off"
                    value={form.seasonal_price_bands.offSeason}
                    onChange={(e) =>
                      setForm((prev) => ({
                        ...prev,
                        seasonal_price_bands: {
                          ...prev.seasonal_price_bands,
                          offSeason: formatPriceWithCommas(e.target.value),
                        },
                      }))
                    }
                    placeholder="예: 789000"
                    inputMode="numeric"
                    autoComplete="off"
                    className="w-full rounded-lg border border-[var(--border)] bg-[var(--surface-muted)] px-3 py-2 text-sm text-[var(--text-primary)] outline-none focus:border-[var(--primary)] focus:ring-2 focus:ring-[var(--primary-soft)]"
                  />
                </div>
                <div className="space-y-1">
                  <label
                    htmlFor="field-seasonal-weekend"
                    className="block text-xs font-medium text-[var(--text-secondary)]"
                  >
                    주말
                  </label>
                  <input
                    id="field-seasonal-weekend"
                    value={form.seasonal_price_bands.weekend}
                    onChange={(e) =>
                      setForm((prev) => ({
                        ...prev,
                        seasonal_price_bands: {
                          ...prev.seasonal_price_bands,
                          weekend: formatPriceWithCommas(e.target.value),
                        },
                      }))
                    }
                    placeholder="예: 999000"
                    inputMode="numeric"
                    autoComplete="off"
                    className="w-full rounded-lg border border-[var(--border)] bg-[var(--surface-muted)] px-3 py-2 text-sm text-[var(--text-primary)] outline-none focus:border-[var(--primary)] focus:ring-2 focus:ring-[var(--primary-soft)]"
                  />
                </div>
                <div className="space-y-1">
                  <label htmlFor="field-seasonal-peak" className="block text-xs font-medium text-[var(--text-secondary)]">
                    성수기
                  </label>
                  <input
                    id="field-seasonal-peak"
                    value={form.seasonal_price_bands.peakSeason}
                    onChange={(e) =>
                      setForm((prev) => ({
                        ...prev,
                        seasonal_price_bands: {
                          ...prev.seasonal_price_bands,
                          peakSeason: formatPriceWithCommas(e.target.value),
                        },
                      }))
                    }
                    placeholder="예: 1299000"
                    inputMode="numeric"
                    autoComplete="off"
                    className="w-full rounded-lg border border-[var(--border)] bg-[var(--surface-muted)] px-3 py-2 text-sm text-[var(--text-primary)] outline-none focus:border-[var(--primary)] focus:ring-2 focus:ring-[var(--primary-soft)]"
                  />
                </div>
              </div>
              <p className="text-xs text-[var(--text-muted)]">
                입력하지 않으면 기본 가격만 노출됩니다. 비우고 저장하면 구간 데이터는 DB에서 제거(null)됩니다.
              </p>
            </div>
          </div>

            <div className="space-y-3 rounded-xl border border-[var(--border)] bg-[var(--surface-muted)] p-4">
              <p className="text-xs font-semibold text-[var(--text-primary)]">여행 오버뷰 카드 (숙소·지역·기간)</p>
              <p className="text-xs text-[var(--text-muted)]">
                상세 페이지 첫 화면에 표시되는 카드 값입니다. 비우면 기존 자동 추출(meta_info, theme, duration)을 사용합니다.
              </p>
              <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap">
                <div className="space-y-1 min-w-0 flex-1">
                  <label className="block text-xs font-medium text-[var(--text-secondary)]">숙소</label>
                  <input
                    value={form.overview_accommodation}
                    onChange={(e) =>
                      setForm((prev) => ({ ...prev, overview_accommodation: e.target.value }))
                    }
                    placeholder="예: 상담 시 안내, 전일정4성"
                    className="w-full rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm text-[var(--text-primary)] outline-none focus:border-[var(--primary)] focus:ring-2 focus:ring-[var(--primary-soft)]"
                  />
                </div>
                <div className="space-y-1 min-w-0 flex-1">
                  <label className="block text-xs font-medium text-[var(--text-secondary)]">지역</label>
                  <input
                    value={form.overview_region}
                    onChange={(e) =>
                      setForm((prev) => ({ ...prev, overview_region: e.target.value }))
                    }
                    placeholder="예: 호주, 동남아"
                    className="w-full rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm text-[var(--text-primary)] outline-none focus:border-[var(--primary)] focus:ring-2 focus:ring-[var(--primary-soft)]"
                  />
                </div>
                <div className="space-y-1 min-w-0 flex-1">
                  <label className="block text-xs font-medium text-[var(--text-secondary)]">기간</label>
                  <input
                    value={form.overview_duration}
                    onChange={(e) =>
                      setForm((prev) => ({ ...prev, overview_duration: e.target.value }))
                    }
                    placeholder="예: 6일, 3박4일"
                    className="w-full rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm text-[var(--text-primary)] outline-none focus:border-[var(--primary)] focus:ring-2 focus:ring-[var(--primary-soft)]"
                  />
                </div>
              </div>
            </div>
          <div className="space-y-2 md:col-span-2">
            <p className="text-xs font-semibold text-[var(--text-secondary)]">일정 테마 구성비 (상세 오버뷰 차트)</p>
            <p className="text-xs text-[var(--text-muted)]">
              2개 이상 입력 시 상세 페이지에 도넛 차트로 표시됩니다. 미입력 시 카테고리·테마 기반으로 자동 생성됩니다.
            </p>
            <div className="space-y-2">
              {form.theme_chart_json.map((item, idx) => (
                <div
                  key={idx}
                  className="space-y-2 rounded-lg border border-[var(--border)] bg-[var(--surface-muted)] p-2"
                >
                  <input
                    type="text"
                    value={item.label}
                    onChange={(e) =>
                      setForm((prev) => ({
                        ...prev,
                        theme_chart_json: prev.theme_chart_json.map((x, i) =>
                          i === idx ? { ...x, label: e.target.value } : x,
                        ),
                      }))
                    }
                    placeholder="항목명 (예: 자연)"
                    className="flex-1 min-w-[80px] rounded border border-[var(--border)] px-2 py-1.5 text-sm outline-none focus:border-[var(--primary)]"
                  />
                  <input
                    type="number"
                    min={0}
                    max={100}
                    value={item.percent}
                    onChange={(e) => {
                      const v = parseInt(e.target.value, 10);
                      if (!Number.isNaN(v))
                        setForm((prev) => ({
                          ...prev,
                          theme_chart_json: prev.theme_chart_json.map((x, i) =>
                            i === idx ? { ...x, percent: Math.max(0, Math.min(100, v)) } : x,
                          ),
                        }));
                    }}
                    placeholder="%"
                    className="w-16 rounded border border-[var(--border)] px-2 py-1.5 text-sm outline-none focus:border-[var(--primary)]"
                  />
                  <span className="text-xs text-[var(--text-muted)]">%</span>
                  <button
                    type="button"
                    onClick={() =>
                      setForm((prev) => ({
                        ...prev,
                        theme_chart_json: prev.theme_chart_json.filter((_, i) => i !== idx),
                      }))
                    }
                    className="rounded border border-[var(--border)] bg-[var(--surface)] px-2 py-1 text-xs text-[var(--text-secondary)] hover:bg-[var(--surface-muted)]"
                  >
                    삭제
                  </button>
                </div>
              ))}
              <button
                type="button"
                onClick={() =>
                  setForm((prev) => ({
                    ...prev,
                    theme_chart_json: [...prev.theme_chart_json, { label: "", percent: 0 }],
                  }))
                }
                className="rounded-lg border border-dashed border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-xs font-medium text-[var(--text-secondary)] hover:bg-[var(--surface-muted)]"
              >
                + 항목 추가
              </button>
            </div>
          </div>
          <div className="space-y-2">
            <p className="text-xs font-semibold text-[var(--text-secondary)]">상품 상태 (카드/상세 태그)</p>
            <div className="flex flex-wrap gap-2">
              {[
                { value: "AVAILABLE", label: "예약 가능" },
                { value: "LIMITED", label: "잔여 한정" },
                { value: "SOLD_OUT", label: "마감" },
                { value: "CONSULT_REQUIRED", label: "상담 후 안내" },
              ].map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() =>
                    setForm((prev) => ({ ...prev, status: opt.value as ProductFormState["status"] }))
                  }
                  className={`rounded-full px-3 py-1.5 text-xs font-semibold transition ${
                    form.status === opt.value
                      ? "bg-[var(--primary)] text-[var(--on-primary)]"
                      : "border border-[var(--border)] bg-[var(--surface)] text-[var(--text-secondary)] hover:bg-[var(--surface-muted)]"
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>
          <div className="space-y-1 md:col-span-2" id="field-product-cover-image" tabIndex={0}>
            <div className="mb-3 rounded-lg border border-[var(--border)] bg-[var(--surface-muted)] p-3">
              <p className="mb-2 text-xs font-semibold text-[var(--text-secondary)]">대표 이미지</p>
              {form.image_url?.trim() || form.images_json.length > 0 ? (
                <div className="flex flex-wrap items-center gap-3">
                  <div className="relative h-14 w-20 shrink-0 overflow-hidden rounded border-2 border-[var(--primary)] bg-[var(--surface-muted)]">
                    <img
                      src={normalizeProductImageUrl(form.image_url?.trim() || form.images_json[0] || "")}
                      alt="대표"
                      className="h-full w-full object-cover"
                    />
                  </div>
                  <div>
                    <p className="text-xs text-[var(--text-primary)]">
                      현재 대표: {form.image_url?.trim() ? "지정됨" : "첫 번째 이미지"}
                    </p>
                    <button
                      type="button"
                      onClick={openCoverRecommendModal}
                      className="mt-1 rounded border border-[var(--primary)]/50 bg-[var(--primary-soft)] px-2 py-1 text-xs font-medium text-[var(--primary)] hover:bg-[var(--primary-soft)]/80"
                    >
                      대표 이미지 추천 보기
                    </button>
                  </div>
                </div>
              ) : (
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-xs text-[var(--text-muted)]">대표 이미지 미지정</span>
                  <button
                    type="button"
                    onClick={openCoverRecommendModal}
                    className="rounded border border-[var(--primary)]/50 bg-[var(--primary-soft)] px-2 py-1 text-xs font-medium text-[var(--primary)] hover:bg-[var(--primary-soft)]/80"
                  >
                    대표 이미지 추천 보기
                  </button>
                </div>
              )}
            </div>
            <p className="text-xs font-semibold text-[var(--text-primary)]">상품 이미지 (여러 장)</p>
            <MultiImageUploadField
              value={form.images_json}
              primaryImageUrl={form.image_url?.trim() || form.images_json[0] || undefined}
              onChange={(urls) =>
                setForm((prev) => ({
                  ...prev,
                  images_json: urls,
                  image_url: prev.image_url?.trim() || (urls[0] ?? ""),
                }))
              }
              selectedEvent={selectedEvent}
              onAddToEvent={(url) => {
                const added = addProductImageToSelectedEvent(url);
                if (added) showToast("success", "이벤트에 이미지 추가됨");
                else if (selectedEvent) showToast("warning", "이미 해당 이벤트에 등록된 이미지입니다.");
              }}
            />
            <div className="flex flex-wrap items-center gap-2">
              <label className="cursor-pointer rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm font-medium text-[var(--text-secondary)] transition hover:bg-[var(--surface-muted)]">
                미리보기용 이미지 파일 선택
                <input
                  type="file"
                  accept="image/*"
                  className="sr-only"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    setPreviewImageFile(file ?? null);
                  }}
                />
              </label>
              {previewImageFile && (
                <span className="text-xs text-[var(--text-secondary)]">
                  {previewImageFile.name}
                  <button
                    type="button"
                    onClick={() => setPreviewImageFile(null)}
                    className="ml-1 text-[var(--danger)] hover:underline"
                  >
                    해제
                  </button>
                </span>
              )}
            </div>
          </div>
          <div className="space-y-1 md:col-span-2">
            <p className="text-xs font-semibold text-[var(--success)]">관리자 전용 | 상품 원본주소</p>
            <div className="flex flex-wrap items-center gap-2">
              <input
                value={form.product_source_url}
                onChange={(event) => setForm((prev) => ({ ...prev, product_source_url: event.target.value }))}
                placeholder="상품 원본주소 (관리자 확인용 URL)"
                className="min-w-0 flex-1 rounded-lg border border-[var(--success)]/30 bg-[var(--success-bg)]/40 px-3 py-2 text-sm outline-none focus:border-[var(--primary)] focus:ring-2 focus:ring-[var(--primary-soft)]"
              />
              <button
                type="button"
                onClick={async () => {
                  try {
                    await navigator.clipboard.writeText(BOOKMARKLET_EXTRACT_IMAGE_URLS);
                    showToast("success", "북마클릿이 복사되었습니다. 사용법은 [!] 버튼을 참고하세요.");
                  } catch {
                    showToast("error", "클립보드 복사에 실패했습니다. 브라우저 권한을 확인해 주세요.");
                  }
                }}
                className="shrink-0 rounded-lg border border-[var(--primary)]/50 bg-[var(--primary-soft)] px-3 py-2 text-sm font-medium text-[var(--primary)] hover:bg-[var(--primary-soft)]/80"
              >
                이미지 추출 도구
              </button>
              <button
                type="button"
                onClick={() => setShowImageImportGuideModal(true)}
                className="shrink-0 rounded-lg border border-[var(--border)] bg-[var(--surface)] px-2.5 py-2 text-xs font-semibold text-[var(--text-secondary)] hover:bg-[var(--surface-muted)]"
                title="이미지 자동 등록 사용법"
              >
                [!]
              </button>
            </div>
            <p className="text-[11px] text-[var(--text-muted)]">
              1) 버튼 눌러 북마클릿 복사 → 2) 브라우저 북마크 URL에 붙여넣기 → 3) 모두투어 등 원본 페이지에서 북마클릿 실행 → URL 복사됨 → 4) 아래 상품 이미지 또는 이벤트 이미지 입력란에 붙여넣기
            </p>
          </div>
                  </div>
  );
}
