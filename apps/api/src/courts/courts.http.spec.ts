import type { INestApplication } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import request from 'supertest';
import { createHttpTestApp } from '../test-support/http-app';
import type { HttpTestSession } from '../test-support/auth-session';
import { HttpFixtures, teardownHttpSuite } from '../test-support/fixtures';

type CourtsBody = { courts: Array<{ id: string }> };

const describeIfDb = process.env.TEST_DATABASE_URL ? describe : describe.skip;
const roles = [
  'owner',
  'staff',
  'venueStaff',
  'siblingStaff',
  'foreignOwner',
  'customer',
  'inactiveOwner',
  'inactiveStaff',
  'admin',
] as const;
type Role = (typeof roles)[number];
const permitted: readonly Role[] = ['owner', 'staff', 'venueStaff', 'admin'];

describeIfDb('Courts HTTP authorization (requires TEST_DATABASE_URL)', () => {
  let app: INestApplication;
  let fixtures: HttpFixtures;
  let tenantId: string;
  let foreignTenantId: string;
  let venueId: string;
  let foreignVenueId: string;
  const actors = {} as Record<Role, HttpTestSession>;

  beforeAll(async () => {
    app = await createHttpTestApp();
    fixtures = new HttpFixtures();
    tenantId = (await fixtures.createTenant()).id;
    foreignTenantId = (await fixtures.createTenant()).id;
    venueId = (await fixtures.createVenue(tenantId)).id;
    foreignVenueId = (await fixtures.createVenue(foreignTenantId)).id;
    const siblingId = (await fixtures.createVenue(tenantId)).id;
    for (const role of roles) {
      actors[role] = await fixtures.signUp(app);
    }
    await fixtures.addMember(actors.owner.userId, tenantId, 'OWNER');
    await fixtures.addMember(actors.staff.userId, tenantId, 'STAFF');
    await fixtures.addMember(
      actors.venueStaff.userId,
      tenantId,
      'STAFF',
      venueId,
    );
    await fixtures.addMember(
      actors.siblingStaff.userId,
      tenantId,
      'STAFF',
      siblingId,
    );
    await fixtures.addMember(
      actors.foreignOwner.userId,
      foreignTenantId,
      'OWNER',
    );
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
      venueId,
      false,
    );
    await fixtures.makePlatformAdmin(actors.admin.userId);
  });

  afterAll(() => teardownHttpSuite(app, fixtures));

  it.each(roles)(
    'checks %s create permission with conflicting tenant header',
    async (role) => {
      const name = `Court ${randomUUID()}`;
      const response = await request(app.getHttpServer())
        .post('/courts')
        .set('Cookie', actors[role].cookie)
        .set('X-Venue-Id', venueId)
        .set('X-Tenant-Id', foreignTenantId)
        .send({ name, actorId: actors.admin.userId });
      expect(response.status).toBe(permitted.includes(role) ? 201 : 403);
      const created = await fixtures.db.court.findMany({ where: { name } });
      if (permitted.includes(role)) {
        expect(created).toHaveLength(1);
        expect(created[0].venueId).toBe(venueId);
      } else expect(created).toHaveLength(0);
    },
  );

  it('denies foreign venue header creation without writing a court', async () => {
    const name = `Foreign ${randomUUID()}`;
    await request(app.getHttpServer())
      .post('/courts')
      .set('Cookie', actors.owner.cookie)
      .set('X-Venue-Id', foreignVenueId)
      .set('X-Tenant-Id', tenantId)
      .send({ name })
      .expect(403);
    expect(await fixtures.db.court.count({ where: { name } })).toBe(0);
  });

  describe.each(['update', 'delete'] as const)('%s', (operation) => {
    it.each(roles)(
      'checks %s against the persisted venue and preserves denied rows',
      async (role) => {
        const target = await fixtures.createCourt(venueId);
        const before = await fixtures.db.court.findUniqueOrThrow({
          where: { id: target.id },
        });
        const agent = request(app.getHttpServer());
        const response =
          operation === 'update'
            ? await agent
                .patch(`/courts/${target.id}`)
                .set('Cookie', actors[role].cookie)
                .set('X-Venue-Id', foreignVenueId)
                .set('X-Tenant-Id', foreignTenantId)
                .send({ name: 'Updated court', actorId: actors.admin.userId })
            : await agent
                .delete(`/courts/${target.id}`)
                .set('Cookie', actors[role].cookie)
                .set('X-Venue-Id', foreignVenueId)
                .set('X-Tenant-Id', foreignTenantId);
        expect(response.status).toBe(
          permitted.includes(role) ? (operation === 'update' ? 200 : 204) : 403,
        );
        const after = await fixtures.db.court.findUnique({
          where: { id: target.id },
        });
        if (!permitted.includes(role)) expect(after).toEqual(before);
        else if (operation === 'delete') expect(after).toBeNull();
        else expect(after?.name).toBe('Updated court');
      },
    );

    it('returns 404 before customer permission checks for a missing court', async () => {
      const agent = request(app.getHttpServer());
      const response =
        operation === 'update'
          ? await agent
              .patch(`/courts/${randomUUID()}`)
              .set('Cookie', actors.customer.cookie)
              .send({ name: 'Missing' })
          : await agent
              .delete(`/courts/${randomUUID()}`)
              .set('Cookie', actors.customer.cookie);
      expect(response.status).toBe(404);
    });
  });

  it('preserves authenticated court reads', async () => {
    const court = await fixtures.createCourt(venueId);
    await request(app.getHttpServer())
      .get(`/courts/${court.id}`)
      .set('Cookie', actors.customer.cookie)
      .expect(200);
    const response = await request(app.getHttpServer())
      .get('/courts')
      .set('Cookie', actors.customer.cookie)
      .set('X-Venue-Id', venueId)
      .expect(200);
    const body = response.body as CourtsBody;
    expect(body.courts).toEqual(
      expect.arrayContaining([expect.objectContaining({ id: court.id })]),
    );
  });
});
