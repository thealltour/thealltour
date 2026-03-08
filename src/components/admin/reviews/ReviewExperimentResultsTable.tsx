"use client";

type Row = {
  experimentKey: string;
  variant: string;
  impressions: number;
  clicks: number;
  ctr: number;
  expands: number;
  expandRate: number;
  conversions: number;
  conversionRate: number;
  ctrLift?: number;
  conversionLift?: number;
};

type ReviewExperimentResultsTableProps = {
  rows: Row[];
};

export function ReviewExperimentResultsTable({ rows }: ReviewExperimentResultsTableProps) {
  if (rows.length === 0) {
    return (
      <p className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-6 text-center text-sm text-[var(--text-muted)]">
        아직 수집된 실험 데이터가 없습니다.
      </p>
    );
  }

  return (
    <div className="overflow-x-auto rounded-xl border border-[var(--border)]">
      <table className="w-full min-w-[700px] text-sm">
        <thead>
          <tr className="border-b border-[var(--border)] bg-[var(--surface-muted)]">
            <th className="px-3 py-2 text-left font-medium">Experiment</th>
            <th className="px-3 py-2 text-left font-medium">Variant</th>
            <th className="px-3 py-2 text-right font-medium">Impressions</th>
            <th className="px-3 py-2 text-right font-medium">Clicks</th>
            <th className="px-3 py-2 text-right font-medium">CTR %</th>
            <th className="px-3 py-2 text-right font-medium">Expands</th>
            <th className="px-3 py-2 text-right font-medium">Expand %</th>
            <th className="px-3 py-2 text-right font-medium">Conversions</th>
            <th className="px-3 py-2 text-right font-medium">Conv %</th>
            <th className="px-3 py-2 text-right font-medium">CTR Lift %</th>
            <th className="px-3 py-2 text-right font-medium">Conv Lift %</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={`${r.experimentKey}-${r.variant}-${i}`} className="border-b border-[var(--border)]">
              <td className="px-3 py-2 font-mono text-xs">{r.experimentKey}</td>
              <td className="px-3 py-2">{r.variant}</td>
              <td className="px-3 py-2 text-right">{r.impressions}</td>
              <td className="px-3 py-2 text-right">{r.clicks}</td>
              <td className="px-3 py-2 text-right">{r.ctr.toFixed(2)}</td>
              <td className="px-3 py-2 text-right">{r.expands}</td>
              <td className="px-3 py-2 text-right">{r.expandRate.toFixed(2)}</td>
              <td className="px-3 py-2 text-right">{r.conversions}</td>
              <td className="px-3 py-2 text-right">{r.conversionRate.toFixed(2)}</td>
              <td className="px-3 py-2 text-right">
                {r.ctrLift != null ? `${r.ctrLift > 0 ? "+" : ""}${r.ctrLift}%` : "—"}
              </td>
              <td className="px-3 py-2 text-right">
                {r.conversionLift != null ? `${r.conversionLift > 0 ? "+" : ""}${r.conversionLift}%` : "—"}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
