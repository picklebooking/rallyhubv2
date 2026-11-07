# Management Authorization, Users Cleanup, CUSTOMER Removal Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.
>
> **Codex:** if those skills aren't available, execute the tasks in order. Run each task's verification commands before its commit, and don't start a task until the previous one's tests pass.

**Goal:** Close audit findings #13 (CUSTOMER role leftovers), #1 (management routes have no tenant authorization) and #2 (`GET /users/all` exposes every user), as specified in the design doc.

**Architecture:**
- **One migration** adds `User.isPlatformAdmin` and removes `CUSTOMER` from the `TenantRole` database enum.
- **One shared `AuthorizationService`**, in a new `authorization` module, owns every management permission rule. Its Prisma queries live in `AuthorizationRepository`.
- **Tenant, venue and court services** call it using the session user, and scope their repository writes to the resolved tenant or venue.
- **The template user directory** is deleted from the API, `packages/shared` and the web app.

**Tech Stack:** NestJS 11 (URI versioning, `@thallesp/nestjs-better-auth` global guard), Prisma 7 + Postgres, Jest + supertest, Next.js 16 / TanStack Query.

**Spec:** `docs/superpowers/specs/2026-11-07-authorization-users-cleanup-design.md`. Read it before starting. The permission matrix there is the source of truth.

## Global Constraints

- Branch `fix/system-audit-remediation` (PR #34). Commit after each task. Never push.
- **Commit attribution:** no `Co-Authored-By`, `Claude-Session` or 🤖 lines in commits.
- **Repo conventions (`AGENTS.md`):**
  - thin controllers → services → repositories
  - Prisma only in repositories
  - DTOs for request shapes
  - explicit return types
  - no `any`
  - shared HTTP types in `packages/shared`, imported type-only
- **Migrations:** create and apply them only with the Prisma CLI. **Never write or edit migration SQL by hand.**
  - **Local test DB** (`TEST_DATABASE_URL`, local Postgres.app `rallyhub_test`): `migrate dev` and `migrate reset` are allowed. All migrations are created here.
  - **Hosted dev DB** (`DATABASE_URL` in `apps/api/.env`, a remote Prisma Postgres): the user authorized applying the new migration, but only with `npx prisma migrate status`, then `npx prisma migrate deploy`. **Never run `migrate dev`, `migrate reset` or `db push` against it.**
  - Never run `npm install`.
- **Test database:** `TEST_DATABASE_URL` must point at a disposable Postgres. Use the local Postgres.app (`localhost:5432`) database `rallyhub_test`. DB-backed suites `describe.skip` without it, matching `open-play.integration.spec.ts`. **For this plan, every task's verification runs with it set.**
- **Responses:** a signed-in caller who isn't allowed gets `403` (also for other tenants' resources). Unknown ids get `404`, checked **before** permission, as the resource is loaded first.
- **Platform admin:** `isPlatformAdmin` is read from the DB on each check. Never add it to Better Auth `additionalFields`, sessions or any response.
- **Read routes:** leave them unchanged.
- **Out of scope:** the tenant-member routes and their claim flow, and Open Play behaviour.

## Review Focus

1. **Sign-up can't make someone a platform admin.** POST `/api/auth/sign-up/email` with `isPlatformAdmin: true` in the body must leave the flag `false`. Covered in Task 3.
2. **Inactive memberships count as none.** A user whose OWNER or STAFF row has `isActive = false` is refused everywhere. Covered in Tasks 4–6.
3. **The order of not-found vs forbidden checks.** `PATCH /venues/<missing-id>` by a customer returns `404`, not `403`. `PATCH` of an existing venue in another tenant returns `403`, and the venue must be unchanged in the DB afterwards. Covered in Task 5.
4. **Court create through a header naming someone else's venue.** `X-Venue-Id` naming a venue in a tenant the caller doesn't belong to returns `403`, and no court row is created. Covered in Task 6.
5. **The dev bypass must stay off in the HTTP tests.** If `AUTH_DEV_BYPASS_EMAIL` is set, the global guard is disabled and every authorization test passes vacuously. The harness must delete it before building the app, and assert that an unauthenticated request gets `401`. Covered in Task 3.

