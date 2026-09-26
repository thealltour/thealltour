# WSL2 build / test verification (not Pi deploy)

Pi에서 `npm run build`로 타입 에러 하나를 확인하는 데 수십 분이 걸릴 수 있습니다.  
이 문서는 **Windows 11 + WSL2**에서 hermes-pi working tree를 받아 **검증만** 하는 흐름을 설명합니다.

**Pi에서 WSL 검증을 SSH로 호출하려면:** [WSL_REMOTE_VERIFICATION.md](./WSL_REMOTE_VERIFICATION.md) · `./scripts/verify-on-wsl.sh --fast`

**하지 않는 것:** `.next` / `node_modules`를 Pi로 배포, systemd 변경, standalone, Docker production runtime.

## Prerequisites

1. Windows 11에서 WSL2 + Ubuntu 계열 배포판
2. Node **22** (`.nvmrc`와 동일; Pi production Hermes Node 22 major에 맞춤)  
   - 참고: `package.json` `engines`는 `24.x`로 적혀 있어 드리프트가 있습니다. 검증 머신도 **22**를 권장합니다.
3. `rsync`, `openssh-client`
4. Pi에 SSH 키 로그인 (`ssh hermes-pi` 등)

```bash
# WSL
curl -fsSL https://raw.githubusercontent.com/nvm-sh/nvm/v0.40.1/install.sh | bash
nvm install 22
nvm use
node -v   # v22.x
```

## Config

```bash
cp scripts/verify-local.env.example ~/.config/thealltour-verify.env
# edit HERMES_PI_HOST, HERMES_PI_PATH, HERMES_BUILD_WORKSPACE
```

또는 워크스페이스/홈에 `.env.verify-local` (`.env*`라 gitignore됨):

| Variable | Meaning |
|----------|---------|
| `HERMES_PI_HOST` | SSH host (`hermes-pi` or `ysh@192.168.…`) |
| `HERMES_PI_PATH` | Pi repo (`/home/ysh/thealltour`) |
| `HERMES_BUILD_WORKSPACE` | **WSL 전용** 절대 경로. 이름에 `thealltour` / `verify` / `build-workspace` 포함 필수 |

예:

```bash
export HERMES_PI_HOST=hermes-pi
export HERMES_PI_PATH=/home/ysh/thealltour
export HERMES_BUILD_WORKSPACE=/home/you/thealltour-verify
```

선택: workspace에 `.env.build-test` (Pi `.env.local` 전체 rsync 금지). 템플릿: `scripts/env.build-test.example`.

**금지:** `example.supabase.co`가 박힌 WSL `.next`를 Pi로 rsync. Edge middleware가 ENOTFOUND → Internal Server Error가 됩니다.  
배포용 빌드: Pi에서 `./scripts/deploy-internal-next-from-wsl.sh` (실 `.env.local`로 WSL 빌드 → 가드 → `.next`만 설치 → restart).


## Commands

Repo(또는 sync된 workspace)에서:

```bash
# 빠른 검증: sync → deps → tsc → tests
./scripts/verify-from-pi.sh --fast

# 전체: + npm run build
./scripts/verify-from-pi.sh --build

# sync만 dry-run
./scripts/verify-from-pi.sh --dry-sync

# 이미 sync된 workspace에서 반복
./scripts/verify-from-pi.sh --skip-sync --fast

./scripts/verify-from-pi.sh --build --skip-tests
./scripts/verify-from-pi.sh --fast --test visualOrchestration
```

성공 시 요약 예:

```
SYNC: PASS (4s)
DEPENDENCIES: PASS (skipped npm ci)
TYPECHECK: PASS (12s)
TESTS: PASS (38s)
NEXT BUILD: SKIP (--fast)
```

typecheck 실패 시 tests/build는 실행하지 않습니다.

## Cursor 작업 후 권장 순서

1. Cursor가 **Pi** working tree 수정 (uncommitted 포함)
2. WSL: `./scripts/verify-from-pi.sh --fast`
3. 통과 후: `./scripts/verify-from-pi.sh --build`
4. 성공하면 Pi 배포는 **verify `.next`를 그대로 쓰지 말 것**.  
   - 배포: `./scripts/deploy-internal-next-from-wsl.sh` (실 env 빌드 + placeholder 가드 + restart)  
   - 또는 on-Pi `npm run build` 후 `./scripts/restart-thealltour-internal.sh`  
   (`verify-from-pi.sh` / `verify-on-wsl.sh`는 Pi에 artifact를 보내지 않음)


## Sync excludes

rsync는 다음을 **복사하지 않습니다:**

- `node_modules/`, `.next/`, `.git/`
- `.env.local`, `.env.verify-local`
- logs, coverage, turbo/cache, `*.tsbuildinfo`

각 머신에서 `npm ci`로 **독립** native deps를 유지합니다 (WSL x86_64 vs Pi arm64).

## Destination safety

`--delete`는 `HERMES_BUILD_WORKSPACE`에만 적용됩니다.  
Pi production path(`/home/ysh/thealltour`)나 `/`, `/home` 등은 abort합니다.

## Build-time env audit (요약)

| 구분 | 내용 |
|------|------|
| `next.config.ts` | build 시 secret hard-require 없음 (`ANALYZE`만 선택) |
| Auth providers | lazy `requiredEnv` — import만으로는 build fail 드묾 |
| 권장 WSL | `.env.build-test`에는 Supabase placeholder를 넣지 말 것 (또는 verify가 skip). 배포 빌드는 workspace `.env.local` |
| 금지 | Pi `.env.local` 전체를 verify sync로 밀어넣기; placeholder `.next`를 Pi에 rsync |
| 가드 | `scripts/assert-next-build-not-placeholder.sh` — `example.supabase.co` 등이 `.next`에 있으면 deploy/restart 거부 |

## Native caveats

- WSL build의 `sharp`는 linux-x86_64; Pi는 linux-arm64. **서로 복사하지 말 것.**
- 이 workflow는 WSL에서 compile/test **성공 여부만** 확인합니다.
- WSL과 Pi가 갈릴 수 있는 예: optional native addon, arch-specific optional deps, env 부재로 인한 조건부 경로.

## Troubleshooting

| 증상 | 조치 |
|------|------|
| `HERMES_PI_HOST is required` | env / `.env.verify-local` 설정 |
| destination guard abort | workspace 경로에 `verify` 등 포함, Pi path 금지 |
| SSH permission denied | `ssh-copy-id` / `~/.ssh/config` |
| Node major mismatch warning | `nvm use` / `.nvmrc` 22 |
| typecheck FAIL | build 전에 수정; Pi에서 40분 build 돌리지 말 것 |
| npm ci 매번 돈다 | `package-lock.json` 변경 또는 `node_modules` 삭제됨 — 정상 |

## Smoke checklist (scripts)

- [ ] sync excludes `node_modules` / `.next` / `.git` (rsync list / dry-run)
- [ ] destination guard rejects `/home/ysh/thealltour` and `/`
- [ ] lock unchanged → `DEPENDENCIES: PASS (skipped npm ci)`
- [ ] lock changed → `npm ci`
- [ ] typecheck fail → tests/build skipped
- [ ] test fail → build skipped
- [ ] `--build` success → exit 0
- [ ] Pi systemd / standalone / `.next` deploy untouched by this tooling
