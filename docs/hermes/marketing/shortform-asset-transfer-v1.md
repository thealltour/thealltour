# Shortform Private Asset Transfer (SV-8B2)

## Purpose

Mini-PC must **not** mount Hermes-Pi `/mnt/HDD2TB/marketing-assets`.
Instead, a private authenticated Asset Transfer API on Pi moves only:

1. **Managed source bytes** (catalog `sourceId` → content stream)
2. **Final shortform** (`reel/final/shortform.mp4` into Candidate Package)

NFS / SMB / sshfs are not used. SSH/SCP/rsync remain operational fallbacks only.

## Topology

```text
Hermes-Pi  MARKETING_ASSET_ROOT
        │  Private Asset Transfer API (Tailscale + Bearer)
        ├──── GET managed-sources/{id}/content ──▶ Mini-PC workspace
        ◀──── PUT candidates/{id}/shortform-final ─┤
                                                   Remotion / FFmpeg / VoiceStudio
```

## Transport abstraction

| Symbol | Role |
|--------|------|
| `MarketingAssetTransport` | `materializeManagedSource` / `persistShortformFinal` / `probeReadiness` |
| `LocalMarketingAssetTransport` | same-host / tests |
| `HttpMarketingAssetTransport` | Mini-PC production client |
| `ProductionShortformVideoRenderExecutor` | transport-agnostic |

Runtime mode: `MARKETING_ASSET_TRANSPORT_MODE=local|http`  
Unset defaults to `local` (fail-closed without `MARKETING_ASSET_ROOT`).  
Invalid mode fails readiness — worker must not invent local paths.

## Pi API (no CORS, no browser)

| Method | Path | Auth |
|--------|------|------|
| `GET` | `/health` | none |
| `GET` | `/v1/managed-sources/:sourceId/content` | Bearer |
| `GET` | `/v1/candidates/:candidateId/artifacts/:artifactKind?businessDateKst=YYYY-MM-DD` | Bearer |
| `PUT` | `/v1/candidates/:candidateId/shortform-final?businessDateKst=YYYY-MM-DD` | Bearer |

Allowlisted `artifactKind` values (no client paths):

| kind | package-relative path |
|------|------------------------|
| `media-brief` | `context/media-brief.json` |
| `short-video-brief` | `context/short-video-brief.json` |
| `shortform-source-resolution` | `context/shortform-source-resolution.json` |

Client never sends filesystem paths. Pi resolves business ids → canonical relative paths → `MARKETING_ASSET_ROOT`.

Final path is fixed: `reel/final/shortform.mp4` (existing `writePackageArtifact` + manifest/sha256).

## Env (names only — values in `.env.local`)

- `MARKETING_ASSET_TRANSPORT_MODE`
- `MARKETING_ASSET_TRANSFER_TOKEN`
- `MARKETING_ASSET_TRANSFER_BASE_URL` (Mini-PC client)
- `MARKETING_ASSET_TRANSFER_BIND_HOST` / `MARKETING_ASSET_TRANSFER_PORT` (Pi server; default loopback)

## Process

```bash
npm run marketing:asset-transfer
```

Unit asset (not installed in this step):

`deploy/systemd/thealltour-marketing-asset-transfer.service`

WorkingDirectory: `/home/ysh/thealltour`

## Out of scope (SV-8B2)

Mini-PC deploy, Pi service install/start, Tailscale mutation, migrations, live render, Fal/BGM/OBS/publication.
Generic filesystem API (`?path=` / arbitrary relativePath) is **not** included.
