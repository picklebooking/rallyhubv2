# Open Play Design

## Goal

`CourtBooking.isOpenPlay` exists today, but it does nothing: it is a boolean the create-booking endpoint stores and nothing ever reads. On the web side, `apps/web/components/venues/open-play-cta.tsx` advertises "Browse open mixers", but the button goes nowhere.

This spec makes Open Play real. A booking marked Open Play gets a player capacity, a roster of confirmed seats (the original booker holds the first one), a non-guessable join link, and an optional public listing on a cross-venue discovery endpoint. Other players can then find the booking, or be sent its link, and reserve a seat to help fill the court.

The requirements come from the approved ticket (User Story + AC-01 to AC-08) and are restated in "Requirements Traceability" at the end. This spec doesn't reopen them. It only settles implementation-level choices.

Zero production data exists in the shared dev database, as in the venue-layer pass. That keeps the migration a single additive pass with no backfill.

## Decisions

- **Open Play state lives on `CourtBooking`, and roster seats get their own `OpenPlaySeat` model.** Capacity, the public-visibility flag, and the join token are 1:1 with a booking, so they go on `CourtBooking` next to the existing `isOpenPlay` flag. A separate 1:1 `OpenPlay` table would create a second source of truth for "is this booking Open Play". Seats are 1:N, so they get a real table.
- **`OpenPlaySeat` references `CourtBooking` only, not `Court`/`Venue`.** The composite `(courtId, venueId)` FK pattern guarantees that a row naming a court and a venue names a consistent pair. A seat names neither. It reaches its venue through its booking, and the booking already carries that guarantee. Adding a denormalized `venueId` to seats would bring a consistency obligation and nothing that needs it.
- **Leaving a seat hard-deletes the `OpenPlaySeat` row.** With no soft-delete status column, a plain `@@unique([bookingId, userId])` enforces "at most one active seat per user per booking" at the DB level. A soft-delete status would need a partial unique index, which Prisma's schema DSL can't express (the venue-layer spec hit the same limitation). Deleting the row also lets a player who left rejoin later, which AC-06 implies ("freeing a seat shall make a full booking joinable again").
- **Concurrency (AC-03): row lock via a conditional `updateMany`, inside a Prisma interactive `$transaction`.** Every seat-changing operation (join, leave, cancel, enable) starts with `tx.courtBooking.updateMany({ where: { id, ...preconditions }, data: { updatedAt: now } })`. A Postgres `UPDATE` takes a row lock that is held until commit, so concurrent operations on the same booking run one at a time. Under the default READ COMMITTED isolation, each later statement in the transaction (seat count, existing-seat check, insert) sees every seat the previous lock holder committed. The `where` clause also checks the preconditions atomically: `count === 0` means the booking stopped qualifying after the service's pre-read, which the service reports as a generic 409. This uses only Prisma's typed API (no `$queryRaw` / `FOR UPDATE`, which this repo has never used) and keeps no separate seat counter that could drift from the real number of rows. Confirmed seats are always `COUNT(OpenPlaySeat)`, read inside the lock with `tx.openPlaySeat.count({ where: { bookingId } })` (served by the `(bookingId, userId)` unique index), never with a relation `_count` select. `@@unique([bookingId, userId])` stays as a DB-level backstop against duplicate joins. The lock's `updateMany` `where` holds only scalar columns of `CourtBooking`, which is the shape verified to compile to a single conditional `UPDATE`. Relation-level preconditions (venue status) are re-checked right after the lock with a `tx.courtBooking.findFirst` that uses the full shared "joinable" builder (next decision); the row is already locked at that point, so the re-check is still atomic with the seat insert. Every interactive `$transaction` passes explicit `{ maxWait: 5_000, timeout: 10_000 }`, and the repository maps Prisma/Postgres failures to outcomes instead of letting them surface as 500s: `P2002` → `ALREADY_SEATED`, `P2003` → `NOT_JOINABLE`, and `P2028` (transaction timeout) / `P2034` / Postgres `40P01` (deadlock) → `BUSY`, which the service returns as a retry-able `409`.
- **"Viewable" and "joinable" are one shared `where` builder, used by discovery and by every join/view path.** `openPlayViewableWhere()` = `isOpenPlay = true AND isActive = true AND openPlayCapacity IS NOT NULL AND openPlayJoinToken IS NOT NULL AND userId IS NOT NULL AND court.venue.status = ACTIVE`. `openPlayJoinableWhere(now)` adds `bookDate > now`. Discovery uses the joinable builder plus `isOpenPlayPublic = true`. `GET /join/:token` and `POST /join/:token` read the booking through `findViewableByToken`, `POST /:bookingId/join` through `findViewableById`, and `joinSeat` re-checks the joinable builder under the lock. So a booking at a `SUSPENDED`/`INACTIVE`/`PENDING` venue, a cancelled booking, or a booking whose booker was deleted (`userId = null`) is hidden from discovery **and** can't be viewed or joined by id or token. Before this, only discovery checked venue status. The builder's scalar half (`openPlayLiveScalars()`) is what goes into the lock's `updateMany`; the venue clause is applied by the follow-up `findFirst`, as described above. Management routes (cancel, leave, enable, visibility, manage read) keep their unfiltered pre-read, because they need precise 403/409 messages and staff must still be able to see a booking at a suspended venue.
- **The join token is 32 URL-safe characters from `crypto.randomBytes(24).toString('base64url')` (192 bits), stored as plaintext in `CourtBooking.openPlayJoinToken @unique`.** It's a capability link that the booker and venue staff need to see again and share, so it can't be hashed. 192 bits makes guessing infeasible, so there's no regenerate-until-unique loop like `PNRHelper`'s. The unique constraint is the backstop. It lives in a new `OpenPlayTokenHelper` in `apps/api/src/helper/`, shaped like `PNRHelper`.
- **New sibling `OpenPlayModule` (`apps/api/src/open-play/`) for every post-creation operation. Create-time opt-in stays in `CourtBookModule`.** AC-01 lets the booking-create request mark Open Play, so `CreateCourtBookingDto` gains the fields and `CourtBookService.createBookingRoute` writes the booker's seat and the token in the same transaction as the booking. Discovery, join, leave, cancel, enable-on-existing, visibility, and the management read are a separate feature with their own auth rules (anonymous, booker, venue staff), so they get their own module. That follows the flat feature-module convention the venue-layer spec relied on.
- **Booking identity comes from the URL path, not from tenant/venue request context.** Open Play operations act on one booking by id (or by token). The venue whose staff may manage the booking is read from the booking itself (`booking.venueId`, and `court.venue.tenantId` for the tenant). It's never taken from `@CurrentVenue()`/`X-Venue-Id`, which a caller could point at their own venue while naming another tenant's booking.
- **Venue-staff authorization is a membership lookup inside `OpenPlayService`, not a `TenantRolesGuard`.** "Tenant Administrator/Staff of the booking's venue" means a `TenantMember` row with `userId = session user`, `tenantId = booking's tenant`, `role IN (OWNER, STAFF)`, and `venueId IS NULL OR venueId = booking.venueId`. That matches the `TenantMember.venueId` semantics in the venue-layer spec: null means tenant-wide, set means one venue. The general `TenantRolesGuard` (Phase 3) is still out of scope. This check stays narrow on purpose, so that guard can absorb it later. Nothing in the codebase creates `TenantMember` rows yet, so in practice the staff path is only exercised by test fixtures until onboarding or membership work lands.
- **"Original booker" means `CourtBooking.userId`.** The create flow resolves `userId` from the payload `email` (existing behavior), and the booker's seat is created for that user. A booking with `userId = null` (its user was deleted, `onDelete: SetNull`) can't be made Open Play on an existing booking (409), because there's no one to hold the first seat, and an existing Open Play booking whose booker was deleted drops out of discovery and stops being viewable or joinable (the shared builder requires `userId IS NOT NULL`). **When `isOpenPlay` is true on create, the payload `email` must equal the session user's email** (case-insensitive), or the request is rejected with `400`. The general "email must match session" check for private bookings stays deferred (see Out of Scope), but without this narrow guard an Open Play booking created for someone else's email would hand the creator a join token for a game whose booker seat, cancel rights, and management view all belong to another account.
- **Cancelling an Open Play booking soft-cancels it and frees the court slot.** Cancel sets `CourtBooking.isActive = false` and sets the matching `CourtSchedule` rows (same `referenceId` + `courtId`) to `isActive = false, isVacant = true`. `CourtBookRepository.hasConflictBooking` changes to only count schedule rows with `isVacant = false`. Without that change a cancelled booking would keep blocking its slot forever. The filter is on `isVacant` (non-nullable) on purpose, not `NOT: { isActive: false }`: `CourtSchedule.isActive` is `Boolean?`, and in SQL `NOT (NULL = false)` is `NULL`, so a schedule row with a null `isActive` would silently stop blocking its slot and become double-bookable. Create always writes `isVacant = false`, and cancel sets it to `true`. This is the one intentional behavior change to the existing private-booking path, and it only affects rows nothing can produce today. Seat rows on a cancelled booking are kept as history. They can't affect anything, because every seat operation requires `isActive = true`.
- **Discovery date filtering uses `from` / `to` ISO-8601 instants, not a bare `YYYY-MM-DD`.** Venues carry their own `timezone`. A server-side "date" would need a per-row timezone conversion or an assumed zone. The web page converts the date the user picks into local-midnight bounds and sends instants, and the API stays timezone-agnostic. `bookDate > now` is always applied on top of these bounds. Displayed start times, by contrast, are formatted in the venue's own `timezone` (exposed on `OpenPlayListing.venue.timezone`), with the zone abbreviation shown, so a game reads the same for every viewer regardless of their browser's zone.
- **The discovery listing exposes the booking `id`, and nothing else from the forbidden list.** A listing card needs an identifier to join from. The `id` is a UUID and isn't on AC-08's forbidden list. Joining by `id` only works for bookings that are currently public and viewable (`POST /v1/open-play/:bookingId/join` returns the identical 404 for unknown, non-viewable, and non-listed bookings, so their existence never leaks). Non-listed bookings can only be joined by token.
- **Capacity is set once, when the booking becomes Open Play.** The AC only says the creator sets it. No capacity-edit endpoint exists, so the case of a capacity dropping below the current seat count never comes up. The rule is a positive integer no larger than a product cap of 64 (`@IsInt() @Min(1) @Max(64)`, default 4, `MAX_OPEN_PLAY_CAPACITY` in `open-play.rules.ts`). The AC doesn't specify an upper bound, but without one a value past Postgres `Int` range turns into a 500, and no court holds more than a few dozen players.
- **Open Play can't be turned off once on.** The AC defines turning it on (create, or staff on an existing booking) and cancelling. It defines no "un-Open-Play" transition, so there isn't one.

