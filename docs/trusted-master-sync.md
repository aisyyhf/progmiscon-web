# Trusted master sync foundation

`sync-review-master-data` is the repository-owned server boundary that may
eventually submit authoritative Google Sheets relation snapshots to the
service-role-only `sync_master_relation_baselines_v2` RPC. The Vite application
can supply only an authenticated caller token and `preview`/`sync` mode. Source
URLs, allowed browser origins, privileged credentials, and the RPC name remain
server-controlled.

This PR does not deploy the function, set remote secrets, enable sync, call the
production RPC, or write production data. Relationship-fingerprint parity with
production is still unproven, so sync remains blocked.

## Authorization and browser boundary

The function performs these steps in order:

1. An allowed browser origin is checked without reflecting arbitrary origins.
2. A user-scoped client validates the bearer token, the caller's active
   `lecturer_profiles` row, and `current_user_is_admin()`.
3. The request, five trusted CSVs, and complete snapshot are validated.
4. Preview returns before privileged configuration is accessed.
5. Sync checks its fail-closed feature flag, then creates one service-role
   client and makes one complete `sync_master_relation_baselines_v2` call.

Browser callers require `ADMIN_APP_ORIGINS`, a comma-separated list of exact
HTTP(S) origins such as `https://admin.example.edu`. Values must be origins
only: no paths, query strings, fragments, credentials, or `*`. An allowed
origin receives:

```text
Access-Control-Allow-Origin: <exact configured origin>
Vary: Origin
Access-Control-Allow-Methods: POST, OPTIONS
Access-Control-Allow-Headers: authorization, apikey, content-type
```

`OPTIONS` returns 204 for an allowed origin. Missing/disallowed preflight
origins fail closed. POST still requires bearer authentication. Non-browser
operators may call POST without an `Origin` header.

Supabase gateway JWT verification is explicit in `supabase/config.toml`:

```toml
[functions.sync-review-master-data]
verify_jwt = true
```

Never deploy this function with `--no-verify-jwt`.

## Server configuration

Do not commit values. No variable below belongs in `src/` or a `VITE_*` name.

| Variable | Purpose |
| --- | --- |
| `SUPABASE_URL` | Project API URL |
| `SUPABASE_PUBLISHABLE_KEY` or `SUPABASE_ANON_KEY` | User-scoped authorization client |
| `SUPABASE_SERVICE_ROLE_KEY` | Read only after enabled sync; never used by preview |
| `ADMIN_APP_ORIGINS` | Exact comma-separated browser origin allowlist |
| `MASTER_QUESTIONS_CSV_URL` | Frozen-authority questions export |
| `MASTER_ANSWERS_CSV_URL` | Frozen-authority answers export |
| `MASTER_QUESTION_MISCONCEPTIONS_CSV_URL` | Question relationship export |
| `MASTER_ANSWER_MISCONCEPTIONS_CSV_URL` | Answer relationship export |
| `MASTER_MISCONCEPTIONS_CSV_URL` | Active misconception catalog export |
| `TRUSTED_MASTER_SYNC_ENABLED` | Must equal trimmed, case-insensitive `true` to permit sync |

Unset, empty, false, `0`, and misspelled sync flags fail closed.

## Bounded request and source handling

POST accepts an empty body or `application/json`/`application/*+json` containing
exactly:

```json
{ "mode": "preview" }
```

or:

```json
{ "mode": "sync" }
```

Unknown fields and modes are rejected. Nonempty bodies with other MIME types
return 415. The body is read through a byte-counted stream and canceled above
1 KiB; it is never passed through unrestricted `request.text()`.

Each CSV is limited to 5 MiB by a byte-counted stream even when no
`Content-Length` is present. Parsing is also limited to 20,000 rows and 128 KiB
characters per field. At most 100 validation issues are retained and at most 20
are returned. Five sources fetch concurrently under one 15-second timeout per
source.

Automatic redirects are disabled. Every hop is validated before fetching:

- HTTPS only, default HTTPS port, and no URL credentials;
- exact `docs.google.com`, exact `googleusercontent.com`, or a true
  `*.googleusercontent.com` subdomain;
- at most three redirect hops.

Suffix tricks such as `googleusercontent.com.attacker.example` are rejected.
The final response must use an accepted CSV/text MIME type. The reviewed public
Google chain (`docs.google.com` to `*.googleusercontent.com`) returns
`text/csv; charset=utf-8` and is accepted.

