# Vercel ↔ VPS(PM2) SMS 브릿지 역할 분리

자체 서버 없이 Vercel에서 비즈니스 로직을 돌리고, 문자 발송만 VPS에서 PM2로 처리하는 구성일 때의 권장 분리입니다.

## 역할

| 구간 | 책임 |
|------|------|
| **Vercel (Next API / Server Action)** | 인증·검증·요청 수락, DB 기록, **짧은 타임아웃 내** 응답. 가능하면 “발송 요청 레코드만 생성” 또는 “외부 큐에 enqueue”. |
| **VPS (PM2 워커)** | 실제 SMS 게이트웨이 호출, **재시도·백오프**, 발송 속도 제한, DLR(전달 결과) 수집, API 키 보관. |
| **Supabase (선택)** | `sms_outbox` 테이블 또는 `pgmq` 큐로 **at-least-once** 발송 파이프라인. |

## 왜 나누는가

- Vercel Serverless는 **실행 시간 상한**이 있어, 대량 발송·재시도 루프에 부적합합니다.
- SMS 키를 Vercel env에만 두면 편하지만, **키 로테이션·IP 화이트리스트**는 VPS 쪽이 유리한 경우가 많습니다.

## 패턴 A — 큐 테이블 (Pull)

1. Vercel API가 `sms_outbox`에 `pending` 행 삽입.
2. VPS 워커가 주기적으로 `pending`을 조회해 발송 후 `sent` / `failed` 업데이트.

## 패턴 B — VPS HTTP 엔드포인트 (Push)

1. Vercel이 VPS의 내부 URL로 `POST` (HMAC 서명 또는 mTLS).
2. VPS가 즉시 202 Accepted 후 비동기 발송.

**주의:** VPS URL이 인터넷에 노출되면 **강한 인증**이 필수입니다.

## 타임아웃

- Vercel → VPS 호출 시 `fetch` **AbortSignal**으로 3~5초 제한 후, 사용자에게는 “접수 완료, 발송은 순차 처리” 메시지.

## 개인정보

- 로그에 전화번호 전체를 남기지 말고 **마스킹** 또는 보관 기간을 개인정보처리방침과 일치시키세요.
