import { jest } from '@jest/globals';
import type { Request, Response } from 'express';
import type { PrismaClient as PrismaClientType } from '../../generated/prisma/client';
import type { Venue } from '../../generated/prisma/client';
import type { PrismaService } from '../../prisma/prisma.service';
import { VenuesRepository } from '../../venues/venues.repository';
import { TenantContextMiddleware } from './tenant-context.middleware';

type MockFn = ReturnType<typeof jest.fn>;

function createMockPrismaService(): PrismaService {
  return {
    db: {
      tenant: {
        findUnique: jest.fn(),
      },
    } as unknown as PrismaClientType,
  } as PrismaService;
}

function createMockVenue(overrides: Partial<Venue> = {}): Venue {
  return {
    id: 'venue-1',
    tenantId: 'tenant-1',
    name: 'Cebu Pickleball Club',
    slug: 'cebu-club',
    status: 'ACTIVE',
    address: '123 Osmena Blvd',
    city: 'Cebu City',
    state: 'Cebu',
    zipCode: '6000',
    country: 'PH',
    timezone: 'Asia/Manila',
    phone: null,
    email: null,
    website: null,
    logo: null,
    coverImage: null,
    description: null,
    createdAt: new Date('2026-01-01T00:00:00Z'),
    updatedAt: new Date('2026-01-01T00:00:00Z'),
    ...overrides,
  };
}

function createMockRequest(headers: Record<string, string> = {}): Request {
  return {
    headers: {
      host: 'localhost:3001',
      ...headers,
    },
  } as unknown as Request;
}

function createMockResponse(): Response {
  return {} as Response;
}

