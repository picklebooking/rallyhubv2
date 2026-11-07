# Membership safety verification (#15, #16)

Range: `ad19e83..6e6b97f` (Tasks 1–6). Task 7 was started by Codex and finished by Claude Code after Codex ran out of quota.

## Local gates

| Check | Result |
| --- | --- |
| Clean local replay (`migrate reset --force` on `rallyhub_test`) | 20 migrations applied (Codex, Task 7) |
| `npm run test -w api -- --runInBand` | 55 suites / 742 tests passed, 0 failed, 0 skipped |
| `npm run test -w api` (parallel) | 55 suites / 742 tests passed, 0 failed, 0 skipped |
| `npm run typecheck` | exit 0 |
| `npm run build -w api` / `-w web` | exit 0 / exit 0 |
| `npm run lint -w web` | 0 errors / 15 warnings (baseline unchanged) |
| API lint on the 15 touched `.ts` files vs `ad19e83` | no file gained errors |
| Migration `20261107103453_tenant_wide_member_unique` SHA-256 | `4e16baf333309f790011447fd3b23d97e3da4bc064177d3e573b24836f728796` (unchanged since Task 2) |

## Intermittent 401 (observed once, not reproduced)

Codex's first full serial run had one failure outside membership safety: `tenant.http.spec.ts` › "denies tenant creation by inactiveOwner" got 401 instead of 403. The 401 comes from the auth guard before tenant authorization runs. It did not reproduce in:
- Codex's isolated rerun of the tenant suite (35 tests) and a full serial rerun (742 tests)
- 15 consecutive isolated runs of the tenant suite (about 120 fresh sign-ups)
- the serial and parallel full runs above

No retry or code change was added to mask it. Original logs: `/tmp/rallyhub-membership-task7/03-api-serial.log`. It stays on the watch list; if it recurs, capture the 401 response body and the session row for the failing actor.

## Hosted dev DB (`pooled.db.prisma.io`), in order, from `apps/api` with no `DATABASE_URL` override

1. Design's read-only duplicate pre-check: `duplicate tenant-wide pairs: 0`.
2. `npx prisma migrate status`: 20 migrations found; only `20261107103453_tenant_wide_member_unique` pending.
3. `npx prisma migrate deploy`: applied `20261107103453_tenant_wide_member_unique`; "All migrations have been successfully applied."

No other hosted commands were run.
