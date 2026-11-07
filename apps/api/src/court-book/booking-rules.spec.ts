import {
  bookingRulesFromRecord,
  DEFAULT_VENUE_BOOKING_SETTINGS,
  evaluateBookingRules,
  formatHhMm,
  HH_MM_PATTERN,
  isValidTimeZone,
  localParts,
  MAX_BOOKING_DURATION_HOURS,
  MAX_HORIZON_DAYS,
  parseHhMm,
  toInstant,
  validateBookingSettings,
  WEEKDAY_KEYS,
  weeklyWindowsToRows,
  type BookingRules,
  type BookingSettingsRecord,
  type DayWindow,
  type WeeklyWindows,
} from './booking-rules';

const HOUR = 3_600_000;
const DAY = 24 * HOUR;
const allDays = (window: DayWindow | null): WeeklyWindows =>
  Object.fromEntries(WEEKDAY_KEYS.map((day) => [day, window])) as WeeklyWindows;
const rulesWith = (overrides: Partial<BookingRules> = {}): BookingRules => ({
  ...DEFAULT_VENUE_BOOKING_SETTINGS,
  weeklyWindows: { ...DEFAULT_VENUE_BOOKING_SETTINGS.weeklyWindows },
  ...overrides,
});
const evaluate = (
  start: string,
  durationHours = 1,
  rules = rulesWith(),
  timeZone = 'Asia/Manila',
  now = '2026-11-08T00:00:00Z',
) =>
  evaluateBookingRules({
    start: new Date(start),
    durationHours,
    rules,
    timeZone,
    now: new Date(now),
  });

describe('toInstant / localParts', () => {
  it.each([
    ['Asia/Manila', 600, '2026-11-09T02:00:00.000Z'],
    ['Asia/Kolkata', 600, '2026-11-09T04:30:00.000Z'],
    ['Asia/Kathmandu', 600, '2026-11-09T04:15:00.000Z'],
  ])('converts 10:00 in %s', (zone, minute, expected) => {
    expect(
      toInstant({ year: 2026, month: 11, day: 9 }, minute, zone).toISOString(),
    ).toBe(expected);
  });
  it('moves a nonexistent New York time forward by the spring gap', () => {
    expect(
      toInstant(
        { year: 2026, month: 3, day: 8 },
        150,
        'America/New_York',
      ).toISOString(),
    ).toBe('2026-03-08T07:30:00.000Z');
  });
  it('chooses the earlier occurrence in the New York fall overlap', () => {
    expect(
      toInstant(
        { year: 2026, month: 11, day: 1 },
        90,
        'America/New_York',
      ).toISOString(),
    ).toBe('2026-11-01T05:30:00.000Z');
  });
  it('reads local calendar parts with seconds and milliseconds', () => {
    expect(
      localParts(new Date('2026-11-09T04:15:12.123Z'), 'Asia/Kathmandu'),
    ).toEqual({
      year: 2026,
      month: 11,
      day: 9,
      hour: 10,
      minute: 0,
      second: 12,
      millisecond: 123,
    });
  });
});

describe('operating windows', () => {
  const rules = rulesWith({
    weeklyWindows: {
      ...allDays({ opensAtMinute: 360, closesAtMinute: 0 }),
      saturday: { opensAtMinute: 360, closesAtMinute: 180 },
      sunday: { opensAtMinute: 360, closesAtMinute: 180 },
    },
  });
  it.each([
    ['2026-11-09T15:00Z', 1, null],
    ['2026-11-09T15:00Z', 2, 'OUTSIDE_OPENING_HOURS'],
    ['2026-11-09T21:00Z', 1, 'OUTSIDE_OPENING_HOURS'],
    ['2026-11-14T18:00Z', 1, null],
    ['2026-11-14T18:00Z', 2, 'OUTSIDE_OPENING_HOURS'],
    ['2026-11-15T17:00Z', 1, null],
    ['2026-11-08T22:00Z', 1, null],
    ['2026-11-09T16:00Z', 1, 'OUTSIDE_OPENING_HOURS'],
  ])('evaluates %s for %sh as %s', (start, duration, expected) => {
    expect(evaluate(start, duration, rules)).toBe(expected);
  });
  it('rejects a booking on a closed day', () => {
    expect(
      evaluate(
        '2026-11-10T02:00Z',
        1,
        rulesWith({ weeklyWindows: { ...rules.weeklyWindows, tuesday: null } }),
      ),
    ).toBe('OUTSIDE_OPENING_HOURS');
  });
  it.each([
    ['2026-11-08T22:00Z', 24],
    ['2026-11-09T21:00Z', 1],
  ])('supports a 24h Monday window at %s', (start, duration) => {
    expect(
      evaluate(
        start,
        duration,
        rulesWith({
          maxDurationHours: 24,
          weeklyWindows: {
            ...allDays(null),
            monday: { opensAtMinute: 360, closesAtMinute: 360 },
          },
        }),
      ),
    ).toBeNull();
  });
  it.each([
    [2, 'OUTSIDE_OPENING_HOURS'],
    [1, null],
  ])('requires one whole operating window for %sh', (duration, expected) => {
    expect(
      evaluate(
        '2026-11-09T15:00Z',
        duration,
        rulesWith({
          weeklyWindows: allDays({ opensAtMinute: 0, closesAtMinute: 0 }),
        }),
      ),
    ).toBe(expected);
  });
  it('rejects the default midnight closing boundary', () => {
    expect(evaluate('2026-11-09T16:00Z')).toBe('OUTSIDE_OPENING_HOURS');
  });
  it.each([
    ['2026-11-01T00:00Z', 8, null],
    ['2026-11-01T00:00Z', 9, 'OUTSIDE_OPENING_HOURS'],
    ['2026-03-08T01:00Z', 6, null],
    ['2026-03-08T01:00Z', 7, 'OUTSIDE_OPENING_HOURS'],
  ])(
    'measures DST window %s in elapsed hours (%s)',
    (start, duration, expected) => {
      expect(
        evaluate(
          start,
          duration,
          rulesWith({
            maxDurationHours: 9,
            horizonDays: 365,
            weeklyWindows: {
              ...allDays(null),
              saturday: { opensAtMinute: 1200, closesAtMinute: 180 },
            },
          }),
          'America/New_York',
          '2026-01-01T00:00Z',
        ),
      ).toBe(expected);
    },
  );
});

