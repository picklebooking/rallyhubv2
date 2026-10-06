# Gemini PR review

An advisory reviewer that runs on each non-draft pull request. It sends the diff to the Gemini API, checks each finding against the diff, and posts one review with inline comments. It never approves or blocks a merge.

## What it reviews

- Only lines a pull request adds.
- Findings are checked against this repo's rules (see `prompt.md`). A finding on a line outside the diff is dropped, not moved.
- Skipped before review, and listed in the review summary: `package-lock.json`, `*.lock`, `apps/api/src/generated/**`, and any file with more than 800 changed lines.
- A diff over 150 KB after skipping is not reviewed. The PR gets a one-line note instead.

## What it does not do

- It does not review fork pull requests. Forks receive no secrets, so the workflow skips them.
- It does not review draft pull requests.
- It does not fix code or push commits.
- It does not replace human review.

## Setup

1. Add a repository secret named `GEMINI_API_KEY` under Settings, then Secrets and variables, then Actions. Use a repository secret, not an organization one.
2. Nothing else is needed. The workflow is `.github/workflows/gemini-review.yml`.

The key is passed as an environment variable and never printed. Logs report the status code and error name only.

## Running it locally against a saved diff

```bash
gh pr diff 123 > /tmp/pr.diff
DRY_RUN=1 DIFF_FILE=/tmp/pr.diff GEMINI_API_KEY=... HEAD_SHA=$(gh pr view 123 --json headRefOid --jq .headRefOid) node .github/actions/gemini-review/review.mjs
```

`DRY_RUN=1` prints the review payload as JSON and posts nothing.

## Disabling it

Delete `.github/workflows/gemini-review.yml`, or remove the `GEMINI_API_KEY` secret. With no key, the job logs a notice and exits without calling Gemini.

## Failure behavior

Every failure exits 0 so the PR check is never blocked.

- Gemini returns 429 or 5xx: retried twice, after 2 and 8 seconds. If it still fails, the PR gets one comment: "Automated review unavailable this run."
- Gemini returns invalid JSON: nothing is posted, and a notice is logged.
- GitHub rejects inline comments with 422: the review is posted again without inline comments, and the summary says so.

## Tests

```bash
node --test .github/actions/gemini-review/review.test.mjs
```

## Security notes

- The workflow checks out the base branch, so the reviewer code that receives the key is the code already on `main`, not code from the pull request.
- The workflow file itself comes from the pull request. Anyone with write access can change it, so treat changes to `.github/workflows/gemini-review.yml` as security-sensitive.
- The model call uses the key in the query string, as Google's documentation shows. The script never logs URLs.
