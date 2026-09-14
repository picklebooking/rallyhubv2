import { ExecutionContext, InternalServerErrorException } from '@nestjs/common';
import { jest } from '@jest/globals';
import { DevAuthBypassGuard } from './dev-auth-bypass.guard';
import { PrismaService } from '../prisma/prisma.service';

type MockPrismaService = {
  db: {
    user: {
      findUnique: jest.Mock<() => Promise<unknown>>;
    };
  };
};

function createContext(request: Record<string, unknown>): ExecutionContext {
  return {
    switchToHttp: () => ({
      getRequest: () => request,
    }),
  } as unknown as ExecutionContext;
}

describe('DevAuthBypassGuard', () => {
  const originalNodeEnv = process.env.NODE_ENV;
  const originalBypassEmail = process.env.AUTH_DEV_BYPASS_EMAIL;
  let prisma: MockPrismaService;

  beforeEach(() => {
    process.env.NODE_ENV = 'development';
    process.env.AUTH_DEV_BYPASS_EMAIL = 'dev@example.com';
    prisma = {
      db: { user: { findUnique: jest.fn<() => Promise<unknown>>() } },
    };
  });

  afterEach(() => {
    process.env.NODE_ENV = originalNodeEnv;
    process.env.AUTH_DEV_BYPASS_EMAIL = originalBypassEmail;
  });

  it('refuses to construct when NODE_ENV is production', () => {
    process.env.NODE_ENV = 'production';

    expect(
      () => new DevAuthBypassGuard(prisma as unknown as PrismaService),
    ).toThrow(
      'DevAuthBypassGuard must never be active when NODE_ENV=production.',
    );
  });

  it('attaches the seeded dev user to the request and allows the request through', async () => {
    const seededUser = {
      id: 'user-1',
      name: 'Dev User',
      email: 'dev@example.com',
      emailVerified: true,
      image: null,
      createdAt: new Date('2026-01-01'),
      updatedAt: new Date('2026-01-01'),
    };
    prisma.db.user.findUnique.mockResolvedValue(seededUser);

    const guard = new DevAuthBypassGuard(prisma as unknown as PrismaService);
    const request: Record<string, unknown> = {};
    const context = createContext(request);

    const result = await guard.canActivate(context);

    expect(result).toBe(true);
    expect(request.user).toEqual(seededUser);
    expect(prisma.db.user.findUnique).toHaveBeenCalledWith({
      where: { email: 'dev@example.com' },
    });
    expect(request.session).toMatchObject({
      user: seededUser,
      session: { userId: seededUser.id },
    });
  });

  it('reuses the resolved session across requests instead of re-querying', async () => {
    prisma.db.user.findUnique.mockResolvedValue({
      id: 'user-1',
      name: 'Dev User',
      email: 'dev@example.com',
      emailVerified: true,
      image: null,
      createdAt: new Date('2026-01-01'),
      updatedAt: new Date('2026-01-01'),
    });

    const guard = new DevAuthBypassGuard(prisma as unknown as PrismaService);

    await guard.canActivate(createContext({}));
    await guard.canActivate(createContext({}));

    expect(prisma.db.user.findUnique).toHaveBeenCalledTimes(1);
  });

  it('throws when no user matches AUTH_DEV_BYPASS_EMAIL', async () => {
    prisma.db.user.findUnique.mockResolvedValue(null);

    const guard = new DevAuthBypassGuard(prisma as unknown as PrismaService);

    await expect(guard.canActivate(createContext({}))).rejects.toThrow(
      InternalServerErrorException,
    );
  });
});
