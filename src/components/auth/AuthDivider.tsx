type AuthDividerProps = {
  label?: string;
};

export default function AuthDivider({ label = "또는" }: AuthDividerProps) {
  return (
    <div className="relative my-6">
      <div className="absolute inset-0 flex items-center" aria-hidden="true">
        <div className="w-full border-t border-[var(--border)]" />
      </div>
      <div className="relative flex justify-center">
        <span className="bg-[var(--surface-elevated)] px-3 text-xs font-medium text-[var(--text-muted)]">{label}</span>
      </div>
    </div>
  );
}
