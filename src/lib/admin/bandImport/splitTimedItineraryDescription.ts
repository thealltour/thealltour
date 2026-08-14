const CLOCK_RE = /\b([01]?\d|2[0-3]):([0-5]\d)\b/;

export type SplitTimedItineraryLine = {
  heading: string;
  description: string;
  timeText?: string;
};

function padTime(hour: string, minute: string): string {
  return `${hour.padStart(2, "0")}:${minute}`;
}

function headingFromTimedLine(line: string, timeText: string): string {
  const withoutTime = line.replace(CLOCK_RE, " ").replace(/\s+/g, " ").trim();
  return withoutTime || timeText;
}

/** 본문에 시각이 2개 이상이면 줄 단위로 이벤트 후보를 나눈다. */
export function splitTimedItineraryDescription(description: string): SplitTimedItineraryLine[] {
  const text = description.replace(/\r\n/g, "\n").trim();
  if (!text) return [];

  const lines = text
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);
  const timedLineCount = lines.filter((line) => CLOCK_RE.test(line)).length;
  if (timedLineCount < 2) {
    const single = text.match(CLOCK_RE);
    return [
      {
        heading: lines[0] ?? "일정",
        description: text,
        timeText: single ? padTime(single[1], single[2]) : undefined,
      },
    ];
  }

  const chunks: { timeText?: string; lines: string[] }[] = [];
  let current: { timeText?: string; lines: string[] } | null = null;

  for (const line of lines) {
    const match = line.match(CLOCK_RE);
    if (match) {
      if (current && current.lines.length > 0) chunks.push(current);
      current = { timeText: padTime(match[1], match[2]), lines: [line] };
      continue;
    }
    if (current) {
      current.lines.push(line);
    } else {
      current = { lines: [line] };
    }
  }
  if (current && current.lines.length > 0) chunks.push(current);

  return chunks.map((chunk) => {
    const first = chunk.lines[0] ?? "일정";
    const rest = chunk.lines.slice(1).join("\n");
    const heading = chunk.timeText ? headingFromTimedLine(first, chunk.timeText) : first;
    const descriptionParts = chunk.timeText ? [first, rest].filter(Boolean) : chunk.lines;
    return {
      heading,
      description: descriptionParts.join("\n"),
      timeText: chunk.timeText,
    };
  });
}
