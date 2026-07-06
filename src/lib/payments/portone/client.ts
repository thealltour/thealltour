import "server-only";

import { getPortOneApiSecret } from "@/lib/payments/portone/config";

export type PortOnePaymentStatus =
  | "READY"
  | "PAID"
  | "CANCELLED"
  | "FAILED"
  | "PARTIAL_CANCELLED"
  | string;

export type PortOnePayment = {
  id?: string;
  status?: PortOnePaymentStatus;
  amount?: { total?: number };
  currency?: string;
  customData?: string | Record<string, unknown> | null;
};

export async function fetchPortOnePayment(paymentId: string): Promise<PortOnePayment | null> {
  const secret = getPortOneApiSecret();
  if (!secret) return null;

  const res = await fetch(
    `https://api.portone.io/payments/${encodeURIComponent(paymentId)}`,
    {
      headers: { Authorization: `PortOne ${secret}` },
      cache: "no-store",
    },
  );

  if (!res.ok) return null;
  return (await res.json()) as PortOnePayment;
}

export function isPortOnePaymentPaid(payment: PortOnePayment): boolean {
  const status = String(payment.status ?? "").toUpperCase();
  return status === "PAID" || status === "VIRTUAL_ACCOUNT_ISSUED";
}

export function readPortOnePaymentAmount(payment: PortOnePayment): number | null {
  const total = payment.amount?.total;
  if (typeof total === "number" && Number.isFinite(total)) return total;
  return null;
}
