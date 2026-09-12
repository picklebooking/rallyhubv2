# Google OAuth Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add Google OAuth as an optional sign-in method alongside the existing Better Auth email/password flow.

**Architecture:** Nest configures Better Auth's built-in Google social provider with backend-only credentials. The web app presents a Google action only when a public feature flag is enabled, and starts the OAuth flow through its existing same-origin Better Auth client. The web-domain Next.js rewrite carries the callback to the API.

**Tech Stack:** Next.js App Router, React Hook Form, Better Auth React client, NestJS, `@thallesp/nestjs-better-auth`, Prisma/PostgreSQL, Jest.

**Spec:** `docs/superpowers/specs/2026-09-12-google-oauth-design.md`

## Global Constraints

- Keep email/password sign-up and sign-in unchanged and usable when Google OAuth is disabled.
- Configure only Google; do not introduce a generic provider abstraction or other provider packages.
- `GOOGLE_CLIENT_SECRET` is backend-only and never appears in browser code, committed env files, logs, or test output.
- Use Better Auth's `socialProviders.google` and `authClient.signIn.social`; do not implement OAuth protocol handling manually.
- Preserve the existing web-domain `/api/auth/*` rewrite. Google's callback URI is `${BETTER_AUTH_URL}/api/auth/callback/google`.
- No Prisma schema migration is needed because the existing `Account` model already supports social providers.

---

### Task 1: Make Google provider configuration explicit and testable

**Files:**
- Modify: `apps/api/src/auth/auth.ts`
- Modify: `apps/api/.env.example`
- Modify: `apps/api/src/app.module.spec.ts`

**Consumes:** existing `createAuth(prisma: PrismaClient)` and Better Auth Prisma adapter.

**Produces:** a Google social-provider config only when `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET` are both present; an actionable startup error when exactly one is present.

- [ ] **Step 1: Write failing configuration tests**

Add tests that temporarily set and restore `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET`, then assert these cases:

```ts
it("allows Better Auth without Google credentials", () => {
  delete process.env.GOOGLE_CLIENT_ID
  delete process.env.GOOGLE_CLIENT_SECRET
  expect(() => createAuth(prisma)).not.toThrow()
})

it("rejects a partial Google credential pair", () => {
  process.env.GOOGLE_CLIENT_ID = "google-client-id"
  delete process.env.GOOGLE_CLIENT_SECRET
  expect(() => createAuth(prisma)).toThrow(
    "GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET must be set together"
  )
})
```

- [ ] **Step 2: Run the API test to verify it fails**

Run: `npm run test -w api -- --runInBand`

Expected: FAIL because the partial Google credential pair is currently accepted.

- [ ] **Step 3: Add a focused Google credentials helper and social provider**

In `apps/api/src/auth/auth.ts`, implement a helper returning either no provider config or a complete credential pair:

```ts
type GoogleProviderConfig = {
  clientId: string
  clientSecret: string
}

function getGoogleProviderConfig(): GoogleProviderConfig | undefined {
  const clientId = process.env.GOOGLE_CLIENT_ID
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET

  if (!clientId && !clientSecret) return undefined
  if (!clientId || !clientSecret) {
    throw new Error(
      "GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET must be set together"
    )
  }

  return { clientId, clientSecret }
}
```

Pass the value to Better Auth only when defined:

```ts
const google = getGoogleProviderConfig()

return betterAuth({
  // existing settings
  ...(google
    ? { socialProviders: { google } }
    : {}),
})
```

Add commented `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET` entries to the API env example, naming them backend-only.

- [ ] **Step 4: Run API tests and typecheck**

Run: `npm run test -w api -- --runInBand`

Run: `npm run typecheck -w api`

Expected: both PASS.

- [ ] **Step 5: Commit the API provider configuration**

```bash
git add apps/api/src/auth/auth.ts apps/api/.env.example apps/api/src/app.module.spec.ts
git commit -m "feat(auth): configure Google OAuth provider"
```

### Task 2: Add a reusable Google sign-in action to the auth form

**Files:**
- Modify: `apps/web/components/auth/auth-form.tsx`
- Modify: `apps/web/.env.example`
- Test: `apps/web/components/auth/auth-form.test.tsx` (create if the repository test setup supports component tests; otherwise cover the action manually in Task 4)

**Consumes:** `authClient` from `apps/web/lib/auth/auth-client.ts` and existing `AuthForm` error/loading state.

**Produces:** an accessible Google action that is hidden unless `NEXT_PUBLIC_GOOGLE_OAUTH_ENABLED` is exactly `"true"`, starts Google sign-in, disables while initiating, and surfaces initiation errors.

- [ ] **Step 1: Add a failing interaction test or manual acceptance case**

If component tests are configured, mock `authClient.signIn.social` and assert:

```ts
await user.click(screen.getByRole("button", { name: /continue with google/i }))

expect(authClient.signIn.social).toHaveBeenCalledWith({
  provider: "google",
  callbackURL: "/dashboard",
})
```

If no web component test runner exists, record the equivalent manual acceptance case in the PR: with the flag enabled, click Google and verify the browser is redirected to Better Auth's Google authorization request; with the flag absent, verify the button is absent.

- [ ] **Step 2: Verify the test or manual case fails before implementation**

Run the targeted component test when available, or start the web app with `NEXT_PUBLIC_GOOGLE_OAUTH_ENABLED=true` and confirm no Google action exists yet.

Expected: the test fails or the action is absent.

- [ ] **Step 3: Implement Google action state in `AuthForm`**

Add a `googleIsPending` boolean state and derive the feature flag once:

