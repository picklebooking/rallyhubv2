# Booking integrity verification — Task 7

Date: 2026-11-07. Branch: `fix/system-audit-remediation`.
Task 1 start / final-review base: `3a1361a`. Verified implementation head: `1442cac`.
Task 7 changes only this verification report; no production code or dependencies changed.
Prior tasks were independently approved. This verification task adds no behavior requiring a new RED test.

## Implementation commits

```text
0d357d1 feat(api): add venue booking settings schema and booking fixtures (#4)
5865cfe feat(api): add timezone-aware venue booking rules (#4)
7cb480d fix(api): require ACTIVE court, venue and tenant for Open Play view and join (#6)
a918a13 feat(api): add per-venue booking settings API and validate venue timezones (#4)
92b86fa fix(api): reserve courts under a row lock and own bookings by session (#3, #5, #6)
1442cac fix(api): enforce venue booking rules and interval bounds under the court lock (#4)
```

## Ordered local verification

Every local DB/Jest operation exported `TEST_DATABASE_URL=postgresql://jpatrickzxc@localhost:5432/rallyhub_test` and unset `AUTH_DEV_BYPASS_EMAIL` in the same shell. Local Prisma, generation, and builds explicitly used `DATABASE_URL="$TEST_DATABASE_URL"`. Reset reused the persisted exact user consent in `PRISMA_USER_CONSENT_FOR_DANGEROUS_AI_ACTION`; AI identity was retained.

| Order | Command | Cwd | Result |
| --- | --- | --- | --- |
| 1 | `DATABASE_URL="$TEST_DATABASE_URL" npx prisma migrate reset --force` | apps/api | Exit 0; actual reset successful; all 19 migrations replayed |
| 2 | `DATABASE_URL="$TEST_DATABASE_URL" npm run db:generate` | root | Exit 0 |
| 3 | `npm run test -w api -- --runInBand` | root | Exit 0; 51 suites and 649 tests passed; zero failed or skipped |
| 4 | `npm run typecheck` | root | Exit 0; all four configured tasks succeeded |
| 5 | `npm run build -w api` | root | Exit 0 |
| 6 | `npm run build -w web` | root | Exit 0 |
| 7 | Restore build-only `apps/web/next-env.d.ts` rewrite | root | Exit 0; file excluded from commit |
| 8 | `npm run lint -w web` | root | Exit 0; 0 errors / 15 warnings, equal to Task 1 baseline |
| 9 | `npx eslint --format json` on touched API TypeScript files, without fix | apps/api | Exit 0; 40 files, 0 errors / 1 warning |
| 10 | Legacy symbol grep, ACTIVE grep, migration SHA256 | root | Passed; details below |

The root typecheck command uses Turborepo's configured workspace execution; separate verification commands were sequential. Auth-bypass unit specs deliberately exercise the bypass and emit warnings; the outer test environment had the variable unset.

API file list was collected from root with `git diff --name-only --diff-filter=d 3a1361a..HEAD`, restricted to existing `apps/api/src/**/*.ts`, then made relative to apps/api for ESLint. 18 new files have zero errors and warnings. Every existing file is at or below its saved Task 1 per-file error and warning count; untouched baseline scopes were not linted. Baseline all API scopes: 194 errors / 14 warnings. The sole remaining touched-file warning is the existing service warning.

| File | Task 1 baseline errors/warnings | Current errors/warnings |
| --- | --- | --- |
| apps/api/src/constants/error-code.constant.ts | 0/0 | 0/0 |
| apps/api/src/court-book/booking-rules.spec.ts | new | 0/0 |
| apps/api/src/court-book/booking-rules.ts | new | 0/0 |
| apps/api/src/court-book/court-book-rules.http.spec.ts | new | 0/0 |
| apps/api/src/court-book/court-book.controller.spec.ts | 0/0 | 0/0 |
| apps/api/src/court-book/court-book.controller.ts | 2/0 | 0/0 |
| apps/api/src/court-book/court-book.http.spec.ts | new | 0/0 |
| apps/api/src/court-book/court-book.module.ts | 21/0 | 0/0 |
| apps/api/src/court-book/court-book.repository.spec.ts | 0/0 | 0/0 |
| apps/api/src/court-book/court-book.repository.ts | 0/0 | 0/0 |
| apps/api/src/court-book/court-book.service.spec.ts | 0/0 | 0/0 |
| apps/api/src/court-book/court-book.service.ts | 1/1 | 0/1 |
| apps/api/src/court-book/dto/create-court-booking.dto.spec.ts | 0/0 | 0/0 |
| apps/api/src/court-book/dto/create-court-booking.dto.ts | 0/0 | 0/0 |
| apps/api/src/courts/court-bookability.spec.ts | new | 0/0 |
| apps/api/src/courts/court-bookability.ts | new | 0/0 |
| apps/api/src/models/create-booking.model.ts | 0/0 | 0/0 |
| apps/api/src/open-play/open-play.integration.spec.ts | 0/0 | 0/0 |
| apps/api/src/open-play/open-play.repository.spec.ts | 0/0 | 0/0 |
| apps/api/src/open-play/open-play.repository.ts | 0/0 | 0/0 |
| apps/api/src/prisma/interactive-transaction.spec.ts | new | 0/0 |
| apps/api/src/prisma/interactive-transaction.ts | new | 0/0 |
| apps/api/src/test-support/booking-times.ts | new | 0/0 |
| apps/api/src/test-support/fixtures.ts | 0/0 | 0/0 |
| apps/api/src/test-support/http-app.ts | 0/0 | 0/0 |
| apps/api/src/venues/dto/create-venue.dto.ts | 0/0 | 0/0 |
| apps/api/src/venues/dto/index.ts | 0/0 | 0/0 |
| apps/api/src/venues/dto/put-venue-booking-settings.dto.ts | new | 0/0 |
| apps/api/src/venues/dto/update-venue.dto.ts | 0/0 | 0/0 |
| apps/api/src/venues/dto/venue-dtos.spec.ts | new | 0/0 |
| apps/api/src/venues/dto/venue-timezone.spec.ts | new | 0/0 |
| apps/api/src/venues/venue-booking-settings.http.spec.ts | new | 0/0 |
| apps/api/src/venues/venue-booking-settings.repository.ts | new | 0/0 |
| apps/api/src/venues/venue-booking-settings.schema.integration.spec.ts | new | 0/0 |
| apps/api/src/venues/venue-booking-settings.service.spec.ts | new | 0/0 |
| apps/api/src/venues/venue-booking-settings.service.ts | new | 0/0 |
| apps/api/src/venues/venue-booking-settings.test-support.ts | new | 0/0 |
| apps/api/src/venues/venues.controller.spec.ts | 0/0 | 0/0 |
| apps/api/src/venues/venues.controller.ts | 0/0 | 0/0 |
| apps/api/src/venues/venues.module.ts | 0/0 | 0/0 |

