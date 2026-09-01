# Canonical Master Data sync to Production — hardened operator path

`scripts/canonical-master-sync.mjs` performs a **version-aware** canonical
Master Data sync against Production, behind fail-closed gates for a strict
expected-QID allowlist.

- **Only mutation:** one call to `public.sync_master_relation_baselines_v2(jsonb, jsonb, text[])`.
  The tool never names or invokes the retired legacy v1 baseline mutation, and
  issues no other RPC / insert / update / delete. A static test
  (`checks/canonical-master-sync.mjs`) enforces this.
- **Default mode is a read-only plan.** `--apply` is required to mutate and adds
  seven more preconditions (below).
- **Inputs are frozen local files only.** The tool does not fetch the Google
  Sheet. You freeze the five CSVs (`current` = the live sheet before the edit,
  `proposed` = the same five with the approved cell edits applied) and export
  the Production baseline **oracle** before running it.
- **Not deployed. Not an Edge Function.** This is an operator CLI. It does not
  touch Production unless you pass `--apply` and every gate is green.

## Inputs

| Input | What it is | How to produce it |
| --- | --- | --- |
| `--current <dir>` | 5 CSVs (`misconceptions`, `questions`, `answers`, `question_misconceptions`, `answer_misconceptions`) — the live sheet **before** the edit | `curl` each published CSV to a directory, immediately, once |
| `--proposed <dir>` | the same 5 CSVs with the approved edits applied to a **copy** | edit the copy; never edit the sheet first |
| `--oracle <file>` | JSON array of the Production baseline state (§ Oracle export) | project-owner SQL read |
| `--allow Q225,Q226,Q259` | the exact question IDs expected to bump | the approved plan |
| `--max-question-bumps 3` | hard ceiling on question bumps | pilot = 3 |
| `--answer-allow` / `--max-answer-bumps 0` | answer allowlist / ceiling (question-only pilot: empty / 0) | pilot = empty / 0 |
| `--expect-ref <ref>` | the Production project ref you intend to hit | from the project URL |

## Plan (default — read-only, offline)

```bash
node scripts/canonical-master-sync.mjs \
  --current  ./frozen/current \
  --proposed ./frozen/proposed \
  --oracle   ./frozen/production-baseline-state.json \
  --allow    Q225,Q226,Q259 \
  --max-question-bumps 3 \
  --answer-allow "" --max-answer-bumps 0 \
  --expect-ref <production-project-ref>
```

Exit 0 iff `planIsApplyable`. It prints the `--apply-bundle-hash` to copy.

`planIsApplyable` is true only when **all** hold:

1. **parity_clean** — every target's `source_fingerprint` and `misconception_ids`
   in the frozen `current` snapshot equal Production's stored values (proves
   `build-baseline-snapshot.mjs` reproduces what Production stores — blocker E1).
2. **zero_null_baseline_rows** — no Production baseline row has a NULL
   `source_version` or `source_fingerprint`. NULL rows are **reported and stop
   the plan**; the tool never reconciles or bumps them (blocker E2).
3. **question_allowlist_exact** — every predicted question bump is in `--allow`,
   and every `--allow` entry actually bumps.
4. **answer_allowlist_exact** — same for answers (empty allowlist ⇒ zero answer
   bumps).
5. **question_bump_count_within_max** / **answer_bump_count_within_max**.
6. **snapshot_complete** — the `proposed` snapshot omits no question/answer that
   Production's baseline (or the `current` snapshot) still has active; and adds
   none (a question-only pilot changes text, not the target set).

## Apply (explicit; mutates Production)

```bash
CANONICAL_MASTER_SYNC_ENABLED=true \
PRODUCTION_SUPABASE_URL=https://<ref>.supabase.co \
PRODUCTION_SUPABASE_SERVICE_ROLE_KEY=<server-side only, never a VITE_ name> \
node scripts/canonical-master-sync.mjs \
  ...the same plan args... \
  --apply --apply-bundle-hash <sha256-from-the-plan-run> \
  --post-oracle ./frozen/production-baseline-state.after.json
```

`--apply` refuses **before any mutation** unless all of:

