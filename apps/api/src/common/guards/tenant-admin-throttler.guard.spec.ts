import { TenantAdminThrottlerGuard } from './tenant-admin-throttler.guard';

type TrackerRequest = Parameters<TenantAdminThrottlerGuard['getTracker']>[0];

describe('TenantAdminThrottlerGuard tracker', () => {
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

  it('ignores the client address when a user is signed in', async () => {
    const first = { ip: '203.0.113.1', session: { user: { id: 'u' } } };
    const second = { ip: '203.0.113.2', session: { user: { id: 'u' } } };

    await expect(guard.getTracker(first as TrackerRequest)).resolves.toBe(
      await guard.getTracker(second as TrackerRequest),
    );
  });

  it('falls back to the client address without a session', async () => {
    const req = { ip: '203.0.113.1', session: null } as TrackerRequest;

    await expect(guard.getTracker(req)).resolves.toBe('ip:203.0.113.1');
  });
});
