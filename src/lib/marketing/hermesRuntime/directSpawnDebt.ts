/**
 * Remaining direct Hermes spawn paths outside the unified Marketing launcher.
 * Phase 1 does not force-migrate acceptance/e2e scripts; keep this inventory
 * as debt so new production code does not add more copies.
 *
 * Production preference: `invokeMarketingHermesAgent` /
 * `invokeHermesProfileAsync` (compat wrapper).
 */

export type DirectHermesSpawnDebtEntry = {
  path: string;
  kind: "spawnSync" | "spawn" | "bot_oneshot";
  production: boolean;
  note: string;
};

export const MARKETING_HERMES_DIRECT_SPAWN_DEBT: readonly DirectHermesSpawnDebtEntry[] = [
  {
    path: "src/lib/marketing/bot/organization/hermesRuntime.ts",
    kind: "bot_oneshot",
    production: true,
    note: "Soft-result bot orchestrate; Phase 1 injects gateway token via shared spawn env only.",
  },
  {
    path: "src/lib/marketing/cron/hermesSpawnFailure.ts#spawnHermesProfileAsync",
    kind: "spawn",
    production: false,
    note: "Legacy low-level spawn retained for tests; cron/queue migrated to unified launcher.",
  },
  {
    path: "scripts/*acceptance* / *e2e* / *live* Hermes spawnSync helpers",
    kind: "spawnSync",
    production: false,
    note: "Acceptance/e2e script copies — migrate in a later phase.",
  },
];
