import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const MODEL = 'gemini-3.8-flash';
const DEFAULT_BASE_URL = 'https://generativelanguage.googleapis.com';
const BACKOFF_MS = [2000, 8000];
const MAX_DIFF_BYTES = 150 * 1024;
const MAX_CHANGED_LINES = 800;
const MAX_BODY_CHARS = 1500;
const SEVERITIES = ['blocking', 'should-fix', 'nit'];
const GENERATED_PREFIX = 'apps/api/src/generated/';
const HERE = path.dirname(fileURLToPath(import.meta.url));

const FINDINGS_SCHEMA = {
  type: 'object',
  properties: {
    summary: { type: 'string' },
    findings: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          file: { type: 'string' },
          line: { type: 'integer' },
          severity: { type: 'string', enum: SEVERITIES },
          title: { type: 'string' },
          body: { type: 'string' },
          suggestion: { type: ['string', 'null'] },
        },
        required: ['file', 'line', 'severity', 'title', 'body', 'suggestion'],
      },
    },
  },
  required: ['summary', 'findings'],
};

export function splitDiffByFile(diffText) {
  return diffText
    .split(/(?=^diff --git )/m)
    .filter((chunk) => chunk.startsWith('diff --git '))
    .map((chunk) => {
      const header = /^diff --git a\/(.+?) b\/(.+)$/m.exec(chunk);
      const filePath = header ? header[2] : '';
      return { path: filePath, text: chunk, ...parseChunk(chunk) };
    });
}

function parseChunk(text) {
  const added = new Set();
  let changed = 0;
  let newLine = 0;
  let inHunk = false;
  for (const line of text.split('\n')) {
    const hunk = /^@@ -\d+(?:,\d+)? \+(\d+)(?:,\d+)? @@/.exec(line);
    if (hunk) {
      newLine = Number(hunk[1]);
      inHunk = true;
      continue;
    }
    if (!inHunk) continue;
    if (line.startsWith('+')) {
      added.add(newLine);
      newLine += 1;
      changed += 1;
    } else if (line.startsWith('-')) {
      changed += 1;
    } else if (line.startsWith(' ')) {
      newLine += 1;
    }
  }
  return { added, changed };
}

export function parseDiff(diffText) {
  return new Map(splitDiffByFile(diffText).map((chunk) => [chunk.path, chunk]));
}

function isLockfile(filePath) {
  return filePath === 'package-lock.json' || filePath.endsWith('.lock');
}

export function selectFiles(chunks) {
  const included = [];
  const skipped = [];
  for (const chunk of chunks) {
    if (isLockfile(chunk.path)) {
      skipped.push({ path: chunk.path, reason: 'lockfile' });
    } else if (chunk.path.startsWith(GENERATED_PREFIX)) {
      skipped.push({ path: chunk.path, reason: 'generated' });
    } else if (chunk.changed > MAX_CHANGED_LINES) {
      skipped.push({ path: chunk.path, reason: `too large (${chunk.changed} changed lines)` });
    } else {
      included.push(chunk);
    }
  }
  return { included, skipped };
}

export function validateFindings(result, index) {
  const findings = Array.isArray(result?.findings) ? result.findings : [];
  const valid = [];
  const dropped = [];
  for (const finding of findings) {
    const reason = findingProblem(finding, index);
    if (reason) {
      dropped.push({ finding, reason });
    } else {
      valid.push(finding);
    }
  }
  return { valid, dropped };
}

function findingProblem(finding, index) {
  const chunk = typeof finding?.file === 'string' ? index.get(finding.file) : undefined;
  if (!chunk) return 'file not in diff';
  if (!Number.isInteger(finding.line) || !chunk.added.has(finding.line)) return 'line not an added line';
  if (!SEVERITIES.includes(finding.severity)) return 'bad severity';
  if (typeof finding.title !== 'string' || finding.title.trim() === '') return 'empty title';
  if (typeof finding.body !== 'string' || finding.body.trim() === '') return 'empty body';
  if (finding.body.length > MAX_BODY_CHARS) return 'body too long';
  return null;
}

function formatCommentBody(finding) {
  let body = `**${finding.severity}** · ${finding.title}\n\n${finding.body}`;
  const suggestion = finding.suggestion;
  if (typeof suggestion === 'string' && suggestion.length > 0 && !suggestion.includes('\n')) {
    body += `\n\n\`\`\`suggestion\n${suggestion}\n\`\`\``;
  }
  return body;
}

export function buildReview({ headSha, findings, summary, droppedCount, skipped }) {
  const skippedText = skipped.length
    ? `\n\nSkipped before review: ${skipped.map((s) => `${s.path} (${s.reason})`).join(', ')}.`
    : '';
  const body =
    `Automated review (advisory, Gemini). ${summary}\n\n` +
    `Posted ${findings.length} inline finding(s); ${droppedCount} dropped by validation.` +
    skippedText;
  return {
    commit_id: headSha,
    event: 'COMMENT',
    body,
    comments: findings.map((finding) => ({
      path: finding.file,
      line: finding.line,
      side: 'RIGHT',
      body: formatCommentBody(finding),
    })),
  };
}

