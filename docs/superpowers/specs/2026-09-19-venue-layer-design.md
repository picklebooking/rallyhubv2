# Venue Layer Design

## Goal

Today `Tenant` is both "the business account" and "the physical location" — `Tenant` carries `slug`, `address`, `timezone`, and every `Court` points straight at a `Tenant`. That means a business that operates more than one physical court venue has no way to model it: it would need two unrelated `Tenant` rows, two subdomains, two unrelated `TenantMember` sets, and no shared identity between them.

This spec adds `Venue` as its own layer between `Tenant` (the business/billing account) and `Court` (a bookable resource), so one tenant can own 1..N physical locations. `docs/MULTI_TENANT_ARCHITECTURE.md` already documents this design (added 2026-09-19, decision log entry "Can one business run multiple physical locations?"); this spec turns that documentation into an actual implementation plan.

Zero production data exists in the shared dev database today — only test rows the team already knows how to recreate. That fact drives several decisions below.

## Decisions

- **Big-bang migration, not incremental.** Because there's no real data to preserve, one migration moves fields off `Tenant` onto the new `Venue`, adds required `venueId` to `Court`/`CourtBooking`/`CourtSchedule`, and adds optional `venueId` to `TenantMember` — in a single pass. An incremental (nullable-first, backfill, then tighten) approach is the right call when real customer data exists mid-flight; it doesn't here, and using it anyway would just be paying migration-safety tax for a risk that isn't present.
- **`tenantId` stays on every model that has it today**, denormalized alongside the new `venueId`. This keeps `TenantContextMiddleware`'s existing tenant-isolation contract intact — nothing that currently filters by `tenantId` stops working — while `venueId` narrows further, within a tenant, to one physical location.
- **`TenantMember.venueId` is nullable.** `null` means tenant-wide access (the normal shape for `OWNER`); a non-null value scopes a `STAFF` row to one venue. `OWNER` stays tenant-wide by convention, not by a DB constraint — Prisma can't express "required only when role=STAFF" declaratively, and enforcing it at the database level is out of scope for this pass (see Open Questions).
- **Known limitation, accepted for this pass:** changing the unique constraint to `@@unique([userId, tenantId, venueId])` does not actually prevent duplicate tenant-wide memberships. Postgres treats `NULL` values in a unique index as distinct from each other, not equal — so two `TenantMember` rows for the same `(userId, tenantId)` with `venueId = null` would **not** violate this constraint, unlike the current `@@unique([userId, tenantId])`, which does prevent duplicates today. A correct fix needs a partial unique index (`UNIQUE (userId, tenantId) WHERE venueId IS NULL`), which Prisma's schema DSL cannot express declaratively, and would have to be hand-added to the generated migration's SQL. This is safe to defer because nothing in the codebase creates a `TenantMember` row yet at all (OWNER auto-assignment is Phase 3, out of scope here) — but whoever builds that later must either add the partial index or enforce uniqueness at the application layer, or duplicate OWNER-shaped rows become possible.
- **New sibling `VenuesModule`, not nested under `TenantsModule`.** Matches this repo's existing flat convention — every feature module sits directly under `apps/api/src/<feature>/` (`tenants/`, `courts/`, `court-book/`, `users/`), none are nested inside another feature's directory.
- **`@CurrentVenue()` is added alongside `@CurrentTenant()`, not instead of it.** Business-level routes (tenant settings, billing, "list my venues") keep using `@CurrentTenant()`. Anything court/booking/pricing/schedule-shaped switches to `@CurrentVenue()`, since those are physically tied to one location.
- **`CourtsModule` and `CourtBookModule` both move from tenant-scoping to venue-scoping.** This is a real behavior change for both: `CourtsController` currently resolves `tenantId` via `@CurrentTenant()`; it will resolve `venueId` via `@CurrentVenue()` instead. `CourtBookService` currently trusts `tenantId` straight off the request DTO (this is the existing, already-known issue #19) — moving to `@CurrentVenue()`-resolved context fixes that gap as a side effect of this work, not as a separately-scoped fix.
- **No `TenantRolesGuard` in this pass.** Role/membership enforcement (Phase 3 in the architecture doc) is a separate, already-identified gap. This spec does not build it — it only makes sure `TenantMember.venueId` exists so that guard can be venue-aware when it is eventually built.

## Schema Diff

Current (`apps/api/prisma/schema.prisma`):

```prisma
model Tenant {
  id       String       @id @default(uuid())
  name     String
  slug     String       @unique
  status   TenantStatus @default(PENDING)
  address  String?
  city     String?
  state    String?
  zipCode  String?
  country  String  @default("PH")
  timezone String  @default("Asia/Manila")
  phone   String?
  email   String?
  website String?
  logo         String?
  coverImage   String?
  primaryColor String?
  description  String? @db.Text
  // ...timestamps, relations
}

model TenantMember {
  id        String     @id @default(uuid())
  userId    String
  tenantId  String
  role      TenantRole
  // ...
  @@unique([userId, tenantId])
}

model Court {
  id       String      @id @default(uuid())
  tenantId String
  name     String
  status   CourtStatus @default(ACTIVE)
  tenant Tenant @relation(fields: [tenantId], references: [id], onDelete: Cascade)
}

model CourtBooking {
  id       String @id @default(uuid())
  tenantId String
  courtId  String
  // ...
  court  Court  @relation(fields: [courtId], references: [id], onDelete: Restrict)
  tenant Tenant @relation(fields: [tenantId], references: [id], onDelete: Cascade)
}

model CourtSchedule {
  id       String @id @default(uuid())
  courtId  String
  tenantId String
  // ...
  court  Court  @relation(fields: [courtId], references: [id], onDelete: Cascade)
  tenant Tenant @relation(fields: [tenantId], references: [id], onDelete: Cascade)
}
```

Proposed:

```prisma
model Tenant {
  id        String       @id @default(uuid())
  name      String
  status    TenantStatus @default(PENDING)
  // Contact (business-level, not location-specific)
  email   String?
  phone   String?
  // Branding (brand-wide default)
  primaryColor String?
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  members  TenantMember[]
  venues   Venue[]
  courts         Court[]          // kept — Court.tenantId stays a real, validated FK, not just a bare column
  courtBookings  CourtBooking[]   // same reasoning
  courtSchedules CourtSchedule[]  // same reasoning

  @@index([status])
}
// A Prisma `@relation` FK requires a matching back-relation array on the
// referenced model, or `prisma validate` fails — so keeping tenantId as a
// real (denormalized) FK on Court/CourtBooking/CourtSchedule means Tenant
// keeps these three array fields unchanged from today. Venue gets its own,
// separate set of the same three relations below; a row has two real FKs
// (tenantId -> Tenant, venueId -> Venue) rather than reaching Tenant only
// by joining through Venue.
// slug, address, city, state, zipCode, country, timezone, website, logo,
// coverImage, description all REMOVED from Tenant -> moved to Venue below.

model Venue {
  id        String      @id @default(uuid())
  tenantId  String
  name      String                         // "Downtown", "Westside"
  slug      String      @unique            // moved from Tenant.slug
  status    VenueStatus @default(PENDING)
  address  String?
  city     String?
  state    String?
  zipCode  String?
  country  String  @default("PH")
  timezone String  @default("Asia/Manila")
  phone   String?
  email   String?
  website String?
  logo       String?
  coverImage String?
  description String? @db.Text
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  tenant Tenant @relation(fields: [tenantId], references: [id], onDelete: Cascade)
  courts         Court[]
  courtBookings  CourtBooking[]
  courtSchedules CourtSchedule[]

  @@index([tenantId])
  @@index([slug])
  @@index([status])
}

enum VenueStatus {
  PENDING
  ACTIVE
  SUSPENDED
  INACTIVE
}

model TenantMember {
  id        String      @id @default(uuid())
  userId    String
  tenantId  String
  venueId   String?     // NEW — null = all venues (OWNER); set = one venue (STAFF)
  role      TenantRole
  // ...
  tenant Tenant @relation(fields: [tenantId], references: [id], onDelete: Cascade)
  @@unique([userId, tenantId, venueId])   // CHANGED from @@unique([userId, tenantId])
}

model Court {
  id       String      @id @default(uuid())
  tenantId String                          // kept, denormalized
  venueId  String                          // NEW, required
  name     String
  status   CourtStatus @default(ACTIVE)
  tenant Tenant @relation(fields: [tenantId], references: [id], onDelete: Cascade)
  venue  Venue  @relation(fields: [venueId], references: [id], onDelete: Cascade)   // NEW
  @@index([tenantId])
  @@index([venueId])
  @@index([venueId, status])
}

model CourtBooking {
  id       String @id @default(uuid())
  tenantId String                          // kept
  venueId  String                          // NEW, required, denormalized from court
  courtId  String
  // ...
  court  Court  @relation(fields: [courtId], references: [id], onDelete: Restrict)  // unchanged
  tenant Tenant @relation(fields: [tenantId], references: [id], onDelete: Cascade)
  venue  Venue  @relation(fields: [venueId], references: [id], onDelete: Cascade)    // NEW
  @@index([venueId, ...])  // mirrors existing tenantId composite indexes
}

model CourtSchedule {
  id       String @id @default(uuid())
  courtId  String
  tenantId String                          // kept
  venueId  String                          // NEW, required
  // ...
  court  Court  @relation(fields: [courtId], references: [id], onDelete: Cascade)   // unchanged
  tenant Tenant @relation(fields: [tenantId], references: [id], onDelete: Cascade)
  venue  Venue  @relation(fields: [venueId], references: [id], onDelete: Cascade)    // NEW
}
```

No changes to `CourtBooking.court`'s `onDelete: Restrict` or `CourtSchedule.court`'s `onDelete: Cascade` — those relations and their rationale (preserve booking history vs. schedule rows are disposable) are unaffected by this change; `Venue` sits one level higher in the hierarchy.

## Module & Decorator Changes

Current layout:

```
apps/api/src/
  common/
    middleware/tenant-context.middleware.ts
    decorators/current-tenant.decorator.ts
  tenants/            (Tenant CRUD, slug validation)
  courts/             (Court CRUD, @CurrentTenant()-scoped)
  court-book/         (booking creation, tenantId trusted from DTO)
```

Proposed layout:

```
apps/api/src/
  common/
    middleware/tenant-context.middleware.ts   (rewritten — see below)
    decorators/
      current-tenant.decorator.ts             (unchanged behavior)
      current-venue.decorator.ts              (NEW)
  tenants/            (shrinks — business-level CRUD only, no slug/location fields)
  venues/             (NEW — Venue CRUD, owns slug validation, moved from tenants/tenant-slug.utils.ts)
  courts/             (@CurrentVenue()-scoped instead of @CurrentTenant())
  court-book/         (resolves tenantId + venueId via decorators, not the request body)
```

**`TenantContextMiddleware`** (`apps/api/src/common/middleware/tenant-context.middleware.ts`): resolves by venue slug first via a new `VenuesRepository.findBySlug`, sets `req.tenantId = venue.tenantId` and `req.venueId = venue.id`. The existing `X-Tenant-Id` header path is kept as a fallback for tenant-only endpoints (tenant creation has no venue yet); a new `X-Venue-Id` header path is added alongside it.

**`@CurrentVenue()`** (new file, same shape as `@CurrentTenant()`): reads `req.venueId`, throws `BadRequestException` if missing.

**`VenuesModule`**: ported from `TenantsModule`'s existing CRUD shape (controller/service/repository/DTOs). `tenant-slug.utils.ts` moves here unchanged — it's generic string validation with no tenant-specific logic in it today. Unlike `TenantsService`, `VenuesService.delete()` catches the Prisma `P2003` foreign-key-violation pattern `CourtsService` already uses (Venue → Cascade → Court → Restrict → CourtBooking) and returns a `409 ConflictException` with a venue-specific message, per Open Question 3's resolution — a deleted venue's own bookings surface as "cannot delete this venue," not a raw court-level FK error.

**`TenantsModule`**: DTOs drop `slug`/address/branding fields (all moved to `Venue`); service/repository shrink to match.

**`CourtsController`** (`apps/api/src/courts/courts.controller.ts`): `create`/`findAllByTenant` swap `@CurrentTenant() tenantId` for `@CurrentVenue() venueId`.

**`CourtBookModule`**: `CreateCourtBookingDto` currently declares `tenantId: string` as a client-supplied field (`apps/api/src/court-book/dto/create-court-booking.dto.ts`). This field is removed from the DTO; `CourtBookService.createBookingRoute()` resolves both `tenantId` and `venueId` from the decorators instead. This is the fix for issue #19, delivered as a consequence of this change rather than a separate patch.

**`packages/shared`**: `TenantResponse`/`CreateTenantRequest`/`UpdateTenantRequest` (`packages/shared/api/tenants.d.ts`) drop the location/branding fields. A new `packages/shared/api/venues.d.ts` gains them (`VenueResponse`, `CreateVenueRequest`, `UpdateVenueRequest`, `VenueBySlugResponse`, `GetAllVenuesResponse`). `CourtResponse` (`packages/shared/api/courts.d.ts`) gains `venueId`.

## Migration Approach

Single migration via the `migration-writer` subagent, per this repo's standing convention (never hand-write SQL, never run `prisma migrate dev` without explicit ask). One pass:

1. Add `Venue` model + `VenueStatus` enum.
2. Move `slug`/address/contact/branding columns from `Tenant` to `Venue` (drop from `Tenant`, add to `Venue`).
3. Add `venueId` (required) to `Court`, `CourtBooking`, `CourtSchedule`; add the FK + indexes.
4. Add `venueId` (nullable) to `TenantMember`; change its unique constraint to `(userId, tenantId, venueId)`.

Existing test rows in the shared dev DB (a handful of tenants/courts/bookings from this session's manual testing) do not need a backfill script — the team already knows how to recreate them, and preserving throwaway test data through a schema migration isn't worth the complexity an incremental approach would add.

## Implementation Order

1. Schema migration (above).
2. `VenuesRepository` + `@CurrentVenue()` decorator + rewritten `TenantContextMiddleware`.
3. `VenuesModule` (ported from `TenantsModule`'s CRUD shape), including moved slug-validation utility and the venue-specific `P2003` → 409 catch on delete.
4. Shrink `TenantsModule` (DTOs, service, repository, controller responses).
5. Update `CourtsModule` to consume `@CurrentVenue()`.
6. Update `CourtBookModule` to resolve `tenantId`/`venueId` server-side (closes issue #19).
7. Update `packages/shared` contracts (`tenants.d.ts`, new `venues.d.ts`, `courts.d.ts`).
8. Regenerate Prisma client, typecheck/test/build.
9. Live end-to-end verification: create tenant → create venue → create court → create booking, matching the manual verification pattern already used for the courts module this session.

## Testing Approach (TDD)

Per the repo's Jest setup (`apps/api/src/**/*.spec.ts`), each new/changed unit gets tests written first:

- `VenuesRepository`: CRUD against a test double `PrismaService`, mirroring `tenants.repository.spec.ts`'s existing structure.
- `VenuesService`: slug validation/uniqueness behavior, mirroring `tenants.service.spec.ts`.
- `VenuesController`: route wiring, mirroring `tenants.controller.spec.ts`.
- `@CurrentVenue()` decorator: missing-`venueId` throws `BadRequestException`, present-`venueId` returns it — mirrors the existing (implicit, untested today) `@CurrentTenant()` shape; this is a good place to also add the test `@CurrentTenant()` itself is currently missing.
- `TenantContextMiddleware`: extend `tenant-context.middleware.spec.ts` for venue-slug resolution, the new `X-Venue-Id` header path, and confirming `req.tenantId` is correctly derived from `venue.tenantId`.
- `CourtsController`/`CourtBookService`: update existing specs (none currently exist for `court-book`; `courts` has no spec file yet either — both are gaps to close as part of this work, not pre-existing coverage to preserve) to assert `venueId` is read from context, not the request body.
- Full suite (`npm run test -w api`) must stay green throughout; `npm run typecheck -w api` and `npm run build -w api` after the schema/client regeneration step.

## Open Questions — resolved 2026-09-19

These were product/priority calls, not engineering ones. All four answered by the user before implementation:

1. **Does `PATCH /venues/:id/publish` auto-flip the parent `Tenant.status` to `ACTIVE`?** → **Yes.** Recorded for whenever that endpoint is built — it remains out of scope for this pass (see Out of Scope), so this decision doesn't change what's implemented here, only how that future endpoint should behave.
2. **`TenantMember.venueId` required for `STAFF` — app-level or DB-level enforcement?** → **Deferred entirely.** No enforcement added in this pass, at either level — consistent with `TenantMember` having zero rows and no insertion code path today. Revisit when OWNER auto-assignment / the `TenantRolesGuard` work actually lands.
3. **Venue delete cascading into courts then hitting `CourtBooking`'s `Restrict` — leave as a generic conflict, or give it a clear venue-level error?** → **Add a clear error now.** `VenuesService.delete()` catches the same Prisma `P2003` pattern `CourtsService` already uses and returns a `409 ConflictException` with a venue-specific message (e.g. `"Cannot delete venue with active bookings"`), instead of letting the underlying court-level conflict surface as-is. Added to Module & Decorator Changes and Implementation Order below.
4. **Keep a `Tenant`-level identifier for future admin URLs, or drop it entirely?** → **Drop it entirely.** No slug or other identifier stays on `Tenant` in this pass; add one later if/when a tenant-level admin URL is actually needed (YAGNI).

## Out of Scope

- `TenantRolesGuard` / `@TenantRoles()` (Phase 3 access control) — tracked separately, not built here.
- `TenantMember` OWNER auto-assignment on tenant creation — separate known gap, not built here.
- The partial unique index needed to fully close the tenant-wide-membership duplication gap noted in Decisions above — deferred until OWNER auto-assignment is actually built, since nothing creates a `TenantMember` row yet.
- Any frontend (`apps/web`) changes — no UI consumes tenants/venues/courts today.
- Onboarding/setup wizard, pricing rules, venue schedules beyond the schema fields already listed.
- Backfilling or preserving existing test data through the migration.
- A `PATCH /venues/:id/publish` endpoint or any `Tenant`/`Venue` status-transition automation — Open Question 1 asks how that *would* behave if built later; nothing in this pass adds it.
