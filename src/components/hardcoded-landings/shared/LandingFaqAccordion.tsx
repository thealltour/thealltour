"use client";

import { useState } from "react";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/cn";

export type LandingFaqItem = {
  question: string;
  answer: string;
};

export type LandingFaqAccordionProps = {
  items: LandingFaqItem[];
  sectionTitle?: string;
};

export function LandingFaqAccordion({ items, sectionTitle }: LandingFaqAccordionProps) {
  const [openIndex, setOpenIndex] = useState<number | null>(0);

  return (
    <section aria-label={sectionTitle ?? "자주 묻는 질문"}>
      {sectionTitle ? (
        <h2 className="text-lg font-bold text-slate-900">{sectionTitle}</h2>
      ) : null}
      <ul className={`space-y-1 ${sectionTitle ? "mt-1.5" : ""}`}>
        {items.map((item, index) => {
          const isOpen = openIndex === index;
          return (
            <li key={item.question} className="overflow-hidden rounded-xl border border-slate-200">
              <button
                type="button"
                onClick={() => setOpenIndex(isOpen ? null : index)}
                className="flex w-full items-center justify-between gap-2 px-2 py-1.5 text-left text-sm font-semibold text-slate-900"
                aria-expanded={isOpen}
              >
                <span>{item.question}</span>
                <ChevronDown
                  className={cn("h-4 w-4 shrink-0 text-slate-500 transition-transform", isOpen && "rotate-180")}
                  aria-hidden
                />
              </button>
              {isOpen ? (
                <div className="border-t border-slate-100 px-2 py-1 text-sm leading-relaxed text-slate-600">
                  {item.answer}
                </div>
              ) : null}
            </li>
          );
        })}
      </ul>
    </section>
  );
}
