export type StartAlignment = 'HOUR' | 'HALF_HOUR';
export const WEEKDAY_KEYS = [
  'monday',
  'tuesday',
  'wednesday',
  'thursday',
  'friday',
  'saturday',
  'sunday',
] as const;
export type WeekdayKey = (typeof WEEKDAY_KEYS)[number];
export type WeekdayEnum = Uppercase<WeekdayKey>;
export type DayWindow = { opensAtMinute: number; closesAtMinute: number };
export type WeeklyWindows = Record<WeekdayKey, DayWindow | null>;
export type BookingRules = {
  minDurationHours: number;
  maxDurationHours: number;
  horizonDays: number;
  startAlignment: StartAlignment;
  weeklyWindows: WeeklyWindows;
};

function emptyWindows(): WeeklyWindows {
  return Object.fromEntries(
    WEEKDAY_KEYS.map((day) => [day, null]),
  ) as WeeklyWindows;
}

export const DEFAULT_VENUE_BOOKING_SETTINGS: BookingRules = Object.freeze({
  minDurationHours: 1,
  maxDurationHours: 8,
  horizonDays: 60,
  startAlignment: 'HOUR',
  weeklyWindows: Object.freeze(
    Object.fromEntries(
      WEEKDAY_KEYS.map((day) => [
        day,
        Object.freeze({ opensAtMinute: 360, closesAtMinute: 0 }),
      ]),
    ) as WeeklyWindows,
  ),
});
export const MAX_BOOKING_DURATION_HOURS = 24;
export const MAX_HORIZON_DAYS = 365;
export const HH_MM_PATTERN = /^([01]\d|2[0-3]):(00|30)$/;
const HOUR_MS = 3_600_000;
const DAY_MS = 24 * HOUR_MS;
const DAY_MINUTES = 1440;

export function parseHhMm(value: string): number | null {
  if (!HH_MM_PATTERN.test(value)) return null;
  return Number(value.slice(0, 2)) * 60 + Number(value.slice(3));
}

export function formatHhMm(minuteOfDay: number): string {
  return `${String(Math.floor(minuteOfDay / 60)).padStart(2, '0')}:${String(minuteOfDay % 60).padStart(2, '0')}`;
}

export function isValidTimeZone(timeZone: string): boolean {
  try {
    new Intl.DateTimeFormat('en-US', { timeZone });
    return true;
  } catch {
    return false;
  }
}

export type LocalDate = { year: number; month: number; day: number };
type LocalParts = LocalDate & {
  hour: number;
  minute: number;
  second: number;
  millisecond: number;
};

export function localParts(instant: Date, timeZone: string): LocalParts {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(instant);
  const read = (type: Intl.DateTimeFormatPartTypes): number =>
    Number(parts.find((part) => part.type === type)?.value);
  return {
    year: read('year'),
    month: read('month'),
    day: read('day'),
    hour: read('hour'),
    minute: read('minute'),
    second: read('second'),
    millisecond: instant.getUTCMilliseconds(),
  };
}

function wallMilliseconds(parts: LocalParts): number {
  return Date.UTC(
    parts.year,
    parts.month - 1,
    parts.day,
    parts.hour,
    parts.minute,
    parts.second,
    parts.millisecond,
  );
}

/** Resolve gaps forward and repeated wall times to their earlier instant. */
export function toInstant(
  date: LocalDate,
  minuteOfDay: number,
  timeZone: string,
): Date {
  const wall = Date.UTC(date.year, date.month - 1, date.day, 0, minuteOfDay);
  const offset = (instant: number): number =>
    wallMilliseconds(localParts(new Date(instant), timeZone)) - instant;
  const before = wall - offset(wall - DAY_MS);
  const after = wall - offset(wall + DAY_MS);
  const candidates = [before, after].filter(
    (candidate) =>
      wallMilliseconds(localParts(new Date(candidate), timeZone)) === wall,
  );
  return new Date(candidates.length ? Math.min(...candidates) : before);
}

function shiftDate(date: LocalDate, days: number): LocalDate {
  const shifted = new Date(
    Date.UTC(date.year, date.month - 1, date.day + days),
  );
  return {
    year: shifted.getUTCFullYear(),
    month: shifted.getUTCMonth() + 1,
    day: shifted.getUTCDate(),
  };
}

