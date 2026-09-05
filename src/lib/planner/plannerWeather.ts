import "server-only";

import { fetchCachedWeatherForecast } from "@/lib/flyers/weather/fetchCachedWeatherForecast";
import type { PlannerWeatherSummary } from "@/lib/planner/enrichmentTypes";

export async function fetchPlannerWeatherSummary(params: {
  destination: string;
  startDate: string;
  endDate: string;
}): Promise<PlannerWeatherSummary> {
  try {
    const result = await fetchCachedWeatherForecast({
      city: params.destination,
      startDate: params.startDate,
      endDate: params.endDate,
    });

    if (!result.ok) {
      if (result.code === "too_early") {
        return { availability: "too_early", days: [] };
      }
      return { availability: "unavailable", days: [] };
    }

    return {
      availability: "forecast",
      days: result.days.map((d) => ({
        date: d.date,
        condition: d.condition || "날씨 정보",
        minC: d.minC,
        maxC: d.maxC,
        precipitationChance: d.chanceOfRain,
      })),
    };
  } catch {
    return { availability: "unavailable", days: [] };
  }
}
