import { describe, expect, it } from "vitest";
import {
  extractMissingProductsColumn,
  insertProductWithSchemaFallback,
  productSaveWarningCodeFromStrippedColumns,
  stripProductsColumn,
  updateProductWithSchemaFallback,
} from "@/lib/supabaseProductsColumnFallback";

describe("supabaseProductsColumnFallback", () => {
  it("extracts missing column name from PostgREST error", () => {
    expect(
      extractMissingProductsColumn(
        "Could not find the 'optional_expenses' column of 'products' in the schema cache",
      ),
    ).toBe("optional_expenses");
  });

  it("strips a column from payload", () => {
    expect(stripProductsColumn({ a: 1, optional_expenses: "x" }, "optional_expenses")).toEqual({ a: 1 });
  });

  it("retries insert after stripping missing columns", async () => {
    const calls: Record<string, unknown>[] = [];
    const result = await insertProductWithSchemaFallback(async (payload) => {
      calls.push({ ...payload });
      if ("optional_expenses" in payload) {
        return {
          data: null,
          error: {
            message:
              "Could not find the 'optional_expenses' column of 'products' in the schema cache",
          },
        };
      }
      return { data: { id: "prod-1" }, error: null };
    }, { title: "t", optional_expenses: "fee" });

    expect(result.data?.id).toBe("prod-1");
    expect(result.strippedColumns).toEqual(["optional_expenses"]);
    expect(calls).toHaveLength(2);
    expect(calls[1]).not.toHaveProperty("optional_expenses");
  });

  it("retries update after stripping missing columns", async () => {
    const calls: Record<string, unknown>[] = [];
    const result = await updateProductWithSchemaFallback(async (payload) => {
      calls.push({ ...payload });
      if ("departure_schedules_json" in payload) {
        return {
          data: null,
          error: {
            message:
              "Could not find the 'departure_schedules_json' column of 'products' in the schema cache",
          },
        };
      }
      return { data: { id: "prod-1" }, error: null };
    }, { title: "t", departure_schedules_json: [] });

    expect(result.data?.id).toBe("prod-1");
    expect(result.strippedColumns).toEqual(["departure_schedules_json"]);
    expect(productSaveWarningCodeFromStrippedColumns(result.strippedColumns)).toBe(
      "DEPARTURE_SCHEDULES_JSON_NOT_PERSISTED",
    );
    expect(calls).toHaveLength(2);
    expect(calls[1]).not.toHaveProperty("departure_schedules_json");
  });
});
