/** Injectable DB client shape for SupabaseResearchRepository (no server-only import). */

export type ResearchDbResult = {
  data: unknown;
  error: { message: string; code?: string } | null;
};

export type ResearchDbQuery = {
  select(columns?: string): ResearchDbQuery;
  insert(values: Record<string, unknown> | Record<string, unknown>[]): ResearchDbQuery;
  update(values: Record<string, unknown>): ResearchDbQuery;
  upsert(
    values: Record<string, unknown> | Record<string, unknown>[],
    options?: { onConflict?: string },
  ): ResearchDbQuery;
  delete(): ResearchDbQuery;
  eq(column: string, value: unknown): ResearchDbQuery;
  in(column: string, values: unknown[]): ResearchDbQuery;
  gte(column: string, value: string): ResearchDbQuery;
  order(column: string, options?: { ascending?: boolean }): ResearchDbQuery;
  limit(count: number): ResearchDbQuery;
  maybeSingle(): PromiseLike<ResearchDbResult>;
  single(): PromiseLike<ResearchDbResult>;
  then: PromiseLike<ResearchDbResult>["then"];
};

export type ResearchDbClient = {
  from(table: string): ResearchDbQuery;
};
