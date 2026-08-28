/**
 * 홈 Discovery rail 공통 preset — Golf / Curated mobile merchandising 통일.
 * 390px 기준 ~74% card width + next card peek.
 */
export const HOME_DISCOVERY_RAIL_COLS = "auto-cols-[min(74%,300px)]";

export const HOME_DISCOVERY_RAIL_UL_CLASS =
  `grid grid-flow-col ${HOME_DISCOVERY_RAIL_COLS} gap-3 overflow-x-auto pb-2 scrollbar-hide snap-x snap-mandatory scroll-smooth -mx-4 px-4 sm:mx-0 sm:px-0 sm:auto-cols-[280px] lg:auto-cols-[calc((min(100%,1344px)-3*1rem)/4)] [touch-action:pan-x_pan-y]`;

export const HOME_DISCOVERY_RAIL_UL_COMPACT_CLASS =
  `grid grid-flow-col ${HOME_DISCOVERY_RAIL_COLS} gap-3 overflow-x-auto pb-2 scrollbar-hide snap-x snap-mandatory scroll-smooth -mx-4 px-4 [touch-action:pan-x_pan-y]`;
