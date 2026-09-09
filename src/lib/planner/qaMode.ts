/**
 * Planner QA Mode — server/runtime gate only.
 * Never enable on production deployments even if PLANNER_QA_MODE is accidentally true.
 */

export function isPlannerQaModeEnabled(
  env: NodeJS.ProcessEnv = process.env,
): boolean {
  const vercelEnv = (env.VERCEL_ENV ?? "").trim().toLowerCase();
  const nodeEnv = (env.NODE_ENV ?? "").trim().toLowerCase();

  // Hard block: Vercel production
  if (vercelEnv === "production") return false;

  // Hard block: NODE_ENV production outside preview (local prod builds / non-Vercel)
  if (nodeEnv === "production" && vercelEnv !== "preview") return false;

  const raw = (env.PLANNER_QA_MODE ?? "").trim().toLowerCase();
  return raw === "true" || raw === "1";
}
