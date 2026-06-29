/** PostgREST schema cache: "Could not find the 'optional_expenses' column of 'products' in the schema cache" */
export function extractMissingProductsColumn(message?: string): string | null {
  if (!message) return null;
  const match = message.match(/Could not find the '([^']+)' column of 'products'/i);
  return match?.[1] ?? null;
}

export function stripProductsColumn<T extends Record<string, unknown>>(payload: T, column: string): T {
  return Object.fromEntries(Object.entries(payload).filter(([key]) => key !== column)) as T;
}

type SupabaseInsertResult = {
  data: { id: string } | null;
  error: { message?: string } | null;
};

type ProductsInserter = (payload: Record<string, unknown>) => Promise<SupabaseInsertResult>;

/**
 * Inserts into products, stripping columns missing from the remote schema (migration not applied yet).
 */
export async function insertProductWithSchemaFallback(
  insert: ProductsInserter,
  payload: Record<string, unknown>,
  maxRetries = 6,
): Promise<SupabaseInsertResult & { strippedColumns: string[] }> {
  let current = { ...payload };
  const strippedColumns: string[] = [];

  for (let attempt = 0; attempt < maxRetries; attempt += 1) {
    const result = await insert(current);
    if (!result.error) {
      return { ...result, strippedColumns };
    }

    const missingColumn = extractMissingProductsColumn(result.error.message);
    if (!missingColumn || !(missingColumn in current)) {
      return { ...result, strippedColumns };
    }

    strippedColumns.push(missingColumn);
    current = stripProductsColumn(current, missingColumn);
  }

  return {
    data: null,
    error: { message: "상품 등록 재시도 한도를 초과했습니다." },
    strippedColumns,
  };
}
