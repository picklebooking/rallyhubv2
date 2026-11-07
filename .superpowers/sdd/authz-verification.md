# Authorization remediation verification

Verified on 2026-11-07 on `fix/system-audit-remediation`, implementation HEAD `a25b2ef`.

## Outcome

- Empty local `rallyhub_test` database reset succeeded and replayed all 18 migrations.
- API tests: 40 suites passed, 454 tests passed; 0 failed suites/tests and 0 skipped suites/tests. The test database URL was explicitly exported and `AUTH_DEV_BYPASS_EMAIL` unset for the run.
- Root typecheck: exit 0, 4 tasks successful (3 cached).
- API build: exit 0; Prisma client generation and Nest build succeeded using the explicit local database environment.
- Web production build: exit 0; 13 static pages generated. Build-generated `apps/web/next-env.d.ts` changes were restored.
- Web lint: exit 0, 0 errors and 15 warnings, within the maximum of 17.
- `CUSTOMER` search across `apps/api/src`, `apps/web`, and `packages`: no matches.
- Removed user-directory symbols search across those paths: only the intentional `/users/all` HTTP regression assertion at `apps/api/src/users/users.http.spec.ts:31` remains.
- Migration `20261107045705_platform_admin_and_drop_customer_role` SQL SHA-256 remains `26f556e31ff571d68524f4728bd7323efde608a133744fd60ed90ed2f7c8ce62`, matching the original unedited Prisma output.
- Hosted DEV status was run exactly once and showed exactly that one pending migration (expected exit 1). Hosted DEV deploy was run exactly once and succeeded (exit 0). No additional hosted queries, tests, status checks, resets, or schema pushes were performed.

## Implementation commits

Eight implementation commits follow baseline `62df044`:

```text
3ac582e fix(api): add platform-admin flag and drop CUSTOMER role from database (#13)
8f97cfe feat(api): add shared management authorization policy (#1)
dc62f0a test(api): add HTTP test harness with real Better Auth sessions (#1)
1c54fd5 test(api): add HTTP test harness with real Better Auth sessions (#1)
e58a896 fix(api): restrict tenant management to platform admins and owners (#1)
c991248 fix(api): enforce tenant membership on venue management (#1)
d4035e6 fix(api): enforce venue membership on court management (#1)
a25b2ef fix: remove template user directory and /users/all endpoint (#2)
```

Task 8 adds one verification-only documentation commit. The plan omitted a Task 8 commit subject; the approved ruling is `docs: record authorization remediation verification (#1, #2, #13)`. Its only cost/scope is this extra documentation commit; no production code or tests changed in Task 8. TDD RED is not applicable to this verification-only task; preceding tasks contain the regression evidence. The final whole-branch review remains a separate step.

## Manual verification still required

Check the dashboard in both light and dark mode, including the removed recent-users area and navigation. Automated build and lint checks do not substitute for this visual check.

## Commands and retained output

All command logs, exit statuses, and this report are retained under `/tmp/rallyhub-authz-task8`. Test database operations used explicit `TEST_DATABASE_URL=postgresql://jpatrickzxc@localhost:5432/rallyhub_test` and `DATABASE_URL="$TEST_DATABASE_URL"`, with `AUTH_DEV_BYPASS_EMAIL` unset. Builds and typecheck also used that explicit local `DATABASE_URL`. Hosted commands ran from `apps/api` with inherited `DATABASE_URL` unset so Prisma loaded the original ignored `.env` configuration. No credentials are included below.

### Local replay: `npx prisma migrate reset --force`

Exit status: 0.

