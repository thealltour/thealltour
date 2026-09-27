# Cross-fixture regression — fixture policy

This document defines how production-backed regression fixtures are selected,
described, and maintained. It is **test/support policy only**. It does not
change Canonical Writer, Narrative Planner, channel workers, Natural Korean
contracts, prompts, schemas, renderers, or publish behavior.

## What a fixture is

A regression fixture represents:

1. a real **approved** Canonical package
2. its editorial / business **archetype**
3. the **behaviors** that must survive downstream generation

Fixtures are **not** defined primarily by banned words. Words may appear as
diagnostic markers only.

## Required fixture metadata

Each production-backed fixture must declare:

| Field | Purpose |
| --- | --- |
| `fixtureId` | Stable harness id |
| `packageRoot` / `assetId` | Production package binding |
| Canonical status | Must be `approved` (+ version gate) |
| `editorialArchetype` | e.g. contrast / null |
| `commercialIntent` | e.g. informational |
| `role` | Fixture role (discovery_contrast, decision_comparison, …) |
| `supportedFacts` | Facts that should survive |
| `limitations` | Evidence boundaries that must not evaporate |
| `expectedBehaviors` | Behavior-based expectations |
| `prohibitedRegressions` | Behavioral regressions to flag |
| `channelsToTest` | Narrative, Threads, IG*, Blog*, Band, Kakao, Shortform |
| `backing` | `production_backed` only when Canonical is approved |

Unpopulated future slots use `backing: "unpopulated_slot"` and must not be
verified as production fixtures.

Synthetic examples may live in unit tests (`synthetic_unit_only`) and must stay
clearly separated from production-backed fixtures.

## Behavior expectation model

### Good expectations (behavior-based)

- preserves supported decision criteria
- does not invent reader transformation
- CTA optional for informational discovery
- commercial CTA survives when supported
- geographic scope is preserved
- evidence limitations survive compression
- strong supported hook remains possible
- Natural Korean does not become translationese
- planner language does not leak directly into surface copy
- decision topic language is not mistaken for CTA
- unauthorized imperative CTA still blocked

### Bad expectations (do not use as primary pass/fail)

- word "기준" must never appear
- word "시선" must never appear
- word "남부" must never appear

## Layers of regression

| Level | Scope | Examples |
| --- | --- | --- |
| **LEVEL 1** | Deterministic / unit | forced CTA detection, geo helpers, schema/materialization, artifact authority |
| **LEVEL 2** | Worker contract regression | archetype-aware closing, CTA optionality, semantic-vs-surface boundary |
| **LEVEL 3** | Production-backed cross-fixture | Dao, Phu Quoc, future approved fixtures |

Do **not** duplicate every unit test inside the LEVEL 3 harness.

## Automated vs manual

Automate only reliable checks:

- artifact existence
- freshness (`generatedAt`, optional max age)
- required structural fields / materialization
- `publishableSuccess` when present
- fingerprint consistency when present
- eligibility (approved Canonical only)

Keep semantic evaluation **manual / report-assisted**:

- forced abstract synthesis
- Natural Korean quality
- archetype fit
- factual strengthening
- planner vocabulary leakage
- hook quality

A stale or missing artifact must **not** receive a content PASS
(`style` / `archetypeFit` / `evidence` become `BLOCKED`).

## Result categories

`PASS` | `PASS_WITH_MINOR` | `FAIL` | `UNTESTED` | `BLOCKED`

Prefer separate dimensions: style, archetypeFit, evidence, materialization,
freshness → overall.

## Baseline policy

- Do **not** snapshot full generated prose as exact golden text.
- Baseline **stable behavior**: authority, schema, supported semantic outcome,
  evidence boundary, archetype behavior, CTA policy, materialization success.
- Exact-string goldens are appropriate only for deterministic helpers (LEVEL 1).
- A failing production artifact must **not** silently redefine the baseline.
- MINOR prose wording is not immutable text.

## Adding a new production fixture

1. An **approved** Canonical exists (do not promote drafts merely for coverage).
2. Identify role / archetype.
3. Record supported facts and limitations.
4. Define expected behaviors + prohibited regressions.
5. Run a first clean generation and **manually review**.
6. Register the fixture in `fixtureManifest.ts`.
7. Future regressions compare **behaviorally**, not by exact prose.

## Future fixture slots (UNPOPULATED until approved Canonical exists)

- practical / informational
- commercial / conversion
- supported-region / geo-sensitive
- optionally strong-dramatic-hook

Do not fabricate production Canonicals for harness coverage.

## Harness modes

```bash
npx tsx scripts/cross-fixture-regression.ts inventory
npx tsx scripts/cross-fixture-regression.ts verify
npx tsx scripts/cross-fixture-regression.ts report
npx tsx scripts/cross-fixture-regression.ts regenerate <fixtureId>
npx tsx scripts/cross-fixture-regression.ts regenerate-all
```

`regenerate*` documents operator steps and does **not** invoke production
writers from the harness. After live regen, re-run `verify` / `report`.

## Initial registered fixtures

See `fixtureManifest.ts`:

- `dao-northern-border-contrast` — discovery / cultural / contrast
- `phuquoc-hotel-booking-vs-wait` — decision / comparison
