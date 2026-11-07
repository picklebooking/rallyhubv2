import type { INestApplication } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import request from 'supertest';
import { createHttpTestApp } from '../test-support/http-app';
import {
  signUpAndSignIn,
  type HttpTestSession,
} from '../test-support/auth-session';
import { HttpFixtures } from '../test-support/fixtures';

const describeIfDb = process.env.TEST_DATABASE_URL ? describe : describe.skip;
const roles = [
  'owner',
  'staff',
  'venueStaff',
  'customer',
  'otherOwner',
  'inactiveOwner',
  'inactiveStaff',
  'admin',
] as const;
type Role = (typeof roles)[number];

describeIfDb('Venues HTTP authorization (requires TEST_DATABASE_URL)', () => {
  let app: INestApplication;
  let fixtures: HttpFixtures;
  let tenantId: string;
  let otherTenantId: string;
  const actors = {} as Record<Role, HttpTestSession>;

  beforeAll(async () => {
    app = await createHttpTestApp();
    fixtures = new HttpFixtures();
    tenantId = (await fixtures.createTenant()).id;
    otherTenantId = (await fixtures.createTenant()).id;
    for (const role of roles) {
      actors[role] = await signUpAndSignIn(app);
      fixtures.trackUser(actors[role].userId);
    }
    await fixtures.addMember(actors.owner.userId, tenantId, 'OWNER');
    await fixtures.addMember(actors.staff.userId, tenantId, 'STAFF');
    await fixtures.addMember(actors.otherOwner.userId, otherTenantId, 'OWNER');
    await fixtures.addMember(
      actors.inactiveOwner.userId,
      tenantId,
      'OWNER',
      null,
      false,
    );
    await fixtures.addMember(
      actors.inactiveStaff.userId,
      tenantId,
      'STAFF',
      null,
      false,
    );
    await fixtures.makePlatformAdmin(actors.admin.userId);
  });

  afterAll(async () => {
    await fixtures?.cleanup();
    await app?.close();
  });

  it.each(roles)(
    'checks %s creation permission and persisted state',
    async (role) => {
      if (role === 'venueStaff') {
        const venue = await fixtures.createVenue(tenantId);
        await fixtures.addMember(
          actors[role].userId,
          tenantId,
          'STAFF',
          venue.id,
        );
      }
      const slug = `venue-${randomUUID()}`;
      const response = await request(app.getHttpServer())
        .post('/venues')
        .set('Cookie', actors[role].cookie)
        .set('X-Tenant-Id', tenantId)
        .send({ name: 'Created venue', slug, actorId: actors.admin.userId });
      const created = await fixtures.db.venue.findUnique({ where: { slug } });
      const allowed = ['owner', 'staff', 'admin'].includes(role);
      expect(response.status).toBe(allowed ? 201 : 403);
      if (allowed) expect(created?.tenantId).toBe(tenantId);
      else expect(created).toBeNull();
    },
  );

  it('denies owner creation with a foreign tenant header without creating a row', async () => {
    const slug = `venue-${randomUUID()}`;
    const response = await request(app.getHttpServer())
      .post('/venues')
      .set('Cookie', actors.owner.cookie)
      .set('X-Tenant-Id', otherTenantId)
      .send({ name: 'Foreign venue', slug });
    expect(response.status).toBe(403);
    expect(await fixtures.db.venue.findUnique({ where: { slug } })).toBeNull();
  });

  describe.each(['update', 'delete'] as const)('%s', (operation) => {
    it.each(roles)(
      'checks %s against database resource scope despite spoofed headers',
      async (role) => {
        const target = await fixtures.createVenue(tenantId);
        if (role === 'venueStaff') {
          await fixtures.addMember(
            actors[role].userId,
            tenantId,
            'STAFF',
            target.id,
          );
        }
        const before = await fixtures.db.venue.findUniqueOrThrow({
          where: { id: target.id },
        });
        const agent = request(app.getHttpServer());
        const response =
          operation === 'update'
            ? await agent
                .patch(`/venues/${target.id}`)
                .set('Cookie', actors[role].cookie)
                .set('X-Tenant-Id', otherTenantId)
                .send({ name: 'Updated venue', actorId: actors.admin.userId })
            : await agent
                .delete(`/venues/${target.id}`)
                .set('Cookie', actors[role].cookie)
                .set('X-Tenant-Id', otherTenantId);
        const allowed = ['owner', 'staff', 'venueStaff', 'admin'].includes(
          role,
        );
        expect(response.status).toBe(
          allowed ? (operation === 'update' ? 200 : 204) : 403,
        );
        const after = await fixtures.db.venue.findUnique({
          where: { id: target.id },
        });
        if (!allowed) expect(after).toEqual(before);
        else if (operation === 'delete') expect(after).toBeNull();
        else expect(after?.name).toBe('Updated venue');
      },
    );

    it('denies venue staff access to a sibling venue and preserves it', async () => {
      const target = await fixtures.createVenue(tenantId);
      const before = await fixtures.db.venue.findUniqueOrThrow({
        where: { id: target.id },
      });
      const agent = request(app.getHttpServer());
      const response =
        operation === 'update'
          ? await agent
              .patch(`/venues/${target.id}`)
              .set('Cookie', actors.venueStaff.cookie)
              .send({ name: 'Forbidden' })
          : await agent
              .delete(`/venues/${target.id}`)
              .set('Cookie', actors.venueStaff.cookie);
      expect(response.status).toBe(403);
      expect(
        await fixtures.db.venue.findUnique({ where: { id: target.id } }),
      ).toEqual(before);
    });

    it('returns 404 before permission checks for a customer and missing venue', async () => {
      const agent = request(app.getHttpServer());
      const response =
        operation === 'update'
          ? await agent
              .patch(`/venues/${randomUUID()}`)
              .set('Cookie', actors.customer.cookie)
              .send({ name: 'Missing' })
          : await agent
              .delete(`/venues/${randomUUID()}`)
              .set('Cookie', actors.customer.cookie);
      expect(response.status).toBe(404);
    });
  });
});
