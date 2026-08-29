// Shared helper for the same-tab Review reauthentication flow.
//
// When a Review session expires, the blocking dialog navigates the current tab
// to the normal lecturer login page and remembers where to come back to via a
// `returnTo` query parameter. That parameter is attacker-influenceable (someone
// can craft the login URL), so the login page MUST run every candidate through
// `sanitizeReviewReturnTo` before navigating anywhere.

export const REVIEW_REAUTH_RETURN_PARAM = "returnTo";

// Only the lecturer Review workspace routes are valid return destinations.
const ALLOWED_RETURN_PREFIXES = ["/review"] as const;

function hasControlCharacter(value: string): boolean {
  for (const character of value) {
    if (character.charCodeAt(0) < 0x20 || character.charCodeAt(0) === 0x7f) {
      return true;
    }
  }
  return false;
}

/**
 * Returns a safe root-relative internal path to navigate to after login, or
 * `null` when the candidate is missing, malformed, or points anywhere other
 * than the Review workspace. Never returns an absolute or protocol-relative
 * URL, so it cannot be used for an open redirect.
 */
export function sanitizeReviewReturnTo(
  raw: string | null | undefined,
): string | null {
  if (typeof raw !== "string") return null;

  const value = raw.trim();
  if (value.length === 0 || value.length > 512) return null;

  // Must be a single-slash root-relative path.
  if (!value.startsWith("/")) return null;
  // Reject protocol-relative ("//host") and backslash ("/\host") authority tricks.
  if (value.startsWith("//") || value.startsWith("/\\")) return null;
  if (value.includes("\\")) return null;
  if (value.includes("://")) return null;
  if (hasControlCharacter(value)) return null;

  const path = value.split(/[?#]/)[0];
  if (path.split("/").some((segment) => segment === "..")) return null;

  const withinReview = ALLOWED_RETURN_PREFIXES.some(
    (prefix) => path === prefix || path.startsWith(`${prefix}/`),
  );
  if (!withinReview) return null;

  return value;
}

/**
 * Builds the same-tab login destination that carries a safe return path.
 * `currentPath` is expected to be a router location string
 * (`location.pathname + location.search`) for the Review page in view.
 */
export function buildReviewReauthPath(currentPath: string): string {
  const safe = sanitizeReviewReturnTo(currentPath);
  const base = "/dosen/login?reauth=1";
  return safe
    ? `${base}&${REVIEW_REAUTH_RETURN_PARAM}=${encodeURIComponent(safe)}`
    : base;
}
