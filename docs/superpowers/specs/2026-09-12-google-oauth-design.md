# Google OAuth Design

## Goal

Add Google sign-in alongside the existing email/password sign-up and sign-in flows. This is a clean-slate product: no production or staging users exist, so no account migration or compatibility behavior is required.

## Decisions

- Google is the only OAuth provider in scope.
- Email/password remains available.
- Better Auth remains owned by the Nest API and database-backed cookie sessions remain the only browser authentication mechanism.
- The Next.js web app continues to proxy `/api/auth/*` to the API, so Google redirects and Better Auth cookies use the web domain.
- Google OAuth is enabled only when the API has both Google credentials and the web deployment has explicitly enabled the public UI flag.
- Better Auth's normal verified-email account-linking behavior is retained for users who may use both methods after launch; no bespoke migration or linking UI is added.

## Request Flow

```text
User clicks Continue with Google on the web app
  -> authClient.signIn.social({ provider: "google", callbackURL: "/dashboard" })
  -> web /api/auth/sign-in/social (Next rewrite)
  -> API Better Auth starts Google OAuth
  -> Google redirects to web /api/auth/callback/google
  -> Next rewrite forwards callback to API Better Auth
  -> Better Auth creates/links User, Account, and Session in Postgres
  -> browser receives host-only web-domain session cookie
  -> Better Auth redirects user to /dashboard
```

## Configuration

The API receives server-only credentials:

```text
GOOGLE_CLIENT_ID
GOOGLE_CLIENT_SECRET
```

The web app receives only a public feature flag:

```text
NEXT_PUBLIC_GOOGLE_OAUTH_ENABLED=true
```

The Google OAuth client must use web-domain callback URLs because the browser communicates through the web-origin rewrite:

```text
http://localhost:3000/api/auth/callback/google
https://<web-domain>/api/auth/callback/google
```

`BETTER_AUTH_URL` must remain the relevant web origin. The API origin must not be registered as Google's redirect URI.

## User Experience

The sign-in and sign-up cards show a distinct Google action above the email/password form when the public feature flag is enabled. Clicking it disables the action while Better Auth begins the browser redirect. If Better Auth returns an initiation error, the form shows the existing accessible error alert and re-enables the action.

When Google OAuth is not configured locally, email/password stays usable and no Google action is rendered. This prevents a misleading non-functional provider button.

## Security Constraints

- Never expose `GOOGLE_CLIENT_SECRET` to the web app or commit it.
- Use Better Auth's built-in OAuth state and PKCE flow; do not hand-roll OAuth requests or callback handling.
- Only allow configured, fixed Google redirect URIs in Google Cloud Console.
- Keep `BETTER_AUTH_TRUSTED_ORIGINS` limited to the web origins that may initiate sign-in.
- Do not request Google API scopes beyond Better Auth's identity requirements (`email` and `profile`).

## Verification

- API configuration tests prove Google is enabled only with a complete credential pair.
- Web tests prove the Google action renders only when enabled and calls the Better Auth social-sign-in client with `/dashboard` as its callback.
- Existing email/password tests and builds remain green.
- A manual local Google flow verifies redirect, callback, session creation, `/users/me`, and dashboard access.
- Production deployment verifies the same flow using the production web callback URI.

## Out of Scope

- Other OAuth providers.
- Google Workspace/domain restrictions.
- Google API access, refresh-token usage, or incremental scopes.
- Provider management, unlinking, and account deletion screens.
- Email verification and password-reset delivery.
