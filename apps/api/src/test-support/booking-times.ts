import {
  localParts,
  toInstant,
  type WeekdayKey,
} from '../court-book/booking-rules';

export function localSlot(
  timeZone: string,
  daysAhead: number,
  minuteOfDay: number,
): Date {
  const today = localParts(new Date(), timeZone);
  const shifted = new Date(
    Date.UTC(today.year, today.month - 1, today.day + daysAhead),
  );
  return toInstant(
    {
      year: shifted.getUTCFullYear(),
      month: shifted.getUTCMonth() + 1,
      day: shifted.getUTCDate(),
    },
    minuteOfDay,
    timeZone,
  );
}

export function nextLocalWeekday(
  timeZone: string,
  weekday: WeekdayKey,
  minuteOfDay: number,
  minLeadMs: number,
): Date {
  const threshold = Date.now() + minLeadMs;
  for (let day = 0; ; day++) {
    const slot = localSlot(timeZone, day, minuteOfDay);
    const name = new Intl.DateTimeFormat('en-US', { timeZone, weekday: 'long' })
      .format(slot)
      .toLowerCase();
    if (name === weekday && slot.getTime() > threshold) return slot;
  }
}