```text
Loaded Prisma config from prisma.config.ts.

Prisma schema loaded from prisma/schema.prisma.
Datasource "db": PostgreSQL database "rallyhub_test", schema "public" at "localhost:5432"

Applying migration `20260425085349_update_user_model`
Applying migration `20260425164804_add_user_clerk_fields`
Applying migration `20260910151627_replace_clerk_with_better_auth`
Applying migration `20260916151052_add_venue_tenant_models`
Applying migration `20260916154145_rename_venue_to_tenant`
Applying migration `20260916154736_rename_venue_to_tenant_and_trim_scope`
Applying migration `20260917062153_add_court_booking`
Applying migration `20260917210356_modify_columns_to_date_time`
Applying migration `20260918122918_modify_court_booking`
Applying migration `20260919011357_add_court_tenant_relations_and_booking_restrict`
Applying migration `20260919022556_add_user_relation_and_booking_pricing`
Applying migration `20260919065845_add_venue_layer`
Applying migration `20260919071628_fix_venue_booking_restrict`
Applying migration `20261003132850_add_tenantownername`
Applying migration `20261003233544_venue_scoped_composite_fks`
Applying migration `20261018120619_add_tenent_member_active_status`
Applying migration `20261018125328_add_open_play`
Applying migration `20261107045705_platform_admin_and_drop_customer_role`

Database reset successful

The following migration(s) have been applied:

migrations/
  └─ 20260425085349_update_user_model/
    └─ migration.sql
  └─ 20260425164804_add_user_clerk_fields/
    └─ migration.sql
  └─ 20260910151627_replace_clerk_with_better_auth/
    └─ migration.sql
  └─ 20260916151052_add_venue_tenant_models/
    └─ migration.sql
  └─ 20260916154145_rename_venue_to_tenant/
    └─ migration.sql
  └─ 20260916154736_rename_venue_to_tenant_and_trim_scope/
    └─ migration.sql
  └─ 20260917062153_add_court_booking/
    └─ migration.sql
  └─ 20260917210356_modify_columns_to_date_time/
    └─ migration.sql
  └─ 20260918122918_modify_court_booking/
    └─ migration.sql
  └─ 20260919011357_add_court_tenant_relations_and_booking_restrict/
    └─ migration.sql
  └─ 20260919022556_add_user_relation_and_booking_pricing/
    └─ migration.sql
  └─ 20260919065845_add_venue_layer/
    └─ migration.sql
  └─ 20260919071628_fix_venue_booking_restrict/
    └─ migration.sql
  └─ 20261003132850_add_tenantownername/
    └─ migration.sql
  └─ 20261003233544_venue_scoped_composite_fks/
    └─ migration.sql
  └─ 20261018120619_add_tenent_member_active_status/
    └─ migration.sql
  └─ 20261018125328_add_open_play/
    └─ migration.sql
  └─ 20261107045705_platform_admin_and_drop_customer_role/
    └─ migration.sql

```

### API tests: `npm run test -w api -- --runInBand`

Exit status: 0.

```text

> api@0.0.1 test
> node --experimental-vm-modules ../../node_modules/jest/bin/jest.js --runInBand

(node:44220) ExperimentalWarning: VM Modules is an experimental feature and might change at any time
(Use `node --trace-warnings ...` to show where the warning was created)
PASS src/courts/courts.http.spec.ts
PASS src/venues/venues.http.spec.ts
PASS src/tenant/tenant.http.spec.ts
PASS src/authorization/harness.http.spec.ts
PASS src/users/users.http.spec.ts
PASS src/test-support/http-app.spec.ts
PASS src/authorization/authorization.repository.spec.ts
PASS src/app.module.spec.ts
PASS src/open-play/open-play.integration.spec.ts
PASS src/court-book/court-book.integration.spec.ts
PASS src/court-book/court-book.controller.spec.ts
PASS src/tenant/tenant.controller.spec.ts
PASS src/authorization/authorization.repository.integration.spec.ts
PASS src/courts/courts.controller.spec.ts
PASS src/venues/venues.controller.spec.ts
PASS src/tenant-member/tenant-member.controller.spec.ts
PASS src/open-play/open-play.controller.spec.ts
PASS src/tenant-member/tenant-member.service.spec.ts
PASS src/tenant/tenant.service.spec.ts
PASS src/app.controller.spec.ts
PASS src/court-book/dto/create-court-booking.dto.spec.ts
PASS src/court-book/court-book.service.spec.ts
PASS src/common/middleware/tenant-context.middleware.spec.ts
PASS src/courts/courts.repository.spec.ts
PASS src/courts/courts.service.spec.ts
PASS src/court-book/court-book.repository.spec.ts
PASS src/open-play/open-play.service.spec.ts
PASS src/auth/auth.spec.ts
PASS src/venues/venues.service.spec.ts
PASS src/open-play/open-play.repository.spec.ts
PASS src/common/decorators/current-tenant.decorator.spec.ts
PASS src/common/decorators/current-venue.decorator.spec.ts
PASS src/auth/dev-auth-bypass.guard.spec.ts
PASS src/tenant-member/tenant-member.repository.spec.ts
[Nest] 44220  - 11/07/2026, 1:34:58 PM    WARN [AuthDevBypass] AUTH DEV BYPASS ACTIVE for "dev@example.com" — every request is treated as logged in as this user, and @AllowAnonymous() has no effect. Never set AUTH_DEV_BYPASS_EMAIL outside local development.
[Nest] 44220  - 11/07/2026, 1:34:58 PM    WARN [AuthDevBypass] AUTH DEV BYPASS ACTIVE for "dev@example.com" — every request is treated as logged in as this user, and @AllowAnonymous() has no effect. Never set AUTH_DEV_BYPASS_EMAIL outside local development.
[Nest] 44220  - 11/07/2026, 1:34:58 PM    WARN [AuthDevBypass] AUTH DEV BYPASS ACTIVE for "dev@example.com" — every request is treated as logged in as this user, and @AllowAnonymous() has no effect. Never set AUTH_DEV_BYPASS_EMAIL outside local development.
PASS src/authorization/authorization.service.spec.ts
PASS src/venues/venues.repository.spec.ts
PASS src/helper/open-play-token.helper.spec.ts
PASS src/open-play/dto/open-play.dto.spec.ts
PASS src/open-play/open-play.rules.spec.ts
PASS src/venues/venue-slug.utils.spec.ts

Test Suites: 40 passed, 40 total
Tests:       454 passed, 454 total
Snapshots:   0 total
Time:        10.033 s, estimated 62 s
Ran all test suites.
```

