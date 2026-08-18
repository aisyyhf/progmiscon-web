import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const auth = await readFile(
  new URL("../src/hooks/useLecturerAuth.tsx", import.meta.url),
  "utf8",
);
const review = await readFile(
  new URL("../src/pages/LecturerReviewWeekFirstPage.tsx", import.meta.url),
  "utf8",
);

const listenerStart = auth.indexOf("supabase.auth.onAuthStateChange");
const listenerEnd = auth.indexOf("return () => subscription.unsubscribe()", listenerStart);
const listener = auth.slice(listenerStart, listenerEnd);
const authStateEffectStart = auth.indexOf("if (!pendingAuthState) return;");
const authStateEffectEnd = auth.indexOf("const login = useCallback", authStateEffectStart);
const authStateEffect = auth.slice(authStateEffectStart, authStateEffectEnd);

assert.ok(listenerStart >= 0 && listenerEnd > listenerStart);
assert.ok(authStateEffectStart >= 0 && authStateEffectEnd > authStateEffectStart);

assert.doesNotMatch(
  auth,
  /supabase\.auth\.getSession\(/,
  "INITIAL_SESSION must be the single auth bootstrap source",
);
assert.match(listener, /setPendingAuthState\(\{ event, session \}\)/);
assert.doesNotMatch(
  listener,
  /async|await|syncSession|getLecturerProfile|getCurrentUserAdminAccess/,
  "the Supabase auth callback must stay synchronous and lock-safe",
);
assert.match(auth, /return \(\) => subscription\.unsubscribe\(\)/);

assert.match(authStateEffect, /accessResolved\.current && resolvedUserId\.current === nextUserId/);
assert.match(authStateEffect, /syncingUserId\.current === nextUserId/);
assert.match(authStateEffect, /if \(alreadyResolved \|\| alreadySyncing\)/);
assert.match(authStateEffect, /pendingAuthState\.event === "USER_UPDATED"/);
assert.match(authStateEffect, /void syncSession\(pendingAuthState\.session\)/);

assert.match(auth, /requestId === syncRequestId\.current[\s\S]*?setLoading\(false\)/);
assert.match(
  auth,
  /finally \{[\s\S]*?requestId === syncRequestId\.current[\s\S]*?accessResolved\.current = true;[\s\S]*?setLoading\(false\)/,
  "the latest profile/access request must always settle global loading",
);
assert.doesNotMatch(auth, /visibilitychange|document\.hidden|window\.location\.reload|localStorage\.clear|sessionStorage\.clear|setTimeout/);

assert.equal(
  review.match(/\.finally\(\(\) => \{\s*if \(active\) set(?:Snapshot|Metadata)Loading\(false\);\s*\}\)/g)?.length,
  2,
  "Review snapshot and metadata loaders must settle on rejection as well as success",
);

console.log("Auth loading lifecycle self-check passed (focus-safe session handling).");