describe('TenantContextMiddleware', () => {
  let middleware: TenantContextMiddleware;
  let venuesRepository: jest.Mocked<VenuesRepository>;
  let prismaService: PrismaService;
  let next: jest.Mock;

  beforeEach(() => {
    venuesRepository = {
      findBySlug: jest.fn(),
      findById: jest.fn(),
      findAll: jest.fn(),
      findAllByTenant: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
      slugExists: jest.fn(),
    } as unknown as jest.Mocked<VenuesRepository>;

    prismaService = createMockPrismaService();

    middleware = new TenantContextMiddleware(venuesRepository, prismaService);
    next = jest.fn();
  });

  describe('subdomain resolution', () => {
    it('resolves venue and derived tenantId from subdomain', async () => {
      const venue = createMockVenue();
      venuesRepository.findBySlug.mockResolvedValue(venue);

      const req = createMockRequest({
        host: 'cebu-club.rallyhub.com',
      });

      await middleware.use(req, createMockResponse(), next);

      expect(venuesRepository.findBySlug).toHaveBeenCalledWith('cebu-club');
      expect((req as unknown as Record<string, unknown>)['tenantId']).toBe(
        'tenant-1',
      );
      expect((req as unknown as Record<string, unknown>)['venueId']).toBe(
        'venue-1',
      );
      expect((req as unknown as Record<string, unknown>)['venue']).toBe(
        venue,
      );
      expect(next).toHaveBeenCalled();
    });

    it("ignores the 'app' subdomain", async () => {
      const req = createMockRequest({
        host: 'app.rallyhub.com',
      });

      await middleware.use(req, createMockResponse(), next);

      expect(venuesRepository.findBySlug).not.toHaveBeenCalled();
      expect(
        (req as unknown as Record<string, unknown>)['tenantId'],
      ).toBeUndefined();
      expect(next).toHaveBeenCalled();
    });

    it("ignores the 'www' subdomain", async () => {
      const req = createMockRequest({
        host: 'www.rallyhub.com',
      });

      await middleware.use(req, createMockResponse(), next);

      expect(venuesRepository.findBySlug).not.toHaveBeenCalled();
      expect(next).toHaveBeenCalled();
    });

    it('falls through when subdomain venue is not found', async () => {
      venuesRepository.findBySlug.mockResolvedValue(null);

      const req = createMockRequest({
        host: 'unknown-venue.rallyhub.com',
      });

      await middleware.use(req, createMockResponse(), next);

      expect(venuesRepository.findBySlug).toHaveBeenCalledWith(
        'unknown-venue',
      );
      expect(
        (req as unknown as Record<string, unknown>)['tenantId'],
      ).toBeUndefined();
      expect(next).toHaveBeenCalled();
    });
  });

  describe('X-Venue-Id header resolution', () => {
    it('resolves venue and derived tenantId from X-Venue-Id header', async () => {
      const venue = createMockVenue();
      venuesRepository.findById.mockResolvedValue(venue);

      const req = createMockRequest({
        'x-venue-id': 'venue-1',
      });

      await middleware.use(req, createMockResponse(), next);

      expect(venuesRepository.findById).toHaveBeenCalledWith('venue-1');
      expect((req as unknown as Record<string, unknown>)['tenantId']).toBe(
        'tenant-1',
      );
      expect((req as unknown as Record<string, unknown>)['venueId']).toBe(
        'venue-1',
      );
      expect(next).toHaveBeenCalled();
    });

    it('ignores an empty X-Venue-Id header', async () => {
      const req = createMockRequest({
        'x-venue-id': '',
      });

      await middleware.use(req, createMockResponse(), next);

      expect(venuesRepository.findById).not.toHaveBeenCalled();
      expect(next).toHaveBeenCalled();
    });

    it('falls through when header venue is not found', async () => {
      venuesRepository.findById.mockResolvedValue(null);

      const req = createMockRequest({
        'x-venue-id': 'nonexistent',
      });

      await middleware.use(req, createMockResponse(), next);

      expect(
        (req as unknown as Record<string, unknown>)['tenantId'],
      ).toBeUndefined();
      expect(next).toHaveBeenCalled();
    });
  });

  describe('X-Tenant-Id header resolution (fallback, tenant-only)', () => {
    it('sets only tenantId, no venueId, when the header tenant exists', async () => {
      (prismaService.db.tenant.findUnique as MockFn).mockResolvedValue({
        id: 'tenant-1',
      });

      const req = createMockRequest({
        'x-tenant-id': 'tenant-1',
      });

      await middleware.use(req, createMockResponse(), next);

      expect(prismaService.db.tenant.findUnique).toHaveBeenCalledWith({
        where: { id: 'tenant-1' },
        select: { id: true },
      });
      expect((req as unknown as Record<string, unknown>)['tenantId']).toBe(
        'tenant-1',
      );
      expect(
        (req as unknown as Record<string, unknown>)['venueId'],
      ).toBeUndefined();
      expect(next).toHaveBeenCalled();
    });

    it('ignores an empty X-Tenant-Id header', async () => {
      const req = createMockRequest({
        'x-tenant-id': '',
      });

      await middleware.use(req, createMockResponse(), next);

      expect(prismaService.db.tenant.findUnique).not.toHaveBeenCalled();
      expect(
        (req as unknown as Record<string, unknown>)['tenantId'],
      ).toBeUndefined();
      expect(next).toHaveBeenCalled();
    });

    it('ignores an X-Tenant-Id header that does not match a real tenant', async () => {
      (prismaService.db.tenant.findUnique as MockFn).mockResolvedValue(null);

      const req = createMockRequest({
        'x-tenant-id': 'spoofed-tenant-id',
      });

      await middleware.use(req, createMockResponse(), next);

      expect(prismaService.db.tenant.findUnique).toHaveBeenCalledWith({
        where: { id: 'spoofed-tenant-id' },
        select: { id: true },
      });
      expect(
        (req as unknown as Record<string, unknown>)['tenantId'],
      ).toBeUndefined();
      expect(next).toHaveBeenCalled();
    });
  });

  describe('priority', () => {
    it('prefers subdomain over X-Venue-Id header', async () => {
      const subdomainVenue = createMockVenue({
        id: 'venue-subdomain',
        tenantId: 'tenant-subdomain',
        slug: 'cebu-club',
      });
      venuesRepository.findBySlug.mockResolvedValue(subdomainVenue);

      const req = createMockRequest({
        host: 'cebu-club.rallyhub.com',
        'x-venue-id': 'venue-header',
      });

      await middleware.use(req, createMockResponse(), next);

      expect((req as unknown as Record<string, unknown>)['venueId']).toBe(
        'venue-subdomain',
      );
      expect(venuesRepository.findById).not.toHaveBeenCalled();
    });

    it('prefers X-Venue-Id header over X-Tenant-Id header', async () => {
      const venue = createMockVenue();
      venuesRepository.findById.mockResolvedValue(venue);

      const req = createMockRequest({
        'x-venue-id': 'venue-1',
        'x-tenant-id': 'tenant-header',
      });

      await middleware.use(req, createMockResponse(), next);

      expect((req as unknown as Record<string, unknown>)['tenantId']).toBe(
        'tenant-1',
      );
      expect((req as unknown as Record<string, unknown>)['venueId']).toBe(
        'venue-1',
      );
    });

    it('falls back to X-Tenant-Id header when subdomain and X-Venue-Id both fail', async () => {
      venuesRepository.findBySlug.mockResolvedValue(null);
      (prismaService.db.tenant.findUnique as MockFn).mockResolvedValue({
        id: 'tenant-header',
      });

      const req = createMockRequest({
        host: 'unknown.rallyhub.com',
        'x-tenant-id': 'tenant-header',
      });

      await middleware.use(req, createMockResponse(), next);

      expect((req as unknown as Record<string, unknown>)['tenantId']).toBe(
        'tenant-header',
      );
      expect(
        (req as unknown as Record<string, unknown>)['venueId'],
      ).toBeUndefined();
    });
  });

  describe('no tenant context', () => {
    it('proceeds without tenant context for localhost', async () => {
      const req = createMockRequest({ host: 'localhost:3001' });

      await middleware.use(req, createMockResponse(), next);

      expect(
        (req as unknown as Record<string, unknown>)['tenantId'],
      ).toBeUndefined();
      expect(next).toHaveBeenCalled();
    });

    it('proceeds without tenant context for bare domain', async () => {
      const req = createMockRequest({ host: 'rallyhub.com' });

      await middleware.use(req, createMockResponse(), next);

      expect(
        (req as unknown as Record<string, unknown>)['tenantId'],
      ).toBeUndefined();
      expect(next).toHaveBeenCalled();
    });
  });

  describe('subdomain extraction with port', () => {
    it('strips port from host before extracting subdomain', async () => {
      const venue = createMockVenue();
      venuesRepository.findBySlug.mockResolvedValue(venue);

      const req = createMockRequest({
        host: 'cebu-club.rallyhub.com:3000',
      });

      await middleware.use(req, createMockResponse(), next);

      expect(venuesRepository.findBySlug).toHaveBeenCalledWith('cebu-club');
      expect((req as unknown as Record<string, unknown>)['tenantId']).toBe(
        'tenant-1',
      );
    });
  });
});
