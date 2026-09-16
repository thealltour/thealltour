#!/usr/bin/env node
/**
 * Vercel Ignored Build Step command.
 *
 * Semantics (Vercel):
 *   exit 0 → SKIP / cancel this deployment
 *   exit 1 → BUILD / continue deployment
 *
 * 2026-09: GitHub Actions runs `vercel build` + `vercel deploy --prebuilt --prod`.
 * Vercel Git-triggered builds must always SKIP to avoid duplicate CPU cost.
 *
 * Former behavior (diff relevance via vercelBuildRelevance.mjs / BUILD|SKIP by path)
 * intentionally removed — do not restore without revisiting the Actions deploy path.
 *
 * Configure via vercel.json ignoreCommand:
 *   "ignoreCommand": "node scripts/vercel-should-build.mjs"
 */

console.log("VERCEL_BUILD_DECISION=SKIP");
process.exit(0);
