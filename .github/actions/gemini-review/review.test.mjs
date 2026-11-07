import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {
  SUMMARY_MARKER,
  backoffMs,
  buildChunks,
  buildInlineReview,
  buildSummaryComment,
  callGemini,
  filePieces,
  fingerprint,
  noiseReason,
  parseDiff,
  parseExcludes,
  parseRetryDelayMs,
  planInline,
  reviewChunks,
  run,
  selectFiles,
  splitChunk,
  splitDiffByFile,
  upsertSummaryComment,
  validateFindings,
  createGitHub,
} from './review.mjs';

const DIFF = `diff --git a/apps/api/src/a.ts b/apps/api/src/a.ts
index 1111111..2222222 100644
--- a/apps/api/src/a.ts
+++ b/apps/api/src/a.ts
@@ -1,3 +1,4 @@
 const a = 1;
-const b = 2;
+const b = 3;
+const c = 4;
 export {};
@@ -20,2 +21,3 @@ function f() {
 return a;
+return b;
 }
diff --git a/package-lock.json b/package-lock.json
index 3333333..4444444 100644
--- a/package-lock.json
+++ b/package-lock.json
@@ -1 +1 @@
-{}
+{"x":1}
diff --git a/apps/web/old.ts b/apps/web/old.ts
deleted file mode 100644
index 5555555..0000000
--- a/apps/web/old.ts
+++ /dev/null
@@ -1,2 +0,0 @@
-gone
-gone too
diff --git a/apps/web/x.ts b/apps/web/y.ts
similarity index 100%
rename from apps/web/x.ts
rename to apps/web/y.ts
diff --git a/apps/web/public/logo.png b/apps/web/public/logo.png
index 6666666..7777777 100644
Binary files a/apps/web/public/logo.png and b/apps/web/public/logo.png differ
`;

function bigFile(name, hunks, linesPerHunk) {
  let text = `diff --git a/${name} b/${name}\nindex 1..2 100644\n--- a/${name}\n+++ b/${name}\n`;
  for (let h = 0; h < hunks; h += 1) {
    const start = h * 1000 + 1;
    text += `@@ -${start},0 +${start},${linesPerHunk} @@\n` + `+${'x'.repeat(40)}\n`.repeat(linesPerHunk);
  }
  return text;
}

test('parseDiff tracks added and right-side lines across hunks', () => {
  const parsed = parseDiff(DIFF);
  const a = parsed.get('apps/api/src/a.ts');
  assert.deepEqual([...a.added].sort((x, y) => x - y), [2, 3, 22]);
  assert.ok(a.rightLines.has(1) && a.rightLines.has(21) && a.rightLines.has(23));
  assert.equal(a.additions, 3);
  assert.equal(a.deletions, 1);
});

test('splitDiffByFile resolves deleted, renamed, and binary files', () => {
  const byPath = Object.fromEntries(splitDiffByFile(DIFF).map((f) => [f.path, f]));
  assert.equal(byPath['apps/web/old.ts'].status, 'deleted');
  assert.equal(byPath['apps/web/y.ts'].status, 'renamed');
  assert.equal(byPath['apps/web/y.ts'].oldPath, 'apps/web/x.ts');
  assert.equal(byPath['apps/web/public/logo.png'].binary, true);
});

test('noise filter drops lockfiles, generated code, build output, snapshots, assets, pure renames', () => {
  const extra = [
    'apps/api/src/generated/prisma/client.ts',
    'apps/web/.next/server/app.js',
    'packages/ui/dist/index.js',
    'apps/web/__snapshots__/a.test.tsx.snap',
    'apps/web/components/a.test.tsx.snap',
    'apps/api/prisma/migrations/20260101_x/migration.sql',
    'pnpm-lock.yaml',
  ]
    .map((p) => `diff --git a/${p} b/${p}\n--- a/${p}\n+++ b/${p}\n@@ -1 +1 @@\n-a\n+b\n`)
    .join('');
  const { included, skipped } = selectFiles(splitDiffByFile(DIFF + extra));
  assert.deepEqual(
    included.map((f) => f.path).sort(),
    ['apps/api/prisma/migrations/20260101_x/migration.sql', 'apps/api/src/a.ts', 'apps/web/old.ts'],
  );
  const reasons = Object.fromEntries(skipped.map((s) => [s.path, s.reason]));
  assert.equal(reasons['package-lock.json'], 'lockfile');
  assert.equal(reasons['pnpm-lock.yaml'], 'lockfile');
  assert.equal(reasons['apps/api/src/generated/prisma/client.ts'], 'generated');
  assert.equal(reasons['apps/web/.next/server/app.js'], 'build output');
  assert.equal(reasons['packages/ui/dist/index.js'], 'build output');
  assert.equal(reasons['apps/web/__snapshots__/a.test.tsx.snap'], 'snapshot');
  assert.equal(reasons['apps/web/components/a.test.tsx.snap'], 'snapshot');
  assert.equal(reasons['apps/web/y.ts'], 'pure rename');
  assert.ok(reasons['apps/web/public/logo.png']);
});

