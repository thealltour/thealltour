# Instagram Cardnews Render Step (systemd)

Renders the Instagram carousel PNGs for candidates where the operator actually
selected the `instagram` channel. Kept out of
[process-marketing-production-queue.ts](../../../scripts/process-marketing-production-queue.ts)
on purpose: sharp rasterization is the heaviest job the marketing pipeline runs
on the Pi, and a slow render must never delay the copy human review is waiting
for.

## What triggers a render

[instagramCardnews.ts](../../../src/lib/marketing/assets/cardnews/instagramCardnews.ts)
reads only persisted package artifacts and skips unless all of the following
hold for the candidate's `context/publishable-content.json`:

| Condition | Skip reason when unmet |
|---|---|
| `targetChannels` includes `instagram` | `instagram_not_selected` |
| Instagram channel counts as publishable success | `instagram_not_publishable` |
| `instagramMeta.slideHeadlines` has ≥ 4 entries | `slide_headlines_missing` |
| `context/media-brief.json` has cardnews cards | `cardnews_not_in_brief` |

The brief's cardnews cards are written at export time by
[applyToMediaBrief.ts](../../../src/lib/marketing/publishable/applyToMediaBrief.ts),
which derives them from `instagramMeta`. The render step never rewrites the
brief, so it cannot trip the artifact sha conflict guard.

## Reviewed text and line breaks

The renderer reads all four fields (`kicker`, `headline`, `body`, `microcopy`) from
the approved effective Instagram card copy by `cardId`. This is a render-only
input; the public handoff/result and media-brief JSON shapes stay unchanged.
Missing, null, or whitespace-only auxiliary fields occupy no space. Kicker is a
20px secondary label; microcopy is a 24px supplementary block below the body.
Existing two-field cards retain the established layout when it fits.

Break precedence is authored newlines (including blank paragraphs), Korean
semantic commas, then width wrapping within each paragraph. A comma directly
between two Hangul syllables becomes a forced newline and disappears in the
image: `그런데 최근,한국인 숙박이` renders on two lines. A comma followed by
whitespace stays punctuation. Numeric grouping (`1,000`), Latin lists/CSV and
URL tokens stay literal. The transform applies to all four fields during layout
and never rewrites stored copy or approval fingerprints.

Dense copy is measured as a complete stack before final allocation. Overlay
images keep their full-canvas size while the text band expands upward below the
wordmark; fonts shrink only to the readable minima. Split-image templates keep
their minimum image height and footer reserve. Unreadable content still raises
`cardnews_render_overflow` (HTTP 422), naming the card and field. The UI's empty
`{}` POST is valid and selects normal rendering; approval gates still apply.

## Aspect ratios

`CARDNEWS_SIZE_PRESETS` in
[brand.ts](../../../src/lib/marketing/assets/cardnews/brand.ts) covers `4:5`
(1080×1350), `1:1` (1080×1080), and `9:16` (1080×1920). Vertical anchors are
tuned on 4:5 and scaled from it, so 4:5 output is byte-identical to before the
preset map existed.

Instagram renders `4:5` and `1:1`. The default ratio keeps the historical flat
paths (`cardnews/card-01.png`); other ratios land in a subdirectory
(`cardnews/1x1/card-01.png`) so variants never overwrite each other.

## Units

| Unit | Schedule (KST) | Script |
|---|---|---|
| `thealltour-marketing-cardnews-render` | 09:40, 11:40, 14:40 | `scripts/render-instagram-cardnews.ts` |

Asset render only. No Hermes calls, no SNS side effects —
`PUBLICATION_FLOW_INACTIVE` stays in force.

## Install (Hermes-Pi)

```bash
cd /home/ysh/thealltour
sudo cp deploy/systemd/thealltour-marketing-cardnews-render.{service,timer} /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable --now thealltour-marketing-cardnews-render.timer
```

## Manual run

```bash
cd /home/ysh/thealltour
npx tsx scripts/render-instagram-cardnews.ts --dry-run
npx tsx scripts/render-instagram-cardnews.ts --date 2026-09-14
npx tsx scripts/render-instagram-cardnews.ts --candidate-id cmc_xxx
```

`--dry-run` reports the planned paths without rasterizing, which is the cheap way
to confirm a candidate is eligible. `--graphic-only` skips local visual lookups.

## Related

- [research-collection-worker.md](research-collection-worker.md) — the other one-shot marketing timers
- [cron-plan.md](cron-plan.md) — 08:30 / 09:00 Hermes routines
