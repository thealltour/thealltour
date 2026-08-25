/** Injectable DB client shape for SupabaseSocialRepository (no server-only import). */

export type SocialDbResult = {
  data: unknown;
  error: { message: string; code?: string } | null;
};

export type SocialDbQuery = {
  select(columns?: string): SocialDbQuery;
  insert(values: Record<string, unknown> | Record<string, unknown>[]): SocialDbQuery;
  update(values: Record<string, unknown>): SocialDbQuery;
  upsert(
    values: Record<string, unknown>,
    options?: { onConflict?: string },
  ): SocialDbQuery;
  eq(column: string, value: unknown): SocialDbQuery;
  is(column: string, value: null): SocialDbQuery;
  gte(column: string, value: string): SocialDbQuery;
  lte(column: string, value: string): SocialDbQuery;
  order(column: string, options?: { ascending?: boolean }): SocialDbQuery;
  limit(count: number): SocialDbQuery;
  maybeSingle(): PromiseLike<SocialDbResult>;
  single(): PromiseLike<SocialDbResult>;
  then: PromiseLike<SocialDbResult>["then"];
};

export type SocialDbClient = {
  from(table: string): SocialDbQuery;
};
