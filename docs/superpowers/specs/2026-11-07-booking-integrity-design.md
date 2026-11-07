# Booking integrity: atomic reservations, per-venue booking rules, booking ownership, bookability

Date: 2026-11-07
Branch: `fix/system-audit-remediation` (PR #34)
Source: `docs/SYSTEM-AUDIT-2026-11-07.md`, findings **#3**, **#4**, **#5**, **#6** ("Group A: booking integrity")
Status: awaiting product-owner approval. Do not commit until approved.

Decisions are labelled by who made them: **(product owner)** means the user decided it; *(Claude's call)* means the designer chose it and the user can overturn it while reviewing. Anything unlabelled follows directly from one of those, or from existing code.

## Why

RallyHub is unreleased and has no production data. The audit's "Recommended sequence", step 1 ("before external access"), groups these four. They all meet in one endpoint, `POST /v1/booking/create-booking` (`CourtBookController.createBooking` → `CourtBookService.createBookingRoute` → `CourtBookRepository`), plus the Open Play view/join paths.

- **#3 (High): two overlapping bookings can both succeed.** The overlap query (`court-book.service.ts:99`, `hasConflictBooking` in `court-book.repository.ts`) runs before, and outside, the array `$transaction` that inserts the `CourtSchedule` and `CourtBooking`. Under READ COMMITTED two requests can both see a free slot and both commit. The FK inserts take only `FOR KEY SHARE` on the court row, which doesn't serialize anything.
- **#4 (High): invalid intervals pass validation.** `rentDuration` is `@IsInt() @IsNumber()` with no bounds; `date` is only `@IsDateString()`. Zero, negative, past and date-only (implicit UTC midnight) values are accepted. A zero or negative interval never matches the overlap query, so it can be stored inside anything. There is no notion of opening hours, horizon or slot alignment.
- **#5 (High): a booking can be recorded against another account.** The owner comes from the body `email` (`findUserIdByEmail`). Only Open Play checks it against the session.
- **#6 (High): operational statuses don't block new activity.** Create checks only that the court is in the request's venue. It ignores `Court.status`, `Venue.status` and `Tenant.status`. Open Play's `openPlayViewableWhere()` requires an ACTIVE venue but not an ACTIVE court or tenant.

**Success:** under any concurrency a court never holds two overlapping occupied schedules; every new booking is a positive, whole-hour, future interval that sits entirely inside one of its venue's operating windows and obeys that venue's rules; every booking belongs to the signed-in user who made it; no new booking or Open Play join lands on a court, venue or tenant that isn't ACTIVE. All of it is proven by real-Postgres tests.

## Goals

1. Serialize reservations per court and recheck everything that decides acceptance inside the transaction that writes the booking (#3).
2. Give each venue its own booking rules (weekly opening hours, min/max duration, horizon, start alignment), configurable by its owners and staff through the API, and enforce them on the server (#4).
3. The session user owns every booking (#5).
4. One shared bookability rule (court + venue + tenant ACTIVE), enforced on create and on every Open Play view/join path (#6).

## Non-goals

- **Any web UI** **(product owner)**. Settings are API-only this round.
- Holidays, one-off closures, time-scoped court blocks, per-court hours **(product owner)**. A court that is out entirely uses its `MAINTENANCE` status.
- Public (signed-out) availability or slot listing; wiring "Reserve court" in the web app; My bookings; cancelling or rescheduling private bookings (Group D / audit #7).
- Staff booking on behalf of a customer **(product owner: not allowed)**.
- Touching existing bookings when a status or the rules change **(product owner: existing bookings are left alone)**.
- Pricing, payments, notifications.
- Reworking the `CourtSchedule`/`CourtBooking` split or the nullable `isActive` columns.
- Changing Open Play cancel/leave/enable/visibility rules beyond the bookability policy.

## Anti-goals (a failure even if tests pass)

- Any path that decides availability, status or the venue rules outside the lock that guards the insert.
- Raw SQL, an exclusion constraint, or a hand-written or hand-edited migration **(product owner)**.
- The bookability rule, or the "inside opening hours" rule, spelled out in more than one place.
- Trusting any client-supplied identity (`email`) for ownership.
- Timezone handling that is only correct for fixed-offset zones (Asia/Manila has no DST, but venues may be anywhere).
- A concurrency test that passes against the current, broken code (it must be shown red first).

## Constraints

- `AGENTS.md`: thin controllers → services (business rules) → repositories (all Prisma). DTOs, explicit return types, no `any`. Shared HTTP types in `packages/shared`, imported type-only.
- **Schema changes only through `prisma migrate dev` against the local test DB** **(product owner)**: `cd apps/api && DATABASE_URL="$TEST_DATABASE_URL" npx prisma migrate dev --name add_venue_booking_settings`. Never hand-write or edit migration SQL. The hosted dev DB is touched only at the very end, with `npx prisma migrate status` then `npx prisma migrate deploy`.
- No `npm install`, no new dependencies. Timezone maths uses `Intl` (Node 22). `class-validator` 0.15.1 already ships `@IsTimeZone()`.
- TDD **(product owner)**. Real-Postgres tests use the harness in `apps/api/src/test-support/` against local `rallyhub_test` (`TEST_DATABASE_URL`).
- No `Co-Authored-By`, `Claude-Session` or 🤖 lines in commits or PR text.

---

## Data model

The change is purely additive: two new tables and two new enums. There's no backfill and no data migration, so the Prisma-generated migration is safe on the hosted dev DB.

**`VenueBookingSettings`** (new, one-to-one with `Venue`, optional)
- `id`, `venueId` (unique; FK to `Venue`, `onDelete: Cascade`), `createdAt`, `updatedAt`
- `minDurationHours Int`, `maxDurationHours Int`, `horizonDays Int`
- `startAlignment BookingStartAlignment` (`HOUR` | `HALF_HOUR`)
- relation `openingHours VenueOpeningHours[]`

**`VenueOpeningHours`** (new; one row per open weekday)
- `id`, `settingsId` (FK to `VenueBookingSettings`, `onDelete: Cascade`)
- `weekday Weekday` (`MONDAY` … `SUNDAY`)
- `opensAtMinute Int`, `closesAtMinute Int`: minutes after local midnight, 0–1410, multiples of 30
- `@@unique([settingsId, weekday])`. A weekday has at most one window.

**Venue** gets only the back-relation `bookingSettings VenueBookingSettings?`. No new columns on `Venue`, so `VenueResponse` and `PATCH /venues/:id` are unchanged.

**Meaning:**
- **No settings row → the venue uses the defaults** (below). That covers every existing venue and every new one until someone saves settings.
- **A settings row exists → it is the whole truth.** A weekday with no `VenueOpeningHours` row is **closed**. A settings row with zero hour rows means closed every day, which is distinct from "not configured".

**Defaults** **(product owner)**, held in one code constant (e.g. `DEFAULT_VENUE_BOOKING_SETTINGS` in `court-book/booking-rules.ts` or similar):
- 06:00–00:00 every day
- min 1 hour, max 8 hours
- horizon 60 days
- `HOUR` alignment

**Code-level fallback, not rows** *(Claude's call)*. Creating rows for existing venues would need a data migration. `prisma migrate dev` can't generate inserts, so that would mean hand-editing SQL, which is forbidden. Creating rows on venue creation would add a second write path and would still leave existing venues uncovered. A fallback constant needs neither. It also means a venue that never touched its settings follows the product default if the default ever changes. The settings columns carry no `@default`, so the default lives in exactly one place.

**`Venue.timezone`** (existing, default `Asia/Manila`) is the zone for every rule. It is currently an unvalidated string. Add `@IsTimeZone()` to `timezone` in `CreateVenueDto` and `UpdateVenueDto` (400 on an invalid IANA name). Changing a venue's timezone reinterprets its hours for new bookings only.

---

## API: configuring hours and rules

**A dedicated sub-resource on the existing venues controller** *(Claude's call)*, using the same path prefix and versioning as `PATCH venues/:id`:

| Route | Who | Result |
| --- | --- | --- |
| `GET venues/:id/booking-settings` | any signed-in user (consistent with today's venue reads, which require auth) | 200 effective settings; 404 unknown venue |
| `PUT venues/:id/booking-settings` | `AuthorizationService.assertCanManageVenue(actorId, venue.tenantId, venue.id)`: OWNER, tenant-wide STAFF, STAFF of that venue, platform admin | 200 saved settings; 400 invalid; 403; 404 |
| `DELETE venues/:id/booking-settings` | same as PUT | 204; the venue goes back to the defaults (idempotent) |

Why a sub-resource rather than extending `PATCH venues/:id`:
- Hours are replaced as a whole week with cross-day validation. That doesn't fit a flat, partial PATCH DTO.
- It keeps `VenueResponse` and `UpdateVenueRequest` unchanged.
- It gives the settings a clean GET that later slot or UI work can call.

As with the authorization design, the tenant and venue scope comes from the venue row loaded by id, never from headers. The routes live in the venues module (controller → `VenuesService` or a small `VenueBookingSettingsService` → a repository; builder's choice of split).

**PUT is a full replacement** *(Claude's call)*: every field is required. Clients GET, edit, then PUT. Settings can be read and edited whatever the venue's status, so a PENDING venue can be set up before it goes live. The service writes it in one transaction: upsert the settings row, delete its hour rows, then insert the open days.

**Shapes** (new shared types in `packages/shared/api/venues.d.ts`, e.g. `VenueBookingSettingsResponse`, `PutVenueBookingSettingsRequest`, `WeeklyHours`, `DayHours`):

```ts
type DayHours = { opensAt: string; closesAt: string } // "HH:mm", local to the venue
type WeeklyHours = {
  monday: DayHours | null; tuesday: DayHours | null; wednesday: DayHours | null
  thursday: DayHours | null; friday: DayHours | null; saturday: DayHours | null
  sunday: DayHours | null                       // null = closed
}
type PutVenueBookingSettingsRequest = {
  minDurationHours: number
  maxDurationHours: number
  horizonDays: number
  startAlignment: "HOUR" | "HALF_HOUR"
  weeklyHours: WeeklyHours
}
type VenueBookingSettingsResponse = PutVenueBookingSettingsRequest & {
  venueId: string
  timezone: string
  isDefault: boolean                            // true when no settings row exists
}
```

**Validation (400; class-validator plus a service check for cross-field rules):**
- `minDurationHours`: an integer from 1 to 24. `maxDurationHours`: an integer from `minDurationHours` to 24. *(The 24 cap is Claude's call.)*
- `horizonDays`: an integer from 1 to 365 *(Claude's call)*.
- `startAlignment` is `HOUR` or `HALF_HOUR`.
- `weeklyHours` must contain all seven keys. Each one is `null` or a `DayHours`.
- `opensAt`/`closesAt` match `^([01]\d|2[0-3]):(00|30)$`, which allows half-hour steps only. `24:00` is rejected; write midnight as `00:00`.
- **Window length:** `len = (closes − opens) mod 1440`, and a `len` of 0 counts as 1440. So `closesAt ≤ opensAt` means the window ends the next day, `opensAt == closesAt` is a 24-hour window, and no window can exceed 24 hours (the 24h cap holds by construction).
- **No overlap across midnight:** if a day's window runs past midnight (`opens + len > 1440`), the spill (`opens + len − 1440`) must be ≤ the next day's `opensAt` when the next day is open. Sunday's next day is Monday. With one window per day, this is the only way windows can overlap. Back-to-back windows are allowed (e.g. Sat 06:00–06:00 followed by Sun 06:00–…).
- **Every open window must be at least `minDurationHours` long** *(Claude's call)*. A shorter window could never be booked, so it's almost certainly a mistake.
- Errors name the field or weekday, e.g. "saturday's hours run past sunday's opening time".

**Read access** *(Claude's call)*: any signed-in user can GET, because customers will need the hours to choose a slot. Signed-out access belongs with public discovery (follow-up).

---

## Operating-window semantics **(product owner)** and timezone handling

- A weekday's window belongs to that weekday's **operating day**. Sat 06:00–03:00 runs from Saturday 06:00 to Sunday 03:00 local time, and the Sunday 00:00–03:00 hours are **Saturday's**.
- A booking `[start, end)`, with `end = start + rentDuration hours` (elapsed time), is valid only if it lies **entirely inside one window**: `windowStart ≤ start` and `end ≤ windowEnd`. It must start aligned and end by closing time.
- **Consequence, accepted as the literal rule:** a booking can't span two back-to-back windows (e.g. a 24/7 venue configured 00:00–00:00 every day can't take 23:00–01:00). See follow-ups.

**Algorithm** (pure functions in a rules file such as `court-book/booking-rules.ts`, mirroring `open-play.rules.ts`; no Prisma):
1. Get the local wall-clock parts of `start` in the venue's zone with `Intl.DateTimeFormat(..., { timeZone, hourCycle: 'h23' }).formatToParts`.
2. **Alignment:** local seconds and milliseconds are 0, and the local minute is 0 (`HOUR`) or 0/30 (`HALF_HOUR`). Checking the *local* minute matters for zones with :30/:45 offsets (Asia/Kolkata, Asia/Kathmandu). Durations are whole hours, so the end is aligned too, except across a DST change, which the window check covers.
3. **Candidate operating days:** the local calendar date `L` of `start`, and `L − 1` (the previous day's spill). Windows are at most 24h and durations at most 24h, so no other day can contain the booking. Take the weekday from the local calendar date, not from the UTC instant.
4. For each candidate day `D` that has a window, compute `windowStart = toInstant(D, opensAt, tz)` and `windowEnd = toInstant(D + (crosses ? 1 : 0), closesAt, tz)`, where `crosses = closesAt ≤ opensAt`. The booking is inside if any candidate contains `[start, end)`.
5. **`toInstant(localDate, localTime, tz)` uses "compatible" disambiguation** (Temporal's default). A wall time that falls in a DST gap moves forward by the gap; a repeated wall time resolves to the earlier instant. Implement it by guessing the instant from the zone offset and correcting once or twice with `Intl` offset lookups. Unit-test it directly.
6. All comparisons are between instants (`Date` milliseconds). On a DST day a window's elapsed length can differ from its wall-clock length. That is expected and correct.

**Other time rules** (one `now = new Date()` per request):
- `start > now`. There is no minimum lead time *(Claude's call)*.
- `start ≤ now + horizonDays × 24h`, measured in elapsed time *(Claude's call: deterministic and DST-agnostic; the difference is at most an hour)*.
- `minDurationHours ≤ rentDuration ≤ maxDurationHours`.

**DTO (shape only, 400):**
- `rentDuration`: `@IsInt() @Min(1) @Max(24)`, a global hard cap that keeps the value well inside `Int`. Drop the redundant `@IsNumber()`.
- `date`: strict ISO 8601 that must be a complete date-time with an explicit offset (`Z` or `±hh:mm`). A date-only or offset-less string is rejected as ambiguous. Builder's choice: a `@Matches` on the suffix or a small custom validator.

---

## #5: booking ownership **(product owner)**

- A booking always belongs to the session user: `userId = session.user.id`, `userEmail = session.user.email`. The controller passes them (or the `UserSession`) to the service. `findUserIdByEmail` and its `404 "No account found for email"` go away.
- Remove `email` from `CreateCourtBookingDto` and from `CreateCourtBookingRequest` in `packages/shared/api/court-book.d.ts`.
  - The global `ValidationPipe` is `whitelist: true` without `forbidNonWhitelisted`, so an old client that still sends `email` has it silently stripped.
  - The web only `Pick`s three Open Play fields from that type, so `npm run typecheck -w web` should stay green.
- The Open Play `EMAIL_MISMATCH` check becomes unreachable. Delete it, `OPEN_PLAY_MESSAGES.EMAIL_MISMATCH` and their tests.
- There is no staff-on-behalf path (non-goal).

## #6: one bookability policy

- **The rule:** `Court.status = ACTIVE` **and** `Venue.status = ACTIVE` **and** `Tenant.status = ACTIVE` **(product owner)**. Define it once as a typed `Prisma.CourtWhereInput` builder, `bookableCourtWhere()`, in a module both `court-book` and `open-play` import (e.g. `apps/api/src/courts/court-bookability.ts`).
  - Consequence: a platform admin must set the tenant to ACTIVE before its venues take bookings. Nothing does that automatically today.
- **Existing bookings are left alone** **(product owner)**. Only new bookings and new Open Play joins are blocked. Nothing is auto-cancelled and no one is notified.
- **Create booking:** enforced under the court lock (see the validation order below).
- **Open Play:** `openPlayViewableWhere()` changes `court: { venue: { status: 'ACTIVE' } }` to `court: bookableCourtWhere()`. Through the existing builders, that covers discovery, `GET /join/:token`, both join routes, and `joinSeat`'s under-lock `findFirst`.
  - Management routes (cancel, leave, enable, visibility, the manage view) keep their unfiltered reads, so bookers and staff can still see and cancel a game at a suspended venue.
  - *(Claude's call, following the existing venue precedent: the token view is hidden too, not only the join.)*

## Open Play impact

- **Hosting** an Open Play game *is* a create-booking with `isOpenPlay: true`. It goes through exactly the same path: ownership, status, lock, every venue rule, overlap.
- **Joining** checks bookability (status) and "not started", as now. It does **not** re-check opening hours or duration rules. The game's slot was validated when it was booked, and a later change to the hours or rules leaves existing bookings alone, as the product owner decided. *(Claude's call, derived from that decision.)*
- **Enable (private → Open Play), visibility, cancel, leave:** unchanged. They act on an existing booking. A game enabled at a non-ACTIVE venue still can't be seen or joined, because of the viewable rule.

---

## Concurrency **(product owner: approach)**

There is one **interactive** `$transaction`, replacing the array transaction in `createCourtBooking`. It uses Open Play's bounds (`{ maxWait: 5_000, timeout: 10_000 }`). Move `OPEN_PLAY_TX_OPTIONS` and `isRetryableTransactionError` from `open-play.repository.ts` to a shared spot rather than copying them.

1. **Lock and check court status:** `tx.court.updateMany({ where: { id: courtId, venueId, status: 'ACTIVE' }, data: { updatedAt: now } })`.
   - A Postgres `UPDATE` holds a row lock until commit, so competing bookings for the same court queue here. Keep the `where` scalar-only (the shape Open Play verified).
   - `count === 0` → `COURT_NOT_BOOKABLE`.
   - The side effect of bumping `Court.updatedAt` is accepted *(Claude's call)*. Nothing reads it for logic.
2. **Under the lock, read the venue's status, its tenant's status, its timezone and its booking settings with hours**, using `bookableCourtWhere()` for the status part. If the court is not bookable → `COURT_NOT_BOOKABLE`.
3. **Evaluate the venue rules** with the pure rules function (defaults if there's no settings row). A violation returns that outcome.
4. **Overlap recheck** with the existing half-open predicate (`bookedDate < end AND dateTimeVacant > start AND isVacant = false`) on `tx`. Back-to-back bookings are allowed. Under READ COMMITTED each statement sees whatever the previous lock holder committed. A hit → `SLOT_TAKEN`.
5. **Insert** the `CourtSchedule` (`bookedDate = start`, `dateTimeVacant = end`, `hoursBooked = rentDuration`), then the `CourtBooking` (`bookDate = start`, plus the Open Play booker seat as today).

The repository returns an outcome union, as Open Play's `joinSeat` does: `CREATED { bookingId }`, `COURT_NOT_BOOKABLE`, `RULE_VIOLATION { code }`, `SLOT_TAKEN` or `BUSY`. It maps `P2028`/`P2034`/`40P01` to `BUSY`. Calling pure rule functions from inside the locked repository method follows the `joinSeat`/`isFull` precedent: the rule must run under the lock, but it is defined once in the rules file. The service maps outcomes to HTTP errors. The pre-transaction `hasConflictBooking` call is removed. The service keeps an unlocked court pre-read only to return a precise 404.

**Why the court row:** every reservation names exactly one court. That gives a per-court lock with no new table, and staff `PATCH /courts/:id` edits take the same row lock, so a status change and a booking are strictly ordered.

**Known limits (accepted):**
- Venue and tenant status, the timezone and the booking settings are read under the court lock but are not themselves locked. A suspension or settings change committed in the same instant may miss a booking that commits a moment earlier. That is indistinguishable from a booking made just before the change, which counts as an existing booking and is left alone.
- Any future write path that occupies a schedule (reschedule, staff booking) must use this same locked method. Say so in its JSDoc.

## Booking validation order and error responses

The first failing check wins. *(The order is Claude's call. It puts venue rules before overlap, so a request outside hours says "outside hours" rather than "taken", and all rules are evaluated once, under the lock, against freshly read settings.)*

| # | Check | Where | Status | Message constant |
| --- | --- | --- | --- | --- |
| 1 | Signed in | global guard | 401 | unchanged |
| 2 | DTO shape: `date` complete ISO with offset; `rentDuration` int 1–24; `courtId`; `isOpenPlay`; Open Play option shapes | ValidationPipe | 400 | class-validator default |
| 3 | Open Play options on a private booking | service | 400 | existing `INVALID_PRIVATE_OPTIONS` |
| 4 | Court unknown or in another venue | service pre-read (unlocked) | 404 | existing message |
| 5 | Court not ACTIVE (lock `count = 0`) | tx | 409 | new `BOOKING_MESSAGES.COURT_NOT_BOOKABLE` |
| 6 | Venue or tenant not ACTIVE; stored timezone invalid (legacy row) *(Claude's call: fail closed)* | tx | 409 | `COURT_NOT_BOOKABLE` |
| 7 | `start ≤ now` | tx, rules | 400 | new `START_IN_PAST` |
| 8 | `start > now + horizonDays` | tx, rules | 400 | new `BEYOND_HORIZON` |
| 9 | Duration outside the venue's min/max | tx, rules | 400 | new `DURATION_OUT_OF_RANGE` |
| 10 | Start not aligned in the venue's zone | tx, rules | 400 | new `NOT_SLOT_ALIGNED` |
| 11 | Not entirely inside one operating window | tx, rules | 400 | new `OUTSIDE_OPENING_HOURS` |
| 12 | Overlaps an occupied schedule | tx | 409 | existing `COURT_UNAVAILABLE` |
| 13 | Transaction timeout, write conflict or deadlock | tx | 409 | new `BOOKING_MESSAGES.BUSY` |

- A rule violation found inside the transaction returns its outcome. Nothing is written and the transaction rolls back.
- One 409 for court, venue and tenant not being ACTIVE is *Claude's call*: the court exists, and the caller should learn it can't be booked.
- Only the existing exception types are used. Nothing in the repo uses 422 or 503.

---

## Testing approach (TDD) **(product owner)**

Write each test red first against current code, then make it pass.

**Unit (pure, no DB):** `booking-rules.spec.ts`
- **`toInstant` and local parts:**
  - Asia/Manila
  - Asia/Kolkata (+05:30)
  - Asia/Kathmandu (+05:45)
  - America/New_York, across the spring-forward gap (2026-03-08: 02:30 → 03:30 instant) and the fall-back overlap (2026-11-01: 01:30 → the earlier instant)
- **Windows:**
  - Mon–Fri 06:00–00:00: Mon 23:00 + 1h accepted; Mon 23:00 + 2h rejected; Tue 05:00 rejected.
  - Sat–Sun 06:00–03:00: Sun 02:00 + 1h accepted (as Saturday's); Sun 02:00 + 2h rejected; Mon 01:00 + 1h accepted as Sunday's spill (Monday opens 06:00).
  - Start equal to opening accepted; end equal to closing accepted.
  - A closed day.
  - A 24h window.
  - Back-to-back windows rejecting a spanning booking.
  - A DST day in America/New_York where a window crosses the transition.
- **Alignment:** `HOUR` vs `HALF_HOUR` at :00, :30, :15 and with non-zero seconds; local-minute checks in +05:30 and +05:45 zones.
- **Horizon, future and duration boundaries:** start = now → reject; start = now + horizon → accept; +1 ms → reject; min/max edges.
- **Settings validation:** spill overlap (Sat 06:00–03:00 with Sun 02:00 opening → reject; Sun 03:00 → accept; Sunday→Monday wrap); bad formats (`6:00`, `06:15`, `24:00`); min > max; a window shorter than the minimum; a missing weekday key.

**Unit (mocked repositories):**
- DTO specs: `rentDuration` 0, −1, 2.5, 25 and `'2'` rejected; `date` date-only, offset-less and garbage rejected; venue `timezone` invalid rejected.
- `court-book.service.spec.ts`: the owner comes from the session and a body `email` is ignored; each repository outcome maps to the table; no pre-transaction conflict call.

**Real Postgres** (`TEST_DATABASE_URL` → local `rallyhub_test`; skipped without it, like the existing suites):
- Extend `HttpFixtures` (don't duplicate it) with:
  - an ACTIVE tenant and venue (the defaults are PENDING)
  - booking-settings rows
  - booking and schedule cleanup before courts (that FK is `Restrict`)
- **Booking times are computed relative to now in the venue's zone** (e.g. tomorrow 10:00 Asia/Manila), never hard-coded dates.
- **Booking HTTP suite** (new, e.g. `court-book.http.spec.ts`, using `createHttpTestApp` and real Better Auth sessions):
  - **Race, burst:** N (e.g. 8, kept below the pg pool size of 10) concurrent overlapping `POST create-booking` requests on one court, from different users. Expect exactly one `201`, the rest `409` (`BUSY` counts as a loss), and exactly one occupied schedule row.
  - **Race, deterministic:** a test transaction takes the court lock and inserts an overlapping occupied schedule without committing. Start the HTTP request and confirm it is blocked by polling `pg_stat_activity`/`pg_locks` for a waiting backend, not with a bare sleep. Then commit and expect `409`.
    - Against the current code, the same shape without the lock step must produce two overlapping rows. Record that red run.
  - **Controls:** two different courts concurrently → both `201`; back-to-back on one court → both `201`; a cancelled (`isVacant: true`) slot can be rebooked.
  - **Ownership:** a body `email` naming another registered user → `201`, and the stored `userId`/`userEmail` are the caller's.
  - **Bookability:** court MAINTENANCE or INACTIVE, venue SUSPENDED or PENDING, tenant SUSPENDED or PENDING → `409 COURT_NOT_BOOKABLE`. All ACTIVE → `201`. Existing bookings survive a status change untouched.
  - **Rules:**
    - Default venue (no settings): 05:00 rejected; 23:00 + 1h accepted; 23:00 + 2h rejected; 9h rejected; 61 days ahead rejected.
    - Configured venue (Sat 06:00–03:00, `HALF_HOUR`, max 3, horizon 7): Sunday 01:30 + 1h accepted; :30 start accepted; 4h rejected; 8 days ahead rejected.
    - Past start, zero or negative duration, date-only → `400`.
    - Every rejection writes no rows.
- **Settings HTTP suite** (new, e.g. `venue-booking-settings.http.spec.ts`):
  - GET: signed out → 401; any signed-in user → 200 with `isDefault: true` and the defaults; unknown venue → 404.
  - PUT/DELETE as owner, tenant-wide staff and venue staff → OK. Customer, staff of another venue and staff of another tenant → 403.
  - Validation cases → 400.
  - PUT then GET round-trips, with closed days as `null` and `isDefault: false`.
  - DELETE → defaults again.
  - Venue deletion cascades the settings.
- **Open Play integration** (`open-play.integration.spec.ts`, extend):
  - A game on a MAINTENANCE court or at a SUSPENDED tenant is absent from discovery, `null` from `findViewableByToken`/`findViewableById`, and `NOT_JOINABLE` from `joinSeat`.
  - A game stays joinable after its venue's hours change so that its slot is outside them.
  - Fixtures that expect a joinable game must use ACTIVE tenants.
- **Gates:**
  - `npm run test -w api` with `TEST_DATABASE_URL` set (full suite green)
  - `npm run typecheck`
  - `npm run build -w api`
  - `npm run typecheck -w web` (shared contract change)

## Suggested commit order

Separate, reviewable commits on `fix/system-audit-remediation`:

1. #6: `bookableCourtWhere()` and Open Play adoption.
2. #3: locked interactive transaction; shared tx options and retry helper.
3. #5: session ownership and shared contract change.
4. Schema: `VenueBookingSettings`/`VenueOpeningHours` via `prisma migrate dev` on the test DB; venue `@IsTimeZone()`.
5. Settings API (GET/PUT/DELETE) and the rules module.
6. #4: DTO bounds and venue-rule enforcement under the lock.
7. At the very end, for the hosted dev DB: `npx prisma migrate status`, then `npx prisma migrate deploy`.

## What's left to the builder

- Exact file homes: `bookableCourtWhere()`, the rules module and the defaults constant, the shared tx options and retry helper, and whether settings get their own service and repository inside the venues module.
- How the court pre-read and the locked read select the venue fields they need.
- Validator mechanics: "complete instant with offset", requiring all seven `weeklyHours` keys while allowing `null`, and the `HH:mm` pattern.
- The internal shape of `toInstant` (any correct `Intl`-based approach that passes the DST tests).
- Whether `CreateCourtSchedule`/`CreateCourtBooking` take `Date` instead of `string` (preferred) and drop `email`; whether `DateTimeHelper` stays.
- Exact wording of new messages, and JSDoc updates (the "deferred gap" comment in `court-book.service.ts`).

## Follow-ups / not built yet

- **Venue settings UI** for owners and staff (hours editor, rules form).
- **Public slot and availability endpoint**: free slots per court and day, computed from the hours, rules and occupied schedules. That includes deciding signed-out access to venue reads and settings (with audit #8, public discovery).
- **Holidays and one-off closures** (date-specific overrides of the weekly hours).
- **Scheduled court blocks** (time-scoped maintenance on one court).
- **Per-court hours** (explicitly excluded this round).
- **Bookings spanning back-to-back windows** (e.g. 24/7 venues). That would mean merging adjacent windows, a change to the product owner's "one window" rule.
- **More than one window per weekday** (e.g. a split day with a lunch closure).
- **Booking requires sign-in (product owner).** The booking API stays behind the auth guard. In the planned web flow, anyone can browse venues and slots, and clicking to book while signed out opens a "Sign in required" dialog (Login / Sign up). After sign-in, the user returns to the same venue with the chosen slot still selected. This needs the public slot endpoint above, and is built with the Reserve flow (audit #7).
- **Guest / passwordless checkout** (later): name + email + phone, verified with an emailed one-time code or Google one-tap (Better Auth email-OTP / magic-link plugins). Needs email delivery, a phone field on bookings, and rate limiting/captcha. True unverified guest booking is rejected: without payment it lets anyone hold every slot with fake emails.
- **Staff booking on behalf of a customer** (walk-in or phone): a separate authorized endpoint, plus a `createdByUserId` audit field.
- **Notifying or handling existing bookings** when a court, venue or tenant leaves ACTIVE, or when hours shrink.
- **Minimum lead time** (e.g. no bookings starting within the next hour) and **cancellation and rescheduling** of private bookings (Group D / #7).
- **Tenant activation flow:** nothing sets a tenant ACTIVE automatically, so new tenants can't take bookings until a platform admin does.
