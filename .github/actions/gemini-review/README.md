# Gemini PR review

An advisory reviewer for pull requests. It reviews the whole diff of a PR with the Gemini API, however large, and posts:

- one **summary comment**, updated in place on every run. It lists every finding, what was reviewed, what was skipped as noise, and anything that could not be reviewed.
- one **inline review** per run, holding only findings not already posted on the PR (at most 25, most severe first).

It never approves or blocks a merge, and the check never fails the PR.

## How it handles large PRs

| Old limit | Now |
| --- | --- |
| `gh pr diff` fails with HTTP 406 above 20,000 diff lines (PR #34) | The diff comes from `git diff base...head` in a full-history checkout. GitHub's diff, file-count, and page limits do not apply. |
| Diff over 150 KB after filtering: whole review skipped (PR #31) | Files are packed into chunks of about 180,000 characters (about 45k tokens) and each chunk is reviewed on its own. A file bigger than a chunk is split on hunk boundaries. |
| Any file with more than 800 changed lines: skipped | Reviewed in parts. Only a single hunk bigger than a chunk is cut short, and the summary lists it as reviewed in part. |
| 429 or 5xx: two retries 10 seconds apart, then an "unavailable" comment on every push | Up to five retries per request with exponential backoff and jitter, honoring Gemini's `retryDelay`. A chunk that still fails is listed by file under "Not reviewed", and the review continues. |
| Model output truncated: run lost | The chunk is split in half and both halves are retried. |

Limits that remain: at most 24 chunks (about 4 MB of diff) and a 24-minute time budget per run. Anything beyond that is listed as not reviewed. Each chunk sees only its own files, plus the list of every file in the PR.

## What is skipped as noise

Lockfiles, `apps/api/src/generated/**`, build output (`dist/`, `build/`, `.next/`, `out/`, `coverage/`, `.turbo/`), snapshots, binary files, images and fonts, source maps, minified files, and pure renames. For a deleted file, the reviewer gets only a note that the file was deleted. Migration SQL is reviewed.

To skip more paths, set the repository variable `GEMINI_REVIEW_EXCLUDE` to path prefixes separated by commas, for example `docs/superpowers/, apps/api/.agents/`.

## Triggers

- A same-repo, non-draft PR is opened, pushed to, reopened, or marked ready for review.
- A maintainer (owner, member, or collaborator) comments `/gemini-review` on a PR. This also works on drafts and fork PRs.
- Actions, then Gemini PR review, then Run workflow, with a PR number.

A newer run for the same PR cancels the older one.

## Setup

1. Add the repository secret `GEMINI_API_KEY` (Settings, then Secrets and variables, then Actions).
2. Optional repository variables:
   - `GEMINI_MODEL`: the model id. Default `gemini-3.8-flash`, a stable model with a 1,048,576-token input limit and a 65,536-token output limit.
   - `GEMINI_REVIEW_EXCLUDE`: extra path prefixes to skip.

## Security

- The reviewer code always comes from the base branch checkout (`pull_request`) or the default branch (`issue_comment`, `workflow_dispatch`). PR code is only fetched as git objects for the diff and is never run.
- On `pull_request`, fork PRs get no secrets, so they are skipped. A maintainer can review one with `/gemini-review`; then the workflow runs from the default branch, and the fork's diff is only data. `pull_request_target` is not used.
- Permissions: `contents: read`, `pull-requests: write`. Checkout does not keep credentials. The script passes the token to `git fetch` through `GIT_CONFIG_*` environment variables, not the command line.
- The Gemini key goes in the `x-goog-api-key` header and is never logged.
- The prompt tells the model that the diff and PR description are untrusted and that it must ignore instructions inside them. At worst, a prompt injection can change the text of advisory comments.
- On `pull_request`, the workflow file comes from the PR branch. Treat changes to `.github/workflows/gemini-review.yml` as security-sensitive.

## Tests

```bash
node --test .github/actions/gemini-review/review.test.mjs

# With a real large diff:
git diff origin/main...origin/some-big-branch > /tmp/big.diff
GEMINI_REVIEW_SAMPLE_DIFF=/tmp/big.diff node --test .github/actions/gemini-review/review.test.mjs
```

The tests never call Gemini or GitHub.

## Dry run against a saved diff

```bash
DRY_RUN=1 DIFF_FILE=/tmp/big.diff PR_NUMBER=1 REPO=owner/repo GEMINI_API_KEY=... \
  node .github/actions/gemini-review/review.mjs
```

`DRY_RUN=1` calls Gemini but posts nothing. It prints the summary comment instead.

## Disabling it

Delete `.github/workflows/gemini-review.yml`, or remove the `GEMINI_API_KEY` secret. Without the key, the job logs a notice and exits.
