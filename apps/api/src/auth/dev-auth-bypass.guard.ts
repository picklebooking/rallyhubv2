import { randomUUID } from 'node:crypto';

import {
  CanActivate,
  ExecutionContext,
  Injectable,
  InternalServerErrorException,
  Logger,
} from '@nestjs/common';
import type { Request } from 'express';
import { PrismaService } from '../prisma/prisma.service';

type DevBypassUser = {
  id: string;
  name: string;
  email: string;
  emailVerified: boolean;
  image: string | null;
  createdAt: Date;
  updatedAt: Date;
};

type DevBypassSession = {
  user: DevBypassUser;
  session: {
    id: string;
    token: string;
    userId: string;
    expiresAt: Date;
    createdAt: Date;
    updatedAt: Date;
    ipAddress: string | null;
    userAgent: string | null;
  };
};

type RequestWithSession = Request & {
  session?: DevBypassSession;
  user?: DevBypassUser;
};

/**
 * Local-dev-only stand-in for the Better Auth global guard.
 * Only ever wired up by AppModule when AUTH_DEV_BYPASS_EMAIL is set,
 * which AppModule refuses to allow when NODE_ENV=production.
 */
@Injectable()
export class DevAuthBypassGuard implements CanActivate {
  private static readonly logger = new Logger('AuthDevBypass');
  private cachedSession: DevBypassSession | null = null;

  constructor(private readonly prisma: PrismaService) {
    if (process.env.NODE_ENV === 'production') {
      throw new Error(
        'DevAuthBypassGuard must never be active when NODE_ENV=production.',
      );
    }

    DevAuthBypassGuard.logger.warn(
      `AUTH DEV BYPASS ACTIVE for "${process.env.AUTH_DEV_BYPASS_EMAIL}" — every request is treated as logged in as this user, and @AllowAnonymous() has no effect. Never set AUTH_DEV_BYPASS_EMAIL outside local development.`,
    );
  }

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<RequestWithSession>();
    const session = await this.getSession();

    request.session = session;
    request.user = session.user;

    return true;
  }

  private async getSession(): Promise<DevBypassSession> {
    if (this.cachedSession) {
      return this.cachedSession;
    }

    const email = process.env.AUTH_DEV_BYPASS_EMAIL;

    if (!email) {
      throw new InternalServerErrorException(
        'AUTH_DEV_BYPASS_EMAIL must be set when the dev auth bypass is enabled.',
      );
    }

    const user = await this.prisma.db.user.findUnique({ where: { email } });

    if (!user) {
      throw new InternalServerErrorException(
        `AUTH_DEV_BYPASS_EMAIL is set to "${email}" but no user with that email exists locally. Sign up once through the normal auth flow, then point this env var at that account.`,
      );
    }

    const now = new Date();

    this.cachedSession = {
      user,
      session: {
        id: randomUUID(),
        token: randomUUID(),
        userId: user.id,
        expiresAt: new Date(now.getTime() + 1000 * 60 * 60 * 24 * 365),
        createdAt: now,
        updatedAt: now,
        ipAddress: null,
        userAgent: 'auth-dev-bypass',
      },
    };

    return this.cachedSession;
  }
}
