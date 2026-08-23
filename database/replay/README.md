# Review-v3 disposable replay

This directory is a local reconciliation harness, not a Supabase migration
directory. Normal production tooling discovers only `supabase/migrations/`;
nothing under `database/replay/` may be passed to `db push`, migration repair,
`--include-all`, or a linked project.

> **Warning:** Repository-root/raw `supabase db push` remains unsafe and
> unauthorized until the migration-epoch cutover has been separately reviewed
> and approved. The active historical migration chain is not being declared
> production-safe by this reconciliation work.

> **Fingerprint-v3 boundary:** This foundation reconstructs and tests only the
> current Review-v3 production contract. It does not implement
> `fingerprint_scheme`, bootstrap state, `plan_hash`,
> `preview_master_relation_baselines_v3`, `sync_master_relation_baselines_v3`,
> Edge v3 changes, or the 176-row cleanup.

`review-v3-manifest.json` is the sole replay order. The runner copies its entries
into a newly-created temporary Supabase workdir, gives local-only artifacts
synthetic migration timestamps, proves the resulting database URL is loopback,
and runs only commands carrying an explicit local target. It refuses linked or
remote database arguments and deletes only its own OS-created temporary folder.

Two positive scenarios are defined:

1. `empty` stages the historical migrations, the local prerequisite, the source
   version getter, and the existing audit patch.
2. `legacy-data` inserts the deterministic pre-v3 fixture immediately after
   `20260729_005`, then follows the same remaining order.

The prerequisite is deliberately not production deployable. It bridges the
missing historical Review-v3 state only in a disposable fresh replay. The
contract checker compares the result with normalized authoritative production
fixtures in `checks/fixtures/review-v3/`.

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
