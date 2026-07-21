import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import {
  isTelkomLecturerEmail,
  normalizeLecturerEmail,
} from "../src/utils/lecturerEmail.ts";

const migrationUrl = new URL(
  "../supabase/migrations/20260722_001_telkom_lecturer_domain_access.sql",
  import.meta.url,
);
const adminMigrationUrl = new URL(
  "../supabase/migrations/20260721_001_admin_access.sql",
  import.meta.url,
);

assert.equal(isTelkomLecturerEmail("dosen@telkomuniversity.ac.id"), true);
assert.equal(isTelkomLecturerEmail("DOSEN@TELKOMUNIVERSITY.AC.ID"), true);
assert.equal(
  isTelkomLecturerEmail("  dosen@telkomuniversity.ac.id  "),
  true,
);
assert.equal(
  normalizeLecturerEmail("  DOSEN@TELKOMUNIVERSITY.AC.ID  "),
  "dosen@telkomuniversity.ac.id",
);
assert.equal(isTelkomLecturerEmail("dosen@gmail.com"), false);
assert.equal(
  isTelkomLecturerEmail("dosen@telkomuniversity.ac.id.example.com"),
  false,
);

const migration = await readFile(migrationUrl, "utf8");
const adminMigration = await readFile(adminMigrationUrl, "utf8");

assert.match(migration, /new\.email_confirmed_at is null/i);
assert.match(migration, /is_admin\s*\)\s*values\s*\([\s\S]*?false/i);
assert.match(migration, /on conflict do nothing/i);
assert.match(migration, /current_profile_email = normalized_email/i);
assert.doesNotMatch(migration, /create or replace function public\.current_user_is_admin/i);

assert.match(adminMigration, /allowed\.is_admin = true/i);
assert.match(adminMigration, /profile\.active = true/i);
assert.match(adminMigration, /allowed\.active = true/i);

console.log("Lecturer domain access self-check passed (8 policy scenarios).");
