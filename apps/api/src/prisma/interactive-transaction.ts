import { Prisma } from '../generated/prisma/client';

/**
 * Explicit bounds on every interactive Open Play transaction. Lock holders
 * queue on the booking row, so a burst of joins waits rather than failing;
 * these keep that wait finite. Exceeding them surfaces as `BUSY`.
 */
export const INTERACTIVE_TX_OPTIONS = {
  maxWait: 5_000,
  timeout: 10_000,
} as const;

/**
 * Whether an error from an interactive transaction is a transient
 * contention failure worth retrying: P2028 (transaction timed out / closed),
 * P2034 (write conflict or deadlock), or a raw Postgres deadlock (40P01)
 * surfaced by the pg driver adapter without a Prisma code.
 *
 * @param   {unknown} error The caught error.
 * @returns {boolean}
 */
export function isRetryableTransactionError(error: unknown): boolean {
  if (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    (error.code === 'P2028' || error.code === 'P2034')
  ) {
    return true;
  }
  const message = error instanceof Error ? error.message : String(error);
  return /40P01|deadlock detected/i.test(message);
}
