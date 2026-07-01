# 배포 환경 변수 (요약)

## 관리자 (필수 — 프로덕션)

| 변수 | 설명 |
|------|------|
| `ADMIN_ID` / `ADMIN_PASSWORD` | **총괄(부트스트랩) 어드민** 로그인 자격. 유일한 env 계정이며, 하위 관리자는 UI(환경설정 > 관리자 계정)에서 DB로 등록합니다. |
| `ADMIN_SESSION_SECRET` | **UTF-8 기준 32바이트 이상** 무작위 문자열. 관리자 JWT(HS256) 서명에 사용. 프로덕션에서 없거나 짧으면 로그인 불가. `next dev`만 예외로, 미설정 시 개발용 기본 시크릿이 쓰이며 콘솔에 경고가 출력됩니다. 생성 예: `openssl rand -base64 32` |

### 하위 관리자 (env 불필요)

- `ADMIN_MANAGER_ID`, `ADMIN_MANAGER_PASSWORD`, `ADMIN_VIEWER_ID`, `ADMIN_VIEWER_PASSWORD`는 **더 이상 사용하지 않습니다.**
- 총괄 어드민으로 로그인 후 **환경설정 > 관리자 계정**에서 manager/viewer 등 역할 프리셋·개별 권한으로 하위 계정을 생성하세요.
- DB 마이그레이션 `20260611100000_admin_users.sql` 적용 필요.

## 크론 (프로덕션 필수)

| 변수 | 설명 |
|------|------|
| `CRON_SECRET` | Vercel Cron 등에서 `Authorization: Bearer <값>`으로 전달. **프로덕션에서 미설정 시** 리뷰 리마인더 등 크론 라우트는 401을 반환합니다. |

## 관측·알림 (선택)

| 변수 | 설명 |
|------|------|
| `SENTRY_DSN` | 설정 시 서버에서 Sentry 초기화([`src/instrumentation.ts`](../src/instrumentation.ts)). |
| `SLACK_WEBHOOK_URL` | 배치 일부 실패 등 [`sendSlackPlainText`](../src/lib/notifications.ts) 알림. |

## AI (밴드 상품 import)

| 변수 | 설명 |
|------|------|
| `OPENAI_API_KEY` | [`POST /api/admin/products/import-band`](../src/app/api/admin/products/import-band/route.ts)에서 **gpt-4o-mini** 2패스 구조화 파싱에 사용. **프로덕션 필수** — 미설정 시 API 500. |
| `BAND_IMPORT_MODEL` | (선택) 밴드 import 모델 오버라이드. 기본값 `gpt-4o-mini`. |

## Supabase

| 변수 | 설명 |
|------|------|
| `NEXT_PUBLIC_SUPABASE_URL` | 공개 URL. |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | anon 키 — RLS와 함께 사용. |

## SMS 수신 (textbee.dev)

| 변수 | 설명 |
|------|------|
| `TEXTBEE_WEBHOOK_SECRET` | textbee 웹훅 서명 검증용 (대시보드 Webhook 설정과 동일). **프로덕션 필수.** |
| `TEXTBEE_API_KEY` | (선택) 수신 메시지 API 백필·폴링용. 웹훅만 사용 시 불필요. |
| `TEXTBEE_DEVICE_ID` | (선택) 백필 cron용 Android 기기 ID. |

설정 절차:

1. textbee Android 앱에서 **Receive SMS** 활성화
2. Dashboard → Webhooks → `https://{도메인}/api/webhooks/textbee` 등록, 이벤트 `MESSAGE_RECEIVED`
3. Signing secret을 `TEXTBEE_WEBHOOK_SECRET`에 저장 (Vercel·로컬 `.env.local`)

**보안:** API 키·웹훅 시크릿을 소스코드에 하드코딩하지 마세요. 노출된 키는 textbee 대시보드에서 재발급하세요.

발송(SMS outbound)은 기존과 같이 **알리고 relay**([`sendAligoRelay`](../src/lib/notifications/sendAligoRelay.ts))를 사용합니다.

### textbee 수신 알림 검증 체크리스트

