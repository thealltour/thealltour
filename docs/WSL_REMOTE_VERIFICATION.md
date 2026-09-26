# WSL Remote Verification Bridge (Pi → WSL)

Cursor는 **hermes-pi** working tree를 수정하고, 검증만 **Laptop WSL2**에서 돌립니다.  
이 문서는 Pi에서 WSL verification을 SSH로 호출하는 bridge (`scripts/verify-on-wsl.sh`) 설정입니다.

관련: [WSL_BUILD_VERIFICATION.md](./WSL_BUILD_VERIFICATION.md) (WSL에서 직접 `verify-from-pi.sh` 실행)

**하지 않는 것:** Pi `npm run build`, `node_modules`/`.next` 양방향 복사, systemd, production deploy.

---

## Architecture

```text
Cursor (SSH Remote → Pi)
        │ edits /home/ysh/thealltour
        ▼
Pi: ./scripts/verify-on-wsl.sh --fast
        │ ssh HERMES_WSL_VERIFY_HOST
        ▼
WSL: source ~/.env.verify-local
     ~/hermes-tools/scripts/verify-from-pi.sh --fast
        │ rsync Pi → HERMES_BUILD_WORKSPACE
        │ npm ci (WSL-local) + tsc + tests
        ▼
exit code → Pi → Cursor (VERIFY_RESULT=PASS|FAIL)
```

---

## 1. Pi → WSL SSH key

Pi에서 WSL로 **비대화형** 로그인이 되어야 Cursor 루프가 가능합니다.

```bash
# On Pi
ssh-keygen -t ed25519 -f ~/.ssh/id_ed25519_wsl_verify -N "" -C "hermes-pi-wsl-verify"
ssh-copy-id -i ~/.ssh/id_ed25519_wsl_verify.pub ysh@<WSL_LAN_OR_TAILSCALE_IP>
```

또는 WSL `~/.ssh/authorized_keys`에 Pi 공개키를 수동 추가합니다.

---

## 2. ssh alias 예시 (Pi `~/.ssh/config`)

IP는 문서/스크립트에 하드코딩하지 말고 alias만 둡니다.

```sshconfig
Host hermes-build-laptop
  # Prefer Tailscale (stable) over Wi‑Fi LAN IP which can change
  HostName 100.86.161.5
  User ysh
  IdentityFile ~/.ssh/id_ed25519_wsl_verify
  IdentitiesOnly yes
  # Windows portproxy → WSL sshd (common on this setup):
  Port 2222
```

환경변수로 덮어쓰기:

```bash
export HERMES_WSL_VERIFY_HOST=hermes-build-laptop
# or: export HERMES_WSL_VERIFY_HOST=ysh@100.x.x.x
```

선택: `cp scripts/verify-on-wsl.env.example scripts/verify-on-wsl.env` 후 편집 (gitignore 권장 — `.env*` 패턴이면 자동 제외).

---

## 3. WSL에서 sshd 시작

WSL2는 재부팅 후 sshd가 꺼져 있을 수 있습니다.

```bash
# On WSL
sudo service ssh start
# or: sudo systemctl start ssh   # if systemd enabled

ss -ltn | grep ':22'
```

Windows에서 포트 포워딩이 필요하면 (예시):

```powershell
# Admin PowerShell on Windows — adjust listen/connect addresses
netsh interface portproxy add v4tov4 listenport=2222 listenaddress=0.0.0.0 connectport=22 connectaddress=<WSL_IP>
```

방화벽에서 해당 포트를 허용합니다. Pi `Host`의 `Port`와 맞춥니다.

---

## 4. WSL verification 준비

이미 준비되어 있어야 하는 것:

| Item | Typical path |
|------|----------------|
| Node 22 + x86_64 `node_modules` | WSL verify workspace |
| `~/.env.verify-local` | `HERMES_PI_HOST`, `HERMES_PI_PATH`, `HERMES_BUILD_WORKSPACE` |
| `verify-from-pi.sh` | `~/hermes-tools/scripts/verify-from-pi.sh` (또는 repo sync 후 workspace 복사본) |

`~/.env.verify-local` 예:

```bash
HERMES_PI_HOST=hermes-pi
HERMES_PI_PATH=/home/ysh/thealltour
HERMES_BUILD_WORKSPACE=/home/ysh/thealltour-verify
```

`HERMES_PI_HOST`는 **WSL → Pi** SSH alias입니다 (bridge의 `HERMES_WSL_VERIFY_HOST`와 반대 방향).

원격 스크립트 경로를 바꾸려면 Pi 또는 WSL에서:

```bash
export HERMES_WSL_VERIFY_SCRIPT=$HOME/thealltour-verify/scripts/verify-from-pi.sh
```

---

## 5. 연결 테스트

```bash
# On Pi
ssh -o BatchMode=yes hermes-build-laptop 'echo WSL_OK && hostname && uname -m'
# expect: WSL_OK … x86_64
```

---

## 6. Bridge 사용

```bash
cd /home/ysh/thealltour

# 빠른 검증 (sync + deps + tsc + tests) — Pi에서 npm run build 하지 않음
./scripts/verify-on-wsl.sh --fast

# 전체 검증 (+ npm run build on WSL only)
./scripts/verify-on-wsl.sh --build

./scripts/verify-on-wsl.sh --fast --test visualOrchestration
./scripts/verify-on-wsl.sh --build --skip-tests
./scripts/verify-on-wsl.sh --dry-sync
```

성공 시 마지막 줄:

```text
VERIFY_RESULT=PASS
VERIFY_MODE=fast
```

실패 시:

```text
VERIFY_RESULT=FAIL
VERIFY_MODE=fast
EXIT_CODE=<code>
```

중간 stdout/stderr(verify-from-pi.sh 요약 포함)는 그대로 전달됩니다. exit code도 그대로 반환됩니다.

---

## 7. Cursor 루프

1. Cursor가 Pi 코드 수정  
2. Agent/터미널: `./scripts/verify-on-wsl.sh --fast`  
3. `VERIFY_RESULT=FAIL`이면 로그 보고 Pi에서 수정 후 재실행  
4. 필요 시 `--build` (여전히 **WSL에서만** build)

---

## Troubleshooting

| 증상 | 조치 |
|------|------|
| `Permission denied` / BatchMode fail | Pi 키 → WSL `authorized_keys`, alias `IdentityFile` |
| `Connection timed out` | WSL sshd, Windows portproxy/방화벽, Tailscale |
| `remote verify script not found` | `~/hermes-tools/scripts/verify-from-pi.sh` 또는 `HERMES_WSL_VERIFY_SCRIPT` |
| `HERMES_PI_HOST is required` (remote) | WSL `~/.env.verify-local` |
| rsync from WSL to Pi fails | WSL→Pi SSH (`HERMES_PI_HOST`) 별도 설정 |

---

## Boundaries (다시 한 번)

- Pi `node_modules` ⇄ WSL `node_modules` 복사 금지  
- `.next` 양방향 복사 금지 (**verify `--build` artifact는 Pi 배포용이 아님**)  
- Pi `.env.local`을 verify rsync로 밀어넣지 않음  
- WSL placeholder build(`example.supabase.co`)를 Pi에 배포하지 않음 — 필요 시 `scripts/deploy-internal-next-from-wsl.sh`  
- systemd / production restart는 `scripts/restart-thealltour-internal.sh` (placeholder 가드 포함)  
