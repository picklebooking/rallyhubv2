import type { ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import {
  ThrottlerException,
  ThrottlerStorageService,
  type ThrottlerModuleOptions,
} from '@nestjs/throttler';
import { TenantAdminThrottlerGuard } from './tenant-admin-throttler.guard';

type TrackerRequest = Parameters<TenantAdminThrottlerGuard['getTracker']>[0];

class FakeController {
  create(): void {}
  updateStatus(): void {}
  remove(): void {}
}

function contextFor(
  handler: keyof FakeController,
  userId: string,
  ip = '203.0.113.1',
): ExecutionContext {
  const req = { ip, headers: {}, session: { user: { id: userId } } };
  const res = { header: () => undefined };
  return {
    getHandler: () => FakeController.prototype[handler],
    getClass: () => FakeController,
    switchToHttp: () => ({ getRequest: () => req, getResponse: () => res }),
  } as unknown as ExecutionContext;
}

/** Storages created by a test; shut down afterwards to clear their timers. */
const storages: ThrottlerStorageService[] = [];

async function createGuard(
  options: ThrottlerModuleOptions = { throttlers: [] },
): Promise<TenantAdminThrottlerGuard> {
  const storage = new ThrottlerStorageService();
  storages.push(storage);
  const guard = new TenantAdminThrottlerGuard(
    options,
    storage,
    new Reflector(),
  );
  await guard.onModuleInit();
  return guard;
}

describe('TenantAdminThrottlerGuard', () => {
  const originalMax = process.env.TENANT_ADMIN_RATE_LIMIT_MAX;

  beforeEach(() => {
    delete process.env.TENANT_ADMIN_RATE_LIMIT_MAX;
  });

  afterEach(() => {
    // Each request schedules a 60-second expiry timer; clear them so Jest
    // does not wait on open handles after the suite.
    for (const storage of storages.splice(0)) storage.onApplicationShutdown();
    if (originalMax === undefined)
      delete process.env.TENANT_ADMIN_RATE_LIMIT_MAX;
    else process.env.TENANT_ADMIN_RATE_LIMIT_MAX = originalMax;
  });

  describe('tracker', () => {
    const guard = Object.create(
      TenantAdminThrottlerGuard.prototype,
    ) as TenantAdminThrottlerGuard;

    it('keys a signed-in request by the session user id', async () => {
      const req = {
        ip: '203.0.113.1',
        session: { user: { id: 'user-1' } },
      } as TrackerRequest;

      await expect(guard.getTracker(req)).resolves.toBe('user:user-1');
    });

    it('falls back to the client address without a session', async () => {
      const req = { ip: '203.0.113.1', session: null } as TrackerRequest;

      await expect(guard.getTracker(req)).resolves.toBe('ip:203.0.113.1');
    });
  });

  it('shares one budget of 5 across every guarded handler for a user', async () => {
    const guard = await createGuard();
    const handlers = [
      'create',
      'updateStatus',
      'remove',
      'updateStatus',
      'remove',
    ] as const;
    for (const handler of handlers) {
      await expect(guard.canActivate(contextFor(handler, 'u1'))).resolves.toBe(
        true,
      );
    }

    await expect(
      guard.canActivate(contextFor('create', 'u1')),
    ).rejects.toBeInstanceOf(ThrottlerException);
  });

  it('keeps users apart even on one client address', async () => {
    const guard = await createGuard();
    for (let attempt = 0; attempt < 5; attempt += 1) {
      await guard.canActivate(contextFor('create', 'u1'));
    }

    await expect(guard.canActivate(contextFor('create', 'u2'))).resolves.toBe(
      true,
    );
  });

  it('keeps per-user keying when the module sets its own tracker and key', async () => {
    const guard = await createGuard({
      throttlers: [],
      getTracker: () => 'shared-ip',
      generateKey: () => 'shared-key',
    });
    for (let attempt = 0; attempt < 5; attempt += 1) {
      await guard.canActivate(contextFor('create', 'u1'));
    }

    await expect(guard.canActivate(contextFor('create', 'u2'))).resolves.toBe(
      true,
    );
  });
});