### Typecheck: `npm run typecheck`

Exit status: 0.

```text

> rallyhub-monorepo@0.0.1 typecheck
> turbo typecheck


   • turbo 2.11.10
   • Packages in scope: @workspace/eslint-config, @workspace/shared, @workspace/typescript-config, @workspace/ui, api, web
   • Running typecheck in 6 packages
   • Remote caching disabled

@workspace/ui:typecheck: cache hit, replaying logs 05d00782ed53f790
@workspace/shared:typecheck: cache hit, replaying logs 03d190a98dba100b
@workspace/shared:typecheck: 
@workspace/shared:typecheck: > @workspace/shared@0.0.0 typecheck
@workspace/shared:typecheck: > tsc --noEmit
@workspace/shared:typecheck: 
@workspace/ui:typecheck: 
@workspace/ui:typecheck: > @workspace/ui@0.0.0 typecheck
@workspace/ui:typecheck: > tsc --noEmit
@workspace/ui:typecheck: 
api:typecheck: cache miss, executing 19b2b82205706658
web:typecheck: cache hit, replaying logs ff4df55c8cf34292
web:typecheck: 
web:typecheck: > web@0.0.1 typecheck
web:typecheck: > tsc --noEmit
web:typecheck: 
api:typecheck: 
api:typecheck: > api@0.0.1 typecheck
api:typecheck: > tsc --noEmit -p tsconfig.build.json
api:typecheck: 

 Tasks:    4 successful, 4 total
Cached:    3 cached, 4 total
  Time:    1.513s 

```

### API build: `npm run build -w api`

Exit status: 0.

```text

> api@0.0.1 build
> npm run db:generate && nest build


> api@0.0.1 db:generate
> prisma generate

Loaded Prisma config from prisma.config.ts.

Prisma schema loaded from prisma/schema.prisma.

✔ Generated Prisma Client (7.10.1) to ./src/generated/prisma in 58ms

```

### Web build: `npm run build -w web`

Exit status: 0.

```text

> web@0.0.1 build
> next build

▲ Next.js 16.4.5 (Turbopack)
- Environments: .env.local
✓ Running next.config.mjs took 8ms

  Creating an optimized production build ...
✓ Compiled successfully in 1603ms
  Running TypeScript ...
  Finished TypeScript in 3.2s ...
  Collecting page data using 7 workers ...
  Generating static pages using 7 workers (0/13) ...
  Generating static pages using 7 workers (3/13) 
  Generating static pages using 7 workers (6/13) 
  Generating static pages using 7 workers (9/13) 
✓ Generating static pages using 7 workers (13/13) in 284ms
  Finalizing page optimization ...

Route (app)
┌ ƒ /
├ ○ /_not-found
├ ƒ /components
├ ƒ /components/error-preview
├ ƒ /components/not-found-preview
├ ƒ /dashboard
├ ○ /open-play
├ ƒ /open-play/join/[token]
├ ƒ /settings
├ ○ /sign-in
├ ○ /sign-up
├ ○ /venues
└ ƒ /venues/[slug]


○  (Static)   prerendered as static content
ƒ  (Dynamic)  server-rendered on demand

```

### Web lint: `npm run lint -w web`

Exit status: 0.