- `planIsApplyable` is true (re-computed from the frozen inputs);
- `--apply-bundle-hash` equals the SHA-256 the plan printed for the **complete**
  frozen bundle (all 10 CSVs + the oracle) — you cannot preview file A and apply
  file B;
- `PRODUCTION_SUPABASE_URL`'s project ref equals `--expect-ref`;
- `PRODUCTION_SUPABASE_SERVICE_ROLE_KEY` is set;
- `CANONICAL_MASTER_SYNC_ENABLED` is exactly `true`.

After the single RPC call the tool runs **post-apply validation** and exits
non-zero (alert) unless:

- `question_versions_changed` == the number of allowlisted questions;
- `answer_versions_changed` == the number of allowlisted answers (0 for the
  pilot);
- with `--post-oracle`: the exact set of targets whose `source_version` moved
  equals the allowlist — no more, no fewer.

`--post-oracle` is a **fresh** owner re-export of the same query, taken
immediately after the apply.

## Oracle export (project-owner, read-only)

`source_fingerprint` is exposed by no RPC — it is readable only by the project
owner. Run in the Supabase SQL editor (or `psql` with the DB password) and save
the output to the `--oracle` file. This grants nothing and changes no
permission:

```sql
-- read-only; run as the project owner
select json_agg(row order by row.target_type, row.target_id) from (
  select 'question' as target_type,
         question_id as target_id,
         source_version::text as source_version,
         source_fingerprint,
         misconception_ids,
         null::int as active_review_count,   -- optional; fill from get_question_review_counts()
         false     as override_exists        -- optional
  from public.question_misconception_baselines
  union all
  select 'answer', answer_id, source_version::text, source_fingerprint, misconception_ids,
         null::int, false
  from public.answer_misconception_baselines
) row;
```

Optionally join `get_question_review_counts()` / override presence for
`active_review_count` / `override_exists` so the plan can report exact
invalidation numbers; the safety gates do not depend on them.

## Environment variables (no secrets in the repo)

| Variable | Purpose | Notes |
| --- | --- | --- |
| `PRODUCTION_SUPABASE_URL` | Production project API URL | apply only |
| `PRODUCTION_SUPABASE_SERVICE_ROLE_KEY` | invoke the `_v2` RPC | apply only; **server-side only**, never `src/`, never a `VITE_*` name |
| `CANONICAL_MASTER_SYNC_ENABLED` | fail-closed switch | must be exactly `true` |

The tool uses `service_role` **only** to call the SD RPC. It never issues a
`SELECT` against a protected baseline / override table.

## Tests

```bash
npm run check:canonical-sync-plan     # pure planning engine
npm run check:canonical-master-sync   # CLI + gates + legacy-v1 assertion + fixture drift
```

All tests are offline; the mutation RPC is injected, never real.

---

## Separate Production security-hardening blocker — legacy v1 ACL

The rollout audit found that `public.sync_master_relation_baselines` (**legacy
v1**) is still `EXECUTE`-granted to `authenticated` in Production
(`checks/fixtures/review-v3/documented-exceptions.json`). v1 deletes and rebuilds
every baseline row **without** assigning a `source_version`, so a single call
desynchronises **every** active review from its baseline. Any authenticated
lecturer could invoke it.

**PR-1 does not change this** (no migration, no ACL change) and this tool cannot
reach v1. But the exposure remains. It should be closed by a **separate, audited
PR**:

- **Scope:** one migration that `revoke execute on function
  public.sync_master_relation_baselines(jsonb, jsonb, text[]) from authenticated;`
  on Production, leaving it `postgres`-only (matching a fresh reconciled
  database).
- **Contract:** update `checks/fixtures/review-v3/production-review-runtime-functions.csv`
  and **remove** the corresponding entry from `documented-exceptions.json`
  (the exception exists only to tolerate the *current* Production drift).
- **Guard:** run `check:review-v3-contract` / `check:staging-bootstrap` /
  `check:migration-epoch-layout`; confirm no `MIGRATION_EPOCH_GUARD_FAILED`.
- **Preconditions:** confirm no deployed code path, CI job, or operator runbook
  calls v1 (the frontend caller was already removed in `2673f20`; the
  hardened path here uses `_v2` only).
- **Rollback:** re-grant is a one-line migration; no data is touched.
- **Do not bundle** this with a content edit or with PR-1.
