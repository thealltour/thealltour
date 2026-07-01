import type { DepartureScheduleFormRow } from "@/types/adminProductForm";
import type { ProductDepartureSchedule } from "@/types/product";
import { departureSchedulesToJsonColumn } from "@/lib/products/normalizeDepartureSchedules";

function toSafeInteger(value: unknown): number | null {
  if (value == null) return null;
  const n = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(n)) return null;
  const int = Math.round(n);
  if (int < -2147483648 || int > 2147483647) return null;
  return int;
}

export function departureSchedulesToFormRows(
  schedules: ProductDepartureSchedule[] | undefined,
): DepartureScheduleFormRow[] {
  if (!schedules?.length) return [];
  return schedules.map((schedule) => ({
    departureDate: schedule.departureDate ?? "",
    returnDate: schedule.returnDate ?? "",
    price:
      typeof schedule.price === "number" && schedule.price > 0
        ? schedule.price.toLocaleString("ko-KR")
        : "",
    label: schedule.label ?? "",
    status: schedule.status ?? "",
  }));
}

export function formRowsToDepartureSchedules(
  rows: DepartureScheduleFormRow[],
): ProductDepartureSchedule[] | null {
  const schedules: ProductDepartureSchedule[] = [];

  for (const row of rows) {
    const departureDate = row.departureDate.trim();
    if (!departureDate) continue;

    const normalizedPrice = row.price.replace(/,/g, "").replace(/~/g, "").trim();
    const price = normalizedPrice === "" ? null : toSafeInteger(Number(normalizedPrice));

    schedules.push({
      departureDate,
      returnDate: row.returnDate.trim() || null,
      price,
      label: row.label.trim() || null,
      status: row.status === "" ? null : row.status,
    });
  }

  return departureSchedulesToJsonColumn(schedules);
}
