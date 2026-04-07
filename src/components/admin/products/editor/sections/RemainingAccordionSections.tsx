"use client";

import { useState, type Dispatch, type SetStateAction } from "react";
import type { ProductFormState, TermsTemplateType } from "@/types/adminProductForm";
import type { ProductTaxonomyWithUsage } from "@/types/productTaxonomy";
import type { RegionTreeNode } from "@/types/productTaxonomy";
import { AirlineLogo } from "@/components/airlines/AirlineLogo";
import { HintDisclosure } from "@/components/admin/common/HintDisclosure";
import { TERMS_TEMPLATE_OPTIONS } from "@/components/admin/products/editor/adminProductTerms.options";
import {
  INCLUDED_TEMPLATES,
  TERMS_TEMPLATES,
  DESCRIPTION_TEMPLATES,
} from "@/components/admin/products/editor/adminProductTemplates";
import { useTemplateInsert } from "@/components/admin/products/editor/hooks/useTemplateInsert";
import type { NoticeTemplateGroup, NoticeTemplatesByGroup } from "@/lib/noticeTemplates";

export type RemainingAccordionSectionsProps = {
  sectionId: "taxonomy" | "price" | "description" | "included" | "flight" | "terms";
  form: ProductFormState;
  setForm: Dispatch<SetStateAction<ProductFormState>>;
  destinationTree: RegionTreeNode[];
  destinationPath: RegionTreeNode[];
  selectedLevel1Id: string;
  setSelectedLevel1Id: Dispatch<SetStateAction<string>>;
  selectedLevel2Id: string;
  setSelectedLevel2Id: Dispatch<SetStateAction<string>>;
  themeTree: RegionTreeNode[];
  themePath: RegionTreeNode[];
  selectedThemeLevel1Id: string;
  setSelectedThemeLevel1Id: Dispatch<SetStateAction<string>>;
  selectedThemeLevel2Id: string;
  setSelectedThemeLevel2Id: Dispatch<SetStateAction<string>>;
  activeProductLineOptions: ProductTaxonomyWithUsage[];
  activeCampaignOptions: ProductTaxonomyWithUsage[];
  selectedCampaigns: string[];
  toggleCampaign: (name: string) => void;
  noticeTemplatesByGroup: NoticeTemplatesByGroup;
  setNoticeTemplatesByGroup: Dispatch<SetStateAction<NoticeTemplatesByGroup>>;
  isTermsTemplatesPanelOpen: boolean;
  setIsTermsTemplatesPanelOpen: Dispatch<SetStateAction<boolean>>;
  saveNoticeTemplates: () => Promise<void>;
  isTermsTemplatesLoading: boolean;
  isTermsTemplatesSaving: boolean;
  termsTemplatesErrorMessage: string;
};


