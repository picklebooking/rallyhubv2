# Venue Layer Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Insert `Venue` between `Tenant` (business/billing account) and `Court` (bookable resource) so one tenant can own 1..N physical locations, with `TenantContextMiddleware`, `CourtsController`, and `CourtBookModule` all moving to venue-scoping.

**Architecture:** Big-bang Prisma migration (zero prod data) adds `Venue`/`VenueStatus`, moves location/branding fields off `Tenant`, adds required `venueId` to `Court`/`CourtBooking`/`CourtSchedule` and nullable `venueId` to `TenantMember`. A new sibling `VenuesModule` (ported from `TenantsModule`'s CRUD shape) owns venue slug resolution; `@CurrentVenue()` is added alongside `@CurrentTenant()`; `CourtsController`/`CourtBookModule` switch from tenant-scoping to venue-scoping, which also closes issue #19 (booking `tenantId` trusted from the request body).

**Tech Stack:** NestJS, Prisma (`prisma-client` generator, `PrismaPg` adapter), class-validator DTOs, Jest (`ts-jest`, `@jest/globals`), `@workspace/shared` type-only contracts.

**Spec:** `docs/superpowers/specs/2026-09-19-venue-layer-design.md`

## Global Constraints

- **Never run `npx prisma migrate dev` or any command that mutates the shared dev database.** Edit `schema.prisma`, run `npx prisma validate` and `npx prisma format --check` only, then stop and hand the exact migration command to a human to run.
- `tenantId` stays on every model that has it today, denormalized alongside `venueId` — nothing that currently filters by `tenantId` stops working.
- No `TenantRolesGuard` work, no `TenantMember` OWNER auto-assignment, no frontend changes — out of scope per the spec.
- Every new/changed unit gets a test written first (TDD): failing test → verify fail → minimal implementation → verify pass → commit.
- Match existing repo conventions: thin controller → service → repository, JSDoc on every public method (`@param`/`@returns`/`@throws`), DTOs with `class-validator` decorators, no `any`.

---

## Task 1: Schema migration prep (STOP for human before applying)

**Files:**
- Modify: `apps/api/prisma/schema.prisma`

**Interfaces:**
- Produces: `Venue` model (`id`, `tenantId`, `name`, `slug` unique, `status: VenueStatus`, address/contact/branding fields, `tenant` relation, `courts`/`courtBookings`/`courtSchedules` back-relations), `VenueStatus` enum (`PENDING`/`ACTIVE`/`SUSPENDED`/`INACTIVE`); `Tenant` loses `slug`/address/branding fields but keeps its three back-relation arrays unchanged; `Court`/`CourtBooking`/`CourtSchedule` gain required `venueId` + `venue` relation (`onDelete: Cascade`); `TenantMember` gains nullable `venueId`, unique constraint becomes `(userId, tenantId, venueId)`.

- [ ] **Step 1: Edit `Tenant`** — remove `slug`, `address`, `city`, `state`, `zipCode`, `country`, `timezone`, `website`, `logo`, `coverImage`, `description`; keep `id`, `name`, `status`, `email`, `phone`, `primaryColor`, timestamps, and all three back-relation arrays (`courts`, `courtBookings`, `courtSchedules`) plus `members`; add `venues Venue[]`; drop the `@@index([slug])`.

- [ ] **Step 2: Add `Venue` model + `VenueStatus` enum** directly after `Tenant`, per the spec's Schema Diff section — `slug` takes over the `@unique` constraint and `@@index([slug])` that `Tenant` had.

- [ ] **Step 3: Edit `TenantMember`** — add `venueId String?`; change `@@unique([userId, tenantId])` to `@@unique([userId, tenantId, venueId])`.

- [ ] **Step 4: Edit `Court`** — add `venueId String` (required) and `venue Venue @relation(fields: [venueId], references: [id], onDelete: Cascade)`; add `@@index([venueId])` and `@@index([venueId, status])` alongside the existing `tenantId` indexes.

- [ ] **Step 5: Edit `CourtBooking`** — add `venueId String` (required) and `venue Venue @relation(fields: [venueId], references: [id], onDelete: Cascade)`; add a `venueId` index. Leave `court`'s `onDelete: Restrict` untouched.

- [ ] **Step 6: Edit `CourtSchedule`** — same as Step 5 (required `venueId`, `venue` relation `onDelete: Cascade`, new index). Leave `court`'s `onDelete: Cascade` untouched.

- [ ] **Step 7: Validate, don't migrate**

Run: `cd apps/api && npx prisma validate && npx prisma format --check`
Expected: both succeed with no errors. If `format --check` fails, run `npx prisma format` (safe — formatting only, no DB access) and re-check.

- [ ] **Step 8: STOP.** Report to the orchestrator: schema diff is staged and validated, and hand back the exact command a human must run:

```bash
cd apps/api && npx prisma migrate dev --name add_venue_layer
```

Do not proceed to Task 2 until told the migration ran and the client was regenerated.

---

## Task 2: `@CurrentVenue()` decorator + regression test for `@CurrentTenant()`

**Files:**
- Create: `apps/api/src/common/decorators/current-venue.decorator.ts`
- Test: `apps/api/src/common/decorators/current-venue.decorator.spec.ts`

**Interfaces:**
- Produces: `CurrentVenue` param decorator — reads `request.venueId`, throws `BadRequestException` if missing/non-string/empty, mirrors `CurrentTenant` exactly (same factory-extraction test pattern via `ROUTE_ARGS_METADATA`).

- [ ] **Step 1: Write the failing test** — copy `current-tenant.decorator.spec.ts` verbatim, replacing `CurrentTenant`/`tenantId` with `CurrentVenue`/`venueId` and the error string with "Venue context required. This endpoint must be called with a valid venue in scope (subdomain or X-Venue-Id header)."

- [ ] **Step 2: Run it, confirm it fails** (module not found) — `npm run test -w api -- current-venue.decorator`

- [ ] **Step 3: Implement** `current-venue.decorator.ts`, mirroring `current-tenant.decorator.ts`'s structure exactly, reading `venueId` instead of `tenantId`.

- [ ] **Step 4: Run it, confirm it passes** — same command.

- [ ] **Step 5: Commit** — `git add apps/api/src/common/decorators/current-venue.decorator.ts apps/api/src/common/decorators/current-venue.decorator.spec.ts && git commit -m "feat(api): add @CurrentVenue() decorator"`

---

## Task 3: `VenuesRepository`, `VenuesService`, `VenuesController`, `VenuesModule`, DTOs

**Files:**
- Create: `apps/api/src/venues/venues.module.ts`, `venues.controller.ts`, `venues.service.ts`, `venues.repository.ts`, `dto/create-venue.dto.ts`, `dto/update-venue.dto.ts`, `dto/index.ts`, `venue-slug.utils.ts` (moved from `tenants/tenant-slug.utils.ts`, content unchanged)
- Test: `venues.repository.spec.ts`, `venues.service.spec.ts`, `venues.controller.spec.ts`
- Modify: `apps/api/src/app.module.ts` (register `VenuesModule`)

**Interfaces:**
- Consumes: `PrismaService.db.venue` (Prisma delegate from the regenerated client), `isValidSlug`/`getSlugValidationError` (moved, unchanged signatures).
- Produces: `VenuesRepository` — `findAll(): Promise<Venue[]>`, `findById(id): Promise<Venue | null>`, `findBySlug(slug): Promise<Venue | null>`, `findAllByTenant(tenantId): Promise<Venue[]>`, `create(tenantId, dto): Promise<Venue>`, `update(id, dto): Promise<Venue>`, `delete(id): Promise<Venue>`, `slugExists(slug): Promise<boolean>`. `VenuesService` — same public shape as `TenantsService` (`findAll`, `findById`, `findBySlug`, `create`, `update`, `delete`) plus `delete()` catching Prisma `P2003` → `ConflictException('Cannot delete venue with active bookings. Cancel or reassign its bookings first.')`, mirroring `CourtsService.delete()`'s try/catch pattern exactly. `VenuesController` routes: `GET /venues`, `GET /venues/by-slug/:slug`, `GET /venues/:id`, `POST /venues`, `PATCH /venues/:id`, `DELETE /venues/:id`.

- [ ] **Step 1: Write `venues.repository.spec.ts`** — copy `tenants.repository.spec.ts`'s structure, retargeted at `prismaService.db.venue`, plus a new `findAllByTenant` test (`findMany({ where: { tenantId }, orderBy: { createdAt: 'desc' } })`) since `Venue`, unlike `Tenant`, needs to be listed per-tenant.

- [ ] **Step 2: Run it, confirm it fails.**

- [ ] **Step 3: Implement `venue-slug.utils.ts`** (move `tenant-slug.utils.ts` content verbatim, `git mv` then delete the old path once `venues/` compiles) **and `venues.repository.ts`**, mirroring `tenants.repository.ts` plus the new `findAllByTenant` method.

- [ ] **Step 4: Run it, confirm it passes.**

- [ ] **Step 5: Write `dto/create-venue.dto.ts` and `dto/update-venue.dto.ts`** — copy `create-tenant.dto.ts`/`update-tenant.dto.ts` field-for-field (they already have every location/branding field this DTO needs) but add `tenantId` as a required `@IsString() @IsNotEmpty()` field on `CreateVenueDto` (a venue must declare which tenant it belongs to at creation — `Tenant` has no such field to copy from). `dto/index.ts` re-exports both.

- [ ] **Step 6: Write `venues.service.spec.ts`** — copy `tenants.service.spec.ts`'s structure (using a `createMockVenue` fixture with `tenantId` added), plus a `delete()` test asserting a Prisma `P2003` `PrismaClientKnownRequestError` from `repository.delete` is caught and rethrown as `ConflictException` with the venue-specific message (mirror `courts.service.ts`'s delete, which has no existing spec to copy from — write this test fresh using the same `Prisma.PrismaClientKnownRequestError` construction pattern documented in `courts.service.ts`'s import).

- [ ] **Step 7: Run it, confirm it fails.**

- [ ] **Step 8: Implement `venues.service.ts`**, mirroring `tenants.service.ts`'s `findAll`/`findById`/`findBySlug`/`create`/`update` exactly (slug validation via the moved utils), and `delete()` mirroring `courts.service.ts`'s try/catch-P2003 pattern with the venue-specific message.

- [ ] **Step 9: Run it, confirm it passes.**

- [ ] **Step 10: Write `venues.controller.spec.ts`** — copy `tenants.controller.spec.ts`'s structure retargeted at `VenuesService`/`VenueResponse`.

- [ ] **Step 11: Run it, confirm it fails.**

- [ ] **Step 12: Implement `venues.controller.ts`**, mirroring `tenants.controller.ts` route-for-route, and `venues.module.ts` mirroring `tenants.module.ts` (controller + repository + service providers, both exported since `TenantContextMiddleware` will need `VenuesRepository`).

- [ ] **Step 13: Run it, confirm it passes.** Then register `VenuesModule` in `app.module.ts`'s imports array, alongside `TenantsModule`.

- [ ] **Step 14: Run the full suite** — `npm run test -w api` — confirm still green, then commit: `git add apps/api/src/venues apps/api/src/app.module.ts && git commit -m "feat(api): add VenuesModule (CRUD, slug validation, venue-scoped delete conflict)"`.

---

## Task 4: Rewrite `TenantContextMiddleware` for venue-first resolution

**Files:**
- Modify: `apps/api/src/common/middleware/tenant-context.middleware.ts`
- Modify: `apps/api/src/common/middleware/tenant-context.middleware.spec.ts`

**Interfaces:**
- Consumes: `VenuesRepository.findBySlug(slug): Promise<Venue | null>`, `VenuesRepository.findById(id): Promise<Venue | null>` (both already produced by Task 3).
- Produces: on a venue match, sets `req.tenantId = venue.tenantId`, `req.venueId = venue.id`, `req.venue = venue`. On an `X-Tenant-Id` header match with no venue in scope, sets only `req.tenantId` (unchanged fallback for tenant-only endpoints like `POST /tenants`).

- [ ] **Step 1: Update the spec file first** — rewrite `tenant-context.middleware.spec.ts`'s mock from `TenantsRepository` to `VenuesRepository`, add a `createMockVenue` fixture (`id`, `tenantId`, `name`, `slug`, `status`, location fields, timestamps), and add these new/changed cases: (a) subdomain resolves a venue → asserts `req.tenantId === venue.tenantId`, `req.venueId === venue.id`, `req.venue === venue`; (b) new `X-Venue-Id` header path resolves via `venuesRepository.findById`, same assertions; (c) `X-Tenant-Id` header (kept, unchanged) still sets only `req.tenantId`, no `req.venueId`; (d) priority order becomes subdomain → `X-Venue-Id` → `X-Tenant-Id`.

- [ ] **Step 2: Run it, confirm it fails** (constructor signature mismatch / missing header handling).

- [ ] **Step 3: Implement** — swap the injected `TenantsRepository` for `VenuesRepository`; subdomain and `X-Venue-Id` paths call the venue repository and set all three request properties from the resolved `venue`; keep the existing `X-Tenant-Id` branch as a final fallback that only sets `req.tenantId` (no venue lookup).

- [ ] **Step 4: Run it, confirm it passes.**

- [ ] **Step 5: Commit** — `git add apps/api/src/common/middleware/tenant-context.middleware.ts apps/api/src/common/middleware/tenant-context.middleware.spec.ts && git commit -m "feat(api): resolve venue first in TenantContextMiddleware, derive tenantId from it"`

---

## Task 5: Shrink `TenantsModule`

**Files:**
- Modify: `apps/api/src/tenants/dto/create-tenant.dto.ts`, `update-tenant.dto.ts`, `tenants.service.ts`, `tenants.repository.ts`, `tenants.repository.spec.ts`, `tenants.service.spec.ts`, `tenants.controller.spec.ts`
- Delete: `apps/api/src/tenants/tenant-slug.utils.ts` (moved to `venues/` in Task 3 — remove the old copy once nothing imports it)

**Interfaces:**
- Produces: `CreateTenantDto`/`UpdateTenantDto` reduced to `name` (+ `status` on update); `TenantsService`/`TenantsRepository` drop all slug-validation logic and location/branding fields from `create`/`update`/`toTenantResponse`; `TenantsRepository` loses `slugExists`/`findBySlug` (moved conceptually to venues — `Tenant` has no slug anymore) and `findByStatus` stays (still useful, no slug involved).

- [ ] **Step 1: Update the failing tests first** — trim `tenants.repository.spec.ts`'s `create`/`update` expectations to only `name`/`status`-shaped data, delete its `findBySlug`/`slugExists` `describe` blocks; trim `tenants.service.spec.ts` similarly, deleting every slug-validation/conflict test (`BadRequestException` for bad slug, `ConflictException` for taken slug) and its `findBySlug` block; trim `tenants.controller.spec.ts`'s `findBySlug` block and DTO fixtures down to `name`/`status`.

- [ ] **Step 2: Run the trimmed tests, confirm they fail** against the still-untrimmed implementation (fixture/expectation mismatches).

- [ ] **Step 3: Implement** — remove `slug`/location/branding fields from both DTOs; remove `findBySlug`, `slugExists` from `TenantsRepository`; remove slug-validation branches from `TenantsService.create`/`update`, and simplify `toTenantResponse` to `{ id, name, status, email, phone, primaryColor, createdAt, updatedAt }`; delete `findBySlug` from `TenantsController` and `TenantsService`; delete `tenant-slug.utils.ts` (confirm nothing outside `venues/` still imports it via `grep -rn "tenant-slug.utils" apps/api/src`).

- [ ] **Step 4: Run the full suite, confirm green.**

- [ ] **Step 5: Commit** — `git add apps/api/src/tenants && git commit -m "refactor(api): shrink TenantsModule to business-level fields only"`

---

## Task 6: `CourtsController`/`CourtsService`/`CourtsRepository` → venue-scoped

**Files:**
- Modify: `apps/api/src/courts/courts.controller.ts`, `courts.service.ts`, `courts.repository.ts`
- Create: `apps/api/src/courts/courts.controller.spec.ts`, `courts.repository.spec.ts` (neither exists today — new coverage, not a rewrite)

**Interfaces:**
- Produces: `CourtsController.findAllByTenant`/`create` swap `@CurrentTenant() tenantId` for `@CurrentVenue() venueId`; `CourtsRepository.findAllByTenant(tenantId)` → `findAllByVenue(venueId)`; `CourtsRepository.create(tenantId, dto)` → `create(tenantId, venueId, dto)`, storing both FKs; `CourtsService.findAllByTenant(tenantId)` → `findAllByVenue(venueId)`, `create(tenantId, dto)` → `create(tenantId, venueId, dto)`; `CourtResponse` gains `venueId`.

- [ ] **Step 1: Write `courts.repository.spec.ts`** — mirror `tenants.repository.spec.ts`'s mocking structure against `prismaService.db.court`, covering `findAllByVenue` (`findMany({ where: { venueId }, orderBy: { createdAt: 'desc' } })`), `findById`, `create` (asserts `data: { tenantId, venueId, name }`), `update`, `delete`.

- [ ] **Step 2: Run it, confirm it fails.**

- [ ] **Step 3: Implement `courts.repository.ts`** — rename `findAllByTenant` to `findAllByVenue(venueId: string)`; `create(tenantId: string, venueId: string, data: CreateCourtDto)` stores both ids.

- [ ] **Step 4: Run it, confirm it passes.**

- [ ] **Step 5: Write `courts.controller.spec.ts`** — mirror `tenants.controller.spec.ts`'s structure; the two behavior-relevant assertions are `findAllByTenant` calling `courtsService.findAllByVenue` with the `@CurrentVenue()`-supplied id, and `create` calling `courtsService.create` with `(tenantId, venueId, dto)` where `tenantId` comes from `@CurrentTenant()` and `venueId` from `@CurrentVenue()` — both decorators on the same route, since a court's `tenantId` is still denormalized and needed at creation.

- [ ] **Step 6: Run it, confirm it fails.**

- [ ] **Step 7: Implement** — `CourtsController.findAllByTenant` takes `@CurrentVenue() venueId` and calls `courtsService.findAllByVenue(venueId)`; `create` takes both `@CurrentTenant() tenantId` and `@CurrentVenue() venueId`, calling `courtsService.create(tenantId, venueId, dto)`. Update `CourtsService.findAllByVenue`/`create` to match, and `toCourtResponse` to include `venueId`.

- [ ] **Step 8: Run the full suite, confirm green.**

- [ ] **Step 9: Commit** — `git add apps/api/src/courts && git commit -m "feat(api): scope CourtsController to @CurrentVenue(), add missing test coverage"`

---

## Task 7: `CourtBookModule` resolves `tenantId`/`venueId` server-side (closes #19)

**Files:**
- Modify: `apps/api/src/court-book/dto/create-court-booking.dto.ts`, `court-book.controller.ts`, `court-book.service.ts`, `apps/api/src/models/create-booking.model.ts`
- Create: `apps/api/src/court-book/court-book.service.spec.ts`, `apps/api/src/court-book/court-book.controller.spec.ts` (neither exists today)

**Interfaces:**
- Produces: `CreateCourtBookingDto` drops `tenantId`; `CourtBookController.createBooking` takes `@CurrentTenant() tenantId`, `@CurrentVenue() venueId`, `@Body() requestBody`; `CourtBookService.createBookingRoute(tenantId, venueId, payload)`; `CreateCourtBooking`/`CreateCourtSchedule` constructors gain a `venueId` parameter (positioned after `tenantId`, matching the existing tenantId-adjacent placement) and `CourtBookRepository.createCourtBooking`'s `$transaction` payloads carry it.

- [ ] **Step 1: Write `court-book.service.spec.ts`** — mock `CourtBookRepository`/`DateTimeHelper`/`PNRHelper`; test `createBookingRoute(tenantId, venueId, payload)`: (a) happy path calls `hasConflictBooking` with the passed-in `tenantId` (not one read off `payload`), (b) throws `ConflictException` on conflict, (c) throws `NotFoundException` when `findUserIdByEmail` returns null, (d) on success, both `CreateCourtSchedule`/`CreateCourtBooking` constructor calls include the passed-in `venueId`.

- [ ] **Step 2: Run it, confirm it fails.**

- [ ] **Step 3: Implement** — remove `tenantId` from `CreateCourtBookingDto`; add `venueId` param to `CreateCourtBooking`/`CreateCourtSchedule` in `create-booking.model.ts` (after each constructor's existing `tenantId` param); update `CourtBookService.createBookingRoute` to accept `tenantId`/`venueId` as leading params instead of destructuring `tenantId` off `payload`, and pass `venueId` into both model constructors.

- [ ] **Step 4: Run it, confirm it passes.**

- [ ] **Step 5: Write `court-book.controller.spec.ts`** — asserts `createBooking` reads `@CurrentTenant()`/`@CurrentVenue()` and forwards them plus the body to `courtBookService.createBookingRoute`.

- [ ] **Step 6: Run it, confirm it fails.**

- [ ] **Step 7: Implement** — add `@CurrentTenant() tenantId: string, @CurrentVenue() venueId: string` params to `CourtBookController.createBooking`, forwarded to the service call.

- [ ] **Step 8: Run the full suite, confirm green.**

- [ ] **Step 9: Commit** — `git add apps/api/src/court-book apps/api/src/models/create-booking.model.ts && git commit -m "fix(api): resolve booking tenantId/venueId server-side instead of trusting the request body (closes #19)"`

---

## Task 8: `packages/shared` contracts

**Files:**
- Modify: `packages/shared/api/tenants.d.ts`, `packages/shared/api/courts.d.ts`, `packages/shared/index.d.ts`
- Create: `packages/shared/api/venues.d.ts`

**Interfaces:**
- Produces: `TenantResponse`/`CreateTenantRequest`/`UpdateTenantRequest` reduced to `{ id, name, status, email, phone, primaryColor, createdAt, updatedAt }`-shaped fields (drop `slug` and every location/branding field); `TenantBySlugResponse` and its `findBySlug` re-export removed entirely (no slug on `Tenant` anymore); new `venues.d.ts` exports `VenueStatus`, `VenueResponse`, `CreateVenueRequest`, `UpdateVenueRequest`, `GetAllVenuesResponse`, `VenueBySlugResponse` (all fields currently on `TenantResponse`/`CreateTenantRequest` that describe a location, plus `tenantId`); `CourtResponse` gains `venueId: string`.

- [ ] **Step 1: Rewrite `tenants.d.ts`** — trim to the business-level shape, delete `TenantBySlugResponse`.

- [ ] **Step 2: Write `venues.d.ts`** — copy the pre-trim `tenants.d.ts` shapes, rename `Tenant*` → `Venue*`, add `tenantId: string` to every request/response type, keep `VenueBySlugResponse` (same shape `TenantBySlugResponse` had, renamed).

- [ ] **Step 3: Add `venueId: string` to `CourtResponse`** in `courts.d.ts`.

- [ ] **Step 4: Update `index.d.ts`** — trim the `tenants` re-export list (drop `TenantBySlugResponse`), add a `venues` re-export block mirroring the old tenants one.

- [ ] **Step 5: Commit** — `git add packages/shared && git commit -m "feat(shared): split venue location/branding contracts out of tenant contracts"`

---

## Task 9: Regenerate, verify, live E2E

**Files:** none (verification only)

- [ ] **Step 1:** `cd apps/api && npx prisma generate`
- [ ] **Step 2:** `npm run typecheck -w api` — fix any type errors surfaced by the contract/DTO changes before proceeding.
- [ ] **Step 3:** `npm run test -w api` — full suite green.
- [ ] **Step 4:** `npm run build -w api` — clean build.
- [ ] **Step 5: Live E2E** against the real dev DB, matching this session's existing courts-module verification pattern: `POST /tenants` → `POST /venues` (with the returned `tenantId`) → `POST /courts` (via `X-Venue-Id` header) → `POST /v1/court-book/create` (same header) → confirm 201/200 at each step. Clean up created rows afterward via direct `DELETE` calls in reverse creation order (booking's court has `Restrict`, so the booking itself isn't deletable via API — leave it, matching how prior sessions have left throwaway test bookings in the shared dev DB) — do not attempt a raw SQL cleanup.
- [ ] **Step 6:** Report final summary to the orchestrator per the fork directive — do not commit this task (nothing to commit) and do not push anything.
