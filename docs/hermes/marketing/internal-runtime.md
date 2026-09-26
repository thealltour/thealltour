# thealltour Internal Runtime (Pi)

Pi의 Next.js는 **Hermes 내부 MCP/backend 전용**이다. public website origin이 아니다. Vercel/DNS/thealltour.com은 이 서비스와 무관하다.

- host: `127.0.0.1` only
- port: `3000`
- bind `0.0.0.0` / `[::]` 금지
- secret은 systemd unit에 넣지 않는다. Next.js가 WorkingDirectory의 `.env.local`을 읽는다.

## systemd

- name: `thealltour-internal.service`
- unit: `/etc/systemd/system/thealltour-internal.service`
- user: `ysh`
- WorkingDirectory: `/home/ysh/thealltour`
- Restart: `on-failure`

Installed unit (source copy; live file is outside the repo):

```ini
[Unit]
Description=TheAllTour Internal Marketing MCP Runtime
After=network-online.target
Wants=network-online.target

[Service]
Type=simple
User=ysh
Group=ysh
WorkingDirectory=/home/ysh/thealltour
Environment=NODE_ENV=production
Environment=PATH=/home/ysh/.hermes/node/bin:/usr/bin:/bin
ExecStart=/home/ysh/.hermes/node/bin/node /home/ysh/thealltour/node_modules/next/dist/bin/next start -H 127.0.0.1 -p 3000
Restart=on-failure
RestartSec=5
TimeoutStopSec=30
KillSignal=SIGTERM

[Install]
WantedBy=multi-user.target
```

`next start` 기본 hostname은 `0.0.0.0`이므로 **반드시** `-H 127.0.0.1`을 둔다.

Node 경로는 Hermes에 묶여 있다 (`/home/ysh/.hermes/node/bin/node`, v22). systemd는 shell profile을 읽지 않으므로 절대 경로를 쓴다.

## WSL build/test verification (not deploy)

Cursor로 Pi working tree를 수정한 뒤, 느린 on-Pi `npm run build` 대신 Windows WSL2에서 typecheck/tests/build만 검증하려면:

→ [docs/WSL_BUILD_VERIFICATION.md](../../WSL_BUILD_VERIFICATION.md) · `scripts/verify-from-pi.sh`  
→ Pi에서 WSL 호출: [docs/WSL_REMOTE_VERIFICATION.md](../../WSL_REMOTE_VERIFICATION.md) · `scripts/verify-on-wsl.sh`

이 흐름은 `.next`/`node_modules`를 Pi로 배포하지 않으며 systemd를 바꾸지 않는다.

## 운영 명령

status:

```bash
sudo systemctl status thealltour-internal.service --no-pager
ss -ltnp | grep ':3000'
```

restart:

```bash
sudo systemctl restart thealltour-internal.service
```

logs:

```bash
journalctl -u thealltour-internal.service -n 100 --no-pager
journalctl -u thealltour-internal.service -f
```

MCP test:

```bash
hermes mcp test thealltour-marketing
```

기대: Connected, tool 8개 (`get_performance_evidence`, `run_department_orchestration` 포함), publish/send/post/delete/archive 없음.

## 코드 반영 (자동 deploy 없음)

push/pull만으로는 production runtime이 바뀌지 않는다.

```bash
cd /home/ysh/thealltour
git pull
# lockfile이 바뀌었으면 npm ci 또는 npm install

# 권장: WSL에서 실 env로 빌드 후 .next만 설치 + restart 가드
./scripts/deploy-internal-next-from-wsl.sh

# 또는 on-Pi build:
# npm run build
# ./scripts/restart-thealltour-internal.sh
```

`sudo systemctl restart thealltour-internal.service`만 하면 **이미 설치된 `.next`를 그대로** 띄운다.  
WSL verify용 placeholder 빌드를 Pi `.next`에 덮어쓴 뒤 restart하면 admin 페이지가 Internal Server Error가 된다.

재시작 전 가드:

```bash
./scripts/assert-next-build-not-placeholder.sh .next
./scripts/restart-thealltour-internal.sh
sudo systemctl status thealltour-internal.service --no-pager
ss -ltnp | grep ':3000'
```

git hook / CI auto-deploy는 두지 않는다.

## Rollback

systemd에 문제가 있으면:

```bash
sudo systemctl stop thealltour-internal.service
cd /home/ysh/thealltour
npx next dev --hostname 127.0.0.1 --port 3000
```

source와 Hermes config는 이 runtime STEP에서 지우지 않는다. DB migration 없음.

## Related: marketing production queue worker

Durable `QUEUED` production requests are processed by a separate one-shot systemd timer (not Hermes cron). See:

- `docs/hermes/marketing/agenda-production-queue-worker.md`
- `deploy/systemd/thealltour-marketing-production-queue.service`
- `deploy/systemd/thealltour-marketing-production-queue.timer`

Do not enable those units until G-7 acceptance is authorized.

## 확인 포인트

- `ss -ltnp`에서 `127.0.0.1:3000` ( `0.0.0.0:3000` / `[::]:3000` 이면 실패 )
- auth 없는 MCP 요청은 401
- Hermes `hermes.service`는 이 문서로 restart하지 않음
