import { randomUUID } from 'node:crypto';
import { jest } from '@jest/globals';
import type { INestApplication } from '@nestjs/common';
import type { Server } from 'node:http';
import request from 'supertest';
import { ErrorConstant } from '../constants/error-code.constant';
import { MainRoute } from '../constants/routes.constant';
import type { HttpTestSession } from '../test-support/auth-session';
import { createBurstGate } from '../test-support/burst-gate';
import { HttpFixtures, teardownHttpSuite } from '../test-support/fixtures';
import { createHttpTestApp } from '../test-support/http-app';

const describeIfDb = process.env.TEST_DATABASE_URL ? describe : describe.skip;
const messages = ErrorConstant.TENANT_MEMBER_MESSAGES;
const base = `/v${MainRoute.API_VERSIONS.VERSION_ONE}/${MainRoute.MAIN_ROUTE.TENANT_MEMBER}`;
const routes = MainRoute.SUB_ROUTE;
type MemberBody = {
  email?: string;
  role?: 'OWNER' | 'STAFF';
  venueId?: string | null;
};
type ResponseBody = { message: string; content: { id: string } };

describeIfDb('Tenant membership HTTP integrity', () => {
  jest.setTimeout(120_000);
  let app: INestApplication;
  let fixtures: HttpFixtures;
  let owner: HttpTestSession;
  let owner2: HttpTestSession;
  let target: HttpTestSession;
  let target2: HttpTestSession;
  let contact: HttpTestSession;
  let admin: HttpTestSession;
  let outsider: HttpTestSession;
  const gate = createBurstGate();

  const headers = (
    test: request.Test,
    tenantId: string,
    actor: HttpTestSession,
  ): request.Test =>
    test.set('Cookie', actor.cookie).set('X-Tenant-Id', tenantId);
  const post = (
    tenantId: string,
    actor: HttpTestSession,
    body: MemberBody,
  ): request.Test =>
    headers(
      request(app.getHttpServer() as Server).post(`${base}/${routes.CREATE}`),
      tenantId,
      actor,
    ).send(body);
  const list = (tenantId: string, actor: HttpTestSession): request.Test =>
    headers(
      request(app.getHttpServer() as Server).get(`${base}/${routes.FIND_ALL}`),
      tenantId,
      actor,
    );
  const find = (
    tenantId: string,
    actor: HttpTestSession,
    id: string,
  ): request.Test =>
    headers(
      request(app.getHttpServer() as Server).get(
        `${base}/${routes.FIND}/${id}`,
      ),
      tenantId,
      actor,
    );
  const patch = (
    tenantId: string,
    actor: HttpTestSession,
    id: string,
    body: MemberBody,
  ): request.Test =>
    headers(
      request(app.getHttpServer() as Server).patch(
        `${base}/${routes.PATCH}/${id}`,
      ),
      tenantId,
      actor,
    ).send(body);
  const remove = (
    tenantId: string,
    actor: HttpTestSession,
    id: string,
  ): request.Test =>
    headers(
      request(app.getHttpServer() as Server).delete(
        `${base}/${routes.DELETE}/${id}`,
      ),
      tenantId,
      actor,
    );
  const activeOwners = (tenantId: string): Promise<number> =>
    fixtures.db.tenantMember.count({
      where: { tenantId, role: 'OWNER', venueId: null, isActive: true },
    });
  const tenantWideRows = (userId: string, tenantId: string): Promise<number> =>
    fixtures.db.tenantMember.count({
      where: { userId, tenantId, venueId: null },
    });
  const ownedTenant = async (): Promise<{ id: string; ownerId: string }> => {
    const { id } = await fixtures.createTenant();
    const member = await fixtures.addMember(owner.userId, id, 'OWNER');
    return { id, ownerId: member.id };
  };
  const expectMessage = (
    response: request.Response,
    status: number,
    message: string,
  ): void => {
    expect(response.status).toBe(status);
    expect((response.body as ResponseBody).message).toBe(message);
  };
  const burst = async (
    tenantId: string,
    actor: HttpTestSession,
    body: MemberBody,
  ): Promise<request.Response[]> => {
    gate.arm(8);
    try {
      return await Promise.all(
        Array.from({ length: 8 }, () => post(tenantId, actor, body)),
      );
    } finally {
      gate.disarm();
    }
  };
  const expectOneCreate = (responses: request.Response[]): void => {
    expect(
      responses.filter((response) => response.status === 201),
    ).toHaveLength(1);
    for (const response of responses.filter((r) => r.status !== 201)) {
      expect(response.status).toBe(409);
      expect([messages.ALREADY_EXISTS, messages.BUSY]).toContain(
        (response.body as ResponseBody).message,
      );
    }
  };

  beforeAll(async () => {
    app = await createHttpTestApp((testApp) =>
      testApp.useGlobalInterceptors(gate.interceptor),
    );
    fixtures = new HttpFixtures();
    owner = await fixtures.signUp(app);
    owner2 = await fixtures.signUp(app);
    target = await fixtures.signUp(app);
    target2 = await fixtures.signUp(app);
    contact = await fixtures.signUp(app);
    admin = await fixtures.signUp(app);
    outsider = await fixtures.signUp(app);
    await fixtures.verifyEmail(contact.userId);
    await fixtures.makePlatformAdmin(admin.userId);
    // Prove Better Auth sees the verified identity before exercising its real guard.
    const session = await request(app.getHttpServer() as Server)
      .get('/api/auth/get-session')
      .set('Cookie', contact.cookie)
      .expect(200);
    expect(
      (session.body as { user: { id: string; emailVerified: boolean } }).user,
    ).toMatchObject({ id: contact.userId, emailVerified: true });
  });
  afterAll(() => teardownHttpSuite(app, fixtures));

  describe('#16 database guarantee', () => {
    it.each([true, false])(
      'rejects a second tenant-wide row for one user and tenant (active=%s)',
      async (isActive) => {
        const t = await fixtures.createTenant();
        await fixtures.addMember(target.userId, t.id, 'STAFF');
        // Record whether the database actually rejected the second insert before asserting.
        const outcome = await fixtures
          .addMember(target.userId, t.id, 'STAFF', null, isActive)
          .then(
            () => ({ resolved: true, code: undefined }),
            (error: unknown) => ({
              resolved: false,
              code: (error as { code: string }).code,
            }),
          );
        console.log('DB GUARANTEE observations', {
          isActive,
          ...outcome,
          rows: await tenantWideRows(target.userId, t.id),
        });
        expect(outcome).toEqual({ resolved: false, code: 'P2002' });
      },
    );

    it('allows a venue row next to a tenant-wide row', async () => {
      const t = await fixtures.createTenant();
      const venue = await fixtures.createVenue(t.id);
      await fixtures.addMember(target.userId, t.id, 'STAFF');
      const scoped = await fixtures.addMember(
        target.userId,
        t.id,
        'STAFF',
        venue.id,
      );
      expect(scoped.id).toEqual(expect.any(String));
      expect(
        await fixtures.db.tenantMember.count({
          where: { tenantId: t.id, userId: target.userId },
        }),
      ).toBe(2);
    });
  });

  describe('#16 create races', () => {
    it('adds one tenant-wide STAFF row out of 8 concurrent creates', async () => {
      const t = await ownedTenant();
      const responses = await burst(t.id, owner, {
        email: target.email,
        role: 'STAFF',
      });
      const rows = await tenantWideRows(target.userId, t.id);
      console.log('TENANT-WIDE CREATE observations', {
        statuses: responses.map((r) => r.status),
        rows,
      });
      expectOneCreate(responses);
      expect(rows).toBe(1);
    });

    it('answers 8 concurrent venue-scoped creates with one 201 and 409s, never 500', async () => {
      const t = await ownedTenant();
      const venue = await fixtures.createVenue(t.id);
      const responses = await burst(t.id, owner, {
        email: target.email,
        role: 'STAFF',
        venueId: venue.id,
      });
      const rows = await fixtures.db.tenantMember.count({
        where: { tenantId: t.id, userId: target.userId, venueId: venue.id },
      });
      console.log('VENUE CREATE observations', {
        statuses: responses.map((r) => r.status),
        rows,
      });
      expectOneCreate(responses);
      expect(rows).toBe(1);
    });

    it('reactivates one inactive row once out of 8 concurrent creates', async () => {
      const t = await ownedTenant();
      const inactive = await fixtures.addMember(
        target.userId,
        t.id,
        'STAFF',
        null,
        false,
      );
      const responses = await burst(t.id, owner, {
        email: target.email,
        role: 'STAFF',
      });
      const row = await fixtures.db.tenantMember.findUniqueOrThrow({
        where: { id: inactive.id },
      });
      console.log('REACTIVATE observations', {
        statuses: responses.map((r) => r.status),
        rows: await tenantWideRows(target.userId, t.id),
        active: row.isActive,
      });
      expectOneCreate(responses);
      expect(
        (responses.find((r) => r.status === 201)?.body as ResponseBody).message,
      ).toBe(messages.REACTIVATE);
      expect(await tenantWideRows(target.userId, t.id)).toBe(1);
      expect(row.isActive).toBe(true);
    });

    it('lets one of 8 concurrent first-owner claims win', async () => {
      const t = await fixtures.createTenant('PENDING', {
        email: contact.email,
      });
      const responses = await burst(t.id, contact, {
        email: contact.email,
        role: 'OWNER',
      });
      const owners = await activeOwners(t.id);
      console.log('CLAIM observations', {
        statuses: responses.map((r) => r.status),
        owners,
      });
      expectOneCreate(responses);
      expect(owners).toBe(1);
      expect(await tenantWideRows(contact.userId, t.id)).toBe(1);
    });
  });

  describe('#15 last owner', () => {
    it('rejects sole-owner self-removal and keeps the row unchanged', async () => {
      const t = await ownedTenant();
      const before = await fixtures.db.tenantMember.findUniqueOrThrow({
        where: { id: t.ownerId },
      });
      const response = await remove(t.id, owner, t.ownerId);
      console.log('SOLE OWNER DELETE observations', {
        status: response.status,
        owners: await activeOwners(t.id),
      });
      expectMessage(response, 409, messages.LAST_OWNER);
      expect(
        await fixtures.db.tenantMember.findUniqueOrThrow({
          where: { id: t.ownerId },
        }),
      ).toEqual(before);
    });
    it.each([false, true])(
      'rejects sole-owner demotion (venue=%s)',
      async (withVenue) => {
        const t = await ownedTenant();
        const before = await fixtures.db.tenantMember.findUniqueOrThrow({
          where: { id: t.ownerId },
        });
        const body: MemberBody = { role: 'STAFF' };
        if (withVenue) body.venueId = (await fixtures.createVenue(t.id)).id;
        const response = await patch(t.id, owner, t.ownerId, body);
        console.log('SOLE OWNER PATCH observations', {
          withVenue,
          status: response.status,
          owners: await activeOwners(t.id),
        });
        expectMessage(response, 409, messages.LAST_OWNER);
        expect(
          await fixtures.db.tenantMember.findUniqueOrThrow({
            where: { id: t.ownerId },
          }),
        ).toEqual(before);
      },
    );
    it.each(['delete', 'demote', 'demote with venue'] as const)(
      'allows self-%s when a second owner remains',
      async (mutation) => {
        const t = await ownedTenant();
        await fixtures.addMember(owner2.userId, t.id, 'OWNER');
        if (mutation === 'delete')
          await remove(t.id, owner, t.ownerId).expect(200);
        else {
          const body: MemberBody = { role: 'STAFF' };
          if (mutation === 'demote with venue')
            body.venueId = (await fixtures.createVenue(t.id)).id;
          await patch(t.id, owner, t.ownerId, body).expect(200);
        }
        expect(await activeOwners(t.id)).toBe(1);
        await list(t.id, owner2).expect(200);
      },
    );
    it('allows an owner to remove a different non-last owner', async () => {
      const t = await ownedTenant();
      const second = await fixtures.addMember(owner2.userId, t.id, 'OWNER');
      await remove(t.id, owner, second.id).expect(200);
      expect(await activeOwners(t.id)).toBe(1);
      await list(t.id, owner).expect(200);
    });
  });

  describe('#15 races', () => {
    it('never leaves zero owners when two owners remove each other (burst)', async () => {
      const observations: { statuses: number[]; owners: number }[] = [];
      for (let iteration = 0; iteration < 10; iteration++) {
        const t = await ownedTenant();
        const second = await fixtures.addMember(owner2.userId, t.id, 'OWNER');
        gate.arm(2);
        let responses: request.Response[];
        try {
          responses = await Promise.all([
            remove(t.id, owner, second.id),
            remove(t.id, owner2, t.ownerId),
          ]);
        } finally {
          gate.disarm();
        }
        observations.push({
          statuses: responses.map((r) => r.status).sort((a, b) => a - b),
          owners: await activeOwners(t.id),
        });
      }
      console.log('OWNER BURST observations', observations);
      expect(
        observations.every(
          (observation) =>
            observation.owners === 1 &&
            observation.statuses[0] === 200 &&
            [403, 409].includes(observation.statuses[1]),
        ),
      ).toBe(true);
    });

    it('blocks a removal on the tenant lock and rejects it once the holder commits', async () => {
      const t = await ownedTenant();
      const second = await fixtures.addMember(owner2.userId, t.id, 'OWNER');
      let release!: () => void;
      let signal!: () => void;
      const ready = new Promise<void>((resolve) => {
        signal = resolve;
      });
      const released = new Promise<void>((resolve) => {
        release = resolve;
      });
      let holderPid = -1;
      const holder = fixtures.db.$transaction(
        async (tx) => {
          const [backend] = await tx.$queryRaw<
            { pid: number }[]
          >`SELECT pg_backend_pid() AS pid`;
          holderPid = backend.pid;
          await tx.tenant.updateMany({
            where: { id: t.id },
            data: { updatedAt: new Date() },
          });
          await tx.tenantMember.update({
            where: { id: second.id },
            data: { isActive: false },
          });
          signal();
          await released;
        },
        { maxWait: 5_000, timeout: 30_000 },
      );
      let blocked = false;
      let response: request.Response;
      try {
        await Promise.race([ready, holder]);
        const pending = remove(t.id, owner2, t.ownerId).then(
          (result) => result,
        );
        try {
          const deadline = Date.now() + 5_000;
          while (Date.now() < deadline) {
            const waiters = await fixtures.db.$queryRaw<{ pid: number }[]>`
              SELECT pid FROM pg_stat_activity
              WHERE datname = current_database() AND wait_event_type = 'Lock'
                AND query LIKE 'UPDATE "public"."Tenant"%'
                AND ${holderPid}::int = ANY(pg_blocking_pids(pid))
            `;
            if (waiters.length) {
              blocked = true;
              break;
            }
            await new Promise((resolve) => setTimeout(resolve, 50));
          }
        } finally {
          release();
        }
        await holder;
        response = await pending;
      } finally {
        release();
        await holder;
      }
      const a = await fixtures.db.tenantMember.findUniqueOrThrow({
        where: { id: t.ownerId },
      });
      const observation = {
        blocked,
        status: response.status,
        owners: await activeOwners(t.id),
        aActive: a.isActive,
      };
      console.log('OWNER DETERMINISTIC observations', observation);
      expect(observation).toEqual({
        blocked: true,
        status: 403,
        owners: 1,
        aActive: true,
      });
    });
  });

  describe('update scope collisions', () => {
    it.each([true, false])(
      'rejects a move into an occupied tenant-wide scope (active=%s)',
      async (isActive) => {
        const t = await ownedTenant();
        const venue = await fixtures.createVenue(t.id);
        await fixtures.addMember(target.userId, t.id, 'STAFF', null, isActive);
        const scoped = await fixtures.addMember(
          target.userId,
          t.id,
          'STAFF',
          venue.id,
        );
        const response = await patch(t.id, owner, scoped.id, { venueId: null });
        const rows = await tenantWideRows(target.userId, t.id);
        console.log('TENANT-WIDE COLLISION observations', {
          isActive,
          status: response.status,
          rows,
        });
        expectMessage(response, 409, messages.ALREADY_EXISTS);
        expect(rows).toBe(1);
        expect(
          (
            await fixtures.db.tenantMember.findUniqueOrThrow({
              where: { id: scoped.id },
            })
          ).venueId,
        ).toBe(venue.id);
      },
    );
    it('rejects a move into an occupied venue scope', async () => {
      const t = await ownedTenant();
      const v1 = await fixtures.createVenue(t.id);
      const v2 = await fixtures.createVenue(t.id);
      const scoped = await fixtures.addMember(
        target.userId,
        t.id,
        'STAFF',
        v1.id,
      );
      await fixtures.addMember(target.userId, t.id, 'STAFF', v2.id);
      const response = await patch(t.id, owner, scoped.id, { venueId: v2.id });
      console.log('VENUE COLLISION observations', { status: response.status });
      expectMessage(response, 409, messages.ALREADY_EXISTS);
      expect(
        (
          await fixtures.db.tenantMember.findUniqueOrThrow({
            where: { id: scoped.id },
          })
        ).venueId,
      ).toBe(v1.id);
    });
  });

  describe('platform admin', () => {
    // The tenant-context middleware ignores unknown tenant ids, so every caller
    // gets the same 400 before any admin/owner check can differ.
    it('rejects reads on a tenant that does not exist with 400 for every caller', async () => {
      const missing = randomUUID();
      const statuses = [
        (await list(missing, admin)).status,
        (await find(missing, admin, randomUUID())).status,
        (await list(missing, owner)).status,
      ];
      expect(statuses).toEqual([400, 400, 400]);
    });
    it('lists, finds, creates, updates and removes members without a membership', async () => {
      const t = await ownedTenant();
      const venue = await fixtures.createVenue(t.id);
      const staff = await fixtures.addMember(target.userId, t.id, 'STAFF');
      // Keep the target independent of create, so every operation is observed on old code.
      const responses = [
        await list(t.id, admin),
        await find(t.id, admin, staff.id),
        await post(t.id, admin, { email: target2.email, role: 'STAFF' }),
        await patch(t.id, admin, staff.id, { venueId: venue.id }),
        await remove(t.id, admin, staff.id),
      ];
      console.log('ADMIN ALL OPERATIONS observations', {
        statuses: responses.map((r) => r.status),
      });
      expect(responses.map((r) => r.status)).toEqual([200, 200, 201, 200, 200]);
    });
    it.each([false, true])(
      'restores an ownerless tenant (reactivate=%s)',
      async (reactivate) => {
        const t = await fixtures.createTenant();
        const inactive = await fixtures.addMember(
          owner.userId,
          t.id,
          'OWNER',
          null,
          false,
        );
        const response = await post(t.id, admin, {
          email: reactivate ? owner.email : target.email,
          role: 'OWNER',
        });
        console.log('ADMIN RECOVERY observations', {
          reactivate,
          status: response.status,
          owners: await activeOwners(t.id),
        });
        expectMessage(
          response,
          201,
          reactivate ? messages.REACTIVATE : messages.CREATED,
        );
        expect(await activeOwners(t.id)).toBe(1);
        if (reactivate)
          expect((response.body as ResponseBody).content.id).toBe(inactive.id);
      },
    );
    it.each(['delete', 'demote'] as const)(
      'prevents admin %s of the sole owner',
      async (mutation) => {
        const t = await ownedTenant();
        const response =
          mutation === 'delete'
            ? await remove(t.id, admin, t.ownerId)
            : await patch(t.id, admin, t.ownerId, { role: 'STAFF' });
        console.log('ADMIN LAST OWNER observations', {
          mutation,
          status: response.status,
        });
        expectMessage(response, 409, messages.LAST_OWNER);
        expect(await activeOwners(t.id)).toBe(1);
      },
    );
    it('adds a second owner before removing the first', async () => {
      const t = await ownedTenant();
      const created = await post(t.id, admin, {
        email: owner2.email,
        role: 'OWNER',
      });
      const removed = await remove(t.id, admin, t.ownerId);
      console.log('ADMIN TRANSFER observations', {
        statuses: [created.status, removed.status],
        owners: await activeOwners(t.id),
      });
      expect([created.status, removed.status]).toEqual([201, 200]);
      expect(await activeOwners(t.id)).toBe(1);
      await list(t.id, owner2).expect(200);
    });
    it('rejects a non-admin non-owner for all five operations', async () => {
      const t = await ownedTenant();
      const responses = [
        await list(t.id, outsider),
        await find(t.id, outsider, t.ownerId),
        await post(t.id, outsider, { email: target.email, role: 'STAFF' }),
        await patch(t.id, outsider, t.ownerId, { role: 'STAFF' }),
        await remove(t.id, outsider, t.ownerId),
      ];
      for (const response of responses)
        expectMessage(response, 403, messages.FORBIDDEN);
      expect(await activeOwners(t.id)).toBe(1);
    });
  });

  describe('review focus', () => {
    it('allows a sole owner no-op role PATCH and empty PATCH', async () => {
      const t = await ownedTenant();
      await patch(t.id, owner, t.ownerId, { role: 'OWNER' }).expect(200);
      await patch(t.id, owner, t.ownerId, {}).expect(200);
      expect(await activeOwners(t.id)).toBe(1);
    });
    it('ignores email in a PATCH without changing the target user', async () => {
      const t = await ownedTenant();
      const staff = await fixtures.addMember(target.userId, t.id, 'STAFF');
      await patch(t.id, owner, staff.id, {
        email: target2.email,
        role: 'STAFF',
      }).expect(200);
      expect(
        (
          await fixtures.db.tenantMember.findUniqueOrThrow({
            where: { id: staff.id },
          })
        ).userId,
      ).toBe(target.userId);
    });
    it('rolls back Tenant.updatedAt on a LAST_OWNER rejection', async () => {
      const t = await ownedTenant();
      const before = await fixtures.db.tenant.findUniqueOrThrow({
        where: { id: t.id },
        select: { updatedAt: true },
      });
      const response = await remove(t.id, owner, t.ownerId);
      const after = await fixtures.db.tenant.findUniqueOrThrow({
        where: { id: t.id },
        select: { updatedAt: true },
      });
      console.log('ROLLBACK observations', {
        status: response.status,
        unchanged: +before.updatedAt === +after.updatedAt,
      });
      expectMessage(response, 409, messages.LAST_OWNER);
      expect(after.updatedAt).toEqual(before.updatedAt);
    });
    it('returns 404 for a foreign member id on PATCH and DELETE and preserves it', async () => {
      const t = await ownedTenant();
      const foreign = await fixtures.createTenant();
      const staff = await fixtures.addMember(
        target.userId,
        foreign.id,
        'STAFF',
      );
      const before = await fixtures.db.tenantMember.findUniqueOrThrow({
        where: { id: staff.id },
      });
      expectMessage(
        await patch(t.id, owner, staff.id, { role: 'STAFF' }),
        404,
        messages.NOT_FOUND,
      );
      expectMessage(
        await remove(t.id, owner, staff.id),
        404,
        messages.NOT_FOUND,
      );
      expect(
        await fixtures.db.tenantMember.findUniqueOrThrow({
          where: { id: staff.id },
        }),
      ).toEqual(before);
    });
    it('does not let the contact claim a tenant with only an inactive row', async () => {
      const t = await fixtures.createTenant('PENDING', {
        email: contact.email,
      });
      const inactive = await fixtures.addMember(
        owner.userId,
        t.id,
        'OWNER',
        null,
        false,
      );
      expectMessage(
        await post(t.id, contact, { email: contact.email, role: 'OWNER' }),
        403,
        messages.FORBIDDEN,
      );
      expect(await activeOwners(t.id)).toBe(0);
      expect(
        (
          await fixtures.db.tenantMember.findUniqueOrThrow({
            where: { id: inactive.id },
          })
        ).isActive,
      ).toBe(false);
    });
  });
});
