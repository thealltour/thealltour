/**
 * Semantic status surfaces for admin — mirrors public Badge success/warning/danger tokens.
 * Prefer these (or AdminBadge) over Tailwind palette colors (emerald/amber/red-*).
 */
export const adminToneSurface = {
  success:
    "border-[var(--success)]/40 bg-[var(--success-bg)] text-[var(--success)]",
  warning:
    "border-[var(--warning)]/40 bg-[var(--warning-bg)] text-[var(--warning)]",
  danger:
    "border-[var(--danger)]/40 bg-[var(--danger-bg)] text-[var(--danger)]",
  muted:
    "border-[var(--divider)] bg-[var(--surface-muted)] text-[var(--text-muted)]",
} as const;

export const adminToneBorderBg = {
  success: "border-[var(--success)]/40 bg-[var(--success-bg)]",
  warning: "border-[var(--warning)]/40 bg-[var(--warning-bg)]",
  danger: "border-[var(--danger)]/40 bg-[var(--danger-bg)]",
} as const;

export const adminToneText = {
  success: "text-[var(--success)]",
  warning: "text-[var(--warning)]",
  danger: "text-[var(--danger)]",
} as const;

export const adminToneSoftBg = {
  success: "bg-[var(--success-bg)]",
  warning: "bg-[var(--warning-bg)]",
  danger: "bg-[var(--danger-bg)]",
} as const;

export type AdminTone = keyof typeof adminToneSurface;