---

### Task 1: #13 + platform-admin column (one migration, green suite)

**Files:**
- Modify: `apps/api/prisma/schema.prisma`. Add `isPlatformAdmin Boolean @default(false)` to `model User`. Fix the comment on `TenantMember.venueId` to "null = tenant-wide (OWNER or STAFF); set = one venue (STAFF)", and the comment on `TenantRole.STAFF` to "manages venues and courts within their scope".
- Create: `apps/api/prisma/migrations/<timestamp>_platform_admin_and_drop_customer_role/migration.sql` (generated)
- Modify:
  - `apps/api/src/tenant-member/tenant-member.service.spec.ts` (~107, ~166, ~172)
  - `apps/api/src/tenant-member/tenant-member.controller.spec.ts` (~66)
  - `apps/api/src/open-play/open-play.integration.spec.ts` (~526)

**Interfaces:**
- Produces: the `User.isPlatformAdmin` column, and a `TenantRole` with only `OWNER | STAFF` in both the client and the DB.

- [ ] **Step 1:** Edit the schema as above, then run `npm run db:generate` (from the root).
- [ ] **Step 2:** Generate and apply the migration on the test DB with the Prisma CLI:

  ```bash
  cd apps/api && DATABASE_URL="$TEST_DATABASE_URL" npx prisma migrate dev --name platform_admin_and_drop_customer_role
  ```

  Expected: a new folder whose SQL adds the column and does the rename/create/cast/drop of `"TenantRole"`. **Do not edit the generated SQL.**
- [ ] **Step 3:** Run `npm run db:generate` from the root. Applying the migration to the hosted dev DB happens in Task 8, after the full suite is green.
- [ ] **Step 4:** Replay all migrations onto an empty test DB:

  ```bash
  DATABASE_URL="$TEST_DATABASE_URL" npx prisma migrate reset --force --skip-seed
  ```

  Expected: every migration applies with no errors.
