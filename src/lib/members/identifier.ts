const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const USERNAME_PATTERN = /^[a-zA-Z0-9_]{4,20}$/;

export type IdentifierKind = "email" | "phone" | "username";

export function normalizePhone(phone: string) {
  return phone.replace(/[^\d]/g, "");
}

export function parseIdentifier(raw: string): {
  kind: IdentifierKind;
  value: string;
} | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;

  if (EMAIL_PATTERN.test(trimmed)) {
    return { kind: "email", value: trimmed.toLowerCase() };
  }

  const digits = normalizePhone(trimmed);
  if (digits.length >= 10 && digits.length <= 11) {
    return { kind: "phone", value: digits };
  }

  if (USERNAME_PATTERN.test(trimmed)) {
    return { kind: "username", value: trimmed };
  }

  return null;
}

export function maskIdentifier(kind: IdentifierKind, value: string): string {
  if (kind === "email") {
    const [local, domain] = value.split("@");
    if (!domain) return value;
    const visible = local.slice(0, Math.min(2, local.length));
    return `${visible}${"*".repeat(Math.max(1, local.length - 2))}@${domain}`;
  }
  if (kind === "phone") {
    if (value.length < 7) return value;
    return `${value.slice(0, 3)}****${value.slice(-4)}`;
  }
  if (value.length <= 2) return `${value}**`;
  return `${value.slice(0, 2)}${"*".repeat(Math.max(1, value.length - 2))}`;
}

export { EMAIL_PATTERN, USERNAME_PATTERN };
