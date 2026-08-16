"use client";

import type { Dispatch, SetStateAction } from "react";
import type { DepartureScheduleFormRow, ProductFormState } from "@/types/adminProductForm";
import { createEmptyDepartureScheduleRow } from "@/types/adminProductForm";

type Props = {
  form: ProductFormState;
  setForm: Dispatch<SetStateAction<ProductFormState>>;
  formatPriceWithCommas: (raw: string) => string;
};

function updateRow(
  rows: DepartureScheduleFormRow[],
  index: number,
  patch: Partial<DepartureScheduleFormRow>,
): DepartureScheduleFormRow[] {
  return rows.map((row, i) => (i === index ? { ...row, ...patch } : row));
}

export function DepartureSchedulesEditor({ form, setForm, formatPriceWithCommas }: Props) {
  const rows = form.departure_schedules;

  return (
    <div className="space-y-3 rounded-lg border border-[var(--border)] bg-[var(--surface)] p-3">
      <div className="space-y-1">
        <p className="text-sm font-semibold text-[var(--text-primary)]">출발일 스케줄</p>
        <p className="text-xs text-[var(--text-secondary)]">
          복수 출발일·출발일별 가격을 등록합니다. 상세 페이지 출발일 선택 칩에 반영됩니다.
        </p>
      </div>

      {rows.length > 0 ? (
        <div className="overflow-x-auto">
          <table className="min-w-full text-xs">
            <thead>
              <tr className="border-b border-[var(--border)] text-left text-[var(--text-secondary)]">
                <th className="px-2 py-2 font-semibold">출발일</th>
                <th className="px-2 py-2 font-semibold">귀국일</th>
                <th className="px-2 py-2 font-semibold">가격(원)</th>
                <th className="px-2 py-2 font-semibold">표시 라벨</th>
                <th className="px-2 py-2 font-semibold">상태</th>
                <th className="px-2 py-2 font-semibold">삭제</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row, index) => (
                <tr key={index} className="border-b border-[var(--border)]/60">
                  <td className="px-2 py-2">
                    <input
                      value={row.departureDate}
                      onChange={(e) =>
                        setForm((prev) => ({
                          ...prev,
                          departure_schedules: updateRow(prev.departure_schedules, index, {
                            departureDate: e.target.value,
                          }),
                        }))
                      }
                      placeholder="2025-07-23"
                      className="w-full min-w-[7rem] rounded border border-[var(--border)] px-2 py-1.5 outline-none focus:border-[var(--primary)]"
                    />
                  </td>
                  <td className="px-2 py-2">
                    <input
                      value={row.returnDate}
                      onChange={(e) =>
                        setForm((prev) => ({
                          ...prev,
                          departure_schedules: updateRow(prev.departure_schedules, index, {
                            returnDate: e.target.value,
                          }),
                        }))
                      }
                      placeholder="선택"
                      className="w-full min-w-[7rem] rounded border border-[var(--border)] px-2 py-1.5 outline-none focus:border-[var(--primary)]"
                    />
                  </td>
                  <td className="px-2 py-2">
                    <input
                      value={row.price}
                      onChange={(e) =>
                        setForm((prev) => ({
                          ...prev,
                          departure_schedules: updateRow(prev.departure_schedules, index, {
                            price: formatPriceWithCommas(e.target.value),
                          }),
                        }))
                      }
                      placeholder="890,000"
                      className="w-full min-w-[6rem] rounded border border-[var(--border)] px-2 py-1.5 outline-none focus:border-[var(--primary)]"
                    />
                  </td>
                  <td className="px-2 py-2">
                    <input
                      value={row.label}
                      onChange={(e) =>
                        setForm((prev) => ({
                          ...prev,
                          departure_schedules: updateRow(prev.departure_schedules, index, {
                            label: e.target.value,
                          }),
                        }))
                      }
                      placeholder="7/23(수)"
                      className="w-full min-w-[6rem] rounded border border-[var(--border)] px-2 py-1.5 outline-none focus:border-[var(--primary)]"
                    />
                  </td>
                  <td className="px-2 py-2">
                    <select
                      value={row.status}
                      onChange={(e) =>
                        setForm((prev) => ({
                          ...prev,
                          departure_schedules: updateRow(prev.departure_schedules, index, {
                            status: e.target.value as DepartureScheduleFormRow["status"],
                          }),
                        }))
                      }
                      className="w-full min-w-[5.5rem] rounded border border-[var(--border)] px-2 py-1.5 outline-none focus:border-[var(--primary)]"
                    >
                      <option value="">-</option>
                      <option value="AVAILABLE">예약가능</option>
                      <option value="LIMITED">잔여한정</option>
                      <option value="SOLD_OUT">마감</option>
                    </select>
                  </td>
                  <td className="px-2 py-2">
                    <button
                      type="button"
                      onClick={() =>
                        setForm((prev) => ({
                          ...prev,
                          departure_schedules: prev.departure_schedules.filter((_, i) => i !== index),
                        }))
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
      ) : (
        <p className="text-xs text-[var(--text-muted)]">등록된 출발일이 없습니다.</p>
      )}

      <button
        type="button"
        onClick={() =>
          setForm((prev) => ({
            ...prev,
            departure_schedules: [...prev.departure_schedules, createEmptyDepartureScheduleRow()],
          }))
        }
        className="rounded-lg border border-[var(--primary)]/50 bg-[var(--primary-soft)] px-3 py-2 text-sm font-medium text-[var(--primary)] hover:bg-[var(--primary-soft)]/80"
      >
        출발일 행 추가
      </button>
    </div>
  );
}
