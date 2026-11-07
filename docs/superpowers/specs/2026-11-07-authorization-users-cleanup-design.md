# Management authorization, user-directory removal, and CUSTOMER role cleanup

Date: 2026-11-07
Branch: `fix/system-audit-remediation` (PR #34)
Source: `docs/SYSTEM-AUDIT-2026-11-07.md`, findings **#1**, **#2**, **#13**

## Why

RallyHub has not been released, but it can't be until these are fixed:

- **#1 (Critical):** any signed-in account can create, update, deactivate or delete another business's tenant, venues and courts. The global auth guard only checks that the caller is signed in. Nothing checks membership or role.
- **#2 (High):** `GET /users/all` returns every user's id, name, email and image to any signed-in account. It came from the starter template the repo was created from, not a RallyHub feature.
- **#13 (High):** `CUSTOMER` was removed from the `TenantRole` enum in `schema.prisma` (commit `ddae9b1`), but no migration removes it from the database and tests still reference `TenantRole.CUSTOMER`. Three API suites fail to compile because of it.

Success means an ordinary signed-in user can't change any business they don't belong to, staff can only touch what their membership covers, no endpoint exposes the user directory, the migration history matches the schema, and the API test suite fully compiles and passes.

## The access model (decided by the product owner)

A **customer is not a role.** A signed-in user with no active `TenantMember` row is a customer. Customers can browse and book, but manage nothing.

Membership, as `TenantMember` (`role`, `venueId`, `isActive`) already models it:

| Membership | `role` | `venueId` | Covers |
| --- | --- | --- | --- |
| Owner | `OWNER` | `null` (enforced by `TenantMemberService.assertRoleVenue`) | the whole tenant |
| Tenant-wide staff | `STAFF` | `null` | every venue in the tenant |
| Venue staff | `STAFF` | a venue id | that venue and its courts only |

Only **active** memberships (`isActive = true`) count.

**Platform admin:** a new `User.isPlatformAdmin Boolean @default(false)`. It is set by hand in the database for the dev team. There is no UI and no endpoint that sets it. It is the only way to create, suspend or delete tenants until a paid onboarding flow exists (out of scope).

### Permission matrix (write routes)

| Action | Platform admin | OWNER | Tenant-wide STAFF | Venue STAFF | Customer |
| --- | --- | --- | --- | --- | --- |
| Create tenant (`POST /tenant/create`) | ✅ | ❌ | ❌ | ❌ | ❌ |
| Change tenant status (`PATCH /tenant/patch/:id/status`) | ✅ | ❌ | ❌ | ❌ | ❌ |
| Delete tenant (`DELETE /tenant/delete/:id`) | ✅ | ❌ | ❌ | ❌ | ❌ |
| Edit tenant details (`PATCH /tenant/patch/:id`) | ✅ | ✅ own tenant | ❌ | ❌ | ❌ |
| Create venue (`POST /venues`) | ✅ | ✅ own tenant | ✅ own tenant | ❌ | ❌ |
| Update / delete venue (`PATCH`/`DELETE /venues/:id`) | ✅ | ✅ own tenant | ✅ own tenant | ✅ own venue only | ❌ |
| Create court (`POST /courts`) | ✅ | ✅ own tenant | ✅ own tenant | ✅ own venue only | ❌ |
| Update / delete court (`PATCH`/`DELETE /courts/:id`) | ✅ | ✅ own tenant | ✅ own tenant | ✅ own venue only | ❌ |

Route paths are shorthand. The controllers build them from `MainRoute` constants, with URI versioning (`VERSION_ONE: '1'` in `apps/api/src/constants/routes.constant.ts`, `enableVersioning` in `main.ts`). Tests must use the real versioned paths from `apps/api/src/tenant/tenant.controller.ts`, `venues.controller.ts` and `courts.controller.ts`. Platform admins pass every management check (they are the dev team). The product owner chose "OWNER and STAFF can both manage venues and courts". This replaces the old schema comment that described STAFF as "view bookings, check-in players".

## How it must work

1. **Derive scope from the resource, never from the caller.**
   - For update and delete, load the venue or court by id and take its `tenantId` (and, for courts, its `venueId`) from the database before checking membership.
   - For create, the target comes from caller-controlled headers or the subdomain, via `@CurrentTenant()` / `@CurrentVenue()` (`apps/api/src/common/decorators/`). Those are a claim about which business the caller is acting for, not proof.
     - `POST /venues` uses `@CurrentTenant()`. Check "can create venues in this tenant" against it.
     - `POST /courts` uses only `@CurrentVenue()`; the middleware resolves the tenant from the venue row. Check "can manage this venue" against that venue and its own tenant. No tenant header is needed or consulted. Anyone can name any existing venue, so the venue membership check is the whole defence.
2. **Pass the authenticated actor into the services.** Follow the existing pattern in `tenant-member.controller.ts`: `@Session() session: UserSession`, passing the user id to the service.
3. **One shared policy, not copies.** Add a single injectable authorization service. Every management service calls it. The Prisma queries for it live in a repository. It answers:
   - Is this user a platform admin? Read `isPlatformAdmin` from the database through the repository on each check. Do **not** add it to Better Auth's `user.additionalFields` or any session payload, and do not expose it to the web. This keeps it impossible for a user to set at sign-up or through profile updates. *(Claude's call.)*
   - Can this user edit this tenant's details? Active OWNER with `venueId = null` in this tenant.
   - Can this user create venues in this tenant? Active OWNER or STAFF with `venueId = null` in this tenant.
   - Can this user manage this venue (and its courts)? Active OWNER or STAFF in the venue's tenant, with `venueId` null or equal to the venue.

   A platform admin passes every one of these checks, as the matrix shows.

   Open Play's `hasVenueStaffMembership` (`apps/api/src/open-play/open-play.repository.ts`) already encodes the venue rule. Reuse or consolidate it rather than writing a third variant. `TenantMemberService.assertCanManage` keeps its own OWNER-only rule for membership administration, which is unchanged.
