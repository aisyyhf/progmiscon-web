# Review-v3 disposable replay

This directory is a local reconciliation harness, not a Supabase migration
directory. Historical migrations live outside normal discovery under
`database/migration-archive/` and remain available only through the explicit
replay manifest. Nothing under `database/replay/` or the archive may be passed
to `db push`, migration repair, `--include-all`, or a linked project.

> **Warning:** Repository-root/raw `supabase db push` was unsafe while the
> unverifiable historical chain remained active. The active directory now starts
> with an assertion-only epoch guard, but production adoption is still
> unauthorized until a separate deployment review proves the pending migration
> set and approves the operation. Migration repair and `--include-all` remain
> prohibited.

> **Fingerprint-v3 boundary:** This foundation reconstructs and tests only the
> current Review-v3 production contract. It does not implement
> `fingerprint_scheme`, bootstrap state, `plan_hash`,
> `preview_master_relation_baselines_v3`, `sync_master_relation_baselines_v3`,
> Edge v3 changes, or the 176-row cleanup.

Admin Edit Soal Phase 2A is implemented by the strictly post-epoch
`20260824000000_admin_question_wording_edit_phase_2a.sql` migration. It is
included in disposable local replay only; production application remains
unauthorized until a separate deployment review.

The immutable wording revisions are an edit audit trail, not Review snapshots.
Because Phase 2A does not add an exact wording fingerprint to Review saves,
historical prompts for edited questions fail closed as unavailable.

PR #48 remains a read-only historical reference and its pre-epoch migration is
not active or reused. PR #49 / trusted sync / fingerprint-v3 work remains
separate and is not implemented or authorized by this branch.

`review-v3-manifest.json` is the sole full-reconstruction order. The runner
copies archived history, local-only prerequisites, and explicitly allowlisted
active migrations into a newly-created temporary Supabase workdir, gives replay
artifacts synthetic migration timestamps, proves the resulting database URL is
loopback, and runs only commands carrying an explicit local target. It refuses
linked or remote database arguments and deletes only its own OS-created
temporary folder.

Two positive scenarios are defined:

1. `empty` stages the archived historical migrations, the local prerequisite,
   the source version getter, the existing audit patch, and the active epoch
   guard.
2. `legacy-data` inserts the deterministic pre-v3 fixture immediately after
   `20260729_005`, then follows the same remaining order.

The prerequisite is deliberately not production deployable. It bridges the
missing historical Review-v3 state only in a disposable fresh replay. The
contract checker compares the result with normalized authoritative production
fixtures in `checks/fixtures/review-v3/`.

An active-directory-only local reset is not the historical bootstrap path: the
epoch guard intentionally fails against an empty application schema. Use the
explicit replay harness for full reconstruction. The harness also rehearses the
first epoch application against a production-shaped loopback database with no
application migration ledger and proves that archived SQL is not discovered.

Contract exports use full `true`/`false` text for standalone boolean columns and
the literal `null` for table rows without a `sub_name`. Comparison preserves SQL
blank lines and whitespace; it normalizes only CRLF/LF, JSON object key order,
and semantically unordered ACL/config arrays.

Run `npm run check:review-v3-contract` for the offline comparator self-tests.
Run `npm run check:review-v3-replay` only when both the Supabase CLI and a local
Docker engine are available. If local isolation cannot be proven, the command
stops without attempting any remote fallback.

The exact `supabase` devDependency exists only to make this disposable local
database replay/test harness reproducible. It is not a deployment dependency.
Fingerprint v3, bootstrap/sync-v3 behavior, and the legacy answer-baseline
cleanup remain separate future work.