## Schema Diff

Current (`apps/api/prisma/schema.prisma`, relevant parts):

```prisma
model User {
  // ...
  courtBookings  CourtBooking[]
  courtSchedules CourtSchedule[]
}

model CourtBooking {
  id          String    @id @default(uuid())
  venueId     String
  courtId     String
  userEmail   String
  userId      String?
  bookDate    DateTime
  createdAt   DateTime  @default(now())
  updatedAt   DateTime? @updatedAt
  isActive    Boolean?
  referenceId String    @unique
  isOpenPlay  Boolean
  totalPrice  Decimal?  @db.Decimal(10, 2)
  isPaid      Boolean   @default(false)

  court Court @relation(fields: [courtId, venueId], references: [id, venueId], onDelete: Restrict)
  user  User? @relation(fields: [userId], references: [id], onDelete: SetNull)

  @@index([courtId, venueId])
  @@index([userEmail])
  @@index([userId])
  @@index([isActive])
}
```

Proposed:

```prisma
model User {
  // ...
  courtBookings  CourtBooking[]
  courtSchedules CourtSchedule[]
  openPlaySeats  OpenPlaySeat[]   // NEW back-relation
}

model CourtBooking {
  id          String    @id @default(uuid())
  venueId     String
  courtId     String
  userEmail   String
  userId      String?
  bookDate    DateTime
  createdAt   DateTime  @default(now())
  updatedAt   DateTime? @updatedAt
  isActive    Boolean?
  referenceId String    @unique
  isOpenPlay  Boolean
  totalPrice  Decimal?  @db.Decimal(10, 2)   // unchanged — still booker-only (AC-05)
  isPaid      Boolean   @default(false)      // unchanged — still booker-only (AC-05)

  // Open Play (all null/false while isOpenPlay = false)
  openPlayCapacity  Int?                      // NEW — total seats incl. the booker's; set when isOpenPlay flips true
  isOpenPlayPublic  Boolean @default(false)   // NEW — listed on discovery; only settable while isOpenPlay = true
  openPlayJoinToken String? @unique           // NEW — 32-char base64url capability token

  court         Court          @relation(fields: [courtId, venueId], references: [id, venueId], onDelete: Restrict)
  user          User?          @relation(fields: [userId], references: [id], onDelete: SetNull)
  openPlaySeats OpenPlaySeat[] // NEW

  @@index([courtId, venueId])
  @@index([userEmail])
  @@index([userId])
  @@index([isActive])
  @@index([isOpenPlay, isOpenPlayPublic, isActive, bookDate])   // NEW — discovery query
  @@index([venueId, bookDate])                                  // NEW — venue-filtered discovery (existing index is courtId-leading)
}

// NEW — one confirmed roster seat on an Open Play booking.
model OpenPlaySeat {
  id        String   @id @default(uuid())
  bookingId String
  userId    String
  isBooker  Boolean  @default(false)   // true only for the original booker's seat
  createdAt DateTime @default(now())

  // Cascade: seats are meaningless without their booking (and CourtBooking
  // deletes are already Restrict-guarded through Court, so this only fires
  // on an explicit booking delete).
  booking CourtBooking @relation(fields: [bookingId], references: [id], onDelete: Cascade)
  // Cascade: a deleted user's seat frees up. No counter exists, so nothing
  // drifts — confirmed seats are always COUNT(*).
  user    User         @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@unique([bookingId, userId])   // one active seat per user per booking (AC-04)
  @@index([userId])
}
```

