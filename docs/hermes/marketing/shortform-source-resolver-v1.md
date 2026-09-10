# Shortform Source Resolver v1 (SV-4)

Contract SoT:

- [`src/lib/marketing/assets/shortform/resolver/`](../../src/lib/marketing/assets/shortform/resolver/)
- plan artifact: `context/shortform-source-resolution.json` (explicit persist only)

Depends on:

- SV-1 storage policy
- SV-2 Global Source Catalog (repository injection; migration still **not applied** in this step)
- SV-3 `ShortVideoBrief` / `ShortVideoSceneRequirement`

## Ladder

```text
Internal Catalog
  → Pexels (search only)
  → Pixabay (search only + mandatory ≥24h cache)
  → Photo Motion (plan mode over image)
  → Generated Video Plan (Fal plan only — no paid call)
```

## Resolve ≠ Pick ≠ Ingest

| Step | Meaning |
|------|---------|
| **Resolve** | Discover, filter, score, recommend candidates |
| **Pick** | Explicit `recordPick` on SV-2 usages (not auto-written by resolver) |
| **Ingest** | Later commit of binary / catalog registration |

Search candidates are **transient**. Resolver does **not** bulk-insert API results into `marketing_media_sources`.

## Safety

- `factualVisualRequired=true` → generated plan forbidden; generic/unknown factual match cannot auto-pick
- `rightsKind=unknown` → never auto-pick
- Provider failure is isolated (`disabled` / `error` / `unavailable` / `empty`); ladder continues
- Missing `PEXELS_API_KEY` / `PIXABAY_API_KEY` → provider `disabled`, not fatal
- Pixabay without compliant `SourceSearchCache` → `disabled` (no uncached production client)

## Scoring

Deterministic 0..1 score with breakdown (`relevance`, `mediaFit`, `orientationFit`, `durationFit`, `provenance`, `reuseBonus`).
Thresholds: `SHORTFORM_RESOLVER_AUTO_PICK_MIN_SCORE`, `SHORTFORM_RESOLVER_REVIEW_MIN_SCORE`.

## Credentials (names only)

```text
PEXELS_API_KEY
PIXABAY_API_KEY
SHORTFORM_SOURCE_SEARCH_CACHE_DIR  # optional Pixabay/search metadata cache root
```

## Out of scope

Download, ingest, actual Fal generation, Remotion, VideoRenderJob, Mini-PC worker, picker UI, production queue, OBS spans.
