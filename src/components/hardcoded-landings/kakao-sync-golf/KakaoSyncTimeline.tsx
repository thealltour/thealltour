import type { KakaoSyncTimelineStep } from "@/lib/hardcodedLandings/kakaoSyncGolf/config";
import { cn } from "@/lib/cn";

export type KakaoSyncTimelineProps = {
  title: string;
  description?: string;
  steps: KakaoSyncTimelineStep[];
};

export function KakaoSyncTimeline({ title, description, steps }: KakaoSyncTimelineProps) {
  return (
    <section aria-label={title} className="text-left [word-break:keep-all]">
      <h2 className="text-lg font-bold text-slate-900">{title}</h2>
      {description ? (
        <p className="mt-1 text-sm leading-relaxed text-slate-600">{description}</p>
      ) : null}
      <ol className="relative mt-4 space-y-0">
        {steps.map((step, index) => {
          const isLast = index === steps.length - 1;
          const isValueStep = index === 1 || index === 2;

          return (
            <li key={step.title} className="relative flex gap-3 pb-4 last:pb-0">
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
                <h3 className="text-base font-bold text-slate-900">{step.title}</h3>
                <p
                  className={cn(
                    "mt-1 text-left text-slate-600 [word-break:keep-all]",
                    isValueStep ? "text-base leading-loose" : "text-sm leading-loose",
                  )}
                >
                  {step.description}
                </p>
              </div>
            </li>
          );
        })}
      </ol>
    </section>
  );
}