**App-enforced invariant (not DB-enforced):** `isOpenPlay = true` ⇔ `openPlayCapacity IS NOT NULL AND openPlayJoinToken IS NOT NULL`, and `isOpenPlayPublic = true` ⇒ `isOpenPlay = true`. A Postgres `CHECK` constraint could enforce this, but Prisma's schema DSL can't declare one, and this repo doesn't hand-edit migration SQL. Every write path that sets these fields lives in `CourtBookService` and `OpenPlayService`, and both enforce the invariant. Any existing dev rows with `isOpenPlay = true` and a null capacity or token are treated as not joinable and are excluded from discovery: the shared viewable/joinable builder filters `openPlayCapacity: { not: null }` and `openPlayJoinToken: { not: null }` (and `userId: { not: null }`). No backfill.

## Migration Approach

One additive migration through the `migration-writer` subagent, per standing convention. No hand-written SQL, and nothing applied without an explicit ask. The human generates the migration **without applying it** first, reviews the SQL, and only then applies it:

```bash
cd apps/api && npx prisma migrate dev --create-only --name add_open_play
# review apps/api/prisma/migrations/<timestamp>_add_open_play/migration.sql:
# it must contain only ADD COLUMN / CREATE TABLE / CREATE INDEX / ADD CONSTRAINT
cd apps/api && npx prisma migrate dev
npm run db:generate -w api
```

`--create-only` matters because this runs against the shared dev database: a bare `prisma migrate dev` that detects drift offers to reset the database, and a reflexive "yes" wipes everyone's data. Generating first lets the human see drift (and the exact SQL) before anything touches the DB.

Contents, all additive: three nullable or defaulted columns on `CourtBooking`, the unique index on `openPlayJoinToken`, the discovery composite index, the `(venueId, bookDate)` index, the `OpenPlaySeat` table with its two FKs, and the `(bookingId, userId)` unique index. No column drops or type changes, so the migration is safe even against the existing throwaway dev rows.

## API Surface

All new routes are URI-versioned under `/v1/open-play` (`MainRoute.MAIN_ROUTE.OPEN_PLAY = 'open-play'`, same `@Controller({ path, version })` shape as `CourtBookController`). Better Auth's global guard already requires a session everywhere. The two public reads opt out with the library's `@AllowAnonymous()` / `@OptionalAuth()` (both exported by `@thallesp/nestjs-better-auth`). Authenticated routes read the user with `@Session() session: UserSession` (`session.user.id`), as `UsersController.getCurrentUser` does. On the `@OptionalAuth()` route the parameter is typed `UserSession | null`, because Better Auth sets `request.session` to `null` (not `undefined`) when there's no session.

### Changed: `POST /v1/booking/create-booking` (`CourtBookModule`)

`CreateCourtBookingDto` gains:

| Field | Validation | Meaning |
|---|---|---|
| `openPlayCapacity?: number` | `@IsOptional() @IsInt() @Min(1) @Max(64)` | Seats including the booker's. Defaults to 4 when `isOpenPlay` is true and this is omitted. |
| `isOpenPlayPublic?: boolean` | `@IsOptional() @IsBoolean()` | Public listing. Defaults to `false`. |

Service rules:

