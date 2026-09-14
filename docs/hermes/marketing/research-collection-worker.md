# Research Collection Worker (systemd)

Closes the gap where [scripts/research-collection-run.ts](../../../scripts/research-collection-run.ts)
existed but nothing scheduled it, so the 09:00 KST agenda routinely resolved
`RESEARCH_EMPTY` and the Content Strategist had no `usableFacts` to state.

## Units

| Unit | Schedule (KST) | Script | Effect |
|---|---|---|---|
| `thealltour-marketing-research-collection` | 01:10, 07:10, 13:10, 19:10 | `scripts/research-collection-run.ts` | Persist collected/enriched research signals |
| `thealltour-marketing-manual-performance` | 08:05 | `scripts/cron-collect-manual-performance.ts` | Snapshot metrics for manually published reviews |

The 07:10 run guarantees fresh signals before the 09:00 agenda slate; the 08:05
run completes before the 08:30 Performance Analyst brief reads snapshots.

Both are read-only with respect to SNS platforms. `PUBLICATION_FLOW_INACTIVE`
stays in force — neither unit publishes anything.

## Install (Hermes-Pi)

```bash
cd /home/ysh/thealltour
sudo cp deploy/systemd/thealltour-marketing-research-collection.{service,timer} /etc/systemd/system/
sudo cp deploy/systemd/thealltour-marketing-manual-performance.{service,timer} /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable --now thealltour-marketing-research-collection.timer
sudo systemctl enable --now thealltour-marketing-manual-performance.timer
```

Verify:

```bash
systemctl list-timers 'thealltour-marketing-*'
sudo systemctl start thealltour-marketing-research-collection.service
journalctl -u thealltour-marketing-research-collection.service -n 60 --no-pager
```

A healthy cycle prints `status: "completed"` (or `"partial"`) with non-zero
`totals.accepted`. `status: "failed"` with every collector erroring usually means
network egress or `RESEARCH_COLLECTION_ENABLED` is missing.

## Environment

`RESEARCH_COLLECTION_ENABLED=true` and `RESEARCH_USE_SUPABASE=true` are set in
the unit itself because the script defaults to the in-memory repository, which
would discard everything on exit. Secrets stay in `.env.local` / `~/.hermes/.env`.

`Persistent=true` makes systemd catch up a missed run after downtime, so a
reboot cannot leave the agenda with a stale corpus.

## Related

- [research-collectors.md](research-collectors.md) — collector inventory
- [cron-plan.md](cron-plan.md) — 08:30 / 09:00 Hermes routines
- [performance-collection.md](performance-collection.md) — snapshot contract
