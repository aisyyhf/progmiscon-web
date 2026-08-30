# `database/staging/`

Bootstrap package for a **separate Supabase staging project** that backs all
Vercel **Preview** deployments. Production is untouched by everything here.

| File | What it is |
| --- | --- |
| `staging-bootstrap.sql` | One-shot schema bootstrap for a brand-new, empty Supabase project. Creates the `public` application schema (tables, constraints, indexes, functions, triggers, RLS policies, grants) plus the `auth.users` provisioning trigger. |
| `AUTH.md` | Recommended staging Auth (GoTrue) configuration: Site URL, Preview redirect allow-list, email confirmation, SMTP, Telkom test-account options. |
| `seed-baselines.mjs` | Operator/CI helper that seeds `*_misconception_baselines` + `master_misconception_catalog` by calling `sync_master_relation_baselines_v2` on staging. Never run against production; dry-run by default. |

Not a production migration. `staging-bootstrap.sql` must never be moved under
`supabase/migrations/` or passed to `supabase db push` against a linked
production project — `database/staging/` keeps it out of migration discovery.

## Provenance

`staging-bootstrap.sql` is reconstructed from a pre-epoch production
schema-only dump. Object DDL (including every function body) is verbatim so the
result matches the current Review-v3 contract in
`checks/fixtures/review-v3/`. Grants are rewritten as explicit `REVOKE` + `GRANT`
so the ACLs are deterministic regardless of a project's
`ALTER DEFAULT PRIVILEGES` setup.

Deliberately **omitted** during sanitization: `roles.sql`, production
`auth.users` / data, JWT secrets, service-role keys, SMTP creds, Vault secrets,
project identifiers, the migration ledger, `ALTER PUBLICATION supabase_realtime`,
`COMMENT ON SCHEMA`, and the `pg_stat_statements` / `supabase_vault` /
`uuid-ossp` extensions (platform-managed; `pgcrypto` is the only extension the
schema actually needs, for `gen_random_uuid()`).

The `auth.users` trigger `on_auth_user_created` is not in the production
public-schema dump (the `auth` schema is outside dump ownership); it is
reconstructed verbatim from
`database/migration-archive/legacy-20260720-through-20260814174227/20260722_001_telkom_lecturer_domain_access.sql`.

## Applying to a new staging project (later — not in this phase)

Run as the project's `postgres` role (Supabase SQL editor, or `psql` with the
project connection string):

1. `staging-bootstrap.sql`
2. `../../supabase/migrations/20260823000000_review_v3_epoch_guard.sql`
   — the existing assertion-only contract guard. It must complete with **no**
   `MIGRATION_EPOCH_GUARD_FAILED`. If it raises, fix the bootstrap, not the guard.
3. Configure Auth per `AUTH.md`.
4. Create 2–3 test lecturer accounts + 1 admin (see `AUTH.md` §6).
5. Seed baselines:
   ```bash
   STAGING_SUPABASE_URL=... STAGING_SUPABASE_SERVICE_ROLE_KEY=... \
   node database/staging/seed-baselines.mjs --confirm <project-ref> --source sheets --apply
   ```

## Offline validation (this phase)

```bash
npm run check:staging-bootstrap      # structural + sanitization, no database
npm run check:review-v3-contract     # offline contract-comparator self-test
npm run check:migration-epoch-layout # epoch layout unchanged
```

Full runtime proof (apply to a disposable local database, run the epoch guard,
extract and diff normalized contracts) requires Docker + the Supabase CLI:

```bash
npm run check:review-v3-replay
```

`check:staging-bootstrap` additionally asserts that the seven Review-v3 write
RPC bodies are byte-identical to
`database/replay/review-v3-legacy-prerequisite.sql`, which
`check:review-v3-replay` validates against the production contract fixtures.
