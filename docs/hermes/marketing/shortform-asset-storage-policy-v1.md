# Shortform Asset Storage Policy v1 (SV-1)

Contract SoT (code):

- [`src/lib/marketing/assets/shortform/storagePolicy.ts`](../../src/lib/marketing/assets/shortform/storagePolicy.ts)
- optional probe: [`src/lib/marketing/assets/shortform/capacity.ts`](../../src/lib/marketing/assets/shortform/capacity.ts)

Related package layout SoT remains:

- [`src/lib/marketing/assets/config.ts`](../../src/lib/marketing/assets/config.ts) — `MARKETING_ASSET_ROOT` / `resolveMarketingAssetRoot()`
- [`src/lib/marketing/assets/paths.ts`](../../src/lib/marketing/assets/paths.ts)
- [`src/lib/marketing/assets/contracts.ts`](../../src/lib/marketing/assets/contracts.ts)
- media timeline: [zero-cost-media-timeline.md](./zero-cost-media-timeline.md)

## 1. Candidate Package remains production artifact SoT

Production artifacts stay under the **candidate HDD package**:

```text
{MARKETING_ASSET_ROOT}/{YYYY}/{MM}/{DD}/{candidateId}/
```

SV-1 does **not** replace this with a Global Asset Library.

## 2. Global Source Catalog (SV-2)

Identity / provenance / PICK catalog is documented in
[shortform-source-catalog-v1.md](./shortform-source-catalog-v1.md).
SV-1 does **not** implement the catalog; Candidate Package remains production SoT.

## 3. PICK ≠ INGEST

| Term | Meaning |
|------|---------|
| **PICK** | Choose a source for a candidate/scene. Does **not** imply permanent local binary. |
| **INGEST** | Commit a binary into TheAllTour local managed long-term storage. |
| **PIN** | Explicit indefinite local retention (blocks auto-delete). |

Helpers: `defaultDispositionForSource`, `impliesPermanentLocalBinary`.

## 4. External stock is not a permanent binary archive by default

`pexels` / `pixabay` default to:

- storage class: `external_ref`
- disposition: `pick_only`

Local binary permanence requires an explicit later ingest/pin decision (SV-2+).

## 5. Mini-PC workspace is ephemeral

Future render workers use an ephemeral bulk workspace (default path constant only in SV-1):

```text
/home/ysh/.cache/thealltour-shortform/
```

SV-1 does **not** create this directory.

## 6. `/tmp` is not bulk-media workspace

Mini-PC `/tmp` is typically **tmpfs**. Shortform bulk downloads / Remotion / FFmpeg intermediates must not use `/tmp` as the default workspace.

Existing short-lived package temps (e.g. `.preview.*.tmp.mp4`, atomic writes, font cache) are unchanged.

## 7. Pi HDD is long-term business asset storage

Pi `MARKETING_ASSET_ROOT` (documented production target `/mnt/HDD2TB/marketing-assets`) stores candidate packages and retained business artifacts — **not** a general internet stock dump.

Unset `MARKETING_ASSET_ROOT` remains **fail-closed** (no hardcoded runtime fallback).

## 8. Auto-delete allowlist (eligibility only)

Eligible classes after retention expiry (and not pinned / not protected source):

- `ephemeral`
- `candidate_preview`
- `unpublished_final`
- `generated_source` (when not pinned)

**SV-1 implements judgment only — no delete executor / sweeper.**

## 9. Never auto-delete

- `local_master`
- `published_final`
- manually pinned (`pin` / `pinned: true`)
- `own` / `partner` sources
- `unknown` source (fail-safe KEEP)
- `external_ref` (no local binary archive policy)

## 10. Pi pressure thresholds

| Level | Free ratio | Behavior (policy decision only) |
|-------|------------|----------------------------------|
| `normal` | ≥ 20% | all normal ops |
| `warning` | ≥ 15% and &lt; 20% | ops allowed; cleanup recommended |
| `pressure` | ≥ 10% and &lt; 15% | optional ingest / non-essential persistent writes blocked; cleanup recommended |
| `protected` | &lt; 10% | same blocks; cleanup required before optional work; **never** auto-delete published/own/partner/pinned |

Evaluator: `evaluateStoragePressure({ totalBytes, freeBytes })`.

## 11. Worker workspace thresholds

| Rule | Value |
|------|-------|
| Workspace budget | 40 GiB |
| Cleanup when root free | &lt; 100 GiB |
| Block NEW job claims | &lt; 75 GiB |

Evaluator: `evaluateShortformWorkerStorage(...)` → `READY` / `CLEANUP_REQUIRED` / `BLOCK_NEW_JOB`.

## 12. Future multi-worker compatibility

Policy inputs are **capacity stats only** (root free, workspace used). No CPU/GPU vendor, hostname, or VAAPI/QSV assumptions in SV-1.

## Version ids

- `shortform-storage-policy-v1`
- `shortform-retention-policy-v1`