- `isOpenPlay = false` with `openPlayCapacity` present, or with `isOpenPlayPublic = true`, returns `400 BadRequestException`. A private booking stays exactly as it is today (AC-01, AC-02).
- `isOpenPlay = true` and the payload `email` doesn't match the session user's email (case-insensitive) returns `400 BadRequestException`. `CourtBookController.createBooking` now reads `@Session() session: UserSession` and passes `session.user.email` to `createBookingRoute` as a third argument. Private bookings skip this check (the general gap stays deferred).
- `isOpenPlay = true`: generate a token with `OpenPlayTokenHelper`, persist `openPlayCapacity` (default 4) / `isOpenPlayPublic` / `openPlayJoinToken` on the booking, and create the booker's `OpenPlaySeat` (`isBooker: true`) as a nested create on the booking. This happens inside the existing `$transaction` in `CourtBookRepository.createCourtBooking`, so the booking and its first seat are written atomically. `createCourtBooking` now returns the created booking's `id`.
- The response (`CreateBookingResponse`, which now `implements` the shared `CreateCourtBookingResponse` so the two can't drift) gains `bookingId?: string` and `openPlayJoinToken?: string`, both present only for Open Play bookings. The token is how the creator first gets the share link. The `bookingId` is how they reach the management routes (`GET /:bookingId`, `PATCH /:bookingId/visibility`, `POST /:bookingId/cancel`): there is no lookup by reference id and no "my bookings" list, so without it in the create response the only way to recover the id would be the `listing.id` on the token page.

Both a Customer and a staff member call this same endpoint at creation time. AC-01 lets either one opt in at creation, so this endpoint needs no role check. A staff member creating an Open Play booking *for a customer* is therefore not possible at create time (the email guard rejects it); staff do that with `PATCH /:bookingId/enable` on the customer's private booking.

### New: `OpenPlayController`

| Method & path | Auth | Who | Purpose (AC) |
|---|---|---|---|
| `GET /v1/open-play` | `@AllowAnonymous()` | anyone | Discovery listing (AC-07) |
| `GET /v1/open-play/join/:token` | `@OptionalAuth()` | anyone holding the token | View a booking via its link, plus viewer state when signed in (AC-02, AC-04) |
| `POST /v1/open-play/join/:token` | session | any signed-in user | Join via link, regardless of visibility (AC-04) |
| `POST /v1/open-play/:bookingId/join` | session | any signed-in user | Join from the listing. 404 unless publicly listed (AC-04) |
| `DELETE /v1/open-play/:bookingId/seat` | session | a non-booker seat holder | Leave (AC-06) |
| `POST /v1/open-play/:bookingId/cancel` | session | original booker | Cancel the whole booking (AC-06) |
| `PATCH /v1/open-play/:bookingId/enable` | session | venue staff | Mark an existing booking Open Play (AC-01) |
| `PATCH /v1/open-play/:bookingId/visibility` | session | booker or venue staff | Toggle `isOpenPlayPublic` (AC-02) |
| `GET /v1/open-play/:bookingId` | session | booker or venue staff | Management read: token and roster names |

**`GET /v1/open-play`** takes `ListOpenPlayQueryDto`: `venueId?` (`@IsUUID`), `from?` / `to?` (`@IsISO8601`), `page?` (`@Type(() => Number) @IsInt() @Min(1)`, default 1), `pageSize?` (`@IsInt() @Min(1) @Max(50)`, default 20). It filters on `openPlayJoinableWhere(now)` (see Decisions: `isOpenPlay`, `isActive`, capacity and token set, `userId IS NOT NULL`, `court.venue.status = ACTIVE`, `bookDate > now`) plus `isOpenPlayPublic = true`, the optional `venueId`, and `from ≤ bookDate < to`. Results are ordered by `bookDate asc, id asc`. `findMany` and `count` run with a plain `Promise.all`: an array `$transaction` gives no consistency benefit under READ COMMITTED (each statement takes its own snapshot) and only adds round-trips on a hot anonymous path. Seat counts are fetched afterwards for just the page's ids with `openPlaySeat.groupBy({ by: ['bookingId'], where: { bookingId: { in: pageIds } } })`, never with a relation `_count` select (which Prisma compiles to an aggregate over the whole `OpenPlaySeat` table that `LIMIT` can't be pushed into). Full bookings stay in the list with `isFull: true` (AC-07).

**`PATCH /:bookingId/enable`** takes a body of `{ capacity?: number; isPublic?: boolean }` (same validation, including `@Max(64)`, and defaults as at create). It requires `isActive = true`, `bookDate > now`, `isOpenPlay = false`, and `userId != null`. Inside one transaction it sets the three Open Play fields, creates the booker's seat, and returns the management view, including the token so staff can share it.

**`PATCH /:bookingId/visibility`** takes a body of `{ isPublic: boolean }`. It requires `isOpenPlay = true` (otherwise `409` per AC-02 "shall reject") and `isActive = true`.

**`POST /:bookingId/cancel`** requires the caller to be the booker, `isOpenPlay = true`, `isActive = true`, and `now < bookDate`. Inside the 24-hour window (`now > bookDate − 24h`) it's rejected if any non-booker seat exists. Outside the window it's always allowed (AC-06). Rejecting cancellation after the start time is a judgment call: cancelling a game that has already started has no meaning.

**`DELETE /:bookingId/seat`** requires the caller to hold a non-booker seat, `isActive = true`, and `now ≤ bookDate − 24h`. The booker can't "leave" their own booking; they get a `409` pointing them to cancel.

**Join (both routes)** requires the booking to match `openPlayJoinableWhere(now)` (which includes an ACTIVE venue and a non-null booker), the caller not already seated, and confirmed seats `< capacity`. The by-id route additionally requires `isOpenPlayPublic = true`. On success it creates an `OpenPlaySeat` with `isBooker: false` and returns immediately. There's no pending state and no payment step (AC-04, AC-05). **`GET /join/:token`** returns 404 unless the booking matches `openPlayViewableWhere()`, so a cancelled game, a game at a non-ACTIVE venue, and a game whose booker was deleted all read as "not found" on both the view and the join-by-token route.

### Response shaping (AC-08)

The repository uses explicit Prisma `select`s on every Open Play read, never a bare `findMany`/`findUnique` returning the whole row. The service maps results through explicit mapper functions (`toOpenPlayListing`, `toOpenPlayManageView`) into `@workspace/shared` types. The public shapes (`OpenPlayListing`, `OpenPlayByTokenResponse`) never contain `userEmail`, `userId`, `referenceId`, `isPaid`, `totalPrice`, `openPlayJoinToken`, `tenantId`, or roster identities. The management view (booker or staff only) adds the token and the roster's display names, with no emails and no user ids.

