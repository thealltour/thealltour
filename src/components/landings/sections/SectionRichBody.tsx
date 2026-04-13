type SectionRichBodyProps = {
  body: string;
  className?: string;
};

/**
 * 본문이 전부 "- " 줄이면 목록으로, 아니면 줄바꿈 유지 텍스트로 렌더링.
 */
export default function SectionRichBody({ body, className = "" }: SectionRichBodyProps) {
  const lines = body.split(/\r?\n/).map((l) => l.trim()).filter((l) => l.length > 0);
  const allBullets = lines.length > 0 && lines.every((l) => l.startsWith("-"));
  if (allBullets) {
    return (
      <ul className={`list-inside list-disc space-y-1.5 ${className}`.trim()}>
        {lines.map((line, idx) => (
          <li key={idx} className="text-sm leading-relaxed text-[var(--text-secondary)]">
            {line.replace(/^\-\s*/, "")}
          </li>
        ))}
      </ul>
    );
  }
  return <div className={`whitespace-pre-line text-sm leading-relaxed ${className}`.trim()}>{body}</div>;
}
