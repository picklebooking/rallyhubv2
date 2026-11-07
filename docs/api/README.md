# Testing the API with Postman

A ready-made Postman collection for every RallyHub API route, plus a dev command that makes your account a platform admin so you can test the admin-only routes.

## Files

| File                                                       | What it is                                                                                |
| ---------------------------------------------------------- | ----------------------------------------------------------------------------------------- |
| `docs/api/postman/RallyHub API.postman_collection.json`    | Every API route, the Better Auth sign-up/sign-in calls, and an "Expected refusals" folder |
| `docs/api/postman/RallyHub Local.postman_environment.json` | API on `http://localhost:3001`, web origin `http://localhost:3000`                        |
| `docs/api/postman/RallyHub Dev.postman_environment.json`   | The shared dev API. Every `REPLACE_ME` value has to be filled in                          |

## Setup (5 minutes)

1. Install the **Postman desktop app**. The web app only works with the Desktop Agent, because sign-in uses cookies.
2. In Postman, choose **Import** and pick the three files above.
3. Pick the **RallyHub Local** environment (top right).
4. In the environment, set `userPassword` and `secondPassword` (8+ characters). They ship empty on purpose; don't commit yours. In **RallyHub Dev**, also replace `ownerEmail` and `secondEmail` with addresses only you use, because the dev database is shared.
5. Start the API: `npm run dev -w api`. It must listen on port 3001 (`PORT=3001` in `apps/api/.env`). Leave `AUTH_DEV_BYPASS_EMAIL` unset, or every request runs as that one user and the permission checks can't be tested.

The collection's own description (click the collection name) has the full details.

## How sign-in works

There are no tokens to copy. Better Auth sets a session cookie when you sign up or sign in, and Postman sends it back on every request.

- Sign-up and sign-in send `Origin: {{webOrigin}}`. The API only accepts origins listed in `BETTER_AUTH_TRUSTED_ORIGINS`.
- To act as a different user, sign in as that user. The last sign-in wins.
- The cookie is `better-auth.session_token` over http and `__Secure-better-auth.session_token` over https. You can see it in Postman under **Cookies**.

## Becoming a platform admin

Creating a tenant, changing its status and deleting it are platform-admin only. Nobody is an admin by default, and nothing in the app grants it. Use the dev command from the repo root:

```bash
npm run dev:make-admin -w api -- you@example.com            # grant
npm run dev:make-admin -w api -- you@example.com --revoke   # take it away
```

- It uses the `DATABASE_URL` the API uses (`apps/api/.env`).
- **Local database:** runs straight away.
- **Any other database (e.g. the shared dev DB):** it refuses and tells you the host it found. Run it again with `--remote=<that host>`. If the host you name doesn't match, it refuses, so it can't write to the wrong database by accident.
- It refuses to run when `NODE_ENV=production`, and never prints the database password or username.
- No need to sign in again: admin status is read from the database on every request.

## Suggested order

The collection description lists the full 12-step run order. In short:

1. **Auth › Sign up (owner)**, then run `dev:make-admin` for that email.
2. **Tenant › Create tenant**, then set its status to `ACTIVE`.
3. **Tenant members › Add member**: add yourself as `OWNER`. Open Play management needs a real membership, not just admin.
4. **Venues › Create venue**, set it `ACTIVE`, then **Replace booking settings**.
5. **Courts › Create court**, then **Court booking › Create booking**.
6. **Auth › Sign up (second user)** and run **Expected refusals** to see the `403`s and `409`s.

New tenants and venues start as `PENDING`, and bookings need the tenant, venue and court all `ACTIVE`. Requests save the IDs they create (`tenantId`, `venueId`, `courtId`, `bookingId`…) into the environment for the next request. If an ID is missing, the request stops with a message naming the request to run first.

The Postman Runner runs requests top to bottom, which is grouped by area, not by the run order. Follow the order by hand, or run one folder at a time.

## Who can do what

| Action                                                    | Who                                                                        |
| --------------------------------------------------------- | -------------------------------------------------------------------------- |
| Create a tenant, change its status, delete it             | Platform admin                                                             |
| Edit tenant details                                       | Platform admin, tenant `OWNER`                                             |
| List, add, update and remove tenant members               | Platform admin, tenant `OWNER`                                             |
| Create a venue                                            | Platform admin, any tenant-wide member (`OWNER` or `STAFF`)                |
| Edit a venue, its booking settings and its courts         | Platform admin, tenant-wide `OWNER`/`STAFF`, staff of that venue           |
| Book a court, join or leave an Open Play game             | Any signed-in user                                                         |
| Manage an Open Play game (view, visibility)               | The booker, or staff of that venue                                         |
| Turn Open Play on for a private booking                   | Staff of that venue (`OWNER`/`STAFF` membership; admin alone isn't enough) |
| Cancel an Open Play game                                  | The booker only                                                            |
| Browse venues, courts and booking settings                | Any signed-in user                                                         |
| List public Open Play games, open a game by its join link | Anyone, no sign-in needed                                                  |

Only active memberships count. A tenant always keeps at least one active tenant-wide owner.

## Common errors

| Status                     | Usually means                                                                                                                                                                   |
| -------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `401`                      | Not signed in, or the session cookie is missing. Sign in again, and check that Postman isn't blocking cookies for the API host.                                                 |
| `403`                      | Signed in but not allowed (see the table above), or Better Auth rejected the `Origin`.                                                                                          |
| `400` "… context required" | The `X-Tenant-Id` or `X-Venue-Id` header is missing or points at an unknown ID.                                                                                                 |
| `409`                      | A conflict: slot already booked, member already exists, last owner, or the venue or court still has bookings. A `409` with a "try again" message means a lock timed out; retry. |
| `429`                      | Rate limit: 100 requests per 60 seconds, then blocked for 60 seconds.                                                                                                           |

## Keeping the collection up to date

When you add or change a route, update the matching request (path, body, description of who may call it) in the same PR. Export from Postman with **Collection v2.1** format and two-space JSON.
