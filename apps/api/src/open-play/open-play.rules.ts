/** Seats (including the booker's) when the creator gives no capacity. */
export const DEFAULT_OPEN_PLAY_CAPACITY = 4;

/**
 * Product cap on capacity. Keeps DTO input far below Postgres `Int` range
 * (an unbounded value would overflow the column and surface as a 500).
 * The web Zod schema mirrors this value.
 */
export const MAX_OPEN_PLAY_CAPACITY = 64;

/** Discovery pagination defaults. */
export const DEFAULT_OPEN_PLAY_PAGE_SIZE = 20;
export const MAX_OPEN_PLAY_PAGE_SIZE = 50;

/** Leaving / cancelling closes this long before the start time. */
export const OPEN_PLAY_CUTOFF_MS = 24 * 60 * 60 * 1000;

/**
 * Whether the booking's start time has been reached.
 *
 * @param   {Date}    bookDate The booking's start time.
 * @param   {Date}    now      The current time.
 * @returns {boolean}          `true` once `now >= bookDate`.
 */
export function hasStarted(bookDate: Date, now: Date): boolean {
  return now.getTime() >= bookDate.getTime();
}

/**
 * Whether `now` is inside the 24-hour window before start. Exactly 24h
 * before start is still outside the window ("until 24 hours before").
 *
 * @param   {Date}    bookDate The booking's start time.
 * @param   {Date}    now      The current time.
 * @returns {boolean}          `true` when `now > bookDate - 24h`.
 */
export function isInsideCutoff(bookDate: Date, now: Date): boolean {
  return now.getTime() > bookDate.getTime() - OPEN_PLAY_CUTOFF_MS;
}

/**
 * The earliest start time that is still outside the cutoff at `now`, for
 * use as a `bookDate >= …` database filter.
 *
 * @param   {Date} now The current time.
 * @returns {Date}     `now + 24h`.
 */
export function latestLeaveableStart(now: Date): Date {
  return new Date(now.getTime() + OPEN_PLAY_CUTOFF_MS);
}

/**
 * Whether confirmed seats have reached capacity.
 *
 * @param   {number}  confirmedSeats Seats currently held (booker included).
 * @param   {number}  capacity       Total seats.
 * @returns {boolean}                `true` when no seat is left.
 */
export function isFull(confirmedSeats: number, capacity: number): boolean {
  return confirmedSeats >= capacity;
}
