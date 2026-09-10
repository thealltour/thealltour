# Shortform Human Source Review / Explicit Pick (SV-5)

## Scope

Admin workflow on Candidate Human Review detail:

1. Resolve shortform source candidates (search + score)
2. Preview remote/internal metadata
3. Explicit human PICK

Does **not** download stock binaries, call Fal, render Remotion, approve Human Review, or publish.

## Trust boundary

Resolve responses include an opaque HMAC `selectionToken`.

- PICK body: `{ sceneId, selectionToken }` only
- Server verifies signature + expiry + candidate/scene binding
- Client-supplied rights/provider/URL fields are **not** trusted

Signing secret (first match):

- `SHORTFORM_CANDIDATE_SELECTION_SECRET`
- `MEMBER_SESSION_SECRET`
- `ADMIN_SESSION_SECRET`

## APIs

- `POST /api/admin/marketing-review/[candidateId]/shortform/sources/resolve`
- `POST /api/admin/marketing-review/[candidateId]/shortform/sources/pick`

Auth: `settings.manage`

Missing `context/short-video-brief.json` → `409 SHORT_VIDEO_BRIEF_REQUIRED` (does not auto-build pipeline).

## PICK semantics

| Origin | Behavior |
|--------|----------|
| internal_catalog | `setScenePick` on existing catalog id |
| pexels / pixabay / photo_motion | `registerExternalSource(external_ref)` then `setScenePick` |
| generated_video_plan | rejected |
| rights=unknown | rejected (human click does not bypass) |

External PICK keeps `managedRelativePath = null` and `storageClass = external_ref`.

Scene replace uses repository `setScenePick` (delete usages for candidate+scene, then insert) — no migration.

## UI policy (v1)

- Every PICK requires an explicit click (`autoPickEligible` is display-only)
- No auto-commit on resolve load
- No binary ingest buttons
- Generated fallback: status only / disabled generate control
- Factual scenes: generation option not offered as actionable generate

## Catalog migration

Persistent PICK requires SV-2 migration applied separately.
Code acceptance does not apply the migration.
When tables are missing, APIs return admin-safe `CATALOG_UNAVAILABLE` rather than raw DB dumps.
