/** TravelPayouts Drive (emrldtp) — issued project script. Do not change URL. */
export const TRAVELPAYOUTS_SCRIPT_SRC = "https://emrldtp.com/NTcwNjEw.js?t=570610";

/**
 * Exact TravelPayouts manual-install bootstrap (Drive / Emerald).
 * Injects the issued script into document.head.
 */
export const TRAVELPAYOUTS_LOADER_SCRIPT = `(function(){var script=document.createElement("script");script.async=1;script.setAttribute("data-cmp-ab","2");script.src=${JSON.stringify(TRAVELPAYOUTS_SCRIPT_SRC)};document.head.appendChild(script);})();`;