export function buildRequest({ promptMd, diffText, title, skipped }) {
  const skippedNames = skipped.map((s) => s.path).join(', ') || 'none';
  const text =
    `${promptMd}\n\nPull request title: ${title}\n\nFiles skipped before review: ${skippedNames}\n\n` +
    `Unified diff. Only lines with a + prefix are new and can be commented on:\n\n${diffText}`;
  return {
    contents: [{ parts: [{ text }] }],
    generationConfig: {
      responseMimeType: 'application/json',
      responseJsonSchema: FINDINGS_SCHEMA,
      temperature: 0.2,
    },
  };
}

export async function callGemini({ apiKey, model, body, fetchImpl, sleep, baseUrl }) {
  const url = `${baseUrl}/v1beta/models/${model}:generateContent?key=${apiKey}`;
  for (let attempt = 0; attempt <= BACKOFF_MS.length; attempt += 1) {
    if (attempt > 0) await sleep(BACKOFF_MS[attempt - 1]);
    const res = await fetchImpl(url, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
    });
    if (res.status === 429 || res.status >= 500) continue;
    if (!res.ok) throw new Error(`gemini http ${res.status}`);
    const json = await res.json();
    const text = json?.candidates?.[0]?.content?.parts?.[0]?.text;
    if (typeof text !== 'string') throw new Error('gemini empty response');
    return JSON.parse(text);
  }
  throw new Error('gemini unavailable');
}

function githubHeaders(token) {
  return {
    Authorization: `Bearer ${token}`,
    Accept: 'application/vnd.github+json',
    'X-GitHub-Api-Version': '2022-11-28',
    'content-type': 'application/json',
  };
}

export async function postReview({ fetchImpl, token, repo, prNumber, payload }) {
  const url = `https://api.github.com/repos/${repo}/pulls/${prNumber}/reviews`;
  const first = await fetchImpl(url, { method: 'POST', headers: githubHeaders(token), body: JSON.stringify(payload) });
  if (first.ok) return { ok: true, commentsDropped: false };
  if (first.status !== 422 || payload.comments.length === 0) return { ok: false, status: first.status };
  const retryPayload = {
    ...payload,
    comments: [],
    body: `${payload.body}\n\nInline comments could not be anchored to the diff this run.`,
  };
  const second = await fetchImpl(url, { method: 'POST', headers: githubHeaders(token), body: JSON.stringify(retryPayload) });
  return { ok: second.ok, commentsDropped: true, status: second.status };
}

export async function postIssueComment({ fetchImpl, token, repo, prNumber, body }) {
  const url = `https://api.github.com/repos/${repo}/issues/${prNumber}/comments`;
  const res = await fetchImpl(url, { method: 'POST', headers: githubHeaders(token), body: JSON.stringify({ body }) });
  return { ok: res.ok };
}

async function defaultSleep(ms) {
  await new Promise((resolve) => setTimeout(resolve, ms));
}

export async function run({
  env,
  fetchImpl = globalThis.fetch,
  sleep = defaultSleep,
  readFile = (file) => fs.readFile(file, 'utf8'),
  log = (message) => console.log(message),
  out = (text) => process.stdout.write(text),
}) {
  const apiKey = env.GEMINI_API_KEY;
  if (!apiKey) {
    log('::notice::GEMINI_API_KEY is not set; skipping automated review');
    return;
  }
  const dryRun = env.DRY_RUN === '1';
  const repo = env.REPO;
  const prNumber = env.PR_NUMBER;
  const token = env.GH_TOKEN;

  try {
    const diffText = await readFile(env.DIFF_FILE);
    const chunks = splitDiffByFile(diffText);
    const { included, skipped } = selectFiles(chunks);
    if (included.length === 0) {
      log('::notice::no reviewable files in this diff');
      return;
    }
    const reviewedText = included.map((chunk) => chunk.text).join('');
    if (reviewedText.length > MAX_DIFF_BYTES) {
      const message = 'Automated review skipped: the diff is too large for automated review.';
      if (!dryRun) await postIssueComment({ fetchImpl, token, repo, prNumber, body: message });
      log(`::notice::${message}`);
      return;
    }

    const promptMd = await readFile(path.join(HERE, 'prompt.md'));
    const body = buildRequest({ promptMd, diffText: reviewedText, title: env.PR_TITLE || '', skipped });
    const baseUrl = env.GEMINI_BASE_URL || DEFAULT_BASE_URL;

    let result;
    try {
      result = await callGemini({ apiKey, model: MODEL, body, fetchImpl, sleep, baseUrl });
    } catch (error) {
      const message = 'Automated review unavailable this run.';
      if (!dryRun) await postIssueComment({ fetchImpl, token, repo, prNumber, body: message });
      log(`::notice::${error.message}`);
      return;
    }

    const index = new Map(included.map((chunk) => [chunk.path, chunk]));
    const { valid, dropped } = validateFindings(result, index);
    const payload = buildReview({
      headSha: env.HEAD_SHA,
      findings: valid,
      summary: typeof result.summary === 'string' ? result.summary : 'No summary.',
      droppedCount: dropped.length,
      skipped,
    });

    if (dryRun) {
      out(`${JSON.stringify(payload, null, 2)}\n`);
      return;
    }
    if (!env.HEAD_SHA || !repo || !prNumber || !token) {
      log('::notice::missing GitHub context; not posting');
      return;
    }
    const posted = await postReview({ fetchImpl, token, repo, prNumber, payload });
    if (!posted.ok) log(`::notice::review post failed with status ${posted.status}`);
  } catch (error) {
    log(`::notice::automated review stopped: ${error.name}`);
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  run({ env: process.env }).then(
    () => process.exit(0),
    () => process.exit(0),
  );
}
