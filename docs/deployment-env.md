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

## 기타

- `MEMBER_SESSION_SECRET` — 회원 세션 JWT([`src/lib/memberSession.ts`](../src/lib/memberSession.ts)).
- `REVALIDATE_SECRET` — on-demand revalidate API.
