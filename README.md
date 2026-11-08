# RallyHub Monorepo

RallyHub is an npm-workspaces monorepo with a Next.js frontend, a NestJS backend, and shared shadcn/ui workspace packages.

## Workspace Layout

```text
apps/
  web/                 # Next.js app router frontend
  api/                 # NestJS backend
packages/
  ui/                  # Shared shadcn/ui components, hooks, styles, and utilities
  eslint-config/       # Shared ESLint configs
  typescript-config/   # Shared TypeScript configs
```

## Tech Stack

- Monorepo: npm workspaces + Turborepo
- Frontend: Next.js, React, Tailwind CSS, shadcn/ui
- Backend: NestJS
- Shared UI: `@workspace/ui`
- Package manager: npm
- Runtime: Node.js 22 (22.22.1 or later; Vercel and CI run 22)

## Getting Started

Install dependencies once from the repository root (do not install separately inside `apps/web` or `apps/api`):

```bash
npm install
```

Run all apps in development mode:

```bash
npm run dev
```

Run a specific workspace:

```bash
npm run dev -w web
npm run dev -w api
```

Default local URLs:

- Web: http://localhost:3000
- API: http://localhost:3001 when run through Docker Compose, or the Nest default port when run directly unless configured otherwise

## Environment Variables

Example env files are committed for each runtime:

```text
.env.example             # Docker Compose/root-level defaults
apps/web/.env.example    # Next.js frontend variables
apps/api/.env.example    # NestJS API and Prisma variables
```

For local development, copy the examples you need:

```bash
cp .env.example .env
cp apps/web/.env.example apps/web/.env.local
cp apps/api/.env.example apps/api/.env
```

Do not commit real `.env` files. They are ignored by Git.

Important variables:

- `NEXT_PUBLIC_API_URL`: browser-facing API path. Keep this as `/api/backend` so browser requests are same-origin.
- `API_INTERNAL_URL`: server-only API origin. Locally this is `http://localhost:3001`; on Vercel the `web` service's binding injects it, so do not set it there.
- `BETTER_AUTH_SECRET`: long random, backend-only session secret.
- `BETTER_AUTH_URL`: the public web origin (not the API origin).
- `BETTER_AUTH_TRUSTED_ORIGINS`: comma-separated allowed web origins for Better Auth mutations.
- `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`: optional backend-only Google OAuth credential pair; set both or neither.
- `PORT`: internal port used by the NestJS API.
- `DATABASE_URL`: Prisma database connection string.
- `CORS_ORIGIN`: comma-separated browser origins allowed by the API.
- `AUTH_IP_ADDRESS_HEADER`: header Better Auth reads the client IP from for the sign-in/sign-up limit (default `x-forwarded-for`, which Vercel sets to the client address). Off Vercel (Docker Compose, plain `next start`) the web app's proxy passes the client's own `x-forwarded-for` through, so clients could dodge the sign-in limit: point this at a header your proxy overwrites.
- `TRUST_PROXY_HOPS`: proxy hops Express trusts in `x-forwarded-for` for `req.ip`, which keys the global per-IP limit (default `1`, for Vercel). It does not affect Better Auth. Set `0` when no proxy in front overwrites or appends to that header. `RATE_LIMIT_*`, `AUTH_RATE_LIMIT_*` and `TENANT_ADMIN_RATE_LIMIT_*` tune the limits (see `apps/api/.env.example`). On startup the API logs which header and hop count are active.
- `POSTGRES_DB`, `POSTGRES_USER`, `POSTGRES_PASSWORD`, `POSTGRES_PORT`: Docker Postgres settings.

## Claude Code Agents