export function RemainingAccordionSections(props: RemainingAccordionSectionsProps) {
  const {
    sectionId,
    form,
    setForm,
    destinationTree,
    destinationPath,
    selectedLevel1Id,
    setSelectedLevel1Id,
    selectedLevel2Id,
    setSelectedLevel2Id,
    themeTree,
    themePath,
    selectedThemeLevel1Id,
    setSelectedThemeLevel1Id,
    selectedThemeLevel2Id,
    setSelectedThemeLevel2Id,
    activeProductLineOptions,
    activeCampaignOptions,
    selectedCampaigns,
    toggleCampaign,
    noticeTemplatesByGroup,
    setNoticeTemplatesByGroup,
    isTermsTemplatesPanelOpen,
    setIsTermsTemplatesPanelOpen,
    saveNoticeTemplates,
    isTermsTemplatesLoading,
    isTermsTemplatesSaving,
    termsTemplatesErrorMessage,
  } = props;

  const { insertText, insertIncludedTemplate } = useTemplateInsert(setForm);
  const [includedTemplateSelect, setIncludedTemplateSelect] = useState("");
  const [termsSnippetSelect, setTermsSnippetSelect] = useState("");
  const [travelTermsSnippetSelect, setTravelTermsSnippetSelect] = useState("");
  const [conditionTermsSnippetSelect, setConditionTermsSnippetSelect] = useState("");
  const [refundTermsSnippetSelect, setRefundTermsSnippetSelect] = useState("");
  const [descriptionSnippetSelect, setDescriptionSnippetSelect] = useState("");

  const termsPreview = (group: NoticeTemplateGroup, type: "" | TermsTemplateType) =>
    type ? (noticeTemplatesByGroup[group][type]?.trim() ?? "") : "";

  switch (sectionId) {
    case "taxonomy":
      return (
        <div className="flex flex-col gap-6" id="form-field-taxonomy-category">
          <div className="space-y-2">
            <p className="text-xs font-semibold text-[var(--text-primary)]">지역 (destination)</p>
            <p className="text-[11px] text-[var(--text-muted)]">상품에 연결할 지역 1개. 대분류 → 중분류 → 소분류 순으로 선택합니다. DB taxonomy 축으로 저장됩니다.</p>
            <div className="space-y-4">
              {destinationTree.length === 0 ? (
                <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-[var(--text-muted)] ring-1 ring-slate-200">
                  지역을 먼저 추가해 주세요 (카테고리/테마 관리에서 추가)
                </span>
              ) : (
                <>
                  {/* 대분류 */}
                  <div className="space-y-1.5">
                    <span className="text-xs font-semibold text-[var(--text-muted)]">대분류</span>
                    <div className="flex flex-wrap gap-2">
                      <button
                        type="button"
                        onClick={() => {
                          setForm((prev) => ({ ...prev, destination_id: "", category: "" }));
                          setSelectedLevel1Id("");
                          setSelectedLevel2Id("");
                        }}
                        className={`rounded-full px-3 py-1 text-xs font-semibold transition ${
                          !form.destination_id && !selectedLevel1Id
                            ? "bg-amber-100 text-amber-800 ring-1 ring-amber-300"
                            : "bg-[var(--surface)] text-[var(--text-secondary)] ring-1 ring-[var(--border)] hover:bg-[var(--surface-muted)]"
                        }`}
                      >
                        미선택
                      </button>
                      {destinationTree.map((node) => {
                        const selected = (destinationPath[0]?.id === node.id) || (!form.destination_id && selectedLevel1Id === node.id);
                        const hasChildren = node.children && node.children.length > 0;
                        return (
                          <button
                            key={node.id}
                            type="button"
                            onClick={() => {
                              if (hasChildren) {
                                setSelectedLevel1Id(node.id);
                                setSelectedLevel2Id("");
                                setForm((prev) => ({ ...prev, destination_id: "", category: "" }));
                              } else {
                                setSelectedLevel1Id("");
                                setSelectedLevel2Id("");
                                setForm((prev) => ({ ...prev, destination_id: node.id, category: node.name }));
                              }
                            }}
                            className={`rounded-full px-3 py-1 text-xs font-semibold transition ${
                              selected && !form.destination_id
                                ? "bg-amber-100 text-amber-800 ring-1 ring-amber-300"
                                : destinationPath[0]?.id === node.id
                                  ? "bg-amber-50 text-amber-700 ring-1 ring-amber-200"
                                  : "bg-[var(--surface)] text-[var(--text-secondary)] ring-1 ring-[var(--border)] hover:bg-[var(--surface-muted)]"
                            }`}
                          >
                            {node.name}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                  {/* 중분류 (대분류 선택 시에만) */}
                  {(() => {
                    const level1Node = destinationPath[0] ?? destinationTree.find((n) => n.id === selectedLevel1Id);
                    const showMid = level1Node && (level1Node.children?.length ?? 0) > 0;
                    if (!showMid) return null;
                    const midChildren = level1Node.children ?? [];
                    return (
                      <div className="space-y-1.5">
                        <span className="text-xs font-semibold text-[var(--text-muted)]">중분류</span>
                        <div className="flex flex-wrap gap-2">
                          {midChildren.map((node) => {
                            const selected = (destinationPath[1]?.id === node.id) || (!form.destination_id && selectedLevel2Id === node.id);
                            const hasChildren = node.children && node.children.length > 0;
                            return (
                              <button
                                key={node.id}
                                type="button"
                                onClick={() => {
                                  if (hasChildren) {
                                    setSelectedLevel2Id(node.id);
                                    setForm((prev) => ({ ...prev, destination_id: "", category: "" }));
                                  } else {
                                    setSelectedLevel1Id("");
                                    setSelectedLevel2Id("");
                                    setForm((prev) => ({ ...prev, destination_id: node.id, category: node.name }));
                                  }
                                }}
                                className={`rounded-full px-3 py-1 text-xs font-semibold transition ${
                                  selected && !form.destination_id
                                    ? "bg-amber-100 text-amber-800 ring-1 ring-amber-300"
                                    : destinationPath[1]?.id === node.id
                                      ? "bg-amber-50 text-amber-700 ring-1 ring-amber-200"
                                      : "bg-[var(--surface)] text-[var(--text-secondary)] ring-1 ring-[var(--border)] hover:bg-[var(--surface-muted)]"
                                }`}
                              >
                                {node.name}
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })()}
                  {/* 소분류 (중분류 선택 시에만) */}
                  {(() => {
                    const level1Node = destinationPath[0] ?? destinationTree.find((n) => n.id === selectedLevel1Id);
                    const level2Node = destinationPath[1] ?? (level1Node?.children?.find((n) => n.id === selectedLevel2Id));
                    const showSmall = level2Node && (level2Node.children?.length ?? 0) > 0;
                    if (!showSmall) return null;
                    const smallChildren = level2Node.children ?? [];
                    return (
                      <div className="space-y-1.5">
                        <span className="text-xs font-semibold text-[var(--text-muted)]">소분류</span>
                        <div className="flex flex-wrap gap-2">
                          {smallChildren.map((node) => {
                            const selected = form.destination_id === node.id;
                            return (
                              <button
                                key={node.id}
                                type="button"
                                onClick={() => {
                                  setSelectedLevel1Id("");
                                  setSelectedLevel2Id("");
                                  setForm((prev) => ({ ...prev, destination_id: node.id, category: node.name }));
                                }}
                                className={`rounded-full px-3 py-1 text-xs font-semibold transition ${
                                  selected
                                    ? "bg-amber-100 text-amber-800 ring-1 ring-amber-300"
                                    : "bg-[var(--surface)] text-[var(--text-secondary)] ring-1 ring-[var(--border)] hover:bg-[var(--surface-muted)]"
                                }`}
                              >
                                {node.name}
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })()}
                </>
              )}
            </div>
          </div>
          <div className="space-y-2" id="form-field-taxonomy-theme">
            <p className="text-xs font-semibold text-[var(--text-primary)]">테마</p>
            <p className="text-[11px] text-[var(--text-muted)]">대분류 → 중분류 순으로 선택합니다. 1개 선택.</p>
            <div className="space-y-4">
              {themeTree.length === 0 ? (
                <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-[var(--text-muted)] ring-1 ring-slate-200">
                  테마를 먼저 추가해 주세요 (카테고리/테마 관리에서 추가)
                </span>
              ) : (
                <>
                  <div className="space-y-1.5">
                    <span className="text-xs font-semibold text-[var(--text-muted)]">대분류</span>
                    <div className="flex flex-wrap gap-2">
                      <button
                        type="button"
                        onClick={() => {
                          setForm((prev) => ({ ...prev, theme: "" }));
                          setSelectedThemeLevel1Id("");
                          setSelectedThemeLevel2Id("");
                        }}
                        className={`rounded-full px-3 py-1 text-xs font-semibold transition ${
                          !form.theme.trim() && !selectedThemeLevel1Id
                            ? "bg-amber-100 text-amber-800 ring-1 ring-amber-300"
                            : "bg-[var(--surface)] text-[var(--text-secondary)] ring-1 ring-[var(--border)] hover:bg-[var(--surface-muted)]"
                        }`}
                      >
                        미선택
                      </button>
                      {themeTree.map((node) => {
                        const selected = (themePath[0]?.id === node.id) || (!form.theme.trim() && selectedThemeLevel1Id === node.id);
                        const hasChildren = node.children && node.children.length > 0;
                        return (
                          <button
                            key={node.id}
                            type="button"
                            onClick={() => {
                              if (hasChildren) {
                                setSelectedThemeLevel1Id(node.id);
                                setSelectedThemeLevel2Id("");
                                setForm((prev) => ({ ...prev, theme: "" }));
                              } else {
                                setSelectedThemeLevel1Id("");
                                setSelectedThemeLevel2Id("");
                                setForm((prev) => ({ ...prev, theme: node.name }));
                              }
                            }}
                            className={`rounded-full px-3 py-1 text-xs font-semibold transition ${
                              selected && !form.theme.trim()
                                ? "bg-amber-100 text-amber-800 ring-1 ring-amber-300"
                                : themePath[0]?.id === node.id
                                  ? "bg-amber-50 text-amber-700 ring-1 ring-amber-200"
                                  : "bg-[var(--surface)] text-[var(--text-secondary)] ring-1 ring-[var(--border)] hover:bg-[var(--surface-muted)]"
                            }`}
                          >
                            {node.name}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                  {(() => {
                    const level1Node = themePath[0] ?? themeTree.find((n) => n.id === selectedThemeLevel1Id);
                    const showMid = level1Node && (level1Node.children?.length ?? 0) > 0;
                    if (!showMid) return null;
                    const midChildren = level1Node.children ?? [];
                    return (
                      <div className="space-y-1.5">
                        <span className="text-xs font-semibold text-[var(--text-muted)]">중분류</span>
                        <div className="flex flex-wrap gap-2">
                          {midChildren.map((node) => {
                            const selected = (themePath[1]?.id === node.id) || (!form.theme.trim() && selectedThemeLevel2Id === node.id);
                            const hasChildren = node.children && node.children.length > 0;
                            return (
                              <button
                                key={node.id}
                                type="button"
                                onClick={() => {
                                  if (hasChildren) {
                                    setSelectedThemeLevel2Id(node.id);
                                    setForm((prev) => ({ ...prev, theme: "" }));
                                  } else {
                                    setSelectedThemeLevel1Id("");
                                    setSelectedThemeLevel2Id("");
                                    setForm((prev) => ({ ...prev, theme: node.name }));
                                  }
                                }}
                                className={`rounded-full px-3 py-1 text-xs font-semibold transition ${
                                  selected && !form.theme.trim()
                                    ? "bg-amber-100 text-amber-800 ring-1 ring-amber-300"
                                    : themePath[1]?.id === node.id
                                      ? "bg-amber-50 text-amber-700 ring-1 ring-amber-200"
                                      : "bg-[var(--surface)] text-[var(--text-secondary)] ring-1 ring-[var(--border)] hover:bg-[var(--surface-muted)]"
                                }`}
                              >
                                {node.name}
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })()}
                  {(() => {
                    const level1Node = themePath[0] ?? themeTree.find((n) => n.id === selectedThemeLevel1Id);
                    const level2Node = themePath[1] ?? (level1Node?.children?.find((n) => n.id === selectedThemeLevel2Id));
                    const showSmall = level2Node && (level2Node.children?.length ?? 0) > 0;
                    if (!showSmall) return null;
                    const smallChildren = level2Node.children ?? [];
                    return (
                      <div className="space-y-1.5">
                        <span className="text-xs font-semibold text-[var(--text-muted)]">소분류</span>
                        <div className="flex flex-wrap gap-2">
                          {smallChildren.map((node) => {
                            const selected = form.theme.trim() === node.name;
                            return (
                              <button
                                key={node.id}
                                type="button"
                                onClick={() => {
                                  setSelectedThemeLevel1Id("");
                                  setSelectedThemeLevel2Id("");
                                  setForm((prev) => ({ ...prev, theme: node.name }));
                                }}
                                className={`rounded-full px-3 py-1 text-xs font-semibold transition ${
                                  selected
                                    ? "bg-amber-100 text-amber-800 ring-1 ring-amber-300"
                                    : "bg-[var(--surface)] text-[var(--text-secondary)] ring-1 ring-[var(--border)] hover:bg-[var(--surface-muted)]"
                                }`}
                              >
                                {node.name}
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })()}
                  <p className="text-xs text-[var(--text-muted)]">선택된 테마: {form.theme.trim() || "-"}</p>
                </>
              )}
            </div>
          </div>
          <div className="space-y-2">
            <p className="text-xs font-semibold text-[var(--text-primary)]">상품군</p>
            <div className="flex flex-wrap gap-2">
              {activeProductLineOptions.length === 0 ? (
                <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-[var(--text-muted)] ring-1 ring-slate-200">
                  상품군을 먼저 추가해 주세요 (지역·테마 관리)
                </span>
              ) : (
                <>
                  <button
                    type="button"
                    onClick={() => setForm((prev) => ({ ...prev, product_line_id: "" }))}
                    className={`rounded-full px-3 py-1 text-xs font-semibold transition ${
                      !form.product_line_id
                        ? "bg-amber-100 text-amber-800 ring-1 ring-amber-300"
                        : "bg-[var(--surface)] text-[var(--text-secondary)] ring-1 ring-[var(--border)] hover:bg-[var(--surface-muted)]"
                    }`}
                  >
                    미선택
                  </button>
                  {activeProductLineOptions.map((item) => {
                    const selected = form.product_line_id === item.id;
                    return (
                      <button
                        key={item.id}
                        type="button"
                        onClick={() => setForm((prev) => ({ ...prev, product_line_id: item.id }))}
                        className={`rounded-full px-3 py-1 text-xs font-semibold transition ${
                          selected
                            ? "bg-amber-100 text-amber-800 ring-1 ring-amber-300"
                            : "bg-[var(--surface)] text-[var(--text-secondary)] ring-1 ring-[var(--border)] hover:bg-[var(--surface-muted)]"
                        }`}
                      >
                        {item.name}
                      </button>
                    );
                  })}
                </>
              )}
            </div>
          </div>
          <div className="space-y-2">
            <p className="text-xs font-semibold text-[var(--text-primary)]">기획/추천</p>
            <div className="flex flex-wrap gap-2">
              {activeCampaignOptions.length === 0 ? (
                <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-[var(--text-muted)] ring-1 ring-slate-200">
                  기획 항목을 먼저 추가해 주세요 (지역·테마 관리)
                </span>
              ) : (
                activeCampaignOptions.map((item) => {
                  const selected = selectedCampaigns.includes(item.name);
                  return (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => toggleCampaign(item.name)}
                      className={`rounded-full px-3 py-1 text-xs font-semibold transition ${
                        selected
                          ? "bg-amber-100 text-amber-800 ring-1 ring-amber-300"
                          : "bg-[var(--surface)] text-[var(--text-secondary)] ring-1 ring-[var(--border)] hover:bg-[var(--surface-muted)]"
                      }`}
                    >
                      {item.name}
                    </button>
                  );
                })
              )}
            </div>
            <p className="text-xs text-[var(--text-muted)]">선택된 기획/추천: {selectedCampaigns.join(", ") || "-"}</p>
          </div>
          <div className="rounded-lg border border-blue-100 bg-blue-50/60 px-3 py-2">
            <p className="text-xs font-medium text-blue-900">여행 오버뷰 품질 가이드</p>
            <p className="mt-0.5 text-xs text-blue-800">
              지역·테마는 상세 첫 화면의 여행 오버뷰 &quot;지역&quot; 카드에 반영됩니다. 대표 이미지는 오버뷰 커버로 사용됩니다.
            </p>
          </div>
        </div>
      );
    case "price":
      return (
        <div className="flex flex-col space-y-3 md:space-y-0 md:grid md:grid-cols-2 md:gap-3">
          <p className="text-xs text-[var(--text-muted)] md:col-span-2">
            기본 가격·가격 구간(비수기·주말·성수기)은 <strong className="text-[var(--text-secondary)]">기본 정보</strong> 섹션에서
            입력합니다.
          </p>
          <input
            value={form.duration}
            onChange={(event) => setForm((prev) => ({ ...prev, duration: event.target.value }))}
            placeholder="일정(예: 5일)"
            className="rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm text-[var(--text-primary)] outline-none focus:border-[var(--primary)] focus:ring-2 focus:ring-[var(--primary-soft)]"
          />
          <p className="text-xs text-[var(--text-muted)] md:col-span-2">일정 값은 여행 오버뷰 &quot;기간&quot; 카드에 반영됩니다.</p>
          <div className="space-y-1">
            <label className="block text-xs font-semibold text-[var(--text-secondary)]">가격 기준 문구</label>
            <input
              value={form.price_meta}
              onChange={(event) => setForm((prev) => ({ ...prev, price_meta: event.target.value }))}
              placeholder="예: 1인 기준 (비우면 기본값 1인 기준)"
              className="w-full rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm text-[var(--text-primary)] outline-none focus:border-[var(--primary)] focus:ring-2 focus:ring-[var(--primary-soft)]"
            />
          </div>
          <div className="space-y-2">
            <p className="text-xs font-semibold text-[var(--text-secondary)]">유류할증료 문구</p>
            <div className="flex flex-wrap gap-2">
              {[
                { value: "", label: "표시 안 함" },
                { value: "true", label: "유류할증료 포함" },
                { value: "false", label: "유류할증료 별도" },
              ].map((opt) => (
                <button
                  key={opt.value || "none"}
                  type="button"
                  onClick={() =>
                    setForm((prev) => ({ ...prev, fuel_included: opt.value as "" | "true" | "false" }))
                  }
                  className={`rounded-full px-3 py-1.5 text-xs font-semibold transition ${
                    form.fuel_included === opt.value
                      ? "bg-[var(--primary)] text-[var(--on-primary)]"
                      : "border border-[var(--border)] bg-[var(--surface)] text-[var(--text-secondary)] hover:bg-[var(--surface-muted)]"
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>
          <div className="md:col-span-2">
            <label className="mb-1 block text-xs font-semibold text-[var(--text-secondary)]">카드 메타 문구 (일정·지역 옆 표시)</label>
            <input
              value={form.meta_info}
              onChange={(event) => setForm((prev) => ({ ...prev, meta_info: event.target.value }))}
              placeholder="예: 항공 포함"
              className="w-full rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm text-[var(--text-primary)] outline-none focus:border-[var(--primary)] focus:ring-2 focus:ring-[var(--primary-soft)]"
            />
            <p className="mt-1 text-xs text-[var(--text-muted)]">
              이 값은 상세 첫 화면 여행 오버뷰의 &quot;숙소&quot;·&quot;기타&quot; 카드에 반영될 수 있습니다. (예: 전일정4성, 호텔 등)
            </p>
          </div>
          <div className="space-y-2 rounded-lg border border-[var(--border)] bg-[var(--primary-soft)] p-3 md:col-span-2">
            <p className="text-sm font-semibold text-[var(--primary)]">상품 옵션 (기간·룸 등 선택 시 견적)</p>
            <HintDisclosure
              id="price.optionsJsonGuide"
              summary="가격 옵션 JSON 형식 보기"
            >
              {`JSON 형식. 비우면 옵션 미사용.
필수 필드: basePrice, currency, groups 배열.
선택: requiredGroups (필수 선택 그룹 키 배열).

예시:
{"basePrice": 1000000, "currency": "KRW", "requiredGroups": ["period"], "groups": [{"key": "period", "title": "기간", "type": "radio", "items": [{"value": "3n4d", "label": "3박4일", "priceDelta": 0, "isDefault": true}, {"value": "4n5d", "label": "4박5일", "priceDelta": 200000}]}]}`}
            </HintDisclosure>
            <textarea
              value={form.options_json}
              onChange={(event) => setForm((prev) => ({ ...prev, options_json: event.target.value }))}
              rows={8}
              placeholder='{"basePrice": 1000000, "currency": "KRW", "requiredGroups": ["period"], "groups": [{"key": "period", "title": "기간", "type": "radio", "items": [{"value": "3n4d", "label": "3박4일", "priceDelta": 0, "isDefault": true}, {"value": "4n5d", "label": "4박5일", "priceDelta": 200000}]}]}'
              className="w-full rounded-lg border border-[var(--border)] px-3 py-2 font-mono text-xs outline-none focus:border-[var(--primary)] focus:ring-2 focus:ring-[var(--primary-soft)]"
            />
          </div>
                  </div>
      );
    case "description":
      return (
        <div className="flex flex-col space-y-3 md:space-y-0 md:grid md:grid-cols-2 md:gap-3">
          <textarea
            value={form.description}
            onChange={(event) => setForm((prev) => ({ ...prev, description: event.target.value }))}
            required
            rows={4}
            placeholder="상품 설명 (필요 시 직접 작성. 모두투어 import는 자동 반영하지 않습니다.)"
            id="field-product-description"
            className="rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm text-[var(--text-primary)] outline-none focus:border-[var(--primary)] focus:ring-2 focus:ring-[var(--primary-soft)] md:col-span-2"
          />
          <textarea
            value={form.point_benefits}
            onChange={(event) => setForm((prev) => ({ ...prev, point_benefits: event.target.value }))}
            rows={3}
            placeholder="상품 포인트 - 혜택 (줄바꿈 가능)"
            className="rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm text-[var(--text-primary)] outline-none focus:border-[var(--primary)] focus:ring-2 focus:ring-[var(--primary-soft)]"
          />
          <div className="rounded-lg border border-[var(--border)] bg-[var(--surface)]/80 p-3 md:col-span-2">
            <p className="mb-3 text-sm font-semibold text-[var(--text-primary)]">상품 포인트 O/X 선택</p>
            <div className="flex flex-col space-y-3 md:space-y-0 md:grid md:grid-cols-2 md:gap-3">
              {[
                { key: "travel_insurance", label: "상품 포인트 - 여행자보험" },
                { key: "meeting_info", label: "상품 포인트 - 미팅 정보" },
                { key: "point_tourism", label: "상품 포인트 - 관광" },
                { key: "point_guide", label: "상품 포인트 - 인솔자" },
              ].map((field) => {
                const fieldKey = field.key as
                  | "travel_insurance"
                  | "meeting_info"
                  | "point_tourism"
                  | "point_guide";
                const value = form[fieldKey];
                return (
                  <div key={field.key} className="rounded-lg border border-[var(--border)] bg-[var(--surface)] p-3">
                    <p className="mb-2 text-xs font-semibold text-[var(--text-primary)]">{field.label}</p>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => setForm((prev) => ({ ...prev, [fieldKey]: "O" }))}
                        className={`rounded-md px-3 py-1.5 text-xs font-semibold transition ${
                          value === "O"
                            ? "bg-emerald-600 text-white"
                            : "border border-[var(--border)] bg-[var(--surface)] text-[var(--text-secondary)] hover:bg-[var(--surface-muted)]"
                        }`}
                      >
                        O
                      </button>
                      <button
                        type="button"
                        onClick={() => setForm((prev) => ({ ...prev, [fieldKey]: "X" }))}
                        className={`rounded-md px-3 py-1.5 text-xs font-semibold transition ${
                          value === "X"
                            ? "bg-rose-600 text-white"
                            : "border border-[var(--border)] bg-[var(--surface)] text-[var(--text-secondary)] hover:bg-[var(--surface-muted)]"
                        }`}
                      >
                        X
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
                  </div>
      );
    case "included":
      return (
        <div className="flex flex-col space-y-3 md:space-y-0 md:grid md:grid-cols-2 md:gap-3">
          <div className="md:col-span-2 space-y-2">
            <p className="text-[11px] text-[var(--text-muted)]">템플릿으로 빠르게 입력할 수 있습니다</p>
            <div className="flex flex-wrap items-center gap-2">
              <select
                value={includedTemplateSelect}
                onChange={(e) => {
                  const id = e.target.value;
                  if (!id) return;
                  const template = INCLUDED_TEMPLATES.find((t) => t.id === id);
                  if (template) insertIncludedTemplate(template, "replace");
                  setIncludedTemplateSelect("");
                }}
                className="rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm text-[var(--text-primary)] outline-none focus:border-[var(--primary)] focus:ring-2 focus:ring-[var(--primary-soft)]"
              >
                <option value="">템플릿 적용</option>
                {INCLUDED_TEMPLATES.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.label}
                  </option>
                ))}
              </select>
              {INCLUDED_TEMPLATES[0] ? (
                <button
                  type="button"
                  onClick={() => insertIncludedTemplate(INCLUDED_TEMPLATES[0], "append")}
                  className="rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-xs font-semibold text-[var(--text-secondary)] hover:bg-[var(--surface-muted)]"
                >
                  추가 삽입
                </button>
              ) : null}
            </div>
          </div>
          <textarea
            value={form.included_items}
            onChange={(event) => setForm((prev) => ({ ...prev, included_items: event.target.value }))}
            rows={3}
            placeholder="포함 사항 (자동 추출하지 않습니다. 필요 시 직접 입력해 주세요.)"
            id="field-included"
            className="rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm text-[var(--text-primary)] outline-none focus:border-[var(--primary)] focus:ring-2 focus:ring-[var(--primary-soft)]"
          />
          <textarea
            value={form.excluded_items}
            onChange={(event) => setForm((prev) => ({ ...prev, excluded_items: event.target.value }))}
            rows={3}
            placeholder="불포함 사항 (자동 추출하지 않습니다. 필요 시 직접 입력해 주세요.)"
            id="field-excluded"
            className="rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm text-[var(--text-primary)] outline-none focus:border-[var(--primary)] focus:ring-2 focus:ring-[var(--primary-soft)]"
          />
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start md:col-span-2">
            <div className="flex-1">
              <label className="mb-1 block text-xs font-semibold text-[var(--text-secondary)]">선택관광 목록 (줄바꿈 가능)</label>
              <textarea
                value={form.optional_tours}
                onChange={(event) => setForm((prev) => ({ ...prev, optional_tours: event.target.value }))}
                rows={4}
                placeholder="선택관광 목록 (줄바꿈 가능)"
                className="w-full rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm text-[var(--text-primary)] outline-none focus:border-[var(--primary)] focus:ring-2 focus:ring-[var(--primary-soft)]"
              />
            </div>
            <div className="w-full sm:w-48 shrink-0">
              <label className="mb-1 block text-xs font-semibold text-[var(--text-secondary)]">출발인원 (~명 이상)</label>
              <input
                type="text"
                value={form.min_departure_people}
                onChange={(event) => setForm((prev) => ({ ...prev, min_departure_people: event.target.value }))}
                placeholder="예: 10"
                className="w-full rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm text-[var(--text-primary)] outline-none focus:border-[var(--primary)] focus:ring-2 focus:ring-[var(--primary-soft)]"
              />
            </div>
          </div>
                  </div>
      );
    case "flight":
      return (
        <div className="flex flex-col space-y-3 md:space-y-0 md:grid md:grid-cols-2 md:gap-3">
          <div className="space-y-3 rounded-lg border border-[var(--border)] bg-[var(--primary-soft)] p-3 md:col-span-2">
            <p className="text-sm font-semibold text-[var(--primary)]">항공편 정보</p>
            <p className="text-xs text-[var(--text-secondary)]">
              출발/도착 공항·편명은 상세 첫 화면 여행 오버뷰의 &quot;항공&quot; 카드에 자동 반영됩니다.
            </p>
            <p className="text-xs text-[var(--text-muted)]">
              현재는 라이선스 문제로 실제 항공사 로고 이미지는 사용하지 않고, 아이콘 + 텍스트만 표시됩니다. 추후
              라이선스 획득 시 이 프리뷰 영역과 상세페이지에 로고가 자동 업데이트됩니다.
            </p>
            <div className="flex flex-col space-y-3 md:space-y-0 md:grid md:grid-cols-2 md:gap-3">
              <div className="space-y-2 rounded-lg border border-[var(--border)] bg-[var(--surface)] p-3">
                <p className="text-xs font-semibold text-[var(--text-primary)]">출발 항공편</p>
                <div className="flex flex-col space-y-2 md:space-y-0 md:grid md:grid-cols-2 md:gap-2">
                  <input
                    value={form.departure_from_airport}
                    onChange={(event) =>
                      setForm((prev) => ({ ...prev, departure_from_airport: event.target.value }))
                    }
                    placeholder="출발공항 (예: 인천 ICN)"
                    className="rounded-lg border border-[var(--border)] px-3 py-2 text-xs outline-none focus:border-[var(--primary)] focus:ring-2 focus:ring-[var(--primary-soft)]"
                  />
                  <input
                    value={form.departure_to_airport}
                    onChange={(event) =>
                      setForm((prev) => ({ ...prev, departure_to_airport: event.target.value }))
                    }
                    placeholder="도착공항 (예: 미야자키 KMI)"
                    className="rounded-lg border border-[var(--border)] px-3 py-2 text-xs outline-none focus:border-[var(--primary)] focus:ring-2 focus:ring-[var(--primary-soft)]"
                  />
                  <input
                    value={form.departure_from_date}
                    onChange={(event) =>
                      setForm((prev) => ({ ...prev, departure_from_date: event.target.value }))
                    }
                    placeholder="출발일자 (예: 2026.02.20(금))"
                    className="rounded-lg border border-[var(--border)] px-3 py-2 text-xs outline-none focus:border-[var(--primary)] focus:ring-2 focus:ring-[var(--primary-soft)]"
                  />
                  <input
                    value={form.departure_to_date}
                    onChange={(event) =>
                      setForm((prev) => ({ ...prev, departure_to_date: event.target.value }))
                    }
                    placeholder="도착일자 (예: 2026.02.20(금))"
                    className="rounded-lg border border-[var(--border)] px-3 py-2 text-xs outline-none focus:border-[var(--primary)] focus:ring-2 focus:ring-[var(--primary-soft)]"
                  />
                  <input
                    value={form.departure_from_time}
                    onChange={(event) =>
                      setForm((prev) => ({ ...prev, departure_from_time: event.target.value }))
                    }
                    placeholder="출발시각 (예: 09:40)"
                    className="rounded-lg border border-[var(--border)] px-3 py-2 text-xs outline-none focus:border-[var(--primary)] focus:ring-2 focus:ring-[var(--primary-soft)]"
                  />
                  <input
                    value={form.departure_to_time}
                    onChange={(event) =>
                      setForm((prev) => ({ ...prev, departure_to_time: event.target.value }))
                    }
                    placeholder="도착시각 (예: 11:20)"
                    className="rounded-lg border border-[var(--border)] px-3 py-2 text-xs outline-none focus:border-[var(--primary)] focus:ring-2 focus:ring-[var(--primary-soft)]"
                  />
                </div>
                <div className="space-y-1">
                  <div className="flex items-center gap-3">
                    <input
                      value={form.departure_flight_name}
                      onChange={(event) =>
                        setForm((prev) => ({ ...prev, departure_flight_name: event.target.value }))
                      }
                      placeholder="항공편명 (예: 아시아나항공, 티웨이항공 TW501)"
                      id="form-field-flight-departure_flight_name"
                      className="flex-1 rounded-lg border border-[var(--border)] px-3 py-2 text-xs outline-none focus:border-[var(--primary)] focus:ring-2 focus:ring-[var(--primary-soft)]"
                    />
                    <AirlineLogo airlineText={form.departure_flight_name} size={32} />
                  </div>
                  <input
                    value={form.departure_baggage_limit}
                    onChange={(event) =>
                      setForm((prev) => ({ ...prev, departure_baggage_limit: event.target.value }))
                    }
                    placeholder="수하물 한도 (예: 23 또는 23KG)"
                    className="w-full rounded-lg border border-[var(--border)] px-3 py-2 text-xs outline-none focus:border-[var(--primary)] focus:ring-2 focus:ring-[var(--primary-soft)]"
                  />
                  {/* 현재는 항상 Plane + 텍스트만 표시 (로고 비활성화) */}
                </div>
              </div>

              <div className="space-y-2 rounded-lg border border-[var(--border)] bg-[var(--surface)] p-3">
                <p className="text-xs font-semibold text-[var(--text-primary)]">도착 항공편</p>
                <div className="flex flex-col space-y-2 md:space-y-0 md:grid md:grid-cols-2 md:gap-2">
                  <input
                    value={form.arrival_from_airport}
                    onChange={(event) =>
                      setForm((prev) => ({ ...prev, arrival_from_airport: event.target.value }))
                    }
                    placeholder="출발공항 (예: 미야자키 KMI)"
                    className="rounded-lg border border-[var(--border)] px-3 py-2 text-xs outline-none focus:border-[var(--primary)] focus:ring-2 focus:ring-[var(--primary-soft)]"
                  />
                  <input
                    value={form.arrival_to_airport}
                    onChange={(event) =>
                      setForm((prev) => ({ ...prev, arrival_to_airport: event.target.value }))
                    }
                    placeholder="도착공항 (예: 인천 ICN)"
                    className="rounded-lg border border-[var(--border)] px-3 py-2 text-xs outline-none focus:border-[var(--primary)] focus:ring-2 focus:ring-[var(--primary-soft)]"
                  />
                  <input
                    value={form.arrival_from_date}
                    onChange={(event) =>
                      setForm((prev) => ({ ...prev, arrival_from_date: event.target.value }))
                    }
                    placeholder="출발일자 (예: 2026.02.23(월))"
                    className="rounded-lg border border-[var(--border)] px-3 py-2 text-xs outline-none focus:border-[var(--primary)] focus:ring-2 focus:ring-[var(--primary-soft)]"
                  />
                  <input
                    value={form.arrival_to_date}
                    onChange={(event) =>
                      setForm((prev) => ({ ...prev, arrival_to_date: event.target.value }))
                    }
                    placeholder="도착일자 (예: 2026.02.23(월))"
                    className="rounded-lg border border-[var(--border)] px-3 py-2 text-xs outline-none focus:border-[var(--primary)] focus:ring-2 focus:ring-[var(--primary-soft)]"
                  />
                  <input
                    value={form.arrival_from_time}
                    onChange={(event) =>
                      setForm((prev) => ({ ...prev, arrival_from_time: event.target.value }))
                    }
                    placeholder="출발시각 (예: 12:30)"
                    className="rounded-lg border border-[var(--border)] px-3 py-2 text-xs outline-none focus:border-[var(--primary)] focus:ring-2 focus:ring-[var(--primary-soft)]"
                  />
                  <input
                    value={form.arrival_to_time}
                    onChange={(event) =>
                      setForm((prev) => ({ ...prev, arrival_to_time: event.target.value }))
                    }
                    placeholder="도착시각 (예: 14:10)"
                    className="rounded-lg border border-[var(--border)] px-3 py-2 text-xs outline-none focus:border-[var(--primary)] focus:ring-2 focus:ring-[var(--primary-soft)]"
                  />
                </div>
                <div className="space-y-1">
                  <div className="flex items-center gap-3">
                    <input
                      value={form.arrival_flight_name}
                      onChange={(event) =>
                        setForm((prev) => ({ ...prev, arrival_flight_name: event.target.value }))
                      }
                      placeholder="항공편명 (예: 아시아나항공, 티웨이항공 TW501)"
                      id="form-field-flight-arrival_flight_name"
                      className="flex-1 rounded-lg border border-[var(--border)] px-3 py-2 text-xs outline-none focus:border-[var(--primary)] focus:ring-2 focus:ring-[var(--primary-soft)]"
                    />
                    <AirlineLogo airlineText={form.arrival_flight_name} size={32} />
                  </div>
                  <input
                    value={form.arrival_baggage_limit}
                    onChange={(event) =>
                      setForm((prev) => ({ ...prev, arrival_baggage_limit: event.target.value }))
                    }
                    placeholder="수하물 한도 (예: 23 또는 23KG)"
                    className="w-full rounded-lg border border-[var(--border)] px-3 py-2 text-xs outline-none focus:border-[var(--primary)] focus:ring-2 focus:ring-[var(--primary-soft)]"
                  />
                  {/* 현재는 항상 Plane + 텍스트만 표시 (로고 비활성화) */}
                </div>
              </div>
            </div>
          </div>
                  </div>
      );
    case "terms":
      return (
        <div className="flex flex-col space-y-3 md:space-y-0 md:grid md:grid-cols-2 md:gap-3">
          <p className="text-[11px] text-[var(--text-muted)] md:col-span-2">
            각 항목마다 <strong className="text-[var(--text-secondary)]">공통 템플릿 키</strong>를 고를 수 있습니다. 직접 입력이
            비어 있을 때만 해당 템플릿 본문이 상세 페이지에 반영됩니다. (예약 유의만 레거시 &quot;약관 및 참조사항&quot; 필드로
            폴백할 수 있습니다.)
          </p>
          <div className="space-y-2 rounded-lg border border-[var(--border)] bg-[var(--primary-soft)] p-3 md:col-span-2">
            <p className="text-sm font-semibold text-[var(--primary)]">예약 시 유의사항</p>
            <select
              value={form.booking_notes_template_type}
              onChange={(event) =>
                setForm((prev) => ({
                  ...prev,
                  booking_notes_template_type: event.target.value as "" | TermsTemplateType,
                }))
              }
              className="w-full max-w-md rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm outline-none focus:border-[var(--primary)] focus:ring-2 focus:ring-[var(--primary-soft)]"
            >
              <option value="">직접 입력만 (템플릿 키 없음)</option>
              {TERMS_TEMPLATE_OPTIONS.map((item) => (
                <option key={item.value} value={item.value}>
                  {item.label}
                </option>
              ))}
            </select>
            {form.booking_notes_template_type ? (
              <div className="rounded-lg border border-[var(--border)] bg-[var(--surface)] p-3">
                <p className="mb-2 text-xs font-semibold text-[var(--text-primary)]">선택 키의 공통 템플릿 미리보기</p>
                <p className="whitespace-pre-line text-xs leading-6 text-[var(--text-secondary)]">
                  {termsPreview("booking_notes", form.booking_notes_template_type) ||
                    "템플릿 내용이 비어 있습니다. 아래 공통 템플릿 관리에서 채워 주세요."}
                </p>
              </div>
            ) : null}
            <div className="flex flex-wrap items-center gap-2">
              <select
                value={termsSnippetSelect}
                onChange={(e) => {
                  const id = e.target.value;
                  if (!id) return;
                  const t = TERMS_TEMPLATES.find((x) => x.id === id);
                  if (t) insertText("booking_notes", t.content, "replace");
                  setTermsSnippetSelect("");
                }}
                className="w-full max-w-xs rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm text-[var(--text-primary)] outline-none focus:border-[var(--primary)] focus:ring-2 focus:ring-[var(--primary-soft)]"
              >
                <option value="">문구 스니펫 삽입 (예약 유의)</option>
                {TERMS_TEMPLATES.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.label}
                  </option>
                ))}
              </select>
            </div>
            <textarea
              id="form-field-booking_notes"
              value={form.booking_notes}
              onChange={(event) =>
                setForm((prev) => ({ ...prev, booking_notes: event.target.value }))
              }
              rows={4}
              placeholder="예약 진행 시 유의사항 입력"
              className="w-full rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm outline-none focus:border-[var(--primary)] focus:ring-2 focus:ring-[var(--primary-soft)]"
            />
          </div>
          <div className="space-y-2 rounded-lg border border-[var(--border)] bg-[var(--primary-soft)] p-3 md:col-span-2">
            <p className="text-sm font-semibold text-[var(--primary)]">여행 시 유의사항</p>
            <select
              value={form.travel_notes_template_type}
              onChange={(event) =>
                setForm((prev) => ({
                  ...prev,
                  travel_notes_template_type: event.target.value as "" | TermsTemplateType,
                }))
              }
              className="w-full max-w-md rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm outline-none focus:border-[var(--primary)] focus:ring-2 focus:ring-[var(--primary-soft)]"
            >
              <option value="">직접 입력만 (템플릿 키 없음)</option>
              {TERMS_TEMPLATE_OPTIONS.map((item) => (
                <option key={item.value} value={item.value}>
                  {item.label}
                </option>
              ))}
            </select>
            {form.travel_notes_template_type ? (
              <div className="rounded-lg border border-[var(--border)] bg-[var(--surface)] p-3">
                <p className="mb-2 text-xs font-semibold text-[var(--text-primary)]">선택 키의 공통 템플릿 미리보기</p>
                <p className="whitespace-pre-line text-xs leading-6 text-[var(--text-secondary)]">
                  {termsPreview("travel_notes", form.travel_notes_template_type) ||
                    "템플릿 내용이 비어 있습니다. 아래 공통 템플릿 관리에서 채워 주세요."}
                </p>
              </div>
            ) : null}
            <div className="flex flex-wrap items-center gap-2">
              <select
                value={travelTermsSnippetSelect}
                onChange={(e) => {
                  const id = e.target.value;
                  if (!id) return;
                  const t = TERMS_TEMPLATES.find((x) => x.id === id);
                  if (t) insertText("travel_notes", t.content, "replace");
                  setTravelTermsSnippetSelect("");
                }}
                className="w-full max-w-xs rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm text-[var(--text-primary)] outline-none focus:border-[var(--primary)] focus:ring-2 focus:ring-[var(--primary-soft)]"
              >
                <option value="">문구 스니펫 삽입 (여행 유의)</option>
                {TERMS_TEMPLATES.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.label}
                  </option>
                ))}
              </select>
            </div>
            <textarea
              id="form-field-travel_notes"
              value={form.travel_notes}
              onChange={(event) =>
                setForm((prev) => ({ ...prev, travel_notes: event.target.value }))
              }
              rows={4}
              placeholder="여행 중 유의사항 입력"
              className="w-full rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm outline-none focus:border-[var(--primary)] focus:ring-2 focus:ring-[var(--primary-soft)]"
            />
          </div>
          <div className="space-y-2 rounded-lg border border-[var(--border)] bg-[var(--primary-soft)] p-3 md:col-span-2">
            <p className="text-sm font-semibold text-[var(--primary)]">예약조건</p>
            <select
              value={form.booking_conditions_template_type}
              onChange={(event) =>
                setForm((prev) => ({
                  ...prev,
                  booking_conditions_template_type: event.target.value as "" | TermsTemplateType,
                }))
              }
              className="w-full max-w-md rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm outline-none focus:border-[var(--primary)] focus:ring-2 focus:ring-[var(--primary-soft)]"
            >
              <option value="">직접 입력만 (템플릿 키 없음)</option>
              {TERMS_TEMPLATE_OPTIONS.map((item) => (
                <option key={item.value} value={item.value}>
                  {item.label}
                </option>
              ))}
            </select>
            {form.booking_conditions_template_type ? (
              <div className="rounded-lg border border-[var(--border)] bg-[var(--surface)] p-3">
                <p className="mb-2 text-xs font-semibold text-[var(--text-primary)]">선택 키의 공통 템플릿 미리보기</p>
                <p className="whitespace-pre-line text-xs leading-6 text-[var(--text-secondary)]">
                  {termsPreview("booking_conditions", form.booking_conditions_template_type) ||
                    "템플릿 내용이 비어 있습니다. 아래 공통 템플릿 관리에서 채워 주세요."}
                </p>
              </div>
            ) : null}
            <div className="flex flex-wrap items-center gap-2">
              <select
                value={conditionTermsSnippetSelect}
                onChange={(e) => {
                  const id = e.target.value;
                  if (!id) return;
                  const t = TERMS_TEMPLATES.find((x) => x.id === id);
                  if (t) insertText("booking_conditions", t.content, "replace");
                  setConditionTermsSnippetSelect("");
                }}
                className="w-full max-w-xs rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm text-[var(--text-primary)] outline-none focus:border-[var(--primary)] focus:ring-2 focus:ring-[var(--primary-soft)]"
              >
                <option value="">문구 스니펫 삽입 (예약조건)</option>
                {TERMS_TEMPLATES.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.label}
                  </option>
                ))}
              </select>
            </div>
            <textarea
              id="form-field-booking_conditions"
              value={form.booking_conditions}
              onChange={(event) =>
                setForm((prev) => ({ ...prev, booking_conditions: event.target.value }))
              }
              rows={4}
              placeholder="예약 조건 입력"
              className="w-full rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm outline-none focus:border-[var(--primary)] focus:ring-2 focus:ring-[var(--primary-soft)]"
            />
          </div>
          <div className="space-y-2 rounded-lg border border-[var(--border)] bg-[var(--primary-soft)] p-3 md:col-span-2">
            <p className="text-sm font-semibold text-[var(--primary)]">환불/취소 규정</p>
            <select
              value={form.refund_policy_template_type}
              onChange={(event) =>
                setForm((prev) => ({
                  ...prev,
                  refund_policy_template_type: event.target.value as "" | TermsTemplateType,
                }))
              }
              className="w-full max-w-md rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm outline-none focus:border-[var(--primary)] focus:ring-2 focus:ring-[var(--primary-soft)]"
            >
              <option value="">직접 입력만 (템플릿 키 없음)</option>
              {TERMS_TEMPLATE_OPTIONS.map((item) => (
                <option key={item.value} value={item.value}>
                  {item.label}
                </option>
              ))}
            </select>
            {form.refund_policy_template_type ? (
              <div className="rounded-lg border border-[var(--border)] bg-[var(--surface)] p-3">
                <p className="mb-2 text-xs font-semibold text-[var(--text-primary)]">선택 키의 공통 템플릿 미리보기</p>
                <p className="whitespace-pre-line text-xs leading-6 text-[var(--text-secondary)]">
                  {termsPreview("refund_policy", form.refund_policy_template_type) ||
                    "템플릿 내용이 비어 있습니다. 아래 공통 템플릿 관리에서 채워 주세요."}
                </p>
              </div>
            ) : null}
            <div className="flex flex-wrap items-center gap-2">
              <select
                value={refundTermsSnippetSelect}
                onChange={(e) => {
                  const id = e.target.value;
                  if (!id) return;
                  const t = TERMS_TEMPLATES.find((x) => x.id === id);
                  if (t) insertText("refund_policy", t.content, "replace");
                  setRefundTermsSnippetSelect("");
                }}
                className="w-full max-w-xs rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm text-[var(--text-primary)] outline-none focus:border-[var(--primary)] focus:ring-2 focus:ring-[var(--primary-soft)]"
              >
                <option value="">문구 스니펫 삽입 (환불 규정)</option>
                {TERMS_TEMPLATES.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.label}
                  </option>
                ))}
              </select>
            </div>
            <textarea
              id="form-field-refund_policy"
              value={form.refund_policy}
              onChange={(event) =>
                setForm((prev) => ({ ...prev, refund_policy: event.target.value }))
              }
              rows={4}
              placeholder="환불 및 취소 규정을 입력하세요 (예: 출발 7일 전 100% 환불 등)"
              className="w-full rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm outline-none focus:border-[var(--primary)] focus:ring-2 focus:ring-[var(--primary-soft)]"
            />
          </div>
          <div className="space-y-3 rounded-lg border border-[var(--border)] bg-[var(--surface)]/90 p-3 md:col-span-2">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="text-sm font-semibold text-[var(--text-primary)]">
                공통 안내 템플릿 관리 (예약·여행·예약조건·환불)
              </p>
              <button
                type="button"
                onClick={() => setIsTermsTemplatesPanelOpen((prev) => !prev)}
                className="rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-1.5 text-xs font-semibold text-[var(--text-primary)] hover:bg-[var(--surface-muted)] disabled:opacity-50"
              >
                {isTermsTemplatesPanelOpen ? "접기" : "펼치기"}
              </button>
            </div>
            {!isTermsTemplatesPanelOpen ? (
              <p className="text-xs text-[var(--text-muted)]">
                안전을 위해 기본 접힘 상태입니다. 수정이 필요할 때만 펼쳐서 사용해 주세요.
              </p>
            ) : (
              <>
                <div className="flex justify-end">
                  <button
                    type="button"
                    onClick={saveNoticeTemplates}
                    disabled={isTermsTemplatesLoading || isTermsTemplatesSaving}
                    className="rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-1.5 text-xs font-semibold text-[var(--text-primary)] hover:bg-[var(--surface-muted)] disabled:opacity-50"
                  >
                    {isTermsTemplatesSaving ? "저장 중..." : "템플릿 저장"}
                  </button>
                </div>
                {termsTemplatesErrorMessage ? (
                  <p className="text-xs text-rose-600">{termsTemplatesErrorMessage}</p>
                ) : null}
                <div className="flex flex-col space-y-6">
                  {(
                    [
                      { group: "booking_notes" as const, title: "예약 시 유의사항 템플릿" },
                      { group: "travel_notes" as const, title: "여행 시 유의사항 템플릿" },
                      { group: "booking_conditions" as const, title: "예약조건 템플릿" },
                      { group: "refund_policy" as const, title: "환불/취소 규정 템플릿" },
                    ] as const
                  ).map(({ group, title }) => (
                    <div
                      key={group}
                      className="space-y-2 rounded-lg border border-[var(--border)] bg-slate-50/80 p-3"
                    >
                      <p className="text-xs font-semibold text-[var(--primary)]">{title}</p>
                      <div className="flex flex-col space-y-3 md:space-y-0 md:grid md:grid-cols-2 md:gap-3">
                        {TERMS_TEMPLATE_OPTIONS.map((item) => (
                          <div
                            key={`${group}-${item.value}`}
                            className="space-y-1 rounded-lg border border-[var(--border)] bg-[var(--surface)] p-2.5"
                          >
                            <p className="text-xs font-semibold text-[var(--text-primary)]">{item.label}</p>
                            <textarea
                              value={noticeTemplatesByGroup[group][item.value]}
                              onChange={(event) =>
                                setNoticeTemplatesByGroup((prev) => ({
                                  ...prev,
                                  [group]: {
                                    ...prev[group],
                                    [item.value]: event.target.value,
                                  },
                                }))
                              }
                              rows={5}
                              placeholder={`${item.label} 템플릿 본문`}
                              className="w-full rounded-md border border-[var(--border)] bg-[var(--surface)] px-2.5 py-2 text-xs leading-5 outline-none focus:border-[var(--primary)] focus:ring-2 focus:ring-[var(--primary-soft)]"
                            />
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>
          <input
            value={form.meta_title}
            onChange={(event) => setForm((prev) => ({ ...prev, meta_title: event.target.value }))}
            placeholder="SEO 메타 타이틀 (선택). 스페이스로 구분한 키워드는 상품 상세페이지에 해시태그(#키워드)로 노출됩니다. 예: 태국 파크골프 치앙마이"
            id="field-seo-title"
            className="rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm text-[var(--text-primary)] outline-none focus:border-[var(--primary)] focus:ring-2 focus:ring-[var(--primary-soft)] md:col-span-2"
          />
          <textarea
            value={form.meta_description}
            onChange={(event) => setForm((prev) => ({ ...prev, meta_description: event.target.value }))}
            rows={3}
            placeholder="SEO 메타 설명 (선택, 예시: 타깃층 문제해결 + 차별화된 혜택/신뢰 요소 + CTA포함)"
            id="field-seo-desc"
            className="rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm text-[var(--text-primary)] outline-none focus:border-[var(--primary)] focus:ring-2 focus:ring-[var(--primary-soft)] md:col-span-2"
          />
          <input
            value={form.sort_order}
            onChange={(event) => setForm((prev) => ({ ...prev, sort_order: event.target.value }))}
            placeholder="노출 순서 (숫자 작을수록 먼저)"
            className="rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm text-[var(--text-primary)] outline-none focus:border-[var(--primary)] focus:ring-2 focus:ring-[var(--primary-soft)]"
          />
          <label className="flex items-center gap-2 text-sm text-[var(--text-primary)]">
            <input
              type="checkbox"
              checked={form.is_active}
              onChange={(event) => setForm((prev) => ({ ...prev, is_active: event.target.checked }))}
                          className="h-4 w-4 accent-[var(--primary)]"
            />
            상품 노출 활성화
          </label>
        </div>
      );
    default:
      return null;
  }
}
