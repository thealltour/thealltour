/**
 * Public Travelpayouts attribution identifiers (project `trs`, partner marker `shmarker`).
 * They appear in browser-visible widget/script URLs — not secrets. API tokens stay server-only in
 * `src/lib/affiliate/travelpayouts/config.ts`.
 */
export const TRAVELPAYOUTS_PUBLIC_TRS = "570610";
export const TRAVELPAYOUTS_PUBLIC_SHMARKER = "774063";

/** TravelPayouts Drive (emrldtp) — issued project script. Do not change URL. */
export const TRAVELPAYOUTS_SCRIPT_SRC = `https://emrldtp.com/NTcwNjEw.js?t=${TRAVELPAYOUTS_PUBLIC_TRS}`;

/**
 * Exact TravelPayouts manual-install bootstrap (Drive / Emerald).
 * Injects the issued script into document.head.
 *
 * Partner Links / API secrets live in server-only
 * `src/lib/affiliate/travelpayouts/config.ts` — never here.
 */
export const TRAVELPAYOUTS_LOADER_SCRIPT = `(function(){var script=document.createElement("script");script.async=1;script.setAttribute("data-cmp-ab","2");script.src=${JSON.stringify(TRAVELPAYOUTS_SCRIPT_SRC)};document.head.appendChild(script);})();`;
