/** TravelPayouts (emrldtp) loader — issued tracking id. Do not change URL. */
export const TRAVELPAYOUTS_SCRIPT_SRC = "https://emrldtp.com/NTcwNjEw.js?t=570610";

/** Inline bootstrap matching TravelPayouts install snippet (head inject). */
export const TRAVELPAYOUTS_LOADER_SCRIPT = `(function(){var script=document.createElement("script");script.async=1;script.setAttribute("data-cmp-ab","2");script.src=${JSON.stringify(TRAVELPAYOUTS_SCRIPT_SRC)};document.head.appendChild(script);})();`;
