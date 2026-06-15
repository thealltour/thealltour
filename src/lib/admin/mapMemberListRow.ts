import type { AuthProviderId } from "@/lib/auth/types";

const PROVIDER_ORDER: AuthProviderId[] = ["google", "kakao", "naver"];

export type AdminMemberListItem = {
  id: string;
  username: string;
  name: string;
  phone: string;
  email: string;
  birth_date: string;
  gender: "male" | "female" | "other";
  agree_email: boolean;
  points: number;
  created_at: string | null;
  has_local_login: boolean;
  auth_providers: AuthProviderId[];
};

type RawMemberRow = {
  id: string;
  username: string;
  name: string;
  phone: string | null;
  email: string | null;
  birth_date: string | null;
  gender: string | null;
  agree_email: boolean | null;
  point_balance?: number | null;
  point_pending?: number | null;
  points?: number | null;
  created_at: string | null;
  signup_method?: string | null;
  password_hash?: string | null;
  member_auth_providers?: Array<{ provider: string }> | null;
};

function isAuthProviderId(value: string): value is AuthProviderId {
  return value === "google" || value === "kakao" || value === "naver";
}

export function extractAuthProviders(
  rows: Array<{ provider: string }> | null | undefined,
): AuthProviderId[] {
  const set = new Set<AuthProviderId>();
  for (const row of rows ?? []) {
    const p = row.provider;
    if (typeof p === "string" && isAuthProviderId(p)) {
      set.add(p);
    }
  }
  return PROVIDER_ORDER.filter((id) => set.has(id));
}

export function resolveHasLocalLogin(row: RawMemberRow): boolean {
  if (row.password_hash != null && String(row.password_hash).trim() !== "") {
    return true;
  }
  const method = row.signup_method?.trim();
  return method === "local" || method === "mixed";
}

export function mapMemberListRow(row: RawMemberRow): AdminMemberListItem {
  const points =
    typeof row.point_balance === "number"
      ? row.point_balance
      : typeof row.points === "number"
        ? row.points
        : 0;

  return {
    id: String(row.id),
    username: row.username ?? "",
    name: row.name ?? "",
    phone: row.phone ?? "",
    email: row.email ?? "",
    birth_date: row.birth_date ?? "",
    gender:
      row.gender === "male" || row.gender === "female" || row.gender === "other"
        ? row.gender
        : "other",
    agree_email: Boolean(row.agree_email),
    points,
    created_at: row.created_at,
    has_local_login: resolveHasLocalLogin(row),
    auth_providers: extractAuthProviders(row.member_auth_providers),
  };
}

export function formatMemberAuthProvidersLabel(item: {
  has_local_login: boolean;
  auth_providers: AuthProviderId[];
}): string {
  const labels: string[] = [];
  if (item.has_local_login) labels.push("사이트");
  for (const id of item.auth_providers) {
    const label =
      id === "google" ? "Google" : id === "kakao" ? "Kakao" : "Naver";
    labels.push(label);
  }
  return labels.length > 0 ? labels.join(", ") : "-";
}
