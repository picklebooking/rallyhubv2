# Dependency Security Upgrades Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Clear the critical and high-severity npm audit entries from finding #14 by upgrading within current major versions, without changing app behavior.

**Architecture:** One package group per task, each verified and committed on its own so a regression can be bisected or reverted per group. Production-reachable packages go first (auth, web framework, HTTP stack), then the ORM, then dev-only tooling, then a final lockfile refresh and re-audit. No major-version bumps, no `npm audit fix --force`.

**Tech Stack:** npm workspaces + Turborepo, Next.js 16, NestJS 11, Better Auth 1.7, Prisma 7, Jest.

**Spec:** `docs/SYSTEM-AUDIT-2026-11-07.md` — finding #14 and the "All critical and high-severity package entries" table.

## Global Constraints

- Branch: `chore/dependency-security-upgrades` off `main` (`ddae9b1`).
- Install only from the repo root with `-w <workspace>`; never create nested lockfiles.
- Stay on current majors: `better-auth` 1.x, `next` 16.x, `axios` 1.x, `@nestjs/*` 11.x (NOT 12.x, latest on npm), `prisma`/`@prisma/*` 7.x (NOT the 8.0 rc tagged `latest`).
- No `npm audit fix --force`. No Prisma migrations (`db:migrate:*`). `npm run db:generate` is allowed (client regeneration only).
- Commit messages: no `Co-Authored-By`, `Claude-Session` or 🤖 lines.
- Every task ends with "no new failures vs. baseline" — the baseline already has known failures (CUSTOMER enum tests, finding #13); those are out of scope here.

## Target versions (verified on npm 2026-11-07)

| Package | Workspace(s) | From | To | Clears |
| --- | --- | --- | --- | --- |
| `better-auth`, `@better-auth/prisma-adapter` | api, web | 1.7.4 | `^1.7.18` | OAuth state/proxy account takeover (critical) |
| `next` | web | 16.2.6 | `^16.4.5` | Image Optimizer RCEs, `use cache` RCE, SSRF, DoS (critical); `sharp` comes along |
| `axios` | web | 1.15.2 | `^1.21.0` | ~30 advisories, all fixed `<1.20.0` |
| `@nestjs/common`, `core`, `platform-express`, `testing` | api | 11.1.19 | `^11.2.8` | brings `express` 5.3 → `body-parser` 2.4, `multer` 2.5, `proxy-addr` 2.0.8 |
| `prisma`, `@prisma/client`, `@prisma/adapter-pg` | api | 7.8.0 | `^7.10.1` | `@prisma/config`, `deepmerge-ts`, `mysql2` (latter unused, Postgres only) |
| `@swc/cli` | api (dev) | 0.6.0 | `^0.8.2` | `piscina` 4.9.4, `@xhmikosr/*` chain (critical, dev only) |
| `ts-jest` | api (dev) | 29.4.9 | `^29.4.15` | `handlebars` 4.7.10 (critical, test only) |
| `shadcn` | @workspace/ui | 4.4.0 | `^4.23.0` | `@modelcontextprotocol/sdk`, `hono` (CLI only) |

`@thallesp/nestjs-better-auth@2.8.0` peers: `better-auth >=1.5 <2`, `@nestjs/* ^11.1.6 || ^12` — compatible with all targets.

## Review Focus

- Google sign-in round trip (redirect → callback → session cookie) still works after the better-auth bump — the very flow the critical advisory touches; no automated test covers it.
- Email/password sign-in + sign-out still set and clear the session through the Next `/api/auth/*` rewrite.
- `next/image` with `images.unsplash.com` remote pattern still renders (`apps/web/components/shared/court-thumbnail.tsx`) — Next 16.4 tightened image optimizer handling.
- Authenticated server rendering via `apps/web/lib/server-api.ts` still forwards cookies to the API after the Next and axios bumps.
- Nest request body parsing (JSON booking create, 4xx on malformed JSON) unchanged after express 5.3 / body-parser 2.4.

The first three need a running app; Task 7 lists them as manual checks for the user.

---

### Task 1: Branch, sync local env, record baseline

**Files:** none modified (writes `baseline/` notes to the scratchpad only).

- [ ] **Step 1:** `git checkout -b chore/dependency-security-upgrades`
- [ ] **Step 2:** `npm ci && npm run db:generate` (user approved installs for this plan). Expected: exit 0, `@nestjs/mapped-types` now present.
- [ ] **Step 3:** Record baseline — save output of each:
  - `npm audit --package-lock-only` (expect 67 entries: 6 critical / 21 high / 30 moderate / 10 low)
  - `npm run typecheck -w web`, `npm run typecheck -w api`
  - `npm run build -w web`, `npm run build -w api`
  - `npm run test -w api -- --runInBand`, `npm run test:google-oauth -w web`
  - `npm run lint -w web`
- [ ] **Step 4:** Note which failures exist (expected: tenant-member specs referencing `TenantRole.CUSTOMER`). These are the baseline; later tasks must not add to them. No commit.

### Task 2: better-auth (api + web)

**Files:** `apps/api/package.json`, `apps/web/package.json`, `package-lock.json`

- [ ] **Step 1:** `npm install better-auth@^1.7.18 @better-auth/prisma-adapter@^1.7.18 -w api` then `npm install better-auth@^1.7.18 -w web`
- [ ] **Step 2:** `npm ls better-auth` — expect a single resolved version ≥1.7.18 for both apps (no 1.7.4 left).
- [ ] **Step 3:** Skim the better-auth 1.7.5–1.7.18 changelog for breaking config changes affecting `apps/api/src/auth/auth.ts` (socialProviders/google, prisma adapter). Adjust only if a change is required; note it in the commit body.
- [ ] **Step 4:** Run `npm run typecheck -w api`, `npm run typecheck -w web`, `npm run test -w api -- --runInBand`, `npm run test:google-oauth -w web`. Expected: no new failures vs. baseline.
- [ ] **Step 5:** Commit `chore(deps): upgrade better-auth to 1.7.18 (GHSA-965c-763c-88jm, GHSA-r4xp-prcw-77qf)`

### Task 3: next (web)

**Files:** `apps/web/package.json`, `package-lock.json`

- [ ] **Step 1:** `npm install next@^16.4.5 -w web`
- [ ] **Step 2:** `npm ls next sharp` — expect next ≥16.4.5 and sharp ≥0.35.
- [ ] **Step 3:** Skim Next 16.3/16.4 release notes for changes to `images.remotePatterns`, `rewrites()`, and middleware/proxy; apply required config edits to `apps/web/next.config.mjs` only if needed.
- [ ] **Step 4:** `npm run typecheck -w web && npm run build -w web && npm run lint -w web`. Expected: build passes; lint warnings ≤ baseline count.
- [ ] **Step 5:** Commit `chore(deps): upgrade next to 16.4.5 (image optimizer RCE, SSRF, DoS advisories)`

### Task 4: axios (web)

**Files:** `apps/web/package.json`, `package-lock.json`

- [ ] **Step 1:** `npm install axios@^1.21.0 -w web`
- [ ] **Step 2:** `npm ls axios` — expect one version ≥1.21.0 (other packages may nest their own; note any that remain <1.20).
- [ ] **Step 3:** `npm run typecheck -w web && npm run build -w web`. Expected: pass. If `apps/web/lib/axios.ts` or `lib/api/*` hit new type errors, fix them minimally.
- [ ] **Step 4:** Commit `chore(deps): upgrade axios to 1.21.0`

### Task 5: NestJS 11.x → express stack (api)

**Files:** `apps/api/package.json`, `package-lock.json`

- [ ] **Step 1:** `npm install @nestjs/common@^11.2.8 @nestjs/core@^11.2.8 @nestjs/platform-express@^11.2.8 -w api` and `npm install -D @nestjs/testing@^11.2.8 -w api`
- [ ] **Step 2:** `npm ls express body-parser multer proxy-addr` — expect express ≥5.3.0, body-parser ≥2.4.0, multer ≥2.5.0, proxy-addr ≥2.0.8. If any stays below its fix, add a root `overrides` entry for that package alongside the existing `zod` override and re-run `npm install`.
- [ ] **Step 3:** `npm run build -w api && npm run test -w api -- --runInBand`. Expected: no new failures vs. baseline.
- [ ] **Step 4:** Commit `chore(deps): upgrade NestJS to 11.2.8 (express, body-parser, multer, proxy-addr fixes)`

### Task 6: Prisma 7.x (api)

**Files:** `apps/api/package.json`, `package-lock.json`, regenerated `apps/api/src/generated/**` if tracked

- [ ] **Step 1:** `npm install prisma@^7.10.1 @prisma/client@^7.10.1 @prisma/adapter-pg@^7.10.1 -w api`
- [ ] **Step 2:** `npm run db:generate`. Expected: exit 0. Do NOT run any migrate command.
- [ ] **Step 3:** `git status apps/api/prisma/migrations` — expect no changes (a generate must never touch migrations).
- [ ] **Step 4:** `npm run build -w api && npm run test -w api -- --runInBand`. Expected: no new failures vs. baseline.
- [ ] **Step 5:** Commit `chore(deps): upgrade prisma to 7.10.1`

### Task 7: Dev tooling, lockfile refresh, re-audit

**Files:** `apps/api/package.json`, `packages/ui/package.json`, `package-lock.json`, `docs/SYSTEM-AUDIT-2026-11-07.md` (finding #14 status line only)

- [ ] **Step 1:** `npm install -D @swc/cli@^0.8.2 ts-jest@^29.4.15 -w api` and `npm install shadcn@^4.23.0 -w @workspace/ui`
- [ ] **Step 2:** `npm audit fix` (no `--force`) to refresh transitive entries within existing ranges (brace-expansion, js-yaml, postcss, nanoid, fast-uri, follow-redirects, form-data, ip-address, source-map-js, browserslist).
- [ ] **Step 3:** `npm audit --package-lock-only`. Expected: 0 critical; any remaining high is listed with the reason it can't be fixed within the current major (e.g. needs a breaking upgrade).
- [ ] **Step 4:** Full gate: `npm run typecheck -w web && npm run build -w web && npm run build -w api && npm run test -w api -- --runInBand && npm run test:google-oauth -w web && npm run lint -w web`. Expected: no new failures vs. baseline.
- [ ] **Step 5:** Add a status line under finding #14 in the audit doc: date, new audit counts, and any remaining entries with reasons.
- [ ] **Step 6:** Commit `chore(deps): upgrade dev tooling and refresh transitive deps`
- [ ] **Step 7 (user, manual):** `npm run dev`, then verify: Google sign-in round trip; email/password sign-in + sign-out; a page with `CourtThumbnail` loads its Unsplash image; an authenticated server-rendered page loads data. Report results before opening a PR.

## Out of scope

- Major upgrades (`@nestjs/*` 12, `prisma` 8, `jest` 30, `typescript-eslint` majors) — separate decision.
- Moderate/low entries that don't clear with Task 7 Step 2.
- Fixing the baseline CUSTOMER test failures (finding #13) and API lint errors (finding #12).
