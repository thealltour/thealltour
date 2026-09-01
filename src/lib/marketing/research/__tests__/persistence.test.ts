import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const MIGRATION_PATH = resolve(
  process.cwd(),
  "supabase/migrations/20260902101500_research_intelligence_schema.sql",
);

const RESEARCH_TABLES = [
  "research_sources",
  "research_signals",
  "research_evidence",
  "research_briefs",
  "research_brief_signals",
  "agenda_candidates",
] as const;

describe("research persistence migration", () => {
  const migrationSql = readFileSync(MIGRATION_PATH, "utf8");

  it("creates expected tables without credentials", () => {
    for (const table of RESEARCH_TABLES) {
      expect(migrationSql).toContain(`create table if not exists public.${table}`);
    }
    expect(migrationSql.toLowerCase()).not.toMatch(/insert\s+into/);
    expect(migrationSql).not.toMatch(/access_token/i);
    expect(migrationSql).not.toMatch(/refresh_token/i);
    expect(migrationSql).not.toMatch(/client_secret/i);
  });

  it("defines dedup indexes and FK ordering", () => {
    expect(migrationSql).toContain("idx_research_signals_raw_fingerprint");
    expect(migrationSql).toContain("idx_research_signals_normalized_fingerprint");
    expect(migrationSql).toContain("idx_research_signals_source_external_id");
    expect(migrationSql.indexOf("research_sources")).toBeLessThan(
      migrationSql.indexOf("research_signals"),
    );
    expect(migrationSql.indexOf("research_signals")).toBeLessThan(
      migrationSql.indexOf("research_evidence"),
    );
  });

  it("enables service_role-only RLS policies", () => {
    for (const table of RESEARCH_TABLES) {
      expect(migrationSql).toContain(`alter table public.${table} enable row level security`);
      expect(migrationSql).toContain(`revoke all on public.${table} from anon, authenticated`);
    }
    expect(migrationSql).toContain("service_role_all_research_signals");
  });
});