describe('alignment', () => {
  it.each([
    ['2026-11-09T02:00Z', 'HOUR', 'Asia/Manila', null],
    ['2026-11-09T02:30Z', 'HOUR', 'Asia/Manila', 'NOT_SLOT_ALIGNED'],
    ['2026-11-09T02:30Z', 'HALF_HOUR', 'Asia/Manila', null],
    ['2026-11-09T02:15Z', 'HALF_HOUR', 'Asia/Manila', 'NOT_SLOT_ALIGNED'],
    ['2026-11-09T02:00:01Z', 'HALF_HOUR', 'Asia/Manila', 'NOT_SLOT_ALIGNED'],
    ['2026-11-09T02:00:00.001Z', 'HOUR', 'Asia/Manila', 'NOT_SLOT_ALIGNED'],
    ['2026-11-09T04:30Z', 'HOUR', 'Asia/Kolkata', null],
    ['2026-11-09T04:00Z', 'HOUR', 'Asia/Kolkata', 'NOT_SLOT_ALIGNED'],
    ['2026-11-09T04:00Z', 'HALF_HOUR', 'Asia/Kolkata', null],
    ['2026-11-09T04:15Z', 'HOUR', 'Asia/Kathmandu', null],
    ['2026-11-09T04:00Z', 'HALF_HOUR', 'Asia/Kathmandu', 'NOT_SLOT_ALIGNED'],
  ] as const)(
    'checks local boundaries for %s %s %s',
    (start, startAlignment, zone, expected) => {
      expect(
        evaluate(
          start,
          1,
          rulesWith({
            startAlignment,
            weeklyWindows: allDays({ opensAtMinute: 0, closesAtMinute: 0 }),
          }),
          zone,
        ),
      ).toBe(expected);
    },
  );
});

describe('time and duration bounds', () => {
  const now = new Date('2026-11-09T02:00Z');
  const check = (start: Date, durationHours = 1) =>
    evaluateBookingRules({
      start,
      durationHours,
      now,
      timeZone: 'Asia/Manila',
      rules: rulesWith(),
    });
  it('rejects equality and earlier starts before all other rules', () => {
    expect(check(now, 0)).toBe('START_IN_PAST');
    expect(check(new Date(now.getTime() - 1))).toBe('START_IN_PAST');
  });
  it('includes the exact elapsed horizon and checks it before duration/alignment', () => {
    expect(check(new Date(now.getTime() + 60 * DAY))).toBeNull();
    expect(check(new Date(now.getTime() + 60 * DAY + 1), 0)).toBe(
      'BEYOND_HORIZON',
    );
  });
  it.each([
    [0, 'DURATION_OUT_OF_RANGE'],
    [8, null],
    [9, 'DURATION_OUT_OF_RANGE'],
  ])('checks duration %s', (duration, expected) => {
    expect(check(new Date('2026-11-10T02:00Z'), duration)).toBe(expected);
  });
  it('checks duration before alignment and alignment before closed windows', () => {
    expect(check(new Date('2026-11-10T02:15Z'), 0)).toBe(
      'DURATION_OUT_OF_RANGE',
    );
    expect(
      evaluate(
        '2026-11-10T02:15Z',
        1,
        rulesWith({ weeklyWindows: allDays(null) }),
      ),
    ).toBe('NOT_SLOT_ALIGNED');
  });
});

