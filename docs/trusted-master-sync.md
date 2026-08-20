# Trusted master sync foundation

`sync-review-master-data` is the only repository-owned path that may eventually
submit authoritative Google Sheets relation snapshots to the service-role-only
`sync_master_relation_baselines_v2` RPC. It is intentionally isolated from the
Vite application: browser code supplies only the caller's access token and a
safe operational mode, never source URLs or privileged credentials.

This PR adds source and checks only. It does not deploy the Edge Function, set
remote secrets, apply a migration, call the production RPC, or write production
data.

## Trust boundary

The function creates two Supabase clients in a strict order:

1. A user-scoped client uses `SUPABASE_URL`, a server-side publishable/anon key,
   and the caller's bearer token. It validates the token, verifies that the
   caller's `lecturer_profiles` row is active, and requires
   `current_user_is_admin()` to return `true`.
2. A service-role client is created only after authorization, trusted source
   loading, full validation, payload construction, preview bypass, and the sync
   feature gate. That client can call only
   `sync_master_relation_baselines_v2`, once, with the complete snapshot.

`SUPABASE_SERVICE_ROLE_KEY` belongs only in the Edge runtime. It must never be
placed in `src/`, a `VITE_*` variable, browser configuration, logs, or responses.

## Required Edge environment

Configure these server-runtime variables at deployment time; do not commit
values:

| Variable | Purpose |
| --- | --- |
| `SUPABASE_URL` | Project API URL |
| `SUPABASE_PUBLISHABLE_KEY` or `SUPABASE_ANON_KEY` | User-scoped authorization client |
| `SUPABASE_SERVICE_ROLE_KEY` | Service-only RPC client; read only on enabled sync |
| `MASTER_QUESTIONS_CSV_URL` | Authoritative questions CSV |
| `MASTER_ANSWERS_CSV_URL` | Authoritative answers CSV |
| `MASTER_QUESTION_MISCONCEPTIONS_CSV_URL` | Authoritative question relationships CSV |
| `MASTER_ANSWER_MISCONCEPTIONS_CSV_URL` | Authoritative answer relationships CSV |
| `MASTER_MISCONCEPTIONS_CSV_URL` | Authoritative active misconception IDs CSV |
| `TRUSTED_MASTER_SYNC_ENABLED` | Must equal `true` to permit sync; unset/false is fail-closed |

All source URLs must be HTTPS and are read from server configuration. The
request contract cannot override them.

## Request modes

Use `POST /sync-review-master-data` with an empty body or exactly one of:

```json
{ "mode": "preview" }
```

```json
{ "mode": "sync" }
```

Unknown fields, URLs, service keys, table names, and RPC names are rejected.
Both modes perform the same Admin authorization, five-source fetch, CSV parsing,
cross-source validation, and canonical snapshot build.

Preview returns only aggregate counts and SHA-256 snapshot fingerprints. It
does not read the service-role key, create a privileged client, or call a
mutation RPC.

Sync is implemented but disabled by default. Even with a valid Admin caller it
returns `SYNC_DISABLED` unless `TRUSTED_MASTER_SYNC_ENABLED=true`. Before an
operator enables that flag, a controlled read-only rollout must compare preview
output with the deployed v2 relationship-fingerprint representation. This gate
exists because the deployed v2 migration and its original builder are not in
source control; an unverified first write could otherwise rotate live Review
source versions.

## Canonical payload rules

Every active question appears once with exactly `question_id`,
`source_fingerprint`, and sorted unique `misconception_ids`. The relationship
fingerprint is SHA-256 over deterministic, sorted canonical relationship
context. Question context includes relationship source/evidence/rationale
fields; answer context includes relationship reasons. It deliberately excludes
question wording and content blocks.

Answer baselines are derived only from parsed, active
`answer_role === "mp_option"` rows whose canonical parent type is MP.
`ps_reference` and `evidence` rows are excluded. Type comes directly from the
master `question_type` field using the same accepted PS/MP aliases as the
frontend parser; answer existence is never a type heuristic.

The future content-context representation keeps canonical PS/MP type, normalized
Indonesian and English wording, parsed `text`/`code` content blocks,
`hasStructuredContent`, and a separate content fingerprint. Structured content
is true only when either parsed content-block array contains an effective block.
The content fingerprint is SHA-256 over deterministic serialization of:

- scheme version;
- canonical question type;
- normalized `question_ind` and `question_en`;
- canonical `content_blocks_ind` and `content_blocks_en`.

Relationship changes do not affect the content fingerprint, and content changes
do not replace relation `source_fingerprint` semantics.

## Failure and atomicity expectations

Missing/invalid tokens return 401. Inactive or ordinary lecturers return 403.
Authorization backend failure returns 503 without account details. Network,
HTTP, timeout, size, CSV header/parser, duplicate-ID, invalid role/type/content,
and broken-relationship failures abort before any database mutation. Validation
responses contain bounded safe diagnostics, not raw CSV rows or credentials.

The Edge Function is not a transaction boundary. Enabled sync makes one call
with the complete validated question, answer, and misconception snapshot; the
deployed PostgreSQL RPC supplies atomicity. There are no per-row writes or
partial client-side retries.

## Relationship to Draft PR #48

This foundation supplies the trusted server authority that PR #48 needs before
historical wording or canonical question type can be sourced safely. PR #48
remains blocked and untouched. A later reviewed change can add a separate
service-role-only content-context RPC and call it from this same boundary after
relation fingerprint parity and controlled deployment validation are complete.
