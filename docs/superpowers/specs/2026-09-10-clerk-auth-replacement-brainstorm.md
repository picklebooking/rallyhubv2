# Clerk Authentication Replacement — Brainstorm & Decision Record

> **Decision update (2026-09-11):** This template has no production or staging Clerk accounts. Clerk is being removed outright—there is no account import or rollback-compatibility window. Web and API will be separate Vercel projects, with the web project proxying browser requests through same-origin paths.

## Purpose

Replace Clerk with a self-owned authentication system without weakening API authorization. This document records the decision space and its final decisions.

## What Existed Before the Replacement

Clerk is coupled to both applications:

- Web uses `ClerkProvider`, `UserButton`, Clerk sign-in/sign-up components, protected-route checks, and browser bearer-token getters.
- Nest verifies Clerk bearer tokens in `clerk-auth.guard.ts`; `clerk-user-id.decorator.ts` exposes the Clerk subject.
- `UserSyncProvider` calls `POST /users/me/sync`; the API also retrieves profiles from Clerk in `GET /users/me`.
- Prisma's `User` has a canonical UUID `id`, a nullable unique `clerkId`, and unique `email`. User-list queries currently exclude rows without a `clerkId`.
- Clerk webhooks create, update, and delete local users. Shared user contracts expose `clerkId`.

Better Auth now creates the application's UUID-backed `User` records directly. There are no existing user records to preserve.

## Naming Decision

NextAuth.js is now called **Auth.js**. Better Auth is a separate project; the teams' current direction recommends Better Auth for new adoption while Auth.js remains maintained for security and critical fixes. The recommended option below is Better Auth, not `next-auth`.

Sources: [Auth.js / Better Auth announcement](https://better-auth.com/blog/authjs-joins-better-auth), [Auth.js installation](https://authjs.dev/getting-started/installation).

## Approaches Considered

### A. Better Auth owned by the Nest API — recommended

Better Auth runs next to Prisma in `apps/api`; it owns Accounts, Sessions, and Verification records. Next.js renders the experience and proxies browser requests through same-origin `/api/auth/*` and `/api/backend/*` paths.

Why this fits:

- The API already owns user persistence and authorization.
- One database/session authority avoids a web-to-API token-exchange design.
- Same-origin cookies work more reliably across browsers and deployment environments than separate frontend/API cookie domains.

The integration uses the Better Auth Nest guidance through `@thallesp/nestjs-better-auth`; the API remains CommonJS, so no native Node ESM migration is required. [Nest integration](https://better-auth.com/docs/integrations/nestjs)

### B. Better Auth owned by Next.js

This avoids the Nest ESM change, but moves identity ownership to the web app. Nest then needs session introspection or a carefully designed signed-token bridge. It is viable only if web should deliberately become the identity boundary.

### C. Auth.js in Next.js with a Nest bridge

This meets a strict requirement to use NextAuth/Auth.js, but has the same bridge problem as option B and provides no advantage for this API-owned application. Auth.js cookies are not automatically Nest authorization credentials.

## Recommended Architecture

```text
Browser
  /api/auth/*      -> Next.js rewrite/proxy -> Nest Better Auth handler
  /api/backend/*   -> Next.js rewrite/proxy -> Nest feature controllers
                                                    |
                                              session guard
                                                    |
                                           Prisma / PostgreSQL
```

- Use database-backed, HttpOnly cookie sessions; do not add browser bearer tokens or local-storage tokens.
- Validate sessions in Nest for every protected resource. Next middleware/layout checks are navigation optimization only.
- No Clerk user migration is required; the Clerk-specific column, webhooks, SDKs, and UI are removed in the replacement migration.
- Keep the deployed web origin in `BETTER_AUTH_URL` and `BETTER_AUTH_TRUSTED_ORIGINS`; never use the API deployment URL as Better Auth's public browser origin.
- Validate auth-endpoint rate-limit behavior before production launch.
- Apply explicit trusted-origin/CSRF protection to ordinary cookie-authenticated Nest mutations; CORS alone is insufficient.
- Proxy only to fixed internal upstreams and forward `Cookie`, `Origin`, request body, status, redirects, and all `Set-Cookie` values. Never create an open proxy.

## Product Decisions Required Before Implementation

1. Existing Clerk users: none; accounts may be recreated.
2. Current login method: email/password.
3. Clerk-specific profile/security features: out of scope for this replacement.
4. Deployment topology: separate Vercel web and API projects; the web project is the browser-facing origin.
5. Should the existing all-authenticated-users directory remain visible to any signed-in user, or become admin-only?

## Migration and Rollback Principles

No account import is needed. The approved database reset removed template Clerk data and the schema migration dropped the Clerk-specific column and webhook integration. A rollback would be a normal code/database restore, not a user-account reconciliation process.

## Acceptance Criteria

- Anonymous browser and API requests cannot access protected resources.
- Expired or revoked database sessions fail in Nest even if a cookie remains.
- New Better Auth users appear in the users directory.
- Sign-in, sign-out, session expiry, and malicious-origin mutation cases are tested.
- Local host, preview, production, and Safari flows work.
- No Clerk SDK, webhook, bearer-token, contract, UI, or environment dependency remains after the approved rollback window.
