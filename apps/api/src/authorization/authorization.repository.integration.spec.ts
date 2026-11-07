import { randomUUID } from 'node:crypto';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../generated/prisma/client';
import type { PrismaService } from '../prisma/prisma.service';
import { AuthorizationRepository } from './authorization.repository';

const TEST_DATABASE_URL = process.env.TEST_DATABASE_URL;
const describeIfDb = TEST_DATABASE_URL ? describe : describe.skip;

describeIfDb('AuthorizationRepository (requires TEST_DATABASE_URL)', () => {
  let db: PrismaClient;
  let repository: AuthorizationRepository;
  const run = `authz-${randomUUID()}`;
  const users: string[] = [];
  const tenants: string[] = [];
  const venues: string[] = [];
  const members: string[] = [];
  let tenantId: string;
  let venueId: string;
  let siblingVenueId: string;
  const actors: Record<string, string> = {};

  beforeAll(async () => {
    db = new PrismaClient({
      adapter: new PrismaPg(TEST_DATABASE_URL as string),
    });
    repository = new AuthorizationRepository({
      db,
    } as unknown as PrismaService);
    for (const label of [
      'owner',
      'wideStaff',
      'venueStaff',
      'venueOwner',
      'inactiveOwner',
      'otherTenant',
      'nonMember',
      'admin',
    ]) {
      const user = await db.user.create({
        data: {
          name: label,
          email: `${run}-${label}@example.com`,
          isPlatformAdmin: label === 'admin',
        },
      });
      users.push(user.id);
      actors[label] = user.id;
    }
    for (let i = 0; i < 2; i++) {
      const tenant = await db.tenant.create({ data: { name: `${run}-${i}` } });
      tenants.push(tenant.id);
    }
    tenantId = tenants[0]!;
    for (let i = 0; i < 2; i++) {
      const venue = await db.venue.create({
        data: { tenantId, name: run, slug: `${run}-${i}` },
      });
      venues.push(venue.id);
    }
    venueId = venues[0]!;
    siblingVenueId = venues[1]!;
    for (const data of [
      { userId: actors.owner, tenantId, role: 'OWNER' as const },
      { userId: actors.wideStaff, tenantId, role: 'STAFF' as const },
      { userId: actors.venueStaff, tenantId, venueId, role: 'STAFF' as const },
      { userId: actors.venueOwner, tenantId, venueId, role: 'OWNER' as const },
      {
        userId: actors.inactiveOwner,
        tenantId,
        role: 'OWNER' as const,
        isActive: false,
      },
      {
        userId: actors.otherTenant,
        tenantId: tenants[1],
        role: 'OWNER' as const,
      },
    ]) {
      const member = await db.tenantMember.create({ data });
      members.push(member.id);
    }
  });

  afterAll(async () => {
    await db.tenantMember.deleteMany({ where: { id: { in: members } } });
    await db.venue.deleteMany({ where: { id: { in: venues } } });
    await db.tenant.deleteMany({ where: { id: { in: tenants } } });
    await db.user.deleteMany({ where: { id: { in: users } } });
    await db.$disconnect();
  });

  it('reads the database admin flag and returns false for unknown users', async () => {
    expect(await repository.isPlatformAdmin(actors.admin)).toBe(true);
    expect(await repository.isPlatformAdmin(actors.owner)).toBe(false);
    expect(await repository.isPlatformAdmin(`${run}-unknown`)).toBe(false);
    await db.user.update({
      where: { id: actors.admin },
      data: { isPlatformAdmin: false },
    });
    expect(await repository.isPlatformAdmin(actors.admin)).toBe(false);
  });

  it.each([
    ['owner', true, true, true, true],
    ['wideStaff', false, true, true, true],
    ['venueStaff', false, false, true, false],
    ['venueOwner', false, false, true, false],
    ['inactiveOwner', false, false, false, false],
    ['otherTenant', false, false, false, false],
    ['nonMember', false, false, false, false],
  ])(
    'enforces membership scope for %s',
    async (actor, owner, wide, ownVenue, siblingVenue) => {
      const userId = actors[String(actor)];
      expect(await repository.hasTenantOwnerMembership(userId, tenantId)).toBe(
        owner,
      );
      expect(await repository.hasTenantWideMembership(userId, tenantId)).toBe(
        wide,
      );
      expect(
        await repository.hasVenueManagerMembership(userId, tenantId, venueId),
      ).toBe(ownVenue);
      expect(
        await repository.hasVenueManagerMembership(
          userId,
          tenantId,
          siblingVenueId,
        ),
      ).toBe(siblingVenue);
    },
  );
});