1. Supabase에 `inquiry_inbound_sms`, `admin_notifications` 테이블 존재 (`20260612100000`, `admin_notifications.sql`)
2. Vercel `TEXTBEE_WEBHOOK_SECRET` = textbee 대시보드 Signing secret
3. 웹훅 URL: `https://{도메인}/api/webhooks/textbee`, 이벤트 `MESSAGE_RECEIVED`
4. 테스트 수신 후 `admin_notifications`에 `inbound_sms_reply` 또는 `inbound_sms_unmatched` row 생성 확인
5. 알림 센터 SMS 탭·SubHeader 알림 배지·SMS 센터 Realtime 갱신 확인

### SMS 센터 후속 (선택)

| 변수 | 설명 |
|------|------|
| `SMS_BULK_BATCH_SIZE` | 대량 발송 cron 배치 크기 (기본 15) |

대량 발송 cron: `GET /api/cron/sms-bulk` (Vercel Cron + `CRON_SECRET`)

**회원 연결:** `supabase/migrations/20260615100000_inbound_sms_member_link.sql` 적용 후, SMS 센터에서 미연결 수신 SMS를 문의 또는 `members` 회원에 연결할 수 있습니다. 동일 전화번호로 회원 가입·전화 등록 시 미연결 SMS가 자동 backfill됩니다.

## 회원 세션·소셜 로그인

| 변수 | 설명 |
|------|------|
| `MEMBER_SESSION_SECRET` | 회원 HMAC 세션 서명([`src/lib/memberSession.ts`](../src/lib/memberSession.ts)). OAuth state 서명에도 동일 키 사용. |
| `NEXT_PUBLIC_APP_URL` | OAuth redirect base (예: `https://thealltour.com`). 미설정 시 Vercel URL 또는 `http://localhost:3000`. |

### 소셜 로그인 (OAuth)

| 변수 | 필수 | 설명 |
|------|------|------|
| `NEXT_PUBLIC_APP_URL` | 예 | OAuth Redirect URI base. 로컬 `http://localhost:3000`, 운영 `https://thealltour.com` — 콘솔 등록 URI와 **일치**해야 함 |
| `MEMBER_SESSION_SECRET` | 예 | 회원·OAuth state HMAC 서명 |
| `KAKAO_REST_API_KEY` | 예 (카카오) | [Kakao Developers](https://developers.kakao.com) 앱 **REST API 키** (Native 키 아님) |
| `KAKAO_CLIENT_SECRET` | 조건부 | 콘솔 **보안 > Client Secret** 사용 ON이면 필수 |
| `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` | Google용 | Google Cloud Console OAuth 클라이언트 |
| `NAVER_CLIENT_ID` / `NAVER_CLIENT_SECRET` | Naver용 | Naver Developers 애플리케이션 |

**Redirect URI (각 콘솔에 등록):**

- Google: `{APP_URL}/api/auth/google/callback`
- **Kakao / 카카오싱크:** `{APP_URL}/api/auth/kakao/callback`
- Naver: `{APP_URL}/api/auth/naver/callback`

예시:

- 로컬: `http://localhost:3000/api/auth/kakao/callback`
- 운영: `https://thealltour.com/api/auth/kakao/callback`

> 카카오싱크 플러그인 Redirect URI에도 **동일 경로**를 입력하세요. Supabase Auth URL이 아닌 **자체 OAuth 콜백**입니다.

### 카카오 로그인 · 카카오싱크 콘솔 설정

[Kakao Developers](https://developers.kakao.com) → 내 애플리케이션:

1. **카카오 로그인** 활성화 ON
2. **Redirect URI** 등록 (위 Kakao callback 2개)
3. **플랫폼 > Web** 사이트 도메인: `http://localhost:3000`, `https://thealltour.com`
4. **동의항목**: 닉네임(필수), 카카오계정(이메일)(권장 — 계정 병합용)
5. Client Secret 사용 시 **보안**에서 Secret 생성 → `KAKAO_CLIENT_SECRET`에 설정

**DB:** `supabase/migrations/20260614100000_member_social_auth.sql` 적용 필요.

## 기타

- `REVALIDATE_SECRET` — on-demand revalidate API.
