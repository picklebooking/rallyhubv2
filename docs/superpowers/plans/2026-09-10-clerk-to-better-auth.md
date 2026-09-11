# Clerk to Better Auth Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace Clerk with API-owned Better Auth while preserving application user UUIDs and securing browser-to-Nest requests with database sessions.

**Architecture:** Better Auth is mounted in the Nest/Express API and uses the existing Prisma/Postgres database. Next.js proxies same-origin auth and feature API paths, renders the auth experience, and never becomes the source of authorization truth.

**Tech Stack:** Next.js App Router, NestJS/Express, Prisma/PostgreSQL, Better Auth, `@better-auth/prisma-adapter`, Axios, TanStack Query, React Hook Form, Zod.

**Spec:** `docs/superpowers/specs/2026-09-10-clerk-auth-replacement-brainstorm.md`

## Implementation Status

Completed in this branch:

- Better Auth is API-owned through the official Nest integration package, using the Prisma adapter and database sessions.
- The API remains CommonJS; a native Node ESM conversion was deliberately not used.
- The approved reset database has the Better Auth `User`, `Account`, `Session`, and `Verification` schema, with all Clerk-specific persistence removed.
- Next.js proxies `/api/auth/*` and `/api/backend/*` to a fixed API origin. Browser calls use those same-origin paths, while Server Components use `API_INTERNAL_URL` and forward the request cookie.
- Clerk packages, middleware, guards, webhook handling, UI, synchronisation, environment variables, and shared contract fields have been removed.
- Local production builds passed for web and API. A browser-equivalent local probe verified sign-up, cookie-backed `GET /users/me`, authenticated SSR, anonymous rejection, and untrusted-Origin rejection.

Remaining before a production launch:

1. Configure the web and API Vercel variables listed in the README, including matching Preview origins if preview sign-in is needed.
2. Deploy both projects and repeat the sign-up, sign-out, anonymous, and authenticated-page probes against their real domains.
3. Add focused automated auth regression tests for expired/revoked sessions and verify the chosen auth-endpoint rate-limit policy.
4. Manually smoke-test the deployed flow in Safari and at least one Chromium browser.

## Global Constraints

- Confirm account-preservation, sign-in methods, profile-management scope, and deployed domains before Task 3.
- Keep `User.id` as the canonical application UUID; never expose provider IDs as authorization identity.
- Use root npm workspace commands only; do not run installations, Prisma generation, or migrations without explicit approval.
- Keep Prisma changes additive until the rollback window ends.
- Do not trust Next middleware/layout checks as API authorization.
- Proxy requests only to configured internal API origins and preserve all `Set-Cookie` headers.

---

### Task 1: Choose a compatible Nest integration

**Files:** modify `apps/api/package.json`, `apps/api/tsconfig.json`, `apps/api/tsconfig.build.json`, Jest configuration, Docker/start scripts as required.

**Produces:** a Nest production build that starts successfully with Prisma and Better Auth.

**Completed:** The Better Auth Nest integration package supports the existing CommonJS Nest application. No native ESM conversion is needed.

- [ ] Write a startup smoke test that imports the compiled API entry and verifies `/health` responds.
- [ ] Change the API module/runtime settings to the supported ESM configuration; update local relative imports and test tooling where Node ESM requires it.
- [ ] Run `npm run typecheck -w api`, `npm run test -w api`, and a compiled production startup smoke test.
- [ ] Commit only the ESM compatibility change after all three checks pass.

### Task 2: Add additive authentication persistence

**Files:** modify `apps/api/prisma/schema.prisma`; create a Prisma migration; create an auth schema/config helper under `apps/api/src/auth/`.

**Consumes:** existing `User(id, clerkId, email, name, imageUrl)`.

**Produces:** Better Auth Account, Session, and Verification persistence related to existing users, plus safely mapped `emailVerified` and `imageUrl` fields.

- [ ] Pin Better Auth and Prisma-adapter versions only after checking their current compatibility; use `npm install better-auth @better-auth/prisma-adapter -w api` when approved.
- [ ] Write schema-level tests/assertions for a session resolving to the pre-existing `User.id`.
- [ ] Add the adapter-required tables, indexes, and relations without dropping `clerkId`; create a reviewed additive migration.
- [ ] Run Prisma generation and targeted repository tests only after authorization; prove an existing UUID remains unchanged.
- [ ] Commit schema and generated lockfile changes separately from web changes.

### Task 3: Create the Nest authentication boundary

**Files:** create `apps/api/src/auth/auth.module.ts`, `auth.config.ts`, `auth.service.ts`; create `common/guards/session-auth.guard.ts`, `common/decorators/current-user-id.decorator.ts`, `common/guards/trusted-origin.guard.ts`; modify `main.ts`, `app.module.ts`.

**Produces:** official Better Auth Node handler mounted before normal body parsing, authenticated UUID extraction, trusted-origin checks, and explicit auth-endpoint rate limits.

- [ ] Write failing API tests for missing, invalid, expired, and revoked sessions; each must return 401 on a protected controller.
- [ ] Implement the Better Auth configuration with fixed public URL, secrets, trusted origins, Prisma adapter, and database sessions.
- [ ] Mount the handler using the installed Express version's correct catch-all syntax before Nest JSON parsing; preserve ordinary controller body parsing.
- [ ] Implement `SessionAuthGuard` and `@CurrentUserId()` so controllers receive only the local UUID.
- [ ] Add rate-limit and malicious-Origin mutation tests, then implement the guard/configuration that makes them pass.
- [ ] Run API typecheck, auth tests, existing API tests, and a compiled startup test; commit.