### Operational notes

- **Rate limiting behind the proxy.** `ThrottlerGuard` is global and keys on `req.ip`. `apps/api/src/main.ts` does not configure Express `trust proxy`, so when the API sits behind the Next.js proxy (or any load balancer) every request arrives from the proxy's address and all anonymous traffic shares one bucket. With the default `RATE_LIMIT_MAX = 100` per minute, the public `/open-play` page (`GET /v1/open-play` + `GET /v1/open-play/join/:token`) can then return false `429`s to unrelated users under ordinary load. Before the discovery page is promoted, ops must either create the app as `NestFactory.create<NestExpressApplication>(…)` and call `app.set('trust proxy', <exact hop count>)` (never `true`, which lets clients spoof `X-Forwarded-For`), or give the throttler a custom tracker that reads the client address from a trusted `X-Forwarded-For` hop. This spec doesn't change `main.ts`; it flags the risk so it isn't lost. The plan's Task 13 carries it into the final report.

## Service & Repository Layout

```
apps/api/src/
  constants/
    routes.constant.ts          (+ MAIN_ROUTE.OPEN_PLAY)
    error-code.constant.ts      (+ OPEN_PLAY_MESSAGES)
  helper/
    open-play-token.helper.ts   (NEW — OpenPlayTokenHelper.generate(): string)
  court-book/                   (create-time opt-in + Open Play email guard; conflict check only counts isVacant = false schedules)
  open-play/                    (NEW)
    open-play.module.ts
    open-play.controller.ts
    open-play.service.ts
    open-play.repository.ts
    open-play.rules.ts          (pure functions + constants: default capacity, 24h cutoff)
    dto/
      list-open-play-query.dto.ts
      enable-open-play.dto.ts
      set-open-play-visibility.dto.ts
      index.ts
```

**`open-play.rules.ts`** is pure and takes `now` as a parameter, so tests need no fake timers. It holds `DEFAULT_OPEN_PLAY_CAPACITY = 4`, `MAX_OPEN_PLAY_CAPACITY = 64`, `OPEN_PLAY_CUTOFF_MS = 24 * 60 * 60 * 1000`, `hasStarted(bookDate, now)`, `isInsideCutoff(bookDate, now)`, and `isFull(confirmedSeats, capacity)`.

**`OpenPlayRepository`** holds all the Prisma access, and exports the shared `openPlayLiveScalars()` / `openPlayViewableWhere()` / `openPlayJoinableWhere(now)` builders. Its seat-mutating methods run the locked transaction described under Decisions and return a discriminated-union outcome, for example `{ kind: 'JOINED'; confirmedSeats; capacity } | { kind: 'NOT_JOINABLE' } | { kind: 'FULL' } | { kind: 'ALREADY_SEATED' } | { kind: 'BUSY' }`. They never throw HTTP exceptions, and they catch the Prisma error codes listed under Decisions and turn them into outcomes; anything else is rethrown. Booking records carry a plain `confirmedSeats: number` (from `count`/`groupBy`), never a relation `_count`. The capacity comparison happens inside the transaction because it has to happen under the lock. That's the one place where a business rule sits in the repository, and the method's JSDoc says why.

**`OpenPlayService`** maps outcomes to HTTP exceptions and does the authorization (`assertIsBooker`, `assertCanManage` = booker or staff, `assertIsStaff`) through `OpenPlayRepository.hasVenueStaffMembership(userId, tenantId, venueId)`. It also does all response shaping. Before calling a locked repository method, the service pre-reads the booking (outside the lock) for authorization and for the precise 404/403/409 message. The locked method then re-checks the same preconditions atomically. If the booking changed between the pre-read and the lock (a lost race), the result is a generic `409` "no longer available" message.

**`OpenPlayModule`** provides the controller, service, repository, and `OpenPlayTokenHelper`. `CourtBookModule` also needs `OpenPlayTokenHelper`, and lists it in its own `providers` the same way it already lists `PNRHelper`/`DateTimeHelper`, since the helper is stateless. Register `OpenPlayModule` in `AppModule`.

## Error Handling

| Condition | Status | Notes |
|---|---|---|
| DTO validation (capacity non-positive, non-integer, or over 64; bad UUID/ISO; `pageSize > 50`) | 400 | Global `ValidationPipe` |
| Create with capacity / `isOpenPlayPublic: true` but `isOpenPlay: false` | 400 | `CourtBookService` |
| Create with `isOpenPlay: true` and a payload `email` that isn't the session user's | 400 | `CourtBookService` |
| No session on an authenticated route | 401 | Better Auth global guard |
| Not the booker (cancel), not booker or staff (visibility, manage read), not staff (enable) | 403 | |
| Unknown booking id or token. Not Open Play on join, leave, cancel, or manage. Join-by-id on a non-public booking. View or join (by id or token) of a booking that isn't viewable: cancelled, venue not ACTIVE, or booker deleted | 404 | See the scope note below |
| Full; already seated; start time passed; booking inactive (on management routes); inside 24h cutoff (leave, or cancel with other players); visibility on a non-Open-Play booking; enable on an already-Open-Play booking; enable with `userId = null`; booker trying to "leave"; transaction busy/timed out/deadlocked (`BUSY`, retry-able) | 409 | Distinct messages in `ErrorConstant.OPEN_PLAY_MESSAGES` |

Status codes match existing usage (`ConflictException` for state conflicts, `NotFoundException` for misses). There's no 422 or 503, because nothing else in the repo uses them.

**Scope of the "same 404" guarantee.** The guarantee that "doesn't exist" and "not visible to you" produce the identical 404 applies to **`POST /:bookingId/join` only**. That is the route where it matters for AC-08: the listing exposes ids, and a non-listed booking's existence must not leak through it. The authenticated management routes (`GET /:bookingId`, `visibility`, `enable`, `cancel`, `leave`) intentionally do not make that promise. They may answer 403 for an existing booking you can't manage, 404 for an unknown one, and `leave` uses one 404 message for "no such game" and another for "no seat". Booking ids are UUIDs, so this doesn't enable practical enumeration, and the precise messages help the legitimate caller. The token routes are consistent with each other: `GET` and `POST /join/:token` both 404 for any non-viewable booking (including cancelled).

