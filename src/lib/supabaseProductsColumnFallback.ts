/** PostgREST schema cache: "Could not find the 'optional_expenses' column of 'products' in the schema cache" */
export function extractMissingProductsColumn(message?: string): string | null {
  if (!message) return null;
  const match = message.match(/Could not find the '([^']+)' column of 'products'/i);
  return match?.[1] ?? null;
}

export function stripProductsColumn<T extends Record<string, unknown>>(payload: T, column: string): T {
  return Object.fromEntries(Object.entries(payload).filter(([key]) => key !== column)) as T;
}

type SupabaseMutationResult = {
  data: { id: string } | null;
  error: { message?: string } | null;
};

type ProductsMutator = (payload: Record<string, unknown>) => Promise<SupabaseMutationResult>;

async function mutateProductWithSchemaFallback(
  mutate: ProductsMutator,
  payload: Record<string, unknown>,
  maxRetries = 6,
): Promise<SupabaseMutationResult & { strippedColumns: string[] }> {
  let current = { ...payload };
  const strippedColumns: string[] = [];

  for (let attempt = 0; attempt < maxRetries; attempt += 1) {
    const result = await mutate(current);
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
    error: { message: "상품 저장 재시도 한도를 초과했습니다." },
    strippedColumns,
  };
}

/**
 * Inserts into products, stripping columns missing from the remote schema (migration not applied yet).
 */
export async function insertProductWithSchemaFallback(
  insert: ProductsMutator,
  payload: Record<string, unknown>,
  maxRetries = 6,
): Promise<SupabaseMutationResult & { strippedColumns: string[] }> {
  return mutateProductWithSchemaFallback(insert, payload, maxRetries);
}

/**
 * Updates products row, stripping columns missing from the remote schema (migration not applied yet).
 */
export async function updateProductWithSchemaFallback(
  update: ProductsMutator,
  payload: Record<string, unknown>,
  maxRetries = 6,
): Promise<SupabaseMutationResult & { strippedColumns: string[] }> {
  return mutateProductWithSchemaFallback(update, payload, maxRetries);
}

/** PATCH/insert 응답 warningCode 매핑 */
export function productSaveWarningCodeFromStrippedColumns(
  strippedColumns: string[],
): string | undefined {
  if (strippedColumns.length === 0) return undefined;
  if (strippedColumns.includes("departure_schedules_json")) {
    return "DEPARTURE_SCHEDULES_JSON_NOT_PERSISTED";
  }
  if (strippedColumns.includes("images_json")) {
    return "IMAGES_JSON_NOT_PERSISTED";
  }
  return "PRODUCT_COLUMNS_NOT_PERSISTED";
}