- [ ] **Step 5:** Update the CUSTOMER references in the three specs. Where a test used CUSTOMER to mean "a role that may not manage", use `TenantRole.STAFF` if it's testing role validation. Use "no membership row" (or an inactive membership) if it's testing that a non-member is refused. Keep each test's original assertion intent.
- [ ] **Step 6:** Run

  ```bash
  TEST_DATABASE_URL=... npm run test -w api -- --runInBand
  ```

  Expected: **0 failed suites**. The 3 suites that failed at baseline now compile and pass, and the open-play integration suite runs (it doesn't skip).
- [ ] **Step 7:** Commit `fix(api): add platform-admin flag and drop CUSTOMER role from database (#13)`

### Task 2: Shared authorization policy

**Files:**
- Create: `apps/api/src/authorization/authorization.module.ts`, `authorization.service.ts`, `authorization.repository.ts`, `authorization.service.spec.ts`, `authorization.repository.integration.spec.ts`
- Modify: `apps/api/src/constants/error-code.constant.ts`. Add `AUTHORIZATION_MESSAGES = { FORBIDDEN: "You don't have permission to perform this action." }` alongside the existing message groups.
- Modify: `apps/api/src/open-play/open-play.service.ts` (~365), `open-play.repository.ts` (~327), `open-play.repository.spec.ts` (~562), `open-play.integration.spec.ts` (~532), `open-play.module.ts`. Delete `OpenPlayRepository.hasVenueStaffMembership`. `OpenPlayService` calls `AuthorizationRepository.hasVenueManagerMembership` instead, with the same arguments and behaviour. Move its tests to the new repository spec.

**Interfaces (Produces):**
- `AuthorizationRepository` (Prisma only):
  - `isPlatformAdmin(userId: string): Promise<boolean>`: the `User.isPlatformAdmin` value; `false` if the user doesn't exist.
  - `hasTenantOwnerMembership(userId: string, tenantId: string): Promise<boolean>`: active, `role OWNER`, `venueId null`.
  - `hasTenantWideMembership(userId: string, tenantId: string): Promise<boolean>`: active, `role in (OWNER, STAFF)`, `venueId null`.
  - `hasVenueManagerMembership(userId: string, tenantId: string, venueId: string): Promise<boolean>`: active, `role in (OWNER, STAFF)`, `venueId null OR = venueId` (the moved Open Play query).
- `AuthorizationService` (every `assert*` throws `ForbiddenException(AUTHORIZATION_MESSAGES.FORBIDDEN)`, and returns immediately when `isPlatformAdmin` is true):
  - `assertPlatformAdmin(userId: string): Promise<void>`
  - `assertCanEditTenant(userId: string, tenantId: string): Promise<void>`: owner membership.
  - `assertCanCreateVenue(userId: string, tenantId: string): Promise<void>`: tenant-wide membership.
  - `assertCanManageVenue(userId: string, tenantId: string, venueId: string): Promise<void>`: venue manager membership.
- `AuthorizationModule` exports both providers. It imports `PrismaModule`.

- [ ] **Step 1: Write the failing service tests** in `authorization.service.spec.ts`, with a mocked repository:
  - `it('lets a platform admin through every assert without checking memberships')`: `isPlatformAdmin → true`. All four asserts resolve, and no `has*` method is called.
  - `it('assertPlatformAdmin rejects a non-admin with 403')`
  - `it('assertCanEditTenant allows an owner and rejects tenant-wide staff')`
  - `it('assertCanCreateVenue allows tenant-wide staff and rejects venue staff')`
  - `it('assertCanManageVenue allows venue staff for their venue and rejects others')`
- [ ] **Step 2: Write the failing repository integration tests** (`describeIfDb`, real rows). Each `has*` method returns true or false correctly for:
  - an active owner
  - tenant-wide staff
  - venue staff on its own venue and on another venue
  - an **inactive** owner
  - a member of a different tenant

  Also check that `isPlatformAdmin` returns false for an unknown user id.
- [ ] **Step 3:** Run `npm run test -w api -- authorization`. Expected: FAIL, because the modules don't exist yet.
- [ ] **Step 4:** Implement the repository, service and module, move the Open Play query, and wire `AuthorizationModule` into `OpenPlayModule`.
- [ ] **Step 5:** Run `TEST_DATABASE_URL=... npm run test -w api -- authorization open-play`. Expected: PASS, and Open Play tests unchanged in outcome.
- [ ] **Step 6:** Commit `feat(api): add shared management authorization policy (#1)`

### Task 3: HTTP test harness with real sessions

**Files:**
- Create: `apps/api/src/test-support/http-app.ts`, `apps/api/src/test-support/auth-session.ts`, `apps/api/src/test-support/fixtures.ts`, `apps/api/src/authorization/harness.http.spec.ts`

**Interfaces (Produces):**
- `createHttpTestApp(): Promise<INestApplication>`. It must:
  - set `process.env.DATABASE_URL = process.env.TEST_DATABASE_URL`, delete `process.env.AUTH_DEV_BYPASS_EMAIL`, and set `RATE_LIMIT_MAX` high (e.g. `100000`), all before importing or compiling `AppModule`
  - build the app with `{ bodyParser: false }`, `enableVersioning({ type: VersioningType.URI })` and the same global `ValidationPipe({ whitelist: true, transform: true })` as `src/main.ts`
  - call `init()`
- `signUpAndSignIn(app: INestApplication, opts?: { email?: string; name?: string }): Promise<{ userId: string; email: string; cookie: string }>`. It must:
  - POST `/api/auth/sign-up/email` with `{ email, password, name }` (unique email per call), then sign in at `/api/auth/sign-in/email` if sign-up didn't already return a session cookie
  - return the `Set-Cookie` session cookie string, ready to pass as the `Cookie` header
  - send an `Origin` header that `getTrustedOrigins()` in `src/auth/auth.ts` accepts, if Better Auth requires one
- `fixtures.ts` (direct Prisma writes against `TEST_DATABASE_URL`, each run namespaced by a random suffix, with cleanup that deletes only rows it created):
  - `createTenant(): Promise<{ id: string }>`
  - `createVenue(tenantId: string): Promise<{ id: string }>`
  - `createCourt(venueId: string): Promise<{ id: string }>`
  - `addMember(userId: string, tenantId: string, role: 'OWNER' | 'STAFF', venueId?: string | null, isActive?: boolean): Promise<void>`
  - `makePlatformAdmin(userId: string): Promise<void>`
  - `cleanup(): Promise<void>`

- [ ] **Step 1: Write `harness.http.spec.ts`** (`describeIfDb`):
  - `it('rejects an unauthenticated request with 401')`: `GET /users/me` with no cookie → 401.
  - `it('accepts a real session cookie')`: after `signUpAndSignIn`, `GET /users/me` → 200 with that email.
  - `it('ignores isPlatformAdmin in the sign-up body')`: sign up with `isPlatformAdmin: true` in the body, then the DB row has `isPlatformAdmin === false`.
- [ ] **Step 2:** Run it. Expected: FAIL, because the helpers don't exist yet.
- [ ] **Step 3:** Implement the three helper files.
- [ ] **Step 4:** Run `TEST_DATABASE_URL=... npm run test -w api -- harness`. Expected: 3 passing.
- [ ] **Step 5:** Commit `test(api): add HTTP test harness with real Better Auth sessions (#1)`

### Task 4: Tenant routes

**Files:**
- Modify: `apps/api/src/tenant/tenant.controller.ts`, `tenant.service.ts`, `tenant.module.ts` (import `AuthorizationModule`), `tenant.controller.spec.ts`, `tenant.service.spec.ts`
- Create: `apps/api/src/tenant/tenant.http.spec.ts`

**Interfaces:**
- Consumes: `AuthorizationService` (Task 2), and the harness and fixtures (Task 3).
- The controller takes `@Session() session: UserSession` on the four write routes and passes `session.user.id` as a new **first** parameter:
  - `createTenant(actorId, …)` → `assertPlatformAdmin`
  - `updateTenantStatus(actorId, …)` → `assertPlatformAdmin`
  - `deleteTenantById(actorId, …)` → `assertPlatformAdmin`
  - `updateTenantData(actorId, id, …)` → load the tenant (404 if missing), then `assertCanEditTenant(actorId, id)`
- `findTenantById` is unchanged.

- [ ] **Step 1: Write `tenant.http.spec.ts`** (`describeIfDb`, using the real versioned paths from `tenant.controller.ts`):
  - create / status / delete: customer → 403, OWNER → 403, tenant-wide STAFF → 403, platform admin → success
  - patch details: OWNER of this tenant → 200; OWNER of another tenant → 403; tenant-wide STAFF → 403; customer → 403; inactive OWNER → 403; platform admin → 200; unknown id → 404
- [ ] **Step 2:** Run it. Expected: FAIL (writes currently succeed for everyone).
- [ ] **Step 3:** Implement the changes, and update the existing unit specs for the new `actorId` parameter by mocking `AuthorizationService`.
- [ ] **Step 4:** Run `TEST_DATABASE_URL=... npm run test -w api -- tenant`. Expected: PASS.
- [ ] **Step 5:** Commit `fix(api): restrict tenant management to platform admins and owners (#1)`

### Task 5: Venue routes

**Files:**
- Modify: `apps/api/src/venues/venues.controller.ts`, `venues.service.ts`, `venues.repository.ts`, `venues.module.ts`, `venues.controller.spec.ts`, `venues.service.spec.ts`, `venues.repository.spec.ts`
- Create: `apps/api/src/venues/venues.http.spec.ts`

**Interfaces:**
- Consumes: `AuthorizationService`, and the harness and fixtures.
- The controller adds `@Session()` to `POST`, `PATCH :id` and `DELETE :id`, and passes `actorId` first.
- Service:
  - `create(actorId: string, tenantId: string, dto: CreateVenueDto)` → `assertCanCreateVenue(actorId, tenantId)`
  - `update(actorId: string, id: string, dto: UpdateVenueDto)` → load the venue (404), then `assertCanManageVenue(actorId, venue.tenantId, venue.id)`
  - `delete(actorId: string, id: string)` → the same order as `update`
- Repository (scoped writes): `update(id: string, tenantId: string, data: UpdateVenueDto): Promise<Venue>` and `delete(id: string, tenantId: string): Promise<Venue>`. Both filter on `{ id, tenantId }`.

- [ ] **Step 1: Write `venues.http.spec.ts`** (`describeIfDb`):
  - **create, with `X-Tenant-Id`:**
    - OWNER and tenant-wide STAFF → 201
    - venue STAFF → 403; customer → 403
    - `X-Tenant-Id` naming another tenant → 403, and no row is created
  - **update / delete:**
    - OWNER and tenant-wide STAFF → success
    - venue STAFF on own venue → success, on a sibling venue → 403
    - OWNER of another tenant → 403, and the venue is unchanged in the DB
    - inactive STAFF → 403; customer → 403
    - customer on an unknown id → 404
    - platform admin → success
- [ ] **Step 2:** Run it. Expected: FAIL.
- [ ] **Step 3:** Implement the changes, and update the unit specs for the new signatures.
- [ ] **Step 4:** Run `TEST_DATABASE_URL=... npm run test -w api -- venues`. Expected: PASS.
- [ ] **Step 5:** Commit `fix(api): enforce tenant membership on venue management (#1)`

### Task 6: Court routes

**Files:**
- Modify: `apps/api/src/courts/courts.controller.ts`, `courts.service.ts`, `courts.repository.ts`, `courts.module.ts`, `courts.controller.spec.ts`, `courts.service.spec.ts`, `courts.repository.spec.ts`
- Create: `apps/api/src/courts/courts.http.spec.ts`

**Interfaces:**
- Consumes: `AuthorizationService`, the harness and fixtures, and the venue repository (for loading a venue's `tenantId`).
- Service:
  - `create(actorId: string, venueId: string, dto: CreateCourtDto)` → load the venue (404), then `assertCanManageVenue(actorId, venue.tenantId, venueId)`. Never consult a tenant header.
  - `update(actorId: string, id: string, dto: UpdateCourtDto)` → load the court (404), then its venue, then `assertCanManageVenue(actorId, venue.tenantId, court.venueId)`
  - `delete(actorId: string, id: string)` → the same order as `update`
- Repository (scoped writes): `update(id: string, venueId: string, data: UpdateCourtDto): Promise<Court>` and `delete(id: string, venueId: string): Promise<Court>`. Both filter on `{ id, venueId }`.

- [ ] **Step 1: Write `courts.http.spec.ts`** (`describeIfDb`):
  - **create, with `X-Venue-Id`:**
    - OWNER, tenant-wide STAFF, and venue STAFF of that venue → 201
    - venue STAFF of a sibling venue → 403
    - `X-Venue-Id` naming another tenant's venue → 403, and no court row is created
    - customer → 403
  - **update / delete:**
    - the same roles as create
    - OWNER of another tenant → 403, and the court is unchanged
    - inactive membership → 403
    - unknown id → 404
    - platform admin → success
- [ ] **Step 2:** Run it. Expected: FAIL.
- [ ] **Step 3:** Implement the changes, and update the unit specs.
- [ ] **Step 4:** Run `TEST_DATABASE_URL=... npm run test -w api -- courts`. Expected: PASS.
- [ ] **Step 5:** Commit `fix(api): enforce venue membership on court management (#1)`

### Task 7: #2: remove the template user directory

**Files:**
- **API:**
  - Modify: `apps/api/src/users/users.controller.ts`, `users.service.ts`, `users.repository.ts`
  - Create: `apps/api/src/users/users.http.spec.ts`
- **Shared:** modify `packages/shared/api/users.d.ts` and `packages/shared/index.d.ts` (remove `GetAllUsersResponse` and anything only it uses).
- **Web:**
  - delete the `apps/web/app/(protected)/users/` and `apps/web/app/(protected)/data/` route folders
  - delete `apps/web/components/users/users-page.tsx`, `apps/web/components/data/data-page.tsx` and `apps/web/components/dashboard/recent-users-card.tsx`
  - delete `apps/web/hooks/api/use-all-users.ts`
  - modify `apps/web/components/dashboard/dashboard-data.ts` (remove the `/users` and `/data` nav entries)
  - modify the dashboard component that renders `RecentUsersCard`; use `grep -rn RecentUsersCard apps/web` to find it
  - modify `apps/web/lib/api/users.ts` (remove the all-users function, and keep anything `/users/me` uses)

**Interfaces:**
- `GET /users/me` and its shared types are unchanged.

- [ ] **Step 1: Write `users.http.spec.ts`** (`describeIfDb`):
  - `it('GET /users/all no longer exists')`: signed in → 404
  - `it('GET /users/me still works')`: signed in → 200
- [ ] **Step 2:** Run it. Expected: the first test FAILS (currently 200).
- [ ] **Step 3:** Delete the API method chain, the shared type and the web files listed above. After deleting, `grep -rn "users/all\|getAllUsers\|useAllUsers\|GetAllUsersResponse\|RecentUsersCard" apps packages` must return nothing.
- [ ] **Step 4: Verify:**

  ```bash
  TEST_DATABASE_URL=... npm run test -w api -- users
  npm run typecheck
  npm run build -w web
  npm run lint -w web
  ```

  Expected:
  - the users tests PASS
  - typecheck and build exit 0
  - lint has no errors and no more than the 17 baseline warnings
  - revert `apps/web/next-env.d.ts` if the build rewrites it (`git checkout apps/web/next-env.d.ts`)
- [ ] **Step 5:** Commit `fix: remove template user directory and /users/all endpoint (#2)`

### Task 8: Final verification

- [ ] **Step 1:** Replay migrations onto an empty test DB: `cd apps/api && DATABASE_URL="$TEST_DATABASE_URL" npx prisma migrate reset --force --skip-seed`. Expected: clean.
- [ ] **Step 2:** Run `TEST_DATABASE_URL=... npm run test -w api -- --runInBand`. Expected: **0 failed suites, 0 skipped DB suites**.
- [ ] **Step 3:** Run `npm run typecheck && npm run build -w api && npm run build -w web && npm run lint -w web`. Expected: all exit 0, and web lint warnings ≤ 17.
- [ ] **Step 4:** Run `git grep -n "CUSTOMER" -- apps/api/src apps/web packages`. Expected: no matches, apart from historical migration SQL under `prisma/migrations`, which is excluded by this path list.
- [ ] **Step 5: Apply the migration to the hosted dev DB.** From `apps/api`, with its `.env` `DATABASE_URL`:
  1. Run `npx prisma migrate status`. If it reports drift, failed migrations, or anything other than "the new migration is pending", **stop**. Don't apply anything; report the output.
  2. Otherwise run `npx prisma migrate deploy`.
  3. If deploy fails (e.g. leftover `CUSTOMER` rows break the enum cast), **don't** edit the migration and **don't** reset. Report the exact error.
- [ ] **Step 6: Report** to the user:
  - the commit list
  - the test counts
  - the migration folder name
  - a reminder to manually check the dashboard in light and dark mode
  - the `migrate status` and `migrate deploy` output for the hosted dev DB (Task 8 Step 5)