## `@workspace/shared` Contracts

New `packages/shared/api/open-play.d.ts`, re-exported from `packages/shared/index.d.ts`:

```ts
export type OpenPlayListing = {
  id: string
  startsAt: string               // ISO
  venue: { id: string; name: string; slug: string; city: string | null; timezone: string }   // IANA zone, e.g. "Asia/Manila"
  court: { id: string; name: string }
  capacity: number
  confirmedSeats: number
  isFull: boolean
}

export type ListOpenPlayQuery = {
  venueId?: string
  from?: string                  // ISO instant, inclusive
  to?: string                    // ISO instant, exclusive
  page?: number
  pageSize?: number
}

export type ListOpenPlayResponse = {
  items: OpenPlayListing[]
  page: number
  pageSize: number
  total: number
}

export type OpenPlayViewerState = {
  hasSeat: boolean
  isBooker: boolean
}

export type OpenPlayByTokenResponse = {
  listing: OpenPlayListing
  isPublic: boolean
  viewer: OpenPlayViewerState | null   // null when not signed in
}

export type JoinOpenPlayResponse = {
  bookingId: string
  confirmedSeats: number
  capacity: number
  isFull: boolean
}

export type EnableOpenPlayRequest = { capacity?: number; isPublic?: boolean }
export type SetOpenPlayVisibilityRequest = { isPublic: boolean }

export type OpenPlayRosterEntry = { name: string; isBooker: boolean; joinedAt: string }

export type OpenPlayManageResponse = {
  listing: OpenPlayListing
  isPublic: boolean
  isActive: boolean
  joinToken: string
  roster: OpenPlayRosterEntry[]
}
```

