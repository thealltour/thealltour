# 스레드 마케팅 자동화 — 코드베이스 준비물 점검

대상: Supabase + 내부 상품 API + LLM(Gemini/GPT) + Slack + Meta Threads API 연동.
코드는 수정하지 않고 현황만 점검함. (작성일: 2026-08-13)

환경변수는 **키 이름만** 기록한다. 실제 시크릿 값은 포함하지 않는다.

**종합:** 상품 데이터·Next.js API·OpenAI(Vercel AI SDK)·크론 패턴은 이미 있다. Threads 게시·승인 워크플로·Gemini·Slack Bot·전용 DB 테이블은 없다. 가장 가까운 기존 자산은 관리자 상품 SNS 초안 API(`blog-post`, `kakao-post`, `band-hook`)다.

| 항목 | 상태 |
|------|------|
| 1. 환경변수 및 설정 | **일부 구성됨** |
| 2. Supabase 연동 및 DB 스키마 | **일부 구성됨** |
| 3. 내부 상품 API 및 데이터 모듈 | **준비 완료** |
| 4. Edge Functions / API 라우트 | **일부 구성됨** |
| 5. 의존성 패키지 | **일부 구성됨** |

---

## 1. 환경변수 및 설정 — **일부 구성됨**

`.env.example`은 없다. 키는 코드·README·로컬 `.env.local`의 **이름**으로만 확인했다.

| 구분 | 키 | 코드 참조 | 로컬 `.env.local` | 비고 |
|------|----|-----------|-------------------|------|
| Supabase URL | `NEXT_PUBLIC_SUPABASE_URL` | `src/lib/supabase.ts` | 정의됨 | 공개 클라이언트 |
| Supabase Anon | `NEXT_PUBLIC_SUPABASE_ANON_KEY` | `src/lib/supabase.ts` | 정의됨 | |
| Supabase URL(서버 별칭) | `SUPABASE_URL` | Storage 모듈 | 없음(코드는 `NEXT_PUBLIC_`로 폴백) | README에만 단독 표기 |
| Service Role | `SUPABASE_SERVICE_ROLE_KEY` | `src/lib/supabaseAdmin.ts` | 정의됨 | 서버 전용 |
| OpenAI | `OPENAI_API_KEY` | 밴드/OTA 파서 | 정의됨 | GPT 경로 |
| OpenAI 모델 | `BAND_IMPORT_MODEL` | `parseBandProductText.ts` | 정의됨 | 기본 `gpt-4o-mini` |
| Gemini | `GOOGLE_GENERATIVE_AI_API_KEY` / `GEMINI_API_KEY` 등 | **없음** | **없음** | 미비 |
| Slack Webhook | `SLACK_WEBHOOK_URL` | `src/lib/notifications.ts` | 주석 처리(미설정) | 문의 알림용 |
| Slack Bot Token | `SLACK_BOT_TOKEN` | **없음** | **없음** | 미비 |
| Threads / Meta | `THREADS_ACCESS_TOKEN`, App ID/Secret 등 | **없음** | **없음** | 미비 |
| 크론 가드 | `CRON_SECRET` | `src/app/api/cron/*/route.ts` | 코드만 있음 | 자동화 스케줄에 재사용 가능 |
| 사이트 URL | `NEXT_PUBLIC_SITE_URL` | SEO·상품 절대 URL | 정의됨 | 스레드 CTA 링크에 사용 가능 |

### 활용 가능한 코드

`src/lib/supabase.ts`

```ts
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
export const supabase = createClient(supabaseUrl, supabaseAnonKey);
```

`src/lib/supabaseAdmin.ts`

```ts
export const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } },
);
```

`src/lib/notifications.ts` — Incoming Webhook POST (`fetch`). Bot API·Block Kit·인터랙티브 승인 버튼은 없음.

```ts
const webhookUrl = process.env.SLACK_WEBHOOK_URL;
await fetch(webhookUrl, {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ text }),
});
```

### 부족한 것

