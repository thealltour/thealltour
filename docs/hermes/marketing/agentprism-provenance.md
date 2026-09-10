# AgentPrism (Evil Martians) — third-party provenance

| Field | Value |
|-------|--------|
| Upstream | https://github.com/evilmartians/agent-prism |
| Vendored UI commit | `53a9078b533b6958e9081d68a05b03b053059e97` (2026-07-27) |
| npm packages | `@evilmartians/agent-prism-data@0.0.9`, `@evilmartians/agent-prism-types@0.0.9` |
| License | MIT (see `src/components/vendor/agent-prism/LICENSE`) |
| Vendored path | `src/components/vendor/agent-prism/` |
| Local modifications | **Subset only**: TreeView + SpanCard closure. `DetailsView` / `TraceViewer` omitted from tsc. Badge labels remapped for TheAllTour kinds (AGENT / ORCHESTRATION / DETERMINISTIC / VALIDATION / HUMAN BOUNDARY). |

AgentPrism is **Alpha** — do not float to latest `main` or `^` ranges without an explicit OBS bump.

OBS-4 uses TreeView (+ supporting SpanCard/theme) and does **not** mount AgentPrism `DetailsView` (avoids input/output/raw prompt surfaces). TheAllTour supplies its own sanitized details panel.
