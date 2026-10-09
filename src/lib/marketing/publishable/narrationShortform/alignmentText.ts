import { sceneHash } from "../narrationScenes/service";

/**
 * Spoken-form lattice for forced alignment. Each unit keeps the code point range [cpStart, cpEnd) of the approved sentence text
 * and lists candidate readings; the aligner picks the reading that best matches the audio. The sentence text itself is never rewritten.
 * A reading is Hangul syllables, optionally with spaces (word boundaries), or the single wildcard "*" (any speech, e.g. Latin words).
 */
export const ALIGNMENT_NORMALIZER_VERSION = "ko-spoken-lattice-v1" as const;
export const ALIGNMENT_WILDCARD = "*";
export type AlignmentUnit = { cpStart: number; cpEnd: number; kind: "hangul" | "number" | "latin" | "symbol"; readings: string[] };

const SINO = ["", "일", "이", "삼", "사", "오", "육", "칠", "팔", "구"];
const DIGIT_NAMES = ["영", "일", "이", "삼", "사", "오", "육", "칠", "팔", "구"];
const NATIVE_ONES = ["", "하나", "둘", "셋", "넷", "다섯", "여섯", "일곱", "여덟", "아홉"];
const NATIVE_ONES_ATTR = ["", "한", "두", "세", "네", "다섯", "여섯", "일곱", "여덟", "아홉"];
const NATIVE_TENS = ["", "열", "스물", "서른", "마흔", "쉰", "예순", "일흔", "여든", "아흔"];
const LETTER_NAMES: Record<string, string> = { A: "에이", B: "비", C: "씨", D: "디", E: "이", F: "에프", G: "지", H: "에이치", I: "아이", J: "제이", K: "케이", L: "엘", M: "엠",
  N: "엔", O: "오", P: "피", Q: "큐", R: "알", S: "에스", T: "티", U: "유", V: "브이", W: "더블유", X: "엑스", Y: "와이", Z: "제트" };
/** Counters read with native numbers (한 시, 두 명); the sino reading stays a candidate because usage varies. */
const NATIVE_COUNTERS = ["시간", "시", "개", "명", "살", "마리", "잔", "권", "곳", "군데", "가지", "번째", "번", "사람", "그릇", "대", "척", "켤레", "벌", "채"];
const UNIT_READINGS: Record<string, string[]> = { "%": ["퍼센트", "프로"], "km": ["킬로미터", "킬로"], "m": ["미터"], "cm": ["센티미터", "센티"], "kg": ["킬로그램", "킬로"],
  "g": ["그램"], "℃": ["도"], "°C": ["도"], "°": ["도"], "$": ["달러"], "₩": ["원"], "+": ["플러스"], "&": ["앤드", "앤"] };
/** Numbers, times and ranges also carry the wildcard: TTS engines may read them in English ("seven", "nine to six"), which no Hangul candidate covers. */
const RANGE_READINGS = ["", "에서", "부터", "까지", "물결", ALIGNMENT_WILDCARD];

const isHangul = (c: string) => c >= "가" && c <= "힣";
const isDigit = (c: string) => c >= "0" && c <= "9";
const isLatin = (c: string) => /[A-Za-z]/.test(c);
const unique = (values: string[]) => [...new Set(values)];

function sinoBelow10000(n: number) {
  let out = ""; const digits = [Math.floor(n / 1000), Math.floor(n / 100) % 10, Math.floor(n / 10) % 10, n % 10];
  for (const [i, unit] of ["천", "백", "십", ""].entries()) { const d = digits[i]!; if (d) out += (d === 1 && unit ? "" : SINO[d]) + unit; }
  return out;
}
export function sinoKorean(value: bigint): string {
  if (value === BigInt(0)) return "영";
  const units = ["", "만", "억", "조", "경"]; let out = ""; let rest = value;
  for (let i = 0; rest > BigInt(0) && i < units.length; i++) {
    const group = Number(rest % BigInt(10000)); rest /= BigInt(10000);
    if (group) out = (group === 1 && i === 1 && rest === BigInt(0) ? "" : sinoBelow10000(group)) + units[i] + out;
  }
  return out;
}
function nativeKorean(n: number, attributive: boolean) {
  if (n < 1 || n > 99) return null;
  if (n === 20 && attributive) return "스무";
  return NATIVE_TENS[Math.floor(n / 10)]! + (attributive ? NATIVE_ONES_ATTR : NATIVE_ONES)[n % 10]!;
}
const digitwise = (digits: string) => unique([[...digits].map(d => DIGIT_NAMES[Number(d)]).join(""), [...digits].map(d => d === "0" ? "공" : DIGIT_NAMES[Number(d)]).join("")]);

