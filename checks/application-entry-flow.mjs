import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const readSource = (path) =>
  readFile(new URL(`../${path}`, import.meta.url), "utf8");

const [app, topNav, navLinks, login, signup, dashboard] = await Promise.all([
  readSource("src/app/App.tsx"),
  readSource("src/components/layout/TopNav.tsx"),
  readSource("src/components/navigation/useNavLinks.ts"),
  readSource("src/pages/LecturerLoginPage.tsx"),
  readSource("src/pages/LecturerSignupPage.tsx"),
  readSource("src/pages/LecturerDashboardPage.tsx"),
]);

assert.match(app, /<Route path="\/" element={<HomePage \/>} \/>/);
assert.match(
  app,
  /<Route path="\/home" element={<Navigate to="\/" replace \/>} \/>/,
);

const landingStart = topNav.indexOf('if (location.pathname === "/")');
const publicShellStart = topNav.indexOf("\n  return (", landingStart);
assert.notEqual(landingStart, -1, "landing header branch is missing");
assert.notEqual(publicShellStart, -1, "public and lecturer header branch is missing");

const landingHeader = topNav.slice(landingStart, publicShellStart);
const publicAndLecturerHeader = topNav.slice(publicShellStart);
assert.match(landingHeader, /Masuk sebagai Dosen/);
assert.match(landingHeader, /Jelajahi sebagai Pengunjung/);
assert.match(landingHeader, /to="\/dosen\/login"/);
assert.match(landingHeader, /to="\/materi"/);
assert.doesNotMatch(
  landingHeader,
  /<NavTabs|to="\/(?:home|konsep|miskonsepsi|review|dashboard)"/,
  "landing header must not expose public or lecturer navigation",
);
assert.doesNotMatch(topNav, />[^<{]*Guest[^<{]*</, "visible UI must not say Guest");
assert.match(topNav, /const brandLink[\s\S]*?to="\/"/);

const publicLinksStart = navLinks.indexOf("const publicLinks");
const lecturerLinksStart = navLinks.indexOf("const lecturerLinks");
const publicLinks = navLinks.slice(publicLinksStart, lecturerLinksStart);
assert.deepEqual(
  [...publicLinks.matchAll(/to: "([^"]+)"/g)].map((match) => match[1]),
  ["/materi", "/konsep", "/miskonsepsi"],
  "anonymous navigation must expose only Soal, Konsep, and Miskonsepsi",
);
assert.doesNotMatch(
  publicLinks,
  /home|dashboard|review|riwayat|dosen/i,
  "anonymous navigation must not expose landing or lecturer links",
);
assert.doesNotMatch(
  publicAndLecturerHeader,
  /to="\/dosen\/login"|Masuk sebagai Dosen|Akun Dosen|Lecturer Account/,
  "anonymous public header must not contain the lecturer login CTA",
);

assert.match(navLinks, /to: "\/dashboard"/);
assert.match(navLinks, /to: "\/review"/);
assert.match(navLinks, /to: "\/review\/riwayat"/);

for (const authPage of [login, signup]) {
  assert.match(authPage, /navigate\("\/dashboard", { replace: true }\)/);
  assert.doesNotMatch(authPage, /navigate\("\/review"/);
}

assert.match(
  app,
  /path="\/dashboard"[\s\S]*?<LecturerOnly>[\s\S]*?<LecturerDashboardPage \/>[\s\S]*?<\/LecturerOnly>/,
);
assert.match(
  app,
  /path="\/review"[\s\S]*?<LecturerOnly>[\s\S]*?<LecturerReviewPage \/>[\s\S]*?<\/LecturerOnly>/,
);
assert.match(
  app,
  /path="\/review\/answer\/:answerId"[\s\S]*?<LecturerOnly>[\s\S]*?<LecturerAnswerReviewRoute \/>[\s\S]*?<\/LecturerOnly>/,
);
assert.match(
  app,
  /path="\/review\/riwayat"[\s\S]*?<LecturerOnly>[\s\S]*?<LecturerReviewHistoryPage \/>[\s\S]*?<\/LecturerOnly>/,
);

for (const [path, page] of [
  ["/materi", "MateriPage"],
  ["/konsep", "KonsepPage"],
  ["/miskonsepsi", "MiskonsepsiPage"],
]) {
  assert.match(
    app,
    new RegExp(`<Route path="${path}" element={<${page} \\/>} \\/>`),
    `${path} must remain public`,
  );
}

assert.match(dashboard, /to="\/review"/);
assert.match(dashboard, /to="\/review\/riwayat"/);
assert.doesNotMatch(dashboard, /statistik|statistics|\b\d+%/i);

console.log("Application entry flow checks passed.");