4. **Responses.**
   - Signed in but not allowed → `403`. This includes resources in another tenant. Hiding them behind a `404` would protect nothing, because the read routes stay public. *(Claude's call.)*
   - Resource id that doesn't exist → `404`, as today.
5. **Scope repository writes.** Update and delete should include the resolved tenant/venue in their `where`, so a check-then-write mix-up can't touch another tenant's row.
6. **Tenant onboarding stays as it is.** A platform admin creates the tenant with the contact email. The verified user with that email then claims it as first OWNER through the existing claim flow in `TenantMemberService.assertCanManage`. Don't change that flow.
7. **Read routes are unchanged** (`GET /venues`, `GET /venues/by-slug/:slug`, `GET /venues/:id`, `GET /courts`, `GET /courts/:id`, `GET /tenant/find/:id`). Public discovery is finding #8 and is out of scope. *(Builder's note: this was Claude's call, not the product owner's.)*

## #2: remove the template user directory

Delete entirely:
- **API:** `GET /users/all`, `UsersService.getAllUsers`, `UsersRepository.getAllUsers`, and the `GetAllUsersResponse` contract. It is declared in `packages/shared/api/users.d.ts` and re-exported from `packages/shared/index.d.ts`; remove it from both if nothing else uses it.
- **Web:**
  - the `/users` and `/data` pages under `apps/web/app/(protected)/`
  - `components/users/users-page.tsx` and `components/data/data-page.tsx`
  - `components/dashboard/recent-users-card.tsx` and its use on the dashboard
  - the sidebar/nav entries for `/users` and `/data` in `components/dashboard/dashboard-data.ts`
  - `hooks/api/use-all-users.ts`
  - the all-users function in `lib/api/users.ts`

**Keep** `GET /users/me` and everything it uses. The dashboard must still render with the card removed: no empty grid slot, and both light and dark mode correct.

## #13: finish the CUSTOMER removal

- Generate one Prisma migration through the normal workflow with the Prisma CLI (`npx prisma migrate dev --name <name>`, then `npm run db:generate`). Postgres can't drop an enum value in place, so Prisma will generate a rename/create/cast/drop of the `TenantRole` type. That cast fails if any row still holds `CUSTOMER`. **The migration is fully generated by Prisma. Do not hand-edit migration SQL.** *(Product owner's rule.)* RallyHub is unreleased, so `CUSTOMER` rows can only exist in local dev databases. If applying the migration fails on such a database because of leftover `CUSTOMER` rows, the remedy is for the product owner to reset that database. The migration file is not edited.
- Put the `isPlatformAdmin` column in the **same migration**, so there is one reviewed schema change.
- Update `apps/api/prisma/schema.prisma` comments so they say what the code does:
  - the `TenantMember.venueId` comment should say `null` = tenant-wide (OWNER or STAFF) and set = one venue (STAFF)
  - the `TenantRole.STAFF` comment should say STAFF can manage venues and courts within their scope
