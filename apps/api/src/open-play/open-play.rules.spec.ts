import {
  DEFAULT_OPEN_PLAY_CAPACITY,
  MAX_OPEN_PLAY_CAPACITY,
  OPEN_PLAY_CUTOFF_MS,
  hasStarted,
  isFull,
  isInsideCutoff,
  latestLeaveableStart,
} from './open-play.rules';

const START = new Date('2026-11-01T10:00:00.000Z');

describe('open-play rules', () => {
  it('defaults capacity to 4, caps it at 64, and sets the cutoff to 24h', () => {
    expect(DEFAULT_OPEN_PLAY_CAPACITY).toBe(4);
    expect(MAX_OPEN_PLAY_CAPACITY).toBe(64);
    expect(OPEN_PLAY_CUTOFF_MS).toBe(24 * 60 * 60 * 1000);
  });

  describe('hasStarted', () => {
    it('is false one ms before start', () => {
      expect(hasStarted(START, new Date(START.getTime() - 1))).toBe(false);
    });
    it('is true exactly at start', () => {
      expect(hasStarted(START, START)).toBe(true);
    });
  });

  describe('isInsideCutoff', () => {
    it('is false exactly 24h before start (still allowed)', () => {
      const now = new Date(START.getTime() - OPEN_PLAY_CUTOFF_MS);
      expect(isInsideCutoff(START, now)).toBe(false);
    });
    it('is true one ms after the 24h mark', () => {
      const now = new Date(START.getTime() - OPEN_PLAY_CUTOFF_MS + 1);
      expect(isInsideCutoff(START, now)).toBe(true);
    });
  });

  describe('latestLeaveableStart', () => {
    it('is now + 24h, so bookDate >= it means outside the cutoff', () => {
      const now = new Date('2026-10-31T10:00:00.000Z');
      expect(latestLeaveableStart(now).toISOString()).toBe(
        '2026-11-01T10:00:00.000Z',
      );
    });
  });

  describe('isFull', () => {
    it('is false below capacity', () => {
      expect(isFull(3, 4)).toBe(false);
    });
    it('is true at capacity', () => {
      expect(isFull(4, 4)).toBe(true);
    });
    it('treats capacity 1 with the booker seated as full', () => {
      expect(isFull(1, 1)).toBe(true);
    });
  });
});
