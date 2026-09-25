/**
 * One-shot: Dao live SVP cross-card differentiation regen (VRA reuse + fresh SVP + Astra).
 * Usage: npx tsx scripts/dao-svp-cross-card-diff-live-regen.ts
 */
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";

import { invokeHermesProfileAsync } from "@/lib/marketing/cron/invokeHermesProfileAsync";
import { readCanonicalAssetFromPackage } from "@/lib/marketing/canonicalAsset/persistence";
import { isApprovedCanonicalAsset } from "@/lib/marketing/canonicalAsset/validateCanonicalMarketingAsset";
import {
  PUBLISHABLE_CONTENT_BUNDLE_CONTRACT,
  type PublishableContentBundle,
} from "@/lib/marketing/publishable/contracts";
import { PUBLISHABLE_CONTENT_RELATIVE_PATH } from "@/lib/marketing/publishable/paths";
import { readInstagramVisualRolePlanFromPackage } from "@/lib/marketing/publishable/instagramVisualRole/persist";
import { generateSharedVisualPlanWithLlm } from "@/lib/marketing/publishable/visualOrchestration/generateSharedVisualPlan";
import { generateManualAstraHandoffWithLlm } from "@/lib/marketing/publishable/visualOrchestration/generateManualAstraHandoff";
import {
  ensureSharedVisualPlannerHermesReady,
  ensureAstraHandoffWriterHermesReady,
  SHARED_VISUAL_PLANNER_HERMES_PROFILE,
  ASTRA_HANDOFF_WRITER_HERMES_PROFILE,
} from "@/lib/marketing/publishable/visualOrchestration/hermesIdentity";
import { readSharedVisualPlan } from "@/lib/marketing/publishable/sharedVisualPlan";
import { resolveSharedVisualPlanLifecycle } from "@/lib/marketing/publishable/visualOrchestration/lifecycle";
import { approvedAssetToManualAstraContext } from "@/lib/marketing/publishable/refreshDerivedVisualArtifacts";
import { buildInstagramVisualRoleContentFingerprint } from "@/lib/marketing/publishable/instagramVisualRole/fingerprint";

const PKG =
  process.env.DAO_PACKAGE_ROOT ??
  "/mnt/HDD2TB/marketing-assets/2026/09/18/cmc_daily_marketing_production_2026_09_18_e0";
const TIMEOUT_MS = Number(process.env.HERMES_TIMEOUT_MS ?? 360_000);

function readBundle(packageRoot: string): PublishableContentBundle {
  const raw = JSON.parse(
    readFileSync(join(packageRoot, PUBLISHABLE_CONTENT_RELATIVE_PATH), "utf8"),
  ) as PublishableContentBundle;
  if (raw.contract !== PUBLISHABLE_CONTENT_BUNDLE_CONTRACT) throw new Error("bad_bundle");
  return raw;
}

