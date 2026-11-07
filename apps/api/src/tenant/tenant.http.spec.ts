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
const deniedRoles = [
  'customer',
  'owner',
  'staff',
  'venueStaff',
  'inactiveOwner',
  'inactiveStaff',
  'otherOwner',
] as const;
type Role = (typeof deniedRoles)[number] | 'admin';

describeIfDb('Tenant HTTP authorization (requires TEST_DATABASE_URL)', () => {
  let app: INestApplication;
  let fixtures: HttpFixtures;
  let tenantId: string;
  const actors = {} as Record<Role, HttpTestSession>;

  beforeAll(async () => {
    app = await createHttpTestApp();
    fixtures = new HttpFixtures();
    tenantId = (await fixtures.createTenant()).id;
    const otherTenantId = (await fixtures.createTenant()).id;
    const venueId = (await fixtures.createVenue(tenantId)).id;
    for (const role of [...deniedRoles, 'admin'] as const) {
      actors[role] = await signUpAndSignIn(app);
      fixtures.trackUser(actors[role].userId);
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
    await fixtures.addMember(actors.otherOwner.userId, otherTenantId, 'OWNER');
    await fixtures.makePlatformAdmin(actors.admin.userId);
  });

  afterAll(async () => {
    await fixtures?.cleanup();
    await app?.close();
  });

  it.each(deniedRoles)(
    'denies tenant creation by %s, including spoofed authority',
    async (role) => {
      const email = `tenant-${randomUUID()}@example.com`;
      const response = await request(app.getHttpServer())
        .post('/v1/tenant/create')
        .set('Cookie', actors[role].cookie)
        .send({
          email,
          tenantName: 'Forbidden tenant',
          phone: '123456789',
          actorId: actors.admin.userId,
          isPlatformAdmin: true,
        });
      const created = await fixtures.db.tenant.findFirst({
        where: { email },
        select: { id: true },
      });
      if (created) fixtures.trackTenant(created.id);
      expect(response.status).toBe(403);
      expect(created).toBeNull();
    },
  );

  it('allows a platform admin to create a tenant', async () => {
    const email = `tenant-${randomUUID()}@example.com`;
    const response = await request(app.getHttpServer())
      .post('/v1/tenant/create')
      .set('Cookie', actors.admin.cookie)
      .send({ email, tenantName: 'Admin tenant', phone: '123456789' });
    const created = await fixtures.db.tenant.findFirst({
      where: { email },
      select: { id: true },
    });
    if (created) fixtures.trackTenant(created.id);
    expect(response.status).toBe(201);
    expect(created).not.toBeNull();
  });

  describe.each(['status', 'delete'] as const)('%s management', (operation) => {
    it.each(deniedRoles)('denies %s and preserves the tenant', async (role) => {
      const target = await fixtures.createTenant();
      // Test each role against its own scope as well as the cross-tenant target.
      const id = [
        'owner',
        'staff',
        'venueStaff',
        'inactiveOwner',
        'inactiveStaff',
      ].includes(role)
        ? tenantId
        : target.id;
      const before = await fixtures.db.tenant.findUniqueOrThrow({
        where: { id },
      });
      const agent = request(app.getHttpServer());
      const response =
        operation === 'status'
          ? await agent
              .patch(`/v1/tenant/patch/${id}/status`)
              .set('Cookie', actors[role].cookie)
              .send({ status: 'ACTIVE' })
          : await agent
              .delete(`/v1/tenant/delete/${id}`)
              .set('Cookie', actors[role].cookie);
      expect(response.status).toBe(403);
      expect(
        await fixtures.db.tenant.findUniqueOrThrow({ where: { id } }),
      ).toEqual(before);
    });

    it('allows platform admins', async () => {
      const { id } = await fixtures.createTenant();
      const agent = request(app.getHttpServer());
      const response =
        operation === 'status'
          ? await agent
              .patch(`/v1/tenant/patch/${id}/status`)
              .set('Cookie', actors.admin.cookie)
              .send({ status: 'ACTIVE' })
          : await agent
              .delete(`/v1/tenant/delete/${id}`)
              .set('Cookie', actors.admin.cookie);
      expect(response.status).toBe(200);
      expect(
        (await fixtures.db.tenant.findUniqueOrThrow({ where: { id } })).status,
      ).toBe(operation === 'status' ? 'ACTIVE' : 'INACTIVE');
    });

    it('returns 404 before checking permissions for an unknown tenant', async () => {
      const id = randomUUID();
      const agent = request(app.getHttpServer());
      const response =
        operation === 'status'
          ? await agent
              .patch(`/v1/tenant/patch/${id}/status`)
              .set('Cookie', actors.customer.cookie)
              .send({ status: 'ACTIVE' })
          : await agent
              .delete(`/v1/tenant/delete/${id}`)
              .set('Cookie', actors.customer.cookie);
      expect(response.status).toBe(404);
    });
  });

  it.each(deniedRoles.filter((role) => role !== 'owner'))(
    'denies details changes by %s and preserves the tenant',
    async (role) => {
      const before = await fixtures.db.tenant.findUniqueOrThrow({
        where: { id: tenantId },
      });
      const response = await request(app.getHttpServer())
        .patch(`/v1/tenant/patch/${tenantId}`)
        .set('Cookie', actors[role].cookie)
        .send({ tenantName: 'Forbidden rename', actorId: actors.admin.userId });
      expect(response.status).toBe(403);
      expect(
        await fixtures.db.tenant.findUniqueOrThrow({ where: { id: tenantId } }),
      ).toEqual(before);
    },
  );

  it.each(['owner', 'admin'] as const)(
    'allows %s to update PENDING tenant details',
    async (role) => {
      await fixtures.db.tenant.update({
        where: { id: tenantId },
        data: { status: 'PENDING' },
      });
      await request(app.getHttpServer())
        .patch(`/v1/tenant/patch/${tenantId}`)
        .set('Cookie', actors[role].cookie)
        .send({ tenantName: `Updated by ${role}` })
        .expect(200);
      expect(
        (
          await fixtures.db.tenant.findUniqueOrThrow({
            where: { id: tenantId },
          })
        ).name,
      ).toBe(`Updated by ${role}`);
    },
  );

  it('returns 404 for unknown tenant details before checking permissions', async () => {
    await request(app.getHttpServer())
      .patch(`/v1/tenant/patch/${randomUUID()}`)
      .set('Cookie', actors.customer.cookie)
      .send({ tenantName: 'Missing' })
      .expect(404);
  });
});
