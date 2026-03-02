"use client";

const CHART_COLORS = ["#14b8a6", "#3b82f6", "#f97316", "#64748b", "#ec4899"];

function getChartColor(index: number) {
  return CHART_COLORS[index % CHART_COLORS.length];
}

export type ThemeChartItem = { label: string; percent: number };

const FIXED = 2;

function polarToCartesian(cx: number, cy: number, r: number, angleRad: number) {
  return {
    x: Number((cx + r * Math.sin(angleRad)).toFixed(FIXED)),
    y: Number((cy - r * Math.cos(angleRad)).toFixed(FIXED)),
  };
}

export function ThemeChartCard({ items }: { items: ThemeChartItem[] }) {
  const filtered = items.filter((i) => i.percent > 0);
  if (!filtered.length) return null;

  const rawTotal = filtered.reduce((s, i) => s + i.percent, 0);
  const normalized =
    Math.abs(rawTotal - 100) > 0.01
      ? filtered.map((i) => ({ ...i, percent: (i.percent / rawTotal) * 100 }))
      : filtered;

  const size = 180;
  const cx = size / 2;
  const cy = size / 2;
  const radius = 72;

  let startAngle = -Math.PI / 2;
  const segments = normalized.map((item, i) => {
    const pct = Number((item.percent / 100).toFixed(6));
    const angleSpan = Number((pct * 2 * Math.PI).toFixed(6));
    const endAngle = Number((startAngle + angleSpan).toFixed(6));

    const p1 = polarToCartesian(cx, cy, radius, startAngle);
    const p2 = polarToCartesian(cx, cy, radius, endAngle);
    const largeArcFlag = angleSpan >= Math.PI ? 1 : 0;
    const path = `M ${cx} ${cy} L ${p1.x} ${p1.y} A ${radius} ${radius} 0 ${largeArcFlag} 1 ${p2.x} ${p2.y} Z`;

    const labelAngle = startAngle + angleSpan / 2;
    const labelRadius = radius * 0.55;
    const labelPos = polarToCartesian(cx, cy, labelRadius, labelAngle);

    startAngle = endAngle;

    return {
      path,
      color: getChartColor(i),
      label: item.label,
      labelPos,
      pct,
    };
  });

  return (
    <div className="rounded-2xl border border-slate-100 bg-slate-50/50 p-4 shadow-sm">
      <h3 className="mb-3 text-sm font-semibold text-slate-800">일정 테마 구성비</h3>
      <div className="flex flex-col items-center gap-4">
        <div className="relative shrink-0" style={{ width: size, height: size }}>
          <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
            {segments.map((seg, i) => (
              <path
                key={i}
                d={seg.path}
                fill={seg.color}
                stroke="white"
                strokeWidth={1}
                className="transition-all duration-500"
              />
            ))}
          </svg>
          <svg
            width={size}
            height={size}
            className="absolute inset-0 pointer-events-none"
            viewBox={`0 0 ${size} ${size}`}
            aria-hidden
          >
            {segments.map((seg, i) => {
              if (seg.pct < 0.08) return null;
              return (
                <text
                  key={i}
                  x={seg.labelPos.x}
                  y={seg.labelPos.y}
                  textAnchor="middle"
                  dominantBaseline="central"
                  className="fill-white text-xs font-bold drop-shadow-[0_1px_2px_rgba(0,0,0,0.6)]"
                >
                  {seg.label}
                </text>
              );
            })}
          </svg>
        </div>
        <div className="grid grid-cols-2 gap-2 w-full">
          {normalized.map((item, i) => (
            <div
              key={`${item.label}-${i}`}
              className="flex items-center gap-2 rounded-lg border border-slate-100 bg-white px-2.5 py-1.5 text-xs min-w-0"
            >
              <span
                className="h-2 w-2 shrink-0 rounded-full"
                style={{ backgroundColor: getChartColor(i) }}
              />
              <span className="font-medium text-slate-700">{item.label}</span>
              <span className="font-semibold text-slate-500 shrink-0">
                {Math.round(item.percent)}%
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
