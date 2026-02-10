import { supabase } from "@/lib/supabase";

const MS_PER_DAY = 1000 * 60 * 60 * 24;
const DEFAULT_WINDOW_DAYS = 28;

export type UpcomingBirthdayMember = {
  id: string;
  username: string;
  name: string;
  phone: string;
  birthDate: string;
  month: number;
  day: number;
  daysLeft: number;
};

function getKstTodayParts() {
  const now = new Date();
  const kst = new Date(now.toLocaleString("en-US", { timeZone: "Asia/Seoul" }));
  return {
    year: kst.getFullYear(),
    month: kst.getMonth() + 1,
    day: kst.getDate(),
  };
}

function getUtcDayNumber(year: number, month: number, day: number) {
  return Date.UTC(year, month - 1, day) / MS_PER_DAY;
}

function getSafeBirthdayUtcDayNumber(year: number, month: number, day: number) {
  const candidate = new Date(Date.UTC(year, month - 1, day));
  const validMonth = candidate.getUTCMonth() + 1;
  const validDay = candidate.getUTCDate();

  if (validMonth === month && validDay === day) {
    return getUtcDayNumber(year, month, day);
  }

  // 2/29 생년월일은 평년 기준 2/28로 처리
  if (month === 2 && day === 29) {
    return getUtcDayNumber(year, 2, 28);
  }

  return getUtcDayNumber(year, month, Math.min(day, 28));
}

function parseBirthDate(dateText: string) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dateText);
  if (!match) return null;
  const month = Number(match[2]);
  const day = Number(match[3]);
  if (!Number.isFinite(month) || !Number.isFinite(day)) return null;
  return { month, day };
}

export async function getUpcomingBirthdays(windowDays = DEFAULT_WINDOW_DAYS) {
  const { data, error } = await supabase
    .from("members")
    .select("id,username,name,phone,birth_date");

  if (error) {
    return [] as UpcomingBirthdayMember[];
  }

  const today = getKstTodayParts();
  const todayDayNumber = getUtcDayNumber(today.year, today.month, today.day);

  const upcoming = (data ?? [])
    .map((row) => {
      const raw = row as Record<string, unknown>;
      const birthDate = typeof raw.birth_date === "string" ? raw.birth_date : "";
      const parsed = parseBirthDate(birthDate);
      if (!parsed) return null;

      let nextBirthdayDayNumber = getSafeBirthdayUtcDayNumber(today.year, parsed.month, parsed.day);
      let daysLeft = nextBirthdayDayNumber - todayDayNumber;
      if (daysLeft < 0) {
        nextBirthdayDayNumber = getSafeBirthdayUtcDayNumber(today.year + 1, parsed.month, parsed.day);
        daysLeft = nextBirthdayDayNumber - todayDayNumber;
      }

      return {
        id: String(raw.id ?? ""),
        username: String(raw.username ?? ""),
        name: String(raw.name ?? ""),
        phone: String(raw.phone ?? ""),
        birthDate,
        month: parsed.month,
        day: parsed.day,
        daysLeft,
      } satisfies UpcomingBirthdayMember;
    })
    .filter((item): item is UpcomingBirthdayMember => item !== null)
    .filter((item) => item.daysLeft >= 0 && item.daysLeft <= windowDays)
    .sort((a, b) => (a.daysLeft !== b.daysLeft ? a.daysLeft - b.daysLeft : a.name.localeCompare(b.name, "ko")));

  return upcoming;
}
