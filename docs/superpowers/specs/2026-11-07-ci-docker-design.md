# Docker routing, CI and quality gates

Date: 2026-11-07
Branch: `fix/system-audit-remediation` (PR #34)
Source: `docs/SYSTEM-AUDIT-2026-11-07.md`, findings **#11** and **#12** ("Group C: Docker routing, CI and quality gates")
Status: APPROVED design. The four open questions were answered by the product owner (recorded below). Next step: the implementation plan.

Labels: **(product owner)** means the user decided it. *Design call:* means the designer chose it; the user can overturn it while reviewing. Anything unlabelled follows directly from one of those, or from existing code or measurement.

## Why

- **#11 (Medium): Docker Compose cannot sign in.** The browser only talks to the web origin: `authClient` uses `basePath: "/api/auth"` (`apps/web/lib/auth/auth-client.ts`), and Axios uses `NEXT_PUBLIC_API_URL` (`apps/web/lib/axios.ts:3`). Next forwards `/api/auth/*` and `/api/backend/*` to `API_INTERNAL_URL` (`apps/web/next.config.mjs:13`), and server components call the API through `serverApiClient` (`apps/web/lib/server-api.ts:6`). Both fall back to `http://localhost:3001`. Compose never sets `API_INTERNAL_URL`. `docker compose config` (run today, no daemon needed) renders the web env as only `NEXT_PUBLIC_API_URL: http://localhost:3001`, `NEXT_TELEMETRY_DISABLED`, `NODE_ENV` and `WATCHPACK_POLLING`. Inside the web container `localhost:3001` is nothing: the container listens on 3000 and the API is `api:3000`. So sign-in, sign-up, session reads and every server-rendered API call fail under Compose. The protected layout (`apps/web/app/(protected)/layout.tsx:18`) then redirects to `/sign-in`. The browser Axios client also goes cross-origin to `localhost:3001` instead of the documented same-origin `/api/backend` proxy.
- **#12 (Medium): nothing checks a PR.** `.github/workflows/` holds only `gemini-review.yml` and `welcome.yml`. Measured today (2026-11-07, this branch):
  - **API ESLint** (`npx eslint "{src,apps,libs,test}/**/*.ts"`, no `--fix`): 402 errors and 29 warnings. 21 of the errors are in gitignored generated Prisma output (`src/generated/prisma/**`, all `prettier/prettier`). That leaves **381 errors in 26 hand-written files**. Breakdown in "API lint error breakdown" below.
  - The API `lint` script is `eslint ... --fix` (`apps/api/package.json`), so `npm run lint` / `turbo lint` rewrite files instead of failing.
  - **Root cause of the formatting drift:** the root `prettier` and `prettier:check` scripts pass `--config ./prettier.config.mjs` (double quotes, no semicolons) for `apps/api/**`. That overrides `apps/api/.prettierrc` (single quotes, semicolons, trailing commas), which ESLint enforces through `eslint-plugin-prettier`. Running `npm run prettier` re-breaks API lint. Files like `src/main.ts` and `test/app.e2e-spec.ts` carry the root style.
  - **Web ESLint** (`npm run lint -w web`): exit 0, **15 warnings, 0 errors**. Breakdown below. The shared config loads `eslint-plugin-only-warn` (`packages/eslint-config/base.js`), which turns every error into a warning, so web lint can never fail today.
  - `npm run typecheck`: passes.
  - **API Jest:** without a DB, 14 DB-backed suites skip silently and the run is green. With `TEST_DATABASE_URL` set, all suites pass.
  - **Migrations from empty are proven locally.** Every remediation round has run `prisma migrate reset --force` against local `rallyhub_test`, which drops the database and replays all 20 migrations from empty. CI's `migrate deploy` on a fresh Postgres 17 service container is the same replay on a different Postgres build, not a first proof.
  - `turbo.json` declares no `env` / `globalEnv`. Turbo 2 runs tasks in strict env mode, so a `turbo build` of web drops `API_INTERNAL_URL`. Next resolves `rewrites()` during `next build`, so a Turbo build bakes the `localhost:3001` fallback into the proxy routes. This is also why web lint reports two `turbo/no-undeclared-env-vars` warnings.
  - **Branch protection:** `gh api repos/{owner}/{repo}/branches/main/protection` returns 403, "Upgrade to GitHub Pro or make this repository public to enable this feature." Required status checks can't be enforced on this private repo's current plan.

Success means:
- `docker compose up --build` gives a working sign-up/sign-in, an authenticated server-rendered page, and a browser-path `/api/backend` call, with no env overrides beyond the existing `apps/api/.env`.
- Every PR to `main` runs lint, typecheck, build and the full API test suite (including the DB-backed suites against a throwaway migrated Postgres), and goes red on any API lint error, any web lint warning, any type or build error, or any failing or skipped-for-lack-of-DB test.
- A root `turbo build` produces the same web proxy routes as a direct `next build` with the same env.

## Goals

1. Fix Compose web-to-API routing (#11).
2. Make API lint a real gate: fix all 381 current errors, exclude generated output, and make the lint script read-only **(product owner)**.
3. Make web lint strict: fix all 15 current warnings and fail on any warning **(product owner)**.
4. Declare Turbo build env inputs.
5. Stop the root Prettier scripts from fighting the API's Prettier config.
6. Add one CI workflow: install, Prisma generate, lint, typecheck, build, web OAuth helper test, API tests against a Postgres service container with migrations applied.
7. Prove the Compose stack boots for real, once **(product owner)**.

## Non-goals

- The AI review and welcome workflows (`gemini-review.yml`, `welcome.yml`, `.github/actions/gemini-review`). Not touched.
- Making checks required on `main`. The plan blocks it (403); checks are advisory **(product owner)**.
- Deploying from CI, Vercel config, or publishing Docker images.
- The production `web` / `api` Dockerfile targets. Compose uses only the `deps` target, and Vercel builds from source. See Follow-ups.
- `packages/ui` lint. It has 2 warnings (`react-hooks/set-state-in-effect` in `carousel.tsx:98`, `react-hooks/incompatible-library` in `data-table.tsx:64`). It stays warnings-only. *Design call:* the user's strict decision named web; `ui` is shared shadcn code. See Follow-ups.
- API lint warnings (29 `no-unsafe-argument`). They stay warnings and don't fail CI. *Design call:* the user's decision was "fail on API lint errors".
- Web/package formatting with Prettier (60 web and 22 package files fail `prettier --check`). Nothing enforces it today; see Follow-ups.
- The broken API e2e suite (`apps/api/test/app.e2e-spec.ts`, `test/jest-e2e.json`, `test:e2e`). It fails at import with an ESM error and only covered `GET /`. It gets formatted by the lint fix but is otherwise left alone and not run in CI. *Design call:* repairing or deleting it is scope creep for this group; see Follow-ups.
- Browser e2e coverage, dependency upgrades (#14), the dashboard's fake statistics (#10).

## Anti-goals (a failure even if CI is green)

- CI that is green because the DB suites skipped. A CI run without `TEST_DATABASE_URL` must fail.
- CI touching any hosted database. Migrations run only against the job's own service container.
- A lint count brought down by disabling rules, widening ignores beyond generated/build output, or blanket `eslint-disable` comments. A narrowly scoped inline disable is allowed only where the rule is genuinely wrong for that line, with a `-- reason` and a listing in the PR description. Expected count: zero.
- A lint fix that changes runtime behaviour, except where the warning reveals a real bug. Those are called out below (one known: the dashboard usage chart).
- `--fix` running in CI, or any CI step that writes to the repo.
- Breaking Vercel. Nothing here changes what Vercel builds, beyond declaring env so Turbo forwards it.
- Removing the `postgres_data` volume (`docker compose down -v` or `docker volume rm`) **(product owner)**.

## Constraints

- Node `>=22.22.1` (root `package.json` engines; Dockerfile uses `node:22.22.1-alpine`). npm 10.9.2 workspaces; CI installs from the root with `npm ci`.
- No `npm install`, no new dependencies. No Prisma migrations against any database other than the local test DB and the CI service container, unless the user says so.
- API tests: `TEST_DATABASE_URL=postgresql://jpatrickzxc@localhost:5432/rallyhub_test npm run test -w api`. Only one Jest run at a time: `jest-global-setup.ts` takes a Postgres advisory lock per test DB. All tests stay green after every commit.
- The DB harness accepts only `localhost|127.0.0.1|[::1]`, port 5432 or blank, path `/rallyhub_test`, no query string (`apps/api/src/test-support/http-app.ts:9`). The CI service container must match.
- `src/generated/prisma` is gitignored (`apps/api/.gitignore:59`), so CI runs `prisma generate` before lint, typecheck and test.
- `apps/api/prisma.config.ts` reads `DATABASE_URL` (through `dotenv/config`).
- `main.ts` loads `apps/api/.env` with `process.loadEnvFile`, which doesn't override variables already set, so Compose env wins over the bind-mounted `.env`.
- `apps/web/next-env.d.ts` is tracked, and `next build` rewrites it. Never commit it: `git checkout -- apps/web/next-env.d.ts` after any local web build. Never commit `.env` files.
- No `Co-Authored-By`, `Claude-Session` or other attribution lines in commits or PR text.

## Decisions

All four are **(product owner)** decisions.

1. **API lint:** fix all 381 current errors in this PR, and CI fails on any API lint error.
2. **Docker verification:** static checks first. Then the user starts Docker Desktop, and the builder runs `docker compose up --build` once for real to prove postgres, api and web boot and route correctly. Don't remove the `postgres_data` volume.
3. **Required checks:** report-only (advisory). Branch protection returns 403 on this plan, so the checks can't be made required. Document this in the PR and in contributor docs.
4. **Web lint: strict.** Fix all 15 current warnings in this PR, and CI fails on any web warning (`--max-warnings 0`). The `Math.random` purity warning is treated as a possible real bug: fix the cause, don't suppress it.

## Lint breakdown

### API: 381 errors in 26 hand-written files (plus 21 in generated output, which get ignored)

| Rule | Count | How it's fixed |
| --- | --- | --- |
| `prettier/prettier` | 370 | `eslint --fix` (formatting only) |
| `@typescript-eslint/no-unnecessary-type-assertion` | 1 | `eslint --fix`: drops `as CreateTenantDto` at `src/tenant/tenant.service.ts:42`. Type-only. |
| `@typescript-eslint/no-unsafe-member-access` | 5 | By hand: `src/authorization/harness.http.spec.ts:49,51,60,61`, `src/courts/courts.http.spec.ts:172`. Type the supertest `response.body`. |
| `@typescript-eslint/no-redundant-type-constituents` | 2 | By hand: `src/interface/ICourtBooking.interface.ts:5`, `error?: unknown \| any` becomes `error?: unknown`. |
| `@typescript-eslint/no-unused-vars` | 3 | By hand: `src/tenant/dto/patch-tenant.dto.ts:2`, remove the unused `IsEmail, IsOptional, IsString` import. Side-effect free: `class-validator` is still imported elsewhere. |

371 are auto-fixable; 10 need hand edits. All hand fixes are type-level or dead imports, with no runtime change.

Errors by file (for batching). The prettier-only files take the auto-fix commit:
`src/court-book/court-book.integration.spec.ts` 165, `src/users/users.http.spec.ts` 31, `src/auth/auth.spec.ts` 29, `src/auth/auth.ts` 21, `test/app.e2e-spec.ts` 20, `src/prisma/prisma.service.ts` 17, `src/main.ts` 17, `src/app.controller.spec.ts` 16, `src/users/users.controller.ts` 8, `src/users/users.service.ts` 6, `src/users/users.repository.ts` 6, `src/tenant/tenant.repository.ts` 6, `src/tenant/dto/update-tenant-status.dto.ts` 6, `src/app.service.ts` 5, `src/app.controller.ts` 5, `src/users/users.module.ts` 4, `src/authorization/harness.http.spec.ts` 4, `src/tenant/dto/patch-tenant.dto.ts` 3, `src/interface/ICourtBooking.interface.ts` 3, `src/prisma/prisma.module.ts` 2, `src/common/middleware/tenant-context.middleware.spec.ts` 2, `src/tenant/tenant.service.ts` 1, `src/tenant/dto/create-tenant.dto.ts` 1, `src/courts/courts.http.spec.ts` 1, `src/common/decorators/current-venue.decorator.ts` 1, `src/app.module.spec.ts` 1.

The 29 warnings (all `no-unsafe-argument`, configured as `warn`) are in `tenant.http.spec.ts` (8), `courts.http.spec.ts` (6), `harness.http.spec.ts` (5), `venues.http.spec.ts` (5), `auth-session.ts` (2), `users.http.spec.ts` (2), `court-book.service.ts` (1). They don't block. The builder may clear the ones in lines it already touches.

### Web: 15 warnings in 7 files

| Rule | Count | Location | Fix |
| --- | --- | --- | --- |
| `@typescript-eslint/no-unused-vars` | 7 | `components/components-gallery/components-gallery-page.tsx:218-224` (`Table`, `TableBody`, `TableCaption`, `TableCell`, `TableHead`, `TableHeader`, `TableRow`) | Remove the unused import block. |
| `@typescript-eslint/no-unused-vars` | 1 | `components/dashboard/dashboard-breadcrumbs.ts:30` (`previousSegment`) | Drop it from that resolver's destructuring. *Design call:* leave the `previousSegment` field and `findPreviousContextSegment` plumbing alone; no resolver behaviour changes. |
| `@typescript-eslint/no-unused-vars` | 1 | `components/settings/profile-settings.tsx:3` (`RiUser3Line`) | Remove the import. |
| `@typescript-eslint/no-require-imports` | 2 | `lib/auth/google-oauth.test.cts:1,3` | *Design call:* rename to `google-oauth.test.mts`, use `import assert from "node:assert/strict"` and `import { startGoogleSignIn } from "./google-oauth.ts"`, and update the `test:google-oauth` script path. The web package is `"type": "module"` and Node 22 strips types from `.mts`. `tsconfig.json` includes only `**/*.ts(x)`, so typecheck is unaffected, as it is today for `.cts`. If Node can't run it as ESM, stop and report rather than adding a disable. |
| `turbo/no-undeclared-env-vars` | 2 | `lib/server-api.ts:6`, `next.config.mjs:13` (`API_INTERNAL_URL`) | Declare it in `turbo.json` (see "Turbo env"). |
| `no-undef` | 1 | `next.config.mjs:13` (`process`) | *Design call:* in `packages/eslint-config/next.js`, add a block giving `**/*.config.{js,mjs,cjs}` files `globals.node`. `globals` is already a dependency of that package; web isn't, so don't import it from `apps/web/eslint.config.mjs`. |
| `react-hooks/purity` | 1 | `hooks/dashboard/use-usage-data.ts:26` (`Math.random()` inside `useMemo`) | **Real bug, runtime change.** The client component (`components/dashboard/dashboard-usage-chart.tsx`) is server-rendered and then hydrated, so `Math.random` produces different values on the server and the client, and new values on every remount. *Design call:* replace it with a fixed, module-level array of 12 sample revenue values (still in the 15000–100000 range), and drop the `useMemo`. Chart values become stable. The data is still fake; real figures remain #10. |

## Design

### A. Docker routing (#11)

1. `docker-compose.yml`, web `environment`:
   - `API_INTERNAL_URL: http://api:${API_INTERNAL_PORT:-3000}`. Container-to-container, built from the existing internal-port variable. *Design call:* not overridable on its own from root `.env`, because a host-facing value would be wrong inside the container.
   - `NEXT_PUBLIC_API_URL: ${NEXT_PUBLIC_API_URL:-/api/backend}`. Matches root `.env.example`, which already says `/api/backend`.
2. `apps/web/lib/axios.ts`: fall back to `"/api/backend"` instead of `"http://localhost:3001"`, so an unset variable means the documented same-origin proxy, not a cross-origin call. *Design call.* Vercel sets the var, so it's unaffected. If it didn't, today's fallback would already be broken there.
3. Keep the `http://localhost:3001` fallback in `next.config.mjs` and `server-api.ts`; it's correct for host-run dev.
4. Docs: a comment in root `.env.example` saying Compose sets `API_INTERNAL_URL` itself; a note in `apps/web/.env.example` that under Compose the container value is `http://api:3000`; and in the AGENTS.md Docker section, a line saying Compose needs `apps/api/.env` (Better Auth secret, Google OAuth credentials), because the api service gets those only from the bind-mounted file.
5. CORS: unchanged. With the same-origin proxy the browser never calls the API directly.

### B. Turbo env (#12)

`turbo.json` `build` task: `"env": ["API_INTERNAL_URL", "NEXT_PUBLIC_*"]` and `"passThroughEnv": ["NEXT_TELEMETRY_DISABLED"]`. *Design call:* task-level, not `globalEnv`, so web vars don't invalidate API build caching. This clears the two `turbo/no-undeclared-env-vars` warnings. If the API build's `prisma generate` needs `DATABASE_URL`, add it to `passThroughEnv` (not `env`, so it never enters the hash).

No Turbo `test` task. CI calls `npm run test -w api` directly, so DB tests are never cached.

### C. Lint as a real gate (#12)

1. `apps/api/eslint.config.mjs`: `ignores: ["eslint.config.mjs", "src/generated/**", "dist/**", "coverage/**"]`. These are generated or build output, not hand-written code.
2. `apps/api/package.json`: `lint` becomes `eslint "{src,apps,libs,test}/**/*.ts"` (no `--fix`). Add `lint:fix` with `--fix`. *Design call:* `turbo lint` and CI must be read-only, and developers keep a fix script.
3. Fix the 381 API errors as in the breakdown: `npm run lint:fix -w api` in a style-only commit, then the 10 hand fixes in a second commit. **(product owner)**
4. `apps/web/package.json`: `lint` becomes `eslint --max-warnings 0`. **(product owner)** *Design call:* keep `eslint-plugin-only-warn` in the shared config. With it, every finding is a warning, so `--max-warnings 0` fails on anything. Removing it would also change `packages/ui`, which is out of scope.
5. Fix the 15 web warnings as in the breakdown. **(product owner)**
6. Root `package.json` `prettier` / `prettier:check`: drop `--config ./prettier.config.mjs` so Prettier picks the nearest config per file (`apps/api/.prettierrc` for the API, the root config for web). *Design call.* After step 3, `npm run prettier:check` must report no `apps/api` files. Web files will still be reported; that's the formatting follow-up.

### D. CI workflow (#12)

One new file, `.github/workflows/ci.yml`. Existing workflows are not changed.

- Triggers: `pull_request` (branches: `main`) and `push` (branches: `main`). Not `pull_request_target`. `permissions: contents: read`. `concurrency: ci-${{ github.ref }}`, `cancel-in-progress: true`.
- Shared setup in each job: `actions/checkout@v4`, `actions/setup-node@v4` with `node-version: 22.22.1` and `cache: npm`, `npm ci`, `npm run db:generate`.
- Job **`checks`** (ubuntu-latest, 20-minute timeout): `npx turbo lint`, `npx turbo typecheck`, `npx turbo build`, `npm run test:google-oauth -w web`. *Design call:* a job-level dummy `DATABASE_URL=postgresql://ci:ci@localhost:5432/ci` so `prisma.config.ts` resolves. It's never connected to. Build runs with no app secrets, matching the code's fallbacks; it proves the apps compile, not deploy config. If `next build` needs a value, add a non-secret dummy, never a real secret.
- Job **`api-tests`** (ubuntu-latest, 20-minute timeout): `services.postgres` with `postgres:17-alpine` (same major as Compose), `POSTGRES_DB=rallyhub_test`, `POSTGRES_USER=postgres`, `POSTGRES_PASSWORD=postgres`, ports `5432:5432`, and `pg_isready` health options. Job env `TEST_DATABASE_URL=postgresql://postgres:postgres@localhost:5432/rallyhub_test`. After setup: `DATABASE_URL=$TEST_DATABASE_URL npm run db:migrate:deploy -w api`, then `npm run test -w api`.
- **No-silent-skip guard:** `apps/api/src/test-support/jest-global-setup.ts` throws when `process.env.CI` is set and `TEST_DATABASE_URL` is not, with a message naming the variable. Local runs without a DB keep skipping as today. *Design call.* Test it like `teardown.spec.ts` / `test-db-run-lock.spec.ts`, and write the spec first (red, then green).
- Job names `checks` and `api-tests` are stable, so they can be made required later.
- Turbo remote cache: none. `.turbo` is not cached in CI. *Design call.*

### E. Required checks

Advisory only **(product owner)**. The PR description and AGENTS.md (Verification section) state that `checks` and `api-tests` are the expected-green pair before merging to `main`. GitHub can't enforce this on the current plan (branch protection API: 403). If the plan changes, make both required.

## Docker verification procedure

### Static checks (builder, no Docker daemon needed)

1. `docker compose config --quiet` exits 0.
2. `docker compose config` renders the web service env with `API_INTERNAL_URL: http://api:3000` and `NEXT_PUBLIC_API_URL: /api/backend`, and postgres still mounts `postgres_data`.
3. Rewrites are baked from env, and Turbo forwards it: `API_INTERNAL_URL=http://sentinel.invalid:9 npx turbo build --filter=web --force`, then `grep sentinel.invalid apps/web/.next/routes-manifest.json` must match. Then rebuild or clean so the sentinel doesn't linger in `.next`, and `git checkout -- apps/web/next-env.d.ts`. Run the same grep before the Turbo change to show it was red (the fallback `localhost:3001` appears instead). If the sentinel shows up even before the Turbo change, record that; the Turbo declaration stays anyway (the lint rule needs it).

### The one real run (after the user starts Docker Desktop)

The builder confirms `docker info` succeeds, then:

1. `docker compose up --build -d`. Wait until `docker compose ps` shows `postgres` healthy and `api` and `web` running. Give api and web time to finish `prisma generate` and their first compile; watch `docker compose logs -f api web` until both report listening.
2. **Database state.** Count finished rows: `docker compose exec postgres psql -U postgres -d rallyhub -tAc "select count(*) from _prisma_migrations where finished_at is not null"`. Compare with the number of migration folders (20 today). Compose never runs migrations: the api service runs `npm run dev -w api`. If the table is missing or behind, stop. Give the user `docker compose exec api npm run db:migrate:deploy -w api` and run it only once they say so (CLAUDE.md: no migrations unless asked). This is local Compose data only. *Design call:* ask this in the same message that asks the user to start Docker Desktop, so there's one hand-off.
   **Update 2026-11-07 (product owner):** the user has authorized the builder to run `docker compose exec api npm run db:migrate:deploy -w api` directly when the count is missing or behind. Local Compose DB only; never the hosted DB, never `-v` or volume removal. No separate ask is needed for this step.
3. API direct: `curl -i http://localhost:3001/` returns 200.
4. Sign-up through the web origin (proves `/api/auth` rewrite to `api:3000`): `curl -i -c /tmp/rh.jar -H 'Content-Type: application/json' -H 'Origin: http://localhost:3000' -X POST http://localhost:3000/api/auth/sign-up/email -d '{"email":"compose-smoke-<timestamp>@example.test","password":"<random 16+ chars>","name":"Compose Smoke"}'` returns 200 with a `Set-Cookie` session. Then sign in with the same credentials at `/api/auth/sign-in/email`: 200.
5. Browser API path (proves `/api/backend` rewrite): `curl -b /tmp/rh.jar http://localhost:3000/api/backend/users/me` returns 200 with the smoke user's email.
6. Authenticated server render (proves `serverApiClient` reaches `api:3000`): `curl -i -b /tmp/rh.jar http://localhost:3000/dashboard` returns 200, not a 307 to `/sign-in`. Without the cookie it does redirect to `/sign-in`.
7. `docker compose logs api web` contain no `ECONNREFUSED` / `localhost:3001` errors.
8. `docker compose down` (never `-v`). *Design call:* the smoke user stays in the local Compose DB; it's local dev data.

**Pass** means steps 1 and 3–7 all hold (step 2 resolved), recorded with command output in the PR description. A failure in any step is a stop-and-report, not a workaround (for example, no hard-coded IPs and no extra env in a local root `.env`).

## Testing approach

- Before pushing, the builder reproduces each CI step locally: `npx turbo lint`, `npx turbo typecheck`, `npx turbo build`, `npm run test:google-oauth -w web`, and `TEST_DATABASE_URL=postgresql://jpatrickzxc@localhost:5432/rallyhub_test npm run test -w api` (one run at a time).
- **Prove the gates bite.** After the fixes, add a throwaway unused import to an API file: `npm run lint -w api` exits non-zero and doesn't modify the file. Add one to a web file: `npm run lint -w web` exits non-zero. Revert both, and don't commit them.
- **The no-skip guard:** spec first, seen red, then implemented.
- **Web fixes:** `npm run typecheck -w web` and `npm run build -w web` stay green. The usage chart still renders (sample data, now stable).
- **CI itself** is proven by the run on PR #34 (the `pull_request` trigger uses the PR's own workflow file). Record the run URL. If `migrate deploy` fails on the service container, stop and report. Don't hand-edit migration SQL.
- Docker: the procedure above.

## Suggested commit order

1. `chore(api): exclude generated Prisma output from lint; make lint read-only`
2. `style(api): apply eslint --fix` (style only, large, no logic)
3. `fix(api): resolve remaining lint errors` (the 10 hand fixes)
4. `chore: let Prettier use per-app configs`
5. `build: declare Turbo build env inputs`
6. `fix(web): resolve lint warnings` (one commit, or one per kind; the usage-chart change gets its own commit, `fix(web): render stable sample data in the usage chart`)
7. `chore(web): fail lint on any warning`
8. `test(api): fail CI runs that lack a test database` (spec first)
9. `fix(docker): route web to the API container through the same-origin proxy` (compose, axios fallback, env examples, AGENTS.md)
10. `ci: run lint, typecheck, build and API tests on PRs`

## What's left to the builder

- Exact workflow YAML layout (duplicated setup steps or a local composite action), cache keys, timeouts.
- The exact supertest typing in the two HTTP specs (a local response type or a typed `response.body` cast).
- The 12 sample revenue values in `use-usage-data.ts`.
- Wording of env-example, AGENTS.md and PR-description text.
- Whether CI needs extra non-secret dummy env for `next build`; never real secrets.
- Whether to clear any of the 29 API warnings on lines already being edited.

## Follow-ups / not built yet

- **Production Docker targets.** The `web` image doesn't set `API_INTERNAL_URL` at build or runtime (`Dockerfile` `web-builder` / `web` stages), so a self-hosted image has the same routing bug. Add build `ARG`s and runtime `ENV`, plus a CI smoke build of both targets. Not on the deploy path (Vercel builds from source).
- **Required checks.** Make `checks` and `api-tests` required if the GitHub plan changes or the repo goes public.
- **`packages/ui` lint strict.** Fix its 2 React Compiler warnings, then `--max-warnings 0`.
- **API lint warnings.** Type the remaining `no-unsafe-argument` sites, then consider promoting the rule to `error`.
- **Web/packages formatting gate.** Format the 60 web and 22 package files in one style-only PR, then add `prettier:check` to CI.
- **API e2e suite.** Delete `test/app.e2e-spec.ts`, `test/jest-e2e.json` and `test:e2e` (the `*.http.spec.ts` suites already cover the real HTTP pipeline), or port the ESM Jest setup into it.
- **Compose API secrets.** The api service relies on a bind-mounted `apps/api/.env` for `BETTER_AUTH_*` and `GOOGLE_*`. Consider `env_file:` with a clear error, and a Compose step that runs `migrate deploy` on start.
- **Vercel web build path.** Confirm whether the Vercel web project builds through Turbo. If it does, section B is what makes `API_INTERNAL_URL` reach `next build`; check the deployed proxy after merge.
- **Browser e2e** for booking and account flows. Blocked on the reservation journey (#7).
- **Dependency audit job** (`npm audit --omit=dev`, advisory), after #14.
- **Coverage reporting** for API tests.
