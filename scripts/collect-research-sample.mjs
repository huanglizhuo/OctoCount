#!/usr/bin/env node
// Bounded sample collector for the filtering-effects study (SG-06).
//
// For each repository: run the default configuration, pin every other
// configuration to the commit the default run resolved, and append one JSONL
// line per run to the output file. Sequential (concurrency 1), no
// force-refresh, single retry per request, and a hard repository cap unless
// --max-repos is given. Failures are recorded as outcome:"failed" rows.
//
// Usage:
//   node scripts/collect-research-sample.mjs --repos facebook/react,vitejs/vite \
//     --out research/filtering-effects/pilot-samples.jsonl [--max-repos 2]
// Add --dry-run to print the plan without issuing any request.
import { appendFile, mkdir, writeFile } from "node:fs/promises";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import path from "node:path";
import { fileURLToPath } from "node:url";

const execFileAsync = promisify(execFile);

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const API = process.env.OCTOCOUNTS_API ?? "https://api.octocounts.com";
const JOB_POLL_MS = 2_000;
const JOB_POLL_LIMIT = 90; // 3 minutes per job before recording a failure

const CONFIGS = [
  { config: "default", options: { ignoredDirs: [], ignoredLanguages: [], profile: "default", includeDocs: true, includeTests: true, includeGenerated: true } },
  { config: "exclude-tests", options: { ignoredDirs: [], ignoredLanguages: [], profile: "default", includeDocs: true, includeTests: false, includeGenerated: true } },
  { config: "exclude-docs", options: { ignoredDirs: [], ignoredLanguages: [], profile: "default", includeDocs: false, includeTests: true, includeGenerated: true } },
  { config: "exclude-generated", options: { ignoredDirs: [], ignoredLanguages: [], profile: "default", includeDocs: true, includeTests: true, includeGenerated: false } },
];

// HTTP via curl: Node's bundled CA store does not trust this machine's
// proxy certificate ("unable to get local issuer certificate"), while curl
// uses the system store. Research-only tooling, so shelling out is fine.
async function curlJson(url, options = {}) {
  const args = ["-sS", "--max-time", String(options.timeoutMs ?? 30_000), "-w", "\n%{http_code}"];
  if (options.method === "POST") {
    args.push("-X", "POST", "-H", "content-type: application/json", "--data-binary", options.body);
  }
  const { stdout } = await execFileAsync("curl", [...args, url], { maxBuffer: 10 * 1024 * 1024 });
  const newline = stdout.lastIndexOf("\n");
  const status = Number(stdout.slice(newline + 1).trim());
  const body = stdout.slice(0, newline);
  if (status < 200 || status >= 300) throw new Error(`HTTP ${status}: ${body.slice(0, 200)}`);
  return body ? JSON.parse(body) : null;
}

function parseArgs(argv) {
  const args = { maxRepos: 2, dryRun: false, repos: [], out: "" };
  for (let i = 0; i < argv.length; i += 1) {
    if (argv[i] === "--repos") args.repos = argv[i + 1].split(",").map((value) => value.trim()).filter(Boolean);
    else if (argv[i] === "--out") args.out = argv[i + 1];
    else if (argv[i] === "--max-repos") args.maxRepos = Number(argv[i + 1]);
    else if (argv[i] === "--dry-run") args.dryRun = true;
  }
  return args;
}

async function analyzeOnce(repoUrl, refName, options) {
  return curlJson(`${API}/api/analyze`, {
    method: "POST",
    body: JSON.stringify({ repoUrl, refName: refName || undefined, forceRefresh: false, options, source: "api" }),
    timeoutMs: 60_000,
  });
}

async function withRetry(label, fn) {
  const startedAt = Date.now();
  try {
    const value = await fn();
    return { outcome: "ok", kind: value.kind, wallTimeMs: Date.now() - startedAt, report: value.kind === "cached" ? value.report : null, jobId: value.jobId ?? null };
  } catch (error) {
    await new Promise((resolve) => setTimeout(resolve, 1_000));
    try {
      const value = await fn();
      return { outcome: "ok-after-retry", kind: value.kind, wallTimeMs: Date.now() - startedAt, report: value.kind === "cached" ? value.report : null, jobId: value.jobId ?? null };
    } catch (retryError) {
      return { outcome: "failed", wallTimeMs: Date.now() - startedAt, error: `${label}: ${retryError.message}` };
    }
  }
}

async function waitForJob(jobId) {
  for (let attempt = 0; attempt < JOB_POLL_LIMIT; attempt += 1) {
    await new Promise((resolve) => setTimeout(resolve, JOB_POLL_MS));
    const payload = await curlJson(`${API}/api/jobs/${jobId}`);
    if (payload.status === "completed" && payload.reportId) {
      const reportPayload = await curlJson(`${API}/api/reports/${payload.reportId}`);
      return reportPayload.report ?? reportPayload;
    }
    if (payload.status === "failed") throw new Error(`job failed: ${payload.error ?? "unknown"}`);
  }
  throw new Error("job poll limit reached");
}

const totals = (report) => report
  ? { files: report.total.files, lines: report.total.lines, code: report.total.code, comments: report.total.comments, blanks: report.total.blanks }
  : null;

const args = parseArgs(process.argv.slice(2));
if (args.repos.length === 0 || !args.out) {
  console.error("usage: collect-research-sample.mjs --repos owner/name,... --out file.jsonl [--max-repos 2] [--dry-run]");
  process.exit(1);
}
const repos = args.repos.slice(0, args.maxRepos);
if (args.dryRun) {
  console.log(JSON.stringify({ api: API, repos, configs: CONFIGS.map((entry) => entry.config) }, null, 2));
  process.exit(0);
}

await mkdir(path.dirname(path.resolve(ROOT, args.out)), { recursive: true });
await writeFile(path.resolve(ROOT, args.out), "");

for (const repo of repos) {
  const repoUrl = `https://github.com/${repo}`;
  let pinnedCommit = "";
  for (const entry of CONFIGS) {
    // Variants pin the commit the default run resolved, so every group counts
    // identical source material.
    const refName = entry.config === "default" ? "" : pinnedCommit;
    if (entry.config !== "default" && !pinnedCommit) throw new Error(`default run for ${repo} did not resolve a commit; aborting before variant runs`);
    const result = await withRetry(`${repo}/${entry.config}`, () => analyzeOnce(repoUrl, refName, entry.options));
    let report = result.report ?? null;
    if (result.outcome !== "failed" && result.kind === "job" && result.jobId) {
      try {
        report = await waitForJob(result.jobId);
      } catch (error) {
        result.outcome = "failed";
        result.error = `job: ${error.message}`;
      }
    }
    if (report?.commitSha) pinnedCommit = report.commitSha;
    const row = {
      study: "filtering-effects",
      repository: repo,
      config: entry.config,
      options: entry.options,
      refName: refName || null,
      commitSha: report?.commitSha ?? null,
      collectedAt: new Date().toISOString(),
      outcome: result.outcome,
      kind: result.kind ?? null,
      wallTimeMs: result.wallTimeMs,
      tokeiVersion: report?.tokeiVersion ?? null,
      totals: totals(report),
    };
    await appendFile(path.resolve(ROOT, args.out), `${JSON.stringify(row)}\n`);
    console.log(`${repo} ${entry.config}: ${result.outcome} (${result.wallTimeMs}ms) ${row.totals ? `code=${row.totals.code}` : result.error ?? ""}`);
  }
}
console.log(`done → ${args.out}`);
