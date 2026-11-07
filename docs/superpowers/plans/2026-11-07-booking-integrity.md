# Booking Integrity Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.
>
> **Codex:** if those skills aren't available, execute the tasks in order. Run each task's verification commands before its commit, and don't start a task until the previous one's tests pass.

**Goal:** Close audit findings #3 (racing overlapping bookings), #4 (invalid intervals, no venue rules), #5 (booking recorded against another account) and #6 (non-ACTIVE court/venue/tenant still bookable/joinable), as specified in the design.

**Architecture:**
- **One additive migration** adds `VenueBookingSettings` + `VenueOpeningHours` (and enums `BookingStartAlignment`, `Weekday`). No settings row means the code constant `DEFAULT_VENUE_BOOKING_SETTINGS`.
- **One pure rules module** (`court-book/booking-rules.ts`, no Prisma) owns timezone maths, the operating-window rule, the time/duration rules and settings validation.
- **One bookability builder** (`courts/court-bookability.ts`, `bookableCourtWhere()`) used by create-booking and every Open Play view/join read.
- **One locked interactive transaction** (`CourtBookRepository.reserveCourt`) locks the court row, then rechecks bookability, venue rules and overlap before inserting. It returns an outcome union that the service maps to HTTP errors. The owner always comes from the session.
- **A settings sub-resource** `GET/PUT/DELETE venues/:id/booking-settings` on the venues controller.

**Tech Stack:** NestJS 11, Prisma 7 + Postgres (pg adapter), class-validator 0.15.1 (`@IsTimeZone`), `Intl` (Node 22), Jest + supertest with real Better Auth sessions.

**Spec:** `docs/superpowers/specs/2026-11-07-booking-integrity-design.md`. Read it first. Every decision in it is final; this plan only fixes what it left to the builder.

## Global Constraints

