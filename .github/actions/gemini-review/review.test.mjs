import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  parseDiff,
  splitDiffByFile,
  selectFiles,
  validateFindings,
  buildReview,
  callGemini,
  postReview,
  run,
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
`;

test('parseDiff returns added line numbers across multiple hunks', () => {
  const parsed = parseDiff(DIFF);
  assert.deepEqual([...parsed.get('apps/api/src/a.ts').added].sort((x, y) => x - y), [2, 3, 22]);
  assert.deepEqual([...parsed.get('package-lock.json').added], [1]);
});

test('splitDiffByFile yields one chunk per file with its path', () => {
  const chunks = splitDiffByFile(DIFF);
  assert.deepEqual(chunks.map((c) => c.path), ['apps/api/src/a.ts', 'package-lock.json']);
  assert.match(chunks[0].text, /^diff --git a\/apps\/api\/src\/a\.ts/);
});

test('selectFiles excludes lockfiles, generated code, and oversized files', () => {
  const generated = 'diff --git a/apps/api/src/generated/x.ts b/apps/api/src/generated/x.ts\n+++ b/apps/api/src/generated/x.ts\n@@ -0,0 +1 @@\n+x\n';
  const big = 'diff --git a/apps/api/src/big.ts b/apps/api/src/big.ts\n+++ b/apps/api/src/big.ts\n@@ -0,0 +1,900 @@\n' + '+x\n'.repeat(900);
  const { included, skipped } = selectFiles(splitDiffByFile(DIFF + generated + big));
  assert.deepEqual(included.map((c) => c.path), ['apps/api/src/a.ts']);
  const reasons = Object.fromEntries(skipped.map((s) => [s.path, s.reason]));
  assert.equal(reasons['package-lock.json'], 'lockfile');
  assert.equal(reasons['apps/api/src/generated/x.ts'], 'generated');
  assert.match(reasons['apps/api/src/big.ts'], /too large/);
});

test('validateFindings drops out-of-diff lines, bad severity, and empty bodies', () => {
  const parsed = parseDiff(DIFF);
  const findings = [
    { file: 'apps/api/src/a.ts', line: 2, severity: 'blocking', title: 'ok', body: 'real', suggestion: null },
    { file: 'apps/api/src/a.ts', line: 99, severity: 'nit', title: 'off diff', body: 'x', suggestion: null },
    { file: 'apps/api/src/a.ts', line: 2, severity: 'critical', title: 'bad sev', body: 'x', suggestion: null },
    { file: 'apps/api/src/a.ts', line: 3, severity: 'nit', title: 'empty', body: '', suggestion: null },
    { file: 'nope.ts', line: 1, severity: 'nit', title: 'no file', body: 'x', suggestion: null },
  ];
  const { valid, dropped } = validateFindings({ findings }, parsed);
  assert.deepEqual(valid.map((f) => f.title), ['ok']);
  assert.equal(dropped.length, 4);
});

test('buildReview anchors every comment to RIGHT and uses COMMENT, not APPROVE', () => {
  const payload = buildReview({
    headSha: 'abc123',
    findings: [{ file: 'apps/api/src/a.ts', line: 2, severity: 'should-fix', title: 'T', body: 'B', suggestion: 'const b = 4;' }],
    summary: 'S',
    droppedCount: 0,
    skipped: [],
  });
  assert.equal(payload.event, 'COMMENT');
  assert.equal(payload.commit_id, 'abc123');
  assert.equal(payload.comments.length, 1);
  assert.equal(payload.comments[0].side, 'RIGHT');
  assert.equal(payload.comments[0].line, 2);
  assert.match(payload.comments[0].body, /^\*\*should-fix\*\*/);
  assert.match(payload.comments[0].body, /```suggestion\nconst b = 4;\n```/);
});

test('buildReview never emits a multi-line suggestion block', () => {
  const payload = buildReview({
    headSha: 'x',
    findings: [{ file: 'f', line: 1, severity: 'nit', title: 'T', body: 'B', suggestion: 'a\nb' }],
    summary: 'S',
    droppedCount: 0,
    skipped: [],
  });
  assert.doesNotMatch(payload.comments[0].body, /```suggestion/);
});

test('callGemini retries 500 twice then succeeds, with backoff 2s then 8s', async () => {
  const delays = [];
  let calls = 0;
  const fakeFetch = async () => {
    calls += 1;
    if (calls < 3) return new Response('err', { status: 500 });
    return new Response(JSON.stringify({ candidates: [{ content: { parts: [{ text: '{"summary":"s","findings":[]}' }] } }] }), { status: 200 });
  };
  const result = await callGemini({ apiKey: 'k', model: 'm', body: {}, fetchImpl: fakeFetch, sleep: async (ms) => delays.push(ms), baseUrl: 'https://example.test' });
  assert.equal(result.summary, 's');
  assert.equal(calls, 3);
  assert.deepEqual(delays, [2000, 8000]);
});

test('callGemini throws on invalid JSON from the model', async () => {
  const fakeFetch = async () => new Response(JSON.stringify({ candidates: [{ content: { parts: [{ text: 'not json' }] } }] }), { status: 200 });
  await assert.rejects(callGemini({ apiKey: 'k', model: 'm', body: {}, fetchImpl: fakeFetch, sleep: async () => {}, baseUrl: 'https://example.test' }));
});

test('postReview retries once without comments after a 422', async () => {
  const bodies = [];
  let calls = 0;
  const fakeFetch = async (_url, init) => {
    calls += 1;
    bodies.push(JSON.parse(init.body));
    if (calls === 1) return new Response('{"message":"Unprocessable"}', { status: 422 });
    return new Response('{}', { status: 200 });
  };
  const payload = { commit_id: 'x', event: 'COMMENT', body: 'b', comments: [{ path: 'p', line: 1, side: 'RIGHT', body: 'c' }] };
  const result = await postReview({ fetchImpl: fakeFetch, token: 't', repo: 'o/r', prNumber: 1, payload });
  assert.equal(result.ok, true);
  assert.equal(result.commentsDropped, true);
  assert.equal(bodies[0].comments.length, 1);
  assert.equal(bodies[1].comments.length, 0);
});

test('run exits quietly with no network when the Gemini key is missing', async () => {
  let fetched = false;
  await run({
    env: { DIFF_FILE: '/nonexistent' },
    fetchImpl: async () => {
      fetched = true;
      return new Response('{}', { status: 200 });
    },
    sleep: async () => {},
    readFile: async () => '',
    log: () => {},
    out: () => {},
  });
  assert.equal(fetched, false);
});
