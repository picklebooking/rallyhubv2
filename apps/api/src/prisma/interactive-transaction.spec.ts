import { Prisma } from '../generated/prisma/client';
import {
  INTERACTIVE_TX_OPTIONS,
  isRetryableTransactionError,
} from './interactive-transaction';

describe('interactive transaction bounds and contention', () => {
  it('bounds wait and transaction duration', () => {
    expect(INTERACTIVE_TX_OPTIONS).toEqual({ maxWait: 5_000, timeout: 10_000 });
  });
  it.each(['P2028', 'P2034', 'P2002'])('classifies %s', (code) => {
    expect(
      isRetryableTransactionError(
        new Prisma.PrismaClientKnownRequestError('failure', {
          code,
          clientVersion: '7',
        }),
      ),
    ).toBe(code !== 'P2002');
  });
  it('recognizes driver deadlocks and rejects unrelated errors', () => {
    expect(isRetryableTransactionError(new Error('40P01'))).toBe(true);
    expect(isRetryableTransactionError(new Error('deadlock detected'))).toBe(
      true,
    );
    expect(isRetryableTransactionError(new Error('other'))).toBe(false);
  });
});