test('GEMINI_REVIEW_EXCLUDE prefixes are skipped with a clear reason', () => {
  const excludes = parseExcludes(' apps/web/,\n docs/ ,');
  assert.deepEqual(excludes, ['apps/web/', 'docs/']);
  const { included, skipped } = selectFiles(splitDiffByFile(DIFF), excludes);
  assert.deepEqual(included.map((f) => f.path), ['apps/api/src/a.ts']);
  assert.ok(skipped.some((s) => s.path === 'apps/web/old.ts' && s.reason === 'excluded by GEMINI_REVIEW_EXCLUDE'));
});

test('deleted files are sent as a short note, not their content', () => {
  const file = parseDiff(DIFF).get('apps/web/old.ts');
  const [piece] = filePieces(file, 10_000);
  assert.match(piece.text, /file deleted: 2 lines removed/);
  assert.doesNotMatch(piece.text, /gone too/);
});

test('an oversized file is split on hunk boundaries and every piece keeps the file header', () => {
  const file = splitDiffByFile(bigFile('apps/api/src/big.ts', 6, 100))[0];
  const budget = 10_000;
  const pieces = filePieces(file, budget);
  assert.ok(pieces.length > 1);
  for (const p of pieces) {
    assert.ok(p.text.length <= budget, `piece ${p.text.length} > ${budget}`);
    assert.match(p.text, /^diff --git a\/apps\/api\/src\/big\.ts/);
    assert.match(p.text, /\+\+\+ b\/apps\/api\/src\/big\.ts/);
  }
  const hunkCount = pieces.reduce((n, p) => n + (p.text.match(/^@@ /gm) || []).length, 0);
  assert.equal(hunkCount, 6);
});

test('a single hunk larger than the budget is truncated and marked partial', () => {
  const file = splitDiffByFile(bigFile('apps/api/src/huge.ts', 1, 1000))[0];
  const pieces = filePieces(file, 8_000);
  assert.equal(pieces.length, 1);
  assert.equal(pieces[0].partial, true);
  assert.ok(pieces[0].text.length <= 8_000);
  assert.match(pieces[0].text, /hunk truncated/);
});

test('buildChunks respects the budget and covers every file', () => {
  const diff = Array.from({ length: 30 }, (_, i) => bigFile(`apps/web/f${String(i).padStart(2, '0')}.ts`, 1, 50)).join('');
  const files = splitDiffByFile(diff);
  const chunks = buildChunks(files, { budget: 12_000 });
  assert.ok(chunks.length > 1);
  for (const c of chunks) assert.ok(c.text.length <= 12_000);
  assert.deepEqual(chunks.flatMap((c) => c.files).sort(), files.map((f) => f.path).sort());
});

test('splitChunk halves a chunk and returns null for a single piece', () => {
  const files = splitDiffByFile(bigFile('a.ts', 1, 5) + bigFile('b.ts', 1, 5) + bigFile('c.ts', 1, 5));
  const [chunk] = buildChunks(files, { budget: 100_000 });
  const halves = splitChunk(chunk);
  assert.deepEqual(halves.map((h) => h.files), [['a.ts', 'b.ts'], ['c.ts']]);
  assert.equal(splitChunk(halves[1]), null);
});

