# Supabase RLS·역할 점검 가이드 (더올투어)

Vercel(Next API)에서 `NEXT_PUBLIC_*` 키로 **anon** 클라이언트를 쓰는 경우, 테이블 RLS가 곧 보안 경계입니다. 아래는 전수 점검 시 체크리스트입니다.

## 1. 역할 구분

| 역할 | 용도 |
|------|------|
| **anon** (`NEXT_PUBLIC_SUPABASE_ANON_KEY`) | 브라우저/서버에서 공개 키로 접근. RLS를 반드시 통과해야 함. |
| **service_role** | 서버 전용 비밀키. RLS를 우회하므로 **절대 클라이언트에 노출 금지**. Edge Function·백엔드 전용 작업에만 사용. |

현재 앱은 대부분 API 라우트에서 `createClient` + anon으로 조회합니다. **민감 테이블에 `anon` + `USING (true)` 정책**이 있으면 URL만 알면 누구나 읽기/쓰기가 가능합니다.

## 2. 알려진 위험 패턴 (마이그레이션에서 확인됨)

- `point_earn_requests` 등에 대해 **`to anon` + `for all` + `using (true)`** 조합이 존재할 수 있습니다.  
  - 의도가 “서버에서만 호출”이라면 **anon이 아닌 service_role** 또는 **서버에서만 호출되는 RPC**로 옮기는 것이 안전합니다.
  - 회원 본인 데이터만 보이게 하려면 **`auth.uid()`와 `user_id` 매칭** 또는 **커스텀 JWT + RLS**가 필요합니다. (현재 회원 세션은 앱 자체 JWT이므로 Supabase `auth.uid()`와 자동 연동되지 않을 수 있음.)

## 3. 권장 점검 순서

1. **Supabase Dashboard → Authentication → Policies**에서 `anon` / `authenticated` 정책 목록 덤프.
2. 각 테이블별로 **SELECT/INSERT/UPDATE/DELETE**가 필요한 주체를 명시합니다.
3. `site_settings`처럼 공개 읽기가 필요한 경우: **SELECT만 anon 허용**, 쓰기는 **관리자 API(service_role 또는 서버 검증 후 upsert)** 로 제한.
4. 스토리지 버킷 정책(업로드/읽기)을 DB RLS와 별도로 점검합니다.

## 4. 앱 코드와의 정합성

- 관리자 API는 쿠키 JWT([`src/lib/apiAuth.ts`](../src/lib/apiAuth.ts))로 보호됩니다. DB는 여전히 anon 키로 접근하므로, **RLS가 느슨하면 API를 우회한 직접 호출** 위험이 남습니다.
- 장기적으로는 **service_role을 서버 전용 env**로 두고, 공개 데이터만 anon으로 읽도록 분리하는 구성을 권장합니다.

## 5. 문서화

정책 변경 시 이 파일에 **테이블명·정책명·변경일**을 한 줄씩 적어 두면 감사(audit)에 유리합니다.