describe('validateBookingSettings', () => {
  it.each([
    [120, "saturday's hours run past sunday's opening time"],
    [180, null],
  ])('checks Saturday spill against Sunday opening %s', (opening, expected) => {
    expect(
      validateBookingSettings(
        rulesWith({
          weeklyWindows: {
            ...allDays(null),
            saturday: { opensAtMinute: 360, closesAtMinute: 180 },
            sunday: { opensAtMinute: opening, closesAtMinute: 0 },
          },
        }),
      ),
    ).toBe(expected);
  });
  it('checks the Sunday to Monday wrap', () => {
    expect(
      validateBookingSettings(
        rulesWith({
          weeklyWindows: {
            ...allDays(null),
            sunday: { opensAtMinute: 1320, closesAtMinute: 120 },
            monday: { opensAtMinute: 60, closesAtMinute: 0 },
          },
        }),
      ),
    ).toBe("sunday's hours run past monday's opening time");
  });
  it('allows back-to-back windows and closed days', () => {
    expect(
      validateBookingSettings(
        rulesWith({
          weeklyWindows: {
            ...allDays(null),
            saturday: { opensAtMinute: 360, closesAtMinute: 360 },
            sunday: { opensAtMinute: 360, closesAtMinute: 0 },
          },
        }),
      ),
    ).toBeNull();
    expect(
      validateBookingSettings(rulesWith({ weeklyWindows: allDays(null) })),
    ).toBeNull();
  });
  it('checks min/max before window length', () => {
    expect(
      validateBookingSettings(
        rulesWith({ minDurationHours: 3, maxDurationHours: 2 }),
      ),
    ).toBe('maxDurationHours must be at least minDurationHours');
  });
  it('rejects a short window', () => {
    expect(
      validateBookingSettings(
        rulesWith({
          minDurationHours: 2,
          weeklyWindows: {
            ...allDays(null),
            monday: { opensAtMinute: 600, closesAtMinute: 660 },
          },
        }),
      ),
    ).toBe("monday's hours are shorter than minDurationHours");
  });
});

describe('formats and mapping', () => {
  it.each([
    ['06:00', 360],
    ['23:30', 1410],
    ['00:00', 0],
    ['6:00', null],
    ['06:15', null],
    ['24:00', null],
  ])('parses %s', (value, expected) => {
    expect(parseHhMm(value)).toBe(expected);
    expect(HH_MM_PATTERN.test(value)).toBe(expected !== null);
  });
  it('formats minutes and exports hard caps', () => {
    expect(formatHhMm(390)).toBe('06:30');
    expect(MAX_BOOKING_DURATION_HOURS).toBe(24);
    expect(MAX_HORIZON_DAYS).toBe(365);
  });
  it('validates timezones', () => {
    expect(isValidTimeZone('Asia/Manila')).toBe(true);
    expect(isValidTimeZone('Mars/Phobos')).toBe(false);
  });
  it('uses the single defaults only for an absent settings row', () => {
    expect(bookingRulesFromRecord(null)).toEqual(
      DEFAULT_VENUE_BOOKING_SETTINGS,
    );
    expect(DEFAULT_VENUE_BOOKING_SETTINGS).toEqual({
      minDurationHours: 1,
      maxDurationHours: 8,
      horizonDays: 60,
      startAlignment: 'HOUR',
      weeklyWindows: allDays({ opensAtMinute: 360, closesAtMinute: 0 }),
    });
    const record: BookingSettingsRecord = {
      minDurationHours: 2,
      maxDurationHours: 4,
      horizonDays: 7,
      startAlignment: 'HALF_HOUR',
      openingHours: [],
    };
    expect(bookingRulesFromRecord(record).weeklyWindows).toEqual(allDays(null));
    const windows = {
      ...allDays(null),
      monday: { opensAtMinute: 600, closesAtMinute: 720 },
      sunday: { opensAtMinute: 1320, closesAtMinute: 120 },
    };
    const rows = weeklyWindowsToRows(windows);
    expect(rows).toEqual([
      { weekday: 'MONDAY', opensAtMinute: 600, closesAtMinute: 720 },
      { weekday: 'SUNDAY', opensAtMinute: 1320, closesAtMinute: 120 },
    ]);
    expect(bookingRulesFromRecord({ ...record, openingHours: rows })).toEqual({
      minDurationHours: 2,
      maxDurationHours: 4,
      horizonDays: 7,
      startAlignment: 'HALF_HOUR',
      weeklyWindows: windows,
    });
  });
});
