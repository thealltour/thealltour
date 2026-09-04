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
npm run build
sudo systemctl restart thealltour-internal.service
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