### Task 4: Route same-origin web requests safely

**Files:** modify `apps/web/next.config.mjs`, `apps/web/lib/axios.ts`; create `apps/web/lib/auth/auth-client.ts`, `apps/web/lib/auth/server-session.ts`, and a server-only API client if needed; modify Docker configuration only if host/internal origins differ.

**Produces:** `/api/auth/*` and `/api/backend/*` paths that forward cookies safely to configured API upstreams without caching user-specific responses.

- [ ] Write integration tests covering Cookie forwarding, multiple `Set-Cookie` response headers, fixed upstream-only routing, and a rejected unexpected origin.
- [ ] Implement explicit rewrite/proxy rules for auth and feature APIs; never derive destination URLs from request input.
- [ ] Configure browser Axios to use `/api/backend`; configure server rendering to forward the incoming Cookie header through a server-only client.
- [ ] Test host-run URLs, Docker internal `api` URL, callback redirects, and an API outage without redirect loops.
- [ ] Commit routing and client infrastructure.

### Task 5: Replace Clerk in the web application

**Files:** modify `apps/web/app/layout.tsx`, `app/page.tsx`, `app/(protected)/layout.tsx`, `proxy.ts`, `lib/auth/current-dashboard-user.ts`, `components/auth/auth-header.tsx`, `components/dashboard/dashboard-sidebar.tsx`, `components/providers/app-providers.tsx`; create focused sign-in/sign-up/account components and routes.

**Produces:** session-based redirects, accessible account UI, and no Clerk provider/widgets/token getters/sync provider.

- [ ] Write component and route tests for anonymous redirects, authenticated rendering, sign-out cache clearing, and loading/error states.
- [ ] Remove `ClerkProvider`, `UserButton`, modal auth components, token getter calls, `UserSyncProvider`, and `use-sync-current-user.ts`.
- [ ] Implement approved provider flows with Better Auth's React client; use React Hook Form and Zod for any password/email forms.
- [ ] Replace the Clerk account UI with only the agreed profile/security functionality, including keyboard focus and light/dark checks.
- [ ] Run web typecheck/build and targeted UI tests; commit.

### Task 6: Make users and contracts provider-independent

**Files:** modify `packages/shared/api/users.d.ts`, API users controller/service/repository, web users API/hooks/pages, data page; delete Clerk guard/decorator and webhook module once unused.

**Produces:** local `GET /users/me`, no sync endpoint, no required `clerkId` response field, and user lists that include Better Auth users.

- [ ] Write failing API tests proving `GET /users/me` reads locally and a user with `clerkId = null` appears in the directory.
- [ ] Replace Clerk subject access with `@CurrentUserId()` and remove remote Clerk profile reads/upserts.
- [ ] Remove `clerkId != null` repository filtering and render the application UUID where an identifier is needed.
- [ ] Delete `POST /users/me/sync`, Clerk webhooks, SDK imports, and obsolete contract fields after confirming no consumers remain.
- [ ] Run shared/api/web typechecks and API tests; commit.

### Task 7: Import accounts and execute the cutover

**Files:** create a non-committed operational import tool or secure runbook; modify `.env.example`, `apps/api/.env.example`, `apps/web/.env.example`, `docker-compose.yml`, `turbo.json`, `README.md`, and `CLAUDE.md`.

**Produces:** an idempotent migration rehearsal, Better Auth environment guidance, and a reversible production cutover.

- [ ] Write a dry-run importer test using a database copy: match known `clerkId`, preserve UUIDs, report duplicate-email conflicts without credentials, and make a second run a no-op.
- [ ] Export Clerk data through approved secure tooling; determine whether password hashes, OAuth accounts, MFA, and organizations are in scope before implementing import.
- [ ] Rehearse import and mandatory re-login on a database copy; verify related application records retain their user UUID references.
- [ ] Add `BETTER_AUTH_SECRET`, `BETTER_AUTH_URL`, trusted origins, provider secrets, and server-only API origin docs; remove Clerk values only after cutover acceptance.
- [ ] Disable Clerk webhooks at cutover, deploy, run the acceptance suite, and retain `clerkId` for the agreed rollback period.

### Task 8: Final security and removal review

**Files:** all auth-related files above; remove unused Clerk dependencies with root workspace commands.

**Produces:** verified auth replacement with no retired production dependency.

- [ ] Validate anonymous access, invalid/revoked sessions, sign-in/out, callback failure, expiry, account switch, CSRF/origin rejection, rate limits, and cache isolation.
- [ ] Validate fresh and imported users appear in the directory; test local, Docker, preview, production, and Safari flows.
- [ ] Run `npm run typecheck`, targeted tests, `npm run build -w web`, and compiled API startup after explicit generation authorization.
- [ ] Remove `@clerk/nextjs`, `@clerk/backend`, obsolete webhook dependencies/configuration, and only later the legacy `clerkId` column in a separately reviewed migration.
- [ ] Commit and document the rollback/reconciliation procedure.

## Plan Self-Review

- Spec coverage: Tasks 1–8 cover ESM readiness, data, API/session security, same-origin routing, UI, provider-neutral business logic, user migration, operations, validation, and removal.
- Placeholder scan: no implementation work is delegated to an unspecified task; product decisions are intentionally listed in the companion brainstorm because they change the chosen flow.
- Type consistency: all protected Nest controllers consume the local UUID via `@CurrentUserId()`; Better Auth provider/account IDs remain internal auth data.