function weekday(date: LocalDate): WeekdayKey {
  const sundayFirst = new Date(
    Date.UTC(date.year, date.month - 1, date.day),
  ).getUTCDay();
  return WEEKDAY_KEYS[(sundayFirst + 6) % 7];
}

export type BookingRuleViolation =
  | 'START_IN_PAST'
  | 'BEYOND_HORIZON'
  | 'DURATION_OUT_OF_RANGE'
  | 'NOT_SLOT_ALIGNED'
  | 'OUTSIDE_OPENING_HOURS';

export function evaluateBookingRules(args: {
  start: Date;
  durationHours: number;
  now: Date;
  timeZone: string;
  rules: BookingRules;
}): BookingRuleViolation | null {
  const { start, durationHours, now, timeZone, rules } = args;
  if (start.getTime() <= now.getTime()) return 'START_IN_PAST';
  if (start.getTime() > now.getTime() + rules.horizonDays * DAY_MS)
    return 'BEYOND_HORIZON';
  if (
    durationHours < rules.minDurationHours ||
    durationHours > rules.maxDurationHours
  )
    return 'DURATION_OUT_OF_RANGE';
  const local = localParts(start, timeZone);
  if (
    local.second !== 0 ||
    local.millisecond !== 0 ||
    (rules.startAlignment === 'HOUR'
      ? local.minute !== 0
      : local.minute !== 0 && local.minute !== 30)
  )
    return 'NOT_SLOT_ALIGNED';
  const end = start.getTime() + durationHours * HOUR_MS;
  for (const date of [local, shiftDate(local, -1)]) {
    const window = rules.weeklyWindows[weekday(date)];
    if (!window) continue;
    const crosses = window.closesAtMinute <= window.opensAtMinute;
    const windowStart = toInstant(date, window.opensAtMinute, timeZone);
    const windowEnd = toInstant(
      shiftDate(date, crosses ? 1 : 0),
      window.closesAtMinute,
      timeZone,
    );
    if (windowStart.getTime() <= start.getTime() && end <= windowEnd.getTime())
      return null;
  }
  return 'OUTSIDE_OPENING_HOURS';
}

/** Formats and scalar ranges are validated by the caller's DTO. */
export function validateBookingSettings(rules: BookingRules): string | null {
  if (rules.maxDurationHours < rules.minDurationHours)
    return 'maxDurationHours must be at least minDurationHours';
  for (const [index, day] of WEEKDAY_KEYS.entries()) {
    const window = rules.weeklyWindows[day];
    if (!window) continue;
    const length =
      (window.closesAtMinute - window.opensAtMinute + DAY_MINUTES) %
        DAY_MINUTES || DAY_MINUTES;
    if (length < rules.minDurationHours * 60)
      return `${day}'s hours are shorter than minDurationHours`;
    const nextDay = WEEKDAY_KEYS[(index + 1) % WEEKDAY_KEYS.length];
    const nextWindow = rules.weeklyWindows[nextDay];
    if (
      window.closesAtMinute <= window.opensAtMinute &&
      nextWindow &&
      window.closesAtMinute > nextWindow.opensAtMinute
    )
      return `${day}'s hours run past ${nextDay}'s opening time`;
  }
  return null;
}

export type BookingSettingsRecord = {
  minDurationHours: number;
  maxDurationHours: number;
  horizonDays: number;
  startAlignment: StartAlignment;
  openingHours: {
    weekday: WeekdayEnum;
    opensAtMinute: number;
    closesAtMinute: number;
  }[];
};

export function bookingRulesFromRecord(
  record: BookingSettingsRecord | null,
): BookingRules {
  if (!record) return DEFAULT_VENUE_BOOKING_SETTINGS;
  const { openingHours, ...rules } = record;
  const weeklyWindows = emptyWindows();
  for (const { weekday, opensAtMinute, closesAtMinute } of openingHours) {
    weeklyWindows[weekday.toLowerCase() as WeekdayKey] = {
      opensAtMinute,
      closesAtMinute,
    };
  }
  return { ...rules, weeklyWindows };
}

export function weeklyWindowsToRows(
  windows: WeeklyWindows,
): BookingSettingsRecord['openingHours'] {
  return WEEKDAY_KEYS.flatMap((day) => {
    const window = windows[day];
    return window
      ? [{ weekday: day.toUpperCase() as WeekdayEnum, ...window }]
      : [];
  });
}
