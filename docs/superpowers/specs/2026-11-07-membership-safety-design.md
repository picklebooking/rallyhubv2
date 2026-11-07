# Membership safety: last-owner protection and tenant-wide membership uniqueness

Date: 2026-11-07
Branch: `fix/system-audit-remediation` (PR #34)
Source: `docs/SYSTEM-AUDIT-2026-11-07.md`, findings **#15** and **#16**, plus the "Staff administration" row of "Missing product workflows" ("Group B: membership safety")
Status: APPROVED design. Every open question was answered by the product owner (recorded below). Next step: the implementation plan.

Labels: **(product owner)** means the user decided it. *(Claude's call)* means the designer chose it; the user can overturn it while reviewing. Anything unlabelled follows directly from one of those, or from existing code.

## Why

Membership administration is the only way a tenant gets or keeps people who can run it. Two gaps make it fragile.

- **#15 (Medium): the last owner can remove or demote themselves.** `TenantMemberService.update` (`apps/api/src/tenant-member/tenant-member.service.ts:130`) and `remove` (`:162`) only check that the actor is an active owner (`assertCanManage`, `:187`). Nothing requires another active tenant-wide owner to remain. The sole owner can set their role to `STAFF` or soft-delete their own row, after which nobody passes the owner check. The first-owner claim can't rescue the tenant either: `hasAnyMember` (`tenant-member.repository.ts:89`) counts inactive and staff rows, so it returns `true` for good. Platform admins can't help today because membership administration doesn't consult `isPlatformAdmin`.
- **#16 (Medium): duplicate tenant-wide memberships are possible.** `create` checks for an existing active row (`tenant-member.service.ts:43-56`) and an inactive one (`:58`) in separate, unlocked reads before inserting (`tenant-member.repository.ts:24`). The only database guard is `@@unique([userId, tenantId, venueId])` (`apps/api/prisma/schema.prisma:230`). Postgres treats `NULL` as distinct, so it never fires for tenant-wide rows (`venueId = null`, which every OWNER has). Two concurrent creates, or two concurrent first-owner claims, can both insert. Reactivation has the same shape: two requests can both find the same inactive row, and the loser's `update ... where isActive: false` throws Prisma `P2025`, which surfaces as a 500.

Success means:
- a tenant that has an active tenant-wide owner can never lose its last one through the membership API, even under concurrency
- the database itself rejects a second tenant-wide membership for the same user and tenant
- every membership race resolves to a clean 4xx, never a 500 or a duplicate row
- a platform admin can repair any tenant's membership, including an ownerless one
- all of this is proven with real-Postgres tests that were red against the current code.

## Goals

1. Enforce "at least one active tenant-wide OWNER remains" on every membership mutation, serialized per tenant (#15).
2. Add a database-enforced unique key for tenant-wide memberships, created through `prisma migrate dev`, and make create, reactivate and update race-safe (#16).
3. Let platform admins manage any tenant's members, which is also the recovery path for an ownerless tenant **(product owner)**.

## Non-goals

- **Any web UI** for membership management **(product owner)**. API only; see Follow-ups.
- Invitations and acceptance (email invites, pending memberships).
- A dedicated ownership-transfer endpoint **(product owner)**. Transfer is two ordinary calls: add the new owner, then remove or demote yourself.
- Changing who can edit tenants, venues or courts. The authorization matrix in `2026-11-07-authorization-users-cleanup-design.md` stays as is, except for the membership-administration line superseded below.
- Cleaning up memberships that point at deleted venues. Recorded as a follow-up.
- Account deletion. There is no delete-user path today (nothing in `apps/api/src` calls Better Auth `deleteUser`). Recorded as a follow-up.
- Any cleanup of existing duplicate rows. If the hosted pre-check finds any, the user decides what to delete **(product owner)**.

## Anti-goals (a failure even if tests pass)

- Any membership mutation that decides "is the actor an owner", "does this row already exist" or "is this the last owner" outside the transaction that writes the row. (The `isPlatformAdmin` flag is the one exception; see "Concurrency", step 2.)
- Raw SQL in application code, or a hand-written or hand-edited migration **(product owner)**.
- A concurrency test that passes against the current, broken code. Each must be shown red first.
- Using the generated `userId_tenantId` compound selector (`findUnique`, `upsert` or `update({ where: { userId_tenantId } })`). Prisma generates it from the partial index but ignores the `WHERE "venueId" IS NULL` predicate, so it can address a venue-scoped row. Always filter with `venueId: null` explicitly.
- Running `migrate deploy` on the hosted dev DB without first running the duplicate pre-check, or after it found duplicates.
- Any path, including platform admin, that leaves a tenant with zero active owners when it had at least one.

## Constraints

- `AGENTS.md`: thin controllers → services (business rules) → repositories (all Prisma). DTOs, explicit return types, no `any`. Shared HTTP types in `packages/shared`, imported type-only. No shared contract change is expected.
- **Schema changes only through `prisma migrate dev` against the local test DB** **(product owner)**: `cd apps/api && DATABASE_URL="$TEST_DATABASE_URL" npx prisma migrate dev --name tenant_wide_member_unique`. Never hand-write or edit migration SQL. The local test DB is reset as needed, so it needs no duplicate handling.
- **Hosted dev DB: the read-only duplicate pre-check, then `migrate status`, then `migrate deploy`, and nothing else** **(product owner)**. See "Hosted dev DB rollout".
- No `npm install`, no new dependencies.
- TDD **(product owner)**. Real-Postgres tests use the harness in `apps/api/src/test-support/` (`createHttpTestApp`, `HttpFixtures`, `teardownHttpSuite`, `getTestDatabaseUrl`) against local `rallyhub_test` (`TEST_DATABASE_URL`), skipped without it, like the existing suites.
- Reuse `INTERACTIVE_TX_OPTIONS` and `isRetryableTransactionError` from `apps/api/src/prisma/interactive-transaction.ts`. Don't copy them.
- No `Co-Authored-By`, `Claude-Session` or 🤖 lines in commits or PR text.

---

## Definitions

- **Active tenant-wide owner:** a `TenantMember` row with `role = OWNER`, `venueId = null`, `isActive = true`. This is exactly what `hasActiveOwner` (`tenant-member.repository.ts:72`) and `AuthorizationRepository.hasTenantOwnerMembership` already test. `assertRoleVenue` already forbids an OWNER with a venue, so every OWNER is tenant-wide. Tenant `status` doesn't matter.
- **Scope** of a membership: `venueId` (`null` = tenant-wide, set = that venue).
- **Platform admin:** a user with `User.isPlatformAdmin = true`, read from the database through `AuthorizationRepository.isPlatformAdmin` / `AuthorizationService` (`apps/api/src/authorization/`). Never read from the session.

## Data model (#16)

### Prisma capability (verified against the installed Prisma 7.10.1)

- **`NULLS NOT DISTINCT` is not expressible.** `@@unique([userId, tenantId, venueId], nullsNotDistinct: true)` fails `prisma validate` with `P1012 No such argument`.
- **A partial unique index is expressible, behind the `partialIndexes` preview feature.** In a scratch copy of the schema:
  - without the preview flag, `where:` fails with "Partial indexes are a preview feature. Add "partialIndexes" to previewFeatures…"
  - with it, `@@unique([userId, tenantId], where: { venueId: null }, map: "TenantMember_tenant_wide_key")` passes `prisma validate`
  - `prisma migrate diff` (offline) generates exactly `CREATE UNIQUE INDEX "TenantMember_tenant_wide_key" ON "TenantMember"("userId", "tenantId") WHERE ("venueId" IS NULL);`
  - `prisma generate` succeeds and adds a `userId_tenantId` compound unique input (hence the anti-goal above)
  - enum literals aren't accepted in the `where` object (`role: OWNER` fails), so a partial index can't express "one owner" rules. It doesn't need to.

### Change

```prisma
generator client {
  provider        = "prisma-client"
  output          = "../src/generated/prisma"
  moduleFormat    = "cjs"
  previewFeatures = ["partialIndexes"]
}

model TenantMember {
  // ...unchanged fields...
  @@unique([userId, tenantId, venueId])                    // keeps venue-scoped rows unique (non-null venueId)
  @@unique([userId, tenantId], where: { venueId: null }, map: "TenantMember_tenant_wide_key")
  // ...existing @@index lines unchanged...
}
```

The migration is purely additive (one index, no backfill). The index covers inactive rows too, on purpose: soft-deleted memberships are kept and reactivated in place (existing behaviour), so there's never a reason for two tenant-wide rows for one user and tenant.

*(Claude's call)* Partial index over the alternatives:

| Option | Verdict |
| --- | --- |
| Partial unique index (`partialIndexes` preview) | **Chosen.** Real DB guarantee, Prisma-native, additive migration. Cost: depends on a preview feature; if a future Prisma drops or renames it, the schema must be revisited. |
| Non-null sentinel scope column (`scopeKey = venueId ?? 'TENANT'`) | Rejected. Duplicates `venueId`, needs a backfill that `migrate dev` can't express without hand-edited SQL, and every write must keep the two in sync. |
| Serialize membership writes on a tenant row lock only | Not enough alone: no DB backstop for future write paths (seed, scripts, invitation acceptance). **Used together** with the index, because the lock is still needed for #15's cross-row invariant. |

### Semantics

- **A user may hold both a tenant-wide membership and venue-scoped memberships in the same tenant, as today** **(product owner)**. Uniqueness is per exact scope: at most one tenant-wide row per (user, tenant), at most one row per (user, tenant, venue). The venue row is redundant but harmless (authorization takes the union).
- Multiple venue-scoped rows for different venues (staff at two venues) stay allowed.
- **Reactivation** keeps today's rule: if the user has an inactive row with the same scope, `create` reactivates that row with the requested role (`REACTIVATE` message) instead of inserting. It now happens under the tenant lock with a recheck, so two concurrent reactivations give one success and one `409 ALREADY_EXISTS`, not a 500.

## #15: last-owner protection

### The rule

A mutation is rejected with **`409 LAST_OWNER`** (new `TENANT_MEMBER_MESSAGES.LAST_OWNER`, e.g. "A tenant must keep at least one active owner. Add another owner first.") when **all** of these hold:
- the target row is currently an active tenant-wide owner
- after the mutation it would no longer be one
- no other active tenant-wide owner exists in the tenant.

Mutations covered:
- `DELETE` (soft-delete, `isActive → false`)
- `PATCH` with `role: STAFF` (with or without a `venueId`)
- `PATCH` that keeps `OWNER` but sets a `venueId`. This is already `400` via `assertRoleVenue`, and that check stays first.

It applies whether the actor removes themselves or another owner. Self-demotion or self-removal is fine when another active owner remains.

**Platform admins cannot bypass it** **(product owner)**. An admin who wants to replace a sole owner adds the new owner first, then removes or demotes the old one. There is no override flag.

Implement it as one pure function (e.g. `wouldRemoveLastOwner(target, next, otherActiveOwnerCount)`) in a small rules file, called under the lock. This follows the booking design's rules-file precedent.

### Platform admins

**Platform admins can manage any tenant's members: list, find, create, update and remove** **(product owner)**. This **supersedes** the line in `2026-11-07-authorization-users-cleanup-design.md` that says "`TenantMemberService.assertCanManage` keeps its own OWNER-only rule for membership administration, which is unchanged". It also matches that design's general rule that platform admins pass every management check.

- `assertCanManage` becomes: active tenant-wide owner **or** platform admin **or** a valid first-owner claim (create only).
- The admin check goes through `AuthorizationService` / `AuthorizationRepository.isPlatformAdmin`, not a new query. `TenantMemberModule` imports `AuthorizationModule`, which already exports both.
- Admins don't need a membership in the tenant. Tenant context still comes from `@CurrentTenant()` (`X-Tenant-Id` header or venue subdomain), which already rejects unknown tenants upstream.
- Admins are the **recovery path for an ownerless tenant**: an ordinary `POST /v1/tenant-member/create` adding a tenant-wide OWNER. If that user has an inactive tenant-wide row, the existing reactivation applies.
- Admin actions are bound by every other rule: the last-owner rule, role/venue validation, and uniqueness.

### Ownership transfer

No dedicated endpoint **(product owner)**. Add the new owner, then remove or demote yourself. The last-owner rule makes the order safe: the second call can only succeed after the first.

### First-owner claim

The claim (`assertCanManage`, `tenant-member.service.ts:196-215`: a verified user whose email matches `Tenant.email` adds themselves as tenant-wide OWNER) keeps its conditions. **"Unclaimed" stays "the tenant has no membership rows at all"** (`hasAnyMember`, counting inactive and staff rows) **(product owner)**. The only change is concurrency: the claim conditions are evaluated inside the locked transaction. Two concurrent claims (double-click) give one `201` and one `409 ALREADY_EXISTS`: the second request sees the first's committed owner row, passes as an owner, then hits the duplicate check. The partial index backstops it.

## Concurrency

Every membership **mutation** (`create`, including the claim and reactivation; `update`; `remove`) runs as one interactive `$transaction` with `INTERACTIVE_TX_OPTIONS`:

1. **Lock the tenant row:** `tx.tenant.updateMany({ where: { id: tenantId }, data: { updatedAt: new Date() } })` as the first statement. `count = 0` → `TENANT_NOT_FOUND` (404).
   - This is the booking design's idiom: a scalar-only `updateMany` takes a row lock held until commit. All membership writes for one tenant queue here.
   - Why the tenant row: the last-owner invariant spans rows, and no index can express "at least one". The tenant row is the one row every membership of a tenant shares, with no new table.
   - Bumping `Tenant.updatedAt` on membership changes is an accepted side effect *(Claude's call)*.
   - It doesn't conflict with FK checks from venue or member inserts (those take `FOR KEY SHARE`; a non-key `UPDATE` takes `FOR NO KEY UPDATE`).
   - Booking transactions lock courts and only read tenant status, so there's no lock-order cycle.
2. **Authorize under the lock:** the actor is an active tenant-wide owner (read on `tx`), or a platform admin, or the claim conditions hold (read on `tx`). Re-reading owner status under the lock is what serializes "two owners remove each other": A and B are the only owners; A's request locks first and removes B; B's request waits, re-checks, finds B is no longer an owner, and gets `403`. Without the recheck, B would remove A and leave zero owners.
   - *(Claude's call)* `isPlatformAdmin` may be read through `AuthorizationService` outside `tx` (before or after taking the lock). No membership mutation changes that flag, so reading it unlocked can't break any invariant here, and it reuses the existing service instead of adding a tx-aware variant.
3. **Load the target under the lock** (update/remove: active row by `id` + `tenantId`; create: the user by email, then any row with the same scope). Missing → `404`. An active same-scope row exists → `409 ALREADY_EXISTS`.
4. **Validate** role/venue (`assertRoleVenue`, venue belongs to tenant), then the **last-owner rule** (update/remove), counting other active owners on `tx`.
5. **Write:** insert, reactivate, update or soft-delete.

Error mapping. The repository returns an outcome union, as `joinSeat` and the booking create do, and the service maps it to HTTP:

| Outcome | HTTP | Message |
| --- | --- | --- |
| Tenant missing (lock `count = 0`) | 404 | existing `TENANT_NOT_FOUND` |
| Actor not owner, not admin and not a valid claim | 403 | existing `FORBIDDEN` |
| Target member, or user by email, missing | 404 | existing `NOT_FOUND` |
| Invalid role/venue combination or foreign venue | 400 | existing `INVALID_DATA` |
| Same-scope active row exists, or Prisma `P2002` on either unique key (create, reactivate, or an update that moves a row into an occupied scope) | 409 | existing `ALREADY_EXISTS` |
| Would remove the last active owner | 409 | new `LAST_OWNER` |
| `isRetryableTransactionError` (`P2028` / `P2034` / `40P01`) | 409 | new `BUSY` (mirrors booking) |

**Update into an occupied scope** *(Claude's call)*: `update` does its own locked same-scope lookup (any row, active or inactive, other than the target) and returns `409 ALREADY_EXISTS` before writing; `P2002` is the backstop. This includes a scope held only by the same user's *inactive* row (for example promoting a venue STAFF row to tenant-wide when an old soft-deleted tenant-wide row exists). No merge or auto-reactivation in `update`. The caller's way through is the existing one: `create` with that scope reactivates the inactive row, then `DELETE` the venue row if it's no longer wanted.

`P2002` mapping on update is needed regardless of the lock: a `PATCH` that moves a venue-scoped row onto a venue the user already has, or a STAFF row to tenant-wide when one exists, 500s today on the existing key, or will on the new one.

**Check order: 404 before 403 for mutations** **(product owner)**. Today a non-owner gets `403` before any `404` for a missing tenant. Under the lock, a missing tenant gives `404` first. The tenant id comes from the caller's own header or subdomain, so this leaks nothing new.

Reads (`findAll`, `findOne`) stay unlocked: owner or platform admin, then the existing queries.

## Testing approach (TDD) **(product owner)**

Write each test red first against current code, then make it pass. Record each red run (command and failing output) in the commit message or PR notes.

**Unit (pure):**
- `wouldRemoveLastOwner`: sole owner delete, demote and demote-with-venue → true. Two owners → false. Target is STAFF → false. Target is an inactive owner → false.

**Unit (mocked repositories)**, updating `tenant-member.service.spec.ts`:
- Each repository outcome maps to the table above.
- A platform admin passes `assertCanManage` for every operation; a non-admin non-owner still gets 403.
- The existing claim cases still pass.

**Real Postgres**, new `apps/api/src/tenant-member/tenant-member.http.spec.ts`, using `createHttpTestApp`, real Better Auth sessions via `signUpAndSignIn`, and `HttpFixtures` (`createTenant`, `createVenue`, `addMember`, `makePlatformAdmin`); tenant via the `X-Tenant-Id` header; versioned paths from `MainRoute`:

- **#15, sequential:**
  - sole owner `DELETE`s self → 409 `LAST_OWNER`, row unchanged
  - sole owner `PATCH`es self to STAFF → 409
  - sole owner `PATCH`es self to STAFF + venue → 409
  - with two owners, each of those → 200 and the other owner still works
  - an owner removing a different, non-last owner → 200
- **#15, race (burst):** two owners concurrently `DELETE` each other. Expect exactly one 200, one 403 or 409, and exactly one active owner left. Run it in a loop (e.g. 10 iterations) so the red run is reliable; against the current code at least one iteration must end with zero active owners.
- **#15, race (deterministic):** a test transaction takes the tenant lock (`tx.tenant.updateMany`) and soft-deletes owner B without committing. Start owner B's `DELETE` of owner A and confirm it's blocked by polling `pg_stat_activity` with `pg_blocking_pids(holderPid)` for a waiting `UPDATE "public"."Tenant"` (same shape as `court-book.http.spec.ts:109-190`; raw SQL is allowed in tests only). Commit, then expect 403 and A still active. Against current code this is a reliable red: B's request is never blocked, removes A, and after the holder commits the tenant has zero active owners. *(Claude's call)* If the burst test above still won't go red after raising the loop to 100 iterations, keep it as a stress test, record that it could not be made red, and rely on this deterministic test as the #15 race proof.
- **#16, races:** N (e.g. 8, below the pg pool size of 10) concurrent `POST create` requests:
  - adding the same user as tenant-wide STAFF → exactly one 201, the rest 409, exactly one row
  - adding the same user as venue-scoped STAFF (already guarded by the old key) → a control that must be 409, not 500
  - reactivating one inactive row → exactly one 201 `REACTIVATE`, the rest 409
  - first-owner claims by the tenant contact → one 201, the rest 409, one owner row.
- **#16, DB guarantee:** `fixtures.addMember` of a second tenant-wide row for the same user and tenant (active or inactive) throws `P2002`. A venue row next to a tenant-wide row succeeds.
- **Update collisions:** a `PATCH` moving a STAFF row to tenant-wide when one exists → 409 (today 500 or a silent duplicate). Same when the occupying tenant-wide row is inactive.
- **Platform admin:**
  - an admin with no membership lists, finds, adds, updates and removes members of a tenant → OK
  - an admin restores an ownerless tenant (seeded with only an inactive owner row) by adding a new owner → 201, and by reactivating the old owner → 201 `REACTIVATE`
  - an admin removing or demoting the sole owner → 409 `LAST_OWNER`
  - an admin adds a second owner, then removes the first → both succeed
  - a non-admin, non-owner → 403.
- **Gates:**
  - `npm run test -w api` with `TEST_DATABASE_URL` set (full suite green)
  - `npm run typecheck`
  - `npm run build -w api`
  - `npm run typecheck -w web` only if a shared contract changes (none is expected).

## Hosted dev DB rollout

`CREATE UNIQUE INDEX` fails if any (`userId`, `tenantId`) pair already has two or more `venueId IS NULL` rows, active or not. Prisma would mark the migration failed, which needs `migrate resolve` to recover. So **(product owner)**:

1. **Read-only duplicate pre-check.** Run from `apps/api` with no `DATABASE_URL` override, so `dotenv` loads the same `apps/api/.env` `DATABASE_URL` that `prisma migrate deploy` uses through `prisma.config.ts`. It writes no file and no row: Prisma Client `groupBy` and `findMany` only, no raw SQL. It prints the target host first so the operator can confirm it's the hosted DB. Verified working against local `rallyhub_test` (0 pairs).

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

2. **If it reports any pair, STOP.** Do not run `migrate deploy`. Report the printed rows to the user verbatim. The user decides which rows to delete and does it themselves. There is no automatic cleanup script **(product owner)**. Resume from step 1 only when the user says so.
3. If it reports `0`, run `npx prisma migrate status`, then `npx prisma migrate deploy`, from `apps/api`, at the very end, as in the booking design.

**Who runs it:** the executor of this design runs steps 1-3 itself, at the very end, after all gates are green **(product owner)**. The user asked for exactly this sequence, so this design counts as the request that `CLAUDE.md`'s "don't run migrations unless asked" rule requires, for these three commands only. Nothing else may touch the hosted DB. If `migrate status` shows anything other than this one pending migration (drift, a failed migration, other pending ones), stop and report instead of deploying *(Claude's call)*.

The local test DB needs no pre-check: it is reset as needed **(product owner)**.

## Suggested commit order

Separate, reviewable commits on `fix/system-audit-remediation`:

1. Red tests: the HTTP suite for #15 and #16 (record the red runs).
2. Schema: `partialIndexes` preview + `TenantMember_tenant_wide_key`, via `prisma migrate dev` on the test DB; regenerate the client.
3. Tenant-locked interactive transaction for create, reactivate and claim, with the outcome union, `P2002`/`BUSY` mapping and the `ALREADY_EXISTS` recheck (#16).
4. Last-owner rule and locked update/remove (#15).
5. Platform-admin management, plus a one-line note in `2026-11-07-authorization-users-cleanup-design.md` pointing to this design's supersession.
6. At the very end, for the hosted dev DB: the duplicate pre-check, then `npx prisma migrate status` and `npx prisma migrate deploy` (stop if duplicates).

## What's left to the builder

- Exact repository shape: one locked method per mutation returning an outcome union (booking precedent), or a `withTenantLock(tenantId, fn)` helper that passes `tx` through. Either is fine if every check in "Concurrency" steps 2–5 that reads membership rows runs on `tx`.
- Where `wouldRemoveLastOwner` lives (a small `tenant-member.rules.ts` is fine) and its exact signature.
- Exact message wording for `LAST_OWNER` and `BUSY`.
- `UpdateTenantMemberDto` inherits `email` from `PartialType(CreateTenantMemberDto)` and silently ignores it. Use `OmitType(..., ['email'])` or leave it; just never let `email` change the target user.
- JSDoc updates on the repository methods (several are stale, e.g. `getValidMember`).
- Whether to retry `BUSY` internally. The default is no retry, mirroring booking.

## Follow-ups / not built yet

- **Membership-management UI** (list, add, change role or scope, remove, the `LAST_OWNER` error state), in light and dark mode with `@workspace/ui` primitives.
- **Invitations and acceptance** (pending memberships for people without an account; today `create` 404s if the email has no user). Any acceptance path must go through the same tenant lock and respect the partial index.
- **Account deletion vs the last owner.** If a delete-account path is ever added, the `User → TenantMember` `onDelete: Cascade` would bypass the last-owner rule. It must block, or require adding another owner first.
- **Missing `TenantMember.venueId` foreign key.** Venues are hard-deleted (`venues.repository.ts:121`), and `venueId` has no relation to `Venue`, so deleting a venue leaves orphan venue-scoped memberships that still appear in member lists. Consider a relation with `onDelete: Cascade`, or deactivating those rows in the venue-delete transaction.
- **Audit log of admin membership changes** (and, ideally, all membership changes): who changed whose role or scope, when, and whether the actor was a platform admin acting without a membership.
- **Platform-admin tooling:** granting `isPlatformAdmin` is a manual DB edit today.
- **One-call ownership transfer**, if the two-call flow proves awkward in the UI.
- **Inactive members are invisible.** `findAll` returns active rows only, so neither owners nor admins can see a soft-deleted member to reactivate them except by re-creating by email. A UI will likely want an "include inactive" read.
- **Partial-index preview dependency:** revisit `previewFeatures = ["partialIndexes"]` on every Prisma upgrade.
- **Redundant venue rows next to a tenant-wide row:** if the product later wants one effective scope per user, add a service rule (409 on creating a venue row next to an active tenant-wide one; deactivate venue rows on promotion). No schema change needed.