## Canonical validation decisions

The trusted parser deliberately fails closed where the browser historically
treated malformed data as inactive:

| Difference | Decision |
| --- | --- |
| Unknown question/answer/relation `active` values | Intentional trusted strictness; reject |
| CR/CRLF handling | Intentional deterministic LF normalization; production fingerprint parity remains to be measured |
| Duplicate relationship pairs | Intentional trusted strictness; reject rather than deduplicate |
| `evidence_level` | Parity bug fixed: blank, E, or R only; fingerprint still uppercases E/R |
| Answer active handling | Intentional trusted strictness; unknown values reject |
| Misconception-ID ordering | Not part of the relation hash input; deterministic trusted ordering retained and IDs compared separately by the parity checker |

These decisions do not prove the relationship fingerprint compatible with
production. The production oracle remains authoritative.

## Review-visible content context

`hasReviewStructuredContent` is false for plain PS/MP wording alone. It is true
when any Review-visible non-plain-prompt context exists in either language:

- an explicit nonempty text or code content block;
- pseudocode from `question_code`;
- an input or output description;
- a canonical sample case, whether sourced from `test_cases_json` or the
  `sample_inputs`/`sample_outputs` fallback.

Malformed content, test-case, or sample JSON rejects the snapshot. Canonical
test cases take precedence over fallback sample arrays, matching the frontend
display model.

The future content fingerprint uses scheme `review-question-content-v2` and
deterministically serializes:

- canonical PS/MP type;
- Indonesian and English wording;
- Indonesian and English explicit content blocks;
- pseudocode;
- Indonesian and English input/output descriptions;
- the ordered canonical sample-case input/output list.

It excludes timestamps, reviewer data, relationship data, and unstable
metadata. Relationship changes therefore do not change this content hash. This
future content hash remains completely separate from relation
`source_fingerprint`.

## Relationship fingerprint status

The trusted relation algorithm has not been changed speculatively. The original
deployed v2 builder is not in this repository, so byte-for-byte parity remains
**UNKNOWN**. `TRUSTED_MASTER_SYNC_ENABLED` must remain disabled until the local
checker reports a 100% exact match against a production baseline export made
from the same frozen master snapshot.

## Read-only production export

Run this manually in an authorized production SQL console. It reads only target
IDs, baseline fingerprints, and master misconception IDs—never lecturer
profiles or Review decisions:

```sql
begin;
set transaction read only;

select
  'question'::text as target_type,
  question_id as target_id,
  source_fingerprint,
  misconception_ids
from public.question_misconception_baselines

union all

select
  'answer'::text as target_type,
  answer_id as target_id,
  source_fingerprint,
  misconception_ids
from public.answer_misconception_baselines;

rollback;
```

Export the result locally as JSON or CSV. JSON must be an array whose
`misconception_ids` values are string arrays. CSV may use JSON arrays or simple
PostgreSQL arrays such as `{M-1,M-2}`. No DB password, service-role secret, or
management token is used by the local checker.

## Frozen master parity workflow

Capture the five public exports into one local directory without editing them:

```text
questions.csv
answers.csv
question_misconceptions.csv
answer_misconceptions.csv
misconceptions.csv
```

The files must represent the same master snapshot as the production baseline
export. Comparing production fingerprints with changing live URLs is diagnostic
only and is not parity proof. The checker intentionally has no live or database
connection mode.

Run:

```powershell
npm run check:trusted-master-parity -- --oracle C:\secure\production-baselines.json --master-dir C:\secure\frozen-master
```

It prints only totals and target IDs for fingerprint, relation-ID,
stored-only, and trusted-only mismatches. It never prints raw question content,
fingerprint values, lecturer data, or Review decisions. Exit status is nonzero
unless all four mismatch categories are empty. Sync requires a 100% exact
match.

## Preview and sync status

Preview returns aggregate counts plus relation/content snapshot hashes. It does
not read the service-role key, instantiate a privileged client, or mutate any
system. This PR still does not perform a preview deployment.

Sync remains implemented but unavailable by default. Even after a successful
preview rollout, it must not be enabled until frozen-snapshot production parity
is separately demonstrated and reviewed.

PR #48 remains independent, blocked, and untouched.
