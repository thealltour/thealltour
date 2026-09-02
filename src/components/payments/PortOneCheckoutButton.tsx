"use client";

import { useCallback, useState } from "react";

export type PortOneCheckoutParams = {
  storeId: string;
  channelKey: string;
  paymentId: string;
  orderName: string;
  totalAmount: number;
  currency?: "CURRENCY_KRW";
  redirectUrl?: string;
  customData?: Record<string, unknown>;
};

export type PortOneCheckoutButtonProps = {
  params: PortOneCheckoutParams;
  disabled?: boolean;
  className?: string;
  children: React.ReactNode;
  onSuccess?: (paymentId: string) => void;
  onError?: (message: string) => void;
};

export function PortOneCheckoutButton({
  params,
  disabled,
  className,
  children,
  onSuccess,
  onError,
}: PortOneCheckoutButtonProps) {
  const [loading, setLoading] = useState(false);

  const handleClick = useCallback(async () => {
    if (disabled || loading) return;
    setLoading(true);
    try {
      const PortOne = await import("@portone/browser-sdk/v2");
      const response = await PortOne.requestPayment({
        storeId: params.storeId,
        channelKey: params.channelKey,
        paymentId: params.paymentId,
        orderName: params.orderName,
        totalAmount: params.totalAmount,
        currency: params.currency ?? "CURRENCY_KRW",
        payMethod: "CARD",
        redirectUrl: params.redirectUrl,
        ...(params.customData ? { customData: params.customData } : {}),
      });

      if (response?.code != null) {
        onError?.(response.message ?? "결제가 취소되었습니다.");
        return;
      }

      onSuccess?.(params.paymentId);
    } catch (error) {
      onError?.(error instanceof Error ? error.message : "결제 요청에 실패했습니다.");
    } finally {
      setLoading(false);
    }
  }, [disabled, loading, onError, onSuccess, params]);

  return (
    <button
      type="button"
      disabled={disabled || loading}
      onClick={() => void handleClick()}
      className={className}
    >
      {loading ? "결제창 여는 중…" : children}
    </button>
  );
}
