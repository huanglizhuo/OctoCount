# Research plan: how test, docs, and generated-file filtering affects SLOC counts

- Status: pilot phase (SG-06). Approved by the site owner on 2026-09-08 for
  the 2-repository pilot only; the full 10–20 repository run needs a second
  approval based on the pilot's measured cost.
- Question: for the same repository at the same commit, how much do OctoCounts'
  analysis options — excluding tests, docs, or generated files — change the
  reported line counts, and what does that imply for comparing reports?

## Method

1. For each sampled repository, run the default configuration first and record
   the resolved commit SHA; every other configuration pins `refName` to that
   exact SHA, so all variants count identical source material.
2. Experiment groups (all at the same commit):
   - `default` — includeDocs/includeTests/includeGenerated all true (site default)
   - `exclude-tests` — includeTests=false
   - `exclude-docs` — includeDocs=false
   - `exclude-generated` — includeGenerated=false
3. Record for every run: repository, commit, configuration, request/response
   kind (cached vs job), wall time, and the returned totals (files, lines,
   code, comments, blanks). Failures are recorded, never dropped.
4. Bounded execution: sequential requests (concurrency 1), no force-refresh,
   one retry per failed request, hard cap of 2 repositories for the pilot.

## Sample criteria (pilot)

- Public GitHub repositories already present in the seeded/popular corpus
  (their default report is likely cached, reducing cost to the 3 variant runs
  per repository).
- Medium-sized (order 10^4–10^6 total lines) so variant runs stay cheap.
- Pilot: facebook/react, vitejs/vite.

## Known limitations (must appear in any published result)

- Sample is not random and n=2 for the pilot; no claim about "open source in
  general" is possible from it.
- Filtering is heuristic (path/extension based); "generated" and "docs"
  classification cannot be perfect, and the measured deltas are bounded by
  that heuristic, not ground truth.
- A single tokei/engine version and a single date; results are about these
  repositories at these commits.

## Full-study gate

Proceed to 10–20 repositories only after the pilot report
(`pilot-report.md`) confirms: per-variant wall time, cache-hit rate, and
failure behavior are acceptable to the site owner.
