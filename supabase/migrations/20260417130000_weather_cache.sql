-- WeatherAPI 응답 캐시 (관리자 유인물 날씨 조회, service_role 전용)

create table if not exists public.weather_cache (
  id uuid primary key default gen_random_uuid(),
  cache_key text unique not null,
  city_query text not null,
  start_date date not null,
  end_date date not null,
  source text not null default 'weatherapi',
  response_json jsonb not null,
  parsed_days_json jsonb not null,
  summary_text text not null,
  fetched_at timestamptz not null default now(),
  expires_at timestamptz not null,
  created_at timestamptz not null default now()
);

create index if not exists idx_weather_cache_expires_at
  on public.weather_cache (expires_at);

comment on table public.weather_cache is '날씨 API(WeatherAPI) 응답 캐시; TTL 만료 후 재조회 시 갱신';

alter table public.weather_cache enable row level security;
