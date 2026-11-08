# Backlog: not built yet

Work deliberately left out of the 2026-11-07 system-audit remediation (PR #34). Each item should become its own ticket. Sources: `docs/SYSTEM-AUDIT-2026-11-07.md` and the "Follow-ups" sections of the design docs in `docs/superpowers/specs/`.

When you start an item, open a ticket and link it here; when it ships, delete the line.

## Product features (audit #7–#10)

- **Reserve flow (#7).** The customer booking journey in the web app.
- **Venue pages (#8).**
- **Settings (#9).**
- **Real dashboard figures (#10).** The usage chart shows fixed sample values today.

## Booking

Source: `docs/superpowers/specs/2026-11-07-booking-integrity-design.md`.

- **Venue booking-settings UI.** Booking rules (hours, slot length, limits) are API-only today; owners and staff set them through the venue update endpoint.
- **Holidays and one-off venue closures.**
- **Scheduled court blocks.** A court plus a time range, one-off or recurring. Court maintenance status is all-or-nothing today.
- **Public slot endpoint** for browsing availability without signing in.
- **Per-court hours**, back-to-back windows and split days.
- **Staff booking on behalf of customers.**
- **Cancel and reschedule.**
- **Booking notifications.**
- **Tenant activation flow.**

## Sign-in and checkout

- **Sign-in-to-book UX.** Public browsing of venues and slots, a "Sign in required" dialog when booking, then return to the same slot after login.
- **Passwordless or guest checkout** via email code or Google one-tap. Needs email delivery, a phone field and rate limiting.

## Membership

Source: `docs/superpowers/specs/2026-11-07-membership-safety-design.md`.

- **Membership UI** for owners and platform admins.
- **Invitations.**
- **Account deletion vs the last owner.** Decide what happens when the last owner deletes their account.
- **No foreign key on `TenantMember.venueId`.** Deleting a venue leaves orphan memberships.
- **Audit log** of admin membership changes.
- **Inactive members are invisible** in member lists, so a `409` caused by a user's inactive row in the same scope has no visible cause.

## CI, lint and Docker

Source: `docs/superpowers/specs/2026-11-07-ci-docker-design.md`.

- **Required checks.** Make `checks` and `api-tests` required once the GitHub plan allows branch protection (the API returns 403 today).
- **Production Docker targets.** The `web` image doesn't set `API_INTERNAL_URL` at build or runtime, so a self-hosted image has the same routing bug Compose had. Add build args and runtime env, plus a CI smoke build of both targets.
- **`packages/ui` strict lint.** Fix its 2 React Compiler warnings, then `--max-warnings 0`.
- **API lint warnings.** Type the 29 `no-unsafe-argument` sites, then consider making the rule an error.
- **Formatting gate for web and packages.** One style-only PR, then add `prettier:check` to CI.
- **API e2e suite.** `apps/api/test/app.e2e-spec.ts` fails at import; delete it (the `*.http.spec.ts` suites cover the HTTP pipeline) or port the ESM Jest setup.
- **Compose API secrets.** The api service relies on a bind-mounted `apps/api/.env`; consider `env_file:` with a clear error, and running `migrate deploy` on start.
- **Vercel web build.** Confirm whether it builds through Turbo and that `API_INTERNAL_URL` reaches `next build`; check the deployed proxy.
- **Browser e2e tests** for booking and account flows (after #7).
- **Remaining dependency advisories.** After #14, `npm audit` still lists 22 entries (13 moderate, 9 low; 0 critical, 0 high). Recheck each and upgrade where a fix is available.
- **Dependency audit job** (`npm audit --omit=dev`, advisory).
- **API test coverage reporting.**
- **Shared rate-limit store.** Rate limits (Nest throttler and Better Auth, #37) are in memory, so they hold per serverless instance only; a client that reaches several instances gets several allowances. Move both to a shared store (e.g. Redis or Better Auth `secondaryStorage`) when one exists.

## Deployment

There are no Vercel deployments yet. Do these once the first one exists.

- **Check the client IP the API sees (#37).** Sign-in limits key on the client IP from `AUTH_IP_ADDRESS_HEADER` (default `x-forwarded-for`). With Vercel Services, browser requests reach the `api` service straight from Vercel's edge, so the header should hold the client address; confirm it. On a preview: sign in 5 times from each of two networks (e.g. Wi-Fi and phone data), with no `429` on either; confirm the API logs never show `Rate limiting could not determine a client IP`. If either check fails, set `AUTH_IP_ADDRESS_HEADER` to `x-real-ip` or `x-vercel-forwarded-for` and recheck.

- **Tenant middleware reads Vercel hostnames as venue slugs.** `TenantContextMiddleware` treats the first label of any host with three or more parts as a venue slug, so on `<project>.vercel.app` and every preview URL each API request runs a venue lookup that should find nothing (and would scope the request to a venue if one ever had that slug). Skip `*.vercel.app` hosts, or only read subdomains of a configured root domain, before subdomain venues go live.

## Manual rechecks still open from PR #34

These need a running app; tick them in PR #34 before merging.

- Docker Compose real run (#11): Task 8 of `docs/superpowers/plans/2026-11-07-ci-docker.md`.
- Dashboard in light and dark mode, including the usage chart's fixed sample values.
- Google sign-in round trip.
- Email sign-in and sign-out.
- Unsplash image in `CourtThumbnail`.
- An authenticated server-rendered page loads its data.
