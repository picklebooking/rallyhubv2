# API Deployment

The API must run Prisma production migrations before each deployment starts serving traffic.

## Vercel

The API is the `api` service in the root `vercel.json` (one Vercel project with the `web` and `api` services). Its build command is:

```bash
npm run vercel-build
```

which runs:

```bash
prisma generate && prisma migrate deploy && nest build
```

`DATABASE_URL` must be set in the deployment environment to the deployed database's **direct** connection; `prisma migrate deploy` runs through it. Set `DATABASE_POOLED_URL` to the same database's **pooled** connection for the running API: it falls back to `DATABASE_URL` when unset, but direct connections are capped low and serverless instances each open their own. Never put the pooled string in `DATABASE_URL`: the pooler runs in transaction mode, which breaks migrations. Every deployment, previews included, migrates the database it points at, so Preview must use its own database: otherwise an unmerged branch's migration reaches production.

Public traffic reaches the API on `/api/auth/*` (path unchanged) and `/api/backend/*` (seen by Nest without the `/api/backend` prefix). The `web` service calls it internally through the `API_INTERNAL_URL` binding.

## Docker

The production API image starts with:

```bash
npm run start:migrate:prod -w api
```

That command applies pending migrations and then starts the Nest server.
