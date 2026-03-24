import "@testing-library/jest-dom/vitest";

/** 정책 단위 테스트가 `productFilters` 등을 import 할 때 `supabase.ts` 초기화를 통과하도록 함 */
process.env.NEXT_PUBLIC_SUPABASE_URL ??= "http://127.0.0.1:54321";
process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ??= "vitest-anon-key-placeholder";
