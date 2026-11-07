import type { CallHandler, NestInterceptor } from '@nestjs/common';

export type BurstGate = {
  interceptor: NestInterceptor;
  arm(expected: number, timeoutMs?: number): void;
  disarm(): void;
};

/** Aligns real HTTP requests after their guards, without replacing application work. */
export function createBurstGate(): BurstGate {
  let batch:
    | {
        expected: number;
        entered: number;
        timeoutMs: number;
        ready: Promise<void>;
        release: () => void;
      }
    | undefined;
  const disarm = (): void => {
    batch?.release();
    batch = undefined;
  };
  return {
    interceptor: {
      async intercept(
        _context: unknown,
        next: CallHandler<unknown>,
      ): Promise<ReturnType<CallHandler<unknown>['handle']>> {
        const current = batch;
        if (current) {
          if (++current.entered === current.expected) current.release();
          let timeout: ReturnType<typeof setTimeout> | undefined;
          try {
            await Promise.race([
              current.ready,
              new Promise<void>((_resolve, reject) => {
                timeout = setTimeout(
                  () => reject(new Error('Burst entry gate timed out')),
                  current.timeoutMs,
                );
              }),
            ]);
          } finally {
            if (timeout) clearTimeout(timeout);
          }
        }
        return next.handle();
      },
    },
    arm(expected: number, timeoutMs = 5_000): void {
      disarm();
      let release!: () => void;
      const ready = new Promise<void>((resolve) => {
        release = resolve;
      });
      batch = { expected, entered: 0, timeoutMs, ready, release };
    },
    disarm,
  };
}
