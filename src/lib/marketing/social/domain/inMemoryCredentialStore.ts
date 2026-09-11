/**
 * Test/fake CredentialStore — never a production secret backend.
 */

import type {
  CredentialReference,
  CredentialStore,
  ResolvedAdapterCredential,
} from "@/lib/marketing/social/domain/credentials";
import { assertNoRawCredentialMaterial } from "@/lib/marketing/social/domain/credentials";

export type InMemoryCredentialMaterial = Readonly<Record<string, string>>;

/**
 * Fail-closed production placeholder until a real secure store is wired.
 */
export function createFailClosedCredentialStore(): CredentialStore {
  return {
    kind: "credential_store",
    async resolve(): Promise<ResolvedAdapterCredential> {
      throw new Error(
        "CredentialStore.resolve is fail-closed: production secure store is not configured (PUB-2).",
      );
    },
  };
}

/**
 * In-memory store for unit tests. Material never appears on SocialPublication rows.
 */
export function createInMemoryCredentialStore(
  initial: Record<string, InMemoryCredentialMaterial> = {},
): CredentialStore & {
  put(storeHandle: string, material: InMemoryCredentialMaterial): void;
} {
  const byHandle = new Map<string, InMemoryCredentialMaterial>(Object.entries(initial));
  return {
    kind: "credential_store",
    put(storeHandle: string, material: InMemoryCredentialMaterial) {
      const handle = storeHandle.trim();
      if (!handle) throw new Error("storeHandle required");
      byHandle.set(handle, Object.freeze({ ...material }));
    },
    async resolve(ref: CredentialReference): Promise<ResolvedAdapterCredential> {
      assertNoRawCredentialMaterial(ref);
      const material = byHandle.get(ref.storeHandle);
      if (!material) {
        throw new Error(`CredentialStore: unknown storeHandle=${ref.storeHandle}`);
      }
      return {
        kind: "adapter_credential",
        material,
      };
    },
  };
}
