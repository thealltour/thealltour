# 배포 환경 변수 (요약)

## 관리자 (필수 — 프로덕션)

| 변수 | 설명 |
|------|------|
| `ADMIN_ID` / `ADMIN_PASSWORD` | 관리자 로그인 자격. |
| `ADMIN_SESSION_SECRET` | **UTF-8 기준 32바이트 이상** 무작위 문자열. 관리자 JWT(HS256) 서명에 사용. 프로덕션에서 없거나 짧으면 로그인 불가. `next dev`만 예외로, 미설정 시 개발용 기본 시크릿이 쓰이며 콘솔에 경고가 출력됩니다. 생성 예: `openssl rand -base64 32` |

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
