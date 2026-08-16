"use client";

import type { Dispatch, SetStateAction } from "react";
import type { ProductFormState } from "@/types/adminProductForm";
import {
  addProductOptionItem,
  parseFormBasePrice,
  parsePriceDeltaInput,
  parseProductOptionsJson,
  patchProductOptionGroupTitle,
  patchProductOptionItem,
  removeProductOptionItem,
  stringifyProductOptionsJson,
} from "@/lib/admin/productOptionsForm";

type Props = {
  form: ProductFormState;
  setForm: Dispatch<SetStateAction<ProductFormState>>;
  formatPriceWithCommas: (raw: string) => string;
};

function commitOptionsJson(
  setForm: Dispatch<SetStateAction<ProductFormState>>,
  next: ReturnType<typeof addProductOptionItem> | null,
) {
  setForm((prev) => ({
    ...prev,
    options_json: stringifyProductOptionsJson(next),
  }));
}

export function ProductOptionsEditor({ form, setForm, formatPriceWithCommas }: Props) {
  const parsed = parseProductOptionsJson(form.options_json);

  if (!parsed.ok) {
    return (
      <div className="space-y-2 rounded-lg border border-[var(--danger)]/40 bg-[var(--danger-bg)] p-3">
        <p className="text-sm font-semibold text-[var(--text-primary)]">추가 옵션·할증</p>
        <p className="text-xs text-[var(--danger)]">
          {parsed.error} 고급 섹션의 옵션 JSON을 수정한 뒤 다시 열어 주세요.
        </p>
      </div>
    );
  }

  const options = parsed.options;

  return (
    <div className="space-y-3 rounded-lg border border-[var(--border)] bg-[var(--surface)] p-3">
      <div className="space-y-1">
        <p className="text-sm font-semibold text-[var(--text-primary)]">추가 옵션·할증</p>
        <p className="text-xs text-[var(--text-secondary)]">
          상세 페이지 「추가 옵션·할증 선택」에 반영됩니다. 추가금액(원)을 비우면 원화 가산이 붙지 않습니다.
        </p>
      </div>

      {options?.groups.length ? (
        <div className="space-y-4">
          {options.groups.map((group, groupIndex) => (
            <div key={`${group.key}-${groupIndex}`} className="space-y-2">
              <input
                value={group.title}
                onChange={(e) =>
                  commitOptionsJson(
                    setForm,
                    patchProductOptionGroupTitle(options, groupIndex, e.target.value),
                  )
                }
                aria-label="옵션 그룹 제목"
                className="w-full max-w-md rounded border border-[var(--border)] px-2 py-1.5 text-sm font-semibold outline-none focus:border-[var(--primary)]"
              />
              <div className="overflow-x-auto">
                <table className="min-w-full text-xs">
                  <thead>
                    <tr className="border-b border-[var(--border)] text-left text-[var(--text-secondary)]">
                      <th className="px-2 py-2 font-semibold">옵션명</th>
                      <th className="px-2 py-2 font-semibold">추가금액(원)</th>
                      <th className="px-2 py-2 font-semibold">설명</th>
                      <th className="px-2 py-2 font-semibold">삭제</th>
                    </tr>
                  </thead>
                  <tbody>
                    {group.items.map((item, itemIndex) => (
                      <tr key={item.value} className="border-b border-[var(--border)]/60">
                        <td className="px-2 py-2">
                          <input
                            value={item.label}
                            onChange={(e) =>
                              commitOptionsJson(
                                setForm,
                                patchProductOptionItem(options, groupIndex, itemIndex, {
                                  label: e.target.value,
                                }),
                              )
                            }
                            placeholder="싱글카트 이용시"
                            className="w-full min-w-[8rem] rounded border border-[var(--border)] px-2 py-1.5 outline-none focus:border-[var(--primary)]"
                          />
                        </td>
                        <td className="px-2 py-2">
                          <input
                            value={
                              item.priceDelta != null
                                ? formatPriceWithCommas(String(item.priceDelta))
                                : ""
                            }
                            onChange={(e) =>
                              commitOptionsJson(
                                setForm,
                                patchProductOptionItem(options, groupIndex, itemIndex, {
                                  priceDelta: parsePriceDeltaInput(e.target.value),
                                }),
                              )
                            }
                            placeholder="비우면 없음"
                            inputMode="numeric"
                            className="w-full min-w-[6rem] rounded border border-[var(--border)] px-2 py-1.5 outline-none focus:border-[var(--primary)]"
                          />
                        </td>
                        <td className="px-2 py-2">
                          <input
                            value={item.meta ?? ""}
                            onChange={(e) =>
                              commitOptionsJson(
                                setForm,
                                patchProductOptionItem(options, groupIndex, itemIndex, {
                                  meta: e.target.value,
                                }),
                              )
                            }
                            placeholder="18홀/120위안 추가"
                            className="w-full min-w-[10rem] rounded border border-[var(--border)] px-2 py-1.5 outline-none focus:border-[var(--primary)]"
                          />
                        </td>
                        <td className="px-2 py-2">
                          <button
                            type="button"
                            onClick={() =>
                              commitOptionsJson(
                                setForm,
                                removeProductOptionItem(options, groupIndex, itemIndex),
                              )
                            }
                            className="rounded border border-[var(--danger)]/40 px-2 py-1 text-[var(--danger)] hover:bg-[var(--danger-bg)]"
                          >
                            삭제
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <p className="text-xs text-[var(--text-muted)]">등록된 추가 옵션이 없습니다.</p>
      )}

      <button
        type="button"
        onClick={() =>
          commitOptionsJson(
            setForm,
            addProductOptionItem(options, parseFormBasePrice(form.price)),
          )
        }
        className="rounded-lg border border-[var(--primary)]/50 bg-[var(--primary-soft)] px-3 py-2 text-sm font-medium text-[var(--primary)] hover:bg-[var(--primary-soft)]/80"
      >
        옵션 추가
      </button>
    </div>
  );
}
