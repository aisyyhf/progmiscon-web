# Staging Supabase — Auth configuration

Configuration for the **staging** Supabase project only. Production Auth is not
changed by anything in this directory.

Target topology:

| Environment | Supabase project |
| --- | --- |
| Vercel **Production** | existing production project (unchanged) |
| **All** Vercel Preview deployments (every branch/PR) | one shared **staging** project |
| Local development | staging project, or a developer's own local stack |

No secrets, keys, or credential-bearing values belong in this file.

---

## 1. Site URL

Set **Site URL** to one stable staging origin — it is only the fallback used
when a flow does not carry its own redirect target:

```
https://<project>-git-<default-branch>-<vercel-team>.vercel.app
```

Use the Vercel "production alias for the default branch on Preview" if the team
prefers a fixed hostname. The exact value is not security-sensitive as long as
it is one of the redirect-allow-list entries below.

## 2. Redirect allow list

The app currently uses Supabase redirects in exactly one place: the sign-up
email confirmation link
(`emailRedirectTo: ${window.location.origin}/dosen/login?confirmed=1`, with
`detectSessionInUrl: true`). Password sign-in and the same-tab Review
re-authentication flow do **not** use Supabase redirects.

Preview hostnames change per branch but share a domain suffix, so allow the
project's Vercel domains with a wildcard, plus localhost:

```
http://localhost:5173/**
https://<project>-*-<vercel-team>.vercel.app/**
https://<project>-git-*-<vercel-team>.vercel.app/**
```

Rules:

- Restrict wildcards to **this project's** Vercel preview domains and localhost.
- Never add `https://**` or any third-party host.
- Add `http://localhost:3000/**` only if a developer actually serves the app there.
- If the team adds a custom staging domain later, add that exact origin too.

## 3. localhost

`http://localhost:5173` is the Vite dev-server default (`vite` with no `server`
override in `vite.config.ts`). Include `/**` so any sub-path is accepted.

## 4. Email confirmation

Recommended: **keep "Confirm email" ON** in staging (production-like), and
**pre-confirm** the handful of test accounts from the dashboard
(Authentication → Users → the account → "Confirm email"), or create them with
email confirmation already set.

If the team decides confirmations add too much friction for throwaway accounts,
turning "Confirm email" OFF is acceptable **for staging only** — never for
production. Note the DB-side trigger still requires a confirmed, matching
`auth.users` row for *new* profile creation (see §6).

## 5. SMTP

Do **not** wire production SMTP credentials into staging. Options, in order of
preference:

1. Pre-confirm test users manually and skip outbound email entirely.
2. Use the Supabase built-in email sender (rate-limited; fine for a few test
   accounts).
3. If real delivery is needed, use a dedicated **staging** transactional-email
   account/sender — configured directly in the Supabase dashboard, never
   committed here.

## 6. Telkom email-domain trigger

`lecturer_profiles` carries a `BEFORE INSERT OR UPDATE OF user_id, email`
trigger (`enforce_verified_telkom_lecturer_profile`) and `auth.users` carries
`on_auth_user_created` → `handle_new_lecturer_user`. For a **new** profile both
require:

- the email matches `^[^@\s]+@telkomuniversity\.ac\.id$`, and
- a confirmed `auth.users` row with the same email exists.

### Option A — preferred: real Telkom test accounts

Create 2–3 dedicated `@telkomuniversity.ac.id` mailboxes the team controls, sign
them up on a Preview deployment (or create + confirm them in the dashboard),
then flip one to admin:

```sql
-- staging only
update public.lecturer_allowlist set is_admin = true
where lower(btrim(email)) = lower(btrim('<admin-test-address>@telkomuniversity.ac.id'));
```

No schema change; production-identical behavior.

### Option B — staging-only relaxation (only if non-Telkom identities are required)

If the team genuinely cannot use Telkom addresses for testing, apply a
**separate, clearly labelled** staging-only script that drops just the domain
gate — never fold this into `staging-bootstrap.sql` or any production artifact:

```sql
-- database/staging/optional-non-telkom-test-accounts.sql  (STAGING ONLY)
-- Do NOT apply to production. Do NOT add to supabase/migrations/.
drop trigger if exists lecturer_profiles_enforce_verified_telkom_email
  on public.lecturer_profiles;

create or replace function public.handle_new_lecturer_user()
returns trigger language plpgsql security definer set search_path to ''
as $$
begin
  -- staging variant: provision any confirmed auth user as a lecturer,
  -- allowlist row created on demand. Domain check removed.
  if new.email_confirmed_at is null then
    return new;
  end if;
  insert into public.lecturer_allowlist (email, full_name, active, is_admin)
  values (lower(btrim(new.email)),
          nullif(btrim(new.raw_user_meta_data ->> 'full_name'), ''), true, false)
  on conflict do nothing;
  insert into public.lecturer_profiles (user_id, email, full_name, active)
  values (new.id, lower(btrim(new.email)),
          coalesce(nullif(btrim(new.raw_user_meta_data ->> 'full_name'), ''),
                   split_part(lower(btrim(new.email)), '@', 1)),
          true)
  on conflict (user_id) do update
    set email = excluded.email, active = true, updated_at = now();
  return new;
end;
$$;
```

This deviation is **not** created by this phase. It exists here as documentation
only. Applying it makes the staging Auth contract intentionally differ from
production; record that in the staging project notes.

The offline schema validation in this phase does **not** require Option B —
`staging-bootstrap.sql` is validated with the production-identical Telkom gate
in place.

## 7. Same-tab Review re-authentication

When a Review session expires, the app navigates the current tab to
`/dosen/login?reauth=1&returnTo=<review-path>` and, after a normal password
sign-in, returns to `returnTo`. This is entirely in-app routing — no Supabase
redirect URL is involved, so no Auth configuration is needed for it.

`returnTo` is attacker-influenceable and is sanitized by
`sanitizeReviewReturnTo` (`src/utils/reviewReauthReturn.ts`): only root-relative
paths under `/review` are accepted; absolute, protocol-relative, backslash, and
`..` inputs are rejected. **Do not weaken this sanitizer** to accommodate any
staging redirect need — it is unrelated to the Supabase redirect allow list.

## 8. What staging Auth must NOT do

- No production SMTP, JWT secret, or service-role key reuse.
- No `https://**` / open redirect entries.
- No disabling RLS or loosening the SECURITY DEFINER function ACLs to "make
  testing easier".
- No copying real lecturer `auth.users`, profiles, or allowlist rows.
