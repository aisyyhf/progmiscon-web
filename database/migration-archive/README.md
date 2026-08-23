# Historical migration archive

`legacy-20260720-through-20260814174227/` contains the byte-preserved application
migration chain that predates the new production migration epoch. Its
`inventory.json` records the expected filename, byte size, and SHA-256 for every
archived SQL file.

This directory is historical evidence and explicit local-replay input only. It
is deliberately outside `supabase/migrations/`, must never be copied or linked
back under `supabase/`, and must not be passed to production migration tooling.

`supabase/migrations/` is now reserved for the assertion-only epoch guard and
future explicitly approved production migrations. This repository change does
not claim that production has adopted the epoch and does not authorize a
deployment, migration repair, or `--include-all`.
