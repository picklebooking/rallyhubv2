import { jest } from '@jest/globals';
import type { PrismaClient as PrismaClientType } from '../generated/prisma/client';
import type { PrismaService } from '../prisma/prisma.service';
import { CourtsRepository } from './courts.repository';

type MockFn = ReturnType<typeof jest.fn>;

function createMockPrismaService(): PrismaService {
  return {
    db: {
      court: {
        findMany: jest.fn(),
        findUnique: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
        delete: jest.fn(),
      },
    } as unknown as PrismaClientType,
  } as PrismaService;
}

describe('CourtsRepository', () => {
  let repository: CourtsRepository;
  let prismaService: PrismaService;

  beforeEach(() => {
    prismaService = createMockPrismaService();
    repository = new CourtsRepository(prismaService);
  });

  describe('findAllByVenue', () => {
    it('returns all courts for a venue ordered by createdAt desc', async () => {
      const mockCourts = [{ id: 'court-1' }, { id: 'court-2' }];
      (prismaService.db.court.findMany as MockFn).mockResolvedValue(
        mockCourts,
      );

      const result = await repository.findAllByVenue('venue-1');

      expect(result).toEqual(mockCourts);
      expect(prismaService.db.court.findMany).toHaveBeenCalledWith({
        where: { venueId: 'venue-1' },
        orderBy: { createdAt: 'desc' },
      });
    });
  });

  describe('findById', () => {
    it('returns a court by id', async () => {
      const mockCourt = { id: 'court-1', name: 'Court 1' };
      (prismaService.db.court.findUnique as MockFn).mockResolvedValue(
        mockCourt,
      );

      const result = await repository.findById('court-1');

      expect(result).toEqual(mockCourt);
      expect(prismaService.db.court.findUnique).toHaveBeenCalledWith({
        where: { id: 'court-1' },
      });
    });

    it('returns null when court is not found', async () => {
      (prismaService.db.court.findUnique as MockFn).mockResolvedValue(null);

      const result = await repository.findById('nonexistent');

      expect(result).toBeNull();
    });
  });

  describe('create', () => {
    it('creates a court with both tenantId and venueId', async () => {
      const dto = { name: 'Court 1' };
      const mockCreated = {
        id: 'court-1',
        tenantId: 'tenant-1',
        venueId: 'venue-1',
        ...dto,
      };
      (prismaService.db.court.create as MockFn).mockResolvedValue(
        mockCreated,
      );

      const result = await repository.create('tenant-1', 'venue-1', dto);

      expect(result).toEqual(mockCreated);
      expect(prismaService.db.court.create).toHaveBeenCalledWith({
        data: {
          tenantId: 'tenant-1',
          venueId: 'venue-1',
          name: 'Court 1',
        },
      });
    });
  });

  describe('update', () => {
    it('updates a court by id', async () => {
      const dto = { name: 'Updated Court' };
      const mockUpdated = { id: 'court-1', name: 'Updated Court' };
      (prismaService.db.court.update as MockFn).mockResolvedValue(
        mockUpdated,
      );

      const result = await repository.update('court-1', dto);

      expect(result).toEqual(mockUpdated);
      expect(prismaService.db.court.update).toHaveBeenCalledWith({
        where: { id: 'court-1' },
        data: dto,
      });
    });
  });

  describe('delete', () => {
    it('deletes a court by id', async () => {
      const mockDeleted = { id: 'court-1' };
      (prismaService.db.court.delete as MockFn).mockResolvedValue(
        mockDeleted,
      );

      const result = await repository.delete('court-1');

      expect(result).toEqual(mockDeleted);
      expect(prismaService.db.court.delete).toHaveBeenCalledWith({
        where: { id: 'court-1' },
      });
    });
  });
});