/** Candidate readings of an integer written as `digits`, given the Hangul that follows it (a counter such as 시, 월, 원). */
function integerReadings(digits: string, following: string) {
  const value = BigInt(digits); const n = Number(value); const out: string[] = [];
  const counter = NATIVE_COUNTERS.find(c => following.startsWith(c));
  if (following.startsWith("월") && (n === 6 || n === 10)) out.push(n === 6 ? "유" : "시");
  if (counter) { const native = nativeKorean(n, true); if (native) out.push(native); }
  out.push(sinoKorean(value));
  if (!counter) { const native = nativeKorean(n, false); if (native && n <= 20) out.push(native); }
  if (digits.length > 1 && (digits.startsWith("0") || digits.length >= 5)) out.push(...digitwise(digits));
  return unique(out);
}
function timeReadings(hour: string, minute: string) {
  const h = Number(hour); const m = Number(minute); const hours = unique([...(h >= 1 && h <= 12 ? [nativeKorean(h, true)!] : []), ...(h >= 13 && h <= 24 ? [nativeKorean(h, true)!] : []), sinoKorean(BigInt(h)), ...(hour.startsWith("0") ? digitwise(hour) : [])]);
  const minutes = m === 0 ? ["", "영분", "정각"] : unique([`${sinoKorean(BigInt(m))}분`, ...(m === 30 ? ["반"] : [])]);
  const out: string[] = [];
  for (const hh of hours) for (const mm of minutes) out.push(mm ? `${hh}시 ${mm}` : `${hh}시`);
  out.push(...digitwise(hour + minute), ...digitwise(hour).flatMap(a => digitwise(minute).map(b => `${a} ${b}`)));
  return unique(out);
}

/** Splits the approved sentence into lattice units. Whitespace and pure punctuation produce no unit (they are word boundaries/silence). */
export function alignmentUnits(text: string): AlignmentUnit[] {
  const cps = [...text]; const units: AlignmentUnit[] = []; let paren = 0;
  const followingHangul = (from: number) => { let j = from; while (j < cps.length && cps[j] === " ") j++; let s = ""; while (j < cps.length && isHangul(cps[j]!)) s += cps[j++]; return s; };
  for (let i = 0; i < cps.length;) {
    const c = cps[i]!;
    if (c === "(" || c === "（") { paren++; i++; continue; }
    if (c === ")" || c === "）") { paren = Math.max(0, paren - 1); i++; continue; }
    if (isHangul(c)) { let j = i; while (j < cps.length && isHangul(cps[j]!)) j++; const s = cps.slice(i, j).join(""); units.push({ cpStart: i, cpEnd: j, kind: "hangul", readings: paren ? [s, ""] : [s] }); i = j; continue; }
    if (isDigit(c)) {
      const time = /^(\d{1,2}):(\d{2})/.exec(cps.slice(i, i + 5).join(""));
      if (time) { units.push({ cpStart: i, cpEnd: i + time[0].length, kind: "number", readings: [...timeReadings(time[1]!, time[2]!), ALIGNMENT_WILDCARD] }); i += time[0].length; continue; }
      let j = i; while (j < cps.length && (isDigit(cps[j]!) || (cps[j] === "," && isDigit(cps[j + 1] ?? "") && isDigit(cps[j - 1] ?? "")))) j++;
      const digits = cps.slice(i, j).join("").replace(/,/g, "");
      if (cps[j] === "." && isDigit(cps[j + 1] ?? "")) {
        let k = j + 1; while (k < cps.length && isDigit(cps[k]!)) k++; const fraction = cps.slice(j + 1, k).join("");
        units.push({ cpStart: i, cpEnd: k, kind: "number", readings: unique([`${sinoKorean(BigInt(digits))}점${[...fraction].map(d => DIGIT_NAMES[Number(d)]).join("")}`, ...integerReadings(digits, "").flatMap(a => integerReadings(fraction, followingHangul(k)).map(b => `${a} ${b}`)), ALIGNMENT_WILDCARD]) });
        i = k; continue;
      }
      units.push({ cpStart: i, cpEnd: j, kind: "number", readings: [...integerReadings(digits, followingHangul(j)), ALIGNMENT_WILDCARD] }); i = j; continue;
    }
    if (isLatin(c)) {
      let j = i; while (j < cps.length && (isLatin(cps[j]!) || (cps[j] === "'" && isLatin(cps[j + 1] ?? "")))) j++; const word = cps.slice(i, j).join("");
      const unit = word.toLowerCase() in UNIT_READINGS && units.at(-1)?.kind === "number" && units.at(-1)!.cpEnd === i ? UNIT_READINGS[word.toLowerCase()]! : null;
      const letters = /^[A-Z]{1,5}$/.test(word) ? [[...word].map(l => LETTER_NAMES[l]).join("")] : [];
      units.push({ cpStart: i, cpEnd: j, kind: "latin", readings: unit ?? [...letters, ALIGNMENT_WILDCARD] }); i = j; continue;
    }
    const two = cps.slice(i, i + 2).join("");
    if (UNIT_READINGS[two]) { units.push({ cpStart: i, cpEnd: i + 2, kind: "symbol", readings: UNIT_READINGS[two]! }); i += 2; continue; }
    if (UNIT_READINGS[c]) { units.push({ cpStart: i, cpEnd: i + 1, kind: "symbol", readings: UNIT_READINGS[c]! }); i++; continue; }
    if ((c === "~" || c === "～" || c === "-" || c === "–") && units.at(-1)?.kind === "number" && isDigit(cps[i + 1] ?? "")) { units.push({ cpStart: i, cpEnd: i + 1, kind: "symbol", readings: RANGE_READINGS }); i++; continue; }
    i++;
  }
  return units;
}
/** Identity of the text side of an alignment: approved sentence text plus the exact lattice handed to the aligner. */
export function alignmentTextFingerprint(text: string, units = alignmentUnits(text)) {
  return sceneHash({ normalizer: ALIGNMENT_NORMALIZER_VERSION, text, units });
}