async function main() {
  ensureSharedVisualPlannerHermesReady();
  ensureAstraHandoffWriterHermesReady();

  const vra = readInstagramVisualRolePlanFromPackage(PKG);
  if (!vra) throw new Error("VRA missing — cannot reuse");
  console.log(
    "VRA reused:",
    vra.cards.map((c) => `${c.cardId}/${c.visualRole}/${c.visualModePreference}`).join(" | "),
  );

  const asset = readCanonicalAssetFromPackage(PKG);
  if (!asset || !isApprovedCanonicalAsset(asset)) throw new Error("canonical missing/not approved");
  const bundle = readBundle(PKG);

  console.log("→ SVP fresh generate…");
  const svp = await generateSharedVisualPlanWithLlm({
    packageRoot: PKG,
    bundle,
    approvedCanonicalAsset: asset,
    skipVisualRoleArchitect: true,
    invoke: (prompt) =>
      invokeHermesProfileAsync(SHARED_VISUAL_PLANNER_HERMES_PROFILE, prompt, TIMEOUT_MS),
  });
  if (!svp.ok) throw new Error(`SVP fail: ${svp.error.code} ${svp.error.message}`);
  console.log("visualRolePlanStatus:", svp.visualRolePlanStatus);
  console.log("masters:", svp.plan.visuals.length);
  console.log("strategySummary:", (svp.plan.strategySummary ?? "").slice(0, 600));
  console.log("decisionTrace:", JSON.stringify(svp.plan.decisionTrace ?? null, null, 2));

  const byCard: Record<
    string,
    { visualId: string; role: string; mode: string | null; intent: string }
  > = {};
  for (const v of svp.plan.visuals) {
    for (const u of v.usages) {
      if (u.channel === "instagram" && u.cardId) {
        byCard[u.cardId] = {
          visualId: v.visualId,
          role: v.role,
          mode: v.visualMode ?? null,
          intent: v.visualIntent,
        };
      }
    }
    console.log(
      `- ${v.visualId} role=${v.role} mode=${v.visualMode ?? "-"} gen=${v.generatedVisualNeeded} usages=${JSON.stringify(v.usages)}`,
    );
    console.log(`  intent: ${v.visualIntent}`);
  }

  const plan = readSharedVisualPlan(PKG)!;
  const vraFp = buildInstagramVisualRoleContentFingerprint(vra);
  const planLifecycle = resolveSharedVisualPlanLifecycle({
    plan,
    bundle,
    currentInstagramVisualRoleFingerprint: vraFp,
  });
  console.log("planLifecycle:", planLifecycle);
  console.log("plan.sourceInstagramVisualRoleFingerprint:", plan.sourceInstagramVisualRoleFingerprint);
  console.log("current vraFp:", vraFp);

  console.log("→ Astra handoff fresh…");
  const astra = await generateManualAstraHandoffWithLlm({
    packageRoot: PKG,
    plan,
    planFresh: planLifecycle === "fresh",
    approvedAssetContext: approvedAssetToManualAstraContext(asset),
    invoke: (prompt) =>
      invokeHermesProfileAsync(ASTRA_HANDOFF_WRITER_HERMES_PROFILE, prompt, TIMEOUT_MS),
  });
  if (!astra.ok) throw new Error(`Astra fail: ${astra.error.code} ${astra.error.message}`);

  const a02 = astra.handoff.visuals.find((v) => v.visualId === byCard["card-02"]?.visualId);
  const a03 = astra.handoff.visuals.find((v) => v.visualId === byCard["card-03"]?.visualId);
  console.log("\n=== Astra VISUAL 02 ===");
  console.log(a02?.visualIntent);
  console.log("\n=== Astra VISUAL 03 ===");
  console.log(a03?.visualIntent);

  mkdirSync(join(process.cwd(), "artifacts"), { recursive: true });
  const reportPath = join(process.cwd(), "artifacts", "svp-cross-card-diff-dao-live.json");
  writeFileSync(
    reportPath,
    JSON.stringify(
      {
        packageRoot: PKG,
        vraReuse: true,
        vra: vra.cards.map((c) => ({
          cardId: c.cardId,
          visualRole: c.visualRole,
          visualModePreference: c.visualModePreference,
          concreteVisualIntent: c.concreteVisualIntent,
        })),
        svp: {
          masterCount: svp.plan.visuals.length,
          strategySummary: svp.plan.strategySummary,
          decisionTrace: svp.plan.decisionTrace ?? null,
          byCard,
          visuals: svp.plan.visuals,
        },
        astra: {
          visualCount: astra.handoff.visualCount,
          card02: a02
            ? { visualId: a02.visualId, role: a02.role, visualIntent: a02.visualIntent }
            : null,
          card03: a03
            ? { visualId: a03.visualId, role: a03.role, visualIntent: a03.visualIntent }
            : null,
        },
      },
      null,
      2,
    ),
    "utf8",
  );
  console.log("report:", reportPath);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
