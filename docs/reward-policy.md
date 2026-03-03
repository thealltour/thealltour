# 리워드(경품 교환) 정책 설정

환경변수로 제어하며, 추후 관리자 화면(site_settings 등)에서 덮어쓸 수 있도록 설계되어 있습니다.

---

## 설정 값 정의

| 키 (환경변수) | 설명 | 기본값 | 비고 |
|---------------|------|--------|------|
| `REDEEM_MIN_POINTS` | 최소 교환 포인트 (1회 교환에 필요한 최소 포인트) | 10000 | 이 값 미만인 경품은 교환 불가 |
| `REDEEM_MONTHLY_LIMIT` | 월 교환 횟수 제한 (회원당) | 1 | REQUESTED/APPROVED/SHIPPED/COMPLETED 합산 |
| `POINT_EXPIRY_MONTHS` | 포인트 유효기간(월) | 12 | EARN 생성 시 `ledger.expires_at` = 현재 + 이 값 |
| `REDEEM_RATE_LIMIT_WINDOW_MINUTES` | 동일 계정 반복 신청 rate limit 윈도우(분) | 60 | 0이면 비활성 |
| `REDEEM_RATE_LIMIT_MAX_REQUESTS` | 위 윈도우 내 허용 최대 신청 횟수 | 3 | |
| `REDEEM_REJECT_LOOKBACK_DAYS` | 반려/취소 카운트 기준 과거 일수 | 90 | |
| `REDEEM_REJECT_THRESHOLD` | 위 기간 내 반려+취소 누적 시 신청 차단(수동 검토) 기준 | 3 | ≥ 이 값이면 신청 불가 |

### 정책 요약

- **교환 가능한 포인트**: CONFIRMED 포인트만 사용 (`point_balance` 사용으로 이미 적용, pending 미포함).
- **포인트 유효기간**: 관리자 지급 시 `point_ledger.expires_at` = 현재 시각 + `POINT_EXPIRY_MONTHS` 개월.
- **악용 방지**
  - **Rate limit**: 동일 회원이 짧은 시간에 여러 번 신청 시 차단.
  - **반려/취소 누적**: 특정 기간 내 반려 또는 취소 횟수가 임계값 이상이면 신청 차단, 안내 메시지로 고객센터 문의 유도.

---

## 정책 검증 코드 위치

| 구분 | 파일 | 설명 |
|------|------|------|
| 설정 로드 | `src/config/rewardPolicy.ts` | `getRewardPolicy()`, `getPointExpiresAt()` — env 기반 설정 반환 |
| 교환 신청 검증 | `src/lib/rewardPolicyValidation.ts` | `validateRedemptionPolicy(userId, pointCost, supabase)` — 최소 포인트, 월 한도, rate limit, 반려/취소 횟수 검사 |
| 검증 호출 | `src/app/api/rewards/redemptions/route.ts` | POST 핸들러 내, `balance >= pointCost` 확인 직후, `reward_redemptions` insert 직전에 `validateRedemptionPolicy()` 호출 |
| 유효기간 적용 | `src/app/api/admin/points/grant/route.ts` | EARN ledger insert 시 `expires_at: getPointExpiresAt()` 설정 |

---

## 관리자에서 변경 가능하게 확장 시

1. **site_settings**에 키 추가 예: `reward_min_redeem_point`, `reward_monthly_limit`, `point_expiry_months` 등.
2. **`src/config/rewardPolicy.ts`**에 `getRewardPolicyFromSettings()` 구현: `getSiteSettings()` 또는 전용 API로 설정 조회 후, 값이 있으면 env 대신 사용.
3. **`getRewardPolicy()`**를 “env 먼저, 없으면 site_settings” 등으로 합치면, 관리자에서 변경한 값이 우선 적용되도록 할 수 있음.