- `.env.example` (키 목록·설명)
- Gemini 키
- Slack Bot Token / Signing Secret (초안 승인 버튼용)
- Meta Threads: App ID, App Secret, Access Token, User ID, 토큰 갱신 정보
- Threads 전용 UTM (`CHANNEL_UTM_PRESETS`에 `threads` 없음)

---

## 2. Supabase 연동 상태 및 DB 스키마 — **일부 구성됨**

상품·운영 DB는 갖춰져 있다. **스레드 초안/게시/승인 로그 테이블은 없다.**

| 점검 | 결과 |
|------|------|
| `@supabase/supabase-js` | 설치됨 (`^2.95.3`, `package.json`) |
| 공개 클라이언트 | `src/lib/supabase.ts` |
| Admin(service_role) 클라이언트 | `src/lib/supabaseAdmin.ts` (`import "server-only"`) |
| CLI / 로컬 | `supabase/config.toml`, `npm run supabase:start` 등 |
| migrations | `supabase/migrations/` 다수 (products RLS·컬럼 정규화 포함) |
| 생성 타입 `database.types.ts` | **없음**. 앱은 수동 타입 `src/types/product.ts` 사용 |
| Edge Functions 디렉터리 | `supabase/functions/` **없음** (`config.toml`의 `[edge_runtime]`만 enabled) |
| 상품 테이블 | `public.products` 존재. 핵심 컬럼 마이그레이션: `supabase/migrations/20260308170000_normalize_products_core_columns.sql` |

### 상품 타입 (발췌)

`src/types/product.ts` — 스레드 초안에 바로 쓸 필드:

- `id`, `title`, `description`, `image_url`, `images_json`
- `price`, `duration`, `category`, `theme`, `destination_id`
- `highlights`, `one_liner`, `product_source_url`

상세 URL은 타입이 아니라 조합한다: `{NEXT_PUBLIC_SITE_URL}/products/{id}`.

`src/lib/blog/buildBlogPostText.ts`의 `buildProductUrl()`이 이미 절대 URL + 채널 UTM을 만든다.

### 부족한 것 (신규 스키마 후보)

자동화에 필요한 테이블은 아직 없다. 예:

- `thread_marketing_jobs` (스케줄, 상품 ID, 상태)
- `thread_marketing_drafts` (LLM 초안, Slack 메시지 ts, 승인 여부)
- `thread_marketing_posts` (Threads media id, permalink, 게시 시각, 에러)
- (선택) `thread_marketing_accounts` (토큰 만료·리프레시)

---

## 3. 내부 상품 API 및 데이터 연동 모듈 — **준비 완료**

외부 SDK가 아니라 **DB 쿼리 + 관리자 API**가 내부 상품 소스다. 스레드 자동화는 이 레이어를 재사용하면 된다.

### 조회 함수

| 함수 | 파일 | 역할 |
|------|------|------|
| `getProducts()` | `src/lib/products.ts` | 공개 목록 (캐시 60초) |
| `getProductById(id)` | 동일 | 캐시된 단건 |
| `getProductByIdFresh(id)` | 동일 | 캐시 없이 단건 — SNS 초안 API가 이 경로 사용 |
| `getPrimaryImageUrl(product)` | `src/lib/products/images.ts` | 대표 이미지 URL |

```ts
export async function getProductByIdFresh(id: string) {
  const [{ data, error }, campaignTaxonomies] = await Promise.all([
    supabase.from("products").select("*").eq("id", id).maybeSingle(),
    getCampaignTaxonomiesForCard(),
  ]);
  // normalizeProduct → Product
}
```

### HTTP API

| 경로 | 용도 |
|------|------|
| `GET/POST /api/admin/products` | 관리자 목록·생성 (`src/app/api/admin/products/route.ts`) |
| `GET/PATCH /api/admin/products/[id]` | 관리자 상세 |
| `GET /api/admin/products/[id]/blog-post` | 블로그 복붙 텍스트 (템플릿, LLM 아님) |
| `GET /api/admin/products/[id]/kakao-post` | 카카오 채널용 짧은 문구 |
| `GET /api/admin/products/[id]/band-hook` | 밴드 훅 문구 |
| `GET /api/products/suggestions` | 검색 제안 |

