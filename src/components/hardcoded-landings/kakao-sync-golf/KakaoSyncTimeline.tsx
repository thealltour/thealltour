import type { KakaoSyncTimelineStep } from "@/lib/hardcodedLandings/kakaoSyncGolf/config";

export type KakaoSyncTimelineProps = {
  title: string;
  description?: string;
  steps: KakaoSyncTimelineStep[];
};

export function KakaoSyncTimeline({ title, description, steps }: KakaoSyncTimelineProps) {
  return (
    <section aria-label={title}>
      <h2 className="text-lg font-bold text-slate-900">{title}</h2>
      {description ? (
        <p className="mt-1 text-sm leading-relaxed text-slate-600">{description}</p>
      ) : null}
      <ol className="relative mt-5 space-y-0">
        {steps.map((step, index) => {
          const isLast = index === steps.length - 1;
          return (
            <li key={step.title} className="relative flex gap-4 pb-6 last:pb-0">
              {!isLast ? (
                <span
                  className="absolute left-[0.9375rem] top-8 h-[calc(100%-1rem)] w-px bg-slate-200"
                  aria-hidden
                />
              ) : null}
              <span
                className="relative z-10 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-slate-900 text-xs font-bold text-white"
                aria-hidden
              >
                {index + 1}
              </span>
              <div className="min-w-0 pt-0.5">
                <h3 className="text-sm font-bold text-slate-900">{step.title}</h3>
                <p className="mt-1 text-sm leading-relaxed text-slate-600">{step.description}</p>
              </div>
            </li>
          );
        })}
      </ol>
    </section>
  );
}