- Update every test that references `CUSTOMER`. At minimum:
  - `tenant-member.service.spec.ts` (lines ~107, 166, 172)
  - `tenant-member.controller.spec.ts` (~66)
  - `open-play.integration.spec.ts` (~526)

  Where a test used CUSTOMER to mean "not staff", replace it with "no membership" or with an inactive membership, whichever fits the test's intent.
- Verify by replaying all migrations on an empty disposable database and running the integration suites against it with `TEST_DATABASE_URL`.

## Testing (required)

- **HTTP-level tests through the real guard pipeline** (Nest app plus supertest, real sessions). Unit tests with mocked repositories are not enough; the audit specifically called for this.
  - **Harness:** these are database integration tests and need `TEST_DATABASE_URL`, pointing at a disposable, migrated Postgres. The local Docker Postgres on port 5433 works. They skip without it, like the existing integration suites. Running them with it set is part of acceptance for this work.
  - **Sessions:** create real sessions by signing users up and in through the app's Better Auth endpoints and reusing the returned session cookie, or by an equivalent helper that produces a cookie the real guard accepts. Do not override or mock the auth guard. Build the helper once and reuse it; it will likely be the largest single piece of #1.
  - **Coverage:** cover at least:
  - customer → `403` on every write route in the matrix
  - an OWNER of tenant A → `403`/`404` on tenant B's tenant, venues and courts
  - venue STAFF of venue X → allowed on X and X's courts, refused on venue Y in the same tenant, refused on venue create
  - tenant-wide STAFF → allowed on all venues and courts in their tenant, refused on tenant status/delete/create
  - OWNER → can edit tenant details, refused on tenant status/delete/create
  - platform admin → allowed on tenant create/status/delete
  - an inactive membership → treated as no membership
  - spoofed `X-Tenant-Id` on `POST /venues`, and spoofed `X-Venue-Id` on `POST /courts`, naming a business the caller doesn't belong to → `403`
- `GET /users/all` → `404`.
- Clean migration replay plus the full API suite. The three suites that failed at baseline must now compile and pass.
- Web: `npm run typecheck -w web`, `npm run build -w web`, `npm run lint -w web` with no new warnings. Do a quick manual check of the dashboard in light and dark mode.

## Constraints

- Follow `AGENTS.md`:
  - thin controllers → services → repositories, with Prisma only in repositories
  - DTOs for request shapes
  - explicit return types
  - no `any`
- Shared request/response types live in `packages/shared` and are imported type-only.
- **Prisma:** schema changes and migrations go only through the Prisma CLI (`npx prisma migrate dev`, `npx prisma generate` / `npm run db:generate`), and migration SQL is never written or edited by hand.
  - The product owner authorizes running `migrate dev` against both the test DB and their dev DB.
  - `migrate reset` is allowed only on the disposable test DB.
  - Don't run `db:migrate:deploy` or `npm install`.
- No `Co-Authored-By`, `Claude-Session` or 🤖 lines in commits or PR text.
- Commit to `fix/system-audit-remediation` (PR #34). Keep #1, #2 and #13 as separate, reviewable commits. A sensible order is #13 first (the migration plus test fixes give a green suite to build on), then #1, then #2.

## Non-goals

- Paid or self-serve tenant onboarding, invitations, and any platform-admin UI.
- Booking integrity (#3–#6), public venue discovery (#8), and last-owner protection and membership uniqueness (#15, #16).
- Changing who can manage tenant memberships. It stays active OWNER only, plus the existing first-owner claim.

## Anti-goals (a failure even if tests pass)

- Any management route that still trusts a tenant or venue id from headers, the body or params without checking membership.
- Permission logic copied into each service instead of one shared policy.
- A user-controllable way to become a platform admin.
- Dropping or rewriting existing migration files instead of adding a new one.
