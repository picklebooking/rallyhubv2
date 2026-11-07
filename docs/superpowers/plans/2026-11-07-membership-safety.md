# Membership Safety Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.
>
> **Codex:** if those skills aren't available, execute the tasks in order. Run each task's verification commands before its commit, and don't start a task until the previous one's gate passes.

**Goal:** Close audit findings #15 (the last owner can remove or demote themselves) and #16 (duplicate tenant-wide memberships), and let platform admins manage any tenant's members, as specified in the design.

**Architecture:**
- **One additive migration** adds the partial unique index `TenantMember_tenant_wide_key` on `("userId", "tenantId") WHERE "venueId" IS NULL`, behind the `partialIndexes` preview feature.
- **One pure rules module** (`tenant-member/tenant-member.rules.ts`, no Prisma client) owns "is an active tenant-wide owner", the role/scope rule, the first-owner claim rule and `wouldRemoveLastOwner`.
- **One tenant lock** (`TenantMemberRepository.withTenantLock`) runs every membership mutation as one interactive `$transaction`: it locks the tenant row first, then hands the service a tx-bound `LockedMembershipStore` (Prisma only). The service makes every decision on that store and throws Nest exceptions, which roll the transaction (and the `Tenant.updatedAt` bump) back. The lock maps `P2002` to `ALREADY_EXISTS` and retryable errors to `BUSY`.
- **Platform admins** pass every membership check through `AuthorizationRepository.isPlatformAdmin`, read outside the transaction, and stay bound by every other rule.

**Tech Stack:** NestJS 11, Prisma 7.10.1 + Postgres (pg adapter, `partialIndexes` preview), class-validator, `@nestjs/mapped-types`, Jest + supertest with real Better Auth sessions.

**Spec:** `docs/superpowers/specs/2026-11-07-membership-safety-design.md`. Read it first. Every decision in it is final; this plan only fixes what it left to the builder.

## Global Constraints