- Branch `fix/system-audit-remediation` (PR #34). One or more commits per task. **Never push, never edit the PR.**
- **Commit messages:** conventional style, referencing the audit numbers (e.g. `fix(api): … (#3)`). **No `Co-Authored-By`, `Claude-Session` or 🤖 lines.** Never commit `apps/web/next-env.d.ts` (run `git checkout apps/web/next-env.d.ts` if a build rewrites it) or any `.env` file.
- **Repo conventions (`AGENTS.md`):** thin controllers → services (business decisions) → repositories (all Prisma). DTOs for request shapes, explicit return types, no `any`. Shared HTTP types live in `packages/shared` and are imported type-only.
- **Schema changes only via** `cd apps/api && DATABASE_URL="$TEST_DATABASE_URL" npx prisma migrate dev --name <name>` against the local test DB, then `npm run db:generate` from the root. **Never hand-write or edit migration SQL, never edit historical migrations, never use `db push`.**
- **Hosted dev DB** (the `DATABASE_URL` in `apps/api/.env`): touched only in Task 7. Run `npx prisma migrate status`; only if exactly the expected new migration is pending, run `npx prisma migrate deploy`. Nothing else. Never `migrate dev`/`reset` against it.
- **Test DB:** Jest does not read `.env`. Every test or test-DB command is preceded, in the same shell, by:

  ```bash
  export TEST_DATABASE_URL="postgresql://jpatrickzxc@localhost:5432/rallyhub_test"; unset AUTH_DEV_BYPASS_EMAIL
  ```

  A missing or unreachable test DB is a **hard stop**, not a skip: report it and stop. DB-backed suites use `getTestDatabaseUrl()` from `apps/api/src/test-support/http-app.ts` and `HttpFixtures`/`teardownHttpSuite` from `test-support/fixtures.ts`. New suites keep the existing `describeIfDb` guard, but a test run that reports any skipped suite counts as a failure.
- **TDD:** each task writes its failing test, runs it to see RED, implements, runs it to see GREEN. The Task 5 concurrency tests must be shown failing against the pre-fix code, with the RED output pasted into the task report.
- **No raw SQL in app code.** Tests may use `$queryRaw` only to read `pg_stat_activity`. No new dependencies; timezone maths uses `Intl`.
- **No web UI** this round. Web must still typecheck/build/lint.
- **Messages:** tests assert against the `ErrorConstant` constants, never against literal strings.

## Review Focus

1. **`date` with a non-UTC offset** (`…T10:00:00+08:00`) must book the same instant as the equivalent `Z` string, and the rules must evaluate it in the venue's zone, not the offset's. Pinned in Task 6.
2. **A legacy venue row with an invalid `timezone`** must fail closed with `409 COURT_NOT_BOOKABLE`, never a 500 from `Intl`. Pinned in Task 6.
3. **A settings row with zero hour rows means "closed every day"**, not "use the defaults". GET returns seven `null`s with `isDefault: false`, and every booking is `OUTSIDE_OPENING_HOURS`. Pinned in Tasks 4 and 6.
4. **A booking starting exactly at closing time or at midnight** (e.g. 00:00 at a default 06:00–00:00 venue) must be rejected, not attributed to the window that just closed. Pinned in Task 2.
5. **Settings on a PENDING venue are editable, and DELETE with no settings row is still `204`.** Pinned in Task 4.

---

### Task 1: Schema, migration and fixture extensions

**Files:**
- Modify: `apps/api/prisma/schema.prisma`
- Create: `apps/api/prisma/migrations/<timestamp>_add_venue_booking_settings/migration.sql` (generated, never edited)
- Modify: `apps/api/src/test-support/fixtures.ts`
- Create: `apps/api/src/venues/venue-booking-settings.schema.integration.spec.ts`

**Interfaces (Produces):**
- Prisma models, exactly as in the design's "Data model":
  - `enum BookingStartAlignment { HOUR HALF_HOUR }`, `enum Weekday { MONDAY TUESDAY WEDNESDAY THURSDAY FRIDAY SATURDAY SUNDAY }`
  - `model VenueBookingSettings { id String @id @default(uuid()); venueId String @unique; minDurationHours Int; maxDurationHours Int; horizonDays Int; startAlignment BookingStartAlignment; createdAt DateTime @default(now()); updatedAt DateTime @updatedAt; venue Venue @relation(fields: [venueId], references: [id], onDelete: Cascade); openingHours VenueOpeningHours[] }`. No `@default` on the rule columns.
  - `model VenueOpeningHours { id String @id @default(uuid()); settingsId String; weekday Weekday; opensAtMinute Int; closesAtMinute Int; settings VenueBookingSettings @relation(fields: [settingsId], references: [id], onDelete: Cascade); @@unique([settingsId, weekday]) }`
  - `Venue` gains only `bookingSettings VenueBookingSettings?`.
- `HttpFixtures` (existing call sites keep working; all new params are optional):
  - `createTenant(status: TenantStatus = 'PENDING'): Promise<{ id: string }>`
  - `createVenue(tenantId: string, opts: { status?: VenueStatus; timezone?: string } = {}): Promise<{ id: string }>`
  - `createCourt(venueId: string, status: CourtStatus = 'ACTIVE'): Promise<{ id: string }>`
  - `createBookableCourt(opts: { timezone?: string } = {}): Promise<{ tenantId: string; venueId: string; courtId: string }>`: ACTIVE tenant, venue and court.
  - `setBookingSettings(venueId: string, input: FixtureBookingSettings): Promise<void>`, where `FixtureBookingSettings = { minDurationHours: number; maxDurationHours: number; horizonDays: number; startAlignment: 'HOUR' | 'HALF_HOUR'; hours: { weekday: Weekday; opensAtMinute: number; closesAtMinute: number }[] }`. It writes the settings row and its hour rows directly.
  - `cleanup()` now deletes, in order: `openPlaySeat` (booking's `courtId` in tracked courts), `courtBooking` (`courtId` in tracked courts), `courtSchedule` (`courtId` in tracked courts), members, courts, venues (settings cascade), tenants, users.

- [ ] **Step 0: Record baselines** (needed by Task 7), saving the output to the scratch directory:
  - `git rev-parse HEAD`: the start SHA.
  - `npm run lint -w web 2>&1 | tail -5`: the web warning count.
  - `cd apps/api && npx eslint src/court-book src/open-play src/venues src/courts src/test-support src/constants src/models src/helper`: the API error count on the existing files this plan touches.
  - Run the test-DB preamble, then `cd apps/api && DATABASE_URL="$TEST_DATABASE_URL" npx prisma migrate status`. Expected: "Database schema is up to date". Otherwise **stop**.
- [ ] **Step 1: Write the failing integration spec** `venue-booking-settings.schema.integration.spec.ts` (`describeIfDb`, using `HttpFixtures` with no app):
  - `it('stores one settings row per venue with its hours, and cascades on venue delete')`: `setBookingSettings` with two hour rows, then `fixtures.db.venue.delete`, then `venueBookingSettings.count({ where: { venueId } })` and `venueOpeningHours.count({ where: { settingsId } })` are both `0`.
  - `it('rejects two hour rows for the same weekday')`: rejects with `{ code: 'P2002' }`.
  - `it('rejects a second settings row for the same venue')`: rejects with `{ code: 'P2002' }`.
  - `it('cleans up bookings and schedules on tracked courts')`: a second `HttpFixtures` instance creates a bookable court, a user row, a `courtSchedule` and a `courtBooking` on it. Its `cleanup()` resolves, and the court no longer exists.
- [ ] **Step 2: Run it.** `cd apps/api && npm run test -- venue-booking-settings.schema`. Expected: FAIL (TypeScript: `venueBookingSettings` does not exist on `PrismaClient`).
- [ ] **Step 3: Edit the schema**, then generate the migration with the Prisma CLI:

  ```bash
  cd apps/api && DATABASE_URL="$TEST_DATABASE_URL" npx prisma migrate dev --name add_venue_booking_settings
  ```

  Expected: one new folder whose SQL only creates the two enums and two tables, with their indexes and FKs. Then run `npm run db:generate` from the root.
- [ ] **Step 4: Extend `HttpFixtures`** as in the Interfaces.
- [ ] **Step 5: Run** `npm run test -w api -- venue-booking-settings.schema test-support`. Expected: PASS. Then run the full suite: `npm run test -w api -- --runInBand`. Expected: 0 failures, 0 skipped suites.
- [ ] **Step 6: Commit** the schema, migration folder, fixtures and spec: `feat(api): add venue booking settings schema and booking fixtures (#4)`

### Task 2: Pure booking rules and timezone maths

**Files:**
- Create: `apps/api/src/court-book/booking-rules.ts`, `apps/api/src/court-book/booking-rules.spec.ts`

**Interfaces (Produces):** all exported from `booking-rules.ts`. No Prisma imports; enum values are string literals that structurally match the generated Prisma enums.
- `type StartAlignment = 'HOUR' | 'HALF_HOUR'`
- `type WeekdayEnum = 'MONDAY' | … | 'SUNDAY'`, and `WEEKDAY_KEYS = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'] as const`, with `type WeekdayKey = (typeof WEEKDAY_KEYS)[number]`
- `type DayWindow = { opensAtMinute: number; closesAtMinute: number }` and `type WeeklyWindows = Record<WeekdayKey, DayWindow | null>`
- `type BookingRules = { minDurationHours: number; maxDurationHours: number; horizonDays: number; startAlignment: StartAlignment; weeklyWindows: WeeklyWindows }`
- `const DEFAULT_VENUE_BOOKING_SETTINGS: BookingRules`: every day `{ opensAtMinute: 360, closesAtMinute: 0 }`, min 1, max 8, horizon 60, `'HOUR'`. This is the only place the defaults exist.
- `const MAX_BOOKING_DURATION_HOURS = 24`, `const MAX_HORIZON_DAYS = 365`
- `const HH_MM_PATTERN = /^([01]\d|2[0-3]):(00|30)$/`, `parseHhMm(value: string): number | null`, `formatHhMm(minuteOfDay: number): string`
- `isValidTimeZone(timeZone: string): boolean`
- `type LocalDate = { year: number; month: number; day: number }` (month 1–12)
- `localParts(instant: Date, timeZone: string): LocalDate & { hour: number; minute: number; second: number; millisecond: number }`
- `toInstant(date: LocalDate, minuteOfDay: number, timeZone: string): Date`, with "compatible" disambiguation
- `type BookingRuleViolation = 'START_IN_PAST' | 'BEYOND_HORIZON' | 'DURATION_OUT_OF_RANGE' | 'NOT_SLOT_ALIGNED' | 'OUTSIDE_OPENING_HOURS'`
- `evaluateBookingRules(args: { start: Date; durationHours: number; now: Date; timeZone: string; rules: BookingRules }): BookingRuleViolation | null`. It checks in exactly this order: past (`start <= now`), horizon (`start > now + horizonDays × 86_400_000 ms`), duration, alignment, window. The caller guarantees a valid `timeZone`.
- `validateBookingSettings(rules: BookingRules): string | null`: cross-field checks only (formats and ranges are the DTO's job). It returns the first error, using these exact formats:
  - `maxDurationHours must be at least minDurationHours`
  - `${day}'s hours are shorter than minDurationHours`
  - `${day}'s hours run past ${nextDay}'s opening time`
- `type BookingSettingsRecord = { minDurationHours: number; maxDurationHours: number; horizonDays: number; startAlignment: StartAlignment; openingHours: { weekday: WeekdayEnum; opensAtMinute: number; closesAtMinute: number }[] }`
- `bookingRulesFromRecord(record: BookingSettingsRecord | null): BookingRules`: `null` returns the defaults. A record with zero hour rows has every day `null`.
- `weeklyWindowsToRows(windows: WeeklyWindows): { weekday: WeekdayEnum; opensAtMinute: number; closesAtMinute: number }[]`

Approach notes (the design's algorithm is binding; these fix the choices it leaves open):
- **Window length** is `((closes − opens + 1440) % 1440) || 1440`. A window crosses midnight when `closesAtMinute <= opensAtMinute`.
- **Weekday** comes from the local calendar date, e.g. `new Date(Date.UTC(y, m - 1, d)).getUTCDay()`, never from the UTC instant.
- **`toInstant`:**
  - Let `wall = Date.UTC(y, m - 1, d, 0, minuteOfDay)`, and `off(t)` = the zone offset at instant `t`, computed from `localParts`.
  - The candidates are `wall − off(wall − 1 day)` and `wall − off(wall + 1 day)`. Keep those whose `localParts` read back as the requested wall time.
  - If both survive (repeated hour), return the earlier. If one survives, return it. If none survives (DST gap), return `wall − off(wall − 1 day)`, which shifts forward by the gap.
- **Window check:** the candidate operating days are the local date of `start` and the day before. `windowStart = toInstant(D, opens)`, `windowEnd = toInstant(D + (crosses ? 1 : 0), closes)`. The booking is accepted if any candidate has `windowStart <= start && end <= windowEnd`, where `end = start + durationHours × 3_600_000` (elapsed time).

Test reference dates: 2026-11-09 is a Monday, and 2026-11-14/15 are Saturday/Sunday. Unless a test says otherwise, use `now = 2026-11-08T00:00:00Z` and `Asia/Manila` (UTC+8).

- [ ] **Step 1: Write the failing spec** `booking-rules.spec.ts`:
  - `describe('toInstant / localParts')`:
    - Asia/Manila: `toInstant({2026,11,9}, 600)` → `2026-11-09T02:00:00Z`.
    - Asia/Kolkata: 10:00 → `04:30Z`.
    - Asia/Kathmandu: 10:00 → `04:15Z`.
    - America/New_York gap: `toInstant({2026,3,8}, 150)` → `2026-03-08T07:30:00Z` (03:30 EDT).
    - America/New_York overlap: `toInstant({2026,11,1}, 90)` → `2026-11-01T05:30:00Z` (the earlier, EDT, instant).
    - `localParts(new Date('2026-11-09T04:15:00Z'), 'Asia/Kathmandu')` → hour 10, minute 0.
  - `describe('operating windows')`, with Mon–Fri `{360, 0}`, Sat–Sun `{360, 180}`, max 8, `HOUR`:
    - Mon 23:00 (`2026-11-09T15:00Z`) + 1h → `null`; + 2h → `'OUTSIDE_OPENING_HOURS'`.
    - Tue 05:00 (`2026-11-09T21:00Z`) + 1h → `'OUTSIDE_OPENING_HOURS'`.
    - Sun 02:00 (`2026-11-14T18:00Z`) + 1h → `null` (Saturday's window); + 2h → `'OUTSIDE_OPENING_HOURS'`.
    - Mon 01:00 (`2026-11-15T17:00Z`) + 1h → `null` (Sunday's spill).
    - Mon 06:00 (`2026-11-08T22:00Z`) + 1h → `null` (start equals opening).
    - Closed Tuesday: Tue 10:00 → `'OUTSIDE_OPENING_HOURS'`.
    - 24h window, Monday only, `{360, 360}`, max 24: Mon 06:00 + 24h → `null`; Tue 05:00 + 1h → `null`.
    - Back-to-back `{0, 0}` every day: Mon 23:00 + 2h → `'OUTSIDE_OPENING_HOURS'`; + 1h → `null`.
    - **Review Focus 4:** defaults, Tue 00:00 (`2026-11-09T16:00Z`) + 1h → `'OUTSIDE_OPENING_HOURS'`.
    - America/New_York, Saturday `{1200, 180}`, max 9, `now = 2026-01-01T00:00Z`, horizon 365:
      - fall back: `2026-11-01T00:00Z` + 8h → `null`; + 9h → `'OUTSIDE_OPENING_HOURS'`
      - spring forward: `2026-03-08T01:00Z` + 6h → `null`; + 7h → `'OUTSIDE_OPENING_HOURS'`
  - `describe('alignment')`, with `{0, 0}` every day:
    - `HOUR`: :00 → `null`; :30 → `'NOT_SLOT_ALIGNED'`.
    - `HALF_HOUR`: :30 → `null`; :15 → `'NOT_SLOT_ALIGNED'`; `10:00:01` → `'NOT_SLOT_ALIGNED'`.
    - Asia/Kolkata: `04:30Z` with `HOUR` → `null`; `04:00Z` with `HOUR` → `'NOT_SLOT_ALIGNED'`; `04:00Z` with `HALF_HOUR` → `null`.
    - Asia/Kathmandu: `04:15Z` with `HOUR` → `null`; `04:00Z` with `HALF_HOUR` → `'NOT_SLOT_ALIGNED'`.
  - `describe('time and duration bounds')`, with defaults and `now = 2026-11-09T02:00:00Z`:
    - `start = now` → `'START_IN_PAST'`.
    - `now + 60 days` → `null`; `+ 60 days + 1 ms` → `'BEYOND_HORIZON'`.
    - Duration 0 → `'DURATION_OUT_OF_RANGE'`; 8 at 10:00 → `null`; 9 → `'DURATION_OUT_OF_RANGE'`.
  - `describe('validateBookingSettings')`:
    - Sat `{360, 180}` with Sun opening 120 → `"saturday's hours run past sunday's opening time"`; Sun opening 180 → `null`.
    - Sun `{1320, 120}` with Mon opening 60 → `"sunday's hours run past monday's opening time"`.
    - Sat `{360, 360}` with Sun `{360, 0}` (back to back) → `null`.
    - min 3 / max 2 → the `maxDurationHours` message.
    - min 2 with Mon `{600, 660}` → `"monday's hours are shorter than minDurationHours"`.
    - All days `null` → `null`.
  - `describe('formats and mapping')`:
    - `parseHhMm`: `'06:00'` → 360, `'23:30'` → 1410, `'00:00'` → 0; `'6:00'`, `'06:15'`, `'24:00'` → `null`.
    - `formatHhMm(390)` → `'06:30'`.
    - `isValidTimeZone`: `'Asia/Manila'` → true, `'Mars/Phobos'` → false.
    - `bookingRulesFromRecord(null)` equals `DEFAULT_VENUE_BOOKING_SETTINGS`. A record with `openingHours: []` has all seven days `null`. A round trip through `weeklyWindowsToRows` preserves the windows.
- [ ] **Step 2: Run** `npm run test -w api -- booking-rules`. Expected: FAIL (module not found).
- [ ] **Step 3: Implement** `booking-rules.ts` per the Interfaces and approach notes.
- [ ] **Step 4: Run** `npm run test -w api -- booking-rules`. Expected: PASS. Also run `TZ=America/Los_Angeles npm run test -w api -- booking-rules`. Expected: PASS, which proves the code doesn't depend on the host zone.
- [ ] **Step 5: Commit** `feat(api): add timezone-aware venue booking rules (#4)`

### Task 3: One bookability policy, adopted by Open Play

**Files:**
- Create: `apps/api/src/courts/court-bookability.ts`, `apps/api/src/courts/court-bookability.spec.ts`
- Modify: `apps/api/src/open-play/open-play.repository.ts` (`openPlayViewableWhere`), `open-play.repository.spec.ts` (~108, ~224), `open-play.integration.spec.ts`

**Interfaces (Produces):**
- `bookableCourtWhere(): Prisma.CourtWhereInput`, which returns exactly `{ status: 'ACTIVE', venue: { status: 'ACTIVE', tenant: { status: 'ACTIVE' } } }`. This is the only spelling of the rule.
- `openPlayViewableWhere()` returns `{ ...openPlayLiveScalars(), court: bookableCourtWhere() }`. Management reads (`findById`, cancel, leave, enable, visibility) stay unfiltered.

- [ ] **Step 1: Write the failing tests:**
  - `court-bookability.spec.ts`: `it('requires an ACTIVE court, venue and tenant')` asserts the exact object above.
  - `open-play.repository.spec.ts`: change the viewable-builder expectation (and the `listPublic` `where` expectation at ~224) to `court: bookableCourtWhere()`.
  - `open-play.integration.spec.ts`:
    - Change `tenant()` to create `status: 'ACTIVE'`, and extend `court()`/`openPlay()` with optional `courtStatus` and `tenantStatus`, so existing joinable fixtures sit at ACTIVE tenants.
    - Add `it('hides games on a MAINTENANCE court or at a SUSPENDED tenant from discovery, token/id reads, and joins')`. For each of the two games: it's absent from `listPublic`, `findViewableByToken`/`findViewableById` return `null`, `joinSeat(...).kind === 'NOT_JOINABLE'`, and `findById` is still non-null.
- [ ] **Step 2: Run** `npm run test -w api -- court-bookability open-play`. Expected: FAIL. The bookability module is missing, and the new integration test lists and joins the MAINTENANCE/SUSPENDED-tenant games.
- [ ] **Step 3: Implement** `court-bookability.ts` and switch `openPlayViewableWhere()` to it.
- [ ] **Step 4: Run** `npm run test -w api -- court-bookability open-play`. Expected: PASS, with 0 skipped suites.
- [ ] **Step 5: Commit** `fix(api): require ACTIVE court, venue and tenant for Open Play view and join (#6)`

### Task 4: Venue booking-settings API and venue timezone validation

**Files:**
- Modify: `packages/shared/api/venues.d.ts`, `packages/shared/index.d.ts`
- Create: `apps/api/src/venues/dto/put-venue-booking-settings.dto.ts` (export it from `dto/index.ts`), `apps/api/src/venues/venue-booking-settings.repository.ts`, `venue-booking-settings.service.ts`, `venue-booking-settings.service.spec.ts`, `venue-booking-settings.http.spec.ts`, `apps/api/src/venues/dto/venue-dtos.spec.ts`
- Modify: `apps/api/src/venues/venues.controller.ts`, `venues.module.ts`, `venues.controller.spec.ts`, `dto/create-venue.dto.ts`, `dto/update-venue.dto.ts`

**Interfaces:**
- Consumes (Task 2): `BookingRules`, `DEFAULT_VENUE_BOOKING_SETTINGS`, `HH_MM_PATTERN`, `MAX_BOOKING_DURATION_HOURS`, `MAX_HORIZON_DAYS`, `parseHhMm`, `formatHhMm`, `validateBookingSettings`, `bookingRulesFromRecord`, `weeklyWindowsToRows`, `WEEKDAY_KEYS`. Consumes `AuthorizationService.assertCanManageVenue(actorId, tenantId, venueId)` and `VenuesRepository.findById`.
- **Shared** (exported from `index.d.ts`): `BookingStartAlignment = "HOUR" | "HALF_HOUR"`, `DayHours`, `WeeklyHours`, `PutVenueBookingSettingsRequest` and `VenueBookingSettingsResponse`, exactly as in the design's "Shapes".
- **DTO** `PutVenueBookingSettingsDto implements PutVenueBookingSettingsRequest`:
  - `minDurationHours`/`maxDurationHours`: `@IsInt() @Min(1) @Max(MAX_BOOKING_DURATION_HOURS)`.
  - `horizonDays`: `@IsInt() @Min(1) @Max(MAX_HORIZON_DAYS)`.
  - `startAlignment`: `@IsIn(['HOUR', 'HALF_HOUR'])`.
  - `weeklyHours`: `@IsDefined() @ValidateNested() @Type(() => WeeklyHoursDto)`.
  - `WeeklyHoursDto` has seven properties. Each is `@ValidateIf((_, v) => v !== null) @IsDefined() @ValidateNested() @Type(() => DayHoursDto)`, so `null` means closed and a missing key is a 400.
  - `DayHoursDto`: `opensAt`/`closesAt` with `@Matches(HH_MM_PATTERN)`.
- **Venue DTOs:** `timezone` gets `@IsTimeZone()` in `CreateVenueDto` and `UpdateVenueDto`.
- **Repository** `VenueBookingSettingsRepository` (Prisma only):
  - `findByVenueId(venueId: string): Promise<BookingSettingsRecord | null>`, including `openingHours`.
  - `replace(venueId: string, rules: BookingRules): Promise<BookingSettingsRecord>`: one interactive `$transaction` that upserts the settings row, deletes its hour rows, `createMany` from `weeklyWindowsToRows`, and returns the re-read record.
  - `deleteByVenueId(venueId: string): Promise<void>`, via `deleteMany`, so it's idempotent.
- **Service** `VenueBookingSettingsService`:
  - `get(venueId: string): Promise<VenueBookingSettingsResponse>`: 404 for an unknown venue (same message as `VenuesService.findById`).
  - `put(actorId: string, venueId: string, dto: PutVenueBookingSettingsDto): Promise<VenueBookingSettingsResponse>`: 404, then `assertCanManageVenue`, then dto → `BookingRules` via `parseHhMm`, then `validateBookingSettings` (a non-null result throws `BadRequestException(message)`), then `replace`.
  - `remove(actorId: string, venueId: string): Promise<void>`: 404, assert, delete.
  - The response is `{ venueId, timezone: venue.timezone, isDefault: record === null, minDurationHours, maxDurationHours, horizonDays, startAlignment, weeklyHours }`, with closed days as `null` and times formatted with `formatHhMm`.
- **Controller** (on `VenuesController`, unversioned like the other venue routes):
  - `@Get(':id/booking-settings')`
  - `@Put(':id/booking-settings')`, which takes `@Session()`
  - `@Delete(':id/booking-settings') @HttpCode(204)`, which takes `@Session()`
- `VenuesModule` adds both providers.

- [ ] **Step 1: Write the failing tests:**
  - **`venue-dtos.spec.ts`** (`plainToInstance` + `validate`):
    - `CreateVenueDto`/`UpdateVenueDto` with `timezone: 'Mars/Phobos'` → error; `'Asia/Kolkata'` → none.
    - `PutVenueBookingSettingsDto`: valid body → none.
    - Each of these → error: `minDurationHours: 0`, `maxDurationHours: 25`, `horizonDays: 366`, `startAlignment: 'QUARTER'`, `opensAt: '6:00'`, `'06:15'`, `'24:00'`, `weeklyHours` with `sunday` missing.
    - `sunday: null` → none.
  - **`venue-booking-settings.service.spec.ts`** (mocked repositories and authorization):
    - `get` with no record → `isDefault: true` and the default values (06:00–00:00 every day).
    - `put` runs the 404 check before the authorization call.
    - `put` with a spill overlap → `BadRequestException` with the `validateBookingSettings` message, and `replace` isn't called.
    - `remove` calls `assertCanManageVenue` with the venue's `tenantId`.
  - **`venue-booking-settings.http.spec.ts`** (`describeIfDb`):
    - GET signed out → 401. GET as a customer → 200 with `isDefault: true`, `minDurationHours: 1`, `maxDurationHours: 8`, `horizonDays: 60`, `startAlignment: 'HOUR'`, and every day `{ opensAt: '06:00', closesAt: '00:00' }`. GET of an unknown id → 404.
    - PUT and DELETE as OWNER, tenant-wide STAFF and venue STAFF → 200 / 204.
    - PUT and DELETE as a customer, STAFF of a sibling venue, and OWNER of another tenant → 403, with no settings row written.
    - PUT with `maxDurationHours < minDurationHours`, a spill overlap, a window shorter than the minimum, or a bad time format → 400.
    - PUT then GET round-trips, with closed days `null` and `isDefault: false`. DELETE then GET → `isDefault: true`.
    - **Review Focus 3:** PUT with all seven days `null` → GET returns all `null` and `isDefault: false`.
    - **Review Focus 5:** PUT on a PENDING venue → 200. DELETE twice → 204 both times.
    - Deleting the venue (`DELETE /venues/:id` as owner) removes its settings rows.
- [ ] **Step 2: Run** `npm run test -w api -- venue-booking-settings venue-dtos`. Expected: FAIL (missing modules and routes).
- [ ] **Step 3: Implement** the shared types, DTOs, repository, service, controller routes and module wiring.
- [ ] **Step 4: Run** `npm run test -w api -- venues venue-booking-settings venue-dtos`. Expected: PASS. Then run `npm run typecheck -w web`. Expected: exit 0.
- [ ] **Step 5: Commit** `feat(api): add per-venue booking settings API and validate venue timezones (#4)`

### Task 5: Locked create-booking with session ownership and bookability

**Files:**
- Create: `apps/api/src/prisma/interactive-transaction.ts`, `apps/api/src/prisma/interactive-transaction.spec.ts`, `apps/api/src/test-support/booking-times.ts`, `apps/api/src/court-book/court-book.http.spec.ts`
- Modify:
  - `apps/api/src/court-book/court-book.controller.ts`, `court-book.service.ts`, `court-book.repository.ts`, `court-book.module.ts`, `dto/create-court-booking.dto.ts`
  - `court-book.controller.spec.ts`, `court-book.service.spec.ts`, `court-book.repository.spec.ts`, `dto/create-court-booking.dto.spec.ts`
  - `apps/api/src/models/create-booking.model.ts`
  - `apps/api/src/constants/error-code.constant.ts`
  - `apps/api/src/open-play/open-play.repository.ts`, `open-play.repository.spec.ts`, `open-play.integration.spec.ts` (~442–503)
  - `packages/shared/api/court-book.d.ts`
- Delete: `apps/api/src/helper/date-time.helper.ts` (its only user is the old service)

**Interfaces:**
- Consumes: `bookableCourtWhere()` (Task 3); `toInstant` and `localParts` (Task 2, test helper only); `HttpFixtures.createBookableCourt`, `createTenant/createVenue/createCourt` with statuses (Task 1).
- **`interactive-transaction.ts`:** `INTERACTIVE_TX_OPTIONS = { maxWait: 5_000, timeout: 10_000 } as const` and `isRetryableTransactionError(error: unknown): boolean`, moved verbatim from `open-play.repository.ts`. Open Play imports both. `OPEN_PLAY_TX_OPTIONS` is deleted, and the specs reference the new name.
- **Models:** `CreateCourtSchedule.bookedDate: Date` and `CreateCourtBooking.bookDate: Date`. Field order is otherwise unchanged; `userEmail` stays, filled from the session.
- **`court-book.repository.ts`:**
  - `occupiedOverlapWhere(courtId: string, start: Date, end: Date): Prisma.CourtScheduleWhereInput` (exported function) returns `{ courtId, bookedDate: { lt: end }, dateTimeVacant: { gt: start }, isVacant: false }`. It's the only spelling of the overlap predicate.
  - `type ReserveCourtOutcome = { kind: 'CREATED'; bookingId: string } | { kind: 'COURT_NOT_BOOKABLE' } | { kind: 'SLOT_TAKEN' } | BusyOutcome`. Re-export `BusyOutcome` from Open Play, or define `{ kind: 'BUSY' }` locally.
  - `reserveCourt(args: { schedule: CreateCourtSchedule; booking: CreateCourtBooking; now: Date }): Promise<ReserveCourtOutcome>`. One `$transaction(work, INTERACTIVE_TX_OPTIONS)`:
    1. `tx.court.updateMany({ where: { id, venueId, status: 'ACTIVE' }, data: { updatedAt: now } })`, a scalar-only `where`; `count === 0` → `COURT_NOT_BOOKABLE`.
    2. `tx.court.findFirst({ where: { id, ...bookableCourtWhere() }, select: { id: true } })`; `null` → `COURT_NOT_BOOKABLE`.
    3. `tx.courtSchedule.count({ where: occupiedOverlapWhere(...) }) > 0` → `SLOT_TAKEN`.
    4. Create the schedule, then the booking. For Open Play, include the nested booker seat as today.

    Retryable errors map to `BUSY`; anything else is rethrown. Its JSDoc says that any future write path that occupies a schedule must go through this method.
  - `findUserIdByEmail`, `hasConflictBooking` and `createCourtBooking` are deleted.
- **Service:** `createBookingRoute(venueId: string, payload: CreateCourtBookingDto, owner: { id: string; email: string }): Promise<CreateBookingResponse>`. The order is:
  1. Invalid private options → 400 (existing).
  2. Court pre-read via `CourtsRepository.findById` → 404 (existing message).
  3. Compute `start = new Date(date)`, `end = start + rentDuration × CommonConstants.HOURS_TO_MS`, the reference id and the token.
  4. Call `reserveCourt` with `now = new Date()`.
  5. Map the outcome:
     - `COURT_NOT_BOOKABLE` → `ConflictException(BOOKING_MESSAGES.COURT_NOT_BOOKABLE)`
     - `SLOT_TAKEN` → `ConflictException(BOOKING_MESSAGES.COURT_UNAVAILABLE)`
     - `BUSY` → `ConflictException(BOOKING_MESSAGES.BUSY)`

  Delete the "deferred gap" comment and the email/session check.
- **Controller** passes `{ id: session.user.id, email: session.user.email }`.
- **DTO and shared:** remove `email` from `CreateCourtBookingDto` and from `CreateCourtBookingRequest`.
- **Messages:** add `BOOKING_MESSAGES.COURT_NOT_BOOKABLE = "This court isn't taking bookings right now."` and `BOOKING_MESSAGES.BUSY = 'Lots of players are booking this court right now. Please try again in a moment.'`. Delete `OPEN_PLAY_MESSAGES.EMAIL_MISMATCH`.
- **`booking-times.ts`** (test support):
  - `localSlot(timeZone: string, daysAhead: number, minuteOfDay: number): Date`: the local date of now plus `daysAhead` calendar days, at `minuteOfDay`, via `toInstant`.
  - `nextLocalWeekday(timeZone: string, weekday: WeekdayKey, minuteOfDay: number, minLeadMs: number): Date`: the first such local slot more than `minLeadMs` after now.

- [ ] **Step 1: Write the HTTP suite** `court-book.http.spec.ts` (`describeIfDb`, `jest.setTimeout(60_000)`).
  - **Requests:** POST `/v1/booking/create-booking` with headers `Cookie` and `X-Venue-Id`, and body `{ courtId, date, rentDuration, isOpenPlay: false, email: <caller's email> }`. The `email` field lets the RED run against the pre-fix code reach the race; the fixed API strips it.
  - **Times:** all start times are `localSlot('Asia/Manila', 1, 600)` (tomorrow 10:00 Manila) or offsets from it.
  - **Tests:**
    - `it('lets exactly one of 8 concurrent overlapping requests from different users win')`: 8 signed-in users fire at once (`Promise.all`) with 1–2h overlapping intervals on one bookable court. Expect exactly one `201`; every other response is `409` with a message of `COURT_UNAVAILABLE` or `BUSY`. Exactly one row matches `occupiedOverlapWhere(courtId, slot, slot + 3h)`.
    - `it('blocks a request on the court lock and rejects it once the holder commits an overlap')`:
      1. Open `fixtures.db.$transaction(async (tx) => { … }, { maxWait: 5_000, timeout: 30_000 })`. Inside it, lock the court with the same `updateMany` shape, create an occupied overlapping `courtSchedule`, signal, then await a release promise.
      2. Start the HTTP request (call `.then()` so it's sent).
      3. Poll `fixtures.db.$queryRaw` on `pg_stat_activity` (`datname = current_database() AND wait_event_type = 'Lock' AND query LIKE 'UPDATE "public"."Court"%'`) every 50 ms, for up to 5 s. `blocked` = whether a waiter appeared.
      4. Release, await the holder and the response, then count the occupied overlaps.
      5. Assert once: `expect({ blocked, status, occupied }).toEqual({ blocked: true, status: 409, occupied: 1 })`.
    - **Controls:** two different courts at the same slot, concurrently → both `201`. Back-to-back 10:00–11:00 and 11:00–12:00 on one court → both `201`. A slot whose only schedule row has `isVacant: true` → `201`.
    - **Ownership:** body `email` naming another signed-up user → `201`, and the stored `courtBooking` and `courtSchedule` have the caller's `userId` and `userEmail`.
    - **Bookability:** court `MAINTENANCE` / `INACTIVE`, venue `SUSPENDED` / `PENDING`, tenant `SUSPENDED` / `PENDING` (each on its own court) → `409`, `message === BOOKING_MESSAGES.COURT_NOT_BOOKABLE`, and zero schedule rows on that court. All ACTIVE → `201`. Then set that court to `MAINTENANCE`: the earlier booking's `isActive` is still `true`, and its schedule's `isVacant` is still `false`.
- [ ] **Step 2: Run the suite against the pre-fix behaviour** (`npm run test -w api -- court-book.http`) and **paste the RED output into the task report.** Expected: FAIL.
  - To let the suite compile, first add only the inert pieces it imports: the two new `BOOKING_MESSAGES` constants, the `occupiedOverlapWhere` export (unused by app code yet), and `booking-times.ts`. No service, repository-method, DTO or controller change is allowed before this run.
  - Required RED evidence:
    - the burst test shows more than one `201` (re-run up to 3 times if it happens to serialize)
    - the deterministic test shows `{ blocked: false, status: 201, occupied: 2 }`
    - ownership stores the other user's id
    - bookability returns `201`
- [ ] **Step 3: Update the unit specs** to the new interfaces, and confirm they fail:
  - `court-book.service.spec.ts`:
    - the owner comes from the `owner` argument
    - a payload carrying `email` doesn't change the owner
    - each `ReserveCourtOutcome` maps to the status and message above
    - there's no pre-transaction conflict call
    - the 404 pre-read runs before `reserveCourt`
    - drop the `EMAIL_MISMATCH` tests
  - `court-book.repository.spec.ts`: `reserveCourt` with a mocked `$transaction(fn)` covers `count 0` → `COURT_NOT_BOOKABLE`, `findFirst null` → `COURT_NOT_BOOKABLE`, `count > 0` → `SLOT_TAKEN`, an Open Play nested seat, and P2034 → `BUSY`.
  - `interactive-transaction.spec.ts`: P2028, P2034 and a `40P01` message are retryable; P2002 isn't. Also assert the options' values.
  - `dto/create-court-booking.dto.spec.ts`: `email` is no longer a declared property.

  Run `npm run test -w api -- court-book interactive-transaction`. Expected: FAIL.
- [ ] **Step 4: Implement** everything in the Interfaces. Replace `courtBookRepo.hasConflictBooking(...)` in `open-play.integration.spec.ts` with `db.courtSchedule.count({ where: occupiedOverlapWhere(courtId, start, end) }) > 0`. Remove the `DateTimeHelper` provider and file.
- [ ] **Step 5: Run** the test-DB preamble, then `npm run test -w api -- court-book interactive-transaction open-play`. Expected: PASS. Also run `npm run typecheck -w web`. Expected: exit 0.
- [ ] **Step 6: Commit** (two commits are fine):
  - `fix(api): reserve courts under a row lock and own bookings by session (#3, #5, #6)`
  - `refactor: drop email from the create-booking contract (#5)`

### Task 6: Enforce venue rules and interval bounds on create

**Files:**
- Modify: `apps/api/src/court-book/dto/create-court-booking.dto.ts`, `dto/create-court-booking.dto.spec.ts`, `court-book.repository.ts`, `court-book.repository.spec.ts`, `court-book.service.ts`, `court-book.service.spec.ts`, `apps/api/src/constants/error-code.constant.ts`, `apps/api/src/open-play/open-play.integration.spec.ts`
- Create: `apps/api/src/court-book/court-book-rules.http.spec.ts`

**Interfaces:**
- Consumes: `evaluateBookingRules`, `bookingRulesFromRecord`, `isValidTimeZone`, `BookingRuleViolation` and `MAX_BOOKING_DURATION_HOURS` (Task 2); `reserveCourt` (Task 5); `HttpFixtures.setBookingSettings` and `booking-times.ts`.
- **DTO:**
  - `rentDuration`: `@IsInt() @Min(1) @Max(MAX_BOOKING_DURATION_HOURS)`, with `@IsNumber()` removed.
  - `date`: `@IsISO8601({ strict: true })` plus `@Matches(COMPLETE_INSTANT_PATTERN)`, where the exported `COMPLETE_INSTANT_PATTERN = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2}(\.\d{1,3})?)?(Z|[+-]\d{2}:\d{2})$/`. Drop `@IsDateString()`.
- **Repository:** `ReserveCourtOutcome` gains `| { kind: 'RULE_VIOLATION'; code: BookingRuleViolation }`. In `reserveCourt` step 2, the under-lock `findFirst` now selects `venue: { select: { timezone: true, bookingSettings: { select: { minDurationHours, maxDurationHours, horizonDays, startAlignment, openingHours: { select: { weekday, opensAtMinute, closesAtMinute } } } } } }`. After the bookability check:
  1. `!isValidTimeZone(tz)` → `COURT_NOT_BOOKABLE`.
  2. `evaluateBookingRules({ start: schedule.bookedDate, durationHours: schedule.hoursBooked, now, timeZone: tz, rules: bookingRulesFromRecord(settings) })`; non-null → `RULE_VIOLATION`.
  3. Then the overlap check.
- **Service:** `RULE_VIOLATION` → `BadRequestException(BOOKING_MESSAGES[code])`.
- **Messages** (`BOOKING_MESSAGES`, keyed by the violation codes):
  - `START_IN_PAST: 'Bookings must start in the future.'`
  - `BEYOND_HORIZON: "This venue doesn't take bookings that far ahead."`
  - `DURATION_OUT_OF_RANGE: "This venue doesn't allow bookings of that length."`
  - `NOT_SLOT_ALIGNED: 'Bookings at this venue must start on a time slot boundary.'`
  - `OUTSIDE_OPENING_HOURS: "The court isn't open for the whole of that time."`

- [ ] **Step 1: Write the failing tests:**
  - **DTO spec:**
    - `rentDuration` `0`, `-1`, `2.5`, `25` and `'2'` → error; `1` and `24` → none.
    - `date` `'2026-11-10'`, `'2026-11-10T10:00:00'`, `'garbage'` and `'2026-02-30T10:00:00Z'` → error; `'2026-11-10T10:00:00Z'` and `'2026-11-10T10:00:00+08:00'` → none.
  - **Repository spec:** an invalid stored timezone → `COURT_NOT_BOOKABLE`; a rule violation → `{ kind: 'RULE_VIOLATION', code }` with no `create` calls; rules are evaluated before the overlap count.
  - **Service spec:** each of the five codes maps to `BadRequestException` with its message.
  - **`court-book-rules.http.spec.ts`** (`describeIfDb`, a fresh bookable court per case, and after each rejection `courtSchedule.count({ where: { courtId } }) === 0` and `courtBooking.count(...) === 0`):
    - **Default venue:**
      - tomorrow 05:00 → 400 `OUTSIDE_OPENING_HOURS`
      - 23:00 + 1h → 201; 23:00 + 2h → 400 `OUTSIDE_OPENING_HOURS`
      - 10:00 + 9h → 400 `DURATION_OUT_OF_RANGE`
      - `localSlot(tz, 61, 600)` → 400 `BEYOND_HORIZON`
    - **Configured venue:** `setBookingSettings` with Saturday `{360, 180}` only, `HALF_HOUR`, min 1, max 3, horizon 7.
      - `nextLocalWeekday('Asia/Manila', 'sunday', 90, HOUR)` + 1h → 201
      - next Saturday 10:30 + 1h → 201
      - next Saturday 10:00 + 4h → 400 `DURATION_OUT_OF_RANGE`
      - a Saturday 8+ days ahead → 400 `BEYOND_HORIZON`
    - **Closed every day (Review Focus 3):** settings with zero hour rows → tomorrow 10:00 → 400 `OUTSIDE_OPENING_HOURS`.
    - **Shape:** a start one hour in the past → 400 `START_IN_PAST`. `rentDuration` `0` and `-1` → 400. A date-only `date` → 400.
    - **Review Focus 1:** a booking sent as `…T10:00:00+08:00` for tomorrow → 201, and the stored `bookDate` equals `localSlot('Asia/Manila', 1, 600)`.
    - **Review Focus 2:** a venue whose `timezone` is set directly to `'Not/AZone'` via `fixtures.db` → 409 `COURT_NOT_BOOKABLE`.
    - **Open Play hosting:**
      - `isOpenPlay: true` at a valid slot → 201, with one `openPlaySeat` `{ userId: caller, isBooker: true }`
      - `isOpenPlay: true` outside hours → 400 `OUTSIDE_OPENING_HOURS`, and no booking or seat
  - **`open-play.integration.spec.ts`:** `it('keeps a game joinable after its venue hours change to exclude its slot')`. Create a game, then `db.venueBookingSettings.create({ data: { venueId, minDurationHours: 1, maxDurationHours: 8, horizonDays: 60, startAlignment: 'HOUR' } })` with no hour rows, which closes its venue every day. `joinSeat(...).kind === 'JOINED'`. This is a regression pin and may pass immediately; note that in the report.
- [ ] **Step 2: Run** `npm run test -w api -- court-book`. Expected: FAIL. The DTO accepts bad shapes, and the HTTP rules cases return 201.
- [ ] **Step 3: Implement** the DTO bounds, the under-lock rule evaluation, the outcome mapping and the messages.
- [ ] **Step 4: Run** `npm run test -w api -- court-book open-play booking-rules`. Expected: PASS, with 0 skipped suites.
- [ ] **Step 5: Commit** `fix(api): enforce venue booking rules and interval bounds under the court lock (#4)`

### Task 7: Final verification and hosted deploy

- [ ] **Step 1: Replay migrations** onto an empty test DB: `cd apps/api && DATABASE_URL="$TEST_DATABASE_URL" npx prisma migrate reset --force` (Prisma 7 rejects `--skip-seed`). Expected: every migration applies, including `add_venue_booking_settings`. Then `npm run db:generate` from the root.
- [ ] **Step 2: Run the full API suite** with the preamble: `npm run test -w api -- --runInBand`. Expected: **0 failed and 0 skipped** suites and tests.
- [ ] **Step 3: Run** `npm run typecheck && npm run build -w api && npm run build -w web`. Expected: all exit 0. Then `git checkout apps/web/next-env.d.ts` if it changed.
- [ ] **Step 4: Run** `npm run lint -w web`. Expected: no errors, and no more warnings than the Task 1 baseline.
- [ ] **Step 5: Run the API lint check on touched files only** (no `--fix`): `cd apps/api && npx eslint $(git diff --name-only --diff-filter=d <task-1-start-sha>..HEAD -- src | grep '\.ts$' | sed 's#^apps/api/##')`. Expected: for files that existed before, no more errors than the Task 1 baseline; for new files, 0 errors.
- [ ] **Step 6: Run the greps.** `git grep -n "EMAIL_MISMATCH\|findUserIdByEmail\|hasConflictBooking\|DateTimeHelper\|OPEN_PLAY_TX_OPTIONS" -- apps packages` → no matches. `git grep -n "status: 'ACTIVE'" -- apps/api/src/court-book apps/api/src/open-play/open-play.repository.ts` → only the scalar lock `where` in `reserveCourt`. This shows the bookability rule is spelled once.
- [ ] **Step 7: Apply the migration to the hosted dev DB.** From `apps/api`, with its `.env` `DATABASE_URL`:
  1. Run `npx prisma migrate status`. If it reports anything other than exactly `…_add_venue_booking_settings` pending (drift, failed migrations, other pending migrations), **stop** and report the output.
  2. Otherwise run `npx prisma migrate deploy`.
  3. If deploy fails, don't edit the migration and don't reset. Report the exact error.
- [ ] **Step 8: Report:**
  - the commit list
  - the test counts
  - the Task 5 RED evidence
  - the migration folder name
  - the lint numbers against the baselines
  - the hosted `migrate status`/`deploy` output
  - a reminder that a platform admin must set a tenant ACTIVE before its venues take bookings
