/**
 * One-shot: create formal validation manifest if absent.
 * Does not overwrite an existing matching/mismatched manifest.
 */
import { execSync } from "node:child_process";
import { loadLocalEnv } from "./loadLocalEnv";
import {
  assertFormalValidationConfigMatchesKnownFreeze,
  fingerprintAgendaQualityV2ValidationConfig,
  snapshotAgendaQualityV2ValidationSensitiveConfig,
  writeValidationManifestIfAbsent,
} from "@/lib/marketing/agendaQualityV2/shadow/validationManifest";

async function main() {
  loadLocalEnv();
  const freeze = assertFormalValidationConfigMatchesKnownFreeze();
  if (!freeze.ok) {
    console.error("DRIFT_BEFORE_FORMAL_VALIDATION", freeze.driftFields);
    process.exit(2);
  }
  const gitHead = execSync("git rev-parse HEAD", { encoding: "utf8" }).trim();
  const dirty = execSync("git status --porcelain", { encoding: "utf8" }).trim().length > 0;
  const result = await writeValidationManifestIfAbsent({
    cwd: process.cwd(),
    createdAt: new Date().toISOString(),
    gitHead,
    workingTreeDirty: dirty,
    env: process.env as Record<string, string | undefined>,
  });
  const fp = fingerprintAgendaQualityV2ValidationConfig(
    snapshotAgendaQualityV2ValidationSensitiveConfig(
      process.env as Record<string, string | undefined>,
    ),
  );
  console.log(
    JSON.stringify(
      {
        freeze: "ok",
        write: result.status,
        path: result.path,
        fingerprint: fp,
        validationId:
          result.status === "mismatch"
            ? result.existing.validationId
            : result.manifest.validationId,
        driftFields: result.status === "mismatch" ? result.driftFields : [],
        shadowEnabled:
          result.status === "mismatch"
            ? result.existing.featureFlags.AGENDA_QUALITY_V2_SHADOW_ENABLED
            : result.manifest.featureFlags.AGENDA_QUALITY_V2_SHADOW_ENABLED,
      },
      null,
      2,
    ),
  );
  if (result.status === "mismatch") process.exit(3);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
