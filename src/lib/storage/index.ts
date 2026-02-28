import type { IStorageProvider } from "./StorageProvider";
import { SupabaseStorageProvider } from "./providers/SupabaseStorageProvider";

const PROVIDER_ENV = "STORAGE_PROVIDER";

function createProvider(): IStorageProvider {
  const provider = process.env[PROVIDER_ENV]?.toLowerCase().trim();

  if (!provider) {
    throw new Error(
      `스토리지 프로바이더가 설정되지 않았습니다. ${PROVIDER_ENV} 환경변수를 설정하세요. (예: supabase)`
    );
  }

  switch (provider) {
    case "supabase":
      return new SupabaseStorageProvider();
    default:
      throw new Error(
        `지원하지 않는 스토리지 프로바이더: "${provider}". ${PROVIDER_ENV}에 supabase 를 설정하세요.`
      );
  }
}

let _provider: IStorageProvider | null = null;

/**
 * 환경변수 기반 스토리지 프로바이더 반환
 * API route 등에서 수정 없이 provider 교체 가능
 */
export function getStorageProvider(): IStorageProvider {
  if (!_provider) {
    _provider = createProvider();
  }
  return _provider;
}

export type { IStorageProvider } from "./StorageProvider";
export { SupabaseStorageProvider } from "./providers/SupabaseStorageProvider";
