# 골프투어 상담 리드 UTM 추적 엔드포인트 — 아키텍처 발췌

> 목적: 기존 운영 코드를 건드리지 않고, **완전히 격리된** UTM 추적 API 엔드포인트를 설계하기 위한 읽기 전용 구조 분석 결과.
> 분석일 기준 코드베이스 스냅샷. 실제 키 값은 포함하지 않음.

---

## 1. Supabase 클라이언트 — 두 가지 인스턴스 (재사용 대상)

이미 두 개의 클라이언트 인스턴스가 존재하므로 새로 만들 필요 없이 import 한다.

### (A) 공개/RLS 클라이언트 — `@/lib/supabase`

```ts
// src/lib/supabase.ts
export const supabase = createClient(supabaseUrl, supabaseAnonKey);
```

- `NEXT_PUBLIC_SUPABASE_URL` + `NEXT_PUBLIC_SUPABASE_ANON_KEY` 기반
- RLS 정책 적용됨

### (B) 서버 전용 Admin 클라이언트 — `@/lib/supabaseAdmin` (UTM 적재에 권장)

```ts
// src/lib/supabaseAdmin.ts
import "server-only";

import { createClient } from "@supabase/supabase-js";

export const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  }
);
```

> **권장**: 마케팅 리드는 RLS 없이 서버에서 fire-and-forget 으로 insert 하는 패턴이 이 코드베이스의 정석(`analytics/events` 라우트가 정확히 이 방식). 신규 UTM 엔드포인트는 `supabaseAdmin` 을 import 한다. `"server-only"` 로 보호되어 클라이언트 번들에 새지 않는다.

---

## 2. 라우팅 아키텍처 — App Router (확정)

- 이 프로젝트는 **App Router** 를 사용한다. `pages/api/` 디렉터리는 존재하지 않는다.
- 모든 API 는 `src/app/api/**/route.ts` 형태이며, 현재 127개의 `route.ts` 가 있다.
- 신규 엔드포인트는 예: `src/app/api/leads/golf-utm/route.ts` 로 추가하면 기존 코드와 완전히 격리된다.

### 복제할 모범 예시 — `src/app/api/analytics/events/route.ts`

UTM 수집과 가장 유사한 "fire-and-forget + admin insert" 패턴.

```ts
export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { createAnalyticsPayload } from "@/lib/analytics/payload";
import { toRow } from "@/lib/analytics/saveAnalyticsEvent";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
```

그대로 복제할 컨벤션:

- `export const runtime = "nodejs";` — service role 키 사용 라우트의 표준 선언
- `export async function POST(request: NextRequest)` — named export 핸들러
- 본문 파싱은 `try { await request.json() } catch` 로 감싸 400 반환
- 입력값은 `typeof x === "string" ? x : undefined` 식으로 방어적 정규화
- 응답은 모두 `NextResponse.json(...)`, 상태코드는 2번째 인자
- 저장 실패 시에도 `200 + { ok: false }` 반환 (클라이언트 UX 미파손)

```ts
const row = toRow(payload);
const { error } = await supabaseAdmin.from("analytics_events").insert(row);

if (error) {
  return NextResponse.json({ ok: false, error: error.message }, { status: 200 });
}

return NextResponse.json({ ok: true });
```

> 참고: 사용자 입력 리드 폼(`src/app/api/inquiries/route.ts`)은 위 컨벤션에 더해, 컬럼이 없을 때(`code === "42703"`) 단계적으로 필드를 빼며 재시도하는 graceful fallback 패턴을 쓴다. UTM 컬럼 추가 시 마이그레이션 누락에 대비하려면 이 방어 패턴도 참고할 가치가 있다.

---

## 3. 환경변수 — 명명 규칙 (값 미노출)

`docs/deployment-env.md` 기준 매핑.

| 변수명 | 용도 | 비고 |
|--------|------|------|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase 프로젝트 URL | 공개 (양쪽 클라이언트 공통) |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | anon 키 | RLS 클라이언트(`@/lib/supabase`)용 |
| `SUPABASE_SERVICE_ROLE_KEY` | service_role 키 | `NEXT_PUBLIC_` 접두어 금지. admin 클라이언트(`@/lib/supabaseAdmin`)용 |

- 워크스페이스에 `.env.local` 파일은 존재하지 않음 (git 추적 제외 또는 Vercel 환경변수로만 관리되는 것으로 보임).
- 코드상 매핑 검증 결과: `supabase.ts` 는 url+anon, `supabaseAdmin.ts` 는 url+service_role 키를 사용하며 명명 규칙이 일관됨.

---

## 보너스: UTM 처리 로직은 이미 존재 (재사용 가능)

- **타입 정의** `src/types/inquiry.ts` — `FirstTouch` 에 `utm_source / utm_medium / utm_campaign / utm_term / utm_content` 필드 정의됨
- **분류 로직** `src/lib/analytics/attribution.ts` — `inferAttribution(firstTouch)` 가 UTM → `paid/social/organic/referral/direct` 채널로 자동 분류

```ts
// src/lib/analytics/attribution.ts
if (utmSource) {
  let acquisition_channel: string;
  if (PAID_MEDIUMS.has(utmMedium)) acquisition_channel = "paid";
  else if (SOCIAL_MEDIUMS.has(utmMedium)) acquisition_channel = "social";
  else if (utmMedium === "organic") acquisition_channel = "organic";
  else acquisition_channel = utmMedium || "unknown";
  // ...
}
```

---

## 다음 단계를 위한 격리 설계 요약

| 항목 | 사용할 것 |
|------|-----------|
| 신규 파일 위치 | `src/app/api/leads/golf-utm/route.ts` (기존 라우트와 충돌 없음) |
| 클라이언트 import | `import { supabaseAdmin } from "@/lib/supabaseAdmin"` |
| 라우트 헤더 | `export const runtime = "nodejs"` |
| 핸들러 시그니처 | `export async function POST(request: NextRequest)` |
| 응답 스타일 | `NextResponse.json(...)`, 실패 시 `200 + { ok: false }` |
| UTM 분류 | `inferAttribution()` + `FirstTouch` 타입 재사용 |
| 환경변수 | 추가 불필요 (기존 3개로 충분) |

### 구현 전 결정 필요 사항

- 신규 테이블 신설 vs 기존 `inquiries` / `analytics_events` 재사용
- 테이블 스키마 (UTM 5필드 + 리드 식별 정보 + 타임스탬프)
- RLS 정책 적용 여부 (admin 클라이언트 사용 시 RLS 우회)
