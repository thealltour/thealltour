export function getPortOneStoreId(): string | null {
  return process.env.PORTONE_STORE_ID?.trim() || null;
}

export function getPortOneChannelKey(): string | null {
  return process.env.PORTONE_CHANNEL_KEY?.trim() || null;
}

export function getPortOneApiSecret(): string | null {
  return process.env.PORTONE_API_SECRET?.trim() || null;
}

export function getPortOneWebhookSecret(): string | null {
  return process.env.PORTONE_WEBHOOK_SECRET?.trim() || null;
}

export function isPortOneConfigured(): boolean {
  return Boolean(getPortOneStoreId() && getPortOneChannelKey() && getPortOneApiSecret());
}

/** 신규 결제 UI·prepare API 허용 여부. `PORTONE_ENABLED=false`로 일시 중단. */
export function isPortOneEnabled(): boolean {
  if (process.env.PORTONE_ENABLED === "false") return false;
  return isPortOneConfigured();
}

export const PORTONE_PUBLIC_STORE_ID = process.env.NEXT_PUBLIC_PORTONE_STORE_ID?.trim() || "";
export const PORTONE_PUBLIC_CHANNEL_KEY = process.env.NEXT_PUBLIC_PORTONE_CHANNEL_KEY?.trim() || "";