This repository includes specialized agents in `.claude/agents/` to help with development tasks when using [Claude Code](https://claude.ai/code):

- **rallyhub-expert** - Full-stack expert for cross-cutting features, architectural questions, and contract changes between frontend/backend. Use for non-trivial work that touches both apps/web and apps/api.
- **code-reviewer** - Reviews diffs/PRs for blast radius, security risks, regression potential, and convention adherence before merging.
- **migration-writer** - Guides Prisma schema changes. Edits `schema.prisma` and provides the exact migration command to run. Never hand-writes migration SQL.
- **pr-describer** - Drafts or updates PR descriptions to match the repo's `.github/PULL_REQUEST_TEMPLATE.md` format.
- **repo-lookup** - Fast lookups for "where is X" / "what does Y export" questions. Use for quick file/symbol searches.
- **ui-consistency-checker** - Checks frontend components for light/dark mode support, theme token usage, and `@workspace/ui` primitive usage.

Agents are automatically available when using Claude Code in this repository. They enforce the conventions defined in `AGENTS.md` and `CLAUDE.md`.

## Common Commands

```bash
npm run build
npm run lint
npm run typecheck
npm run format
```

Workspace-specific examples:

```bash
npm run build -w web
npm run build -w api
npm run test -w api
```

Prisma commands:

```bash
npm run db:generate
npm run db:migrate:deploy
```

`npm run build -w api` automatically runs `prisma generate` before compiling NestJS. Production database migrations should still be run intentionally with `npm run db:migrate:deploy` against the target database.

## Testing the API

A Postman collection for every API route lives in `docs/api/postman/`. To test the admin-only routes, make your account a platform admin with `npm run dev:make-admin -w api -- you@example.com`. Setup, sign-in, the run order and who can do what are in [docs/api/README.md](docs/api/README.md).

## Installing Packages

Always install from the monorepo root.

Frontend-only dependency:

```bash
npm install <package> -w web
```

Backend-only dependency:

```bash
npm install <package> -w api
```

Shared UI dependency:

```bash
npm install <package> -w @workspace/ui
```

Root dev tooling:

```bash
npm install -D <package>
```

## Shared UI

Shared UI components live in `packages/ui` and are imported through `@workspace/ui`.

Example:

```tsx
import { Button } from "@workspace/ui/components/button";
```

Add shadcn components from the repository root using the configured workspace paths.

```bash
npx shadcn@latest add button -c apps/web
```

## Docker

Run the full local stack with Docker Compose:

```bash
docker compose up --build
```

The apps will be available at:

- Web: http://localhost:3000
- API: http://localhost:3001
- Postgres: localhost:5433

Build production images separately:

```bash
docker build --target web -t rallyhub-web .
docker build --target api -t rallyhub-api .
```

The Docker API container connects to Postgres with the internal hostname `postgres`.

When running backend commands from your host machine, use the localhost URL in `apps/api/.env`:

```env
DATABASE_URL="postgresql://postgres:postgres@localhost:5433/rallyhub_monorepo?schema=public"
```

When running inside Docker Compose, the API uses:

```env
DATABASE_URL="postgresql://postgres:postgres@postgres:5432/rallyhub_monorepo?schema=public"
```

Apply local Docker migrations intentionally with:

```bash
docker compose run --rm api npm run db:migrate:deploy -w api
```

To remove the local Docker database volume and start fresh:

```bash
docker compose down -v
```

## Deployment Notes

RallyHub deploys to Vercel as **one project with two services**, configured in the root `vercel.json` ([Vercel Services](https://vercel.com/docs/services), beta):

| Service | Root | Public paths | Notes |
| --- | --- | --- | --- |
| `web` | `apps/web` | everything else (`/`) | Next.js. Calls the API from server code through a binding that injects `API_INTERNAL_URL`. |
| `api` | `apps/api` | `/api/auth/*`, `/api/backend/*` | NestJS. Sees `/api/backend/<path>` as `/<path>`; `/api/auth/*` keeps its path. Build runs `npm run vercel-build` (`prisma generate`, `prisma migrate deploy`, `nest build`). |

Both services share one domain, so Better Auth cookies stay same-origin and the browser never calls the API on another host. In the Vercel project, leave the Root Directory at the repository root and the framework preset unset: `vercel.json` owns the build settings.

Project environment variables (shared by both services; set them for Production and, with their own values, Preview):

| Variable | Value |
| --- | --- |
| `DATABASE_URL` | The deployed database. Every API deployment migrates it during the build, so give Preview its own database. |
| `BETTER_AUTH_SECRET` | Long random secret (`openssl rand -base64 32`). |
| `BETTER_AUTH_URL`, `BETTER_AUTH_TRUSTED_ORIGINS`, `CORS_ORIGIN` | The project's public origin, e.g. `https://rallyhub.example.com`. |
| `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` | Production OAuth client. Required: the API does not start without them. |
| `NEXT_PUBLIC_API_URL` | `/api/backend` (also the default). |

Do not set `API_INTERNAL_URL` in Vercel: the binding generates it per deployment. Do not set `NODE_ENV` or `PORT`, and never set `AUTH_DEV_BYPASS_EMAIL`. Rate-limit variables can stay unset; their defaults suit Vercel.

Run all services locally the way Vercel does with `vercel dev`. Plain `npm run dev` still works: off Vercel, the web app's `next.config.mjs` proxies `/api/auth/*` and `/api/backend/*` to `API_INTERNAL_URL`.

### Google OAuth setup

1. Sign in to [Google Cloud Console](https://console.cloud.google.com/) using the Google account that should own RallyHub's OAuth configuration, then create or select the RallyHub project.
2. Go to **APIs & Services → OAuth consent screen**. Choose **External** for a normal public app or **Internal** only for a Google Workspace-only app. Enter the app name, support email, and developer contact. While the app remains in Testing, add each Gmail address allowed to test sign-in under **Test users**.
3. Go to **APIs & Services → Credentials → Create Credentials → OAuth client ID**, choose **Web application**, and create one client for local development and one for production.
4. On the local client, add `http://localhost:3000` as an authorized JavaScript origin and `http://localhost:3000/api/auth/callback/google` as an authorized redirect URI.
5. On the production client, add `https://rallyhub.example.com` as an authorized JavaScript origin and `https://rallyhub.example.com/api/auth/callback/google` as an authorized redirect URI. Replace `rallyhub.example.com` with the project's Vercel or custom domain.
6. Copy each client ID and secret to the matching environment as `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET`. Never put the secret in a `NEXT_PUBLIC_` variable or Git.
7. Deploy, then test `Continue with Google` from both `/sign-in` and `/sign-up`.

Google requires exact callback URIs. For preview OAuth, use a stable preview web domain registered in Google Cloud, or create a separate preview client; do not use a broad Vercel wildcard callback.

Docker is for local development or Docker-capable hosts. Vercel does not deploy Docker images directly.