공개 “상품 상세 REST SDK”는 없다. 서버 작업은 `getProductByIdFresh`면 충분하다.

### 마케팅용 DTO (이미 있음)

`src/lib/blog/blogPost.types.ts` — `BlogPostViewModel`

- `productId`, `title`, `priceText`, `durationText`, `regionText`
- `heroImageUrl`, `productUrlPath`
- 포함/불포함, 타임라인, CTA 후보

매핑: `src/lib/blog/mapProductToBlogPostViewModel.ts`  
카카오 짧은 글: `src/lib/blog/buildKakaoChannelPostText.ts` (Threads 톤에 가장 가까움)

**주의:** 위 SNS 초안은 **규칙 기반 템플릿**이다. LLM(`generateObject`)은 상품 **수입(밴드/하나·모두투어 파싱)** 에만 쓰인다.

---

## 4. Edge Functions 또는 API 라우트 — **일부 구성됨**

| 점검 | 결과 |
|------|------|
| `supabase/functions/` | **없음** |
| Deno `import_map.json` | **없음** |
| Next.js App Router API | **있음** `src/app/api/**/route.ts` (200개 이상) |
| 관리자 인증 | `requireAdminSession` (`src/lib/apiAuth.ts`) |
| Vercel Cron | `vercel.json` → `/api/cron/sms-bulk` (5분). 리뷰 리마인더·랜딩 싱크 라우트는 있으나 vercel.json 미등록 |
| Cron 인증 패턴 | `Authorization: Bearer ${CRON_SECRET}` |
| pg_cron | 관리자 채팅 보관 삭제용만 (`supabase/migrations/20260625110000_admin_chat_pg_cron.sql`) |

권장 배치: 새 Supabase Edge Function보다 **기존 Next.js `/api/cron` + `/api/admin/...`** 에 맞추는 편이 코드베이스와 같다.

재사용 크론 골격: `src/app/api/cron/sms-bulk/route.ts`, `src/app/api/cron/review-reminders/route.ts`.

---

## 5. 의존성 패키지 — **일부 구성됨**

`package.json` 기준. `import_map.json` 없음.

| 패키지 | 상태 | 용도 |
|--------|------|------|
| `@supabase/supabase-js` | 있음 | DB |
| `ai` + `@ai-sdk/openai` | 있음 | GPT `generateObject` |
| `zod` | 있음 | LLM 스키마 |
| `@google/genai` / `@ai-sdk/google` | **없음** | Gemini 미연동 |
| `openai` (공식 SDK) | 없음 | AI SDK로 대체됨 |
| `@slack/web-api` / `@slack/bolt` | **없음** | Webhook `fetch`만 |
| Threads/Meta SDK | **없음** | |
| `rss-parser` | 있음 | 블로그 RSS. 스레드 자동화와 무관 |
| HTTP 클라이언트 | 내장 `fetch` | axios 없음 |

LLM 사용 위치:

- `src/lib/admin/bandImport/parseBandProductText.ts`
- `src/lib/admin/externalImport/parseExternalProductPage.ts`

```ts
import { generateObject } from "ai";
import { openai } from "@ai-sdk/openai";
```

Gemini를 쓰려면 `@ai-sdk/google`을 같은 `generateObject` 패턴으로 추가하는 것이 기존 코드와 맞다.

---

## 기존 자산 vs 신규 구현

이미 재사용 가능:

1. 상품 조회·이미지·절대 URL·UTM
2. `BlogPostViewModel` + 카카오/밴드 초안 생성기 (시드 프롬프트)
3. OpenAI `generateObject` + zod
4. Slack Incoming Webhook (단방향 알림)
5. Next.js cron + `CRON_SECRET`
6. 관리자 세션 가드

처음부터 만들어야 함:

1. Threads Graph API 클라이언트 (게시, 미디어 컨테이너, 토큰 갱신)
2. Slack 승인 플로우 (초안 프리뷰 → Approve/Reject). Webhook만으로는 버튼 인터랙션 불가에 가깝고 Signing Secret + Events/Interactivity 필요
3. Gemini 경로 (선택)
4. 초안/게시 이력 테이블
5. 스케줄러 잡 (상품 선정 규칙, 하루 N건, 중복 방지)
6. 관리자 UI (큐, 실패 재시도, 계정 연결)

---

## 우선 작성 순서

아래 순서로 가면 기존 모듈을 깨지 않고 붙일 수 있다.

1. **설정**  
   - `.env.example`에 키 목록 추가  
   - `THREADS_*`, (선택) `GEMINI_*` / `GOOGLE_GENERATIVE_AI_API_KEY`, `SLACK_BOT_TOKEN`, `SLACK_SIGNING_SECRET`  
   - `CHANNEL_UTM_PRESETS`에 `threads` 추가 (`src/lib/analytics/utmPropagation.ts`)

2. **DB**  
   - `supabase/migrations/YYYYMMDDHHMMSS_thread_marketing.sql`  
   - jobs / drafts / posts (상태: `drafted | pending_approval | approved | published | failed | skipped`)  
   - (선택 후) `supabase gen types`로 `database.types.ts` 도입 — 필수는 아님

3. **카피 생성**  
   - `src/lib/threads/mapProductToThreadDraft.ts` — `mapProductToBlogPostViewModel` 재사용  
   - `src/lib/threads/generateThreadCopy.ts` — `generateObject` + zod (GPT, 이후 Gemini 스위치)  
   - 길이 제한·해시태그·이미지 URL·CTA 링크 스키마

4. **Slack 알림/승인**  
   - 1차는 `sendSlackPlainText`로 초안 프리뷰  
   - 승인 UX가 필요하면 Slack Bot + `/api/webhooks/slack/interactions`

5. **Threads 게시 클라이언트**  
   - `src/lib/threads/threadsClient.ts` — Graph API (`POST /{threads-user-id}/threads`, publish)  
   - 토큰 만료 처리

6. **오케스트레이션 API**  
   - `POST /api/admin/threads/generate` — 상품 ID → 초안  
   - `POST /api/admin/threads/publish` — 승인된 초안 게시  
   - `GET /api/cron/threads-marketing` — 선정·생성·(승인 대기 또는 자동 게시)  
   - `vercel.json` crons에 등록

7. **관리자 UI (마지막)**  
   - `/theall_manager_only/threads` 또는 상품 상세의 “스레드 초안” 버튼  
   - 기존 `BlogPostGenerateModal` UX를 참고

Edge Function은 이 단계에서는 비권장. Next.js API가 이미 인증·크론·LLM·Supabase Admin을 한 런타임에서 처리한다.

---

## 관련 파일 인덱스

| 역할 | 경로 |
|------|------|
| 공개 Supabase | `src/lib/supabase.ts` |
| Admin Supabase | `src/lib/supabaseAdmin.ts` |
| 상품 타입 | `src/types/product.ts` |
| 상품 조회 | `src/lib/products.ts` |
| 대표 이미지 | `src/lib/products/images.ts` |
| 마케팅 ViewModel | `src/lib/blog/blogPost.types.ts` |
| 상품→ViewModel | `src/lib/blog/mapProductToBlogPostViewModel.ts` |
| 카카오 짧은 글 | `src/lib/blog/buildKakaoChannelPostText.ts` |
| 블로그 초안 API | `src/app/api/admin/products/[id]/blog-post/route.ts` |
| OpenAI 파서 | `src/lib/admin/bandImport/parseBandProductText.ts` |
| Slack webhook | `src/lib/notifications.ts` |
| UTM | `src/lib/analytics/utmPropagation.ts` |
| Cron 예시 | `src/app/api/cron/sms-bulk/route.ts` |
| Vercel cron | `vercel.json` |
| 상품 마이그레이션 | `supabase/migrations/20260308170000_normalize_products_core_columns.sql` |
| 의존성 | `package.json` |