Touched 40 files; errors=0, warnings=1. All existing files meet per-file baseline; every new file has zero errors. Baseline all API scopes: 194 errors / 14 warnings.


## Regression evidence and migration integrity

Task 5 pre-fix RED is retained in `/tmp/rallyhub-booking-task5/report.md` with full output: the eight-request burst produced seven 201s and seven occupied rows; the deterministic holder case produced `{ blocked: false, status: 201, occupied: 2 }`. Spoofed ownership and all six unavailable-status cases also failed against old behavior. The same scheduling gate remains in GREEN. This final full-suite run produced one burst winner and one occupied row, and deterministic `{ blocked: true, status: 409, occupied: 1 }`; owners matched the caller and unavailable statuses returned 409.

Migration: `20261107080047_add_venue_booking_settings`. Generated SQL SHA256 remains `5e094d961a6b5cd33da2f10a410664dd2756ceb677212a6fb63f1ec4896904be`, identical to immediate Task 1 generation. No migration SQL was edited.

Literal `git grep -n "EMAIL_MISMATCH\|findUserIdByEmail\|hasConflictBooking\|DateTimeHelper\|OPEN_PLAY_TX_OPTIONS" -- apps packages` returned exit 1 with no matches. ACTIVE grep returned three matches: fixture lock setup in `court-book.http.spec.ts:125`, unit lock expectation in `court-book.repository.spec.ts:94`, and production scalar lock in `court-book.repository.ts:74`. Excluding specs leaves exactly the intended scalar court lock, without duplicating the shared bookability policy.

## Hosted migration

All local gates above passed before hosted access. Each command ran from apps/api in a fresh shell with `unset DATABASE_URL TEST_DATABASE_URL AUTH_DEV_BYPASS_EMAIL`, allowing Prisma config dotenv to read the original `apps/api/.env` DATABASE_URL. Credentials were not printed. Exactly one status and one deploy ran; no hosted queries, tests, resets, development migrations, retries, or additional status calls ran.

`npx prisma migrate status` — exit 1 (normal pending-migration result). It reported exactly the expected new migration pending; deployment proceeded only after inspecting this output:

```text
Loaded Prisma config from prisma.config.ts.

Prisma schema loaded from prisma/schema.prisma.
Datasource "db": PostgreSQL database "postgres", schema "public" at "pooled.db.prisma.io:5432"

19 migrations found in prisma/migrations
Following migration have not yet been applied:
20261107080047_add_venue_booking_settings

To apply migrations in development run prisma migrate dev.
To apply migrations in production run prisma migrate deploy.
```

`npx prisma migrate deploy` — exit 0:

```text
Loaded Prisma config from prisma.config.ts.

Prisma schema loaded from prisma/schema.prisma.
Datasource "db": PostgreSQL database "postgres", schema "public" at "pooled.db.prisma.io:5432"

19 migrations found in prisma/migrations

Applying migration `20261107080047_add_venue_booking_settings`

The following migration(s) have been applied:

migrations/
  └─ 20261107080047_add_venue_booking_settings/
    └─ migration.sql

All migrations have been successfully applied.
```

## Evidence and operational reminder

Full local command/cwd/environment-source/exit/order transcript: `/tmp/rallyhub-booking-task7/command-transcript.md`. Logs: `01-reset.log`, `reset-full.log`, `02-generate.log`, `03-api-tests.log`, `04-typecheck.log`, `05-api-build.log`, `06-web-build.log`, `07-next-env-restore.log`, `08-web-lint.log`, `09-api-touched-lint.log`, `10-greps-checksum.log`, `11-hosted-status.log`, `12-hosted-deploy.log` in that directory. Machine-readable lint output: `api-lint.json`; exact file list: `api-touched-files.txt`; per-file comparisons: `api-lint-comparison.md`. Task 1 saved baselines are `/tmp/rallyhub-booking-task1/api-lint-baseline-counts.txt` and `api-lint-baseline.log`.

A platform admin must set a tenant **ACTIVE** before its venues accept bookings. Court, venue, and tenant must all be ACTIVE. Existing bookings remain unchanged by later status or hours changes.