```ts
const googleOAuthEnabled =
  process.env.NEXT_PUBLIC_GOOGLE_OAUTH_ENABLED === "true"
```

Implement the action using the existing form error state:

```ts
const handleGoogleSignIn = async () => {
  setGoogleIsPending(true)
  setFormError(null)

  const { error } = await authClient.signIn.social({
    provider: "google",
    callbackURL: "/dashboard",
  })

  if (error) {
    setFormError(error.message ?? "Unable to continue with Google.")
    setGoogleIsPending(false)
  }
}
```

Render a shared `Button` with a clear `Continue with Google` label above the credential inputs. Set `type="button"`, disable it while either `googleIsPending` or email/password submission is pending, and show `Connecting to Google…` while it initiates.

- [ ] **Step 4: Add the public environment template entry**

Add this documented default to `apps/web/.env.example`:

```text
# Show Google OAuth only when the API has matching Google credentials.
NEXT_PUBLIC_GOOGLE_OAUTH_ENABLED=false
```

- [ ] **Step 5: Run web verification**

Run: `npm run typecheck -w web`

Run: `npm run build -w web`

Expected: both PASS.

- [ ] **Step 6: Commit the web OAuth action**

```bash
git add apps/web/components/auth/auth-form.tsx apps/web/.env.example
git commit -m "feat(auth): add Google sign-in action"
```

### Task 3: Document Google Cloud and Vercel deployment setup

**Files:**
- Modify: `README.md`
- Modify: `docs/superpowers/plans/2026-09-10-clerk-to-better-auth.md`

**Consumes:** separate Vercel web/API deployment model and the configuration names from Tasks 1–2.

**Produces:** operator instructions that create the correct Google OAuth Web client and configure the two Vercel projects without exposing secrets.

- [ ] **Step 1: Add Google Cloud Console instructions**

Document these exact actions:

1. In Google Cloud Console, select/create the project for RallyHub.
2. Configure the OAuth consent screen with the product name and authorized support/developer contacts.
3. Create an OAuth Client ID of type **Web application**.
4. Add the local and production authorized redirect URIs:

```text
http://localhost:3000/api/auth/callback/google
https://<web-domain>/api/auth/callback/google
```

5. Copy the generated client ID and client secret only into the API env configuration.

- [ ] **Step 2: Add Vercel variable instructions**

Document that the API project receives:

```text
GOOGLE_CLIENT_ID=<from Google Cloud>
GOOGLE_CLIENT_SECRET=<from Google Cloud>
```

and the web project receives:

```text
NEXT_PUBLIC_GOOGLE_OAUTH_ENABLED=true
```

Document that preview Google sign-in requires a stable preview callback URL registered in Google Cloud or a distinct preview Google OAuth client; Google does not accept broad callback wildcards.

- [ ] **Step 3: Mark the OAuth follow-up status accurately**

Update the Clerk-to-Better-Auth plan status to state that Google OAuth is available only after operator credentials and callback URIs are configured.

- [ ] **Step 4: Verify documentation formatting**

Run: `git diff --check`

Expected: no whitespace errors.

- [ ] **Step 5: Commit documentation**

```bash
git add README.md docs/superpowers/plans/2026-09-10-clerk-to-better-auth.md
git commit -m "docs(auth): add Google OAuth setup guide"
```

### Task 4: Run end-to-end Google OAuth acceptance checks

**Files:** no production code changes required unless a check exposes a defect.

**Consumes:** a local Google OAuth Web client and all changes from Tasks 1–3.

**Produces:** evidence that Google OAuth creates a local session and works through the web/API rewrite.

- [ ] **Step 1: Configure local ignored environment files**

Set the Google Cloud client pair in `apps/api/.env` and enable the public flag in `apps/web/.env.local`:

```text
GOOGLE_CLIENT_ID=<local Google OAuth client ID>
GOOGLE_CLIENT_SECRET=<local Google OAuth client secret>
NEXT_PUBLIC_GOOGLE_OAUTH_ENABLED=true
```

- [ ] **Step 2: Start both apps**

Run: `npm run dev:apps`

Expected: web runs on `http://localhost:3000` and API runs on `http://localhost:3001` without an auth configuration error.

- [ ] **Step 3: Verify sign-up and sign-in routes**

Open `/sign-up` and `/sign-in`. On both routes, click `Continue with Google`, complete Google authorization, and verify the browser lands on `/dashboard`.

- [ ] **Step 4: Verify API session enforcement**

After Google login, request `http://localhost:3000/api/backend/users/me` in the same browser session.

Expected: HTTP 200 with the Google-created local user. In an incognito browser, the same request returns HTTP 401.

- [ ] **Step 5: Verify email/password regression**

Create a separate email/password account and verify its `/dashboard` and `/api/backend/users/me` access still work.

- [ ] **Step 6: Run final automated verification**

Run: `npm run test --workspaces --if-present -- --runInBand`

Run: `npm run typecheck`

Run: `npm run build -w web`

Run: `npm run build -w api`

Expected: all PASS.

- [ ] **Step 7: Commit any test-only fixes and update the PR**

```bash
git add <only files changed by acceptance fixes>
git commit -m "test(auth): verify Google OAuth flow"
git push
```

## Plan Self-Review

- Spec coverage: Tasks 1–4 cover Google configuration, the web action, operator setup, and local/deployed verification.
- Placeholder scan: all credentials are intentionally represented as environment values and are never requested for source control.
- Type consistency: API names are `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET`; web uses exactly `NEXT_PUBLIC_GOOGLE_OAUTH_ENABLED`; the Better Auth provider ID is exactly `google`.
