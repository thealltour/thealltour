/**
 * One-shot: sync media-brief.targetChannels from publishable for Dao fixture.
 */
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

import { applyPublishableContentToMediaBrief } from "../src/lib/marketing/publishable/applyToMediaBrief";
import { parseMediaBrief } from "../src/lib/marketing/assets/parse";
import type { PublishableContentBundle } from "../src/lib/marketing/publishable/contracts";

const root =
  process.argv[2] ??
  "/mnt/HDD2TB/marketing-assets/2026/09/18/cmc_daily_marketing_production_2026_09_18_e0";

const brief = parseMediaBrief(
  JSON.parse(readFileSync(join(root, "context/media-brief.json"), "utf8")),
);
const bundle = JSON.parse(
  readFileSync(join(root, "context/publishable-content.json"), "utf8"),
) as PublishableContentBundle;
const updated = applyPublishableContentToMediaBrief(brief, bundle);
writeFileSync(join(root, "context/media-brief.json"), `${JSON.stringify(updated, null, 2)}\n`);
console.log(JSON.stringify({ before: brief.targetChannels, after: updated.targetChannels }, null, 2));
