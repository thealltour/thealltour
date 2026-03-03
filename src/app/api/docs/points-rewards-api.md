# 포인트·경품 API 스키마 (v2)

- **userId**: 모든 경로에서 세션에서만 취득, body/query로 받지 않음.
- **트랜잭션**: balance 변경 + ledger 기록 + redemption/notification 변경은 가능한 한 같은 요청 내 순차 실행. 운영 시에는 DB 트랜잭션(RPC) 권장.

---

## (1) My Page

### GET /api/me/points

**Auth:** 회원 세션 필수.

**Response 200:**
```ts
{
  balance: number;        // point_balance (사용 가능)
  pending: number;        // point_pending (미확정 적립 합계)
  expiringSoon: number;   // 30일 이내 소멸 예정 합계 (ledger EARN 중 expires_at 기준)
  ledger: Array<{
    id: string;
    type: "EARN"|"USE"|"EXPIRE"|"ADJUST"|"RESERVE"|"RELEASE";
    status: "PENDING"|"CONFIRMED"|"CANCELED";
    amount: number;
    reason: string | null;
    ref_type: string | null;
    ref_id: string | null;
    expires_at: string | null;
    created_at: string;
  }>;
}
```

---

### GET /api/me/rewards/redemptions

**Auth:** 회원 세션 필수.

**Response 200:**
```ts
Array<{
  id: string;
  catalog_id: string;
  catalog_title?: string;
  point_amount: number;
  status: "REQUESTED"|"APPROVED"|"REJECTED"|"SHIPPED"|"COMPLETED"|"CANCELED";
  requested_at: string;
  decided_at: string | null;
  shipped_at: string | null;
  completed_at: string | null;
  user_message: string | null;
  shipping_name: string;
  shipping_phone: string;
  shipping_address1: string;
  shipping_address2: string | null;
  shipping_zip: string | null;
  tracking_carrier: string | null;
  tracking_number: string | null;
  created_at: string;
}>
```

---

## (2) Reward Catalog

### GET /api/rewards/catalog

**Auth:** 없음 (공개).

**Response 200:**
```ts
Array<{
  id: string;
  title: string;
  description: string | null;
  point_cost: number;
  stock: number | null;
  image_url: string | null;
  is_active: boolean;
  sort_order: number;
  created_at: string;
}>
```
- `is_active === true`만, `sort_order` 오름차순.

---

### POST /api/rewards/redemptions

**Auth:** 회원 세션 필수.

**Request body:**
```ts
{
  catalogId: string;
  shippingInfo: {
    shipping_name: string;
    shipping_phone: string;
    shipping_address1: string;
    shipping_address2?: string;
    shipping_zip?: string;
  };
  userMessage?: string;
}
```

**검증:**
- catalog 존재, `is_active === true`
- `balance >= point_cost`
- 재고: `stock`이 있으면 승인 시점에만 감소 (신청 시에는 재고 체크만, 또는 재고 있으면 통과)

**처리 (원자적 권장):**
1. `reward_redemptions` insert: status=REQUESTED, 배송 정보, user_message.
2. `point_ledger` insert: type=RESERVE, amount=point_cost, ref_type='REDEMPTION', ref_id=redemption.id, status=CONFIRMED.
3. `members.point_balance` -= point_cost.
4. (선택) `notifications` insert: REWARD_STATUS "교환 신청이 접수되었습니다."

**Response 201:**
```ts
{ id: string; message: string; }
```

---

## (3) Admin - 승인 워크플로우

### GET /api/admin/rewards/redemptions

**Auth:** 관리자 세션 필수.

**Query:** `status` (optional) — 예: REQUESTED.

**Response 200:**
```ts
Array<RewardRedemptionRow & { catalog?: RewardCatalogRow; member?: { id: string; name: string; username: string; email: string; phone: string } }>
```

---

### POST /api/admin/rewards/redemptions/:id/approve

**Auth:** 관리자 세션 필수.

**Request body (optional):**
```ts
{ admin_memo?: string; }
```

**처리:**
- 재고: `catalog.stock`이 not null이면 1 감소 (이미 감소했으면 생략).
- `reward_redemptions`: status=APPROVED, decided_at=now(), admin_memo.
- `notifications` insert: "승인됨" (REWARD_STATUS).

**Response 200:** `{ message: string; }`

---

### POST /api/admin/rewards/redemptions/:id/reject

**Auth:** 관리자 세션 필수.

**Request body (optional):**
```ts
{ admin_memo?: string; reason?: string; }
```

**처리:**
- `point_ledger` insert: type=RELEASE, amount=redemption.point_amount, ref_type='REDEMPTION', ref_id=id.
- `members.point_balance` += amount.
- `reward_redemptions`: status=REJECTED, decided_at=now(), admin_memo.
- `notifications` insert: "반려됨" + 사유.

**Response 200:** `{ message: string; }`

---

### POST /api/admin/rewards/redemptions/:id/ship

**Request body:**
```ts
{ tracking_carrier?: string; tracking_number?: string; admin_memo?: string; }
```

**처리:** tracking 저장, status=SHIPPED, shipped_at=now(), notifications "발송됨" + 운송장.

---

### POST /api/admin/rewards/redemptions/:id/complete

**Request body:** 없음 또는 `{ admin_memo?: string }`

**처리:** status=COMPLETED, completed_at=now().

---

## (4) Admin - 포인트 지급/조정

### POST /api/admin/points/grant

**Auth:** 관리자 세션 필수.

**Request body:**
```ts
{
  userId: string;   // members.id
  amount: number;   // 양수
  reason: string;
  refType?: string;
  refId?: string;
  status: "CONFIRMED" | "PENDING";
}
```

**처리:**
- `point_ledger` insert: type=EARN, amount, status, reason, ref_type, ref_id.
- status=CONFIRMED면 `members.point_balance` += amount.
- status=PENDING이면 `members.point_pending` += amount.
- `notifications` insert: "포인트 적립" (POINT_EARNED).

**Response 200:** `{ message: string; ledgerId: string; }`

---

### POST /api/admin/points/confirm

**Request body:**
```ts
{ ledgerId: string; }  // 또는 refType + refId로 특정 EARN 지정
```

**처리:**
- 해당 ledger 행: type=EARN, status=PENDING → status=CONFIRMED.
- `members.point_balance` += amount, `members.point_pending` -= amount.
- (선택) notifications "포인트가 확정되었습니다."

**Response 200:** `{ message: string; }`
