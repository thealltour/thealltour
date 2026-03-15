import Link from "next/link";

const PHRASES: { label: string; href: string }[] = [
  { label: "지역별 여행", href: "/destinations" },
  { label: "테마별 여행", href: "/themes" },
  { label: "여행추천", href: "/recommended" },
];

/**
 * 관리자에서 설정한 추천 탐색 문구를 표시합니다.
 * 문구 안의 "지역별 여행", "테마별 여행", "추천여행"을 해당 링크로 렌더링합니다.
 */
export function HeroRecommendedLinks({ text }: { text: string }) {
  if (!text.trim()) return null;

  let remaining = text;
  const nodes: React.ReactNode[] = [];
  let key = 0;

  for (const { label, href } of PHRASES) {
    const i = remaining.indexOf(label);
    if (i === -1) continue;
    const before = remaining.slice(0, i);
    if (before) nodes.push(<span key={key++}>{before}</span>);
    nodes.push(
      <Link key={key++} href={href} className="underline hover:no-underline">
        {label}
      </Link>,
    );
    remaining = remaining.slice(i + label.length);
  }
  if (remaining) nodes.push(<span key={key++}>{remaining}</span>);

  if (nodes.length === 0) return <>{text}</>;
  return <>{nodes}</>;
}