```text

> web@0.0.1 lint
> eslint


/Users/jpatrickzxc/Documents/coding/rallyhubv2/apps/web/components/components-gallery/components-gallery-page.tsx
  218:3  warning  'Table' is defined but never used         @typescript-eslint/no-unused-vars
  219:3  warning  'TableBody' is defined but never used     @typescript-eslint/no-unused-vars
  220:3  warning  'TableCaption' is defined but never used  @typescript-eslint/no-unused-vars
  221:3  warning  'TableCell' is defined but never used     @typescript-eslint/no-unused-vars
  222:3  warning  'TableHead' is defined but never used     @typescript-eslint/no-unused-vars
  223:3  warning  'TableHeader' is defined but never used   @typescript-eslint/no-unused-vars
  224:3  warning  'TableRow' is defined but never used      @typescript-eslint/no-unused-vars

/Users/jpatrickzxc/Documents/coding/rallyhubv2/apps/web/components/dashboard/dashboard-breadcrumbs.ts
  30:15  warning  'previousSegment' is defined but never used  @typescript-eslint/no-unused-vars

/Users/jpatrickzxc/Documents/coding/rallyhubv2/apps/web/components/settings/profile-settings.tsx
  3:10  warning  'RiUser3Line' is defined but never used  @typescript-eslint/no-unused-vars

/Users/jpatrickzxc/Documents/coding/rallyhubv2/apps/web/hooks/dashboard/use-usage-data.ts
  26:34  warning  Error: Cannot call impure function during render

`Math.random` is an impure function. Calling an impure function can produce unstable results that update unpredictably when the component happens to re-render. (https://react.dev/reference/rules/components-and-hooks-must-be-pure#components-and-hooks-must-be-idempotent).

/Users/jpatrickzxc/Documents/coding/rallyhubv2/apps/web/hooks/dashboard/use-usage-data.ts:26:34
  24 |       const hour = i * 2
  25 |       const time = `${hour.toString().padStart(2, "0")}:00`
> 26 |       const revenue = Math.floor(Math.random() * 85000) + 15000
     |                                  ^^^^^^^^^^^^^ Cannot call impure function
  27 |       return {
  28 |         time,
  29 |         revenue,  react-hooks/purity

/Users/jpatrickzxc/Documents/coding/rallyhubv2/apps/web/lib/auth/google-oauth.test.cts
  1:16  warning  A `require()` style import is forbidden  @typescript-eslint/no-require-imports
  3:31  warning  A `require()` style import is forbidden  @typescript-eslint/no-require-imports

/Users/jpatrickzxc/Documents/coding/rallyhubv2/apps/web/lib/server-api.ts
  6:12  warning  API_INTERNAL_URL is not listed as a dependency in turbo.json  turbo/no-undeclared-env-vars

/Users/jpatrickzxc/Documents/coding/rallyhubv2/apps/web/next.config.mjs
  13:23  warning  API_INTERNAL_URL is not listed as a dependency in turbo.json  turbo/no-undeclared-env-vars
  13:23  warning  'process' is not defined                                      no-undef

✖ 15 problems (0 errors, 15 warnings)

```

### Removed role search

Exit status: 1.

```text
(no matches)
```

### Removed directory search

Exit status: 0.

```text
apps/api/src/users/users.http.spec.ts:31:      .get('/users/all')
```

### Migration SQL hash

```text
26f556e31ff571d68524f4728bd7323efde608a133744fd60ed90ed2f7c8ce62  apps/api/prisma/migrations/20261107045705_platform_admin_and_drop_customer_role/migration.sql
```

### Hosted DEV: `npx prisma migrate status`

Exit status: 1.

```text
Loaded Prisma config from prisma.config.ts.

Prisma schema loaded from prisma/schema.prisma.
Datasource "db": PostgreSQL database "postgres", schema "public" at "pooled.db.prisma.io:5432"

18 migrations found in prisma/migrations
Following migration have not yet been applied:
20261107045705_platform_admin_and_drop_customer_role

To apply migrations in development run prisma migrate dev.
To apply migrations in production run prisma migrate deploy.
```

### Hosted DEV: `npx prisma migrate deploy`

Exit status: 0.

```text
Loaded Prisma config from prisma.config.ts.

Prisma schema loaded from prisma/schema.prisma.
Datasource "db": PostgreSQL database "postgres", schema "public" at "pooled.db.prisma.io:5432"

18 migrations found in prisma/migrations

Applying migration `20261107045705_platform_admin_and_drop_customer_role`

The following migration(s) have been applied:

migrations/
  └─ 20261107045705_platform_admin_and_drop_customer_role/
    └─ migration.sql

All migrations have been successfully applied.
```

