# Server domain services vs `src/lib`

## Rule (new code)

- **New domain write/read services** that are only used from API routes / server components belong in `src/server/services/<domain>/`.
- Existing logic in `src/lib/**` stays put. When a file is touched for behavior work, prefer extracting a thin service only if it reduces route bloat — **do not bulk-move** `src/lib` → `src/server/services`.

## Current examples

| Location | Domains |
|----------|---------|
| `src/server/services/rewards/` | redemptions, member points |
| `src/server/services/points/` | earn requests, grant |
| `src/lib/adminChat/` | admin team chat (server-only modules) |
| `src/lib/adminBanners/`, `src/lib/adminNotices/` | thin repositories for CRUD routes |

## Route handlers

API `route.ts` files should stay thin: auth → validate → service/repository → `jsonOk` / `jsonError` from `@/lib/api/response`.

Do **not** migrate responses to `jsonStructuredError` unless the client already expects `{ ok, code, retryable }`.