test('validateFindings anchors right-side lines, keeps off-diff lines for the summary, drops junk', () => {
  const index = parseDiff(DIFF);
  const findings = [
    { file: 'apps/api/src/a.ts', line: 2, severity: 'blocking', title: 'ok', body: 'real', suggestion: null },
    { file: 'apps/api/src/a.ts', line: 1, severity: 'nit', title: 'context line', body: 'x', suggestion: null },
    { file: 'apps/api/src/a.ts', line: 99, severity: 'nit', title: 'off diff', body: 'x', suggestion: null },
    { file: 'apps/api/src/a.ts', line: 2, severity: 'critical', title: 'bad sev', body: 'x', suggestion: null },
    { file: 'apps/api/src/a.ts', line: 3, severity: 'nit', title: 'empty', body: '', suggestion: null },
    { file: 'nope.ts', line: 1, severity: 'nit', title: 'no file', body: 'x', suggestion: null },
    { file: 'apps/api/src/a.ts', line: 3, severity: 'blocking', title: 'OK', body: 'duplicate title', suggestion: null },
  ];
  const { anchored, unanchored, dropped } = validateFindings(findings, index);
  assert.deepEqual(anchored.map((f) => f.title), ['ok', 'context line']);
  assert.deepEqual(unanchored.map((f) => f.title), ['off diff']);
  assert.equal(dropped.length, 3);
});

test('planInline skips findings already posted and puts the most severe first, capped', () => {
  const mk = (title, severity) => ({ file: 'f.ts', line: 1, severity, title, body: 'b', fp: fingerprint({ file: 'f.ts', title }) });
  const anchored = [mk('a', 'nit'), mk('b', 'blocking'), mk('c', 'should-fix'), mk('d', 'blocking')];
  const { toPost, alreadyPosted } = planInline({ anchored, postedFingerprints: new Set([anchored[1].fp]), maxInline: 2 });
  assert.deepEqual(toPost.map((f) => f.title), ['d', 'c']);
  assert.equal(alreadyPosted, 1);
});

