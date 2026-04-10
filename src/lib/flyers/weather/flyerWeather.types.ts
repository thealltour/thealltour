/** WeatherAPI·UI 공통 정규화 타입 (프로바이더 교체 시 이 레이어 유지) */

export type FlyerWeatherDay = {
  date: string;
  minC: number | null;
  maxC: number | null;
  condition: string;
  chanceOfRain: number | null;
};

export type FlyerWeatherDraftState = {
  city: string;
  startDate: string;
  endDate: string;
  days: FlyerWeatherDay[];
  summaryText: string;
  isLoaded: boolean;
};

export const EMPTY_FLYER_WEATHER_DRAFT: FlyerWeatherDraftState = {
  city: "",
  startDate: "",
  endDate: "",
  days: [],
  summaryText: "",
  isLoaded: false,
};
