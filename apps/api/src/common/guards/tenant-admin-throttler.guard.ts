import { Injectable } from '@nestjs/common';
import { ThrottlerGuard } from '@nestjs/throttler';
import { getTenantAdminThrottlerOptions } from '../../config/rate-limit.config';

type TrackedRequest = {
  ip?: string;
  session?: { user?: { id?: string } | null } | null;
};

/**
 * Limits tenant create, status change and delete to one shared budget per
 * signed-in user.
 *
 * Apply it with `@UseGuards` on the route, never as an APP_GUARD: route
 * guards run after the global auth guard, so the session is on the request
 * by then. It applies only the `tenant-admin` throttler, so the global
 * ThrottlerGuard keeps counting the same request once against its per-IP
 * default limit and nothing is counted twice under one name.
 *
 * The throttler carries its own tracker and key function, which take
 * precedence over any module-wide ones, so the key stays "this user" no
 * matter which handler is called or how the global throttler is configured.
 */
@Injectable()
export class TenantAdminThrottlerGuard extends ThrottlerGuard {
  async onModuleInit(): Promise<void> {
    await super.onModuleInit();
    this.throttlers = [
      {
        ...getTenantAdminThrottlerOptions(),
        getTracker: (req) => this.getTracker(req),
        generateKey: (_context, tracker, name) => `${name}:${tracker}`,
      },
    ];
  }

  getTracker(req: TrackedRequest): Promise<string> {
    const userId = req.session?.user?.id;

    return Promise.resolve(userId ? `user:${userId}` : `ip:${req.ip}`);
  }
}
