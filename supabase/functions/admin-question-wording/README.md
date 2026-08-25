# Admin question wording Edge Function

`admin-question-wording` is invoked by the frontend with a signed-in user JWT.
JWT verification is explicitly enabled in `supabase/config.toml`; do not serve
or deploy this function with `--no-verify-jwt`.

Required server-only environment names:

- `PROGMISCON_ALLOWED_ORIGIN`
- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`
- `PROGMISCON_GOOGLE_SPREADSHEET_ID`
- `PROGMISCON_GOOGLE_QUESTIONS_SHEET_ID`
- `GOOGLE_SERVICE_ACCOUNT_JSON`

The reviewed spreadsheet title, tab, A:AK range, numeric Questions sheet ID,
and source-identity SHA are pinned by the generated authority manifest. No
additional source-identity environment variable is used.

For local rehearsal, put values in an ignored local env file and run:

```sh
npx --no-install supabase functions serve admin-question-wording --env-file supabase/functions/.env.local
```

For an approved remote environment, set `PROGMISCON_ALLOWED_ORIGIN`, both
`PROGMISCON_GOOGLE_*` names, and `GOOGLE_SERVICE_ACCOUNT_JSON` through
`supabase secrets set`; Supabase provides its own URL and server key variables.
Never put service-account JSON, private keys, service-role keys, or server
configuration into `VITE_*` variables, repository files, fixtures, or logs.