New `packages/shared/api/court-book.d.ts` (the create-booking contract isn't in `shared` today; the web needs it for the booking-panel schema):

```ts
export type CreateCourtBookingRequest = {
  date: string
  email: string
  courtId: string
  rentDuration: number
  isOpenPlay: boolean
  openPlayCapacity?: number
  isOpenPlayPublic?: boolean
}

export type CreateCourtBookingResponse = {
  statusCode?: number
  message?: string
  bookingReferenceID?: string
  bookingId?: string             // Open Play only — needed for the management routes
  openPlayJoinToken?: string     // Open Play only
}
```

The API's `CreateBookingResponse` class declares `implements CreateCourtBookingResponse` (type-only import), so a field added on one side and not the other fails `typecheck -w api`.

## Frontend Surface (`apps/web`)

The venue pages are public, mock-data pages (`/venues`, `/venues/[slug]`). Open Play's public pages sit beside them, outside `(protected)`, and use the same `AuthHeader` + `LandingFooter` shell as `VenuesPage`.

```
apps/web/
  app/open-play/page.tsx                       (thin → <OpenPlayPage />)
  app/open-play/join/[token]/page.tsx          (thin → <OpenPlayJoinPage token={...} />)
  components/open-play/
    open-play-page.tsx                         (shell + intro + filters + list + pagination)
    open-play-intro.tsx                        (eyebrow / font-heading title / muted description)
    open-play-filters.tsx                      (date Input + active-venue chip; state lives in URL search params)
    open-play-list.tsx                         (loading Skeletons / error Alert / Empty / cards)
    open-play-card.tsx                         (venue, court, start time, "n / capacity" + Full badge, Join)
    open-play-join-page.tsx                    (token view; join/leave; booker controls)
    open-play-booker-controls.tsx              (visibility Switch, copy-link Button, cancel Button)
  components/venue-detail/
    open-play-booking-options.tsx              (NEW — RHF fields: Open Play Switch, capacity Input, public Switch)
    booking-panel.tsx                          (renders the options section)
  components/venues/open-play-cta.tsx          ("Browse open mixers" → <Link href="/open-play">)
  lib/api/open-play.ts                         (Axios wrappers via apiClient)
  lib/validations/open-play.ts                 (Zod: openPlayBookingOptionsSchema, visibilitySchema)
  hooks/open-play/
    use-open-play-listings.ts                  (useQuery, key ["open-play", "list", query])
    use-open-play-by-token.ts                  (useQuery, key ["open-play", "token", token])
    use-open-play-mutations.ts                 (join-by-id, join-by-token, leave, cancel, set-visibility;
                                                each invalidates ["open-play"])
```

- **Discovery (`/open-play`)**: filters live in the URL (`?date=YYYY-MM-DD&venueId=…&page=n`), so filtered views can be shared. The date input converts to local-midnight `from`/`to` instants before calling the API. Venue filtering is chip-based: clicking a card's venue name sets `venueId`, and a dismissible "Venue: X" chip clears it. A venue `<Select>` would need a public venue list, and `GET /venues` isn't public (it's behind the global guard and returns non-ACTIVE venues), so making it public is out of scope. Pagination is a "Page n of m" label with Previous/Next `@workspace/ui` `Button`s that update the `page` search param through `router.replace`. The `Pagination` primitive isn't used: its `PaginationLink` is an `href` anchor, and page state here is router-driven alongside the other filters. Every query-backed section renders explicit `isPending` / error / empty states. Start times are formatted in `listing.venue.timezone` with the zone abbreviation, not the browser's zone.
- **Joining**: `authClient.useSession()` decides the CTA. Signed out: "Sign in to join" links to `/sign-in`. (Sign-in currently always lands on `/dashboard`, and adding a return-to parameter is out of scope.) Signed in: a "Join" mutation, which on 409 shows the server message with a `sonner` toast and refetches. Full bookings show a disabled "Full" button.
- **Join link (`/open-play/join/[token]`)**: the route reads the token with `useParams`. Because the token is in the URL, the route exports `metadata` with `robots: { index: false, follow: false }` and `referrer: "no-referrer"`, so search engines don't index invite links and the token isn't sent to third parties in a `Referer` header. It renders the listing from `OpenPlayByTokenResponse`. If `viewer.isBooker`, it shows `OpenPlayBookerControls`: a public-listing `Switch` (visibility mutation), "Copy invite link" (built from `window.location`; `navigator.clipboard.writeText` is wrapped in try/catch, and a failure shows an error toast telling the user to copy the address bar instead), and "Cancel booking" behind a confirm `Dialog`. If `viewer.hasSeat && !isBooker`, it shows "Leave". Otherwise it shows Join. Inside the 24-hour window, Leave and Cancel stay enabled and the server message explains a rejection. The client doesn't duplicate the cutoff rule.
- **Booking panel**: `BookingPanel` is static mock data today, and its "Reserve court" button calls no API. This spec adds `OpenPlayBookingOptions`, a React Hook Form section validated by `openPlayBookingOptionsSchema` (capacity a whole number from 1 to 64, default 4; the public toggle disabled unless Open Play is on), typed against `CreateCourtBookingRequest`. The capacity error renders through `FieldError` from `@workspace/ui/components/field` with an `id`, and the input points at it with `aria-describedby` and `aria-invalid`. Wiring the panel's submit to `POST /v1/booking/create-booking` belongs to the separate booking-flow work that replaces the mock slots with real courts and dates, and is out of scope here. Once that lands, these fields drop straight into the payload.
- **CTA**: "Browse open mixers" becomes `<Button asChild><Link href="/open-play">…</Link></Button>`. The "Rating guide" button and the CTA's existing copy are unchanged.
- **Styling**: shared tokens and `@workspace/ui` primitives only (`Card`, `Badge`, `Button`, `Switch`, `Input`, `Label`, `Field`/`FieldError`, `Skeleton`, `Empty`, `Alert`, `Dialog`, `sonner`), checked in light and dark mode. No native `<button>`: the venue chip's clear control is a `Button variant="ghost" size="icon-xs"`. All are already present in `packages/ui`, so no `shadcn add` is needed. The intro follows the protected-page heading pattern (muted eyebrow, `font-heading text-3xl font-semibold tracking-normal md:text-4xl`) for consistency, even though the page is public.

No admin/staff UI for Open Play is built. No staff booking-management screen exists in `apps/web` yet, so staff use the API (`enable`, `visibility`, management read) until one does.

## Implementation Order

1. Schema change through `migration-writer`. A human generates the migration with `--create-only`, reviews it, applies it, and regenerates the client.
2. `@workspace/shared` contracts (`open-play.d.ts`, `court-book.d.ts`, index re-exports).
3. `OpenPlayTokenHelper`, `open-play.rules.ts`, route/message constants.
4. `CourtBookModule`: create-time Open Play fields, Open-Play email/session guard, booker seat, `bookingId` + token in the response; `hasConflictBooking` only counts `isVacant = false` schedules.
5. `OpenPlayRepository` (shared viewable/joinable builders, discovery query with scoped seat counts, token/id reads, locked join/leave/cancel/enable transactions with error mapping, visibility update, staff-membership lookup).
6. `OpenPlayService` (authorization, rules, outcome→exception mapping, response shaping).
7. `OpenPlayController` + DTOs + `OpenPlayModule` + `AppModule` registration.
8. DB-backed integration spec (concurrency, constraints, discovery exposure).
9. Web: API wrappers, Zod schemas, TanStack Query hooks.
10. Web: `/open-play` discovery page + CTA link.
11. Web: `/open-play/join/[token]` page + booker controls.
12. Web: `OpenPlayBookingOptions` in the booking panel.
13. Confirm the client was regenerated (human-run), then typecheck, test, and build both apps. Do a live end-to-end run against the dev DB. Report the trust-proxy note from Operational notes.

## Testing Approach (TDD)

Jest specs under `apps/api/src/**`, written first, mirroring the existing `*.spec.ts` structure (`@jest/globals`, hand-built `jest.Mocked<…>` repositories):

- **`open-play.rules.spec.ts`**: exact boundaries. `bookDate − 24h` exactly is allowed, one millisecond later is inside the window, and `hasStarted` at equality. `isFull` at `capacity − 1`, `capacity`, and capacity 1 (booker-only means full immediately).
- **`open-play-token.helper.spec.ts`**: 32 characters, `[A-Za-z0-9_-]` only, two calls differ.
- **`court-book.service.spec.ts`** (extend): an Open Play create passes the token, capacity (defaulting to 4), public flag, and booker seat to the repository, and the response carries `bookingId` and `openPlayJoinToken`. An Open Play create whose payload email isn't the session email gets 400 (and a case-only difference is accepted). A private create with capacity or public set gets 400. A private create is unchanged (no token, no seat, no `bookingId`/token in the response, and no email check).
- **`court-book.controller.spec.ts`** (extend): `createBooking` forwards `session.user.email` as the third argument.
- **DTO validation spec** (`class-validator` `validate()` on `CreateCourtBookingDto`, `EnableOpenPlayDto`, `ListOpenPlayQueryDto`): capacity values 0, −1, 2.5, 65, and `"4"` are rejected, and 1 and 64 are accepted. Also `pageSize` 51 and a bad `from`.
- **`court-book.repository.spec.ts`** (new, mocked Prisma): `hasConflictBooking`'s `where` filters `isVacant: false`. The Open Play create includes the nested seat create, and the method returns the created booking id.
- **`open-play.service.spec.ts`**: every row of the error table, for each route. Authorization covers booker vs. staff vs. a stranger, and `enable`/`setVisibility` from staff of another tenant (membership mock keyed on the tenant id) return 403 with the lookup made against the booking's own tenant and venue. View/join routes 404 when the viewable read returns null. `BUSY` outcomes map to 409. AC-08 shaping uses a deep key scan of mapper output, asserting none of `userEmail`, `userId`, `referenceId`, `isPaid`, `totalPrice`, `openPlayJoinToken`, `joinToken`, `tenantId` appear in listing or by-token responses.
- **`open-play.repository.spec.ts`** (mocked Prisma): the shared builders' exact contents; the discovery `where`/`select`/`orderBy`/`skip`/`take` shape, that it doesn't use `$transaction`, and that seat counts come from a `groupBy` scoped to the page's ids; that the `select` doesn't request forbidden columns or `_count`; the lock's scalar `where` plus the joinable `findFirst` re-check; explicit `{ maxWait, timeout }` on every interactive transaction; and the Prisma error mapping (`P2002`, `P2003`, `P2028`, deadlock, and an unknown error being rethrown).
- **`open-play.controller.spec.ts`**: route wiring, `session.user.id` forwarding (and `null` when signed out), query DTO pass-through.
- **`open-play.integration.spec.ts`** (real DB, `describeIfDb` on `TEST_DATABASE_URL`, same fixture and cleanup style as `court-book.integration.spec.ts`; repository built over a `{ db } as PrismaService` stub):
  - Capacity 2 (booker + 1), **eight** different users join concurrently with `Promise.all` (under the default pool size of 10): exactly one `JOINED`, seven `FULL`, and the seat count ends at 2. Two concurrent transactions rarely interleave inside the race window, so a two-way race could pass with the lock removed.
  - The same user joins twice concurrently: one `JOINED`, one `ALREADY_SEATED`, and a direct duplicate insert raises `P2002`.
  - Join vs. cancel inside the 24h window with the booker alone, raced several times: each run ends either "cancelled, no non-booker seat" or "`OTHER_PLAYERS`, booking active, seat intact", never a cancelled booking holding a non-booker seat.
  - A join on an already-cancelled booking returns `NOT_JOINABLE`.
  - A leave on a full booking makes it joinable again.
  - Discovery excludes non-public, inactive, past, non-ACTIVE-venue (`PENDING` and `SUSPENDED`), and booker-deleted bookings and keeps full ones with the right `confirmedSeats`. A raw-row key scan finds no forbidden fields. The same `SUSPENDED`-venue and booker-deleted bookings are `null` from `findViewableByToken`/`findViewableById` and `NOT_JOINABLE` from `joinSeat`.
  - Cancel sets `booking.isActive = false` and the schedule rows to `isActive = false, isVacant = true`, and `hasConflictBooking` then reports the slot free. A schedule row with `isActive = NULL, isVacant = false` still blocks its slot.
  - Staff authorization against real `TenantMember` rows: OWNER (`venueId = null`), STAFF of the booking's venue, STAFF of another venue in the same tenant, STAFF of another tenant, and a CUSTOMER resolve to `true`, `true`, `false`, `false`, `false`.
- **Web**: `apps/web` has no component test runner, so verification is `npm run typecheck -w web`, `npm run build -w web`, and a manual light/dark pass over `/open-play`, the join page, and the booking panel (plus the `ui-consistency-checker` agent).

Full gates: `npm run test -w api`, `npm run typecheck -w api`, `npm run build -w api`, `npm run typecheck -w web`, `npm run build -w web`.

## Requirements Traceability

| AC | Where satisfied |
|---|---|
| AC-01 Marking | Create DTO fields (anyone at creation); `PATCH /:id/enable` (staff, existing); private bookings unchanged, and join requires `isOpenPlay` |
| AC-02 Visibility & link | `isOpenPlayPublic` default false; `PATCH /:id/visibility` (booker or staff, 409 if not Open Play); `openPlayJoinToken` + `/join/:token` routes; discovery filters on `isOpenPlayPublic` |
| AC-03 Capacity | `openPlayCapacity` default 4, includes the booker seat, `@IsInt @Min(1) @Max(64)`; locked transaction for last-seat races, proven by an 8-way concurrent join test |
| AC-04 Joining | Both join routes; immediate `OpenPlaySeat`; booker seat created when Open Play turns on; `@@unique([bookingId, userId])` + in-lock check |
| AC-05 Cost (deferred) | No pricing or payment fields or logic added; `totalPrice` / `isPaid` untouched |
| AC-06 Leave / cancel / cutoff | `DELETE /:id/seat`, `POST /:id/cancel`, `open-play.rules.ts` cutoff; leave deletes the row, so the booking is joinable again |
| AC-07 Discovery | `GET /v1/open-play` (anonymous, filters, pagination, full kept and flagged) |
| AC-08 Isolation & exposure | Venue/tenant read from the booking, never from request context; `TenantMember` staff check (exercised against real rows in the integration spec); booker check; shared viewable/joinable builder on every view/join path; explicit selects + mappers + key-scan tests |

## Out of Scope

- Cost or payment splitting, per-seat shares, per-seat `isPaid` (AC-05, deferred).
- `TenantRolesGuard` / `@TenantRoles()` and `TenantMember` creation or onboarding. The staff check here only reads existing rows.
- Wiring `BookingPanel` (or any web flow) to the real create-booking endpoint. Replacing the mock venue and booking data with API data.
- A staff/admin Open Play UI, a "my Open Play bookings" list, notifications, waitlists, skill/rating matching, and the CTA's "Rating guide".
- Changing capacity after creation, turning Open Play off, regenerating or revoking join tokens.
- Cancelling non-Open-Play bookings, and staff-initiated cancellation or removal of players.
- Checking that a **private** booking's `email` matches the session user on create (a pre-existing gap in `CourtBookService`). Consequence: any signed-in user can still create a private booking in someone else's name, and that person becomes `userId`. If staff later enable Open Play on it, the named person (not the creator) is the booker. This spec closes only the Open Play half (create with `isOpenPlay: true` requires a matching email).
- A return-to parameter on `/sign-in`, and making `GET /venues` public. Consequence: a signed-out invitee who opens a join link, clicks "Sign in to join", and signs in lands on `/dashboard` and has lost the link; they must reopen it from wherever it was shared.
- Fixing `trust proxy` / the throttler tracker in `main.ts` (flagged under Operational notes for ops, not changed here).
- A DB `CHECK` constraint for the Open Play field invariant (Prisma DSL limitation, enforced in the app).
