import type { CallHandler, ExecutionContext } from '@nestjs/common';
import { lastValueFrom, of, type Observable } from 'rxjs';
import { createBurstGate } from './burst-gate';

const context = {} as ExecutionContext;
// Nest resolves root RxJS; this workspace has a second installed type identity.
const next: CallHandler<string> = {
  handle: () =>
    of('ok') as unknown as ReturnType<CallHandler<string>['handle']>,
};

describe('burst gate', () => {
  it('passes through when disarmed', async () => {
    const gate = createBurstGate();
    expect(
      await lastValueFrom(
        (await gate.interceptor.intercept(
          context,
          next,
        )) as unknown as Observable<string>,
      ),
    ).toBe('ok');
  });

  it('holds each request until the armed count has entered', async () => {
    const gate = createBurstGate();
    gate.arm(2);
    let finished = false;
    const first = Promise.resolve(
      gate.interceptor.intercept(context, next),
    ).then(() => {
      finished = true;
    });
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(finished).toBe(false);
    await gate.interceptor.intercept(context, next);
    await first;
    expect(finished).toBe(true);
    gate.disarm();
  });

  it('rejects with a timeout when too few requests arrive', async () => {
    const gate = createBurstGate();
    gate.arm(2, 50);
    await expect(gate.interceptor.intercept(context, next)).rejects.toThrow(
      'Burst entry gate timed out',
    );
    gate.disarm();
  });

  it('releases waiters and resets the count on disarm', async () => {
    const gate = createBurstGate();
    gate.arm(2);
    const waiting = gate.interceptor.intercept(context, next);
    gate.disarm();
    await waiting;
    gate.arm(2);
    let finished = false;
    const first = Promise.resolve(
      gate.interceptor.intercept(context, next),
    ).then(() => {
      finished = true;
    });
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(finished).toBe(false);
    await gate.interceptor.intercept(context, next);
    await first;
    gate.disarm();
  });
});
