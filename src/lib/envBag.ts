/**
 * Env bag accepted by config helpers that support test overrides.
 * Prefer this over bare `NodeJS.ProcessEnv` when callers pass partial fixtures —
 * Next.js augments ProcessEnv with required NODE_ENV, which breaks `{}` / `{ FLAG: "1" }` tests.
 * Does not loosen production `process.env` typing.
 */
export type EnvBag = NodeJS.ProcessEnv | Record<string, string | undefined>;
