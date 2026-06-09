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

## 기타

- `MEMBER_SESSION_SECRET` — 회원 세션 JWT([`src/lib/memberSession.ts`](../src/lib/memberSession.ts)).
- `REVALIDATE_SECRET` — on-demand revalidate API.
