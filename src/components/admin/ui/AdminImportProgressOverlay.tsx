"use client";

type AdminImportProgressOverlayProps = {
  open: boolean;
  percent: number;
  label: string;
};

export default function AdminImportProgressOverlay({
  open,
  percent,
  label,
}: AdminImportProgressOverlayProps) {
  if (!open) return null;

  const clamped = Math.max(0, Math.min(100, Math.round(percent)));

  return (
    <div
      className="fixed bottom-6 right-6 z-[100] w-[280px] rounded-xl p-4 text-[13px] leading-snug text-slate-50 shadow-[0_12px_40px_rgba(0,0,0,0.35)]"
      style={{ background: "rgba(15,23,42,0.94)" }}
      role="status"
      aria-live="polite"
      aria-label={`${label} ${clamped}%`}
    >
      <div className="mb-2.5 font-semibold">{label}</div>
      <div className="h-2 overflow-hidden rounded-full bg-white/15">
        <div
          className="h-full rounded-full bg-gradient-to-r from-sky-400 to-indigo-500 transition-[width] duration-350 ease-out"
          style={{ width: `${clamped}%` }}
        />
      </div>
      <div className="mt-2 text-right text-xs text-slate-300">{clamped}%</div>
    </div>
  );
}
