import { jest } from '@jest/globals';
import type { PrismaService } from '../prisma/prisma.service';
import { AuthorizationRepository } from './authorization.repository';

type MockFn = ReturnType<typeof jest.fn>;

describe('AuthorizationRepository', () => {
  let prismaService: PrismaService;
  let repository: AuthorizationRepository;
  beforeEach(() => {
    prismaService = {
      db: { tenantMember: { findFirst: jest.fn() } },
    } as unknown as PrismaService;
    repository = new AuthorizationRepository(prismaService);
  });
  describe('hasVenueManagerMembership', () => {
    it('matches OWNER/STAFF that are tenant-wide or scoped to this venue', async () => {
      (prismaService.db.tenantMember.findFirst as MockFn).mockResolvedValue({
        id: 'm-1',
      });
      expect(
        await repository.hasVenueManagerMembership('u-1', 't-1', 'v-1'),
      ).toBe(true);
      expect(prismaService.db.tenantMember.findFirst).toHaveBeenCalledWith({
        where: {
          userId: 'u-1',
          tenantId: 't-1',
          isActive: true,
          role: { in: ['OWNER', 'STAFF'] },
          OR: [{ venueId: null }, { venueId: 'v-1' }],
        },
        select: { id: true },
      });
    });
  });
});
