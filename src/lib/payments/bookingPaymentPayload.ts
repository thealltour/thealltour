/**
 * PG 비의존 결제 페이로드.
 * submitPayment 어댑터에 그대로 전달한다.
 */

import type { SelectedOptions } from "@/types/product";

export type BookingPaymentOptionItem = {
  id: string;
  name: string;
  price: number;
};

export type BookingPaymentPayload = {
  orderId: string;
  productId: string;
  productName: string;
  selectedDate: string;
  headcount: number;
  selectedOptions: BookingPaymentOptionItem[];
  /** prepare API용 원본 선택 맵 */
  selectedOptionsMap: SelectedOptions;
  departure: {
    label: string;
    inquiryValue: string;
    ymd?: string | null;
    price?: number | null;
  };
  totalTripPrice: number;
  /** 오늘 실제 결제 금액 (상품 총액과 동일) */
  payAmount: number;
  customer: {
    name: string;
    phone: string;
    email: string;
  };
  specialRequest?: string;
};

export function createOrderId(prefix = "ORD"): string {
  const rand = Math.random().toString(36).slice(2, 8).toUpperCase();
  return `${prefix}-${Date.now()}-${rand}`;
}