test('inline review uses COMMENT, RIGHT side, single-line suggestions, and a fingerprint marker', () => {
  const finding = { file: 'f.ts', line: 2, severity: 'should-fix', title: 'T', body: 'B', suggestion: 'x();', fp: 'abcdef012345' };
  const multi = { ...finding, suggestion: 'a\nb', fp: '0123456789ab' };
  const payload = buildInlineReview({ headSha: 'abc1234def', findings: [finding, multi] });
  assert.equal(payload.event, 'COMMENT');
  assert.equal(payload.commit_id, 'abc1234def');
  assert.equal(payload.comments[0].side, 'RIGHT');
  assert.match(payload.comments[0].body, /```suggestion\nx\(\);\n```/);
  assert.match(payload.comments[0].body, /<!-- gemini-review:fp=abcdef012345 -->/);
  assert.doesNotMatch(payload.comments[1].body, /```suggestion/);
});

test('summary comment starts with the marker and reports partial coverage', () => {
  const body = buildSummaryComment({
    model: 'm',
    headSha: 'abcdef1234',
    summary: 'Overall.',
    findings: [{ file: 'f.ts', line: 3, severity: 'blocking', title: 'T', body: 'B', fp: 'x' }],
    inlineIds: new Set(['x']),
    status: 'partial',
    statusNote: '1 file(s) were not reviewed.',
    totalFiles: 3,
    reviewedFiles: ['f.ts'],
    notReviewed: [{ path: 'g.ts', reason: 'gemini http 429' }],
    skipped: [{ path: 'package-lock.json', reason: 'lockfile' }],
    chunkCount: 2,
  });
  assert.ok(body.startsWith(SUMMARY_MARKER));
  assert.match(body, /Partial review/);
  assert.match(body, /`f.ts:3` 💬 \*\*T\*\*/);
  assert.match(body, /reviewed 1 of 3 changed files in 2 chunks; <b>1 not reviewed<\/b>/);
  assert.match(body, /`g.ts` \(gemini http 429\)/);
  assert.match(body, /`package-lock.json` \(lockfile\)/);
});

test('parseRetryDelayMs reads Retry-After and google.rpc.RetryInfo', () => {
  assert.equal(parseRetryDelayMs(new Headers({ 'retry-after': '7' }), ''), 7000);
  const body = JSON.stringify({ error: { details: [{ '@type': 'type.googleapis.com/google.rpc.RetryInfo', retryDelay: '37s' }] } });
  assert.equal(parseRetryDelayMs(new Headers(), body), 37000);
  assert.equal(parseRetryDelayMs(new Headers(), '{}'), null);
});

test('backoffMs grows exponentially with jitter and caps at 60s', () => {
  assert.equal(backoffMs(0, () => 0), 1000);
  assert.equal(backoffMs(0, () => 1), 2000);
  assert.equal(backoffMs(3, () => 1), 16000);
  assert.equal(backoffMs(10, () => 1), 60000);
});

const ok = (text) => new Response(JSON.stringify({ candidates: [{ content: { parts: [{ text }] }, finishReason: 'STOP' }] }), { status: 200 });

test('callGemini honors the server retry delay on 429, sends the key in a header, skips thought parts', async () => {
  const delays = [];
  const seen = [];
  let calls = 0;
  const fakeFetch = async (url, init) => {
    seen.push({ url, key: init.headers['x-goog-api-key'] });
    calls += 1;
    if (calls === 1) return new Response(JSON.stringify({ error: { details: [{ retryDelay: '12s' }] } }), { status: 429 });
    return new Response(
      JSON.stringify({ candidates: [{ content: { parts: [{ text: 'thinking', thought: true }, { text: '{"summary":"s","findings":[]}' }] }, finishReason: 'STOP' }] }),
      { status: 200 },
    );
  };
  const result = await callGemini({ apiKey: 'k', model: 'm', body: {}, fetchImpl: fakeFetch, sleep: async (ms) => delays.push(ms), baseUrl: 'https://example.test' });
  assert.equal(result.summary, 's');
  assert.deepEqual(delays, [12000]);
  assert.equal(seen[0].key, 'k');
  assert.doesNotMatch(seen[0].url, /key=/);
});

test('callGemini does not retry a 400 and marks MAX_TOKENS as splittable', async () => {
  let calls = 0;
  await assert.rejects(
    callGemini({ apiKey: 'k', model: 'm', body: {}, fetchImpl: async () => { calls += 1; return new Response('bad', { status: 400 }); }, sleep: async () => {} }),
    /gemini http 400/,
  );
  assert.equal(calls, 1);
  const truncated = async () => new Response(JSON.stringify({ candidates: [{ content: { parts: [{ text: '{"summ' }] }, finishReason: 'MAX_TOKENS' }] }), { status: 200 });
  await assert.rejects(callGemini({ apiKey: 'k', model: 'm', body: {}, fetchImpl: truncated, sleep: async () => {} }), (e) => e.splittable === true);
});

test('callGemini gives up when the next wait would pass the deadline', async () => {
  let calls = 0;
  const fakeFetch = async () => { calls += 1; return new Response('{}', { status: 503 }); };
  await assert.rejects(callGemini({ apiKey: 'k', model: 'm', body: {}, fetchImpl: fakeFetch, sleep: async () => {}, deadline: 0, now: () => 1 }), /503/);
  assert.equal(calls, 1);
});

test('reviewChunks splits a chunk the model could not finish and records failures per file', async () => {
  const files = splitDiffByFile(bigFile('a.ts', 1, 5) + bigFile('b.ts', 1, 5) + bigFile('c.ts', 1, 5));
  const chunks = buildChunks(files, { budget: 100_000 });
  const callModel = async (req) => {
    if (req.files.length > 1) throw Object.assign(new Error('output hit the token limit'), { splittable: true });
    if (req.files[0] === 'c.ts') throw Object.assign(new Error('gemini http 429'), { splittable: false });
    return { summary: req.files[0], findings: [] };
  };
  const { results, notReviewed } = await reviewChunks({
    chunks, maxChunks: 10, callModel, buildRequest: (c) => c, deadline: Infinity, now: () => 0, log: () => {},
  });
  assert.deepEqual(results.map((r) => r.result.summary), ['a.ts', 'b.ts']);
  assert.deepEqual(notReviewed, [{ path: 'c.ts', reason: 'gemini http 429' }]);
});

test('reviewChunks marks chunks over the cap as not reviewed', async () => {
  const files = splitDiffByFile(bigFile('a.ts', 1, 50) + bigFile('b.ts', 1, 50));
  const chunks = buildChunks(files, { budget: 3_000 });
  const { results, notReviewed } = await reviewChunks({
    chunks, maxChunks: 1, callModel: async () => ({ summary: 's', findings: [] }), buildRequest: (c) => c, deadline: Infinity, now: () => 0, log: () => {},
  });
  assert.equal(results.length, 1);
  assert.deepEqual(notReviewed.map((n) => n.reason), ['over the 1-chunk limit']);
});

test('upsertSummaryComment edits the existing bot comment instead of posting a new one', async () => {
  const calls = [];
  const fakeFetch = async (url, init) => {
    calls.push(`${init.method} ${url.replace('https://api.github.com/repos/o/r', '')}`);
    if (init.method === 'GET') {
      return new Response(JSON.stringify([
        { id: 1, user: { login: 'someone', type: 'User' }, body: `${SUMMARY_MARKER} fake` },
        { id: 2, user: { login: 'github-actions[bot]', type: 'Bot' }, body: `${SUMMARY_MARKER}\nold` },
      ]), { status: 200 });
    }
    return new Response('{}', { status: 200 });
  };
  const github = createGitHub({ token: 't', repo: 'o/r', fetchImpl: fakeFetch });
  const res = await upsertSummaryComment(github, 5, 'new');
  assert.equal(res.updated, true);
  assert.deepEqual(calls, ['GET /issues/5/comments?per_page=100&page=1', 'PATCH /issues/comments/2']);
});

test('run exits quietly with no network when the Gemini key is missing', async () => {
  let fetched = false;
  const result = await run({
    env: { PR_NUMBER: '1', REPO: 'o/r', GH_TOKEN: 't' },
    fetchImpl: async () => { fetched = true; return new Response('{}'); },
    log: () => {},
  });
  assert.equal(result.status, 'skipped');
  assert.equal(fetched, false);
});

test('run skips a draft PR unless forced', async () => {
  const fakeFetch = async () => new Response(JSON.stringify({ number: 1, state: 'open', draft: true, base: { ref: 'main', sha: 'b' }, head: { sha: 'h' } }), { status: 200 });
  const result = await run({ env: { GEMINI_API_KEY: 'k', PR_NUMBER: '1', REPO: 'o/r', GH_TOKEN: 't' }, fetchImpl: fakeFetch, log: () => {} });
  assert.equal(result.status, 'skipped');
});

test('run reports a failed review in the summary when every chunk fails, without throwing', async () => {
  const posted = [];
  const fakeFetch = async (url, init) => {
    if (url.includes('generativelanguage') || url.includes('example.test')) return new Response('{}', { status: 503 });
    if (init.method === 'GET') return new Response('[]', { status: 200 });
    posted.push(JSON.parse(init.body).body);
    return new Response('{}', { status: 201 });
  };
  const result = await run({
    env: { GEMINI_API_KEY: 'k', PR_NUMBER: '1', REPO: 'o/r', GH_TOKEN: 't', DIFF_FILE: 'x', HEAD_SHA: 'abcdef1', GEMINI_BASE_URL: 'https://example.test' },
    fetchImpl: fakeFetch,
    sleep: async () => {},
    readFile: async (file) => (file === 'x' ? DIFF : 'prompt'),
    log: () => {},
  });
  assert.equal(result.status, 'failed');
  assert.equal(posted.length, 1);
  assert.match(posted[0], /Review not completed/);
  assert.match(posted[0], /`apps\/api\/src\/a.ts` \(gemini http 503\)/);
});

// Real-world sample: set GEMINI_REVIEW_SAMPLE_DIFF to a large diff file, e.g.
//   git diff origin/main...origin/fix/system-audit-remediation > /tmp/pr34.diff
const sample = process.env.GEMINI_REVIEW_SAMPLE_DIFF;
test('large real diff: every reviewable file lands in a chunk under budget', { skip: !sample }, () => {
  const text = fs.readFileSync(sample, 'utf8');
  const files = splitDiffByFile(text);
  const { included, skipped } = selectFiles(files);
  const chunks = buildChunks(included);
  for (const c of chunks) assert.ok(c.text.length <= 180_000);
  assert.deepEqual([...new Set(chunks.flatMap((c) => c.files))].sort(), included.map((f) => f.path).sort());
  assert.ok(chunks.length <= 24, `${chunks.length} chunks`);
  console.log(
    `sample: ${files.length} files, ${text.length} chars -> ${included.length} reviewed in ${chunks.length} chunks ` +
      `(${chunks.map((c) => c.text.length).join(', ')} chars); skipped ${skipped.length}: ` +
      Object.entries(skipped.reduce((acc, s) => ({ ...acc, [s.reason]: (acc[s.reason] || 0) + 1 }), {}))
        .map(([k, v]) => `${k}=${v}`)
        .join(', '),
  );
});