- Branch `fix/system-audit-remediation` (PR #34). One or more commits per task. **Never push, never edit the PR.**
- **Commit messages:** conventional style, referencing the audit numbers (e.g. `fix(api): … (#15)`). **No `Co-Authored-By`, `Claude-Session` or 🤖 lines.** Never commit `apps/web/next-env.d.ts` (run `git checkout apps/web/next-env.d.ts` if a build rewrites it) or any `.env` file.
- **Repo conventions (`AGENTS.md`):** thin controllers → services (business decisions) → repositories (all Prisma). DTOs for request shapes, explicit return types, no `any`. No shared contract change is expected; if one becomes necessary, it goes in `packages/shared`, imported type-only.
- **Schema changes only via** `cd apps/api && DATABASE_URL="$TEST_DATABASE_URL" npx prisma migrate dev --name <name>` against the local test DB, then `npm run db:generate` from the root. Adding `partialIndexes` to the generator's `previewFeatures` is a `schema.prisma` edit and is allowed. **Never hand-write or edit migration SQL, never edit historical migrations, never use `db push`.** Local resets use `migrate reset --force` (Prisma 7 rejects `--skip-seed`).
- **Never use the generated `userId_tenantId` compound selector** (`findUnique`/`upsert`/`update({ where: { userId_tenantId } })`). It ignores the index's `WHERE` and can address a venue row. Always filter with `venueId: null` (or the venue id) explicitly.
- **Hosted dev DB** (the `DATABASE_URL` in `apps/api/.env`): touched only in Task 7, in this order: the design's read-only duplicate pre-check; then `npx prisma migrate status`; then `npx prisma migrate deploy`. Nothing else. Never `migrate dev`/`reset` against it.
- **Test DB:** Jest does not read `.env`. Every test or test-DB command is preceded, in the same shell, by:

  ```bash
  export TEST_DATABASE_URL="postgresql://jpatrickzxc@localhost:5432/rallyhub_test"; unset AUTH_DEV_BYPASS_EMAIL
  ```

  A missing or unreachable test DB is a **hard stop**, not a skip: report it and stop. DB-backed suites use `getTestDatabaseUrl()` / `createHttpTestApp()` from `apps/api/src/test-support/http-app.ts`, `fixtures.signUp(app)`, and `HttpFixtures`/`teardownHttpSuite` from `test-support/fixtures.ts`. New suites keep the existing `describeIfDb` guard, but a run that reports any skipped suite or test counts as a failure.
- **Lock-waiter probes** are scoped to the holder's backend pid: the holder reads `pg_backend_pid()` inside its transaction, and the probe requires `${holderPid}::int = ANY(pg_blocking_pids(pid))`, exactly as in `court-book.http.spec.ts`.
- **No raw SQL in app code.** Tests may use `$queryRaw` only for `pg_stat_activity` / `pg_backend_pid()`. No new dependencies.
- **TDD:** RED before GREEN for every behavior change. The Task 1 suite is committed red against the old code (the design's commit 1); each later task turns its own `describe` blocks green. The race tests must be shown failing on the old code, with the output in the Task 1 commit body and report.
- **Reuse** `INTERACTIVE_TX_OPTIONS` and `isRetryableTransactionError` from `apps/api/src/prisma/interactive-transaction.ts`, and `BusyOutcome` from `open-play/open-play.repository.ts`. Don't copy them.
- **Messages:** tests assert against `ErrorConstant` constants, never literal strings.
- **No web UI.** Web must still typecheck, build and lint.
- **Fix minor review findings** in the task they're raised in; don't park them.

## Review Focus

1. **A no-op PATCH by the sole owner** (`{ role: 'OWNER' }`, or an empty body) must be `200`, not `LAST_OWNER`: the target stays an active tenant-wide owner. Pinned in Task 1's `review focus` block, green in Task 5.
2. **A PATCH body carrying `email`** must never change the target user. `UpdateTenantMemberDto` drops `email`; the row's `userId` is unchanged. Pinned in Task 1, enforced in Task 5.
3. **Every rejection after the lock rolls back the `Tenant.updatedAt` bump** (the #3 precedent): after a `409 LAST_OWNER`, the tenant's `updatedAt` is unchanged. Pinned in Task 1, green in Task 5.
4. **A member id from another tenant** sent with this tenant's `X-Tenant-Id` → `404` on PATCH and DELETE, and the foreign row is untouched. Pinned in Task 1 (already green; a regression pin).
5. **"Unclaimed" means no membership rows at all**: a tenant whose only row is an inactive owner can't be claimed by its contact (`403`); a platform admin restores it instead. Pinned in Task 1 (already green; a regression pin) and in Task 6's admin restore.

---

### Task 1: Red HTTP suite, fixtures and burst gate

**Files:**
- Create: `apps/api/src/test-support/burst-gate.ts`, `apps/api/src/test-support/burst-gate.spec.ts`, `apps/api/src/tenant-member/tenant-member.http.spec.ts`
- Modify: `apps/api/src/test-support/fixtures.ts`, `apps/api/src/court-book/court-book.http.spec.ts` (switch its inline gate to `createBurstGate`), `apps/api/src/constants/error-code.constant.ts`

**Interfaces (Produces):**
- `burst-gate.ts`: `type BurstGate = { interceptor: NestInterceptor; arm(expected: number, timeoutMs?: number): void; disarm(): void }` and `createBurstGate(): BurstGate`. Disarmed, the interceptor passes straight through. Armed with `n`, each request waits until `n` requests have entered, or rejects with `Error('Burst entry gate timed out')` after `timeoutMs` (default `5_000`). `disarm()` releases any waiters and clears the count. It's installed with `createHttpTestApp((app) => app.useGlobalInterceptors(gate.interceptor))`. This is the court-book gate, moved; behaviour is unchanged.
- `HttpFixtures` (existing call sites keep working):
  - `createTenant(status: TenantStatus = 'PENDING', opts: { email?: string } = {}): Promise<{ id: string }>`
  - `addMember(...)` keeps its parameters but now returns `Promise<{ id: string }>`.
  - `verifyEmail(userId: string): Promise<void>` sets `emailVerified: true`.
  - Members created over HTTP aren't tracked; they cascade with their tenant or user in `cleanup()`.
- `TENANT_MEMBER_MESSAGES` gains (inert until Task 4/5):
  - `LAST_OWNER: 'A tenant must keep at least one active owner. Add another owner first.'`
  - `BUSY: 'Lots of changes are being made to this team right now. Please try again in a moment.'`

- [ ] **Step 0: Record baselines** in a scratch directory outside the repo:
  - `git rev-parse HEAD`: the start SHA.
  - `npm run lint -w web 2>&1 | tail -5`: the web warning count.
  - `cd apps/api && npx eslint src/tenant-member src/authorization src/test-support src/constants src/prisma src/court-book/court-book.http.spec.ts`: the API error count on existing files this plan touches.
  - Run the test-DB preamble, then `cd apps/api && DATABASE_URL="$TEST_DATABASE_URL" npx prisma migrate status`. Expected: "Database schema is up to date". Otherwise **stop**.
- [ ] **Step 1: Write `burst-gate.spec.ts`** (plain unit test, calling `interceptor.intercept(context, { handle: () => of('ok') })`):
  - `it('passes through when disarmed')`
  - `it('holds each request until the armed count has entered')`: armed with 2, the first call is still pending after a tick; after the second call both resolve.
  - `it('rejects with a timeout when too few requests arrive')`: armed with 2, `timeoutMs` 50, one call rejects with `'Burst entry gate timed out'`.
- [ ] **Step 2: Run** `npm run test -w api -- burst-gate`. Expected: FAIL (module not found). Implement `burst-gate.ts`, switch `court-book.http.spec.ts` to it, extend the fixtures and add the two messages. Run `npm run test -w api -- burst-gate court-book.http`. Expected: PASS.
- [ ] **Step 3: Write `tenant-member.http.spec.ts`** (`describeIfDb`, `jest.setTimeout(120_000)`). Every case uses a fresh `fixtures.createTenant()` unless it says otherwise.
  - **Setup:** `beforeAll` creates the app with a burst gate and signs up `owner`, `owner2`, `target`, `target2`, `contact`, `admin` and `outsider` with `fixtures.signUp(app)`; `fixtures.verifyEmail(contact.userId)`; `fixtures.makePlatformAdmin(admin.userId)`. `afterAll(() => teardownHttpSuite(app, fixtures))`.
  - **Requests:** paths from `MainRoute` with version `v1`: `POST /v1/tenant-member/create`, `GET /v1/tenant-member/findAll`, `GET /v1/tenant-member/find/:id`, `PATCH /v1/tenant-member/patch/:id`, `DELETE /v1/tenant-member/delete/:id`. Headers: `Cookie` and `X-Tenant-Id`.
  - **Helpers in the file:** `activeOwners(tenantId)` = `tenantMember.count({ where: { tenantId, role: 'OWNER', venueId: null, isActive: true } })`; `tenantWideRows(userId, tenantId)` = `tenantMember.count({ where: { userId, tenantId, venueId: null } })`.
  - **`describe('#16 database guarantee')`:**
    - `it('rejects a second tenant-wide row for one user and tenant')`: `addMember(target, t, 'STAFF')`, then a second `addMember(target, t, 'STAFF')` rejects with `{ code: 'P2002' }`; so does an inactive one (`…, null, false`).
    - `it('allows a venue row next to a tenant-wide row')`: tenant-wide STAFF plus STAFF at a venue of `t` → both resolve.
  - **`describe('#16 create races')`**, each with `gate.arm(8)`, 8 identical requests from one signed-in actor via `Promise.all`, and `gate.disarm()` in `finally`. Every non-201 response must be `409` with a message in `[ALREADY_EXISTS, BUSY]`:
    - `it('adds one tenant-wide STAFF row out of 8 concurrent creates')`: `owner` is OWNER of `t`; body `{ email: target.email, role: 'STAFF' }` → exactly one `201`; `tenantWideRows(target, t) === 1`.
    - `it('answers 8 concurrent venue-scoped creates with one 201 and 409s, never 500')`: body adds a `venueId` → exactly one `201`; one venue row.
    - `it('reactivates one inactive row once out of 8 concurrent creates')`: seed `addMember(target, t, 'STAFF', null, false)` → exactly one `201` with `message === REACTIVATE`; one row, active.
    - `it('lets one of 8 concurrent first-owner claims win')`: `createTenant('PENDING', { email: contact.email })`, actor `contact`, body `{ email: contact.email, role: 'OWNER' }` → exactly one `201`; `activeOwners(t) === 1`.
  - **`describe('#15 last owner')`** (sequential):
    - sole `owner` DELETEs own row → `409 LAST_OWNER`, row still active OWNER.
    - sole `owner` PATCHes own row `{ role: 'STAFF' }` → `409 LAST_OWNER`; `{ role: 'STAFF', venueId }` → `409 LAST_OWNER`.
    - with `owner` and `owner2` both OWNER: each of the three self-mutations above (fresh tenant each) → `200`, and `owner2` then `GET findAll` → `200`.
    - `owner` DELETEs `owner2`'s row (two owners) → `200`; `activeOwners === 1`.
  - **`describe('#15 races')`:**
    - `it('never leaves zero owners when two owners remove each other (burst)')`: 10 iterations; each makes a tenant with `owner` and `owner2` as OWNER, `gate.arm(2)`, then `owner` DELETEs `owner2`'s row while `owner2` DELETEs `owner`'s. Collect `{ statuses (sorted), owners: activeOwners(t) }` per iteration, `console.log` them, and assert once at the end that every iteration is `{ statuses: [200, 403|409], owners: 1 }`.
    - `it('blocks a removal on the tenant lock and rejects it once the holder commits')`: tenant with `owner` (A) and `owner2` (B). A holder `fixtures.db.$transaction(…, { maxWait: 5_000, timeout: 30_000 })` reads `pg_backend_pid()`, runs `tx.tenant.updateMany({ where: { id: t }, data: { updatedAt: new Date() } })`, soft-deletes B's row, signals, and awaits a release promise. Then B sends `DELETE` of A's row. Poll every 50 ms for up to 5 s for a `pg_stat_activity` row with `datname = current_database() AND wait_event_type = 'Lock' AND query LIKE 'UPDATE "public"."Tenant"%' AND ${holderPid}::int = ANY(pg_blocking_pids(pid))`. Release, await both, then assert once: `expect({ blocked, status, owners: await activeOwners(t), aActive }).toEqual({ blocked: true, status: 403, owners: 1, aActive: true })`. Copy the holder/try/finally shape from `court-book.http.spec.ts`.
  - **`describe('update scope collisions')`:**
    - `target` has tenant-wide STAFF and a venue STAFF row; PATCH the venue row `{ venueId: null }` → `409 ALREADY_EXISTS`; `tenantWideRows === 1`.
    - same, but the tenant-wide row is inactive → `409 ALREADY_EXISTS`; `tenantWideRows === 1`.
    - `target` has STAFF rows at venues V1 and V2; PATCH the V1 row `{ venueId: V2 }` → `409 ALREADY_EXISTS`.
  - **`describe('platform admin')`:**
    - `admin` (no membership) on a tenant with `owner`: `GET findAll` → `200`; `GET find/:id` → `200`; `POST` adds `target` as STAFF → `201`; `PATCH` it to a venue of the tenant → `200`; `DELETE` it → `200`.
    - ownerless tenant (only `addMember(owner, t, 'OWNER', null, false)`): `admin` adds `target` as OWNER → `201 CREATED`, `activeOwners === 1`. On a second such tenant, `admin` adds `owner` as OWNER → `201 REACTIVATE`.
    - `admin` DELETEs the sole owner → `409 LAST_OWNER`; PATCHes it to STAFF → `409 LAST_OWNER`.
    - `admin` adds `owner2` as OWNER, then DELETEs `owner`'s row → `201`, then `200`; `activeOwners === 1`.
    - `outsider` (no membership, not admin): `findAll`, `find`, `create`, `patch`, `delete` → all `403`.
  - **`describe('review focus')`:**
    - sole `owner` PATCHes own row `{ role: 'OWNER' }` → `200`; `{}` → `200`; still the active owner.
    - `owner` PATCHes `target`'s STAFF row `{ email: target2.email, role: 'STAFF' }` → `200`, and the row's `userId` is still `target.userId`.
    - read `tenant.updatedAt`, sole `owner` DELETEs self → `409 LAST_OWNER`, `tenant.updatedAt` unchanged.
    - a member of tenant `t2`, addressed with `t`'s header by `t`'s owner: PATCH and DELETE → `404`; the `t2` row is unchanged.
    - tenant with `email: contact.email` whose only row is `addMember(owner, t, 'OWNER', null, false)`: `contact` claims → `403`.
- [ ] **Step 4: Run the suite against the old code** and keep the full output: `npm run test -w api -- tenant-member.http`. Expected: FAIL. Required RED evidence:
  - `#16 database guarantee`: the duplicate inserts resolve.
  - `#16 create races`: more than one `201` for tenant-wide and for claims; `500`s for the venue control and reactivation. Re-run up to 3 times if a burst happens to serialize.
  - `#15 last owner`: the sole-owner cases return `200`.
  - `#15 races`: at least one burst iteration ends with `owners: 0`, and the deterministic test shows `{ blocked: false, status: 200, owners: 0, aActive: false }`. If the burst won't go red, raise it to 100 iterations; if it still won't, keep it as a stress test, say so in the report and commit body, and rely on the deterministic test as the #15 race proof.
  - `update scope collisions`: `200` (silent duplicate) for the two tenant-wide cases, `500` for the venue case.
  - `platform admin`: `403`s for the admin.
  - `review focus`: only the `updatedAt` case fails (`200`). The other four pass on the old code; note them as regression pins.
- [ ] **Step 5: Gate.** `npm run test -w api -- --runInBand --testPathIgnorePatterns tenant-member.http`. Expected: 0 failures, 0 skipped.
- [ ] **Step 6: Commit** the suite, gate, fixtures, court-book switch and messages: `test(api): add red membership safety HTTP suite (#15, #16)`. The body lists the failing tests and the key RED observations above (burst iteration counts, the deterministic observation).

### Task 2: Tenant-wide unique index

**Files:**
- Modify: `apps/api/prisma/schema.prisma`
- Create: `apps/api/prisma/migrations/<timestamp>_tenant_wide_member_unique/migration.sql` (generated, never edited)

**Interfaces (Produces):** the generator block gains `previewFeatures = ["partialIndexes"]`; `TenantMember` keeps `@@unique([userId, tenantId, venueId])` and gains `@@unique([userId, tenantId], where: { venueId: null }, map: "TenantMember_tenant_wide_key")`. The existing `@@index` lines are unchanged.

- [ ] **Step 1: Confirm RED** for this task's block: `npm run test -w api -- tenant-member.http -t '#16 database guarantee'`. Expected: FAIL (the duplicates insert).
- [ ] **Step 2: Edit the schema** as above, then run:

  ```bash
  cd apps/api && DATABASE_URL="$TEST_DATABASE_URL" npx prisma migrate dev --name tenant_wide_member_unique
  ```

  Expected: one new folder whose SQL is exactly `CREATE UNIQUE INDEX "TenantMember_tenant_wide_key" ON "TenantMember"("userId", "tenantId") WHERE ("venueId" IS NULL);` (plus Prisma's comment line). Anything else: **stop** and report. Then `npm run db:generate` from the root.
- [ ] **Step 3: Run** `npm run test -w api -- tenant-member.http -t '#16 database guarantee'`. Expected: PASS. Then the gate: `npm run test -w api -- --runInBand --testPathIgnorePatterns tenant-member.http`. Expected: 0 failures, 0 skipped.
- [ ] **Step 4: Commit** `schema.prisma` and the migration folder: `feat(api): enforce one tenant-wide membership per user and tenant (#16)`

### Task 3: Pure membership rules

**Files:**
- Create: `apps/api/src/tenant-member/tenant-member.rules.ts`, `apps/api/src/tenant-member/tenant-member.rules.spec.ts`

**Interfaces (Produces):** all exported from `tenant-member.rules.ts`; only `TenantRole` is imported (from `../generated/prisma/enums`).
- `type MembershipState = { role: TenantRole; venueId: string | null; isActive: boolean }`
- `isActiveTenantWideOwner(member: MembershipState): boolean`: `OWNER`, `venueId === null`, active.
- `isValidRoleScope(role: TenantRole, venueId: string | null): boolean`: `false` only for `OWNER` with a venue.
- `wouldRemoveLastOwner(target: MembershipState, next: MembershipState, otherActiveOwnerCount: number): boolean`: `isActiveTenantWideOwner(target) && !isActiveTenantWideOwner(next) && otherActiveOwnerCount === 0`.
- `type FirstOwnerClaim = { actorEmail: string; actorEmailVerified: boolean; requestEmail: string; requestRole: TenantRole; requestVenueId: string | null; tenantEmail: string | null; tenantHasAnyMember: boolean }`
- `isValidFirstOwnerClaim(claim: FirstOwnerClaim): boolean`: role `OWNER`, no venue, verified, request email equals actor email and tenant email (case-insensitive), and `!tenantHasAnyMember`. These are today's `assertCanManage` conditions, unchanged.

- [ ] **Step 1: Write `tenant-member.rules.spec.ts`:**
  - `wouldRemoveLastOwner`, with `owner = { role: OWNER, venueId: null, isActive: true }`:
    - sole owner (count 0) → delete (`isActive: false`) `true`; demote to STAFF `true`; demote to STAFF + venue `true`.
    - count 1 → each of those `false`.
    - next equals target (no-op) with count 0 → `false`.
    - target STAFF → `false`; target an inactive OWNER → `false`.
  - `isActiveTenantWideOwner`: owner → `true`; with a venue, inactive, or STAFF → `false`.
  - `isValidRoleScope`: `(OWNER, 'v')` → `false`; `(OWNER, null)`, `(STAFF, 'v')`, `(STAFF, null)` → `true`.
  - `isValidFirstOwnerClaim`: a valid claim → `true`; emails differing only in case → `true`; each of unverified, `STAFF`, a venue, request email ≠ actor email, tenant email `null`, tenant email ≠ actor email, `tenantHasAnyMember: true` → `false`.
- [ ] **Step 2: Run** `npm run test -w api -- tenant-member.rules`. Expected: FAIL (module not found).
- [ ] **Step 3: Implement** `tenant-member.rules.ts`.
- [ ] **Step 4: Run** `npm run test -w api -- tenant-member.rules`. Expected: PASS.
- [ ] **Step 5: Commit** `feat(api): add pure membership rules (#15, #16)`

### Task 4: Tenant lock for create, claim and reactivation

**Files:**
- Modify: `apps/api/src/tenant-member/tenant-member.repository.ts`, `tenant-member.repository.spec.ts`, `tenant-member.service.ts`, `tenant-member.service.spec.ts`, `tenant-member.module.ts`

**Interfaces:**
- Consumes: `isValidRoleScope`, `isValidFirstOwnerClaim` (Task 3); `INTERACTIVE_TX_OPTIONS`, `isRetryableTransactionError`; `BusyOutcome`; `TENANT_MEMBER_MESSAGES.BUSY` (Task 1).
- **Repository** (`tenant-member.repository.ts`, all Prisma):
  - `interface LockedMembershipStore` (this task's methods; Task 5 adds more), bound to one `tenantId` and one `Prisma.TransactionClient`:
    - `isActiveOwner(userId: string): Promise<boolean>`
    - `hasAnyMember(): Promise<boolean>`: any row, active or not, any role.
    - `findTenantEmail(): Promise<string | null>`
    - `findUserIdByEmail(email: string): Promise<string | null>`: exact match on `User.email`, as today.
    - `venueBelongsToTenant(venueId: string): Promise<boolean>`
    - `findSameScope(userId: string, venueId: string | null, excludeMemberId?: string): Promise<ITenantGeneric | null>`: any row (active or not) with `{ tenantId, userId, venueId }` (explicit `venueId: null` for tenant-wide) and, when given, `id: { not: excludeMemberId }`.
    - `insert(userId: string, role: TenantRole, venueId: string | null): Promise<ITenantGeneric>`
    - `reactivate(memberId: string, role: TenantRole): Promise<ITenantGeneric>`: `update({ where: { id, tenantId, isActive: false }, data: { isActive: true, role } })`.
  - `type TenantLockOutcome<T> = { kind: 'DONE'; value: T } | { kind: 'TENANT_NOT_FOUND' } | { kind: 'ALREADY_EXISTS' } | BusyOutcome`
  - `withTenantLock<T>(tenantId: string, work: (store: LockedMembershipStore) => Promise<T>): Promise<TenantLockOutcome<T>>`. One `$transaction(…, INTERACTIVE_TX_OPTIONS)`:
    1. `tx.tenant.updateMany({ where: { id: tenantId }, data: { updatedAt: new Date() } })`; `count === 0` → `TENANT_NOT_FOUND` without calling `work`.
    2. `{ kind: 'DONE', value: await work(store) }`.

    In `catch`: `PrismaClientKnownRequestError` `P2002` → `ALREADY_EXISTS`; `isRetryableTransactionError` → `BUSY`; anything else (including the service's Nest exceptions) is rethrown, after Prisma has rolled back. JSDoc: every membership write must go through this method, and rejections must be thrown, never returned, so the lock's write rolls back.
  - Delete `getValidMember`, `findInactive`, `reactivate`, `create`, `hasAnyMember` and `venueBelongsToTenant` from the class. Keep `hasActiveOwner`, `findAllActive`, `findActive`, `update`, `delete` (Task 5 removes the last two). Fix stale JSDoc on what remains.
- **Service:** `create(tenantId, actor, dto)` keeps its signature. It calls `withTenantLock` and, inside `work`, in this order (the design's steps 2–5):
  1. `authorizeMutation(store, actor, claim?: CreateTenantMemberDto)` (private): `store.isActiveOwner(actor.id)`, else `isValidFirstOwnerClaim` built from `store.findTenantEmail()` and `store.hasAnyMember()`, else `ForbiddenException(FORBIDDEN)`.
  2. `store.findUserIdByEmail(dto.email)` → `null` → `NotFoundException(NOT_FOUND)`.
  3. `store.findSameScope(userId, venueId ?? null)`: active → `ConflictException(ALREADY_EXISTS)`; inactive → remember it.
  4. `isValidRoleScope` false, or a venue not in the tenant → `BadRequestException(INVALID_DATA)`.
  5. Reactivate the remembered row (`REACTIVATE` message) or insert (`CREATED` message).

  `unwrapLock<T>(outcome: TenantLockOutcome<T>): T` (private) maps `TENANT_NOT_FOUND` → `NotFoundException(TENANT_NOT_FOUND)`, `ALREADY_EXISTS` → `ConflictException(ALREADY_EXISTS)`, `BUSY` → `ConflictException(BUSY)`. Drop the `TenantRepository` dependency from the service and from `TenantMemberModule` providers. `update`, `remove` and the reads are unchanged in this task apart from their authorization: `assertCanManage` shrinks to a private `assertOwner(tenantId, actor)` (`hasActiveOwner`, else `403`) that only they use until Tasks 5 and 6 replace it.

- [ ] **Step 1: Confirm RED:** `npm run test -w api -- tenant-member.http -t '#16 create races'`. Expected: FAIL (from Task 1/2: duplicate `201`s or `500`s).
- [ ] **Step 2: Write the failing unit tests:**
  - `tenant-member.repository.spec.ts` (mocked `db.$transaction(fn, opts)` that calls `fn(tx)` with a fake `tx`):
    - the first `tx` call is `tenant.updateMany({ where: { id: 'tenant-1' }, data: { updatedAt: expect.any(Date) } })`, and `opts` is `INTERACTIVE_TX_OPTIONS`.
    - `count: 0` → `{ kind: 'TENANT_NOT_FOUND' }` and `work` isn't called.
    - `work` throwing a `P2002` known error → `{ kind: 'ALREADY_EXISTS' }`; `P2034` → `{ kind: 'BUSY' }`; a `ForbiddenException` is rethrown as is.
    - `findSameScope('u', null)` queries `{ tenantId, userId: 'u', venueId: null }`; with `excludeMemberId` it adds `id: { not }`.
    - `reactivate` and `insert` scope to the bound `tenantId`.
    - Drop the cases for the deleted methods.
  - `tenant-member.service.spec.ts`: replace the repository mock with `withTenantLock` mocked to run `work` against a fake `LockedMembershipStore` (`jest.fn` per method) and return `{ kind: 'DONE', value }`. Cases:
    - each lock outcome (`TENANT_NOT_FOUND`, `ALREADY_EXISTS`, `BUSY`) maps to its status and message.
    - not an owner and not a valid claim → `403`, no `insert`.
    - a valid claim → `insert(actor.id, OWNER, null)`; an unverified claim → `403`.
    - unknown email → `404`; active same-scope row → `409`; inactive same-scope row → `reactivate(row.id, role)` and `REACTIVATE`.
    - `OWNER` + venue → `400`; a foreign venue → `400`; neither writes.
    - Keep the existing `update`/`remove`/read cases passing against the remaining repository methods.
- [ ] **Step 3: Run** `npm run test -w api -- tenant-member.repository tenant-member.service`. Expected: FAIL.
- [ ] **Step 4: Implement** the repository lock, the store, the service changes and the module change.
- [ ] **Step 5: Run** `npm run test -w api -- tenant-member.repository tenant-member.service tenant-member.controller tenant-member.rules` and `npm run test -w api -- tenant-member.http -t '#16'`. Expected: PASS, including every `#16 create races` case. Then the gate: `npm run test -w api -- --runInBand --testPathIgnorePatterns tenant-member.http`. Expected: 0 failures, 0 skipped.
- [ ] **Step 6: Commit** `fix(api): serialize membership creation on a tenant lock (#16)`

### Task 5: Last-owner rule and locked update/remove

**Files:**
- Modify: `apps/api/src/tenant-member/tenant-member.repository.ts`, `tenant-member.repository.spec.ts`, `tenant-member.service.ts`, `tenant-member.service.spec.ts`, `dto/update-tenant-member.dto.ts`

**Interfaces:**
- Consumes: `withTenantLock`, `LockedMembershipStore`, `authorizeMutation`, `unwrapLock` (Task 4); `wouldRemoveLastOwner`, `isValidRoleScope`, `MembershipState` (Task 3); `TENANT_MEMBER_MESSAGES.LAST_OWNER`.
- **`LockedMembershipStore` adds:**
  - `findActive(memberId: string): Promise<ITenantGeneric | null>`: `{ id, tenantId, isActive: true }`.
  - `countActiveOwnersExcept(memberId: string): Promise<number>`: `{ tenantId, role: OWNER, venueId: null, isActive: true, id: { not: memberId } }`.
  - `update(memberId: string, data: { role: TenantRole; venueId: string | null }): Promise<ITenantGeneric>`: `where: { id, tenantId, isActive: true }`.
  - `softDelete(memberId: string): Promise<ITenantGeneric>`: same `where`, `data: { isActive: false }`.
- The repository class drops its unlocked `update` and `delete`.
- **DTO:** `UpdateTenantMemberDto extends PartialType(OmitType(CreateTenantMemberDto, ['email'] as const))`.
- **Service**, each inside `withTenantLock`, after `authorizeMutation(store, actor)` (no claim):
  - `update`:
    1. `store.findActive(memberId)` → `404 NOT_FOUND`.
    2. `next = { role: dto.role ?? target.role, venueId: dto.venueId === undefined ? target.venueId : dto.venueId, isActive: true }`.
    3. `isValidRoleScope` / venue check → `400 INVALID_DATA`.
    4. `wouldRemoveLastOwner(target, next, await store.countActiveOwnersExcept(target.id))` → `ConflictException(LAST_OWNER)`.
    5. If `next.venueId !== target.venueId` and `store.findSameScope(target.userId, next.venueId, target.id)` finds a row (active or not) → `409 ALREADY_EXISTS`.
    6. `store.update(target.id, { role: next.role, venueId: next.venueId })`.
  - `remove`: `findActive` → `404`; `wouldRemoveLastOwner(target, { ...target, isActive: false }, count)` → `409 LAST_OWNER`; `softDelete`.

- [ ] **Step 1: Confirm RED:** `npm run test -w api -- tenant-member.http -t '#15|update scope collisions|review focus'`. Expected: FAIL (the sole-owner `200`s, zero-owner races, collision `200`/`500`s, the `updatedAt` case).
- [ ] **Step 2: Write the failing unit tests:**
  - repository spec: `countActiveOwnersExcept`, `update` and `softDelete` `where` shapes, all scoped to the bound tenant.
  - service spec:
    - `update`/`remove` of a missing member → `404`, no write.
    - sole owner remove or demote (count 0) → `409 LAST_OWNER`, no write; count 1 → written.
    - `OWNER` + venue → `400` before the count is read.
    - a scope collision → `409 ALREADY_EXISTS` and no `update`.
    - an actor who is no longer an owner → `403`.
  - a DTO test (in `tenant-member.service.spec.ts` or a new `dto/tenant-member-dtos.spec.ts`): `plainToInstance(UpdateTenantMemberDto, { email: 'x@y.z', role: 'STAFF' })` validated with `whitelist: true` leaves no `email` property.
- [ ] **Step 3: Run** `npm run test -w api -- tenant-member.repository tenant-member.service tenant-member-dtos`. Expected: FAIL.
- [ ] **Step 4: Implement** the store methods, DTO and service changes.
- [ ] **Step 5: Run** `npm run test -w api -- tenant-member.http -t '#15|#16|update scope collisions|review focus'`. Expected: PASS: the burst shows every iteration with `owners: 1`, and the deterministic test `{ blocked: true, status: 403, owners: 1, aActive: true }`. Then `npm run test -w api -- tenant-member` with only the `platform admin` block failing, and the gate: `npm run test -w api -- --runInBand --testPathIgnorePatterns tenant-member.http`. Expected: 0 failures, 0 skipped.
- [ ] **Step 6: Commit** `fix(api): keep at least one active owner under the tenant lock (#15)`

### Task 6: Platform-admin membership management

**Files:**
- Modify: `apps/api/src/tenant-member/tenant-member.service.ts`, `tenant-member.service.spec.ts`, `tenant-member.module.ts`, `docs/superpowers/specs/2026-11-07-authorization-users-cleanup-design.md` (line 64)

**Interfaces:**
- Consumes: `AuthorizationRepository.isPlatformAdmin(userId: string): Promise<boolean>` (exported by `AuthorizationModule`); Tasks 4–5.
- `TenantMemberModule` imports `AuthorizationModule`; the service injects `AuthorizationRepository`.
- `authorizeMutation(store, actor, isPlatformAdmin: boolean, claim?)`: owner on `tx`, else `isPlatformAdmin`, else a valid claim, else `403`. Each mutation reads `isPlatformAdmin` once, before `withTenantLock` (the design's step-2 exception).
- `assertCanRead(tenantId: string, actor: TenantMemberActor): Promise<void>` (private), used by `findAll` and `findOne`: `hasActiveOwner(tenantId, actor.id)` or `isPlatformAdmin`, else `403`. Reads stay unlocked.
- No override: an admin is still bound by `LAST_OWNER`, role/scope validation and uniqueness.

- [ ] **Step 1: Confirm RED:** `npm run test -w api -- tenant-member.http -t 'platform admin'`. Expected: FAIL (`403`s).
- [ ] **Step 2: Write the failing service tests:**
  - an admin with no membership passes `findAll`, `findOne`, `create`, `update` and `remove`.
  - an admin removing the sole owner → `409 LAST_OWNER`.
  - a non-admin, non-owner → `403` for all five.
  - `isPlatformAdmin` is called with `actor.id`.
  - the existing claim cases still pass.

  Run `npm run test -w api -- tenant-member.service`. Expected: FAIL.
- [ ] **Step 3: Implement** the module import, injection, `assertCanRead` and the admin branch.
- [ ] **Step 4: Edit the authorization design doc:** append to the line-64 sentence ending "…which is unchanged.": ` Superseded by 2026-11-07-membership-safety-design.md: platform admins may manage any tenant's members.`
- [ ] **Step 5: Run** `npm run test -w api -- tenant-member authorization`. Expected: PASS, 0 skipped. Then the full suite: `npm run test -w api -- --runInBand`. Expected: 0 failures, 0 skipped.
- [ ] **Step 6: Commit** `feat(api): let platform admins manage tenant members (#15)`

### Task 7: Final verification and hosted deploy

- [ ] **Step 1: Replay migrations** onto an empty test DB: `cd apps/api && DATABASE_URL="$TEST_DATABASE_URL" npx prisma migrate reset --force`. Expected: every migration applies, including `tenant_wide_member_unique`. Then `npm run db:generate` from the root.
- [ ] **Step 2: Run the full API suite twice**, with the preamble: `npm run test -w api -- --runInBand`, then `npm run test -w api`. Expected for both: **0 failed and 0 skipped** suites and tests.
- [ ] **Step 3: Run** `npm run typecheck && npm run build -w api && npm run build -w web`. Expected: all exit 0. Then `git checkout apps/web/next-env.d.ts` if it changed.
- [ ] **Step 4: Run** `npm run lint -w web`. Expected: no errors, and no more warnings than the Task 1 baseline.
- [ ] **Step 5: Lint touched API files only** (no `--fix`): `cd apps/api && npx eslint $(git diff --name-only --diff-filter=d <task-1-start-sha>..HEAD -- src | grep '\.ts$' | sed 's#^apps/api/##')`. Expected: for files that existed before, no more errors than the Task 1 baseline; for new files, 0 errors.
- [ ] **Step 6: Run the greps:**
  - `git grep -n "userId_tenantId" -- apps/api/src ':!apps/api/src/generated'` → no matches.
  - `git grep -n "getValidMember\|findInactive\|TenantRepository" -- apps/api/src/tenant-member` → no matches.
  - `git grep -n "\$queryRaw\|\$executeRaw" -- apps/api/src ':!*.spec.ts' ':!apps/api/src/generated'` → no new matches since the start SHA.
- [ ] **Step 7: Hosted dev DB**, from `apps/api`, with no `DATABASE_URL` override, in exactly this order:
  1. **Read-only duplicate pre-check** (the design's command, verbatim):

     ```bash
     cd apps/api && npx ts-node --transpile-only -O '{"module":"commonjs"}' -e '
     import "dotenv/config";
     import { PrismaPg } from "@prisma/adapter-pg";
     import { PrismaClient } from "./src/generated/prisma/client";
     async function main(): Promise<void> {
       const url = new URL(process.env.DATABASE_URL as string);
       console.log("target host:", url.host, "db:", url.pathname);
       const db = new PrismaClient({ adapter: new PrismaPg(process.env.DATABASE_URL as string) });
       try {
         const pairs = await db.tenantMember.groupBy({ by: ["userId", "tenantId"], where: { venueId: null }, _count: { _all: true }, having: { id: { _count: { gt: 1 } } } });
         console.log("duplicate tenant-wide pairs:", pairs.length);
         for (const p of pairs) {
           const rows = await db.tenantMember.findMany({ where: { userId: p.userId, tenantId: p.tenantId, venueId: null }, select: { id: true, userId: true, tenantId: true, role: true, isActive: true, createdAt: true, updatedAt: true }, orderBy: { createdAt: "asc" } });
           console.table(rows);
         }
       } finally { await db.$disconnect(); }
     }
     main().catch((e) => { console.error(e); process.exit(1); });
     '
     ```

     Confirm the printed host is the hosted DB, not `localhost`. If it reports **any** pair, **stop**: don't deploy, and report the printed rows verbatim. The user decides what to delete.
  2. `npx prisma migrate status`. If it reports anything other than exactly `…_tenant_wide_member_unique` pending (drift, a failed migration, other pending ones), **stop** and report the output.
  3. `npx prisma migrate deploy`. If it fails, don't edit the migration, don't `resolve` and don't reset; report the exact error.
  4. Nothing else touches the hosted DB.
- [ ] **Step 8: Report:**
  - the commit list
  - the test counts for both full runs
  - the Task 1 RED evidence (burst iteration counts and the deterministic observation)
  - the migration folder name
  - the lint numbers against the baselines
  - the hosted pre-check output, `migrate status` and `deploy` output
  - the follow-ups from the design that remain open (UI, invitations, account deletion vs last owner, the venue FK, audit log)
